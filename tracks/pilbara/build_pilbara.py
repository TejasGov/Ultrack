"""Pilbara Pit: a qualifying circuit down the wall of an open-cut iron-ore mine (track-viewer/docs/10x/maps-spec.md section 4), in one Blender pass.
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/maps/tracks/pilbara/build_pilbara.py -Log <abs log>
    (-Rest --no-export,stretch: the hero stretch, descent and switchback, for review stills first)
Layout: track-viewer/docs/career-worlds/pilbara.json (1.75 km, 18 m from rim to floor). Shared pieces: tracks/career_lib.py. Day and dusk only: no lights.json.
  road      15 m, kerbs below R140, jersey barriers 14 m out, a gravel run-off strip between them (flush with the road), a visual-only windrow behind each barrier
  ground    one 4 m heightfield: 6 m benches (4.5 m faces, 9.5 m berms) cut down from every road leg inside the loop and up from it outside, the max / min of
            continuous per-station terms (no cracks where two legs' terraces meet), a dry floor at -5.6 m, a lake basin under a static pit lake at -6.5 m
  far       a radial ring to 8.5 km on the rim plateau with waste-rock dumps, Dry Lake's goegap range on five arcs 6.5 km out
  plant     the crusher on the floor by the chicane, an enclosed conveyor gallery over the floor road up the south wall, a workshop shed and a water tank on the rim
  rocks     250 boulders on berms and floor, baked into one mesh"""
import bpy, sys
from pathlib import Path
H = Path(globals().get('__file__') or sys.argv[sys.argv.index('-P') + 1]).resolve().parent; ID = 'pilbara'; PFX = 'PP'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
assert H.resolve().parents[1] == ROOT and (ROOT / 'track-viewer').is_dir(), ROOT
assert H.name == ID, H
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
    'barrier': material('PP | barrier', tex='concrete_wall_009'),
    'ground': material('PP | ground', tex='red_laterite_soil_stones', vcol=True),
    'gravel': material('PP | gravel', tex='gravel_ground_01', vcol=True),
    'far': material('PP | far terrain', tex='red_laterite_soil_stones', vcol=True),
    'rock': material('PP | rock', tex='red_laterite_soil_stones'),
    'concrete': material('PP | concrete', tex='dirty_concrete'),
    'corr': material('PP | corrugated', tex='rusty_corrugated_iron'),
    'clad': material('PP | cladding', tex='box_profile_metal_sheet'),
    'steel': material('PP | steel', (0.24, 0.15, 0.11), tex='rusty_corrugated_iron', diff='none'),
    'door': material('PP | roller door', tex='painted_metal_shutter'),
    'water': material('PP | pit lake', (0.05, 0.16, 0.15), 0.09),
})
MAT['steel'].node_tree.nodes['Normal Map'].inputs['Strength'].default_value = 0.15      # the corrugation would read as ribs on a 0.5 m column
UVS.update({'asphalt': 3.5, 'kerb_r': 2.5, 'kerb_w': 2.5, 'ground': 6.0, 'gravel': 4.0, 'far': 40.0, 'rock': 3.0, 'concrete': 3.0, 'corr': 3.0, 'clad': 3.0, 'steel': 2.0, 'door': 5.0})
road(7.5, 140)
barriers(14.0)
b = bmesh.new(); b.from_mesh(bpy.data.objects[f'{PFX} lines'].data); vc = vcol_layer(b)     # the line material takes its white from the vertices
for f in b.faces:
    for l in f.loops: l[vc] = (0.62, 0.62, 0.6, 1)
b.to_mesh(bpy.data.objects[f'{PFX} lines'].data); b.free()

# ------------------------------------------------------------------------------------------------ run-off strip and windrows
bm = bmesh.new(); vc = vcol_layer(bm); ground_col = []
def gtone(co): t = 0.86 + 0.12 * fbm(co.x / 30, co.y / 30, 3); return (0.9 * t, 0.56 * t, 0.42 * t, 1)      # the grey gravel photo toned to the red road base
for sd in (1, -1):
    rows = [[off(i, sd * HW, -0.03), off(i, sd * (BD[sd][i] + 1.0), -0.07)] for i in range(N)]       # 3 cm under the road edge: no step to catch a wheel
    for f in strip(bm, rows, 0, rev=sd < 0):
        for l in f.loops: l[vc] = gtone(l.vert.co)
    ground_col += [[rows[i][0].copy(), rows[(i + 1) % N][0].copy(), rows[(i + 1) % N][1].copy(), rows[i][1].copy()][::sd] for i in range(N)]
    rows = []
    for i in range(N):      # a trapezoid 1.6 m high on a 4 m base, toes sunk into the ground; its height and crest wander a little
        p = CL[i]; h = 1.6 + 0.3 * fbm(p.x / 25, p.y / 25 + sd * 9, 2); w = 0.3 * fbm(p.x / 18 + 4, p.y / 18, 2); B = BD[sd][i]
        rows.append([off(i, sd * (B + 0.8), -0.45), off(i, sd * (B + 2.3 + w), h), off(i, sd * (B + 3.3 + w), h - 0.1), off(i, sd * (B + 4.8), -0.45)])
    for f in strip(bm, rows, 0, rev=sd < 0):
        for l in f.loops: l[vc] = gtone(l.vert.co)
mesh_obj(f'{PFX} gravel', bm, ['gravel'], smooth=True)

# ------------------------------------------------------------------------------------------------ ground: the benched heightfield
CA = np.array([[p.x, p.y, p.z] for p in CL]); NA_ = np.array([[n.x, n.y] for n in NL]); BDL, BDR = np.array(BD[1]), np.array(BD[-1])
ZF = float(CA[:, 2].min())      # the floor road; the start line on the rim is z 0
LAKE, FLOOR, BASIN = ZF - 6.5, ZF - 5.6, ZF - 8.6        # the water 0.9 m under the dry floor and 2.1 m over the basin: nothing near it is coplanar
CELL = 4.0; X0, X1, Y0, Y1 = min(xs) - 120, max(xs) + 120, min(ys) - 120, max(ys) + 120
GX, GY = int(math.ceil((X1 - X0) / CELL)), int(math.ceil((Y1 - Y0) / CELL)); X1, Y1 = X0 + GX * CELL, Y0 + GY * CELL
CX, CY = (X0 + X1) / 2, (Y0 + Y1) / 2
PADS = []      # (x, y, radius, z): flat sites for the plant
def sm(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def fb(px, py, sc, oct=3, o=0.0): return np.array([fbm(a / sc + o, b / sc, oct) for a, b in zip(px, py)])
def pip(px, py):      # crossing number against the centreline polygon
    xi, yi = CA[:, 0], CA[:, 1]; xj, yj = np.roll(xi, -1), np.roll(yi, -1); dy_ = np.where(yj == yi, 1e-9, yj - yi)
    c = (yi[None] > py[:, None]) != (yj[None] > py[:, None]); xint = xi[None] + (py[:, None] - yi[None]) * ((xj - xi) / dy_)[None]
    return np.count_nonzero(c & (px[:, None] < xint), axis=1) % 2 == 1
def heights(px, py):
    """ground z, distance to the nearest station, that station's barrier offset on this side, inside-the-loop, the bench coordinate s of the station
    that sets the height, and whether the point is on a plain terrace (not the run-off blend, the floor, the rim cap, a pad or the edge lip)"""
    px, py = np.asarray(px, float), np.asarray(py, float); n = len(px)
    Z, DN, BN, IN, S, TER = np.empty(n), np.empty(n), np.empty(n), pip(px, py), np.empty(n), np.empty(n, bool)
    n40, ncap, nlake = fb(px, py, 40), fb(px, py, 90, 3, 3.3), fb(px, py, 120, 2, 7.1)
    for a in range(0, n, 1500):
        s_ = slice(a, a + 1500); x, y = px[s_], py[s_]; r = np.arange(len(x))
        dx, dy = x[:, None] - CA[None, :, 0], y[:, None] - CA[None, :, 1]; d2 = dx * dx + dy * dy
        # each road leg speaks once, at its foot (a local minimum of the distance, refined on the parabola d^2 makes along a straight):
        # with every station in the max, the uphill ones win on a grade and the bench lines go ragged
        a2, c2 = np.roll(d2, 1, 1), np.roll(d2, -1, 1); den = np.maximum(a2 - 2 * d2 + c2, 1e-6); u = np.clip((a2 - c2) / (2 * den), -0.5, 0.5)
        d = np.sqrt(np.maximum(d2 - (a2 - c2) ** 2 / (8 * den), 0)); zr = CA[None, :, 2] + u * (np.roll(CA[:, 2], -1) - np.roll(CA[:, 2], 1))[None] / 2 - 0.35
        bd = np.where(dx * NA_[None, :, 0] + dy * NA_[None, :, 1] > 0, BDL[None], BDR[None]); ex = d - bd - 6
        s = ex + 3 * n40[s_, None] * sm(0, 5, ex)       # the bench lines wander a few metres, fading in past the run-off so nothing steps there
        rise = np.where(s < 0, 0.0, 6 * np.floor(np.maximum(s, 0) / 14) + 6 * sm(0, 4.5, np.mod(np.maximum(s, 0), 14)))
        far = (d > 220) | (d2 > a2) | (d2 > c2)
        tin, tout = np.where(far, -1e9, zr - rise), np.where(far, 1e9, zr + rise); jin, jout = tin.argmax(1), tout.argmin(1); zin, zout = tin[r, jin], tout[r, jout]
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

gxs, gys = np.meshgrid(X0 + CELL * np.arange(GX + 1), Y0 + CELL * np.arange(GY + 1)); GZ, GD, GB, GI, GS, GT = (a.reshape(gxs.shape) for a in heights(gxs.ravel(), gys.ravel()))
# a 4 m grid samples a 4.5 m bench face about once, and the crests come out as sawtooth: so every vertex near a bench toe or crest (s = 0 or 4.5,
# mod 14) moves onto it along the gradient of s, by under 0.4 of a cell (neighbours never cross), where s is smooth (one station sets it all round)
gsy, gsx = np.gradient(GS, CELL); g2 = gsx ** 2 + gsy ** 2; rr = np.mod(GS, 14)
brk = np.where(rr < 2.25, -rr, np.where(rr < 9.25, 4.5 - rr, 14 - rr)); mx_, my_ = brk * gsx / np.maximum(g2, 1e-9), brk * gsy / np.maximum(g2, 1e-9)
ok = GT.copy(); ok[0, :] = ok[-1, :] = ok[:, 0] = ok[:, -1] = False
ok[1:-1, 1:-1] &= GT[:-2, 1:-1] & GT[2:, 1:-1] & GT[1:-1, :-2] & GT[1:-1, 2:]
ok &= (g2 > 0.6 ** 2) & (g2 < 1.5 ** 2) & (np.hypot(mx_, my_) < 0.4 * CELL)
gxs, gys = gxs + np.where(ok, mx_, 0), gys + np.where(ok, my_, 0)
for a_, v_ in zip((GZ, GD, GB, GI), heights(gxs[ok], gys[ok])[:4]): a_[ok] = v_
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
        if min(GD[q_] - GB[q_] for q_ in idx) < 7: ground_col.append([v.co.copy() for v in q])     # the barrier is the wall: 7 m behind it is the safety net (15k-triangle budget)
        z_ = [GZ[q_] for q_ in idx]      # split along the diagonal that follows the contour
        for t_ in (((0, 1, 2), (0, 2, 3)) if abs(z_[0] - z_[2]) <= abs(z_[1] - z_[3]) else ((0, 1, 3), (1, 2, 3))):
            f = bm.faces.new([q[k] for k in t_]); f.material_index = 0; f.smooth = True
for v in [v for v in bm.verts if not v.link_faces]: bm.verts.remove(v)
bm.normal_update(); uv = bm.loops.layers.uv.verify()
QD = [Vector((math.cos(a), math.sin(a), 0)) for a in (0, math.pi / 4, math.pi / 2, 3 * math.pi / 4)]
for f in bm.faces:      # slope UVs: bench faces projected along their own horizontal facing (one of four), so the laterite never stretches by more than 8 %
    n = f.normal
    if n.z >= 0.75: uvs = [(l.vert.co.x / 6, l.vert.co.y / 6) for l in f.loops]
    else:
        t = Vector((-n.y, n.x, 0)); t = max(QD, key=lambda q: abs(q.dot(t)))
        uvs = [(t.dot(l.vert.co) / 6, l.vert.co.z / 6) for l in f.loops]
    for l, u in zip(f.loops, uvs): l[uv].uv = u
for e in bm.edges:
    if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.55: e.smooth = False      # crisp bench crests and toes, smooth berms
for v in bm.verts:      # darker, redder faces; paler, dustier berm tops
    co = v.co; t = 0.9 + 0.1 * fbm(co.x / 50, co.y / 50, 3) + 0.05 * fbm(co.x / 7, co.y / 7, 2); k = ss(0.6, 0.92, v.normal.z)
    col = tuple(t * (a + (b_ - a) * k) for a, b_ in ((0.78, 1.0), (0.66, 0.92), (0.6, 0.86)))
    for l in v.link_loops: l[vc] = (*col, 1)
mesh_obj(f'{PFX} ground', bm, ['ground'], planar=False)
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

# ------------------------------------------------------------------------------------------------ far ring and backdrop
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
radii = [260 * (8500 / 260) ** (k / 70) for k in range(71)]; NA = 192
ring = [[bm.verts.new((CX + r * math.cos(a), CY + r * math.sin(a), 0)) for a in (2 * math.pi * k / NA for k in range(NA))] for r in radii]
for rr, row in zip(radii, ring):
    for v in row: v.co.z = far_z(v.co.x, v.co.y, rr)
for k in range(len(radii) - 1):
    for a in range(NA):
        f = bm.faces.new([ring[k][a], ring[k + 1][a], ring[k + 1][(a + 1) % NA], ring[k][(a + 1) % NA]]); f.material_index = 0; f.smooth = True
        for l in f.loops:
            co = l.vert.co; t = 0.88 + 0.12 * fbm(co.x / 400, co.y / 400, 2); k_ = ss(ZF + 24, ZF + 40, co.z)      # dump tops a paler, older red
            l[vc] = (t * (0.92 + 0.06 * k_), t * (0.82 + 0.08 * k_), t * (0.76 + 0.08 * k_), 1)
mesh_obj(f'{PFX} far terrain', bm, ['far'])
def backdrop(name, png, gain, r):       # build_drylake.py's, read from its tex/
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(DL / png)
    P.inputs['Base Color'].default_value = (0, 0, 0, 1); P.inputs['Roughness'].default_value = 1
    nt.links.new(it.outputs['Color'], P.inputs['Emission Color']); P.inputs['Emission Strength'].default_value = gain
    nt.links.new(it.outputs['Alpha'], P.inputs['Alpha'])
    try: m.surface_render_method = 'BLENDED'
    except AttributeError: m.blend_method = 'BLEND'
    b = bmesh.new(); uv = b.loops.layers.uv.verify(); SEG, K_ = 24, 0.45; SPAN = math.radians(55 * K_)
    for k_, deg in enumerate((8, 77, 148, 218, 290)):
        mid, flip = math.radians(deg), k_ % 2 == 1
        z0, z1 = 1.5 + r * math.tan(math.radians(-4 * K_)), 1.5 + r * math.tan(math.radians(14 * K_))
        rows = [[b.verts.new((CX + r * math.cos(a_), CY + r * math.sin(a_), z)) for z in (z0, z1)] for a_ in (mid + SPAN / 2 - SPAN * q / SEG for q in range(SEG + 1))]
        for q in range(SEG):
            f = b.faces.new([rows[q][0], rows[q + 1][0], rows[q + 1][1], rows[q][1]])
            for l, (uq, vq) in zip(f.loops, ((q, 0), (q + 1, 0), (q + 1, 1), (q, 1))): u = uq / SEG; l[uv].uv = (1 - u if flip else u, vq)
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free(); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); VIS.objects.link(ob); return ob
backdrop('Backdrop | goegap dusk', 'backdrop_dusk.png', 2.0, 6502.0)
backdrop('Backdrop | goegap day', 'backdrop_day.png', 5.0, 6500.0)

# ------------------------------------------------------------------------------------------------ plant: crusher, conveyor gallery, shed, tank
def planar_uv(bm, s, faces=None):       # mesh_obj's world UVs, for meshes that also carry faces with their own
    uv = bm.loops.layers.uv.verify(); bm.normal_update()
    for f in faces if faces is not None else bm.faces:
        n = f.normal
        for l in f.loops: c = l.vert.co; l[uv].uv = (c.x / s, c.y / s) if abs(n.z) > 0.6 else ((c.y if abs(n.x) > abs(n.y) else c.x) / s, c.z / s)
def beam(bm, a, b_, w, h, mi=0):        # a box from a to b (centres), w wide (horizontal), h tall (vertical)
    t = (b_ - a); s_ = Vector((-t.y, t.x, 0)).normalized() * (w / 2); u = Vector((0, 0, h / 2))
    v = [bm.verts.new(p + s_ * x + u * z) for p in (a, b_) for x in (-1, 1) for z in (-1, 1)]
    for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)): f = bm.faces.new([v[k] for k in q]); f.material_index = mi
BMS = {k: bmesh.new() for k in ('concrete', 'corr', 'clad', 'steel', 'door')}; TANK = []
crusher_top = None
if not STRETCH:
    yaw = HEAD[i5]; g = gz(CR.x, CR.y)
    box(BMS['concrete'], Vector((CR.x, CR.y, g + 3.6)), (20, 14, 8.4), yaw)       # 0.4 m into the floor
    box(BMS['corr'], Vector((CR.x, CR.y, g + 12.8)), (16, 12, 10), yaw)
    box(BMS['clad'], Vector((CR.x, CR.y, g + 19.3)), (7, 6, 3), yaw)
    crusher_top = g + 20.8
    # the gallery: out of the crusher's upper box toward the outside wall, over the floor road, to a head tower on the rim
    dirv = NL[i5]; A = Vector((CR.x, CR.y, g + 15.5)); L1 = 80 + BD[-1][i5] + 36; E2 = A + dirv * L1
    samples = [(k / 40, gz(*(A + dirv * L1 * k / 40).to_2d())) for k in range(41)]
    ze = max((zg + 4.5 - A.z * (1 - k)) / k for k, zg in samples if k > 0.05)      # the end height that keeps the underside 3 m over every sample
    E = Vector((E2.x, E2.y, max(ze, A.z)))
    beam(BMS['clad'], A, E, 3.0, 3.0)
    zl = lambda k: A.z + (E.z - A.z) * k
    road_k = (BD[-1][i5] + 36) / L1; log('gallery underside over the road', round(zl(road_k) - 1.5 - CL[i5].z, 1), 'm; end', round(E.z, 1))
    assert zl(road_k) - 1.5 - CL[i5].z >= 8, 'the gallery must clear the floor road by 8 m'
    ge = gz(E.x, E.y); box(BMS['clad'], Vector((E.x, E.y, (ge - 0.5 + E.z + 3) / 2)), (6, 6, E.z + 3.5 - ge), HEAD[i5])
    for k in range(1, int(L1 / 18)):        # trestles every 18 m, none inside the barriers
        p = A + dirv * (18 * k); j, d = near(p.x, p.y)
        if d < max(BD[1][j], BD[-1][j]) + 2 or (p - E).to_2d().length < 6: continue
        zg = gz(p.x, p.y); top = zl(18 * k / L1) - 1.5; s_ = Vector((-dirv.y, dirv.x, 0)) * 1.2
        for sg in (1, -1): q = p + s_ * sg; box(BMS['steel'], Vector((q.x, q.y, (zg - 0.4 + top) / 2)), (0.5, 0.5, top - zg + 0.4), HEAD[i5])
        box(BMS['steel'], Vector((p.x, p.y, top - 0.3)), (0.4, 3.4, 0.6), math.atan2(dirv.y, dirv.x))
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

# ------------------------------------------------------------------------------------------------ boulders: three displaced icospheres, baked
PROTO = []
for k in range(3):
    t = bmesh.new(); r = bmesh.ops.create_icosphere(t, subdivisions=1, radius=1.0)
    PROTO.append([v.co * (1 + 0.32 * noise.noise(v.co * 1.6 + Vector((k * 7.1, k * 3.3, 0)))) * Vector((1, 1, 0.72)) for v in r['verts']]); t.free()
cand = np.array([(RNG.uniform(X0 + 30, X1 - 30), RNG.uniform(Y0 + 30, Y1 - 30)) for _ in range(5000)])
CZ, CD, CB, *_ = heights(cand[:, 0], cand[:, 1]); EZ = [heights(cand[:, 0] + dx, cand[:, 1] + dy)[0] for dx, dy in ((2, 0), (0, 2))]
rk = bmesh.new(); nr = 0
for (x, y), z, d, bd, zx, zy in zip(cand, CZ, CD, CB, *EZ):
    if nr >= 250: break
    if d < bd + 5 or z < LAKE + 0.4 or math.hypot(zx - z, zy - z) > 0.5 or not IN_STRETCH(near(x, y)[0]): continue       # behind the windrow, on flat ground, dry
    if any(math.hypot(x - sx, y - sy) < sr + 6 for sx, sy, sr, _ in PADS): continue
    sz = RNG.uniform(0.6, 1.6) * (1 + 0.8 * (RNG.random() < 0.15)); M_ = Matrix.Translation((x, y, z - 0.3 * sz)) @ Matrix.Rotation(RNG.uniform(0, 6.3), 4, 'Z') @ Matrix.Scale(sz, 4)
    r = bmesh.ops.create_icosphere(rk, subdivisions=1, radius=1.0)
    for v, p in zip(r['verts'], PROTO[nr % 3]): v.co = M_ @ (p * Vector((RNG.uniform(0.85, 1.15), 1, 1)))
    nr += 1
for f in rk.faces: f.smooth = True
mesh_obj(f'{PFX} rocks', rk, ['rock'])
log('boulders', nr)

collision(ground_col)
LM = [{'name': 'Crusher', 'pos': to_game(Vector((CR.x, CR.y, crusher_top or ZF)))}]
write_track('Pilbara Pit', ['Textures: Poly Haven (CC0); see tracks/pilbara/CREDITS.md'], ['day', 'dusk'], 'day', LM)
export()
