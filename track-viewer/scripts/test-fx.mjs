// Car FX check (carkit/fx.js, fx-nitro.js, fx-vapor.js): drives the sandbox's test drive frame by frame and saves close-ups.
//   npm run dev (another terminal), then: node scripts/test-fx.mjs av12 [buggati ford-gt porsche1]
// Writes qa/<car>/fx-idle.png, fx-lift.png (one frame per tile through the overrun), fx-nitro.png, fx-wet.png (rain, at speed) and
// prints particle counts and the worst per-frame cost of the FX update. Exits 1 if:
//   an electric car pops, makes steam or crackles; a combustion car never pops / shows steam;
//   nitro makes no flame streams or licks (every car, electric ones from their nitro anchors);
//   the wet drive (fx.damp 1) throws no tyre spray, or the dry drive (fx.damp 0.15) throws any.
// First, without a browser, the soft-particle pool (fx-smoke.js): 2000 particles stepped and uploaded for a second must come out
// sorted far to near from the camera, with no NaN, the step + sort + upload under 2 ms.
import { chromium } from 'playwright-core';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three';
import { Soft } from '../src/carkit/fx-smoke.js';

{
  const so = new Soft(), s = so.s, cam = new THREE.PerspectiveCamera();
  for (let i = 0; i < 2000; i++) { Object.assign(s, { x: Math.random() * 200 - 100, y: Math.random() * 3, z: Math.random() * 200 - 100, vx: 1, vy: 0, vz: 0, life: 1 + Math.random() * 3, s0: 0.2, s1: 1.5, grow: 0.5, a0: 0.5, kind: i % 3, own: i % 8, gnd: 0 }); so.emit(); }
  cam.position.set(0, 2, 0); cam.lookAt(10, 1, 3);
  const t0 = performance.now(); for (let k = 0; k < 60; k++) { so.step(1 / 60, 0.3, 0); so.upload(cam); } const ms = (performance.now() - t0) / 60;
  const P = so.at.aPS.array, f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  let prev = Infinity, sorted = true;
  for (let j = 0; j < so.n; j++) { const z = Math.max(0, Math.min(1023, P[j * 4] * f.x + (P[j * 4 + 1] - 2) * f.y + P[j * 4 + 2] * f.z)); if (z > prev + 1 / 32) sorted = false; prev = z; }
  const nan = so.at.aMisc.array.subarray(0, so.n * 4).some(Number.isNaN) || P.subarray(0, so.n * 4).some(Number.isNaN);
  console.log(`soft pool: ${so.n} alive, sorted far-first ${sorted}, NaN ${nan}, ${ms.toFixed(2)} ms per step + upload`);
  if (!sorted || nan || ms > 2 || so.n < 500) { console.log('FAIL: soft pool'); process.exit(1); }
}

const cars = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!cars.length) { console.log('usage: node scripts/test-fx.mjs <car ...>'); process.exit(2); }
const url = 'http://127.0.0.1:5180';
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
let failed = 0;
for (const key of cars) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log(`  [${key}] ${m.text().slice(0, 160)}`); });
  await page.goto(`${url}/sandbox.html?car=${key}&qa=trace`);
  await page.waitForFunction(() => window.sandbox, null, { timeout: 120_000 });
  const r = await page.evaluate(async () => {
    const { car, field, shoot, step, drive, THREE } = window.sandbox, dt = 1 / 60, tint = new THREE.Color(1, 1, 1), out = {};
    const frame = (view, w = 640) => { const cv = shoot(view), c = document.createElement('canvas'); c.width = w; c.height = w * 9 / 16; c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height); return c; };
    const sheet = (tiles, cols) => {
      const tw = tiles[0].width, th = tiles[0].height, c = document.createElement('canvas'); c.width = cols * tw; c.height = Math.ceil(tiles.length / cols) * th;
      tiles.forEach((t, i) => c.getContext('2d').drawImage(t, (i % cols) * tw, Math.floor(i / cols) * th));
      return c.toDataURL('image/png');
    };
    const tick = () => { const t0 = performance.now(); step(dt); field.fx.update(dt, tint); return performance.now() - t0; };
    const reset = () => Object.assign(drive, { x: 0, z: 0, psi: 0, beta: 0, v: 0, t: 0, phase: 0, pt: 0 });
    // pass 1 (dry air, damp 0.15): the engine character, every phase, with close-ups
    field.fx.damp = 0.15; reset();
    let worst = 0, maxSmoke = 0, maxFire = 0, pops = 0, idleSmoke = 0, nitroFire = 0, streams = 0;
    field.onPop = () => { pops++; };
    const idle = [];
    while (drive.phase === 0) { worst = Math.max(worst, tick()); idleSmoke = Math.max(idleSmoke, field.fx.counts.smoke); if (drive.pt > 1.2 && idle.length < 1) idle.push(frame('rearClose', 960)); }
    out.idle = idle.length ? sheet(idle, 1) : null; out.idleSmoke = idleSmoke;
    while (drive.phase === 1) { worst = Math.max(worst, tick()); maxSmoke = Math.max(maxSmoke, field.fx.counts.smoke); }
    const lift = [];                                      // phase 2: every 2nd frame
    let k = 0;
    while (drive.phase === 2) { worst = Math.max(worst, tick()); maxFire = Math.max(maxFire, field.fx.counts.fire); if (k++ % 2 === 0 && lift.length < 16) lift.push(frame('rearClose', 480)); }
    out.lift = sheet(lift, 4); out.maxFireLift = maxFire; out.pops = pops;
    while (drive.phase !== 6) worst = Math.max(worst, tick());
    const nit = [];
    while (drive.phase === 6) {
      worst = Math.max(worst, tick()); nitroFire = Math.max(nitroFire, field.fx.counts.fire); streams = Math.max(streams, field.fx.counts.streams);
      if (drive.pt > 0.9 && nit.length < 1) nit.push(frame('rearClose', 960)); if (drive.pt > 1.4 && nit.length < 2) nit.push(frame('rear34low', 960)); if (drive.pt > 1.7 && nit.length < 3) nit.push(frame('side', 960));
    }
    out.nitro = sheet(nit, 1); out.worstMs = worst; out.electric = !!car.electric; out.counts = field.fx.counts; out.nitroFire = nitroFire; out.streams = streams;
    out.drySpray = field.fx.counts.spray;
    // pass 2 (rain, damp 1): tyre spray and mist while the car accelerates and corners
    field.fx.damp = 1; reset(); const sprayBefore = field.fx.counts.spray, wet = [];
    let t = 0;
    while (drive.phase < 3) { worst = Math.max(worst, tick()); t += dt; if (drive.phase >= 1 && drive.v > 22 && wet.length < 1) wet.push(frame('rear34low', 960)); }
    out.wetSpray = field.fx.counts.spray - sprayBefore; out.wet = wet.length ? sheet(wet, 1) : null;
    field.fx.damp = 0.25;
    return out;
  });
  mkdirSync(`qa/${key}`, { recursive: true });
  for (const [f, n] of [['idle', 'idle'], ['lift', 'lift'], ['nitro', 'nitro'], ['wet', 'wet']]) if (r[f]) writeFileSync(`qa/${key}/fx-${n}.png`, Buffer.from(r[f].split(',')[1], 'base64'));
  await page.close();
  const why = [];
  if (r.electric) { if (r.pops > 0 || r.idleSmoke > 0) why.push('EV pops or makes steam'); }
  else { if (r.pops < 1) why.push('never pops'); if (r.idleSmoke < 1) why.push('no idle steam'); }
  if (r.nitroFire < 1 || r.streams < 1) why.push(`nitro shows no plasma (puffs+streams ${r.nitroFire}, streams ${r.streams})`);
  if (r.wetSpray < 20) why.push(`no tyre spray in the rain (${r.wetSpray})`);
  if (r.drySpray > 0) why.push(`tyre spray in the dry (${r.drySpray})`);
  console.log(`${key}${r.electric ? ' (EV)' : ''}: idle steam ${r.idleSmoke}, pops ${r.pops}, fire ${r.maxFireLift}, nitro puffs+streams ${r.nitroFire} (${r.streams} streams), spray wet ${r.wetSpray} dry ${r.drySpray}, worst step+update ${r.worstMs.toFixed(1)} ms ${why.length ? 'FAIL: ' + why.join('; ') : 'ok'}`);
  if (why.length) failed++;
}
await browser.close();
process.exit(failed ? 1 : 0);
