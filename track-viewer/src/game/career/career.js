// The career facade the screens call (docs/career-mode.md 10.3): a save goes in, the same save comes out changed. Pure: no DOM and
// no storage (save.js stores it), so a whole career runs in node (scripts/test-career.mjs, scripts/career-sim.mjs).
//   newCareer -> finishShootout -> acceptOffer -> [ side event? -> finishQuali -> finishRace ] x rounds -> review (offers) -> acceptOffer -> ...
// Every roll happens once, when its moment comes, and its outcome is stored, so a reload never re-rolls (7.2).
import { rewardFor, costOf, CATS, MAX_LEVEL } from '../economy.js';
import { rng, gauss } from './rng.js';
import {
  TUNING as T, TIERS, CAL, TEAM_IDS, CAR, clamp, tierOf, seatCar, otherSeat, expOf, levelOf, formOf, paceOf, parLap,
  buildCalendar, lapsFor, aiLap, duelOf, roundRating, xpFor, repFor, trustFor, objectivesFor, objectiveMet, interestOf, offerRoll,
  STATUS, statusChoices, demandOf, nearestTerms, sideMedal,
} from './rules.js';
import { YOU, newWorld, personOf, driverAt, sessionDriver, takeSeat, marketMoves, heatAfter, rivalsOf } from './world.js';

export const SCHEMA = 3;
export { driverAt, personOf, rivalsOf };
const round50 = (v) => Math.round(v / 50) * 50, round5 = (v) => Math.round(v / 5) * 5;
const codeOf = (name) => (name.trim().split(/\s+/).pop() || 'YOU').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
const rankOf = (team) => tierOf(team).rank;
const mean = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0);

/** a new career: the driver, a seed, the world as data; the next step is the Open Shootout (3.1) */
export function newCareer({ name = 'A. Driver', nation = 'IND', number = 99, seed = (Math.random() * 2 ** 31) >>> 0, difficulty = 'normal', raceLength = 'sprint', now = new Date().toISOString() } = {}) {
  return {
    schema: SCHEMA, id: 'c_' + seed.toString(36), createdAt: now, seed, rules: { difficulty, raceLength },
    player: { name: name.trim() || 'A. Driver', code: codeOf(name), nation, number },
    clock: { season: 1, round: 0, phase: 'shootout' },
    career: { xp: 0, cl: 1, rep: 0, rr: [], heat: {} },
    contract: null, wallet: { coins: T.money.startWallet },
    garage: { upgrades: {}, paid: {}, package: 0 },
    world: newWorld(), season: null, pending: null, history: [],
    stats: { starts: 0, wins: 0, podiums: 0, poles: 0, fastest: 0, cups: 0, titles: 0 },
  };
}
/** an older save brought up to this schema (10.2); null for one this code cannot read */
export function migrate(save) {
  if (!save || !(save.schema <= SCHEMA)) return null;
  if (save.schema === 1) {                                    // P1 saves: no seat map, heat or team package yet
    const W = save.world, fresh = newWorld();
    Object.assign(W, { seats: fresh.seats, free: [], retired: [], academy: {} });
    for (const id of TEAM_IDS) W.teams[id].declined ??= 0;
    if (save.contract) { W.free.push(W.seats[save.contract.car]); W.seats[save.contract.car] = YOU; }
    save.career.heat ??= {}; save.garage.package ??= 0; save.schema = 2;
  }
  if (save.schema === 2) { setRaceLength(save, 'sprint'); save.schema = 3; }     // before race lengths every race was about 6 minutes
  return save;
}

// ---------------------------------------------------------------------------------------------- the first job
export const shootout = () => ({ ...CAL.shootout, laps: T.series.qualiValidLaps });
/** the Shootout grade from the best valid lap against par (3.1); null is no valid lap */
export function shootoutGrade(best) {
  const S = CAL.shootout, par = parLap(S.track, S.car, S.weather), d = Number.isFinite(best) ? best / par - 1 : Infinity;
  return { grade: d <= T.shootout.standout ? 'Standout' : d <= T.shootout.solid ? 'Solid' : 'Raw', par, delta: Number.isFinite(d) ? d : null };
}
/** the Shootout is done: XP, the grade, and the three Rookie B-seat offers (3.2); the player is never refused */
export function finishShootout(save, best) {
  const g = shootoutGrade(best), xp = g.grade === 'Standout' ? T.shootout.standoutXp : T.shootout.baseXp, raw = g.grade === 'Raw';
  gainXp(save, xp);
  save.pending = { shootout: { best: Number.isFinite(best) ? best : null, ...g }, offers: Object.entries(TIERS.firstJob).map(([team, j]) => offer(save, team, 'B', {
    salary: round5(j.salary * (raw ? 0.9 : 1)), signing: round50(j.signing * (g.grade === 'Standout' ? 1.5 : 1)), seasons: 2, pitch: j.pitch, difficulty: j.difficulty,
    underdog: !!j.underdog, easier: raw, interest: T.offers.firstJobInterest })) };
  save.clock.phase = 'offers';
  return save;
}
function offer(save, team, seat, terms) {
  return { id: `${team}-${seat}-${save.clock.season}${terms.tag ?? ''}`, team, seat, car: seatCar(team, seat), tier: TIERS.teams[team].tier, status: seat === 'A' ? 'lead' : 'junior', ...terms };
}
/** who would share the team with you on this offer: in your own team a promotion swaps you with the A driver */
export function mateOf(save, o) {
  const swap = save.contract && o.team === save.contract.team && o.car !== save.contract.car;
  return driverAt(save, swap ? o.car : seatCar(o.team, otherSeat(o.seat)));
}

/** sign an offer from save.pending.offers: the first job starts season 1, a season-end offer starts the next season */
export function acceptOffer(save, id, available) {
  const o = save.pending?.offers?.find((x) => x.id === id); if (!o) throw new Error('No such offer: ' + id);
  const old = save.contract, first = save.clock.phase === 'offers';
  save.buyback = 0; save.transfer = 0;
  if (old && old.car !== o.car) {                            // leaving a car (a new team, or the A seat): its parts are sold back at 60 % of what was paid (5.4)
    const back = Math.round((save.garage.paid[old.car] ?? 0) * T.money.buyback);
    save.wallet.coins += back; save.garage.upgrades[old.car] = { engine: 0, tyres: 0, brakes: 0 }; save.garage.paid[old.car] = 0;
    save.buyback = back;
  }
  if (old && o.team !== old.team && !o.w1 && !o.reserve && !old.dropped && old.seasonsLeft > 1) {   // bought out of a running contract: you get the cut (3.3)
    save.transfer = releaseCut(old); save.wallet.coins += save.transfer;
  }
  for (const x of save.pending.offers) if (x.team !== o.team && x.team !== old?.team) save.world.teams[x.team].declined++;   // declined three times, a team cools (6.5)
  const keep = old && old.team === o.team && !old.dropped;
  save.contract = { team: o.team, seat: o.seat, car: o.car, status: o.status, seasons: o.seasons, seasonsLeft: o.seasons, salary: o.salary, signing: o.signing ?? 0,
    underdog: !!o.underdog || !!(keep && old.underdog && old.car === o.car), easier: !!(o.easier || o.reserve), reserve: !!o.reserve,
    trust: keep ? old.trust : T.trust.startBy[o.status] ?? T.trust.start, duel: { won: 0, lost: 0, level: 0 }, since: keep ? old.since : save.clock.season };
  if (o.keep) Object.assign(save.contract, { seasons: old.seasons, seasonsLeft: old.seasonsLeft - 1, signing: 0 });
  save.wallet.coins += save.contract.signing;
  save.garage.upgrades[o.car] ??= { engine: 0, tyres: 0, brakes: 0 }; save.garage.paid[o.car] ??= 0;
  takeSeat(save, o.car, old?.car);
  if (!first) nextSeasonWorld(save);
  startSeason(save, available);
  return save;
}
const releaseCut = (c) => round50(T.offers.release * c.salary * (c.seasonsLeft - 1) * T.offers.releaseCut);

// ---------------------------------------------------------------------------------------------- negotiation (6.5)
/** how far the player can push this offer: 1 + 4 x interest + 1 per other team's offer in hand */
export function leverageOf(save, o) {
  const others = new Set((save.pending?.offers ?? []).filter((x) => x.team !== o.team).map((x) => x.team)).size;
  return 1 + 4 * (o.interest ?? T.offers.firstJobInterest) + others;
}
export const canNegotiate = (o) => !o.keep && !o.reserve && !o.w1 && !o.agreed;
/** the levers an offer allows, for the screen: salary steps, lengths, statuses */
export function leversOf(o) {
  const D = T.offers.demand, steps = Math.round(D.salaryMax / D.salaryStep);
  return { salary: Array.from({ length: steps + 1 }, (_, i) => Math.round(i * D.salaryStep * 10) / 10), seasons: [1, 2, 3], status: statusChoices(o) };
}
/**
 * Ask for better terms: { salary: 0..0.3 (a raise), seasons: 1-3, status }. Accepted when the demand fits the leverage; otherwise the
 * team names the nearest terms it would sign, and the second refusal withdraws the offer (REP -5). Returns { result, terms, demand, leverage }.
 */
export function negotiate(save, id, ask) {
  const list = save.pending?.offers ?? [], o = list.find((x) => x.id === id);
  if (!o || !canNegotiate(o)) return { result: 'fixed' };
  const L = leversOf(o), terms = { salary: L.salary.includes(ask.salary) ? ask.salary : 0, seasons: L.seasons.includes(ask.seasons) ? ask.seasons : o.seasons,
    status: L.status.includes(ask.status) ? ask.status : o.status };
  const demand = demandOf(o, terms), leverage = leverageOf(save, o);
  if (demand <= leverage) {
    Object.assign(o, { salary: round5(o.salary * (1 + terms.salary)), seasons: terms.seasons, status: terms.status, agreed: true, counter: null });
    return { result: 'accepted', terms, demand, leverage };
  }
  o.refusals = (o.refusals ?? 0) + 1;
  if (o.refusals >= T.offers.refusals) {
    save.pending.offers = list.filter((x) => x !== o); save.career.rep = clamp(save.career.rep + T.rep.withdrawn, 0, 1000);
    if (!save.pending.offers.length) save.pending.offers.push(reserveOffer(save));   // never a dead end (3.1, 6.7)
    return { result: 'withdrawn', terms, demand, leverage };
  }
  return { result: 'countered', terms: (o.counter = nearestTerms(o, terms, leverage)), demand, leverage };
}
/** a Rookie reserve seat for a driver nobody else will sign (6.7): 60 % salary, no points in rounds 1-2, targets one place easier */
function reserveOffer(save) {
  const rookies = TEAM_IDS.filter((t) => TIERS.teams[t].tier === 'rookie' && t !== save.contract?.team);
  const team = rookies[Math.floor(rng(save.seed, 'market', 'reserve', save.clock.season)() * rookies.length)];
  return offer(save, team, 'B', { salary: round5(TIERS.tiers.rookie.salary.B * T.offers.reserveSalary), signing: 0, seasons: 1, reserve: true, tag: '-reserve',
    why: 'A reserve seat at reduced pay keeps you racing: no points for the first two rounds, and targets one place easier.' });
}

// ---------------------------------------------------------------------------------------------- seasons and rounds
function startSeason(save, available) {
  const me = save.contract, tier = TIERS.teams[me.team].tier, world = TIERS.tiers[tier].world;
  save.season = { tier, world, calendar: buildCalendar(save.seed, save.clock.season, world, available, save.rules.raceLength), results: [], current: null, w1: null };
  save.pending = null; save.clock.round = 0;
  save.garage.package = me.trust >= T.trust.package ? (me.status === 'number1' ? 2 : 1) : 0;   // the team's free level at the season start (5.4)
  prepareRound(save);
}
/** the next round's entries (each AI team nominates one of its two drivers, 4.4), objectives and side event; the Paddock shows them */
function prepareRound(save) {
  const { season, round } = save.clock, R = save.season.calendar[round], me = save.contract;
  const entries = TEAM_IDS.filter((t) => t !== me.team).map((t) => {
    const r = rng(save.seed, 'ai', 'nominate', season, round, t);
    return seatCar(t, r() < T.entries.aSeat[TIERS.teams[t].tier] ? 'A' : 'B');
  });
  const expPos = expOf(save.world.teams[me.team].expPos, me.seat), theme = TIERS.teams[me.team].side ?? 'test';
  const side = round % 2 === 1 ? { kind: round % 4 === 1 ? theme : theme === 'test' ? 'sponsor' : 'test', result: null } : null;   // before rounds 2, 4, 6: the team's favourite first
  save.season.current = { round: R.round, entries, expPos, objectives: objectivesFor(rng(save.seed, 'obj', season, round), expPos, me.easier), quali: null, side };
  save.clock.phase = 'paddock';
}
/** the player's race length (tuning.json series.lengths): every round not yet raced takes it; points and XP do not depend on it */
export function setRaceLength(save, length) {
  if (!(length in T.series.lengths)) return save;
  save.rules.raceLength = length;
  save.season?.calendar.forEach((r, i) => { if (i >= save.clock.round) r.laps = lapsFor(r.track, length); });
  return save;
}
export const currentRound = (save) => save.season?.calendar[save.clock.round] ?? null;
const ratingOf = (save, key) => save.world.ratings[save.world.seats[key]];
const devOf = (save, key) => save.world.teams[CAR[key].team].dev;
const myLevels = (save) => ({ engine: 0, tyres: 0, brakes: 0, ...save.garage.upgrades[save.contract.car] });
export const teammateCar = (save) => seatCar(save.contract.team, otherSeat(save.contract.seat));

/** qualifying is done (the player's best valid lap, or null): the AI laps, the teammate's lap and duel, the grid (4.3). Another try before the race keeps the better lap; the AI's laps are seeded, so they do not move */
export function finishQuali(save, best) {
  const held = save.season.current.quali?.laps[save.contract.car]; if (Number.isFinite(held)) best = Number.isFinite(best) ? Math.min(best, held) : held;
  const R = currentRound(save), cur = save.season.current, base = { seed: save.seed, season: save.clock.season, round: save.clock.round, track: R.track, weather: R.weather, difficulty: save.rules.difficulty };
  const laps = { [save.contract.car]: Number.isFinite(best) ? best : null };
  for (const key of cur.entries) laps[key] = aiLap({ ...base, key, rating: ratingOf(save, key), dev: devOf(save, key) });
  const mate = teammateCar(save), mateLap = aiLap({ ...base, key: mate, rating: ratingOf(save, mate), dev: devOf(save, mate) });
  const grid = Object.keys(laps).sort((a, b) => (laps[a] ?? Infinity) - (laps[b] ?? Infinity));
  cur.quali = { laps, grid, mate: { car: mate, lap: mateLap, code: save.world.seats[mate] }, duel: duelOf(laps[save.contract.car], mateLap) };
  save.clock.phase = 'race';
  return save;
}

/** what game.startSession needs for the feature race: hero, racers in grid order, AI pace per car, upgrade levels and who drives each car */
export function raceSetup(save) {
  const R = currentRound(save), cur = save.season.current, hero = save.contract.car;
  const pace = Object.fromEntries(cur.entries.map((key) => {
    const r = rng(save.seed, 'pace', save.clock.season, save.clock.round, key);
    return [key, paceOf(ratingOf(save, key), save.rules.difficulty) * (1 + T.pace.jitter * gauss(r))];
  }));
  const lv = (dev) => ({ engine: dev[0], tyres: dev[1], brakes: dev[2] }), racers = cur.quali?.grid ?? [hero, ...cur.entries];
  return { hero, racers, gridOrder: cur.quali?.grid ?? null, pace, laps: R.laps, track: R.track, look: R.look, weather: R.weather,
    drivers: Object.fromEntries(racers.map((k) => [k, sessionDriver(save, k)])), levels: (key) => (key === hero ? myLevels(save) : lv(devOf(save, key))) };
}

// ---------------------------------------------------------------------------------------------- side events (4.2)
/** the side event before this round's qualifying, ready to drive: the round's circuit and look, dry, the player's car, the targets */
export function sideSpec(save) {
  const cur = save.season?.current, s = cur?.side; if (!s || s.result || cur.quali || save.clock.phase !== 'paddock') return null;
  const R = currentRound(save), car = save.contract.car, L = myLevels(save), par = parLap(R.track, car, 'dry', [L.engine, L.tyres, L.brakes]);
  return { kind: s.kind, track: R.track, look: R.look, weather: 'dry', car, par, targets: s.kind === 'test' ? T.side.test.map((x) => par * x) : [...T.side.sponsor] };
}
/** a side event is done: value is the best lap (test day) or the drift score (sponsor day). Medal, XP, pay or a free upgrade level */
export function finishSide(save, value) {
  const spec = sideSpec(save); if (!spec) return null;
  const medal = sideMedal(spec.kind, value, spec.par), tier = TIERS.tiers[save.season.tier];
  const xp = medal ? T.side.xp[medal - 1] : 0, coins = spec.kind === 'sponsor' && medal ? round5(T.side.pay[medal - 1] * tier.sponsor * (1 + T.side.formPay * formOf(save.career.rr))) : 0;
  const pkg = spec.kind === 'test' && medal === 3 ? 1 : 0;
  gainXp(save, xp); save.wallet.coins += coins; save.garage.package += pkg;
  return (save.season.current.side.result = { kind: spec.kind, value: Number.isFinite(value) ? value : null, medal, xp, coins, package: pkg });
}

// ---------------------------------------------------------------------------------------------- the race
/**
 * The feature race is done. result: { order: [car keys, finishing order], best: { key: seconds | null }, dnf, crashes, spins, pro }.
 * Scores the round (points, Round Rating, XP, REP, trust, objectives, money, rivals), stores it, runs the mid-season review after the
 * middle round, and moves on to the next round or the season review. Returns the round report the results screen shows.
 */
export function finishRace(save, result) {
  const R = currentRound(save), cur = save.season.current, me = save.contract, hero = me.car, tier = save.season.tier, seats = save.world.seats;
  if (!cur.quali) finishQuali(save, null);                  // never qualified (a reload mid-weekend): from the back
  const at = result.order.indexOf(hero), order = result.order.filter((k) => k !== hero); order.splice(result.dnf || at < 0 ? order.length : at, 0, hero);   // a retirement is classified last
  const finish = order.indexOf(hero) + 1, grid = cur.quali.grid.indexOf(hero) + 1, pole = grid === 1;
  const fastLap = Math.min(...Object.values(result.best).filter(Number.isFinite)), fastestKey = Object.keys(result.best).find((k) => result.best[k] === fastLap);
  const fastest = fastestKey === hero && !result.dnf, clean = (result.spins ?? 0) === 0 && (result.crashes ?? 0) <= 1, duel = cur.quali.duel, dnf = !!result.dnf;
  // points (4.4): per entry, the finale x1.5, pole +2, fastest lap +1; a retirement scores no place, a reserve driver nothing in rounds 1-2 (6.7)
  const P = T.series, mult = R.finale ? P.finaleMult : 1, bench = me.reserve && R.round <= 2;
  const entries = order.map((key, i) => ({ key, team: CAR[key].team, code: key === hero ? save.player.code : seats[key], you: key === hero,
    pts: key === hero && bench ? 0 : (key === hero && dnf ? 0 : (P.points[i] ?? 0) * mult) + (cur.quali.grid[0] === key ? P.pole : 0) + (fastestKey === key ? P.fastestLap : 0) }));
  const x = { expPos: cur.expPos, grid, finish, fastest, clean, duel, dnf };
  const objectives = cur.objectives.map((o) => ({ ...o, met: objectiveMet(o, x) }));
  const mandatory = objectives[0].met, optional = objectives.slice(1).filter((o) => o.met).length;
  const rating = roundRating({ ...x, underdog: me.underdog });
  const myExp = cur.expPos, myRank = TIERS.tiers[tier].rank;   // giant-killing: beating an entry from a higher tier that was expected ahead
  const giantKills = dnf ? 0 : order.slice(finish).filter((k) => tierOf(CAR[k].team).rank > myRank && expOf(save.world.teams[CAR[k].team].expPos, CAR[k].seat) < myExp).length;
  const rivals = heatAfter(save, order, hero, dnf);
  const xp = xpFor({ ...x, pole, mandatory, optional, tier, pro: result.pro, underdog: me.underdog });
  if (rivals.xp) { xp.lines.push(['Feud won', rivals.xp]); xp.xp += rivals.xp; }
  const rep = repFor({ rr: rating.rr, tier, finish, pole, fastest, giantKills, dnf });
  rep.lines.push(...rivals.lines); rep.rep += rivals.rep;
  const trust = trustFor({ rr: rating.rr, mandatory, optional, duel });
  // money (5.5): salary, the race prize x the tier's multiplier, objective and contract bonuses
  const Tr = TIERS.tiers[tier], coins = [['Salary', me.salary]];
  for (const [label, v] of rewardFor({ mode: 'race', pos: finish, cars: order.length, laps: R.laps, finished: !dnf, fastest }).lines) coins.push([label, round5(v * Tr.prize)]);
  if (mandatory) coins.push(['Round objective', Tr.objective[0]]);
  if (optional) coins.push(['Bonus objectives', optional * Tr.objective[1]]);
  if (!dnf && finish === 1) coins.push(['Win bonus', Tr.bonus.win]); else if (!dnf && finish <= 3) coins.push(['Podium bonus', Tr.bonus.podium]);
  const earned = coins.reduce((s, l) => s + l[1], 0);
  // apply
  const clBefore = save.career.cl;
  gainXp(save, xp.xp); save.career.rep = clamp(save.career.rep + rep.rep, 0, 1000);
  save.career.rr = [...save.career.rr, rating.rr].slice(-6); me.trust = clamp(me.trust + trust, 0, 100);
  me.duel[duel.result]++; save.wallet.coins += earned;
  if (me.warning) {                                          // the seat review's recovery objective: the round objective, twice running (6.7)
    me.warning.left--; if (mandatory) me.warning.met++;
    if (me.warning.met >= T.trust.recover) me.warning = null;
  }
  const S = save.stats; S.starts++; if (!dnf && finish === 1) S.wins++; if (!dnf && finish <= 3) S.podiums++; if (pole) S.poles++; if (fastest) S.fastest++;
  const report = { round: R.round, track: R.track, name: R.name, finale: R.finale, laps: R.laps, finish, grid, expPos: cur.expPos, dnf, pole, fastest, clean,
    rr: rating.rr, rrLines: rating.lines, xp: xp.xp, xpLines: xp.lines, rep: rep.rep, repLines: rep.lines, trust, coins: earned, coinLines: coins,
    objectives, duel: { ...duel, mine: cur.quali.laps[hero], mate: cur.quali.mate.lap, mateCar: cur.quali.mate.car, mateCode: cur.quali.mate.code },
    entries, best: result.best, levelUp: save.career.cl > clBefore ? save.career.cl : null, rivals: rivals.lines };
  save.season.results.push(report);
  save.clock.round++;
  const n = save.season.calendar.length;
  if (save.clock.round === Math.ceil(n / 2) && save.clock.round < n) report.midSeason = midSeason(save);
  if (save.clock.round < n) prepareRound(save); else endSeason(save);
  return report;
}

// ---------------------------------------------------------------------------------------------- the middle of the season
/** after the middle round (6.5, 6.7): the seat review (a warning under trust 35) and W1, a poaching offer from the tier above */
function midSeason(save) {
  const me = save.contract, season = save.clock.season, out = { warning: false, w1: null };
  if (!me.warning && me.trust < T.trust.warn) { me.warning = { left: T.trust.recover, met: 0 }; out.warning = true; }
  if (season === 1 || me.next) return out;                  // season 1 is probation: no W1
  const st = statsOf(save), cands = [];
  for (const team of TEAM_IDS.filter((t) => rankOf(t) === rankOf(me.team) + 1)) {
    const interest = interestOf(team, st, { extraRep: T.offers.w1Gate, declined: save.world.teams[team].declined });
    if (interest !== null && offerRoll(save.seed, season, 'W1', team, interest, T.offers.w1Roll)) cands.push([team, interest]);
  }
  const best = cands.sort((a, b) => b[1] - a[1])[0], o = best && outsideOffer(save, best[0], best[1], { w1: true, tag: '-w1' });
  if (o) { save.season.w1 = { offer: { ...o, why: `${o.why} They will pay your release clause, and you join them next season.` }, state: 'open' }; out.w1 = o.team; }
  return out;
}
/** W1: sign the mid-season offer (you join next season; your cut of the release clause now) or turn it down */
export function answerW1(save, sign) {
  const w = save.season?.w1; if (!w || w.state !== 'open') return null;
  w.state = sign ? 'signed' : 'declined';
  if (!sign) { save.world.teams[w.offer.team].declined++; return { cut: 0 }; }
  const cut = save.contract.seasonsLeft > 1 ? releaseCut(save.contract) : 0;
  save.contract.next = w.offer; save.wallet.coins += cut;
  return { cut };
}

// ---------------------------------------------------------------------------------------------- standings
/** the Drivers', Teams' and tier Cup tables from the rounds raced (4.4), sorted, with the player's rows flagged */
export function standings(save) {
  const D = {}, Tm = {};
  for (const r of save.season?.results ?? []) for (const e of r.entries) {
    const d = (D[e.you ? YOU : e.code] ??= { code: e.code, you: e.you, team: e.team, name: e.you ? save.player.name : personOf(save, e.code)?.name ?? e.code, pts: 0, wins: 0 });
    d.pts += e.pts; d.team = e.team; if (r.entries[0] === e) d.wins++;
    const t = (Tm[e.team] ??= { team: e.team, pts: 0, wins: 0, you: save.contract?.team === e.team }); t.pts += e.pts; if (r.entries[0] === e) t.wins++;
  }
  for (const id of TEAM_IDS) Tm[id] ??= { team: id, pts: 0, wins: 0, you: save.contract?.team === id };
  const sort = (l) => l.sort((a, b) => b.pts - a.pts || b.wins - a.wins || (save.world.teams[a.team].expPos - save.world.teams[b.team].expPos));
  const teams = sort(Object.values(Tm)), tier = save.season?.tier;
  return { drivers: sort(Object.values(D)), teams, cup: teams.filter((t) => TIERS.teams[t.team].tier === tier) };
}

// ---------------------------------------------------------------------------------------------- the season end
const statsOf = (save) => ({ rep: save.career.rep, rrs: save.career.rr, cl: save.career.cl, form: formOf(save.career.rr) });
function endSeason(save) {
  const st = standings(save), me = save.contract, rs = save.season.results;
  const teamPos = st.teams.findIndex((t) => t.team === me.team) + 1, cupPos = st.cup.findIndex((t) => t.team === me.team) + 1, drvPos = st.drivers.findIndex((d) => d.you) + 1;
  let rep = 0, coins = 0;
  if (cupPos === 1) { rep += T.rep.cup; coins += TIERS.tiers[save.season.tier].bonus.cup; save.stats.cups++; }
  if (teamPos === 1) rep += T.rep.teams;
  if (drvPos === 1) { rep += T.rep.drivers; save.stats.titles++; }
  // the seat review at the finale (6.7): under 15, or under 25 with a warning not recovered, the team lets you go
  const dropped = !me.next && (me.trust < T.trust.dropAny || (me.trust < T.trust.drop && !!me.warning));
  if (dropped) { rep += T.rep.dropped; me.dropped = true; }
  save.career.rep = clamp(save.career.rep + rep, 0, 1000); save.wallet.coins += coins;
  const avgRR = mean(rs.map((r) => r.rr));
  save.history.push({ season: save.clock.season, team: me.team, seat: me.seat, car: me.car, tier: save.season.tier, drivers: drvPos, teams: teamPos, cup: cupPos,
    points: st.drivers[drvPos - 1]?.pts ?? 0, avgRR: Math.round(avgRR * 10) / 10, duel: { ...me.duel }, teamOrder: st.teams.map((t) => t.team), dropped });
  save.pending = { review: { drivers: drvPos, teams: teamPos, cup: cupPos, rep, coins, avgRR, dropped, trust: me.trust }, offers: seasonOffers(save, { cup: cupPos === 1, title: drvPos === 1, dropped }) };
  save.clock.phase = 'review';
}

/** an offer from another team at this interest: the seat by interest, never a big step down in car (5.3); null when no seat fits */
function outsideOffer(save, team, interest, extra = {}) {
  const myZ = TIERS.carZ[save.contract.car] ?? 0, same = rankOf(team) === rankOf(save.contract.team);
  let seat = same || interest >= 0.6 ? 'A' : 'B';
  if ((TIERS.carZ[seatCar(team, seat)] ?? 0) < myZ - T.offers.maxCarDropZ) { if (seat === 'B') seat = 'A'; else return null; }
  if ((TIERS.carZ[seatCar(team, seat)] ?? 0) < myZ - T.offers.maxCarDropZ) return null;
  const tier = tierOf(team), salary = round50(tier.salary[seat] * (0.9 + 0.3 * interest));
  return offer(save, team, seat, { salary, signing: round50(salary * (2 + 2 * interest)), seasons: 1 + Math.round(2 * interest), interest: Math.round(interest * 100) / 100,
    why: `${tier.name} interest ${Math.round(interest * 100)} %: your reputation and form cleared their bar.`, ...extra });
}

/**
 * The end-of-season market (6.5): a deal signed in mid-season stands alone; otherwise promotion to the A seat for a won duel and trust,
 * Number One for a Legend lead with a title, up to four outside offers (the tier above, or an A seat in this tier for a strong year),
 * a counter-offer from your own team, and always a way to stay (the contract runs on, a renewal, or a reserve seat): never a dead end.
 */
function seasonOffers(save, { cup, title, dropped }) {
  const me = save.contract, tier = TIERS.tiers[save.season.tier], season = save.clock.season, list = [];
  if (me.next) return [{ ...me.next, w1: true, why: 'Signed in mid-season. Your new team is waiting.' }];
  const d = me.duel, raced = d.won + d.lost + d.level;
  if (!dropped && me.seat === 'B' && raced && d.won / raced >= T.offers.promoteDuelShare && me.trust >= T.trust.promote)
    list.push(offer(save, me.team, 'A', { salary: tier.salary.A, signing: 0, seasons: 2, interest: T.offers.promoteInterest, why: `You won the duel ${d.won}-${d.lost} and the team trusts you.` }));
  if (!dropped && save.season.tier === 'legend' && me.seat === 'A' && me.status !== 'number1' && me.trust >= T.trust.numberOne && (cup || title))
    list.push(offer(save, me.team, 'A', { status: 'number1', salary: tier.salary.N, signing: round50(tier.salary.N * 2), seasons: 3, interest: T.offers.promoteInterest, tag: '-n1',
      why: 'A title and the team behind you: the car is built around you now. Two free upgrade levels a season.' }));
  const st = statsOf(save), outside = [], strong = mean(st.rrs) >= T.offers.sameTierRR;
  for (const team of TEAM_IDS) {
    const rank = rankOf(team), same = rank === tier.rank;
    if (team === me.team || rank < tier.rank || rank > tier.rank + 1 || (same && (me.seat === 'A' || !strong))) continue;   // the tier above, or an A seat in this one
    const raw = interestOf(team, st, { declined: save.world.teams[team].declined }), interest = same && raw !== null ? Math.min(raw, T.offers.sameTierInterest) : raw;
    if (interest === null || !offerRoll(save.seed, season, 'W2', team, interest, same ? T.offers.w1Roll : 1)) continue;
    const o = outsideOffer(save, team, interest); if (o) outside.push(o);
  }
  list.push(...outside.sort((a, b) => rankOf(b.team) - rankOf(a.team) || b.interest - a.interest).slice(0, T.offers.maxOffers));
  if (!dropped && outside.length && me.trust >= T.trust.renew && !list.some((o) => o.team === me.team) && rng(save.seed, 'counter', season)() < T.offers.counter)
    list.push(offer(save, me.team, 'A', { status: me.status === 'number1' ? 'number1' : 'lead', salary: round5(Math.max(me.salary, tier.salary.A) * (1 + T.offers.counterRaise)), signing: 0, seasons: 2, interest: T.offers.promoteInterest, tag: '-counter',
      counter: true, why: `Your team has heard about the other offers: ${me.seat === 'B' ? 'the A seat' : 'a raise'} and ${Math.round(T.offers.counterRaise * 100)} % more to stay.` }));
  if (dropped || (me.seasonsLeft <= 1 && me.trust < T.trust.renew)) list.push(reserveOffer(save));
  else if (me.seasonsLeft > 1) list.push({ ...offer(save, me.team, me.seat, { status: me.status, salary: me.salary, signing: 0, seasons: me.seasons, tag: '-keep' }), keep: true, why: `Your contract runs ${me.seasonsLeft - 1} more ${me.seasonsLeft - 1 === 1 ? 'season' : 'seasons'}.` });
  else list.push(offer(save, me.team, me.seat, { status: me.status, salary: round5(Math.max(me.salary * 1.1, me.reserve ? tier.salary[me.seat] : 0)), signing: round50(me.salary * 2), seasons: 2, interest: T.offers.promoteInterest, tag: '-renew', why: 'The team wants to renew.' }));
  return list;
}

/** between seasons (6.8, 2.3): AI development, the driver market, expected finishes from the Teams' table */
function nextSeasonWorld(save) {
  const W = save.world, h = save.history.at(-1), cat = (save.clock.season - 1) % 3, order = [1, 0, 2][cat];   // tyres, engine, brakes in turn
  for (const id of TEAM_IDS) { const t = W.teams[id], cap = tierOf(id).cap; t.dev[order] = Math.min(cap, t.dev[order] + 1); }
  marketMoves(save);
  if (h?.teamOrder) {
    const v = Object.fromEntries(TEAM_IDS.map((id) => [id, 0.5 * W.teams[id].expPos + 0.5 * (h.teamOrder.indexOf(id) + 1)]));
    [...TEAM_IDS].sort((a, b) => v[a] - v[b] || W.teams[a].expPos - W.teams[b].expPos).forEach((id, i) => { W.teams[id].expPos = i + 1; });
  }
  save.clock.season++;
}

// ---------------------------------------------------------------------------------------------- XP, upgrades
function gainXp(save, n) { save.career.xp += n; save.career.cl = levelOf(save.career.xp); }
/** what the next level of `cat` costs on the career car, and why it cannot be bought (cap by tier, CL gate, coins); a team package level is free */
export function upgradeInfo(save, cat, hp) {
  const car = save.contract.car, cur = save.garage.upgrades[car]?.[cat] ?? 0, cap = TIERS.tiers[TIERS.teams[save.contract.team].tier].cap;
  const next = cur + 1, free = (save.garage.package ?? 0) > 0, cost = next <= MAX_LEVEL ? (free ? 0 : costOf(hp, next)) : null, gate = T.upgrades.clGate[next - 1];
  const reason = next > MAX_LEVEL ? 'maxed' : next > cap ? 'cap' : free ? null : save.career.cl < gate ? 'level' : save.wallet.coins < cost ? 'coins' : null;
  return { level: cur, next, cost, cap, gate, free, reason };
}
export function buyUpgrade(save, cat, hp) {
  if (!CATS.some(([c]) => c === cat)) return { ok: false, reason: 'unknown' };
  const u = upgradeInfo(save, cat, hp); if (u.reason) return { ok: false, ...u };
  const car = save.contract.car;
  save.wallet.coins -= u.cost; save.garage.upgrades[car] = { engine: 0, tyres: 0, brakes: 0, ...save.garage.upgrades[car], [cat]: u.next };
  save.garage.paid[car] = (save.garage.paid[car] ?? 0) + u.cost;
  if (u.free) save.garage.package--;
  return { ok: true, ...u, level: u.next };
}
