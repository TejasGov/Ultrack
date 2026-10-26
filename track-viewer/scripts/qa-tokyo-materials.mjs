// Before/after of src/venue/tokyo/materials.js in ONE session: every view is shot with the effect on (after/) and off (before/),
// so nothing else that changes in the shared dev server between two runs leaks into the comparison.
//   OUT=qa/tokyo-refactor/materials node scripts/qa-lock.mjs -- node scripts/qa-tokyo-materials.mjs [url] [looks=day,dusk,bluehour,night]
// Views: the five standard ones of qa-tokyo-views.mjs plus close views of roofs, shoji, timber, lacquer, stone (VIEWS_FILE, default
// qa/tokyo-refactor/materials/close-views.json: name -> { cam: [x,y,z] | { idx, up }, tgt, fov }). ONLY=c1,3 limits the run by name prefix.
// COMPILE=1 first boots once with ?tmat=0 and prints both builds' 'Graphics preparation' (shader compile ms, programs); BENCH=1 adds
// bench() frame times along the lap for each (BENCH_LOOKS=night,day). COMPILE=2 boots the baseline AFTER the normal build instead (the second boot is warm in the driver's shader cache).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const base = args[0] ?? 'http://127.0.0.1:5180';
const looks = (args[1] ?? 'day,dusk,bluehour,night').split(',');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.OUT ?? join(root, 'qa', 'tokyo-refactor', 'materials');
const trackDir = join(root, '..', 'tracks', 'tokyo', 'out');
const C = JSON.parse(readFileSync(join(trackDir, 'track.json'), 'utf8')).centerline;
const at = (i, up = 0) => { const p = C[((i % C.length) + C.length) % C.length]; return [p[0], p[1] + up, p[2]]; };
// the standard views, as in qa-tokyo-views.mjs (the garden target is derived there from the source frame; here its camera index is fixed)
const VIEWS = {
  '1-start-straight': { cam: at(-4, 1.7), tgt: at(40, 5) },
  '2-neon-street-fuji': { cam: at(207, 1.65), tgt: at(262, 8) },
  '3-bridge': { cam: at(642, 1.5), tgt: at(685, 24) },
  '4-tunnel': { cam: at(1003, 1.5), tgt: at(1060, 2.5) },
};
const file = process.env.VIEWS_FILE ?? join(root, 'qa', 'tokyo-refactor', 'materials', 'close-views.json');
if (existsSync(file)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) VIEWS[k] = { ...v, cam: v.cam.idx !== undefined ? at(v.cam.idx, v.cam.up ?? 1.7) : v.cam, tgt: v.tgt.idx !== undefined ? at(v.tgt.idx, v.tgt.up ?? 0) : v.tgt };
const only = process.env.ONLY?.split(',');
for (const name of Object.keys(VIEWS)) if (only && !only.some((p) => name.startsWith(p))) delete VIEWS[name];

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const errors = [], infos = [];
async function boot(url) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(([look]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: 'tokyo', look, weather: 'dry' } })); } catch { /* none */ } }, [looks[0]]);
  // Vite's HMR socket reloads the page whenever any agent saves a file: a stub that never connects keeps this run on one build
  await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (/Graphics preparation|tokyo materials/.test(t)) { infos.push(url + ' ' + t.slice(0, 300)); console.log(t.slice(0, 300)); }
    else if (m.type() === 'error' || (m.type() === 'warning' && !/X4122|KTX2Loader: Multiple/.test(t))) errors.push(m.type() + ': ' + t.slice(0, 500));
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 120000 });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.bento-tile[data-id=free]', { state: 'visible' });
  await page.click('.bento-tile[data-id=free]');
  await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
  const t1 = Date.now();
  await page.click('.panel.setup button.cta');
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 240000 });
  console.log(url, 'race load', Date.now() - t1, 'ms');
  if (process.env.BENCH) {      // frame time along the lap (viewer bench()), A/B/A/B inside this session: the machine's load is the same either side
    await page.evaluate(() => { window.game.hud.show(false); });
    for (const look of (process.env.BENCH_LOOKS ?? 'night').split(',')) {
      await page.evaluate(async (look) => { const w = window.viewer; w.params.look = look; await w.setLook(look); w.applyAll(); }, look);
      const seq = (await page.evaluate(() => !!window.__tokyoMat)) ? [true, false, true, false] : [null];
      for (const on of seq) {
        if (on !== null) await page.evaluate((on) => { window.__tokyoMat.shaders(on); window.__tokyoMat.set(on); window.viewer.applyAll(); }, on);
        await page.evaluate(() => window.viewer.bench(40));      // warm-up: compiles what the switch needs
        const r = await page.evaluate(() => window.viewer.bench(90));
        console.log('bench', look, on === null ? 'baseline build' : on ? 'materials ON ' : 'materials OFF', `avg ${r.avgMs} ms  p95 ${r.p95Ms} ms  draws ${r.drawCalls}  scale ${r.renderScale}`);
      }
      if (seq.length > 1) await page.evaluate(() => { window.__tokyoMat.shaders(true); window.__tokyoMat.set(true); });
    }
  }
  await page.evaluate(() => { window.game.hud.show(false); window.viewer.params.mode = 'orbit'; });
  return { ctx, page };
}

const baseline = async () => { const b = await boot(base + '/?tmat=0'); await b.ctx.close(); };
if (process.env.COMPILE && process.env.COMPILE !== '2') await baseline();
const { ctx, page } = await boot(base + '/' + (process.env.QS ?? ''));   // QS=?tmtex=0 shoots the procedural fallbacks instead of the photo sets
const fov0 = await page.evaluate(() => window.viewer.camera.fov);
mkdirSync(join(out, 'before'), { recursive: true }); mkdirSync(join(out, 'after'), { recursive: true });
const have = await page.evaluate(() => !!window.__tokyoMat);
if (!have) { console.error('window.__tokyoMat missing: materials.js did not load'); process.exitCode = 1; }
const stats = {};
for (const look of looks) {
  await page.evaluate(async (look) => { const w = window.viewer; w.params.look = look; await w.setLook(look); w.applyAll(); }, look);
  for (const [name, v] of Object.entries(VIEWS)) {
    await page.evaluate(([v, fov0]) => {
      const w = window.viewer; w.camera.fov = v.fov ?? fov0; w.camera.updateProjectionMatrix();
      w.camera.position.set(...v.cam); w.controls.target.set(...v.tgt); w.controls.update(); w.camera.lookAt(...v.tgt);
    }, [v, fov0]);
    for (const on of [true, false]) {
      await page.evaluate((on) => { window.__tokyoMat?.set(on); }, on);      // uniforms and the shoji glow only: the lights and shadows stay as they are
      await page.waitForTimeout(on ? 2500 : 1200);
      await page.screenshot({ path: join(out, on ? 'after' : 'before', `${name}-${look}.png`), timeout: 240000 });
    }
    await page.evaluate(() => { window.__tokyoMat?.set(true); });
    if (look === looks[looks.length - 1]) stats[name] = await page.evaluate(() => { const r = window.viewer.renderer.info; return { calls: r.render.calls, triangles: r.render.triangles }; });
    console.log('shot', name, look);
  }
}
console.log('renderer info (last look, effect on):', JSON.stringify(stats));
writeFileSync(join(out, 'ab-report.json'), JSON.stringify({ errors, infos, stats }, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await ctx.close();
if (process.env.COMPILE === '2') await baseline();
await browser.close();
