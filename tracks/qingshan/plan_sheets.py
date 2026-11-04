"""Draws the plan from plan_layout.py's output: out/plan/layout_plan.png (the trace over the sketch, corners, gaps, grid, pit options, height and speed) and
out/plan/zone_plan.png (what stands where, in the sketch's own colours). Every zone is labelled directly, so nothing depends on colour alone.   python plan_sheets.py"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.patches import Polygon, Circle, Rectangle

H = Path(__file__).parent; OUT = H / 'out' / 'plan'; S = json.loads((OUT / 'stats.json').read_text(encoding='utf8')); Z = np.load(OUT / 'plan_arrays.npz')
CL, PX, V, lake, lake_sk = Z['CL'], Z['pxpts'], Z['V'] * 3.6, Z['lake'], Z['lake_sk']; N = len(CL); LAP = S['lap_m']; STEP = LAP / N; k = S['m_per_sketch_px']; SH = S['shapes']
INK, MUTED, GRID = '#1d1d1f', '#6b6b70', '#e7e7ea'
C = dict(forest='#3f8f4e', lake='#4aa3f0', solar='#3f5fe0', pink='#c95fd8', halls='#c98a10', grey='#6f7787', roof='#b8261b', road='#2a2a2d')
speedmap = LinearSegmentedColormap.from_list('speed', ['#f6c9c3', '#d9685c', '#a51d14', '#5c0c07'])     # one hue, light to dark: magnitude
sketch = Image.open(H / 'source' / 'user-sketch.png'); W_, H_ = sketch.size
def tag(ax, x, y, text, fs=9, c=INK, bg='white', a=.88, **kw): ax.text(x, y, text, fontsize=fs, color=c, ha=kw.pop('ha', 'center'), va='center', zorder=kw.pop('zorder', 9), bbox=dict(boxstyle='round,pad=0.22', fc=bg, ec='none', alpha=a), **kw)

# ---------------------------------------------------------------- sheet 1: trace, corners, gaps, grid, pits, then height and speed as two charts on one distance axis
fig = plt.figure(figsize=(14, 14.2), dpi=110, facecolor='white'); gs = fig.add_gridspec(3, 1, height_ratios=[3.5, .72, .72], hspace=.2); ax = fig.add_subplot(gs[0])
ax.imshow(sketch, alpha=.42, zorder=0); seg = np.stack([PX, np.roll(PX, -1, 0)], 1)
lc = LineCollection(seg, cmap=speedmap, linewidths=5.5, capstyle='round', zorder=3); lc.set_array(V); lc.set_clim(80, 260); ax.add_collection(lc)
for sm in (280, 1300, 2350, 3500, 4380, 5050, 5650):
    i = int(sm / STEP); ax.annotate('', xy=PX[(i + 18) % N], xytext=PX[i], arrowprops=dict(arrowstyle='-|>', color='white', lw=1.4, mutation_scale=15), zorder=6)
# start line and the 8 grid slots, 8 m apart behind it
t = PX[3] - PX[0]; t = t / np.linalg.norm(t); n = np.array([-t[1], t[0]]); sl = PX[0]
ax.plot(*np.c_[sl - n * 13, sl + n * 13], color=INK, lw=3.5, zorder=7)
for q in range(8):
    i = int((LAP - (8 + 8 * q)) / STEP) % N; lat = 3 if q % 2 == 0 else -3; p = PX[i] + np.array([-(PX[i + 1] - PX[i - 1])[1], (PX[i + 1] - PX[i - 1])[0]]) / np.linalg.norm(PX[i + 1] - PX[i - 1]) * lat / k
    ax.plot(*p, 's', ms=2.8, color='white', mec=INK, mew=.5, zorder=7)
tag(ax, sl[0] - 8, sl[1] + 62, 'START: grid of 8, 64 m long,\nall on the straight', 9, fontweight='bold'); ax.plot([sl[0], sl[0]], [sl[1] + 12, sl[1] + 44], color=INK, lw=.7, zorder=7)
# pit options
pit_a = np.array([(1330, 906), (1240, 900), (940, 902), (900, 912)]); ax.plot(*pit_a.T, color=INK, lw=2.2, ls=(0, (3, 2)), zorder=5); tag(ax, 1130, 842, 'Pit option A (recommended): inside, 370 m,\nfacing the main stand across the road', 8.5); ax.plot([1130, 1130], [860, 898], color=INK, lw=.7, zorder=7)
pit_b = np.array([(1440, 915), (1330, 950), (1040, 958), (1010, 948)]); ax.plot(*pit_b.T, color=MUTED, lw=2.2, ls=(0, (1, 2)), zorder=5); tag(ax, 1310, 1040, 'Pit option B: outside, built into the main stand\n(the stand moves another 30 m south)', 8.5, c=MUTED)
# corners
off = {1: (-60, 30), 2: (66, 30), 3: (-66, -16), 4: (52, 44), 5: (-44, 48), 6: (-62, -38), 7: (84, 18), 8: (-68, -38), 9: (72, 74)}
for c in S['corners']:
    p = np.array(c['px'], float); o = off[c['n']]; b = p + o
    ax.plot([p[0], b[0]], [p[1], b[1]], color=INK, lw=.7, zorder=7)
    ax.text(*b, f"{c['n']}", ha='center', va='center', fontsize=9.5, color='white', fontweight='bold', bbox=dict(boxstyle='circle,pad=0.22', fc=INK, ec='none'), zorder=10)
    ax.text(b[0], b[1] + 21 if o[1] > 0 else b[1] - 21, f"{c['hand']} r{c['radius']} · {c['kmh']}", ha='center', va='center', fontsize=7.8, color=INK, zorder=10, bbox=dict(boxstyle='round,pad=0.12', fc='white', ec='none', alpha=.8))
# the tightest gaps between neighbouring legs
for g in S['side_by_side'][:4]:
    a, b = np.array(g['px'][0], float), np.array(g['px'][1], float); ax.annotate('', xy=a, xytext=b, arrowprops=dict(arrowstyle='<->', color=C['forest'], lw=1.6, shrinkA=0, shrinkB=0), zorder=8); m = (a + b) / 2; tag(ax, m[0] + (-32 if 700 < m[0] < 760 and m[1] < 700 else 30), m[1], f"{g['gap_m']:.0f} m", 8.5, c='#23662f', fontweight='bold')
bar = 500 / k; ax.plot([60, 60 + bar], [1030, 1030], color=INK, lw=3, zorder=9); ax.text(60 + bar / 2, 1012, '500 m', ha='center', fontsize=10, color=INK)
ax.set_xlim(0, W_); ax.set_ylim(H_ + 12, 0); ax.axis('off')
cb = fig.colorbar(lc, ax=ax, orientation='horizontal', fraction=.022, pad=.012, aspect=46, shrink=.5); cb.set_label('Estimated speed, km/h (corner labels: hand, radius in m, km/h)', color=MUTED, fontsize=9); cb.outline.set_visible(False); cb.ax.tick_params(colors=MUTED, length=0, labelsize=8.5)
dev = S['sketch_deviation_m']
ax.set_title(f"The sketch at {LAP / 1000:.1f} km: {len(S['corners'])} corners, about {S['est_lap_s']:.0f} s a lap. The road stays within {dev['max']:.0f} m of the line you drew (median {dev['median']:.0f} m)", loc='left', fontsize=13, fontweight='bold', color=INK)
s = np.arange(N) * STEP / 1000
def axes(a, title):
    a.set_title(title, loc='left', fontsize=11.5, color=INK); a.set_xlim(0, LAP / 1000); a.grid(axis='y', color=GRID, lw=.9); a.tick_params(colors=MUTED, length=0, labelsize=9)
    for sp in ('top', 'right', 'left'): a.spines[sp].set_visible(False)
    a.spines['bottom'].set_color('#cfcfd4')
h = fig.add_subplot(gs[1]); axes(h, f"Proposed road height: a {S['z_max']:.0f} m wooded rise, steepest {S['max_grade_pct']:.1f} %. The sketch doesn't show height, so this is my suggestion"); h.plot(s, CL[:, 2], color=INK, lw=2); h.set_ylabel('m', color=MUTED); h.set_ylim(-1.5, 18)
for tx, a_, b_ in (('The stack', 600, 2100), ('Wind farm', 2500, 3300), ('Top straight', 3300, 4050), ('Lake', 4050, 4620), ('Solar and stands', 4750, 5800)): h.text((a_ + b_) / 2000, 16.3, tx, ha='center', fontsize=9, color=MUTED)
sp = fig.add_subplot(gs[2], sharex=h); axes(sp, f"Estimated speed: tops out at {S['top_kmh']} km/h. Model fitted to four measured AI laps, within 3.4 %; the AI's own lap replaces it after the build"); sp.plot(s, V, color=C['roof'], lw=2); sp.set_ylabel('km/h', color=MUTED); sp.set_ylim(60, 290); sp.set_xlabel('Distance from the start line (km)', color=MUTED)
for c in S['corners']:
    sp.text(c['at'] / 1000, c['kmh'] - 17, str(c['n']), ha='center', fontsize=8.5, color=INK, fontweight='bold')
fig.savefig(OUT / 'layout_plan.png', bbox_inches='tight'); plt.close(fig)

# ---------------------------------------------------------------- sheet 2: what stands where
fig, ax = plt.subplots(figsize=(14, 9.6), dpi=110, facecolor='white'); ax.set_facecolor('#f6f7f3')
ToP = lambda a: np.c_[a[:, 0] / k, -a[:, 1] / k]
ax.scatter(*ToP(Z['FARCARD']).T, s=4, color='#a9cfa8', lw=0, zorder=1, label=f"Far cards: {len(Z['FARCARD']):,}"); ax.scatter(*ToP(Z['CLUMP']).T, s=5, color='#6db173', lw=0, zorder=2, label=f"Second belt, low detail, then cards: {len(Z['CLUMP']):,}"); ax.scatter(*ToP(Z['ROWS']).T, s=6, color='#1f6a34', lw=0, zorder=3, label=f"Road-edge trees, three levels of detail: {len(Z['ROWS']):,}")
ax.plot(*np.r_[PX, PX[:1]].T, color=C['road'], lw=3.4, zorder=6, solid_capstyle='round')
ax.add_patch(Polygon(lake, fc=C['lake'], ec='#2a7fc9', lw=1, alpha=.72, zorder=4)); ax.plot(*np.r_[lake_sk, lake_sk[:1]].T, color='#2a7fc9', lw=.9, ls=(0, (2, 2)), zorder=5)
for a, b, c_, d in S['solar_sketch']: ax.add_patch(Rectangle((a, b), c_ - a, d - b, fc='none', ec=C['solar'], lw=.7, ls=(0, (2, 2)), zorder=4))
for a, b, c_, d in S['solar_plan']: ax.add_patch(Rectangle((a, b), c_ - a, d - b, fc=C['solar'], ec='none', alpha=.82, zorder=5))
for n, v in SH['GREY'].items():
    col = C['roof'] if ('Crescent' in n or 'Wing' in n) else C['grey']
    if isinstance(v, dict): ax.add_patch(Circle(v['c'], v['r'], fc='#9fc4d8' if 'funnel' in n else C['grey'], ec=INK, lw=.8, alpha=.95, zorder=5))
    else: ax.add_patch(Polygon(v, fc=col, ec=INK, lw=.8, alpha=.9, zorder=5))
for p in SH['HALLS']: ax.add_patch(Polygon(p, fc=C['halls'], ec=INK, lw=.8, zorder=5))
for p in SH['PINK'].values(): ax.add_patch(Polygon(p, fc=C['pink'], ec=INK, lw=.8, zorder=5))
ROT = S['zones']['turbines']['rotor'] / 2 / k
for n, p in SH['TURB'].items():
    ax.add_patch(Circle(p, ROT, fc=C['pink'], ec=C['pink'], alpha=.16, lw=1, zorder=4)); ax.plot(*p, 'o', ms=6.5, color=C['pink'], mec=INK, mew=.7, zorder=7)
    q = SH['TURB_SK'][n]
    if q != p: ax.plot(*q, 'x', ms=5.5, color=INK, mew=.9, zorder=7)
for x, y, t_ in ((1433, 230, 'Glazed\nrotunda'), (1590, 390, 'Red roof hall\n(crescent, about 40 m tall)'), (1320, 158, 'Red wing'), (1432, 370, 'North\nstand'), (1578, 610, 'Rotunda'), (1566, 742, 'Corner\nstand'), (1245, 990, 'Main stand'), (627, 1000, 'Hall 1'), (772, 1003, 'Hall 2'), (930, 1010, 'Hall 3'), (1000, 395, f"Lake {S['zones']['lake']['plan_ha']} ha\n(dashed: as sketched)"), (1120, 700, f"Solar field: 12 arrays, {S['zones']['solar_total_ha']} ha"), (288, 402, 'Visitor\nhall'), (452, 442, 'Substation'), (700, 280, 'Shed'), (665, 222, 'Wind farm: 5 turbines, 80 m hub, 104 m rotor'), (520, 595, 'Forest strips, 34-58 m'), (610, 760, 'Forest'), (660, 120, 'Forest belt'), (60, 400, 'Forest'), (1180, 555, 'Forest strip, 50 m')):
    tag(ax, x, y, t_, 8.5, a=.78)
sec = {1: 620, 2: 1250, 3: 2350, 4: 2780, 5: 3050, 6: 3650, 7: 4145, 8: 4450, 9: 4950, 10: 5350}
for q, sm in sec.items():
    i = int(sm / STEP); ax.text(*PX[i], f'S{q}', ha='center', va='center', fontsize=8.5, color=INK, fontweight='bold', bbox=dict(boxstyle='round,pad=0.25', fc='white', ec=INK, lw=.9), zorder=10)
i = 0; ax.annotate('', xy=PX[12], xytext=PX[0] + (18, 0), arrowprops=dict(arrowstyle='-|>', color='white', lw=1.6, mutation_scale=16), zorder=9)
bar = 500 / k; ax.plot([1230, 1230 + bar], [1120, 1120], color=INK, lw=3, zorder=9); ax.text(1230 + bar / 2, 1102, '500 m', ha='center', fontsize=10, color=INK, bbox=dict(boxstyle='round,pad=0.15', fc='#f6f7f3', ec='none'), zorder=9)
ax.add_patch(Rectangle((940, 884), 380, 17, fc=C['grey'], ec=INK, lw=.8, zorder=5)); tag(ax, 1130, 892, 'Pit building', 8, a=.0, c='white', fontweight='bold')
t0 = PX[0]; ax.plot([t0[0], t0[0]], [t0[1] - 12, t0[1] + 12], color='white', lw=2.5, zorder=8); tag(ax, t0[0] + 8, t0[1] + 22, 'Start', 8.5, a=.85, fontweight='bold')
ax.plot([], [], 'x', color=INK, ms=5.5, mew=.9, label='Turbine as sketched, moved so the rotors clear each other'); ax.plot([], [], color=C['solar'], lw=.9, ls=(0, (2, 2)), label='Dashed outline: as sketched, trimmed to clear the road')
ax.set_xlim(-140, 1800); ax.set_ylim(1150, -60); ax.set_aspect('equal'); ax.axis('off')
leg = ax.legend(loc='upper center', ncol=3, fontsize=8.5, frameon=False, markerscale=2.2, labelcolor=INK, bbox_to_anchor=(.5, .0))
f = S['forest']; ax.set_title(f"Zones and driver's sections (S1-S10). {f['forest_ha']} ha of forest from about {f['edge_rows'] + f['clump_lod1'] + f['far_cards']:,} instances; every tree real would be {f['naive_if_every_tree_real']['trees']:,}", loc='left', fontsize=13, fontweight='bold', color=INK)
fig.savefig(OUT / 'zone_plan.png', bbox_inches='tight'); plt.close(fig)
