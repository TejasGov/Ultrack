// What really stops a car off the racing line: the real car model, held at a lateral offset for a whole lap at a steady speed, in the game's own physics world. Every sudden loss of
// speed is logged with the collider it touched (road walls, void walls, ground) and how far that is from the barrier the player can see. Exits 1 if anything but a seen barrier stops it.
//   node scripts/qa-lock.mjs -- node scripts/qa-wide-lines.mjs infinia [lats=-12,-10,..,12] [kmh=90] [car=laferrari]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'infinia', lats = '-12,-10,-8,-6,-4,-2,0,2,4,6,8,10,12', kmh = '90', car = 'laferrari'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trackFile = [join(root, 'public', 'assets', track, 'track.json'), join(root, 'public', 'assets', 'track.json')].find(existsSync);   // Marina's lies directly in assets
const C = JSON.parse(readFileSync(trackFile, 'utf8')).centerline;
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.addInitScript(([t, c]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car: c, settings: { track: t, look: 'day', weather: 'dry' } })); } catch { /* none */ } }, [track, car]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5180');
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.click('.bento-tile[data-id=free]');
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.field?.pw, null, { timeout: 300000 });
const out = await page.evaluate(async ({ C, car, lats, kmh }) => {
  const { Vehicle } = await import('/src/physics/vehicle.js'), { handling } = await import('/src/physics/handling.js'), { STEP, initPhysics } = await import('/src/physics/world.js'), RAPIER = await initPhysics();
  const field = window.game.field, pw = field.pw, world = pw.world, n = C.length, prof = field.hero.profile, res = [];
  const voidCount = pw.voidWalls.count * 2; let voidHandle = null; world.forEachCollider((c) => { if (c.shapeType() === RAPIER.ShapeType.TriMesh && c.indices()?.length / 3 === voidCount) voidHandle = c.handle; });
  const left = (i) => { const a = C[(i + n - 1) % n], b = C[(i + 1) % n], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1; return [tz / l, -tx / l]; };
  const nearest = (p, i0) => { let best = i0, bd = 1e9; for (let k = i0 - 6; k <= i0 + 14; k++) { const q = C[(k + n) % n], d = Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z); if (d < bd) { bd = d; best = (k + n) % n; } } return best; };
  const isWall = (c) => pw.surfaceOf.get(c.handle)?.name === 'wall' && c.handle !== voidHandle;
  const reach = (i, sd) => { const [lx, lz] = left(i), p = C[i], h = world.castRay(new RAPIER.Ray({ x: p[0], y: p[1] + 0.5, z: p[2] }, { x: lx * sd, y: 0, z: lz * sd }), 60, true, undefined, undefined, undefined, undefined, isWall); return h ? h.timeOfImpact : 60; };
  const touchingNow = (v) => { const out = new Set(), body = v.collider; world.contactPairsWith(body, (o) => { let live = false; world.contactPair(body, o, (m) => { if (m.numContacts() > 0) live = true; }); if (live) out.add(o.handle === voidHandle ? 'VOID' : pw.surfaceOf.get(o.handle)?.name ?? '?'); }); return [...out]; };
  const RL = C.map((_, i) => reach(i, 1)), RR = C.map((_, i) => reach(i, -1)), covered = new Uint16Array(n);
  const leg = Math.min(540, Math.floor(n / 2) - 10);
  field.hero.vehicle.rb.setEnabled(false);
  for (const target of lats) for (let start = 0; start < n; start += leg - 40) {   // four legs: a line that ends on a wall must not hide the rest of the lap
    const Rat = (i) => (target > 0 ? RL : RR)[i] - 1.7, line = (i) => Math.sign(target) * Math.min(Math.abs(target), Rat(i));   // inside the barrier you can see: anything that stops the car here is a surprise
    const [lx, lz] = left(start), s = C[start], b = C[(start + 2) % n], pos = new field.hero.root.position.constructor(s[0] + lx * line(start), s[1] + 0.3, s[2] + lz * line(start));
    const v = new Vehicle(pw, handling(car), prof, { pos, yaw: Math.atan2(-(b[2] - s[2]), b[0] - s[0]) });
    let i = start, t = 0, prevV = 0, cool = 0, stuck = 0; const end = (start + leg) % n, want = kmh / 3.6;
    for (; t < 120 && i !== end && ((end - i + n) % n) < n / 2; t += STEP) {
      const p = v.cur.pos; i = nearest(p, i); covered[i]++;
      // stuck: note it, carry on 20 stations further, so one stop cannot hide the rest of the lap
      stuck = t > 2 && v.speed < 1.5 ? stuck + STEP : 0;
      if (stuck > 1 || p.y < C[i][1] - 15) { res.push({ line: target, station: i, stuck: true, lat: +((p.x - C[i][0]) * left(i)[0] + (p.z - C[i][2]) * left(i)[1]).toFixed(1), kmh: 0, g: 0, touching: ['STUCK', ...touchingNow(v)], wallL: +RL[i].toFixed(1), wallR: +RR[i].toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) }); i = (i + 20) % n; const q = C[i], f2 = C[(i + 2) % n], [ex, ez] = left(i); v.respawn(new field.hero.root.position.constructor(q[0] + ex * line(i), q[1] + 0.3, q[2] + ez * line(i)), Math.atan2(-(f2[2] - q[2]), f2[0] - q[0])); stuck = 0; prevV = 0; cool = 1; }
      const [ax, az] = left(i), lat = (p.x - C[i][0]) * ax + (p.z - C[i][2]) * az, f = C[(i + 8) % n], yawWant = Math.atan2(f[2] - C[i][2], f[0] - C[i][0]);
      const q = v.cur.quat, yaw = Math.atan2(2 * (q.x * q.z - q.w * q.y), 1 - 2 * (q.y * q.y + q.z * q.z)); let dy = yawWant - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      Object.assign(v.controls, { throttle: v.speed < want ? 1 : 0, brake: v.speed > want + 2 ? 0.5 : 0, handbrake: 0, nitro: 0, steer: Math.max(-1, Math.min(1, -dy * 2.2 + (line(i) - lat) * 0.12)) });
      v.step(STEP, { counter: 0.6, stability: 1.4, tcs: 1 }); world.step();
      const lost = (prevV - v.speed) / STEP; prevV = v.speed; cool -= STEP;
      if (t > 2 && cool <= 0 && lost > 25) {   // m/s2: over 2.5 g backwards, more than any brake
        res.push({ line: target, station: i, lat: +lat.toFixed(1), kmh: Math.round(v.speed * 3.6), g: +(lost / 9.81).toFixed(1), yawOff: Math.round(dy * 57.3), touching: touchingNow(v), wallL: +reach(i, 1).toFixed(1), wallR: +reach(i, -1).toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) });
        cool = 0.4;
      }
    }
    world.removeRigidBody(v.rb); world.step();
  }
  return { hits: res, voidHandle: voidHandle !== null, untested: [...covered].filter((c) => !c).length };
}, { C, car, lats: lats.split(',').map(Number), kmh: +kmh });
await browser.close();
mkdirSync(join(root, 'qa'), { recursive: true }); writeFileSync(join(root, 'qa', `wide-lines-${track}.json`), JSON.stringify(out.hits, null, 1));
const seen = (h) => !h.touching.includes('VOID') && h.touching.includes('wall');   // ground the car also touches is the car's own footing

const rest = out.hits.filter((h) => !seen(h)), clusters = [];
for (const h of rest.sort((a, b) => a.station - b.station)) { const c = clusters.at(-1); if (c && h.station - c.to < 12) { c.to = h.station; c.hits.push(h); } else clusters.push({ from: h.station, to: h.station, hits: [h] }); }
console.log(`${track}: stations nobody drove ${out.untested}; void wall found ${out.voidHandle}; ${out.hits.length} hard stops, ${out.hits.length - rest.length} on a barrier you can see, ${rest.length} on something else, in ${clusters.length} places`);
for (const c of clusters) console.log(` ${c.from}-${c.to} x${c.hits.length}`, JSON.stringify(c.hits.slice(0, 3).map((h) => [h.line, h.lat, h.kmh, h.g, h.touching.join('+'), h.wallL, h.wallR])));
process.exit(rest.length ? 1 : 0);
