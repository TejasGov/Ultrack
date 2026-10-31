// India's night-light layout (src/venue/india/layout.js) against the real track.json: the edge fixtures sit on the barrier faces at an
// even pitch and clear of the reflector plates, and the lit band's grid never folds on the tightest bend.
//   node scripts/test-india-lights.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACE, lapPath, edgeFixtures, bandGrid, edgeWeight } from '../src/venue/india/layout.js';

const track = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'india', 'track.json'), 'utf8'));
const C = track.centerline, path = lapPath(C);

// the path: closed, equal to the file's own lap length within the closing gap, tangents unit
assert.ok(Math.abs(path.length - track.lapLength) < 8, `lap ${path.length} vs ${track.lapLength}`);
for (const s of [0, 100.5, path.length - 0.3, path.length + 50]) { const p = path.at(s); assert.ok(Math.abs(Math.hypot(p.tx, p.tz) - 1) < 1e-9); }

// the two hairpins are tighter than the barrier's offset: the layout clamps and fades there instead of folding (the band test below)
let rMin = Infinity;
for (let i = 2; i < C.length - 2; i++) {
  const a = C[i - 2], b = C[i], c = C[i + 2], ab = Math.hypot(b[0] - a[0], b[2] - a[2]), bc = Math.hypot(c[0] - b[0], c[2] - b[2]), ca = Math.hypot(a[0] - c[0], a[2] - c[2]);
  const cross = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]));
  if (cross > 1e-6) rMin = Math.min(rMin, (ab * bc * ca) / (2 * cross));
}
console.log(`tightest bend: radius ${rMin.toFixed(1)} m`);

// fixtures
const fx = edgeFixtures(track), refl = track.reflectors.items;
const lateral = (f) => {   // signed distance from the nearest centreline sample's normal
  let bi = 0, bd = Infinity; C.forEach((p, i) => { const d = (p[0] - f.x) ** 2 + (p[2] - f.z) ** 2; if (d < bd) { bd = d; bi = i; } });
  const a = C[Math.max(0, bi - 1)], b = C[Math.min(C.length - 1, bi + 1)], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz);
  return ((f.x - C[bi][0]) * -tz + (f.z - C[bi][2]) * tx) / l;
};
for (const f of fx) assert.ok(Math.abs(Math.abs(lateral(f)) - FACE) < 0.12, `fixture ${f.s.toFixed(0)} is ${lateral(f).toFixed(2)} m out`);
for (const side of [1, -1]) {
  const L = fx.filter((f) => f.side === side).sort((a, b) => a.s - b.s);
  for (let i = 1; i < L.length; i++) {
    const d = L[i].s - L[i - 1].s, mid = L[i - 1].s + d / 2;
    assert.ok(d > 9.5 && (d < 13.5 || (d < 25 && edgeWeight(path.at(mid), side) < 0.5)), `pitch ${d.toFixed(2)} at ${L[i].s.toFixed(0)}`);   // a longer gap only on the inside of a hairpin
  }
  assert.ok(Math.abs(L.length - path.length / 11.5) < 9, `${L.length} fixtures per side`);   // minus the few inside the hairpins
}
for (const f of fx) for (const r of refl) assert.ok(Math.hypot(r[0] - f.x, r[2] - f.z) > 1.0, `fixture ${f.s.toFixed(0)} sits on a reflector`);
for (const f of fx) assert.ok(Math.abs(Math.hypot(f.nx, f.nz) - 1) < 1e-9);
console.log(`${fx.length} fixtures, pitch 11.5 m, clear of ${refl.length} reflectors`);

// band: where it is lit, each column keeps moving forward along the lap (no fold)
const g = bandGrid(track);
for (let side = 0; side < 2; side++) for (let j = 0; j < g.m; j++) for (let c = 0; c < g.cols; c++) {
  const a = g.rows[side * g.m * g.cols + j * g.cols + c], b = g.rows[side * g.m * g.cols + ((j + 1) % g.m) * g.cols + c], t = path.at(a.j);
  if (Math.min(a.w, b.w) < 0.5) continue;    // inside a hairpin the offset curve turns on itself: the band is faded out there
  assert.ok((b.x - a.x) * t.tx + (b.z - a.z) * t.tz > 0.1, `band column ${c} folds at ${a.j.toFixed(0)} m (side ${side})`);
}
const faded = g.rows.filter((r) => r.w < 0.5 && r.u === 0.04).length;
assert.ok(faded > 0 && faded < 60, `${faded} faded band rows: the hairpins and nothing else`);
console.log(`band: ${g.m} rows x ${g.cols} columns x 2 sides, no fold, ${faded} rows faded on the hairpins' insides`);
console.log('ok');
