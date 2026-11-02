// Career par laps, measured: the AI driver at pace 1.00, alone, in the real physics, flying laps only (the first, from a standing start, is dropped), in a slow, a middling
// and a fast car, dry, no upgrades. Prints the base par (with the car factor taken out, rules.js parLap) to put in assets/career/calendar.json, and how well that factor fits.
//   node scripts/qa-lock.mjs -- node scripts/measure-par-laps.mjs [tracks=india,drylake,infinia,marina,shajawa,tokyo] [cars=bmw1,huracan,destrier] [url=http://127.0.0.1:5180]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [tracks = 'india,drylake,infinia,marina,shajawa,tokyo', cars = 'bmw1,huracan,destrier', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAREER = (f) => JSON.parse(readFileSync(join(root, '..', 'assets', 'career', f), 'utf8')), carZ = CAREER('tiers.json').carZ, factor = CAREER('tuning.json').pace.carZ, cal = new Proxy(CAREER('calendar.json').tracks, { get: (t, k) => t[k] ?? { parLap: 120 } });     // a track not on the calendar yet: a first guess at its par
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const out = {};
for (const track of tracks.split(',')) {
  const runs = {}, errors = [];
  for (const key of cars.split(',')) {      // each car as the session's own: only that car's model is loaded
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.addInitScript(([t, car]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car, settings: { track: t, look: 'day', weather: 'dry' } })); } catch { /* none */ } }, [track, key]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
    await page.keyboard.press('Enter');
    await page.click('.bento-tile[data-id=free]');
    await page.click('.panel.setup button.cta');
    await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.field?.pw, null, { timeout: 300000 });
    runs[key] = await page.evaluate(async ({ key, par }) => {
      const { soloRun } = await import('/src/physics/testdrive.js'), field = window.game.field;
      if (field.hero.key !== key) throw new Error(`hero is ${field.hero.key}, not ${key}`);
      field.hero.vehicle.rb.setEnabled(false);       // the parked copy is no part of the lap
      const { stats } = soloRun(field, key, { seconds: Math.ceil(par * 4.5), start: 20, pace: 1 });
      return { laps: stats.laps, respawns: stats.respawns, maxKmh: Math.round(stats.maxKmh) };
    }, { key, par: cal[track].parLap });
    await ctx.close();
  }
  const per = Object.entries(runs).map(([key, r]) => {
    const flying = r.laps.slice(1), lap = flying.length ? flying.reduce((a, b) => a + b, 0) / flying.length : null;
    return { key, z: carZ[key], laps: r.laps, lap, base: lap && lap / (1 - factor * (carZ[key] ?? 0)), respawns: r.respawns, maxKmh: r.maxKmh };
  });
  const ok = per.filter((p) => p.base && !p.respawns), mean = ok.length ? ok.reduce((a, p) => a + p.base, 0) / ok.length : null;
  out[track] = { old: cal[track].parLap, par: mean && +mean.toFixed(1), spread: ok.length ? +(Math.max(...ok.map((p) => p.base)) - Math.min(...ok.map((p) => p.base))).toFixed(1) : null, runs: per, errors };
  console.log(track.padEnd(8), 'estimated', String(cal[track].parLap).padStart(3), '-> measured', mean?.toFixed(1), `(${mean ? ((mean / cal[track].parLap - 1) * 100).toFixed(0) : '?'} %)`,
    per.map((p) => `${p.key} ${p.lap?.toFixed(1) ?? 'no lap'}${p.respawns ? ` RESPAWNS ${p.respawns}` : ''}`).join(', '), errors.length ? 'ERRORS ' + errors[0].slice(0, 80) : '');
}
await browser.close();
mkdirSync(join(root, 'qa'), { recursive: true }); writeFileSync(join(root, 'qa', 'par-laps.json'), JSON.stringify(out, null, 1));
