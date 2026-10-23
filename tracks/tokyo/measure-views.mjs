// Budget at the five review viewpoints (start line, neon street, bridge, tunnel, garden road): node tracks/tokyo/measure-views.mjs [glb]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const glb = process.argv[2] ?? join(dir, 'out', 'web', 'tokyo_visual_ktx2.glb');
const track = JSON.parse(readFileSync(join(dir, 'out', 'track.json'), 'utf8'));
const C = track.centerline;
const P = (i) => C[((i % C.length) + C.length) % C.length];
const views = { 'start line': [0, 3], 'neon street': [207, 262], bridge: [642, 685], tunnel: [1003, 1060], 'west straight': [60, 100] };
const rows = {};
for (const [name, [a, b]] of Object.entries(views)) {
  const p = P(a), q = P(b);
  const yaw = Math.atan2(q[0] - p[0], q[2] - p[2]);
  const out = JSON.parse(execFileSync(process.execPath, [join(dir, 'measure-glb.mjs'), glb, '--camera', `${p[0]},${p[1] + 2.5},${p[2]}`, '--yaw', String(yaw)], { encoding: 'utf8', maxBuffer: 1 << 26 }));
  rows[name] = { submitted_tris: out.drawn_submitted_triangles, in_frustum_tris: out.drawn_in_frustum_triangles, draw_calls_submitted: out.draw_calls_submitted, draw_calls_in_frustum: out.draw_calls_in_frustum };
  rows._file = { unique_triangles: out.unique_triangles, total_triangles_all_instances: out.total_triangles_all_instances, meshes: out.meshes, instanced_nodes: out.instanced_nodes, materials: out.materials, textures: out.textures };
}
console.log(JSON.stringify(rows, null, 1));
writeFileSync(join(dir, 'out', 'v13_1-budget.json'), JSON.stringify(rows, null, 1));
