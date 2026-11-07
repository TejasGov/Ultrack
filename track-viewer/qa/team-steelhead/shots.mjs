// Steelhead QA shots at 1600x900 (the career screens also at 390x844): the logo card, the menu and garage with the Corvette ZR1 and Stingray, a quick race
// in each with the AI driving it, and a first-season career race from Mojave's B seat with Steelhead on the Challenger grid, qualified outside the eight
// (the first season's grace: the toast, the grid, the race and its report); then a season-2 Rookie seat (graceRookie: the same grace in its own words); then the hub from a Steelhead seat.
//   node scripts/qa-lock.mjs -- node qa/team-steelhead/shots.mjs [url=http://127.0.0.1:5180]
// Out: qa/team-steelhead/*.png, report.json
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), out = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.removeItem('ultrack.career.v1'); localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: 'marina', look: 'day', weather: 'dry', laps: 1 }, car: 'zr1' })); } } catch { /* none */ } });
// Vite's HMR socket stubbed: another session saving a file would otherwise reload the page mid-race
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [], failed = [], report = {};
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => failed.push(r.url().replace(base, '')));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(base, '')}`); });
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: out + name + '.png' }); };
/** the same screen at phone width too */
const both = async (name) => { await shot(name); await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(800); await shot(name + '-390'); await page.setViewportSize({ width: 1600, height: 900 }); await page.waitForTimeout(800); };
const run = (code, ...args) => page.evaluate(async ([c, a]) => { const C = await import('/src/game/career/career.js'), R = await import('/src/game/career/rules.js'), S = await import('/src/game/career/save.js'), SH = await import('/src/game/career-shell.js'), O = await import('/src/game/career/offers.js'); return new Function('C', 'R', 'S', 'SH', 'O', 'g', 'a', c)(C, R, S, SH, O, window.game, a); }, [code, args]);
const raceUp = () => page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig && !window.game.raceLoading.active, null, { timeout: 300000 });
try {
  // the logo card in the brand guide
  const g = await ctx.newPage(); await g.goto(base + '/team-brand-guide.html'); await g.waitForTimeout(1500);
  await (await g.$$('article')).at(-1).screenshot({ path: out + 'logos.png' }); await g.close();
  // the menu and the garage, the ZR1 the player's car
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=race]', { state: 'visible' }); await page.waitForTimeout(4000); await shot('menu-zr1');
  await page.evaluate(() => window.game.show('garage')); await page.waitForTimeout(6000); await shot('garage-zr1');
  for (const [i, name] of [[1, 'specs'], [3, 'paint']]) { await page.click(`.ga-tabs button >> nth=${i}`); await page.waitForTimeout(1500); await shot('garage-zr1-' + name); }
  await page.click('.ga-tabs button >> nth=0'); await page.click('button.lrow.car[data-key=stingray]'); await page.waitForTimeout(6000); await shot('garage-stingray');
  await page.click('.ga-tabs button >> nth=1'); await page.waitForTimeout(1500); await shot('garage-stingray-specs'); await page.click('.ga-tabs button >> nth=3'); await page.waitForTimeout(1500); await shot('garage-stingray-paint'); await page.click('.ga-tabs button >> nth=0');
  // a quick race in each car: it and one car from each of the seven teams nearest Steelhead's place (Aurum and Saetta sit out), the AI driving it
  report.quickRace = {};
  for (const car of ['zr1', 'stingray']) {
    await page.evaluate(async (car) => { const { store } = await import('/src/game/store.js'); store.selectCar(car); window.game.lineup(); window.game.show('menu'); }, car); await page.waitForTimeout(800); await page.click('.bento-tile[data-id=race]');
    await page.waitForSelector('.panel.setup button.cta', { state: 'visible' }); await page.click('.panel.setup button.cta'); await raceUp();
    await page.evaluate(() => window.game.session.field.setPlayer(false)); await page.waitForTimeout(28000); await shot('race-' + car);
    report.quickRace[car] = await page.evaluate(() => { const F = window.game.field; return { cars: F.cars.map((c) => c.key), hero: F.hero.key, kmh: Math.round(F.hero.speed * 3.6), pos: window.game.session.heroPos }; });
    await page.waitForTimeout(12000); await shot('race-' + car + '-2');
    report.quickRace[car].kmhLater = await page.evaluate(() => Math.round(window.game.field.hero.speed * 3.6));
    await page.evaluate(() => { window.game.endSession(); window.game.show('menu'); });
  }
  // a first-season career race from Mojave's B seat: the Challenger of ten, Steelhead on it
  report.career = await run(`
    const s = C.newCareer({ name: 'Quincy Valois', seed: 5160, now: '2026-11-07T00:00:00Z' }), sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    C.acceptOffer(s, s.pending.offers.find((o) => o.team === 'mojave').id, SH.available()); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s);
    g.career = s; S.saveCareer(s, 0); g.show('careerHub', 'home'); return { round: C.currentRound(s).name, exp: s.season.current.expPos, field: s.season.current.field, challenger: R.carsIn(s, 'challenger'), note: C.weekNote(s, C.currentRound(s)) };`);
  await page.waitForSelector('.screen.career-hub.on'); await both('career-home');
  for (const t of ['Standings', 'Calendar']) { await page.click(`.stabs button:has-text("${t}")`); await page.waitForTimeout(400); await both('career-' + t.toLowerCase()); }
  await page.click('.stabs button:has-text("Home")');
  // no valid lap under the grace: the hub asks for a lap, not for the cut (a copy of the career, put back after)
  await run(`g.qaKeep = structuredClone(g.career); g.qaSession = g.careerSession; g.careerSession = (kind, spec, done) => done({ best: null, mateLap: null, hits: [] });`);
  await page.click('.screen.on .cx-mode.k-race[data-ic=time-trial]'); await page.waitForTimeout(400); await shot('career-nolap-toast'); await page.waitForTimeout(4500); await both('career-home-nolap');
  report.career.nolapFirst = await run(`return [...document.querySelectorAll('.screen.on .cx-mode.k-race')].map((e) => e.textContent);`);
  // the retry spent with no lap either (finishQuali as the session calls it): no race this round, and every tile says so
  await run(`C.finishQuali(g.career, null); g.show('careerHub', 'home');`); await page.waitForTimeout(800); await both('career-home-nolap-used');
  report.career.nolap = await run(`const q = g.career.season.current.quali, r = { waits: C.graceWaits(g.career, q), tiles: [...document.querySelectorAll('.screen.on .cx-mode.k-race')].map((e) => e.textContent), next: document.querySelector('.screen.on .cx-next')?.textContent };
    g.careerSession = g.qaSession; delete g.qaSession; g.career = g.qaKeep; delete g.qaKeep; S.saveCareer(g.career, 0); g.show('careerHub', 'home'); return r;`);
  await page.waitForTimeout(800);
  // qualifying through the hub's own tile, the session replaced by a lap just slower than every Challenger car: P10, the grace
  report.career.lap = await run(`const t = structuredClone(g.career); C.finishQuali(t, null); const q = t.season.current.quali, me = t.contract.car, ch = q.order.filter((k) => k !== me);
    const lap = q.laps[ch.at(-1)] + 0.35; g.qaSession = g.careerSession; g.careerSession = (kind, spec, done) => done({ best: lap, mateLap: null, hits: [] }); return lap;`);
  await page.click('.screen.on .cx-mode.k-race[data-ic=time-trial]'); await page.waitForTimeout(400); await shot('career-quali-toast');
  report.career.quali = await run(`g.careerSession = g.qaSession; delete g.qaSession; const q = g.career.season.current.quali; return { grace: q.grace, grid: q.grid, place: C.qualiPlace(q, g.career.contract.car), slot: C.gridSlot(q, g.career.contract.car), lapToRace: C.lapToRace(g.career, q) };`);
  await page.waitForTimeout(4500); await both('career-home-grace');
  await page.click('.screen.on .cx-go:has-text("Start the race")'); await raceUp();
  await page.evaluate(() => window.game.session.field.setPlayer(false)); await page.waitForTimeout(30000); await shot('career-race');
  report.career.race = await page.evaluate(() => ({ cars: window.game.field.cars.map((c) => c.key), grid: window.game.field.gridOrder, laps: window.game.session.laps }));
  await page.waitForTimeout(15000); await shot('career-race-2');
  await page.waitForFunction(() => window.game.screenName === 'careerReport', null, { timeout: 600000, polling: 1000 }); await both('career-report');
  report.career.result = await run(`const r = g.career.season.results.at(-1); return { finish: r.finish, grid: r.grid, grace: r.grace, entries: r.entries.length, dnq: r.entries.filter((e) => e.dnq).map((e) => e.key), mail: g.career.inbox.find((m) => /^Round 1:/.test(m.title))?.title };`);
  await page.click('.screen.on .cx-go'); await page.waitForSelector('.screen.career-hub.on'); await page.click('.stabs button:has-text("Standings")'); await page.waitForTimeout(400); await both('career-standings-after');
  // season 2 in a Rookie seat (graceRookie): the clock moved on, the grace stays in its own words; qualified P10 -> starts P8, the toast, the tile, the grid list and the report
  report.rookie2 = await run(`
    const s = C.newCareer({ name: 'Quincy Valois', seed: 5162, now: '2026-11-07T00:00:00Z' }), sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    C.acceptOffer(s, s.pending.offers.find((o) => o.team === 'mojave').id, SH.available()); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s);
    s.clock.season = 2; g.career = s; S.saveCareer(s, 0); g.show('careerHub', 'home'); return { season: s.clock.season, graceOn: C.graceOn(s), note: C.weekNote(s, C.currentRound(s)) };`);
  await page.waitForSelector('.screen.career-hub.on'); await both('rookie2-home');
  await run(`const t = structuredClone(g.career); C.finishQuali(t, null); const q = t.season.current.quali, me = t.contract.car, ch = q.order.filter((k) => k !== me);
    const lap = q.laps[ch.at(-1)] + 0.35; g.qaSession = g.careerSession; g.careerSession = (kind, spec, done) => done({ best: lap, mateLap: null, hits: [] });`);
  await page.click('.screen.on .cx-mode.k-race[data-ic=time-trial]'); await page.waitForTimeout(400); await shot('rookie2-quali-toast');
  await run(`g.careerSession = g.qaSession; delete g.qaSession;`); await page.waitForTimeout(4500); await both('rookie2-home-grace');
  report.rookie2.quali = await run(`const q = g.career.season.current.quali; return { grace: q.grace, place: C.qualiPlace(q, g.career.contract.car), slot: C.gridSlot(q, g.career.contract.car), tiles: [...document.querySelectorAll('.screen.on .cx-mode.k-race')].map((e) => e.textContent) };`);
  await run(`const q = g.career.season.current.quali, r = C.finishRace(g.career, { order: q.grid, best: {} }); S.saveCareer(g.career, 0); g.show('careerReport', r);`); await page.waitForTimeout(1200); await both('rookie2-report');
  report.rookie2.report = await run(`const r = g.career.season.results.at(-1); return { finish: r.finish, grid: r.grid, grace: r.grace, text: document.querySelector('.screen.on .cr-hero .cx-note')?.textContent, press: g.career.inbox.filter((m) => /press|Press/.test(m.title)).map((m) => m.title).slice(0, 2) };`);
  // the hub from Steelhead's A seat
  report.steelhead = await run(`
    const s = C.newCareer({ name: 'Quincy Valois', seed: 5161, now: '2026-11-07T00:00:00Z' }), sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    const o = O.offer(s, 'steelhead', 'A', { salary: 650, signing: 1000, seasons: 2, interest: 0.5, why: 'QA', tag: '-qa' }); s.pending.offers.push(o); C.acceptOffer(s, o.id, SH.available());
    g.career = s; S.saveCareer(s, 0); g.show('careerHub', 'home'); return { car: s.contract.car, div: s.season.div, exp: s.season.current.expPos, mate: C.driverAt(s, 'stingray').name };`);
  await page.waitForSelector('.screen.career-hub.on'); await both('steelhead-home');
  for (const t of ['Garage', 'Driver', 'Deals']) { await page.click(`.stabs button:has-text("${t}")`); await page.waitForTimeout(800); await both('steelhead-' + t.toLowerCase()); }
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: out + 'failed.png' }).catch(() => {}); }
writeFileSync(out + 'report.json', JSON.stringify({ ...report, errors, failed: [...new Set(failed)] }, null, 1)); console.log(JSON.stringify({ ...report, errors, failed: [...new Set(failed)] }, null, 1));
await browser.close();
