"""Venice: a fictional street circuit on a lagoon island, from the user's sketch (source/user_sketch.png, plan_layout.py -> track-viewer/docs/career-worlds/venice.json). Runs in the game: tracks.js, venue/venice.js. Reviewed in Blender first (render_views.py -> out/venice_review.blend), then node pack-web.mjs and SYNC_ONLY=venice node track-viewer/scripts/sync-assets.mjs.
Buildings near the road and facing it get real depth (venice_kit.py), the rest stay plain: the budget goes on what a driver sees.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/venice/build_venice.py -Log D:/RaceUltimate/tracks/venice/build_venice.log
A figure-eight, no fiction about real motor racing in Venice: clockwise on the upper loop, the deck straight on a stone viaduct at +9 m, over the road below and down into the lower loop; the lower loop's top
straight falls to -3 m through a Bridge of Sighs mouth into the tunnel under the deck's wide podium, and climbs back up the left side. Shared code: tracks/career_lib.py; crossing as Infinia (tracks/infinia/build_infinia.py).
Heights below are over the ground datum GL: career_lib puts the start line at z = 0, and the start line stands 3 m over the ground. Day and dusk only: no lights.json."""
import bpy
from pathlib import Path
H = Path(r'D:/RaceUltimate/tracks/venice'); ID = 'venice'; PFX = 'VE'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
import numpy as np

GL = (M @ Vector((0, 0, 0))).z; KS = SRC['sketchScale']
def Z(h): return GL + h
def hr(i): return CL[i].z - GL      # the road's height over the datum
def PX(x, y): p = M @ Vector((x * KS, -y * KS, 0)); return (p.x, p.y)
def polygon(pts): return [PX(*p) for p in pts]
def smooth(pts): return [(p[0], p[1]) for p in catmull([(x, y, 0) for x, y in pts], per=6)]
# the sketch's shapes, in its pixels
LAKE = polygon(smooth([(655,287),(690,295),(722,318),(728,345),(708,380),(720,398),(765,398),(835,378),(890,368),(960,378),(1012,392),(1028,420),(1025,465),(1005,505),(975,535),(910,548),(855,563),(800,550),(760,538),(685,535),(662,492),(630,480),(560,478),(535,455),(522,400),(530,345),(570,308)]))
GARDEN = polygon(smooth([(580,255),(575,272),(540,300),(510,325),(492,370),(497,445),(520,490),(570,520),(640,540),(700,552),(645,570),(560,560),(450,555),(350,553),(305,535),(285,480),(283,400),(295,320),(340,275),(440,252),(530,243)]))
PODIUM = polygon([(315,612),(575,600),(575,710),(283,716),(273,688),(291,654)])      # the grey band's wide end: the sketch's corner, 15 m further south to roof the road below, its east face at the portal
CANAL = polygon(smooth([(395,806),(430,790),(560,786),(700,792),(840,788),(980,784),(1085,790),(1110,806),(1085,822),(980,820),(840,824),(700,828),(560,822),(430,822)]))      # inside the lower loop: about 45 m wide
HQ_RECT = [(265,230),(505,185),(525,60),(262,65)]
BLOCKS = [polygon(p) for p in ([(700,95),(965,125),(955,190),(685,175)], [(1085,143),(1232,220),(1160,300),(1015,208)], [(1172,337),(1322,340),(1285,535),(1168,510)])]
def in_poly(x, y, P):
    c = False
    for k in range(len(P)):
        (x0, y0), (x1, y1) = P[k], P[k - 1]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0: c = not c
    return c
def edge_tree(P, step=3.0):
    pts = []
    for k in range(len(P)):
        a, b = Vector(P[k]), Vector(P[k - 1]); n_ = max(1, int((a - b).length / step))
        pts += [a.lerp(b, q / n_) for q in range(n_)]
    t = KDTree(len(pts))
    for q, p in enumerate(pts): t.insert((p.x, p.y, 0), q)
    t.balance(); return t
TLAKE, TGARDEN, TCANAL = edge_tree(LAKE), edge_tree(GARDEN), edge_tree(CANAL)
BUILT = BLOCKS + [polygon(HQ_RECT)]; TBUILT = [edge_tree(P) for P in BUILT]
def built_d(x, y): return min(0.0 if in_poly(x, y, P) else t.find((x, y, 0))[2] for P, t in zip(BUILT, TBUILT))
def signed(x, y, P, t): d = t.find((x, y, 0))[2]; return d if in_poly(x, y, P) else -d      # + inside

# ------------------------------------------------------------------------------------------------ the legs
ST = lambda s: int(round(s / STEP)) % N
CI, CJ = ST(SRC['crossing']['top_at_m']), ST(SRC['crossing']['under_at_m'])
UPPER = [(CL[i].x, CL[i].y) for i in list(range(CJ, N, 4)) + list(range(0, CI, 4))]
D0 = next(i for i in range(ST(1100), ST(1600)) if hr(i) >= 7.2); D1 = next(i for i in range(ST(2500), CI, -1) if hr(i) >= 4.6)
DECK = [D0 <= i <= D1 for i in range(N)]
LOW = [ST(3900) <= i <= ST(5350) for i in range(N)]
CUT = [LOW[i] and hr(i) < -0.3 for i in range(N)]
ROOF = [LOW[i] and in_poly(CL[i].x, CL[i].y, PODIUM) for i in range(N)]
R_ = [i for i in range(N) if ROOF[i]]; R0, R1 = R_[0], R_[-1]
assert R_ == list(range(R0, R1 + 1)) and R0 < CJ < R1, 'the tunnel is one run under the crossing'
PTOP, TCLEAR = 6.6, 7.0      # the podium's top, the tunnel's clear height
DP = [i for i in range(D0, D1 + 1) if in_poly(CL[i].x, CL[i].y, PODIUM)]
assert all(hr(i) >= PTOP + 0.3 for i in DP), f'the deck dips into the podium: {min(hr(i) for i in DP):.2f}'
assert all(hr(i) + TCLEAR <= PTOP - 0.4 for i in R_), f'no room for the tunnel roof: {max(hr(i) for i in R_):.2f}'
LOWER = [(CL[i].x, CL[i].y) for i in range(CI, CJ, 16)]; UPPER_C = UPPER[::4]
for P in [UPPER_C, LOWER] + [polygon(p) for p in ([(1340,780),(1470,780),(1470,1000),(1340,1000)], [(165,700),(262,700),(262,785),(165,785)], [(705,930),(1090,930),(1090,1050),(705,1050)])]:
    BUILT.append(P); TBUILT.append(edge_tree(P))
log('deck', round(D0 * STEP), round(D1 * STEP), 'tunnel', round(R0 * STEP), round(R1 * STEP), round((R1 - R0) * STEP), 'm; road to road', round(hr(CI) - hr(CJ), 2), 'm')

# ------------------------------------------------------------------------------------------------ materials
ROADTEX = ROOT / 'tracks' / 'drylake' / 'tex' / 'asphalt_track_bleached_diff_2k.jpg'
MAT.update({
    'asphalt': material('VE | asphalt', tex='asphalt_track', rough=0.72, diff=ROADTEX),
    'line': material('VE | line white', (0.62, 0.62, 0.6), 0.6),
    'kerb_r': material('VE | kerb red', (0.55, 0.06, 0.05), 0.6),
    'kerb_w': material('VE | kerb white', (0.66, 0.66, 0.63), 0.6),
    'barrier': material('VE | barrier', tex='concrete_wall_009'),
    'grass': material('VE | grass', tex='leafy_grass', vcol=True),
    'pave': material('VE | paving', tex='pavement_01', vcol=True),
    'stone': material('VE | stone', tex='medieval_blocks_03', vcol=True, diff=H / 'tex' / 'limestone_diff_2k.jpg'),
    'lime': material('VE | limestone', tex='medieval_blocks_03', vcol=True, diff=H / 'tex' / 'limestone_diff_2k.jpg'),
    'limes': material('VE | dressed limestone', tex='white_stucco', vcol=True, diff=H / 'tex' / 'limestone_smooth_diff_2k.jpg'),
    'soot': material('VE | sooted sandstone', tex='large_sandstone_blocks', vcol=True),
    'ochre': material('VE | ochre plaster', tex='yellow_plaster', vcol=True),
    'red': material('VE | red plaster', tex='red_plaster_weathered', vcol=True),
    'rose': material('VE | rose plaster', tex='peeling_painted_wall', vcol=True),
    'worn': material('VE | worn plaster', tex='damaged_plaster', vcol=True),
    'brick': material('VE | red brick', tex='medieval_red_brick', vcol=True),
    'dbrick': material('VE | dark brick', tex='brick_wall_10', vcol=True),
    'tile': material('VE | clay tile', tex='clay_roof_tiles_02', vcol=True, diff=H / 'tex' / 'tile_muted_diff_2k.jpg'),
    'slate': material('VE | slate', tex='roof_slates_02', vcol=True),
    'lead': material('VE | lead', tex='grey_roof_01', vcol=True),
    'iron': material('VE | cast iron', (0.035, 0.05, 0.045), 0.42, 0.6),
    'lozenge': material('VE | lozenge stone', tex='white_stucco', vcol=True, diff=H / 'tex' / 'lozenge_diff.jpg'),
    'hedge': material('VE | clipped hedge', tex='leafy_grass', vcol=True),
    'stake': material('VE | timber', tex='weathered_planks', vcol=True),
    'piazza': material('VE | piazza paving', tex='pavement_01', vcol=True, diff=H / 'tex' / 'piazza_diff.jpg'),
    'canvas': material('VE | canvas', tex='white_plaster_02', vcol=True),
    'cloth2': material('VE | painted pole', (0.8, 0.8, 0.8), 0.5, vcol=True),
    'paint': material('VE | road paint', tex='asphalt_track', vcol=True, diff='none'),
    'glass': material('VE | window glass', (0.015, 0.02, 0.026), 0.14),
    'frame': material('VE | window frame', (0.05, 0.045, 0.04), 0.6),
    'plaster': material('VE | plaster', tex='white_stucco', vcol=True),
    'roof': material('VE | roof', tex='grey_roof_01', vcol=True),
    'seats': material('VE | seats', tex='concrete_wall_009', vcol=True),
    'steel': material('VE | steel', (0.3, 0.3, 0.31), 0.72, 0.12),
    'dark': material('VE | openings', (0.015, 0.016, 0.02), 0.5),
    'water': material('VE | water', (0.035, 0.085, 0.09), 0.09),
    'timber': material('VE | timber', tex='weathered_planks', vcol=True),
    # under the roof nothing lights a wall but the hidden light lines: these copies carry a little of their warmth (as Infinia's tunnel)
    'tsoot': material('VE | tunnel base', tex='large_sandstone_blocks', vcol=True, emit=((0.75, 0.6, 0.42), 0.09)),
    'tlime': material('VE | tunnel stone', tex='medieval_blocks_03', vcol=True, diff=H / 'tex' / 'limestone_diff_2k.jpg', emit=((0.8, 0.66, 0.46), 0.15)),
    'tbrick': material('VE | tunnel vault', tex='medieval_red_brick', vcol=True, emit=((0.8, 0.5, 0.32), 0.14)),
    'tfloor': material('VE | tunnel floor', tex='asphalt_track', rough=0.72, diff=ROADTEX, emit=((0.95, 0.8, 0.6), 0.1)),
    'tlight': material('VE | tunnel light', (0.9, 0.8, 0.62), 0.4, emit=((1.0, 0.78, 0.5), 1.8)),
})
UVS.update({'tsoot': 5.0, 'tlime': 3.4, 'tbrick': 2.0, 'lozenge': 3.2, 'hedge': 3.0, 'stake': 1.6, 'piazza': 18.0, 'canvas': 2.0, 'paint': 3.5, 'iron': 3.0, 'limes': 3.0, 'lime': 3.4, 'soot': 5.0, 'ochre': 3.5, 'red': 3.5, 'rose': 3.5, 'worn': 3.5, 'brick': 2.0, 'dbrick': 2.0, 'tile': 2.8, 'slate': 3.2, 'lead': 4.0, 'timber': 1.6, 'tfloor': 3.5, 'asphalt': 3.5, 'grass': 7.0, 'pave': 4.0, 'stone': 3.4, 'plaster': 5.0, 'roof': 4.0, 'water': 50.0})
_wt = MAT['water'].node_tree; _np = _wt.nodes.new('ShaderNodeTexNoise'); _np.inputs['Scale'].default_value = 0.7; _np.inputs['Detail'].default_value = 5.0; _tc = _wt.nodes.new('ShaderNodeNewGeometry'); _wt.links.new(_tc.outputs['Position'], _np.inputs['Vector'])
_bp = _wt.nodes.new('ShaderNodeBump'); _bp.inputs['Strength'].default_value = 0.16; _bp.inputs['Distance'].default_value = 0.4; _wt.links.new(_np.outputs[0], _bp.inputs['Height']); _wt.links.new(_bp.outputs[0], _wt.nodes['Principled BSDF'].inputs['Normal'])
ISTRIAN, WEATHERED = (0.86, 0.83, 0.74), (0.55, 0.53, 0.48)
OCHRE = [(0.82, 0.62, 0.36), (0.74, 0.46, 0.27), (0.62, 0.27, 0.17), (0.85, 0.74, 0.55), (0.72, 0.36, 0.26), (0.5, 0.2, 0.14)]      # plaster and brick, the research's palette in linear-ish colour
TILE = (0.55, 0.2, 0.11)
class Sheet:
    """one mesh of several materials"""
    def __init__(s, name, keys): s.name, s.keys, s.bm = name, keys, bmesh.new(); s.vc = vcol_layer(s.bm)
    def face(s, pts, k, col=(1, 1, 1)):
        f = s.bm.faces.new([s.bm.verts.new(p) for p in pts]); f.material_index = s.keys.index(k)
        for l in f.loops: l[s.vc] = (*col, 1)
        return f
    def quad_strip(s, rows, k, col=(1, 1, 1)):
        for a, b in zip(rows, rows[1:]):
            for q in range(len(a) - 1): s.face([a[q], b[q], b[q + 1], a[q + 1]], k, col)
    def block(s, c, size, yaw, k, col=(1, 1, 1), top=True):      # c: centre of the base
        Mx = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z'); sx, sy, h_ = size[0] / 2, size[1] / 2, size[2]
        p = [Mx @ Vector(v) for v in ((-sx, -sy, 0), (sx, -sy, 0), (sx, sy, 0), (-sx, sy, 0), (-sx, -sy, h_), (sx, -sy, h_), (sx, sy, h_), (-sx, sy, h_))]
        for q in ((0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)) + (((4, 5, 6, 7),) if top else ()): s.face([p[v] for v in q], k, col)
        return p
    def done(s, **kw): return mesh_obj(s.name, s.bm, s.keys, **kw)
def opening(sh, a, u, w, z0, z1, rise, out=0.15, gothic=True, k='dark', col=(1, 1, 1)):
    """a window or arch on a solid wall: `a` the point on the wall at its centre, u the wall's unit direction, its right-hand normal the outward one. Near the road it stands proud in a stone frame with reveals and glazing bars,
    so it throws shadow; beyond 75 m (or set into a wall, out <= 0) a flat shape is enough. Pointed head for gothic, round otherwise"""
    n_ = Vector((u.y, -u.x, 0)); UPV = Vector((0, 0, 1)); segs = 4 if w < 2 else 8
    def outline(hw, zl, zh, rs):
        pts = [(-hw, zl), (hw, zl)]
        for q in range(segs + 1):
            t = 1 - 2 * q / segs; pts.append((t * hw, zh + (rs * (1 - abs(t)) ** 0.75 if gothic else rs * math.sqrt(max(0, 1 - t * t)))))
        return pts
    P = lambda pt, d: a + u * pt[0] + UPV * pt[1] + n_ * d
    inner = outline(w / 2, z0, z1, rise); ni_, nd_ = near(a.x, a.y)
    if nd_ > 240 or (CL[ni_] - a).to_2d().dot(n_.to_2d()) < -0.3 * max(nd_, 1.0): return      # not seen from the road
    if out <= 0 or nd_ > 48 or k != 'dark':
        sh.face([P(p, out) for p in inner], k, col); return
    fr = 0.26; fw = max(0.14, w * 0.09); FC = (0.8, 0.77, 0.7); outer = outline(w / 2 + fw, z0 - fw, z1, rise + fw)
    sh.face([P(p, 0.03) for p in inner], k, col)
    m = len(inner)
    for q in range(m):
        i0, i1, o0, o1 = inner[q], inner[(q + 1) % m], outer[q], outer[(q + 1) % m]
        sh.face([P(i1, fr), P(i0, fr), P(i0, 0.03), P(i1, 0.03)], 'stone', (FC[0] * 0.8, FC[1] * 0.8, FC[2] * 0.8))      # the reveal
        sh.face([P(i0, fr), P(i1, fr), P(o1, fr), P(o0, fr)], 'stone', FC)      # the frame's face
        sh.face([P(o0, fr), P(o1, fr), P(o1, 0.0), P(o0, 0.0)], 'stone', FC)      # its side, back to the wall
    if w > 0.9:      # glazing bars
        top = z1 + rise * 0.8; bw = 0.05
        sh.face([P((-bw, z0), 0.08), P((bw, z0), 0.08), P((bw, top), 0.08), P((-bw, top), 0.08)], 'stone', FC)
        zm = (z0 + z1) / 2; hb = w / 2; sh.face([P((-hb, zm - bw), 0.08), P((hb, zm - bw), 0.08), P((hb, zm + bw), 0.08), P((-hb, zm + bw), 0.08)], 'stone', FC)

# ------------------------------------------------------------------------------------------------ road and walls: parapets close on the deck and in the cutting; run-off grows round the corners
road(7.5, 110)
CLOSE = [DECK[i] or CUT[i] for i in range(N)]; CLOSE_NEAR = [any(CLOSE[(i + k) % N] for k in range(-24, 25)) for i in range(N)]
CORNERZ = [any(R[(i + k) % N] < 170 for k in range(-24, 25)) for i in range(N)]
barriers(lambda i: HW + 1.6 if CLOSE_NEAR[i] else (28.0 if CORNERZ[i] else 15.0))
for sd in (1, -1):
    for i in range(0, N, 2):
        p = off(i, sd * BD[sd][i]); j, d = near(p.x, p.y)
        if abs(CL[j].z - CL[i].z) < 5: assert d > HW + 1.0, f'the wall at station {i} stands on the road at station {j}'

# ------------------------------------------------------------------------------------------------ ground: an island in the lagoon; the road's ground follows the road, except where it flies or sinks
ground_st = [i for i in range(N) if not DECK[i] and not CUT[i]]
KG = KDTree(len(ground_st))
for i in ground_st: KG.insert((CL[i].x, CL[i].y, 0), i)
KG.balance()
cut_st = [i for i in range(N) if CUT[i]]
KC = KDTree(len(cut_st))
for i in cut_st: KC.insert((CL[i].x, CL[i].y, 0), i)
KC.balance()
H_IN, WATER, WL, LAND, GARDEN_UP = 2.5, 1.7, -0.7, 290.0, 1.5      # infield level, lake surface, lagoon surface, how far the grid's fine cells reach from the road, garden's rise
def level(x, y):
    dc = KC.find((x, y, 0))[2]; lv = 0.0
    if in_poly(x, y, UPPER):
        lv = H_IN * ss(HW + 16, HW + 110, dc)
        s = signed(x, y, GARDEN, TGARDEN)
        if s > -14: lv += GARDEN_UP * ss(0, 8, s)
        s = signed(x, y, LAKE, TLAKE)
        if s > 0: lv = WATER - 2.0
    elif signed(x, y, CANAL, TCANAL) > 0: lv = WL - 2.0
    return lv
def ground_z(x, y):
    _, ig, dg = KG.find((x, y, 0)); dc = KC.find((x, y, 0))[2]; da = near(x, y)[1]; lv = level(x, y)
    w_ = max(BD[1][ig], BD[-1][ig])
    if CUT[near(x, y)[0]]: h_ = lv
    else: h_ = (hr(ig) - 0.4) * (1 - ss(w_ + 3, w_ + 45, dg)) + lv * ss(w_ + 3, w_ + 45, dg)
    ld = da - 85 if da < 85 else min(da - 85, built_d(x, y) - 35)      # < 0 on the island
    return Z(h_ - 3.0 * ss(-15, 15, ld)), dg, dc, da, ig, ld
def axis(lo, hi, cell=8.0, edge=6000.0, grow=1.2):
    a = list(np.arange(lo, hi + cell, cell)); step = cell; x = a[0]
    while x > lo - edge: step *= grow; x -= step; a.insert(0, x)
    step = cell; x = a[-1]
    while x < hi + edge: step *= grow; x += step; a.append(x)
    return a
GX_, GY_ = axis(min(xs) - LAND - 40, max(xs) + LAND + 40), axis(min(ys) - LAND - 40, max(ys) + LAND + 40)
bm = bmesh.new(); vc = vcol_layer(bm); G = []; info = {}
for y in GY_:
    row = []
    for x in GX_:
        z, dg, dc, da, ig, ld = ground_z(x, y); v = bm.verts.new((x, y, z)); info[v] = (dg, dc, da, ig, ld); row.append(v)
    G.append(row)
ground_col = []
for r_ in range(len(GY_) - 1):
    for c in range(len(GX_) - 1):
        q = [G[r_][c], G[r_][c + 1], G[r_ + 1][c + 1], G[r_ + 1][c]]
        cx, cy = sum(v.co.x for v in q) / 4, sum(v.co.y for v in q) / 4; I_ = [info[v] for v in q]; up = in_poly(cx, cy, UPPER)
        if min(i_[1] for i_ in I_) < HW + 1.7: continue                      # over the cutting and the tunnel
        if max(v.co.z for v in q) < Z(WL) - 0.05: continue                   # under the lagoon: nobody sees it
        if max(i_[0] for i_ in I_) < HW - 0.6: continue                      # under the road
        if min(i_[2] for i_ in I_) < 70 and min(i_[1] for i_ in I_) > HW + 16: ground_col.append([v.co.copy() for v in q])
        grass = up and min(i_[0] for i_ in I_) > HW
        f = bm.faces.new(q); f.material_index = 0 if grass else 1
        for l in f.loops:
            p = l.vert.co; t_ = 0.82 + 0.2 * fbm(p.x / 45, p.y / 45, 3)
            if grass:
                g = max(0.0, min(1.0, (p.z - Z(H_IN)) / GARDEN_UP)); l[vc] = (0.5 * t_ - 0.26 * g, 0.66 * t_ - 0.1 * g, 0.34 * t_ - 0.14 * g, 1)
            else: l[vc] = (0.95 * t_, 0.93 * t_, 0.88 * t_, 1)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
mesh_obj('VE ground', bm, ['grass', 'pave'], smooth=True)
def road_cells(lo, hi, cell=64.0, edge=7000.0, grow=1.25):
    a = list(np.arange(lo, hi + cell, cell)); st_ = cell; x = a[0]
    while x > lo - edge: st_ *= grow; x -= st_; a.insert(0, x)
    st_ = cell; x = a[-1]
    while x < hi + edge: st_ *= grow; x += st_; a.append(x)
    return a
b = bmesh.new()      # one coarse sheet: the land stands over it, the canal shows it; only the sunken road must not, so cells near the cutting stay out
WX, WY = road_cells(min(xs) - 300, max(xs) + 300), road_cells(min(ys) - 300, max(ys) + 300)
for r_ in range(len(WY) - 1):
    for c in range(len(WX) - 1):
        q = [(WX[c], WY[r_]), (WX[c + 1], WY[r_]), (WX[c + 1], WY[r_ + 1]), (WX[c], WY[r_ + 1])]; m_ = (sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4)
        if min(KC.find((x_, y_, 0))[2] for x_, y_ in q + [m_]) < HW + 62: continue
        f = b.faces.new([b.verts.new((x_, y_, Z(WL))) for x_, y_ in q]); f.material_index = 0
f = b.faces.new([b.verts.new((x, y, Z(WATER))) for x, y in LAKE]); f.material_index = 0
mesh_obj('water', b, ['water'])
# a stone edge round the raised garden and the lake, so both read as the sketch's shapes
RG = Sheet('VE garden and lake edges', ['stone', 'pave'])
def ring(P, z0, z1, prom=0.0):
    pts = [Vector(p) for p in P]; m_ = len(pts); out = []
    for k in range(m_):      # outward at each point: the walk stays one strip round the bends
        u = (pts[(k + 1) % m_] - pts[k - 1]).normalized(); n_ = Vector((u.y, -u.x))
        out.append(pts[k] + (-n_ if in_poly(*(pts[k] + n_), P) else n_) * prom)
    for k in range(m_):
        a, b, ao, bo = pts[k], pts[(k + 1) % m_], out[k], out[(k + 1) % m_]
        RG.face([(a.x, a.y, z0(a)), (b.x, b.y, z0(b)), (b.x, b.y, z1(b)), (a.x, a.y, z1(a))], 'stone', WEATHERED)
        if prom: RG.face([(a.x, a.y, z1(a)), (b.x, b.y, z1(b)), (bo.x, bo.y, z1(b)), (ao.x, ao.y, z1(a))], 'pave', (0.86, 0.84, 0.78))      # a walk round the shore, over the ground cells' ragged edge
ring(GARDEN, lambda p: ground_z(p.x, p.y)[0] - 0.4, lambda p: Z(H_IN + GARDEN_UP + 0.2))
ring(LAKE, lambda p: Z(WATER - 0.6), lambda p: Z(H_IN + 0.25), prom=10.0)
ring(CANAL, lambda p: Z(WL - 0.6), lambda p: Z(0.25), prom=6.0)
RG.done()
log('ground', len(GX_), 'x', len(GY_), 'collision quads', len(ground_col), )
assert not any(in_poly(sum(p.x for p in q) / 4, sum(p.y for p in q) / 4, PODIUM) and near(sum(p.x for p in q) / 4, sum(p.y for p in q) / 4)[1] < HW and CUT[near(sum(p.x for p in q) / 4, sum(p.y for p in q) / 4)[0]] for q in ground_col), 'a ground collision quad lies over the road in the tunnel'

# ------------------------------------------------------------------------------------------------ the deck: a stone-arched viaduct 30 m wide; one wider Rialto span mid-way, seen from the road below
DW, PAR = 15.0, 1.1
ST_ = Sheet('VE deck', ['stone', 'pave', 'dark'])
RIALTO = min(range(D0, D1), key=lambda i: (Vector((CL[i].x, CL[i].y)) - Vector(PX(770, 606))).length)
i = D0
while i < D1:
    L_ = 14 if abs(i - RIALTO) < 8 else 8      # stations a bay: 35 m and 20 m
    L_ = min(L_, D1 - i)
    in_pod = in_poly(CL[i].x, CL[i].y, PODIUM) and in_poly(CL[i + L_].x, CL[i + L_].y, PODIUM)
    top = lambda j: CL[j].z + PAR
    bottom = Z(PTOP - 0.2) if in_pod else Z(-1.0)
    crown = min(CL[i + q].z for q in range(L_ + 1)) - (1.0 if L_ == 14 else 1.5)
    spring = Z(1.2 if L_ == 14 else 2.6)
    arched = not in_pod and L_ >= 4 and crown - spring > 2.0
    def arch(q):
        t_ = (q - L_ / 2) / (L_ / 2 - 1); return spring + (crown - spring) * math.sqrt(max(0.0, 1 - t_ * t_))
    for sd in (1, -1):
        for q in range(L_):
            a, b = i + q, i + q + 1
            if arched and 0 < q < L_ - 1: z0a, z0b = arch(q), arch(q + 1)
            else: z0a = z0b = bottom
            p = [off(a, sd * DW), off(b, sd * DW)]
            ST_.face([Vector((p[0].x, p[0].y, z0a)), Vector((p[1].x, p[1].y, z0b)), Vector((p[1].x, p[1].y, top(b))), Vector((p[0].x, p[0].y, top(a)))][::sd], 'stone', WEATHERED if z0a < Z(2) else ISTRIAN)
            ST_.face([off(a, sd * HW, -0.03), off(b, sd * HW, -0.03), off(b, sd * (DW - 0.5), -0.03), off(a, sd * (DW - 0.5), -0.03)][::sd], 'pave', (0.8, 0.77, 0.7))      # the walkway
            ST_.face([off(a, sd * (DW - 0.5), -0.03), off(b, sd * (DW - 0.5), -0.03), off(b, sd * (DW - 0.5), PAR), off(a, sd * (DW - 0.5), PAR)][::sd], 'stone', ISTRIAN)      # the parapet's inner face
            ST_.face([off(a, sd * (DW - 0.5), PAR), off(b, sd * (DW - 0.5), PAR), off(b, sd * DW, PAR), off(a, sd * DW, PAR)][::sd], 'stone', ISTRIAN)
    if arched:
        for q in (1, L_ - 1):      # the piers' inner faces
            a = i + q; A, B = off(a, -DW), off(a, DW)
            ST_.face([Vector((A.x, A.y, bottom)), Vector((B.x, B.y, bottom)), Vector((B.x, B.y, arch(q))), Vector((A.x, A.y, arch(q)))], 'stone', WEATHERED)
        for q in range(1, L_ - 1):      # the vault
            a, b = i + q, i + q + 1; A0, B0, A1, B1 = off(a, -DW), off(a, DW), off(b, -DW), off(b, DW)
            ST_.face([Vector((A0.x, A0.y, arch(q))), Vector((B0.x, B0.y, arch(q))), Vector((B1.x, B1.y, arch(q + 1))), Vector((A1.x, A1.y, arch(q + 1)))], 'stone', WEATHERED)
    i += L_
ST_.done()

# ------------------------------------------------------------------------------------------------ the podium over the tunnel, its portals, the tunnel, the cutting
P3 = Sheet('VE podium', ['stone', 'pave', 'dark'])
def seg_cross(a, b):
    """where the road below crosses the podium's edge a..b: the road's point, or None"""
    A, B = Vector(a), Vector(b)
    for i in (R0 - 1, R0, R1, R1 + 1):
        for j in (i, ):
            p0, p1 = CL[j].to_2d(), CL[j + 1].to_2d(); d1, d2 = B - A, p1 - p0; den = d1.x * d2.y - d1.y * d2.x
            if abs(den) < 1e-9: continue
            u = ((p0.x - A.x) * d2.y - (p0.y - A.y) * d2.x) / den; v = ((p0.x - A.x) * d1.y - (p0.y - A.y) * d1.x) / den
            if 0 <= u <= 1 and 0 <= v <= 1: return j, A + d1 * u
    return None
top_z = Z(PTOP); base_z = Z(-1.0)
for k_ in range(len(PODIUM)):
    a, b = Vector(PODIUM[k_]), Vector(PODIUM[(k_ + 1) % len(PODIUM)]); u = (b - a).normalized(); L_ = (b - a).length; hit = seg_cross(a, b); w_ = HW + 1.7
    def wall(s0, s1):
        if s1 - s0 < 0.01: return
        p0, p1 = a + u * s0, a + u * s1
        P3.face([(p0.x, p0.y, base_z), (p1.x, p1.y, base_z), (p1.x, p1.y, top_z), (p0.x, p0.y, top_z)], 'stone', WEATHERED)
    uu = u.to_3d()
    if hit:
        j, c = hit; sc_ = (c - a).dot(u); wall(0, sc_ - w_); wall(sc_ + w_, L_)
        zr = CL[j].z; spring, crown = zr + 3.6, zr + TCLEAR      # an arched mouth in the face
        row = []
        for q in range(13):
            t_ = q / 12 * 2 - 1; p = c + u * (t_ * w_); row.append(((p.x, p.y, spring + (crown - spring) * math.sqrt(max(0, 1 - t_ * t_))), (p.x, p.y, top_z)))
        for q in range(12): P3.face([row[q][0], row[q + 1][0], row[q + 1][1], row[q][1]], 'stone', ISTRIAN)
        for sd_ in (-1, 1):
            p = c + u * (sd_ * w_); P3.face([(p.x, p.y, base_z), (p.x, p.y, spring), (p.x + u.x * sd_ * 0.01, p.y + u.y * sd_ * 0.01, spring), (p.x + u.x * sd_ * 0.01, p.y + u.y * sd_ * 0.01, base_z)], 'stone', WEATHERED)
    else: wall(0, L_)
    # a blind arcade along each face, in the deck's language
    bays = int(L_ / 14)
    for q in range(bays):
        s_ = (q + 0.5) * L_ / bays; mid = a + u * s_
        if hit and abs(s_ - (hit[1] - a).dot(u)) < HW + 10: continue
        gz = Z(0.0)
        opening(P3, Vector((mid.x, mid.y, gz)), uu, 9.5, 0.0, 2.8, 2.4, out=-0.15 if in_poly(*(mid + Vector((u.y, -u.x)) * 2), PODIUM) else 0.15, gothic=False)
P3.face([(x, y, top_z) for x, y in PODIUM], 'pave', (0.82, 0.79, 0.72))
P3.done()

# the tunnel: walls and a roof under the podium, one continuous light line (no spaced lamps: no strobe); open cutting walls either side of it
TN = Sheet('VE tunnel', ['tsoot', 'tlime', 'tbrick', 'tlight', 'tfloor']); CW = Sheet('VE cutting', ['stone'])
APRON = []; ap = Sheet('VE aprons', ['pave'])
for i in range(N):
    if not CUT[i] or not CUT[(i + 1) % N]: continue
    a, b = i, (i + 1) % N; lat = HW + 1.7
    roofed = ROOF[a] and ROOF[b]
    if roofed: continue      # the vault, below
    wh = lambda j: Z(1.2)      # up past the aprons, a parapet on top
    for sd in (1, -1):
        CW.face([off(a, sd * lat, -0.4), off(b, sd * lat, -0.4), Vector((off(b, sd * lat).x, off(b, sd * lat).y, wh(b))), Vector((off(a, sd * lat).x, off(a, sd * lat).y, wh(a)))][::-sd], 'stone', WEATHERED)
        q = [Vector((p.x, p.y, Z(0.2))) for p in (off(a, sd * lat), off(b, sd * lat), off(b, sd * (lat + 14)), off(a, sd * (lat + 14)))][::sd]
        APRON.append(q); ap.face(q, 'pave', (0.8, 0.77, 0.7))
# the vault: a sooted stone base, limestone walls, a ledge carrying the hidden light, a brick barrel, and a stone rib every 20 m; the portals' own arch, springing 3.6 m, crown at the clear height
TL = HW + 1.7; SPRING = 3.6; RB = 8
def vault_prof(lat, crown=TCLEAR, spring=SPRING, n_=16):
    """half-span lat, from the left wall's foot over the crown to the right wall's foot: (lateral, height, material)"""
    out = [(-lat, -0.4, 'tsoot'), (-lat, 1.5, 'tlime'), (-lat, spring, 'tbrick')]
    for q in range(n_ + 1):
        t_ = -1 + 2 * q / n_; out.append((t_ * lat, spring + (crown - spring) * math.sqrt(max(0.0, 1 - t_ * t_)), 'tbrick'))
    return out + [(lat, spring, 'tlime'), (lat, 1.5, 'tsoot'), (lat, -0.4, 'tsoot')]
VP, VR = vault_prof(TL), vault_prof(TL - 0.32, TCLEAR - 0.32, SPRING + 0.1)
shade_ = lambda j, q, z: (0.9 + 0.2 * fbm(j * STEP / 13, z / 4.0, 2)) * (0.66 + 0.34 * ss(TCLEAR, SPRING, z))      # patchy along the tunnel, and dim toward the crown, away from the light; by height, not by facet, or the vault shows its facets as wedges
for j in range(R0, R1):
    j2 = j + 1
    for q in range(len(VP) - 1):
        (l0, z0, k_), (l1, z1, _) = VP[q], VP[q + 1]; v_ = shade_(j, q, (z0 + z1) / 2); c_ = (v_, v_ * 0.96, v_ * 0.9)
        TN.face([off(j, l0, z0), off(j, l1, z1), off(j2, l1, z1), off(j2, l0, z0)], k_, c_)
    for sd in (1, -1):      # a stone ledge at the springing, the light line on it, out of sight from a car's height
        i0, i1 = sd * (TL - 0.32), sd * TL
        TN.face([off(j, i0, SPRING - 0.2), off(j2, i0, SPRING - 0.2), off(j2, i0, SPRING), off(j, i0, SPRING)][::-sd], 'tlime', (0.86, 0.82, 0.74))
        TN.face([off(j, i0, SPRING), off(j2, i0, SPRING), off(j2, i1, SPRING), off(j, i1, SPRING)][::sd], 'tlime', (0.8, 0.76, 0.68))
        TN.face([off(j, i0, SPRING - 0.2), off(j2, i0, SPRING - 0.2), off(j2, i1, SPRING - 0.2), off(j, i1, SPRING - 0.2)][::-sd], 'tlime', (0.5, 0.48, 0.44))
        TN.face([off(j, sd * (TL - 0.26), SPRING + 0.02), off(j2, sd * (TL - 0.26), SPRING + 0.02), off(j2, sd * (TL - 0.05), SPRING + 0.12), off(j, sd * (TL - 0.05), SPRING + 0.12)][::sd], 'tlight')
    TN.face([off(j, -HW, 0.02), off(j2, -HW, 0.02), off(j2, HW, 0.02), off(j, HW, 0.02)], 'tfloor')
    if (j - R0) % RB == 2:      # a dressed stone rib, a station wide, standing in from the wall and vault
        for q in range(len(VR) - 1):
            (l0, z0, _), (l1, z1, _) = VR[q], VR[q + 1]; (o0, y0, _), (o1, y1, _) = VP[q], VP[q + 1]; c_ = (0.92, 0.88, 0.8) if z0 > 1.5 else (0.62, 0.6, 0.56)
            TN.face([off(j, l0, z0), off(j, l1, z1), off(j2, l1, z1), off(j2, l0, z0)], 'tlime' if z0 > 1.45 else 'tsoot', c_)
            TN.face([off(j, o0, y0), off(j, o1, y1), off(j, l1, z1), off(j, l0, z0)], 'tlime' if z0 > 1.45 else 'tsoot', (c_[0] * 0.8, c_[1] * 0.8, c_[2] * 0.8)); TN.face([off(j2, l0, z0), off(j2, l1, z1), off(j2, o1, y1), off(j2, o0, y0)], 'tlime' if z0 > 1.45 else 'tsoot', (c_[0] * 0.8, c_[1] * 0.8, c_[2] * 0.8))
_tu = TN.bm.loops.layers.uv.verify()      # the vault's courses run along the tunnel and round the arch: flat-mapped brick fans out into streaks at the crown
for f in TN.bm.faces:
    sc_ = UVS.get(TN.keys[f.material_index], 3.4)
    for l in f.loops:
        p = l.vert.co; i_ = KC.find((p.x, p.y, 0))[1]; la_ = abs((p.to_2d() - CL[i_].to_2d()).dot(NL[i_].to_2d())); zr = p.z - CL[i_].z
        l[_tu].uv = (p.x / sc_, p.y / sc_) if TN.keys[f.material_index] == 'tfloor' else (i_ * STEP / sc_, (zr if zr <= SPRING else SPRING + (TL - la_) + (zr - SPRING)) / sc_)      # the road itself lies flat
TN.done(planar=False); CW.done(); ap.done()

# the Bridge of Sighs form: an enclosed bridge with an arched underside, between two stone buildings that line the cutting up to the tunnel's mouth
BS = Sheet('VE bridge of sighs', ['stone', 'dark', 'roof'])
ib = (R0 - 9) % N; cb = CL[ib]; tt = T[ib].to_3d(); wall_lat = HW + 1.7; BT = 2.5      # half its thickness along the road
zc, zs_ = cb.z + TCLEAR + 0.6, cb.z + TCLEAR - 2.2      # the underside's crown and springing
ztop = zc + 5.0
def bpt(t_, along, z): p = off(ib, t_ * wall_lat); return Vector((p.x, p.y, z)) + tt * along
rows = []
for q in range(13):
    t_ = q / 12 * 2 - 1; zu = zs_ + (zc - zs_) * math.sqrt(max(0, 1 - t_ * t_)); zt = ztop + 1.4 * (1 - t_ * t_)      # the arched underside, the Baroque curved top
    rows.append((t_, zu, zt))
for (t0_, u0, c0_), (t1_, u1, c1_) in zip(rows, rows[1:]):
    for along in (-BT, BT):
        f_ = [bpt(t0_, along, u0), bpt(t1_, along, u1), bpt(t1_, along, c1_), bpt(t0_, along, c0_)]
        BS.face(f_ if along > 0 else f_[::-1], 'stone', ISTRIAN)
    BS.face([bpt(t0_, -BT, u0), bpt(t1_, -BT, u1), bpt(t1_, BT, u1), bpt(t0_, BT, u0)], 'stone', WEATHERED)      # underside
    BS.face([bpt(t0_, -BT, c0_), bpt(t1_, -BT, c1_), bpt(t1_, BT, c1_), bpt(t0_, BT, c0_)], 'stone', ISTRIAN)      # top
for along, sg in ((-BT, 1), (BT, -1)):      # two small barred windows a side
    for q in (-0.42, 0.42):
        p = bpt(q, along, zc + 1.2); opening(BS, p, NL[ib] * sg, 1.6, 0.0, 1.6, 0.0, out=0.08, gothic=False)
for sd in (1, -1):      # the two buildings
    i0_, i1_ = (R0 - 22) % N, (R0 - 1) % N; mid_ = (i0_ + i1_) // 2; a_, b_ = off(mid_, sd * (wall_lat + 7.5)), T[mid_]
    L_b = (i1_ - i0_) * STEP
    BS.block(Vector((a_.x, a_.y, Z(-0.5))), (L_b, 15.0, PTOP + 7.0), HEAD[mid_], 'stone', ISTRIAN)
    road_face = off(mid_, sd * wall_lat); t3 = T[mid_].to_3d(); front = a_.to_3d() * 1; front.z = 0; front -= t3 * (L_b / 2); side = NL[mid_].copy()
    for z0_ in (Z(1.4), Z(6.4), Z(10.8)):
        for q in range(-2, 3): opening(BS, Vector((road_face.x, road_face.y, z0_)) + t3 * q * 9.5, t3 * sd, 2.6, 0.0, 2.6, 1.3, out=0.1)
        for q in (-4.5, 0, 4.5): opening(BS, Vector((front.x, front.y, z0_)) + side * q, side * (-1), 2.6, 0.0, 2.6, 1.3, out=0.1)
BS.done()

# ------------------------------------------------------------------------------------------------ stands: the sketch's four, as rakes swept along the road behind the wall, with a roof
SD = Sheet('VE stands', ['stone', 'seats', 'steel'])
SEAT = [(0.34, 0.1, 0.09), (0.16, 0.2, 0.3), (0.2, 0.26, 0.36)]
def station_at(x, y, s0, s1):
    p = Vector(PX(x, y)); return min(range(ST(s0), ST(s1)), key=lambda i: (CL[i].to_2d() - p).length)
STANDS = []
def stand(i0, i1, sd, rows=20, gap=3.0):
    STANDS.append((i0, i1, sd, rows, gap))
    pf = [(0.0, 0.0), (0.0, 1.0)]
    for q in range(rows): pf += [(q * 0.85 + 0.85, 1.0 + q * 0.5), (q * 0.85 + 0.85, 1.5 + q * 0.5)]
    pf += [(rows * 0.85 + 0.3, 1.0 + rows * 0.5 + 1.2), (rows * 0.85 + 0.3, -3.0)]
    sts = list(range(i0, i1, 4)); depth = pf[-1][0]
    for a, b in zip(sts, sts[1:]):
        bk = 0
        for q in range(len(pf) - 1):
            P_ = lambda j, k_: off(j, sd * (BD[sd][j] + gap + pf[k_][0]), pf[k_][1] - 0.2)
            tread = 1 <= q < len(pf) - 2; aisle = (a // 4) % 6 == 0
            SD.face([P_(a, q), P_(b, q), P_(b, q + 1), P_(a, q + 1)][::sd], 'seats' if tread and not aisle else 'stone', SEAT[(a // 24 + (q // 12)) % 3] if tread and not aisle else WEATHERED)
        # the roof, on a post every 12 stations
        l0, l1 = BD[sd][a] + gap + depth * 0.35, BD[sd][a] + gap + depth + 0.5; zt = 1.0 + rows * 0.5 + 6.5
        lb0, lb1 = BD[sd][b] + gap + depth * 0.35, BD[sd][b] + gap + depth + 0.5
        SD.face([off(a, sd * l0, zt - 0.6), off(b, sd * lb0, zt - 0.6), off(b, sd * lb1, zt), off(a, sd * l1, zt)][::sd], 'steel')
        if (a - i0) % 24 == 0:
            p = off(a, sd * (l1 - 0.4)); SD.block(Vector((p.x, p.y, CL[a].z + 1)), (0.5, 0.5, zt - 1), HEAD[a], 'steel')
for name_, (i0, i1, sd) in dict(top=(0, station_at(665, 211, 0, 500), 1),
                               left=(station_at(165, 490, 5000, 5990), station_at(220, 250, 5000, 5990), 1),
                               hairpin=(station_at(1130, 895, 3100, 3990), station_at(1185, 720, 3100, 3990), -1),
                               bottom=(station_at(420, 905, 2400, 3300), station_at(695, 915, 2400, 3300), -1)).items():
    stand(i0, i1, sd); log('stand', name_, i0, i1, round((i1 - i0) * STEP), 'm')
stand(station_at(530, 213, 5700, 5990), N - 1, 1)      # the top stand's part behind the line
SD.done()

# ------------------------------------------------------------------------------------------------ the HQ, in the Doge's Palace's language: two tiers of arcade under a tall plain wall, round a court; an Arsenale-type gate on the road side
Q = [Vector(PX(*p)) for p in HQ_RECT]; cq = sum(Q, Vector((0, 0))) / 4; ux = (Q[1] - Q[0]).normalized(); yaw_h = math.atan2(ux.y, ux.x); uy = Vector((-ux.y, ux.x))
HW_, HD_, WING, HH = (Q[1] - Q[0]).length * 0.98, (Q[3] - Q[0]).length * 0.92, 34.0, 30.0
gq = ground_z(cq.x, cq.y)[0]
HQ_O = (cq - ux * HW_ / 2 - uy * HD_ / 2).to_3d(); HQ_O.z = Z(3.0); HQ_U = ux.to_3d(); HQ_C = cq.to_3d(); HQ_C.z = Z(3.0); HQ_N = uy.to_3d()      # level with the top straight beside it: its arcade must not stand in a pit      # the kit builds it, once it exists

# ------------------------------------------------------------------------------------------------ the palazzi: the sketch's three yellow blocks, in rows with narrow calli, faced to the road; a campanile as the skyline's anchor
PR = random.Random(31); JOG = random.Random(9); n_pal = 0; PALAZZI = []      # the kit builds them (venice_kit.build_palazzi), once it exists and every footprint is known: what a driver sees depends on all of them
for blk in BLOCKS:
    xs_, ys_ = [p[0] for p in blk], [p[1] for p in blk]; cb_ = Vector((sum(xs_) / len(xs_), sum(ys_) / len(ys_)))
    iN, _ = near(cb_.x, cb_.y); yaw = HEAD[iN]
    u_, v_ = Vector((math.cos(yaw), math.sin(yaw))), Vector((-math.sin(yaw), math.cos(yaw)))
    span = max((Vector(p) - cb_).length for p in blk) * 1.1; y_ = -span
    while y_ < span:
        dep = PR.uniform(16, 22); x_ = -span
        while x_ < span:
            wd = PR.uniform(13, 24); c = cb_ + u_ * (x_ + wd / 2) + v_ * (y_ + dep / 2); corners_ = [c + u_ * a_ * wd / 2 + v_ * b_ * dep / 2 for a_, b_ in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            if all(in_poly(q.x, q.y, blk) for q in corners_) and min(near(q.x, q.y)[1] for q in corners_) > 34:
                h_ = PR.uniform(13, 22); PR.choice(OCHRE); c_j = c + v_ * JOG.uniform(-1.6, 1.6)      # a street line that wanders, so one front throws a shadow on the next
                PALAZZI.append((Vector((c_j.x, c_j.y, ground_z(c_j.x, c_j.y)[0] - 0.8)), wd, dep, yaw, h_)); n_pal += 1
            x_ += wd + PR.choice((0.3, 0.3, 4.0))
        y_ += dep + PR.uniform(7, 11)
log('palazzi', n_pal)
pc = Vector(PX(975, 165)); gz = ground_z(pc.x, pc.y)[0] - 1

exec(compile((H / 'venice_city.py').read_text(encoding='utf8'), str(H / 'venice_city.py'), 'exec'))

# ------------------------------------------------------------------------------------------------ surfaces and collision: walkways on the deck and in the tunnel, a paved shoulder flush with the road elsewhere
walk = [[off(i, sd * HW), off((i + 1) % N, sd * HW), off((i + 1) % N, sd * BD[sd][(i + 1) % N]), off(i, sd * BD[sd][i])][::sd] for sd in (1, -1) for i in range(N) if CLOSE[i]]
SHOULDER = [[off(i, sd * HW, -0.01), off((i + 1) % N, sd * HW, -0.01), off((i + 1) % N, sd * BD[sd][(i + 1) % N], -0.01), off(i, sd * BD[sd][i], -0.01)][::sd] for sd in (1, -1) for i in range(N) if not CLOSE[i]]
sh = Sheet('VE shoulders', ['pave'])
for q in SHOULDER + [[Vector((p.x, p.y, p.z - 0.01)) for p in q] for q in walk if not any(DECK[near(p.x, p.y)[0]] for p in q)]: sh.face(q, 'pave', (0.8, 0.77, 0.7))
sh.done()
collision(ground_col, walk + APRON + SHOULDER)
write_track('Venice', ['Textures: Poly Haven (CC0)'], ['day', 'dusk'], 'dusk', [{'name': 'Campanile', 'pos': to_game(Vector((pc.x, pc.y, gz + 99)))}, {'name': 'HQ', 'pos': to_game(Vector((cq.x, cq.y, gq + 35)))}, {'name': 'Dome hall', 'pos': to_game(dc_ + Vector((0, 0, 50)))}, {'name': 'Town hall tower', 'pos': to_game(at(th, yt, 0, -36, 60))}, {'name': 'Cathedral', 'pos': to_game(at(ca, yca, -53, 0, 70))}])
export()
