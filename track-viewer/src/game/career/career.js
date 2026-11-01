// The career facade the screens call (docs/career-mode.md 10.3): a save goes in, the same save comes out changed. Pure: no DOM and
// no storage (save.js stores it), so a whole career runs in node (scripts/test-career.mjs, scripts/career-sim.mjs).
//   newCareer -> finishShootout -> acceptOffer -> [ finishQuali -> finishRace ] x rounds -> review (offers) -> acceptOffer -> ...
// Every roll happens once, when its moment comes, and its outcome is stored, so a reload never re-rolls (7.2).
import { rewardFor, costOf, CATS, MAX_LEVEL } from '../economy.js';
import { rng, gauss } from './rng.js';
import {
  TUNING as T, TIERS, CAL, DRIVERS, TEAM_IDS, CAR, clamp, tierOf, seatCar, otherSeat, expOf, levelOf, formOf, paceOf, parLap,
  buildCalendar, aiLap, duelOf, roundRating, xpFor, repFor, trustFor, objectivesFor, objectiveMet, interestOf, offerRoll,
} from './rules.js';

export const SCHEMA = 1;
const round50 = (v) => Math.round(v / 50) * 50, round5 = (v) => Math.round(v / 5) * 5;
const codeOf = (name) => (name.trim().split(/\s+/).pop() || 'YOU').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');

/** a new career: the driver, a seed, the world as data; the next step is the Open Shootout (3.1) */
export function newCareer({ name = 'A. Driver', nation = 'IND', number = 99, seed = (Math.random() * 2 ** 31) >>> 0, difficulty = 'normal', now = new Date().toISOString() } = {}) {
  const ages = Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, c.driver.age]));
  return {
    schema: SCHEMA, id: 'c_' + seed.toString(36), createdAt: now, seed, rules: { difficulty },
    player: { name: name.trim() || 'A. Driver', code: codeOf(name), nation, number },
    clock: { season: 1, round: 0, phase: 'shootout' },
    career: { xp: 0, cl: 1, rep: 0, rr: [] },
    contract: null, wallet: { coins: T.money.startWallet },
    garage: { upgrades: {}, paid: {} },
    world: { teams: Object.fromEntries(TEAM_IDS.map((id) => [id, { expPos: TIERS.teams[id].expPos, dev: [...tierOf(id).dev] }])), ratings: { ...DRIVERS.ratings }, ages },
    season: null, pending: null, history: [],
    stats: { starts: 0, wins: 0, podiums: 0, poles: 0, fastest: 0, cups: 0, titles: 0 },
  };
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
  const g = shootoutGrade(best), xp = g.grade === 'Standout' ? T.shootout.standoutXp : T.shootout.baseXp;
  gainXp(save, xp);
  save.pending = { shootout: { best: Number.isFinite(best) ? best : null, ...g }, offers: Object.entries(TIERS.firstJob).map(([team, j]) => offer(save, team, 'B', {
    salary: round5(j.salary * (g.grade === 'Raw' ? 0.9 : 1)), signing: round50(j.signing * (g.grade === 'Standout' ? 1.5 : 1)), seasons: 2, pitch: j.pitch, difficulty: j.difficulty, underdog: !!j.underdog })) };
  save.clock.phase = 'offers';
  return save;
}
function offer(save, team, seat, terms) {
  return { id: `${team}-${seat}-${save.clock.season}`, team, seat, car: seatCar(team, seat), tier: TIERS.teams[team].tier, status: seat === 'A' ? 'lead' : 'junior', ...terms };
}

/** sign an offer from save.pending.offers: the first job starts season 1, a season-end offer starts the next season */
export function acceptOffer(save, id, available) {
  const o = save.pending?.offers?.find((x) => x.id === id); if (!o) throw new Error('No such offer: ' + id);
  const old = save.contract, first = save.clock.phase === 'offers';
  if (old && old.car !== o.car) {                            // leaving a car (a new team, or the A seat): its parts are sold back at 60 % of what was paid (5.4)
    const back = Math.round((save.garage.paid[old.car] ?? 0) * T.money.buyback);
    save.wallet.coins += back; save.garage.upgrades[old.car] = { engine: 0, tyres: 0, brakes: 0 }; save.garage.paid[old.car] = 0;
    save.buyback = back;
  }
  const keep = old && old.team === o.team;
  save.contract = { team: o.team, seat: o.seat, car: o.car, status: o.status, seasons: o.seasons, seasonsLeft: o.seasons, salary: o.salary, signing: o.signing ?? 0,
    underdog: !!o.underdog, trust: keep ? old.trust : T.trust.start, duel: { won: 0, lost: 0, level: 0 }, since: keep ? old.since : save.clock.season };
  if (o.keep) Object.assign(save.contract, { seasons: old.seasons, seasonsLeft: old.seasonsLeft - 1, signing: 0 });
  save.wallet.coins += save.contract.signing;
  save.garage.upgrades[o.car] ??= { engine: 0, tyres: 0, brakes: 0 }; save.garage.paid[o.car] ??= 0;
  if (!first) nextSeasonWorld(save);
  startSeason(save, available);
  return save;
}

// ---------------------------------------------------------------------------------------------- seasons and rounds
function startSeason(save, available) {
  const tier = TIERS.teams[save.contract.team].tier, world = TIERS.tiers[tier].world;
  save.season = { tier, world, calendar: buildCalendar(save.seed, save.clock.season, world, available), results: [], current: null };
  save.pending = null; save.clock.round = 0;
  prepareRound(save);
}
/** the next round's entries (each AI team nominates one of its two drivers, 4.4) and objectives; the Paddock shows them */
function prepareRound(save) {
  const { season, round } = save.clock, R = save.season.calendar[round], me = save.contract;
  const entries = TEAM_IDS.filter((t) => t !== me.team).map((t) => {
    const r = rng(save.seed, 'ai', 'nominate', season, round, t);
    return seatCar(t, r() < T.entries.aSeat[TIERS.teams[t].tier] ? 'A' : 'B');
  });
  const expPos = expOf(save.world.teams[me.team].expPos, me.seat);
  save.season.current = { round: R.round, entries, expPos, objectives: objectivesFor(rng(save.seed, 'obj', season, round), expPos), quali: null };
  save.clock.phase = 'paddock';
}
export const currentRound = (save) => save.season?.calendar[save.clock.round] ?? null;
const ratingOf = (save, key) => save.world.ratings[CAR[key].driver.code];
const devOf = (save, key) => save.world.teams[CAR[key].team].dev;
export const teammateCar = (save) => seatCar(save.contract.team, otherSeat(save.contract.seat));

/** qualifying is done (the player's best valid lap, or null): the AI laps, the teammate's lap and duel, the grid (4.3) */
export function finishQuali(save, best) {
  const R = currentRound(save), cur = save.season.current, base = { seed: save.seed, season: save.clock.season, round: save.clock.round, track: R.track, weather: R.weather, difficulty: save.rules.difficulty };
  const laps = { [save.contract.car]: Number.isFinite(best) ? best : null };
  for (const key of cur.entries) laps[key] = aiLap({ ...base, key, rating: ratingOf(save, key), dev: devOf(save, key) });
  const mate = teammateCar(save), mateLap = aiLap({ ...base, key: mate, rating: ratingOf(save, mate), dev: devOf(save, mate) });
  const grid = Object.keys(laps).sort((a, b) => (laps[a] ?? Infinity) - (laps[b] ?? Infinity));
  cur.quali = { laps, grid, mate: { car: mate, lap: mateLap }, duel: duelOf(laps[save.contract.car], mateLap) };
  save.clock.phase = 'race';
  return save;
}

/** what game.startSession needs for the feature race: hero, racers in grid order, AI pace per car and every car's upgrade levels */
export function raceSetup(save) {
  const R = currentRound(save), cur = save.season.current, hero = save.contract.car;
  const pace = Object.fromEntries(cur.entries.map((key) => {
    const r = rng(save.seed, 'pace', save.clock.season, save.clock.round, key);
    return [key, paceOf(ratingOf(save, key), save.rules.difficulty) * (1 + T.pace.jitter * gauss(r))];
  }));
  const lv = (dev) => ({ engine: dev[0], tyres: dev[1], brakes: dev[2] });
  return { hero, racers: cur.quali?.grid ?? [hero, ...cur.entries], gridOrder: cur.quali?.grid ?? null, pace, laps: R.laps, track: R.track, look: R.look, weather: R.weather,
    levels: (key) => (key === hero ? { engine: 0, tyres: 0, brakes: 0, ...save.garage.upgrades[hero] } : lv(devOf(save, key))) };
}

/**
 * The feature race is done. result: { order: [car keys, finishing order], best: { key: seconds | null }, dnf, crashes, spins, pro }.
 * Scores the round (points, Round Rating, XP, REP, trust, objectives, money), stores it, and moves on to the next round or the
 * season review. Returns the round report the results screen shows.
 */
export function finishRace(save, result) {
  const R = currentRound(save), cur = save.season.current, me = save.contract, hero = me.car, tier = save.season.tier;
  if (!cur.quali) finishQuali(save, null);                  // never qualified (a reload mid-weekend): from the back
  const at = result.order.indexOf(hero), order = result.order.filter((k) => k !== hero); order.splice(result.dnf || at < 0 ? order.length : at, 0, hero);   // a retirement is classified last
  const finish = order.indexOf(hero) + 1, grid = cur.quali.grid.indexOf(hero) + 1, pole = grid === 1;
  const fastLap = Math.min(...Object.values(result.best).filter(Number.isFinite)), fastestKey = Object.keys(result.best).find((k) => result.best[k] === fastLap);
  const fastest = fastestKey === hero && !result.dnf, clean = (result.spins ?? 0) === 0 && (result.crashes ?? 0) <= 1, duel = cur.quali.duel, dnf = !!result.dnf;
  // points (4.4): per entry, the finale x1.5, pole +2, fastest lap +1
  const P = T.series, mult = R.finale ? P.finaleMult : 1;
  const entries = order.map((key, i) => ({ key, team: CAR[key].team, code: key === hero ? save.player.code : CAR[key].driver.code, you: key === hero,
    pts: (key === hero && dnf ? 0 : (P.points[i] ?? 0) * mult) + (cur.quali.grid[0] === key ? P.pole : 0) + (fastestKey === key ? P.fastestLap : 0) }));
  const x = { expPos: cur.expPos, grid, finish, fastest, clean, duel, dnf };
  const objectives = cur.objectives.map((o) => ({ ...o, met: objectiveMet(o, x) }));
  const mandatory = objectives[0].met, optional = objectives.slice(1).filter((o) => o.met).length;
  const rating = roundRating({ ...x, underdog: me.underdog });
  const myExp = cur.expPos, myRank = TIERS.tiers[tier].rank;   // giant-killing: beating an entry from a higher tier that was expected ahead
  const giantKills = dnf ? 0 : order.slice(finish).filter((k) => tierOf(CAR[k].team).rank > myRank && expOf(save.world.teams[CAR[k].team].expPos, CAR[k].seat) < myExp).length;
  const xp = xpFor({ ...x, pole, mandatory, optional, tier, pro: result.pro, underdog: me.underdog });
  const rep = repFor({ rr: rating.rr, tier, finish, pole, fastest, giantKills, dnf });
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
  const S = save.stats; S.starts++; if (!dnf && finish === 1) S.wins++; if (!dnf && finish <= 3) S.podiums++; if (pole) S.poles++; if (fastest) S.fastest++;
  const report = { round: R.round, track: R.track, name: R.name, finale: R.finale, laps: R.laps, finish, grid, expPos: cur.expPos, dnf, pole, fastest, clean,
    rr: rating.rr, rrLines: rating.lines, xp: xp.xp, xpLines: xp.lines, rep: rep.rep, repLines: rep.lines, trust, coins: earned, coinLines: coins,
    objectives, duel: { ...duel, mine: cur.quali.laps[hero], mate: cur.quali.mate.lap, mateCar: cur.quali.mate.car }, entries, best: result.best, levelUp: save.career.cl > clBefore ? save.career.cl : null };
  save.season.results.push(report);
  save.clock.round++;
  if (save.clock.round < save.season.calendar.length) prepareRound(save); else endSeason(save);
  return report;
}

// ---------------------------------------------------------------------------------------------- standings
/** the Drivers', Teams' and tier Cup tables from the rounds raced (4.4), sorted, with the player's rows flagged */
export function standings(save) {
  const D = {}, Tm = {};
  for (const r of save.season?.results ?? []) for (const e of r.entries) {
    const d = (D[e.code] ??= { code: e.code, you: e.you, team: e.team, name: e.you ? save.player.name : CAR[e.key].driver.name, pts: 0, wins: 0 });
    d.pts += e.pts; d.team = e.team; if (r.entries[0] === e) d.wins++;
    const t = (Tm[e.team] ??= { team: e.team, pts: 0, wins: 0, you: save.contract?.team === e.team }); t.pts += e.pts; if (r.entries[0] === e) t.wins++;
  }
  for (const id of TEAM_IDS) Tm[id] ??= { team: id, pts: 0, wins: 0, you: save.contract?.team === id };
  const sort = (l) => l.sort((a, b) => b.pts - a.pts || b.wins - a.wins || (save.world.teams[a.team].expPos - save.world.teams[b.team].expPos));
  const teams = sort(Object.values(Tm)), tier = save.season?.tier;
  return { drivers: sort(Object.values(D)), teams, cup: teams.filter((t) => TIERS.teams[t.team].tier === tier) };
}

// ---------------------------------------------------------------------------------------------- the season end
function endSeason(save) {
  const st = standings(save), me = save.contract, rs = save.season.results;
  const teamPos = st.teams.findIndex((t) => t.team === me.team) + 1, cupPos = st.cup.findIndex((t) => t.team === me.team) + 1, drvPos = st.drivers.findIndex((d) => d.you) + 1;
  let rep = 0, coins = 0;
  if (cupPos === 1) { rep += T.rep.cup; coins += TIERS.tiers[save.season.tier].bonus.cup; save.stats.cups++; }
  if (teamPos === 1) rep += T.rep.teams;
  if (drvPos === 1) { rep += T.rep.drivers; save.stats.titles++; }
  save.career.rep = clamp(save.career.rep + rep, 0, 1000); save.wallet.coins += coins;
  const avgRR = rs.reduce((s, r) => s + r.rr, 0) / Math.max(1, rs.length);
  save.history.push({ season: save.clock.season, team: me.team, seat: me.seat, car: me.car, tier: save.season.tier, drivers: drvPos, teams: teamPos, cup: cupPos,
    points: st.drivers[drvPos - 1]?.pts ?? 0, avgRR: Math.round(avgRR * 10) / 10, duel: { ...me.duel }, teamOrder: st.teams.map((t) => t.team) });
  save.pending = { review: { drivers: drvPos, teams: teamPos, cup: cupPos, rep, coins, avgRR }, offers: seasonOffers(save) };
  save.clock.phase = 'review';
}

/**
 * The end-of-season market (6.5, P1 scope): promotion to the A seat for a won duel and trust, offers from the next tier up when the
 * gates and a seeded roll allow, and always a way to stay (the contract runs on, a renewal, or a reserve seat): never a dead end.
 */
function seasonOffers(save) {
  const me = save.contract, tier = TIERS.tiers[save.season.tier], season = save.clock.season, list = [];
  const st = { rep: save.career.rep, rrs: save.career.rr, cl: save.career.cl, form: formOf(save.career.rr) };
  const d = me.duel, raced = d.won + d.lost + d.level;
  if (me.seat === 'B' && raced && d.won / raced >= T.offers.promoteDuelShare && me.trust >= T.trust.promote)
    list.push(offer(save, me.team, 'A', { salary: tier.salary.A, signing: 0, seasons: 2, why: `You won the duel ${d.won}-${d.lost} and the team trusts you.` }));
  const myZ = TIERS.carZ[me.car] ?? 0;
  for (const team of TEAM_IDS.filter((t) => TIERS.tiers[TIERS.teams[t].tier].rank === tier.rank + 1)) {
    const interest = interestOf(team, st); if (interest === null || !offerRoll(save.seed, season, team, interest)) continue;
    let seat = interest >= 0.6 ? 'A' : 'B';
    if ((TIERS.carZ[seatCar(team, seat)] ?? 0) < myZ - T.offers.maxCarDropZ) { if (seat === 'B') seat = 'A'; else continue; }   // never a big step down in car (5.3)
    if ((TIERS.carZ[seatCar(team, seat)] ?? 0) < myZ - T.offers.maxCarDropZ) continue;
    const T2 = TIERS.tiers[TIERS.teams[team].tier], salary = round50(T2.salary[seat] * (0.9 + 0.3 * interest));
    list.push(offer(save, team, seat, { salary, signing: round50(salary * (2 + 2 * interest)), seasons: 1 + Math.round(2 * interest), interest: Math.round(interest * 100) / 100,
      why: `${TIERS.tiers[TIERS.teams[team].tier].name} interest ${Math.round(interest * 100)} %: your reputation and form cleared their bar.` }));
  }
  if (me.seasonsLeft > 1) list.push({ ...offer(save, me.team, me.seat, { salary: me.salary, signing: 0, seasons: me.seasons }), keep: true, why: `Your contract runs ${me.seasonsLeft - 1} more ${me.seasonsLeft - 1 === 1 ? 'season' : 'seasons'}.` });
  else if (me.trust >= T.trust.renew) list.push(offer(save, me.team, me.seat, { salary: round5(me.salary * 1.1), signing: round50(me.salary * 2), seasons: 2, why: 'The team wants to renew.' }));
  else {                                                     // unwanted: a reserve B seat at a Rookie team, 60 % salary (6.7)
    const rookies = TEAM_IDS.filter((t) => TIERS.teams[t].tier === 'rookie' && t !== me.team), team = rookies[Math.floor(rng(save.seed, 'market', season)() * rookies.length)];
    list.push(offer(save, team, 'B', { salary: round5(TIERS.tiers.rookie.salary.B * T.offers.reserveSalary), signing: 0, seasons: 1, why: 'Your team let you go. A reserve seat keeps you racing.' }));
  }
  return list;
}

/** between seasons (6.8, 2.3): AI development, rating drift by age, expected finishes from the Teams' table */
function nextSeasonWorld(save) {
  const W = save.world, h = save.history.at(-1), cat = (save.clock.season - 1) % 3, order = [1, 0, 2][cat];   // tyres, engine, brakes in turn
  for (const id of TEAM_IDS) { const t = W.teams[id], cap = tierOf(id).cap; t.dev[order] = Math.min(cap, t.dev[order] + 1); }
  for (const code of Object.keys(W.ratings)) {
    const age = (W.ages[code] = (W.ages[code] ?? 30) + 1), step = DRIVERS.drift.find(([max]) => age < max)?.[1] ?? 0;
    W.ratings[code] = clamp(W.ratings[code] + step, 60, 99);
  }
  if (h?.teamOrder) {
    const v = Object.fromEntries(TEAM_IDS.map((id) => [id, 0.5 * W.teams[id].expPos + 0.5 * (h.teamOrder.indexOf(id) + 1)]));
    [...TEAM_IDS].sort((a, b) => v[a] - v[b] || W.teams[a].expPos - W.teams[b].expPos).forEach((id, i) => { W.teams[id].expPos = i + 1; });
  }
  save.clock.season++;
}

// ---------------------------------------------------------------------------------------------- XP, upgrades
function gainXp(save, n) { save.career.xp += n; save.career.cl = levelOf(save.career.xp); }
/** what the next level of `cat` costs on the career car, and why it cannot be bought (cap by tier, CL gate, coins) */
export function upgradeInfo(save, cat, hp) {
  const car = save.contract.car, cur = save.garage.upgrades[car]?.[cat] ?? 0, cap = TIERS.tiers[TIERS.teams[save.contract.team].tier].cap;
  const next = cur + 1, cost = next <= MAX_LEVEL ? costOf(hp, next) : null, gate = T.upgrades.clGate[next - 1];
  const reason = next > cap ? 'cap' : next > MAX_LEVEL ? 'maxed' : save.career.cl < gate ? 'level' : save.wallet.coins < cost ? 'coins' : null;
  return { level: cur, next, cost, cap, gate, reason };
}
export function buyUpgrade(save, cat, hp) {
  if (!CATS.some(([c]) => c === cat)) return { ok: false, reason: 'unknown' };
  const u = upgradeInfo(save, cat, hp); if (u.reason) return { ok: false, ...u };
  const car = save.contract.car;
  save.wallet.coins -= u.cost; save.garage.upgrades[car] = { engine: 0, tyres: 0, brakes: 0, ...save.garage.upgrades[car], [cat]: u.next };
  save.garage.paid[car] = (save.garage.paid[car] ?? 0) + u.cost;
  return { ok: true, ...u, level: u.next };
}
