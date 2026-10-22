// Many barrier-impact trials in one session; reports stalls (main-thread gaps) and step times. node qa/cmp/prof-trials.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
p.on('framenavigated', (f) => f === p.mainFrame() && console.log('NAV', f.url()));
p.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200))); p.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.log('CON', m.type(), m.text().slice(0, 200)));
const W = (ms) => p.waitForTimeout(ms);
await p.addInitScript(() => { window.__GL = []; for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) for (const m of Object.getOwnPropertyNames(C.prototype).filter((k) => { try { return typeof C.prototype[k] === 'function' && k !== 'constructor'; } catch { return false; } })) { const o = C.prototype[m]; C.prototype[m] = function (...a) { const t = performance.now(), r = o.apply(this, a), d = performance.now() - t; if (d > 15) window.__GL.push([Math.round(t), m, +d.toFixed(0)]); return r; }; } });
await p.goto('http://localhost:5190'); await W(14000); await p.keyboard.press('Space'); await W(4000);
await p.click('.free-tile'); await W(1500);
await p.locator('button.cta:visible').first().click(); await W(30000);
await p.evaluate(() => {
  const f = window.game.field, pw = window.game.pw, hero = f.hero, v = hero.vehicle, L = window.__L = { gaps: [], step: 0, vstep: 0, cast: 0, ev: [] };
  const ws = pw.world.step.bind(pw.world); pw.world.step = () => { const a = performance.now(); ws(); L.step = Math.max(L.step, performance.now() - a); };
  const cr = pw.world.castRayAndGetNormal.bind(pw.world); L.ray = 0; pw.world.castRayAndGetNormal = (...a) => { const t = performance.now(), r = cr(...a); L.ray = Math.max(L.ray, performance.now() - t); return r; };
  const cs = pw.world.castShape.bind(pw.world); pw.world.castShape = (...a) => { const t = performance.now(), r = cs(...a); L.cast = Math.max(L.cast, performance.now() - t); return r; };
  L.sp = []; const vs = v.step.bind(v); v.step = (...a) => { const t = performance.now(); vs(...a); L.vstep = Math.max(L.vstep, performance.now() - t); const nowp = performance.now(); if (L.sp.length === 0 || nowp - L.sp.at(-1)[0] > 100) { const kmh = v.speed * 3.6; if (L.sp.length && L.sp.at(-1)[1] - kmh > 30) L.imp = Math.round(nowp); L.sp.push([nowp, kmh]); if (L.sp.length > 3) L.sp.shift(); } L.yaw = Math.max(L.yaw ?? 0, Math.abs(v.rb.angvel().y * 57.3)); };
  L.slow = []; for (const [nm, o] of [['game', window.game], ['field', f], ['audio', window.game.audio], ['fx', f.fx], ['commentary', window.game.audio?.commentary], ['hero', hero], ['chassis', hero.chassis], ['camera', f.rig], ['gamecam', window.game.rig]]) { if (!o) continue; const seen = new Set(); for (let q = o; q && q !== Object.prototype; q = Object.getPrototypeOf(q)) for (const k of Object.getOwnPropertyNames(q)) { if (k === 'constructor' || seen.has(k) || typeof o[k] !== 'function') continue; seen.add(k); const fn = o[k]; o[k] = function (...a) { const t = performance.now(); try { return fn.apply(this, a); } finally { const d = performance.now() - t; if (d > 25) L.slow.push([nm + '.' + k, Math.round(d)]); } }; } }
  let last = performance.now(); (function r() { const n = performance.now(); if (n - last > 100) L.gaps.push([Math.round(last), Math.round(n - last)]); last = n; requestAnimationFrame(r); })();
  window.__reset = () => { f.respawn(hero); window.__GL.length = 0; L.slow.length = 0; Object.assign(L, { gaps: [], step: 0, vstep: 0, cast: 0, ray: 0, yaw: 0 }); };
});
const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
const top = (profile) => { const self = new Map(), by = new Map(profile.nodes.map((n) => [n.id, n])); profile.samples.forEach((id, i) => { const n = by.get(id), k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0)); }); return [...self].sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k, v]) => (v / 1000).toFixed(0) + 'ms ' + k); };
const act = async (k, a, ms) => { await p.keyboard[a === 'down' ? 'down' : 'up'](k); if (ms) await W(ms); };
let seed = +(process.env.SEED || 7); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < +(process.env.N || 14); i++) { let hb = Math.round(rnd() * 1500), brake = Math.round(rnd() * 1000), dir = rnd() < 0.8 ? 'KeyD' : 'KeyA', run = Math.round(10500 + rnd() * 2500); if (process.env.ONE) [hb, brake, run] = process.env.ONE.split(',').map(Number);
  await p.evaluate(() => window.__reset()); await W(1500); const t0p = await p.evaluate(() => performance.now()); await cdp.send('Profiler.start');
  await act('KeyW', 'down', run); await act('KeyW', 'up'); await act('KeyS', 'down', brake); await act('KeyS', 'up');
  await act('KeyW', 'down'); await act(dir, 'down'); await act('Space', 'down', hb); await act('Space', 'up', 1800); await act(dir, 'up', 1000); await act('KeyW', 'up', 2500);
  const r = await Promise.race([p.evaluate(() => ({ ...window.__L, gaps: window.__L.gaps })), W(15000).then(() => 'HUNG')]);
  const t1p = await p.evaluate(() => performance.now()); const { profile } = await cdp.send('Profiler.stop'); for (const [gs, gd] of (r.gaps || [])) { if (gd < 90) continue; const by = new Map(profile.nodes.map((n) => [n.id, n])), self = new Map(); let t = profile.startTime; const scale = (t1p - t0p) * 1000 / (profile.endTime - profile.startTime); profile.samples.forEach((id, i) => { t += profile.timeDeltas[i]; const pg = t0p + (t - profile.startTime) * scale / 1000; if (pg < gs || pg > gs + gd) return; const n = by.get(id), k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + profile.timeDeltas[i]); }); console.log('GAP', gd, [...self].sort((a, c) => c[1] - a[1]).slice(0, 6).map(([k, v]) => (v / 1000).toFixed(0) + 'ms ' + k).join(' | ')); }
  console.log('GL', JSON.stringify(await p.evaluate(() => window.__GL))); console.log('SLOW', JSON.stringify(await p.evaluate(() => window.__L.slow)));
  console.log({ hb, brake, dir, run }, JSON.stringify(r));
}
await b.close();
