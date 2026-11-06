// Static stats of track GLBs from the JSON chunk only (no decode): triangles, draws (mesh-node primitives x instances), materials,
// textures by mime with pixel sizes, GPU texture estimate.  node glb-stats.mjs <file.glb>...
import { readFileSync, statSync } from 'node:fs';
const dims = (b, mime) => {
  try {
    if (mime === 'image/ktx2') return [b.readUInt32LE(20), b.readUInt32LE(24)];
    if (mime === 'image/png') return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (mime === 'image/webp') { const c = b.toString('ascii', 12, 16);
      if (c === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (c === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
      return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; }
    if (mime === 'image/jpeg') { let i = 2; while (i < b.length) { const m = b[i + 1], l = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + l; } }
  } catch {} return [0, 0];
};
for (const f of process.argv.slice(2)) {
  const raw = readFileSync(f), jl = raw.readUInt32LE(12), J = JSON.parse(raw.toString('utf8', 20, 20 + jl)), bin = raw.subarray(28 + jl);
  const inst = new Map(); // mesh -> instance count
  for (const n of J.nodes ?? []) if (n.mesh != null) { const g = n.extensions?.EXT_mesh_gpu_instancing; const c = g ? J.accessors[g.attributes.TRANSLATION ?? Object.values(g.attributes)[0]].count : 1; inst.set(n.mesh, (inst.get(n.mesh) ?? 0) + c); }
  let tris = 0, draws = 0, nodesWithMesh = 0, instTris = 0, verts = 0;
  for (const [mi, c] of inst) { nodesWithMesh++; for (const p of J.meshes[mi].primitives) { const t = (p.indices != null ? J.accessors[p.indices].count : J.accessors[p.attributes.POSITION].count) / 3; tris += t * c; draws += 1; instTris += t; verts += J.accessors[p.attributes.POSITION].count; } }
  const tex = {}; let gpu = 0; const big = [];
  for (const im of J.images ?? []) { const bv = J.bufferViews[im.bufferView]; const b = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength); const [w, h] = dims(b, im.mimeType);
    const k = im.mimeType; tex[k] ??= { n: 0, bytes: 0 }; tex[k].n++; tex[k].bytes += bv.byteLength; gpu += w * h * (k === 'image/ktx2' ? 1 : 4) * 1.33; big.push(`${w}x${h} ${(bv.byteLength / 1e6).toFixed(2)}MB ${im.name ?? ''}`); }
  const geoBytes = (J.bufferViews ?? []).filter((v, i) => !(J.images ?? []).some((im) => im.bufferView === i)).reduce((s, v) => s + v.byteLength, 0);
  console.log(JSON.stringify({ file: f.split(/[\/]/).slice(-2).join('/'), MB: +(statSync(f).size / 1e6).toFixed(2), tris: Math.round(tris), uniqueTris: Math.round(instTris), verts, draws, meshNodes: nodesWithMesh, materials: J.materials?.length, images: J.images?.length, tex: Object.fromEntries(Object.entries(tex).map(([k, v]) => [k.slice(6), `${v.n} / ${(v.bytes / 1e6).toFixed(1)}MB`])), geoMB: +(geoBytes / 1e6).toFixed(2), gpuTexMB_est: Math.round(gpu / 1e6), ext: J.extensionsUsed }));
  if (process.env.V) big.sort().forEach((s) => console.log('   ', s));
}
