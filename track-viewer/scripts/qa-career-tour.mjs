// The Tour's Open in the real game: a career is moved to the Japan Open week in the page (no driving), then the Open is played through the hub's own buttons with the AI driving
// the player's car: the qualifying lap at Dry Lake, the Last Chance Qualifier there, and the Final at Tokyo. A second career, seeded into the top 4, goes straight to the Final.
// Screens are shot at 1280x720 and 1600x900.
//   node scripts/qa-lock.mjs -- node scripts/qa-career-tour.mjs [url=http://127.0.0.1:5180]
// Out: qa/career-tour/*.png, report.json
import { chromium } from 'playwright-core';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'qa', 'career-tour'); mkdirSync(out, { recursive: true });
setInterval(() => { try { const now = new Date(); utimesSync(join(here, '..', 'qa', '.browser-lock'), now, now); } catch { /* not under the lock */ } }, 60000).unref();
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.removeItem('ultrack.career.v1'); } } catch { /* none */ } });
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [], report = { steps: [] };
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const log = (...a) => { console.log(...a); report.steps.push(a.join(' ')); writeFileSync(join(out, 'report.json'), JSON.stringify({ ...report, errors }, null, 1)); };
const shot = async (name, sizes = [[1280, 720], [1600, 900]]) => { for (const [w, h] of sizes) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(400); await page.screenshot({ path: join(out, `${name}-${w}.png`) }); } await page.setViewportSize({ width: 1280, height: 720 }); };
const onScreen = (cls, timeout = 120000) => page.waitForSelector(`.screen.${cls}.on`, { timeout });
const run = (code, ...args) => page.evaluate(async ([c, a]) => { const C = await import('/src/game/career/career.js'), R = await import('/src/game/career/rules.js'), S = await import('/src/game/career/save.js'), SH = await import('/src/game/career-shell.js'); return new Function('C', 'R', 'S', 'SH', 'g', 'a', c)(C, R, S, SH, window.game, a); }, [code, args]);
const go = (sel) => page.click(`.screen.on ${sel}`);
async function sessionUp() { await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.session.field.rig, null, { timeout: 300000 }); await page.evaluate(() => window.game.session.field.setPlayer(false)); }
async function lapDone() { await page.waitForFunction(() => !window.game.session || !window.game.careerRun || window.game.session.trk.get(window.game.field.hero).best !== null, null, { timeout: 420000, polling: 1000 }); await page.evaluate(() => window.game.careerRun && window.game.careerDone()); }
/** a career in the page, moved without driving to the race week of the given round (1-based) */
const setup = (seed, to, seeded) => run(`
  const s = C.newCareer({ name: 'Quincy Valois', seed: a[0], now: '2026-11-04T00:00:00Z' }); const sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
  C.acceptOffer(s, s.pending.offers.find((o) => o.team === 'mojave').id, SH.available());
  const play = () => { if (s.clock.phase === 'paddock') C.finishQuali(s, 60); const q = s.season.current.quali, hero = s.contract.car; if (s.season.current.open?.stage === 'lcq') C.finishLcq(s, { order: [hero, ...q.grid.filter((k) => k !== hero)].slice(0, 8), best: {} });
    const others = s.season.current.quali.grid.filter((k) => k !== hero); if (s.season.current.quali.grid.includes(hero)) others.splice(4, 0, hero); return C.finishRace(s, { order: others, best: {} }); };
  while (s.clock.round < a[1] - 1) { while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); if (a[2] && s.clock.round === a[1] - 2) s.ranking.seed.YOU = 1e5; play(); }   // the Open's entry is taken when the round before it ends
  while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s);
  g.career = s; S.saveCareer(s, 0); g.show('careerHub', 'home'); return { round: C.currentRound(s).name, rank: C.playerRank(s) };`, seed, to, seeded);
const tabs = async (prefix) => { for (const t of ['Home', 'Calendar', 'Standings', 'Driver']) { await page.click(`.stabs button:has-text("${t}")`); await page.waitForTimeout(300); await shot(`${prefix}-${t.toLowerCase()}`); } await page.click('.stabs button:has-text("Home")'); };
const panel = () => page.evaluate(() => { const s = window.game.career, o = s.season.current.open; return { stage: o?.stage, rank: o?.rank, seeds: o?.seeds, grid: s.season.current.quali?.grid, phase: s.clock.phase }; });

try {
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' });
  // ---- a Tour week: the Road card, and the strip of ten rounds
  log('setup', JSON.stringify(await setup(4242, 1, false))); await onScreen('career-hub'); await shot('tour-home');
  // ---- the Japan Open, not seeded: qualifying, the Last Chance, the Final
  log('setup', JSON.stringify(await setup(4243, 3, false))); await onScreen('career-hub'); await page.waitForTimeout(500);
  report.before = await panel(); await tabs('open'); await shot('open-home-quali');
  await go('.cx-go:has-text("Start qualifying")'); await sessionUp(); await lapDone(); await onScreen('career-hub'); await page.waitForTimeout(400);
  if (!(await page.evaluate(() => window.game.career.season.current.quali.grid.includes(window.game.career.contract.car)))) { log('the AI lap missed the cut: a retry lap of 1 s stands in, so the Last Chance race itself is played'); await run(`C.finishQuali(g.career, 1); S.saveCareer(g.career); g.show('careerHub', 'home');`); await page.waitForTimeout(400); }
  report.afterQuali = await panel(); log('after qualifying', JSON.stringify(report.afterQuali)); await shot('open-home-lcq');
  if (report.afterQuali.stage === 'lcq' && report.afterQuali.grid.includes(await page.evaluate(() => window.game.career.contract.car))) {
    await go('.cx-go:has-text("Start the Last Chance")'); await page.waitForSelector('.race-loading', { timeout: 20000 }); report.loadingLcq = await page.evaluate(() => document.querySelector('.race-loading').innerText.replace(/\n+/g, ' | ')); await shot('loading-lcq', [[1280, 720]]);
    await page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig && !window.game.raceLoading.active, null, { timeout: 300000 });
    report.lcqRace = await page.evaluate(() => ({ track: window.game.ctx.trackId(), laps: window.game.session.laps, cars: window.game.field.cars.length, grid: window.game.field.gridOrder }));
    await page.evaluate(() => window.game.session.field.setPlayer(false)); await shot('lcq-driving', [[1280, 720]]);
    await page.waitForFunction(() => window.game.screenName === 'careerReport', null, { timeout: 600000, polling: 1000 });
    log('lcq race', JSON.stringify(report.lcqRace)); await page.waitForTimeout(500); await shot('report-lcq');
    report.lcqOutcome = await page.evaluate(() => { const s = window.game.career; return { stage: s.season.current.open?.stage, phase: s.clock.phase, results: s.season.results.length, lcq: s.season.current.open?.lcq?.finish }; }); log('lcq outcome', JSON.stringify(report.lcqOutcome));
    await go('.cx-go'); await page.waitForFunction(() => window.game.screenName === 'careerHub'); await page.waitForTimeout(400);
    if (report.lcqOutcome.stage === 'final') {
      await shot('open-home-final'); await go('.cx-go:has-text("Start the Final")'); await page.waitForSelector('.race-loading', { timeout: 20000 }); report.loadingFinal = await page.evaluate(() => document.querySelector('.race-loading').innerText.replace(/\n+/g, ' | ')); await shot('loading-final', [[1280, 720]]);
      await page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig && !window.game.raceLoading.active, null, { timeout: 300000 });
      report.finalRace = await page.evaluate(() => ({ track: window.game.ctx.trackId(), laps: window.game.session.laps, cars: window.game.field.cars.length, grid: window.game.field.gridOrder }));
      await page.evaluate(() => window.game.session.field.setPlayer(false)); await page.waitForFunction(() => window.game.screenName === 'careerReport', null, { timeout: 600000, polling: 1000 });
      await page.waitForTimeout(500); await shot('report-final'); log('final race', JSON.stringify(report.finalRace));
      await go('.cx-go'); await page.waitForFunction(() => window.game.screenName === 'careerHub'); await page.waitForTimeout(400); await tabs('after-open');
    } else { log('eliminated in the Last Chance: the Final was run without the player'); await shot('after-lcq-out'); await tabs('after-open'); }
  } else { log('missed the cut in qualifying: the Open goes on without the player'); }
  // ---- seeded: straight to the Final, no qualifying, practice open
  log('setup', JSON.stringify(await setup(4244, 3, true))); await onScreen('career-hub'); await page.waitForTimeout(500);
  report.seeded = await panel(); log('seeded', JSON.stringify(report.seeded)); await shot('seeded-home');
  await page.click('.cx-mode:has-text("Qualifying")'); await page.waitForTimeout(300); report.seededToast = await page.evaluate(() => document.querySelector('.toast, .busy')?.textContent ?? null);
  await go('.cx-go:has-text("Start the Final")'); await page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig && !window.game.raceLoading.active, null, { timeout: 300000 });
  report.seededRace = await page.evaluate(() => ({ track: window.game.ctx.trackId(), laps: window.game.session.laps, cars: window.game.field.cars.length, hero: window.game.field.gridOrder.indexOf(window.game.field.hero.key) }));
  await page.evaluate(() => window.game.session.field.setPlayer(false)); await page.waitForFunction(() => window.game.screenName === 'careerReport', null, { timeout: 600000, polling: 1000 });
  await page.waitForTimeout(500); await shot('report-seeded-final'); log('seeded race', JSON.stringify(report.seededRace));
  report.seededResult = await page.evaluate(() => { const r = window.game.career.season.results.at(-1); return { finish: r.finish, grid: r.grid, rank: r.rank, coins: r.coins, kind: r.kind, rr: r.rr }; }); log('seeded result', JSON.stringify(report.seededResult));
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: join(out, 'failed.png') }).catch(() => {}); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ ...report, errors }, null, 1)); console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
