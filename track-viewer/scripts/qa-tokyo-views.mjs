// In-game look check of Tokyo: five views in every look (day, dusk, bluehour, night), console errors and load time.
//   node scripts/qa-tokyo-views.mjs [url=http://127.0.0.1:5180] [looks=day,dusk,bluehour,night]
// Shots go to qa/tokyo-views/<view>-<look>.png; the sheet is built by tracks/tokyo/make_game_sheet.py
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const errors = [];
await ctx.addInitScript(([look]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: 'tokyo', look, weather: 'dry' } })); } catch { /* none */ } }, [looks[0]]);
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
