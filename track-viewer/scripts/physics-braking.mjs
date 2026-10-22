// Brake + steer + reverse measurements (permanent checks for the driving model, research/driving-model.md).
//   node scripts/physics-braking.mjs [--cars av12,mustang,bentley-gt,tesla1] [--tiers rookie,pro] [--wx dry,rain,damp]
//        [--only table,reverse,ice,trail,slalom,assert]       `assert` turns the printed rows into pass/fail (exit 1)
// Drives the real Vehicle on a flat world with the game's keyboard filters (player-controls.js).
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
const PC = await L('/src/physics/player-controls.js');
const keyboardBrake = PC.keyboardBrake ?? ((c, w) => w);            // Stage B adds the ramp
const keyboardSteer = PC.keyboardSteer;
const TIER = { rookie: { counter: 0.45, stability: 1.25, tcs: 0.8 }, pro: { counter: 0.1, stability: 0.35, tcs: 0 } };
const WET = { dry: 0.15, damp: 0.7, rain: 1 };
const D = THREE.MathUtils.radToDeg;
const world = await PhysicsWorld.flat(3000);
const profile = (key) => { const m = new URL(`../../assets/cars/${key}/model.json`, import.meta.url); return { wheels: JSON.parse(readFileSync(existsSync(m) ? m : new URL(`../../car-lab/src/vehicle/profiles/${key}.json`, import.meta.url), 'utf8')).wheels }; };
const TUNE = JSON.parse(arg('tune', '{}'));                      // --tune '{"brakeShift":0.3}': driving.json overrides for an experiment
const tuned = (key) => { const s = handling(key); Object.assign(s.arcade, TUNE); return s; };
const mk = (key) => { const v = new Vehicle(world, tuned(key), profile(key), { pos: new THREE.Vector3(), yaw: 0 }); for (let i = 0; i < 100; i++) { v.step(STEP, TIER.rookie); world.world.step(); } return v; };
const drop = (v) => world.world.removeRigidBody(v.rb);
const f = (x, n = 1) => x.toFixed(n);
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

/** a keyboard-driver scenario. script(t, v, s) returns the keys held ({brake, steer, throttle}, 0/1/-1); the sim applies the game's filters. */
function run(key, tier, wx, kmh, script, secs, { onStep, pad = false } = {}) {
  setWeather(WET[wx]); const v = mk(key); v.rb.setLinvel({ x: kmh / 3.6, y: 0, z: 0 }, true);
  const s = { steer: 0, brake: 0, t: 0, yaw: 0, dist: 0, peakBeta: 0, peakLat: 0, stopT: null, ratio: [] };
  for (; s.t < secs; s.t += STEP) {
    const k = script(s.t, v, s);
    // keyboard: ramped steer and brake; pad: the stick/trigger value goes straight in (speed-sensitive lock only)
    s.steer = pad ? (k.steer ?? 0) * PC.steerScale(v.speed) : keyboardSteer(s.steer, k.steer ?? 0, STEP, v.speed, (s.hold ??= { t: 0, dir: 0 })); s.brake = pad ? (k.brake ?? 0) : keyboardBrake(s.brake, k.brake ?? 0, STEP);
    Object.assign(v.controls, { throttle: k.throttle ?? 0, brake: s.brake, steer: s.steer, handbrake: 0, nitro: 0 });
    const x0 = v.cur.pos.x, z0 = v.cur.pos.z; v.step(STEP, TIER[tier]); world.world.step();
    const r = v.rb.angvel().y; s.yaw += r * STEP; s.dist += Math.hypot(v.cur.pos.x - x0, v.cur.pos.z - z0);
    s.peakBeta = Math.max(s.peakBeta, Math.abs(v.state.beta)); s.peakLat = Math.max(s.peakLat, Math.abs(v.rb.angvel().y * v.speed) / 9.81);
    if (v.vForward > 3 && Math.abs(v.state.steer) > 0.02) { const kin = v.vForward * Math.tan(v.state.steer) / v.wheelbase; if (Math.abs(kin) > 0.1) s.ratio.push(Math.abs(r) / Math.abs(kin)); }
    if (s.stopT === null && v.speed < 0.3) s.stopT = s.t;
    onStep?.(v, s);
  }
  s.v = v; return s;
}

/** full S + steer from speed until the stop */
function atStop(key, tier, wx, kmh, steer) {
  let rec = null;
  const s = run(key, tier, wx, kmh, () => ({ brake: 1, steer }), 14, { onStep: (v, s) => { if (!rec && v.speed < 0.5) rec = { head: Math.abs(D(s.yaw)), dist: s.dist, t: s.t, beta: s.peakBeta, ratio: mean(s.ratio), lat: s.peakLat }; } });
  drop(s.v); return rec ?? { head: NaN, dist: NaN, t: NaN, beta: s.peakBeta, ratio: 0, lat: 0 };
}
/** hold S + full A from kmh straight through the stop into reverse (a keyboard player holding both keys) */
function reverseHold(key, tier, wx, kmh, secs = 7) {
  let engT = null, slowT = null, noCounter = true, peakYaw = 0, peakLat = 0, peakKmh = 0;
  const s = run(key, tier, wx, kmh, () => ({ brake: 1, steer: 1 }), secs, { onStep: (v, s) => {
    if (engT === null && v.state.driveInput < 0) engT = s.t;
    if (slowT === null && v.vForward < 0.35) slowT = s.t;   // pedals.js counts the dwell from forward speed < .35 m/s (the arcade brake's last creep made the old speed < .3 stamp late)
    if (v.vForward < -1) { noCounter &&= v.state.beta === 0 && Math.abs(v.state.steer - v.state.steerInput) < 0.06; peakYaw = Math.max(peakYaw, Math.abs(v.rb.angvel().y)); peakLat = Math.max(peakLat, Math.abs(v.rb.angvel().y * v.speed) / 9.81); peakKmh = Math.max(peakKmh, -v.vForward * 3.6); }
  } });
  const out = { stopT: s.stopT, engT, dwell: engT != null && slowT != null ? engT - slowT : NaN, head: Math.abs(D(s.yaw)), noCounter, revYaw: D(peakYaw), revLat: peakLat, revKmh: peakKmh };
  drop(s.v); return out;
}
/** "ice" regression: lift + full steer at 120 km/h */
function ice(key, tier, wx) { const s = run(key, tier, wx, 120, () => ({ steer: 1 }), 4); const r = { beta: D(s.peakBeta), lat: s.peakLat }; drop(s.v); return r; }
/** corner entry at 110: brake hard, steer in after .5 s with the brake still on until 1.5 s, off over .4 s, then 30% throttle */
function trail(key, tier, wx) {
  let rec = null;   // snapshot when the brake is off: heading turned, peak beta, speed left
  const s = run(key, tier, wx, 110, (t) => ({ brake: t < 1.5 ? 1 : Math.max(0, 1 - (t - 1.5) / 0.4), steer: t < 0.5 ? 0 : 1, throttle: t >= 1.9 ? 0.3 : 0 }), 4, { onStep: (v, s) => { if (!rec && s.t >= 1.9) rec = { head: Math.abs(D(s.yaw)), beta: D(s.peakBeta), kmh: v.speed * 3.6, lat: s.peakLat }; } });
  drop(s.v); return rec;
}
/** 100 km/h lane change on keys: left, right, centre; lateral offset reached, peak beta */
function slalom(key, tier, wx, pad = false) {
  let maxY = 0, minY = 0;
  const s = run(key, tier, wx, 100, (t) => ({ steer: t < 0.7 ? 1 : t < 1.6 ? -1 : t < 2.2 ? 1 : 0 }), 5, { pad, onStep: (v) => { maxY = Math.max(maxY, -v.cur.pos.z); minY = Math.min(minY, -v.cur.pos.z); } });
  const r = { offset: maxY - minY, beta: D(s.peakBeta), lat: s.peakLat, spun: s.peakBeta > 1 }; drop(s.v); return r;
}

const cars = arg('cars', 'av12,mustang,bentley-gt,tesla1').split(','), tiers = arg('tiers', 'rookie,pro').split(','), wxs = arg('wx', 'dry,rain').split(','), only = arg('only', 'unit,table,reverse,ice,trail,slalom,assert').split(',');
const A = only.includes('assert'), fails = [];
const check = (ok, msg) => { if (A && !ok) { fails.push(msg); console.log('  FAIL ' + msg); } };
if (only.includes('table')) {
  console.log('brake + full steer from 60/120/200 km/h: heading at the stop / stop distance / yaw ratio r/r_kin / peak beta   [straight 100-0]');
  for (const k of cars) for (const t of tiers) for (const wx of wxs) {
    const rs = [60, 120, 200].map((kmh) => atStop(k, t, wx, kmh, 1)), st = atStop(k, t, wx, 100, 0);
    console.log(`${k.padEnd(10)} ${t.padEnd(6)} ${wx.padEnd(4)} | ` + rs.map((r, i) => `${[60, 120, 200][i]}: ${f(r.head, 0).padStart(3)}° ${f(r.dist, 0).padStart(3)}m r${f(r.ratio, 2)} b${f(D(r.beta), 1)}`).join(' | ') + ` | 100-0 ${f(st.dist, 1)}m`);
    rs.forEach((r, i) => { check(D(r.beta) < (t === 'pro' ? 16 : 14.5), `${k}/${t}/${wx}: peak beta ${f(D(r.beta))} braking from ${[60, 120, 200][i]}`); check(Number.isFinite(r.head), `${k}/${t}/${wx}: never stopped from ${[60, 120, 200][i]}`); });
    if (t !== 'pro') check(rs[0].head >= 22, `${k}/${t}/${wx}: heading from 60 ${f(rs[0].head, 0)} < 22`);
  }
}
if (only.includes('reverse')) {
  console.log('hold S + full A from 60 km/h through the stop: stop time / reverse engages after / heading / reverse yaw, lat g, km/h / no countersteer');
  for (const k of cars) for (const t of tiers) for (const wx of wxs) {
    const r = reverseHold(k, t, wx, 60); console.log(`${k.padEnd(10)} ${t.padEnd(6)} ${wx.padEnd(4)} | stop ${f(r.stopT, 2)} dwell ${f(r.dwell, 2)}s head ${f(r.head, 0)}° | rev yaw ${f(r.revYaw, 0)}°/s ${f(r.revLat, 2)}g ${f(r.revKmh, 0)}km/h | ${r.noCounter}`);
    check(r.dwell >= 0.25, `${k}/${t}/${wx}: reverse dwell ${f(r.dwell, 2)} s`); check(r.noCounter, `${k}/${t}/${wx}: countersteer fired in reverse`); check(r.revLat < 0.7, `${k}/${t}/${wx}: reversing at ${f(r.revLat, 2)} g`);
  }
}
if (only.includes('ice')) {
  console.log('ice check, lift + full steer at 120 km/h: peak beta / lat g');
  for (const k of cars) for (const t of tiers) for (const wx of wxs) { const r = ice(k, t, wx); console.log(`${k.padEnd(10)} ${t.padEnd(6)} ${wx.padEnd(4)} | beta ${f(r.beta)}° lat ${f(r.lat, 2)}g`); check(r.beta < (t === 'pro' ? 19.5 : 14.5), `${k}/${t}/${wx}: ice slide ${f(r.beta)}`); }   // < 14.5: the rear-biased RWD hypercars slide a little more than the rest (physics-turning.mjs caps Sport at 14)
}
if (only.includes('trail')) {
  console.log('corner entry at 110 (brake held into a full-lock turn): heading turned by the time the brake is off / peak beta / peak lat g / speed left');
  for (const k of cars) for (const wx of wxs) { const rs = tiers.map((t) => trail(k, t, wx)); console.log(`${k.padEnd(10)} ${wx.padEnd(4)} | ` + rs.map((r, i) => `${tiers[i]} ${f(r.head, 0)}° b${f(r.beta)}° ${f(r.lat, 2)}g ${f(r.kmh, 0)}`).join(' | ')); if (tiers.includes('casual') && tiers.includes('pro')) { const c = rs[tiers.indexOf('casual')], p = rs[tiers.indexOf('pro')]; check(c.head - p.head >= 2 && c.lat - p.lat >= 0.1, `${k}/${wx}: Casual and Pro corner entry must differ (heading ${f(c.head - p.head)} deg, ${f(c.lat - p.lat, 2)} g)`); }; rs.forEach((r, i) => check(r.beta < 12, `${k}/${tiers[i]}/${wx}: trail brake beta ${f(r.beta)}`)); }
}
if (only.includes('slalom')) {
  console.log('lane change at 100 km/h on keys: lateral offset / peak beta / lat g');
  for (const k of cars) for (const wx of wxs) for (const pad of [false, true]) { const rs = tiers.map((t) => slalom(k, t, wx, pad)); console.log(`${k.padEnd(10)} ${wx.padEnd(4)} ${pad ? 'pad' : 'key'} | ` + rs.map((r, i) => `${tiers[i]} ${f(r.offset, 1)}m b${f(r.beta)}° ${f(r.lat, 2)}g${r.spun ? ' SPIN' : ''}`).join(' | ')); rs.forEach((r, i) => check(!r.spun, `${k}/${tiers[i]}/${wx}/${pad ? 'pad' : 'key'}: spun in the lane change`)); }
}
if (only.includes('unit')) {                                     // input shaping contracts
  const ok = (c, m) => { if (!c) { fails.push(m); console.log('  FAIL ' + m); } };
  const ramp = (fn, dt, secs, ...a) => { let c = 0; for (let i = 0; i < secs / dt; i++) c = fn(c, 1, dt, ...a); return c; };
  ok(Math.abs(ramp(keyboardBrake, 1 / 60, 0.1) - ramp(keyboardBrake, 1 / 240, 0.1)) < 1e-6 && Math.abs(ramp(keyboardBrake, 1 / 60, 0.12) - 1) < 1e-6, 'keyboard brake rises in .12 s at any frame rate');
  ok(keyboardBrake(1, 0, 0.03) > 0.4 && keyboardBrake(1, 0, 0.06) === 0, 'keyboard brake releases in .06 s');
  ok(ramp(keyboardSteer, 1 / 120, 0.11, 27) >= 0.95, 'keyboard steering reaches 95% of the lock in .11 s up to 100 km/h (instant turn-in)');
  const held = (speed, secs) => { const h = { t: 0, dir: 0 }; let c = 0; for (let i = 0; i < secs * 120; i++) c = keyboardSteer(c, 1, 1 / 120, speed, h); return c; };
  ok(held(40, 0.25) < 0.7 * PC.steerScale(40) && held(40, 0.6) > 0.9 * PC.steerScale(40), 'above 135 km/h a press starts slow (a tap is a nudge) and a held key catches up (hold-accelerating ramp)');
  ok(held(27, 0.11) >= 0.95, 'to 100 km/h the hold ramp is the plain fast one');
  ok(PC.steerScale(0) === 1 && PC.steerScale(25) === 1 && PC.steerScale(55) < 0.95 && PC.steerScale(80) >= 0.88 - 1e-9, 'lock scale: full when slow, never below .88 (the lock itself follows the grip, arcade.js steeringLock)');
  ok(keyboardSteer(1, 0, 0.25, 60) < 0.05 && keyboardSteer(1, 0, 0.25, 0) < 0.01, 'return to centre stays quick at speed (<5% left .25 s after key-up at 216 km/h; the ramp-in is what eases off, not the release)');
  console.log('input shaping contracts checked');
}
await server.close();
if (fails.length) { console.log(fails.length + ' check(s) failed'); process.exit(1); }
if (A) console.log('PASS: brake+steer, reverse, ice, trail, slalom checks');
process.exit(0);
