// The career hub (docs/career-mode.md section 13): full screen, one status bar, eight tabs (Q/E, LB/RB), one red button that always does the next thing.
// Home is this week; Calendar the weeks; Events the three kinds; Inbox every message; Deals the talks, your contract, the teams; Standings, Garage, Driver.
import { h, fill, css, seg, stat, still, row, prompt, empty, getNav, teamMark, fadeMore } from './ui.js';
import { carName, factsOf } from './carinfo.js';
import { WEATHER, fmtTime } from './store.js';
import { CATS } from './economy.js';
import { icon } from './icons.js';
import { trackOf } from '../tracks.js';
import { saveCareer } from './career/save.js';
import * as C from './career/career.js';
import { TUNING, TIERS, CAR, loreOf, objectiveText, xpForLevel, formOf, STATUS_LABEL, rrLabel, targetText } from './career/rules.js';
import { frame, statusBar, strip, coins, money, signed, teamName, persist, playerDriver, LOOK, WX_ICON, MEDAL, EVENT, prompts, SELECT, CHOOSE, blockHead, weekTitle, worldName, tierCup, brandMark } from './career-shell.js';
import { offerRow, teamRows } from './career-deals.js';

const TABS = [['home', 'Home', 'home'], ['calendar', 'Calendar', 'calendar'], ['events', 'Events', 'star'], ['inbox', 'Inbox', 'mail'], ['deals', 'Deals', 'contract'], ['standings', 'Standings', 'trophy'], ['garage', 'Garage', 'garage'], ['driver', 'Driver', 'helmet']];
const RACE_LENGTHS = Object.entries(TUNING.series.lengths).map(([id, min]) => [id, `${id[0].toUpperCase()}${id.slice(1)} · ${min} min`]);
const lengthName = (id) => `${id[0].toUpperCase()}${id.slice(1)}`;
const MAIL_ICON = { race: 'race', deal: 'contract', team: 'people', warn: 'warning', event: 'time-trial', sponsor: 'star', news: 'mail' };
const conds = (R) => [icon(LOOK[R.look][1], { label: LOOK[R.look][0] }), icon(WX_ICON[R.weather], { label: WEATHER[R.weather].label })];
const scroller = (cls, ...kids) => h(`div.lscroll.${cls}`, { onscroll: (e) => fadeMore(e.currentTarget) }, ...kids);

export function CareerHubScreen(game) {
  let tab = 'home', armed = false, confirmErase = false, calWeek = null, mailId = null;
  const tabs = h('div.stabs', { 'data-nav': '', 'data-adjust': '', tabIndex: 0, role: 'tablist', 'aria-label': 'Career tabs', onadjust: (e) => api.onKeyTab(e.detail), onclick: () => api.onKeyTab(1) });
  const F = frame('career-hub', tabs);
  const go = (t) => { tab = t; armed = false; confirmErase = false; build(); };
  const open = (id) => game.show('careerDeal', { id, home: 'careerHub' });
  const toast = (msg, err) => game.setBusy(msg, err ? { kind: 'error', ms: 4000 } : {});

  // ---------------------------------------------------------------------------------------------- sessions
  function startPractice(save) {
    const R = C.currentRound(save), car = save.contract.car;
    game.careerSession('practice', { track: R.track, look: R.look, weather: R.weather, laps: R.laps, car, home: 'careerHub', session: { levels: C.raceSetup(save).levels, drivers: { [car]: playerDriver(save, save.contract.team) } } }, () => game.show('careerHub', 'home'));
  }
  function startQuali(save) {
    const R = C.currentRound(save), car = save.contract.car, lv = C.raceSetup(save).levels;
    game.careerSession('quali', { track: R.track, look: R.look, weather: R.weather, laps: R.laps, car, home: 'careerHub',
      session: { levels: lv, runUp: TUNING.series.qualiRunUp, drivers: { [car]: playerDriver(save, save.contract.team) } } }, (d) => {
      C.finishQuali(save, d.best); persist(game);
      const q = save.season.current.quali, p = q.grid.indexOf(car) + 1;
      game.show('careerHub', 'home'); toast(Number.isFinite(q.laps[car]) ? `Qualified P${p}: ${fmtTime(q.laps[car])}. Teammate duel ${q.duel.result}.` : 'No valid lap: you start from the back.');
    });
  }
  function startEvent(save, spec) {
    game.careerSession(spec.kind, { track: spec.track, look: spec.look, weather: spec.weather, laps: C.currentRound(save).laps, car: spec.car, home: 'careerHub',
      session: { levels: C.raceSetup(save).levels, runUp: spec.kind === 'test' ? TUNING.series.qualiRunUp : 0, drivers: { [spec.car]: playerDriver(save, save.contract.team) } } }, (d) => {
      const r = C.finishSide(save, spec.kind === 'test' ? d.best : d.score); persist(game);
      game.show('careerHub', 'home'); toast(`${spec.name}: ${MEDAL[r.medal]}${r.xp ? `, +${r.xp} XP` : ''}${r.coins ? `, +${money(r.coins)}` : ''}${r.package ? ', a free upgrade level' : ''}.`);
    });
  }
  function startRace(save) {
    const X = C.raceSetup(save);
    game.careerSession('race', { track: X.track, look: X.look, weather: X.weather, laps: X.laps, car: X.hero, home: 'careerHub',
      session: { racers: X.racers, gridOrder: X.gridOrder, pace: X.pace, levels: X.levels, drivers: X.drivers } }, (d) => {
      const report = C.finishRace(save, { order: d.order, best: d.bests, dnf: d.dnf, crashes: d.crashes, spins: d.spins, pro: d.pro });
      persist(game); game.show('careerReport', report);
    });
  }

  // ---------------------------------------------------------------------------------------------- Home
  const mode = (ic, title, note, state, onclick) => h(`button.cx-mode.${state}`, { 'data-nav': '', onclick }, icon(state === 'off' ? 'lock' : state === 'done' ? 'check' : ic), h('b', {}, title), h('small', {}, note));
  /** what you can drive, in order, each with its state and its reason */
  function modes(save) {
    const w = C.currentWeek(save), race = w.kind === 'race', q = save.season.current.quali, me = save.contract, spec = C.sideSpec(save), W = save.season.weeks, i = save.clock.week;
    const nextRace = W.slice(i).find((x) => x.kind === 'race'), nextEvent = W.slice(i + 1).find((x) => x.event), R = C.currentRound(save);
    const locked = (why) => () => toast(why, true), grid = q ? q.grid.indexOf(me.car) + 1 : null;
    const tiles = [mode('free-drive', 'Practice', `Open: ${trackOf(R.track).name}, no stakes`, 'open', () => startPractice(save))];
    if (w.kind === 'market') tiles.push(mode('contract', 'The market', save.clock.season === 1 ? 'Open this week: sponsors only' : 'Open this week: talk and approach', 'next', () => go('deals')));
    else if (spec) tiles.push(mode(EVENT[spec.kind][1], EVENT[spec.kind][0], 'This week: optional', 'next', () => startEvent(save, spec)));
    else if (w.event?.result) tiles.push(mode(EVENT[w.event.kind][1], EVENT[w.event.kind][0], `Done: ${MEDAL[w.event.result.medal]}`, 'done', locked('One try at each event.')));
    else if (nextEvent) tiles.push(mode(EVENT[nextEvent.event.kind][1], EVENT[nextEvent.event.kind][0], `Week ${nextEvent.week}`, 'off', locked(`The next one is in week ${nextEvent.week}.`)));
    tiles.push(race ? mode('time-trial', q ? 'Improve your lap' : 'Qualifying', q ? `Grid P${grid}: ${q.laps[me.car] ? fmtTime(q.laps[me.car]) : 'no lap'}. Keeps the better lap` : 'Next: one flying lap sets your grid slot', q ? 'open' : 'next', () => startQuali(save))
      : mode('time-trial', 'Qualifying', `Week ${nextRace.week}`, 'off', locked(`Qualifying opens in race week: week ${nextRace.week}.`)));
    tiles.push(race ? mode('race', 'Race', q ? `Next: ${R.laps} laps from P${grid}. One try` : 'Locked: qualify first', q ? 'next' : 'off', q ? () => startRace(save) : locked('Qualify first: it sets your grid slot.'))
      : mode('race', 'Race', `Week ${nextRace.week}`, 'off', locked(`The next race is in week ${nextRace.week}.`)));
    const L = Object.keys(TUNING.series.lengths), step = (d) => { C.setRaceLength(save, L[(L.indexOf(save.rules.raceLength) + d + L.length) % L.length]); persist(game); build(true); };
    tiles.push(h('button.cx-mode.open', { 'data-nav': '', 'data-adjust': '', onclick: () => step(1), onadjust: (e) => step(e.detail) }, icon('timer'), h('b', {}, `${lengthName(save.rules.raceLength)} race`), h('small', {}, `${TUNING.series.lengths[save.rules.raceLength]} min. Press to change. Pay is the same`)));
    return css(h('div.cx-modes', {}, tiles), { '--n': tiles.length });
  }
  /** this week, big: a race weekend, an event, the market */
  function thisWeek(save) {
    const w = C.currentWeek(save), R = C.currentRound(save), t = trackOf(R.track), cur = save.season.current, n = save.season.calendar.length, spec = C.sideSpec(save);
    const hero = (kick, title, ...rest) => h('div.cx-b.cx-week', {}, h('img', { src: still('tracks', t.id), alt: '', decoding: 'async' }), h('span.kick', {}, kick), h('h2', {}, title), rest);
    const look = stat('Time of day', [icon(LOOK[R.look][1]), LOOK[R.look][0]]);
    if (w.kind === 'race') return hero(`This week · Race weekend · Round ${R.round} of ${n}${R.finale ? ' · points ×1.5' : ''}`, R.name,
      h('div.r-stats', {}, stat('Circuit', t.name), look, stat('Weather', [icon(WX_ICON[R.weather]), WEATHER[R.weather].label]), stat('Race', `${R.laps} laps`), stat('Expected', 'P' + cur.expPos)),
      h('div.cx-objs', {}, cur.objectives.map((o) => h('span', {}, icon(o.mandatory ? 'star' : 'plus'), objectiveText(o), h('small', {}, o.mandatory ? 'Required' : 'Bonus')))),
      notices(save));
    if (w.kind === 'market') return hero('This week · The market', 'The market is open',
      h('p.cx-note', {}, save.clock.season === 1 ? 'Sponsors can still talk this week. Teams will not: your first season is probation, and they come to you when the season ends.' : 'Teams can talk to you and you can knock on their doors, for this one week. Anything you sign starts next season. Then the window shuts until the season ends.'),
      h('div.r-stats', {}, stat('On the table', String(save.season.mid.length + save.sponsors.offers.length)), stat('Reputation', String(Math.round(save.career.rep))), stat('Next', R.name)), notices(save));
    if (spec) return hero(`This week · ${EVENT[spec.kind][0]} · Optional`, spec.name,
      h('p.cx-note', {}, spec.kind === 'test' ? 'One flying lap against the team\'s targets. Gold earns a free upgrade level.' : `Ninety seconds of Drift Attack. It pays by medal${save.sponsors.deals.length ? ', and your sponsor counts the ones you turn up to' : ''}.`),
      h('div.r-stats', {}, stat('Circuit', t.name), look, spec.targets.map((v, i) => stat(['Bronze', 'Silver', 'Gold'][i], spec.kind === 'test' ? fmtTime(v) : Math.round(v).toLocaleString('en')))), notices(save));
    const e = w.event;
    return hero(`This week · ${e ? EVENT[e.kind][0] : 'Pre-season'}`, e?.result ? `${C.eventName(save, w)}: ${MEDAL[e.result.medal]}` : 'Nothing on this week',
      h('p.cx-note', {}, `Next up: ${R.name}, round ${R.round} of ${n}, at ${t.name}.`), notices(save));
  }
  /** the seat review's warning (6.7) and a deal already signed for next season */
  function notices(save) {
    const me = save.contract, w = me.warning;
    return [w ? h('p.cx-note.warn', {}, icon('warning'), w.left > 0 ? `Seat review: meet the round objective in each of the next rounds (${w.met} of ${TUNING.trust.recover} done, ${w.left} left).` : `Seat review missed. Trust under ${TUNING.trust.drop} at the finale costs you the seat. Trust is ${me.trust}.`) : null,
      me.next ? h('p.cx-note', {}, icon('check'), `Signed for next season: ${teamName(me.next.team)}, ${carName(me.next.car)}.`) : null];
  }
  const mailRow = (m, onclick) => h(`div.lrow.cx-mail${m.read ? '' : '.new'}`, { 'data-nav': '', 'data-mail': m.id, tabIndex: 0, role: 'button', onclick }, icon(MAIL_ICON[m.kind] ?? 'mail'), h('span.c-name', {}, h('b', {}, m.title), h('small', {}, m.body)), h('span.wk', {}, `WK ${m.week}`));
  const miniRow = (pos, team, name, pts, me) => css(h(`div.lrow.cx-mini${me ? '.me' : ''}`, {}, h('b.tnum', {}, pos), h('i.tbar'), h('span', {}, name), h('b.tnum', {}, String(Math.round(pts * 10) / 10))), { '--team': teamMark(loreOf(team)) });
  function homeSide(save) {
    const q = save.season.current.quali, st = C.standings(save), me = save.contract, d = me.duel, n = C.unread(save), box = save.inbox.slice(0, 4);
    const low = q ? h('div.cx-b', {}, blockHead('race', 'The grid', `Duel ${q.duel.result}`), h('div.cx-gridlist', {}, q.grid.map((k, i) => css(h(`span.cx-slot${k === me.car ? '.me' : ''}`, {}, h('b.tnum', {}, i + 1), h('i.tbar'), h('span', {}, C.driverAt(save, k).code), h('small.tnum', {}, q.laps[k] ? fmtTime(q.laps[k]) : 'No time')), { '--team': teamMark(loreOf(CAR[k].team)) }))))
      : h('div.cx-b', {}, blockHead('trophy', tierCup(save), save.season.results.length ? `After round ${save.season.results.length}` : 'No rounds yet'), h('div', {}, st.cup.slice(0, 3).map((t, i) => miniRow(i + 1, t.team, teamName(t.team), t.pts, t.you))),
        h('div.cx-bh.end', {}, h('span', {}, icon('people'), 'Duel'), h('span', {}, `${d.won}-${d.lost} · ${C.driverAt(save, C.teammateCar(save)).name}`)));
    return h('div.cx-side', {}, h('div.cx-b', {}, blockHead('mail', 'Inbox', n ? `${n} new` : 'All read'), h('div', {}, box.map((m) => mailRow(m, () => { mailId = m.id; go('inbox'); })))), low);
  }
  function homeFoot(save) {
    const w = C.currentWeek(save), q = save.season.current.quali, next = save.season.weeks[save.clock.week + 1], warn = C.advanceWarnings(save);
    if (w.kind === 'race') return [h('div.cx-next', {}, h('small', {}, 'Race week'), h('span', {}, q ? `One try at the race. Retire classifies you last.` : 'Qualifying first: one valid flying lap')),
      h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: () => (q ? startRace(save) : startQuali(save)) }, icon(q ? 'race' : 'time-trial'), q ? 'Start the race' : 'Start qualifying')];
    const spec = C.sideSpec(save), note = armed && warn.length ? warn.join('. ') + '. Press again to go on.' : `Week ${next.week}: ${weekTitle(save, next)}`;
    return [h('div.cx-next', {}, h('small', {}, armed && warn.length ? 'Before you go' : 'Next'), h('span', {}, note)),
      h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: () => {
        if (warn.length && !armed) { armed = true; return build(true); }
        C.advanceWeek(save); persist(game); armed = false; build();
      } }, icon('chevron-right'), spec ? 'Skip and advance' : 'Advance')];
  }
  const home = (save) => [strip(save), thisWeek(save), homeSide(save), modes(save)];

  // ---------------------------------------------------------------------------------------------- Calendar
  function weekDetail(save, i) {
    const w = save.season.weeks[i], R = C.roundOfWeek(save, i), t = R && trackOf(R.track), res = w.result, e = w.event;
    const body = w.kind === 'race' ? [h('p.cx-note', {}, 'Race weekend: practice is open, qualifying sets the grid, then one try at the race.'),
      h('div.cx-kv.two', {}, stat('Circuit', t.name), stat('Round', `${R.round} of ${save.season.calendar.length}${R.finale ? ' · ×1.5' : ''}`), stat('Conditions', [icon(LOOK[R.look][1]), LOOK[R.look][0], ' · ', WEATHER[R.weather].label]), stat('Race', `${R.laps} laps`), res ? stat('Result', res.dnf ? 'Retired' : 'P' + res.finish) : null, res ? stat('Rating', res.rr.toFixed(1)) : null)]
      : w.kind === 'market' ? [h('p.cx-note', {}, save.clock.season === 1 ? 'One week for sponsors. Teams wait for the season end: your first season is probation.' : 'One week when teams can talk to you and you can approach them. Anything you sign starts next season.')]
        : w.kind === 'end' ? [h('p.cx-note', {}, 'The season review, your team\'s verdict, and the market: every offer for next season.')]
          : [h('p.cx-note', {}, e.kind === 'test' ? 'Optional. One flying lap against the team\'s targets; gold earns a free upgrade level.' : 'Optional. Ninety seconds of Drift Attack; it pays by medal, and a signed sponsor counts the ones you turn up to.'),
            h('div.cx-kv.two', {}, stat('Circuit', t.name), stat('Result', e.result ? MEDAL[e.result.medal] : e.skipped ? 'Skipped' : empty()))];
    return [blockHead('calendar', `Week ${i + 1}`, i === save.clock.week ? 'This week' : i < save.clock.week ? 'Done' : `In ${i - save.clock.week} ${i - save.clock.week === 1 ? 'week' : 'weeks'}`), h('strong.cx-title', {}, weekTitle(save, w)), body];
  }
  let calBox = null;
  function calendar(save) {
    calWeek ??= save.clock.week;
    const now = save.clock.week, kind = (w) => (w.kind === 'race' ? 'Race' : w.kind === 'market' ? 'Market' : w.kind === 'end' ? 'Review' : w.event.kind === 'test' ? 'Test' : 'Sponsor');
    const rows = save.season.weeks.map((w, i) => {
      const R = C.roundOfWeek(save, i), e = w.event, res = w.result;
      const out = res ? (res.dnf ? 'DNF' : `P${res.finish} · ${res.rr.toFixed(1)}`) : e?.result ? MEDAL[e.result.medal] : e?.skipped ? 'Skipped' : i === now ? 'This week' : '';
      return h(`div.lrow.cx-calrow${i === now ? '.now' : ''}${i < now ? '.past' : ''}`, { 'data-nav': '', 'data-week': i, tabIndex: 0 }, h('b.wk', {}, `WK ${i + 1}`), h('span', {}, h(`span.cx-tag${w.kind === 'race' ? '.ink' : ''}`, {}, kind(w))),
        h('span.c-name', {}, h('b', {}, w.kind === 'race' ? `R${w.round + 1} ${R.name}` : weekTitle(save, w)), h('small', {}, w.kind === 'race' ? `${trackOf(R.track).name} · ${R.laps} laps` : w.kind === 'market' ? (save.clock.season === 1 ? 'Sponsors only: first season' : 'Teams can talk to you') : w.kind === 'end' ? 'Verdict and offers' : `${trackOf(R.track).name} · optional`)),
        h('span.ch-cond', {}, w.kind === 'race' ? conds(R) : null), h('span.val', {}, out));
    });
    calBox = h('div.cx-b.cx-detail', {}, weekDetail(save, calWeek));
    const list = scroller('cx-list', rows);
    return [strip(save), h('div.cx-b', {}, list), calBox];
  }

  // ---------------------------------------------------------------------------------------------- Events
  const eventRow = (w, title, sub, tag, cls, onclick) => h(`div.cx-ev${cls}`, { 'data-nav': '', tabIndex: 0, role: 'button', onclick }, h('span.wk', {}, `WK ${w.week}`), h('div', {}, h('b', {}, title), h('small', {}, sub)), tag ? h(`span.cx-tag${tag.ink ? '.ink' : ''}`, {}, tag.text) : null);
  function events(save) {
    const W = save.season.weeks, now = save.clock.week, state = (w) => (w.week - 1 === now ? '.now' : w.week - 1 < now ? '.past' : '');
    const races = W.filter((w) => w.kind === 'race').map((w) => { const R = save.season.calendar[w.round], res = w.result;
      return eventRow(w, `R${w.round + 1} ${R.name}`, `${trackOf(R.track).name}${R.finale ? ' · points ×1.5' : ''}`, res ? { text: res.dnf ? 'DNF' : `P${res.finish} · ${res.rr.toFixed(1)}` } : w.week - 1 === now ? { text: 'This week', ink: true } : null, state(w),
        () => (w.week - 1 === now ? go('home') : toast(res ? `Round ${w.round + 1}: ${res.dnf ? 'retired' : 'P' + res.finish}, rated ${res.rr.toFixed(1)} (${rrLabel(res.rr)}).` : `Week ${w.week}.`))); });
    const side = (kind) => W.map((w, i) => [w, i]).filter(([w]) => w.event?.kind === kind).map(([w, i]) => { const R = C.roundOfWeek(save, i), e = w.event, spec = i === now ? C.sideSpec(save) : null;
      return eventRow(w, C.eventName(save, w), trackOf(R.track).name, e.result ? { text: MEDAL[e.result.medal] } : e.skipped ? { text: 'Skipped' } : spec ? { text: 'Run it', ink: true } : null, state(w),
        () => (spec ? startEvent(save, spec) : toast(e.result ? 'One try at each event.' : e.skipped ? 'That week has gone.' : `That is week ${w.week}.`))); });
    const col = (ic, title, right, note, rows) => h('div.cx-b', {}, blockHead(ic, title, right), h('p.cx-note', {}, note), scroller('cx-list', rows.length ? rows : h('p.cx-note', {}, 'None this season.')));
    return [col('race', 'Race weekends', `Required · ${save.season.calendar.length} rounds`, 'Practice, qualifying, one try at the race. Points, money and your rating.', races),
      col('time-trial', 'Test days', 'Optional', 'One flying lap against your team\'s targets. Gold earns a free upgrade level.', side('test')),
      col('drift', 'Sponsor events', 'Optional', `Ninety seconds of Drift Attack. It pays by medal${save.sponsors.deals.length ? ', and your sponsor counts the ones you attend' : ''}.`, side('sponsor'))];
  }

  // ---------------------------------------------------------------------------------------------- Inbox
  let mailBox = null;
  function mailDetail(save, m) {
    if (!m) return h('p.cx-note', {}, 'Nothing here yet.');
    const a = m.action, gone = a?.deal && !C.findOffer(save, a.deal);
    return [h('span.kick', {}, `Season ${m.season} · Week ${m.week}`), h('h2', {}, m.title), h('p', {}, m.body),
      a && !gone ? h('div.cx-acts.end', {}, h('button.btn.btn-primary', { 'data-nav': '', onclick: () => (a.deal ? open(a.deal) : go(a.tab)) }, icon(a.deal ? 'contract' : 'chevron-right'), a.deal ? 'Open talks' : `Go to ${TABS.find(([id]) => id === a.tab)?.[1] ?? 'it'}`)) : gone ? h('p.cx-if', {}, 'This offer has closed.') : null];
  }
  function inbox(save) {
    mailId ??= save.inbox[0]?.id ?? null;
    const m = save.inbox.find((x) => x.id === mailId) ?? save.inbox[0]; if (m) { C.markRead(save, m.id); persist(game); }
    mailBox = h('div.cx-b.cx-mailbody', {}, mailDetail(save, m));
    const list = scroller('cx-list', save.inbox.map((x) => mailRow(x, () => { mailId = x.id; build(true); })));
    return [h('div.cx-b', {}, blockHead('mail', 'Inbox', `${C.unread(save)} new`), list), mailBox];
  }

  // ---------------------------------------------------------------------------------------------- Deals
  function deals(save) {
    const me = save.contract, S = save.sponsors, w = C.currentWeek(save), offers = [...save.season.mid, ...S.offers], mkt = w.kind === 'market', d = me.duel;
    const path = me.seat === 'B' ? h('p.cx-if', {}, `The A seat: win the season duel (${d.won}-${d.lost} so far) and hold trust ${TUNING.trust.promote} (${me.trust} now).`) : null;
    const market = save.season.weeks.find((x, i) => x.kind === 'market' && i >= save.clock.week);
    const closed = mkt ? 'Open this week' : market ? `Market opens week ${market.week}` : 'Market opens at the season end';
    const left = h('div.cx-b', {}, blockHead('contract', 'On the table', closed), scroller('cx-list', offers.length ? offers.map((o) => offerRow(save, o, () => open(o.id))) : h('p.cx-note', {}, 'Nothing right now. Teams talk in the market weeks; sponsors come to you before the season and in the market.'),
      me.next ? h('p.cx-note', {}, icon('check'), `Signed for next season: ${teamName(me.next.team)}, ${carName(me.next.car)}.`) : null),
      h('div.cx-bh', {}, h('span', {}, icon('star'), 'Your sponsors'), h('span', {}, `${S.deals.length} of ${C.sponsorSlots(save)} slots`)),
      S.deals.length ? S.deals.map((x) => h('div.cx-spon', {}, brandMark(x.brand), h('div', {}, h('b', {}, `${x.name}: ${money(x.retainer)} a round`), h('small', {}, x.met ? `Target hit: ${money(x.bonus)} paid` : `${targetText(x.target)}: ${x.progress} of ${x.target.count}. Pays ${money(x.bonus)}`)), h('span.cx-tag', {}, `Goodwill ${x.mood}`))) : h('p.cx-if', {}, 'No personal sponsor yet.'));
    const contract = h('div.cx-b', {}, blockHead('helmet', 'Your contract', `${teamName(me.team)} · ${carName(me.car)}`),
      h('div.cx-kv', {}, stat('Status', STATUS_LABEL[me.status]), stat('Salary', coins(me.salary), '/ ROUND'), stat('Runs', String(me.seasonsLeft), me.seasonsLeft === 1 ? 'SEASON' : 'SEASONS'), stat('Release', coins(TUNING.offers.release * me.salary * Math.max(0, me.seasonsLeft - 1)))),
      h('p.cx-note', {}, icon('info'), `Another team buying you out pays you ${Math.round(TUNING.offers.releaseCut * 100)} % of the release clause. A renewal comes up at the season end.`), path);
    const teams = h('div.cx-b', {}, blockHead('people', 'Teams', mkt ? 'Enter to approach' : 'How close you are'), scroller('cx-list', teamRows(save, game, () => build(true))));
    return [left, contract, teams];
  }

  // ---------------------------------------------------------------------------------------------- Standings
  function standings(save) {
    const S = C.standings(save), me = save.contract.team;
    const table = (title, right, rows, name, mine, cols = '') => h('div.cx-b', {}, blockHead('trophy', title, right), h(`div.lhead.cx-st${cols}`, {}, h('span', {}, 'Pos'), h('span'), h('span', {}, name), h('span.val', {}, 'Wins'), h('span.val', {}, 'Pts')),
      scroller('cx-list', rows.length ? rows.map((x, i) => css(h(`div.lrow.cx-st${mine(x) ? '.me' : ''}`, { 'data-nav': '', tabIndex: 0 }, h('b.tnum', {}, i + 1), h('i.tbar'), h('span.c-name', {}, h('b', {}, name === 'Driver' ? x.name : teamName(x.team)), name === 'Driver' ? h('small', {}, teamName(x.team)) : null),
        h('span.val.tnum', {}, x.wins), h('span.val.tnum', {}, String(Math.round(x.pts * 10) / 10))), { '--team': teamMark(loreOf(x.team)) })) : h('p.cx-note', {}, 'No rounds raced yet.')));
    const rs = save.season.results, avg = rs.length ? rs.reduce((a, r) => a + r.rr, 0) / rs.length : null, d = save.contract.duel;
    const you = h('div.cx-b', {}, blockHead('helmet', 'Your season'), h('div.cx-kv', {}, stat('Rounds', `${rs.length} of ${save.season.calendar.length}`), stat('Avg rating', avg ? avg.toFixed(1) : empty()), stat('Duel', `${d.won}-${d.lost}`), stat('Best', rs.length ? (Math.min(...rs.filter((r) => !r.dnf).map((r) => r.finish), 9) < 9 ? 'P' + Math.min(...rs.filter((r) => !r.dnf).map((r) => r.finish)) : 'DNF') : empty())));
    return [table("Drivers'", `${save.season.calendar.length} rounds`, S.drivers, 'Driver', (x) => x.you), table("Teams'", 'One car each round', S.teams, 'Team', (x) => x.team === me), h('div.cx-stack', {}, table(tierCup(save), TIERS.tiers[save.season.tier].name, S.cup, 'Team', (x) => x.team === me), you)];
  }

  // ---------------------------------------------------------------------------------------------- Garage
  function garage(save) {
    const car = save.contract.car, hp = factsOf(car).powerHp, tier = TIERS.tiers[TIERS.teams[save.contract.team].tier], free = save.garage.package ?? 0;
    const why = { cap: `${tier.name} seats are capped at level ${tier.cap}`, maxed: 'Fully upgraded', level: (u) => `Needs Career Level ${u.gate}`, coins: (u) => `Needs ${money(u.cost)}` };
    const DOES = { engine: 'More power on the straights', tyres: 'More grip through the corners', brakes: 'Later braking, shorter stops' };
    return [css(h('div.cx-b.cx-gcar', {}, blockHead(null, `${teamName(save.contract.team)} · ${save.contract.seat} seat`, '#' + (save.player.number)), h('img', { src: still('cars', car), alt: '', decoding: 'async' }), h('strong.cx-title', {}, carName(car)),
        h('div.cx-kv', {}, stat('Power', `${hp} hp`), stat('Upgrade cap', 'Level ' + tier.cap), stat('Career Level', String(save.career.cl)), stat('Wallet', coins(save.wallet.coins)))), { '--team': teamMark(loreOf(save.contract.team)) }),
      h('div.cx-b', {}, blockHead('upgrade', 'Upgrades', free ? `${free} free from the team` : 'Paid from your wallet'),
        CATS.map(([cat, label]) => { const u = C.upgradeInfo(save, cat, hp), r = u.reason;
          return h('div.lrow.cx-up' + (r ? '.off' : ''), { 'data-nav': '', tabIndex: 0, role: 'button', 'aria-label': `${label} upgrade`, onclick: () => {
            const b = C.buyUpgrade(save, cat, hp); if (!b.ok) return toast(typeof why[b.reason] === 'function' ? why[b.reason](b) : why[b.reason] ?? 'Not available', true);
            persist(game); toast(`${label} level ${b.level}: ${b.free ? 'from the team package' : `−${money(b.cost)}`}`); build(true); } },
            icon('upgrade'), h('span.c-name', {}, h('b', {}, label), h('small', {}, DOES[cat])),
            h('span.ch-pips', {}, [1, 2, 3].map((k) => h('i' + (k <= u.level ? '.on' : k > tier.cap ? '.cap' : '')))),
            h('span.val', {}, r ? h('small', {}, typeof why[r] === 'function' ? why[r](u) : why[r]) : u.free ? 'Free' : coins(u.cost))); }),
        h('p.cx-note', {}, icon('info'), 'Parts stay with the car. Leave it and they are sold back at 60 % of what you paid.'))];
  }

  // ---------------------------------------------------------------------------------------------- Driver
  function driver(save) {
    const K = save.career, next = xpForLevel(K.cl + 1), prev = xpForLevel(K.cl), S = save.stats;
    const reset = h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => {
      if (!confirmErase) { confirmErase = true; reset.lastChild.textContent = 'Press again: this career is erased'; return; }
      game.career = null; saveCareer(null); confirmErase = false; game.show('careerStart'); } }, icon('restart'), h('span', {}, 'Erase this career'));
    const slots = h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => { game.career = null; game.show('careerStart'); } }, icon('people'), h('span', {}, 'Other careers'));
    const rivals = C.rivalsOf(save).slice(0, 4);
    return [h('div.cx-b', {}, blockHead('helmet', `${save.player.nation} · #${save.player.number} · ${save.player.code}`), h('strong.cx-title', {}, save.player.name),
        h('div.cx-kv', {}, stat('Career Level', String(K.cl)), stat('XP', K.xp.toLocaleString('en'), K.cl < 25 ? `/ ${next.toLocaleString('en')}` : null), stat('Reputation', String(Math.round(K.rep)), '/ 1000'), stat('Form', signed(formOf(K.rr)))),
        css(h('div.bar4.ch-xp', {}, h('i')), { '--p': K.cl >= 25 ? 1 : (K.xp - prev) / (next - prev) }),
        h('div.cx-kv', {}, stat('Starts', String(S.starts)), stat('Wins', String(S.wins)), stat('Podiums', String(S.podiums)), stat('Poles', String(S.poles)), stat('Fastest laps', String(S.fastest)), stat('Cups', String(S.cups)), stat('Titles', String(S.titles))),
        h('div.cx-bh', {}, h('span', {}, 'Recent ratings')), h('div.cx-rr', {}, K.rr.length ? K.rr.map((x) => css(h('span', {}, h('i'), h('b.tnum', {}, x.toFixed(1))), { '--p': (x - 2) / 8 })) : h('p.cx-note', {}, 'No rounds raced yet.'))),
      h('div.cx-stack', {}, h('div.cx-b', {}, blockHead('people', 'Rivals'), rivals.length ? rivals.map((r) => h('div.lrow.cx-mail', {}, icon(r.feud ? 'warning' : 'people'), h('span.c-name', {}, h('b', {}, r.name), h('small', {}, r.key ? carName(r.key) : 'Looking for a seat')), h('span.wk', {}, `${r.feud ? 'Feud' : 'Rival'} · ${r.heat}`))) : h('p.cx-note', {}, 'Nobody yet. Race close to someone and it starts.')),
        h('div.cx-b', {}, blockHead('trophy', 'Seasons'), scroller('cx-list', save.history.length ? save.history.map((x) => h('div.lrow.cx-mail', {}, icon('trophy'), h('span.c-name', {}, h('b', {}, `Season ${x.season}: ${teamName(x.team)}`), h('small', {}, carName(x.car))), h('span.wk', {}, `P${x.drivers} · ${x.avgRR.toFixed(1)}`))) : h('p.cx-note', {}, 'Your first season is under way.')))),
      h('div.cx-b', {}, blockHead('settings', 'This career'), h('div.cx-setrow', {}, row('Race length', seg(RACE_LENGTHS, save.rules.raceLength, (v) => { C.setRaceLength(save, v); persist(game); build(true); }), 'About how long each race takes. Points and XP are the same at every length.')),
        h('p.cx-note', {}, `Rivals: ${save.rules.difficulty === 'easy' ? 'gentle' : save.rules.difficulty === 'hard' ? 'fierce' : 'normal'}.`), h('div.cx-acts.col', {}, slots, reset))];
  }

  // ---------------------------------------------------------------------------------------------- the frame
  const LAYOUT = { home: 'cx-home', calendar: 'cx-cal', events: 'cx-events', inbox: 'cx-inbox', deals: 'cx-deals', standings: 'cx-standings', garage: 'cx-garage', driver: 'cx-driver' };
  const PAGE = { home, calendar, events, inbox, deals, standings, garage, driver };
  function drawTabs(save) {
    const count = { inbox: C.unread(save), deals: save.season.mid.length + save.sponsors.offers.length };
    fill(tabs, prompt('Q', 'lb'), TABS.map(([id, label, ic]) => h('button' + (tab === id ? '.on' : ''), { tabIndex: -1, role: 'tab', 'aria-selected': String(tab === id), onclick: (e) => { e.stopPropagation(); go(id); } }, icon(ic), label, count[id] ? h('span.badge.tnum', {}, count[id]) : null)), prompt('E', 'rb'));
  }
  function build(keep = false) {
    const save = game.career, cur = keep ? getNav().i : 0, R = C.currentRound(save);
    if (save.clock.phase === 'review') return void game.show('careerStart');
    F.title(`Season ${save.clock.season} · Week ${save.clock.week + 1} of ${save.season.weeks.length}`, `${tierCup(save)} · ${worldName(save)}`);
    F.backdrop('tracks', R?.track); statusBar(F.me, save);
    const nodes = [PAGE[tab](save)].flat(Infinity);   // the page before the tabs: opening a message changes the unread count
    drawTabs(save);
    F.page.className = `cx-page ${LAYOUT[tab]}`; fill(F.page, nodes);
    fill(F.foot, prompts(SELECT, CHOOSE), h('div.sp'), tab === 'home' ? homeFoot(save) : h('button.btn.btn-secondary', { 'data-nav': '', onclick: () => go('home') }, icon('home'), 'This week'), h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => api.back() }, icon('back'), 'Menu', prompt('Esc', 'b')));
    F.page.querySelectorAll('.lscroll').forEach(fadeMore);
    const L = getNav().items(), first = L.findIndex((e) => e.classList.contains('cx-go'));
    if (keep) return void getNav().reset(Math.min(cur, L.length - 1));
    const event = tab === 'home' ? L.findIndex((e) => e.classList.contains('next')) : -1;
    const here = L.findIndex((e) => e.classList.contains('now') || e.classList.contains('me'));   // the Calendar and Events open on this week, Standings on your row
    getNav().reset(tab === 'home' ? Math.max(0, event >= 0 ? event : first) : here >= 0 ? here : Math.max(0, L.findIndex((e) => e.closest('.cx-page'))));
  }
  const api = {
    el: F.el, nav: true, grid: true,
    onShow(t) { if (!game.career) return void game.show('careerStart'); if (t) tab = t; armed = false; confirmErase = false; calWeek = null; mailId = null; build(); },
    onKeyTab(d) { go(TABS[(TABS.findIndex(([id]) => id === tab) + d + TABS.length) % TABS.length][0]); },
    /** the Calendar's and the Inbox's detail panels follow the focus */
    onSel(el) {
      const save = game.career; if (!save || !el) return;
      if (tab === 'calendar' && el.dataset.week !== undefined && calBox) { calWeek = +el.dataset.week; fill(calBox, weekDetail(save, calWeek).flat(Infinity)); }
      if (tab === 'inbox' && el.dataset.mail !== undefined && mailBox && +el.dataset.mail !== mailId) {
        mailId = +el.dataset.mail; const m = C.markRead(save, mailId); el.classList.remove('new'); persist(game); fill(mailBox, [mailDetail(save, m)].flat(Infinity)); drawTabs(save);
      }
    },
    back() { game.leaveCareer(); },
  };
  return api;
}
