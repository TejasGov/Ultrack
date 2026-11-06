// The world around the player (docs/career-mode.md 6.6, 6.8): who drives which car, the free agents, the academy, rival heat, and
// the cheap AI market between seasons. Pure, like the rest of career/: a save goes in and comes out changed.
// world.seats maps each car key to a driver code; the player's car holds 'YOU', a seat the market has to fill holds null.
import { TUNING as T, TIERS, DRIVERS, CAR, clamp, loreOf, tierOf, seatCar, otherSeat } from './rules.js';
import { rng } from './rng.js';

export const YOU = 'YOU';
/** the 16 teams.json drivers by code; academy drivers live in the save (world.academy), once called up */
const BASE = Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, { code: c.driver.code, name: c.driver.name, nation: c.driver.nation }]));

export function newWorld() {
  return {
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
  if (!same && out && out !== YOU) { W.free.push(out); }
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

/** between seasons (6.8): everyone a year older, ratings drift by age, the old retire, open seats fill from free agents, then the academy */
export function marketMoves(save) {
  const W = save.world, M = T.market, season = save.clock.season;
  for (const code of Object.keys(W.ratings)) {
    const age = (W.ages[code] = (W.ages[code] ?? 30) + 1), step = DRIVERS.drift.find(([max]) => age < max)?.[1] ?? 0;
    W.ratings[code] = clamp(W.ratings[code] + step, 60, 99);
  }
  const retire = (code) => W.ages[code] >= M.retireAge && rng(save.seed, 'market', 'retire', season, code)() < M.retireChance;
  for (const [key, code] of Object.entries(W.seats)) if (code && code !== YOU && retire(code)) { W.seats[key] = null; W.retired.push(code); }
  W.free = W.free.filter((code) => !(retire(code) && W.retired.push(code)));
  // the best teams pick first, the best free agent first; then the academy
  const open = Object.keys(W.seats).filter((k) => W.seats[k] === null).sort((a, b) => W.teams[CAR[a].team].expPos - W.teams[CAR[b].team].expPos || (CAR[a].seat === 'A' ? -1 : 1));
  for (const key of open) {
    W.free.sort((a, b) => W.ratings[b] - W.ratings[a]);
    W.seats[key] = W.free.shift() ?? callUp(save);
  }
}
function callUp(save) {
  const W = save.world, M = T.market, taken = new Set([...Object.keys(W.ratings), save.player.code]);
  const next = DRIVERS.academy.find((a) => !taken.has(a.code)), r = rng(save.seed, 'market', 'academy', next?.code ?? W.retired.length);
  const code = next?.code ?? 'A' + String(Object.keys(W.academy).length).padStart(2, '0');    // past the list: numbered rookies
  W.academy[code] = { name: next?.name ?? `Academy Driver ${code.slice(1)}`, nation: next?.nation ?? 'IND' };
  W.ratings[code] = M.academyRating[0] + Math.floor(r() * (M.academyRating[1] - M.academyRating[0] + 1));
  W.ages[code] = M.academyAge[0] + Math.floor(r() * (M.academyAge[1] - M.academyAge[0] + 1));
  return code;
}

/**
 * Rival heat after a race (6.6), over the cars that raced (`raced`, in finishing order): finishing next to a driver and beating them heats
 * the rivalry, so does each contact (harder over 30 km/h), each pass between you (two at most) and the teammate's qualifying duel; everyone else
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
      lines.push([`${nem ? 'Feud' : 'Rival'} beaten: ${personOf(save, code).name}`, v]);
    }
    const hits = (g && ev.contacts?.[g.key]) || 0, contact = (Array.isArray(hits) ? hits : Array(hits).fill(0)).reduce((a, kmh) => a + (kmh > 30 ? R.contactHard : R.contact), 0);
    const pass = g ? Math.min(ev.passes?.[g.key] ?? 0, 2) * R.pass : 0, duel = code === ev.duel ? R.duel : 0, near = g && me >= 0 && Math.abs(g.i - me) <= R.near;
    H[code] = clamp(was + (near ? R.close + (beat ? R.beat : 0) : contact || pass || duel ? 0 : -(me < 0 ? R.sitOut : R.decay)) + contact + pass + duel, 0, 100);   // no cooling for a driver you touched, passed or fought in qualifying; a round you sat out cools slowly (you never met)
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
  const H = save.career.heat, code = pickNemesis(save, keys);
  for (const c of Object.keys(H)) if (c !== code) H[c] = Math.min(H[c], T.rivals.nemesis + 9);
  return code ? { code, key: keys.find((k) => save.world.seats[k] === code) } : null;
}
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
