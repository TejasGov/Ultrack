// One whole career season in the real game, through the real screens, with the AI driving the player's car: a new driver by keyboard, the Shootout, a negotiated first
// contract, then every week of the season by the hub's own buttons (a test day, a sponsor day ended from the pause menu, practice, the market, every qualifying and race),
// the round reports, the season review, a signing into season 2, a reload and the save slots.
//   node scripts/qa-lock.mjs -- node scripts/qa-career-season.mjs [url=http://127.0.0.1:5180]      (RACE_LAPS=1: the race distance)
// Out: qa/career-season/*.png, report.json; the summary is printed. About half an hour.
import { chromium } from 'playwright-core';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), raceLaps = +(process.env.RACE_LAPS ?? 1), here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'qa', 'career-season'); mkdirSync(out, { recursive: true });
setInterval(() => { try { const now = new Date(); utimesSync(join(here, '..', 'qa', '.browser-lock'), now, now); } catch { /* not under the lock */ } }, 60000).unref();   // qa-lock treats 20 min as stale
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.removeItem('ultrack.career.v1'); } } catch { /* none */ } });
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [], report = { keys: {}, rounds: [], weeks: [], shots: [] };
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const save = () => writeFileSync(join(out, 'report.json'), JSON.stringify({ ...report, errors }, null, 1));
const log = (...a) => { console.log(...a); save(); };
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: join(out, name + '.png') }); report.shots.push(name); };
const onScreen = (cls, timeout = 120000) => page.waitForSelector(`.screen.${cls}.on`, { timeout });
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(90); } };
const state = () => page.evaluate(async () => { const C = await import('/src/game/career/career.js'), s = window.game.career; const w = C.currentWeek(s); return { phase: s.clock.phase, week: s.clock.week, season: s.clock.season, round: s.clock.round, kind: w?.kind, event: w?.event?.kind ?? null, done: !!w?.event?.result, q: !!s.season?.current?.quali, screen: window.game.screenName, coins: s.wallet.coins, mid: s.season?.mid?.length ?? 0, sponsors: s.sponsors.offers.length, deals: s.sponsors.deals.length }; });
const go = (sel) => page.click(`.screen.on ${sel}`);
const tile = (name) => page.click(`.screen.on .cx-mode:has-text("${name}")`);
async function sessionUp() {
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.session.field.rig, null, { timeout: 300000 });
  await page.evaluate(() => window.game.session.field.setPlayer(false));
}
/** the AI drives until a valid lap (or the session is over); then the session ends as the player would end it */
async function lapDone() {
  await page.waitForFunction(() => !window.game.session || !window.game.careerRun || window.game.session.trk.get(window.game.field.hero).best !== null, null, { timeout: 420000, polling: 1000 });
  await page.evaluate(() => window.game.careerRun && window.game.careerDone());
}
const pauseEnd = async (label) => { await key('Escape'); await page.waitForTimeout(350); await page.click(`.screen.on button:has-text("${label}")`); await page.waitForTimeout(250); await page.click('.screen.on button:has-text("End") >> nth=-1'); };

try {
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' });
  await page.click('.bento-tile[data-id=career]'); await onScreen('career-start');

  // ---- a new driver, with the keyboard: Left and Right change a row; Enter steps it; Q and E typed in the name stay in the name
  await page.fill('.cs-input', 'Quincy Valois'); await key('ArrowDown');
  const nat = () => page.evaluate(() => document.querySelector('.row[aria-label=Nation] .seg .on')?.textContent), a = await nat(); await key('ArrowRight'); const b = await nat(); await key('ArrowLeft'); const c = await nat();
  report.keys.nation = { a, b, c, ok: a === 'IND' && b === 'GBR' && c === 'IND' };
  const nameEsc = await page.evaluate(() => window.game.screenName); report.keys.onCreate = nameEsc;
  await go('.cs-go'); await page.waitForSelector('text=Open Shootout'); report.code = await page.evaluate(() => window.game.career.player.code);

  // ---- the Shootout
  await go('.cs-go'); await sessionUp(); await page.waitForTimeout(3000); await shot('shootout-driving');
  await key('Escape'); await page.waitForTimeout(350); report.shootoutPause = await page.evaluate(() => [...document.querySelectorAll('.screen.on button')].map((x) => x.textContent.trim())); await key('Escape');
  await lapDone(); await page.waitForSelector('.of-card', { timeout: 60000 }); await shot('first-offers'); report.shootout = await page.evaluate(() => window.game.career.pending.shootout);

  // ---- a negotiated first contract, with the keyboard on the deal screen
  await page.click('.of-card >> nth=1'); await onScreen('career-deal');
  await page.evaluate(() => { const n = [...document.querySelectorAll('.screen.on [data-nav]')]; window.game.nav.reset(n.findIndex((e) => e.getAttribute('aria-label') === 'Salary')); });
  const sal = () => page.evaluate(() => document.querySelector('.screen.on .row[aria-label=Salary] .seg .on')?.textContent), s0 = await sal(); await key('ArrowRight'); const s1 = await sal(); await key('ArrowRight'); const s2 = await sal(); await key('ArrowLeft'); const s3 = await sal();
  report.keys.salary = { s0, s1, s2, s3, ok: s0 !== s1 && s1 !== s2 && s3 === s1 }; await shot('deal-ask');
  await page.click('.screen.on button:has-text("Propose")'); await page.waitForTimeout(300); report.negotiated = await page.evaluate(() => window.game.career.pending.offers[1]); await shot('deal-answer');
  if (report.negotiated.counter) { await page.click('.screen.on button:has-text("Accept their counter")'); await page.waitForTimeout(300); }
  await go('.cx-go'); await onScreen('career-hub'); await shot('home-week-1');

  // ---- every tab, with Q and E
  for (const t of ['calendar', 'events', 'inbox', 'deals', 'standings', 'garage', 'driver']) { await key('KeyE'); await shot('tab-' + t); }
  await key('KeyE'); report.keys.tabsWrap = await page.evaluate(() => document.querySelector('.career-hub .stabs button.on')?.textContent.startsWith('Home'));

  // ---- buy the free upgrade level, sign the first sponsor offer
  await key('KeyQ'); await key('KeyQ'); await page.click('.screen.on .cx-up >> nth=0'); await page.waitForTimeout(250); report.upgrade = await page.evaluate(() => window.game.career.garage.upgrades[window.game.career.contract.car]);
  await page.click('.stabs button:has-text("Deals")'); await page.click('.screen.on .cx-offer >> nth=0'); await onScreen('career-deal'); await shot('deal-sponsor');
  await go('.cx-go'); await onScreen('career-hub'); await page.waitForTimeout(250); report.sponsor = await page.evaluate(() => window.game.career.sponsors.deals[0]); await shot('deals-signed');
  await page.click('.stabs button:has-text("Home")');

  // ---- the season, week by week, through the hub's own buttons
  let raced = 0, ranTest = false, ranSponsor = false, ranPractice = false, knocked = false;
  for (let guard = 0; guard < 30; guard++) {
    const S = await state(); report.weeks.push({ week: S.week + 1, kind: S.kind, event: S.event, screen: S.screen }); log(`week ${S.week + 1}: ${S.kind}${S.event ? ' / ' + S.event : ''}, ${S.coins} U`);
    if (S.phase === 'review') break;
    if (S.kind === 'race') {
      if (!ranPractice) { ranPractice = true; await tile('Practice'); await sessionUp(); await page.waitForTimeout(6000); await shot('practice'); await pauseEnd('End practice'); await onScreen('career-hub'); await page.waitForTimeout(300); log('  practice done'); }
      await shot(`race-week-${S.round + 1}`);
      await go('.cx-go:has-text("Start qualifying")'); await sessionUp(); await lapDone(); await onScreen('career-hub'); await page.waitForSelector('.screen.on .cx-go:has-text("Start the race")', { timeout: 30000 });
      if (!raced) await shot('home-grid');
      await page.evaluate((n) => { const c = window.game.career; c.season.calendar[c.clock.round].laps = n; }, raceLaps);
      await go('.cx-go:has-text("Start the race")'); await page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig && !window.game.raceLoading.active, null, { timeout: 300000 });
      if (!raced) report.field = await page.evaluate(() => { const F = window.game.field, g = F.gridOrder; return { gridOrder: g, cars: F.cars.map((c) => ({ key: c.key, pace: +c.ai.pace.toFixed(4), slot: g?.indexOf(c.key) })), hero: window.game.session.driver(F.hero).name }; });
      await page.evaluate(() => window.game.session.field.setPlayer(false));
      await page.waitForFunction(() => window.game.screenName === 'careerReport', null, { timeout: 600000, polling: 1000 });
      await shot(`report-${S.round + 1}`);
      const r = await page.evaluate(() => { const r = window.game.career.season.results.at(-1); return { round: r.round, track: r.track, finish: r.finish, grid: r.grid, rr: r.rr, xp: r.xp, rep: r.rep, trust: r.trust, coins: r.coins, objectives: r.objectives.map((o) => [o.kind, o.met]) }; }); report.rounds.push(r); raced++; log('  round', JSON.stringify(r));
      await go('.cx-go'); await page.waitForFunction(() => ['careerHub', 'careerStart'].includes(window.game.screenName)); await page.waitForTimeout(300);
    } else if (S.event === 'test' && !S.done && !ranTest) {
      ranTest = true; await shot('home-test-week'); await tile('Test day'); await sessionUp(); await lapDone(); await onScreen('career-hub'); await page.waitForTimeout(300); report.testDay = await page.evaluate(async () => (await import('/src/game/career/career.js')).currentWeek(window.game.career).event.result); await shot('home-after-test'); log('  test day', JSON.stringify(report.testDay));
      await go('.cx-go'); await page.waitForTimeout(300);
    } else if (S.event === 'sponsor' && !S.done && !ranSponsor) {
      ranSponsor = true; await shot('home-sponsor-week'); await tile('Sponsor day'); await sessionUp(); await page.waitForTimeout(6000);
      await key('Escape'); await page.waitForTimeout(350); report.sponsorPause = await page.evaluate(() => [...document.querySelectorAll('.screen.on button')].map((x) => x.textContent.trim())); await key('Escape'); await page.waitForTimeout(300);
      await pauseEnd('End sponsor day'); await onScreen('career-hub'); await page.waitForTimeout(300); report.sponsorDay = await page.evaluate(async () => (await import('/src/game/career/career.js')).currentWeek(window.game.career).event.result); log('  sponsor day', JSON.stringify(report.sponsorDay));
      await go('.cx-go'); await page.waitForTimeout(300);
    } else if (S.kind === 'market') {
      await shot('home-market'); await page.click('.stabs button:has-text("Deals")'); await shot('deals-market');
      if (!knocked) { knocked = true; await page.click('.screen.on .cx-teamrow >> nth=0'); await page.waitForTimeout(300); report.knock = await page.evaluate(() => document.querySelector('.toast, .busy')?.textContent ?? null); await shot('deals-knocked'); }
      await page.click('.stabs button:has-text("Home")'); await page.waitForTimeout(250); await go('.cx-go'); await page.waitForTimeout(300);
      const after = await state(); if (after.week === S.week) { await shot('advance-warned'); report.advanceWarned = true; await go('.cx-go'); await page.waitForTimeout(300); }
    } else {
      await go('.cx-go'); await page.waitForTimeout(300);
      const after = await state(); if (after.week === S.week) { await shot('advance-warned'); report.advanceWarned = true; await go('.cx-go'); await page.waitForTimeout(300); }
    }
  }
  // ---- the season review, the market, signing into season 2
  await onScreen('career-start'); await page.waitForSelector('.cs-review'); await shot('review');
  report.review = await page.evaluate(() => { const s = window.game.career; return { review: s.pending.review, offers: s.pending.offers.map((o) => [o.id, o.salary, o.seasons, !!o.keep]), history: s.history.at(-1), inbox: s.inbox.length }; }); log('review', JSON.stringify(report.review.review));
  await page.click('.screen.on .cx-offer >> nth=0'); await onScreen('career-deal'); await shot('deal-review'); await go('.cx-go'); await onScreen('career-hub'); await page.waitForTimeout(300); await shot('home-season-2');
  report.season2 = await page.evaluate(() => { const s = window.game.career; return { season: s.clock.season, week: s.clock.week, weeks: s.season.weeks.length, team: s.contract.team, car: s.contract.car, world: s.season.world, cal: s.season.calendar.map((r) => [r.track, r.look, r.weather]) }; });
  // ---- reload: the same career, the same week; the slots; back to the menu with free play as it was
  await page.reload(); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 }); await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' }); await page.click('.bento-tile[data-id=career]'); await onScreen('career-hub');
  report.afterReload = await state();
  await page.click('.stabs button:has-text("Driver")'); await page.click('.screen.on button:has-text("Other careers")'); await page.waitForSelector('.cs-slot'); await shot('slots'); await page.click('.cs-slot >> nth=1'); await page.waitForSelector('.cs-input'); await key('Escape'); await page.waitForSelector('.cs-slot'); report.keys.escToSlots = true;
  await page.click('.cs-slot >> nth=0'); await onScreen('career-hub'); await page.click('.screen.on button:has-text("Menu")'); await onScreen('home'); report.freePlay = await page.evaluate(() => ({ car: JSON.parse(localStorage.getItem('ultrack.v1')).car, track: window.game.ctx.trackId() }));
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: join(out, 'failed.png') }).catch(() => {}); }
save(); console.log(JSON.stringify({ keys: report.keys, rounds: report.rounds.length, advanceWarned: report.advanceWarned, season2: report.season2, afterReload: report.afterReload, errors }, null, 1));
await browser.close();
