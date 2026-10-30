// In-game look check of India: six views in every look (day, dusk, bluehour, night), console errors and load time.
//   node scripts/qa-india-views.mjs [url=http://127.0.0.1:5180] [looks=day,dusk,bluehour,night]
// Shots go to qa/india-views/<view>-<look>.png; the sheet is built by nothing yet
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const base = args[0] ?? 'http://127.0.0.1:5180';
const looks = (args[1] ?? 'day,dusk,bluehour,night').split(',');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.OUT ?? join(root, 'qa', 'india-views');
mkdirSync(out, { recursive: true });
const trackDir = join(root, '..', 'tracks', 'india', 'out');
const track = JSON.parse(readFileSync(join(trackDir, 'track.json'), 'utf8'));
const C = track.centerline;                                // game coords [x, y(up), z]
const at = (i, up = 0) => { const p = C[((i % C.length) + C.length) % C.length]; return [p[0], p[1] + up, p[2]]; };
const nearestIdx = (q) => C.reduce((b, p, i) => (Math.hypot(p[0] - q[0], p[2] - q[2]) < Math.hypot(C[b][0] - q[0], C[b][2] - q[2]) ? i : b), 0);
const UP = track.bridgeUplights.items.map((u) => u.pos), upc = [0, 1, 2].map((k) => UP.reduce((s, p) => s + p[k], 0) / UP.length);
const kavi = track.landmarks[0].pos, ki = nearestIdx(kavi), bi = nearestIdx(upc);
const VIEWS = {
  '1-start-straight': { cam: at(-4, 1.7), tgt: at(40, 5) },
  '2-city': { cam: at(597, 1.6), tgt: at(640, 7) },
  '3-bridge': { cam: at(bi - 45, 1.6), tgt: [upc[0], upc[1] + 18, upc[2]] },
  '4-kavi-chowk': { cam: at(ki - 20, 2), tgt: [kavi[0], kavi[1] + 8, kavi[2]] },
  '5-barrier-reflectors': { cam: at(300, 1.1), tgt: at(336, 0.6) },
  '6-hairpin': { cam: at(826, 1.6), tgt: at(850, 0) },
  // venue/india.js dressing: Jio boards (tracks.js `brands`), the city's OPPO / vivo façades, the BJP hoarding, the stands' crowd
  '7-jio-boards': { cam: at(nearestIdx([288, 16, -8]) - 14, 1.6), tgt: [288, 16.5, -8] },
  '8-jio-gantry': { cam: at(nearestIdx([477, 60, -178]) - 28, 1.6), tgt: [477, 59, -178] },
  '9-city-boards': { cam: at(505, 1.6), tgt: [424, 56, -200] },
  '10-city-boards-2': { cam: at(150, 1.6), tgt: [401.6, 49, -143.4] },
  '11-hoarding': { cam: at(458, 1.6), tgt: (() => { const p = at(485), q = at(487), r = at(483), tx = q[0] - r[0], tz = q[2] - r[2], l = Math.hypot(tx, tz); return [p[0] + tz / l * 17, p[1] + 5, p[2] - tx / l * 17]; })() },
  '12-kavi-crowd': { cam: at(nearestIdx([756, 55, -91]), 1.6), tgt: [756, 51, -91] },
  '13-west-crowd': { cam: at(nearestIdx([-113, 9, 60]), 1.6), tgt: [-113, 6, 60] },
  '14-pines': { cam: at(856, 1.6), tgt: at(880, 3) },
};
const only = process.env.ONLY?.split(',');
for (const name of Object.keys(VIEWS)) if (only && !only.some((p) => name.startsWith(p))) delete VIEWS[name];
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const errors = [];
await ctx.addInitScript(([look, weather]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: 'india', look, weather } })); } catch { /* none */ } }, [looks[0], process.env.WEATHER ?? 'dry']);   // WEATHER=damp|rain (store.js WEATHER)
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
