"""Llano Speedway: the career's big speed track on the empty West Texas plain, in one Blender pass. BLOCKOUT: road, ground, walls and collision are real;
the venue is in llano_venue.py (flat 2D wherever nobody gets close).
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/llano/build_llano.py -Log D:/RaceUltimate/tracks/llano/build_llano.log
Shared pieces: tracks/career_lib.py. Concept: track-viewer/docs/career-worlds/llano.json (6.82 km, the Long Mile 2.02 km, a 14 m rise to the Caprock).
  track     16 m wide, kerbs only in the tight corners, 32 m of dirt run-off to a low wall on both sides (15 m along the start straight, closer on the inside of the tight corners)
  ground    one grid, 8 m round the lap, growing to 6 km out: it follows the road through the first metres of run-off, under a flush 13 m shoulder (no step at
            the road's edge), then eases into a low swell; collision to 12 m behind the walls
  venue     llano_venue.py: stands, pits, HQ, media centre, ads, the infield, the driver's cues (empty land gives the eye nothing to measure speed by), the far range
  station   llano_station.py: Llano Central, the race-day rail terminus, hollow and low poly, with its garden, railway and footbridge
  dressing  llano_dressing.py: painted run-off, tyre walls, bunting, team colours, a round tower, mesas, a rock cut, a pipeline, windmills, turbines, balloons, a blimp
Day and dusk only: no lights.json."""
import bpy
from pathlib import Path
H = Path(r'D:/RaceUltimate/tracks/llano'); ID = 'llano'; PFX = 'LL'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
import numpy as np

MAT.update({
    'asphalt': material('LL | asphalt', tex='asphalt_track', rough=0.72, diff=ROOT / 'tracks' / 'drylake' / 'tex' / 'asphalt_track_bleached_diff_2k.jpg'),
    'line': material('LL | line white', (0.62, 0.62, 0.6), 0.6),
    'kerb_r': material('LL | kerb red', (0.55, 0.06, 0.05), 0.6),
    'kerb_w': material('LL | kerb white', (0.66, 0.66, 0.63), 0.6),
    'barrier': material('LL | barrier', tex='concrete_wall_009'),
    'dirt': material('LL | dirt', tex='aerial_sand', vcol=True, diff=H / 'tex' / 'dirt_diff.jpg'),
})
UVS.update({'asphalt': 3.5, 'dirt': 23.0})
RUNOFF = 32.0
road(8.0, 70)
START_S = lambda i: ((i * STEP + LAP / 2) % LAP) - LAP / 2      # metres from the start line, either way
barriers(lambda i: 15.0 if -200 < START_S(i) < 510 else RUNOFF)      # close in along the start straight, where the stands and pits are
for sd in (1, -1):
    for i in range(0, N, 2):
        p = off(i, sd * BD[sd][i]); j, d = near(p.x, p.y)
        assert d > HW + 3, f'the wall at station {i} stands on the road at station {j}'
st = lambda s: int(round(s / STEP)) % N
ENTRY = {c['n']: c['at'] - c['radius'] * math.radians(c['turn']) / 2 for c in SRC['corners']}
EXIT = {c['n']: c['at'] + c['radius'] * math.radians(c['turn']) / 2 for c in SRC['corners']}
log('corners', {c['n']: (st(c['at']), c['radius']) for c in SRC['corners']})

# ------------------------------------------------------------------------------------------------ ground
def axis(lo, hi, cell=8.0, edge=6000.0, grow=1.2):
    a = list(np.arange(lo, hi + cell, cell)); step = cell; x = a[0]
    while x > lo - edge: step *= grow; x -= step; a.insert(0, x)
    step = cell; x = a[-1]
    while x < hi + edge: step *= grow; x += step; a.append(x)
    return a
GX_, GY_ = axis(min(xs) - 140, max(xs) + 140), axis(min(ys) - 140, max(ys) + 140)
C_ = np.array([[p.x, p.y, p.z] for p in CL[::6]])
def height(x, y, i, d):
    """the road's own height at the road, a smooth blend of the lap's heights away from it, a low swell far out"""
    d2 = (C_[:, 0] - x) ** 2 + (C_[:, 1] - y) ** 2; w = 1 / (d2 + 900) ** 2; far = float((w * C_[:, 2]).sum() / w.sum())
    t = ss(HW + 14, HW + 70, d)
    sunk = 0.05 + 0.35 * (1 - ss(HW - 1, HW + 0.5, d))      # only under the road's edge: on a grade a station's height is off by centimetres, and flush ground would show through
    return (CL[i].z - sunk) * (1 - t) + (far + 3.0 * fbm(x / 900, y / 900, 3) * ss(60, 500, d)) * t
def tint(co, d):      # rust-red dirt, pale caliche patches, an even colour far out (the outer cells are long: their colours would streak); the infield's dry lake pan (Laguna Seca's idea) flat and pale
    lake = 1 - ss(0.75, 1.1, ((co.x - 400) / 170) ** 2 + ((co.y + 1720) / 240) ** 2)
    pale = max(ss(0.12, 0.75, fbm(co.x / 260 + 7, co.y / 260, 3)) * 0.55, lake); t = 0.82 + 0.2 * fbm(co.x / 45, co.y / 45, 3); e = ss(350, 900, d); pale = pale * (1 - e) + 0.12 * e; t = t * (1 - e) + 0.86 * e
    return tuple(min(1, (r_ + (q_ - r_) * pale) * t) for r_, q_ in ((0.64, 0.88), (0.33, 0.72), (0.18, 0.54))) + (1,)
bm = bmesh.new(); vc = vcol_layer(bm); G = []; D = {}
for y in GY_:
    row = []
    for x in GX_:
        i, d = near(x, y); v = bm.verts.new((x, y, height(x, y, i, d))); D[v] = d; row.append(v)
    G.append(row)
ground_col = []; REACH = RUNOFF + 12
for r_ in range(len(GY_) - 1):
    for c in range(len(GX_) - 1):
        q = [G[r_][c], G[r_][c + 1], G[r_ + 1][c + 1], G[r_ + 1][c]]
        if max(D[v] for v in q) < HW - 0.6: continue      # under the road
        if min(D[v] for v in q) < REACH: ground_col.append([v.co.copy() for v in q])
        f = bm.faces.new(q); f.material_index = 0
        for l in f.loops: l[vc] = tint(l.vert.co, D[l.vert])
mesh_obj('LL ground', bm, ['dirt'], smooth=True)
# a flush dirt shoulder along both road edges, so no step and no gap between road and ground (the collision too: Infinia's lesson)
SHOULDER = 13.0      # wider than a ground cell's diagonal, so where it ends the ground under it is level with it: no lip to hit coming back from the run-off
bm = bmesh.new(); vc = vcol_layer(bm)
for sd in (1, -1):
    rows = [[off(i, sd * HW, -0.005), off(i, sd * (HW + SHOULDER), -0.03)] for i in range(N)]
    for f in strip(bm, rows, 0, rev=sd < 0):
        for l in f.loops: l[vc] = tint(l.vert.co, HW)
    ground_col += [[rows[i][0].copy(), rows[(i + 1) % N][0].copy(), rows[(i + 1) % N][1].copy(), rows[i][1].copy()][::sd] for i in range(N)]
mesh_obj('LL shoulders', bm, ['dirt'], smooth=True)
log('ground', len(GX_), 'x', len(GY_), 'collision quads', len(ground_col))

exec(compile((H / 'llano_venue.py').read_text(encoding='utf8'), str(H / 'llano_venue.py'), 'exec'))

collision(ground_col, paved_col)      # the painted run-off grips as paved
write_track('Llano Speedway', ['Textures: Poly Haven (CC0); see tracks/llano/CREDITS.md'], ['day', 'dusk'], 'dusk',
            [{'name': 'HQ tower', 'pos': to_game(Vector((hx, hy, hz + 62)))}, {'name': 'Llano Central', 'pos': to_game(STN_POS)}])
export()
