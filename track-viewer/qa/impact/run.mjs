// node qa/impact/run.mjs before|after   -> qa/impact/<tag>-N.png + pitch log. 'before' swaps in the original unclamped Chassis.update.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const tag = process.argv[2], url = process.argv[3] ?? 'http://localhost:5180';
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const b = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await p.goto(url); await p.waitForTimeout(8000);
for (let i = 0; i < 6; i++) { await p.keyboard.press('Enter'); const s = p.locator('button.cta:visible').first(); if (await s.count()) await s.click().catch(()=>{}); await p.waitForTimeout(4000); }
await p.waitForTimeout(8000);
if (tag === 'before') await p.evaluate(() => {
  const c = window.game.field.hero.chassis;
  c.update = function (dt, aLong, aLat, bump = 0) {   // original formula, no limits
    const sc = this.scale ?? 1, phys = sc < 1, W = { pitch: 3.2, roll: 1.6, freq: 0.8 };
    const t = { pitch: -aLong * this.k.pitch * sc * (phys ? W.pitch : 1), roll: -aLat * this.k.roll * sc * (phys ? W.roll : 1), heave: -Math.abs(aLat) * this.k.heave * 0.15 * sc + bump };
    const w = this.w * (phys ? W.freq : 1), n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (const a of ['pitch', 'roll', 'heave']) { let [x, v] = this.s[a]; for (let i = 0; i < n; i++) { v += (-w * w * (x - t[a]) - 2 * this.z * w * v) * h; x += v * h; } this.s[a] = [x, v]; }
    this.q.setFromEuler(this.e.set(this.s.roll[0], 0, this.s.pitch[0]));
    this.body.quaternion.copy(this.q); this.body.position.copy(this.pivot).sub(this.pivot.clone().applyQuaternion(this.q)); this.body.position.y += this.s.heave[0] + this.ride;
  };
});
await p.waitForFunction(() => window.game.state === 'session' && !window.game.field.hold, null, { timeout: 60000 });
await p.keyboard.down('KeyW');
let hit = false, shots = 0, log = [], peak = 0, t0 = Date.now();
while (Date.now() - t0 < 60000 && shots < 4) {
  const s = await p.evaluate(() => { const h = window.game.field.hero, c = h.chassis; return { kmh: h.speed * 3.6, pitch: c.pitchDeg, roll: c.rollDeg, y: c.body.position.y, lastCrash: window.game.session?.crashT }; }).catch(() => null); if (!s) { await p.waitForTimeout(300); continue; }
  if (s.kmh > 100) hit = hit || 'armed';
  if (hit === 'armed' && s.kmh < 70) hit = true;
  if (hit === true) { peak = Math.max(peak, Math.abs(s.pitch)); log.push(s); await p.screenshot({ path: `qa/impact/${tag}-${shots + 1}.png` }); shots++; await p.waitForTimeout(150); }
  else await p.waitForTimeout(40);
}
console.log(tag, 'hit', hit, 'peak |pitch| deg', peak.toFixed(1)); console.log(log.map(s => `${s.kmh.toFixed(0)}kmh p${s.pitch.toFixed(1)} r${s.roll.toFixed(1)} y${s.y.toFixed(3)}`).join('\n'));
await b.close();
