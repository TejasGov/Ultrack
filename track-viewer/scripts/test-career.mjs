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

  // ---- the Round Rating's worked example (6.1): expected P8 of 8, qualifies P7, finishes P6, clean, wins the duel = 6 + 1.4 + 0.4 + 0.15 + 0.3 + 0.4, softened above 8.5: 8.6
  const ex = R.roundRating({ expPos: 8, grid: 7, finish: 6, fastest: false, clean: true, duel: { result: 'won', big: false }, field: 8 });
  assert.equal(ex.rr, 8.6); assert.equal(R.rrLabel(ex.rr), 'Outstanding');
  assert.equal(R.roundRating({ expPos: 1, grid: 1, finish: 8, clean: false, duel: { result: 'level' } }).rr, 2.0, 'P8 in the fastest car is bad');
  assert.ok(R.roundRating({ expPos: 8, grid: 8, finish: 8, dnf: true }).rr < 5, 'a retirement costs');
  assert.ok(!R.roundRating({ expPos: 12, grid: 12, finish: 8, dnf: true }).lines.some((l) => /above expected/.test(l[0])), 'a retirement earns no credit for places');
  { const dnq = (expPos, rookie) => R.roundRating({ expPos, grid: 10, finish: 10, dnq: true, rookie }).lines.find((l) => l[0] === 'Did not qualify')[1];   // a missed cut costs in full unless a Rookie expected outside the grid misses it
    assert.equal(dnq(6), R.TUNING.rating.dnq); assert.equal(dnq(R.TUNING.series.gridSize), R.TUNING.rating.dnq); assert.equal(dnq(R.TUNING.series.gridSize + 1), R.TUNING.rating.dnq, 'only a Rookie is let off');
    assert.equal(dnq(R.TUNING.series.gridSize + 1, true), R.TUNING.rating.dnqOutside); assert.equal(dnq(6, true), R.TUNING.rating.dnq); assert.ok(R.TUNING.rating.dnqOutside > R.TUNING.rating.dnq); }
  { const won = { expPos: 5, grid: 2, finish: 1, fastest: true, clean: false, duel: { result: 'level', skipped: true } }, skipped = R.roundRating({ ...won, exempt: true }), label = (r) => r.lines.map((l) => l[0]);
    assert.equal(skipped.rr, 9.4, 'a win from a skip earned by the last result: not punished for it'); assert.ok(label(skipped).includes('Won the race') && label(skipped).includes('Skipped qualifying on merit'));
    assert.ok(!label(skipped).some((l) => /Started|Qualified/.test(l)), 'the earned slot is credited once, by the skip line, not again as a qualifying place');
    assert.ok(!label(R.roundRating({ ...won, exempt: true, grid: 7 })).some((l) => /Started|below/.test(l)), 'a worse earned slot costs nothing');
    assert.ok(label(R.roundRating({ expPos: 3, grid: 3, finish: 1 })).includes('Won the race')); assert.ok(!label(R.roundRating({ expPos: 3, grid: 3, finish: 2 })).includes('Won the race')); assert.ok(!label(R.roundRating({ expPos: 3, grid: 3, finish: 1, dnf: true })).includes('Won the race'), 'a retirement wins nothing'); }
  // ---- the rating's hand cases (fields of 10 with 8 starting, the Challenger's share, grace and earned starts): the finish is judged among the starters, the start slot judges the race
  { const ch = { share: R.TUNING.divisions.challenger.rate, shareLine: 'Challenger field' }, rr = (x) => R.roundRating(x).rr;
    const cases = [
      [{ expPos: 10, expRace: 8, grid: 1, start: 1, finish: 8, exempt: true, underdog: true, field: 10, ...ch }, 5.5, 'pole earned by the last podium, then last of the 8: not Outstanding (was 8.3)'],
      [{ expPos: 8, expRace: 8, grid: 1, start: 1, finish: 8, field: 10 }, 6.6, 'a pole lap, then back to the expected place'],
      [{ expPos: 8, expRace: 8, grid: 8, start: 8, finish: 1, field: 10 }, 9.8, 'a win from the back'],
      [{ expPos: 1, expRace: 1, grid: 1, start: 1, finish: 1, fastest: true, clean: true, field: 10 }, 7.2, 'the fastest car doing its job'],
      [{ expPos: 10, expRace: 8, grid: 8, start: 8, finish: 1, field: 10, ...ch }, 9.4, 'a Challenger win from the back'],
      [{ expPos: 10, expRace: 8, grid: 10, start: 8, finish: 8, field: 10, ...ch }, 6.0, 'a grace start held: exactly as expected (was 6.8)'],
      [{ expPos: 10, expRace: 8, grid: 10, start: 8, finish: 5, field: 10, ...ch }, 7.9, 'a grace start, three places made'],
      [{ expPos: 4, expRace: 4, grid: 4, start: 4, finish: 8, dnf: true, field: 10 }, 2.0, 'a retirement'],
      [{ expPos: 6, grid: 9, finish: 9, dnq: true, field: 10 }, 4.0, 'a missed cut'],
      [{ expPos: 6, expRace: 6, grid: 3, start: 3, finish: 6, exempt: true, field: 10 }, 6.0, 'an earned P3 given back'],
      [{ expPos: 4, expRace: 4, grid: 4, start: 4, finish: 4, field: 8 }, 6.0, 'a typical round sits on the base'],
      [{ expPos: 1, expRace: 1, grid: 1, start: 1, finish: 8, field: 8 }, 2.0, 'pole to last in the fastest car'],
    ];
    for (const [x, want, why] of cases) assert.equal(rr(x), want, why);
    for (const expRace of [1, 4, 8]) for (const start of [1, 4, 8]) for (const exempt of [false, true]) for (const clean of [false, true]) for (const result of ['won', 'lost']) for (const field of [8, 10]) for (const share of [{}, ch])
      assert.ok(rr({ expPos: field === 8 ? expRace : 10, expRace, grid: start, start, finish: 8, exempt, clean, fastest: clean, duel: { result, big: true }, underdog: true, field, ...share }) <= R.TUNING.rating.lastCap, 'last of the starters never reads Strong or better');
    { const r = R.roundRating({ expPos: 8, expRace: 8, grid: 4, start: 4, finish: 8, clean: true, underdog: true, duel: { result: 'won', big: true }, field: 8 });   // a review's case: was 8.2 Outstanding
      assert.equal(r.rr, R.TUNING.rating.lastCap); assert.equal(Math.round((R.TUNING.rating.base + r.lines.reduce((a, l) => a + l[1], 0)) * 10) / 10, r.rr, 'the cap is a line: the lines add up');
      assert.ok(R.roundRating({ expPos: 8, expRace: 7, starters: 7, grid: 4, start: 4, finish: 7, clean: true, underdog: true, duel: { result: 'won', big: true }, field: 8 }).lines.some(([l]) => l === 'Last of the 7 who started'), 'the starters come from the race'); }
    assert.equal(R.roundRating({ expPos: 12, grid: 10, finish: 8, field: 16 }).lines.find(([l]) => /^Finished/.test(l))[0], 'Finished 4 places above expected', 'without expRace the finish is against expPos');
    assert.ok(R.roundRating(cases[0][0]).lines.every(([l]) => !/above expected|Started/.test(l)), 'the report never calls last of the starters above expected');
    assert.deepEqual(R.roundRating({ expPos: 8, grid: 8, finish: 8, field: 8 }), R.roundRating({ expPos: 8, expRace: 8, grid: 8, start: 8, finish: 8, field: 8 }), 'an 8-car race needs neither'); }
  // ---- two series (docs/10x/divisions-spec.md 16.1, 16.2, 16.6, 16.7): the split by expected place, places counted inside a series, objectives and the rating's divisor
  { const w = C.newCareer({ seed: 5, now: 'x' }), ids = (d) => R.TEAM_IDS.filter((t) => w.world.teams[t].div === d);
    assert.deepEqual(ids('elite'), ['aurum', 'saetta', 'norrsken', 'toro', 'sarab']); assert.deepEqual(ids('challenger'), ['corvid', 'steelhead', 'hayate', 'mojave', 'liberty']);
    assert.equal(R.eliteSize(), 5); assert.equal(R.eliteSize(8), 4); assert.equal(R.eliteSize(10), 5); assert.equal(R.divsOn(7), false); assert.equal(R.divsOn(8), true);
    assert.ok(Object.keys(R.TIERS.firstJob).every((t) => w.world.teams[t].div === 'challenger'), 'every first job is in the Challenger');
    assert.equal(R.divOf(w, 'aurum'), 'elite', 'outside a season: the world'); assert.deepEqual(R.teamsIn(w, 'all'), R.TEAM_IDS); assert.equal(R.carsIn(w, 'elite').length, 10); assert.equal(R.carsIn(w, 'challenger').length, 10);
    assert.equal(R.expIn(w, 'liberty', 'B'), 10); assert.equal(R.expIn(w, 'hayate', 'B'), 6); assert.equal(R.expIn(w, 'sarab', 'B'), 10); assert.equal(R.expIn(w, 'aurum', 'A'), 1); assert.equal(R.expIn(w, 'corvid', 'A'), 1);
    w.world.teams.liberty.div = 'elite'; w.world.teams.sarab.div = 'challenger';
    assert.equal(R.posIn(w, 'liberty'), 5, 'promoted: last of five'); assert.equal(R.posIn(w, 'sarab'), 1, 'relegated: first of five'); assert.equal(R.expIn(w, 'liberty', 'B'), 10); assert.equal(R.expIn(w, 'sarab', 'A'), 1); assert.equal(R.posIn(w, 'corvid'), 2);
    w.season = { divs: {} }; assert.equal(R.divOf(w, 'aurum'), 'all', 'a season with no series of its own is one field'); assert.equal(R.posIn(w, 'liberty'), 10); assert.equal(R.expIn(w, 'liberty', 'B'), R.expOf(10, 'B'));
    assert.deepEqual(R.interleave([1, 2], ['a', 'b']), [1, 'a', 2, 'b']); assert.deepEqual(R.interleave([1, 2, 3, 4, 5], ['a', 'b', 'c'], 8), [1, 'a', 2, 'b', 3, 'c', 4, 5]); assert.deepEqual(R.interleave([1], ['a', 'b', 'c'], 3), [1, 'a', 'b']);
    const ch = (k) => k.startsWith('c'), lcq = R.lcqGrid(['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'c1', 'c2', 'c3'], ch, 2);
    assert.deepEqual(lcq, ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'c1', 'c2'], 'the fastest Challenger laps take the slowest Elite places'); assert.deepEqual(R.lcqGrid(['c1', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'c2'], ch, 2), ['c1', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'c2'], 'in lap order');
    assert.deepEqual(R.lcqGrid(['c1', 'c2', 'e1'], ch, 2, 2), ['c1', 'c2']); assert.deepEqual(R.lcqGrid(['e1', 'e2', 'e3', 'c1'], ch, 2, 2), ['e1', 'c1'], 'fewer Challenger cars than the quota: all of them');
    assert.deepEqual(R.seedsOf('open', ['E1', 'E2', 'E3'], ['C1', 'C2', 'C3']), ['E1', 'C1', 'E2', 'C2']); assert.deepEqual(R.seedsOf('masters', ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'], ['C1', 'C2', 'C3', 'C4']), ['E1', 'C1', 'E2', 'C2', 'E3', 'C3', 'E4', 'E5']);
    assert.deepEqual(R.seedsOf('masters', ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7'], ['C1', 'C2']), ['E1', 'C1', 'E2', 'C2', 'E3', 'E4', 'E5', 'E6'], 'a Challenger table of 2 is filled from the Elite');
    // objectivesFor at a field of 18 (the FIELD when the series split) is byte-identical to the function before the split, for every expected place, easier and exempt, with and without a reach
    const old = (r, expPos, easier = false, exempt = false, reach = null) => { const G8 = 8, F = 18, main = reach ? { kind: 'reach', to: reach } : expPos > G8 && !exempt ? { kind: 'quali', n: easier ? Math.min(expPos + 1, F) : Math.min(expPos, F - 1) } : { kind: 'finish', n: easier ? Math.min(expPos + 1, G8) : Math.min(expPos, G8 - 1) };
      const pool = [{ kind: 'duel' }, { kind: 'clean' }, { kind: 'gain', n: 2 }, { kind: 'fastest' }, { kind: 'quali', n: Math.max(1, expPos - 2) }]; if (expPos <= 6) pool.push({ kind: 'podium' });
      return [{ ...main, mandatory: true }, ...G.shuffle(r, exempt ? pool.filter((o) => o.kind !== 'duel' && o.kind !== 'quali') : pool).slice(0, 2)]; };
    for (let e = 1; e <= 18; e++) for (const easier of [false, true]) for (const exempt of [false, true]) for (const reach of [null, 'the Japan Open Final']) assert.equal(JSON.stringify(R.objectivesFor(G.rng(9, 'obj', e), e, easier, exempt, reach, 18)), JSON.stringify(old(G.rng(9, 'obj', e), e, easier, exempt, reach)), `objectives at P${e}`);
    const main = (e, N, easier = false) => R.objectiveText(R.objectivesFor(G.rng(1, 'x'), e, easier, false, null, N)[0]), pod = (e, N) => [...Array(40).keys()].some((s) => R.objectivesFor(G.rng(s, 'x'), e, false, false, null, N).some((o) => o.kind === 'podium'));
    assert.equal(main(8, 8), 'Finish P7 or better'); assert.equal(main(8, 8, true), 'Finish P8 or better', 'easier: just making it'); assert.equal(main(4, 8), 'Finish P4 or better'); assert.equal(main(10, 10), 'Qualify P9 or better');
    assert.ok(pod(3, 8) && !pod(4, 8) && pod(3, 10) && !pod(4, 10) && pod(6, 18) && !pod(7, 18) && pod(7, 20) && !pod(8, 20), 'the podium joins the pool in the top 3 of 8 or 10, the top 6 of 18, the top 7 of 20');
    const lq = R.objectivesFor(G.rng(1, 'x'), 12, false, true, 'the Japan Open Final', 18, 8, true);
    assert.deepEqual(lq.slice(0, 2).map((o) => [o.kind, o.stage ?? null, !!o.mandatory, R.objectiveText(o)]), [['reach', 'lcq', true, 'Reach the Last Chance Qualifier'], ['reach', null, false, 'Reach the Japan Open Final']]); assert.equal(lq.length, 3);
    assert.equal(R.objectiveMet(lq[0], { lcqIn: true, dnq: true }), true, 'in the Last Chance: met, even out of the Final'); assert.equal(R.objectiveMet(lq[0], { lcqIn: false, dnq: true }), false); assert.equal(R.objectiveMet(lq[1], { dnq: false }), true);
    // the rating's place divisor: two at the old 16-car field (the default), the field over the grid otherwise
    const cases = [{ expPos: 8, grid: 6, finish: 4, clean: true, duel: { result: 'won', big: false } }, { expPos: 3, grid: 9, finish: 7 }, { expPos: 12, grid: 12, finish: 8, dnf: true }, { expPos: 5, grid: 2, finish: 1, exempt: true, fastest: true }, { expPos: 10, grid: 11, finish: 11, dnq: true, rookie: true }];
    for (const x of cases) { assert.deepEqual(R.roundRating(x), R.roundRating({ ...x, field: 16 })); assert.deepEqual(R.xpFor({ ...x, tier: 'rookie', optional: 0 }), R.xpFor({ ...x, tier: 'rookie', optional: 0, field: 16 })); }
    assert.equal(R.TUNING.divisions.legacyField, 16);
    // a share of the credit (the Challenger): the gains shrink by 1 - share, the losses stay whole
    { const up = { expPos: 6, grid: 4, finish: 1, fastest: true, clean: true, field: 8 }, full = R.roundRating(up), part = R.roundRating({ ...up, share: 0.75, shareLine: 'Challenger field' }), gain = full.lines.reduce((a, l) => a + l[1], 0);
      assert.deepEqual(part.lines.at(-1), ['Challenger field', Math.round(-0.25 * gain * 100) / 100]); assert.ok(part.rr < full.rr);
      const down = { expPos: 2, grid: 6, finish: 7, field: 8 }; assert.equal(R.roundRating({ ...down, share: 0.75, shareLine: 'x' }).rr, R.roundRating(down).rr, 'a poor round costs the same'); }
    for (const [field, k] of [[8, 1], [10, 1.25], [16, 2], [18, 2.25]]) { const l = R.roundRating({ expPos: 6, grid: 6, finish: 4, field }).lines.find((x) => /^Finished/.test(x[0]))[1]; assert.equal(l, Math.round(R.TUNING.rating.pos * 2 * 100) / 100, `field ${field}: the finish is of the starters, two places are two`);
      assert.equal(R.roundRating({ expPos: 6, grid: 2, finish: 6, field }).lines.find((x) => /^Qualified/.test(x[0]))[1], Math.round(R.TUNING.rating.quali * Math.min(R.TUNING.rating.qualiClamp, 4 / k) * 100) / 100, `field ${field}: four qualifying places over ${k}`);
      assert.equal(R.xpFor({ expPos: 6, grid: 2, finish: 6, tier: 'rookie', optional: 0, field }).lines.find((x) => x[0] === 'Qualified above expected')[1], Math.min(R.TUNING.rating.qualiClamp, 4 / k) * R.TUNING.xp.qualiPerPlace); }
    assert.equal(R.xpFor({ expPos: 6, grid: 6, finish: 2, tier: 'rookie', optional: 0, reward: 0.5 }).lines[0][1], R.TUNING.xp.place[1] * 0.5, 'the Challenger reward scales the place XP'); }
  // ---- pace and levels
  assert.equal(R.paceOf(94).toFixed(3), '1.011'); assert.equal(R.paceOf(76).toFixed(3), '0.974');
  assert.equal(R.xpForLevel(2), 90); assert.equal(R.levelOf(89), 1); assert.equal(R.levelOf(90), 2); assert.equal(R.levelOf(1e9), 25);
  assert.ok(R.parLap('india', 'nissan-z') > R.parLap('india', 'destrier'), 'a slower car has a slower par');
  assert.ok(R.parLap('india', 'av12', 'rain') > R.parLap('india', 'av12'), 'rain is slower');

  // ---- calendar: the Tour. Tour 1-2, Japan Open, Tour 3-4, India Open, Tour 5-6, Venice Open, Masters; each Open on its own circuit and nowhere else; the Tour is every other
  // shipped circuit but the Masters' and the qualifying venues, each once a season; with too few, the fewest return, a whole cycle apart; looks; round 1 dry; wet-only rounds wet
  const avail = { india: null, drylake: ['day', 'dusk'], infinia: ['day', 'dusk'], marina: null, shajawa: ['day', 'dusk'], llano: ['day', 'dusk'], tokyo: null, qingshan: null, venice: null };
  const KINDS = ['tour', 'tour', 'open', 'tour', 'tour', 'open', 'tour', 'tour', 'open', 'masters'], TOUR = ['shajawa', 'india', 'qingshan', 'llano'], OPENS = ['tokyo', 'infinia', 'venice'], QPOOL = ['drylake', 'pilbara', 'terminal'];
  { const today = { ...avail, pilbara: ['day', 'dusk'], terminal: ['day', 'dusk'] }, W = R.TUNING.weather, comeBack = new Set();
    const FAKE = { morro: { event: 'grandprix', parLap: 100, measured: 'test', names: ['Morro Night', 'Morro Return'], wetOnly: true }, fakeday: { event: 'grandprix', parLap: 90, measured: 'test', names: ['Fake Run', 'Fake Return'] } };
    Object.assign(R.CAL.tracks, FAKE);
    try {
      const sets = [[today, TOUR], [{ ...today, morro: ['night'], fakeday: ['day', 'dusk'] }, [...TOUR, 'morro', 'fakeday']], [{ ...today, morro: ['night'] }, [...TOUR, 'morro']], [(({ llano, ...o }) => ({ ...o, morro: ['night'] }))(today), ['shajawa', 'india', 'qingshan', 'morro']]];
      for (const [av, P] of sets) for (let s = 1; s <= 300; s++) for (let season = 1; season <= 4; season++) for (const L of ['sprint', 'standard', 'full']) {
        const cal = R.buildCalendar(s, season, 1, av, L), tour = cal.filter((r) => r.kind === 'tour'), ids = tour.map((r) => r.track), at = `seed ${s} season ${season} ${L}: ${ids}`;
        assert.deepEqual(cal, R.buildCalendar(s, season, 1, av, L), 'a calendar is seeded');
        assert.deepEqual(cal.map((r) => r.kind), KINDS); assert.deepEqual(cal.filter((r) => r.kind === 'open').map((r) => r.track), OPENS, 'the Opens are on their own circuits, in order');
        assert.deepEqual(cal.map((r) => r.round), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); assert.ok(cal.at(-1).finale && cal.filter((r) => r.finale).length === 1);
        assert.equal(cal.at(-1).track, 'marina'); assert.equal(cal.at(-1).look, 'night', 'the Masters is Marina at night'); assert.equal(cal[0].weather, 'dry', at);
        assert.deepEqual(cal.filter((r) => r.kind === 'open').map((r) => r.name), ['Japan Open', 'India Open', 'Venice Open']); assert.equal(cal.at(-1).name, 'Ultrack Masters');
        assert.ok(ids.every((t) => P.includes(t)), `only Tour circuits in the Tour (no Open, Masters or qualifying venue): ${at}`);
        const most = Math.ceil(6 / P.length), count = (t) => ids.filter((x) => x === t).length;
        if (P.length >= 6) assert.equal(new Set(ids).size, 6, `no circuit twice in a season: ${at}`);
        else { assert.equal(new Set(ids).size, P.length, `every Tour circuit raced: ${at}`); assert.ok(P.every((t) => count(t) <= most), `the fewest returns: ${at}`);
          ids.forEach((t, i) => { const j = ids.indexOf(t, i + 1); if (j > 0) assert.equal(j - i, P.length, `a return a whole cycle later: ${at}`); });
          for (const t of P) if (count(t) === 2) comeBack.add(t);
          if (P.some((t) => R.CAL.tracks[t].wetOnly && count(t) === 2)) assert.ok(P.every((t) => R.CAL.tracks[t].wetOnly || count(t) === 2), `a wet-only circuit returns only after every dry one: ${at}`); }
        tour.forEach((r, i) => assert.equal(r.name, R.CAL.tracks[r.track].names[Math.min(ids.slice(0, i).filter((x) => x === r.track).length, 1)], 'a return takes the second name'));
        const q0 = Math.floor(G.rng(s, 'quali', season)() * 3); assert.deepEqual(cal.map((r) => r.qualiTrack), cal.map((_, i) => QPOOL[(q0 + i) % 3]), 'the qualifying rotation as before');
        for (const r of cal) { if (av[r.track]) assert.ok(av[r.track].includes(r.look), `${r.track} at ${r.look}`); if (R.CAL.tracks[r.track].dryOnly) assert.equal(r.weather, 'dry'); if (R.CAL.tracks[r.track].wetOnly) assert.notEqual(r.weather, 'dry', `a wet-only round is wet: ${at}`);
          assert.equal(r.laps, R.lapsFor(r.track, L)); assert.equal(!!r.lcqLaps, r.kind === 'open'); if (r.lcqLaps) assert.equal(r.lcqLaps, R.lapsFor(r.qualiTrack, L)); }
        if (P.includes('morro')) assert.equal(cal.find((r) => r.track === 'morro').look, 'night', 'a night-only circuit runs at night');
        assert.ok(cal.filter((r) => r.weather !== 'dry' && !R.CAL.tracks[r.track].wetOnly).length <= W.maxWet, 'wet-only rounds leave the cap to the others');
      }
      assert.deepEqual([...comeBack].sort(), [...TOUR].sort(), 'any dry circuit can be one that returns; a wet-only one comes last in the cycle, so with a dry circuit left to return it never does');
      const both = new Set(); for (let s = 1; s <= 300; s++) both.add(R.buildCalendar(s, 1, 1, sets[1][0]).find((r) => r.track === 'morro').weather); assert.deepEqual([...both].sort(), ['damp', 'rain'], 'a wet-only round can be rain or damp');
    } finally { for (const id in FAKE) delete R.CAL.tracks[id]; } }
  assert.notDeepEqual(R.buildCalendar(5, 1, 1, avail), R.buildCalendar(5, 2, 1, avail), 'a calendar changes by season');
  { const few = R.buildCalendar(5, 1, 1, { india: null, drylake: null, marina: null, shajawa: null, tokyo: null });   // a game missing circuits: its Opens drop out and the Tour still fills its rounds
    assert.deepEqual(few.map((r) => r.kind), ['tour', 'tour', 'open', 'tour', 'tour', 'tour', 'tour', 'masters']); const t = few.filter((r) => r.kind === 'tour').map((r) => r.track);
    assert.ok(t.every((x, i) => ['india', 'shajawa'].includes(x) && x !== t[i - 1]), `two circuits alternate: ${t}`); }
  { const t = R.buildCalendar(5, 1, 1, { marina: null, tokyo: null, drylake: null }).filter((r) => r.kind === 'tour').map((r) => r.track);   // no Tour circuit at all: never an Open's or the Masters' circuit
    assert.deepEqual([...new Set(t)], ['drylake'], `the fallback skips Open and Masters circuits: ${t}`); }
  assert.ok(R.buildCalendar(5, 1, 1, { ...avail, india: [] }).every((r) => r.look), 'an empty `times` list offers every look');

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
  // ---- the qualifying rotation: CAL.qualifyingPool round-robin from a seeded start, on its own rng stream; old rounds, an unshipped venue and the Shootout stay at Dry Lake
  { const POOL = ['drylake', 'pilbara', 'terminal'], pool0 = R.CAL.qualifyingPool, avail2 = { ...avail, pilbara: ['day', 'dusk'], terminal: ['day', 'dusk'] }, S = R.TUNING.series;
    const core = (cal) => cal.map((r) => [r.track, r.look, r.weather, r.laps].join(' ')).join(', ');
    delete R.CAL.qualifyingPool; const poolless = R.buildCalendar(5, 1, 1, avail); R.CAL.qualifyingPool = POOL;
    try {
      assert.ok(poolless.every((r) => r.qualiTrack === 'drylake'), 'no pool: Dry Lake');
      assert.equal(core(R.buildCalendar(5, 1, 1, avail2)), core(poolless), 'the pool leaves track, look, weather and laps as they were');
      assert.equal(core(poolless), 'llano dusk dry 2, shajawa day dry 2, tokyo dusk damp 2, qingshan night dry 2, india day dry 2, infinia dusk dry 2, llano day dry 2, shajawa dusk dry 2, venice dusk dry 2, marina night dry 2', 'seed 5 under the no-repeat Tour (Marina no longer in it; re-snapshotted then), the pool still changes nothing');
      assert.ok(R.buildCalendar(5, 1, 1, avail).every((r) => r.qualiTrack === 'drylake'), 'a venue the game does not ship drops out of the pool');
      for (let s = 1; s <= 20; s++) for (let season = 1; season <= 3; season++) for (const L of ['sprint', 'full']) {
        const q = R.buildCalendar(s, season, 1, avail2, L);
        assert.ok(q.every((r, i) => POOL.includes(r.qualiTrack) && (i === 0 || r.qualiTrack !== q[i - 1].qualiTrack)), `seed ${s} season ${season}: ${q.map((r) => r.qualiTrack)}`);
        assert.deepEqual([...new Set(q.map((r) => r.qualiTrack))].sort(), POOL, 'all three venues each season');
        assert.ok(q.every((r) => r.kind !== 'open' || r.lcqLaps === R.lapsFor(r.qualiTrack, L)), 'the Last Chance runs the venue\'s laps');
      }
      for (const v of POOL) for (const L of ['sprint', 'standard', 'full']) assert.ok(R.lapsFor(v, L) >= S.lapsMin && R.lapsFor(v, L) <= S.lapsMax, `${v} ${L}`);
      assert.equal(C.shootout().track, 'drylake', 'the Shootout stays at Dry Lake');
      const rot = C.newCareer({ seed: 79, now: 'x' }); C.finishShootout(rot, null); C.acceptOffer(rot, rot.pending.offers[0].id, avail2);
      const R0 = C.currentRound(rot); assert.ok(POOL.includes(R0.qualiTrack)); assert.equal(C.qualiVenue(rot).track, R0.qualiTrack, 'qualifying runs at the round\'s venue');
      C.setRaceLength(rot, 'full'); assert.ok(rot.season.calendar.every((r) => !r.lcqLaps || r.lcqLaps === R.lapsFor(r.qualiTrack, 'full')), 'a new length re-counts the Last Chance at its venue');
      delete R0.qualiTrack; assert.equal(C.qualiVenue(rot).track, 'drylake', 'a round from before the rotation qualifies at Dry Lake');
    } finally { if (pool0) R.CAL.qualifyingPool = pool0; else delete R.CAL.qualifyingPool; } }
  // ---- points and XP do not depend on the length: the same round, the same result
  const same = (l) => { const x = C.newCareer({ seed: 78, raceLength: l, now: 'x' }); C.finishShootout(x, null); C.acceptOffer(x, x.pending.offers[0].id, avail); C.finishQuali(x, 60); const r = C.finishRace(x, { order: x.season.current.quali.grid, best: {} }); return [r.xp, r.rr, r.rep, r.entries.map((e) => e.pts)]; };
  assert.deepEqual(same('sprint'), same('full'), 'race length never changes XP, rating, reputation or points');
  // ---- another qualifying try keeps the better lap and moves nobody else
  const q2 = C.newCareer({ seed: 79, now: 'x' }); C.finishShootout(q2, null); C.acceptOffer(q2, q2.pending.offers[0].id, avail); C.finishQuali(q2, 90); const me = q2.contract.car, ai = { ...q2.season.current.quali.laps };
  C.finishQuali(q2, 95); assert.equal(q2.season.current.quali.laps[me], 90, 'a slower retry changes nothing'); C.finishQuali(q2, null); assert.equal(q2.season.current.quali.laps[me], 90, 'no lap on a retry keeps the lap');
  const qs = C.qualiSetup(q2), qm = C.teammateCar(q2); assert.deepEqual(qs.racers, [me, qm], 'the teammate is on track in qualifying'); assert.ok(qs.pace[qm] > 0); assert.equal(qs.drivers[me].name, q2.player.name);
  const qa = C.newCareer({ seed: 79, now: 'x' }); C.finishShootout(qa, null); C.acceptOffer(qa, qa.pending.offers[0].id, avail); qa.season.calendar[0].track = 'drylake'; C.finishQuali(qa, 90, 88); assert.equal(qa.season.current.quali.mate.lap, 88, 'his real lap is the duel'); assert.equal(qa.season.current.quali.duel.result, 'lost');
  C.finishQuali(qa, 85, 89); assert.equal(qa.season.current.quali.mate.lap, 88, 'a retry keeps his better lap too'); assert.equal(qa.season.current.quali.duel.result, 'won'); C.finishQuali(qa, null); assert.equal(qa.season.current.quali.mate.lap, 88, 'no lap on a retry keeps his lap'); assert.equal(qa.season.current.quali.grid.length, 8, 'eight of the ten Challenger cars race');
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
  const signed0 = (seed, team = 'mojave') => { const s = C.newCareer({ seed, now: 'x' }); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.01); C.acceptOffer(s, s.pending.offers.find((o) => o.team === team).id, avail); return s; };
  assert.equal(fast.pending.shootout.grade, 'Standout'); assert.ok(fast.career.cl >= 2, 'the Shootout alone reaches CL 2 (upgrades unlock)');
  C.acceptOffer(fast, fast.pending.offers.find((o) => o.team === 'mojave').id, avail);
  assert.equal(fast.contract.car, 'bmw1'); assert.equal(fast.clock.phase, 'paddock'); assert.equal(fast.season.current.expPos, 8, 'Mojave, fourth of the five Challenger teams, B seat'); assert.equal(fast.season.current.field, 10);
  assert.equal(fast.season.div, 'challenger'); assert.deepEqual(Object.keys(fast.season.divs), R.TEAM_IDS); assert.ok(R.TEAM_IDS.every((t) => fast.season.divs[t] === fast.world.teams[t].div), 'the season keeps a snapshot of the series');
  // ---- upgrades: Rookie cap 1, CL gate, coins
  const coins = fast.wallet.coins, u = C.buyUpgrade(fast, 'engine', 503);
  assert.ok(u.ok); assert.equal(fast.wallet.coins, coins - u.cost); assert.equal(C.buyUpgrade(fast, 'engine', 503).reason, 'cap', 'Rookie seats cap at level 1');
  // ---- a round: quali, then race
  // the Challenger (16.3): the ten Challenger cars qualify for an eight-car grid; in the player's first season a slow lap only starts last (the grace); every seated car's lap is still drawn, for the Elite's race
  C.finishQuali(fast, 999); const q0 = fast.season.current.quali; assert.equal(q0.order.length, 10, 'the Challenger qualifies'); assert.equal(R.FIELD, 20); assert.equal(Object.keys(q0.laps).length, R.FIELD, 'every seated car flew a lap');
  assert.equal(q0.grid.length, 8); assert.ok(q0.grid.every((k) => R.divOf(fast, R.CAR[k].team) === 'challenger')); assert.equal(q0.order.at(-1), 'bmw1'); assert.ok(q0.grid.includes('bmw1'), 'a slow lap in the first season races from the back');
  assert.equal(C.qualiPlace(q0, 'bmw1'), 10); assert.equal(C.gridSlot(q0, 'bmw1'), 8); assert.deepEqual(q0.grid, [...q0.order.slice(0, 7), 'bmw1']); assert.deepEqual(q0.grace, { from: 10, out: q0.order[7] });
  const V0 = C.qualiVenue(fast); for (const k of R.carsIn(fast, 'elite')) assert.equal(q0.laps[k], R.aiLap({ seed: fast.seed, season: 1, round: 0, track: V0.track, weather: V0.weather, difficulty: 'normal', key: k, rating: fast.world.ratings[fast.world.seats[k]], dev: fast.world.teams[R.CAR[k].team].dev }), 'the Elite laps are the ones a combined qualifying drew');
  { const nl = signed0(81); C.finishQuali(nl, null); const q = nl.season.current.quali; assert.ok(!q.grid.includes(nl.contract.car) && !q.grace, 'no lap: no grace, the top 8 race'); assert.equal(C.qualiPlace(q, nl.contract.car), 10); assert.equal(C.raceSetup(nl).racers.length, 8);
    assert.equal(C.graceWaits(nl, q), true, 'off the grid for want of a lap: the hub asks for one, not for the cut'); C.finishQuali(nl, 999); assert.ok(nl.season.current.quali.grace && !C.graceWaits(nl, nl.season.current.quali), 'and any lap on the retry races'); }
  { const nq = signed0(82), r = C.finishRace(nq, { order: [], best: {} }); assert.equal(r.dnq, true, 'never qualified (a reload): a sit-out, grace or not');
    assert.ok(!nq.media.some((m) => /only the top/.test(m.body)) && nq.media.some((m) => /sits out/.test(m.title)), 'and the press says no lap, not a cut'); assert.equal(r.entries.find((e) => e.you).pts, 0); assert.equal(r.entries.filter((e) => !e.dnq).length, 8); assert.ok(r.entries.at(-1).you); }
  // the first season's grace (divisions.challenger.grace): the player who set a lap outside the eight starts P8 and the slowest AI car on the grid sits out; a qualifying objective
  // and the rating judge where they qualified, places gained count from where they started; a retry is judged afresh, and the rule holds in season 2 only for a Rookie-tier seat, and never at the cups
  { const g = signed0(84), me = g.contract.car; C.finishQuali(g, 999); const q = g.season.current.quali, out = q.order[7];
    assert.deepEqual(q.grace, { from: 10, out }); assert.equal(C.lapToRace(g, q).lap, q.laps[out], 'the lap to beat is the car that sat out'); assert.equal(C.lapToRace(g, q).squeezed, false);
    assert.ok(/A first season's grace: set a lap and you race, from the back of the grid at worst\./.test(C.weekNote(g, C.currentRound(g))));
    const cal = g.season.calendar; assert.equal(C.graceOn(g, cal.find((x) => x.kind === 'tour')), true); assert.equal(C.graceOn(g, cal.find((x) => x.kind === 'open')), false, 'the calendar: no grace at an Open'); assert.equal(C.graceOn(g, cal.find((x) => x.kind === 'masters')), false);
    const fresh = JSON.parse(JSON.stringify(g)); C.finishQuali(fresh, 999); assert.deepEqual(fresh.season.current.quali.grid, q.grid, 'the same lap, the same grid'); C.finishQuali(fresh, 1); assert.ok(!fresh.season.current.quali.grace && fresh.season.current.quali.grid[0] === me, 'a retry into the eight: no grace');
    const r = C.finishRace(g, { order: q.grid, best: {} }); assert.equal(r.dnq, false); assert.equal(r.finish, 8); assert.equal(r.grid, 10); assert.deepEqual(r.grace, { start: 8, out, code: g.world.seats[out] });
    { const Of = await server.ssrLoadModule('/src/game/career/offers.js'), x = JSON.parse(JSON.stringify(g)); assert.deepEqual([Of.wantOf(g, 'toro').key, Of.wantOf(g, 'toro').n], ['gained', 0], 'P8 from P8: no places gained, whatever they qualified');
      x.season.results.at(-1).finish = 5; assert.equal(Of.wantOf(x, 'toro').n, 3); assert.equal(Of.wantOf(x, 'liberty').n, 1, 'came through from behind: from the start slot'); }
    assert.equal(r.entries.find((e) => e.key === out).dnq, true, 'the car that sat out is a DNQ'); assert.equal(r.entries.filter((e) => e.dnq).length, 2); assert.equal(r.entries.find((e) => e.key === out).pts, 0);
    { let bites = 0; for (let sd = 300; sd < 330; sd++) { const k = signed0(sd); C.finishQuali(k, 999); const kq = k.season.current.quali, kr = C.finishRace(k, { order: kq.grid, best: {} });   // the cars that sat out qualified ahead: none was beaten
      bites += kr.entries.some((e) => e.dnq && R.TIERS.tiers[R.TIERS.teams[e.team].tier].rank > 1 && e.exp < kr.expPos); assert.ok(!kr.repLines.some(([l]) => /Giant/.test(l)), `seed ${sd}: no giant-killing from P8 under the grace`); }
      assert.ok(bites > 0, 'some of those rounds had a higher-tier car expected ahead sit out'); }
    assert.ok(r.rrLines.some(([l]) => l === 'Qualified 2 below expected'), 'the rating reads the qualifying place'); assert.ok(!r.rrLines.some(([l]) => /Did not qualify/.test(l)));
    assert.ok(g.inbox.some((m) => /P8 from P8 \(qualified P10\)/.test(m.title))); assert.ok(!g.media.some((m) => /misses the cut|sits out/.test(m.title)));
    assert.equal(R.objectiveMet({ kind: 'quali', n: 9 }, { grid: 10, start: 8 }), false, 'qualify P9: missed at P10, grace or not'); assert.equal(R.objectiveMet({ kind: 'gain', n: 2 }, { grid: 10, start: 8, finish: 7 }), false, 'places gained count from the grid slot');
    assert.equal(R.objectiveMet({ kind: 'gain', n: 2 }, { grid: 10, start: 8, finish: 6 }), true); assert.equal(R.objectiveMet({ kind: 'hold', n: 0 }, { grid: 10, start: 8, finish: 9 }), false);
    // from season 2 the grace stays for a Rookie-tier seat (divisions.challenger.graceRookie), in its own words; a Maestro Challenger seat is cut again; the flag off restores the cut; Opens and the Masters never had it
    const s2 = signed0(85); s2.clock.season = 2; C.finishQuali(s2, 999); assert.ok(s2.season.current.quali.grid.includes(s2.contract.car) && s2.season.current.quali.grace, 'season 2, a Rookie-tier seat: the grace stays'); assert.equal(C.graceWaits(s2, s2.season.current.quali), false);
    assert.ok(/A Rookie team's grace: set a lap and you race, from the back of the grid at worst\./.test(C.weekNote(s2, C.currentRound(s2))), 'season 2 says whose grace it is'); assert.ok(!/first season/.test(C.weekNote(s2, C.currentRound(s2))));
    assert.equal(C.graceWhy(s2), "A Rookie team's grace"); assert.equal(C.graceWhy(s2, false), "a Rookie team's grace"); assert.equal(C.graceWhy(g), "A first season's grace"); assert.equal(C.graceWhy(g, false), "a first season's grace");
    const cal2 = s2.season.calendar; assert.equal(C.graceOn(s2, cal2.find((x) => x.kind === 'tour')), true); assert.equal(C.graceOn(s2, cal2.find((x) => x.kind === 'open')), false, 'season 2: no grace at an Open'); assert.equal(C.graceOn(s2, cal2.find((x) => x.kind === 'masters')), false, 'nor the Masters');
    { const m2 = signed0(85); m2.clock.season = 2; m2.contract.team = 'corvid'; assert.equal(C.graceOn(m2), false, 'season 2, a Maestro Challenger seat: still cut'); assert.ok(!/grace/.test(C.weekNote(m2, C.currentRound(m2)))); }
    const D = R.TUNING.divisions.challenger; D.graceRookie = false; try { const s3 = signed0(85); s3.clock.season = 2; C.finishQuali(s3, 999); assert.ok(!s3.season.current.quali.grid.includes(s3.contract.car) && !s3.season.current.quali.grace, 'season 2, graceRookie off: the cut is back'); assert.equal(C.graceWaits(s3, s3.season.current.quali), false); assert.ok(!/grace/.test(C.weekNote(s3, C.currentRound(s3)))); D.graceRookie = true; assert.equal(C.graceWaits(s3, s3.season.current.quali), false, 'a stale quali that holds a lap is a plain miss, not a wait'); } finally { D.graceRookie = true; }
    { const rp = C.finishRace(s2, { order: s2.season.current.quali.grid, best: {} }); assert.ok(rp.grace && rp.grace.start === 8, 'the season-2 grace start is reported'); assert.equal(s2.season.results.at(-1).grace.start, 8); } }
  const setup0 = (C.finishQuali(fast, q0.laps[q0.grid[6]] + 0.001), C.raceSetup(fast));
  assert.equal(setup0.gridOrder.at(-1), 'bmw1', 'just slower than the seventh starts last'); assert.equal(setup0.levels('bmw1').engine, 1); assert.equal(setup0.racers.length, 8);
  assert.ok(Object.values(setup0.pace).every((p) => p > 0.9 && p < 1.05));
  const order = [...setup0.gridOrder].reverse(), rep = C.finishRace(fast, { order, best: Object.fromEntries(order.map((k, i) => [k, 70 + i])), crashes: 0, spins: 0 });
  assert.equal(rep.finish, 1); assert.ok(rep.rr >= 8, 'from last to first in the slowest car is outstanding'); assert.ok(rep.rrLines.some(([l, v]) => l === 'Challenger field' && v < 0), 'and the Challenger keeps a share of the credit'); assert.equal(rep.entries[0].pts, 25 + 1, 'the winner with the fastest lap');
  assert.equal(rep.entries.length, 10); assert.equal(rep.entries.filter((e) => e.dnq).length, 2, 'two Challenger cars miss the cut'); assert.ok(rep.entries.every((e) => e.div === 'challenger' && e.exp >= 1 && e.exp <= 10)); assert.equal(rep.field, 10);
  // the other series' race (16.5): the Elite's ten by their laps, eight racing, scored as the player's race
  { const o = rep.other, sum = (l) => l.reduce((a, e) => a + e.pts, 0), P = R.TUNING.series;
    assert.equal(o.div, 'elite'); assert.equal(o.entries.length, 10); assert.ok(o.entries.every((e) => e.div === 'elite' && !e.you)); assert.deepEqual(o.entries.map((e) => e.dnq), [...Array(8).fill(false), true, true]);
    assert.equal(sum(o.entries), P.points.reduce((a, b) => a + b, 0) + P.pole + P.fastestLap, 'every place, the pole and the fastest lap'); assert.ok(o.entries.slice(8).every((e) => e.pts === 0));
    assert.deepEqual(o.entries.slice(8).map((e) => e.key), R.carsIn(fast, 'elite').sort((a, b) => q0.laps[a] - q0.laps[b]).slice(8), 'the two slowest laps miss the cut');
    assert.deepEqual(o.entries.map((e) => e.exp).sort((a, b) => a - b), [...Array(10).keys()].map((i) => i + 1), 'expected places inside the Elite');
    const again = signed0(43), q = (C.finishQuali(again, 999), again.season.current.quali), r2 = C.finishRace(again, { order: [...C.raceSetup(again).gridOrder].reverse(), best: {}, crashes: 0, spins: 0 });
    assert.deepEqual(r2.other, o, 'the same seed, the same Elite race'); assert.ok(q); }
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
  // at: 'legacy' plays the season as one field (a save from before the two series: its season finishes so); 'elite' puts the team in the Elite in Sarab's place (promoted, last of five)
  const signed = (seed, team = 'mojave', at = null) => { const s = C.newCareer({ seed, now: 'x' }), W = s.world.teams; C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04);
    if (at === 'legacy') for (const t of R.TEAM_IDS) W[t].div = 'all';
    if (at === 'elite') { W[team].div = 'elite'; W.sarab.div = 'challenger'; }
    C.acceptOffer(s, s.pending.offers.find((o) => o.team === team).id, avail); return s; };
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

  // ---- the tables of two series (16.8): each series its own, the other series' race counted, the cups worth no series points, ties by wins, expected place, id
  { const s = signed(4301), sum = (l) => l.reduce((a, x) => a + x.pts, 0); round(s, 1); round(s, 2);
    const ch = C.standings(s), el = C.standings(s, 'elite'); assert.equal(ch.div, 'challenger'); assert.equal(el.div, 'elite');
    assert.deepEqual(ch.teams.map((t) => t.team).sort(), ['corvid', 'hayate', 'liberty', 'mojave', 'steelhead']); assert.equal(el.teams.length, 5); assert.equal(ch.drivers.length, 10); assert.equal(el.drivers.length, 10, 'the Elite table comes from the computed races');
    assert.equal(sum(el.drivers), sum(s.season.results.flatMap((r) => r.other.entries))); assert.equal(sum(ch.teams), sum(ch.drivers)); assert.equal(ch.drivers.find((d) => d.you).pts, 25 + 1 + 18, 'a win with the fastest lap, then P2');
    assert.equal(sum(ch.drivers.map((d) => ({ pts: d.wins }))), 2, 'one win a race list'); assert.equal(sum(el.teams.map((t) => ({ pts: t.wins }))), 2);
    while (C.currentRound(s).kind !== 'open') round(s, 4); const before = C.standings(s).drivers.find((d) => d.you).pts, op = round(s, 1);
    assert.equal(op.kind, 'open'); assert.ok(op.entries.every((e) => e.pts === 0), 'an Open scores no series points (D1)'); assert.equal(op.entries[0].rpts, 62.5, 'only ranking points'); assert.equal(C.standings(s).drivers.find((d) => d.you).pts, before);
    assert.equal(C.standings(s, 'all').teams.length, 10, 'one table of everyone, if asked');
    const t = signed(4302), e = (team, pts) => ({ key: R.TIERS.teams[team].A, team, code: 'X' + team, you: false, pts, div: 'challenger' }); t.world.teams.liberty.expPos = t.world.teams.hayate.expPos;
    t.season.results = [{ kind: 'tour', entries: [e('mojave', 10), e('hayate', 10), e('liberty', 10), e('corvid', 0)] }, { kind: 'tour', entries: [e('corvid', 4), e('hayate', 0), e('liberty', 0), e('mojave', 0)] }];
    assert.deepEqual(C.standings(t).teams.map((x) => x.team), ['mojave', 'hayate', 'liberty', 'corvid', 'steelhead'], 'level on points: the win, then the expected place, then the id'); }
  // ---- the season end with two series (16.9-16.12): one up, one down; the titles; the player's team promoted or relegated keeps the contract
  { const Of = await server.ssrLoadModule('/src/game/career/offers.js'), terms = (c) => ({ team: c.team, seat: c.seat, car: c.car, status: c.status, seasons: c.seasons, seasonsLeft: c.seasonsLeft, salary: c.salary });
    // promoted: the player wins every round, takes the Challenger Drivers' title and the team goes up
    const up = signed(4310); while (up.season.results.length < up.season.calendar.length - 1) round(up, 1, 1);
    const c0 = terms(up.contract), cups0 = up.stats.cups, coins0 = up.wallet.coins; round(up, 1, 1);
    const rv = up.pending.review, h = up.history.at(-1); assert.equal(up.clock.phase, 'review');
    assert.deepEqual(h.swap, { up: 'mojave', down: rv.swap.down }); assert.deepEqual(rv.swap, h.swap); assert.equal(rv.yourTeam, 'up'); assert.equal(rv.nextDiv, 'elite'); assert.equal(h.div, 'challenger'); assert.equal(h.teamCount, 5); assert.equal(rv.teamCount, 5);
    assert.equal(up.world.teams.mojave.div, 'elite'); assert.equal(up.world.teams[rv.swap.down].div, 'challenger'); assert.equal(up.season.divs.mojave, 'challenger', 'the season keeps the series it raced'); assert.equal(R.divOf(up, 'mojave'), 'challenger'); assert.equal(R.nextDivOf(up, 'mojave'), 'elite');
    assert.equal(h.teamOrder.length, 10); assert.deepEqual(h.teamOrder.slice(0, 5).map((t) => up.season.divs[t]), Array(5).fill('elite'), 'the table is the Elite then the Challenger');
    assert.equal(rv.drivers, 1); assert.equal(up.stats.cups, cups0 + 1, 'the Challenger title counts as a Cup'); assert.equal(up.stats.titles, 0); assert.equal(up.stats.promotions, 1); assert.equal(rv.rep, R.TUNING.rep.cup + R.TUNING.rep.challenger, 'promotion +40, the Challenger title +60'); assert.equal(rv.coins, R.TIERS.tiers.rookie.bonus.cup);
    assert.deepEqual(terms(up.contract), c0, 'the contract is untouched'); assert.ok(up.wallet.coins > coins0);
    const keep = up.pending.offers.find((o) => o.keep) ?? up.pending.offers.find((o) => o.team === 'mojave'); C.acceptOffer(up, keep.id, avail);
    assert.equal(up.season.div, 'elite'); assert.equal(up.season.current.field, 10); assert.ok([9, 10].includes(up.season.current.expPos), 'last of the Elite by expectation: ' + up.season.current.expPos);
    // relegated: last of the Elite, no penalty, and the contract stands until someone buys it out
    let dn = null; for (let seed = 4320; !dn && seed < 4340; seed++) { const s = toReview(signed(seed, 'mojave', 'elite'), 8); if (s.pending.review.yourTeam === 'down') dn = s; }
    const rd = dn.pending.review; assert.equal(dn.stats.relegations, 1); assert.equal(rd.rep, 0, 'no reputation lost for going down'); assert.equal(rd.trust, dn.contract.trust, 'nor trust'); assert.equal(rd.nextDiv, 'challenger'); assert.equal(dn.world.teams.mojave.div, 'challenger');
    assert.equal(dn.contract.team, 'mojave'); assert.ok(dn.contract.seasonsLeft > 1 && !dn.contract.dropped);
    const buy = Of.offer(dn, 'hayate', 'A', { salary: 400, signing: 0, seasons: 2, why: 'x' }); dn.pending.offers.push(buy); C.acceptOffer(dn, buy.id, avail); assert.ok(dn.transfer > 0, 'an outside offer buys the player out'); assert.equal(dn.season.div, 'challenger');
    // the Elite title: +100 and a title; a Legend A seat with trust is offered Number One for either series' title
    const el = signed(4311, 'mojave', 'elite'); while (el.season.results.length < el.season.calendar.length - 1) round(el, 1, 1);
    Object.assign(el.contract, { seat: 'A', status: 'lead', trust: 90 }); el.season.tier = 'legend'; round(el, 1, 1);   // a Legend A seat as far as the market is concerned
    assert.equal(el.pending.review.drivers, 1); assert.equal(el.stats.titles, 1); assert.equal(el.stats.cups, 0); assert.ok(el.pending.review.rep >= R.TUNING.rep.drivers); assert.ok(el.pending.offers.some((o) => o.status === 'number1'), 'Number One for the Elite title');
    const ct = signed(4312); while (ct.season.results.length < ct.season.calendar.length - 1) round(ct, 1, 1); Object.assign(ct.contract, { seat: 'A', status: 'lead', trust: 90 }); ct.season.tier = 'legend'; round(ct, 1, 1);
    assert.equal(ct.pending.review.drivers, 1); assert.ok(ct.pending.offers.some((o) => o.status === 'number1'), 'and for the Challenger title');
    // whole careers: exactly one up and one down a season, the sizes stay 5 and 5
    const { save } = play(M, 4330, 1.0, 6); assert.equal(save.history.length, 6);
    for (const r of save.history) assert.ok(r.swap && r.swap.up !== r.swap.down, 'one up, one down');
    assert.equal(R.TEAM_IDS.filter((t) => save.world.teams[t].div === 'elite').length, 5); assert.equal(R.TEAM_IDS.filter((t) => save.world.teams[t].div === 'challenger').length, 5);
    for (let i = 1; i < save.history.length; i++) { const [a, b] = [save.history[i - 1], save.history[i]]; assert.ok(b.teamOrder.slice(0, 5).includes(a.swap.up) && b.teamOrder.slice(5).includes(a.swap.down), 'the promoted team raced the Elite the season after'); }
    // the press and the inbox of the two series (spec 11): the player's own swap story, both champions, the review line
    const told = (s, re) => (s.media ?? []).filter((m) => re.test(m.title)), mail = (s, re) => s.inbox.filter((m) => re.test(m.title));
    assert.equal(told(up, /^You took Mojave up$/).length, 1); assert.equal(told(up, /wins the (Elite|Challenger) Series$/).length, 2, 'one story per champion');
    assert.equal(told(up, /^A\. Driver wins the Challenger Series$/).length, 1, 'the player is the Challenger champion'); assert.equal(mail(up, /are promoted$/).length, 1);
    assert.equal(told(dn, /^Mojave go down\. Your contract stands\.$/).length, 1);
    { const Md = await server.ssrLoadModule('/src/game/career/media.js'), x = JSON.parse(JSON.stringify(dn)), sw = { up: 'hayate', down: x.contract.team }; x.media = []; x.contract.dropped = true; Md.coverSwap(x, sw);
      assert.equal(told(x, /contract stands/).length, 0, 'relegated and let go: no "your contract stands"'); assert.equal(x.media.length, 1); x.media = []; x.contract.dropped = false; x.contract.next = { team: 'liberty' }; Md.coverSwap(x, { ...sw, up: x.contract.team, down: 'sarab' });
      assert.equal(told(x, /^You took/).length, 0, 'signed elsewhere: not "you took them up"');
      x.media = []; delete x.contract.next; x.contract.seasonsLeft = 1; Md.coverSwap(x, sw); assert.equal(told(x, /contract stands/).length, 0, 'relegated in the contract\'s last season: no "your contract stands"'); assert.equal(x.media.length, 1); } }
  // ---- the inbox through a season of two series, the copy (16.22) and the giant-kill story
  { const s = signed(4340), notes = [], bad = /(of|\/) 18\b|\b1[68] (drivers|cars)|of 12\b|\/ 8\b|sixteen|eighteen|of the Ultrack Ranking/;   // the old fields (16, then 18); an Open's "the fastest 8 of 16" is today's 20 less its 4 seeds
    assert.ok(/Challenger Series, \d+ rounds.*Top the Challenger Series Teams' table and Mojave go up/.test(s.inbox.find((m) => /^Season 1 with/.test(m.title)).body), 'the season start names the target');
    const seen = new Set(), mails = [], keep = () => { for (const m of s.inbox) if (!seen.has(m.id)) { seen.add(m.id); mails.push(m); } };   // the inbox keeps only the newest
    while (s.clock.phase !== 'review') { if (s.clock.phase === 'paddock') notes.push(C.weekNote(s, C.currentRound(s))); round(s, C.currentRound(s).kind === 'tour' ? 4 : 1); keep(); }
    const tours = s.season.calendar.filter((r) => (r.kind ?? 'tour') === 'tour').length;
    assert.equal(mails.filter((m) => /^Meanwhile in the Elite$/.test(m.title)).length, tours, 'the other series after every Tour round');
    assert.equal(mails.filter((m) => m.title === 'The tables are settled').length, 1, 'once, after the last Tour round');
    assert.ok(notes.some((n) => /All 10 Challenger drivers qualify, and the fastest 8 race\. A first season's grace/.test(n)) && notes.some((n) => /Top 2 of each series go straight to the Final/.test(n)) && notes.some((n) => /Top 5 Elite and top 3 Challenger race the Masters/.test(n)));
    for (const t of [...notes, ...mails.flatMap((m) => [m.title, m.body]), ...s.media.flatMap((m) => [m.title, m.body])]) assert.ok(!bad.test(t), 'no old field size in a season of two series: ' + t);
    assert.ok(mails.some((m) => /Race week: .*Masters/.test(m.title)) && mails.filter((m) => /Race week: .*Masters/.test(m.title)).every((m) => !/Expected P/.test(m.body)), 'the Masters week gives no expected place of 18');
    const rv = s.pending.review; assert.equal(rv.driverCount, 10); assert.equal(rv.teamCount, 5); assert.equal(rv.rankOf, 10);
    assert.ok(s.media.some((m) => /puts the Challenger Series on the podium$/.test(m.title)), 'a Challenger driver on a cup podium makes the papers'); }
  // ---- determinism (16.23): three careers of six seasons, run twice, give the same saves and the same swaps
  for (const seed of [4350, 4351, 4352]) { const a = play(M, seed, [0.975, 1.0, 1.02][seed % 3], 6).save, b = play(M, seed, [0.975, 1.0, 1.02][seed % 3], 6).save;
    assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.deepEqual(a.history.map((h) => h.swap), b.history.map((h) => h.swap)); assert.ok(a.history.every((h) => h.swap));
    for (const d of R.DIV.order) assert.ok(R.carsIn(a, d).length >= R.TUNING.series.gridSize, `the ${d} keeps a full grid`); }   // the market fills every seat (startSeason does not check it)

  // ---- the top eight: teammates can both race, and a missed cut is a round of its own
  { const d = signed(150, 'mojave', 'legacy'), me = d.contract.car, mate = C.teammateCar(d); C.finishQuali(d, 1, 1.001); const q = d.season.current.quali; assert.deepEqual(q.grid.slice(0, 2), [me, mate], 'both cars of a team race'); assert.equal(C.raceSetup(d).drivers[mate].code, d.world.seats[mate]); assert.ok(C.raceSetup(d).pace[mate] > 0, 'the teammate races at his pace');
    const r = C.finishRace(d, { order: q.grid, best: {} }); assert.equal(r.entries.length, R.FIELD); assert.equal(r.entries.filter((e) => !e.dnq).length, 8); assert.ok(r.entries.slice(8).every((e) => e.pts === 0 && e.dnq)); assert.equal(C.standings(d).drivers.length, R.FIELD, 'the table has everyone'); assert.equal(C.standings(d).teams.length, 10); assert.ok(C.standings(d).teams.find((t) => t.team === d.contract.team).pts >= 25 + 18 + 2, 'both cars score for the team');
    const o = signed(151, 'mojave', 'elite'), started = o.stats.starts, wk = o.clock.week; C.finishQuali(o, 999); const place = C.qualiPlace(o.season.current.quali, o.contract.car); const dq = C.finishDnq(o);
    assert.equal(dq.dnq, true); assert.equal(dq.finish, place); assert.equal(dq.grid, place); assert.equal(dq.entries.find((e) => e.you).pts, 0); assert.equal(dq.entries.filter((e) => !e.dnq).length, 8); assert.ok(dq.entries.slice(0, 8).every((e) => !e.you)); assert.ok(dq.entries[0].pts >= 25); assert.equal(o.stats.starts, started, 'no start'); assert.ok(o.clock.week > wk, 'the season moves on'); assert.ok(!dq.coinLines.some(([l]) => /Finished/.test(l)), 'no place money'); assert.ok(dq.rr < 8);
    // the Elite (16.4): ten qualify, the fastest eight race, and a missed cut still runs the Challenger's race
    assert.equal(o.season.div, 'elite'); assert.equal(o.season.current.expPos, 10); assert.equal(o.season.current.field, 10); assert.equal(R.objectiveText(o.season.current.objectives[0]), 'Qualify P9 or better', 'promoted: the cut is the target');
    assert.equal(dq.entries.length, 10); assert.equal(dq.entries.filter((e) => e.dnq).length, 2); assert.ok(dq.entries.every((e) => e.div === 'elite')); assert.equal(dq.other.div, 'challenger'); assert.equal(dq.other.entries.length, 10); assert.equal(dq.other.entries.filter((e) => e.dnq).length, 2, 'the other series has no grace: its slowest two sit out');
    const old = signed(152, 'mojave', 'legacy'), oq = old.season.current; oq.entries = ['x']; C.finishQuali(old, 1); delete oq.quali.order; assert.equal(C.finishRace(old, { order: oq.quali.grid, best: {} }).entries.length, 8, 'a save from before the format plays its round out');
    assert.equal(R.expOf(1, 'A'), 1); assert.equal(R.expOf(1, 'B'), 2); assert.equal(R.expOf(8, 'B'), 16); assert.equal(R.expOf(10, 'B'), R.FIELD); assert.equal(R.expOf(11, 'B'), R.FIELD, 'clamped to the field'); assert.equal(R.objectivesFor(G.rng(1, 'x'), R.FIELD)[0].kind, 'quali'); assert.equal(R.objectivesFor(G.rng(1, 'x'), R.FIELD)[0].n, R.FIELD - 1, 'the last expected asks for one better'); assert.equal(R.objectivesFor(G.rng(1, 'x'), 16)[0].n, 16); assert.equal(R.objectivesFor(G.rng(1, 'x'), 9)[0].kind, 'quali'); assert.equal(R.objectivesFor(G.rng(1, 'x'), 8)[0].n, 7, 'expected on the grid: a finish'); assert.equal(R.objectivesFor(G.rng(1, 'x'), 4)[0].kind, 'finish'); }

  // ---- one retry a round, and a podium ahead of the teammate skips the next qualifying
  { const toRace = (s) => { while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); return s; }, ent = (...k) => k.map((key) => ({ key }));
    assert.deepEqual(R.qualiExemption({ finish: 1, entries: ent('me', 'mate') }, 'mate'), { slot: 1, why: 'your win' }); assert.equal(R.qualiExemption({ finish: 2, entries: ent('mate', 'me') }, 'mate'), null, 'the teammate ahead: qualify');
    assert.equal(R.qualiExemption({ finish: 3, entries: ent('x', 'mate', 'me') }, 'mate'), null); assert.equal(R.qualiExemption({ finish: 3, entries: ent('x', 'y', 'me', 'mate') }, 'mate').slot, 3, 'the teammate behind: skip it');
    assert.equal(R.qualiExemption({ finish: 2, entries: ent('x', 'me') }, 'mate').slot, 2, 'the teammate not classified ahead'); assert.equal(R.qualiExemption({ finish: 4, entries: ent('x', 'y', 'z', 'me') }, 'mate'), null, 'P4 qualifies'); assert.equal(R.qualiExemption({ finish: 1, dnf: true, entries: ent('me') }, 'mate'), null); assert.equal(R.qualiExemption({ finish: 12, dnq: true, entries: ent('me') }, 'mate'), null); assert.equal(R.qualiExemption(undefined, 'mate'), null, 'the first round always qualifies');
    const e = toRace(signed(160)), me = e.contract.car, mate = C.teammateCar(e); assert.equal(e.season.current.exempt, null);
    C.finishQuali(e, 1); assert.equal(C.retriesLeft(e.season.current.quali), 1, 'one retry after the first run'); C.finishQuali(e, 0.9); const q = e.season.current.quali; assert.equal(C.retriesLeft(q), 0, 'and it is used'); assert.equal(q.laps[me], 0.9);
    C.finishRace(e, { order: q.grid, best: {} }); toRace(e); const n = e.season.current.quali, duels = { ...e.contract.duel };
    assert.equal(e.clock.phase, 'race', 'after a win the race is next'); assert.equal(n.exempt.slot, 1); assert.equal(n.grid[0], me); assert.equal(n.grid.length, 8); assert.equal(n.order.length, 10, 'the Challenger'); assert.equal(new Set(n.order).size, 10); assert.notEqual(n.pole, me, 'the pole stays the fastest lap'); assert.ok(n.grid.includes(n.pole)); assert.equal(C.retriesLeft(n), 0); assert.equal(n.duel.skipped, true); assert.ok(!e.season.current.objectives.some((o) => o.kind === 'duel' || o.kind === 'quali'), 'no objective about a session he skips');
    const r2 = C.finishRace(e, { order: n.grid, best: {} }); assert.deepEqual(e.contract.duel, duels, 'no duel that round'); assert.equal(r2.pole, false); assert.equal(r2.entries[0].pts, 25, 'no pole points for the slot'); assert.ok(!r2.rrLines.some(([l]) => /Qualified/.test(l)), 'no qualifying credit'); assert.ok(r2.entries.find((x) => x.key === n.pole).pts >= 2, 'the fastest lap has them'); assert.equal(R.qualiExemption(r2, mate).slot, 1);
    const a = toRace(signed(161)), am = a.contract.car, at = C.teammateCar(a); C.finishQuali(a, 1, 1.001); const ag = a.season.current.quali.grid, ao = [at, am, ...ag.filter((k) => k !== am && k !== at)]; C.finishRace(a, { order: ao, best: {} }); toRace(a); assert.equal(a.season.current.exempt, null, 'second to the teammate: qualify'); assert.equal(a.season.current.quali, null);
    const b = toRace(signed(162)), bm = b.contract.car; C.finishQuali(b, 1); const bg = b.season.current.quali.grid; C.finishRace(b, { order: bg, best: {}, dnf: true }); toRace(b); assert.equal(b.season.current.exempt, null, 'a retirement qualifies'); assert.equal(C.retriesLeft({ tries: undefined }), 1, 'a save from before the limit has its retry'); assert.ok(bm); }

  // ---- the seat map: the player's seat holds YOU, the driver he displaced is a free agent with a grudge
  const m = signed(101);
  assert.equal(m.world.seats.bmw1, 'YOU'); assert.deepEqual(m.world.free, ['QUI']); assert.equal(m.career.heat.QUI, R.TUNING.rivals.displaced); assert.equal(m.career.rivalry.QUI.cause, 'displaced');
  { const mc = m.world.seats[C.teammateCar(m)]; assert.equal(m.career.heat[mc], 20, 'the new teammate starts at 20'); assert.deepEqual(m.career.rivalry[mc], { cause: 'teammate', since: [1, 0], w: 0, l: 0 }); }
  assert.equal(C.driverAt(m, 'bmw1').you, true); assert.equal(C.driverAt(m, 'jaguarxkjss').code, 'LIN');
  assert.equal(C.raceSetup((C.finishQuali(m, 30), m)).drivers.bmw1.name, m.player.name, 'the race shows the player in his car');
  // ---- rivals: finishing near a driver heats it, 40 is a rival, beating him pays; everyone else cools
  const h0 = signed(102); h0.career.heat = { MAD: 85 }; C.finishQuali(h0, 1);
  const hero0 = h0.contract.car, grid0 = h0.season.current.quali.grid, madCar = Object.keys(h0.world.seats).find((k) => h0.world.seats[k] === 'MAD');
  if (!grid0.includes(madCar)) h0.season.current.quali.grid = grid0.map((k) => (R.CAR[k].team === R.CAR[madCar].team ? madCar : k));
  const order0 = [hero0, ...h0.season.current.quali.grid.filter((k) => k !== hero0 && k !== madCar), madCar];
  const r0 = C.finishRace(h0, { order: order0, best: {}, crashes: 0, spins: 0 });
  assert.ok(r0.repLines.some(([l]) => /Nemesis beaten/.test(l)), 'beating the nemesis pays REP'); assert.ok(r0.xpLines.some(([l]) => l === 'Nemesis beaten'));
  assert.ok(h0.career.heat.MAD < 85, 'a driver far away in the order cools'); assert.ok(C.rivalsOf(h0).some((x) => x.code === 'MAD'));
  assert.deepEqual(r0.nemesis, { code: 'MAD', name: C.personOf(h0, 'MAD').name, beat: true }, 'the report names the nemesis');
  // ---- earned rivalries (6.6): only the cars that raced heat up; contacts and passes count; one nemesis a weekend; a head-to-head record
  { const RT = R.TUNING.rivals, W = await server.ssrLoadModule('/src/game/career/world.js');
    const at = (seed) => { const s = signed(seed, 'mojave', 'legacy'); C.finishQuali(s, 1); s.career.heat = {}; s.career.rivalry = {}; const g = s.season.current.quali.grid, me = s.contract.car; return { s, me, raced: [me, ...g.filter((k) => k !== me)], out: s.season.current.quali.order.filter((k) => !g.includes(k)) }; };
    const code = (s, k) => s.world.seats[k];
    { const { s, me, raced, out } = at(170); W.heatAfter(s, raced, me, false);
      assert.ok(out.every((k) => !(code(s, k) in s.career.heat)), 'a driver who did not race gains no heat'); assert.equal(s.career.heat[code(s, raced[1])], RT.close + RT.beat, 'next to you and beaten: +9');
      assert.ok(!(code(s, raced[3]) in s.career.heat), 'two places away: nothing');
      const mc = code(s, out[0]); W.heatAfter(s, raced, me, false, { contacts: {}, passes: {}, duel: mc }); assert.equal(s.career.heat[mc], RT.duel, 'the qualifying duel heats the teammate, raced or not'); assert.equal(s.career.rivalry[mc].cause, 'teammate');
      const sat = s.career.heat[mc]; W.heatAfter(s, raced.slice(1), me, false); assert.equal(s.career.heat[mc], sat - RT.sitOut, 'a round the player sat out cools slowly'); }
    { const s = signed(175, 'mojave', 'elite'), mc = s.world.seats[C.teammateCar(s)]; C.finishQuali(s, 999); assert.ok(!s.season.current.quali.duel.skipped && !s.season.current.quali.grid.includes(s.contract.car));
      s.career.heat[mc] = 30; C.finishDnq(s); assert.equal(s.career.heat[mc], 30 - RT.sitOut, 'a missed cut: no duel heat, the teammate cools as anyone the player did not race'); }
    { const { s, me, raced, out } = at(173), mc = code(s, out[0]), duel = { contacts: {}, passes: {}, duel: mc };
      s.career.heat[mc] = RT.duelMax - 3; W.heatAfter(s, raced, me, false, duel); assert.equal(s.career.heat[mc], RT.duelMax, 'the duel alone stops short of a rival'); assert.ok(RT.duelMax < RT.rival);
      W.heatAfter(s, raced, me, false, duel); assert.equal(s.career.heat[mc], RT.duelMax - RT.decay, 'at the cap a duel adds nothing, so the round cools as any other');
      W.heatAfter(s, raced, me, false, duel); assert.equal(s.career.heat[mc], RT.duelMax, 'and the next duel tops it up to the cap, never past it');
      const far = code(s, raced.at(-1)); s.career.heat[far] = 50; W.heatAfter(s, raced, me, false, { contacts: {}, passes: { [raced.at(-1)]: 1 } }); assert.equal(s.career.heat[far], 50 - RT.decay + RT.pass, 'a pass adds to the cooling, it does not stop it (spec 6.6)');
      const mk = raced[1], mcode = code(s, mk); s.career.heat[mcode] = RT.nemesis - 1; W.heatAfter(s, raced, me, false, { contacts: { [mk]: 1 }, passes: {}, duel: mcode }); assert.ok(s.career.heat[mcode] >= RT.nemesis, 'racing them on top of the duel can make a nemesis'); }
    { const s = signed(174), any = Object.values(s.world.seats).filter((c) => c !== W.YOU).slice(0, 2); s.career.heat = { [any[0]]: 92, [any[1]]: 88 }; const before = JSON.stringify(s.career.heat);
      C.raceSetup(s); assert.equal(JSON.stringify(s.career.heat), before, 'opening a session (no grid yet) changes no heat');
      C.finishQuali(s, 1); const st = C.raceSetup(s); assert.equal(JSON.stringify(s.career.heat), before, 'nor does the race setup'); assert.deepEqual(st.nemesis, W.nemesisAmong(s, st.racers)); }
    { const { s, me, raced } = at(171), [a, b, c] = [raced[3], raced[4], raced[5]];
      W.heatAfter(s, raced, me, false, { contacts: { [a]: 1, [b]: [45], [c]: [12, 50] }, passes: { [a]: 5 } }); s.career.heat[code(s, a)] = 90; W.heatAfter(s, raced, me, false, { contacts: { [a]: 9, [b]: 9 } }); assert.equal(Object.values(s.career.heat).filter((h) => h >= RT.feud).length, 1, 'after a race too, one feud at most');
      s.career.heat = {}; W.heatAfter(s, raced, me, false, { contacts: { [a]: 1, [b]: [45], [c]: [12, 50] }, passes: { [a]: 5 } });
      // three places and more away, so each also cools by the decay, as everyone does (6.6)
      assert.equal(s.career.heat[code(s, a)], RT.contact + 2 * RT.pass - RT.decay, 'a contact +8, and passes count twice at most'); assert.equal(s.career.heat[code(s, b)], RT.contactHard - RT.decay, 'over 30 km/h: +14'); assert.equal(s.career.heat[code(s, c)], RT.contact + RT.contactHard - RT.decay); }
    { const { s, me, raced } = at(172), x = code(s, raced[2]), y = code(s, raced[5]);
      s.career.heat = { [x]: 75, [y]: 75 }; const n1 = W.nemesisOf(s, raced), s2 = at(172).s; s2.career.heat = { [x]: 75, [y]: 75 };
      assert.deepEqual(n1, W.nemesisOf(s2, raced), 'the pick between equals is seeded'); assert.ok([x, y].includes(n1.code)); assert.equal(n1.key, raced.find((k) => code(s, k) === n1.code));
      s.career.heat = { [x]: 95, [y]: 92, ZZZ: 99 }; assert.equal(W.nemesisOf(s, raced).code, x, 'the hottest on the grid'); assert.equal(s.career.heat[y], 79, 'everyone else is held below a feud'); assert.equal(s.career.heat.ZZZ, 79);
      assert.equal(Object.values(s.career.heat).filter((h) => h >= RT.feud).length, 1, 'one feud at most'); assert.equal(C.rivalsOf(s).filter((r) => r.nemesis).length, 1);
      s.career.heat = { [x]: 69 }; assert.equal(W.nemesisOf(s, raced), null, 'nobody at 70: no nemesis'); }
    { const { s, me, raced } = at(173), x = code(s, raced[2]), y = code(s, raced[1]); s.career.heat = { [x]: 50, [y]: 35 }; s.career.rivalry = { [x]: { cause: 'contact', since: [1, 1], w: 2, l: 1 } };
      W.heatAfter(s, raced, me, false); assert.deepEqual([s.career.rivalry[x].w, s.career.rivalry[x].l], [3, 1], 'a rival beaten: one more to you');
      assert.equal(s.career.rivalry[y].cause, 'grid', 'a rivalry at 40 from racing close'); assert.deepEqual(s.career.rivalry[y].since, [1, 1]); assert.equal(s.career.rivalry[y].w, 1);
      W.heatAfter(s, [...raced.slice(1), me], me, true); assert.equal(s.career.rivalry[x].w + s.career.rivalry[x].l, 4, 'a retirement counts in nobody\'s record');
      W.heatAfter(s, [...raced.slice(1), me], me, false); assert.equal(s.career.rivalry[x].l, 2, 'finished behind them: one to them');
      s.career.heat[x] = 50; const r = C.rivalsOf(s).find((v) => v.code === x); assert.deepEqual([r.cause, r.w, r.l, r.nemesis], ['contact', 3, 2, false]);
      s.career.heat[x] = 3; W.heatAfter(s, raced.filter((k) => code(s, k) !== x), me, false); assert.ok(!(x in s.career.heat) && !(x in s.career.rivalry), 'at 0 the rivalry is gone'); }
    { const one = at(174), two = at(174); one.s.career.heat = { [code(one.s, one.raced[4])]: 50 }; two.s.career.heat = { [code(two.s, two.raced[4])]: 50 };
      assert.deepEqual(W.heatAfter(one.s, one.raced, one.me, false), W.heatAfter(two.s, two.raced, two.me, false, { contacts: {}, passes: {} })); assert.deepEqual(one.s.career, two.s.career, 'an empty ev: the same heat for the same seed'); }
    // a schema-7 save: heat capped at 60, a rival keeps 'grid' as their cause, the teammate is seeded
    { const s = signed(175), mc = code(s, C.teammateCar(s)); s.schema = 7; delete s.career.rivalry; s.career.heat = { AAA: 90, BBB: 45, CCC: 10, [mc]: 5 };
      C.migrate(s); assert.equal(s.schema, C.SCHEMA); assert.deepEqual(s.career.heat, { AAA: 60, BBB: 45, CCC: 10, [mc]: 20 }); assert.deepEqual(Object.keys(s.career.rivalry).sort(), ['AAA', 'BBB', mc].sort());
      assert.deepEqual(s.career.rivalry.AAA, { cause: 'grid', since: [1, 0], w: 0, l: 0 }); assert.equal(s.career.rivalry[mc].cause, 'teammate'); }
    // the result plumbing: a race's contacts and passes reach the heat
    { const s = signed(176); C.finishQuali(s, 1); s.career.heat = {}; const g = s.season.current.quali.grid, me = s.contract.car, far = g.filter((k) => k !== me).at(-1), order = [me, ...g.filter((k) => k !== me)];
      C.finishRace(s, { order, best: {}, contacts: { [far]: [40] }, passes: { [far]: 1 } }); assert.equal(s.career.heat[code(s, far)], RT.contactHard + RT.pass - RT.decay, 'far apart in the order: the contact and the pass count, and the round cools them as anyone'); }
  }

  // ---- team package: the first level of the season is free, and it goes through the cap
  const p0 = signed(103), coins0 = p0.wallet.coins; assert.equal(p0.garage.package, 1);
  const pu = C.buyUpgrade(p0, 'tyres', 503); assert.ok(pu.ok && pu.free); assert.equal(p0.wallet.coins, coins0); assert.equal(p0.garage.package, 0); assert.equal(p0.garage.paid.bmw1, 0, 'a gift is not bought back');
  assert.equal(C.upgradeInfo(p0, 'tyres', 503).reason, 'cap');

  // ---- negotiation: inside the leverage it is signed; beyond it the team counters, then withdraws; never a dead end
  const n0 = C.newCareer({ seed: 104, now: 'x' }); C.finishShootout(n0, null);
  const oh = n0.pending.offers[0], base = oh.salary, lev = C.leverageOf(n0, oh);
  assert.equal(lev, 1 + 4 * R.TUNING.offers.firstJobInterest + 2, 'two other teams in hand');
  assert.equal(R.TIERS.teams[oh.team].style, 'bidder'); assert.equal(R.demandOf(oh, { salary: 0.2, seasons: 2, status: 'second' }), 3, 'a bidder gives most on salary: it counts at half'); assert.equal(R.demandOf(oh, { salary: 0, seasons: 1, status: 'junior' }), 0.5);
  assert.equal(C.negotiate(n0, oh.id, { salary: 0.1, seasons: 2, status: 'junior' }).result, 'accepted'); assert.equal(oh.salary, Math.round(base * 1.1 / 5) * 5); assert.ok(oh.agreed && !C.canNegotiate(oh));
  const o2 = n0.pending.offers[1], hard = { salary: 0.3, signing: 0.5, seasons: 1, status: 'second' };   // frugal Mojave gives on signing and status: an unrealistic ask needs all four levers
  const c1 = C.negotiate(n0, o2.id, hard); assert.equal(c1.result, 'countered'); assert.ok(R.demandOf(o2, c1.terms) <= c1.leverage, 'the counter is terms they would sign');
  const rep0 = (n0.career.rep = 20);
  assert.equal(C.negotiate(n0, o2.id, hard).result, 'withdrawn'); assert.equal(n0.career.rep, rep0 + R.TUNING.rep.withdrawn); assert.ok(!n0.pending.offers.includes(o2));
  // ---- the last offer gone: a reserve seat appears
  n0.pending.offers = [n0.pending.offers[1]]; const o3 = n0.pending.offers[0];
  o3.interest = -1; C.negotiate(n0, o3.id, hard); assert.equal(C.negotiate(n0, o3.id, hard).result, 'withdrawn');
  assert.equal(n0.pending.offers.length, 1); assert.ok(n0.pending.offers[0].reserve, 'never a dead end'); assert.ok(!C.canNegotiate(n0.pending.offers[0]));

  // ---- the seat review: a warning under trust 35 at mid-season, recovery clears it, a low trust at the finale is a drop
  const d0 = signed(105, 'mojave', 'legacy'); d0.contract.trust = 30; let dr; const missCut = (s) => { C.finishQuali(s, 999); return C.finishDnq(s); }; for (let i = 0; i < 5; i++) { d0.contract.trust = 30; dr = missCut(d0); }   // the middle of ten rounds, an Open and a Dry Lake qualifying among them
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
  const before = pr.world.seats.jaguarxkjss, mk0 = { ...R.TUNING.market }; pr.pending.offers.unshift({ id: 'x-A', team: 'mojave', seat: 'A', car: 'jaguarxkjss', tier: 'rookie', status: 'lead', salary: 400, seasons: 2 });
  Object.assign(R.TUNING.market, { maxSacks: 0, maxPoach: 0 });   // the swap alone: a sacking or a poach could move the old A driver on, and has its own test
  assert.equal(C.mateOf(pr, pr.pending.offers[0]).code, before, 'the A driver becomes your teammate'); C.acceptOffer(pr, 'x-A', avail); Object.assign(R.TUNING.market, mk0);
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
  // a Sponsor Challenge: six cars at the next round's circuit, the teammate P5 and the player last, two laps; with no deal it is the team's, an Overtake Challenge
  assert.equal(sp2.name, 'Team Overtake Challenge'); assert.deepEqual(sp2.goals, R.TUNING.side.challenge.objectives.top); assert.equal(sp2.objectives.length, 3); assert.equal(sp2.laps, 2); assert.equal(sp2.track, C.roundOfWeek(wk, wk.clock.week).track);
  assert.equal(sp2.racers.length, 6); assert.equal(sp2.gridOrder.at(-1), sp2.hero, 'the player starts last'); assert.equal(sp2.gridOrder[4], C.teammateCar(wk), 'the teammate starts P5'); assert.deepEqual(Object.keys(sp2.pace).sort(), sp2.racers.filter((k) => k !== sp2.hero).sort()); assert.ok(Object.values(sp2.pace).every((v) => v > 0.9 && v < 1));
  assert.equal(new Set(sp2.racers).size, 6); assert.deepEqual(Object.keys(sp2.ai).sort(), Object.keys(sp2.pace).sort(), 'every AI car has its rival profile');
  const ai2 = sp2.gridOrder.slice(0, 5), before2 = wk.wallet.coins, medal = C.finishSide(wk, { order: [ai2[0], ai2[1], sp2.hero, ...ai2.slice(2)], bests: {}, contacts: {}, offTrack: 0, totals: [], dnf: false });
  assert.deepEqual(medal.met, [true, true, false], 'P3 from P6: two objectives'); assert.equal(medal.medal, 2); assert.ok(medal.coins > 0); assert.equal(wk.wallet.coins, before2 + medal.coins); assert.equal(medal.xp, R.TUNING.side.xp[1]);
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
  const f2 = fl.pending.offers[2]; assert.ok(C.walkAway(fl, f2.id)); assert.ok(!fl.pending.offers.includes(f2)); assert.deepEqual(fl.career.ledger.map((e) => [e.kind, e.team]), [["spurned", f2.team]], "a walk-away is remembered"); assert.ok(fl.inbox.some((m) => /turned/.test(m.title)));
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
  toReview(ap, 4); const no = C.approach(ap, 'aurum'); assert.ok(['closed', 'no'].includes(no.result)); ap.career.rep = 500; ap.career.rr = [8, 8, 8, 8, 8, 8]; ap.career.cl = 12; ap.pending.offers = ap.pending.offers.filter((o) => o.team === ap.contract.team); const tm = ['toro', 'sarab', 'corvid'].find((t) => !C.teamOutlook(ap, t).blocked); assert.ok(tm, 'a Maestro door is open: ' + ['toro', 'sarab', 'corvid'].map((t) => C.teamOutlook(ap, t).blocked));
  const yes = C.approach(ap, tm); assert.ok(['offer', 'no'].includes(yes.result)); assert.equal(C.approach(ap, tm).result, 'closed', 'one knock a window');
  // an Elite whose every car out-qualifies the player's seat: the Deals tab says so before the knock, which is not spent (nor leaked)
  { const g = signed(126); toReview(g, 4); g.career.rep = 500; g.career.rr = [8, 8, 8, 8, 8, 8]; g.career.cl = 12; for (const k of R.carsIn(g, 'elite', R.nextDivOf)) g.world.ratings[g.world.seats[k]] = 99;
    const el = R.TEAM_IDS.find((t) => R.nextDivOf(g, t) === 'elite' && R.TIERS.teams[t].tier === 'maestro'); assert.equal(C.teamOutlook(g, el).blocked, 'Elite grid too fast'); assert.equal(C.approach(g, el).result, 'closed'); assert.ok(!g.season.asked[el]); }
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
  assert.equal(C.eventName(sk, { kind: 'open', event: { kind: 'sponsor' } }), 'Team Overtake Challenge');

  // ---- the Sponsor Challenge (4.2): every objective, every kind, a retirement, the deals taking turns, goodwill and its cap, gold toward the target once a season, an old drift result
  { const X = R.TUNING.side.challenge, spec = { hero: 'H', mate: 'M', racers: ['A', 'B', 'C', 'D', 'M', 'H'], par: 100 };
    const base = { order: ['A', 'B', 'H', 'C', 'D', 'M'], bests: { A: 101, B: 101, C: 101, D: 101, M: 101, H: 100.4 }, contacts: {}, offTrack: 0, totals: [['A', 200], ['B', 201], ['H', 202], ['C', 203], ['D', 204], ['M', 206]], dnf: false };
    const win = { ...base, order: ['H', 'A', 'B', 'C', 'D', 'M'], totals: [['H', 200], ['A', 202], ['B', 203], ['C', 204], ['D', 205], ['M', 206]] };
    const one = (goal, v) => R.challengeMet({ ...spec, goals: [goal] }, v)[0];
    const table = [
      [['gain', 2], base, true], [['gain', 2], { ...base, order: ['A', 'B', 'C', 'D', 'H', 'M'] }, false],
      [['top', 3], base, true], [['top', 3], { ...base, order: ['A', 'B', 'C', 'H', 'D', 'M'] }, false], [['top', 1], win, true], [['top', 1], base, false],
      [['podiumClean', 0], base, true], [['podiumClean', 0], { ...base, contacts: { A: [22] } }, false],
      [['winBy', 1.5], win, true], [['winBy', 1.5], { ...win, totals: [['H', 200], ['A', 201]] }, false],
      [['noContact', 0], base, true], [['noContact', 0], { ...base, contacts: { C: 1 } }, false],
      [['offMax', 0], base, true], [['offMax', 0], { ...base, offTrack: 1 }, false], [['offMax', 2], { ...base, offTrack: 2 }, true],
      [['cleanTop', 3], base, true], [['cleanTop', 3], { ...base, offTrack: 1 }, false], [['cleanTop', 3], { ...base, contacts: { A: [10, 40] } }, false],
      [['lapPar', 1.02], base, true], [['lapPar', 1.005], base, true], [['lapPar', 1.005], { ...base, bests: { ...base.bests, H: 100.6 } }, false], [['lapPar', 1.02], { ...base, bests: { ...base.bests, H: null } }, false],
      [['fastest', 0], base, true], [['fastest', 0], { ...base, bests: { ...base.bests, B: 100.1 } }, false],
      [['passMate', 0], base, true], [['passMate', 0], { ...base, order: ['A', 'B', 'M', 'H', 'C', 'D'] }, false],
      [['beatMate', 0], base, true], [['beatMate', 0], { ...base, bests: { ...base.bests, M: 100 } }, false], [['beatMate', 0], { ...base, bests: { ...base.bests, M: null } }, true],
      [['beatMateBy', 2], base, true], [['beatMateBy', 2], { ...base, totals: [['H', 202], ['M', 203]] }, false],
    ];
    for (const [goal, v, want] of table) assert.equal(one(goal, v), want, `${goal.join(' ')} should be ${want}`);
    const types = new Set(table.map(([[k]]) => k));
    for (const [kind, goals] of Object.entries(X.objectives)) {
      assert.ok(kind in X.name && goals.length === 3, kind); assert.ok(goals.every(([k]) => types.has(k) && R.challengeText([k, 1])), `every ${kind} objective is tested and has words`);
      const met = R.challengeMet({ ...spec, goals }, win); assert.ok(met.length === 3 && met.every((b) => typeof b === 'boolean'));
      assert.deepEqual(R.challengeMet({ ...spec, goals }, { ...win, dnf: true }), [false, false, false], `a retirement meets no ${kind} objective`); }
    assert.deepEqual(R.challengeMet({ ...spec, goals: X.objectives.top }, win), [true, true, true]); assert.equal(R.sideMedal('sponsor', [true, false, true]), 2);
    assert.equal(R.challengeText(['lapPar', 1.005]), 'A lap within 0.5 % of par'); assert.equal(R.challengeText(['top', 1]), 'Win');
    // the deals take turns, by sponsor days already gone this season; the name is the deal's and its wish
    const deal = (brand, name, kind, mood = 2, count = 3) => ({ brand, name, retainer: 80, bonus: 400, target: { kind, n: 1, count }, progress: 0, met: false, mood });   // n 1: the P4 races between never meet it
    const rot = signed(1400); rot.sponsors.deals.push(deal('shell', 'Shell', 'top'), deal('rolex', 'Rolex', 'quali')); const sw = rot.season.weeks.filter((w) => w.event?.kind === 'sponsor');
    assert.ok(sw.length >= 3, 'three or more sponsor days a season'); assert.deepEqual(sw.slice(0, 3).map((w) => C.eventName(rot, w)), ['Shell Overtake Challenge', 'Rolex Hot Lap Challenge', 'Shell Overtake Challenge']);
    const toDay = (s) => { while (C.currentWeek(s).event?.kind !== 'sponsor' || C.currentWeek(s).event.result) { if (C.currentWeek(s).kind === 'race') round(s, 4); else C.advanceWeek(s); } return C.sideSpec(s); };
    const run = (s, place) => { const x = toDay(s), ai = x.gridOrder.filter((k) => k !== x.hero); return C.finishSide(s, place ? { order: [...ai.slice(0, place - 1), x.hero, ...ai.slice(place - 1)], bests: {}, contacts: {}, offTrack: 0, totals: [], dnf: false } : { order: [...ai, x.hero], dnf: true }); };
    assert.equal(toDay(rot).deal.name, 'Shell'); assert.deepEqual(toDay(rot).goals, X.objectives.top); run(rot, 4); assert.equal(toDay(rot).deal.name, 'Rolex', 'the next day serves the other deal'); assert.deepEqual(toDay(rot).goals, X.objectives.quali);
    // a done day keeps the name and objectives it ran under, whatever the deals do later
    const d0 = sw.find((w) => w.event.result); assert.equal(d0.event.result.name, 'Shell Overtake Challenge'); assert.deepEqual(d0.event.result.objectives, X.objectives.top.map(R.challengeText)); assert.equal(d0.event.result.met.length, 3);
    rot.sponsors.deals.unshift(deal('jio', 'Jio', 'quali')); assert.equal(C.eventName(rot, d0), 'Shell Overtake Challenge', 'a signing never renames a past day'); rot.sponsors.deals.shift();
    // goodwill: gold +1 up to startMood + 3, silver and bronze nothing, no medal -1 down to 1 (never ending the deal); only the deal the day serves
    const cap = R.SPONSORS.startMood + 3, gw = signed(1401); gw.sponsors.deals.push(deal('shell', 'Shell', 'top', cap));
    assert.equal(run(gw, 1).medal, 3); assert.equal(gw.sponsors.deals[0].mood, cap, 'capped'); assert.equal(run(gw, 4).medal, 1); assert.equal(gw.sponsors.deals[0].mood, cap, 'bronze: no change');
    const dnf = run(gw, 0); assert.equal(dnf.medal, 0, 'a retirement: no medal'); assert.deepEqual(dnf.met, [false, false, false]); assert.equal(dnf.coins, 0); assert.equal(gw.sponsors.deals[0].mood, cap - 1, 'no medal: -1');
    const lo = signed(1402); lo.sponsors.deals.push(deal('shell', 'Shell', 'top', 1), deal('rolex', 'Rolex', 'quali', 2)); assert.equal(run(lo, 6).medal, 0); assert.equal(lo.sponsors.deals.length, 2, 'a bad result never ends a deal'); assert.deepEqual(lo.sponsors.deals.map((d) => d.mood), [1, 2], 'floored at 1, and only the served deal moves');
    // a gold is a step toward the served deal's season target, once a season; on the last step it pays the bonus
    const tg = signed(1403); tg.sponsors.deals.push(deal('shell', 'Shell', 'top', 2, 3)); run(tg, 1); assert.equal(tg.sponsors.deals[0].progress, 1); run(tg, 1); assert.equal(tg.sponsors.deals[0].progress, 1, 'once a season');
    const tb = signed(1404); tb.sponsors.deals.push(deal('shell', 'Shell', 'top', 2, 1)); toDay(tb); const c0 = tb.wallet.coins, g1 = run(tb, 1); assert.ok(tb.sponsors.deals[0].met); assert.ok(g1.coins >= 400, 'the bonus comes with the gold'); assert.equal(tb.wallet.coins, c0 + g1.coins); assert.ok(tb.inbox.some((m) => m.title === 'Shell pays the bonus'));
    // an old save's drift result (a score) still reads: the screens show the medal, never the value
    const od = signed(1405); toDay(od); C.currentWeek(od).event.result = { kind: 'sponsor', value: 26000, medal: 2, xp: 50, coins: 300, package: 0 }; const od2 = JSON.parse(JSON.stringify(od)); C.migrate(od2);
    assert.equal(C.sideSpec(od2), null, 'done is done'); assert.equal(C.currentWeek(od2).event.result.medal, 2); assert.match(C.eventName(od2, C.currentWeek(od2)), /Overtake Challenge$/);
    const fs = await import('node:fs'); for (const f of ['career-hub.js', 'career-ui.js', 'career-deals.js']) assert.ok(!/result\??\.value/.test(fs.readFileSync(new URL(`../src/game/${f}`, import.meta.url), 'utf8')), `${f} reads the medal, not the value`); }

  // ---- migration: a P1 save gets the seat map, and an unknown schema is not guessed at
  const old = signed(113); delete old.world.seats; delete old.world.free; delete old.world.retired; delete old.world.academy; delete old.career.heat; delete old.garage.package; old.schema = 1;
  const mig = C.migrate(old); assert.equal(mig.schema, C.SCHEMA); assert.equal(mig.world.seats.bmw1, 'YOU'); assert.deepEqual(mig.world.free, ['QUI']); assert.deepEqual(mig.career.heat, { [mig.world.seats[C.teammateCar(mig)]]: 20 }, 'no heat but the teammate seeded at schema 8');
  assert.equal(C.migrate({ schema: 99 }), null); assert.equal(C.migrate(null), null);
  { const g = signed(131); g.sponsors.deals = [{ name: 'X', mood: 9 }, { name: 'Y', mood: 2 }]; C.migrate(g); assert.deepEqual(g.sponsors.deals.map((d) => d.mood), [5, 2], 'goodwill from uncapped drift days comes down to the cap, so a gold never reads as goodwill down'); }
  const v3 = signed(130); round(v3, 3); round(v3, 3); v3.schema = 3; delete v3.inbox; delete v3.inboxN; delete v3.sponsors; delete v3.clock.week; const wo3 = { id: 'o', team: 'toro', seat: 'B', car: 'huracan', tier: 'maestro', status: 'junior', salary: 500, signing: 1000, seasons: 2, why: 'x' };
  delete v3.season.weeks; delete v3.season.mid; delete v3.season.asked; v3.season.w1 = { offer: wo3, state: 'open' }; v3.season.current.side = { kind: 'test', result: null }; v3.season.calendar[4].track = 'infinia'; v3.season.calendar[4].look = 'night'; v3.player.code = 'VAL';
  C.migrate(v3); assert.equal(v3.schema, C.SCHEMA); assert.equal(C.currentWeek(v3).kind, 'race'); assert.equal(C.currentWeek(v3).round, v3.clock.round, 'a season under way lands on its round'); assert.equal(v3.season.weeks[1].result.finish, 3, 'the rounds raced are on the calendar');
  assert.equal(v3.season.mid[0].id, 'o', 'an open offer survives'); assert.equal(v3.season.w1, undefined); assert.equal(v3.season.current.side, undefined); assert.equal(v3.season.calendar[4].look, 'dusk'); assert.notEqual(v3.player.code, 'VAL'); assert.deepEqual(v3.sponsors, { deals: [], offers: [] }); assert.ok(v3.inbox.length);
  C.finishQuali(v3, 60); assert.ok(C.finishRace(v3, { order: v3.season.current.quali.grid, best: {} }).rr, 'and it plays on');
  const v3r = signed(131); toReview(v3r, 3); v3r.schema = 3; delete v3r.season.weeks; delete v3r.clock.week; delete v3r.sponsors; delete v3r.inbox; C.migrate(v3r); assert.equal(C.currentWeek(v3r).kind, 'end', 'a save at the review stays there'); C.acceptOffer(v3r, v3r.pending.offers[0].id, avail); assert.equal(v3r.clock.season, 2);

  // ---- the Ultrack Ranking: seeded from the ratings, the player below the field, points by place and event, a rolling window, carried across seasons
  { const K = await server.ssrLoadModule('/src/game/career/ranking.js'), s = signed(300), r0 = K.rankingOf(s, 'all');
    assert.equal(r0.length, R.FIELD); assert.equal(r0[0].code, Object.entries(s.world.ratings).sort((a, b) => b[1] - a[1])[0][0], 'the best-rated driver starts first'); assert.equal(r0.at(-1).code, 'YOU', 'the player starts at the bottom'); assert.deepEqual(r0.map((x) => x.rank), [...Array(R.FIELD).keys()].map((i) => i + 1));
    assert.equal(K.rankPoints(0, 'tour'), 25); assert.equal(K.rankPoints(0, 'open'), 62.5); assert.equal(K.rankPoints(0, 'masters'), 75); assert.equal(K.rankPoints(9, 'tour'), 0);
    const w = R.TUNING.ranking.window, t = signed(301); const r1 = K.playerRank(t); K.addDay(t, { YOU: 100 }); assert.ok(K.playerRank(t) < r1, 'a big day lifts the player');
    for (let i = 0; i < w; i++) K.addDay(t, {}); assert.equal(t.ranking.days.length, w, 'only the last window of days is kept'); assert.equal(K.rankingOf(t).find((x) => x.you).pts, 0, 'the day fell out of the window, and the seed has faded');
    // two tables from one store (16.13): the player's series by default, a Challenger Tour win at 0.6 of an Elite one, the cups alike for everyone
    assert.deepEqual(['elite', 'challenger', 'all'].map((d) => K.rankingOf(s, d).length), [10, 10, 20]); assert.equal(K.rankingOf(s).length, 10); assert.equal(K.rankingOf(s).at(-1).you, true, 'the player starts last of the Challenger');
    assert.deepEqual(K.rankingOf(s, 'elite').map((x) => x.code), r0.filter((x) => R.divOf(s, R.CAR[x.key].team) === 'elite').map((x) => x.code), 'each table in the one order'); assert.equal(K.rankPoints(0, 'tour', 0.6), 15);
    const a = signed(302); const ar = round(a, 1, 1); assert.equal(ar.rank.pts, 15, 'a Challenger win scores 15'); assert.equal(a.ranking.days[0][ar.other.entries[0].code], 25, 'an Elite win 25'); assert.equal(a.ranking.days[0][ar.entries[1].code], 10.8, 'a Challenger P2 18 x 0.6'); assert.equal(a.ranking.n, 1, 'one day for both series');
    assert.equal(K.playerRank(a), K.rankingOf(a).find((x) => x.you).rank); assert.ok(K.playerRank(a) <= 10); }

  // ---- the Open in a season from before the two series (a migrated save's season finishes so): the top 4 go straight to the Final; ranks 5-20 fly one lap at Dry Lake, race the Last Chance there, and its top 4 reach the Final
  { const OPENCIRCUITS = ['tokyo', 'infinia', 'venice'], toRound = (s, kind) => { while (C.currentRound(s).kind !== kind) round(s, 4, 999); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); return s; };
    // seeded: rank 1, no qualifying, the Final is the only race
    const top = signed(310, 'mojave', 'legacy'); round(top, 4, 999); top.ranking.seed.YOU = 1e5; round(top, 4, 999); assert.equal(C.currentRound(top).kind, 'open', 'round 3 is the Japan Open'); assert.equal(top.season.current.open.rank, 1, 'rank is taken when the round is prepared');
    while (C.currentWeek(top).kind !== 'race') C.advanceWeek(top);
    const co = top.season.current.open, q = top.season.current.quali; assert.equal(co.seeded, true); assert.equal(co.stage, 'final'); assert.equal(top.clock.phase, 'race', 'no qualifying for a seed');
    assert.equal(q.grid.length, 8); assert.equal(q.order.length, R.FIELD); assert.equal(new Set(q.order).size, R.FIELD); assert.equal(q.grid[0], top.contract.car, 'the ranking leader starts on pole'); assert.deepEqual(q.grid.slice(0, 4), co.seeds, 'the seeds start first, in ranking order');
    assert.deepEqual(q.grid.slice(4), co.lcq.through, 'then the Last Chance finishers in the order they finished'); assert.ok(C.retriesLeft(q) === 0); assert.equal(C.finishQuali(top, 1), top, 'a seed has no qualifying to fly');
    const setup = C.raceSetup(top); assert.equal(setup.track, 'tokyo'); assert.equal(setup.laps, C.currentRound(top).laps); assert.equal(setup.label, 'Japan Open Final'); assert.equal(setup.orders, null, 'no team orders in an Open'); assert.equal(setup.racers.length, 8); assert.deepEqual(setup.gridOrder, q.grid);
    assert.equal(C.practiceLocked(top), null, 'practice opens at the Final'); assert.ok(top.inbox.some((m) => /Last Chance Qualifier/.test(m.title)), 'the inbox says who got through');
    const day = top.wallet.coins, won = round(top, 1), win = won.coinLines.find(([l]) => l === 'Win bonus')[1];
    assert.equal(won.kind, 'open'); assert.equal(won.finish, 1); assert.equal(win, R.TIERS.tiers.rookie.bonus.win * 3, 'a Final pays three times the win bonus'); assert.ok(won.rank.after <= won.rank.before && won.rank.pts === 62.5, 'and a big ranking swing');
    assert.equal(top.stats.openWins.tokyo, 1); assert.equal(top.hall.at(-1).you, true); assert.equal(top.hall.at(-1).id, 'tokyo'); assert.equal(won.entries[0].pts, 25 * 1.5 + 2 + 1, 'the Final scores x1.5 in the season table, with pole and the fastest lap'); assert.ok(top.wallet.coins > day);
    assert.ok(won.rr >= 7, 'a win from pole in a decent car rates well: a seed is not marked down for skipping qualifying'); assert.ok(won.rrLines.some(([l]) => /Skipped qualifying on merit/.test(l)));

    // not seeded: qualifying at Dry Lake among the sixteen, the fastest 8 race the Last Chance there, the top 4 reach the Final
    const mid = signed(311, 'mojave', 'legacy'); toRound(mid, 'open'); const o = mid.season.current.open; assert.equal(o.seeded, false); assert.equal(o.stage, 'quali'); assert.equal(mid.clock.phase, 'paddock'); assert.ok(o.rank >= 5);
    assert.equal(C.practiceLocked(mid), 'The Japan Open circuit stays fresh until the Final.'); assert.equal(mid.season.current.objectives[0].kind, 'reach'); assert.equal(R.objectiveText(mid.season.current.objectives[0]), 'Reach the Japan Open Final');
    assert.equal(C.qualiVenue(mid).track, 'drylake'); C.finishQuali(mid, 1); const mq = mid.season.current.quali; assert.equal(o.stage, 'lcq'); assert.equal(mq.order.length, R.FIELD - 4, 'all but the seeds fly a lap'); assert.ok(o.seeds.every((k) => !mq.order.includes(k)), 'the seeds do not'); assert.equal(mq.grid.length, 8);
    assert.equal(mq.order[0], mid.contract.car, 'a lap of 1 s is the fastest'); assert.equal(C.retriesLeft(mq), 1, 'qualifying keeps its retry');
    const ls = C.raceSetup(mid); assert.equal(ls.track, 'drylake'); assert.equal(ls.laps, C.currentRound(mid).lcqLaps); assert.equal(ls.label, 'Last Chance Qualifier'); assert.equal(ls.orders, null, 'nor in its Last Chance'); assert.equal(ls.racers.length, 8); assert.ok(ls.laps >= 2 && ls.laps <= 3);
    const lcq = C.finishLcq(mid, { order: [mid.contract.car, ...mq.grid.filter((k) => k !== mid.contract.car)], best: {} }); assert.equal(lcq.lcq, true); assert.equal(lcq.through, true); assert.equal(lcq.finish, 1); assert.equal(lcq.entries.filter((e) => e.advanced).length, 4);
    const fq = mid.season.current.quali; assert.equal(o.stage, 'final'); assert.equal(fq.grid.length, 8); assert.deepEqual(fq.grid.slice(0, 4), o.seeds); assert.equal(fq.grid[4], mid.contract.car, 'he won the Last Chance: first of the qualifiers, behind the four seeds'); assert.equal(fq.order.length, R.FIELD); assert.equal(new Set(fq.order).size, R.FIELD); assert.equal(mid.clock.phase, 'race');
    assert.equal(C.raceSetup(mid).track, 'tokyo'); assert.equal(C.practiceLocked(mid), null); const wk1 = mid.clock.week, fin = round(mid, 5); assert.equal(fin.kind, 'open'); assert.equal(fin.dnq, false); assert.equal(fin.open.lcq, 1); assert.ok(fin.objectives[0].met, 'Reach the Final is met'); assert.ok(mid.clock.week > wk1, 'and the season moves on');

    // beaten in the Last Chance (or retired in it): the Final runs without him, the round is scored as a missed cut, the season goes on
    for (const dnf of [false, true]) {
      const out = signed(312 + +dnf, 'mojave', 'legacy'); toRound(out, 'open'); C.finishQuali(out, 1); const oq = out.season.current.quali, me = out.contract.car, rival = oq.grid.filter((k) => k !== me), wk0 = out.clock.week, st0 = out.stats.starts;
      const rep = C.finishLcq(out, { order: [...rival, me].slice(0, 8), best: {}, dnf }); assert.notEqual(rep.lcq, true, 'out of the Last Chance, the report is the round\'s'); assert.equal(rep.dnq, true); assert.equal(rep.lcq.through, false); assert.equal(rep.lcq.finish, 8);
      assert.equal(rep.entries.filter((e) => !e.dnq).length, 8); assert.ok(rep.entries.slice(0, 8).every((e) => !e.you)); assert.equal(out.stats.starts, st0); assert.ok(out.clock.week > wk0, 'it does not dead-end the season'); assert.equal(out.clock.phase, 'paddock');
      assert.equal(rep.rank.pts, 0); assert.ok(out.hall.at(-1) && !out.hall.at(-1).you, 'a rival wins the Open and the hall says so'); assert.ok(out.media.some((m) => /misses the Japan Open Final/.test(m.title)), 'the press covers it'); assert.ok(!rep.objectives[0].met);
    }
    // missed the cut in qualifying, and sat out
    const cut = signed(314, 'mojave', 'legacy'); toRound(cut, 'open'); C.finishQuali(cut, 999); assert.ok(!cut.season.current.quali.grid.includes(cut.contract.car)); const dq = C.finishDnq(cut); assert.equal(dq.dnq, true); assert.equal(dq.entries.filter((e) => !e.dnq).length, 8); assert.equal(cut.clock.phase, 'paddock');
    // never flew a lap and the game reloaded into a race: it still resolves
    const lost = signed(315, 'mojave', 'legacy'); toRound(lost, 'open'); assert.equal(C.finishRace(lost, { order: [], best: {} }).dnq, true);
    const lr = lost.season.results.at(-1); assert.equal(lr.trust, Math.round((lr.rr - R.TUNING.rating.base) * R.TUNING.trust.perRR), 'missing an Open costs trust only through the rating: the ranking decides its objective');
  }
  // ---- the market, rivals, life and the Sponsor Challenge with two series (16.16-16.20)
  { const Of = await server.ssrLoadModule('/src/game/career/offers.js'), W = await server.ssrLoadModule('/src/game/career/world.js'), Li = await server.ssrLoadModule('/src/game/career/life.js'), CAR0 = R.CAR, Wm = W;
    // a team of the player's tier going up is a step up: no strong-year rule, no cap, a full roll
    const offered = (promote) => { let n = 0; for (let seed = 4501; seed < 4541; seed++) { const s = signed(seed); s.career.rr = [6, 6, 6]; if (promote) { s.world.teams.liberty.div = 'elite'; s.world.teams.sarab.div = 'challenger'; s.world.teams.liberty.expPos = 3.5; for (const k of R.carsIn(s, 'elite', R.nextDivOf)) if (CAR0[k].team !== 'liberty') s.world.ratings[s.world.seats[k]] = 60; }   // an Elite rated 60 lets a Rookie car make its grid with room to spare (offGrid)
      const l = Of.seasonOffers(s, { cup: false, title: false, dropped: false }).filter((o) => o.team === 'liberty'); if (l.length) { n++; assert.equal(l[0].div, promote ? 'elite' : 'challenger', 'the offer carries next season\'s series'); } } return n; };
    assert.equal(offered(false), 0, 'a same-tier Challenger team wants a strong year for a B-seat driver'); assert.ok(offered(true) > 0, 'a promoted one of the same tier does not');
    { const s = signed(4502); s.clock.phase = 'review'; s.contract.seat = 'A'; s.world.teams.liberty.div = 'elite'; s.world.teams.sarab.div = 'challenger';
      assert.equal(Of.stepUp(s, 'liberty'), false, 'last of the Elite (its A seat expected P9 of 10): no step up'); assert.equal(Of.teamOutlook(s, 'liberty').blocked, 'No step up');
      s.world.teams.liberty.expPos = 3.5; assert.equal(R.expIn(s, 'liberty', 'A', R.nextDivOf), 7);
      // and for this driver in it (offGrid): their market rating in the seat's car against next season's Elite cars and drivers
      const rate = (v) => { for (const k of R.carsIn(s, 'elite', R.nextDivOf)) if (CAR0[k].team !== 'liberty') s.world.ratings[s.world.seats[k]] = v; };
      s.world.ratings[s.world.seats[C.teammateCar(s)]] = 99;   // the player is rated as their teammate before any duel
      rate(99); assert.equal(Of.offGrid(s, 'liberty', 'A'), true, 'against an Elite rated 99 a Rookie car qualifies at the back or outside the grid'); assert.equal(Of.stepUp(s, 'liberty'), false, 'so it is no step up');
      s.world.teams.mojave.div = 'elite'; assert.equal(Of.offGrid(s, 'liberty', 'A'), false, 'their own team goes up too: the seat is no worse than staying'); s.world.teams.mojave.div = 'challenger';
      assert.equal(Of.offGrid(s, 'hayate', 'A'), false, 'a Challenger seat is never off the Elite grid'); assert.equal(Of.outsideOffer(s, 'liberty', 0.9), null, 'no seat of it is offered');
      rate(60); assert.equal(Of.offGrid(s, 'liberty', 'A'), false);
      assert.equal(Of.stepUp(s, 'liberty'), true); assert.equal(Of.stepUp(s, 'hayate'), false); assert.equal(Of.teamOutlook(s, 'liberty').step, 'A step up: Elite Series'); assert.notEqual(Of.teamOutlook(s, 'liberty').blocked, 'No step up');
      assert.equal(Of.teamOutlook(s, 'hayate').blocked, 'No step up', 'a same-tier Challenger team from an A seat'); assert.equal(Of.teamOutlook(s, 'hayate').step, null); }
    // approach() follows the same rule: a step up skips the A seat's rating bar; a same-tier Challenger team does not
    { const s = toReview(signed(4509), 4), W0 = s.world.teams; s.contract.seat = 'A'; s.contract.next = null; s.career.rep = 500; s.career.cl = 12; s.career.rr = [6, 6, 6, 6, 6, 6];
      W0.mojave.div = 'challenger'; W0.hayate.div = 'challenger'; W0.liberty.div = 'elite'; W0.liberty.expPos = 3.5; assert.ok(6 < R.TUNING.offers.sameTierRR);
      for (const k of Object.keys(s.world.seats)) if (s.world.seats[k] !== 'YOU') s.world.ratings[s.world.seats[k]] = R.carsIn(s, 'elite', R.nextDivOf).includes(k) && R.CAR[k].team !== 'liberty' ? 60 : 99;
      for (const t of R.TEAM_IDS) W0[t].dev = [0, 0, 0, 0, 0]; for (const r of s.season.results) r.duel = null;   // stock cars (a season of seeded development otherwise), a slow Elite and a fast driver (no duel left: rated as the field): the seat makes its grid (offGrid)
      const up = C.approach(s, 'liberty'); assert.ok(['offer', 'no'].includes(up.result), up.why); assert.ok(!/takes an average rating/.test(up.why), 'no A-seat rating bar for a step up: ' + up.why);
      const same = C.approach(s, 'hayate'); assert.equal(same.result, 'closed'); assert.equal(same.why, 'No step up'); }
    // the review's second round: what a Challenger round keeps (rep, coins), a cup pays whole, the duel's heat by field, a Rookie's trust floor, and an Elite driver beaten from the Challenger
    { const ch = R.TUNING.divisions.challenger, P = R.TUNING.rep, E = R.TUNING.events, r5 = (v) => Math.round(v / 5) * 5, line = (l, k) => l.find((x) => x[0] === k)?.[1];
      const a = signed(4611), w = round(a, 1), Tr = R.TIERS.tiers[a.season.tier]; assert.equal(a.season.div, 'challenger');
      assert.equal(line(w.repLines, 'Win'), Math.round(P.win * ch.rep), 'a Challenger win pays its share of reputation');
      assert.equal(line(w.coinLines, 'Win bonus'), r5(Tr.bonus.win * ch.reward), 'and its share of the win bonus, to 5 U'); assert.ok(w.coinLines.every((l) => Number.isInteger(l[1])), 'no half coins: ' + JSON.stringify(w.coinLines));
      const pd = round(a, 2); assert.equal(line(pd.coinLines, 'Podium bonus'), r5(Tr.bonus.podium * ch.reward)); assert.ok(Number.isInteger(pd.coins));
      const el = signed(4612, 'mojave', 'elite'), we = round(el, 1); assert.equal(el.season.div, 'elite'); assert.equal(line(we.repLines, 'Win'), P.win, 'an Elite win pays in full'); assert.equal(line(we.coinLines, 'Win bonus'), R.TIERS.tiers[el.season.tier].bonus.win);
      while (C.currentRound(a).kind !== 'open') round(a, 4); while (C.currentWeek(a).kind !== 'race') C.advanceWeek(a);
      // at an Open: the sponsor target reads the series place as in a Tour week; a callout on an Elite nemesis states the higher stake; beating an Elite rival pays the higher tier's
      { const S = a.sponsors; S.deals = []; S.offers = []; Of.sponsorOffers(a, a.clock.week + 1); assert.ok(S.offers.length); for (const o of S.offers) assert.deepEqual(o.target, R.targetFor(R.SPONSORS.brands[o.brand].target, R.expIn(a, a.contract.team, a.contract.seat), a.season.calendar.length)); S.offers = []; }
      const X = await server.ssrLoadModule('/src/game/career/choices.js'), elite = R.carsIn(a, 'elite').map((k) => a.world.seats[k]), heat0 = a.career.heat;
      const r0 = a.world.ratings[elite[0]]; a.world.ratings[elite[0]] = 65;   // a shaky driver: easily rattled
      const calls = elite.map((c) => { a.career.heat = { [c]: R.TUNING.rivals.nemesis + 5 }; return X.TRIGGERS.callout(a); }).filter(Boolean); a.career.heat = heat0; a.world.ratings[elite[0]] = r0;
      assert.ok(calls.length, 'some Elite driver is rattled enough'); for (const c of calls) assert.equal(c.stake, Math.round(X.CHOICES.callout.win.rep * X.CHOICES.callout.higherTier), 'an Elite nemesis is a higher stake for a Challenger driver');
      const foe = elite[0]; a.career.heat = { [foe]: R.TUNING.rivals.rival }; const op = round(a, 1), name = C.personOf(a, foe).name;
      assert.equal(line(op.repLines, `Rival beaten: ${name}`), Math.round(R.TUNING.rivals.rep * R.TUNING.rivals.higherTier), 'an Elite rival beaten from the Challenger pays as a higher tier');
      assert.ok(line(op.repLines, 'Giant-killing') > 0, 'beating Elite drivers expected ahead is giant-killing'); assert.equal(line(op.repLines, 'Win'), Math.round(P.win * E.open.rep), 'a cup pays a Challenger driver whole');
      assert.equal(line(op.coinLines, 'Win bonus'), Tr.bonus.win * E.open.prize, 'and its whole win bonus');
      // the duel's heat in a series of 8: at most rivals.duel x 8/16 a round, and it stops at duelMax x 8/16
      const d = signed(4613); while (C.currentWeek(d).kind !== 'race') C.advanceWeek(d); const me = d.contract.car, mt = C.teammateCar(d), code = d.world.seats[mt], f = d.season.current.field / R.TUNING.divisions.legacyField;
      const far = [me, ...R.carsIn(d, 'challenger').filter((k) => k !== me && k !== mt), mt]; d.career.heat = {};
      Wm.heatAfter(d, far, me, false, { contacts: {}, passes: {}, duel: code }); assert.equal(d.career.heat[code], R.TUNING.rivals.duel * f);
      d.career.heat[code] = R.TUNING.rivals.duelMax * f - 1; Wm.heatAfter(d, far, me, false, { contacts: {}, passes: {}, duel: code }); assert.equal(d.career.heat[code], R.TUNING.rivals.duelMax * f, 'the duel stops at its cap');
      Wm.heatAfter(d, far, me, false, { contacts: {}, passes: {}, duel: code }); assert.equal(d.career.heat[code], R.TUNING.rivals.duelMax * f - R.TUNING.rivals.decay, 'at the cap it adds nothing, and the heat cools as any round');
      // a Rookie in the Challenger loses no more trust a round than a missed cut did: last, from the back
      const t = signed(4614, 'hayate'), floor = R.trustFor({ rr: R.TUNING.rating.base + R.TUNING.rating.dnq, optional: 0, neutral: true }), lt = round(t, 8);
      assert.ok(lt.rr < R.TUNING.rating.base + R.TUNING.rating.dnq, 'a bad round: ' + lt.rr); assert.equal(lt.trust, floor);
      assert.ok(w.trust > floor, 'a good round keeps what it earns'); }
    // an Open's Last Chance keeps 2 places for the Challenger: an Elite lap in the top 8 can be pushed out, and the lap to beat is the slowest Elite one on the grid
    { const s = signed(4621, 'mojave', 'elite'); while (C.currentRound(s).kind !== 'open') round(s, 4); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s);
      const me = s.contract.car, ch = (k) => R.divOf(s, R.CAR[k].team) === 'challenger', seeds = s.season.current.open.seeds, rest = Object.keys(s.world.seats).filter((k) => !seeds.includes(k) && k !== me);
      const order = [...rest.filter((k) => !ch(k)).slice(0, 6), me, ...rest.filter((k) => !ch(k)).slice(6), ...rest.filter(ch)], grid = R.lcqGrid(order, ch, 2), laps = Object.fromEntries(order.map((k, i) => [k, 40 + i]));
      const q = { order, grid, laps }; assert.ok(!grid.includes(me) && C.qualiPlace(q, me) === 7);
      const t = C.lapToRace(s, q), elite = grid.filter((k) => !ch(k)); assert.equal(t.squeezed, true); assert.equal(t.lap, laps[elite.at(-1)]); assert.ok(t.lap < laps[me], 'their lap must beat the slowest Elite lap on the grid');
      assert.equal(C.gridSlot(q, grid.at(-1)), 8, 'a Challenger car added by the quota starts from its slot'); assert.ok(C.qualiPlace(q, grid.at(-1)) > 8);
      const q2 = { order: [...order].sort((a, b) => (a === me ? -1 : b === me ? 1 : 0)), laps }; q2.grid = R.lcqGrid(q2.order, ch, 2); assert.equal(C.lapToRace(s, q2).squeezed, false);
      // three Challenger cars in the top 8 on pace (E E E E C E C C, the player tenth): the quota does not bind, so the grid's last lap is the one to beat
      const E = rest.filter((k) => !ch(k)), Ch = rest.filter(ch), o3 = [...E.slice(0, 4), Ch[0], E[4], Ch[1], Ch[2], E[5], me, ...E.slice(6), ...Ch.slice(3)], l3 = Object.fromEntries(o3.map((k, i) => [k, 40 + i]));
      const q3 = { order: o3, grid: R.lcqGrid(o3, ch, 2), laps: l3 }; assert.equal(C.lapToRace(s, q3).lap, l3[q3.grid.at(-1)], 'not the slowest Elite lap'); }
    // a deal signed in mid-season shows next season's series at the review, after its team moves
    { const s = signed(4510), o = Of.offer(s, 'corvid', 'B', { salary: 100, signing: 0, seasons: 2, why: 'x' }); s.season.mid.push(o); C.signMid(s, o.id); assert.equal(s.contract.next.div, 'challenger');
      s.world.teams.corvid.div = 'elite'; const [card] = Of.seasonOffers(s, { cup: false, title: false, dropped: false }); assert.equal(card.team, 'corvid'); assert.equal(card.div, 'elite', 'the card reads the series the team races next'); }
    // and if that team goes up to a seat this driver would not qualify (an Elite rated 99), its release clause lets them out; a team that stays down keeps the deal
    { const seen = {}; for (let seed = 4560; seed < 4580 && !(seen.up && seen.stay); seed++) { const s = signed(seed), t = seed % 2 ? 'hayate' : 'corvid', o = Of.offer(s, t, 'B', { salary: 100, signing: 0, seasons: 2, why: 'x' }); s.season.mid.push(o);
        s.contract.seasonsLeft = Math.max(s.contract.seasonsLeft, 3); const c0 = s.wallet.coins, t0 = s.contract.trust; C.signMid(s, o.id); const n = s.contract.next;
        assert.ok(n.paid > 0 && s.wallet.coins - c0 === n.paid && t0 - s.contract.trust === n.trustCost, 'the deal records the cut and the trust it cost');
        for (const k of R.carsIn(s, 'elite')) s.world.ratings[s.world.seats[k]] = 99; toReview(s, 4); const up = s.history.at(-1).swap.up === t;
        if (up) { seen.up = 1; assert.equal(s.contract.next, undefined); assert.ok(s.inbox.some((m) => m.title === `${R.loreOf(t).name} let you out of your deal` && m.body.includes('release clause goes back')), 'the release gives the cut back'); assert.ok(!s.pending.offers.some((x) => x.signed), 'the market is open again'); }
        else { seen.stay = 1; assert.equal(s.contract.next.team, t); } }
      assert.ok(seen.up && seen.stay, JSON.stringify(seen)); }
    // the market: the other series' points count, and a seated Elite driver never moves down to a Challenger team
    { const s = signed(4503); round(s, 4); const o = s.season.results[0].other.entries, mover = o.find((e, i) => !e.dnq && e.exp !== i + 1);
      assert.equal(R.seasonForm(s, mover.code), R.clamp((mover.exp - o.indexOf(mover) - 1) / 4, -1, 1), 'the other series\' race shapes a driver\'s form'); assert.notEqual(R.seasonForm(s, mover.code), 0);
      let checked = 0; for (const t of R.teamsIn(s, 'elite')) { const [a, b] = ['A', 'B'].map((x) => s.world.seats[R.seatCar(t, x)]), p = (c) => o.filter((e) => e.code === c).reduce((x, e) => x + e.pts, 0); if (p(a) === p(b)) continue;
        const lo = p(a) < p(b) ? a : b, s2 = structuredClone(s), L0 = s2.world.loyalty[lo]; W.marketMoves(s2); if (s2.world.seats[R.seatCar(t, lo === a ? 'A' : 'B')] !== lo || s2.world.contracts[lo] === undefined) continue;
        if (s2.world.loyalty[lo] !== R.TUNING.market.loyaltyMove) { assert.equal(s2.world.loyalty[lo], R.clamp(L0 + R.TUNING.market.loyaltyGrow - R.TUNING.market.loyaltyBeaten, 0, 100), `${lo}, outscored by their teammate in the Elite, sours`); checked++; } }
      assert.ok(checked > 0, 'a teammate outscored in the other series was seen');
      for (const c of Object.values(s.world.seats)) if (c !== 'YOU') s.world.contracts[c] = 1; for (const c of Object.keys(s.world.loyalty)) s.world.loyalty[c] = 0;
      const elite = new Set(R.carsIn(s, 'elite').map((k) => s.world.seats[k])); let seen = 0;
      for (const key of R.carsIn(s, 'challenger')) { const l = [...W.shortlistOf(s, key), ...W.poachable(s, key)]; seen += l.length; assert.ok(l.every((c) => !elite.has(c)), `nobody seated in the Elite is offered ${key}`); }
      for (const key of R.carsIn(s, 'elite')) seen += W.poachable(s, key).filter((c) => elite.has(c)).length;
      assert.ok(seen > 0, 'the lists are not empty'); assert.equal(R.upDiv(s, 'aurum', 'corvid'), false); assert.equal(R.upDiv(s, 'corvid', 'aurum'), true); assert.equal(R.upDiv(s, 'corvid', 'hayate'), true); }
    // rivals: one in the other series cools by sitOut a Tour round, not decay
    { const s = signed(4504), el = s.world.seats.destrier; s.career.heat[el] = 50; round(s, 4); assert.equal(s.career.heat[el], 50 - R.TUNING.rivals.sitOut, 'a feud waits for the next Open'); }
    // life: a Challenger seat with form 2+ is a seat below your form; an Elite one is not; a season before the split keeps the old test
    { const s = signed(4505), x = { rr: 7, finish: 4, dnf: false, dnq: false, open: false, clean: true, duel: null, feud: false, home: false, press: { good: 0, bad: 0 }, bill: 0, gross: 100, trust: 50, tier: 'rookie', form: 2, expTeam: 3 }, below = (y) => structuredClone(s) && Li.settleRound(structuredClone(s), y).lines.some((l) => l[0] === 'A seat below your form');
      assert.ok(below({ ...x, div: 'challenger' })); assert.ok(!below({ ...x, div: 'elite' })); assert.ok(!below({ ...x, div: 'challenger', form: 1 })); assert.ok(below({ ...x, expTeam: 7 }) && !below(x), 'no series: the expected place decides'); }
    // the Sponsor Challenge: the player's series only
    { const s = signed(4506), cs = C.challengeSetup(s); assert.equal(cs.racers.length, R.TUNING.side.challenge.field + 1, "five rivals and the player"); assert.ok(cs.racers.every((k) => R.divOf(s, R.CAR[k].team) === 'challenger'), 'the field is the player\'s series');
      const e = signed(4507, 'mojave', 'elite'), ce = C.challengeSetup(e); assert.ok(ce.racers.every((k) => R.divOf(e, R.CAR[k].team) === 'elite')); } }
  // ---- the Opens and the Masters of two series (16.14, 16.15): each series' best seeded, interleaved; sixteen fly a lap; the Last Chance holds two Challenger cars at least
  { const K = await server.ssrLoadModule('/src/game/career/ranking.js'), keys = (s, d) => K.rankingOf(s, d).map((x) => x.key), divs = (s, l) => l.map((k) => R.divOf(s, R.CAR[k].team));
    const toKind = (s, kind, you) => { round(s, 4); if (you !== undefined) { s.ranking.seed.YOU = you; s.ranking.n = 0; } while (C.currentRound(s).kind !== kind) round(s, 4); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); return s; };
    const s = toKind(signed(4401), 'open', -1e6), o = s.season.current.open, E = keys(s, 'elite'), Ch = keys(s, 'challenger');
    assert.deepEqual(o.seeds, [E[0], Ch[0], E[1], Ch[1]], 'E1 C1 E2 C2'); assert.equal(o.seeded, false); assert.equal(o.div, 'challenger'); assert.equal(o.cut, 2); assert.equal(o.rank, 10, 'ranked in the Challenger table');
    assert.deepEqual(s.season.current.objectives.slice(0, 2).map(R.objectiveText), ['Reach the Last Chance Qualifier', 'Reach the Japan Open Final']); assert.equal(s.season.current.field, R.FIELD); assert.equal(s.season.current.expPos, R.expOf(s.world.teams.mojave.expPos, 'B'), 'at an Open the place is of the whole field');
    for (const k of R.carsIn(s, 'challenger')) if (s.world.seats[k] !== 'YOU') s.world.ratings[s.world.seats[k]] = 60;   // the Challenger at its slowest
    C.finishQuali(s, 999); const q = s.season.current.quali; assert.equal(q.order.length, 16, 'sixteen fly a lap'); assert.equal(q.grid.length, 8);
    assert.equal(divs(s, q.grid).filter((d) => d === 'challenger').length, 2, 'the Last Chance still holds two Challenger cars'); assert.deepEqual(q.grid, q.order.filter((k) => q.grid.includes(k)), 'in lap order'); assert.equal(o.lcqIn, false);
    const out = C.finishDnq(s); assert.equal(out.objectives[0].met, false, 'out of the Last Chance: the objective is missed'); assert.ok(out.entries.every((e) => e.pts === 0)); assert.equal(out.other, undefined, 'an Open has no other race');
    const t = toKind(signed(4402), 'open', -1e6), to = t.season.current.open; C.finishQuali(t, 1); assert.equal(to.lcqIn, true); const tq = t.season.current.quali, me = t.contract.car;
    const lr = C.finishLcq(t, { order: [...tq.grid.filter((k) => k !== me), me], best: {} }); assert.equal(lr.dnq, true); assert.equal(lr.objectives[0].met, true, 'in the Last Chance: the objective is met, even beaten in it'); assert.equal(lr.objectives[1].met, false);
    const fin = t.season.results.at(-1); assert.equal(fin.entries.filter((e) => !e.dnq).length, 8);
    const sd = toKind(signed(4403), 'open', 1e6), so = sd.season.current.open, sq = sd.season.current.quali; assert.equal(so.seeded, true); assert.equal(so.seeds[1], sd.contract.car, 'the Challenger leader starts next to the Elite leader'); assert.equal(sq.grid[1], sd.contract.car);
    assert.deepEqual(sq.grid.slice(0, 4), so.seeds); assert.deepEqual(sq.grid.slice(4), so.lcq.through, 'then the Last Chance finishers in finishing order'); assert.ok(divs(sd, so.lcq.order).filter((d) => d === 'challenger').length >= 2, 'a seed\'s Last Chance runs by the same rule');
    // the Masters: top 5 Elite and top 3 Challenger, interleaved
    const m = toKind(signed(4404), 'masters', 1e6), mo = m.season.current.open; assert.equal(mo.seeds.length, 8); assert.deepEqual(divs(m, mo.seeds), ['elite', 'challenger', 'elite', 'challenger', 'elite', 'challenger', 'elite', 'elite']);
    assert.deepEqual(mo.seeds, R.seedsOf('masters', keys(m, 'elite'), keys(m, 'challenger'))); assert.equal(mo.seeds[1], m.contract.car); assert.equal(mo.cut, 3); assert.equal(m.season.current.quali.order.length, R.FIELD, 'the rest of the field is ranked behind');
    const mx = toKind(signed(4405), 'masters', -1e6); assert.equal(mx.season.current.open.seeded, false); C.finishDnq(mx);
    assert.ok(mx.media.some((x) => /^Ranked \d+ in the Challenger, outside its top 3, /.test(x.body)), 'the press gives the series rule for a missed Masters');
    assert.equal(m.season.current.field, 8); assert.ok(m.season.current.expPos >= 1 && m.season.current.expPos <= 8, 'expected among the eight it races, not the whole field: ' + m.season.current.expPos);
    const mr = round(m, 2); assert.equal(mr.kind, 'masters'); assert.ok(mr.entries.every((e) => e.pts === 0)); assert.equal(mr.rank.pts, 18 * 3, 'the Masters pays its ranking points to a Challenger driver in full');
    assert.ok(mr.expPos <= 8 && mr.rrLines.every(([l]) => !/(\d+) (places? )?(above|below) expected/.test(l) || +l.match(/(\d+)/)[1] <= 7), 'no place gained beyond the field: ' + JSON.stringify(mr.rrLines)); }

  // ---- the Masters in a season from before the two series: the top 8 of the ranking, Marina at night; outside them it runs without you
  { const toMasters = (s) => { while (C.currentRound(s).kind !== 'masters') round(s, 3, 999); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); return s; };
    const ins = signed(320, 'mojave', 'legacy'); ins.ranking.seed.YOU = 1e6; ins.ranking.n = 0; toMasters(ins); const mo = ins.season.current.open; assert.equal(mo.kind, 'masters'); assert.equal(mo.seeds.length, 8); assert.equal(mo.stage, 'final'); assert.equal(ins.season.current.quali.grid.length, 8);
    assert.equal(ins.season.current.quali.grid[0], ins.contract.car, 'the leader of the ranking starts on pole'); const ms = C.raceSetup(ins); assert.equal(ms.track, 'marina'); assert.equal(ms.look, 'night'); assert.equal(ms.label, 'Ultrack Masters'); assert.equal(C.practiceLocked(ins), null, 'the Masters is a Tour circuit: practice stays open');
    const mrep = round(ins, 1); assert.equal(mrep.kind, 'masters'); assert.equal(mrep.rank.pts, 75, 'the Masters is the biggest ranking day'); assert.equal(ins.stats.masters, 1); assert.equal(ins.hall.at(-1).id, 'masters'); assert.equal(ins.clock.phase, 'review', 'the Masters closes the season');
    const o2 = signed(322, 'mojave', 'legacy'); o2.ranking.seed.YOU = -1e6; toMasters(o2); assert.equal(o2.season.current.open.seeded, false); assert.ok(!o2.season.current.quali.grid.includes(o2.contract.car), 'outside the top 8: not on the grid'); assert.equal(C.retriesLeft(o2.season.current.quali), 0, 'and no retry to find a place');
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
  { const s = signed(350, 'mojave', 'legacy'), cal = s.season.calendar; cal.forEach((r) => { delete r.kind; delete r.lcqLaps; r.event = 'sprint'; }); round(s, 3, 1); delete s.season.current.open;
    s.schema = 4; delete s.ranking; delete s.hall; for (const k of ['openWins', 'masters', 'triple', 'slams']) delete s.stats[k];
    C.migrate(s); assert.equal(s.schema, C.SCHEMA); assert.equal(s.ranking.n, 0); assert.deepEqual(s.hall, []); assert.deepEqual(s.stats.openWins, { tokyo: 0, infinia: 0, venice: 0 }); assert.equal(C.rankingOf(s).length, R.FIELD);
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
    const PL = R.TUNING.pace.perLevel, one = PL.engine + PL.tyres + PL.brakes + PL.aero;
    assert.ok(Math.abs(R.parLap('india', 'bmw1', 'dry', [1, 1, 1]) / base - (1 - one)) < 1e-12, 'a three-long dev (an old save) wears Aero 1 at level 1');
    assert.ok(Math.abs(R.parLap('india', 'bmw1', 'dry', [1, 1, 1, 1, 2]) / base - (1 - one - 2 * PL.nitro)) < 1e-12, 'all five categories count, Nitro included');
    assert.ok(one * 3 > 0.055 && one * 3 < 0.07, 'all at 3 is worth what an AI lap gains in the physics (5.3-6.7 %, 2026-11-11)'); assert.ok(R.parLap('india', 'bmw1', 'dry', [1, 1, 1, 3]) < R.parLap('india', 'bmw1', 'dry', [1, 1, 1, 0]), 'bought Aero speeds the player');
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
    const o = signed(932); o.schema = 5; delete o.staff; o.garage.upgrades = { bmw1: { engine: 1, tyres: 0, brakes: 0 } }; C.migrate(o); assert.equal(o.schema, C.SCHEMA); assert.deepEqual(o.staff, { crew: null, engineer: null }); assert.deepEqual(o.garage.upgrades.bmw1, { engine: 1, tyres: 0, brakes: 0, aero: 0, nitro: 0 }); assert.equal(C.staffDiscount(o, 'crew'), 0);
    const o2 = signed(933); o2.garage.upgrades = { 'bmw1': { engine: 1 } }; assert.equal(C.upgradeInfo(o2, 'aero', 503).level, 0, 'a missing category reads 0 even before migration'); assert.equal(C.raceSetup(o2).levels('bmw1').aero, 0);
    // rivals wear their team's development, all five categories of it
    const w = signed(934); C.finishQuali(w, 1); const lv = C.raceSetup(w).levels, rival = w.season.current.quali.grid.find((k) => k !== w.contract.car), dev = w.world.teams[R.CAR[rival].team].dev; w.world.teams[R.CAR[rival].team].dev = [1, 2, 0, 3, 2];
    assert.deepEqual(lv(rival), { engine: 1, tyres: 2, brakes: 0, aero: 3, nitro: 2 }, 'a rival races its team car'); w.world.teams[R.CAR[rival].team].dev = dev; assert.deepEqual(Object.keys(lv(rival)).sort(), ['aero', 'brakes', 'engine', 'nitro', 'tyres'], 'every category is named, so a level left over from free play cannot leak to a rival'); }

  // ---- team development (2026-11-11): seeded, per team, three windows a season, between the tier's floor and its cap + 1, Brakes never developed
  { const D = R.TUNING.dev, floor = (t) => R.tierOf(t).dev, capAI = (t) => Math.min(3, R.tierOf(t).cap + D.aiCapPlus), devs = (s) => JSON.stringify(R.TEAM_IDS.map((t) => s.world.teams[t].dev));
    const s0 = C.newCareer({ seed: 77, now: 'x' }); for (const t of R.TEAM_IDS) assert.deepEqual(s0.world.teams[t].dev, floor(t), 'a new world starts on the tiers\' cars');
    // a season: the windows after rounds n/3 and 2n/3 (not before the first, not after the last), each once; the same seed replays the same updates
    const a = signed(5301), b = signed(5301), n = a.season.calendar.length, at = [];
    while (a.clock.phase !== 'review') { const before = devs(a); round(a, 4); round(b, 4); if (devs(a) !== before) at.push(a.clock.round); }
    assert.equal(devs(a), devs(b), 'seeded: the same career develops the same cars'); assert.ok(at.every((r) => [Math.floor(n / 3), Math.floor((2 * n) / 3)].includes(r)), `updates only after rounds ${Math.floor(n / 3)} and ${Math.floor((2 * n) / 3)} (seen ${at})`);
    { const was = devs(a); assert.ok(at.length && at.every((r) => r === Math.floor((2 * n) / 3)), 'season 1 develops only after two thirds of it'); assert.deepEqual(C.devWindow(a, 0), [], 'a window already spent is skipped'); assert.deepEqual(C.devWindow(a, 2), []); assert.equal(devs(a), was); }
    assert.ok(R.TEAM_IDS.every((t) => JSON.stringify(signed(5301).world.teams[t].dev) === JSON.stringify(floor(t))), 'season 1 starts on the tier cars');
    assert.ok(a.inbox.some((m) => /^Mid-season updates/.test(m.title) && m.read && m.action?.tab === 'standings'), 'the updates are the paddock\'s news');
    // many seasons: inside the bounds, Brakes at the floor, and teams of one tier on different cars
    let spread = 0, n2 = 0;
    for (let seed = 5400; seed < 5420; seed++) { const s = signed(seed);
      for (let k = 0; k < 6; k++) { s.clock.season++; C.devWindow(s, 0); C.devWindow(s, 1); C.devWindow(s, 2);
        for (const t of R.TEAM_IDS) { const d = s.world.teams[t].dev; assert.equal(d.length, 5); d.forEach((v, i) => assert.ok(v >= floor(t)[i] && v <= capAI(t), `${t} ${i} at ${v}`)); assert.equal(d[2], floor(t)[2], 'Brakes are never developed'); }
        const tot = (t) => s.world.teams[t].dev.reduce((x, y) => x + y, 0);
        for (const l of Object.values(Object.groupBy(R.TEAM_IDS, (t) => R.TIERS.teams[t].tier))) { n2++; if (Math.max(...l.map(tot)) - Math.min(...l.map(tot)) >= 2) spread++; } } }
    assert.ok(spread / n2 > 0.4, `teams of a tier differ by two levels or more: ${spread} of ${n2} tier-seasons`);
    // the car on screen, and a rival passing the player's car is the team's news
    const c = signed(5302); c.world.teams.liberty.dev = [0, 0, 0, 0, 0]; assert.deepEqual(C.teamCar(c, c.contract.team).own, true); assert.deepEqual(C.teamCar(c, 'liberty').levels, { engine: 0, tyres: 0, brakes: 0, aero: 0, nitro: 0 });
    c.clock.season = 2; let posted = false; for (let seed = 1; seed < 40 && !posted; seed++) { c.seed = seed; c.world.devAt = [2, 1];   /* season 2: season 1 runs only its last window */ const n0 = c.inbox.length, out = C.devWindow(c, 1); posted = c.inbox.slice(0, c.inbox.length - n0).some((m) => m.kind === 'team' && /better .* than you|better than yours/.test(m.title)) && out.length > 0; }
    assert.ok(posted, 'a rival in the series passing the player\'s car leaves an unread line from the team');
    // schema 14 -> 15: [engine, tyres, brakes] become five levels (Aero implied, no Nitro), a season under way keeps the windows it has passed
    const o = signed(5303); round(o, 4); round(o, 4); round(o, 4); o.schema = 14; delete o.world.devLog; delete o.world.devAt; for (const t of R.TEAM_IDS) o.world.teams[t].dev = floor(t).slice(0, 3);
    o.world.teams.toro.dev = [2, 2, 1]; C.migrate(o); assert.equal(o.schema, C.SCHEMA); assert.deepEqual(o.world.teams.toro.dev, [2, 2, 1, 2, 0]); assert.deepEqual(o.world.teams.liberty.dev, [0, 0, 0, 0, 0]);
    assert.deepEqual(o.world.devAt, [1, 2], 'past the first third: the next window is the second'); assert.deepEqual(o.world.devLog, []); }

  // ---- happiness, fan support and the Shop (Part 3)
  {
    const Lf = await server.ssrLoadModule('/src/game/career/life.js'), Md = await server.ssrLoadModule('/src/game/career/media.js'), LIFE = Lf.LIFE, media = JSON.parse((await import('node:fs')).readFileSync(new URL('../../assets/career/media.json', import.meta.url), 'utf8'));
    const staffIds = ['crew-pro', 'crew-elite', 'crew-factory', 'engineer-pro', 'engineer-elite', 'engineer-factory'];
    // the data: stable ids, every type known, a price or a pay, a story for each, ad brands are real sponsors
    assert.equal(new Set(LIFE.items.map((x) => x.id)).size, LIFE.items.length, 'item ids are unique');
    for (const id of ['apartment', 'penthouse', 'mansion', 'watch', 'supercar', 'yacht', 'night-out', 'big-party', 'huge-bash', 'holiday', 'luxury-holiday', 'fan-day', 'charity-gala', 'ad-shoot', 'billboard-deal', 'tv-commercial']) assert.ok(C.itemOf(id), id + ' is in the Shop');
    for (const x of LIFE.items) { assert.ok(LIFE.types.some((t) => t.id === x.type)); assert.ok(x.type === 'ad' ? x.pay > 0 : x.price > 0, x.id); assert.ok(media.life[x.id], 'a story for ' + x.id); if (x.type === 'luxury') assert.ok(x.upkeep > 0 && x.glow > 0, 'a luxury has an upkeep and a glow'); }
    assert.ok(LIFE.items.find((x) => x.id === 'yacht').price >= 250000 && LIFE.items.find((x) => x.id === 'yacht').price <= 400000, 'a yacht makes a Legend think'); assert.ok(LIFE.items.find((x) => x.id === 'apartment').price <= 6000, 'a Rookie can save for an apartment');
    assert.deepEqual(C.STAFF_LIST.map((s) => s.id), staffIds, 'the Shop shows the six staff ids');
    for (const [k, t] of Object.entries(media.life)) { if (k === 'note') continue; assert.ok(t.stories.length && t.stories.every((s) => s.title && s.body)); for (const tok of JSON.stringify(t).match(/\{(\w+)\}/g) ?? []) assert.ok(['{me}', '{team}', '{brand}', '{item}'].includes(tok), 'known token ' + tok); assert.ok(!/drunk|alcohol|drink|impaired|crash/i.test(JSON.stringify(t)), 'nothing about driving impaired'); }
    // bands, and what each does
    assert.deepEqual([100, 80, 79.9, 60, 59, 40, 39, 20, 19, 0].map((h) => Lf.bandOf(h).id), ['top', 'top', 'content', 'content', 'neutral', 'neutral', 'frustrated', 'frustrated', 'unhappy', 'unhappy']);
    const n = signed(1100); assert.equal(n.life.happy, 50); assert.equal(Lf.mood(n).id, 'neutral'); assert.ok(n.life.fans >= 20 && n.life.fans <= 50);
    // on track (lifestyle.json drive): the player's engine power only, exactly 1 around 50, monotonic, within ±drive.power; the lap model the sim uses follows it
    { const D = Lf.LIFE.drive, p = (h) => Lf.drivePower(h);
      for (let h = 50 - D.dead; h <= 50 + D.dead; h++) assert.equal(p(h), 1, `no effect at ${h}`);
      for (let h = 1; h <= 100; h++) assert.ok(p(h) >= p(h - 1), 'monotonic');
      assert.ok(p(0) >= 1 - D.power - 1e-12 && p(100) <= 1 + D.power + 1e-12 && p(100) > 1 && p(0) < 1, 'bounded'); assert.ok(Math.abs(p(100) - 1 - D.power) < 1e-12 && Math.abs(p(0) - 1 + D.power) < 1e-12, 'the extremes reach the bound');
      assert.ok(p(70) - 1 > 0 && p(70) - 1 < 0.004 && 1 - p(30) > 0 && 1 - p(30) < 0.004, 'very gradual past the dead zone'); assert.equal(Lf.driveLap(50), 1); assert.ok(Lf.driveLap(100) < 1 && Lf.driveLap(100) > 0.995 && Lf.driveLap(0) < 1.005, 'at most about half a percent of a lap');
      const H = await server.ssrLoadModule('/src/physics/handling.js'), plain = H.handling('ford-gt').power;
      H.setPower({ 'ford-gt': p(100) }); assert.ok(Math.abs(H.handling('ford-gt').power / plain - p(100)) < 1e-12); assert.equal(H.handling('ford-gt').grip, (H.setPower({}), H.handling('ford-gt').grip), 'power, never grip');
      H.setPower({ 'ford-gt': p(0) }); H.setPower({}); assert.equal(H.handling('ford-gt').power, plain, 'cleared: the plain car');
      H.setPower({ 'ford-gt': p(50) }); assert.equal(H.handling('ford-gt').power, plain, 'at 50 the car is untouched'); H.setPower({}); }
    // it never reaches a rival: the same career at the two extremes qualifies and races identically, only the player's own power differs
    { const lo = signed(1101), hi = signed(1101); lo.life.happy = 3; hi.life.happy = 97; C.finishQuali(lo, 60); C.finishQuali(hi, 60);
      const me = lo.contract.car; assert.deepEqual(Object.keys(C.raceSetup(lo).power), [me]); assert.ok(C.raceSetup(lo).power[me] < 1 && C.raceSetup(hi).power[me] > 1 && C.qualiSetup(hi).power[me] > 1, 'race and qualifying carry the mood');
      assert.equal(JSON.stringify(lo.season.current.quali.laps), JSON.stringify(hi.season.current.quali.laps), 'rival laps do not know the mood'); assert.equal(JSON.stringify(C.raceSetup(lo).pace), JSON.stringify(C.raceSetup(hi).pace), 'nor does the race pace'); assert.equal(JSON.stringify(C.raceSetup(lo).levels(lo.contract.car)), JSON.stringify(C.raceSetup(hi).levels(hi.contract.car)), 'nor the car'); }
    // luxuries: any time, a lift now, a repeat counts for less, the most you can own, no money no deal
    { const s = signed(1102); s.wallet.coins = 100000; const w0 = s.wallet.coins, a = C.buyLife(s, 'apartment'); assert.ok(a.ok); assert.equal(s.wallet.coins, w0 - 5000); assert.equal(s.life.happy, 59); assert.equal(C.ownedN(s, 'apartment'), 1);
      const b = C.buyLife(s, 'apartment'); assert.equal(b.boost, 5, 'the second one counts for less'); assert.ok(s.life.happy < 70); C.buyLife(s, 'apartment'); assert.equal(C.lifeInfo(s, 'apartment').reason, 'max'); assert.equal(C.ownedN(s, 'apartment'), 3);
      assert.ok(C.glowOf(s) > 0.3 && C.glowOf(s) <= 2.5); assert.equal(C.upkeepOf(s), 900); s.wallet.coins = 10; const h0 = s.life.happy; assert.equal(C.buyLife(s, 'watch').reason, 'coins'); assert.equal(s.wallet.coins, 10); assert.equal(s.life.happy, h0, 'a refusal changes nothing');
      s.wallet.coins = 1e6; C.finishQuali(s, 60); assert.equal(C.currentWeek(s).kind, 'race'); assert.ok(C.buyLife(s, 'watch').ok, 'a luxury can be bought in a race week'); assert.equal(C.buyLife(s, 'night-out').reason, 'week', 'an activity needs an open week'); assert.ok(s.media.some((m) => /watch/.test(m.title)), 'the purchase is in the papers'); }
    // activities: one a week, the week's optional event shared or skipped
    { const s = signed(1103); s.wallet.coins = 50000; round(s, 3, 60); const w = C.currentWeek(s); assert.equal(w.kind, 'open'); assert.equal(w.event.kind, 'test');
      assert.ok(C.buyLife(s, 'night-out').ok); assert.ok(C.sideSpec(s), 'a night out leaves the test day open'); assert.equal(C.buyLife(s, 'fan-day').reason, 'taken', 'one activity a week'); assert.equal(w.activity.id, 'night-out');
      C.advanceWeek(s); assert.equal(C.currentWeek(s).kind, 'race'); round(s, 3, 60);
      const w2 = C.currentWeek(s); assert.ok(!w2.activity, 'next open week is free'); const sp = C.sideSpec(s); assert.ok(sp);
      const f0 = s.life.fans, r = C.buyLife(s, 'holiday'); assert.ok(r.ok && r.skips === 'sponsor day'); assert.equal(w2.event.skipped, true); assert.equal(C.sideSpec(s), null, 'time off skips the event'); assert.equal(s.life.sinceOff, 0); assert.ok(!C.advanceWarnings(s).some((x) => /Skipping/.test(x)), 'no second warning for a skipped day');
      const gc = C.buyLife(s, 'fan-day'); assert.equal(gc.reason, 'taken'); C.advanceWeek(s); round(s, 3, 60); const g = C.buyLife(s, 'charity-gala'); assert.ok(g.ok); assert.ok(s.life.fans >= f0 + 10, 'giving back wins fans'); assert.ok(!C.currentWeek(s).event.skipped, 'a gala shares the week with the event'); }
    // a holiday on a sponsor day: goodwill goes down once, however the week ends
    { const s = signed(1104); s.wallet.coins = 50000; s.sponsors.deals.push({ brand: 'jio', name: 'Jio', retainer: 80, bonus: 400, target: { kind: 'clean', count: 3 }, progress: 0, met: false, mood: 2 });
      round(s, 3, 60); C.advanceWeek(s); round(s, 3, 60); const w = C.currentWeek(s); assert.equal(w.event.kind, 'sponsor'); assert.ok(C.lifeInfo(s, 'holiday').upset);
      C.buyLife(s, 'holiday'); assert.equal(s.sponsors.deals[0].mood, 1); C.advanceWeek(s); assert.equal(s.sponsors.deals[0].mood, 1, 'skipping again at the Advance costs nothing more');
      const t = signed(1105); t.sponsors.deals.push({ brand: 'jio', name: 'Jio', retainer: 80, bonus: 400, target: { kind: 'clean', count: 3 }, progress: 0, met: false, mood: 2 }); t.wallet.coins = 50000; round(t, 3, 60); C.advanceWeek(t); round(t, 3, 60); C.buyLife(t, 'ad-shoot'); assert.equal(t.sponsors.deals[0].mood, 2, 'an ad is work: the sponsor is not upset'); }
    // ad deals: they pay, take the week, want reputation, and are capped a season; the brand is a real one at the player's tier or below
    { const s = signed(1106); round(s, 3, 60); s.wallet.coins = 0; s.career.rep = 100; assert.equal(C.lifeInfo(s, 'billboard-deal').reason, 'rep'); assert.equal(C.lifeInfo(s, 'tv-commercial').reason, 'rep'); const q = C.lifeInfo(s, 'ad-shoot'); assert.ok(q.ok && q.pay > 0 && R.SPONSORS.brands[q.brand].tier === 'rookie');
      const h0 = s.life.happy, r = C.buyLife(s, 'ad-shoot'); assert.ok(r.ok); assert.equal(s.wallet.coins, q.pay); assert.ok(C.currentWeek(s).event.skipped, 'an ad takes the week and its event'); assert.equal(s.life.happy, Math.max(0, h0 - 2), 'and costs a little mood'); assert.ok(s.media.some((m) => m.title.includes(R.SPONSORS.brands[q.brand].name)));
      for (let i = 0; i < 2; i++) { C.advanceWeek(s); round(s, 3, 60); assert.ok(C.buyLife(s, 'ad-shoot').ok); } C.advanceWeek(s); round(s, 3, 60); assert.equal(s.life.ads['ad-shoot'], 3); assert.equal(C.lifeInfo(s, 'ad-shoot').reason, 'cap', 'three a season'); }
    // a party's seeded chance of the pictures getting out: it hits team trust or a sponsor, never the wallet, and replays
    { let hit = 0, sponsor = 0, trust = 0; const run1 = (seed) => { const s = signed(seed); s.wallet.coins = 1e6; round(s, 3, 60); s.sponsors.deals.push({ brand: 'jio', name: 'Jio', retainer: 80, bonus: 400, target: { kind: 'clean', count: 3 }, progress: 0, met: false, mood: 3 }); const t0 = s.contract.trust, r = C.buyLife(s, 'huge-bash'); return { s, r, t0 }; };
      for (let seed = 1200; seed < 1300; seed++) { const { s, r, t0 } = run1(seed); assert.ok(s.wallet.coins >= 0); if (!r.scandal) { assert.ok(!s.media.some((m) => m.kind === 'scandal')); continue; } hit++;
        assert.ok(s.media.some((m) => m.kind === 'scandal') && s.inbox.some((m) => m.title === 'The pictures got out')); if (r.scandal.sponsor) { sponsor++; assert.equal(s.sponsors.deals[0].mood, 2); } else { trust++; assert.equal(s.contract.trust, Math.max(0, t0 - 10)); } assert.ok(s.life.fans >= 0); }
      assert.ok(hit >= 5 && hit <= 30, `a huge bash gets out about 15 % of the time (${hit} of 100)`); assert.ok(sponsor > 0 && trust > 0, 'both kinds happen'); assert.equal(JSON.stringify(run1(1210).s), JSON.stringify(run1(1210).s), 'the same seed, the same night'); }
    // the grind: weeks without time off wear a driver down, and a holiday resets it
    { const s = signed(1107); s.life.sinceOff = 14; const x = Lf.settleRound(s, { rr: 6, finish: 6, dnf: false, dnq: false, clean: false, duel: { result: 'level' }, feud: false, home: false, press: { good: 0, bad: 0 }, bill: 0, gross: 1000, trust: 50, tier: 'rookie', form: 0, expTeam: 7 });
      assert.ok(x.lines.some(([l, v]) => l === 'Weeks without time off' && v < 0)); const t = signed(1107); t.life.sinceOff = 2; assert.ok(!Lf.settleRound(t, { rr: 6, finish: 6, dnf: false, dnq: false, clean: false, duel: { result: 'level' }, feud: false, home: false, press: { good: 0, bad: 0 }, bill: 0, gross: 1000, trust: 50, tier: 'rookie', form: 0, expTeam: 7 }).lines.some(([l]) => /time off/.test(l))); }
    // a home crowd: the player's nation at its own circuits
    { const s = signed(1108); assert.equal(s.player.nation, 'IND'); assert.ok(Lf.isHome(s, 'infinia') && Lf.isHome(s, 'india') && !Lf.isHome(s, 'tokyo')); s.player.nation = 'JPN'; assert.ok(Lf.isHome(s, 'tokyo') && !Lf.isHome(s, 'infinia')); }
    // the mood moves with a season: a strong result lifts it, a bad one sinks it, both stay in 0-100, and it never leaves the report out
    { const good = signed(1109), bad = signed(1109); for (let i = 0; i < 6; i++) { round(good, 1, 1); round(bad, 8, 999); } assert.ok(good.life.happy > 55 && good.life.happy > bad.life.happy + 3, `good ${good.life.happy}, bad ${bad.life.happy}`); const dq = signed(1109); for (let i = 0; i < 4; i++) { while (C.currentWeek(dq).kind !== 'race') C.advanceWeek(dq); C.finishQuali(dq, 999); const q = dq.season.current.quali; if (q.grid.includes(dq.contract.car)) { q.grid = q.grid.slice(0, 7); q.order = q.order.filter((k) => k !== dq.contract.car).concat(dq.contract.car); } C.finishDnq(dq); } assert.ok(dq.life.happy < 45, `four missed cuts sink the mood: ${dq.life.happy}`); assert.ok([good, bad].every((x) => x.life.happy >= 0 && x.life.happy <= 100 && x.life.fans >= 0 && x.life.fans <= 100));
      const r = round(good, 1, 1); assert.ok(r.life && Number.isFinite(r.life.delta) && r.life.lines.length > 0, 'the report carries the mood'); }
    // what a band does: sponsor pay, XP, the speed trust grows, the offers
    { const s = signed(1110); s.sponsors.deals.push({ brand: 'jio', name: 'Jio', retainer: 100, bonus: 500, target: { kind: 'win', count: 1 }, progress: 0, met: false, mood: 3 });
      for (const [h, mult] of [[90, 1.10], [70, 1.04], [50, 1], [30, 0.95], [5, 0.90]]) { s.life.happy = h; assert.equal(O.sponsorRound(s, { dnf: true }, () => false)[0][1], Math.round(100 * mult / 5) * 5, `sponsor pay at mood ${h}`); }
      s.life.happy = 90; assert.equal(Lf.xpMult(s), 1.05); s.life.happy = 30; assert.equal(Lf.trustMult(s), 0.5); assert.equal(Lf.offerScale(s), 1); s.life.happy = 10; assert.equal(Lf.offerScale(s), 0.6);
      const xp = (hap) => { const a = signed(1111); a.life.happy = hap; return round(a, 2, 1).xp; }; assert.ok(xp(90) > xp(50), 'a driver on top of the world earns more XP');
      // the upside: faster trust and reputation, likelier offers, more room in contract talks
      const repOf = (hap, pos) => { const a = signed(1111); a.life.happy = hap; return round(a, pos, 1).rep; }; assert.ok(repOf(90, 2) > repOf(50, 2), `a happy driver earns reputation faster: ${repOf(90, 2)} against ${repOf(50, 2)}`); assert.ok(repOf(70, 2) > repOf(50, 2), 'a content one a little'); assert.equal(repOf(30, 2), repOf(50, 2), 'an unhappy mood costs no reputation'); const retired = (hap) => { const a = signed(1111); a.life.happy = hap; C.finishQuali(a, 1); return C.finishRace(a, { order: a.season.current.quali.grid, best: {}, dnf: true }).rep; }; assert.ok(retired(50) < 0, `a retirement costs reputation: ${retired(50)}`); assert.equal(retired(90), retired(50), 'and the same in any mood');
      const trust = (hap) => { const a = signed(1111); a.life.happy = hap; return round(a, 2, 1).trust; }; assert.ok(trust(90) > trust(50), `a happy driver earns trust faster: ${trust(90)} against ${trust(50)}`); assert.ok(trust(30) < trust(50), 'a frustrated one slower');
      for (const [h, scale, bonus] of [[90, 1.25, 1], [70, 1.1, 0.5], [50, 1, 0], [30, 1, 0], [10, 0.6, 0]]) { s.life.happy = h; assert.equal(Lf.offerScale(s), scale, `offers at mood ${h}`); assert.equal(Lf.leverageBonus(s), bonus, `leverage at mood ${h}`); }
      const o = { team: 'x', interest: 0.5 }, lev = (hap) => { s.life.happy = hap; return O.leverageOf(s, o); }; assert.equal(lev(90), lev(50) + 1, 'more room in contract talks');
      const so = { sponsor: true }; assert.equal((s.life.happy = 90, O.leverageOf(s, so)), (s.life.happy = 50, O.leverageOf(s, so)), 'sponsor talks already pay through the mood'); }
    // an unhappy driver: a sponsor can walk (the same ending as too many skipped days), harsh press, and the way out is a transfer through the market
    { let walked = 0, harsh = 0; for (let seed = 1300; seed < 1340; seed++) { const s = signed(seed); s.life.happy = 4; s.sponsors.deals.push({ brand: 'jio', name: 'Jio', retainer: 80, bonus: 400, target: { kind: 'clean', count: 3 }, progress: 0, met: false, mood: 3 }); const rep0 = s.career.rep; round(s, 8, 999); if (!s.sponsors.deals.length) { walked++; assert.ok(s.inbox.some((m) => m.title === 'Jio ended the deal'), 'the same message as a skipped sponsor day'); } if (s.media.some((m) => m.title.includes('still happy'))) harsh++; }
      assert.ok(harsh >= 5, 'harsh press'); assert.ok(walked >= 3 && walked <= 25, `an unhappy driver loses a sponsor now and then (${walked} of 40)`);
      const d = signed(1350); assert.equal(O.demandTransfer(d).reason, 'happy', 'a content driver cannot demand'); d.life.happy = 8; round(d, 8, 999); d.life.happy = 8; assert.equal(C.currentWeek(d).kind, 'open'); const t0 = d.contract.trust, r = O.demandTransfer(d);
      assert.ok(r.ok && r.offers.length >= 1 && r.offers.length <= 2); assert.ok(d.season.mid.every((o) => r.offers.includes(o.id) && o.team !== d.contract.team && o.w1), 'offers through the mid-season market'); assert.equal(d.contract.trust, t0 - 6); assert.equal(d.life.demanded, 1); assert.equal(O.demandTransfer(d).reason, 'asked', 'once a season');
      const id = r.offers[0]; assert.ok(C.findOffer(d, id)); const sg = C.signMid(d, id); assert.ok(sg && d.contract.next, 'it can be signed like any W1 offer'); toReview(d, 8, 999); assert.equal(d.pending.offers.length, 1, 'the signed deal stands'); assert.equal(d.pending.offers[0].team, d.contract.next.team); assert.ok(d.pending.offers.length >= 1);
      { const L = await server.ssrLoadModule('/src/game/career/ledger.js'); let g, os = [];
        for (const mt of R.TEAM_IDS.filter((t) => R.TIERS.teams[t].tier === 'maestro')) {   // a Maestro driver with no reputation: below every Maestro bar, and the other Maestro teams answer anyway
          if (os.some((o) => O.interestFor(g, o.team, { cool: false }) === null)) break;
          g = signed(1353); g.life.happy = 8; round(g, 8, 999); g.life.happy = 8; for (const t of R.TEAM_IDS) L.note(g, 'spurned', { team: t, w: 2 });
          const car = R.seatCar(mt, 'B'), Wg = g.world; Wg.seats[g.contract.car] = Wg.seats[car]; Wg.seats[car] = 'YOU'; Object.assign(g.contract, { team: mt, seat: 'B', car }); g.season.tier = 'maestro'; g.season.div = Wg.teams[mt].div; g.career.rep = 0;   // the seat's own series: a Challenger driver is not offered an Elite seat they cannot qualify (offGrid)
          const ids = O.demandTransfer(g).offers; os = g.season.mid.filter((o) => ids.includes(o.id) && !o.reserve); }
        for (const o of os) { assert.equal(o.cool, undefined, 'the demand ignores refusals, so no cool line'); if (O.interestFor(g, o.team, { cool: false }) === null) assert.ok(!/clear their bar/.test(o.why) && /were not looking at you/.test(o.why), `below the bar, a true reason: ${o.why}`); }
        assert.ok(os.some((o) => O.interestFor(g, o.team, { cool: false }) === null), 'a team below whose bar the player is answers too'); }
      const e = signed(1351); e.life.happy = 8; round(e, 8, 999); e.life.happy = 8; O.demandTransfer(e); C.advanceWeek(e); assert.equal(e.season.mid.length, 0, 'offers lapse when the week is advanced'); assert.equal(C.currentWeek(e).kind, 'race');
      const f = signed(1352); f.life.happy = 8; assert.equal(C.currentWeek(f).kind, 'pre'); C.advanceWeek(f); assert.equal(O.demandTransfer(f).reason, 'race', 'not in a race week'); }
    // upkeep: paid at the season's start, and what the wallet cannot carry is sold at half price: never a negative wallet, never a debt
    { const s = signed(1120); Object.assign(s.life.owned, { apartment: 2, mansion: 1 }); s.wallet.coins = 100; const out = Lf.payUpkeep(s);
      assert.ok(s.wallet.coins >= 0, 'never below 0'); assert.deepEqual(out.sold, ['apartment', 'mansion'], 'the cheapest are kept first, the rest sold'); assert.equal(s.wallet.coins, 100 + 2500 - 300 + 37500);
      const t = signed(1121); Object.assign(t.life.owned, { yacht: 1 }); t.wallet.coins = 5000; const o2 = Lf.payUpkeep(t); assert.deepEqual(o2.sold, ['yacht']); assert.equal(t.wallet.coins, 5000 + 160000, 'sold for half its price'); assert.equal(C.ownedN(t, 'yacht'), 0);
      const u = signed(1122); Object.assign(u.life.owned, { penthouse: 1 }); u.wallet.coins = 50000; const o3 = Lf.payUpkeep(u); assert.deepEqual([o3.paid, o3.sold, u.wallet.coins], [1200, [], 48800]);
      // through the real season roll: a driver who cannot pay loses the item, hears about it, and the career goes on
      const v = signed(1123); v.life.owned.yacht = 1; v.wallet.coins = 0; toReview(v, 6, 999); v.wallet.coins = 0; const old = v.contract.car; C.acceptOffer(v, v.pending.offers[0].id, avail); assert.ok(v.wallet.coins >= 0); assert.equal(C.ownedN(v, 'yacht'), 0, 'sold');
      assert.ok(v.inbox.some((m) => /yacht was sold/.test(m.title)) && v.media.some((m) => /sells the yacht/.test(m.title)), 'and it says so'); assert.equal(v.life.ads['ad-shoot'] ?? 0, 0, 'ad caps start again with the season');
      const w = signed(1124); w.life.owned.apartment = 1; w.wallet.coins = 90000; toReview(w, 2, 1); C.acceptOffer(w, w.pending.offers[0].id, avail); assert.ok(w.inbox.some((m) => /Upkeep paid/.test(m.title)) && C.ownedN(w, 'apartment') === 1, 'an owner who can pay keeps it'); }
    // old saves: schema 6 gets a mood at 50 and nothing owned; a season under way has no activity booked and plays on
    { const s = signed(1130); round(s, 4, 60); delete s.life; s.schema = 6; const keep = JSON.stringify(s.season.weeks); C.migrate(s); assert.equal(s.schema, C.SCHEMA); assert.equal(s.life.happy, 50); assert.deepEqual(s.life.owned, {}); assert.equal(JSON.stringify(s.season.weeks), keep, 'the weeks are untouched'); round(s, 4, 60); assert.ok(s.life.happy > 0);
      const r = JSON.parse(JSON.stringify(signed(1131))); assert.deepEqual(C.migrate(r).life, signed(1131).life, 'a current save is unchanged by migrate'); }
    // whole careers with a shopper: solvent, in range, small, and they replay
    { const a = play(M, 31, 1.0, 5, 'sprint', { life: true }), b = play(M, 31, 1.0, 5, 'sprint', { life: true }); assert.equal(JSON.stringify(a.save), JSON.stringify(b.save), 'a shopping career replays');
      for (const skill of [0.975, 1.0, 1.02]) for (let i = 0; i < 4; i++) { const { save, log } = play(M, 1400 + i, skill, 9, 'sprint', { life: true }); assert.ok(log.minWallet >= 0 && log.offers.every((k) => k >= 1), 'no dead end'); assert.ok(log.mood.every((m) => m.happy >= 0 && m.happy <= 100 && m.fans >= 0 && m.fans <= 100)); assert.ok(JSON.stringify(save).length < 100_000, 'the save stays small with a house full of things'); assert.ok(Object.values(save.life.owned).every((n) => n >= 1 && n <= 3)); } }
  }

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
    const base = (seed = 77, elite = false) => { const s = C.newCareer({ name: 'Ana Test', seed, now: 'x' }), o0 = (C.finishShootout(s, null), s.pending.offers[0]); if (elite) { s.world.teams[o0.team].div = 'elite'; s.world.teams.sarab.div = 'challenger'; } C.acceptOffer(s, o0.id, avail); return s; };   // elite: the team promoted, so it can miss the cut
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
    s = base(77, true); raceWeek(s); C.finishQuali(s, 1e6, null); assert.ok(!s.season.current.quali.grid.includes(s.contract.car), 'too slow'); let n0 = s.mediaN ?? 0;
    C.finishDnq(s); got = s.media.filter((x) => x.id > n0);
    assert.ok(got.some((x) => x.kind === 'down' && x.title.includes('misses the cut')), 'a missed cut is covered');
    {                                                            // the same, with a teammate who did make the grid
      let d = null;
      for (let seed = 1; !d && seed < 200; seed++) { const t = base(seed, true); raceWeek(t); C.finishQuali(t, 1e6, null); if (t.season.current.quali.grid.includes(t.season.current.quali.mate.car)) d = t; }
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
    const m = base(), key = Object.keys(m.world.seats).find((k) => m.world.seats[k] !== 'YOU'), code = m.world.seats[key], other = Object.keys(m.world.seats).find((k) => R.CAR[k].team !== R.CAR[key].team && m.world.seats[k] !== 'YOU'), before = { ...m.world.seats };
    [m.world.seats[key], m.world.seats[other]] = [m.world.seats[other], code]; Md.coverMoves(m, before, []);
    assert.ok(m.media.some((x) => x.kind === 'move' && x.driver === code && x.title.includes(R.loreOf(R.CAR[other].team).name)), 'the move names the new team');
    assert.equal(Md.storyImage(m, { driver: code, mood: 'portrait', track: 'marina' }).moved ?? false, Boolean(media.images[code]?.length), 'a moved driver with a photo: it is a file photo');
    // the drama rolls never touch the career's other streams: same seed, same world
    assert.equal(JSON.stringify(play(M, 11, 1.0, 2).save.media), JSON.stringify(play(M, 11, 1.0, 2).save.media), 'the press replays');
    assert.ok(play(M, 11, 1.0, 2).save.media.some((x) => x.kind === 'drama' || x.kind === 'move' || x.kind === 'duel'), 'a two-season career has more than results in the papers');
  }

  // ---- the contract market (6.5, 6.8): contracts, the cascade, stars, the displaced driver, academy names, coolness, reasons, rumours, the counter-bid, schema 9
  { const W = await server.ssrLoadModule('/src/game/career/world.js'), O = await server.ssrLoadModule('/src/game/career/offers.js'), MK = R.TUNING.market, keep = { ...MK };
    const map = (s) => JSON.stringify([s.world.seats, s.world.contracts]);
    assert.equal(map(play(M, 21, 1.0, 6).save), map(play(M, 21, 1.0, 6).save), 'the same seed: the same seats and contracts after six seasons');
    { const n = C.newCareer({ seed: 5, now: 'x' }); assert.ok(Object.values(n.world.contracts).every((c) => c >= 1 && c <= 3)); assert.equal(Object.keys(n.world.contracts).length, R.FIELD); assert.deepEqual(n.career.ledger, []);
      assert.notDeepEqual(n.world.contracts, C.newCareer({ seed: 6, now: 'x' }).world.contracts, 'contracts are seeded'); }
    // a world at the season end with nobody retiring, dropped or out of contract, so each test opens exactly the seats it means to
    const still = (seed, left = 3) => { const s = toReview(signed(seed), 4); const Wd = s.world; for (const c of Object.keys(Wd.ages)) Wd.ages[c] = 25; Wd.free = []; for (const c of Object.values(Wd.seats)) if (c !== W.YOU) Wd.contracts[c] = left; return s; };
    const teamOf = (seats) => Object.fromEntries(Object.entries(seats).filter(([, c]) => c && c !== W.YOU).map(([k, c]) => [c, R.CAR[k].team]));
    MK.dropGap = 99; MK.maxSacks = 0; MK.maxPoach = 0;   // sackings and poaches have their own tests
    for (const max of [1, 3]) {                              // three top seats open, every lower driver in their last season: the cascade stops at maxMoves, the academy fills the rest
      MK.maxMoves = max; const s = still(2001, 2), Wd = s.world; for (const k of ['destrier', 'buggati', 'laferrari']) Wd.seats[k] = null;
      const was = teamOf(Wd.seats); W.marketMoves(s); const now = teamOf(Wd.seats), moved = Object.keys(was).filter((c) => now[c] && now[c] !== was[c]);
      assert.equal(moved.length, max, `the cascade moves ${max}`); assert.ok(Object.values(Wd.seats).every(Boolean), 'and every seat is filled');
      assert.ok(moved.every((c) => Wd.contracts[c] >= 2 && Wd.contracts[c] <= 3), 'a signing runs 2-3 seasons'); }
    { const s = still(2002), Wd = s.world, X = 'supra', Y = 'blackbird', D = 'ZZD';     // the displaced driver, the best free agent, skips the player's old seat (filled first, a better team's) while another is open
      Wd.academy[D] = { name: 'Zed Displaced', nation: 'GBR' }; Wd.ratings[D] = 95; Wd.ages[D] = 25; Wd.free = [D]; Wd.seats[X] = null; Wd.seats[Y] = null;
      W.marketMoves(s, { displaced: D, vacated: X }); assert.equal(Wd.seats[Y], D); assert.notEqual(Wd.seats[X], D);
      const t = still(2003), Wt = t.world; Wt.academy[D] = { name: 'Zed Displaced', nation: 'GBR' }; Wt.ratings[D] = 95; Wt.ages[D] = 25; Wt.free = [D]; Wt.seats[X] = null;
      W.marketMoves(t, { displaced: D, vacated: X }); assert.equal(Wt.seats[X], D, 'the only seat open: they may take it'); }
    Object.assign(MK, keep);
    { const s = still(2004), Wd = s.world, names = () => [...Object.values(Wd.academy).map((a) => a.name), ...Object.values(R.CAR).map((c) => c.driver.name)];   // the academy past its list: seeded names, all different
      for (let i = 0; i < 3; i++) { for (const k of Object.keys(Wd.seats)) if (Wd.seats[k] !== W.YOU) Wd.seats[k] = null; Wd.free = []; W.marketMoves(s); }
      const n = names(), codes = Object.keys(Wd.academy); assert.ok(codes.length >= 40); assert.deepEqual(codes.slice(0, R.DRIVERS.academy.length), R.DRIVERS.academy.map((a) => a.code), 'the named drivers are called up first'); assert.equal(new Set(n).size, n.length, 'academy names are unique'); assert.equal(new Set([...codes, ...Object.values(R.CAR).map((c) => c.driver.code)]).size, codes.length + R.FIELD, 'and so are their codes');
      const gen = Object.values(Wd.academy).filter((a) => !R.DRIVERS.academy.some((x) => x.name === a.name)); assert.ok(gen.length > 20 && gen.every((a) => { const [f, l] = a.name.split(' '); return R.DRIVERS.academyNames.first.includes(f) && R.DRIVERS.academyNames.last.includes(l) && R.DRIVERS.academyNames.nations.includes(a.nation); })); }
    { const s = signed(2005), Wd = s.world, star = 'VAL', car = Object.keys(Wd.seats).find((k) => Wd.seats[k] === star), team = R.CAR[car].team, seat = R.CAR[car].seat;   // a star with seasons left is never dropped for the player
      Wd.contracts[star] = 2; s.season.results.push({ entries: [], duel: { mine: 50, mate: 60, mateCode: Wd.seats[C.teammateCar(s)] } }); assert.equal(R.playerRating(s), 99, 'a huge qualifying margin rates 99');
      assert.equal(O.seatFor(s, team, seat, 1), false, 'not even for a 99 the team wants badly'); Wd.contracts[star] = 1; assert.equal(O.seatFor(s, team, seat, 0), true, 'their last season: the seat opens');
      const other = Wd.seats[R.TIERS.teams[team][R.otherSeat(seat)]]; Wd.contracts[star] = 2; Wd.contracts[other] = 2; Wd.ratings[other] = 85; assert.equal(O.seatFor(s, team, R.otherSeat(seat), 0), true, 'a non-star the player outrates');
      s.season.results.length = 0; Wd.ratings[other] = 89; assert.ok(R.playerRating(s) < 89); assert.equal(O.seatFor(s, team, R.otherSeat(seat), 0.84), false); assert.equal(O.seatFor(s, team, R.otherSeat(seat), 0.85), true, 'or one bought out');
      assert.match(O.signedWhy(s, team, 0), /^Both seats are signed: \w+ to S2, \w+ to S2$/); s.career.rep = 999; s.career.rr = [9, 9, 9, 9, 9, 9]; s.career.cl = 25; assert.equal(O.outsideOffer(s, team, 0.5), null, 'no seat, no offer'); }
    { const s = toReview(signed(2006), 2), o = s.pending.offers.find((x) => x.team !== s.contract.team) ?? s.pending.offers[0];   // coolness: a walk-away cools the team and fades; a lapsed or unpicked offer adds nothing
      const t = o.team === s.contract.team ? 'toro' : o.team; if (o.team !== t) s.pending.offers.push({ ...o, id: 'x-cool', team: t, keep: false });
      C.walkAway(s, o.team === t ? o.id : 'x-cool'); const cool = R.TUNING.offers.cool * R.TUNING.offers.spurned;
      assert.ok(Math.abs(O.coolOf(s, t) - cool) < 1e-9, 'a walk-away cools the team'); s.clock.season++; assert.ok(Math.abs(O.coolOf(s, t) - R.TUNING.offers.cool) < 1e-9, 'a season on, less'); s.clock.season++; assert.equal(O.coolOf(s, t), 0, 'and then it is forgotten'); s.clock.season -= 2;
      const st = O.termsFor(s, t); if (st) assert.ok(Math.abs(st.cool + cool) < 1e-9, 'the cool is a named term of the interest');
      const l = signed(2007); l.season.mid.push({ id: 'x-lapse', team: 'toro', seat: 'B', car: 'huracan', tier: 'maestro', status: 'junior', salary: 500, signing: 1000, seasons: 2, why: 'x', w1: true, expires: l.clock.week }); C.advanceWeek(l);
      assert.deepEqual(l.career.ledger, [], 'a lapsed offer is no refusal'); const u = toReview(signed(2008), 1, 1); C.acceptOffer(u, u.pending.offers[0].id, avail); assert.deepEqual(u.career.ledger, [], 'nor an unpicked one'); }
    { const s = signed(2009); s.career.rep = 700; s.career.rr = [8, 8, 8, 8, 8, 8]; s.career.cl = 20; let n = 0;   // every reason reads, with no token left
      for (const t of R.TEAM_IDS) for (const i of [0, 0.3, 0.7, 1]) { const o = O.outsideOffer(s, t, i); if (o) { n++; assert.ok(o.why.length > 20 && !/[{}]/.test(o.why), o.why); assert.equal(o.rating, R.playerRating(s)); } }
      assert.ok(n > 4); assert.ok(O.whyOf(s, 'toro', null).length > 20, 'no named term: still a reason'); assert.match(O.whyOf(s, 'toro', { rep: 0, rating: 0, form: 0, want: 0.1 }), /overtakes and giant-killing/, 'a want in the team\'s own words'); }
    { let r = null; for (let i = 2100; i < 2160 && !r; i++) { const s = signed(i); s.career.rep = 300; s.career.cl = 8; s.career.rr = [7, 7, 7, 7, 7, 7];   // the market week's rumours name seats that open at the season end, unless that driver re-signs
        while (C.currentWeek(s).kind !== 'market') { if (C.currentWeek(s).kind === 'race') round(s, 2, 1); else C.advanceWeek(s); }
        if (s.season.rumours?.length) r = s; }
      assert.ok(r, 'a market week with rumours'); const rs = r.season.rumours.map((x) => ({ ...x }));
      assert.ok(r.inbox.some((m) => /up for renewal/.test(m.title) && /Shortlist/.test(m.body)), 'in the inbox'); assert.ok(r.media.some((m) => m.kind === 'rumor' && /up for renewal/.test(m.title)), 'and the press');
      assert.ok(rs.every((x) => r.world.contracts[x.code] === 1 && x.list.length <= 3 && !x.list.includes(x.code)));
      assert.ok(rs.every((x) => x.list.every((c) => c === W.YOU || r.world.free.includes(c) || r.world.contracts[c] === 2 || W.poachable(r, x.car).includes(c))), 'the shortlist is the one the market draws: free agents, drivers whose last season the market will see (two left now), and the ones a team could poach');
      toReview(r, 2, 1); const k = r.pending.offers.find((o) => o.keep) ?? r.pending.offers[0]; C.acceptOffer(r, k.id, avail);
      for (const x of rs) assert.ok(r.world.seats[x.car] !== x.code || r.world.contracts[x.code] >= 2, `${x.car}: the seat opened or ${x.code} re-signed`); }
    { const lost = (talked, heat = 45) => { const s = signed(2050), Wd = s.world, k = R.TEAM_IDS.map((t) => R.seatCar(t, 'A')).sort((a, b) => Wd.teams[R.CAR[a].team].expPos - Wd.teams[R.CAR[b].team].expPos)[0], was = Wd.seats[k];   // a seat lost to a rival
        Wd.contracts[was] = 1; Wd.ratings[was] = 60; Wd.ratings.ZZX = 99; Wd.ages.ZZX = 25; Wd.free.push('ZZX'); s.career.heat = heat ? { ZZX: heat } : {}; s.career.rivalry = heat ? { ZZX: { cause: 'pass', since: [1, 1], w: 0, l: 0 } } : {};
        s.season.rumours = [{ car: k, code: was, list: [W.YOU, 'ZZX'] }]; s.season.talked = { [R.CAR[k].team]: talked };
        W.marketMoves(s); assert.equal(Wd.seats[k], 'ZZX'); return s.career; };
      assert.equal(lost(0).heat.ZZX, 45, 'a rival takes a seat the player did not want (never approached, or walked away): no new heat');
      assert.equal(lost(1, 0).heat.ZZX, undefined, 'a shortlisted driver who was not a rival: no rivalry from the seat alone');
      assert.equal(lost(1, 30).heat.ZZX, 30, 'heat under 40 is not a rival yet: no seat heat');
      const K = lost(1); assert.equal(K.heat.ZZX, 45 + R.TUNING.rivals.seatLost); assert.equal(K.rivalry.ZZX.cause, 'seat', 'a rival took the seat the player wanted: the rivalry is now over the seat'); }
    { let m = null; for (let i = 2200; i < 2400 && !m; i++) { const s = signed(i); s.career.rep = 400; s.career.cl = 10; toReview(s, 1, 1); const out = s.pending.offers.filter((o) => o.team !== s.contract.team && !o.reserve); if (out.length >= 2 && out.some((o) => /have (matched|raised their offer)/.test(o.why))) m = out; }   // two bids: the lesser one matches
      assert.ok(m, 'two outside offers, one answering the other, on some seeds'); const lo = m.find((o) => /have (matched|raised their offer)/.test(o.why)); assert.equal(lo, m.at(-1), 'the lesser one');
      assert.equal(/have matched/.test(lo.why), lo.salary >= Math.max(...m.slice(0, -1).map((o) => o.salary)), 'it says matched only when it pays as much'); assert.ok(lo.salary <= Math.max(...m.map((o) => o.salary))); }
    { const s = signed(2010); s.schema = 8; delete s.world.contracts; delete s.career.ledger; C.migrate(s); assert.equal(s.schema, C.SCHEMA);   // a schema-8 save gets contracts and an empty ledger
      assert.deepEqual(Object.keys(s.world.contracts).sort(), Object.values(s.world.seats).filter((c) => c !== W.YOU).sort()); assert.deepEqual(s.career.ledger, []); }
  }

  // ---- rivals on track (6.6, driver.js): composure, team orders, the race profiles, and what obeying or ignoring an order does
  { const O = R.TUNING.trust.orders;
    assert.equal(R.composureOf(70, 25), 0.35); assert.equal(R.composureOf(90, 25).toFixed(2), '0.75'); assert.equal(R.composureOf(90, 33).toFixed(2), '0.85', 'over 30: calmer');
    assert.equal(R.composureOf(40, 20), 0.2); assert.equal(R.composureOf(99, 35), 0.95, 'clamped to 0.2-0.95');
    const ord = (seat, trust, won, lost, mateFirst) => { const s = signed(180); C.finishQuali(s, 1); const g = s.season.current.quali.grid, me = s.contract.car, mate = C.teammateCar(s);
      s.season.current.quali.grid = [...(mateFirst ? [mate, me] : [me, mate]), ...g.filter((k) => k !== me && k !== mate)]; Object.assign(s.contract, { seat, trust, duel: { won, lost, level: 0 } }); return R.ordersFor(s); };
    assert.equal(ord('A', 50, 0, 3, true), 'toYou', 'the A seat: the teammate lets you by');
    assert.equal(ord('B', O.toYou, 3, 2, true), 'toYou', 'trust 70 and the duel won: the team backs you');
    assert.equal(ord('B', O.toYou, 2, 2, true), null, 'a level duel is not enough'); assert.equal(ord('B', O.toYou - 1, 3, 2, true), null);
    assert.equal(ord('B', O.toMate - 1, 0, 0, true), 'toMate', 'the B seat, trust under 40, the teammate ahead on the grid: you are asked to let them by');
    assert.equal(ord('B', O.toMate - 1, 0, 0, false), null, 'not with the teammate behind you on the grid'); assert.equal(ord('B', O.toMate, 0, 0, true), null);
    // the race profiles: AI cars only, roles nemesis > rival > teammate, seeded, the knobs a copy of tuning's
    const both = (t) => { C.finishQuali(t, 1); const q = t.season.current.quali, m = t.contract.car, mt = C.teammateCar(t); q.grid = [m, mt, ...q.grid.filter((k) => k !== m && k !== mt)].slice(0, q.grid.length); return q.grid; };   // both team cars on the grid
    const s = signed(181), g = both(s), me = s.contract.car, mate = C.teammateCar(s), others = g.filter((k) => k !== me && k !== mate);
    s.career.heat = { [s.world.seats[others[0]]]: 75, [s.world.seats[others[1]]]: 45 }; const X = C.raceSetup(s), X2 = C.raceSetup(s);
    assert.ok(!(me in X.ai) && Object.keys(X.ai).length === g.length - 1, 'every AI car has a profile, the player none');
    assert.deepEqual([X.ai[others[0]].role, X.ai[others[1]].role, X.ai[mate].role, X.ai[others[2]].role], ['nemesis', 'rival', 'mate', null]);
    assert.equal(X.nemesis.key, others[0]); assert.equal(X.mateKey, mate); assert.equal(X.orders, R.ordersFor(s));
    assert.equal(JSON.stringify(X.ai), JSON.stringify(X2.ai), 'the same round, the same profiles'); assert.ok(new Set(Object.values(X.ai).map((p) => p.seed)).size === g.length - 1, 'a seed per car');
    assert.ok(Object.values(X.ai).every((p) => Number.isInteger(p.seed) && p.composure >= 0.2 && p.composure <= 0.95));
    X.ai[mate].k.defend.on = false; assert.equal(R.TUNING.rivals.track.defend.on, true, 'the knobs are a copy');
    s.career.heat[s.world.seats[mate]] = 90; assert.equal(C.raceSetup(s).ai[mate].role, 'nemesis', 'a teammate who is the nemesis races as one');
    // obeying 'let them by' earns trust; ignoring it costs trust, heats the teammate and makes the papers. 'toYou' and no order change nothing
    const race = (orders) => { const t = signed(182), gr = both(t); t.career.heat = {}; t.career.rivalry = {}; const m = t.contract.car, mt = C.teammateCar(t);
      const order = [mt, m, ...gr.filter((k) => k !== m && k !== mt)], before = t.contract.trust, press = t.media?.length ?? 0, rep = C.finishRace(t, { order, best: {}, crashes: 0, spins: 0, orders });
      return { t, rep, dt: t.contract.trust - before, heat: t.career.heat[t.world.seats[mt]] ?? 0, cause: t.career.rivalry[t.world.seats[mt]]?.cause, stories: (t.media ?? []).slice(0, t.media.length - press) }; };
    const none = race(null), yes = race({ kind: 'toMate', obeyed: true }), no = race({ kind: 'toMate', obeyed: false }), you = race({ kind: 'toYou', obeyed: true });
    assert.equal(yes.dt - none.dt, O.obeyed, 'obeyed: trust +4'); assert.deepEqual(yes.rep.orders, { obeyed: true, trust: O.obeyed });
    assert.equal(no.dt - none.dt, -O.ignored, 'ignored: trust -6'); assert.equal(no.heat - none.heat, R.TUNING.rivals.ordersIgnored, 'and the teammate +15 heat'); assert.equal(no.cause, none.cause, 'the qualifying duel came first, so it stays the cause');
    { const W = await server.ssrLoadModule('/src/game/career/world.js'), t = signed(183), c = Object.values(t.world.seats).find((x) => x !== W.YOU); t.career.heat = { ZZZ: 79 }; t.career.rivalry = {};
      W.heatUp(t, c, 85, 'orders'); assert.equal(t.career.rivalry[c].cause, 'orders', 'a new rivalry from ignored orders says so'); assert.equal(t.career.heat.ZZZ, 79); assert.equal(Object.values(t.career.heat).filter((h) => h >= R.TUNING.rivals.feud).length, 1, 'still one feud at most'); }
    assert.ok(no.stories.some((x) => /ignores team orders/.test(x.title)), 'a story'); assert.ok(!yes.stories.some((x) => /team orders/.test(x.title)));
    assert.equal(you.dt, none.dt); assert.equal(you.heat, none.heat); assert.equal(you.rep.orders, null);
    assert.equal(race({ kind: 'toMate' }).dt, none.dt, 'an order with no outcome (a retirement) settles nothing');
  }

  // ---- choices with consequences (6.9, choices.js): the fixed effects and their bounds, defaults, the callout paid once, callbacks that quote the ledger, replay
  { const X = await server.ssrLoadModule('/src/game/career/choices.js'), W = await server.ssrLoadModule('/src/game/career/world.js'), O = await server.ssrLoadModule('/src/game/career/offers.js');
    const Md = await server.ssrLoadModule('/src/game/career/media.js'), L = await server.ssrLoadModule('/src/game/career/ledger.js'), CH = X.CHOICES, cap = R.SPONSORS.startMood + 3;
    const ctxOf = (s) => { const who = s.world.seats[R.carsIn(s, s.season.div ?? 'all').find((k) => s.world.seats[k] !== W.YOU && R.CAR[k].team !== s.contract.team)]; return { who, team: 'toro', gp: 'Test GP', stake: 12, exp: 5, result: 'P1' }; };   // a driver of the player's series
    for (const sc of CH.scenes) {
      assert.ok(sc.options.length >= 2 && sc.options.length <= 3 && sc.options.some((o) => o.label === sc.default), `${sc.id}: 2-3 options, the default among them`);
      for (const o of sc.options) for (const e of o.effects) {
        const k = Object.keys(e).filter((x) => x in X.EFFECTS); assert.equal(k.length, 1, `one effect from the fixed list: ${JSON.stringify(e)}`);
        if (X.EFFECTS[k[0]] !== null) assert.ok(Math.abs(e[k[0]]) <= X.EFFECTS[k[0]], `within its bound: ${JSON.stringify(e)}`);
        if (k[0] === 'story') assert.ok(sc.story[e.story]);
      }
      for (let i = 0; i < sc.options.length; i++) for (const edge of [0, 100]) {     // every option at the edges of trust, reputation and goodwill stays in bounds
        const s = signed(3000 + edge); s.contract.trust = edge; s.career.rep = edge * 10; s.sponsors.deals.push({ brand: 'x', name: 'X', mood: edge ? cap : 1, target: { kind: 'top', count: 9 }, progress: 0, met: false });
        const ch = X.pose(s, sc.id, ctxOf(s)), m = s.inbox[0];
        assert.deepEqual(m.action, { choice: ch.id }); assert.equal(m.kind, 'choice'); assert.ok(!/[{}]/.test(m.title + m.body + ch.options.map((o) => o.label + o.effectText).join('')), 'every token filled');
        X.answerChoice(s, ch.id, i); assert.equal(X.answerChoice(s, ch.id, 0), null, 'answered once');
        assert.ok(s.contract.trust >= 0 && s.contract.trust <= 100 && s.career.rep >= 0 && s.career.rep <= 1000 && s.sponsors.deals.every((d) => d.mood >= 1 && d.mood <= cap));
        assert.ok(Object.values(s.career.heat).every((h) => h >= 0 && h <= 100)); assert.ok(m.read, 'an answered scene is read');
      }
    }
    { const s = signed(3010), t0 = s.contract.trust, ch = X.pose(s, 'press', ctxOf(s));      // unanswered: the default at the end of the week, with a note
      assert.equal(X.openChoices(s).length, 1); C.advanceWeek(s);
      const c = X.choiceOf(s, ch.id); assert.equal(c.answer, CH.scenes.find((x) => x.id === 'press').options.findIndex((o) => o.label === 'Credit the team')); assert.ok(c.auto);
      assert.equal(s.contract.trust, t0 + 3); assert.ok(s.inbox.some((m) => /^No answer: Press conference/.test(m.title) && /Credit the team/.test(m.body)), 'and a note says so'); }
    { const s = signed(3011); C.finishQuali(s, 1); const g = s.season.current.quali.grid, me = s.contract.car, key = g.find((k) => k !== me), who = s.world.seats[key];   // the callout
      const ch = X.pose(s, 'callout', { ...ctxOf(s), who }); X.answerChoice(s, ch.id, 0); assert.deepEqual(s.season.current.flag, { kind: 'callout', who });
      const r1 = round(s, 1), line = r1.repLines.find((l) => /^Callout won/.test(l[0])), higher = R.tierOf(R.CAR[key].team).rank > R.tierOf(s.contract.team).rank;
      assert.ok(line, 'beating them pays'); assert.equal(line[1], higher ? 18 : 12); assert.ok(r1.xpLines.some((l) => l[0] === 'Callout won' && l[1] === 60));
      assert.equal(L.latest(s, { kinds: ['callout_won'] }).who, who); assert.ok(s.media.some((m) => m.title.includes('answers')), 'and the press writes it');
      assert.equal(s.season.current.flag, undefined, 'the flag clears after one race'); assert.ok(!round(s, 1).repLines.some((l) => /^Callout/.test(l[0])), 'and pays once');
      C.finishQuali(s, 1); const g2 = s.season.current.quali.grid, k2 = g2.find((k) => k !== me); s.season.current.flag = { kind: 'callout', who: s.world.seats[k2] };
      const lost = round(s, 8).repLines.find((l) => /^Callout lost/.test(l[0])); assert.deepEqual(lost?.[1], CH.callout.lose.rep, 'finishing behind costs'); assert.ok(L.latest(s, { kinds: ['callout_lost'] }));
      const f = { kind: 'callout', who }; s.season.current.flag = f; assert.ok(X.settleCallout(s, g, me, false)); assert.equal(X.settleCallout(s, g, me, false), null, 'one payment per flag'); delete s.season.current.flag; }
    { const s = signed(3016), cut = CH.callout.composure, code = ctxOf(s).who, key = Object.keys(s.world.seats).find((k) => s.world.seats[k] === code), T = X.TRIGGERS.callout;   // who can call the player out, and for which round
      CH.callout.composure = 2; s.career.heat[code] = 90;
      try {
        const c = T(s); assert.equal(c?.who, code); assert.equal(c.round, s.season.current.round);
        X.pose(s, 'callout', c); assert.equal(T(s), null, 'one callout a round: a second flag would replace the first');
        s.season.choices = {}; s.season.current.flag = { kind: 'callout', who: code }; assert.equal(T(s), null); delete s.season.current.flag;
        s.season.current.open = { kind: 'masters', seeded: false, seeds: [key] }; assert.equal(T(s), null, 'no callout for a Masters the player is not in');
        s.season.current.open = { kind: 'masters', seeded: true, seeds: [s.contract.car] }; assert.equal(T(s), null, 'nor from a driver outside its eight');
        s.season.current.open.seeds.push(key); assert.equal(T(s)?.who, code); delete s.season.current.open;
        const el = s.world.seats.destrier; s.career.heat = { [el]: 95 }; s.season.choices = {}; assert.equal(T(s), null, 'an Elite driver cannot call out a Challenger driver at a Tour round: they never meet');   // 16.20
      } finally { CH.callout.composure = cut; } }
    { const s = signed(3012), code = Object.values(s.world.seats).find((c) => c !== W.YOU && c !== s.world.seats[C.teammateCar(s)]), name = C.personOf(s, code).name;   // callbacks name a real ledger entry
      L.note(s, 'bold_press', { who: code }); const cb = Md.callbackOf(s, 'offer', { kinds: ['bold_press'] });
      assert.ok(s.career.ledger.includes(cb.entry) && cb.text.includes(name) && cb.text.includes('Season 1'), cb.text);
      s.career.rep = 700; s.career.rr = [8, 8, 8, 8, 8, 8]; s.career.cl = 20; let o = null; for (const t of R.TEAM_IDS) o ??= O.outsideOffer(s, t, 0.5);
      assert.ok(o && o.why.endsWith(cb.text), 'an offer quotes it'); { const more = R.TEAM_IDS.map((t) => O.outsideOffer(s, t, 0.5)).filter(Boolean); O.quoteOnce(s, more); assert.ok(more.length >= 2 && more.filter((x) => x.why.includes(cb.text)).length === 1, 'several cards: one quotes it'); } L.note(s, 'spurned', { team: o.team, w: 2 }); assert.equal(O.outsideOffer(s, o.team, 0.5).cool, Md.callbackOf(s, 'offer', { team: o.team, kinds: ['spurned'] }).text, 'a cool team quotes the refusal');
      assert.match(O.outsideOffer(s, o.team, 0.5).cool, /Season 1/); s.clock.season += 2; assert.equal(Md.callbackOf(s, 'offer', { kinds: ['bold_press'] }), null, 'two seasons on, it is forgotten'); s.clock.season -= 2;
      const p = signed(3013); C.finishQuali(p, 1); const mt = C.teammateCar(p), mc = p.world.seats[mt], gp = p.season.current.quali.grid; p.season.current.quali.grid = [mt, p.contract.car, ...gp.filter((k) => k !== mt && k !== p.contract.car)].slice(0, gp.length);
      C.finishRace(p, { order: p.season.current.quali.grid, best: {}, crashes: 0, spins: 0, orders: { kind: 'toMate', obeyed: false } }); assert.equal(L.latest(p, { kinds: ['orders_ignored'] }).who, mc);
      toReview(p, 3); const st = p.media.find((m) => /on team orders$/.test(m.title)); assert.ok(st && st.principal === p.contract.team && st.body.includes(C.personOf(p, mc).name), 'the principal quotes it at the season end'); }
    { const s = signed(3014); s.career.rep = 800; s.career.rr = [8, 8, 8, 8, 8, 8]; s.career.cl = 20;    // stoking a rumour: that team keener this season, and only this season
      const team = R.TEAM_IDS.find((t) => { const i = O.interestFor(s, t); return i !== null && i < 0.85; }), i0 = O.interestFor(s, team), ch = X.pose(s, 'rumour', { ...ctxOf(s), team });
      X.answerChoice(s, ch.id, 1); s.career.rep = 800; assert.ok(Math.abs(O.interestFor(s, team) - i0 - 0.1) < 1e-9, 'the reputation it also paid aside'); assert.equal(X.leanOf(s, R.TEAM_IDS.find((t) => t !== team)), 0); s.season.choices = {}; assert.equal(O.interestFor(s, team), i0); }
    { const s = signed(3015); s.schema = 9; delete s.season.choices; C.migrate(s); assert.equal(s.schema, C.SCHEMA); assert.deepEqual(s.season.choices, {}, 'a schema-9 save gets no scenes'); }
    const { createHash } = await import('node:crypto'), run = (seed) => { const { save } = play(M, seed, 0.995, 3); return [JSON.stringify(save.career.ledger), createHash('sha1').update(save.media.map((m) => m.title).join('|')).digest('hex')]; };
    assert.deepEqual(run(3100), run(3100), 'the same seed and answers: the same ledger and stories');
    const kinds = new Set(); for (let i = 3101; i < 3111; i++) for (const e of play(M, i, [0.975, 0.995][i % 2], 3).save.career.ledger) kinds.add(e.kind);
    assert.ok(['bold_press', 'callout_won', 'callout_lost'].some((k) => kinds.has(k)), `choices reach the ledger: ${[...kinds]}`);
  }

  // ---- a Legend seat lost (6.7, 6.8): never a fall of two tiers, and a Legend driver rated near the tier keeps the seat through a bad year
  { const O = await server.ssrLoadModule('/src/game/career/offers.js'), s = signed(3200), lt = R.TEAM_IDS.find((t) => R.TIERS.teams[t].tier === 'legend'), car = R.seatCar(lt, 'A'), W = s.world;
    W.seats[s.contract.car] = W.seats[car]; W.seats[car] = 'YOU'; Object.assign(s.contract, { team: lt, seat: 'A', car, seasonsLeft: 1, trust: 10 }); s.season.tier = 'legend'; s.season.results.length = 0;
    const mate = W.seats[R.seatCar(lt, 'B')]; W.ratings[mate] = 92; assert.ok(O.holdsSeat(s), 'rated as the teammate: held');
    const held = O.seasonOffers(s, { cup: false, title: false, dropped: false }); assert.ok(held.some((o) => o.team === lt && o.id.endsWith('-renew') && o.salary === s.contract.salary), 'a renewal at the same pay, not the reserve seat'); assert.ok(!held.some((o) => o.reserve));
    W.ratings[mate] = 70; assert.equal(O.holdsSeat(s), false, 'rated far below the tier: not held');
    const lost = O.seasonOffers(s, { cup: false, title: false, dropped: true }), fb = lost.find((o) => o.id.endsWith('-fallback'));
    assert.ok(fb && fb.tier === 'maestro', 'dropped from a Legend seat: a Maestro seat is offered'); assert.ok(lost.some((o) => o.reserve), 'the reserve seat stays a choice');
    assert.equal(O.fallbackOffer(signed(3201)), null, 'from the Rookies there is no tier below'); }

  // ---- the transfer window (6.10, docs/10x/transfers-spec.md): days and deadlines, rivals for the seat, your own team's answer, the tactics per style, the hidden market, schema 11
  { const O = await server.ssrLoadModule('/src/game/career/offers.js'), TR = await server.ssrLoadModule('/src/game/career/transfers.js'), W = await server.ssrLoadModule('/src/game/career/world.js');
    const X = R.TUNING.window, MK = R.TUNING.market, keepMK = JSON.parse(JSON.stringify(MK)), style = (t) => R.TIERS.teams[t].style;
    assert.deepEqual(Object.fromEntries(['rookie', 'maestro', 'legend'].map((t) => [t, R.TEAM_IDS.filter((x) => R.TIERS.teams[x].tier === t).map(style).sort()])), { rookie: ['bidder', 'frugal', 'warm'], maestro: ['bidder', 'frugal', 'hardball', 'warm'], legend: ['bidder', 'hardball', 'warm'] }, 'no tier has two principals of a kind (the fourth Maestro, Steelhead, takes the style the Maestros lacked)');
    assert.deepEqual(['hardball', 'warm', 'bidder', 'frugal'].map((k) => X.styles[k].patience), [2, 4, 3, 3]);
    /** a season-end review without outside offers of its own: each test adds the ones it means */
    const review = (seed = 4001) => { const s = toReview(signed(seed), 4, 1); s.pending.offers = s.pending.offers.filter((o) => !TR.isOutside(s, o)); s.pending.window.news = []; return s; };
    const mk = (s, team, seat, x = {}) => { const o = O.offer(s, team, seat, { salary: 500, signing: 1000, seasons: 2, interest: 0.5, why: 'x', tag: '', ...x }); s.pending.offers.push(o); return o; };
    { const s = review(), w = C.windowInfo(s); assert.deepEqual([w.day, w.days, w.deadline, w.closed], [0, 3, false, false], 'the window opens on day 1 of 3');   // deadlines: hardball gives a day, a keen team the whole window
      const hb = O.talksFor(s, mk(s, 'toro', 'B', { tag: 'h' })), keen = O.talksFor(s, mk(s, 'sarab', 'B', { interest: 0.8, tag: 'k' })), other = O.talksFor(s, mk(s, 'corvid', 'B', { interest: 0.3, tag: 'c' }));
      assert.equal(hb.deadline, 0); assert.equal(keen.deadline, 2); assert.ok([1, 2].includes(other.deadline));
      C.negotiate(s, other.id, { salary: 0, signing: 0, seasons: 2, status: 'junior' }); assert.ok(other.agreed);
      for (const o of [hb, keen, other]) { delete o.rival; delete o.rivalDay; }
      const n = s.pending.offers.length; assert.ok(C.windowWarnings(s).some((x) => /Toro lapses/.test(x)), 'advancing says what lapses');
      C.windowDay(s); assert.ok(!s.pending.offers.includes(hb), 'past its deadline, the offer lapses'); assert.ok(s.inbox.some((m) => m.title === "Toro's offer lapsed")); assert.ok(C.windowInfo(s).news.some((x) => x.text === "Toro's offer lapsed."));
      assert.ok(s.pending.offers.includes(keen) && s.pending.offers.includes(other)); assert.equal(s.pending.offers.length, n - 1);
      C.windowDay(s); assert.ok(C.windowInfo(s).deadline, 'the last day is deadline day'); C.windowDay(s); assert.ok(C.windowInfo(s).closed);
      assert.ok(!s.pending.offers.includes(keen), 'closing the window lapses what was not agreed'); assert.ok(s.pending.offers.includes(other), 'an agreed offer stays');
      assert.ok(s.pending.offers.some((o) => o.team === s.contract.team), 'your own team never lapses'); assert.equal(C.windowDay(s).ok, false, 'a closed window does not advance');
      const only = review(4002); only.pending.offers = [mk(only, 'toro', 'B')]; for (let i = 0; i < 3; i++) C.windowDay(only);
      assert.equal(only.pending.offers.length, 1); assert.ok(only.pending.offers[0].reserve, 'never a dead end: with nothing left, a reserve seat'); C.acceptOffer(only, only.pending.offers[0].id, avail); assert.equal(only.clock.phase, 'paddock'); }
    { const s = review(4003), o = mk(s, 'sarab', 'A'), code = s.world.seats.supra === 'YOU' ? s.world.seats.jaguarxkjss : s.world.seats.supra;   // a rival signs on their day, and takes the seat next season
      Object.assign(o, { rival: code, rivalDay: 2, deadline: 2 }); s.contract.trust = 0;
      C.negotiate(s, o.id, { salary: 0.3, signing: 0.5, seasons: 1, status: 'lead' }); assert.equal(o.rivalDay, 1, 'a refusal brings the rival day closer'); C.negotiate(s, o.id, { salary: 0.3, signing: 0.5, seasons: 1, status: 'lead' }); assert.equal(o.rivalDay ?? 1, 1, 'never before tomorrow');
      assert.match(C.windowWarnings(s).join(), /Sarab will sign their rival/);
      C.windowDay(s); assert.ok(!s.pending.offers.includes(o)); assert.equal(s.pending.window.signed[o.car], code); assert.ok(s.inbox.some((m) => m.title === `${C.personOf(s, code).name} signs for Sarab`)); assert.ok(s.media.some((m) => m.title === `${C.personOf(s, code).name} signs for Sarab`));
      const stay = s.pending.offers.find((x) => x.team === s.contract.team); C.acceptOffer(s, stay.id, avail); assert.equal(s.world.seats[o.car], code, 'the rival is in that seat next season');
      const t = review(4004), p = mk(t, 'sarab', 'A', { rival: code, rivalDay: 2, deadline: 2 }); C.negotiate(t, p.id, { salary: 0, signing: 0, seasons: 2, status: 'lead' }); C.windowDay(t); C.windowDay(t); assert.ok(t.pending.offers.includes(p), 'agreed first: the rival does not get the seat'); }
    { const s = review(4005); mk(s, 'toro', 'B');                                      // your own team answers once, the first time you have talked to another team
      s.contract.trust = 80; s.season.talked = { toro: 1 }; const was = Object.fromEntries(s.pending.offers.filter((x) => x.team === s.contract.team).map((x) => [x.id, x.salary]));
      C.windowDay(s); const c = s.pending.offers.find((x) => x.team === s.contract.team && x.seat === 'A' && C.canNegotiate(x) && !x.id.endsWith('-renew'));
      assert.ok(c, 'a counter to stay'); if (was[c.id]) assert.equal(c.salary, Math.round(was[c.id] * (1 + X.counterStep) / 5) * 5, 'raised a step'); else assert.ok(c.id.endsWith('-counter'), 'or a new one');
      const said = C.windowInfo(s).news.filter((x) => x.text.startsWith(`${R.loreOf(s.contract.team).name} answer`)).length; assert.equal(said, 1); const sal = c.salary; C.windowDay(s); assert.equal(c.salary, sal, 'once only');
      const low = review(4006); mk(low, 'toro', 'B'); low.contract.trust = 20; low.season.talked = { toro: 1 }; const n0 = low.pending.offers.length; C.windowDay(low);
      assert.ok(C.windowInfo(low).news.some((x) => /Go, if they want you|can have you/.test(x.text)), 'with low trust the principal says so'); assert.ok(low.pending.offers.length <= n0, 'and offers nothing'); }
    { const tactic = (team, kind, setup = () => {}) => { const s = review(4010), o = mk(s, team, 'B'); setup(s, o); return { s, o, r: C.useTactic(s, o.id, kind) }; };   // the tactics, per style
      const other = (sal) => (s) => { mk(s, 'aurum', 'B', { salary: sal, tag: '-o' }); };
      const up = Object.fromEntries(['hayate', 'sarab', 'corvid', 'toro'].map((t) => [style(t), tactic(t, 'mention', other(700))]));
      assert.equal(up.bidder.o.salary, 600, 'a bidder matches, up to +20 %'); assert.equal(up.warm.o.salary, 600, 'warm: half the gap'); assert.equal(up.frugal.o.salary, 600, 'frugal: half the gap'); assert.equal(up.hardball.o.salary, 500, 'hardball: no raise');
      assert.equal(up.hardball.r.result, 'held'); assert.equal(up.hardball.o.refusals ?? 0, 0, 'and no penalty'); assert.equal(up.bidder.r.result, 'raised'); assert.ok(up.bidder.o.log.length >= 3, 'logged, with the principal quoted');
      assert.equal(tactic('hayate', 'mention', other(560)).o.salary, 560, 'a bidder matches a smaller gap in full');
      const bluff = tactic('sarab', 'mention', (s, o) => { other(400)(s); Object.assign(o, { rival: 'VAL', rivalDay: 2 }); }); assert.equal(bluff.r.result, 'seen'); assert.equal(bluff.o.refusals, 1, 'a bluff costs patience'); assert.equal(bluff.o.rivalDay, 1, 'and brings the rival day closer');
      { const s = review(4011), o = mk(s, 'toro', 'B'); assert.equal(C.tacticInfo(s, o, 'mention').why, 'No other offer in hand'); assert.equal(C.tacticInfo(s, o, 'want').why, 'Their patience is full'); }
      const meet = Object.fromEntries(['hayate', 'sarab', 'corvid', 'toro'].map((t) => [style(t), tactic(t, 'meet')]));
      assert.equal(meet.warm.o.lev, X.warmLeverage, 'warm: more leverage for this offer'); assert.equal(meet.hardball.o.refusals, 1, 'hardball: patience down'); assert.ok(meet.hardball.o.log.some((m) => /coffee/.test(m.text)));
      assert.ok(!meet.bidder.o.refusals && !meet.bidder.o.lev && !meet.frugal.o.refusals && !meet.frugal.o.lev, 'the others: nothing more'); assert.ok(meet.frugal.o.log.some((m) => /signing bonus and status/.test(m.text)) && meet.bidder.o.log.some((m) => /on salary/.test(m.text)), 'the lever they give most on, in the log');
      const dl = tactic('corvid', 'deadline'); assert.equal(dl.r.result, 'final'); assert.ok(dl.o.final && R.demandOf(dl.o, dl.o.counter) <= C.leverageOf(dl.s, dl.o), 'their best terms within leverage, final');
      assert.equal(C.negotiate(dl.s, dl.o.id, { salary: 0.3, signing: 0.5, seasons: 1, status: 'second' }).result, 'final', 'a final counter is not haggled over'); assert.equal(C.negotiate(dl.s, dl.o.id, dl.o.counter).result, 'accepted');
      const strong = (s, o) => { Object.assign(o, { rival: 'VAL', rivalDay: 2 }); s.world.ratings.VAL = 99; };
      assert.equal(tactic('hayate', 'deadline', strong).r.result, 'final', 'a bidder never calls the bluff');
      const called = tactic('toro', 'deadline', strong); assert.equal(called.r.result, 'rival', 'hardball signs a far better rival'); assert.equal(called.s.pending.window.signed[called.o.car], 'VAL'); assert.ok(!called.s.pending.offers.includes(called.o));
      const want = Object.fromEntries(['sarab', 'corvid'].map((t) => [style(t), tactic(t, 'want', (s, o) => { o.refusals = 2; })]));
      assert.equal(want.warm.o.refusals, 0, 'warm: two patience back'); assert.equal(want.frugal.o.refusals, 1, 'the others: one'); assert.equal(want.frugal.o.lev, -X.wantLeverage, 'and less leverage');
      const once = tactic('sarab', 'meet'); assert.equal(C.useTactic(once.s, once.o.id, 'meet').result, 'closed', 'once per offer'); assert.equal(C.tacticInfo(once.s, once.o, 'meet').why, 'Used');
      { const s = review(4013), mine = mk(s, s.contract.team, 'A', { tag: '-counter' }), tr = (s.contract.trust = 60); C.useTactic(s, mine.id, 'meet'); assert.equal(s.contract.trust, tr - R.TUNING.offers.ownTrust, 'a tactic on your own team costs trust'); }
      const out = tactic('toro', 'meet', (s, o) => { o.refusals = 1; }); assert.equal(out.r.result, 'withdrawn', 'out of patience, they walk'); assert.ok(!out.s.pending.offers.includes(out.o) && out.s.pending.offers.length >= 1); }
    { const run = (seed) => { const s = review(seed), a = mk(s, 'toro', 'B'), b = mk(s, 'sarab', 'A', { interest: 0.8 }); O.talksFor(s, a); O.talksFor(s, b); s.season.talked = { toro: 1 };   // the same save and choices: the same window
        C.useTactic(s, b.id, 'meet'); C.windowDay(s); C.negotiate(s, b.id, { salary: 0.1, signing: 0, seasons: 2, status: 'lead' }); C.windowDay(s); C.windowDay(s); return JSON.stringify([s.pending, s.inbox.map((m) => m.title), (s.media ?? []).map((m) => m.title)]); };
      assert.equal(run(4020), run(4020)); }
    // the hidden market (Part C): loyalty, sackings by the lower teams, poaching from slightly better teams, the caps
    { const n = C.newCareer({ seed: 5, now: 'x' }); assert.ok(Object.values(n.world.loyalty).every((v) => v >= 40 && v <= 80) && Object.keys(n.world.loyalty).length === R.FIELD); assert.notDeepEqual(n.world.loyalty, C.newCareer({ seed: 6, now: 'x' }).world.loyalty, 'loyalty is seeded'); }
    /** a world at the season end where nobody retires, runs out of contract or is dropped, and every team finished where it was expected */
    const still = (seed) => { const s = toReview(signed(seed), 4), Wd = s.world; for (const c of Object.keys(Wd.ages)) Wd.ages[c] = 25; Wd.free = []; for (const c of Object.values(Wd.seats)) if (c !== W.YOU) Wd.contracts[c] = 3;
      Object.assign(s.season, { results: [], rumours: [] }); s.pending.window.signed = {}; s.history.at(-1).teamOrder = [...R.TEAM_IDS].sort((a, b) => Wd.teams[a].expPos - Wd.teams[b].expPos); return s; };
    const carOf = (s, c) => Object.keys(s.world.seats).find((k) => s.world.seats[k] === c);
    const result = (s, pts) => { s.season.results = [{ entries: Object.entries(pts).map(([code, p]) => ({ code, key: carOf(s, code), team: R.CAR[carOf(s, code)].team, pts: p })) }]; };
    { Object.assign(MK, { maxSacks: 0, maxPoach: 0, dropGap: 99 }); const s = still(4030), Wd = s.world, me = R.CAR[carOf(s, W.YOU)].team, t = R.TEAM_IDS.find((x) => x !== me && R.TIERS.teams[x].tier === 'maestro' && R.divOf(s, x) === 'challenger'), calm = R.TEAM_IDS.find((x) => x !== me && x !== t);
      const [a, b] = ['A', 'B'].map((q) => Wd.seats[R.seatCar(t, q)]), c = Wd.seats[R.seatCar(calm, 'A')]; Wd.loyalty[a] = Wd.loyalty[b] = Wd.loyalty[c] = 50; result(s, { [a]: 20, [b]: 10, [c]: 5 });
      const order = s.history.at(-1).teamOrder; order.splice(order.indexOf(t), 1); order.push(t);   // finished last of its series, well under its expected place there
      W.marketMoves(s); assert.equal(Wd.loyalty[c], 50 + MK.loyaltyGrow, 'a season at the same team'); assert.equal(Wd.loyalty[a], 50 + MK.loyaltyGrow - MK.loyaltyUnder, 'the team finished 2+ places under its expected place');
      assert.equal(Wd.loyalty[b], 50 + MK.loyaltyGrow - MK.loyaltyUnder - MK.loyaltyBeaten, 'and outscored by the teammate'); assert.ok(Object.values(Wd.loyalty).every((v) => v >= 0 && v <= 100), 'clamped 0-100'); Object.assign(MK, keepMK); }
    { Object.assign(MK, { sackChance: [1, 1, 1], maxPoach: 0 }); const s = still(4032), Wd = s.world, me = R.CAR[carOf(s, W.YOU)].team, pts = {};   // sackings in a forced world, and the cap
      for (const t of R.TEAM_IDS) if (t !== me) { const [x, y] = ['A', 'B'].map((q) => Wd.seats[R.seatCar(t, q)]); pts[x] = 10; pts[y] = 1; }
      result(s, pts); s.history.at(-1).teamOrder.reverse();                                    // every team far from its expected place
      const ev = W.marketMoves(s); assert.equal(ev.sacked.length, MK.maxSacks, 'at most maxSacks a season'); assert.ok(ev.sacked.every((x) => pts[x.code] === 1), 'the lower scorer goes');
      Object.assign(MK, { sackChance: keepMK.sackChance }); const l = still(4033), lp = {}; for (const t of R.TEAM_IDS) { const [x, y] = ['A', 'B'].map((q) => l.world.seats[R.seatCar(t, q)]); lp[x] = 10; lp[y] = 1; } result(l, lp); l.history.at(-1).teamOrder.reverse();
      assert.ok(W.marketMoves(l).sacked.every((x) => R.TIERS.teams[x.team].tier !== 'legend'), 'the top tier does not sack'); Object.assign(MK, keepMK);
      const q = still(4034); C.acceptOffer(q, q.pending.offers.find((o) => o.team === q.contract.team).id, avail); const h = q.history.at(-1); assert.ok(Number.isFinite(h.market.sacked) && Number.isFinite(h.market.poached), 'the season keeps its market counts for the metrics'); }
    { Object.assign(MK, { maxSacks: 0, poachScale: [100, 100, 0] }); const s = still(4040), Wd = s.world, me = R.CAR[carOf(s, W.YOU)].team;   // poaching: the step up, the release fee story, the teammate kept, the cap
      for (const c of Object.keys(Wd.loyalty)) Wd.loyalty[c] = 99; s.contract.since = s.clock.season - 1;
      const maestros = R.TEAM_IDS.filter((t) => R.TIERS.teams[t].tier === 'maestro' && t !== me), gap = (a, b) => Wd.teams[b].expPos - Wd.teams[a].expPos;
      const [from, into] = maestros.flatMap((a) => maestros.map((b) => [a, b])).find(([a, b]) => gap(a, b) >= MK.poachGap[0] && gap(a, b) <= MK.poachGap[1] && R.upDiv(s, a, b));   // a Maestro team 1-3 places better, never out of the Elite into the Challenger
      const target = Wd.seats[R.seatCar(from, 'B')]; Wd.loyalty[target] = 0; Wd.seats[R.seatCar(into, 'A')] = null;
      assert.ok(W.poachable(s, R.seatCar(into, 'A')).includes(target), 'their B driver for this A seat'); assert.ok(!W.poachable(s, R.seatCar(into, 'A'), target).includes(target), 'never the one kept');
      const before = { ...Wd.seats }, ev = W.marketMoves(s); assert.deepEqual(ev.poached[0], { code: target, from, to: into }); assert.equal(Wd.seats[R.seatCar(into, 'A')], target); assert.equal(Wd.loyalty[target], MK.loyaltyMove, 'a move resets loyalty');
      const M2 = await server.ssrLoadModule('/src/game/career/media.js'); M2.coverMoves(s, before, [], ev); const st = s.media.find((m) => m.title.includes('walks out on'));
      assert.ok(st && /release fee/.test(st.body) && !/\d/.test(st.body.replace(/Season \d+/g, '')), 'the story says the fee was paid, and quotes no number'); assert.equal(st.title, `${C.personOf(s, target).name} walks out on ${R.loreOf(from).name} for ${R.loreOf(into).name}`);
      const z = still(4041); for (const c of Object.keys(z.world.loyalty)) z.world.loyalty[c] = 0; for (const t of R.TEAM_IDS) if (z.world.seats[R.seatCar(t, 'A')] !== W.YOU) z.world.seats[R.seatCar(t, 'A')] = null;
      assert.ok(W.marketMoves(z).poached.length <= MK.maxPoach, 'at most maxPoach a season');
      const d = still(4042); for (const c of Object.keys(d.world.loyalty)) d.world.loyalty[c] = 0; const rk = R.TEAM_IDS.find((t) => R.TIERS.teams[t].tier === 'rookie' && d.world.seats[R.seatCar(t, 'A')] !== W.YOU);
      assert.ok(W.poachable(d, R.seatCar(rk, 'A')).every((c) => R.TIERS.teams[R.CAR[carOf(d, c)].team].tier === 'rookie'), 'never down a tier');
      const m = still(4043), mc = carOf(m, W.YOU), mateCar = R.seatCar(R.CAR[mc].team, R.otherSeat(R.CAR[mc].seat)), mate = m.world.seats[mateCar]; for (const c of Object.keys(m.world.loyalty)) m.world.loyalty[c] = 0; m.contract.since = m.clock.season;
      for (const t of R.TEAM_IDS) if (t !== R.CAR[mc].team) for (const q of ['A', 'B']) m.world.seats[R.seatCar(t, q)] = null;
      W.marketMoves(m); assert.equal(m.world.seats[mateCar], mate, "the player's teammate stays for their first season together"); Object.assign(MK, keepMK); }
    { const s = review(4050); s.schema = 10; delete s.world.loyalty; delete s.pending.window; mk(s, 'toro', 'B');   // schema 10 -> 11: loyalty for everyone, and a window for a save at the review
      C.migrate(s); assert.equal(s.schema, C.SCHEMA); assert.deepEqual(Object.keys(s.world.loyalty).sort(), Object.keys(s.world.ratings).sort()); assert.equal(C.windowInfo(s).day, 0); assert.equal(s.pending.offers.find((o) => o.team === 'toro').deadline, 0, 'its outside offers get deadlines');
      const m = signed(4051); m.schema = 10; delete m.world.loyalty; C.migrate(m); assert.equal(m.schema, C.SCHEMA); assert.equal(m.pending, null, 'mid-season: no window'); assert.ok(Object.values(m.world.loyalty).every(Number.isFinite)); round(m, 4); assert.equal(m.season.results.length, 1, 'and it plays on'); }
    { const s = signed(4060); s.season.mid.push(O.talksFor(s, { ...O.offer(s, 'toro', 'B', { salary: 500, signing: 1000, seasons: 2, interest: 0.5, why: 'x', tag: '-w1' }), w1: true, expires: s.clock.week }));   // mid-season the market week is the window
      const o = s.season.mid[0]; o.rival ??= 'VAL'; assert.equal(o.rivalDay, undefined, 'no day steps'); C.advanceWeek(s); assert.equal(s.season.mid.length, 0); assert.equal(s.season.signed[o.car], o.rival, 'not signed by the week end: the team signs its rival'); assert.equal(O.seatFor(s, 'toro', 'B'), false, 'and that seat is gone at the season end'); }
    // the hidden loyalty never reaches the screens or the window's words
    const { readFileSync } = await import('node:fs'); for (const f of ['career-ui.js', 'career-deals.js', 'career-hub.js', 'career-shell.js']) assert.ok(!/loyal/i.test(readFileSync(new URL(`../src/game/${f}`, import.meta.url), 'utf8')), `${f} never shows loyalty`);
    assert.ok(!/loyal/i.test(JSON.stringify(R.TUNING.window)), 'nor the window tuning');
  }
  /** a save as it was before `team` joined the world: its seats, drivers, ranking entries, race entries and table places gone, the teams below it a place higher */
  const strip = (s, team) => { if (!s.world.teams[team]) return s; const Wd = s.world, p = Wd.teams[team].expPos, keys = [R.TIERS.teams[team].A, R.TIERS.teams[team].B], codes = keys.map((k) => R.CAR[k].driver.code), q = s.season?.current?.quali;
    for (const k of keys) delete Wd.seats[k];
    for (const c of codes) for (const m of [Wd.ratings, Wd.ages, Wd.contracts, Wd.loyalty, s.ranking.seed, s.career.heat, ...s.ranking.days]) delete m[c];
    delete Wd.teams[team]; for (const t of Object.values(Wd.teams)) if (t.expPos > p) t.expPos--;
    for (const r of s.season?.results ?? []) for (const l of [r, r.other].filter(Boolean)) l.entries = l.entries.filter((e) => !keys.includes(e.key));
    if (q) { for (const k of keys) delete q.laps[k]; for (const f of ['order', 'grid']) if (q[f]) q[f] = q[f].filter((k) => !keys.includes(k)); }
    for (const h of s.history) h.teamOrder = h.teamOrder.filter((t) => t !== team);
    if (s.season?.divs) delete s.season.divs[team];
    return s; };
  // ---- schema 12 -> 13 (16.21): the two series. A season under way finishes as one field; the next is split by the expected places at the migration
  { const twelve = (s) => { strip(s, 'steelhead'); for (const t of Object.values(s.world.teams)) delete t.div; delete s.stats.promotions; delete s.stats.relegations;   // as schema 12 wrote it: no Steelhead yet
      for (const r of s.season?.results ?? []) for (const e of r.entries) { delete e.div; delete e.exp; } for (const o of s.pending?.offers ?? []) delete o.div; s.schema = 12; return s; };
    { const s = twelve(signed(4201, 'mojave', 'legacy')); round(s, 4); twelve(s); const exp0 = s.season.current.expPos;
      C.migrate(s); assert.equal(s.schema, C.SCHEMA); assert.equal(s.season.divs, undefined, 'the season under way keeps one field'); assert.equal(s.season.current.expPos, exp0 + 2, 'Steelhead joins that field ahead of Mojave'); assert.equal(s.season.current.field, R.FIELD, 'of a field two cars larger');
      assert.equal(s.world.teams.steelhead.div, 'challenger', 'and starts next season in the Challenger'); assert.equal(s.world.teams.steelhead.joined, 1);
      assert.deepEqual(R.TEAM_IDS.filter((t) => s.world.teams[t].div === 'elite'), R.TEAM_IDS.filter((t) => s.world.teams[t].expPos <= 5), 'next season: the five best expected in the Elite');
      assert.equal(s.stats.promotions, 0); assert.equal(s.stats.relegations, 0); assert.ok(s.inbox.some((m) => m.title === 'Two series from next season' && /start in the Challenger Series/.test(m.body)));
      const r = round(s, 4); assert.equal(r.entries.length, R.FIELD, 'still one field: all twenty classified'); assert.equal(r.other, undefined); assert.equal(C.standings(s).cup.length, 3);
      let opened = false, mastered = false, cups0 = s.stats.cups; while (s.clock.phase !== 'review') { if (s.season.current.open?.kind === 'open' && !opened) { opened = true; assert.equal(s.season.current.open.seeds.length, 4, 'an Open of the old format: four seeds'); }
        if (s.season.current.open?.kind === 'masters' && !mastered) { mastered = true; assert.deepEqual(s.season.current.open.seeds, C.rankingOf(s, 'all').slice(0, R.TUNING.series.gridSize).map((x) => x.key), 'the Masters of the old format: the top 8 of everyone'); }
        round(s, 4); }
      assert.ok(mastered); const rv = s.pending.review; assert.equal(rv.swap, undefined);
      if (rv.cup === 1) { assert.equal(s.stats.cups, cups0 + 1, 'the tier Cup is still awarded'); assert.ok(rv.rep >= R.TUNING.rep.cup); } else assert.equal(s.stats.cups, cups0);
      const divs0 = JSON.stringify(R.TEAM_IDS.map((t) => s.world.teams[t].div)); assert.equal(s.history.at(-1).swap, undefined, 'no swap that year'); assert.equal(JSON.stringify(R.TEAM_IDS.map((t) => s.world.teams[t].div)), divs0);
      C.acceptOffer(s, s.pending.offers[0].id, avail); assert.equal(s.season.div, s.world.teams[s.contract.team].div, 'the next season races two series'); assert.equal(round(s, 4).entries.length, R.carsIn(s, s.season.div).length); }
    { const s = twelve(toReview(signed(4202, 'mojave', 'legacy'), 4)), ids = s.pending.offers.map((o) => o.id), day = C.windowInfo(s).day;
      C.migrate(s); assert.deepEqual(s.pending.offers.map((o) => o.id), ids, 'a save at the review keeps its offers'); assert.equal(C.windowInfo(s).day, day, 'and its window'); assert.ok(s.pending.offers.every((o) => o.div === s.world.teams[o.team].div), 'each offer carries its series');
      C.acceptOffer(s, s.pending.offers[0].id, avail); assert.ok(s.season.div); }
    { const s = signed(4203); round(s, 4); const before = JSON.stringify(s); C.migrate(s); assert.equal(JSON.stringify(s), before, 'a current save is unchanged by migrate'); } }
  /** a migrated world is whole: expected places 1-10, every seat filled once, every driver complete, the ranking of everyone */
  const sound = (s, why) => { const Wd = s.world, seats = Object.values(Wd.seats);
      assert.deepEqual(Object.values(Wd.teams).map((t) => t.expPos).sort((a, b) => a - b), [...Array(R.TEAM_IDS.length).keys()].map((i) => i + 1), why + ': the expected places are 1-10');
      assert.equal(seats.length, R.FIELD); assert.ok(seats.every(Boolean), why + ': no empty seat'); assert.equal(new Set(seats).size, R.FIELD, why + ': nobody in two cars');
      for (const c of seats.filter((x) => x !== 'YOU')) assert.ok(Number.isFinite(Wd.ratings[c]) && Number.isFinite(Wd.ages[c]) && Number.isFinite(Wd.loyalty[c]) && Wd.contracts[c] >= 0, `${why}: ${c} is a whole driver`);
      assert.equal(C.rankingOf(s, 'all').length, R.racing(s, 'steelhead') ? R.FIELD : R.FIELD - 2); };
  // ---- schema 11 -> 12: Norrsken joins a world of eight teams, mid-season and at the review (addTeams); Steelhead, missing too, joins with it
  { const NEW = ['jesko', 'cc850'], CODES = NEW.map((k) => R.CAR[k].driver.code);
    /** a save as schema 11 wrote it, season 1: no Norrsken or Steelhead anywhere, the eight teams at expected places 1-8 */
    const eight = (s) => { strip(s, 'steelhead'); strip(s, 'norrsken'); for (const t of Object.values(s.world.teams)) delete t.div; s.schema = 11; return s; };
    const W = await server.ssrLoadModule('/src/game/career/world.js');
    { const s = signed(4101, 'mojave', 'legacy'); round(s, 4); round(s, 4); const before = s.world.teams.mojave.expPos; eight(s); assert.equal(s.world.teams.mojave.expPos, before - 2);
      C.migrate(s); assert.equal(s.schema, C.SCHEMA); sound(s, 'mid-season');
      assert.deepEqual(NEW.map((k) => s.world.seats[k]), CODES); assert.equal(s.world.teams.norrsken.expPos, 3); assert.equal(s.world.teams.mojave.expPos, before, 'the teams below move down a place for each');
      assert.deepEqual(s.world.teams.norrsken.dev, s.world.teams.aurum.dev, 'its tier\'s development'); assert.equal(s.world.ratings.HAG, R.DRIVERS.ratings.HAG); assert.equal(s.world.contracts.KOS, W.contractFor(s.seed, 'KOS'), 'rolled as a new career would');
      assert.equal(s.ranking.seed.HAG, C.newCareer({ seed: 1, now: 'x' }).ranking.seed.HAG);
      const r = round(s, 4); assert.equal(r.entries.length, R.FIELD, 'the next round classifies all twenty'); assert.ok(r.entries.some((e) => e.key === 'jesko') && r.entries.some((e) => e.key === 'zr1'));
      toReview(s, 4); assert.equal(C.standings(s).teams.length, 10); assert.ok(s.history.at(-1).teamOrder.includes('norrsken'));
      C.acceptOffer(s, s.pending.offers[0].id, avail); assert.equal(s.clock.season, 2); sound(s, 'the next season'); round(s, 4); }
    { const s = eight(toReview(signed(4102, 'mojave', 'legacy'), 4)); assert.ok(!s.history.at(-1).teamOrder.includes('norrsken'));
      C.migrate(s); assert.equal(s.schema, C.SCHEMA); sound(s, 'at the review'); assert.equal(C.windowInfo(s).day, 0, 'the window is untouched');
      C.acceptOffer(s, s.pending.offers[0].id, avail); sound(s, 'after the market'); assert.ok(s.world.teams.norrsken.expPos <= 4, 'missing from last season\'s table, the team holds its place: ' + s.world.teams.norrsken.expPos);
      round(s, 4); assert.ok(s.season.div, 'the season after the migration races two series'); assert.equal(s.season.results[0].entries.length, R.carsIn(s, s.season.div).length); }
    { const s = signed(4104, 'mojave', 'legacy'); while (s.season.results.length < s.season.calendar.length - 1) round(s, 4);   // migrated before the last round: a part-season table neither sets the expectation nor sours loyalty
      eight(s); const me = s.contract, cur = s.season.current; cur.expPos = R.expOf(s.world.teams[me.team].expPos, me.seat); const stale = cur.expPos, ranked = C.rankingOf(s);
      const twin = (seat) => s.world.seats[ranked[R.expOf(3, seat) - 1].key], pts = (c) => s.ranking.days.reduce((a, d) => a + (d[c] ?? 0), 0), twins = ['A', 'B'].map(twin);
      C.migrate(s); sound(s, 'before the last round'); assert.equal(s.world.teams.norrsken.joined, 1);
      assert.equal(cur.expPos, R.expOf(s.world.teams[me.team].expPos, me.seat), 'the round in progress takes the new expected place'); assert.equal(cur.expPos, stale + 4, 'four cars more ahead of a Rookie');
      assert.deepEqual(CODES.map(pts), twins.map(pts), 'each takes the race-day points of the driver ranked where they are expected'); assert.ok(pts('HAG') > 0);
      const L0 = { ...s.world.loyalty }; toReview(s, 4); C.acceptOffer(s, s.pending.offers[0].id, avail); sound(s, 'the season after');
      assert.ok(s.world.teams.norrsken.expPos <= 3, 'a part season does not drop the team: ' + s.world.teams.norrsken.expPos); assert.ok(Object.values(s.world.teams).every((t) => !('joined' in t)), 'the mark goes after one season');
      for (const [k, c] of NEW.map((k, i) => [k, CODES[i]])) if (s.world.seats[k] === c) assert.ok(s.world.loyalty[c] >= Math.min(100, L0[c] + R.TUNING.market.loyaltyGrow) - R.TUNING.market.loyaltyBeaten, `${c} loses no loyalty for a part season`); }
    { const s = signed(4106, 'mojave', 'legacy'); while (C.currentWeek(s).kind !== 'race' || s.season.current?.open) { if (C.currentWeek(s).kind === 'race') round(s, 4); else C.advanceWeek(s); }
      C.finishQuali(s, 999); eight(s); const me = s.contract, cur = s.season.current, main = (p) => R.objectivesFor(() => 0.5, p, me.easier, !!cur.exempt)[0];
      cur.expPos = R.expOf(s.world.teams[me.team].expPos, me.seat); cur.objectives[0] = main(cur.expPos); const stale = cur.objectives[0], rest = JSON.stringify(cur.objectives.slice(1));   // as the old world rolled them
      C.migrate(s); assert.deepEqual(cur.objectives[0], main(cur.expPos), 'migrated after qualifying: the mandatory objective follows the new expected place'); assert.notDeepEqual(cur.objectives[0], stale);
      assert.equal(JSON.stringify(cur.objectives.slice(1)), rest, 'the others stay as shown'); }
    { const s = eight(signed(4105, 'mojave', 'legacy')); C.migrate(s); assert.ok(!('joined' in s.world.teams.norrsken), 'joined before a round is raced: a full season to judge'); }
    { const s = eight(signed(4107, 'mojave', 'legacy')), n = s.season.calendar.length; s.contract.team = 'toro'; s.contract.seat = 'A';   // a seat below Norrsken: its sponsor's place targets were set one team place too high
      const old = R.expOf(s.world.teams.toro.expPos, 'A'), deal = (kind, met = false) => ({ brand: kind, name: kind, retainer: 100, bonus: 1000, target: R.targetFor(kind, old, n), progress: 0, met, mood: 3 });
      s.sponsors.deals = [deal('top'), deal('quali', true), deal('win')]; s.sponsors.offers = [{ id: 'o', sponsor: true, target: R.targetFor('quali', old, n) }];
      C.migrate(s); const now = R.expOf(s.world.teams.toro.expPos, 'A'); assert.ok(now > old);
      assert.deepEqual(s.sponsors.deals.map((d) => d.target), [R.targetFor('top', now, n), R.targetFor('quali', old, n), R.targetFor('win', old, n)], 'an open place target follows the new place; a met one and a win target stay');
      assert.deepEqual(s.sponsors.offers[0].target, R.targetFor('quali', now, n)); assert.notDeepEqual(R.targetFor('top', now, n), R.targetFor('top', old, n)); }
    { const s = signed(4108, 'mojave', 'legacy'); toReview(s, 4); assert.equal(s.pending.review.rankOf, R.FIELD, 'the review records the field its ranking place is out of'); }
    { const s = eight(signed(4103, 'liberty', 'legacy')), Wd = s.world;   // an old save already used the codes: an academy driver HAG, the player KOS
      Wd.academy.HAG = { name: 'Greta Haddad', nation: 'SWE' }; Wd.ratings.HAG = 74; Wd.ages.HAG = 21; Wd.loyalty.HAG = 60; Wd.contracts.HAG = 2; Wd.free.push('HAG'); s.career.heat.HAG = 45; s.career.rivalry = { HAG: { cause: 'pass', since: [1, 1], w: 1, l: 0 } };
      s.player.code = 'KOS';
      C.migrate(s); sound(s, 'with taken codes'); const moved = Object.keys(Wd.academy).find((c) => Wd.academy[c].name === 'Greta Haddad');
      assert.ok(moved && moved !== 'HAG' && Wd.ratings[moved] === 74 && Wd.free.includes(moved) && s.career.heat[moved] === 45 && s.career.rivalry[moved].w === 1, 'the academy driver keeps everything under a new code');
      assert.equal(C.personOf(s, 'HAG').name, 'Elin Hagberg'); assert.ok(!Wd.free.includes('HAG')); assert.equal(Wd.academy.HAG, undefined); assert.equal(Wd.academy[moved].nation, 'SWE');
      assert.notEqual(s.player.code, 'KOS', 'the player gets a code of their own'); assert.ok(!CODES.includes(s.player.code)); }
  }

  // ---- schema 13 -> 14: Steelhead joins a divided world in the Challenger. The season under way races on without it (its series, grids, places, objectives and
  // sponsor targets stand); it joins the next season. Mid-season, after qualifying, in the market week and at the review
  { const NEW = ['zr1', 'stingray'], CODES = NEW.map((k) => R.CAR[k].driver.code), W = await server.ssrLoadModule('/src/game/career/world.js');
    const thirteen = (s) => { strip(s, 'steelhead'); s.schema = 13; return s; }, none = (keys) => keys.every((k) => !NEW.includes(k));
    /** the rest of a season under way after the migration: no Steelhead car on any grid, in any classification or at a cup; the next season has it in the Challenger */
    const playOn = (s, why) => { while (s.clock.phase !== 'review') { const o = s.season.current.open; if (o) assert.ok(none(o.seeds), why + ': no seed');
        const r = round(s, 4); assert.ok(none(r.entries.map((e) => e.key)) && none(r.other?.entries.map((e) => e.key) ?? []), why + ': no Steelhead car classified'); if (r.lcq) assert.ok(none(r.lcq.entries.map((e) => e.key)));
        if ((r.kind ?? 'tour') === 'tour') { assert.equal(r.entries.length, 8, why + ': the Challenger races as it was'); assert.equal(r.other.entries.length, 10); } }
      assert.equal(C.standings(s, 'challenger').teams.length, 4); assert.ok(!s.history.at(-1).teamOrder.includes('steelhead'));
      C.acceptOffer(s, s.pending.offers[0].id, avail); sound(s, why + ', next season'); assert.equal(s.season.divs.steelhead, 'challenger'); assert.equal(R.carsIn(s, 'challenger').length, 10);
      assert.equal(R.TEAM_IDS.filter((t) => s.season.divs[t] === 'elite').length, 5); assert.ok(!('joined' in s.world.teams.steelhead));
      if (s.season.div === 'challenger') assert.equal(round(s, 4).entries.length, 10); };
    { const s = signed(4120); round(s, 4); thirteen(s); s.player.code = 'TOL'; const cur = s.season.current, exp0 = cur.expPos, obj0 = JSON.stringify(cur.objectives), divs0 = { ...s.season.divs }, ranked = C.rankingOf(s, 'all');
      const twin = (seat) => s.world.seats[ranked[R.expOf(7, seat) - 1].key], pts = (c) => s.ranking.days.reduce((a, d) => a + (d[c] ?? 0), 0), twins = ['A', 'B'].map(twin);
      C.migrate(s); assert.equal(s.schema, C.SCHEMA); sound(s, 'mid-season'); const T = s.world.teams.steelhead;
      assert.deepEqual(NEW.map((k) => s.world.seats[k]), CODES); assert.equal(T.div, 'challenger'); assert.equal(T.expPos, 7); assert.equal(T.joined, 1); assert.deepEqual(T.dev, s.world.teams.corvid.dev.map((d, i) => Math.max(d, s.world.teams.toro.dev[i], s.world.teams.sarab.dev[i])), 'its tier\'s best development');
      assert.equal(s.world.ratings.TOL, 84); assert.equal(s.world.ratings.LAV, 82); assert.equal(s.world.ages.LAV, 25); assert.equal(s.world.contracts.TOL, W.contractFor(s.seed, 'TOL')); assert.equal(s.world.loyalty.LAV, W.loyaltyFor(s.seed, 'LAV')); assert.equal(s.ranking.seed.TOL, C.newCareer({ seed: 1, now: 'x' }).ranking.seed.TOL);
      assert.deepEqual(CODES.map(pts), twins.map(pts), 'each takes the race-day points of the driver ranked where they are expected in the whole field'); assert.ok(twins.every(Boolean));
      assert.notEqual(s.player.code, 'TOL', 'a player who had the code gets their own'); assert.ok(s.season.results.flatMap((r) => r.entries).filter((e) => e.you).every((e) => e.code === s.player.code));
      assert.deepEqual(s.season.divs, divs0, 'the season keeps its series'); assert.equal(R.divOf(s, 'steelhead'), 'all'); assert.equal(R.nextDivOf(s, 'steelhead'), 'challenger'); assert.equal(R.racing(s, 'steelhead'), false);
      assert.equal(cur.expPos, exp0, 'the round in progress keeps its place in its series'); assert.equal(JSON.stringify(cur.objectives), obj0); assert.equal(R.carsIn(s, 'challenger').length, 8); assert.equal(R.fieldSize(s), R.FIELD - 2);
      assert.equal(C.rankingOf(s, 'all').length, R.FIELD - 2, 'the ranking this season is of those who race it');
      playOn(s, 'mid-season'); }
    { const s = signed(4121); round(s, 4); C.advanceWeek(s); while (C.currentWeek(s).kind !== 'race') C.advanceWeek(s); C.finishQuali(s, 999); thirteen(s); const q0 = JSON.stringify(s.season.current.quali);
      C.migrate(s); sound(s, 'after qualifying'); assert.equal(JSON.stringify(s.season.current.quali), q0, 'the grid as qualified'); playOn(s, 'after qualifying'); }
    { const s = signed(4131); while (C.currentWeek(s).kind !== 'market') { if (C.currentWeek(s).kind === 'race') round(s, 4); else C.advanceWeek(s); } thirteen(s); const tg = JSON.stringify(s.sponsors.offers.map((o) => o.target));
      C.migrate(s); sound(s, 'in the market week'); assert.equal(JSON.stringify(s.sponsors.offers.map((o) => o.target)), tg, 'sponsor targets stand'); C.advanceWeek(s); playOn(s, 'in the market week'); }
    { const s = thirteen(toReview(signed(4123), 4)), ids = s.pending.offers.map((o) => o.id), day = C.windowInfo(s).day;
      C.migrate(s); sound(s, 'at the review'); assert.deepEqual(s.pending.offers.map((o) => o.id), ids, 'the offers stand'); assert.equal(C.windowInfo(s).day, day); assert.equal(s.world.teams.steelhead.div, 'challenger');
      C.acceptOffer(s, s.pending.offers[0].id, avail); sound(s, 'the season after'); assert.equal(s.season.divs.steelhead, 'challenger'); assert.equal(R.carsIn(s, 'challenger').length + R.carsIn(s, 'elite').length, R.FIELD); round(s, 4); }
    { const s = thirteen(signed(4125)); C.migrate(s); assert.equal(s.world.teams.steelhead.joined, 1, 'before the first round too: a season it does not race is not judged'); assert.equal(R.racing(s, 'steelhead'), false); playOn(s, 'before the first round'); }
    { const s = signed(4124); round(s, 4); const before = JSON.stringify(s); C.migrate(s); assert.equal(JSON.stringify(s), before, 'a schema-14 save is unchanged by migrate'); } }

  // ---- nine seasons, no dead end: every review has an offer, the wallet holds, every car has one driver, the save stays small, it replays
  assert.equal(JSON.stringify(play(M, 11, 1.0, 9).save), JSON.stringify(play(M, 11, 1.0, 9).save), 'nine seasons replay identically');
  let legends = 0;
  for (let i = 0; i < 45; i++) {
    const { save, log } = play(M, 900 + i, [0.975, 1.0, 1.02][i % 3], 9);
    assert.equal(log.offers.length, 9, 'nine reviews reached'); assert.ok(log.offers.every((n) => n >= 1), 'never a dead end'); assert.ok(log.minWallet >= 0);
    assert.ok(JSON.stringify(save).length < 100_000, 'the save stays small after nine seasons');
    const seats = Object.values(save.world.seats); assert.equal(seats.filter((c) => c === 'YOU').length, 1); assert.ok(seats.every(Boolean), 'no empty seat'); assert.equal(new Set(seats).size, R.FIELD, 'nobody drives two cars');
    assert.ok(seats.every((c) => c === 'YOU' || C.personOf(save, c)?.name), 'every driver has a name'); assert.ok(save.world.free.every((c) => !seats.includes(c)));
    if (log.tier.includes('legend')) legends++;
  }
  assert.ok(legends > 0, 'the top tier is reachable');
  console.log('career: all checks passed');
} finally { await server.close(); }
