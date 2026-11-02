// A solid wall with nothing to see: for every station and side, is anything visible where the collision wall stands? The game's own loaded scene (all meshes that are showing, instances
// included) against rays across col_wall at bumper, door and roof height. Prints the stretches where the wall is solid and nothing is drawn, and writes them to qa/unseen-walls-<track>.json.
//   node scripts/qa-lock.mjs -- node scripts/qa-unseen-walls.mjs infinia [url]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'infinia', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = JSON.parse(readFileSync(join(root, 'public', 'assets', track, 'track.json'), 'utf8')).centerline;
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.addInitScript((t) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: t, look: 'day', weather: 'dry' } })); } catch { /* none */ } }, track);
const page = await ctx.newPage();
await page.goto(base);
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.click('.bento-tile[data-id=free]');
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.field?.pw, null, { timeout: 300000 });
const res = await page.evaluate(async ({ C }) => {
  const { initPhysics } = await import('/src/physics/world.js'), RAPIER = await initPhysics(), pw = window.game.field.pw, n = C.length, car = window.game.field.hero.root;
  let scene = car; while (scene.parent) scene = scene.parent;
  const left = (i) => { const a = C[(i + n - 1) % n], b = C[(i + 1) % n], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1; return [tz / l, -tx / l]; };
  const isWall = (c) => pw.surfaceOf.get(c.handle)?.name === 'wall';
  // the corridor's visible triangles, hashed in 4 m cells
  const near = new Set(), key = (x, z) => `${Math.floor(x / 40)},${Math.floor(z / 40)}`;
  for (const p of C) for (const dx of [-40, 0, 40]) for (const dz of [-40, 0, 40]) near.add(key(p[0] + dx, p[2] + dz));
  const CELL = 4, grid = new Map(), tris = []; let meshes = 0;
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const add = (a, b, c) => {
    const x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), z0 = Math.min(a[2], b[2], c[2]), z1 = Math.max(a[2], b[2], c[2]);
    if (x1 - x0 > 400 || z1 - z0 > 400) return;
    const id = tris.length; tris.push([a, b, c]);
    for (let x = Math.floor(x0 / CELL); x <= Math.floor(x1 / CELL); x++) for (let z = Math.floor(z0 / CELL); z <= Math.floor(z1 / CELL); z++) { const k = x * 100003 + z; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(id); }
  };
  const M = car.matrixWorld.constructor, tmp = new M(), wm = new M();
  scene.updateMatrixWorld(true);
  const carParts = new Set(); car.traverse((o) => carParts.add(o));
  scene.traverse((o) => {
    if (!o.isMesh || carParts.has(o) || !shown(o)) return;
    const g = o.geometry, P = g?.attributes?.position; if (!P) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat && (mat.opacity === 0 || mat.visible === false || mat.colorWrite === false)) return;
    const idx = g.index?.array, count = idx ? idx.length : P.count, inst = o.isInstancedMesh ? o.count : 1; meshes++;
    for (let k = 0; k < inst; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, tmp); wm.multiplyMatrices(o.matrixWorld, tmp); } else wm.copy(o.matrixWorld);
      const e = wm.elements, tp = (i) => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
      if (o.isInstancedMesh) { const c = tp(0); if (!near.has(key(c[0], c[2]))) continue; }
      for (let t = 0; t + 3 <= count; t += 3) { const a = tp(idx ? idx[t] : t); if (!near.has(key(a[0], a[2]))) continue; add(a, tp(idx ? idx[t + 1] : t + 1), tp(idx ? idx[t + 2] : t + 2)); }
    }
  });
  const ray = (o, d, far) => {   // Moller-Trumbore on the cells the segment crosses; both faces count, a wall seen from behind is still a wall
    const seen = new Set(), steps = Math.ceil(far) + 1; let best = Infinity;
    for (let s = 0; s <= steps; s++) {
      const x = o[0] + d[0] * far * s / steps, z = o[2] + d[2] * far * s / steps, l = grid.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL)); if (!l) continue;
      for (const id of l) {
        if (seen.has(id)) continue; seen.add(id); const [a, b, c] = tris[id];
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
        if (Math.abs(det) < 1e-9) continue;
        const iv = 1 / det, tv = [o[0] - a[0], o[1] - a[1], o[2] - a[2]], u = iv * (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]); if (u < 0 || u > 1) continue;
        const q = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]], v = iv * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]); if (v < 0 || u + v > 1) continue;
        const h = iv * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]); if (h > 0 && h < far && h < best) best = h;
      }
    }
    return best;
  };
  const rows = [];
  for (let i = 0; i < n; i++) for (const sd of [1, -1]) {
    const [lx, lz] = left(i), p = C[i], hit = pw.world.castRay(new RAPIER.Ray({ x: p[0], y: p[1] + 0.5, z: p[2] }, { x: lx * sd, y: 0, z: lz * sd }), 70, true, undefined, undefined, undefined, undefined, isWall);
    if (!hit) { rows.push({ i, sd, R: null, shown: 0 }); continue; }
    const R = hit.timeOfImpact; let shownAt = 0, first = Infinity;
    for (const h of [0.25, 0.55, 0.9]) { const o = [p[0] + lx * sd * (R - 1.2), p[1] + h, p[2] + lz * sd * (R - 1.2)], d = ray(o, [lx * sd, 0, lz * sd], 2.0); if (d < 2) { shownAt++; first = Math.min(first, d - 1.2); } }
    rows.push({ i, sd, R: +R.toFixed(1), shown: shownAt, gap: first === Infinity ? null : +first.toFixed(2) });
  }
  return { meshes, tris: tris.length, rows };
}, { C });
await browser.close();
mkdirSync(join(root, 'qa'), { recursive: true }); writeFileSync(join(root, 'qa', `unseen-walls-${track}.json`), JSON.stringify(res.rows));
console.log(`${track}: ${res.meshes} meshes, ${res.tris} corridor triangles`);
for (const sd of [1, -1]) {
  const runs = [];
  for (const r of res.rows.filter((x) => x.sd === sd)) { if (r.shown > 0 && r.R !== null) continue; const c = runs.at(-1); if (c && r.i - c.to <= 2) { c.to = r.i; c.R.push(r.R); } else runs.push({ from: r.i, to: r.i, R: [r.R] }); }
  console.log(` ${sd > 0 ? 'left ' : 'right'}: unseen ${runs.reduce((a, c) => a + c.to - c.from + 1, 0)} of ${C.length} stations in ${runs.length} runs:`, runs.slice(0, 30).map((c) => `${c.from}-${c.to} (R ${c.R[0]})`).join(', '));
}
