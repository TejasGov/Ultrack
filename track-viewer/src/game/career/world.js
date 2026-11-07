// The world around the player (docs/career-mode.md 6.6, 6.8): who drives which car, the free agents, the academy, rival heat, and
// the cheap AI market between seasons. Pure, like the rest of career/: a save goes in and comes out changed.
// world.seats maps each car key to a driver code; the player's car holds 'YOU', a seat the market has to fill holds null.
import { TUNING as T, TIERS, DRIVERS, CAR, clamp, loreOf, tierOf, seatCar, otherSeat, seasonForm, playerRating } from './rules.js';
import { rng } from './rng.js';

export const YOU = 'YOU';
/** the teams.json drivers by code; academy drivers live in the save (world.academy), once called up */
const BASE = Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, { code: c.driver.code, name: c.driver.name, nation: c.driver.nation }]));

/** a contract's length in seasons, seeded per driver: the starting grid's 1-3 (market.contract), a signing's 2-3 (market.signing) */
const span = (r, [lo, hi]) => lo + Math.floor(r() * (hi - lo + 1));
export const contractFor = (seed, code) => span(rng(seed, 'contract', code), T.market.contract);
/** world.loyalty[code]: how attached an AI driver is to their team, 0-100, seeded at 40-80 (market.loyalty). Hidden: never shown, never quoted as a number */
export const loyaltyFor = (seed, code) => span(rng(seed, 'loyalty', code), T.market.loyalty);
/** world.contracts[code]: the seasons left on an AI driver's contract, this one included (a free agent has none) */
export function newWorld(seed = 0) {
  return {
    contracts: Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, contractFor(seed, c.driver.code)])),
    loyalty: Object.fromEntries(Object.values(CAR).map((c) => [c.driver.code, loyaltyFor(seed, c.driver.code)])),
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
/**
 * who could take this seat: the free agents, and AI drivers in their last season at a team below it (seated: false stops the cascade). left: the
 * contract count that is a last season when the list is drawn, 1 in the market (contracts have ticked), 2 for a rumour before the tick (offers.js)
 */
export function shortlistOf(save, key, seated = true, left = 1) {
  const W = save.world, pos = W.teams[CAR[key].team].expPos;
  return [...W.free, ...(seated ? Object.entries(W.seats).filter(([k, c]) => c && c !== YOU && W.contracts[c] === left && W.teams[CAR[k].team].expPos > pos).map(([, c]) => c) : [])];
}
/**
 * who a team could poach for this seat (6.8): drivers under contract at a team 1-3 places better (market.poachGap) whose loyalty is under
 * market.poachLoyalty, when the move is a step up and never down a tier: their B seat for this A seat, a higher tier, or the same tier in a better car. Never `keep`, nor anyone who signed in this market (`fresh`)
 */
export function poachable(save, key, keep = null, fresh = new Set()) {
  const W = save.world, M = T.market, here = CAR[key].team, pos = W.teams[here].expPos, rank = tierOf(here).rank, z = TIERS.carZ[key] ?? 0;
  return Object.entries(W.seats).filter(([k, c]) => {
    const t = CAR[k].team, gap = pos - W.teams[t].expPos;
    if (!c || c === YOU || c === keep || fresh.has(c) || t === here || gap < M.poachGap[0] || gap > M.poachGap[1] || (W.loyalty?.[c] ?? 100) >= M.poachLoyalty) return false;
    if (rank < tierOf(t).rank) return false;                   // a status gain is no step up when it costs a tier
    return (CAR[k].seat === 'B' && CAR[key].seat === 'A') || rank > tierOf(t).rank || (rank === tierOf(t).rank && z > (TIERS.carZ[k] ?? 0));
  }).map(([, c]) => c);
}

/**
 * Between seasons (6.8), in seeded phases: everyone a year older and ratings drift by age; loyalty moves with the season; the old retire; contracts run
 * down, and a driver out of contract re-signs (rated near the tier, and the team's roll) or goes free; a team drops a driver well below the tier who scored
 * fewer points than their teammate; a team that underperformed may sack its lower scorer; the rivals who beat the player to a seat (`signed`, the
 * window's) take it; then the open seats fill, the best team first, with the best market score among the free agents and the drivers in their last
 * season at a lesser team, or a driver poached from a slightly better team. A seated driver who moves opens their own seat (a cascade of maxMoves at
 * most, poaches apart); the driver the player displaced (`displaced`, from `vacated`) does not take the player's old seat while another is open; the
 * academy fills what is left. Returns { sacked: [{ code, team }], poached: [{ code, from, to }] } for the press.
 */
export function marketMoves(save, { displaced = null, vacated = null } = {}) {
  const W = save.world, M = T.market, season = save.clock.season, K = (W.contracts ??= {}), L = (W.loyalty ??= {}), sign = (code) => { K[code] = span(rng(save.seed, 'market', 'length', season, code), M.signing); };
  const fresh = new Set(), moved = (code) => { L[code] = M.loyaltyMove; sign(code); fresh.add(code); }, out = { sacked: [], poached: [] };
  // this season's points by driver and the team each scored them for, and the Teams' table: an under-performer is one their teammate outscored
  const pts = {}, team = {}, h = save.history?.at(-1), table = h?.season === season ? h.teamOrder ?? [] : [];
  for (const r of save.season?.results ?? []) for (const e of r.entries) { const c = e.you ? YOU : e.code; pts[c] = (pts[c] ?? 0) + e.pts; team[c] = e.team; }
  const below = (t) => (table.length && W.teams[t].joined !== season ? table.indexOf(t) + 1 - W.teams[t].expPos : 0),   // a team that joined mid-season (addTeams) is not judged on part of one
    beaten = (code, t) => Object.keys(team).some((c) => c !== code && team[c] === t && pts[c] > (pts[code] ?? 0));
  for (const [key, code] of Object.entries(W.seats)) {                // loyalty grows with each season at a team, and sours with a bad year or a teammate who outscored them
    if (!code || code === YOU) continue;
    const t = CAR[key].team; L[code] = clamp((L[code] ?? 60) + M.loyaltyGrow - (below(t) >= 2 ? M.loyaltyUnder : 0) - (team[code] === t && beaten(code, t) ? M.loyaltyBeaten : 0), 0, 100);
  }
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
  for (const [key, code] of seated()) {
    const t = CAR[key].team;
    if (team[code] === t && W.ratings[code] <= avgAt(key) - M.dropGap && beaten(code, t)) free(key);
  }
  // lower teams fire (6.8): a team 2+ places under its expected place in the Teams' table, or in the bottom half of its tier, may sack its lower scorer when
  // they are rated well under the tier or scored under sackShare of the teammate's points; the further under, the likelier (sackChance by tier: the top tier does not). Never the player
  const ranked = (t) => { const ids = table.filter((x) => TIERS.teams[x].tier === TIERS.teams[t].tier); return ids.indexOf(t) >= ids.length / 2; };
  for (const t of Object.keys(TIERS.teams).sort((a, b) => W.teams[a].expPos - W.teams[b].expPos)) {
    const chance = M.sackChance[tierOf(t).rank - 1];
    if (!table.length || !chance || out.sacked.length >= M.maxSacks || !(below(t) >= 2 || ranked(t))) continue;
    const [a, b] = ['A', 'B'].map((s) => seatCar(t, s)), ca = W.seats[a], cb = W.seats[b]; if (!ca || !cb) continue;
    const p = (c) => pts[c] ?? 0, [key, mate] = p(ca) < p(cb) || (p(ca) === p(cb) && (W.ratings[ca] ?? 0) < (W.ratings[cb] ?? 0)) ? [a, b] : [b, a], code = W.seats[key];
    if (code === YOU || !(W.ratings[code] < avgAt(key) - M.sackGap || p(code) < M.sackShare * p(W.seats[mate]))) continue;
    if (rng(save.seed, 'market', 'sack', season, t)() < chance + M.sackPerPlace * Math.max(0, below(t) - 2)) { free(key); out.sacked.push({ code, team: t }); }
  }
  // the rivals who signed in the transfer window (offers.js talksFor) take those seats; their own seats open, and whoever sat there goes free
  for (const [car, code] of Object.entries({ ...save.season?.signed, ...save.pending?.window?.signed })) {
    if (W.seats[car] === YOU || W.seats[car] === code || W.retired.includes(code)) continue;
    const from = Object.keys(W.seats).find((k) => W.seats[k] === code);
    if (from) W.seats[from] = null; else if (W.free.includes(code)) W.free.splice(W.free.indexOf(code), 1); else continue;
    if (W.seats[car]) free(car);
    W.seats[car] = code; moved(code);
  }
  const order = (keys) => keys.sort((a, b) => W.teams[CAR[a].team].expPos - W.teams[CAR[b].team].expPos || (CAR[a].seat === 'A' ? -1 : 1));
  const open = order(Object.keys(W.seats).filter((k) => W.seats[k] === null)), score = Object.fromEntries([...W.free, ...seated().map(([, c]) => c)].map((c) => [c, marketScore(save, c)]));
  const me = Object.keys(W.seats).find((k) => W.seats[k] === YOU), keep = me && save.contract?.since === season ? W.seats[seatCar(CAR[me].team, otherSeat(CAR[me].seat))] : null;   // the player's new teammate stays for their first season together
  let moves = 0;
  while (open.length) {
    const key = open.shift(), skip = key === vacated && open.length ? displaced : null;
    // the best first: each candidate's own seeded roll, weighted by how little they are attached to their team (poachScale by the hiring team's tier: lower teams poach, the top tier does not), decides whether they walk; the release fee is paid
    const ps = M.poachScale[tierOf(CAR[key].team).rank - 1], pr = rng(save.seed, 'market', 'poach', season, key);
    const pc = ps && out.poached.length < M.maxPoach ? poachable(save, key, keep, fresh).sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1)).find((c) => pr() < Math.min(1, ps * (M.poachLoyalty - L[c]) / M.poachLoyalty)) : null;
    if (pc) {
      const from = Object.keys(W.seats).find((k) => W.seats[k] === pc);
      out.poached.push({ code: pc, from: CAR[from].team, to: CAR[key].team }); W.seats[from] = null; open.push(from); order(open); W.seats[key] = pc; moved(pc);
      continue;
    }
    const best = shortlistOf(save, key, moves < M.maxMoves).filter((c) => c !== skip).sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1))[0];
    const from = best && Object.keys(W.seats).find((k) => W.seats[k] === best);
    if (from) { W.seats[from] = null; open.push(from); order(open); moves++; } else if (best) W.free.splice(W.free.indexOf(best), 1);
    if (best) { W.seats[key] = best; moved(best); } else { W.seats[key] = callUp(save); sign(W.seats[key]); }
  }
  // a rival (heat 40+) on the rumoured shortlist with the player takes the seat the player wanted: approached, or haggled over and not walked away from (6.6)
  for (const x of save.season?.rumours ?? []) { const now = W.seats[x.car]; if (x.list.includes(YOU) && save.season.talked?.[CAR[x.car].team] && now !== YOU && now !== x.code && x.list.includes(now) && (save.career.heat[now] ?? 0) >= T.rivals.rival) { heatUp(save, now, T.rivals.seatLost, 'seat'); save.career.rivalry[now].cause = 'seat'; } }
  return out;
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
  W.academy[code] = { name, nation }; (W.loyalty ??= {})[code] = M.loyaltyAcademy;
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
    // the duel alone stops at duelMax, short of a rival: a teammate becomes one only by racing you close, touching or passing you
    const pass = g ? Math.min(ev.passes?.[g.key] ?? 0, 2) * R.pass : 0, duel = code === ev.duel ? clamp(R.duelMax - was, 0, R.duel) : 0, near = g && me >= 0 && Math.abs(g.i - me) <= R.near;
    H[code] = clamp(was + (near ? R.close + (beat ? R.beat : 0) : duel ? 0 : -(me < 0 ? R.sitOut : R.decay)) + contact + pass + duel, 0, 100);   // contacts and passes add to the cooling, as the spec has it; a duel that adds heat skips it; a round you sat out cools slowly (you never met)
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
