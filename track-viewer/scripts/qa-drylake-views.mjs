// In-game look check of Mojave Dry Lake (tracks/drylake): ten views in its two looks, console errors, load time and draw stats.
//   node scripts/qa-drylake-views.mjs [url=http://127.0.0.1:5180] [looks=day,dusk]      WEATHER=damp|rain, ONLY=1-,3- (view prefixes)
// Shots go to qa/drylake-views/<view>-<look>.png. Views are anchored on track.json corners, so they follow a re-routed lap.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const base = args[0] ?? 'http://127.0.0.1:5180';
const looks = (args[1] ?? 'day,dusk').split(',');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.OUT ?? join(root, 'qa', 'drylake-views');
mkdirSync(out, { recursive: true });
const track = JSON.parse(readFileSync(join(root, '..', 'tracks', 'drylake', 'out', 'track.json'), 'utf8'));
const C = track.centerline, n = C.length, T = track.corners.map((c) => c.apexIdx);
const at = (i, up = 0) => { const p = C[((i % n) + n) % n]; return [p[0], p[1] + up, p[2]]; };
const off = (i, lat, up) => {     // `lat` m left (+) / right (-) of the centreline at sample i, `up` m over it
  const p = at(i), a = at(i - 1), b = at(i + 1), tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1;
  return [p[0] + (tz / l) * lat, p[1] + up, p[2] - (tx / l) * lat];
};
const mid = C.reduce((s, p) => [s[0] + p[0] / n, 0, s[2] + p[2] / n], [0, 0, 0]);
const VIEWS = {
  '1-start-straight': { cam: at(-6, 1.7), tgt: at(40, 3) },
  '2-t1-hairpin': { cam: at(T[0] - 40, 1.6), tgt: at(T[0] + 4, 1) },
  '3-boneyard-entry': { cam: at(T[1] - 30, 1.3), tgt: at(T[1] + 6, 2.5) },
  '4-under-wings': { cam: at(T[1] + 2, 1.1), tgt: at(T[1] + 14, 3.2) },
  '5-water-tower': { cam: at(T[3] - 22, 1.6), tgt: track.landmarks[0].pos },
  '6-back-straight': { cam: at(T[4] + 14, 1.6), tgt: at(T[4] + 60, 2) },
  '7-berm': { cam: at(T[T.length - 2] - 26, 1.4), tgt: at(T[T.length - 2] + 6, 1.5) },
  '8-aerial': { cam: [mid[0] - 260, 260, mid[2] + 420], tgt: [mid[0], 0, mid[2]] },
  '9-road-eye': { cam: at(20, 1.05), tgt: at(29, 0.2) },
  '10-kerb': { cam: off(T[0] - 6, 6.5, 0.75), tgt: off(T[0] - 2, 10.5, 0) },
};
const only = process.env.ONLY?.split(',');
for (const name of Object.keys(VIEWS)) if (only && !only.some((p) => name.startsWith(p))) delete VIEWS[name];
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const errors = [];
await ctx.addInitScript(([look, weather]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: 'drylake', look, weather } })); } catch { /* none */ } }, [looks[0], process.env.WEATHER ?? 'dry']);
// a stub for Vite's HMR socket: another agent saving a file would otherwise reload this page mid-run
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; window.WebSocket = F; });
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
    if (look === looks[0]) stats[name] = await page.evaluate(() => { const r = window.viewer.renderer.info; return { calls: r.render.calls, triangles: r.render.triangles }; });
  }
  console.log('shot', name);
}
console.log('renderer info (first look, last frame per view):', JSON.stringify(stats));
writeFileSync(join(out, 'report.json'), JSON.stringify({ errors, tTitle, tRace, stats }, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
