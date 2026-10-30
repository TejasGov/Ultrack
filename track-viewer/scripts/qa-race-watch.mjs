// A full headless race on one track with the AI driving the player's car, to the flag, while the chase camera is watched:
// every second it records the camera's height over the ground under it, whether static scenery hides the car from the lens,
// where the car sits in the frame, the frame time, the race state and any console error; a still every 15 s.
//   node scripts/qa-lock.mjs -- node scripts/qa-race-watch.mjs india [look=day] [laps=3] [url=http://127.0.0.1:5180]
// Out: qa/race-watch/<track>-<look>/ (shot-<t>.png, report.json); the summary is printed.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'india', look = 'day', laps = '3', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'qa', 'race-watch', `${track}-${look}`);
mkdirSync(out, { recursive: true });
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(([track, look, laps]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look, weather: 'dry', laps } })); } catch { /* none */ } }, [track, look, +laps]);
// Vite's HMR socket stubbed: another agent saving a file would otherwise reload the page mid-race
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(base);
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.waitForSelector('.bento-tile[data-id=race]', { state: 'visible' });
await page.click('.bento-tile[data-id=race]');
await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000 });
// the AI drives the hero; keep the camera's static ray cast for the checks below (Marina opens on an intro camera: wait for the chase rig)
await page.waitForFunction(() => window.game.session.field.rig, null, { timeout: 120000 });
await page.evaluate(() => {
  const f = window.game.session.field; f.setPlayer(false);
  const rig = f.rig, up = rig.update.bind(rig); rig.update = (cam, h, dt, o) => { window.__cast = o.cast; return up(cam, h, dt, o); };
  // every frame (this rAF runs after the app's render): its mean brightness on a 16x9 copy; a frame under a third of the recent
  // median is logged with where the car and the camera were (whole black frames in races)
  const cv = window.viewer.renderer.domElement, c2 = Object.assign(document.createElement('canvas'), { width: 16, height: 9 }), g2 = c2.getContext('2d', { willReadFrequently: true }), hist = [];
  window.__dark = [];
  window.__ft = []; let last = performance.now(); const tick = () => {
    const n = performance.now(); window.__ft.push(n - last); last = n;
    g2.drawImage(cv, 0, 0, 16, 9); const d = g2.getImageData(0, 0, 16, 9).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2];
    const b = s / 432, med = hist.length > 20 ? [...hist].sort((x, y) => x - y)[hist.length >> 1] : b;
    if (b < med / 3 && window.__dark.length < 200) { const h = window.game.session.field.hero.root.position, c = window.viewer.camera.position; window.__dark.push({ t: +window.game.session.raceT.toFixed(2), b: +b.toFixed(1), med: +med.toFixed(1), car: [h.x, h.y, h.z].map((v) => +v.toFixed(1)), cam: [c.x, c.y, c.z].map((v) => +v.toFixed(2)) }); }
    hist.push(b); if (hist.length > 60) hist.shift(); window.__darkMed = med;
    requestAnimationFrame(tick);
  }; requestAnimationFrame(tick);
});
const samples = [];
const t0 = Date.now(), maxMs = (+laps * 240 + 120) * 1000;
let nextShot = 0;
while (Date.now() - t0 < maxMs) {
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => {
    const g = window.game, S = g.session, h = S.field.hero, cam = window.viewer.camera, T = window.viewer.THREE, cast = window.__cast;
    const p = h.root.position, c = cam.position, r = { t: +S.raceT.toFixed(1), state: S.state, lap: S.trk.get(h)?.laps.length ?? 0, pos: S.heroPos, kmh: Math.round((h.speed ?? 0) * 3.6) };
    if (cast) {
      const gd = cast(c.clone().add(new T.Vector3(0, 1, 0)), new T.Vector3(0, -1, 0), 40); r.camOverGround = gd === null ? null : +(gd - 1).toFixed(2);
      const aim = p.clone().add(new T.Vector3(0, 0.7, 0)), dir = aim.clone().sub(c), L = dir.length(), hit = cast(c, dir.divideScalar(L), L);
      r.carHidden = hit !== null && hit < L - 0.6; r.camDist = +L.toFixed(2);
      const up = cast(c.clone(), new T.Vector3(0, 1, 0), 30); r.roofOver = up === null ? null : +up.toFixed(1);
    }
    const ndc = p.clone().add(new T.Vector3(0, 0.6, 0)).project(cam); r.ndc = [+ndc.x.toFixed(2), +ndc.y.toFixed(2)];
    const ft = window.__ft.splice(0); r.fps = ft.length ? Math.round(1000 / (ft.reduce((a, b) => a + b, 0) / ft.length)) : 0; r.worstMs = Math.round(Math.max(0, ...ft));
    r.y = +p.y.toFixed(2); r.camY = +c.y.toFixed(2); r.clear = +(S.field.rig.s?.clear ?? 1).toFixed(2);   // < 0.5: pulled in over the car
    return r;
  });
  samples.push(s);
  if (s.t >= nextShot) { await page.screenshot({ path: join(out, `shot-${String(Math.round(s.t)).padStart(4, '0')}.png`) }); nextShot += 15; }
  if (s.state === 'done') { await page.waitForTimeout(3000); await page.screenshot({ path: join(out, 'finish.png') }); break; }
}
const [darkFrames, frameLuma] = await page.evaluate(() => [window.__dark, window.__darkMed]);
await browser.close();
const bad = (f) => samples.filter(f).map((s) => s.t);
const summary = {
  track, look, laps: +laps, finished: samples.at(-1)?.state === 'done', raceTime: samples.at(-1)?.t, position: samples.at(-1)?.pos, samples: samples.length,
  camLowOrUnder: bad((s) => s.camOverGround !== null && s.camOverGround !== undefined && s.camOverGround < 0.2),
  carHidden: bad((s) => s.carHidden), pulledIn: bad((s) => s.clear < 0.5),carOffFrame: bad((s) => Math.abs(s.ndc[0]) > 0.8 || Math.abs(s.ndc[1]) > 0.8),
  stopped: bad((s) => s.state === 'running' && s.kmh < 10 && s.t > 15), slowFrames: bad((s) => s.worstMs > 100),
  darkFrames: darkFrames.length, frameLuma: +(frameLuma ?? 0).toFixed(1), darkAt: darkFrames.slice(0, 12),
  fps: { min: Math.min(...samples.map((s) => s.fps)), median: samples.map((s) => s.fps).sort((a, b) => a - b)[samples.length >> 1] },
  errors: [...new Set(errors)].slice(0, 40),
};
writeFileSync(join(out, 'report.json'), JSON.stringify({ summary, samples }, null, 1));
console.log(JSON.stringify(summary, null, 1));
