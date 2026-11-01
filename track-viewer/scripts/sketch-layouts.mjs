// Concept layouts for the career's new tracks: docs/career-worlds/layouts.json -> one SVG plan + elevation per track, a stats
// line per track, and <id>.json (scaled waypoints and corners) as the starting centreline for the Blender build.
// node scripts/sketch-layouts.mjs [--png]   (--png also writes qa/career-worlds/<id>.png and sheet.png through sharp)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const DIR = new URL('../docs/career-worlds/', import.meta.url), STEP = 2;
const { tracks } = JSON.parse(readFileSync(new URL('layouts.json', DIR)));

// centripetal Catmull-Rom through closed 2D waypoints (no cusps or loops on uneven spacing); z rides the same parameter
function spline(pts) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const P = [-1, 0, 1, 2].map((k) => pts[(i + k + n) % n]);
    const kn = [0]; for (let k = 1; k < 4; k++) kn.push(kn[k - 1] + Math.max(1e-6, Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]) ** 0.5));
    for (let s = 0; s < 64; s++) {
      const t = kn[1] + (kn[2] - kn[1]) * s / 64, L = (a, b, p, q) => p.map((v, d) => ((kn[b] - t) * v + (t - kn[a]) * q[d]) / (kn[b] - kn[a]));
      const A1 = L(0, 1, P[0], P[1]), A2 = L(1, 2, P[1], P[2]), A3 = L(2, 3, P[2], P[3]);
      out.push(L(1, 2, L(0, 2, A1, A2), L(1, 3, A2, A3)));
    }
  }
  return out;
}
const lengthOf = (pl) => pl.reduce((s, p, i) => s + Math.hypot(p[0] - pl[(i + 1) % pl.length][0], p[1] - pl[(i + 1) % pl.length][1]), 0);
function resample(pl, step) {   // even spacing along the closed polyline
  const out = []; let carry = 0;
  for (let i = 0; i < pl.length; i++) {
    const a = pl[i], b = pl[(i + 1) % pl.length], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = carry; s < d; s += step) out.push(a.map((v, k) => v + (b[k] - v) * s / d));
    carry = (carry - d) % step; if (carry < 0) carry += step;
  }
  return out;
}

function measure(t) {
  const raw = spline(t.waypoints), k = t.lapTarget / lengthOf(raw);
  const wp = t.waypoints.map(([x, y, z]) => [x * k, y * k, z]), pts = resample(spline(wp), STEP), n = pts.length, lap = n * STEP;
  const head = pts.map((p, i) => Math.atan2(pts[(i + 1) % n][1] - p[1], pts[(i + 1) % n][0] - p[0]));
  const turn = (i) => { let d = head[(i + 1) % n] - head[i]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const W = 5, curv = pts.map((_, i) => { let s = 0; for (let j = -W; j < W; j++) s += turn((i + j + n) % n); return s / (2 * W * STEP); });
  // corners: runs tighter than 250 m radius, same-hand runs closer than 30 m merged, kept if they turn more than 25 degrees
  const runs = []; let cur = null;
  for (let i = 0; i < n; i++) {
    const side = Math.abs(curv[i]) > 1 / 250 ? Math.sign(curv[i]) : 0;
    if (side && cur && cur.side === side && i - cur.end <= 30 / STEP) { cur.end = i; continue; }
    if (side) runs.push(cur = { side, start: i, end: i }); else if (cur && i - cur.end > 30 / STEP) cur = null;
  }
  if (runs.length > 1 && runs[0].start === 0 && runs.at(-1).end === n - 1 && runs[0].side === runs.at(-1).side) runs[0].start = runs.pop().start - n;
  const corners = runs.map((r) => {
    let ang = 0, rmin = Infinity;
    for (let i = r.start; i <= r.end; i++) { const j = (i + n) % n; ang += turn(j); rmin = Math.min(rmin, 1 / Math.abs(curv[j] || 1e-9)); }
    return { at: Math.round((((r.start + r.end) / 2 + n) % n) * STEP), hand: r.side > 0 ? 'L' : 'R', turn: Math.round(Math.abs(ang) * 180 / Math.PI), radius: Math.round(rmin), mid: ((Math.round((r.start + r.end) / 2) % n) + n) % n };
  }).filter((c) => c.turn > 25).sort((a, b) => a.at - b.at);
  let straight = 0, run = 0;
  for (let i = 0; i < 2 * n; i++) { run = Math.abs(curv[i % n]) < 1 / 600 ? run + STEP : 0; straight = Math.max(straight, Math.min(run, lap)); }
  let grade = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 10) % n]; grade = Math.max(grade, Math.abs(b[2] - a[2]) / (10 * STEP)); }
  // clearance: closest approach of two parts of the lap more than 150 m apart along it and at one level (walls between them below ~2 widths)
  let clear = Infinity, where = null;
  for (let i = 0; i < n; i += 2) for (let j = i + 2; j < n; j += 2) {
    const along = Math.min(j - i, n - j + i) * STEP; if (along < 150) continue;
    if (Math.abs(pts[i][2] - pts[j][2]) >= 6) continue;      // a crossing: one leg on a bridge, the other in the tunnel under it
    const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < clear) { clear = d; where = [i * STEP, j * STEP]; }
  }
  const zs = pts.map((p) => p[2]);
  return { t, k, wp, pts, lap, corners, straight: Math.round(straight), grade, clear: Math.round(clear), where, zmin: Math.min(...zs), zmax: Math.max(...zs) };
}

function svg(m) {
  const { t, pts, corners, k } = m, xs = pts.map((p) => p[0]), ys = pts.map((p) => -p[1]);
  const lab = t.labels.map(([x, y, s]) => [x * k, -y * k, s]), u0 = Math.max(1, (Math.max(...xs) - Math.min(...xs)) / 760);
  const pad = 70 * u0, x0 = Math.min(...xs, ...lab.map((l) => l[0])) - pad, x1 = Math.max(...xs, ...lab.map((l) => l[0] + l[2].length * 7.5 * u0)) + pad;
  const y0 = Math.min(...ys, ...lab.map((l) => l[1])) - pad - 80 * u0, y1 = Math.max(...ys, ...lab.map((l) => l[1])) + pad;
  const W = x1 - x0, H = y1 - y0, u = Math.max(1, W / 900), PH = 150 * u, f = (v) => v.toFixed(1);   // u: type and marks grow with the plan
  const d = 'M' + pts.map((p) => f(p[0]) + ' ' + f(-p[1])).join('L') + 'Z';
  const s0 = pts[0], s1 = pts[3], hx = s1[0] - s0[0], hy = -(s1[1] - s0[1]), hl = Math.hypot(hx, hy), nx = -hy / hl, ny = hx / hl, w = t.width;
  const nums = corners.map((c, i) => {
    const p = pts[c.mid], q = pts[(c.mid + 4) % pts.length], tx = q[0] - p[0], ty = -(q[1] - p[1]), tl = Math.hypot(tx, ty) || 1;
    const o = (c.hand === 'L' ? -1 : 1) * (w / 2 + 26 * u), cx = p[0] + (-ty / tl) * -o, cy = -p[1] + (tx / tl) * -o;   // number on the outside of the turn
    return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${15 * u}" fill="#e8442e"/><text x="${f(cx)}" y="${f(cy + 5 * u)}" text-anchor="middle" font-size="${15 * u}" font-weight="700" fill="#fff">${i + 1}</text>`;
  }).join('');
  const zr = Math.max(10, m.zmax - m.zmin), prof = pts.map((p, i) => `${f(x0 + 40 * u + (W - 80 * u) * i / pts.length)} ${f(y1 + PH - 30 * u - (p[2] - m.zmin) / zr * (PH - 60 * u))}`).join('L');
  const bar = Math.round(Math.max(100, W / 6) / 100) * 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${f(W)} ${f(H + PH)}" width="${Math.round(W)}" height="${Math.round(H + PH)}" font-family="Segoe UI, Arial, sans-serif">
<rect x="${f(x0)}" y="${f(y0)}" width="${f(W)}" height="${f(H + PH)}" fill="#f4f1ea"/>
<text x="${f(x0 + 24 * u)}" y="${f(y0 + 38 * u)}" font-size="${28 * u}" font-weight="700" fill="#1d1d1f">${t.name}</text>
<text x="${f(x0 + 24 * u)}" y="${f(y0 + 64 * u)}" font-size="${16 * u}" fill="#555">World ${t.world} · ${(m.lap / 1000).toFixed(2)} km · ${corners.length} corners · longest straight ${m.straight} m · ${t.width} m wide · concept, not final</text>
<path d="${d}" fill="none" stroke="#c9c2b4" stroke-width="${w + 10}" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="#2c2c2e" stroke-width="${w}" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="8 10" opacity=".55"/>
<line x1="${f(s0[0] + nx * w * 0.7)}" y1="${f(-s0[1] + ny * w * 0.7)}" x2="${f(s0[0] - nx * w * 0.7)}" y2="${f(-s0[1] - ny * w * 0.7)}" stroke="#fff" stroke-width="${5 * u}"/>
<path d="M${f(s0[0] + hx / hl * 60)} ${f(-s0[1] + hy / hl * 60)} l${f((-hx / hl * 18 + nx * 9) * u)} ${f((-hy / hl * 18 + ny * 9) * u)} l${f(-nx * 18 * u)} ${f(-ny * 18 * u)}Z" fill="#e8442e"/>
${nums}
${lab.map(([x, y, s]) => `<text x="${f(x)}" y="${f(y)}" font-size="${14 * u}" fill="#3a3a3c" font-style="italic">${s}</text>`).join('')}
<line x1="${f(x1 - pad - bar)}" y1="${f(y1 - 20 * u)}" x2="${f(x1 - pad)}" y2="${f(y1 - 20 * u)}" stroke="#1d1d1f" stroke-width="${3 * u}"/><text x="${f(x1 - pad - bar / 2)}" y="${f(y1 - 28 * u)}" text-anchor="middle" font-size="${13 * u}">${bar} m</text>
<rect x="${f(x0 + 24 * u)}" y="${f(y1)}" width="${f(W - 48 * u)}" height="${PH - 16 * u}" fill="#ebe6db" rx="${6 * u}"/>
<path d="M${prof}" fill="none" stroke="#2c2c2e" stroke-width="${2.5 * u}"/>
<text x="${f(x0 + 40 * u)}" y="${f(y1 + 20 * u)}" font-size="${13 * u}" fill="#555">elevation along the lap from the start line (${m.zmin.toFixed(0)} to ${m.zmax.toFixed(0)} m, max grade ${(m.grade * 100).toFixed(1)} %)</text>
</svg>`;
}

const png = process.argv.includes('--png'), sharp = png ? (await import('sharp')).default : null, QA = new URL('../qa/career-worlds/', import.meta.url);
if (png) mkdirSync(QA, { recursive: true });
const shots = [];
for (const t of tracks) {
  const m = measure(t);
  assert.ok(Math.abs(m.lap - t.lapTarget) < 20, `${t.id}: lap ${m.lap} m vs target ${t.lapTarget}`);
  assert.ok(m.clear > t.width * 2, `${t.id}: two parts of the lap ${m.clear} m apart at ${m.where} m (walls need two widths)`);
  const plan = svg(m);
  writeFileSync(new URL(t.id + '.svg', DIR), plan);
  writeFileSync(new URL(t.id + '.json', DIR), JSON.stringify({ id: t.id, name: t.name, world: t.world, lapLength: m.lap, width: t.width,
    waypoints: m.wp.map((p) => p.map((v) => +v.toFixed(1))), corners: m.corners.map(({ mid, ...c }, i) => ({ n: i + 1, ...c })) }, null, 1));
  console.log(`${t.name}: ${(m.lap / 1000).toFixed(2)} km, ${m.corners.length} corners (${m.corners.map((c) => c.hand + c.turn + '°/r' + c.radius).join(' ')}), longest straight ${m.straight} m, z ${m.zmin.toFixed(0)}..${m.zmax.toFixed(0)} m, max grade ${(m.grade * 100).toFixed(1)} %, closest pass ${m.clear} m`);
  if (png) { const out = new URL(t.id + '.png', QA); await sharp(Buffer.from(plan)).png().toFile(out.pathname.replace(/^\/([A-Za-z]:)/, '$1')); shots.push(out); }
}
if (png) {   // a 2 x 2 sheet of the plans, each fitted into 1000 x 760
  const tiles = await Promise.all(shots.map((u) => sharp(u.pathname.replace(/^\/([A-Za-z]:)/, '$1')).resize(1000, 760, { fit: 'contain', background: '#f4f1ea' }).toBuffer()));
  await sharp({ create: { width: 2000, height: 760 * Math.ceil(tiles.length / 2), channels: 3, background: '#f4f1ea' } })
    .composite(tiles.map((b, i) => ({ input: b, left: (i % 2) * 1000, top: Math.floor(i / 2) * 760 }))).png().toFile(new URL('sheet.png', QA).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
}
