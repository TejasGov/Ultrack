// One Sponsor Challenge in the real game, headless, the player's car driven by the AI: a new career's challenge field (career.challengeSetup), started
// as the hub starts a sponsor day, from P6 at the given circuit, two laps; the result judged by rules.challengeMet. Passes when the bot earns at least bronze
// (docs/10x/career-spec.md WP3).   node scripts/qa-lock.mjs -- node scripts/qa-sponsor-challenge.mjs [track=india] [kind=top] [url=http://127.0.0.1:5302]
//   QA_OUT=dir for report.json and a still from the race
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'india', kind = 'top', base = 'http://127.0.0.1:5302'] = process.argv.slice(2);
const out = process.env.QA_OUT ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'sponsor-challenge'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
// Vite's HMR socket stubbed: another session saving a file would otherwise reload the page mid-race
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
let report = { track, kind };
try {
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 }); await page.keyboard.press('Enter');
  report.setup = await page.evaluate(async ({ track, kind }) => {
    const C = await import('/src/game/career/career.js'), R = await import('/src/game/career/rules.js'), g = window.game;
    const avail = { india: null, drylake: ['day', 'dusk'], infinia: ['day', 'dusk'], marina: null, shajawa: ['day', 'dusk'], llano: ['day', 'dusk'], tokyo: null, qingshan: null, venice: null };
    const s = C.newCareer({ seed: 7, now: 'x' }), sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04); C.acceptOffer(s, s.pending.offers[0].id, avail);
    const X = C.challengeSetup(s), car = s.contract.car, L = X.levels(car), ch = C.challengeOf({ name: 'QA', target: { kind } });
    const spec = { goals: ch.goals, hero: car, mate: X.mate, racers: X.racers, par: R.parLap(track, car, 'dry', [L.engine, L.tyres, L.brakes, L.aero]) };
    window.__Q = { spec, done: null };
    g.careerSession('sponsor', { track, look: 'day', weather: 'dry', laps: R.TUNING.side.challenge.laps, car, home: 'menu',
      session: { racers: X.racers, gridOrder: X.gridOrder, pace: X.pace, levels: X.levels, drivers: X.drivers, ai: X.ai, nemesis: X.nemesis, mateKey: X.mateKey, label: ch.name, field: ch.objectives.join(' · ') } },
      (d) => { window.__Q.done = { order: d.order, bests: d.bests, contacts: d.contacts, offTrack: d.offTrack, totals: d.totals, dnf: d.dnf }; window.__Q.met = R.challengeMet(spec, window.__Q.done); });
    return { name: ch.name, objectives: ch.objectives, gridOrder: X.gridOrder, hero: car, mate: X.mate, pace: X.pace, par: spec.par };
  }, { track, kind });
  await page.waitForFunction(() => window.game.session && !window.game.raceLoading.active && window.game.session.field.rig, null, { timeout: 300000 });
  report.session = await page.evaluate(() => { const g = window.game; g.session.field.setPlayer(false); return { mode: g.session.mode, laps: g.session.laps, cars: g.field.cars.length, slot: g.field.gridOrder.indexOf(g.field.hero.key) + 1, heroPos: g.session.heroPos }; });
  let shot = false; const t0 = Date.now();
  while (Date.now() - t0 < 15 * 60000) {
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => ({ done: !!window.__Q.done, t: window.game.session?.raceT ?? 0 }));
    if (!shot && st.t > 25) { await page.screenshot({ path: join(out, `challenge-${track}.png`) }); shot = true; }
    if (st.done) break;
  }
  Object.assign(report, await page.evaluate(() => ({ result: window.__Q.done, met: window.__Q.met ?? null })));
} catch (e) { errors.push('qa: ' + e.message); }
await browser.close();
const medal = report.met ? report.met.filter(Boolean).length : 0, finish = report.result ? report.result.order.indexOf(report.setup.hero) + 1 : null;
report = { ...report, finish, medal: ['no medal', 'bronze', 'silver', 'gold'][medal], errors: [...new Set(errors)].slice(0, 20) };
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
const ok = report.session?.mode === 'race' && report.session.cars === 6 && report.session.slot === 6 && report.session.laps === 2 && medal >= 1 && !report.result?.dnf;
console.log(ok ? 'PASS' : 'FAIL', `the AI bot from P${report.session?.slot} of ${report.session?.cars}, ${report.session?.laps} laps at ${track}: P${finish}, ${report.medal} (${report.met?.map((m, i) => `${report.setup.objectives[i]} ${m ? 'yes' : 'no'}`).join('; ')})`);
process.exit(ok ? 0 : 1);
