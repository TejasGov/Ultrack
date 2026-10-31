// Vapor: exhaust steam at idle and low speed, the soot puff after a pop, and the wet road's water: emitters into the soft particle
// pool (fx-smoke.js), which lights, sorts and draws them. Steam rises and meanders and is gone at speed; electric cars have none.
// In the wet a tyre throws water, not smoke: at speed each rear tyre lifts a rooster tail of droplets (STREAK, stretched along their
// flight) that falls back, and leaves a haze (MIST) hanging behind the car that the next car drives into; a spinning or sliding tyre
// throws a burst of spray even at walking pace. Spray is lit like the smoke (the frame's own light) but darker and bluer: water.
import { clamp, sstep, rnd } from './fx-pool.js';
import { SMOKE, MIST, STREAK } from './fx-smoke.js';

export class Vapor {
  constructor(soft) {
    this.soft = soft;
    this.steamN = 0; this.sprayN = 0;     // particles emitted so far (the tests)
  }

  /** steam from the pipes: thin plumes that rise and thin out (thicker when cold or damp), a puff on a throttle blip; only near a
   *  standstill (once moving, the airflow disperses it: emitted at speed it was a string of beads behind the car) */
  steam(fx, c, S, throttle, dt, v, speed, q) {
    const amt = 1 - sstep(1, 12, speed);
    if (amt < 0.02) return;
    const cold = clamp(0.3 + 0.5 * (1 - S.warm) + 0.35 * fx.damp, 0, 1), s = this.soft.s;
    const rate = (6 + 4 * throttle) * amt * (0.5 + 0.7 * cold) * q * fx.steamK;
    const puff = S.blip === 1 ? 2 : 0;
    for (const a of c.exhausts ?? []) {
      a._acc = (a._acc ?? Math.random()) + rate * dt;
      let k = puff + (a._acc | 0); a._acc -= a._acc | 0;
      if (!k) continue;
      fx.anchor(a);
      const { p, d } = fx.tmp, exit = 0.5 + 2 * throttle, big = puff ? 1.4 : 1;
      this.steamN += k;
      while (k-- > 0) {
        s.x = p.x + d.x * 0.05; s.y = p.y + d.y * 0.05; s.z = p.z + d.z * 0.05;
        s.vx = v.x * 0.8 + d.x * exit + rnd(0.12); s.vy = v.y * 0.8 + d.y * exit + 0.3 + rnd(0.1); s.vz = v.z * 0.8 + d.z * exit + rnd(0.12);
        s.life = (0.7 + Math.random() * 0.5) * (0.75 + 0.4 * cold); s.s0 = 0.05; s.s1 = (0.2 + Math.random() * 0.16 + 0.1 * throttle) * big; s.grow = 0.35;
        s.a0 = (0.2 + 0.22 * cold) * (0.6 + 0.4 * amt) * (1 - 0.6 * throttle) * big * Math.min(1, 0.4 + 0.6 * fx.steamK);      // hot exhaust at full throttle condenses less
        s.r = 0.88; s.g = 0.89; s.b = 0.92; s.kind = MIST; s.drag = 2.4; s.rise = 0.7; s.turb = 0.35; s.gnd = c.root.position.y; s.own = c._fxI ?? 0; s.fin = 0.06; s.spin = 0.4;
        this.soft.emit();
      }
    }
  }

  /** the grey soot puff after a pop: small, carries the car's speed, rises and thins out */
  puff(fx, c, p, d, v, sz, dull) {
    const s = this.soft.s;
    s.x = p.x + d.x * 0.12; s.y = p.y + d.y * 0.12; s.z = p.z + d.z * 0.12;
    s.vx = v.x * 0.85 + d.x * 1.4 + rnd(0.25); s.vy = v.y * 0.85 + 0.4 + rnd(0.15); s.vz = v.z * 0.85 + d.z * 1.4 + rnd(0.25);
    s.life = 0.6 + Math.random() * 0.4; s.s0 = 0.06; s.s1 = (0.24 + 0.14 * Math.random()) * sz; s.grow = 0.22;
    s.a0 = (0.3 + 0.1 * Math.random()) * (1 - 0.3 * dull);
    s.r = 0.36; s.g = 0.34; s.b = 0.32; s.kind = SMOKE; s.drag = 1.8; s.rise = 0.5; s.turb = 0.5; s.gnd = c.root.position.y; s.own = c._fxI ?? 0; s.fin = 0.03; s.spin = 0.6;
    this.soft.emit();
  }

  /** wet road at speed: rooster tails off every tyre (the rears' tall, the fronts' low) and a haze behind the car (none in the dry) */
  spray(fx, c, dt, v, speed, fw, q) {
    const wet = fx.wet;
    if (wet < 0.02 || speed < 5 || !c.wheels || q <= 0) return;
    const sf = clamp((speed - 5) / 50, 0, 1), root = c.root.position, s = this.soft.s;
    for (const w of c.wheels) {
      const rear = w.axle === 'rear', p = w.pivot.getWorldPosition(fx.tmp.w), r = w.spec?.radius ?? 0.34;
      const out = Math.sign((p.x - root.x) * fw.z - (p.z - root.z) * fw.x) || 1;
      w._spray = (w._spray ?? Math.random()) + 150 * Math.pow(sf, 1.1) * wet * q * (rear ? 1 : 0.3) * dt;
      for (; w._spray >= 1; w._spray--) {
        // droplets thrown up and back off the tread, left hanging behind the car, falling back to the road
        const up = (1.2 + 4.2 * sf) * (0.45 + 0.75 * Math.random()) * (rear ? 1 : 0.55), side = out * (0.2 + 1.3 * Math.random()), inh = 0.4 + 0.3 * Math.random();     // the car's wake carries it
        s.x = p.x - fw.x * r * 0.9 + rnd(0.08); s.y = root.y + 0.08; s.z = p.z - fw.z * r * 0.9 + rnd(0.08);
        s.vx = v.x * inh + fw.z * side + rnd(0.3); s.vy = up; s.vz = v.z * inh - fw.x * side + rnd(0.3);
        s.life = 0.35 + 0.35 * Math.random(); s.s0 = 0.04; s.s1 = 0.12 + 0.1 * sf; s.grow = 0.2;
        s.a0 = (0.35 + 0.35 * Math.random()) * wet * (0.5 + 0.5 * sf);
        s.r = 0.6; s.g = 0.64; s.b = 0.69; s.kind = STREAK; s.drag = 2.2; s.rise = -7.5; s.turb = 0.3; s.gnd = root.y; s.own = c._fxI ?? 0; s.fin = 0.02; s.spin = 0;
        if (this.soft.emit()) this.sprayN++;
      }
      if (!rear) continue;
      w._mist = (w._mist ?? Math.random()) + 36 * Math.pow(sf, 1.3) * wet * q * dt;
      for (; w._mist >= 1; w._mist--) {
        // the haze: fine water hanging in the air behind the car, slowly falling behind it, thinning out
        const inh = 0.45 + 0.2 * Math.random(), side = out * Math.random() * 0.8;
        s.x = p.x - fw.x * (r + 0.4 * Math.random()) + rnd(0.2); s.y = root.y + 0.3 + Math.random() * 0.6; s.z = p.z - fw.z * (r + 0.4 * Math.random()) + rnd(0.2);
        s.vx = v.x * inh + fw.z * side; s.vy = 0.3 + 0.3 * Math.random(); s.vz = v.z * inh - fw.x * side;
        s.life = 1.2 + 1.0 * Math.random(); s.s0 = 0.4; s.s1 = (1.3 + 1.4 * sf) * (0.8 + 0.4 * Math.random()); s.grow = 0.5;
        s.a0 = (0.16 + 0.14 * Math.random()) * wet * sf;
        s.r = 0.72; s.g = 0.75; s.b = 0.79; s.kind = MIST; s.drag = 1.0; s.rise = 0.12; s.turb = 0.5; s.gnd = root.y; s.own = c._fxI ?? 0; s.fin = 0.15; s.spin = 0.25;
        if (this.soft.emit()) this.sprayN++;
      }
    }
  }

  /** a spinning, sliding or locked tyre on a wet road: a burst of spray off the tread and a little mist, at any speed */
  tyreWater(fx, c, p, fw, out, r, v, k, rear, dt, q) {
    const wet = fx.wet, s = this.soft.s, root = c.root.position;
    c._wtr ??= {}; const key = rear ? (out > 0 ? 'rl' : 'rr') : (out > 0 ? 'fl' : 'fr');
    c._wtr[key] = (c._wtr[key] ?? Math.random()) + 70 * k * wet * q * dt;
    for (; c._wtr[key] >= 1; c._wtr[key]--) {
      const mist = Math.random() < 0.25, kick = rear ? 3 + 6 * k : 0.8, u = Math.random();
      s.x = p.x - fw.x * r * 0.8 + rnd(0.1); s.y = root.y + 0.08; s.z = p.z - fw.z * r * 0.8 + rnd(0.1);
      s.vx = v.x * 0.35 - fw.x * kick * (0.5 + 0.6 * u) + fw.z * out * Math.random() * 1.2; s.vy = mist ? 0.4 : 0.8 + 2.4 * Math.random(); s.vz = v.z * 0.35 - fw.z * kick * (0.5 + 0.6 * u) - fw.x * out * Math.random() * 1.2;
      if (mist) { s.life = 0.9 + 0.6 * Math.random(); s.s0 = 0.25; s.s1 = 0.7 + 0.5 * k; s.grow = 0.4; s.a0 = 0.08 * wet * (0.5 + 0.5 * k); s.kind = MIST; s.drag = 1.4; s.rise = 0.15; s.turb = 0.5; s.fin = 0.1; s.spin = 0.25; s.r = 0.72; s.g = 0.75; s.b = 0.79; }
      else { s.life = 0.3 + 0.3 * Math.random(); s.s0 = 0.03; s.s1 = 0.07; s.grow = 0.2; s.a0 = (0.3 + 0.3 * Math.random()) * wet; s.kind = STREAK; s.drag = 2.0; s.rise = -7.5; s.turb = 0.2; s.fin = 0.02; s.spin = 0; s.r = 0.6; s.g = 0.64; s.b = 0.69; }
      s.gnd = root.y; s.own = c._fxI ?? 0;
      if (this.soft.emit()) this.sprayN++;
    }
  }
}
