// Cold boot to the race on an emulated link (docs/10x/perf-spec.md, WP0 c): a fresh browser per run, CDP throttling (default 50 Mbit/s down,
// 40 ms RTT), the cache off for the first navigation. Title -> Enter -> menu preload (game.preloadP) -> Race -> Start -> grid -> GO + 5 s.
// Reports when the first /assets/ request started, the car-ready and venue-ready marks, when the LOD1 car bodies start and finish and when GO is, game.loaded (when the harness sees it), the title's Ready, Enter -> preload done, and the longest
// task (longtask) and animation frame (long-animation-frame) in each phase, boot.task (the longest task that starts before the first fetch), and how many
// times the venue and collision GLBs were downloaded (exits 1 unless each was downloaded exactly once in every round). Runs against a production build:
//   npx vite build --outDir qa/10x-scratch/dist && npx vite preview --host 127.0.0.1 --port 5391 --strictPort --outDir qa/10x-scratch/dist
//   node scripts/qa-lock.mjs -- node scripts/perf-boot.mjs <track> [--throttle 50,40] [--rounds 3] [--ab-load <flag>] [--url http://127.0.0.1:5391]
//        [--garage 0] [--out qa/perf/boot-<track>.json]
//   --garage <ms>: right after Enter, open the garage for that long, then Escape. The garage pauses the menu preload before it reaches
//   ensureVenue, so a car's 1.8 s LOD1 timer fires first (Enter -> preload done then includes the garage time).
//   With farAfterVenue on, it also exits 1 if any LOD1 body was requested before venue-ready (farEarly).
//   --ab-load <flag>: A = /?perf=<flag> (the saving off), B = /, alternating A B A B ...
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { args as parseArgs, root } from './perf-open.mjs';

const { flag, pos } = parseArgs(process.argv.slice(2));
const track = pos[0] ?? 'qingshan', [mbit, rtt] = flag('throttle', '50,40').split(',').map(Number), ROUNDS = +flag('rounds', 3), abLoad = flag('ab-load', null), garage = +flag('garage', 0);
const base = flag('url', 'http://127.0.0.1:5391'), out = flag('out', `qa/perf/boot-${track}${abLoad ? '-abload-' + abLoad : ''}.json`);
const CHROME = { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] };
const PHASES = ['title', 'menu', 'Start', 'grid', 'GO'];

async function run(query) {
  const browser = await chromium.launch(CHROME), ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), errors = [];
  await ctx.addInitScript((track) => {
    try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look: 'day', weather: 'dry' } })); } catch { /* none */ }
    // the title's Ready (ui.js TitleScreen ready(): .t-load.done), timed in the mutation's own task, not when the harness next polls
    new MutationObserver((_, o) => { if (document.querySelector('.t-load.done')) { window.__ready = performance.now(); o.disconnect(); } }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
    performance.setResourceTimingBufferSize(5000);   // the default 250 entries fill before the LOD1 bodies arrive
    const L = window.__long = [];
    for (const type of ['longtask', 'long-animation-frame']) try { new PerformanceObserver((l) => { for (const e of l.getEntries()) L.push([type, e.startTime, e.duration]); }).observe({ type, buffered: true }); } catch { /* not supported */ }
  }, track);
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: mbit * 125000, uploadThroughput: 10 * 125000 });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const now = () => page.evaluate(() => performance.now()), at = {};
  await page.goto(base + (query ? '/?' + query : '/'));
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 600000, polling: 50 });
  at.loaded = await now();
  await page.keyboard.press('Enter'); at.enter = await now();
  if (garage) { await page.evaluate(() => window.game.show('garage')); await page.waitForTimeout(garage); await page.keyboard.press('Escape'); }
  await page.waitForFunction(() => window.game.preloadP, null, { timeout: 60000 });
  at.preloaded = await page.evaluate(() => window.game.preloadP.then(() => performance.now(), () => -performance.now()));
  await page.click('.bento-tile[data-id=race]');
  await page.click('.panel.setup button.cta'); at.start = await now();
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 600000, polling: 50 });
  at.grid = await now();
  await page.waitForFunction(() => window.game.session?.state === 'running', null, { timeout: 120000, polling: 50 });
  at.go = await now();
  await page.waitForTimeout(5000); at.end = await now();
  const r = await page.evaluate(() => ({
    marks: Object.fromEntries(performance.getEntriesByType('mark').map((m) => [m.name.replace('ultrack:', ''), m.startTime])),
    // the first data fetch (car, track, venue, transcoder), not the bundle's own hashed scripts, fonts and images that also live under /assets/
    first: performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname.startsWith('/assets/') && ['fetch', 'xmlhttprequest'].includes(e.initiatorType)).map((e) => [e.startTime, e.name.replace(location.origin, '')]).sort((a, b) => a[0] - b[0])[0] ?? [-1, ''],
    long: window.__long, ready: window.__ready ?? -1,
    // full downloads of the venue and collision GLBs (WP8 earlyBytes must not fetch either twice); tracks.js's 2-byte availability probes are not downloads
    gets: [/_visual(_ktx2)?\.glb$/, /_collision\.glb$/].map((re) => performance.getEntriesByType('resource').filter((e) => re.test(new URL(e.name).pathname) && e.decodedBodySize > 1024).length),
    // the distant (LOD1) car bodies: when the first one starts and the last one is in (WP7: they wait for the venue; GO is their deadline)
    far: ((e) => e.length ? [Math.min(...e.map((x) => x.startTime)), Math.max(...e.map((x) => x.responseEnd))] : [-1, -1])(performance.getEntriesByType('resource').filter((e) => /\/cars\/[^/]+\/[^/]*_lod1[^/]*\.glb$/.test(new URL(e.name).pathname))),
  }));
  await browser.close();
  const edges = [0, at.enter, at.start, at.grid, at.go, at.end], longest = {};
  for (const [k, p] of PHASES.entries()) for (const type of ['longtask', 'long-animation-frame'])
    longest[`${p}.${type === 'longtask' ? 'task' : 'loaf'}`] = Math.round(Math.max(0, ...r.long.filter(([t, s]) => t === type && s >= edges[k] && s < edges[k + 1]).map((e) => e[2])));
  // the module-evaluation task: it issues the first data fetch, so it is the longest task that starts before that request (WP6)
  longest['boot.task'] = Math.round(Math.max(0, ...r.long.filter(([t, s]) => t === 'longtask' && s <= r.first[0]).map((e) => e[2])));
  const ms = (x) => Math.round(x);
  return { firstAsset: ms(r.first[0]), firstUrl: r.first[1].slice(0, 60), carReady: ms(r.marks['car-ready'] ?? -1), loaded: ms(at.loaded), titleReady: ms(r.ready), preloadDone: ms(at.preloaded - at.enter), venueReady: ms(r.marks['venue-ready'] ?? -1),
    venueGets: r.gets[0], collisionGets: r.gets[1], farStart: ms(r.far[0]), farEnd: ms(r.far[1]), goAt: ms(at.go),
    farEarly: !/(^|,)(off|farAfterVenue)(,|$)/.test(new URLSearchParams(query).get('perf') ?? '') && r.far[0] >= 0 && r.far[0] < (r.marks['venue-ready'] ?? Infinity) ? 1 : 0,
    startToGrid: ms(at.grid - at.start), ...longest, errors: errors.length };
}

const result = { track, throttle: { mbit, rtt }, rounds: ROUNDS, abLoad, garage, arms: {} };
for (let k = 0; k < ROUNDS; k++) for (const [arm, q] of abLoad ? [['A', 'perf=' + abLoad], ['B', '']] : [['base', '']]) {
  const r = await run(q);
  (result.arms[arm] ??= { rounds: [] }).rounds.push(r);
  console.log(`[${track}] ${arm}`, JSON.stringify(r));
}
const med = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
for (const [arm, a] of Object.entries(result.arms)) {
  const keys = Object.keys(a.rounds[0]).filter((k) => typeof a.rounds[0][k] === 'number');
  a.median = Object.fromEntries(keys.map((k) => [k, med(a.rounds.map((r) => r[k]))]));
  a.spread = Object.fromEntries(keys.map((k) => [k, Math.max(...a.rounds.map((r) => r[k])) - Math.min(...a.rounds.map((r) => r[k]))]));
  console.log(`[${track}] ${arm} median`, JSON.stringify(a.median), `\n[${track}] ${arm} spread`, JSON.stringify(a.spread));
}
if (result.arms.A && result.arms.B) {
  const A = result.arms.A, B = result.arms.B;
  result.verdict = Object.fromEntries(Object.keys(A.median).map((k) => { const d = B.median[k] - A.median[k], sp = Math.max(A.spread[k], B.spread[k]); return [k, { d, spread: sp, beyond: Math.abs(d) > sp }]; }));
  for (const [k, v] of Object.entries(result.verdict)) console.log(`B - A ${k.padEnd(20)} ${String(v.d).padStart(7)} ms  spread ${String(v.spread).padStart(6)}  ${v.beyond ? 'BEYOND SPREAD' : 'within noise'}`);
}
mkdirSync(dirname(resolve(root, out)), { recursive: true });
writeFileSync(resolve(root, out), JSON.stringify(result, null, 1));
console.log('written', out);
const twice = Object.values(result.arms).flatMap((a) => a.rounds).filter((r) => r.venueGets !== 1 || r.collisionGets !== 1);
if (twice.length) { console.log(`FAIL: ${twice.length} round(s) without exactly one venue and one collision GLB download`); process.exit(1); }
const early = Object.values(result.arms).flatMap((a) => a.rounds).filter((r) => r.farEarly);
if (early.length) { console.log(`FAIL: ${early.length} round(s) requested a LOD1 car body before venue-ready with farAfterVenue on`); process.exit(1); }
