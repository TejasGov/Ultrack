// Clearance check for Tokyo's set pieces (src/venue/tokyo/torii.js, holograms.js): nothing stands on or over the road, beyond the collision walls and
// the barriers' sponsor boards, and the torii keep their 8 m of headroom and 5-8 m spacing. Reads track.json and the collision mesh; no browser.
//   node scripts/check-tokyo-setpieces.mjs          exits 1 when a check fails
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { CORRIDOR, gatePoses } from '../src/venue/tokyo/torii.js';
import { HOLOS } from '../src/venue/tokyo/holograms.js';

const dir = new URL('../public/assets/tokyo/', import.meta.url);
const track = JSON.parse(readFileSync(new URL('track.json', dir), 'utf8'));
await MeshoptDecoder.ready;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(new URL('tokyo_collision.glb', dir).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const wall = [];                                                         // world-space vertices of col_wall
for (const n of doc.getRoot().listNodes()) {
  if (n.getName() !== 'col_wall' || !n.getMesh()) continue;
  const w = n.getWorldMatrix(), t = [0, 0, 0];
  for (const p of n.getMesh().listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, t); wall.push([w[0] * t[0] + w[4] * t[1] + w[8] * t[2] + w[12], w[1] * t[0] + w[5] * t[1] + w[9] * t[2] + w[13], w[2] * t[0] + w[6] * t[1] + w[10] * t[2] + w[14]]); } }
}
const C = track.centerline;
const nearest = (x, z, list, d = (a) => a) => { let b = 1e9, bi = -1; for (let i = 0; i < list.length; i++) { const p = d(list[i]), r = Math.hypot(p[0] - x, p[2] - z); if (r < b) { b = r; bi = i; } } return [b, bi]; };
// a point's distance to the centerline polyline (segments, not just samples)
const toLine = (x, z) => { let b = 1e9; for (let i = 0; i < C.length; i++) { const a = C[i], c = C[(i + 1) % C.length], dx = c[0] - a[0], dz = c[2] - a[2], f = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1))); b = Math.min(b, Math.hypot(x - a[0] - dx * f, z - a[2] - dz * f)); } return b; };
const fails = [], ok = (cond, msg) => { if (!cond) fails.push(msg); return cond; };
const BOARD_EDGE = 16.5;          // m: the outer edge of the barriers' sponsor boards (measured on the venue geometry)

// torii
const poses = gatePoses(C, CORRIDOR);
ok(poses.length >= 20, `torii: only ${poses.length} gates`);
let minWallGap = 1e9, minLat = 1e9, minSp = 1e9, maxSp = 0, roadYmin = 1e9;
poses.forEach((g, i) => {
  if (i) { const s = Math.hypot(g.x - poses[i - 1].x, g.z - poses[i - 1].z); minSp = Math.min(minSp, s); maxSp = Math.max(maxSp, s); }
  roadYmin = Math.min(roadYmin, g.y);
  for (const sx of [-1, 1]) {
    const px = g.x + Math.cos(g.yaw) * sx * CORRIDOR.half, pz = g.z - Math.sin(g.yaw) * sx * CORRIDOR.half;     // local +X is (cos yaw, 0, -sin yaw)
    const lat = toLine(px, pz); minLat = Math.min(minLat, lat - CORRIDOR.pillarR);
    const [dw] = nearest(px, pz, wall); minWallGap = Math.min(minWallGap, dw - CORRIDOR.pillarR);
  }
});
const len = Math.hypot(poses[0].x - poses.at(-1).x, poses[0].z - poses.at(-1).z);
console.log(`torii: ${poses.length} gates over ~${len.toFixed(0)} m, spacing ${minSp.toFixed(2)}-${maxSp.toFixed(2)} m, pillar face >= ${minLat.toFixed(2)} m from the centerline, >= ${minWallGap.toFixed(2)} m from col_wall, lowest beam ${CORRIDOR.nukiBottom} m over the road, road y >= ${roadYmin.toFixed(1)}`);
ok(minSp >= 5 && maxSp <= 8, 'torii: spacing outside 5-8 m');
ok(CORRIDOR.nukiBottom >= 8.5, 'torii: lowest beam under 8.5 m');
ok(minLat >= BOARD_EDGE + 1.5, `torii: a pillar face is ${minLat.toFixed(1)} m from the centerline (needs >= ${BOARD_EDGE + 1.5})`);
ok(minWallGap >= 4, 'torii: a pillar is within 4 m of a collision wall');
ok(roadYmin > -1, 'torii: a gate stands in the tunnel');
ok(CORRIDOR.from > 70 && CORRIDOR.to < 1370, 'torii: on the start straight');

// holograms: base disc and the figure's half-width clear of the road, the walls and the boards
for (const h of HOLOS) {
  const half = Math.max(2.4, (h.h * 576 / 1024) * 0.5), lat = toLine(h.base[0], h.base[2]), [dw] = nearest(h.base[0], h.base[2], wall);
  console.log(`hologram ${h.id}: base ${lat.toFixed(1)} m from the centerline (figure edge ${(lat - half).toFixed(1)} m), ${dw.toFixed(1)} m from the nearest wall vertex`);
  ok(lat - half >= 14, `hologram ${h.id}: the figure reaches ${(lat - half).toFixed(1)} m from the centerline`);
  ok(dw - half >= 2, `hologram ${h.id}: within ${(dw - half).toFixed(1)} m of a collision wall`);
}
if (fails.length) { console.error('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('set-piece clearance: ok');
