// The garden pond (game coords x -186..-130, z 96..128, water surface y 0.2): four koi gliding at the surface and a dozen tōrō nagashi, little paper lanterns
// drifting on the water. Everything is two InstancedMeshes (the koi, the lanterns) and one for the lanterns' glow on the water. The pond's water is an opaque
// dark box, so the koi swim at its surface (their lower half is hidden by it) and the paths are slow analytic curves: no state, no flicker.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const POND = { min: [-186.5, 0.2, 96.5], max: [-130.5, 0.2, 127.5] };
const KOI = 4, LANTERNS = 12;
const WHITE = new THREE.Color('#f3eee4'), RED = new THREE.Color('#e5441b'), BLACK = new THREE.Color('#1b1719'), FIN = new THREE.Color('#efd3c6');

function koiGeometry() {
  const L = 1.25, prof = [[0, 0.015, 0.012], [0.05, 0.07, 0.055], [0.14, 0.115, 0.09], [0.3, 0.15, 0.115], [0.5, 0.14, 0.11], [0.72, 0.095, 0.075], [0.9, 0.05, 0.045], [1, 0.03, 0.03]];
  const at = (t) => { let i = 0; while (i < prof.length - 2 && prof[i + 1][0] < t) i++; const f = (t - prof[i][0]) / (prof[i + 1][0] - prof[i][0]); const s = f * f * (3 - 2 * f); return [1, 2].map((k) => prof[i][k] + (prof[i + 1][k] - prof[i][k]) * s); };
  const NR = 20, NS = 10, pos = [], col = [], idx = [];
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let r = 0; r <= NR; r++) {
    const t = r / NR, [hw, hh] = at(t), z = L * (0.45 - t);
    for (let s = 0; s < NS; s++) {
      const a = (s / NS) * Math.PI * 2, x = Math.cos(a) * hw * 1.0, y = Math.sin(a) * hh;
      pos.push(x, y, z);
      const top = sm(-0.1, 0.5, Math.sin(a));                                               // patches sit on the back and flanks
      const red = Math.max(sm(0.02, 0.06, t) * (1 - sm(0.2, 0.26, t)), sm(0.3, 0.35, t) * (1 - sm(0.56, 0.62, t)) * (0.7 + 0.3 * Math.cos(a * 2)), sm(0.68, 0.72, t) * (1 - sm(0.8, 0.86, t)));
      const spot = (1 - sm(0.025, 0.05, Math.hypot((t - 0.43) * 0.5, Math.cos(a) * 0.12))) * top;
      const c = WHITE.clone().lerp(RED, Math.min(1, red * top)).lerp(BLACK, spot * 0.9);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < NR; r++) for (let s = 0; s < NS; s++) { const a = r * NS + s, b = r * NS + (s + 1) % NS, c = (r + 1) * NS + s, d = (r + 1) * NS + (s + 1) % NS; idx.push(a, c, b, b, c, d); }
  const body = new THREE.BufferGeometry(); body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); body.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); body.setIndex(idx); body.computeVertexNormals();
  const tri = (pts, color) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(pts.flatMap(() => [color.r, color.g, color.b]), 3)); g.setIndex([0, 1, 2]); g.computeVertexNormals(); return g; };
  const zt = L * (0.45 - 1), parts = [body];
  parts.push(tri([[0, 0, zt + 0.05], [-0.2, 0, zt - 0.3], [0, 0, zt - 0.17]], FIN), tri([[0, 0, zt + 0.05], [0, 0, zt - 0.17], [0.2, 0, zt - 0.3]], FIN));    // tail
  for (const sx of [-1, 1]) parts.push(tri([[sx * 0.1, -0.02, L * 0.2], [sx * 0.27, -0.03, L * 0.04], [sx * 0.11, -0.02, L * 0.06]], FIN));                      // pectoral fins
  parts.push(tri([[0, 0.1, L * 0.12], [0, 0.2, L * -0.12], [0, 0.1, L * -0.2]], FIN));                                                                         // dorsal
  const geos = parts.map((g) => { g = g.index ? g.toNonIndexed() : g; return g; });
  geos.forEach((g) => g.computeVertexNormals());
  return mergeGeometries(geos);
}

function lanternGeometry() {
  const paint = (g, c) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const wood = new THREE.Color('#2a1c14'), paper = new THREE.Color('#ffd49a');
  return mergeGeometries([
    paint(new THREE.BoxGeometry(0.5, 0.05, 0.5).translate(0, 0.025, 0), wood),                       // the raft
    paint(new THREE.BoxGeometry(0.34, 0.34, 0.34).translate(0, 0.22, 0), paper),                     // paper body
    paint(new THREE.CylinderGeometry(0.0, 0.3, 0.2, 4, 1).rotateY(Math.PI / 4).translate(0, 0.49, 0), wood),   // a little roof
  ]);
}

export async function create(ctx) {
  // the pond's water: the top face of a box in the venue (a mesh with the footbridge in it, so its own bounds would be wrong): x -186.5..-130.5, z 96.5..127.5, y 0.2
  const box = new THREE.Box3(new THREE.Vector3(...POND.min), new THREE.Vector3(...POND.max));
  const sz = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3()), top = box.max.y;

  // --- koi
  const kGeo = koiGeometry(), time = { value: 0 }, glow = { value: 0 };
  const kMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide });
  kMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time; sh.uniforms.uGlow = glow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float kt = clamp((0.56 - position.z) / 1.25, 0.0, 1.0);                       // 0 at the head, 1 at the tail
        float ph = float(gl_InstanceID) * 1.9;
        transformed.x += sin(uTime * 2.5 - position.z * 4.2 + ph) * 0.17 * kt * kt;     // the body's wave runs head to tail (2.5 s a beat)`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uGlow;');
  };
  kMat.customProgramCacheKey = () => 'tokyo-koi';
  const koi = new THREE.InstancedMesh(kGeo, kMat, KOI); koi.name = 'tokyo-koi'; koi.frustumCulled = false; koi.castShadow = false;
  const tints = ['#ffffff', '#ffd27a', '#ffb89a', '#e9f0ff'];
  tints.slice(0, KOI).forEach((c, i) => koi.setColorAt(i, new THREE.Color(c)));
  // the koi stay in the middle of the pond, under the bridge and in view of its deck
  const course = Array.from({ length: KOI }, (_, i) => ({ cx: ctr.x + (i - 1.5) * 3.2, cz: ctr.z + ((i * 7) % 5 - 2) * 1.1, ax: sz.x * (0.14 + 0.025 * i), az: sz.z * (0.17 + 0.02 * ((i * 3) % 4)), w1: 0.021 + 0.0035 * i, w2: 0.026 - 0.002 * i, p1: i * 1.7, p2: i * 2.3 + 0.6, y: top + 0.07 }));

  // --- tōrō nagashi
  const lGeo = lanternGeometry(), lGlow = { value: 0 };
  const lMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, emissive: new THREE.Color('#ff9a4a'), emissiveIntensity: 0, side: THREE.DoubleSide });
  lMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.5, 0.8, vColor.g);'); };   // only the paper
  lMat.customProgramCacheKey = () => 'tokyo-toro';
  const lan = new THREE.InstancedMesh(lGeo, lMat, LANTERNS); lan.name = 'tokyo-toro-nagashi'; lan.frustumCulled = false; lan.castShadow = false;
  const gMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uK: lGlow },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; varying vec2 vUv; void main() { float d = length(vUv * 2.0 - 1.0); float a = exp(-d * d * 4.5) * (1.0 - smoothstep(0.8, 1.0, d)); gl_FragColor = vec4(vec3(1.0, 0.6, 0.27) * 0.8, a * uK); }',
  });
  const halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), gMat, LANTERNS); halo.name = 'tokyo-toro-glow'; halo.frustumCulled = false; halo.renderOrder = 9;
  const drift = Array.from({ length: LANTERNS }, (_, i) => ({
    cx: box.min.x + sz.x * (0.12 + 0.76 * (((i * 5) % 12) + 0.5) / 12), cz: box.min.z + sz.z * (0.15 + 0.7 * (((i * 7) % 12) + 0.5) / 12),
    ax: 2.5 + (i % 4) * 0.9, az: 1.8 + (i % 3) * 0.8, w1: 0.04 + 0.005 * (i % 5), w2: 0.033 + 0.004 * (i % 4), p1: i * 2.1, p2: i * 1.3,
  }));
  for (const o of [koi, lan, halo]) { o.layers.set(ctx.NO_MIRROR); ctx.scene.add(o); }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), s = new THREE.Vector3(), cam2 = new THREE.Vector3();
  return {
    update(t, camera) {
      time.value = t;
      const far = camera.position.distanceTo(ctr) > 420;
      koi.visible = lan.visible = halo.visible = !far;
      if (far) return;
      course.forEach((c, i) => {
        const x = c.cx + c.ax * Math.sin(c.w1 * t + c.p1), z = c.cz + c.az * Math.sin(c.w2 * t + c.p2);
        const vx = c.ax * c.w1 * Math.cos(c.w1 * t + c.p1), vz = c.az * c.w2 * Math.cos(c.w2 * t + c.p2);
        q.setFromAxisAngle(up, Math.atan2(vx, vz));
        koi.setMatrixAt(i, m.compose(p.set(x, c.y + 0.01 * Math.sin(t * 0.7 + i), z), q, s.set(1.35 + 0.18 * i, 2.0 + 0.2 * i, 1.35 + 0.18 * i)));
      });
      drift.forEach((d, i) => {
        const x = d.cx + d.ax * Math.sin(d.w1 * t + d.p1), z = d.cz + d.az * Math.sin(d.w2 * t + d.p2);
        q.setFromEuler(new THREE.Euler(0.03 * Math.sin(t * 0.6 + i), t * 0.02 + i, 0.03 * Math.cos(t * 0.5 + i * 2)));
        lan.setMatrixAt(i, m.compose(p.set(x, top + 0.005 * Math.sin(t * 0.9 + i * 3), z), q, one));
        halo.setMatrixAt(i, m.compose(p.set(x, top + 0.03, z), new THREE.Quaternion(), one));
      });
      koi.instanceMatrix.needsUpdate = lan.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true;
    },
    setLook(look, params) {
      const night = THREE.MathUtils.smoothstep(look.dn, 0.3, 0.75), e = (look.emissive ?? 1) * (params?.emissive ?? 1);
      glow.value = 0.32 * night;
      lMat.emissiveIntensity = (0.05 + 1.9 * night) * e * 0.8;
      lGlow.value = 0.85 * night;
    },
    dispose() { for (const o of [koi, lan, halo]) { ctx.scene.remove(o); o.dispose(); } kGeo.dispose(); lGeo.dispose(); kMat.dispose(); lMat.dispose(); gMat.dispose(); halo.geometry.dispose(); },
  };
}
