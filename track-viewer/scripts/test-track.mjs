// Engine contract test for the shipped track: loads the web collision GLB into Rapier (the physics the game will use)
// and checks it against track.json, then drives a raycast-vehicle lap on the racing line.
//   node scripts/test-track.mjs            exit code 1 on any failure
// Checks:
//   1. ground: a ray down at every centre-line sample, and at +-(half width - 0.4 m), hits col_asphalt (or col_pit)
//      within 0.25 m of the centre-line height;
//   2. walls: rays left and right at 0.5 m never hit anything inside the track's half width (nothing intrudes),
//      and openings (no wall within 80 m) are listed;
//   3. grid slots and the pit-lane polyline stand on asphalt / pit surface (its two end points may be tarmac run-off,
//      where the lane merges with the track);
//   4. a lap: a 1.4 t raycast vehicle follows the racing line with pure-pursuit steering and a grip-limited speed,
//      must pass every checkpoint in order without falling through or leaving the surface, and reports its lap time.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import RAPIER from '@dimforge/rapier3d-compat';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'tracks', 'marina', 'out');
const track = JSON.parse(readFileSync(join(out, 'track.json'), 'utf8'));
const failures = [];
const fail = (msg) => { failures.push(msg); };

// ------------------------------------------------------------------------------------------------ load collision

await MeshoptDecoder.ready;
await RAPIER.init();
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(join(out, 'web', 'marina_collision.glb'));
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const surfaceOf = new Map();          // collider handle -> surface name (col_asphalt ...)
let tris = 0;
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices();
    const v = new Float32Array(pos.getCount() * 3), e = [0, 0, 0];
    for (let k = 0; k < pos.getCount(); k++) {
      pos.getElement(k, e);            // gltf-transform denormalises quantised attributes
      v[k * 3] = m[0] * e[0] + m[4] * e[1] + m[8] * e[2] + m[12];
      v[k * 3 + 1] = m[1] * e[0] + m[5] * e[1] + m[9] * e[2] + m[13];
      v[k * 3 + 2] = m[2] * e[0] + m[6] * e[1] + m[10] * e[2] + m[14];
    }
    const ind = idx ? Uint32Array.from(idx.getArray()) : Uint32Array.from({ length: pos.getCount() }, (_, k) => k);
    tris += ind.length / 3;
    const col = world.createCollider(RAPIER.ColliderDesc.trimesh(v, ind).setFriction(1.0));
    surfaceOf.set(col.handle, node.getName());
  }
}
world.step();                      // builds the query pipeline (rays see nothing before the first step)
console.log(`collision: ${surfaceOf.size} surfaces, ${tris} triangles: ${[...new Set(surfaceOf.values())].join(', ')}`);

function cast(o, d, maxToi = 50, exclude) {
  const hit = world.castRay(new RAPIER.Ray(o, d), maxToi, true, undefined, undefined, exclude);
  if (!hit) return null;
  return { toi: hit.timeOfImpact ?? hit.toi, surface: surfaceOf.get(hit.collider.handle) };
}

// ------------------------------------------------------------------------------------------------ 1-3: static checks

const c = track.centerline, n = c.length, hw = track.halfWidth;
const leftOf = (i) => {
  const a = c[(i - 1 + n) % n], b = c[(i + 1) % n];
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
  return [dz / L, -dx / L];         // game: x east, -z north; +lateral = left of travel
};
const ROAD = new Set(['col_asphalt', 'col_pit']);
let groundBad = 0, heightBad = 0;
for (let i = 0; i < n; i++) {
  const [lx, lz] = leftOf(i);
  for (const lat of [0, hw[i] - 0.4, -(hw[i] - 0.4)]) {
    const o = { x: c[i][0] + lx * lat, y: c[i][1] + 3, z: c[i][2] + lz * lat };
    const h = cast(o, { x: 0, y: -1, z: 0 }, 10);
    if (!h || !ROAD.has(h.surface)) { groundBad++; if (groundBad <= 5) fail(`ground: sample ${i} lat ${lat.toFixed(1)}: ${h ? h.surface : 'no hit'}`); continue; }
    if (lat === 0 && Math.abs(3 - h.toi) > 0.25) { heightBad++; if (heightBad <= 5) fail(`height: sample ${i}: ${(3 - h.toi).toFixed(2)} m off`); }
  }
}
if (groundBad > 5) fail(`ground: ${groundBad} bad rays in total`);
if (heightBad > 5) fail(`height: ${heightBad} samples off in total`);

let intrude = 0;
const openings = { L: [], R: [] };
for (let i = 0; i < n; i++) {
  const [lx, lz] = leftOf(i);
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const h = cast({ x: c[i][0], y: c[i][1] + 0.5, z: c[i][2] }, { x: lx * s, y: 0, z: lz * s }, 80);
    if (!h) { openings[side].push(i); continue; }
    if (h.toi < hw[i] - 0.05 && h.surface === 'col_wall') { intrude++; if (intrude <= 5) fail(`wall inside the track: sample ${i} ${side} at ${h.toi.toFixed(2)} m (half width ${hw[i]})`); }
  }
}
// run-off: halfway between the track edge and the wall (or 10 m out where there is none) is drivable ground
const DRIVABLE = new Set(['col_grass', 'col_sand', 'col_runoff_tarmac', 'col_paved', 'col_curb', 'col_pit', 'col_asphalt']);
let runoffBad = 0;
const runoffW = [];
for (let i = 0; i < n; i++) {
  const [lx, lz] = leftOf(i);
  for (const s of [1, -1]) {
    const w = cast({ x: c[i][0], y: c[i][1] + 0.5, z: c[i][2] }, { x: lx * s, y: 0, z: lz * s }, 80);
    const wall = w && w.surface === 'col_wall' ? w.toi : hw[i] + 20;
    runoffW.push(wall - hw[i]);
    const lat = s * (hw[i] + wall) / 2;
    const h = cast({ x: c[i][0] + lx * lat, y: c[i][1] + 3, z: c[i][2] + lz * lat }, { x: 0, y: -1, z: 0 }, 10);
    if (!h || !DRIVABLE.has(h.surface)) { runoffBad++; if (runoffBad <= 5) fail(`run-off: sample ${i} lat ${lat.toFixed(1)}: ${h ? h.surface : 'no hit'}`); }
  }
}
if (runoffBad > 5) fail(`run-off: ${runoffBad} bad rays in total`);
runoffW.sort((a, b) => a - b);
console.log(`run-off edge to wall: median ${runoffW[runoffW.length >> 1].toFixed(1)} m, 90th pct ${runoffW[Math.floor(runoffW.length * 0.9)].toFixed(1)} m`);
const runs = (a) => a.reduce((r, i) => { const l = r[r.length - 1]; if (l && i === l[1] + 1) l[1] = i; else r.push([i, i]); return r; }, []);
for (const side of ['L', 'R']) {
  const r = runs(openings[side]);
  if (r.length) console.log(`openings ${side} (no wall within 80 m): ${r.map(([a, b]) => a === b ? a : `${a}-${b}`).join(', ')}`);
}

for (const g of track.start.gridSlots) {
  const h = cast({ x: g.pos[0], y: g.pos[1] + 3, z: g.pos[2] }, { x: 0, y: -1, z: 0 }, 10);
  if (!h || h.surface !== 'col_asphalt') fail(`grid slot ${g.slot}: ${h ? h.surface : 'no ground'}`);
}
let pitBad = 0;
track.pitLane.polyline.forEach((p, k) => {
  const h = cast({ x: p[0], y: p[1] + 3, z: p[2] }, { x: 0, y: -1, z: 0 }, 10);
  const end = k === 0 || k === track.pitLane.polyline.length - 1;   // entry and exit merge across the tarmac run-off
  if (!h || !(ROAD.has(h.surface) || (end && h.surface === 'col_runoff_tarmac'))) { pitBad++; console.log(`pit lane point ${k}/${track.pitLane.polyline.length}: ${h ? h.surface : 'no ground'}`); }
});
if (pitBad) fail(`pit lane: ${pitBad}/${track.pitLane.polyline.length} polyline points not on asphalt/pit`);
console.log(`static: ground ${groundBad} bad, height ${heightBad} off, walls intruding ${intrude}, grid ${track.start.gridSlots.length} slots, pit ${pitBad} bad`);

// ------------------------------------------------------------------------------------------------ 4: a lap

const rl = track.racingLine;
const line = c.map((p, i) => { const [lx, lz] = leftOf(i); return [p[0] + lx * rl[i], p[1], p[2] + lz * rl[i]]; });
// curvature from three points, smoothed: the grip-limited speed at each sample, then a braking pass backwards
const kappa = line.map((_, i) => {
  const a = line[(i - 3 + n) % n], b = line[i], d = line[(i + 3) % n];
  const ab = Math.hypot(b[0] - a[0], b[2] - a[2]), bd = Math.hypot(d[0] - b[0], d[2] - b[2]), ad = Math.hypot(d[0] - a[0], d[2] - a[2]);
  const cross = Math.abs((b[0] - a[0]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[0] - a[0]));
  return (2 * cross) / Math.max(1e-6, ab * bd * ad);
});
const A_LAT = 8.0, A_BRAKE = 7.0, VMAX = 62;
const vt = kappa.map((k) => Math.min(VMAX, Math.sqrt(A_LAT / Math.max(k, 1e-4))));
for (let pass = 0; pass < 2; pass++)
  for (let i = 2 * n - 1; i >= 0; i--) {
    const a = i % n, b = (i + 1) % n;
    vt[a] = Math.min(vt[a], Math.sqrt(vt[b] ** 2 + 2 * A_BRAKE * track.spacing));
  }

const startI = track.start.gridSlots[0].centerlineIdx;
const sp = line[startI];
const yaw0 = Math.atan2(-(line[(startI + 1) % n][2] - sp[2]), line[(startI + 1) % n][0] - sp[0]);   // +x forward
const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(sp[0], sp[1] + 0.9, sp[2])
  .setRotation({ x: 0, y: Math.sin(yaw0 / 2), z: 0, w: Math.cos(yaw0 / 2) }).setCanSleep(false));
const chassis = world.createCollider(RAPIER.ColliderDesc.cuboid(2.2, 0.35, 0.95).setMass(1400).setTranslation(0, 0.1, 0), body);
const car = world.createVehicleController(body);
car.indexUpAxis = 1;
car.setIndexForwardAxis = 0;
const WHEELS = [[1.4, 0.82], [1.4, -0.82], [-1.35, 0.82], [-1.35, -0.82]];
WHEELS.forEach(([x, z]) => {
  car.addWheel({ x, y: -0.1, z }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, 0.3, 0.34);
});
WHEELS.forEach((_, k) => {
  car.setWheelSuspensionStiffness(k, 32);
  car.setWheelSuspensionCompression(k, 2.8);
  car.setWheelSuspensionRelaxation(k, 3.2);
  car.setWheelMaxSuspensionTravel(k, 0.25);
  car.setWheelFrictionSlip(k, 3.2);
  car.setWheelSideFrictionStiffness(k, 1.6);
});

const DT = 1 / 60;
let t = 0, idx = startI, nextCp = 0, laps = 0, maxErr = 0, worst = -1, lowest = Infinity, lapT0 = null;
const cps = track.checkpoints;
const nearest = (p, from) => {             // search forward a little from the last index
  let best = from, bd = Infinity;
  for (let k = -5; k < 40; k++) {
    const j = (from + k + n) % n, d = (line[j][0] - p.x) ** 2 + (line[j][2] - p.z) ** 2;
    if (d < bd) { bd = d; best = j; }
  }
  return [best, Math.sqrt(bd)];
};
const offTrack = [];
while (t < 600 && laps < 1) {
  const p = body.translation(), q = body.rotation();
  const [i, err] = nearest(p, idx);
  // lap logic: checkpoints in order, start counting when the car first crosses checkpoint 0 (the line)
  if (i < idx - n / 2) { /* wrapped */ }
  idx = i;
  const target = cps[nextCp];
  if (Math.abs(i - target) <= 2 || (nextCp === 0 && i < 3)) {
    if (nextCp === 0 && lapT0 === null) lapT0 = t;
    else if (nextCp === 0) laps++;
    nextCp = (nextCp + 1) % cps.length;
  }
  // lateral distance from the centre line: is the car still on the tarmac?
  const [lx, lz] = leftOf(i);
  const lat = (p.x - c[i][0]) * lx + (p.z - c[i][2]) * lz;
  if (Math.abs(lat) > hw[i] + 1.2) offTrack.push(i);
  if (err > maxErr) { maxErr = err; worst = i; }
  lowest = Math.min(lowest, p.y - c[i][1]);
  // pure pursuit: look ahead with speed, steer toward that point in the car's frame
  const v = car.currentVehicleSpeed();
  const ahead = Math.max(3, Math.round((6 + Math.abs(v) * 0.55) / track.spacing));
  const g = line[(i + ahead) % n];
  const fw = { x: 1 - 2 * (q.y * q.y + q.z * q.z), z: 2 * (q.x * q.z - q.w * q.y) };   // local +x in world (y-rotation)
  const toX = g[0] - p.x, toZ = g[2] - p.z;
  const alpha = Math.atan2(fw.x * toZ - fw.z * toX, fw.x * toX + fw.z * toZ);           // + = target to the right (+z)
  const Ld = Math.hypot(toX, toZ);
  const steer = Math.max(-0.5, Math.min(0.5, -Math.atan2(2 * 2.75 * Math.sin(alpha), Ld)));
  car.setWheelSteering(0, steer); car.setWheelSteering(1, steer);
  const want = vt[(i + 3) % n];
  const force = v < want ? Math.min(1, (want - v) * 0.5) * 6500 : 0;
  const brake = v > want + 0.5 ? Math.min(1, (v - want) * 0.15) * 60 : 0;
  for (let k = 0; k < 4; k++) { car.setWheelEngineForce(k, k >= 2 ? force : 0); car.setWheelBrake(k, brake); }
  car.updateVehicle(DT, undefined, undefined, (col) => col.handle !== chassis.handle);
  world.step();
  t += DT;
  if (p.y < c[i][1] - 3) { fail(`lap: fell through the world at sample ${i}, t ${t.toFixed(1)} s`); break; }
}
const lapTime = lapT0 === null ? null : t - lapT0;
if (laps < 1) fail(`lap: not completed in 600 s (next checkpoint ${nextCp}/${cps.length}, at sample ${idx})`);
if (offTrack.length) fail(`lap: left the tarmac at ${runs([...new Set(offTrack)].sort((a, b) => a - b)).map(([a, b]) => `${a}-${b}`).join(', ')}`);
console.log(`lap: ${laps ? lapTime.toFixed(1) + ' s' : 'incomplete'} (${(track.lapLength / (lapTime || 1) * 3.6).toFixed(0)} km/h average), ` +
  `max ${maxErr.toFixed(1)} m off the racing line at sample ${worst}, lowest chassis ${lowest.toFixed(2)} m above the road`);

if (failures.length) {
  console.error(`\nFAIL (${failures.length}):\n  ` + failures.join('\n  '));
  process.exit(1);
}
console.log('\nPASS');
