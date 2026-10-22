// Rapier castShape(stopAtPenetration) of a wheel cylinder starting inside a trimesh wall: result + cost
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init(); const w = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const V = [], I = []; // a thin vertical wall slab 0.3 thick, 30 long, 1 high, tessellated 60x1
const N = 200; for (let i = 0; i <= N; i++) for (const y of [0, 1]) for (const z of [-0.15, 0.15]) V.push(i * 0.15, y, z);
for (let i = 0; i < N; i++) { const b = i * 4; for (const [a, c, d] of [[0,4,1],[1,4,5],[2,3,6],[3,7,6],[0,2,4],[2,6,4],[1,5,3],[3,5,7]]) I.push(b + a, b + c, b + d); }
w.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(V), new Uint32Array(I)));
const cyl = new RAPIER.Cylinder(0.12, 0.33), q = new RAPIER.Quaternion(0.7071, 0, 0, 0.7071), dir = { x: 0, y: -1, z: 0 };
for (const dz of [0, 0.05, 0.2, 0.3, 0.6]) { const t = performance.now(); let r; for (let k = 0; k < 1000; k++) r = w.castShape({ x: 15, y: 0.5, z: dz }, q, dir, cyl, 0, 0.5, true);
  console.log('dz', dz, ((performance.now() - t)).toFixed(1) + 'us/call', r && [r.time_of_impact, r.normal1.x, r.normal1.y, r.normal1.z]); }
