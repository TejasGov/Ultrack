// Frame cost of Venice beside Infinia, same machine, same sitting (viewer.bench: each frame forced to finish on the GPU, dynamic resolution off, a warm-up first; memory: race-watch fps is not comparable across runs).
//   node track-viewer/scripts/qa-lock.mjs -- node tracks/venice/qa_bench.mjs
import { chromium } from 'file:///D:/RaceUltimate/track-viewer/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const VIEW = { venice: [[1080, 'lap']], infinia: [[300, 'lap']] };      // bench flies the whole lap, so one is enough
const results = {};
for (const track of ['venice', 'infinia', 'venice', 'infinia']) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(([t, look]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: t, look, weather: 'dry' } })); } catch { /* none */ } }, [track, process.env.LOOK ?? 'dusk']);      // LOOK=night: the frame cost after dark
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  const t0 = Date.now();
  await page.goto('http://127.0.0.1:5180'); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.click('.bento-tile[data-id=free]'); await page.click('.panel.setup button.cta');
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000 });
  const load = Date.now() - t0;
  const C = await page.evaluate((t) => fetch(`/assets/${t}/track.json`).then((r) => r.json()).then((j) => j.centerline), track);
  const out = [];
  await page.evaluate(() => { const v = window.viewer; v.params.dynamicRes = false; window.game.hud.show(false); v.params.mode = 'orbit'; });
  for (const [st, name] of VIEW[track]) {
    const p = C[st % C.length], q = C[(st + 40) % C.length];
    const r = await page.evaluate(async ([p, q]) => {
      const v = window.viewer; v.camera.position.set(p[0], p[1] + 1.6, p[2]); v.controls.target.set(q[0], q[1] + 2, q[2]); v.controls.update(); v.camera.lookAt(q[0], q[1] + 2, q[2]);
      await new Promise((f) => setTimeout(f, 600)); await v.bench(20, { width: 1600, height: 900 }); const b = await v.bench(120, { width: 1600, height: 900 }); const i = v.renderer.info.render; return { b, calls: i.calls, tris: i.triangles };
    }, [p, q]);
    out.push({ name, ...r });
  }
  const mem = await page.evaluate(() => { const i = window.viewer.renderer.info.memory; return { geom: i.geometries, tex: i.textures }; });
  console.log(track, 'load', load, 'ms', JSON.stringify(mem), errs.length ? errs : '', JSON.stringify(out));
  results[track] = out; await ctx.close();
}
await browser.close();
