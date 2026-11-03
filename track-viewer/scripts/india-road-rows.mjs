// India's collision road is one strip from the centreline to each edge, 11 m wide, level across at the centreline's height. On a curving slope such a strip is a trapezoid, its two triangles
// lie at different grades and the surface kinks at every station: a 5-12 cm sawtooth off the centreline, felt as ripple at 13 Hz. This rebuilds it in narrower rows with the same centreline, the
// same edges and the same heights across, so the kink goes with the row's width. On the collision only. Run after tracks/india/pack-web.mjs (tracks/india/build-game.mjs), then sync-assets.
//   node scripts/india-road-rows.mjs [file] [rows=6]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync } from 'node:fs';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [file = join(root, '..', 'tracks', 'india', 'out', 'web', 'india_collision.glb'), rows = '6'] = process.argv.slice(2), R = +rows;
const C = JSON.parse(readFileSync(join(root, 'public', 'assets', 'india', 'track.json'), 'utf8')).centerline, n = C.length;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(file), node = doc.getRoot().listNodes().find((x) => x.getName().startsWith('col_asphalt'));
const M = node.getWorldMatrix(); if (M[0] !== 1 || M[5] !== 1 || M[10] !== 1 || M[12] || M[13] || M[14]) throw new Error('expected an unrounded mesh: run it on the float build');
const prim = node.getMesh().listPrimitives()[0], P = prim.getAttribute('POSITION'), v = [0, 0, 0];
const left = (i) => { const a = C[(i + n - 1) % n], b = C[(i + 1) % n], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz); return [tz / l, -tx / l]; };
// each edge vertex of the old ribbon belongs to the station at its height, within reach of the road
const edge = [new Array(n), new Array(n)];    // [side][station] = { x, z, L }
for (let k = 0; k < P.getCount(); k++) {
  P.getElement(k, v); let best = -1, off = 1e9;
  for (let i = 0; i < n; i++) {
    if (Math.abs(C[i][1] - v[1]) > 0.03 || Math.hypot(C[i][0] - v[0], C[i][2] - v[2]) > 12) continue;
    const [lx, lz] = left(i), along = Math.abs((v[0] - C[i][0]) * lz - (v[2] - C[i][2]) * lx); if (along < off) { off = along; best = i; }   // on a level stretch several stations share a height: the one it lies square across from
  }
  if (best < 0) throw new Error(`vertex ${k} has no station`);
  const dx = v[0] - C[best][0], dz = v[2] - C[best][2], L = Math.hypot(dx, dz); if (L < 1) continue;
  const [lx, lz] = left(best), s = dx * lx + dz * lz > 0 ? 0 : 1; if (!edge[s][best] || L > edge[s][best].L) edge[s][best] = { x: v[0], z: v[2], L };
}
const missing = edge.flatMap((e) => [...e].map((x, i) => (x ? -1 : i)).filter((i) => i >= 0)); if (missing.length) throw new Error(`no edge at stations ${missing.slice(0, 12)}`);
const out = [], idx = [], at = (i, s, u) => { const c = C[i], e = edge[s][i]; return [c[0] + (e.x - c[0]) * u, c[1], c[2] + (e.z - c[2]) * u]; };
for (const s of [0, 1]) {
  const base = out.length / 3;
  for (let i = 0; i <= n; i++) for (let u = 0; u <= R; u++) out.push(...at(i % n, s, u / R));
  const w = R + 1;
  for (let i = 0; i < n; i++) for (let u = 0; u < R; u++) { const a = base + i * w + u, b = a + 1, c = a + w, d = c + 1; if ((i + u) % 2) idx.push(a, b, d, a, d, c); else idx.push(a, b, c, b, d, c); }   // diagonals alternate: no grain along the road
}
P.setArray(new Float32Array(out));
prim.getIndices().setArray(new Uint32Array(idx));
await io.write(file, doc);
console.log(`col_asphalt: ${idx.length / 3} triangles in ${R} rows a side`);
