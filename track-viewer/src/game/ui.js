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
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
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
const cap = (k) => h('kbd', {}, k.startsWith('arrow-') ? icon(k) : k);
/** a key hint: keyboard caps (an arrow is its icon) or the pad glyph, whichever device was used last, then the action */
export const prompt = (keys, pad, label) => h('span.prompt', {}, h('span.pk', {}, [keys].flat().map(cap)), pad ? icon('pad-' + pad, { cls: 'pp' }) : null, label ? h('span.pl', {}, label) : null);
/** the footer's Back: a ghost button with its Esc / B prompt, last in the band */
export const backButton = (onclick) => h('button.btn.btn-ghost', { 'data-nav': '', onclick }, icon('back'), 'Back', prompt('Esc', 'b'));
/** the shared header band: the logo, the screen title, an optional kicker on the right */
const header = (title, kick) => h('header.shead', {}, h('i.logo'), h('h1', {}, title), kick ? h('span.kick', {}, kick) : null);
/** a scroller's bottom fade while more is below (on scroll and on rebuild, never per frame) */
const fadeMore = (el) => el.classList.toggle('more', el.scrollHeight - el.scrollTop - el.clientHeight > 1);

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
      if (e.target?.tagName === 'INPUT' && e.target.type === 'color') return;
      const k = e.code;
      if (k === 'ArrowDown') { this.moveSpatial(0,1); e.preventDefault(); }
      else if (k === 'ArrowUp') { this.moveSpatial(0,-1); e.preventDefault(); }
      else if (k === 'ArrowLeft' || k === 'ArrowRight') { if(s.grid)this.moveSpatial(k==='ArrowLeft'?-1:1,0);else this.adjust(k === 'ArrowLeft' ? -1 : 1); e.preventDefault(); }
      else if (k === 'Enter' || k === 'NumpadEnter') { this.items()[this.i]?.click(); e.preventDefault(); }
      else if (k === 'Escape' || k === 'Backspace') { s.back?.(); e.preventDefault(); }
    });
  }
  items() { return [...(this.game.screen?.el.querySelectorAll('[data-nav]') ?? [])].filter((e) => e.offsetParent !== null); }
  reset(i = 0) { this.i = i; this.mark(); }
  move(d) { const L = this.items(); if (!L.length) return; this.i = (this.i + d + L.length) % L.length; this.mark(true); this.game.audio.play('race/count-tick.ogg', { gain: 0.25 }); }
  moveSpatial(dx,dy) {
    if(!this.game.screen?.grid){this.move(dy||dx);return;}
    const L=this.items(), current=L[this.i];if(!current)return;
    const box=current.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height/2;
    let best=-1,score=Infinity;
    L.forEach((e,i)=>{if(i===this.i)return;const b=e.getBoundingClientRect(),xx=b.x+b.width/2-x,yy=b.y+b.height/2-y;
      const ahead=xx*dx+yy*dy,cross=Math.abs(xx*dy-yy*dx);
      if(ahead>1&&ahead+cross*2<score-1){score=ahead+cross*2;best=i;}   // a tie within 1 px keeps the earlier stop: Right from Race is Time Trial, not Garage
    });
    if(best>=0){this.i=best;this.mark(true);}
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
  hover() {}   // retired: hover is a --c-fill-2 style only (garage.js still calls it until its own pass)
  /** gamepad: d-pad with key repeat, A = Enter, B = back */
  pad(dt) {
    const p = navigator.getGamepads?.().find((g) => g?.connected); if (!p) return;
    const b = (i) => p.buttons[i]?.pressed, ax = p.axes;
    const dir = b(13) || ax[1] > 0.6 ? 'd' : b(12) || ax[1] < -0.6 ? 'u' : b(14) || ax[0] < -0.6 ? 'l' : b(15) || ax[0] > 0.6 ? 'r' : null;
    if (dir || p.buttons.some((x) => x.pressed)) setInput('pad');            // prompts follow the pad; an attribute write only on a change
    this.rep = dir === this.dir ? this.rep - dt : 0; this.dir = dir;
    if (dir && this.rep <= 0) { this.rep = this.rep === 0 ? 0.38 : 0.12; ({ d: () => this.moveSpatial(0,1), u: () => this.moveSpatial(0,-1), l: () => this.game.screen?.grid?this.moveSpatial(-1,0):this.adjust(-1), r: () => this.game.screen?.grid?this.moveSpatial(1,0):this.adjust(1) })[dir](); }
    const a = b(0), back = b(1);
    if (a && !this.a) this.items()[this.i]?.click();
    if (back && !this.b) this.game.screen?.back?.();
    this.a = a; this.b = back;
  }
}

/** a row of choices: [[value, label], ...]; Left/Right steps through them */
export function seg(choices, value, onchange) {
  const wrap = h('div.seg');
  const set = (v) => { value = v; [...wrap.children].forEach((b, k) => b.classList.toggle('on', choices[k][0] === v)); onchange(v); };
  choices.forEach(([v, label]) => wrap.append(h('button', { onclick: (e) => { e.stopPropagation(); set(v); } }, label)));
  [...wrap.children].forEach((b, k) => b.classList.toggle('on', choices[k][0] === value));
  wrap.step = (d) => { const k = choices.findIndex((c) => c[0] === value); set(choices[Math.min(choices.length - 1, Math.max(0, k + d))][0]); };
  return wrap;
}
export function slider(value, { min = 0, max = 1, step = 0.01, fmt = (v) => Math.round(v * 100) }, onchange) {
  const out = h('output', {}, fmt(value)), inp = h('input', { type: 'range', min, max, step, value });
  const paint = () => inp.style.setProperty('--v', `${((inp.value - min) / (max - min)) * 100}%`);
  inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); paint(); onchange(+inp.value); });
  paint();
  const wrap = h('div.slider', {}, inp, out);
  wrap.step = (d) => { inp.value = Math.min(max, Math.max(min, +inp.value + d * step * 5)); inp.dispatchEvent(new Event('input')); };
  return wrap;
}
export function toggle(on, onchange) {
  const t = h('button.toggle' + (on ? '.on' : ''), { onclick: (e) => { e.stopPropagation(); on = !on; t.classList.toggle('on', on); onchange(on); } });
  t.step = () => t.click();
  return t;
}
/** a settings row: a label and a control; the whole row is one nav stop */
export function row(label, control, note) {
  const r = h('div.row', { 'data-nav': '', onadjust: (e) => control.step?.(e.detail), onclick: () => control.step?.(1), onmouseenter: (e) => nav?.hover(e.currentTarget) }, h('label', {}, label), control, note ? h('div.note', {}, note) : null);
  return r;
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
    h('i.logo'), h('div.t-status', {}, h('div.t-press', {}, prompt('Enter', 'a', 'Press any key')), load));
  const go = () => game.boot();
  el.addEventListener('pointerdown', go);
  // main.js reports 0.15 (garage and cars loading), 0.7 (shaders compiling) and game.attach() 1
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
  const go = (id) => () => (MODES[id] ? game.show('setup', id) : game.show(id));
  const tile = (id, ic, word, kicker, desc, cls = '', extra = null, bg = null) => h('button.bento-tile.' + cls, { 'data-nav': '', 'data-id': id, onclick: go(id) }, bg,
    h('span.tile-top', {}, icon(ic, { cls: 'tile-icon' }), icon('arrow-up-right', { cls: 'tile-go' })),
    h('span.tile-text', {}, h('span.tile-kicker', {}, kicker), h('strong', {}, word), desc ? h('span.tile-desc', {}, desc) : null, extra));
  const raceStill = h('img.tile-still', { alt: '', decoding: 'async' }), circuit = h('b'), len = h('b.tnum'), corners = h('b.tnum');
  const facts = h('span.tile-facts', {}, h('span.stat-r', {}, h('small', {}, 'Circuit'), circuit), h('span.stat-r', {}, h('small', {}, 'Length'), len), h('span.stat-r', {}, h('small', {}, 'Corners'), corners));
  const race = tile('race', 'race', 'Race', 'The main event', MODES.race.desc, 'race-tile', facts, raceStill);
  const best = h('span.tile-desc.tile-best');
  const current = h('button.bento-tile.current-car', { 'data-nav': '', 'aria-label': 'Your car: open the garage', onclick: () => game.show('garage') });
  const grid = h('div.bento-grid', {}, race,
    tile('trial', 'time-trial', 'Time Trial', 'Chase your best', MODES.trial.desc, 'trial-tile'),
    tile('drift', 'drift', 'Drift Attack', 'Find the limit', MODES.drift.desc, 'drift-tile'),
    tile('free', 'free-drive', 'Free Drive', 'Your circuit', MODES.free.desc, 'free-tile'),
    tile('garage', 'garage', 'Garage', 'The collection', ROSTER.length + ' cars. Your colours. Your upgrades.', 'garage-tile'),
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
      raceStill.src = still('tracks', t.id); circuit.textContent = t.name; fill(len, empty()); fill(corners, empty());
      factsOf(t).then((f) => {
        if (!f || shown !== t.id + mph) return;
        fill(len, f.m ? [(f.m / (mph ? 1609.344 : 1000)).toFixed(2), h('small', {}, mph ? 'MI' : 'KM')] : empty()); fill(corners, f.corners ? String(f.corners) : empty());
      });
    },
    // no back(): Esc and pad B do nothing on the menu, the title is boot only
  };
}

/** the menu's "Your car" tile: the cutout over a team-tinted panel, the name, the team logo and the driver */
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
      return css(h('div.lrow.rec-cols', { 'data-nav': '', tabindex: 0 }, h('i.tbar'), h('img.cut', { src: still('cars', k), alt: '', decoding: 'async' }),
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
  const note = (text) => (text ? h('p.cr-note', {}, text) : null);   // provenance and licence notes: shown verbatim, never reworded
  const group = (name, items) => h('section.cr-group', {}, h('h2.kick', {}, name), h('div.cr-grid', {}, items));
  const scroll = h('div.lscroll.cr-scroll', { onscroll: (e) => fadeMore(e.currentTarget) },
    group('Cars', [...MODEL_CREDITS.map((c) => item(c.title, h('p', {}, 'Created by ', link(c.author, c.authorUrl ?? c.url)), links(link('Original model', c.url), link(c.license, c.licenseUrl)),
      note(c.additionalCredits), h('p.cr-dim', {}, 'Adapted for Ultrack: scale, orientation, wheel separation, materials and runtime LODs.'))),
    item('Additional Lamborghini exterior credit', links(link('Lambo_SC04', 'https://sketchfab.com/Lambo_SC04')), h('p', {}, 'Aventador SVJ Black-Ghost, CC BY-NC. Interior/combined model: blackcube4.'))]),
    group('Audio', [...ENGINE_CREDITS.map((c) => item(c.name + ' recording', links(link(c.title, c.url)), h('p', {}, 'Recorded by ', c.author), links(link(c.license, c.licenseUrl)), h('p.cr-dim', {}, c.changes))),
      item('Voices and effects', h('p', {}, 'Commentary voices and crash effects: ElevenLabs.'), h('p', {}, 'EV motor, wind and tyre layers: procedural Web Audio.'))]),
    group('Artwork', [item('Environment HDRIs', h('p', {}, 'Poly Haven (CC0).')),
      item('Sponsor & marque artwork', h('p', {}, 'Simple Icons; Pirelli official artwork; Rolex wordmark via Wikimedia Commons; car-logos-dataset. Original marks remain with their owners. Source URLs and hashes: assets/sponsors/manifest.json.'))]),
    group('Fonts', FONT_CREDITS.map(([name, by, url]) => item(name, h('p', {}, by), links(link('Source', url), link('SIL Open Font License 1.1', 'https://openfontlicense.org'))))),
    group('Code', CODE_CREDITS.map(([name, by, url, lic, licUrl]) => item(name, h('p', {}, by), links(link('Project', url), link(lic, licUrl))))),
    h('p.cr-notice', {}, icon('info'), h('span', {}, 'Local noncommercial fan project. Several models carry non-commercial or share-alike licenses (listed above), and any model with unresolved provenance must be replaced before public distribution.')));
  const el = screen('credits', h('div.sscrim'), header('Credits', 'The people behind the machines'), h('div.sbody', {}, h('div.pnl.cr-panel', {}, scroll)),
    h('div.sfoot', {}, prompt(['arrow-up', 'arrow-down'], 'dpad', 'Browse'), prompt('Enter', 'a', 'Open link'), h('div.sp'), backButton(() => game.show('menu'))));
  return { el, nav: true, onShow() { fadeMore(scroll); }, back() { game.show('menu'); } };
}

export function fillCard(card, key) {
  const t = TEAM_OF[key], e = ENTRY[key];
  css(card, { '--team': teamMark(t) });
  fill(card, h('div.k', {}, 'YOUR CAR'), h('div.num', {}, e.number), h('div.name', {}, carName(key)),
    h('div.team', {},teamLogo(t)), h('div.drv', {}, `${e.driver.name} · ${e.driver.nation}`));
}

export function SetupScreen(game) {
  let mode = 'race', tracks = [];   // tracks: the circuits whose files exist; the row shows only with a choice (Tokyo once exported)
  const title = h('h2'), sub = h('div.sub'), rows = h('div'), card = h('div.carcard');
  const start = h('button.cta', { 'data-nav': '', onclick: () => game.startSession(mode), onmouseenter: (e) => nav.hover(e.currentTarget) }, 'Start');
  const el = screen('menu', h('div.scrim'), h('div.panel.setup', {}, title, sub, rows, start), card,
    h('div.footer', {}, h('span', {}, h('b', {}, '←→'), 'CHANGE'), h('span', {}, h('b', {}, 'ENTER'), 'START'), h('span', {}, h('b', {}, 'ESC'), 'BACK')));
  function build() {
    const M = MODES[mode], S = store.settings;
    title.textContent = M.label; sub.textContent = M.desc;
    fill(rows, 
      tracks.length > 1 ? row('Circuit', seg(tracks.map((t) => [t.id, t.name]), trackOf(S.track).id, (v) => { game.selectTrack(v).then(() => { build(); nav.mark(); }); })) : null,
      M.laps ? row('Laps', seg([[1, '1'], [3, '3'], [5, '5'], [10, '10']], S.laps, (v) => store.set('laps', v))) : null,
      row('Time of day', seg(Object.entries(LOOK_LABEL), S.look, (v) => { store.set('look', v); game.applySettings(); })),
      row('Weather', seg(Object.entries(WEATHER).map(([k, w]) => [k, w.label]), S.weather, (v) => { store.set('weather', v); game.applySettings(); })),
      row('Assists', seg(Object.entries(ASSISTS).map(([k, a]) => [k, a.label]), S.assists, (v) => { store.set('assists', v); }), ASSISTS[S.assists].note),
    );
  }
  return {
    el, nav: true,
    onShow(m) {
      mode = m ?? mode; build();
      fillCard(card, store.data.car);
      nav.reset(0);
      availableTracks().then((list) => { if (list.length !== tracks.length) { tracks = list; build(); nav.mark(); } });
    },
    back() { game.show('menu'); },
  };
}

export { GarageScreen } from './garage.js';   // the garage, its stats, specs and upgrades

// ---------------------------------------------------------------------------------------------- settings
export function SettingsScreen(game) {
  let tab = 'display', from = 'menu';
  const tabs = h('div.tabs'), body = h('div.body');
  const el = screen('menu', h('div.scrim'), h('div.panel.settings', {}, h('h2', {}, 'Settings'), tabs, body),
    h('div.footer', {}, h('span', {}, h('b', {}, '←→'), 'CHANGE'), h('span', {}, h('b', {}, 'ESC'), 'BACK'), h('div.sp'), h('span', {}, 'SAVED ON THIS DEVICE')));
  const set = (k) => (v) => { store.set(k, v); game.applySettings(); };
  const pct = (v) => `${Math.round(v * 100)}`;
  function build() {
    const S = store.settings;
    fill(tabs, ...[['display', 'Picture'], ['driving', 'Driving'], ['audio', 'Sound'], ['controls', 'Controls']].map(([id, label]) =>
      h('button' + (tab === id ? '.on' : ''), { onclick: () => { tab = id; build(); nav.reset(0); } }, label)));
    const R = {
      display: () => [
        row('Quality', seg([['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], S.quality, set('quality')), `Auto picked ${game.ctx.device.tier} for this computer`),
        row('Time of day', seg(Object.entries(LOOK_LABEL), S.look, set('look'))),
        row('Weather', seg(Object.entries(WEATHER).map(([k, w]) => [k, w.label]), S.weather, set('weather'))),
        row('Motion blur', seg([['off', 'Off'], ['light', 'Light'], ['full', 'Full']], S.motionBlur, set('motionBlur'))),
        row('Reduce motion', toggle(S.reduceMotion, (v) => { set('reduceMotion')(v); syncMotion(); }), 'Less camera shake, roll and speed zoom'),
        row('Field of view', slider(S.fovOffset, { min: -10, max: 15, step: 1, fmt: (v) => (v > 0 ? `+${v}` : `${v}`) }, set('fovOffset'))),
        row('Show FPS', toggle(S.showFps, set('showFps'))),
      ],
      driving: () => [
        row('Assists', seg(Object.entries(ASSISTS).map(([k, a]) => [k, a.label]), S.assists, (v) => { set('assists')(v); build(); }), ASSISTS[S.assists].note),
        row('Speed in', seg([['kmh', 'km/h'], ['mph', 'mph']], S.units, set('units'))),
        row('Race laps', seg([[1, '1'], [3, '3'], [5, '5'], [10, '10']], S.laps, set('laps'))),
      ],
      audio: () => [
        row('Master', slider(S.master, {}, set('master'))),
        row('Engine', slider(S.engine, {}, set('engine'))),
        row('Effects', slider(S.effects, {}, set('effects'))),
        row('Commentary', slider(S.commentary, {}, set('commentary'))),
        row('Commentators', toggle(S.commentaryOn, set('commentaryOn')), 'Enzo Moretti, Alastair Finch and Kavya Iyer'),
        row('Crowd', slider(S.crowd, {}, set('crowd'))),
      ],
      controls: () => [h('div.keys', {}, ...[
        ['Accelerate · brake in reverse', 'W / ↑', 'RT'], ['Brake · reverse when stopped', 'S / ↓', 'LT'], ['Steer', 'A D / ← →', 'Left stick'], ['Handbrake · drift', 'Space', 'A'],
        ['Nitro', 'Shift', 'X'], ['Reset to track', 'R', 'Y'], ['Camera', 'C', 'RB'], ['Pause', 'Esc', 'Start'],
      ].flatMap(([a, k, p]) => [h('span', {}, a), h('b', {}, k), h('b', {}, p)])),
      h('div.bio', { style: { marginTop: '16px' } }, 'Drift: pull the handbrake while turning at speed, then steer to hold the angle. The normal brake keeps cornering grip. Drifting refills nitro fastest.')],
    };
    fill(body, ...R[tab]().flat());
    void pct;
  }
  return {
    el, nav: true,
    onShow(f) { from = f ?? 'menu'; build(); nav.reset(0); },
    onKeyTab(d) { const order = ['display', 'driving', 'audio', 'controls']; tab = order[(order.indexOf(tab) + d + 4) % 4]; build(); nav.reset(0); },
    back() { game.show(from); },
  };
}

// ---------------------------------------------------------------------------------------------- pause, results
export function PauseScreen(game) {
  const opt = (label, f) => h('button.opt', { 'data-nav': '', onclick: f, onmouseenter: (e) => nav.hover(e.currentTarget) }, label);
  const head = h('h2'), sub = h('div.sub'), opts = h('div');
  const el = screen('pause', h('div.scrim.full'), h('div.panel', {}, head, sub, opts));
  return {
    el, nav: true,
    onShow() {
      const mode = game.session?.mode, M = MODES[mode] ?? {}, laps = game.session?.trk.get(game.field.hero)?.laps.length ?? 0;
      head.textContent = 'Paused'; sub.textContent = `${M.label ?? ''} · ${carName(store.data.car)}`;
      fill(opts, ...[opt('Resume', () => game.resume()), opt('Restart', () => game.restart()),
        mode === 'trial' && laps ? opt('End · see laps', () => game.trialResults()) : null,
        opt('Settings', () => game.show('settings', 'pause')), opt('Quit to menu', () => game.quit())].filter(Boolean));
      nav.reset(0);
    },
    back() { game.resume(); },
  };
}

/** what a session paid in U-coins: a total and its lines */
function earnBlock(reward) {
  if (!reward) return null;
  return h('div.earn', {}, h('div.etotal', {}, h('span', {}, 'U-COINS EARNED'), h('b', {}, '+' + reward.total.toLocaleString('en'))),
    h('div.elines', {}, reward.lines.map(([label, v]) => h('span', {}, label, h('b', {}, '+' + v)))), h('div.ebal', {}, 'BALANCE ', h('b', {}, store.coins.toLocaleString('en'))));
}

export function ResultsScreen(game) {
  const panel = h('div.panel');
  const el = screen('results', h('div.scrim.full'), panel);
  return {
    el, nav: true,
    onShow(data) {
      const { mode, rows, record, score, laps, best } = data;
      const acts = h('div.acts', {}, h('button.cta', { 'data-nav': '', onclick: () => game.restart(), onmouseenter: (e) => nav.hover(e.currentTarget) }, 'Again'),
        h('button.cta.ghost', { 'data-nav': '', onclick: () => game.quit(), onmouseenter: (e) => nav.hover(e.currentTarget) }, 'Menu'));
      if (mode === 'race') {
        const me = rows.findIndex((r) => r.hero) + 1, lead = rows[0].total;
        const fastest = Math.min(...rows.map((r) => r.best ?? Infinity));
        fill(panel, h('h2', {}, me === 1 ? 'Victory' : `P${me}`), h('div.sub', {}, `${MODES.race.label} · ${data.laps} ${data.laps === 1 ? 'lap' : 'laps'} · ${trackOf(store.settings.track).name}`),
          h('table', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'DRIVER'), h('th', {}, 'CAR'), h('th', { style: { textAlign: 'right' } }, 'BEST LAP'), h('th', { style: { textAlign: 'right' } }, 'TIME')),
            rows.map((r, k) => css(h('tr' + (r.hero ? '.me' : ''), {},
              h('td.p', {}, k + 1),
              h('td', {}, h('span.tm'), `${r.driver.name}`, h('span', { style: { color: 'var(--ink-3)', marginLeft: '10px', fontSize: '16px' } }, r.driver.team.name)),
              h('td', { style: { color: 'var(--ink-2)' } }, carName(r.key)),
              h('td.num', { style: { color: r.best === fastest ? 'var(--nitro-2)' : '' } }, fmtTime(r.best)),
              h('td.num', {}, k === 0 ? fmtTime(r.total) : `+${(r.total - lead).toFixed(3)}${r.finished ? '' : ' *'}`)), { '--team': teamMark(r.driver.team) }))),
          h('div.note', { style: { fontSize: '14px', color: 'var(--ink-3)', margin: '8px 0 0' } }, rows.some((r) => !r.finished) ? '* still on track: gap estimated from pace' : ''), earnBlock(data.reward), acts);
      } else if (mode === 'drift') {
        fill(panel, h('h2', {}, 'Drift Attack'), h('div.sub', {}, `${carName(store.data.car)} · 90 seconds`),
          h('div.big', {}, Math.round(score).toLocaleString('en'), h('small', {}, 'PTS')), record ? h('div.rec', {}, 'NEW RECORD') : h('div.sub', {}, `Record ${store.driftOf(store.data.car).toLocaleString('en')}`), earnBlock(data.reward), acts);
      } else {
        fill(panel, h('h2', {}, 'Time Trial'), h('div.sub', {}, `${carName(store.data.car)} · ${laps.length} ${laps.length === 1 ? 'lap' : 'laps'}`),
          h('div.big', {}, fmtTime(best)), record ? h('div.rec', {}, 'NEW PERSONAL BEST') : null,
          h('table', {}, laps.map((l, k) => h('tr', {}, h('td.p', {}, k + 1), h('td.num', { style: { textAlign: 'left', color: l.valid ? '' : 'var(--bad)' } }, fmtTime(l.t), l.valid ? '' : '  invalid')))), earnBlock(data.reward), acts);
      }
      nav.reset(0);
    },
    back() { game.quit(); },
  };
}

export function setNav(n) { nav = n; }
