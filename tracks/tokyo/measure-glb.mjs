// Triangle and draw-call budget of a track GLB, the way the viewer would see it (see track-viewer/src/perf.js Culler).
//   node tracks/tokyo/measure-glb.mjs <glb> [--camera x,y,z --yaw <rad rotation.y>] [--out budget.json]
// unique: triangles of every distinct mesh counted once (the file's geometry). drawn_*: at the camera (default: the start line,
// 2.5 m up, looking down the start heading), after the Culler's per-object / per-instance distance cull (k = 280 x radius;
// plain meshes with a sphere radius over 45 m are never culled). submitted = what is sent to the GPU (instanced sets are not
// frustum culled, as in the viewer); in_frustum = the share whose sphere is inside the camera frustum. draw_calls = primitives
// (plain) + instanced primitives, in the same two senses.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(join(root, 'track-viewer', 'package.json'));
const imp = (m) => import(pathToFileURL(req.resolve(m)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { MeshoptDecoder } = await imp('meshoptimizer');

const args = process.argv.slice(2);
const file = args[0];
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const cam = opt('--camera', '0,3.5,0').split(',').map(Number);
const yaw = Number(opt('--yaw', Math.PI / 2));          // rotation.y; start heading +X
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);

// frustum planes: vertical FOV 62, 16:9, far 9000, looking along (sin yaw, 0, cos yaw)
const fwd = [Math.sin(yaw), 0, Math.cos(yaw)], up = [0, 1, 0];
const right = [fwd[1] * up[2] - fwd[2] * up[1], fwd[2] * up[0] - fwd[0] * up[2], fwd[0] * up[1] - fwd[1] * up[0]];
const th = Math.tan((62 / 2) * Math.PI / 180), tw = th * 16 / 9;
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const planes = [
  norm([fwd[0] - right[0] * tw, fwd[1] - right[1] * tw, fwd[2] - right[2] * tw]).map((x, i) => x),   // placeholder, replaced below
];
// side planes: normals pointing inward
const nl = norm([right[0] + fwd[0] * tw, right[1] + fwd[1] * tw, right[2] + fwd[2] * tw]);   // left plane inward normal
const nr = norm([-right[0] + fwd[0] * tw, -right[1] + fwd[1] * tw, -right[2] + fwd[2] * tw]);
const nb = norm([up[0] + fwd[0] * th, up[1] + fwd[1] * th, up[2] + fwd[2] * th]);
const nt = norm([-up[0] + fwd[0] * th, -up[1] + fwd[1] * th, -up[2] + fwd[2] * th]);
const inFrustum = (c, r) => [nl, nr, nb, nt, fwd].every((n) => dot(n, [c[0] - cam[0], c[1] - cam[1], c[2] - cam[2]]) > -r) && Math.hypot(c[0] - cam[0], c[1] - cam[1], c[2] - cam[2]) < 9000 + r;

const triOf = (p) => (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
const unique = new Map();
for (const m of doc.getRoot().listMeshes()) unique.set(m, m.listPrimitives().reduce((s, p) => s + triOf(p), 0));
const sphereOf = (mesh) => {
  let lo = [1e18, 1e18, 1e18], hi = [-1e18, -1e18, -1e18];
  const e = [0, 0, 0];
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION');
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, e); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], e[k]); hi[k] = Math.max(hi[k], e[k]); } }
  }
  const c = lo.map((v, k) => (v + hi[k]) / 2);
  return { c, r: Math.hypot(...hi.map((v, k) => v - c[k])) };
};
const sph = new Map();
const K = 280;
const TIER = /~(\d+)-(\d*)/;      // v13.1 distance tiers (track-viewer/src/perf.js): visible while lo <= distance < hi
const tierOf = (node, mesh) => { const m = TIER.exec(node.getName() || '') ?? TIER.exec(mesh.getName() || ''); return m ? { lo: +m[1], hi: m[2] ? +m[2] : Infinity } : null; };
const r2 = { submitted: { tris: 0, calls: 0 }, frustum: { tris: 0, calls: 0 }, all: { tris: 0, calls: 0 } };
const byMaterial = new Set();
const byGroup = {};      // submitted draw calls and triangles by object-name family
const famOf = (node, mesh) => (node.getName() || mesh.getName() || '').replace(/[~].*$/, '').replace(/\d+/g, '#').slice(0, 30);
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  if (!sph.has(mesh)) sph.set(mesh, sphereOf(mesh));
  const s = sph.get(mesh), t = unique.get(mesh), W = node.getWorldMatrix();
  const sc = Math.cbrt(Math.abs(W[0] * (W[5] * W[10] - W[6] * W[9]) - W[4] * (W[1] * W[10] - W[2] * W[9]) + W[8] * (W[1] * W[6] - W[2] * W[5])));
  const wc = [W[0] * s.c[0] + W[4] * s.c[1] + W[8] * s.c[2] + W[12], W[1] * s.c[0] + W[5] * s.c[1] + W[9] * s.c[2] + W[13], W[2] * s.c[0] + W[6] * s.c[1] + W[10] * s.c[2] + W[14]];
  const inst = node.getExtension('EXT_mesh_gpu_instancing');
  const tier = tierOf(node, mesh);
  const nprim = mesh.listPrimitives().length;
  mesh.listPrimitives().forEach((p) => byMaterial.add(p.getMaterial()?.getName() ?? ''));
  if (inst) {
    const T = inst.getAttribute('TRANSLATION'), S = inst.getAttribute('SCALE'), n = (T ?? inst.listAttributes()[0]).getCount();
    r2.all.tris += t * n; r2.all.calls += nprim;
    let sub = 0, fr = 0;
    const tv = [0, 0, 0], sv = [1, 1, 1];
    for (let i = 0; i < n; i++) {
      T?.getElement(i, tv); S?.getElement(i, sv);
      const p = [W[0] * tv[0] + W[4] * tv[1] + W[8] * tv[2] + W[12], W[1] * tv[0] + W[5] * tv[1] + W[9] * tv[2] + W[13], W[2] * tv[0] + W[6] * tv[1] + W[10] * tv[2] + W[14]];
      const d = Math.hypot(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]);
      if (tier) { if (d < tier.lo || d >= tier.hi) continue; }
      else if (n >= 6 && d > s.r * sc * Math.max(sv[0], sv[1], sv[2]) * K) continue;
      sub++;
      if (inFrustum(p, s.r * sc * sv[0])) fr++;
    }
    r2.submitted.tris += t * sub; r2.frustum.tris += t * fr;
    if (sub) { r2.submitted.calls += nprim; const g = byGroup[famOf(node, mesh)] ??= { calls: 0, tris: 0 }; g.calls += nprim; g.tris += t * sub; }
    if (fr) r2.frustum.calls += nprim;
  } else {
    r2.all.tris += t; r2.all.calls += nprim;
    const R = s.r * sc, d = Math.hypot(wc[0] - cam[0], wc[1] - cam[1], wc[2] - cam[2]);
    if (tier) { if (d < tier.lo || d >= tier.hi) continue; }
    else if (R <= 45 && d > Math.max(R, 0.5) * K) continue;
    const vis = inFrustum(wc, R);
    if (vis) { r2.submitted.tris += t; r2.submitted.calls += nprim; r2.frustum.tris += t; r2.frustum.calls += nprim; const g = byGroup[famOf(node, mesh)] ??= { calls: 0, tris: 0 }; g.calls += nprim; g.tris += t; }
  }
}
const nodes = doc.getRoot().listNodes();
const res = {
  file, camera: { pos: cam, yawRad: yaw, fovV: 62, far: 9000, cullK: K },
  unique_triangles: Math.round([...unique.values()].reduce((a, b) => a + b, 0)),
  total_triangles_all_instances: Math.round(r2.all.tris),
  drawn_submitted_triangles: Math.round(r2.submitted.tris), drawn_in_frustum_triangles: Math.round(r2.frustum.tris),
  draw_calls_all: r2.all.calls, draw_calls_submitted: r2.submitted.calls, draw_calls_in_frustum: r2.frustum.calls,
  meshes: unique.size, nodes: nodes.length, instanced_nodes: nodes.filter((n) => n.getExtension('EXT_mesh_gpu_instancing')).length,
  materials: doc.getRoot().listMaterials().length, textures: doc.getRoot().listTextures().length,
};
res.submitted_by_family = Object.fromEntries(Object.entries(byGroup).sort((a, b) => b[1].calls - a[1].calls).slice(0, 25));
console.log(JSON.stringify(res, null, 1));
if (opt('--out')) writeFileSync(opt('--out'), JSON.stringify(res, null, 1));
