// The minimap (hud.js owns it). Two views, M cycles them:
//   radar     heading-up in a round disc, the car low so the road ahead has the room; the zoom eases out with speed
//   overview  the whole circuit north-up on a darker plate, for seeing where the pack is (corner numbers and N at 15 design px:
//             12 px at 1280x720)
// The circuit is baked once into bitmaps (a road at its real width with a dark edge, the pit lane, the start line, sector
// ticks, corner numbers in the overview). A frame is one rotated drawImage, an edge fade and a handful of markers.
import { teamMark } from './ui.js';

const D = 240, OW = 432, OH = 240;            // design size (px on the 1600x900 canvas) of the disc and of the overview plate
const LABEL = 15;                             // design px of the corner numbers and the N: 12 px at the smallest HUD scale of 1280x720
const ZOOMS = [0.64, 0.46, 0.33];             // design px per metre of each radar bitmap, finest first; a frame uses the nearest one above its zoom
const NEAR = 0.62, FAR = 0.3;                 // the radar zoom at a crawl and at speed
const LOW = 0.32;                             // how far below the disc centre the car sits, as a fraction of the radius
const TAU = Math.PI * 2, STORE = 'ultrack.hud.map';
const PAD = 40;                               // metres of margin around the circuit in a bitmap
const ROAD = '#cdd3dd', EDGE = '#05070b', PIT = '#555d6b';
const N_FONT = `700 ${LABEL}px 'Barlow Condensed'`;

const lum = (hex) => { const c = parseInt(hex.slice(1), 16); return 0.2126 * (c >> 16) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const read = () => { try { return localStorage.getItem(STORE) === 'overview' ? 'overview' : 'radar'; } catch { return 'radar'; } };

export class Minimap {
  /** track: track.json; h: ui.js's element builder */
  constructor(track, h) {
    this.c = track.centerline; this.hw = track.halfWidth; this.pit = track.pitLane; this.corners = track.corners ?? []; this.sectors = track.sectors ?? [0];
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of this.c) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    this.b = { x0: x0 - PAD, z0: z0 - PAD, w: x1 - x0 + 2 * PAD, h: z1 - z0 + 2 * PAD };
    this.mode = read(); this.bs = 1; this.baked = null; this.z = NEAR;
    this.el = h('div.map', {}, this.cv = h('canvas'));
    this.g = this.cv.getContext('2d');
    this.size();
  }

  /** s: the HUD's css scale. The canvas backs the disc in device pixels so the road stays crisp; bitmaps rebuild when that changes. */
  fit(s) {
    const bs = Math.min(2, Math.max(1, Math.round(s * (devicePixelRatio || 1) * 4) / 4));
    if (bs !== this.bs) { this.bs = bs; this.baked = null; }
    this.size();
  }

  size() {
    const [w, h] = this.mode === 'overview' ? [OW, OH] : [D, D];
    this.cv.width = Math.round(w * this.bs); this.cv.height = Math.round(h * this.bs);
    this.el.classList.toggle('ov', this.mode === 'overview');
    this.fade = null;
  }

  toggle() {
    this.mode = this.mode === 'radar' ? 'overview' : 'radar';
    try { localStorage.setItem(STORE, this.mode); } catch { /* the choice just is not remembered */ }
    this.size();
  }

  // ---------------------------------------------------------------------------------------------- the baked circuit
  /** a stroked ribbon along pts, its half width per point from hw(i) (quantised, so long runs are one path) */
  ribbon(g, pts, hw, k, extra, color, closed) {
    const n = pts.length, P = (i) => pts[i % n], X = (p) => (p[0] - this.b.x0) * k, Z = (p) => (p[2] - this.b.z0) * k;
    g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
    let w = -1; g.beginPath();
    for (let i = 0; i < (closed ? n + 1 : n); i++) {
      const q = P(i), wi = Math.round(hw(i % n) * 4) / 4;
      if (wi !== w) {                                       // the width changes: stroke what there is and carry on from this point
        if (w >= 0) { g.lineTo(X(q), Z(q)); g.stroke(); g.beginPath(); }
        g.lineWidth = Math.max(1.2, 2 * wi * k * extra[0] + extra[1]); w = wi; g.moveTo(X(q), Z(q));
      } else g.lineTo(X(q), Z(q));
    }
    g.stroke();
  }

  /** one bitmap: z design px per metre, bs device px per design px; `overview` adds corner numbers and fits the plate */
  bakeOne(z, overview) {
    const { c, hw, b, bs } = this, k = z * bs, cv = document.createElement('canvas');
    cv.width = overview ? Math.round(OW * bs) : Math.ceil(b.w * k); cv.height = overview ? Math.round(OH * bs) : Math.ceil(b.h * k);
    const g = cv.getContext('2d'), edge = 1.5 * bs, roadK = overview ? 1.9 : 1;     // the overview road is drawn fatter than true scale so it stays a line
    let ox = 0, oz = 0, kk = k;
    if (overview) {                                                           // centred on the plate
      kk = Math.min((OW - 64) / (b.w - 2 * PAD), (OH - 56) / (b.h - 2 * PAD)) * bs;   // room round the circuit for the corner numbers
      ox = (cv.width - (b.w - 2 * PAD) * kk) / 2 - PAD * kk; oz = (cv.height - (b.h - 2 * PAD) * kk) / 2 - PAD * kk;
      g.translate(ox, oz);
    }
    const mm = overview ? kk : k, sc = (i) => hw[i % hw.length];
    if (this.pit?.polyline) {
      const pw = this.pit.halfWidth ?? 6;
      this.ribbon(g, this.pit.polyline, () => pw * 0.62, mm, [roadK, 2 * edge], EDGE, false);
      this.ribbon(g, this.pit.polyline, () => pw * 0.62, mm, [roadK, 0], PIT, false);
    }
    this.ribbon(g, c, sc, mm, [roadK, 2 * edge], EDGE, true);
    this.ribbon(g, c, sc, mm, [roadK, 0], ROAD, true);
    const X = (p) => (p[0] - b.x0) * mm, Z = (p) => (p[2] - b.z0) * mm;
    const across = (i, half, width, color, dash) => {                         // a line over the road at centreline index i
      const p = c[i % c.length], q = c[(i + 1) % c.length], dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      g.beginPath(); g.moveTo(X(p) + nx * half, Z(p) + nz * half); g.lineTo(X(p) - nx * half, Z(p) - nz * half);
      g.lineCap = 'butt'; g.lineWidth = width; g.strokeStyle = color; g.setLineDash(dash ?? []); g.stroke(); g.setLineDash([]);
    };
    const half = (i) => (hw[i] * roadK + 3.5) * mm;
    for (const i of this.sectors.slice(1)) across(i, half(i), 2.2 * bs, '#0a0d12');          // sector ticks: a dark bar with a white core
    for (const i of this.sectors.slice(1)) across(i, half(i) - 0.5 * bs, 1.1 * bs, '#fff');
    const f = overview ? 4 : 6;                                                // the start line: a chequered strip
    across(0, half(0) + 1.5 * bs, f * bs, '#f4f2ee'); across(0, half(0) + 1.5 * bs, f * bs, '#05070b', [f * bs * 0.5, f * bs * 0.5]);
    if (overview) this.labels(g, mm, X, Z);
    return { cv, k: kk, z, ox, oz };
  }

  /** the overview's corner numbers, on the outside of each turn and never on top of one another */
  labels(g, k, X, Z) {
    const { c } = this, bs = this.bs, placed = [];
    g.font = `700 ${LABEL * bs}px 'Barlow Condensed'`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 3 * bs; g.strokeStyle = 'rgba(5,7,11,0.9)';
    const put = (text, p, nx, nz, off, color) => {
      const x = X(p) + nx * off * bs, y = Z(p) + nz * off * bs;
      if (placed.some(([a, b]) => Math.hypot(a - x, b - y) < 19 * bs)) return;
      placed.push([x, y]); g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y);   // a dark edge: legible over the road too
    };
    for (const co of this.corners) {
      const i = co.apexIdx, p = c[i], a = c[(i - 10 + c.length) % c.length], q = c[(i + 10) % c.length];
      const t1x = p[0] - a[0], t1z = p[2] - a[2], t2x = q[0] - p[0], t2z = q[2] - p[2];
      const turn = Math.sign(t1x * t2z - t1z * t2x) || 1;                      // which way the track bends
      const l = Math.hypot(t1x + t2x, t1z + t2z) || 1, nx = -(t1z + t2z) / l * -turn, nz = (t1x + t2x) / l * -turn;   // out of the bend
      put(co.id.replace(/\D/g, ''), p, nx, nz, 15, '#f4f2ee');
    }
    this.sectors.slice(1).forEach((i, k2) => { const p = c[i], q = c[(i + 1) % c.length], l = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1; put('S' + (k2 + 2), p, -(q[2] - p[2]) / l, (q[0] - p[0]) / l, 16, 'rgba(244,242,238,0.56)'); });
  }

  bake() {
    this.baked = { radar: ZOOMS.map((z) => this.bakeOne(z, false)), overview: this.bakeOne(0, true) };
    this.baked.radar.sort((a, b) => a.z - b.z);               // coarsest first
  }

  // ---------------------------------------------------------------------------------------------- a frame
  marker(g, x, y, col, num, small) {
    const r = small ? 4.6 : 8.2;
    g.beginPath(); g.arc(x, y, r + 1.6, 0, TAU); g.fillStyle = 'rgba(5,7,11,0.86)'; g.fill();
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col; g.fill();
    if (!small) { g.fillStyle = lum(col) > 150 ? '#0b0e14' : '#fff'; g.fillText(num, x, y + 0.6); }
  }

  arrow(g, x, y, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, -12); g.lineTo(8.6, 9); g.lineTo(0, 4.6); g.lineTo(-8.6, 9); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 4.6; g.strokeStyle = 'rgba(5,7,11,0.8)'; g.stroke();
    g.fillStyle = '#e3141b'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#fff'; g.stroke();
    g.restore();
  }

  /** dt seconds; s: Session; field: Field; calm: reduceMotion (a fixed zoom) */
  update(dt, s, field, calm) {
    if (!this.baked) this.bake();
    dt = Math.min(0.1, Math.max(0, dt));
    const g = this.g, bs = this.bs, hero = field.hero, p = hero.root.position, q = hero.root.quaternion, ov = this.mode === 'overview';
    const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);          // the nose, from the render pose: no stepping
    const heading = Math.atan2(fz, fx);
    if (this.th === undefined) this.th = heading;
    else { let d = heading - this.th; d -= Math.round(d / TAU) * TAU; this.th += d * (1 - Math.exp(-dt / 0.09)); }
    const spd = (hero.vehicle?.speed ?? 0) * 3.6, zt = calm ? NEAR : NEAR + (FAR - NEAR) * smooth(70, 250, spd);
    this.z += (zt - this.z) * (1 - Math.exp(-dt / 0.7));
    g.setTransform(bs, 0, 0, bs, 0, 0);
    const W = ov ? OW : D, H = ov ? OH : D;
    g.clearRect(0, 0, W, H);
    g.font = "700 10.5px 'Barlow Condensed'"; g.textAlign = 'center'; g.textBaseline = 'middle';
    const rank = (c) => s.order.indexOf(c) + 1;
    if (ov) {
      const m = this.baked.overview;
      g.drawImage(m.cv, 0, 0, W, H);
      const at = (pos) => [(m.ox + (pos.x - this.b.x0) * m.k) / bs, (m.oz + (pos.z - this.b.z0) * m.k) / bs];
      for (const c of [...field.cars].reverse()) { if (c === hero) continue; const [x, y] = at(c.root.position); this.marker(g, x, y, teamMark(s.driver(c).team), rank(c), false); }
      const [x, y] = at(p); this.arrow(g, x, y, this.th + Math.PI / 2);
      return;
    }
    const R = D / 2, cx = R, cy = R + LOW * R, A = -Math.PI / 2 - this.th, ca = Math.cos(A), sa = Math.sin(A), z = this.z;
    const m = this.baked.radar.find((e) => e.z >= z) ?? this.baked.radar[this.baked.radar.length - 1];
    g.save(); g.translate(cx, cy); g.rotate(A); g.scale(z / m.k, z / m.k);
    g.translate(-(p.x - this.b.x0) * m.k, -(p.z - this.b.z0) * m.k);
    g.drawImage(m.cv, 0, 0); g.restore();
    if (!this.fade) {                                                                      // the road thins into the dark at the rim, never cut off by it
      const f = this.fade = g.createRadialGradient(R, R, R * 0.66, R, R, R * 0.99);
      f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)');
    }
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = this.fade; g.fillRect(0, 0, D, D); g.globalCompositeOperation = 'source-over';
    const lim = R - 11;
    for (const c of [...field.cars].reverse()) {
      if (c === hero) continue;
      const dx = c.root.position.x - p.x, dz = c.root.position.z - p.z;
      let x = cx + (dx * ca - dz * sa) * z, y = cy + (dx * sa + dz * ca) * z;
      const rx = x - R, ry = y - R, d = Math.hypot(rx, ry), out = d > lim;
      if (out) { x = R + rx * lim / d; y = R + ry * lim / d; }                           // beyond the disc: a small pip on the rim, in the right direction
      this.marker(g, x, y, teamMark(s.driver(c).team), rank(c), out);
    }
    this.arrow(g, cx, cy, 0);
    const nx = R + Math.sin(A) * (R - 12), ny = R - Math.cos(A) * (R - 12);                // north, on the rim
    g.font = N_FONT; g.fillStyle = 'rgba(244,242,238,0.74)'; g.fillText('N', nx, ny);
  }
}
