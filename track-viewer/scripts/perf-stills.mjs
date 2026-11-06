// Deterministic stills for the perf work (docs/10x/perf-spec.md, WP0 b): the bare viewer (?dev=1, the whole 8-car grid), each view drawn by
// viewer.still (paused, cars on the grid, every clock at one t, the reflection cube and PMREM settled), so two sessions give the same PNGs
// and pixel-diff.mjs between them is the harness floor. Views: grid-near / grid-mid / grid-far (camera 12, 40 and 90 m behind the start line:
// the parked cars in LOD bands 0, 1 and 2), T1 and canopy (perf-open.mjs views()).
//   node scripts/qa-lock.mjs -- node scripts/perf-stills.mjs <track> --save <dir> [--looks day,night] [--query perf=<flag>] [--toggle <flag>]
//        [--url http://127.0.0.1:5301]
//   --toggle <flag>: in one session, <dir>/A (viewer.perf[flag] off), <dir>/A2 (off again: the floor) and <dir>/B (on), then pixel-diff of each
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openViewer, args as parseArgs, views, setupLook, retry, root } from './perf-open.mjs';

const { flag, pos } = parseArgs(process.argv.slice(2));
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
console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
if (toggle) for (const [a, b, what] of [['A', 'A2', 'A vs A (floor)'], ['A', 'B', `A vs B (${toggle} off vs on)`]]) {
  console.log('---', what);
  spawnSync(process.execPath, [join(root, 'scripts', 'pixel-diff.mjs'), join(root, save, a), join(root, save, b), '--save', join(root, save, `diff-${a}-${b}`)], { stdio: 'inherit' });
}
