// The instrument cluster (hud.js owns it): a tachometer with a real scale (from the display gearbox: redline, gear), a shift-light
// rail above it, the speed as three fixed digit cells, the gear in its own cell, a nitro bar and the TCS / ABS / ESC tags.
// An electric car has no revs: the dial becomes a power gauge and the gear cell shows D. The static scale is built once per
// car; a frame moves one needle (a transform), a few opacities and, only when they change, three digits.
import { h } from './ui.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const S = (tag, a = {}) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
const CX = 174, CY = 158, R = 136, SWEEP = 240, A0 = -SWEEP / 2, LEDS = 11;
const pt = (a, r) => { const t = a * Math.PI / 180; return [CX + r * Math.sin(t), CY - r * Math.cos(t)]; };
const f1 = (n) => n.toFixed(1);
const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${f1(x0)} ${f1(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** a tag that lights at once and lets go 0.22 s after the assist stops, so a flickering intervention reads as one steady light */
class Tag {
  constructor(el) { this.el = el; this.t = 0; this.on = false; }
  set(active, dt) {
    this.t = active ? 0.22 : Math.max(0, this.t - dt);
    const on = this.t > 0; if (on !== this.on) { this.on = on; this.el.classList.toggle('on', on); }
  }
}

/** What the assists are doing, 0..1 each. The physics' own flags (state.tcsActive / absActive / escActive) win when it publishes them;
    until then they are read off the numbers it exposes: the traction cut and wheelspin, the brake demand against the tyre's room (ABS is
    at work once the pedal asks for within 10% of it, so sooner in a corner), the yaw torque of the stability assist. */
export function assists(v, fieldAssist) {
  const st = v.state, d = v.dbg ?? {}, spec = v.spec ?? {}, speed = v.speed ?? 0;
  const tcs = st.tcsActive ?? (fieldAssist.tcs > 0 && st.drive > 0.3 ? Math.max(smooth(0.03, 0.2, 1 - (d.tc ?? 1)), smooth(0.04, 0.3, v.spinSlip ?? 0)) : 0);
  let abs = st.absActive;
  if (abs === undefined) {
    const k = fieldAssist.absSteer ?? (fieldAssist.tcs >= 0.6 ? 0.7 + 0.15 * (fieldAssist.tcs - 0.6) / 0.4 : 0.4 + 0.3 * (fieldAssist.tcs ?? 0) / 0.6);
    const u = clamp(Math.abs(v.aBody?.z ?? 0) / (9.81 * (spec.grip ?? 1.1)), 0, 1.2), room = Math.sqrt(Math.max(0, 1 - (k * u) ** 2));
    abs = (st.serviceBrake ?? 0) > 0.25 && speed > 8 && v.onGround ? smooth(0.0, 0.06, 0.95 * (st.serviceBrake ?? 0) * (spec.brakeK ?? 1) - 0.9 * room) : 0;
  }
  const esc = st.escActive ?? (fieldAssist.stability > 0.2 && speed > 8 && !(st.drift > 0.4) ? Math.max(smooth(0.5, 1.6, Math.abs(d.stab ?? 0)), smooth(0.35, 1, Math.abs(d.catch ?? 0))) : 0);
  return [tcs, abs, esc];
}

export class Gauge {
  constructor() {
    this.cache = {}; this.deg = NaN; this.f = 0; this.tags = [];
    this.svg = S('svg', { viewBox: '0 0 348 240', class: 'scale' });
    this.el = h('div.gauge', {},
      this.rail = h('div.rail', {}, ...Array.from({ length: LEDS }, () => h('i'))),
      this.dial = h('div.dial', {},
        this.svg, this.sub = h('div.sub'),
        this.needle = h('div.needle', {}, h('i')),
        this.spd = h('div.spd', {}, h('b'), h('b'), h('b')), this.unitEl = h('div.unit'),
        this.gearEl = h('div.gearcell', {}, this.gearTxt = h('span')),
        this.tagBox = h('div.tags', {}, ...['TCS', 'ABS', 'ESC'].map((t) => h('span.tag', {}, t))),
        this.nitro = h('div.nitro', {}, h('span.k', {}, 'NITRO'), h('div.bar', {}, this.nFill = h('i')))));
    this.tags = [...this.tagBox.children].map((e) => new Tag(e));
    this.leds = [...this.rail.children];
  }

  /** the scale for this car: rpm to the next thousand over the redline (a red band over its last 8%), or 0-100 % power for an EV */
  build(gb) {
    const ev = !!gb.ev, key = ev ? 'ev' : gb.red;
    if (this.key === key) return;
    this.key = key; this.ev = ev; this.el.classList.toggle('ev', ev);
    const max = ev ? 100 : Math.ceil(gb.red / 1000), unit = ev ? 20 : 1, redAt = ev ? SWEEP : (gb.red * 0.92) / (max * 1000) * SWEEP;
    this.maxRpm = max * 1000;
    const svg = this.svg; svg.replaceChildren();
    const ring = R + 6, a1 = A0 + SWEEP;
    svg.append(S('path', { d: arc(A0, A0 + redAt, ring), class: 'ring' }));
    if (!ev) svg.append(S('path', { d: arc(A0 + redAt, a1, ring), class: 'redband' }));
    for (let v = 0, n = 0; v <= max + 1e-6; v += unit / 2, n++) {
      const major = n % 2 === 0, a = A0 + SWEEP * v / max, [x0, y0] = pt(a, R - (major ? 14 : 8)), [x1, y1] = pt(a, R + 1), red = !ev && a >= A0 + redAt - 0.01;
      svg.append(S('line', { x1: f1(x0), y1: f1(y0), x2: f1(x1), y2: f1(y1), class: 'tick' + (major ? ' major' : '') + (red ? ' red' : '') }));
      if (major) { const [tx, ty] = pt(a, R - 31), t = S('text', { x: f1(tx), y: f1(ty), class: 'num' + (red ? ' red' : '') }); t.textContent = String(v); svg.append(t); }
    }
    this.sub.textContent = ev ? 'POWER %' : 'RPM × 1000';
    this.needle.firstChild.style.height = `${R + 8 - 88}px`; this.needle.firstChild.style.top = `${-(R + 8)}px`;
    this.deg = NaN; this.f = 0;
  }

  set(el, key, text) { if (this.cache[key] !== text) { this.cache[key] = text; el.textContent = text; } }
  flag(el, key, on) { if (this.cache[key] !== on) { this.cache[key] = on; el.classList.toggle(key, on); } }

  /** o: { dt, hero, gb, grid, mph, calm, assist } */
  update({ dt, hero, gb, grid, mph, calm, assist }) {
    this.build(gb);
    const v = hero.vehicle, st = v.state, ev = this.ev;
    // the dial value, 0..1, followed a little so the needle glides instead of steps
    let target;
    if (ev) {
      const P = v.spec.power, boost = st.nitroOn ? 1.45 : 1;
      target = clamp(Math.min(P * boost, v.spec.mass * 9.81 * 1.4 * Math.abs(v.vForward)) * st.drive * (v.dbg?.tc ?? 1) / P);
    } else target = clamp(gb.rpm / this.maxRpm);
    this.f += (target - this.f) * (1 - Math.exp(-dt / 0.05));
    const deg = A0 + SWEEP * this.f;
    if (!(Math.abs(deg - this.deg) < 0.05)) { this.deg = deg; this.needle.style.transform = `rotate(${deg.toFixed(2)}deg)`; }
    const rr = ev ? 0 : gb.rpm / gb.red;
    this.flag(this.dial, 'redline', !ev && rr > 0.92);
    // shift lights: from 70% of the redline, each lit as its own threshold passes (smoothly), all of them at the shift point
    for (let i = 0; i < LEDS; i++) {
      const at = 0.7 + 0.265 * (i + 0.5) / LEDS, q = ev ? 0 : Math.round(smooth(at - 0.012, at + 0.012, rr) * 12);
      if (this.cache['l' + i] !== q) { this.cache['l' + i] = q; this.leds[i].style.opacity = (0.12 + 0.88 * q / 12).toFixed(2); }
    }
    this.flag(this.rail, 'shift', !ev && rr > 0.95);
    // speed: three fixed cells (Anton's 1 is narrow), leading zeros dimmed; repainted at ~16 Hz, a readout nobody can read at 60
    this.age = (this.age ?? 1) + dt;
    if (this.age > 0.06) {
      this.age = 0;
      const n = Math.min(999, Math.round(v.speed * 3.6 * (mph ? 0.6214 : 1))), s = String(n).padStart(3, '0'), lead = 3 - String(n).length;
      for (let i = 0; i < 3; i++) {
        const el = this.spd.children[i], dim = i < lead || (i < 2 && n === 0);
        this.set(el, 's' + i, s[i]);
        if (this.cache['z' + i] !== dim) { this.cache['z' + i] = dim; el.classList.toggle('z', dim); }
      }
    }
    this.set(this.unitEl, 'unit', mph ? 'MPH' : 'KM/H');
    // gear: neutral while the lights are on, R in reverse, D for an EV; a short pop when it changes
    const g = grid ? 'N' : gb.label;
    if (this.cache.gear !== g) {
      const first = this.cache.gear === undefined; this.cache.gear = g; this.gearTxt.textContent = g;
      if (!first && !calm) this.gearEl.animate([{ transform: 'scale(1.14)' }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.16,1,0.3,1)' });
    }
    this.flag(this.gearEl, 'rev', g === 'R'); this.flag(this.gearEl, 'hot', !ev && rr > 0.95);
    // nitro
    const nq = Math.round(clamp(st.nitroTank) * 100);
    if (this.cache.nit !== nq) { this.cache.nit = nq; this.nFill.style.transform = `scaleX(${nq / 100})`; }
    this.flag(this.nitro, 'on', !!st.nitroOn); this.flag(this.nitro, 'low', nq < 15);
    // assists
    const lv = assists(v, assist);
    this.tags.forEach((t, i) => t.set(lv[i] > 0.5, dt));
    this.flag(this.tagBox.children[0], 'off', !(assist.tcs > 0));
  }
}
