"""Morro Noturno layout plan: a filleted polygon (corner points with their radii and road heights) -> waypoints every 15 m, measured with the same
centripetal Catmull-Rom as career_lib.py. PLAN ONLY: writes ../../track-viewer/docs/career-worlds/morro.json (the concept the build reads) and out/plan/plan.png.
    python plan_layout.py
x east, y north, metres; the lap runs clockwise from the start line, mid-way down the avenue, heading east."""
import json, math
from pathlib import Path
import numpy as np

H = Path(__file__).parent; OUT = H / 'out' / 'plan'; OUT.mkdir(parents=True, exist_ok=True)
# (x, y, fillet radius, road height). The start line is the origin, the first leg heads east.
P = [
    (-120, 0, 0, 0),            # start (on the avenue, under the strings of lights)
    (470, 0, 34, 0),            # T1, a square right off the drag strip
    (500, -250, 90, 0),         # onto the orla, the beach avenue
    (40, -290, 600, 0),         # a long fast kink along the sand
    (-560, -270, 300, 0),
    (-760, -230, 46, 0),        # T4, right, inland
    (-790, 120, 70, 6),         # up the avenue at the foot of the morro
    (-560, 230, 26, 13),        # into the hillside streets
    (-300, 250, 17, 19),        # hairpin
    (-520, 380, 19, 28),        # hairpin
    (-260, 470, 60, 38),
    (60, 530, 220, 46),         # the top road, the city and the bay below
    (430, 500, 60, 46),
    (600, 360, 40, 38),         # down the east flank
    (560, 150, 60, 22),
    (330, 110, 120, 12),        # along the foot of the hill, under the overpass
    (20, 150, 160, 8),
    (-260, 100, 160, 5),
    (-660, 95, 40, 2),          # the last hairpin onto the drag strip
    (-660, 0, 40, 0),
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
(H.parent.parent / 'track-viewer' / 'docs' / 'career-worlds' / 'morro.json').write_text(json.dumps(dict(id='morro', name='Morro Noturno', world=3, lapLength=round(LAP), width=14,
    waypoints=[[round(float(a), 2) for a in p] for p in wp], corners=corners), indent=1), encoding='utf8')
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(10, 9)); sc_ = ax.scatter(CL[:, 0], CL[:, 1], c=CL[:, 2], s=3, cmap='viridis'); plt.colorbar(sc_, label='road height m')
for cn in corners: p = CL[int(cn['at'] / STEP)]; ax.annotate(f"T{cn['n']} r{cn['radius']} {cn['kmh']}", p[:2], fontsize=7)
ax.plot(*CL[0, :2], 'r^'); ax.set_aspect('equal'); ax.grid(alpha=0.3); ax.set_title(f"Morro Noturno {LAP:.0f} m, est {stats['est_lap_s']} s"); fig.savefig(OUT / 'plan.png', dpi=110)
