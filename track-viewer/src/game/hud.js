// The in-race HUD, laid out on a 1600x900 canvas and scaled to the window (--s). Four corners and a calm centre:
//   top left      position and lap, the standings (rows glide when the order changes)
//   top centre    timing: last, current, best, lap progress by sector (drift attack: the drift score instead)
//   bottom left   the minimap (hud-map.js; M switches radar / overview)
//   bottom right  the instruments (hud-gauge.js): tach with shift lights, speed, gear, nitro, TCS / ABS / ESC
// Text is only rewritten when it changes, motion is transform/opacity only, and nothing blinks: warnings breathe.
import './hud.css';
import { h, carName, teamMark } from './ui.js';
import { fmtTime, store } from './store.js';
import { MODES } from './session.js';
import { Gauge } from './hud-gauge.js';
import { Minimap } from './hud-map.js';

const ROW = 28;
/** a time readout whose last three digits sit dimmer: the eye reads m:ss.t, the thousandths only shimmer */
const timeEl = (cls) => { const e = h('div.time.' + cls, {}, h('span'), h('em')); e.head = e.children[0]; e.tail = e.children[1]; return e; };

export class Hud {
  constructor(root, track) {
    this.gauge = new Gauge();
    this.map = new Minimap(track, h);
    const n = track.centerline.length;
    this.sec = (track.sectors ?? [0]).concat(n).map((i) => i / n);               // sector edges as fractions of the lap: [0, .33, .64, 1]
    this.timeLast = timeEl('last'); this.timeCur = timeEl('cur'); this.timeBest = timeEl('best');
    this.el = h('div.screen.hidden.hud', {},
      this.tl = h('div.grp.tl', {}, this.tower = h('div.tile.tower', {},
        h('div.head', {},
          this.posBlock = h('div.blk.posblk', {}, h('span.k', {}, 'POSITION'), this.pEl = h('div.big', {}, this.pA = h('span'), this.pB = h('small'))),
          h('div.blk.lapblk', {}, h('span.k', {}, 'LAP'), this.lapEl = h('div.big.lap', {}, this.lapA = h('span'), this.lapB = h('small')))),
        this.standEl = h('div.standings', {}))),
      this.tc = h('div.grp.tc', {},
        this.timingEl = h('div.tile.timing', {},
          h('div.col', {}, h('span.k', {}, 'LAST'), this.timeLast, this.deltaEl = h('div.delta')),
          h('div.col.main', {}, h('span.k', {}, 'LAP TIME'), this.timeCur, this.invalidEl = h('div.invalid', {}, 'LAP INVALID')),
          h('div.col', {}, h('span.k', {}, 'BEST'), this.timeBest),
          this.progEl = h('div.prog', {}, ...[0, 1, 2].map((k) => { const e = h('div', { style: { flexGrow: this.sec[k + 1] - this.sec[k] } }, h('i')); return e; }))),
        this.driftEl = h('div.drift', {},
          h('span.k', {}, 'DRIFT SCORE'), this.dTotal = h('div.total'), this.dClock = h('div.clock'),
          h('div.chainrow', {}, this.dChain = h('div.chain'), this.dMult = h('div.mult')),
          h('div.chainbar', {}, this.dBar = h('i')))),
      this.tr = h('div.grp.tr', {}, this.fpsEl = h('div.fps')),
      this.bl = h('div.grp.bl', {}, this.map.el),
      this.br = h('div.grp.br', {}, this.gauge.el),
      this.bc = h('div.grp.bc', {}, this.hintEl = h('div.hint', {}, h('b', {}, 'WASD'), 'drive', h('b', {}, 'SPACE'), 'handbrake', h('b', {}, 'SHIFT'), 'nitro', h('b', {}, 'R'), 'reset', h('b', {}, 'C'), 'camera', h('b', {}, 'M'), 'map', h('b', {}, 'ESC'), 'pause')),
      this.cc = h('div.grp.cc', {},
        this.lightsEl = h('div.lights', {}, ...[0, 1, 2, 3, 4].map(() => h('i'))),
        this.msgEl = h('div.msg'),
        this.warnEl = h('div.warn', {}, 'Wrong way'),
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
    this.lights(0); this.lapDelta(null);
    this.msgEl.replaceChildren(); this.msgEl.classList.remove('out'); this.msgT = 0;
    this.countEl.className = 'count'; this.countEl.textContent = ''; this.countT = 0;
  }

  set(el, key, text) { if (this.cache[key] !== text) { this.cache[key] = text; el.textContent = text; } }
  /** t: seconds, or null (no time yet: an em dash, or 0:00.000 for the running lap) */
  setTime(el, key, t, zero) {
    const s = Number.isFinite(t) ? fmtTime(t) : zero ? '0:00.000' : '—';
    if (this.cache[key] !== s) { this.cache[key] = s; el.head.textContent = s.length > 3 ? s.slice(0, -3) : s; el.tail.textContent = s.length > 3 ? s.slice(-3) : ''; }
  }
  /** toggle class `key` on el, touching the DOM only when the state changes */
  flag(el, key, on) { if (this.cache[key] !== on) { this.cache[key] = on; el.classList.toggle(key, on); } }

  show(on) { this.el.classList.toggle('hidden', !on); requestAnimationFrame(() => this.el.classList.toggle('on', on)); if (on) { this.hintT = 9; this.hintEl.style.opacity = 1; } }

  message(main, sub = '', cls = '', secs = 2.6) {
    this.msgEl.classList.remove('out');
    this.msgEl.replaceChildren(h('div.m.' + (cls || 'x'), {}, main), sub ? h('div.s.' + (cls || 'x'), {}, sub) : '');
    this.msgT = secs;
  }

  /** the last lap against your best: stays on the timing tile until the next lap closes */
  lapDelta(delta, good) {
    const none = delta === null || delta === undefined;
    this.deltaEl.textContent = none ? '' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(3)}`;
    this.deltaEl.className = 'delta' + (none ? '' : good || delta < 0 ? ' good' : ' bad');
  }

  count(n) { this.countEl.className = 'count in' + (n === 'GO' ? ' go' : ''); this.countEl.textContent = n; this.countT = 0.9; }

  lights(n) { this.lightsEl.classList.toggle('on', n > 0); [...this.lightsEl.children].forEach((e, k) => e.classList.toggle('on', k < n)); }

  /** the standings: one persistent row per car, moved with a transform so a changed order glides */
  standings(s, hero, gaps) {
    if (this.standFor !== s) {
      this.standFor = s; this.rows.clear(); this.standEl.replaceChildren(); this.standEl.style.height = `${ROW * s.order.length}px`;
      for (const c of s.order) {
        const d = s.driver(c), row = h('div.srow' + (c === hero ? '.me' : ''), { style: { transform: `translateY(${ROW * s.order.length}px)` } }, h('span.n'), h('i'), h('span.code', {}, d.code), h('span.g'));
        row.style.setProperty('--team', teamMark(d.team));
        row.n = row.children[0]; row.g = row.children[3]; row.rank = -1; row.gap = '';
        this.standEl.append(row); this.rows.set(c, row);
      }
    }
    gaps.forEach(({ car, gap }, k) => {
      const row = this.rows.get(car); if (!row) return;
      if (row.rank !== k) { row.rank = k; row.n.textContent = k + 1; row.style.transform = `translateY(${k * ROW}px)`; }
      const g = k === 0 ? 'LEADER' : `+${gap.toFixed(1)}`;
      if (row.gap !== g) { row.gap = g; row.g.textContent = g; }
    });
  }

  /** per frame. s: Session; field: Field; gb: Gearbox; fps: number */
  update(dt, s, field, gb, fps) {
    const hero = field.hero, S = store.settings, M = MODES[s.mode], calm = !!S.reduceMotion;
    this.flag(this.el, 'calm', calm);
    this.gauge.update({ dt, hero, gb, grid: s.state === 'grid', mph: S.units === 'mph', calm, assist: field.assists ?? {} });
    this.map.update(dt, s, field, calm);
    // position, lap, times
    const T = s.trk.get(hero), racing = M.laps, timed = s.mode !== 'drift';
    this.flag(this.el, 'racing', !!racing); this.flag(this.el, 'timed', timed); this.flag(this.el, 'driftmode', !!s.drift);
    if (racing) {
      this.set(this.pA, 'p', String(s.heroPos)); this.set(this.pB, 'pn', `/${s.order.length}`);
      if (this.lastPos !== undefined && this.lastPos !== s.heroPos && !calm) this.pEl.animate([{ transform: `translateY(${s.heroPos < this.lastPos ? 10 : -10}px)`, opacity: 0.25 }, { transform: 'none', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(0.16,1,0.3,1)' });
      this.lastPos = s.heroPos;
      const lap = Math.min(s.laps, Math.max(1, T.cross));
      this.set(this.lapA, 'lap', String(lap)); this.set(this.lapB, 'laps', `/${s.laps}`);
      this.standings(s, hero, s.gaps());
    } else if (timed) { this.set(this.lapA, 'lap', String(Math.max(1, T.cross))); this.set(this.lapB, 'laps', ''); }
    if (timed) {
      const cur = T.lapStart !== null && s.state !== 'grid' ? s.raceT - T.lapStart : null;
      const best = s.mode === 'trial' || s.mode === 'free' ? (store.bestOf(hero.key) ?? T.best) : T.best;
      this.curAge = (this.curAge ?? 0) + dt;
      if (this.curAge > 0.04 || cur === null) { this.curAge = 0; this.setTime(this.timeCur, 'tc', cur, true); }   // the running time repaints at ~25 Hz
      this.setTime(this.timeLast, 'tl', T.lastLap); this.setTime(this.timeBest, 'tb', best);
      this.flag(this.invalidEl, 'inv', s.mode === 'trial' && !T.valid);
      const p = cur === null ? 0 : Math.min(1, Math.max(0, T.idx / s.N)), pq = Math.round(p * 400);
      if (this.cache.prog !== pq) {                                                // three sector bars, each filling as the lap passes through it
        this.cache.prog = pq;
        this.progs.forEach((e, k) => e.style.transform = `scaleX(${Math.min(1, Math.max(0, (p - this.sec[k]) / (this.sec[k + 1] - this.sec[k]))).toFixed(3)})`);
      }
    }
    // drift attack
    if (s.drift) {
      const D = s.drift;
      this.set(this.dTotal, 'dt', Math.round(D.score).toLocaleString('en'));
      this.set(this.dClock, 'dc', `${Math.ceil(D.left)} S   ·   RECORD ${store.driftOf(hero.key).toLocaleString('en')}`);
      this.set(this.dChain, 'dch', D.chain > 0 ? `+${Math.round(D.chain).toLocaleString('en')}` : 'DRIFT TO CHAIN'); this.flag(this.dChain, 'idle', !(D.chain > 0));
      this.set(this.dMult, 'dm', D.chain > 0 ? `×${D.mult.toFixed(1)}` : '');
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
    if (this.hintT > 0) { this.hintT -= dt; this.hintEl.style.opacity = this.hintT > 1.5 ? 1 : Math.max(0, this.hintT / 1.5).toFixed(2); }
    this.set(this.fpsEl, 'fps', S.showFps ? `${Math.round(fps)} FPS` : '');
  }
}

export { carName };
