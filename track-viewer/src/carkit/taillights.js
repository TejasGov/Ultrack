// Realistic tail lamps, opt-in per car (docs/tail-lights.md): a car with a spec file (src/carkit/tails/<key>.js, collected by
// lamps.js) gets its tail-lamp mesh split into the elements a real unit has (light guides lit for the running light, brake
// fills that light only on the brake, a reverse cell, unlit indicator lenses) under a smoked glossy lens, an LED-dot structure
// that resolves up close and fades to its mean before it can shimmer, a tight glow per element (one draw per car) and a red
// pool on the road behind after dark. Levels are set per look (lamps.js passes it): a lamp reads as a near-dark lens by day
// and a clear red after dark. Every other car keeps lamps.js's generic lamp (one emissive for the whole cluster and a halo
// sprite), unchanged.
//
// A spec (car frame: +x is the tail, y up, z to the side; boxes use |z|, so one box covers both sides; every key optional):
//   tail: [{ material, box, minTris, facing, part, glow, glowAlong, tex, flip }]  rules over the connected components of the
//         car's tail meshes (role `tail`, adopted ones and the car-lab LED tubes), first match wins; a rule matches when every key
//         it has does: material (the model's own material name, a RegExp), box (the component's centre), minTris, facing ([[x, y,
//         z], min]: per triangle, its normal . axis >= min, z mirrored like the boxes: a blade's rear edge). part: guide (running
//         light, brighter on the brake), fill (brake only), off (never lit), reverse (white, reversing), indicator (an unlit amber
//         lens), lens (onto the smoked rearLens). glow: the element glow's size factor (0: none); glowAlong: a long or curved
//         element glows along its length (points every ~5 cm) instead of at its centroid; tex: false lights it whatever its texels
//         (a `tex` car's element painted unlit); flip: an element modelled facing forward is turned to face back. Default: every
//         component a guide.
//   adopt: { material, minX, box }   model ('keep') materials whose triangles behind minX (inside the box) join the tail lamp,
//         keeping their own map
//   tex: { material, lo, hi, hue, white, base, map }   tail meshes whose model material has a map keep it: its red texels light
//         (by brightness, lo..hi), white ones are the reverse lamp (white: [lo, hi], off by default), amber ones stay unlit (hue:
//         the g/r range where red turns amber; [0.6, 0.9] lets a lit orange-yellow LED core count as lamp); base: the unlit
//         lamp's colour (the map times it); map: 'emissiveMap' to read that instead (texLamp is the same test in JS)
//   dark, darkColor   'keep' lamp materials that are unlit lenses (indicators)
//   lens: { material, minX, color, opacity, shell }   the rear part of the model's lens material becomes the smoked rearLens;
//         shell: a lens this far (m) out over the tail meshes, for a model with no lens of its own
//   reverse: { material, box, minX, color }   triangles of a material (inside the box, behind minX) become the reverse lamp;
//         color: its unlit colour (default: the material it copies, the white headlamp one for a `reverse` part)
//   spill: true   the player's car lights the road behind; levels: { ...LV } per-car levels; qa: { macro: [x, y, z] } the lamp
//         qa-taillights.mjs frames up close (default: the right rear lamp of model.json / the car-lab profile)
// A car-lab car (no model: bentley-gt) has its lamps in c.lamps.root: the LED tubes are its tail meshes, the centre
// stop lamp (role brake) is lit as a fill, the reverse tubes (role reverse) as the reverse lamp, its lens covers become rearLens;
// bowl: true lights a closed rear lamp's bowl (the fan of housing behind its LED ring) as a brake fill.
import * as THREE from 'three';
import { wetUniforms } from '../wet-road.js';

const PARTS = ['guide', 'fill', 'off', 'reverse', 'indicator', 'lens'], GUIDE = [{ part: 'guide' }];
const TEX = { lo: 0.02, hi: 0.4, hue: [0.2, 0.32], white: false, base: 0x8c8c8c };

// Levels, linear and divided by the look's exposure, as [day, night] mixed by the look's darkness (dn: day 0 .. night 1).
// run: the guides' running light; brake: what the brake adds to them; fill: the brake fills; rev: the reverse cell;
// glow*: the element glows; pool*: the light on the road behind. A spec's `levels` overrides any of them for its car.
const LV = {
  run: [0.1, 0.38], brake: [0.9, 1.05], fill: [1.0, 1.15], rev: [1.2, 1.4],
  glowRun: [0, 0.14], glowBrake: [0.12, 0.55], glowRev: [0.06, 0.3],
  poolRun: [0, 0.03], poolBrake: [0, 0.14], poolRev: [0, 0.22],
  spillRun: 0.6, spillBrake: 6, spillRev: 5,       // cd, the hero's spill light, times dn
};
const at = (p, dn, k) => (p[0] + (p[1] - p[0]) * dn) * k;   // a [day, night] level at darkness dn, over the exposure (no closure per frame)
const RED = new THREE.Color(1, 0.012, 0.002), WHITE = new THREE.Color(0.86, 0.92, 1), _c = new THREE.Color();   // a 625 nm LED; a cool white LED

/** A spec's mistakes (unknown keys, parts, malformed boxes and regexes), as messages; none: []. */
export function checkSpec(spec) {
  const bad = [], keys = (o, ok, at) => Object.keys(o ?? {}).forEach((k) => { if (!ok.includes(k)) bad.push(`${at}${k}: unknown key`); });
  const re = (x, at) => { if (x !== undefined && !(x instanceof RegExp)) bad.push(`${at}: not a RegExp`); };
  const box = (b, at) => { if (b !== undefined && !(b.length === 2 && b.every((p) => p.length === 3 && p.every(Number.isFinite)))) bad.push(`${at}: not [[x, y, z], [x, y, z]]`); };
  keys(spec, ['tail', 'adopt', 'tex', 'dark', 'darkColor', 'lens', 'reverse', 'spill', 'bowl', 'levels', 'qa'], '');
  (spec.tail ?? []).forEach((r, i) => {
    keys(r, ['material', 'box', 'minTris', 'facing', 'part', 'glow', 'glowAlong', 'tex', 'flip'], `tail[${i}].`); if (!PARTS.includes(r.part)) bad.push(`tail[${i}].part: ${r.part}`); re(r.material, `tail[${i}].material`); box(r.box, `tail[${i}].box`);
    if (r.facing !== undefined && !(r.facing.length === 2 && r.facing[0]?.length === 3 && [...r.facing[0], r.facing[1]].every(Number.isFinite))) bad.push(`tail[${i}].facing: not [[x, y, z], min]`);
    if (r.tex !== undefined && r.tex !== false) bad.push(`tail[${i}].tex: only false`);
  });
  keys(spec.adopt, ['material', 'minX', 'box'], 'adopt.'); keys(spec.tex, ['material', 'lo', 'hi', 'hue', 'white', 'base', 'map'], 'tex.');
  keys(spec.lens, ['material', 'minX', 'color', 'opacity', 'shell'], 'lens.'); keys(spec.reverse, ['material', 'box', 'minX', 'color'], 'reverse.'); keys(spec.levels, Object.keys(LV), 'levels.');
  if (spec.adopt && !(spec.adopt.material instanceof RegExp)) bad.push('adopt.material: not a RegExp');
  if (spec.reverse && !(spec.reverse.material instanceof RegExp) && (spec.reverse.material !== undefined || spec.reverse.color === undefined)) bad.push('reverse.material: not a RegExp');   // { color } alone styles a `reverse` part
  re(spec.dark, 'dark'); re(spec.tex?.material, 'tex.material'); re(spec.lens?.material, 'lens.material'); box(spec.reverse?.box, 'reverse.box'); box(spec.adopt?.box, 'adopt.box');
  return bad;
}

/** What a lamp texture's texel is (linear rgb 0..1), the `tex` test of the tail shader below (keep the two in step):
 * lamp: red (not amber, not pink-white), weighted by brightness lo..hi; white: unsaturated and bright (the reverse lamp). */
export function texLamp(r, g, b, tex = {}) {
  const t = { ...TEX, ...tex }, w = t.white || [2, 3], ss = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  const mx = Math.max(r, g, b), sat = (mx - Math.min(r, g, b)) / Math.max(mx, 1e-4), hue = g / Math.max(r, 1e-4);
  return { lamp: ss(0.35, 0.6, sat) * (1 - ss(t.hue[0], t.hue[1], hue)) * (r >= Math.max(g, b) ? 1 : 0) * ss(t.lo, t.hi, mx), white: (1 - ss(0.12, 0.25, sat)) * ss(w[0], w[1], mx) };
}

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

const inBox = (b, p) => p.x >= b[0][0] && p.x <= b[1][0] && p.y >= b[0][1] && p.y <= b[1][1] && Math.abs(p.z) >= b[0][2] && Math.abs(p.z) <= b[1][2];
/** The first rule of a spec's `tail` that matches a component (stats from components()) of a mesh whose model material is `name`;
 * n: a triangle's unit normal with z mirrored to the +z side (a `facing` rule matches only per triangle, never without it). */
export function tailRule(spec, s, name, n) {
  return (spec.tail ?? GUIDE).find((r) => s.tris >= (r.minTris ?? 0) && (!r.material || r.material.test(name)) && (!r.box || inBox(r.box, s.centre))
    && (!r.facing || (n && n.x * r.facing[0][0] + n.y * r.facing[0][1] + n.z * r.facing[0][2] >= r.facing[1])));
}

/** Move the triangles that pass `pick(centroid, first vertex index)` (car frame) out of `mesh` into a new mesh wearing `material`. */
function split(mesh, pick, material, name) {
  const g = mesh.geometry, P = g.attributes.position, idx = g.index ? Array.from(g.index.array) : [...Array(P.count).keys()], a = [], b = [], v = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    v.fromBufferAttribute(P, idx[t]).add(new THREE.Vector3().fromBufferAttribute(P, idx[t + 1])).add(new THREE.Vector3().fromBufferAttribute(P, idx[t + 2])).divideScalar(3);
    (pick(v, idx[t]) ? a : b).push(idx[t], idx[t + 1], idx[t + 2]);
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

/** A lens `d` metres out over a mesh along its normals (a model with no lens of its own): the smoked rearLens over the elements. */
function shell(mesh, d, material) {
  const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, p = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) for (let k = 0; k < 3; k++) p[3 * i + k] = P.getComponent(i, k) + N.getComponent(i, k) * d;
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(p, 3)); g2.setAttribute('normal', N); g2.setIndex(g.index); g2.computeBoundingSphere();
  const m = new THREE.Mesh(g2, material); m.name = 'tail-lens-shell'; m.castShadow = false; m.renderOrder = 3; mesh.parent.add(m);
}

/** The tail material's shader: per-vertex element weights (aLamp: guide, fill) drive the emission; fills get LED dots. With a map
 * (a `tex` car) the map's red texels weight the elements by brightness and its white texels light with the reverse. */
function tailShader(mat, U, base = 0x4a0306) {
  mat.color.set(base); mat.roughness = 0.32; mat.metalness = 0;     // an unlit red light guide / reflector under the lens
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aLamp;\nvarying vec2 vLamp;\nvarying vec3 vLampP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLamp = aLamp; vLampP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGuide, uFill, uHot, uPitch, uTexRev;\nuniform vec4 uTex;\nuniform vec2 uTexHue;\nvarying vec2 vLamp;\nvarying vec3 vLampP;')
      .replace('#include <emissivemap_fragment>', `
        float rim = 1.0 - abs( dot( normal, normalize( vViewPosition ) ) );      // a light guide glows brightest along its edges
        vec2 q = vLampP.yz / uPitch, cell = fract( q ) - 0.5;                    // the LED grid on the lamp's rear-facing plane
        float led = smoothstep( 0.3, 0.1, length( cell ) );
        float pat = mix( 0.5 + 1.9 * led, 0.75, smoothstep( 0.25, 0.7, length( fwidth( q ) ) ) );   // dots on a lit diffuser up close, their mean once a pitch nears a pixel
        vec2 lampX = step( 1.5, vLamp ), lampW = vLamp - lampX;                 // aLamp + 1: a tex: false element, lit whatever its texels
        #ifdef USE_MAP
          vec3 lt = texture2D( map, vMapUv ).rgb;                                // texLamp() in JS: red texels are the lamp (by brightness), white ones the reverse
          float lmx = max( lt.r, max( lt.g, lt.b ) ), lsat = ( lmx - min( lt.r, min( lt.g, lt.b ) ) ) / max( lmx, 1e-4 ), lhue = lt.g / max( lt.r, 1e-4 );
          lampW *= mix( vec2( smoothstep( 0.35, 0.6, lsat ) * ( 1.0 - smoothstep( uTexHue.x, uTexHue.y, lhue ) ) * step( max( lt.g, lt.b ), lt.r ) * smoothstep( uTex.x, uTex.y, lmx ) ), vec2( 1.0 ), lampX );
        #endif
        float lampE = lampW.x * uGuide * ( 0.75 + 0.6 * rim * rim ) + lampW.y * uFill * pat;
        totalEmissiveRadiance = mix( vec3( 1.0, 0.012, 0.002 ), vec3( 1.0, 0.05, 0.006 ), uHot * clamp( lampE, 0.0, 1.0 ) ) * lampE;
        #ifdef USE_MAP
          totalEmissiveRadiance += vec3( 0.86, 0.92, 1.0 ) * ( 1.0 - smoothstep( 0.12, 0.25, lsat ) ) * smoothstep( uTex.z, uTex.w, lmx ) * uTexRev;
        #endif`);
  };
  mat.customProgramCacheKey = () => 'tail-lamp';
  mat.needsUpdate = true;
}

/** A tail material wearing a model material's map (a `tex` car), one per model material, sharing the car's uniforms. */
function texMaterial(c, T, src) {
  if (!T.tex.has(src.name)) {
    const mat = c.materials.taillight.clone(), t = { ...TEX, ...T.spec.tex };
    mat.map = t.map === 'emissiveMap' ? src.emissiveMap : src.map ?? src.emissiveMap;
    tailShader(mat, T.U, t.base);
    T.tex.set(src.name, mat);
  }
  return T.tex.get(src.name);
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
  g.computeBoundingSphere(); g.boundingSphere.radius += 0.5;   // culled with the car (a point moves 0.12 m to the camera; 2 px at 100 m)
  const pts = new THREE.Points(g, mat); pts.name = 'tail_glows'; pts.renderOrder = 5; pts.raycast = () => {};
  const size = new THREE.Vector2();
  pts.onBeforeRender = (renderer, scene, camera) => {
    const rt = renderer.getRenderTarget();         // the composer's buffer, or the half-size wet-road mirror
    U.uProj.value = (rt ? rt.height : renderer.getDrawingBufferSize(size).y) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov ?? 50) / 2));
    U.uFog.value = scene.fog?.density ?? 0;
  };
  return { pts, U };
}

/** Fit one LOD level of a spec car (the far level loads later, so this runs whenever a new level appears); kit: car-lab's lamp group. */
function fitLevel(c, spec, T, level, full, kit = false) {
  const m = c.materials, meshes = [], src = (o) => o.srcMaterial ?? o.material, name = (o) => src(o).name ?? '';   // cars.js keeps the model's material before the role swap
  level.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of [...meshes]) {                  // adopted model materials join the tail lamp (behind minX, inside the box), their own material kept as the source
    const A = spec.adopt;
    if (!A || o.material === m.taillight || !A.material.test(name(o))) continue;
    const s = src(o), r = A.minX === undefined && !A.box ? Object.assign(o, { material: m.taillight }) : split(o, (v) => v.x > (A.minX ?? -Infinity) && (!A.box || inBox(A.box, v)), m.taillight, 'tail-adopted');
    if (r) { r.srcMaterial = s; if (r !== o) meshes.push(r); }
  }
  if (kit && spec.bowl) for (const o of meshes) if (isBowl(o, m)) o.material = T.bowl ??= bowlMaterial(m.brakeLight, T.U);   // a closed lamp's bowl fills on the brake
  for (const o of meshes) {
    const nm = name(o);
    if (o.material === m.taillight || o.material === m.brakeLight || o.material === T.bowl) {
      const brake = o.material !== m.taillight, fill = [{ part: 'fill', glow: o.material === T.bowl ? 0 : 1 }];   // a brake-role lamp (car-lab's centre stop) and a bowl are all fill; a bowl's glow would be a blob over the whole lamp
      if (!brake && spec.tail?.some((r) => r.facing) && o.geometry.index) o.geometry = o.geometry.toNonIndexed();   // a facing rule lights part of an element: no vertex shared across its edge
      const g = o.geometry, P = g.attributes.position, w = new Float32Array(P.count * 2), vpart = [], vi = (t, j) => (g.index ? g.index.getX(3 * t + j) : 3 * t + j);
      const { tri, list } = components(P, g.index), rules = list.map((s) => (brake ? fill[0] : tailRule(spec, s, nm)));
      if (o.material === m.brakeLight && !T.brake) { tailShader(m.brakeLight, T.U); T.brake = true; }
      if (rules.some((r) => r?.flip)) flip(g, tri, rules);
      // per triangle: a facing rule picks by the triangle's normal (z mirrored to the +z side), the rest by the element
      const face = !brake && spec.tail?.some((r) => r.facing), tr = new Array(tri.length), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
      tri.forEach((k, t) => {
        let r = rules[k];
        if (face) {
          A.fromBufferAttribute(P, vi(t, 0)); B.fromBufferAttribute(P, vi(t, 1)); C.fromBufferAttribute(P, vi(t, 2));
          const zs = Math.sign(A.z + B.z + C.z) || 1; B.sub(A).cross(C.sub(A)).normalize(); B.z *= zs;
          r = tailRule(spec, list[k], nm, B);
        }
        tr[t] = r;
        const p = r?.part, u = r?.tex === false ? 1 : 0;   // tex: false writes aLamp + 1 (the shader skips the texel weight)
        for (let j = 0; j < 3; j++) {
          const v = vi(t, j);
          vpart[v] = p;
          if (full) { w[2 * v] = p === 'guide' ? 1 + u : 0; w[2 * v + 1] = p === 'fill' ? 1 + u : 0; } else if (p === 'guide' || p === 'fill') { w[2 * v] = 0.7 + u; w[2 * v + 1] = 0.5 + u; }   // 45 m+: one blend, no structure to show
        }
      });
      g.setAttribute('aLamp', new THREE.BufferAttribute(w, 2));
      if (full) glowItems(T, P, vi, tri, tr, list, face);
      if (!brake && spec.tex && src(o) !== o.material && (src(o).map || src(o).emissiveMap) && g.attributes.uv && (!spec.tex.material || spec.tex.material.test(nm))) o.material = texMaterial(c, T, src(o));
      const mats = { reverse: () => (T.rev ??= reverseMaterial(m.reverseLight, spec.reverse?.color)), indicator: () => (T.ind ??= new THREE.MeshStandardMaterial({ color: spec.darkColor ?? 0x502008, roughness: 0.3 })), lens: () => m.rearLens };
      for (const p of Object.keys(mats)) if (tr.some((r) => r?.part === p)) split(o, (v, a) => vpart[a] === p, mats[p](), `tail-${p}`);
      if (spec.lens?.shell) shell(o, spec.lens.shell, m.rearLens);
    } else if (spec.dark?.test(nm)) {
      o.material.emissive?.setScalar(0); o.material.color.set(spec.darkColor ?? 0x502008); o.material.roughness = 0.3;   // an unlit indicator lens
    } else if (spec.lens?.material?.test(nm)) {
      split(o, (v) => v.x > (spec.lens.minX ?? -Infinity), m.rearLens, 'rear-lens');
    } else if (full && spec.reverse?.material?.test(nm)) {
      T.rev ??= reverseMaterial(o.material, spec.reverse.color);
      if (spec.reverse.box) {
        const box = new THREE.Box3(new THREE.Vector3(...spec.reverse.box[0]), new THREE.Vector3(...spec.reverse.box[1]));
        const r = split(o, (v) => v.x > (spec.reverse.minX ?? -Infinity) && box.containsPoint(new THREE.Vector3(v.x, v.y, Math.abs(v.z))), T.rev, 'reverse-lamp');
        if (r) for (const s of [-1, 1]) T.items.push({ p: [box.max.x, (box.min.y + box.max.y) / 2, s * (box.min.z + box.max.z) / 2], s: (box.max.z - box.min.z) * 0.6, d: [1, 0, 0], w: [0, 0, 1] });
      } else reverseItems(T, split(o, (v) => v.x > (spec.reverse.minX ?? -Infinity), T.rev, 'reverse-lamp'));
    } else if (o.material === m.reverseLight) {    // a reverse-role lamp (car-lab's reverse tubes)
      o.material = T.rev ??= reverseMaterial(m.reverseLight);
      if (full) reverseItems(T, o);
    } else if (kit && o.material !== m.rearLens && o.material.transparent && o.material.color?.getHex() === T.lens0[0] && o.material.opacity === T.lens0[1]) {
      o.material = m.rearLens;                     // car-lab's closed lamp covers are clones of its rear lens
    }
  }
  level.userData.tailFit = true;
}

/** A glow point per connected part of a reverse-lamp mesh. */
function reverseItems(T, mesh) {
  if (mesh) for (const s of components(mesh.geometry.attributes.position, mesh.geometry.index).list) T.items.push({ p: s.centre.toArray(), s: Math.max(...s.box.getSize(new THREE.Vector3()).toArray()) * 0.4, d: [1, 0, 0], w: [0, 0, 1] });
}

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
/** The glow points of a fitted tail mesh's lit elements (tr: each triangle's rule): one at an element's centroid, sized by it. Under
 * a facing rule the element is the triangles it lights; with glowAlong (the spec's call: a long or curved element, a ring, an
 * arc; a shape test missed one of the Mustang's mirrored bars (since replaced), whose car-lab tube bulges 5 cm deep, and left a blob beside it)
 * the element glows along its largest side instead: points sized 0.4 x its
 * middle side, 0.6 of that apart (5 cm at most), so their cores join into a line instead of beads, one per strand of each slab
 * (a ring's top and bottom arcs: the surface sampled per step, samples linked across the slab within 1.5 steps). */
function glowItems(T, P, vi, tri, tr, list, face) {
  const byK = list.map(() => new Map()), v = new THREE.Vector3();
  tri.forEach((k, t) => { const r = tr[t]; if (r && (r.glow ?? 1) && ['guide', 'fill', 'reverse'].includes(r.part)) (byK[k].get(r) ?? byK[k].set(r, []).get(r)).push(t); });
  byK.forEach((rules, k) => rules.forEach((ts, r) => {
    const s = face ? subset(P, vi, ts) : list[k], p = r.part, gl = r.glow ?? 1;
    const push = (c, size) => T.items.push({ p: c, s: size, d: p === 'reverse' ? [1, 0, 0] : [1, 0, 0.3 * Math.sign(s.centre.z)], w: p === 'guide' ? [1, 1, 0] : p === 'fill' ? [0, 1, 0] : [0, 0, 1] });
    const size = s.box.getSize(new THREE.Vector3()).toArray(), ax = [0, 1, 2].sort((a, b) => size[b] - size[a]), [a, b] = [size[ax[0]], size[ax[1]]];
    const verts = r.glowAlong ? ts.flatMap((t) => [0, 1, 2].map((j) => v.fromBufferAttribute(P, vi(t, j)).toArray())) : null;
    if (!verts) return push(s.centre.toArray(), a * 0.4 * gl);
    const sz = b * 0.4 * gl, step = THREE.MathUtils.clamp(0.6 * sz, 0.005, 0.05), n = Math.max(1, Math.round(a / step)), slabs = Array.from({ length: n }, () => []);
    for (let i = 0; i < verts.length; i += 3) {                // the surface sampled every `step` (a long strip has few, long triangles)
      const [A, B, C] = verts.slice(i, i + 3), k = Math.max(1, Math.ceil(Math.max(dist(A, B), dist(B, C), dist(C, A)) / step));
      for (let u = 0; u < k; u++) for (let w = 0; w < k - u; w++) {
        const q = [0, 1, 2].map((e) => A[e] + (B[e] - A[e]) * (u + 1 / 3) / k + (C[e] - A[e]) * (w + 1 / 3) / k);
        slabs[Math.min(n - 1, Math.floor((q[ax[0]] - s.box.min.getComponent(ax[0])) / a * n))].push(q);
      }
    }
    for (const sl of slabs) {                                  // strands: samples linked across the slab (both other axes) within 1.5 steps
      const id = sl.map((_, i) => i), root = (x) => { while (id[x] !== x) x = id[x] = id[id[x]]; return x; }, link = Math.max(0.01, 1.5 * step), sum = new Map();
      for (let i = 0; i < sl.length; i++) for (let j = i + 1; j < sl.length; j++) if (Math.hypot(sl[i][ax[1]] - sl[j][ax[1]], sl[i][ax[2]] - sl[j][ax[2]]) <= link) id[root(i)] = root(j);
      sl.forEach((q, i) => { (sum.get(root(i)) ?? sum.set(root(i), []).get(root(i))).push(q); });
      for (const qs of sum.values()) {                         // the strand's mean, snapped to its nearest sample: on the element (a hook's mean is off it)
        const c = [0, 1, 2].map((e) => qs.reduce((x, q) => x + q[e], 0) / qs.length);
        push(qs.reduce((best, q) => (dist(q, c) < dist(best, c) ? q : best)), sz);
      }
    }
  }));
}

/** The box and area-weighted centre of some triangles (vi: triangle, corner -> vertex), as components() gives an element's. */
function subset(P, vi, ts) {
  const s = { box: new THREE.Box3(), centre: new THREE.Vector3() }, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  let area = 0;
  for (const t of ts) {
    A.fromBufferAttribute(P, vi(t, 0)); B.fromBufferAttribute(P, vi(t, 1)); C.fromBufferAttribute(P, vi(t, 2));
    const a = N.subVectors(B, A).cross(C.clone().sub(A)).length() / 2; area += a;
    s.box.expandByPoint(A).expandByPoint(B).expandByPoint(C); s.centre.addScaledVector(A.add(B).add(C), a / 3);
  }
  s.centre.divideScalar(Math.max(area, 1e-9));
  return s;
}

/** Turn the elements whose rule says flip to face back: reversed winding, negated normals (copies: loaded arrays may be shared). */
function flip(g, tri, rules) {
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  const I = g.index.array.slice(), N = g.attributes.normal?.clone(), seen = new Uint8Array(g.attributes.position.count);
  tri.forEach((k, t) => { if (rules[k]?.flip) { [I[3 * t + 1], I[3 * t + 2]] = [I[3 * t + 2], I[3 * t + 1]]; seen[I[3 * t]] = seen[I[3 * t + 1]] = seen[I[3 * t + 2]] = 1; } });
  g.setIndex(new THREE.BufferAttribute(I, 1));
  if (N) { seen.forEach((f, i) => { if (f) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i)); }); g.setAttribute('normal', N); }
}

/** A closed car-lab rear lamp's bowl as cars.js leaves it (merged per material: no name, de-indexed): a fan of lamp-housing
 * triangles, both faces, every triangle starting at the lamp's centre (car-lab lights.js), behind x 1. */
function isBowl(o, m) {
  const P = o.geometry.attributes.position, n = o.geometry.index ? 0 : P.count;
  if (n < 9 || o.material.side !== THREE.DoubleSide || !m.lampHousing || !o.material.color?.equals(m.lampHousing.color) || P.getX(0) < 1) return false;
  for (let i = 3; i < n; i += 3) if (Math.abs(P.getX(i) - P.getX(0)) + Math.abs(P.getY(i) - P.getY(0)) + Math.abs(P.getZ(i) - P.getZ(0)) > 1e-3) return false;
  return true;
}

/** A closed car-lab lamp's bowl (spec.bowl): the stop lamp's material, both faces (car-lab winds the two sides' bowls oppositely). */
function bowlMaterial(src, U) {
  const mat = src.clone(); mat.side = THREE.DoubleSide; tailShader(mat, U);
  return mat;
}

/** The reverse cell: its own copy of the reflector material (unlit in `color` if given), lit white, brightest where a facet faces the viewer. */
function reverseMaterial(src, color) {
  const mat = src.clone();
  if (color !== undefined) mat.color.set(color);
  mat.emissive = WHITE.clone(); mat.emissiveIntensity = 0;
  mat.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= 0.3 + 0.7 * pow( abs( dot( normal, normalize( vViewPosition ) ) ), 4.0 );'); };
  mat.customProgramCacheKey = () => 'reverse-lamp';
  return mat;
}

/** Build a spec car's tail lamps: materials, the lens, the reverse cell, the glows and the pool. Returns the per-car state. */
export function fitTail(c, spec) {
  const bad = checkSpec(spec);
  if (bad.length) console.warn(`tail spec ${c.key}: ${bad.join('; ')}`);
  const m = c.materials, tx = { ...TEX, ...spec.tex }, wt = tx.white || [2, 3];
  const T = { spec, L: { ...LV, ...spec.levels }, items: [], tex: new Map(), lens0: [m.rearLens.color.getHex(), m.rearLens.opacity],
    U: { uGuide: { value: 0 }, uFill: { value: 0 }, uHot: { value: 0 }, uPitch: { value: 0.0075 }, uTex: { value: new THREE.Vector4(tx.lo, tx.hi, wt[0], wt[1]) }, uTexRev: { value: 0 }, uTexHue: { value: new THREE.Vector2(...tx.hue) } } };
  tailShader(m.taillight, T.U);
  Object.assign(m.rearLens, { opacity: spec.lens?.opacity ?? 0.4, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false });
  m.rearLens.color.set(spec.lens?.color ?? 0x2a0d0e);   // smoked: the elements read through it, the sun and sky reflect off it
  // one pass: three.js draws a transparent double-sided material twice and flags it needsUpdate before each draw, a full
  // program lookup per lens per pass every frame (~3 % of the race frame); a lens is a sheet over its elements, so the order
  // of its own faces hardly shows
  Object.assign(m.rearLens, { side: THREE.DoubleSide, forceSinglePass: true });
  fitLevel(c, spec, T, c.lod.levels[0].object, true);
  if (c.lamps?.root) fitLevel(c, spec, T, c.lamps.root, true, true);   // a car-lab car's own lamps (a model's group holds only lights)
  if (!T.items.length) console.warn(`tail spec ${c.key}: no lamp element matched`);
  const { pts, U } = glowPoints(T.items);
  pts.position.copy(c.lod.position); c.body.add(pts); T.glow = U;
  // the pool rides the contact shadow (flat on the road under a leaning body; car-lab frame turned: the tail is -x here)
  const tail = Math.max(1.5, ...T.items.map((it) => it.p[0])), pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTexture(), color: 0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  pool.geometry.rotateY(Math.PI);                 // +u (the lamps' side of the texture) toward the car
  pool.position.set(-tail - 1.5 - c.shadow.position.x, 0.003, 0); pool.name = 'tail_pool'; pool.renderOrder = 2; pool.raycast = () => {};
  pool.layers.set(2);                              // main.js NO_MIRROR: a pool on the mirror plane would double in the wet-road reflection
  c.shadow.add(pool); T.pool = pool;
  // the player's car only: one wide spot just behind the body, aimed back and down (a lamp lights nothing ahead of its
  // lens: a point light reddened the deck above the lamps, and one inside the tail lit the bodywork around it), for the
  // road (a streak on a wet one), the diffuser tips and a car close behind; always present (black when off), so the light
  // count and the compiled shaders never change. Measured in a race (A/B every second, two laps): ~0.5 % of the frame, and
  // its wet streak (a specular reflection broken by the rain ripples) is the approved look a road decal could not match
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
  const T = c.tail, L = T.L, dn = look?.dn ?? 0.35, k = 1 / (look?.exposure ?? 1), lv = c.lod.levels;
  for (let i = 0; i < lv.length; i++) if (!lv[i].object.userData.tailFit) fitLevel(c, T.spec, T, lv[i].object, i === 0);
  T.U.uGuide.value = at(L.run, dn, k) + b * at(L.brake, dn, k);
  T.U.uFill.value = b * at(L.fill, dn, k);
  T.U.uHot.value = b;
  T.U.uTexRev.value = r * at(L.rev, dn, k);
  if (T.rev) T.rev.emissiveIntensity = r * at(L.rev, dn, k);
  T.glow.uG.value = at(L.glowRun, dn, k) + b * at(L.glowBrake, dn, k); T.glow.uF.value = b * at(L.glowBrake, dn, k) * 0.6; T.glow.uR.value = r * at(L.glowRev, dn, k);
  const wet = (1 - 0.5 * wetUniforms.uWet.value) * (T.spill ? 0.5 : 1);   // a wet road mirrors the lamps (the planar mirror) more than it scatters them; the spill light lights the road too
  T.pool.material.color.copy(RED).multiplyScalar((at(L.poolRun, dn, k) + b * at(L.poolBrake, dn, k)) * wet).add(_c.copy(WHITE).multiplyScalar(r * at(L.poolRev, dn, k) * wet));
  T.pool.visible = T.pool.material.color.r > 0.002 && c.band !== 2;   // past FAR_M (60 m) a pool is a pixel row on the road: not drawn
  // the spill light is physical (candela, under the look's exposure like every other light): only after dark
  if (T.spill) T.spill.color.copy(RED).multiplyScalar((L.spillRun + b * L.spillBrake) * dn).add(_c.copy(WHITE).multiplyScalar(r * L.spillRev * dn));
}
