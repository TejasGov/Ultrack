// Car running costs in the real game: the Garage tab (five upgrades, the Staff block, hiring through the buttons), then a Tour race with the AI driving the player's car, logging every
// `crash` and `impact` the session emits (kerbs and ordinary racing contact must bill nothing), a rub along the barrier (must stay free) and a head-on hit (billed), then the report.
//   node scripts/qa-lock.mjs -- node scripts/qa-career-costs.mjs [url=http://127.0.0.1:5180]
// Out: qa/career-costs/*.png, report.json
import { chromium } from 'playwright-core';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'qa', 'career-costs'); mkdirSync(out, { recursive: true });
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
const run = (code, ...args) => page.evaluate(async ([c, a]) => { const C = await import('/src/game/career/career.js'), R = await import('/src/game/career/rules.js'), S = await import('/src/game/career/save.js'), SH = await import('/src/game/career-shell.js'); return new Function('C', 'R', 'S', 'SH', 'g', 'a', c)(C, R, S, SH, window.game, a); }, [code, args]);

try {
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' });
  log('setup', JSON.stringify(await run(`
    const s = C.newCareer({ name: 'Quincy Valois', seed: 5151, now: '2026-11-04T00:00:00Z' }); const sh = C.shootout(); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    C.acceptOffer(s, s.pending.offers.find((o) => o.team === 'mojave').id, SH.available()); s.wallet.coins = 20000; s.career.cl = 8; s.career.xp = R.xpForLevel(8);
    g.career = s; S.saveCareer(s, 0); g.show('careerHub', 'home'); return { car: s.contract.car, round: C.currentRound(s).name, track: C.currentRound(s).track };`)));
  await page.waitForSelector('.screen.career-hub.on'); await page.click('.stabs button:has-text("Garage")'); await page.waitForTimeout(500); await shot('garage-start');
  const rows = await page.$$eval('.screen.on .cx-up', (l) => l.map((r) => r.innerText.replace(/\n+/g, ' | '))); log('upgrade rows', JSON.stringify(rows)); report.upgradeRows = rows;
  // hire the Elite engineer and the Pro crew through the buttons: the first press asks, the second pays
  const chip = (label) => page.locator('.screen.on .cx-staff', { hasText: label }).locator('.cx-chip', { hasText: label === 'Crew' ? 'Pro' : 'Elite' });
  await chip('Engineer').click(); await page.waitForTimeout(300); report.asked = await chip('Engineer').innerText(); log('after the first press', report.asked.replace(/\n+/g, ' | '));
  report.walletAsked = await page.evaluate(() => window.game.career.wallet.coins); await shot('garage-hire-asked', [[1280, 720]]);
  await chip('Engineer').click(); await page.waitForTimeout(300); await chip('Crew').click(); await page.waitForTimeout(200); await chip('Crew').click(); await page.waitForTimeout(400);
  report.walletHired = await page.evaluate(() => window.game.career.wallet.coins); log('wallet', report.walletAsked, '->', report.walletHired, '(Elite engineer 4000 + Pro crew 1500 expected)');
  await page.locator('.screen.on .cx-up', { hasText: 'Aero' }).click(); await page.waitForTimeout(400);
  report.afterAero = await page.evaluate(() => ({ wallet: window.game.career.wallet.coins, paid: window.game.career.garage.paid, up: window.game.career.garage.upgrades, staff: window.game.career.staff })); log('after buying Aero', JSON.stringify(report.afterAero));
  await shot('garage-hired');
  // ---- the race, the AI driving the player's car
  await run(`C.finishQuali(g.career, 1); S.saveCareer(g.career); g.show('careerHub', 'home');`); await page.waitForTimeout(500); await page.click('.stabs button:has-text("Home")');
  await page.click('.screen.on .cx-go:has-text("Start the race")');
  await page.waitForFunction(() => window.game?.session?.mode === 'race' && window.game.session.field.rig && !window.game.raceLoading.active, null, { timeout: 300000 });
  await page.evaluate(() => { const g = window.game; g.session.field.setPlayer(false); window.__ev = []; const o = g.onEvent.bind(g); g.onEvent = (e) => { if (e.type === 'crash' || e.type === 'impact' || e.type === 'spin' || e.type === 'offTrack') window.__ev.push([e.type, e.kmh ?? null, +g.session.t.toFixed(1)]); return o(e); }; });
  await page.waitForFunction(() => window.game.session.state === 'running' && window.game.session.t > 6, null, { timeout: 120000 });
  await page.waitForTimeout(25000); report.aiEvents = await page.evaluate(() => ({ events: window.__ev, hits: window.game.careerRun.hits.slice(), crashes: window.game.careerRun.crashes })); log('25 s of AI racing: events', JSON.stringify(report.aiEvents));
  // a rub along the barrier and a head-on hit, with the player's wheel (no AI) and no pedals; `fire` teleports the hero to a wall
  const fire = (deg, kmh) => page.evaluate(async ({ deg, kmh }) => {
    const g = window.game, f = g.field, v = f.hero.vehicle, { initPhysics } = await import('/src/physics/world.js'), RAPIER = await initPhysics(), world = f.pw.world, N = f.N;
    const isWall = (c) => f.pw.surfaceOf.get(c.handle)?.name === 'wall';
    f.setPlayer(true);
    for (let i = 40; i < N; i += 17) for (const sd of [1, -1]) {
      const a = f.linePts[(i + N - 1) % N], b = f.linePts[(i + 1) % N], p = f.linePts[i], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, ux = (b.x - a.x) / l, uz = (b.z - a.z) / l, lx = uz * sd, lz = -ux * sd;
      const w = world.castRay(new RAPIER.Ray({ x: p.x, y: p.y + 0.5, z: p.z }, { x: lx, y: 0, z: lz }), 70, true, undefined, undefined, undefined, undefined, isWall);
      if (!w || w.timeOfImpact < 8 || w.timeOfImpact > 40) continue;
      const r = deg * Math.PI / 180, dx = ux * Math.cos(r) + lx * Math.sin(r), dz = uz * Math.cos(r) + lz * Math.sin(r), lat = Math.max(0, w.timeOfImpact - 4.5);
      v.respawn({ x: p.x + lx * lat, y: p.y + 0.3, z: p.z + lz * lat }, Math.atan2(-dz, dx)); v.rb.setLinvel({ x: dx * kmh / 3.6, y: 0, z: dz * kmh / 3.6 }, true);
      return { station: i, side: sd };
    }
    return null;
  }, { deg, kmh });
  const before = (await page.evaluate(() => window.game.careerRun.hits.slice())).length;
  report.rub = await fire(8, 150); await page.waitForTimeout(3500); report.afterRub = await page.evaluate(() => ({ events: window.__ev.slice(-4), hits: window.game.careerRun.hits.slice() })); log('rub at 8 degrees, 150 km/h', JSON.stringify(report.rub), JSON.stringify(report.afterRub));
  await page.evaluate(() => window.game.session.field.setPlayer(false)); await page.waitForTimeout(6000);
  report.head = await fire(60, 130); await page.waitForTimeout(3500); report.afterHead = await page.evaluate(() => ({ events: window.__ev.slice(-4), hits: window.game.careerRun.hits.slice() })); log('hit at 60 degrees, 130 km/h', JSON.stringify(report.head), JSON.stringify(report.afterHead));
  await page.evaluate(() => window.game.session.field.setPlayer(false)); report.hitsBefore = before;
  await page.waitForFunction(() => window.game.screenName === 'careerReport', null, { timeout: 900000, polling: 1000 });
  await page.waitForTimeout(600); await shot('report');
  report.result = await page.evaluate(() => { const r = window.game.career.season.results.at(-1); return { finish: r.finish, coins: r.coins, coinLines: r.coinLines, repairs: r.repairs, wallet: window.game.career.wallet.coins }; }); log('report', JSON.stringify(report.result));
  report.money = await page.evaluate(() => document.querySelector('.cr-money')?.innerText.replace(/\n+/g, ' | ')); log('What it paid:', report.money);
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: join(out, 'failed.png') }).catch(() => {}); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ ...report, errors }, null, 1)); console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
