"""Hartwell Wold layout plan: a filleted polygon (corner points with their radii and road heights) -> waypoints every 15 m, measured with the same
centripetal Catmull-Rom as career_lib.py. PLAN ONLY: writes ../../track-viewer/docs/career-worlds/wold.json (the concept the build reads) and out/plan/plan.png.
    python plan_layout.py
x east, y north, metres; the lap runs clockwise from the start line on the wold's top, heading east."""
import json, math
from pathlib import Path
import numpy as np

H = Path(__file__).parent; OUT = H / 'out' / 'plan'; OUT.mkdir(parents=True, exist_ok=True)
# (x, y, fillet radius, road height). The start line is the origin, the first leg heads east.
P = [
    (-200, 0, 0, 42),           # start, on the wold's top: the paddock by the old airfield
    (330, 10, 500, 42),
    (650, 60, 55, 43),          # T1, right over the brow
    (770, -110, 45, 40),        # T2, left: the esses at the airfield's end
    (990, -140, 60, 36),        # T3, right, and down the escarpment
    (1020, -470, 260, 24),      # the long right, the beech hanger on the outside
    (880, -700, 28, 14),        # the hairpin at the foot of the hill
    (480, -760, 320, 10),       # along the river meadows
    (150, -705, 45, 9),         # into the village
    (-330, -725, 120, 8),       # the high street, honey stone both sides
    (-420, -730, 24, 8),        # hard left onto the bridge
    (-430, -960, 40, 10),       # over the river, right up the far side
    (-640, -1120, 150, 24),     # climbing through the park, the manor across the lake
    (-830, -1050, 55, 27),      # the park esses
    (-960, -1130, 55, 29),
    (-1120, -1040, 70, 32),
    (-1100, -620, 260, 38),     # up the west side between drystone walls
    (-950, -230, 70, 44),       # right, onto the top again
    (-620, -40, 160, 43),
]
def fillet(P):
    n, out = len(P), []
    for i in range(n):
        a, b, c = (np.array(P[(i + k) % n][:2], float) for k in (-1, 0, 1)); r = P[i][2]
        u, v = (a - b) / np.linalg.norm(a - b), (c - b) / np.linalg.norm(c - b); th = math.acos(np.clip(u @ v, -1, 1))
        if r <= 0 or th > math.pi - 1e-3: out.append((b, b, b, 0, P[i][3])); continue
        t = r / math.tan(th / 2); p0, p1 = b + u * t, b + v * t; bis = (u + v) / np.linalg.norm(u + v); cen = b + bis * r / math.sin(th / 2)
        assert t < 0.5 * min(np.linalg.norm(a - b), np.linalg.norm(c - b)) + 1e-6, f'corner {i}: radius {r} too big for its legs'
        out.append((p0, p1, cen, r, P[i][3]))
    pts = []
    for i, (p0, p1, cen, r, z) in enumerate(out):
        if r:
            a0, a1 = math.atan2(*(p0 - cen)[::-1]), math.atan2(*(p1 - cen)[::-1]); d = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
            m = max(2, int(abs(d) * r / 2)); pts += [(cen[0] + r * math.cos(a0 + d * k / m), cen[1] + r * math.sin(a0 + d * k / m), z) for k in range(m + 1)]
        else: pts.append((p0[0], p0[1], z))
        q0 = out[(i + 1) % len(out)][0]; L = np.linalg.norm(q0 - p1); m = max(1, int(L / 2))
        z1 = out[(i + 1) % len(out)][4]; pts += [(p1[0] + (q0[0] - p1[0]) * k / m, p1[1] + (q0[1] - p1[1]) * k / m, z + (z1 - z) * k / m) for k in range(1, m)]
    return np.array(pts)
def catmull(pts, per=16):
    n, out = len(pts), []
    for i in range(n):
        Q = [pts[(i + k) % n] for k in (-1, 0, 1, 2)]; kn = [0.0]
        for k in range(1, 4): kn.append(kn[-1] + max(1e-6, math.hypot(Q[k][0] - Q[k - 1][0], Q[k][1] - Q[k - 1][1])) ** 0.5)
        for s in range(per):
            t = kn[1] + (kn[2] - kn[1]) * s / per
            L = lambda a, b, p, q: [((kn[b] - t) * p[d] + (t - kn[a]) * q[d]) / (kn[b] - kn[a]) for d in range(3)]
            A1, A2, A3 = L(0, 1, Q[0], Q[1]), L(1, 2, Q[1], Q[2]), L(2, 3, Q[2], Q[3])
            out.append(L(1, 2, L(0, 2, A1, A2), L(1, 3, A2, A3)))
    return np.array(out)
dense = fillet(P)
d = np.hypot(*(np.roll(dense[:, :2], -1, 0) - dense[:, :2]).T); c = np.r_[0, np.cumsum(d)]; L0 = c[-1]
s = np.arange(0, L0, 15.0); wp = np.c_[[np.interp(s, c, np.r_[dense[:, k], dense[0, k]]) for k in range(3)]].T
CL = catmull(wp.tolist()); seg = np.hypot(*(np.roll(CL[:, :2], -1, 0) - CL[:, :2]).T); LAP = seg.sum(); n = round(LAP / 2.5)
cc = np.r_[0, np.cumsum(seg)]; S = np.arange(n) * LAP / n; CL = np.c_[[np.interp(S, cc, np.r_[CL[:, k], CL[0, k]]) for k in range(3)]].T; STEP = LAP / n
for _ in range(3): CL[:, 2] = np.mean([np.roll(CL[:, 2], q) for q in range(-6, 7)], 0)
tan = np.roll(CL[:, :2], -1, 0) - np.roll(CL[:, :2], 1, 0); head = np.arctan2(tan[:, 1], tan[:, 0]); dt = (np.roll(head, -1) - head + np.pi) % (2 * np.pi) - np.pi
K = np.mean([np.roll(dt, q) for q in range(-4, 4)], 0) / STEP; R = 1 / np.maximum(np.abs(K), 1e-5)
grade = (np.roll(CL[:, 2], -8) - np.roll(CL[:, 2], 8)) / (16 * STEP)
def speed(R, step, alat=26.0, vmax=82.0, acc=11.0, brake=24.0):      # plan_layout.py (Qingshan) calibrated on the measured pars: an estimate only
    v = np.minimum(vmax, np.sqrt(alat * R)); m = len(v)
    for _ in range(2):
        for i in range(2 * m): a, b = i % m, (i + 1) % m; v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * max(0.5, acc * (1 - v[a] / vmax)) * step))
        for i in range(2 * m, 0, -1): a, b = i % m, (i - 1) % m; v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * brake * step))
    return v
V = speed(R, STEP)
corners, i = [], 0
while i < n:
    if R[i] < 250:
        j = i
        while j < n and R[j % n] < 250: j += 1
        m = min(range(i, j), key=lambda q: R[q % n]); turn = abs(sum(dt[i:j]))
        if math.degrees(turn) > 25: corners.append(dict(n=len(corners) + 1, at=int(m * STEP), hand='L' if K[m] > 0 else 'R', turn=round(math.degrees(turn)), radius=round(float(R[m])), kmh=round(float(V[m]) * 3.6)))
        i = j + 4
    else: i += 1
# no two pieces of road closer than 40 m unless they are neighbours along the lap
from scipy.spatial import cKDTree
kd = cKDTree(CL[:, :2]); close = [(a, b) for a, b in kd.query_pairs(40) if min(abs(a - b), n - abs(a - b)) * STEP > 150]
stats = dict(lap_m=round(LAP), est_lap_s=round(float((STEP / V).sum()), 1), top_kmh=round(float(V.max()) * 3.6), tightest_r=round(float(R.min()), 1),
             max_grade=round(float(np.abs(grade).max()) * 100, 1), z=[round(float(CL[:, 2].min()), 1), round(float(CL[:, 2].max()), 1)],
             too_close=sorted({(int(a * STEP), int(b * STEP)) for a, b in close})[:12], corners=corners)
print(json.dumps(stats, indent=None))
(H.parent.parent / 'track-viewer' / 'docs' / 'career-worlds' / 'wold.json').write_text(json.dumps(dict(id='wold', name='Hartwell Wold', world=2, lapLength=round(LAP), width=14,
    waypoints=[[round(float(a), 2) for a in p] for p in wp], corners=corners), indent=1), encoding='utf8')
# the plan as the docs show it (docs/career-worlds/<id>.svg, as Llano's): the built centreline, the corners, the start
def plan_svg(path, title, sub):
    x, y = CL[:, 0], -CL[:, 1]; pad = 140; x0, x1, y0, y1 = x.min() - pad, x.max() + pad, y.min() - pad - 260, y.max() + pad; W, H_ = x1 - x0, y1 - y0
    pts = ''.join(f"{'M' if k == 0 else 'L'}{a:.0f} {b:.0f}" for k, (a, b) in enumerate(zip(x[::4], y[::4]))) + 'Z'
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {y0:.0f} {W:.0f} {H_:.0f}" width="1500" height="{1500 * H_ / W:.0f}" font-family="Segoe UI, Arial, sans-serif">',
           f'<rect x="{x0:.0f}" y="{y0:.0f}" width="{W:.0f}" height="{H_:.0f}" fill="#efe3d0"/>',
           f'<text x="{x0 + 100:.0f}" y="{y0 + 140:.0f}" font-size="{W / 42:.0f}" font-weight="700" fill="#1d1d1f">{title}</text>',
           f'<text x="{x0 + 100:.0f}" y="{y0 + 140 + W / 34:.0f}" font-size="{W / 75:.0f}" fill="#555">{sub}</text>',
           f'<path d="{pts}" fill="none" stroke="#1d1d1f" stroke-width="{W / 160:.0f}" stroke-linejoin="round"/>',
           f'<circle cx="{x[0]:.0f}" cy="{y[0]:.0f}" r="{W / 110:.0f}" fill="#d0342c"/>']
    for cn in corners:
        k = int(cn['at'] / STEP); out.append(f'<text x="{x[k] + W / 90:.0f}" y="{y[k] - W / 90:.0f}" font-size="{W / 55:.0f}" font-weight="700" fill="#d0342c">{cn["n"]}</text>')
    path.write_text('\n'.join(out) + '\n</svg>\n', encoding='utf8')
plan_svg(H.parent.parent / 'track-viewer' / 'docs' / 'career-worlds' / 'wold.svg', 'Hartwell Wold', '5.79 km · 11 corners · clockwise · 8 to 44 m · 14 m wide · day and dusk')
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(10, 9)); sc_ = ax.scatter(CL[:, 0], CL[:, 1], c=CL[:, 2], s=3, cmap='viridis'); plt.colorbar(sc_, label='road height m')
for cn in corners: p = CL[int(cn['at'] / STEP)]; ax.annotate(f"T{cn['n']} r{cn['radius']} {cn['kmh']}", p[:2], fontsize=7)
ax.plot(*CL[0, :2], 'r^'); ax.set_aspect('equal'); ax.grid(alpha=0.3); ax.set_title(f"Hartwell Wold {LAP:.0f} m, est {stats['est_lap_s']} s"); fig.savefig(OUT / 'plan.png', dpi=110)
