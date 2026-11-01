// Career Mode in the real game, headless: a fresh career through the screens (create, Shootout, negotiated offers), the Paddock tabs,
// one qualifying and one feature race with the AI driving the player's car, the round report, then the ladder: a sponsor day, a test
// day, a mid-season offer, a seat review, a race with a moved driver on the grid, and the save slots. Stills of every screen.
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
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.removeItem('ultrack.career.v1'); } } catch { /* none */ } });
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
  await page.click('.of-card >> nth=1'); await page.waitForSelector('text=Negotiate with');
  await page.click('.row:has-text("Salary") .seg button >> nth=1'); await shot('3-negotiate');   // +10 % fits any first offer's limit
  await page.click('button:has-text("Propose terms")'); await page.waitForSelector('text=Terms agreed'); await shot('3-agreed');
  report.negotiated = await page.evaluate(() => window.game.career.pending.offers.find((o) => o.agreed));
  await page.click('.cs-go'); await onScreen('career-hub'); await shot('4-paddock');
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
  // ---- the ladder: a side event of each kind (round 2 has one), each a real session
  await page.click('.stabs button:has-text("Paddock")');
  const runSide = async (kind, until, read) => {
    await page.evaluate((k) => { const c = window.game.career.season.current; c.side = { kind: k, result: null }; window.game.screens.careerHub.onShow('paddock'); }, kind);
    await page.waitForSelector('.ch-side'); await shot('11-side-' + kind); await page.click('.ch-side');
    await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active && window.game.session.field.rig, null, { timeout: 300000 });
    report['session_' + kind] = await page.evaluate(() => ({ mode: window.game.session.mode, kind: window.game.careerRun?.kind }));
    await page.evaluate(() => window.game.session.field.setPlayer(false)); await page.waitForTimeout(8000); await shot('11-side-' + kind + '-driving');
    await page.waitForFunction(until, null, { timeout: 600000, polling: 1000 });
    await page.evaluate(() => window.game.careerDone()); await onScreen('career-hub'); await shot('11-side-' + kind + '-result');
    report['side_' + kind] = await page.evaluate(() => window.game.career.season.current.side.result);
  };
  await runSide('sponsor', () => window.game.session.drift?.left < 75);       // ended early: the 90 s run itself is the free-play mode's
  await runSide('test', () => window.game.session.trk.get(window.game.field.hero).best !== null);
  // ---- a mid-season offer and a seat review in the Paddock, then a race with an academy driver on the grid and a free agent's rivalry
  await page.evaluate(() => { const g = window.game, c = g.career, o = { id: 'toro-B-w1', team: 'toro', seat: 'B', car: 'huracan', tier: 'maestro', status: 'junior', salary: 600, signing: 1500, seasons: 2, w1: true, why: 'Maestro interest: your reputation cleared their bar.' };
    c.season.w1 = { offer: o, state: 'open' }; c.contract.warning = { left: 2, met: 0 }; c.career.heat.LIN = 55; g.screens.careerHub.onShow('paddock'); });
  await page.waitForSelector('text=Mid-season offer'); await shot('12-w1-warning');
  await page.click('button:has-text("Sign for next season")'); await page.waitForSelector('text=Signed for next season'); await shot('12-w1-signed');
  report.w1 = await page.evaluate(() => ({ next: window.game.career.contract.next?.team, state: window.game.career.season.w1.state, coins: window.game.career.wallet.coins }));
  report.moved = await page.evaluate(() => { const c = window.game.career, k = c.season.current.entries[0]; c.world.academy.OKA = { name: 'Tobi Okafor', nation: 'NGA' }; c.world.ratings.OKA = 74; c.world.ages.OKA = 20; c.world.seats[k] = 'OKA'; return k; });
  await page.click('.ch-go');
  await drive(() => window.game.session.trk.get(window.game.field.hero).best !== null, () => window.game.careerDone());
  await onScreen('career-hub'); await page.evaluate((n) => { const c = window.game.career; c.season.calendar[c.clock.round].laps = n; }, raceLaps);
  await page.click('.ch-go');
  await page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig, null, { timeout: 300000 });
  report.movedOnTrack = await page.evaluate((k) => { const s = window.game.session, c = window.game.field.cars.find((x) => x.key === k); return c && s.driver(c).name; }, report.moved);
  await drive(() => window.game.screenName === 'careerReport', null);
  await shot('13-report-moved');
  report.movedOnReport = await page.evaluate(() => document.querySelector('.career-report').textContent.includes('Tobi Okafor'));
  await page.click('.career-report .btn-primary'); await onScreen('career-hub');
  // ---- the save slots: other careers, a second career in an empty slot, back to the first
  await page.click('.stabs button:has-text("Profile")'); await shot('14-profile');
  await page.click('button:has-text("Other careers")'); await page.waitForSelector('.cs-slot'); await shot('15-slots');
  await page.click('.cs-slot >> nth=1'); await page.fill('.cs-input', 'Second Driver'); await page.click('.cs-go'); await page.waitForSelector('text=Open Shootout');
  report.slots = await page.evaluate(() => JSON.parse(localStorage.getItem('ultrack.career.v1')).slots.map((s) => s?.player.name ?? null));
  await page.reload(); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  report.freePlayAfterReload = await page.evaluate(() => ({ car: window.game.ctx && JSON.parse(localStorage.getItem('ultrack.v1')).car, track: window.game.ctx.trackId() }));
  report.afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('ultrack.career.v1')).slots.map((s) => s?.player.name ?? null));
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' }); await page.click('.bento-tile[data-id=career]'); await onScreen('career-start'); await shot('16-second-career');
  await page.evaluate(() => { window.game.career = null; window.game.screens.careerStart.onShow(); }); await page.click('.cs-slot >> nth=0'); await onScreen('career-hub'); await shot('17-first-career-back');
  report.backIn = await page.evaluate(() => window.game.career.player.name);
  await page.click('.career-hub.on .sfoot .btn-ghost'); await onScreen('home'); await shot('10-back-to-menu');
  report.freePlay = await page.evaluate(() => ({ car: JSON.parse(localStorage.getItem('ultrack.v1')).car, track: window.game.ctx.trackId() }));
} catch (e) { errors.push('qa: ' + e.message); await shot('failed').catch(() => {}); }
report.errors = errors;
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, steps: report.steps.length }, null, 1));
await browser.close();
