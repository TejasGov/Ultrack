// Falling sakura petals: one THREE.Points (one draw call, <= 6144 points) around the sakura trees beside the circuit. The trees are the instanced meshes
// that use the `V3 petal*` materials in the venue GLB (tree_sakura0 / tree_sakura1); each gets a share of the points, spawned inside its canopy. All the motion
// is in the vertex shader (a fall, a slow sway and a drift, looped per petal with a fade at both ends, so nothing pops); the CPU only sets the time.
// Petals are tiny and they would shimmer at distance, so their alpha fades with their projected size and with distance (gone by ~140 m).
import * as THREE from 'three';

const MAX_POINTS = 6144, PER_TREE = 52, NEAR_ROAD = 95;      // m: only trees this close to the centerline get petals

const VS = /* glsl */`
  attribute vec4 aSeed;      // random 0..1 (phase, hue, spin, size)
  attribute vec3 aFall;      // x: fall height in m (canopy to ground), y: fall speed m/s, z: sway amplitude m
  uniform float uTime, uScale, uWind;
  varying float vAlpha; varying float vSpin; varying float vFlip; varying float vHue; varying float vDepth;
  void main() {
    float T = aFall.x / aFall.y;
    float ph = fract(uTime / T + aSeed.x);
    vec3 p = position;
    float k = 6.2831853;
    p.y -= ph * aFall.x;
    // a slow sway that widens as the petal falls, plus the breeze
    p.x += sin(ph * k * 1.7 + aSeed.y * k) * aFall.z * (0.35 + ph) + uWind * ph * aFall.x * 0.28;
    p.z += cos(ph * k * 1.3 + aSeed.z * k) * aFall.z * (0.35 + ph) + uWind * 0.35 * ph * aFall.x * 0.28;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    float px = (0.26 + 0.2 * aSeed.w) * uScale / max(dist, 0.1);
    gl_PointSize = clamp(px, 1.0, 48.0);
    vAlpha = smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.82, 1.0, ph))            // born and gone softly
           * (1.0 - smoothstep(55.0, 140.0, dist)) * smoothstep(0.6, 2.5, dist)       // distance
           * smoothstep(1.4, 3.6, px);                                              // and never a sub-pixel speck
    vSpin = aSeed.z * k + uTime * (0.35 + 0.5 * aSeed.w); vFlip = 0.55 + 0.45 * abs(cos(uTime * (0.25 + 0.2 * aSeed.y) + aSeed.x * k)); vHue = aSeed.y; vDepth = dist;
    gl_Position = projectionMatrix * mv;
  }`;

const FS = /* glsl */`
  uniform vec3 uLight; uniform float uOpacity;
  varying float vAlpha; varying float vSpin; varying float vFlip; varying float vHue; varying float vDepth;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float c = cos(vSpin), s = sin(vSpin);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    p.y /= vFlip;                                                     // the petal turns over as it falls
    // a petal: a rounded teardrop with a small notch at the tip
    float d = length(p * vec2(1.0, 0.7)) - 0.62 + 0.18 * p.x * p.x;
    float notch = smoothstep(0.16, 0.0, length(p - vec2(0.0, 0.62)));
    float a = (1.0 - smoothstep(-0.05, 0.12, d)) * (1.0 - 0.6 * notch);
    if (a < 0.01) discard;
    vec3 col = mix(vec3(1.0, 0.8, 0.88), vec3(0.99, 0.66, 0.78), vHue);
    col *= mix(1.0, 0.82, smoothstep(-0.4, 0.8, p.y));                  // a little shading along the petal
    gl_FragColor = vec4(col * uLight, a * vAlpha * uOpacity);
  }`;

export async function create(ctx) {
  // the trees: every instance of a mesh that uses a `V3 petal*` material (the LOD copies share the transforms: de-duplicated on a 1 m grid)
  const trees = new Map(), m = new THREE.Matrix4(), c = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), box = new THREE.Box3();
  ctx.root.updateWorldMatrix(true, true);
  ctx.root.traverse((o) => {
    if (!o.isInstancedMesh || ![].concat(o.material).some((mt) => /^V3 petal/.test(mt.name))) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.copy(o.geometry.boundingBox);
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.premultiply(o.matrixWorld);
      m.decompose(c, q, s);
      const centre = box.getCenter(new THREE.Vector3()).applyMatrix4(m), size = box.getSize(new THREE.Vector3());
      const key = Math.round(c.x) + ',' + Math.round(c.z);
      if (trees.has(key)) continue;
      trees.set(key, { x: centre.x, y: centre.y, z: centre.z, rx: Math.max(1.2, 0.5 * Math.max(size.x, size.z) * Math.max(s.x, s.z)), ry: Math.max(1, 0.5 * size.y * s.y), ground: c.y });
    }
  });
  if (!trees.size) return null;
  // only the trees the driver passes: within NEAR_ROAD of the centerline, nearest first
  const C = ctx.track.centerline, near = [];
  for (const t of trees.values()) {
    let d = 1e9; for (let i = 0; i < C.length; i += 2) d = Math.min(d, Math.hypot(C[i][0] - t.x, C[i][2] - t.z));
    if (d < NEAR_ROAD) near.push({ ...t, d });
  }
  near.sort((a, b) => a.d - b.d);
  const trees2 = near.slice(0, Math.floor(MAX_POINTS / PER_TREE)), n = trees2.length * PER_TREE;
  if (!n) return null;

  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), fall = new Float32Array(n * 3);
  let rs = 1337; const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296);       // seeded: the same petals on every load
  let k = 0;
  for (const t of trees2) for (let j = 0; j < PER_TREE; j++, k++) {
    // a point inside the canopy ellipsoid (rejection sample), biased to the lower half where petals let go
    let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
    pos.set([t.x + x * t.rx, t.y + y * t.ry * 0.9 - t.ry * 0.1, t.z + z * t.rx], k * 3);
    seed.set([rnd(), rnd(), rnd(), rnd()], k * 4);
    const fh = Math.max(2.5, t.y + y * t.ry * 0.9 - t.ground + 0.1);
    fall.set([fh, 0.32 + 0.38 * rnd(), 0.5 + 0.9 * rnd()], k * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  geo.setAttribute('aFall', new THREE.BufferAttribute(fall, 3));
  geo.computeBoundingSphere(); geo.boundingSphere.radius += 20;              // they fall and drift beyond their spawn points

  const u = { uTime: { value: 0 }, uScale: { value: 800 }, uWind: { value: 1.1 }, uLight: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 0.9 } };
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u, transparent: true, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.name = 'tokyo-petals'; pts.frustumCulled = true; pts.renderOrder = 8;
  // drawn for the player's camera only: the road mirror, the cars' reflection cubes and the AO/depth passes see another camera or an override material,
  // where a point's pixel size would be wrong (they would be 7x too large in a 128 px cube face)
  pts.onBeforeRender = (renderer, scene, camera) => { geo.setDrawRange(0, camera === ctx.camera && !scene.overrideMaterial ? Infinity : 0); };
  ctx.scene.add(pts);

  const _v = new THREE.Vector2();
  return {
    update(t, camera) {
      u.uTime.value = t;
      u.uScale.value = ctx.renderer.getDrawingBufferSize(_v).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
    // lit by the look: full by day, dimmer in the evening, a pale lamp-lit pink at night
    setLook(look) {
      const k = THREE.MathUtils.lerp(1, 0.95, look.dn);
      u.uLight.value.setRGB(k * (1 + 0.1 * look.dn), k * (1 - 0.04 * look.dn), k * (1 - 0.14 * look.dn));
      u.uOpacity.value = THREE.MathUtils.lerp(0.9, 0.8, look.dn);
    },
    dispose() { ctx.scene.remove(pts); geo.dispose(); mat.dispose(); },
  };
}
