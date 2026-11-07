// Everything on the table (docs/career-mode.md 6.5 and section 13): seat offers, the negotiation over them, team moves the player starts himself, and
// personal sponsors. Pure, like the rest of career/: a save goes in and comes out changed; every roll is seeded and stored in the offer.
import MEDIA from '../../../../assets/career/media.json';
import { rng, shuffle } from './rng.js';
import {
  TUNING as T, TIERS, CAL, SPONSORS, TEAM_IDS, CAR, DIV, nextDivOf, expIn, carsIn, parLap, paceOf, clamp, tierOf, seatCar, otherSeat, formOf, interestTerms, interestOf, offerRoll, statusChoices, demandOf, nearestTerms, STATUS_LABEL, loreOf, targetFor, targetText, playerRating, styleOf,
} from './rules.js';
import { YOU, driverAt, personOf, marketScore, shortlistOf, poachable } from './world.js';
import { note, remembers } from './ledger.js';
import { post } from './inbox.js';
import { callbackOf, story } from './media.js';
import { leanOf } from './choices.js';
import { payMult, offerScale, leverageBonus, mood } from './life.js';

const round50 = (v) => Math.round(v / 50) * 50, round5 = (v) => Math.round(v / 5) * 5;
const rankOf = (team) => tierOf(team).rank;
const mean = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0);
const teamName = (id) => loreOf(id).name;
const coins = (n) => `${Math.round(n).toLocaleString('en')} U`;
/** the player wanted this team's seat: they knocked on its door or haggled over its offer, and did not walk away (world.js marketMoves: losing it to a rival is a rivalry) */
const talked = (save, team, v = 1) => { if (save.season) (save.season.talked ??= {})[team] = v; };
export const statsOf = (save) => ({ rep: save.career.rep, rrs: save.career.rr, cl: save.career.cl, form: formOf(save.career.rr) });

export function offer(save, team, seat, terms) {
  return { id: `${team}-${seat}-${save.clock.season}${terms.tag ?? ''}`, team, seat, car: seatCar(team, seat), tier: TIERS.teams[team].tier, div: nextDivOf(save, team), status: seat === 'A' ? 'lead' : 'junior', ...terms };
}
/**
 * A team of the player's tier that races the Elite next season while the player's team races the Challenger: a step up, offered as the tier above would be (divisions-spec 10).
 * Not when even its A seat is expected outside the Elite's grid, for the seat or for this driver in it: a seat that mostly misses the cut is no step up
 */
export const stepUp = (save, team) => !!save.contract && rankOf(team) === rankOf(save.contract.team) && nextDivOf(save, team) === 'elite' && nextDivOf(save, save.contract.team) === 'challenger' && expIn(save, team, 'A', nextDivOf) <= T.series.gridSize && !offGrid(save, team, 'A');
/**
 * An Elite seat of the player's tier or above, offered to a Challenger driver, that would qualify outside the grid for them: their market rating in its car against every car of
 * next season's Elite and its driver (at the teams' dev levels: the market rating already holds the player's own upgrades; no noise). A good Challenger year is no reason to sign for a season of missed cuts
 */
export function offGrid(save, team, seat) {
  if (save.season?.div !== 'challenger' || rankOf(team) < rankOf(save.contract.team) || nextDivOf(save, team) !== 'elite') return false;
  const W = save.world, car = seatCar(team, seat), lap = (k, r) => parLap(CAL.shootout.track, k, 'dry', W.teams[CAR[k].team].dev) / paceOf(r, save.rules.difficulty), mine = lap(car, playerRating(save));
  return carsIn(save, 'elite', nextDivOf).filter((k) => k !== car && W.seats[k] !== YOU && lap(k, W.ratings[W.seats[k]]) < mine).length >= T.series.gridSize;
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
/** how far the player can push this offer: 1 + 4 x interest + 1 per other team's offer in hand + the mood's bonus (life.js) */
export function leverageOf(save, o) {
  if (o.sponsor) return 1 + Math.max(0, formOf(save.career.rr)) * 0.5 + (save.sponsors.offers.length - 1);
  const others = new Set((save.pending?.offers ?? []).filter((x) => x.team !== o.team).map((x) => x.team)).size;
  return 1 + 4 * (o.interest ?? T.offers.firstJobInterest) + others + leverageBonus(save) + (o.lev ?? 0);   // lev: what this offer's tactics won or gave away (transfers.js)
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
/** how many refusals a party takes before walking: a sponsor's, else the principal's style (window.styles patience) */
export const patienceMax = (o) => (o.sponsor ? T.sponsors.refusals : styleOf(o.team)?.patience ?? T.offers.refusals);
export const patienceOf = (o) => Math.max(0, patienceMax(o) - (o.refusals ?? 0));
const COUNTER = [(t, w) => `${t} will not go that far. "This is what we can sign. We want ${w}, and we will pay for it."`, (t) => `${t} come back with a number of their own. "Show us a season like the last one and we talk again."`, (t) => `${t} are polite about it. "Not on those terms. Here is what the budget allows."`];
const AGREE = [(t) => `${t} agree. "Done. Sign when you are ready."`, (t) => `${t} shake on it. "That works for us. Sign when you are ready."`];
/** Ask for better terms. Inside the leverage it is agreed; past it the team names the nearest terms it would sign and loses patience (twice over for an unrealistic ask); out of patience, it walks */
export function negotiate(save, id, ask) {
  const o = findOffer(save, id);
  if (!o || !canNegotiate(o)) return { result: 'fixed' };
  if (o.sponsor) return talkSponsor(save, o, ask);
  if (o.team !== save.contract?.team) talked(save, o.team);
  const L = leversOf(o), name = teamName(o.team), pick = (k, d) => (L[k].includes(ask[k]) ? ask[k] : d);
  const terms = { salary: pick('salary', 0), signing: pick('signing', 0), seasons: pick('seasons', o.seasons), status: pick('status', o.status) };
  if (o.final && JSON.stringify(terms) !== JSON.stringify({ ...terms, ...o.counter })) return { result: 'final', terms: o.counter };   // after Set a deadline only their final terms can be agreed
  const demand = demandOf(o, terms), leverage = leverageOf(save, o), salary = round5(o.salary * (1 + terms.salary)), signing = round50((o.signing ?? 0) * (1 + terms.signing));
  say(o, 'you', `${coins(salary)} a round, ${coins(signing)} to sign, ${terms.seasons} ${terms.seasons === 1 ? 'season' : 'seasons'}, ${STATUS_LABEL[terms.status]}.`);
  if (demand <= leverage) {
    Object.assign(o, { salary, signing, seasons: terms.seasons, status: terms.status, agreed: true, counter: null });
    say(o, 'them', AGREE[(o.log.length >> 1) % AGREE.length](name));
    return { result: 'accepted', terms, demand, leverage };
  }
  const gone = refuse(save, o, demand > leverage * T.offers.tooFar ? 2 : 1); rivalCloser(save, o);
  if (gone) return { result: 'withdrawn', terms, demand, leverage, repLost: gone.repLost };
  const t = (o.counter = nearestTerms(o, terms, leverage));
  say(o, 'them', `${COUNTER[o.refusals % COUNTER.length](name, TIERS.teams[o.team].wants)} ${coins(round5(o.salary * (1 + t.salary)))} a round, ${coins(round50((o.signing ?? 0) * (1 + t.signing)))} to sign, ${t.seasons} ${t.seasons === 1 ? 'season' : 'seasons'}, ${STATUS_LABEL[t.status]}.`);
  return { result: 'countered', terms: o.counter, demand, leverage };
}
/** a refusal (`n` of them) costs the team's patience and, at your own team, trust; out of patience they walk: returns { repLost } when they did, else null */
export function refuse(save, o, n) {
  o.refusals = (o.refusals ?? 0) + n;
  if (o.team === save.contract?.team) save.contract.trust = clamp(save.contract.trust - T.offers.ownTrust, 0, 100);   // haggling with your own team costs trust
  if (o.refusals < patienceMax(o)) return null;
  const repWas = save.career.rep; remove(save, o); save.career.rep = clamp(repWas + T.rep.withdrawn, 0, 1000);
  note(save, 'spurned', { team: o.team, w: T.offers.spurned });   // talks you pushed past their limit: a refusal they remember
  if (save.season?.asked) save.season.asked[o.team] = 1;
  post(save, 'warn', `${teamName(o.team)} walked away`, `Your demands were more than they would pay.${repWas > 0 ? ` Reputation ${T.rep.withdrawn}.` : ''} They will not offer again this window.`);
  keepARoute(save);
  return { repLost: repWas > save.career.rep };
}
/** pushing a team with a rival on its list brings the day it signs them one closer, never earlier than tomorrow (the window's day steps only) */
export const rivalCloser = (save, o) => { const w = save.pending?.window; if (o.rival && w && o.rivalDay !== undefined) o.rivalDay = Math.max(w.day + 1, o.rivalDay - 1); };

/** walk out of talks: free, but the team remembers it and cools for a while (ledger.js), and your own team notices */
export function walkAway(save, id) {
  const o = findOffer(save, id); if (!o || o.keep) return false;
  remove(save, o);
  if (o.sponsor) { post(save, 'sponsor', `You passed on ${o.name}`, 'They will look elsewhere this season.'); return true; }
  if (o.team !== save.contract?.team) { note(save, 'spurned', { team: o.team, w: T.offers.spurned }); talked(save, o.team, 0); }
  if (save.season?.asked) save.season.asked[o.team] = 1;
  if (o.team === save.contract?.team) save.contract.trust = clamp(save.contract.trust - T.offers.ownTrust, 0, 100);
  post(save, 'deal', `You turned ${teamName(o.team)} down`, 'They will not offer again this window.');
  keepARoute(save);
  return true;
}
/** the end-of-season list is never empty (3.1, 6.7): the last offer gone, a reserve seat appears */
export function keepARoute(save) { if (save.pending?.offers && !save.pending.offers.length) save.pending.offers.push(reserveOffer(save)); }

/**
 * A Legend incumbent within market.holdGap of the tier's seated average rating keeps the seat through a bad year: no drop, and a renewal without the
 * raise. The bar is looser than an AI driver's renewal (renewGap), so the market moves AI drivers before it lets such a player go.
 */
export function holdsSeat(save) {
  if (save.season?.tier !== 'legend' || !save.contract) return false;
  const W = save.world, r = Object.entries(W.seats).filter(([k, c]) => c && c !== YOU && TIERS.teams[CAR[k].team].tier === 'legend').map(([, c]) => W.ratings[c]);
  return playerRating(save) >= mean(r) - T.market.holdGap;
}
/** a seat one tier down for a driver who lost a seat above Maestro (6.7): losing a top seat never costs two tiers. The keenest team with an open seat, A first; null in the Rookies and Maestros */
export function fallbackOffer(save) {
  const rank = rankOf(save.contract.team) - 1; if (rank < 2) return null;
  const W = save.world, teams = TEAM_IDS.filter((t) => rankOf(t) === rank).map((t) => [t, interestFor(save, t) ?? 0]).sort((a, b) => b[1] - a[1] || W.teams[a[0]].expPos - W.teams[b[0]].expPos);
  // an open seat if there is one, else any seat whose driver is not a star (offers.star): a fallback always exists
  const pick = teams.flatMap(([t]) => ['A', 'B'].map((x) => [t, x])), open = pick.find(([t, x]) => seatFor(save, t, x)) ?? pick.find(([t, x]) => (W.ratings[W.seats[seatCar(t, x)]] ?? 0) < T.offers.star) ?? pick[0];
  const [team, seat] = open, salary = round50(tierOf(team).salary[seat] * 0.9);
  return offer(save, team, seat, { salary, signing: 0, seasons: 1, interest: T.offers.firstJobInterest, tag: '-fallback', fallback: true,
    why: `${teamName(team)} will take a driver who has raced a tier up: one season to earn your way back.` });
}
/** a Rookie reserve seat for a driver nobody else will sign (6.7): 60 % salary, no points in rounds 1-2, targets one place easier */
export function reserveOffer(save) {
  const rookies = TEAM_IDS.filter((t) => TIERS.teams[t].tier === 'rookie' && t !== save.contract?.team);
  const team = rookies[Math.floor(rng(save.seed, 'market', 'reserve', save.clock.season)() * rookies.length)];
  return offer(save, team, 'B', { salary: round5(TIERS.tiers.rookie.salary.B * T.offers.reserveSalary), signing: 0, seasons: 1, reserve: true, tag: '-reserve',
    why: 'A reserve seat at reduced pay keeps you racing: no points for the first two rounds, and targets one place easier.' });
}

// ---------------------------------------------------------------------------------------------- outside offers
const plural = (n) => (n === 1 ? '' : 's'), avgOf = (l) => mean(l.filter(Number.isFinite));
/** what a team wants (tiers.json `want`), measured on this season's results: { key, n, term } with term its share of interest, up to offers.wantMax */
export function wantOf(save, team) {
  const key = TIERS.teams[team].want, rs = save.season?.results ?? [], ran = rs.filter((r) => !r.dnq && !r.dnf), rr = save.career.rr;
  const n = { cups: save.stats.cups + save.stats.titles, poles: rs.filter((r) => r.pole).length, gained: ran.reduce((a, r) => a + Math.max(0, r.grid - r.finish), 0), clean: ran.filter((r) => r.clean).length,
    seasonsHere: save.contract ? save.clock.season - save.contract.since + 1 : 0, duel: rs.filter((r) => r.duel?.result === 'won' && !r.duel.skipped).length,
    rrTrend: rr.length >= 4 ? Math.round((avgOf(rr.slice(-3)) - avgOf(rr.slice(0, -3).slice(-3))) * 10) / 10 : 0, fromBehind: ran.filter((r) => r.grid - r.finish >= 3).length }[key] ?? 0;
  return { key, n, term: T.offers.wantMax * clamp(n / T.offers.wantNorm[key], 0, 1) };
}
/** how cool a team is on the player after a refusal it remembers (6.5): cool a weight, up to coolMax, fading a step a season */
export const coolOf = (save, team) => Math.min(T.offers.coolMax, T.offers.cool * remembers(save, { team, kinds: ['spurned'] }));
const extraOf = (save, team, { extraRep = 0, cool = true } = {}) => ({ extraRep, want: wantOf(save, team).term, cool: cool ? coolOf(save, team) : 0, lean: leanOf(save, team) });
/** a team's interest in the player as its terms (rules.js interestTerms) or as one number, null below its bar; cool: false for a move the player asked for */
export const termsFor = (save, team, x) => interestTerms(team, statsOf(save), extraOf(save, team, x));
export const interestFor = (save, team, x) => interestOf(team, statsOf(save), extraOf(save, team, x));
/**
 * Whether a team can offer the player this seat (6.5): it is empty, its driver's contract ends this season, or the player outrates them, or they are
 * bought out by a team keen enough (interest at offers.buyout). A star (offers.star) with seasons left on their contract is never dropped for the player.
 */
export function seatFor(save, team, seat, interest = 0) {
  const W = save.world, code = W.seats[seatCar(team, seat)], O = T.offers; if (save.season?.signed?.[seatCar(team, seat)]) return false; if (!code) return true; if (code === YOU) return false;
  if ((W.contracts?.[code] ?? 0) <= 1) return true;
  return W.ratings[code] < O.star && (W.ratings[code] < playerRating(save) || interest >= O.buyout);
}
const surname = (save, code) => (personOf(save, code)?.name ?? code).split(' ').at(-1);
/** who holds a team's seats and to when, when neither is open to the player, or null: 'Ferrand to S4, Okafor to S5' */
function signedTo(save, team, interest = 0) {
  if (['A', 'B'].some((seat) => seatFor(save, team, seat, interest))) return null;
  const W = save.world, to = (seat) => { const c = W.seats[seatCar(team, seat)]; return `${surname(save, c)} to S${save.clock.season + W.contracts[c] - 1}`; };
  return `${to('A')}, ${to('B')}`;
}
/** why a team has no seat for the player, or null: 'Both seats are signed: Ferrand to S4, Okafor to S5' */
export const signedWhy = (save, team, interest = 0) => { const to = signedTo(save, team, interest); return to && `Both seats are signed: ${to}`; };
/** an offer's reason (6.5): the two largest terms of the team's interest in its own words (media.json reasons), a seeded pick of each */
export function whyOf(save, team, terms, tag = '') {
  const r = rng(save.seed, 'why', save.clock.season, team, tag), g = TIERS.teams[team].gate, w = wantOf(save, team), st = statsOf(save);
  const ctx = { team: teamName(team), rep: Math.round(st.rep), gate: g.rep, rr: mean(st.rrs.slice(-6)).toFixed(1), bar: g.rr.toFixed(1), wants: TIERS.teams[team].wants, stat: MEDIA.wantText[w.key].replace(/\{n\}/g, w.n).replace(/\{s\}/g, plural(w.n)) };
  const top = ['rep', 'rating', 'form', 'want'].filter((k) => terms?.[k] > 0).sort((a, b) => terms[b] - terms[a]).slice(0, 2);
  const line = (k) => { const l = MEDIA.reasons[k].filter((x) => (g.rr || !x.includes('{bar}')) && (g.rep || !x.includes('{gate}'))); return l[Math.floor(r() * l.length)].replace(/\{(\w+)\}/g, (_, x) => ctx[x] ?? ''); };   // a team with no bar is never quoted as asking for 0
  return top.length ? top.map(line).join(' ') : `${ctx.team} have a seat for you, and your numbers clear their bar.`;
}
/** the line on an offer from a team that remembers a refusal: the refusal, quoted from the ledger with its season (media.json callbacks) */
const coolLine = (save, team) => callbackOf(save, 'offer', { team, kinds: ['spurned'] }, Infinity)?.text ?? `${teamName(team)} have not forgotten that you turned them down.`;
/** what the paddock remembers of the player's choices (choices.js, team orders), quoted on an outside offer: callout won, press, orders; empty when nothing recent */
const choiceLine = (save) => { const cb = callbackOf(save, 'offer', { kinds: ['callout_won', 'bold_press', 'orders_obeyed', 'orders_ignored'] }); return cb ? ` ${cb.text}` : ''; };
/** several cards at once quote the paddock's memory on the first only: the same sentence on every card reads as boilerplate */
export const quoteOnce = (save, offers) => { const cl = choiceLine(save); if (cl) for (const o of offers.slice(1)) o.why = o.why.replace(cl, ''); };
/** an offer from another team at this interest: the seat by interest, or the other one when it is not open (seatFor) or a big step down in car (5.3); null when neither fits */
export function outsideOffer(save, team, interest, extra = {}) {
  const myZ = TIERS.carZ[save.contract.car] ?? 0, same = rankOf(team) === rankOf(save.contract.team), fast = (x) => (TIERS.carZ[seatCar(team, x)] ?? 0) >= myZ - T.offers.maxCarDropZ;
  const want = same || interest >= 0.6 ? 'A' : 'B', seat = [want, otherSeat(want)].find((x) => fast(x) && seatFor(save, team, x, interest) && !offGrid(save, team, x));   // that seat too slow or not open: the other one
  if (!seat) return null;
  const tier = tierOf(team), salary = round50(tier.salary[seat] * (0.9 + 0.3 * interest)), terms = termsFor(save, team), cool = coolOf(save, team);
  return offer(save, team, seat, { salary, signing: round50(salary * (1.5 + 1.5 * interest)), seasons: 1 + Math.round(2 * interest), interest: Math.round(interest * 100) / 100,
    why: whyOf(save, team, terms, extra.tag) + choiceLine(save), rating: playerRating(save), ...(cool ? { cool: coolLine(save, team) } : {}), ...extra });
}
/** a line in the window's news feed (pending.window.news, shown newest first); nothing outside the season-end window */
export const news = (save, text) => { const w = save.pending?.window; if (w) w.news.push({ day: w.day, text }); };
/**
 * The talks around an outside offer (6.10). On a seeded chance a rival for the seat: the best market score on its shortlist (world.js, seated drivers
 * allowed), never its own driver or the player. In the season-end window a deadline (a hardball team gives a day, a keen one the whole window) and
 * rivalDay, the day the team signs the rival unless terms are agreed first: a day sooner when the rival outscores the player. In mid-season the
 * market week is the window: the rival signs if the offer lapses.
 */
export function talksFor(save, o) {
  const w = save.pending?.window, X = T.window, st = styleOf(o.team), r = rng(save.seed, 'talks', save.clock.season, o.id);
  if (w) o.deadline = Math.min(w.days - 1, w.day + (st.days ? st.days - 1 : o.interest >= X.keen ? w.days - 1 : 1 + Math.floor(r() * (w.days - 1))));
  const best = shortlistOf(save, o.car, true, 2).filter((c) => c !== save.world.seats[o.car] && c !== YOU).map((c) => [c, marketScore(save, c)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  if (!best || r() >= X.rivalChance) return o;
  o.rival = best[0];
  if (w) o.rivalDay = Math.max(w.day + 1, w.day + 1 + Math.floor(r() * (w.days - 1)) - (best[1] > playerRating(save) ? 1 : 0));
  return o;
}
/** the team signs its rival instead (rivalDay came, a bluff called, a mid-season offer lapsed): the offer goes, the rival takes that seat next season (world.js marketMoves) */
export function rivalSigns(save, o) {
  const who = personOf(save, o.rival)?.name ?? o.rival, name = teamName(o.team);
  remove(save, o); (save.pending?.window?.signed ?? (save.season.signed ??= {}))[o.car] = o.rival;
  if (save.season?.asked) save.season.asked[o.team] = 1;
  for (const x of lists(save).flat()) if (x.rival === o.rival) { delete x.rival; delete x.rivalDay; }   // signed once: nobody else can sign them
  news(save, `${who} signs for ${name}. Their offer to you is gone.`);
  post(save, 'deal', `${who} signs for ${name}`, `${name} were also talking to ${who}, and did not wait for your answer. Their offer to you is gone.`);
  story(save, 'move', `${who} signs for ${name}`, `${loreOf(o.team).principal} has the driver ${name} wanted for next season. ${name} were also in talks with ${save.player.name}, and did not wait.`, { driver: o.rival, mood: 'portrait' });
  keepARoute(save);
}
/** the market after the middle round (6.5): under the seat review a warning; from season 2 one poaching offer from the tier above, open until the market week ends */
export function midSeason(save) {
  const me = save.contract, season = save.clock.season, out = { warning: false, w1: null };
  if (!me.warning && me.trust < T.trust.warn) { me.warning = { left: T.trust.recover, met: 0 }; out.warning = true; }
  if (season === 1 || me.next) return out;                  // season 1 is probation: no W1
  const cands = [];
  for (const team of TEAM_IDS.filter((t) => rankOf(t) === rankOf(me.team) + 1)) {
    const interest = interestFor(save, team, { extraRep: T.offers.w1Gate });
    if (interest !== null && offerRoll(save.seed, season, 'W1', team, interest, T.offers.w1Roll * offerScale(save))) cands.push([team, interest]);
  }
  const best = cands.sort((a, b) => b[1] - a[1])[0], o = best && outsideOffer(save, best[0], best[1], { w1: true, tag: '-w1' });
  if (o) {
    o.why += ' They would pay your release clause, and you join them next season.';
    save.season.mid.push(talksFor(save, o)); out.w1 = o.team;
    post(save, 'deal', `${teamName(o.team)} want to talk`, `${o.why} The offer lapses when the market week ends.`, { deal: o.id });
  }
  return out;
}
/** sign a mid-season deal: you stay this season and join them for the next; your cut of the release clause now; your team takes it badly */
export function signMid(save, id) {
  const o = save.season?.mid?.find((x) => x.id === id), me = save.contract; if (!o || me.next) return null;
  const cut = me.seasonsLeft > 1 ? releaseCut(me) : 0;
  me.next = { ...o, signed: true }; save.wallet.coins += cut; me.trust = clamp(me.trust - T.trust.signedAway, 0, 100);
  save.season.mid.splice(0);                                  // the others lapse: not answering is no refusal
  post(save, 'deal', `Signed with ${teamName(o.team)} for next season`, `${cut ? `Your cut of the release clause: ${coins(cut)}. ` : ''}Your team knows, and it has cost you some trust (-${T.trust.signedAway}).`);
  return { cut };
}

// ---------------------------------------------------------------------------------------------- team moves the player starts
const inMarket = (save) => save.clock.phase === 'review' || (save.season?.weeks?.[save.clock.week]?.kind === 'market' && save.clock.phase === 'paddock');
/** a team as the Deals tab shows it: how close the player is to its bar and whether he can knock on the door now */
export function teamOutlook(save, team) {
  const g = TIERS.teams[team].gate, st = statsOf(save), rr = mean(st.rrs.slice(-6));
  const gates = [[st.rep, g.rep, `Reputation ${Math.round(st.rep)} of ${g.rep}`], [rr, g.rr, `Rating ${rr.toFixed(1)} of ${g.rr}`], [st.cl, g.cl, `Level ${st.cl} of ${g.cl}`]];
  const short = gates.filter(([v, min]) => v < min), signed = team !== save.contract?.team && signedTo(save, team, interestFor(save, team) ?? 0), progress = Math.min(...gates.map(([v, min]) => (min ? clamp(v / min, 0, 1) : 1)));
  const me = save.contract, mine = team === me?.team, asked = !!save.season?.asked?.[team], rank = me ? rankOf(me.team) : 1, tooHigh = !mine && me && rankOf(team) > rank + 1, up = !mine && stepUp(save, team), same = rankOf(team) === rank && me?.seat === 'A' && !up, down = rankOf(team) < rank && !me?.dropped;
  const blocked = mine ? 'Your team' : !inMarket(save) ? 'Market closed' : save.pending?.window?.closed ? 'Window closed' : me?.next ? 'You have signed elsewhere' : asked ? 'You have spoken' : [...(save.pending?.offers ?? []), ...(save.season?.mid ?? [])].some((o) => o.team === team) ? 'Offer on the table' : tooHigh ? 'Out of your league' : same ? 'No step up' : down ? 'A step down' : save.clock.phase !== 'review' && save.clock.season === 1 ? 'Probation' : signed ? 'Both seats signed' : null;
  return { team, tier: TIERS.teams[team].tier, progress, why: short[0]?.[2] ?? (signed || 'Clears their bar'), short: short.length > 0, blocked, canAsk: !blocked, step: up ? `A step up: ${DIV.elite.name}` : null };
}
/**
 * Knock on a team's door in a market week or at the season end. No bar cleared, no talks, and you hear why; otherwise a seeded roll on their interest.
 * In mid-season your team can hear about it. One try per team per window. Returns { result: 'offer' | 'no', why, offer }.
 */
export function approach(save, team) {
  const v = teamOutlook(save, team), season = save.clock.season, me = save.contract, mid = save.clock.phase !== 'review'; if (!v.canAsk) return { result: 'closed', why: v.blocked };
  save.season.asked[team] = 1; talked(save, team);
  if (mid && rng(save.seed, 'leak', season, team)() < T.offers.leak) {
    me.trust = clamp(me.trust - T.offers.leakTrust, 0, 100);
    post(save, 'warn', 'Your team heard about the meeting', `Word got back that you spoke to ${teamName(team)}. Team trust -${T.offers.leakTrust}.`);
  }
  const raw = interestFor(save, team), sameTier = rankOf(team) === rankOf(me.team) && !stepUp(save, team), interest = sameTier && raw !== null ? Math.min(raw, T.offers.sameTierInterest) : raw;   // an A seat in your own tier takes a strong year, as at the season end
  const no = (why) => { post(save, 'deal', `${teamName(team)} said no`, why); return { result: 'no', why }; };
  if (interest === null) return no(`${v.why}. Come back when you clear their bar.`);
  if (sameTier && mean(save.career.rr) < T.offers.sameTierRR) return no(`Their A seat takes an average rating of ${T.offers.sameTierRR.toFixed(1)}. Yours is ${mean(save.career.rr).toFixed(1)}.`);
  if (!offerRoll(save.seed, season, 'AP', team, interest, (sameTier ? T.offers.w1Roll : 1) * offerScale(save))) return no('They like you, but they have no plans for you this window.');
  const o = outsideOffer(save, team, interest, { tag: '-ap', ...(mid ? { w1: true } : {}) });
  if (!o) return no(signedWhy(save, team, interest) ? `${signedWhy(save, team, interest)}.` : ['A', 'B'].some((x) => offGrid(save, team, x)) ? `For a driver rated ${playerRating(save)} their seat would qualify outside the ${DIV.elite.short}'s top ${T.series.gridSize}, so they did not offer it.` : 'The only seat they have is a step down in car, so they did not offer it.');
  if (mid) o.why += ' You would join them next season.';
  (mid ? save.season.mid : save.pending.offers).push(talksFor(save, o));
  post(save, 'deal', `${teamName(team)} will talk`, o.why, { deal: o.id });
  return { result: 'offer', why: o.why, offer: o };
}

/**
 * The market week's rumours (6.8), from the market's own state: the seats of other teams whose driver has one season left, best team first (three at
 * most), each with the top three of the shortlist the season-end market will draw up (its drivers in their last season then have two now; world.js marketScore); the player is on it when that team, in
 * their tier or the one above, would talk to them. [{ car, code, list: [codes, 'YOU'] }]
 */
export function rumours(save) {
  const W = save.world, me = save.contract, rank = rankOf(me.team);
  return Object.keys(W.seats).filter((k) => { const c = W.seats[k]; return c && c !== YOU && W.contracts[c] === 1 && CAR[k].team !== me.team; })
    .sort((a, b) => W.teams[CAR[a].team].expPos - W.teams[CAR[b].team].expPos || (CAR[a].seat === 'A' ? -1 : 1)).slice(0, 3).map((car) => {
      const team = CAR[car].team, you = !me.next && rankOf(team) >= rank && rankOf(team) <= rank + 1 && interestFor(save, team) !== null;
      const list = [...new Set([...shortlistOf(save, car, true, 2), ...poachable(save, car)])].filter((c) => c !== W.seats[car]).concat(you ? [YOU] : []).map((c) => [c, marketScore(save, c)]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([c]) => c);
      return { car, code: W.seats[car], list };
    });
}

// ---------------------------------------------------------------------------------------------- the end-of-season market
/**
 * The end-of-season market (6.5): a deal signed in mid-season stands alone; otherwise promotion to the A seat for a won duel and trust,
 * Number One for a Legend lead with a title, up to four outside offers (the tier above, or an A seat in this tier for a strong year),
 * a counter-offer from your own team, and always a way to stay (the contract runs on, a renewal, or a reserve seat): never a dead end.
 */
export function seasonOffers(save, { cup, title, dropped }) {
  const me = save.contract, tier = TIERS.tiers[save.season.tier], season = save.clock.season, list = [];
  if (me.next) return [{ ...me.next, div: nextDivOf(save, me.next.team), why: 'Signed in mid-season. Your new team is waiting.' }];   // the series stamped when it was signed may have moved at the season end
  const d = me.duel;
  if (!dropped && me.seat === 'B' && d.won > d.lost && me.trust >= T.trust.promote)
    list.push(offer(save, me.team, 'A', { salary: tier.salary.A, signing: 0, seasons: 2, interest: T.offers.promoteInterest, why: `You won the duel ${d.won}-${d.lost} and the team trusts you. The senior car is yours.` }));
  if (!dropped && save.season.tier === 'legend' && me.seat === 'A' && me.status !== 'number1' && me.trust >= T.trust.numberOne && (cup || title))
    list.push(offer(save, me.team, 'A', { status: 'number1', salary: tier.salary.N, signing: round50(tier.salary.N * 2), seasons: 3, interest: T.offers.promoteInterest, tag: '-n1',
      why: 'A title and the team behind you: the car is built around you now. Two free upgrade levels a season.' }));
  const st = statsOf(save), outside = [], strong = mean(st.rrs) >= T.offers.sameTierRR;
  for (const team of TEAM_IDS) {
    const rank = rankOf(team), same = rank === tier.rank && !stepUp(save, team);
    if (team === me.team || rank < tier.rank || rank > tier.rank + 1 || (same && (me.seat === 'A' || !strong))) continue;   // the tier above, or an A seat in this one
    const raw = interestFor(save, team), interest = same && raw !== null ? Math.min(raw, T.offers.sameTierInterest) : raw;
    if (interest === null || !offerRoll(save.seed, season, 'W2', team, interest, (same ? T.offers.w1Roll : 1) * offerScale(save))) continue;
    const o = outsideOffer(save, team, interest); if (o) outside.push(o);
  }
  const bids = outside.sort((a, b) => rankOf(b.team) - rankOf(a.team) || b.interest - a.interest).slice(0, T.offers.maxOffers);
  const lo = bids.length >= 2 && bids.at(-1), hi = bids[0], up = lo && Math.min(round50(lo.salary * 1.1), Math.max(lo.salary, hi.salary));   // two teams bidding: the lesser one matches the other, a step up in pay but never past it
  if (up > lo.salary) { const pct = Math.round((up / lo.salary - 1) * 100); lo.salary = up; lo.why += up >= hi.salary ? ` ${teamName(lo.team)} have matched ${teamName(hi.team)}.` : ` ${teamName(lo.team)} have raised their offer ${pct} % to answer ${teamName(hi.team)}.`; }
  list.push(...bids); quoteOnce(save, bids);
  if (!dropped && outside.length && me.trust >= T.trust.renew && !list.some((o) => o.team === me.team) && rng(save.seed, 'counter', season)() < T.offers.counter)
    list.push(offer(save, me.team, 'A', { status: me.status === 'number1' ? 'number1' : 'lead', salary: round5(Math.max(me.salary, tier.salary.A) * (1 + T.offers.counterRaise)), signing: 0, seasons: 2, interest: T.offers.promoteInterest, tag: '-counter',
      why: `Your team has heard about the other offers: ${me.seat === 'B' ? 'the A seat' : 'a raise'} and ${Math.round(T.offers.counterRaise * 100)} % more to stay.` }));
  const hold = !dropped && holdsSeat(save);
  if (dropped || (me.seasonsLeft <= 1 && me.trust < T.trust.renew && !hold)) list.push(...[fallbackOffer(save), reserveOffer(save)].filter(Boolean));
  else if (me.seasonsLeft <= 1 && me.trust < T.trust.renew) list.push(offer(save, me.team, me.seat, { status: me.status, salary: me.salary, signing: 0, seasons: 1, interest: T.offers.promoteInterest, tag: '-renew',
    why: `The team is not happy with the year, but a driver rated ${playerRating(save)} keeps a Legend seat: one more season at the same pay.` }));
  else if (me.seasonsLeft > 1) list.push({ ...offer(save, me.team, me.seat, { status: me.status, salary: me.salary, signing: 0, seasons: me.seasons, tag: '-keep' }), keep: true, why: `Your contract runs ${me.seasonsLeft - 1} more ${me.seasonsLeft - 1 === 1 ? 'season' : 'seasons'}${save.season.div && DIV[nextDivOf(save, me.team)] && nextDivOf(save, me.team) !== save.season.div ? `, in the ${DIV[nextDivOf(save, me.team)].name}` : ''}.` });
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
    const o = { id: `sp-${brand}-${season}-${week}`, sponsor: true, brand, name: B.name, retainer, bonus: round50(retainer * SPONSORS.bonusRounds), target: targetFor(B.target, save.season.div ? expIn(save, save.contract.team, save.contract.seat) : save.season.current.expPos, save.season.calendar.length), expires, why: B.pitch };
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
    const repWas = save.career.rep; remove(save, o); save.career.rep = clamp(repWas + T.sponsors.withdrawnRep, 0, 1000);
    post(save, 'warn', `${o.name} pulled out`, `Your demands put them off.${repWas > 0 ? ` Reputation ${T.sponsors.withdrawnRep}.` : ''}`);
    return { result: 'withdrawn', terms, demand, leverage, repLost: repWas > save.career.rep };
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
  const lines = [], m = payMult(save);                         // a happy driver is worth more to a sponsor, a frustrated one less (life.js)
  for (const d of save.sponsors?.deals ?? []) {
    lines.push([`${d.name} retainer`, round5(d.retainer * m)]);
    if (d.met || !met(d.target, x)) continue;
    const bonus = sponsorCredit(save, d); if (bonus) lines.push([`${d.name} bonus`, bonus]);
  }
  return lines;
}
/** one step toward a deal's season target (a race that met it, or a gold in its Sponsor Challenge): the bonus it pays on the last step, else 0 */
export function sponsorCredit(save, d) {
  if (d.met || ++d.progress < d.target.count) return 0;
  const bonus = round5(d.bonus * payMult(save)); d.met = true;
  post(save, 'sponsor', `${d.name} pays the bonus`, `You hit the target: ${targetText(d.target)}. +${bonus.toLocaleString('en')} U.`);
  return bonus;
}
/** a deal ends: the retainer stops and the reputation takes the hit (a skipped sponsor day, an upset sponsor, an unhappy driver) */
function endDeal(save, d, body) {
  save.career.rep = clamp(save.career.rep + T.sponsors.droppedRep, 0, 1000);
  post(save, 'warn', `${d.name} ended the deal`, body);
  return false;
}
/** one deal loses a step of goodwill; out of goodwill, it ends. Returns whether it stays */
function goodwillDown(save, d, noticed, ended) {
  if (--d.mood > 0) { post(save, 'sponsor', `${d.name} ${noticed.title}`, noticed.body(d.mood)); return true; }
  return endDeal(save, d, ended);
}
/** a sponsor day skipped: every signed sponsor marks it down; out of goodwill, the deal ends */
export function sponsorSkipped(save) {
  const S = save.sponsors;
  S.deals = S.deals.filter((d) => goodwillDown(save, d, { title: 'noticed you did not turn up', body: (m) => `Miss ${m} more ${m === 1 ? 'sponsor day' : 'sponsor days'} and the deal ends.` }, `You missed too many sponsor days. Reputation ${T.sponsors.droppedRep}, and the retainer stops.`));
}
/** the pictures got out and a sponsor is not pleased (a party's scandal): the deal picked by the seeded roll `r` loses goodwill and may end. Returns its name, or null with no sponsor */
export function sponsorUpset(save, r) {
  const S = save.sponsors; if (!S.deals.length) return null;
  const d = S.deals[Math.floor(r * S.deals.length)];
  if (!goodwillDown(save, d, { title: 'is unhappy about the pictures', body: (m) => `One more story like that and the deal could end (goodwill ${m}).` }, `The pictures were the last straw. Reputation ${T.sponsors.droppedRep}, and the retainer stops.`)) S.deals.splice(S.deals.indexOf(d), 1);
  return d.name;
}
/** an unhappy driver loses a sponsor: the one with the least goodwill walks, the same ending as too many skipped days */
export function sponsorWalks(save) {
  const S = save.sponsors; if (!S.deals.length) return null;
  const d = [...S.deals].sort((a, b) => a.mood - b.mood)[0];
  S.deals.splice(S.deals.indexOf(d), 1); endDeal(save, d, `${d.name} no longer sees a happy face for the poster. Reputation ${T.sponsors.droppedRep}, and the retainer stops.`);
  return d.name;
}

// ---------------------------------------------------------------------------------------------- demanding a transfer
/**
 * An unhappy driver asks to leave (once a season). The offers come through the mid-season market: up to two teams, from the tier above (if they would talk to the player) and from their own
 * tier (always: the player is asking, they answer), each signed with signMid and starting next season, open until the player advances the week. Nobody to offer: a reserve seat. Their team takes it
 * badly (trust). Returns { ok, reason?, offers: [ids] }.
 */
export function demandTransfer(save) {
  const me = save.contract, L = save.life;
  if (mood(save).id !== 'unhappy') return { ok: false, reason: 'happy' };
  if (me.next) return { ok: false, reason: 'signed' };
  if (L.demanded === save.clock.season) return { ok: false, reason: 'asked' };
  if (save.season.weeks[save.clock.week].kind === 'race') return { ok: false, reason: 'race' };      // offers lapse when a week is advanced, and a race week is not
  const rank = rankOf(me.team), cands = [];
  for (const team of TEAM_IDS.filter((t) => t !== me.team && rankOf(t) >= rank && rankOf(t) <= rank + 1)) {
    const same = rankOf(team) === rank, raw = interestFor(save, team, { cool: false }), interest = same ? Math.min(Math.max(raw ?? 0, 0.3), T.offers.sameTierInterest) : raw;
    if (interest !== null) cands.push([team, interest]);
  }
  const made = [];
  for (const [team, interest] of cands.sort((a, b) => rankOf(b[0]) - rankOf(a[0]) || b[1] - a[1]).slice(0, 2)) {
    const o = outsideOffer(save, team, interest, { w1: true, tag: '-tr' }); if (!o) continue;
    delete o.cool;                                            // this interest leaves any refusal out (cool: false), so the offer does not quote one
    if (interestFor(save, team, { cool: false }) === null) o.why = `${teamName(team)} were not looking at you (${teamOutlook(save, team).why}), but they have a seat.${choiceLine(save)}`;   // below their bar: their reasons would be untrue
    o.why += ' You asked to move, and they would take you next season.'; o.expires = save.clock.week;
    save.season.mid.push(talksFor(save, o)); made.push(o);
  }
  quoteOnce(save, made);
  if (!made.length) { const o = reserveOffer(save); o.expires = save.clock.week; save.season.mid.push(o); made.push(o); }
  L.demanded = save.clock.season; L.happy = clamp(L.happy + 5, 0, 100);
  me.trust = clamp(me.trust - T.offers.ownTrust * 2, 0, 100);
  post(save, 'deal', 'You asked for a transfer', `${teamName(me.team)} are not pleased (trust -${T.offers.ownTrust * 2}). ${made.length === 1 ? 'One offer is' : `${made.length} offers are`} on the table until you advance the week.`, { deal: made[0].id });
  return { ok: true, offers: made.map((o) => o.id) };
}
