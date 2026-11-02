// Is everything between a track's walls really drivable? Loads the real physics world in the browser and walks the whole lap, wall to wall:
// every invisible void wall standing inside the drivable area, every height step, and a car-sized box swept along the lap at every lateral
// position (the same box the car's body has): what stops it, and whether that thing can be seen. Exits 1 if anything inside the walls does.
//   node scripts/qa-lock.mjs -- node scripts/qa-drivable.mjs infinia [url=http://127.0.0.1:5180]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'infinia', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const STEP_LIMIT = 0.12;   // m: about what a low car's splitter clears
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = JSON.parse(readFileSync(join(root, 'public', 'assets', track, 'track.json'), 'utf8')).centerline;
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true });
const page = await browser.newPage();
await page.goto(base);
const res = await page.evaluate(async ({ track, C, STEP_LIMIT }) => {
  const { PhysicsWorld, initPhysics } = await import('/src/physics/world.js'), RAPIER = await initPhysics();   // the game's own wasm instance
  const url = `/assets/${track}/${track}_collision.glb`, plain = await PhysicsWorld.create(url), full = await PhysicsWorld.create(url, { voidWalls: true }), n = C.length;
  const left = (i) => { const a = C[(i + n - 1) % n], b = C[(i + 1) % n], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1; return [tz / l, -tx / l]; };
  const isWall = (w, c) => w.surfaceOf.get(c.handle)?.name === 'wall';
  // the real walls (col_wall only): how far from the centreline each side
  const reach = (i, sd) => { const [lx, lz] = left(i), p = C[i], h = plain.world.castRay(new RAPIER.Ray({ x: p[0], y: p[1] + 0.5, z: p[2] }, { x: lx * sd, y: 0, z: lz * sd }), 60, true, undefined, undefined, undefined, undefined, (c) => isWall(plain, c)); return h ? h.timeOfImpact : 40; };
  const groundAt = (x, z, y) => { const h = plain.world.castRay(new RAPIER.Ray({ x, y: y + 6, z }, { x: 0, y: -1, z: 0 }), 20, true, undefined, undefined, undefined, undefined, (c) => !isWall(plain, c)); return h ? y + 6 - h.timeOfImpact : null; };
  const R = { 1: C.map((_, i) => reach(i, 1)), [-1]: C.map((_, i) => reach(i, -1)) };
  const inside = [], V = full.voidWalls.v ?? [];
  for (let q = 0; q + 12 <= V.length; q += 12) {
    const mx = (V[q] + V[q + 3]) / 2, mz = (V[q + 2] + V[q + 5]) / 2; let best = 0, bd = 1e9;
    for (let i = 0; i < n; i++) { const d = Math.hypot(C[i][0] - mx, C[i][2] - mz); if (d < bd) { bd = d; best = i; } }
    const [lx, lz] = left(best), lat = (mx - C[best][0]) * lx + (mz - C[best][2]) * lz;
    if (V[q + 1] - C[best][1] < 1 && Math.abs(V[q + 1] + 1 - C[best][1]) < 6 && Math.abs(lat) < R[lat > 0 ? 1 : -1][best] - 0.6) inside.push({ station: best, lat: +lat.toFixed(1), len: +Math.hypot(V[q + 3] - V[q], V[q + 5] - V[q + 2]).toFixed(1), base: +(V[q + 1] + 1 - C[best][1]).toFixed(2) });
  }
  const steps = [], holes = [];
  for (let i = 0; i < n; i++) {
    const [lx, lz] = left(i), j = (i + 1) % n, [mx, mz] = left(j), p = C[i], q = C[j]; let prev = null;
    for (let lat = -(R[-1][i] - 0.6); lat <= R[1][i] - 0.6; lat += 1) {
      const g = groundAt(p[0] + lx * lat, p[2] + lz * lat, p[1]);
      if (g === null) { holes.push({ station: i, lat: +lat.toFixed(1) }); prev = null; continue; }
      if (prev !== null && Math.abs(g - prev) > STEP_LIMIT) steps.push({ station: i, lat: +lat.toFixed(1), dir: 'across', step: +(g - prev).toFixed(2), over: +(g - p[1]).toFixed(2) });
      const g2 = groundAt(q[0] + mx * lat, q[2] + mz * lat, q[1]);
      if (g2 !== null && Math.abs(g2 - g - (q[1] - p[1])) > STEP_LIMIT) steps.push({ station: i, lat: +lat.toFixed(1), dir: 'along', step: +(g2 - g - (q[1] - p[1])).toFixed(2), over: +(g - p[1]).toFixed(2) });
      prev = g;
    }
  }
  // the car's body: 4.6 x 2 x 0.6 m, its underside 32 cm over the ground (vehicle.js), swept one station along, in both worlds
  const box = new RAPIER.Cuboid(2.3, 0.3, 1.0), blocked = [];
  const sweep = (w, pos, rot, vel, len) => w.world.castShape(pos, rot, vel, box, 0, len, true);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, p = C[i], q = C[j], dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], len = Math.hypot(dx, dy, dz) || 1, [lx, lz] = left(i), yaw = -Math.atan2(dz, dx), rot = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    for (let lat = -(R[-1][i] - 1.3); lat <= R[1][i] - 1.3; lat += 1) {
      const x = p[0] + lx * lat, z = p[2] + lz * lat, g = groundAt(x, z, p[1]); if (g === null) continue;
      const pos = { x, y: g + 0.62, z }, vel = { x: dx / len, y: dy / len, z: dz / len }, hit = sweep(full, pos, rot, vel, len);
      if (!hit) continue;
      const name = full.surfaceOf.get(hit.collider.handle)?.name ?? '?', seen = !!sweep(plain, pos, rot, vel, len);
      blocked.push({ station: i, lat: +lat.toFixed(1), name, invisible: !seen, onRoad: Math.abs(lat) < 7, road: +p[1].toFixed(2), ground: +g.toFixed(2) });
    }
  }
  return { voidWalls: full.voidWalls.count, inside, steps, holes, blocked };
}, { track, C, STEP_LIMIT });
await browser.close();
const span = (l) => { const s = l.map((x) => x.station), lo = Math.min(...s), hi = Math.max(...s); return l.length ? `stations ${lo}-${hi}` : 'none'; };
console.log(`${track}: ${res.voidWalls} void walls; inside the drivable area ${res.inside.length} (${span(res.inside)}), steps over ${STEP_LIMIT} m ${res.steps.length} (${span(res.steps)}), holes ${res.holes.length} (${span(res.holes)})`);
console.log('void walls inside:', JSON.stringify(res.inside.slice(0, 40)));
console.log('steps:', JSON.stringify(res.steps.slice(0, 40)));
const bad = res.blocked.filter((b) => b.name === 'wall' && b.invisible), group = {};   // a straight box clips the ground on crests and dips: only an unseen wall counts
for (const b of bad) { const k = `${b.name}${b.invisible ? ' INVISIBLE' : ''}${b.onRoad ? ' ON ROAD' : ''}`; (group[k] ??= []).push(b); }
console.log(`car box stopped ${res.blocked.length} times; by an invisible wall: ${bad.length}`);
for (const [k, l] of Object.entries(group)) console.log(' ', k, l.length, span(l), JSON.stringify(l.slice(0, 12).map((b) => [b.station, b.lat, b.ground, b.road])));
const near = res.blocked.filter((b) => b.station >= 440 && b.station <= 500);
console.log('bridge landing (440-500):', near.length, JSON.stringify(near.slice(0, 30).map((b) => [b.station, b.lat, b.name, b.invisible ? 'inv' : 'seen'])));
process.exit(res.inside.length || bad.length ? 1 : 0);   // seams read as one-ray holes and are not fatal: a tyre's cast has width
