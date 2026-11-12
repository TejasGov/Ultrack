// A racing line for a track.json that has none (every circuit but Marina ships racingLine all zeros, so the AI drove the centre of the road
// and lost up to half the corner radius a player gets by using the width). Same relaxation as tracks/marina/layout.py racing_line: each point
// moves along its normal toward the midpoint of neighbours a span away, coarse to fine, kept `margin` m inside each edge (2.5: off the kerbs,
// where India's AI spun at 1.5). The finest span is 18 m, not Marina's 9, plus a 10 m smoothing: a finer pass pinched the line where it meets
// the edge (India T10-T11: 15 m of radius on a 43 m corner, a spin at 30 km/h).
const SPANS_M = [54, 27, 18], SMOOTH_M = 10;

/** lateral offset (+ = left of travel, game coords x/z) of an approximate minimum-curvature line */
export function racingLine(centerline, halfWidth, margin = 2.5) {
  const c = centerline, n = c.length, nx = new Float64Array(n), nz = new Float64Array(n), e = new Float64Array(n);
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = c[(i - 1 + n) % n], b = c[(i + 1) % n], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1;
    nx[i] = dz / l; nz[i] = -dx / l;                                  // left of travel, as main.js buildPath
    len += Math.hypot(c[(i + 1) % n][0] - c[i][0], c[(i + 1) % n][2] - c[i][2]);
  }
  const ds = len / n, cx = Float64Array.from(c, (p) => p[0]), cz = Float64Array.from(c, (p) => p[2]);
  const lim = Float64Array.from(c, (_, i) => Math.max(0, (Array.isArray(halfWidth) ? halfWidth[i] : halfWidth) - margin));
  for (const m of SPANS_M) {
    const span = Math.max(1, Math.round(m / ds));
    for (let it = 0; it < 1000; it++) {                               // each span until it settles (a few hundred passes at most)
      let moved = 0;
      for (let i = 0; i < n; i++) {
        let a = i - span, b = i + span; if (a < 0) a += n; if (b >= n) b -= n;
        const mx = (cx[a] + e[a] * nx[a] + cx[b] + e[b] * nx[b]) * 0.5, mz = (cz[a] + e[a] * nz[a] + cz[b] + e[b] * nz[b]) * 0.5;
        const t = Math.max(-lim[i], Math.min(lim[i], (mx - cx[i]) * nx[i] + (mz - cz[i]) * nz[i]));
        moved = Math.max(moved, Math.abs(t - e[i])); e[i] = t;
      }
      if (moved < 1e-4) break;
    }
  }
  const w = Math.round(SMOOTH_M / ds);
  for (let pass = 0; pass < 3 && w > 0; pass++) {
    const f = Float64Array.from(e);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = -w; k <= w; k++) s += f[(i + k + n) % n]; e[i] = Math.max(-lim[i], Math.min(lim[i], s / (2 * w + 1))); }
  }
  return Array.from(e, (v) => Math.round(v * 100) / 100);
}

/** fills track.racingLine in place when it is missing or all zeros; a line the track ships (Marina's) is kept */
export function withRacingLine(track) {
  if (!track?.centerline?.length || track.racingLine?.some((v) => Math.abs(v) > 0.05)) return track;
  track.racingLine = racingLine(track.centerline, track.halfWidth ?? 7.5);
  return track;
}

/**
 * The AI's target speed (m/s) at N samples `p` round the line (THREE.Vector3, `length` m): the corner speed for aLat (m/s2), then braking
 * at aBrk back from every slower sample. Hills count: a crest unloads the tyres (1 + v^2 * y'' / g) and a downhill brakes less (g * grade),
 * so the plan does not carry flat-road speed over India's crest after T8, where the cars spun on the kerbs braking light. Shared by
 * Field.setTrack (src/cars.js) and scripts/physics-harness.mjs.
 */
export function speedProfile(p, length, yawFade, { aLat = 27.5, aBrk = 16, vmax = 78 } = {}) {
  const N = p.length, ds = length / N, G = 9.81, W = 4, k = new Float32Array(N), v = new Float32Array(N), load = new Float32Array(N), grade = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = p[(i - W + N) % N], b = p[i], c = p[(i + W) % N];
    const ab = a.distanceTo(b), bc = b.distanceTo(c), ac = a.distanceTo(c);
    const cross = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    k[i] = 2 * cross / Math.max(1e-6, ab * bc * ac);
    load[i] = (a.y - 2 * b.y + c.y) / (W * ds) ** 2 / G;            // y'' / g: v^2 times this is the load change (crest < 0)
    grade[i] = (c.y - a.y) / Math.max(1e-6, 2 * W * ds);              // + uphill along travel
    const L = (s) => Math.min(1.3, Math.max(0.4, 1 + s * s * load[i]));
    let s = Math.sqrt(aLat / Math.max(k[i], 1e-4)); for (let n = 0; n < 4; n++) s = Math.sqrt(aLat * yawFade(s) * L(s) / Math.max(k[i], 1e-4));   // the layer turns less above 120 km/h: plan with what it gives
    v[i] = Math.min(vmax, s);
  }
  for (let pass = 0; pass < 2; pass++) for (let i = 2 * N - 1; i >= 0; i--) {
    const a = i % N, b = (i + 1) % N, dec = Math.max(4, aBrk * Math.min(1.3, Math.max(0.4, 1 + v[b] ** 2 * load[a])) + G * grade[a]);
    v[a] = Math.min(v[a], Math.sqrt(v[b] ** 2 + 2 * dec * ds));
  }
  return v;
}
