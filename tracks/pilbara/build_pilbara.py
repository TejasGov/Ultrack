"""Pilbara Pit: a qualifying circuit down the wall of an open-cut iron-ore mine (track-viewer/docs/10x/maps-spec.md section 4), in one Blender pass.
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/maps/tracks/pilbara/build_pilbara.py -Log <abs log>
    (-Rest --no-export,stretch: the hero stretch, descent and switchback, for review stills first)
Layout: track-viewer/docs/career-worlds/pilbara.json (1.75 km, 18 m from rim to floor). Shared pieces: tracks/career_lib.py. Day and dusk only: no lights.json.
  road      15 m, kerbs below R140, jersey barriers 14 m out, a gravel run-off strip between them (flush with the road), a visual-only windrow behind each barrier
  ground    one 2.5 m heightfield with the bench toes and crests cut in as breaklines (collision on its own 4 m grid, with the 4.5 m faces it was
            driven with): 6 m benches (3 m faces of blasted, banded rock: jittered facets between the breaklines, scree at the toes; 11 m berms) cut down from every road leg inside the loop and up from it outside, the max / min of continuous per-station terms
            (no cracks where two legs' terraces meet), a dry floor at -5.6 m, a lake basin under a static pit lake at -6.5 m
  far       a radial ring to 8.5 km on the rim plateau with waste-rock dumps, and a Hamersley skyline of banded mesas and ridges 2.6-7 km out
  plant     the crusher on the floor by the chicane (ROM wall, dump pocket, truck ramp, steel frame, dust collector), an open Warren-truss conveyor
            gallery on A-frame trestles over the floor road to a braced head tower on the rim, three ore stockpiles past it, a workshop shed and a water tank
  dressing  windrows of tipped loads behind the barriers, crest bunds on the first three benches, 250 boulders (talus at the toes, rocks in the windrows)"""
import bpy, sys
from pathlib import Path
H = Path(globals().get('__file__') or sys.argv[sys.argv.index('-P') + 1]).resolve().parent; ID = 'pilbara'; PFX = 'PP'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
assert H.resolve().parents[1] == ROOT and (ROOT / 'track-viewer').is_dir(), ROOT
assert H.name == ID, H
import bisect
import numpy as np
ARGS = ','.join(ARGS).split(',')      # powershell -File hands `-Rest a,b` over as one argument
STRETCH = 'stretch' in ARGS; EXPORT = '--no-export' not in ARGS and not STRETCH
DL, QS = ROOT / 'tracks' / 'drylake' / 'tex', ROOT / 'tracks' / 'qingshan' / 'tex'
st = lambda s: int(round(s / STEP)) % N
IN_STRETCH = lambda i: not STRETCH or 380 - 120 <= i * STEP <= 640 + 120

MAT.update({
    'asphalt': material('PP | asphalt', tex='asphalt_track', rough=0.75, diff=DL / 'asphalt_track_bleached_diff_2k.jpg'),
    'line': material('PP | line white', tex='brushed_concrete', diff='none', vcol=True),
    'kerb_r': material('PP | kerb red', tex='brushed_concrete', diff=QS / 'kerb_red_diff.jpg'),
    'kerb_w': material('PP | kerb white', tex='brushed_concrete', diff=QS / 'kerb_white_diff.jpg'),
    'barrier': material('PP | barrier', tex='concrete_wall_009', vcol=True),
    'ground': material('PP | ground', tex='red_laterite_soil_stones', vcol=True),
    'gravel': material('PP | gravel', tex='gravel_ground_01', vcol=True),
    'far': material('PP | far terrain', tex='red_laterite_soil_stones', vcol=True),
    'rock': material('PP | rock', tex='red_laterite_soil_stones'),
    'concrete': material('PP | concrete', tex='dirty_concrete'),
    'corr': material('PP | corrugated', tex='rusty_corrugated_iron'),
    'clad': material('PP | cladding', tex='box_profile_metal_sheet'),
    'steel': material('PP | steel', tex='rusty_corrugated_iron'),
    'door': material('PP | roller door', tex='painted_metal_shutter'),
    'water': material('PP | pit lake', (0.04, 0.15, 0.12), 0.05),      # greener, darker and glossier: it takes the sky instead of reading as paint
})
MAT['steel'].node_tree.nodes['Normal Map'].inputs['Strength'].default_value = 0.15      # the corrugation would read as ribs on a 0.5 m column
UVS.update({'asphalt': 3.5, 'kerb_r': 2.5, 'kerb_w': 2.5, 'ground': 6.0, 'gravel': 4.0, 'far': 40.0, 'rock': 3.0, 'concrete': 3.0, 'corr': 3.0, 'clad': 3.0, 'steel': 2.0, 'door': 5.0})
road(7.5, 140)
barriers(14.0)
paint(f'{PFX} lines', lambda co: (0.62, 0.62, 0.6, 1))      # the line material takes its white from the vertices
def bcol(co):       # warm precast concrete with red dust rising from the foot, each 6 m unit a shade apart (bare grey concrete went navy in shade)
    i, _ = near(co.x, co.y); j = 1 + 0.05 * fbm(int(i * STEP / 6) * 0.37 + 0.11, 2.3, 2); g = 1 - ss(-0.05, 0.5, co.z - CL[i].z)
    return tuple(j * (a + (b_ - a) * g) for a, b_ in ((0.98, 0.82), (0.9, 0.55), (0.82, 0.42))) + (1,)
paint(f'{PFX} barriers', bcol)

# ------------------------------------------------------------------------------------------------ run-off strip and windrows
bm = bmesh.new(); vc = vcol_layer(bm); ground_col = []
def gtone(co): t = 0.86 + 0.12 * fbm(co.x / 30, co.y / 30, 3); return (0.52 * t, 0.23 * t, 0.17 * t, 1)      # the grey gravel photo toned (linear) to the berms' laterite red
for sd in (1, -1):
    rows = [[off(i, sd * HW, -0.03), off(i, sd * (BD[sd][i] + 1.0), -0.07)] for i in range(N)]       # 3 cm under the road edge: no step to catch a wheel
    for f in strip(bm, rows, 0, rev=sd < 0):
        for l in f.loops: l[vc] = gtone(l.vert.co)
    ground_col += [[rows[i][0].copy(), rows[(i + 1) % N][0].copy(), rows[(i + 1) % N][1].copy(), rows[i][1].copy()][::sd] for i in range(N)]
    rows = []
    LB_ = [0.0]
    while LB_[-1] < LAP + 10: LB_.append(LB_[-1] + RNG.uniform(3.5, 6.0))
    WQ = [RNG.uniform(-0.4, 0.4) for _ in LB_]; TQ = [RNG.uniform(-0.4, 0.4) for _ in LB_]; HQ = [RNG.uniform(-0.25, 0.3) for _ in LB_]
    for i2 in range(2 * N):      # a chain of tipped truck loads 3.5-6 m apart, each overlapping the last, toes sunk into the ground: sampled every 1.25 m
        i, fr = i2 // 2, (i2 % 2) / 2; s_ = (i + fr) * STEP; q = bisect.bisect_right(LB_, s_) - 1; ph = (s_ - LB_[q]) / (LB_[q + 1] - LB_[q]); k_ = ss(0, 1, ph)
        P = lambda lat, dz: off(i, lat, dz).lerp(off((i + 1) % N, lat, dz), fr)
        p = P(0, 0); B = BD[sd][i] * (1 - fr) + BD[sd][(i + 1) % N] * fr
        h = 1.35 + 0.5 * math.sin(math.pi * ph) ** 0.6 + HQ[q] + 0.3 * fbm(p.x / 9, p.y / 9 + sd * 9, 2); w = WQ[q] + (WQ[q + 1] - WQ[q]) * k_; t = TQ[q] + (TQ[q + 1] - TQ[q]) * k_
        rows.append([P(sd * (B + 0.8), -0.45), P(sd * (B + 2.3 + w), h), P(sd * (B + 3.2 + w + 0.3 * t), h - 0.15), P(sd * (B + 4.8 + t), -0.45)])
    for f in strip(bm, rows, 0, rev=sd < 0):
        for l in f.loops: l[vc] = gtone(l.vert.co)
GRV, vcg = bm, vc      # the run-off and windrows; the crest bunds join them below

# ------------------------------------------------------------------------------------------------ ground: the benched heightfield
CA = np.array([[p.x, p.y, p.z] for p in CL]); NA_ = np.array([[n.x, n.y] for n in NL]); BDL, BDR = np.array(BD[1]), np.array(BD[-1])
TA = np.roll(CA[:, :2], -1, 0) - np.roll(CA[:, :2], 1, 0); TA /= np.linalg.norm(TA, axis=1)[:, None]
ZF = float(CA[:, 2].min())      # the floor road; the start line on the rim is z 0
LAKE, FLOOR, BASIN = ZF - 6.5, ZF - 5.6, ZF - 8.6        # the water 0.9 m under the dry floor and 2.1 m over the basin: nothing near it is coplanar
CELL = 2.5; X0, X1, Y0, Y1 = min(xs) - 120, max(xs) + 120, min(ys) - 120, max(ys) + 120
GX, GY = int(math.ceil((X1 - X0) / CELL)), int(math.ceil((Y1 - Y0) / CELL)); X1, Y1 = X0 + GX * CELL, Y0 + GY * CELL
CX, CY = (X0 + X1) / 2, (Y0 + Y1) / 2
PADS = []      # (x, y, radius, z): flat sites for the plant
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def fb(px, py, sc, oct=3, o=0.0): return np.array([fbm(a / sc + o, b / sc, oct) for a, b in zip(px, py)])
def pip(px, py):      # crossing number against the centreline polygon
    xi, yi = CA[:, 0], CA[:, 1]; xj, yj = np.roll(xi, -1), np.roll(yi, -1); dy_ = np.where(yj == yi, 1e-9, yj - yi)
    c = (yi[None] > py[:, None]) != (yj[None] > py[:, None]); xint = xi[None] + (py[:, None] - yi[None]) * ((xj - xi) / dy_)[None]
    return np.count_nonzero(c & (px[:, None] < xint), axis=1) % 2 == 1
FW, NB = 3.0, 4      # the bench face's width (6 m high: 63 degrees on average, 72 at its steepest) and the rock bands cut across it
def heights(px, py, fw=FW):
    """fw: the face width (collision keeps the gentler 4.5 m it was built and driven with). Ground z, distance to the nearest station, that station's barrier offset on this side, inside-the-loop, the bench coordinate s of the station
    that sets the height, and whether the point is on a plain terrace (not the run-off blend, the floor, the rim cap, a pad or the edge lip)"""
    px, py = np.asarray(px, float), np.asarray(py, float); n = len(px)
    Z, DN, BN, IN, S, TER = np.empty(n), np.empty(n), np.empty(n), pip(px, py), np.empty(n), np.empty(n, bool)
    n40, ncap, nlake = fb(px, py, 40), fb(px, py, 90, 3, 3.3), fb(px, py, 120, 2, 7.1)
    for a in range(0, n, 1500):
        s_ = slice(a, a + 1500); x, y = px[s_], py[s_]; r = np.arange(len(x))
        dx, dy = x[:, None] - CA[None, :, 0], y[:, None] - CA[None, :, 1]; d2 = dx * dx + dy * dy
        # each road leg speaks at its foot: with every station in the max at full weight, the uphill ones win on a grade and the bench lines go ragged.
        # t: where the point projects along each station's tangent, in stations; outside a curve consecutive projections spread apart (by rho / R),
        # so there t counts in their spacing g. A station speaks fully while its foot lies within its own 2.5 m (|t| <= 0.5) and fades by 6 m per
        # station beyond: on a straight that is one station, near a hairpin's centre the whole arc. A hard local-minimum mask, or a fade keyed
        # to the distance parabola (whose spacing falls to 0 there), made 1-2 m cliffs wherever two minima of the distance merged
        t0 = (dx * TA[None, :, 0] + dy * TA[None, :, 1]) / STEP; t = t0 / np.maximum((np.roll(t0, 1, 1) - np.roll(t0, -1, 1)) / 2, 1)
        u = np.clip(t, -0.5, 0.5); pen = 6 * np.maximum(np.abs(t) - 0.5, 0)
        d = np.sqrt(np.maximum(d2 - (t0 * STEP) ** 2, 0) + ((t0 - u) * STEP) ** 2); zr = CA[None, :, 2] + u * (np.roll(CA[:, 2], -1) - np.roll(CA[:, 2], 1))[None] / 2 - 0.35
        bd = np.where(dx * NA_[None, :, 0] + dy * NA_[None, :, 1] > 0, BDL[None], BDR[None]); ex = d - bd - 6
        s = ex + 3 * n40[s_, None] * sm(0, 5, ex)       # the bench lines wander a few metres, fading in past the run-off so nothing steps there
        rise = np.where(s < 0, 0.0, 6 * np.floor(np.maximum(s, 0) / 14) + 6 * sm(0, fw, np.mod(np.maximum(s, 0), 14)))
        far = d > 220
        tin, tout = np.where(far, -1e9, zr - rise - pen), np.where(far, 1e9, zr + rise + pen); jin, jout = tin.argmax(1), tout.argmin(1); zin, zout = tin[r, jin], tout[r, jout]
        k = d2.argmin(1); dmin, bdk, znear = d[r, k], bd[r, k], zr[r, k]
        lake = sm(50, 90, dmin + 20 * nlake[s_])
        for (sx, sy, sr, _) in PADS: lake = lake * sm(sr + 10, sr + 40, np.hypot(x - sx, y - sy))
        zfl, zcap = FLOOR - (FLOOR - BASIN) * lake, ZF + 20.5 + 2.5 * ncap[s_]
        zt = np.where(IN[s_], np.maximum(zin, zfl), np.minimum(zout, zcap))
        S[s_] = np.where(IN[s_], s[r, jin], s[r, jout]); TER[s_] = np.where(IN[s_], zin > zfl + 0.3, zout < zcap - 0.3) & (dmin > bdk + 7)
        w = sm(bdk + 1, bdk + 6, dmin); z = znear * (1 - w) + zt * w
        edge = np.minimum.reduce([x - X0, X1 - x, y - Y0, Y1 - y]); z = z - 12 * (1 - sm(0, 60, edge))     # a lip under the far ring: they cross, never coincide
        TER[s_] &= edge > 62
        for (sx, sy, sr, sz) in PADS: z = z + (sz - z) * (1 - sm(sr, sr + 12, np.hypot(x - sx, y - sy))); TER[s_] &= np.hypot(x - sx, y - sy) > sr + 13
        Z[s_], DN[s_], BN[s_] = z, dmin, bdk
    return Z, DN, BN, IN, S, TER
def gz(x, y): return float(heights([x], [y])[0][0])
# plant sites first (they flatten the ground): the crusher inside the chicane on the floor, the shed and the tank on the rim north of the start straight
i5 = st(next(c['at'] for c in SRC['corners'] if c['n'] == 5)); CR = off(i5, -(BD[-1][i5] + 36)); PADS.append((CR.x, CR.y, 16.0, FLOOR))
iS, iT = st(90), st(LAP - 60); SH, TK = off(iS, 62), off(iT, 52)
PADS += [(SH.x, SH.y, 20.0, ZF + 20.5), (TK.x, TK.y, 10.0, ZF + 20.5)]

for x_, y_ in ((290.9, -222.7), (-104.6, -62.3)):     # where the foot masks once made 1-2 m cliffs: at most a bench face's slope (6 cm per cm) here
    zz = heights(np.full(600, x_), y_ + np.arange(-300, 300) / 100)[0]; assert np.abs(np.diff(zz)).max() < 0.06, ('the ground jumps near', x_, y_, np.abs(np.diff(zz)).max())
gxs, gys = np.meshgrid(X0 + CELL * np.arange(GX + 1), Y0 + CELL * np.arange(GY + 1)); GZ, GD, GB, GI, GS, GT = (a.reshape(gxs.shape) for a in heights(gxs.ravel(), gys.ravel()))
# a 2.5 m grid still samples a bench face only once or twice, and the crests come out as sawtooth: so every vertex near a bench toe or crest (s = 0 or FW,
# mod 14) moves onto it along the gradient of s, by under half a cell, where s is smooth (one station sets it all round), unless the move folds a quad
gsy, gsx = np.gradient(GS, CELL); g2 = gsx ** 2 + gsy ** 2; rr = np.mod(GS, 14)
brk = np.where(rr < FW / 2, -rr, np.where(rr < (FW + 14) / 2, FW - rr, 14 - rr)); mx_, my_ = brk * gsx / np.maximum(g2, 1e-9), brk * gsy / np.maximum(g2, 1e-9)
ok = GT.copy(); ok[0, :] = ok[-1, :] = ok[:, 0] = ok[:, -1] = False
ok[1:-1, 1:-1] &= GT[:-2, 1:-1] & GT[2:, 1:-1] & GT[1:-1, :-2] & GT[1:-1, 2:]
ok &= (g2 > 0.6 ** 2) & (g2 < 1.5 ** 2) & (np.hypot(mx_, my_) < 0.48 * CELL)
for _ in range(6):      # every grid quad stays convex, so neither diagonal can fold a triangle over
    sx_, sy_ = gxs + np.where(ok, mx_, 0), gys + np.where(ok, my_, 0)
    P_ = [(sx_[:-1, :-1], sy_[:-1, :-1]), (sx_[:-1, 1:], sy_[:-1, 1:]), (sx_[1:, 1:], sy_[1:, 1:]), (sx_[1:, :-1], sy_[1:, :-1])]
    fold = np.zeros(ok.shape, bool); bad = np.zeros(fold[:-1, :-1].shape, bool)
    for k in range(4): (ax, ay), (bx, by), (cx_, cy_) = P_[k - 1], P_[k], P_[(k + 1) % 4]; bad |= (bx - ax) * (cy_ - by) - (by - ay) * (cx_ - bx) < 0.1 * CELL * CELL
    if not bad.any(): break
    fold[:-1, :-1] |= bad; fold[:-1, 1:] |= bad; fold[1:, 1:] |= bad; fold[1:, :-1] |= bad; ok &= ~fold
gxs, gys = gxs + np.where(ok, mx_, 0), gys + np.where(ok, my_, 0)
for a_, v_ in zip((GZ, GD, GB, GI, GS), heights(gxs[ok], gys[ok])[:5]): a_[ok] = v_
assert not bad.any(), 'snapping folded a ground quad'
log('vertices snapped to bench lines', int(ok.sum()), 'of', int(GT.sum()), 'on terraces; |grad s| ok', int(((g2 > 0.36) & (g2 < 2.25) & GT).sum()), 'near a line', int(((np.abs(brk) < 1.6) & GT).sum()))
_lo = np.unravel_index(GZ.argmin(), GZ.shape)
log('ground grid', GX, 'x', GY, 'z', round(float(GZ.min()), 1), '..', round(float(GZ.max()), 1), 'lowest at', round(float(gxs[_lo]), 1), round(float(gys[_lo]), 1), 'inside', bool(GI[_lo]), 'd', round(float(GD[_lo]), 1))
bm = bmesh.new(); vc = vcol_layer(bm)
G = [[bm.verts.new((float(gxs[r, c]), float(gys[r, c]), float(GZ[r, c]))) for c in range(GX + 1)] for r in range(GY + 1)]
for r in range(GY):
    for c in range(GX):
        idx = ((r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c))
        if max(GD[q] for q in idx) < HW - 0.6 or all(GD[q] < GB[q] for q in idx): continue      # under the road or the run-off strip
        q = [G[a][b_] for a, b_ in idx]
        z_ = [GZ[q_] for q_ in idx]      # split along the diagonal that follows the contour
        for t_ in (((0, 1, 2), (0, 2, 3)) if abs(z_[0] - z_[2]) <= abs(z_[1] - z_[3]) else ((0, 1, 3), (1, 2, 3))):
            f = bm.faces.new([q[k] for k in t_]); f.material_index = 0; f.smooth = True
for v in [v for v in bm.verts if not v.link_faces]: bm.verts.remove(v)
# breaklines: every triangle edge that a bench toe or crest crosses (s = 0 or FW, mod 14) is split on the line, and the two cuts in a triangle are
# joined, so no triangle bevels across a crest (the pale notches a heightfield leaves wherever no vertex sits on the line). NB - 1 more lines across
# each face, evenly spaced in height, carry the rock bands
LV = [0.0, FW] + [FW * (0.5 - math.sin(math.asin(1 - 2 * k / NB) / 3)) for k in range(1, NB)]
VS = {G[r][c]: (GS[r, c], GT[r, c]) for r in range(GY + 1) for c in range(GX + 1) if G[r][c].is_valid}
cuts = []
for e in bm.edges:
    a, b_ = e.verts; (sa, ta), (sb, tb) = VS[a], VS[b_]
    if not (ta and tb) or abs(sa - sb) > 1.5 * e.calc_length(): continue       # one station sets s all along the edge
    lo, hi = min(sa, sb), max(sa, sb)
    cuts += [(e, a, b_, (L - sa) / (sb - sa), L, sb - sa) for L in (14 * k + o for k in range(int(lo // 14), int(hi // 14) + 1) for o in LV) if L >= 0 and lo + 0.05 < L < hi - 0.05]
if cuts:
    F = np.array([c[3] for c in cuts]); A = np.array([c[1].co.to_2d() for c in cuts]); D_ = np.array([(c[2].co - c[1].co).to_2d() for c in cuts])
    P = A + F[:, None] * D_; F = np.clip(F + (np.array([c[4] for c in cuts]) - heights(P[:, 0], P[:, 1])[4]) / np.array([c[5] for c in cuts]), 0.02, 0.98)     # one secant step onto the line
    P = A + F[:, None] * D_; PZ = heights(P[:, 0], P[:, 1])[0]
    by_edge, NV = {}, {}
    for c, f_, p, z in zip(cuts, F, P, PZ): by_edge.setdefault(c[0], []).append((f_, c[4], p, z, c[1], c[2]))
    for e, cs in by_edge.items():
        cs.sort(key=lambda t: t[0]); cur, va = e, cs[0][4]
        for f_, L, p, z, _, b_ in cs:       # several lines can cross one edge: each split continues along the part toward b
            ne, v = bmesh.utils.edge_split(cur, va, 0.5); v.co = Vector((float(p[0]), float(p[1]), float(z))); NV[v] = L
            cur = next(e2 for e2 in v.link_edges if b_ in e2.verts); va = v
    pairs = set()
    for f in {f for v in NV for f in v.link_faces}:
        lv = {}
        for v in f.verts:
            if v in NV: lv.setdefault(NV[v], []).append(v)
        pairs |= {frozenset(vs) for vs in lv.values() if len(vs) == 2}
    for v1, v2 in pairs:
        if not any(v2 in e.verts for e in v1.link_edges): bmesh.ops.connect_verts(bm, verts=[v1, v2])
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3], quad_method='BEAUTY', ngon_method='BEAUTY')
    log('breaklines: edges cut', len(by_edge), 'vertices', len(NV), 'joins', len(pairs))
# collision on its own 4 m grid (15k-triangle budget): the barrier is the wall, the 7 m behind it the safety net, and that band is never a snapped terrace
WX, WY = np.meshgrid(X0 + 4 * np.arange(int((X1 - X0) / 4) + 1), Y0 + 4 * np.arange(int((Y1 - Y0) / 4) + 1)); WZ, WD, WB = (a.reshape(WX.shape) for a in heights(WX.ravel(), WY.ravel(), 4.5)[:3])
for r in range(WX.shape[0] - 1):
    for c in range(WX.shape[1] - 1):
        idx = ((r, c), (r, c + 1), (r + 1, c + 1), (r + 1, c))
        if max(WD[q] for q in idx) < HW - 0.6 or all(WD[q] < WB[q] for q in idx) or min(WD[q] - WB[q] for q in idx) >= 7: continue
        ground_col.append([Vector((float(WX[q]), float(WY[q]), float(WZ[q]))) for q in idx])
SV = {v: st_ for v, st_ in VS.items() if v.is_valid}; SV.update({v: (L, True) for v, L in (NV if cuts else {}).items()})      # every vertex's bench coordinate s, on a terrace or not
CRISP = {v for v, (s_, _) in SV.items() if min(abs(s_ % 14), abs(s_ % 14 - FW), abs(s_ % 14 - 14)) < 1e-4}      # toe and crest lines stay put (da10347's notch fix)
nj = 0
for v, (s_, t_) in SV.items():      # blasted faces: between toe and crest every vertex moves up or down by its 4 m cell's draw, so the face breaks into facets
    fr = (s_ % 14) / FW
    if not t_ or v in CRISP or not 0.03 < fr < 0.97: continue
    v.co.z += 0.4 * math.sin(math.pi * fr) * noise.cell(Vector((v.co.x / 4, v.co.y / 4, 0.5))); nj += 1
log('face vertices jittered', nj)
QD = [Vector((math.cos(a), math.sin(a), 0)) for a in (0, math.pi / 4, math.pi / 2, 3 * math.pi / 4)]
def slope_uv(bm, sc):      # flat faces world x, y; slopes projected along their own horizontal facing (one of four), so a photo never stretches by more than 8 %
    bm.normal_update(); uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        if n.z >= 0.75: uvs = [(l.vert.co.x / sc, l.vert.co.y / sc) for l in f.loops]
        else:
            t = Vector((-n.y, n.x, 0)); t = max(QD, key=lambda q: abs(q.dot(t)))
            uvs = [(t.dot(l.vert.co) / sc, l.vert.co.z / sc) for l in f.loops]
        for l, u in zip(f.loops, uvs): l[uv].uv = u
slope_uv(bm, 6)
for e in bm.edges:
    if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.55: e.smooth = False      # crisp bench crests and toes, smooth berms
for v in bm.verts:      # paler, dustier berm tops; at the lake a wet dark band under a pale mineral rim
    co = v.co; t = 0.9 + 0.1 * fbm(co.x / 50, co.y / 50, 3) + 0.05 * fbm(co.x / 7, co.y / 7, 2); k = ss(0.6, 0.92, v.normal.z)
    col = tuple(t * (a + (b_ - a) * k) for a, b_ in ((0.78, 1.0), (0.66, 0.92), (0.6, 0.86)))
    if co.z < LAKE + 0.8: col = (0.6 * col[0], 0.56 * col[1], 0.5 * col[2])
    elif co.z < LAKE + 1.2: col = tuple(min(1, a * 1.12 + 0.05) for a in col)
    for l in v.link_loops: l[vc] = (*col, 1)
PAL = [(0.6, 0.48, 0.5), (0.8, 0.8, 0.9), (1.0, 0.86, 0.6), (0.72, 0.56, 0.52)]       # banded iron over the laterite photo: dark maroon, purple-grey, ochre, red-brown
nb_ = 0
for f in bm.faces:      # each band between two breaklines one flat colour, faces flat-shaded: fractured rock, not a dune
    if f.normal.z > 0.75 or any(v not in SV or not SV[v][1] for v in f.verts): continue
    sc_ = sum(SV[v][0] for v in f.verts) / len(f.verts); kb, fr = int(sc_ // 14), (sc_ % 14) / FW
    if not 0 < fr < 1: continue
    j = min(NB - 1, int(fr * NB)); c = f.calc_center_median(); vs = sorted(f.verts, key=lambda v: SV[v][0]); down = vs[-1].co.z < vs[0].co.z     # inside the loop the face falls away from the road
    h = (kb * 7 + j * 3 + (5 if down else 0)) % 11 / 11 + 0.35 * fbm(c.x / 90, c.y / 90, 2); col = PAL[int(h * len(PAL)) % len(PAL)]
    if j == (NB - 1 if down else 0): col = tuple(a + (b_ - a) * 0.6 for a, b_ in zip(col, (0.96, 0.84, 0.74)))      # scree against the toe
    t = 0.86 + 0.14 * fbm(c.x / 20, c.y / 20, 2)
    for l in f.loops: l[vc] = (*(t * a for a in col), 1)
    f.smooth = False; nb_ += 1
log('banded face triangles', nb_)
mesh_obj(f'{PFX} ground', bm, ['ground'], planar=False)
# crest bunds: a 0.8 m safety bund of dumped rock on the berm at the crest of the first three benches each side (outside the loop the benches climb
# from the road, so the crest is at s = FW; inside they fall, so it is at s = 0 and the first one is the windrow's job)
BI = np.array([(sd, kb, i) for sd in (1, -1) for kb in range(3) for i in range(0, N, 2)]); SD_, KB_, I_ = BI[:, 0], BI[:, 1], BI[:, 2]
ST_ = np.where(SD_ > 0, 14 * KB_ + FW + 1.0, 14 * (KB_ + 1) - 1.0); DD = np.array([BD[sd][i] for sd, i in zip(SD_, I_)]) + 6 + ST_
for _ in range(4):      # walk out along the station's normal until the bench coordinate is the crest's
    P = np.array([off(i, sd * d).to_2d() for sd, i, d in zip(SD_, I_, DD)]); hz = heights(P[:, 0], P[:, 1]); DD = DD + np.clip(ST_ - hz[4], -3, 3)
P = np.array([off(i, sd * d).to_2d() for sd, i, d in zip(SD_, I_, DD)]); hz = heights(P[:, 0], P[:, 1]); OKB = (np.abs(hz[4] - ST_) < 0.3) & hz[5]
nbund = 0
for sd in (1, -1):
    for kb in range(3):
        seq = [(i, d, z, ok) for s2, k2, i, d, z, ok in zip(SD_, KB_, I_, DD, hz[0], OKB) if s2 == sd and k2 == kb]
        run = []
        for q, (i, d, z, ok) in enumerate(seq + [(None, 0, 0, False)]):
            if ok and run and (off(i, sd * d) - off(run[-1][0], sd * run[-1][1])).length > 9: ok2 = False
            else: ok2 = ok
            if ok2: run.append((i, d, z))
            if not ok2 or q == len(seq):
                if len(run) > 2:
                    rows = []
                    for i_, d_, z_ in run:
                        hb = 0.8 + 0.15 * fbm(i_ * 0.21, sd * 3 + kb, 2); P_ = lambda l_, dz: Vector((*off(i_, sd * (d_ + l_)).to_2d(), z_ + dz))
                        rows.append([P_(-1.3, -0.3), P_(-0.35, hb), P_(0.35, hb - 0.08), P_(1.3, -0.3)])
                    for f in strip(GRV, rows, 0, closed=False, rev=sd < 0):
                        for l in f.loops: l[vcg] = gtone(l.vert.co)
                    nbund += len(run)
                run = [(i, d, z)] if ok and not ok2 else []
log('crest bund stations', nbund)
slope_uv(GRV, 4); mesh_obj(f'{PFX} gravel', GRV, ['gravel'], smooth=True, planar=False)
# the pit lake: one plane over the basin
LX, LY = gxs[(GZ < LAKE + 0.5) & GI], gys[(GZ < LAKE + 0.5) & GI]
if len(LX):
    bm = bmesh.new(); x0, x1, y0, y1 = LX.min() - 8, LX.max() + 8, LY.min() - 8, LY.max() + 8; n_ = 6
    for a in range(n_):
        for c in range(n_):
            u0, u1, w0, w1 = x0 + (x1 - x0) * a / n_, x0 + (x1 - x0) * (a + 1) / n_, y0 + (y1 - y0) * c / n_, y0 + (y1 - y0) * (c + 1) / n_
            bm.faces.new([bm.verts.new((u, w, LAKE)) for u, w in ((u0, w0), (u1, w0), (u1, w1), (u0, w1))])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01); mesh_obj(f'{PFX} pit lake', bm, ['water'])
    log('lake', round(x1 - x0), 'x', round(y1 - y0), 'm')

# ------------------------------------------------------------------------------------------------ far ring and skyline
DUMPS = [(CX + r * math.cos(a), CY + r * math.sin(a), R_, h) for r, a, R_, h in
         ((900, 0.4, 260, 32), (1300, 1.5, 380, 40), (850, 2.6, 200, 24), (1600, 3.4, 420, 44), (1100, 4.3, 300, 30), (1900, 5.2, 450, 46), (1000, 5.9, 220, 26))]
def far_z(x, y, r):
    z = ZF + 19.5 + 2.0 * fbm(x / 600 + 11, y / 600, 3)
    for dx_, dy_, R_, h in DUMPS:       # waste-rock dumps: two lifts with a berm, flat tops
        dd = math.hypot(x - dx_, y - dy_) * (1 + 0.18 * fbm(x / 300, y / 300 + 5, 2))
        z += h / 2 * (ss(R_ + 90, R_ + 55, dd) + ss(R_ + 30, R_, dd))
    inside = min(x - X0, X1 - x, y - Y0, Y1 - y)       # under the near ground the ring dives out of sight
    return z - 45 * ss(20, 80, inside)
bm = bmesh.new(); vc = vcol_layer(bm)
radii = [260 * (8500 / 260) ** (k / 70) for k in range(71)]; NA = 160
ring = [[bm.verts.new((CX + r * math.cos(a), CY + r * math.sin(a), 0)) for a in (2 * math.pi * k / NA for k in range(NA))] for r in radii]
for rr, row in zip(radii, ring):
    for v in row: v.co.z = far_z(v.co.x, v.co.y, rr)
for k in range(len(radii) - 1):
    for a in range(NA):
        f = bm.faces.new([ring[k][a], ring[k + 1][a], ring[k + 1][(a + 1) % NA], ring[k][(a + 1) % NA]]); f.material_index = 0; f.smooth = True
        for l in f.loops:
            co = l.vert.co; t = 0.88 + 0.12 * fbm(co.x / 400, co.y / 400, 2); k_ = ss(ZF + 24, ZF + 40, co.z)      # dump tops a paler, older red
            l[vc] = (t * (0.92 + 0.06 * k_), t * (0.82 + 0.08 * k_), t * (0.76 + 0.08 * k_), 1)
def strat(z, x):       # Hamersley bands: dark red scarp, paler ochre ledges
    b_ = math.sin(z * 0.38 + 0.6 * math.sin(x * 0.01)) * 0.5 + 0.5; n = 0.86 + 0.2 * fbm(x * 0.02, z * 0.1, 2)
    return (min(1, (0.62 + 0.38 * b_) * n), min(1, (0.46 + 0.42 * b_) * n), min(1, (0.4 + 0.36 * b_) * n), 1)
def mesa(cx, cy, rx_, ry_, h, rot):     # llano_dressing.py's: caprock lip, steep scarp, talus skirt; long ones are ridges
    PF = [(1.3, -3), (1.16, 0.08), (1.05, 0.2), (0.97, 0.42), (0.93, 0.5), (0.86, 0.58), (0.83, 0.9), (0.8, 1.0)]; M_ = 48; g_ = far_z(cx, cy, 0); rows = []
    ca, sa = math.cos(rot), math.sin(rot)
    for fr, zf in PF:
        row = []
        for q in range(M_):
            a = 2 * math.pi * q / M_; w = 1 + 0.2 * fbm(math.cos(a) * 2.1 + cx * 0.01, math.sin(a) * 2.1 + cy * 0.01, 3) + 0.05 * fbm(math.cos(a) * 9, math.sin(a) * 9, 2)
            z_ = g_ + (zf * h if zf > 0 else zf)
            if zf > 0.55: z_ += 2.2 * fbm(math.cos(a) * 4, math.sin(a) * 4, 2) * (1 - zf) * 8
            u, v = rx_ * fr * w * math.cos(a), ry_ * fr * w * math.sin(a)
            row.append(bm.verts.new((cx + u * ca - v * sa, cy + u * sa + v * ca, z_)))
        rows.append(row)
    for k in range(len(rows) - 1):
        for q in range(M_):
            f = bm.faces.new([rows[k][q], rows[k][(q + 1) % M_], rows[k + 1][(q + 1) % M_], rows[k + 1][q]]); f.smooth = k < 1
            for l in f.loops: l[vc] = strat(l.vert.co.z, l.vert.co.x)
    f = bm.faces.new(rows[-1])
    for l in f.loops: l[vc] = strat(l.vert.co.z, l.vert.co.x)
for r, a, rx_, ry_, h, rot in ((2800, 0.3, 520, 260, 70, 0.4), (3600, 1.2, 760, 300, 110, 1.9), (4800, 2.0, 950, 330, 150, 0.2), (3100, 2.9, 420, 380, 60, 1.0),
                               (5200, 3.7, 1300, 380, 180, 2.4), (4100, 4.5, 620, 280, 90, 0.7), (3700, 5.5, 820, 250, 120, 2.9), (5900, 6.0, 1000, 420, 160, 1.4)):
    cx, cy = CX + r * math.cos(a), CY + r * math.sin(a)       # a Hamersley skyline 2.6-7 km out, clear of the dumps
    assert all(math.hypot(cx - dx_, cy - dy_) > max(rx_, ry_) * 1.3 + R_ + 100 for dx_, dy_, R_, _ in DUMPS), ('a mesa on a dump', r, a)
    mesa(cx, cy, rx_, ry_, h, rot)
mesh_obj(f'{PFX} far terrain', bm, ['far'])

# ------------------------------------------------------------------------------------------------ plant: crusher, conveyor gallery, shed, tank
def planar_uv(bm, s, faces=None):       # mesh_obj's world UVs, for meshes that also carry faces with their own
    uv = bm.loops.layers.uv.verify(); bm.normal_update()
    for f in faces if faces is not None else bm.faces:
        n = f.normal
        for l in f.loops: c = l.vert.co; l[uv].uv = (c.x / s, c.y / s) if abs(n.z) > 0.6 else ((c.y if abs(n.x) > abs(n.y) else c.x) / s, c.z / s)
def strut(bm, a, b_, w, h):        # a box from a to b, w across (horizontal) and h across the other way, at any slope
    t = (b_ - a).normalized(); s_ = Vector((0, 0, 1)).cross(t)
    s_ = Vector((1, 0, 0)) if s_.length < 1e-6 else s_.normalized(); u = t.cross(s_); L = (b_ - a).length
    v = [bm.verts.new(a + s_ * (w / 2 if k & 1 else -w / 2) + u * (h / 2 if k & 2 else -h / 2) + t * (L if k & 4 else 0)) for k in range(8)]
    for q in ((0, 4, 6, 2), (1, 3, 7, 5), (0, 1, 5, 4), (2, 6, 7, 3), (0, 2, 3, 1), (4, 5, 7, 6)): bm.faces.new([v[k] for k in q])
BMS = {k: bmesh.new() for k in ('concrete', 'corr', 'clad', 'steel', 'door')}; TANK = []; ST_PILES = []
crusher_top = None
if not STRETCH:
    yaw = HEAD[i5]; g = gz(CR.x, CR.y); TX_, SV_ = Vector((math.cos(yaw), math.sin(yaw), 0)), NL[i5]
    LP = lambda lx, ly, z: Vector((CR.x, CR.y, 0)) + TX_ * lx + SV_ * ly + Vector((0, 0, z))      # the crusher's frame: x along the road, y toward the gallery
    box(BMS['concrete'], Vector((CR.x, CR.y, g + 3.6)), (20, 14, 8.4), yaw)       # the base, 0.4 m into the floor
    for y0_, y1_ in ((-7, -3), (3, 7)): box(BMS['concrete'], LP(-10.6, (y0_ + y1_) / 2, g + 5.0), (1.2, y1_ - y0_, 10.8), yaw)       # the ROM wall either side of the dump pocket
    bc = BMS['concrete']        # the truck ramp up to the pocket, between concrete panel walls
    rt = [bc.verts.new(LP(x, y, g + z)) for x, z in ((-11.2, 7.8), (-40, -0.4)) for y in (-3.5, 3.5)]; rb = [bc.verts.new(LP(x, y, g - 0.4)) for x in (-11.2, -40) for y in (-3.5, 3.5)]
    for q in ((rt[0], rt[2], rt[3], rt[1]), (rt[0], rb[0], rb[2], rt[2]), (rt[1], rt[3], rb[3], rb[1])): bc.faces.new(q)
    for lx in (-7.5, 0, 7.5):       # the steel frame the crusher house stands on, open between the base and the cladding
        for ly in (-5.5, 5.5): strut(BMS['steel'], LP(lx, ly, g + 7.8), LP(lx, ly, g + 10.3), 0.6, 0.6)
    for (x0_, y0_), (x1_, y1_) in (((-7.5, -5.5), (7.5, -5.5)), ((-7.5, 5.5), (7.5, 5.5)), ((-7.5, -5.5), (-7.5, 5.5)), ((7.5, -5.5), (7.5, 5.5))):
        strut(BMS['steel'], LP(x0_, y0_, g + 10.0), LP(x1_, y1_, g + 10.0), 0.4, 0.6)
    box(BMS['corr'], Vector((CR.x, CR.y, g + 14.8)), (16, 12, 9), yaw)
    box(BMS['clad'], Vector((CR.x, CR.y, g + 20.8)), (7, 6, 3), yaw)
    dc = LP(6, -10, 0)      # the dust collector: a drum on a hopper on four legs
    cyl(BMS['corr'], Vector((dc.x, dc.y, g + 1.2)), 0.35, 1.6, 2.2, n=16, cap=False); cyl(BMS['corr'], Vector((dc.x, dc.y, g + 3.4)), 1.6, 1.6, 8, n=16)
    for q in range(4):
        a_ = math.pi / 4 + q * math.pi / 2; lg = Vector((dc.x + 1.5 * math.cos(a_), dc.y + 1.5 * math.sin(a_), 0))
        strut(BMS['steel'], lg + Vector((0, 0, g - 0.3)), lg + Vector((0, 0, g + 3.5)), 0.2, 0.2)
    crusher_top = g + 22.3
    # the gallery: an open Warren truss from the crusher house toward the outside wall, over the floor road, to a head tower on the rim
    dirv = NL[i5]; A = Vector((CR.x, CR.y, g + 15.5)); L1 = 80 + BD[-1][i5] + 36; E2 = A + dirv * L1
    samples = [(k / 40, gz(*(A + dirv * L1 * k / 40).to_2d())) for k in range(41)]
    ze = max((zg + 4.5 - A.z * (1 - k)) / k for k, zg in samples if k > 0.05)      # the end height that keeps the underside 3 m over every sample
    E = Vector((E2.x, E2.y, max(ze, A.z)))
    zl = lambda k: A.z + (E.z - A.z) * k
    road_k = (BD[-1][i5] + 36) / L1; log('gallery underside over the road', round(zl(road_k) - 1.5 - CL[i5].z, 1), 'm; end', round(E.z, 1))
    assert zl(road_k) - 1.5 - CL[i5].z >= 8, 'the gallery must clear the floor road by 8 m'
    sv = Vector((-dirv.y, dirv.x, 0)); UZ = Vector((0, 0, 1)); A0 = A + dirv * 8; npan = int((E - A0).length / 4)
    PK_ = lambda k, lat, dz: A0 + (E - A0) * (k / npan) + sv * lat + UZ * dz
    for sg in (1, -1):
        for dz in (-1.5, 1.5): strut(BMS['steel'], PK_(0, 1.5 * sg, dz), PK_(npan, 1.5 * sg, dz), 0.25, 0.25)     # chords
        for k in range(npan): strut(BMS['steel'], PK_(k, 1.5 * sg, -1.5 if k % 2 == 0 else 1.5), PK_(k + 1, 1.5 * sg, 1.5 if k % 2 == 0 else -1.5), 0.18, 0.18)     # diagonals
    for k in range(npan + 1):
        strut(BMS['steel'], PK_(k, -1.5, -1.5), PK_(k, 1.5, -1.5), 0.2, 0.2)
        if k % 2 == 0: strut(BMS['steel'], PK_(k, -1.5, 1.5), PK_(k, 1.5, 1.5), 0.15, 0.15)
    strut(BMS['steel'], PK_(0, 0, -1.42), PK_(npan, 0, -1.42), 3.0, 0.1)            # the walkway deck
    strut(BMS['steel'], PK_(0, 1.3, -0.45), PK_(npan, 1.3, -0.45), 0.05, 0.05)      # its handrail
    hd = [(math.cos(math.pi * q / 8), math.sin(math.pi * q / 8)) for q in range(9)]   # the belt's half-round hood, 8 segments
    hv = [[BMS['corr'].verts.new(PK_(k, -0.45 + 0.85 * c_, -1.36 + 0.85 * s_)) for c_, s_ in hd] for k in (0, npan)]
    for q in range(8): BMS['corr'].faces.new([hv[0][q], hv[1][q], hv[1][q + 1], hv[0][q + 1]])
    ge = gz(E.x, E.y)      # the head tower: an open braced frame, a clad head house, a stair up one side
    box(BMS['clad'], Vector((E.x, E.y, E.z + 1.0)), (7, 7, 5), HEAD[i5])
    HT_ = lambda a_, b2, z: Vector((E.x, E.y, z)) + sv * a_ + dirv * b2
    for a_, b2 in ((-3, -3), (-3, 3), (3, -3), (3, 3)): strut(BMS['steel'], HT_(a_, b2, ge - 0.4), HT_(a_, b2, E.z - 1.5), 0.35, 0.35)
    lvls = list(np.linspace(ge + 0.3, E.z - 1.6, max(2, int((E.z - 1.6 - ge) / 3.5) + 1)))
    for z0_, z1_ in zip(lvls, lvls[1:]):
        for (a0, b0), (a1, b1) in (((-3, -3), (3, -3)), ((-3, 3), (3, 3)), ((-3, -3), (-3, 3)), ((3, -3), (3, 3))):
            strut(BMS['steel'], HT_(a0, b0, z1_), HT_(a1, b1, z1_), 0.2, 0.25)
            strut(BMS['steel'], HT_(a0, b0, z0_), HT_(a1, b1, z1_), 0.12, 0.12); strut(BMS['steel'], HT_(a1, b1, z0_), HT_(a0, b0, z1_), 0.12, 0.12)
    for q, (z0_, z1_) in enumerate(zip(lvls, lvls[1:])):      # the stair: flights in two lanes on the tower's -sv side
        ln = -3.6 if q % 2 == 0 else -4.5; b0, b1 = (-2.5, 2.5) if q % 2 == 0 else (2.5, -2.5)
        strut(BMS['steel'], HT_(ln, b0, z0_), HT_(ln, b1, z1_), 0.85, 0.12)
        strut(BMS['steel'], HT_(ln - 0.45, b0, z0_ + 1), HT_(ln - 0.45, b1, z1_ + 1), 0.05, 0.05)
    for k in range(1, int(L1 / 18)):        # A-frame trestles every 18 m with an X brace and a cap beam, none inside the barriers
        p = A + dirv * (18 * k); j, d = near(p.x, p.y)
        if d < max(BD[1][j], BD[-1][j]) + 2 or (p - E).to_2d().length < 8 or (p - A).to_2d().length < 10: continue
        zg = gz(p.x, p.y); top = zl(18 * k / L1) - 1.6; Q = lambda lat, z: Vector((p.x, p.y, z)) + sv * lat
        for sg in (1, -1): strut(BMS['steel'], Q(3.0 * sg, zg - 0.4), Q(1.6 * sg, top), 0.4, 0.4)
        zm = zg + (top - zg) * 0.25; zn = zg + (top - zg) * 0.75; wm, wn = 3.0 - 1.4 * 0.25, 3.0 - 1.4 * 0.75
        strut(BMS['steel'], Q(-wm, zm), Q(wn, zn), 0.18, 0.18); strut(BMS['steel'], Q(wm, zm), Q(-wn, zn), 0.18, 0.18)
        strut(BMS['steel'], Q(-2.0, top + 0.05), Q(2.0, top + 0.05), 0.5, 0.3)
    for dd, lat, hh in ((34, -14, 15), (62, 16, 18), (88, -10, 12)):      # ore stockpiles past the head tower
        c_ = E + dirv * dd + sv * lat; rr = hh / math.tan(math.radians(35)); j, d = near(c_.x, c_.y)
        if d < max(BD[1][j], BD[-1][j]) + rr + 8: continue
        ST_PILES.append((c_.x, c_.y, rr, gz(c_.x, c_.y) - 0.6, hh))
    # the workshop shed: clad walls, a corrugated gable roof, three roller doors toward the road
    yaw = HEAD[iS]; g = ZF + 20.5; M_ = Matrix.Translation((SH.x, SH.y, g)) @ Matrix.Rotation(yaw, 4, 'Z')
    box(BMS['clad'], M_ @ Vector((0, 0, 4.3)), (30, 18, 9.4), yaw)
    rf = [BMS['corr'].verts.new(M_ @ Vector(p)) for p in ((-15.4, -9.4, 9), (15.4, -9.4, 9), (15.4, 0, 10.6), (-15.4, 0, 10.6), (-15.4, 9.4, 9), (15.4, 9.4, 9))]
    for q in ((0, 1, 2, 3), (3, 2, 5, 4)): BMS['corr'].faces.new([rf[k] for k in q])
    for xg in (-15, 15):
        f = BMS['clad'].faces.new([BMS['clad'].verts.new(M_ @ Vector(p)) for p in ((xg, -9, 9), (xg, 9, 9), (xg, 0, 10.5))][::1 if xg > 0 else -1])
    for xd in (-9, 0, 9):
        BMS['door'].faces.new([BMS['door'].verts.new(M_ @ Vector(p)) for p in ((xd - 2.6, -9.06, 0), (xd + 2.6, -9.06, 0), (xd + 2.6, -9.06, 6.2), (xd - 2.6, -9.06, 6.2))])
    # the water tank: a smooth 32-sided drum and a low cone roof on a concrete plinth
    c = Vector((TK.x, TK.y, ZF + 20.2)); cyl(BMS['concrete'], c, 7.8, 7.8, 0.8, n=32)
    b_ = BMS['corr']; nf = len(b_.faces); top = cyl(b_, c + Vector((0, 0, 0.8)), 7, 7, 9, n=32, cap=False)
    TANK = list(b_.faces)[nf:]
    apex = b_.verts.new(c + Vector((0, 0, 11.2)))
    for k in range(32): b_.faces.new([top[k], top[(k + 1) % 32], apex])
for k, b_ in BMS.items():
    if not b_.faces: b_.free(); continue
    planar_uv(b_, UVS[k])
    if k == 'corr':      # the drum: wrapped by arc length, ribs upright
        uv = b_.loops.layers.uv.verify()
        for f in TANK:
            f.smooth = True
            for l in f.loops: p = l.vert.co - TK; l[uv].uv = (math.atan2(p.y, p.x) % (2 * math.pi) * 7 / 3, l.vert.co.z / 3)
            if max(l[uv].uv.x for l in f.loops) - min(l[uv].uv.x for l in f.loops) > 5:      # the wrap seam: the last segment runs past 2 pi, not back to 0
                for l in f.loops:
                    if l[uv].uv.x < 1: l[uv].uv.x += 2 * math.pi * 7 / 3
    mesh_obj(f'{PFX} {k}', b_, [k], planar=False)

if ST_PILES:        # ore stockpiles: dark iron ore at its angle of repose over the laterite set, a pale dusty toe
    bm = bmesh.new(); vc = vcol_layer(bm); ORE, DUST = (0.32, 0.5, 0.75), (0.95, 0.85, 0.75); vcl = {}
    for x, y, rr, z0, hh in ST_PILES:
        R_ = []
        for fr, zf, col in ((1.0, 0.0, DUST), (0.86, 0.17, ORE), (0.4, 0.62, ORE), (0.07, 0.97, ORE)):
            row = []
            for q in range(32):
                a = 2 * math.pi * q / 32; w = 1 + 0.05 * fbm(math.cos(a) * 3 + x * 0.01, math.sin(a) * 3, 2)
                v = bm.verts.new((x + rr * fr * w * math.cos(a), y + rr * fr * w * math.sin(a), z0 + hh * zf)); vcl[v] = col; row.append(v)
            R_.append(row)
        apex = bm.verts.new((x, y, z0 + hh)); vcl[apex] = ORE
        for k in range(3):
            for q in range(32): bm.faces.new([R_[k][q], R_[k][(q + 1) % 32], R_[k + 1][(q + 1) % 32], R_[k + 1][q]])
        for q in range(32): bm.faces.new([R_[3][q], R_[3][(q + 1) % 32], apex])
    for f in bm.faces:
        for l in f.loops: l[vc] = (*vcl[l.vert], 1)
    mesh_obj(f'{PFX} stockpiles', bm, ['ground'], smooth=True)
    log('stockpiles', len(ST_PILES))

# ------------------------------------------------------------------------------------------------ boulders: three displaced icospheres, baked: talus at the bench toes, rocks in the windrows, the rest scattered
PROTO = []
for k in range(3):
    t = bmesh.new(); r = bmesh.ops.create_icosphere(t, subdivisions=1, radius=1.0)
    PROTO.append([v.co * (1 + 0.32 * noise.noise(v.co * 1.6 + Vector((k * 7.1, k * 3.3, 0)))) * Vector((1, 1, 0.72)) for v in r['verts']]); t.free()
rk = bmesh.new(); nr = 0
def rock(x, y, z, sz):
    global nr
    M_ = Matrix.Translation((x, y, z - 0.3 * sz)) @ Matrix.Rotation(RNG.uniform(0, 6.3), 4, 'Z') @ Matrix.Scale(sz, 4)
    r = bmesh.ops.create_icosphere(rk, subdivisions=1, radius=1.0)
    for v, p in zip(r['verts'], PROTO[nr % 3]): v.co = M_ @ (p * Vector((RNG.uniform(0.85, 1.15), 1, 1)))
    nr += 1
# 24 talus clusters on the berm just below a toe (outside the loop the toe is at s = 0 mod 14, inside at s = FW)
CI = [(RNG.choice((1, -1)), RNG.randrange(3), RNG.randrange(N)) for _ in range(60)]
CI = [(sd, kb, i) for sd, kb, i in CI if IN_STRETCH(i)]
TS = np.array([14 * kb - 0.8 if sd > 0 else 14 * kb + FW + 0.8 for sd, kb, i in CI]); TD = np.array([BD[sd][i] + 6 for sd, kb, i in CI]) + TS
for _ in range(4):
    P = np.array([off(i, sd * d).to_2d() for (sd, kb, i), d in zip(CI, TD)]); hz = heights(P[:, 0], P[:, 1]); TD = TD + np.clip(TS - hz[4], -3, 3)
P = np.array([off(i, sd * d).to_2d() for (sd, kb, i), d in zip(CI, TD)]); hz = heights(P[:, 0], P[:, 1])
CC = [(sd, i, d) for (sd, kb, i), d, s_, ter, z in zip(CI, TD, hz[4], hz[5], hz[0]) if abs(s_ - (14 * kb - 0.8 if sd > 0 else 14 * kb + FW + 0.8)) < 0.4 and ter and z > LAKE + 0.4][:24]
RP = []
for sd, i, d in CC:
    for q in range(5): RP.append((off(i, sd * (d + RNG.uniform(-0.7, 0.7))) + T[i].to_3d() * RNG.uniform(-3, 3), RNG.uniform(0.3, 0.6) if q % 2 else RNG.uniform(0.6, 1.2)))
RZ = heights(np.array([p.x for p, _ in RP]), np.array([p.y for p, _ in RP]))[0] if RP else []
for (p, sz), z in zip(RP, RZ): rock(p.x, p.y, z, sz)
ntal = nr
for _ in range(60):     # rocks in the windrows, on their slopes
    i, sd = RNG.randrange(N), RNG.choice((1, -1))
    if not IN_STRETCH(i): continue
    p = off(i, sd * (BD[sd][i] + RNG.choice((1.5, 4.0))), 0.2); rock(p.x, p.y, p.z, RNG.uniform(0.3, 0.8))
nwr = nr - ntal
cand = np.array([(RNG.uniform(X0 + 30, X1 - 30), RNG.uniform(Y0 + 30, Y1 - 30)) for _ in range(5000)])
CZ, CD, CB, *_ = heights(cand[:, 0], cand[:, 1]); EZ = [heights(cand[:, 0] + dx, cand[:, 1] + dy)[0] for dx, dy in ((2, 0), (0, 2))]
for (x, y), z, d, bd, zx, zy in zip(cand, CZ, CD, CB, *EZ):
    if nr >= 250: break
    if d < bd + 5 or z < LAKE + 0.4 or math.hypot(zx - z, zy - z) > 0.5 or not IN_STRETCH(near(x, y)[0]): continue       # behind the windrow, on flat ground, dry
    if any(math.hypot(x - sx, y - sy) < sr + 6 for sx, sy, sr, _ in PADS) or any(math.hypot(x - sx, y - sy) < sr + 3 for sx, sy, sr, _, _ in ST_PILES): continue
    rock(x, y, z, RNG.uniform(0.6, 1.6) * (1 + 0.8 * (RNG.random() < 0.15)))
for f in rk.faces: f.smooth = True
mesh_obj(f'{PFX} rocks', rk, ['rock'])
log('boulders', nr, '(talus', ntal, 'windrow', nwr, ')')

collision(ground_col)
LM = [{'name': 'Crusher', 'pos': to_game(Vector((CR.x, CR.y, crusher_top or ZF)))}]
write_track('Pilbara Pit', ['Textures: Poly Haven (CC0); see tracks/pilbara/CREDITS.md'], ['day', 'dusk'], 'day', LM)
export()
