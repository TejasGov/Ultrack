// The menus: title, main menu, session setup, garage (car picker + paint tuner), settings, pause and results. Plain
// DOM. Every screen works with the mouse, the keyboard (arrows, Enter, Esc) and a gamepad (d-pad, A, B), through Nav.
import TEAMS from '../../../assets/teams/teams.json';
import ENGINE_CREDITS from '../../../assets/audio/recordings/credits.json';
import {teamLogoUrl} from '../team-logos.js';
import { carName, ROSTER } from './carinfo.js';
import { MODES } from './session.js';
import { store, ASSISTS, WEATHER, fmtTime } from './store.js';

export const TEAM_OF = Object.fromEntries(TEAMS.teams.flatMap((t) => t.cars.map((c) => [c.key, t])));
export const ENTRY = Object.fromEntries(TEAMS.teams.flatMap((t) => t.cars.map((c) => [c.key, c])));
export { carName };
export const teamLogo=team=>h('img.team-logo',{src:teamLogoUrl(team),alt:team.name,width:200,height:50,decoding:'async'});
/** a team's colour for marks on dark panels: the primary, or the secondary when the primary is too dark to read */
export function teamMark(t) {
  const c = parseInt(t.colors.primary.slice(1), 16), l = 0.2126 * (c >> 16) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255);
  return l < 45 ? t.colors.secondary : t.colors.primary;
}
const LOOK_LABEL = { dusk: 'Dusk', bluehour: 'Blue hour', night: 'Night' };

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

// ---------------------------------------------------------------------------------------------- navigation
/** Keyboard / gamepad focus over a screen's [data-nav] elements: up/down move, left/right adjust, Enter clicks. */
export class Nav {
  constructor(game) {
    this.game = game; this.i = 0;
    addEventListener('keydown', (e) => {
      if(game.raceLoading?.active)return;
      const s = game.screen; if (!s?.nav) return;
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
      if(ahead>1&&ahead+cross*2<score){score=ahead+cross*2;best=i;}
    });
    if(best>=0){this.i=best;this.mark(true);}
  }
  adjust(d) { this.items()[this.i]?.dispatchEvent(new CustomEvent('adjust', { detail: d })); }
  mark(byKey = false) {
    const L = this.items();
    L.forEach((e, k) => e.classList.toggle('sel', k === this.i));
    L[this.i]?.scrollIntoView?.({ block: 'nearest' });
    this.game.screen?.onSel?.(L[this.i], byKey);
  }
  hover(el) { const k = this.items().indexOf(el); if (k >= 0 && k !== this.i) { this.i = k; this.mark(); } }
  /** gamepad: d-pad with key repeat, A = Enter, B = back */
  pad(dt) {
    const p = navigator.getGamepads?.().find((g) => g?.connected); if (!p) return;
    const b = (i) => p.buttons[i]?.pressed, ax = p.axes;
    const dir = b(13) || ax[1] > 0.6 ? 'd' : b(12) || ax[1] < -0.6 ? 'u' : b(14) || ax[0] < -0.6 ? 'l' : b(15) || ax[0] > 0.6 ? 'r' : null;
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

export function TitleScreen(game) {
  const bar = h('div.loadbar', {}, h('i'));
  const el = screen('title-screen', h('div.scrim.full', { style: { background: 'radial-gradient(circle at 50% 45%, rgba(4,5,8,0.2), rgba(4,5,8,0.75))', backdropFilter: 'none' } }),
    h('i.logo'), h('div.press', {}, 'PRESS ANY KEY · LOADING GARAGE'), bar, h('div.ver', {}, 'V2 · CORNICHE MARINA'));
  const go = () => game.boot();
  el.addEventListener('pointerdown', go);
  return { el, onKey: go, progress: (p) => bar.style.setProperty('--p', p), ready: () => { el.querySelector('.press').textContent = 'PRESS ANY KEY'; bar.style.opacity = 0; } };
}

export function MenuScreen(game) {
  const tile=(id,label,kicker,desc,cls='')=>h('button.bento-tile.'+cls,{
    'data-nav':'','data-id':id,'data-desc':desc,onmouseenter:e=>nav.hover(e.currentTarget),
    onclick:()=>MODES[id]?game.show('setup',id):game.show(id)
  },h('span.tile-kicker',{},kicker),h('strong',{},label),h('span.tile-desc',{},desc),h('span.tile-arrow',{'aria-hidden':'true'},'↗'));
  const coinChip=h('div.coinchip'),current=h('button.bento-tile.current-car',{'data-nav':'','aria-label':'Current car, open garage',onclick:()=>game.show('garage'),onmouseenter:e=>nav.hover(e.currentTarget)}),record=h('span.tile-desc');
  const grid=h('div.bento-grid',{},
    tile('race','Race','01 / THE MAIN EVENT',MODES.race.desc,'race-tile'),
    tile('trial','Time Trial','02 / CHASE YOUR BEST',MODES.trial.desc,'trial-tile'),
    tile('drift','Drift Attack','03 / FIND THE LIMIT',MODES.drift.desc,'drift-tile'),
    tile('free','Free Drive','04 / YOUR CIRCUIT',MODES.free.desc,'free-tile'),
    tile('garage','Garage','THE COLLECTION',ROSTER.length + ' cars. Your colours. Your upgrades.','garage-tile'),
    current,
    h('button.bento-tile.records-tile',{'data-nav':'',onclick:()=>game.show('records'),onmouseenter:e=>nav.hover(e.currentTarget)},h('span.tile-kicker',{},'PERSONAL RECORDS'),h('strong',{},'The timing board'),record),
    tile('settings','Settings','MAKE IT YOURS','Picture, driving and sound.','settings-tile'),
    tile('credits','Credits','THE PEOPLE & THE CRAFT','Model creators, sources and licenses.','credits-tile'));
  const el=screen('menu.home',h('div.scrim'),h('i.logo.brand'),h('div.home-heading',{},'CORNICHE MARINA',h('span',{},'THE CIRCUIT IS YOURS'),coinChip),grid,
    h('div.footer',{},h('span',{},h('b',{},'ARROWS'),'SELECT'),h('span',{},h('b',{},'ENTER'),'GO'),h('div.sp'),h('span',{},'ULTRACK / V2')));
  return {el,nav:true,grid:true,onShow(){coinChip.textContent='U-COINS  '+store.coins.toLocaleString('en');fillCard(current,store.data.car);const best=store.data.best[store.data.car];record.textContent=(best?'BEST '+fmtTime(best):'Set your first lap')+' · '+carName(store.data.car);},back(){game.show('title');}};
}

export function RecordsScreen(game) {
  const body=h('div.records-list'),el=screen('records',h('div.scrim.full'),h('div.panel',{},h('h2',{},'Personal records'),h('div.sub',{},'SAVED ON THIS DEVICE'),body,
    h('button.cta',{'data-nav':'',onclick:()=>game.show('menu')},'Back')));
  return {el,nav:true,onShow(){fill(body,...ROSTER.map(k=>h('div.record-row',{},h('strong',{},carName(k)),h('span',{},fmtTime(store.data.best[k])),h('span',{},(store.data.drift[k]??0).toLocaleString('en')+' PTS'))));},back(){game.show('menu');}};
}

const MODEL_CREDITS=Object.values(import.meta.glob('../../../assets/cars/*/model.json',{eager:true,import:'default'})).map(m=>m.source).filter(Boolean).sort((a,b)=>String(a.title).localeCompare(String(b.title)));
export function CreditsScreen(game) {
  const link=(label,url)=>/^https?:\/\//.test(url??'')?h('a',{'data-nav':'',href:url,target:'_blank',rel:'noopener noreferrer'},label):h('span',{},label);
  const body=h('div.credit-list',{},...MODEL_CREDITS.map(c=>h('article.credit-card',{},h('h3',{},c.title),h('p',{},'Created by ',link(c.author,c.authorUrl??c.url)),
    h('p',{},link('Original model',c.url),' · ',link(c.license,c.licenseUrl)),
    c.additionalCredits?h('p',{},c.additionalCredits):null,
    h('p',{},'Adapted for Ultrack: scale, orientation, wheel separation, materials and runtime LODs.'))),
    h('article.credit-card',{},h('h3',{},'Additional Lamborghini exterior credit'),h('p',{},link('Lambo_SC04','https://sketchfab.com/Lambo_SC04'),' · Aventador SVJ Black-Ghost · CC BY-NC. Interior/combined model: blackcube4.')),
    h('article.credit-card',{},h('h3',{},'Circuit, voices & sound'),h('p',{},'Environment HDRIs: Poly Haven (CC0). Commentary voices and crash effects: ElevenLabs. Real recorded engines: YouTube creators below. EV motor, wind and tyre layers: procedural Web Audio.')),
    ...ENGINE_CREDITS.map(c=>h('article.credit-card',{},h('h3',{},c.name+' recording'),h('p',{},link(c.title,c.url),' · ',c.author,' · ',link(c.license,c.licenseUrl)),h('p',{},c.changes))),
    h('article.credit-card',{},h('h3',{},'Sponsor & marque artwork'),h('p',{},'Simple Icons; Pirelli official artwork; Rolex wordmark via Wikimedia Commons; car-logos-dataset. Original marks remain with their owners. Source URLs and hashes: assets/sponsors/manifest.json.')),
    h('p.credit-notice',{},'Local noncommercial fan project. Several models carry non-commercial or share-alike licenses (listed above), and any model with unresolved provenance must be replaced before public distribution.'));
  const el=screen('credits',h('div.scrim.full'),h('div.panel',{},h('h2',{},'Credits'),h('div.sub',{},'THE PEOPLE BEHIND THE MACHINES'),body,h('button.cta',{'data-nav':'',onclick:()=>game.show('menu')},'Back')));
  return {el,nav:true,back(){game.show('menu');}};
}

export function fillCard(card, key) {
  const t = TEAM_OF[key], e = ENTRY[key];
  css(card, { '--team': teamMark(t) });
  fill(card, h('div.k', {}, 'YOUR CAR'), h('div.num', {}, e.number), h('div.name', {}, carName(key)),
    h('div.team', {},teamLogo(t)), h('div.drv', {}, `${e.driver.name} · ${e.driver.nation}`));
}

export function SetupScreen(game) {
  let mode = 'race';
  const title = h('h2'), sub = h('div.sub'), rows = h('div'), card = h('div.carcard');
  const start = h('button.cta', { 'data-nav': '', onclick: () => game.startSession(mode), onmouseenter: (e) => nav.hover(e.currentTarget) }, 'Start');
  const el = screen('menu', h('div.scrim'), h('div.panel.setup', {}, title, sub, rows, start), card,
    h('div.footer', {}, h('span', {}, h('b', {}, '←→'), 'CHANGE'), h('span', {}, h('b', {}, 'ENTER'), 'START'), h('span', {}, h('b', {}, 'ESC'), 'BACK')));
  return {
    el, nav: true,
    onShow(m) {
      mode = m ?? mode; const M = MODES[mode], S = store.settings;
      title.textContent = M.label; sub.textContent = M.desc;
      fill(rows, 
        M.laps ? row('Laps', seg([[1, '1'], [3, '3'], [5, '5'], [10, '10']], S.laps, (v) => store.set('laps', v))) : null,
        row('Time of day', seg(Object.entries(LOOK_LABEL), S.look, (v) => { store.set('look', v); game.applySettings(); })),
        row('Weather', seg(Object.entries(WEATHER).map(([k, w]) => [k, w.label]), S.weather, (v) => { store.set('weather', v); game.applySettings(); })),
        row('Assists', seg(Object.entries(ASSISTS).map(([k, a]) => [k, a.label]), S.assists, (v) => { store.set('assists', v); }), ASSISTS[S.assists].note),
      );
      fillCard(card, store.data.car);
      nav.reset(0);
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
        row('Reduce motion', toggle(S.reduceMotion, set('reduceMotion')), 'Less camera shake, roll and speed zoom'),
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
        fill(panel, h('h2', {}, me === 1 ? 'Victory' : `P${me}`), h('div.sub', {}, `${MODES.race.label} · ${data.laps} ${data.laps === 1 ? 'lap' : 'laps'} · Corniche Marina`),
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
          h('div.big', {}, Math.round(score).toLocaleString('en'), h('small', {}, 'PTS')), record ? h('div.rec', {}, 'NEW RECORD') : h('div.sub', {}, `Record ${(store.data.drift[store.data.car] ?? 0).toLocaleString('en')}`), earnBlock(data.reward), acts);
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
