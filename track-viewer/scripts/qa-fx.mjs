// Car effects capture (carkit/fx*.js) in the real game: the race's own track, looks, road, rain and lamps, with the cars moved
// by a script instead of the physics (the cars' racing line from their grid slots), so each effect fires the same way every
// run: every rendered frame is one fixed 1/60 s step for the script and the effects, Math.random is seeded per run.
//   node scripts/qa-lock.mjs -- node scripts/qa-fx.mjs <label> [--track marina] [--weather dry,rain] [--looks day,dusk,night] [--only burnout,drift]
//   node scripts/qa-lock.mjs -- node scripts/qa-fx.mjs <label> --fps        8 cars in a standing burnout at real time, effects off
//                    and on: render rate, composer ms per frame (GPU-synced) and the effects' CPU ms (qa/fx/<label>/fps.json)
//   node scripts/qa-fx.mjs --compare before after                           before over after per strip (no browser)
// Out: qa/fx/<label>/<weather>-<look>-<effect>.jpg (8-12 frames, 4 across, labelled with the effect time and the soft + flame
// particle counts) + frames/ (each frame, 960 px). The end-of-run line prints the frame's ambient probe, sun term and lamp light.
// Effects: burnout (all 8 cars on the grid, then the launch), wisp (light wheelspin), drift, lockup (front tyres on the brakes),
// pops (lift-off at speed, a frame every ~33 ms), nitro, spray (wet only: the pack at 160 km/h), tail (wet only: one car's
// rooster tail from the side); popsfine (every frame of the first pops) only with --only.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const TW = 640, TH = 360;

async function sheet(frames, labels, file) {     // 4 x 2 tiles with the effect time on each
  const tiles = await Promise.all(frames.map(async (b, i) => ({
    input: await sharp(b).resize(TW, TH).composite([{ input: Buffer.from(`<svg width="${TW}" height="${TH}"><rect x="6" y="6" width="${12 + 9 * labels[i].length}" height="24" fill="#000a"/><text x="12" y="24" font-family="Consolas,monospace" font-size="15" fill="#fff">${labels[i]}</text></svg>`) }]).jpeg({ quality: 88 }).toBuffer(),
    left: (i % 4) * TW, top: Math.floor(i / 4) * TH })));
  await sharp({ create: { width: 4 * TW, height: Math.ceil(frames.length / 4) * TH, channels: 3, background: '#111' } }).composite(tiles).jpeg({ quality: 88 }).toFile(file);
}

if (argv[0] === '--compare') {                   // before over after, one file per strip, a caption bar on each
  const [a, b] = argv.slice(1), out = join(root, 'qa', 'fx', 'compare');
  mkdirSync(out, { recursive: true });
  const bar = (t) => sharp(Buffer.from(`<svg width="${4 * TW}" height="34"><rect width="100%" height="100%" fill="#222"/><text x="12" y="24" font-family="Consolas,monospace" font-size="20" fill="#eee">${t}</text></svg>`)).png().toBuffer();
  for (const f of readdirSync(join(root, 'qa', 'fx', a)).filter((f) => f.endsWith('.jpg'))) {
    if (!existsSync(join(root, 'qa', 'fx', b, f))) continue;
    const [A, B] = [a, b].map((l) => join(root, 'qa', 'fx', l, f)), h = (await sharp(A).metadata()).height;
    await sharp({ create: { width: 4 * TW, height: 2 * h + 68, channels: 3, background: '#111' } })
      .composite([{ input: await bar(`${f.replace('.jpg', '')}  BEFORE (${a})`), top: 0, left: 0 }, { input: A, top: 34, left: 0 },
        { input: await bar(`AFTER (${b})`), top: 34 + h, left: 0 }, { input: B, top: 68 + h, left: 0 }]).jpeg({ quality: 86 }).toFile(join(out, f));
  }
  console.log('compare sheets in', out);
  process.exit(0);
}

const label = argv[0];
if (!label || label.startsWith('--')) { console.log('usage: node scripts/qa-fx.mjs <label> [--track t] [--weather dry,rain] [--looks day,dusk,night] [--only a,b] [--fps]'); process.exit(2); }
const track = opt('track', 'marina'), weathers = opt('weather', 'dry,rain').split(','), looks = opt('looks', 'day,dusk,night').split(','), only = opt('only', '')?.split(',').filter(Boolean);
const FPS = argv.includes('--fps'), base = 'http://127.0.0.1:5180', out = join(root, 'qa', 'fx', label);
mkdirSync(join(out, 'frames'), { recursive: true });

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(([track, look, weather]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look, weather, laps: 1 } })); } catch { /* none */ } }, [track, looks[0], weathers[0]]);
// Vite's HMR socket stubbed: another agent saving a file would otherwise reload the page mid-capture
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(base);
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.waitForSelector('.bento-tile[data-id=race]', { state: 'visible' });
await page.click('.bento-tile[data-id=race]');
await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.session.field.curve, null, { timeout: 300000 });

// the harness: scripted cars, a fixed step, fixed cameras, a frame grabber after each render
await page.evaluate(() => {
  const V = window.viewer, S = window.game.session, F = S.field, T = V.THREE, P = V.params, FIX = 1 / 60;
  S.goAt = 1e9; P.dynamicRes = false;                     // the grid holds; the frame size stays put
  const up = new T.Vector3(0, 1, 0), curve = F.curve, L = F.length, N = 4000, pts = Array.from({ length: N }, (_, i) => curve.getPointAt(i / N));
  const frameAt = (u) => { const p = curve.getPointAt(((u % 1) + 1) % 1), t = curve.getTangentAt(((u % 1) + 1) % 1); t.y = 0; t.normalize(); return { p, t, l: new T.Vector3().crossVectors(up, t) }; };
  const home = F.cars.map((c) => {
    const pos = c.root.position.clone(); let bi = 0, bd = Infinity;
    pts.forEach((q, i) => { const d = q.distanceToSquared(pos); if (d < bd) { bd = d; bi = i; } });
    const u0 = bi / N, f = frameAt(u0);
    return { c, pos, quat: c.root.quaternion.clone(), u0, lat: pos.clone().sub(f.p).dot(f.l), dy: pos.y - f.p.y };
  });
  const R0 = Math.random;
  const seeded = (s) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // effects: per car a state of the script at time t (s): a (m/s2), throttle, brake, slip (rear), lock (front), spin (extra wheel m/s), beta (rad), pop, nitro
  const SC = {
    burnout: { cars: 'all', v0: 0, view: 'chase', shots: [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2],
      f: (t) => t < 1.6 ? { a: 0, throttle: 1, slip: 1, spin: 14 } : { a: 7, throttle: 1, slip: 0.9 * Math.max(0, 1 - (t - 1.6) / 1.2), spin: 10 * Math.max(0, 1 - (t - 1.6) / 1.2) } },
    wisp: { cars: 'hero', v0: 0, view: 'close', shots: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
      f: (t) => ({ a: 7, throttle: 1, slip: 0.25 * (1 - ss(0.7, 1.5, t)), spin: 3 * (1 - ss(0.7, 1.5, t)) }) },
    drift: { cars: 'hero', v0: 16, view: 'rear34', shots: [0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7],
      f: (t, s) => ({ a: 0, throttle: 0.9, beta: 0.5 * (1 - Math.exp(-t / 0.4)), slip: ss(0.1, 0.4, s.beta), aLat: 9 }) },
    lockup: { cars: 'hero', v0: 30, view: 'front34', shots: [0.3, 0.55, 0.8, 1.05, 1.3, 1.55, 1.8, 2.05],
      f: (t) => ({ a: -9, throttle: 0, brake: 1, lock: ss(0.1, 0.25, t) * (1 - ss(1.4, 1.6, t)) }) },
    pops: { cars: 'hero', v0: 26, view: 'rearClose', shots: [1.22, 1.25, 1.28, 1.32, 1.35, 1.38, 1.42, 1.45, 1.48, 1.52, 1.55, 1.6],
      f: (t) => t < 1.2 ? { a: 6, throttle: 1 } : { a: -2, throttle: 0, pop: t - FIX < 1.2 + 1e-6 } },
    popsfine: { cars: 'hero', v0: 26, view: 'rearClose', shots: Array.from({ length: 12 }, (_, i) => +(1.2 + (i + 1) / 60).toFixed(4)),   // every frame of the first pops
      f: (t) => t < 1.2 ? { a: 6, throttle: 1 } : { a: -2, throttle: 0, pop: t - FIX < 1.2 + 1e-6 } },
    nitro: { cars: 'hero', v0: 30, view: 'rear34', shots: [0.15, 0.4, 0.7, 1.0, 1.4, 1.8, 2.2, 2.5],
      f: (t) => ({ a: 7, throttle: 1, nitro: t < 2.1 }) },
    spray: { cars: 'all', v0: 44, view: 'chase', wet: true, shots: [0.8, 1.05, 1.3, 1.55, 1.8, 2.05, 2.3, 2.55],
      f: () => ({ a: 0, throttle: 0.8 }) },
    tail: { cars: 'hero', v0: 44, view: 'rear34', wet: true, shots: [0.8, 1.05, 1.3, 1.55, 1.8, 2.05, 2.3, 2.55],
      f: () => ({ a: 0, throttle: 0.8 }) },
  };
  // cameras in the travel frame (f along the line, l to its left): [back/fwd, left, up], aim [fwd, up], fov
  const VIEW = { chase: [[-6, 0, 1.85], [3, 0.9], 62], close: [[-4.2, 0, 1.3], [2.2, 0.8], 62], rear34: [[-4.6, -2.2, 0.55], [0, 0.5], 42],
    rearClose: [[-5.2, 0.5, 1.0], [0, 0.5], 42], front34: [[5.2, 3.2, 1.25], [0, 0.5], 42] };
  let run = null;
  const pose = (h, st) => {
    const fr = frameAt(h.u0 + st.s / L), c = h.c;
    c.root.position.copy(fr.p).addScaledVector(fr.l, h.lat); c.root.position.y += h.dy;
    c.root.rotation.set(0, Math.atan2(fr.t.z, -fr.t.x) - Math.PI + (st.beta ?? 0), 0);
    c.root.updateMatrixWorld(true);
    return fr;
  };
  F.drive = () => {
    if (!run) return;
    const t = (run.k + 1) * FIX;
    for (const st of run.cars) {
      const c = st.h.c, q = run.sc.f(t, st);
      st.beta = q.beta ?? 0; st.v = Math.max(0, st.v + (q.a ?? 0) * FIX); st.s += st.v * FIX;
      st.fr = pose(st.h, st);
      c.speed = st.v; c.brake = q.brake ?? 0; c.yaw = c.root.rotation.y;
      if (c.vehicle) { c.vehicle.onGround = 4; c.vehicle.controls.handbrake = 0; c.vehicle.state.absActive = 0; }     // the physics is not stepping: on its wheels, no stale aids
      for (const w of c.wheels) w.spin.rotation.z += Math.tanh(((st.v + (q.spin ?? 0)) / w.spec.radius) * FIX / 0.3) * 0.3;
      F.dynamics(c, FIX, q.a ?? 0, q.aLat ?? 0, { throttle: q.throttle ?? 0, slip: q.slip ?? 0, lock: q.lock ?? 0, pop: !!q.pop, nitro: !!q.nitro });
    }
    run.k++;
    run.max = Math.max(run.max, F.fx.counts.smoke + F.fx.counts.fire);
  };
  F.chase = (cam) => {
    const st = run?.cars.find((s) => s.h.c === F.hero) ?? { h: home.find((h) => h.c === F.hero), s: 0 }, fr = st.fr ?? frameAt(st.h.u0);
    const [o, a, fov] = VIEW[run?.sc.view ?? 'chase'], p = F.hero.root.position;
    cam.position.copy(p).addScaledVector(fr.t, o[0]).addScaledVector(fr.l, o[1]).addScaledVector(up, o[2]);
    cam.lookAt(p.clone().addScaledVector(fr.t, a[0]).addScaledVector(up, a[1]));
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  };
  const fxUpdate = F.fx.update.bind(F.fx);
  F.fx.update = (dt, light, look) => fxUpdate(dt > 0 && window.__fixed ? FIX : dt, light, look);
  window.__fixed = true;
  const clear = () => {
    const fx = F.fx;
    if (fx.clear) fx.clear();
    else {
      const seen = new Set(), walk = (o, d) => { if (!o || typeof o !== 'object' || seen.has(o) || d > 3) return; seen.add(o);
        if (typeof o.n === 'number' && typeof o.max === 'number' && typeof o.step === 'function') { o.n = 0; if (o.mesh) o.mesh.geometry.instanceCount = 0; }
        for (const k of Object.keys(o)) if (!['scene', 'sun', 'light', 'glowAt'].includes(k)) walk(o[k], d + 1); };
      walk(fx, 0);
      fx.nitroFx?.R?.forEach((r) => { r.n = 0; r.live = false; });
      fx.flash = fx.lit = 0;
    }
    for (const h of home) { h.c.root.position.copy(h.pos); h.c.root.quaternion.copy(h.quat); h.c.speed = 0; h.c.brake = 1; h.c._fx = undefined; h.c._fxPrev = undefined; for (const w of h.c.wheels) { w._sacc = w._spray = w._mist = undefined; } }
  };
  // what the effects saw at the end of a run: soft particles by kind, the frame's ambient (upper, lower half), the sun term
  const stats = () => { const fx = F.fx, so = fx.soft, o = { n: so?.n, kinds: so ? [0, 1, 2].map((k) => so.count(k)) : null };
    if (fx.pass) { const b = new Uint16Array(4); V.renderer.readRenderTargetPixels(fx.pass.amb, 0, 0, 1, 1, b); o.amb = [...b].map((h) => +T.DataUtils.fromHalfFloat(h).toFixed(3)); }
    if (so) { const c = so.mat.uniforms.uSunC.value; o.sun = [c.r, c.g, c.b].map((x) => +x.toFixed(3)); const l = so.mat.uniforms.uLocal?.value; if (l) o.local = [l.r, l.g, l.b].map((x) => +x.toFixed(3)); }
    o.pipes = F.hero.exhausts?.map((e) => { const p = e.getWorldPosition(new T.Vector3()).project(V.camera); return [+(p.x * 480 + 480).toFixed(0), +(270 - p.y * 270).toFixed(0)]; });      // the hero's pipes in the 960 x 540 frame
    return o; };
  // the grabber: after the frame that rendered step k, if k is a shot
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 540; const g = cv.getContext('2d');
  let lastK = -1;
  const grab = () => {
    requestAnimationFrame(grab);
    if (!run || run.k === lastK) return; lastK = run.k;
    if (run.want.has(run.k)) { g.drawImage(V.renderer.domElement, 0, 0, 960, 540); run.shots.push(cv.toDataURL('image/jpeg', 0.92)); const c = F.fx.counts; run.n.push(`${c.smoke}+${c.fire}`); }     // particles in the shot: soft + flames
    if (run.k >= run.end) { const r = run; run = null; Math.random = R0; const info = stats(); clear(); r.done({ shots: r.shots, max: r.max, times: r.sc.shots, info, n: r.n }); }
  };
  requestAnimationFrame(grab);
  const frames = (n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  window.__fx = {
    async setLook(look, wet) {
      P.look = look; await V.setLook(look);
      const cap = { low: 0.25, medium: 0.4, high: 0.45, ultra: 0.5 }[P.quality === 'auto' ? V.device.tier : P.quality] ?? 0.45;
      P.wet = wet ? 1 : 0.15; P.rain = wet ? Math.min(0.75, cap) : 0; F.fx.damp = P.wet; V.applyAll();
      clear(); await frames(90);                         // shaders built, the look settled
    },
    run(name) {
      const sc = SC[name];
      return new Promise((done) => {
        clear(); Math.random = seeded(7);
        const cars = (sc.cars === 'all' ? home : home.filter((h) => h.c === F.hero)).map((h) => ({ h, s: sc.cars === 'all' ? 0 : 130, v: sc.v0, beta: 0 }));     // alone: 130 m up the road, clear of the grid
        const want = new Set(sc.shots.map((t) => Math.round(t / FIX)));
        run = { sc, cars, k: 0, want, end: Math.max(...want), shots: [], n: [], max: 0, done };
      });
    },
    // the 8-car standing burnout at real time: the app's render rate, and per frame the composer's render forced to finish on the GPU
    // (a 1-pixel readback, so GPU time counts) and the effects' CPU time (the cars' emitters + the pools' update, sort and upload)
    async fps(on, seconds = 8) {
      window.__fixed = false; clear(); P.fpsCap = 1000;
      const cars = home.map((h) => ({ h, s: 0, v: 0, beta: 0 })), sc = { view: 'chase', f: () => ({ a: 0, throttle: 1, slip: on ? 1 : 0, spin: on ? 14 : 0 }) };
      run = { sc, cars, k: 0, want: new Set(), end: 1e9, shots: [], max: 0, done: () => {} };
      await frames(120);
      const gl = V.renderer.getContext(), px = new Uint8Array(4), R = [], X = [], C = V.composer, cr = C.render, dr = F.drive, fu = F.fx.update;
      let fxT = 0;
      C.render = (...a) => { const t = performance.now(); cr.apply(C, a); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); R.push(performance.now() - t); X.push(fxT); fxT = 0; };
      F.drive = (...a) => { const t = performance.now(); dr(...a); fxT += performance.now() - t; };
      F.fx.update = (...a) => { const t = performance.now(); fu(...a); fxT += performance.now() - t; };
      const t0 = performance.now(), k0 = run.k;
      await new Promise((res) => setTimeout(res, seconds * 1000));
      C.render = cr; F.drive = dr; F.fx.update = fu;
      const n = run.k - k0, ms = performance.now() - t0, counts = F.fx.counts;
      run = null; clear(); window.__fixed = true; P.fpsCap = 60;
      const st = (d) => { d.sort((x, y) => x - y); return { median: +d[d.length >> 1].toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2) }; };
      return { on, renders: n, fps: +(n / ms * 1000).toFixed(1), renderMs: st(R), fxMs: st(X), counts };
    },
  };
});

const all = ['burnout', 'wisp', 'drift', 'lockup', 'pops', 'nitro', 'spray', 'tail'];
if (FPS) {
  const res = [];
  await page.evaluate((l) => window.__fx.setLook(l, false), looks[0]);
  for (const on of [false, true, false, true]) { const r = await page.evaluate((o) => window.__fx.fps(o), on); console.log(JSON.stringify(r)); res.push(r); }
  writeFileSync(join(out, 'fps.json'), JSON.stringify({ track, look: looks[0], res, errors: [...new Set(errors)] }, null, 1));
} else {
  for (const weather of weathers) for (const look of looks) {
    await page.evaluate(([l, w]) => window.__fx.setLook(l, w), [look, weather !== 'dry']);
    for (const fx of only?.length ? only : all) {      // popsfine (every frame of the first pops) only when asked for
      if (['spray', 'tail'].includes(fx) && weather === 'dry') continue;
      if (weather !== 'dry' && ['wisp', 'lockup'].includes(fx)) continue;
      const r = await page.evaluate((n) => window.__fx.run(n), fx), name = `${weather}-${look}-${fx}`;
      const bufs = r.shots.map((d) => Buffer.from(d.split(',')[1], 'base64'));
      bufs.forEach((b, i) => writeFileSync(join(out, 'frames', `${name}-${i}.jpg`), b));
      await sheet(bufs, r.times.map((t, i) => `${fx} ${weather} ${look} t=${t.toFixed(2)}s  n ${r.n[i]}`), join(out, `${name}.jpg`));
      console.log(`${name}: ${bufs.length} frames, max particles ${r.max}`, JSON.stringify(r.info));
    }
  }
}
await browser.close();
if (errors.length) console.log('console errors:', [...new Set(errors)].slice(0, 10));
