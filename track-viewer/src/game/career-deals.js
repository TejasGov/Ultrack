// The negotiation (docs/career-mode.md section 13): its own screen for contracts, offers, team moves and sponsors. Their last word beside your ask, how hard
// you are pushing, their patience, what a refusal costs, the conversation so far. Esc leaves and the talks stay open. offerRow and teamRows are the Deals tab's and the season review's lists.
import { h, fill, css, seg, stat, still, teamLogo, teamMark, getNav, prompt, fadeMore } from './ui.js';
import { carName } from './carinfo.js';
import { icon } from './icons.js';
import * as C from './career/career.js';
import { TUNING, TIERS, CAR, STATUS_LABEL, TEAM_IDS, DIV, loreOf, targetText, expIn, teamsIn, nextDivOf } from './career/rules.js';
import MEDIA from '../../../assets/career/media.json';
import { frame, statusBar, coins, money, rich, teamName, persist, available, prompts, CHOOSE, blockHead, brandMark, divChip } from './career-shell.js';

const round5 = (v) => Math.round(v / 5) * 5, round50 = (v) => Math.round(v / 50) * 50;
const seasons = (n) => `${n} ${n === 1 ? 'season' : 'seasons'}`;

/** an offer as a row: what it is, its terms in a line, whose move it is */
export function offerRow(save, o, open) {
  const left = o.sponsor ? brandMark(o.brand) : h('img.car', { src: still('cars', o.car), alt: '', decoding: 'async' });
  const title = o.sponsor ? `${o.name}: personal sponsor` : `${teamName(o.team)}: ${carName(o.car)}`;
  const line = o.sponsor ? `${money(o.retainer)} a round, ${money(o.bonus)} if you ${targetText(o.target)}` : `${TIERS.tiers[o.tier].name}, ${o.seat} seat, ${STATUS_LABEL[o.status]}. ${money(o.salary)} a round${o.signing ? `, ${money(o.signing)} to sign` : ''}, ${seasons(o.keep ? save.contract.seasonsLeft - 1 : o.seasons)}`;
  const tag = o.agreed ? h('span.cx-tag.ok', {}, icon('check'), 'Agreed: sign it') : o.signed ? h('span.cx-tag.ok', {}, icon('check'), 'Signed') : o.counter ? h('span.cx-tag.warn', {}, icon('warning'), 'They countered') : h('span.cx-tag.warn', {}, icon('chevron-right'), C.canNegotiate(o) ? 'Your move' : 'Take it or leave it');
  const chips = [!o.sponsor && divChip(o.div ?? nextDivOf(save, o.team)), answerBy(save, o) && h('span.cx-chip' + (answerBy(save, o) === 'Answer today' ? '.hot' : ''), {}, icon('calendar'), answerBy(save, o)), o.rival && h('span.cx-chip.rival', {}, icon('people'), `Rival: ${surname(save, o.rival)}`)].filter(Boolean);
  return css(h('button.cx-offer', { 'data-nav': '', onclick: open }, left, h('span', {}, h('strong', {}, title), h('small', {}, rich(line)), o.why ? h('small', {}, rich(o.why)) : null, chips.length ? h('span.cx-chips', {}, chips) : null),
    h('span.act', {}, tag, o.expires !== undefined ? h('small', {}, `Until week ${o.expires + 1}`) : null)), { '--team': o.sponsor ? 'transparent' : teamMark(loreOf(o.team)) });
}
const surname = (save, code) => (C.personOf(save, code)?.name ?? code).split(' ').at(-1);
/** an outside offer's deadline in the season-end window: 'Answer today' or 'Answer by Day N'; null for one that cannot lapse or is agreed */
export function answerBy(save, o) {
  const w = C.windowInfo(save); if (!w || o.deadline === undefined || o.agreed) return null;
  return o.deadline <= w.day ? 'Answer today' : `Answer by Day ${o.deadline + 1}`;
}
/** the rival in the talks, in a line: who, rated, and when the team signs them */
export function rivalLine(save, o) {
  if (!o.rival) return null;
  const d = C.personOf(save, o.rival), w = C.windowInfo(save), who = `Also in talks: ${d?.name ?? o.rival} (rated ${save.world.ratings[o.rival]}).`;
  if (!w || o.rivalDay === undefined) return `${who} ${teamName(o.team)} sign them if you have not signed by the end of the market week.`;
  return o.agreed ? `${who} You agreed terms first: the seat is yours to sign.` : o.rivalDay <= w.day + 1 ? `${who} They want an answer today.` : `${who} They want an answer before Day ${o.rivalDay + 1}.`;
}
/** the teams, closest first: how near the player is to each bar and the real reason; in a market week Enter knocks on the door */
export function teamRows(save, game, rebuild) {
  const elite = (t) => (nextDivOf(save, t) === 'elite' ? 0 : 1);   // next season's Elite first, then by tier
  return TEAM_IDS.filter((t) => t !== save.contract.team).map((t) => C.teamOutlook(save, t)).sort((a, b) => elite(a.team) - elite(b.team) || TIERS.tiers[a.tier].rank - TIERS.tiers[b.tier].rank || b.progress - a.progress).map((v) => css(
    h('div.lrow.cx-teamrow', { 'data-nav': '', 'data-team': v.team, tabIndex: 0, role: 'button', 'aria-label': `Approach ${teamName(v.team)}`, onclick: () => {
      if (!v.canAsk) return game.setBusy(`${teamName(v.team)}: ${v.blocked}.`, { kind: 'error', ms: 4000 });
      const r = C.approach(save, v.team); persist(game); game.setBusy(r.result === 'offer' ? `${teamName(v.team)} will talk. Their offer is on the table.` : `${teamName(v.team)}: ${r.why}`, r.result === 'offer' ? {} : { kind: 'error', ms: 4000 }); rebuild();
      const at = getNav().items().findIndex((e) => e.dataset.team === v.team); if (at >= 0) getNav().reset(at);   // a new offer row moved everything down
    } }, h('i.cx-tbar'), h('span.c-name', {}, h('b', {}, teamName(v.team)), h('small', {}, divChip(nextDivOf(save, v.team)), ' ', TIERS.tiers[v.tier].name)), css(h('span.cx-gauge', {}, h('i')), { '--p': v.progress }),
      h('small.why', {}, v.step ? `${v.step} · ${v.why}` : v.why), h('span.cx-tag' + (v.canAsk ? '.talk' : ''), {}, v.canAsk ? 'Approach' : v.blocked)), { '--team': teamMark(loreOf(v.team)) }));
}

/** one term of a deal: the label, their standing number, your ask as a segmented control (Left/Right steps it) */
function term(label, was, choices, value, set) {
  const control = seg(choices, value, set);
  return h('div.row.cx-term', { 'data-nav': '', 'data-adjust': '', tabIndex: 0, role: 'group', 'aria-label': label, onadjust: (e) => control.step?.(e.detail), onclick: () => control.step?.(1) }, h('label', {}, label), h('span.was.tnum', {}, rich(was)), control);
}
export function CareerDealScreen(game) {
  const F = frame('career-deal'), stages = h('div.cx-stages');
  F.el.insertBefore(stages, F.page); F.page.classList.add('cx-deal');
  let id = null, home = 'careerHub', ask = null, walking = false;
  const leave = () => (home === 'careerStart' ? game.show('careerStart') : game.show('careerHub', 'deals'));
  const stage = (o) => {
    const at = o.agreed || o.keep || o.reserve || o.signed ? 3 : o.counter ? 2 : o.log?.length ? 1 : 0;
    fill(stages, ['Their offer', 'Your proposal', 'Their counter', 'Sign'].flatMap((s, i) => [h(i === at ? 'b' : i < at ? 'span.done' : 'span', {}, i < at ? icon('check') : h('i', {}, i + 1), s), i < 3 ? icon('chevron-right') : null]));
  };
  /** who you are talking to */
  function party(save, o) {
    if (o.sponsor) return h('div.cx-b.cx-party', {}, blockHead(null, 'Personal sponsor', 'One season'), h('div.cx-partylogo', {}, brandMark(o.brand)), h('strong.cx-title', {}, o.name),
      h('div.cx-kv.two', {}, stat('Their target', targetText(o.target)), stat('Sponsor days', C.challengeOf(o).name)), h('p.cx-if', {}, C.challengeOf(o).objectives.join(' · ')), h('p.cx-note', {}, o.why));
    const inc = o.rating && C.driverAt(save, o.car), mate = C.mateOf(save, o), d = nextDivOf(save, o.team), exp = expIn(save, o.team, o.seat, nextDivOf), lore = loreOf(o.team), old = save.contract, cut = old && o.team !== old.team && !o.signed && !o.reserve && !old.dropped && old.seasonsLeft > 1;
    return css(h('div.cx-b.cx-party', {}, blockHead(null, `${TIERS.tiers[o.tier].name} · ${o.seat} seat`, '#' + CAR[o.car].number), h('img.car', { src: still('cars', o.car), alt: '', decoding: 'async' }), teamLogo(lore), h('strong.cx-title', {}, carName(o.car)),
      h('div.cx-kv.two', {}, stat('Teammate', `${mate.name} · ${mate.rating}`), stat(DIV[d] ? `Expected in the ${DIV[d].short}` : 'Expected', `P${exp} of ${2 * teamsIn(save, d, nextDivOf).length}`), stat('Upgrade cap', 'Level ' + TIERS.tiers[o.tier].cap), stat('They want', TIERS.teams[o.team].wants),
        ...(o.rating ? [stat('Your market rating', String(o.rating)), stat('In the seat now', inc ? `${inc.name} · ${inc.rating}` : 'Nobody')] : [])),
      h('p.cx-if.cx-principal', {}, h('b', {}, lore.principal), ` · ${MEDIA.window.read[TIERS.teams[o.team].style]}`), clock(save, o),
      h('p.cx-note', {}, rich(o.why ?? o.pitch)), o.cool ? h('p.cx-if', {}, o.cool) : null, cut ? h('p.cx-if', {}, rich(`Leaving ${teamName(old.team)} early pays you ${money(C.releaseCutOf(old))} of the release clause.`)) : null, o.difficulty ? h('p.cx-if', {}, `Difficulty: ${o.difficulty}`) : null), { '--team': teamMark(lore) });
  }
  /** the terms, your ask, the gauge, what a refusal costs, the buttons */
  function terms(save, o) {
    const L = C.leversOf(o), can = C.canNegotiate(o), set = (k) => (v) => { ask[k] = v; walking = false; build(true); }, said = o.counter ?? C.openingAsk(o);
    ask ??= { ...said };
    const rows = o.sponsor ? [
      term('Retainer', money(round5(o.retainer * (1 + said.retainer))), L.retainer.map((v) => [v, `${round5(o.retainer * (1 + v))}`]), ask.retainer, set('retainer')),
      term('Bonus', money(round50(o.bonus * (1 + said.bonus))), L.bonus.map((v) => [v, round50(o.bonus * (1 + v)).toLocaleString('en')]), ask.bonus, set('bonus')),
    ] : [
      term('Salary', money(round5(o.salary * (1 + said.salary))), L.salary.map((v) => [v, `${round5(o.salary * (1 + v))}`]), ask.salary, set('salary')),
      L.signing.length > 1 ? term('Signing', money(round50(o.signing * (1 + said.signing))), L.signing.map((v) => [v, round50(o.signing * (1 + v)).toLocaleString('en')]), ask.signing, set('signing')) : null,
      term('Length', seasons(said.seasons), L.seasons.map((v) => [v, String(v)]), ask.seasons, set('seasons')),
      L.status.length > 1 ? term('Status', STATUS_LABEL[said.status], L.status.map((v) => [v, STATUS_LABEL[v]]), ask.status, set('status')) : null,
    ];
    const P = C.pushOf(save, o, ask), left = C.patienceOf(o), max = C.patienceMax(o), others = o.sponsor ? save.sponsors.offers.length - 1 : new Set((save.pending?.offers ?? []).filter((x) => x.team !== o.team).map((x) => x.team)).size;
    const name = o.sponsor ? o.name : teamName(o.team), own = !o.sponsor && o.team === save.contract?.team;
    const risk = `${left === 1 ? `One more refusal and ${name} walk` : `If ${name} run out of patience they walk`}${save.career.rep > 0 ? `: reputation ${o.sponsor ? TUNING.sponsors.withdrawnRep : TUNING.rep.withdrawn}` : ''}${o.sponsor ? '' : ', and no more talks this window'}.${own ? ` Every refusal from your own team costs ${TUNING.offers.ownTrust} trust.` : ''}${others ? ` ${others} other ${others === 1 ? 'offer' : 'offers'} in hand: that is your leverage.` : ''}`;
    const asked = JSON.stringify(ask) !== JSON.stringify(said);
    return h('div.cx-b.cx-termsb', {}, blockHead('contract', 'The terms', o.final ? 'Their final terms beside your ask' : o.counter ? 'Their last word beside your ask' : 'Their offer beside your ask'),
      can ? [h('div.cx-termhead', {}, h('span', {}, 'Term'), h('span', {}, o.final ? h('span.cx-tag.warn', {}, 'Final') : o.counter ? 'They say' : 'They offer'), h('span', {}, 'You ask')), rows,
        h('div.cx-tension', {}, h('div.r2', {}, h('span', {}, 'How hard you are pushing'), h('b', {}, P.label)), css(h('div.bar', {}, h(P.demand > P.limit * 1.15 ? 'i.over' : 'i')), { '--p': P.share }),
          h('div.r2', {}, h('span', {}, 'Their patience'), h('span.cx-pips', {}, Array.from({ length: max }, (_, i) => h(i < left ? 'i.on' : 'i'))))),
        h('p.cx-if', {}, rich(risk))] : fixedTerms(save, o),
      h('div.cx-acts', {}, buttons(save, o, can, asked)));
  }
  /** when they want an answer: the deadline in the window, and the rival they are also talking to */
  function clock(save, o) {
    const by = answerBy(save, o), rv = rivalLine(save, o); if (!by && !rv) return null;
    return h('div.cx-clock', {}, by ? h('span.cx-chip' + (by === 'Answer today' ? '.hot' : ''), {}, icon('calendar'), by) : null, rv ? h('p.cx-note.warn', {}, icon('people'), rv) : null);
  }
  /** the four tactics (6.10), once each per offer: the risk on the button, the reason when it cannot be used */
  function tactics(save, o) {
    const name = teamName(o.team), own = o.team === save.contract?.team;
    return h('div.cx-tactics', {}, C.TACTICS.map(([k, label, hint]) => { const q = C.tacticInfo(save, o, k);
      return h('button.cx-tactic', q.ok ? { 'data-nav': '', onclick: () => {
        const r = C.useTactic(save, o.id, k); persist(game); ask = null; walking = false;
        if (r.result === 'withdrawn') { game.setBusy(`${name} walked away.`, { kind: 'error', ms: 4000 }); return leave(); }
        if (r.result === 'rival') { game.setBusy(`${name} signed ${C.personOf(save, o.rival)?.name ?? 'their other driver'} instead.`, { kind: 'error', ms: 4000 }); return leave(); }
        game.setBusy({ raised: `${name} raised their offer.`, held: `${name} held their number.`, seen: `${name} saw through it. Their patience is shorter.`, met: 'You met the principal.', final: `${name} named their final terms.`, warmer: `${name} warmed to you.` }[r.result] ?? '', ['seen'].includes(r.result) ? { kind: 'error', ms: 4000 } : {});
        build();
      } } : { disabled: true, title: q.why }, h('b', {}, label), h('small', {}, q.ok ? (own ? `${hint} Costs ${TUNING.offers.ownTrust} trust.` : hint) : q.why)); }));
  }
  const fixedTerms = (save, o) => (o.sponsor ? h('div.cx-kv', {}, stat('Retainer', coins(o.retainer), '/ ROUND'), stat('Bonus', coins(o.bonus)), stat('Target', targetText(o.target)))
    : h('div.cx-kv', {}, stat('Salary', coins(o.salary), '/ ROUND'), stat('Signing', o.signing ? coins(o.signing) : '—'), stat('Length', seasons(o.keep ? save.contract.seasonsLeft - 1 : o.seasons)), stat('Status', STATUS_LABEL[o.status])));
  function buttons(save, o, can, asked) {
    const name = o.sponsor ? o.name : teamName(o.team), primary = (ic, label, onclick) => h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick }, icon(ic), label), second = (ic, label, onclick) => h('button.btn.btn-secondary', { 'data-nav': '', onclick }, icon(ic), label);
    const sign = () => doSign(save, o), keep = o.keep ? primary('check', `Stay at ${name}`, sign) : null;
    if (!can) return [keep ?? primary('check', o.signed ? `Join ${name}` : `Sign with ${name}`, sign), h('div.sp'), o.keep || o.signed || o.reserve ? null : walk(save, o)];
    return [o.counter ? primary('check', 'Accept their counter', () => { const r = C.negotiate(save, o.id, o.counter); persist(game); ask = null; walking = false; game.setBusy(r.result === 'accepted' ? `${name} agreed. Sign when you are ready.` : ''); build(); }) : primary('check', asked ? 'Sign as offered' : `Sign with ${name}`, sign),
      o.final ? null : second('upgrade', 'Propose', () => propose(save, o, name)), h('div.sp'), walk(save, o)];
  }
  const walk = (save, o) => h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => {
    if (!walking) { walking = true; return build(true); }
    C.walkAway(save, o.id); persist(game); leave();
  } }, icon('close'), walking ? 'Press again to walk away' : 'Walk away');
  function propose(save, o, name) {
    const r = C.negotiate(save, o.id, ask); persist(game); ask = null; walking = false;
    if (r.result === 'withdrawn') { game.setBusy(`${name} walked away.${r.repLost ? ' Reputation down.' : ''}`, { kind: 'error', ms: 4000 }); return leave(); }
    game.setBusy(r.result === 'accepted' ? `${name} agreed. Sign when you are ready.` : `${name} came back with terms of their own.`, r.result === 'accepted' ? {} : { kind: 'error', ms: 4000 });
    build();   // focus on the primary: the rows may be gone, and the old index could land on Walk away
  }
  function doSign(save, o) {
    if (o.sponsor) {
      const r = C.signSponsor(save, o.id);
      if (!r.ok) return game.setBusy(`No free sponsor slot: a ${TIERS.tiers[save.season.tier].name} driver has ${C.sponsorSlots(save)}.`, { kind: 'error', ms: 4000 });
      persist(game); game.setBusy(`Signed with ${o.name}.`); return leave();
    }
    if (save.clock.phase === 'offers' || save.clock.phase === 'review') {
      C.acceptOffer(save, o.id, available()); persist(game);
      const paid = [save.buyback ? `Parts sold back: +${money(save.buyback)}` : null, save.transfer ? `Your cut of the release clause: +${money(save.transfer)}` : null].filter(Boolean);
      if (paid.length) game.setBusy(paid.join('. ') + '.');
      return game.show('careerHub', 'home');
    }
    const a = C.signMid(save, o.id); if (!a) return game.setBusy('You have already signed for next season.', { kind: 'error', ms: 4000 });
    persist(game); game.setBusy(`Signed with ${teamName(o.team)} for next season${a.cut ? `. Your cut of the release clause: +${money(a.cut)}` : ''}.`); leave();
  }
  /** the conversation so far, the newest at the bottom; their opening line first */
  function talk(o) {
    const opening = o.sponsor ? `${money(o.retainer)} a round, and ${money(o.bonus)} if you ${targetText(o.target)}.` : `${money(o.salary)} a round${o.signing ? `, ${money(o.signing)} to sign` : ''}, ${seasons(o.seasons)}, ${STATUS_LABEL[o.status]}.`;
    const log = (o.log?.length ? o.log : [{ who: 'them', text: opening }]).map((m) => h('div.cx-say' + (m.who === 'you' ? '.you' : ''), {}, h('small', {}, m.who === 'you' ? 'You' : o.sponsor ? o.name : teamName(o.team)), h('span', {}, rich(m.text))));
    const body = h('div.lscroll.cx-log', { onscroll: (e) => fadeMore(e.currentTarget) }, log);
    queueMicrotask(() => { body.scrollTop = body.scrollHeight; fadeMore(body); });
    return h('div.cx-b', {}, blockHead('mail', 'The conversation'), body, !o.sponsor && C.canNegotiate(o) ? tactics(game.career, o) : null);
  }
  function build(keep = false) {
    const save = game.career, o = C.findOffer(save, id), cur = keep ? getNav().i : 0; if (!o) return leave();
    F.sec('deal'); F.title(`Talks with ${o.sponsor ? o.name : teamName(o.team)}`, save.clock.phase === 'offers' ? 'Your first contract' : save.clock.phase === 'review' ? `Season-end market · Season ${save.clock.season}` : `Season ${save.clock.season} · Week ${save.clock.week + 1}. It starts next season`);
    if (o.sponsor) F.title(`Talks with ${o.name}`, `Season ${save.clock.season} · Week ${save.clock.week + 1}`);
    F.backdrop('cars', o.sponsor ? save.contract?.car : o.car); statusBar(F.me, save); stage(o);
    fill(F.page, party(save, o), terms(save, o), talk(o));
    fill(F.foot, prompts([['arrow-up', 'arrow-down'], 'dpad', 'Select'], [['arrow-left', 'arrow-right'], null, 'Change'], CHOOSE), h('div.sp'), prompt('Esc', 'b', 'Back: the talks stay open'));
    const L = getNav().items();
    getNav().reset(keep ? Math.min(cur, L.length - 1) : Math.max(0, L.findIndex((e) => e.classList.contains('cx-go'))));
  }
  const api = {
    el: F.el, nav: true, grid: true,
    onShow(arg) { id = arg.id; home = arg.home ?? 'careerHub'; ask = null; walking = false; build(); },
    back() { leave(); },
  };
  return api;
}
