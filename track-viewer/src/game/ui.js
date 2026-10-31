// The menus: title, main menu, session setup, garage (car picker + paint tuner), settings, pause and results. Plain
// DOM. Every screen works with the mouse, the keyboard (arrows, Enter, Esc) and a gamepad (d-pad, A, B), through Nav.
import TEAMS from '../../../assets/teams/teams.json';
import ENGINE_CREDITS from '../../../assets/audio/recordings/credits.json';
import {teamLogoUrl} from '../team-logos.js';
import { carName, ROSTER } from './carinfo.js';
import { MODES } from './session.js';
import { store, ASSISTS, WEATHER, fmtTime } from './store.js';
import { trackOf, availableTracks, optionalJson, trackUrl } from '../tracks.js';
import { icon } from './icons.js';

export const TEAM_OF = Object.fromEntries(TEAMS.teams.flatMap((t) => t.cars.map((c) => [c.key, t])));
export const ENTRY = Object.fromEntries(TEAMS.teams.flatMap((t) => t.cars.map((c) => [c.key, c])));
export { carName };
export const teamLogo=team=>h('img.team-logo',{src:teamLogoUrl(team),alt:team.name,width:200,height:50,decoding:'async'});
/** a team's colour for marks on dark panels: the primary, or the secondary when the primary is too dark to read */
export function teamMark(t) {
  const c = parseInt(t.colors.primary.slice(1), 16), l = 0.2126 * (c >> 16) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
  return l < 45 ? t.colors.secondary : t.colors.primary;
}
const LOOK_LABEL = { day: 'Day', dusk: 'Dusk', bluehour: 'Evening', night: 'Night' };   // bluehour keeps its id (saves, sky and HDRI tables)

/** h('div.a.b', { onclick, style }, ...children) */
export function h(sel, attrs = {}, ...kids) {   // null / false children are skipped
  const [tag, ...cls] = sel.split('.'), el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);   // the HUD's rows and game.js's camera label; UI screens use css() custom properties
    else if (k in el && k !== 'list') el[k] = v; else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
/** replaceChildren that skips null / false (conditional parts) */
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
export const css = (el, vars) => { for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v); return el; };

// ---------------------------------------------------------------------------------------------- system primitives (docs/ui-system.md)
const root = () => globalThis.document?.documentElement;   // absent in the node tests' fake DOM
/** the last input device: html[data-input=pad] shows pad glyphs in every prompt, anything else keyboard caps (set only on a change) */
export function setInput(kind) { const d = root(); if (d && d.dataset.input !== kind) d.dataset.input = kind; }
/** html[data-motion=reduce] from the in-game setting: ui-tokens.css zeroes every duration and slide under it */
export function syncMotion() { const d = root(); if (d) d.dataset.motion = store.settings.reduceMotion ? 'reduce' : 'full'; }
export const still = (kind, id) => `/assets/ui/stills/${kind}/${id}.webp`;   // tracks/<id>, cars/<key> (make-ui-stills.mjs)
/** the one empty value: an em dash in ink-4, the same on every screen */
export const empty = () => h('span.empty', { 'aria-label': 'None' }, '—');
const cap = (k) => (k.startsWith('arrow-') ? h('kbd', { 'aria-label': k.slice(6) }, icon(k)) : h('kbd', {}, k));   // an arrow cap is its icon, named for screen readers
/** a key hint: keyboard caps (an arrow is its icon) or the pad glyph, whichever device was used last, then the action */
export const prompt = (keys, pad, label) => h('span.prompt', {}, h('span.pk', {}, [keys].flat().map(cap)), pad ? [pad].flat().map((p) => icon('pad-' + p, { cls: 'pp' })) : null, label ? h('span.pl', {}, label) : null);   // pad: one glyph or several (['lb', 'rb'])
/** the footer's Back: a ghost button with its Esc / B prompt, last in the band */
export const backButton = (onclick) => h('button.btn.btn-ghost', { 'data-nav': '', onclick }, icon('back'), 'Back', prompt('Esc', 'b'));
/** the shared header band: the logo, the screen title, an optional kicker on the right */
const header = (title, kick) => h('header.shead', {}, h('i.logo'), h('h1', {}, title), kick ? h('span.kick', {}, kick) : null);
/** a scroller's bottom fade while more is below (on scroll and on rebuild, never per frame) */
export const fadeMore = (el) => el.classList.toggle('more', el.scrollHeight - el.scrollTop - el.clientHeight > 1);

// ---------------------------------------------------------------------------------------------- navigation
/** Keyboard / gamepad focus over a screen's [data-nav] elements: up/down move, left/right adjust, Enter clicks. */
export class Nav {
  constructor(game) {
    this.game = game; this.i = 0; syncMotion();
    // a click or a Tab focus moves Nav focus to that item; hover never does, so the mouse and the keys cannot fight
    addEventListener('pointerdown', (e) => { setInput('key'); this.focusAt(e.target); }, true);
    addEventListener('focusin', (e) => this.focusAt(e.target));
    addEventListener('keydown', (e) => {
      setInput('key');
      if(game.raceLoading?.active)return;
      const s = game.screen;
      if (!s?.nav) { const a = globalThis.document?.activeElement; if (a?.closest?.('#ui .screen')) a.blur(); return; }   // a fading screen's button must not take Space / Enter from the race
      const k = e.code;
      if (k === 'ArrowDown') { this.moveSpatial(0,1); e.preventDefault(); }
      else if (k === 'ArrowUp') { this.moveSpatial(0,-1); e.preventDefault(); }
      else if (k === 'ArrowLeft' || k === 'ArrowRight') { this.lr(k === 'ArrowLeft' ? -1 : 1); e.preventDefault(); }
      else if (k === 'Enter' || k === 'NumpadEnter') { this.items()[this.i]?.click(); e.preventDefault(); }
      else if (k === 'Escape' || k === 'Backspace') { if (!e.repeat) s.back?.(); e.preventDefault(); }   // one step back per press: a held Esc toggled pause and resume
    });
  }
  items() { const s = this.game.screen; return [...((s?.modal ?? s?.el)?.querySelectorAll('[data-nav]') ?? [])].filter((e) => e.offsetParent !== null); }   // an open modal traps focus
  reset(i = 0) { this.i = i; this.mark(); }
  move(d) { const L = this.items(); if (!L.length || this.game.screen?.navMove?.(L[this.i], d)) return; this.i = (this.i + d + L.length) % L.length; this.mark(true); this.game.audio.play('race/count-tick.ogg', { gain: 0.25 }); }
  /** a [data-grid] group inside a list screen (the garage's swatches): the arrows cross it spatially, Left/Right never adjust there */
  group() { return this.game.screen?.grid ? null : this.items()[this.i]?.closest?.('[data-grid]'); }
  lr(d) { if (this.game.screen?.grid || this.group()) this.moveSpatial(d, 0); else this.adjust(d); }
  moveSpatial(dx,dy) {
    const g=this.group();
    if(!this.game.screen?.grid&&!g){this.move(dy||dx);return;}
    const L=this.items(), current=L[this.i];if(!current)return;
    const box=current.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
    let best=-1,score=Infinity;
    L.forEach((e,i)=>{if(i===this.i)return;const b=e.getBoundingClientRect(),xx=b.x+b.width/2-x,yy=b.y+b.height/2-y;
      const ahead=xx*dx+yy*dy,cross=Math.abs(xx*dy-yy*dx);
      if(g&&(!g.contains(e)||(dx&&cross>=ahead)))return;   // inside a group: only its own stops, and Left/Right stay on the row
      if(ahead>1&&ahead+cross*2<score-1){score=ahead+cross*2;best=i;}   // a tie within 1 px keeps the earlier stop: Right from Race is Time Trial, not Career Mode
    });
    if(best>=0){this.i=best;this.mark(true);}
    else if(g&&dy){const G=L.filter((e)=>g.contains(e));this.i=(L.indexOf(dy<0?G[0]:G.at(-1))+dy+L.length)%L.length;this.mark(true);}   // Up/Down off its edge: the stop before or after the group
  }
  adjust(d) { this.items()[this.i]?.dispatchEvent(new CustomEvent('adjust', { detail: d })); }
  mark(byKey = false) {
    const L = this.items(), el = L[this.i], a = globalThis.document?.activeElement;
    L.forEach((e, k) => e.classList.toggle('sel', k === this.i));
    // DOM focus follows Nav (one ring; Tab goes on from it), but only on a screen already shown: focusing a button inside the
    // keydown that opened its screen (Enter on the title) would hand that key's default click to the button
    const shown = this.game.screen?.el.classList.contains?.('on');
    if (shown && el?.tabIndex >= 0) el.focus?.({ preventScroll: true });
    else if (shown && a?.closest?.('#ui') && a !== el) a.blur();
    el?.scrollIntoView?.({ block: 'nearest' });
    this.game.screen?.onSel?.(el, byKey);
  }
  focusAt(t) { const el = t?.closest?.('[data-nav]'), k = el ? this.items().indexOf(el) : -1; if (k >= 0 && k !== this.i) { this.i = k; this.mark(); } }
  /** gamepad: d-pad with key repeat, A = Enter, B = back */
  pad(dt) {
    const p = navigator.getGamepads?.().find((g) => g?.connected); if (!p) return;
    const b = (i) => p.buttons[i]?.pressed, ax = p.axes;
    const dir = b(13) || ax[1] > 0.6 ? 'd' : b(12) || ax[1] < -0.6 ? 'u' : b(14) || ax[0] < -0.6 ? 'l' : b(15) || ax[0] > 0.6 ? 'r' : null;
    if (dir || p.buttons.some((x) => x.pressed)) setInput('pad');            // prompts follow the pad; an attribute write only on a change
    this.rep = dir === this.dir ? this.rep - dt : 0; this.dir = dir;
    if (dir && this.rep <= 0) { this.rep = this.rep === 0 ? 0.38 : 0.12; ({ d: () => this.moveSpatial(0,1), u: () => this.moveSpatial(0,-1), l: () => this.lr(-1), r: () => this.lr(1) })[dir](); }
    const a = b(0), back = b(1), lb = b(4), rb = b(5);
    if (a && !this.a) this.items()[this.i]?.click();
    if (back && !this.b) this.game.screen?.back?.();
    if (lb && !this.lb) this.game.screen?.onKeyTab?.(-1);                     // LB / RB: the tabs, as Q / E (game.js key)
    if (rb && !this.rb) this.game.screen?.onKeyTab?.(1);
    this.a = a; this.b = back; this.lb = lb; this.rb = rb;
  }
}

// controls: the row is the Nav stop (Left/Right steps its control), so the parts inside stay out of the Tab order (tabIndex -1)
/** a segmented control: [[value, label, icon?], ...] as a grid of equal cells; the selected cell is an ink fill (focus is the row's
 *  accent, never the same colour); cls 'cards' lays out picker cards instead of words. Left/Right steps it */
export function seg(choices, value, onchange, cls = '') {
  const wrap = css(h('div.seg' + (cls ? '.' + cls : ''), { role: 'radiogroup' }), { '--n': choices.length });
  const mark = () => [...wrap.children].forEach((b, k) => { const on = choices[k][0] === value; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  const set = (v) => { value = v; mark(); onchange(v); };
  choices.forEach(([v, label, ic]) => wrap.append(h('button', { tabIndex: -1, role: 'radio', onclick: (e) => { e.stopPropagation(); set(v); } }, ic ? icon(ic) : null, label)));
  mark();
  wrap.step = (d) => { const k = choices.findIndex((c) => c[0] === value), n = Math.min(choices.length - 1, Math.max(0, k + d)); if (n !== k) set(choices[n][0]); };
  return wrap;
}
/** a slider: the ink value part on a fill track, a round thumb, and the value with its unit (fmt gives the number, unit the suffix) */
export function slider(value, { min = 0, max = 1, step = 0.01, fmt = (v) => Math.round(v * 100), unit = '%' }, onchange) {
  const num = h('b', {}, fmt(value)), inp = h('input', { type: 'range', min, max, step, value, tabIndex: -1 });
  const paint = () => inp.style.setProperty('--v', `${((inp.value - min) / (max - min)) * 100}%`);
  inp.addEventListener('input', () => { num.textContent = fmt(+inp.value); paint(); onchange(+inp.value); });
  inp.addEventListener('click', (e) => e.stopPropagation());   // a click on the track sets the value; the row's click would step it again
  paint();
  const wrap = h('div.slider', {}, inp, h('output.tnum', {}, num, unit ? h('small', {}, unit) : null));
  wrap.step = (d) => { inp.value = Math.min(max, Math.max(min, +inp.value + d * step * 5)); inp.dispatchEvent(new Event('input')); };
  return wrap;
}
/** a toggle: a round track and the word On or Off beside it, so the state never rests on colour */
export function toggle(on, onchange) {
  const word = h('span.tg-word');
  const paint = () => { t.classList.toggle('on', on); t.setAttribute('aria-checked', String(on)); word.textContent = on ? 'On' : 'Off'; };
  const t = h('button.toggle', { tabIndex: -1, role: 'switch', onclick: (e) => { e.stopPropagation(); on = !on; paint(); onchange(on); } }, h('span.tg-track', {}, h('i')), word);
  paint();
  t.step = () => t.click();
  return t;
}
/** a settings row: a label and a control; the whole row is one nav stop (and one Tab stop) */
/** a note is a sentence and ends with a full stop (store.js ASSISTS notes have none until H9) */
const sentence = (t) => (/[.!?]$/.test(t) ? t : t + '.');
export function row(label, control, note) {
  return h('div.row', { 'data-nav': '', tabIndex: 0, role: 'group', 'aria-label': label, onadjust: (e) => control.step?.(e.detail), onclick: () => control.step?.(1) },
    h('label', {}, label), control, note ? h('div.note', {}, note) : null);
}
let nav = null;
export const getNav = () => nav;

// ---------------------------------------------------------------------------------------------- screens
function screen(cls, ...kids) { return h('div.screen.hidden.' + cls, {}, ...kids); }

/** boot: the circuit's still under a light scrim, the logo, one static prompt, and while loading a stage, a percentage and a 4 px bar */
export function TitleScreen(game) {
  const stage = h('span.kick'), pct = h('span.t-pct.tnum'), bar = h('div.bar4', {}, h('i'));
  const load = h('div.t-load', {}, h('div.t-loadrow', {}, stage, pct), bar);
  const el = screen('title-screen', h('img.t-still', { src: still('tracks', trackOf(store.settings.track).id), alt: '', decoding: 'async' }), h('div.t-scrim'),
    h('i.logo'), h('div.t-status', {}, h('div.t-press', {}, h('span.prompt', {}, 'Press any key')), load));   // no keycap: an Enter cap beside "any key" contradicted it
  const go = () => game.boot();
  el.addEventListener('pointerdown', go);
  // main.js reports 0.15 (garage and cars loading), 0.7 (shaders compiling) and ready() once the frame loop runs
  const progress = (p) => { bar.style.setProperty('--p', p); pct.textContent = `${Math.round(p * 100)} %`; stage.textContent = p < 0.7 ? 'Loading garage' : p < 1 ? 'Preparing cars' : 'Ready'; };
  progress(0);
  return { el, onKey: go, progress, ready: () => { progress(1); load.classList.add('done'); } };
}

/** a circuit's length (m) and corner count from its track.json, fetched once per circuit (null until it answers, or if it cannot) */
const FACTS = {};
const factsOf = (t) => FACTS[t.id] ??= optionalJson(trackUrl(t, 'track')).then((j) => j && { m: j.lapLength, corners: j.corners?.length });
/** a stat readout: label, tabular value, unit (docs/ui-system.md "Stat readout") */
const stat = (label, value, unit) => h('span.stat-r', {}, h('small', {}, label), h('b.tnum', {}, value, unit ? h('small', {}, unit) : null));

/** the bento home: the Race tile on the selected circuit's still, the modes, your car, records, settings and credits. Every tile
 *  is a Nav stop with one look: a kicker, a word, an arrow-up-right go mark; focus is a ring plus a wash that never hides a still. */
export function MenuScreen(game) {
  const go = (id) => () => (MODES[id] ? game.show('setup', id) : id === 'career' ? game.setBusy('Career Mode is coming in a later update.') : game.show(id));
  const tile = (id, ic, word, kicker, desc, cls = '', extra = null, bg = null) => h('button.bento-tile.' + cls, { 'data-nav': '', 'data-id': id, onclick: go(id) }, bg,
    h('span.tile-top', {}, icon(ic, { cls: 'tile-icon' }), icon('arrow-up-right', { cls: 'tile-go' })),
    h('span.tile-text', {}, h('span.tile-kicker', {}, kicker), h('strong', {}, word), desc ? h('span.tile-desc', {}, desc) : null, extra));
  const raceStill = h('img.tile-still', { alt: '', decoding: 'async' }), circuit = h('b'), len = h('b.tnum'), corners = h('b.tnum');
  const facts = h('span.tile-facts', {}, h('span.stat-r', {}, h('small', {}, 'Circuit'), circuit), h('span.stat-r', {}, h('small', {}, 'Length'), len), h('span.stat-r', {}, h('small', {}, 'Corners'), corners));
  const race = tile('race', 'race', 'Race', 'The main event', MODES.race.desc, 'race-tile', facts, raceStill);
  const best = h('span.tile-desc.tile-best');
  const current = h('button.bento-tile.current-car', { 'data-nav': '', 'aria-label': 'Your car: open the garage', onclick: () => game.show('garage') });
  // Career Mode holds the Garage tile's place until it is built (the garage is the Your car tile); a lock, not a go mark, on it
  const career = tile('career', 'helmet', 'Career Mode', 'Coming soon', 'Your season, race by race. In a later update.', 'career-tile');
  career.querySelector('.tile-go').replaceWith(icon('lock', { cls: 'tile-go' }));
  const grid = h('div.bento-grid', {}, race,
    tile('trial', 'time-trial', 'Time Trial', 'Chase your best', MODES.trial.desc, 'trial-tile'),
    tile('drift', 'drift', 'Drift Attack', 'Find the limit', MODES.drift.desc, 'drift-tile'),
    tile('free', 'free-drive', 'Free Drive', 'Your circuit', MODES.free.desc, 'free-tile'),
    career,
    current,
    tile('records', 'trophy', 'Records', 'Personal records', null, 'records-tile', best),
    tile('settings', 'settings', 'Settings', 'Make it yours', 'Picture, driving and sound.', 'settings-tile'),
    tile('credits', 'people', 'Credits', 'The people and the craft', 'Model creators, sources and licenses.', 'credits-tile'));
  const trackName = h('span'), coins = h('b.tnum');
  // .home-heading's first child is the circuit name (scripts/qa-track-switch.mjs reads it)
  const el = screen('home', h('div.sscrim'),
    h('header.shead', {}, h('i.logo'), h('div.home-heading', {}, h('span.hh-item', {}, icon('track'), trackName), h('span.hh-item.hh-coins', { 'aria-label': 'U-coins' }, icon('coin'), coins))),
    h('div.sbody', {}, grid),
    h('div.sfoot', {}, prompt(['arrow-left', 'arrow-up', 'arrow-down', 'arrow-right'], 'dpad', 'Select'), prompt('Enter', 'a', 'Go')));
  let shown = null;   // the circuit on the Race tile: the still and facts change only when it does (no reload flash)
  return {
    el, nav: true, grid: true,
    onShow() {
      const t = trackOf(store.settings.track), mph = store.settings.units === 'mph';
      trackName.textContent = t.name; coins.textContent = store.coins.toLocaleString('en');
      fillCarTile(current, store.data.car);
      const k = store.data.car, b = store.bestOf(k), d = store.driftOf(k);   // this circuit, your car
      fill(best, stat('Best lap', b ? fmtTime(b) : empty()), stat('Best drift', d ? d.toLocaleString('en') : empty(), d ? 'PTS' : null), stat('Car', carName(k)));
      if (shown === t.id + mph) return; shown = t.id + mph;
      raceStill.src = still('tracks', t.id); raceStill.dataset.track = t.id; circuit.textContent = t.name; fill(len, empty()); fill(corners, empty());
      factsOf(t).then((f) => {
        if (!f || shown !== t.id + mph) return;
        fill(len, f.m ? [(f.m / (mph ? 1609.344 : 1000)).toFixed(2), h('small', {}, mph ? 'MI' : 'KM')] : empty()); fill(corners, f.corners ? String(f.corners) : empty());
      });
    },
    // no back(): Esc and pad B do nothing on the menu, the title is boot only
  };
}

/** the menu's "Your car" tile: the cutout on the plain panel (team colour is identity only, never a fill), the name, the team logo and the driver */
function fillCarTile(card, key) {
  const t = TEAM_OF[key], e = ENTRY[key];
  css(card, { '--team': teamMark(t) });
  fill(card, h('img.tile-car', { src: still('cars', key), alt: '', decoding: 'async' }),
    h('span.tile-top', {}, h('span.tile-kicker', {}, 'YOUR CAR'), icon('arrow-up-right', { cls: 'tile-go' })),
    h('span.tile-text', {}, h('strong', {}, carName(key)), teamLogo(t), h('span.tile-drv', {}, icon('helmet'), e.driver.name, h('small', {}, e.driver.nation))));
}

/** records per circuit: circuit cards (the stills) on the left, the roster's best lap and best drift on the right. Viewing a
 *  circuit here never changes the selected one (the saved records are keyed 'circuit/car', store.js). */
export function RecordsScreen(game) {
  let viewed = trackOf(store.settings.track), tracks = [viewed];
  const lap = (t, k) => store.data.best[`${t.id}/${k}`], drift = (t, k) => store.data.drift[`${t.id}/${k}`];
  const cards = h('div.rec-circuits'), rows = h('div.lscroll.rec-rows', { onscroll: (e) => fadeMore(e.currentTarget) });
  const table = h('div.pnl.rec-table', {}, h('div.lhead.rec-cols', {}, h('span.c-car', {}, 'Car'), h('span.val', {}, icon('timer'), 'Best lap'), h('span.val', {}, icon('drift'), 'Best drift')), rows);
  const el = screen('records', h('div.sscrim'), header('Records', 'Saved on this device'), h('div.sbody.rec-body', {}, cards, table),
    h('div.sfoot', {}, prompt(['arrow-up', 'arrow-down'], 'dpad', 'Browse'), prompt('Enter', 'a', 'Show circuit'), h('div.sp'), backButton(() => game.show('menu'))));
  function build() {
    fill(cards, tracks.map((t) => {
      const on = t === viewed, n = ROSTER.filter((k) => lap(t, k) !== undefined).length;
      return h('button.ccard' + (on ? '.on' : ''), { 'data-nav': '', 'aria-pressed': String(on), onclick: () => { viewed = t; build(); nav.mark(); } },
        h('img', { src: still('tracks', t.id), alt: '', decoding: 'async' }),
        h('span.ccard-text', {}, h('span.kick', {}, n ? `${n} ${n === 1 ? 'lap' : 'laps'} set` : 'No laps yet'), h('strong', {}, t.name)),
        on ? icon('check', { cls: 'ccard-check', label: 'Showing' }) : null);
    }));
    fill(rows, ROSTER.map((k) => {
      const team = TEAM_OF[k], b = lap(viewed, k), d = drift(viewed, k);
      return css(h('div.lrow.rec-cols', { 'data-nav': '', tabindex: 0 }, h('i.tbar'), h('img.cut', { src: still('cars/thumbs', k), alt: '', decoding: 'async' }),
        h('span.c-name', {}, h('b', {}, carName(k)), h('small', {}, team.name), k === store.data.car ? icon('check', { label: 'Your car' }) : null),
        h('span.val', {}, b !== undefined ? fmtTime(b) : empty()), h('span.val', {}, d ? [d.toLocaleString('en'), h('small', {}, 'PTS')] : empty())), { '--team': teamMark(team) });
    }));
    fadeMore(rows);
  }
  return {
    el, nav: true, grid: true,
    onShow() {
      viewed = trackOf(store.settings.track); if (!tracks.includes(viewed)) tracks = [viewed];
      build(); nav.reset(tracks.indexOf(viewed));
      // the first probe can resolve after Back: rebuild quietly then, never reset the Nav of the screen now showing
      availableTracks().then((list) => { if (list.length !== tracks.length) { tracks = list; build(); if (game.screen?.el === el) nav.reset(tracks.indexOf(viewed)); } });
    },
    back() { game.show('menu'); },
  };
}

// credits by kind, from the files that own the facts (model.json, the engine recordings' credits.json); fonts and code by hand
const MODEL_CREDITS=Object.values(import.meta.glob('../../../assets/cars/*/model.json',{eager:true,import:'default'})).map(m=>m.source).filter(Boolean).sort((a,b)=>String(a.title).localeCompare(String(b.title)));
const FONT_CREDITS = [
  ['Barlow Condensed', 'The Barlow Project Authors', 'https://github.com/jpt/barlow'],
  ['Anton', 'The Anton Project Authors', 'https://github.com/googlefonts/AntonFont'],
];
const CODE_CREDITS = [
  ['three.js', 'three.js authors', 'https://threejs.org', 'MIT', 'https://github.com/mrdoob/three.js/blob/dev/LICENSE'],
  ['Rapier physics', 'Dimforge', 'https://rapier.rs', 'Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0'],
];
export function CreditsScreen(game) {
  const link = (label, url) => /^https?:\/\//.test(url ?? '') ? h('a.ink-link', { 'data-nav': '', href: url, target: '_blank', rel: 'noopener noreferrer' }, label, icon('arrow-up-right')) : h('span', {}, label);
  const links = (...l) => h('p.cr-links', {}, l);
  const item = (title, ...lines) => h('article.cr-item', {}, h('h3', {}, title), lines);
  // model.json's additionalCredits mixes provenance notes (they stay in the file, docs/ui-system.md risks) with a co-author: the player sees only the name.
  // shortcut: reads the "credits <name>" phrase the notes use, upgrade to a credit field in model.json when one exists
  const note = (text) => { const by = /\bcredits\s+(.+?)(?:\.\s|;|\.?$)/i.exec(text ?? '')?.[1]?.trim(); return by ? h('p.cr-note', {}, 'Also credited: ', by) : null; };
  // one spelling and a link for every model licence: model.json writes "CC Attribution", "CC-BY 4.0 (url)" and "CC-BY-NC (...)"; the notes after the name are provenance.
  // Sketchfab's Creative Commons licences are 4.0, so a name with no version is 4.0
  const licence = (text) => {
    const head = /^[^;(]*/.exec(text ?? '')[0], code = /-NC-SA\b/.test(head) ? 'BY-NC-SA' : /-NC\b/.test(head) ? 'BY-NC' : /^CC[ -](BY|Attribution)/i.test(head) ? 'BY' : null, ver = /\d\.\d/.exec(head)?.[0] ?? '4.0';
    return code ? link(`CC ${code} ${ver}`, `https://creativecommons.org/licenses/${code.toLowerCase()}/${ver}/`) : h('span', {}, text);
  };
  const group = (name, items, intro) => h('section.cr-group', {}, h('h2.kick', {}, name), intro ? h('p.cr-intro', {}, intro) : null, h('div.cr-grid', {}, items));
  const scroll = h('div.lscroll.cr-scroll', { onscroll: (e) => fadeMore(e.currentTarget) },
    group('Cars', [...MODEL_CREDITS.map((c) => item(c.title, h('p', {}, 'Created by ', link(c.author, c.authorUrl ?? c.url)), links(link('Original model', c.url), licence(c.license)), note(c.additionalCredits))),
      item('Additional Lamborghini exterior credit', links(link('Lambo_SC04', 'https://sketchfab.com/Lambo_SC04'), licence('CC BY-NC')), h('p', {}, 'Aventador SVJ Black-Ghost. Interior and combined model: blackcube4.'))],
    'Every car is adapted for Ultrack: scale, orientation, wheel separation, materials and runtime LODs.'),
    group('Audio', [...ENGINE_CREDITS.map((c) => item(c.name + ' recording', links(link(c.title, c.url)), h('p', {}, 'Recorded by ', c.author), links(link(c.license, c.licenseUrl)), h('p.cr-dim', {}, c.changes))),
      item('Voices and effects', h('p', {}, 'Commentary voices and crash effects: ElevenLabs.'), h('p', {}, 'EV motor, wind and tyre layers: procedural Web Audio.'))]),
    group('Artwork', [item('Environment HDRIs', h('p', {}, 'Poly Haven (CC0).')),
      item('Sponsor & marque artwork', h('p', {}, 'Simple Icons; Pirelli official artwork; Rolex wordmark via Wikimedia Commons; car-logos-dataset. Original marks remain with their owners.'))]),
    group('Fonts', FONT_CREDITS.map(([name, by, url]) => item(name, h('p', {}, by), links(link('Source', url), link('SIL Open Font License 1.1', 'https://openfontlicense.org'))))),
    group('Code', CODE_CREDITS.map(([name, by, url, lic, licUrl]) => item(name, h('p', {}, by), links(link('Project', url), link(lic, licUrl))))),
    h('p.cr-notice', {}, icon('info'), h('span', {}, 'Every model is shown with its creator and licence. Car names and marks belong to their owners.')));
  const el = screen('credits', h('div.sscrim'), header('Credits', 'The people behind the machines'), h('div.sbody', {}, h('div.pnl.cr-panel', {}, scroll)),
    h('div.sfoot', {}, prompt(['arrow-up', 'arrow-down'], 'dpad', 'Browse'), prompt('Enter', 'a', 'Open link'), h('div.sp'), backButton(() => game.show('menu'))));
  return { el, nav: true, onShow() { fadeMore(scroll); }, back() { game.show('menu'); } };
}

const MODE_ICON = { race: 'race', trial: 'time-trial', drift: 'drift', free: 'free-drive' };
const LOOK_ICON = { day: 'sun', dusk: 'sunset', bluehour: 'moon-horizon', night: 'moon' }, WEATHER_ICON = { dry: 'sun', damp: 'cloud-drizzle', rain: 'cloud-rain' };
const looks = () => Object.entries(LOOK_LABEL).map(([k, l]) => [k, l, LOOK_ICON[k]]);
const weathers = () => Object.entries(WEATHER).map(([k, w]) => [k, w.label, WEATHER_ICON[k]]);
const lapChoices = [[1, '1'], [3, '3'], [5, '5'], [10, '10']];
/** a circuit picker card: the still, the name, and its length and corners from track.json (an em dash until they arrive) */
function circuitCard(t) {
  const facts = h('span.cc-facts', {}, empty()), mph = store.settings.units === 'mph';
  factsOf(t).then((f) => { if (f) fill(facts, f.m ? h('span', {}, h('b.tnum', {}, (f.m / (mph ? 1609.344 : 1000)).toFixed(2)), h('small', {}, mph ? 'MI' : 'KM')) : null, f.corners ? h('span', {}, h('b.tnum', {}, f.corners), h('small', {}, 'Corners')) : null); });
  return [h('img', { src: still('tracks', t.id), alt: '', decoding: 'async', 'data-track': t.id }), h('span.cc-text', {}, h('strong', {}, t.name), facts), icon('check', { cls: 'cc-check', label: 'Selected' })];
}

/** a mode's setup: one panel anchored top-left (the car stays clear in the scene), circuit cards, then laps, time of day, weather
 *  and assists as segments, and Start (the one primary) at the bottom; the panel body scrolls when the window is short */
export function SetupScreen(game) {
  let mode = 'race', tracks = [], touched = false;   // tracks: the circuits whose files exist; the row shows only with a choice
  const htitle = h('h1'), sub = h('p.psub'), rows = h('div.lscroll.prows', { onscroll: (e) => fadeMore(e.currentTarget) });
  const start = h('button.cta.btn.btn-primary', { 'data-nav': '', onclick: () => game.startSession(mode) }, icon('play'), 'Start');
  const el = screen('setup-screen', h('div.dscrim'), h('header.shead', {}, h('i.logo'), htitle),
    h('div.panel.setup.pnl', {}, sub, rows, start),
    h('div.sfoot', {}, prompt(['arrow-up', 'arrow-down'], 'dpad', 'Select'), prompt(['arrow-left', 'arrow-right'], 'ls', 'Change'), h('div.sp'), backButton(() => game.show('menu'))));
  /** rebuild the rows and keep focus on the same stop (a row by its label; Start and Back are the same elements) */
  function rebuild() {
    const cur = nav.items()[nav.i], was = cur?.getAttribute('aria-label'); build();
    const L = nav.items(), k = L.indexOf(cur); nav.reset(Math.max(0, k >= 0 ? k : L.findIndex((e) => e.getAttribute('aria-label') === was)));
  }
  function build() {
    const M = MODES[mode], S = store.settings, note = h('span', {}, sentence(ASSISTS[S.assists].note));
    fill(htitle, icon(MODE_ICON[mode]), M.label); sub.textContent = M.desc;
    fill(rows,
      tracks.length > 1 ? row('Circuit', seg(tracks.map((t) => [t.id, circuitCard(t)]), trackOf(S.track).id, (v) => { game.selectTrack(v).then(() => { if (game.screen?.el === el) rebuild(); }); }, 'cards')) : null,
      M.laps ? row('Laps', seg(lapChoices, S.laps, (v) => store.set('laps', v))) : null,
      row('Time of day', seg(looks(), S.look, (v) => { store.set('look', v); game.applySettings(); })),
      row('Weather', seg(weathers(), S.weather, (v) => { store.set('weather', v); game.applySettings(); })),
      row('Assists', seg(Object.entries(ASSISTS).map(([k, a]) => [k, a.label]), S.assists, (v) => { store.set('assists', v); note.textContent = sentence(ASSISTS[v].note); }), note),
    );
    fadeMore(rows);
  }
  // any key move, step or click before the circuit row lands keeps focus where the player put it
  el.addEventListener('adjust', () => { touched = true; }, true); el.addEventListener('pointerdown', () => { touched = true; });
  return {
    el, nav: true,
    onShow(m) {
      mode = m ?? mode; touched = false; build();
      nav.reset(0);
      // the circuit row lands once the probe answers (at once after the first): focus then starts on it, the first row
      availableTracks().then((list) => {
        if (list.length === tracks.length) return;
        tracks = list; if (game.screen?.el !== el) return;
        if (touched) rebuild(); else { build(); nav.reset(0); }
      });
    },
    onSel(_, byKey) { touched ||= byKey; },
    back() { game.show('menu'); },
  };
}

export { GarageScreen } from './garage.js';   // the garage, its stats, specs and upgrades

// ---------------------------------------------------------------------------------------------- settings
const TABS = [['display', 'Picture', 'picture'], ['driving', 'Driving', 'steering'], ['audio', 'Sound', 'volume'], ['controls', 'Controls', 'gamepad']];
// the controls table: action, an optional detail, keyboard caps (arrow-* draw as icons), pad glyphs (pad-<id>); [] is "not bound"
const CONTROLS = [
  ['Accelerate', 'Brakes while reversing', ['W', 'arrow-up'], [['rt', 'RT']]], ['Brake', 'Reverses once stopped', ['S', 'arrow-down'], [['lt', 'LT']]],
  ['Steer', null, ['A', 'D', 'arrow-left', 'arrow-right'], [['ls', 'Left stick']]], ['Handbrake', 'Starts a drift', ['Space'], [['a', 'A']]],
  ['Nitro', null, ['Shift'], [['x', 'X']]], ['Reset to track', null, ['R'], [['y', 'Y']]], ['Camera', null, ['C'], [['rb', 'RB']]],
  ['Map overview', null, ['M'], []], ['Pause', null, ['Esc'], [['menu', 'Menu']]],
];
/** settings: Picture, Driving, Sound and Controls in one panel anchored to the top, so a tab switch never moves it; the tab row is
 *  a Nav stop (Left/Right, Q/E, LB/RB switch tabs), every row below one more. From pause, a full scrim covers the race */
export function SettingsScreen(game) {
  let tab = 'display', from = 'menu';
  const tabs = h('div.stabs', { 'data-nav': '', tabIndex: 0, role: 'tablist', 'aria-label': 'Settings tabs', onadjust: (e) => api.onKeyTab(e.detail), onclick: () => api.onKeyTab(1) });
  const body = h('div.lscroll.set-body', { onscroll: (e) => fadeMore(e.currentTarget) });
  // the Controls tip sits under the table, outside the scroller, so the panel never cuts it
  const tip = h('p.set-tip', {}, icon('info'), h('span', {}, 'Drift: pull the handbrake while turning at speed, then steer to hold the angle. The normal brake keeps cornering grip. Drifting refills nitro fastest.'));
  const el = screen('settings-screen', h('div.dscrim'), header('Settings', 'Saved on this device'), h('div.panel.settings.pnl', {}, tabs, body),
    h('div.sfoot', {}, prompt(['arrow-up', 'arrow-down'], 'dpad', 'Select'), prompt(['arrow-left', 'arrow-right'], 'ls', 'Change'), h('div.sp'), backButton(() => api.back())));
  const set = (k) => (v) => { store.set(k, v); game.applySettings(); };
  const group = (name) => h('h3.kick.set-group', {}, name);
  function build() {
    const S = store.settings;
    fill(tabs, prompt('Q', 'lb'), TABS.map(([id, label, ic]) => h('button' + (tab === id ? '.on' : ''), { tabIndex: -1, role: 'tab', 'aria-selected': String(tab === id),
      onclick: (e) => { e.stopPropagation(); tab = id; build(); nav.reset(0); } }, icon(ic), label)), prompt('E', 'rb'));
    const R = {
      display: () => [
        row('Quality', seg([['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], S.quality, set('quality')), `Auto picked ${game.ctx.device.tier} for this computer.`),
        row('Time of day', seg(looks(), S.look, set('look'))),
        row('Weather', seg(weathers(), S.weather, set('weather'))),
        row('Motion blur', seg([['off', 'Off'], ['light', 'Light'], ['full', 'Full']], S.motionBlur, set('motionBlur'))),
        row('Reduce motion', toggle(S.reduceMotion, (v) => { set('reduceMotion')(v); syncMotion(); }), 'Less camera shake, roll and speed zoom.'),
        row('Field of view', slider(S.fovOffset, { min: -10, max: 15, step: 1, fmt: (v) => (v < 0 ? `−${-v}` : `+${v}`), unit: '°' }   /* an offset: +0° is the default, never a bare 0° */, set('fovOffset'))),
        group('Developer'),
        row('Show FPS', toggle(S.showFps, set('showFps'))),
      ],
      driving: () => { const note = h('span', {}, sentence(ASSISTS[S.assists].note)); return [
        row('Assists', seg(Object.entries(ASSISTS).map(([k, a]) => [k, a.label]), S.assists, (v) => { set('assists')(v); note.textContent = sentence(ASSISTS[v].note); }), note),
        row('Speed in', seg([['kmh', 'km/h'], ['mph', 'mph']], S.units, set('units'))),
        row('Race laps', seg(lapChoices, S.laps, set('laps'))),
      ]; },
      audio: () => [
        row('Master', slider(S.master, {}, set('master'))),
        row('Engine', slider(S.engine, {}, set('engine'))),
        row('Effects', slider(S.effects, {}, set('effects'))),
        row('Commentary', slider(S.commentary, {}, set('commentary'))),
        row('Commentators', toggle(S.commentaryOn, set('commentaryOn')), 'Enzo Moretti, Alastair Finch and Kavya Iyer'),
        row('Crowd', slider(S.crowd, {}, set('crowd'))),
      ],
      controls: () => [
        h('div.lhead.ctl-cols', {}, h('span', {}, 'Action'), h('span', {}, icon('keyboard'), 'Keyboard'), h('span', {}, icon('gamepad'), 'Pad')),
        ...CONTROLS.map(([a, more, keys, pads]) => h('div.lrow.ctl-cols', { 'data-nav': '', tabIndex: 0, 'aria-label': a },
          h('span.ctl-a', {}, h('b', {}, a), more ? h('small', {}, more) : null), h('span.ctl-k', {}, keys.map(cap)),
          h('span.ctl-p', {}, pads.length ? pads.map(([p, name]) => icon('pad-' + p, { label: name })) : empty()))),
      ],
    };
    fill(body, R[tab]()); if (tab === 'controls') body.after(tip); else tip.remove();
    body.scrollTop = 0; fadeMore(body);
  }
  const api = {
    el, nav: true,
    onShow(f) { from = f ?? 'menu'; el.classList.toggle('over-race', from === 'pause'); build(); nav.reset(0); },
    onKeyTab(d) { tab = TABS[(TABS.findIndex(([id]) => id === tab) + d + TABS.length) % TABS.length][0]; build(); nav.reset(0); },
    onSel(e) { if (e && e === [...body.querySelectorAll('[data-nav]')].at(-1)) { body.scrollTop = body.scrollHeight; fadeMore(body); } },   // the last row scrolls the body to its end, so the fade mask lets go
    back() { game.show(from); },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------- pause, results
/** pause: a full scrim over the race, a centre panel with the session's context (mode, circuit, your car, then position, lap and
 *  time as the mode has them) and the options as icon rows; Restart and Quit ask first in a modal that traps focus on Cancel */
export function PauseScreen(game) {
  let modal = null, opener = 0;
  const opt = (ic, label, f) => h('button.lrow.opt', { 'data-nav': '', onclick: f }, icon(ic), h('span', {}, label), icon('chevron-right', { cls: 'opt-go' }));
  const kick = h('span.kick.p-mode'), circuit = h('p.p-circuit'), car = h('img.p-car', { alt: '', decoding: 'async' }), strip = h('div.p-strip'), opts = h('div.p-opts');
  const panel = h('div.pnl.p-panel', { role: 'dialog', 'aria-label': 'Paused' }, h('div.p-head', {}, h('div.p-title', {}, kick, h('h2', {}, 'Paused'), circuit), car), strip, opts);
  const el = screen('pause', h('div.sscrim'), panel,
    h('div.sfoot', {}, prompt(['arrow-up', 'arrow-down'], 'dpad', 'Select'), prompt('Enter', 'a', 'Choose'), h('div.sp'), prompt('Esc', 'b', 'Resume')));
  /** the confirm modal: title, body, Cancel (focused: the safe option) and the action as the one primary */
  function ask(title, body, ic, label, go) {
    opener = nav.i; panel.inert = true;
    modal = h('div.pnl.modal', { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title }, h('h2', {}, title), h('p', {}, body),
      h('div.m-acts', {}, h('button.btn.btn-secondary', { 'data-nav': '', onclick: close }, 'Cancel'), h('button.btn.btn-primary', { 'data-nav': '', onclick: () => { close(); go(); } }, icon(ic), label)));
    el.append(h('div.m-layer', {}, modal)); nav.reset(0);
  }
  function close(refocus = true) {
    if (!modal) return;
    modal.parentNode.remove(); modal = null; panel.inert = false;
    if (refocus) nav.reset(opener);
  }
  return {
    el, nav: true,
    get modal() { return modal; }, get grid() { return !!modal; },   // Nav: only the modal's buttons, side by side
    onShow() {
      close(false);
      const s = game.session, mode = s?.mode, M = MODES[mode] ?? {}, T = s?.trk.get(game.field.hero), laps = T?.laps.length ?? 0;
      fill(kick, mode ? icon(MODE_ICON[mode]) : null, M.label ?? '');
      fill(circuit, icon('track'), trackOf(store.settings.track).name);
      car.src = still('cars', store.data.car);
      const time = (t) => (Number.isFinite(t) ? fmtTime(t) : empty());
      fill(strip, stat('Car', carName(store.data.car)),
        mode === 'race' && [stat('Position', String(s.heroPos), `/ ${s.order.length}`), stat('Lap', String(Math.min(s.laps, Math.max(1, T.cross))), `/ ${s.laps}`), stat('Time', time(s.raceT))],
        mode === 'trial' && [stat('Lap', String(Math.max(1, T.cross))), stat('Best', time(T.best))],
        mode === 'drift' && [stat('Score', Math.round(s.drift.score).toLocaleString('en'), 'PTS'), stat('Time left', String(Math.max(0, Math.ceil(s.drift.left))), 'S')],
        mode === 'free' && [stat('Time of day', LOOK_LABEL[store.settings.look] ?? empty()), stat('Weather', WEATHER[store.settings.weather]?.label ?? empty())]);   // no clock: the conditions instead
      fill(opts, opt('play', 'Resume', () => game.resume()),
        opt('restart', 'Restart', () => ask('Restart?', mode === 'race' ? 'The race starts again from the grid.' : 'The session starts again from the beginning.', 'restart', 'Restart', () => game.restart())),
        mode === 'trial' && laps ? opt('lap', 'End and see laps', () => game.trialResults()) : null,
        opt('settings', 'Settings', () => game.show('settings', 'pause')),
        opt('quit', 'Quit to menu', () => ask('Quit to menu?', 'This session ends and you go back to the main menu.', 'quit', 'Quit', () => game.quit())));
      nav.reset(0);
    },
    back() { if (modal) close(); else game.resume(); },
  };
}

/** what a session paid in U-coins: the total on a coin line in ink, its parts, the balance after */
function earnBlock(reward) {
  if (!reward) return null;
  const coins = (v, sign = '') => h('b.tnum', {}, icon('coin'), sign + v.toLocaleString('en'));
  return h('div.earn', { 'aria-label': 'U-coins earned' }, h('div.etotal', {}, h('span.kick', {}, 'U-coins earned'), coins(reward.total, '+')),
    h('div.elines', {}, reward.lines.map(([label, v]) => h('span', {}, label, h('b.tnum', {}, '+' + v.toLocaleString('en'))))),
    h('div.ebal', {}, h('span.kick', {}, 'Balance'), coins(store.coins)));
}

/** results: the outcome on the left (heading, readouts, what it paid), the detail on the right: a race's podium (the P1-P3
 *  cutouts) over the finishing table, a trial's laps under your car, a drift's car. Rows are Nav stops (a long table scrolls by
 *  them); focus starts on Again, the one primary; Esc is Menu */
export function ResultsScreen(game) {
  const again = h('button.btn.btn-primary', { 'data-nav': '', 'data-id': 'again', onclick: () => game.restart() }, icon('restart'), 'Again');
  const menu = h('button.btn.btn-secondary', { 'data-nav': '', 'data-id': 'menu', onclick: () => game.quit() }, icon('home'), 'Menu', prompt('Esc', 'b'));
  const htitle = h('h1'), kick = h('span.kick.r-kick'), side = h('div.r-side'), main = h('div.r-main');
  const el = screen('results', h('div.sscrim'), h('header.shead', {}, h('i.logo'), htitle, kick), h('div.sbody.r-body', {}, side, main),
    h('div.sfoot', {}, prompt(['arrow-left', 'arrow-up', 'arrow-down', 'arrow-right'], 'dpad', 'Select'), prompt('Enter', 'a', 'Choose'), h('div.sp'), menu, again));
  const time = (t) => (Number.isFinite(t) ? fmtTime(t) : empty());
  const head = (title, sub, hero = false) => h('div.r-head', {}, h('h2' + (hero ? '.r-hero' : ''), {}, title), h('p.r-sub', {}, sub));
  const big = (...kids) => h('div.r-big', {}, kids);
  const rows = (cls, cols, list) => { const s = h('div.lscroll.r-rows', { onscroll: (e) => fadeMore(e.currentTarget) }, list); return [h('div.pnl.r-table', {}, h('div.lhead.' + cls, {}, cols), s), s]; };   // [the table panel, its scroller]
  const carHero = (key, cls = '') => h('img.r-car' + cls, { src: still('cars', key), alt: '', decoding: 'async' });
  const laps = (n) => `${n} ${n === 1 ? 'lap' : 'laps'}`;
  return {
    el, nav: true, grid: true,
    onShow(data) {
      const { mode, record, score, best } = data, car = store.data.car;
      fill(htitle, icon(MODE_ICON[mode] ?? 'trophy'), 'Results'); fill(kick, icon('track'), trackOf(store.settings.track).name);
      let scroller = null;
      if (mode === 'race') {
        const R = data.rows, me = R.findIndex((r) => r.hero), lead = R[0].total, you = R[me];
        const fastest = Math.min(...R.map((r) => r.best ?? Infinity));
        const pod = (r, k) => css(h('div.pod' + (k === 0 ? '.p1' : '') + (r.hero ? '.me' : ''), {}, carHero(r.key),
          h('div.pod-text', {}, h('b.pod-pos', {}, `P${k + 1}`), h('i.tbar'), h('span.c-name', {}, h('b', {}, r.driver.name), h('small', {}, r.driver.team.name)))), { '--team': teamMark(r.driver.team) });
        const [table, s] = rows('r-cols', [h('span', {}, 'Pos'), h('span'), h('span', {}, 'Driver'), h('span', {}, 'Car'), h('span.val', {}, icon('timer'), 'Best lap'), h('span.val', {}, 'Time')],
          R.map((r, k) => css(h('div.lrow.r-cols' + (r.hero ? '.me' : ''), { 'data-nav': '', tabIndex: 0 },
            h('b.r-pos.tnum', {}, k + 1), h('i.tbar'), h('span.c-name', {}, h('b', {}, r.driver.name), h('small', {}, r.driver.team.name), r.hero ? icon('check', { label: 'You' }) : null),
            h('span.r-carname', {}, carName(r.key)),
            h('span.val', {}, r.best === fastest && Number.isFinite(fastest) ? icon('bolt', { cls: 'r-bolt', label: 'Fastest lap' }) : null, time(r.best)),
            h('span.val', {}, k === 0 ? time(r.total) : Number.isFinite(r.total - lead) ? ['+' + (r.total - lead).toFixed(3), r.finished ? null : h('small', {}, 'Est')] : empty())), { '--team': teamMark(r.driver.team) })));
        scroller = s;
        if (R.some((r) => !r.finished)) table.append(h('p.r-note', {}, 'Est: still on track, the gap is estimated from pace.'));   // the table's footnote, under the gaps it explains
        const gap = (r) => (Number.isFinite(r?.total - lead) ? stat(me === 0 ? 'Margin' : 'To winner', '+' + (r.total - lead).toFixed(3), r.finished ? null : 'Est') : stat(me === 0 ? 'Margin' : 'To winner', empty()));
        fill(side, head(me === 0 ? 'Victory' : `P${me + 1}`, `${MODES.race.label} · ${laps(data.laps)} · ${carName(car)}`, true),
          h('div.r-stats', {}, stat('Position', String(me + 1), `/ ${R.length}`), stat('Time', time(you?.total)), stat('Best lap', time(you?.best))),
          h('div.r-stats', {}, gap(me === 0 ? R[1] : you), stat('Fastest lap', time(fastest))),   // the race summary: the gap that decided it, the field's best lap
          earnBlock(data.reward));
        fill(main, h('div.r-podium', {}, [1, 0, 2].filter((k) => R[k]).map((k) => pod(R[k], k))), table);
      } else if (mode === 'drift') {
        const rec = store.driftOf(car), banked = game.session?.drift?.banked ?? [], top = game.hud?.topMult ?? 1;   // after a new record rec is the score itself
        fill(side, head('Drift Attack', `${MODES.drift.seconds} seconds · ${carName(car)}`),
          big(stat('Score', Math.round(score).toLocaleString('en'), 'PTS'), record ? h('span.r-new', {}, icon('star'), 'New record') : stat('Record', rec ? rec.toLocaleString('en') : empty(), rec ? 'PTS' : null)),
          h('div.r-stats', {}, stat('Drifts', String(banked.length)), stat('Best chain', banked.length ? Math.round(Math.max(...banked)).toLocaleString('en') : empty(), banked.length ? 'PTS' : null),
            stat('Top multiplier', top > 1 ? `×${top.toFixed(1)}` : empty())),
          earnBlock(data.reward));
        fill(main, carHero(car));   // the trial's car scale and place, bottom right
      } else {
        const L = data.laps, valid = L.filter((l) => l.valid).length;
        const [table, s] = rows('t-cols', [h('span', {}, icon('lap'), 'Lap'), h('span.val', {}, icon('timer'), 'Time'), h('span.val', {}, 'To best'), h('span', {}, 'Status')],
          L.map((l, k) => h('div.lrow.t-cols', { 'data-nav': '', tabIndex: 0 }, h('b.tnum', {}, k + 1), h('span.val', {}, time(l.t)),
            h('span.val', {}, !l.valid || !Number.isFinite(best) ? empty() : l.t === best ? h('span.r-best', {}, icon('star'), 'Best') : '+' + (l.t - best).toFixed(3)),
            l.valid ? h('span.r-ok', {}, icon('check'), 'Valid') : h('span.r-bad', {}, icon('invalid'), 'Invalid'))));
        scroller = s;
        fill(side, head('Time Trial', `${laps(L.length)} · ${carName(car)}`),
          big(stat('Best lap', time(best))), record ? h('span.r-new', {}, icon('star'), 'New personal best') : null,
          h('div.r-stats', {}, stat('Laps', String(L.length)), stat('Valid', String(valid), `/ ${L.length}`)), earnBlock(data.reward));
        fill(main, carHero(car), table);
      }
      if (scroller) fadeMore(scroller);
      nav.reset(nav.items().indexOf(again));
    },
    back() { game.quit(); },
  };
}

export function setNav(n) { nav = n; }
