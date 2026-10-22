// Shared pieces of the car effects (carkit/fx.js, fx-nitro.js, fx-vapor.js): helpers and the pooled GPU particle system.
// A Pool is a structure-of-arrays of billboard particles behind ONE instanced mesh (one draw call); dead particles are swapped
// out, nothing is allocated per frame. Particles live in world space (a car leaves its gas behind at speed).
//   modes of step(): FIRE 0 additive flames, SMOKE 1 translucent gas, VAPOR 2 steam (turbulence, wind, lamp tint that fades),
//   MIST 3 tyre spray (turbulence, wind; aRel stays the velocity relative to the car, so the sprite stretches along it)
// Exposure: the scene's tone-mapping exposure is 0.45 at dusk and 1.25 at night, so emissive effects scale by a gain
// that follows it (gainFor), set from the mesh's own onBeforeRender.
import * as THREE from 'three';

export const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const FIRE = 0, SMOKE = 1, VAPOR = 2, MIST = 3;

/** emissive gain for a tone-mapping exposure: dusk (0.45) lifts ~1.9x, night (1.25) lowers a little */
export const gainFor = (exposure) => clamp(Math.pow(1 / Math.max(exposure, 0.05), 0.8), 0.75, 2.4);

const QUAD = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0];
export function instanced(attrs, max) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(QUAD, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [n, k] of Object.entries(attrs)) g.setAttribute(n, new THREE.InstancedBufferAttribute(new Float32Array(max * k), k).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  return g;
}
export const finish = (g, mat, name, order = 5) => { const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = order; m.name = name; return m; };
export const upload = (g, n) => { for (const a of Object.values(g.attributes)) if (a.isInstancedBufferAttribute) { a.needsUpdate = true; a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); } g.instanceCount = n; };

export const NOISE = /* glsl */`
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }`;

export class Pool {
  /** o: { blending, fragment, stretch, name, max, order, uniforms, gain (follow the exposure), onRender(renderer, camera, uniforms), base (streak root on the anchor), attack (0..1 of life, flames ease in), age (aRot = age 0..1 for the shader) } */
  constructor(o) {
    this.max = o.max ?? 3000;
    const MAX = this.max;
    const g = instanced({ aPos: 3, aCol: 3, aSize: 1, aAlpha: 1, aRot: 1, aSeed: 1, aRel: 3 }, MAX);
    const uniforms = { uLight: { value: new THREE.Color(1, 1, 1) }, uStretch: { value: o.stretch ?? 0 }, uGain: { value: 1 }, uNear: { value: new THREE.Vector2(...(o.near ?? [0.25, 1.4])) }, ...(o.uniforms ?? {}) };
    const mat = new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, blending: o.blending,
      vertexShader: /* glsl */`
        attribute vec3 aPos, aCol, aRel; attribute float aSize, aAlpha, aRot, aSeed;
        uniform float uStretch; uniform vec2 uNear;
        varying vec2 vUv; varying vec3 vCol, vRel; varying float vAlpha, vSeed, vRot;
        void main() {
          vUv = position.xy + 0.5; vCol = aCol; vRel = aRel; vSeed = aSeed; vRot = aRot;
          vec4 mv = viewMatrix * vec4(aPos, 1.0);
          vAlpha = aAlpha * smoothstep(uNear.x, uNear.y, -mv.z);     // fades out near the lens instead of filling it
          // flames stretch along their own jet (velocity relative to the car), seen from any side; gas just turns
          vec3 vv = mat3(viewMatrix) * aRel;
          vec2 vr = vv.xy;
          ${o.projected ? `// the streak runs along the particle's motion as the picture sees it (radially, for a car driving away from the lens)
          vec3 q1 = mv.xyz + vv * 0.02; vec2 sd = q1.xy / max(-q1.z, 0.05) - mv.xy / max(-mv.z, 0.05); vr = sd * max(-mv.z, 0.05) * 50.0;` : ''}
          float L = length(vr) * uStretch;
          vec2 ax = L > 0.001 ? normalize(vr) : vec2(cos(aRot), sin(aRot)), ay = vec2(-ax.y, ax.x);
          mv.xy += (ax * position.x * (1.0 + L) + ay * position.y) * aSize;
          ${o.base ? 'mv.xy += ax * 0.5 * (1.0 + L) * aSize;     // the root of a streak sits on its anchor' : ''}
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uLight; uniform float uGain; varying vec2 vUv; varying vec3 vCol, vRel; varying float vAlpha, vSeed, vRot;
        ${NOISE}
        ${o.pre ?? ''}
        void main() { ${o.fragment} }`,
    });
    this.mesh = finish(g, mat, o.name, o.order ?? 5);
    if (o.gain || o.onRender) this.mesh.onBeforeRender = (renderer, scene, camera) => {
      if (o.gain) uniforms.uGain.value = gainFor(renderer.toneMappingExposure);
      o.onRender?.(renderer, camera, uniforms);
    };
    this.at = g.attributes; this.n = 0; this.atk = o.attack ?? 0; this.ageRot = !!o.age;
    this.keep = [[this.at.aPos.array, 3], [this.at.aRot.array, 1], [this.at.aSeed.array, 1]];
    for (const [k, s] of [['vel', 3], ['rel', 3], ['col', 3], ['age', 1], ['life', 1], ['s0', 1], ['s1', 1], ['a0', 1], ['spin', 1], ['drag', 1], ['rise', 1], ['cool', 1]]) {
      this[k] = new Float32Array(MAX * s); this.keep.push([this[k], s]);
    }
  }

  /** cool: fire colour cooling (0..1) / vapor turbulence (m/s2) */
  spawn(px, py, pz, vx, vy, vz, rx, ry, rz, life, s0, s1, a0, r, g, b, drag, rise, cool) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3, P = this.at.aPos.array;
    P[i3] = px; P[i3 + 1] = py; P[i3 + 2] = pz;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.rel[i3] = rx; this.rel[i3 + 1] = ry; this.rel[i3 + 2] = rz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
    this.drag[i] = drag; this.rise[i] = rise; this.cool[i] = cool;
    this.at.aRot.array[i] = Math.random() * 6.28; this.spin[i] = rnd(1.2); this.at.aSeed.array[i] = Math.random();
  }

  /** wx, wz: wind (m/s) smoke and vapor relax toward */
  step(dt, mode, wx = 0, wz = 0) {
    const at = this.at, P = at.aPos.array, V = this.vel, C = at.aCol.array, R = at.aRel.array, S = at.aSeed.array;
    for (let i = 0; i < this.n;) {
      const age = (this.age[i] += dt), life = this.life[i];
      if (age >= life) {                      // swap the last particle in; it is processed next iteration
        const last = --this.n;
        if (i !== last) for (const [a, s] of this.keep) for (let j = 0; j < s; j++) a[i * s + j] = a[last * s + j];
        continue;
      }
      const k = Math.exp(-this.drag[i] * dt), i3 = i * 3;
      if (mode === FIRE) { V[i3] *= k; V[i3 + 2] *= k; } else { V[i3] = wx + (V[i3] - wx) * k; V[i3 + 2] = wz + (V[i3 + 2] - wz) * k; }
      V[i3 + 1] = V[i3 + 1] * k + this.rise[i] * dt;
      if (mode >= VAPOR) {                     // billowing: each puff meanders on its own slow phase
        const ph = age * 1.7 + S[i] * 50, tb = this.cool[i] * dt;
        V[i3] += Math.sin(ph) * tb; V[i3 + 2] += Math.cos(ph * 0.83 + 1.7) * tb; V[i3 + 1] += Math.sin(ph * 1.31 + 4) * tb * 0.35;
      }
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      at.aRot.array[i] += this.spin[i] * dt;
      const t = age / life;
      if (this.ageRot) at.aRot.array[i] = t;
      at.aSize.array[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * (mode === FIRE ? t : 1 - (1 - t) * (1 - t));
      if (mode === FIRE) {
        const ea = this.atk ? Math.min(1, t / this.atk) : 1;      // smooth onset: a flame never blinks on
        at.aAlpha.array[i] = this.a0[i] * (1 - t) ** 1.25 * ea * ea * (3 - 2 * ea);
        const cool = this.cool[i] * t;
        C[i3] = this.col[i3] * (1 - 0.25 * cool); C[i3 + 1] = this.col[i3 + 1] * (1 - 0.6 * cool); C[i3 + 2] = this.col[i3 + 2] * (1 - 0.85 * cool);
        R[i3] = this.rel[i3]; R[i3 + 1] = this.rel[i3 + 1]; R[i3 + 2] = this.rel[i3 + 2];
      } else {
        at.aAlpha.array[i] = this.a0[i] * Math.min(1, t * (mode >= VAPOR ? 4 : 6)) * (1 - t) ** (mode >= VAPOR ? 1.6 : 1.4);
        C[i3] = this.col[i3]; C[i3 + 1] = this.col[i3 + 1]; C[i3 + 2] = this.col[i3 + 2];
        if (mode === VAPOR) { const f = (1 - t) ** 1.5; R[i3] = this.rel[i3] * f; R[i3 + 1] = this.rel[i3 + 1] * f; R[i3 + 2] = this.rel[i3 + 2] * f; }   // lamp glow fades as the steam leaves
        else { R[i3] = this.rel[i3]; R[i3 + 1] = this.rel[i3 + 1]; R[i3 + 2] = this.rel[i3 + 2]; }
      }
      i++;
    }
    upload(this.mesh.geometry, this.n);
  }
}
