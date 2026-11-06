// Race frame time by section (docs/10x/perf-spec.md, WP0 a): a real Race with 8 cars, the AI driving the hero, chase camera, day look, dry,
// 1600x900 at DPR 1, dynamic resolution off. Each rendered frame is split into its big sections (performance.now around the calls), in blocks
// of --frames rendered frames, --rounds times; per arm it prints the median of the per-round values and their spread (max - min).
// A win counts only when the difference of the arm medians exceeds the larger arm's spread (the same bench moves ~2.5 ms between runs).
//   node scripts/qa-lock.mjs -- node scripts/perf-frame.mjs <track> [--look day] [--frames 720] [--rounds 4] [--ab <flag>] [--ab-load <flag>]
//        [--programs] [--url http://127.0.0.1:5180] [--out qa/perf/frame-<track>.json]
//   --ab <flag>       runtime saving: one page, blocks with viewer.perf[flag] = false (A) then true (B), A B A B ...
//   --ab-load <flag>  load-time saving: a fresh browser per block on one shared profile, A = /?perf=<flag> (saving off), B = /, A B A B ...
//   --programs        the shader programs that exist when the menu warm-up (game.preloadP) is done, and again after the blocks and 10 s more
//                     racing with a nitro and a wall hit: lists the programs created after the warm-up, counts the program info-log reads
//                     after it (a program's first use), and exits 1 if there are any of either
//   --quit            instead of the frame blocks, WP5's quit+3 s phase per round: pause -> Quit to menu -> Quit, then the longest task in
//                     the next 3 s and how long the menu's collision-world rebuild (game.js endSession, 1.5 s in) took, then back to a race.
//                     A drops the memoised void walls first (the build before WP5), B keeps them: A B A B ...
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { args as parseArgs, setupLook, root } from './perf-open.mjs';

const { flag, pos, has } = parseArgs(process.argv.slice(2));
const track = pos[0] ?? 'qingshan', look = flag('look', 'day'), FRAMES = +flag('frames', 720), ROUNDS = +flag('rounds', 4);
const ab = flag('ab', null), abLoad = flag('ab-load', null), base = flag('url', 'http://127.0.0.1:5180'), W = 1600, H = 900;
const out = flag('out', `qa/perf/frame-${track}${ab ? '-ab-' + ab : abLoad ? '-abload-' + abLoad : has('quit') ? '-quit' : ''}.json`);
const CHROME = { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] };
const log = (...a) => console.log(`[${track}]`, ...a), errors = [];
const profile = join(tmpdir(), 'ultrack-perf-frame-profile');
if (abLoad) rmSync(profile, { recursive: true, force: true });

/** a browser at the race: menu warm-up done (its programs recorded), Race started, the AI drives the hero in the chase view */
async function open(query = '') {
  const browser = abLoad ? null : await chromium.launch(CHROME);
  const ctx = abLoad ? await chromium.launchPersistentContext(profile, { ...CHROME, viewport: { width: W, height: H }, deviceScaleFactor: 1 })
    : await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  ctx.done = () => (browser ?? ctx).close();
  await ctx.addInitScript(() => { const Wk = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new Wk(u, p); }; F.prototype = Wk.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
  await ctx.addInitScript(([track, look]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look, weather: 'dry', laps: 10 } })); } catch { /* none */ } }, [track, look]);
  const page = ctx.pages()[0] ?? await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(base + (query ? '/?' + query : '/'));
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 240000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.preloadP, null, { timeout: 60000 });
  await page.evaluate(() => window.game.preloadP);
  const warm = await page.evaluate(() => window.viewer.renderer.info.programs.map((p) => [p.cacheKey, p.name]));
  // a program's first draw reads its info log (three's onFirstUse): one read after the warm-up is a program the menu built but never readied
  await page.evaluate(() => { const gl = window.viewer.renderer.getContext(), read = gl.getProgramInfoLog; window.__infoLogs = 0; gl.getProgramInfoLog = function (...a) { window.__infoLogs++; return read.apply(this, a); }; });
  await page.click('.bento-tile[data-id=race]');
  await page.click('.panel.setup button.cta');
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 240000 });
  await page.waitForTimeout(3000);
  await page.evaluate(setupLook, [look, 'dry', {}]);
  await page.evaluate(() => { const v = window.viewer, f = v.field(); f.setPlayer?.(false); v.params.player = false; f.hold = false; v.params.mode = 'chase'; v.applyAll(); });
  await page.waitForTimeout(8000);   // the start: lights, go, the field spreads
  await page.evaluate(install);
  return { ctx, page, warm };
}

/** page-side: section timers around the tick's calls, one record per rendered frame while __R.on */
function install() {
  const v = window.viewer, f = v.field(), g = window.game, T = v.THREE, info = v.renderer.info.render, R = { frames: [], cur: null, on: false };
  window.__R = R;
  const wrap = (obj, key, name, around) => { const o = obj[key]; obj[key] = function (...a) { const c = R.cur; if (!c) return o.apply(this, a); const s = performance.now(), k0 = info.calls, x = around?.(c); try { return o.apply(this, a); } finally { c[name] = (c[name] ?? 0) + performance.now() - s; around?.(c, k0, x); } }; };
  wrap(g, 'update', 'game');
  wrap(f, 'drive', 'field.drive');
  wrap(f, 'chase', 'chase');
  wrap(f, 'update', 'field.update');
  wrap(T.PMREMGenerator.prototype, 'fromCubemap', 'pmrem');
  wrap(v.scene, 'updateMatrixWorld', 'scene.updateMatrixWorld');
  wrap(v.composer, 'render', 'composer.render');
  wrap(v.renderer.shadowMap, 'render', 'shadowMap', (c, k0) => { if (k0 !== undefined) c.shadowDraws = (c.shadowDraws ?? 0) + info.calls - k0; });
  // the main pass's own draws: the RenderPass minus the shadow maps it refreshes inside it
  const main = v.composer.passes.find((p) => p.constructor.name === 'RenderPass');
  if (main) wrap(main, 'render', 'mainPass', (c, k0, s0) => (k0 === undefined ? c.shadowDraws ?? 0 : void (c.mainDraws = (c.mainDraws ?? 0) + info.calls - k0 - ((c.shadowDraws ?? 0) - s0))));
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { const c = R.on ? {} : null; R.cur = c; const s = performance.now(); cb(t); R.cur = null; if (c && c['composer.render'] !== undefined) { c.tick = performance.now() - s; c.t = s; c.draws = info.calls; R.frames.push(c); } });
}

/** page-side: draws each car would submit now (visible meshes under visible parents), by LOD band, and the program count */
function census() {
  const v = window.viewer, f = v.field(), vis = (o, top) => { for (let p = o; p && p !== top.parent; p = p.parent) if (!p.visible) return false; return true; };
  const bands = {};
  let hero = 0;
  for (const c of f.cars) {
    let draws = 0; c.root.traverse((o) => { if ((o.isMesh || o.isPoints) && vis(o, c.root)) draws += [].concat(o.material).length; });
    if (c === f.hero) { hero = draws; continue; }
    const b = bands[c.band] ??= { cars: 0, draws: 0 }; b.cars++; b.draws += draws;
  }
  for (const b of Object.values(bands)) b.perCar = +(b.draws / b.cars).toFixed(1);
  return { bands, heroDraws: hero, programs: v.renderer.info.programs.length, session: !!window.game.session };
}

const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length), pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0; };
const r2 = (x) => +x.toFixed(2);
const med = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// a LOD band with no cars in a round is absent from it: that round has 0 cars there but no draws-per-car value, so it is skipped, not read as 0
function stats(rounds) {
  const keys = [...new Set(rounds.flatMap(Object.keys))], vals = (k) => rounds.map((r) => r[k] ?? (k.endsWith('.cars') ? 0 : undefined)).filter((x) => x !== undefined);
  return { median: Object.fromEntries(keys.map((k) => [k, r2(med(vals(k)))])), spread: Object.fromEntries(keys.map((k) => [k, r2(Math.max(...vals(k)) - Math.min(...vals(k)))])), n: Object.fromEntries(keys.map((k) => [k, vals(k).length])) };
}
// a key seen in fewer than 2 rounds of either arm has no spread to judge against
const verdict = (A, B) => Object.fromEntries([...new Set([...Object.keys(A.median), ...Object.keys(B.median)])].map((k) => { const few = Math.min(A.n[k] ?? 0, B.n[k] ?? 0) < 2, d = k in A.median && k in B.median ? r2(B.median[k] - A.median[k]) : null, sp = Math.max(A.spread[k] ?? 0, B.spread[k] ?? 0); return [k, { d, spread: sp, beyond: !few && Math.abs(d) > sp, few }]; }));
{ // self-check: the reviewer's case, band2 missing from one round
  const s = stats([{ 'band2.drawsPerCar': 39, 'band2.cars': 2 }, { x: 1 }]), s3 = stats([{ a: 35.5 }, { a: 41 }, {}, { a: 30.5 }]);
  const v = verdict({ median: { a: 1, b: 1 }, spread: { a: 0, b: 0 }, n: { a: 1, b: 3 } }, { median: { a: 5, b: 5 }, spread: { a: 0, b: 0 }, n: { a: 3, b: 3 } });
  if (s.median['band2.drawsPerCar'] !== 39 || s.spread['band2.drawsPerCar'] !== 0 || s.n['band2.drawsPerCar'] !== 1 || s.median['band2.cars'] !== 1 || s.spread['band2.cars'] !== 2
    || s3.median.a !== 35.5 || s3.spread.a !== 10.5 || v.a.beyond || !v.a.few || !v.b.beyond || verdict({ median: { a: 1 }, spread: { a: 0 }, n: { a: 2 } }, { median: {}, spread: {}, n: {} }).a.d !== null) throw Error('perf-frame stats self-check failed');
}
async function block(page) {
  await page.evaluate(() => { window.__R.frames = []; window.__R.on = true; });
  await page.waitForFunction((n) => window.__R.frames.length >= n, FRAMES, { timeout: FRAMES / 20 * 1000 + 60000, polling: 250 });
  const frames = await page.evaluate(() => { window.__R.on = false; return window.__R.frames; });
  const c = await page.evaluate(census);
  if (!c.session) throw Error('the race session ended during the block');
  const col = (k) => frames.map((f) => f[k] ?? 0), iv = frames.slice(1).map((f, i) => f.t - frames[i].t);
  return {
    frames: frames.length, 'tick.avg': r2(avg(col('tick'))), 'tick.p95': r2(pct(col('tick'), 0.95)), 'tick.p99': r2(pct(col('tick'), 0.99)), 'tick.max': r2(Math.max(...col('tick'))),
    'composer.avg': r2(avg(col('composer.render'))), 'composer.p95': r2(pct(col('composer.render'), 0.95)),
    'field.update.avg': r2(avg(col('field.update'))), 'field.update.p95': r2(pct(col('field.update'), 0.95)),
    'field.drive.avg': r2(avg(col('field.drive'))), 'matrixWorld.avg': r2(avg(col('scene.updateMatrixWorld'))),
    over20: iv.filter((x) => x > 20).length, 'mainDraws.avg': r2(avg(col('mainDraws'))), 'draws.avg': r2(avg(col('draws'))),
    programs: c.programs, heroDraws: c.heroDraws, ...Object.fromEntries(Object.entries(c.bands).map(([b, x]) => [`band${b}.drawsPerCar`, x.perCar])),
    ...Object.fromEntries(Object.entries(c.bands).map(([b, x]) => [`band${b}.cars`, x.cars])),
  };
}

/** page-side: 10 s of racing with a nitro burst (the player's own input) and a hit into the nearest wall at 100 km/h */
async function provoke(page) {
  await page.evaluate(() => { window.viewer.field().setPlayer(true); });
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  const nitro = await page.evaluate(() => new Promise((r) => { let on = false; const t0 = performance.now(); const poll = () => { on ||= !!window.viewer.field().hero.vehicle?.state.nitroOn; if (performance.now() - t0 > 2000) r(on); else setTimeout(poll, 50); }; poll(); }));
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  await page.evaluate(() => { window.viewer.field().setPlayer(false); });
  const wall = await page.evaluate(async () => {
    const { initPhysics } = await import('/src/physics/world.js'), R = await initPhysics(), f = window.viewer.field(), h = f.hero, pw = f.pw, V3 = h.root.position.constructor;
    const p = h.vehicle.rb.translation(), vel = h.vehicle.rb.linvel(), l = Math.hypot(vel.x, vel.z) || 1, ux = vel.x / l, uz = vel.z / l, isWall = (c) => pw.surfaceOf.get(c.handle)?.name === 'wall';
    for (const sd of [1, -1]) {
      const lx = uz * sd, lz = -ux * sd, hit = pw.world.castRay(new R.Ray({ x: p.x, y: p.y + 0.5, z: p.z }, { x: lx, y: 0, z: lz }), 40, true, undefined, undefined, undefined, undefined, isWall);
      if (!hit || hit.timeOfImpact < 3) continue;
      const lat = hit.timeOfImpact - 3, a = 30 * Math.PI / 180, dx = ux * Math.cos(a) + lx * Math.sin(a), dz = uz * Math.cos(a) + lz * Math.sin(a);
      h.vehicle.respawn(new V3(p.x + lx * lat, p.y + 0.25, p.z + lz * lat), Math.atan2(-dz, dx));
      h.vehicle.rb.setLinvel({ x: dx * 100 / 3.6, y: 0, z: dz * 100 / 3.6 }, true);
      f.rig?.cut();
      return +hit.timeOfImpact.toFixed(1);
    }
    return null;
  });
  await page.waitForTimeout(8000);
  return { nitro, wall };
}

/** quit+3 s: `fresh` empties PhysicsWorld.walls first, so A rebuilds the void walls as every rebuild did before the memo */
async function quitPhase(page, fresh) {
  await page.evaluate((fresh) => {
    const g = window.game;
    if (fresh) g.pw.constructor.walls?.clear();   // the game's own class: a dynamic import here can be a second instance of the module
    window.__Q?.obs.disconnect();
    const Q = window.__Q = { long: [], world: null, obs: new PerformanceObserver((l) => { for (const e of l.getEntries()) Q.long.push([e.startTime, e.duration]); }) };
    Q.obs.observe({ type: 'longtask' });
    const prep = g.prepareWorld;   // the one rebuild after this quit: timed from the call to the world being ready (one task, its microtasks included)
    g.prepareWorld = function () { g.prepareWorld = prep; const had = this.worldP, t0 = performance.now(); prep.call(this); if (!had && this.worldP) this.worldP.then(() => { Q.world = performance.now() - t0; }, () => {}); };
  }, fresh);
  await page.keyboard.press('Escape');
  await page.click('.p-opts button:has-text("Quit to menu")');
  await page.click('.m-layer .btn-primary');
  const t0 = await page.evaluate(() => performance.now());
  await page.waitForTimeout(3000);
  const r = await page.evaluate((t0) => { const Q = window.__Q, L = Q.long.filter(([s]) => s >= t0 && s < t0 + 3000).map((e) => e[1]); return { 'quit.longTask': Math.round(Math.max(0, ...L)), 'quit.tasks': L.length, 'quit.world': Q.world === null ? -1 : Math.round(Q.world), menu: !window.game.session }; }, t0);
  if (!r.menu || r['quit.world'] < 0) throw Error('the quit did not reach the menu or rebuild the collision world: ' + JSON.stringify(r));
  delete r.menu;
  await page.click('.bento-tile[data-id=race]');
  await page.click('.panel.setup button.cta');
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 240000 });
  await page.waitForTimeout(5000);
  return r;
}

const result = { track, look, frames: FRAMES, rounds: ROUNDS, ab, abLoad, arms: {} };
const add = (arm, r) => { (result.arms[arm] ??= { rounds: [] }).rounds.push(r); log(arm, JSON.stringify(r)); };
let newPrograms = [];
if (abLoad) {
  for (let r = 0; r < ROUNDS; r++) for (const [arm, q] of [['A', 'perf=' + abLoad], ['B', '']]) {
    const { ctx, page } = await open(q); await page.waitForTimeout(1000); add(arm, await block(page)); await ctx.done();
  }
} else {
  const { ctx, page, warm } = await open();
  for (let r = 0; r < ROUNDS; r++) {
    if (has('quit')) { for (const [arm, fresh] of [['A', true], ['B', false]]) add(arm, await quitPhase(page, fresh)); continue; }
    if (!ab) { add('base', await block(page)); continue; }
    for (const [arm, on] of [['A', false], ['B', true]]) {
      await page.evaluate(([k, on]) => { window.viewer.perf[k] = on; window.viewer.applyAll(); }, [ab, on]);
      await page.waitForTimeout(500);
      add(arm, await block(page));
    }
  }
  if (has('programs')) {   // after the timed blocks: the wall hit leaves the hero far behind the pack
    result.provoked = await provoke(page);
    const known = new Set(warm.map((p) => p[0]));
    newPrograms = (await page.evaluate(() => window.viewer.renderer.info.programs.map((p) => [p.cacheKey, p.name]))).filter((p) => !known.has(p[0]));
    const firstUsed = await page.evaluate(() => window.__infoLogs);
    result.programs = { atWarm: warm.length, created: newPrograms.map(([key, name]) => ({ name, key: key.slice(0, 160) })), firstUsedAfterWarm: firstUsed };
    log(`programs: ${warm.length} at the end of the menu warm-up, ${newPrograms.length} created after it, ${firstUsed} info-log reads after it (nitro ${result.provoked.nitro ? 'fired' : 'NOT fired'}, wall ${result.provoked.wall ?? 'NOT found'})`);
    newPrograms.forEach(([key, name]) => log('  new program:', name, key.slice(0, 120)));
  }
  await ctx.done();
}

for (const a of Object.values(result.arms)) Object.assign(a, stats(a.rounds));
for (const [arm, a] of Object.entries(result.arms)) log(`${arm} median`, JSON.stringify(a.median), '\n', `${arm} spread`, JSON.stringify(a.spread), '\n', `${arm} rounds per key`, JSON.stringify(a.n));
if (result.arms.A && result.arms.B) {
  result.verdict = verdict(result.arms.A, result.arms.B);
  for (const [k, v] of Object.entries(result.verdict)) log(`B - A ${k.padEnd(22)} ${String(v.d).padStart(8)}  spread ${String(v.spread).padStart(7)}  ${v.few ? 'TOO FEW ROUNDS' : v.beyond ? 'BEYOND SPREAD' : 'within noise'}`);
}
result.errors = [...new Set(errors)].slice(0, 20);
mkdirSync(dirname(resolve(root, out)), { recursive: true });
writeFileSync(resolve(root, out), JSON.stringify(result, null, 1));
log('written', out, '| errors:', result.errors.length ? result.errors.slice(0, 4) : 'none');
process.exit(newPrograms.length || result.programs?.firstUsedAfterWarm ? 1 : 0);
