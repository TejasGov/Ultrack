// The in-race HUD, laid out on a 1600x900 canvas and scaled to the window (--s). Four corners and a calm centre:
//   top left      position and lap, the standings (rows glide when the order changes); race only
//   top centre    timing: (lap,) last, current, best, lap progress by sector; drift attack: the drift tile; free drive: nothing
//   bottom left   the minimap (hud-map.js; M switches radar / overview)
//   bottom right  the instruments (hud-gauge.js): tach with shift lights, speed, gear, nitro, TCS / ABS / ESC
// Static markup is built once (icons included); a frame changes only textContent and transforms, and only when a value changes.
// Nothing blinks or breathes: states fade (opacity) or swap (a class on a change). The look: docs/ui-system.md, "Race HUD".
import './hud.css';
import { h, carName, teamMark, prompt } from './ui.js';
import { icon } from './icons.js';
import { fmtTime, store } from './store.js';
import { MODES } from './session.js';
import { Gauge } from './hud-gauge.js';
import { Minimap } from './hud-map.js';

const ROW = 28;
const EMPTY = '—';
/** a time readout whose last three digits sit dimmer: the eye reads m:ss.t, the thousandths only shimmer */
const timeEl = (cls) => { const e = h('div.time.' + cls, {}, h('span'), h('em')); e.head = e.children[0]; e.tail = e.children[1]; return e; };
/** a HUD label: an optional icon and tracked caps */
const label = (name, text, cls = '') => h('span.k' + cls, {}, name ? icon(name) : null, text);

/** the drift timer ring as two half-ring turns (deg) for the time left, f 0..1: each half is clipped to its side and turned back
 *  out of it, so the ring shrinks from 12 o'clock clockwise with transforms only */
export const ringTurns = (f) => { f = Math.min(1, Math.max(0, f)); return [Math.min(f, 0.5) * 360 - 180, Math.max(0, f - 0.5) * 360 - 180]; };
/** a lap delta as the HUD shows it: a true sign (+ or U+2212, never a hyphen) right against the seconds, as results and the garage write it */
const signed = (sign, digits) => (sign === '+' ? '+' : '−') + digits;
/** a message's sub line ("1:31.204  −0.418  +40 U") as parts: a lap delta coloured by its sign, coins with the coin icon, not a U */
export function msgParts(sub) {
  return String(sub).split(/\s{2,}/).filter(Boolean).map((p) => {
    const coin = /^\+([\d,]+) U$/.exec(p);
    if (coin) return { kind: 'coin', text: '+' + coin[1] };
    const d = /^([+−-])\s?(\d+\.\d{3})$/.exec(p);
    if (d) return { kind: d[1] === '+' ? 'dn' : 'up', text: signed(d[1], d[2]) };   // a lap delta: − is faster
    return { kind: '', text: p };
  });
}
const MSG_ICON = { good: 'star', bad: 'invalid' }, MSG_WORD = { Winner: 'trophy', 'Final lap': 'race' };

export class Hud {
  constructor(root, track) {
    this.gauge = new Gauge();
    this.map = new Minimap(track, h);
    const n = track.centerline.length;
    this.sec = (track.sectors ?? [0]).concat(n).map((i) => i / n);               // sector edges as fractions of the lap: [0, .33, .64, 1]
    this.timeLast = timeEl('last'); this.timeCur = timeEl('cur'); this.timeBest = timeEl('best');
    const mapKey = prompt('M', null, 'Map'); mapKey.classList.add('kb-only');      // the map has no pad button
    this.el = h('div.screen.hidden.hud', {},
      this.tl = h('div.grp.tl', {}, this.tower = h('div.tile.tower', {},
        h('div.head', {},
          h('div.blk.posblk', {}, label('position', 'POSITION'), this.pEl = h('div.big', {}, this.pA = h('span'), this.pB = h('small'))),
          h('div.blk.lapblk', {}, label('lap', 'LAP'), h('div.big.lap', {}, this.lapA = h('span'), this.lapB = h('small')))),
        this.standEl = h('div.standings', {}))),
      this.tc = h('div.grp.tc', {},
        this.timingEl = h('div.tile.timing', {},
          h('div.col.lapcol', {}, label('lap', 'LAP'), this.tLap = h('div.time')),
          h('div.col', {}, label(null, 'LAST'), this.timeLast, this.deltaEl = h('div.delta')),
          h('div.col.main', {}, label(null, 'LAP TIME', '.lt'), label('invalid', 'LAP INVALID', '.inv'), this.timeCur),
          h('div.col', {}, label(null, 'BEST'), this.timeBest),
          this.progEl = h('div.prog', {}, ...[0, 1, 2].map((k) => h('div', { style: { flexGrow: this.sec[k + 1] - this.sec[k] } }, h('i'))))),
        this.driftEl = h('div.tile.drift', {},
          h('div.dring', {}, h('div.half.r', {}, this.ringR = h('i')), h('div.half.l', {}, this.ringL = h('i')), this.dClock = h('b')),
          h('div.dmain', {}, label('drift', 'DRIFT SCORE'), this.dTotal = h('div.total')),
          h('div.drec', {}, label('trophy', 'RECORD'), this.dRec = h('div.rec')),
          h('div.chainrow', {}, this.dChain = h('div.chain'), this.dMult = h('div.mult')),
          h('div.chainbar', {}, this.dBar = h('i')))),
      this.tr = h('div.grp.tr', {}, this.fpsEl = h('div.fps')),
      this.bl = h('div.grp.bl', {}, this.map.el),
      this.br = h('div.grp.br', {}, this.gauge.el),
      this.bc = h('div.grp.bc', {}, this.hintEl = h('div.hint', {},
        prompt('WASD', ['ls', 'rt', 'lt'], 'Drive'), prompt('Space', 'a', 'Handbrake'), prompt('Shift', 'x', 'Nitro'), prompt('R', 'y', 'Reset'),
        prompt('C', 'rb', 'Camera'), mapKey, prompt('Esc', 'menu', 'Pause'))),
      this.cc = h('div.grp.cc', {},
        this.lightsEl = h('div.lights', {}, ...[0, 1, 2, 3, 4].map(() => h('i'))),
        this.msgEl = h('div.msg'),
        this.warnEl = h('div.warn', {}, icon('wrong-way'), h('span', {}, 'Wrong way')),
        this.countEl = h('div.count')));
    root.append(this.el);
    this.cache = {};
    this.rows = new Map();
    this.progs = [...this.progEl.children].map((e) => e.firstChild);
    this.fit = () => { const s = Math.max(0.68, Math.min(1.3, Math.min(innerWidth / 1600, innerHeight / 900))); this.el.style.setProperty('--s', s.toFixed(3)); this.map.fit(s); };
    this.fit(); this.map.bake(); addEventListener('resize', this.fit);                // baked now, while the menus still cover the screen
    this.onKey = (e) => { if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && this.el.classList.contains('on')) this.map.toggle(); };
    addEventListener('keydown', this.onKey);
  }

  /** a track switch builds a new Hud: the window listeners would keep this one (and its baked minimap) alive */
  dispose() { removeEventListener('resize', this.fit); removeEventListener('keydown', this.onKey); this.el.remove(); }

  /** a new session: nothing from the last one (lights, a message, the countdown, the lap delta) carries over */
  reset() {
    this.lights(0); this.lapDelta(null); this.topMult = 1;
    this.msgEl.replaceChildren(); this.msgEl.classList.remove('out'); this.msgT = 0;
    this.countEl.className = 'count'; this.countEl.textContent = ''; this.countT = 0;
  }

  set(el, key, text) { if (this.cache[key] !== text) { this.cache[key] = text; el.textContent = text; } }
  /** t: seconds, or null (no time yet: the em dash, in ink-4) */
  setTime(el, key, t) {
    const s = Number.isFinite(t) ? fmtTime(t) : EMPTY;
    if (this.cache[key] !== s) {
      this.cache[key] = s; el.head.textContent = s.length > 3 ? s.slice(0, -3) : s; el.tail.textContent = s.length > 3 ? s.slice(-3) : '';
      el.classList.toggle('empty', s === EMPTY);
    }
  }
  /** toggle class `key` on el, touching the DOM only when the state changes */
  flag(el, key, on) { if (this.cache[key] !== on) { this.cache[key] = on; el.classList.toggle(key, on); } }

  show(on) {
    this.el.classList.toggle('hidden', !on); requestAnimationFrame(() => this.el.classList.toggle('on', on));
    if (on) { this.hintT = 9; this.cache.gone = false; this.hintEl.classList.remove('gone'); }
  }

  message(main, sub = '', cls = '', secs = 2.6) {
    const ico = MSG_WORD[main] ?? MSG_ICON[cls];
    this.msgEl.classList.remove('out');
    this.msgEl.replaceChildren(h('div.strip.' + (cls || 'x'), {},
      h('div.m', {}, ico ? icon(ico) : null, h('span', {}, main)),
      sub ? h('div.s', {}, ...msgParts(sub).map((p) => h('span' + (p.kind ? '.' + p.kind : ''), {}, p.kind === 'coin' ? icon('coin') : null, p.text))) : null));
    this.msgT = secs;
  }

  /** the last lap against your best: stays on the timing tile until the next lap closes; nothing at all when there is none */
  lapDelta(delta, good) {
    const none = delta === null || delta === undefined;
    this.deltaEl.textContent = none ? '' : signed(delta > 0 ? '+' : '−', Math.abs(delta).toFixed(3));
    this.deltaEl.className = 'delta' + (none ? '' : good || delta < 0 ? ' good' : ' bad');
  }

  count(n) { this.countEl.className = 'count in' + (n === 'GO' ? ' go' : ''); this.countEl.textContent = n; this.countT = 0.9; }

  lights(n) { this.lightsEl.classList.toggle('on', n > 0); [...this.lightsEl.children].forEach((e, k) => e.classList.toggle('on', k < n)); }

  /** the standings: one persistent row per car, moved with a transform so a changed order glides. The rank numbers are a static
   *  column over the rows (a number in a moving row ran out of order mid-glide); the row moving up paints over the one it passes */
  standings(s, hero, gaps) {
    const N = s.order.length;
    if (this.standFor !== s) {
      this.standFor = s; this.rows.clear(); this.standEl.style.height = `${ROW * N}px`; this.meRank = -1;
      this.ranks = Array.from({ length: N }, (_, k) => h('span', {}, String(k + 1)));
      this.standEl.replaceChildren(h('div.ranks', {}, ...this.ranks));
      for (const c of s.order) {
        const d = s.driver(c), row = h('div.srow' + (c === hero ? '.me' : ''), { style: { transform: `translateY(${ROW * N}px)` } }, h('i'), h('span.code', {}, d.code), h('span.g'));
        row.style.setProperty('--team', teamMark(d.team));
        row.g = row.children[2]; row.rank = -1; row.gap = '';
        this.standEl.append(row); this.rows.set(c, row);
      }
    }
    gaps.forEach(({ car, gap }, k) => {
      const row = this.rows.get(car); if (!row) return;
      if (row.rank !== k) {
        row.rank = k; row.style.transform = `translateY(${k * ROW}px)`; row.style.zIndex = N - k;
        if (car === hero) { this.ranks[this.meRank]?.classList.remove('me'); this.ranks[k]?.classList.add('me'); this.meRank = k; }
      }
      const g = k === 0 ? 'LEADER' : `+${gap.toFixed(1)}`;
      if (row.gap !== g) { row.gap = g; row.g.textContent = g; row.g.classList.toggle('lead', k === 0); }
    });
  }

  /** per frame. s: Session; field: Field; gb: Gearbox; fps: number */
  update(dt, s, field, gb, fps) {
    const hero = field.hero, S = store.settings, M = MODES[s.mode], calm = !!S.reduceMotion;
    this.flag(this.el, 'calm', calm);
    this.gauge.update({ dt, hero, gb, grid: s.state === 'grid', mph: S.units === 'mph', calm, assist: field.assists ?? {} });
    this.map.update(dt, s, field, calm);
    // position, lap, times; free drive has no clock at all
    const T = s.trk.get(hero), racing = M.laps, timed = s.mode !== 'drift' && s.mode !== 'free';
    this.flag(this.el, 'racing', !!racing); this.flag(this.el, 'timed', timed); this.flag(this.el, 'driftmode', !!s.drift);
    if (racing) {
      this.set(this.pA, 'p', String(s.heroPos)); this.set(this.pB, 'pn', `/${s.order.length}`);
      if (this.lastPos !== undefined && this.lastPos !== s.heroPos && !calm) this.pEl.animate([{ transform: `translateY(${s.heroPos < this.lastPos ? 8 : -8}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(0.22,1,0.36,1)' });
      this.lastPos = s.heroPos;
      const lap = Math.min(s.laps, Math.max(1, T.cross));
      this.set(this.lapA, 'lap', String(lap)); this.set(this.lapB, 'laps', `/${s.laps}`);
      this.standings(s, hero, s.gaps());
    } else if (timed) this.set(this.tLap, 'tlap', String(Math.max(1, T.cross)));
    if (timed) {
      const cur = T.lapStart !== null && s.state !== 'grid' ? s.raceT - T.lapStart : null;
      const best = s.mode === 'trial' ? (store.bestOf(hero.key) ?? T.best) : T.best;
      this.curAge = (this.curAge ?? 0) + dt;
      if (this.curAge > 0.04 || cur === null) { this.curAge = 0; this.setTime(this.timeCur, 'tc', cur); }   // the running time repaints at ~25 Hz
      this.setTime(this.timeLast, 'tl', T.lastLap); this.setTime(this.timeBest, 'tb', best);
      this.flag(this.timingEl, 'nolast', !Number.isFinite(T.lastLap));            // a delta only under a LAST that has a time
      this.flag(this.timingEl, 'inval', s.mode === 'trial' && !T.valid);
      const p = cur === null ? 0 : Math.min(1, Math.max(0, T.idx / s.N)), pq = Math.round(p * 400);
      if (this.cache.prog !== pq) {                                                // three sector bars, each filling as the lap passes through it
        this.cache.prog = pq;
        this.progs.forEach((e, k) => e.style.transform = `scaleX(${Math.min(1, Math.max(0, (p - this.sec[k]) / (this.sec[k + 1] - this.sec[k]))).toFixed(3)})`);
      }
    }
    // drift attack: the score, a ring timer with the seconds, the record, the chain and its multiplier (always shown)
    if (s.drift) {
      const D = s.drift, rec = store.driftOf(hero.key);
      this.set(this.dTotal, 'dt', Math.round(D.score).toLocaleString('en'));
      this.set(this.dClock, 'dc', String(Math.ceil(D.left)));
      const rq = Math.round(D.left / (M.seconds ?? 90) * 240);                     // 1.5° steps
      if (this.cache.ring !== rq) { this.cache.ring = rq; const [a, b] = ringTurns(rq / 240); this.ringR.style.transform = `rotate(${a}deg)`; this.ringL.style.transform = `rotate(${b}deg)`; }
      this.set(this.dRec, 'drec', rec > 0 ? rec.toLocaleString('en') : EMPTY); this.flag(this.dRec, 'empty', !(rec > 0));
      this.set(this.dChain, 'dch', D.chain > 0 ? `+${Math.round(D.chain).toLocaleString('en')}` : 'Drift to chain'); this.flag(this.dChain, 'idle', !(D.chain > 0));
      this.set(this.dMult, 'dm', `×${D.mult.toFixed(1)}`); if (D.mult > (this.topMult ?? 1)) this.topMult = D.mult;   // the results' top multiplier: the session keeps none
      const bw = Math.round((D.mult >= 5 ? 1 : Math.min(1, (D.chainT % 2) / 2)) * (D.chain > 0 ? 100 : 0));
      if (this.cache.bar !== bw) { this.cache.bar = bw; this.dBar.style.transform = `scaleX(${bw / 100})`; }
    }
    // wrong way, messages, countdown, hint
    this.flag(this.warnEl, 'wrong', s.wrong > 1.2);
    if (this.msgT > 0) {
      this.msgT -= dt;
      if (this.msgT <= 0.4 && !this.msgEl.classList.contains('out')) this.msgEl.classList.add('out');
      if (this.msgT <= 0) { this.msgEl.replaceChildren(); this.msgEl.classList.remove('out'); }
    }
    if (this.countT > 0) { this.countT -= dt; if (this.countT <= 0) { this.countEl.className = 'count'; this.countEl.textContent = ''; } else if (this.countT < 0.3) this.countEl.classList.add('out'); }
    if (this.hintT > 0) { this.hintT -= dt; this.flag(this.hintEl, 'gone', this.hintT <= 0); }
    this.set(this.fpsEl, 'fps', S.showFps ? `${Math.round(fps)} FPS` : '');
  }
}

export { carName };
