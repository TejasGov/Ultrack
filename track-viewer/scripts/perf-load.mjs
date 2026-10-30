// Load timing of the game, cold (a fresh browser profile: empty HTTP cache) then warm (the same profile reloaded), per track:
// page open -> title ready (game.loaded: the menu answers) -> menu preload done (venue + race shaders warmed) and, clicking
// Free Drive + Start straight away ("rush"), page open -> first drivable frame. Also bytes and the slowest requests.
//   node scripts/qa-lock.mjs -- node scripts/perf-load.mjs [marina,tokyo] [--url http://127.0.0.1:5180] [--out qa/perf/load-x.json] [--query a=b]
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { args as parseArgs } from './perf-open.mjs';

const { flag, pos } = parseArgs(process.argv.slice(2));
const tracks = (pos[0] ?? 'marina,tokyo').split(','), flow = flag('flow', 'rush'), base = flag('url', 'http://127.0.0.1:5180'), query = flag('query', '');
const launch = () => chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });

async function run(ctx, track, label) {
  const page = await ctx.newPage(), logs = [], errors = [];
  page.on('console', (m) => { const t = m.text(); if (/^@\d+/.test(t) || m.type() === 'error') logs.push(t.slice(0, 300)); if (m.type() === 'error') errors.push(t.slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base + (query ? '/?' + query : ''));
  const at = () => page.evaluate(() => Math.round(performance.now()));
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000, polling: 50 });
  const titleReady = await at();
  await page.waitForFunction(() => window.viewer?.renderer.info.render.frame > 0, null, { timeout: 60000, polling: 20 });   // the first title frame drawn (a frame that blocks the page delays this poll too)
  const firstFrame = await at();
  // rush: straight into Free Drive, the way an impatient player would; patient: the menu preload (venue, cars, race shaders) finishes first
  await page.keyboard.press('Enter');
  let preloaded = null;
  if (flow === 'patient') { await page.waitForFunction(() => window.game.warmP && (window.game.warmP.then(() => { window.__warmed = true; }), window.__warmed), null, { timeout: 300000, polling: 100 }); preloaded = await at(); }
  await page.waitForSelector('.bento-tile[data-id=free]', { state: 'visible' });
  await page.click('.bento-tile[data-id=free]');
  await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
  const startClick = await at();
  await page.click('.panel.setup button.cta');
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000, polling: 50 });
  const drivable = await at();
  const r = await page.evaluate(() => {
    const marks = Object.fromEntries(performance.getEntriesByType('mark').filter((m) => m.name.startsWith('ultrack:')).map((m) => [m.name.slice(8), Math.round(m.startTime)]));
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource').map((e) => ({ url: e.name.replace(location.origin, ''), start: Math.round(e.startTime), ms: Math.round(e.duration), kb: Math.round(e.transferSize / 1024), body: Math.round(e.decodedBodySize / 1024) }));
    const kind = (u) => (/\.(js|mjs|ts|jsx|css)(\?|$)|^\/(src|node_modules|@)/.test(u) ? 'code' : /\.glb/.test(u) ? 'glb' : /\.(ktx2|webp|png|jpg|hdr)/.test(u) ? 'image' : /\.(ogg|mp3|wav|m4a)/.test(u) ? 'audio' : 'other');
    const by = {}; for (const e of res) { const k = kind(e.url), b = (by[k] ??= { n: 0, kb: 0, body: 0 }); b.n++; b.kb += e.kb; b.body += e.body; }
    return { marks, dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), lastLoad: window.game.lastLoad, by,
      slowest: res.sort((a, b) => b.ms - a.ms).slice(0, 12), programs: window.viewer.renderer.info.programs.length, long: window.__long };
  });
  await page.close();
  return { track, label, flow, titleReady, firstFrame, preloaded, startClick, drivable, startToDrive: drivable - startClick, ...r, logs, errors: errors.slice(0, 6) };
}

const out = [], preloaded = (r) => (r.preloaded ? ` preloaded ${r.preloaded}` : '');
for (const track of tracks) {   // a new browser per track: cold = a first visit (empty HTTP and shader caches), warm = the same profile reopened
  const browser = await launch(), ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((track) => {   // the saved track; and the HMR socket stubbed so another agent's save never reloads this page
    for (const k of ['info', 'warn']) { const f = console[k]; console[k] = (...a) => f.call(console, `@${Math.round(performance.now())}`, ...a); }   // a timeline in the logs
    window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 150) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask' }); } catch { /* none */ }
    addEventListener('click', (e) => { if (e.target.closest?.('.panel.setup button.cta')) performance.mark('ultrack:qa-start-click'); }, true);
    try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track } })); } catch { /* none */ }
    const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; window.WebSocket = F;
  }, track);
  for (const label of ['cold', 'warm']) {
    const r = await run(ctx, track, label); out.push(r);
    console.log(`${track} ${label} ${flow}: title ${r.titleReady} ms, first frame ${r.firstFrame}${preloaded(r)} (dcl ${r.dcl}) | car-ready ${r.marks['car-ready']} venue-ready ${r.marks['venue-ready'] ?? '-'} | start->drive ${r.startToDrive} ms ${JSON.stringify(r.lastLoad?.stages)} | open->drive ${r.drivable} ms | programs ${r.programs}`);
    console.log('   long tasks', r.long.map(([t, d]) => `${d}@${t}`).join(' '));
    console.log('   bytes', JSON.stringify(r.by));
    console.log('   slowest', r.slowest.slice(0, 8).map((e) => `${e.url.slice(0, 60)} ${e.ms}ms@${e.start} ${e.kb}kB`).join(' | '));
    if (r.logs.length) console.log(r.logs.map((l) => '    ' + l.slice(0, 160)).join('\n'));
    if (r.errors.length) console.log('   errors', r.errors);
  }
  await browser.close();
}
if (flag('out')) writeFileSync(flag('out'), JSON.stringify(out, null, 1));
