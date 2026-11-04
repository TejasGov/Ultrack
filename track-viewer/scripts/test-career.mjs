// Career logic, no browser (docs/career-mode.md 10.6): seeded rolls, the Round Rating's worked example, calendar rules, offers that
// never dead-end, upgrade caps, negotiation, W1, drops and the reserve seat, rivals, side events, the driver market, save slots, and
// whole seeded careers (nine seasons) that replay identically.   node scripts/test-career.mjs
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

  // ---- the Round Rating's worked example (6.1): expected P8 of 16, qualifies P6, finishes P4, clean, wins the duel = 8.4
  const ex = R.roundRating({ expPos: 8, grid: 6, finish: 4, fastest: false, clean: true, duel: { result: 'won', big: false } });
  assert.equal(ex.rr, 8.4); assert.equal(R.rrLabel(ex.rr), 'Outstanding');
  assert.equal(R.roundRating({ expPos: 1, grid: 1, finish: 8, clean: false, duel: { result: 'level' } }).rr, 3.6, 'P8 in the fastest car is bad');
  assert.ok(R.roundRating({ expPos: 8, grid: 8, finish: 8, dnf: true }).rr < 5, 'a retirement costs');
  { const won = { expPos: 5, grid: 2, finish: 1, fastest: true, clean: false, duel: { result: 'level', skipped: true } }, skipped = R.roundRating({ ...won, exempt: true }), label = (r) => r.lines.map((l) => l[0]);
    assert.equal(skipped.rr, 8.8, 'a win from a skip earned by the last result: not punished for it'); assert.ok(label(skipped).includes('Won the race') && label(skipped).includes('Skipped qualifying on merit') && label(skipped).includes('Started 3 above expected'));
    assert.ok(!label(R.roundRating({ ...won, exempt: true, grid: 7 })).some((l) => /Started|below/.test(l)), 'a worse earned slot costs nothing');
    assert.ok(label(R.roundRating({ expPos: 3, grid: 3, finish: 1 })).includes('Won the race')); assert.ok(!label(R.roundRating({ expPos: 3, grid: 3, finish: 2 })).includes('Won the race')); assert.ok(!label(R.roundRating({ expPos: 3, grid: 3, finish: 1, dnf: true })).includes('Won the race'), 'a retirement wins nothing'); }
  // ---- pace and levels
  assert.equal(R.paceOf(94).toFixed(3), '1.011'); assert.equal(R.paceOf(76).toFixed(3), '0.974');
  assert.equal(R.xpForLevel(2), 90); assert.equal(R.levelOf(89), 1); assert.equal(R.levelOf(90), 2); assert.equal(R.levelOf(1e9), 25);
  assert.ok(R.parLap('india', 'nissan-z') > R.parLap('india', 'destrier'), 'a slower car has a slower par');
  assert.ok(R.parLap('india', 'av12', 'rain') > R.parLap('india', 'av12'), 'rain is slower');

  // ---- calendar: the Tour. Tour 1-2, Japan Open, Tour 3-4, India Open, Tour 5-6, Venice Open, Masters; each Open on its own circuit and nowhere else; no back-to-back circuit; looks; round 1 dry
  const avail = { india: null, drylake: ['day', 'dusk'], infinia: ['day', 'dusk'], marina: null, shajawa: ['day', 'dusk'], llano: ['day', 'dusk'], tokyo: null, qingshan: null, venice: null };
  const KINDS = ['tour', 'tour', 'open', 'tour', 'tour', 'open', 'tour', 'tour', 'open', 'masters'], TOUR = ['shajawa', 'india', 'qingshan', 'llano', 'marina'], OPENS = ['tokyo', 'infinia', 'venice'];
  { const comeBack = new Set();
    for (let s = 1; s <= 200; s++) {
      const cal = R.buildCalendar(s, 1, 1, avail), tour = cal.filter((r) => r.kind === 'tour').map((r) => r.track);
      assert.deepEqual(cal.map((r) => r.kind), KINDS); assert.deepEqual(cal.filter((r) => r.kind === 'open').map((r) => r.track), OPENS, 'the Opens are on their own circuits, in order');
      assert.deepEqual(cal.map((r) => r.round), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); assert.ok(cal.at(-1).finale && cal.filter((r) => r.finale).length === 1);
      assert.deepEqual([...new Set(tour)].sort(), [...TOUR].sort(), 'every Tour circuit is raced'); assert.equal(tour.length, 6, 'five circuits fill six rounds: one comes back');
      assert.ok([...tour, 'marina'].every((t, i, l) => i === 0 || t !== l[i - 1]), `no circuit twice in a row: ${tour}`);
      for (const t of TOUR) if (tour.filter((x) => x === t).length === 2) comeBack.add(t);
      assert.ok(!tour.includes('drylake') && !tour.some((t) => OPENS.includes(t)), 'no Open circuit and no Dry Lake in the Tour');
      assert.equal(cal.at(-1).track, 'marina'); assert.equal(cal.at(-1).look, 'night', 'the Masters is Marina at night'); assert.equal(cal[0].weather, 'dry');
      assert.deepEqual(cal.filter((r) => r.kind === 'open').map((r) => r.name), ['Japan Open', 'India Open', 'Venice Open']); assert.equal(cal.at(-1).name, 'Ultrack Masters');
      for (const r of cal) { if (avail[r.track]) assert.ok(avail[r.track].includes(r.look), `${r.track} at ${r.look}`); if (r.track === 'drylake') assert.equal(r.weather, 'dry'); assert.ok(r.laps >= 2 && r.laps <= 12); assert.equal(!!r.lcqLaps, r.kind === 'open'); }
      assert.ok(cal.filter((r) => r.weather !== 'dry').length <= 2);
    }
    assert.equal(comeBack.size, 5, 'any of the five circuits can be the one that returns'); }
  assert.deepEqual(R.buildCalendar(5, 1, 1, avail), R.buildCalendar(5, 1, 1, avail), 'a calendar is seeded'); assert.notDeepEqual(R.buildCalendar(5, 1, 1, avail), R.buildCalendar(5, 2, 1, avail), 'and changes by season');
  { const few = R.buildCalendar(5, 1, 1, { india: null, drylake: null, marina: null, shajawa: null, tokyo: null });   // a game missing circuits: its Opens drop out and the Tour still fills its rounds
    assert.deepEqual(few.map((r) => r.kind), ['tour', 'tour', 'open', 'tour', 'tour', 'tour', 'tour', 'masters']); assert.ok(few.every((r) => !['infinia', 'venice', 'qingshan', 'llano'].includes(r.track))); }

  // ---- race lengths: chosen in minutes, laps per circuit, the default is the short one, nobody is forced into 8 laps
  assert.deepEqual(['sprint', 'standard', 'full'].map((l) => R.lapsFor('drylake', l)), [3, 5, 8]); assert.deepEqual(['sprint', 'standard', 'full'].map((l) => R.lapsFor('marina', l)), [2, 2, 3]);
  assert.ok(R.buildCalendar(5, 1, 1, avail).every((r) => r.laps === R.lapsFor(r.track, 'sprint') && r.laps <= 3 && (!r.lcqLaps || r.lcqLaps === 3)), 'Sprint by default');
  { const base = R.paceOf(80); R.setHardMode(true); assert.ok(Math.abs(R.paceOf(80) / base - R.TUNING.pace.hardMode) < 1e-9, 'Hard mode lifts rival pace'); assert.equal(R.hardPaceFor(false), 1); R.setHardMode(false); assert.equal(R.paceOf(80), base, 'and off puts it back'); }
  assert.equal(R.TUNING.series.qualiValidLaps, 1, 'one valid lap qualifies');
  const len = C.newCareer({ seed: 77, now: 'x' }); assert.equal(len.rules.raceLength, 'sprint'); C.finishShootout(len, null); C.acceptOffer(len, len.pending.offers[0].id, avail);
  C.finishQuali(len, 60); C.finishRace(len, { order: len.season.current.quali.grid, best: {} });
  const raced = len.season.calendar[0].laps; C.setRaceLength(len, 'full');
  assert.equal(len.season.calendar[0].laps, raced, 'a round already raced keeps its laps'); assert.ok(len.season.calendar.slice(1).every((r) => r.laps === R.lapsFor(r.track, 'full')), 'the rounds to come follow it');
  C.setRaceLength(len, 'silly'); assert.equal(len.rules.raceLength, 'full', 'an unknown length changes nothing');
  // ---- points and XP do not depend on the length: the same round, the same result
  const same = (l) => { const x = C.newCareer({ seed: 78, raceLength: l, now: 'x' }); C.finishShootout(x, null); C.acceptOffer(x, x.pending.offers[0].id, avail); C.finishQuali(x, 60); const r = C.finishRace(x, { order: x.season.current.quali.grid, best: {} }); return [r.xp, r.rr, r.rep, r.entries.map((e) => e.pts)]; };
  assert.deepEqual(same('sprint'), same('full'), 'race length never changes XP, rating, reputation or points');
  // ---- another qualifying try keeps the better lap and moves nobody else
  const q2 = C.newCareer({ seed: 79, now: 'x' }); C.finishShootout(q2, null); C.acceptOffer(q2, q2.pending.offers[0].id, avail); C.finishQuali(q2, 90); const me = q2.contract.car, ai = { ...q2.season.current.quali.laps };
  C.finishQuali(q2, 95); assert.equal(q2.season.current.quali.laps[me], 90, 'a slower retry changes nothing'); C.finishQuali(q2, null); assert.equal(q2.season.current.quali.laps[me], 90, 'no lap on a retry keeps the lap');
  const qs = C.qualiSetup(q2), qm = C.teammateCar(q2); assert.deepEqual(qs.racers, [me, qm], 'the teammate is on track in qualifying'); assert.ok(qs.pace[qm] > 0); assert.equal(qs.drivers[me].name, q2.player.name);
  const qa = C.newCareer({ seed: 79, now: 'x' }); C.finishShootout(qa, null); C.acceptOffer(qa, qa.pending.offers[0].id, avail); qa.season.calendar[0].track = 'drylake'; C.finishQuali(qa, 90, 88); assert.equal(qa.season.current.quali.mate.lap, 88, 'his real lap is the duel'); assert.equal(qa.season.current.quali.duel.result, 'lost');
  C.finishQuali(qa, 85, 89); assert.equal(qa.season.current.quali.mate.lap, 88, 'a retry keeps his better lap too'); assert.equal(qa.season.current.quali.duel.result, 'won'); C.finishQuali(qa, null); assert.equal(qa.season.current.quali.mate.lap, 88, 'no lap on a retry keeps his lap'); assert.deepEqual(qa.season.current.quali.grid.includes(C.teammateCar(qa)), false, 'he still does not race');
  { const empty = C.newCareer({ seed: 79, now: 'x' }); C.finishShootout(empty, null); C.acceptOffer(empty, empty.pending.offers[0].id, avail); empty.world.seats[C.teammateCar(empty)] = null; assert.deepEqual(C.qualiSetup(empty).racers, [empty.contract.car], 'an empty seat: the player alone'); }
  C.finishQuali(q2, 55); assert.equal(q2.season.current.quali.laps[me], 55); assert.deepEqual({ ...q2.season.current.quali.laps, [me]: 90 }, ai, 'the AI laps are seeded'); assert.equal(q2.clock.phase, 'race');
  // ---- a save from before race lengths comes up on Sprint
  const pre = C.newCareer({ seed: 80, now: 'x' }); C.finishShootout(pre, null); C.acceptOffer(pre, pre.pending.offers[0].id, avail); pre.schema = 2; delete pre.rules.raceLength; pre.season.calendar.forEach((r) => { r.laps = 8; });
  C.migrate(pre); assert.equal(pre.schema, C.SCHEMA); assert.equal(pre.rules.raceLength, 'sprint'); assert.ok(pre.season.calendar.every((r) => r.laps <= 3));

  // ---- the first job: never refused, three B seats, the grade sets the terms
  const s0 = C.newCareer({ name: 'Ada Lovelace', seed: 42, now: 'x' }); assert.equal(s0.player.code, 'LOV');
  C.finishShootout(s0, null);
  assert.equal(s0.pending.shootout.grade, 'Raw'); assert.equal(s0.pending.offers.length, 3); assert.ok(s0.pending.offers.every((o) => o.seat === 'B' && o.tier === 'rookie'));
  const sh = C.shootout(), fast = C.newCareer({ seed: 43, now: 'x' }); C.finishShootout(fast, R.parLap(sh.track, sh.car) * 1.01);
  assert.equal(fast.pending.shootout.grade, 'Standout'); assert.ok(fast.career.cl >= 2, 'the Shootout alone reaches CL 2 (upgrades unlock)');
  C.acceptOffer(fast, fast.pending.offers.find((o) => o.team === 'mojave').id, avail);
  assert.equal(fast.contract.car, 'bmw1'); assert.equal(fast.clock.phase, 'paddock'); assert.equal(fast.season.current.expPos, 14);
  // ---- upgrades: Rookie cap 1, CL gate, coins
  const coins = fast.wallet.coins, u = C.buyUpgrade(fast, 'engine', 503);
  assert.ok(u.ok); assert.equal(fast.wallet.coins, coins - u.cost); assert.equal(C.buyUpgrade(fast, 'engine', 503).reason, 'cap', 'Rookie seats cap at level 1');
  // ---- a round: quali, then race
  C.finishQuali(fast, 999); const q0 = fast.season.current.quali; assert.equal(q0.order.length, 16, 'all sixteen qualify'); assert.equal(q0.grid.length, 8, 'the fastest eight race'); assert.equal(q0.order.at(-1), 'bmw1'); assert.ok(!q0.grid.includes('bmw1'), 'a slow lap misses the cut');
  assert.equal(C.qualiPlace(q0, 'bmw1'), 16); assert.deepEqual(q0.grid, q0.order.slice(0, 8));
  const setup0 = (C.finishQuali(fast, q0.laps[q0.grid[7]] - 0.001), C.raceSetup(fast));
  assert.equal(setup0.gridOrder.at(-1), 'bmw1', 'just inside the cut starts last'); assert.equal(setup0.levels('bmw1').engine, 1); assert.equal(setup0.racers.length, 8);
  assert.ok(Object.values(setup0.pace).every((p) => p > 0.9 && p < 1.05));
  const order = [...setup0.gridOrder].reverse(), rep = C.finishRace(fast, { order, best: Object.fromEntries(order.map((k, i) => [k, 70 + i])), crashes: 0, spins: 0 });
  assert.equal(rep.finish, 1); assert.ok(rep.rr >= 9, 'from last to first in the slowest car is a masterclass'); assert.equal(rep.entries[0].pts, 25 + 1, 'the winner with the fastest lap');
  assert.equal(fast.clock.round, 1); assert.equal(fast.clock.phase, 'paddock');
  const st = C.standings(fast); assert.equal(st.drivers[0].code, fast.player.code); assert.equal(st.cup.length, 3);
  C.finishQuali(fast, 1); const retire = C.finishRace(fast, { order: fast.season.current.quali.grid, best: {}, dnf: true }); assert.equal(retire.finish, 8); assert.ok(retire.rr < rep.rr);

  // ---- whole careers: replay identically, never a negative wallet, always an offer at the season end
  assert.equal(JSON.stringify(play(M, 9, 1.0, 2).save), JSON.stringify(play(M, 9, 1.0, 2).save), 'the same seed plays the same career');
  for (let i = 0; i < 30; i++) {
    const { save, log } = play(M, 500 + i, [0.97, 1.0, 1.02][i % 3], 2);
    assert.ok(log.minWallet >= 0); assert.ok(log.offers.every((n) => n >= 1), 'never a dead end');
    assert.ok(JSON.stringify(save).length < 100_000, 'the save stays small');
  }
  // ---- P2 helpers: a career at a chosen moment
  const signed = (seed, team = 'mojave') => { const s = C.newCareer({ seed, now: 'x' }); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04); C.acceptOffer(s, s.pending.offers.find((o) => o.team === team).id, avail); return s; };
  /** one round: `place` is where the player finishes (1-8); `mate` makes the duel lap fast or slow */
  const round = (s, place = 8, lap = 999) => {
    if (s.clock.phase === 'paddock') {
      C.finishQuali(s, lap); const q = s.season.current.quali, me = s.contract.car;
      if (!q.grid.includes(me)) { q.order = [...q.order.filter((k) => k !== me).slice(0, 7), me, ...q.order.filter((k) => k !== me).slice(7)]; q.grid = q.order.slice(0, 8); }   // these rounds race from the back; a missed cut has its own test
    }
    const hero = s.contract.car, o = s.season.current.open;
    if (o?.stage === 'lcq') { const q = s.season.current.quali; C.finishLcq(s, { order: [hero, ...q.grid.filter((k) => k !== hero)].slice(0, 8), best: {} }); }   // an Open: through the Last Chance to the Final (a Last Chance of its own has its own test)
    const others = s.season.current.quali.grid.filter((k) => k !== hero); others.splice(place - 1, 0, hero);
    return C.finishRace(s, { order: others, best: Object.fromEntries(others.map((k, i) => [k, 70 + i])), crashes: 0, spins: 0 });
  };
  const toReview = (s, place, lap) => { while (s.clock.phase !== 'review') round(s, place, lap); return s; };

  // ---- the top eight: teammates can both race, and a missed cut is a round of its own
  { const d = signed(150), me = d.contract.car, mate = C.teammateCar(d); C.finishQuali(d, 1, 1.001); const q = d.season.current.quali; assert.deepEqual(q.grid.slice(0, 2), [me, mate], 'both cars of a team race'); assert.equal(C.raceSetup(d).drivers[mate].code, d.world.seats[mate]); assert.ok(C.raceSetup(d).pace[mate] > 0, 'the teammate races at his pace');
    const r = C.finishRace(d, { order: q.grid, best: {} }); assert.equal(r.entries.length, 16); assert.equal(r.entries.filter((e) => !e.dnq).length, 8); assert.ok(r.entries.slice(8).every((e) => e.pts === 0 && e.dnq)); assert.equal(C.standings(d).drivers.length, 16, 'the table has everyone'); assert.ok(C.standings(d).teams.find((t) => t.team === d.contract.team).pts >= 25 + 18 + 2, 'both cars score for the team');
    const o = signed(151), started = o.stats.starts, wk = o.clock.week; C.finishQuali(o, 999); const place = C.qualiPlace(o.season.current.quali, o.contract.car); const dq = C.finishDnq(o);
    assert.equal(dq.dnq, true); assert.equal(dq.finish, place); assert.equal(dq.grid, place); assert.equal(dq.entries.find((e) => e.you).pts, 0); assert.equal(dq.entries.filter((e) => !e.dnq).length, 8); assert.ok(dq.entries.slice(0, 8).every((e) => !e.you)); assert.ok(dq.entries[0].pts >= 25); assert.equal(o.stats.starts, started, 'no start'); assert.ok(o.clock.week > wk, 'the season moves on'); assert.ok(!dq.coinLines.some(([l]) => /Finished/.test(l)), 'no place money'); assert.ok(dq.rr < 8);
    const old = signed(152), oq = old.season.current; oq.entries = ['x']; C.finishQuali(old, 1); delete oq.quali.order; assert.equal(C.finishRace(old, { order: oq.quali.grid, best: {} }).entries.length, 8, 'a save from before the format plays its round out');
    assert.equal(R.expOf(1, 'A'), 1); assert.equal(R.expOf(1, 'B'), 2); assert.equal(R.expOf(8, 'B'), 16); assert.equal(R.objectivesFor(G.rng(1, 'x'), 16)[0].kind, 'quali'); assert.equal(R.objectivesFor(G.rng(1, 'x'), 16)[0].n, 15); assert.equal(R.objectivesFor(G.rng(1, 'x'), 4)[0].kind, 'finish'); }

  // ---- one retry a round, and a podium ahead of the teammate skips the next qualifying
  { const toRace = (s) => { while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); return s; }, ent = (...k) => k.map((key) => ({ key }));
    assert.deepEqual(R.qualiExemption({ finish: 1, entries: ent('me', 'mate') }, 'mate'), { slot: 1, why: 'your win' }); assert.equal(R.qualiExemption({ finish: 2, entries: ent('mate', 'me') }, 'mate'), null, 'the teammate ahead: qualify');
    assert.equal(R.qualiExemption({ finish: 3, entries: ent('x', 'mate', 'me') }, 'mate'), null); assert.equal(R.qualiExemption({ finish: 3, entries: ent('x', 'y', 'me', 'mate') }, 'mate').slot, 3, 'the teammate behind: skip it');
    assert.equal(R.qualiExemption({ finish: 2, entries: ent('x', 'me') }, 'mate').slot, 2, 'the teammate not classified ahead'); assert.equal(R.qualiExemption({ finish: 4, entries: ent('x', 'y', 'z', 'me') }, 'mate'), null, 'P4 qualifies'); assert.equal(R.qualiExemption({ finish: 1, dnf: true, entries: ent('me') }, 'mate'), null); assert.equal(R.qualiExemption({ finish: 12, dnq: true, entries: ent('me') }, 'mate'), null); assert.equal(R.qualiExemption(undefined, 'mate'), null, 'the first round always qualifies');
    const e = toRace(signed(160)), me = e.contract.car, mate = C.teammateCar(e); assert.equal(e.season.current.exempt, null);
    C.finishQuali(e, 1); assert.equal(C.retriesLeft(e.season.current.quali), 1, 'one retry after the first run'); C.finishQuali(e, 0.9); const q = e.season.current.quali; assert.equal(C.retriesLeft(q), 0, 'and it is used'); assert.equal(q.laps[me], 0.9);
    C.finishRace(e, { order: q.grid, best: {} }); toRace(e); const n = e.season.current.quali, duels = { ...e.contract.duel };
    assert.equal(e.clock.phase, 'race', 'after a win the race is next'); assert.equal(n.exempt.slot, 1); assert.equal(n.grid[0], me); assert.equal(n.grid.length, 8); assert.equal(n.order.length, 16); assert.equal(new Set(n.order).size, 16); assert.notEqual(n.pole, me, 'the pole stays the fastest lap'); assert.ok(n.grid.includes(n.pole)); assert.equal(C.retriesLeft(n), 0); assert.equal(n.duel.skipped, true); assert.ok(!e.season.current.objectives.some((o) => o.kind === 'duel' || o.kind === 'quali'), 'no objective about a session he skips');
    const r2 = C.finishRace(e, { order: n.grid, best: {} }); assert.deepEqual(e.contract.duel, duels, 'no duel that round'); assert.equal(r2.pole, false); assert.equal(r2.entries[0].pts, 25, 'no pole points for the slot'); assert.ok(!r2.rrLines.some(([l]) => /Qualified/.test(l)), 'no qualifying credit'); assert.ok(r2.entries.find((x) => x.key === n.pole).pts >= 2, 'the fastest lap has them'); assert.equal(R.qualiExemption(r2, mate).slot, 1);
    const a = toRace(signed(161)), am = a.contract.car, at = C.teammateCar(a); C.finishQuali(a, 1, 1.001); const ag = a.season.current.quali.grid, ao = [at, am, ...ag.filter((k) => k !== am && k !== at)]; C.finishRace(a, { order: ao, best: {} }); toRace(a); assert.equal(a.season.current.exempt, null, 'second to the teammate: qualify'); assert.equal(a.season.current.quali, null);
    const b = toRace(signed(162)), bm = b.contract.car; C.finishQuali(b, 1); const bg = b.season.current.quali.grid; C.finishRace(b, { order: bg, best: {}, dnf: true }); toRace(b); assert.equal(b.season.current.exempt, null, 'a retirement qualifies'); assert.equal(C.retriesLeft({ tries: undefined }), 1, 'a save from before the limit has its retry'); assert.ok(bm); }

  // ---- the seat map: the player's seat holds YOU, the driver he displaced is a free agent with a grudge
  const m = signed(101);
  assert.equal(m.world.seats.bmw1, 'YOU'); assert.deepEqual(m.world.free, ['QUI']); assert.equal(m.career.heat.QUI, 40);
  assert.equal(C.driverAt(m, 'bmw1').you, true); assert.equal(C.driverAt(m, 'jaguarxkjss').code, 'LIN');
  assert.equal(C.raceSetup((C.finishQuali(m, 30), m)).drivers.bmw1.name, m.player.name, 'the race shows the player in his car');
  // ---- rivals: finishing near a driver heats it, 40 is a rival, beating him pays; everyone else cools
  const h0 = signed(102); h0.career.heat = { MAD: 85 }; C.finishQuali(h0, 1);
  const hero0 = h0.contract.car, grid0 = h0.season.current.quali.grid, madCar = Object.keys(h0.world.seats).find((k) => h0.world.seats[k] === 'MAD');
  if (!grid0.includes(madCar)) h0.season.current.quali.grid = grid0.map((k) => (R.CAR[k].team === R.CAR[madCar].team ? madCar : k));
  const order0 = [hero0, ...h0.season.current.quali.grid.filter((k) => k !== hero0 && k !== madCar), madCar];
  const r0 = C.finishRace(h0, { order: order0, best: {}, crashes: 0, spins: 0 });
  assert.ok(r0.repLines.some(([l]) => /Feud beaten/.test(l)), 'beating a feud rival pays REP'); assert.ok(r0.xpLines.some(([l]) => l === 'Feud won'));
  assert.ok(h0.career.heat.MAD < 85, 'a driver far away in the order cools'); assert.ok(C.rivalsOf(h0).some((x) => x.code === 'MAD'));

  // ---- team package: the first level of the season is free, and it goes through the cap
  const p0 = signed(103), coins0 = p0.wallet.coins; assert.equal(p0.garage.package, 1);
  const pu = C.buyUpgrade(p0, 'tyres', 503); assert.ok(pu.ok && pu.free); assert.equal(p0.wallet.coins, coins0); assert.equal(p0.garage.package, 0); assert.equal(p0.garage.paid.bmw1, 0, 'a gift is not bought back');
  assert.equal(C.upgradeInfo(p0, 'tyres', 503).reason, 'cap');

  // ---- negotiation: inside the leverage it is signed; beyond it the team counters, then withdraws; never a dead end
  const n0 = C.newCareer({ seed: 104, now: 'x' }); C.finishShootout(n0, null);
  const oh = n0.pending.offers[0], base = oh.salary, lev = C.leverageOf(n0, oh);
  assert.equal(lev, 1 + 4 * R.TUNING.offers.firstJobInterest + 2, 'two other teams in hand');
  assert.equal(R.demandOf(oh, { salary: 0.2, seasons: 2, status: 'second' }), 4); assert.equal(R.demandOf(oh, { salary: 0, seasons: 1, status: 'junior' }), 0.5);
  assert.equal(C.negotiate(n0, oh.id, { salary: 0.1, seasons: 2, status: 'junior' }).result, 'accepted'); assert.equal(oh.salary, Math.round(base * 1.1 / 5) * 5); assert.ok(oh.agreed && !C.canNegotiate(oh));
  const o2 = n0.pending.offers[1], hard = { salary: 0.3, seasons: 1, status: 'second' };
  const c1 = C.negotiate(n0, o2.id, hard); assert.equal(c1.result, 'countered'); assert.ok(R.demandOf(o2, c1.terms) <= c1.leverage, 'the counter is terms they would sign');
  const rep0 = (n0.career.rep = 20);
  assert.equal(C.negotiate(n0, o2.id, hard).result, 'withdrawn'); assert.equal(n0.career.rep, rep0 + R.TUNING.rep.withdrawn); assert.ok(!n0.pending.offers.includes(o2));
  // ---- the last offer gone: a reserve seat appears
  n0.pending.offers = [n0.pending.offers[1]]; const o3 = n0.pending.offers[0];
  o3.interest = -1; C.negotiate(n0, o3.id, hard); assert.equal(C.negotiate(n0, o3.id, hard).result, 'withdrawn');
  assert.equal(n0.pending.offers.length, 1); assert.ok(n0.pending.offers[0].reserve, 'never a dead end'); assert.ok(!C.canNegotiate(n0.pending.offers[0]));

  // ---- the seat review: a warning under trust 35 at mid-season, recovery clears it, a low trust at the finale is a drop
  const d0 = signed(105); d0.contract.trust = 30; let dr; const missCut = (s) => { C.finishQuali(s, 999); return C.finishDnq(s); }; for (let i = 0; i < 5; i++) { d0.contract.trust = 30; dr = missCut(d0); }   // the middle of ten rounds, an Open and a Dry Lake qualifying among them
  assert.ok(dr.midSeason.warning); assert.ok(d0.contract.warning, 'warned at the middle round'); assert.equal(d0.contract.warning.left, 2);
  while (d0.clock.phase !== 'review') missCut(d0);
  assert.ok(d0.pending.review.dropped, 'trust gone at the finale: dropped'); assert.ok(d0.history.at(-1).dropped);
  assert.ok(d0.pending.offers.every((o) => o.team !== 'mojave'), 'the seat is gone'); const res = d0.pending.offers.find((o) => o.reserve); assert.ok(res, 'the reserve seat is the way back');
  const cash = d0.wallet.coins; C.acceptOffer(d0, res.id, avail);
  assert.ok(d0.contract.reserve && d0.contract.easier); assert.equal(d0.contract.salary, Math.round(R.TIERS.tiers.rookie.salary.B * 0.6 / 5) * 5); assert.equal(d0.wallet.coins, cash, 'a reserve seat has no signing bonus');
  assert.equal(d0.world.seats.bmw1 === 'YOU', false, 'the old seat went back to the market'); assert.ok(d0.world.seats.bmw1, 'and it was filled');
  const res1 = round(d0, 1, 1); assert.equal(res1.entries[0].pts, 0, 'a reserve driver scores no points in rounds 1-2'); round(d0, 1, 1); assert.ok(round(d0, 1, 1).entries[0].pts > 0, 'from round 3 he does');
  { const gain = { kind: 'gain', n: 2 }, from = (g, f) => { const o = R.objectiveFrom(gain, g); return [o.kind, R.objectiveMet(o, { grid: g, finish: f })]; };
    assert.deepEqual(from(1, 1), ['hold', true], 'from pole there are no places to gain: winning meets it'); assert.deepEqual(from(1, 2), ['hold', false]); assert.deepEqual(from(2, 2), ['hold', true], 'nor two from P2');
    assert.deepEqual(from(3, 1), ['gain', true], 'P3 to a win still gains two'); assert.deepEqual(from(3, 2), ['gain', false]); assert.equal(R.objectiveText(R.objectiveFrom(gain, 1)), 'Finish at or above your grid slot'); }
  assert.ok(R.objectivesFor(G.rng(1, 'x'), 8, true)[0].n === 8 && R.objectivesFor(G.rng(1, 'x'), 8)[0].n === 7, 'a reserve driver only has to finish');
  const rec = signed(107); rec.contract.warning = { left: 2, met: 0 }; round(rec, 1); assert.equal(rec.contract.warning.met, 1); round(rec, 1); assert.equal(rec.contract.warning, null, 'two objectives met: the warning is gone');

  // ---- promotion swaps the two drivers; the market fills every seat
  const pr = signed(108); toReview(pr, 2, 1); pr.contract.trust = 90;
  const before = pr.world.seats.jaguarxkjss; pr.pending.offers.unshift({ id: 'x-A', team: 'mojave', seat: 'A', car: 'jaguarxkjss', tier: 'rookie', status: 'lead', salary: 400, seasons: 2 });
  assert.equal(C.mateOf(pr, pr.pending.offers[0]).code, before, 'the A driver becomes your teammate'); C.acceptOffer(pr, 'x-A', avail);
  assert.equal(pr.world.seats.jaguarxkjss, 'YOU'); assert.equal(pr.world.seats.bmw1, before, 'the old A driver swaps down'); assert.equal(C.driverAt(pr, C.teammateCar(pr)).code, before);

  // ---- W1: from season 2, one offer from the tier above; signing pays the release cut now and joins next season
  let w = null, seed = 200;
  for (; seed < 400 && !w; seed++) { const s = signed(seed); toReview(s, 3, 1); s.career.rep = 400; s.career.rr = [8, 8, 8, 8, 8, 8]; s.career.cl = 10; const k = s.pending.offers.find((o) => o.keep); C.acceptOffer(s, k.id, avail); s.career.rep = 400; s.career.rr = [8, 8, 8, 8, 8, 8]; s.career.cl = 10; for (let i = 0; i < 5; i++) { s.career.rr = [8, 8, 8, 8, 8, 8]; round(s, 2, 1); } if (s.season.mid.length) w = s; }
  assert.ok(w, 'a good driver gets a mid-season offer on some seeds'); const wo = w.season.mid[0]; assert.equal(R.TIERS.teams[wo.team].tier, 'maestro'); assert.equal(C.currentWeek(w).kind, 'market', 'it arrives in the market week');
  assert.ok(C.canNegotiate(wo), 'a mid-season offer can be negotiated'); assert.ok(w.inbox.some((m) => m.action?.deal === wo.id), 'and the inbox links to it');
  const coinsW = w.wallet.coins, trustW = w.contract.trust, a1 = C.signMid(w, wo.id); assert.equal(w.wallet.coins, coinsW + a1.cut); assert.equal(C.signMid(w, wo.id), null, 'answered once'); assert.equal(w.contract.next.team, wo.team); assert.equal(w.contract.trust, trustW - R.TUNING.trust.signedAway, 'your team takes it badly');
  toReview(w, 2, 1); assert.equal(w.pending.offers.length, 1, 'the signed deal stands alone'); assert.ok(!C.canNegotiate(w.pending.offers[0]));
  const nextTeam = w.contract.next.team; C.acceptOffer(w, w.pending.offers[0].id, avail); assert.equal(w.contract.team, nextTeam); assert.equal(w.season.tier, 'maestro'); assert.ok(w.season.calendar.length >= 6, 'the World 2 calendar');
  const s1 = signed(109); for (let i = 0; i < 3; i++) round(s1, 1, 1); assert.deepEqual(s1.season.mid, [], 'season 1 is probation: no W1');

  // ---- release: signing elsewhere with seasons left pays the player his cut; counter-offers carry the A seat
  let rel = null; for (let i = 400; i < 500 && !rel; i++) { const s = signed(i); s.career.rep = 400; s.career.cl = 10; toReview(s, 1, 1); if (s.contract.seasonsLeft > 1 && s.pending.offers.some((o) => o.tier === 'maestro')) rel = s; }
  assert.ok(rel, 'a strong year brings a Maestro offer'); const up = rel.pending.offers.find((o) => o.tier === 'maestro'), cashR = rel.wallet.coins, sal = rel.contract.salary, sign0 = up.signing;
  C.acceptOffer(rel, up.id, avail); assert.equal(rel.transfer, Math.round(8 * sal * 1 * 0.2 / 50) * 50); assert.equal(rel.wallet.coins, cashR + rel.transfer + sign0 + rel.buyback); assert.equal(rel.season.tier, 'maestro');
  let ctr = null; for (let i = 500; i < 700 && !ctr; i++) { const s = signed(i); s.career.rep = 400; s.career.cl = 10; toReview(s, 1, 999); ctr = s.pending.offers.find((o) => o.id.endsWith('-counter')) ?? null; }   // the duel lost: no promotion to compete with it
  assert.ok(ctr, 'a counter-offer appears on some seeds'); assert.equal(ctr.seat, 'A'); assert.equal(ctr.counter, undefined, 'it opens as a plain offer: .counter is the terms they last said');

  ctr.counter = true; C.migrate({ schema: C.SCHEMA, pending: { offers: [ctr] } }); assert.equal(ctr.counter, undefined, 'a counter-offer saved with the old flag is repaired');
  // ---- the bug sweep: a tied duel wins nothing, a retirement earns no place money, a Raw contract stays easier into its second year, a refusal at zero reputation promises no loss
  const O = await server.ssrLoadModule('/src/game/career/offers.js'), E = await server.ssrLoadModule('/src/game/economy.js');
  const duel = (won, lost, level) => { const s = signed(140); s.contract.seat = 'B'; s.contract.trust = 90; s.contract.duel = { won, lost, level }; return O.seasonOffers(s, { cup: false, title: false, dropped: false }).some((o) => o.team === s.contract.team && o.seat === 'A' && /won the duel/.test(o.why)); };
  assert.equal(duel(3, 3, 0), false, 'a tied duel is not a win'); assert.equal(duel(4, 2, 0), true); assert.equal(duel(3, 2, 1), true); assert.equal(duel(2, 3, 1), false);
  const payLabels = (retired) => E.rewardFor({ mode: 'race', pos: 8, cars: 8, laps: 5, finished: !retired, retired }).lines.map(([l]) => l);
  assert.ok(payLabels(false).includes('Finished P8') && !payLabels(true).includes('Finished P8'), 'a retirement earns no place money');
  const ez = signed(141); ez.contract.easier = true; toReview(ez, 8); const keepO = ez.pending.offers.find((o) => o.keep); if (keepO) { C.acceptOffer(ez, keepO.id, avail); assert.equal(ez.contract.easier, true, 'easier targets last the whole contract'); }

  // ---- weeks: 10 rounds make 21 weeks, every round has a race week, the market sits after the middle round, the review last
  const wk = signed(110), W = wk.season.weeks;
  assert.equal(W.length, 21); assert.equal(R.buildWeeks(Array(8).fill({})).length, 17); assert.deepEqual(W.map((x) => x.week), W.map((_, i) => i + 1));
  assert.deepEqual(W.filter((x) => x.kind === 'race').map((x) => x.round), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); assert.equal(W[10].kind, 'market', 'the market sits after Tour 4, before the India Open'); assert.equal(W.at(-1).kind, 'end'); assert.equal(W[0].kind, 'pre');
  assert.equal(wk.clock.week, 0); assert.equal(C.currentWeek(wk).kind, 'pre'); assert.equal(C.sideSpec(wk).kind, 'test', 'pre-season is a test day');
  // a race week does not advance until it is raced; a race moves on by itself
  assert.ok(C.advanceWeek(wk).ok); assert.equal(C.currentWeek(wk).kind, 'race'); assert.equal(C.advanceWeek(wk).ok, false, 'a race week ends with the race'); assert.equal(C.sideSpec(wk), null, 'no event in a race week');
  round(wk, 4); assert.equal(wk.clock.week, 2); assert.equal(W[1].result.finish, 4, 'the calendar keeps the result'); assert.equal(C.currentWeek(wk).kind, 'open');
  // events: distinct kinds, the team's favourite first; one try; gold on a test day is a free upgrade level; a sponsor pays by tier and form; skipped stays skipped
  const spec = C.sideSpec(wk); assert.equal(spec.kind, 'test', "Mojave's favourite is the test day"); assert.equal(spec.weather, 'dry'); assert.equal(spec.track, C.currentRound(wk).track, "it runs at the next round's circuit");
  const gold = C.finishSide(wk, spec.par * 1.001); assert.equal(gold.medal, 3); assert.equal(gold.package, 1); assert.equal(C.sideSpec(wk), null, 'one try'); assert.equal(C.finishSide(wk, 1), null);
  C.advanceWeek(wk); round(wk, 4); const nxt = C.currentWeek(wk); assert.equal(nxt.kind, 'open'); const sp2 = C.sideSpec(wk); assert.equal(sp2.kind, 'sponsor', 'then the other kind');
  const before2 = wk.wallet.coins, medal = C.finishSide(wk, 26000); assert.equal(medal.medal, 2); assert.ok(medal.coins > 0); assert.equal(wk.wallet.coins, before2 + medal.coins); assert.equal(medal.xp, R.TUNING.side.xp[1]);
  const nope = signed(111); C.advanceWeek(nope); round(nope, 4); assert.equal(C.finishSide(nope, null).medal, 0, 'no valid lap, no medal');
  const qd = signed(112); C.finishQuali(qd, 90); assert.equal(qd.season.weeks[0].event.skipped, true, 'qualifying skips what is still open'); assert.equal(C.currentWeek(qd).kind, 'race');
  // the inbox: every change leaves a line, unread until opened, and it never grows without limit
  assert.ok(qd.inbox.some((m) => /Race week/.test(m.title))); const n0u = C.unread(qd); assert.ok(n0u > 0); C.markRead(qd, qd.inbox.find((m) => !m.read).id); assert.equal(C.unread(qd), n0u - 1); assert.ok(qd.inbox.find((m) => /Race week/.test(m.title)).read, 'what was just seen on Home does not nag');
  const big = signed(120); toReview(big, 4); assert.ok(big.inbox.some((m) => /Round 1/.test(m.title)), 'a race report is posted'); assert.ok(big.inbox.some((m) => /is over/.test(m.title))); assert.ok(big.inbox.length <= 50);

  // ---- bugs from the 2026-11-02 audit
  assert.equal(C.newCareer({ name: 'Quincy Valois', seed: 1, now: 'x' }).player.code, 'QVA', 'a player never shares a code with a driver');
  assert.equal(C.newCareer({ name: 'Valois', seed: 1, now: 'x' }).player.code, 'VAX', 'one name works too');
  { // the hour of a round: an even chance of each look the circuit offers, none it does not; the finale keeps its hour
    const seen = {}; for (let i = 0; i < 3000; i++) for (const r of R.buildCalendar(i, 1, 1, { ...avail, infinia: null })) if (!r.finale) (seen[r.track] ??= {})[r.look] = (seen[r.track][r.look] ?? 0) + 1;
    assert.deepEqual(Object.keys(seen.shajawa).sort(), ['day', 'dusk'], 'a day-and-dusk track stays day and dusk');
    assert.deepEqual(Object.keys(seen.india).sort(), ['bluehour', 'day', 'dusk', 'night'], 'a track with no `times` runs at all four');
    for (const t of ['shajawa', 'india']) { const n = Object.values(seen[t]), even = n.reduce((a, b) => a + b, 0) / n.length; assert.ok(n.every((x) => Math.abs(x - even) < even * 0.25), `${t} looks are even: ${JSON.stringify(seen[t])}`); }
  }
  const dn = signed(121); C.finishQuali(dn, 999); const dg = dn.season.current.quali.grid, dh = dn.contract.car, dr2 = C.finishRace(dn, { order: dg, best: Object.fromEntries(dg.map((k) => [k, k === dh ? 60 : 70])), dnf: true });
  assert.equal(dr2.entries.find((e) => e.you).pts, 0, 'a retirement scores no fastest-lap point'); assert.equal(dr2.fastest, false);
  assert.ok(C.standings(dn).drivers.length >= 1); const rv = signed(122); toReview(rv, 4); assert.equal(rv.pending.review.driverCount, C.standings(rv).drivers.length, 'the review knows how many drivers scored');
  const lapse = signed(123); const mo = { id: 'x-mid', team: 'toro', seat: 'B', car: 'huracan', tier: 'maestro', status: 'junior', salary: 500, signing: 1000, seasons: 2, why: 'x', w1: true };
  while (C.currentWeek(lapse).kind !== 'market') { if (C.currentWeek(lapse).kind === 'race') round(lapse, 4); else C.advanceWeek(lapse); }
  lapse.season.mid.push(mo); assert.ok(C.advanceWarnings(lapse).some((t) => /lapse/.test(t)), 'Advance warns first'); C.advanceWeek(lapse); assert.deepEqual(lapse.season.mid, []); assert.ok(lapse.inbox.some((m) => /lapsed/.test(m.title)), 'an unanswered offer never just disappears');

  // ---- negotiation as a flow: patience, the push gauge, walking away, signing bonus, your own team
  const fl = C.newCareer({ seed: 124, now: 'x' }); C.finishShootout(fl, null); const f0 = fl.pending.offers[0], open0 = C.openingAsk(f0);
  assert.equal(C.pushOf(fl, f0, open0).label, 'As offered'); assert.equal(C.patienceOf(f0), 3); assert.ok(C.leversOf(f0).signing.length > 1);
  assert.equal(C.pushOf(fl, f0, { ...open0, salary: 0.3, signing: 0.5, status: 'second' }).label, 'Unrealistic');
  const sg0 = f0.signing; assert.equal(C.negotiate(fl, f0.id, { ...open0, signing: 0.25 }).result, 'accepted'); assert.equal(f0.signing, Math.round(sg0 * 1.25 / 50) * 50, 'the signing bonus is a lever'); assert.ok(f0.log.length >= 2, 'the conversation is kept');
  const f1 = fl.pending.offers[1]; assert.equal(C.negotiate(fl, f1.id, { salary: 0.3, signing: 0.5, seasons: 1, status: 'second' }).result, 'countered'); assert.equal(C.patienceOf(f1), 1, 'an unrealistic ask costs twice the patience');
  assert.equal(C.negotiate(fl, f1.id, f1.counter).result, 'accepted', 'their counter is always signable');
  const f2 = fl.pending.offers[2]; assert.ok(C.walkAway(fl, f2.id)); assert.ok(!fl.pending.offers.includes(f2)); assert.equal(fl.world.teams[f2.team].declined, 1); assert.ok(fl.inbox.some((m) => /turned/.test(m.title)));
  fl.pending.offers.length = 0; assert.ok(C.walkAway(fl, 'nope') === false);
  const ow = signed(125); toReview(ow, 4, 1); ow.contract.seasonsLeft = 1; ow.pending.offers = [{ id: 'own', team: 'mojave', seat: 'B', car: 'bmw1', tier: 'rookie', status: 'junior', salary: 300, signing: 0, seasons: 2, interest: -1 }]; const tr0 = ow.contract.trust;
  assert.equal(C.negotiate(ow, 'own', { salary: 0.3, signing: 0, seasons: 2, status: 'junior' }).result, 'countered'); assert.ok(ow.contract.trust < tr0, 'haggling with your own team costs trust');

  // ---- review findings: a free level already earned carries over; a team with an offer on the table is not knocked on again; sponsors from the market lapse soon after it; the season end closes the rest
  const pk = signed(133); pk.garage.package = 2; toReview(pk, 4, 1); pk.contract.trust = 10; const keep1 = pk.pending.offers.find((o) => o.keep) ?? pk.pending.offers.at(-1); C.acceptOffer(pk, keep1.id, avail); assert.equal(pk.garage.package, 2, 'unspent levels are not lost');
  const dup = signed(134); toReview(dup, 4, 1); dup.pending.offers.push({ id: 'd', team: 'toro', seat: 'B', car: 'huracan', tier: 'maestro', status: 'junior', salary: 500, signing: 0, seasons: 2 }); assert.equal(C.teamOutlook(dup, 'toro').blocked, 'Offer on the table');
  let spMk = null; for (let i = 800; i < 860 && !spMk; i++) { const a = signed(i); C.advanceWeek(a); while (C.currentWeek(a).kind !== 'market') { if (C.currentWeek(a).kind === 'race') round(a, 8); else C.advanceWeek(a); } if (a.sponsors.offers.some((o) => o.expires > a.clock.week)) spMk = a; }
  assert.ok(spMk, 'the market brings new sponsors'); const lateO = spMk.sponsors.offers.find((o) => o.expires > spMk.clock.week); assert.equal(lateO.expires, spMk.clock.week + 2); assert.equal(spMk.season.weeks[lateO.expires].kind, 'open', 'and they lapse in the next open week');
  const endM = signed(135); endM.season.mid.push({ id: 'e', team: 'toro', seat: 'B', car: 'huracan', tier: 'maestro', status: 'junior', salary: 500, signing: 0, seasons: 2, expires: -1 }); toReview(endM, 4); assert.deepEqual(endM.season.mid, [], 'the season end closes what is left'); assert.ok(endM.inbox.some((m) => /lapsed/.test(m.title)));

  // ---- team moves: the market week or the season end only, one knock per team, an honest no
  const ap = signed(126); assert.equal(C.approach(ap, 'toro').result, 'closed', 'not outside the market'); assert.equal(C.teamOutlook(ap, 'toro').blocked, 'Market closed'); assert.match(C.teamOutlook(ap, 'toro').why, /Reputation/);
  toReview(ap, 4); const no = C.approach(ap, 'aurum'); assert.ok(['closed', 'no'].includes(no.result)); ap.career.rep = 500; ap.career.rr = [8, 8, 8, 8, 8, 8]; ap.career.cl = 12; const yes = C.approach(ap, 'toro'); assert.ok(['offer', 'no'].includes(yes.result)); assert.equal(C.approach(ap, 'toro').result, 'closed', 'one knock a window');
  let offered = null; for (let i = 700; i < 760 && !offered; i++) { const a = signed(i); toReview(a, 4); a.career.rep = 500; a.career.rr = [8, 8, 8, 8, 8, 8]; a.career.cl = 12; const n = a.pending.offers.length, q = C.approach(a, 'sarab'); if (q.result === 'offer') { offered = a; assert.equal(a.pending.offers.length, n + 1); } }
  assert.ok(offered, 'a knock can bring an offer');
  const probation = signed(127); while (C.currentWeek(probation).kind !== 'market') { if (C.currentWeek(probation).kind === 'race') round(probation, 4); else C.advanceWeek(probation); } assert.match(C.teamOutlook(probation, 'toro').blocked, /Probation/, 'not in the first season');

  // ---- sponsors: offers in pre-season, a slot per tier, a retainer every round, a bonus on the target, consequences for no-shows
  const sp = signed(128), so = sp.sponsors.offers; assert.equal(so.length, R.SPONSORS.offersPerWindow); assert.ok(so.every((o) => R.SPONSORS.brands[o.brand].tier === 'rookie')); assert.ok(so[0].expires === sp.season.weeks.findIndex((x) => x.kind === 'market'));
  const so0 = so[0], ret = so0.retainer; assert.equal(C.negotiate(sp, so0.id, { retainer: 0.15, bonus: 0 }).result, 'accepted'); assert.equal(so0.retainer, Math.round(ret * 1.15 / 5) * 5); assert.ok(C.signSponsor(sp, so0.id).ok); assert.deepEqual(sp.sponsors.offers, [], 'one slot at Rookie: the other sponsor moves on'); assert.ok(sp.inbox.some((m) => /moved on/.test(m.title))); assert.equal(C.signSponsor(sp, 'nope').reason, 'gone');
  const full = signed(132), fo = full.sponsors.offers[0]; full.sponsors.deals.push({ brand: 'x', name: 'X', retainer: 1, bonus: 1, target: { kind: 'win', count: 1 }, progress: 0, met: false, mood: 2 }); assert.equal(C.signSponsor(full, fo.id).reason, 'slots', 'no free slot, no signing');
  const cash0 = sp.wallet.coins, deal = sp.sponsors.deals[0]; deal.target = { kind: 'top', n: 8, count: 1 }; const rr0 = round(sp, 4); assert.ok(rr0.coinLines.some(([l]) => /retainer/.test(l))); assert.ok(rr0.coinLines.some(([l]) => /bonus/.test(l)), 'the target pays'); assert.ok(deal.met); assert.equal(sp.wallet.coins, cash0 + rr0.coins);
  const rr1 = round(sp, 4); assert.ok(!rr1.coinLines.some(([l]) => /bonus/.test(l)), 'once');
  const sk = signed(129), so1 = sk.sponsors.offers[0]; C.signSponsor(sk, so1.id); assert.ok(sk.sponsors.deals.length); sk.sponsors.deals[0].mood = 1; C.advanceWeek(sk); round(sk, 4); const wS = sk.season.weeks.find((x, i) => i >= sk.clock.week && x.event?.kind === 'sponsor'); while (C.currentWeek(sk) !== wS) { if (C.currentWeek(sk).kind === 'race') round(sk, 4); else C.advanceWeek(sk); }
  assert.ok(C.advanceWarnings(sk).some((t) => /ends your deal/.test(t)), 'on the last of the goodwill, Advance says the deal ends'); sk.sponsors.deals[0].mood = 2; assert.ok(C.advanceWarnings(sk).some((t) => /goodwill/.test(t))); sk.sponsors.deals[0].mood = 1; const repS = sk.career.rep; C.advanceWeek(sk); assert.deepEqual(sk.sponsors.deals, [], 'out of goodwill, the deal ends'); assert.equal(sk.career.rep, Math.max(0, repS + R.TUNING.sponsors.droppedRep));
  assert.equal(C.eventName(sk, { kind: 'open', event: { kind: 'sponsor' } }), 'Team drift day');

  // ---- migration: a P1 save gets the seat map, and an unknown schema is not guessed at
  const old = signed(113); delete old.world.seats; delete old.world.free; delete old.world.retired; delete old.world.academy; delete old.career.heat; delete old.garage.package; old.schema = 1;
  const mig = C.migrate(old); assert.equal(mig.schema, C.SCHEMA); assert.equal(mig.world.seats.bmw1, 'YOU'); assert.deepEqual(mig.world.free, ['QUI']); assert.deepEqual(mig.career.heat, {});
  assert.equal(C.migrate({ schema: 99 }), null); assert.equal(C.migrate(null), null);
  const v3 = signed(130); round(v3, 3); round(v3, 3); v3.schema = 3; delete v3.inbox; delete v3.inboxN; delete v3.sponsors; delete v3.clock.week; const wo3 = { id: 'o', team: 'toro', seat: 'B', car: 'huracan', tier: 'maestro', status: 'junior', salary: 500, signing: 1000, seasons: 2, why: 'x' };
  delete v3.season.weeks; delete v3.season.mid; delete v3.season.asked; v3.season.w1 = { offer: wo3, state: 'open' }; v3.season.current.side = { kind: 'test', result: null }; v3.season.calendar[4].track = 'infinia'; v3.season.calendar[4].look = 'night'; v3.player.code = 'VAL';
  C.migrate(v3); assert.equal(v3.schema, C.SCHEMA); assert.equal(C.currentWeek(v3).kind, 'race'); assert.equal(C.currentWeek(v3).round, v3.clock.round, 'a season under way lands on its round'); assert.equal(v3.season.weeks[1].result.finish, 3, 'the rounds raced are on the calendar');
  assert.equal(v3.season.mid[0].id, 'o', 'an open offer survives'); assert.equal(v3.season.w1, undefined); assert.equal(v3.season.current.side, undefined); assert.equal(v3.season.calendar[4].look, 'dusk'); assert.notEqual(v3.player.code, 'VAL'); assert.deepEqual(v3.sponsors, { deals: [], offers: [] }); assert.ok(v3.inbox.length);
  C.finishQuali(v3, 60); assert.ok(C.finishRace(v3, { order: v3.season.current.quali.grid, best: {} }).rr, 'and it plays on');
  const v3r = signed(131); toReview(v3r, 3); v3r.schema = 3; delete v3r.season.weeks; delete v3r.clock.week; delete v3r.sponsors; delete v3r.inbox; C.migrate(v3r); assert.equal(C.currentWeek(v3r).kind, 'end', 'a save at the review stays there'); C.acceptOffer(v3r, v3r.pending.offers[0].id, avail); assert.equal(v3r.clock.season, 2);

  // ---- the Ultrack Ranking: seeded from the ratings, the player below the field, points by place and event, a rolling window, carried across seasons
  { const K = await server.ssrLoadModule('/src/game/career/ranking.js'), s = signed(300), r0 = K.rankingOf(s);
    assert.equal(r0.length, 16); assert.equal(r0[0].code, Object.entries(s.world.ratings).sort((a, b) => b[1] - a[1])[0][0], 'the best-rated driver starts first'); assert.equal(r0.at(-1).code, 'YOU', 'the player starts at the bottom'); assert.deepEqual(r0.map((x) => x.rank), [...Array(16).keys()].map((i) => i + 1));
    assert.equal(K.rankPoints(0, 'tour'), 25); assert.equal(K.rankPoints(0, 'open'), 62.5); assert.equal(K.rankPoints(0, 'masters'), 75); assert.equal(K.rankPoints(9, 'tour'), 0);
    const w = R.TUNING.ranking.window, t = signed(301); const r1 = K.playerRank(t); K.addDay(t, { YOU: 100 }); assert.ok(K.playerRank(t) < r1, 'a big day lifts the player');
    for (let i = 0; i < w; i++) K.addDay(t, {}); assert.equal(t.ranking.days.length, w, 'only the last window of days is kept'); assert.equal(K.rankingOf(t).find((x) => x.you).pts, 0, 'the day fell out of the window, and the seed has faded');
    const a = signed(302); round(a, 1, 1); assert.ok(K.rankingOf(a).find((x) => x.you).pts >= 25, 'a win scores ranking points'); assert.equal(a.ranking.n, 1); }

  // ---- the Open: the top 4 go straight to the Final; ranks 5-16 fly one lap at Dry Lake, race the Last Chance there, and its top 4 reach the Final
  { const OPENCIRCUITS = ['tokyo', 'infinia', 'venice'], toRound = (s, kind) => { while (C.currentRound(s).kind !== kind) round(s, 4, 999); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); return s; };
    // seeded: rank 1, no qualifying, the Final is the only race
    const top = signed(310); round(top, 4, 999); top.ranking.seed.YOU = 1e5; round(top, 4, 999); assert.equal(C.currentRound(top).kind, 'open', 'round 3 is the Japan Open'); assert.equal(top.season.current.open.rank, 1, 'rank is taken when the round is prepared');
    while (C.currentWeek(top).kind !== 'race') C.advanceWeek(top);
    const co = top.season.current.open, q = top.season.current.quali; assert.equal(co.seeded, true); assert.equal(co.stage, 'final'); assert.equal(top.clock.phase, 'race', 'no qualifying for a seed');
    assert.equal(q.grid.length, 8); assert.equal(q.order.length, 16); assert.equal(new Set(q.order).size, 16); assert.equal(q.grid[0], top.contract.car, 'the ranking leader starts on pole'); assert.deepEqual(q.grid.slice(0, 4), co.seeds, 'the seeds start first, in ranking order');
    assert.deepEqual(q.grid.slice(4), co.lcq.through, 'then the Last Chance finishers in the order they finished'); assert.ok(C.retriesLeft(q) === 0); assert.equal(C.finishQuali(top, 1), top, 'a seed has no qualifying to fly');
    const setup = C.raceSetup(top); assert.equal(setup.track, 'tokyo'); assert.equal(setup.laps, C.currentRound(top).laps); assert.equal(setup.label, 'Japan Open Final'); assert.equal(setup.racers.length, 8); assert.deepEqual(setup.gridOrder, q.grid);
    assert.equal(C.practiceLocked(top), null, 'practice opens at the Final'); assert.ok(top.inbox.some((m) => /Last Chance Qualifier/.test(m.title)), 'the inbox says who got through');
    const day = top.wallet.coins, won = round(top, 1), win = won.coinLines.find(([l]) => l === 'Win bonus')[1];
    assert.equal(won.kind, 'open'); assert.equal(won.finish, 1); assert.equal(win, R.TIERS.tiers.rookie.bonus.win * 3, 'a Final pays three times the win bonus'); assert.ok(won.rank.after <= won.rank.before && won.rank.pts === 62.5, 'and a big ranking swing');
    assert.equal(top.stats.openWins.tokyo, 1); assert.equal(top.hall.at(-1).you, true); assert.equal(top.hall.at(-1).id, 'tokyo'); assert.equal(won.entries[0].pts, 25 * 1.5 + 2 + 1, 'the Final scores x1.5 in the season table, with pole and the fastest lap'); assert.ok(top.wallet.coins > day);
    assert.ok(won.rr >= 7, 'a win from pole in a decent car rates well: a seed is not marked down for skipping qualifying'); assert.ok(won.rrLines.some(([l]) => /Skipped qualifying on merit/.test(l)));

    // not seeded: qualifying at Dry Lake among the twelve, the fastest 8 race the Last Chance there, the top 4 reach the Final
    const mid = signed(311); toRound(mid, 'open'); const o = mid.season.current.open; assert.equal(o.seeded, false); assert.equal(o.stage, 'quali'); assert.equal(mid.clock.phase, 'paddock'); assert.ok(o.rank >= 5);
    assert.equal(C.practiceLocked(mid), 'The Japan Open circuit stays fresh until the Final.'); assert.equal(mid.season.current.objectives[0].kind, 'reach'); assert.equal(R.objectiveText(mid.season.current.objectives[0]), 'Reach the Japan Open Final');
    assert.equal(C.qualiVenue(mid).track, 'drylake'); C.finishQuali(mid, 1); const mq = mid.season.current.quali; assert.equal(o.stage, 'lcq'); assert.equal(mq.order.length, 12, 'twelve fly a lap'); assert.ok(o.seeds.every((k) => !mq.order.includes(k)), 'the seeds do not'); assert.equal(mq.grid.length, 8);
    assert.equal(mq.order[0], mid.contract.car, 'a lap of 1 s is the fastest'); assert.equal(C.retriesLeft(mq), 1, 'qualifying keeps its retry');
    const ls = C.raceSetup(mid); assert.equal(ls.track, 'drylake'); assert.equal(ls.laps, C.currentRound(mid).lcqLaps); assert.equal(ls.label, 'Last Chance Qualifier'); assert.equal(ls.racers.length, 8); assert.ok(ls.laps >= 2 && ls.laps <= 3);
    const lcq = C.finishLcq(mid, { order: [mid.contract.car, ...mq.grid.filter((k) => k !== mid.contract.car)], best: {} }); assert.equal(lcq.lcq, true); assert.equal(lcq.through, true); assert.equal(lcq.finish, 1); assert.equal(lcq.entries.filter((e) => e.advanced).length, 4);
    const fq = mid.season.current.quali; assert.equal(o.stage, 'final'); assert.equal(fq.grid.length, 8); assert.deepEqual(fq.grid.slice(0, 4), o.seeds); assert.equal(fq.grid[4], mid.contract.car, 'he won the Last Chance: first of the qualifiers, behind the four seeds'); assert.equal(fq.order.length, 16); assert.equal(new Set(fq.order).size, 16); assert.equal(mid.clock.phase, 'race');
    assert.equal(C.raceSetup(mid).track, 'tokyo'); assert.equal(C.practiceLocked(mid), null); const wk1 = mid.clock.week, fin = round(mid, 5); assert.equal(fin.kind, 'open'); assert.equal(fin.dnq, false); assert.equal(fin.open.lcq, 1); assert.ok(fin.objectives[0].met, 'Reach the Final is met'); assert.ok(mid.clock.week > wk1, 'and the season moves on');

    // beaten in the Last Chance (or retired in it): the Final runs without him, the round is scored as a missed cut, the season goes on
    for (const dnf of [false, true]) {
      const out = signed(312 + +dnf); toRound(out, 'open'); C.finishQuali(out, 1); const oq = out.season.current.quali, me = out.contract.car, rival = oq.grid.filter((k) => k !== me), wk0 = out.clock.week, st0 = out.stats.starts;
      const rep = C.finishLcq(out, { order: [...rival, me].slice(0, 8), best: {}, dnf }); assert.notEqual(rep.lcq, true, 'out of the Last Chance, the report is the round\'s'); assert.equal(rep.dnq, true); assert.equal(rep.lcq.through, false); assert.equal(rep.lcq.finish, 8);
      assert.equal(rep.entries.filter((e) => !e.dnq).length, 8); assert.ok(rep.entries.slice(0, 8).every((e) => !e.you)); assert.equal(out.stats.starts, st0); assert.ok(out.clock.week > wk0, 'it does not dead-end the season'); assert.equal(out.clock.phase, 'paddock');
      assert.equal(rep.rank.pts, 0); assert.ok(out.hall.at(-1) && !out.hall.at(-1).you, 'a rival wins the Open and the hall says so'); assert.ok(out.media.some((m) => /misses the Japan Open Final/.test(m.title)), 'the press covers it'); assert.ok(!rep.objectives[0].met);
    }
    // missed the cut in qualifying, and sat out
    const cut = signed(314); toRound(cut, 'open'); C.finishQuali(cut, 999); assert.ok(!cut.season.current.quali.grid.includes(cut.contract.car)); const dq = C.finishDnq(cut); assert.equal(dq.dnq, true); assert.equal(dq.entries.filter((e) => !e.dnq).length, 8); assert.equal(cut.clock.phase, 'paddock');
    // never flew a lap and the game reloaded into a race: it still resolves
    const lost = signed(315); toRound(lost, 'open'); assert.equal(C.finishRace(lost, { order: [], best: {} }).dnq, true);
    const lr = lost.season.results.at(-1); assert.equal(lr.trust, Math.round((lr.rr - R.TUNING.rating.base) * R.TUNING.trust.perRR), 'missing an Open costs trust only through the rating: the ranking decides its objective');
  }

  // ---- the Masters: the top 8 of the ranking, Marina at night; outside them it runs without you
  { const toMasters = (s) => { while (C.currentRound(s).kind !== 'masters') round(s, 3, 999); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); return s; };
    const ins = signed(320); ins.ranking.seed.YOU = 1e6; ins.ranking.n = 0; toMasters(ins); const mo = ins.season.current.open; assert.equal(mo.kind, 'masters'); assert.equal(mo.seeds.length, 8); assert.equal(mo.stage, 'final'); assert.equal(ins.season.current.quali.grid.length, 8);
    assert.equal(ins.season.current.quali.grid[0], ins.contract.car, 'the leader of the ranking starts on pole'); const ms = C.raceSetup(ins); assert.equal(ms.track, 'marina'); assert.equal(ms.look, 'night'); assert.equal(ms.label, 'Ultrack Masters'); assert.equal(C.practiceLocked(ins), null, 'the Masters is a Tour circuit: practice stays open');
    const mrep = round(ins, 1); assert.equal(mrep.kind, 'masters'); assert.equal(mrep.rank.pts, 75, 'the Masters is the biggest ranking day'); assert.equal(ins.stats.masters, 1); assert.equal(ins.hall.at(-1).id, 'masters'); assert.equal(ins.clock.phase, 'review', 'the Masters closes the season');
    const o2 = signed(322); o2.ranking.seed.YOU = -1e6; toMasters(o2); assert.equal(o2.season.current.open.seeded, false); assert.ok(!o2.season.current.quali.grid.includes(o2.contract.car), 'outside the top 8: not on the grid'); assert.equal(C.retriesLeft(o2.season.current.quali), 0, 'and no retry to find a place');
    const mr = C.finishDnq(o2); assert.equal(mr.dnq, true); assert.equal(o2.clock.phase, 'review', 'the season still ends'); assert.ok(o2.pending.offers.length >= 1); }

  // ---- fair play with the calendar: no test or sponsor day on an Open circuit, every Open circuit raced only in an Open, the Tour with no Open in it; labels
  { const s = signed(330), seen = { events: [], race: [] };
    while (s.clock.phase !== 'review') {
      const w = C.currentWeek(s);
      if (w.kind === 'race') { seen.race.push(C.currentRound(s).track + ':' + C.currentRound(s).kind); round(s, 4, 999); continue; }
      if (w.event) { const sp = C.sideSpec(s); assert.ok(sp && !['tokyo', 'infinia', 'venice'].includes(sp.track), `an event on ${sp?.track}`); seen.events.push(sp.track); assert.ok(!['tokyo', 'infinia', 'venice'].includes(C.roundOfWeek(s, s.clock.week).track), 'the Calendar shows the same circuit'); }
      C.advanceWeek(s);
    }
    assert.ok(seen.events.length >= 7); assert.deepEqual(seen.race.filter((x) => /:open/.test(x)).map((x) => x.split(':')[0]), ['tokyo', 'infinia', 'venice']); assert.ok(seen.race.filter((x) => /:tour/.test(x)).every((x) => !['tokyo', 'infinia', 'venice'].includes(x.split(':')[0])), 'the Opens are raced nowhere else');
    assert.equal(s.history.at(-1).rank >= 1, true); assert.ok(s.pending.review.rank >= 1, 'the review knows the ranking'); }

  // ---- the Triple Crown and the Grand Slam are kept in save.stats, rivals win Opens too, the hall is bounded
  { const s = signed(340); s.ranking.seed.YOU = 1e6; s.ranking.n = 0; const wins = [];
    while (s.clock.phase !== 'review') { const rep = round(s, 1, 1); if (rep.kind === 'open') wins.push(rep.honours); }
    assert.deepEqual(s.stats.openWins, { tokyo: 1, infinia: 1, venice: 1 }); assert.deepEqual(wins, [[], [], ['triple', 'slam']], 'the third Open completes both'); assert.equal(s.stats.slams, 1, 'all three in one season is a Grand Slam'); assert.equal(s.stats.triple, 1, 'and the Triple Crown, first completed in season 1');
    assert.equal(s.stats.masters, 1); assert.equal(s.hall.filter((h) => h.you).length, 4); assert.equal(s.history.at(-1).opens.length, 3); assert.ok(s.media.some((m) => /Triple Crown/.test(m.title)) && s.media.some((m) => /Grand Slam/.test(m.title)));
    s.hall.push(...Array(70).fill({ season: 9, id: 'tokyo', who: 'x' })); const nx = signed(341); nx.hall = s.hall; while (nx.season.current.open?.kind !== 'open') round(nx, 4, 999); round(nx, 4, 999); assert.ok(nx.hall.length <= 60, 'the hall of winners stays bounded'); }

  // ---- an old save: schema 4 gets the ranking and the records, and a season under way finishes on the rounds it rolled (no Opens, no Last Chance)
  { const s = signed(350), cal = s.season.calendar; cal.forEach((r) => { delete r.kind; delete r.lcqLaps; r.event = 'sprint'; }); round(s, 3, 1); delete s.season.current.open;
    s.schema = 4; delete s.ranking; delete s.hall; for (const k of ['openWins', 'masters', 'triple', 'slams']) delete s.stats[k];
    C.migrate(s); assert.equal(s.schema, 6); assert.equal(s.ranking.n, 0); assert.deepEqual(s.hall, []); assert.deepEqual(s.stats.openWins, { tokyo: 0, infinia: 0, venice: 0 }); assert.equal(C.rankingOf(s).length, 16);
    for (let i = 0; i < 4; i++) { const rep = round(s, 3, 1); assert.equal(rep.kind, 'tour', 'an old round plays as a Tour round'); assert.ok(!s.season.current.open); }
    assert.equal(s.ranking.n, 4, 'and still scores the ranking'); toReview(s, 3, 1); assert.equal(s.season.results.length, 10); assert.equal(s.clock.phase, 'review');
    assert.equal(R.pointsMult({ finale: true }), 1.5); assert.equal(R.pointsMult({ kind: 'tour' }), 1); assert.equal(R.pointsMult({ kind: 'open' }), 1.5); }

  // ---- whole careers through the new format never dead-end, and the same seed replays the same Opens
  { const a = play(M, 19, 1.0, 3), b = play(M, 19, 1.0, 3); assert.equal(JSON.stringify(a.save), JSON.stringify(b.save)); assert.ok(a.save.hall.length >= 9, 'four winners a season are remembered'); assert.ok(a.log.rr.length >= 27, 'every round of every season was rated');
    for (const skill of [0.96, 1.0, 1.03]) for (let i = 0; i < 6; i++) { const { log, save } = play(M, 700 + i, skill, 3); assert.ok(log.minWallet >= 0 && log.offers.every((n) => n >= 1), 'no dead end'); assert.ok(save.hall.every((h) => h.who), 'every winner has a name'); } }

  // ---- running costs: repairs from crash speed, five upgrade categories, staff (Part 2)
  { assert.equal(R.hitBill(100, 'bmw1'), 400, 'about 400 for a 100 km/h hit in a mid-class car'); assert.equal(R.hitBill(49, 'bmw1'), 0, 'a scrape or light contact is free'); assert.equal(R.hitBill(0, 'bmw1'), 0);
    assert.ok(R.hitBill(160, 'bmw1') > R.hitBill(100, 'bmw1') && R.hitBill(100, 'destrier') > R.hitBill(100, 'bmw1') && R.hitBill(100, 'nissan-z') < R.hitBill(100, 'bmw1'), 'faster hits and bigger cars cost more');
    assert.deepEqual(R.repairBill([100, 100, 30], 'bmw1', 0, 5000), { bill: 800, raw: 800, hits: 2, capped: false });
    assert.equal(R.repairBill([100, 100], 'bmw1', 0.25, 5000).bill, 600, 'the crew takes its share'); assert.deepEqual(R.repairBill([200, 200], 'bmw1', 0, 1000), { bill: 400, raw: 3200, hits: 2, capped: true }, 'never more than 40 % of the pay');
    assert.equal(R.repairBill([250], 'bmw1', 0, 0).bill, 0, 'a round that paid nothing bills nothing');
    // stock par laps do not move, and a dev of 0 means no Aero; the Aero a team wears follows its development levels
    const base = R.CAL.tracks.india.parLap * (1 - R.TUNING.pace.carZ * R.TIERS.carZ.bmw1); assert.equal(R.parLap('india', 'bmw1'), base); assert.equal(R.parLap('india', 'bmw1', 'dry', [0, 0, 0]), base); assert.equal(R.parLap('india', 'bmw1', 'dry', [0, 0, 0, 0]), base);
    assert.ok(Math.abs(R.parLap('india', 'bmw1', 'dry', [1, 1, 1]) / base - (1 - 0.01 - R.TUNING.pace.perAeroLevel)) < 1e-12, 'a team at dev 1 wears Aero 1'); assert.ok(R.parLap('india', 'bmw1', 'dry', [1, 1, 1, 3]) < R.parLap('india', 'bmw1', 'dry', [1, 1, 1, 0]), 'bought Aero speeds the player');
    assert.equal(R.aeroOf([2, 2, 1]), 2); assert.equal(R.aeroOf([0, 0, 0]), 0);
    const E = await server.ssrLoadModule('/src/game/economy.js'); assert.deepEqual(E.levelsOf({ upgrades: { x: { engine: 2 } } }, 'x'), { engine: 2, tyres: 0, brakes: 0, aero: 0, nitro: 0 }, 'a category an old save lacks reads 0'); assert.equal(E.CATS.length, 5);
    assert.deepEqual(E.migrate({ upgrades: { x: { engine: 1, tyres: 9 } } }).upgrades.x, { engine: 1, tyres: 3, brakes: 0, aero: 0, nitro: 0 }); assert.equal([1, 2, 3].reduce((n, l) => n + E.costOf(600, l), 0) * E.CATS.length, 30000, 'maxing a mid-class car costs about 30,000');
    // a round's crashes: the weekend's qualifying hits and the race's are billed once, in What it paid
    const mk = (seed) => { const s = signed(seed); C.finishQuali(s, 1); s.wallet.coins = 800; return s; };
    const race = (s, hits) => { const hero = s.contract.car, o = s.season.current.quali.grid.filter((k) => k !== hero); o.splice(2, 0, hero); return C.finishRace(s, { order: o, best: {}, crashes: hits?.length ?? 0, spins: 0, hits }); };
    { const clean = race(mk(910)), s = mk(910); const rep = race(s, [30, 45]); assert.equal(rep.coins, clean.coins, 'scrapes and light contact are free'); assert.ok(!rep.coinLines.some((l) => /Repairs/.test(l[0]))); assert.equal(rep.repairs.hits, 0);
      const t = mk(910); C.logHits(t, [100]); const hit = race(t, [100, 20]), line = hit.coinLines.find((l) => /Repairs/.test(l[0])); const gross = clean.coinLines.reduce((a, l) => a + Math.max(0, l[1]), 0);
      assert.ok(line && line[1] === -Math.min(800, Math.floor(gross * 0.4 / 5) * 5), 'qualifying and race hits bill together as one negative line'); assert.equal(hit.coins, clean.coins + line[1]); assert.equal(hit.repairs.hits, 2);
      assert.equal(t.wallet.coins, 800 + hit.coins, 'the wallet moves by exactly what the report says'); assert.ok(t.wallet.coins >= 0);
      const big = mk(910); const b = race(big, [250, 250, 250]); assert.ok(b.repairs.capped && -b.coinLines.find((l) => /Repairs/.test(l[0]))[1] <= Math.floor(gross * 0.4 / 5) * 5 && big.wallet.coins > 800, 'a bad weekend is capped and still pays'); }
    // the Last Chance Qualifier: its crashes are logged, shown on its report and billed in the Open's round
    { const s = signed(920); while (s.season.current.open?.kind !== 'open') round(s, 4, 999); const hero = s.contract.car;
      if (s.season.current.open.stage === 'quali') C.finishQuali(s, 1); assert.equal(s.season.current.open.stage, 'lcq', 'a flying lap at Dry Lake puts the player in the Last Chance'); const q = s.season.current.quali, rl = C.finishLcq(s, { order: [hero, ...q.grid.filter((k) => k !== hero)].slice(0, 8), best: {}, hits: [120] });
      assert.equal(rl.lcq, true); assert.equal(rl.repairs.hits, 1); assert.equal(rl.repairs.raw, R.hitBill(120, hero)); assert.deepEqual(s.season.current.hits, [120]);
      const o = s.season.current.quali.grid.filter((k) => k !== hero); o.splice(2, 0, hero); const fin = C.finishRace(s, { order: o, best: {}, hits: [] }); assert.ok(fin.coinLines.some((l) => /Repairs/.test(l[0]) && l[1] < 0), 'billed with the Final'); assert.equal(fin.repairs.hits, 1); }
    { const s = signed(921); while (s.season.current.open?.kind !== 'open') round(s, 4, 999); assert.equal(s.season.current.hits, undefined, 'a new round starts with no crashes'); }
    // staff: unlocked by Career Level, paid up front, a discount this season only, kept across teams
    const s = signed(930); s.wallet.coins = 20000; s.career.cl = 2; assert.equal(C.staffInfo(s, 'crew-pro').reason, 'level'); assert.equal(C.staffInfo(s, 'nope').reason, 'unknown'); assert.equal(C.staffDiscount(s, 'crew'), 0);
    s.career.cl = 3; assert.ok(C.hireStaff(s, 'crew-pro').ok); assert.equal(s.wallet.coins, 18500); assert.equal(C.hireStaff(s, 'crew-pro').reason, 'hired', 'no double charge'); assert.equal(s.wallet.coins, 18500); assert.equal(C.staffInfo(s, 'crew-elite').reason, 'level');
    s.career.cl = 15; assert.ok(C.hireStaff(s, 'crew-factory').ok); assert.equal(C.staffInfo(s, 'crew-pro').reason, 'better', 'a lower tier is not hired over a higher one'); assert.equal(C.staffDiscount(s, 'crew'), 0.6); assert.equal(s.wallet.coins, 9500, 'no refund for the Pro crew');
    assert.equal(R.repairBill([100, 100], 'bmw1', C.staffDiscount(s, 'crew'), 9999).bill, 320);
    s.wallet.coins = 100; assert.equal(C.staffInfo(s, 'engineer-pro').reason, 'coins');
    const e = signed(931); e.wallet.coins = 20000; e.career.cl = 8; e.garage.package = 0; const list = C.upgradeInfo(e, 'aero', 503); assert.equal(list.cost, list.list); C.hireStaff(e, 'engineer-elite'); const disc = C.upgradeInfo(e, 'aero', 503); assert.equal(disc.cost, Math.round(list.list * 0.8 / 5) * 5); assert.equal(disc.list, list.list);
    const before = e.wallet.coins, b = C.buyUpgrade(e, 'aero', 503); assert.ok(b.ok && e.wallet.coins === before - disc.cost && e.garage.paid[e.contract.car] === disc.cost, 'upgrades are paid at the discount and the ledger keeps what was paid'); assert.equal(e.garage.upgrades[e.contract.car].aero, 1);
    assert.ok(C.buyUpgrade(e, 'nitro', 503).ok); assert.equal(C.buyUpgrade(e, 'nitro', 503).reason, 'cap', 'Nitro obeys the tier cap like the rest');
    const paid = e.garage.paid[e.contract.car]; assert.ok(paid > disc.cost); toReview(e, 8, 999); assert.equal(C.staffTier(e, 'engineer').id, 'elite', 'still hired until the season rolls'); const old = e.contract.car, offer = e.pending.offers.find((x) => x.car !== old) ?? e.pending.offers[0];
    C.acceptOffer(e, offer.id, avail); if (offer.car !== old) assert.equal(e.buyback, Math.round(paid * 0.6), 'parts sell back at 60 % of what was paid, discount included'); assert.equal(e.clock.season, 2); assert.equal(C.staffTier(e, 'engineer').id, 'basic', 'the contract ran out with the season'); assert.equal(e.staff.engineer.tier, 'elite', 'the record stays with the driver');
    e.wallet.coins = 20000; e.career.cl = 8; assert.ok(C.hireStaff(e, 'engineer-elite').ok, 'and can be hired again, on any team'); assert.equal(C.staffTier(e, 'engineer').id, 'elite');
    // an old save: staff appear, upgrade entries gain the new categories as 0, a season under way is untouched
    const o = signed(932); o.schema = 5; delete o.staff; o.garage.upgrades = { bmw1: { engine: 1, tyres: 0, brakes: 0 } }; C.migrate(o); assert.equal(o.schema, 6); assert.deepEqual(o.staff, { crew: null, engineer: null }); assert.deepEqual(o.garage.upgrades.bmw1, { engine: 1, tyres: 0, brakes: 0, aero: 0, nitro: 0 }); assert.equal(C.staffDiscount(o, 'crew'), 0);
    const o2 = signed(933); o2.garage.upgrades = { 'bmw1': { engine: 1 } }; assert.equal(C.upgradeInfo(o2, 'aero', 503).level, 0, 'a missing category reads 0 even before migration'); assert.equal(C.raceSetup(o2).levels('bmw1').aero, 0);
    // rivals wear Aero with their development; they have no Nitro bought
    const w = signed(934); C.finishQuali(w, 1); const lv = C.raceSetup(w).levels, rival = w.season.current.quali.grid.find((k) => k !== w.contract.car), dev = w.world.teams[R.CAR[rival].team].dev; assert.equal(lv(rival).aero, R.aeroOf(dev)); assert.equal(lv(rival).nitro, 0, 'rivals have no Nitro bought'); assert.deepEqual(Object.keys(lv(rival)).sort(), ['aero', 'brakes', 'engine', 'nitro', 'tyres'], 'every category is named, so a level left over from free play cannot leak to a rival'); }

  // ---- three save slots, each its own career, guarded when storage is missing
  const S = await server.ssrLoadModule('/src/game/career/save.js'), mem = {};
  assert.deepEqual(S.listCareers(), [null, null, null], 'no localStorage: empty slots, no throw');
  { const m2 = {}; globalThis.localStorage = { getItem: (k) => m2[k] ?? null, setItem: (k, v) => { m2[k] = v; } }; m2['ultrack.career.v1'] = JSON.stringify({ active: 0, slots: [{ schema: 99 }] }); assert.deepEqual(S.listCareers()[0], { unreadable: true }, 'a newer save is locked, not empty'); delete globalThis.localStorage; } assert.equal(S.saveCareer(signed(114)), false, 'and a failed write says so');
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const a0 = signed(115), a2 = signed(116); assert.ok(S.saveCareer(a0, 0)); assert.ok(S.saveCareer(a2, 2));
  assert.equal(S.activeSlot(), 2); assert.equal(S.loadCareer().seed, 116); assert.equal(S.loadCareer(0).seed, 115); assert.equal(S.activeSlot(), 0, 'loading a slot makes it active');
  assert.deepEqual(S.listCareers().map((x) => x?.seed ?? null), [115, null, 116]);
  S.saveCareer(null); assert.deepEqual(S.listCareers().map((x) => x?.seed ?? null), [null, null, 116], 'only the active slot is erased');
  mem['ultrack.career.v1'] = '{broken'; assert.equal(S.loadCareer(), null, 'a broken save reads as none');
  // two tabs share `active`: this tab's saves stay in this tab's slot
  S.saveCareer(a0, 0); S.saveCareer(a2, 1); S.loadCareer(0); { const d = JSON.parse(mem['ultrack.career.v1']); d.active = 1; mem['ultrack.career.v1'] = JSON.stringify(d); } S.saveCareer(a0);
  assert.deepEqual(S.listCareers().map((x) => x?.seed ?? null), [115, 116, null], 'the other tab changing the active slot does not redirect this tab');
  // a damaged save is listed as damaged, never thrown on; the good one beside it still loads
  mem['ultrack.career.v1'] = JSON.stringify({ active: 0, slots: [{ schema: C.SCHEMA }, a0, { schema: 1, player: { name: 'x' } }] });
  assert.deepEqual(S.listCareers()[0], { unreadable: true, damaged: true }); assert.equal(S.listCareers()[1].seed, 115); assert.deepEqual(S.listCareers()[2], { unreadable: true, damaged: true }); assert.equal(S.loadCareer(0), null); assert.equal(S.loadCareer(1).seed, 115);
  // a driver called mustang keeps the name; the car it means still moves on
  mem['ultrack.career.v1'] = JSON.stringify({ active: 0, slots: [{ ...a0, player: { ...a0.player, name: 'mustang' } }] }); S.loadCareer(0); assert.equal(S.loadCareer(0).player.name, 'mustang');
  mem['ultrack.career.v1'] = JSON.stringify({ active: 0, slots: [{ schema: C.SCHEMA, player: { name: 'mustang' }, clock: { season: 1 }, career: { cl: 1, rep: 0 }, contract: { car: 'mustang' } }] }); assert.equal(S.loadCareer().contract.car, 'ford-gt', 'a Mustang career moves to the Ford GT');
  // ---- the game closed mid-career: the next boot gives free play its own car and conditions back, before the circuit loads
  mem['ultrack.v1'] = JSON.stringify({ car: 'bmw1', settings: { track: 'india', look: 'day', weather: 'rain', laps: 8, master: 0.5 }, freePlay: { car: 'av12', track: 'marina', look: 'night', weather: 'dry', laps: 3 }, best: { 'marina/mustang': 90 }, upgrades: { mustang: { engine: 1 } } });
  const { store } = await server.ssrLoadModule('/src/game/store.js');
  assert.equal(store.data.car, 'av12'); assert.equal(store.settings.track, 'marina'); assert.equal(store.settings.look, 'night'); assert.equal(store.settings.weather, 'dry'); assert.equal(store.settings.laps, 3);
  assert.equal(store.data.best['marina/ford-gt'], 90, 'records and upgrades move from the Mustang to the Ford GT'); assert.equal(store.data.upgrades['ford-gt'].engine, 1);
  assert.equal(store.settings.master, 0.5, 'other settings are untouched'); assert.equal(store.data.freePlay, undefined, 'the snapshot is used up');
  assert.equal(JSON.parse(mem['ultrack.v1']).car, 'av12', 'and the restored profile is on disk at once'); assert.equal(JSON.parse(mem['ultrack.v1']).freePlay, undefined);
  delete globalThis.localStorage;

  // ---- the press (career/media.js): stories come from what happened, and a picture always falls back cleanly
  {
    const Md = await server.ssrLoadModule('/src/game/career/media.js');
    const base = (seed = 77) => { const s = C.newCareer({ name: 'Ana Test', seed, now: 'x' }); C.finishShootout(s, null); C.acceptOffer(s, s.pending.offers[0].id, avail); return s; };
    const raceWeek = (s) => { while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); };
    const raceIt = (s, place) => {
      raceWeek(s); C.finishQuali(s, 1, null);                        // a lap of 1 s: pole, into the race
      const q = s.season.current.quali, hero = s.contract.car, rest = q.grid.filter((k) => k !== hero); rest.splice(place - 1, 0, hero);
      const before = s.mediaN ?? 0; C.finishRace(s, { order: rest, best: {}, dnf: false }); return s.media.filter((x) => x.id > before);
    };
    let s = base(), got = raceIt(s, 1);
    assert.ok(got.some((x) => x.kind === 'win' && x.title.includes('Ana Test')), 'a win makes the lead'); assert.ok(Md.unreadStories(s) > 0);
    assert.ok(got.every((x) => x.track), 'every story knows its circuit');
    assert.equal(got.filter((x) => x.title.includes('Ana Test') && x.kind === 'podium').length, 0, 'a win is not also a podium story');
    s = base(); got = raceIt(s, 3);
    assert.ok(got.some((x) => x.kind === 'podium'), 'a podium is covered'); const lead = got.find((x) => x.kind === 'win'); assert.ok(lead.driver && lead.mood === 'win', 'another driver won: the story is about them');
    s = base(); raceWeek(s); C.finishQuali(s, 1e6, null); assert.ok(!s.season.current.quali.grid.includes(s.contract.car), 'too slow'); let n0 = s.mediaN ?? 0;
    C.finishDnq(s); got = s.media.filter((x) => x.id > n0);
    assert.ok(got.some((x) => x.kind === 'down' && x.title.includes('misses the cut')), 'a missed cut is covered');
    {                                                            // the same, with a teammate who did make the grid
      let d = null;
      for (let seed = 1; !d && seed < 200; seed++) { const t = base(seed); raceWeek(t); C.finishQuali(t, 1e6, null); if (t.season.current.quali.grid.includes(t.season.current.quali.mate.car)) d = t; }
      const mate = d.season.current.quali.mate.code; n0 = d.mediaN ?? 0; C.finishDnq(d);
      assert.ok(d.media.some((x) => x.id > n0 && x.kind === 'duel' && x.driver === mate), 'the teammate who made it is the comparison');
    }
    // reading clears the count; the box stays capped
    const u = Md.unreadStories(s); Md.readStory(s, s.media[0].id); assert.equal(Md.unreadStories(s), u - 1);
    for (let i = 0; i < 60; i++) Md.story(s, 'drama', 't', 'b'); assert.equal(s.media.length, 40, 'the save keeps the newest stories only');
    // pictures: the mood, then the portrait, then the circuit, then nothing; only the art that exists
    const pic = (driver, mood, track = 'marina', pair = null) => Md.storyImage(s, { driver, mood, track, pair });
    assert.deepEqual(pic(null, 'portrait'), { track: 'marina' }, 'a story about the player shows the circuit');
    assert.deepEqual(pic('XXX', 'win'), { track: 'marina' }, 'an academy rookie has no photo');
    assert.deepEqual(pic(null, 'portrait', null), {}, 'nothing to show is allowed');
    const MJ = (await import('node:fs')).readFileSync(new URL('../../assets/career/media.json', import.meta.url), 'utf8'), media = JSON.parse(MJ), fs = await import('node:fs');
    for (const [code, moods] of Object.entries(media.images)) {
      const name = Object.values(R.CAR).find((c) => c.driver.code === code).driver.name;
      assert.ok(pic(code, 'portrait').url?.includes(Md.driverSlug(name)) || !moods.includes('portrait'), code);
      if (moods.includes('portrait') && !moods.includes('down')) assert.ok(pic(code, 'down').url.endsWith('/media/portrait.webp'), code + ': a missing mood falls back to the portrait');
      for (const m of moods) for (const f of [m, m + '-thumb']) assert.ok(fs.existsSync(new URL(`../public/assets/drivers/${Md.driverSlug(name)}/media/${f}.webp`, import.meta.url)), `${code} ${f} is listed and on disk`);
    }
    for (const pr of media.pairs) {
      assert.ok(fs.existsSync(new URL(`../public/assets/drivers/pairs/${pr.id}.webp`, import.meta.url)), `pair ${pr.id} is on disk`);
      assert.ok(pic(pr.drivers[0], 'portrait', 'marina', [...pr.drivers].reverse()).url.endsWith(`/pairs/${pr.id}.webp`), 'a pair of drivers has their own shot, whichever finished first');
    }
    if (media.pairs.length) assert.ok(!pic('CAL', 'down', 'marina', ['CAL', 'KAR']).url?.includes('/pairs/'), 'two drivers with no shot together fall back to the driver');
    for (const c of Object.values(R.CAR)) assert.equal(media.quotes[c.driver.code]?.win?.length > 0 && media.quotes[c.driver.code]?.down?.length > 0, true, `${c.driver.code} has lines`);
    // every other listed image and its thumbnail are on disk; a thumbnail is the small copy of a driver's art, and a circuit still is left alone
    for (const [dir, list] of [['you', media.you], ['principals', media.principals], ['scenes', media.scenes]]) for (const n of list) for (const f of [n, n + '-thumb']) assert.ok(fs.existsSync(new URL(`../public/assets/drivers/${dir}/${f}.webp`, import.meta.url)), `${dir}/${f} is on disk`);
    assert.equal(Md.thumbOf('/assets/drivers/you/win.webp'), '/assets/drivers/you/win-thumb.webp'); assert.equal(Md.thumbOf('/assets/ui/stills/tracks/marina.webp'), '/assets/ui/stills/tracks/marina.webp');
    // the player's own moments: a signing, a hot seat, the sack. Without the art they show the circuit; a signing never falls back to a shot in the wrong colours
    {
      const y = base(), first = y.media.find((x) => x.you?.startsWith('sign-')); assert.ok(first && first.you === 'sign-' + y.contract.team && first.title.includes('signs for'), 'the first contract is news');
      Md.coverHotSeat(y, y.contract.team); assert.ok(y.media[0].kind === 'fired' && y.media[0].principal === y.contract.team, 'a hot seat is about the principal');
      Md.coverFired(y, y.contract.team); assert.ok(y.media[0].title.includes('sacks') && y.media[0].you === 'fired', 'the sack is news');
      const shot = Md.storyImage(y, { you: 'sign-nobody', track: 'marina' }); assert.deepEqual(shot, { track: 'marina' }, 'no signing shot for a team: the circuit, not another team\'s suit');
    }
    // the fan talk: every template fills cleanly and names no unknown token, and a season of it has posts with a handle, a line and likes
    for (const t of [...Object.values(media.social).flat(), ...media.rumors]) {
      assert.ok(t.title && t.body && t.posts.length === 2, 'a post needs a title, a body and two posts'); assert.ok(t.posts.every((x) => x.includes('|')), 'handle|text');
      for (const k of JSON.stringify(t).match(/\{(\w+)\}/g) ?? []) assert.ok(['{me}', '{who}', '{team}', '{rival}', '{gp}', '{week}'].includes(k), 'known token: ' + k);
    }
    for (const r of media.rumors) assert.ok(!r.drivers.includes('QUI'), 'no romance rumours about the 20-year-old rookie');
    {
      const P = play(M, 12, 1.0, 3).save.media.filter((x) => x.posts), j = JSON.stringify(P);
      assert.ok(P.length > 0 && P.every((x) => x.posts.every((p) => p.h.startsWith('@') && p.t && /K$/.test(p.l))), 'posts are whole'); assert.ok(!/[{}]\w*[{}]/.test(j.replace(/[{}]"/g, '').replace(/"[{}]/g, '')) && !j.includes('{team}') && !j.includes('{who}'), 'no token left unfilled');
    }
    // a market move is written up: a driver the market moved, and one who retired
    const m = base(), key = Object.keys(m.world.seats).find((k) => m.world.seats[k] !== 'YOU'), code = m.world.seats[key], other = Object.keys(m.world.seats).find((k) => k !== key && m.world.seats[k] !== 'YOU'), before = { ...m.world.seats };
    [m.world.seats[key], m.world.seats[other]] = [m.world.seats[other], code]; Md.coverMoves(m, before, []);
    assert.ok(m.media.some((x) => x.kind === 'move' && x.driver === code && x.title.includes(R.loreOf(R.CAR[other].team).name)), 'the move names the new team');
    assert.equal(Md.storyImage(m, { driver: code, mood: 'portrait', track: 'marina' }).moved ?? false, Boolean(media.images[code]?.length), 'a moved driver with a photo: it is a file photo');
    // the drama rolls never touch the career's other streams: same seed, same world
    assert.equal(JSON.stringify(play(M, 11, 1.0, 2).save.media), JSON.stringify(play(M, 11, 1.0, 2).save.media), 'the press replays');
    assert.ok(play(M, 11, 1.0, 2).save.media.some((x) => x.kind === 'drama' || x.kind === 'move' || x.kind === 'duel'), 'a two-season career has more than results in the papers');
  }

  // ---- nine seasons, no dead end: every review has an offer, the wallet holds, every car has one driver, the save stays small, it replays
  assert.equal(JSON.stringify(play(M, 11, 1.0, 9).save), JSON.stringify(play(M, 11, 1.0, 9).save), 'nine seasons replay identically');
  let legends = 0;
  for (let i = 0; i < 45; i++) {
    const { save, log } = play(M, 900 + i, [0.975, 1.0, 1.02][i % 3], 9);
    assert.equal(log.offers.length, 9, 'nine reviews reached'); assert.ok(log.offers.every((n) => n >= 1), 'never a dead end'); assert.ok(log.minWallet >= 0);
    assert.ok(JSON.stringify(save).length < 100_000, 'the save stays small after nine seasons');
    const seats = Object.values(save.world.seats); assert.equal(seats.filter((c) => c === 'YOU').length, 1); assert.ok(seats.every(Boolean), 'no empty seat'); assert.equal(new Set(seats).size, 16, 'nobody drives two cars');
    assert.ok(seats.every((c) => c === 'YOU' || C.personOf(save, c)?.name), 'every driver has a name'); assert.ok(save.world.free.every((c) => !seats.includes(c)));
    if (log.tier.includes('legend')) legends++;
  }
  assert.ok(legends > 0, 'the top tier is reachable');
  console.log('career: all checks passed');
} finally { await server.close(); }
