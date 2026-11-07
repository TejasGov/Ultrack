// The career facade the screens call (docs/career-mode.md 10.3): a save goes in, the same save comes out changed. Pure: no DOM and
// no storage (save.js stores it), so a whole career runs in node (scripts/test-career.mjs, scripts/career-sim.mjs).
//   newCareer -> finishShootout -> acceptOffer -> weeks: [ event? / market? -> advanceWeek | finishQuali -> finishRace ] -> review (offers) -> acceptOffer -> ...
// Every roll happens once, when its moment comes, and its outcome is stored, so a reload never re-rolls (7.2).
import { rewardFor, costOf, CATS, MAX_LEVEL } from '../economy.js';
import { rng, gauss } from './rng.js';
import { trackOf } from '../../tracks.js';
import {
  TUNING as T, TIERS, CAL, DRIVERS, TEAM_IDS, CAR, FIELD, DIV, divOf, teamsIn, carsIn, expIn, lcqGrid, clamp, tierOf, seatCar, otherSeat, expOf, levelOf, formOf, paceOf, parLap, aeroOf, repairBill,
  buildCalendar, buildWeeks, lapsFor, aiLap, duelOf, roundRating, xpFor, repFor, trustFor, objectivesFor, objectiveFrom, objectiveMet, qualiExemption, targetFor, targetMet, targetText, sideMedal, challengeMet, challengeText, loreOf, isSpecial, pointsMult, SPONSORS, composureOf, ordersFor,
} from './rules.js';
import { LIFE, ITEMS, TYPES, itemOf, newLife, mood, bandOf, fansName, payMult, xpMult, trustMult, repMult, canDemand, isHome, ownedN, boostOf, glowOf, upkeepOf, lift, settleRound, payUpkeep, adPay } from './life.js';
import { newRanking, rankPoints, addDay, rankingOf, playerRank } from './ranking.js';
import { YOU, newWorld, splitOf, contractFor, loyaltyFor, personOf, driverAt, sessionDriver, takeSeat, marketMoves, heatAfter, nemesisAmong, heatUp, rivalsOf } from './world.js';
import { hire, hireInfo, discount, tierNow, STAFF, STAFF_LIST, ROLES } from './staff.js';
import { post, unread, markRead } from './inbox.js';
import { note } from './ledger.js';
import { poseWeek, settleChoices, settleCallout, answerChoice, choiceOf, openChoices } from './choices.js';
import { coverLife, coverRound, coverOpen, coverMoves, coverDisplaced, coverSigning, coverHotSeat, coverFired, coverOrders, coverRumour, coverPrincipal, unreadStories, readStory, storyImage, latestBytes } from './media.js';
import {
  offer, findOffer, mateOf, releaseCut, leverageOf, canNegotiate, leversOf, openingAsk, pushOf, patienceOf, negotiate, walkAway, midSeason, signMid, teamOutlook, approach, seasonOffers,
  sponsorSlots, sponsorOffers, signSponsor, sponsorRound, sponsorCredit, sponsorSkipped, sponsorUpset, sponsorWalks, demandTransfer, rumours, holdsSeat, fallbackOffer, patienceMax, rivalSigns,
} from './offers.js';
import { openWindow, windowInfo, windowWarnings, windowDay, TACTICS, tacticInfo, useTactic } from './transfers.js';

export const SCHEMA = 13;
export { rankingOf, playerRank };
export { hire as hireStaff, hireInfo as staffInfo, discount as staffDiscount, tierNow as staffTier, STAFF, STAFF_LIST, ROLES as STAFF_ROLES };
export { unreadStories, readStory, storyImage, latestBytes };
export { answerChoice, choiceOf, openChoices };
export { LIFE, ITEMS, TYPES, itemOf, mood as moodOf, bandOf, fansName, payMult, canDemand, ownedN, boostOf, glowOf, upkeepOf };
export { thumbOf } from './media.js';
export { windowInfo, windowWarnings, windowDay, TACTICS, tacticInfo, useTactic, patienceMax };
export { releaseCut as releaseCutOf, driverAt, personOf, rivalsOf, unread, markRead, findOffer, mateOf, leverageOf, canNegotiate, leversOf, openingAsk, pushOf, patienceOf, negotiate, walkAway, signMid, teamOutlook, approach, sponsorSlots, signSponsor };
const stock = () => Object.fromEntries(CATS.map(([c]) => [c, 0]));    // a car with no upgrade bought: an old save's entry may hold fewer categories, and a missing one reads as 0
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
  const world = newWorld(seed);
  return {
    schema: SCHEMA, id: 'c_' + seed.toString(36), createdAt: now, seed, rules: { difficulty, raceLength },
    player: { name: name.trim() || 'A. Driver', code: codeOf(name), nation, number },
    clock: { season: 1, round: 0, week: 0, phase: 'shootout' },
    career: { xp: 0, cl: 1, rep: 0, rr: [], heat: {}, rivalry: {}, ledger: [] },
    contract: null, wallet: { coins: T.money.startWallet },
    garage: { upgrades: {}, paid: {}, package: 0 }, staff: { crew: null, engineer: null }, life: newLife(),
    world, ranking: newRanking(world.ratings), hall: [], season: null, pending: null, history: [], inbox: [], inboxN: 0, sponsors: { deals: [], offers: [] },
    stats: { starts: 0, wins: 0, podiums: 0, poles: 0, fastest: 0, cups: 0, titles: 0, promotions: 0, relegations: 0, ...openStats() },
  };
}
/** the Open records in save.stats: wins at each Open (career), Masters wins, the season the Triple Crown was first completed (0: not yet), Grand Slams (all three Opens in one season) */
const openStats = () => ({ openWins: Object.fromEntries(Object.keys(CAL.opens).map((id) => [id, 0])), masters: 0, triple: 0, slams: 0 });
/** an older save brought up to this schema (10.2); null for one this code cannot read */
export function migrate(save) {
  if (!save || !(save.schema <= SCHEMA)) return null;
  if (save.schema === 1) {                                    // P1 saves: no seat map, heat or team package yet
    const W = save.world, fresh = newWorld();
    Object.assign(W, { seats: fresh.seats, free: [], retired: [], academy: {} });
    for (const t of Object.values(W.teams)) t.declined ??= 0;
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
  if (save.schema === 4) {                                    // before the Tour: the ranking starts from today's ratings and the Open records from none; a season under way finishes on the rounds it rolled
    Object.assign(save, { ranking: newRanking(save.world.ratings), hall: [] }); Object.assign(save.stats, openStats());
    save.schema = 5;
  }
  if (save.schema === 5) {                                    // before running costs: no staff, and upgrade entries that hold only engine, tyres and brakes
    save.staff = { crew: null, engineer: null };
    for (const [car, u] of Object.entries(save.garage.upgrades)) save.garage.upgrades[car] = { ...stock(), ...u };
    save.schema = 6;
  }
  if (save.schema === 6) {                                    // before the Shop: a driver at ease (50), fans from his name, nothing owned; a season under way keeps its weeks and simply has no activities booked
    save.life = newLife(save.career.rep);
    save.schema = 7;
  }
  if (save.schema === 7) {                                    // before earned rivalries: heat that came from finishing near someone is capped short of a nemesis, and a rival keeps that as their cause
    const K = save.career, RV = (K.rivalry = {}), mate = save.contract && save.world.seats[teammateCar(save)];
    for (const [c, h] of Object.entries(K.heat)) { K.heat[c] = Math.min(h, 60); if (h >= T.rivals.rival) RV[c] = { cause: 'grid', since: [save.clock.season, 0], w: 0, l: 0 }; }
    if (mate && mate !== YOU) { K.heat[mate] = Math.max(K.heat[mate] ?? 0, T.rivals.mate); RV[mate] ??= { cause: 'teammate', since: [save.clock.season, 0], w: 0, l: 0 }; }
    save.schema = 8;
  }
  if (save.schema === 8) {                                    // before AI contracts: every seated driver gets the 1-3 seasons a new career would roll, and the career remembers nothing yet
    const W = save.world; W.contracts = Object.fromEntries(Object.values(W.seats).filter((c) => c && c !== YOU).map((c) => [c, contractFor(save.seed, c)]));
    save.career.ledger = [];
    save.schema = 9;
  }
  if (save.schema === 9) {                                    // before choice scenes: a season under way has posed none
    if (save.season) save.season.choices ??= {};
    save.schema = 10;
  }
  if (save.schema === 10) {                                   // before the transfer window: every AI driver gets the loyalty a new career would roll, and a save at the review opens its window on day 0
    const W = save.world; W.loyalty = Object.fromEntries(Object.keys(W.ratings).map((c) => [c, W.academy[c] ? T.market.loyaltyAcademy : loyaltyFor(save.seed, c)]));
    if (save.clock.phase === 'review' && save.pending?.offers && !save.contract?.next) openWindow(save);
    save.schema = 11;
  }
  if (save.schema === 11) { addTeams(save); save.schema = 12; }   // before Norrsken (2026-11-07): the new team joins the world
  if (save.schema === 12) {                                   // before the two series (2026-11-07): each team's by today's expected place. A season under way has no season.divs, so it finishes as one field; the split starts next season
    const split = splitOf((t) => save.world.teams[t].expPos);
    for (const id of TEAM_IDS) save.world.teams[id].div = split[id];
    save.stats.promotions ??= 0; save.stats.relegations ??= 0;
    for (const o of [...(save.pending?.offers ?? []), ...(save.season?.mid ?? [])]) if (o.team in split) o.div ??= split[o.team];
    const mine = save.contract && DIV[split[save.contract.team]];
    if (save.season && mine) post(save, 'news', 'Two series from next season', `The Tour splits into the Elite and Challenger Series. ${teamName(save.contract.team)} start in the ${mine.name}.`);
    save.schema = 13;
  }
  for (const o of save.pending?.offers ?? []) if (o.counter === true) delete o.counter;     // saved while a flag on the team's counter-offer shared the field for their last terms
  for (const d of save.sponsors?.deals ?? []) d.mood = Math.min(d.mood, SPONSORS.startMood + 3);   // drift days raised goodwill with no cap: over it, the next gold would read as goodwill down
  return save;
}

/**
 * Teams in teams.json that a save's world lacks (Norrsken, schema 12) join it as a new career would roll them: the drivers' ratings, ages, contracts,
 * loyalty, ranking seed and seats. The team takes its expected place (every team from there down drops one) and the best development of its tier, so a
 * late joiner is not a lap down. A code the old save already gave someone (the player, an academy driver) is renamed first. Each new driver takes the race-day
 * points of the driver ranked where they are expected, so a mature ranking (its seed faded out) does not put them last. Joined mid-season, the team is marked
 * `joined`: its part-season table place neither sets next season's expectation nor sours its drivers' loyalty. The round in progress gets the new expected place.
 */
function addTeams(save) {
  const W = save.world, fresh = newWorld(save.seed), seed = newRanking(fresh.ratings).seed, ranked = save.ranking ? rankingOf(save) : [];
  for (const id of TEAM_IDS.filter((t) => !W.teams[t])) {
    const pos = Math.min(TIERS.teams[id].expPos, Object.keys(W.teams).length + 1), peers = Object.keys(W.teams).filter((t) => TIERS.teams[t].tier === TIERS.teams[id].tier);
    for (const t of Object.values(W.teams)) if (t.expPos >= pos) t.expPos++;
    W.teams[id] = { ...fresh.teams[id], expPos: pos, dev: fresh.teams[id].dev.map((d, i) => Math.max(d, ...peers.map((t) => W.teams[t].dev[i] ?? 0))), ...(save.season?.results?.length ? { joined: save.clock.season } : {}) };
    for (const key of ['A', 'B'].map((x) => seatCar(id, x))) {
      const code = CAR[key].driver.code;
      if (save.player.code === code) { save.player.code = codeOf(save.player.name); for (const r of save.season?.results ?? []) for (const e of r.entries) if (e.you) e.code = save.player.code; }
      if (code in W.ratings) { let n = 0; while (`A${String(n).padStart(2, '0')}` in W.ratings) n++; recode(save, code, `A${String(n).padStart(2, '0')}`); }
      W.seats[key] = code; W.ratings[code] = fresh.ratings[code]; W.ages[code] = fresh.ages[code]; (W.contracts ??= {})[code] = fresh.contracts[code]; (W.loyalty ??= {})[code] = fresh.loyalty[code];
      if (save.ranking) { save.ranking.seed[code] = seed[code]; const twin = W.seats[ranked[expOf(pos, CAR[key].seat) - 1]?.key];   // by car: a code renamed above is read as it is now
        if (twin) for (const d of save.ranking.days) if (twin in d) d[code] = d[twin]; }
    }
  }
  const cur = save.season?.current, me = save.contract, R = save.season?.calendar?.[save.clock.round];
  if (cur && me && R && cur.round === R.round) {               // prepareRound ran in the old world: every team below the new one is a place lower now
    cur.expPos = expOf(W.teams[me.team].expPos, me.seat);
    const fresh = objectivesFor(rng(save.seed, 'obj', save.clock.season, save.clock.round), cur.expPos, me.easier, !!cur.exempt || !!cur.open, cur.open && !cur.open.seeded ? cur.open.to : null);
    cur.objectives = cur.quali ? [fresh[0], ...cur.objectives.slice(1)] : fresh;   // after qualifying the player has seen the others: only the mandatory one follows the new place
  }
  if (me && save.season && save.clock.phase !== 'review') {    // a sponsor's place target set in the old world is a place too harsh below the new team
    const ep = expOf(W.teams[me.team].expPos, me.seat), S = save.sponsors;
    for (const d of [...(S?.deals ?? []).filter((x) => !x.met), ...(S?.offers ?? [])]) if (d.target.kind === 'top' || d.target.kind === 'quali') d.target = targetFor(d.target.kind, ep, save.season.calendar.length);
  }
}
/** a driver code renamed everywhere in a save, as a map key or a value: codes are the only three-capital strings a save holds besides nations, which are skipped */
function recode(node, from, to) {
  for (const k of Object.keys(node)) {
    if (k === 'nation') continue;
    const v = node[k], at = k === from && !Array.isArray(node) ? to : k;
    if (at !== k) { delete node[k]; node[at] = v; }
    if (v === from) node[at] = to; else if (v && typeof v === 'object') recode(v, from, to);
  }
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
    save.wallet.coins += back; save.garage.upgrades[old.car] = stock(); save.garage.paid[old.car] = 0;
    save.buyback = back;
  }
  if (old && o.team !== old.team && !o.signed && !o.reserve && !old.dropped && old.seasonsLeft > 1) {   // bought out of a running contract: you get the cut (3.3)
    save.transfer = releaseCut(old); save.wallet.coins += save.transfer;
  }
  const keep = old && old.team === o.team && !old.dropped;
  save.contract = { team: o.team, seat: o.seat, car: o.car, status: o.status, seasons: o.seasons, seasonsLeft: o.seasons, salary: o.salary, signing: o.signing ?? 0,
    underdog: !!o.underdog || !!(keep && old.underdog && old.car === o.car), easier: !!(o.easier || o.reserve || (o.keep && old.easier)), reserve: !!o.reserve,
    trust: keep ? old.trust : T.trust.startBy[o.status] ?? T.trust.start, duel: { won: 0, lost: 0, level: 0 }, since: keep ? old.since : save.clock.season };
  if (o.keep) Object.assign(save.contract, { seasons: old.seasons, seasonsLeft: old.seasonsLeft - 1, signing: 0 });
  save.wallet.coins += save.contract.signing;
  save.garage.upgrades[o.car] ??= stock(); save.garage.paid[o.car] ??= 0;
  const displaced = save.world.seats[o.car], before = { ...save.world.seats }, moved = old && old.team !== o.team;
  takeSeat(save, o.car, old?.car);
  if (!first) nextSeasonWorld(save, before, { displaced: moved && displaced !== YOU ? displaced : null, vacated: moved ? old.car : null });
  startSeason(save, available, old?.team !== o.team && displaced !== YOU ? displaced : null);
  if (old?.team !== o.team) coverSigning(save, o.team);
  return save;
}

// ---------------------------------------------------------------------------------------------- seasons and weeks
function startSeason(save, available, displaced = null) {
  const me = save.contract, tier = TIERS.teams[me.team].tier, world = TIERS.tiers[tier].world, calendar = buildCalendar(save.seed, save.clock.season, world, available, save.rules.raceLength);
  const divs = TEAM_IDS.every((t) => DIV.order.includes(save.world.teams[t].div)) ? Object.fromEntries(TEAM_IDS.map((t) => [t, save.world.teams[t].div])) : null;   // this season's series; a world without them (fewer teams) races one field
  save.season = { tier, world, calendar, weeks: buildWeeks(calendar, TIERS.teams[me.team].side ?? 'test'), results: [], current: null, mid: [], asked: {}, choices: {}, ...(divs ? { divs, div: divs[me.team] } : {}) };
  for (const d of divs ? DIV.order : []) if (carsIn(save, d).length < T.series.gridSize) throw new Error(`The ${DIV[d].name} has fewer than ${T.series.gridSize} cars`);
  save.pending = null; save.clock.round = 0; save.clock.week = 0;
  save.garage.package = (save.garage.package ?? 0) + (me.trust >= T.trust.package ? (me.status === 'number1' ? 2 : 1) : 0);   // the team's free level at the season start (5.4), on top of any not yet spent
  prepareRound(save);
  post(save, 'team', `Season ${save.clock.season} with ${teamName(me.team)}`, `${divs ? DIV[save.season.div].name : TIERS.tiers[tier].cup}, ${calendar.length} rounds, ${save.season.weeks.length} weeks. ${save.garage.package ? `You have ${save.garage.package === 1 ? 'a free upgrade level' : `${save.garage.package} free upgrade levels`}: spend ${save.garage.package === 1 ? 'it' : 'them'} in the Garage.` : ''}`.trim(), save.garage.package ? { tab: 'garage' } : null);
  if (displaced) post(save, 'team', `${personOf(save, displaced)?.name ?? displaced} lost the seat to you`, 'A free agent now, and not one to forget it.');
  if (displaced) coverDisplaced(save, displaced, me.team);
  upkeep(save);
  sponsorOffers(save, save.season.weeks.findIndex((w) => w.kind === 'market'));
}
/** the next round's expected place and objectives; the race week shows them */
function prepareRound(save) {
  const { season, round } = save.clock, R = save.season.calendar[round], me = save.contract, S = save.season, tour = S.div && !isSpecial(R);
  // expected among the cars the player races: their series at a Tour round, the whole field at an Open or the Masters and in a season from before the split
  const expPos = tour ? expIn(save, me.team, me.seat) : expOf(save.world.teams[me.team].expPos, me.seat), field = tour ? carsIn(save, S.div).length : FIELD;
  const open = isSpecial(R) ? openEntry(save, R) : null, exempt = open ? null : qualiExemption(S.results?.at(-1), teammateCar(save));   // a ranking decides who skips an Open, not the last podium
  const reachLcq = !!open && open.kind === 'open' && !open.seeded && S.div === 'challenger';   // an unseeded Challenger driver aims for the Last Chance first
  S.current = { round: R.round, expPos, field, exempt, objectives: objectivesFor(rng(save.seed, 'obj', season, round), expPos, me.easier, !!exempt || !!open, open && !open.seeded ? open.to : null, field, T.series.gridSize, reachLcq), quali: null, ...(open ? { open } : {}) };
  save.clock.phase = 'paddock';
}
// ---------------------------------------------------------------------------------------------- the Opens and the Masters
// An Open (Japan, India, Venice) is one round in three stages. The top 4 of the Ultrack Ranking go straight to the Final. The others (FIELD less the seeds) fly one lap at the round's qualifying venue
// (the round's qualifying), the fastest 8 race the Last Chance Qualifier there, and its top 4 reach the Final on the Open's own circuit. The Final grid is the four seeds in
// ranking order, then the four Last Chance finishers in the order they finished: a season of results buys the front rows. The Masters is the Final alone, for the top 8 of the ranking.
// cur.open = { kind, name, rank, seeds: [cars], seeded, stage: 'quali' | 'lcq' | 'final', to, lcq? }. Races the player is not in are computed from seeded laps, as a Tour qualifying is.
function openEntry(save, R) {
  const rk = rankingOf(save), mine = rk.find((x) => x.you), masters = R.kind === 'masters', n = masters ? T.series.gridSize : T.open.direct;
  return { kind: R.kind, name: R.name, rank: mine.rank, seeds: rk.slice(0, n).map((x) => x.key), seeded: mine.rank <= n, stage: masters ? 'final' : 'quali', to: masters ? `the ${R.name}` : `the ${R.name} Final` };
}
/** a race of computed cars, in the order they finish: each one's seeded lap at pace, `tag` telling this race's noise from the qualifying's */
function simRace(save, keys, tag, V) {
  const best = lapsAt(save, V, keys, save.clock.round + tag);
  return { order: [...keys].sort((a, b) => best[a] - best[b]), best };
}
/** seeded laps at a circuit for these cars; `round` is the noise key, so a qualifying lap is the same whether or not the player flies his own */
const lapsAt = (save, V, keys, round = save.clock.round) => Object.fromEntries(keys.map((key) => [key, aiLap({ seed: save.seed, season: save.clock.season, round, track: V.track, weather: V.weather, difficulty: save.rules.difficulty, key, rating: ratingOf(save, key), dev: devOf(save, key) })]));
/** the round's qualifying record when nobody flew a lap (an Open's seeds, the Masters): no laps, no duel */
const noLaps = (save) => { const mate = teammateCar(save); return { laps: {}, order: [], grid: [], pole: null, exempt: null, tries: 1, mate: { car: mate, lap: null, code: save.world.seats[mate] }, duel: { result: 'level', big: false, margin: null, skipped: true } }; };
/** the Final's grid is set: `finalists` start in this order and `rest` (best first) are the others of the field. A seeded player is skipping qualifying on merit */
function setFinal(save, finalists, rest) {
  const cur = save.season.current, o = cur.open, q = (cur.quali ??= noLaps(save)), hero = save.contract.car, at = finalists.indexOf(hero);
  Object.assign(q, { order: [...finalists, ...rest], grid: finalists, pole: finalists[0], fixed: true, exempt: o.seeded && at >= 0 ? { slot: at + 1, why: 'your ranking' } : null, duel: noLaps(save).duel });
  o.stage = 'final'; save.clock.phase = 'race';
}
/** the Last Chance Qualifier is decided (order: its eight, first to last): the Final grid is set, and the inbox says who is through */
function closeLcq(save, order, best) {
  const cur = save.season.current, o = cur.open, hero = save.contract.car, R = currentRound(save), through = order.slice(0, T.open.lcqThrough), seats = save.world.seats;
  o.lcq = { order, best, through, finish: order.includes(hero) ? order.indexOf(hero) + 1 : null };
  setFinal(save, [...o.seeds, ...through], [...order.slice(T.open.lcqThrough), ...cur.quali.order.filter((k) => !order.includes(k))]);
  const name = (k) => (k === hero ? save.player.name : personOf(save, seats[k])?.name ?? seats[k]);
  post(save, 'race', `Last Chance Qualifier: ${through.map(name).join(', ')} reach the ${R.name} Final`, `${name(order[0])} won it at ${qualiName(R)}.${through.includes(hero) ? ' You are in.' : o.seeded ? '' : ' You are out.'}`);
}
/** the week of an Open for a player who flies no lap: the Masters' top 8 are set at once, and a seed's Last Chance is run without him */
function openWeek(save) {
  const cur = save.season.current, o = cur.open;
  if (o.kind === 'masters') return setFinal(save, o.seeds, rankingOf(save).map((x) => x.key).filter((k) => !o.seeds.includes(k)));
  if (!o.seeded) return;
  const V = qualiVenue(save), field = Object.keys(save.world.seats).filter((k) => save.world.seats[k] && !o.seeds.includes(k)), laps = lapsAt(save, V, field);
  const order = field.sort((a, b) => laps[a] - laps[b]), grid = lcqOf(save, order), sim = simRace(save, grid, 'l', V);
  cur.quali = { ...noLaps(save), laps, order, grid };
  closeLcq(save, sim.order, sim.best);
}
/** the player is not in the Final (missed the cut, was beaten in the Last Chance, or is outside the Masters' top 8): the rest run it and the round is scored as a missed cut */
function absentFinal(save) {
  const cur = save.season.current, o = cur.open, hero = save.contract.car, R = currentRound(save);
  if (o.stage === 'quali') finishQuali(save, null);
  if (o.stage === 'lcq') { const sim = simRace(save, cur.quali.grid.filter((k) => k !== hero), 'l', qualiVenue(save)); closeLcq(save, sim.order, sim.best); }
  const sim = simRace(save, cur.quali.grid.filter((k) => k !== hero), 'f', R);
  return finishRace(save, { order: sim.order, best: sim.best, dnf: cur.quali.grid.includes(hero) });   // a seed who does not turn up retires on the grid
}
/**
 * The Last Chance Qualifier is raced (result as finishRace's). Through: returns its report and the Final waits. Beaten, or retired: the Final runs without him and the round's
 * report comes back, with the Last Chance report on it as `lcq`. A retirement is classified last.
 */
export function finishLcq(save, result) {
  const cur = save.season.current, o = cur.open, hero = save.contract.car, R = currentRound(save), seats = save.world.seats;
  if (o?.stage !== 'lcq') throw new Error('No Last Chance Qualifier to finish');
  logHits(save, result.hits);
  const raced = result.order.filter((k) => k !== hero), at = result.order.indexOf(hero);
  raced.splice(result.dnf || at < 0 ? raced.length : at, 0, hero);
  const through = !result.dnf && raced.indexOf(hero) < T.open.lcqThrough;
  const report = { lcq: true, round: R.round, name: 'Last Chance Qualifier', openName: R.name, track: qualiVenue(save).track, laps: R.lcqLaps, finish: raced.indexOf(hero) + 1, dnf: !!result.dnf, through, best: result.best,
    entries: raced.map((key, i) => ({ key, team: CAR[key].team, code: key === hero ? save.player.code : seats[key], you: key === hero, advanced: i < T.open.lcqThrough && !(key === hero && result.dnf) })),
    repairs: repairBill(cur.hits ?? [], hero, discount(save, 'crew'), Infinity) };   // the weekend's bill so far; it is paid out of the round's pay, with the cap
  closeLcq(save, raced, result.best);
  if (through) return report;
  const out = absentFinal(save); out.lcq = report; return out;
}
export const currentWeek = (save) => save.season?.weeks?.[save.clock.week] ?? null;
/** the round a week leads to: the next race week from it (its circuit is where that week's test or sponsor day runs) */
export const roundOfWeek = (save, i) => { const w = save.season.weeks.slice(i).find((x) => x.kind === 'race'), R = w ? save.season.calendar[w.round] : null; return save.season.weeks[i].kind === 'race' ? R : freshRound(save, R); };
/** the three Open circuits stay fresh until the Final: a test or sponsor day before one runs at the next round that is not an Open (the last one before it, if none follows) */
const freshRound = (save, R) => (R?.kind !== 'open' ? R : save.season.calendar.find((x) => x.round > R.round && x.kind !== 'open') ?? save.season.calendar.findLast((x) => x.round < R.round && x.kind !== 'open') ?? R);
/** why practice is shut, or null: an Open circuit opens at the Final, for whoever reaches it */
export const practiceLocked = (save) => { const R = currentRound(save); return R?.kind === 'open' && save.season.current.open?.stage !== 'final' ? `The ${R.name} circuit stays fresh until the Final.` : null; };
/** the deal a sponsor day serves: the signed deals take turns, by how many sponsor days came before it this season; null with none */
const dealOf = (save, week) => { const D = save.sponsors?.deals ?? [], W = save.season?.weeks ?? []; return D.length ? D[W.slice(0, Math.max(0, W.indexOf(week))).filter((w) => w.event?.kind === 'sponsor').length % D.length] : null; };
/** the Sponsor Challenge a deal (or an offer) asks for: named after it and its wish, e.g. 'Shell Overtake Challenge', with its objectives; with no deal, the team's Overtake Challenge */
export const challengeOf = (d) => { const kind = d?.target.kind ?? 'top', goals = T.side.challenge.objectives[kind]; return { name: `${d?.name ?? 'Team'} ${T.side.challenge.name[kind]} Challenge`, goals, objectives: goals.map(challengeText) }; };
/** an event's name on every screen: a done challenge keeps the name it ran under (the deals' turns shift when one is signed or ends) */
export function eventName(save, week) {
  const e = week.event; if (!e) return null;
  if (e.kind === 'test') return week.kind === 'pre' ? 'Pre-season shakedown' : 'Team test';
  return e.result?.name ?? challengeOf(dealOf(save, week)).name;
}
/** what pressing Advance would cost, in words; empty when nothing is lost */
export function advanceWarnings(save) {
  const w = currentWeek(save), i = save.clock.week, out = [], S = save.sponsors;
  if (w?.event && !w.event.result && !w.event.skipped && w.event.kind === 'sponsor' && S.deals.length) {
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
  settleChoices(save);                                       // a scene left unanswered takes its default as the week ends
  if (w.event && !w.event.result && !w.event.skipped) { w.event.skipped = true; if (w.event.kind === 'sponsor' && S.deals.length) sponsorSkipped(save); }   // already skipped: a holiday or an ad took the week
  for (const o of save.season.mid.filter((x) => x.expires === i || x.expires === undefined)) {
    if (o.rival) { rivalSigns(save, o); continue; }          // the market week was their window: the team signs its rival for next season
    save.season.mid.splice(save.season.mid.indexOf(o), 1);   // a lapse is no refusal: the team remembers nothing (6.5)
    post(save, 'deal', `${teamName(o.team)}'s offer lapsed`, 'You did not answer before the market closed.');
  }
  for (const o of S.offers.filter((x) => x.expires === i)) { S.offers.splice(S.offers.indexOf(o), 1); post(save, 'sponsor', `${o.name}'s offer lapsed`, 'You did not answer in time.'); }
  save.clock.week++;
  enterWeek(save);
  return { ok: true, week: currentWeek(save) };
}
function enterWeek(save) {
  const w = currentWeek(save), S = save.season;
  save.life.sinceOff++;                                    // the grind counts weeks since the last time off
  if (w.kind === 'race') {
    const R = S.calendar[w.round], cur = S.current; if (cur.open) openWeek(save); else if (cur.exempt) finishQuali(save, null);
    post(save, 'race', `Race week: ${R.name}`, `Round ${R.round} of ${S.calendar.length}${pointsMult(R) > 1 ? `, points ×${pointsMult(R)}` : ''}. Expected P${cur.expPos} of ${cur.field ?? FIELD}. ${weekNote(save, R)}`, { tab: 'home' });
  } else if (w.kind === 'market') {
    post(save, 'deal', 'The market is open', save.clock.season === 1 ? 'Sponsors can still talk. Teams will not: your first season is probation, and they come to you at the season end.' : 'For this one week teams can talk to you, and you can knock on their doors. Anything you sign starts next season.', { tab: 'deals' });
    sponsorOffers(save, save.clock.week + 2);   // the open week after the next round: late enough to answer, early enough to hit a target
    marketRumours(save);
  }
  poseWeek(save);
}
/** the market week's rumours (offers.js rumours): one inbox line for the seats up for renewal and one story for the first; kept for the season end (world.js marketMoves) */
function marketRumours(save) {
  const rs = (save.season.rumours = rumours(save)), name = (c) => (c === YOU ? 'you' : personOf(save, c)?.name ?? c);
  if (!rs.length) return;
  const and = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} and ${l.at(-1)}` : l[0] ?? 'nobody yet');
  post(save, 'deal', `Rumours: ${rs.length} ${rs.length === 1 ? 'seat' : 'seats'} up for renewal`, rs.map((x) => `${name(x.code)} at ${teamName(CAR[x.car].team)} is up for renewal. Shortlist: ${and(x.list.map(name))}.`).join(' '), { tab: 'deals' });
  coverRumour(save, rs[0], and(rs[0].list.map(name)));
}
/** what a race week's message adds: how the player gets to the grid */
export function weekNote(save, R) {
  const { open: o, exempt: ex } = save.season.current;
  if (!o) return `Practice is open. ${ex ? `After ${ex.why} you skip qualifying and start P${ex.slot}.` : `All ${FIELD} drivers qualify, and the fastest ${T.series.gridSize} race.`}`;
  if (o.kind === 'masters') return o.seeded ? `Ranked ${o.rank}: you are in, as one of the top ${o.seeds.length} of the Ultrack Ranking. Practice is open.` : `Ranked ${o.rank}: only the top ${o.seeds.length} of the Ultrack Ranking race the Masters. It runs without you.`;
  if (o.stage === 'final' && !o.seeded && o.lcq) return `Through the Last Chance in P${o.lcq.finish}: you start the Final. Practice is open.`;
  return o.seeded ? `Ranked ${o.rank}: straight into the Final. Practice is open.`
    : `Ranked ${o.rank}: one flying lap at ${qualiName(R)}. The fastest ${T.series.gridSize} race the Last Chance Qualifier there, and its top ${T.open.lcqThrough} reach the Final. Practice opens at the Final.`;
}
/** the player's race length (tuning.json series.lengths): every round not yet raced takes it; points and XP do not depend on it */
export function setRaceLength(save, length) {
  if (!(length in T.series.lengths)) return save;
  save.rules.raceLength = length;
  save.season?.calendar.forEach((r, i) => { if (i >= save.clock.round) { r.laps = lapsFor(r.track, length); if (r.lcqLaps) r.lcqLaps = lapsFor(r.qualiTrack ?? CAL.qualifying, length); } });
  return save;
}
export const currentRound = (save) => save.season?.calendar[save.clock.round] ?? null;
const ratingOf = (save, key) => save.world.ratings[save.world.seats[key]];
const devOf = (save, key) => save.world.teams[CAR[key].team].dev;
const myLevels = (save) => ({ ...stock(), ...save.garage.upgrades[save.contract.car] });
export const teammateCar = (save) => seatCar(save.contract.team, otherSeat(save.contract.seat));

/** a rival's pace this round: his rating, with seeded jitter */
const aiPace = (save, key, tag = []) => paceOf(ratingOf(save, key), save.rules.difficulty) * (1 + T.pace.jitter * gauss(rng(save.seed, 'pace', save.clock.season, save.clock.round, key, ...tag)));

/** who drives in qualifying: the player and, on track with him, the teammate at his race pace (an empty seat: the player alone) */
export function qualiSetup(save) {
  const hero = save.contract.car, mate = teammateCar(save), racers = driverAt(save, mate) ? [hero, mate] : [hero];
  return { racers, pace: racers[1] ? { [mate]: aiPace(save, mate) } : {}, drivers: Object.fromEntries(racers.map((k) => [k, sessionDriver(save, k)])) };
}

/** where a car qualified, of everyone (a save from before the top-eight format has only the grid) */
/** where every round qualifies, whatever its race circuit: the race map stays fresh for race day. The race's hour if the circuit has it, always dry */
export const qualiVenue = (save) => { const R = currentRound(save), look = R.look; return { track: R.qualiTrack ?? CAL.qualifying, look: look === 'day' ? 'day' : 'dusk', weather: 'dry' }; };
/** the qualifying venue's name for messages (a round from before the rotation qualifies at CAL.qualifying) */
const qualiName = (R) => trackOf(R?.qualiTrack ?? CAL.qualifying).name;
export const qualiPlace = (q, key) => (q.order ?? q.grid).indexOf(key) + 1;
/** the round's objectives as they stand: once the grid is set, none asks for places that are not there to gain */
export const roundObjectives = (save) => { const cur = save.season.current; return cur.quali ? cur.objectives.map((o) => objectiveFrom(o, qualiPlace(cur.quali, save.contract.car))) : cur.objectives; };
/** retries left this round (the screens enforce it): none for a driver who skips qualifying */
export const retriesLeft = (q) => (q.exempt || q.fixed ? 0 : Math.max(0, 1 + T.series.qualiRetries - (q.tries ?? 1)));

/** the weekend's crashes (km/h of velocity each hard hit took away, from a qualifying or the Last Chance): they are billed with the round's pay, in finishRace. Practice, test and sponsor days never call this */
export function logHits(save, hits) {
  const cur = save.season?.current; if (cur && hits?.length) (cur.hits ??= []).push(...hits.filter(Number.isFinite).map(Math.round));
}

/** qualifying is done (the player's best valid lap or null, and the teammate's lap on track or null): every driver's lap, the duel, and the fastest eight make the grid (4.3). Another try before the race keeps each driver's better lap; the other teams' laps are seeded, so they do not move, and the teammate's computed lap only stands in when he set none */
export function finishQuali(save, best, mateRun = null) {
  while (currentWeek(save).kind !== 'race' && advanceWeek(save).ok);   // qualifying belongs to a race week: anything still open is skipped
  if (save.season.current.open?.stage === 'final') return save;        // a seed or a Masters driver has no qualifying
  const held = save.season.current.quali?.laps[save.contract.car]; if (Number.isFinite(held)) best = Number.isFinite(best) ? Math.min(best, held) : held;
  const R = currentRound(save), cur = save.season.current, ex = cur.exempt, V = qualiVenue(save), base = { seed: save.seed, season: save.clock.season, round: save.clock.round, track: V.track, weather: V.weather, difficulty: save.rules.difficulty };
  const hero = save.contract.car, mate = teammateCar(save), heldMate = cur.quali?.mate.lap;
  const mateLap = Number.isFinite(mateRun) ? Math.min(mateRun, heldMate ?? Infinity) : heldMate ?? aiLap({ ...base, key: mate, rating: ratingOf(save, mate), dev: devOf(save, mate) });
  const laps = { [hero]: !ex && Number.isFinite(best) ? best : null }, seeds = cur.open?.seeds ?? [];      // an Open's seeds fly no lap: the others race for the Last Chance's places
  for (const key of Object.keys(save.world.seats)) if (key !== hero && save.world.seats[key] && !seeds.includes(key)) laps[key] = key === mate ? mateLap : aiLap({ ...base, key, rating: ratingOf(save, key), dev: devOf(save, key) });
  const mine = save.season.div && !cur.open ? new Set(carsIn(save, save.season.div)) : null;   // a Tour round of two series: the player's series makes its grid, and the other's laps stay for its own race (otherRace)
  const order = Object.keys(laps).filter((k) => !mine || mine.has(k)).sort((a, b) => (laps[a] ?? Infinity) - (laps[b] ?? Infinity)), pole = order[0];
  if (ex) { order.pop(); order.splice(ex.slot - 1, 0, hero); }     // no lap, so he sorted last: into the slot he earned. The pole stays the fastest lap
  const grid = lcqOf(save, order);
  cur.quali = { laps, order, grid, pole, exempt: ex ?? null, tries: (cur.quali?.tries ?? 0) + 1, mate: { car: mate, lap: mateLap, code: save.world.seats[mate] }, duel: ex || cur.open ? { result: 'level', big: false, margin: null, skipped: true } : duelOf(laps[hero], mateLap) };
  if (cur.open) Object.assign(cur.open, { stage: 'lcq', lcqIn: grid.includes(hero) });
  save.clock.phase = 'race';
  return save;
}
/** the grid from a qualifying order: the fastest eight; at an Open of two series, with at least lcqMin Challenger cars in the Last Chance */
const lcqOf = (save, order) => (save.season.div && save.season.current.open ? lcqGrid(order, (k) => divOf(save, CAR[k].team) === 'challenger', DIV.challenger.lcqMin) : order.slice(0, T.series.gridSize));

/**
 * What game.startSession needs for the feature race: hero, racers in grid order, AI pace per car, upgrade levels, who drives each car, and
 * how the rivals drive near the player (6.6, driver.js): ai[key] = { role, composure, seed, k } for every AI car, this race's team orders (none in an Open: its trophy is the driver's, not the team's) and
 * the teammate's car. Roles: the nemesis, then a rival (heat 40+), then the teammate; team orders go to the teammate's car whatever its role.
 */
export function raceSetup(save) {
  const R = currentRound(save), cur = save.season.current, hero = save.contract.car, stage = cur.open?.stage, lcq = stage === 'lcq', V = lcq ? qualiVenue(save) : R;   // the Last Chance is raced at the round's qualifying venue
  const racers = cur.quali?.grid ?? [hero], pace = Object.fromEntries(racers.filter((k) => k !== hero).map((key) => [key, aiPace(save, key, lcq ? ['lcq'] : [])]));
  const { nemesis, ai, mateKey, drivers, levels } = fieldOf(save, racers);
  return { hero, racers, gridOrder: cur.quali?.grid ?? null, pace, nemesis, ai, orders: cur.open ? null : ordersFor(save), mateKey, laps: lcq ? R.lcqLaps : R.laps, track: V.track, look: V.look, weather: V.weather,
    label: lcq ? 'Last Chance Qualifier' : cur.open ? (cur.open.kind === 'masters' ? R.name : `${R.name} Final`) : null, field: lcq ? `Eight cars. ${T.open.lcqThrough} places in the Final.` : cur.open ? 'Eight cars. One trophy.' : null, drivers, levels };
}
/** what every career race on track shares: the nemesis among the racers, each AI car's profile (6.6, driver.js), who drives each car and its upgrade levels */
function fieldOf(save, racers) {
  const hero = save.contract.car, lv = (dev) => ({ engine: dev[0], tyres: dev[1], brakes: dev[2], aero: aeroOf(dev), nitro: 0 });   // a rival has no Nitro bought (Hard mode fires the stock tank); every category is named, because setUpgrades keeps a level it is not told about
  const nemesis = nemesisAmong(save, racers), mateKey = teammateCar(save), W = save.world, H = save.career.heat ?? {};
  const ai = Object.fromEntries(racers.filter((k) => k !== hero).map((key) => { const code = W.seats[key];
    return [key, { role: code === nemesis?.code ? 'nemesis' : (H[code] ?? 0) >= T.rivals.rival ? 'rival' : key === mateKey ? 'mate' : null, composure: composureOf(W.ratings[code], W.ages[code]),
      seed: Math.floor(rng(save.seed, 'ai-profile', save.clock.season, save.clock.round, key)() * 2 ** 32), k: structuredClone(T.rivals.track) }]; }));
  return { nemesis, ai, mateKey, drivers: Object.fromEntries(racers.map((k) => [k, sessionDriver(save, k)])), levels: (key) => (key === hero ? myLevels(save) : lv(devOf(save, key))) };
}
/** a Sponsor Challenge's field (4.2): the teammate and the seated cars expected closest to the player, five in all, at the challenge pace; the grid best expected first, the teammate P5 and the player last */
export function challengeSetup(save) {
  const X = T.side.challenge, hero = save.contract.car, mate = teammateCar(save), exp = (k) => expOf(save.world.teams[CAR[k].team].expPos, CAR[k].seat), mine = exp(hero);
  const near = Object.keys(save.world.seats).filter((k) => k !== hero && k !== mate && save.world.seats[k]).sort((a, b) => Math.abs(exp(a) - mine) - Math.abs(exp(b) - mine) || exp(a) - exp(b));
  const withMate = !!save.world.seats[mate], others = near.slice(0, X.field - (withMate ? 1 : 0)).sort((a, b) => exp(a) - exp(b)), racers = [...others, ...(withMate ? [mate] : []), hero];
  return { racers, gridOrder: racers, mate: withMate ? mate : null, pace: Object.fromEntries(racers.filter((k) => k !== hero).map((k) => [k, aiPace(save, k, ['challenge']) * X.pace])), ...fieldOf(save, racers) };
}

// ---------------------------------------------------------------------------------------------- events (4.2, section 13)
/** this week's event, ready to drive: the next round's circuit and look, dry, the player's car, the targets */
export function sideSpec(save) {
  const w = currentWeek(save), e = w?.event; if (!e || e.result || e.skipped || save.clock.phase !== 'paddock') return null;
  const R = freshRound(save, currentRound(save)), car = save.contract.car, L = myLevels(save), par = parLap(R.track, car, 'dry', [L.engine, L.tyres, L.brakes, L.aero]);
  const base = { kind: e.kind, name: eventName(save, w), track: R.track, look: R.look, weather: 'dry', car, par };
  if (e.kind === 'test') return { ...base, targets: T.side.test.map((x) => par * x) };
  const deal = dealOf(save, w), { goals, objectives } = challengeOf(deal);
  return { ...base, deal, target: deal?.target ?? null, goals, objectives, hero: car, laps: T.side.challenge.laps, ...challengeSetup(save) };
}
/**
 * An event is done: value is the best lap (test day) or the challenge race (sponsor day: { order, bests, contacts, offTrack, totals, dnf }). Medal, XP, pay or a free upgrade level.
 * The deal a challenge serves takes its goodwill from the result: gold +1, no medal -1, kept within 1 (0 would end the deal, offers.js) and startMood + 3. Its first gold of the season is a step toward the deal's target
 */
export function finishSide(save, value) {
  const spec = sideSpec(save); if (!spec) return null;
  const met = spec.kind === 'sponsor' ? challengeMet(spec, value) : null, medal = sideMedal(spec.kind, met ?? value, spec.par), tier = TIERS.tiers[save.season.tier], d = spec.deal;
  const xp = medal ? T.side.xp[medal - 1] : 0, pay = met && medal ? round5(T.side.pay[medal - 1] * tier.sponsor * (1 + T.side.formPay * formOf(save.career.rr)) * payMult(save)) : 0;
  const credit = d && medal === 3 && !d.dayCredit && !d.met, bonus = credit ? ((d.dayCredit = true), sponsorCredit(save, d)) : 0, pkg = spec.kind === 'test' && medal === 3 ? 1 : 0, coins = pay + bonus;
  const was = d?.mood; if (d) d.mood = clamp(d.mood + (medal === 3 ? 1 : medal ? 0 : -1), 1, SPONSORS.startMood + 3);
  gainXp(save, xp); save.wallet.coins += coins; save.garage.package += pkg;
  const r = (currentWeek(save).event.result = { kind: spec.kind, value: Number.isFinite(value) ? value : null, ...(met ? { met, name: spec.name, objectives: spec.objectives } : {}), medal, xp, coins, package: pkg });
  const lines = [xp ? `+${xp} XP` : null, coins ? `+${coins.toLocaleString('en')} U` : null, pkg ? 'a free upgrade level, in the Garage' : null, credit ? `a step toward ${d.name}'s target` : null, d ? `${d.name} goodwill ${d.mood > was ? 'up to' : d.mood < was ? 'down to' : 'stays at'} ${d.mood}` : null];
  post(save, 'event', `${spec.name}: ${met ? `${medal}/${met.length}, ` : ''}${['no medal', 'bronze', 'silver', 'gold'][medal]}`, lines.filter(Boolean).join(', ') || 'Nothing earned this time.', pkg ? { tab: 'garage' } : null);
  return r;
}

// ---------------------------------------------------------------------------------------------- the race
/**
 * The feature race is done. result: { order: [car keys, finishing order], best: { key: seconds | null }, dnf, crashes, spins, pro, contacts: { key: n | [km/h] }, passes: { key: n } (the two heat rivals, 6.6),
 *   orders: { kind: 'toMate', obeyed } | null (the player was told to let the teammate by: obeying earns trust, ignoring costs trust and heats the teammate) }.
 * Scores the round (points, Round Rating, XP, REP, trust, objectives, money, rivals), stores it, opens the mid-season market after the
 * middle round, and moves on to the next week or the season review. Returns the round report the results screen shows.
 * The classification is everyone: the race, then those who missed the cut in qualifying order, the player among them if he did.
 */
export function finishRace(save, result) {
  const R = currentRound(save), S0 = save.season, cur = S0.current, me = save.contract, hero = me.car, tier = S0.tier, seats = save.world.seats, kind = R.kind ?? 'tour', E = T.events[kind];
  if (cur.open && cur.open.stage !== 'final') return absentFinal(save);   // an Open whose Final was never reached (a reload mid-weekend): it runs without him
  if (!cur.quali) finishQuali(save, null);                  // never qualified (a reload mid-weekend): no lap, so no race
  settleChoices(save);                                       // the race week ends: a scene still open takes its default before the race is scored
  const divided = !!S0.divs, tourDiv = divided && kind === 'tour', other = tourDiv ? otherRace(save) : null, rw = tourDiv && S0.div === 'challenger' ? DIV.challenger.reward : 1;
  const dnq = !cur.quali.grid.includes(hero), at = result.order.indexOf(hero), raced = result.order.filter((k) => k !== hero);
  if (!dnq) raced.splice(result.dnf || at < 0 ? raced.length : at, 0, hero);   // a retirement is classified last of those who raced
  const order = [...raced, ...(cur.quali.order ?? cur.quali.grid).filter((k) => !raced.includes(k))];
  const finish = order.indexOf(hero) + 1, grid = qualiPlace(cur.quali, hero), poleKey = cur.quali.pole ?? cur.quali.grid[0], pole = poleKey === hero, judged = cur.quali.exempt ? { grid: cur.expPos } : {};   // a slot he did not qualify for earns no qualifying XP
  const fastLap = Math.min(...Object.values(result.best).filter(Number.isFinite)), fastestKey = Object.keys(result.best).find((k) => result.best[k] === fastLap);
  const dnf = !!result.dnf, fastest = fastestKey === hero && !dnf, clean = !dnq && (result.spins ?? 0) === 0 && (result.crashes ?? 0) <= 1, duel = cur.quali.duel;
  // points (4.4): per entry, the finale x1.5, pole +2, fastest lap +1; a retirement scores no place and no fastest lap, a reserve driver nothing in rounds 1-2 (6.7)
  // with two series an Open or the Masters scores no series points, only the ranking's (rpts); every entry carries its series and its expected place at race time
  const P = T.series, mult = pointsMult(R, divided), bench = me.reserve && R.round <= 2, cupless = divided && isSpecial(R);
  const entries = order.map((key, i) => ({ key, team: CAR[key].team, code: key === hero ? save.player.code : seats[key], you: key === hero, dnq: i >= raced.length,
    pts: cupless || i >= raced.length ? 0 : key === hero && bench ? 0 : (key === hero && dnf ? 0 : (P.points[i] ?? 0) * mult + (fastestKey === key ? P.fastestLap : 0)) + (poleKey === key ? P.pole : 0),
    div: divOf(save, CAR[key].team), exp: tourDiv ? expIn(save, CAR[key].team, CAR[key].seat) : expOf(save.world.teams[CAR[key].team].expPos, CAR[key].seat),
    ...(cupless ? { rpts: i >= raced.length || (key === hero && dnf) ? 0 : rankPoints(i, kind) } : {}) }));
  const x = { expPos: cur.expPos, grid, finish, fastest, clean, duel, dnf, dnq, lcqIn: !!cur.open?.lcqIn };
  const objectives = cur.objectives.map((o) => objectiveFrom(o, grid)).map((o) => ({ ...o, met: objectiveMet(o, x) }));
  const mandatory = objectives[0].met, optional = objectives.slice(1).filter((o) => o.met).length;
  const field = divided ? cur.field : DIV.legacyField, rating = roundRating({ ...x, exempt: !!cur.quali.exempt, underdog: me.underdog, rookie: TIERS.tiers[tier].rank === 1, field });
  const myExp = cur.expPos, myRank = TIERS.tiers[tier].rank;   // giant-killing: beating an entry expected ahead from a higher tier, or (at an Open or the Masters) from the Elite while racing in the Challenger
  const giantKills = dnf || dnq ? 0 : entries.slice(finish).filter((e) => (tierOf(e.team).rank > myRank || (e.div === 'elite' && S0.div === 'challenger')) && e.exp < myExp).length;
  const rivals = heatAfter(save, raced, hero, dnf, { contacts: result.contacts ?? {}, passes: result.passes ?? {}, duel: duel.skipped || dnq ? null : cur.quali.mate.code });   // the qualifying duel heats the teammate, only in a round the player raced
  const xp = xpFor({ ...x, ...judged, pole, mandatory, optional, tier, pro: result.pro, underdog: me.underdog, field, reward: rw });
  if (rivals.xp) { xp.lines.push(['Nemesis beaten', rivals.xp]); xp.xp += rivals.xp; }
  const call = settleCallout(save, order, hero, dnf);        // an accepted callout (choices.js) pays once
  if (call?.xp) { xp.lines.push(['Callout won', call.xp]); xp.xp += call.xp; }
  const happyXp = Math.round(xp.xp * (xpMult(save) - 1)); if (happyXp > 0) { xp.lines.push([mood(save).name, happyXp]); xp.xp += happyXp; }   // life.js: a driver on top of the world learns a little faster
  const rep = repFor({ rr: rating.rr, tier, finish, pole, fastest, giantKills, dnf });
  if (E.rep !== 1) { rep.lines = rep.lines.map(([l, v]) => [l, v > 0 ? Math.round(v * E.rep) : v]); rep.rep = rep.lines.reduce((a, l) => a + l[1], 0); }   // an Open or the Masters pays reputation, never costs more of it
  rep.lines.push(...rivals.lines); rep.rep += rivals.rep;
  if (call) { rep.lines.push([`Callout ${call.won ? 'won' : 'lost'}: ${call.name}`, call.rep]); rep.rep += call.rep; }
  const happyRep = Math.round(rep.rep * (repMult(save) - 1)); if (happyRep > 0) { rep.lines.push([mood(save).name, happyRep]); rep.rep += happyRep; }   // a happy driver is talked about more; a bad round costs the same in any mood
  const ord = result.orders?.kind === 'toMate' && typeof result.orders.obeyed === 'boolean' && !dnq ? result.orders : null, ordTrust = ord ? (ord.obeyed ? T.trust.orders.obeyed : -T.trust.orders.ignored) : 0;
  const rawTrust = trustFor({ rr: rating.rr, mandatory, optional, duel, neutral: dnq && !!cur.open }), trust = (rawTrust > 0 ? Math.floor(rawTrust * trustMult(save)) : rawTrust) + ordTrust;   // the mood scales trust gains: half speed when frustrated, faster on top of the world
  // money (5.5): salary, the race prize x the tier's multiplier, objective and contract bonuses, sponsors
  const Tr = TIERS.tiers[tier], coins = [['Salary', me.salary]];
  for (const [label, v] of rewardFor({ mode: 'race', pos: finish, cars: raced.length, laps: R.laps, finished: !dnf && !dnq, retired: dnf || dnq, fastest }).lines) coins.push([label, round5(v * Tr.prize * E.prize * rw)]);
  if (mandatory) coins.push(['Round objective', Tr.objective[0]]);
  if (optional) coins.push(['Bonus objectives', optional * Tr.objective[1]]);
  if (!dnf && finish === 1) coins.push(['Win bonus', Tr.bonus.win * E.prize * rw]); else if (!dnf && finish <= 3) coins.push(['Podium bonus', Tr.bonus.podium * E.prize * rw]);
  coins.push(...sponsorRound(save, x, targetMet));
  // repairs (Part 2): every hard hit of the weekend's qualifying, Last Chance and race, less the crew's share, never more than 40 % of what the round paid and never below an empty wallet
  const gross = coins.reduce((s, l) => s + Math.max(0, l[1]), 0), fix = repairBill([...(cur.hits ?? []), ...(result.hits ?? [])], hero, discount(save, 'crew'), gross);   // the bill is under 40 % of the pay, so the wallet cannot go below what it held
  if (fix.bill) coins.push([`Repairs: ${fix.hits} ${fix.hits === 1 ? 'hit' : 'hits'}`, -fix.bill]);
  const earned = coins.reduce((s, l) => s + l[1], 0);
  // apply
  const clBefore = save.career.cl;
  gainXp(save, xp.xp); save.career.rep = clamp(save.career.rep + rep.rep, 0, 1000);
  save.career.rr = [...save.career.rr, rating.rr].slice(-6); me.trust = clamp(me.trust + trust, 0, 100);
  if (!duel.skipped) me.duel[duel.result]++; save.wallet.coins += earned;
  const mateCode = seats[teammateCar(save)];
  if (ord && !ord.obeyed && mateCode) { heatUp(save, mateCode, T.rivals.ordersIgnored, 'orders'); coverOrders(save, mateCode, me.team); }
  if (ord) note(save, ord.obeyed ? 'orders_obeyed' : 'orders_ignored', { who: mateCode ?? null, team: me.team });   // the principal quotes it at the season end (media.js coverPrincipal)
  if (me.warning) {                                          // the seat review's recovery objective: the round objective, twice running (6.7)
    me.warning.left--; if (mandatory) me.warning.met++;
    if (me.warning.met >= T.trust.recover) me.warning = null;
  }
  const S = save.stats; if (!dnq) S.starts++; if (!dnf && finish === 1) S.wins++; if (!dnf && finish <= 3) S.podiums++; if (pole) S.poles++; if (fastest) S.fastest++;
  const rankBefore = playerRank(save), day = {};              // the Ultrack Ranking: points by place for those who raced, a retirement scoring none
  entries.forEach((e, i) => { if (!e.dnq && !(e.you && dnf)) day[seats[e.key]] = rankPoints(i, kind); });
  other?.entries.forEach((e, i) => { if (!e.dnq) day[e.code] = rankPoints(i, kind); });   // the same day in the other series
  addDay(save, day);
  const report = { round: R.round, track: R.track, name: R.name, kind, finale: R.finale, laps: R.laps, finish, grid, expPos: cur.expPos, ...(divided ? { field: cur.field } : {}), dnf, dnq, pole, fastest, clean,
    rr: rating.rr, rrLines: rating.lines, xp: xp.xp, xpLines: xp.lines, rep: rep.rep, repLines: rep.lines, trust, coins: earned, coinLines: coins, repairs: fix,
    objectives, duel: { ...duel, mine: cur.quali.laps[hero], mate: cur.quali.mate.lap, mateCar: cur.quali.mate.car, mateCode: cur.quali.mate.code },
    entries, best: result.best, levelUp: save.career.cl > clBefore ? save.career.cl : null, rivals: rivals.lines, orders: ord && { obeyed: ord.obeyed, trust: ordTrust },
    nemesis: rivals.nemesis && { code: rivals.nemesis.code, name: personOf(save, rivals.nemesis.code)?.name ?? rivals.nemesis.code, beat: rivals.nemesis.beat },
    rank: { before: rankBefore, after: playerRank(save), pts: day[YOU] ?? 0 }, ...(other ? { other } : {}), ...(cur.open ? { open: { name: cur.open.name, to: cur.open.to, seeded: cur.open.seeded, rank: cur.open.rank, lcq: cur.open.lcq?.finish ?? null, lcqAt: qualiName(R) } } : {}) };
  if (cur.open) recordOpen(save, R, entries[0], report);
  save.season.results.push(report);
  const press0 = save.mediaN ?? 0;
  coverRound(save, report); if (cur.open) coverOpen(save, report);
  report.life = settleLife(save, report, press0, fix.bill, gross, rivals.lines.length > 0);
  const wk = currentWeek(save); wk.result = { finish, rr: rating.rr, dnf, dnq };
  post(save, 'race', `Round ${R.round}: ${dnq ? `did not qualify, P${grid}` : `${dnf ? 'retired' : `P${finish}`} from P${grid}`}, rating ${rating.rr.toFixed(1)}`, `+${xp.xp} XP, +${earned.toLocaleString('en')} U, reputation ${rep.rep >= 0 ? '+' : ''}${rep.rep}, trust ${trust >= 0 ? '+' : ''}${trust}.`);
  if (report.levelUp) post(save, 'news', `Career Level ${report.levelUp}`, 'Better upgrades and more teams open up as your level rises.', { tab: 'garage' });
  save.clock.round++;
  const n = save.season.calendar.length;
  if (save.clock.round === Math.ceil(n / 2) && save.clock.round < n) {
    report.midSeason = midSeason(save);
    if (report.midSeason.warning) coverHotSeat(save, me.team);
    if (report.midSeason.warning) post(save, 'warn', 'Seat review', `Team trust is ${me.trust}. Meet the round objective in the next ${T.trust.recover} rounds, or a low trust at the finale costs you the seat.`);
  }
  save.clock.week++;
  if (save.clock.round < n) { prepareRound(save); enterWeek(save); } else endSeason(save);
  return report;
}

/**
 * The mood after a race week (life.js): fan support and happiness move, a driver on top of the world or at the end of his tether makes the papers, and an unhappy one may lose a
 * sponsor (seeded). It reads what happened and moves no lap time, no rival and no car.
 */
function settleLife(save, report, press0, bill, gross, feud) {
  const me = save.contract, news = (save.media ?? []).filter((m) => m.id > press0), before = mood(save).id, R = currentRound(save);
  const good = news.filter((m) => ['win', 'podium'].includes(m.you)).length, bad = news.filter((m) => ['down', 'dnq', 'fired'].includes(m.you) || m.scene === 'fan-hate').length;
  const out = settleRound(save, { rr: report.rr, finish: report.finish, dnf: report.dnf, dnq: report.dnq, open: !!report.open, clean: report.clean, duel: report.duel, feud,
    home: isHome(save, R.track) && !report.dnq, press: { good, bad }, bill, gross, trust: me.trust, tier: save.season.tier, form: formOf(save.career.rr), expTeam: save.world.teams[me.team].expPos });
  const now = mood(save).id, r = rng(save.seed, 'life', save.clock.season, R.round, 'round');
  if (now === 'unhappy') {
    if (before !== 'unhappy') post(save, 'warn', 'You are unhappy', 'Your results and your life are weighing on you. Time off, a good result or a treat will lift it, and you can ask for a transfer in the Life tab.', { tab: 'life' });
    if (before !== 'unhappy' || r() < LIFE.unhappy.story) coverLife(save, 'mood-unhappy');
    const gone = r() < LIFE.unhappy.walk ? sponsorWalks(save) : null; if (gone) out.walked = gone;
  } else if (now === 'top' && (before !== 'top' || r() < LIFE.unhappy.story)) coverLife(save, 'mood-top');
  return out;
}
/** the season's upkeep (life.js): paid from the wallet at the season start, and whatever the wallet cannot cover is sold at half price, so nobody falls into debt */
function upkeep(save) {
  const up = payUpkeep(save);
  if (up.paid) post(save, 'news', `Upkeep paid: ${up.paid.toLocaleString('en')} U`, 'What you own costs money every season.', { tab: 'life' });
  for (const id of up.sold) {
    const x = itemOf(id); post(save, 'warn', `The ${x.name.toLowerCase()} was sold`, `You could not cover its upkeep, so it was sold for ${Math.round(x.price * LIFE.upkeep.sellBack).toLocaleString('en')} U, half its price.`, { tab: 'life' });
    coverLife(save, 'sold', { item: x.name.toLowerCase() });
  }
}

/**
 * The other series' race at a Tour round (divisions-spec 4): its cars by the qualifying laps finishQuali drew for every seated car, the fastest eight racing
 * on seeded laps at the round's circuit (noise key 'o'), the rest classified behind in lap order. Points as the player's race: the places, pole +2, fastest lap +1
 */
function otherRace(save) {
  const S = save.season, R = currentRound(save), q = S.current.quali, P = T.series, d = DIV.order.find((x) => x !== S.div), seats = save.world.seats;
  const keys = carsIn(save, d).sort((a, b) => (q.laps[a] ?? Infinity) - (q.laps[b] ?? Infinity)), grid = keys.slice(0, P.gridSize), sim = simRace(save, grid, 'o', R);
  const fast = grid.reduce((a, k) => (sim.best[k] < sim.best[a] ? k : a), grid[0]);
  return { div: d, entries: [...sim.order, ...keys.slice(P.gridSize)].map((key, i) => ({ key, team: CAR[key].team, code: seats[key], you: false, dnq: i >= grid.length,
    pts: (i < grid.length ? P.points[i] + (key === fast ? P.fastestLap : 0) : 0) + (key === keys[0] ? P.pole : 0), div: d, exp: expIn(save, CAR[key].team, CAR[key].seat) })) };
}
/** the player missed the cut and sits the round out: the eight race without him, in qualifying order with seeded shuffling */
export function finishDnq(save) {
  if (save.season.current.open) return absentFinal(save);
  const q = save.season.current.quali, { season, round } = save.clock;
  const run = Object.fromEntries(q.grid.map((k) => [k, q.laps[k] * (1 + T.quali.dnqRaceSigma * gauss(rng(save.seed, 'dnq', season, round, k)))]));
  return finishRace(save, { order: [...q.grid].sort((a, b) => run[a] - run[b]), best: {} });
}

/** an Open or the Masters is won: the hall of winners (rivals win too), the player's Open wins, the Triple Crown (all three Opens, ever) and the Grand Slam (all three in one season) */
function recordOpen(save, R, win, report) {
  report.honours = [];
  const S = save.stats, you = win.you, d = you ? save.player : personOf(save, win.code), id = R.kind === 'masters' ? 'masters' : R.track;
  save.hall.push({ season: save.clock.season, id, name: R.name, code: you ? YOU : win.code, who: you ? save.player.name : d?.name ?? win.code, nation: d?.nation, team: win.team, you });
  save.hall = save.hall.slice(-60);
  if (!you) return;
  if (id === 'masters') { S.masters++; return; }
  S.openWins[id] = (S.openWins[id] ?? 0) + 1; const won = (save.season.openWins ??= []), ids = Object.keys(CAL.opens);
  if (!won.includes(id)) won.push(id);
  if (!S.triple && ids.every((x) => S.openWins[x] > 0)) { S.triple = save.clock.season; report.honours.push('triple'); }
  if (ids.every((x) => won.includes(x)) && !save.season.slam) { save.season.slam = true; S.slams++; report.honours.push('slam'); }
}

// ---------------------------------------------------------------------------------------------- standings
/**
 * The Drivers', Teams' and tier Cup tables from the rounds raced (4.4), sorted, with the player's rows flagged. With two series, series `d`'s tables
 * (the player's by default): its Tour rounds, the player's race or the computed other one (report.other), each counting its own wins; the Opens and the
 * Masters score none (D1). Ties go to wins, then the expected place, then the id. A season from before the split ('all') has one table of everyone
 */
export function standings(save, d = save.season?.div ?? 'all') {
  const D = {}, Tm = {}, divided = d !== 'all';
  const lists = (r) => (!divided ? [r.entries] : (r.kind ?? 'tour') !== 'tour' ? [] : [r.entries, r.other?.entries ?? []].filter((l) => l[0]?.div === d));
  for (const r of save.season?.results ?? []) for (const l of lists(r)) for (const e of l) {
    const x = (D[e.you ? YOU : e.code] ??= { code: e.code, you: e.you, team: e.team, name: e.you ? save.player.name : personOf(save, e.code)?.name ?? e.code, pts: 0, wins: 0 });
    x.pts += e.pts; x.team = e.team; if (l[0] === e) x.wins++;
    const t = (Tm[e.team] ??= { team: e.team, pts: 0, wins: 0, you: save.contract?.team === e.team }); t.pts += e.pts; if (l[0] === e) t.wins++;
  }
  for (const id of teamsIn(save, d)) Tm[id] ??= { team: id, pts: 0, wins: 0, you: save.contract?.team === id };
  const sort = (l) => l.sort((a, b) => b.pts - a.pts || b.wins - a.wins || (save.world.teams[a.team].expPos - save.world.teams[b.team].expPos) || (a.team < b.team ? -1 : a.team > b.team ? 1 : 0));
  const teams = sort(Object.values(Tm)), tier = save.season?.tier;
  return { ...(divided ? { div: d } : {}), drivers: sort(Object.values(D)), teams, cup: teams.filter((t) => TIERS.teams[t.team].tier === tier) };   // cup: the tier's teams, the old Cup (a season from before the split awards it)
}

// ---------------------------------------------------------------------------------------------- the season end
function endSeason(save) {
  const st = standings(save), me = save.contract, rs = save.season.results, S = save.sponsors, div = save.season.div, W = save.world.teams;
  const teamPos = st.teams.findIndex((t) => t.team === me.team) + 1, cupPos = st.cup.findIndex((t) => t.team === me.team) + 1, drvPos = st.drivers.findIndex((d) => d.you) + 1;
  let rep = 0, coins = 0, swap = null, yourTeam = null, order = null;
  if (div) {                                                 // two series (divisions-spec 5, 6): the Challenger's Teams' champion goes up, the Elite's last team comes down; drivers move only by contract
    const E = standings(save, 'elite').teams, Ch = standings(save, 'challenger').teams;
    swap = { up: Ch[0].team, down: E.at(-1).team }; W[swap.up].div = 'elite'; W[swap.down].div = 'challenger';
    yourTeam = me.team === swap.up ? 'up' : me.team === swap.down ? 'down' : null;
    if (div === 'elite') { if (drvPos === 1) { rep += T.rep.drivers; save.stats.titles++; } if (teamPos === 1) rep += T.rep.teams; }
    else if (drvPos === 1) { rep += T.rep.challenger; coins += TIERS.tiers[save.season.tier].bonus.cup; save.stats.cups++; }   // the Challenger title pays what the old tier Cup did
    if (yourTeam === 'up') { rep += T.rep.cup; save.stats.promotions = (save.stats.promotions ?? 0) + 1; }
    if (yourTeam === 'down') save.stats.relegations = (save.stats.relegations ?? 0) + 1;   // no penalty: the Round Ratings already judged the year
    order = [...E, ...Ch].map((t) => t.team);   // next season's expected places blend this table (nextSeasonWorld)
  } else {
    if (cupPos === 1) { rep += T.rep.cup; coins += TIERS.tiers[save.season.tier].bonus.cup; save.stats.cups++; }
    if (teamPos === 1) rep += T.rep.teams;
    if (drvPos === 1) { rep += T.rep.drivers; save.stats.titles++; }
  }
  // the seat review at the finale (6.7): under 15, or under 25 with a warning not recovered, the team lets you go; a Legend driver rated like one the team would re-sign stays (holdsSeat)
  const dropped = !me.next && (me.trust < T.trust.dropAny || (me.trust < T.trust.drop && !!me.warning)) && !holdsSeat(save);
  if (dropped) { rep += T.rep.dropped; me.dropped = true; }
  save.career.rep = clamp(save.career.rep + rep, 0, 1000); save.wallet.coins += coins;
  const avgRR = mean(rs.map((r) => r.rr));
  save.history.push({ season: save.clock.season, team: me.team, seat: me.seat, car: me.car, tier: save.season.tier, drivers: drvPos, teams: teamPos, cup: cupPos,
    points: st.drivers[drvPos - 1]?.pts ?? 0, rank: playerRank(save), opens: [...(save.season.openWins ?? [])], avgRR: Math.round(avgRR * 10) / 10, duel: { ...me.duel }, teamOrder: order ?? st.teams.map((t) => t.team), dropped,
    ...(swap ? { div, teamCount: st.teams.length, swap } : {}) });
  for (const d of S.deals) if (!d.met) post(save, 'sponsor', `${d.name}: target missed`, `You did not ${targetText(d.target)}. No bonus this year.`);
  for (const o of save.season.mid.splice(0)) { post(save, 'deal', `${teamName(o.team)}'s offer lapsed`, 'You did not answer before the season ended.'); }
  S.deals = []; S.offers = []; save.season.asked = {};       // a sponsor signs for one season; each window's doors open again
  save.pending = { review: { drivers: drvPos, driverCount: st.drivers.length, teams: teamPos, cup: cupPos, rep, coins, avgRR, dropped, trust: me.trust, rank: playerRank(save), rankOf: rankingOf(save).length,
    ...(swap ? { div, teamCount: st.teams.length, swap: { ...swap }, yourTeam, nextDiv: W[me.team].div } : {}) },
  offers: seasonOffers(save, swap ? { cup: teamPos === 1, title: drvPos === 1, dropped } : { cup: cupPos === 1, title: drvPos === 1, dropped }) };   // with two series: the player's series' Teams' and Drivers' titles; the offers see next season's series
  save.clock.phase = 'review';
  if (!me.next) openWindow(save);
  if (dropped) coverFired(save, me.team); else coverPrincipal(save, me.team);
  post(save, dropped ? 'warn' : 'race', `Season ${save.clock.season} is over: P${drvPos} in the Drivers'`, dropped ? `${teamName(me.team)} has let you go.` : 'The review and the market are waiting.');
}

/** between seasons (6.8, 2.3): AI development, the driver market, expected finishes from the Teams' table. before: the seats before the player signed; moved: the driver they displaced and the seat they left */
function nextSeasonWorld(save, before, moved) {
  const W = save.world, h = save.history.at(-1), cat = (save.clock.season - 1) % 3, order = [1, 0, 2][cat], gone = W.retired.length;   // tyres, engine, brakes in turn
  for (const id of TEAM_IDS) { const t = W.teams[id], cap = tierOf(id).cap; t.dev[order] = Math.min(cap, t.dev[order] + 1); }
  const ev = marketMoves(save, moved);
  coverMoves(save, before, W.retired.slice(gone), ev);
  if (h) h.market = { sacked: ev.sacked.length, poached: ev.poached.length };
  if (h?.teamOrder) {
    const v = Object.fromEntries(TEAM_IDS.map((id) => [id, 0.5 * W.teams[id].expPos + 0.5 * ((W.teams[id].joined !== h.season && h.teamOrder.indexOf(id) + 1) || W.teams[id].expPos)]));   // a team that joined during the season or after the table (addTeams) holds its place
    [...TEAM_IDS].sort((a, b) => v[a] - v[b] || W.teams[a].expPos - W.teams[b].expPos).forEach((id, i) => { W.teams[id].expPos = i + 1; });
  }
  for (const id of TEAM_IDS) delete W.teams[id].joined;
  save.clock.season++; save.clock.week = 0;
  for (const code of W.retired.slice(gone)) post(save, 'news', `${personOf(save, code)?.name ?? code} has retired`, 'A seat has opened in the market.');
}

// ---------------------------------------------------------------------------------------------- XP, upgrades
function gainXp(save, n) { save.career.xp += n; save.career.cl = levelOf(save.career.xp); }
/** what the next level of `cat` costs on the career car, and why it cannot be bought (cap by tier, CL gate, coins); a team package level is free */
export function upgradeInfo(save, cat, hp) {
  const car = save.contract.car, cur = save.garage.upgrades[car]?.[cat] ?? 0, cap = TIERS.tiers[TIERS.teams[save.contract.team].tier].cap;
  const next = cur + 1, free = (save.garage.package ?? 0) > 0, off = discount(save, 'engineer'), list = next <= MAX_LEVEL ? costOf(hp, next) : null, cost = list === null ? null : free ? 0 : round5(list * (1 - off)), gate = T.upgrades.clGate[next - 1];
  const reason = next > MAX_LEVEL ? 'maxed' : next > cap ? 'cap' : free ? null : save.career.cl < gate ? 'level' : save.wallet.coins < cost ? 'coins' : null;
  return { level: cur, next, cost, list, off, cap, gate, free, reason };   // list: the price before the engineer's share
}
export function buyUpgrade(save, cat, hp) {
  if (!CATS.some(([c]) => c === cat)) return { ok: false, reason: 'unknown' };
  const u = upgradeInfo(save, cat, hp); if (u.reason) return { ok: false, ...u };
  const car = save.contract.car;
  save.wallet.coins -= u.cost; save.garage.upgrades[car] = { ...stock(), ...save.garage.upgrades[car], [cat]: u.next };
  save.garage.paid[car] = (save.garage.paid[car] ?? 0) + u.cost;
  if (u.free) save.garage.package--;
  return { ok: true, ...u, level: u.next };
}

// ---------------------------------------------------------------------------------------------- the Shop (life.js)
/** the brand of a sponsor ad: a seeded pick from the brands at the player's tier or below (assets/career/sponsors.json); the sponsor list has no exclusive deals, so none can clash */
const adBrand = (save, id) => {
  const rank = TIERS.tiers[save.season.tier].rank, pool = Object.keys(SPONSORS.brands).filter((b) => TIERS.tiers[SPONSORS.brands[b].tier].rank <= rank);
  return pool[Math.floor(rng(save.seed, 'ad', save.clock.season, save.clock.week, id)() * pool.length)];
};
/**
 * Can the player buy Shop item `id` now? { ok, reason, item, ... } where reason is one of 'unknown', 'max' (owns the most allowed), 'coins', 'week' (an activity needs an open week),
 * 'taken' (this week's activity is booked), 'rep' (an ad deal wants more reputation), 'cap' (an ad deal done as often as a season allows). An ad also carries its pay and brand;
 * `skips` is the optional event that would be given up.
 */
export function lifeInfo(save, id) {
  const item = itemOf(id); if (!item) return { ok: false, reason: 'unknown' };
  const L = save.life, w = currentWeek(save), slot = save.clock.phase === 'paddock' && !!w?.event, ad = item.type === 'ad', luxury = item.type === 'luxury';
  const pay = ad ? adPay(save, item, formOf(save.career.rr)) : 0, brand = ad ? adBrand(save, id) : null, ev = slot && item.skips && !w.event.result && !w.event.skipped ? w.event : null;
  const reason = luxury ? (ownedN(save, id) >= LIFE.repeat.max ? 'max' : save.wallet.coins < item.price ? 'coins' : null)
    : !slot ? 'week' : w.activity ? 'taken' : ad ? (save.career.rep < item.minRep ? 'rep' : (L.ads[id] ?? 0) >= item.cap ? 'cap' : null) : save.wallet.coins < item.price ? 'coins' : null;
  return { ok: !reason, reason, item, price: item.price ?? 0, pay, brand, boost: boostOf(save, item), skips: ev ? (ev.kind === 'test' ? 'test day' : 'sponsor day') : null, upset: !!ev && item.type === 'off' && ev.kind === 'sponsor' && save.sponsors.deals.length > 0 };
}
/** buy a Shop item: a luxury any time, an activity in an open week (one a week); the lift, the press, a party's chance of a scandal. Returns lifeInfo's answer plus { scandal } */
export function buyLife(save, id) {
  const q = lifeInfo(save, id); if (!q.ok) return q;
  const { item } = q, L = save.life, w = currentWeek(save), r = rng(save.seed, 'life', save.clock.season, save.clock.week, id), out = { ...q, scandal: null };
  if (item.type === 'ad') { save.wallet.coins += q.pay; L.ads[id] = (L.ads[id] ?? 0) + 1; } else save.wallet.coins -= item.price;
  lift(save, q.boost, item.fans ?? 0);
  if (item.rep) save.career.rep = clamp(save.career.rep + item.rep, 0, 1000);
  if (item.type === 'luxury') L.owned[id] = ownedN(save, id) + 1; else w.activity = { id, brand: q.brand };
  if (item.type === 'off') L.sinceOff = 0;
  if (q.skips) { w.event.skipped = true; if (q.upset) sponsorSkipped(save); }     // a holiday on a sponsor day costs goodwill like any other no-show; an ad is work, and does not
  coverLife(save, id, { brand: q.brand && SPONSORS.brands[q.brand].name });
  if (item.scandal && r() < item.scandal) {
    const hit = r() < 0.5 ? sponsorUpset(save, r()) : null;
    if (hit) coverLife(save, 'scandal-sponsor', { brand: hit }); else { save.contract.trust = clamp(save.contract.trust - item.trust, 0, 100); coverLife(save, 'scandal-trust'); }
    lift(save, -3, -4); out.scandal = hit ? { sponsor: hit } : { trust: item.trust };
    post(save, 'warn', 'The pictures got out', hit ? `${hit} did not like them. Fan support dropped.` : `${teamName(save.contract.team)} did not like them (trust -${item.trust}). Fan support dropped.`, { tab: 'life' });
  }
  return out;
}
/** the unhappy driver's way out: ask for a transfer (offers.js). The offers arrive through the mid-season market */
export function demandMove(save) {
  const r = demandTransfer(save); if (r.ok) coverLife(save, 'demand');
  return r;
}
