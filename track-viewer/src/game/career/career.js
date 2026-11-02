// The career facade the screens call (docs/career-mode.md 10.3): a save goes in, the same save comes out changed. Pure: no DOM and
// no storage (save.js stores it), so a whole career runs in node (scripts/test-career.mjs, scripts/career-sim.mjs).
//   newCareer -> finishShootout -> acceptOffer -> weeks: [ event? / market? -> advanceWeek | finishQuali -> finishRace ] -> review (offers) -> acceptOffer -> ...
// Every roll happens once, when its moment comes, and its outcome is stored, so a reload never re-rolls (7.2).
import { rewardFor, costOf, CATS, MAX_LEVEL } from '../economy.js';
import { rng, gauss } from './rng.js';
import {
  TUNING as T, TIERS, CAL, DRIVERS, TEAM_IDS, CAR, clamp, tierOf, seatCar, otherSeat, expOf, levelOf, formOf, paceOf, parLap,
  buildCalendar, buildWeeks, lapsFor, aiLap, duelOf, roundRating, xpFor, repFor, trustFor, objectivesFor, objectiveMet, targetMet, targetText, sideMedal, loreOf,
} from './rules.js';
import { YOU, newWorld, personOf, driverAt, sessionDriver, takeSeat, marketMoves, heatAfter, rivalsOf } from './world.js';
import { post, unread, markRead } from './inbox.js';
import {
  offer, findOffer, mateOf, releaseCut, leverageOf, canNegotiate, leversOf, openingAsk, pushOf, patienceOf, negotiate, walkAway, midSeason, signMid, teamOutlook, approach, seasonOffers,
  sponsorSlots, sponsorOffers, signSponsor, sponsorRound, sponsorSkipped,
} from './offers.js';

export const SCHEMA = 4;
export { releaseCut as releaseCutOf, driverAt, personOf, rivalsOf, unread, markRead, findOffer, mateOf, leverageOf, canNegotiate, leversOf, openingAsk, pushOf, patienceOf, negotiate, walkAway, signMid, teamOutlook, approach, sponsorSlots, signSponsor };
const round50 = (v) => Math.round(v / 50) * 50, round5 = (v) => Math.round(v / 5) * 5;
const rankOf = (team) => tierOf(team).rank;
const mean = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0);
const teamName = (id) => loreOf(id).name;

/** the three letters on the tower: from the surname, never one another driver wears */
const TAKEN = new Set([...Object.values(CAR).map((c) => c.driver.code), ...DRIVERS.academy.map((a) => a.code)]);
function codeOf(name) {
  const words = name.trim().split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, '').toUpperCase()), last = words.at(-1) || 'YOU', first = words.length > 1 ? words[0] : '';
  return [last.slice(0, 3), first.slice(0, 1) + last.slice(0, 2), last.slice(0, 2) + last.at(-1), 'YOU'].map((c) => c.padEnd(3, 'X')).find((c) => !TAKEN.has(c));
}

/** a new career: the driver, a seed, the world as data; the next step is the Open Shootout (3.1) */
export function newCareer({ name = 'A. Driver', nation = 'IND', number = 99, seed = (Math.random() * 2 ** 31) >>> 0, difficulty = 'normal', raceLength = 'sprint', now = new Date().toISOString() } = {}) {
  return {
    schema: SCHEMA, id: 'c_' + seed.toString(36), createdAt: now, seed, rules: { difficulty, raceLength },
    player: { name: name.trim() || 'A. Driver', code: codeOf(name), nation, number },
    clock: { season: 1, round: 0, week: 0, phase: 'shootout' },
    career: { xp: 0, cl: 1, rep: 0, rr: [], heat: {} },
    contract: null, wallet: { coins: T.money.startWallet },
    garage: { upgrades: {}, paid: {}, package: 0 },
    world: newWorld(), season: null, pending: null, history: [], inbox: [], inboxN: 0, sponsors: { deals: [], offers: [] },
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
  if (save.schema === 3) {                                    // before weeks a season was only its rounds: rebuild them around the round the save is on
    Object.assign(save, { inbox: [], inboxN: 0, sponsors: { deals: [], offers: [] } });
    if (TAKEN.has(save.player.code)) save.player.code = codeOf(save.player.name);
    save.clock.week = 0;
    if (save.season) {
      const S = save.season, weeks = buildWeeks(S.calendar, save.contract ? TIERS.teams[save.contract.team].side ?? 'test' : 'test');
      weeks.forEach((w) => { if (w.event && weeks.findIndex((x) => x.kind === 'race' && x.round === save.clock.round) > weeks.indexOf(w)) w.event.skipped = true; });
      S.results.forEach((r, i) => { weeks.find((w) => w.round === i).result = { finish: r.finish, rr: r.rr, dnf: r.dnf }; });
      const at = save.clock.phase === 'review' ? weeks.length - 1 : Math.max(0, weeks.findIndex((w) => w.kind === 'race' && w.round === save.clock.round));
      S.weeks = weeks; S.asked = {}; S.mid = S.w1?.state === 'open' && save.clock.phase !== 'review' ? [{ ...S.w1.offer, expires: weeks.findIndex((w, i) => i >= at && w.kind !== 'race') }] : []; delete S.w1;
      S.calendar.forEach((r, i) => { if (i >= save.clock.round && r.track === 'infinia' && r.look === 'night') r.look = 'dusk'; });   // Infinia is day and dusk only
      if (S.current) delete S.current.side;
      save.clock.week = at;
      post(save, 'news', 'The season now runs in weeks', 'Your career moved to the new calendar. Nothing you raced has changed.');
    }
    save.schema = 4;
  }
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
  if (old && o.team !== old.team && !o.signed && !o.reserve && !old.dropped && old.seasonsLeft > 1) {   // bought out of a running contract: you get the cut (3.3)
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
  const displaced = save.world.seats[o.car];
  takeSeat(save, o.car, old?.car);
  if (!first) nextSeasonWorld(save);
  startSeason(save, available, old?.team !== o.team && displaced !== YOU ? displaced : null);
  return save;
}

// ---------------------------------------------------------------------------------------------- seasons and weeks
function startSeason(save, available, displaced = null) {
  const me = save.contract, tier = TIERS.teams[me.team].tier, world = TIERS.tiers[tier].world, calendar = buildCalendar(save.seed, save.clock.season, world, available, save.rules.raceLength);
  save.season = { tier, world, calendar, weeks: buildWeeks(calendar, TIERS.teams[me.team].side ?? 'test'), results: [], current: null, mid: [], asked: {} };
  save.pending = null; save.clock.round = 0; save.clock.week = 0;
  save.garage.package = (save.garage.package ?? 0) + (me.trust >= T.trust.package ? (me.status === 'number1' ? 2 : 1) : 0);   // the team's free level at the season start (5.4), on top of any not yet spent
  prepareRound(save);
  post(save, 'team', `Season ${save.clock.season} with ${teamName(me.team)}`, `${TIERS.tiers[tier].cup}, ${calendar.length} rounds, ${save.season.weeks.length} weeks. ${save.garage.package ? `You have ${save.garage.package === 1 ? 'a free upgrade level' : `${save.garage.package} free upgrade levels`}: spend ${save.garage.package === 1 ? 'it' : 'them'} in the Garage.` : ''}`.trim(), save.garage.package ? { tab: 'garage' } : null);
  if (displaced) post(save, 'team', `${personOf(save, displaced)?.name ?? displaced} lost the seat to you`, 'A free agent now, and not one to forget it.');
  sponsorOffers(save, save.season.weeks.findIndex((w) => w.kind === 'market'));
}
/** the next round's entries (each AI team nominates one of its two drivers, 4.4) and objectives; the race week shows them */
function prepareRound(save) {
  const { season, round } = save.clock, R = save.season.calendar[round], me = save.contract;
  const entries = TEAM_IDS.filter((t) => t !== me.team).map((t) => {
    const r = rng(save.seed, 'ai', 'nominate', season, round, t);
    return seatCar(t, r() < T.entries.aSeat[TIERS.teams[t].tier] ? 'A' : 'B');
  });
  const expPos = expOf(save.world.teams[me.team].expPos, me.seat);
  save.season.current = { round: R.round, entries, expPos, objectives: objectivesFor(rng(save.seed, 'obj', season, round), expPos, me.easier), quali: null };
  save.clock.phase = 'paddock';
}
export const currentWeek = (save) => save.season?.weeks?.[save.clock.week] ?? null;
/** the round a week leads to: the next race week from it (its circuit is where that week's test or sponsor day runs) */
export const roundOfWeek = (save, i) => { const w = save.season.weeks.slice(i).find((x) => x.kind === 'race'); return w ? save.season.calendar[w.round] : null; };
/** an event's name on every screen: a sponsor day carries the signed sponsor's name */
export function eventName(save, week) {
  const e = week.event; if (!e) return null;
  if (e.kind === 'test') return week.kind === 'pre' ? 'Pre-season shakedown' : 'Team test';
  return `${save.sponsors?.deals?.[0]?.name ?? 'Team'} drift day`;
}
/** what pressing Advance would cost, in words; empty when nothing is lost */
export function advanceWarnings(save) {
  const w = currentWeek(save), i = save.clock.week, out = [], S = save.sponsors;
  if (w?.event && !w.event.result && w.event.kind === 'sponsor' && S.deals.length) {
    const end = S.deals.filter((d) => d.mood <= 1), rest = S.deals.filter((d) => d.mood > 1);
    if (end.length) out.push(`Skipping ends your deal with ${end.map((d) => d.name).join(' and ')}: the retainer stops, reputation ${T.sponsors.droppedRep}`);
    if (rest.length) out.push(`Skipping costs goodwill with ${rest.map((d) => d.name).join(' and ')}`);
  }
  const lapse = [...(save.season?.mid ?? []), ...S.offers].filter((o) => (o.expires ?? i) === i);
  if (lapse.length) out.push(`${lapse.map((o) => o.name ?? teamName(o.team)).join(' and ')} ${lapse.length === 1 ? 'lapses' : 'lapse'} this week`);
  return out;
}
/** Advance: the next week. A race week does not advance (it ends with the race); a skipped event is marked, offers past their date lapse and the inbox says so */
export function advanceWeek(save) {
  const w = currentWeek(save), i = save.clock.week, S = save.sponsors; if (!w || w.kind === 'race' || w.kind === 'end' || save.clock.phase !== 'paddock') return { ok: false };
  if (w.event && !w.event.result) { w.event.skipped = true; if (w.event.kind === 'sponsor' && S.deals.length) sponsorSkipped(save); }
  for (const o of save.season.mid.filter((x) => x.expires === i || x.expires === undefined)) {
    save.season.mid.splice(save.season.mid.indexOf(o), 1); save.world.teams[o.team].declined++;
    post(save, 'deal', `${teamName(o.team)}'s offer lapsed`, 'You did not answer before the market closed.');
  }
  for (const o of S.offers.filter((x) => x.expires === i)) { S.offers.splice(S.offers.indexOf(o), 1); post(save, 'sponsor', `${o.name}'s offer lapsed`, 'You did not answer in time.'); }
  save.clock.week++;
  enterWeek(save);
  return { ok: true, week: currentWeek(save) };
}
function enterWeek(save) {
  const w = currentWeek(save), S = save.season;
  if (w.kind === 'race') {
    const R = S.calendar[w.round]; post(save, 'race', `Race week: ${R.name}`, `Round ${R.round} of ${S.calendar.length}${R.finale ? ', points ×1.5' : ''}. Expected finish P${S.current.expPos}. Practice is open, and qualifying sets the grid.`, { tab: 'home' });
  } else if (w.kind === 'market') {
    post(save, 'deal', 'The market is open', save.clock.season === 1 ? 'Sponsors can still talk. Teams will not: your first season is probation, and they come to you at the season end.' : 'For this one week teams can talk to you, and you can knock on their doors. Anything you sign starts next season.', { tab: 'deals' });
    sponsorOffers(save, save.clock.week + 2);   // the open week after the next round: late enough to answer, early enough to hit a target
  }
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
  while (currentWeek(save).kind !== 'race' && advanceWeek(save).ok);   // qualifying belongs to a race week: anything still open is skipped
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

// ---------------------------------------------------------------------------------------------- events (4.2, section 13)
/** this week's event, ready to drive: the next round's circuit and look, dry, the player's car, the targets */
export function sideSpec(save) {
  const w = currentWeek(save), e = w?.event; if (!e || e.result || e.skipped || save.clock.phase !== 'paddock') return null;
  const R = currentRound(save), car = save.contract.car, L = myLevels(save), par = parLap(R.track, car, 'dry', [L.engine, L.tyres, L.brakes]);
  return { kind: e.kind, name: eventName(save, w), track: R.track, look: R.look, weather: 'dry', car, par, targets: e.kind === 'test' ? T.side.test.map((x) => par * x) : [...T.side.sponsor] };
}
/** an event is done: value is the best lap (test day) or the drift score (sponsor day). Medal, XP, pay or a free upgrade level; gold cheers a sponsor up */
export function finishSide(save, value) {
  const spec = sideSpec(save); if (!spec) return null;
  const medal = sideMedal(spec.kind, value, spec.par), tier = TIERS.tiers[save.season.tier];
  const xp = medal ? T.side.xp[medal - 1] : 0, coins = spec.kind === 'sponsor' && medal ? round5(T.side.pay[medal - 1] * tier.sponsor * (1 + T.side.formPay * formOf(save.career.rr))) : 0;
  const pkg = spec.kind === 'test' && medal === 3 ? 1 : 0;
  gainXp(save, xp); save.wallet.coins += coins; save.garage.package += pkg;
  if (spec.kind === 'sponsor' && medal === 3) for (const d of save.sponsors.deals) d.mood++;
  const r = (currentWeek(save).event.result = { kind: spec.kind, value: Number.isFinite(value) ? value : null, medal, xp, coins, package: pkg });
  post(save, 'event', `${spec.name}: ${['no medal', 'bronze', 'silver', 'gold'][medal]}`, [xp ? `+${xp} XP` : null, coins ? `+${coins.toLocaleString('en')} U` : null, pkg ? 'a free upgrade level, in the Garage' : null].filter(Boolean).join(', ') || 'Nothing earned this time.', pkg ? { tab: 'garage' } : null);
  return r;
}

// ---------------------------------------------------------------------------------------------- the race
/**
 * The feature race is done. result: { order: [car keys, finishing order], best: { key: seconds | null }, dnf, crashes, spins, pro }.
 * Scores the round (points, Round Rating, XP, REP, trust, objectives, money, rivals), stores it, opens the mid-season market after the
 * middle round, and moves on to the next week or the season review. Returns the round report the results screen shows.
 */
export function finishRace(save, result) {
  const R = currentRound(save), cur = save.season.current, me = save.contract, hero = me.car, tier = save.season.tier, seats = save.world.seats;
  if (!cur.quali) finishQuali(save, null);                  // never qualified (a reload mid-weekend): from the back
  const at = result.order.indexOf(hero), order = result.order.filter((k) => k !== hero); order.splice(result.dnf || at < 0 ? order.length : at, 0, hero);   // a retirement is classified last
  const finish = order.indexOf(hero) + 1, grid = cur.quali.grid.indexOf(hero) + 1, pole = grid === 1;
  const fastLap = Math.min(...Object.values(result.best).filter(Number.isFinite)), fastestKey = Object.keys(result.best).find((k) => result.best[k] === fastLap);
  const dnf = !!result.dnf, fastest = fastestKey === hero && !dnf, clean = (result.spins ?? 0) === 0 && (result.crashes ?? 0) <= 1, duel = cur.quali.duel;
  // points (4.4): per entry, the finale x1.5, pole +2, fastest lap +1; a retirement scores no place and no fastest lap, a reserve driver nothing in rounds 1-2 (6.7)
  const P = T.series, mult = R.finale ? P.finaleMult : 1, bench = me.reserve && R.round <= 2;
  const entries = order.map((key, i) => ({ key, team: CAR[key].team, code: key === hero ? save.player.code : seats[key], you: key === hero,
    pts: key === hero && bench ? 0 : (key === hero && dnf ? 0 : (P.points[i] ?? 0) * mult + (fastestKey === key ? P.fastestLap : 0)) + (cur.quali.grid[0] === key ? P.pole : 0) }));
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
  // money (5.5): salary, the race prize x the tier's multiplier, objective and contract bonuses, sponsors
  const Tr = TIERS.tiers[tier], coins = [['Salary', me.salary]];
  for (const [label, v] of rewardFor({ mode: 'race', pos: finish, cars: order.length, laps: R.laps, finished: !dnf, fastest }).lines) coins.push([label, round5(v * Tr.prize)]);
  if (mandatory) coins.push(['Round objective', Tr.objective[0]]);
  if (optional) coins.push(['Bonus objectives', optional * Tr.objective[1]]);
  if (!dnf && finish === 1) coins.push(['Win bonus', Tr.bonus.win]); else if (!dnf && finish <= 3) coins.push(['Podium bonus', Tr.bonus.podium]);
  coins.push(...sponsorRound(save, x, targetMet));
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
  const wk = currentWeek(save); wk.result = { finish, rr: rating.rr, dnf };
  post(save, 'race', `Round ${R.round}: ${dnf ? 'retired' : `P${finish}`} from P${grid}, rating ${rating.rr.toFixed(1)}`, `+${xp.xp} XP, +${earned.toLocaleString('en')} U, reputation ${rep.rep >= 0 ? '+' : ''}${rep.rep}, trust ${trust >= 0 ? '+' : ''}${trust}.`);
  if (report.levelUp) post(save, 'news', `Career Level ${report.levelUp}`, 'Better upgrades and more teams open up as your level rises.', { tab: 'garage' });
  save.clock.round++;
  const n = save.season.calendar.length;
  if (save.clock.round === Math.ceil(n / 2) && save.clock.round < n) {
    report.midSeason = midSeason(save);
    if (report.midSeason.warning) post(save, 'warn', 'Seat review', `Team trust is ${me.trust}. Meet the round objective in the next ${T.trust.recover} rounds, or a low trust at the finale costs you the seat.`);
  }
  save.clock.week++;
  if (save.clock.round < n) { prepareRound(save); enterWeek(save); } else endSeason(save);
  return report;
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
function endSeason(save) {
  const st = standings(save), me = save.contract, rs = save.season.results, S = save.sponsors;
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
  for (const d of S.deals) if (!d.met) post(save, 'sponsor', `${d.name}: target missed`, `You did not ${targetText(d.target)}. No bonus this year.`);
  for (const o of save.season.mid.splice(0)) { save.world.teams[o.team].declined++; post(save, 'deal', `${teamName(o.team)}'s offer lapsed`, 'You did not answer before the season ended.'); }
  S.deals = []; S.offers = []; save.season.asked = {};       // a sponsor signs for one season; each window's doors open again
  save.pending = { review: { drivers: drvPos, driverCount: st.drivers.length, teams: teamPos, cup: cupPos, rep, coins, avgRR, dropped, trust: me.trust }, offers: seasonOffers(save, { cup: cupPos === 1, title: drvPos === 1, dropped }) };
  save.clock.phase = 'review';
  post(save, dropped ? 'warn' : 'race', `Season ${save.clock.season} is over: P${drvPos} in the Drivers'`, dropped ? `${teamName(me.team)} has let you go.` : 'The review and the market are waiting.');
}

/** between seasons (6.8, 2.3): AI development, the driver market, expected finishes from the Teams' table */
function nextSeasonWorld(save) {
  const W = save.world, h = save.history.at(-1), cat = (save.clock.season - 1) % 3, order = [1, 0, 2][cat], gone = W.retired.length;   // tyres, engine, brakes in turn
  for (const id of TEAM_IDS) { const t = W.teams[id], cap = tierOf(id).cap; t.dev[order] = Math.min(cap, t.dev[order] + 1); }
  marketMoves(save);
  if (h?.teamOrder) {
    const v = Object.fromEntries(TEAM_IDS.map((id) => [id, 0.5 * W.teams[id].expPos + 0.5 * (h.teamOrder.indexOf(id) + 1)]));
    [...TEAM_IDS].sort((a, b) => v[a] - v[b] || W.teams[a].expPos - W.teams[b].expPos).forEach((id, i) => { W.teams[id].expPos = i + 1; });
  }
  save.clock.season++; save.clock.week = 0;
  for (const code of W.retired.slice(gone)) post(save, 'news', `${personOf(save, code)?.name ?? code} has retired`, 'A seat has opened in the market.');
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
