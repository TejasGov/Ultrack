// Deterministic stills for the perf work (docs/10x/perf-spec.md, WP0 b): the bare viewer (?dev=1, the whole 8-car grid), each view drawn by
// viewer.still (paused, cars on the grid, every clock at one t, the reflection cube and PMREM settled), so two sessions give the same PNGs
// and pixel-diff.mjs between them is the harness floor. Views: grid-near / grid-mid / grid-far (camera 12, 40 and 90 m behind the start line:
// the parked cars in LOD bands 0, 1 and 2), T1 and canopy (perf-open.mjs views()).
//   node scripts/qa-lock.mjs -- node scripts/perf-stills.mjs <track> --save <dir> [--looks day,night] [--query perf=<flag>] [--toggle <flag>]
//        [--url http://127.0.0.1:5301]
//   --toggle <flag>: in one session, <dir>/A (viewer.perf[flag] off), <dir>/A2 (off again: the floor) and <dir>/B (on), then pixel-diff of each
//   --dump-wheels: also writes <dir>/wheels.json, every car's stand-in wheels and far proxy as car-local triangles (position, normal, uv)
//        per material plus each mesh's castShadow, receiveShadow, renderOrder, frustumCulled and visible (WP2's geometry check)
//   node scripts/perf-stills.mjs --compare-wheels <a/wheels.json> <b/wheels.json>: exits 1 unless both hold the same triangles per material
//        (each triangle matched once, any starting vertex, same winding, within 1e-4: float32 baking moves values across a 1e-5 rounding
//        step, so rounded values alone do not compare) and the same flag sets
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openViewer, args as parseArgs, views, setupLook, retry, root } from './perf-open.mjs';

const { flag, pos, has } = parseArgs(process.argv.slice(2));

/** the triangles of a and b (arrays of 3 vertices of equal length) pair up one to one within tol, any cyclic start: unmatched count */
function unmatched(a, b, tol = 1e-4) {
  if (a.length !== b.length) return Math.abs(a.length - b.length) || 1;
  const L = (a[0]?.length ?? 0) / 3, cx = (t) => (t[0] + t[L] + t[2 * L]) / 3, sb = b.map((t) => [cx(t), t]).sort((x, y) => x[0] - y[0]), used = new Uint8Array(b.length);
  let miss = 0;
  for (const t of a) {
    const c = cx(t); let lo = 0, hi = sb.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sb[m][0] < c - tol) lo = m + 1; else hi = m; }
    let ok = false;
    for (let i = lo; i < sb.length && sb[i][0] <= c + tol && !ok; i++) {
      if (used[i]) continue;
      for (let r = 0; r < 3 && !ok; r++) if (t.every((x, k) => Math.abs(x - sb[i][1][(k + r * L) % (3 * L)]) <= tol)) { ok = true; used[i] = 1; }
    }
    if (!ok) miss++;
  }
  return miss;
}
{ // self-check: a rotated, slightly moved copy matches; a reversed winding or a 1 mm move does not
  const t1 = [0, 0, 0, 1, 0, 0, 0, 1, 0], t2 = [5, 0, 0, 6, 0, 0, 5, 1, 0], mv = (t, e) => t.map((x) => x + e);
  if (unmatched([t1, t2], [mv([...t2.slice(3), ...t2.slice(0, 3)], 3e-6), t1]) || unmatched([t1], [[...t1.slice(6), ...t1.slice(3, 6), ...t1.slice(0, 3)]]) !== 1
    || unmatched([t1, t2], [t1, mv(t2, 1e-3)]) !== 1 || unmatched([t1], [t1, t2]) !== 1) throw Error('perf-stills unmatched() self-check failed');
}
if (flag('compare-wheels', null)) {
  const [A, B] = [flag('compare-wheels'), pos[0]].map((f) => JSON.parse(readFileSync(f, 'utf8'))), bad = [];
  if (A.length !== B.length) bad.push(`${A.length} vs ${B.length} cars`);
  let tris = 0;
  for (const ca of A) {
    const cb = B.find((c) => c.key === ca.key); if (!cb) { bad.push(ca.key + ' missing'); continue; }
    const groups = (c) => [...c.simple.map((g, i) => ['wheel-lod ' + i, g]), ['wheels-far', c.proxy]];
    for (const [[name, ga], [, gb]] of groups(ca).map((g, i) => [g, groups(cb)[i]])) {
      for (const m of new Set([...Object.keys(ga.mats), ...Object.keys(gb?.mats ?? {})])) {
        const x = ga.mats[m], y = gb?.mats[m], where = `${ca.key} ${name} ${m}`;
        if (!x || !y) { bad.push(where + ' only on one side'); continue; }
        const miss = unmatched(x.tris, y.tris); tris += x.tris.length;
        if (miss) bad.push(`${where}: ${x.tris.length} vs ${y.tris.length} triangles, ${miss} unmatched`);
        if ([...x.flags].sort().join('|') !== [...y.flags].sort().join('|')) bad.push(`${where}: flags ${x.flags.join('|')} vs ${y.flags.join('|')}`);
      }
    }
  }
  const meshes = (D) => D.map((c) => `${c.key} ${c.simple.map((g) => g.meshes).join('/')} far ${c.proxy.meshes}`).join(', ');
  console.log('meshes A:', meshes(A)); console.log('meshes B:', meshes(B));
  console.log(bad.length ? 'DIFFERENT:\n  ' + bad.join('\n  ') : `same: ${A.length} cars, ${tris} triangles matched, flag sets equal`);
  process.exit(bad.length ? 1 : 0);
}
const track = pos[0] ?? 'qingshan', save = flag('save', null), looks = flag('looks', 'day').split(','), toggle = flag('toggle', null);
if (!save) { console.error('usage: node scripts/perf-stills.mjs <track> --save <dir> [--looks day,night] [--query perf=x] [--toggle x] [--url ...]'); process.exit(2); }
const { C, N, V } = views(track);
const cum = [0]; for (let i = 1; i < N; i++) cum.push(cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][2] - C[i - 1][2]));   // main.js buildPath's cumLen: dist along the lap
const VIEWS = { 'grid-near': -12, 'grid-mid': -40, 'grid-far': -90, T1: cum[V.T1], canopy: cum[V.canopy] };
const query = [track === 'tokyo' ? '' : 'track=' + track, flag('query', '')].filter(Boolean).join('&');
const { browser, page, errors } = await openViewer({ track, look: looks[0], mode: 'dev', base: flag('url', 'http://127.0.0.1:5301'), query });

// everything that loads late (LOD1 bodies, the crowd, team artwork) must be in before the first still, or two sessions differ by timing
await page.evaluate(async () => {
  const sig = () => performance.getEntriesByType('resource').length + ':' + window.viewer.people();
  let last = sig(), still = 0;
  for (let k = 0; k < 120 && still < 5; k++) { await new Promise((r) => setTimeout(r, 1000)); const s = sig(); still = s === last ? still + 1 : 0; last = s; }
});
const info = await page.evaluate(() => ({ tier: window.viewer.device.tier, quality: window.viewer.params.quality, people: window.viewer.people(), track: window.viewer.trackId() }));
console.log(`${track}: viewer on ${info.track}, tier ${info.tier} (quality ${info.quality}), ${info.people} people`);
if (info.track !== track) { console.error('the viewer opened the wrong track'); process.exit(1); }

const shot = async (dir, name, d) => {
  const png = await page.evaluate((d) => window.viewer.still({ dist: d }), d);
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, name + '.png'), Buffer.from(png.split(',')[1], 'base64'));
};
for (const look of looks) {
  await retry(page, setupLook, [look, 'dry', {}]);
  await page.waitForTimeout(1500);
  for (const [name, d] of Object.entries(VIEWS)) {
    const tag = `${look}-${name}`;
    if (!toggle) { await shot(save, tag, d); console.log('saved', tag); continue; }
    const set = (on) => page.evaluate(([f, on]) => { window.viewer.perf[f] = on; window.viewer.applyAll(); }, [toggle, on]);
    await set(false); await shot(join(save, 'A'), tag, d); await shot(join(save, 'A2'), tag, d);
    await set(true); await shot(join(save, 'B'), tag, d);
    console.log('saved', tag, 'A A2 B');
  }
}
if (has('dump-wheels')) {   // after a still: wheels straight and unspun, so car-local is the same in every session
  const dump = await page.evaluate(() => {
    const T = window.viewer.THREE, r5 = (x) => Math.round(x * 1e5) / 1e5;
    return window.viewer.field().all.map((c) => {
      c.car.updateMatrixWorld(true);
      const inv = c.car.matrixWorld.clone().invert(), name = (m) => Object.keys(c.materials).find((k) => c.materials[k] === m) ?? m.name;
      const group = (g) => {
        const mats = {}; let meshes = 0;
        g.traverse((o) => {
          if (!o.isMesh) return;
          meshes++;
          const M = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld), nm = new T.Matrix3().getNormalMatrix(M), b = mats[name(o.material)] ??= { tris: [], flags: [] };
          const { position: P, normal: N, uv: U } = o.geometry.attributes, idx = o.geometry.index, n = idx ? idx.count : P.count, p = new T.Vector3(), q = new T.Vector3();
          for (let i = 0; i < n; i += 3) {
            const t = [];
            for (let j = 0; j < 3; j++) { const k = idx ? idx.getX(i + j) : i + j; p.fromBufferAttribute(P, k).applyMatrix4(M); q.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); t.push(...[p.x, p.y, p.z, q.x, q.y, q.z, ...(U ? [U.getX(k), U.getY(k)] : [])].map(r5)); }
            b.tris.push(t);
          }
          const fl = [o.castShadow, o.receiveShadow, o.renderOrder, o.frustumCulled, o.visible].join(); if (!b.flags.includes(fl)) b.flags.push(fl);
        });
        return { meshes, mats };
      };
      return { key: c.key, simple: c.simple.map(group), proxy: group(c.proxy) };
    });
  });
  writeFileSync(join(root, save, 'wheels.json'), JSON.stringify(dump));
  console.log(`wheels.json: ${dump.length} cars, meshes per stand-in wheel ${[...new Set(dump.flatMap((c) => c.simple.map((g) => g.meshes)))]}, per far proxy ${[...new Set(dump.map((c) => c.proxy.meshes))]}`);
}
console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
if (toggle) for (const [a, b, what] of [['A', 'A2', 'A vs A (floor)'], ['A', 'B', `A vs B (${toggle} off vs on)`]]) {
  console.log('---', what);
  spawnSync(process.execPath, [join(root, 'scripts', 'pixel-diff.mjs'), join(root, save, a), join(root, save, b), '--save', join(root, save, `diff-${a}-${b}`)], { stdio: 'inherit' });
}
