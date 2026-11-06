// The season-end transfer window and the tactics of a negotiation (docs/career-mode.md 6.10): days with deadlines, rivals for the seat, teams that
// come back with more, your own team's answer, the press; and four moves that answer each principal's style. Pure, like the rest of career/: every
// roll is seeded on the save, so the same choices give the same window.
import MEDIA from '../../../../assets/career/media.json';
import { rng } from './rng.js';
import { TUNING as T, TIERS, STATUS_LABEL, clamp, loreOf, nearestTerms, statusChoices, styleOf, playerRating, tierOf } from './rules.js';
import { personOf, marketScore } from './world.js';
import { post } from './inbox.js';
import { story } from './media.js';
import { offer, findOffer, canNegotiate, leverageOf, patienceOf, patienceMax, refuse, rivalCloser, rivalSigns, keepARoute, news, talksFor } from './offers.js';

const round5 = (v) => Math.round(v / 5) * 5;
const teamName = (id) => loreOf(id).name;
const coins = (n) => `${Math.round(n).toLocaleString('en')} U`;
const pick = (r, l) => l[Math.floor(r() * l.length)];
const fill = (t, ctx) => t.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? '');
/** an offer from another team that can lapse: never your own team's keep, renewal or counter, a fallback seat or the reserve seat (6.7: never a dead end) */
export const isOutside = (save, o) => !o.sponsor && o.team !== save.contract?.team && !o.reserve && !o.fallback && !o.signed;
const outside = (save) => (save.pending?.offers ?? []).filter((o) => isOutside(save, o));

/** the window opens at the season end (career.js endSeason): day 0 of window.days, and every outside offer gets its deadline and maybe a rival */
export function openWindow(save) {
  const w = (save.pending.window = { day: 0, days: T.window.days, news: [], signed: {} }), n = outside(save).length;
  for (const o of outside(save)) talksFor(save, o);
  news(save, n ? `The window is open: ${n} ${n === 1 ? 'team wants' : 'teams want'} to talk. It closes after Day ${w.days}.` : `The window is open until Day ${w.days}. No other team has come to you yet.`);
  return w;
}
/** the window as the screens show it: { day, days, deadline (the last day), closed, news newest first } or null outside the season-end market */
export function windowInfo(save) {
  const w = save.pending?.window; if (!w) return null;
  return { day: w.day, days: w.days, deadline: w.day === w.days - 1, closed: !!w.closed, news: [...w.news].reverse() };
}
/** what advancing would cost, in words: the offers that would lapse or go to a rival */
export function windowWarnings(save) {
  const w = save.pending?.window; if (!w || w.closed) return [];
  const last = w.day === w.days - 1, l = outside(save).filter((o) => !o.agreed), lapse = l.filter((o) => last || o.deadline <= w.day), lost = l.filter((o) => !last && !lapse.includes(o) && o.rival && o.rivalDay <= w.day + 1);
  const and = (x) => x.map((o) => teamName(o.team)).join(' and ');
  return [lapse.length ? `${and(lapse)} ${lapse.length === 1 ? 'lapses' : 'lapse'}` : null, lost.length ? `${and(lost)} will sign ${lost.length === 1 ? 'their rival' : 'their rivals'}` : null].filter(Boolean);
}

/**
 * The day ends. Your own team answers the first time you have talked to another team; on the last day the window closes and every outside offer
 * not agreed lapses (your own team's offers and the reserve never do); otherwise the next day comes: a rival signs on their day, an offer past its
 * deadline lapses, a keen team with a rival on its list may come back with more, and the press may hear of talks. Returns { ok, closed }.
 */
export function windowDay(save) {
  const w = save.pending?.window; if (!w || w.closed) return { ok: false };
  const season = save.clock.season, r = rng(save.seed, 'window', season, w.day);
  ownTeamAnswers(save, r);
  if (w.day >= w.days - 1) {
    for (const o of outside(save).filter((x) => !x.agreed)) lapse(save, o, 'The window closed before you agreed terms.');
    w.closed = true; news(save, 'The window is closed. What is left on the table is yours to sign.'); keepARoute(save);
    return { ok: true, closed: true };
  }
  w.day++;
  for (const o of outside(save).filter((x) => !x.agreed)) {
    if (o.rival && o.rivalDay <= w.day) rivalSigns(save, o);
    else if (o.deadline < w.day) lapse(save, o, `You did not answer by Day ${o.deadline + 1}.`);
    else if (o.rival && !o.raised && o.interest >= T.window.keen && patienceOf(o) > 0 && rng(save.seed, 'window', 'raise', season, o.id, w.day)() < T.window.raiseChance) {
      o.raised = true; o.salary = round5(o.salary * (1 + T.window.raise));
      const line = fill(pick(r, MEDIA.window.raise), { team: teamName(o.team), coins: coins(o.salary) });
      news(save, line); (o.log ??= []).push({ who: 'them', text: line });
      post(save, 'deal', `${teamName(o.team)} come back with more`, line, { deal: o.id });
    }
  }
  const talks = Object.keys(save.season?.talked ?? {}).filter((t) => save.season.talked[t] && t !== save.contract?.team);
  if (talks.length && r() < T.window.leak) {                // a leak: the press reports talks; it changes nothing at the season end
    const t = pick(r, talks), ctx = { me: save.player.name, team: teamName(t) };
    story(save, 'rumor', fill(pick(r, MEDIA.window.leak.title), ctx), fill(pick(r, MEDIA.window.leak.body), ctx), { principal: t });
    news(save, `The press has heard about your talks with ${teamName(t)}.`);
  }
  if (w.day === w.days - 1) news(save, `Deadline day. Anything not agreed today lapses when the window closes.`);   // a plain "Day 2 of 3" line is filler: the header already says it
  keepARoute(save);
  return { ok: true, closed: false };
}
function lapse(save, o, why) {
  const l = save.pending.offers; l.splice(l.indexOf(o), 1);       // a lapse is no refusal: the team remembers nothing (6.5)
  news(save, `${teamName(o.team)}'s offer lapsed.`);
  post(save, 'deal', `${teamName(o.team)}'s offer lapsed`, why);
}
/**
 * Your own team hears you have been talking (season.talked) and answers once, at the end of that day: with trust at trust.renew it raises its
 * counter a step (window.counterStep), or makes one (the A seat for a B-seat driver); with less, the principal tells you to go.
 */
function ownTeamAnswers(save, r) {
  const w = save.pending.window, me = save.contract, talks = Object.keys(save.season?.talked ?? {}).filter((t) => save.season.talked[t] && t !== me?.team);
  if (w.reacted || !talks.length || !me || save.pending.review?.dropped) return;
  w.reacted = true;
  const lore = loreOf(me.team), ctx = { principal: lore.principal, team: lore.name, other: teamName(talks[0]) }, tier = tierOf(me.team);
  if (me.trust < T.trust.renew) { const q = fill(pick(r, MEDIA.window.go), ctx); news(save, q); post(save, 'team', `${lore.name} will not fight for you`, q); return; }
  const mine = save.pending.offers.find((o) => o.team === me.team && o.seat === 'A' && canNegotiate(o) && !o.id.endsWith('-renew')) ?? null;
  if (mine) mine.salary = round5(mine.salary * (1 + T.window.counterStep));
  else save.pending.offers.push(offer(save, me.team, 'A', { status: me.status === 'number1' ? 'number1' : 'lead', salary: round5(Math.max(me.salary, tier.salary.A) * (1 + T.offers.counterRaise + T.window.counterStep)), signing: 0, seasons: 2, interest: T.offers.promoteInterest, tag: '-counter',
    why: `Your team heard you were talking to ${ctx.other}: ${me.seat === 'B' ? 'the A seat' : 'a raise'} to stay.` }));
  const q = fill(pick(r, MEDIA.window.stay), ctx), c = mine ?? save.pending.offers.at(-1);
  news(save, `${lore.name} answer: ${coins(c.salary)} a round to stay${me.seat === 'B' ? ', in the A seat' : ''}. ${q}`);
  post(save, 'team', `${lore.name} want to keep you`, `${q} ${coins(c.salary)} a round${me.seat === 'B' ? ', in the A seat' : ''}.`, { deal: c.id });
}

// ---------------------------------------------------------------------------------------------- tactics (6.10)
export const TACTICS = [
  ['mention', 'Mention the other offer', 'Works when theirs pays more. A bluff costs patience.'],
  ['meet', 'Meet the principal', 'Learn what they give most on. Some principals hate it.'],
  ['deadline', 'Set a deadline', 'Their best terms today, final. A rival may get the seat.'],
  ['want', 'Say you want to be here', 'Buys back patience, costs some leverage.'],
];
/** the best other team's offer in hand, for Mention the other offer: the same list, another team, not your own team's */
const otherOffer = (save, o) => [...(save.pending?.offers ?? save.season?.mid ?? [])].filter((x) => x !== o && !x.sponsor && !x.reserve && x.team !== o.team && x.team !== save.contract?.team).sort((a, b) => b.salary - a.salary)[0] ?? null;
/** whether a tactic can be used on this offer now: { ok, why } with the reason in a few words when not */
export function tacticInfo(save, o, kind) {
  const why = !o || o.sponsor || !canNegotiate(o) ? 'Not in talks' : o.tactics?.[kind] ? 'Used' : kind === 'mention' && !otherOffer(save, o) ? 'No other offer in hand' : kind === 'deadline' && o.final ? 'Their terms are final' : kind === 'want' && patienceOf(o) >= patienceMax(o) ? 'Their patience is full' : null;
  return { ok: !why, why };
}
/**
 * Use a tactic, once per offer; logged in the conversation with the principal's answer in their style's words (media.json window.quotes). At your own team
 * each one costs trust, as a refusal does. Returns { result } with result one of: 'raised', 'held', 'seen' (a bluff, called), 'met', 'final', 'rival'
 * (the team signed its rival instead), 'warmer', 'withdrawn' (out of patience), or 'closed' with the reason.
 */
export function useTactic(save, id, kind) {
  const o = findOffer(save, id), q = tacticInfo(save, o, kind); if (!q.ok) return { result: 'closed', why: q.why };
  const st = styleOf(o.team), style = TIERS.teams[o.team].style, W = T.window, r = rng(save.seed, 'tactic', save.clock.season, o.id, kind), own = o.team === save.contract?.team;
  const say = (who, text) => (o.log ??= []).push({ who, text }), quote = (k, ctx = {}) => say('them', `${loreOf(o.team).principal}: "${fill(pick(r, MEDIA.window.quotes[style][k]), { rival: personOf(save, o.rival)?.name ?? '', ...ctx })}"`);
  (o.tactics ??= {})[kind] = 1;
  if (own) save.contract.trust = clamp(save.contract.trust - T.offers.ownTrust, 0, 100);
  else (save.season.talked ??= {})[o.team] = 1;
  let result;
  if (kind === 'mention') {
    const x = otherOffer(save, o), other = teamName(x.team);
    say('you', `${other} offer ${coins(x.salary)} a round.`);
    if (x.salary > o.salary) {
      const to = st.mention === 'match' ? Math.min(x.salary, o.salary * (1 + W.matchMax)) : st.mention === 'half' ? o.salary + (x.salary - o.salary) / 2 : o.salary;
      result = round5(to) > o.salary ? 'raised' : 'held'; o.salary = Math.max(o.salary, round5(to));
      quote('up', { other }); if (result === 'raised') say('them', `${coins(o.salary)} a round.`);
    } else { result = 'seen'; quote('down', { other }); rivalCloser(save, o); if (refuse(save, o, 1)) return { result: 'withdrawn' }; }
  } else if (kind === 'meet') {
    say('you', 'Can we sit down, just the two of us?'); quote('meet'); say('them', MEDIA.window.prize[style]); result = 'met';
    if (st.meet === 'warm') o.lev = (o.lev ?? 0) + W.warmLeverage;
    if (st.meet === 'cold' && refuse(save, o, 1)) return { result: 'withdrawn' };
  } else if (kind === 'deadline') {
    say('you', 'I need your answer today.');
    const p = o.rival ? st.bluff * clamp(W.bluff + (marketScore(save, o.rival) - playerRating(save)) * W.bluffPerPoint, 0, 1) : 0;
    if (p && r() < p) { quote('rival'); rivalSigns(save, o); return { result: 'rival' }; }
    const L = statusChoices(o), max = { salary: T.offers.demand.salaryMax, signing: o.signing ? T.offers.demand.signingMax : 0, seasons: o.seasons, status: L.at(-1) ?? o.status };
    o.counter = nearestTerms(o, max, leverageOf(save, o)); o.final = true; quote('deadline'); result = 'final';
    const c = o.counter; say('them', `${coins(round5(o.salary * (1 + c.salary)))} a round, ${coins(Math.round(((o.signing ?? 0) * (1 + c.signing)) / 50) * 50)} to sign, ${c.seasons} ${c.seasons === 1 ? 'season' : 'seasons'}, ${STATUS_LABEL[c.status]}. Final.`);
  } else {
    say('you', 'I want to drive for you. I want this to work.'); quote('want');
    o.refusals = Math.max(0, (o.refusals ?? 0) - st.want); o.lev = (o.lev ?? 0) - W.wantLeverage; result = 'warmer';
  }
  return { result };
}
