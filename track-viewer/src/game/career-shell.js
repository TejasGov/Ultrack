// What every full-screen career screen shares (docs/career-mode.md section 13): the frame (a still behind a scrim, the status bar, the page, the footer),
// the season strip, and the small formatters. The screens are career-hub.js, career-deals.js and career-ui.js.
import './career.css';
import { h, fill, css, prompt, stat, still, teamLogo } from './ui.js';
import { carName } from './carinfo.js';
import { store } from './store.js';
import { icon } from './icons.js';
import { TRACKS } from '../tracks.js';
import { saveCareer } from './career/save.js';
import * as C from './career/career.js';
import { loreOf, TIERS, CAL, SPONSORS } from './career/rules.js';

export const LOOK = { day: ['Day', 'sun'], dusk: ['Dusk', 'sunset'], bluehour: ['Evening', 'moon-horizon'], night: ['Night', 'moon'] };
export const WX_ICON = { dry: 'sun', damp: 'cloud-drizzle', rain: 'cloud-rain' };
export const MEDAL = ['No medal', 'Bronze', 'Silver', 'Gold'];
export const EVENT = { test: ['Test day', 'time-trial'], sponsor: ['Sponsor day', 'drift'] };
export const coins = (n) => [icon('coin'), Math.round(n).toLocaleString('en')];
export const money = (n) => `${Math.round(n).toLocaleString('en')} U`;
export const signed = (n, d = 0) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n).toFixed(d);
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
  return { el, bg, where, me, page, foot, title(title, sub) { fill(where, h('strong', {}, title), sub ? h('small', {}, sub) : null); }, backdrop(kind, id) { if (id) bg.src = still(kind, id); } };
}
/** the status bar's right side: who you are, in numbers */
export function statusBar(me, save) {
  const c = save.contract;
  fill(me, c ? h('span.cx-team', {}, teamLogo(loreOf(c.team)), stat(`${c.seat} seat`, carName(c.car))) : stat('Driver', save.player.name),
    stat('Level', String(save.career.cl)), stat('Reputation', String(Math.round(save.career.rep)), '/ 1000'), c ? stat('Trust', String(c.trust), '/ 100') : null, stat('Wallet', coins(save.wallet.coins)));
}
/** the footer's left: the prompts */
export const prompts = (...list) => list.map(([k, p, l]) => prompt(k, p, l));
export const SELECT = [['arrow-left', 'arrow-up', 'arrow-down', 'arrow-right'], 'dpad', 'Select'], CHOOSE = ['Enter', 'a', 'Choose'];

const SHORT = { india: 'Ghat', drylake: 'Lake', infinia: 'Infinia', marina: 'Marina', shajawa: 'Bowl', tokyo: 'Tokyo', llano: 'Llano' };
const WEEK_LABEL = (save, w) => (w.kind === 'race' ? `R${w.round + 1} ${save.season.calendar[w.round].finale ? 'Finale' : SHORT[save.season.calendar[w.round].track] ?? ''}` : w.kind === 'market' ? 'Market' : w.kind === 'end' ? 'Review' : w.event.kind === 'test' ? 'Test' : 'Sponsor');
const WEEK_ICON = (w) => (w.kind === 'race' ? 'race' : w.kind === 'market' ? 'contract' : w.kind === 'end' ? 'trophy' : EVENT[w.event.kind][1]);
/** a week as words, for the Calendar and the footer */
export const weekTitle = (save, w) => (w.kind === 'race' ? save.season.calendar[w.round].name : w.kind === 'market' ? 'The market' : w.kind === 'end' ? 'Season review' : C.eventName(save, w));
/** the season strip: one cell a week, this week outlined; the same on Home and the Calendar */
export function strip(save) {
  const W = save.season.weeks, now = save.clock.week;
  return css(h('div.cx-b.cx-stripb', {}, h('div.cx-strip', {}, W.map((w, i) => h(`div.cx-wk${w.kind === 'race' ? '.race' : ''}${i < now ? '.past' : ''}${i === now ? '.now' : ''}`, {}, h('b', {}, `WK ${i + 1}`), h('span', {}, icon(WEEK_ICON(w)), h('i', {}, WEEK_LABEL(save, w))))))), { '--weeks': W.length });
}
/** a block's title line */
export const blockHead = (ic, title, right) => h('div.cx-bh', {}, h('span', {}, ic ? icon(ic) : null, title), right ? h('span', {}, right) : null);
export const worldName = (save) => CAL.worlds[save.season?.world]?.name;
export const tierCup = (save) => TIERS.tiers[save.season.tier].cup;
/** a sponsor's logo on its own colour; the brand's name if the file is not there */
export function brandMark(id) {
  const B = SPONSORS.brands[id], box = css(h('span.cx-brand'), { '--bg': B.bg });
  box.append(h('img', { src: `/assets/sponsors/logos/${id}.png`, alt: B.name, decoding: 'async', onerror: () => fill(box, h('b', {}, B.name)) }));
  return box;
}
