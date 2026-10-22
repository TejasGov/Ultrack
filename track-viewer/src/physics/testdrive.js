// Headless test drive: one car alone on the track, driven by the AI, stepped at the physics rate (no rendering).
// Used to tune the handling and balance the field (lap times). From the console of the viewer:
//   const { soloRun } = await import('/src/physics/testdrive.js'); await soloRun(viewer.field(), 'av12', { seconds: 30 })
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { handling } from './handling.js';
import { AIDriver } from './driver.js';
import { STEP } from './world.js';

function respawnAt(field, v, i) { const a = field.linePts[i], b = field.linePts[(i + 2) % field.N]; v.respawn(a, Math.atan2(-(b.z - a.z), b.x - a.x)); }

export function soloRun(field, key, { seconds = 20, start = 300, pace = 1, every = 1, lapStop = false } = {}) {
  const prof = field.all.find((c) => c.key === key)?.profile;
  const a = field.linePts[start], b = field.linePts[(start + 2) % field.N];
  const v = new Vehicle(field.pw, handling(key), prof, { pos: a.clone(), yaw: Math.atan2(-(b.z - a.z), b.x - a.x) });
  const ai = new AIDriver(field, { hero: false }, pace); ai.i = start;
  const log = [], stats = { maxKmh: 0, minUp: 1, airborne: 0, respawns: 0, laps: [], dist: 0 };
  let lastI = start, lapT = 0, passed = 0;
  const n = Math.round(seconds / STEP);
  for (let s = 0; s < n; s++) {
    const ctl = ai.read(v); Object.assign(v.controls, ctl); if (ctl.reset) { stats.respawns++; respawnAt(field, v, ai.i); ai.stuck = 0; }
    v.step(STEP, { counter: 0.6, stability: 1.4, tcs: 1 });
    field.pw.world.step();
    lapT += STEP;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.cur.quat).y;
    stats.maxKmh = Math.max(stats.maxKmh, v.speed * 3.6); stats.minUp = Math.min(stats.minUp, up);
    if (v.onGround === 4 && v.speed > 15) { stats.maxLatG = Math.max(stats.maxLatG ?? 0, Math.abs(v.aBody.z) / 9.81); stats.maxBrakeG = Math.max(stats.maxBrakeG ?? 0, -v.aBody.x / 9.81); }
    const off = field.linePts[ai.i].distanceTo(v.cur.pos); if (off > 8 && !stats.offAt?.includes(ai.i - (ai.i % 20))) (stats.offAt ??= []).push(ai.i - (ai.i % 20));
    if (!v.onGround) stats.airborne += STEP;
    if (v.state.upsideDown > 1.5) { stats.respawns++; respawnAt(field, v, ai.i); }
    // lap: progress index wraps past the start
    const d = (ai.i - lastI + field.N) % field.N; if (d < field.N / 2) passed += d; lastI = ai.i;
    if (passed >= field.N) { stats.laps.push(+lapT.toFixed(2)); passed -= field.N; lapT = 0; if (lapStop) break; }
    if (s % Math.round(every / STEP) === 0) log.push(`${(s * STEP).toFixed(0)}s ${(v.speed * 3.6).toFixed(0)} km/h  ground ${v.onGround}  comp ${v.wheels.map((w) => w.comp.toFixed(2)).join(',')}  up ${up.toFixed(2)}  i ${ai.i}  beta ${THREE.MathUtils.radToDeg(v.state.beta).toFixed(0)}°  slip ${v.latSlip.toFixed(2)}  off-line ${field.linePts[ai.i].distanceTo(v.cur.pos).toFixed(1)} m  on ${v.wheels.find((w) => w.contact)?.surface?.name ?? '-'}`);
  }
  stats.progress = passed / field.N;
  field.pw.world.removeRigidBody(v.rb);
  return { key, stats, log };
}

/**
 * Balance of performance: per car, power first; a car whose lap got worse with more power (it loses its time in the
 * corners: a spinning rear, a heavy nose) gets grip instead; a car still too fast at the least power gets less grip.
 * `power` / `grip` bound the factors, so the real differences in power and speed are not balanced away.
 * Stops when every solo AI lap is within `tol` of target.
 */
export async function balance(field, { target = 150, rounds = 5, tol = 0.012, keys, power: [pmin, pmax] = [0.75, 1.35], grip: [gmin, gmax] = [1, 1.15] } = {}) {
  const { BOP } = await import('./handling.js');
  const list = keys ?? field.all.map((c) => c.key), rows = {};
  for (const k of list) BOP[k] = { power: 1, grip: 1, ...(BOP[k] ?? {}) };
  for (let r = 0; r < rounds; r++) {
    let done = true;
    for (const k of list) {
      const lap = soloRun(field, k, { seconds: 260, every: 999, lapStop: true }).stats.laps[0] ?? 999, b = BOP[k];
      const prev = rows[k];
      rows[k] = { power: +b.power.toFixed(3), grip: +b.grip.toFixed(3), lap };
      if (Math.abs(lap / target - 1) <= tol) continue;
      done = false;
      const ratio = lap / target, powerHurt = prev && prev.power < b.power && lap > prev.lap;
      if (ratio > 1 && (powerHurt || b.power >= pmax)) { if (powerHurt) b.power = prev.power; b.grip = Math.min(gmax, b.grip * ratio ** 0.9); }
      else if (ratio < 1 && b.power <= pmin) b.grip = Math.max(gmin, b.grip * ratio ** 0.9);   // too fast with the least power allowed: less grip
      else b.power = Math.min(pmax, Math.max(pmin, b.power * ratio ** 2.6));
    }
    if (done) break;
  }
  return rows;
}

/**
 * Skidpad script on a flat world: `script` is a list of [seconds, controls] steps (throttle, brake, steer, handbrake,
 * nitro); logs speed, slip angle, drift and yaw rate every `every` s. Returns { log, stats }.
 */
export async function skidpad(profile, key, script, { every = 0.25, assist = { counter: 0.35, stability: 1, tcs: 0.6 } } = {}) {
  const { PhysicsWorld } = await import('./world.js');
  const pw = await PhysicsWorld.flat();
  const v = new Vehicle(pw, handling(key), profile, { pos: new THREE.Vector3(0, 0, 0), yaw: 0 });
  const log = [], stats = { maxBeta: 0, spins: 0 };
  let t = 0, next = 0;
  for (const [sec, ctl, label] of script) {
    for (let s = 0; s < Math.round(sec / STEP); s++) {
      Object.assign(v.controls, { throttle: 0, brake: 0, steer: 0, handbrake: 0, nitro: 0, ...ctl });
      v.step(STEP, assist); pw.world.step(); t += STEP;
      const b = THREE.MathUtils.radToDeg(v.state.beta); stats.maxBeta = Math.max(stats.maxBeta, Math.abs(b));
      if (t >= next) { next += every; log.push(`${t.toFixed(2)} ${label ?? ''} ${(v.speed * 3.6).toFixed(0)} km/h beta ${b.toFixed(0)}° drift ${v.state.drift.toFixed(2)} steer ${v.state.steer.toFixed(2)} yaw ${v.rb.angvel().y.toFixed(2)} dir ${v.state.driftDir} target ${THREE.MathUtils.radToDeg(v.state.target ?? 0).toFixed(0)} Iy ${(v.Iy / v.spec.mass).toFixed(2)}`); }
    }
  }
  return { log, stats };
}
