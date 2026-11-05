// Happiness, fan support and the Shop's things (docs/career-mode.md, Part 3). Pure, like the rest of career/: a save goes in and comes out changed.
// save.life = { happy, fans, owned: { id: count }, sinceOff, ads: { id: count this season }, demanded: season, why: [[label, delta]] }.
// Nothing here reaches paceOf, aiLap or the physics: a mood moves pay, XP, trust gains, offers and the press, never a lap time.
import LIFE from '../../../../assets/career/lifestyle.json';
import { TUNING as T, TIERS, clamp } from './rules.js';

export { LIFE };
export const ITEMS = LIFE.items, TYPES = LIFE.types;
export const itemOf = (id) => ITEMS.find((x) => x.id === id) ?? null;
const r1 = (v) => Math.round(v * 10) / 10;

export const newLife = (rep = 0) => ({ happy: LIFE.happy.start, fans: fansBase(rep), owned: {}, sinceOff: 0, ads: {}, demanded: 0, why: [] });
/** where fan support settles without results: a driver with a name is known a little */
export const fansBase = (rep) => LIFE.fans.start + LIFE.fans.baseRep * rep;
export const bandOf = (happy) => LIFE.bands.find((b) => happy >= b.min);
export const fansName = (fans) => LIFE.fans.names.find(([min]) => fans >= min)[1];
export const mood = (save) => bandOf(save.life.happy);
/** what the current band changes: sponsor pay, XP, the speed trust grows at, the odds of an outside offer, and the extra push in contract talks */
export const payMult = (save) => mood(save).pay;
export const xpMult = (save) => mood(save).xp;
export const trustMult = (save) => mood(save).trust;
export const offerScale = (save) => mood(save).offers;
export const leverageBonus = (save) => mood(save).leverage;
/** may the player demand a transfer: unhappy, once a season */
export const canDemand = (save) => mood(save).id === 'unhappy' && save.life.demanded !== save.clock.season;
export const isHome = (save, track) => !!LIFE.home[save.player.nation]?.includes(track);

export const ownedN = (save, id) => save.life.owned[id] ?? 0;
/** the lift of a luxury now (scaled down for a repeat) and the glow it adds every round */
const rep = (save, item, key) => LIFE.repeat[key] ** ownedN(save, item.id);
export const boostOf = (save, item) => (item.type === 'luxury' ? Math.round(item.boost * rep(save, item, 'boost')) : item.boost);
export const glowOf = (save) => Math.min(LIFE.round.glowMax, r1(ITEMS.reduce((s, x) => s + (x.glow ?? 0) * Array.from({ length: ownedN(save, x.id) }, (_, k) => LIFE.repeat.glow ** k).reduce((a, b) => a + b, 0), 0)));
export const upkeepOf = (save) => ITEMS.reduce((s, x) => s + (x.upkeep ?? 0) * ownedN(save, x.id), 0);

/** the meter moves by a one-off lift (a purchase, an activity) */
export function lift(save, happy = 0, fans = 0) {
  const L = save.life; L.happy = clamp(L.happy + happy, 0, 100); L.fans = clamp(L.fans + fans, 0, 100);
}

/**
 * A race week is scored. x: { rr, finish, dnf, dnq, open, clean, duel, feud (a feud won), home, press: { good, bad }, bill, gross, trust, tier, form }. Fan support follows results, clean racing,
 * the press and a home crowd; happiness follows results, fans, trust, the seat, the press, the repair bill, the lifestyle and the weeks since the last time off, then drifts back to 50.
 * Returns { lines: [[label, delta]], happy, fans, delta, band }.
 */
export function settleRound(save, x) {
  const L = save.life, P = LIFE.round, F = LIFE.fans, lines = [], was = L.happy;
  const add = (label, v) => { if (Math.abs(v) >= 0.05) lines.push([label, r1(v)]); };
  const won = !x.dnf && !x.dnq && x.finish === 1, pod = !x.dnf && !x.dnq && x.finish <= 3;
  // fans first: they feed the mood
  const fd = clamp((x.rr - T.rating.base) * F.perRR, -F.max, F.max) + (won ? F.win : pod ? F.podium : 0) + (x.clean && !x.dnf ? F.clean : 0) + (x.dnf ? F.dnf : 0) + clamp(x.press.good - x.press.bad, -2, 2) * F.press + (x.home ? F.home : 0);
  L.fans = clamp(L.fans + (fansBase(save.career.rep) - L.fans) * F.drift + fd, 0, 100);
  add(x.dnq ? (x.open ? 'Missed the Open' : 'Missed the cut') : `Round rating ${x.rr.toFixed(1)}`, x.dnq ? (x.open ? P.missOpen : P.dnq) : clamp((x.rr - T.rating.base) * P.perRR, -P.max, P.max));
  if (won) add('Won the race', P.win); else if (pod) add('On the podium', P.podium);
  if (x.duel?.result === 'won') add('Beat your teammate', P.duel); else if (x.duel?.result === 'lost') add('Lost to your teammate', -P.duel);
  if (x.feud) add('Beat a rival', P.rival);
  if (x.dnf) add('Retired', P.dnf);
  const last = save.career.rr.slice(-3); if (last.length === 3 && last.reduce((a, b) => a + b, 0) / 3 < 5) add('A poor run of ratings', P.poorRun);
  add(L.fans >= 50 ? 'Fans behind you' : 'Few fans behind you', (L.fans - 50) * P.perFan);
  add(x.trust >= 50 ? 'Your team trusts you' : 'Low team trust', (x.trust - 50) * P.perTrust);
  add('A good seat', P.seat[x.tier] ?? 0);
  if (x.form >= 2 && x.expTeam >= 6) add('A seat below your form', P.belowForm);
  if (x.home) add('A home crowd', P.home);
  const press = clamp(x.press.good, 0, P.pressMax / P.press) * P.press - clamp(x.press.bad, 0, P.pressMax / P.press) * P.press; add(press >= 0 ? 'Friendly press' : 'Bad press', press);
  if (x.bill && x.bill >= x.gross * P.bigRepair) add('A big repair bill', P.repairHit);
  add('Your lifestyle', glowOf(save));
  if (L.sinceOff > P.grindAfter) add('Weeks without time off', -Math.min(P.grindMax, (L.sinceOff - P.grindAfter) * P.grindPer));
  const sum = lines.reduce((s, l) => s + l[1], 0);
  L.happy = clamp(L.happy + (LIFE.happy.start - L.happy) * LIFE.happy.drift + sum, 0, 100);
  L.why = lines;
  return { lines, happy: Math.round(L.happy), fans: Math.round(L.fans), delta: Math.round(L.happy) - Math.round(was), band: mood(save).id };
}

/**
 * The season's upkeep, paid at its start: each unit pays its own upkeep if the wallet holds it, cheapest first; one the wallet cannot cover is sold at half its price (so the
 * wallet never goes below 0 and an owner never falls into debt). Returns { paid, sold: [item ids] }.
 */
export function payUpkeep(save) {
  const L = save.life, units = ITEMS.filter((x) => x.upkeep).flatMap((x) => Array.from({ length: ownedN(save, x.id) }, () => x)).sort((a, b) => a.upkeep - b.upkeep || a.price - b.price), out = { paid: 0, sold: [] };
  for (const x of units) {
    if (save.wallet.coins >= x.upkeep) { save.wallet.coins -= x.upkeep; out.paid += x.upkeep; continue; }
    save.wallet.coins += Math.round(x.price * LIFE.upkeep.sellBack); out.sold.push(x.id);
    if (--L.owned[x.id] <= 0) delete L.owned[x.id];
  }
  L.ads = {};
  return out;
}

/** the tier's pay multiplier for a sponsor ad: it pays what a sponsor day at gold would, scaled by the tier, the form and the mood */
export const adPay = (save, item, form) => Math.round((item.pay * TIERS.tiers[save.season.tier].sponsor * (1 + T.side.formPay * form) * payMult(save)) / 5) * 5;
