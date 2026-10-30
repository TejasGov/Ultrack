// Car effects: exhaust steam, overrun crackle, the nitro plasma streams, wet tyre spray and drift tyre smoke. Seven draw calls in
// all (gas, flames, tongues + core glow, steam / spray, plasma puffs, nitro ribbon), pooled GPU particles, no per-frame allocation.
//   gas     soft translucent smoke for pops and drift tyre smoke (alpha blended particles)           fx-pool.js
//   tongue  additive flame tongues, stretched along the jet and the airflow (pops)                    fx-flame.js
//   fire    additive flame particles (pop root glow, sparks) bright enough for the bloom to catch briefly     fx-pool.js
//   vapor   volumetric steam at the pipes, tyre spray and mist in the wet, lit by the sun and lamps   fx-vapor.js
//   nitro   soft wide violet plasma streams from the pipes + a few puffs: gas, never a beam           fx-nitro.js
// Particles live in world space with the exhaust's own velocity at emission plus exit velocity; air drag pulls them to
// rest in the ground frame, hot gas rises, so the car leaves its gas behind at speed (nothing sticks to the body).
// Emitter anchors come from cars.js (exhaust.json: tips, nitro, fx = engine character).
//   drive(car, dt, throttle, {nitro, slip, pop})  one call per car per frame; returns the number of pops fired (for the audio)
//   fx.damp 0..1 (0.15 dry, 0.7 damp, 1 rain): thicker steam, and tyre spray from ~0.3 up.  fx.heroNitro 0..1: the player's nitro
//   level, a smooth ramp, for the screen package (main.js finalPass).
// Engine character (exhaust.json "fx"): crackle (how readily it pops, 0 = never), size (flame scale), gap (pop spacing, W16 = slow
// and deep), shift (chance of a pop on an upshift, turbo / performance cars), turbo (1: smaller, duller, cooler pops), top (top speed m/s for the virtual gearbox).
import * as THREE from 'three';
import { Pool, clamp, sstep, rnd, FIRE, SMOKE } from './fx-pool.js';
import { Nitro } from './fx-nitro.js';
import { Vapor } from './fx-vapor.js';
import { Flame } from './fx-flame.js';

const RATIOS = [0.27, 0.41, 0.54, 0.66, 0.78, 0.9, 1.03];   // same display gearbox as game/audio.js, so pops line up with the sound

const GAS_FRAG = /* glsl */`
  vec2 d = vUv - 0.5; float r = length(d) * 2.0;
  float n = vn(vUv * 4.0 + vSeed * 17.0) * 0.6 + vn(vUv * 9.0 - vSeed * 5.0) * 0.4;
  float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.55) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vCol * uLight * (0.85 + 0.3 * n), a);`;
const FIRE_FRAG = /* glsl */`
  vec2 d = vUv - 0.5; float r = length(d) * 2.0;
  float a = pow(max(0.0, 1.0 - r), 1.6) * vAlpha;
  gl_FragColor = vec4(vCol * a, 1.0);`;

const DEFAULT_ENGINE = { crackle: 0.8, size: 1, gap: 1, shift: 0.3, top: 85 };
const VIOLET = new THREE.Color(0xa040ff), WARM = new THREE.Color(0xff9440);      // the nitro wash and the pop flash

export class CarFx {
  constructor(scene) {
    this.gas = new Pool({ blending: THREE.NormalBlending, fragment: GAS_FRAG, name: 'fx-smoke' });
    this.flame = new Pool({ blending: THREE.AdditiveBlending, fragment: FIRE_FRAG, stretch: 0.09, name: 'fx-fire' });
    this.nitroFx = new Nitro(); this.vapor = new Vapor(); this.tongue = new Flame();
    // the objects other code hides for reflection captures (a Group hides all its draws at once)
    this.smoke = new THREE.Group(); this.smoke.name = 'fx-smoke-group'; this.smoke.add(this.gas.mesh, ...this.vapor.meshes);
    this.fire = new THREE.Group(); this.fire.name = 'fx-fire-group'; this.fire.add(this.flame.mesh, this.tongue.pool.mesh, this.tongue.glow.mesh, this.nitroFx.puffs.mesh);
    this.jet = this.nitroFx.mesh;
    scene.add(this.smoke, this.fire, this.jet);
    // one shared light: a warm flash for pops, a violet wash behind the player's car on nitro (a single pooled light:
    // the lightest way to throw colour on the body and road, and the light count never changes)
    this.light = new THREE.PointLight(0xff9440, 0, 5, 2);
    this.light.name = 'fx-pop-light'; scene.add(this.light); this.popAt = new THREE.Vector3();
    this.scene = scene; this.sun = null; this.sunT = 0;
    this.flash = 0; this.lit = 0; this.nj = 0; this.time = 0; this.glow = 0;
    this.quality = 1;      // 0..1 scales emission (set from the quality tier)
    this.damp = 0.25;      // 0..1 cold / damp air: steam shows more, tyre spray from ~0.3 up (set from the weather)
    this.heroNitro = 0; this.heroSeen = false; this.nightK = 0; this.steamK = 1;
    this.focus = new THREE.Vector3(); this.focused = false;      // the player's car: others far from it skip their spray
    this.wind = { x: 0, z: 0 };
    this.tmp = { p: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion(), c: new THREE.Vector3() };
  }

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
    const v = this.vel(c, dt), S = this.state(c), E = c.fxSpec ? { ...DEFAULT_ENGINE, ...c.fxSpec } : DEFAULT_ENGINE;
    const q = this.quality * (c.hero ? 1 : 0.7), speed = c.speed ?? 0;
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
          const n = Math.max(1, Math.round((2 + Math.random() * 4) * E.crackle * sharp * (0.4 + 0.8 * S.rpm)));
          if (n > S.n) S.n = Math.min(6, n);
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
          S.cd += (0.035 + Math.random() * Math.random() * 0.14) * E.gap;      // irregular gaps, a few close together
        }
      }
      this.vapor.steam(this, c, S, throttle, dt, v, speed, q * this.near(c));
      S.blip = throttle - S.thrPrev > 4 * dt && throttle > 0.3 && speed < 12 ? S.blip + 1 : 0;
    }
    S.thrPrev = throttle;
    this.nitro(c, S, dt, v, speed, !!o.nitro, q);
    this.vapor.spray(this, c, dt, v, speed, q * this.near(c));
    if (o.slip) this.tyreSmoke(c, o.slip, dt, v);
    return pops;
  }

  /** emission scale by distance from the player's car: cars well out of sight skip steam and spray (the pack is 7 cars) */
  near(c) {
    if (c.hero) { this.focus.copy(c.root.position); this.focused = true; return 1; }
    if (!this.focused) return 1;
    const d2 = c.root.position.distanceToSquared(this.focus);
    return d2 > 130 * 130 ? 0 : d2 > 70 * 70 ? 0.5 : 1;
  }

  /** One backfire: per pipe a blue-white burst at the root, a flame tongue (plus a smaller one) licking back along the airflow, a few
   *  hot sparks and a soft smoke puff; a warm light lights the bumper and road. Turbo engines pop smaller, duller and cooler. */
  pop(c, S, E, q) {
    const ex = c.exhausts; if (!ex?.length) return;
    const v = c._fxV, rpm = S.rpm, first = (Math.random() * ex.length) | 0, turbo = E.turbo ? 1 : 0, speed = c.speed ?? 0;
    const sz0 = E.size * (0.55 + 0.7 * rpm) * q * (1 - 0.25 * turbo);
    for (let i = 0; i < ex.length; i++) {
      if (i !== first && Math.random() > 0.55) continue;
      this.anchor(ex[i]);
      const { p, d } = this.tmp, sz = sz0 * (0.6 + 0.8 * Math.random()), bang = Math.random() < 0.12 * E.crackle, S2 = bang ? 1.5 : 1;
      this.tongue.core(p, d, v, sz * S2, turbo);      // the hot core at the tip: HDR, the bloom catches it
      this.tongue.lick(p, d, v, speed, sz * S2, rpm, turbo, false);
      if (q > 0.6) { this.tongue.lick(p, d, v, speed, sz * S2, rpm, turbo, true); if (bang) this.tongue.lick(p, d, v, speed, sz, rpm, turbo, true); }
      if (Math.random() < (0.35 + 0.4 * rpm) * q) for (let j = 0, m = 2 + ((Math.random() * 3) | 0); j < m; j++) {
        const sx = d.x * (3 + Math.random() * 6) + rnd(1.5), sy = d.y * 3 + rnd(1.5), sz_ = d.z * (3 + Math.random() * 6) + rnd(1.5);
        this.flame.spawn(p.x, p.y, p.z, v.x * 0.9 + sx, v.y * 0.9 + sy, v.z * 0.9 + sz_, sx, sy, sz_,
          0.18 + Math.random() * 0.2, 0.025, 0.015, 0.9, 2.2, 1.1, 0.3, 0.9, -9, 1);
      }
      this.vapor.puff(this, c, p, d, v, sz * S2, turbo);
      if (q > 0.6) this.vapor.puff(this, c, p, d, v, sz * S2 * 0.8, turbo);
      this.flash = Math.max(this.flash, (0.55 - 0.15 * turbo) * sz * S2);
      this.popAt.set(p.x + d.x * 0.35, p.y - 0.25, p.z + d.z * 0.5);     // low and behind the pipe: the road and bumper, not the whole deck
    }
  }

  /** Nitro: a slow smooth ramp in (0.35 s) and out (0.65 s); the streams, puffs and screen package all follow the level. */
  nitro(c, S, dt, v, speed, on, q) {
    S.nitro = clamp(S.nitro + (on ? dt / 0.35 : -dt / 0.65), 0, 1);
    if (c.hero) { this.heroNitro = S.nitro; this.heroSeen = true; }
    if (S.nitro <= 0.001 && !c._noz?.some((n) => n.rib >= 0)) return;
    this.nitroFx.drive(this, c, S.nitro, dt, v, speed, q);
    if (c.hero && S.nitro > 0.01) { this.glow = Math.max(this.glow, S.nitro * S.nitro * (3 - 2 * S.nitro)); this.glowAt = c; }
  }

  tyreSmoke(c, slip, dt, v) {
    if (slip < 0.05) return;
    for (const w of c.wheels ?? []) {
      if (w.axle !== 'rear') continue;
      w._sacc = (w._sacc ?? Math.random()) + slip * 45 * this.quality * dt;
      while (w._sacc >= 1) {
        w._sacc -= 1;
        const p = w.pivot.getWorldPosition(this.tmp.p);
        this.gas.spawn(p.x + rnd(0.25), c.root.position.y + 0.12, p.z + rnd(0.25), v.x * 0.3 + rnd(1.4), 0.5 + Math.random() * 0.6, v.z * 0.3 + rnd(1.4), 0, 0, 0,
          1.8 + Math.random() * 1.2, 0.4, 2.3 + Math.random() * 0.8, 0.24 * Math.min(1, slip * 1.6), 0.84, 0.84, 0.87, 1.3, 0.25, 0);
      }
    }
  }

  /** dt seconds; light: ambient tint for the gas (look-dependent; fire and plasma are emissive); look: its `steam` (density, 1) and `steamCap` (sunlit brightness ceiling) */
  update(dt, light = new THREE.Color(1, 1, 1), look = {}) {
    this.steamK = look.steam ?? 1; this.vapor.pool.mesh.material.uniforms.uCap.value = look.steamCap ?? 99;
    this.gas.mesh.material.uniforms.uLight.value.copy(light);
    const lum = 0.2126 * light.r + 0.7152 * light.g + 0.0722 * light.b;
    this.nightK = 1 - sstep(0.35, 0.8, lum);
    if (!this.sun && (this.sunT -= dt) <= 0) { this.sunT = 2; this.sun = this.scene.children.find((o) => o.isDirectionalLight) ?? null; }
    this.vapor.light(this.sun);
    this.time += dt;
    const w = this.time * 0.11; this.wind.x = Math.sin(w) * 0.5 + Math.sin(w * 2.7 + 1) * 0.25; this.wind.z = Math.cos(w * 0.8 + 2) * 0.5 + Math.sin(w * 2.1) * 0.2;
    this.gas.step(dt, SMOKE, this.wind.x, this.wind.z); this.flame.step(dt, FIRE); this.tongue.pool.step(dt, FIRE); this.tongue.glow.step(dt, FIRE);
    this.vapor.step(dt, light, this.wind.x, this.wind.z);
    this.nitroFx.update(dt);
    if (!this.heroSeen) this.heroNitro *= Math.exp(-5 * dt);       // the player's car is not being driven (menu): the screen package lets go
    this.heroSeen = false;
    this.flash *= Math.exp(-dt / 0.06); this.lit += (this.flash - this.lit) * (1 - Math.exp(-dt / (this.flash > this.lit ? 0.02 : 0.08)));      // the light eases in and out: no strobe
    // the light: a pop's warm flash plus the violet nitro wash low behind the player's car, blended by their intensities (a pop
    // during the nitro fade-out must not swap one for the other: that was a 25x one-frame drop, a hard blink)
    const g = this.glow, c = this.glowAt;
    this.glow *= 0;
    const iv = g > 0.01 && c ? g * 30 : 0, io = this.lit * 4.5, k = iv / (iv + io || 1);      // k: the nitro wash's share
    this.light.position.copy(this.popAt);
    const n = iv > 0 && this.nitroFx.nozzles(c)[0];
    if (n) { this.anchor(n.a); const { p, d } = this.tmp; this.light.position.lerp(this.tmp.c.set(p.x + d.x * 1.3, c.root.position.y + 0.3, p.z + d.z * 1.3), k); }
    this.light.color.copy(WARM).lerp(VIOLET, k); this.light.distance = 5 + 4 * k; this.light.intensity = iv + io;
  }

  get counts() {
    const n = this.nitroFx;
    return { smoke: this.gas.n + this.vapor.n, fire: this.flame.n + this.tongue.pool.n + this.tongue.glow.n + n.puffs.n + n.live, steam: this.vapor.steamN, spray: this.vapor.sprayN, streams: n.live };
  }
}
