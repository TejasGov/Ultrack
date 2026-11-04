// What every full-screen career screen shares (docs/career-mode.md section 13): the frame (a still behind a scrim, the status bar, the page, the footer),
// the season strip, and the small formatters. The screens are career-hub.js, career-deals.js and career-ui.js.
import './career.css';
import { h, fill, css, prompt, stat, still, teamLogo } from './ui.js';
import { carName } from './carinfo.js';
import { storyImage, thumbOf } from './career/career.js';
import { store } from './store.js';
import { icon } from './icons.js';
import { TRACKS } from '../tracks.js';
import { saveCareer } from './career/save.js';
import * as C from './career/career.js';
import { loreOf, TIERS, CAL, SPONSORS, xpForLevel } from './career/rules.js';

export const LOOK = { day: ['Day', 'sun'], dusk: ['Dusk', 'sunset'], bluehour: ['Evening', 'moon-horizon'], night: ['Night', 'moon'] };
export const WX_ICON = { dry: 'sun', damp: 'cloud-drizzle', rain: 'cloud-rain' };
export const MEDAL = ['No medal', 'Bronze', 'Silver', 'Gold'];
export const EVENT = { test: ['Test day', 'time-trial'], sponsor: ['Sponsor day', 'drift'] };
/** coins are gold with the coin, wherever an amount is shown (the .cx-coin colour is the wallet's) */
export const coins = (n, plus = false) => h('span.cx-coin', {}, icon('coin'), (plus && n > 0 ? '+' : '') + Math.round(n).toLocaleString('en'));
export const money = (n) => `${Math.round(n).toLocaleString('en')} U`;
export const signed = (n, d = 0) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n).toFixed(d);
/** a change you can read at a glance: green and up, red and down, grey and level; the arrow and the sign carry it as well as the colour */
export const delta = (n, d = 0) => h(`span.cx-d.${n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero'}`, {}, icon(n > 0 ? 'chevron-up' : n < 0 ? 'chevron-down' : 'minus'), signed(n, d));
/** the four numbers of a career, each with its own colour and icon wherever it appears: coin (gold), xp (Level and XP, sky), rep (rose), trust (orange) */
const SX = { coin: 'coin', xp: 'chevrons-up', rep: 'star', trust: 'assists' };
export const cs = (k, label, value, unit) => h(`span.stat-r.sx.sx-${k}`, {}, h('small', {}, icon(SX[k]), label), h('b.tnum', {}, value, unit ? h('small', {}, unit) : null));
/** the engine's sentences, with the amounts in their own colours: "95 U" a coin, "+215 XP", "reputation +36", "trust +7" */
const RICH = /([+−-]?\d[\d,]*(?:\.\d+)?) ?(U|XP)\b|([Rr]eputation|[Tt]rust) ([+−-]?\d+)/g;
export function rich(text) {
  const out = []; let at = 0, t = String(text ?? '');
  for (const m of t.matchAll(RICH)) {
    out.push(t.slice(at, m.index)); at = m.index + m[0].length;
    out.push(m[2] === 'U' ? h('span.cx-coin', {}, icon('coin'), m[1]) : m[2] ? h('span.cx-xp', {}, icon('chevrons-up'), m[0])
      : h(`span.cx-${m[3][0].toLowerCase() === 't' ? 'trust' : 'rep'}`, {}, icon(m[3][0].toLowerCase() === 't' ? 'assists' : 'star'), m[0]));
  }
  out.push(t.slice(at)); return out;
}
/** what a week is, for the colour that says so: race, test, sponsor, market, review */
export const kindOf = (w) => (w.kind === 'race' ? 'race' : w.kind === 'market' ? 'market' : w.kind === 'end' ? 'review' : w.event.kind);
export const zero = () => ({ engine: 0, tyres: 0, brakes: 0 });
export const available = () => Object.fromEntries(Object.values(TRACKS).map((t) => [t.id, t.times ?? null]));
export const teamName = (id) => loreOf(id).name;

/** the save in memory (game.career), written through after every change; the free-play level follows the Career Level (5.2) */
export function persist(game) {
  saveCareer(game.career);
  if ((store.data.playerLevel ?? 1) < game.career.career.cl) { store.data.playerLevel = game.career.career.cl; store.save(); }
}
/** the player as Session sees a driver (the HUD tower, results rows): his name on his team */
export const playerDriver = (save, team) => ({ name: save.player.name, code: save.player.code, nation: save.player.nation, number: save.player.number, team: loreOf(team) });

/** a screen's frame. Returns its parts; the screen fills them. tabs: the hub's tab row sits under the status bar */
export function frame(cls, tabs = null) {
  const bg = h('img.cx-bg', { alt: '', decoding: 'async' }), where = h('div.cx-where'), me = h('div.cx-me'), page = h('div.cx-page'), foot = h('div.cx-foot');
  const el = h(`div.screen.hidden.cx.${cls}`, {}, bg, h('div.cx-scrim'), h('div.cx-top', {}, h('i.logo'), where, me), tabs, page, foot);
  return { el, bg, where, me, page, foot, sec(name) { el.dataset.sec = name; }, title(title, sub) { fill(where, h('strong', {}, title), sub ? h('small', {}, sub) : null); }, backdrop(kind, id) { if (id) bg.src = still(kind, id); } };
}
/** the status bar's right side: who you are, in numbers */
export function statusBar(me, save) {
  const c = save.contract;
  const K = save.career, prev = xpForLevel(K.cl), next = xpForLevel(K.cl + 1), level = cs('xp', 'Level', String(K.cl));
  level.append(css(h('i.sx-bar', {}, h('i')), { '--p': K.cl >= 25 ? 1 : Math.max(0, Math.min(1, (K.xp - prev) / (next - prev))) }));   // the way to the next one, under it
  fill(me, c ? h('span.cx-team', {}, teamLogo(loreOf(c.team)), stat(`${c.seat} seat`, carName(c.car))) : stat('Driver', save.player.name),
    level, cs('rep', 'Reputation', String(Math.round(K.rep)), '/ 1000'), c ? cs('trust', 'Trust', String(c.trust), '/ 100') : null, cs('coin', 'Wallet', Math.round(save.wallet.coins).toLocaleString('en')));
}
/** the footer's left: the prompts */
export const prompts = (...list) => list.map(([k, p, l]) => prompt(k, p, l));
export const SELECT = [['arrow-left', 'arrow-up', 'arrow-down', 'arrow-right'], 'dpad', 'Select'], CHOOSE = ['Enter', 'a', 'Choose'];

const SHORT = { india: 'Ghat', drylake: 'Lake', infinia: 'Infinia', marina: 'Marina', shajawa: 'Bowl', tokyo: 'Tokyo', llano: 'Llano' };
const WEEK_LABEL = (save, w) => (w.kind === 'race' ? `R${w.round + 1} ${save.season.calendar[w.round].finale ? 'Finale' : SHORT[save.season.calendar[w.round].track] ?? ''}` : w.kind === 'market' ? 'Market' : w.kind === 'end' ? 'Review' : w.event.kind === 'test' ? 'Test' : 'Sponsor');
const WEEK_ICON = (w) => (w.kind === 'race' ? 'race' : w.kind === 'market' ? 'contract' : w.kind === 'end' ? 'trophy' : EVENT[w.event.kind][1]);
export const kindIcon = WEEK_ICON;
/** a week as words, for the Calendar and the footer */
export const weekTitle = (save, w) => (w.kind === 'race' ? save.season.calendar[w.round].name : w.kind === 'market' ? 'The market' : w.kind === 'end' ? 'Season review' : C.eventName(save, w));
/** the season strip: one cell a week, this week outlined; the same on Home and the Calendar */
export function strip(save) {
  const W = save.season.weeks, now = save.clock.week;
  return css(h('div.cx-b.cx-stripb', {}, h('div.cx-strip', {}, W.map((w, i) => h(`div.cx-wk.k-${kindOf(w)}${i < now ? '.past' : ''}${i === now ? '.now' : i > now ? '.ahead' : ''}`, {}, h('b', {}, `WK ${i + 1}`, i < now ? icon(w.event?.skipped ? 'minus' : 'check', { label: w.event?.skipped ? 'Skipped' : 'Done' }) : null), h('span', {}, icon(WEEK_ICON(w)), h('i', {}, WEEK_LABEL(save, w))))))), { '--weeks': W.length });
}
/** a block's title line */
export const blockHead = (ic, title, right) => h('div.cx-bh', { 'data-ic': ic }, h('span', {}, ic ? h('i.cx-ico', {}, icon(ic)) : null, title), right ? h('span', {}, right) : null);
export const worldName = (save) => CAL.worlds[save.season?.world]?.name;
export const tierCup = (save) => TIERS.tiers[save.season.tier].cup;
/** a sponsor's logo on its own colour; the brand's name if the file is not there */
export function brandMark(id) {
  const B = SPONSORS.brands[id], box = css(h('span.cx-brand'), { '--bg': B.bg });
  box.append(h('img', { src: `/assets/sponsors/logos/${id}.png`, alt: B.name, decoding: 'async', onerror: () => fill(box, h('b', {}, B.name)) }));
  return box;
}

// ---------------------------------------------------------------------------------------------- the press
export const STORY_KICK = { win: 'Race report', podium: 'Race report', down: 'A bad day', duel: 'Teammates', feud: 'The feud', drama: 'The paddock', move: 'The market', social: 'Fan talk', rumor: 'Rumour', fired: 'The seat' };
export const storySource = (s) => ({ drama: 'Paddock Whispers', feud: 'Paddock Whispers', rumor: 'Paddock Whispers', move: 'The Transfer Desk', fired: 'The Transfer Desk', social: 'The Feed' }[s.kind] ?? 'Ultrack Wire');
/** a story's picture, never cropped: the whole image over a blurred copy of itself, in a frame that shape. If the file is not there (art not uploaded yet) the circuit's still takes over, then a plain frame */
export function storyPic(save, s, cls = '') {
  const p = storyImage(save, s), track = s.track && still('tracks', s.track), full = p.url ?? track, small = thumbOf(full), big = cls === 'big';
  if (!full) return h(`div.cx-pic${big ? '.big' : ''}`);
  // tiles and bytes take the small copy, and only once they scroll into view; only the front page pays for the full image
  const bg = h('img.bg', { src: small, alt: '', loading: 'lazy', decoding: 'async' });
  const fg = h('img.fg', { src: big ? full : small, alt: '', decoding: big ? 'sync' : 'async', ...(big ? {} : { loading: 'lazy' }), onerror: () => { if (track && fg.getAttribute('src') !== track) { fg.src = track; bg.src = track; } else { fg.remove(); bg.remove(); } } });
  return h(`div.cx-pic${big ? '.big' : ''}`, {}, bg, fg);
}
/** media bytes: a row of headline cards, each opening its story on the media page */
export const mediaBytes = (save, stories, open) => (stories.length ? h('div.cx-bytes', {}, stories.map((s) => h(`button.cx-byte${s.read ? '' : '.new'}`, { 'data-nav': '', onclick: () => open(s.id) }, storyPic(save, s), h('span', {}, h('small', {}, STORY_KICK[s.kind] ?? 'The paddock'), h('b', {}, s.title))))) : null);
