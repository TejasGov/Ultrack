// Career Mode's screens outside the hub (docs/career-mode.md section 13): careerStart (the landing with the saves, create the driver, the Open Shootout, the first offers, the
// season review and its market) and careerReport (the round report). The rules live in career/career.js; these screens call it, store the save and start sessions.
import { h, fill, css, seg, row, prompt, stat, still, empty, getNav, teamLogo, teamMark, fadeMore } from './ui.js';
import { carName } from './carinfo.js';
import { fmtTime } from './store.js';
import { icon } from './icons.js';
import { trackOf } from '../tracks.js';
import { SLOTS, listCareers, loadCareer, saveCareer, activeSlot } from './career/save.js';
import * as C from './career/career.js';
import { TUNING, TIERS, CAR, TEAM_IDS, DIV, loreOf, rrLabel, objectiveText, parLap, STATUS_LABEL } from './career/rules.js';
import { frame, statusBar, coins, money, signed, delta, cs, rich, teamName, persist, playerDriver, zero, prompts, SELECT, CHOOSE, blockHead, mediaBytes, divChip } from './career-shell.js';
import { CareerHubScreen } from './career-hub.js';
import { CareerDealScreen, offerRow, teamRows } from './career-deals.js';

export { CareerHubScreen, CareerDealScreen };
const NATIONS = ['IND', 'GBR', 'USA', 'JPN', 'ITA', 'UAE', 'BRA', 'GER'];
const NUMBERS = [5, 11, 14, 21, 42, 55, 77, 99];                  // none is a teams.json race number
const RACE_LENGTHS = Object.entries(TUNING.series.lengths).map(([id, min]) => [id, `${id[0].toUpperCase()}${id.slice(1)} · ${min} min`]);
const RACE_LENGTH_NOTE = 'About how long each race takes; the laps depend on the circuit. Points and XP are the same at every length, and you can change it between rounds.';

// ---------------------------------------------------------------------------------------------- careerStart
/** one screen for every step outside the season: the landing (saves, new, delete), create the driver, the Shootout, the first offers, and each season review */
export function CareerStartScreen(game) {
  const F = frame('career-start');
  let creating = false, deleting = false, target = null, modal = null, cancelModal = null, closing = false, form = { name: '', nation: 'IND', number: 99, difficulty: 'normal', raceLength: 'sprint' };
  const primary = (ic, label, onclick) => h('button.btn.btn-primary.cs-go', { 'data-nav': '', onclick }, icon(ic), label);
  const secondary = (ic, label, onclick) => h('button.btn.btn-secondary', { 'data-nav': '', onclick }, icon(ic), label);
  const steps = (at) => h('div.cx-stages', {}, ['Your driver', 'Open Shootout', 'First contract'].flatMap((s, i) => [h(i === at ? 'b' : i < at ? 'span.done' : 'span', {}, i < at ? icon('check') : h('i', {}, i + 1), s), i < 2 ? icon('chevron-right') : null]));
  const openDeal = (id) => game.show('careerDeal', { id, home: 'careerStart' });

  /** the landing: the saves (a filled one resumes, an empty one starts a new career), then new, delete and the manager career to come. Deleting: the saves are the choice */
  function slots(list) {
    F.sec(deleting ? 'delete' : 'start'); F.title(deleting ? 'Delete a career' : 'Career', deleting ? 'Pick the save to delete' : 'Pick up a save, or start something new'); F.page.className = 'cx-page cs-slots'; fill(F.me); F.backdrop('tiles', 'career');
    const off = { disabled: true };      // greyed: no nav stop, nothing to press
    const card = (c, i) => {
      if (c?.unreadable) {
        const why = c.damaged ? 'This save is damaged and cannot be opened. You can delete it.' : 'Saved by a newer version of the game. Update to carry on, or delete it.';
        return h('button.of-card.cs-slot.bad', { 'data-nav': '', onclick: () => (deleting ? askDelete(i, `slot ${i + 1}`) : game.setBusy(why, { kind: 'error', ms: 4000 })) }, h('span.kick', {}, icon('warning'), `Slot ${i + 1}`), h('strong', {}, c.damaged ? 'Damaged' : 'Locked'), h('span.of-why', {}, why));
      }
      return h(`button.of-card.cs-slot${c ? '.has' : '.empty'}${deleting && !c ? '.off' : ''}${deleting && c ? '.del' : ''}`, deleting && !c ? off : { 'data-nav': '', onclick: () => {
        if (deleting) askDelete(i, c.player.name); else if (c) { game.career = loadCareer(i); route(); } else { target = i; creating = true; build(); } } },
      [h('span.kick', {}, icon(c ? 'helmet' : deleting ? 'lock' : 'plus'), `Slot ${i + 1}`), c ? [h('strong', {}, c.player.name),
        h('span.of-terms', {}, stat('Season', String(c.clock.season)), cs('xp', 'Level', String(c.career.cl)), cs('rep', 'Reputation', String(Math.round(c.career.rep)))),
        h('span.of-why', {}, c.contract ? `${teamName(c.contract.team)} · ${carName(c.contract.car)}` : 'Still looking for a seat')]
        : [h('strong', {}, 'Empty'), h('span.of-why', {}, deleting ? 'Nothing to delete' : 'Start a new career')]].flat(Infinity));
    };
    if (deleting) return list.map(card);
    const tile = (ic, kick, title, why, onclick, tone) => h(`button.of-card.cs-act.${tone}${onclick ? '' : '.off'}`, onclick ? { 'data-nav': '', onclick } : off, h('span.kick', {}, icon(ic), kick), h('strong', {}, title), h('span.of-why', {}, why));
    const free = list.findIndex((c) => !c), saved = list.some(Boolean);
    return [list.map(card),
      tile('plus', 'Driver career', 'New career', free < 0 ? `All ${SLOTS} slots are full. Delete one first.` : 'Create your driver and start at the Open Shootout.', free < 0 ? null : () => { target = free; creating = true; build(); }, 'new'),
      tile('close', 'Your saves', 'Delete career', saved ? 'Pick a save to delete. This cannot be undone.' : 'No careers saved yet.', saved ? () => { deleting = true; build(); } : null, 'del'),
      tile('lock', 'Coming soon', 'Manager career', 'Run a team instead of driving for one.', null, 'soon')];
  }
  /** deleting is for good, so it asks first in a modal that traps focus on Cancel, as the pause menu's Restart and Quit do */
  function askDelete(i, name) {
    const opener = getNav().i; F.page.inert = F.foot.inert = true;
    cancelModal = () => { closeModal(); getNav().reset(opener); };
    modal = h('div.pnl.modal', { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': 'Delete career' }, h('h2', {}, `Delete ${name}?`), h('p', {}, `Slot ${i + 1} is erased for good: every season, contract and coin in it. This cannot be undone.`),
      h('div.m-acts', {}, h('button.btn.btn-secondary', { 'data-nav': '', onclick: cancelModal }, 'Cancel'), h('button.btn.btn-primary', { 'data-nav': '', onclick: () => { closeModal(); saveCareer(null, i); deleting = false; build(); } }, icon('close'), 'Delete career')));
    F.el.append(h('div.m-layer', {}, modal)); getNav().reset(0);
  }
  function closeModal() { if (!modal) return; modal.parentNode.remove(); modal = null; F.page.inert = F.foot.inert = false; }
  function create() {
    F.sec('create'); F.title('New career', 'You are 21, fast, and unknown'); F.page.className = 'cx-page cs-create'; fill(F.me); F.backdrop('tiles', 'career');
    const name = h('input.cs-input', { type: 'text', maxLength: 24, placeholder: 'Your name', value: form.name, tabIndex: -1, 'aria-label': 'Driver name',
      oninput: (e) => { form.name = e.target.value; }, onkeydown: (e) => { if (!['Enter', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.stopPropagation(); } });   // typing stays in the box: Nav takes only Enter, Esc and Up/Down
    const nameRow = row('Name', name); nameRow.addEventListener('click', () => name.focus()); nameRow.removeAttribute('data-adjust');
    return [h('div.cx-b.cs-form', {}, steps(0), h('p.cx-note', {}, 'Three Rookie teams have a junior seat open. First, who are you?'), nameRow,
      row('Nation', seg(NATIONS.map((n) => [n, n]), form.nation, (v) => { form.nation = v; })),
      row('Number', seg(NUMBERS.map((n) => [n, '#' + n]), form.number, (v) => { form.number = v; })),
      row('Race length', seg(RACE_LENGTHS, form.raceLength, (v) => { form.raceLength = v; }), RACE_LENGTH_NOTE),
      row('Rivals', seg([['easy', 'Gentle'], ['normal', 'Normal'], ['hard', 'Fierce']], form.difficulty, (v) => { form.difficulty = v; }), 'How fast the other drivers are. Gentle helps while you learn the circuits.'),
      h('div.cx-acts.end', {}, primary('play', 'Create driver', () => {
        game.career = C.newCareer({ ...form, name: form.name || 'A. Driver' }); saveCareer(game.career, target ?? activeSlot()); persist(game); creating = false; build();
      })))];
  }
  function shootout(save) {
    const S = C.shootout(), par = parLap(S.track, S.car, S.weather), t = trackOf(S.track);
    F.sec('shootout'); F.title('Open Shootout', save.player.name); F.page.className = 'cx-page cs-shoot'; statusBar(F.me, save); F.backdrop('tracks', S.track);
    return [h('div.cx-b.cs-form', {}, steps(1), h('p.cx-note', {}, `The three Rookie teams hold one trial for every hopeful: one flying lap of ${t.name} in a neutral ${carName(S.car)}. Your lap against par sets your grade. Nobody is turned away.`),
      h('div.r-stats', {}, stat('Circuit', t.name), stat('Car', carName(S.car)), stat('Par lap', fmtTime(par))),
      h('div.cs-grades', {}, [['Standout', 'within 3 % of par', `bigger signing bonuses, ${TUNING.shootout.standoutXp} XP`], ['Solid', 'within 6 %', `the normal offers, ${TUNING.shootout.baseXp} XP`], ['Raw', 'slower, or no valid lap', 'offers still come, 10 % less salary']]
        .map(([g, when, what]) => h(`div.cs-grade.g-${g.toLowerCase()}`, {}, h('b', {}, g), h('small', {}, when), h('span', {}, rich(what))))),
      h('p.cx-note', {}, icon('info'), 'You get a run-up to the line. Leave the track with all four wheels for a second and the lap does not count: keep going, and your first valid lap ends the trial.'),
      h('div.cx-acts.end', {}, secondary('close', 'Skip: take Raw', () => { C.finishShootout(save, null); persist(game); build(); }),
        primary('play', 'Drive the Shootout', () => game.careerSession('shootout', { track: S.track, look: S.look, weather: S.weather, laps: 3, car: S.car, home: 'careerStart',
          session: { levels: zero, runUp: TUNING.series.qualiRunUp, drivers: { [S.car]: playerDriver(save, CAR[S.car].team) } } }, (d) => { C.finishShootout(save, d.best); persist(game); game.show('careerStart'); }))))];
  }
  /** a first offer as a big card: the car, team, seat and terms; Enter opens the talks */
  function card(save, o) {
    const t = loreOf(o.team), mate = C.mateOf(save, o), tier = TIERS.tiers[o.tier];
    return css(h('button.of-card', { 'data-nav': '', onclick: () => openDeal(o.id) },
      h('img.of-car', { src: still('cars', o.car), alt: '', decoding: 'async' }), h('span.of-top', {}, teamLogo(t), h('span.kick', {}, `${tier.name} · ${o.seat} seat`)),
      h('strong', {}, carName(o.car)), h('span.of-team', {}, h('i.tbar'), t.name, h('small', {}, '#' + CAR[o.car].number)),
      h('span.of-terms', {}, stat('Salary', coins(o.salary), '/ ROUND'), stat('Signing', o.signing ? coins(o.signing) : empty()), stat('Seasons', String(o.seasons))),
      h('span.of-mate', {}, icon('people'), `Teammate: ${mate.name}, rated ${mate.rating}`), o.pitch ? h('span.of-why', {}, o.pitch) : null,
      h('span.of-foot', {}, o.difficulty ? h('span.of-diff', {}, `Difficulty: ${o.difficulty}`) : null, h(`span.cx-tag${o.agreed ? '.ok' : o.counter ? '.warn' : '.talk'}`, {}, icon(o.agreed ? 'check' : o.counter ? 'warning' : 'chevron-right'), o.agreed ? 'Agreed: sign it' : o.counter ? 'They countered' : 'Open talks'))), { '--team': teamMark(t) });
  }
  function firstOffers(save) {
    const p = save.pending, s = p.shootout, list = p.offers;
    F.sec('offers'); F.title('Your first contract', save.player.name); F.page.className = 'cx-page cs-offers'; statusBar(F.me, save); F.backdrop('tracks', C.shootout().track);
    return [h('div.cs-offerhead', {}, steps(2), h('p.cx-note', {}, s.best ? `Shootout: ${s.grade}. Best lap ${fmtTime(s.best)}, ${signed(s.delta * 100, 1)} % to par.` : 'Shootout: Raw, no valid lap. The teams still want to talk.',
      ' Each team offers its junior seat for two seasons, and your results are judged against the car. Open one to talk terms and sign.')), h('div.of-row', {}, list.map((o) => card(save, o)))];
  }
  /** the series titles a review's reputation came from: the Elite's Drivers' and Teams', the Challenger's Drivers' */
  const titleName = (r) => { const l = r.div === 'elite' ? [r.drivers === 1 && "Drivers'", r.teams === 1 && "Teams'"].filter(Boolean) : ["Drivers'"]; return `${l.join(' and ')} ${l.length > 1 ? 'titles' : 'title'}`; };
  /** the season's verdict on the left, next season's seats on the right */
  function review(save) {
    const p = save.pending, r = p.review, last = save.history.at(-1), list = p.offers, st = C.standings(save), top = st.drivers.slice(0, 5), w = C.windowInfo(save);
    F.sec('review'); F.title(`Season ${last.season} review`, `${teamName(last.team)} · ${carName(last.car)}`); F.page.className = `cx-page cs-review${w ? ' win' : ''}`; statusBar(F.me, save); F.backdrop('cars', last.car);
    const headline = r.drivers === 1 ? 'Champion' : `P${r.drivers}`, D = DIV[r.div], stays = save.contract && !save.contract.next && !save.contract.dropped && !r.dropped && save.contract.seasonsLeft > 1;
    // with two series: the season's swap in one banner, the player's own team's in their words
    const swap = !r.swap ? null : r.yourTeam === 'up' ? `${teamName(last.team)} are promoted.${stays ? ` You race in the ${DIV.elite.name} next season.` : ` They race in the ${DIV.elite.name} next season.`}`
      : r.yourTeam === 'down' ? `${teamName(last.team)} are relegated.${stays ? ' Your contract stands.' : ` They race in the ${DIV.challenger.name} next season.`}` : `Up: ${teamName(r.swap.up)}. Down: ${teamName(r.swap.down)}.`;
    return [h('div.cx-b.cs-verdict', {}, blockHead('trophy', D ? `${D.name}: Drivers'` : "Drivers' table", `${r.driverCount ?? st.drivers.length} drivers`), h('div.cs-hero', {}, h('h2', {}, headline), h('div.cx-kv.two', {}, stat("Teams'", 'P' + r.teams, `/ ${r.teamCount ?? last.teamOrder?.length ?? TEAM_IDS.length}`), D ? null : stat(TIERS.tiers[last.tier].cup, 'P' + r.cup), stat('Avg rating', r.avgRR.toFixed(1)), stat('Duel', `${last.duel.won}-${last.duel.lost}`), cs('trust', 'Team trust', String(r.trust), '/ 100'), stat('Points', String(Math.round(last.points * 10) / 10)), r.rank ? stat('Ranking', 'P' + r.rank, `/ ${r.rankOf ?? 16}`) : null, last.opens?.length ? stat('Opens won', String(last.opens.length), '/ 3') : null)),   // a review without rankOf was written by schema-11 code, in a field of 16
        swap ? h('p.cx-note', {}, icon(r.yourTeam === 'down' ? 'chevron-down' : 'chevron-up'), swap) : null,
        r.dropped ? h('p.cx-note.warn', {}, icon('warning'), rich(`${teamName(last.team)} has let you go: trust fell too far. Reputation ${TUNING.rep.dropped}. A reserve seat is the way back.`)) : null,
        D && r.titleRep ? h('p.cx-note', {}, icon('trophy'), rich(`${D.short} ${titleName(r)}: reputation ${signed(r.titleRep)}${r.coins ? `, +${money(r.coins)}` : ''}.`)) : null,
        D && r.promoRep ? h('p.cx-note', {}, icon('chevron-up'), rich(`Promotion: reputation ${signed(r.promoRep)}.`)) : null,
        !D && (r.rep > (r.dropped ? TUNING.rep.dropped : 0) || r.coins) ? h('p.cx-note', {}, icon('trophy'), 'Titles this season: ', rich(`reputation ${signed(r.rep - (r.dropped ? TUNING.rep.dropped : 0))}${r.coins ? `, +${money(r.coins)}` : ''}`), '.') : null,   // a review from before the split stores only the sum
        h('div', {}, top.map((d, i) => css(h(`div.lrow.cx-mini${d.you ? '.me' : ''}`, {}, h('b.tnum', {}, i + 1), h('i.tbar'), h('span', {}, d.name), h('b.tnum', {}, String(Math.round(d.pts * 10) / 10))), { '--team': teamMark(loreOf(d.team)) })))),
      h('div.cx-b.cs-next', {}, blockHead('contract', 'Next season', list.length > 1 ? 'Open one to talk or sign' : 'One way forward'), windowBar(save), h('div.lscroll.cx-list', { onscroll: (e) => fadeMore(e.currentTarget) }, list.map((o) => offerRow(save, o, () => openDeal(o.id))))),
      w ? h('div.cx-b.cs-news', {}, blockHead('mail', 'Transfer news', w.closed ? 'Window closed' : `Day ${w.day + 1}`), h('div.lscroll.cx-list.cs-feed', { onscroll: (e) => fadeMore(e.currentTarget) }, w.news.map((n, i) => h(`div.cs-line${i === 0 ? '.new' : ''}`, {}, h('small', {}, `Day ${n.day + 1}`), h('span', {}, n.text))))) : null,
      h('div.cx-b.cs-teams', {}, blockHead('people', 'Teams', 'Enter to approach'), h('div.lscroll.cx-list', { onscroll: (e) => fadeMore(e.currentTarget) }, teamRows(save, game, () => build(true))))];
  }
  /** the transfer window (6.10): the day, a dot a day with the last one the deadline, and what is at stake today */
  function windowBar(save) {
    const w = C.windowInfo(save); if (!w) return null;
    const dots = h('span.cs-days', { 'aria-hidden': 'true' }, Array.from({ length: w.days }, (_, i) => h(`i${i < w.day || w.closed ? '.past' : i === w.day ? '.now' : ''}${i === w.days - 1 ? '.dl' : ''}`)));
    return h('div.cs-window', {}, dots, h('b', {}, w.closed ? 'The window is closed' : w.deadline ? `Deadline day: Day ${w.day + 1} of ${w.days}` : `Day ${w.day + 1} of ${w.days}`),
      h('small', {}, w.closed ? 'Sign what is left on the table.' : w.deadline ? 'Anything not agreed lapses when the window closes.' : 'Teams answer, and rivals sign, as the days pass.'));
  }
  /** Advance day, or Close the window on deadline day; a second press when offers would lapse or go to a rival */
  function windowFoot(save) {
    const w = C.windowInfo(save); if (!w || w.closed) return [];
    const warn = C.windowWarnings(save), label = closing && warn.length ? 'Press again to go on' : w.deadline ? 'Close the window' : 'Advance day';   // a phone hides the note beside it
    return [h('div.cx-next', {}, h('small', {}, closing && warn.length ? 'Before you go' : w.deadline ? 'Deadline day' : `Day ${w.day + 1} of ${w.days}`), h('span', {}, closing && warn.length ? `${warn.join('. ')}. Press again to go on.` : w.deadline ? 'Close it when you are ready: what is not agreed lapses.' : `Next: Day ${w.day + 2}${w.day + 2 === w.days ? ', deadline day' : ''}`)),
      h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: () => {
        if (warn.length && !closing) { closing = true; return build(true); }
        closing = false; C.windowDay(save); persist(game); build(true);
      } }, icon('chevron-right'), label)];
  }
  const route = () => game.show(game.career && !['shootout', 'offers', 'review'].includes(game.career.clock.phase) ? 'careerHub' : 'careerStart', game.career && !['shootout', 'offers', 'review'].includes(game.career.clock.phase) ? 'home' : undefined);
  function build(keep = false) {
    const save = game.career, cur = keep ? getNav().i : 0, all = save ? null : listCareers();
    const nodes = !save ? (creating ? create() : slots(all)) : save.clock.phase === 'shootout' ? shootout(save) : save.clock.phase === 'offers' ? firstOffers(save) : review(save);
    fill(F.page, nodes.flat(Infinity));
    fill(F.foot, prompts(SELECT, CHOOSE), h('div.sp'), save?.clock.phase === 'review' ? windowFoot(save) : null, h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => api.back() }, icon('back'), 'Back', prompt('Esc', 'b')));
    F.page.querySelectorAll('.lscroll').forEach(fadeMore);
    const L = getNav().items();
    getNav().reset(keep ? Math.min(cur, L.length - 1) : save?.clock.phase === 'shootout' ? Math.max(0, L.findIndex((e) => e.classList.contains('btn-primary'))) : 0);   // the Shootout starts on Drive, not Skip
  }
  const api = {
    el: F.el, nav: true, grid: true,
    get modal() { return modal; },     // Nav: only the modal's buttons
    /** the Career tile: always the landing, where a save is picked up */
    open() { game.career = null; game.show('careerStart'); },
    onShow() { closeModal(); creating = deleting = closing = false; target = null; build(); },
    /** from the modal, the new-career form or picking a save to delete, one step back to the landing; from the landing out to the menu */
    back() { if (modal) cancelModal(); else if (!game.career && (creating || deleting)) { creating = deleting = false; build(); } else game.leaveCareer(); },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------- careerReport
/** the round report (6.1): the finish against expectation, the Round Rating and why, objectives, the duel, what it earned, the table; all of it on one screen */
export function CareerReportScreen(game) {
  const F = frame('career-report');
  let lcqSeen = null;
  F.page.classList.add('cx-report');
  const lines = (list, unit = '') => h('div.cr-lines', {}, list.map(([label, v]) => h('span', {}, label, h('b.tnum', {}, unit === 'coin' ? coins(v, true) : typeof v === 'number' ? delta(v, unit === 'rr' ? 1 : 0) : v))));
  /** the Last Chance Qualifier's own report: the eight, who is through to the Final, and where the player finished */
  function lcqReport(rep, then = () => api.back()) {
    const save = game.career, fastest = Math.min(...Object.values(rep.best ?? {}).filter(Number.isFinite));
    F.sec('report'); F.title(`Round ${rep.round}: ${rep.name}`, `${rep.openName} · ${trackOf(rep.track).name} · ${rep.laps} ${rep.laps === 1 ? 'lap' : 'laps'}`); statusBar(F.me, save); F.backdrop('tracks', rep.track);
    fill(F.page, h('div.cx-b.cr-hero', {}, h('div.cr-pos', {}, h('h2', {}, rep.through ? 'Through' : 'Out'), h('p.cx-note', {}, rep.through ? `P${rep.finish} in the Last Chance: you start the ${rep.openName} Final.` : `P${rep.finish}. The top ${TUNING.open.lcqThrough} reach the Final.`), rep.repairs?.hits ? h('p.cx-note.warn', {}, icon('warning'), `Crash damage: ${rep.repairs.hits} ${rep.repairs.hits === 1 ? 'hit' : 'hits'}, about ${money(rep.repairs.raw)}. It is billed with the round's pay.`) : null)),
      h('div.cx-b.cr-table.cr-lcq', {}, h('div.lhead.cr-cols', {}, h('span', {}, 'Pos'), h('span'), h('span', {}, 'Driver'), h('span', {}, 'Car'), h('span.val', {}, 'Best lap'), h('span.val', {}, 'Final')),
        rep.entries.map((e, k) => css(h('div.lrow.cr-cols' + (e.you ? '.me' : '') + (k === TUNING.open.lcqThrough - 1 ? '.cut' : ''), {}, h('b.r-pos.tnum', {}, e.you && rep.dnf ? 'DNF' : k + 1), h('i.tbar'), h('span.c-name', {}, h('b', {}, e.you ? save.player.name : C.personOf(save, e.code)?.name ?? e.code), h('small', {}, teamName(e.team))),
          h('span.r-carname', {}, carName(e.key)), h('span.val', {}, rep.best?.[e.key] === fastest ? icon('bolt', { cls: 'r-bolt', label: 'Fastest lap' }) : null, Number.isFinite(rep.best?.[e.key]) ? fmtTime(rep.best[e.key]) : empty()),
          h('span.val', {}, e.advanced ? h('span.cx-tag.ok', {}, icon('check'), 'Through') : empty())), { '--team': teamMark(loreOf(e.team)) }))));
    const next = h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: () => then() }, icon('chevron-right'), rep.through ? 'Continue' : `The ${rep.openName} Final`);
    fill(F.foot, prompts(CHOOSE), h('div.sp'), next); getNav().reset(getNav().items().indexOf(next));
  }
  const api = {
    el: F.el, nav: true, grid: true,
    onShow(rep) {
      if (rep.lcq === true) return lcqReport(rep);
      if (rep.lcq && lcqSeen !== rep) return lcqReport(rep.lcq, () => { lcqSeen = rep; api.onShow(rep); });   // out in the Last Chance: the race the player drove first, then the Final they missed
      const save = game.career, fastest = Math.min(...Object.values(rep.best ?? {}).filter(Number.isFinite));
      // with two series (entries carry it): the player's series names the Tour round and the ranking; a cup shows each driver's series and the ranking points it paid
      const D = DIV[rep.entries.find((e) => e.you)?.div], cup = rep.entries.some((e) => e.rpts !== undefined), O = rep.other && DIV[rep.other.div];
      F.sec('report'); F.title(`Round ${rep.round}: ${rep.name}`, `${D && !cup ? `${D.short} · ` : ''}${trackOf(rep.track).name} · ${rep.laps} ${rep.laps === 1 ? 'lap' : 'laps'}`); statusBar(F.me, save); F.backdrop('tracks', rep.track);   // the series in the subtitle: in the title it pushed the status bar
      const verdict = rep.dnq ? (rep.open ? (rep.kind === 'masters' ? 'Missed the Masters' : 'Missed the Final') : 'Did not qualify') : rep.dnf ? 'Retired' : rep.finish === 1 ? 'Victory' : `P${rep.finish}`;
      const name = (e) => C.personOf(save, e.code)?.name ?? e.code, lead = O && C.standings(save, rep.other.div).drivers[0];
      const elsewhere = O ? `${O.short}, same day: ${name(rep.other.entries[0])} won. Top of the ${O.short}: ${lead.name}.` : null;
      const o = rep.open, route = !o ? '' : rep.kind === 'masters' ? (rep.dnq ? (D ? ` Ranked ${o.rank} in the ${D.short}: not in the field.` : ` Ranked ${o.rank}: outside the top ${TUNING.series.gridSize}.`) : ` Ranked ${o.rank}${D ? ` in the ${D.short}` : ''}.`)
        : rep.dnq ? (rep.lcq ? ` Beaten in the Last Chance Qualifier: P${rep.lcq.finish}${rep.lcq.dnf ? ', retired' : ''}.` : ' Missed the cut in qualifying.') : o.seeded ? ` Seeded P${o.rank}.` : ` Through the Last Chance in P${o.lcq}.`;
      const table = h('div.cx-b.cr-table', {}, h('div.lhead.cr-cols', {}, h('span', {}, 'Pos'), h('span'), h('span', {}, 'Driver'), h('span', {}, 'Car'), h('span.val', {}, 'Best lap'), h('span.val', {}, cup ? 'Ranking' : 'Pts')),
        rep.entries.map((e, k) => (e.dnq && !e.you ? null : css(h('div.lrow.cr-cols' + (e.you ? '.me' : ''), {}, h('b.r-pos.tnum', {}, e.dnq ? 'DNQ' : e.you && rep.dnf ? 'DNF' : k + 1), h('i.tbar'), h('span.c-name', {}, h('b', {}, e.you ? save.player.name : C.personOf(save, e.code)?.name ?? e.code), h('small', {}, cup ? divChip(e.div) : teamName(e.team))),
          h('span.r-carname', {}, carName(e.key)), h('span.val', {}, rep.best?.[e.key] === fastest ? icon('bolt', { cls: 'r-bolt', label: 'Fastest lap' }) : null, Number.isFinite(rep.best?.[e.key]) ? fmtTime(rep.best[e.key]) : empty()),
          h('span.val.tnum', {}, (cup ? e.rpts : e.pts) ? '+' + (cup ? e.rpts : e.pts) : empty())), { '--team': teamMark(loreOf(e.team)) }))));
      const mate = C.personOf(save, rep.duel.mateCode)?.name ?? 'your teammate';
      const expected = `Expected P${rep.expPos}${rep.expRace && rep.expRace !== rep.expPos && !rep.dnq ? `${rep.field ? ` of ${rep.field}` : ''} (P${rep.expRace} of the ${rep.starters} who started)` : ''}`;   // the finish is judged among the starters (rules.js roundRating)
      fill(F.page,
        h('div.cx-b.cr-hero', {}, h('div.cr-pos', {}, h('h2', {}, verdict), h('p.cx-note', {}, rep.grace ? `${expected}, qualified P${rep.grid}. ${C.graceWhy(save)}: you started from the back of the grid, P${rep.grace.start}, and ${C.personOf(save, rep.grace.code)?.name ?? rep.grace.code} sat out.${rep.fastest ? ' Fastest lap.' : ''}` : `${expected}, ${rep.dnq ? 'qualified' : 'started'} P${rep.grid}${rep.pole ? ' (pole)' : ''}${rep.fastest ? ', fastest lap' : ''}.${route}`), elsewhere ? h('p.cx-note', {}, icon('info'), elsewhere) : null),
          h('div.cr-rate', {}, h('small', {}, 'Round rating'), h(`b${rep.rr >= 7 ? '.hi' : rep.rr < 5 ? '.lo' : ''}`, {}, rep.rr.toFixed(1)), h('span', {}, icon(rep.rr >= 7 ? 'chevron-up' : rep.rr < 5 ? 'chevron-down' : 'minus'), rrLabel(rep.rr))),
          h('div.cr-deltas', {}, cs('xp', 'XP', delta(rep.xp)), cs('rep', 'Reputation', delta(rep.rep)), cs('trust', 'Trust', delta(rep.trust)), rep.life ? cs('mood', 'Happiness', delta(rep.life.delta)) : null, rep.rank ? stat(D ? `${D.short} ranking` : 'Ranking', [`P${rep.rank.after} `, delta(rep.rank.before - rep.rank.after)]) : null, stat('Earned', coins(rep.coins, true))), rep.levelUp ? h('span.cx-tag.xp', {}, icon('chevrons-up'), `Career Level ${rep.levelUp}`) : null,
          rep.honours?.includes('slam') ? h('span.cx-tag.xp', {}, icon('trophy'), 'Grand Slam') : null, rep.honours?.includes('triple') ? h('span.cx-tag.xp', {}, icon('trophy'), 'Triple Crown') : null),
        table,
        h('div.cx-b.cr-why', {}, blockHead('specs', 'Why that rating'), lines([['Base', '6.0'], ...rep.rrLines], 'rr'),
          h('div.cx-bh', {}, h('span', {}, 'Objectives')), h('div.cr-objs', {}, rep.objectives.map((o) => h('span' + (o.met ? '.met' : ''), {}, icon(o.met ? 'check' : 'close'), objectiveText(o), o.mandatory ? h('small', {}, 'Required') : null)))),
        h('div.cx-b.cr-money', {}, blockHead('coin', 'What it paid'), lines(rep.coinLines, 'coin'),
          rep.repairs?.capped ? h('p.cx-note', {}, icon('warning'), `The crashes would have cost ${money(rep.repairs.raw)}. Repairs are capped at ${Math.round(TUNING.repairs.cap * 100)} % of the round's pay.`) : null,
          h('p.cx-note', {}, icon('people'), rep.open ? `There is no teammate duel in an Open or the Masters.` : rep.duel.skipped ? `You skipped qualifying, so no duel with ${mate} this round.` : rep.duel.result === 'level' ? `Level with ${mate} in qualifying.` : `${rep.duel.result === 'won' ? 'You out-qualified' : 'Out-qualified by'} ${mate}: ${rep.duel.mine ? fmtTime(rep.duel.mine) : 'no lap'} vs ${fmtTime(rep.duel.mate)}.`),
          rep.rivals?.length ? h('p.cx-note', {}, icon('people'), rep.rivals.map(([l]) => l).join('. ') + '.') : null,
          rep.nemesis && !(rep.nemesis.beat && !rep.dnq) ? h('p.cx-note', {}, icon('warning'), `Your nemesis, ${rep.nemesis.name}, ${rep.dnq ? 'raced without you' : 'finished ahead of you'}.`) : null,   // beaten, the "Nemesis beaten" line above says it
          rep.orders ? h('p.cx-note', {}, icon('people'), `Team orders: you ${rep.orders.obeyed ? 'let' : 'did not let'} ${mate} by. Trust ${signed(rep.orders.trust)}.`) : null,
          rep.midSeason?.warning ? h('p.cx-note.warn', {}, icon('warning'), 'Seat review: ', rich(`trust ${save.contract.trust}`), `. Meet the round objective in the next ${TUNING.trust.recover} rounds.`) : null,
          rep.midSeason?.w1 ? h('p.cx-note', {}, icon('star'), `${teamName(rep.midSeason.w1)} want to talk. Their offer is in your inbox, until the market closes.`) : null),
        save.clock.phase === 'review' ? null : mediaBytes(save, C.latestBytes(save), (id) => game.show('careerHub', { story: id })));   // the season review has no hub to open them in; they wait for next season
      const next = h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: () => api.back() }, icon('chevron-right'), 'Continue');
      fill(F.foot, prompts(CHOOSE), h('div.sp'), next);
      getNav().reset(getNav().items().indexOf(next));
    },
    back() { game.show(game.career?.clock.phase === 'review' ? 'careerStart' : 'careerHub', game.career?.clock.phase === 'review' ? undefined : 'home'); },
  };
  return api;
}
