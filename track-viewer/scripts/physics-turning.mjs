// Turning measurements: does the car turn like it is on a road? (permanent check, see PHYSICS.md "Turning")
//   node scripts/physics-turning.mjs [--cars av12,ford-gt,bentley-gt,porsche1] [--tiers casual,sport,pro] [--wx dry,rain]
//        [--only steady,turnin,ice,lift,trail,rwd,handbrake,slalom,abuse,hairpin,aids,bench,assert]   `assert` turns the rows into pass/fail (exit 1)
//        [--tune '{"engineBrake":0.06}']   driving.json overrides for an experiment (applied to every car)
// Drives the real Vehicle on a flat world with the game's keyboard filters (player-controls.js). "Tyre limit" values come from
// the same car with every assist off and the steering lock opened up, swept over wheel angles: the most the tyres give there.
// "raw" = every assist off but the real lock and input filters; the difference to a tier is what that tier's aids do.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const root = fileURLToPath(new URL('../', import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const L = (p) => server.ssrLoadModule(p);
const THREE = await L('three');
const { PhysicsWorld, STEP } = await L('/src/physics/world.js');
const { Vehicle } = await L('/src/physics/vehicle.js');
const { handling } = await L('/src/physics/handling.js');
const { setWeather } = await L('/src/physics/weather.js');
const { AIDriver } = await L('/src/physics/driver.js');
const PC = await L('/src/physics/player-controls.js');
const TIER = { rookie: { counter: 0.45, stability: 1.25, tcs: 0.8 }, pro: { counter: 0.1, stability: 0.35, tcs: 0 }, raw: { counter: 0, stability: 0, tcs: 0 } };
const AI = { counter: 0.6, stability: 1.4, tcs: 1 };
const WET = { dry: 0.15, damp: 0.7, rain: 1 };
const D = THREE.MathUtils.radToDeg;
const world = await PhysicsWorld.flat(6000);
const TUNE = JSON.parse(arg('tune', '{}'));
const tuned = (key) => { const s = handling(key); Object.assign(s.arcade, TUNE); return s; };
const profile = (key) => { const m = new URL(`../../assets/cars/${key}/model.json`, import.meta.url); return { wheels: JSON.parse(readFileSync(existsSync(m) ? m : new URL(`../../car-lab/src/vehicle/profiles/${key}.json`, import.meta.url), 'utf8')).wheels }; };
const mk = (key) => { const v = new Vehicle(world, tuned(key), profile(key), { pos: new THREE.Vector3(), yaw: 0 }); for (let i = 0; i < 100; i++) { v.step(STEP, TIER.rookie); world.world.step(); } return v; };
const drop = (v) => world.world.removeRigidBody(v.rb);
const f = (x, n = 1) => (Number.isFinite(x) ? x.toFixed(n) : 'NaN');
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const holdThrottle = (v, kmh) => THREE.MathUtils.clamp(0.35 + (kmh / 3.6 - v.speed) * 0.4, 0, 1);
const SPIN = 0.8;                                                 // rad (46 deg): past this the car has spun

/**
 * One keyboard (or pad) run. script(t, v, s) returns the keys held ({throttle, brake, steer, handbrake}); the sim applies the
 * game's filters (keyboardSteer/keyboardBrake, or the pad's speed scale). open: the lock is opened up and steer is in rad.
 */
function run(key, tier, wx, kmh, script, secs, { onStep, pad = false, open = false } = {}) {
  setWeather(WET[wx]); const v = mk(key); v.rb.setLinvel({ x: kmh / 3.6, y: 0, z: 0 }, true);
  if (open) v.steerLock = () => 1;
  const s = { steer: 0, brake: 0, t: 0, yaw: 0, peakBeta: 0, peakLat: 0, hist: [] };
  for (; s.t < secs; s.t += STEP) {
    const k = script(s.t, v, s);
    s.steer = open ? (k.steer ?? 0) : pad ? (k.steer ?? 0) * PC.steerScale(v.speed) : PC.keyboardSteer(s.steer, k.steer ?? 0, STEP, v.speed, (s.hold ??= { t: 0, dir: 0 }));
    s.brake = pad || open ? (k.brake ?? 0) : PC.keyboardBrake(s.brake, k.brake ?? 0, STEP);
    Object.assign(v.controls, { throttle: k.throttle ?? 0, brake: s.brake, steer: s.steer, handbrake: k.handbrake ?? 0, nitro: 0 });
    v.step(STEP, TIER[tier]); world.world.step();
    const r = v.rb.angvel().y; s.yaw += r * STEP;
    const lv = v.rb.linvel(); let course = Math.atan2(-lv.z, lv.x); if (s.course !== undefined) course = s.course + Math.atan2(Math.sin(course - s.course), Math.cos(course - s.course)); s.course = course;   // direction of travel, unwrapped
    s.peakBeta = Math.max(s.peakBeta, Math.abs(v.state.beta)); s.peakLat = Math.max(s.peakLat, Math.abs(r * v.speed) / 9.81);
    s.hist.push({ t: s.t, course, tcsActive: v.state.tcsActive, absActive: v.state.absActive, escActive: v.state.escActive, kmh: v.speed * 3.6, r, g: Math.abs(r) * v.speed / 9.81, beta: v.state.beta, steer: v.state.steer, keys: s.steer, ...v.dbg, drift: v.state.drift });
    onStep?.(v, s);
  }
  s.v = v; return s;
}
const win = (h, a, b) => h.filter((x) => x.t >= a && x.t < b);
const heading = (s) => Math.abs(D(s.yaw));
const done = (s, r) => { drop(s.v); return r; };

/** full-lock corner at constant speed (throttle holds it): steady lateral g, yaw rate, beta and the assist terms over the last 2 s */
function steady(key, tier, wx, kmh, { pad = false, open = false, angle = 1, secs = 5 } = {}) {
  const s = run(key, tier, wx, kmh, (t, v) => ({ throttle: holdThrottle(v, kmh), steer: angle }), secs, { pad, open });
  const w = win(s.hist, secs - 2, secs), m = (fn) => mean(w.map(fn)), turn = Math.abs(w[w.length - 1].course - w[0].course) / (w[w.length - 1].t - w[0].t);   // path curvature x speed: the real lateral acceleration, whatever the car's weaving does
  return done(s, { g: turn * m((x) => x.kmh / 3.6) / 9.81, yaw: m((x) => Math.abs(x.r)), beta: D(m((x) => Math.abs(x.beta))), kmh: m((x) => x.kmh), lock: D(m((x) => x.lock)), counter: D(m((x) => Math.abs(x.counter ?? 0))), tc: m((x) => x.tc ?? 1), stab: m((x) => Math.abs(x.stab ?? 0)), recov: m((x) => Math.abs(x.recov ?? 0)), gate: m((x) => x.spin ?? 0), spun: s.peakBeta > SPIN, hist: s.hist });
}
/** the most the tyres give at this speed: wheel-angle sweep with every assist off */
const limitCache = new Map();
function tyreLimit(key, wx, kmh) {
  const id = [key, wx, kmh].join(); if (limitCache.has(id)) return limitCache.get(id);
  let best = { g: 0, deg: 0 };
  for (const deg of [0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 13]) {
    const r = steady(key, 'raw', wx, kmh, { open: true, angle: deg * Math.PI / 180 });
    if (!r.spun && r.g > best.g) best = { g: r.g, deg, beta: r.beta };
  }
  limitCache.set(id, best); return best;
}
const SPEEDS = [60, 100, 150, 200];
/** share of the tyre limit the player gets with full steer at each speed */
const gripUsed = (key, tier, wx, pad) => SPEEDS.map((kmh) => { const lim = tyreLimit(key, wx, kmh), r = steady(key, tier, wx, kmh, { pad }); return { kmh, g: r.g, lim: lim.g, limDeg: lim.deg, pct: r.g / lim.g, r }; });
/** time to 63% / 90% of the steady yaw rate after full steer at t = 0 (from the key, not from the wheel) */
function turnIn(key, tier, wx, kmh, pad) {
  const r = steady(key, tier, wx, kmh, { pad, secs: 6 }), h = r.hist, at = (frac) => (h.find((x) => Math.abs(x.r) >= frac * r.yaw) ?? { t: NaN }).t;
  return { t63: at(0.63), t90: at(0.9) };
}
/** coast with full steer held: peak slide at 120 km/h from the start, and a flick (straight, then full steer) at 150 */
function ice(key, tier, wx) {
  const a = run(key, tier, wx, 120, () => ({ steer: 1 }), 4), b = run(key, tier, wx, 150, (t) => ({ steer: t < 0.5 ? 0 : 1 }), 4);
  const r = { b120: D(a.peakBeta), b150: D(b.peakBeta), lat: a.peakLat, end120: D(Math.abs(a.hist[a.hist.length - 1].beta)) }; drop(a.v); return done(b, r);
}
/** full lock under throttle to 2 s, then a lift: peak slide after the lift, yaw rate after / before, heading gained in the 1.2 s after */
function lift(key, tier, wx, kmh) {
  let yaw0 = 0, rec = null;
  const s = run(key, tier, wx, kmh, (t, v) => ({ throttle: t < 2 ? holdThrottle(v, kmh) : 0, steer: 1 }), 3.6, { onStep: (v, s) => {
    if (s.t < 2 && s.t > 1.5) yaw0 = Math.max(yaw0, Math.abs(v.rb.angvel().y)); if (!rec && s.t >= 2) rec = { h0: s.yaw, pk: 0, yawPk: 0, b0: Math.abs(v.state.beta) };
    if (rec) { rec.pk = Math.max(rec.pk, Math.abs(v.state.beta)); rec.yawPk = Math.max(rec.yawPk, Math.abs(v.rb.angvel().y)); } } });
  return done(s, { beta: D(rec.pk), beta0: D(rec.b0), gain: rec.yawPk / yaw0, head: Math.abs(D(s.yaw - rec.h0)), spun: s.peakBeta > SPIN });
}
/** 150 km/h, brake held to 1.5 s into a full-lock turn (steer at .5 s), off over .4 s, 30% throttle */
function trail(key, tier, wx) {
  let rec = null;
  const s = run(key, tier, wx, 150, (t) => ({ brake: t < 1.5 ? 1 : Math.max(0, 1 - (t - 1.5) / 0.4), steer: t < 0.5 ? 0 : 1, throttle: t >= 1.9 ? 0.3 : 0 }), 4, { onStep: (v, s) => { if (!rec && s.t >= 1.9) rec = { head: heading(s), beta: D(s.peakBeta), lat: s.peakLat }; } });
  return done(s, { ...rec, kmh: s.v.speed * 3.6, spun: s.peakBeta > SPIN });
}
/** full lock + full throttle from kmh (a hairpin exit on the keys): peak slide, slide at 3 s, heading */
function powerOn(key, tier, wx, kmh) {
  const s = run(key, tier, wx, kmh, () => ({ throttle: 1, steer: 1 }), 3), h = s.hist[s.hist.length - 1];
  return done(s, { beta: D(s.peakBeta), now: D(Math.abs(h.beta)), head: heading(s), spun: s.peakBeta > SPIN });
}
/** full lock + handbrake .7 s from 60 km/h (wheel centred after): heading and speed at the release, heading at 2.5 s, peak slide */
function handbrake(key, tier, wx, kmh = 60) {
  let at = NaN, kmhAt = NaN;
  const s = run(key, tier, wx, kmh, (t) => ({ steer: t < 0.7 ? 1 : 0, handbrake: t >= 0.1 && t < 0.8 ? 1 : 0, throttle: t < 0.8 ? 0 : 0.3 }), 2.6, { onStep: (v, s) => { if (s.t >= 0.8 && Number.isNaN(at)) { at = heading(s); kmhAt = v.speed * 3.6; } } });
  return done(s, { at, kmhAt, end: heading(s), beta: D(s.peakBeta) });
}
/** the Endurance reference: 115 km/h, full steer for .55 s, then countersteer for .4 s: peak slide / peak yaw rate / heading gained by the end of the flick */
function flick(key, tier, wx, kmh = 115) {
  let head = NaN;
  const s = run(key, tier, wx, kmh, (t, v) => ({ throttle: holdThrottle(v, kmh) * 0.5, steer: t < 0.05 ? 0 : t < 0.6 ? 1 : t < 1.0 ? -1 : 0 }), 3, { onStep: (v, s) => { if (s.t >= 1.0 && Number.isNaN(head)) head = heading(s); } });
  return done(s, { beta: D(s.peakBeta), yaw: Math.max(...s.hist.map((x) => Math.abs(D(x.r)))), head, end: D(Math.abs(s.hist[s.hist.length - 1].beta)), spun: s.peakBeta > SPIN });
}
/** left held 2 s, then right: time for the yaw rate to reach 63% of the opposite steady value */
function slalom(key, tier, wx, pad, kmh = 100) {
  const s = run(key, tier, wx, kmh, (t, v) => ({ throttle: holdThrottle(v, kmh), steer: t < 2 ? 1 : -1 }), 4.5, { pad });
  const ss = mean(win(s.hist, 1.2, 1.9).map((x) => x.r)), hit = s.hist.filter((x) => x.t >= 2).find((x) => x.r * ss < 0 && Math.abs(x.r) >= 0.63 * Math.abs(ss));
  return done(s, { t63: hit ? hit.t - 2 : NaN, beta: D(s.peakBeta), lat: s.peakLat, spun: s.peakBeta > SPIN });
}
/** a driver's mistakes: [kmh, throttle, steer, brake, seconds]; keys held to the end (hold) or all let go at 1.2 s; peak slide, slide at the end */
const ABUSE = { 'full lock @120 on throttle': [120, 0.6, 1, 0, 4], 'full lock + lift @150': [150, 0, 1, 0, 4], 'half lock + full brake @150': [150, 0, 0.5, 1, 4], 'half lock + full throttle @80': [80, 1, 0.5, 0, 4], 'flick .7 + lift @180': [180, 0, 0.7, 0, 4], 'full lock + full brake @100': [100, 0, 1, 1, 4] };
function abuse(key, tier, wx, [kmh, thr, st, brk, secs], hold = true) {
  const s = run(key, tier, wx, kmh, (t) => (hold || t < 1.2 ? { throttle: thr, steer: st, brake: brk } : {}), secs + (hold ? 0 : 2));                // letting go = hands and feet off
  return done(s, { peak: D(s.peakBeta), end: D(Math.abs(s.hist[s.hist.length - 1].beta)), spun: s.peakBeta > SPIN });
}
// ---- corners: a path-follower (the AI's own pursuit + curvature feedback law) drives a 180-degree arc of radius R behind a straight;
// "ai" steers continuously, "key" presses the same steering as keys (PWM at 8 Hz through keyboardSteer). Highest entry speed that stays within 4 m of the line.
function arcField(R, straight = 80) {
  const pts = [], left = [], P = (x, z) => new THREE.Vector3(x, 0, z), up = new THREE.Vector3(0, 1, 0);
  for (let x = -straight; x < 0; x += 1) pts.push(P(x, 0));
  const da = 1 / R; for (let a = 0; a < Math.PI + 0.001; a += da) pts.push(P(R * Math.sin(a), -R * (1 - Math.cos(a))));
  const ex = pts[pts.length - 1]; for (let x = 1; x <= straight; x += 1) pts.push(P(ex.x - x, ex.z));
  for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = b.clone().sub(a).setY(0).normalize(); left.push(new THREE.Vector3().crossVectors(up, t)); }
  return { linePts: pts, lineLeft: left, N: pts.length, vt: new Float32Array(pts.length).fill(80) };
}
function corner(key, tier, wx, R, kmh, mode) {
  setWeather(WET[wx]); const F = arcField(R), v = mk(key); v.rb.setTranslation({ x: F.linePts[0].x, y: 0.3, z: 0 }, true); v.cur.pos.set(F.linePts[0].x, 0.3, 0); v.rb.setLinvel({ x: kmh / 3.6, y: 0, z: 0 }, true);
  const ai = new AIDriver(F, {}, 1), st = { steer: 0 }; let ok = true, finished = false;
  for (let t = 0; t < 40; t += STEP) {
    const c = ai.read(v), d = c.steer, tgt = mode === 'ai' ? d : (((t * 8) % 1) < Math.abs(d) ? Math.sign(d) : 0);
    st.steer = mode === 'ai' ? d : PC.keyboardSteer(st.steer, tgt, STEP, v.speed, (st.hold ??= { t: 0, dir: 0 }));
    Object.assign(v.controls, { throttle: holdThrottle(v, kmh), brake: 0, steer: st.steer, handbrake: 0, nitro: 0 });
    v.step(STEP, mode === 'ai' ? AI : TIER[tier]); world.world.step();
    if (F.linePts[ai.i].distanceTo(v.cur.pos) > 4 || Math.abs(v.state.beta) > 0.45 || v.speed < 0.5 * kmh / 3.6) { ok = false; break; }
    if (ai.i >= F.N - 10) { finished = true; break; }
  }
  drop(v); return ok && finished;
}
function maxCornerSpeed(key, tier, wx, R, mode) { let lo = 20, hi = 120; while (hi - lo > 2) { const m = (lo + hi) / 2; if (corner(key, tier, wx, R, m, mode)) lo = m; else hi = m; } return lo; }

const cars = arg('cars', 'av12,ford-gt,bentley-gt,porsche1').split(','), tiers = arg('tiers', 'rookie,pro').split(','), wxs = arg('wx', 'dry,rain').split(',');
const only = arg('only', 'arcade,steady,turnin,ice,lift,trail,rwd,handbrake,slalom,abuse,hairpin,assert').split(',');
const A = only.includes('assert'), fails = [];
const check = (ok, msg) => { if (A && !ok) { fails.push(msg); console.log('  FAIL ' + msg); } };
const row = (k, t, wx, extra = '') => `${k.padEnd(10)} ${String(t ?? '').padEnd(6)} ${wx.padEnd(4)} ${extra}`;

// ---- the arcade targets (Endurance reference, research/handling-comparison.md): tap / hold / release / brake / handbrake drift
const lim = (tier, rookie, pro) => (tier === 'pro' ? pro : rookie);
function tapRun(key, tier, wx, kmh = 135) {                     // 250 ms of D on the straight: peak slip over 1.5 s
  const s = run(key, tier, wx, kmh, (t, v) => ({ throttle: holdThrottle(v, kmh), steer: t >= 0.2 && t < 0.45 ? -1 : 0 }), 1.7);
  return done(s, { beta: D(s.peakBeta), head: Math.abs(D(s.yaw)) });
}
function holdRun(key, tier, wx, kmh = 120) {                    // hold D: yaw steadiness, lateral g, slip, and release behaviour
  const s = run(key, tier, wx, kmh, (t, v) => ({ throttle: holdThrottle(v, kmh), steer: t < 4 ? -1 : 0 }), 4.8), w = win(s.hist, 1.5, 4), r = w.map((x) => Math.abs(x.r)), my = mean(r);
  const rel = win(s.hist, 4, 4.8), peakAfter = Math.max(...rel.filter((x) => x.t > 4.25).map((x) => Math.abs(x.r)));
  return done(s, { yaw: D(my), dev: (Math.max(...r) - Math.min(...r)) / my, g: mean(w.map((x) => x.g)), beta: D(Math.max(...w.map((x) => Math.abs(x.beta)))), kmh1: w[w.length - 1].kmh, decay: peakAfter / my, flip: rel.some((x) => x.t > 4.1 && x.r * Math.sign(w[0].r) < -0.05 * my), spun: s.peakBeta > SPIN });
}
function brakeRun(key, tier, wx) {                              // S held from 205 km/h: time to 120 km/h
  let t120 = NaN; const s = run(key, tier, wx, 205, () => ({ brake: 1 }), 3, { onStep: (v, s) => { if (Number.isNaN(t120) && v.speed * 3.6 <= 120) t120 = s.t; } });
  return done(s, { t120, g: (205 - 120) / 3.6 / t120 / 9.81 });
}
function driftRun(key, tier, wx, kmh = 150) {                   // handbrake + D at speed, throttle held; then released
  let t0 = NaN, k0 = NaN, k15 = NaN;
  const s = run(key, tier, wx, kmh, (t, v) => ({ throttle: t < 2.6 ? 1 : 0, steer: t < 2.6 ? -1 : 0, handbrake: t >= 0.2 && t < 2.2 ? 1 : 0 }), 4.6, { onStep: (v, s) => { if (Number.isNaN(t0) && v.state.drift > 0.5) { t0 = s.t; k0 = v.speed * 3.6; } if (!Number.isNaN(t0) && Number.isNaN(k15) && s.t >= t0 + 1.5) k15 = v.speed * 3.6; } });
  const w = win(s.hist, 1.2, 2.2), end = s.hist[s.hist.length - 1];
  return done(s, { beta: D(mean(w.map((x) => Math.abs(x.beta)))), betaMin: D(Math.min(...w.map((x) => Math.abs(x.beta)))), betaMax: D(Math.max(...w.map((x) => Math.abs(x.beta)))), yaw: D(mean(w.map((x) => Math.abs(x.r)))), loss: 1 - k15 / k0, end: D(Math.abs(end.beta)), spun: s.peakBeta > 1.2 });
}
if (only.includes('arcade')) {
  console.log('arcade targets: tap 250 ms @135 peak slip / hold D @120 yaw deg/s, deviation, lateral g, slip, yaw 0.25 s after release (share of steady) / brake 205->120 s, g / handbrake drift @150: slip range, yaw, speed loss in 1.5 s, slip 2.4 s after release');
  for (const k of cars) for (const t of tiers) for (const wx of wxs) {
    const tp = tapRun(k, t, wx), h = holdRun(k, t, wx), b = brakeRun(k, t, wx), d = driftRun(k, t, wx);
    console.log(row(k, t, wx, '| ') + `tap b${f(tp.beta)}° | hold yaw${f(h.yaw, 0)} dev${f(h.dev * 100, 0)}% ${f(h.g, 2)}g b${f(h.beta)}° rel${f(h.decay, 2)}${h.flip ? ' FLIP' : ''}${h.spun ? ' SPIN' : ''} | brake ${f(b.t120, 2)}s ${f(b.g, 2)}g | drift b${f(d.betaMin, 0)}-${f(d.betaMax, 0)}° yaw${f(d.yaw, 0)} loss${f(d.loss * 100, 0)}% end${f(d.end)}°${d.spun ? ' SPIN' : ''}`);
    if (A) {
      const dry = wx === 'dry', gLo = dry ? lim(t, 2.7, 2.4) : 2.0, gHi = dry ? lim(t, 3.5, 3.2) : 2.9;
      check(tp.beta <= lim(t, 1.5, 3), `${k}/${t}/${wx}: a 250 ms tap leaves ${f(tp.beta)}° of slip`);
      check(h.g >= gLo && h.g <= gHi, `${k}/${t}/${wx}: holding D corners at ${f(h.g, 2)} g (${gLo}-${gHi})`);
      check(h.dev <= 0.1, `${k}/${t}/${wx}: held-D yaw varies ${f(h.dev * 100, 0)}%`); check(h.beta <= lim(t, 2.5, 4.5), `${k}/${t}/${wx}: held-D slip ${f(h.beta)}°`);
      check(h.decay <= 0.2 && !h.flip && !h.spun, `${k}/${t}/${wx}: yaw after release ${f(h.decay, 2)} of steady / overshoot ${h.flip}`);
      if (dry) { check(b.t120 >= 1.1 && b.t120 <= 1.6, `${k}/${t}/${wx}: 205->120 km/h took ${f(b.t120, 2)} s`); check(d.betaMin >= 28 && d.betaMax <= 58, `${k}/${t}/${wx}: drift angle ${f(d.betaMin, 0)}-${f(d.betaMax, 0)}°`); check(d.yaw >= lim(t, 25, 22), `${k}/${t}/${wx}: drift path yaw ${f(d.yaw, 0)} deg/s`); check(d.loss <= 0.15, `${k}/${t}/${wx}: drift speed loss ${f(d.loss * 100, 0)}%`); check(d.end < 6 && !d.spun, `${k}/${t}/${wx}: drift does not straighten (${f(d.end)}°)`); }
    }
    if (A && wx === 'dry') {   // a held key still turns decisively: time to 90% of the steady yaw, and no cliff in the tap heading between 110 and 150
      [[120, 0.2], [135, 0.36], [160, 0.45], [200, 0.5]].forEach(([kmh, cap]) => { const ti = turnIn(k, t, 'dry', kmh, false); check(ti.t90 <= cap, `${k}/${t}: held key reaches 90% yaw in ${f(ti.t90, 2)} s at ${kmh} km/h (max ${cap})`); });
      const hs = [110, 120, 127, 135, 150].map((kmh) => tapRun(k, t, 'dry', kmh).head); hs.forEach((h, i) => { if (i) check(h <= hs[i - 1] + 0.2 && h >= 0.45 * hs[i - 1], `${k}/${t}: tap heading cliff ${hs.map((x) => f(x, 1)).join('/')} at 110/120/127/135/150 km/h`); });
    }
    if (A && wx === 'dry') { const base = { rookie: [155, 108, 73, 66, 55], pro: [149, 98, 66, 60, 50] }[t]; if (k === 'av12') [40, 60, 90, 100, 120].forEach((kmh, i) => { const y = D(steady(k, t, 'dry', kmh, { secs: 4 }).yaw); check(Math.abs(y / base[i] - 1) <= (kmh === 120 ? 0.05 : 0.03), `${k}/${t}: rotation at ${kmh} km/h is ${f(y, 0)} deg/s, expected ${base[i]} (40-100 must not change, 120 only by a mild fade)`); }); }
    const t135 = tapRun(k, t, wx, 135), t180 = tapRun(k, t, wx, 180);   // Endurance e1: a 250 ms tap on the straight is a small nudge: 4 deg at 135 km/h and 2 at 180 (Rookie; was 11 and 5 before the steering eased from 100 km/h)
    console.log(`   tap 250 ms: 135 km/h heading ${f(t135.head)}° slip ${f(t135.beta)}° | 180 km/h heading ${f(t180.head)}° slip ${f(t180.beta)}°`);
    if (A) { check(t135.head <= 4.6 && t135.head >= 2.5 && t135.beta <= 1.5, `${k}/${t}/${wx}: tap at 135 turns ${f(t135.head)}° (slip ${f(t135.beta)}°)`); check(t180.head <= 3 && t180.head >= 1.2 && t180.head <= 0.7 * t135.head && t180.beta <= 1.5, `${k}/${t}/${wx}: tap at 180 turns ${f(t180.head)}° (slip ${f(t180.beta)}°)`); }
    const hf = holdRun(k, t, wx, 240), tf = tapRun(k, t, wx, 240);   // 240 km/h: no weave, no spin, still turns
    console.log(`   240 km/h: hold yaw ${f(hf.yaw, 0)}°/s dev ${f(hf.dev * 100, 0)}% slip ${f(hf.beta)}° rel ${f(hf.decay, 2)} | tap slip ${f(tf.beta)}°`);
    if (A) { check(hf.dev <= 0.1 && !hf.spun && !hf.flip && hf.beta <= 3 && tf.beta <= 3 && hf.decay <= 0.3, `${k}/${t}/${wx}: 240 km/h weaves or slides (dev ${f(hf.dev * 100, 0)}%, slip ${f(hf.beta)}/${f(tf.beta)}°, release ${f(hf.decay, 2)})`); check(hf.yaw >= (wx === 'dry' ? 14 : 11), `${k}/${t}/${wx}: numb at 240 km/h (${f(hf.yaw, 0)} deg/s)`); }
    const ti = turnIn(k, t, wx, 120, false); console.log('   turn-in 63%: ' + f(ti.t63, 3) + ' s'); if (A && wx === 'dry') check(ti.t63 <= 0.12, `${k}/${t}/${wx}: turn-in 63% ${f(ti.t63, 3)} s`);
  }
}
if (only.includes('shape')) {
  console.log('held key: yaw (deg/s), t90, t63 (s) at 100/120/135/160/200; 250 ms tap heading deg / slip deg at 110/120/127/135/150/180');
  for (const k of cars) for (const t of tiers) {
    const o = [100, 120, 135, 160, 200].map((kmh) => { const r = steady(k, t, 'dry', kmh, { secs: 4 }), ti = turnIn(k, t, 'dry', kmh, false); return `${kmh}: ${f(D(r.yaw), 0)} t90 ${f(ti.t90, 2)} t63 ${f(ti.t63, 3)}`; }), tp = [110, 120, 127, 135, 150, 180].map((kmh) => { const a = tapRun(k, t, 'dry', kmh); return `${kmh}: ${f(a.head)}/${f(a.beta)}`; });
    console.log(row(k, t, 'dry', '| ') + o.join(' | ') + ' || tap ' + tp.join(' | '));
  }
}
if (only.includes('yawspeed')) {
  console.log('full-key yaw rate vs speed (deg/s, lateral g, lock deg at the speed, t90 s): key / pad');
  for (const k of cars) for (const t of tiers) for (const pad of [false, true]) {
    const out = [40, 60, 90, 120, 160, 200].map((kmh) => { const r = steady(k, t, 'dry', kmh, { pad, secs: 4 }), ti = turnIn(k, t, 'dry', kmh, pad); return `${kmh}: ${f(D(r.yaw), 0)}°/s ${f(r.g, 2)}g L${f(r.lock, 1)} t90 ${f(ti.t90, 2)}`; });
    console.log(row(k, t, 'dry', pad ? 'pad | ' : 'key | ') + out.join(' | '));
  }
}
if (only.includes('steady')) {
  console.log('full steer, speed held (key / pad): steady lateral g (% of the tyre limit; limit g @ best wheel angle) / yaw deg/s / beta / lock deg / countersteer deg / tc / stability rad/s2 / recovery m/s2');
  for (const k of cars) for (const t of tiers) for (const wx of wxs) for (const pad of [false, true]) {
    const rows = gripUsed(k, t, wx, pad);
    console.log(row(k, t, wx, pad ? 'pad |' : 'key |') + rows.map((r) => `${r.kmh}: ${f(r.g, 2)}g ${f(r.pct * 100, 0)}% (lim ${f(r.lim, 2)}@${f(r.limDeg, 1)}°) yaw${f(D(r.r.yaw), 0)} b${f(r.r.beta)} lock${f(r.r.lock, 1)} cs${f(r.r.counter, 1)} tc${f(r.r.tc, 2)} st${f(r.r.stab, 2)} rc${f(r.r.recov, 2)}${r.r.spun ? ' SPIN' : ''}`).join(' | '));
    if (A && !pad) rows.forEach((r) => { check(r.pct >= (r.kmh <= 60 ? 0.8 : r.kmh >= 150 ? 0.6 : 0.85), `${k}/${t}/${wx}: uses ${f(r.pct * 100, 0)}% of the grip at ${r.kmh} km/h`); check(!r.r.spun, `${k}/${t}/${wx}: spun holding full steer at ${r.kmh} km/h`); });
    if (A && pad) rows.forEach((r) => check(r.pct >= (r.kmh <= 60 ? 0.8 : r.kmh >= 150 ? 0.6 : 0.9), `${k}/${t}/${wx}/pad: uses ${f(r.pct * 100, 0)}% of the grip at ${r.kmh} km/h`));
  }
}
if (only.includes('turnin')) {
  console.log('turn-in: full steer pressed at t = 0 under a held speed; time to 63% / 90% of the steady yaw rate');
  for (const k of cars) for (const t of tiers) for (const wx of wxs) for (const pad of [false, true]) {
    const o = [100, 150].map((kmh) => ({ kmh, ...turnIn(k, t, wx, kmh, pad) }));
    console.log(row(k, t, wx, pad ? 'pad |' : 'key |') + o.map((x) => `${x.kmh}: 63% ${f(x.t63, 2)}s 90% ${f(x.t90, 2)}s`).join(' | '));
    if (A) { check(o[0].t63 <= (pad ? 0.2 : 0.25), `${k}/${t}/${wx}/${pad ? 'pad' : 'key'}: turn-in 63% at 100 km/h ${f(o[0].t63, 2)} s`); check(o[1].t63 <= (pad ? 0.25 : 0.5), `${k}/${t}/${wx}/${pad ? 'pad' : 'key'}: turn-in 63% at 150 km/h ${f(o[1].t63, 2)} s (keys ease from 100 km/h: .5 s max)`); }
  }
}
if (only.includes('ice')) {
  console.log('coast with full steer held at 120 km/h, and a flick at 150: peak slide / slide at the end / lateral g');
  for (const k of cars) for (const t of tiers) for (const wx of wxs) {
    const r = ice(k, t, wx); console.log(row(k, t, wx, '| ') + `120: beta ${f(r.b120)}° (end ${f(r.end120)}°) lat ${f(r.lat, 2)}g | 150 flick: beta ${f(r.b150)}°`);
    if (A) { const cap = { rookie: 4, pro: 6 }[t];   // arcade alignment: coasting on full lock slides only a degree or two (was 14-22 on the raw tyres)
     check(r.b120 <= cap && r.b150 <= cap + 4, `${k}/${t}/${wx}: ice slide ${f(r.b120)} / ${f(r.b150)} (max ${cap})`); }
  }
}
if (only.includes('lift')) {
  console.log('lift-off: full lock under throttle to 2 s, then lifted. slide before -> peak after, yaw rate after vs before');
  for (const k of cars) for (const wx of wxs) for (const kmh of [100, 150]) {
    const rs = ['raw', ...tiers].map((t) => lift(k, t, wx, kmh));
    console.log(row(k, '', wx, `${kmh} | `) + ['raw', ...tiers].map((t, i) => `${t} ${f(rs[i].beta0)}->${f(rs[i].beta)}° gain${f(rs[i].gain, 2)}${rs[i].spun ? ' SPIN' : ''}`).join(' | '));
    if (A) tiers.forEach((t, i) => { const r = rs[i + 1]; check(!r.spun && r.beta <= 6, `${k}/${t}/${wx}/${kmh}: lift slide ${f(r.beta)}°`); });
  }
}
if (only.includes('trail')) {
  console.log('trail braking: 150 km/h, brake held into a full-lock turn: heading / peak beta / peak lat g / exit speed');
  for (const k of cars) for (const wx of wxs) {
    const rs = ['raw', ...tiers].map((t) => trail(k, t, wx));
    console.log(row(k, '', wx, '| ') + ['raw', ...tiers].map((t, i) => `${t} ${f(rs[i].head, 0)}° b${f(rs[i].beta)}° ${f(rs[i].lat, 2)}g ${f(rs[i].kmh, 0)}km/h`).join(' | '));
    if (A) tiers.forEach((t, i) => { const r = rs[i + 1]; check(!r.spun && r.beta <= 8, `${k}/${t}/${wx}: trail slide ${f(r.beta)}°`); check(r.head >= 30, `${k}/${t}/${wx}: braking into a full-lock turn must still steer (heading ${f(r.head, 0)}°)`); });
  }
}
if (only.includes('rwd')) {
  console.log('power on: full lock + full throttle from 40 / 70 km/h: peak beta / beta at 3 s / heading');
  for (const k of cars) for (const wx of wxs) for (const kmh of [40, 70]) {
    const rs = ['raw', ...tiers].map((t) => powerOn(k, t, wx, kmh));
    console.log(row(k, '', wx, `${kmh} | `) + ['raw', ...tiers].map((t, i) => `${t} b${f(rs[i].beta)}° now${f(rs[i].now)}° +${f(rs[i].head, 0)}°${rs[i].spun ? ' SPIN' : ''}`).join(' | '));
    if (A && kmh === 40) { const [, r, p] = rs; check(!r.spun && !p.spun && p.beta >= r.beta, `${k}/${wx}: power-on at 40 km/h must stay put, Pro looser than Rookie (rookie ${f(r.beta)}, pro ${f(p.beta)})`); }   // arcade alignment: no power oversteer to scale any more
  }
}
if (only.includes('handbrake')) {
  console.log('handbrake turn at 60 km/h: full lock + handbrake .7 s, then wheel centred: heading / speed at the release, heading at 2.5 s, peak beta');
  for (const k of cars) for (const wx of wxs) {
    const rs = tiers.map((t) => handbrake(k, t, wx));
    console.log(row(k, '', wx, '| ') + tiers.map((t, i) => `${t} ${f(rs[i].at, 0)}° ${f(rs[i].kmhAt, 0)}km/h -> ${f(rs[i].end, 0)}° b${f(rs[i].beta, 0)}°`).join(' | '));
    if (A) tiers.forEach((t, i) => { check(rs[i].at >= 75 && rs[i].end >= 60 && rs[i].end <= 200, `${k}/${t}/${wx}: handbrake turn ${f(rs[i].at, 0)}° at the release, ${f(rs[i].end, 0)}° after`); check(rs[i].kmhAt >= 51, `${k}/${t}/${wx}: handbrake turn lost too much speed (${f(rs[i].kmhAt, 0)} km/h at the release, max 15% of 60)`); });
  }
}
if (only.includes('slalom')) {
  console.log('direction change at 100 km/h: full left held 2 s then full right: time for the yaw rate to reach 63% of the opposite steady value / peak beta / lat g');
  for (const k of cars) for (const wx of wxs) for (const pad of [false, true]) {
    const rs = tiers.map((t) => slalom(k, t, wx, pad));
    console.log(row(k, '', wx, (pad ? 'pad' : 'key') + ' | ') + rs.map((r, i) => `${tiers[i]} ${f(r.t63, 2)}s b${f(r.beta)}° ${f(r.lat, 2)}g${r.spun ? ' SPIN' : ''}`).join(' | '));
    if (A) rs.forEach((r, i) => { check(r.t63 <= (pad ? 0.4 : 0.5), `${k}/${tiers[i]}/${wx}/${pad ? 'pad' : 'key'}: direction change ${f(r.t63, 2)} s`); check(!r.spun, `${k}/${tiers[i]}/${wx}/${pad ? 'pad' : 'key'}: spun in the direction change`); });
  }
}
if (only.includes('abuse')) {
  console.log('a driver\'s mistakes, keys held to the end / let go at 1.2 s: peak beta   [spin = past 46 deg]');
  console.log('   columns: ' + Object.keys(ABUSE).join(' | '));
  for (const k of cars) for (const t of tiers) for (const wx of wxs) {
    const out = Object.entries(ABUSE).map(([n, a]) => { const h = abuse(k, t, wx, a, true), r = abuse(k, t, wx, a, false); if (A && t !== 'pro') { check(!h.spun, `${k}/${t}/${wx}: "${n}" spins with the keys held`); check(!r.spun && r.end < 6, `${k}/${t}/${wx}: "${n}" is not caught after letting go (end ${f(r.end)}°)`); } return `${h.spun ? 'SPIN' : f(h.peak, 0) + '°'}/${r.spun ? 'SPIN' : f(r.peak, 0) + '°'}`; });
    console.log(row(k, t, wx, '| ') + out.join(' | '));
  }
}
if (only.includes('hairpin')) {
  console.log('highest steady speed (km/h) round a 180-degree arc of radius 15 / 30 / 60 m within 4 m of the line: the AI law vs the same law pressed on keys');
  for (const k of cars) for (const wx of wxs) {
    const ai = [15, 30, 60].map((R) => maxCornerSpeed(k, 'rookie', wx, R, 'ai')), keys = tiers.map((t) => [15, 30, 60].map((R) => maxCornerSpeed(k, t, wx, R, 'key')));
    console.log(row(k, '', wx, '| ') + `ai ${ai.map((x) => f(x, 0)).join(' / ')} | ` + tiers.map((t, i) => `${t} keys ${keys[i].map((x) => f(x, 0)).join(' / ')}`).join(' | '));
    if (A) tiers.forEach((t, i) => keys[i].forEach((x, j) => check(x >= (t === 'pro' ? 0.9 * ai[j] : ai[j]) - 4, `${k}/${t}/${wx}: keys take the R${[15, 30, 60][j]} arc at ${f(x, 0)} km/h, the AI at ${f(ai[j], 0)}`)));
  }
}
if (only.includes('aids')) {                                   // the HUD's TCS / ABS / ESC tags: vehicle.state.tcsActive / absActive / escActive (0..1)
  console.log('aids published on vehicle.state (max over the run): a normal corner / a slam of the brakes with full steer / a held-lock spin on the throttle / a long coast slide');
  for (const k of cars) for (const t of tiers.filter((x) => x !== 'raw')) for (const wx of wxs) {
    const peak = (s) => ({ tcs: Math.max(...s.hist.map((x) => x.tcsActive ?? 0)), abs: Math.max(...s.hist.map((x) => x.absActive ?? 0)), esc: Math.max(...s.hist.map((x) => x.escActive ?? 0)) });
    const a = run(k, t, wx, 100, (tt, v) => ({ throttle: holdThrottle(v, 100), steer: 0.5 }), 4), b = run(k, t, wx, 160, () => ({ brake: 1, steer: 1 }), 3), c = run(k, t, wx, 50, () => ({ throttle: 1, steer: 1, handbrake: 0 }), 3.5), d = run(k, t, wx, 150, (tt) => ({ steer: tt < 0.3 ? 0 : 1 }), 5);
    const pa = peak(a), pb = peak(b), pc = peak(c), pd = peak(d);
    console.log(row(k, t, wx, '| ') + [pa, pb, pc, pd].map((p) => `tcs${f(p.tcs, 2)} abs${f(p.abs, 2)} esc${f(p.esc, 2)}`).join(' | '));
    check((pa.tcs < 0.05 || (t === 'casual' && wx !== 'dry')) && pa.esc < 0.05,   // Casual's full traction control may trim an EV's throttle in the wet
       `${k}/${t}/${wx}: an aid shows in an ordinary corner (tcs ${f(pa.tcs, 2)}, esc ${f(pa.esc, 2)})`);
    check(pb.abs > 0.02 || t === 'pro', `${k}/${t}/${wx}: ABS never shows under full brake + steer`);
    check(pd.esc > 0.05 || t !== 'casual', `${k}/${t}/${wx}: ESC never shows in a long slide (${f(pd.esc, 2)})`);   // Sport and Pro let a slide under their angle go on
    check([pa, pb, pc, pd].every((p) => [p.tcs, p.abs, p.esc].every((x) => x >= 0 && x <= 1)), `${k}/${t}/${wx}: an aid value left 0..1`);
    for (const x of [a, b, c, d]) drop(x.v);
  }
}
if (only.includes('bench')) {                                   // one line per car and tier, dry: the numbers a tuning pass moves
  console.log('bench (dry): min grip used key/pad | turn-in 100 | ice 120/flick 150 | lift 120 beta0->peak gain | trail beta | power-on 50 beta | handbrake heading@release km/h -> end | slalom t63');
  for (const k of cars) for (const t of tiers) {
    const wx = 'dry', gk = gripUsed(k, t, wx, false), gp = gripUsed(k, t, wx, true), ti = turnIn(k, t, wx, 100, false), ic = ice(k, t, wx), li = lift(k, t, wx, 120), tr = trail(k, t, wx), po = powerOn(k, t, wx, 50), hb = handbrake(k, t, wx), sl = slalom(k, t, wx, false), fl = flick(k, t, wx), flr = flick(k, t, 'rain'), ab = Object.values(ABUSE).map((a) => abuse(k, t, wx, a, true)), abr = Object.values(ABUSE).map((a) => abuse(k, t, wx, a, false));
    console.log(row(k, t, wx, '| ') + `grip ${f(Math.min(...gk.map((x) => x.pct)) * 100, 0)}/${f(Math.min(...gp.map((x) => x.pct)) * 100, 0)}% | in ${f(ti.t63, 2)}s | ice ${f(ic.b120)}/${f(ic.b150)}° | lift ${f(li.beta0)}->${f(li.beta)}° x${f(li.gain, 2)} | trail b${f(tr.beta)}° | pwr ${f(po.beta)}° | hb ${f(hb.at, 0)}° ${f(hb.kmhAt, 0)}km/h->${f(hb.end, 0)}° | slalom ${f(sl.t63, 2)}s | flick115 dry b${f(fl.beta)}° yaw${f(fl.yaw, 0)} rain b${f(flr.beta)}° yaw${f(flr.yaw, 0)} | abuse max ${f(Math.max(...ab.map((x) => x.peak)), 0)}° (let go: end ${f(Math.max(...abr.map((x) => x.end)), 0)}°)`);
  }
}
await server.close();
if (fails.length) { console.log(fails.length + ' check(s) failed'); process.exit(1); }
if (A) console.log('PASS: turning checks');
process.exit(0);
