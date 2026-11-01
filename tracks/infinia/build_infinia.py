"""Infinia: the main India circuit (docs/career-worlds.md section 4, variant B "the long S", 5.0 km), first pass, in one Blender pass.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/infinia/build_infinia.py   (`-- --no-export`: the blend only)
Shared pieces: tracks/career_lib.py. A figure-eight across a bay: the sea link (an S-curved cable-stayed bridge, 22 m up) crosses over the
undersea tunnel (12 m down) in mid-bay; an old seafront (the Necklace arc of streetlights, art-deco blocks) closes the west loop, the old
city and a towers district the east loop.
  land      each loop's inside plus a 45 m seafront round it; the rest is the bay and the open sea ('water': main.js gives it Marina's sea)
  bridge    box-girder deck on piers, a diamond inverted-Y main tower (about 120 m) and a smaller I tower, stay cables in two planes
  tunnel    open cutting from the shore, then a roofed tube under the bay, one continuous light line (no spaced lamps: no strobe)
  city      infinia_city.py + infinia_place.py: the districts of IDENTITY.md (chawls, shop rows with Marathi signs, art deco on the
            Necklace, towers, koliwada, a temple, a dargah, the toll plaza, tetrapods, wires), a night-only lit-window shell
  lamps     lights.json street lamps round the lap, closer along the Necklace; heads 'M_LampWarm' (glow.js)
All four looks (a main circuit, like Marina, Tokyo and India Ghat)."""
import bpy
from pathlib import Path
H = Path(r'D:/RaceUltimate/tracks/infinia'); ID = 'infinia'; SRC_ID = 'infinia_b'; PFX = 'IF'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
import numpy as np
(H / 'tex').mkdir(exist_ok=True)

# ------------------------------------------------------------------------------------------------ the waypoints' stations: legs and loops
cum_poly = [0.0]
for d_ in seg: cum_poly.append(cum_poly[-1] + d_)
def st(w): return int(round(cum_poly[w * 64] / STEP)) % N
BR0, BR1 = st(0), st(8)              # the sea link: from the west shore to the east one
TU0, TU1 = st(18), st(22)            # the tunnel: from the east shore back to the west
def on_leg(i, a, b): return a <= i <= b if a <= b else (i >= a or i <= b)
BRIDGE = [on_leg(i, BR0, BR1) for i in range(N)]; TUNNEL = [on_leg(i, TU0, TU1) for i in range(N)]
EAST = list(range(BR1, TU0 + 1)); WEST = list(range(TU1, N)) + list(range(0, BR0 + 1))
log('stations: bridge', BR0, BR1, 'tunnel', TU0, TU1, 'loops', len(EAST), len(WEST))

# ------------------------------------------------------------------------------------------------ materials
MAT.update({
    'asphalt': material('IF | asphalt', tex='asphalt_track', rough=0.72, diff=ROOT / 'tracks' / 'drylake' / 'tex' / 'asphalt_track_bleached_diff_2k.jpg'),
    'line': material('IF | line white', (0.62, 0.62, 0.6), 0.6),
    'kerb_r': material('IF | kerb red', (0.55, 0.06, 0.05), 0.6),
    'kerb_w': material('IF | kerb white', (0.66, 0.66, 0.63), 0.6),
    'barrier': material('IF | barrier', tex='concrete_wall_009'),
    'concrete': material('IF | concrete', tex='brushed_concrete', vcol=True),
    'paving': material('IF | paving', tex='pavement_01', vcol=True),
    'ground': material('IF | ground', tex='aerial_sand', vcol=True, diff=ROOT / 'tracks' / 'drylake' / 'tex' / 'aerial_sand_pale_diff_1k.jpg'),     # packed earth and dust between the blocks, no lawns
    'tower': material('IF | bridge concrete', (0.78, 0.77, 0.74), 0.7),
    'cable': material('IF | stay cable', (0.85, 0.85, 0.86), 0.35, 0.6),
    'steel': material('IF | steel', (0.36, 0.37, 0.39), 0.45, 0.7),
    'tile': material('IF | tunnel tile', (0.72, 0.72, 0.68), 0.35),
    'tlight': material('IF | tunnel light', (0.9, 0.85, 0.7), 0.4, emit=((1.0, 0.82, 0.55), 12.0)),
    'lamp': material('M_LampWarm', (0.95, 0.9, 0.8), 0.4, emit=((1.0, 0.89, 0.72), 5.0)),
    'water': material('IF | water', (0.01, 0.035, 0.045), 0.04),
    'roof': material('IF | roof', (0.32, 0.31, 0.3), 0.85, vcol=True),
})
UVS.update({'asphalt': 3.5, 'concrete': 4.0, 'paving': 2.5, 'ground': 4.0})

# ------------------------------------------------------------------------------------------------ road and walls: parapets close on the bridge and in the tunnel
road(7.5, 70)
barriers(lambda i: HW + 1.6 if (BRIDGE[i] and CL[i].z > 0.8) or (TUNNEL[i] and CL[i].z < -0.3) else 15.0)     # the same bounds as the walkways and the cutting

# ------------------------------------------------------------------------------------------------ land: each loop's inside and a seafront round it
def poly_of(idx): return np.array([[CL[i].x, CL[i].y] for i in idx], np.float64)
PW, PE = poly_of(WEST), poly_of(EAST)
def inside(px, py, P):
    x0, y0, x1, y1 = P[:, 0], P[:, 1], np.roll(P[:, 0], -1), np.roll(P[:, 1], -1)
    c = ((y0 > py[:, None]) != (y1 > py[:, None])) & (px[:, None] < (x1 - x0) * (py[:, None] - y0) / np.where(y1 == y0, 1e-9, y1 - y0) + x0)
    return c.sum(1) % 2 == 1
LOBE = np.array([not (BRIDGE[i] or TUNNEL[i]) or i in (BR0, BR1, TU0, TU1) for i in range(N)])
KDL = KDTree(int(LOBE.sum()))
for k, i in enumerate(np.nonzero(LOBE)[0]): KDL.insert((CL[i].x, CL[i].y, 0), int(i))
KDL.balance()
SEA = 45.0       # the seafront: land this far beyond the loops' outer edge
X0, X1, Y0, Y1 = min(xs) - 500, max(xs) + 500, min(ys) - 500, max(ys) + 500
CELL = 10.0; GX, GY = int((X1 - X0) / CELL), int((Y1 - Y0) / CELL)
gx_, gy_ = np.meshgrid(X0 + np.arange(GX + 1) * CELL, Y0 + np.arange(GY + 1) * CELL)
fx, fy = gx_.ravel(), gy_.ravel()
ins = inside(fx, fy, PW) | inside(fx, fy, PE)
dl = np.array([KDL.find((x, y, 0))[2] for x, y in zip(fx, fy)])
shore = np.array([SEA + 8 * fbm(x / 140, y / 140, 2) for x, y in zip(fx, fy)])
# the tunnel's approaches run out on reclaimed land until the road is deep enough (-10.4 m) for the tube's roof to sit under the sea (-4 m)
CW_ = [i for i in range(N) if TUNNEL[i] and CL[i].z > -10.4]; KDC = KDTree(len(CW_)); [KDC.insert((CL[i].x, CL[i].y, 0), i) for i in CW_]; KDC.balance()
dc = np.array([KDC.find((x, y, 0))[2] for x, y in zip(fx, fy)])
LAND = (ins | (dl < shore) | (dc < 40)).reshape(GY + 1, GX + 1)
def is_land(x, y):
    return bool(inside(np.array([x]), np.array([y]), PW)[0] or inside(np.array([x]), np.array([y]), PE)[0] or KDL.find((x, y, 0))[2] < SEA or KDC.find((x, y, 0))[2] < 40)
log('land', round(LAND.mean() * 100), '% of the grid')

# ------------------------------------------------------------------------------------------------ ground and sea
bm = bmesh.new(); vc = vcol_layer(bm); G = [[None] * (GX + 1) for _ in range(GY + 1)]; info = {}
for r_ in range(GY + 1):
    for c in range(GX + 1):
        x, y = X0 + c * CELL, Y0 + r_ * CELL; i, d = near(x, y); land = LAND[r_, c]
        cut = TUNNEL[i] and CL[i].z < -0.3
        if land and cut: z = 0.0                            # level beside the cutting: its walls and aprons do the rest
        elif land:                                          # 40 cm under the road (a 10 m cell on a 7 % grade sags ~35 cm), out to level
            zr = CL[i].z - 0.4
            z = zr + (0.0 - zr) * ss(HW + 4, HW + 24, d) if d < HW + 24 else 0.0
        else: z = -9.0
        v = bm.verts.new((x, y, z)); G[r_][c] = v; info[v] = (land, i, d, TUNNEL[i] and CL[i].z < -0.3)
ground_col = []
for r_ in range(GY):
    for c in range(GX):
        q = [G[r_][c], G[r_][c + 1], G[r_ + 1][c + 1], G[r_ + 1][c]]
        if not any(info[v][0] for v in q): continue                     # open sea: water only
        cxm, cym = sum(v.co.x for v in q) / 4, sum(v.co.y for v in q) / 4; i, d = near(cxm, cym)
        if BRIDGE[i] and CL[i].z > 3.0 and d < HW + 3: continue          # under the bridge deck where it leaves the ground
        if any(info[v][3] and info[v][2] < HW + 1.7 for v in q): continue          # over the cutting / the tube
        if all(info[v][0] for v in q) and min(info[v][2] for v in q) < 60 and not any(info[v][3] and info[v][2] < HW + 16 for v in q):
            ground_col.append([v.co.copy() for v in q])      # the cutting's aprons carry their own collision
        if max(info[v][2] for v in q) < HW - 0.6: continue                # under the road
        f = bm.faces.new(q); f.material_index = 0 if all(info[v][0] for v in q) and min(info[v][2] for v in q) > HW + 6 else 1
        for l in f.loops:
            t = 0.85 + 0.15 * fbm(l.vert.co.x / 50, l.vert.co.y / 50, 3); l[vc] = (t * 0.62, t * 0.52, t * 0.42, 1) if f.material_index == 0 else (t, t, t * 0.96, 1)
mesh_obj('IF ground', bm, ['ground', 'paving'], smooth=True)
# the sea: the grid's sea cells and a frame out to 8.5 km, one plane at -4 m (no surface under another: the land is 4 m above it)
bm = bmesh.new()
for r_ in range(GY):
    for c in range(GX):
        if LAND[r_, c] and LAND[r_, c + 1] and LAND[r_ + 1, c + 1] and LAND[r_ + 1, c]: continue
        x, y = X0 + c * CELL, Y0 + r_ * CELL
        f = bm.faces.new([bm.verts.new((x, y, -4)), bm.verts.new((x + CELL, y, -4)), bm.verts.new((x + CELL, y + CELL, -4)), bm.verts.new((x, y + CELL, -4))])
XA, XB, YA, YB = X0 - 8000, X1 + 8000, Y0 - 8000, Y1 + 8000
for (a0, a1, b0, b1) in ((XA, XB, YA, Y0), (XA, XB, Y1, YB), (XA, X0, Y0, Y1), (X1, XB, Y0, Y1)):
    bm.faces.new([bm.verts.new((a0, b0, -4)), bm.verts.new((a1, b0, -4)), bm.verts.new((a1, b1, -4)), bm.verts.new((a0, b1, -4))])
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
wo = mesh_obj('water', bm, ['water'], planar=False)

# ------------------------------------------------------------------------------------------------ the bridge: deck, piers, towers, cables
bm = bmesh.new()
DECKW = HW + 2.2
def bridge_rows(): return [i for i in range(N) if BRIDGE[i] and CL[i].z > 0.8]
BRS = bridge_rows()
for a, b in zip(BRS, BRS[1:]):
    if b != (a + 1) % N: continue
    for j0, j1 in ((a, b),):
        P = lambda j, lat, dz: off(j, lat, dz)
        prof = [(-DECKW, 0.0), (-DECKW, -2.6), (DECKW, -2.6), (DECKW, 0.0)]
        ra = [P(j0, l, z) for l, z in prof]; rb = [P(j1, l, z) for l, z in prof]
        for k in range(3): f = bm.faces.new([ra[k], rb[k], rb[k + 1], ra[k + 1]][::-1] if False else [bm.verts.new(ra[k]), bm.verts.new(rb[k]), bm.verts.new(rb[k + 1]), bm.verts.new(ra[k + 1])]); f.material_index = 0
        for sd in (1, -1):        # the walkway between the road edge and the deck edge
            f = bm.faces.new([bm.verts.new(P(j0, sd * HW, -0.01)), bm.verts.new(P(j1, sd * HW, -0.01)), bm.verts.new(P(j1, sd * DECKW, -0.01)), bm.verts.new(P(j0, sd * DECKW, -0.01))][::sd]); f.material_index = 0
tun_kd = KDTree(sum(TUNNEL)); [tun_kd.insert((CL[i].x, CL[i].y, 0), i) for i in range(N) if TUNNEL[i]]; tun_kd.balance()
L_BR = (BR1 - BR0) % N
TA, TB = (BR0 + int(L_BR * 0.3)) % N, (BR0 + int(L_BR * 0.74)) % N       # the main tower west of the crossing, the small one east of it
for k in range(0, len(BRS), 22):
    i = BRS[k]
    if CL[i].z < 4 or tun_kd.find((CL[i].x, CL[i].y, 0))[2] < 26 or min(abs(i - TA), abs(i - TB)) < 8: continue
    box(bm, off(i, 0, -2.6 - (CL[i].z + 12) / 2), (2.6, 9.0, CL[i].z + 12 - 2.6), yaw=HEAD[i], mi=0)
def leg(bm, p0, p1, w, mi):       # a square leg from p0 to p1
    d = p1 - p0; L = d.length; c = (p0 + p1) / 2
    q = d.to_track_quat('Z', 'X'); Mx = Matrix.Translation(c) @ q.to_matrix().to_4x4()
    v = [bm.verts.new(Mx @ Vector((x * w / 2, y * w / 2, z * L / 2))) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    for qd in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)): f = bm.faces.new([v[k] for k in qd]); f.material_index = mi
def tower(i, top, diamond):
    base = CL[i]; nl = NL[i]; deck = base.z - 2.6
    apex = Vector((base.x, base.y, base.z + top)); feet = []
    for sd in (1, -1):
        foot = Vector((base.x, base.y, -12)) + nl * sd * (2.5 if diamond else 0.8)
        at_deck = Vector((base.x, base.y, deck)) + nl * sd * (DECKW + 3.0 if diamond else 1.2)
        if diamond: leg(bm, foot, at_deck, 3.4, 0); leg(bm, at_deck, apex, 3.0, 0)
        else: leg(bm, foot, at_deck + Vector((0, 0, top)), 3.0, 0)
        feet.append(at_deck)
    if diamond: leg(bm, apex, apex + Vector((0, 0, 28)), 2.2, 0); box(bm, Vector((base.x, base.y, deck - 1.0)), (3.0, 2 * (DECKW + 3.0), 2.0), yaw=HEAD[i] + math.pi / 2 * 0, mi=0)
    return apex
cb = bmesh.new()
def cables(i, apex, n, spacing, zlo, zhi, spread):
    for sd in (1, -1):
        for dirn in (1, -1):
            for k in range(1, n + 1):
                j = (i + dirn * k * spacing) % N
                if not BRIDGE[j]: continue
                anchor = off(j, sd * (DECKW - 0.4), 0.9)
                top = Vector((apex.x, apex.y, CL[i].z + zlo + (zhi - zlo) * k / n)) + NL[i] * sd * spread
                leg(cb, top, anchor, 0.28, 0)
aA = tower(TA, 110, True); cables(TA, aA, 14, 5, 52, 104, 0.8)
aB = tower(TB, 58, False)
cables(TB, aB, 8, 5, 30, 56, 0.9)
mesh_obj('IF bridge', bm, ['tower'], planar=False)
mesh_obj('IF cables', cb, ['cable'], planar=False)

# ------------------------------------------------------------------------------------------------ the tunnel: cutting walls, the tube's roof, the light line
bm = bmesh.new()
TS = [i for i in range(N) if TUNNEL[i] and CL[i].z < -0.3]
for a, b in zip(TS, TS[1:]):
    if b != (a + 1) % N: continue
    for sd in (1, -1):
        h = lambda j: max(1.2 - CL[j].z, 6.4 if CL[j].z < -5.0 else 1.2)     # retaining walls: up past the aprons (and the roof), a parapet on top
        q = [off(a, sd * (HW + 1.7), -0.3), off(b, sd * (HW + 1.7), -0.3), off(b, sd * (HW + 1.7), h(b)), off(a, sd * (HW + 1.7), h(a))]
        f = bm.faces.new([bm.verts.new(p) for p in (q if sd < 0 else q[::-1])]); f.material_index = 0
    if CL[a].z < -5.0 and CL[b].z < -5.0:
        q = [off(a, -(HW + 1.7), 6.4), off(b, -(HW + 1.7), 6.4), off(b, HW + 1.7, 6.4), off(a, HW + 1.7, 6.4)]
        f = bm.faces.new([bm.verts.new(p) for p in q[::-1]]); f.material_index = 0       # the roof, facing down
        q = [off(a, -0.3, 6.35), off(b, -0.3, 6.35), off(b, 0.3, 6.35), off(a, 0.3, 6.35)]
        f = bm.faces.new([bm.verts.new(p) for p in q[::-1]]); f.material_index = 1       # the light line
mesh_obj('IF tunnel', bm, ['tile', 'tlight'], planar=False)
# concrete aprons along the cutting on land, 20 cm over the ground: they cover the ground cells' ragged edge at the walls
bm = bmesh.new(); APRON = []
for a, b in zip(TS, TS[1:]):
    if b != (a + 1) % N or not is_land(CL[a].x, CL[a].y): continue
    for sd in (1, -1):
        q = [Vector((p.x, p.y, 0.2)) for p in (off(a, sd * (HW + 1.7)), off(b, sd * (HW + 1.7)), off(b, sd * (HW + 15.7)), off(a, sd * (HW + 15.7)))][::sd]
        APRON.append(q); f = bm.faces.new([bm.verts.new(p) for p in q]); f.material_index = 0
if bm.faces: mesh_obj('IF aprons', bm, ['concrete'])

# ------------------------------------------------------------------------------------------------ the city (IDENTITY.md): infinia_city.py builds the kit,
# infinia_place.py lines the streets and places the landmarks
NECK = set(range(TU1 + int(len(WEST) * 0.18), TU1 + int(len(WEST) * 0.75)))      # the west loop's long seafront arc
for part in ('infinia_city.py', 'infinia_place.py'): exec(compile((H / part).read_text(encoding='utf8'), str(H / part), 'exec'))

# ------------------------------------------------------------------------------------------------ street lamps: every 40 m round the lap, every 24 m both sides along the Necklace; none in the tunnel
bm = bmesh.new(); LAMPS = []
i = 0
while i < N:
    sides = (1, -1) if i in NECK else ((1,) if (i // 16) % 2 == 0 else (-1,))
    for sd in sides:
        if TUNNEL[i] and CL[i].z < -0.5: continue
        lat = sd * (BD[sd][i] + (0.6 if (BRIDGE[i] and CL[i].z > 1) else 1.5)); p = off(i, lat)
        foot = Vector((p.x, p.y, (CL[i].z if (BRIDGE[i] and CL[i].z > 1) else max(0.0, CL[i].z)) - 0.1))
        cyl(bm, foot, 0.16, 0.1, 9.2, n=6, mi=0, cap=False)
        head = foot + Vector((0, 0, 9.2)) - NL[i] * sd * 1.8
        box(bm, (foot + Vector((0, 0, 9.2)) + head) / 2, (0.12, 0.12, 0.12), mi=0)
        leg(bm, foot + Vector((0, 0, 9.1)), head + Vector((0, 0, 0.05)), 0.1, 0)
        box(bm, head - Vector((0, 0, 0.1)), (0.7, 0.32, 0.14), yaw=HEAD[i], mi=1)
        LAMPS.append(head - Vector((0, 0, 0.2)))
    i += 10 if i in NECK else 16
mesh_obj('IF lamps', bm, ['steel', 'lamp'], planar=False)
log('lamps', len(LAMPS))

walk = [[off(i, sd * HW), off((i + 1) % N, sd * HW), off((i + 1) % N, sd * BD[sd][(i + 1) % N]), off(i, sd * BD[sd][i])][::sd]
        for sd in (1, -1) for i in range(N) if (BRIDGE[i] and CL[i].z > 0.8) or (TUNNEL[i] and CL[i].z < -0.3)]     # the bridge's and tunnel's walkways
collision(ground_col, walk + APRON)
write_track('Infinia', ['Textures: Poly Haven (CC0); see tracks/infinia/CREDITS.md'], ['day', 'dusk', 'bluehour', 'night'], 'dusk',
            [{'name': 'Sea link tower', 'pos': to_game(aA)}])
(OUT / 'lights.json').write_text(json.dumps({'floodlights': [], 'standLamps': [], 'streetLamps': [{'pos': to_game(p), 'color': '#ffe2b8'} for p in LAMPS]},
                                            separators=(',', ':')), encoding='utf8')
export()
