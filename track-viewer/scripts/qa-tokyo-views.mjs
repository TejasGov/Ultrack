// In-game look check of Tokyo: five views in every look (day, dusk, bluehour, night), console errors and load time.
//   node scripts/qa-tokyo-views.mjs [url=http://127.0.0.1:5180] [looks=day,dusk,bluehour,night]
// Shots go to qa/tokyo-views/<view>-<look>.png; the sheet is built by tracks/tokyo/make_game_sheet.py
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOLOS } from '../src/venue/tokyo/holograms.js';

const args = process.argv.slice(2);
const base = args[0] ?? 'http://127.0.0.1:5180';
const looks = (args[1] ?? 'day,dusk,bluehour,night').split(',');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.OUT ?? join(root, 'qa', 'tokyo-views');
mkdirSync(out, { recursive: true });
const trackDir = join(root, '..', 'tracks', 'tokyo', 'out');
const track = JSON.parse(readFileSync(join(trackDir, 'track.json'), 'utf8'));
const src = JSON.parse(readFileSync(join(trackDir, 'centerline-v10.json'), 'utf8')).points;
const C = track.centerline;                                // game coords [x, y(up), z]
const at = (i, up = 0) => { const p = C[((i % C.length) + C.length) % C.length]; return [p[0], p[1] + up, p[2]]; };
// source frame -> game frame (the same transform as game_v13_1.py: start index, rotate the start heading onto +X)
const i0 = src.reduce((b, p, i, a) => (Math.hypot(p[0] + 188.67, p[1] + 513.7) < Math.hypot(a[b][0] + 188.67, a[b][1] + 513.7) ? i : b), 0);
const rot = -Math.atan2(src[(i0 + 1) % src.length][1] - src[(i0 - 1 + src.length) % src.length][1], src[(i0 + 1) % src.length][0] - src[(i0 - 1 + src.length) % src.length][0]);
const toGame = (x, y, z) => { const dx = x - src[i0][0], dy = y - src[i0][1]; const gx = Math.cos(rot) * dx - Math.sin(rot) * dy, gy = Math.sin(rot) * dx + Math.cos(rot) * dy; return [gx, z, -gy]; };
const gardenSrc = JSON.parse(readFileSync(join(trackDir, 'v13_1-build.json'), 'utf8')).garden_after ?? null;
const garden = toGame(-351, -625, 3);
let near = 0, bd = 1e9;
C.forEach((p, i) => { const d = Math.hypot(p[0] - garden[0], p[2] - garden[2]); if (d < bd) { bd = d; near = i; } });
const VIEWS = {
  '1-start-straight': { cam: at(-4, 1.7), tgt: at(40, 5) },
  '2-neon-street-fuji': { cam: at(207, 1.65), tgt: at(262, 8) },
  '3-bridge': { cam: at(642, 1.5), tgt: at(685, 24) },
  '4-tunnel': { cam: at(1003, 1.5), tgt: at(1060, 2.5) },
  '5-garden-from-road': { cam: at(near - 22, 1.6), tgt: garden },
};
// set pieces (src/venue/tokyo/*): views 6+ ; ONLY=6,7 limits the run to views whose name starts with one of the prefixes
const sideOf = (i, lat, up) => { const a = C[i], b = C[i + 2], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz); return [a[0] - dz / l * lat, a[1] + up, a[2] + dx / l * lat]; };   // a point lat m to the side of the centerline
const holoMid = (h) => [h.base[0], h.base[1] + h.h * 0.5, h.base[2]];
Object.assign(VIEWS, {
  '6a-holo-tunnel-exit': { cam: at(1146, 1.5), tgt: holoMid(HOLOS[0]) },
  '6b-holo-bridge-approach': { cam: at(655, 1.5), tgt: holoMid(HOLOS[1]) },
  '6c-holo-neon-street': { cam: at(218, 1.5), tgt: holoMid(HOLOS[2]) },
  '7a-torii-approach': { cam: at(1160, 1.5), tgt: at(1215, 7) },
  '7b-torii-inside': { cam: at(1188, 1.5), tgt: at(1232, 6) },
  '7c-torii-side': { cam: sideOf(1200, -45, 16), tgt: at(1206, 7) },
  '8a-petals-neon-street': { cam: at(196, 2), tgt: [536, 10, -297] },
  '8b-petals-east-straight': { cam: at(92, 2), tgt: [584, 9, -93] },
  '9a-pond-lanterns': { cam: [-139, 2.5, 94], tgt: [-152, 0.3, 108] },
  '9b-pond-koi': { cam: [-170, 2.6, 97.5], tgt: [-160, 0.2, 111] },
});
const only = process.env.ONLY?.split(',');
for (const name of Object.keys(VIEWS)) if (only && !only.some((p) => name.startsWith(p))) delete VIEWS[name];
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const errors = [];
await ctx.addInitScript(([look, weather]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: 'tokyo', look, weather } })); } catch { /* none */ } }, [looks[0], process.env.WEATHER ?? 'dry']);   // WEATHER=damp|rain (store.js WEATHER)
// a stub for Vite's HMR socket: any agent saving a file would otherwise reload this page mid-run and leave it on the title screen
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
const t0 = Date.now();
await page.goto(base);
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 120000 });
const tTitle = Date.now() - t0;
await page.keyboard.press('Enter');
await page.waitForSelector('.bento-tile[data-id=free]', { state: 'visible' });
await page.click('.bento-tile[data-id=free]');
await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
const t1 = Date.now();
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000 });
const tRace = Date.now() - t1;
console.log('track:', await page.evaluate(() => window.viewer.trackId?.()), `| title ready ${tTitle} ms, Free Drive load ${tRace} ms`);
await page.evaluate(() => { window.game.hud.show(false); window.viewer.params.mode = 'orbit'; });
const stats = {};
for (const [name, v] of Object.entries(VIEWS)) {
  for (const look of looks) {
    await page.evaluate(async ([look, v]) => {
      const w = window.viewer; w.params.look = look; await w.setLook(look); w.applyAll();
      w.camera.position.set(...v.cam); w.controls.target.set(...v.tgt); w.controls.update(); w.camera.lookAt(...v.tgt);
    }, [look, v]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(out, `${name}-${look}.png`), timeout: 240000 });
    if (look === looks[looks.length - 1]) stats[name] = await page.evaluate(() => { const r = window.viewer.renderer.info; return { calls: r.render.calls, triangles: r.render.triangles }; });
  }
  console.log('shot', name);
}
console.log('renderer info (night, last frame per view):', JSON.stringify(stats));
writeFileSync(join(out, 'report.json'), JSON.stringify({ errors, tTitle, tRace, stats }, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
