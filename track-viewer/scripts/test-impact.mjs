// Wheel contact queries: ride height at rest, step cost (8 cars x 4 wheels), barrier impact and kerb lift.
//   node scripts/test-impact.mjs [--bench-only]     (--trace prints per-wheel comp/contact through the impacts)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)), TRACE = process.argv.includes('--trace');
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { Vehicle } = await server.ssrLoadModule('/src/physics/vehicle.js');
  const WM = await server.ssrLoadModule('/src/physics/world.js'), { PhysicsWorld, STEP } = WM;
  const { handling } = await server.ssrLoadModule('/src/physics/handling.js');
  const profile = JSON.parse(readFileSync(new URL('../../car-lab/src/vehicle/profiles/av12.json', import.meta.url), 'utf8'));
  const assist = { counter: 0.35, stability: 1, tcs: 0.6 };
  const mk = (w, x, z = 0) => new Vehicle(w, handling('av12'), profile, { pos: new THREE.Vector3(x, 0, z), yaw: 0 });
  const run = (w, cars, s, each) => { for (let i = 0; i < s / STEP; i++) { for (const c of cars) c.step(STEP, assist); w.world.step(); each?.(i); } };
  const f = (n, d = 3) => n.toFixed(d);

  // 1. ride height at rest + step cost
  const flat = await PhysicsWorld.flat(3000), cars = [];
  for (let i = 0; i < 8; i++) cars.push(mk(flat, 0, i * 6));
  run(flat, cars, 1.5);
  console.log('rest ride y', f(cars[0].cur.pos.y, 4), 'comp', cars[0].wheels.map((w) => f(w.comp, 4)).join(' '), 'contact', cars[0].wheels.map((w) => +w.contact).join(''));
  const flatComp = cars[0].wheels[0].comp;
  for (const c of cars) c.rb.setLinvel({ x: 30, y: 0, z: 0 }, true);
  run(flat, cars, 0.5);
  const n = 1200, t0 = performance.now(); run(flat, cars, n * STEP); const dt = performance.now() - t0;
  console.log(`bench: ${(dt / n).toFixed(3)} ms per step (8 cars) , ${(dt / n / 8 * 1000).toFixed(1)} us per car-step`);
  if (process.argv.includes('--bench-only')) process.exit(0);

  // 2. barrier impact: a 30 cm roadblock, car at ~100 km/h
  const w2 = await PhysicsWorld.flat(3000);
  w2.world.createCollider(WM.RAPIER.ColliderDesc.cuboid(0.25, 0.15, 8).setTranslation(60, 0.15, 0));
  const car = mk(w2, 0); run(w2, [car], 1); car.rb.setLinvel({ x: 27.8, y: 0, z: 0 }, true);
  let minContact = 4, maxLift = 0, hit = false, rows = [];
  run(w2, [car], 4, (i) => {
    const near = car.cur.pos.x > 56; hit ||= near && car.speed < 20;
    if (near) { minContact = Math.min(minContact, car.onGround); maxLift = Math.max(maxLift, car.cur.pos.y); }
    if (TRACE && car.cur.pos.x > 55 && (car.onGround < 4 || car.wheels.some((w) => w.comp > 0.12)) && rows.length < 40) rows.push(`t=${f(i * STEP, 3)} x=${f(car.cur.pos.x, 2)} y=${f(car.cur.pos.y)} v=${f(car.speed * 3.6, 0)} comp[${car.wheels.map((w) => f(w.comp, 3)).join(' ')}] contact[${car.wheels.map((w) => +w.contact).join('')}]`);
  });
  if (TRACE) console.log(rows.join('\n'));
  console.log(`barrier: slowed=${hit} minContacts=${minContact} maxY=${f(maxLift)}`);
  assert(minContact <= 2, "wheels that strike the roadblock lose contact (a ray reads the road under it: 4)");

  // 3. kerb: a 10 cm step across the road; the wheel must be pushed up (comp rises) as it climbs it
  const w3 = await PhysicsWorld.flat(3000);
  w3.world.createCollider(WM.RAPIER.ColliderDesc.cuboid(1, 0.05, 6).setTranslation(40, 0.05, 0));
  const c3 = mk(w3, 0); run(w3, [c3], 1); c3.rb.setLinvel({ x: 20, y: 0, z: 0 }, true);
  let peak = 0, y0 = c3.cur.pos.y, rows3 = [];
  run(w3, [c3], 2.5, (i) => {
    peak = Math.max(peak, ...c3.wheels.slice(0, 2).map((w) => w.comp));
    if (TRACE && c3.cur.pos.x > 37 && i % 6 === 0 && rows3.length < 25) rows3.push(`x=${f(c3.cur.pos.x, 2)} y=${f(c3.cur.pos.y)} comp[${c3.wheels.map((w) => f(w.comp, 3)).join(' ')}] contact[${c3.wheels.map((w) => +w.contact).join('')}]`);
  });
  if (TRACE) console.log(rows3.join('\n'));
  console.log(`kerb: peak front comp=${f(peak)} (flat rest ${f(c3.wheels[0].staticLoad ? 0.065 : 0)})`);
  assert(peak > 0.1, 'kerb pushes the wheel up');
  assert(Math.abs(flatComp - 0.065) < 0.002, "flat-road comp unchanged");
} catch (e) { console.error(e); process.exitCode = 1; } finally { await server.close(); process.exit(process.exitCode ?? 0); }
