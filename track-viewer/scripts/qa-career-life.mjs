// Happiness, fan support and the Shop in the real game (Part 3): the Life tab at 1280x720 and 1600x900, the tab bar's fit, keyboard play (Q/E, arrows, Enter twice to buy), images that hide
// when missing and cards that look finished either way (a stand-in picture is routed in for the second set of shots only), a holiday that skips the week's event, a party, an ad deal,
// the unhappy driver's transfer demand, and the mood on the race report.
//   node scripts/qa-lock.mjs -- node scripts/qa-career-life.mjs [url=http://127.0.0.1:5180]
// Out: qa/career-life/*.png, report.json
import { chromium } from 'playwright-core';
import { mkdirSync, utimesSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'qa', 'career-life'); mkdirSync(out, { recursive: true });
setInterval(() => { try { const now = new Date(); utimesSync(join(here, '..', 'qa', '.browser-lock'), now, now); } catch { /* not under the lock */ } }, 60000).unref();
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.removeItem('ultrack.career.v1'); } } catch { /* none */ } });
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [], report = { steps: [] };
page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const log = (...a) => { console.log(...a); report.steps.push(a.join(' ')); writeFileSync(join(out, 'report.json'), JSON.stringify({ ...report, errors }, null, 1)); };
const shot = async (name, sizes = [[1280, 720], [1600, 900]]) => { for (const [w, h] of sizes) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(400); await page.screenshot({ path: join(out, `${name}-${w}.png`) }); } };
const run = (code) => page.evaluate(async (c) => { const C = await import('/src/game/career/career.js'), R = await import('/src/game/career/rules.js'), S = await import('/src/game/career/save.js'), SH = await import('/src/game/career-shell.js'), g = window.game; return await (new Function('C', 'R', 'S', 'SH', 'g', `return (async () => { ${c} })()`))(C, R, S, SH, g); }, code);
const mood = () => page.evaluate(() => ({ happy: window.game.career.life.happy, fans: window.game.career.life.fans, coins: window.game.career.wallet.coins, owned: window.game.career.life.owned, act: window.game.career.season.weeks[window.game.career.clock.week].activity ?? null }));
const tabFit = () => page.evaluate(() => { const bar = document.querySelector('.screen.on .stabs'), r = bar.getBoundingClientRect(), bs = [...bar.querySelectorAll('button')].map((b) => b.getBoundingClientRect()); return { bar: [Math.round(r.left), Math.round(r.right)], scroll: [bar.scrollWidth, bar.clientWidth], buttons: bs.length, outside: bs.filter((b) => b.right > r.right + 1 || b.left < r.left - 1).length, labelsClipped: [...bar.querySelectorAll('button')].filter((b) => b.scrollWidth > b.clientWidth + 1).length }; });

try {
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' });
  log('setup', JSON.stringify(await run(`
    const s = C.newCareer({ name: 'Quincy Valois', nation: 'IND', seed: 6161, now: '2026-11-04T00:00:00Z' }); const sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    C.acceptOffer(s, s.pending.offers.find((o) => o.team === 'mojave').id, SH.available()); s.wallet.coins = 30000; s.career.cl = 8; s.career.xp = R.xpForLevel(8); s.career.rep = 500;
    g.career = s; S.saveCareer(s, 0); g.show('careerHub', 'home'); return { week: C.currentWeek(s).kind, event: C.currentWeek(s).event.kind };`)));
  await page.waitForSelector('.screen.career-hub.on');
  // Q/E cycle: Garage -> Life with E
  await page.click('.stabs button:has-text("Garage")'); await page.waitForTimeout(300); await page.keyboard.press('e'); await page.waitForTimeout(500);
  report.tabAfterE = await page.evaluate(() => document.querySelector('.screen.on .stabs button.on')?.innerText.trim()); log('E from Garage lands on', report.tabAfterE);
  await page.keyboard.press('e'); await page.waitForTimeout(300); await page.keyboard.press('q'); await page.waitForTimeout(300); log('E then Q is back on', await page.evaluate(() => document.querySelector('.screen.on .stabs button.on')?.innerText.trim()));
  report.fit1280 = await tabFit(); log('tab bar at 1280', JSON.stringify(report.fit1280));
  report.cards = await page.$$eval('.screen.on .cx-shop', (l) => l.map((c) => c.dataset.shop)); log('cards', report.cards.length, report.cards.join(','));
  report.imgsLeft = await page.evaluate(() => new Promise((r) => setTimeout(() => r(document.querySelectorAll('.screen.on .cs-pic img').length), 1500))); log('pictures still in the DOM with no files on disk (must be 0):', report.imgsLeft);
  await shot('life-no-images');
  report.fit1600 = await tabFit(); log('tab bar at 1600', JSON.stringify(report.fit1600));
  // keyboard: arrows to the Night out card, Enter asks, Enter buys
  await page.setViewportSize({ width: 1280, height: 720 });
  const before = await mood(); await page.locator('.screen.on .cx-shop[data-shop=night-out]').focus();
  await page.evaluate(() => document.querySelector('.screen.on .cx-shop[data-shop=night-out]').click()); await page.waitForTimeout(300);
  report.asked = await page.locator('.screen.on .cx-shop[data-shop=night-out] .cs-act').innerText(); log('after one press', report.asked);
  await page.evaluate(() => document.querySelector('.screen.on .cx-shop[data-shop=night-out]').click()); await page.waitForTimeout(400);
  report.afterParty = await mood(); log('night out', JSON.stringify(before), '->', JSON.stringify(report.afterParty));
  // the keyboard itself: arrows move over the cards, Enter presses
  const nav = []; for (let i = 0; i < 6; i++) { await page.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowDown'); await page.waitForTimeout(120); nav.push(await page.evaluate(() => { const a = document.activeElement, s = document.querySelector('.screen.career-hub.on .sel'); return (s ?? a)?.dataset?.shop ?? (s ?? a)?.className?.toString().slice(0, 30); })); }
  log('arrows visit', nav.join(' > ')); report.nav = nav;
  await shot('life-after-party');
  // a second activity in the same week is refused
  await page.evaluate(() => document.querySelector('.screen.on .cx-shop[data-shop=fan-day]').click()); await page.waitForTimeout(300);
  report.taken = await page.evaluate(() => document.querySelector('.cx-shop[data-shop=fan-day] .cs-act')?.innerText); log('fan day after a party the same week:', report.taken);
  // a luxury is fine any time: buy the apartment (asks, then buys)
  await page.evaluate(() => { const c = document.querySelector('.screen.on .cx-shop[data-shop=apartment]'); c.click(); }); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('.screen.on .cx-shop[data-shop=apartment]').click()); await page.waitForTimeout(400);
  report.afterApartment = await mood(); log('apartment', JSON.stringify(report.afterApartment));
  // advance to the next open week and take a holiday: the optional event is skipped
  report.round1 = await run(`const q = (C.finishQuali(g.career, 60), g.career.season.current.quali); const rep = C.finishRace(g.career, { order: q.grid, best: {}, hits: [90] }); S.saveCareer(g.career); g.show('careerHub', 'life'); return { life: rep.life, finish: rep.finish, week: g.career.clock.week };`); log('round 1 played: mood after', JSON.stringify(report.round1)); await page.waitForTimeout(600);
  report.week2 = await run(`const w = C.currentWeek(g.career); return { kind: w.kind, event: w.event?.kind, skipped: !!w.event?.skipped };`); log('week 2', JSON.stringify(report.week2));
  await page.evaluate(() => document.querySelector('.screen.on .cx-shop[data-shop=holiday]').click()); await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('.screen.on .cx-shop[data-shop=holiday]').click()); await page.waitForTimeout(400);
  report.holiday = await run(`const w = C.currentWeek(g.career); return { skipped: !!w.event?.skipped, sideSpec: C.sideSpec(g.career), activity: w.activity, sinceOff: g.career.life.sinceOff };`); log('after a holiday', JSON.stringify(report.holiday));
  await page.click('.stabs button:has-text("Home")'); await page.waitForTimeout(500); report.homeHero = await page.evaluate(() => document.querySelector('.screen.on .cx-week')?.innerText.replace(/\n+/g, ' | ')); log('Home this week:', report.homeHero); await shot('home-holiday', [[1280, 720]]);
  await page.click('.stabs button:has-text("Calendar")'); await page.waitForTimeout(500); await shot('calendar-holiday', [[1280, 720]]);
  // an ad deal in the next open week
  report.round2 = await run(`C.advanceWeek(g.career); const q = (C.finishQuali(g.career, 60), g.career.season.current.quali); const rep = C.finishRace(g.career, { order: q.grid, best: {}, hits: [90] }); S.saveCareer(g.career); g.show('careerHub', 'life'); return { life: rep.life, finish: rep.finish, week: g.career.clock.week };`); log('round 2 played', JSON.stringify(report.round2)); await page.waitForTimeout(600);
  report.adCards = await page.$$eval('.screen.on .cx-shop', (l) => l.filter((c) => /ad-shoot|billboard|tv-/.test(c.dataset.shop)).map((c) => c.innerText.replace(/\n+/g, ' | ')));
  await page.evaluate(() => document.querySelector('.screen.on .cx-shop[data-shop=billboard-deal]').click()); await page.waitForTimeout(250);
  const w0 = (await mood()).coins; await page.evaluate(() => document.querySelector('.screen.on .cx-shop[data-shop=billboard-deal]').click()); await page.waitForTimeout(400);
  report.ad = { before: w0, after: (await mood()).coins, week: await run(`const w = C.currentWeek(g.career); return { skipped: !!w.event?.skipped, brand: w.activity?.brand };`) }; log('billboard deal', JSON.stringify(report.ad));
  await shot('life-ad', [[1280, 720]]);
  // stand-in pictures routed in for this run only (no files are written): the cards with pictures
  const png = readdirSync(join(here, '..', 'public', 'assets', 'ui', 'stills', 'cars')).find((f) => /\.(webp|jpg|png)$/.test(f));
  await page.route('**/assets/ui/shop/*.webp', (r) => r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(join(here, '..', 'public', 'assets', 'ui', 'stills', 'cars', png)) }));
  await run(`g.show('careerHub', 'life');`); await page.waitForTimeout(1200); report.imgsWith = await page.evaluate(() => document.querySelectorAll('.screen.on .cs-pic img').length); log('pictures drawn with a stand-in routed:', report.imgsWith); await shot('life-with-images');
  await page.unroute('**/assets/ui/shop/*.webp');
  // the unhappy driver: the band, the demand button, the transfer through the market
  await run(`g.career.life.happy = 12; S.saveCareer(g.career); g.show('careerHub', 'life');`); await page.waitForTimeout(700); await shot('life-unhappy', [[1280, 720]]);
  report.demandBtn = await page.$$eval('.screen.on .cl-demand', (l) => l.length); log('demand button shown:', report.demandBtn);
  await page.click('.screen.on .cl-demand'); await page.waitForTimeout(250); log('first press:', await page.locator('.screen.on .cl-demand').innerText());
  await page.click('.screen.on .cl-demand'); await page.waitForTimeout(700);
  report.afterDemand = await run(`return { tab: document.querySelector('.screen.on .stabs button.on')?.innerText.trim(), mid: g.career.season.mid.map((o) => o.id + ' ' + o.team + ' ' + o.seat), asked: g.career.life.demanded };`); log('after demanding', JSON.stringify(report.afterDemand)); await shot('deals-after-demand', [[1280, 720]]);
  report.signed = await run(`const o = g.career.season.mid[0]; const r = C.signMid(g.career, o.id); return { next: g.career.contract.next?.team, r };`); log('signing the first offer starts next season:', JSON.stringify(report.signed));
  // ---- a real race with the AI driving the player's car: the report carries the mood, the Life tab says why
  await run(`const s = C.newCareer({ name: 'Quincy Valois', nation: 'IND', seed: 6262, now: '2026-11-04T00:00:00Z' }); const sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    C.acceptOffer(s, s.pending.offers.find((o) => o.team === 'mojave').id, SH.available()); s.wallet.coins = 5000; g.career = s; C.finishQuali(s, 1); S.saveCareer(s, 1); g.show('careerHub', 'home');`);
  await page.waitForSelector('.screen.career-hub.on'); await page.waitForTimeout(500); await page.click('.stabs button:has-text("Home")');
  await page.click('.screen.on .cx-go:has-text("Start the race")');
  await page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig && !window.game.raceLoading.active, null, { timeout: 300000 });
  await page.evaluate(() => window.game.session.field.setPlayer(false));
  await page.waitForFunction(() => window.game.screenName === 'careerReport', null, { timeout: 900000, polling: 1000 });
  await page.waitForTimeout(600); await shot('report-mood', [[1280, 720]]);
  report.moodOnReport = await page.evaluate(() => ({ deltas: document.querySelector('.cr-deltas')?.innerText.split('\n').join(' | '), life: window.game.career.season.results.at(-1).life })); log('report mood', JSON.stringify(report.moodOnReport));
  await page.click('.screen.on .cx-go'); await page.waitForTimeout(900); await page.click('.screen.on .stabs button:has-text("Life")'); await page.waitForTimeout(500); await shot('life-after-race', [[1280, 720]]);
  report.whyLines = await page.$$eval('.screen.on .cl-why .cr-lines span', (l) => l.map((x) => x.innerText.split('\n').join(' '))); log('why it moved', JSON.stringify(report.whyLines));
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: join(out, 'failed.png') }).catch(() => {}); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ ...report, errors }, null, 1)); console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
