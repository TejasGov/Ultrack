// The garage: the car list by team, and a detail panel with four tabs. Car = how it drives in the game; Specs = the real
// car's facts (size silhouette against yours, weight, powertrain, power, speed, 0-100, braking), with the upgrades applied;
// Upgrades = spend U-coins on engine / tyres / brakes, 1..3 per car, with the before -> after of each; Paint = colours.
import TEAMS from '../../../assets/teams/teams.json';
import { carProgression, teamHistory, canSelectCar, playerLevel, testingUnlockAll } from './progression.js';
import { handling } from '../physics/handling.js';   // the game's own (compressed) numbers; the real ones come from carinfo
import { store, fmtTime } from './store.js';
import { CATS, MAX_LEVEL, costOf, classOf } from './economy.js';
import { carName, factsOf, rangeOf, hasSpecs, upgradedFacts, handlingWith, applyUpgrades, physicsHasUpgrades, ROSTER } from './carinfo.js';
import { h, css, fill, seg, slider, toggle, row, getNav, teamMark, teamLogo, TEAM_OF, ENTRY } from './ui.js';

const PALETTE = ['#c00a12', '#f2c200', '#ff6a13', '#0e3b2e', '#a6d61b', '#1f5fd6', '#121a3a', '#7d8187', '#f1efe8', '#b9bec4', '#15171a', '#c9b48a', '#0f8f8a', '#5b2a86', '#a8552d'];
const RIMS = ['#a9afb6', '#3b3f45', '#23262b', '#c9a35a', '#8b6944', '#e9e9e6', '#b3121a', '#0f8f8a'];
const CALIPERS = ['#c62922', '#e3a80c', '#d9821c', '#1f5fd6', '#2e9d4b', '#1c1e21', '#9aa0a6', '#6b3fa0'];
const TABS = [['car', 'Car'], ['specs', 'Specs'], ['upgrades', 'Upgrades'], ['paint', 'Paint']];
const POWERTRAIN = { ICE: 'COMBUSTION', hybrid: 'HYBRID', EV: 'ELECTRIC' };
const n = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const coins = (v) => `U ${Math.round(v).toLocaleString('en')}`;
const lerpPct = (v, [a, b], invert) => { const t = (v - a) / (b - a || 1); return 14 + 86 * (invert ? 1 - t : t); };

// a generic coupe profile in a unit box (x 0..1 nose to tail, y 0..1 roof to ground); scaled to the real length and height
const BODY = 'M0.02,0.80 L0,0.66 C0.01,0.58 0.08,0.55 0.18,0.52 L0.36,0.44 C0.44,0.18 0.52,0.04 0.62,0.04 C0.72,0.05 0.80,0.20 0.88,0.38 L0.97,0.50 C1,0.56 1,0.70 0.98,0.80 Z';
function silhouette(f, mine, ppm) {
  const W = 420, G = 118;                                          // svg width, ground line
  const car = (x, attrs) => {
    if (!f2ok(x)) return '';
    const L = x.lengthM * ppm, H = x.heightM * ppm, r = 0.33 * ppm, ws = x.wheelbaseM ? x.wheelbaseM * ppm : L * 0.58, w0 = (L - ws) / 2 + L * 0.02;
    return `<g ${attrs.g}><path d="${BODY}" transform="translate(0 ${G - H}) scale(${L} ${H})" ${attrs.p} vector-effect="non-scaling-stroke"/>` +
      [w0, w0 + ws].map((cx) => `<circle cx="${cx}" cy="${G - r}" r="${r}" ${attrs.w}/>`).join('') + '</g>';
  };
  return `<svg viewBox="0 0 ${W} ${G + 8}" class="silsvg">` +
    `<line x1="0" x2="${W}" y1="${G}" y2="${G}" stroke="rgba(255,255,255,.18)"/>` +
    (mine ? car(mine, { g: 'transform="translate(8 0)"', p: 'fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.5" stroke-dasharray="5 4"', w: 'fill="none" stroke="rgba(255,255,255,.4)" stroke-width="1.5" stroke-dasharray="3 3"' }) : '') +
    car(f, { g: 'transform="translate(8 0)"', p: 'fill="var(--team)" fill-opacity=".9" stroke="rgba(255,255,255,.85)" stroke-width="1.5"', w: 'fill="#0b0d12" stroke="rgba(255,255,255,.85)" stroke-width="1.5"' }) + '</svg>';
}
const f2ok = (x) => Number.isFinite(x?.lengthM) && Number.isFinite(x?.heightM);

export function GarageScreen(game) {
  let key = store.data.car, tab = 'car', note = '';
  const list = h('div.panel.cars'), detail = h('div.panel.detail'), title = h('div.title');
  const el = h('div.screen.hidden.garage', {}, h('div.scrim', { style: { background: 'linear-gradient(90deg, rgba(4,5,8,0.7), rgba(4,5,8,0) 30%, rgba(4,5,8,0) 62%, rgba(4,5,8,0.75))' } }),
    title, list, detail,
    h('div.footer', {}, h('span', {}, h('b', {}, '↑↓'), 'CAR'), h('span', {}, h('b', {}, 'Q E'), 'TAB'), h('span', {}, h('b', {}, 'DRAG'), 'TURN THE CAR'), h('span', {}, h('b', {}, 'ESC'), 'BACK'), h('div.sp'), h('span.coinbar', {}, 'U-COINS ', h('b', {}, ''))));
  const coinB = el.querySelector('.coinbar b');
  const all = TEAMS.teams.flatMap((t) => t.cars.map((c) => c.key));
  const H = all.map((k) => handling(k)), rng = (f) => { const v = H.map(f); return [Math.min(...v), Math.max(...v)]; };
  const R = { top: rng((x) => x.top), acc: rng((x) => x.power / x.mass), grip: rng((x) => x.grip), df: rng((x) => x.downforce) };
  const pct = (v, [a, b]) => `${18 + 82 * (v - a) / (b - a || 1)}%`;
  const ranges = {};
  const range = (f) => (ranges[f] ??= rangeOf(f));

  function buildList() {
    fill(list, ...TEAMS.teams.flatMap((t) => [
      css(h('h3', {}, teamLogo(t)), { '--team': teamMark(t) }),
      ...t.cars.map((c) => css(h('button.car' + (c.key === key ? '.sel' : ''), {
        'data-nav': '', onclick: () => select(c.key), onmouseenter: (e) => getNav().hover(e.currentTarget), 'data-key': c.key,
      }, h('span', {}, carName(c.key), c.key === store.data.car ? h('span.mine', {}, 'YOURS') : null), h('small', {}, `${carProgression(c.key).rank} · LV ${carProgression(c.key).level} · #${c.number}`)), { '--team': t.colors.secondary })),
    ]));
  }

  function select(k) {
    key = k; note = ''; game.previewCar(k);
    list.querySelectorAll('.car').forEach((b) => b.classList.toggle('sel', b.dataset.key === k));
    const t = TEAM_OF[k];
    fill(title, h('div.team', {},teamLogo(t)), h('div.name', {}, carName(k)));
    buildDetail();
  }

  // ------------------------------------------------------------------------------------------ tabs
  function carTab() {
    const t = TEAM_OF[key], e = ENTRY[key], d = e.driver, x = handling(key), f = factsOf(key), best = store.data.best[key];
    return h('div', {},
      h('div.stat', {}, 'TOP SPEED', css(h('div.bar', {}, h('i')), { '--w': pct(x.top, R.top) }), h('b', {}, `${Math.round(x.top * 3.6)}`)),
      h('div.stat', {}, 'ACCEL', css(h('div.bar', {}, h('i')), { '--w': pct(x.power / x.mass, R.acc) }), h('b', {}, `${x.t100.toFixed(1)}s`)),
      h('div.stat', {}, 'GRIP', css(h('div.bar', {}, h('i')), { '--w': pct(x.grip, R.grip) }), h('b', {}, `${x.grip.toFixed(2)}`)),
      h('div.stat', {}, 'DOWNFORCE', css(h('div.bar', {}, h('i')), { '--w': pct(x.downforce, R.df) }), h('b', {}, `${x.downforce.toFixed(1)}`)),
      h('div.facts', {}, h('div', {}, 'POWER', h('b', {}, `${n(f.powerHp)} HP`)), h('div', {}, 'DRIVE', h('b', {}, f.drive ?? '–')),
        h('div', {}, 'WEIGHT', h('b', {}, `${n(f.massKg)} KG`)), h('div', {}, 'BEST LAP', h('b', {}, best ? fmtTime(best) : '–')),
        h('div', {}, 'POWERTRAIN', h('b', {}, POWERTRAIN[f.powertrain] ?? f.powertrain)), h('div', {}, 'CLASS', h('b', {}, classOf(f.powerHp).label.toUpperCase()))),
      h('div.sec', {}, `DRIVER · #${e.number}`), h('div', { style: { fontSize: '26px' } }, `${d.name} `, h('span', { style: { color: 'var(--ink-3)', fontSize: '18px' } }, `${d.nation}${d.age ? ` · ${d.age}` : ''}`)),
      h('div.bio', {}, d.personality ?? d.bio ?? ''),
      h('div.sec', {}, `TEAM · ${teamHistory(t.id).status.toUpperCase()}`), h('div.bio', { style: { marginTop: '2px' } }, `${t.name}, ${t.home}. “${t.line}”`),
      h('div.bio', {}, teamHistory(t.id).story));
  }

  /** one comparison bar: the car's value, the roster range, a tick for your car, a green tail for what upgrades add */
  function cmp(label, v, up, field, { d = 0, unit = '', invert = false } = {}) {
    const [lo, hi] = range(field), mine = factsOf(store.data.car)[field], has = Number.isFinite(v);
    const better = has && Number.isFinite(up) && (invert ? up < v - 0.0005 : up > v + 0.0005);
    const bar = h('div.cbar', {}, h('i.base', { style: { width: has ? `${lerpPct(v, [lo, hi], invert)}%` : '0%' } }),
      better ? h('i.up', { style: { left: `${lerpPct(v, [lo, hi], invert)}%`, width: `${Math.max(0, lerpPct(up, [lo, hi], invert) - lerpPct(v, [lo, hi], invert))}%` } }) : null,
      key !== store.data.car && Number.isFinite(mine) ? h('u', { style: { left: `${lerpPct(mine, [lo, hi], invert)}%` } }) : null);
    return h('div.cmp', {}, h('span', {}, label, factsOf(key).estimatedFields.includes(field) ? h('sup', {}, ' est.') : null), bar,
      h('b', {}, has ? n(better ? up : v, d) : '–', h('small', {}, unit)), better ? h('em', {}, `${invert ? '−' : '+'}${Math.abs(up - v).toFixed(d)}`) : null);
  }

  function specsTab() {
    const f = factsOf(key), cur = store.levels(key), U = upgradedFacts(key, cur, cur), mine = store.data.car === key ? null : factsOf(store.data.car);
    const ppm = 400 / Math.max(5, ...ROSTER.map((k) => factsOf(k).lengthM || 0));
    const dim = (v, l) => (Number.isFinite(v) ? `${l} ${v.toFixed(2)} m` : null);
    return h('div', {},
      h('div.specname', {}, f.model ?? carName(key), h('span.badge.' + (f.powertrain ?? 'ICE'), {}, POWERTRAIN[f.powertrain] ?? f.powertrain)),
      h('div.engine', {}, f.engine ?? (f.powertrain === 'EV' ? 'Electric motors' : '–'), f.torqueNm ? ` · ${n(f.torqueNm)} N·m` : '', f.drive ? ` · ${f.drive}` : ''),
      h('div.sec', {}, 'SIZE', mine ? h('span.legend', {}, ' ┄ YOUR CAR') : null),
      f2ok(f) ? h('div.sil', { html: silhouette(f, mine, ppm) }) : h('div.bio', {}, 'Size data is not in yet for this car.'),
      h('div.dims', {}, [dim(f.lengthM, 'L'), dim(f.widthM, 'W'), dim(f.heightM, 'H'), dim(f.wheelbaseM, 'WB')].filter(Boolean).join('   ·   ') || null),
      h('div.sec', {}, 'REAL-WORLD FIGURES', cur.engine + cur.tyres + cur.brakes ? h('span.legend.up', {}, ' ▮ UPGRADED') : null),
      cmp('WEIGHT', f.massKg, f.massKg, 'massKg', { unit: ' kg', invert: true }),
      cmp('POWER', f.powerHp, U.powerHp, 'powerHp', { unit: ' hp' }),
      cmp('TOP SPEED', f.topSpeedKmh, U.topSpeedKmh, 'topSpeedKmh', { unit: ' km/h' }),
      cmp('0–100', f.zeroTo100S, U.zeroTo100S, 'zeroTo100S', { d: 1, unit: ' s', invert: true }),
      cmp('100–0', f.brake100To0M, U.brake100To0M, 'brake100To0M', { d: 1, unit: ' m', invert: true }),
      h('div.src', {}, 'The real car’s numbers. In the game, top speed, 0–100 and braking are compressed so every car can race; the Car tab shows the game’s own values.'),
      h('div.src', {}, !hasSpecs(key) ? 'Estimated from the game’s handling data until real specs are added.' : f.estimatedFields.length ? 'est. = estimated from the maker’s claims and road tests; the rest are published figures.' : 'Published figures.',
        f.sources?.length ? ` Source: ${[].concat(f.sources)[0].replace(/^https?:\/\/(www\.)?/, '')}` : ''));
  }

  function upgradesTab() {
    const f = factsOf(key), cur = store.levels(key), cls = classOf(f.powerHp);
    const stat = (cat) => {                                         // the headline before -> after of buying the next level
      const next = { ...cur, [cat]: Math.min(MAX_LEVEL, cur[cat] + 1) }, a = upgradedFacts(key, cur, cur), b = upgradedFacts(key, next, cur);
      if (cat === 'engine') return `TOP ${n(a.topSpeedKmh)} → ${n(b.topSpeedKmh)} km/h   ·   0–100 ${n(a.zeroTo100S, 2)} → ${n(b.zeroTo100S, 2)} s`;
      if (cat === 'tyres') return `GRIP ${handlingWith(key, cur, cur).grip.toFixed(2)} → ${handlingWith(key, next, cur).grip.toFixed(2)}`;
      return Number.isFinite(a.brake100To0M) ? `100–0 ${n(a.brake100To0M, 1)} → ${n(b.brake100To0M, 1)} m` : `BRAKING +${Math.round((b.gain.brake ?? 1) / (a.gain.brake ?? 1) * 100 - 100)}%`;
    };
    return h('div', {},
      h('div.balance', {}, h('span', {}, 'BALANCE'), h('b', {}, coins(store.coins))),
      h('div.bio', { style: { marginTop: '0' } }, `${cls.label} class · prices ×${cls.mult}. Each category has three levels; they apply on track and in races, to this car only.`),
      ...CATS.map(([cat, label]) => {
        const lv = cur[cat], maxed = lv >= MAX_LEVEL, cost = maxed ? 0 : costOf(f.powerHp, lv + 1), can = !maxed && store.coins >= cost;
        return h('div.up', {}, h('div.uphead', {}, h('strong', {}, label), h('span.pips', {}, [1, 2, 3].map((p) => h('i' + (p <= lv ? '.on' : '')))),
          h('button.buy' + (can ? '' : '.no'), { 'data-nav': '', onmouseenter: (ev) => getNav().hover(ev.currentTarget), onclick: () => buy(cat) }, maxed ? 'MAXED' : can ? `BUY · ${coins(cost)}` : `${coins(cost)} · NEED ${Math.round(cost - store.coins).toLocaleString('en')}`)),
          h('div.effect', {}, maxed ? 'Fully upgraded.' : stat(cat)));
      }),
      !physicsHasUpgrades ? h('div.src', {}, 'Effects shown are approximate until the physics upgrade hooks are on.') : null);
  }

  function buy(cat) {
    const r = store.buy(key, cat, factsOf(key).powerHp);
    if (r.ok) { game.upgradesChanged(key); game.audio.play('race/checkpoint.ogg', { gain: 0.6 }); note = ''; }
    else game.audio.play('crowd/groan.ogg', { bus: 'crowd', gain: 0.25 });
    buildDetail();
  }

  function paintTab() {
    const t = TEAM_OF[key];
    const P = game.paintOf(key), apply = (patch) => { const p = { ...P, ...patch }; game.setPaint(key, p); buildDetail(); };
    const sw = (items, cur, f) => h('div.swatches', {}, items.map((c) => css(h('button' + (cur?.toLowerCase() === c.toLowerCase() ? '.on' : ''), { onclick: () => f(c), title: c }), { '--c': c })));
    return h('div', {},
      h('div.sec', {}, 'BODY COLOUR'), sw([t.colors.primary, ...PALETTE], P.color, (c) => apply({ color: c })),
      h('label.picker', {}, 'CUSTOM', h('input', { type: 'color', value: P.color, oninput: (ev) => { const p = { ...game.paintOf(key), color: ev.target.value }; game.setPaint(key, p); }, onchange: () => buildDetail() })),
      row('Finish', seg([['gloss', 'Gloss'], ['metallic', 'Metallic'], ['pearl', 'Pearl'], ['satin', 'Satin'], ['matte', 'Matte']], P.finish, (v) => apply({ finish: v }))),
      ['metallic', 'pearl'].includes(P.finish) ? row('Flake', slider(P.flake, { min: 0, max: 1, step: 0.02 }, (v) => game.setPaint(key, { ...game.paintOf(key), flake: v }))) : null,
      row('Team livery', toggle(P.livery, (v) => apply({ livery: v }))),
      h('div.sec', {}, 'WHEELS'), sw(RIMS, P.rim, (c) => apply({ rim: c })),
      h('div.sec', {}, 'CALIPERS'), sw(CALIPERS, P.caliper, (c) => apply({ caliper: c })),
      h('button.cta.ghost', { 'data-nav': '', style: { marginTop: '14px', fontSize: '18px' }, onmouseenter: (ev) => getNav().hover(ev.currentTarget), onclick: () => { game.setPaint(key, null); buildDetail(); } }, 'Reset to team colours'));
  }

  function buildDetail() {
    const mine = store.data.car === key;
    const p = carProgression(key), available = canSelectCar(key, store.data);
    const tabs = h('div.tabs', {}, ...TABS.map(([id, label]) => h('button' + (tab === id ? '.on' : ''), { onclick: () => { tab = id; buildDetail(); } }, label)));
    const choose = h('button.cta' + (mine ? '.ghost' : ''), { 'data-nav': '', disabled: !available, onmouseenter: (ev) => getNav().hover(ev.currentTarget), onclick: () => { if (!store.selectCar(key)) return; buildList(); buildDetail(); game.audio.play('race/checkpoint.ogg', { gain: 0.6 }); } }, !available ? `Unlocks at level ${p.level}` : mine ? 'Your car' : 'Drive this car');
    coinB.textContent = coins(store.coins);
    detail.style.setProperty('--team', teamMark(TEAM_OF[key]));
    fill(detail, tabs, h('div.progression', {},
      h('strong', {}, `RANK ${p.rank} · ${p.label.toUpperCase()}`),
      h('span', {}, `REQUIRES LEVEL ${p.level} · YOUR LEVEL ${playerLevel(store.data)}`),
      h('small', {}, testingUnlockAll ? 'TEST BUILD · ALL CARS UNLOCKED' : available ? 'AVAILABLE TO DRIVE' : 'LEVEL REQUIRED')),
      { car: carTab, specs: specsTab, upgrades: upgradesTab, paint: paintTab }[tab](), choose);
  }

  return {
    el, nav: true,
    onShow() { key = store.data.car; tab = 'car'; applyUpgrades((k) => store.levels(k)); buildList(); select(key); getNav().reset(all.indexOf(key)); },
    onSel(e, byKey) { if (byKey && e?.dataset.key && e.dataset.key !== key) select(e.dataset.key); },   // keyboard / pad browse; the mouse clicks
    onKeyTab(d) { tab = TABS[(TABS.findIndex(([id]) => id === tab) + d + TABS.length) % TABS.length][0]; buildDetail(); },
    back() { game.show('menu'); },
  };
}
