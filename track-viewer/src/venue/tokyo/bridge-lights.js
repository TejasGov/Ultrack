// The suspension bridge at night, Rainbow-Bridge restraint: pale LED dots strung along the main cables, warm-white architectural
// uplight on the towers (vertical light columns from the deck that merge as they rise, the flat flood light under them held down),
// and the deck-edge line and uplight lenses in pale white instead of orange and red. The red glow stays only on the tower tops
// (M_NightBridgeRed, night-only via tracks.js dayNight); by day the bridge is white with no red light at all.
//   cables: the highest vertex of the suspension meshes at each 1.5 m station along the bridge axis, per side, smoothed
//   towers: an additive/multiply pass over the tower geometry itself (same vertices, pulled forward by a polygon offset: the
//   materials job's shader on the towers does not land on exactly the same depth), one draw. The towers sat
//   inside 'V5 local illuminated humidity' boxes, a Blender haze volume that exported as opaque emissive boxes: the flat cream
//   slabs were those, hiding the towers. They are hidden while Tokyo is loaded.
import * as THREE from 'three';
import { Glows } from '../../glow.js';

const SUSPENSION = /^Suspension_system/;
const CABLE_MATS = /^(Anodized graphite|V5 satin bridge rail)$/;
const TOWER_MAT = 'V5 pearl concrete | weathered bridge';
const HAZE_BOX = 'V5 local illuminated humidity';
const RED = 'M_NightBridgeRed', RED_FROM = 13;      // the red glow shell wraps the whole tower: keep it to the top RED_FROM m
const PALE = { 'V5 warm deck edge': '#ffe6cc', 'V5 red uplight lens': '#fff1e0' };     // emissive colour while Tokyo is loaded
const DOT = new THREE.Color('#eef5ff'), DOT_STEP = 2.6;

/** Main-cable polylines: stations along the bridge's principal axis, the top-most suspension vertex on each side. */
function cables(root) {
  const pts = [], v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || !SUSPENSION.test(o.name) || !CABLE_MATS.test(o.material.name)) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
  });
  if (pts.length < 100) return [];
  // principal axis in xz
  let mx = 0, mz = 0; for (const p of pts) { mx += p.x; mz += p.z; } mx /= pts.length; mz /= pts.length;
  let sxx = 0, sxz = 0, szz = 0; for (const p of pts) { const dx = p.x - mx, dz = p.z - mz; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ax = new THREE.Vector2(Math.cos(ang), Math.sin(ang)), lat = new THREE.Vector2(-ax.y, ax.x);
  const minY = Math.min(...pts.map((p) => p.y));
  const STEP = 1.5, sides = [new Map(), new Map()];
  for (const p of pts) {
    const s = (p.x - mx) * ax.x + (p.z - mz) * ax.y, l = (p.x - mx) * lat.x + (p.z - mz) * lat.y;
    const side = sides[l < 0 ? 0 : 1], k = Math.round(s / STEP), cur = side.get(k);
    if (!cur || p.y > cur.y) side.set(k, p);
  }
  const lines = [];
  for (const side of sides) {
    const keys = [...side.keys()].sort((a, b) => a - b);
    let run = [];
    const flush = () => { if (run.length > 12) lines.push(run); run = []; };
    for (let i = 0; i < keys.length; i++) {
      const p = side.get(keys[i]);
      if (p.y < minY + 4 || (i && keys[i] - keys[i - 1] > 3)) { flush(); if (p.y < minY + 4) continue; }
      run.push(p);
    }
    flush();
  }
  // a 5-tap median on height drops clamps and hanger tops that poke above the cable
  return lines.map((l) => l.map((p, i) => { const ys = l.slice(Math.max(0, i - 2), i + 3).map((q) => q.y).sort((a, b) => a - b); return new THREE.Vector3(p.x, ys[ys.length >> 1], p.z); }));
}

const WASH_VS = /* glsl */`
  varying vec3 vW, vN; varying float vDepth;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize((vec4(normalMatrix * normal, 0.0) * viewMatrix).xyz);     // view -> world (the view matrix is a rotation)
    vec4 mv = viewMatrix * wp; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
// out = light + scene * hold: light = uplight columns from the deck, hold < 1 dims the flat flood light on the upper tower
const WASH_FS = /* glsl */`
  uniform float uDeck, uTop, uK, uFogD; uniform vec3 uColor;
  varying vec3 vW, vN; varying float vDepth;
  void main() {
    float h = clamp((vW.y - uDeck) / (uTop - uDeck), 0.0, 1.0);
    vec2 tan2 = normalize(vec2(-vN.z, vN.x) + vec2(1e-5));
    float u = dot(vW.xz, tan2) / 4.2;                                           // a fixture every 4.2 m along each face
    float cols = mix(pow(0.5 + 0.5 * cos(6.2832 * u), 3.0), 0.55, smoothstep(0.05, 0.6, h));   // columns that merge as they rise
    float face = vN.y < -0.5 ? 1.25 : vN.y > 0.5 ? 0.3 : 1.0;                    // soffits catch the uplight, tops hardly
    float up = exp(-h * 2.6) * (0.25 + 0.75 * cols) * face;
    float crown = smoothstep(0.82, 1.0, h) * 0.35;                              // a soft wash under the red top
    float fog = exp(-uFogD * uFogD * vDepth * vDepth);
    gl_FragColor = vec4(uColor * (up + crown) * uK * fog, mix(1.0, mix(0.85, 0.5, h), uK));
  }`;

export async function create({ scene, root, renderer }) {
  root.updateMatrixWorld(true);
  // ---- cable dots
  const glows = new Glows();
  let dots = 0;
  for (const line of cables(root)) {
    let acc = DOT_STEP;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i], d = a.distanceTo(b);
      for (acc += d; acc >= DOT_STEP; acc -= DOT_STEP) {
        const p = b.clone().lerp(a, (acc - DOT_STEP) / d);
        glows.add([p.x, p.y + 0.15, p.z], DOT.clone().multiplyScalar(0.55), 0.32); dots++;
      }
    }
  }
  const points = dots ? glows.build() : null;
  if (points) { points.name = 'tokyo_bridge_cable_dots'; scene.add(points); }
  // ---- tower wash
  const towers = [];
  root.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && o.material.name === TOWER_MAT) towers.push(o); });
  const box = new THREE.Box3(); towers.forEach((o) => box.expandByObject(o));
  const uniforms = { uDeck: { value: box.min.y + 1 }, uTop: { value: box.max.y }, uK: { value: 0 }, uFogD: { value: 0 }, uColor: { value: new THREE.Color('#ffe4c8').multiplyScalar(2.4) } };
  const washMat = new THREE.ShaderMaterial({ uniforms, vertexShader: WASH_VS, fragmentShader: WASH_FS, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const washes = towers.map((o) => {
    const m = new THREE.Mesh(o.geometry, washMat);
    m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); m.matrixWorld.copy(o.matrixWorld);
    m.renderOrder = 2; m.castShadow = false; m.name = 'tokyo_bridge_tower_wash';
    scene.add(m);
    return m;
  });
  // ---- the haze boxes off
  const hidden = [];
  // on no layer at all, so the distance culler (which sets .visible) cannot bring them back
  root.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && o.material.name === HAZE_BOX) { hidden.push({ o, mask: o.layers.mask }); o.layers.disableAll(); } });
  // ---- the red glow to the tower tops only (it fades in over the last RED_FROM m; the material is night-only, tracks.js dayNight)
  const reds = [];
  root.traverse((o) => {
    const m = o.isMesh && !Array.isArray(o.material) && o.material.name === RED ? o.material : null;
    if (!m || reds.some((r) => r.m === m)) return;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
    m.onBeforeCompile = function (sh, r) {
      prev?.call(this, sh, r);
      sh.uniforms.uRedFrom = { value: uniforms.uTop.value - RED_FROM };
      sh.vertexShader = 'varying float vRedY;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vRedY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = 'varying float vRedY; uniform float uRedFrom;\n' + sh.fragmentShader.replace('#include <opaque_fragment>',
        `diffuseColor.a *= smoothstep(uRedFrom, uRedFrom + ${(RED_FROM * 0.6).toFixed(1)}, vRedY);\n#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|red-top'; };
    m.needsUpdate = true;
    reds.push({ m, prev, prevKey });
  });
  // ---- pale deck edge and lenses
  const recol = [];
  root.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && PALE[o.material.name] && !recol.some((r) => r.m === o.material)) recol.push({ m: o.material, was: o.material.emissive.clone() }); });
  recol.forEach((r) => r.m.emissive.set(PALE[r.m.name]));
  console.info(`tokyo bridge lights: ${dots} cable dots, ${washes.length} tower wash meshes (deck ${uniforms.uDeck.value.toFixed(1)} m, top ${uniforms.uTop.value.toFixed(1)} m), ${recol.length} emissives paled, ${hidden.length} haze boxes hidden`);
  let gain = 0;
  return {
    setLook(look) {
      const dn = look.dn ?? 1;
      gain = THREE.MathUtils.smoothstep(dn, 0.4, 1);
      uniforms.uK.value = gain;
      washes.forEach((m) => { m.visible = gain > 0.001; });
      if (points) points.visible = gain > 0.001;
    },
    update(t, camera) {
      uniforms.uFogD.value = scene.fog?.density ?? 0;
      if (points?.visible) glows.update(t, camera, renderer.getContext().drawingBufferHeight, scene.fog, gain);
    },
    dispose() {
      if (points) { scene.remove(points); points.geometry.dispose(); points.material.dispose(); }
      washes.forEach((m) => scene.remove(m)); washMat.dispose();
      recol.forEach((r) => r.m.emissive.copy(r.was));
      hidden.forEach((h) => { h.o.layers.mask = h.mask; });
      reds.forEach((r) => { r.m.onBeforeCompile = r.prev; r.m.customProgramCacheKey = r.prevKey; r.m.needsUpdate = true; });
    },
  };
}
