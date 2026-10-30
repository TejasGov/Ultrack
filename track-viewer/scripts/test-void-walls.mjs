// India's invisible void walls (physics/world.js voidWalls, tracks.js voidWalls): from 20 m out on the grass, both sides of every
// 10th station, a probe marches outward over the collision ground like a car; with the walls it must never reach a void.
//   node scripts/test-void-walls.mjs        (the dev server on :5180 serves the collision mesh)
import assert from 'node:assert';
globalThis.ProgressEvent ??= class { constructor(t, i) { this.type = t; Object.assign(this, i); } };
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../src/physics/world.js';
const b = await fetch('http://127.0.0.1:5180/assets/india/india_collision.glb').then((r) => r.arrayBuffer()), t = await fetch('http://127.0.0.1:5180/assets/india/track.json').then((r) => r.json());
const url = 'data:model/gltf-binary;base64,' + Buffer.from(b).toString('base64'), C = t.centerline, N = C.length;
for (const walls of [false, true]) {
  const pw = await PhysicsWorld.create(url, { voidWalls: walls });
  let escapes = 0, tested = 0; const where = [];
  for (let i = 0; i < N; i += 10) for (const sd of [1, -1]) {
    const p = C[i], q = C[(i + 2) % N], r = C[(i - 2 + N) % N], tx = q[0] - r[0], tz = q[2] - r[2], l = Math.hypot(tx, tz), ox = tz / l * sd, oz = -tx / l * sd;
    // a car-sized probe: from 20 m out on the grass, 1 m up, outward 60 m; does it meet any wall before leaving the ground?
    const o = { x: p[0] + ox * 20, y: p[1] + 1, z: p[2] + oz * 20 }; tested++;
    const down = pw.world.castRay(new RAPIER.Ray(o, { x: 0, y: -1, z: 0 }), 6, true); if (!down) { tested--; continue; }       // not on ground there
    // march outward over the ground like a car: 1 m steps, a wall test between steps at 1 m over the ground; a void before any wall = escape
    let fell = false, gy = down ? o.y - 1 - ((down.timeOfImpact ?? down.toi) - 1) : o.y - 1;
    for (let s = 1; s <= 60; s++) {
      const a = { x: o.x + ox * (s - 1), y: gy + 1, z: o.z + oz * (s - 1) };
      if (pw.world.castRay(new RAPIER.Ray(a, { x: ox, y: 0, z: oz }), 1, true)) break;
      const g = pw.world.castRay(new RAPIER.Ray({ x: o.x + ox * s, y: gy + 30, z: o.z + oz * s }, { x: 0, y: -1, z: 0 }), 45, true);
      if (!g) { fell = true; break; }
      gy = gy + 30 - (g.timeOfImpact ?? g.toi);
    }
    if (fell) { escapes++; if (where.length < 6) where.push(`st${i}${sd > 0 ? 'L' : 'R'}`); }
  }
  if (walls) assert.equal(escapes, 0, 'a car on the grass can reach the void at ' + where.join(' ')); else assert.ok(escapes > 0, 'the probe no longer finds the corridor edge');
  console.log(walls ? 'with void walls' : 'without      ', `| ${tested} probes from the grass outward: ${escapes} reach a void before any wall`, where.join(' '));
  pw.dispose();
}
