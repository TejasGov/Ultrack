// Tokyo's signs, analysed once per venue load and shared by the parts that light them (neon-signs colours them, light-pools and
// neon-wash spill their light). A sign is a backing panel (the pylon boards, the V8 street boards)
// and/or a layer of cut-out glyphs (M_SignNeonAtlas, alpha-masked text) in front of it. Text on the barrier ads (V9 ad) is print. Each one gets a palette hue and a style from a hash of where it stands, the same for its panel
// and its glyphs, so the street has many colours but every sign is one colour.
//   styles: 0 lit panel, dark glyphs | 1 lit panel, white glyphs | 2 dark panel, glyphs lit in the hue (neon tubes) | 3 printed text
import * as THREE from 'three';

export const GLYPHS = /^M_SignNeonAtlas$/;
export const PANELS = (o) => /pylon_boards/.test(o.name) || /^V8 (pink|ice|amber|paper)$/.test(o.material.name);   // recoloured
const PRINT = (o) => /^V9 ad /.test(o.material.name);                                                         // kept, text on them is print
// palette (sRGB hex) and weight; brightness per hue evens out what the eye reads (violet and magenta carry little luminance)
export const PALETTE = [['#ff2e88', 3], ['#19e3ff', 3], ['#ffb46b', 2], ['#3dff9a', 1], ['#7a3cff', 1.5], ['#fff1dc', 1.5]]
  .map(([hex, w]) => { const c = new THREE.Color(hex), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; return { c, w, k: Math.min(2.2, Math.max(0.6, (0.5 / l) ** 0.6)) }; });
const WSUM = PALETTE.reduce((s, p) => s + p.w, 0);

const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
function pick(p) {
  let r = hash(Math.round(p.x * 2) / 2, Math.round(p.y * 2) / 2, Math.round(p.z * 2) / 2) * WSUM, hue = 0;
  for (; hue < PALETTE.length - 1 && r >= PALETTE[hue].w; hue++) r -= PALETTE[hue].w;
  const s = hash(p.z * 0.37 + 5.1, p.x * 0.29 + 1.7, p.y * 0.31);
  return { hue, style: s < 0.45 ? 0 : s < 0.6 ? 1 : 2 };
}

/** Connected pieces of a mesh in world space: per piece its vertex ids, area-weighted centroid, normal and box. */
function pieces(o) {
  const pos = o.geometry.attributes.position, idx = o.geometry.index, n = pos.count, parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const v = new THREE.Vector3(), seen = new Map(), W = [];
  for (let i = 0; i < n; i++) {
    W.push(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).clone());
    const k = `${Math.round(W[i].x * 200)},${Math.round(W[i].y * 200)},${Math.round(W[i].z * 200)}`;    // split seams: same place, same piece
    if (seen.has(k)) join(seen.get(k), i); else seen.set(k, i);
  }
  const nt = (idx ? idx.count : n) / 3, I = (t, j) => (idx ? idx.getX(t * 3 + j) : t * 3 + j);
  for (let t = 0; t < nt; t++) { join(I(t, 0), I(t, 1)); join(I(t, 0), I(t, 2)); }
  const by = new Map(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let t = 0; t < nt; t++) {
    const a = I(t, 0), b = I(t, 1), c = I(t, 2), r = find(a);
    nn.crossVectors(e1.subVectors(W[b], W[a]), e2.subVectors(W[c], W[a]));
    const area = nn.length() / 2;
    let p = by.get(r);
    if (!p) by.set(r, p = { ids: new Set(), c: new THREE.Vector3(), n: new THREE.Vector3(), A: 0, box: new THREE.Box3() });
    p.ids.add(a); p.ids.add(b); p.ids.add(c);
    p.c.addScaledVector(W[a].clone().add(W[b]).add(W[c]), area / 3); p.n.add(nn); p.A += area;
    p.box.expandByPoint(W[a]).expandByPoint(W[b]).expandByPoint(W[c]);
  }
  return [...by.values()].filter((p) => p.A > 1e-4).map((p) => ({ ...p, c: p.c.multiplyScalar(1 / p.A), n: p.n.normalize() }));
}

const cache = new WeakMap();
/** { signs: [{ pos, normal, A (m2), box, hue, style, glyphs, panel }], attrs: Map(mesh -> Float32Array: hue, style per vertex) } */
export function analyseSigns(root) {
  if (cache.has(root)) return cache.get(root);
  root.updateMatrixWorld(true);
  const glyphMeshes = [], panelMeshes = [], printMeshes = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.isInstancedMesh || /_far~/.test(o.name)) return;
    if (GLYPHS.test(o.material.name)) glyphMeshes.push(o); else if (PANELS(o)) panelMeshes.push(o); else if (PRINT(o)) printMeshes.push(o);
  });
  const panels = [...panelMeshes.flatMap((o) => pieces(o).map((p) => ({ ...p, o, glyphs: [] }))), ...printMeshes.flatMap((o) => pieces(o).map((p) => ({ ...p, o, glyphs: [], print: true })))];
  const cell = (p) => `${Math.floor(p.x / 6)},${Math.floor(p.z / 6)}`, grid = new Map();
  for (const p of panels) { const k = cell(p.c); (grid.get(k) ?? grid.set(k, []).get(k)).push(p); }
  const glyphs = glyphMeshes.flatMap((o) => pieces(o).map((p) => ({ ...p, o })));
  const loose = [];
  for (const g of glyphs) {                                       // its panel: the one whose box (grown 0.3 m) holds it, nearest first
    let best = null, bd = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const p of grid.get(`${Math.floor(g.c.x / 6) + dx},${Math.floor(g.c.z / 6) + dz}`) ?? []) {
        if (!p.box.clone().expandByScalar(0.3).containsPoint(g.c)) continue;
        const d = p.c.distanceToSquared(g.c); if (d < bd) { bd = d; best = p; }
      }
    }
    if (best) best.glyphs.push(g); else loose.push(g);
  }
  const signs = [];
  for (const p of panels) {
    if (p.print) { for (const g of p.glyphs) signs.push({ pos: g.c, normal: g.n, A: 0, box: g.box, hue: 0, style: 3, panel: null, glyphs: [g], print: true }); continue; }
    const s = pick(p.c); signs.push({ pos: p.c, normal: p.n, A: p.A, box: p.box, ...s, style: p.glyphs.length ? s.style : 0, panel: p, glyphs: p.glyphs });
  }
  for (const g of loose) signs.push({ pos: g.c, normal: g.n, A: g.A, box: g.box, ...pick(g.c), style: 2, panel: null, glyphs: [g] });   // free-standing text: neon tubes
  const attrs = new Map(), put = (piece, s) => {
    let a = attrs.get(piece.o); if (!a) attrs.set(piece.o, a = new Float32Array(piece.o.geometry.attributes.position.count * 2));
    for (const i of piece.ids) { a[i * 2] = s.hue; a[i * 2 + 1] = s.style; }
  };
  for (const s of signs) { if (s.panel) put(s.panel, s); for (const g of s.glyphs) put(g, s); }
  const out = { signs, attrs };
  cache.set(root, out);
  return out;
}
