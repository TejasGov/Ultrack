// Headless quick races (no browser): the real physics, the real AI driver, the quick race's field and grid, many times over, to measure how
// often a player wins. Loads src/ through Vite's SSR loader; reads the collision meshes from public/assets (npm run sync).
//   node scripts/race-sim.mjs --car bmw1 --tracks india,shajawa --races 3 --skill 1.0 --difficulty hard [--laps 3] [--assist rookie]
// The player is a stand-in: the AI driver on the player's car at pace `skill` (1.00 = the speed plan the AI follows at pace 1), the player's
// assists, nitro on the straights as a rival fires it (a full tank lasts ~4.5 s), from the back of the grid as in the game. Each race draws the
// stand-in's pace from skill +-`spread` (a person is not the same every race) and the field's pace jitter from the seed, so a track is run more
// than once. Output: per track the finishing positions, and the win share over everything.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

globalThis.ProgressEvent ??= class { constructor(t, i) { this.type = t; Object.assign(this, i); } };
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '..'), repo = join(root, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const CAR = arg('car', 'bmw1'), LAPS = +arg('laps', 3), RACES = +arg('races', 2), SKILL = +arg('skill', 1), SPREAD = +arg('spread', 0.01), DIFF = arg('difficulty', 'medium');
const TRACKS = arg('tracks', 'india,shajawa,drylake,tokyo').split(','), ASSIST_NAME = arg('assist', 'rookie'), QUIET = process.argv.includes('--quiet');

const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true }, ssr: { noExternal: [] } });
const load = (p) => vite.ssrLoadModule(p);
const THREE = await load('three');
const [{ Vehicle }, H, { PhysicsWorld, STEP }, { AIDriver }, { yawFade: YF }, RL, R, D] = await Promise.all([
  load('/src/physics/vehicle.js'), load('/src/physics/handling.js'), load('/src/physics/world.js'), load('/src/physics/driver.js'), load('/src/physics/arcade.js'),
  load('/src/physics/racing-line.js'), load('/src/game/career/rules.js'), load('/src/game/difficulty.js')]);
const TEAMS = JSON.parse(readFileSync(join(repo, 'assets/teams/teams.json'), 'utf8'));
const ASSIST = { rookie: { counter: 0.45, stability: 1.25, tcs: 0.8 }, pro: { counter: 0.1, stability: 0.35, tcs: 0 }, ai: { counter: 0.6, stability: 1.4, tcs: 1 } };   // = Field.assists by store.assists, cars.js drivePhysics
const AI_PLAN = { aLat: 32, aBrk: 16, vmax: 78 };                 // = src/cars.js AI_PLAN
const GRID = 8;

function profileOf(key) {
  const mj = join(repo, 'assets/cars', key, 'model.json'), pj = join(repo, 'car-lab/src/vehicle/profiles', key + '.json');
  return { wheels: JSON.parse(readFileSync(existsSync(mj) ? mj : pj, 'utf8')).wheels };
}
/** = game.js racersFor: the seven teams nearest the hero's team in expected finish, their first cars, in teams.json order */
function racersFor(hero) {
  const mine = TEAMS.teams.find((t) => t.cars.some((c) => c.key === hero)), at = (t) => R.teamInfo(t.id).expPos, me = mine ? at(mine) : 0;
  const near = TEAMS.teams.filter((t) => t !== mine).sort((a, b) => Math.abs(at(a) - me) - Math.abs(at(b) - me) || at(a) - at(b)).slice(0, GRID - 1);
  return [hero, ...TEAMS.teams.filter((t) => near.includes(t)).map((t) => t.cars[0].key)];
}
const rng = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

const worlds = {};
async function trackOf(id) {
  if (worlds[id]) return worlds[id];
  const track = RL.withRacingLine(JSON.parse(readFileSync(id === 'marina' ? join(repo, 'tracks/marina/out/track.json') : join(root, 'public/assets', id, 'track.json'), 'utf8')));
  const c = track.centerline, n = c.length, rl = track.racingLine, pts = [];
  for (let i = 0; i < n; i++) {
    const a = c[(i - 1 + n) % n], b = c[(i + 1) % n], dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
    pts.push(new THREE.Vector3(c[i][0], c[i][1], c[i][2]).addScaledVector(new THREE.Vector3(dz / len, 0, -dx / len), rl[i]));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal'); curve.arcLengthDivisions = 4000;
  const length = curve.getLength(), N = 1200, p = [], up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), linePts = [], lineLeft = [];
  for (let i = 0; i < N; i++) { const q = curve.getPointAt(i / N); p.push(q); linePts.push(q.clone()); curve.getTangentAt(i / N, t); t.y = 0; t.normalize(); lineLeft.push(new THREE.Vector3().crossVectors(up, t)); }
  const glb = readFileSync(id === 'marina' ? join(root, 'public/assets/marina_collision.glb') : join(root, 'public/assets', id, id + '_collision.glb'));
  return worlds[id] = { id, track, length, N, linePts, lineLeft, vt: RL.speedProfile(p, length, YF, AI_PLAN), glb };
}

/** one race; returns the hero's finishing place (1 = win) and the order */
async function race(T, seed) {
  const pw = await PhysicsWorld.create('data:model/gltf-binary;base64,' + T.glb.toString('base64'));
  const r = rng(seed), keys = racersFor(CAR), slots = T.track.start.gridSlots, cfg = D.difficultyOf(DIFF);
  const F = { linePts: T.linePts, lineLeft: T.lineLeft, N: T.N, vt: T.vt, track: T.track, hardPace: 1, rivalNitro: cfg.rivalNitro, cars: [] };
  keys.forEach((key, k) => {
    const hero = k === 0, row = hero ? keys.length - 1 : k - 1, s = slots[row % slots.length];
    const spec = H.handling(key); if (hero) spec.nitroTank = 1.0001;      // the AI's nitro logic skips a hero and stock tanks outside Hard: a hair over stock lets the stand-in use its nitro
    const v = new Vehicle(pw, spec, profileOf(key), { pos: new THREE.Vector3(...s.pos), yaw: (s.headingYawRad ?? Math.PI / 2) - Math.PI / 2 });
    const pace = hero ? SKILL * (1 + (r() * 2 - 1) * SPREAD) : +process.env.SLOW === k ? 0.85 : D.rivalPace(cfg, k) * (1 + (r() * 2 - 1) * 0.003);   // SLOW=k: rival k crawls (a spun or damaged car), to test passing
    const car = { key, hero: false, isPlayer: hero, vehicle: v };
    car.ai = new AIDriver(F, car, pace, hero ? null : R.quickProfile(key, (key.length * 7919) >>> 0, T.id));
    car.ai.lane = hero ? 0 : (k % 2 ? -1 : 1) * 0.6; car.ai.bold = hero;
    car.ai.i = nearest(T, v.cur.pos);
    car.prog = 0; car.last = car.ai.i; car.need = LAPS * T.N + ((T.N - car.ai.i) % T.N);   // from the grid (behind the line) to the line, then LAPS laps
    F.cars.push(car);
  });
  F.hero = F.cars[0];
  const assist = (c) => (c.isPlayer ? ASSIST[ASSIST_NAME] : ASSIST.ai), goAt = 8;
  const finished = [];
  for (let s = 0, t = 0; t < 60 * LAPS * 4 && finished.length < F.cars.length; s++, t += STEP) {
    for (const c of F.cars) {
      const v = c.vehicle;
      let ctl = t < goAt ? { throttle: 0, brake: 1, steer: 0, handbrake: 0, nitro: 0, hold: true } : c.ai.read(v);
      if (ctl.reset || v.state.upsideDown > 1.5) { respawn(T, c); ctl = { throttle: 0, brake: 0, steer: 0, handbrake: 0, nitro: 0 }; }
      Object.assign(v.controls, { hold: false }, ctl);
      v.step(STEP, assist(c));
    }
    pw.world.step();
    if (t < goAt) continue;
    for (const c of F.cars) {
      if (c.done) continue;
      const d = (c.ai.i - c.last + T.N) % T.N; if (d < T.N / 2) c.prog += d; c.last = c.ai.i;
      if (c.prog >= c.need) { c.done = t; finished.push(c); }
    }
    if (finished.includes(F.hero) && finished.length >= 2) break;
    if (process.env.WATCH && s % 240 === 0) { const c = F.cars.find((x) => x.key === process.env.WATCH), sl = F.cars.find((x) => x.ai.pace === 0.85); if (c && sl) { const d = c.vehicle.cur.pos.distanceTo(sl.vehicle.cur.pos); if (d < 40) console.log(`  t ${t.toFixed(0)} i ${c.ai.i} dist ${d.toFixed(1)} laneNow ${c.ai.laneNow?.toFixed(2)} passSide ${c.ai.passSide} v ${(c.vehicle.speed*3.6).toFixed(0)} slow v ${(sl.vehicle.speed*3.6).toFixed(0)} slowLane ${sl.ai.laneNow?.toFixed(2)}`); } }   // WATCH=key: that car's pass attempts on the SLOW car
    if (process.env.TRACE && s % 1200 === 0) { const h = F.hero, ahead = F.cars.filter((c) => c !== h && c.prog > h.prog).length; console.log(`  t ${t.toFixed(0)} P${ahead + 1} ${(h.vehicle.speed * 3.6).toFixed(0)} km/h lane ${h.ai.laneNow?.toFixed(1)} passSide ${h.ai.passSide} nitro ${h.vehicle.state.nitroTank.toFixed(2)} gapToLeader ${Math.max(...F.cars.map((c) => c.prog)) - h.prog}`); }   // the hero's place is settled once it and everyone ahead are home
  }
  const order = [...F.cars].sort((a, b) => (a.done ?? Infinity) - (b.done ?? Infinity) || b.prog - a.prog);
  pw.dispose?.();
  if (process.env.DBG) for (const c of F.cars) console.log(`  ${c.key.padEnd(18)} ${c.isPlayer ? 'YOU' : '   '} pace ${c.ai.pace.toFixed(3)} prog ${c.prog}/${c.need} done ${c.done?.toFixed(1) ?? '-'} respawns ${c.respawns ?? 0}`);
  const best = Math.min(...F.cars.filter((c) => c !== F.hero && c.done).map((c) => c.done));   // the margin: + = seconds behind the winner, - = seconds ahead of second
  return { place: order.indexOf(F.hero) + 1, order: order.map((c) => c.key), margin: F.hero.done ? F.hero.done - best : Infinity };
}
function nearest(T, p) { let b = Infinity, bi = 0; T.linePts.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < b) { b = d; bi = i; } }); return bi; }
function respawn(T, c) { c.respawns = (c.respawns ?? 0) + 1; const i = c.ai.i, a = T.linePts[i], b = T.linePts[(i + 2) % T.N]; c.vehicle.respawn(a, Math.atan2(-(b.z - a.z), b.x - a.x)); c.ai.stuck = 0; }

const places = [], margins = [];
for (const id of TRACKS) {
  const T = await trackOf(id), got = [];
  for (let n = 0; n < RACES; n++) {
    const t0 = Date.now(), res = await race(T, 1000 + n * 7919 + id.length);
    got.push(res.place); places.push(res.place); margins.push(+res.margin.toFixed(2));
    if (!QUIET) console.log(`${id} race ${n + 1}: P${res.place}  (${((Date.now() - t0) / 1000).toFixed(0)} s)  ${res.order.slice(0, 3).join(' ')}`);
  }
  console.log(`${id}: ${got.map((p) => 'P' + p).join(' ')}`);
}
const wins = places.filter((p) => p === 1).length;
console.log(`${CAR} ${DIFF} skill ${SKILL}: won ${wins}/${places.length} (${Math.round((100 * wins) / places.length)}%), mean place ${(places.reduce((a, b) => a + b, 0) / places.length).toFixed(1)}`);
console.log('MARGINS ' + JSON.stringify({ car: CAR, difficulty: DIFF, skill: SKILL, margins }));
await vite.close();
