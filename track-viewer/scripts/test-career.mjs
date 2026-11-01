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
  // ---- P2 helpers: a career at a chosen moment
  const signed = (seed, team = 'mojave') => { const s = C.newCareer({ seed, now: 'x' }); C.finishShootout(s, R.parLap(sh.track, sh.car) * 1.04); C.acceptOffer(s, s.pending.offers.find((o) => o.team === team).id, avail); return s; };
  /** one round: `place` is where the player finishes (1-8); `mate` makes the duel lap fast or slow */
  const round = (s, place = 8, lap = 999) => {
    if (s.clock.phase === 'paddock') C.finishQuali(s, lap);
    const hero = s.contract.car, others = s.season.current.quali.grid.filter((k) => k !== hero); others.splice(place - 1, 0, hero);
    return C.finishRace(s, { order: others, best: Object.fromEntries(others.map((k, i) => [k, 70 + i])), crashes: 0, spins: 0 });
  };
  const toReview = (s, place, lap) => { while (s.clock.phase !== 'review') round(s, place, lap); return s; };

  // ---- the seat map: the player's seat holds YOU, the driver he displaced is a free agent with a grudge
  const m = signed(101);
  assert.equal(m.world.seats.bmw1, 'YOU'); assert.deepEqual(m.world.free, ['QUI']); assert.equal(m.career.heat.QUI, 40);
  assert.equal(C.driverAt(m, 'bmw1').you, true); assert.equal(C.driverAt(m, 'jaguarxkjss').code, 'LIN');
  assert.equal(C.raceSetup((C.finishQuali(m, 80), m)).drivers.bmw1.name, m.player.name, 'the race shows the player in his car');
  // ---- rivals: finishing near a driver heats it, 40 is a rival, beating him pays; everyone else cools
  const h0 = signed(102); h0.career.heat = { MAD: 85 }; C.finishQuali(h0, 999);
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
  const d0 = signed(105); d0.contract.trust = 30; let dr; for (let i = 0; i < 3; i++) { d0.contract.trust = 30; dr = round(d0, 8); }
  assert.ok(dr.midSeason.warning); assert.ok(d0.contract.warning, 'warned at the middle round'); assert.equal(d0.contract.warning.left, 2);
  toReview(d0, 8);
  assert.ok(d0.pending.review.dropped, 'trust gone at the finale: dropped'); assert.ok(d0.history.at(-1).dropped);
  assert.ok(d0.pending.offers.every((o) => o.team !== 'mojave'), 'the seat is gone'); const res = d0.pending.offers.find((o) => o.reserve); assert.ok(res, 'the reserve seat is the way back');
  const cash = d0.wallet.coins; C.acceptOffer(d0, res.id, avail);
  assert.ok(d0.contract.reserve && d0.contract.easier); assert.equal(d0.contract.salary, Math.round(R.TIERS.tiers.rookie.salary.B * 0.6 / 5) * 5); assert.equal(d0.wallet.coins, cash, 'a reserve seat has no signing bonus');
  assert.equal(d0.world.seats.bmw1 === 'YOU', false, 'the old seat went back to the market'); assert.ok(d0.world.seats.bmw1, 'and it was filled');
  const res1 = round(d0, 1, 1); assert.equal(res1.entries[0].pts, 0, 'a reserve driver scores no points in rounds 1-2'); round(d0, 1, 1); assert.ok(round(d0, 1, 1).entries[0].pts > 0, 'from round 3 he does');
  assert.ok(R.objectivesFor(G.rng(1, 'x'), 8, true)[0].n === 8 && R.objectivesFor(G.rng(1, 'x'), 8)[0].n === 7, 'a reserve driver only has to finish');
  const rec = signed(107); rec.contract.warning = { left: 2, met: 0 }; round(rec, 1); assert.equal(rec.contract.warning.met, 1); round(rec, 1); assert.equal(rec.contract.warning, null, 'two objectives met: the warning is gone');

  // ---- promotion swaps the two drivers; the market fills every seat
  const pr = signed(108); toReview(pr, 2, 1); pr.contract.trust = 90;
  const before = pr.world.seats.jaguarxkjss; pr.pending.offers.unshift({ id: 'x-A', team: 'mojave', seat: 'A', car: 'jaguarxkjss', tier: 'rookie', status: 'lead', salary: 400, seasons: 2 });
  assert.equal(C.mateOf(pr, pr.pending.offers[0]).code, before, 'the A driver becomes your teammate'); C.acceptOffer(pr, 'x-A', avail);
  assert.equal(pr.world.seats.jaguarxkjss, 'YOU'); assert.equal(pr.world.seats.bmw1, before, 'the old A driver swaps down'); assert.equal(C.driverAt(pr, C.teammateCar(pr)).code, before);

  // ---- W1: from season 2, one offer from the tier above; signing pays the release cut now and joins next season
  let w = null, seed = 200;
  for (; seed < 400 && !w; seed++) { const s = signed(seed); toReview(s, 3, 1); s.career.rep = 400; s.career.rr = [8, 8, 8, 8, 8, 8]; s.career.cl = 10; const k = s.pending.offers.find((o) => o.keep); C.acceptOffer(s, k.id, avail); s.career.rep = 400; s.career.rr = [8, 8, 8, 8, 8, 8]; s.career.cl = 10; for (let i = 0; i < 3; i++) { s.career.rr = [8, 8, 8, 8, 8, 8]; round(s, 2, 1); } if (s.season.w1) w = s; }
  assert.ok(w, 'a good driver gets a mid-season offer on some seeds'); assert.equal(R.TIERS.teams[w.season.w1.offer.team].tier, 'maestro');
  const coinsW = w.wallet.coins, a1 = C.answerW1(w, true); assert.equal(w.wallet.coins, coinsW + a1.cut); assert.equal(C.answerW1(w, true), null, 'answered once'); assert.equal(w.contract.next.team, w.season.w1.offer.team);
  toReview(w, 2, 1); assert.equal(w.pending.offers.length, 1, 'the signed deal stands alone'); assert.ok(!C.canNegotiate(w.pending.offers[0]));
  const nextTeam = w.contract.next.team; C.acceptOffer(w, w.pending.offers[0].id, avail); assert.equal(w.contract.team, nextTeam); assert.equal(w.season.tier, 'maestro'); assert.ok(w.season.calendar.length >= 6, 'the World 2 calendar');
  const s1 = signed(109); for (let i = 0; i < 3; i++) round(s1, 1, 1); assert.equal(s1.season.w1, null, 'season 1 is probation: no W1');

  // ---- release: signing elsewhere with seasons left pays the player his cut; counter-offers carry the A seat
  let rel = null; for (let i = 400; i < 500 && !rel; i++) { const s = signed(i); s.career.rep = 400; s.career.cl = 10; toReview(s, 1, 1); if (s.contract.seasonsLeft > 1 && s.pending.offers.some((o) => o.tier === 'maestro')) rel = s; }
  assert.ok(rel, 'a strong year brings a Maestro offer'); const up = rel.pending.offers.find((o) => o.tier === 'maestro'), cashR = rel.wallet.coins, sal = rel.contract.salary, sign0 = up.signing;
  C.acceptOffer(rel, up.id, avail); assert.equal(rel.transfer, Math.round(8 * sal * 1 * 0.2 / 50) * 50); assert.equal(rel.wallet.coins, cashR + rel.transfer + sign0 + rel.buyback); assert.equal(rel.season.tier, 'maestro');
  let ctr = null; for (let i = 500; i < 700 && !ctr; i++) { const s = signed(i); s.career.rep = 400; s.career.cl = 10; toReview(s, 1, 999); ctr = s.pending.offers.find((o) => o.counter) ?? null; }   // the duel lost: no promotion to compete with it
  assert.ok(ctr, 'a counter-offer appears on some seeds'); assert.equal(ctr.seat, 'A');

  // ---- side events: rounds 2, 4, 6 have one; gold on a test day is a free upgrade level; a sponsor pays by tier and form
  const si = signed(110); assert.equal(C.sideSpec(si), null, 'round 1 has none'); round(si, 4);
  const spec = C.sideSpec(si); assert.equal(spec.kind, 'test', "Mojave's favourite is the test day"); assert.equal(spec.weather, 'dry');
  const gold = C.finishSide(si, spec.par * 1.001); assert.equal(gold.medal, 3); assert.equal(gold.package, 1); assert.equal(C.sideSpec(si), null, 'one try'); assert.equal(C.finishSide(si, 1), null);
  round(si, 4); round(si, 4); const sp2 = C.sideSpec(si); assert.equal(sp2.kind, 'sponsor', 'then the other kind');
  const before2 = si.wallet.coins, medal = C.finishSide(si, 26000); assert.equal(medal.medal, 2); assert.ok(medal.coins > 0); assert.equal(si.wallet.coins, before2 + medal.coins); assert.equal(medal.xp, R.TUNING.side.xp[1]);
  const nope = signed(111); round(nope, 4); assert.equal(C.finishSide(nope, null).medal, 0, 'no valid lap, no medal'); round(nope, 4); assert.equal(C.sideSpec(nope), null);
  const qd = signed(112); round(qd, 4); C.finishQuali(qd, 90); assert.equal(C.sideSpec(qd), null, 'gone once qualifying has run');

  // ---- migration: a P1 save gets the seat map, and an unknown schema is not guessed at
  const old = signed(113); delete old.world.seats; delete old.world.free; delete old.world.retired; delete old.world.academy; delete old.career.heat; delete old.garage.package; old.schema = 1;
  const mig = C.migrate(old); assert.equal(mig.schema, C.SCHEMA); assert.equal(mig.world.seats.bmw1, 'YOU'); assert.deepEqual(mig.world.free, ['QUI']); assert.deepEqual(mig.career.heat, {});
  assert.equal(C.migrate({ schema: 99 }), null); assert.equal(C.migrate(null), null);

  // ---- three save slots, each its own career, guarded when storage is missing
  const S = await server.ssrLoadModule('/src/game/career/save.js'), mem = {};
  assert.deepEqual(S.listCareers(), [null, null, null], 'no localStorage: empty slots, no throw'); assert.equal(S.saveCareer(signed(114)), false, 'and a failed write says so');
  globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const a0 = signed(115), a2 = signed(116); assert.ok(S.saveCareer(a0, 0)); assert.ok(S.saveCareer(a2, 2));
  assert.equal(S.activeSlot(), 2); assert.equal(S.loadCareer().seed, 116); assert.equal(S.loadCareer(0).seed, 115); assert.equal(S.activeSlot(), 0, 'loading a slot makes it active');
  assert.deepEqual(S.listCareers().map((x) => x?.seed ?? null), [115, null, 116]);
  S.saveCareer(null); assert.deepEqual(S.listCareers().map((x) => x?.seed ?? null), [null, null, 116], 'only the active slot is erased');
  mem['ultrack.career.v1'] = '{broken'; assert.equal(S.loadCareer(), null, 'a broken save reads as none'); delete globalThis.localStorage;

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
