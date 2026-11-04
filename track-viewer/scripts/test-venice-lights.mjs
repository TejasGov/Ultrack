// Venice's night light (src/venue/venice/night.js) against the real track.json and lights.json: the road has no dark gap at racing speed, and the pools don't strobe.
//   node scripts/test-venice-lights.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { poolE, easeE } from '../src/venue/venice/night.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'venice');
const C = JSON.parse(readFileSync(join(dir, 'track.json'), 'utf8')).centerline, L = JSON.parse(readFileSync(join(dir, 'lights.json'), 'utf8'));
const lamps = L.streetLamps;
const E = C.map((p) => easeE(lamps.reduce((s, { pos: q, h }) => s + poolE((p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2, h), 0)));
const covered = (i) => i >= L.covered[0] && i <= L.covered[1];      // the tunnel: its own light line, not lamps
let worst = 0, run = 0, min = Infinity, at = 0;
E.forEach((e, i) => {
  if (covered(i)) { run = 0; return; }
  if (e < min) { min = e; at = i; }
  run = e < 0.06 ? run + 1 : 0; worst = Math.max(worst, run);
});
const open = E.filter((_, i) => !covered(i)), mean = open.reduce((a, b) => a + b) / open.length, darkShare = open.filter((e) => e < 0.06).length / open.length;
console.log(`${lamps.length} lanterns, ${L.wash.length} floods; road light at the centreline: mean ${mean.toFixed(2)}, least ${min.toFixed(3)} at station ${at}, longest dim run ${(worst * 2.5).toFixed(0)} m, dim ${(darkShare * 100).toFixed(1)} %`);
assert.ok(worst * 2.5 <= 60, `a dim run of ${worst * 2.5} m`);      // about a second at racing speed
assert.ok(darkShare < 0.05, `${(darkShare * 100).toFixed(1)} % of the lap is dim`);
// strobing: over any 200 m the brightest point is within a few times the dimmest, on open road with lamps
for (let i = 0; i < E.length; i += 8) {
  const w = Array.from({ length: 80 }, (_, k) => (i + k) % E.length).filter((k) => !covered(k)).map((k) => E[k]); if (w.length < 80) continue;
  const r = Math.max(...w) / Math.max(0.02, Math.min(...w));
  assert.ok(r < 8, `pool contrast ${r.toFixed(1)} at station ${i}`);
}
// lights.json is usable: finite places, and no flood without a radius
for (const l of [...L.streetLamps, ...L.wash]) assert.ok(l.pos.every(Number.isFinite));
for (const w of L.wash) assert.ok(w.r > 0 && w.gain > 0);
console.log('ok');
