// India's surface layer against the real track.json and lights.json: the road map (src/venue/india/layout.js roadMap: lamp light, edge
// band, rubbered line, dust), the lap lookup the road paint split uses, the mesh -> surface rules and the road's smooth shading
// (src/venue/india/materials.js).
//   node scripts/test-india-surfaces.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FACE, lapPath, stations, lampPools, roadMap, nearestOnLap } from '../src/venue/india/layout.js';
import { kindOf, smoothShading } from '../src/venue/india/materials.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'india');
const track = JSON.parse(readFileSync(join(dir, 'track.json'), 'utf8')), lights = JSON.parse(readFileSync(join(dir, 'lights.json'), 'utf8'));
const pools = lampPools(track, lights.streetLamps.map((l) => ({ pos: l.pos })));
const t0 = performance.now(), M = roadMap(track, pools), ms = performance.now() - t0;
const texel = (x, z) => { const i = Math.round((z - M.z0) / M.cell) * M.w + Math.round((x - M.x0) / M.cell); return [0, 1, 2, 3].map((c) => M.data[i * 4 + c] / 255); };
const path = lapPath(track.centerline), { list } = stations(path, 1);
const left = (f, lat) => [f.x - f.tz * lat, f.z + f.tx * lat];

// size and cost: one byte texture of the corridor, baked in well under the venue's other load work
assert.ok(M.w * M.h * 4 < 4e6, `road map ${M.w} x ${M.h}`);
assert.ok(ms < 1500, `bake took ${ms.toFixed(0)} ms`);

// lamp light: right under a pool's centre the stored sqrt(E / 2) decodes to about the peak (1, more where pools overlap)
let under = 0;
for (const p of pools) { const r = texel(p.cx, p.cz)[0]; if (r > 0) under++; if (r > 0) assert.ok(2 * r * r > 0.8, `pool at ${p.cx.toFixed(0)},${p.cz.toFixed(0)}: E ${(2 * r * r).toFixed(2)}`); }
assert.ok(under > pools.length * 0.8, `${under} of ${pools.length} pools fall on the road map`);

// the edge band: full at the barrier face on a straight, faint on the centreline; nothing jumps between neighbouring texels along the lap
const straight = list.filter((f) => Math.abs(f.k) < 1e-4);
assert.ok(straight.length > 200, 'straights');
for (const f of straight.filter((_, i) => i % 40 === 0)) {
  assert.ok(texel(...left(f, FACE - 0.3))[1] > 0.93, `edge band at the wall, ${f.s.toFixed(0)} m`);
  assert.ok(texel(f.x, f.z)[1] ** 2 < 0.05, `edge band on the centreline, ${f.s.toFixed(0)} m`);
}
let jump = 0;
for (let j = 0; j < list.length; j++) { const a = texel(list[j].x, list[j].z)[0], b = texel(list[(j + 1) % list.length].x, list[(j + 1) % list.length].z)[0]; jump = Math.max(jump, Math.abs(a * a - b * b) * 2); }
assert.ok(jump < 0.15, `lamp light jumps by ${jump.toFixed(2)} between texels 1 m apart`);

// the racing line: toward the inside at the apex of every tight bend, and on the road
for (let j = 0; j < list.length; j++) {
  const f = list[j]; if (Math.abs(f.k) < 0.02) continue;
  assert.ok(Math.sign(M.line(f.s)) === Math.sign(f.k), `racing line on the outside at ${f.s.toFixed(0)} m (k ${f.k.toFixed(3)}, line ${M.line(f.s).toFixed(1)})`);
}
for (let s = 0; s < path.length; s += 7) assert.ok(Math.abs(M.line(s)) <= 9.01, 'racing line off the road');
const apex = list.reduce((b, f) => (f.k > b.k ? f : b));          // the tightest left-hander: rubber on the line, little dust there
const onLine = texel(...left(apex, M.line(apex.s)));
assert.ok(onLine[2] > 0.5 && onLine[3] < 0.3, `rubber ${onLine[2].toFixed(2)}, dust ${onLine[3].toFixed(2)} on the line at the apex`);
for (const f of straight.filter((_, i) => i % 40 === 0)) assert.ok(texel(...left(f, Math.sign(M.line(f.s) || 1) * -11.4))[3] > 0.6, `dust at the edge, ${f.s.toFixed(0)} m`);
console.log(`road map ${M.w} x ${M.h} in ${ms.toFixed(0)} ms: ${under}/${pools.length} pools, edge band, racing line, dust ok`);

// the lap lookup (road paint split): a point 5 m left of the line is +5, 5 m right is -5, at the line's height; far off is null
const near = nearestOnLap(track);
for (const f of list.filter((_, i) => i % 97 === 0)) {
  if (Math.abs(f.k) > 0.02) continue;
  const a = near(...left(f, 5)), b = near(...left(f, -5));
  assert.ok(Math.abs(a.lat - 5) < 0.3 && Math.abs(b.lat + 5) < 0.3 && Math.abs(a.y - f.y) < 0.2, `lap lookup at ${f.s.toFixed(0)} m: ${a.lat.toFixed(2)} / ${b.lat.toFixed(2)}`);
}
assert.equal(near(5000, 5000), null);

// the rules: names as three.js sanitises the glTF's (spaces to _, dots dropped)
const K = (names, mat) => kindOf(names, mat);
assert.equal(K(['India_racing_surface_|_232m_|_source_spline001'], 'IN vcol r0.8 m0.0'), 'road');
assert.equal(K(['Edge_paint_1'], 'IN vcol r0.6 m0.0'), 'line');
assert.equal(K(['india_road_paint', 'static_0_-1_1', 'static_0_-1'], 'IN vcol r0.6 m0.0'), 'line');
assert.equal(K(['Source_start_finish_chequer_1', 'Source_start_finish_chequer'], 'IN vcol r0.5 m0.4'), 'line');
assert.equal(K(['Alternating_painted_kerbs_-1_1', 'Alternating_painted_kerbs_-1'], 'IN vcol r0.6 m0.0'), 'kerb');
assert.equal(K(['Concrete_safety_walls_and_fence_uprights_2', 'Concrete_safety_walls_and_fence_uprights'], 'IN vcol r0.6 m0.0'), 'barrier');
assert.equal(K(['Concrete_safety_walls_and_fence_uprights_1', 'Concrete_safety_walls_and_fence_uprights'], 'IN vcol r0.8 m0.0'), 'concrete');
assert.equal(K(['Concrete_safety_walls_and_fence_uprights_3', 'Concrete_safety_walls_and_fence_uprights'], 'IN vcol r0.5 m0.4'), 'metal');
assert.equal(K(['V5_terrain_|_road-side_corridor_(verge,_ditch,_cut,_embankment)'], 'IN vcol r0.8 m0.0 2s'), 'ground');
assert.equal(K(['V5_walls_|_stone_retaining_walls_(road_cuts,_terraces)'], 'IN vcol r0.8 m0.0'), 'stone');
assert.equal(K(['V5_walls_|_concrete_retaining_walls_(road_cuts,_terraces)'], 'IN vcol r0.8 m0.0'), 'concrete');
assert.equal(K(['scatter_kit_0_0_1', 'scatter_kit_0_0'], 'IN vcol r0.8 m0.0'), 'plaster');
assert.equal(K(['scatter_kit_0_0_4', 'scatter_kit_0_0'], 'IN vcol r0.8 m0.0 2s'), null);          // awnings and cloth keep theirs
assert.equal(K(['V5_tea_|_clipped_tea_rows_on_the_contours'], 'IN vcol r0.6 m0.0 2s'), 'leaf');
assert.equal(K(['V5_forest__pine_hero__00_himalayan_pine_A~0-700_1'], 'IN vcol r0.8 m0.0 2s'), null);   // the canopies are india.js's
assert.equal(K(['V5_far_|_snow_massif_north_(fictional,_36_km)'], 'IN vcol r0.8 m0.0'), null);
assert.equal(K(['water'], 'IN vcol r0.8 m0.0'), null);
assert.equal(K(['DRESS_|_floodlight_masts_1'], 'IN vcol r0.4 m0.8'), 'metal');

// smooth shading: two flat quads at an angle, sharing an edge: the shared corners take the mean normal and colour, the others keep theirs
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, /* second quad */ 0, 0, 1, 1, 0, 1, 0, 0.5, 2, 1, 0.5, 2], 3));
const n2 = new THREE.Vector3(0, 1, -0.5).normalize();
geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, ...[0, 1, 2, 3].flatMap(() => n2.toArray())], 3));
geo.setAttribute('color', new THREE.Float32BufferAttribute([...Array(4).fill([0.1, 0.1, 0.1]).flat(), ...Array(4).fill([0.3, 0.3, 0.3]).flat()], 3));
assert.equal(smoothShading(geo), 6);
const N = geo.attributes.normal, C = geo.attributes.color, mid = new THREE.Vector3(0, 1, 0).add(n2).normalize();
for (const i of [2, 3, 4, 5]) { assert.ok(new THREE.Vector3().fromBufferAttribute(N, i).distanceTo(mid) < 1e-6, `shared corner ${i}`); assert.ok(Math.abs(C.getX(i) - 0.2) < 1e-6); }
assert.ok(Math.abs(N.getY(0) - 1) < 1e-6 && Math.abs(C.getX(0) - 0.1) < 1e-6 && Math.abs(C.getX(7) - 0.3) < 1e-6, 'the unshared corners keep theirs');
console.log('rules, lap lookup, smooth shading ok');
console.log('ok');
