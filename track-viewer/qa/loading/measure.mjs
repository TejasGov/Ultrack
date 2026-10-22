// node qa/loading/measure.mjs <baseUrl> <label> [idleMs=6000]  -> qa/loading/<label>.json
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [,, base = 'http://localhost:5180', label = 'run', idle = '6000'] = process.argv;
const out = new URL(`./${label}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
// PROFILE=<dir> keeps the browser profile (GPU shader cache) between runs: a warm second visit; default is a cold fresh profile
const opts = { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, viewport: { width: 1600, height: 900 },
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] };
const ctx = process.env.PROFILE ? await chromium.launchPersistentContext(process.env.PROFILE, opts) : await (await chromium.launch(opts)).newContext({ viewport: opts.viewport });
const browser = { close: () => ctx.browser()?.close() ?? ctx.close() };
const page = await ctx.newPage();
const logs = [], errors = [], reqs = new Map();
page.on('console', m => { const t = m.text(); if (m.type() === 'error') errors.push(t); if (/Race preparation|Graphics preparation|people:|team artwork|Scenery|warmed|preload/i.test(t)) logs.push([Math.round(performance.now() - t0), t]); });
page.on('pageerror', e => errors.push('pageerror ' + e.message));
const t0 = performance.now();
page.on('request', r => reqs.set(r, { url: r.url(), t: performance.now() - t0 }));
page.on('requestfinished', async r => { const e = reqs.get(r); if (!e) return; e.end = performance.now() - t0; try { const s = await r.sizes(); e.bytes = s.responseBodySize + s.responseHeadersSize; } catch {} });
await page.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); });
await page.goto(base + '/', { waitUntil: 'commit' });
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 120000 });
const bootMs = Math.round(performance.now() - t0);
await page.evaluate(() => { window.__boot = performance.now(); window.game.boot(); });
await page.waitForTimeout(+idle);               // idle in the menu, as a player reading it
const menuLong = await page.evaluate(() => window.__lt.filter(([s]) => s > window.__boot).slice());
const menuReqs = reqs.size, menuT = Math.round(performance.now() - t0);
const marksMenu = await page.evaluate(() => performance.getEntriesByType('mark').map(m => [m.name, Math.round(m.startTime)]));
const tClick = performance.now();
await page.evaluate(() => { window.__t = performance.now(); window.game.startSession('race'); });
await page.waitForFunction(() => window.game.session, null, { timeout: 180000, polling: 25 });
const raceMs = Math.round(performance.now() - tClick);
const gridT = Math.round(performance.now() - t0);
await page.screenshot({ path: out + '-grid-0s.png' });
await page.waitForTimeout(3000);
await page.screenshot({ path: out + '-grid-3s.png' });
await page.waitForTimeout(+idle);
const all = [...reqs.values()].filter(e => e.end);
const cat = u => { const p = new URL(u).pathname; return /\.(glb)$/.test(p) ? (/marina_collision/.test(p) ? 'collision glb' : /marina_visual/.test(p) ? 'venue glb' : /cars\//.test(p) ? 'car glb' : /character|people/.test(p) ? 'character glb' : 'other glb')
  : /\.ktx2$/.test(p) ? 'ktx2' : /\.(ogg|mp3|wav|m4a)$/.test(p) ? (/commentary|enzo|alastair|kavya/.test(p) ? 'commentary audio' : /engine/.test(p) ? 'engine audio' : 'other audio')
  : /\.(webp|png|jpg|jpeg)$/.test(p) ? 'image' : /\.hdr$/.test(p) ? 'hdri' : /\.(js|mjs)$/.test(p) || /node_modules|\/src\//.test(p) ? 'js' : /\.wasm$/.test(p) ? 'wasm' : /\.(woff2?|ttf)$/.test(p) ? 'font' : /\.json$/.test(p) ? 'json' : 'other'; };
const byCat = {};
for (const e of all) { const c = cat(e.url); const b = byCat[c] ??= { n: 0, bytes: 0, beforeClick: 0, afterClick: 0 }; b.n++; b.bytes += e.bytes ?? 0; (e.t < tClick - t0 ? b.beforeClick++ : b.afterClick++); }
const marksEnd = await page.evaluate(() => performance.getEntriesByType('mark').map(m => [m.name, Math.round(m.startTime)]));
const clickRel = Math.round(tClick - t0);
const big = all.filter(e => (e.bytes ?? 0) > 150000).map(e => [e.url.replace(/^https?:\/\/[^/]+/, ''), e.bytes, Math.round(e.t), Math.round(e.end), e.t < tClick - t0 ? 'menu' : 'race']).sort((a, b) => a[2] - b[2]);
const lastLoad = await page.evaluate(() => window.game.lastLoad);
const res = { lastLoad, menuLong, label, base, bootMs, menuT, clickRel, raceMs, gridT, marksMenu, marksEnd, logs, errors, byCat, big, totalBytes: all.reduce((s, e) => s + (e.bytes ?? 0), 0), beforeClickBytes: all.filter(e => e.t < tClick - t0).reduce((s, e) => s + (e.bytes ?? 0), 0) };
writeFileSync(out + '.json', JSON.stringify(res, null, 1));
console.log(JSON.stringify({ label, lastLoad, menuLongTasks: menuLong.length, bootMs, raceMs, clickRel, marksMenu, marksEnd, logs, errors: errors.slice(0, 5), beforeClickMB: (res.beforeClickBytes / 1e6).toFixed(1), totalMB: (res.totalBytes / 1e6).toFixed(1) }, null, 1));
console.log(JSON.stringify(byCat));
console.log(big.map(b => b.join(' ')).join('\n'));
await browser.close();
