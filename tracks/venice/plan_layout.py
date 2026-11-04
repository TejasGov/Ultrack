"""Venice layout plan: the user's sketch (source/user_sketch.png) traced to waypoints, measured, drawn over the sketch -> out/plan/layout_plan.png.
Same centripetal Catmull-Rom as career_lib.py and sketch-layouts.mjs, so the numbers hold for the build.   python plan_layout.py [lap_m]"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.colors import TwoSlopeNorm
H = Path(__file__).parent; LAP_T = float(sys.argv[1]) if len(sys.argv) > 1 else 6000.0
# sketch pixels (x, y down) and road height in metres; clockwise on the upper loop, from the start line on the top straight
WP = [(560,213,3),(640,211,3),(760,213,3.2),(880,222,3.6),(1000,240,4.2),(1065,262,4.6),(1105,300,5),(1128,360,5.4),(1140,440,5.8),(1135,510,6.2),(1110,570,6.8),(1060,603,7.4),
      (1000,611,8),(880,606,8.6),(770,606,9),(640,614,9),(520,626,9),(420,640,9),(345,660,9),(305,695,8),(290,760,5),(296,830,2.2),(320,885,0.6),(380,903,0),(500,912,0),(650,915,0),(800,915,0),(950,920,0),
      (1060,915,0),(1130,895,0),(1180,855,0),(1200,805,0),(1190,760,0),(1170,725,0),(1100,712,0),(1000,698,-0.3),(880,692,-0.8),(740,700,-1.4),(600,693,-2.2),(470,690,-3),(360,690,-3),(285,672,-2.6),(235,630,-1.2),
      (200,575,0.2),(182,500,1.3),(190,410,2.2),(208,335,2.8),(245,280,3),(350,236,3),(460,216,3)]
def catmull(pts, per=64):
    n, out = len(pts), []
    for i in range(n):
        P = [pts[(i + k) % n] for k in (-1, 0, 1, 2)]; kn = [0.0]
        for k in range(1, 4): kn.append(kn[-1] + max(1e-6, math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1])) ** 0.5)
        for s in range(per):
            t = kn[1] + (kn[2] - kn[1]) * s / per
            L = lambda a, b, p, q: [((kn[b] - t) * p[d] + (t - kn[a]) * q[d]) / (kn[b] - kn[a]) for d in range(3)]
            A1, A2, A3 = L(0, 1, P[0], P[1]), L(1, 2, P[1], P[2]), L(2, 3, P[2], P[3])
            out.append(L(1, 2, L(0, 2, A1, A2), L(1, 3, A2, A3)))
    return np.array(out)
def resample(pl, step):
    d = np.hypot(*(np.roll(pl[:, :2], -1, 0) - pl[:, :2]).T); c = np.r_[0, np.cumsum(d)]; lap = c[-1]; n = round(lap / step); s = np.arange(n) * lap / n
    return np.c_[[np.interp(s, c, np.r_[pl[:, k], pl[0, k]]) for k in range(3)]].T, lap, lap / n
raw = catmull([(x, -y, z) for x, y, z in WP]); k = LAP_T / np.hypot(*(np.roll(raw[:, :2], -1, 0) - raw[:, :2]).T).sum()
wp = [(x * k, -y * k, z) for x, y, z in WP]; CL, LAP, STEP = resample(catmull(wp), 2.5); N = len(CL)
for _ in range(3): CL[:, 2] = np.mean([np.roll(CL[:, 2], d) for d in range(-6, 7)], 0)     # the build's own grade smoothing
tan = np.roll(CL[:, :2], -1, 0) - np.roll(CL[:, :2], 1, 0); head = np.arctan2(tan[:, 1], tan[:, 0]); dt = (np.roll(head, -1) - head + np.pi) % (2 * np.pi) - np.pi
curv = np.mean([np.roll(dt, d) for d in range(-4, 4)], 0) / STEP; R = 1 / np.maximum(np.abs(curv), 1e-5)
grade = (np.roll(CL[:, 2], -10) - CL[:, 2]) / (10 * STEP)
# corners as sketch-layouts.mjs counts them: runs under 250 m radius, same hand within 30 m merged, more than 25 degrees
runs, cur = [], None
for i in range(N):
    sd = np.sign(curv[i]) if abs(curv[i]) > 1 / 250 else 0
    if sd and cur and cur['s'] == sd and i - cur['e'] <= 30 / STEP: cur['e'] = i; continue
    if sd: cur = dict(s=sd, b=i, e=i); runs.append(cur)
    elif cur and i - cur['e'] > 30 / STEP: cur = None
corners = []
for r in runs:
    ix = np.arange(r['b'], r['e'] + 1); ang = abs(dt[ix].sum()); m = ix[np.argmin(R[ix])]
    if math.degrees(ang) > 25: corners.append(dict(n=len(corners) + 1, at=int(m * STEP), hand='L' if r['s'] > 0 else 'R', turn=round(math.degrees(ang)), radius=round(float(R[ix].min())), i=int(m)))
run = 0; straight = 0
for i in range(2 * N): run = run + STEP if abs(curv[i % N]) < 1 / 600 else 0; straight = max(straight, min(run, LAP))
# the crossing: where the lap meets itself in plan
cross = None
for i in range(0, N, 2):
    a, b = CL[i, :2], CL[(i + 2) % N, :2]
    for j in range(i + 200, N, 2):
        if min(j - i, N - j + i) < 200: continue
        c, e = CL[j, :2], CL[(j + 2) % N, :2]; d1, d2 = b - a, e - c; den = d1[0] * d2[1] - d1[1] * d2[0]
        if abs(den) < 1e-9: continue
        u = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / den; v = ((c[0] - a[0]) * d1[1] - (c[1] - a[1]) * d1[0]) / den
        if 0 <= u <= 1 and 0 <= v <= 1: cross = (i, j, a + d1 * u, math.degrees(math.acos(abs(d1 @ d2) / np.linalg.norm(d1) / np.linalg.norm(d2))))
assert cross, 'the lap never crosses itself'
ci, cj, cp, cang = cross; sep = abs(CL[ci, 2] - CL[cj, 2])
# closest approach at one level, more than 150 m apart along the lap (walls need two widths)
near = (1e9, 0, 0)
for i in range(0, N, 8):
    for j in range(i + 8, N, 8):
        if min(j - i, N - j + i) * STEP < 150 or abs(CL[i, 2] - CL[j, 2]) >= 6: continue
        d = np.hypot(*(CL[i, :2] - CL[j, :2]))
        if d < near[0]: near = (d, i, j)
# how far the centreline strays from the sketched line
im = np.array(Image.open(H / 'source' / 'user_sketch.png').convert('RGB')).astype(int); black = np.argwhere(im.max(2) < 70)[::3][:, ::-1]
pxpts = np.c_[CL[:, 0] / k, -CL[:, 1] / k]; dev = np.array([np.sqrt(((black - p) ** 2).sum(1).min()) for p in pxpts[::6]]) * k
# the tunnel: the low road under roof, where it runs deepest, around the crossing
TW = np.array([i for i in range(N) if CL[i, 2] < -2.4 and i > N / 2]); t0, t1 = TW[0], TW[-1]
stats = dict(lap_m=round(LAP), m_per_sketch_px=round(float(k), 3), corners=[{x: c[x] for x in ('n', 'at', 'hand', 'turn', 'radius')} for c in corners], longest_straight_m=round(straight), tightest_radius_m=round(float(R.min())),
             z_min=round(float(CL[:, 2].min()), 1), z_max=round(float(CL[:, 2].max()), 1), max_grade_pct=round(float(np.abs(grade).max()) * 100, 1),
             crossing=dict(top_at_m=round(ci * STEP), under_at_m=round(cj * STEP), top_z=round(float(CL[ci, 2]), 1), under_z=round(float(CL[cj, 2]), 1), road_to_road_m=round(float(sep), 1), angle_deg=round(cang)),
             tunnel=dict(from_m=round(t0 * STEP), to_m=round(t1 * STEP), length_m=round((t1 - t0) * STEP)), closest_same_level_m=round(float(near[0])),
             sketch_deviation_m=dict(median=round(float(np.median(dev)), 1), max=round(float(dev.max()), 1)), site_m=[round(float(np.ptp(CL[:, 0]))), round(float(np.ptp(CL[:, 1])))])
print(json.dumps(stats, indent=1))
assert LAP <= 6850, 'over the 6.85 km cap'; assert sep >= 8.5, 'the crossing is too tight for a tunnel'; assert near[0] > 32, 'two legs too close for walls'
(H / 'out' / 'plan').mkdir(parents=True, exist_ok=True)
# the concept the Blender build reads (career_lib.py loads it by track id)
(H.parent.parent / 'track-viewer' / 'docs' / 'career-worlds' / 'venice.json').write_text(json.dumps(dict(id='venice', name='Venice', lapLength=round(LAP), width=15, sketchScale=float(k), crossing=stats['crossing'],
    waypoints=[[round(float(a), 2) for a in p] for p in wp], corners=stats['corners']), indent=1), encoding='utf8')

# ---- the sheet: the plan over the sketch, then the height profile
INK, MUTED = '#1d1d1f', '#6b6b70'
fig = plt.figure(figsize=(13, 13.2), dpi=110, facecolor='white'); gs = fig.add_gridspec(2, 1, height_ratios=[3.3, 1], hspace=0.14); ax = fig.add_subplot(gs[0]); ax.imshow(Image.open(H / 'source' / 'user_sketch.png'), alpha=0.45)
seg = np.stack([pxpts, np.roll(pxpts, -1, 0)], 1)
lc = LineCollection(seg, cmap='RdBu_r', norm=TwoSlopeNorm(0, CL[:, 2].min(), CL[:, 2].max()), linewidths=5.5, capstyle='round', zorder=3); lc.set_array(CL[:, 2]); ax.add_collection(lc)
ax.plot(*pxpts[t0:t1 + 1].T, color='white', lw=1.6, ls=(0, (3, 3)), zorder=4)
for sm in range(200, int(LAP), 1000):
    i = int(sm / STEP); ax.annotate('', xy=pxpts[(i + 14) % N], xytext=pxpts[i], arrowprops=dict(arrowstyle='-|>', color=INK, lw=1.6, mutation_scale=18), zorder=5)
n0 = np.array([-(pxpts[3, 1] - pxpts[0, 1]), pxpts[3, 0] - pxpts[0, 0]]); n0 = n0 / np.linalg.norm(n0) * 16; ax.plot(*np.c_[pxpts[0] - n0, pxpts[0] + n0], color=INK, lw=4, zorder=6)
ax.text(pxpts[0, 0], pxpts[0, 1] + 38, 'START / FINISH', ha='center', fontsize=10, fontweight='bold', color=INK)
for c in corners:
    i = c['i']; sgn = 1 if c['hand'] == 'L' else -1; tx, ty = pxpts[(i + 3) % N] - pxpts[i]; l = math.hypot(tx, ty); p = {3: (258, 765), 7: (272, 612)}.get(c['n'], pxpts[i] + np.array([-ty, tx]) / l * 25 * sgn)
    ax.text(*p, str(c['n']), ha='center', va='center', fontsize=9.5, color='white', fontweight='bold', bbox=dict(boxstyle='circle,pad=0.25', fc=INK, ec='none'), zorder=7)
cpx = np.array([cp[0] / k, -cp[1] / k]); ax.annotate(f"Crossing\n{sep:.0f} m road to road\n{cang:.0f} deg", xy=cpx, xytext=(40, 640), fontsize=10.5, color=INK, arrowprops=dict(arrowstyle='-', color=INK, lw=1), zorder=8)
ax.text(690, 655, 'Upper deck: the straight at its highest', ha='center', fontsize=10.5, color=INK, fontweight='bold', zorder=8); ax.text(650, 745, f'Road falls into the tunnel ({(t1 - t0) * STEP:.0f} m, dashed)', ha='center', fontsize=10.5, color=INK, fontweight='bold', zorder=8)
for t, x, y in (('HQ', 390, 130), ('Lake', 780, 460), ('Garden', 390, 410), ('Palazzi', 830, 145), ('Palazzi', 1125, 215), ('Palazzi', 1245, 440), ('Stand', 598, 165), ('Stand', 140, 360), ('Stand', 1250, 825), ('Stand', 555, 965), ('Lower-loop infield: not in the sketch', 745, 815)):
    ax.text(x, y, t, ha='center', va='center', fontsize=10, color=INK, style='italic' if 'infield' in t else 'normal', zorder=8)
ax.set_xlim(0, im.shape[1]); ax.set_ylim(im.shape[0], 0); ax.axis('off'); bar = 500 / k; ax.plot([1000, 1000 + bar], [1030, 1030], color=INK, lw=3); ax.text(1000 + bar / 2, 1016, '500 m', ha='center', fontsize=10, color=INK)
ax.set_title(f"Venice layout plan: {LAP / 1000:.2f} km, {len(corners)} corners. Colour is road height: red raised, blue lowered", loc='left', fontsize=13, fontweight='bold', color=INK)
pr = fig.add_subplot(gs[1]); s = np.arange(N) * STEP / 1000; pr.axhline(0, color='#d4d4d8', lw=1); pr.plot(s, CL[:, 2], color=INK, lw=2)
pr.axvspan(t0 * STEP / 1000, t1 * STEP / 1000, color='#e5e7eb', zorder=0); pr.text((t0 + t1) / 2 * STEP / 1000, CL[:, 2].max() * .78, 'Tunnel', ha='center', fontsize=10, color=INK)
pr.plot([ci * STEP / 1000, cj * STEP / 1000], [CL[ci, 2], CL[cj, 2]], 'o', color=INK, ms=8, mec='white', mew=2, zorder=5)
pr.annotate('Over the tunnel', (ci * STEP / 1000, CL[ci, 2]), (ci * STEP / 1000 - .05, CL[ci, 2] + 1.5), ha='center', fontsize=10, color=INK); pr.annotate('Under the deck', (cj * STEP / 1000, CL[cj, 2]), (cj * STEP / 1000 + .34, CL[cj, 2] - .4), ha='center', fontsize=10, color=INK)
pr.set_xlim(0, LAP / 1000); pr.set_ylim(CL[:, 2].min() - 3.5, CL[:, 2].max() + 3.5); pr.set_xlabel('Distance from the start line (km)', color=MUTED); pr.set_ylabel('Road height over ground (m)', color=MUTED)
pr.set_title(f"Height along the lap: {CL[:, 2].min():.0f} to +{CL[:, 2].max():.0f} m, steepest {abs(grade).max() * 100:.1f} %", loc='left', fontsize=12, color=INK)
for sp in ('top', 'right'): pr.spines[sp].set_visible(False)
for sp in ('left', 'bottom'): pr.spines[sp].set_color('#d4d4d8')
pr.tick_params(colors=MUTED); pr.grid(axis='y', color='#f0f0f2', lw=1)
fig.savefig(H / 'out' / 'plan' / 'layout_plan.png', bbox_inches='tight')
