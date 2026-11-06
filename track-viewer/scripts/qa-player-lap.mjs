// A lap as a player drives it: the real car, through Field.drivePhysics with the player's assists and the player's input path (the AI's hands on the wheel, its speeds, held on a lane off the
// line or weaving across the road), in a real Free Drive. Every sudden loss of speed is logged with what the car's box was about to touch (swept ahead before each step, because the contact is
// gone after it), and the ride is measured per stretch: vertical acceleration of the body, and how much the wheels' compression jumps between steps.
//   COLLISION=file.glb serves that file as the track's collision, to compare builds
//   node scripts/qa-lock.mjs -- node scripts/qa-player-lap.mjs india [car=nissan-z] [lanes=-9,-6,-3,0,3,6,9,w8,w12] [pace=1.05] [laps=1]      w8 = weave 8 m either side of the line
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'india', car = 'nissan-z', lanes = '-9,-6,-3,0,3,6,9,w8,w12', pace = '1.05', laps = '1'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.addInitScript(([t, c]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car: c, settings: { track: t, look: 'day', weather: 'dry' } })); } catch { /* none */ } }, [track, car]);
const page = await ctx.newPage(), errors = [];
if (process.env.COLLISION) await page.route(`**/${track}_collision.glb`, (r) => r.fulfill({ path: process.env.COLLISION, contentType: 'model/gltf-binary' }));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.QA_URL ?? 'http://127.0.0.1:5180');   // QA_URL: another session's Vite
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.click('.bento-tile[data-id=free]');
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.field?.pw, null, { timeout: 300000 });
const res = await page.evaluate(async ({ lanes, pace, laps }) => {
  const { STEP, initPhysics } = await import('/src/physics/world.js'), RAPIER = await initPhysics();
  const f = window.game.field, pw = f.pw, world = pw.world, c = f.hero, v = c.vehicle, ai = c.ai, N = f.N, out = { car: c.key, assists: f.assists, stops: [], lines: [] };
  const cl = window.game.ctx.track?.()?.centerline ?? null;
  window.game.ctx.params.paused = true; f.hold = false; f.playerDrives = true; ai.pace = pace;
  const stationOf = (p) => { let best = 0, bd = 1e12; for (let i = 0; i < N; i += 1) { const q = f.linePts[i], d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 * 4 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
  const nameOf = (col) => (pw.surfaceOf.get(col.handle)?.name ?? '?') + (col.handle === pw.voidHandle ? '(void)' : '');
  const voidCount = pw.voidWalls.count * 2; world.forEachCollider((col) => { if (col.shapeType() === RAPIER.ShapeType.TriMesh && col.indices()?.length / 3 === voidCount) pw.voidHandle = col.handle; });
  const ride = new Map();
  for (const lane of lanes) {
    const weave = typeof lane === 'string' ? +lane.slice(1) : 0;
    v.respawn(f.linePts[2].clone().setY(f.linePts[2].y + 0.3), Math.atan2(-(f.linePts[5].z - f.linePts[2].z), f.linePts[5].x - f.linePts[2].x)); ai.i = 2; ai.stuck = 0;
    const trace = []; let lowAy = 0, hfSum = 0, hfN = 0, t = 0, dist = 0, prevV = 0, prevY = v.rb.linvel().y, cool = 0, pre = null, respawns = 0, lastI = 0, wrapped = 0, maxKmh = 0, stalled = 0, lap0 = null;
    f.input.read = () => {
      ai.lane = weave ? weave * Math.sin(t * 0.45) : lane;
      const vel = v.rb.linvel(), sp = Math.hypot(vel.x, vel.y, vel.z); pre = null;
      if (sp > 8) { const hit = world.castShape(v.collider.translation(), v.collider.rotation(), { x: vel.x / sp, y: vel.y / sp, z: vel.z / sp }, v.collider.shape, 0, sp * STEP * 1.5, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, v.collider, v.rb); if (hit) { const n = hit.normal1 ?? hit.normal, nl = Math.hypot(n.x, n.y, n.z) || 1; pre = { name: nameOf(hit.collider), ny: +(n.y / nl).toFixed(2), head: +Math.abs((n.x * vel.x + n.y * vel.y + n.z * vel.z) / nl / sp).toFixed(2), y: +(hit.witness1?.y - v.collider.translation().y).toFixed(2) }; } }
      const ctl = ai.read(v); return { ...ctl, reset: false };
    };
    for (; t < 400 && wrapped < laps; t += STEP) {
      f.drivePhysics(STEP);
      const p = v.cur.pos, sp = v.speed, lost = (prevV - sp) / STEP, vel = v.rb.linvel(), ay = (vel.y - prevY) / STEP;
      { const q = v.cur.quat, av = v.rb.angvel(), touch = []; world.contactPairsWith(v.collider, (o) => { world.contactPair(v.collider, o, (m, flip) => { if (!m.numContacts()) return; const nn = m.normal(), sg = flip ? -1 : 1; touch.push(`${nameOf(o)} n(${(nn.x * sg).toFixed(2)},${(nn.y * sg).toFixed(2)},${(nn.z * sg).toFixed(2)}) d${m.contactDist(0).toFixed(2)} x${m.numContacts()}`); }); }); trace.push(`${t.toFixed(3)} ${Math.round(sp * 3.6)}km/h v(${vel.x.toFixed(1)},${vel.y.toFixed(1)},${vel.z.toFixed(1)}) spin(${av.x.toFixed(1)},${av.y.toFixed(1)},${av.z.toFixed(1)}) up${(1 - 2 * (q.x * q.x + q.z * q.z)).toFixed(2)} y${p.y.toFixed(2)} comp ${v.wheels.map((w) => (w.contact ? w.surface?.name?.[0] ?? '?' : '_') + w.comp.toFixed(2)).join(' ')} ctl t${v.controls.throttle.toFixed(1)} b${v.controls.brake.toFixed(1)} s${v.controls.steer.toFixed(1)} hb${v.controls.handbrake ? 1 : 0} ${touch.join('; ')}`); if (trace.length > 14) trace.shift(); } prevV = sp; prevY = vel.y; cool -= STEP; maxKmh = Math.max(maxKmh, sp * 3.6);
      if (Math.floor(t / STEP) % 6 === 0) { const i = stationOf(p); if (i < lastI - N / 2) wrapped++; lastI = i; const k = Math.floor(i / 12), e = ride.get(k) ?? { n: 0, a: 0, hf: 0, y: p.y, max: 0 }; const ag = Math.abs(ay) / 9.81; e.n++; e.a += ag * ag; e.hf += hfSum / Math.max(hfN, 1); e.max = Math.max(e.max, ag); ride.set(k, e); hfSum = 0; hfN = 0; }
      { lowAy += (ay - lowAy) * Math.min(1, STEP / 0.25); const h = (ay - lowAy) / 9.81; hfSum += h * h; hfN++; }
      if (t > 3 && sp < 1.5) { stalled += STEP; if (stalled > 2) { const i = stationOf(p); out.stops.push({ lane, station: i, kmh: 0, g: 0, stuck: true, on: 'stuck', y: +p.y.toFixed(1) }); const to = f.linePts[(i + 15) % N], ah = f.linePts[(i + 18) % N]; v.respawn(to.clone().setY(to.y + 0.3), Math.atan2(-(ah.z - to.z), ah.x - to.x)); ai.i = (i + 15) % N; ai.stuck = 0; respawns++; stalled = 0; prevV = 0; cool = 1; } } else stalled = 0;
      if (t > 3 && cool <= 0 && lost > 35) { const i = stationOf(p), q = f.linePts[i], L = f.lineLeft[i]; out.stops.push({ lane, station: i, lat: +((p.x - q.x) * L.x + (p.z - q.z) * L.z).toFixed(1), from: Math.round((sp + lost * STEP) * 3.6), kmh: Math.round(sp * 3.6), g: +(lost / 9.81).toFixed(0), on: pre?.name ?? '-', head: pre?.head, ny: pre?.ny, at: pre?.y, pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], trace: lost > 60 ? [...trace] : undefined }); cool = 0.5; }
    }
    out.lines.push({ lane, seconds: +t.toFixed(1), maxKmh: Math.round(maxKmh), respawns, wrapped });
  }
  out.N = N; out.ride = [...ride.entries()].sort((a, b) => a[0] - b[0]).map(([k, e]) => ({ station: k * 12, rms: +Math.sqrt(e.a / e.n).toFixed(3), hf: +Math.sqrt(e.hf / e.n).toFixed(3), max: +e.max.toFixed(2) }));
  return out;
}, { lanes: lanes.split(',').map((l) => (l[0] === 'w' ? l : +l)), pace: +pace, laps: +laps });
await browser.close();
mkdirSync(join(root, 'qa'), { recursive: true }); writeFileSync(join(root, 'qa', `player-lap-${track}.json`), JSON.stringify(res));
console.log(`${track}: ${res.car}, assists ${JSON.stringify(res.assists)}; line stations ${res.N}; ${res.stops.length} stops`, errors.length ? 'ERRORS ' + errors[0].slice(0, 100) : '');
console.log(res.lines.map((l) => `${l.lane}: ${l.seconds} s, ${l.maxKmh} km/h max, ${l.respawns} stuck`).join(' | '));
const by = {}; for (const s of res.stops) (by[s.on] ??= []).push(s);
for (const [k, l] of Object.entries(by)) console.log(` ${k} x${l.length}:`, l.slice(0, 14).map((s) => s.stuck ? `st${s.station} stuck(${s.lane})` : `st${s.station} lat${s.lat} ${s.from}->${s.kmh} ${s.g}g head${s.head} ny${s.ny} h${s.at} (${s.lane})`).join(' | '));
for (const s of res.stops.filter((x) => x.trace).slice(0, 4)) console.log(`
 TRACE st${s.station} lat${s.lat} ${s.from}->${s.kmh} (${s.lane}) at ${s.pos}
   ` + s.trace.join(`
   `));
const rough = [...res.ride].sort((a, b) => b.hf - a.hf).slice(0, 10); console.log(' ride: vertical g, lap mean', (res.ride.reduce((a, e) => a + e.rms, 0) / res.ride.length).toFixed(3), ', ripple (over 4 Hz) lap mean', (res.ride.reduce((a, e) => a + e.hf, 0) / res.ride.length).toFixed(3), '; roughest', rough.map((e) => `st${e.station} ${e.hf}g (peak ${e.max})`).join(', '));
