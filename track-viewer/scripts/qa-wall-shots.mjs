// Do the barriers hold, and does a glancing hit slide? The real car, fired at the wall from the road side at 150 km/h, every 25 stations, both sides, at 8 and 30 degrees, in the game's
// own physics world. Through = a col_wall lies between where it started and where it is 0.7 s later. Exits 1 if any car gets through.
//   node scripts/qa-lock.mjs -- node scripts/qa-wall-shots.mjs india [kmh=150] [car=laferrari]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'india', kmh = '150', car = 'laferrari'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = JSON.parse(readFileSync([join(root, 'public', 'assets', track, 'track.json'), join(root, 'public', 'assets', 'track.json')].find(existsSync), 'utf8')).centerline;
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.addInitScript(([t, c]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car: c, settings: { track: t, look: 'day', weather: 'dry' } })); } catch { /* none */ } }, [track, car]);
const page = await ctx.newPage();
await page.goto(process.env.QA_URL ?? 'http://127.0.0.1:5180');   // QA_URL: another session's Vite
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.click('.bento-tile[data-id=free]');
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.field?.pw, null, { timeout: 300000 });
const res = await page.evaluate(async ({ C, car, kmh }) => {
  const { Vehicle } = await import('/src/physics/vehicle.js'), { handling } = await import('/src/physics/handling.js'), { STEP, initPhysics } = await import('/src/physics/world.js'), RAPIER = await initPhysics();
  const field = window.game.field, pw = field.pw, world = pw.world, n = C.length, prof = field.hero.profile, V3 = field.hero.root.position.constructor, shots = [];
  const isWall = (c) => pw.surfaceOf.get(c.handle)?.name === 'wall';
  field.hero.vehicle.rb.setEnabled(false);
  for (let i = 0; i < n; i += 25) for (const sd of [1, -1]) for (const deg of [8, 30]) {
    const a = C[(i + n - 1) % n], b = C[(i + 1) % n], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1, ux = tx / l, uz = tz / l, lx = uz * sd, lz = -ux * sd, p = C[i];
    const wall = world.castRay(new RAPIER.Ray({ x: p[0], y: p[1] + 0.5, z: p[2] }, { x: lx, y: 0, z: lz }), 70, true, undefined, undefined, undefined, undefined, isWall);
    if (!wall || wall.timeOfImpact < 6) continue;
    const r = deg * Math.PI / 180, dx = ux * Math.cos(r) + lx * Math.sin(r), dz = uz * Math.cos(r) + lz * Math.sin(r), lat = Math.max(0, wall.timeOfImpact - 4.5);
    const s = { x: p[0] + lx * lat, y: p[1] + 0.25, z: p[2] + lz * lat }, v = new Vehicle(pw, handling(car), prof, { pos: new V3(s.x, s.y, s.z), yaw: Math.atan2(-dz, dx) });
    v.rb.setLinvel({ x: dx * kmh / 3.6, y: 0, z: dz * kmh / 3.6 }, true);
    let touched = false;
    for (let t = 0; t < 0.7; t += STEP) {
      Object.assign(v.controls, { throttle: 0, brake: 0, handbrake: 0, nitro: 0, steer: 0 });
      v.step(STEP, { counter: 0.6, stability: 1.4, tcs: 1 }); world.step();
      world.contactPairsWith(v.collider, (o) => { if (isWall(o)) touched = true; });
    }
    const q = v.cur.pos, ex = q.x - s.x, ey = q.y + 0.5 - (s.y + 0.25), ez = q.z - s.z, el = Math.hypot(ex, ey, ez) || 1;
    const crossed = world.castRay(new RAPIER.Ray({ x: s.x, y: s.y + 0.25, z: s.z }, { x: ex / el, y: ey / el, z: ez / el }), el, true, undefined, undefined, undefined, undefined, isWall);
    shots.push({ i, sd, deg, wall: +wall.timeOfImpact.toFixed(1), touched, through: !!crossed && world.castRay(new RAPIER.Ray({ x: s.x, y: s.y + 0.25, z: s.z }, { x: lx, y: 0, z: lz }), wall.timeOfImpact, true, undefined, undefined, undefined, undefined, isWall) != null && crossed.timeOfImpact < el - 0.3, kmh: Math.round(v.speed * 3.6) });
    world.removeRigidBody(v.rb); world.step();
  }
  return shots;
}, { C, car, kmh: +kmh });
await browser.close();
const med = (l) => { const s = l.map((x) => x.kmh).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : '-'; }, through = res.filter((s) => s.through);
for (const deg of [8, 30]) { const l = res.filter((s) => s.deg === deg && s.touched); console.log(`${track} ${deg} deg: ${res.filter((s) => s.deg === deg).length} shots, ${l.length} touched the wall, median speed after ${med(l)} km/h, under 60 km/h ${l.filter((s) => s.kmh < 60).length}`); }
console.log(`${track} slow after 8 deg:`, res.filter((s) => s.deg === 8 && s.touched && s.kmh < 60).map((s) => s.i + (s.sd > 0 ? 'L' : 'R')).join(' '));
console.log(`${track}: through the wall ${through.length}`, through.slice(0, 14).map((s) => `st${s.i}${s.sd > 0 ? 'L' : 'R'}@${s.deg}`).join(' '));
process.exit(through.length ? 1 : 0);
