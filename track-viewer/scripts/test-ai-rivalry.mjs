// The career's rival profiles in AIDriver.read (driver.js), no browser: a stub field on a stadium oval, cars moved by a kinematic stub.
//   node scripts/test-ai-rivalry.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { AIDriver, mistakeOf } from '../src/physics/driver.js';
import TUNING from '../../assets/career/tuning.json' with { type: 'json' };

// two 600 m straights joined by 60 m half circles, 600 line samples (about 2.6 m apart), anticlockwise from above
const R = 60, S = 600, LEN = 2 * S + 2 * Math.PI * R, N = 600;
function at(s) {
  s = ((s % LEN) + LEN) % LEN;
  if (s < S) return { x: s, z: 0, a: 0 };
  if (s < S + Math.PI * R) { const a = (s - S) / R; return { x: S + R * Math.sin(a), z: -R + R * Math.cos(a), a }; }
  if (s < 2 * S + Math.PI * R) return { x: S - (s - S - Math.PI * R), z: -2 * R, a: Math.PI };
  const a = Math.PI + (s - 2 * S - Math.PI * R) / R; return { x: R * Math.sin(a), z: -R + R * Math.cos(a), a };
}
const linePts = [], lineLeft = [], vt = [];
for (let i = 0; i < N; i++) { const q = at(i / N * LEN); linePts.push(new THREE.Vector3(q.x, 0, q.z)); lineLeft.push(new THREE.Vector3(-Math.sin(q.a), 0, -Math.cos(q.a))); }
for (let i = 0; i < N; i++) { const s = i / N * LEN; vt[i] = s >= S && s < S + Math.PI * R || s >= 2 * S + Math.PI * R ? Math.sqrt(9 * R) : 70; }
for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) vt[i] = Math.min(vt[i], Math.sqrt(vt[(i + 1) % N] ** 2 + 2 * 12 * LEN / N));   // braking zones
const posAt = (s, lat) => { const q = at(s); return new THREE.Vector3(q.x - Math.sin(q.a) * lat, 0, q.z - Math.cos(q.a) * lat); };

/** a car: s along the oval, lat (+ = left), speed; its vehicle as AIDriver reads it */
function car(key, s, lat, speed, hero = false) {
  const c = { key, hero, s, lat, sp: speed };
  c.vehicle = { cur: { pos: posAt(s, lat), quat: new THREE.Quaternion() }, speed, rb: { angvel: () => ({ y: 0 }) }, wheelbase: 2.6, steerLock: () => 0.6,
    spec: { grip: 1.15, downforceStock: 0, downforce: 0, mass: 1400 }, state: { nitroTank: 1 } };
  return c;
}
function place(c) {
  const q = at(c.s); c.vehicle.cur.pos.copy(posAt(c.s, c.lat)); c.vehicle.speed = c.sp;
  c.vehicle.cur.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), q.a);   // local +X along the line
}
/** run `ticks` at 120 Hz; AI cars follow their own controls (and drift toward their lane), `script(c, t)` moves the others. Returns every output */
function run(cars, profFor, ticks, { script = null, track = null, F0 = {} } = {}) {
  const F = { linePts, lineLeft, vt, track, cars, hero: cars.find((c) => c.hero), aiEvents: [], ...F0 };
  cars.forEach(place);
  for (const c of cars) if (!script?.(c, 0)) { c.ai = profFor === undefined ? new AIDriver(F, c, 0.97) : new AIDriver(F, c, 0.97, profFor(c)); c.ai.i = Math.round(c.s / LEN * N) % N; c.ai.lane = c.lat; }
  const out = [], lanes = [];
  for (let t = 0; t < ticks; t++) {
    for (const c of cars) {
      if (script?.(c, t)) { place(c); continue; }
      const u = c.ai.read(c.vehicle); out.push(u);
      c.sp = Math.max(0, c.sp + (u.throttle * 6 - u.brake * 14) / 120); c.s += c.sp / 120; c.lat += (c.ai.laneNow - c.lat) * 0.03; place(c);
      lanes.push({ lane: c.ai.laneNow, def: c.ai.defT > 0 });
    }
  }
  return { out, lanes, F };
}
const prof = (role, o = {}) => ({ role, composure: 0.5, seed: 12345, k: structuredClone(TUNING.rivals.track), ...o });
const json = (x) => JSON.stringify(x);

// 1. a null profile drives exactly as no profile, over 1,000 ticks with traffic (four cars in a bunch, the player among them)
{
  const field = () => [car('a', 100, 0.6, 40), car('b', 108, -0.6, 41), car('c', 95, 1.5, 42), car('hero', 104, 0, 43, true)];
  const plain = run(field(), undefined, 1000), nul = run(field(), () => null, 1000);
  assert.equal(plain.out.length, 4000);
  assert.equal(json(nul.out), json(plain.out), 'a null profile is byte-identical to none');
  assert.ok(new Set(plain.out.map((u) => u.steer.toFixed(3))).size > 20, 'the traffic run really steers');
}

// 2. defend: the nemesis moves toward the player only, within lo/hi, once a straight
{
  const track = { halfWidth: Array(N).fill(4), racingLine: Array(N).fill(0) }, hi = 4 - 1.6;   // room 2.4 m either side
  const hero = car('hero', 14, 3, 35, true), nem = car('nem', 20, 0, 35);
  const { lanes, F } = run([nem, hero], (c) => (c.hero ? null : prof('nemesis')), 120 * 7, { track, script: (c) => c.hero && ((c.s = nem.s - 8), (c.sp = nem.sp), true) });
  const def = F.aiEvents.filter((e) => e.type === 'defend');
  assert.equal(def.length, 1, 'one defend on the straight, though the player stays behind after the hold');
  const move = lanes.filter((l) => l.def).map((l) => l.lane);
  assert.ok(move.length > 120 * 3.9 && move.length <= 120 * 4, 'the move holds for 4 s');
  for (let i = 1; i < move.length; i++) assert.ok(move[i] >= move[i - 1] - 1e-12, `tick ${i}: the lane moves toward the player (+3 m) only`);
  assert.ok(move.at(-1) > 1.5, 'it really crossed toward the player');
  assert.ok(lanes.every((l) => l.lane <= hi + 1e-9 && l.lane >= -hi - 1e-9), 'the lane stays inside lo/hi');
  // a car without the nemesis role does not defend
  const n2 = car('nem', 20, 0, 35), h2 = car('hero', 14, 3, 35, true);
  assert.equal(run([n2, h2], (c) => (c.hero ? null : prof('rival')), 600, { track, script: (c) => c.hero && ((c.s = n2.s - 8), (c.sp = n2.sp), true) }).F.aiEvents.filter((e) => e.type === 'defend').length, 0);
  // a player whose nose overlaps the nemesis (centres 4 m apart, cars about 4.5 m long) is never chopped
  const n3 = car('nem', 20, 0, 35), h3 = car('hero', 16, 3, 35, true);
  assert.equal(run([n3, h3], (c) => (c.hero ? null : prof('nemesis')), 600, { track, script: (c) => c.hero && ((c.s = n3.s - 4), (c.sp = n3.sp), true) }).F.aiEvents.filter((e) => e.type === 'defend').length, 0, 'no defend on a car partly alongside');
}

// 3. the mistake roll: the same seed, corner and lap give the same answer; with the player not within 0.6 s, nothing ever happens
{
  const P = prof('nemesis', { composure: 0.2 }); P.k.mistake.base = 1;    // p = 0.8 x 1.6 x 1.3, over 1: a mistake at every corner entry under pressure
  for (let corner = 0; corner < 50; corner++) for (let lap = 0; lap < 4; lap++) assert.equal(mistakeOf(P, corner, lap), mistakeOf(structuredClone(P), corner, lap));
  const all = Array.from({ length: 200 }, (_, i) => mistakeOf({ ...P, k: { mistake: { ...P.k.mistake, base: 0.3 } } }, i, 1));   // p = 0.5
  assert.ok(all.includes('lift') && all.includes('wide') && all.includes(null), 'both kinds, and sometimes none');
  assert.equal(mistakeOf({ ...P, composure: 1 }, 7, 1), null, 'full composure never slips');
  const lap = (gap) => {
    const ai = car('ai', 0, 0, 40), hero = car('hero', -gap, 0, 40, true);
    return run([ai, hero], (c) => (c.hero ? null : structuredClone(P)), 120 * 40, { script: (c) => c.hero && ((c.s = ai.s - gap), (c.sp = ai.sp), true) }).F.aiEvents.filter((e) => e.type === 'mistake');
  };
  const close = lap(4), again = lap(4);
  assert.ok(close.length > 0, 'the player on its gearbox: mistakes happen');
  assert.equal(json(again), json(close), 'and they repeat exactly');
  assert.equal(lap(60).length, 0, 'the player 60 m back (over 0.6 s): never');
  const alone = car('ai', 0, 0, 40);
  assert.equal(run([alone, car('hero', 1000, 300, 0, true)], (c) => (c.hero ? null : structuredClone(P)), 120 * 40, { script: (c) => c.hero }).F.aiEvents.length, 0, 'no player near: nothing');
}

// 4. a profile is never applied to the player's car: AIDriver ignores one on the hero, and cars.js never passes one
{
  const field = () => [car('hero', 100, 0, 40, true), car('b', 106, 0.6, 40)];
  const P = prof('nemesis', { composure: 0.2 }); P.k.mistake.base = 1;
  const a = run(field(), (c) => (c.hero ? structuredClone(P) : null), 1000), b = run(field(), () => null, 1000);
  assert.equal(json(a.out), json(b.out), 'the hero drives the same with a profile handed to it');
  const src = readFileSync(new URL('../src/cars.js', import.meta.url), 'utf8');
  assert.match(src, /new AIDriver\(this, c, [^\n]*, c\.hero \? null : this\.aiFor\?\.\(c\.key\) \?\? null\)/, 'cars.js passes no profile to the hero');
}

// 5. team orders: on the final lap the teammate lets a player within 1 s by, once, then the order is cleared
{
  const mate = car('mate', 50, 0, 50), hero = car('hero', 30, 0, 50, true);
  const { F, out, lanes } = run([mate, hero], (c) => (c.hero ? null : prof('mate')), 120 * 5, { F0: { orders: 'toYou', mateKey: 'mate', finalLap: true }, script: (c) => c.hero && ((c.s = mate.s - 20), (c.sp = 50), true) });
  assert.equal(F.aiEvents.filter((e) => e.type === 'orders').length, 1);
  assert.equal(F.orders, null, 'the order is carried out and cleared');
  assert.ok(Math.max(...lanes.map((l) => l.lane)) > 1.5, 'the teammate stepped aside');
  const m2 = car('mate', 50, 0, 50), h2 = car('hero', 30, 0, 50, true);
  assert.equal(run([m2, h2], (c) => (c.hero ? null : prof('mate')), 120 * 5, { F0: { orders: 'toYou', mateKey: 'mate', finalLap: false }, script: (c) => c.hero && ((c.s = m2.s - 20), (c.sp = 50), true) }).F.aiEvents.length, 0, 'not before the final lap');
  assert.ok(out.length > 0);
  // a teammate who is also the nemesis yields and never defends while obeying, though the player sits right behind on its line
  const m3 = car('mate', 50, 0, 50), h3 = car('hero', 42, 0, 50, true);
  const y = run([m3, h3], (c) => (c.hero ? null : prof('nemesis')), 120 * 3, { track: { halfWidth: Array(N).fill(6), racingLine: Array(N).fill(0) }, F0: { orders: 'toYou', mateKey: 'mate', finalLap: true }, script: (c) => c.hero && ((c.s = m3.s - 8), (c.sp = 50), true) });
  assert.equal(y.F.aiEvents.filter((e) => e.type === 'orders').length, 1, 'the nemesis teammate yields');
  assert.equal(y.F.aiEvents.filter((e) => e.type === 'defend').length, 0, 'and does not defend');
  assert.ok(y.lanes.every((l) => !l.def) && Math.max(...y.lanes.map((l) => Math.abs(l.lane))) > 1.5, 'it steps aside');
}
// 6. clear air: with the player out of reach (over 55 m), every role drives exactly as no profile, so a rival's pace alone never changes
{
  const field = () => [car('a', 100, 0.6, 40), car('b', 112, -0.6, 41), car('c', 95, 1.5, 42), car('hero', 900, 0, 0, true)], P = prof('nemesis', { composure: 0.2 }); P.k.mistake.base = 1;
  const plain = run(field(), undefined, 1200, { script: (c) => c.hero }), roles = ['nemesis', 'rival', 'mate'];
  for (const role of roles) assert.equal(json(run(field(), (c) => ({ ...structuredClone(P), role }), 1200, { script: (c) => c.hero, F0: { orders: 'toYou', mateKey: 'a', finalLap: true } }).out), json(plain.out), `a ${role} with no player near drives as before`);
}
console.log('ai rivalry: all checks passed');
