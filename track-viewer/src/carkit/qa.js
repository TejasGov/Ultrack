// Car QA checks (run by sandbox.html; see CAR-QA.md). Each returns { id, title, status: pass|warn|fail, value,
// expect, fix, detail } and may add images to the sheet. Geometry checks use the car's own meshes and raycasts in
// world space, so they also hold with the body pitched on its springs. Image checks render silhouettes and lamp crops.
import * as THREE from 'three';
import { INTERIOR_NAMES } from './interior.js';
import { mirrorGlassMaterial } from './mirrors.js';

const MASK = 384;                 // silhouette render size (px); ~1.3 cm per pixel across a 4.6 m car
const LAYER = 7;                  // scratch layer for "render only these meshes"

export function partsOf(c) {
  const m = c.materials, lodMeshes = [];
  for (const l of c.lod.levels) l.object.traverse((o) => { if (o.isMesh) lodMeshes.push({ mesh: o, level: c.lod.levels.indexOf(l) }); });
  // the shell alone (interior fills are not bodywork: rays and openings must not see them)
  const inner = (o) => INTERIOR_NAMES.includes(o.name) || o.parent?.name === 'interior';
  const body = lodMeshes.filter((e) => e.level === 0 && !inner(e.mesh)).map((e) => e.mesh);
  const all = [], glass = [], wheels = [], tail = [];
  c.root.traverse((o) => {
    if (!o.isMesh || o.name === 'contact-shadow') return;
    all.push(o);
    if (o.material === m.glass) glass.push(o);
    if ([m.taillight, m.brakeLight].includes(o.material)) tail.push(o);
  });
  c.wheelRoot.traverse((o) => { if (o.isMesh) wheels.push(o); });
  return { body, glass, wheels, tail, interior: lodMeshes.filter((e) => e.level === 0 && inner(e.mesh)).map((e) => e.mesh), all: all.filter((o) => !lodMeshes.some((e) => e.level > 0 && e.mesh === o)) };
}

/** Freeze the car at full detail (LOD 0, full wheels, mirrors) for measuring. Returns a restore function. */
export function fullDetail(c) {
  const auto = c.lod.autoUpdate;
  c.lod.autoUpdate = false;
  c.lod.levels.forEach((l, i) => { l.object.visible = i === 0; });
  c.detail.forEach((o) => { o.visible = true; }); c.simple.forEach((o) => { o.visible = false; });
  c.wheelRoot.visible = true; c.proxy.visible = false; c.sideMirrors.visible = true;
  c.root.updateMatrixWorld(true);
  return () => { c.lod.autoUpdate = auto; c.band = undefined; };
}

// ------------------------------------------------------------------------------------------ silhouettes and holes

function renderMask(renderer, scene, meshes, cam, rt) {
  const saved = meshes.map((o) => [o, o.layers.mask]);
  meshes.forEach((o) => o.layers.set(LAYER));
  const prev = { bg: scene.background, ov: scene.overrideMaterial, layers: cam.layers.mask, fog: scene.fog };
  scene.background = new THREE.Color(0); scene.fog = null;
  scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  cam.layers.set(LAYER);
  renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
  const px = new Uint8Array(MASK * MASK * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, MASK, MASK, px);
  saved.forEach(([o, l]) => { o.layers.mask = l; });
  scene.background = prev.bg; scene.overrideMaterial.dispose(); scene.overrideMaterial = prev.ov; cam.layers.mask = prev.layers; scene.fog = prev.fog;
  const on = new Uint8Array(MASK * MASK);
  for (let i = 0; i < on.length; i++) on[i] = px[i * 4] > 127 ? 1 : 0;
  return on;
}

/** background pixels not reachable from the border: holes in the silhouette, as connected components */
function holes(on) {
  const N = MASK, seen = new Uint8Array(N * N), q = [];
  const push = (i) => { if (!on[i] && !seen[i]) { seen[i] = 1; q.push(i); } };
  for (let i = 0; i < N; i++) { push(i); push((N - 1) * N + i); push(i * N); push(i * N + N - 1); }
  while (q.length) { const i = q.pop(), x = i % N, y = (i / N) | 0; if (x > 0) push(i - 1); if (x < N - 1) push(i + 1); if (y > 0) push(i - N); if (y < N - 1) push(i + N); }
  const comps = [], lab = new Int32Array(N * N).fill(-1);
  for (let s = 0; s < N * N; s++) {
    if (on[s] || seen[s] || lab[s] >= 0) continue;
    const c = { px: [], cx: 0, cy: 0 }; const st = [s]; lab[s] = comps.length;
    while (st.length) {
      const i = st.pop(); c.px.push(i); c.cx += i % N; c.cy += (i / N) | 0;
      const x = i % N, y = (i / N) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1]) if (j >= 0 && !on[j] && !seen[j] && lab[j] < 0) { lab[j] = comps.length; st.push(j); }
    }
    c.cx /= c.px.length; c.cy /= c.px.length; c.area = c.px.length;
    comps.push(c);
  }
  return comps;
}

const VIEWS = [
  ['left', [0, 0, 1]], ['right', [0, 0, -1]], ['front', [-1, 0, 0]], ['rear', [1, 0, 0]], ['top', [0, 1, 0]],
  ['front-left', [-0.75, 0.45, 0.75]], ['rear-left', [0.75, 0.45, 0.75]], ['front-right', [-0.75, 0.45, -0.75]], ['rear-right', [0.75, 0.45, -0.75]],
  ['low-left', [-0.2, 0.12, 1]], ['low-right', [0.2, 0.12, -1]],
];

/**
 * See-through and glass coverage from 11 directions. "all" = every part (what a player can see through: should have
 * no holes); "body" = shell alone (its holes are the window openings and any cracks); "body+glass" = what the glass
 * leaves open. Holes inside a wheel's disc are the gaps between spokes and are ignored.
 */
export function silhouettes(renderer, scene, c, sheet) {
  const P = partsOf(c), restore = fullDetail(c);
  const rt = new THREE.WebGLRenderTarget(MASK, MASK);
  const box = new THREE.Box3().setFromObject(c.car), ctr = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() * 0.55;
  const cam = new THREE.OrthographicCamera(-r, r, r, -r, 0.01, 50);
  const q = c.car.getWorldQuaternion(new THREE.Quaternion());
  const out = { seeThrough: [], uncovered: [], openings: 0, covered: 0, views: [] };
  for (const [name, d] of VIEWS) {
    const dir = new THREE.Vector3(...d).normalize().applyQuaternion(q);
    cam.position.copy(ctr).addScaledVector(dir, 20); cam.up.set(0, 1, 0);
    if (Math.abs(dir.y) > 0.9) cam.up.set(1, 0, 0).applyQuaternion(q);
    cam.lookAt(ctr); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    // wheel discs on screen (holes there are spoke gaps)
    const discs = c.wheels.map((w) => {
      const p = w.pivot.getWorldPosition(new THREE.Vector3()), s = p.clone().project(cam);
      const e = p.clone().add(new THREE.Vector3(0, w.spec.radius * 1.08, 0)).project(cam);
      return { x: (s.x * 0.5 + 0.5) * MASK, y: (s.y * 0.5 + 0.5) * MASK, r: Math.max(Math.abs(e.y - s.y), 0.02) * 0.5 * MASK * 1.15 };
    });
    const real = (h) => h.area >= 6 && !discs.some((k) => Math.hypot(h.cx - k.x, h.cy - k.y) < k.r);
    // mirrors stand off the door on arms: the gap under each arm is daylight on every real car, not a hole
    const mirrorSet = new Set(); c.sideMirrors.traverse((o) => { if (o.isMesh) mirrorSet.add(o); });
    const all = holes(renderMask(renderer, scene, P.all.filter((o) => !mirrorSet.has(o)), cam, rt)).filter(real);
    const bodyOnly = holes(renderMask(renderer, scene, [...P.body, ...aeroMeshes(c)], cam, rt)).filter(real);
    const bg = renderMask(renderer, scene, [...P.body, ...aeroMeshes(c), ...P.glass], cam, rt), bgH = holes(bg).filter(real);
    const openArea = bodyOnly.reduce((s, h) => s + h.area, 0), leftArea = bgH.reduce((s, h) => s + h.area, 0);
    out.openings += openArea; out.covered += Math.max(0, openArea - leftArea);
    for (const h of all) out.seeThrough.push({ view: name, area: h.area, cm2: +(h.area * (2 * r / MASK * 100) ** 2).toFixed(1), at: [+(h.cx / MASK).toFixed(2), +(h.cy / MASK).toFixed(2)] });
    for (const h of bgH) out.uncovered.push({ view: name, area: h.area });
    out.views.push({ name, all: all.length, uncoveredPx: leftArea, openingsPx: openArea });
    sheet?.add(`mask ${name}`, maskImage(bg, all, bgH, discs));
  }
  rt.dispose(); restore();
  return out;
}

function aeroMeshes(c) { const a = []; c.lod.levels[0].object.traverse((o) => { if (o.isMesh && o.parent?.name?.startsWith('aero-')) a.push(o); }); return a; }

function maskImage(on, seeHoles, glassHoles, discs) {
  const cv = document.createElement('canvas'); cv.width = cv.height = MASK;
  const g = cv.getContext('2d'), img = g.createImageData(MASK, MASK);
  for (let y = 0; y < MASK; y++) for (let x = 0; x < MASK; x++) {
    const i = (MASK - 1 - y) * MASK + x, o = (y * MASK + x) * 4, v = on[i] ? 200 : 20;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  const paint = (hs, col) => hs.forEach((h) => h.px.forEach((i) => { const x = i % MASK, y = MASK - 1 - ((i / MASK) | 0), o = (y * MASK + x) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; }));
  paint(glassHoles, [40, 120, 255]);       // blue: open, not covered by glass
  paint(seeHoles, [255, 40, 40]);           // red: see-through with every part in place
  g.putImageData(img, 0, 0);
  g.strokeStyle = '#3c3'; discs.forEach((k) => { g.beginPath(); g.arc(k.x, MASK - k.y, k.r, 0, 7); g.stroke(); });
  return cv;
}

// ------------------------------------------------------------------------------------------ raycast checks

const ray = new THREE.Raycaster();
function hit(meshes, o, d, far) { ray.set(o, d); ray.far = far; return ray.intersectObjects(meshes, false)[0]; }

/** Wheel arches: from each wheel centre, rays fan up through the arch; clearance = distance to the body - radius. */
export function wheelFit(c) {
  const P = partsOf(c), restore = fullDetail(c), shell = [...P.body, ...aeroMeshes(c)];
  const q = c.car.getWorldQuaternion(new THREE.Quaternion()), ex = new THREE.Vector3(1, 0, 0).applyQuaternion(q), ez = new THREE.Vector3(0, 0, 1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0);
  const rows = c.wheels.map((w) => {
    const ctr = w.pivot.getWorldPosition(new THREE.Vector3()), R = w.spec.radius, W = w.spec.width;
    const out = ctr.clone().sub(c.car.getWorldPosition(new THREE.Vector3())).dot(ez) > 0 ? ez.clone() : ez.clone().negate();
    let min = Infinity, top = Infinity;
    for (const off of [-0.35, 0, 0.35]) for (let a = 25; a <= 155; a += 10) {
      const d = ex.clone().multiplyScalar(Math.cos(THREE.MathUtils.degToRad(a))).addScaledVector(up, Math.sin(THREE.MathUtils.degToRad(a))).normalize();
      // a model car carries its uprights and suspension: hits inside the rim (< 0.75 R) are those, not the arch
      ray.set(ctr.clone().addScaledVector(out, off * W), d); ray.far = 1.2;
      const h = c.profile.model ? ray.intersectObjects(shell, false).find((x) => x.distance > R * 0.75) : hit(shell, ctr.clone().addScaledVector(out, off * W), d, 1.2);
      if (!h) continue;
      const cl = h.distance - R; min = Math.min(min, cl); if (a === 85 || a === 95) top = Math.min(top, cl);
    }
    // the tyre's outer face against the body side at axle height (+ = pokes out past the bodywork)
    const face = ctr.clone().addScaledVector(out, W / 2), from = ctr.clone().addScaledVector(out, 2).addScaledVector(up, R * 1.15);   // the fender just over the tyre
    const side = hit(shell, from, out.clone().negate(), 2.5);
    const poke = side ? face.clone().sub(side.point).dot(out) : null;
    return { wheel: w.pivot.name || w.axle, axle: w.axle, minClearance: +min.toFixed(3), topGap: +top.toFixed(3), poke: poke === null ? null : +poke.toFixed(3) };
  });
  restore();
  return rows;
}

/** Glass against the shell: share of glass lying on top of paint (floating) or under it (hidden), per sample */
export function glassFit(c) {
  const P = partsOf(c), restore = fullDetail(c), shell = [...P.body, ...aeroMeshes(c)];
  let n = 0, floating = 0, buried = 0, open = 0; const worst = [];
  for (const g of P.glass) {
    const pos = g.geometry.attributes.position, nor = g.geometry.attributes.normal, step = Math.max(1, Math.floor(pos.count / 500));
    const nm = new THREE.Matrix3().getNormalMatrix(g.matrixWorld);
    for (let i = 0; i < pos.count; i += step) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(g.matrixWorld);
      const nv = new THREE.Vector3().fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      // make the normal point out of the car
      if (nv.dot(v.clone().sub(c.car.getWorldPosition(new THREE.Vector3())).setY(0)) < 0 && Math.abs(nv.y) < 0.7) nv.negate();
      if (nv.y < -0.2) nv.negate();
      const h = hit(shell, v.clone().addScaledVector(nv, 0.06), nv.clone().negate(), 0.12);
      n++;
      if (!h) { open++; continue; }
      const s = 0.06 - h.distance;       // > 0: paint is outside the glass (glass buried); < 0: paint is under it (floating)
      if (s > 0.012) buried++; else if (s < -0.025) { floating++; if (worst.length < 12) worst.push(v.toArray().map((x) => +x.toFixed(2))); }
    }
  }
  restore();
  return { samples: n, floating: +(floating / n).toFixed(3), buried: +(buried / n).toFixed(3), overOpening: +(open / n).toFixed(3), floatingAt: worst };
}

/** Exhaust and nitro anchors: on the body's rear surface, a clear exit behind, left/right pairs symmetric */
export function emitterFit(c) {
  const P = partsOf(c), restore = fullDetail(c), shell = P.body, rows = [];
  const q = new THREE.Quaternion();
  for (const [kind, list] of [['exhaust', c.exhausts ?? []], ['nitro', c.electric ? c.nitro ?? [] : []]]) for (const a of list) {
    const p = a.getWorldPosition(new THREE.Vector3()); a.getWorldQuaternion(q);
    const d = (a.userData.dir ?? new THREE.Vector3(1, 0, 0)).clone().applyQuaternion(q).normalize();
    const back = hit(shell, p.clone().addScaledVector(d, 0.3), d.clone().negate(), 0.6);
    const exit = hit(shell, p.clone().addScaledVector(d, 0.01), d, 0.5);
    rows.push({ kind, name: a.name, onBody: back ? +(back.distance - 0.3).toFixed(3) : null, blocked: !!exit, z: +a.position.z.toFixed(3) });
  }
  restore();
  const zs = rows.filter((r) => r.kind === 'exhaust').map((r) => r.z).sort((a, b) => a - b);
  const asym = zs.length > 1 ? Math.max(...zs.map((z, i) => Math.abs(z + zs[zs.length - 1 - i]))) : 0;
  return { rows, asymmetry: +asym.toFixed(3) };
}

/** Mirrors: both present, mirror-image positions, the housing's inner edge a short arm away from the body */
export function mirrorFit(c) {
  const P = partsOf(c), restore = fullDetail(c), shell = P.body, sides = { 1: new THREE.Box3(), [-1]: new THREE.Box3() };
  const inv = new THREE.Matrix4().copy(c.car.matrixWorld).invert();
  c.sideMirrors.updateMatrixWorld(true);
  // the housing is found by its glass (the arm and its foot on the door would make every gap zero)
  const glassOnly = c.tuning?.mirrors && (() => { let n = 0; c.sideMirrors.traverse((o) => { if (o.material === mirrorGlassMaterial()) n++; }); return n > 0; })();
  c.sideMirrors.traverse((o) => {
    if (!o.isMesh || (glassOnly && o.material !== mirrorGlassMaterial())) return;
    const pos = o.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); sides[v.z >= 0 ? 1 : -1].expandByPoint(v); }
  });
  const ok = !sides[1].isEmpty() && !sides[-1].isEmpty();
  const a = sides[1].getCenter(new THREE.Vector3()), b = sides[-1].getCenter(new THREE.Vector3());
  const asym = ok ? Math.hypot(a.x - b.x, a.y - b.y, a.z + b.z) : null;
  // gap between each housing's outer box and the shell, measured outward from the car's side at the housing height
  const gaps = [1, -1].map((s) => {
    if (sides[s].isEmpty()) return null;
    // from the housing's centre, a fan of rays in toward the car (level, down, forward and back): the nearest door,
    // pillar or glass, less half the housing's width, is the gap a viewer sees
    const ctr = sides[s].getCenter(new THREE.Vector3()), halfW = sides[s].getSize(new THREE.Vector3()).z / 2;
    const from = ctr.clone().applyMatrix4(c.car.matrixWorld);
    let best = Infinity;
    for (const [dx, dy] of [[0, 0], [0, -0.5], [0, -1], [0.5, -0.5], [-0.5, -0.5], [0.6, 0], [-0.6, 0]]) {
      const dir = new THREE.Vector3(dx, dy, -s).normalize().transformDirection(c.car.matrixWorld);
      const h = hit([...shell, ...P.glass], from, dir, 1.0);
      if (h) best = Math.min(best, h.distance);
    }
    // no ray reached the car within 1 m: null, which the sandbox check fails as "no gap"
    return best < Infinity ? +(best - halfW).toFixed(3) : null;
  });
  restore();
  return { present: ok, asymmetry: asym === null ? null : +asym.toFixed(3), housingGap: gaps, size: ok ? sides[1].getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(3)) : null };
}

/** Pixel stats of a render inside a mask: mean luminance (0..255) and red over green */
export function maskedStats(rgba, mask, W, H) {
  let n = 0, lum = 0, r = 0, g = 0, peak = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    const R = rgba[i * 4], G = rgba[i * 4 + 1], B = rgba[i * 4 + 2], L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    n++; lum += L; r += R; g += G; peak = Math.max(peak, L);
  }
  return n ? { px: n, lum: +(lum / n).toFixed(1), redOverGreen: +(r / Math.max(g, 1)).toFixed(2), peak: +peak.toFixed(0) } : { px: 0 };
}

export { renderMask, MASK, LAYER };
