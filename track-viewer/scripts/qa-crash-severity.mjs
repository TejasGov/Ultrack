// Which impacts count as a crash, and what would each be billed? The real car is fired at the wall from the road side in the game's own physics world, at several speeds and two angles
// (8 degrees: a rub along the barrier, 30: a hit), with the wheel straight and with it turned away. Each shot runs the session's own crash test (session.js: braking over 24 m/s2 or
// sideways over 34 m/s2, kmh = the faster of now and the step before) and prices the hit with the career's repair bill (rules.js hitBill).
//   node scripts/qa-lock.mjs -- node scripts/qa-crash-severity.mjs [track=india] [car=bmw1]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'india', car = 'bmw1'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = JSON.parse(readFileSync([join(root, 'public', 'assets', track, 'track.json'), join(root, 'public', 'assets', 'track.json')].find(existsSync), 'utf8')).centerline;
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.addInitScript(([t, c]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car: c, settings: { track: t, look: 'day', weather: 'dry' } })); } catch { /* none */ } }, [track, car]);
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5180');
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter'); await page.click('.bento-tile[data-id=free]'); await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.field?.pw, null, { timeout: 300000 });
const res = await page.evaluate(async ({ C, car }) => {
  const { Vehicle } = await import('/src/physics/vehicle.js'), { handling } = await import('/src/physics/handling.js'), { STEP, initPhysics } = await import('/src/physics/world.js'), RAPIER = await initPhysics();
  const field = window.game.field, pw = field.pw, world = pw.world, n = C.length, prof = field.hero.profile, V3 = field.hero.root.position.constructor, shots = [];
  const isWall = (c) => pw.surfaceOf.get(c.handle)?.name === 'wall';
  field.hero.vehicle.rb.setEnabled(false);
  for (const kmh of [50, 80, 120, 160, 200]) for (const deg of [8, 30]) for (const away of [false, true]) {
    let count = 0, flagged = 0, kmhs = [], lost = [], touched = 0;
    for (let i = 0; i < n && count < 14; i += 31) for (const sd of [1, -1]) {
      const a = C[(i + n - 1) % n], b = C[(i + 1) % n], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1, ux = tx / l, uz = tz / l, lx = uz * sd, lz = -ux * sd, p = C[i];
      const wall = world.castRay(new RAPIER.Ray({ x: p[0], y: p[1] + 0.5, z: p[2] }, { x: lx, y: 0, z: lz }), 70, true, undefined, undefined, undefined, undefined, isWall);
      if (!wall || wall.timeOfImpact < 6) continue;
      const r = deg * Math.PI / 180, dx = ux * Math.cos(r) + lx * Math.sin(r), dz = uz * Math.cos(r) + lz * Math.sin(r), lat = Math.max(0, wall.timeOfImpact - 4.5);
      const s = { x: p[0] + lx * lat, y: p[1] + 0.25, z: p[2] + lz * lat }, v = new Vehicle(pw, handling(car), prof, { pos: new V3(s.x, s.y, s.z), yaw: Math.atan2(-dz, dx) });
      v.rb.setLinvel({ x: dx * kmh / 3.6, y: 0, z: dz * kmh / 3.6 }, true);
      let t = 0, last = kmh, ev = null, touch = false, minK = kmh, vPrev = v.rb.linvel(), v0 = null, tEv = 0, dvPeak = 0;
      for (; t < 1.2; t += STEP) {
        Object.assign(v.controls, { throttle: 0, brake: 0, handbrake: 0, nitro: 0, steer: away ? (sd > 0 ? -1 : 1) * 0.4 : 0 });
        v.step(STEP, { counter: 0.6, stability: 1.4, tcs: 1 }); world.step();
        world.contactPairsWith(v.collider, (o) => { if (isWall(o)) touch = true; });
        const k = v.speed * 3.6, decel = -v.aBody.x, vn = v.rb.linvel();
        if (!ev && (decel > 24 || Math.abs(v.aBody.z) > 34)) { ev = Math.round(Math.max(k, last)); v0 = vPrev; tEv = t; }   // the session's test and its kmh; v0: the velocity before the hit
        if (v0 && t - tEv < 0.4) dvPeak = Math.max(dvPeak, Math.hypot(vn.x - v0.x, vn.z - v0.z) * 3.6);   // the velocity the hit took away, in km/h
        vPrev = vn; last = k; if (touch) minK = Math.min(minK, k);
      }
      count++; if (touch) touched++; if (ev !== null) { flagged++; kmhs.push(Math.round(dvPeak)); } if (touch) lost.push(Math.round(kmh - minK));
      world.removeRigidBody(v.rb); world.step();
    }
    shots.push({ kmh, deg, away, shots: count, touched, flagged, dv: kmhs, speedLostMedian: lost.sort((a, b) => a - b)[lost.length >> 1] });
  }
  return shots;
}, { C, car });
await browser.close();
for (const r of res) console.log(`${String(r.kmh).padStart(3)} km/h ${String(r.deg).padStart(2)} deg ${r.away ? 'wheel away' : 'wheel straight'}: ${r.shots} shots, ${r.touched} touched the wall, ${r.flagged} counted as a crash ${r.dv.length ? '(velocity change ' + r.dv.join(', ') + ' km/h)' : ''}, speed lost ${r.speedLostMedian} km/h (median)`);
