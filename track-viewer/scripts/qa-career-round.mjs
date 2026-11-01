// Career Mode in the real game, headless: a fresh career through the screens (create, Shootout, offers), the Paddock tabs, one
// qualifying and one feature race with the AI driving the player's car, then the round report. Stills of every screen.
//   node scripts/qa-lock.mjs -- node scripts/qa-career-round.mjs [url=http://127.0.0.1:5180]      (RACE_LAPS=1: the race distance)
// Out: qa/career-round/*.png, report.json; the summary is printed.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), raceLaps = +(process.env.RACE_LAPS ?? 1);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'career-round'); mkdirSync(out, { recursive: true });
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.removeItem('ultrack.career.v1'); } catch { /* none */ } });
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [], report = { steps: [] };
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: join(out, name + '.png') }); report.steps.push(name); console.log('  ' + name); };
const onScreen = (cls) => page.waitForSelector(`.screen.${cls}.on`, { timeout: 60000 });
/** a career session started: the AI drives the hero until `until` holds in the page, then the session ends as the career would */
async function drive(until, end, timeout = 600000) {
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.session.field.rig, null, { timeout: 300000 });
  await page.evaluate(() => window.game.session.field.setPlayer(false));
  await page.waitForTimeout(8000); await shot('session-' + report.steps.length);
  await page.waitForFunction(until, null, { timeout, polling: 1000 });
  if (end) await page.evaluate(end);
}

try {
  await page.goto(base);
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' });
  await shot('menu');
  await page.click('.bento-tile[data-id=career]'); await onScreen('career-start'); await shot('1-create');
  await page.fill('.cs-input', 'Test Driver'); await page.click('.cs-go'); await page.waitForSelector('text=Open Shootout'); await shot('2-shootout');
  // the Shootout: one valid lap, then End qualifying (the pause menu's path)
  await page.click('.cs-go');
  await drive(() => window.game.session.trk.get(window.game.field.hero).best !== null, () => window.game.careerDone());
  await onScreen('career-start'); await page.waitForSelector('.of-card'); await shot('3-offers');
  report.shootout = await page.evaluate(() => window.game.career.pending.shootout);
  await page.click('.of-card >> nth=1'); await page.click('.cs-go'); await onScreen('career-hub'); await shot('4-paddock');
  for (const [i, t] of ['Calendar', 'Standings', 'Garage', 'Profile'].entries()) { await page.click(`.stabs button:has-text("${t}")`); await shot(`5-${i}-${t.toLowerCase()}`); }
  await page.click('.stabs button:has-text("Garage")'); await page.click('.ch-up >> nth=0'); await shot('5-9-bought');   // buy engine level 1 (the Shootout reached CL 2)
  report.afterBuy = await page.evaluate(() => ({ coins: window.game.career.wallet.coins, up: window.game.career.garage.upgrades[window.game.career.contract.car] }));
  await page.click('.stabs button:has-text("Paddock")');
  report.round = await page.evaluate(() => window.game.career.season.calendar[window.game.career.clock.round]);
  // qualifying: one valid lap, then End qualifying
  await page.click('.ch-go');
  await drive(() => window.game.session.trk.get(window.game.field.hero).best !== null, () => window.game.careerDone());
  await onScreen('career-hub'); await shot('6-grid');
  report.quali = await page.evaluate(() => { const q = window.game.career.season.current.quali; return { grid: q.grid, duel: q.duel, me: q.laps[window.game.career.contract.car] }; });
  // the race, shortened to RACE_LAPS: checks the grid order and AI pace reached the field
  await page.evaluate((n) => { const c = window.game.career; c.season.calendar[c.clock.round].laps = n; }, raceLaps);
  await page.click('.ch-go');
  await page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig, null, { timeout: 300000 });
  report.field = await page.evaluate(() => { const F = window.game.field, g = F.gridOrder; return { gridOrder: g, cars: F.cars.map((c) => ({ key: c.key, pace: +c.ai.pace.toFixed(4), slot: g?.indexOf(c.key) })), heroName: window.game.session.driver(F.hero).name }; });
  await drive(() => window.game.screenName === 'careerReport', null);
  await shot('7-report');
  report.result = await page.evaluate(() => { const r = window.game.career.season.results.at(-1); return { finish: r.finish, grid: r.grid, rr: r.rr, xp: r.xp, rep: r.rep, trust: r.trust, coins: r.coins, objectives: r.objectives.map((o) => [o.kind, o.met]) }; });
  await page.click('.career-report .btn-primary'); await onScreen('career-hub'); await shot('8-next-round');
  await page.click('.stabs button:has-text("Standings")'); await shot('9-standings');
  await page.click('.career-hub.on .sfoot .btn-ghost'); await onScreen('home'); await shot('10-back-to-menu');
  report.freePlay = await page.evaluate(() => ({ car: JSON.parse(localStorage.getItem('ultrack.v1')).car, track: window.game.ctx.trackId() }));
} catch (e) { errors.push('qa: ' + e.message); await shot('failed').catch(() => {}); }
report.errors = errors;
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, steps: report.steps.length }, null, 1));
await browser.close();
