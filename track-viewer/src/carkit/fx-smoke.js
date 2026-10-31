// Soft particles: tyre smoke, exhaust steam, pop soot and wet-road spray in ONE pool, sorted back to front, behind ONE instanced draw.
// SmokePass (CarFx.attach, main.js) draws them after the scene into a half-resolution target against the scene's depth, so a puff fades
// where it meets the road, a car or a wall instead of cutting a hard line through it, then lays them over the frame before the bloom.
// Without the pass (the sandbox) the mesh draws in the scene and fades on the road plane only.
// A particle is a lit puff, not a disc: a generated billow atlas (four cauliflower puffs: density, normal, fine detail) shapes it and
// gives it a normal, so the sun lights its sunward side and its thin edges glow when the camera looks into the sun; its ambient is what
// the scene gives a white matte surface: the sky (a probe quad lit by the scene's own environment map, re-rendered twice a second) plus
// the venue's lamps near the player's car (CarFx sums them), with the road under it darker. So smoke is white at noon, blue-grey in
// the shade at dusk, dark and floodlit at night, with no per-look table; nearby glows (tail and brake lamps, pop flashes) tint it.
// Puffs are born small and dense, swell fast then slower, thin out as they grow, dissolve from their thin parts (erosion), drift with the
// wind, are dragged by the wake of a car that passes through them, and roll along the road instead of sinking into it.
// Kinds: SMOKE (tyre smoke, pop soot), MIST (steam, spray haze: one mip softer, forward scattering), STREAK (spray droplets, stretched
// along their motion as the picture sees it).
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export const SMOKE = 0, MIST = 1, STREAK = 2;
const MAX = 2600, OWNERS = 16, GLOWS = 24, CARS = 16, HEAT = 4;
const FIELDS = ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'age', 'life', 's0', 's1', 'grow', 'a0', 'cr', 'cg', 'cb', 'kind', 'drag', 'rise', 'turb', 'gnd', 'own', 'fin', 'rot', 'spin', 'seed', 'size', 'alpha'];

/** the billow atlas: 2 x 2 puffs of 128 px. R density (a cluster of soft lobes broken by fBm, zero at the tile edge), GB the normal of
 *  its height field, A fine detail for the erosion. Generated once (~20 ms), seeded, so every run draws the same puffs. */
function billowAtlas() {
  const T = 128, W = 2 * T, data = new Uint8Array(W * W * 4);
  let s = 12345; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const h = (x, y) => { const t = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return t - Math.floor(t); };
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; };
  const fbm = (x, y, o) => { let a = 0, w = 0.5, f = 1; for (let i = 0; i < o; i++) { a += w * vn(x * f, y * f); w *= 0.5; f *= 2.03; } return a; };
  const D = new Float32Array(T * T);
  for (let t = 0; t < 4; t++) {
    // lobes scattered through the disc (not on a ring: that read as onion rings), a big one in the middle
    const lobes = Array.from({ length: 12 + ((r() * 6) | 0) }, (_, i) => { const a = r() * 6.283, d = i === 0 ? 0 : Math.sqrt(r()) * 0.27; return [0.5 + Math.cos(a) * d, 0.5 + Math.sin(a) * d, i === 0 ? 0.22 : 0.07 + r() * 0.09]; });
    const ox = r() * 50, oy = r() * 50;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const u = (x + 0.5) / T, v = (y + 0.5) / T;
      let d = 0; for (const [cx, cy, cr] of lobes) d += Math.exp(-((u - cx) ** 2 + (v - cy) ** 2) / (cr * cr));
      const rr = Math.hypot(u - 0.5, v - 0.5), win = 1 - Math.min(1, Math.max(0, (rr - 0.36) / 0.13)) ** 2;
      d = (1 - Math.exp(-1.1 * d)) * win * win * (0.4 + 0.6 * fbm(u * 4 + ox, v * 4 + oy, 3) + 0.4 * fbm(u * 11 + oy, v * 11 + ox, 3));     // soft saturation: no plateau, no rim
      D[y * T + x] = Math.min(1, Math.max(0, d));
    }
    const bx = (t & 1) * T, by = (t >> 1) * T;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const at = (xx, yy) => Math.sqrt(D[Math.min(T - 1, Math.max(0, yy)) * T + Math.min(T - 1, Math.max(0, xx))]);
      const nx = (at(x - 2, y) - at(x + 2, y)) * 5, ny = (at(x, y - 2) - at(x, y + 2)) * 5, l = Math.hypot(nx, ny, 1);
      const o = ((by + y) * W + bx + x) * 4;
      data[o] = D[y * T + x] * 255; data[o + 1] = (nx / l * 0.5 + 0.5) * 255; data[o + 2] = (ny / l * 0.5 + 0.5) * 255;
      data[o + 3] = fbm((x + bx) / 9 + 7, (y + by) / 9 + 3, 4) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}

const VERT = /* glsl */`
  attribute vec4 aPS, aMisc, aKind; attribute vec3 aCol, aLamp, aVel;
  uniform float uStretch, uAmbK; uniform sampler2D tAmb; uniform vec3 uLocal;
  varying vec2 vUv, vAx; varying vec3 vCol, vLamp, vSky, vGnd; varying float vAlpha, vAge, vSeed, vKind, vH, vZ, vSize;
  void main() {
    vUv = position.xy + 0.5; vCol = aCol; vLamp = aLamp; vAlpha = aMisc.y; vAge = aMisc.z; vSeed = aMisc.w; vKind = aKind.x; vSize = aPS.w;
    vec4 mv = viewMatrix * vec4(aPS.xyz, 1.0);
    vec2 ax = vec2(cos(aMisc.x), sin(aMisc.x)); float L = 0.0;
    if (aKind.x > 1.5) {          // a streak runs along its motion in the picture (over 30 ms, on its own plane)
      vec3 vv = mat3(viewMatrix) * aVel, q1 = mv.xyz + vv * 0.03;
      vec2 sd = (q1.xy / max(-q1.z, 0.05) - mv.xy / max(-mv.z, 0.05)) * max(-mv.z, 0.05);
      float l = length(sd);
      if (l > 1e-5) { ax = sd / l; L = min(l * uStretch / aPS.w, 5.0); }
    }
    vec2 ay = vec2(-ax.y, ax.x), off = (ax * position.x * (1.0 + L) + ay * position.y) * aPS.w * 2.0;
    mv.xy += off;
    vH = aPS.y + viewMatrix[1][0] * off.x + viewMatrix[1][1] * off.y - aKind.y;      // this corner's height over the road
    vZ = -mv.z; vAx = ax;
    vec3 sky = texture2D(tAmb, vec2(0.5)).rgb * uAmbK;
    vSky = sky + uLocal; vGnd = (sky + uLocal) * 0.3;          // from below: the dark road's bounce (the lamps are overhead too)
    gl_Position = projectionMatrix * mv;
  }`;

const FRAG = /* glsl */`
  uniform sampler2D tAtlas, tDepth; uniform vec3 uSunV, uSunC, uUpV; uniform vec2 uInv, uNear; uniform float uCamN, uCamF;
  varying vec2 vUv, vAx; varying vec3 vCol, vLamp, vSky, vGnd; varying float vAlpha, vAge, vSeed, vKind, vH, vZ, vSize;
  #include <packing>
  void main() {
    vec2 c = vUv - 0.5; float k = vKind, sel = floor(vSeed * 4.0), a, dens; vec3 n = vec3(0.0, 0.0, 1.0);
    vec2 tile = vec2(mod(sel, 2.0), floor(sel * 0.5)) * 0.5;
    if (k > 1.5) {                // spray: a soft line of droplets, beaded by the detail noise
      float det = texture2D(tAtlas, tile + vec2(fract(vUv.x * 0.6 + vSeed * 7.0), vUv.y * 0.3 + 0.35) * 0.5).a;
      dens = exp(-c.y * c.y * 22.0) * (1.0 - smoothstep(0.2, 0.5, abs(c.x))) * (0.35 + 1.1 * det);
      a = dens;
    } else {
      vec4 tx = texture2D(tAtlas, tile + clamp(vUv, 0.02, 0.98) * 0.5, k > 0.5 ? 1.2 : 0.0);
      dens = tx.r;
      // opacity follows the thickness (the lobes show), and erosion eats the thin parts first: an old puff breaks into wisps
      float body = dens * (0.7 + 0.6 * tx.a), e = pow(vAge, 0.8) * 0.7;
      a = clamp((body - e) / (k > 0.5 ? 1.0 - 0.5 * e : 0.8 - 0.5 * e), 0.0, 1.0); a = a * a * (3.0 - 2.0 * a);
      vec2 nt = tx.gb * 2.0 - 1.0;
      n.xy = vAx * nt.x + vec2(-vAx.y, vAx.x) * nt.y; n.z = sqrt(max(0.05, 1.0 - dot(n.xy, n.xy)));
    }
    a *= vAlpha * smoothstep(0.0, min(0.3, vSize * 0.6), vH) * smoothstep(uNear.x, uNear.y, vZ);
    #ifdef SOFT
      float sz = -perspectiveDepthToViewZ(texture2D(tDepth, gl_FragCoord.xy * uInv).r, uCamN, uCamF);
      a *= clamp((sz - vZ) / max(0.12, vSize * 0.6), 0.0, 1.0);                  // fades into whatever it meets, gone behind it
    #endif
    if (a < 0.003) discard;
    float thin = 1.0 - clamp(dens * 1.3, 0.0, 1.0);
    vec3 amb = mix(vGnd, vSky, dot(n, uUpV) * 0.5 + 0.5) * mix(0.55, 1.0, smoothstep(0.0, 1.4, vH));   // the road and the car under it shade it
    float dif = clamp((dot(n, uSunV) + 0.35 + 0.4 * thin) / (1.35 + 0.4 * thin), 0.0, 1.0);   // wrapped: light passes into the thin smoke
    float fwd = pow(clamp(-uSunV.z, 0.0, 1.0), 5.0) * (0.25 + 0.75 * thin) * (k > 0.5 ? 1.3 : 1.0);   // into the sun: the edges light up
    vec3 col = vCol * (amb + uSunC * (dif * (k > 1.5 ? 0.6 : 1.0) + fwd * 1.6)) + vLamp * (0.45 + 0.55 * thin) * (k > 1.5 ? 0.0 : 1.0);   // the haze takes the lamps, not the droplets (a red spot near the lens)
    gl_FragColor = vec4(col * a, a);
  }`;

export class Soft {
  constructor() {
    for (const f of FIELDS) this[f] = new Float32Array(MAX);
    this.arrs = FIELDS.map((f) => this[f]);
    this.n = 0; this.lead = 0; this.cnt = new Int32Array(OWNERS); this.cap = new Int32Array(OWNERS).fill(MAX);
    this.kq = new Uint16Array(MAX); this.ord = new Uint16Array(MAX); this.tmp = new Uint16Array(MAX); this.bins = new Uint32Array(256);   // the radix sort's buffers
    // the emitter fills this, then calls emit(): no object per particle
    this.s = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, s0: 0.2, s1: 1, grow: 0.5, a0: 0.5, r: 1, g: 1, b: 1, kind: SMOKE, drag: 1, rise: 0, turb: 0, gnd: 0, own: 0, fin: 0.06, spin: 0.3 };
    this.cars = { n: 0, x: new Float32Array(CARS), z: new Float32Array(CARS), vx: new Float32Array(CARS), vz: new Float32Array(CARS), sp: new Float32Array(CARS), r2: new Float32Array(CARS) };
    this.glows = { n: 0, x: new Float32Array(GLOWS), y: new Float32Array(GLOWS), z: new Float32Array(GLOWS), r: new Float32Array(GLOWS), g: new Float32Array(GLOWS), b: new Float32Array(GLOWS), k: new Float32Array(GLOWS) };
    this.heatIn = { n: 0, a: new Float32Array(HEAT * 7) }; this.heatOut = { n: 0, a: new Float32Array(HEAT * 7) };   // hot gas behind a flame: position, direction, strength
    this.focusV = new THREE.Vector3();          // the player's car velocity: streaks stretch by their motion relative to the chase camera
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    for (const [k, w] of [['aPS', 4], ['aMisc', 4], ['aKind', 4], ['aCol', 3], ['aLamp', 3], ['aVel', 3]]) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(MAX * w), w).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const amb = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType); amb.needsUpdate = true;
    this.ambFallback = amb;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tAtlas: { value: billowAtlas() }, tDepth: { value: null }, tAmb: { value: amb }, uAmbK: { value: 0.75 }, uLocal: { value: new THREE.Color(0, 0, 0) }, uStretch: { value: 0.9 },
        uSunV: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color(0, 0, 0) }, uUpV: { value: new THREE.Vector3(0, 1, 0) },
        uInv: { value: new THREE.Vector2(1, 1) }, uNear: { value: new THREE.Vector2(0.6, 2.6) }, uCamN: { value: 0.1 }, uCamF: { value: 1000 } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.sunW = new THREE.Vector3(0.3, 0.6, 0.3).normalize();
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.mesh.name = 'fx-soft';
    this.mesh.onBeforeRender = (r, s, camera) => {
      const u = this.mat.uniforms;
      u.uSunV.value.copy(this.sunW).transformDirection(camera.matrixWorldInverse); u.uUpV.value.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
      u.uCamN.value = camera.near; u.uCamF.value = camera.far;
      this.camera = camera;
    };
    this.at = g.attributes; this.attrs = Object.values(g.attributes).filter((a) => a.isInstancedBufferAttribute); this.camera = null; this._f = new THREE.Vector3();
  }

  /** the sky's light from SmokePass's probe, or (no pass: the sandbox) a fixed tint */
  ambient(tex) { this.mat.uniforms.tAmb.value = tex ?? this.ambFallback; }
  tint(light) {      // the fallback ambient: the look's tint, at about what the probe reads in daylight
    const d = this.ambFallback.image.data; d[0] = light.r * 0.6; d[1] = light.g * 0.6; d[2] = light.b * 0.6; d[3] = 1;
    this.ambFallback.needsUpdate = true;
  }

  /** one particle from this.s; false when the pool or the owner's budget is full */
  emit() {
    const s = this.s, o = s.own | 0;
    const c = this.cnt[o], cap = this.cap[o];
    if (this.n >= MAX || c >= cap || (c > 0.75 * cap && Math.random() * 0.25 * cap < c - 0.75 * cap)) return false;     // thins out toward the budget, no hard stop
    const i = this.n++;
    const L = this.lead;      // born where the frame draws it: the step before the draw moves it on first (fx-pool.js spawn)
    this.px[i] = s.x - s.vx * L; this.py[i] = s.y - s.vy * L; this.pz[i] = s.z - s.vz * L; this.vx[i] = s.vx; this.vy[i] = s.vy; this.vz[i] = s.vz;
    this.age[i] = 0; this.life[i] = s.life; this.s0[i] = s.s0; this.s1[i] = s.s1; this.grow[i] = s.grow; this.a0[i] = s.a0;
    this.cr[i] = s.r; this.cg[i] = s.g; this.cb[i] = s.b; this.kind[i] = s.kind; this.drag[i] = s.drag; this.rise[i] = s.rise; this.turb[i] = s.turb;
    this.gnd[i] = s.gnd; this.own[i] = o; this.fin[i] = s.fin; this.rot[i] = Math.random() * 6.283; this.spin[i] = (Math.random() * 2 - 1) * s.spin; this.seed[i] = Math.random();
    this.size[i] = s.s0; this.alpha[i] = 0;
    this.cnt[o]++;
    return true;
  }

  /** a car this frame, for the wake (world x, z, velocity, radius of the air it drags) */
  car(x, z, vx, vz, r) { const C = this.cars, i = C.n; if (i >= CARS) return; C.x[i] = x; C.z[i] = z; C.vx[i] = vx; C.vz[i] = vz; C.sp[i] = Math.hypot(vx, vz); C.r2[i] = r * r; C.n++; }
  /** a light the puffs near it take (linear rgb, radius m), this frame only */
  glow(x, y, z, r, g, b, rad) { const G = this.glows, i = G.n; if (i >= GLOWS || r + g + b < 0.003) return; G.x[i] = x; G.y[i] = y; G.z[i] = z; G.r[i] = r; G.g[i] = g; G.b[i] = b; G.k[i] = 1 / (rad * rad); G.n++; }

  /** a heat shimmer this frame: hot gas leaving (x, y, z) along the unit (dx, dy, dz), strength 0..1 (SmokePass bends the picture behind it) */
  heat(x, y, z, dx, dy, dz, k) {
    const H = this.heatIn, a = H.a, o = H.n * 7; if (H.n >= HEAT || k < 0.01) return;
    a[o] = x; a[o + 1] = y; a[o + 2] = z; a[o + 3] = dx; a[o + 4] = dy; a[o + 5] = dz; a[o + 6] = k; H.n++;
  }

  kill(i) {      // swap the last one in
    const last = --this.n; this.cnt[this.own[i] | 0]--;
    if (i !== last) for (const a of this.arrs) a[i] = a[last];
  }

  /** dt s; wind m/s */
  step(dt, wx, wz) {
    this.lead = dt;
    const C = this.cars, PX = this.px, PY = this.py, PZ = this.pz, VX = this.vx, VY = this.vy, VZ = this.vz, AGE = this.age, LIFE = this.life, KIND = this.kind;
    const wk = 1 - Math.exp(-5 * dt);
    for (let i = 0; i < this.n;) {
      const age = (AGE[i] += dt), life = LIFE[i], kind = KIND[i];
      if (age >= life) { this.kill(i); continue; }
      const dd = this.drag[i] * dt, k = 1 - dd + dd * dd * 0.5;      // exp(-drag dt): dt is a frame, drag a few per second
      let vx = wx + (VX[i] - wx) * k, vz = wz + (VZ[i] - wz) * k, vy = VY[i] * k + this.rise[i] * (kind === STREAK ? 1 : Math.exp(-age / 1.4)) * dt;   // hot smoke rises while it cools
      const tb = this.turb[i] * dt, ph = age * 1.3 + this.seed[i] * 50;
      vx += Math.sin(ph) * tb; vz += Math.cos(ph * 0.83 + 1.7) * tb; vy += Math.sin(ph * 1.31 + 4) * tb * 0.4;
      let x = PX[i], z = PZ[i];
      for (let j = 0; j < C.n; j++) {            // a car driving through drags the air along and pushes it aside
        const dx = x - C.x[j], dz = z - C.z[j], d2 = dx * dx + dz * dz;
        if (d2 >= C.r2[j]) continue;
        const w = (1 - d2 / C.r2[j]) * wk, sp = C.sp[j], d = Math.sqrt(d2) + 0.2;
        vx += (C.vx[j] * 0.55 - vx) * w + dx / d * sp * 0.25 * w; vz += (C.vz[j] * 0.55 - vz) * w + dz / d * sp * 0.25 * w;
      }
      x += vx * dt; z += vz * dt;
      let y = PY[i] + vy * dt;
      const s0 = this.s0[i], sz = s0 + (this.s1[i] - s0) * (1 - Math.exp(-age / this.grow[i])), floor = this.gnd[i] + (kind === STREAK ? 0.02 : sz * 0.3);
      if (y < floor) { if (kind === STREAK) { this.kill(i); continue; } y = floor; vy = Math.max(vy, 0); }    // smoke rolls along the road; droplets land
      PX[i] = x; PY[i] = y; PZ[i] = z; VX[i] = vx; VY[i] = vy; VZ[i] = vz;
      this.size[i] = sz; this.rot[i] += this.spin[i] * dt;
      // the same smoke over a bigger puff is thinner (haze less so: it is fed all along); fades in fast, out over its life
      const g = (s0 + 0.35) / (sz + 0.35), thin = kind === SMOKE ? Math.sqrt(g) : Math.sqrt(Math.sqrt(g)), u = 1 - age / life;
      this.alpha[i] = this.a0[i] * Math.min(1, age / this.fin[i]) * u * Math.sqrt(Math.sqrt(u)) * thin;
      i++;
    }
    this.cars.n = 0;
  }

  /** sort back to front from the camera and write the instance data (call after step, before drawing) */
  upload(camera) {
    const n = this.n, K = this.ord, G = this.glows, at = this.at;
    if (camera) {          // a two-pass radix sort on the view depth (1/64 m steps, 1 km), far first: O(n), nothing allocated
      const c = camera.position, f = this._f.set(0, 0, -1).applyQuaternion(camera.quaternion), Q = this.kq, T = this.tmp, B = this.bins;
      for (let i = 0; i < n; i++) Q[i] = 65535 - Math.min(65535, Math.max(0, ((this.px[i] - c.x) * f.x + (this.py[i] - c.y) * f.y + (this.pz[i] - c.z) * f.z) * 64 | 0));
      B.fill(0); for (let i = 0; i < n; i++) B[Q[i] & 255]++;
      for (let b = 0, p = 0; b < 256; b++) { const m = B[b]; B[b] = p; p += m; }
      for (let i = 0; i < n; i++) T[B[Q[i] & 255]++] = i;
      B.fill(0); for (let i = 0; i < n; i++) B[Q[i] >> 8]++;
      for (let b = 0, p = 0; b < 256; b++) { const m = B[b]; B[b] = p; p += m; }
      for (let j = 0; j < n; j++) { const i = T[j]; K[B[Q[i] >> 8]++] = i; }
    } else for (let i = 0; i < n; i++) K[i] = i;
    const PS = at.aPS.array, MI = at.aMisc.array, KI = at.aKind.array, CO = at.aCol.array, LA = at.aLamp.array, VE = at.aVel.array, fv = this.focusV;
    for (let j = 0; j < n; j++) {
      const i = K[j], j4 = j * 4, j3 = j * 3, x = this.px[i], y = this.py[i], z = this.pz[i];
      PS[j4] = x; PS[j4 + 1] = y; PS[j4 + 2] = z; PS[j4 + 3] = this.size[i];
      MI[j4] = this.rot[i]; MI[j4 + 1] = this.alpha[i]; MI[j4 + 2] = this.kind[i] === MIST ? 0.6 * this.age[i] / this.life[i] : this.age[i] / this.life[i]; MI[j4 + 3] = this.seed[i];
      KI[j4] = this.kind[i]; KI[j4 + 1] = this.gnd[i];
      CO[j3] = this.cr[i]; CO[j3 + 1] = this.cg[i]; CO[j3 + 2] = this.cb[i];
      let lr = 0, lg = 0, lb = 0;
      for (let q = 0; q < G.n; q++) {
        const dx = x - G.x[q], dy = y - G.y[q], dz = z - G.z[q], f = 1 - (dx * dx + dy * dy + dz * dz) * G.k[q];
        if (f > 0) { const w = f * f; lr += G.r[q] * w; lg += G.g[q] * w; lb += G.b[q] * w; }
      }
      LA[j3] = lr; LA[j3 + 1] = lg; LA[j3 + 2] = lb;
      VE[j3] = this.vx[i] - fv.x; VE[j3 + 1] = this.vy[i] - fv.y; VE[j3 + 2] = this.vz[i] - fv.z;
    }
    for (const a of this.attrs) { a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); }
    this.mesh.geometry.instanceCount = n;
    G.n = 0;
    this.heatOut.a.set(this.heatIn.a); this.heatOut.n = this.heatIn.n; this.heatIn.n = 0;      // this frame's shimmer, for the pass
  }

  clear() { this.n = 0; this.cnt.fill(0); this.mesh.geometry.instanceCount = 0; this.glows.n = 0; this.cars.n = 0; this.heatIn.n = this.heatOut.n = 0; }

  count(kind) { let k = 0; for (let i = 0; i < this.n; i++) if (this.kind[i] === kind) k++; return k; }
}

const QUAD_V = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

/** After the RenderPass: the soft particles at `scale` (half) resolution into their own target against the scene's depth, then the frame + particles
 *  into the write buffer (premultiplied over). Asleep (no swap) while nothing is alive. The composer's targets get a DepthTexture each
 *  (the depth they already resolve). Twice a second a probe (a white matte quad facing up, lit by the main scene's environment map
 *  alone) measures the sky's light for the particles' ambient. */
export class SmokePass extends Pass {
  constructor(soft, composer, camera, world, scale = 0.5) {
    super();
    this.soft = soft; this.camera = camera; this.world = world; this.scale = scale; this.dt = 0.016; this.probeT = 0;
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (!rt.depthTexture) { rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height); rt.dispose(); }
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.amb = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.probe = new THREE.Scene(); this.probe.matrixWorldAutoUpdate = true;
    this.probe.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })));
    this.probeCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10); this.probeCam.position.set(0, 2, 0); this.probeCam.lookAt(0, 0, 0);
    // the composite: the frame (bent behind hot exhaust gas: a cone from each flame, screen space, only where the scene lies behind
    // the flame, a fine noise rising and running down it) under the particles
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, tSmoke: { value: this.rt.texture }, tDepth: { value: null }, uHA: { value: Array.from({ length: HEAT }, () => new THREE.Vector4()) },
        uHB: { value: Array.from({ length: HEAT }, () => new THREE.Vector4()) }, uHN: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uCamN: { value: 0.1 }, uCamF: { value: 1000 } },
      vertexShader: QUAD_V, blending: THREE.NoBlending, depthTest: false, depthWrite: false,
      fragmentShader: /* glsl */`
        uniform sampler2D tScene, tSmoke, tDepth; uniform vec4 uHA[${HEAT}], uHB[${HEAT}]; uniform int uHN; uniform float uTime, uAspect, uCamN, uCamF; varying vec2 vUv;
        #include <packing>
        float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float hn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 off = vec2(0.0), asp = vec2(uAspect, 1.0);
          for (int i = 0; i < ${HEAT}; i++) {
            if (i >= uHN) break;
            vec2 ab = (uHB[i].xy - uHA[i].xy) * asp, ap = (vUv - uHA[i].xy) * asp;
            float t = clamp(dot(ap, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0), w = mix(uHA[i].w, uHB[i].w, t);
            float m = (1.0 - smoothstep(0.25 * w, w, length(ap - ab * t))) * smoothstep(0.0, 0.1, t) * (1.0 - t) * uHB[i].z;
            if (m < 0.001) continue;
            m *= smoothstep(uHA[i].z - 0.5, uHA[i].z + 0.3, -perspectiveDepthToViewZ(texture2D(tDepth, vUv).r, uCamN, uCamF));
            vec2 q = vUv * asp * 150.0;
            off += (vec2(hn(q + vec2(0.0, uTime * 9.0)), hn(q * 1.3 + vec2(uTime * 7.0, 3.1))) - 0.5) * m * 0.007;
          }
          vec4 s = texture2D(tSmoke, vUv), c = texture2D(tScene, vUv + off);
          gl_FragColor = vec4(c.rgb * (1.0 - s.a) + s.rgb, c.a);
        }`,
    }));
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this.time = 0;
    this.scene = new THREE.Scene(); this.scene.matrixWorldAutoUpdate = false;
    soft.mat.defines.SOFT = ''; soft.mat.depthTest = false; soft.mat.needsUpdate = true;
    soft.ambient(this.amb.texture);
    this._c = new THREE.Color();
  }

  setSize(w, h) { this.rt.setSize(Math.max(1, Math.round(w * this.scale)), Math.max(1, Math.round(h * this.scale))); }

  render(renderer, writeBuffer, readBuffer) {
    // the first frame runs the whole path once, so its programs are built with the race's warm-up, not when the first smoke appears
    const u = this.soft.mat.uniforms, hot = this.shimmer(), live = ((this.soft.mesh.geometry.instanceCount > 0 || hot) && this.soft.group.visible) || !this.warm;
    this.warm = true;
    if ((this.probeT -= this.dt) <= 0 && this.world.environment) {      // the sky's light on a white matte surface (no lamps, no sun: they come apart)
      this.probeT = 0.5; const p = this.probe, w = this.world;
      p.environment = w.environment; p.environmentIntensity = w.environmentIntensity; p.environmentRotation.copy(w.environmentRotation);
      renderer.setRenderTarget(this.amb); renderer.render(p, this.probeCam);
    }
    this.needsSwap = live;
    if (!live) return;
    u.tDepth.value = readBuffer.depthTexture; u.uInv.value.set(1 / this.rt.width, 1 / this.rt.height);
    const cc = renderer.getClearColor(this._c), ca = renderer.getClearAlpha();
    renderer.setRenderTarget(this.rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
    renderer.render(this.scene, this.camera);
    renderer.setClearColor(cc, ca);
    const q = this.quad.material.uniforms;
    q.tScene.value = readBuffer.texture; q.tDepth.value = readBuffer.depthTexture; q.uCamN.value = this.camera.near; q.uCamF.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }

  /** the heat sources onto the screen: from the nozzle 2 m down the flame, 0.1 m wide there to 0.45 m; false when there are none in view */
  shimmer() {
    const H = this.soft.heatOut, q = this.quad.material.uniforms, cam = this.camera, a = this._v, b = this._w;
    this.time += this.dt; q.uTime.value = this.time; q.uAspect.value = cam.aspect;
    const k = 0.5 / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);      // metres at view depth z -> uv height: k / z
    let n = 0;
    for (let i = 0; i < H.n; i++) {
      const o = i * 7, A = H.a;
      a.set(A[o], A[o + 1], A[o + 2]).applyMatrix4(cam.matrixWorldInverse); const za = -a.z;
      b.set(A[o] + A[o + 3] * 2, A[o + 1] + A[o + 4] * 2 + 0.15, A[o + 2] + A[o + 5] * 2).applyMatrix4(cam.matrixWorldInverse); const zb = -b.z;
      if (za < 0.3 || zb < 0.3) continue;
      a.applyMatrix4(cam.projectionMatrix); b.applyMatrix4(cam.projectionMatrix);
      q.uHA.value[n].set(a.x * 0.5 + 0.5, a.y * 0.5 + 0.5, za, 0.1 * k / za);
      q.uHB.value[n].set(b.x * 0.5 + 0.5, b.y * 0.5 + 0.5, A[o + 6], 0.45 * k / zb);
      n++;
    }
    q.uHN.value = n;
    return n > 0;
  }
}
