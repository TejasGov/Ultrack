// The wet neon street: each sign near the road lays a long soft streak of its colour on the wet asphalt, from its foot toward the
// viewer, the way rain-rough water stretches a light's reflection (the road mirror alone gives short smears at the kerb). A streak
// is a strip on the road turned to the camera in the vertex shader; it fades along its length and to its sides, and a still,
// world-space grain breaks it up like rough water (nothing animates, so nothing flickers). Damp a little, rain fully, never dry;
// night and evening only. One merged mesh, one draw, not in the road mirror. It sits 15 cm over the road and is soft, so lane
// lines and kerbs read through it.
import * as THREE from 'three';
import { analyseSigns, PALETTE } from './signs.js';
import { groundField } from './light-pools.js';

const NEAR = 28, SEGS = 6;          // m from the centerline; segments along a streak

const VS = /* glsl */`
  attribute vec3 aBase, aCol; attribute vec4 aShape;     // foot of the sign; colour; width, height, along (0..1), across (-1..1)
  varying vec3 vCol, vW; varying vec2 vTS; varying float vDepth;
  void main() {
    vec2 d = cameraPosition.xz - aBase.xz; float dist = max(length(d), 1.0); vec2 dir = d / dist, side = vec2(-dir.y, dir.x);
    float L = min(dist * 0.85, 8.0 + aShape.y * 3.0), t = aShape.z;
    vec3 p = vec3(aBase.x, aBase.y + 0.12, aBase.z);
    p.xz += dir * (t * L) + side * (aShape.w * aShape.x * 0.5 * (1.0 + 0.6 * t));
    vCol = aCol; vTS = aShape.zw; vW = p;
    vec4 mv = viewMatrix * vec4(p, 1.0); vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const FS = /* glsl */`
  uniform float uK, uFogD; varying vec3 vCol, vW; varying vec2 vTS; varying float vDepth;
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    float t = clamp(vTS.x, 0.0, 1.0), s = vTS.y;          // interpolation can step past 1: pow() of a negative is NaN, and bloom spreads a NaN over the frame
    float along = smoothstep(0.0, 0.06, t) * pow(1.0 - t, 1.6), across = exp(-s * s * 3.5);
    float grain = 0.55 + 0.45 * vn(vW.xz * vec2(1.7, 0.45) + 3.1) * vn(vW.zx * 0.9);
    gl_FragColor = vec4(vCol * (along * across * grain * uK * exp(-uFogD * uFogD * vDepth * vDepth)), 1.0);
  }`;

export async function create({ scene, root, track, NO_MIRROR }) {
  const C = track.centerline, size = new THREE.Vector3();
  const ground = groundField(root);
  // the road's surface next to the sign (the centerline height is a little under the road mesh in places: a streak there hid)
  const road = (x, z) => { let bd = Infinity, bi = 0; for (let i = 0; i < C.length; i++) { const d = (C[i][0] - x) ** 2 + (C[i][2] - z) ** 2; if (d < bd) { bd = d; bi = i; } } return { d: Math.sqrt(bd), y: ground(C[bi][0], C[bi][2], C[bi][1] + 2) ?? C[bi][1] }; };
  const list = [];
  for (const s of analyseSigns(root).signs) {
    if (s.style > 2) continue;
    const r = road(s.pos.x, s.pos.z);
    if (r.d > NEAR || s.pos.y - r.y < 1.5 || s.pos.y - r.y > 30) continue;
    s.box.getSize(size);
    const p = PALETTE[s.hue];
    list.push({ base: [s.pos.x, r.y, s.pos.z], col: p.c.clone().multiplyScalar(p.k * (s.style < 2 ? 1 : 0.7)), w: THREE.MathUtils.clamp(Math.max(size.x, size.z), 0.8, 3), h: s.pos.y - r.y });
  }
  const nv = list.length * (SEGS + 1) * 2, B = new Float32Array(nv * 3), CO = new Float32Array(nv * 3), SH = new Float32Array(nv * 4), I = [];
  let v = 0;
  for (const it of list) {
    const first = v;
    for (let j = 0; j <= SEGS; j++) for (const side of [-1, 1]) {
      B.set(it.base, v * 3); CO.set([it.col.r, it.col.g, it.col.b], v * 3); SH.set([it.w, it.h, j / SEGS, side], v * 4); v++;
    }
    for (let j = 0; j < SEGS; j++) { const q = first + j * 2; I.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(B, 3));          // the foot: also the bounds three needs
  geo.setAttribute('aBase', new THREE.BufferAttribute(B, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(CO, 3));
  geo.setAttribute('aShape', new THREE.BufferAttribute(SH, 4));
  geo.setIndex(I);
  const uniforms = { uK: { value: 0 }, uFogD: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'tokyo_neon_streaks'; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.matrixAutoUpdate = false;
  mesh.layers.set(NO_MIRROR);
  scene.add(mesh);
  console.info(`tokyo neon streaks: ${list.length} signs, ${I.length / 3} tris`);
  return {
    setLook(look, params) {
      const wet = THREE.MathUtils.smoothstep(params?.wet ?? 0, 0.3, 1), night = THREE.MathUtils.smoothstep(look.dn ?? 1, 0.5, 1);
      uniforms.uK.value = 0.5 * wet * night;
      mesh.visible = uniforms.uK.value > 0.001;
    },
    update() { uniforms.uFogD.value = scene.fog?.density ?? 0; },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
