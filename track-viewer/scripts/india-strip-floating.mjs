// Floating geometry in India's export: the banner gantry / spectator footbridge carried its top trusses 35-50 m above the banners, and
// some marshal-post parts sat ~40-55 m up, over the city and the start (a truss "floating in the sky"). This drops, from the packed
// visual GLBs in place, every triangle that lies wholly more than LIFT above the ground under it: a height grid (6 m cells, the highest
// terrain / racing-surface point in the 3 x 3 cells around) from the GLB's own terrain. Instanced scatter and water are left alone.
// Run after tracks/india/pack-web.mjs, then sync-assets:
//   node scripts/india-strip-floating.mjs [files...]      (default: tracks/india/out/web/india_visual{,_ktx2}.glb)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { readFileSync } from 'node:fs';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIFT = 40, CELL = 6, GROUND = /terrain|racing surface|V5 far/i, SKIP = /terrain|V5 far|^water$/i;
const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'tracks', 'india', 'out', 'web');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['india_visual.glb', 'india_visual_ktx2.glb'].map((f) => join(web, f));
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const world = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const named = (node, re) => { for (let p = node; p; p = p.getParentNode()) if (re.test(p.getName())) return true; return false; };
for (const file of files) {
  const doc = await io.read(file), nodes = doc.getRoot().listNodes(), v = [0, 0, 0];
  // keep the pack's meshopt mode: the webp pack filters its normals (octahedral), the KTX2 pack only quantizes
  const filtered = readFileSync(file).subarray(0, 4e6).toString('latin1').includes('"OCTAHEDRAL"');
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: filtered ? EXTMeshoptCompression.EncoderMethod.FILTER : EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const grid = new Map(), cell = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  for (const node of nodes) {
    if (!node.getMesh() || node.getExtension('EXT_mesh_gpu_instancing') || !named(node, GROUND)) continue;
    const m = node.getWorldMatrix();
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      for (let i = 0; i < pos.getCount(); i++) { const [x, y, z] = world(m, pos.getElement(i, v)), k = cell(x, z); if (!(grid.get(k) >= y)) grid.set(k, y); }
    }
  }
  const ground = (x, z) => { let g = -Infinity; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) g = Math.max(g, grid.get(`${Math.floor(x / CELL) + i},${Math.floor(z / CELL) + j}`) ?? -Infinity); return g; };
  const dropped = {};
  for (const node of nodes) {
    const mesh = node.getMesh(); if (!mesh || node.getExtension('EXT_mesh_gpu_instancing') || named(node, SKIP)) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), ind = prim.getIndices(); if (!pos || !ind) continue;
      const src = ind.getArray(), keep = [];
      for (let t = 0; t < src.length; t += 3) {
        const p = [0, 1, 2].map((k) => world(m, pos.getElement(src[t + k], v))), g = ground((p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3);
        if (g > -Infinity && Math.min(p[0][1], p[1][1], p[2][1]) - g > LIFT) { const n = node.getParentNode()?.getName() || node.getName(); dropped[n] = (dropped[n] ?? 0) + 1; }
        else keep.push(src[t], src[t + 1], src[t + 2]);
      }
      if (keep.length !== src.length) ind.setArray(new src.constructor(keep));
    }
  }
  await io.write(file, doc);
  console.log(file, 'dropped', JSON.stringify(dropped));
}
