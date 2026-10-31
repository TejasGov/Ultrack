// Who drives each car: the player (keyboard or gamepad) or the AI (the racing line).
import * as THREE from 'three';
import { neutralControls, padSteer, padIntent, keyboardSteer, keyboardBrake, steerScale, driving } from './player-controls.js';
import { wetGrip, road } from './weather.js';

/**
 * Player input. Keyboard: W/↑ throttle, S/↓ brake (reverse when stopped), A/← D/→ steer, Space handbrake,
 * Shift nitro, R reset to the track. Gamepad: right trigger throttle, left trigger brake, left stick steer
 * (dead zone .18, response curve ^1.6), A handbrake, X nitro, Y reset. Keyboard steering ramps in and springs back,
 * so a tap is a small correction and holding gives full lock.
 */
export class PlayerInput {
  constructor({ target = globalThis, doc = globalThis.document, pads = () => globalThis.navigator?.getGamepads?.() ?? [] } = {}) {
    this.keys = new Set(); this.steer = 0; this.hold = { t: 0, dir: 0 }; this.brake = 0; this.reset = false; this.enabled = true;
    this.pads = pads; this.padActive = false; this.padResetHeld = false; this.debug = {};
    this.listeners = [];
    const on = (obj, name, fn) => { obj?.addEventListener(name, fn); this.listeners.push(() => obj?.removeEventListener(name, fn)); };
    on(target, 'keydown', e => {
      if(e.defaultPrevented)return;
      if (['MetaLeft', 'MetaRight', 'Escape'].includes(e.code) || e.metaKey) { this.clear(); return; }
      if (!this.enabled || e.target?.closest?.('input, textarea, select, [contenteditable], .lil-gui')) return;
      this.keys.add(e.code); if (e.code === 'KeyR' && !e.repeat) this.reset = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    on(target, 'keyup', e => this.keys.delete(e.code));
    on(target, 'blur', () => this.clear());
    on(target, 'gamepaddisconnected', () => this.clear());
    on(doc, 'visibilitychange', () => { if (doc.hidden) this.clear(); });
    on(doc, 'focusin', e => { if (e.target?.closest?.('input, textarea, select, button, [contenteditable]')) this.clear(); });
  }
  // a respawn (preserveResetLatch) keeps held keys: the OS auto-repeats only the last-pressed key (R), so a held W would stay dead
  clear({preserveResetLatch=false}={}) { if(!preserveResetLatch)this.keys.clear(); this.steer = 0; this.hold.t = 0; this.hold.dir = 0; this.brake = 0; this.reset = false; this.padActive = false; if(!preserveResetLatch)this.padResetHeld = false; this.debug = {}; }
  setEnabled(on) { if (this.enabled !== on) this.clear(); this.enabled = on; }
  dispose() { this.listeners.forEach(f => f()); this.clear(); }
  read(dt, speed = driving.speed) {
    if (!this.enabled) return neutralControls();
    const k = (...c) => c.some(x => this.keys.has(x)) ? 1 : 0;
    let throttle=k('KeyW','ArrowUp'), brake=this.brake=keyboardBrake(this.brake,k('KeyS','ArrowDown'),dt), handbrake=k('Space'), nitro=k('ShiftLeft','ShiftRight');
    const want=k('KeyA','ArrowLeft')-k('KeyD','ArrowRight');
    this.steer=keyboardSteer(this.steer,want,dt,speed,this.hold);
    let steer=this.steer, source='keyboard';
    const pads=Array.from(this.pads()), pad=pads.find(g=>g?.connected && padIntent(g)) ?? pads.find(g=>g?.connected);
    if (pad) {
      this.padActive ||= padIntent(pad);
      // A held keyboard direction always wins, including its spring-back.
      if (this.padActive && !want && !throttle && !brake && !handbrake && Math.abs(this.steer)<0.01) { steer=padSteer(pad.axes[0])*steerScale(speed); source='gamepad'; }
      const pressed=!!pad.buttons[3]?.pressed;
      if (this.padActive) {
        const b=i=>Math.max(0,Math.min(1,pad.buttons[i]?.value??0));
        throttle=Math.max(throttle,b(7)); brake=Math.max(brake,b(6)); handbrake=Math.max(handbrake,b(0)); nitro=Math.max(nitro,b(2));
        if(pressed&&!this.padResetHeld)this.reset=true;
      }
      this.padResetHeld=pressed;
    } else { this.padActive=false;this.padResetHeld=false; }
    const reset=this.reset;this.reset=false;
    this.debug={pad:pad?.id,axes:pad?.axes?.slice(),source,steer};
    return {throttle,brake,steer,handbrake,nitro,reset,player:true};
  }
}

/**
 * AI driver on the racing line: pure-pursuit steering at a look-ahead that grows with speed, and a target speed
 * from the field's grip-limited speed profile (Field.vt) scaled by the car's grip and the driver's pace.
 * `lane` (m, + = left of the line) lets the field spread out and pass.
 */
export class AIDriver {
  constructor(field, car, pace = 1) { this.field = field; this.car = car; this.pace = pace; this.i = 0; this.lane = 0; }

  read(v) {
    const F = this.field, line = F.linePts, N = line.length;
    const p = v.cur.pos, fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(v.cur.quat);
    // progress: walk forward from the last index to the nearest line point
    let best = Infinity;
    for (let k = -3; k < 40; k++) { const j = (this.i + k + N) % N, d = line[j].distanceToSquared(p); if (d < best) { best = d; this.iNext = j; } }
    this.i = this.iNext;
    // traffic (as the kinematic drive() does): a car ahead or alongside, under 2.4 m to the side, moves this one's lane 3 m
    // out on the side it already holds and, 1.5-12 m behind it, holds that car's speed instead of pushing it. Without it neighbours
    // on the +-0.6 m lanes locked together at full lock and slid into the outside wall as a pair. The offset is from the car's own
    // lane, not from the other car: chasing a car that is itself moving aside walked pairs out to 9 m and into the barrier.
    // Positions, not ai.i: a player-driven hero never updates its ai.i
    const LL = F.lineLeft, lat = (q, k) => (q.x - line[k].x) * LL[k].x + (q.z - line[k].z) * LL[k].z;
    const along = (q, k) => (q.z - line[k].z) * LL[k].x - (q.x - line[k].x) * LL[k].z;          // line tangent = (-left.z, left.x)
    const myLat = lat(p, this.i), ds = line[this.i].distanceTo(line[(this.i + 1) % N]);
    let blk = null, near = false;
    for (const o of F.cars ?? []) {
      const q = o.vehicle?.cur.pos;
      if (o === this.car || !q || q.distanceToSquared(p) > 1600) continue;
      let kb = 0, db = Infinity;
      for (let n = -2; n <= 10; n++) { const d = line[(this.i + n + N) % N].distanceToSquared(q); if (d < db) { db = d; kb = n; } }
      const k = (this.i + kb + N) % N, gap = kb * ds + along(q, k) - along(p, this.i), oLat = lat(q, k);
      near ||= gap > -6 && gap < 30 && Math.abs(oLat - myLat) < 4.5;
      if (gap > -4 && gap < 30 && Math.abs(oLat - myLat) < 2.4 && (!blk || Math.abs(gap) < Math.abs(blk.gap))) blk = { gap, lat: oLat, speed: o.vehicle.speed, car: o };
    }
    const speed = v.speed, look = 6 + speed * 0.55;
    let j = this.i, acc = 0;
    while (acc < look) { const a = line[j], b = line[(j + 1) % N]; acc += a.distanceTo(b); j = (j + 1) % N; }
    // the lane stays on the asphalt (track.json halfWidth around the centre line, racingLine = the line's offset from it), judged at
    // the pursuit target: Marina's line swings edge to edge in 30-50 m, so a lane legal under the car is in the wall 20 m on
    const T = F.track, r = T?.halfWidth ? Math.floor(j / N * T.halfWidth.length) : -1;
    const room = r < 0 ? 6 : T.halfWidth[r] - 1.6, rl = r < 0 ? 0 : T.racingLine?.[r] ?? 0, lo = Math.min(-room - rl, this.lane), hi = Math.max(room - rl, this.lane);
    // the side is picked once per pass: flipping it mid-pass swerved the car across the one it was passing. A side kept for another
    // car that points at this one is picked again: from the grid it steered a follower into the car it touched, and the two crawled
    // locked together for 20 s (India V5.6)
    if (blk) { if (!this.passSide || (this.passCar !== blk.car && Math.sign(blk.lat - myLat) === this.passSide)) { this.passCar = blk.car; this.passSide = myLat >= blk.lat ? 1 : -1; const w = this.lane + this.passSide * 3; if (w > hi || w < lo) this.passSide = -this.passSide; } }
    else if (!near) this.passSide = 0;                                // hold the passing lane until the car is 6 m behind
    const laneWant = this.passSide ? this.lane + this.passSide * 3 : this.lane;   // passSide is unset until a first car is near
    // 0.4 s out, 0.8 s back: the pursuit target never snaps; clamped as eased, so the way back never runs off the asphalt either
    this.laneNow = THREE.MathUtils.clamp((this.laneNow ?? this.lane) + (laneWant - (this.laneNow ?? this.lane)) * (blk ? 0.02 : 0.01), lo, hi);
    const target = line[j].clone().addScaledVector(F.lineLeft[j], this.laneNow);
    const to = target.sub(p), left = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
    const ang = Math.atan2(to.dot(left), to.dot(fwd));                  // + = target is to the left
    // curvature feedback: the wheel angle that would hold the pursuit curve with no slip, corrected by the curvature the car
    // really has (yaw rate / speed), so understeer on a wet road does not carry it 3-4 m wide
    const kappa = 2 * Math.sin(ang) / Math.max(look, 1), kAct = v.rb.angvel().y / Math.max(speed, 8);
    const steerRad = Math.atan(v.wheelbase * kappa) + (1) * v.wheelbase * (kappa - kAct);
    const want = steerRad / v.steerLock(speed), steer = THREE.MathUtils.clamp(want, -1, 1);
    // speed: the profile a little ahead (braking points), scaled by grip
    // the slowest point of the next ~45 m (linePts share vt's sampling): never on the power before the corner is done
    let vmin = Infinity; for (let k = 0; k <= 10; k++) vmin = Math.min(vmin, F.vt[(this.i + k) % N]);
    let vt = vmin * this.pace * Math.sqrt(v.spec.grip / 1.15 * wetGrip()) * (1 - 0.04 * road.wet);   // a wet road lowers every corner speed with the grip, and a little more for the braking margin
    if (blk && blk.gap > 1.5 && blk.gap < 12) vt = Math.min(vt, blk.speed * (blk.gap < 6 ? 0.9 : 1));   // follow, then pass once the lane is clear
    const e = vt - speed;
    // no progress for 4 s (stuck in a wall or a gravel trap): ask the field for a respawn
    this.stuck = speed < 3 ? (this.stuck ?? 0) + 1 / 120 : 0;
    if (this.stuck > 4) return { throttle: 0, brake: 0, steer: 0, handbrake: 0, nitro: 0, reset: true };
    // facing away from the line (after a spin): full lock toward it at low throttle, a U-turn
    if (Math.abs(ang) > 1.7) return { throttle: 0.35, brake: 0, steer: Math.sign(ang), handbrake: 0, nitro: 0 };
    // past full lock and drifting off its lane (pushed wide by a car alongside): lift and brake a little rather than drive on
    // at full lock into the outside wall; a clean lap never gets here, so its lap time is untouched
    if (Math.abs(want) > 1.15 && speed > 12 && Math.abs(myLat - this.laneNow) > 1.5) return { throttle: 0, brake: THREE.MathUtils.clamp((Math.abs(want) - 1) * 0.6, 0, 0.5), steer, handbrake: 0, nitro: 0 };
    return { throttle: THREE.MathUtils.clamp(0.25 + e * 0.35, 0, 1), brake: THREE.MathUtils.clamp(-e * 0.18 - 0.05, 0, 1), steer, handbrake: 0, nitro: 0 };
  }
}
