// Repro + profile of the barrier-impact stall. node qa/cmp/prof-freeze.mjs  (env RUN, BRAKE, HB, DIR)
import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const W = (ms) => p.waitForTimeout(ms);
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto('http://localhost:5180'); await W(14000); await p.keyboard.press('Space'); await W(4000);
await p.click('.free-tile'); await W(1500);
await p.locator('button.cta:visible').first().click(); await W(30000);
await p.evaluate(() => {
  const g = window.game, pw = g.pw, ws = pw.world.step.bind(pw.world), L = window.__L = { long: [], step: [], t0: performance.now(), hits: [] };
  new PerformanceObserver((l) => l.getEntries().forEach((e) => L.long.push([Math.round(e.startTime - L.t0), Math.round(e.duration)]))).observe({ entryTypes: ['longtask'] });
  pw.world.step = () => { const a = performance.now(); ws(); const d = performance.now() - a; if (d > 4) L.step.push([Math.round(a - L.t0), +d.toFixed(1)]); };
  const W_ = pw.world, cs = W_.castShape.bind(W_); L.cast = {n:0,max:0,bad:[]}; W_.castShape = (...a) => { const t = performance.now(), r = cs(...a), d = performance.now() - t; L.cast.n++; L.cast.max = Math.max(L.cast.max, d); if (r && (r.time_of_impact < 1e-4 || Math.hypot(r.normal1.x, r.normal1.y, r.normal1.z) < 0.9) && L.cast.bad.length < 12) L.cast.bad.push([Math.round(t - L.t0), r.time_of_impact, r.normal1.x, r.normal1.y, r.normal1.z, +d.toFixed(2)]); return r; };
  const v = g.field?.hero?.vehicle ?? g.cars?.find((c) => c.hero)?.vehicle; const vs = v.step.bind(v);
  v.step = (...a) => { const t = performance.now(); vs(...a); const d = performance.now() - t; if (d > 4) L.hits.push([Math.round(t - L.t0), +d.toFixed(1), Math.round(v.rb.angvel().y * 57.3), Math.round(v.speed * 3.6)]); };
  L.tel = []; setInterval(() => L.tel.push([Math.round(performance.now() - L.t0), Math.round(v.speed * 3.6), Math.round(v.rb.angvel().y * 57.3)]), 100); let last = performance.now(); (function f() { const n = performance.now(); if (n - last > 100) L.long.push(['raf', Math.round(last - L.t0), Math.round(n - last)]); last = n; requestAnimationFrame(f); })();
});
const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
const act = async (k, a, ms) => { await p.keyboard[a === 'down' ? 'down' : 'up'](k); if (ms) await W(ms); };
await act('KeyW', 'down', +process.env.RUN || 11500); await act('KeyW', 'up'); await act('KeyS', 'down', +process.env.BRAKE || 900); await act('KeyS', 'up');
await act('KeyW', 'down'); await act('KeyD', 'down'); await act('Space', 'down', 700); await act('Space', 'up', 1800); await act('KeyD', 'up', 1000); await act('KeyW', 'up', 3000);
const { profile } = await cdp.send('Profiler.stop');
const L = await p.evaluate(() => window.__L);
console.log('tel', JSON.stringify(L.tel.filter((x) => Math.abs(x[2]) > 150))); console.log('cast', JSON.stringify(L.cast)); console.log('long', JSON.stringify(L.long), '\nstep>4ms', JSON.stringify(L.step), '\nvehicle.step>4ms [t,ms,yaw,kmh]', JSON.stringify(L.hits));
const self = new Map(), by = new Map(profile.nodes.map((n) => [n.id, n]));
profile.samples.forEach((id, i) => { const n = by.get(id), k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0)); });
console.log([...self].sort((a, c) => c[1] - a[1]).slice(0, 12).map(([k, v]) => (v / 1000).toFixed(0) + 'ms ' + k).join('\n'));
await b.close();
