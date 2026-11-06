// Cold boot to the race on an emulated link (docs/10x/perf-spec.md, WP0 c): a fresh browser per run, CDP throttling (default 50 Mbit/s down,
// 40 ms RTT), the cache off for the first navigation. Title -> Enter -> menu preload (game.preloadP) -> Race -> Start -> grid -> GO + 5 s.
// Reports when the first /assets/ request started, the car-ready and venue-ready marks, game.loaded (when the harness sees it), the title's Ready, Enter -> preload done, and the longest
// task (longtask) and animation frame (long-animation-frame) in each phase, and boot.task (the longest task that starts before the first fetch). Runs against a production build:
//   npx vite build --outDir qa/10x-scratch/dist && npx vite preview --host 127.0.0.1 --port 5391 --strictPort --outDir qa/10x-scratch/dist
//   node scripts/qa-lock.mjs -- node scripts/perf-boot.mjs <track> [--throttle 50,40] [--rounds 3] [--ab-load <flag>] [--url http://127.0.0.1:5391]
//        [--out qa/perf/boot-<track>.json]
//   --ab-load <flag>: A = /?perf=<flag> (the saving off), B = /, alternating A B A B ...
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { args as parseArgs, root } from './perf-open.mjs';

const { flag, pos } = parseArgs(process.argv.slice(2));
const track = pos[0] ?? 'qingshan', [mbit, rtt] = flag('throttle', '50,40').split(',').map(Number), ROUNDS = +flag('rounds', 3), abLoad = flag('ab-load', null);
const base = flag('url', 'http://127.0.0.1:5391'), out = flag('out', `qa/perf/boot-${track}${abLoad ? '-abload-' + abLoad : ''}.json`);
const CHROME = { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] };
const PHASES = ['title', 'menu', 'Start', 'grid', 'GO'];

async function run(query) {
  const browser = await chromium.launch(CHROME), ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), errors = [];
  await ctx.addInitScript((track) => {
    try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look: 'day', weather: 'dry' } })); } catch { /* none */ }
    // the title's Ready (ui.js TitleScreen ready(): .t-load.done), timed in the mutation's own task, not when the harness next polls
    new MutationObserver((_, o) => { if (document.querySelector('.t-load.done')) { window.__ready = performance.now(); o.disconnect(); } }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
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
  }));
  await browser.close();
  const edges = [0, at.enter, at.start, at.grid, at.go, at.end], longest = {};
  for (const [k, p] of PHASES.entries()) for (const type of ['longtask', 'long-animation-frame'])
    longest[`${p}.${type === 'longtask' ? 'task' : 'loaf'}`] = Math.round(Math.max(0, ...r.long.filter(([t, s]) => t === type && s >= edges[k] && s < edges[k + 1]).map((e) => e[2])));
  // the module-evaluation task: it issues the first data fetch, so it is the longest task that starts before that request (WP6)
  longest['boot.task'] = Math.round(Math.max(0, ...r.long.filter(([t, s]) => t === 'longtask' && s <= r.first[0]).map((e) => e[2])));
  const ms = (x) => Math.round(x);
  return { firstAsset: ms(r.first[0]), firstUrl: r.first[1].slice(0, 60), carReady: ms(r.marks['car-ready'] ?? -1), loaded: ms(at.loaded), titleReady: ms(r.ready), preloadDone: ms(at.preloaded - at.enter), venueReady: ms(r.marks['venue-ready'] ?? -1),
    startToGrid: ms(at.grid - at.start), ...longest, errors: errors.length };
}

const result = { track, throttle: { mbit, rtt }, rounds: ROUNDS, abLoad, arms: {} };
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
mkdirSync(dirname(join(root, out)), { recursive: true });
writeFileSync(join(root, out), JSON.stringify(result, null, 1));
console.log('written', out);
