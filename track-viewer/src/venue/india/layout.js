// India's night-lighting layout, pure (track.json in, numbers out; scripts/test-india-lights.mjs checks it): the lap resampled at equal
// arc length, the low fixtures on the barrier faces, and the road map (the lamps' and fixtures' light on the road, its rubber and dust).
// The two hairpins (centreline radius 11-14 m) are tighter than the road's half width: on their inside the barrier is not an offset
// of the centreline, so there the offsets are clamped (no fold) and the fixtures and the band fade out (edgeWeight).
export const FACE = 13.0;        // the barrier's inner face, m from the centreline on both sides (the concrete walls mesh: 13.0-13.1)
const REFLECTOR_CLEAR = 1.2;     // a fixture keeps this far (m) from a retro-reflector plate on the same wall
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The closed centreline as a path: at(s) -> { x, y, z, tx, tz, k } (tangent in xz, k = signed curvature, + turning left), s wraps around the lap.
 *  The last sample runs back to the first. */
export function lapPath(C) {
  const n = C.length, S = [0];
  for (let i = 1; i <= n; i++) S.push(S[i - 1] + Math.hypot(C[i % n][0] - C[i - 1][0], C[i % n][2] - C[i - 1][2]));
  const length = S[n]; let k = 0;
  const pt = (s) => {
    s = ((s % length) + length) % length;
    while (k < n - 1 && S[k + 1] <= s) k++;
    while (k > 0 && S[k] > s) k--;
    const a = C[k], b = C[(k + 1) % n], f = (s - S[k]) / (S[k + 1] - S[k]);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  const tan = (s) => { const q = pt(s + 1.2), r = pt(s - 1.2), tx = q[0] - r[0], tz = q[2] - r[2], l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; };
  const at = (s) => {
    const p = pt(s), [tx, tz] = tan(s), a = tan(s - 3), b = tan(s + 3);
    return { x: p[0], y: p[1], z: p[2], tx, tz, k: ((b[0] - a[0]) * -tz + (b[1] - a[1]) * tx) / 6 };
  };
  return { length, at };
}

/** n equal steps of about ds around the lap, starting `phase` steps in: [{ s, ...at(s) }] */
export function stations(path, ds, phase = 0) {
  const m = Math.max(1, Math.round(path.length / ds)), step = path.length / m;
  return { step, list: Array.from({ length: m }, (_, j) => { const s = (j + phase) * step; return { s, ...path.at(s) }; }) };
}

/** 1 where a wall on this side stands at FACE from the centreline, 0 where the bend is tighter than that (the inside of a hairpin) */
export const edgeWeight = (f, side) => sstep(0.85, 0.62, f.k * side * FACE);

/** A point on one side of the road: side +1 / -1 is the left / right normal, `lat` m out from the centreline (kept short of the centre
 *  of a tight bend). n* points inward (at the road). */
export function sidePoint(f, side, lat) {
  const kk = f.k * side, l = kk > 1e-4 ? Math.min(lat, 0.85 / kk) : lat;
  return { x: f.x - f.tz * side * l, z: f.z + f.tx * side * l, nx: f.tz * side, nz: -f.tx * side };
}

/** The low edge fixtures on both barrier faces: every `pitch` m, off the reflector plates, none inside a hairpin.
 *  -> [{ x, y, z, nx, nz, s, side }] (n = the way the lens faces) */
export function edgeFixtures(track, { pitch = 11.5, height = 0.5, lat = FACE } = {}) {
  const path = lapPath(track.centerline), { list } = stations(path, pitch, 0.5), refl = track.reflectors?.items ?? [], out = [];
  const nearPlate = (x, z) => refl.some((r) => Math.hypot(r[0] - x, r[2] - z) < REFLECTOR_CLEAR);
  for (const side of [1, -1]) for (const st of list) {
    let f = st, p = sidePoint(f, side, lat);
    for (const d of [1.6, -1.6, 3.2, -3.2]) {      // slide off a plate: the first shift that clears them all
      if (!nearPlate(p.x, p.z)) break;
      f = { s: st.s + d, ...path.at(st.s + d) }; p = sidePoint(f, side, lat);
    }
    if (edgeWeight(f, side) < 0.5) continue;
    out.push({ x: p.x, y: f.y + height, z: p.z, nx: p.nx, nz: p.nz, s: f.s, side });
  }
  return out;
}

/** The band's grid: for each side, a column of points every `ds` m along the lap and, across, at each u (m in from the barrier face).
 *  -> { cols, m, rows: [{ x, z, yRoad, u, w, side, j }] } in (side, j, u) order: vertex (side, j, c) is row side * m * cols + j * cols + c,
 *  side 0 the left; w the weight (edgeWeight) the band fades by. */
export function bandGrid(track, { ds = 3, us = [0.04, 0.5, 1.1, 1.9, 3, 4.4, 6.2, 8.4, 11] } = {}) {
  const path = lapPath(track.centerline), { list } = stations(path, ds), rows = [];
  for (const side of [1, -1]) for (const f of list) for (const u of us) { const p = sidePoint(f, side, FACE - u); rows.push({ x: p.x, z: p.z, yRoad: f.y, u, w: edgeWeight(f, side), side, j: f.s }); }
  return { cols: us.length, m: list.length, rows };
}

/** (x, z) -> { lat, y }: the offset across the road (+ left) and the road's centreline height at the nearest point of the lap (1 m
 *  steps), or null more than `reach` m from it */
export function nearestOnLap(track, reach = 20) {
  const { list } = stations(lapPath(track.centerline), 1), g = new Map(), key = (i, j) => i * 100003 + j;
  list.forEach((f, j) => { const k = key(Math.floor(f.x / reach), Math.floor(f.z / reach)); (g.get(k) ?? g.set(k, []).get(k)).push(j); });
  return (x, z) => {
    let best = reach * reach, bj = -1;
    const ci = Math.floor(x / reach), cj = Math.floor(z / reach);
    for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) for (const j of g.get(key(a, b)) ?? []) {
      const d = (x - list[j].x) ** 2 + (z - list[j].z) ** 2; if (d < best) { best = d; bj = j; }
    }
    if (bj < 0) return null;
    const f = list[bj];
    return { lat: -(x - f.x) * f.tz + (z - f.z) * f.tx, y: f.y };
  };
}

// ---- the road map: one lap-long texture over the carriageway, kerbs and edge lines, which the road's own material samples (materials.js):
// the light the street lamps and the edge fixtures throw on it (irradiance: the surface's albedo takes it, so paint stays brighter than
// asphalt), the rubbered racing line and the dust toward the edges

export const LAMP_H = 0.72;       // the pool's effective height, as a share of the lamp's: a road luminaire is shielded, so its pool is tighter than a bare point's
export const LAMP_SHIFT = 4.5;   // a cantilever luminaire throws toward the road: its pool centre sits this far in from the lamp head
const RMAX = 44;                 // a lamp's pool is cut (smoothly) at this radius

/** the street lamps as pools: [{ cx, cz, h, rgb }] (centre on the road side of the head, height over the road under it) */
export function lampPools(track, lamps, shift = LAMP_SHIFT) {
  const C = track.centerline;
  return lamps.map((l) => {
    let bi = 0, bd = Infinity; C.forEach((p, i) => { const d = (p[0] - l.pos[0]) ** 2 + (p[2] - l.pos[2]) ** 2; if (d < bd) { bd = d; bi = i; } });
    const d = Math.sqrt(bd), to = [(C[bi][0] - l.pos[0]) / (d || 1), (C[bi][2] - l.pos[2]) / (d || 1)];
    return { cx: l.pos[0] + to[0] * Math.min(shift, d * 0.75), cz: l.pos[2] + to[1] * Math.min(shift, d * 0.75), h: Math.max(3, (l.pos[1] - C[bi][1]) * LAMP_H), rgb: l.rgb ?? [1, 1, 1] };
  });
}

/** the light of every pool on the ground at (x, z): E = (1 + (r / h)^2)^-1.5 (a point light at height h), cut smoothly at RMAX -> [r, g, b] */
export function lampLight(pools, x, z, out = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  for (const p of pools) {
    const dx = x - p.cx, dz = z - p.cz, r2 = dx * dx + dz * dz;
    if (r2 > RMAX * RMAX) continue;                 // (the road map asks this of ~100k texels: no hypot, no pow)
    const q = 1 + r2 / (p.h * p.h), e = (1 - sstep(0.55 * RMAX, RMAX, Math.sqrt(r2))) / (q * Math.sqrt(q));
    out[0] += e * p.rgb[0]; out[1] += e * p.rgb[1]; out[2] += e * p.rgb[2];
  }
  return out;
}

/** the edge band's falloff u m in from the barrier face (fixtures 0.5 m up the wall, grazing the road): the same law, with the "height" of a grazing lens */
export const EDGE_H = 4;
export const edgeLight = (u) => (1 + (u / EDGE_H) ** 2) ** -1.5 * (1 - sstep(9, 13.5, u));

/** The road map, a world-space grid of `cell` m over every point within `reach` m of the centreline (the lap never runs within 40 m
 *  of itself, so one layer covers it): RGBA bytes, R = sqrt(lamp irradiance / 2) (the pools of lampLight, colour applied by the shader),
 *  G = sqrt(edge band), B = rubber on the racing line, A = dust toward the edges. sqrt: the faint tail of a pool keeps its precision.
 *  The racing line is the curvature smoothed over ~15 m minus over ~45 m (a difference of Gaussians): toward the inside at an apex, out
 *  wide before and after, ~9 m at most. -> { data, w, h, x0, z0, cell, line(s) } (texel (i, j) covers x0 + i * cell, z0 + j * cell) */
export function roadMap(track, pools, { cell = 1, reach = FACE + 6 } = {}) {
  const path = lapPath(track.centerline), { list, step } = stations(path, 1), n = list.length;
  const K = list.map((f) => f.k);
  const blur = (sig) => {
    const r = Math.ceil(3 * sig / step), w = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-(((i - r) * step) ** 2) / (2 * sig * sig))), sw = w.reduce((a, b) => a + b);
    return K.map((_, j) => w.reduce((s, wi, i) => s + wi * K[(j + i - r + n) % n], 0) / sw);
  };
  const near = blur(15), wide = blur(45);
  const line = near.map((k, j) => 9 * Math.tanh((k - wide[j]) * 260));                    // + left (the inside of a left-hander)
  const heavy = near.map((k) => 0.4 + 0.6 * sstep(0.002, 0.012, Math.abs(k)));          // more rubber where the cars turn and brake
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const f of list) { x0 = Math.min(x0, f.x); z0 = Math.min(z0, f.z); x1 = Math.max(x1, f.x); z1 = Math.max(z1, f.z); }
  x0 = Math.floor((x0 - reach - 2) / cell) * cell; z0 = Math.floor((z0 - reach - 2) / cell) * cell;
  const w = Math.ceil((x1 + reach + 2 - x0) / cell) + 1, h = Math.ceil((z1 + reach + 2 - z0) / cell) + 1;
  const best = new Float32Array(w * h).fill(reach * reach), owner = new Int32Array(w * h).fill(-1), lat = new Float32Array(w * h);
  const rc = Math.ceil(reach / cell);
  list.forEach((f, j) => {                                          // nearest station per texel, and the texel's offset across the road there
    const ci = Math.round((f.x - x0) / cell), cj = Math.round((f.z - z0) / cell);
    for (let b = Math.max(0, cj - rc); b <= Math.min(h - 1, cj + rc); b++) for (let a = Math.max(0, ci - rc); a <= Math.min(w - 1, ci + rc); a++) {
      const px = x0 + a * cell - f.x, pz = z0 + b * cell - f.z, d = px * px + pz * pz, i = b * w + a;
      if (d < best[i]) { best[i] = d; owner[i] = j; lat[i] = -px * f.tz + pz * f.tx; }     // the left normal is (-tz, tx)
    }
  });
  const data = new Uint8Array(w * h * 4), rgb = [0, 0, 0];
  for (let i = 0; i < w * h; i++) {
    const j = owner[i]; if (j < 0) continue;
    const f = list[j], l = lat[i], side = l < 0 ? -1 : 1, u = Math.max(0, FACE - Math.abs(l));
    lampLight(pools, x0 + (i % w) * cell, z0 + Math.floor(i / w) * cell, rgb);
    const edge = edgeLight(u) * edgeWeight(f, side), rub = Math.exp(-((l - line[j]) ** 2) / (2 * 1.3 * 1.3)) * heavy[j];
    data[i * 4] = Math.round(255 * Math.sqrt(Math.min(1, rgb[0] / 2)));
    data[i * 4 + 1] = Math.round(255 * Math.sqrt(Math.min(1, edge)));
    data[i * 4 + 2] = Math.round(255 * rub);
    data[i * 4 + 3] = Math.round(255 * sstep(9, 11.8, Math.abs(l)) * (1 - rub));
  }
  return { data, w, h, x0, z0, cell, line: (s) => line[Math.round(((s % path.length) + path.length) % path.length / step) % n] };
}
