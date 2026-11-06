// Venue leak check (docs/10x/perf-spec.md, WP0 d): the bare viewer (?dev=1) loads llano, marina and qingshan in turn, --cycles times; after each
// cycle two forced GCs, then the JS heap (used + ArrayBuffer backing stores) and three's GPU object counts. Exit 1 if the heap grows by more than
// 40 MB from cycle 1 to the last cycle: a venue switch must give back what the venue took. Each venue loads from prefetched bytes, as the game's
// menu does (WP8 earlyBytes), so the buffer must be let go too.
//   node scripts/qa-lock.mjs -- node scripts/perf-leak.mjs [--cycles 3] [--tracks llano,marina,qingshan] [--url http://127.0.0.1:5180]
import { openViewer, args as parseArgs } from './perf-open.mjs';

const { flag } = parseArgs(process.argv.slice(2));
const cycles = +flag('cycles', 3), tracks = flag('tracks', 'llano,marina,qingshan').split(','), LIMIT = 40;
const { browser, page, errors } = await openViewer({ track: 'marina', mode: 'dev', base: flag('url', 'http://127.0.0.1:5180') });
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
const MB = (b) => +(b / 2 ** 20).toFixed(1), rows = [];
for (let c = 1; c <= cycles; c++) {
  for (const id of tracks) await page.evaluate(async (id) => { await window.viewer.setTrack(id); window.viewer.prefetchVenue?.(); await window.viewer.ensureVenue(); }, id);
  await page.waitForTimeout(3000);   // the deferred work after venue-ready (crowd, team artwork) starts and finishes
  for (let k = 0; k < 2; k++) await cdp.send('HeapProfiler.collectGarbage');
  const h = await cdp.send('Runtime.getHeapUsage'), gpu = await page.evaluate(() => ({ ...window.viewer.renderer.info.memory, programs: window.viewer.renderer.info.programs?.length }));
  const row = { cycle: c, heapMB: MB(h.usedSize + (h.backingStorageSize ?? 0)), usedMB: MB(h.usedSize), backingMB: h.backingStorageSize === undefined ? null : MB(h.backingStorageSize), ...gpu };
  rows.push(row); console.log(JSON.stringify(row));
}
const growth = +(rows.at(-1).heapMB - rows[0].heapMB).toFixed(1);
console.log(`heap growth cycle 1 -> ${cycles}: ${growth} MB (limit ${LIMIT} MB)`, '| errors:', errors.length ? errors.slice(0, 4) : 'none');
await browser.close();
process.exit(growth > LIMIT ? 1 : 0);
