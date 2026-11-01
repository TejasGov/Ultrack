// The real car model, full throttle, held on a lateral line through one stretch of a track, in the game's own physics world: does it get
// through, or does something stop it? Exits 1 if any line stalls.
//   node scripts/qa-lock.mjs -- node scripts/qa-drive-through.mjs infinia 425 510 [car=laferrari] [lats=-9,-6,-4,0,4,6,9]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'infinia', from = '425', to = '510', car = 'laferrari', lats = '-9,-6,-4,0,4,6,9'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = JSON.parse(readFileSync(join(root, 'public', 'assets', track, 'track.json'), 'utf8')).centerline;
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript((t) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car: 'laferrari', settings: { track: t, look: 'day', weather: 'dry' } })); } catch { /* none */ } }, track);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5180');
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.click('.bento-tile[data-id=free]');
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.field?.pw, null, { timeout: 300000 });
const out = await page.evaluate(async ({ C, from, to, car, lats }) => {
  const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => import('three'));
  const { Vehicle } = await import('/src/physics/vehicle.js'), { handling } = await import('/src/physics/handling.js'), { STEP } = await import('/src/physics/world.js');
  const field = window.game.field, n = C.length, prof = field.hero.profile, res = [];
  const left = (i) => { const a = C[(i + n - 1) % n], b = C[(i + 1) % n], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1; return [tz / l, -tx / l]; };
  const nearest = (p, i0) => { let best = i0, bd = 1e9; for (let k = i0 - 5; k <= i0 + 12; k++) { const q = C[(k + n) % n], d = Math.hypot(q[0] - p.x, q[2] - p.z); if (d < bd) { bd = d; best = (k + n) % n; } } return best; };
  const far = C[(from + (n >> 1)) % n]; field.hero.vehicle.rb.setTranslation({ x: far[0], y: far[1] + 0.3, z: far[2] }, true);   // the session's own parked car is not the obstacle under test
  for (const target of lats) {
    const [lx, lz] = left(from), s = C[from], b = C[(from + 2) % n], pos = new field.hero.root.position.constructor(s[0] + lx * target, s[1] + 0.15, s[2] + lz * target);
    const v = new Vehicle(field.pw, handling(car), prof, { pos, yaw: Math.atan2(-(b[2] - s[2]), b[0] - s[0]) });
    let i = from, maxKmh = 0, stalled = 0, stalledAt = null, t = 0, latMin = 1e9, latMax = -1e9;
    for (; t < 20 && ((to - i + n) % n) < n / 2 && i !== to; t += STEP) {
      const p = v.cur.pos; i = nearest(p, i);
      const [ax, az] = left(i), lat = (p.x - C[i][0]) * ax + (p.z - C[i][2]) * az, f = C[(i + 8) % n], yawWant = Math.atan2(f[2] + az * target - (C[i][2] + az * target), f[0] + ax * target - (C[i][0] + ax * target));
      const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(v.cur.quat), yaw = Math.atan2(fwd.z, fwd.x); let dy = yawWant - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      Object.assign(v.controls, { throttle: 1, brake: 0, handbrake: 0, nitro: 0, steer: Math.max(-1, Math.min(1, -dy * 2.2 + (target - lat) * 0.12 * Math.sign(1))) });
      v.step(STEP, { counter: 0.6, stability: 1.4, tcs: 1 }); field.pw.world.step();
      maxKmh = Math.max(maxKmh, v.speed * 3.6); if (t > 2) { latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat); }
      if (t > 2 && v.speed < 2) { stalled += STEP; if (stalled > 0.5 && stalledAt === null) stalledAt = i; } else stalled = 0;
    }
    res.push({ lat: target, reached: i, seconds: +t.toFixed(1), maxKmh: Math.round(maxKmh), heldLat: [+latMin.toFixed(1), +latMax.toFixed(1)], stalledAt });
    field.pw.world.removeRigidBody(v.rb); field.pw.world.step();
  }
  return res;
}, { C, from: +from, to: +to, car, lats: lats.split(',').map(Number) });
await browser.close();
for (const r of out) console.log(JSON.stringify(r));
const bad = out.filter((r) => r.stalledAt !== null || r.reached !== +to);
console.log(bad.length ? `STOPPED on ${bad.length} of ${out.length} lines` : `all ${out.length} lines through, ${from} to ${to}`);
process.exit(bad.length ? 1 : 0);
