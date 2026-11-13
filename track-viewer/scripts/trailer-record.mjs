// Records trailer plates: headless races with the AI driving the player's car, each shot through a trailer rig (src/trailer.js), frame-exact.
//   node scripts/qa-lock.mjs -- node scripts/trailer-record.mjs shots.json [outDir] [url=http://127.0.0.1:5180]
// shots.json: [{ name, track, look = 'day', weather = 'dry', car = 'av12', laps = 3,
//   at: 'grid' | { raceT } | { u, before = 80 | lead (s), after = 5 }   when to roll: on the grid, at a race time, or as the hero comes within
//   `before` m (or `lead` s at its speed) of u, once the race clock passes `after`,
//   rig: { kind: 'car' | 'track', ... }, frames = 120, fps = 60, blur = 8 (sub-frames; 1 = none), shutter = 0.5, ctl: { nitro: 1 } (over the AI while rolling) }]
// Shots in a row with the same track, look, weather and car share one race. Out: qa/trailer_<name>/00001.png ... and <outDir>/<name>.mp4.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const [file, outArg, base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
if (!file) { console.log('usage: trailer-record.mjs shots.json [outDir] [url]'); process.exit(1); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), outDir = resolve(outArg ?? join(root, 'qa', 'trailer'));
mkdirSync(outDir, { recursive: true });
const shots = JSON.parse(readFileSync(file, 'utf8'));
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] });
const cond = (s) => [s.track, s.look ?? 'day', s.weather ?? 'dry', s.car ?? 'av12', s.laps ?? 3].join('|');

async function race(s) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([track, look, weather, laps, car]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car, settings: { track, look, weather, laps } })); } catch { /* none */ } },
    [s.track, s.look ?? 'day', s.weather ?? 'dry', s.laps ?? 3, s.car ?? 'av12']);
  // Vite's HMR socket stubbed: a saved file would otherwise reload the page mid-shot
  await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));
  page.on('console', (m) => { if ((m.type() === 'error' && !m.text().startsWith('[.WebGL-')) || /context lost/i.test(m.text())) console.log('  console:', m.text().slice(0, 200)); });
  await page.goto(`${base}/?trailer=1`);
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter');
  await page.click('.bento-tile[data-id=race]');
  await page.click('.panel.setup button.cta');
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000 });
  await page.evaluate(() => { const v = window.viewer; v.params.dynamicRes = false; v.params.renderScale = 1; v.resize(); window.game.session.field.setPlayer(false); });
  return { ctx, page };
}

let cur = null, key = null;
for (const s of shots) {
  if (cond(s) !== key) { await cur?.ctx.close(); cur = await race(s); key = cond(s); console.log(`race: ${key}`); }
  const { page } = cur, at = s.at ?? { raceT: 3 };
  if (at !== 'grid') {
    await page.waitForFunction((at) => {
      const S = window.game.session, f = S.field;
      if (at.raceT !== undefined) return S.raceT >= at.raceT;
      if (S.state !== 'running' || S.raceT < (at.after ?? 5)) return false;
      const d = (((at.u - window.trailer.along(f)) % f.length) + f.length) % f.length;   // metres still to go to u
      if (at.lead !== undefined) return d < 600 && d / Math.max(5, f.hero.speed) <= at.lead;   // seconds out at its current speed: a slow lap-1 car still arrives mid-shot
      return d <= (at.before ?? 80) && d > (at.before ?? 80) - 40;
    }, at, { timeout: 600000, polling: 50 });
  }
  const dir = join(root, 'qa', `trailer_${s.name}`);
  rmSync(dir, { recursive: true, force: true });
  const t0 = Date.now();
  const shot = page.evaluate(async (s) => {
    const T = window.trailer, f = window.game.session.field;
    f.ctlOver = null; f.forceDetail = true; T.set(s.ctl ? { ...s.rig, ctl: s.ctl } : s.rig);   // ctl rides on the rig: place() applies it, keys included; full detail from the first frame
    const r = await T.record({ name: s.name, frames: s.frames ?? 120, fps: s.fps ?? 60, blur: s.blur ?? 8, shutter: s.shutter ?? 0.5 });
    f.ctlOver = null; f.trueSpin = f.forceDetail = false; T.clear();
    return r;
  }, s);
  // watchdog: a frame that never arrives (a lost GPU, a stuck POST) fails the run instead of hanging it
  let last = -1, still = 0, res = null;
  shot.then((r) => { res = r; }, (e) => { res = { err: String(e) }; });
  while (!res) {
    await new Promise((ok) => setTimeout(ok, 2000));
    const k = await page.evaluate(() => window.trailer.rec?.n ?? -1).catch(() => -2);
    if (k === last) still += 2; else { still = 0; last = k; }
    if (still >= 60 && !res) { res = { n: last, err: `no frame for 60 s (at ${last}; ${await page.evaluate(() => `busy ${window.trailer.busy}, contextLost ${window.viewer.renderer.getContext().isContextLost()}`).catch((e) => e.message)})` }; }
  }
  const { n, err } = res;
  if (err) { console.log(`  ${s.name}: FAILED after ${n} frames: ${err}`); process.exitCode = 1; await cur.ctx.close(); cur = null; key = null; continue; }
  const mp4 = join(outDir, `${s.name}.mp4`);
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(s.fps ?? 60), '-i', join(dir, '%05d.png'), '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', mp4]); }
  catch (e) { console.log(`  ${s.name}: encode FAILED (frames kept in ${dir}): ${String(e.stderr ?? e.message).slice(0, 200)}`); process.exitCode = 1; continue; }   // a full disk loses one shot, not the batch
  console.log(`  ${s.name}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${mp4}`);
}
await cur?.ctx.close();
await browser.close();
