// Every career screen at 1280x720 and 1920x1080, fast: the career is moved through its rules in the page (no driving), each screen is shot and audited for text
// off the window, clipped or too small. For the real thing, with sessions, see qa-career-season.mjs.
//   node scripts/qa-lock.mjs -- node scripts/qa-career-screens.mjs [url=http://127.0.0.1:5180]
// Out: qa/career-screens/<name>-<width>.png, report.json; problems are printed.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), only = process.env.ONLY?.split(',');
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'career-screens'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.removeItem('ultrack.career.v1'); } } catch { /* none */ } });
const page = await ctx.newPage(), errors = [], report = {};
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const audit = () => page.evaluate(() => {
  const s = document.querySelector('.screen.on'); if (!s) return ['no screen'];
  const vw = innerWidth, vh = innerHeight, bad = new Set(), label = (e) => `${e.className?.baseVal ?? e.className} "${(e.textContent || '').trim().slice(0, 36)}"`;
  for (const e of s.querySelectorAll('*')) {
    if (e.offsetParent === null || e.closest('svg')) continue;
    const b = e.getBoundingClientRect(); if (!b.width || !b.height) continue;
    const text = e.children.length === 0 && e.textContent.trim();
    if (text) {
      const inScroll = e.closest('.lscroll, .cx-page.cx-scrolls'); const st = getComputedStyle(e);
      if (!inScroll && (b.right > vw + 1 || b.bottom > vh + 1 || b.left < -1 || b.top < -1)) bad.add('off window: ' + label(e));
      if (e.scrollWidth > e.clientWidth + 1 && st.overflow !== 'visible' && st.textOverflow === 'clip') bad.add('clipped: ' + label(e));
      if (parseFloat(st.fontSize) < 12) bad.add('small: ' + label(e));
      const box = e.closest('.cx-b, .cx-mode, .of-card'); if (box && !inScroll) { const r = box.getBoundingClientRect(); if (b.bottom > r.bottom + 1 || b.right > r.right + 1) bad.add('out of its block: ' + label(e)); }
    }
  }
  for (const e of s.querySelectorAll('.lscroll')) if (e.children.length && e.clientHeight < 24) bad.add('collapsed list: ' + label(e.parentElement));
  for (const e of s.querySelectorAll('.cx-acts')) if (e.scrollWidth > e.clientWidth + 1) bad.add('buttons overflow: ' + label(e));
  for (const e of s.querySelectorAll('.cx-foot > *, .cx-top > *')) { const b = e.getBoundingClientRect(); if (b.right > vw + 1) bad.add('bar overflows: ' + label(e)); }
  const stabs = s.querySelector('.stabs'); if (stabs && stabs.scrollWidth > stabs.clientWidth + 1) bad.add('tabs overflow');
  return [...bad].slice(0, 14);
});
async function shot(name) {
  if (only && !only.includes(name)) return;
  report[name] = {};
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(350);
    await page.screenshot({ path: join(out, `${name}-${w}.png`) });
    const bad = await audit(); report[name][w] = bad; if (bad.length) console.log(`${name} ${w}:`, bad.join(' | '));
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}
const run = (code, ...args) => page.evaluate(async ([c, a]) => { const C = await import('/src/game/career/career.js'), S = await import('/src/game/career/save.js'); const g = window.game; return new Function('C', 'S', 'g', 'a', c)(C, S, g, a); }, [code, args]);
const race = `const s = g.career, hero = s.contract.car; if (s.clock.phase === 'paddock') C.finishQuali(s, a[0]); const others = s.season.current.quali.grid.filter((k) => k !== hero); others.splice(a[1] - 1, 0, hero); const r = C.finishRace(s, { order: others, best: Object.fromEntries(others.map((k, i) => [k, 50 + i])), crashes: 0, spins: 0 }); S.saveCareer(s); return r;`;
const hub = (tab) => run(`g.show('careerHub', a[0]);`, tab);

try {
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.waitForSelector('.bento-tile[data-id=career]', { state: 'visible' });
  await page.click('.bento-tile[data-id=career]'); await page.waitForSelector('.screen.career-start.on');
  await shot('landing'); await page.click('.cs-act:has-text("New career")'); await page.waitForSelector('.cs-input');
  await shot('create');
  await page.fill('.cs-input', 'Quincy Valois'); await page.click('.cs-go'); await page.waitForSelector('text=Open Shootout'); await shot('shootout');
  await run(`const s = g.career; C.finishShootout(s, C.shootoutGrade(0).par * 1.02); S.saveCareer(s); g.show('careerStart');`); await page.waitForSelector('.of-card'); await shot('first-offers');
  await page.click('.of-card >> nth=1'); await page.waitForSelector('.screen.career-deal.on'); await shot('deal-open');
  await page.click('.cx-term >> nth=0 >> .seg button >> nth=3'); await page.click('.cx-term >> nth=1 >> .seg button >> nth=2'); await shot('deal-pushing');
  await page.click('button:has-text("Propose")'); await page.waitForTimeout(300); await shot('deal-countered');
  await page.click('button:has-text("Accept their counter")'); await page.waitForTimeout(300); await shot('deal-agreed');
  await page.click('.screen.on .cx-go'); await page.waitForSelector('.screen.career-hub.on'); await shot('home-pre');
  for (const t of ['calendar', 'events', 'inbox', 'deals', 'standings', 'garage', 'driver']) { await hub(t); await shot(t + '-pre'); }
  await hub('home'); await page.click('.screen.on .cx-go:has-text("Skip")'); await page.waitForTimeout(300); await shot('home-race');
  await run(`const s = g.career; C.finishQuali(s, 50); g.show('careerHub', 'home');`); await shot('home-grid');
  const r = await run(race, 50, 3); await run(`g.show('careerReport', a[0]);`, r); await shot('report');
  await hub('home'); await shot('home-open');
  await run(`const s = g.career; const o = s.sponsors.offers[0]; g.show('careerDeal', { id: o.id, home: 'careerHub' });`); await shot('deal-sponsor');
  await page.click('.screen.on .cx-go'); await page.waitForTimeout(300); await hub('deals'); await shot('deals-sponsor');
  await run(`const s = g.career; while (C.currentWeek(s).kind !== 'market') { if (C.currentWeek(s).kind === 'race') { ${race.replace('const s = g.career, hero', 'const hero').replace('return r;', '')} } else C.advanceWeek(s); } g.show('careerHub', 'home');`, 50, 2); await shot('home-market');
  await run(`const s = g.career; s.season.mid.push({ id: 'qa-w1', team: 'toro', seat: 'B', car: 'huracan', tier: 'maestro', status: 'junior', salary: 500, signing: 1000, seasons: 2, w1: true, interest: 0.4, why: 'Toro like what they see, and your numbers clear their bar. They would pay your release clause, and you join them next season.' }); s.clock.season = 2; g.show('careerHub', 'deals');`); await shot('deals-market');
  await run(`const s = g.career; s.clock.season = 1; s.contract.warning = { left: 2, met: 0 }; s.career.heat.LIN = 55; s.career.heat.MAD = 90; g.show('careerHub', 'home');`); await shot('home-warning');
  await hub('driver'); await shot('driver-rivals'); await hub('standings'); await shot('standings-mid'); await hub('calendar'); await shot('calendar-mid'); await hub('events'); await shot('events-mid'); await hub('inbox'); await shot('inbox-mid');
  await run(`const s = g.career; let n = 0; while (s.clock.phase !== 'review' && n++ < 40) { if (C.currentWeek(s).kind === 'race') { ${race.replace('const s = g.career, hero', 'const hero').replace('return r;', '')} } else C.advanceWeek(s); } g.show('careerStart');`, 50, 2); await page.waitForSelector('.cs-review'); await shot('review');
  await page.click('.cx-offer >> nth=0'); await page.waitForSelector('.screen.career-deal.on'); await shot('deal-review');
  await run(`g.career = null; g.show('careerStart');`); await page.waitForSelector('.cs-slot'); await shot('slots');
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: join(out, 'failed.png') }).catch(() => {}); }
report.errors = errors; writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(errors.length ? 'errors: ' + errors.join('\n') : 'no console errors');
await browser.close();
