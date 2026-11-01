// Career logic, no browser (docs/career-mode.md 10.6): seeded rolls, the Round Rating's worked example, calendar rules, offers that
// never dead-end, upgrade caps, and a whole seeded career that replays identically.   node scripts/test-career.mjs
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { loadCareer, play } from './career-sim.mjs';

const server = await createServer({ root: new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const M = await loadCareer(server), { C, R } = M, G = await server.ssrLoadModule('/src/game/career/rng.js');
  // ---- rng: same keys, same draws; another stream or key, different
  const a = G.rng(7, 'cal', 1), b = G.rng(7, 'cal', 1), c = G.rng(7, 'offer', 1);
  const da = [a(), a(), a()]; assert.deepEqual(da, [b(), b(), b()]); assert.notDeepEqual(da, [c(), c(), c()]);
  assert.ok(da.every((x) => x >= 0 && x < 1));

  // ---- the Round Rating's worked example (6.1): Mojave B seat, expected P8, qualifies P7, finishes P6, clean, wins the duel = 8.4
  const ex = R.roundRating({ expPos: 8, grid: 7, finish: 6, fastest: false, clean: true, duel: { result: 'won', big: false } });
  assert.equal(ex.rr, 8.4); assert.equal(R.rrLabel(ex.rr), 'Outstanding');
  assert.equal(R.roundRating({ expPos: 1, grid: 1, finish: 6, clean: false, duel: { result: 'level' } }).rr, 2.5, 'P6 in the fastest car is bad');
  assert.ok(R.roundRating({ expPos: 8, grid: 8, finish: 8, dnf: true }).rr < 5, 'a retirement costs');
  // ---- pace and levels
  assert.equal(R.paceOf(94).toFixed(3), '1.011'); assert.equal(R.paceOf(76).toFixed(3), '0.974');
  assert.equal(R.xpForLevel(2), 90); assert.equal(R.levelOf(89), 1); assert.equal(R.levelOf(90), 2); assert.equal(R.levelOf(1e9), 25);
  assert.ok(R.parLap('india', 'mustang') > R.parLap('india', 'destrier'), 'a slower car has a slower par');
  assert.ok(R.parLap('india', 'av12', 'rain') > R.parLap('india', 'av12'), 'rain is slower');

  // ---- calendar: the world's rounds, finale last, no back-to-back track, the track's own looks, dry-only tracks dry, round 1 dry
  const avail = { india: null, drylake: ['day', 'dusk'], marina: null, shajawa: ['day', 'dusk'], tokyo: null };
  for (let s = 1; s <= 40; s++) {
    const cal = R.buildCalendar(s, 1, 1, avail);
    assert.equal(cal.length, 6); assert.ok(cal.at(-1).finale && cal.filter((r) => r.finale).length === 1);
    assert.equal(cal.at(-1).track, 'india', 'without Infinia the World 1 finale falls back to India'); assert.equal(cal.at(-1).look, 'dusk');
    assert.equal(cal[0].weather, 'dry');
    for (const r of cal) { if (avail[r.track]) assert.ok(avail[r.track].includes(r.look), `${r.track} at ${r.look}`); if (r.track === 'drylake') assert.equal(r.weather, 'dry'); assert.ok(r.laps >= 3 && r.laps <= 12); }
    assert.ok(cal.filter((r) => r.track === 'india').length <= 2 && cal.filter((r) => r.track === 'drylake').length === 2);
    assert.ok(cal.filter((r) => r.weather !== 'dry').length <= 2);
  }
  assert.deepEqual(R.buildCalendar(5, 1, 1, avail), R.buildCalendar(5, 1, 1, avail), 'a calendar is seeded');
  assert.equal(R.buildCalendar(5, 1, 1, { ...avail, infinia: null }).at(-1).track, 'infinia', 'Infinia, when the game has it, is the World 1 finale');

  // ---- the first job: never refused, three B seats, the grade sets the terms
  const s0 = C.newCareer({ name: 'Ada Lovelace', seed: 42, now: 'x' }); assert.equal(s0.player.code, 'LOV');
  C.finishShootout(s0, null);
  assert.equal(s0.pending.shootout.grade, 'Raw'); assert.equal(s0.pending.offers.length, 3); assert.ok(s0.pending.offers.every((o) => o.seat === 'B' && o.tier === 'rookie'));
  const sh = C.shootout(), fast = C.newCareer({ seed: 43, now: 'x' }); C.finishShootout(fast, R.parLap(sh.track, sh.car) * 1.01);
  assert.equal(fast.pending.shootout.grade, 'Standout'); assert.ok(fast.career.cl >= 2, 'the Shootout alone reaches CL 2 (upgrades unlock)');
  C.acceptOffer(fast, fast.pending.offers.find((o) => o.team === 'mojave').id, avail);
  assert.equal(fast.contract.car, 'bmw1'); assert.equal(fast.clock.phase, 'paddock'); assert.equal(fast.season.current.expPos, 8);
  assert.equal(fast.season.current.entries.length, 7, 'seven AI teams, one entry each');
  assert.ok(!fast.season.current.entries.some((k) => ['bmw1', 'jaguarxkjss'].includes(k)), 'the player\'s team has no other car on the grid');
  // ---- upgrades: Rookie cap 1, CL gate, coins
  const coins = fast.wallet.coins, u = C.buyUpgrade(fast, 'engine', 503);
  assert.ok(u.ok); assert.equal(fast.wallet.coins, coins - u.cost); assert.equal(C.buyUpgrade(fast, 'engine', 503).reason, 'cap', 'Rookie seats cap at level 1');
  // ---- a round: quali, then race
  const setup0 = (C.finishQuali(fast, 999), C.raceSetup(fast));
  assert.equal(setup0.gridOrder.at(-1), 'bmw1', 'a slow lap starts last'); assert.equal(setup0.levels('bmw1').engine, 1); assert.equal(setup0.racers.length, 8);
  assert.ok(Object.values(setup0.pace).every((p) => p > 0.9 && p < 1.05));
  const order = [...setup0.gridOrder].reverse(), rep = C.finishRace(fast, { order, best: Object.fromEntries(order.map((k, i) => [k, 70 + i])), crashes: 0, spins: 0 });
  assert.equal(rep.finish, 1); assert.ok(rep.rr >= 9, 'from last to first in the slowest car is a masterclass'); assert.equal(rep.entries[0].pts, 25 + 1, 'the winner with the fastest lap');
  assert.equal(fast.clock.round, 1); assert.equal(fast.clock.phase, 'paddock');
  const st = C.standings(fast); assert.equal(st.drivers[0].code, fast.player.code); assert.equal(st.cup.length, 3);
  C.finishQuali(fast, 60); const retire = C.finishRace(fast, { order: fast.season.current.quali.grid, best: {}, dnf: true }); assert.equal(retire.finish, 8); assert.ok(retire.rr < rep.rr);

  // ---- whole careers: replay identically, never a negative wallet, always an offer at the season end
  assert.equal(JSON.stringify(play(M, 9, 1.0, 2).save), JSON.stringify(play(M, 9, 1.0, 2).save), 'the same seed plays the same career');
  for (let i = 0; i < 30; i++) {
    const { save, log } = play(M, 500 + i, [0.97, 1.0, 1.02][i % 3], 2);
    assert.ok(log.minWallet >= 0); assert.ok(log.offers.every((n) => n >= 1), 'never a dead end');
    assert.ok(JSON.stringify(save).length < 100_000, 'the save stays small');
  }
  console.log('career: all checks passed');
} finally { await server.close(); }
