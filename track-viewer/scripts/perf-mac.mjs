// A real race at a MacBook's window (default 1512x982, DPR 2, the game's auto tier), the AI driving, every frame timed from the inside: the whole tick with its GPU work
// forced to finish (1-pixel readback), so the numbers do not depend on how headless Chrome schedules rAF. Frames over 33 ms are listed with what changed during them
// (shader programs, textures, geometries, a heap drop = GC). This is an approximation of a Mac: the same pixels and passes on this PC's GPU and D3D11, not Metal.
//   node scripts/qa-lock.mjs -- node scripts/perf-mac.mjs [track=marina] [--look dusk] [--weather dry] [--seconds 25] [--size 1512x982] [--dpr 2] [--cpu 1] [--mode race|free]
//        [--quality auto] [--dynres] [--query perf=off] [--url http://127.0.0.1:5180] [--label x]
// Out: qa/perf-mac/<label>-<track>.json and one summary line.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { args as parseArgs, root } from './perf-open.mjs';

const { flag, pos, has } = parseArgs(process.argv.slice(2));
const track = pos[0] ?? 'marina', [W, H] = flag('size', '1512x982').split('x').map(Number), dpr = +flag('dpr', 2), seconds = +flag('seconds', 25), cpu = +flag('cpu', 1);
const look = flag('look', null), weather = flag('weather', 'dry'), mode = flag('mode', 'race'), quality = flag('quality', 'auto'), query = flag('query', ''), label = flag('label', 'run'), base = flag('url', 'http://127.0.0.1:5180');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
await ctx.addInitScript(([track, look, weather, quality]) => {
  try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, ...(look ? { look } : {}), weather, quality } })); } catch { /* none */ }
  // another session saving a file must not reload this page
  const WS = window.WebSocket, F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new WS(u, p); }; F.prototype = WS.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F;
  const R = window.__R = { on: false, rows: [], long: [], cur: null };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    if (!R.on) return cb(t);
    const f = R.cur = { t0: performance.now(), drive: 0, game: 0, render: 0, wait: 0, rendered: false };
    cb(t);
    f.js = performance.now() - f.t0; R.cur = null;
    if (f.rendered) R.rows.push(f);
  });
  // what the GL calls that stall a frame cost: uploads, buffer data, programs (with who asked, for the slowest)
  const P = WebGL2RenderingContext.prototype;
  if (!location.search.includes('noprobe')) for (const k of ['texImage2D', 'texSubImage2D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'texStorage2D', 'generateMipmap', 'bufferData', 'bufferSubData', 'linkProgram', 'compileShader', 'getProgramParameter', 'renderbufferStorageMultisample']) {
    const fn = P[k];
    P[k] = function (...a) { const c = R.cur; if (!c) return fn.apply(this, a); const s = performance.now(); const r = fn.apply(this, a); const d = performance.now() - s; c.gl = (c.gl ?? 0) + d; (c.glBy ??= {})[k] = (c.glBy[k] ?? 0) + d; if (d > 2 && R.stack) (c.stacks ??= []).push(`${k} ${d.toFixed(1)}ms ${new Error().stack.split('\n').slice(2, 7).map((x) => x.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').split(' (')[0]).join(' < ')}`); return r; };
  }
  R.stack = true;
  try { new PerformanceObserver((l) => { if (R.on) for (const e of l.getEntries()) R.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask' }); } catch { /* none */ }
}, [track, look, weather, quality]);
const page = await ctx.newPage(), errors = [];
const infos = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); else if (/Graphics|warmed|Race preload/.test(m.text())) infos.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(base + (query ? '/?' + query : ''));
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 240000, polling: 100 });
const titleMs = await page.evaluate(() => Math.round(performance.now()));
await page.keyboard.press('Enter');
await page.waitForSelector(`.bento-tile[data-id=${mode}]`, { state: 'visible' });
await page.click(`.bento-tile[data-id=${mode}]`);
await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
const t0 = await page.evaluate(() => performance.now());
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000, polling: 100 });
const startMs = Math.round(await page.evaluate(() => performance.now()) - t0);
if (cpu > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
await page.waitForFunction(() => window.game.session.field.rig, null, { timeout: 60000 });
const env = await page.evaluate(([dynres]) => {
  const v = window.viewer, g = window.game, f = g.session.field, R = window.__R, gl = v.renderer.getContext(), px = new Uint8Array(4), info = v.renderer.info;
  f.setPlayer?.(false); v.params.player = false; v.params.fpsCap = 1000;
  if (!dynres) v.params.dynamicRes = false;
  const time = (o, k, slot) => { const fn = o[k]; o[k] = function (...a) { const c = R.cur, s = performance.now(); try { return fn.apply(this, a); } finally { if (c) c[slot] += performance.now() - s; } }; };
  time(f, 'drive', 'drive'); time(g, 'update', 'game');
  const render = v.composer.render;
  v.composer.render = function (...a) {
    const c = R.cur; if (!c) return render.apply(this, a);
    const s = performance.now(); render.apply(this, a); const m = performance.now(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const e = performance.now();
    c.rendered = true; c.render = m - s; c.wait = e - m; c.calls = info.render.calls; c.tris = info.render.triangles; c.programs = info.programs.length; c.tex = info.memory.textures; c.geo = info.memory.geometries; c.heap = performance.memory?.usedJSHeapSize ?? 0; c.scale = v.params.renderScale;
  };
  return { gpu: v.device.gpu, tier: v.device.tier, cars: f.cars.length, canvas: [gl.drawingBufferWidth, gl.drawingBufferHeight], scale: v.params.renderScale, look: v.params.look };
}, [has('dynres')]);
await page.waitForFunction(() => window.game.session.state === 'running', null, { timeout: 60000 });
const cdp = has('profile') ? await ctx.newCDPSession(page) : null;
if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); await cdp.send('Profiler.start'); }
if (has('lights')) console.log(await page.evaluate(() => { const v = window.viewer, by = {}, f = v.renderer.info.programs; v.scene.traverseVisible((o) => { if (o.isLight) { const k = `${o.type}${o.castShadow ? ' shadow' : ''}${o.intensity > 0 ? '' : ' zero'}`; by[k] = (by[k] ?? 0) + 1; } }); const sample = f.find((p) => /physical/i.test(p.name) || p.cacheKey?.includes('MeshPhysical'))?.cacheKey?.slice(0, 500); const counts = {}; for (const p of f) counts[p.name] = (counts[p.name] ?? 0) + 1; return { by, programs: f.length, counts, sample }; }));
if (has('diag')) {   // why three rebuilds a material's program key mid-frame: the field that changed across each draw, by material
  const d = await page.evaluate(async () => {
    const v = window.viewer, r = v.renderer, keys = ['lightsStateVersion', 'outputColorSpace', 'instancing', 'instancingColor', 'instancingMorph', 'skinning', 'batching', 'envMap', 'fog', 'vertexAlphas', 'vertexTangents', 'morphTargets', 'morphNormals', 'morphColors', 'toneMapping', 'morphTargetsCount', '__version', 'currentProgram'];
    const tally = {}, mats = {}, rbd = r.renderBufferDirect; let draws = 0;
    const NU = Object.getOwnPropertyDescriptor(v.THREE.Material.prototype, 'needsUpdate'), who = {};
    Object.defineProperty(v.THREE.Material.prototype, 'needsUpdate', { configurable: true, set(x) { if (x === true) { const k = new Error().stack.split(String.fromCharCode(10)).slice(2, 5).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').split('?')[0]).join(' < '); who[k] = (who[k] ?? 0) + 1; } NU.set.call(this, x); } });
    r.renderBufferDirect = function (cam, scn, geo, mat, obj, grp) {
      const p = r.properties.get(mat), b = keys.map((k) => p[k]); rbd.call(this, cam, scn, geo, mat, obj, grp); draws++;
      const ch = keys.filter((k, i) => p[k] !== b[i]);
      if (ch.length) { const t = r.getRenderTarget(), tk = (t?.isWebGLCubeRenderTarget ? 'cube' : t ? t.width + 'px' : 'screen') + ' ' + ch.join('+'); tally[tk] = (tally[tk] ?? 0) + 1; mats[mat.name || mat.type] = (mats[mat.name || mat.type] ?? 0) + 1; }
    };
    const f0 = r.info.render.frame; while (r.info.render.frame < f0 + 180) await new Promise((x) => requestAnimationFrame(x));
    r.renderBufferDirect = rbd; Object.defineProperty(v.THREE.Material.prototype, 'needsUpdate', NU);
    return { draws, who, tally, mats: Object.entries(mats).sort((a, b) => b[1] - a[1]).slice(0, 30), frames: r.info.render.frame - f0 };
  });
  console.log('diag: per 180 renderer frames; draws', d.draws, d.frames); console.log(d.tally, d.who); console.log(d.mats.map(([k, n]) => `${k} ${n}`).join(' | '));
}
await page.evaluate(() => { window.__R.on = true; });
await page.waitForTimeout(seconds * 1000);
if (cdp) {   // where the main thread's time and the allocations go
  const { profile } = await cdp.send('Profiler.stop'), { profile: heap } = await cdp.send('HeapProfiler.stopSampling');
  const self = new Map(), dt = profile.timeDeltas, byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id), k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-1)[0].split('?')[0]}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + dt[i] / 1000); });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  console.log('  top self time (ms per second of race):'); [...self].sort((a, b) => b[1] - a[1]).slice(0, 45).forEach(([k, v]) => console.log(`   ${(v / seconds).toFixed(1).padStart(7)}  ${k}`));
  const alloc = new Map(); const walk = (n) => { const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-1)[0].split('?')[0]}:${n.callFrame.lineNumber + 1}`; alloc.set(k, (alloc.get(k) ?? 0) + n.selfSize); n.children.forEach(walk); }; walk(heap.head);
  const at = [...alloc.values()].reduce((a, b) => a + b, 0);
  console.log(`  allocation: ${(at / 1048576 / seconds).toFixed(1)} MB/s; top:`); [...alloc].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, v]) => console.log(`   ${(v / 1048576 / seconds).toFixed(2).padStart(7)} MB/s  ${k}`));
}
const raw = await page.evaluate(() => { const R = window.__R; R.on = false; return { rows: R.rows, long: R.long }; });
await browser.close();

const rows = raw.rows, js = rows.map((r) => r.js), sorted = [...js].sort((a, b) => a - b), avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length), mean = (k) => +avg(rows.map((r) => r[k])).toFixed(2);
const worst1 = sorted.slice(Math.floor(sorted.length * 0.99));
const spikes = []; rows.forEach((r, i) => { if (i && r.js > 33) { const p = rows[i - 1]; spikes.push({ at: +((r.t0 - rows[0].t0) / 1000).toFixed(1), ms: +r.js.toFixed(0), render: +r.render.toFixed(0), wait: +r.wait.toFixed(0), drive: +r.drive.toFixed(0), game: +r.game.toFixed(0), programs: r.programs - p.programs, tex: r.tex - p.tex, geo: r.geo - p.geo, heapMB: +((r.heap - p.heap) / 1048576).toFixed(1), gl: +(r.gl ?? 0).toFixed(0), glBy: r.glBy, stacks: r.stacks?.slice(0, 4) }); } });
const out = { track, label, size: `${W}x${H}@${dpr}`, cpu, query, env, titleMs, startMs, frames: rows.length, avgMs: +avg(js).toFixed(2), estFps: +(1000 / avg(js)).toFixed(0), p50: +sorted[sorted.length >> 1].toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), p99: +sorted[Math.floor(sorted.length * 0.99)].toFixed(1), low1Fps: +(1000 / avg(worst1)).toFixed(0), over33: js.filter((x) => x > 33).length, over50: js.filter((x) => x > 50).length, over100: js.filter((x) => x > 100).length, worst: +sorted.at(-1).toFixed(0),
  driveMs: mean('drive'), gameMs: mean('game'), renderMs: mean('render'), gpuWaitMs: mean('wait'), glMs: mean('gl'), calls: Math.round(avg(rows.map((r) => r.calls))), trisK: Math.round(avg(rows.map((r) => r.tris)) / 1000), programsEnd: rows.at(-1)?.programs, programsNew: (rows.at(-1)?.programs ?? 0) - (rows[0]?.programs ?? 0), texNew: (rows.at(-1)?.tex ?? 0) - (rows[0]?.tex ?? 0), geoNew: (rows.at(-1)?.geo ?? 0) - (rows[0]?.geo ?? 0), spikes: spikes.sort((a, b) => b.ms - a.ms).slice(0, 25), long: raw.long.slice(0, 30), errors: errors.slice(0, 6) };
const dir = join(root, 'qa', 'perf-mac'); mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${label}-${track}.json`), JSON.stringify(out, null, 1));
console.log(`${track} ${out.size} cpu×${cpu} ${query} | ${env.tier} scale ${env.scale} canvas ${env.canvas.join('x')} ${env.cars} cars ${env.look} | ${out.frames}f avg ${out.avgMs} ms (≈${out.estFps} fps) p50 ${out.p50} p95 ${out.p95} p99 ${out.p99} 1%low ${out.low1Fps} fps | >33ms ${out.over33} >50ms ${out.over50} >100ms ${out.over100} worst ${out.worst} | drive ${out.driveMs} game ${out.gameMs} submit ${out.renderMs} gpuWait ${out.gpuWaitMs} | ${out.calls} draws ${out.trisK}k tris | gl ${out.glMs} | new programs ${out.programsNew} tex ${out.texNew} geo ${out.geoNew} | title ${titleMs} start ${startMs}`);
console.log('  programs', out.programsEnd, '|', infos.join(' | '));
console.log('  spikes', out.spikes.slice(0, 8).map((s) => `${s.ms}ms@${s.at}s[r${s.render} w${s.wait} d${s.drive} g${s.game} p+${s.programs} t+${s.tex} g+${s.geo} h${s.heapMB} gl${s.gl}]`).join(' '));
for (const sp of out.spikes.slice(0, 6)) for (const st of sp.stacks ?? []) console.log('   ', st.slice(0, 220));
if (errors.length) console.log('  errors', errors.slice(0, 4));
