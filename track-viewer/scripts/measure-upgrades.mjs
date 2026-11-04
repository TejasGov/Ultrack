// What an upgrade does to a lap, measured: the AI driver at pace 1.00, alone, in the real physics, flying laps only (the first, from a standing start, is dropped).
// Each variant is the same car on the same track with other upgrade levels; Nitro is shown with the rivals' Hard-mode nitro logic switched on (the solo driver fires it
// the way a rival does), compared with Nitro 0 under the same logic. The lap time moves with the percentage printed, so it can be read against tuning.json pace.perDevLevel.
//   node scripts/qa-lock.mjs -- node scripts/measure-upgrades.mjs [tracks=india,marina] [cars=bmw1,huracan] [url=http://127.0.0.1:5180]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [tracks = 'india,marina', cars = 'bmw1,huracan', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), cal = JSON.parse(readFileSync(join(root, '..', 'assets', 'career', 'calendar.json'), 'utf8')).tracks;
const VARIANTS = [['stock', {}], ['aero 1', { aero: 1 }], ['aero 2', { aero: 2 }], ['aero 3', { aero: 3 }], ['tyres 3', { tyres: 3 }], ['engine 3', { engine: 3 }], ['brakes 3', { brakes: 3 }], ['all 3 (3 cats)', { engine: 3, tyres: 3, brakes: 3 }],
  ['nitro 0 (rival logic)', {}, true], ['nitro 3 (rival logic)', { nitro: 3 }, true]];
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
for (const track of tracks.split(',')) for (const key of cars.split(',')) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(([t, car]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car, settings: { track: t, look: 'day', weather: 'dry' } })); } catch { /* none */ } }, [track, key]);
  const page = await ctx.newPage(); await page.goto(base);
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.click('.bento-tile[data-id=free]'); await page.click('.panel.setup button.cta');
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.field?.pw, null, { timeout: 300000 });
  const rows = await page.evaluate(async ({ key, par, VARIANTS }) => {
    // vite stamps modules that changed since it started (?t=), and a plain import would be another copy: ask the page for the URL the game loaded
    const mod = (name) => import(performance.getEntriesByType('resource').map((e) => e.name).findLast((n) => n.includes(name)) ?? name);
    const { soloRun } = await mod('/src/physics/testdrive.js'), H = await mod('/src/physics/handling.js'), field = window.game.field, out = [];
    field.hero.vehicle.rb.setEnabled(false);
    for (const [name, lv, nitro] of VARIANTS) {
      H.setUpgrades(key, { engine: 0, tyres: 0, brakes: 0, aero: 0, nitro: 0, ...lv }); field.hardPace = nitro ? 1.05 : 1;
      const { stats } = soloRun(field, key, { seconds: Math.ceil(par * 3.4), start: 20, pace: 1 });
      out.push({ name, laps: stats.laps, respawns: stats.respawns, maxKmh: Math.round(stats.maxKmh) });
    }
    H.setUpgrades(key, { engine: 0, tyres: 0, brakes: 0, aero: 0, nitro: 0 }); field.hardPace = 1; return out;
  }, { key, par: cal[track].parLap, VARIANTS });
  await ctx.close();
  const lap = (r) => { const f = r.laps.slice(1); return f.length ? f.reduce((a, b) => a + b, 0) / f.length : NaN; };
  const stock = lap(rows[0]), n0 = lap(rows[8]);
  console.log(`${track} / ${key}`);
  rows.forEach((r, i) => { const l = lap(r), ref = i >= 8 ? n0 : stock; console.log(`  ${r.name.padEnd(22)} ${l.toFixed(2)} s  ${i === 0 || i === 8 ? '' : `${((l / ref - 1) * 100).toFixed(2)} %`}  max ${r.maxKmh} km/h${r.respawns ? '  RESPAWNS ' + r.respawns : ''}`); });
}
await browser.close();
