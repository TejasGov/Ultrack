// The career's formulas (docs/career-mode.md 2-6), pure functions over plain data, economy.js style: no DOM, no save, runs in node.
// Every constant comes from assets/career/*.json; career.js strings them into a season.
import TUNING from '../../../../assets/career/tuning.json';
import TIERS from '../../../../assets/career/tiers.json';
import CAL from '../../../../assets/career/calendar.json';
import DRIVERS from '../../../../assets/career/drivers.json';
import SPONSORS from '../../../../assets/career/sponsors.json';
import TEAMS from '../../../../assets/teams/teams.json';
import { rng, gauss, shuffle } from './rng.js';

export { TUNING, TIERS, CAL, DRIVERS, SPONSORS };
const T = TUNING;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0);

// ---------------------------------------------------------------------------------------------- teams, seats, drivers
export const TEAM_IDS = Object.keys(TIERS.teams);
export const teamInfo = (id) => TIERS.teams[id];
export const tierOf = (id) => TIERS.tiers[TIERS.teams[id].tier];
const LORE = Object.fromEntries(TEAMS.teams.map((t) => [t.id, t]));
export const loreOf = (id) => LORE[id];
/** car key -> { team, driver (teams.json), seat 'A' | 'B' } */
export const CAR = Object.fromEntries(TEAMS.teams.flatMap((t) => t.cars.map((c) => [c.key, { team: t.id, driver: c.driver, number: c.number, seat: TIERS.teams[t.id].A === c.key ? 'A' : 'B' }])));
export const seatCar = (team, seat) => TIERS.teams[team][seat];
export const otherSeat = (seat) => (seat === 'A' ? 'B' : 'A');
/** expected place of a driver among the 16: the teams in their expected order, A seat then B (6.1) */
export const expOf = (expPos, seat) => clamp((expPos - 1) * 2 + (seat === 'B' ? 2 : 1), 1, 16);

// ---------------------------------------------------------------------------------------------- levels
export const xpForLevel = (L) => Math.round(T.xp.curve[0] * (L - 1) ** T.xp.curve[1]);
export function levelOf(xp) { let L = 1; while (L < T.xp.maxLevel && xp >= xpForLevel(L + 1)) L++; return L; }
export const formOf = (rrs) => { const a = avg(rrs.slice(-3)); return rrs.length ? T.form.find(([min]) => a >= min)[1] : 0; };

// ---------------------------------------------------------------------------------------------- pace, laps
/** the Hard mode setting (store.js hardMode; game.js applySettings): rivals a little quicker in the race and on the qualifying clock alike */
let hardPace = 1;
export const hardPaceFor = (on) => (on ? T.pace.hardMode : 1);
export const setHardMode = (on) => { hardPace = hardPaceFor(on); };
/** AI pace from a driver rating (2.3): 94 -> 1.011, 76 -> 0.974 */
export const paceOf = (rating, difficulty = 'normal') => clamp(T.pace.base + (rating - 60) * T.pace.perRating, T.pace.min, T.pace.max) * (T.pace.difficulty[difficulty] ?? 1) * hardPace;
/** an AI flying lap at pace 1.00 in this car, these conditions and these upgrade levels [engine, tyres, brakes] */
export const parLap = (track, car, weather = 'dry', dev = [0, 0, 0]) =>
  CAL.tracks[track].parLap * (1 - T.pace.carZ * (TIERS.carZ[car] ?? 0)) * (T.pace.wet[weather] ?? 1) * (1 - T.pace.perDevLevel * avg(dev));
/** race laps from the length the player picked, in minutes (tuning.json series.lengths): laps differ per circuit, the time does not, down to the 2-lap minimum */
export const lapsFor = (track, length = 'sprint') => clamp(Math.round((T.series.lengths[length] * 60) / CAL.tracks[track].parLap), T.series.lapsMin, T.series.lapsMax);

// ---------------------------------------------------------------------------------------------- calendar
const EVENTS = ['sprint', 'grandprix', 'showpiece'];                      // a season's running order (calendar.json `event`)
const LOOKS = ['day', 'dusk', 'bluehour', 'night'];                       // a track without `times` (tracks.js) offers them all
/**
 * A season's rounds for a world (career-worlds.md): a finale drawn from the world's showpieces, then the world's other tracks once each, sprints first,
 * grands prix next, showpieces last, so a season builds. A track only comes back when the game has too few for the rounds, and never twice in a row.
 * `available` maps track id -> its `times` (null: every look) for the tracks the game has.
 */
export function buildCalendar(seed, season, world, available, length = 'sprint') {
  const W = CAL.worlds[world], has = (id) => id in available && CAL.tracks[id], r = rng(seed, 'cal', season);
  const finales = W.finale.filter((f) => has(f.track));
  const fin = finales[Math.floor(r() * finales.length)] ?? { track: W.tracks.find(has) ?? Object.keys(available).find(has), look: null };
  const others = W.tracks.filter((id) => has(id) && id !== fin.track), n = W.rounds - 1;
  let pool = [];
  while (pool.length < n && others.length) pool.push(...shuffle(r, others));
  pool = pool.slice(0, n);
  let order = pool;
  if (new Set(pool).size === pool.length) order = [...pool].sort((a, b) => EVENTS.indexOf(CAL.tracks[a].event) - EVENTS.indexOf(CAL.tracks[b].event));
  else for (let k = 0; k < 60; k++) {                                  // too few tracks: reshuffle until no back-to-back track (a small pool may never manage)
    order = shuffle(r, pool);
    if ([...order, fin.track].every((t, i, l) => i === 0 || t !== l[i - 1])) break;
  }
  const seen = {}, wet = { n: 0 };
  return [...order, fin.track].map((track, i, all) => {
    const C = CAL.tracks[track], looks = available[track] ?? LOOKS, finale = i === all.length - 1;
    const pick = looks[Math.floor(r() * looks.length)];                 // an even chance of each hour this circuit offers in the menu
    const look = finale && fin.look && looks.includes(fin.look) ? fin.look : pick;
    let weather = 'dry', x = r();
    if (i > 0 && !C.dryOnly && wet.n < T.weather.maxWet) weather = x < T.weather.rain ? 'rain' : x < T.weather.rain + T.weather.damp ? 'damp' : 'dry';
    if (weather !== 'dry') wet.n++;
    const n = (seen[track] = (seen[track] ?? -1) + 1);
    return { round: i + 1, track, event: finale ? 'finale' : C.event, look, weather, laps: lapsFor(track, length), name: finale ? 'Season Finale' : C.names[Math.min(n, C.names.length - 1)], finale };
  });
}

// ---------------------------------------------------------------------------------------------- weeks (section 13)
/**
 * A season as weeks: pre-season, then each round's race week with an open week between rounds, the market after the middle round, the review last.
 * An open week holds one optional event, the team's favourite kind first. 6 rounds make 13 weeks, 8 make 17.
 */
export function buildWeeks(calendar, theme = 'test') {
  const other = theme === 'test' ? 'sponsor' : 'test', mid = Math.ceil(calendar.length / 2), out = [{ kind: 'pre', event: { kind: 'test', result: null } }];
  let k = 0;
  calendar.forEach((r, i) => {
    out.push({ kind: 'race', round: i });
    if (i === calendar.length - 1) return;
    out.push(i + 1 === mid ? { kind: 'market' } : { kind: 'open', event: { kind: k++ % 2 ? other : theme, result: null } });
  });
  return [...out, { kind: 'end' }].map((w, i) => ({ week: i + 1, ...w }));
}

// ---------------------------------------------------------------------------------------------- qualifying
/** a computed qualifying lap for an entry (4.3): par / pace, with seeded noise */
export function aiLap({ seed, season, round, key, rating, track, weather, dev, difficulty }) {
  const r = rng(seed, 'ai', season, round, key);
  return (parLap(track, key, weather, dev) / paceOf(rating, difficulty)) * (1 + T.quali.noiseSigma * gauss(r));
}
/** the teammate duel on the clock (6.3): won / lost / level by the margin, `big` beyond 0.3 % */
export function duelOf(mine, mate) {
  if (!Number.isFinite(mine)) return { result: 'lost', big: true, margin: null };
  const m = (mate - mine) / mate;
  return { result: Math.abs(m) < T.quali.duelLevel ? 'level' : m > 0 ? 'won' : 'lost', big: Math.abs(m) > T.quali.duelBig, margin: m };
}

// ---------------------------------------------------------------------------------------------- the round rating, XP, REP, trust
export const RR_LABELS = [[9, 'Masterclass'], [8, 'Outstanding'], [7, 'Strong'], [6, 'Solid'], [5, 'Poor'], [0, 'Bad']];
export const rrLabel = (rr) => RR_LABELS.find(([min]) => rr >= min)[1];
/** Round Rating (6.1): the result against the car. Returns { rr, lines: [[label, delta]] } */
export function roundRating({ expPos, grid, finish, fastest, clean, duel, underdog, dnf, dnq }) {
  const R = T.rating, lines = [], add = (label, v) => { if (v) lines.push([label, Math.round(v * 100) / 100]); };
  // places are of the 16, and two of them weigh what one did when the table was 8: the rating constants are unchanged. No race, no finish to judge
  const dp = dnq ? 0 : expPos - finish, dq = expPos - grid, pos = clamp(dp / 2, -R.posClamp, R.posClamp), q = clamp(dq / 2, -R.qualiClamp, R.qualiClamp);
  add(dp >= 0 ? `Finished ${dp} ${dp === 1 ? 'place' : 'places'} above expected` : `Finished ${-dp} ${dp === -1 ? 'place' : 'places'} below expected`, R.pos * pos);
  add(dq >= 0 ? `Qualified ${dq} above expected` : `Qualified ${-dq} below expected`, R.quali * q);
  if (dnq) add('Did not qualify', R.dnq);
  if (fastest) add('Fastest lap of the field', R.fastest);
  if (clean && !dnf) add('Clean race', R.clean);
  if (duel) add(duel.result === 'won' ? 'Beat your teammate' : duel.result === 'lost' ? 'Lost to your teammate' : null, (duel.result === 'won' ? 1 : duel.result === 'lost' ? -1 : 0) * (duel.big ? R.duelBig : R.duel));
  if (underdog && pos >= 0 && !dnf) add('Underdog seat', R.underdog);
  if (dnf) add('Retired', R.dnf);
  const raw = R.base + lines.reduce((s, l) => s + l[1], 0), soft = raw > R.softAt ? R.softAt + (raw - R.softAt) * R.softRate : raw;   // the top of the scale is hard to reach: a P4 from the slowest car is not a perfect 10
  return { rr: Math.round(clamp(soft, R.min, R.max) * 10) / 10, lines };
}
/** XP for a round (5.2) before nothing: the tier, assist and underdog multipliers are applied here */
export function xpFor({ finish, expPos, grid, pole, duel, fastest, clean, dnf, mandatory, optional, tier, pro, underdog }) {
  const X = T.xp, lines = [], add = (label, v) => { if (v > 0) lines.push([label, v]); };
  add(`Finished P${finish}`, dnf ? 0 : X.place[finish - 1] ?? 0);
  add('Above expected', dnf ? 0 : Math.min(X.overExpMax, Math.max(0, expPos - finish) * X.perPlaceOverExp));
  add('Pole position', pole ? X.pole : 0);
  add('Qualified above expected', Math.min(T.rating.qualiClamp, Math.max(0, expPos - grid) / 2) * X.qualiPerPlace);
  add('Teammate duel', duel?.result === 'won' ? X.duel : 0);
  add('Fastest lap', fastest ? X.fastest : 0);
  add('Clean race', clean && !dnf ? X.clean : 0);
  add('Round objective', mandatory ? X.mandatory : 0);
  add('Bonus objectives', optional * X.optional);
  const mult = TIERS.tiers[tier].xp * (pro ? X.proAssist : 1) * (underdog ? 1.1 : 1);
  return { xp: Math.round(lines.reduce((s, l) => s + l[1], 0) * mult), lines, mult };
}
/** reputation change for a round (6.2) */
export function repFor({ rr, tier, finish, pole, fastest, giantKills, dnf }) {
  const P = T.rep, base = (rr - T.rating.base) * P.perRR, lines = [], add = (label, v) => { if (v) lines.push([label, Math.round(v)]); };
  add('Round rating', base > 0 ? base * TIERS.tiers[tier].rep : base);
  if (!dnf && finish === 1) add('Win', P.win); else if (!dnf && finish <= 3) add('Podium', P.podium);
  if (pole) add('Pole', P.pole);
  if (fastest) add('Fastest lap', P.fastest);
  if (giantKills) add('Giant-killing', Math.min(P.giantKillMax, giantKills * P.giantKill));
  if (dnf) add('Retired', P.dnf);
  return { rep: lines.reduce((s, l) => s + l[1], 0), lines };
}
/** team trust change for a round (6.2) */
export const trustFor = ({ rr, mandatory, optional, duel }) => Math.round((rr - T.rating.base) * T.trust.perRR + (mandatory ? T.trust.mandatory : -T.trust.mandatory) + optional * T.trust.optional + (duel?.result === 'won' ? T.trust.duel : duel?.result === 'lost' ? -T.trust.duel : 0));

// ---------------------------------------------------------------------------------------------- objectives
export const OBJECTIVES = {
  finish: (o) => `Finish P${o.n} or better`,
  duel: () => 'Out-qualify your teammate',
  clean: () => 'Race clean: no spins, at most one hit',
  gain: (o) => `Gain ${o.n} places from your grid slot`,
  fastest: () => 'Set the fastest lap of the race',
  podium: () => 'Finish on the podium',
  quali: (o) => `Qualify P${o.n} or better`,
};
export const objectiveText = (o) => OBJECTIVES[o.kind](o);
/** the round's objectives (6.4): one mandatory from the expected finish, two optional from a seeded pool */
export function objectivesFor(r, expPos, easier = false, exempt = false) {
  const main = expPos > 8 && !exempt ? { kind: 'quali', n: easier ? Math.min(expPos + 1, 16) : Math.min(expPos, 15) } : { kind: 'finish', n: easier ? Math.min(expPos + 1, 8) : Math.min(expPos, 7) };   // expected outside the eight: the target is the qualifying place. Last expected asks for one better; a Raw or reserve driver gets one place easier, down to just making it (3.1, 6.7)
  const pool = [{ kind: 'duel' }, { kind: 'clean' }, { kind: 'gain', n: 2 }, { kind: 'fastest' }, { kind: 'quali', n: Math.max(1, expPos - 2) }];
  if (expPos <= 6) pool.push({ kind: 'podium' });
  return [{ ...main, mandatory: true }, ...shuffle(r, exempt ? pool.filter((o) => o.kind !== 'duel' && o.kind !== 'quali') : pool).slice(0, 2)];
}
/** why the player skips the next round's qualifying and where he starts, or null: a podium, with his teammate not ahead of him. Further such rules go here */
export function qualiExemption(rep, mate) {
  if (!rep || rep.dnf || rep.dnq || rep.finish > 3) return null;
  const m = rep.entries.findIndex((e) => e.key === mate);
  return m >= 0 && m < rep.finish - 1 ? null : { slot: rep.finish, why: rep.finish === 1 ? 'your win' : 'your podium' };
}
export function objectiveMet(o, x) {
  return ({ finish: () => !x.dnf && x.finish <= o.n, duel: () => x.duel?.result === 'won', clean: () => !x.dnf && x.clean, gain: () => !x.dnf && x.grid - x.finish >= o.n,
    fastest: () => !!x.fastest, podium: () => !x.dnf && x.finish <= 3, quali: () => x.grid <= o.n })[o.kind]();
}

// ---------------------------------------------------------------------------------------------- offers
/** a team's interest in the player (6.5) and whether its seeded roll makes an offer */
export function interestOf(team, { rep, rrs, cl, form }, { extraRep = 0, declined = 0 } = {}) {
  const g = TIERS.teams[team].gate, a = avg(rrs.slice(-6));
  if (rep < g.rep + extraRep || a < g.rr || cl < g.cl) return null;
  return clamp((0.5 * (rep - g.rep)) / Math.max(g.rep, 100) + 0.15 * (a - g.rr) + 0.05 * form - (declined >= T.offers.declineAfter ? T.offers.declinePenalty : 0), 0, 1);
}
/** the seeded roll (6.5): window 'W1' (mid-season poaching, halved) or 'W2' (the season-end market) */
export const offerRoll = (seed, season, window, team, interest, scale = 1) => rng(seed, 'offer', season, window, team)() < (T.offers.base + T.offers.slope * interest) * scale;

// ---------------------------------------------------------------------------------------------- contracts and negotiation
/** status ladder (3.3): junior and second sit in the B car, lead and number1 in the A car; Number One is a Legend seat */
export const STATUS = ['junior', 'second', 'lead', 'number1'];
export const STATUS_LABEL = { junior: 'Junior', second: 'Second driver', lead: 'Lead driver', number1: 'Number One' };
/** what the status lever can reach from an offer: it never changes the car (the A seat is earned on track, 6.3) */
export const statusChoices = (o) => (o.seat === 'A' ? (o.tier === 'legend' ? ['lead', 'number1'] : ['lead']) : ['junior', 'second']).filter((s) => STATUS.indexOf(s) >= STATUS.indexOf(o.status));
/** demand points of a counter-proposal (6.5): salary +10 % = 1, signing +25 % = 1, status up = 2 a step, a shorter contract = 0.5 a season */
export function demandOf(o, ask) {
  const D = T.offers.demand;
  return Math.round(ask.salary / D.salaryStep) * D.perSalaryStep + Math.round((ask.signing ?? 0) / D.signingStep) * D.perSigningStep + Math.max(0, STATUS.indexOf(ask.status) - STATUS.indexOf(o.status)) * D.perStatus
    + Math.max(0, o.seasons - ask.seasons) * D.perSeasonCut;
}
/** the nearest terms the team accepts: give up the signing bonus first, then salary, then status, then length (6.5) */
export function nearestTerms(o, ask, leverage) {
  const t = { ...ask }, D = T.offers.demand;
  while (demandOf(o, t) > leverage) {
    if (t.signing > 0) t.signing = Math.round((t.signing - D.signingStep) * 100) / 100;
    else if (t.salary > 0) t.salary = Math.round((t.salary - D.salaryStep) * 10) / 10;
    else if (STATUS.indexOf(t.status) > STATUS.indexOf(o.status)) t.status = STATUS[STATUS.indexOf(t.status) - 1];
    else if (t.seasons < o.seasons) t.seasons++;
    else break;
  }
  return t;
}

// ---------------------------------------------------------------------------------------------- sponsor targets
/** a sponsor's target for a season: about one round in three, shaped by what the player's seat can do */
export function targetFor(kind, expPos, rounds) {
  const count = Math.max(1, Math.round(rounds / 3)), place = clamp(expPos - 1, 3, 7);
  return { top: { kind, n: place, count }, quali: { kind, n: place, count }, podium: { kind, count: Math.max(1, count - 1) }, win: { kind, count: 1 }, clean: { kind, count: count + 1 }, duel: { kind, count: count + 1 } }[kind];
}
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
export const targetText = (t) => ({ top: `finish P${t.n} or better ${times(t.count)}`, quali: `qualify P${t.n} or better ${times(t.count)}`, podium: `finish on the podium ${times(t.count)}`, win: `win ${times(t.count)}`, clean: `race clean ${times(t.count)}`, duel: `beat your teammate on the clock ${times(t.count)}` })[t.kind];
export const targetMet = (t, x) => ({ top: () => !x.dnf && x.finish <= t.n, quali: () => x.grid <= t.n, podium: () => !x.dnf && x.finish <= 3, win: () => !x.dnf && x.finish === 1, clean: () => !x.dnf && x.clean, duel: () => x.duel?.result === 'won' })[t.kind]();

// ---------------------------------------------------------------------------------------------- side events
/** a test-day or sponsor-day result against its targets (4.2): 0 none, 1 bronze, 2 silver, 3 gold */
export function sideMedal(kind, value, par) {
  const S = T.side;
  if (kind === 'test') return Number.isFinite(value) ? S.test.filter((x) => value <= par * x).length : 0;
  return S.sponsor.filter((x) => value >= x).length;
}
