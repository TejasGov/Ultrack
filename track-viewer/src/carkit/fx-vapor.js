// Vapor: exhaust steam at idle and low speed, tyre spray and mist in the wet. One soft, volumetric billboard pool (one draw call).
// Each puff is a domain-warped noise billow lit like a little cloud: half-Lambert from the scene's sun (read from its
// DirectionalLight), forward scatter when the camera looks toward the sun (steam catches the low sun), the ambient tint
// of the look, and the red of the tail lamps near the car at night (the lamp level is read at the moment of spawn and
// fades as the steam drifts away). Steam rises and meanders; at speed the pipes' steam is gone; electric cars have none.
import * as THREE from 'three';
import { Pool, clamp, sstep, rnd, VAPOR as STEAM_MODE, MIST } from './fx-pool.js';

const VAPOR = /* glsl */`
  vec2 d = vUv - 0.5; float r = length(d) * 2.0;
  float cs = cos(vRot), sn = sin(vRot);
  vec2 sl = vec2(cs * uSunV.x + sn * uSunV.y, -sn * uSunV.x + cs * uSunV.y);      // the sun in the puff's own turning frame
  vec2 q = d * 2.6 + vSeed * 41.0;
  float w = vn(q * 1.3 + 5.2);
  float n = vn(q + w * 1.6) * 0.55 + vn(q * 2.4 - w) * 0.3 + vn(q * 5.3 + vSeed * 7.0) * 0.15;      // billows
  float body = 1.0 - smoothstep(0.0, 1.0, r);
  float dens = body * 1.15 + (n - 0.5) * 1.0;                                   // billows eat into the disc: a clumpy edge, dense in the middle
  float a = smoothstep(0.12, 0.62, dens) * vAlpha;
  body = clamp(dens, 0.0, 1.0);
  if (a < 0.004) discard;
  vec3 nrm = normalize(vec3(d * 2.0 + (vec2(n, w) - 0.5) * 0.7, sqrt(max(0.06, 1.0 - min(r * r, 1.0)))));
  float lit = smoothstep(0.1, 0.95, dot(nrm, normalize(vec3(sl, uSunV.z))) * 0.5 + 0.5);
  float fw = pow(max(0.0, -uSunV.z), 3.0) * (0.45 + 0.55 * (1.0 - body));         // thin edges glow when looking into the sun
  vec3 col = min(vCol * (uLight * 1.15 + uSunCol * (0.1 + 0.75 * lit) + uSunCol * fw * 1.2), vec3(uCap));      // uCap: sunlit steam never clips to white
  col += vRel * (0.4 + 0.6 * body);                                              // tail-lamp glow in the steam
  gl_FragColor = vec4(col, a);`;

// Spray and mist: a soft Gaussian streak, stretched along the car's relative motion, lit the same way (no clumps: it must read as a haze)
const MIST_FRAG = /* glsl */`
  vec2 d = vUv - 0.5; float r = length(d) * 2.0;
  float n = vn(vUv * vec2(2.0, 3.0) + vSeed * 23.0);
  float a = exp(-r * r * 2.2) * (1.0 - smoothstep(0.7, 1.0, r)) * (0.7 + 0.6 * n) * vAlpha;
  if (a < 0.004) discard;
  float fw = pow(max(0.0, -uSunV.z), 3.0);
  gl_FragColor = vec4(vCol * (uLight * 1.15 + uSunCol * (0.35 + 1.2 * fw)), a);`;

const SPRAY = 0.35;     // rear-tyre spray density (was 1.0, then 0.6: it hid the cars ahead)

export class Vapor {
  constructor() {
    this.sunW = new THREE.Vector3(0.3, 0.5, 0.3).normalize();      // toward the sun, world
    this.pool = new Pool({
      blending: THREE.NormalBlending, fragment: VAPOR, name: 'fx-steam', max: 3500, order: 5,
      pre: 'uniform vec3 uSunV, uSunCol; uniform float uCap;',
      uniforms: { uSunV: { value: new THREE.Vector3(0, 0, -1) }, uSunCol: { value: new THREE.Color(0, 0, 0) }, uCap: { value: 99 } },
      onRender: (renderer, camera, u) => u.uSunV.value.copy(this.sunW).transformDirection(camera.matrixWorldInverse),
    });
    const u = this.pool.mesh.material.uniforms;
    this.spray_ = new Pool({ blending: THREE.NormalBlending, fragment: MIST_FRAG, name: 'fx-spray', max: 3000, order: 5, stretch: 0.14, projected: true, near: [0.8, 3.0],
      pre: 'uniform vec3 uSunV, uSunCol;', uniforms: { uSunV: u.uSunV, uSunCol: u.uSunCol } });      // the sun's uniforms are shared with the steam
    this.steamN = 0; this.sprayN = 0;     // puffs spawned so far (the tests)
    this.meshes = [this.pool.mesh, this.spray_.mesh];
    this.v = new THREE.Vector3(); this.back = new THREE.Vector3(); this.lat = new THREE.Vector3(); this.wp = new THREE.Vector3();
  }

  /** ambient tint (the look's) and one step of both pools */
  step(dt, light, wx, wz) {
    const lum = 0.2126 * light.r + 0.7152 * light.g + 0.0722 * light.b;
    for (const p of [this.pool, this.spray_]) { const v = p.mesh.material.uniforms.uLight.value.copy(light); v.r += (lum - v.r) * 0.85; v.g += (lum - v.g) * 0.85; v.b += (lum - v.b) * 0.85; }   // white, only tinted
    this.pool.step(dt, STEAM_MODE, wx, wz); this.spray_.step(dt, MIST, wx, wz);
  }

  get n() { return this.pool.n + this.spray_.n; }

  /** the sun the scene is lit by: strength and direction for the puffs' own lighting */
  light(sun) {
    if (!sun) return;
    this.sunW.copy(sun.position).sub(sun.target.position).normalize();
    const c = this.pool.mesh.material.uniforms.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity * 0.5), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    c.r += (l - c.r) * 0.85; c.g += (l - c.g) * 0.85; c.b += (l - c.b) * 0.85;      // steam is white: the sun's colour only tints it
  }

  /** steam from the pipes: two soft plumes that rise and thin out (thicker when cold or damp), a puff on a throttle blip, gone by ~170 km/h */
  steam(fx, c, S, throttle, dt, v, speed, q) {
    const amt = 1 - sstep(10, 48, speed);
    if (amt < 0.02) return;
    const cold = clamp(0.4 + 0.5 * (1 - S.warm) + 0.4 * fx.damp, 0, 1);
    const rate = (9 + 9 * throttle) * amt * (0.6 + 0.6 * cold) * q * fx.steamK;
    const puff = S.blip === 1 ? 3 : 0;
    const lamp = Math.min(2.6, 0.7 + 2.0 * (c.lampLevel ?? 0)) * (0.1 + 0.9 * fx.nightK);     // red glow near the lamps: night, more on the brake
    for (const a of c.exhausts ?? []) {
      a._acc = (a._acc ?? Math.random()) + rate * dt;
      let k = puff + (a._acc | 0); a._acc -= a._acc | 0;
      if (!k) continue;
      fx.anchor(a);
      const { p, d } = fx.tmp, exit = 0.6 + 2.2 * throttle, big = puff ? 1.4 : 1;
      this.steamN += k;
      while (k-- > 0) this.pool.spawn(p.x + d.x * 0.04, p.y + d.y * 0.04, p.z + d.z * 0.04,
        v.x * 0.7 + d.x * exit + rnd(0.12), v.y * 0.7 + d.y * exit + 0.45 + rnd(0.12), v.z * 0.7 + d.z * exit + rnd(0.12),
        lamp, lamp * 0.07, lamp * 0.05,
        (0.95 + Math.random() * 0.8) * (0.75 + 0.25 * cold), 0.1, (0.36 + Math.random() * 0.34 + 0.12 * throttle) * big, (0.6 + 0.25 * Math.random()) * (0.6 + 0.4 * cold) * (0.7 + 0.3 * amt) * big * Math.min(1, 0.35 + 0.65 * fx.steamK),
        0.88, 0.9, 0.95, 2.2, 1.6, 0.35);
    }
  }

  /** the grey-brown puff after a pop: soft, lit like the steam (sun, ambient, tail lamps), carries the car's speed, rises and thins out */
  puff(fx, c, p, d, v, sz, dull) {
    const lamp = Math.min(2.6, 0.7 + 2.0 * (c.lampLevel ?? 0)) * (0.1 + 0.9 * fx.nightK);
    this.pool.spawn(p.x + d.x * 0.1, p.y + d.y * 0.1, p.z + d.z * 0.1, v.x * 0.85 + d.x * 1.6 + rnd(0.3), v.y * 0.85 + 0.5 + rnd(0.2), v.z * 0.85 + d.z * 1.6 + rnd(0.3),
      lamp, lamp * 0.07, lamp * 0.05, 0.9 + Math.random() * 0.7, 0.12, (0.4 + 0.35 * Math.random()) * sz, (0.26 + 0.1 * Math.random()) * (1 - 0.3 * dull),
      0.46, 0.4, 0.36, 1.6, 0.55, 0.6);
  }

  /** wet tyres: roostertails and a fine mist behind each rear wheel, growing with speed and wetness (none in the dry) */
  spray(fx, c, dt, v, speed, q) {
    const wet = clamp((fx.damp - 0.3) / 0.6, 0, 1);
    if (wet < 0.02 || speed < 7 || !c.wheels) return;
    const sf = clamp((speed - 6) / 54, 0, 1), root = c.root.position;
    this.back.set(-v.x, 0, -v.z); const bl = this.back.length();
    if (bl < 1e-3) return;
    this.back.divideScalar(bl); this.lat.set(-this.back.z, 0, this.back.x);
    const rateTail = SPRAY * 200 * Math.pow(sf, 0.8) * wet * q, rateMist = SPRAY * 40 * Math.pow(sf, 1.2) * wet * q;
    for (const w of c.wheels) {
      if (w.axle !== 'rear') continue;
      const p = w.pivot.getWorldPosition(this.wp);
      const out = Math.sign((p.x - root.x) * this.lat.x + (p.z - root.z) * this.lat.z) || 1, rad = w.spec?.radius ?? 0.35;
      w._spray = (w._spray ?? Math.random()) + rateTail * dt;
      for (let k = w._spray | 0; k > 0; k--) {
        // a low roostertail: it stays under the roofline of the car behind
        const up = (1.4 + 2.6 * sf) * (0.45 + 0.8 * Math.random()), sideV = out * (0.4 + 1.6 * Math.random()) + rnd(0.6);
        const vx = v.x * 0.25 + this.back.x * (0.3 + 1.5 * Math.random()) + this.lat.x * sideV, vz = v.z * 0.25 + this.back.z * (0.3 + 1.5 * Math.random()) + this.lat.z * sideV;
        this.spray_.spawn(p.x + this.back.x * rad * 0.8 + rnd(0.08), root.y + 0.1, p.z + this.back.z * rad * 0.8 + rnd(0.08),
          vx, up, vz, vx - v.x, up - v.y, vz - v.z, 0.5 + Math.random() * 0.5, 0.12, 0.3 + 0.3 * Math.random() + 0.2 * sf, (1.25 + 0.8 * Math.random()) * (0.4 + 0.6 * sf) * wet,
          0.88, 0.9, 0.94, 1.6, -5.5, 1.2);
        this.sprayN++;
      }
      w._spray -= w._spray | 0;
      w._mist = (w._mist ?? Math.random()) + rateMist * dt;
      for (let k = w._mist | 0; k > 0; k--) {
        const vx = v.x * 0.3 + this.lat.x * out * Math.random() * 0.8, vz = v.z * 0.3 + this.lat.z * out * Math.random() * 0.8;
        this.spray_.spawn(p.x + this.back.x * (0.3 + Math.random() * 0.4) + rnd(0.15), root.y + 0.2 + Math.random() * 0.15, p.z + this.back.z * (0.3 + Math.random() * 0.4) + rnd(0.15),
          vx, 0.3 + 0.3 * Math.random(), vz, vx - v.x, 0, vz - v.z, 0.8 + Math.random() * 0.4, 0.35, 1.0 + Math.random() * 0.8, (0.35 + 0.25 * Math.random()) * wet * (0.4 + 0.6 * sf),   // short-lived, thin mist: no lingering wall of haze
          0.78, 0.8, 0.84, 1.2, 0.25, 1.1);
        this.sprayN++;
      }
      w._mist -= w._mist | 0;
    }
  }
}
