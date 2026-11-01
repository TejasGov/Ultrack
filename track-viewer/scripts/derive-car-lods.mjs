// Game meshes for the car-lab body shells (read-only use of car-lab; sources are never modified).
//   node scripts/derive-car-lods.mjs [carKey ...]   -> assets/cars/<key>/body_lod0.glb (~80k tris), body_lod1.glb (~20k)
// The shells are 1.1-2.8 M triangles, far beyond a browser race. Each LOD:
//   1. bakes the exact normalisation car-lab's normalizeShell() applies at runtime (rotate if the long axis is Z,
//      centre X/Z, bottom at Y=0, scale to profile.body.displayLength), so every fit anchor in the car-lab profile
//      (wheel pivots, glass, mirrors, lamp fits) lines up with the derived mesh without changes;
//   2. welds and simplifies with meshoptimizer (border-locked, error-bounded);
//   3. recomputes area-weighted normals, then diffuses them over ~30 cm of surface (bilateral: neighbours more than
//      ~50 deg apart do not blend, so panel edges stay sharp). The generated shells are crumpled at 10-40 cm; moving
//      the vertices did not remove that (tested), but the paint's reflections follow the normals, so smooth shading
//      normals let a glossy clearcoat read as a finished panel while the shape stays exactly as generated;
//   4. writes meshopt-compressed GLB with 16-bit positions (a 4.6 m car -> ~0.1 mm grid).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const profiles = join(root, 'car-lab', 'src', 'vehicle', 'profiles');
// shell cars only: the others became complete models (car_lod*.glb, scripts/model-car.py) and their body_lod shells were archived (_archive/2026-10-21/MANIFEST.md)
const CARS = ['bentley-gt', 'bmw1'];
const LODS = [{ name: 'body_lod0', tris: 80000 }, { name: 'body_lod1', tris: 20000 }];

await MeshoptDecoder.ready; await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/** All triangles of the shell in world space (node transforms baked), as flat arrays. */
function readWorld(doc) {
  const pos = [], idx = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION'), ind = prim.getIndices(), base = pos.length / 3, e = [0, 0, 0];
      for (let k = 0; k < a.getCount(); k++) {
        a.getElement(k, e);
        pos.push(m[0] * e[0] + m[4] * e[1] + m[8] * e[2] + m[12], m[1] * e[0] + m[5] * e[1] + m[9] * e[2] + m[13], m[2] * e[0] + m[6] * e[1] + m[10] * e[2] + m[14]);
      }
      if (ind) for (let k = 0; k < ind.getCount(); k++) idx.push(base + ind.getScalar(k));
      else for (let k = 0; k < a.getCount(); k++) idx.push(base + k);
    }
  }
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) };
}

/** car-lab normalizeShell(): same bounds, same rotation rule, same centre/bottom/scale. */
function normalize(pos, profile) {
  const bb = () => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[i + a]); mx[a] = Math.max(mx[a], pos[i + a]); } return [mn, mx]; };
  let [mn, mx] = bb();
  if (mx[2] - mn[2] > mx[0] - mn[0]) {                       // geometry.rotateY(PI/2): x' = z, z' = -x
    for (let i = 0; i < pos.length; i += 3) { const x = pos[i], z = pos[i + 2]; pos[i] = z; pos[i + 2] = -x; }
    [mn, mx] = bb();
  }
  if (profile.body.normalizationBounds) [mn, mx] = profile.body.normalizationBounds;
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2, s = profile.body.displayLength / (mx[0] - mn[0]);
  for (let i = 0; i < pos.length; i += 3) { pos[i] = (pos[i] - cx) * s; pos[i + 1] = (pos[i + 1] - mn[1]) * s; pos[i + 2] = (pos[i + 2] - cz) * s; }
}

function smoothNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;   // area-weighted
    for (const v of [a, b, c]) { n[v] += nx; n[v + 1] += ny; n[v + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/**
 * Bilateral normal diffusion on an indexed mesh: each pass averages a vertex normal with its edge neighbours, weighted
 * by how close they already are (full weight under ~25 deg apart, none beyond ~50), so crumples relax and creases stay.
 * Spread grows with sqrt(passes) edges.
 */
function diffuseNormals(N, I, passes) {
  const nv = N.length / 3, deg = new Uint32Array(nv + 1);
  const pairs = [];
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const a = I[t + k], b = I[t + (k + 1) % 3]; pairs.push(a, b); deg[a + 1]++; deg[b + 1]++; }
  for (let v = 0; v < nv; v++) deg[v + 1] += deg[v];
  const nb = new Uint32Array(deg[nv]), fill = deg.slice(0, nv);
  for (let i = 0; i < pairs.length; i += 2) { nb[fill[pairs[i]]++] = pairs[i + 1]; nb[fill[pairs[i + 1]]++] = pairs[i]; }
  let A = N, B = new Float32Array(N.length);
  const lo = Math.cos(50 * Math.PI / 180), hi = Math.cos(25 * Math.PI / 180);
  for (let it = 0; it < passes; it++) {
    for (let v = 0; v < nv; v++) {
      const x0 = A[v * 3], y0 = A[v * 3 + 1], z0 = A[v * 3 + 2];
      let x = x0, y = y0, z = z0;
      for (let j = deg[v]; j < deg[v + 1]; j++) {
        const u = nb[j] * 3, d = x0 * A[u] + y0 * A[u + 1] + z0 * A[u + 2];
        const w = d <= lo ? 0 : d >= hi ? 1 : ((d - lo) / (hi - lo)) ** 2 * (3 - 2 * (d - lo) / (hi - lo));
        x += w * A[u]; y += w * A[u + 1]; z += w * A[u + 2];
      }
      const l = Math.hypot(x, y, z) || 1;
      B[v * 3] = x / l; B[v * 3 + 1] = y / l; B[v * 3 + 2] = z / l;
    }
    [A, B] = [B, A];
  }
  return A;
}
// self-check: a noisy flat patch relaxes to +Y; a right-angle crease between two faces keeps both normals
{
  const N = new Float32Array([0.2, 1, 0, -0.2, 1, 0, 0, 1, 0.2, 1, 0, 0]);
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]); N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  const out = diffuseNormals(N, new Uint32Array([0, 1, 2, 0, 2, 3]), 20);
  console.assert(out[1] > 0.99 && out[4] > 0.99 && out[9] > 0.99, 'diffuseNormals self-check failed');
}

// shading-normal spread per LOD, in passes (spread ~ sqrt(passes) edges; lod1 edges are ~2x longer)
const NPASS = { body_lod0: 120, body_lod1: 30 };
const only = process.argv.slice(2);
const report = {};
for (const key of CARS.filter((k) => !only.length || only.includes(k))) {
  const profile = JSON.parse(readFileSync(join(profiles, `${key}.json`), 'utf8'));
  const srcFile = join(root, profile.body.file);
  const bytes = readFileSync(srcFile);
  const sha = createHash('sha256').update(bytes).digest('hex').toUpperCase();
  if (sha !== profile.body.sha256.toUpperCase()) { console.warn(`${key}: source hash differs from the profile, skipped`); continue; }
  const { pos, idx } = readWorld(await io.readBinary(bytes));
  normalize(pos, profile);
  const srcTris = idx.length / 3;
  report[key] = { name: profile.name, sourceTriangles: srcTris, sourceSha256: sha, lods: {} };
  for (const lod of LODS) {
    const doc = new Document();
    const buf = doc.createBuffer();
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos.slice()).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx.slice()).setBuffer(buf))
      .setMaterial(doc.createMaterial('car_body'));
    doc.createScene().addChild(doc.createNode(`${key}_body`).setMesh(doc.createMesh(`${key}_body`).addPrimitive(prim)));
    await doc.transform(
      weld({ tolerance: 0.0004 }),
      simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, lod.tris / srcTris), error: 0.002, lockBorder: false }),
      dedup(), prune(),
    );
    const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    const P = p.getAttribute('POSITION').getArray(), I = p.getIndices().getArray();
    p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(diffuseNormals(smoothNormals(P, I), I, NPASS[lod.name])).setBuffer(buf));
    const { EXTMeshoptCompression, KHRMeshQuantization } = await import('@gltf-transform/extensions');
    const { quantize, reorder } = await import('@gltf-transform/functions');
    await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ quantizePosition: 16, quantizeNormal: 12 }));
    doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const out = join(root, 'assets', 'cars', key);
    mkdirSync(out, { recursive: true });
    const glb = await io.writeBinary(doc);
    writeFileSync(join(out, `${lod.name}.glb`), glb);
    report[key].lods[lod.name] = { triangles: I.length / 3, kb: Math.round(glb.byteLength / 1024) };
  }
  console.log(key, JSON.stringify(report[key].lods));
}
const lodsFile = join(root, 'assets', 'cars', 'lods.json');
let prev = {}; try { prev = JSON.parse(readFileSync(lodsFile, 'utf8')).cars || {}; } catch {}   // a partial run keeps the other cars' entries
writeFileSync(lodsFile, JSON.stringify({ generated: 'scripts/derive-car-lods.mjs', note: 'derived from car-lab body shells; car-lab profiles apply unchanged', cars: { ...prev, ...report } }, null, 2));
