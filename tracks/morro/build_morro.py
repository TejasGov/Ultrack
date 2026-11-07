"""Morro Noturno: the career's night street circuit, a hillside neighbourhood over a city by the bay, in one Blender pass. Always night, always wet: lights.json and lit windows.
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/morro/tracks/morro/build_morro.py -Log D:/RaceUltimate-wt/morro/tracks/morro/build_morro.log
Concept: plan_layout.py -> track-viewer/docs/career-worlds/morro.json (6.27 km clockwise: the avenue's drag strip, the orla along the beach, up the morro's switchbacks, the top road
over the city, down the east flank and back along the hill's foot to the last hairpin). Shared pieces: tracks/career_lib.py.
  track     14 m of worn asphalt, kerbs in the tight corners, concrete blocks with debris fencing 1.6 m off the edge (a street circuit), pavements behind them
  ground    one grid, 6 m round the lap growing to 5 km out: flat shelves along the streets, the hill between, the sand and the bay south of the orla
  houses    morro_kit.py: stacked hillside houses (brick, painted plaster, concrete frames, water tanks, grilles), power poles and wires, sodium lamps, shops with
            their signs. STRETCH below limits it to the first finished stretch until the user has seen it.
  city      morro_city.py: the flat city below and the beach towers, far detail only, lit windows"""
import bpy, os
from pathlib import Path
H = Path(r'D:/RaceUltimate-wt/morro/tracks/morro'); ID = 'morro'; PFX = 'MN'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
PH = Path(r'D:/RaceUltimate/assets/polyhaven')      # the main checkout's local library: several of these sets are not in git (Venice's precedent)
import numpy as np
STRETCH = None if os.environ.get('MORRO_FULL') else (2230.0, 3400.0)      # metres of lap that get houses: the first finished stretch (T4 and the two hairpins)

WORN = PH / 'worn_asphalt' / 'worn_asphalt_diff_2k.jpg'
MAT.update({
    'asphalt': material('MN | asphalt', tex='worn_asphalt', rough=0.35),
    'line': material('MN | line white', (0.62, 0.62, 0.6), 0.45),
    'kerb_r': material('MN | kerb red', tex='brushed_concrete', rough=0.5, diff=ROOT / 'tracks' / 'qingshan' / 'tex' / 'kerb_red_diff.jpg'),      # Qingshan's painted concrete
    'kerb_w': material('MN | kerb white', tex='brushed_concrete', rough=0.5, diff=ROOT / 'tracks' / 'qingshan' / 'tex' / 'kerb_white_diff.jpg'),
    'barrier': material('MN | barrier', tex='concrete_wall_009', vcol=True),
    'ground': material('MN | ground', tex='red_laterite_soil_stones', vcol=True),
    'walk': material('MN | pavement', tex='dirty_concrete', vcol=True),
    'sand': material('MN | sand', tex='coast_sand_01', vcol=True),
    'water': material('MN | water', (0.01, 0.018, 0.024), 0.06),
})
UVS.update({'asphalt': 4.0, 'ground': 6.0, 'walk': 3.0, 'sand': 8.0, 'water': 60.0})
road(6.5, 60)      # 13 m: a hillside street, as narrow as the AI's sixteen cars allow
BOFF = HW + 1.0
barriers(BOFF, height=1.0)
st = lambda s: int(round(s / STEP)) % N
def in_stretch(i): return STRETCH is None or STRETCH[0] <= i * STEP <= STRETCH[1]
log('corners', [(c['n'], c['at'], c['radius']) for c in SRC['corners']])

# ------------------------------------------------------------------------------------------------ ground
C_ = np.array([[p.x, p.y, p.z] for p in CL[::4]])
SHELF = BOFF + 3.6      # road, blocks, pavement and the first row's frontage stand level with the road
BEACH_Y = -292.0        # the orla's sea side, concept y (build y is the same: the start line sits on y = 0)
HILLS = [(-1650, 420, 150, 520), (-1150, 980, 120, 380), (900, 1150, 170, 520), (1900, 380, 130, 480), (-400, -3100, 260, 900), (1500, -2600, 190, 700), (-2600, -1500, 160, 650)]      # the other morros round the bay, and the far shore across it
def far_z(x, y):
    d2 = (C_[:, 0] - x) ** 2 + (C_[:, 1] - y) ** 2; w = 1 / (d2 + 400) ** 2; z = float((w * C_[:, 2]).sum() / w.sum())
    z += 16 * math.exp(-(((x - 180) / 420) ** 2 + ((y - 640) / 110) ** 2))      # the crest behind the top road
    z += 3.0 * fbm(x / 160, y / 160, 3)
    sea = ss(BEACH_Y - 10, BEACH_Y - 60, y)      # the sand shelves into the bay south of the orla
    z = z * (1 - sea) - 3.0 * sea
    for hx, hy, hh, hr in HILLS: z = max(z, hh * math.exp(-(((x - hx) ** 2 + (y - hy) ** 2) / (hr * hr))) - 3.0 + 6 * fbm(x / 300, y / 300, 2))
    return z
def height(x, y, i, d):
    t = ss(SHELF, SHELF + 22, d); sunk = 0.04 + 0.3 * (1 - ss(HW - 1, HW + 0.5, d))
    return (CL[i].z - sunk) * (1 - t) + far_z(x, y) * t
def axis(lo, hi, cell=6.0, edge=5000.0, grow=1.18):
    a = list(np.arange(lo, hi + cell, cell)); step = cell; x = a[0]
    while x > lo - edge: step *= grow; x -= step; a.insert(0, x)
    step = cell; x = a[-1]
    while x < hi + edge: step *= grow; x += step; a.append(x)
    return a
GX_, GY_ = axis(min(xs) - 160, max(xs) + 160), axis(min(ys) - 160, max(ys) + 200)
def tint(co, d):
    t = 0.75 + 0.18 * fbm(co.x / 30, co.y / 30, 3); return (t, t * 0.97, t * 0.93, 1)
bm = bmesh.new(); vc = vcol_layer(bm); G, D, ZG = [], {}, {}
for y in GY_:
    row = []
    for x in GX_:
        i, d = near(x, y); z = height(x, y, i, d); v = bm.verts.new((x, y, z)); D[v] = (d, y); row.append(v)
    G.append(row)
ground_col = []; REACH = BOFF + 14
for r_ in range(len(GY_) - 1):
    for c in range(len(GX_) - 1):
        q = [G[r_][c], G[r_][c + 1], G[r_ + 1][c + 1], G[r_ + 1][c]]
        if max(D[v][0] for v in q) < HW - 0.6: continue
        if min(D[v][0] for v in q) < REACH: ground_col.append([v.co.copy() for v in q])
        sandy = BEACH_Y - 70 < max(D[v][1] for v in q) < BEACH_Y + 4 and min(D[v][0] for v in q) > SHELF
        f = bm.faces.new(q); hill = STRETCH is not None and any(in_stretch(near(v.co.x, v.co.y)[0]) for v in q) and min(D[v][0] for v in q) < 160
        f.material_index = 2 if sandy else 1 if hill else 0
        for l in f.loops: l[vc] = tint(l.vert.co, D[l.vert][0])
mesh_obj('MN ground', bm, ['ground', 'walk', 'sand'], smooth=True)
def ground_at(x, y): i, d = near(x, y); return height(x, y, i, d)
# the pavement behind the blocks, flush with the road's edge plus a kerb's height
bm = bmesh.new(); vc = vcol_layer(bm)
for sd in (1, -1):
    rows = [[off(i, sd * (HW + 0.01), -0.02), off(i, sd * (BD[sd][i] + 0.7), 0.0), off(i, sd * (BD[sd][i] + 0.7), 0.15), off(i, sd * SHELF, 0.15)] for i in range(N)]
    for f in strip(bm, rows, 0, rev=sd < 0):
        for l in f.loops: l[vc] = (0.8, 0.8, 0.78, 1)
    ground_col += [[rows[i][0].copy(), rows[(i + 1) % N][0].copy(), rows[(i + 1) % N][1].copy(), rows[i][1].copy()][::sd] for i in range(N)]
mesh_obj('MN pavements', bm, ['walk'], smooth=True)
bm = bmesh.new(); f = bm.faces.new([bm.verts.new((x, y, -0.6)) for x, y in ((-6000, -6000), (6000, -6000), (6000, BEACH_Y - 30), (-6000, BEACH_Y - 30))]); f.material_index = 0
mesh_obj('MN water', bm, ['water'])
log('ground', len(GX_), 'x', len(GY_), 'collision quads', len(ground_col))

exec(compile((H / 'morro_kit.py').read_text(encoding='utf8'), str(H / 'morro_kit.py'), 'exec'))
exec(compile((H / 'morro_decor.py').read_text(encoding='utf8'), str(H / 'morro_decor.py'), 'exec'))
exec(compile((H / 'morro_city.py').read_text(encoding='utf8'), str(H / 'morro_city.py'), 'exec'))

collision(ground_col)
(OUT / 'lights.json').write_text(json.dumps({'floodlights': [], 'standLamps': [], 'streetLamps': [{'pos': [round(v_, 2) for v_ in to_game(p)], 'color': c_, **({'h': h_} if h_ else {})} for p, c_, h_ in LAMPS], 'wash': []}, separators=(',', ':')), encoding='utf8')
write_track('Morro Noturno', ['Textures: Poly Haven (CC0); see tracks/morro/CREDITS.md'], ['night'], 'night', [{'name': 'Top road', 'pos': to_game(off(st(3900), 0, 8))}])
export()
