// The garage: the car list by team on the left (logo headers, a cutout per row, where you are in the roster), the car and team
// over a scrim at the top of the scene, and a detail panel on the right: icon tabs (Q/E, LB/RB), a body that scrolls and an action
// bar under it, so "Drive this car" is always on screen. Car = how it drives in the game; Specs = the real car's facts (its side
// cutout at true scale against yours, weight, powertrain, power, speed, 0-100, braking), with the upgrades applied; Upgrades = spend
// U-coins on engine / tyres / brakes, 1..3 per car, with the before and after of each; Paint = swatch grids (Nav grids) and the
// custom colour on an HSV strip in the panel.
import TEAMS from '../../../assets/teams/teams.json';
import { carProgression, teamHistory, canSelectCar, playerLevel } from './progression.js';
import { aeroGain } from '../physics/arcade.js';
import { handling } from '../physics/handling.js';   // the game's own (compressed) numbers; the real ones come from carinfo
import { store, fmtTime } from './store.js';
import { CATS, MAX_LEVEL, costOf, classOf } from './economy.js';
import { carName, factsOf, rangeOf, hasSpecs, upgradedFacts, handlingWith, applyUpgrades, physicsHasUpgrades, ROSTER } from './carinfo.js';
import { h, css, fill, seg, slider, toggle, row, getNav, teamMark, teamLogo, TEAM_OF, ENTRY, still, empty, prompt, backButton, fadeMore } from './ui.js';
import { icon } from './icons.js';
import { traitInfo } from './career/rules.js';
import { paintsRims } from '../carkit/model-rims.js';
import { hasModel } from '../cars.js';

const PALETTE = ['#c00a12', '#f2c200', '#ff6a13', '#0e3b2e', '#a6d61b', '#1f5fd6', '#121a3a', '#7d8187', '#f1efe8', '#b9bec4', '#15171a', '#c9b48a', '#0f8f8a', '#5b2a86', '#a8552d'];
const RIMS = ['#a9afb6', '#3b3f45', '#23262b', '#c9a35a', '#8b6944', '#e9e9e6', '#b3121a', '#0f8f8a'];
const CALIPERS = ['#c62922', '#e3a80c', '#d9821c', '#1f5fd6', '#2e9d4b', '#1c1e21', '#9aa0a6', '#6b3fa0'];
const TABS = [['car', 'Car', 'car'], ['specs', 'Specs', 'specs'], ['upgrades', 'Upgrades', 'upgrade'], ['paint', 'Paint', 'paint']];
const POWERTRAIN = { ICE: ['Combustion', 'gear'], hybrid: ['Hybrid', 'energy'], EV: ['Electric', 'bolt'] };
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : null);
const amount = (v) => Math.round(v).toLocaleString('en');
const lerpPct = (v, [a, b], invert) => { const t = (v - a) / (b - a || 1); return 14 + 86 * (invert ? 1 - t : t); };
/** a stat readout: label, tabular value (the em dash when there is none) and its unit */
const readout = (label, v, unit) => h('span.stat-r', {}, h('small', {}, label), h('b.tnum', {}, v ?? empty(), v != null && unit ? h('small', {}, unit) : null));

// ---------------------------------------------------------------------------------------------- colour
const hexOk = (c) => (/^#[0-9a-f]{6}$/i.test(c ?? '') ? c.toLowerCase() : '#808080');
const rgb = (c) => { const n = parseInt(hexOk(c).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const light = (c) => { const [r, g, b] = rgb(c); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150; };   // a light paint takes a dark check
function toHsv(c) {
  const [r, g, b] = rgb(c).map((x) => x / 255), M = Math.max(r, g, b), d = M - Math.min(r, g, b);
  const hue = !d ? 0 : M === r ? ((g - b) / d + 6) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, M ? d / M : 0, M];
}
function toHex(hue, s, v) {
  const f = (n) => { const k = (n + hue / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return '#' + [f(5), f(3), f(1)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
console.assert(toHex(...toHsv('#1f5fd6')) === '#1f5fd6' && toHex(0, 1, 1) === '#ff0000', 'garage: HSV round trip');

export function GarageScreen(game) {
  let key = store.data.car, tab = 'car', custom = false;   // custom: the HSV strip is open under the body swatches
  const N = () => getNav(), all = ROSTER;
  const H = all.map((k) => handling(k)), rng = (f) => { const v = H.map(f); return [Math.min(...v), Math.max(...v)]; };
  const R = { top: rng((x) => x.top), acc: rng((x) => x.power / x.mass), grip: rng((x) => x.grip), df: rng((x) => x.downforce) };
  const pct = (v, [a, b]) => `${18 + 82 * (v - a) / (b - a || 1)}%`;
  const ranges = {}, range = (f) => (ranges[f] ??= rangeOf(f));

  // ---- the frame: header, the title over its scrim, the list, the detail panel (tabs, body, action bar), the footer
  const pos = h('b.tnum'), rows = h('div.lscroll.ga-rows', { onscroll: (e) => fadeMore(e.currentTarget) });
  const list = h('div.pnl.ga-list', {}, h('div.ga-lhead', {}, h('span.kick', {}, 'Cars'), h('span.ga-pos', { 'aria-label': 'Position in the roster' }, pos, h('small', {}, `/ ${all.length}`))), rows);
  const tabs = h('div.stabs.ga-tabs', { 'data-nav': '', 'data-id': 'tabs', tabIndex: 0, role: 'tablist', 'aria-label': 'Garage tabs', onadjust: (e) => api.onKeyTab(e.detail), onclick: () => api.onKeyTab(1) });
  const body = h('div.lscroll.ga-body', { onscroll: (e) => fadeMore(e.currentTarget) }), act = h('div.ga-act');
  const detail = h('div.pnl.ga-detail', {}, tabs, body, act), title = h('div.ga-title'), coins = h('b.tnum');
  const el = h('div.screen.hidden.garage', {}, h('div.gscrim'), h('header.shead', {}, h('i.logo'), h('h1', {}, icon('garage'), 'Garage')), title, list, detail,
    h('div.sfoot', {}, prompt(['arrow-up', 'arrow-down'], 'dpad', 'Car'), prompt(['Q', 'E'], ['lb', 'rb'], 'Tab'),
      h('span.prompt.kb-only', {}, icon('mouse', { cls: 'pi' }), h('span.pl', {}, 'Drag to turn')), h('div.sp'),
      h('span.ga-coins', { 'aria-label': 'U-coins' }, icon('coin'), coins), backButton(() => game.show('menu'))));

  const at = (e) => N().items().indexOf(e);
  const focusCar = () => N().reset(at(rows.querySelector(`[data-key="${key}"]`)));
  const toList = (e) => { if (e.detail < 0) focusCar(); };          // Left on a detail button: back to the list
  const thumb = (k) => still('cars/thumbs', k), side = (k) => still('cars/side', k);

  function buildList() {
    fill(rows, TEAMS.teams.map((t) => h('section.ga-team', {}, css(h('h3.ga-thead', {}, h('i.tbar'), teamLogo(t)), { '--team': teamMark(t) }),
      t.cars.map(({ key: k }) => {
        const p = carProgression(k), mine = k === store.data.car, open = canSelectCar(k, store.data);
        return h('button.lrow.car', { 'data-nav': '', 'data-key': k, onclick: () => select(k), onadjust: (e) => { if (e.detail > 0) N().reset(at(tabs)); } },
          h('img.cut', { src: thumb(k), alt: '', decoding: 'async', width: 320, height: 158 }),
          h('span.ga-name', {}, h('b', {}, carName(k)), h('small', {}, h('span', {}, classOf(factsOf(k).powerHp).label), h('span', {}, `Lv ${p.level}`))),
          mine ? icon('check', { cls: 'ga-mark', label: 'Your car' }) : !open ? icon('lock', { cls: 'ga-mark', label: `Level ${p.level}` }) : h('i.ga-mark'));
      }))));
    fadeMore(rows);
  }

  function select(k) {
    key = k; custom = false; game.previewCar(k);
    rows.querySelectorAll('.car').forEach((b) => { const on = b.dataset.key === k; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    pos.textContent = String(all.indexOf(k) + 1);
    const t = TEAM_OF[k], e = ENTRY[k];
    fill(title, teamLogo(t), h('h2', {}, carName(k)), h('span.ga-drv', {}, icon('helmet'), e.driver.name, h('small', {}, `#${e.number}`)));
    buildDetail(true);
  }

  // ------------------------------------------------------------------------------------------ tabs
  function carTab() {
    const t = TEAM_OF[key], e = ENTRY[key], d = e.driver, x = handling(key), f = factsOf(key), best = store.bestOf(key), p = carProgression(key), th = teamHistory(t.id);
    const bar = (label, v, r, val, unit) => h('div.ga-stat', {}, h('span', {}, label), css(h('i.bar6', {}, h('i')), { '--w': pct(v, r) }), h('b.tnum', {}, val, unit ? h('small', {}, unit) : null));
    const [pt] = POWERTRAIN[f.powertrain] ?? [f.powertrain];
    return [
      h('h3.kick', {}, 'In the game'),
      bar('Top speed', x.top, R.top, Math.round(x.top * 3.6), 'KM/H'), bar('Accel', x.power / x.mass, R.acc, x.t100.toFixed(1), 'S'),
      bar('Grip', x.grip, R.grip, x.grip.toFixed(2), 'G'), bar('Downforce', x.downforce, R.df, x.downforce.toFixed(1)),
      h('div.ga-facts', {}, readout('Power', fmt(f.powerHp), 'HP'), readout('Weight', fmt(f.massKg), 'KG'), readout('Drive', f.drive), readout('Powertrain', pt),
        readout('Class', classOf(f.powerHp).label), readout('Rank', p.rank, p.label), readout('Best lap', best ? fmtTime(best) : null), readout('Required level', String(p.level))),
      h('h3.kick.ga-sec', {}, icon('helmet'), h('span', {}, 'Driver')),
      h('p.ga-who', {}, h('b', {}, d.name), h('small', {}, d.nation), d.age ? h('small', {}, `${d.age} yrs`) : null, h('small', {}, `#${e.number}`)),
      h('p.ga-bio', {}, d.personality ?? d.bio ?? ''),
      traitInfo(d.code) ? h('p.ga-bio', {}, h('b', {}, `Racing style: ${traitInfo(d.code).label}. `), traitInfo(d.code).line) : null,
      h('h3.kick.ga-sec', {}, h('span', {}, 'Team'), h('span.ga-sub', {}, th.status)),
      h('p.ga-who', {}, h('b', {}, t.name), h('small', {}, t.home)), h('p.ga-bio', {}, `“${t.line}”`), h('p.ga-bio', {}, th.story)];
  }

  /** one comparison bar: the car's value on the roster's range, a 2 px tick for your car, a --c-pos tail for what upgrades add */
  function cmp(label, v, up, field, { d = 0, unit = '', invert = false } = {}) {
    const [lo, hi] = range(field), mine = factsOf(store.data.car)[field], has = Number.isFinite(v), x = (n) => lerpPct(n, [lo, hi], invert);
    const better = has && Number.isFinite(up) && (invert ? up < v - 0.0005 : up > v + 0.0005);
    return h('div.ga-stat.ga-cmp', {}, h('span', {}, label, factsOf(key).estimatedFields.includes(field) ? h('small', {}, 'est.') : null),
      h('i.bar6', {}, css(h('i'), { '--w': has ? `${x(v)}%` : '0%' }), better ? css(h('i.up'), { '--l': `${x(v)}%`, '--w': `${Math.max(0, x(up) - x(v))}%` }) : null,
        key !== store.data.car && Number.isFinite(mine) ? css(h('u'), { '--l': `${x(mine)}%` }) : null),
      h('b.tnum', {}, has ? fmt(better ? up : v, d) : empty(), has && unit ? h('small', {}, unit) : null, better ? h('em', {}, `${invert ? '−' : '+'}${Math.abs(up - v).toFixed(d)}`) : null));
  }
  const legend = (mark, text, cls = '') => h('span.lg' + cls, {}, mark, text);

  function specsTab() {
    const f = factsOf(key), cur = store.levels(key), U = upgradedFacts(key, cur, cur), other = store.data.car === key ? null : store.data.car;
    const [pt, ptIcon] = POWERTRAIN[f.powertrain] ?? [f.powertrain, 'gear'], upg = cur.engine + cur.tyres + cur.brakes > 0;
    const eng = [f.engine ?? (f.powertrain === 'EV' ? 'Electric motors' : null), f.torqueNm ? `${fmt(f.torqueNm)} N·m` : null, f.drive].filter(Boolean).join(', ');
    const src = f.sources?.length ? [].concat(f.sources)[0].replace(/^https?:\/\/(www\.)?/, '') : null;
    return [
      h('strong.ga-model' + ((f.model ?? carName(key)).length > 30 ? '.long' : ''), { title: f.model ?? carName(key) }, f.model ?? carName(key)),   // .long: the 36-letter names fit one line whole
      h('p.ga-bio.ga-eng', { title: eng }, h('span.tag', {}, icon(ptIcon), pt), eng || empty()),   // two lines kept free, so the size view never moves between cars
      h('h3.kick.ga-sec', {}, h('span', {}, 'Size'), other ? legend(icon('car'), 'Your car', '.ghost') : null),
      // both cutouts share one scale (make-ui-stills.mjs side: 200 px a metre, the ground on one line), so one height compares them
      h('div.ga-size', {}, other ? h('img.ga-ghost', { src: side(other), alt: '', decoding: 'async' }) : null,
        h('img.ga-side', { src: side(key), alt: `${carName(key)} from the side`, decoding: 'async' }), h('i.ga-ground')),
      h('div.ga-dims', {}, readout('Length', fmt(f.lengthM, 2), 'M'), readout('Width', fmt(f.widthM, 2), 'M'), readout('Height', fmt(f.heightM, 2), 'M'), readout('Wheelbase', fmt(f.wheelbaseM, 2), 'M')),
      h('h3.kick.ga-sec', {}, h('span', {}, 'Real-world figures'), other ? legend(h('i.lg-tick'), 'Your car') : null, upg ? legend(icon('upgrade'), 'Upgraded', '.pos') : null),
      cmp('Weight', f.massKg, f.massKg, 'massKg', { unit: 'KG', invert: true }),
      cmp('Power', f.powerHp, U.powerHp, 'powerHp', { unit: 'HP' }),
      cmp('Top speed', f.topSpeedKmh, U.topSpeedKmh, 'topSpeedKmh', { unit: 'KM/H' }),
      cmp('0–100', f.zeroTo100S, U.zeroTo100S, 'zeroTo100S', { d: 1, unit: 'S', invert: true }),
      cmp('100–0', f.brake100To0M, U.brake100To0M, 'brake100To0M', { d: 1, unit: 'M', invert: true }),
      h('p.ga-note', {}, 'The real car’s numbers. In the game, top speed, 0–100 and braking are compressed so every car can race; the Car tab shows the game’s own values.'),
      h('p.ga-note', {}, !hasSpecs(key) ? 'Estimated from the game’s handling data until real specs are added.' : f.estimatedFields.length ? 'est. = estimated from the maker’s claims and road tests; the rest are published figures.' : 'Published figures.',
        src ? ` Source: ${src}` : '')];
  }

  function upgradesTab() {
    const f = factsOf(key), cur = store.levels(key), cls = classOf(f.powerHp);
    const effects = (cat) => {                                       // the before and after of buying the next level
      const next = { ...cur, [cat]: Math.min(MAX_LEVEL, cur[cat] + 1) }, a = upgradedFacts(key, cur, cur), b = upgradedFacts(key, next, cur);
      const line = (label, x, y, d, unit) => h('span.ga-delta', {}, h('small', {}, label), h('b.tnum', {}, fmt(x, d) ?? empty()), icon('arrow-right'), h('b.tnum.pos', {}, fmt(y, d) ?? empty()), unit ? h('small', {}, unit) : null);
      if (cat === 'engine') return [line('Top speed', a.topSpeedKmh, b.topSpeedKmh, 0, 'KM/H'), line('0–100', a.zeroTo100S, b.zeroTo100S, 2, 'S')];
      if (cat === 'tyres') return [line('Grip', handlingWith(key, cur, cur).grip, handlingWith(key, next, cur).grip, 2, 'G')];
      if (cat === 'aero') { const gain = (lv) => { const x = handlingWith(key, { ...cur, aero: lv }, cur); return (aeroGain(x.downforceStock, x.downforce, x.mass, 55) - 1) * 100; }; return [line('Grip at 200 km/h', gain(cur.aero), gain(next.aero), 1, '%')]; }
      if (cat === 'nitro') { const at = (lv) => handlingWith(key, { ...cur, nitro: lv }, cur); return [line('Tank', at(cur.nitro).nitroTank * 100, at(next.nitro).nitroTank * 100, 0, '%'), line('Refill', at(cur.nitro).nitroRefill * 100, at(next.nitro).nitroRefill * 100, 0, '%')]; }
      return Number.isFinite(a.brake100To0M) ? [line('100–0', a.brake100To0M, b.brake100To0M, 1, 'M')]
        : [h('span.ga-delta', {}, h('small', {}, 'Braking'), h('b.tnum.pos', {}, `+${Math.round((b.gain.brake ?? 1) / (a.gain.brake ?? 1) * 100 - 100)}`), h('small', {}, '%'))];
    };
    return [
      h('p.ga-bio.ga-lead', {}, `${cls.label} class: prices ×${cls.mult}. Each category has three levels; they apply on track and in races, to this car only.`),
      ...CATS.map(([cat, label]) => {
        const lv = cur[cat], maxed = lv >= MAX_LEVEL, cost = maxed ? 0 : costOf(f.powerHp, lv + 1), can = !maxed && store.coins >= cost;
        return h('section.ga-up', {},
          h('div.ga-uphead', {}, h('strong', {}, label), h('span.ga-steps', { role: 'img', 'aria-label': `Level ${lv} of ${MAX_LEVEL}` }, [1, 2, 3].map((s) => icon('chevrons-up', { cls: s <= lv ? 'on' : '' }))),
            h('span.ga-lv.tnum', {}, h('small', {}, 'Level'), `${lv}`, h('small', {}, `/ ${MAX_LEVEL}`))),
          maxed ? h('p.ga-done', {}, icon('check'), 'Fully upgraded') : h('div.ga-eff', {}, effects(cat)),
          maxed ? null : h('div.ga-buy', {}, h('button.btn.btn-secondary' + (can ? '' : '.no'), { 'data-nav': '', 'data-id': 'buy-' + cat, 'aria-disabled': can ? null : 'true', onclick: () => buy(cat), onadjust: toList },
            icon('upgrade'), 'Buy', h('span.ga-cost.tnum', {}, icon('coin'), amount(cost))), can ? null : h('span.ga-need', {}, `Need ${amount(cost - store.coins)} more`)));
      }),
      !physicsHasUpgrades ? h('p.ga-note', {}, 'Effects shown are approximate until the physics upgrade hooks are on.') : null];
  }

  function buy(cat) {
    const r = store.buy(key, cat, factsOf(key).powerHp);
    if (r.ok) { game.upgradesChanged(key); game.audio.play('race/checkpoint.ogg', { gain: 0.6 }); }
    else game.audio.play('crowd/groan.ogg', { bus: 'crowd', gain: 0.25 });
    buildDetail();
  }

  /** a row that keeps Nav focus across a rebuild (buildDetail finds it again by data-id) */
  const idRow = (label, control, note) => { const r = row(label, control, note); r.dataset.id = 'row-' + label; return r; };
  /** a swatch: 32 design px with a line edge (dark paints show), a Nav stop; selected is an ink ring and a check in contrasting ink */
  const swatch = (group, c, cur, f) => { const on = hexOk(c) === hexOk(cur);
    return css(h('button.sw' + (on ? '.on' : '') + (light(c) ? '.lt' : ''), { 'data-nav': '', 'data-id': `${group}-${c}`, role: 'radio', 'aria-checked': String(on), 'aria-label': c, onclick: () => f(c) }, icon('check', { cls: 'sw-check' })), { '--c': c }); };
  const grid = (group, kids) => h('div.swatches', { 'data-grid': '', role: 'radiogroup', 'aria-label': group }, kids);

  /** the custom colour in the panel: hue, saturation and value sliders over their own gradients, live on the car, the hex beside */
  function hsvStrip(c, sw, swGrid) {
    let [hue, s, v] = toHsv(c);
    const hex = h('b.tnum.hsv-hex'), wrap = h('div.hsv');
    const hues = () => `linear-gradient(90deg, ${[0, 60, 120, 180, 240, 300, 360].map((a) => toHex(a, Math.max(s, 0.35), Math.max(v, 0.45))).join(', ')})`;   // at the colour's own S and V: no full-saturation rainbow
    const paint = () => { const x = toHex(hue, s, v); css(wrap, { '--hues': hues(), '--s0': toHex(hue, 0, v), '--s1': toHex(hue, 1, v), '--v1': toHex(hue, s, 1) }); hex.textContent = x.toUpperCase(); return x; };
    const set = () => {   // live: no rebuild, so a drag keeps its thumb; the custom swatch becomes the selected one
      const x = paint(); game.setPaint(key, { ...game.paintOf(key), color: x }); css(sw, { '--c': x });
      swGrid.querySelectorAll('.sw').forEach((b) => { b.classList.toggle('on', b === sw); b.setAttribute('aria-checked', String(b === sw)); }); sw.classList.toggle('lt', light(x));
    };
    paint();
    const sl = (label, cls, val, o, f) => { const r = idRow(label, slider(val, o, (n) => { f(n); set(); })); r.querySelector('.slider').classList.add('hsv-' + cls); return r; };
    fill(wrap, h('div.hsv-head', {}, h('span.kick', {}, 'Custom colour'), hex),
      sl('Hue', 'h', hue, { min: 0, max: 360, step: 1, fmt: Math.round, unit: '°' }, (n) => { hue = n; }),
      sl('Saturation', 's', s, {}, (n) => { s = n; }), sl('Value', 'v', v, {}, (n) => { v = n; }));
    return wrap;
  }

  function paintTab() {
    const t = TEAM_OF[key], P = game.paintOf(key), cur = hexOk(P.color);
    const apply = (patch) => { game.setPaint(key, { ...game.paintOf(key), ...patch }); buildDetail(); };
    const bodies = [t.colors.primary, ...PALETTE.filter((c) => hexOk(c) !== hexOk(t.colors.primary))];
    const isCustom = custom || !bodies.some((c) => hexOk(c) === cur);
    const sw = css(h('button.sw.sw-custom' + (isCustom ? '.on' : '') + (light(cur) ? '.lt' : ''), { 'data-nav': '', 'data-id': 'custom', role: 'radio', 'aria-checked': String(isCustom), 'aria-expanded': String(custom), 'aria-label': 'Custom colour',
      onclick: () => { custom = !custom; buildDetail(); } }, icon('check', { cls: 'sw-check' })), { '--c': cur });
    const bodyGrid = grid('Body colour', [...bodies.map((c) => swatch('body', c, isCustom ? null : cur, (x) => { custom = false; apply({ color: x }); })), sw]);
    return [
      h('h3.kick', {}, 'Body colour'), bodyGrid, custom ? hsvStrip(cur, sw, bodyGrid) : null,
      idRow('Finish', seg([['gloss', 'Gloss'], ['metallic', 'Metallic'], ['pearl', 'Pearl'], ['satin', 'Satin'], ['matte', 'Matte']], P.finish, (v) => apply({ finish: v }))),
      ['metallic', 'pearl'].includes(P.finish) ? idRow('Flake', slider(P.flake, { min: 0, max: 1, step: 0.02 }, (v) => game.setPaint(key, { ...game.paintOf(key), flake: v }))) : null,
      idRow('Team livery', toggle(P.livery, (v) => apply({ livery: v }))),
      ...(paintsRims(key, hasModel(key)) ? [h('h3.kick', {}, 'Wheels'), grid('Wheels', RIMS.map((c) => swatch('rim', c, P.rim, (x) => apply({ rim: x }))))] : []),
      h('h3.kick', {}, 'Calipers'), grid('Calipers', CALIPERS.map((c) => swatch('caliper', c, P.caliper, (x) => apply({ caliper: x })))),
      h('button.btn.btn-ghost.ga-reset', { 'data-nav': '', 'data-id': 'reset', onadjust: toList, onclick: () => { custom = false; game.setPaint(key, null); buildDetail(); } }, icon('restart'), 'Reset to team colours')];
  }

  /** the sticky action bar: Drive this car (the one primary), or the state when there is nothing to do */
  function action() {
    const p = carProgression(key), open = canSelectCar(key, store.data);
    if (store.data.car === key) return h('p.ga-state', {}, icon('check'), 'Your car');
    if (!open) return h('p.ga-state.off', {}, icon('lock'), `Unlocks at level ${p.level}`, h('small', {}, `You are level ${playerLevel(store.data)}`));
    return h('button.btn.btn-primary', { 'data-nav': '', 'data-id': 'act', onadjust: toList,
      onclick: () => { if (!store.selectCar(key)) return; buildList(); select(key); game.audio.play('race/checkpoint.ogg', { gain: 0.6 }); } }, icon('car'), 'Drive this car');
  }

  /** rebuild the tabs, body and action bar; Nav focus inside the panel stays on the same stop (by data-id), else the tab row */
  function buildDetail(fresh = false) {
    const nav = N(), cur = nav?.items()[nav.i], id = cur && detail.contains(cur) ? cur.dataset.id ?? 'tabs' : null, top = body.scrollTop;
    fill(tabs, prompt('Q', 'lb'), TABS.map(([t, label, ic]) => h('button' + (tab === t ? '.on' : ''), { tabIndex: -1, role: 'tab', 'aria-selected': String(tab === t),
      onclick: (e) => { e.stopPropagation(); api.setTab(t); } }, icon(ic), label)), prompt('E', 'rb'));
    fill(body, { car: carTab, specs: specsTab, upgrades: upgradesTab, paint: paintTab }[tab]());
    body.scrollTop = fresh ? 0 : top; fadeMore(body);
    fill(act, action());
    coins.textContent = amount(store.coins);
    if (id && game.screen?.el === el) { const L = nav.items(), k = L.findIndex((e) => e.dataset.id === id); nav.reset(k >= 0 ? k : L.indexOf(tabs)); }
  }

  const api = {
    el, nav: true,
    onShow() { key = store.data.car; tab = 'car'; applyUpgrades((k) => store.levels(k)); buildList(); select(key); focusCar(); },
    onSel(e, byKey) { if (byKey && e?.dataset.key && e.dataset.key !== key) select(e.dataset.key); },   // keyboard / pad browse; the mouse clicks
    navMove(e, d) { if (d < 0 && e === tabs) { focusCar(); return true; } return false; },                // Up from the tabs: the car you are on, not the list's end
    setTab(t) { tab = t; custom = false; buildDetail(true); },
    onKeyTab(d) { api.setTab(TABS[(TABS.findIndex(([id]) => id === tab) + d + TABS.length) % TABS.length][0]); },
    back() { game.show('menu'); },
  };
  return api;
}
