// The world around the player (docs/career-mode.md 6.6, 6.8): who drives which car, the free agents, the academy, rival heat, and
// the cheap AI market between seasons. Pure, like the rest of career/: a save goes in and comes out changed.
// world.seats maps each car key to a driver code; the player's car holds 'YOU', a seat the market has to fill holds null.
import { TUNING as T, TIERS, DRIVERS, CAR, clamp, loreOf, tierOf, seatCar, otherSeat, seasonForm, playerRating } from './rules.js';
import { rng } from './rng.js';

export const YOU = 'YOU';
/** the 16 teams.json drivers by code; academy drivers live in the save (world.academy), once called up */
const BASE = Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, { code: c.driver.code, name: c.driver.name, nation: c.driver.nation }]));

/** a contract's length in seasons, seeded per driver: the starting grid's 1-3 (market.contract), a signing's 2-3 (market.signing) */
const span = (r, [lo, hi]) => lo + Math.floor(r() * (hi - lo + 1));
export const contractFor = (seed, code) => span(rng(seed, 'contract', code), T.market.contract);
/** world.contracts[code]: the seasons left on an AI driver's contract, this one included (a free agent has none) */
export function newWorld(seed = 0) {
  return {
    contracts: Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, contractFor(seed, c.driver.code)])),
    teams: Object.fromEntries(Object.keys(TIERS.teams).map((id) => [id, { expPos: TIERS.teams[id].expPos, dev: [...tierOf(id).dev], declined: 0 }])),
    ratings: { ...DRIVERS.ratings }, ages: Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, c.driver.age])),
    seats: Object.fromEntries(Object.entries(CAR).map(([key, c]) => [key, c.driver.code])), free: [], retired: [], academy: {},
  };
}
export const personOf = (save, code) => BASE[code] ?? (save.world.academy[code] && { code, ...save.world.academy[code] });
/** the driver in a car: { code, name, nation, rating, age }, the player for his own car */
export function driverAt(save, key) {
  const code = save.world.seats[key];
  if (code === YOU) return { code: save.player.code, name: save.player.name, nation: save.player.nation, you: true };
  return code ? { ...personOf(save, code), rating: save.world.ratings[code], age: save.world.ages[code] } : null;
}
/** a driver as Session draws him (HUD tower, results): over teams.json, so a moved or academy driver shows in his new car */
export function sessionDriver(save, key) {
  const d = driverAt(save, key), you = d.you;
  return { name: d.name, code: d.code, nation: d.nation, number: you ? save.player.number : CAR[key].number, team: loreOf(CAR[key].team) };
}

/**
 * The player moves into `car` (from `oldCar`, or from nowhere). In the same team (a promotion) the two drivers swap; otherwise the
 * driver they displace becomes a free agent with a grudge, the player's old seat opens for the market, every rivalry cools, and the new
 * teammate starts as the first measuring stick (6.6).
 */
export function takeSeat(save, car, oldCar) {
  const W = save.world, H = save.career.heat, same = oldCar && CAR[oldCar].team === CAR[car].team, out = W.seats[car];
  if (car === oldCar) return;
  W.seats[car] = YOU;
  if (oldCar) W.seats[oldCar] = same ? out : null;
  if (!same && out && out !== YOU) { W.free.push(out); delete W.contracts?.[out]; }
  if (same) return;
  for (const c of Object.keys(H)) H[c] = Math.max(0, H[c] - T.rivals.teamChange);
  const mate = W.seats[seatCar(CAR[car].team, otherSeat(CAR[car].seat))];
  if (mate && mate !== YOU) setHeat(save, mate, T.rivals.mate, 'teammate');
  if (out && out !== YOU) setHeat(save, out, T.rivals.displaced, 'displaced');
}
/** heat of at least h, with a cause on record; a rivalry that already has one keeps it and its head-to-head */
function setHeat(save, code, h, cause) {
  const K = save.career, season = save.clock.season + (save.clock.phase === 'review' ? 1 : 0);   // a signing at the review starts next season
  K.heat[code] = Math.max(K.heat[code] ?? 0, h);
  (K.rivalry ??= {})[code] ??= { cause, since: [season, 0], w: 0, l: 0 };
}

/** a driver's standing in the market (6.8, phase 5): rating, twice the season's form, and a seeded jitter of +-1; the player is measured by their market rating */
export const marketScore = (save, code) => (code === YOU ? playerRating(save) : save.world.ratings[code]) + 2 * seasonForm(save, code) + rng(save.seed, 'market', 'score', save.clock.season, code)() * 2 - 1;
/** who could take this seat: the free agents, and AI drivers in their last season at a team below it (seated: false stops the cascade) */
export function shortlistOf(save, key, seated = true) {
  const W = save.world, pos = W.teams[CAR[key].team].expPos;
  return [...W.free, ...(seated ? Object.entries(W.seats).filter(([k, c]) => c && c !== YOU && W.contracts[c] === 1 && W.teams[CAR[k].team].expPos > pos).map(([, c]) => c) : [])];
}

/**
 * Between seasons (6.8), in seeded phases: everyone a year older and ratings drift by age; the old retire; contracts run down, and a driver out
 * of contract re-signs (rated near the tier, and the team's roll) or goes free; a team drops a driver well below the tier who scored fewer points
 * than his teammate; then the open seats fill, the best team first, with the best market score among the free agents and the drivers in their last
 * season at a lesser team. A seated driver who moves opens his own seat (a cascade of maxMoves at most); the driver the player displaced
 * (`displaced`, from `vacated`) does not take the player's old seat while another is open; the academy fills what is left.
 */
export function marketMoves(save, { displaced = null, vacated = null } = {}) {
  const W = save.world, M = T.market, season = save.clock.season, K = (W.contracts ??= {}), sign = (code) => { K[code] = span(rng(save.seed, 'market', 'length', season, code), M.signing); };
  for (const code of Object.keys(W.ratings)) {
    const age = (W.ages[code] = (W.ages[code] ?? 30) + 1), step = DRIVERS.drift.find(([max]) => age < max)?.[1] ?? 0;
    W.ratings[code] = clamp(W.ratings[code] + step, 60, 99);
  }
  const retire = (code) => W.ages[code] >= M.retireAge && rng(save.seed, 'market', 'retire', season, code)() < M.retireChance;
  for (const [key, code] of Object.entries(W.seats)) if (code && code !== YOU && retire(code)) { W.seats[key] = null; W.retired.push(code); delete K[code]; }
  W.free = W.free.filter((code) => !(retire(code) && W.retired.push(code)));
  const seated = () => Object.entries(W.seats).filter(([, c]) => c && c !== YOU), free = (key) => { W.free.push(W.seats[key]); delete K[W.seats[key]]; W.seats[key] = null; };
  const tierAvg = {}; for (const [k, c] of seated()) (tierAvg[TIERS.teams[CAR[k].team].tier] ??= []).push(W.ratings[c]);
  for (const t in tierAvg) tierAvg[t] = tierAvg[t].reduce((a, b) => a + b, 0) / tierAvg[t].length;
  const avgAt = (key) => tierAvg[TIERS.teams[CAR[key].team].tier];
  for (const [key, code] of seated()) {
    if ((K[code] = (K[code] ?? 1) - 1) > 0) continue;
    if (W.ratings[code] >= avgAt(key) - M.renewGap && rng(save.seed, 'market', 'renew', season, code)() < M.renew) sign(code); else free(key);
  }
  // this season's points by driver and the team each scored them for: an under-performer is one his teammate outscored
  const pts = {}, team = {};
  for (const r of save.season?.results ?? []) for (const e of r.entries) { const c = e.you ? YOU : e.code; pts[c] = (pts[c] ?? 0) + e.pts; team[c] = e.team; }
  for (const [key, code] of seated()) {
    const t = CAR[key].team, beaten = Object.keys(team).some((c) => c !== code && team[c] === t && pts[c] > (pts[code] ?? 0));
    if (team[code] === t && W.ratings[code] <= avgAt(key) - M.dropGap && beaten) free(key);
  }
  const order = (keys) => keys.sort((a, b) => W.teams[CAR[a].team].expPos - W.teams[CAR[b].team].expPos || (CAR[a].seat === 'A' ? -1 : 1));
  const open = order(Object.keys(W.seats).filter((k) => W.seats[k] === null)), score = Object.fromEntries([...W.free, ...seated().map(([, c]) => c)].map((c) => [c, marketScore(save, c)]));
  let moves = 0;
  while (open.length) {
    const key = open.shift(), skip = key === vacated && open.length ? displaced : null;
    const best = shortlistOf(save, key, moves < M.maxMoves).filter((c) => c !== skip).sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1))[0];
    const from = best && Object.keys(W.seats).find((k) => W.seats[k] === best);
    if (from) { W.seats[from] = null; open.push(from); order(open); moves++; } else if (best) W.free.splice(W.free.indexOf(best), 1);
    W.seats[key] = best ?? callUp(save);
    sign(W.seats[key]);
  }
  // a driver on the rumoured shortlist with the player takes the seat: a rivalry over a seat (6.6)
  for (const x of save.season?.rumours ?? []) { const now = W.seats[x.car]; if (x.list.includes(YOU) && now !== YOU && now !== x.code && x.list.includes(now)) heatUp(save, now, T.rivals.seatLost, 'seat'); }
}
function callUp(save) {
  const W = save.world, M = T.market, N = DRIVERS.academyNames, used = new Set([...Object.keys(W.ratings), save.player.code]);
  const taken = new Set([...used, ...DRIVERS.academy.map((a) => a.code)]), next = DRIVERS.academy.find((a) => !used.has(a.code)), n = Object.keys(W.academy).length, r = rng(save.seed, 'market', 'academy', next?.code ?? n);
  let { code, name, nation } = next ?? {};
  if (!next) {                                                   // past the list: a seeded name nobody in the paddock has, its code from the surname
    const names = new Set([...Object.values(BASE), ...Object.values(W.academy), ...DRIVERS.academy].map((d) => d.name).concat(save.player.name)), pick = (l) => l[Math.floor(r() * l.length)];
    for (let i = 0; i < 99 && (!name || names.has(name)); i++) name = `${pick(N.first)} ${pick(N.last)}`;
    const [first, last] = name.toUpperCase().split(' ');
    code = [last.slice(0, 3), first[0] + last.slice(0, 2), last.slice(0, 2) + first[0], 'A' + String(n).padStart(2, '0')].find((c) => !taken.has(c));
    nation = pick(N.nations);
  }
  W.academy[code] = { name, nation };
  W.ratings[code] = M.academyRating[0] + Math.floor(r() * (M.academyRating[1] - M.academyRating[0] + 1));
  W.ages[code] = M.academyAge[0] + Math.floor(r() * (M.academyAge[1] - M.academyAge[0] + 1));
  return code;
}

/**
 * Rival heat after a race (6.6), over the cars that raced (`raced`, in finishing order): finishing next to a driver and beating them heats
 * the rivalry, so does each contact (harder over 30 km/h), each pass between you (two at most) and the teammate's qualifying duel (up to duelMax); everyone else
 * cools. ev: { contacts: { key: n | [km/h, ...] }, passes: { key: n }, duel: the teammate's code or null }. Returns the REP and XP the
 * rivals beaten earn (a rival is heat 40+; the nemesis pays more), judged on the heat from before this race, and this race's nemesis
 * with whether they were beaten.
 */
export function heatAfter(save, raced, hero, dnf, ev = { contacts: {}, passes: {} }) {
  const R = T.rivals, K = save.career, H = K.heat, RV = (K.rivalry ??= {}), me = raced.indexOf(hero), myRank = tierOf(save.contract.team).rank, onGrid = {}, lines = [];
  const nemesis = nemesisOf(save, raced), since = [save.clock.season, save.clock.round + 1], h2h = me >= 0 && !dnf;
  let rep = 0, xp = 0;
  raced.forEach((key, i) => { if (key !== hero) onGrid[save.world.seats[key]] = { i, key }; });
  for (const code of new Set([...Object.keys(H), ...Object.keys(onGrid), ...(ev.duel ? [ev.duel] : [])])) {
    const g = onGrid[code], was = H[code] ?? 0, beat = h2h && g && g.i > me;
    if (beat && was >= R.rival) {
      const nem = code === nemesis?.code, v = Math.round(R.rep * (tierOf(CAR[g.key].team).rank > myRank ? R.higherTier : 1) * (nem ? R.feudRep : 1));
      rep += v; if (nem) xp += R.feudXp;
      lines.push([`${nem ? 'Nemesis' : 'Rival'} beaten: ${personOf(save, code).name}`, v]);
    }
    const hits = (g && ev.contacts?.[g.key]) || 0, contact = (Array.isArray(hits) ? hits : Array(Math.max(0, hits | 0)).fill(0)).reduce((a, kmh) => a + (kmh > 30 ? R.contactHard : R.contact), 0);
    // the duel alone stops at duelMax, short of a nemesis: a teammate becomes one only by racing you close, touching or passing you
    const pass = g ? Math.min(ev.passes?.[g.key] ?? 0, 2) * R.pass : 0, duel = code === ev.duel ? clamp(R.duelMax - was, 0, R.duel) : 0, near = g && me >= 0 && Math.abs(g.i - me) <= R.near;
    H[code] = clamp(was + (near ? R.close + (beat ? R.beat : 0) : contact || pass || code === ev.duel ? 0 : -(me < 0 ? R.sitOut : R.decay)) + contact + pass + duel, 0, 100);   // no cooling for a driver you touched, passed or fought in qualifying; a round you sat out cools slowly (you never met)
    if (!H[code]) { delete H[code]; delete RV[code]; continue; }   // the save keeps only live rivalries
    if (!RV[code] && (contact || pass || duel || H[code] >= R.rival)) RV[code] = { cause: contact ? 'contact' : pass ? 'pass' : duel ? 'teammate' : 'grid', since, w: 0, l: 0 };   // a contact, a pass or a duel starts the record; racing close only once it is a rivalry
    if (RV[code] && g && h2h) RV[code][g.i > me ? 'w' : 'l']++;
  }
  nemesisOf(save, Object.keys(save.world.seats));             // between weekends, too, only the hottest can be a feud
  return { rep, xp, lines, nemesis: nemesis && { ...nemesis, beat: h2h && raced.indexOf(nemesis.key) > me } };
}
/**
 * This weekend's nemesis among these cars: the hottest driver at 70+, a seeded pick between equals; { code, key } or null.
 * Everyone else is held at 79 or less, so a feud is only ever the nemesis.
 */
export function nemesisOf(save, keys) {
  const H = save.career.heat, n = nemesisAmong(save, keys);
  for (const c of Object.keys(H)) if (c !== n?.code) H[c] = Math.min(H[c], T.rivals.nemesis + 9);
  return n;
}
/** heat added after the race (team orders ignored, career.js finishRace): a new rivalry takes this cause, and only the hottest stays a feud */
export function heatUp(save, code, dh, cause) {
  const K = save.career; K.heat[code] = clamp((K.heat[code] ?? 0) + dh, 0, 100);
  (K.rivalry ??= {})[code] ??= { cause, since: [save.clock.season, save.clock.round + 1], w: 0, l: 0 };
  nemesisOf(save, Object.keys(save.world.seats));
}
/** nemesisOf without holding anyone: for a look before the race (raceSetup), which must not change the save */
export const nemesisAmong = (save, keys) => { const code = pickNemesis(save, keys); return code ? { code, key: keys.find((k) => save.world.seats[k] === code) } : null; };
function pickNemesis(save, keys) {
  const H = save.career.heat ?? {}, hot = keys.map((k) => save.world.seats[k]).filter((c) => c && c !== YOU && (H[c] ?? 0) >= T.rivals.nemesis);
  const top = Math.max(...hot.map((c) => H[c])), tied = hot.filter((c) => H[c] === top).sort();
  return tied.length ? tied[Math.floor(rng(save.seed, 'nemesis', save.clock.season, save.clock.round)() * tied.length)] : null;
}
/** the player's rivals, hottest first: [{ code, name, heat, feud, key (their car, or null for a free agent), cause, w, l (head-to-head), nemesis (this weekend's) }] */
export function rivalsOf(save) {
  const car = Object.fromEntries(Object.entries(save.world.seats).map(([k, c]) => [c, k])), RV = save.career.rivalry ?? {};
  const nem = pickNemesis(save, save.season?.current?.quali?.grid ?? Object.keys(save.world.seats));
  return Object.entries(save.career.heat ?? {}).filter(([, h]) => h >= T.rivals.rival).sort((a, b) => b[1] - a[1])
    .map(([code, heat]) => ({ code, name: personOf(save, code)?.name ?? code, heat, feud: heat >= T.rivals.feud, key: car[code] ?? null, cause: RV[code]?.cause ?? 'grid', w: RV[code]?.w ?? 0, l: RV[code]?.l ?? 0, nemesis: code === nem }));
}
