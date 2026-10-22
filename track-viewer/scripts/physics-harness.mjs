// Headless physics harness (no browser): loads src/physics through Vite's SSR loader and runs the measurements the
// handling work is judged by. Needs the Vite dev server on :5180 only to serve the collision mesh for lap tests.
//   node scripts/physics-harness.mjs --tests pad,brake,accel,top,lap --cars av12,tesla1 --weather dry,damp,rain --assist rookie,pro
//   node scripts/physics-harness.mjs --tests table            sim vs real: 0-100, top speed, 100-0 for every car
//   node scripts/physics-harness.mjs --tests upgrades         self-check of the upgrade API
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

globalThis.ProgressEvent ??= class { constructor(t, i) { this.type = t; Object.assign(this, i); } };
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..'), repo = join(root, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, ssr: { noExternal: [] } });
const load = (p) => vite.ssrLoadModule('/src/physics/' + p);
const THREE = await vite.ssrLoadModule('three');
const [{ Vehicle }, H, { PhysicsWorld, STEP }, { AIDriver }, W, { yawFade: YF }] = await Promise.all([load('vehicle.js'), load('handling.js'), load('world.js'), load('driver.js'), load('weather.js'), load('arcade.js')]);

const ASSIST = { rookie: { counter: 0.45, stability: 1.25, tcs: 0.8 }, pro: { counter: 0.1, stability: 0.35, tcs: 0 }, ai: { counter: 0.6, stability: 1.4, tcs: 1 } };
if (arg('absSteer')) for (const a of Object.values(ASSIST)) a.absSteer = +arg('absSteer');   // override the ABS steering reserve (0 = the old brake that ignores steering)
const WET = { dry: 0.15, damp: 0.7, rain: 1 };                       // src/game/store.js WEATHER.wet

export function profileOf(key) {
  const mj = join(repo, 'assets/cars', key, 'model.json'), pj = join(repo, 'car-lab/src/vehicle/profiles', key + '.json');
  const wheels = existsSync(mj) ? JSON.parse(readFileSync(mj, 'utf8')).wheels : existsSync(pj) ? JSON.parse(readFileSync(pj, 'utf8')).wheels
    : JSON.parse(readFileSync(join(repo, 'car-lab/src/vehicle/profiles/av12.json'), 'utf8')).wheels;
  return { wheels };
}
const flat = await PhysicsWorld.flat(12000);                 // 24 km: room for a top-speed run (start at x = -11000)
let flatBodies = [];
const mk = (key, pos = [0, 0, 0], yaw = 0) => { const v = new Vehicle(flat, H.handling(key), profileOf(key), { pos: new THREE.Vector3(...pos), yaw }); flatBodies.push(v); return v; };
const drop = (v) => { flat.world.removeRigidBody(v.rb); };
const settle = (v, s = 0.8) => { for (let i = 0; i < s / STEP; i++) { v.step(STEP, ASSIST.rookie); flat.world.step(); } };
const setSpeed = (v, ms) => { const f = new THREE.Vector3(1, 0, 0); v.rb.setLinvel({ x: ms, y: 0, z: 0 }, true); };
const step = (v, a) => { v.step(STEP, a); flat.world.step(); };

/** skidpad: a 50 m circle, speed creeping up until the car can no longer hold the radius; returns the best lateral g held */
export function skidpadG(key, assist, R = 50) {
  const v = mk(key, [0, 0, 0], 0); settle(v, 0.5);
  const c = new THREE.Vector3(0, 0, R);                         // right-hand circle: centre at +z
  let best = 0, vt = 12, t = 0, held = 0, lastOk = 0;
  const ang = []; let g = [];
  while (t < 90) {
    const p = v.cur.pos, dx = p.x - c.x, dz = p.z - c.z, r = Math.hypot(dx, dz), err = r - R;
    // desired heading: tangent of the circle (clockwise seen from above for a right turn)
    const tan = new THREE.Vector3(-dz / r, 0, dx / r);
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(v.cur.quat);
    const headErr = Math.atan2(fwd.x * tan.z - fwd.z * tan.x, fwd.dot(tan));
    const steerAngle = -Math.atan(v.wheelbase / R) - 0.5 * headErr - 0.012 * err;          // negative = right
    const steer = THREE.MathUtils.clamp(steerAngle / v.steerLock(v.speed), -1, 1);
    const e = vt - v.speed;
    Object.assign(v.controls, { throttle: THREE.MathUtils.clamp(0.3 + e * 0.4, 0, 1), brake: THREE.MathUtils.clamp(-e * 0.3, 0, 1), steer, handbrake: 0, nitro: 0 });
    step(v, assist); t += STEP;
    if (t > 2) vt += STEP * 0.35;
    g.push(v.speed * v.speed / R / 9.81); if (g.length > 120) g.shift();
    const gm = g.reduce((a, b) => a + b, 0) / g.length;
    if (Math.abs(err) < 0.2 * R && Math.abs(v.state.beta) < 0.5) { best = Math.max(best, gm); lastOk = t; }
    if (Math.abs(err) > 0.3 * R || t - lastOk > 4) break;
  }
  if (process.env.DBG) console.log('end', t.toFixed(1), v.speed*3.6, v.cur.pos, best);
  const res = { g: best, kmh: Math.sqrt(best * 9.81 * R) * 3.6 };
  drop(v); return res;
}

/** straight-line braking from 100 km/h with full brake (what the player's S key does): metres */
export function brake100(key, assist = ASSIST.rookie) {
  const v = mk(key); settle(v); setSpeed(v, 100 / 3.6); step(v, assist); let d = 0, t = 0;
  while (v.speed > 0.5 && t < 20) { v.controls.brake = 1; v.controls.throttle = 0; v.controls.steer = 0; const x0 = v.cur.pos.x; step(v, assist); d += v.cur.pos.x - x0; t += STEP; }
  drop(v); return { m: d, s: t };
}
/** 100-0 with brakeK forced (calibration) */
function brakeWith(key, K) {
  const spec = H.handling(key); spec.brakeK = K; const v = new Vehicle(flat, spec, profileOf(key), { pos: new THREE.Vector3(0, 0, 0), yaw: 0 }); settle(v); setSpeed(v, 100 / 3.6); step(v, ASSIST.rookie);
  let d = 0, t = 0; while (v.speed > 0.5 && t < 20) { v.controls.brake = 1; v.controls.throttle = 0; v.controls.steer = 0; const x0 = v.cur.pos.x; step(v, ASSIST.rookie); d += v.cur.pos.x - x0; t += STEP; }
  drop(v); return d;
}
/** standing start, full throttle: 0-100 km/h seconds and the top speed reached after `secs` */
export function accel(key, assist = ASSIST.rookie, secs = 400) {
  const v = mk(key, [-11000, 0, 0]); settle(v); let t = 0, t100 = null, top = 0;
  while (t < secs) {
    v.controls.throttle = 1; v.controls.brake = 0; v.controls.steer = -v.rb.rotation().y * 2; step(v, assist); t += STEP;
    const k = v.speed * 3.6; if (t100 === null && k >= 100) t100 = t; top = Math.max(top, k);
    if (t > 3 && Math.round(t / STEP) % 600 === 0) { if (k - (accel._k ?? 0) < 0.15) break; accel._k = k; }   // top speed: gaining under 0.15 km/h in 5 s
  }
  drop(v); return { t100, top };
}

// ---------------------------------------------------------------------------------------------- track laps
let FIELD;
async function field() {
  if (FIELD) return FIELD;
  const track = JSON.parse(readFileSync(join(repo, 'tracks/marina/out/track.json'), 'utf8')), c = track.centerline, n = c.length, rl = track.racingLine, pts = [];
  for (let i = 0; i < n; i++) {
    const a = c[(i - 1 + n) % n], b = c[(i + 1) % n], dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
    pts.push(new THREE.Vector3(c[i][0], c[i][1], c[i][2]).addScaledVector(new THREE.Vector3(dz / len, 0, -dx / len), rl[i]));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal'); curve.arcLengthDivisions = 4000; const length = curve.getLength();
  const N = 1200, k = new Float32Array(N), vv = new Float32Array(N), p = [], A_LAT = 27.5, A_BRK = 16, VMAX = 78, up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3();
  for (let i = 0; i < N; i++) p.push(curve.getPointAt(i / N));
  for (let i = 0; i < N; i++) {                                   // = Field.setTrack in src/cars.js
    const a = p[(i - 4 + N) % N], b = p[i], d = p[(i + 4) % N], ab = a.distanceTo(b), bc = b.distanceTo(d), ac = a.distanceTo(d);
    const cross = Math.abs((b.x - a.x) * (d.z - a.z) - (b.z - a.z) * (d.x - a.x));
    k[i] = 2 * cross / Math.max(1e-6, ab * bc * ac); { let s = Math.sqrt(A_LAT / Math.max(k[i], 1e-4)); for (let n = 0; n < 3; n++) s = Math.sqrt(A_LAT * YF(s) / Math.max(k[i], 1e-4)); vv[i] = Math.min(VMAX, s); }
  }
  const ds = length / N;
  for (let pass = 0; pass < 2; pass++) for (let i = 2 * N - 1; i >= 0; i--) { const a = i % N, b = (i + 1) % N; vv[a] = Math.min(vv[a], Math.sqrt(vv[b] ** 2 + 2 * A_BRK * ds)); }
  const linePts = [], lineLeft = [];
  for (let i = 0; i < N; i++) { linePts.push(curve.getPointAt(i / N)); curve.getTangentAt(i / N, t); t.y = 0; t.normalize(); lineLeft.push(new THREE.Vector3().crossVectors(up, t)); }
  const res = await fetch('http://127.0.0.1:5180/assets/marina_collision.glb').then((r) => r.arrayBuffer());
  const pw = await PhysicsWorld.create('data:model/gltf-binary;base64,' + Buffer.from(res).toString('base64'));
  const SP = JSON.parse(readFileSync(join(repo, 'assets/cars/specs.json'), 'utf8')).cars;
  return FIELD = { pw, linePts, lineLeft, N, vt: vv, all: Object.keys(SP).map((key) => ({ key, profile: profileOf(key) })) };
}

/** one AI lap from the start straight; stats: lap time, respawns, spins (rear over 60 degrees), max lateral g */
// a competent human on Pro: eases off and countersteers into a slide before the car is gone
function humanise(ctl, v) {
  const b = v.state.beta, a = Math.abs(b);
  if (a > 0.1) { ctl.steer = THREE.MathUtils.clamp(ctl.steer - Math.sign(b) * Math.min(1, (a - 0.1) * 5) * 1.0, -1, 1); ctl.throttle *= 1 - THREE.MathUtils.smoothstep(a, 0.1, 0.35); }
}
export async function lap(key, assist = ASSIST.ai, { start = 300, seconds = 260, human = false } = {}) {
  const F = await field(), pw = F.pw, a = F.linePts[start], b = F.linePts[(start + 2) % F.N];
  const v = new Vehicle(pw, H.handling(key), profileOf(key), { pos: a.clone(), yaw: Math.atan2(-(b.z - a.z), b.x - a.x) });
  const ai = new AIDriver(F, { hero: false }, 1); ai.i = start;
  let lastI = start, lapT = 0, passed = 0, respawns = 0, spins = 0, spinning = false, maxLat = 0, maxBeta = 0, offs = 0;
  const N = F.N, respawnAt = (i) => { const p0 = F.linePts[i], p1 = F.linePts[(i + 2) % N]; v.respawn(p0, Math.atan2(-(p1.z - p0.z), p1.x - p0.x)); };
  let result = null;
  for (let s = 0; s < seconds / STEP; s++) {
    const ctl = ai.read(v); if (human) humanise(ctl, v); Object.assign(v.controls, ctl); if (ctl.reset) { respawns++; respawnAt(ai.i); ai.stuck = 0; }
    v.step(STEP, assist); pw.world.step(); lapT += STEP;
    if (v.state.upsideDown > 1.5) { respawns++; respawnAt(ai.i); }
    if (v.onGround === 4 && v.speed > 15) maxLat = Math.max(maxLat, Math.abs(v.aBody.z) / 9.81);
    if (process.env.TRACE && lapT > +process.env.TRACE && lapT < +process.env.TRACE + 8 && s % 15 === 0) console.log(`t ${lapT.toFixed(1)} i ${ai.i} ${(v.speed * 3.6).toFixed(0)}kmh vt ${(F.vt[ai.i] * 3.6).toFixed(0)} thr ${v.controls.throttle.toFixed(2)} brk ${v.controls.brake.toFixed(2)} st ${v.controls.steer.toFixed(2)} wheel ${v.state.steer.toFixed(3)} beta ${(v.state.beta * 57.3).toFixed(0)} off ${F.linePts[ai.i].distanceTo(v.cur.pos).toFixed(1)} on ${v.wheels[0].surface?.name} slip ${v.wheels.map((w) => w.slip.toFixed(2))} lat ${(v.aBody.z / 9.81).toFixed(2)}`);
    if (process.env.OFF && F.linePts[ai.i].distanceTo(v.cur.pos) > +process.env.OFF && !globalThis._offLogged) { globalThis._offLogged = 1; console.log('first off at', lapT.toFixed(1), 'idx', ai.i); }
    const bt = Math.abs(v.state.beta); maxBeta = Math.max(maxBeta, bt);
    if (bt > 1.0 && !spinning) { spins++; spinning = true; if (process.env.DBG) console.log(`spin at t ${lapT.toFixed(1)} idx ${ai.i} ${(v.speed * 3.6).toFixed(0)} km/h on ${v.wheels.map((w) => w.surface?.name).join(',')} thr ${v.controls.throttle.toFixed(2)} brk ${v.controls.brake.toFixed(2)} off ${F.linePts[ai.i].distanceTo(v.cur.pos).toFixed(1)}`); } else if (bt < 0.5) spinning = false;
    if (F.linePts[ai.i].distanceTo(v.cur.pos) > 8) offs++;
    const d = (ai.i - lastI + N) % N; if (d < N / 2) passed += d; lastI = ai.i;
    if (passed >= N) { result = lapT; break; }
  }
  pw.world.removeRigidBody(v.rb);
  return { lap: result, respawns, spins, maxLat, maxBetaDeg: THREE.MathUtils.radToDeg(maxBeta), offSteps: offs };
}

/** a keyboard driver's mistakes on the flat: [kmh, throttle, steer, brake, seconds, label]; peak slip angle, whether the car spun, speed left */
export function abuse(key, assist, [kmh, thr, st, brk, secs]) {
  const v = mk(key); settle(v); setSpeed(v, kmh / 3.6); let t = 0, peak = 0, kmhEnd = 0; const input = { s: 0 };
  while (t < secs) {
    input.s += (st - input.s) * (1 - Math.exp(-4 * STEP));         // keyboard steering eases in (driver.js PlayerInput)
    Object.assign(v.controls, { throttle: thr, brake: brk, steer: input.s, handbrake: 0, nitro: 0 }); step(v, assist); t += STEP; peak = Math.max(peak, Math.abs(v.state.beta));
    if (process.env.ABT && Math.round(t / STEP) % 12 === 0) console.log(`t ${t.toFixed(2)} v ${(v.speed * 3.6).toFixed(0)} beta ${(v.state.beta * 57.3).toFixed(1)} wheel ${(v.state.steer * 57.3).toFixed(1)}° in ${input.s.toFixed(2)} yaw ${v.rb.angvel().y.toFixed(2)} drift ${v.state.drift.toFixed(2)} loads ${v.wheels.map((w) => (w.load / 1000).toFixed(1))} slip ${v.wheels.map((w) => w.slip.toFixed(2))}`);
  }
  kmhEnd = v.speed * 3.6; drop(v); return { peakDeg: THREE.MathUtils.radToDeg(peak), spun: peak > 1.0, kmhEnd };
}
const ABUSE = { 'hold full lock @120 on throttle': [120, 0.6, 1, 0, 3.5], 'full lock + lift @150': [150, 0, 1, 0, 3.5], 'half lock + full brake @150': [150, 0, 0.5, 1, 3], 'half lock + full throttle @80': [80, 1, 0.5, 0, 4], 'flick: lock then lift @180': [180, 0, 0.7, 0, 3] };

// ---------------------------------------------------------------------------------------------- driver
const HJSON = join(repo, 'assets/cars/handling.json');
const tests = (arg('tests', 'pad,brake,lap')).split(','), weathers = arg('weather', 'dry,damp,rain').split(','), assists = arg('assist', 'rookie,pro').split(',');
const cars = arg('cars', 'bentley-gt,furari-488,tesla1').split(',');
const f2 = (x, n = 2) => (x == null ? '  -  ' : x.toFixed(n));
if (tests.includes('abuse')) for (const as of assists) for (const k of cars) for (const wx of weathers) {
  W.setWeather(WET[wx]); const out = Object.entries(ABUSE).map(([n, a]) => { const r = abuse(k, ASSIST[as], a); return `${r.spun ? 'SPIN' : 'ok  '} ${f2(r.peakDeg, 0).padStart(3)}°`; });
  console.log(`${as.padEnd(5)} ${k.padEnd(14)} ${wx.padEnd(4)} | ${out.join(' | ')}`);
}
const writeHandling = (fn) => { const d = JSON.parse(readFileSync(HJSON, 'utf8')); fn(d.cars); writeFileSync(HJSON, JSON.stringify(d, null, 1) + '\n'); };
const brakeTarget = (real) => (37 + (real - 33) * 0.5) * +arg('brakeScale', 1);   // --brakeScale .92: the field brakes 8% shorter than this since the arcade grip pass (+6%), new cars follow it               // compressed real 100-0 braking, m (handling.js)
if (tests.includes('check')) {                                       // handling.json mirrors specs.json
  const SP = JSON.parse(readFileSync(join(repo, 'assets/cars/specs.json'), 'utf8')).cars, HC = JSON.parse(readFileSync(HJSON, 'utf8')).cars; let bad = 0;
  for (const [k, s] of Object.entries(SP)) { const h = HC[k]; if (!h) { console.log('handling.json lacks', k); bad++; continue; } for (const [a, b] of [['hp', 'powerHp'], ['zeroTo100', 'zeroTo100S'], ['topKmh', 'topSpeedKmh'], ['drive', 'drive'], ['massKg', 'massKg']]) if (h[a] !== s[b]) { console.log(k, a, h[a], '!= specs', s[b]); bad++; } }
  console.log(bad ? 'MISMATCH' : 'handling.json and specs.json agree for ' + Object.keys(SP).length + ' cars');
}
if (tests.includes('balance')) {                                     // AI solo laps to 150 s: bop (power), then bopGrip
  const { balance } = await load('testdrive.js'); const F = await field(); W.setWeather(WET.dry);
  const rows = await balance(F, { target: +arg('target', 150), rounds: +arg('rounds', 10), tol: +arg('tol', 0.02), power: [+arg('powerMin', 0.93), 1.07], grip: [+arg('gripMin', 0.95), 1.12], keys: arg('cars') ? arg('cars').split(',') : undefined }); console.table(rows);   // --cars a,b: only those (the others keep their bop)
  if (process.argv.includes('--write')) writeHandling((c) => { for (const [k, r] of Object.entries(rows)) { c[k].bop = r.power; c[k].bopGrip = r.grip; } });
}
if (tests.includes('calibrate')) {                                   // brakeK so that 100-0 follows brakeTarget(real)
  const SP = JSON.parse(readFileSync(join(repo, 'assets/cars/specs.json'), 'utf8')).cars; W.setWeather(WET.dry); const out = {};
  for (const [k, s] of Object.entries(SP)) {
    if (arg('cars') && !arg('cars').split(',').includes(k)) continue;           // --cars a,b: only those keep a new brakeK
    const want = brakeTarget(s.brake100To0M); let K = 1, lo = 0.6, hi = 1.35;
    for (let i = 0; i < 9; i++) { H.BOP[k] = H.BOP[k]; const hk = H.handling(k); const save = H.handling; hk.brakeK = K; const d = brakeWith(k, K); if (Math.abs(d - want) < 0.15) break; if (d > want) lo = K; else hi = K; K = d > want ? (K + hi) / 2 : (K + lo) / 2; }
    out[k] = +K.toFixed(3); console.log(k, 'K', out[k], 'target', f2(want, 1), 'got', f2(brakeWith(k, K), 1));
  }
  if (process.argv.includes('--write')) writeHandling((c) => { for (const [k, K] of Object.entries(out)) c[k].brakeK = K; });
}
if (tests.includes('upgrades')) {                                   // the upgrade API: contract checks, then what each category does
  const assert = (await import('node:assert')).default; W.setWeather(WET.dry);
  assert.deepEqual(H.setUpgrades('av12', { engine: 2, tyres: 9, brakes: -3 }), { engine: 2, tyres: 3, brakes: 0 }, 'levels clamp to 0..3');
  assert.deepEqual(H.setUpgrades('av12', { brakes: 1 }), { engine: 2, tyres: 3, brakes: 1 }, 'a category left out keeps its level');
  H.setUpgrades('av12', { engine: 0, tyres: 0, brakes: 0 });
  const base = H.handling('av12'); H.setUpgrades('av12', { engine: 3, tyres: 3, brakes: 3 }); const top = H.handling('av12');
  assert(Math.abs(top.power / base.power - 1.16 * top.mass / base.mass) < 1e-9 && Math.abs(top.grip / base.grip - 1.09) < 1e-9 && Math.abs(top.brakeK / base.brakeK - 1.16) < 1e-9 && top.mass === base.mass + 10, 'level 3 multipliers');
  assert.equal(H.handling('furari-488').power, H.handling('furari-488').power); assert.deepEqual(H.getUpgrades('mustang'), { engine: 0, tyres: 0, brakes: 0 }, 'other cars stay stock');
  H.setUpgrades('av12', { engine: 0, tyres: 0, brakes: 0 });
  // retune a live car: mass, power and brakes change at once and the car keeps driving
  const v = mk('av12'); settle(v); const m0 = v.rb.mass(); H.setUpgrades('av12', { engine: 3 }); v.retune(H.handling('av12'));
  assert(Math.abs(v.rb.mass() - m0 - 10) < 0.01, 'retune changed the body mass'); for (let i = 0; i < 120; i++) { v.controls.throttle = 1; step(v, ASSIST.rookie); } assert(v.speed > 5 && Number.isFinite(v.speed), 'car drives after retune'); drop(v);
  H.setUpgrades('av12', { engine: 0 });
  console.log('upgrade API checks passed');
  console.log('car            | stock 0-100 / top / 100-0 / pad g | engine 3 | tyres 3 | brakes 3 | all 3 (rain pad g, 100-0 stock -> tyres 3)');
  for (const k of cars) {
    const run = (lv) => { H.setUpgrades(k, { engine: 0, tyres: 0, brakes: 0, ...lv }); W.setWeather(WET.dry); accel._k = 0; const a = accel(k), b = brake100(k), p = skidpadG(k, ASSIST.rookie);
      W.setWeather(WET.rain); const bw = brake100(k), pw = skidpadG(k, ASSIST.rookie); return `${f2(a.t100)}s ${f2(a.top, 0)} ${f2(b.m, 1)}m ${f2(p.g)}g (rain ${f2(bw.m, 1)}m ${f2(pw.g)}g)`; };
    console.log(k.padEnd(14), '|', run({}), '|', run({ engine: 3 }), '|', run({ tyres: 3 }), '|', run({ brakes: 3 }), '|', run({ engine: 3, tyres: 3, brakes: 3 }));
    H.setUpgrades(k, { engine: 0, tyres: 0, brakes: 0 });
  }
}
if (tests.includes('table')) {
  const SP = JSON.parse(readFileSync(join(repo, 'assets/cars/specs.json'), 'utf8')).cars; W.setWeather(WET.dry);
  console.log('car                 | 0-100 sim/real | top km/h sim/real | 100-0 m sim/real');
  for (const k of (arg('cars', Object.keys(SP).join(','))).split(',')) {
    accel._k = 0; const a = accel(k), b = brake100(k), s = SP[k] ?? {};
    console.log(`${k.padEnd(19)} | ${f2(a.t100)} / ${f2(s.zeroTo100S, 1)} | ${f2(a.top, 0)} / ${s.topSpeedKmh} | ${f2(b.m, 1)} / ${s.brake100To0M}`);
  }
}
if (tests.includes('accel')) for (const as of assists) for (const k of cars) { W.setWeather(WET.dry); accel._k = 0; const a = accel(k, ASSIST[as]); console.log(as, k, 'dry 0-100', f2(a.t100), 's  top', f2(a.top, 0)); }
if (tests.includes('pad') || tests.includes('brake') || tests.includes('lap')) {
  const base = {};
  for (const as of assists) for (const k of cars) for (const wx of weathers) {
    W.setWeather(WET[wx]); const A = ASSIST[as], row = [as.padEnd(5), k.padEnd(14), wx.padEnd(4)];
    if (tests.includes('pad')) { const r = skidpadG(k, A); base[`pad${as}${k}`] ??= r.g; row.push(`pad ${f2(r.g)}g (${f2(r.g / base[`pad${as}${k}`])}x)`); }
    if (tests.includes('brake')) { const r = brake100(k, A); base[`br${as}${k}`] ??= r.m; row.push(`100-0 ${f2(r.m, 1)}m (${f2(r.m / base[`br${as}${k}`])}x)`); }
    if (tests.includes('lap')) { const r = await lap(k, as === 'rookie' || as === 'pro' ? A : ASSIST.ai, { human: as === 'pro', start: +arg('start', 300) }); base[`lap${as}${k}`] ??= r.lap; row.push(`lap ${f2(r.lap, 1)}s (${f2(r.lap / base[`lap${as}${k}`])}x) resp ${r.respawns} spins ${r.spins} maxBeta ${f2(r.maxBetaDeg, 0)} off ${r.offSteps} latG ${f2(r.maxLat)}`); }
    console.log(row.join(' | '));
  }
}
await vite.close(); process.exit(0);
