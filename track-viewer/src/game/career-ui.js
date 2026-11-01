// Career Mode's screens (docs/career-mode.md 10.1): careerStart (create the driver, the Open Shootout, the offers, the season review),
// careerHub (Paddock, Calendar, Standings, Garage, Profile) and careerReport (the round report). The rules live in career/career.js;
// these screens call it, store the save (career/save.js) and start sessions through game.careerSession.
import './career.css';
import { h, fill, css, seg, row, prompt, backButton, fadeMore, still, empty, getNav, teamLogo, teamMark, stat } from './ui.js';
import { carName, factsOf } from './carinfo.js';
import { store, WEATHER, fmtTime } from './store.js';
import { CATS } from './economy.js';
import { icon } from './icons.js';
import { TRACKS, trackOf } from '../tracks.js';
import { loadCareer, saveCareer } from './career/save.js';
import * as C from './career/career.js';
import { TUNING, TIERS, CAR, loreOf, rrLabel, objectiveText, xpForLevel, formOf, parLap, seatCar, otherSeat } from './career/rules.js';

const LOOK = { day: ['Day', 'sun'], dusk: ['Dusk', 'sunset'], bluehour: ['Evening', 'moon-horizon'], night: ['Night', 'moon'] };
const WX_ICON = { dry: 'sun', damp: 'cloud-drizzle', rain: 'cloud-rain' };
const NATIONS = ['IND', 'GBR', 'USA', 'JPN', 'ITA', 'UAE', 'BRA', 'GER'];
const NUMBERS = [5, 11, 14, 21, 42, 55, 77, 99];                  // none is a teams.json race number
const coins = (n) => [icon('coin'), Math.round(n).toLocaleString('en')];
const signed = (n, d = 0) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n).toFixed(d);
const screen = (cls, ...kids) => h('div.screen.hidden.' + cls, {}, ...kids);
const header = (title, kick) => h('header.shead', {}, h('i.logo'), title, kick);
const zero = () => ({ engine: 0, tyres: 0, brakes: 0 });
const available = () => Object.fromEntries(Object.values(TRACKS).map((t) => [t.id, t.times ?? null]));
const teamName = (id) => loreOf(id).name;
const driverOf = (key) => CAR[key].driver;
const cond = (r) => [stat('Time of day', [icon(LOOK[r.look][1]), LOOK[r.look][0]]), stat('Weather', [icon(WX_ICON[r.weather]), WEATHER[r.weather].label]), stat('Laps', String(r.laps))];

/** the save in memory (game.career), written through after every change; the free-play level follows the Career Level (5.2) */
function persist(game) {
  saveCareer(game.career);
  if ((store.data.playerLevel ?? 1) < game.career.career.cl) { store.data.playerLevel = game.career.career.cl; store.save(); }
}
/** the player as Session sees a driver (the HUD tower, results rows): his name on his team */
const playerDriver = (save, team) => ({ name: save.player.name, code: save.player.code, nation: save.player.nation, number: save.player.number, team: loreOf(team) });

// ---------------------------------------------------------------------------------------------- careerStart
/** one screen for every step outside the season: create the driver, the Shootout, the first offers, and each season review */
export function CareerStartScreen(game) {
  const title = h('h1'), kick = h('span.kick'), body = h('div.lscroll.cs-body', { onscroll: (e) => fadeMore(e.currentTarget) });
  const el = screen('career-start', h('div.sscrim'), header(title, kick), h('div.sbody', {}, h('div.pnl.cs-panel', {}, body)),
    h('div.sfoot', {}, prompt(['arrow-left', 'arrow-up', 'arrow-down', 'arrow-right'], 'dpad', 'Select'), prompt('Enter', 'a', 'Choose'), h('div.sp'), backButton(() => api.back())));
  let pick = null, form = { name: '', nation: 'IND', number: 99, difficulty: 'normal' };
  const primary = (ic, label, onclick) => h('button.btn.btn-primary.cs-go', { 'data-nav': '', onclick }, icon(ic), label);
  const secondary = (ic, label, onclick) => h('button.btn.btn-secondary', { 'data-nav': '', onclick }, icon(ic), label);

  function create() {
    fill(title, icon('helmet'), 'New career'); fill(kick, 'Step 1 of 3: your driver');
    const name = h('input.cs-input', { type: 'text', maxLength: 24, placeholder: 'Your name', value: form.name, tabIndex: -1, 'aria-label': 'Driver name',
      oninput: (e) => { form.name = e.target.value; }, onkeydown: (e) => { if (!['Enter', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.stopPropagation(); } });   // typing stays in the box: Nav takes only Enter, Esc and Up/Down
    const nameRow = row('Name', name); nameRow.addEventListener('click', () => name.focus());
    return [h('p.cs-lead', {}, 'You are 21, fast, and unknown. Three Rookie teams have a junior seat open. First, who are you?'),
      nameRow,
      row('Nation', seg(NATIONS.map((n) => [n, n]), form.nation, (v) => { form.nation = v; })),
      row('Number', seg(NUMBERS.map((n) => [n, '#' + n]), form.number, (v) => { form.number = v; })),
      row('Rivals', seg([['easy', 'Gentle'], ['normal', 'Normal'], ['hard', 'Fierce']], form.difficulty, (v) => { form.difficulty = v; }), 'How fast the other drivers are. Gentle helps while you learn the circuits.'),
      h('div.cs-acts', {}, primary('play', 'Create driver', () => {
        game.career = C.newCareer({ ...form, name: form.name || 'A. Driver' }); persist(game); build();
      }))];
  }
  function shootout(save) {
    const S = C.shootout(), par = parLap(S.track, S.car, S.weather);
    fill(title, icon('time-trial'), 'Open Shootout'); fill(kick, `Step 2 of 3 · ${save.player.name}`);
    return [h('p.cs-lead', {}, `The three Rookie teams hold one trial for every hopeful: ${S.laps} flying laps of ${trackOf(S.track).name} in a neutral ${carName(S.car)}. Your best valid lap against par sets your grade. Nobody is turned away.`),
      h('div.r-stats', {}, stat('Circuit', trackOf(S.track).name), stat('Car', carName(S.car)), stat('Par lap', fmtTime(par))),
      h('div.cs-grades', {}, [['Standout', 'within 3 % of par', 'bigger signing bonuses, 300 XP'], ['Solid', 'within 6 %', 'the normal offers, 100 XP'], ['Raw', 'slower, or no valid lap', 'offers still come, 10 % less salary']]
        .map(([g, when, what]) => h('div.cs-grade', {}, h('b', {}, g), h('small', {}, when), h('span', {}, what)))),
      h('p.cs-note', {}, icon('info'), 'Leave the track with all four wheels for a second and the lap does not count. One try: there is no restart.'),
      h('div.cs-acts', {}, secondary('close', 'Skip: take Raw', () => { C.finishShootout(save, null); persist(game); build(); }),
        primary('play', 'Drive the Shootout', () => game.careerSession('shootout', { track: S.track, look: S.look, weather: S.weather, laps: 3, car: S.car, home: 'careerStart',
          session: { levels: zero, drivers: { [S.car]: playerDriver(save, CAR[S.car].team) } } }, (d) => { C.finishShootout(save, d.best); persist(game); game.show('careerStart'); })))];
  }
  /** an offer card: the car, team, seat and terms; one is picked, the primary signs it */
  function card(o, save) {
    const t = loreOf(o.team), mate = seatCar(o.team, otherSeat(o.seat)), on = pick === o.id, tier = TIERS.tiers[o.tier];
    return css(h('button.of-card' + (on ? '.on' : ''), { 'data-nav': '', 'aria-pressed': String(on), onclick: () => { pick = o.id; build(true); } },
      h('img.of-car', { src: still('cars', o.car), alt: '', decoding: 'async' }),
      h('span.of-top', {}, teamLogo(t), h('span.kick', {}, `${tier.name} · ${o.seat} seat`)),
      h('strong', {}, carName(o.car)), h('span.of-team', {}, h('i.tbar'), t.name, h('small', {}, '#' + CAR[o.car].number)),
      h('span.of-terms', {}, stat('Salary', coins(o.salary), '/ ROUND'), stat('Signing', o.signing ? coins(o.signing) : empty()), stat('Seasons', String(o.keep ? save.contract.seasonsLeft - 1 : o.seasons))),
      h('span.of-mate', {}, icon('people'), `Teammate: ${driverOf(mate).name} (${carName(mate)}, rated ${save.world.ratings[driverOf(mate).code]})`),
      o.pitch || o.why ? h('span.of-why', {}, o.why ?? o.pitch) : null,
      o.difficulty ? h('span.of-diff', {}, `Difficulty: ${o.difficulty}`) : null,
      on ? icon('check', { cls: 'of-check', label: 'Picked' }) : null), { '--team': teamMark(t) });
  }
  function offers(save) {
    const p = save.pending, first = save.clock.phase === 'offers', list = p.offers;
    if (!list.some((o) => o.id === pick)) pick = list[0].id;
    const chosen = list.find((o) => o.id === pick);
    const sign = primary('check', `Sign with ${teamName(chosen.team)}`, () => {
      C.acceptOffer(save, pick, available()); persist(game);
      if (save.buyback) game.setBusy(`Parts sold back: +${save.buyback.toLocaleString('en')} U`);
      game.show('careerHub');
    });
    if (first) {
      const s = p.shootout; fill(title, icon('helmet'), 'Three offers'); fill(kick, `Step 3 of 3 · ${save.player.name}`);
      return [h('p.cs-lead', {}, s.best ? `Shootout: ${s.grade}. Best lap ${fmtTime(s.best)}, ${signed(s.delta * 100, 1)} % to par.` : 'Shootout: Raw, no valid lap. The teams still want to talk.',
        ' Each team offers its junior seat for two seasons. Your results are judged against the car, so a slow car is not a lost season.'),
      h('div.of-row', {}, list.map((o) => card(o, save))), h('div.cs-acts', {}, sign)];
    }
    const r = p.review, last = save.history.at(-1);
    fill(title, icon('trophy'), `Season ${last.season} review`); fill(kick, `${teamName(last.team)} · ${carName(last.car)}`);
    return [h('div.r-stats', {}, stat("Drivers'", 'P' + r.drivers, '/ ' + (save.season.results[0]?.entries.length ?? 8)), stat("Teams'", 'P' + r.teams, '/ 8'), stat(TIERS.tiers[last.tier].cup, 'P' + r.cup), stat('Avg rating', r.avgRR.toFixed(1)), stat('Duel', `${last.duel.won}-${last.duel.lost}`)),
      r.rep || r.coins ? h('p.cs-note', {}, icon('star'), `Titles this season: ${signed(r.rep)} reputation${r.coins ? `, +${r.coins.toLocaleString('en')} U` : ''}.`) : null,
      h('p.cs-lead', {}, list.length > 1 ? 'The market has spoken. Pick your seat for next season.' : 'One way forward for next season.'),
      h('div.of-row', {}, list.map((o) => card(o, save))), h('div.cs-acts', {}, sign)];
  }
  function build(keep = false) {
    const save = game.career, cur = keep ? getNav().i : 0;
    fill(body, [!save ? create() : save.clock.phase === 'shootout' ? shootout(save) : offers(save)].flat(Infinity));
    const L = getNav().items(); fadeMore(body);
    getNav().reset(keep ? Math.min(cur, L.length - 1) : save?.clock.phase === 'shootout' ? Math.max(0, L.findIndex((e) => e.classList.contains('btn-primary'))) : 0);   // the Shootout starts on Drive, not Skip
  }
  const api = {
    el, nav: true, grid: true,
    /** the Career tile: a season under way goes straight to the Paddock */
    open() { game.career ??= loadCareer(); game.show(game.career && !['shootout', 'offers', 'review'].includes(game.career.clock.phase) ? 'careerHub' : 'careerStart'); },
    onShow() { pick = null; build(); },
    back() { game.leaveCareer(); },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------- careerHub
const TABS = [['paddock', 'Paddock', 'helmet'], ['calendar', 'Calendar', 'track'], ['standings', 'Standings', 'trophy'], ['garage', 'Garage', 'garage'], ['profile', 'Profile', 'people']];
/** the Paddock between rounds: tabs in one panel (Left/Right, Q/E, LB/RB switch them), the next session as the one primary */
export function CareerHubScreen(game) {
  let tab = 'paddock', table = 'drivers', confirmNew = false;
  const kick = h('span.kick.ch-kick'), tabs = h('div.stabs', { 'data-nav': '', tabIndex: 0, role: 'tablist', 'aria-label': 'Career tabs', onadjust: (e) => api.onKeyTab(e.detail), onclick: () => api.onKeyTab(1) });
  const body = h('div.lscroll.ch-body', { onscroll: (e) => fadeMore(e.currentTarget) });
  const el = screen('career-hub', h('div.sscrim'), header(h('h1', {}, icon('helmet'), 'Career'), kick), h('div.sbody', {}, h('div.pnl.ch-panel', {}, tabs, body)),
    h('div.sfoot', {}, prompt(['arrow-up', 'arrow-down'], 'dpad', 'Select'), prompt(['Q', 'E'], ['lb', 'rb'], 'Tabs'), prompt('Enter', 'a', 'Choose'), h('div.sp'), backButton(() => api.back())));

  function paddock(save) {
    if (save.clock.phase === 'review') return [h('div.ch-next', {}, h('p.cs-lead', {}, 'The season is over. The review and next season\'s offers are waiting.'), h('button.btn.btn-primary', { 'data-nav': '', onclick: () => game.show('careerStart') }, icon('trophy'), 'Season review'))];
    const R = C.currentRound(save), cur = save.season.current, q = cur.quali, me = save.contract, mate = C.teammateCar(save), n = save.season.calendar.length;
    const t = trackOf(R.track), race = save.clock.phase === 'race';
    const go = h('button.btn.btn-primary.ch-go', { 'data-nav': '', onclick: () => (race ? startRace(save) : startQuali(save)) }, icon(race ? 'race' : 'time-trial'), race ? 'Start the race' : 'Start qualifying');
    const duel = q?.duel;
    return [
      h('div.ch-round', {}, h('img', { src: still('tracks', t.id), alt: '', decoding: 'async' }),
        h('div.ch-round-text', {}, h('span.kick', {}, `Round ${R.round} of ${n}${R.finale ? ' · points ×1.5' : ''} · ${TIERS.tiers[save.season.tier].name} season ${save.clock.season}`),
          h('strong', {}, R.name), h('span', {}, t.name), h('div.r-stats', {}, cond(R), stat('Expected', 'P' + cur.expPos)))),
      h('h3.kick.ch-h', {}, 'Objectives'),
      cur.objectives.map((o) => h('div.lrow.ch-obj', { 'data-nav': '', tabIndex: 0 }, icon(o.mandatory ? 'star' : 'plus'), h('span', {}, objectiveText(o)), h('small', {}, o.mandatory ? 'Required: trust ±8, 60 XP' : 'Bonus: 40 XP'))),
      h('h3.kick.ch-h', {}, 'Your teammate'),
      h('div.lrow.ch-obj', { 'data-nav': '', tabIndex: 0 }, icon('people'), h('span', {}, `${driverOf(mate).name} · ${carName(mate)} · rated ${save.world.ratings[driverOf(mate).code]}`),
        h('small', {}, duel ? `${duel.result === 'won' ? 'You beat' : duel.result === 'lost' ? 'Beat you by' : 'Level with you'}${duel.margin !== null && duel.result !== 'level' ? ` ${(Math.abs(q.laps[me.car] - q.mate.lap)).toFixed(3)} s` : ''}` : 'Qualifying decides the duel')),
      q ? [h('h3.kick.ch-h', {}, 'Grid'), h('div.ch-grid', {}, q.grid.map((k, i) => css(h('span.ch-slot' + (k === me.car ? '.me' : ''), {}, h('b.tnum', {}, i + 1), h('i.tbar'),
        h('span', {}, k === me.car ? save.player.code : driverOf(k).code), h('small.tnum', {}, q.laps[k] ? fmtTime(q.laps[k]) : 'No time')), { '--team': teamMark(loreOf(CAR[k].team)) })))] : null,
      h('div.ch-next', {}, h('p.cs-note', {}, icon('info'), race ? `${R.laps} laps from P${q.grid.indexOf(me.car) + 1}. One try: Retire classifies you last.` : `Three valid laps, best one counts. ${me.salary} U salary per round.`), go),
    ];
  }
  function calendar(save) {
    const res = save.season.results;
    return [h('div.lhead.ch-cal', {}, h('span', {}, 'Rd'), h('span', {}, 'Round'), h('span', {}, 'Conditions'), h('span.val', {}, 'Laps'), h('span.val', {}, 'Result')),
      save.season.calendar.map((r, i) => { const d = res[i], now = i === save.clock.round && save.clock.phase !== 'review';
        return h('div.lrow.ch-cal' + (now ? '.me' : ''), { 'data-nav': '', tabIndex: 0 }, h('b.tnum', {}, r.round), h('span.c-name', {}, h('b', {}, r.name), h('small', {}, trackOf(r.track).name + (r.finale ? ' · ×1.5' : ''))),
          h('span.ch-cond', {}, icon(LOOK[r.look][1], { label: LOOK[r.look][0] }), icon(WX_ICON[r.weather], { label: WEATHER[r.weather].label })), h('span.val.tnum', {}, r.laps),
          h('span.val', {}, d ? [d.dnf ? 'DNF' : 'P' + d.finish, h('small', {}, d.rr.toFixed(1))] : now ? 'Next' : empty())); })];
  }
  function standings(save) {
    const S = C.standings(save), list = S[table], me = save.contract.team;
    const pick = seg([['drivers', "Drivers'"], ['teams', "Teams'"], ['cup', TIERS.tiers[save.season.tier].cup]], table, (v) => { table = v; build(true); });
    return [row('Table', pick), h('div.lhead.ch-st', {}, h('span', {}, 'Pos'), h('span'), h('span', {}, table === 'drivers' ? 'Driver' : 'Team'), h('span.val', {}, 'Wins'), h('span.val', {}, 'Points')),
      list.length ? list.map((x, i) => css(h('div.lrow.ch-st' + ((table === 'drivers' ? x.you : x.team === me) ? '.me' : ''), { 'data-nav': '', tabIndex: 0 }, h('b.tnum', {}, i + 1), h('i.tbar'),
        h('span.c-name', {}, h('b', {}, table === 'drivers' ? x.name : teamName(x.team)), h('small', {}, table === 'drivers' ? teamName(x.team) : TIERS.tiers[TIERS.teams[x.team].tier].name)),
        h('span.val.tnum', {}, x.wins), h('span.val.tnum', {}, String(Math.round(x.pts * 10) / 10))), { '--team': teamMark(loreOf(x.team)) })) : h('p.cs-note', {}, icon('info'), 'No rounds raced yet.')];
  }
  function garage(save) {
    const car = save.contract.car, hp = factsOf(car).powerHp, tier = TIERS.tiers[TIERS.teams[save.contract.team].tier];
    const why = { cap: `${tier.name} seats are capped at level ${tier.cap}`, maxed: 'Fully upgraded', level: (u) => `Needs Career Level ${u.gate}`, coins: (u) => `Needs ${u.cost.toLocaleString('en')} U` };
    return [h('div.ch-car', {}, h('img', { src: still('cars', car), alt: '', decoding: 'async' }), h('div', {}, h('span.kick', {}, `${teamName(save.contract.team)} · ${save.contract.seat} seat`), h('strong', {}, carName(car)),
        h('div.r-stats', {}, stat('Wallet', coins(save.wallet.coins)), stat('Cap', 'Level ' + tier.cap), stat('Career Level', String(save.career.cl))))),
      CATS.map(([cat, label]) => { const u = C.upgradeInfo(save, cat, hp), r = u.reason;
        return h('div.lrow.ch-up' + (r ? '.off' : ''), { 'data-nav': '', tabIndex: 0, role: 'button', 'aria-label': `${label} upgrade`, onclick: () => {
          const b = C.buyUpgrade(save, cat, hp); if (!b.ok) { game.setBusy(typeof why[b.reason] === 'function' ? why[b.reason](b) : why[b.reason] ?? 'Not available', { kind: 'error' }); return; }
          persist(game); game.setBusy(`${label} level ${b.level}: −${b.cost.toLocaleString('en')} U`); build(true); } },
          icon('upgrade'), h('span.c-name', {}, h('b', {}, label), h('small', {}, `Level ${u.level} of ${tier.cap}`)),
          h('span.ch-pips', {}, [1, 2, 3].map((k) => h('i' + (k <= u.level ? '.on' : k > tier.cap ? '.cap' : '')))),
          h('span.val', {}, r ? h('small', {}, typeof why[r] === 'function' ? why[r](u) : why[r]) : [icon('coin'), u.cost.toLocaleString('en')])); }),
      h('p.cs-note', {}, icon('info'), 'Parts stay with the car. Leave it and they are sold back at 60 % of what you paid.')];
  }
  function profile(save) {
    const K = save.career, me = save.contract, next = xpForLevel(K.cl + 1), prev = xpForLevel(K.cl), S = save.stats, d = me.duel;
    const bar = css(h('div.bar4.ch-xp', {}, h('i')), { '--p': K.cl >= 25 ? 1 : (K.xp - prev) / (next - prev) });
    const reset = h('button.btn.btn-ghost', { 'data-nav': '', onclick: () => {
      if (!confirmNew) { confirmNew = true; reset.lastChild.textContent = 'Press again: this career is replaced'; return; }
      game.career = null; saveCareer(null); confirmNew = false; game.show('careerStart'); } }, icon('restart'), h('span', {}, 'Start a new career'));
    return [h('div.ch-me', {}, h('strong', {}, save.player.name), h('span.kick', {}, `${save.player.nation} · #${save.player.number} · ${save.rules.difficulty === 'easy' ? 'gentle' : save.rules.difficulty === 'hard' ? 'fierce' : 'normal'} rivals`)),
      h('div.r-stats', {}, stat('Career Level', String(K.cl)), stat('XP', K.xp.toLocaleString('en'), K.cl < 25 ? `/ ${next.toLocaleString('en')}` : null), stat('Reputation', String(Math.round(K.rep)), '/ 1000'), stat('Form', signed(formOf(K.rr)))), bar,
      h('div.r-stats', {}, stat('Team', teamName(me.team)), stat('Seat', `${me.seat} · ${carName(me.car)}`), stat('Salary', coins(me.salary), '/ ROUND'), stat('Contract', String(me.seasonsLeft), me.seasonsLeft === 1 ? 'SEASON' : 'SEASONS')),
      h('div.r-stats', {}, stat('Team trust', String(me.trust), '/ 100'), stat('Duel', `${d.won}-${d.lost}`, d.level ? `${d.level} LEVEL` : null), stat('Recent ratings', K.rr.length ? K.rr.map((x) => x.toFixed(1)).join('  ') : empty())),
      h('div.r-stats', {}, stat('Starts', String(S.starts)), stat('Wins', String(S.wins)), stat('Podiums', String(S.podiums)), stat('Poles', String(S.poles)), stat('Cups', String(S.cups))),
      save.history.length ? [h('h3.kick.ch-h', {}, 'Seasons'), save.history.map((x) => h('div.lrow.ch-obj', { 'data-nav': '', tabIndex: 0 }, icon('trophy'),
        h('span', {}, `Season ${x.season}: ${teamName(x.team)}, ${carName(x.car)}`), h('small', {}, `Drivers' P${x.drivers} · Cup P${x.cup} · rating ${x.avgRR.toFixed(1)}`)))] : null,
      h('p.cs-note', {}, icon('info'), `Trust ${TUNING.trust.promote}+ and a won duel earn the A seat. Reputation, form and level bring offers from the tier above.`), reset];
  }

  function startQuali(save) {
    const R = C.currentRound(save), car = save.contract.car, lv = C.raceSetup(save).levels;
    game.careerSession('quali', { track: R.track, look: R.look, weather: R.weather, laps: R.laps, car, home: 'careerHub',
      session: { levels: lv, drivers: { [car]: playerDriver(save, save.contract.team) } } }, (d) => {
      C.finishQuali(save, d.best); persist(game);
      const q = save.season.current.quali, p = q.grid.indexOf(car) + 1;
      game.show('careerHub'); game.setBusy(Number.isFinite(d.best) ? `Qualified P${p}: ${fmtTime(d.best)}. Teammate duel ${q.duel.result}.` : 'No valid lap: you start from the back.');
    });
  }
  function startRace(save) {
    const X = C.raceSetup(save);
    game.careerSession('race', { track: X.track, look: X.look, weather: X.weather, laps: X.laps, car: X.hero, home: 'careerHub',
      session: { racers: X.racers, gridOrder: X.gridOrder, pace: X.pace, levels: X.levels, drivers: { [X.hero]: playerDriver(save, save.contract.team) } } }, (d) => {
      const report = C.finishRace(save, { order: d.order, best: d.bests, dnf: d.dnf, crashes: d.crashes, spins: d.spins, pro: d.pro });
      persist(game); game.show('careerReport', report);
    });
  }
  function build(keep = false) {
    const save = game.career, cur = keep ? getNav().i : 0;
    fill(kick, h('span.hh-item', {}, icon('helmet'), `CL ${save.career.cl}`), h('span.hh-item', {}, coins(save.wallet.coins)));
    fill(tabs, prompt('Q', 'lb'), TABS.map(([id, label, ic]) => h('button' + (tab === id ? '.on' : ''), { tabIndex: -1, role: 'tab', 'aria-selected': String(tab === id),
      onclick: (e) => { e.stopPropagation(); tab = id; confirmNew = false; build(); } }, icon(ic), label)), prompt('E', 'rb'));
    fill(body, [{ paddock, calendar, standings, garage, profile }[tab](save)].flat(Infinity));   // the tabs return nested lists: fill flattens one level
    if (!keep) body.scrollTop = 0; fadeMore(body);
    getNav().reset(keep ? Math.min(cur, getNav().items().length - 1) : tab === 'paddock' ? Math.max(0, getNav().items().findIndex((e) => e.classList.contains('btn-primary'))) : 0);
  }
  const api = {
    el, nav: true,
    onShow(t) { if (!game.career) return void game.show('careerStart'); if (t) tab = t; confirmNew = false; build(); },
    onKeyTab(d) { tab = TABS[(TABS.findIndex(([id]) => id === tab) + d + TABS.length) % TABS.length][0]; confirmNew = false; build(); },
    back() { game.leaveCareer(); },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------- careerReport
/** the round report (6.1): the finish against expectation, the Round Rating and why, objectives, the duel, what it earned, the table */
export function CareerReportScreen(game) {
  const htitle = h('h1'), kick = h('span.kick.r-kick'), side = h('div.r-side'), main = h('div.r-main');
  const next = h('button.btn.btn-primary', { 'data-nav': '', onclick: () => api.back() }, icon('chevron-right'), 'Continue');
  const el = screen('results.career-report', h('div.sscrim'), header(htitle, kick), h('div.sbody.r-body', {}, side, main),
    h('div.sfoot', {}, prompt(['arrow-left', 'arrow-up', 'arrow-down', 'arrow-right'], 'dpad', 'Select'), prompt('Enter', 'a', 'Continue'), h('div.sp'), next));
  const lines = (list, unit = '') => h('div.cr-lines', {}, list.map(([label, v]) => h('span', {}, label, h('b.tnum', {}, (typeof v === 'number' ? signed(v, unit === 'rr' ? 1 : 0) : v)))));
  const api = {
    el, nav: true, grid: true,
    onShow(rep) {
      const save = game.career;
      fill(htitle, icon('race'), `Round ${rep.round}`); fill(kick, icon('track'), `${rep.name} · ${trackOf(rep.track).name}`);
      const verdict = rep.dnf ? 'Retired' : rep.finish === 1 ? 'Victory' : `P${rep.finish}`;
      fill(side, h('div.r-head', {}, h('h2.r-hero', {}, verdict), h('p.r-sub', {}, `Expected P${rep.expPos} · started P${rep.grid}${rep.pole ? ' (pole)' : ''}${rep.fastest ? ' · fastest lap' : ''}`)),
        h('div.r-big', {}, stat('Round rating', rep.rr.toFixed(1)), h('span.r-new', {}, icon('star'), rrLabel(rep.rr))),
        lines([['Base', '6.0'], ...rep.rrLines], 'rr'),
        h('div.cr-objs', {}, rep.objectives.map((o) => h('span' + (o.met ? '.met' : ''), {}, icon(o.met ? 'check' : 'close'), objectiveText(o), o.mandatory ? h('small', {}, 'Required') : null))),
        h('p.cs-note', {}, icon('people'), rep.duel.result === 'level' ? 'Level with your teammate in qualifying.' : `${rep.duel.result === 'won' ? 'You out-qualified' : 'Out-qualified by'} ${driverOf(rep.duel.mateCar).name}: ${fmtTime(rep.duel.mine)} vs ${fmtTime(rep.duel.mate)}.`),
        h('div.r-stats', {}, stat('XP', signed(rep.xp)), stat('Reputation', signed(rep.rep)), stat('Trust', signed(rep.trust)), stat('Earned', coins(rep.coins))),
        rep.levelUp ? h('span.r-new', {}, icon('chevrons-up'), `Career Level ${rep.levelUp}`) : null,
        lines(rep.coinLines.map(([l, v]) => [l, '+' + v.toLocaleString('en')])));
      const fastest = Math.min(...Object.values(rep.best ?? {}).filter(Number.isFinite));
      const rows = h('div.lscroll.r-rows', { onscroll: (e) => fadeMore(e.currentTarget) }, rep.entries.map((e, k) => css(h('div.lrow.cr-cols' + (e.you ? '.me' : ''), { 'data-nav': '', tabIndex: 0 },
        h('b.r-pos.tnum', {}, e.you && rep.dnf ? 'DNF' : k + 1), h('i.tbar'), h('span.c-name', {}, h('b', {}, e.you ? save.player.name : driverOf(e.key).name), h('small', {}, teamName(e.team))),
        h('span.r-carname', {}, carName(e.key)), h('span.val', {}, rep.best?.[e.key] === fastest ? icon('bolt', { cls: 'r-bolt', label: 'Fastest lap' }) : null, Number.isFinite(rep.best?.[e.key]) ? fmtTime(rep.best[e.key]) : empty()),
        h('span.val.tnum', {}, e.pts ? '+' + e.pts : empty())), { '--team': teamMark(loreOf(e.team)) })));
      fill(main, h('div.pnl.r-table', {}, h('div.lhead.cr-cols', {}, h('span', {}, 'Pos'), h('span'), h('span', {}, 'Driver'), h('span', {}, 'Car'), h('span.val', {}, icon('timer'), 'Best lap'), h('span.val', {}, 'Points')), rows));
      fadeMore(rows); getNav().reset(getNav().items().indexOf(next));
    },
    back() { game.show(game.career?.clock.phase === 'review' ? 'careerStart' : 'careerHub'); },
  };
  return api;
}
