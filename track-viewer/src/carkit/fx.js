// Car effects: tyre smoke, wet-road spray, exhaust steam, overrun pops and nitro. Five draw calls in all (soft particles, sparks,
// flame tongues + fireballs, nitro streams), pooled GPU particles, no per-frame allocation.
//   soft    tyre smoke, steam, pop soot, spray: one sorted pool, lit by the frame, depth-faded against the scene (SmokePass)  fx-smoke.js
//   tongue  additive flame tongues and fireballs for the pops                                                                   fx-flame.js
//   fire    hot sparks thrown by a hard pop                                                                                      fx-pool.js
//   nitro   soft wide violet plasma streams from the pipes + a few puffs, a heat shimmer behind                                  fx-nitro.js
// Particles live in world space with the car's own velocity at emission plus their kick; air drag pulls them to the wind, hot gas
// rises, so the car leaves its smoke behind at speed (nothing sticks to the body) and cars that pass through it drag it along.
// Emitter anchors come from cars.js (exhaust.json: tips, nitro, fx = engine character).
//   drive(car, dt, throttle, {nitro, slip, lock, hb, pop})  one call per car per frame; returns the pops fired (for the audio).
//     slip: rear wheelspin / slide 0..1; lock: front tyres at the limit of the brakes 0..1; hb: handbrake 0..1 (locks the rear)
//   attach(composer, camera)  soft particles drawn by SmokePass (half resolution, against the scene's depth); without it they draw in the scene
//   fx.damp 0..1 (0.15 dry, 0.7 damp, 1 rain): a wet road makes spray and mist instead of white smoke.  fx.heroNitro 0..1: the player's
//   nitro level, a smooth ramp, for the screen package (main.js finalPass).
// Engine character (exhaust.json "fx"): crackle (how readily it pops, 0 = never), size (flame scale), gap (pop spacing, W16 = slow
// and deep), shift (chance of a pop on an upshift, turbo / performance cars), turbo (1: smaller, duller, cooler pops), top (top speed m/s for the virtual gearbox).
import * as THREE from 'three';
import { Pool, clamp, sstep, rnd, FIRE } from './fx-pool.js';
import { Soft, SmokePass, SMOKE } from './fx-smoke.js';
import { Nitro } from './fx-nitro.js';
import { Vapor } from './fx-vapor.js';
import { Flame } from './fx-flame.js';

const RATIOS = [0.27, 0.41, 0.54, 0.66, 0.78, 0.9, 1.03];   // same display gearbox as game/audio.js, so pops line up with the sound

const FIRE_FRAG = /* glsl */`
  vec2 d = vUv - 0.5; float r = length(d) * 2.0;
  float a = pow(max(0.0, 1.0 - r), 1.6) * vAlpha;
  gl_FragColor = vec4(vCol * a * uGain, 1.0);`;

const DEFAULT_ENGINE = { crackle: 0.8, size: 1, gap: 1, shift: 0.3, top: 85 };
const WARM = new THREE.Color(0xff8a3a), VIOLET = new THREE.Color(0xa040ff);      // the pop flash; the nitro wash
const BUDGET = { hero: 420, other: 240 };    // soft particles per car (an 8-car burnout start stays under the pool's 2600)

export class CarFx {
  constructor(scene) {
    this.soft = new Soft();
    this.flame = new Pool({ blending: THREE.AdditiveBlending, fragment: FIRE_FRAG, stretch: 0.09, gain: true, name: 'fx-fire', max: 400 });
    this.nitroFx = new Nitro(); this.vapor = new Vapor(this.soft); this.tongue = new Flame();
    // the objects other code hides for reflection captures (a Group hides all its draws at once)
    this.smoke = new THREE.Group(); this.smoke.name = 'fx-smoke-group'; this.smoke.add(this.soft.mesh); this.soft.group = this.smoke;
    this.fire = new THREE.Group(); this.fire.name = 'fx-fire-group'; this.fire.add(this.flame.mesh, this.tongue.pool.mesh, this.tongue.glow.mesh, this.nitroFx.puffs.mesh);
    this.jet = this.nitroFx.mesh;
    scene.add(this.smoke, this.fire, this.jet);
    // one shared light: a warm flash for pops, a violet nitro wash behind the player's car (a single pooled light: the lightest
    // way to throw colour on the body and road, and the light count never changes)
    this.light = new THREE.PointLight(0xff9440, 0, 5, 2);
    this.light.name = 'fx-pop-light'; scene.add(this.light); this.popAt = new THREE.Vector3();
    this.scene = scene; this.sun = null; this.sunT = 0; this.camera = null; this.pass = null;
    this.flash = 0; this.lit = 0; this.time = 0; this.glow = 0;
    this.quality = 1;      // 0..1 scales emission (set from the quality tier)
    this.damp = 0.25;      // 0..1 cold / damp air and the road's water: steam shows more, spray from ~0.3 up, no white smoke on a wet road
    this.heroNitro = 0; this.heroSeen = false; this.nightK = 0; this.steamK = 1; this.owners = 0;
    this.focus = new THREE.Vector3(); this.focused = false;      // the player's car: others far from it emit less
    this.wind = { x: 0, z: 0 };
    this.tmp = { p: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion(), c: new THREE.Vector3(), f: new THREE.Vector3(), w: new THREE.Vector3() };
  }

  /** the soft particles move out of the scene into SmokePass, right after the composer's RenderPass */
  attach(composer, camera) {
    if (this.pass) return;
    this.camera = camera;
    this.pass = new SmokePass(this.soft, composer, camera, this.scene);
    this.scene.remove(this.smoke); this.pass.scene.add(this.smoke); this.smoke.updateMatrixWorld(true);
    composer.insertPass(this.pass, 1);
  }

  /** 0 dry .. 1 standing water: the road, from the weather's damp */
  get wet() { return clamp((this.damp - 0.3) / 0.5, 0, 1); }

  /** world velocity of a car (from its root's motion since the last call); allocation-free */
  vel(c, dt) {
    const p = c.root.getWorldPosition(this.tmp.c);
    c._fxV ??= new THREE.Vector3(); c._fxPrev ??= p.clone();
    if (dt > 0) c._fxV.copy(p).sub(c._fxPrev).divideScalar(dt);
    c._fxPrev.copy(p);
    return c._fxV;
  }

  anchor(a) {   // world position and direction of an emitter anchor, into tmp.p / tmp.d
    const { p, d, q } = this.tmp;
    a.getWorldPosition(p); a.getWorldQuaternion(q);
    if (a.userData.dir) d.copy(a.userData.dir); else d.set(1, 0, 0);
    d.applyQuaternion(q).normalize();
  }

  state(c) {
    return (c._fx ??= { gear: 0, rpm: 0.12, shiftT: 0, thrPrev: 0, thrHi: 0, tHi: 0, t: 0, n: 0, cd: 0, keep: 0, warm: 0, nitro: 0, blip: 0, big: false });
  }

  /** Per car, per frame. Returns pops fired (the audio plays its own pop sound for the player's). */
  drive(c, dt, throttle, o = {}) {
    if (!(dt > 0)) return 0;
    dt = Math.min(dt, 0.05);
    const v = this.vel(c, dt), S = this.state(c), E = c.fxSpec ? (c._fxE ??= { ...DEFAULT_ENGINE, ...c.fxSpec }) : DEFAULT_ENGINE;
    const q = this.quality * (c.hero ? 1 : 0.7), speed = c.speed ?? 0, near = this.near(c);
    c._fxI ??= this.owners++ % 16; this.soft.cap[c._fxI] = c.hero ? BUDGET.hero : BUDGET.other;
    const fw = this.tmp.f.set(1, 0, 0).applyQuaternion(c.root.quaternion); fw.y = 0; fw.normalize();      // the nose (car-lab -X, turned by car.rotation.y = pi)
    if (c.hero) this.soft.focusV.copy(v);
    if (speed > 1) this.soft.car(c.root.position.x, c.root.position.z, v.x, v.z, 2.6);
    this.lamps(c, fw);
    S.t += dt;
    let pops = 0;
    if (!c.electric) {
      // virtual gearbox: rpm as a fraction of redline (same ratios as the game's display gearbox)
      const top = E.top, vTop = (g) => top * RATIOS[g];
      let shifted = false;
      if (speed / vTop(S.gear) > 0.95 && S.gear < RATIOS.length - 1 && throttle > 0.2) { S.gear++; shifted = true; S.shiftT = 0.12; }
      else if (S.gear > 0 && speed < vTop(S.gear - 1) * 0.68) S.gear--;
      let want = Math.max(0.12 + (speed < 2 ? throttle * 0.25 : 0), Math.min(1.02, speed / vTop(S.gear)));
      const rpmBefore = S.rpm;
      if (S.shiftT > 0) { S.shiftT -= dt; want *= 0.78; }
      S.rpm += (want - S.rpm) * (1 - Math.exp(-(want > S.rpm ? 14 : 8) * dt));
      S.warm = Math.min(1, S.warm + dt / 70);

      // sharp lift at rpm starts an overrun crackle train; gradual lifts and low rpm rarely do
      if (throttle > S.thrHi) { S.thrHi = throttle; S.tHi = S.t; } else if (S.t - S.tHi > 0.35) S.thrHi = Math.max(throttle, S.thrHi - dt * 3);
      let force = o.pop;
      if (S.thrHi > 0.55 && throttle < 0.15) {
        const sharp = clamp((S.thrHi - throttle) / Math.max(0.03, S.t - S.tHi) / 5, 0.25, 1);
        if (S.rpm > 0.35 && (force || Math.random() < (0.35 + 0.65 * sharp) * Math.min(1, E.crackle + 0.3))) {
          const n = Math.max(1, Math.round((2 + Math.random() * 3) * E.crackle * sharp * (0.4 + 0.8 * S.rpm)));
          if (n > S.n) S.n = Math.min(5, n);
          S.cd = Math.max(S.cd, 0.015 + Math.random() * 0.03);
          force = false;
        }
        S.thrHi = 0;
      }
      if (force && S.n < 2) { S.n += 3; S.cd = 0.01; }
      if (shifted && throttle > 0.6 && Math.random() < E.shift) { S.n = Math.max(S.n, 1 + (Math.random() < 0.5)); S.cd = 0.05 + Math.random() * 0.05; S.keep = S.t + 0.25; S.rpm = Math.max(S.rpm, rpmBefore); }
      if (S.n > 0) {
        if ((throttle > 0.35 && S.t > S.keep) || S.rpm < 0.28) S.n = 0;
        else if ((S.cd -= dt) <= 0) {
          this.pop(c, S, E, q);
          pops++; S.n--;
          S.cd += (0.045 + Math.random() * Math.random() * 0.16) * E.gap;      // irregular gaps, a few close together
        }
      }
      this.vapor.steam(this, c, S, throttle, dt, v, speed, q * near);
      S.blip = throttle - S.thrPrev > 4 * dt && throttle > 0.3 && speed < 12 ? S.blip + 1 : 0;
    }
    S.thrPrev = throttle;
    this.nitro(c, S, dt, v, speed, !!o.nitro, q);
    this.vapor.spray(this, c, dt, v, speed, fw, q * near);
    // read from the physics when the caller has none: the brakes at the limit (the ABS cutting in) and a pulled handbrake, which
    // locks the rear and smokes while the car still rolls
    const veh = c.vehicle, ground = veh ? veh.onGround >= 2 : true;
    const lock = (o.lock ?? veh?.state.absActive ?? 0) * sstep(6, 16, speed), hb = (o.hb ?? veh?.controls.handbrake ?? 0) * sstep(3, 10, speed);
    if (ground) this.tyres(c, dt, v, fw, Math.max(o.slip ?? 0, hb * 0.75), lock, q * Math.max(near, 0.3));
    return pops;
  }

  /** emission scale by distance from the player's car: steam and spray of cars well out of sight are skipped, smoke thinned */
  near(c) {
    if (c.hero) { this.focus.copy(c.root.position); this.focused = true; return 1; }
    if (!this.focused) return 1;
    const d2 = c.root.position.distanceToSquared(this.focus);
    return d2 > 130 * 130 ? 0 : d2 > 70 * 70 ? 0.5 : 1;
  }

  /** the tail lamps as a red glow for the smoke and steam close behind (night, more on the brake) */
  lamps(c, fw) {
    const k = this.nightK * (0.12 + 0.7 * (c.lampLevel ?? 0));
    if (k < 0.02) return;
    const p = c.root.position;
    this.soft.glow(p.x - fw.x * 2.4, p.y + 0.55, p.z - fw.z * 2.4, 0.7 * k, 0.04 * k, 0.02 * k, 2.6);
  }

  /** Tyre smoke from slip: born small and dense at the contact patch, thrown back by a spinning tyre (left in place by a locked one),
   *  swelling, rising a little and thinning over a few seconds. The amount follows the slip (rate and size), so a light wheelspin is
   *  a wisp and a burnout buries the car. A wet road throws water instead (fx-vapor.js). */
  tyres(c, dt, v, fw, slip, lock, q) {
    const dry = 1 - this.wet, s = this.soft.s, root = c.root.position;
    for (const w of c.wheels ?? []) {
      const rear = w.axle === 'rear', k = rear ? slip : lock;
      if (k < 0.01) { w._smk = 0; continue; }
      const r = w.spec?.radius ?? 0.34, p = w.pivot.getWorldPosition(this.tmp.w);
      const out = Math.sign((p.x - root.x) * fw.z - (p.z - root.z) * fw.x) || 1;       // + to the car's left
      if (this.wet > 0.02) this.vapor.tyreWater(this, c, p, fw, out, r, v, k, rear, dt, q);
      w._smk = (w._smk ?? Math.random()) + (55 * Math.pow(k, 1.3) + 5 * Math.sqrt(k) * Math.min(c.speed ?? 0, 40)) * dry * q * dt * (rear ? 1 : 0.6);     // and by distance: a moving trail stays one trail
      for (; w._smk >= 1; w._smk--) {
        const u = Math.random(), kick = rear ? 1.2 + 2.6 * k : 0.3, inh = rear ? 0.45 : 0.12;     // a spinning tyre flings it back; a locked one leaves it
        s.x = p.x - fw.x * r * 0.6 + rnd(0.08); s.y = root.y + 0.12 + Math.random() * 0.1; s.z = p.z - fw.z * r * 0.6 + rnd(0.08);
        s.vx = v.x * inh - fw.x * kick * (0.6 + 0.6 * u) + fw.z * out * (0.5 + Math.random()) * 0.9 + rnd(0.4);
        s.vz = v.z * inh - fw.z * kick * (0.6 + 0.6 * u) - fw.x * out * (0.5 + Math.random()) * 0.9 + rnd(0.4);
        s.vy = 0.4 + Math.random() * 0.9 * (0.5 + k);
        s.s0 = 0.12 + 0.08 * Math.random(); s.s1 = (0.35 + 1.05 * k) * (0.8 + 0.4 * Math.random()) / Math.sqrt(Math.max(q, 0.3));
        s.grow = 0.45 + 0.45 * Math.random(); s.life = (1.0 + 2.4 * k) * (0.75 + 0.5 * Math.random());
        s.a0 = (0.1 + 0.4 * k) * Math.min(1, 0.6 + 0.4 / Math.max(q, 0.3)) * dry;
        const g = 0.8 * (0.93 + 0.12 * Math.random()); s.r = g * 0.97; s.g = g * 0.98; s.b = g;      // white-grey, a touch cool (warm reads as dust)
        s.kind = SMOKE; s.drag = 1.3; s.rise = 0.3 + 0.5 * k; s.turb = 0.8; s.gnd = root.y; s.own = c._fxI; s.fin = 0.05; s.spin = 0.35;
        this.soft.emit();
      }
    }
  }

  /** One backfire: per pipe a fireball blooming at the tip (blue-white to orange in a few frames), a flame tongue licking back along
   *  the airflow, sometimes hot sparks, a small soot puff; a warm light lights the bumper and road. Turbo engines pop smaller and cooler. */
  pop(c, S, E, q) {
    const ex = c.exhausts; if (!ex?.length) return;
    const v = c._fxV, rpm = S.rpm, first = (Math.random() * ex.length) | 0, turbo = E.turbo ? 1 : 0, speed = c.speed ?? 0;
    const sz0 = E.size * (0.6 + 0.6 * rpm) * Math.max(q, 0.5) * (1 - 0.25 * turbo);
    for (let i = 0; i < ex.length; i++) {
      if (i !== first && Math.random() > 0.55) continue;
      this.anchor(ex[i]);
      const { p, d } = this.tmp, sz = sz0 * (0.7 + 0.6 * Math.random()), bang = Math.random() < 0.12 * E.crackle, S2 = bang ? 1.4 : 1;
      this.tongue.core(p, d, v, sz * S2, turbo);
      this.tongue.lick(p, d, v, speed, sz * S2, rpm, turbo, false);
      if (q > 0.6 && Math.random() < 0.6) this.tongue.lick(p, d, v, speed, sz * S2, rpm, turbo, true);
      if (bang && Math.random() < 0.7 * q) for (let j = 0, m = 2 + ((Math.random() * 3) | 0); j < m; j++) {
        const sx = d.x * (3 + Math.random() * 5) + rnd(1.2), sy = d.y * 3 + rnd(1.2) + 0.5, sz_ = d.z * (3 + Math.random() * 5) + rnd(1.2);
        this.flame.spawn(p.x, p.y, p.z, v.x * 0.9 + sx, v.y * 0.9 + sy, v.z * 0.9 + sz_, sx, sy, sz_,
          0.15 + Math.random() * 0.15, 0.012, 0.008, 1.0, 1.6, 0.7, 0.25, 0.9, -9, 1);
      }
      this.vapor.puff(this, c, p, d, v, sz * S2, turbo);
      this.flash = Math.max(this.flash, (0.6 - 0.2 * turbo) * sz * S2);
      this.popAt.set(p.x + d.x * 0.3, p.y - 0.15, p.z + d.z * 0.3);     // low and just behind the pipe: the bumper and the road under it
    }
  }

  /** Nitro: a slow smooth ramp in (0.35 s) and out (0.65 s); the streams, puffs, shimmer and screen package all follow the level. */
  nitro(c, S, dt, v, speed, on, q) {
    S.nitro = clamp(S.nitro + (on ? dt / 0.35 : -dt / 0.65), 0, 1);
    if (c.hero) { this.heroNitro = S.nitro; this.heroSeen = true; }
    if (S.nitro <= 0.001 && !c._noz?.some((n) => n.rib >= 0)) return;
    this.nitroFx.drive(this, c, S.nitro, dt, v, speed, q);
    if (c.hero && S.nitro > 0.01) { this.glow = Math.max(this.glow, S.nitro * S.nitro * (3 - 2 * S.nitro)); this.glowAt = c; }
  }

  /** dt seconds; light: the look's ambient tint (the soft particles' fallback when no SmokePass runs); look: its `steam` density */
  update(dt, light = new THREE.Color(1, 1, 1), look = {}) {
    this.steamK = look.steam ?? 1;
    const lum = 0.2126 * light.r + 0.7152 * light.g + 0.0722 * light.b;
    this.nightK = 1 - sstep(0.35, 0.8, lum);
    if (!this.sun && (this.sunT -= dt) <= 0) { this.sunT = 2; this.sun = this.scene.children.find((o) => o.isDirectionalLight) ?? null; }
    const so = this.soft;
    if (this.sun) {      // the sun as the scene lights a white matte surface (three: radiance = albedo / pi * E)
      so.sunW.copy(this.sun.position).sub(this.sun.target.position).normalize();
      so.mat.uniforms.uSunC.value.copy(this.sun.color).multiplyScalar(this.sun.intensity / Math.PI);
    }
    so.tint(light); this.lampsAt(so.mat.uniforms.uLocal.value, dt);
    this.time += dt;
    const w = this.time * 0.11; this.wind.x = Math.sin(w) * 0.5 + Math.sin(w * 2.7 + 1) * 0.25; this.wind.z = Math.cos(w * 0.8 + 2) * 0.5 + Math.sin(w * 2.1) * 0.2;
    // the pop flash lights the smoke near it
    if (this.lit > 0.01) so.glow(this.popAt.x, this.popAt.y + 0.2, this.popAt.z, WARM.r * this.lit * 1.5, WARM.g * this.lit * 1.5, WARM.b * this.lit * 1.5, 1.6);
    so.step(dt, this.wind.x, this.wind.z); so.upload(this.camera ?? so.camera);
    if (this.pass) this.pass.dt = dt;
    this.flame.step(dt, FIRE); this.tongue.step(dt);
    this.nitroFx.update(dt);
    if (!this.heroSeen) this.heroNitro *= Math.exp(-5 * dt);       // the player's car is not being driven (menu): the screen package lets go
    this.heroSeen = false;
    this.flash *= Math.exp(-dt / 0.05); this.lit += (this.flash - this.lit) * (1 - Math.exp(-dt / (this.flash > this.lit ? 0.015 : 0.07)));      // the light eases in and out: no strobe
    // the light: a pop's warm flash plus the violet nitro wash low behind the player's car, blended by their intensities (a pop
    // during the nitro fade-out must not swap one for the other: that was a 25x one-frame drop, a hard blink)
    const g = this.glow, c = this.glowAt;
    this.glow = 0;
    const iv = g > 0.01 && c ? g * 30 : 0, io = this.lit * 4.5, k = iv / (iv + io || 1);      // k: the nitro wash's share
    this.light.position.copy(this.popAt);
    const n = iv > 0 && this.nitroFx.nozzles(c)[0];
    if (n) { this.anchor(n.a); const { p, d } = this.tmp; this.light.position.lerp(this.tmp.c.set(p.x + d.x * 1.3, c.root.position.y + 0.3, p.z + d.z * 1.3), k); }
    this.light.color.copy(WARM).lerp(VIOLET, k); this.light.distance = 5 + 4 * k; this.light.intensity = iv + io;
  }

  /** the venue's lamps (floodlights, street lamps) 1 m over the player's car: what they give a white matte surface (three's falloff and
   *  spot cones), the smoke's ambient on top of the sky's. The lamp list is re-read every 2 s (they are pooled scene lights). */
  lampsAt(out, dt) {
    if ((this.lampT = (this.lampT ?? 0) - dt) <= 0) { this.lampT = 2; this.lampList = this.scene.children.filter((o) => (o.isPointLight || o.isSpotLight) && o !== this.light); }
    out.setRGB(0, 0, 0);
    if (!this.focused) return;
    const p = this.focus, d3 = this.tmp.d;
    for (const L of this.lampList) {
      if (!L.visible || !(L.intensity > 0)) continue;
      d3.set(p.x - L.position.x, p.y + 1 - L.position.y, p.z - L.position.z);
      const d = d3.length();
      let a = L.intensity / Math.max(d * d, 0.01) * (L.distance > 0 ? clamp(1 - (d / L.distance) ** 4, 0, 1) ** 2 : 1);
      if (L.isSpotLight) { const s = this.tmp.w.copy(L.target.position).sub(L.position).normalize(); a *= sstep(Math.cos(L.angle), Math.cos(L.angle * (1 - L.penumbra)), s.dot(d3) / Math.max(d, 1e-3)); }
      out.r += L.color.r * a; out.g += L.color.g * a; out.b += L.color.b * a;
    }
    out.multiplyScalar(0.3 / Math.PI);      // a puff faces any way: a part of it toward the lamp
  }

  /** every particle and flame gone at once (a session restart, the QA's runs) */
  clear() {
    this.soft.clear();
    for (const p of [this.flame, this.tongue.pool, this.tongue.glow, this.nitroFx.puffs]) { p.n = 0; p.mesh.geometry.instanceCount = 0; }
    this.nitroFx.R.forEach((r) => { r.n = 0; r.live = false; });
    this.flash = this.lit = this.glow = 0;
  }

  get counts() {
    const n = this.nitroFx;
    return { smoke: this.soft.n, fire: this.flame.n + this.tongue.pool.n + this.tongue.glow.n + n.puffs.n + n.live, steam: this.vapor.steamN, spray: this.vapor.sprayN, streams: n.live };
  }
}
