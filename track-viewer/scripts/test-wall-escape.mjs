// A car on the outside barrier of a corner with the throttle down and the wheel turned away from the wall: does it come off, and what speed does the wall take? Rookie assists, a wall built
// as the tracks' are (one-sided trimesh faces, both ways). Prints a table for the wall's friction.   node scripts/test-wall-escape.mjs [--mu 0.35,0.1]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)), arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { Vehicle } = await server.ssrLoadModule('/src/physics/vehicle.js');
  const WM = await server.ssrLoadModule('/src/physics/world.js'), { PhysicsWorld, STEP } = WM;
  const { handling } = await server.ssrLoadModule('/src/physics/handling.js');
  const assist = { counter: 0.45, stability: 1.25, tcs: 0.8 };
  const profile = JSON.parse(readFileSync(new URL('../../car-lab/src/vehicle/profiles/av12.json', import.meta.url), 'utf8'));
  const ring = (w, R, mu) => { const RAPIER = WM.RAPIER;
    const n = Math.round(2 * Math.PI * R / 6), v = [], a = [], b = [];
    for (let i = 0; i < n; i++) { const t = i / n * 2 * Math.PI, x = Math.cos(t) * R, z = Math.sin(t) * R; v.push(x, 0, z, x, 1.2, z); }
    for (let i = 0; i < n; i++) { const p = i * 2, q = ((i + 1) % n) * 2; a.push(p, p + 1, q, q, p + 1, q + 1); b.push(p, q, p + 1, q, q + 1, p + 1); }
    for (const f of [a, b]) { const col = w.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(v), new Uint32Array(f), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(mu).setRestitution(0.15)); w.surfaceOf.set(col.handle, WM.SURFACES.col_wall); }
  };
  const run = async ({ R, kmh, mu, steer = -1, seconds = 5 }) => {
    const w = await PhysicsWorld.flat(4000); ring(w, R, mu);
    // anticlockwise seen from above at (R - gap, 0, 0), heading -z... the wall on the car's right: the wheel turned left comes off it
    const gap = 1.1, x0 = R - gap, yaw = Math.PI / 2, q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), v0 = kmh / 3.6;
    const car = new Vehicle(w, handling('av12'), profile, { pos: new THREE.Vector3(x0, 0, 0), yaw });
    car.collider.setFriction(mu);
    for (let i = 0; i < 0.4 / STEP; i++) { car.rb.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true); car.rb.setAngvel({ x: 0, y: 0, z: 0 }, true); const p = car.rb.translation(); car.rb.setTranslation({ x: x0, y: p.y, z: 0 }, true); car.step(STEP, assist); w.world.step(); }
    car.rb.setLinvel({ x: 0, y: 0, z: -v0 }, true);
    let on = 0, firstOff = null, lowest = kmh, stuckEnd = false, off = 0;
    for (let i = 0; i < seconds / STEP; i++) {
      Object.assign(car.controls, { throttle: 1, brake: 0, handbrake: 0, nitro: 0, steer: -steer });   // positive steer is left
      car.step(STEP, assist); w.world.step();
      const r = Math.hypot(car.cur.pos.x, car.cur.pos.z), g = R - r, touching = g < car.half.z + 0.5;
      if (touching) { on += STEP; off = 0; } else { off += STEP; if (off > 0.3) firstOff ??= i * STEP; }
      lowest = Math.min(lowest, car.speed * 3.6); stuckEnd = touching;
      if (process.env.TRACE && i % 30 === 0) { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(car.cur.quat.x, car.cur.quat.y, car.cur.quat.z, car.cur.quat.w), 'YXZ'), t = Math.atan2(car.cur.pos.x, car.cur.pos.z), wallYaw = t + Math.PI / 2 - Math.PI; console.log(`  t ${(i * STEP).toFixed(2)} ${(car.speed * 3.6).toFixed(0)} km/h gap ${g.toFixed(2)} into-wall ${(((e.y - Math.atan2(-car.cur.pos.z, car.cur.pos.x) - Math.PI/2 + 3*Math.PI) % (2*Math.PI) - Math.PI) * 57.3).toFixed(1)} beta ${(car.state.beta * 57.3).toFixed(1)} rackSteer ${(car.state.steer * 57.3).toFixed(1)} contact ${car.wheels.map((x) => +x.contact).join('')} comp ${car.wheels.map((x) => x.comp.toFixed(2)).join(' ')} slip ${car.wheels.map((x) => x.slip.toFixed(1)).join(' ')} drift ${car.state.drift.toFixed(2)} esc ${car.state.escActive.toFixed(2)} tcs ${car.state.tcsActive.toFixed(2)} roll ${(e.z * 57.3).toFixed(1)}/${(e.x * 57.3).toFixed(1)}`); }
    }
    return { end: Math.round(car.speed * 3.6), lowest: Math.round(lowest), on: +on.toFixed(2), off: firstOff === null ? 'never' : +firstOff.toFixed(2), wallAtEnd: stuckEnd };
  };
  const mus = arg('--mu', '0.35').split(',').map(Number);
  for (const [R, kmh] of (process.env.TRACE ? [[200, 200]] : [[60, 110], [100, 130], [100, 170], [200, 200], [200, 240]])) {
    console.log(`R ${R} m, ${kmh} km/h, throttle down, wheel full away:`);
    for (const mu of mus) { const r = await run({ R, kmh, mu }); console.log(`  wall friction ${String(mu).padEnd(4)}`, JSON.stringify(r)); if (mu === 0.35 && R >= 100) { assert.ok(r.on < 1.6, `R ${R} at ${kmh}: off the wall quickly, not ${r.on} s`); assert.ok(r.lowest > kmh * 0.9, `R ${R} at ${kmh}: keeps its speed, lowest ${r.lowest}`); } }
  }
} catch (e) { console.error(e); process.exitCode = 1; } finally { await server.close(); process.exit(process.exitCode ?? 0); }
