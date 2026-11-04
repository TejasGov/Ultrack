"""Cheongsan Park (internal id qingshan) layout plan: the user's sketch (source/user-sketch.png) traced to waypoints, scaled to 5.8 km, measured. PLAN ONLY: nothing here builds the track.
Same centripetal Catmull-Rom as career_lib.py, so the numbers hold for the build. Writes out/plan/stats.json and ../../track-viewer/docs/career-worlds/qingshan.json; plan_sheets.py draws them.
    python plan_layout.py [lap_m]
The layout was approved by the user on 2026-11-03: re-running rewrites the concept the build reads."""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree

H = Path(__file__).parent; LAP_T = float(sys.argv[1]) if len(sys.argv) > 1 else 5800.0; OUT = H / 'out' / 'plan'; OUT.mkdir(parents=True, exist_ok=True)
HW = 7.5      # 15 m road, as Venice and Infinia
# sketch pixels (x, y down) and proposed road height in m: clockwise on screen, from the start line on the bottom straight, heading west
WP = [(1098,931,0),(900,937,0),(685,942,0),(538,934,.5),(492,920,1),(470,893,1.5),(465,867,2),(475,844,2.5),(496,827,3),(543,814,3.5),(640,808,4.2),(729,802,5),(785,797,5.5),(818,786,6),(835,755,6),(822,722,6.5),(790,708,7),(743,706,7.5),(610,712,8.2),(484,719,9),(365,719,10),(336,707,10.5),(324,678,11),(336,649,11.5),(365,637,12),(429,628,12),(530,635,11.5),(625,641,11),(697,636,10.5),(730,622,10),(744,589,9.5),(730,556,9),(697,542,9),(604,542,9.5),(507,535,10),(432,537,10),(350,538,10.5),(264,536,11),(176,515,12),(158,496,12),(147,464,12.5),(143,400,13.2),(142,340,14),(148,305,14),(170,285,14),(205,281,14),(247,279,14),(294,268,14),(344,243,14),(423,185,14),(463,174,14),(512,168,14),(700,173,11),(900,180,7.5),(1093,186,4),(1196,205,2.5),(1251,231,2),(1301,281,1.5),(1322,331,1),(1323,394,1),(1315,420,1),(1298,442,1),(1259,471,.8),(1215,489,.6),(1104,509,.5),(1020,528,.5),(968,541,.5),(927,550,.3),(906,556,.2),(891,571,.1),(885,592,0),(891,613,0),(906,628,0),(927,634,0),(972,628,0),(1021,616,0),(1150,608,0),(1289,603,0),(1386,618,0),(1443,648,0),(1479,691,0),(1500,750,0),(1497,820,0),(1484,853,0),(1466,874,0),(1430,897,0),(1384,914,0),(1301,925,0),(1200,929,0)]
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
def frame(CL, step):
    tan = np.roll(CL[:, :2], -1, 0) - np.roll(CL[:, :2], 1, 0); head = np.arctan2(tan[:, 1], tan[:, 0]); dt = (np.roll(head, -1) - head + np.pi) % (2 * np.pi) - np.pi
    curv = np.mean([np.roll(dt, d) for d in range(-4, 4)], 0) / step
    return head, dt, curv, 1 / np.maximum(np.abs(curv), 1e-5)
def speed(R, step, alat, vmax=92.0, acc=11.0, brake=24.0):
    """a forward and backward pass: grip limit, power falling with speed, braking. An estimate, calibrated on Llano's measured AI par; the AI's own lap replaces it after the build."""
    v = np.minimum(vmax, np.sqrt(alat * R)); n = len(v)
    for _ in range(2):
        for i in range(2 * n): a, b = i % n, (i + 1) % n; v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * max(0.5, acc * (1 - v[a] / vmax)) * step))
        for i in range(2 * n, 0, -1): a, b = i % n, (i - 1) % n; v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * brake * step))
    return v
def laptime(v, step): return float((step / v).sum())
# calibrate grip and power on the measured AI pars in assets/career/calendar.json
DOCS = H.parent.parent / 'track-viewer' / 'docs' / 'career-worlds'; PAR = {t: v['parLap'] for t, v in json.loads((H.parent.parent / 'assets' / 'career' / 'calendar.json').read_text(encoding='utf8'))['tracks'].items() if v.get('parLap') and (DOCS / f'{t}.json').exists()}
ref = {}
for t in PAR: c_, _, s_ = resample(catmull(json.loads((DOCS / f'{t}.json').read_text(encoding='utf8'))['waypoints']), 2.5); ref[t] = (frame(c_, s_)[3], s_)
fit = lambda a_, v_: np.mean([abs(laptime(speed(r_, s_, a_, vmax=v_), s_) / PAR[t] - 1) for t, (r_, s_) in ref.items()])
ALAT, VMAX = min(((a_, v_) for a_ in np.arange(10, 40, 2.0) for v_ in (70, 76, 82, 88, 94)), key=lambda q: fit(*q)); FIT = {t: [PAR[t], round(laptime(speed(r_, s_, ALAT, vmax=VMAX), s_), 1)] for t, (r_, s_) in ref.items()}

raw = catmull([(x, -y, z) for x, y, z in WP]); k = LAP_T / np.hypot(*(np.roll(raw[:, :2], -1, 0) - raw[:, :2]).T).sum()
wp = [(x * k, -y * k, z) for x, y, z in WP]; CL, LAP, STEP = resample(catmull(wp), 2.5)
# hand wobble out of the plan, so a corner has one radius, not five: smooth along the lap, re-emit a waypoint every 20 m, scale back to the target length
sm = np.c_[ndi.gaussian_filter1d(CL[:, 0], 14 / STEP, mode='wrap'), ndi.gaussian_filter1d(CL[:, 1], 14 / STEP, mode='wrap'), CL[:, 2]][::8]; ratio = LAP_T / np.hypot(*(np.roll(catmull(sm.tolist())[:, :2], -1, 0) - catmull(sm.tolist())[:, :2]).T).sum(); sm[:, :2] *= ratio; k *= ratio
wp = [tuple(p) for p in sm]; CL, LAP, STEP = resample(catmull(wp), 2.5); N = len(CL)
for _ in range(3): CL[:, 2] = np.mean([np.roll(CL[:, 2], d) for d in range(-6, 7)], 0)     # the build's own grade smoothing
head, dt, curv, R = frame(CL, STEP); grade = (np.roll(CL[:, 2], -10) - CL[:, 2]) / (10 * STEP); V = speed(R, STEP, ALAT, vmax=VMAX)
pxpts = np.c_[CL[:, 0] / k, -CL[:, 1] / k]; KD = cKDTree(CL[:, :2]); lapidx = lambda i, j: min(abs(i - j), N - abs(i - j)) * STEP

# corners as sketch-layouts.mjs and Venice count them: runs under 250 m radius, same hand within 30 m merged, more than 25 degrees
runs, cur = [], None
for i in range(N):
    sd = np.sign(curv[i]) if abs(curv[i]) > 1 / 250 else 0
    if sd and cur and cur['s'] == sd and i - cur['e'] <= 30 / STEP: cur['e'] = i; continue
    if sd: cur = dict(s=sd, b=i, e=i); runs.append(cur)
    elif cur and i - cur['e'] > 30 / STEP: cur = None
# the lap is measured from the start line, so a corner that wraps past station 0 can't happen here: the start is mid-straight
im = np.array(Image.open(H / 'source' / 'user-sketch.png').convert('RGB')).astype(int); r_, g_, b_ = im[..., 0], im[..., 1], im[..., 2]
def largest(mask, n=1):
    l, c = ndi.label(ndi.binary_dilation(mask, iterations=3)); s = ndi.sum(mask, l, range(1, c + 1)); keep = np.argsort(s)[::-1][:n] + 1
    return [mask & (l == q) for q in keep]
def outline(mask, reach=7):
    """nearest-neighbour walk round a hand-drawn stroke"""
    pts = np.argwhere(mask)[:, ::-1].astype(float); t = cKDTree(pts); alive = np.ones(len(pts), bool); pos = pts[0]; out = [pos]
    while True:
        alive[t.query_ball_point(pos, reach)] = False; rem = pts[alive]
        if not len(rem): break
        d = ((rem - pos) ** 2).sum(1); j = d.argmin()
        if d[j] > 60 ** 2: break
        pos = rem[j]; out.append(pos)
    return np.array(out)
lake_sk = outline(largest((b_ > 220) & (r_ < 110) & (g_ > 130) & (g_ < 190))[0])
ARM_X = 815.0; ARM_SQ = 0.6      # the arm between the two hairpin tips, narrowed about its own centre (a change the user must approve)
lake = lake_sk.copy(); arm = lake[:, 1] > 520; lake[arm, 0] = ARM_X + (lake[arm, 0] - ARM_X) * ARM_SQ; low = lake[:, 1] > 640; lake[low, 1] = 640 + (lake[low, 1] - 640) * 0.7
def polyarea(p): return abs(np.dot(p[:, 0], np.roll(p[:, 1], 1)) - np.dot(p[:, 1], np.roll(p[:, 0], 1))) / 2
# what the sketch shows, read by hand from it (sketch px), grouped as the user described; none of it is yet a building design
GREY = {'Rotunda A (big, glazed funnel)': dict(c=(1433, 230), r=75), 'Rotunda B': dict(c=(1578, 610), r=37),
    'Wing': [(1227,115),(1337,101),(1417,167),(1373,250),(1327,227)], 'North block / stand': [(1403,290),(1355,443),(1503,450),(1510,390),(1493,283)],
    'Crescent hall (the red roof)': [(1507,247),(1673,287),(1677,390),(1693,677),(1673,697),(1647,603),(1607,547),(1488,507),(1485,457),(1510,400),(1493,283)],
    'Corner stand': [(1510,653),(1613,647),(1617,777),(1612,820),(1527,837),(1533,670)], 'Wedge': [(1617,675),(1673,697),(1693,747),(1647,773),(1612,777)], 'Service lobe': [(1553,833),(1547,867),(1577,889),(1600,880),(1603,850),(1647,777),(1617,777),(1612,820)],
    'Main stand': [(1040,965),(1055,1015),(1180,1033),(1290,1020),(1380,1000),(1425,960),(1440,935),(1425,923),(1300,932),(1200,945),(1050,960)]}
HALLS = [[(580,955),(674,968),(668,1000),(576,1004)], [(722,960),(835,960),(835,1005),(710,1012)], [(876,965),(1002,968),(1000,1015),(863,1018)]]
PINK = {'Visitor hall': [(255,405),(278,362),(320,438),(258,438)], 'Substation': [(434,370),(468,372),(470,405),(460,430),(436,430)], 'Service shed': [(636,262),(662,262),(660,296),(635,298)]}
TURB = dict(A=(323, 470), B=(465, 360), C=(530, 480), D=(610, 385), E=(720, 345)); TURB_SK = dict(A=(323, 485), B=(465, 360), C=(530, 470), D=(577, 418), E=(720, 345))     # sketch tower bases; A, C, D moved
HUB, ROTOR = 80.0, 104.0   # the size of a REpower 3.XM (80 m hub, 104 m rotor)
MOVES = dict(main_stand_south_px=24, halls_south_px=16)
GREY['Main stand'] = [(x, y + MOVES['main_stand_south_px']) for x, y in GREY['Main stand']]; HALLS = [[(x, y + MOVES['halls_south_px']) for x, y in p] for p in HALLS]
sol = (b_ > 200) & (r_ < 100) & (g_ < 120); l_, c_ = ndi.label(ndi.binary_dilation(sol, iterations=6)); SOLAR = [(s[1].start, s[0].start, s[1].stop, s[0].stop) for s in ndi.find_objects(l_) if (s[1].stop - s[1].start) > 25]

SOLAR_SK = list(SOLAR); KDp = cKDTree(pxpts)      # arrays are trimmed on the side facing the road, never moved (moving them stacked them on each other), to 30 m from the centreline
for q, box in enumerate(SOLAR):
    a, b, c, e = map(float, box)
    while True:
        mids = {'t': (a + c, 2 * b), 'b': (a + c, 2 * e), 'l': (2 * a, b + e), 'r': (2 * c, b + e)}; corners_ = np.array([(a, b), (c, b), (c, e), (a, e)])
        if KDp.query(corners_)[0].min() * k >= 30: break
        side = min(mids, key=lambda n: KDp.query(np.array(mids[n]) / 2)[0])
        if side == 't': b += 2
        elif side == 'b': e -= 2
        elif side == 'l': a += 2
        else: c -= 2
    SOLAR[q] = (a, b, c, e)
assert not any(max(p[0], q[0]) < min(p[2], q[2]) and max(p[1], q[1]) < min(p[3], q[3]) for i, p in enumerate(SOLAR) for q in SOLAR[i + 1:]), 'solar arrays overlap'
# ---- corners: numbers, estimated speed, how much straight-on room there is, and what is in the way
def poly_mask(shape, polys, circles=()):
    from PIL import ImageDraw
    img = Image.new('1', shape[::-1]); d = ImageDraw.Draw(img)
    for p in polys: d.polygon([tuple(q) for q in p], fill=1)
    for c, r in circles: d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=1)
    return np.array(img)
PAD = 700; SH = (im.shape[0] + 2 * PAD, im.shape[1] + 2 * PAD); P = lambda pts: [(x + PAD, y + PAD) for x, y in pts]     # raster in sketch px, with room outside the drawing
lake_m = poly_mask(SH, [P(lake)]); bld_polys = [v for v in GREY.values() if isinstance(v, list)]; bld_c = [((v['c'][0] + PAD, v['c'][1] + PAD), v['r']) for v in GREY.values() if isinstance(v, dict)]
bld_m = poly_mask(SH, [P(p) for p in bld_polys + HALLS + list(PINK.values())], bld_c); sol_m = poly_mask(SH, [P([(a, b), (c, b), (c, d), (a, d)]) for a, b, c, d in SOLAR])
hard = lake_m | bld_m
corners = []
for r in runs:
    ix = np.arange(r['b'], r['e'] + 1); ang = abs(dt[ix].sum()); m = ix[np.argmin(R[ix])]
    if math.degrees(ang) <= 25: continue
    tin = r['b']; d = np.array([math.cos(head[tin]), math.sin(head[tin])]); esc, what = None, None     # straight on from the turn-in point: the room a car has that misses the corner
    for s in np.arange(HW, 400, 2.0):
        p = CL[tin, :2] + d * s; px = int(p[0] / k + PAD), int(-p[1] / k + PAD); j = KD.query(p)[1]
        if hard[px[1], px[0]]: esc, what = s, 'lake' if lake_m[px[1], px[0]] else 'building'; break
        if KD.query(p)[0] < HW and lapidx(j, tin) > 80: esc, what = s, 'road'; break
    corners.append(dict(n=len(corners) + 1, at=int(m * STEP), hand='L' if r['s'] > 0 else 'R', turn=round(math.degrees(ang)), radius=round(float(R[ix].min())), kmh=round(float(V[ix].min()) * 3.6), entry_kmh=round(float(V[max(0, r['b'] - 40):r['b'] + 1].max()) * 3.6), straight_on_m=round(esc) if esc else '400+', hits=what, i=int(m), b=int(r['b']), e=int(r['e']), px=[round(float(a)) for a in pxpts[m]]))
# straights: runs of curvature under 1/600
straights = []; run = 0; st = None
for i in range(N * 2):
    if abs(curv[i % N]) < 1 / 600:
        if run == 0: st = i
        run += STEP
    else:
        if run >= 150 and st < N: straights.append(dict(frm=int(st * STEP), len=round(run), v_end=round(float(V[(i - 1) % N]) * 3.6)))
        run = 0
# ---- legs: the road between corner apexes; the distance between every pair that runs side by side
leg = np.searchsorted([c['i'] for c in corners], np.arange(N)) % len(corners)     # leg j ends at corner j + 1
near_ = []
seen = {}
for i in range(0, N, 4):
    for j in KD.query_ball_point(CL[i, :2], 220):
        if j <= i or lapidx(i, j) < 170: continue
        d = float(np.hypot(*(CL[i, :2] - CL[j, :2]))); kk = tuple(sorted((int(leg[i]), int(leg[j]))))
        if kk not in seen or d < seen[kk][0]: seen[kk] = (d, i, j)
for kk, (d, i, j) in sorted(seen.items(), key=lambda q: q[1][0])[:14]:
    near_.append(dict(gap_m=round(d, 1), at_m=[int(i * STEP), int(j * STEP)], px=[[round(float(a)) for a in pxpts[i]], [round(float(a)) for a in pxpts[j]]], clear_each_side=round((d - 2 * HW) / 2, 1), dz=round(abs(float(CL[i, 2] - CL[j, 2])), 1), strip_with_8m_runoff=round(d - 2 * HW - 2 * 8 - 2 * 1, 1)))
# ---- how far the road stays from the lake and each building, and how far the trace strays from the sketched line
def clearance(m):
    d = ndi.distance_transform_edt(~m) * k; q = (pxpts + PAD).astype(int); return d[q[:, 1], q[:, 0]]
cl_lake, cl_sk = clearance(lake_m), clearance(poly_mask(SH, [P(lake_sk)])); cl_bld = clearance(bld_m); cl_sol = clearance(sol_m)
def worst(c, n=3):
    out = []; c2 = c.copy()
    for _ in range(n):
        i = int(c2.argmin()); out.append(dict(m=round(float(c2[i]), 1), at=int(i * STEP), px=[round(float(a)) for a in pxpts[i]])); c2[np.abs((np.arange(N) - i + N // 2) % N - N // 2) < 80 / STEP] = 1e9
    return out
black = np.argwhere(im.max(2) < 70)[::3][:, ::-1]; dev = cKDTree(black).query(pxpts[::4])[0] * k
# ---- areas in plain metres
A = lambda p: round(polyarea(np.array(p)) * k * k)
zones = dict(lake=dict(sketch_ha=round(polyarea(lake_sk) * k * k / 1e4, 1), plan_ha=round(polyarea(lake) * k * k / 1e4, 1)),
    grey={n: (dict(d=round(2 * v['r'] * k)) if isinstance(v, dict) else dict(area=A(v), w=round(np.ptp(np.array(v)[:, 0]) * k), h=round(np.ptp(np.array(v)[:, 1]) * k))) for n, v in GREY.items()},
    halls=[dict(w=round(np.ptp(np.array(p)[:, 0]) * k), d=round(np.ptp(np.array(p)[:, 1]) * k)) for p in HALLS], pink={n: dict(area=A(p), w=round(np.ptp(np.array(p)[:, 0]) * k), d=round(np.ptp(np.array(p)[:, 1]) * k)) for n, p in PINK.items()},
    solar=[dict(w=round((c - a) * k), d=round((e - b) * k)) for a, b, c, e in SOLAR], solar_total_ha=round(sum((c - a) * (e - b) for a, b, c, e in SOLAR) * k * k / 1e4, 1))
tb = {n: dict(px=p, road_m=round(float(KD.query(np.array([p[0] * k, -p[1] * k]))[0]))) for n, p in TURB.items()}
ts = list(TURB.values()); zones['turbines'] = dict(hub=HUB, rotor=ROTOR, tip=HUB + ROTOR / 2, positions=tb, min_spacing=round(min(math.dist(a, b) for i, a in enumerate(ts) for b in ts[i + 1:]) * k), sketch_min_spacing=round(min(math.dist(a, b) for i, a in enumerate(TURB_SK.values()) for b in list(TURB_SK.values())[i + 1:]) * k))

# ---- the forest, sown on a 4 m raster so the performance budget is a measurement of this layout, not a guess
RUNOFF = 12.5      # trees start 20 m from the centre; the barrier stands at 16 m, further out at the stops
dist_road = ndi.distance_transform_edt(~poly_mask(SH, [], [((x + PAD, y + PAD), 1) for x, y in pxpts[::2]])) * k
meadow = poly_mask(SH, [P([(150,300),(250,275),(345,250),(430,195),(520,180),(1090,195),(1200,218),(1300,290),(1310,400),(1250,465),(1100,495),(950,530),(885,590),(885,640),(745,640),(760,560),(720,525),(170,500)]), P([(895,640),(1290,612),(1430,650),(1490,750),(1490,820),(1420,890),(1300,915),(885,925),(885,700)])])      # the wind farm and solar infields stay open grass, as drawn
court = poly_mask(SH, [P([(560,945),(1020,945),(1020,1040),(560,1040)]), P([(1020,920),(1460,920),(1460,1060),(1020,1060)]), P([(1200,90),(1720,90),(1720,900),(1500,900),(1510,640),(1350,460),(1340,100)])])     # halls' garden, the stands' forecourts, the Ferrari World grammar site
def escape(c, width=25.0):     # the fast stops keep a tree-free, gravel-and-grass stopping area straight on from turn-in
    d = np.array([math.cos(head[c['b']]), math.sin(head[c['b']])]); L = 110.0 if c['straight_on_m'] == '400+' else max(0.0, c['straight_on_m'] - 12.0)
    return [(((CL[c['b'], 0] + d[0] * s_) / k + PAD, (-(CL[c['b'], 1] + d[1] * s_)) / k + PAD), width / k) for s_ in np.arange(0, L, 15.0)]
esc_m = poly_mask(SH, [], [q for c in corners if c['entry_kmh'] > 200 and c['turn'] > 60 for q in escape(c)])
clear = meadow | court | esc_m | ndi.binary_dilation(lake_m, iterations=8) | (dist_road < RUNOFF + HW)
forest = ~clear & (dist_road < 900); G = max(1, round(4 / k)); yy, xx = np.mgrid[0:SH[0]:G, 0:SH[1]:G]; f = forest[yy, xx]; rng = np.random.default_rng(17)
def sow(spacing, lo, hi):
    g = max(1, round(spacing / k)); y, x = np.mgrid[0:SH[0]:g, 0:SH[1]:g]; j = rng.uniform(-.45, .45, (2,) + y.shape) * g; xi = np.clip((x + j[0]).astype(int), 0, SH[1] - 1); yi = np.clip((y + j[1]).astype(int), 0, SH[0] - 1)
    ok = forest[yi, xi] & (dist_road[yi, xi] >= lo) & (dist_road[yi, xi] < hi); return np.c_[(xi[ok] - PAD) * k, -(yi[ok] - PAD) * k]
ROWS, CLUMP, FARCARD = sow(7.4, 0, 60), sow(15.0, 60, 170), np.r_[sow(29.0, 170, 320), sow(45.0, 320, 900)]      # 35 % fewer again (the user, 2026-11-04): the road edge untouched, the deep forest, where no gap can be seen, takes nearly all of it
T0, T1, TC = 1950, 420, 6      # tris of the converted scans (make_trees.py): hero, LOD1, crossed card
def sweep(r0, r1, cull):
    tr = cKDTree(ROWS); tc = cKDTree(CLUMP); tf = cKDTree(FARCARD); rows = []
    for i in range(0, N, 8):
        p = CL[i, :2]; a = tr.query_ball_point(p, r0, return_length=True); b = tr.query_ball_point(p, r1, return_length=True) - a; c = tr.query_ball_point(p, cull, return_length=True) - a - b
        d = tc.query_ball_point(p, r1, return_length=True); e = tc.query_ball_point(p, cull, return_length=True) - d; g = tf.query_ball_point(p, cull, return_length=True)
        rows.append((a * T0 + (b + d) * T1 + (c + e + g) * TC, a, b + d, c + e + g, int(i * STEP)))
    r = np.array(rows); w = int(r[:, 0].argmax())
    return dict(mean_tris=round(float(r[:, 0].mean())), peak_tris=round(float(r[w, 0])), peak_at_m=int(r[w, 4]), hero=int(r[w, 1]), lod1=int(r[w, 2]), cards=int(r[w, 3]), series=r[:, 0].round().astype(int).tolist())
perf = dict(forest_ha=round(forest.sum() * k * k / 1e4), edge_rows=len(ROWS), clump_lod1=len(CLUMP), far_cards=len(FARCARD), high=sweep(40, 90, 1500), medium=sweep(40, 90, 1500))
def closure(crown=5.5):
    t = cKDTree(np.r_[ROWS, CLUMP]); hit = tot = 0; dist = []
    for i in range(0, N, 12):
        for sd in (1, -1):
            for off_ in (-30, 0, 30):
                a = head[i] + sd * math.pi / 2 + math.radians(off_); d = np.array([math.cos(a), math.sin(a)]); s_ = np.arange(HW + RUNOFF, 250, 4.0); pts = CL[i, :2] + d[None] * s_[:, None]
                px_ = (pts[:, 0] / k + PAD).astype(int), (-pts[:, 1] / k + PAD).astype(int)
                if not forest[np.clip(px_[1], 0, SH[0] - 1), np.clip(px_[0], 0, SH[1] - 1)][:6].any(): continue
                tot += 1; h = t.query(pts)[0] < crown
                if h.any(): hit += 1; dist.append(s_[h.argmax()] - HW - RUNOFF)
    return dict(rays=tot, blocked_pct=round(100 * hit / max(tot, 1), 1), median_m_past_runoff=round(float(np.median(dist)), 1))
perf['closure'] = closure()
perf['naive_if_every_tree_real'] = dict(trees=round(forest.sum() * k * k / 70), tris_at_hero=round(forest.sum() * k * k / 70 * T0))

stats = dict(lap_m=round(LAP), m_per_sketch_px=round(float(k), 3), alat_calibrated=float(ALAT), vmax_calibrated=VMAX, calibration=FIT, est_lap_s=round(laptime(V, STEP), 1), est_avg_kmh=round(LAP / laptime(V, STEP) * 3.6), top_kmh=round(float(V.max()) * 3.6), corners=[{a: c[a] for a in c if a not in ('i', 'b', 'e')} for c in corners], straights=straights,
    side_by_side=near_, tightest_radius_m=round(float(R.min())), z_min=round(float(CL[:, 2].min()), 1), z_max=round(float(CL[:, 2].max()), 1), max_grade_pct=round(float(np.abs(grade).max()) * 100, 1), site_m=[round(float(np.ptp(CL[:, 0]))), round(float(np.ptp(CL[:, 1])))],
    sketch_deviation_m=dict(median=round(float(np.median(dev)), 1), p95=round(float(np.percentile(dev, 95)), 1), max=round(float(dev.max()), 1)), lake_clearance=dict(plan=worst(cl_lake), as_sketched=worst(cl_sk)), building_clearance=worst(cl_bld, 5), solar_clearance=worst(cl_sol, 3), shapes=dict(GREY=GREY, HALLS=HALLS, PINK=PINK, TURB=TURB, TURB_SK=TURB_SK), moves=MOVES, solar_sketch=SOLAR_SK, solar_plan=SOLAR, zones=zones, grid=dict(front_m_behind_line=8, last_m_behind_line=64, spacing_m=8), forest=perf)
assert LAP <= 6850, 'over the 6.85 km cap'; assert abs(LAP - LAP_T) < 3, 'lap off target'; assert min(n['gap_m'] for n in near_) > 32, 'two legs too close for walls'; assert R.min() >= 30, 'a hairpin tighter than Llano (r 30)'; assert (abs(grade) < 0.05).all(), 'steeper than planned'
(OUT / 'stats.json').write_text(json.dumps(stats, indent=1), encoding='utf8')
(H.parent.parent / 'track-viewer' / 'docs' / 'career-worlds' / 'qingshan.json').write_text(json.dumps(dict(id='qingshan', name='Cheongsan Park', lapLength=round(LAP), width=int(HW * 2), sketchScale=float(k), waypoints=[[round(float(a), 2) for a in p] for p in wp], corners=stats['corners']), indent=1), encoding='utf8')
np.savez(OUT / 'plan_arrays.npz', CL=CL, pxpts=pxpts, V=V, R=R, grade=grade, lake=lake, lake_sk=lake_sk, ROWS=ROWS, CLUMP=CLUMP, FARCARD=FARCARD)
show = {a: b for a, b in stats.items() if a not in ('forest',)}; print(json.dumps(show, indent=None, default=str)[:7000]); print(json.dumps({a: (b if not isinstance(b, dict) else {c: d for c, d in b.items() if c != 'series'}) for a, b in perf.items()}))
