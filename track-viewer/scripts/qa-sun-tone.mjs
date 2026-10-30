// Sun tone check: fixed views at the hero car, toward the sun and away from it, per track and look, with brightness
// numbers (mean luma, share of clipped pixels) and the lens flare isolated (the same frame with the flare on and off).
//   node scripts/qa-lock.mjs -- node scripts/qa-sun-tone.mjs <label> [tracks=marina,tokyo] [looks=day,dusk,bluehour,night] [url]
// Shots and stats.json go to qa/sun-tone/<label>/. Grain is off so frames compare cleanly.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRACKS } from '../src/tracks.js';

const [label = 'run', tracks = 'marina,tokyo', looks = 'day,dusk,bluehour,night', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(root, 'qa', 'sun-tone', label);
mkdirSync(out, { recursive: true });
// yaw: degrees off the sun's bearing; pitch: absolute degrees, or 'sun' = 12 deg under the visible sun (it sits in the top third)
const VIEWS = { road: { yaw: 0, pitch: -3, back: 7, up: 1.6 }, sky: { yaw: 0, pitch: 'sun', back: 7, up: 1.6 },
  side: { yaw: 32, pitch: -2, back: 7, up: 1.6 }, away: { yaw: 180, pitch: -6, back: 7, up: 1.8 },
  high: { yaw: 0, pitch: -6, back: 7, up: 14 } };   // above the pit building (Marina's low sun hides behind it at road height)

/** mean luma (0..1, display values) and the share of clipped pixels (every channel >= 250) */
async function stats(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, clip = 0;
  for (let i = 0; i < data.length; i += 3) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (data[i] >= 250 && data[i + 1] >= 250 && data[i + 2] >= 250) clip++;
  }
  const n = info.width * info.height;
  return { luma: +(sum / n / 255).toFixed(4), clipPct: +(100 * clip / n).toFixed(3) };
}
/** what the flare adds: summed luma of (on - off) per pixel, and the share of pixels it lifts by more than 3/255 */
async function flareOf(on, off) {
  const [a, b] = await Promise.all([on, off].map((f) => sharp(f).removeAlpha().raw().toBuffer()));
  let e = 0, area = 0;
  for (let i = 0; i < a.length; i += 3) {
    const d = (0.2126 * (a[i] - b[i]) + 0.7152 * (a[i + 1] - b[i + 1]) + 0.0722 * (a[i + 2] - b[i + 2]));
    if (d > 0) e += d;
    if (d > 3) area++;
  }
  return { energy: Math.round(e / 255), areaPct: +(100 * area / (a.length / 3)).toFixed(3) };
}

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const report = {};
for (const track of tracks.split(',')) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(([track]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look: 'dusk', weather: 'dry', quality: 'high' } })); } catch { /* none */ } }, [track]);
  // a stub for Vite's HMR socket: another agent saving a file would otherwise reload the page mid-run
  await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.bento-tile[data-id=free]', { state: 'visible' });
  await page.click('.bento-tile[data-id=free]');
  await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
  await page.click('.panel.setup button.cta');
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000 });
  // dynamic resolution off: it rescaled between the flare-on and flare-off frames and the diff read that as flare
  await page.evaluate(() => { window.game.hud.show(false); Object.assign(window.viewer.params, { mode: 'orbit', grain: 0, dynamicRes: false }); });
  const r = report[track] = {};
  for (const look of looks.split(',')) {
    for (const [view, v] of Object.entries(VIEWS)) {
      if (look === 'night' && view !== 'road' && view !== 'away') continue;
      // the visible sun: bearing from tracks.js, height from the look (main.js sunAt / aimSun)
      const el = await page.evaluate(async (look) => {
        const w = window.viewer;
        if (w.params.look !== look) { w.params.look = look; await w.setLook(look); }
        return w.LOOKS[look].skyEl ?? 7;
      }, look);
      const [bx, bz] = TRACKS[track].sun, n = Math.hypot(bx, bz);
      const yaw = Math.atan2(bz / n, bx / n) + v.yaw * Math.PI / 180;
      const pitch = (v.pitch === 'sun' ? el - 12 : v.pitch) * Math.PI / 180;
      const aim = (flare) => page.evaluate(async ([yaw, pitch, back, up, flare]) => {
        const w = window.viewer, c = w.field().hero.root.position;
        const dx = Math.cos(yaw), dz = Math.sin(yaw);
        w.params.flare = flare; w.applyAll();
        w.camera.position.set(c.x - dx * back, c.y + up, c.z - dz * back);
        w.controls.target.set(w.camera.position.x + dx * Math.cos(pitch) * 50, w.camera.position.y + Math.sin(pitch) * 50, w.camera.position.z + dz * Math.cos(pitch) * 50);
        w.controls.update();
      }, [yaw, pitch, v.back, v.up, flare]);
      await aim(1);
      await page.waitForTimeout(2200);
      const file = join(out, `${track}-${look}-${view}.png`);
      await page.screenshot({ path: file, timeout: 240000 });
      const s = await stats(file);
      if (look !== 'night' && view !== 'away') {
        await aim(0);
        await page.waitForTimeout(900);
        const off = join(out, `${track}-${look}-${view}-noflare.png`);
        await page.screenshot({ path: off, timeout: 240000 });
        s.flare = await flareOf(file, off);
      }
      (r[look] ??= {})[view] = s;
      console.log(track, look, view, JSON.stringify(s));
    }
  }
  r.errors = errors;
  await ctx.close();
}
writeFileSync(join(out, 'stats.json'), JSON.stringify(report, null, 1));
await browser.close();
