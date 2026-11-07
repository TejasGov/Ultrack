"""Hartwell Wold: a country road circuit in the English Cotswolds, from the wold's top down an escarpment to a river village and back up through a park, in one Blender pass. Day and dusk only: no lights.json.
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/wold/tracks/wold/build_wold.py -Log D:/RaceUltimate-wt/wold/tracks/wold/build_wold.log
Concept: plan_layout.py -> track-viewer/docs/career-worlds/wold.json (5.79 km clockwise: the airfield straight on the top, the esses, down the escarpment past the beech hanger,
the hairpin, the river meadows, the village's high street, hard left over the stone bridge, up through the park's esses and back along the west side). Shared pieces: tracks/career_lib.py.
  track     14 m of grey tarmac, kerbs in the tight corners, a dressed honey-stone wall 2 m off the edge through the village and on the bridge (the place's own edge), a grass verge beyond
  ground    one grid, 6 m round the lap growing to 5 km out: rolling wold, the river's valley floor with its water, verges and fields
  village   wold_village.py: Cotswold cottages in coursed honey limestone under stone slates, a Georgian front or two, the inn, the market hall, the church and its tower, the bridge.
            STRETCH limits the dressing to the first finished stretch until the user has seen it."""
import bpy, os
from pathlib import Path
H = Path(r'D:/RaceUltimate-wt/wold/tracks/wold'); ID = 'wold'; PFX = 'HW'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
PH = Path(r'D:/RaceUltimate/assets/polyhaven')      # the main checkout's local library: several of these sets are not in git (Venice's precedent)
import numpy as np
STRETCH = None if os.environ.get('WOLD_FULL') else (2560.0, 3480.0)      # metres of lap that get the village: the high street, the bridge and the climb out
st = lambda s: int(round(s / STEP)) % N
def in_stretch(i): return STRETCH is None or STRETCH[0] <= i * STEP <= STRETCH[1]
def C2B(x, y): p = M @ Vector((x, y, 0)); return Vector((p.x, p.y, 0))      # concept (plan_layout.py) to build coordinates
HONEY = (1.0, 0.84, 0.6)
MAT.update({
    'asphalt': material('HW | asphalt', tex='asphalt_track', rough=0.62),
    'line': material('HW | line white', (0.62, 0.62, 0.6), 0.55),
    'kerb_r': material('HW | kerb red', tex='brushed_concrete', rough=0.5, diff=ROOT / 'tracks' / 'qingshan' / 'tex' / 'kerb_red_diff.jpg'),
    'kerb_w': material('HW | kerb white', tex='brushed_concrete', rough=0.5, diff=ROOT / 'tracks' / 'qingshan' / 'tex' / 'kerb_white_diff.jpg'),
    'barrier': material('HW | wall stone', tex='japanese_stone_wall', diff=H / 'tex' / 'drystone_diff.jpg'),
    'grass': material('HW | grass', tex='leafy_grass', vcol=True),
    'walk': material('HW | pavement', tex='pavement_01', vcol=True),
    'bed': material('HW | river bed', tex='gravel_ground_01', vcol=True),
    'water': material('HW | water', (0.018, 0.03, 0.024), 0.07),
})
UVS.update({'asphalt': 3.5, 'grass': 5.0, 'walk': 2.2, 'bed': 4.0, 'water': 40.0, 'barrier': 1.6})
road(7.0, 60)
_wt = MAT['water'].node_tree; _np = _wt.nodes.new('ShaderNodeTexNoise'); _np.inputs['Scale'].default_value = 0.9; _np.inputs['Detail'].default_value = 5.0; _tc = _wt.nodes.new('ShaderNodeNewGeometry'); _wt.links.new(_tc.outputs['Position'], _np.inputs['Vector'])
_bp = _wt.nodes.new('ShaderNodeBump'); _bp.inputs['Strength'].default_value = 0.12; _bp.inputs['Distance'].default_value = 0.3; _wt.links.new(_np.outputs[0], _bp.inputs['Height']); _wt.links.new(_bp.outputs[0], _wt.nodes['Principled BSDF'].inputs['Normal'])      # a slow river's ripple, as Venice's canal
RIVER = [C2B(x, y) for x, y in ((-1900, -900), (-1300, -860), (-900, -905), (-650, -850), (-425, -842), (-200, -830), (100, -850), (400, -830), (700, -800), (1000, -790), (1500, -760), (2100, -800))]
_rp = [RIVER[0].lerp(RIVER[1], 0)]
for a, b in zip(RIVER, RIVER[1:]):
    n_ = max(1, int((b - a).length / 6)); _rp += [a.lerp(b, q / n_) for q in range(1, n_ + 1)]
RT = KDTree(len(_rp))
for q, p in enumerate(_rp): RT.insert(p, q)
RT.balance()
def river_d(x, y): return RT.find((x, y, 0))[2]
GL = (M @ Vector((0, 0, 0))).z      # the concept's height datum in build coordinates: the start line on the wold's top is z = 0, the valley 34 m under it
WATER_Z, RIVER_W = GL + 4.0, 11.0
VILLAGE = [st(2600) <= i <= st(3170) for i in range(N)]      # the high street
BRIDGE = [river_d(CL[i].x, CL[i].y) < RIVER_W + 7 and st(3150) <= i <= st(3400) for i in range(N)]
TOWN = [VILLAGE[i] or BRIDGE[i] for i in range(N)]
log('bridge stations', sum(BRIDGE), 'village', sum(VILLAGE))
# the walls: the village's own honey-stone wall close to the road, on the bridge its parapet; elsewhere a grass verge to a low stone wall
WALLP = [(0, 0), (0.0, 0.95), (-0.06, 1.0), (0.56, 1.0), (0.5, 0.95), (0.5, 0)]      # a coped wall, 0.5 m thick: u outward from its road face
barriers(lambda i: HW + 0.6 if BRIDGE[i] else HW + 2.0 if TOWN[i] else HW + 9.0, prof=WALLP, height=1.0)

# ------------------------------------------------------------------------------------------------ ground
C_ = np.array([[p.x, p.y, p.z] for p in CL[::4]])
SHELF = 16.0
def far_z(x, y):
    d2 = (C_[:, 0] - x) ** 2 + (C_[:, 1] - y) ** 2; w = 1 / (d2 + 900) ** 2; z = float((w * C_[:, 2]).sum() / w.sum())
    z += 9.0 * fbm(x / 520, y / 520, 3) * ss(60, 400, math.sqrt(float(d2.min())))      # the wold rolls on beyond the lap
    rd = river_d(x, y); v = 1 - ss(RIVER_W, 140, rd)      # the valley floor flattens to the river
    return z * (1 - v) + (WATER_Z + 2.4) * v
def channel(x, y, z):
    """the river's own cut, through whatever is there: bed, banks, then the ground"""
    rd = river_d(x, y)
    if rd > RIVER_W + 5: return z
    return min(z, WATER_Z - 1.4 + 1.4 * ss(RIVER_W - 7, RIVER_W - 1, rd) + 2.6 * ss(RIVER_W - 1, RIVER_W + 4, rd) + 9 * ss(RIVER_W + 4, RIVER_W + 9, rd))
def height(x, y, i, d):
    t = ss(SHELF if TOWN[i] else HW + 4, SHELF + 28, d); sunk = 0.04 + 0.3 * (1 - ss(HW - 1, HW + 0.5, d))
    return channel(x, y, (CL[i].z - sunk) * (1 - t) + far_z(x, y) * t)      # the river cuts through everything, under the bridge too: the arches stand over it, the deck is the road's own mesh
def axis(lo, hi, cell=6.0, edge=5000.0, grow=1.18):
    a = list(np.arange(lo, hi + cell, cell)); step = cell; x = a[0]
    while x > lo - edge: step *= grow; x -= step; a.insert(0, x)
    step = cell; x = a[-1]
    while x < hi + edge: step *= grow; x += step; a.append(x)
    return a
GX_, GY_ = axis(min(xs) - 200, max(xs) + 200), axis(min(ys) - 200, max(ys) + 200)
def tint(co, d):      # meadow greens, a little straw in it, darker in the valley's damp
    a = fbm(co.x / 70, co.y / 70, 3); t = 0.85 + 0.12 * a; dry = ss(0.1, 0.6, fbm(co.x / 300 + 4, co.y / 300, 2))      # leafy_grass is a brown-green: pulled to an English meadow's green
    return (t * (0.5 + 0.2 * dry), t * (0.78 - 0.04 * dry), t * (0.36 - 0.04 * dry), 1)
bm = bmesh.new(); vc = vcol_layer(bm); G, D = [], {}
for y in GY_:
    row = []
    for x in GX_:
        i, d = near(x, y); v = bm.verts.new((x, y, height(x, y, i, d))); D[v] = d; row.append(v)
    G.append(row)
ground_col = []; REACH = 26.0
for r_ in range(len(GY_) - 1):
    for c in range(len(GX_) - 1):
        q = [G[r_][c], G[r_][c + 1], G[r_ + 1][c + 1], G[r_ + 1][c]]
        if max(D[v] for v in q) < HW - 0.6: continue
        if min(D[v] for v in q) < REACH: ground_col.append([v.co.copy() for v in q])
        bed = all(river_d(v.co.x, v.co.y) < RIVER_W + 1 for v in q)
        f = bm.faces.new(q); f.material_index = 1 if bed else 0
        for l in f.loops: l[vc] = tint(l.vert.co, D[l.vert]) if not bed else (0.75, 0.72, 0.62, 1)
mesh_obj('HW ground', bm, ['grass', 'bed'], smooth=True)
def ground_at(x, y): i, d = near(x, y); return height(x, y, i, d)
# the pavement in the village, flush with the road's edge plus a kerb's height
bm = bmesh.new(); vc = vcol_layer(bm)
for sd in (1, -1):
    for i in range(N):
        j = (i + 1) % N
        if not (VILLAGE[i] and VILLAGE[j]): continue
        a0, a1 = BD[sd][i] + 0.56, BD[sd][j] + 0.56
        row0, row1 = [off(i, sd * (HW + 0.01), -0.02), off(i, sd * a0, 0.12), off(i, sd * SHELF, 0.12)], [off(j, sd * (HW + 0.01), -0.02), off(j, sd * a1, 0.12), off(j, sd * SHELF, 0.12)]
        for f in strip(bm, [row0, row1], 0, closed=False, rev=sd < 0):
            for l in f.loops: l[vc] = (0.9, 0.87, 0.8, 1)
mesh_obj('HW pavements', bm, ['walk'], smooth=True)
bm = bmesh.new()
for a, b in zip(_rp, _rp[1:]):
    t_ = (b - a).normalized(); nn = Vector((-t_.y, t_.x, 0)) * (RIVER_W + 2)
    f = bm.faces.new([bm.verts.new((a - nn).to_tuple()), bm.verts.new((b - nn).to_tuple()), bm.verts.new((b + nn).to_tuple()), bm.verts.new((a + nn).to_tuple())]); f.material_index = 0
for v in bm.verts: v.co.z = WATER_Z
mesh_obj('HW water', bm, ['water'])
log('ground', len(GX_), 'x', len(GY_), 'collision quads', len(ground_col))

exec(compile((H / 'wold_village.py').read_text(encoding='utf8'), str(H / 'wold_village.py'), 'exec'))

collision(ground_col)
write_track('Hartwell Wold', ['Textures: Poly Haven (CC0); see tracks/wold/CREDITS.md'], ['day', 'dusk'], 'day', [{'name': 'Church tower', 'pos': to_game(TOWER_TOP)}])
export()
