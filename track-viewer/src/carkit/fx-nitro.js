// Nitro: soft, wide plasma gas streams from the exhaust pipes (after Project Endurance's violet jets), never a solid beam.
//   ribbon  one camera-facing strip per nozzle, built from points the gas has left in the WORLD (so it smears and curves
//           in a corner instead of staying rigid on the car). Wide and Gaussian across, no core, a streaky noise that
//           belongs to the gas, a tail that breaks into wisps. One draw call for every stream of every car.
//   puffs   a few soft violet particles round the pipes (additive pool), the pre-boost sparkle and a little turbulence.
// Both follow the nitro level (a slow smooth ramp in and out); electric cars use their nitro anchors.
import * as THREE from 'three';
import { Pool, NOISE, finish, gainFor, clamp, sstep, rnd } from './fx-pool.js';

const RIB = 16, PTS = 26, VP = PTS + 1;     // streams in all; points a stream remembers; + the live head at the nozzle
const STEP = 1 / 70, LIFE = 0.5;            // s between points; s a point lives

const PLASMA = /* glsl */`
  float r = length(vUv - 0.5) * 2.0;
  float n = vn(vUv * 3.0 + vSeed * 19.0);
  float a = exp(-r * r * 3.2) * (1.0 - smoothstep(0.7, 1.0, r)) * (0.65 + 0.7 * n) * vAlpha;
  if (a < 0.004) discard;
  vec3 c = mix(vCol, vec3(1.0, 0.72, 1.0), a * 0.25);
  gl_FragColor = vec4(c * a * uGain, 1.0);`;

function ribbonMesh() {
  const V = RIB * VP * 2, g = new THREE.BufferGeometry();
  const f = (n, k) => new THREE.BufferAttribute(new Float32Array(V * k), k).setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', f(V, 3)); g.setAttribute('aNext', f(V, 3));
  for (const n of ['aSide', 'aU', 'aW', 'aA', 'aN', 'aSeed']) g.setAttribute(n, f(V, 1));
  const side = g.attributes.aSide.array, idx = new Uint16Array(RIB * (VP - 1) * 6);
  for (let i = 0; i < V; i++) side[i] = i & 1 ? 1 : -1;
  let k = 0;
  for (let r = 0; r < RIB; r++) for (let j = 0; j < VP - 1; j++) {
    const b = (r * VP + j) * 2;
    idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], k); k += 6;
  }
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uGain: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec3 aNext; attribute float aSide, aU, aW, aA, aN, aSeed;
      varying float vSide, vU, vA, vN, vSeed;
      void main() {
        vSide = aSide; vU = aU; vA = aA; vN = aN; vSeed = aSeed;
        vec4 m0 = viewMatrix * vec4(position, 1.0), m1 = viewMatrix * vec4(aNext, 1.0);
        vec2 t = m1.xy / max(-m1.z, 0.05) - m0.xy / max(-m0.z, 0.05);        // the stream's direction in the picture
        float l = length(t);
        vec2 ax = l > 1e-6 ? t / l : vec2(0.0, -1.0), pp = vec2(-ax.y, ax.x);
        vec3 mv = m0.xyz; mv.xy += pp * aSide * aW * 0.5;
        gl_Position = projectionMatrix * vec4(mv, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uGain; varying float vSide, vU, vA, vN, vSeed;
      ${NOISE}
      void main() {
        float s = vSide, ax = abs(s);
        float prof = exp(-3.6 * s * s) * (1.0 - smoothstep(0.7, 1.0, ax));            // wide and soft: no core
        float n = vn(vec2(s * 1.7 + vSeed * 13.0, vN * 0.34)) * 0.6 + vn(vec2(s * 3.9 + 4.1 + vSeed * 7.0, vN * 0.85 + 9.1)) * 0.4;   // streaks along the gas
        float st = vn(vec2(s * 6.5 + vSeed * 9.0, vN * 0.10)) * 0.65 + vn(vec2(s * 14.0 + vSeed * 3.0, vN * 0.07 + 3.0)) * 0.35;   // fine streaks parallel to the flow
        float tail = clamp((1.0 - vU) * 1.5 - n * 0.55 * vU, 0.0, 1.0);                // the end breaks into wisps
        float head = smoothstep(0.0, 0.07, vU);                                         // grows out of the pipe, no hard start
        float I = prof * (0.3 + 1.0 * n) * (0.55 + 1.0 * st) * tail * tail * head * vA;
        if (I < 0.004) discard;
        vec3 hot = vec3(0.86, 0.56, 1.0), mid = vec3(0.56, 0.23, 1.0), cold = vec3(0.26, 0.13, 0.92);
        vec3 col = mix(mix(hot, mid, smoothstep(0.0, 0.22, vU)), cold, smoothstep(0.25, 0.85, vU));
        gl_FragColor = vec4(col * I * uGain * 1.75, 1.0);
      }`,
  });
  const mesh = finish(g, mat, 'fx-jet', 6);
  mesh.onBeforeRender = (renderer) => { mat.uniforms.uGain.value = gainFor(renderer.toneMappingExposure); };
  return mesh;
}

export class Nitro {
  constructor() {
    this.mesh = ribbonMesh();
    this.puffs = new Pool({ blending: THREE.AdditiveBlending, fragment: PLASMA, name: 'fx-plasma', order: 6, max: 600, gain: true });
    this.live = 0;                        // streams drawn this frame (for the counts)
    this.arr = {}; for (const k of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'age', 'amp', 'noise']) this.arr[k] = new Float32Array(RIB * PTS);
    this.all = Object.values(this.arr);
    this.R = Array.from({ length: RIB }, () => ({ used: false, owner: null, n: 0, acc: 0, seed: 0, live: false, driven: false, head: new THREE.Vector3(), prev: new THREE.Vector3(),
      hasPrev: false, headAmp: 0, dist: 0, ground: 0, speed: 0, wMax: 0.7 }));
    this.tx = new Float32Array(VP * 3); this.ta = new Float32Array(VP); this.tn = new Float32Array(VP); this.tu = new Float32Array(VP);   // scratch polyline
    this.lat = new THREE.Vector3(); this.time = 0; this.dirty = false;
  }

  /** the nozzles of a car: its outermost two nitro anchors (a lone pipe gets a pair either side of it); built once */
  nozzles(c) {
    if (c._noz) return c._noz;
    const list = (c.nitro ?? []).slice().sort((a, b) => a.position.z - b.position.z);
    const mk = (a, off = 0) => ({ a, off, side: Math.sign(off || a.position.z) || 1, rib: -1, wMax: 0.7 });
    const out = list.length >= 2 ? [mk(list[0]), mk(list[list.length - 1])] : list.length ? [mk(list[0], -0.14), mk(list[0], 0.14)] : [];
    if (out.length === 2) { const sp = Math.abs(out[0].a.position.z + out[0].off - out[1].a.position.z - out[1].off); out[0].wMax = out[1].wMax = clamp(0.6 + 0.5 * sp, 0.68, 1.05); }
    return (c._noz = out);
  }

  ribbon(nz) {
    if (nz.rib >= 0 && this.R[nz.rib].owner === nz) return nz.rib;
    const i = this.R.findIndex((r) => !r.used);
    if (i < 0) return -1;
    Object.assign(this.R[i], { used: true, owner: nz, n: 0, acc: 0, seed: Math.random() * 10, live: false, driven: false, hasPrev: false, dist: Math.random() * 50, wMax: nz.wMax });
    return (nz.rib = i);
  }

  /** one car, one frame: spawn the stream's points (sub-frame accurate) and the puffs; f: nitro level 0..1 (smooth) */
  drive(fx, c, f, dt, v, speed, q) {
    const nozzles = this.nozzles(c), amp = f * f * (3 - 2 * f);
    for (const nz of nozzles) {
      const ri = f > 0.01 ? this.ribbon(nz) : (nz.rib >= 0 && this.R[nz.rib].owner === nz ? nz.rib : -1);
      if (ri < 0) continue;
      const r = this.R[ri], { p, d, q: qq } = fx.tmp, lat = this.lat;
      this.integrate(r, ri, dt); r.driven = true;
      fx.anchor(nz.a);
      lat.set(0, 0, 1).applyQuaternion(qq);
      const sd = nz.side;
      d.y *= 0.2; d.normalize();                               // low behind the car even from a top-exit pipe
      const px = p.x + lat.x * nz.off, py = p.y, pz = p.z + lat.z * nz.off;
      r.ground = c.root.position.y; r.speed = speed; r.live = f > 0.01; r.headAmp = amp;
      if (!r.hasPrev) { r.prev.set(px, py, pz); r.hasPrev = true; }
      if (f > 0.01) {
        const a0 = r.acc; let t = STEP - a0, spawned = 0;
        r.acc = a0 + dt;
        while (t <= dt && spawned < 4) {
          const k = t / dt, age = dt - t;
          const vx = v.x * 0.5 + d.x * (4 + 3 * Math.random()) + lat.x * sd * (1.2 + Math.random()) + rnd(0.5);
          const vy = v.y * 0.5 + d.y * 4 - 0.25 + rnd(0.35), vz = v.z * 0.5 + d.z * (4 + 3 * Math.random()) + lat.z * sd * (1.2 + Math.random()) + rnd(0.5);
          this.push(ri, r.prev.x + (px - r.prev.x) * k + vx * age, r.prev.y + (py - r.prev.y) * k + vy * age, r.prev.z + (pz - r.prev.z) * k + vz * age, vx, vy, vz, age, amp, r.dist + speed * t * 1.0);
          t += STEP; r.acc -= STEP; spawned++;
        }
        r.acc = clamp(r.acc, 0, STEP);
      }
      r.dist += speed * dt + dt * 2.5;
      r.head.set(px, py, pz); r.prev.set(px, py, pz);
      if (f > 0.01) fx.soft.heat(px, py, pz, d.x, d.y, d.z, amp);      // the hot gas bends the picture behind the stream (SmokePass)
      // soft violet puffs round the pipe
      nz.pa = (nz.pa ?? Math.random()) + 55 * amp * q * dt;
      for (let k = nz.pa | 0; k > 0; k--) {
        const off = Math.random() * 0.25;
        this.puffs.spawn(px + d.x * off, py + d.y * off, pz + d.z * off,
          v.x * 0.8 + d.x * (3 + 6 * Math.random()) + rnd(1.3), v.y * 0.8 + rnd(0.9), v.z * 0.8 + d.z * (3 + 6 * Math.random()) + rnd(1.3), 0, 0, 0,
          0.3 + Math.random() * 0.25, 0.12, 0.34 + 0.2 * Math.random(), 0.55 * amp, 1.0, 0.32, 1.25, 2.6, 0.5, 0);
      }
      nz.pa -= nz.pa | 0;
    }
  }

  push(ri, x, y, z, vx, vy, vz, age, amp, noise) {
    const r = this.R[ri], o = ri * PTS, n = Math.min(r.n, PTS - 1);
    for (const a of this.all) a.copyWithin(o + 1, o, o + n);
    const A = this.arr;
    A.x[o] = x; A.y[o] = Math.max(y, r.ground + 0.08); A.z[o] = z; A.vx[o] = vx; A.vy[o] = vy; A.vz[o] = vz; A.age[o] = age; A.amp[o] = amp; A.noise[o] = noise;
    r.n = n + 1;
  }

  integrate(r, ri, dt) {
    const o = ri * PTS, A = this.arr, k = Math.exp(-3 * dt);
    for (let i = 0; i < r.n; i++) {
      const j = o + i;
      if ((A.age[j] += dt) > LIFE) { r.n = i; break; }
      A.vx[j] *= k; A.vz[j] *= k; A.vy[j] = A.vy[j] * k + 0.6 * dt;       // the gas thins, slows and rises a little
      A.x[j] += A.vx[j] * dt; A.y[j] = Math.max(A.y[j] + A.vy[j] * dt, r.ground + 0.08); A.z[j] += A.vz[j] * dt;
    }
  }

  /** every frame: age streams nobody drove this frame (a car out of the session) and rebuild the strip */
  update(dt) {
    this.time += dt;
    let live = 0;
    for (let ri = 0; ri < RIB; ri++) {
      const r = this.R[ri];
      if (!r.used) continue;
      if (!r.driven) { r.live = false; if (dt > 0) this.integrate(r, ri, dt); }
      r.driven = false;
      if (!r.live && r.n === 0) { r.used = false; r.owner = null; this.clear(ri); continue; }
      this.build(r, ri); live++;
    }
    if (live || this.live) this.dirty = true;
    this.live = live;
    if (this.dirty) {
      const g = this.mesh.geometry;
      for (const a of Object.values(g.attributes)) a.needsUpdate = true;
      this.dirty = false;
    }
    this.puffs.step(dt, 0);
  }

  clear(ri) {   // a finished stream: every vertex to one point, so nothing is rasterised
    const g = this.mesh.geometry.attributes, b = ri * VP * 2;
    for (let i = 0; i < VP * 2; i++) { g.aA.array[b + i] = 0; g.aW.array[b + i] = 0; for (let k = 0; k < 3; k++) { g.position.array[(b + i) * 3 + k] = 0; g.aNext.array[(b + i) * 3 + k] = 0; } }
    this.dirty = true;
  }

  build(r, ri) {
    const g = this.mesh.geometry.attributes, o = ri * PTS, A = this.arr, X = this.tx, TA = this.ta, TN = this.tn, TU = this.tu;
    let m = 0;
    if (r.live) { X[0] = r.head.x; X[1] = r.head.y; X[2] = r.head.z; TA[0] = r.headAmp; TN[0] = r.dist; m = 1; }
    for (let i = 0; i < r.n; i++, m++) {
      const j = o + i, m3 = m * 3;
      X[m3] = A.x[j]; X[m3 + 1] = A.y[j]; X[m3 + 2] = A.z[j];
      TA[m] = A.amp[j] * (1 - sstep(LIFE * 0.45, LIFE, A.age[j])); TN[m] = A.noise[j];
    }
    const L = (5 + 0.05 * r.speed) * (0.88 + 0.12 * Math.sin(this.time * 2.1 + r.seed) + 0.06 * Math.sin(this.time * 3.7 + r.seed * 2.3));   // the stream breathes a little
    let s = 0; TU[0] = 0;
    for (let j = 1; j < m; j++) { s += Math.hypot(X[j * 3] - X[j * 3 - 3], X[j * 3 + 1] - X[j * 3 - 2], X[j * 3 + 2] - X[j * 3 - 1]); TU[j] = s / L; }
    let last = m - 1;
    while (last > 0 && TU[last] > 1.05) last--;               // beyond the stream's length nothing is drawn
    const P = g.position.array, NX = g.aNext.array, U = g.aU.array, W = g.aW.array, AA = g.aA.array, N = g.aN.array, S = g.aSeed.array, base = ri * VP;
    for (let j = 0; j < VP; j++) {
      const on = j <= last && m > 1, k = on ? j : Math.max(last, 0), j3 = k * 3;
      const nj = k + 1 <= last ? j3 + 3 : j3, pj = k > 0 ? j3 - 3 : j3;        // the next point (the last one extrapolates along its own segment)
      const u = TU[k], fade = on ? clamp((last - j) / 3, 0, 1) : 0;             // the end tapers to nothing
      for (let sd = 0; sd < 2; sd++) {
        const v = (base + j) * 2 + sd, v3 = v * 3;
        P[v3] = X[j3]; P[v3 + 1] = X[j3 + 1]; P[v3 + 2] = X[j3 + 2];           // dead points collapse onto the last live one: zero-area triangles
        if (k + 1 <= last) { NX[v3] = X[nj]; NX[v3 + 1] = X[nj + 1]; NX[v3 + 2] = X[nj + 2]; }
        else { NX[v3] = 2 * X[j3] - X[pj]; NX[v3 + 1] = 2 * X[j3 + 1] - X[pj + 1]; NX[v3 + 2] = 2 * X[j3 + 2] - X[pj + 2]; }
        U[v] = u; W[v] = on ? 0.14 + (r.wMax - 0.14) * Math.pow(Math.min(u, 1), 0.65) : 0; AA[v] = TA[k] * fade; N[v] = TN[k]; S[v] = r.seed;
      }
    }
  }
}
