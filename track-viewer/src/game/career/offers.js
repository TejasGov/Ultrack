// Everything on the table (docs/career-mode.md 6.5 and section 13): seat offers, the negotiation over them, team moves the player starts himself, and
// personal sponsors. Pure, like the rest of career/: a save goes in and comes out changed; every roll is seeded and stored in the offer.
import { rng, shuffle } from './rng.js';
import {
  TUNING as T, TIERS, SPONSORS, TEAM_IDS, clamp, tierOf, seatCar, otherSeat, formOf, interestOf, offerRoll, statusChoices, demandOf, nearestTerms, STATUS_LABEL, loreOf, targetFor, targetText,
} from './rules.js';
import { driverAt } from './world.js';
import { post } from './inbox.js';

const round50 = (v) => Math.round(v / 50) * 50, round5 = (v) => Math.round(v / 5) * 5;
const rankOf = (team) => tierOf(team).rank;
const mean = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0);
const teamName = (id) => loreOf(id).name;
const coins = (n) => `${Math.round(n).toLocaleString('en')} U`;
export const statsOf = (save) => ({ rep: save.career.rep, rrs: save.career.rr, cl: save.career.cl, form: formOf(save.career.rr) });

export function offer(save, team, seat, terms) {
  return { id: `${team}-${seat}-${save.clock.season}${terms.tag ?? ''}`, team, seat, car: seatCar(team, seat), tier: TIERS.teams[team].tier, status: seat === 'A' ? 'lead' : 'junior', ...terms };
}
/** every offer the player could be talking about */
const lists = (save) => [save.pending?.offers, save.season?.mid, save.sponsors?.offers].filter(Boolean);
export const findOffer = (save, id) => lists(save).flat().find((o) => o.id === id) ?? null;
const remove = (save, o) => { for (const l of lists(save)) { const i = l.indexOf(o); if (i >= 0) l.splice(i, 1); } };
/** who would share the team with you on this offer: in your own team a promotion swaps you with the A driver */
export function mateOf(save, o) {
  const swap = save.contract && o.team === save.contract.team && o.car !== save.contract.car;
  return driverAt(save, swap ? o.car : seatCar(o.team, otherSeat(o.seat)));
}
export const releaseCut = (c) => round50(T.offers.release * c.salary * (c.seasonsLeft - 1) * T.offers.releaseCut);
/** a line of the conversation, shown on the deal screen until the offer is signed */
const say = (o, who, text) => { (o.log ??= []).push({ who, text }); };

// ---------------------------------------------------------------------------------------------- negotiation (6.5)
/** how far the player can push this offer: 1 + 4 x interest + 1 per other team's offer in hand */
export function leverageOf(save, o) {
  if (o.sponsor) return 1 + Math.max(0, formOf(save.career.rr)) * 0.5 + (save.sponsors.offers.length - 1);
  const others = new Set((save.pending?.offers ?? []).filter((x) => x.team !== o.team).map((x) => x.team)).size;
  return 1 + 4 * (o.interest ?? T.offers.firstJobInterest) + others;
}
export const canNegotiate = (o) => !o.keep && !o.reserve && !o.signed && !o.agreed;
/** the levers an offer allows, for the screen: salary and signing steps, lengths, statuses; or a sponsor's retainer and bonus */
export function leversOf(o) {
  const D = T.offers.demand, steps = (max, step) => Array.from({ length: Math.round(max / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
  if (o.sponsor) return { retainer: steps(T.sponsors.retainerMax, T.sponsors.retainerStep), bonus: steps(T.sponsors.bonusMax, T.sponsors.bonusStep) };
  return { salary: steps(D.salaryMax, D.salaryStep), signing: o.signing ? steps(D.signingMax, D.signingStep) : [0], seasons: [1, 2, 3], status: statusChoices(o) };
}
export const openingAsk = (o) => (o.sponsor ? { retainer: 0, bonus: 0 } : { salary: 0, signing: 0, seasons: o.seasons, status: o.status });
const demandOfSponsor = (t) => Math.round(t.retainer / T.sponsors.retainerStep) + Math.round(t.bonus / T.sponsors.bonusStep);
/** how a proposal lands, for the gauge: 'as offered', 'comfortable', 'pushing' (refused only just past the limit) or 'unrealistic' (costs twice the patience) */
export function pushOf(save, o, ask) {
  const demand = o.sponsor ? demandOfSponsor(ask) : demandOf(o, ask), limit = leverageOf(save, o), F = T.offers.tooFar;
  return { demand, limit, share: clamp(demand / Math.max(0.5, limit * F), 0, 1), label: demand <= 0 ? 'As offered' : demand <= limit * 0.6 ? 'Comfortable' : demand <= limit * 1.15 ? 'Pushing it' : demand <= limit * F ? 'Too much' : 'Unrealistic' };
}
export const patienceOf = (o) => Math.max(0, (o.sponsor ? T.sponsors.refusals : T.offers.refusals) - (o.refusals ?? 0));
const COUNTER = [(t, w) => `${t} will not go that far. "This is what we can sign. We want ${w}, and we will pay for it."`, (t) => `${t} come back with a number of their own. "Show us a season like the last one and we talk again."`, (t) => `${t} are polite about it. "Not on those terms. Here is what the budget allows."`];
const AGREE = [(t) => `${t} agree. "Done. Sign when you are ready."`, (t) => `${t} shake on it. "That works for us. Sign when you are ready."`];
/** Ask for better terms. Inside the leverage it is agreed; past it the team names the nearest terms it would sign and loses patience (twice over for an unrealistic ask); out of patience, it walks */
export function negotiate(save, id, ask) {
  const o = findOffer(save, id);
  if (!o || !canNegotiate(o)) return { result: 'fixed' };
  if (o.sponsor) return talkSponsor(save, o, ask);
  const L = leversOf(o), name = teamName(o.team), own = o.team === save.contract?.team, pick = (k, d) => (L[k].includes(ask[k]) ? ask[k] : d);
  const terms = { salary: pick('salary', 0), signing: pick('signing', 0), seasons: pick('seasons', o.seasons), status: pick('status', o.status) };
  const demand = demandOf(o, terms), leverage = leverageOf(save, o), salary = round5(o.salary * (1 + terms.salary)), signing = round50((o.signing ?? 0) * (1 + terms.signing));
  say(o, 'you', `${coins(salary)} a round, ${coins(signing)} to sign, ${terms.seasons} ${terms.seasons === 1 ? 'season' : 'seasons'}, ${STATUS_LABEL[terms.status]}.`);
  if (demand <= leverage) {
    Object.assign(o, { salary, signing, seasons: terms.seasons, status: terms.status, agreed: true, counter: null });
    say(o, 'them', AGREE[(o.log.length >> 1) % AGREE.length](name));
    return { result: 'accepted', terms, demand, leverage };
  }
  o.refusals = (o.refusals ?? 0) + (demand > leverage * T.offers.tooFar ? 2 : 1);
  if (own && save.contract) save.contract.trust = clamp(save.contract.trust - T.offers.ownTrust, 0, 100);   // haggling with your own team costs trust
  if (o.refusals >= T.offers.refusals) {
    remove(save, o); save.career.rep = clamp(save.career.rep + T.rep.withdrawn, 0, 1000);
    if (save.world.teams[o.team]) save.world.teams[o.team].declined++;
    if (save.season?.asked) save.season.asked[o.team] = 1;
    post(save, 'warn', `${name} walked away`, `Your demands were more than they would pay. Reputation ${T.rep.withdrawn}. They will not offer again this window.`);
    keepARoute(save);
    return { result: 'withdrawn', terms, demand, leverage };
  }
  const t = (o.counter = nearestTerms(o, terms, leverage));
  say(o, 'them', `${COUNTER[o.refusals % COUNTER.length](name, TIERS.teams[o.team].wants)} ${coins(round5(o.salary * (1 + t.salary)))} a round, ${coins(round50((o.signing ?? 0) * (1 + t.signing)))} to sign, ${t.seasons} ${t.seasons === 1 ? 'season' : 'seasons'}, ${STATUS_LABEL[t.status]}.`);
  return { result: 'countered', terms: o.counter, demand, leverage };
}
/** walk out of talks: free, but the team cools (three in a row lowers its interest), and your own team notices */
export function walkAway(save, id) {
  const o = findOffer(save, id); if (!o || o.keep) return false;
  remove(save, o);
  if (o.sponsor) { post(save, 'sponsor', `You passed on ${o.name}`, 'They will look elsewhere this season.'); return true; }
  save.world.teams[o.team].declined++;
  if (save.season?.asked) save.season.asked[o.team] = 1;
  if (o.team === save.contract?.team) save.contract.trust = clamp(save.contract.trust - T.offers.ownTrust, 0, 100);
  post(save, 'deal', `You turned ${teamName(o.team)} down`, 'They will not offer again this window.');
  keepARoute(save);
  return true;
}
/** the end-of-season list is never empty (3.1, 6.7): the last offer gone, a reserve seat appears */
function keepARoute(save) { if (save.pending?.offers && !save.pending.offers.length) save.pending.offers.push(reserveOffer(save)); }

/** a Rookie reserve seat for a driver nobody else will sign (6.7): 60 % salary, no points in rounds 1-2, targets one place easier */
export function reserveOffer(save) {
  const rookies = TEAM_IDS.filter((t) => TIERS.teams[t].tier === 'rookie' && t !== save.contract?.team);
  const team = rookies[Math.floor(rng(save.seed, 'market', 'reserve', save.clock.season)() * rookies.length)];
  return offer(save, team, 'B', { salary: round5(TIERS.tiers.rookie.salary.B * T.offers.reserveSalary), signing: 0, seasons: 1, reserve: true, tag: '-reserve',
    why: 'A reserve seat at reduced pay keeps you racing: no points for the first two rounds, and targets one place easier.' });
}

// ---------------------------------------------------------------------------------------------- outside offers
const WHY = [[0.7, (n) => `${n} want you now. Your reputation and form are ahead of what they asked for.`], [0.35, (n) => `${n} like what they see, and your numbers clear their bar.`], [0, (n) => `${n} have noticed you. You only just clear their bar, so it is a cautious offer.`]];
/** an offer from another team at this interest: the seat by interest, never a big step down in car (5.3); null when no seat fits */
export function outsideOffer(save, team, interest, extra = {}) {
  const myZ = TIERS.carZ[save.contract.car] ?? 0, same = rankOf(team) === rankOf(save.contract.team);
  let seat = same || interest >= 0.6 ? 'A' : 'B';
  if ((TIERS.carZ[seatCar(team, seat)] ?? 0) < myZ - T.offers.maxCarDropZ) { if (seat === 'B') seat = 'A'; else return null; }
  if ((TIERS.carZ[seatCar(team, seat)] ?? 0) < myZ - T.offers.maxCarDropZ) return null;
  const tier = tierOf(team), salary = round50(tier.salary[seat] * (0.9 + 0.3 * interest));
  return offer(save, team, seat, { salary, signing: round50(salary * (1.5 + 1.5 * interest)), seasons: 1 + Math.round(2 * interest), interest: Math.round(interest * 100) / 100,
    why: WHY.find(([min]) => interest >= min)[1](teamName(team)), ...extra });
}
/** the market after the middle round (6.5): under the seat review a warning; from season 2 one poaching offer from the tier above, open until the market week ends */
export function midSeason(save) {
  const me = save.contract, season = save.clock.season, out = { warning: false, w1: null };
  if (!me.warning && me.trust < T.trust.warn) { me.warning = { left: T.trust.recover, met: 0 }; out.warning = true; }
  if (season === 1 || me.next) return out;                  // season 1 is probation: no W1
  const st = statsOf(save), cands = [];
  for (const team of TEAM_IDS.filter((t) => rankOf(t) === rankOf(me.team) + 1)) {
    const interest = interestOf(team, st, { extraRep: T.offers.w1Gate, declined: save.world.teams[team].declined });
    if (interest !== null && offerRoll(save.seed, season, 'W1', team, interest, T.offers.w1Roll)) cands.push([team, interest]);
  }
  const best = cands.sort((a, b) => b[1] - a[1])[0], o = best && outsideOffer(save, best[0], best[1], { w1: true, tag: '-w1' });
  if (o) {
    o.why += ' They would pay your release clause, and you join them next season.';
    save.season.mid.push(o); out.w1 = o.team;
    post(save, 'deal', `${teamName(o.team)} want to talk`, `${o.why} The offer lapses when the market week ends.`, { deal: o.id });
  }
  return out;
}
/** sign a mid-season deal: you stay this season and join them for the next; your cut of the release clause now; your team takes it badly */
export function signMid(save, id) {
  const o = save.season?.mid?.find((x) => x.id === id), me = save.contract; if (!o || me.next) return null;
  const cut = me.seasonsLeft > 1 ? releaseCut(me) : 0;
  me.next = { ...o, signed: true }; save.wallet.coins += cut; me.trust = clamp(me.trust - T.trust.signedAway, 0, 100);
  for (const x of save.season.mid.splice(0)) if (x !== o) save.world.teams[x.team].declined++;
  post(save, 'deal', `Signed with ${teamName(o.team)} for next season`, `${cut ? `Your cut of the release clause: ${coins(cut)}. ` : ''}Your team knows, and it has cost you some trust (-${T.trust.signedAway}).`);
  return { cut };
}

// ---------------------------------------------------------------------------------------------- team moves the player starts
const inMarket = (save) => save.clock.phase === 'review' || (save.season?.weeks?.[save.clock.week]?.kind === 'market' && save.clock.phase === 'paddock');
/** a team as the Deals tab shows it: how close the player is to its bar and whether he can knock on the door now */
export function teamOutlook(save, team) {
  const g = TIERS.teams[team].gate, st = statsOf(save), rr = mean(st.rrs.slice(-6));
  const gates = [[st.rep, g.rep, `Reputation ${Math.round(st.rep)} of ${g.rep}`], [rr, g.rr, `Rating ${rr.toFixed(1)} of ${g.rr}`], [st.cl, g.cl, `Level ${st.cl} of ${g.cl}`]];
  const short = gates.filter(([v, min]) => v < min), progress = Math.min(...gates.map(([v, min]) => (min ? clamp(v / min, 0, 1) : 1)));
  const me = save.contract, mine = team === me?.team, asked = !!save.season?.asked?.[team], rank = me ? rankOf(me.team) : 1, tooHigh = !mine && me && rankOf(team) > rank + 1, same = rankOf(team) === rank && me?.seat === 'A', down = rankOf(team) < rank && !me?.dropped;
  const blocked = mine ? 'Your team' : !inMarket(save) ? 'Market closed' : me?.next ? 'You have signed elsewhere' : asked ? 'You have spoken' : [...(save.pending?.offers ?? []), ...(save.season?.mid ?? [])].some((o) => o.team === team) ? 'Offer on the table' : tooHigh ? 'Out of your league' : same ? 'No step up' : down ? 'A step down' : save.clock.phase !== 'review' && save.clock.season === 1 ? 'Probation' : null;
  return { team, tier: TIERS.teams[team].tier, progress, why: short[0]?.[2] ?? 'Clears their bar', short: short.length > 0, blocked, canAsk: !blocked };
}
/**
 * Knock on a team's door in a market week or at the season end. No bar cleared, no talks, and you hear why; otherwise a seeded roll on their interest.
 * In mid-season your team can hear about it. One try per team per window. Returns { result: 'offer' | 'no', why, offer }.
 */
export function approach(save, team) {
  const v = teamOutlook(save, team), season = save.clock.season, me = save.contract, mid = save.clock.phase !== 'review'; if (!v.canAsk) return { result: 'closed', why: v.blocked };
  save.season.asked[team] = 1;
  if (mid && rng(save.seed, 'leak', season, team)() < T.offers.leak) {
    me.trust = clamp(me.trust - T.offers.leakTrust, 0, 100);
    post(save, 'warn', 'Your team heard about the meeting', `Word got back that you spoke to ${teamName(team)}. Team trust -${T.offers.leakTrust}.`);
  }
  const raw = interestOf(team, statsOf(save), { declined: save.world.teams[team].declined }), sameTier = rankOf(team) === rankOf(me.team), interest = sameTier && raw !== null ? Math.min(raw, T.offers.sameTierInterest) : raw;   // an A seat in your own tier takes a strong year, as at the season end
  const no = (why) => { post(save, 'deal', `${teamName(team)} said no`, why); return { result: 'no', why }; };
  if (interest === null) return no(`${v.why}. Come back when you clear their bar.`);
  if (sameTier && mean(save.career.rr) < T.offers.sameTierRR) return no(`Their A seat takes an average rating of ${T.offers.sameTierRR.toFixed(1)}. Yours is ${mean(save.career.rr).toFixed(1)}.`);
  if (!offerRoll(save.seed, season, 'AP', team, interest, sameTier ? T.offers.w1Roll : 1)) return no('They like you, but they have no plans for you this window.');
  const o = outsideOffer(save, team, interest, { tag: '-ap', ...(mid ? { w1: true } : {}) });
  if (!o) return no('The only seat they have is a step down in car, so they did not offer it.');
  if (mid) { o.why += ' You would join them next season.'; save.season.mid.push(o); } else save.pending.offers.push(o);
  post(save, 'deal', `${teamName(team)} will talk`, o.why, { deal: o.id });
  return { result: 'offer', why: o.why, offer: o };
}

// ---------------------------------------------------------------------------------------------- the end-of-season market
/**
 * The end-of-season market (6.5): a deal signed in mid-season stands alone; otherwise promotion to the A seat for a won duel and trust,
 * Number One for a Legend lead with a title, up to four outside offers (the tier above, or an A seat in this tier for a strong year),
 * a counter-offer from your own team, and always a way to stay (the contract runs on, a renewal, or a reserve seat): never a dead end.
 */
export function seasonOffers(save, { cup, title, dropped }) {
  const me = save.contract, tier = TIERS.tiers[save.season.tier], season = save.clock.season, list = [];
  if (me.next) return [{ ...me.next, why: 'Signed in mid-season. Your new team is waiting.' }];
  const d = me.duel, raced = d.won + d.lost + d.level;
  if (!dropped && me.seat === 'B' && raced && d.won / raced >= T.offers.promoteDuelShare && me.trust >= T.trust.promote)
    list.push(offer(save, me.team, 'A', { salary: tier.salary.A, signing: 0, seasons: 2, interest: T.offers.promoteInterest, why: `You won the duel ${d.won}-${d.lost} and the team trusts you. The senior car is yours.` }));
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

// ---------------------------------------------------------------------------------------------- personal sponsors
export const sponsorSlots = (save) => TIERS.tiers[save.season.tier].rank;
/** a window's sponsor offers (none when every slot is taken), each open until `expires` (a week index) */
export function sponsorOffers(save, expires) {
  const S = save.sponsors, tier = save.season.tier, season = save.clock.season, week = save.clock.week;
  if (S.deals.length >= sponsorSlots(save)) return;
  const taken = new Set([...S.deals, ...S.offers].map((x) => x.brand)), r = rng(save.seed, 'sponsor', season, week);
  const pool = shuffle(r, Object.keys(SPONSORS.brands).filter((b) => SPONSORS.brands[b].tier === tier && !taken.has(b))).slice(0, SPONSORS.offersPerWindow);
  for (const brand of pool) {
    const B = SPONSORS.brands[brand], retainer = round5(SPONSORS.retainer[tier] * (0.85 + 0.3 * r()));
    const o = { id: `sp-${brand}-${season}-${week}`, sponsor: true, brand, name: B.name, retainer, bonus: round50(retainer * SPONSORS.bonusRounds), target: targetFor(B.target, save.season.current.expPos, save.season.calendar.length), expires, why: B.pitch };
    S.offers.push(o);
    post(save, 'sponsor', `${B.name} wants a word`, `${B.pitch} ${retainer} U a round, and ${o.bonus.toLocaleString('en')} U if you ${targetText(o.target)}. Open until week ${expires + 1}.`, { deal: o.id });
  }
}
function talkSponsor(save, o, ask) {
  const L = leversOf(o), terms = { retainer: L.retainer.includes(ask.retainer) ? ask.retainer : 0, bonus: L.bonus.includes(ask.bonus) ? ask.bonus : 0 };
  const demand = demandOfSponsor(terms), leverage = leverageOf(save, o), retainer = round5(o.retainer * (1 + terms.retainer)), bonus = round50(o.bonus * (1 + terms.bonus));
  say(o, 'you', `${coins(retainer)} a round, ${coins(bonus)} on the target.`);
  if (demand <= leverage) {
    Object.assign(o, { retainer, bonus, agreed: true, counter: null }); say(o, 'them', `${o.name} agree. "Sign when you are ready."`);
    return { result: 'accepted', terms, demand, leverage };
  }
  o.refusals = (o.refusals ?? 0) + (demand > leverage * T.offers.tooFar ? 2 : 1);
  if (o.refusals >= T.sponsors.refusals) {
    remove(save, o); save.career.rep = clamp(save.career.rep + T.sponsors.withdrawnRep, 0, 1000);
    post(save, 'warn', `${o.name} pulled out`, `Your demands put them off. Reputation ${T.sponsors.withdrawnRep}.`);
    return { result: 'withdrawn', terms, demand, leverage };
  }
  const t = { ...terms }; while (demandOfSponsor(t) > leverage && (t.bonus > 0 || t.retainer > 0)) { if (t.bonus > 0) t.bonus = Math.round((t.bonus - T.sponsors.bonusStep) * 100) / 100; else t.retainer = Math.round((t.retainer - T.sponsors.retainerStep) * 100) / 100; }
  o.counter = t; say(o, 'them', `${o.name} come back lower. "This is our budget for a driver at your level." ${coins(round5(o.retainer * (1 + t.retainer)))} a round, ${coins(round50(o.bonus * (1 + t.bonus)))} on the target.`);
  return { result: 'countered', terms: t, demand, leverage };
}
/** sign a sponsor: it pays every round for the season; a free slot is needed */
export function signSponsor(save, id) {
  const S = save.sponsors, o = S.offers.find((x) => x.id === id); if (!o) return { ok: false, reason: 'gone' };
  if (S.deals.length >= sponsorSlots(save)) return { ok: false, reason: 'slots' };
  S.offers.splice(S.offers.indexOf(o), 1);
  S.deals.push({ brand: o.brand, name: o.name, retainer: o.retainer, bonus: o.bonus, target: o.target, progress: 0, met: false, mood: SPONSORS.startMood });
  post(save, 'sponsor', `Signed with ${o.name}`, `${o.retainer} U a round for the season, and ${o.bonus.toLocaleString('en')} U if you ${targetText(o.target)}. Turn up to their sponsor days: miss ${SPONSORS.startMood} and the deal ends.`);
  if (S.deals.length >= sponsorSlots(save)) for (const x of S.offers.splice(0)) post(save, 'sponsor', `${x.name} moved on`, 'You have no sponsor slot left, so their offer is closed.');
  return { ok: true };
}
/** a round's money from sponsors, and the target's progress; x is what happened in the race */
export function sponsorRound(save, x, met) {
  const lines = [];
  for (const d of save.sponsors?.deals ?? []) {
    lines.push([`${d.name} retainer`, d.retainer]);
    if (d.met || !met(d.target, x)) continue;
    d.progress++;
    if (d.progress >= d.target.count) { d.met = true; lines.push([`${d.name} bonus`, d.bonus]); post(save, 'sponsor', `${d.name} pays the bonus`, `You hit the target: ${targetText(d.target)}. +${d.bonus.toLocaleString('en')} U.`); }
  }
  return lines;
}
/** a sponsor day skipped: every signed sponsor marks it down; out of goodwill, the deal ends */
export function sponsorSkipped(save) {
  const S = save.sponsors;
  S.deals = S.deals.filter((d) => {
    if (--d.mood > 0) { post(save, 'sponsor', `${d.name} noticed you did not turn up`, `Miss ${d.mood} more ${d.mood === 1 ? 'sponsor day' : 'sponsor days'} and the deal ends.`); return true; }
    save.career.rep = clamp(save.career.rep + T.sponsors.droppedRep, 0, 1000);
    post(save, 'warn', `${d.name} ended the deal`, `You missed too many sponsor days. Reputation ${T.sponsors.droppedRep}, and the retainer stops.`);
    return false;
  });
}
