// One car's physics: a Rapier rigid body (the chassis: mass, inertia, collisions with walls and other cars) with our
// own wheels, after research/cinematic-racing.md §4 ("keep the chassis, apply our own slip-angle tyre force"):
// - suspension: a ray per wheel from its mount down to the ground; a spring + damper gives the wheel's load, so
//   weight shifts to the front under braking and to the outside in corners for free; anti-roll bars per axle
// - tyres: lateral force from the slip angle through a Pacejka-like curve (peak near 7.5°; the rear axle is stiffer and falls off
//   more gently after the peak, so the car understeers into the limit and a slide settles by itself); drive and brake force along
//   the wheel; both together capped by a friction circle of grip × load × surface (asphalt, kerb, grass, gravel...); an overloaded
//   tyre loses cornering faster than pull, so too much throttle or the handbrake lets the tail go
// - weight shift from the pedals (brake, lift, power) acts on the cornering force: the nose tucks in and the tail rotates
// - engine: power-limited drive force on the driven axle(s) (AWD splits 40/60), brakes capped at the grip (ABS)
// - aero: drag (sets the top speed: power = drag at top speed) and downforce ∝ v², front and rear
// - steering lock that follows the grip (arcade.js), keyboard filters in player-controls.js
// - assists (countersteer, stability torque, catch torque, slide recovery, traction-control throttle cut): they do nothing while the
//   car is cornering or rotating and fade in only once it is really sliding (arcade.js spinGate: Casual 8°, Sport 10°, Pro 24°)
// - the arcade layer (arcade.js, step()): the tyres above give weight and body motion; this decides the turn (yaw rate from the steering, capped at
//   ~3 g), pulls the velocity in line with the heading, holds a drift's path and angle, and brakes ~1.8 g. Rookie / Pro are its two tiers
// - drift mode (explicit handbrake while turning: rear grip fades down, a long pull swings the car round, the drift angle is held,
//   part of the lost speed is given back), nitro
// Body frame: +x forward, +y up, +z right (the car root's frame; car-lab's shell turned by π inside it).
import * as THREE from 'three';
import { RAPIER } from './world.js';
import { road, wetGrip } from './weather.js';
import { resolvePedals } from './pedals.js';
import { driving } from './player-controls.js';
import { steeringLock,reverseLock,slidingForce,recoveryAcceleration,spinGate,spinStart,SPIN_FADE,arcadeTier,arcadeAccel,arcadeYaw,yawFade,yawTau } from './arcade.js';

const G = 9.81, RHO = 1.2;
// wet: same stiffness build-up as dry (the car answers the wheel the same, only the limit is lower), a slightly later
// peak and a longer, softer tail, so the limit announces itself instead of snapping
const pac = (a, wet = 0, shape = 1.55) => { const B = 10.5 - 0.5 * wet, C = shape + 0.05 * wet, E = -0.6, x = B * a; return Math.sin(C * Math.atan(x - E * (x - Math.atan(x)))); };   // a in rad, peak ≈ 8°
// Build cornering force with less visible sideways motion; keep a progressive sliding tail.
{
  let pk = 0, at = 0; for (let d = 0; d < 40; d += 0.25) { const v = pac(THREE.MathUtils.degToRad(d)); if (v > pk) { pk = v; at = d; } }
  console.assert(at > 6 && at < 10, 'tyre curve peak at', at); const tail = pac(Math.PI / 2) / pk; console.assert(tail > 0.6 && tail < 0.9, 'tyre slide ratio', tail);
}

// ABS steering reserve: the share of the front tyres' lateral demand the brake leaves alone (the rear always keeps all of it).
// Casual .86, Sport .79, Pro .4; an explicit assist.absSteer wins, else it follows the tier's traction control (store.js ASSISTS)
const absKeep = (a) => a.absSteer ?? ((a.tcs ?? 0.6) >= 0.6 ? 0.79 + 0.07 * ((a.tcs ?? 0.6) - 0.6) / 0.4 : 0.4 + 0.36 * (a.tcs ?? 0) / 0.6);
// The rear's share: Casual keeps all its cornering grip (the brake takes what is left), Sport .94, Pro .85, so on the brakes the
// rear of a Sport or Pro car can let go a little and the car rotates (trail braking); the front always keeps more than that
const absKeepRear = (a) => a.absSteerRear ?? 0.85 + 0.15 * (a.tcs ?? 0.6);
// Brake bias that follows the steering: part of the rear's share moves to the front while the wheel is turned (it keeps the
// rear planted and the car pointing where it is steered). Casual 1, Sport .2, Pro 0 (fixed bias: rotation is the driver's job)
const biasShift = (a) => a.brakeBias ?? Math.max(0, ((a.tcs ?? 0.6) - 0.5) * 2);
const REVERSING_BELOW = 14.4;                                   // m/s: backing up on purpose; faster backwards is a spin and keeps its assists
const WALL_OFF_SPEED = 3, WALL_OFF_ACCEL = 14;   // m/s, m/s2: leaving a barrier with the wheel turned away
const MAX_SPIN = 7, BALL_SKIN = 0.004, BALL_WIN = 0.01, GROUND_COS = Math.SQRT1_2, AXLE = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);   // wheel-cast cylinder radius = tyre - skin; steepest ground normal 45 deg
const v3 = () => new THREE.Vector3();
const toV = (r) => new THREE.Vector3(r.x, r.y, r.z);

export class Vehicle {
  /**
   * pw: PhysicsWorld; spec: handling() result; profile: car-lab profile (wheel positions); pose: { pos: Vector3, yaw }
   */
  constructor(pw, spec, profile, pose) {
    this.pw = pw; this.spec = spec;
    const { world } = pw;
    const fw = profile.wheels.front, rw = profile.wheels.rear;
    // wheels in the body frame: car-lab's nose is -x, turned by π: front x = -fw.x, left z = -track/2
    this.wheels = [[fw, true, -1], [fw, true, 1], [rw, false, -1], [rw, false, 1]].map(([w, front, side]) => ({
      x: -w.x, z: side * w.track / 2, R: w.radius, front, side,
      tyre: new RAPIER.Cylinder((w.width ?? 0.24) / 2, w.radius - BALL_SKIN), driven: spec.drive === 'AWD' || !front, comp: 0, contact: false, load: 0, slip: 0, spin: 0, surface: null, omegaR: 0,
    }));
    this.wheelbase = Math.abs(this.wheels[0].x - this.wheels[2].x);
    this.L0 = 0.18;                                            // suspension travel from full droop
    // the body box: the real length and width (specs.json) when known, else the wheels plus a standard overhang; centred
    // on the wheelbase (or on the centre of mass when the size is unknown)
    const xF = this.wheels[0].x, xR = this.wheels[2].x, sz = spec.size;
    this.half = { x: sz ? sz.length / 2 : Math.max(xF, -xR) + 0.75, y: 0.3, z: sz ? sz.width / 2 : Math.max(...this.wheels.map((w) => Math.abs(w.z))) + 0.12 };
    this.boxX = sz ? (xF + xR) / 2 : xR + (xF - xR) * spec.weightFront;
    const half = this.half;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw);
    this.rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pose.pos.x, pose.pos.y + 0.02, pose.pos.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCcdEnabled(true).setAngularDamping(0.12));
    this.collider = world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(this.boxX, 0.62, 0)
      .setFriction(0.35).setRestitution(0.12), this.rb);
    this.retune(spec);
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0, nitro: 0 };
    this.dbg = {};                                             // every assist term of the last step (scripts/physics-turning.mjs logs them)
    this.state = { tcsActive: 0, absActive: 0, escActive: 0, shift: 0, steer: 0, drift: 0, driftHold: 0, nitroTank: 1, nitroOn: false, prevBrake: 0, beta: 0, upsideDown: 0, drive: 0 };
    this.prev = { pos: v3(), quat: new THREE.Quaternion() }; this.cur = { pos: v3(), quat: new THREE.Quaternion() };
    this.vBody = v3(); this.aBody = v3(); this.vPrevBody = v3();
    this.arcG = 2.3; this.speed = 0; this.vForward = 0; this.latSlip = 0; this.spinSlip = 0; this.onGround = 0;   // read by drivers before the first step
    this.capture(); this.prev.pos.copy(this.cur.pos); this.prev.quat.copy(this.cur.quat);
  }

  /**
   * Apply a new handling() result to this car now (an upgrade bought, a balance change): mass, springs, centre of mass and
   * inertia, power, grip and brakes. Safe mid-session; the body box (the car's size) stays. Called by the constructor too.
   */
  retune(spec) {
    this.spec = spec;
    const M = spec.mass, half = this.half;
    const staticComp = 0.065, axleLoadF = M * G * spec.weightFront / 2, axleLoadR = M * G * (1 - spec.weightFront) / 2;
    for (const w of this.wheels) {
      const load = w.front ? axleLoadF : axleLoadR;
      w.staticLoad=load;
      w.k = load / staticComp; w.c = 2 * Math.sqrt(w.k * load / G);
      w.mountY = w.R + this.L0 - staticComp;                   // wheel centre sits at y = R on flat ground at rest
      w.driven = spec.drive === 'AWD' || !w.front;
    }
    // centre of mass: between the axles by the weight split, at the car's CoG height
    const xF = this.wheels[0].x, xR = this.wheels[2].x;
    this.com = new THREE.Vector3(xR + (xF - xR) * spec.weightFront, spec.cog, 0);
    const T=spec.arcade??{};
    const I = { x: M / 12 * ((2 * half.y) ** 2 + (2 * half.z) ** 2) * (T.rollInertia??1.6), y: M / 12 * ((2 * half.x) ** 2 + (2 * half.z) ** 2) * (T.yawInertia??.9), z: M / 12 * ((2 * half.x) ** 2 + (2 * half.y) ** 2) * (T.pitchInertia??1.4) };
    this.Iy = I.y;
    this.collider.setMassProperties(M, { x: this.com.x - this.boxX, y: spec.cog - 0.62, z: 0 }, I, { x: 0, y: 0, z: 0, w: 1 });
    this.rb.recomputeMassPropertiesFromColliders();
  }

  capture() { const t = this.rb.translation(), r = this.rb.rotation(); this.cur.pos.set(t.x, t.y, t.z); this.cur.quat.set(r.x, r.y, r.z, r.w); }

  /** max front-wheel angle (rad) at this speed: full lock when parking, a few degrees at 300 km/h */
  steerLock(v) { return steeringLock(v,this.wheelbase,this.arcG*yawFade(v),this.spec.downforce,this.spec.mass,this.spec.arcade??{}); }

  step(h, assist = { counter: 0.35, stability: 1, tcs: 0.6 }) {
    const { rb, spec, controls: ctl, state: st } = this, world = this.pw.world, wet = road.wet;
    this.prev.pos.copy(this.cur.pos); this.prev.quat.copy(this.cur.quat);
    const q = toQ(rb.rotation()), pos = toV(rb.translation()), lin = toV(rb.linvel()), ang = toV(rb.angvel());
    if (ang.length() > MAX_SPIN) { ang.setLength(MAX_SPIN); rb.setAngvel(ang, true); }   // a wall hit can not spin a car past what a real crash does (7 rad/s ~ 400 deg/s)
    const fwd = v3().set(1, 0, 0).applyQuaternion(q), up = v3().set(0, 1, 0).applyQuaternion(q), right = v3().set(0, 0, 1).applyQuaternion(q);
    const comW = this.com.clone().applyQuaternion(q).add(pos);
    const vF = lin.dot(fwd), vR = lin.dot(right), speed = lin.length();
    // reversing on purpose: beta is a forward-driving idea, so the countersteer, traction fade and recovery assists see none
    const backing = vF < -0.5 && speed < REVERSING_BELOW;
    st.beta = speed > 6 && !backing ? Math.atan2(vR, Math.max(Math.abs(vF), 1)) : 0;
    // how far into a real spin the car is (0 cornering or rotating on purpose .. 1): the driving aids scale with it
    const gate = spinGate(st.beta, assist.stability);
    const pedals=resolvePedals(st,ctl,vF,vR,h);
    if (ctl.player) driving.speed = speed;

    // ---- drift mode: deliberate handbrake input only. Trail braking must not loosen the rear
    // or engage the drift yaw controller / speed give-back during an ordinary race corner.
    st.prevBrake = ctl.brake;
    if (ctl.handbrake > 0.5 && speed > 12) st.driftHold = 0.45;
    // how long the handbrake has been held: a tap starts a drift (24-43°), a long pull keeps the rear locked and swings the car round
    st.hbT = ctl.handbrake > 0.5 ? (st.hbT ?? 0) + h : 0;
    const hbHold = ctl.handbrake > 0.5 ? Math.min(1, st.hbT / 0.4) : 0;
    const sideways = Math.abs(st.beta) > 0.12 && speed > 10;
    // A slide only holds drift mode once the handbrake has initiated it.
    st.driftHold = sideways && st.drift > 0.3 ? Math.max(st.driftHold, 0.25) : st.driftHold - h;
    // an impact (a wall, a kerb strike, a landing): the velocity jumps by more than any tyre force could in one step, or the yaw does. For .6 s after it no drift can start
    st.hit = Math.max(0, (st.hit ?? 0) - h); if (st.vPrev && (lin.distanceTo(st.vPrev) > 1 || Math.abs(ang.dot(up) - st.yawPrev) > 1.2)) st.hit = 0.6;
    (st.vPrev ??= v3()).copy(lin); st.yawPrev = ang.dot(up);
    // a big slide under power is a drift too, when the driver is steering and the car has not just hit something
    if (ctl.throttle > 0.5 && Math.abs(st.beta) > arcadeTier(assist.stability).enter && speed > 12 && Math.abs(ctl.steer) > 0.3 && st.hit <= 0) st.driftHold = Math.max(st.driftHold, 0.25);
    if (st.drift > 0.3 && ctl.throttle < 0.2 && !ctl.handbrake) st.driftHold = Math.min(st.driftHold, 0);   // lifting ends the drift
    // letting go of the handbrake with the throttle off ends the drift at once (the car is left to rotate on its own momentum and
    // the driver, or the tier's catch, takes it from there); holding the throttle keeps the powerslide
    st.drift += ((st.driftHold > 0 ? 1 : 0) - st.drift) * (1 - Math.exp(-(st.driftHold > 0 ? 6 : ctl.throttle < 0.4 && !ctl.handbrake ? 5 : 2.5) * h));
    // ---- steering: speed-sensitive lock, smoothed, plus countersteer toward the direction of travel
    // countersteer only once the car is really sliding (spin gate: Sport 13°+): otherwise it unwinds the steering in every corner
    const slide = Math.sign(st.beta) * Math.abs(st.beta) * Math.max(gate, st.drift);
    const lock = backing ? Math.min(this.steerLock(speed), reverseLock(speed, this.wheelbase)) : this.steerLock(speed), counter = -slide * (assist.counter + 0.45 * st.drift + Math.min(0.5, 1.5 * assist.counter) * THREE.MathUtils.smoothstep(Math.abs(st.beta), 0.6, 0.9));   // past ~40° a tier with countersteer help goes to full opposite lock
    st.steerInput = ctl.steer * lock;                         // what the driver asked for, without the assist
    // once the car is really sliding it takes back part of the driver's steering (a wheel held over through a spin is how a spin
    // happens): at most 12% of it (Casual .12, Sport .08, Pro .02); the damping torque below does the rest, the game never steers against the held lock
    const takeBack = Math.min(0.12, 0.22 * assist.counter) * gate * (1 - st.drift);
    const cs = counter * Math.min(1, speed / 15) * (1 - Math.abs(ctl.steer)), steerNormal = ctl.steer * lock * (1 - takeBack) + (cs * ctl.steer < 0 && Math.abs(ctl.steer) > 0.1 ? 0 : cs);   // never against a held key   // countersteer only with the wheel free: never against the driver's lock
    // how hard the stability aids are working this step, 0..1 (published as state.escActive for the HUD): the strongest of the steering they
    // take back or add (counter: 20° of opposite lock = 1), the stability and catch yaw moments (rad/s2) and the slide recovery
    let esc = Math.max(takeBack, (1 - st.drift) * Math.min(1, Math.abs(counter * Math.min(1, speed / 15)) / 0.35));
    this.dbg.lock = lock; this.dbg.counter = counter * Math.min(1, speed / 15);
    // in a drift the front wheels point along the direction of travel (plus a little of the driver's input), so the
    // slide carries the car round; the drift angle itself is held by the yaw controller below
    const steerDrift = ctl.steer * Math.max(lock, 0.3) + -st.beta * 0.9 * (1 - Math.min(1, Math.abs(ctl.steer) * 3));   // the wheel follows the player's key; only a free wheel counter-steers (looks only: the arcade layer drives the yaw)
    const want = THREE.MathUtils.clamp(THREE.MathUtils.lerp(steerNormal, steerDrift, st.drift), -0.6, 0.6);
    st.steer += (want - st.steer) * (1 - Math.exp(-(spec.arcade?.steeringResponse ?? 35) * h));   // the rack tracks the already-smoothed input (driving.json 14-20 would be a second lag)
    // ---- nitro: drains while held, refills slowly and fast while drifting
    st.nitroOn = ctl.nitro > 0.5 && st.nitroTank > 0.02 && pedals.drive > 0.3;
    st.nitroTank = THREE.MathUtils.clamp(st.nitroTank + h * (st.nitroOn ? -0.22 / (spec.nitroTank ?? 1) : (0.015 + 0.25 * st.drift * Math.min(1, speed / 30)) * (spec.nitroRefill ?? 1)), 0, 1);
    const power = spec.power * (st.nitroOn ? 1.45 : 1);
    const reverse = pedals.drive < 0;
    // traction control: trims the drive while the car is sliding (never in drift mode, where the throttle holds the angle)
    // past ~45° of slide the power fades out even in drift mode: a held throttle can't spin the car round
    const tc = (1 - (assist.tcs ?? 0) * (1 - st.drift) * gate) * (1 - THREE.MathUtils.smoothstep(Math.abs(st.beta), 0.75, 1.1));
    // throttle response: an EV answers at once, a turbo ICE builds boost (lag per powertrain, handling.js); lifting is quick
    this.dbg.tc = tc;
    const driveInput=Math.abs(pedals.drive),direction=Math.sign(pedals.drive);
    if(pedals.brake>0||direction!==(st.driveDirection??direction))st.drive=0;
    st.driveDirection=direction;
    st.drive += (driveInput - st.drive) * (1 - Math.exp(-h / (driveInput > st.drive ? spec.lag ?? 0.1 : 0.05)));
    // a lifted throttle drags the driven axle (engine braking, an EV's regeneration): a little extra load on the rear's friction circle
    const engineBrake = reverse || pedals.brake > 0 ? 0 : -(spec.arcade?.engineBrake ?? 0.12) * spec.mass * G * THREE.MathUtils.smoothstep(vF, 3, 10) * (1 - Math.min(1, st.drive * 8));
    // Brake overrides residual engine torque immediately, even while W is still held.
    const driveTotal = (pedals.brake>0 ? 0 : reverse ? -0.25 * spec.mass * G * st.drive : st.drive * tc * Math.min(power / Math.max(Math.abs(vF), 5), spec.mass * G * 1.4)) + engineBrake;
    const bias = biasShift(assist) * Math.min(1, Math.abs(ctl.steer) * 2);
    const nDriven = this.wheels.filter((w) => w.driven).length;

    // ---- a barrier the car is pressed against with the wheel turned away from it: over the corner's grip the tyres can never pull it off, so the wall held it and scrubbed its speed until it
    // was back under the limit, whatever the driver did. A push off the wall instead, up to the speed of a glancing bounce
    if (Math.abs(ctl.steer) > 0.3 && speed > 8) world.contactPairsWith(this.collider, (o) => {
      if (this.pw.surface(o.handle)?.name !== 'wall') return;
      world.contactPair(this.collider, o, (m, flipped) => {
        if (!m.numContacts()) return;
        const N = m.normal(), s = flipped ? 1 : -1, len = Math.hypot(N.x, N.z); if (len < 0.7) return;   // the wall's top or a low edge under the car is not a face to push off
        const nx = s * N.x / len, nz = s * N.z / len;                        // from the wall to the car
        if (-ctl.steer * (nx * right.x + nz * right.z) < 0.15) return;       // positive steer is left, away from `right`
        const out = lin.x * nx + lin.z * nz, dv = Math.min(Math.max(0, WALL_OFF_SPEED - out), WALL_OFF_ACCEL * h) * spec.mass;
        if (dv > 0) rb.applyImpulse({ x: nx * dv, y: 0, z: nz * dv }, true);
      });
    });

    // ---- aero: drag (sets top speed) and downforce (front 45%, rear 55%)
    const vv = speed * speed, down = 0.5 * RHO * spec.downforce * vv;
    rb.applyImpulse(lin.clone().multiplyScalar(-spec.dragK * speed * h), true);

    // the weight shift the pedals ask for: braking -1 (less in Casual, and halved by 220 km/h where the car must stay straight on the
    // brakes), a lifted throttle -liftShift, power up to +powerShift
    const shiftWant = (pedals.brake > 0 ? -pedals.brake * (spec.arcade?.brakeShift ?? 1) * (1 - 0.5 * (assist.tcs ?? 0)) * (1 - 0.5 * THREE.MathUtils.smoothstep(speed, 30, 60)) : speed > 5 && !reverse ? -(spec.arcade?.liftShift ?? 0.12) * (1 - Math.min(1, st.drive * 5)) + (spec.arcade?.powerShift ?? 0.35) * st.drive : 0);
    st.shift += (shiftWant - st.shift) * (1 - Math.exp(-h / 0.2));
    st.shiftSlow = (st.shiftSlow ?? 0) + (shiftWant - (st.shiftSlow ?? 0)) * (1 - Math.exp(-h / 1));
    // the fast part of the shift counts extra while it is changing (the load arrives before the springs settle): a lift or the brake
    // bites at the rear for a moment, the throttle plants it for a moment
    const lt = st.shift + (spec.arcade?.shiftBite ?? 2) * (st.shift - st.shiftSlow);
    const tyreF = v3(); let tyreMz = 0;                            // the tyres' net force and yaw moment this step: the arcade layer adds to / replaces them
    let latSlipRear = 0, spin = 0, onGround = 0, surfaceGrip = 0, gripAcc = 0, tcsDrive = 0, absCut = 0;   // the share of the drive / the brake the aids took away
    for (const w of this.wheels) {
      const mount = v3().set(w.x, w.mountY, w.z).applyQuaternion(q).add(pos);
      const origin = mount.clone().addScaledVector(up, 0.05), dir = up.clone().negate();
      // the ray reads the road under the axle; a tyre-sized cylinder (a few mm under, so flat road reads the same) swept down the same
      // axis catches what the ray slips past (kerbs, barriers, a wall at the wheel). The cast wins only where it stops clearly higher
      // (Rapier's shape cast is inexact on huge flat colliders, e.g. the skidpad plane: the ray stays the ground truth there)
      const qTyre = q.clone().multiply(AXLE), rBall = w.R - BALL_SKIN, Q = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, prevComp = w.comp;
      const rh = world.castRayAndGetNormal(new RAPIER.Ray(origin, dir), 0.05 + this.L0 + w.R, true, Q, undefined, this.collider, rb);
      const bh = world.castShape(origin, qTyre, dir, w.tyre, 0, 0.05 + this.L0 + BALL_SKIN, true, Q, undefined, this.collider, rb);   // stopAtPenetration: a wheel inside a wall reads it
      const Lr = rh ? (rh.timeOfImpact ?? rh.toi) - 0.05 - w.R : Infinity, Lb = bh ? bh.time_of_impact + rBall - 0.05 - w.R : Infinity;
      const useBall = Lb < Lr - BALL_WIN, hit = useBall ? bh : rh;
      w.contact = false; w.load = 0; w.slip = 0;
      const n = hit && toV(useBall ? bh.normal1 : rh.normal).normalize();
      // a hit whose normal leans over 45 deg from the car's up (a wall face, a barrier side) is not ground: no grip, no spring
      if (!hit || !(n.dot(up) >= GROUND_COS)) { w.comp = 0; w.len = this.L0; continue; }
      const L = useBall ? Lb : Lr;
      w.comp = THREE.MathUtils.clamp(this.L0 - L, 0, this.L0); w.len = this.L0 - w.comp;
      if (w.comp <= 0) continue;
      w.contact = true; onGround++;
      w.surface = this.pw.surface(hit.collider.handle);
      surfaceGrip+=w.surface.mu;
      const p = origin.clone().addScaledVector(dir, L + 0.05 + w.R - (useBall ? rBall : 0));   // the contact point (on the tyre for a ball hit)
      if (useBall) p.addScaledVector(n, -rBall);
      const compV = (w.comp - prevComp) / h;
      const tune=spec.arcade??{},damping=compV>=0?(tune.compressionDamping??.55):(tune.reboundDamping??.55);
      w.loadSusp=Math.min(w.staticLoad*(tune.suspensionLoadLimit??4),Math.max(0,w.k*w.comp+w.c*damping*compV));
      w.load = w.loadSusp + down * (w.front ? 0.225 : 0.275);
      // the wheel's frame on the ground: heading (steered for the fronts) and its right, in the contact plane
      const delta = w.front ? st.steer : 0;
      const hd = fwd.clone().multiplyScalar(Math.cos(delta)).addScaledVector(right, -Math.sin(delta));
      const f = hd.addScaledVector(n, -hd.dot(n)).normalize(), s = v3().crossVectors(f, n).normalize();
      const r = p.clone().sub(comW), vp = lin.clone().add(v3().crossVectors(ang, r));
      const vl = vp.dot(f), vs = vp.dot(s);
      // wet road: less peak grip everywhere (wetGrip); kerbs, cobbles and turf slicker still (surface.wet, at full rain)
      let mu = spec.grip * w.surface.mu * Math.min(1, wetGrip(wet) + (spec.wetRetention ?? 0) * wet) * (w.surface.wet ?? 1) ** wet;
      if(!w.front)mu*=1+((tune.rearGripScale??1)-1)*(1-st.drift);
      // rear grip fades in a drift / on the handbrake, and comes back past ~40° so the angle stays catchable (25-45°)
      if (!w.front) mu *= 1 - (0.24 * st.drift + 0.45 * ctl.handbrake) * (1 - THREE.MathUtils.smoothstep(Math.abs(st.beta), 0.6 + 0.7 * hbHold, 0.95 + 0.7 * hbHold));
      const cap = mu * w.load; gripAcc += cap / spec.mass;
      // lateral: slip angle through the tyre curve; at walking pace a plain damper (the angle is meaningless there)
      // the rear axle is stiffer than the front (it reaches its peak at a smaller angle): in the linear range the car understeers and
      // its yaw settles; push the rear past its peak (lift, brake, power) and it is the rear that lets go, then it settles (rearTyreShape)
      const slipAngle = Math.atan2(vs, Math.max(Math.abs(vl), 4)), alpha = slipAngle * (w.front ? 1 : (tune.rearStiffness ?? 1));
      let Fy = -cap * slidingForce(pac(alpha, wet, w.front ? tune.tyreShape : tune.rearTyreShape ?? tune.tyreShape),alpha,THREE.MathUtils.lerp(tune.slideFloor??.72,tune.slidingGrip??.75,st.drift),st.drift);
      // longitudinal load transfer felt in the cornering force: braking or lifting moves grip to the front and takes it from the
      // rear (the nose tucks in and the tail rotates), power does the opposite (the car straightens out); a pedal-driven effect,
      // not the measured deceleration, so a slide's own drag can not feed back into it
      Fy *= 1 + (w.front ? -0.5 : 1) * (tune.pitchGrip ?? 0.2) * (1 + (pedals.brake > 0 ? 0 : (tune.pitchAero ?? 0) * spec.downforce)) * lt;   // off the brakes an aero car's balance moves more when it pitches
      if (Math.abs(vl) < 2 && Math.abs(vs) < 2) Fy = THREE.MathUtils.clamp(-vs * spec.mass * 0.6, -cap, cap);
      // longitudinal: drive, brakes (ABS-capped), handbrake, rolling and surface drag
      const kx = spec.tractionK ?? 1;                // a tyre pulls harder in a straight line than sideways (an ellipse, not a circle)
      const frontBias=tune.driveBiasFront??.4;
      let Fx = w.driven ? driveTotal / nDriven * (spec.drive === 'AWD' ? (w.front ? 2*frontBias : 2*(1-frontBias)) : 1) : 0;
      // traction control: cornering grip first, drive gets what is left of the friction circle (blended by the assist)
      if ((assist.tcs ?? 0) > 0 && st.drift < 0.5 && Fx > 0) {
        const room = 0.95 * kx * Math.sqrt(Math.max(0, cap * cap - Fy * Fy));
        const driveWant = Fx; Fx = Math.min(Fx, THREE.MathUtils.lerp(cap * kx, room, assist.tcs ** 3));
        Fx = Math.max(Fx, Math.min(driveWant * (0.25 + 0.875 * (1 - assist.tcs)), cap * kx));   // drive floor (Casual 25%, Sport 60% of the request): a high-g corner never bogs; Pro has no clamp
        tcsDrive = Math.max(tcsDrive, 1 - Fx / driveWant);   // Casual reserves all the cornering grip, Sport a third of it (the tail can step out), Pro none
      }
      const sgn = Math.sign(vl);
      const stopForce = Math.abs(vl) * spec.mass / (4 * h);
      // ABS-like stop clamp: brakes oppose motion without kicking a stationary car backwards.
      // steering-reserving ABS: the brake takes what the circle leaves after the lateral demand (the rear all of it, the front
      // by tier), the same priority traction control gives cornering over drive
      const keep = w.front ? absKeep(assist) : absKeepRear(assist), brakeRoom = Math.sqrt(Math.max(0, cap * cap - (keep * Fy) ** 2));
      const share = w.front ? 0.95 + 0.05 * bias : 0.75 - 0.2 * bias;
      const brakeWant = pedals.brake * share * (spec.brakeK ?? 1) * cap;
      Fx -= sgn * Math.min(stopForce, brakeWant, brakeRoom);
      if (brakeWant > 1 && brakeRoom < Math.min(stopForce, brakeWant)) absCut = Math.max(absCut, 1 - brakeRoom / brakeWant);
      if (!w.front) Fx -= sgn * Math.min(stopForce, ctl.handbrake * cap);
      Fx -= vl * w.load * (0.0006 + w.surface.drag * 0.02);
      // friction circle
      const F = Math.hypot(Fx / (Fx > 0 ? kx : 1), Fy);
      // an overloaded tyre keeps its pull or braking and loses cornering faster (the force follows the slip, mostly along the wheel):
      // this is what lets a rear wheel under too much throttle or the handbrake step out
      if (F > cap && F > 0) { w.slip = F / cap - 1; Fx *= cap / F; Fy *= (cap / F) ** 1.5; }
      // wheelspin (smoke, the tyre's visual spin): only at launch speeds, and traction control mostly prevents it
      if (w.driven && Math.abs(driveTotal / nDriven) > cap * 0.95) spin = Math.max(spin, Math.min(1, (Math.abs(driveTotal / nDriven) / cap - 0.95) * 2) * (1 - THREE.MathUtils.smoothstep(speed, 6, 18)) * (1 - 0.7 * (assist.tcs ?? 0)));
      if (!w.front) latSlipRear += Math.abs(Math.sin(slipAngle)) / 2;
      w.omegaR = vl + (w.driven ? spin * 12 : 0);
      // suspension along the contact normal at the contact; tyre forces a little above it (less roll torque)
      rb.applyImpulseAtPoint(n.clone().multiplyScalar(w.loadSusp * h), p, true);
      { const Fh = f.clone().multiplyScalar(Fx).addScaledVector(s, Fy); tyreF.add(Fh); tyreMz += up.dot(v3().crossVectors(p.clone().addScaledVector(up, 0.2).sub(comW), Fh)); }
      rb.applyImpulseAtPoint(f.multiplyScalar(Fx * h).add(s.multiplyScalar(Fy * h)).add(n.multiplyScalar(-down * (w.front ? 0.225 : 0.275) * h)), p.clone().addScaledVector(up, 0.2), true);
    }
    // anti-roll bars: resist the difference in compression across each axle
    for (const [a, b] of [[0, 1], [2, 3]]) {
      const A = this.wheels[a], B = this.wheels[b], tune=spec.arcade??{};
      const limit=Math.min(A.staticLoad,B.staticLoad)*(tune.antiRollLimit??.6);
      const d=THREE.MathUtils.clamp((A.comp-B.comp)*A.k*(tune.antiRoll??.6),-limit,limit);
      // the more compressed side is pushed back up, the other side pulled down: the body stays level
      if (A.contact) rb.applyImpulseAtPoint(up.clone().multiplyScalar(d * h), v3().set(A.x, A.mountY, A.z).applyQuaternion(q).add(pos), true);
      if (B.contact) rb.applyImpulseAtPoint(up.clone().multiplyScalar(-d * h), v3().set(B.x, B.mountY, B.z).applyQuaternion(q).add(pos), true);
    }
    // ---- arcade layer on: off in the air, backing up and at a crawl (the tyre model drives there). It takes over turning, aligning and
    // drifting, so the old yaw damping, catch torque and slide recovery stand down by the same amount
    const arc = backing || pedals.drive < 0 || onGround < 3 ? 0 : THREE.MathUtils.smoothstep(vF, 1.5, 6), T = arcadeTier(assist.stability);
    const wetF = Math.min(1, wetGrip(wet) + (spec.wetRetention ?? 0) * wet), surf = surfaceGrip / Math.max(1, onGround);
    this.arcG = arcadeAccel(T, spec.grip, wetF, surf, 0, spec.mass, 0) / G;
    const aMax = arcadeAccel(T, spec.grip, wetF, surf, spec.downforce, spec.mass, speed) * (1 - 0.25 * pedals.brake);   // lateral m/s2 on offer; braking leaves most of it
    this.dbg.arc = arc;
    // stability assist: damp the yaw rate beyond what the steering asks for (kinematic v·tanδ/L), never the turn itself;
    // keeps a mistimed lift or a kerb strike from snapping the car round (off in drift mode)
    // (a wet road lets the assist work half again as hard: less grip means less room for a late correction)
    // from the driver's steering only: the countersteer must not ask for yaw the other way (that made the car fishtail)
    // one-sided: a yaw rate between zero and the demand is left alone. The demand is the no-slip rate, which a car at the grip
    // limit (always, on a wet road) cannot reach: pushing toward it spun the car round whenever the wheel was held over
    // the demand is capped at what the tyres can turn (grip / v, with 15% to spare so a car cornering at the limit is left alone):
    // a car rotating faster than that is sliding, not turning
    const yawKin = vF * Math.tan(st.steerInput) / this.wheelbase, yawWant = Math.sign(yawKin) * Math.min(Math.abs(yawKin), 1.15 * gripAcc / Math.max(Math.abs(vF), 3)), yawRate = ang.dot(up);
    const yawErrRaw = yawRate - Math.min(Math.max(yawRate, Math.min(0, yawWant)), Math.max(0, yawWant));
    // the stability torque is yaw damping: proportional to the error past the slip gate, rate-limited (8 rad/s per s) so it never snaps
    const yawErr = st.yawErr = (st.yawErr ?? 0) + THREE.MathUtils.clamp(yawErrRaw - (st.yawErr ?? 0), -8 * h, 8 * h);
    const gateS = Math.max(gate, 1 - Math.min(1, Math.abs(ctl.steer) * 3));   // hands off the wheel the yaw damping works at any slide angle: a car left rotating with the wheel straight has no driver to wait for (a held lock still waits for the slip gate)
    const antiSpin = Math.max(1 - st.drift, THREE.MathUtils.smoothstep(Math.abs(st.beta), 0.8, 1.2));   // back on at big angles, even drifting
    const stabAcc = yawErr * spec.mass * 0.8 * assist.stability * (1 + 0.5 * wet) * antiSpin * gateS * (1 - arc) / this.Iy;   // rad/s2
    esc = Math.max(esc, Math.min(1, Math.abs(stabAcc) / 1.5));
    this.dbg.yawErr = yawErr; this.dbg.yawWant = yawWant; this.dbg.stab = stabAcc; this.dbg.spin = gate;
    if (onGround) rb.applyTorqueImpulse(up.clone().multiplyScalar(-yawErr * spec.mass * 0.8 * assist.stability * (1 + 0.5 * wet) * antiSpin * gateS * (1 - arc) * h), true);
    // catching a slide: a yaw moment against the slide angle, only once the car is really sliding (gate) and not on purpose (drift mode)
    this.dbg.catch = 0;
    if (onGround && gate > 0) {
      const c = -Math.sign(st.beta) * Math.min(Math.abs(st.beta), 0.7) * (spec.arcade?.catchGain ?? 3) * assist.stability * (1 + 0.5 * wet) * antiSpin * gate * (1 - arc);
      this.dbg.catch = c; esc = Math.max(esc, Math.min(1, Math.abs(c) / 2)); rb.applyTorqueImpulse(up.clone().multiplyScalar(c * this.Iy * h), true);
    }
    if(spec.arcade&&!ctl.handbrake){
      // hands off the wheel the recovery starts at the default 4 deg (a stuck 6-8 deg slide just needs the road to catch it); a held lock keeps the tier's slip gate
      const g0 = Math.tan(spinStart(assist.stability)), g1 = Math.tan(spinStart(assist.stability)+SPIN_FADE)-g0, own = Math.min(1, Math.abs(ctl.steer) * 2), t0 = 0.07 + (g0 - 0.07) * own, w0 = 0.15 + (g1 - 0.15) * own;
      const a=recoveryAcceleration(backing?0:vR,speed,onGround,surfaceGrip/Math.max(1,onGround),st.drift,assist.stability,spec.arcade,t0,w0)*wetGrip(wet)*(1-arc);
      this.dbg.recov = a; esc = Math.max(esc, Math.min(1, Math.abs(a) / (0.12 * G)));
      if(a)rb.applyImpulse(right.clone().multiplyScalar(a*spec.mass*h),true);
    }
    // drift target (drift mode): the driver's steering sets the angle (neutral ~39°, into the turn 50°, countersteered 30°); the arcade layer below turns the car to it
    if (st.drift > 0.05 && speed > 8 && onGround) {
      // the slide's direction: the driver's steering until the car is clearly sideways (a near-zero angle is noise)
      st.driftDir ||= Math.abs(st.beta) > 0.05 ? Math.sign(st.beta) : Math.sign(ctl.steer) || 1;
      const into = ctl.steer * st.driftDir;
      const target = st.driftDir * THREE.MathUtils.clamp(0.68 + 0.2 * into, 0.52, 0.9);   // neutral ~39 deg, into the turn 50, countersteered 30
      st.target = target;
    } else st.driftDir = 0;
    st.betaPrev = st.beta;
    // ---- arcade layer: the turn rate, the alignment of the velocity with the heading, the drift path and the brakes
    if (arc > 0) {
      const d = st.drift, m = spec.mass, hb = Math.min(1, ctl.handbrake), vh = lin.clone().addScaledVector(up, -lin.dot(up)).normalize(), left = up.clone().cross(vh);
      const tyreAcc = tyreF.clone().divideScalar(m), tLat = tyreAcc.dot(right);
      // A. the steering asks for a yaw rate (the wheel angle's kinematic rate, capped at what aMax can turn); catch: with the wheel free the heading comes back to the path
      let yawT = arcadeYaw(Math.max(vF, 0.1), ctl.steer * this.steerLock(speed), this.wheelbase, aMax * yawFade(speed)) - Math.sign(st.beta) * Math.min(Math.abs(st.beta), 0.7) * T.catchYaw * (1 - Math.min(1, Math.abs(ctl.steer) * 2));
      // C. drift: the velocity keeps rotating at a set rate (course rate) and the heading is held at the target angle
      let course = 0;
      if (d > 0.05 && st.driftDir) {
        course = st.driftDir * Math.min(0.68 * aMax / Math.max(speed, 8), 0.9) * (0.8 + 0.2 * ctl.steer * st.driftDir);
        yawT = THREE.MathUtils.lerp(yawT, course + THREE.MathUtils.clamp(5 * (st.target - st.beta), -2.2, 2.2), d);
      }
      // the yaw rate goes to the target at once (no overshoot) and the tyres' own yaw moment is taken out so they do not fight it
      rb.applyTorqueImpulse(up.clone().multiplyScalar(this.Iy * ((yawT - yawRate) * (1 - Math.exp(-(d > 0.3 ? 25 : 1 / yawTau(speed)) * h)) * arc) - 0.9 * arc * tyreMz * h), true);
      // B. alignment: lateral velocity is pulled out (the grip turns the travel direction with the heading), within the lateral g left after the tyres' own
      const aA = THREE.MathUtils.clamp(-T.align * vR * (1 - d) * (1 - hb), -aMax - tLat, aMax - tLat);
      const F = right.clone().multiplyScalar(aA);
      // C. drift path: the tyres' sideways force is replaced by the centripetal one for the course rate; their drag along the path is mostly given back
      if (d > 0.05) F.addScaledVector(left, d * (speed * course - tyreAcc.dot(left))).addScaledVector(vh, -0.85 * d * Math.min(0, tyreAcc.dot(vh)));
      rb.applyImpulse(F.multiplyScalar(m * h * arc), true);
    }
    // D. arcade braking: the pedal gives T.brake g (less in the wet, per car by its brake data); the tyres' own braking counts towards it
    if (pedals.brake > 0 && vF > 1 && onGround >= 3 && !backing) {
      const want = T.brake * G * pedals.brake * wetF * Math.min(1, surf) * Math.sqrt(spec.brakeK ?? 1), have = Math.max(0, -tyreF.dot(fwd) / spec.mass);
      const extra = Math.max(0, want - have) * THREE.MathUtils.smoothstep(vF, 0.3, 2);
      rb.applyImpulse(fwd.clone().multiplyScalar(-Math.min(extra * h, 0.9 * vF) * spec.mass), true);
    }
    // a locked rear dragging the car sideways scrubs speed before the drift takes over (the layer holds the speed once it has)
    if (ctl.handbrake > 0.5 && speed > 8 && onGround) rb.applyImpulse(lin.clone().normalize().multiplyScalar(-spec.mass * G * 0.6 * hbHold * (1 - st.drift) * THREE.MathUtils.smoothstep(Math.abs(st.beta), 0.15, 0.5) * h), true);

    // what the HUD's TCS / ABS / ESC tags show, 0..1: how much of the drive, the brake, the steering and yaw the aids took this step
    st.tcsActive = Math.min(1, Math.max(1 - tc, tcsDrive)) * Math.min(1, st.drive * 10);
    st.absActive = pedals.brake > 0.05 && speed > 2 ? Math.min(1, absCut) : 0;
    st.escActive = Math.min(1, esc);
    this.onGround = onGround; this.spinSlip = spin; this.latSlip = latSlipRear; this.speed = speed; this.vForward = vF;
    // upside down for a while: reset (see respawn)
    st.upsideDown = up.y < 0.25 ? st.upsideDown + h : 0;
    this.capture();
    // body-frame acceleration for the camera and the visual lean
    const vb = v3().set(vF, lin.dot(up), vR);
    this.aBody.lerp(vb.clone().sub(this.vPrevBody).divideScalar(h), 0.2); this.vPrevBody.copy(vb);
  }

  /** interpolated pose for rendering (alpha 0..1 between the last two steps) */
  pose(alpha, pos, quat) { pos.lerpVectors(this.prev.pos, this.cur.pos, alpha); quat.slerpQuaternions(this.prev.quat, this.cur.quat, alpha); }

  get yaw() { const f = v3().set(1, 0, 0).applyQuaternion(this.cur.quat); return Math.atan2(-f.z, f.x); }

  resetControls() {
    Object.assign(this.controls,{throttle:0,brake:0,steer:0,handbrake:0,nitro:0,reset:false,hold:false});
    Object.assign(this.state,{hit:0,vPrev:null,tcsActive:0,absActive:0,escActive:0,shift:0,shiftSlow:0,hbT:0,steer:0,steerInput:0,drive:0,driveDirection:0,driveInput:0,serviceBrake:0,reverse:false,stopTime:0,drift:0,driftHold:0,driftDir:0,prevBrake:0,beta:0,betaPrev:0,yawErr:0,target:0,upsideDown:0,nitroOn:false});
  }

  /** put the car back on the track: position, heading, standing still */
  respawn(pos, yaw) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.rb.setTranslation({ x: pos.x, y: pos.y + 0.3, z: pos.z }, true); this.rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.rb.setLinvel({ x: 0, y: 0, z: 0 }, true); this.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.resetControls();
    this.aBody.set(0,0,0); this.vPrevBody.set(0,0,0);
    this.speed = this.vForward = this.latSlip = this.spinSlip = 0;
    for(const w of this.wheels) { w.omegaR = 0; w.comp = 0.065; }
    this.capture(); this.prev.pos.copy(this.cur.pos); this.prev.quat.copy(this.cur.quat);
  }
}

function toQ(r) { return new THREE.Quaternion(r.x, r.y, r.z, r.w); }
