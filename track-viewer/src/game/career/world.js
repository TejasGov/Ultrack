// The world around the player (docs/career-mode.md 6.6, 6.8): who drives which car, the free agents, the academy, rival heat, and
// the cheap AI market between seasons. Pure, like the rest of career/: a save goes in and comes out changed.
// world.seats maps each car key to a driver code; the player's car holds 'YOU', a seat the market has to fill holds null.
import { TUNING as T, TIERS, DRIVERS, CAR, clamp, loreOf, tierOf } from './rules.js';
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
 * driver he displaces becomes a free agent with a grudge, and his old seat opens for the market. Every rivalry cools on a team change.
 */
export function takeSeat(save, car, oldCar) {
  const W = save.world, H = save.career.heat, same = oldCar && CAR[oldCar].team === CAR[car].team, out = W.seats[car];
  if (car === oldCar) return;
  W.seats[car] = YOU;
  if (oldCar) W.seats[oldCar] = same ? out : null;
  if (!same && out && out !== YOU) { W.free.push(out); }
  if (!same) for (const c of Object.keys(H)) H[c] = Math.max(0, H[c] - T.rivals.teamChange);
  if (!same && out && out !== YOU) H[out] = Math.max(H[out] ?? 0, T.rivals.displaced);
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
 * Rival heat after a race (6.6): +10 for finishing within 3 places of a driver, +5 more for beating him, -5 for everyone else.
 * Returns the REP and XP the rivals beaten earn (a rival is heat 40+, a feud 80+), from the heat before this race.
 */
export function heatAfter(save, order, hero, dnf) {
  const R = T.rivals, H = save.career.heat, me = order.indexOf(hero), myRank = tierOf(save.contract.team).rank, onGrid = {}, lines = [];
  let rep = 0, xp = 0;
  order.forEach((key, i) => { if (key !== hero) onGrid[save.world.seats[key]] = { i, key }; });
  for (const code of new Set([...Object.keys(H), ...Object.keys(onGrid)])) {
    const g = onGrid[code], was = H[code] ?? 0, beat = !dnf && g && g.i > me;
    if (beat && was >= R.rival) {
      const feud = was >= R.feud, v = Math.round(R.rep * (tierOf(CAR[g.key].team).rank > myRank ? R.higherTier : 1) * (feud ? R.feudRep : 1));
      rep += v; if (feud) xp += R.feudXp;
      lines.push([`${feud ? 'Feud' : 'Rival'} beaten: ${personOf(save, code).name}`, v]);
    }
    H[code] = clamp(was + (g && Math.abs(g.i - me) <= R.near ? R.close + (beat ? R.beat : 0) : -R.decay), 0, 100);
    if (!H[code]) delete H[code];                          // the save keeps only live rivalries
  }
  return { rep, xp, lines };
}
/** the player's rivals, hottest first: [{ code, name, heat, feud, key (his car, or null for a free agent) }] */
export function rivalsOf(save) {
  const car = Object.fromEntries(Object.entries(save.world.seats).map(([k, c]) => [c, k]));
  return Object.entries(save.career.heat ?? {}).filter(([, h]) => h >= T.rivals.rival).sort((a, b) => b[1] - a[1])
    .map(([code, heat]) => ({ code, name: personOf(save, code)?.name ?? code, heat, feud: heat >= T.rivals.feud, key: car[code] ?? null }));
}
