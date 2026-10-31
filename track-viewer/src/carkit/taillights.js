// Realistic tail lamps, opt-in per car (docs/tail-lights.md): a car listed in TAIL_SPECS gets its tail-lamp mesh split into
// the elements a real unit has (light guides lit for the running light, brake fills that light only on the brake, a
// reverse cell, unlit indicator lenses) under a smoked glossy lens, an LED-dot structure that resolves up close and fades
// to its mean before it can shimmer, a tight glow per element (one draw per car) and a red pool on the road behind after
// dark. Levels are set per look (lamps.js passes it): a lamp reads as a near-dark lens by day and a clear red after dark.
// Every other car keeps lamps.js's generic lamp (one emissive for the whole cluster and a halo sprite), unchanged.
import * as THREE from 'three';
import { wetUniforms } from '../wet-road.js';

// rules (first match wins) classify each connected component of the car's tail-material mesh at full detail; LOD 1 (45 m+)
// is one blend. dark: 'keep' lamp materials that are unlit lenses. lens: the rear part (x > minX, car frame: +x is the
// tail) of the model's lamp-lens material becomes the car's smoked rearLens. reverse: triangles of a material inside a box
// (car-frame metres) become the reverse lamp.
export const TAIL_SPECS = {
  // AV-12 (Aventador SVJ): per side three hexagonal cells, each an amber indicator over a red Y light guide and a lower
  // red fill, then an inner red arrow and an aluminium honeycomb cell, read as the reverse lamp (a clear reflector cell)
  av12: {
    tail: [{ minTris: 500, part: 'guide' }, { part: 'fill' }],
    dark: /Orange_Lights/, darkColor: 0x6a2a04,
    lens: { material: /Glass_Lights/, minX: 1.5 },
    reverse: { material: /Aluminum/, box: [[2.13, 0.72, 0.455], [2.18, 0.83, 0.545]] },
    spill: true,
  },
};

// Levels, linear and divided by the look's exposure, as [day, night] mixed by the look's darkness (dn: day 0 .. night 1).
// run: the guides' running light; brake: what the brake adds to them; fill: the brake fills; rev: the reverse cell;
// glow*: the element glows; pool*: the light on the road behind. A spec's `levels` overrides any of them for its car.
const LV = {
  run: [0.1, 0.38], brake: [0.9, 1.05], fill: [1.0, 1.15], rev: [1.2, 1.4],
  glowRun: [0, 0.14], glowBrake: [0.12, 0.55], glowRev: [0.06, 0.3],
  poolRun: [0, 0.03], poolBrake: [0, 0.14], poolRev: [0, 0.22],
  spillRun: 0.6, spillBrake: 6, spillRev: 5,       // cd, the hero's spill light, times dn
};
const RED = new THREE.Color(1, 0.012, 0.002), WHITE = new THREE.Color(0.86, 0.92, 1), _c = new THREE.Color();   // a 625 nm LED; a cool white LED

/** Connected components of a triangle mesh (vertices welded at 1 mm): a component id per triangle and each one's stats. */
export function components(pos, index) {
  const n = pos.count, ids = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;
    if (!ids.has(k)) ids.set(k, ids.size);
    weld[i] = ids.get(k);
  }
  const par = Int32Array.from({ length: ids.size }, (_, i) => i), root = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  const vi = (t) => (index ? index.getX(t) : t), T = (index ? index.count : n) / 3;
  for (let t = 0; t < T; t++) { const a = root(weld[vi(3 * t)]), b = root(weld[vi(3 * t + 1)]), c = root(weld[vi(3 * t + 2)]); par[a] = b; par[root(b)] = root(c); }
  const tri = new Int32Array(T), byRoot = new Map(), list = [], A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  for (let t = 0; t < T; t++) {
    const r = root(weld[vi(3 * t)]);
    if (!byRoot.has(r)) { byRoot.set(r, list.length); list.push({ tris: 0, area: 0, box: new THREE.Box3(), centre: new THREE.Vector3(), normal: new THREE.Vector3() }); }
    const s = list[tri[t] = byRoot.get(r)];
    A.fromBufferAttribute(pos, vi(3 * t)); B.fromBufferAttribute(pos, vi(3 * t + 1)); C.fromBufferAttribute(pos, vi(3 * t + 2));
    N.subVectors(B, A).cross(C.clone().sub(A)); const a = N.length() / 2;
    s.tris++; s.area += a; s.box.expandByPoint(A).expandByPoint(B).expandByPoint(C);
    s.centre.addScaledVector(A.add(B).add(C), a / 3); s.normal.addScaledVector(N, 0.5);
  }
  list.forEach((s) => s.centre.divideScalar(Math.max(s.area, 1e-9)));
  return { tri, list };
}

/** Move the triangles whose centroid passes `pick` (car frame) out of `mesh` into a new mesh wearing `material`. */
function split(mesh, pick, material, name) {
  const g = mesh.geometry, P = g.attributes.position, idx = g.index ? Array.from(g.index.array) : [...Array(P.count).keys()], a = [], b = [], v = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    v.fromBufferAttribute(P, idx[t]).add(new THREE.Vector3().fromBufferAttribute(P, idx[t + 1])).add(new THREE.Vector3().fromBufferAttribute(P, idx[t + 2])).divideScalar(3);
    (pick(v) ? a : b).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  if (!a.length) return null;
  g.setIndex(b);                                  // new arrays: the loaded geometry's index may be shared
  const g2 = new THREE.BufferGeometry();
  for (const k of Object.keys(g.attributes)) g2.setAttribute(k, g.attributes[k]);
  g2.setIndex(a); g2.computeBoundingSphere();
  const m = new THREE.Mesh(g2, material); m.name = name; m.castShadow = false; m.receiveShadow = true; m.renderOrder = mesh.renderOrder;
  mesh.parent.add(m);
  return m;
}

/** The tail material's shader: per-vertex element weights (aLamp: guide, fill) drive the emission; fills get LED dots. */
function tailShader(mat, U) {
  mat.color.set(0x4a0306); mat.roughness = 0.32; mat.metalness = 0;     // an unlit red light guide / reflector under the lens
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aLamp;\nvarying vec2 vLamp;\nvarying vec3 vLampP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLamp = aLamp; vLampP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGuide, uFill, uHot, uPitch;\nvarying vec2 vLamp;\nvarying vec3 vLampP;')
      .replace('#include <emissivemap_fragment>', `
        float rim = 1.0 - abs( dot( normal, normalize( vViewPosition ) ) );      // a light guide glows brightest along its edges
        vec2 q = vLampP.yz / uPitch, cell = fract( q ) - 0.5;                    // the LED grid on the lamp's rear-facing plane
        float led = smoothstep( 0.3, 0.1, length( cell ) );
        float pat = mix( 0.5 + 1.9 * led, 0.75, smoothstep( 0.25, 0.7, length( fwidth( q ) ) ) );   // dots on a lit diffuser up close, their mean once a pitch nears a pixel
        float lampE = vLamp.x * uGuide * ( 0.75 + 0.6 * rim * rim ) + vLamp.y * uFill * pat;
        totalEmissiveRadiance = mix( vec3( 1.0, 0.012, 0.002 ), vec3( 1.0, 0.05, 0.006 ), uHot * clamp( lampE, 0.0, 1.0 ) ) * lampE;`);
  };
  mat.customProgramCacheKey = () => 'tail-lamp';
  mat.needsUpdate = true;
}

let poolTex;
function poolTexture() {      // the light of two lamps on the road: a lobe behind each, brightest just behind the bumper, a long fade back; +u away from the car
  if (poolTex) return poolTex;
  const n = 64, d = new Uint8Array(n * n * 4), win = (x) => Math.min(1, x / 0.15, (1 - x) / 0.15) ** 2;   // zero at every edge: no visible quad
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, v = (j + 0.5) / n, along = Math.min(1, u / 0.12) * Math.exp(-Math.max(0, u - 0.12) / 0.22);
    const a = along * (Math.exp(-(((v - 0.27) / 0.19) ** 2)) + Math.exp(-(((v - 0.73) / 0.19) ** 2))) * win(u) * win(v);
    d.fill(255, 4 * (j * n + i), 4 * (j * n + i) + 3); d[4 * (j * n + i) + 3] = Math.round(255 * Math.min(1, a));
  }
  poolTex = new THREE.DataTexture(d, n, n); poolTex.magFilter = poolTex.minFilter = THREE.LinearFilter; poolTex.needsUpdate = true;
  return poolTex;
}

/** The element glows: one point per lamp element, sized by it, aimed back, energy kept as it shrinks (as glow.js). */
function glowPoints(items) {
  const g = new THREE.BufferGeometry(), f = (k, n) => new THREE.BufferAttribute(new Float32Array(items.flatMap((it) => it[k])), n);
  g.setAttribute('position', f('p', 3)); g.setAttribute('aDir', f('d', 3)); g.setAttribute('aW', f('w', 3)); g.setAttribute('aSize', f('s', 1));
  const U = { uProj: { value: 800 }, uG: { value: 0 }, uF: { value: 0 }, uR: { value: 0 }, uRed: { value: RED }, uWhite: { value: WHITE }, uFog: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uProj, uG, uF, uR, uFog; uniform vec3 uRed, uWhite;
      attribute vec3 aDir, aW; attribute float aSize; varying vec3 vCol;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vec3 toCam = cameraPosition - wp.xyz; float dist = length( toCam );
        float face = smoothstep( -0.05, 0.5, dot( normalize( mat3( modelMatrix ) * aDir ), toCam / dist ) );   // lamps shine backwards
        wp.xyz += toCam / dist * 0.12;                         // in front of the lens, still hidden by the body from ahead
        vec4 mv = viewMatrix * wp;
        float px = aSize * uProj / max( -mv.z, 0.1 );
        gl_PointSize = clamp( px * 2.0, 2.0, 512.0 );
        float energy = clamp( px * px / 9.0, 0.06, 1.0 );      // under ~3 px it dims instead of popping
        vCol = ( uRed * ( aW.x * uG + aW.y * uF ) + uWhite * aW.z * uR ) * face * energy * exp( -uFog * uFog * dist * dist * 0.6 );
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot( q, q );
        if ( r2 > 1.0 ) discard;
        gl_FragColor = vec4( vCol * ( exp( -r2 * 9.0 ) + 0.12 * exp( -r2 * 3.0 ) ), 1.0 );   // tight to the element, a faint wing
      }`,
  });
  const pts = new THREE.Points(g, mat); pts.name = 'tail_glows'; pts.frustumCulled = false; pts.renderOrder = 5; pts.raycast = () => {};
  const size = new THREE.Vector2();
  pts.onBeforeRender = (renderer, scene, camera) => {
    const rt = renderer.getRenderTarget();         // the composer's buffer, or the half-size wet-road mirror
    U.uProj.value = (rt ? rt.height : renderer.getDrawingBufferSize(size).y) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov ?? 50) / 2));
    U.uFog.value = scene.fog?.density ?? 0;
  };
  return { pts, U };
}

/** Fit one LOD level of a spec car (the far level loads later, so this runs whenever a new level appears). */
function fitLevel(c, spec, T, level, full) {
  const m = c.materials, meshes = [];
  level.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const name = o.material.name ?? '';
    if (o.material === m.taillight) {
      const g = o.geometry, P = g.attributes.position, w = new Float32Array(P.count * 2);
      if (full) {
        const { tri, list } = components(P, g.index), part = list.map((s) => spec.tail.find((r) => s.tris >= (r.minTris ?? 0))?.part);
        tri.forEach((k, t) => { for (let j = 0; j < 3; j++) { const v = g.index ? g.index.getX(3 * t + j) : 3 * t + j; w[2 * v] = part[k] === 'guide' ? 1 : 0; w[2 * v + 1] = part[k] === 'fill' ? 1 : 0; } });
        list.forEach((s, k) => { if (part[k]) T.items.push({ p: s.centre.toArray(), s: Math.max(...s.box.getSize(new THREE.Vector3()).toArray()) * 0.4, d: [1, 0, 0.3 * Math.sign(s.centre.z)], w: part[k] === 'guide' ? [1, 1, 0] : [0, 1, 0] }); });
      } else for (let i = 0; i < P.count; i++) { w[2 * i] = 0.7; w[2 * i + 1] = 0.5; }   // 45 m+: one blend, no structure to show
      g.setAttribute('aLamp', new THREE.BufferAttribute(w, 2));
    } else if (spec.dark?.test(name)) {
      o.material.emissive?.setScalar(0); o.material.color.set(spec.darkColor ?? 0x502008); o.material.roughness = 0.3;   // an unlit indicator lens
    } else if (spec.lens?.material.test(name)) {
      split(o, (v) => v.x > spec.lens.minX, m.rearLens, 'rear-lens');
    } else if (full && spec.reverse?.material.test(name)) {
      const box = new THREE.Box3(new THREE.Vector3(...spec.reverse.box[0]), new THREE.Vector3(...spec.reverse.box[1]));
      T.rev ??= reverseMaterial(o.material);
      const r = split(o, (v) => box.containsPoint(new THREE.Vector3(v.x, v.y, Math.abs(v.z))), T.rev, 'reverse-lamp');
      if (r) for (const s of [-1, 1]) T.items.push({ p: [box.max.x, (box.min.y + box.max.y) / 2, s * (box.min.z + box.max.z) / 2], s: (box.max.z - box.min.z) * 0.6, d: [1, 0, 0], w: [0, 0, 1] });
    }
  }
  level.userData.tailFit = true;
}

/** The reverse cell: its own copy of the reflector material, lit white, brightest where a facet faces the viewer. */
function reverseMaterial(src) {
  const mat = src.clone();
  mat.emissive = WHITE.clone(); mat.emissiveIntensity = 0;
  mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.3 + 0.7 * pow( abs( dot( normal, normalize( vViewPosition ) ) ), 4.0 );'); };
  mat.customProgramCacheKey = () => 'reverse-lamp';
  return mat;
}

/** Build a spec car's tail lamps: materials, the lens, the reverse cell, the glows and the pool. Returns the per-car state. */
export function fitTail(c, spec) {
  const m = c.materials, T = { spec, L: { ...LV, ...spec.levels }, items: [], U: { uGuide: { value: 0 }, uFill: { value: 0 }, uHot: { value: 0 }, uPitch: { value: 0.0075 } } };
  tailShader(m.taillight, T.U);
  Object.assign(m.rearLens, { opacity: 0.4, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false });
  m.rearLens.color.set(0x2a0d0e);                 // smoked: the elements read through it, the sun and sky reflect off it
  m.rearLens.side = THREE.DoubleSide;
  fitLevel(c, spec, T, c.lod.levels[0].object, true);
  const { pts, U } = glowPoints(T.items);
  pts.position.copy(c.lod.position); c.body.add(pts); T.glow = U;
  // the pool rides the contact shadow (flat on the road under a leaning body; car-lab frame turned: the tail is -x here)
  const tail = Math.max(...T.items.map((it) => it.p[0])), pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  pool.geometry.rotateY(Math.PI);                 // +u (the lamps' side of the texture) toward the car
  pool.position.set(-tail - 1.5 - c.shadow.position.x, 0.003, 0); pool.name = 'tail_pool'; pool.renderOrder = 2; pool.raycast = () => {};
  pool.layers.set(2);                              // main.js NO_MIRROR: a pool on the mirror plane would double in the wet-road reflection
  c.shadow.add(pool); T.pool = pool;
  // the player's car only: one wide spot just behind the body, aimed back and down (a lamp lights nothing ahead of its
  // lens: a point light reddened the deck above the lamps, and one inside the tail lit the bodywork around it), for the
  // road (a streak on a wet one), the diffuser tips and a car close behind; always present (black when off), so the light
  // count and the compiled shaders never change
  if (spec.spill && c.hero) {
    const box = new THREE.Box3();                  // the body's own frame (the level's meshes carry baked positions)
    c.lod.levels[0].object.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); } });
    const back = box.max.x + 0.05;
    T.spill = new THREE.SpotLight(0x000000, 1, 5, THREE.MathUtils.degToRad(78), 0.6, 2); T.spill.name = 'tail_spill';
    T.spill.position.set(back, 0.6, 0).add(c.lod.position); T.spill.target.position.set(back + 3, 0, 0).add(c.lod.position);
    c.body.add(T.spill, T.spill.target);
  }
  return T;
}

/** Per frame: b = brake level (0..1, ramped), r = reverse level, look = the look (dn, exposure; missing: a lit room). */
export function driveTail(c, b, r, look) {
  const T = c.tail, L = T.L, dn = look?.dn ?? 0.35, k = 1 / (look?.exposure ?? 1), at = (p) => (p[0] + (p[1] - p[0]) * dn) * k;
  c.lod.levels.forEach((l, i) => { if (!l.object.userData.tailFit) fitLevel(c, T.spec, T, l.object, i === 0); });
  T.U.uGuide.value = at(L.run) + b * at(L.brake);
  T.U.uFill.value = b * at(L.fill);
  T.U.uHot.value = b;
  if (T.rev) T.rev.emissiveIntensity = r * at(L.rev);
  T.glow.uG.value = at(L.glowRun) + b * at(L.glowBrake); T.glow.uF.value = b * at(L.glowBrake) * 0.6; T.glow.uR.value = r * at(L.glowRev);
  const wet = (1 - 0.5 * wetUniforms.uWet.value) * (T.spill ? 0.5 : 1);   // a wet road mirrors the lamps (the planar mirror) more than it scatters them; the spill light lights the road too
  T.pool.material.color.copy(RED).multiplyScalar((at(L.poolRun) + b * at(L.poolBrake)) * wet).add(_c.copy(WHITE).multiplyScalar(r * at(L.poolRev) * wet));
  T.pool.visible = T.pool.material.color.r > 0.002;
  // the spill light is physical (candela, under the look's exposure like every other light): only after dark
  if (T.spill) T.spill.color.copy(RED).multiplyScalar((L.spillRun + b * L.spillBrake) * dn).add(_c.copy(WHITE).multiplyScalar(r * L.spillRev * dn));
}
