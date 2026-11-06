// The career hub (docs/career-mode.md section 13): full screen, one status bar, ten tabs (Q/E, LB/RB), one red button that always does the next thing.
// Home is this week; Calendar the weeks; Events the three kinds; Inbox every message; Media what the paddock press wrote; Deals the talks, your contract, the teams; Standings, Garage, Life (mood, fan support, the Shop), Driver.
import { h, fill, css, seg, stat, still, row, prompt, empty, getNav, teamMark, fadeMore } from './ui.js';
import { carName, factsOf } from './carinfo.js';
import { WEATHER, fmtTime } from './store.js';
import { CATS } from './economy.js';
import { icon } from './icons.js';
import { trackOf } from '../tracks.js';
import { saveCareer } from './career/save.js';
import * as C from './career/career.js';
import { TUNING, TIERS, CAR, CAL, SPONSORS, loreOf, objectiveText, xpForLevel, formOf, STATUS_LABEL, rrLabel, targetText, isSpecial, pointsMult } from './career/rules.js';
import { frame, statusBar, strip, coins, money, signed, teamName, persist, playerDriver, LOOK, WX_ICON, MEDAL, EVENT, ROUND_EVENT, prompts, SELECT, CHOOSE, blockHead, weekTitle, worldName, tierCup, brandMark, cs, delta, rich, kindOf, kindIcon, STORY_KICK, storyPic, storySource, mediaBytes } from './career-shell.js';
import { offerRow, teamRows } from './career-deals.js';

const LIFE_BANDS = [...C.LIFE.bands].reverse();
const SHOP_ICON = { luxury: 'star', party: 'music', off: 'sun', giving: 'people', ad: 'camera', crew: 'assists', engineer: 'upgrade' };
const STAFF_WHY = { hired: 'Hired', better: 'A better hire works this season', level: (s) => `Needs Career Level ${s.cl}`, coins: (s) => `Needs ${money(s.cost)}` };
const SHOP_WHY = { max: () => 'You own the most you can', coins: (q) => `Needs ${money(q.price)}`, week: () => 'Needs an open week', taken: () => 'This week is booked', rep: (q) => `Needs reputation ${q.item.minRep}`, cap: () => 'Done as often as a season allows' };

const TABS = [['home', 'Home', 'home'], ['calendar', 'Calendar', 'calendar'], ['events', 'Events', 'track'], ['inbox', 'Inbox', 'mail'], ['media', 'Media', 'camera'], ['deals', 'Deals', 'contract'], ['standings', 'Standings', 'trophy'], ['garage', 'Garage', 'garage'], ['life', 'Life', 'energy'], ['driver', 'Driver', 'helmet']];
const RACE_LENGTHS = Object.entries(TUNING.series.lengths).map(([id, min]) => [id, `${id[0].toUpperCase()}${id.slice(1)} · ${min} min`]);
const lengthName = (id) => `${id[0].toUpperCase()}${id.slice(1)}`;
/** a rivalry's cause (world.js career.rivalry) and the head-to-head record, as the Rivals block reads them */
const CAUSE = { contact: 'Contact on track', pass: 'Swapped places on track', teammate: 'Your teammate', displaced: 'Lost the seat to you', grid: 'Raced you close' };
const record = ({ w, l }) => (!w && !l ? 'no finish together yet' : w > l ? `${w}-${l} to you` : w < l ? `${l}-${w} to them` : `${w}-${l}`);
const MAIL_ICON = { race: 'race', deal: 'contract', team: 'people', warn: 'warning', event: 'time-trial', sponsor: 'drift', news: 'mail' };
const conds = (R) => [icon(LOOK[R.look][1], { label: LOOK[R.look][0] }), icon(WX_ICON[R.weather], { label: WEATHER[R.weather].label })];
const scroller = (cls, ...kids) => h(`div.lscroll.${cls}`, { onscroll: (e) => fadeMore(e.currentTarget) }, ...kids);

export function CareerHubScreen(game) {
  let tab = 'home', armed = false, hiring = null, calWeek = null, mailId = null, storyId = null;
  const tabs = h('div.stabs', { 'data-nav': '', 'data-adjust': '', tabIndex: 0, role: 'tablist', 'aria-label': 'Career tabs', onadjust: (e) => { api.onKeyTab(e.detail); getNav().reset(getNav().items().indexOf(tabs)); }, onclick: () => api.onKeyTab(1) });     // Left and Right stay on the strip, so holding one cycles the tabs
  const F = frame('career-hub', tabs);
  const go = (t) => { tab = t; armed = false; hiring = null; build(); };
  const open = (id) => game.show('careerDeal', { id, home: 'careerHub' });
  const toast = (msg, err) => game.setBusy(msg, err ? { kind: 'error', ms: 4000 } : {});

  // ---------------------------------------------------------------------------------------------- sessions
  function startPractice(save) {
    const R = C.currentRound(save), car = save.contract.car, lock = C.practiceLocked(save); if (lock) return toast(lock, true);
    game.careerSession('practice', { track: R.track, look: R.look, weather: R.weather, laps: R.laps, car, home: 'careerHub', session: { levels: C.raceSetup(save).levels, drivers: { [car]: playerDriver(save, save.contract.team) } } }, () => game.show('careerHub', 'home'));
  }
  function startQuali(save) {
    const R = C.currentRound(save), V = C.qualiVenue(save), car = save.contract.car, lv = C.raceSetup(save).levels;
    game.careerSession('quali', { ...V, laps: R.laps, car, home: 'careerHub',
      session: { ...C.qualiSetup(save), levels: lv, runUp: TUNING.series.qualiRunUp } }, (d) => {
      C.logHits(save, d.hits); C.finishQuali(save, d.best, d.mateLap); persist(game);
      const q = save.season.current.quali, p = C.qualiPlace(q, car), lap = q.laps[car], cut = q.laps[q.grid.at(-1)];
      const next = C.retriesLeft(q) ? 'Use your retry, or sit this one out.' : 'You sit this one out.';
      game.show('careerHub', 'home'); toast(!Number.isFinite(lap) ? `No valid lap: the top ${q.grid.length} race without you. ${next}` : q.grid.includes(car) ? `Qualified P${p}: ${fmtTime(lap)}. ${q.mate.code} ${fmtTime(q.mate.lap)}: duel ${q.duel.result}.` : `P${p}: ${(lap - cut).toFixed(3)} s off the top ${q.grid.length}. ${next}`, !q.grid.includes(car));
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
    const X = C.raceSetup(save), lcq = save.season.current.open?.stage === 'lcq';
    game.careerSession('race', { track: X.track, look: X.look, weather: X.weather, laps: X.laps, car: X.hero, home: 'careerHub',
      session: { racers: X.racers, gridOrder: X.gridOrder, pace: X.pace, levels: X.levels, drivers: X.drivers, label: X.label, field: X.field } }, (d) => {
      const result = { order: d.order, best: d.bests, dnf: d.dnf, crashes: d.crashes, hits: d.hits, spins: d.spins, pro: d.pro, contacts: d.contacts, passes: d.passes };
      const report = lcq ? C.finishLcq(save, result) : C.finishRace(save, result);      // the Last Chance Qualifier is its own short report; the Final is the round's
      persist(game); game.show('careerReport', report);
    });
  }

  // ---------------------------------------------------------------------------------------------- Home
  const MODE_STATE = { open: ['Open', null], next: ['Next up', 'chevron-right'], off: ['Locked', 'lock'], done: ['Done', 'check'] };
  const mode = (ic, title, note, state, onclick, kind) => h(`button.cx-mode.${state}.k-${kind}`, { 'data-nav': '', 'data-ic': ic, onclick }, h('span.cm-top', {}, icon(ic), h('span.cm-st', {}, MODE_STATE[state][1] ? icon(MODE_STATE[state][1]) : null, MODE_STATE[state][0])), h('b', {}, title), h('small', {}, note));
  /** what you can drive, in order, each with its state and its reason */
  function modes(save) {
    const w = C.currentWeek(save), race = w.kind === 'race', q = save.season.current.quali, me = save.contract, spec = C.sideSpec(save), W = save.season.weeks, i = save.clock.week;
    const nextRace = W.slice(i).find((x) => x.kind === 'race'), nextEvent = W.slice(i + 1).find((x) => x.event), R = C.currentRound(save);
    const locked = (why) => () => toast(why, true), grid = q ? C.qualiPlace(q, me.car) : null, inRace = q?.grid.includes(me.car), left = q ? C.retriesLeft(q) : 0;
    const o = save.season.current.open, lock = C.practiceLocked(save);
    const tiles = [lock ? mode('free-drive', 'Practice', `Locked: ${trackOf(R.track).name} stays fresh until the Final`, 'off', locked(lock), 'practice') : mode('free-drive', 'Practice', `Open: ${trackOf(R.track).name}, no stakes`, 'open', () => startPractice(save), 'practice')];
    if (w.kind === 'market') tiles.push(mode('contract', 'The market', save.clock.season === 1 ? 'Open this week: sponsors only' : 'Open this week: talk and approach', 'next', () => go('deals'), 'market'));
    else if (spec) tiles.push(mode(EVENT[spec.kind][1], EVENT[spec.kind][0], 'This week: optional', 'next', () => startEvent(save, spec), spec.kind));
    else if (w.event?.result) tiles.push(mode(EVENT[w.event.kind][1], EVENT[w.event.kind][0], `Done: ${MEDAL[w.event.result.medal]}`, 'done', locked('One try at each event.'), w.event.kind));
    else if (nextEvent) tiles.push(mode(EVENT[nextEvent.event.kind][1], EVENT[nextEvent.event.kind][0], `Week ${nextEvent.week}`, 'off', locked(`The next one is in week ${nextEvent.week}.`), nextEvent.event.kind));
    const skip = o?.seeded ? `Seeded P${o.rank} in the ranking. You start P${grid}` : q?.exempt ? `Not needed after ${q.exempt.why}. You start P${grid}` : null;
    tiles.push(race && o?.kind === 'masters' ? mode('time-trial', 'Qualifying', o.seeded ? `Not needed: the top ${o.seeds.length} of the ranking. You start P${grid}` : `Ranked ${o.rank}: only the top ${o.seeds.length} race`, 'done', locked('The Masters has no qualifying: the ranking sets the grid.'), 'race')
      : race && skip ? mode('time-trial', 'Qualifying', skip, 'done', locked(`No qualifying this round: you start P${grid}.`), 'race')
      : race ? mode('time-trial', left ? 'Improve your lap' : 'Qualifying', q ? `${inRace ? 'Grid ' : ''}P${grid}: ${q.laps[me.car] ? fmtTime(q.laps[me.car]) : 'no lap'}. ${!left ? 'Retry used' : inRace ? 'One retry: keeps the better lap' : `One retry: beat ${fmtTime(q.laps[q.grid.at(-1)])} to race`}` : o ? `Next: one flying lap at Dry Lake. The fastest ${TUNING.series.gridSize} of 12 race the Last Chance` : 'Next: one flying lap on track with your teammate. One retry', !q ? 'next' : !left ? 'done' : inRace ? 'open' : 'next', !q || left ? () => startQuali(save) : locked('One retry per round, and yours is used.'), 'race')
      : mode('time-trial', 'Qualifying', `Week ${nextRace.week}`, 'off', locked(`Qualifying opens in race week: week ${nextRace.week}.`), 'race'));
    const lcq = o?.stage === 'lcq', rtitle = lcq ? 'Last Chance' : o?.kind === 'masters' ? 'The Masters' : o ? 'The Final' : 'Race', rlaps = lcq ? R.lcqLaps : R.laps;
    tiles.push(race ? mode('race', rtitle, inRace ? `Next: ${rlaps} laps${lcq ? ` at Dry Lake, top ${TUNING.open.lcqThrough} reach the Final` : ''} from P${grid}. One try` : q ? `Missed the cut: top ${q.grid.length} race` : 'Locked: qualify first', inRace ? 'next' : 'off', inRace ? () => startRace(save) : locked(q ? `Only the top ${q.grid.length} race. ${left ? 'Use your retry, or sit this one out.' : 'Sit this one out.'}` : 'Qualify first: the top 8 race.'), 'race')
      : mode('race', 'Race', `Week ${nextRace.week}`, 'off', locked(`The next race is in week ${nextRace.week}.`), 'race'));
    const L = Object.keys(TUNING.series.lengths), step = (d) => { C.setRaceLength(save, L[(L.indexOf(save.rules.raceLength) + d + L.length) % L.length]); persist(game); build(true); };
    tiles.push(h('button.cx-mode.open.k-practice', { 'data-nav': '', 'data-adjust': '', 'data-ic': 'timer', onclick: () => step(1), onadjust: (e) => step(e.detail) }, h('span.cm-top', {}, icon('timer'), h('span.cm-st', {}, 'Change')), h('b', {}, `${lengthName(save.rules.raceLength)} race`), h('small', {}, `${TUNING.series.lengths[save.rules.raceLength]} min. Press to change. Pay is the same`)));
    return css(h('div.cx-modes', {}, tiles), { '--n': tiles.length });
  }
  /** this week, big: a race weekend, an event, the market */
  function thisWeek(save) {
    const w = C.currentWeek(save), R = C.currentRound(save), t = trackOf(R.track), cur = save.season.current, n = save.season.calendar.length, spec = C.sideSpec(save);
    const hero = (kind, kick, title, ...rest) => h(`div.cx-b.cx-week.k-${kind}`, {}, h('img', { src: still('tracks', (spec ? trackOf(spec.track) : t).id), alt: '', decoding: 'async' }), h('span.kick', {}, kick), h('h2', {}, title), rest);
    const look = stat('Time of day', [icon(LOOK[R.look][1]), LOOK[R.look][0]]);
    if (w.kind === 'race') return hero(isSpecial(R) ? 'open' : 'race', `This week · ${ROUND_EVENT[R.event] ?? 'Race weekend'} · Round ${R.round} of ${n}${pointsMult(R) > 1 ? ` · points ×${pointsMult(R)}` : ''}`, R.name,
      h('div.r-stats', {}, stat('Circuit', t.name), look, stat('Weather', [icon(WX_ICON[R.weather]), WEATHER[R.weather].label]), stat('Race', `${R.laps} laps`), stat('Expected', 'P' + cur.expPos)),
      cur.open ? h('p.cx-note', {}, icon('trophy'), C.weekNote(save, R)) : null,
      h('div.cx-objs', {}, C.roundObjectives(save).map((o) => h('span', {}, icon(o.mandatory ? 'star' : 'plus'), objectiveText(o), h('small', {}, o.mandatory ? 'Required' : 'Bonus')))),
      notices(save));
    if (w.kind === 'market') return hero('market', 'This week · The market', 'The market is open',
      h('p.cx-note', {}, save.clock.season === 1 ? 'Sponsors can still talk this week. Teams will not: your first season is probation, and they come to you when the season ends.' : 'Teams can talk to you and you can knock on their doors, for this one week. Anything you sign starts next season. Then the window shuts until the season ends.'),
      h('div.r-stats', {}, stat('On the table', String(save.season.mid.length + save.sponsors.offers.length)), cs('rep', 'Reputation', String(Math.round(save.career.rep))), stat('Next', R.name)), notices(save));
    if (spec) return hero(spec.kind, `This week · ${EVENT[spec.kind][0]} · Optional`, spec.name,
      h('p.cx-note', {}, spec.kind === 'test' ? 'One flying lap against the team\'s targets. Gold earns a free upgrade level.' : `Ninety seconds of Drift Attack. It pays by medal${save.sponsors.deals.length ? ', and your sponsor counts the ones you turn up to' : ''}.`),
      h('div.r-stats', {}, stat('Circuit', trackOf(spec.track).name), look, spec.targets.map((v, i) => stat(['Bronze', 'Silver', 'Gold'][i], spec.kind === 'test' ? fmtTime(v) : Math.round(v).toLocaleString('en')))), notices(save));
    if (w.activity) { const a = C.itemOf(w.activity.id); return hero('practice', `This week · ${C.TYPES.find((t) => t.id === a.type).name}`, a.name, h('p.cx-note', {}, a.type === 'off' ? 'Time off. The optional event this week is skipped.' : a.type === 'ad' ? `The shoot for ${SPONSORS.brands[w.activity.brand]?.name ?? 'your sponsor'} takes the week.` : a.line), notices(save)); }
    const e = w.event;
    return hero(e ? e.kind : 'practice', `This week · ${e ? EVENT[e.kind][0] : 'Pre-season'}`, e?.result ? `${C.eventName(save, w)}: ${MEDAL[e.result.medal]}` : 'Nothing on this week',
      h('p.cx-note', {}, `Next up: ${R.name}, round ${R.round} of ${n}, at ${t.name}.`), notices(save));
  }
  /** the seat review's warning (6.7) and a deal already signed for next season */
  function notices(save) {
    const me = save.contract, w = me.warning, act = C.currentWeek(save).activity;
    return [act && !C.currentWeek(save).event?.skipped ? h('p.cx-note', {}, icon('energy'), `Booked this week: ${C.itemOf(act.id).name}.`) : null,
      w ? h('p.cx-note.warn', {}, icon('warning'), w.left > 0 ? `Seat review: meet the round objective in each of the next rounds (${w.met} of ${TUNING.trust.recover} done, ${w.left} left).` : `Seat review missed. Trust under ${TUNING.trust.drop} at the finale costs you the seat. Trust is ${me.trust}.`) : null,
      me.next ? h('p.cx-note', {}, icon('check'), `Signed for next season: ${teamName(me.next.team)}, ${carName(me.next.car)}.`) : null];
  }
  const mailRow = (m, onclick) => h(`div.lrow.cx-mail.m-${m.kind}${m.read ? '' : '.new'}`, { 'data-nav': '', 'data-mail': m.id, tabIndex: 0, role: 'button', onclick }, icon(MAIL_ICON[m.kind] ?? 'mail'), h('span.c-name', {}, h('b', {}, m.title), h('small', {}, rich(m.body))), h('span.wk', {}, `WK ${m.week}`));
  const miniRow = (pos, team, name, pts, me) => css(h(`div.lrow.cx-mini${me ? '.me' : ''}`, {}, h('b.tnum', {}, pos), h('i.tbar'), h('span', {}, name), h('b.tnum', {}, String(Math.round(pts * 10) / 10))), { '--team': teamMark(loreOf(team)) });
  /** the next Open or the Masters: where the player stands in the Ultrack Ranking and what it takes to get in (also on the report) */
  function road(save) {
    const i = save.clock.week, cal = save.season.calendar, R = cal.slice(save.clock.round).find(isSpecial); if (!R) return null;
    const rk = C.rankingOf(save), me = rk.find((x) => x.you), masters = R.kind === 'masters', cut = masters ? TUNING.series.gridSize : TUNING.open.direct, line = rk[cut - 1], when = save.season.weeks.findIndex((w) => w.kind === 'race' && w.round === R.round - 1) - i;
    const rows = [...new Map([rk[0], line, me.rank <= cut ? rk[cut] : null, me].filter(Boolean).sort((a, b) => a.rank - b.rank).map((x) => [x.rank, x])).values()];   // the leader, the driver on the cut line, the first one outside it, and you
    return h('div.cx-b.k-open.cx-road', {}, blockHead('trophy', `Road to the ${R.name}`, when > 0 ? `In ${when} ${when === 1 ? 'week' : 'weeks'}` : 'This week'),
      h('div.cx-roadhead', {}, stat('Ranked', `P${me.rank}`, 'of 16'), stat(me.rank <= cut ? 'Lead on the cut' : 'To the cut', me.rank <= cut ? `+${Math.round((me.pts - (rk[cut]?.pts ?? 0)) * 10) / 10} pts` : `${Math.round((line.pts - me.pts) * 10) / 10} pts`)),
      h('div', {}, rows.map((x, k) => css(h(`div.lrow.cx-mini${x.you ? '.me' : ''}${k === cut - 1 ? '.cut' : ''}`, {}, h('b.tnum', {}, x.rank), h('i.tbar'), h('span', {}, x.you ? save.player.name : C.personOf(save, x.code)?.name ?? x.code), h('b.tnum', {}, String(Math.round(x.pts)))), { '--team': teamMark(loreOf(CAR[x.key].team)) }))),
      );
  }
  function homeSide(save) {
    const q = save.season.current.quali, st = C.standings(save), me = save.contract, d = me.duel, n = C.unread(save), box = save.inbox.slice(0, 4);
    const low = q ? h('div.cx-b.k-race', {}, blockHead('race', 'The grid', q.duel.skipped ? 'No duel this round' : `Duel ${q.duel.result}`), h('div.cx-gridlist', {}, (q.grid.includes(me.car) ? q.grid : [...q.grid, me.car]).map((k) => css(h(`span.cx-slot${k === me.car ? '.me' : ''}`, {}, h('b.tnum', {}, C.qualiPlace(q, k)), h('i.tbar'), h('span', {}, C.driverAt(save, k).code), h('small.tnum', {}, q.laps[k] ? fmtTime(q.laps[k]) : q.fixed && q.grid.includes(k) ? 'Seeded' : k === me.car && q.exempt ? 'Pre-qualified' : 'No time')), { '--team': teamMark(loreOf(CAR[k].team)) }))))
      : road(save) ?? h('div.cx-b', {}, blockHead('trophy', tierCup(save), save.season.results.length ? `After round ${save.season.results.length}` : 'No rounds yet'), h('div', {}, st.cup.slice(0, 3).map((t, i) => miniRow(i + 1, t.team, teamName(t.team), t.pts, t.you))),
        h('div.cx-bh.end', {}, h('span', {}, icon('people'), 'Duel'), h('span', {}, `${d.won}-${d.lost} · ${C.driverAt(save, C.teammateCar(save)).name}`)));
    return h('div.cx-side', {}, h('div.cx-b', {}, blockHead('mail', 'Inbox', n ? `${n} new` : 'All read'), h('div', {}, box.map((m) => mailRow(m, () => { mailId = m.id; go('inbox'); })))), low);
  }
  function homeFoot(save) {
    const w = C.currentWeek(save), q = save.season.current.quali, next = save.season.weeks[save.clock.week + 1], warn = C.advanceWarnings(save);
    if (w.kind === 'race' && q && !q.grid.includes(save.contract.car)) {
      const left = C.retriesLeft(q), sitOut = () => { armed = false; const report = C.finishDnq(save); persist(game); game.show('careerReport', report); };
      const o = save.season.current.open, why = o?.kind === 'masters' ? `Ranked ${o.rank}. Only the top ${q.grid.length} of the ranking race the Masters.` : o ? `Only the fastest ${q.grid.length} of 12 race the Last Chance.` : `Only the top ${q.grid.length} race.`;
      if (!left) return [h('div.cx-next', {}, h('small', {}, o?.kind === 'masters' ? 'Not in the Masters' : 'Missed the cut'), h('span', {}, o?.kind === 'masters' ? `${why} It runs without you.` : `P${C.qualiPlace(q, save.contract.car)}. ${why} Your retry is used.`)), h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: sitOut }, icon('chevron-right'), 'Sit out this round')];
      return [h('div.cx-next', {}, h('small', {}, 'Missed the cut'), h('span', {}, armed ? 'No race and no points this round. Press again to sit it out.' : `P${C.qualiPlace(q, save.contract.car)}. ${why} One retry left.`)),
        h('button.btn.btn-secondary', { 'data-nav': '', onclick: () => { if (armed) return sitOut(); armed = true; build(true); } }, icon('close'), 'Sit out'),
        h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: () => startQuali(save) }, icon('time-trial'), 'Use your retry')];
    }
    if (w.kind === 'race') return [h('div.cx-next', {}, h('small', {}, 'Race week'), h('span', {}, q ? `One try at the race. Retire classifies you last.` : `Qualifying first, at ${trackOf(C.qualiVenue(save).track).name}: one valid flying lap`)),
      h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: () => (q ? startRace(save) : startQuali(save)) }, icon(q ? 'race' : 'time-trial'), q ? (save.season.current.open?.stage === 'lcq' ? 'Start the Last Chance' : save.season.current.open ? 'Start the Final' : 'Start the race') : 'Start qualifying')];
    const spec = C.sideSpec(save), note = armed && warn.length ? warn.join('. ') + '. Press again to go on.' : `Week ${next.week}: ${weekTitle(save, next)}`;
    return [h('div.cx-next', {}, h('small', {}, armed && warn.length ? 'Before you go' : 'Next'), h('span', {}, note)),
      h('button.btn.btn-primary.cx-go', { 'data-nav': '', onclick: () => {
        if (warn.length && !armed) { armed = true; return build(true); }
        C.advanceWeek(save); persist(game); armed = false; build();
      } }, icon('chevron-right'), spec ? 'Skip and advance' : 'Advance')];
  }
  const home = (save) => [strip(save), thisWeek(save), homeSide(save), mediaBytes(save, C.latestBytes(save), (id) => { storyId = id; go('media'); }), modes(save)];

  // ---------------------------------------------------------------------------------------------- Calendar
  function weekDetail(save, i) {
    const w = save.season.weeks[i], R = C.roundOfWeek(save, i), t = R && trackOf(R.track), res = w.result, e = w.event;
    const body = w.kind === 'race' ? [h('p.cx-note', {}, R.kind === 'open' ? `The ${R.name}, raced here and nowhere else. The top ${TUNING.open.direct} of the Ultrack Ranking go straight to the Final. The rest fly one lap at ${trackOf(C.qualiVenue(save).track).name}, the fastest ${TUNING.series.gridSize} race the Last Chance there, and its top ${TUNING.open.lcqThrough} join the Final. Practice opens when you reach it.`
        : R.kind === 'masters' ? `The season closer: the top ${TUNING.series.gridSize} of the Ultrack Ranking, no qualifying.` : `Race weekend: practice is open, the top 8 of 16 in qualifying at ${trackOf(C.qualiVenue(save).track).name} race, then one try at the race.`),
      h('div.cx-kv.two', {}, stat('Circuit', t.name), stat('Round', `${R.round} of ${save.season.calendar.length}${pointsMult(R) > 1 ? ` · ×${pointsMult(R)}` : ''}`), stat('Conditions', [icon(LOOK[R.look][1]), LOOK[R.look][0], ' · ', WEATHER[R.weather].label]), stat('Race', `${R.laps} laps`), res ? stat('Result', res.dnf ? 'Retired' : 'P' + res.finish) : null, res ? stat('Rating', res.rr.toFixed(1)) : null)]
      : w.kind === 'market' ? [h('p.cx-note', {}, save.clock.season === 1 ? 'One week for sponsors. Teams wait for the season end: your first season is probation.' : 'One week when teams can talk to you and you can approach them. Anything you sign starts next season.')]
        : w.kind === 'end' ? [h('p.cx-note', {}, 'The season review, your team\'s verdict, and the market: every offer for next season.')]
          : [h('p.cx-note', {}, e.kind === 'test' ? 'Optional. One flying lap against the team\'s targets; gold earns a free upgrade level.' : 'Optional. Ninety seconds of Drift Attack; it pays by medal, and a signed sponsor counts the ones you turn up to.'),
            h('div.cx-kv.two', {}, stat('Circuit', t.name), stat('Result', e.result ? MEDAL[e.result.medal] : e.skipped ? 'Skipped' : empty()), w.activity ? stat('Activity', C.itemOf(w.activity.id).name) : null)];
    return [blockHead('calendar', `Week ${i + 1}`, i === save.clock.week ? 'This week' : i < save.clock.week ? 'Done' : `In ${i - save.clock.week} ${i - save.clock.week === 1 ? 'week' : 'weeks'}`), h('strong.cx-title', {}, weekTitle(save, w)), body];
  }
  let calBox = null;
  function calendar(save) {
    calWeek ??= save.clock.week;
    const now = save.clock.week, kind = (w) => (w.kind === 'race' ? (ROUND_EVENT[w.ev] ?? 'Race') : w.kind === 'market' ? 'Market' : w.kind === 'end' ? 'Review' : w.event.kind === 'test' ? 'Test' : 'Sponsor');
    const rows = save.season.weeks.map((w, i) => {
      const R = C.roundOfWeek(save, i), e = w.event, res = w.result;
      const out = res ? (res.dnq ? 'DNQ' : res.dnf ? 'DNF' : `P${res.finish} · ${res.rr.toFixed(1)}`) : e?.result ? MEDAL[e.result.medal] : w.activity ? C.itemOf(w.activity.id).name : e?.skipped ? 'Skipped' : i === now ? 'This week' : '';
      return h(`div.lrow.cx-calrow.k-${kindOf(w)}${i === now ? '.now' : ''}${i < now ? '.past' : ''}`, { 'data-nav': '', 'data-week': i, tabIndex: 0 }, h('b.wk', {}, `WK ${i + 1}`), h('span', {}, h(`span.cx-tag.kt.k-${kindOf(w)}`, {}, icon(kindIcon(w)), kind(w))),
        h('span.c-name', {}, h('b', {}, w.kind === 'race' ? `R${w.round + 1} ${R.name}` : weekTitle(save, w)), h('small', {}, w.kind === 'race' ? `${ROUND_EVENT[R.event] && !isSpecial(R) ? `${ROUND_EVENT[R.event]} · ` : ''}${trackOf(R.track).name} · ${R.laps} laps` : w.kind === 'market' ? (save.clock.season === 1 ? 'Sponsors only: first season' : 'Teams can talk to you') : w.kind === 'end' ? 'Verdict and offers' : `${trackOf(R.track).name} · optional`)),
        h('span.ch-cond', {}, w.kind === 'race' ? conds(R) : null), h('span.val', {}, i < now ? icon(e?.skipped ? 'minus' : 'check') : null, out));
    });
    calBox = h(`div.cx-b.cx-detail.k-${kindOf(save.season.weeks[calWeek])}`, {}, weekDetail(save, calWeek));
    const list = scroller('cx-list', rows);
    return [strip(save), h('div.cx-b', {}, list), calBox];
  }

  // ---------------------------------------------------------------------------------------------- Events
  const eventRow = (w, title, sub, tag, cls, onclick) => h(`div.cx-ev${cls}`, { 'data-nav': '', tabIndex: 0, role: 'button', onclick }, h('span.wk', {}, `WK ${w.week}`), h('div', {}, h('b', {}, title), h('small', {}, sub)), tag ? h(`span.cx-tag${tag.ink ? '.ink' : ''}`, {}, tag.text) : null);
  function events(save) {
    const W = save.season.weeks, now = save.clock.week, state = (w) => (w.week - 1 === now ? '.now' : w.week - 1 < now ? '.past' : '');
    const races = W.filter((w) => w.kind === 'race').map((w) => { const R = save.season.calendar[w.round], res = w.result;
      return eventRow(w, `R${w.round + 1} ${R.name}`, `${ROUND_EVENT[R.event] && !isSpecial(R) ? `${ROUND_EVENT[R.event]} · ` : ''}${trackOf(R.track).name}${pointsMult(R) > 1 ? ` · points ×${pointsMult(R)}` : ''}`, res ? { text: res.dnq ? 'DNQ' : res.dnf ? 'DNF' : `P${res.finish} · ${res.rr.toFixed(1)}` } : w.week - 1 === now ? { text: 'This week', ink: true } : null, state(w),
        () => (w.week - 1 === now ? go('home') : toast(res ? `Round ${w.round + 1}: ${res.dnq ? 'did not qualify' : res.dnf ? 'retired' : 'P' + res.finish}, rated ${res.rr.toFixed(1)} (${rrLabel(res.rr)}).` : `Week ${w.week}.`))); });
    const side = (kind) => W.map((w, i) => [w, i]).filter(([w]) => w.event?.kind === kind).map(([w, i]) => { const R = C.roundOfWeek(save, i), e = w.event, spec = i === now ? C.sideSpec(save) : null;
      return eventRow(w, C.eventName(save, w), trackOf(R.track).name, e.result ? { text: MEDAL[e.result.medal] } : e.skipped ? { text: w.activity ? C.itemOf(w.activity.id).name : 'Skipped' } : spec ? { text: 'Run it', ink: true } : null, state(w),
        () => (spec ? startEvent(save, spec) : toast(e.result ? 'One try at each event.' : e.skipped ? 'That week has gone.' : `That is week ${w.week}.`))); });
    const col = (kind, ic, title, right, note, rows) => h(`div.cx-b.k-${kind}`, {}, blockHead(ic, title, right), h('p.cx-note', {}, note), scroller('cx-list', rows.length ? rows : h('p.cx-note', {}, 'None this season.')));
    return [col('race', 'race', 'Race weekends', `Required · ${save.season.calendar.length} rounds`, 'Practice, qualifying, one try at the race. Points, money and your rating.', races),
      col('test', 'time-trial', 'Test days', 'Optional', 'One flying lap against your team\'s targets. Gold earns a free upgrade level.', side('test')),
      col('sponsor', 'drift', 'Sponsor events', 'Optional', `Ninety seconds of Drift Attack. It pays by medal${save.sponsors.deals.length ? ', and your sponsor counts the ones you attend' : ''}.`, side('sponsor'))];
  }

  // ---------------------------------------------------------------------------------------------- Inbox
  let mailBox = null;
  function mailDetail(save, m) {
    if (!m) return h('p.cx-note', {}, 'Nothing here yet.');
    const a = m.action, gone = a?.deal && !C.findOffer(save, a.deal);
    return [h('span.kick', {}, `Season ${m.season} · Week ${m.week}`), h('h2', {}, m.title), h('p', {}, rich(m.body)),
      a && !gone ? h('div.cx-acts.end', {}, h('button.btn.btn-primary', { 'data-nav': '', onclick: () => (a.deal ? open(a.deal) : go(a.tab)) }, icon(a.deal ? 'contract' : 'chevron-right'), a.deal ? 'Open talks' : `Go to ${TABS.find(([id]) => id === a.tab)?.[1] ?? 'it'}`)) : gone ? h('p.cx-if', {}, 'This offer has closed.') : null];
  }
  function inbox(save) {
    mailId ??= save.inbox[0]?.id ?? null;
    const m = save.inbox.find((x) => x.id === mailId) ?? save.inbox[0]; if (m) { C.markRead(save, m.id); persist(game); }
    mailBox = h('div.cx-b.cx-mailbody', {}, mailDetail(save, m));
    const list = scroller('cx-list', save.inbox.map((x) => mailRow(x, () => { mailId = x.id; build(true); })));
    return [h('div.cx-b', {}, blockHead('mail', 'Inbox', `${C.unread(save)} new`), list), mailBox];
  }

  // ---------------------------------------------------------------------------------------------- Media
  let storyBox = null;
  /** a tile in the feed: the whole picture, the source and week, the headline */
  const storyTile = (save, s, onclick) => h(`button.cx-tile${s.read ? '' : '.new'}`, { 'data-nav': '', 'data-story': s.id, onclick }, storyPic(save, s), h('small', {}, h('span', {}, STORY_KICK[s.kind] ?? 'The paddock'), h('span', {}, `S${s.season} · WK ${s.week}`)), h('b', {}, s.title));
  /** the front page: the picture, whole; the headline; the story; a driver's quote pulled out; who it is about */
  function storyDetail(save, s) {
    if (!s) return h('div.cx-pressempty', {}, icon('camera'), h('b', {}, 'No press yet'), h('p', {}, 'The paddock starts talking after your first race.'));
    const q = /^(.*?)\s*"(.+)" (\S+) told the press\.\s*$/s.exec(s.body), who = s.driver && C.personOf(save, s.driver), key = who && Object.keys(save.world.seats).find((k) => save.world.seats[k] === s.driver), team = key && loreOf(CAR[key].team), pic = C.storyImage(save, s);
    return css(h('div.cx-story', {}, storyPic(save, s, 'big'),
      h('div.cx-storytext', {}, h('span.kick', {}, STORY_KICK[s.kind] ?? 'The paddock', h('i'), storySource(s), h('i'), `Season ${s.season}, week ${s.week}`), h('h2', {}, s.title),
        h('p', {}, q ? q[1] : s.body), q ? h('blockquote', {}, `"${q[2]}"`, h('cite', {}, who?.name ?? q[3])) : null,
        s.posts ? h('div.cx-posts', {}, s.posts.map((x) => h('div.cx-post', {}, h('b', {}, x.h), h('p', {}, x.t), h('small', {}, `${x.l} likes`)))) : null,
        h('div.cx-storyfoot', {}, who ? h('span.cx-storywho', {}, h('i.tbar'), who.name, team ? h('small', {}, team.name) : h('small', {}, 'Free agent')) : null, pic.moved ? h('small.cx-file', {}, 'File photo: taken before the driver changed teams') : null))),
    { '--team': team ? teamMark(team) : 'var(--d-media)' });
  }
  function media(save) {
    const box = save.media ?? []; storyId ??= box[0]?.id ?? null;
    const s = box.find((x) => x.id === storyId) ?? box[0]; if (s) { C.readStory(save, s.id); persist(game); }
    storyBox = h('div.cx-b.cx-frontpage', {}, storyDetail(save, s));
    const n = C.unreadStories(save);
    return [storyBox, h('div.cx-b.cx-feed', {}, blockHead('camera', 'The press', n ? `${n} new` : 'All read'), scroller('cx-tiles', box.map((x) => storyTile(save, x, (e) => getNav().reset(getNav().items().indexOf(e.currentTarget))))))];   // onSel opens it
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
      S.deals.length ? S.deals.map((x) => h('div.cx-spon', {}, brandMark(x.brand), h('div', {}, h('b', {}, rich(`${x.name}: ${money(x.retainer)} a round`)), h('small', {}, rich(x.met ? `Target hit: ${money(x.bonus)} paid` : `${targetText(x.target)}: ${x.progress} of ${x.target.count}. Pays ${money(x.bonus)}`))), h('span.cx-tag', {}, `Goodwill ${x.mood}`))) : h('p.cx-if', {}, 'No personal sponsor yet.'));
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
    const rk = C.rankingOf(save), cuts = [TUNING.open.direct, TUNING.series.gridSize];
    const ranking = h('div.cx-b.k-open', {}, blockHead('trophy', 'Ranking', `Last ${TUNING.ranking.window} days`), h('div.lhead.cx-st.rk', {}, h('span', {}, 'Pos'), h('span'), h('span', {}, 'Driver'), h('span.val', {}, 'Pts')),
      scroller('cx-list', rk.map((x) => css(h(`div.lrow.cx-st.rk${x.you ? '.me' : ''}${cuts.includes(x.rank) ? '.cut' : ''}`, { 'data-nav': '', tabIndex: 0 }, h('b.tnum', {}, x.rank), h('i.tbar'), h('span.c-name', {}, h('b', {}, x.you ? save.player.name : C.personOf(save, x.code)?.name ?? x.code), h('small', {}, teamName(CAR[x.key].team))),
        h('span.val.tnum', {}, String(Math.round(x.pts)))), { '--team': teamMark(loreOf(CAR[x.key].team)) }))),
      h('p.cx-note', {}, icon('info'), `Top ${cuts[0]}: straight to an Open Final. Top ${cuts[1]}: the Masters.`));
    return [table("Drivers'", `${save.season.calendar.length} rounds`, S.drivers, 'Driver', (x) => x.you), ranking, table("Teams'", 'Both cars score', S.teams, 'Team', (x) => x.team === me), h('div.cx-stack', {}, table(tierCup(save), TIERS.tiers[save.season.tier].name, S.cup, 'Team', (x) => x.team === me), you)];
  }

  // ---------------------------------------------------------------------------------------------- Garage
  function garage(save) {
    const car = save.contract.car, hp = factsOf(car).powerHp, tier = TIERS.tiers[TIERS.teams[save.contract.team].tier], free = save.garage.package ?? 0;
    const why = { cap: `${tier.name} seats are capped at level ${tier.cap}`, maxed: 'Fully upgraded', level: (u) => `Needs Career Level ${u.gate}`, coins: (u) => `Needs ${money(u.cost)}` };
    const DOES = { engine: 'More power on the straights', tyres: 'More grip through the corners', brakes: 'Later braking, shorter stops', aero: 'More grip through the fast corners', nitro: 'A bigger tank that refills faster' };
    return [h('div.cx-stack', {}, css(h('div.cx-b.cx-gcar', {}, blockHead(null, `${teamName(save.contract.team)} · ${save.contract.seat} seat`, '#' + (save.player.number)), h('img', { src: still('cars', car), alt: '', decoding: 'async' }), h('strong.cx-title', {}, carName(car)),
        h('div.cx-kv', {}, stat('Power', `${hp} hp`), stat('Upgrade cap', 'Level ' + tier.cap), cs('xp', 'Career Level', String(save.career.cl)), cs('coin', 'Wallet', Math.round(save.wallet.coins).toLocaleString('en')))), { '--team': teamMark(loreOf(save.contract.team)) }), staff(save)),
      h('div.cx-b', {}, blockHead('upgrade', 'Upgrades', free ? `${free} free from the team` : 'Paid from your wallet'),
        CATS.map(([cat, label]) => { const u = C.upgradeInfo(save, cat, hp), r = u.reason;
          return h('div.lrow.cx-up' + (r ? (r === 'maxed' ? '.done' : r === 'coins' ? '.poor' : '.off') : ''), { 'data-nav': '', tabIndex: 0, role: 'button', 'aria-label': `${label} upgrade`, onclick: () => {
            const b = C.buyUpgrade(save, cat, hp); if (!b.ok) return toast(typeof why[b.reason] === 'function' ? why[b.reason](b) : why[b.reason] ?? 'Not available', true);
            persist(game); toast(`${label} level ${b.level}: ${b.free ? 'from the team package' : `−${money(b.cost)}`}`); build(true); } },
            icon(!r ? 'upgrade' : r === 'maxed' ? 'check' : r === 'coins' ? 'coin' : 'lock'), h('span.c-name', {}, h('b', {}, label), h('small', {}, DOES[cat])),
            h('span.ch-pips', {}, [1, 2, 3].map((k) => h('i' + (k <= u.level ? '.on' : k > tier.cap ? '.cap' : '')))),
            h('span.val', {}, r ? h('small', {}, rich(typeof why[r] === 'function' ? why[r](u) : why[r])) : u.free ? h('span.cx-tag.ok', {}, 'Free') : [u.off ? h('s.cx-was', {}, Math.round(u.list).toLocaleString('en')) : null, coins(u.cost)])); }),
        h('p.cx-note', {}, icon('info'), 'Parts stay with the car. Leave it and they are sold back at 60 % of what you paid.'))];
  }

  /** one press on a staff tier, in the Garage or the Shop: the first asks, the second pays (no refund) */
  function pressStaff(save, s) {
    const r = C.staffInfo(save, s.id), on = r.reason === 'hired';
    if (!r.ok) { hiring = null; return toast(on ? `${s.name} is already working for you this season.` : typeof STAFF_WHY[r.reason] === 'function' ? STAFF_WHY[r.reason](s) : STAFF_WHY[r.reason], !on); }
    if (hiring !== s.id) { hiring = s.id; return build(true); }
    hiring = null; C.hireStaff(save, s.id); persist(game); toast(`${s.name} hired for season ${save.clock.season}: −${money(s.cost)}`); build(true);
  }
  /** the personal staff: a crew that cuts repair bills and an engineer that cuts upgrade prices, hired for this season only. The first press on a tier asks, the second pays (no refund) */
  function staff(save) {
    const hireRole = (role) => {
      const R = C.STAFF.roles[role], now = C.staffTier(save, role), share = now[R.key];
      return h('div.cx-staff', {}, h('div.c-name', {}, h('b', {}, R.name), h('small', {}, share ? `${now.name}: ${Math.round(share * 100)} % off ${R.key === 'repairs' ? 'repair bills' : 'upgrade prices'}` : `Basic: ${R.does} with a tier below`)),
        h('div.cx-chips', {}, C.STAFF_LIST.filter((s) => s.role === role).map((s) => {
          const r = C.staffInfo(save, s.id), live = hiring === s.id, on = r.reason === 'hired';
          return h('button.cx-chip' + (on ? '.on' : r.ok ? '' : '.off'), { 'data-nav': '', 'aria-label': `${s.name}, ${money(s.cost)}`, onclick: () => pressStaff(save, s) },
            h('b', {}, s.tier[0].toUpperCase() + s.tier.slice(1)), h('small', {}, live ? 'Hire?' : on ? 'Hired' : r.reason === 'level' ? `Level ${s.cl}` : money(s.cost)), h('small', {}, `−${Math.round(s.share * 100)} %`));
        })));
    };
    return h('div.cx-b', {}, blockHead('people', 'Staff', 'Hired for this season'), ...C.STAFF_ROLES.map(hireRole),
      h('p.cx-note', {}, icon('info'), 'Paid now, not refunded, and they stay with you when you change team.'));
  }

  // ---------------------------------------------------------------------------------------------- Life
  /** one press on a Shop item: the first asks, the second buys */
  function pressShop(save, id) {
    const q = C.lifeInfo(save, id);
    if (!q.ok) { hiring = null; return toast(SHOP_WHY[q.reason]?.(q) ?? 'Not available', true); }
    if (hiring !== id) { hiring = id; return build(true); }
    hiring = null; const r = C.buyLife(save, id), x = r.item; persist(game);
    const msg = x.type === 'ad' ? `${x.name} for ${r.brand ? SPONSORS.brands[r.brand].name : 'a sponsor'}: +${money(r.pay)}` : `${x.name}: mood ${signed(r.boost)}${x.fans ? `, fan support +${x.fans}` : ''}`;
    toast(r.scandal ? `${msg}. The pictures got out: ${r.scandal.sponsor ? `${r.scandal.sponsor} is unhappy` : `team trust −${r.scandal.trust}`}.` : r.skips ? `${msg}. The ${r.skips} is skipped.` : msg, !!r.scandal); build(true);
  }
  /** a card of the Shop: a picture (or its icon, if the picture is not there), what it is, what it does, and what it costs or why it cannot be had */
  function shopCard({ id, ic, name, line, chips, state, tag, own }) {
    return h(`button.cx-shop.${state}${hiring === id ? '.armed' : ''}`, { 'data-nav': '', 'data-shop': id, 'aria-label': `${name}, ${tag}`, onclick: () => (id.startsWith('crew-') || id.startsWith('engineer-') ? pressStaff(game.career, C.STAFF_LIST.find((s) => s.id === id)) : pressShop(game.career, id)) },
      h('span.cs-pic', {}, icon(ic), h('img', { src: `/assets/ui/shop/${id}.webp`, alt: '', loading: 'lazy', decoding: 'async', onerror: (e) => e.currentTarget.remove() })),
      h('span.cs-text', {}, h('b', {}, name, own ? h('em', {}, `Owned ${own}`) : null), h('small', {}, line), h('span.cs-chips', {}, chips.map((c) => h('i', {}, c)))),
      h('span.cs-act', {}, hiring === id ? 'Press again to buy' : tag));
  }
  function life(save) {
    const L = save.life, band = C.moodOf(save), w = C.currentWeek(save), upkeep = C.upkeepOf(save), tier = TIERS.tiers[save.season.tier];
    const meter = css(h('div.cl-meter', {}, LIFE_BANDS.map((b) => h('i.b-' + b.id + (b.id === band.id ? '.on' : ''))), h('em')), { '--p': L.happy / 100 });
    const why = L.why.length ? L.why.map(([label, v]) => h('span', {}, label, h('b.tnum', {}, delta(v, 1)))) : [h('p.cx-note', {}, 'It moves after your first race.')];
    const demand = h('button.btn.btn-secondary.cl-demand', { 'data-nav': '', onclick: () => {
      if (hiring !== 'demand') { hiring = 'demand'; return build(true); }
      hiring = null; const r = C.demandMove(save); persist(game);
      if (!r.ok) return toast(r.reason === 'asked' ? 'You have already asked this season.' : r.reason === 'race' ? 'Ask in a week without a race.' : 'Not now.', true);
      toast('You asked for a transfer: the offers are in your Deals tab until you advance the week.'); go('deals'); } }, icon('contract'), hiring === 'demand' ? 'Press again to ask' : 'Demand a transfer');
    const left = h('div.cx-b.cl-mood', {}, blockHead('energy', 'How life is going', band.name),
      h('div.cl-big', {}, h('b.tnum', {}, String(Math.round(L.happy))), h('span', {}, 'Happiness'), h('small', {}, band.does)), meter,
      h('div.cl-big.fans', {}, h('b.tnum', {}, String(Math.round(L.fans))), h('span', {}, 'Fan support'), h('small', {}, C.fansName(L.fans))), css(h('div.bar4.cl-fans', {}, h('i')), { '--p': L.fans / 100 }),
      h('div.cx-bh', {}, h('span', {}, 'Why it moved'), h('span', {}, 'Last race week')), scroller('cx-list.cl-why', h('div.cr-lines', {}, why)),
      h('p.cx-note', {}, icon('info'), L.sinceOff > 8 ? `${L.sinceOff} weeks without time off: it is wearing you down.` : `${L.sinceOff} ${L.sinceOff === 1 ? 'week' : 'weeks'} since time off.`, upkeep ? ` Upkeep next season: ${money(upkeep)}${save.wallet.coins < upkeep ? ', more than your wallet: something would be sold' : ''}.` : ''),
      band.id === 'unhappy' ? (C.canDemand(save) ? demand : h('p.cx-note', {}, icon('contract'), 'You have already asked to move this season.')) : null);
    const slot = w.activity ? `Booked this week: ${C.itemOf(w.activity.id).name}.` : save.clock.phase === 'paddock' && w.event ? `Week ${w.week} is open: one activity.${w.event.result || w.event.skipped ? '' : ` ${C.eventName(save, w)} is optional.`}` : 'No open week now: luxuries only.';
    const sections = C.TYPES.map((t) => {
      const cards = C.ITEMS.filter((x) => x.type === t.id).sort((a, b) => (a.price ?? a.pay) - (b.price ?? b.pay)).map((x) => {
        const q = C.lifeInfo(save, x.id), n = C.ownedN(save, x.id), chips = [];
        chips.push(x.type === 'ad' ? 'Happiness ' + signed(x.boost) : 'Happiness ' + signed(q.boost));
        if (x.fans) chips.push(`Fans +${x.fans}`); if (x.glow) chips.push(`+${x.glow} a round`); if (x.upkeep) chips.push(`${money(x.upkeep)} a season`);
        if (x.scandal) chips.push(`${Math.round(x.scandal * 100)} % risk of a story`); if (q.skips) chips.push(`Skips the ${q.skips}`); else if (x.skips) chips.push('Takes the week');
        const r = q.reason;
        return shopCard({ id: x.id, ic: SHOP_ICON[x.type], name: x.name, line: x.type === 'ad' && q.brand ? `${SPONSORS.brands[q.brand].name}: ${x.line.toLowerCase()}` : x.line, chips, own: n || null,
          state: !r ? 'ok' : r === 'coins' ? 'poor' : 'off', tag: x.type === 'ad' ? (r ? SHOP_WHY[r](q) : `Pays ${money(q.pay)}`) : r && r !== 'coins' ? SHOP_WHY[r](q) : money(x.price) });
      });
      return [h('div.cl-sec', {}, h('b', {}, t.name), h('small', {}, t.note)), h('div.cl-grid', {}, cards)];
    });
    const staffCards = C.STAFF_LIST.map((s) => {
      const r = C.staffInfo(save, s.id), role = C.STAFF_ROLES.includes(s.role) ? C.STAFF.roles[s.role] : null, on = r.reason === 'hired';
      return shopCard({ id: s.id, ic: SHOP_ICON[s.role], name: s.name, line: role.does[0].toUpperCase() + role.does.slice(1) + '.', chips: [`−${Math.round(s.share * 100)} % ${role.key === 'repairs' ? 'repair bills' : 'upgrade prices'}`, 'This season'],
        state: on ? 'own' : r.ok ? 'ok' : r.reason === 'coins' ? 'poor' : 'off', tag: on ? 'Hired' : r.ok || r.reason === 'coins' ? money(s.cost) : typeof STAFF_WHY[r.reason] === 'function' ? STAFF_WHY[r.reason](s) : STAFF_WHY[r.reason] });
    });
    const shop = h('div.cx-b.cl-shop', {}, blockHead('coin', 'The Shop', money(save.wallet.coins)), h('p.cx-note', {}, icon('info'), slot),
      scroller('cl-scroll', sections, h('div.cl-sec', {}, h('b', {}, 'Staff'), h('small', {}, 'Hired for this season, paid now, no refund. They stay with you when you change team.')), h('div.cl-grid', {}, staffCards)));
    return [left, shop];
  }

  // ---------------------------------------------------------------------------------------------- Driver
  function driver(save) {
    const K = save.career, next = xpForLevel(K.cl + 1), prev = xpForLevel(K.cl), S = save.stats;
    let confirmErase = false;      // here, so any redraw of this page disarms the button along with its label
    const reset = h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => {
      if (!confirmErase) { confirmErase = true; reset.lastChild.textContent = 'Press again: this career is erased'; return; }
      game.career = null; saveCareer(null); game.show('careerStart'); } }, icon('restart'), h('span', {}, 'Erase this career'));
    const slots = h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => { game.career = null; game.show('careerStart'); } }, icon('people'), h('span', {}, 'Other careers'));
    const rivals = C.rivalsOf(save).slice(0, 4);
    return [h('div.cx-b', {}, blockHead('helmet', `${save.player.nation} · #${save.player.number} · ${save.player.code}`), h('strong.cx-title', {}, save.player.name),
        h('div.cx-kv', {}, cs('xp', 'Level', String(K.cl)), cs('xp', 'XP', K.xp.toLocaleString('en'), K.cl < 25 ? `/ ${next.toLocaleString('en')}` : null), cs('rep', 'Reputation', String(Math.round(K.rep)), '/ 1000'), stat('Form', delta(formOf(K.rr)))),
        css(h('div.bar4.ch-xp', {}, h('i')), { '--p': K.cl >= 25 ? 1 : (K.xp - prev) / (next - prev) }),
        h('div.cx-kv', {}, stat('Starts', String(S.starts)), stat('Wins', String(S.wins)), stat('Podiums', String(S.podiums)), stat('Poles', String(S.poles)), stat('Fastest laps', String(S.fastest)), stat('Cups', String(S.cups)), stat('Titles', String(S.titles))),
        h('div.cx-kv', {}, stat('Open wins', String(Object.values(S.openWins ?? {}).reduce((a, b) => a + b, 0))), stat('Triple Crown', `${Object.values(S.openWins ?? {}).filter(Boolean).length} of ${Object.keys(CAL.opens).length}`), stat('Grand Slams', String(S.slams ?? 0)), stat('Masters', String(S.masters ?? 0)), stat('Ranking', 'P' + (C.playerRank(save) ?? '–'))),
        h('div.cx-bh', {}, h('span', {}, 'Recent ratings')), h('div.cx-rr', {}, K.rr.length ? K.rr.map((x) => css(h(`span${x >= 7 ? '.hi' : x < 5 ? '.lo' : ''}`, {}, h('i'), h('b.tnum', {}, x.toFixed(1))), { '--p': (x - 2) / 8 })) : h('p.cx-note', {}, 'No rounds raced yet.'))),
      h('div.cx-stack', {}, h('div.cx-b', {}, blockHead('people', 'Rivals'), rivals.length ? rivals.map((r) => h(`div.lrow.cx-mail.${r.nemesis || r.feud ? 'm-warn' : 'm-team'}`, {}, icon(r.nemesis || r.feud ? 'warning' : 'people'), h('span.c-name', {}, h('b', {}, r.name), h('small', {}, `${CAUSE[r.cause] ?? CAUSE.grid} · ${record(r)}${r.key ? '' : ' · looking for a seat'}`)), h('span.wk', {}, `${r.nemesis ? 'Nemesis' : r.feud ? 'Feud' : 'Rival'} · ${r.heat}`))) : h('p.cx-note', {}, 'Nobody yet. Bang wheels or swap places with someone and it starts.')),
        h('div.cx-b', {}, blockHead('trophy', 'Seasons'), scroller('cx-list', save.history.length ? save.history.map((x) => h('div.lrow.cx-mail.m-trophy', {}, icon('trophy'), h('span.c-name', {}, h('b', {}, `Season ${x.season}: ${teamName(x.team)}`), h('small', {}, `${carName(x.car)}${x.rank ? ` · Ranking P${x.rank}` : ''}${x.opens?.length ? ` · ${x.opens.length} ${x.opens.length === 1 ? 'Open' : 'Opens'}` : ''}`)), h('span.wk', {}, `P${x.drivers} · ${x.avgRR.toFixed(1)}`))) : h('p.cx-note', {}, 'Your first season is under way.')))),
      h('div.cx-stack.rev', {}, h('div.cx-b.k-open', {}, blockHead('trophy', 'Open winners', `Triple Crown ${Object.values(S.openWins ?? {}).filter(Boolean).length} of ${Object.keys(CAL.opens).length}`), scroller('cx-list', (save.hall ?? []).length ? [...save.hall].reverse().map((x) => h(`div.lrow.cx-mail.m-trophy${x.you ? '.me' : ''}`, {}, icon('trophy'), h('span.c-name', {}, h('b', {}, x.name), h('small', {}, `${x.who}${x.you ? ' (you)' : ''}${x.team ? ` · ${teamName(x.team)}` : ''}`)), h('span.wk', {}, `S${x.season}`))) : h('p.cx-note', {}, 'No Open has been won yet. Three are raced every season, and the Masters closes it.'))),
      h('div.cx-b', {}, blockHead('settings', 'This career'), h('div.cx-setrow', {}, row('Race length', seg(RACE_LENGTHS, save.rules.raceLength, (v) => { C.setRaceLength(save, v); persist(game); build(true); }), 'About how long each race takes. Points and XP are the same at every length.')),
        h('p.cx-note', {}, `Rivals: ${save.rules.difficulty === 'easy' ? 'gentle' : save.rules.difficulty === 'hard' ? 'fierce' : 'normal'}.`), h('div.cx-acts.col', {}, slots, reset)))];
  }

  // ---------------------------------------------------------------------------------------------- the frame
  const LAYOUT = { home: 'cx-home', calendar: 'cx-cal', events: 'cx-events', inbox: 'cx-inbox', media: 'cx-media', deals: 'cx-deals', standings: 'cx-standings', garage: 'cx-garage', life: 'cx-life', driver: 'cx-driver' };
  const PAGE = { home, calendar, events, inbox, media, deals, standings, garage, life, driver };
  function drawTabs(save) {
    const count = { inbox: C.unread(save), media: C.unreadStories(save), deals: save.season.mid.length + save.sponsors.offers.length };
    fill(tabs, prompt('Q', 'lb'), TABS.map(([id, label, ic]) => h('button' + (tab === id ? '.on' : ''), { 'data-t': id, tabIndex: -1, role: 'tab', 'aria-selected': String(tab === id), onclick: (e) => { e.stopPropagation(); go(id); } }, icon(ic), label, count[id] ? h('span.badge.tnum', {}, count[id]) : null)), prompt('E', 'rb'));
  }
  function build(keep = false) {
    const save = game.career, cur = keep ? getNav().i : 0, R = C.currentRound(save);
    if (save.clock.phase === 'review') return void game.show('careerStart');
    F.sec(tab); F.title(`Season ${save.clock.season} · Week ${save.clock.week + 1} of ${save.season.weeks.length}`, `${tierCup(save)} · ${worldName(save)}`);
    F.backdrop('tracks', R?.track); statusBar(F.me, save);
    const nodes = [PAGE[tab](save)].flat(Infinity);   // the page before the tabs: opening a message changes the unread count
    drawTabs(save);
    F.page.className = `cx-page ${LAYOUT[tab]}`; fill(F.page, nodes);
    fill(F.foot, prompts(SELECT, CHOOSE), h('div.sp'), tab === 'home' ? homeFoot(save) : h('button.btn.btn-secondary', { 'data-nav': '', onclick: () => go('home') }, icon('home'), 'This week'), h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => api.back() }, icon('back'), 'Menu', prompt('Esc', 'b')));
    F.page.querySelectorAll('.lscroll').forEach(fadeMore);
    const L = getNav().items(), first = L.findIndex((e) => e.classList.contains('cx-go'));
    if (keep) return void getNav().reset(Math.min(cur, L.length - 1));
    const event = tab === 'home' ? L.findIndex((e) => e.classList.contains('next')) : -1;
    const here = L.findIndex((e) => e.classList.contains('now') || e.classList.contains('me') || (storyId && +e.dataset.story === storyId));   // the Calendar and Events open on this week, Standings on your row
    getNav().reset(tab === 'home' ? Math.max(0, event >= 0 ? event : first) : here >= 0 ? here : Math.max(0, L.findIndex((e) => e.closest('.cx-page'))));
  }
  const api = {
    el: F.el, nav: true, grid: true,
    onShow(t) { if (!game.career) return void game.show('careerStart'); if (t) tab = t.story ? 'media' : t; armed = false; calWeek = null; mailId = null; storyId = t?.story ?? null; build(); },
    onKeyTab(d) { go(TABS[(TABS.findIndex(([id]) => id === tab) + d + TABS.length) % TABS.length][0]); },
    /** the Calendar's, the Inbox's and the Media tab's detail panels follow the focus */
    onSel(el) {
      const save = game.career; if (!save || !el) return;
      if (tab === 'calendar' && el.dataset.week !== undefined && calBox) { calWeek = +el.dataset.week; fill(calBox, weekDetail(save, calWeek).flat(Infinity)); calBox.className = `cx-b cx-detail k-${kindOf(save.season.weeks[calWeek])}`; }
      if (tab === 'media' && el.dataset.story !== undefined && storyBox && +el.dataset.story !== storyId) {
        storyId = +el.dataset.story; const m = C.readStory(save, storyId); el.classList.remove('new'); persist(game); fill(storyBox, [storyDetail(save, m)].flat(Infinity)); drawTabs(save);
      }
      if (tab === 'inbox' && el.dataset.mail !== undefined && mailBox && +el.dataset.mail !== mailId) {
        mailId = +el.dataset.mail; const m = C.markRead(save, mailId); el.classList.remove('new'); persist(game); fill(mailBox, [mailDetail(save, m)].flat(Infinity)); drawTabs(save);
      }
    },
    back() { game.leaveCareer(); },
  };
  return api;
}
