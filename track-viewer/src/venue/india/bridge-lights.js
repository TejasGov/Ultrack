// The suspension bridge's uplights: two projectors on the ground at the foot of each portal leg (approach face and inner face) wash the
// legs and the beam between them from below, so the portals stand lit against the dark from far up the road. The portals are in the
// glTF as plain boxes (the legs 3.3 m square, 68 m tall, standing in the gorge below the deck; the top beam joins each pair), so the
// wash is one additive pass over those same triangles (copied into one buffer, pulled forward by a polygon offset), shaded by height
// over the foot, by which faces look at a projector and by how far across the face: lit pillars, not a floating glow. The projectors
// stand where the terrain is (a ray down per fixture); the housings are real boxes with a lens that faces up the leg.
import * as THREE from 'three';
import { projectorParts } from './fixture.js';

const WARM = new THREE.Color(0xffe2b8);
const OUT = 1.8;                    // a projector stands this far (m) off the face
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The portal faces of the suspension bridge meshes, as the glTF has them (every box face its own 4 vertices): the tall faces are the legs' sides,
 *  the flat ones at the top the beam and the leg caps. -> { tall: [face], top: [face] }, face = { min, max, tris: [[a, b, c] world positions] } */
function portalFaces(root) {
  const tall = [], top = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !/^River_suspension_bridge/.test(o.name) || !o.geometry.index) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, par = new Int32Array(pos.count).map((_, i) => i);
    const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    for (let t = 0; t < idx.count; t += 3) { const r = find(idx.getX(t)); par[find(idx.getX(t + 1))] = r; par[find(idx.getX(t + 2))] = r; }
    const faces = new Map();
    for (let t = 0; t < idx.count; t += 3) {
      const r = find(idx.getX(t)); let k = faces.get(r); if (!k) faces.set(r, k = { min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity), tris: [] });
      a.fromBufferAttribute(pos, idx.getX(t)).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, idx.getX(t + 1)).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, idx.getX(t + 2)).applyMatrix4(o.matrixWorld);
      k.min.min(a).min(b).min(c); k.max.max(a).max(b).max(c); k.tris.push([a.clone(), b.clone(), c.clone()]);
    }
    for (const k of faces.values()) {
      const w = k.max.x - k.min.x, d = k.max.z - k.min.z, h = k.max.y - k.min.y;
      if (h > 40 && w < 5 && d < 5 && k.max.y > 55) tall.push(k);
      else if (k.min.y > 55 && h < 4 && w < 40 && d < 40 && w * d > 1) top.push(k);
    }
  });
  return { tall, top };
}

const VS = /* glsl */`
  attribute vec3 aN; attribute vec4 aLeg, aFix;       // aLeg: foot y, half width, centre xz; aFix: unit directions leg -> its two projectors (xz, xz)
  varying vec3 vW, vN; varying vec4 vLeg, vFix; varying float vDepth;
  void main() {
    vec4 wp = modelMatrix * vec4(position + aN * 0.02, 1.0);
    vW = wp.xyz; vN = aN; vLeg = aLeg; vFix = aFix;
    vec4 mv = viewMatrix * wp; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const FS = /* glsl */`
  uniform float uK, uFogD; uniform vec3 uColor;
  varying vec3 vW, vN; varying vec4 vLeg, vFix; varying float vDepth;
  void main() {
    float h = max(vW.y - vLeg.x, 0.0);
    float prof = 0.12 + 0.88 * exp(-h / 38.0);                              // the beams lose strength up the leg, slowly: the whole height reads
    float nl = length(vN.xz);
    vec2 n2 = nl > 0.01 ? vN.xz / nl : vec2(0.0);
    float toward = max(dot(n2, vFix.xy), dot(n2, vFix.zw));                 // 1 on a face that looks at a projector
    float across = vLeg.y > 0.0 ? clamp(dot(vW.xz - vLeg.zw, vec2(-n2.y, n2.x)) / vLeg.y, -1.0, 1.0) : 0.0;
    float side = mix(0.4, 1.0, clamp(toward, 0.0, 1.0)) * (1.0 - 0.38 * across * across);
    float face = nl > 0.5 ? side : vN.y < -0.5 ? 1.25 : 0.22;               // soffits catch the beams, tops hardly
    gl_FragColor = vec4(uColor * (uK * prof * face * exp(-uFogD * uFogD * vDepth * vDepth)), 1.0);
  }`;

export async function create({ scene, root, track, NO_MIRROR }) {
  const { tall, top } = portalFaces(root);
  // a leg = the (four) tall faces whose centres lie within 4.5 m of the first one's (3.3 m across)
  const legs = [];
  for (const f of tall) {
    const c = new THREE.Vector3((f.min.x + f.max.x) / 2, 0, (f.min.z + f.max.z) / 2), leg = legs.find((l) => l.c.distanceTo(c) < 4.5);
    if (leg) { leg.faces.push(f); leg.min.min(f.min); leg.max.max(f.max); } else legs.push({ c, faces: [f], min: f.min.clone(), max: f.max.clone() });
  }
  if (!legs.length) return null;
  for (const l of legs) l.c.set((l.min.x + l.max.x) / 2, 0, (l.min.z + l.max.z) / 2);
  // the road's direction through each portal, to know the approach face; the partner leg gives the inner face
  const C = track.centerline;
  const roadDir = (p) => { let bi = 0, bd = Infinity; C.forEach((q, i) => { const d = (q[0] - p.x) ** 2 + (q[2] - p.z) ** 2; if (d < bd) { bd = d; bi = i; } }); const a = C[Math.max(0, bi - 1)], b = C[Math.min(C.length - 1, bi + 1)]; return new THREE.Vector2(b[0] - a[0], b[2] - a[2]).normalize(); };
  // the ground under each leg
  const rc = new THREE.Raycaster(), terrain = []; root.traverse((o) => { if (o.isMesh && /^V5_terrain_\|_continuous/.test(o.name)) terrain.push(o); });
  const groundAt = (x, z, fallback) => { rc.set(new THREE.Vector3(x, 120, z), new THREE.Vector3(0, -1, 0)); rc.far = 200; const h = rc.intersectObjects(terrain, false); return h.length ? h[0].point.y : fallback; };
  const info = legs.map((k) => {
    const c = k.c, partner = legs.filter((o) => o !== k).sort((x, y) => x.c.distanceToSquared(c) - y.c.distanceToSquared(c))[0];   // the other leg of the portal (~32 m), not the next portal (>100 m)
    const inner = partner ? new THREE.Vector2(partner.c.x - c.x, partner.c.z - c.z).normalize() : new THREE.Vector2(1, 0), toward = roadDir(c).multiplyScalar(-1);   // the approach face looks back down the lap
    return { k, c, half: (k.max.x - k.min.x + k.max.z - k.min.z) / 4, y0: groundAt(c.x, c.z, k.min.y + 5), dirs: [toward, inner] };
  });
  // the wash: every leg side and top triangle in world space with its flat normal and the data of its leg (a top face: the nearest leg's foot, no across-fade)
  const segDist = (p, a, b) => { const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1), 0, 1); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  const beams = top.filter((f) => { const mid = new THREE.Vector3((f.min.x + f.max.x) / 2, 0, (f.min.z + f.max.z) / 2); return info.some((l) => info.some((o) => o !== l && l.c.distanceTo(o.c) < 60 && segDist(mid, l.c, o.c) < 4)); });
  const faces = [...tall.map((f) => ({ f, leg: info.find((q) => q.k.faces.includes(f)), side: true })), ...beams.map((f) => ({ f, leg: null, side: false }))];
  const tris = faces.flatMap(({ f, leg, side }) => f.tris.map((t) => ({ t, leg, side })));
  const P = new Float32Array(tris.length * 9), N = new Float32Array(tris.length * 9), L = new Float32Array(tris.length * 12), F = new Float32Array(tris.length * 12);
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  tris.forEach(({ t, leg, side }, i) => {
    n.crossVectors(ab.subVectors(t[1], t[0]), ac.subVectors(t[2], t[0])).normalize();
    const mid = t[0].clone().add(t[1]).add(t[2]).divideScalar(3), own = leg ?? info.reduce((best, q) => (q.c.distanceToSquared(mid) < best.c.distanceToSquared(mid) ? q : best));
    const [d0, d1] = own.dirs;
    for (let v = 0; v < 3; v++) {
      P.set([t[v].x, t[v].y, t[v].z], i * 9 + v * 3); N.set([n.x, n.y, n.z], i * 9 + v * 3);
      L.set([own.y0, side ? own.half : 0, own.c.x, own.c.z], i * 12 + v * 4); F.set([d0.x, d0.y, d1.x, d1.y], i * 12 + v * 4);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('aN', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('aLeg', new THREE.BufferAttribute(L, 4)); geo.setAttribute('aFix', new THREE.BufferAttribute(F, 4));
  geo.computeBoundingSphere();
  const uniforms = { uK: { value: 0 }, uFogD: { value: 0 }, uColor: { value: WARM.clone() } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, fog: false });
  const wash = new THREE.Mesh(geo, mat); wash.name = 'india bridge wash'; wash.frustumCulled = false; wash.renderOrder = 2; wash.castShadow = wash.receiveShadow = false;
  // the projectors: two per leg, on the ground off the approach face and the inner face, lens toward the leg
  const { housing, lens } = projectorParts(), count = info.length * 2;
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x2b2e34, roughness: 0.5, metalness: 0.6 }), lensMat = new THREE.MeshBasicMaterial({ color: WARM.clone().multiplyScalar(0.05) });
  const body = new THREE.InstancedMesh(housing, housingMat, count), glass = new THREE.InstancedMesh(lens, lensMat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  info.forEach((l, i) => l.dirs.forEach((d, j) => {
    const x = l.c.x + d.x * (l.half + OUT), z = l.c.z + d.y * (l.half + OUT);
    q.setFromAxisAngle(up, Math.atan2(-d.x, -d.y)); m.compose(p.set(x, groundAt(x, z, l.y0) + 0.02, z), q, one);   // +z of the fixture looks back at the leg
    body.setMatrixAt(i * 2 + j, m); glass.setMatrixAt(i * 2 + j, m);
  }));
  const group = new THREE.Group(); group.name = 'india bridge uplights'; group.add(wash);
  for (const o of [body, glass]) { o.frustumCulled = false; o.castShadow = o.receiveShadow = false; o.layers.set(NO_MIRROR); group.add(o); }
  scene.add(group);
  console.info(`india bridge lights: ${legs.length} legs, ${beams.length} beam faces, ${tris.length} tris, ${count} projectors`);
  return {
    gain(lit) { uniforms.uK.value = 0.55 * lit; lensMat.color.copy(WARM).multiplyScalar(0.05 + 1.95 * lit); wash.visible = lit > 0.001; },
    update() { uniforms.uFogD.value = scene.fog?.density ?? 0; },
    dispose() { scene.remove(group); for (const g of [geo, mat, housing, lens, housingMat, lensMat]) g.dispose(); body.dispose(); glass.dispose(); },
  };
}
