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
  clear({preserveResetLatch=false}={}) { this.keys.clear(); this.steer = 0; this.hold.t = 0; this.hold.dir = 0; this.brake = 0; this.reset = false; this.padActive = false; if(!preserveResetLatch)this.padResetHeld = false; this.debug = {}; }
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
    const speed = v.speed, look = 6 + speed * 0.55;
    let j = this.i, acc = 0;
    while (acc < look) { const a = line[j], b = line[(j + 1) % N]; acc += a.distanceTo(b); j = (j + 1) % N; }
    const target = line[j].clone().addScaledVector(F.lineLeft[j], this.lane);
    const to = target.sub(p), left = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
    const ang = Math.atan2(to.dot(left), to.dot(fwd));                  // + = target is to the left
    // curvature feedback: the wheel angle that would hold the pursuit curve with no slip, corrected by the curvature the car
    // really has (yaw rate / speed), so understeer on a wet road does not carry it 3-4 m wide
    const kappa = 2 * Math.sin(ang) / Math.max(look, 1), kAct = v.rb.angvel().y / Math.max(speed, 8);
    const steerRad = Math.atan(v.wheelbase * kappa) + (1) * v.wheelbase * (kappa - kAct);
    const steer = THREE.MathUtils.clamp(steerRad / v.steerLock(speed), -1, 1);
    // speed: the profile a little ahead (braking points), scaled by grip
    // the slowest point of the next ~45 m (linePts share vt's sampling): never on the power before the corner is done
    let vmin = Infinity; for (let k = 0; k <= 10; k++) vmin = Math.min(vmin, F.vt[(this.i + k) % N]);
    const vt = vmin * this.pace * Math.sqrt(v.spec.grip / 1.15 * wetGrip()) * (1 - 0.04 * road.wet);   // a wet road lowers every corner speed with the grip, and a little more for the braking margin
    const e = vt - speed;
    // no progress for 4 s (stuck in a wall or a gravel trap): ask the field for a respawn
    this.stuck = speed < 3 ? (this.stuck ?? 0) + 1 / 120 : 0;
    if (this.stuck > 4) return { throttle: 0, brake: 0, steer: 0, handbrake: 0, nitro: 0, reset: true };
    // facing away from the line (after a spin): full lock toward it at low throttle, a U-turn
    if (Math.abs(ang) > 1.7) return { throttle: 0.35, brake: 0, steer: Math.sign(ang), handbrake: 0, nitro: 0 };
    return { throttle: THREE.MathUtils.clamp(0.25 + e * 0.35, 0, 1), brake: THREE.MathUtils.clamp(-e * 0.18 - 0.05, 0, 1), steer, handbrake: 0, nitro: 0 };
  }
}
