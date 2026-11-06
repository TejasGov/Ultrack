// Bit-exact check of every track's collision world (docs/10x/perf-spec.md, WP0 e): in a ?dev=1 page, PhysicsWorld.create builds each track's
// world twice, and a SHA-256 covers every collider (in handle order: shape type, vertices, indices, friction, restitution) plus the void-wall
// mesh. The first run writes the baseline (qa/perf/collision-hash.json); a later run fails if a hash differs from it, or build 1 from build 2.
//   node scripts/qa-lock.mjs -- node scripts/test-collision-hash.mjs [--url http://127.0.0.1:5301] [--rebase]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openViewer, args as parseArgs, root } from './perf-open.mjs';

const { flag, has } = parseArgs(process.argv.slice(2));
const file = join(root, 'qa', 'perf', 'collision-hash.json');
const { browser, page, errors } = await openViewer({ track: 'marina', mode: 'dev', base: flag('url', 'http://127.0.0.1:5301') });
const got = await page.evaluate(async () => {
  const { PhysicsWorld } = await import('/src/physics/world.js'), { TRACKS, trackUrl } = await import('/src/tracks.js');
  const hash = async (w) => {
    const parts = [], f64 = (...x) => parts.push(new Float64Array(x)), cols = [];
    w.world.forEachCollider((c) => cols.push(c));
    cols.sort((a, b) => a.handle - b.handle);
    for (const c of cols) { f64(c.handle, c.shapeType(), c.friction(), c.restitution()); parts.push(c.vertices() ?? new Float32Array(), c.indices() ?? new Uint32Array()); }
    if (w.voidWalls.count) parts.push(w.voidWalls.v, w.voidWalls.idx);
    const bytes = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0)); let o = 0;
    for (const p of parts) { bytes.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), o); o += p.byteLength; }
    return { sha: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join(''), colliders: cols.length, voidWalls: w.voidWalls.count };
  };
  const out = {};
  for (const t of Object.values(TRACKS)) {
    const builds = [];
    for (let k = 0; k < 2; k++) {
      const t0 = performance.now(), w = await PhysicsWorld.create(trackUrl(t, 'collision'), { voidWalls: !!t.voidWalls }), ms = Math.round(performance.now() - t0);
      builds.push({ ...await hash(w), ms }); w.dispose();
    }
    out[t.id] = builds;
  }
  return out;
});
await browser.close();
const base = existsSync(file) && !has('rebase') ? JSON.parse(readFileSync(file, 'utf8')) : null;
let bad = 0;
for (const [id, [b1, b2]] of Object.entries(got)) {
  const want = base?.[id]?.sha, ok12 = b1.sha === b2.sha, okBase = !want || (b1.sha === want && b2.sha === want);
  if (!ok12 || !okBase) bad++;
  console.log(`${id.padEnd(9)} ${b1.sha.slice(0, 16)} ${b2.sha.slice(0, 16)} colliders ${b1.colliders} void walls ${b1.voidWalls} build ${b1.ms} / ${b2.ms} ms`,
    ok12 ? '' : 'BUILD 1 != BUILD 2', want ? (okBase ? 'matches baseline' : 'DIFFERS FROM BASELINE ' + want.slice(0, 16)) : 'new baseline');
}
if (!base) { mkdirSync(join(root, 'qa', 'perf'), { recursive: true }); writeFileSync(file, JSON.stringify(Object.fromEntries(Object.entries(got).map(([id, [b]]) => [id, { sha: b.sha, colliders: b.colliders, voidWalls: b.voidWalls }])), null, 1) + '\n'); console.log('baseline written:', file); }
console.log('errors:', errors.length ? errors.slice(0, 4) : 'none');
process.exit(bad ? 1 : 0);
