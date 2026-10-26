// Shared by perf-passes.mjs and perf-ab.mjs: opens the viewer in a headless Chrome (1920x1080, DPR 1) either as the game's Free Drive
// (the way qa-tokyo-views.mjs does: one car, the game's own settings) or as the bare developer viewer (?dev=1: the whole 8-car grid),
// and lists the views (centreline indices) both tools use.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function args(argv) {
  const flag = (name, def) => { const i = argv.indexOf('--' + name); return i < 0 ? def : argv[i + 1]; };
  const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  return { flag, pos, has: (n) => argv.includes('--' + n) };
}

export function views(track, pick) {
  const C = JSON.parse(readFileSync(join(root, '..', 'tracks', track, 'out', 'track.json'), 'utf8')).centerline, N = C.length;
  const V = track === 'tokyo'
    ? { 'start': -4, 'neon street': 207, 'bridge': 642, 'tunnel': 1003, 'garden': 'garden' }
    : { 'start': -4, 'T1': Math.round(N * 0.06), 'bridge': Math.round(N * 0.36), 'canopy': Math.round(N * 0.7), 'boardwalk': Math.round(N * 0.88) };
  if (track === 'tokyo') {   // the garden view of qa-tokyo-views.mjs
    const src = JSON.parse(readFileSync(join(root, '..', 'tracks', 'tokyo', 'out', 'centerline-v10.json'), 'utf8')).points;
    const i0 = src.reduce((b, p, i, a) => (Math.hypot(p[0] + 188.67, p[1] + 513.7) < Math.hypot(a[b][0] + 188.67, a[b][1] + 513.7) ? i : b), 0);
    const rot = -Math.atan2(src[(i0 + 1) % src.length][1] - src[(i0 - 1 + src.length) % src.length][1], src[(i0 + 1) % src.length][0] - src[(i0 - 1 + src.length) % src.length][0]);
    const dx = -351 - src[i0][0], dy = -625 - src[i0][1];
    const g = [Math.cos(rot) * dx - Math.sin(rot) * dy, 3, -(Math.sin(rot) * dx + Math.cos(rot) * dy)];
    let near = 0, bd = 1e9; C.forEach((p, i) => { const d = Math.hypot(p[0] - g[0], p[2] - g[2]); if (d < bd) { bd = d; near = i; } });
    V.garden = near - 22;
  }
  const names = Object.keys(V), use = pick ? names.filter((_, i) => pick.split(',').includes(String(i))) : names;
  return { C, N, V, names: use };
}

/** returns { browser, page, errors, env } with window.viewer ready; mode 'game' (Free Drive) or 'dev' */
export async function openViewer({ track, look, weather = 'dry', mode = 'game', base = 'http://127.0.0.1:5180', query = '' }) {
  const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  // a stub for Vite's HMR socket: any agent saving a file would otherwise reload this page mid-run (the shared dev server hot-reloads everyone)
  await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  let ready = false;   // a reload after this point is the dev server's hot reload of someone's edit: the run is spoiled, say so
  page.on('framenavigated', (f) => { if (ready && f === page.mainFrame()) { errors.push('PAGE RELOADED mid-run: ' + f.url().slice(0, 80)); console.log('!! page reloaded mid-run (hot reload of an edit?)'); } });
  const dev = async () => {
    await page.goto(`${base}/?dev=1${track === 'tokyo' ? '&track=tokyo' : ''}${query ? '&' + query : ''}`);
    await page.waitForFunction(() => window.viewer && !document.getElementById('loading') && performance.getEntriesByType('mark').some((m) => m.name === 'ultrack:venue-ready'), null, { timeout: 300000 });
  };
  let opened = mode;
  if (mode === 'game') {
    await ctx.addInitScript(([track, look, weather]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look, weather } })); } catch { /* none */ } }, [track, look, weather]);
    try {
      await page.goto(base + (query ? '/?' + query : ''));
      await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
      await page.keyboard.press('Enter');
      await page.waitForSelector('.bento-tile[data-id=free]', { state: 'visible' });
      await page.click('.bento-tile[data-id=free]');
      await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
      await page.click('.panel.setup button.cta');
      await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 150000 });
      await page.evaluate(() => { window.game.hud.show(false); });
    } catch (e) {   // say why, then measure the bare viewer instead (the whole 8-car grid)
      console.log('Free Drive did not start:', e.message.split(String.fromCharCode(10))[0], '| page errors:', errors.slice(0, 8), '| page text:', (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 300));
      opened = 'dev'; await dev();
    }
  } else await dev();
  await page.waitForTimeout(3000);
  ready = true;
  return { browser, page, errors, mode: opened };
}

/** page-side: a look at the given weather (the game's Dry / Damp / Rain wetness), then optional params */
export const setupLook = async ([look, weather, sets]) => {
  const v = window.viewer, W = { dry: [0.15, 0], damp: [0.7, 0.2], rain: [1, 0.75] }[weather];
  v.params.dynamicRes = false; v.params.renderScale = 1;
  for (const [k, val] of Object.entries(sets ?? {})) v.params[k] = val;
  if (sets && 'quality' in sets) v.applyQuality();   // a tier applies its own scale, shadows, AO, mirror
  v.resize();
  v.params.wet = W[0]; v.params.rain = W[1];
  v.params.look = look; await v.setLook(look); v.applyAll();
};

/** page-side: put the hero at centreline point c0 facing c1; hold keeps it there (the chase camera follows it) */
export const teleport = ([c0, c1, hold]) => {
  const v = window.viewer, f = v.field(), h = f.hero, T = v.THREE;
  f.setPlayer?.(false); v.params.player = false; f.hold = hold; v.params.mode = 'chase'; v.applyAll();
  const a = new T.Vector3(c0[0], c0[1], c0[2]), b = new T.Vector3(c1[0], c1[1], c1[2]);
  h.vehicle.respawn(a, Math.atan2(-(b.z - a.z), b.x - a.x));
  f.rig?.cut();
};

export async function retry(page, fn, arg) {
  for (let n = 0; ; n++) { try { return await page.evaluate(fn, arg); } catch (e) { if (n > 3) throw e; console.log('retrying:', e.message.slice(0, 80)); await page.waitForTimeout(2000); } }
}

/** page-side: render the frame with the named savings off (A), again (noise floor), then as shipped (B, twice); returns the differences and, if asked, the raw RGBA */
export const shoot = ([offList, wantImages]) => {
  const v = window.viewer, gl = v.renderer.getContext(), f = v.field(), perf = v.perf, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const realNow = performance.now.bind(performance), T0 = realNow();
  performance.now = () => T0;                                   // one instant for every render
  const upd = f.update; f.update = () => {};                    // cars keep their LOD and reflection capture
  const grain = v.params.grain; v.params.grain = 0; v.params.speedBlur = 0; v.applyAll();
  const defaults = { ...perf };
  const snapshot = () => { v.renderNow(); const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const list = offList === 'all' ? Object.keys(defaults) : offList;
  const setOff = (on) => { for (const k of Object.keys(defaults)) perf[k] = list.includes(k) ? !on : defaults[k]; v.applyAll(); };
  const out = {};
  try {
    snapshot();                                                 // settle any lazily built state
    setOff(false); const A = snapshot(), A2 = snapshot();
    setOff(true); const B = snapshot(), B2 = snapshot();
    const info = v.renderer.info.render;
    const diff = (X, Y) => {
      let sum = 0, big = 0, huge = 0, max = 0; const n = w * h;
      const heat = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const o = i * 4, d0 = Math.abs(X[o] - Y[o]), d1 = Math.abs(X[o + 1] - Y[o + 1]), d2 = Math.abs(X[o + 2] - Y[o + 2]), m = Math.max(d0, d1, d2);
        sum += d0 + d1 + d2; if (m > 8) big++; if (m > 32) huge++; if (m > max) max = m; heat[i] = Math.min(255, m * 8);
      }
      return { mad: sum / (n * 3), over8: big / n * 100, over32: huge / n * 100, max, heat };
    };
    const noise = diff(A, A2), ab = diff(A, B), bb = diff(B, B2);
    out.noise = { mad: noise.mad, over8: noise.over8, max: noise.max }; out.ab = { mad: ab.mad, over8: ab.over8, over32: ab.over32, max: ab.max }; out.bnoise = { mad: bb.mad, max: bb.max };
    const enc = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
    out.w = w; out.h = h;
    if (wantImages) { out.A = enc(A); out.B = enc(B); out.heat = enc(ab.heat); }
  } finally {
    Object.assign(perf, defaults); f.update = upd; performance.now = realNow; v.params.grain = grain; v.params.speedBlur = 1; v.applyAll();
  }
  return out;
};


/** page-side: wraps the composer's passes, the mirror, the shadow maps and the car update so every section of a frame gets a GPU timer query, CPU time, draws and triangles */
export const installProbe = () => {
  const v = window.viewer, renderer = v.renderer, gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), info = renderer.info;
  const S = { on: false, mine: false, cur: null, stack: [], q: null, t0: 0, c0: 0, r0: 0, rows: [], frames: [], tick: [] };
  window.__S = S;
  const P = WebGL2RenderingContext.prototype;
  if (!P.__bq) {
    P.__bq = P.beginQuery; P.__eq = P.endQuery;
    P.beginQuery = function (t, q) { return S.on && !S.mine ? undefined : P.__bq.call(this, t, q); };   // the app's own GpuTimer stands aside while we measure
    P.endQuery = function (t) { return S.on && !S.mine ? undefined : P.__eq.call(this, t); };
  }
  const open = (name) => { S.cur = name; S.mine = true; S.q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, S.q); S.mine = false; S.t0 = performance.now(); S.c0 = info.render.calls; S.r0 = info.render.triangles; };
  const close = () => {
    if (!S.cur) return;
    S.mine = true; gl.endQuery(ext.TIME_ELAPSED_EXT); S.mine = false;
    S.rows.push({ name: S.cur, q: S.q, cpu: performance.now() - S.t0, calls: info.render.calls - S.c0, tris: info.render.triangles - S.r0 });
    S.cur = null; S.q = null;
  };
  const enter = (name) => { S.stack.push(S.cur); close(); open(name); };
  const leave = () => { close(); const prev = S.stack.pop(); if (prev) open(prev); };
  const wrap = (obj, key, nameOf) => {
    const orig = obj[key];
    obj[key] = function (...a) {
      if (!S.on) return orig.apply(this, a);
      const name = nameOf.call(this, a);
      if (!name) return orig.apply(this, a);
      enter(name);
      try { return orig.apply(this, a); } finally { leave(); }
    };
  };
  const PASS = { RenderPass: 'main', GTAOPass: 'gtao', UnrealBloomPass: 'bloom', OutputPass: 'output', ShaderPass: 'grade', SMAAPass: 'smaa' };
  v.composer.passes.forEach((p) => wrap(p, 'render', () => PASS[p.constructor.name] ?? p.constructor.name));
  const lights = v.scene.children.filter((c) => c.isLight && c.shadow);
  wrap(renderer.shadowMap, 'render', () => {
    const due = lights.filter((l) => l.castShadow && l.visible && l.intensity > 0 && (l.shadow.autoUpdate || l.shadow.needsUpdate));
    if (!due.length || !renderer.shadowMap.enabled) return null;
    return 'shadow ' + due.map((l) => (l.isDirectionalLight ? 'sun' : l.shadow.mapSize.x === 512 ? 'head' : 'lamp')).join('+') + (S.cur === 'mirror' ? ' @mirror' : S.cur?.startsWith('gtao') ? ' @gtao' : '');
  });
  wrap(renderer, 'render', function (a) { return a[0] === v.scene && S.cur === 'gtao' ? 'gtao normals' : null; });
  const refl = v.scene.children.find((c) => c.type === 'Reflector');
  if (refl) wrap(refl, 'onBeforeRender', () => 'mirror');
  const f = v.field();
  if (f) wrap(f, 'update', () => 'cars+cube');

  // draw census: which objects each pass draws (name with digits folded), their draws and triangles
  S.cen = false; S.census = new Map();
  const rbd = renderer.renderBufferDirect.bind(renderer);
  renderer.renderBufferDirect = function (camera, scn, geometry, material, object, group) {
    if (!S.cen) return rbd(camera, scn, geometry, material, object, group);
    const t0 = info.render.triangles, c0 = info.render.calls;
    rbd(camera, scn, geometry, material, object, group);
    let nm = object.name || ''; if (!nm || /_\d+$/.test(nm)) nm = object.parent?.name || nm;
    const key = (S.cur ?? '?') + ' | ' + nm.replace(/\d+/g, '#') + (object.isInstancedMesh ? ' [inst]' : '') + (object.isSkinnedMesh ? ' [skin]' : '') + (object.isPoints ? ' [points]' : '') + (object.isSprite ? ' [sprite]' : '');
    const e = S.census.get(key) ?? { draws: 0, tris: 0, inst: 0, inv: 0 };
    e.inv++; e.draws += info.render.calls - c0; e.tris += info.render.triangles - t0; e.inst += object.isInstancedMesh ? object.count : 0;
    S.census.set(key, e);
  };
  S.dump = () => { const o = {}; for (const [k, e] of S.census) o[k] = e; return o; };
  const compose = v.composer.render.bind(v.composer);
  v.composer.render = function (...a) {
    if (!S.on) return compose(...a);
    S.stack = []; open('other');
    try { return compose(...a); } finally { close(); S.frames.push(S.rows); S.rows = []; }
  };
  S.start = () => { S.rows = []; S.frames = []; S.tick = []; S.on = true; };
  S.stop = async () => {
    S.on = false;
    const out = [];
    for (const rows of S.frames) {
      let bad = false;
      const res = [];
      for (const r of rows) {
        let tries = 0;
        while (!gl.getQueryParameter(r.q, gl.QUERY_RESULT_AVAILABLE) && tries++ < 400) await new Promise((x) => setTimeout(x, 5));
        res.push({ name: r.name, gpu: gl.getQueryParameter(r.q, gl.QUERY_RESULT) / 1e6, cpu: r.cpu, calls: r.calls, tris: r.tris });
        gl.deleteQuery(r.q);
      }
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) bad = true;
      if (!bad) out.push(res);
    }
    return { frames: out, tick: S.tick.slice() };
  };
  // the whole tick's JS time (physics, culling, render submit)
  if (!window.__rafWrapped) {
    window.__rafWrapped = true;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); cb(t); if (S.on) S.tick.push(performance.now() - s); });
  }
  return { ext: !!ext, device: v.device, quality: v.params.quality, size: [renderer.domElement.width, renderer.domElement.height] };
};


/** page-side: orbit camera around the hero car for a close-up ('front' | 'rear' | 'side' | 'chase' to go back to the game's chase camera) */
export const closeup = (kind) => {
  const v = window.viewer, h = v.field().hero, T = v.THREE;
  if (kind === 'chase') { v.params.mode = 'chase'; v.controls.enabled = false; v.applyAll(); return; }
  const p = h.root.position.clone(), f = new T.Vector3(1, 0, 0).applyQuaternion(h.root.quaternion).setY(0).normalize(), r = new T.Vector3(0, 1, 0).cross(f).normalize();
  const at = { front: f.clone().multiplyScalar(4.6), rear: f.clone().multiplyScalar(-4.8), side: r.clone().multiplyScalar(5.2) }[kind];
  v.params.mode = 'orbit';
  v.camera.position.copy(p).add(at).add(new T.Vector3(0, 1.15, 0));
  v.controls.target.copy(p).add(new T.Vector3(0, 0.55, 0));
  v.controls.enabled = true; v.controls.update(); v.camera.lookAt(v.controls.target); v.camera.updateMatrixWorld();
};
