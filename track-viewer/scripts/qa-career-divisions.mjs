// The two series' screens (docs/10x/divisions-spec.md 12) at 1600x900 and 390x844, moved through the career's rules in the page (no driving): a season-1 Challenger
// save, an Elite save, and a season from before the split that a migration finishes in the old format. Each shot is audited for a horizontal scroll at phone width,
// text off the window, and an old field size ("of 16", "/ 16") in a season of two series.
//   node scripts/qa-lock.mjs -- node scripts/qa-career-divisions.mjs [url=http://127.0.0.1:5180] [out=qa/divisions-ui]
// Out: <out>/<name>-<width>.png, report.json; problems are printed.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), [base = 'http://127.0.0.1:5180', dir = join(here, '..', 'qa', 'divisions-ui')] = process.argv.slice(2), only = process.env.ONLY?.split(',');
const out = resolve(dir); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.removeItem('ultrack.career.v1'); } } catch { /* none */ } });
const page = await ctx.newPage(), errors = [], report = {};
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const audit = (divided) => page.evaluate((divided) => {
  const s = document.querySelector('.screen.on'); if (!s) return ['no screen'];
  const vw = innerWidth, bad = new Set(), label = (e) => `${e.className?.baseVal ?? e.className} "${(e.textContent || '').trim().slice(0, 40)}"`;
  if (document.documentElement.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) bad.add('the page scrolls sideways');
  for (const e of s.querySelectorAll('*')) {
    if (e.offsetParent === null || e.closest('svg, .stabs, .cx-strip')) continue;   // the tab row and the week strip scroll on their own
    const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue;
    if (e.children.length === 0 && e.textContent.trim() && !e.closest('.lscroll') && (b.right > vw + 1 || b.left < -1)) bad.add('off window: ' + label(e));
    if (e.matches('.cx-page, .cx-b, .cx-bh') && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden') bad.add('wider than its box: ' + label(e));
    if (e.children.length === 0 && !e.closest('.cx-mail') && e.textContent.trim().length > 2 && getComputedStyle(e).textOverflow === 'ellipsis' && e.clientWidth < 0.6 * e.scrollWidth) bad.add(`cut to ${Math.round((100 * e.clientWidth) / e.scrollWidth)} %: ${label(e)}`);   // a name shown in a letter or two
  }
  // a Career Level gate ("Level 8 of 16") is no field size; "/ 8" is wrong only as the Teams' count
  const old = [...s.innerText.matchAll(/.{0,24}((?<!Level \d+ )\bof 16\b|\/ 16\b|\b16 (drivers|cars)|of 12\b|TEAMS'\s+P\d\s*\/ 8\b|[Cc]hampionship).{0,24}/gi)].map((m) => m[0].replace(/\s+/g, ' '));
  if (divided) for (const x of old) bad.add('old copy: ' + x);
  return [...bad].slice(0, 14);
}, divided);
async function shot(name, divided = true) {
  if (only && !only.includes(name)) return;
  report[name] = {};
  for (const [w, h] of [[1600, 900], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h }); await page.evaluate(() => { const p = document.querySelector('.screen.on .cx-page'); if (p) p.scrollTop = 0; }); await page.waitForTimeout(400);   // a page reused by the next screen keeps its scroll
    await page.screenshot({ path: join(out, `${name}-${w}.png`) });
    const bad = await audit(divided); report[name][w] = bad; if (bad.length) console.log(`${name} ${w}:`, bad.join(' | '));
    for (let k = 2; w < 600 && k <= 5; k++) {   // a phone page scrolls: the rest of it, a screen at a time
      const more = await page.evaluate(() => { const p = document.querySelector('.screen.on .cx-page'); if (!p || p.scrollTop + p.clientHeight >= p.scrollHeight - 4) return false; p.scrollTop += p.clientHeight - 60; return true; });
      if (!more) break; await page.waitForTimeout(150); await page.screenshot({ path: join(out, `${name}-${w}-${k}.png`) });
    }
  }
  await page.setViewportSize({ width: 1600, height: 900 });
}
// the rules in the page: C (career.js), R (rules.js), S (save.js), g (the game). H: play(s, place, lap) runs a round from wherever it stands; a lap of 999 misses an Elite cut
const H = `const hero = (s) => s.contract.car;
  function play(s, place = 4, lap = 50) {
    if (s.clock.phase === 'paddock' && C.currentWeek(s).kind !== 'race') { while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); }
    const cur = s.season.current, o = cur.open, me = hero(s);
    if (s.clock.phase === 'paddock' && (o ? o.stage === 'quali' : !cur.quali)) C.finishQuali(s, lap);   // an Open's Final and the Masters have their grid already
    if (o?.stage === 'lcq') { const q = cur.quali; if (q.grid.includes(me)) return C.finishLcq(s, { order: [me, ...q.grid.filter((k) => k !== me)], best: {} }) && play(s, place, lap); }
    const q = s.season.current.quali; if (!q.grid.includes(me)) return o ? C.finishRace(s, { order: [...q.grid], best: {} }) : C.finishDnq(s);
    const others = q.grid.filter((k) => k !== me); others.splice(Math.min(place, others.length + 1) - 1, 0, me);
    return C.finishRace(s, { order: others, best: Object.fromEntries(others.map((k, i) => [k, 70 + i])), crashes: 0, spins: 0 });
  }
  function career(seed, team = 'mojave', at = null) {
    const s = C.newCareer({ seed, name: 'Quincy Valois', now: 'x' }), W = s.world.teams; C.finishShootout(s, C.shootoutGrade(0).par * 1.02);
    if (at === 'legacy') for (const t of R.TEAM_IDS) W[t].div = 'all';
    if (at === 'elite') { W[team].div = 'elite'; W.sarab.div = 'challenger'; }
    C.acceptOffer(s, s.pending.offers.find((o) => o.team === team).id, a.avail);
    return s;
  }
  const use = (s) => { g.career = s; S.saveCareer(s); return s; };`;
const run = (code, arg = {}) => page.evaluate(async ([c, a]) => { const C = await import('/src/game/career/career.js'), R = await import('/src/game/career/rules.js'), S = await import('/src/game/career/save.js'), g = window.game;
  a.avail = Object.fromEntries(Object.values((await import('/src/tracks.js')).TRACKS).map((t) => [t.id, t.times ?? null]));
  return new Function('C', 'R', 'S', 'g', 'a', c)(C, R, S, g, a); }, [H + code, arg]);
const hub = (tab) => run(`g.show('careerHub', a.tab);`, { tab });

try {
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' });
  await page.click('.bento-tile[data-id=career]'); await page.waitForSelector('.screen.career-start.on');

  // ---- a season-1 Challenger save
  await run(`window.__s = use(career(101)); g.show('careerHub', 'home');`); await shot('home-challenger');
  await run(`const s = window.__s; while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); use(s); g.show('careerHub', 'home');`); await shot('week-challenger');
  await run(`const s = window.__s; window.__r = []; while (C.currentRound(s).kind === 'tour') window.__r.push(play(s, 3)); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); use(s); g.show('careerHub', 'home');`); await shot('home-open-unseeded');
  await run(`g.show('careerReport', window.__r.at(-1));`); await shot('report-challenger');
  for (const t of ['standings', 'calendar']) { await hub(t); await shot(`${t}-challenger`); }
  await hub('standings'); await page.click('.screen.on .cx-switch .seg button >> nth=1'); await page.waitForTimeout(200); await shot('standings-elite-view');
  await run(`const s = window.__s; return g.show('careerReport', play(s, 1));`); await shot('report-open');
  await run(`const s = window.__s; while (C.currentRound(s).kind !== 'masters' && s.clock.round < s.season.calendar.length - 1) { if (s.season.calendar[s.clock.round + 1]?.kind === 'masters') s.ranking.days.push({ YOU: 900 }); play(s, 1); }
    while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); use(s); g.show('careerHub', 'home');`); await shot('home-masters-seeded');
  await run(`g.show('careerReport', play(window.__s, 2));`); await shot('report-masters');
  await run(`use(window.__s); g.show('careerStart');`); await page.waitForSelector('.cs-review'); await shot('review-challenger');

  // ---- promoted, and a neutral year with a step-up offer in sight: seeds tried until each happens
  const promoted = await run(`for (let seed = 300; seed < 330; seed++) { const s = career(seed); while (s.clock.phase !== 'review') play(s, 1); if (s.pending.review.yourTeam === 'up') { use(s); g.show('careerStart'); return seed; } } return null;`);
  if (promoted !== null) { await page.waitForSelector('.cs-review'); await shot('review-promoted'); } else errors.push('qa: no promoted season found');
  const neutral = await run(`for (let seed = 340; seed < 360; seed++) { const s = career(seed, 'liberty'); while (s.clock.phase !== 'review') play(s, 4); if (!s.pending.review.yourTeam) { use(s); g.show('careerStart'); return { seed, up: s.pending.review.swap.up }; } } return null;`);
  if (neutral) {
    report.neutral = neutral; await page.waitForSelector('.cs-review'); await shot('review-neutral');
    await run(`const s = window.game.career; g.show('careerDeal', { id: s.pending.offers[0].id, home: 'careerStart' });`); await shot('deal-review');
    // the step-up label needs a Rookie team going up while the player's stays: forced here for the picture when the season did not do it
    await run(`const s = window.game.career, W = s.world.teams; if (R.TIERS.teams[s.pending.review.swap.up].tier !== 'rookie') { W[s.pending.review.swap.up].div = 'challenger'; W.hayate.div = 'elite'; } use(s); g.show('careerStart');`); await page.waitForSelector('.cs-review'); await shot('review-stepup');
  } else errors.push('qa: no neutral season found');

  // ---- an Elite save: the race week, a missed cut, relegation
  await run(`window.__e = use(career(202, 'mojave', 'elite')); const s = window.__e; while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); use(s); g.show('careerHub', 'home');`); await shot('week-elite');
  await run(`g.show('careerReport', play(window.__e, 8, 999));`); await shot('report-elite-dnq');
  await run(`const s = window.__e; while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); use(s); g.show('careerHub', 'home');`); await shot('home-elite');
  await hub('deals'); await shot('deals-elite');
  const relegated = await run(`for (let seed = 202; seed < 240; seed++) { const s = seed === 202 ? window.__e : career(seed, 'mojave', 'elite'); while (s.clock.phase !== 'review') play(s, 8); if (s.pending.review.yourTeam === 'down') { use(s); g.show('careerStart'); return seed; } } return null;`);
  if (relegated !== null) { await page.waitForSelector('.cs-review'); await shot('review-relegated'); } else errors.push('qa: no relegated season found');
  // relegated and let go in the same review: the banner must not say the contract stands
  if (relegated !== null) { report.relegatedDropped = await run(`const s = career(a.seed, 'mojave', 'elite'); while (s.clock.phase !== 'review') { if (s.clock.round === s.season.calendar.length - 1) s.contract.trust = 5; play(s, 8); } use(s); g.show('careerStart'); return { team: s.pending.review.yourTeam, dropped: s.pending.review.dropped };`, { seed: relegated });
    await page.waitForSelector('.cs-review'); await shot('review-relegated-dropped'); }

  // ---- a season from before the split, migrated mid-season: it finishes as one field
  await run(`const s = career(500, 'hayate', 'legacy'); for (let i = 0; i < 3; i++) play(s, 4); const split = { aurum: 'elite', saetta: 'elite', norrsken: 'elite', toro: 'elite', sarab: 'elite', corvid: 'challenger', hayate: 'challenger', mojave: 'challenger', liberty: 'challenger' };
    for (const t of R.TEAM_IDS) s.world.teams[t].div = split[t]; window.__l = use(s); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); g.show('careerHub', 'home');`); await shot('home-legacy', false);
  await hub('standings'); await shot('standings-legacy', false);
  await run(`const s = window.__l; while (s.clock.phase !== 'review') play(s, 4); use(s); g.show('careerStart');`); await page.waitForSelector('.cs-review'); await shot('review-legacy', false);
  await run(`const s = window.__l; C.acceptOffer(s, (s.pending.offers.find((o) => o.keep) ?? s.pending.offers[0]).id, a.avail); use(s); g.show('careerHub', 'home'); return s.season.div;`).then((d) => { report.afterLegacy = d; });
  await shot('home-after-legacy');
  await hub('deals'); await shot('deals-after-legacy');
  await hub('driver'); await shot('driver-after-legacy');
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: join(out, 'failed.png') }).catch(() => {}); }
report.errors = errors; writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(errors.length ? 'errors: ' + errors.join('\n') : 'no console errors');
await browser.close();
