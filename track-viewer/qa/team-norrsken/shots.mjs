// Norrsken QA shots at 1600x900: the logo card, the menu and garage with the Jesko and the CC850, a quick race with the AI driving the Jesko,
// a career race from a Rookie seat with Norrsken on the grid (hub, standings, the race and its report), and the hub from a Norrsken seat.
//   node scripts/qa-lock.mjs -- node qa/team-norrsken/shots.mjs [url=http://127.0.0.1:5180]
// Out: qa/team-norrsken/*.png, report.json
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), out = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.removeItem('ultrack.career.v1'); localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: 'marina', look: 'day', weather: 'dry', laps: 1 }, car: 'jesko' })); } } catch { /* none */ } });
// Vite's HMR socket stubbed: another session saving a file would otherwise reload the page mid-race
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [], report = {};
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: out + name + '.png' }); };
const run = (code, ...args) => page.evaluate(async ([c, a]) => { const C = await import('/src/game/career/career.js'), R = await import('/src/game/career/rules.js'), S = await import('/src/game/career/save.js'), SH = await import('/src/game/career-shell.js'), O = await import('/src/game/career/offers.js'); return new Function('C', 'R', 'S', 'SH', 'O', 'g', 'a', c)(C, R, S, SH, O, window.game, a); }, [code, args]);
const raceUp = () => page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig && !window.game.raceLoading.active, null, { timeout: 300000 });
try {
  // the logo card in the brand guide
  const g = await ctx.newPage(); await g.goto(base + '/team-brand-guide.html'); await g.waitForTimeout(1500);
  await (await g.$$('article')).at(-1).screenshot({ path: out + 'logos.png' }); await g.close();
  // the menu and the garage, the Jesko the player's car
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=race]', { state: 'visible' }); await page.waitForTimeout(4000); await shot('menu-jesko');
  await page.evaluate(() => window.game.show('garage')); await page.waitForTimeout(6000); await shot('garage-jesko');
  for (const [i, name] of [[1, 'specs'], [2, 'paint']]) { await page.click(`.ga-tabs button >> nth=${i}`); await page.waitForTimeout(1500); await shot('garage-jesko-' + name); }
  await page.click('.ga-tabs button >> nth=0'); await page.click('button.lrow.car[data-key=cc850]'); await page.waitForTimeout(6000); await shot('garage-cc850');
  await page.click('button.lrow.car[data-key=jesko]'); await page.waitForTimeout(1500);
  // a quick race: the Jesko and one car from each of the seven teams nearest Norrsken's place
  await page.evaluate(() => window.game.show('menu')); await page.waitForTimeout(800); await page.click('.bento-tile[data-id=race]');
  await page.waitForSelector('.panel.setup button.cta', { state: 'visible' }); await page.click('.panel.setup button.cta'); await raceUp();
  await page.evaluate(() => window.game.session.field.setPlayer(false)); await page.waitForTimeout(28000); await shot('race-jesko');
  report.quickRace = await page.evaluate(() => { const F = window.game.field; return { cars: F.cars.map((c) => c.key), hero: F.hero.key, kmh: Math.round(F.hero.speed * 3.6), pos: window.game.session.heroPos }; });
  await page.waitForTimeout(12000); await shot('race-jesko-2');
  report.quickRace.kmhLater = await page.evaluate(() => Math.round(window.game.field.hero.speed * 3.6));
  await page.evaluate(() => { window.game.endSession(); window.game.show('menu'); });
  // a career race from Mojave's B seat, qualified on pole: Norrsken on the grid
  report.career = await run(`
    const s = C.newCareer({ name: 'Quincy Valois', seed: 5150, now: '2026-11-07T00:00:00Z' }), sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    C.acceptOffer(s, s.pending.offers.find((o) => o.team === 'mojave').id, SH.available()); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s);
    g.career = s; S.saveCareer(s, 0); g.show('careerHub', 'home'); return { round: C.currentRound(s).name, exp: s.season.current.expPos };`);
  await page.waitForSelector('.screen.career-hub.on'); await shot('career-home');
  for (const t of ['Standings', 'Calendar']) { await page.click(`.stabs button:has-text("${t}")`); await page.waitForTimeout(400); await shot('career-' + t.toLowerCase()); }
  await page.click('.stabs button:has-text("Home")');
  report.career.grid = await run(`C.finishQuali(g.career, 1); S.saveCareer(g.career, 0); g.show('careerHub', 'home'); return g.career.season.current.quali.grid;`); await shot('career-home-grid');
  await page.click('.screen.on .cx-go:has-text("Start the race")'); await raceUp();
  await page.evaluate(() => window.game.session.field.setPlayer(false)); await page.waitForTimeout(30000); await shot('career-race');
  report.career.race = await page.evaluate(() => ({ cars: window.game.field.cars.map((c) => c.key), grid: window.game.field.gridOrder, laps: window.game.session.laps }));
  await page.waitForFunction(() => window.game.screenName === 'careerReport', null, { timeout: 600000, polling: 1000 }); await shot('career-report');
  report.career.result = await run(`const r = g.career.season.results.at(-1); return { finish: r.finish, entries: r.entries.length, top: r.entries.slice(0, 8).map((e) => e.key) };`);
  await page.click('.screen.on .cx-go'); await page.waitForSelector('.screen.career-hub.on'); await page.click('.stabs button:has-text("Standings")'); await page.waitForTimeout(400); await shot('career-standings-after');
  // the hub from Norrsken's B seat
  report.norrsken = await run(`
    const s = C.newCareer({ name: 'Quincy Valois', seed: 5151, now: '2026-11-07T00:00:00Z' }), sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    const o = O.offer(s, 'norrsken', 'B', { salary: 800, signing: 1000, seasons: 2, interest: 0.5, why: 'QA', tag: '-qa' }); s.pending.offers.push(o); C.acceptOffer(s, o.id, SH.available());
    g.career = s; S.saveCareer(s, 0); g.show('careerHub', 'home'); return { car: s.contract.car, exp: s.season.current.expPos, mate: C.driverAt(s, 'jesko').name };`);
  await page.waitForSelector('.screen.career-hub.on'); await shot('norrsken-home');
  for (const t of ['Garage', 'Driver']) { await page.click(`.stabs button:has-text("${t}")`); await page.waitForTimeout(800); await shot('norrsken-' + t.toLowerCase()); }
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: out + 'failed.png' }).catch(() => {}); }
writeFileSync(out + 'report.json', JSON.stringify({ ...report, errors }, null, 1)); console.log(JSON.stringify({ ...report, errors }, null, 1));
await browser.close();
