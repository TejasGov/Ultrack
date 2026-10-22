// The car's body on its springs: pitch under braking and acceleration, roll in corners, a little heave over bumps.
// The wheels stay on the road; only the body group (shell, glass, mirrors, lamps, aero, exhaust anchors) moves, about
// a roll centre between the axles. Each axis is a damped spring driven by the measured acceleration, so the body
// leans in, overshoots a touch and settles (damping ratio ~0.45, ~1.4 Hz), like a stiff road car on track settings.
// Signs (car-lab frame, nose -X, left +Z): +rotation.z dips the nose, -rotation.x drops the right (-Z) side.
import * as THREE from 'three';

// In the game a physics body already leans a little (scale < 1, set by Field.enablePhysics); the sprung body adds the visible
// weight on top: more pitch and roll than the lab's, and slower (~1.3 Hz instead of the tuning's 1.6), so the car sits down on its
// springs and settles instead of twitching. Tuned by eye against Endurance: ~2 deg of dive under 1 g, ~2 deg of roll in a corner.
const WEIGHT = { pitch: 3.2, roll: 1.6, freq: 0.8 };

// Linear up to `k`, then eases to a hard ceiling `m` (|x| < m always; identical to x below the knee, so normal driving is unchanged).
const sat = (x, k, m) => { const a = Math.abs(x); return a <= k ? x : Math.sign(x) * (k + (m - k) * Math.tanh((a - k) / (m - k))); };
const A_KNEE = 13, A_MAX = 20;                                       // m/s²: ~1.3 g passes untouched, a crash tops out near 2 g
const TRAVEL = { pitch: 0.11, roll: 0.07, heave: 0.03 };             // m of shell motion at a wheel corner, per axis (wheel visual travel ~0.13)

export class Chassis {
  /** body: the group to move; spec: tuning.suspension { pitch, roll, heave, freq, damping } (1 = default stiffness) */
  constructor(body, spec = {}, pivot = new THREE.Vector3(0, 0.38, 0)) {
    this.body = body; this.pivot = pivot;
    this.k = { pitch: 0.0032 * (spec.pitch ?? 1), roll: 0.0042 * (spec.roll ?? 1), heave: 0.004 * (spec.heave ?? 1) };   // rad (m) per m/s²
    this.w = 2 * Math.PI * (spec.freq ?? 1.4); this.z = spec.damping ?? 0.45;
    this.reach = { x: 1.4, z: 0.8 };                                  // half wheelbase / half track (m); cars.js sets the real ones
    this.ride = spec.ride ?? 0;                                      // m: raises the body off the wheels (arch clearance)
    this.s = { pitch: [0, 0], roll: [0, 0], heave: [0, 0] };
    this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
    this.update(0, 0, 0);                                             // ride height applies from assembly (parked cars too)
  }

  /** aLong: m/s² along travel (+ accelerating); aLat: m/s² toward the car's left (+ turning left); bump: m (road input) */
  update(dt, aLong, aLat, bump = 0) {
    const sc = this.scale ?? 1, phys = sc < 1;                        // < 1 when a physics body already leans
    aLong = sat(aLong, A_KNEE, A_MAX); aLat = sat(aLat, A_KNEE, A_MAX);   // a crash spike must not launch the shell
    const target = { pitch: -aLong * this.k.pitch * sc * (phys ? WEIGHT.pitch : 1), roll: -aLat * this.k.roll * sc * (phys ? WEIGHT.roll : 1), heave: -Math.abs(aLat) * this.k.heave * 0.15 * sc + bump };
    const w = this.w * (phys ? WEIGHT.freq : 1);
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));                // fixed small steps: stable at any frame rate
    const h = dt / n;
    for (const a of ['pitch', 'roll', 'heave']) {
      let [x, v] = this.s[a];
      for (let i = 0; i < n; i++) { v += (-w * w * (x - target[a]) - 2 * this.z * w * v) * h; x += v * h; }
      this.s[a] = [x, v];
    }
    // travel budget: the shell moves at most TRAVEL at any wheel corner (pitch*half-wheelbase, roll*half-track, heave), soft-limited
    const p = sat(this.s.pitch[0], 0.8 * TRAVEL.pitch / this.reach.x, TRAVEL.pitch / this.reach.x);
    const r = sat(this.s.roll[0], 0.8 * TRAVEL.roll / this.reach.z, TRAVEL.roll / this.reach.z);
    const hv = sat(this.s.heave[0], 0.8 * TRAVEL.heave, TRAVEL.heave);
    this.q.setFromEuler(this.e.set(r, 0, p));
    // rotate about the pivot: position = pivot - R·pivot (+ heave)
    this.body.quaternion.copy(this.q);
    this.body.position.copy(this.pivot).sub(this.pivot.clone().applyQuaternion(this.q));
    this.body.position.y += hv + this.ride;  }

  get pitchDeg() { return THREE.MathUtils.radToDeg(this.s.pitch[0]); }
  get rollDeg() { return THREE.MathUtils.radToDeg(this.s.roll[0]); }
  reset() { for(const a of Object.values(this.s))a.fill(0);this.update(0,0,0); }
}

// self-check: a 1 g stop dips the nose 1-3°, settles within 1.5 s, and the first overshoot stays under 30%
{
  const c = new Chassis(new THREE.Group());
  let peak = 0;
  for (let i = 0; i < 120; i++) { c.update(1 / 60, -9.81, 0); peak = Math.max(peak, c.pitchDeg); }
  const end = c.pitchDeg;
  console.assert(end > 1 && end < 3, 'chassis: braking pitch out of range', end);
  console.assert(peak < end * 1.3, 'chassis: overshoot too large', peak, end);
}
