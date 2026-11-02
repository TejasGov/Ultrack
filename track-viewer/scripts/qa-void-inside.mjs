// Every invisible void wall a car on the ground can touch: pieces inside (or within 30 cm of) the visible barrier, with their angle to the road (90 = standing across it, hit head on).
//   node scripts/qa-lock.mjs -- node scripts/qa-void-inside.mjs infinia
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const [track = 'infinia', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const C = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', track, 'track.json'), 'utf8')).centerline;
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true });
const page = await browser.newPage(); await page.goto(base);
const res = await page.evaluate(async ({ track, C }) => {
  const { PhysicsWorld, initPhysics } = await import('/src/physics/world.js'), RAPIER = await initPhysics();
  const url = `/assets/${track}/${track}_collision.glb`, w = await PhysicsWorld.create(url), full = await PhysicsWorld.create(url, { voidWalls: true }), V = full.voidWalls.v, n = C.length, out = [];
  const isWall = (c) => w.surfaceOf.get(c.handle)?.name === 'wall';
  const tan = (i) => { const a = C[(i + n - 1) % n], b = C[(i + 1) % n], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; };
  const reach = (i, sd, y) => { const [tx, tz] = tan(i), lx = tz, lz = -tx, p = C[i], h = w.world.castRay(new RAPIER.Ray({ x: p[0], y: y + 0.5, z: p[2] }, { x: lx * sd, y: 0, z: lz * sd }), 70, true, undefined, undefined, undefined, undefined, isWall); return h ? h.timeOfImpact : 70; };
  for (let q = 0; q + 12 <= V.length; q += 12) {
    const mx = (V[q] + V[q + 3]) / 2, my = (V[q + 1] + V[q + 4]) / 2 + 1, mz = (V[q + 2] + V[q + 5]) / 2; let best = 0, bd = 1e9;
    for (let i = 0; i < n; i++) { const d = Math.hypot(C[i][0] - mx, (C[i][1] - my) * 2, C[i][2] - mz); if (d < bd) { bd = d; best = i; } }
    if (bd > 75) continue;
    const [tx, tz] = tan(best), lx = tz, lz = -tx, lat = (mx - C[best][0]) * lx + (mz - C[best][2]) * lz, R = reach(best, lat > 0 ? 1 : -1, C[best][1]);
    if (Math.abs(lat) > R + 0.3 || Math.abs(my - C[best][1]) > 3 || my - C[best][1] > 2) continue;   // panels that start over the roof catch only a car in the air
    const ex = V[q + 3] - V[q], ez = V[q + 5] - V[q + 2], el = Math.hypot(ex, ez) || 1, angle = Math.acos(Math.abs((ex * tx + ez * tz) / el)) * 180 / Math.PI;
    out.push({ station: best, lat: +lat.toFixed(1), R: +R.toFixed(1), angle: Math.round(angle), len: +el.toFixed(1), dy: +(my - C[best][1]).toFixed(1) });
  }
  return { total: full.voidWalls.count, n, out };
}, { track, C });
await browser.close();
const clusters = [];
for (const h of res.out.sort((a, b) => a.station - b.station)) { const c = clusters.at(-1); if (c && h.station - c.to < 6) { c.to = h.station; c.l.push(h); } else clusters.push({ from: h.station, to: h.station, l: [h] }); }
console.log(`${track}: ${res.total} void walls, ${res.out.length} reachable, in ${clusters.length} places`);
for (const c of clusters) { const lats = c.l.map((h) => h.lat); console.log(` ${c.from}-${c.to} x${c.l.length} lat ${Math.min(...lats)}..${Math.max(...lats)} R ${c.l[0].R} max angle ${Math.max(...c.l.map((h) => h.angle))} total ${c.l.reduce((a, h) => a + h.len, 0).toFixed(1)} m`); }
