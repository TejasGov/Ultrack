// Frame-by-frame handling comparison: Endurance (e) vs Ultrack (u). node qa/cmp/rec.mjs <e|u> <scenario> [headed]
// Records the screen (CDP screencast, every frame) while it plays exact key timings; frames + times go to research/endurance/cmp/<game><scenario>/
import { chromium } from 'playwright-core';
import fs from 'fs';
const [game, sc, headed] = process.argv.slice(2);
const out = `D:/RaceUltimate/research/endurance/cmp/${game}${sc}/`; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: !headed,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const W = (ms) => p.waitForTimeout(ms);
const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 200)));
const tel = [];   // Ultrack only: speed, yaw rate, slip angle, steer from the live vehicle
if (game === 'e') {
  await p.goto('https://endurance-racing.vercel.app'); await W(9000);
  await p.getByText('FREE DRIVE').first().click(); await W(500); await p.keyboard.press('Enter'); await W(10000);
} else {
  await p.goto('http://localhost:5180'); await W(14000); await p.keyboard.press('Space'); await W(4000);
  await p.click('.free-tile'); await W(1500);
  await p.locator('button.cta:visible').first().click(); await W(30000);
}
const cdp = await p.context().newCDPSession(p); const frames = []; const t0 = Date.now();
cdp.on('Page.screencastFrame', async (f) => { frames.push({ t: Date.now() - t0, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
const probe = game === 'u' ? setInterval(async () => {
  const s = await p.evaluate(() => { const v = window.__game?.field?.hero?.vehicle ?? window.game?.field?.hero?.vehicle; if (!v) return null;
    return { kmh: v.speed * 3.6, yaw: v.rb?.angvel?.().y * 57.3, beta: v.state?.beta * 57.3, steer: v.state?.steer * 57.3 }; }).catch(() => null);
  if (s) tel.push({ t: Date.now() - t0, ...s });
}, 50) : null;
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: +process.env.SW || 800, maxHeight: +process.env.SH || 450 });
const marks = [];
const act = async (k, a, ms) => { if (a === 'down') await p.keyboard.down(k); else await p.keyboard.up(k); marks.push(`${Date.now() - t0} ${k} ${a}`); if (ms) await W(ms); };
const S = {   // scenarios: 4 hold W 8 s, lift 1 s, W 3 s (pops on lift-off and upshifts),
  4: async () => { await act('KeyW', 'down', 8000); await act('KeyW', 'up', 150);
    for (let i = 0; i < 3; i++) { marks.push(`${Date.now() - t0} pop force`); await p.evaluate(() => { const f = (window.__game ?? window.game).field, c = f.hero, S = f.fx.state(c); f.fx.pop(c, S, { crackle: 1.2, size: 1, gap: 1, shift: 0.3, ...(c.fxSpec ?? {}) }, 1); }).catch(() => {}); await W(260); }   // random pops can miss: force three through the same code
    await W(300); await act('KeyW', 'down', 3000); await act('KeyW', 'up'); },
  //  0 hold W 12 s (find the first corner),
  0: async () => { await act('KeyW', 'down', 12000); await act('KeyW', 'up'); },
  // also: 1 straight-line taps, 2 brake then turn at the first corner, 3 handbrake turn at the first corner
  1: async () => { await act('KeyW', 'down', 4500); await act('KeyD', 'down', 250); await act('KeyD', 'up', 1500); await act('KeyA', 'down', 250); await act('KeyA', 'up', 1500); await act('KeyW', 'up'); },
  2: async () => { await act('KeyW', 'down', +process.env.RUN || 7000); await act('KeyW', 'up'); await act('KeyS', 'down', +process.env.BRAKE || 1200); await act('KeyS', 'up');
    await act(process.env.DIR || 'KeyD', 'down'); await act('KeyW', 'down', 2500); await act(process.env.DIR || 'KeyD', 'up', 1000); await act('KeyW', 'up'); },
  3: async () => { await act('KeyW', 'down', +process.env.RUN || 7000); await act('KeyW', 'up'); await act('KeyS', 'down', +process.env.BRAKE || 1); await act('KeyS', 'up'); await act('KeyW', 'down'); await act(process.env.DIR || 'KeyD', 'down'); await act('Space', 'down', +process.env.HB || 700); await act('Space', 'up', 1800);
    await act(process.env.DIR || 'KeyD', 'up', 1000); await act('KeyW', 'up'); },
};
await S[sc]();
await cdp.send('Page.stopScreencast'); if (probe) clearInterval(probe);
frames.forEach((f, i) => fs.writeFileSync(out + String(i).padStart(3, '0') + '.jpg', Buffer.from(f.data, 'base64')));
fs.writeFileSync(out + 'times.json', JSON.stringify({ frames: frames.map((f) => f.t), marks, tel }, null, 0));
console.log(frames.length, 'frames', marks.join(' | '), 'errors:', errs.length, errs.slice(0, 3));
await b.close();
