// India's night-lighting layout, pure (track.json in, numbers out; scripts/test-india-lights.mjs checks it): the lap resampled at equal
// arc length, the low fixtures on the barrier faces, and the grid of the lit band they throw across the road.
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

// ---- the lit road: one ribbon over the whole carriageway, its vertices carrying the light baked from the street lamps and the edge band

/** columns across the road (m from the centreline, + left): dense toward the barriers, where the edge band falls off fast */
export const LATS = [-12.96, -12.5, -11.9, -11.1, -10, -8.6, -6.8, -4.6, -2.3, 0, 2.3, 4.6, 6.8, 8.6, 10, 11.1, 11.9, 12.5, 12.96];
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
    const r = Math.hypot(x - p.cx, z - p.cz);
    if (r > RMAX) continue;
    const e = (1 + (r / p.h) ** 2) ** -1.5 * (1 - sstep(0.55 * RMAX, RMAX, r));
    out[0] += e * p.rgb[0]; out[1] += e * p.rgb[1]; out[2] += e * p.rgb[2];
  }
  return out;
}

/** the edge band's falloff u m in from the barrier face (fixtures 0.5 m up the wall, grazing the road): the same law, with the "height" of a grazing lens */
export const EDGE_H = 4;
export const edgeLight = (u) => (1 + (u / EDGE_H) ** 2) ** -1.5 * (1 - sstep(9, 13.5, u));

/** the ribbon's grid: a row every `ds` m along the lap, a vertex at each LATS across -> [{ x, z, yRoad, lat, w, s }] (row j, column c at j * LATS.length + c);
 *  w = edgeWeight on that side (1 at the centre) */
export function roadGrid(track, { ds = 2 } = {}) {
  const path = lapPath(track.centerline), { list } = stations(path, ds), rows = [];
  for (const f of list) for (const lat of LATS) {
    const side = lat < 0 ? -1 : 1, p = sidePoint(f, side, Math.abs(lat));
    rows.push({ x: p.x, z: p.z, yRoad: f.y, lat, w: lat === 0 ? 1 : edgeWeight(f, side), s: f.s });
  }
  return { cols: LATS.length, m: list.length, rows };
}
