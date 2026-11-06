// The career's rival profiles (driver.js) in real races, headless: the same grid raced twice, without and with profiles, the player's car
// driven by the AI. The nemesis starts just ahead of the player and a rival just behind. Per AI car: the best clear-air lap (a lap with no
// car within 15 m ahead of it and the player never within 20 m, for 95 % of it: nothing to follow, and every hook asleep), respawns, seconds with all four wheels off the asphalt, contacts with the player, and the defends,
// mistakes and side-by-side lines. Then the checks of docs/10x/career-spec.md WP2.
//   node scripts/qa-lock.mjs -- node scripts/qa-rivalry-race.mjs [track=india] [laps=3] [url=http://127.0.0.1:5302]
//   NOISE=1 races the unprofiled grid a second time (the run-to-run noise of the lap times); QA_OUT=dir for the report and the still
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [track = 'india', laps = '3', base = 'http://127.0.0.1:5302'] = process.argv.slice(2), hero = 'nissan-z';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = join(process.env.QA_OUT ?? join(root, 'qa', 'rivalry-race'), track);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync), headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.addInitScript(([t, c, l]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ car: c, settings: { track: t, look: 'day', weather: 'dry', laps: l } })); } catch { /* none */ } }, [track, hero, +laps]);
// Vite's HMR socket stubbed: another session saving a file would otherwise reload the page mid-race
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.goto(base);
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');

async function race(profiled, shot) {
  await page.waitForFunction(() => !window.game.session && !window.game.starting, null, { timeout: 60000 });
  await page.evaluate(async ({ hero, profiled }) => {
    const g = window.game, { TUNING } = await import('/src/game/career/rules.js');
    const racers = g.racersFor(hero, true), ai = racers.filter((k) => k !== hero), [nem, riv] = [ai[ai.length - 2], ai[ai.length - 1]];
    const gridOrder = [...ai.filter((k) => k !== nem && k !== riv), nem, hero, riv];     // the nemesis just ahead of the player, a rival just behind
    const pace = Object.fromEntries(ai.map((k) => [k, 0.975])), prof = (role, i) => ({ role, composure: 0.35, seed: 1000 + i, k: structuredClone(TUNING.rivals.track) });
    const profiles = profiled ? Object.fromEntries(ai.map((k, i) => [k, prof(k === nem ? 'nemesis' : k === riv ? 'rival' : null, i)])) : null;
    window.__R = { nem, riv, ev: [], says: [], off: {}, resp: {}, laps: {}, done: null };
    g.startSession('race', { racers, gridOrder, pace, ai: profiles, nemesis: profiled ? { key: nem } : null, kind: 'race', home: 'menu', done: (d) => { window.__R.done = d; } });
  }, { hero, profiled });
  await page.waitForFunction(() => window.game.session && !window.game.raceLoading.active && window.game.session.field.rig, null, { timeout: 300000 });
  await page.evaluate(() => {
    const g = window.game, s = g.session, F = s.field, R = window.__R;
    F.setPlayer(false);
    const onEvent = g.onEvent.bind(g); g.onEvent = (e) => { if (['defend', 'mistake', 'sideBySide', 'contact', 'ordersDone'].includes(e.type)) R.ev.push({ type: e.type, key: e.key, kind: e.kind, t: +s.raceT.toFixed(1) }); return onEvent(e); };
    const say = g.say.bind(g); g.say = (cat, o) => { const ok = say(cat, o); if (ok && (cat === 'defending' || cat === 'side_by_side')) R.says.push(cat); return ok; };
    const respawn = F.respawn.bind(F); F.respawn = (c) => { if (s.state === 'running') R.resp[c.key] = (R.resp[c.key] ?? 0) + 1; return respawn(c); };
    const update = s.update.bind(s);
    s.update = (dt) => {
      const ev = update(dt);
      if (s.state === 'running') for (const c of F.cars) {
        if (c.hero) continue;
        const T = s.trk.get(c), L = (R.laps[c.key] ??= { n: 0, crowd: 0, tot: 0, laps: [] }), p = c.vehicle.cur.pos;
        if (T.offT > 0) R.off[c.key] = (R.off[c.key] ?? 0) + dt;
        const fwd = new p.constructor(1, 0, 0).applyQuaternion(c.vehicle.cur.quat);
        L.tot++; if (F.cars.some((o) => { if (o === c) return false; const d = o.vehicle.cur.pos.clone().sub(p), n = d.length(); return o.hero ? n < 20 : n < 15 && d.dot(fwd) > 0; })) L.crowd++;
        if (T.laps.length > L.n) { L.n = T.laps.length; L.laps.push({ t: T.laps.at(-1).t, clear: L.crowd / L.tot < 0.05 }); L.crowd = L.tot = 0; }
      }
      return ev;
    };
  });
  const t0 = Date.now(), maxMs = (+laps * 240 + 120) * 1000; let shotDone = !shot;
  while (Date.now() - t0 < maxMs) {
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => ({ done: !!window.__R.done, t: window.game.session?.raceT ?? 0, tile: document.querySelector('.hud')?.classList.contains('duel') }));
    if (!shotDone && st.t > 40) { await page.screenshot({ path: join(out, 'profiled-race.png') }); shotDone = true; }
    if (st.done) break;
  }
  return page.evaluate(() => { const R = window.__R; return { ...R, done: R.done && { order: R.done.order, dnf: R.done.dnf } }; });
}

const runs = { plain: await race(false), prof: await race(true, true) };
if (process.env.NOISE) runs.plain2 = await race(false);
await browser.close();
const cars = Object.keys(runs.plain.laps), sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const per = (r, k) => {
  const clear = r.laps[k]?.laps.filter((l) => l.clear).map((l) => l.t) ?? [], hits = r.ev.filter((e) => e.type === 'contact' && e.key === k).length;
  return { clearBest: clear.length ? +Math.min(...clear).toFixed(3) : null, best: r.laps[k]?.laps.length ? +Math.min(...r.laps[k].laps.map((l) => l.t)).toFixed(3) : null, respawns: r.resp[k] ?? 0, offS: +(r.off[k] ?? 0).toFixed(1), heroContacts: hits,
    defends: r.ev.filter((e) => e.type === 'defend' && e.key === k).length, mistakes: r.ev.filter((e) => e.type === 'mistake' && e.key === k).length };
};
const table = Object.fromEntries(cars.map((k) => [k, Object.fromEntries(Object.entries(runs).map(([n, r]) => [n, per(r, k)]))]));
const lineCount = (r) => ({ sideBySide: r.ev.filter((e) => e.type === 'sideBySide').length, sideBySideSaid: r.says.filter((x) => x === 'side_by_side').length, defendingSaid: r.says.filter((x) => x === 'defending').length });
const both = cars.filter((k) => table[k].plain.clearBest && table[k].prof.clearBest), drift = both.map((k) => [k, +((table[k].prof.clearBest / table[k].plain.clearBest - 1) * 100).toFixed(2)]);
const noise = runs.plain2 ? cars.filter((k) => table[k].plain.clearBest && table[k].plain2.clearBest).map((k) => [k, +((table[k].plain2.clearBest / table[k].plain.clearBest - 1) * 100).toFixed(2)]) : null;
const heroHits = (r) => r.ev.filter((e) => e.type === 'contact').length, defends = runs.prof.ev.filter((e) => e.type === 'defend').length;
const checks = [
  ['profiled clear-air best laps within 0.3 % of unprofiled', both.length > 0 && drift.every(([, d]) => Math.abs(d) <= 0.3), `${both.length} cars with a clear lap in both: ${drift.map(([k, d]) => `${k} ${d > 0 ? '+' : ''}${d} %`).join(', ')}`],
  ['no new respawns', cars.every((k) => table[k].prof.respawns <= table[k].plain.respawns), `${sum(runs.plain.resp)} -> ${sum(runs.prof.resp)}`],
  ['AI off-asphalt time at most 1 s above unprofiled', cars.every((k) => table[k].prof.offS <= table[k].plain.offS + 1), cars.map((k) => `${k} ${table[k].plain.offS}->${table[k].prof.offS}`).join(', ')],
  ['hero contacts at most 1.5x unprofiled (at least 1 allowed)', heroHits(runs.prof) <= Math.max(1, 1.5 * heroHits(runs.plain)), `${heroHits(runs.plain)} -> ${heroHits(runs.prof)}`],
  ['at least 1 defend in the race with the nemesis adjacent', defends >= 1, `${defends} (nemesis ${runs.prof.nem})`],
];
const report = { track, laps: +laps, nemesis: runs.prof.nem, rival: runs.prof.riv, table, lines: Object.fromEntries(Object.entries(runs).map(([n, r]) => [n, lineCount(r)])), mistakes: runs.prof.ev.filter((e) => e.type === 'mistake'), noise, finished: Object.fromEntries(Object.entries(runs).map(([n, r]) => [n, !!r.done])), errors: [...new Set(errors)].slice(0, 20), checks };
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, table: undefined }, null, 1));
for (const k of cars) console.log(k.padEnd(22), Object.entries(table[k]).map(([n, v]) => `${n}: clear ${v.clearBest ?? '-'} best ${v.best ?? '-'} resp ${v.respawns} off ${v.offS}s hits ${v.heroContacts} def ${v.defends} mis ${v.mistakes}`).join(' | '));
for (const [name, ok, why] of checks) console.log(ok ? 'PASS' : 'FAIL', name, '-', why);
process.exit(checks.every(([, ok]) => ok) && Object.values(report.finished).every(Boolean) ? 0 : 1);
