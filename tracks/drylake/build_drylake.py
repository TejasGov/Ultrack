"""Mojave Dry Lake: the whole circuit from its concept centreline, in one Blender pass, straight into the game frame.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/drylake/build_drylake.py    (one Blender at a time, -b -t 6)
Reads track-viewer/docs/career-worlds/drylake.json (scaled waypoints, scripts/sketch-layouts.mjs) and writes out/drylake.blend, then
out/drylake_visual.glb, out/drylake_collision.glb and out/track.json (the contract of src/tracks.js and scripts/test-track.mjs,
as tracks/india/game_india.py). `-- --no-export` saves the blend only.
The scene is built in the game frame: start line at the origin, start heading +X, Z up (glTF export turns it to Y up: x, z, -y).
  road      16 m asphalt on the centreline (centripetal Catmull-Rom of the waypoints, ~2.5 m stations), white edge lines, start line and grid
            marks, red / white kerbs through every corner tighter than 140 m, skirts at the open edges
  runway    45 m concrete along the main straight (centreline dashes and threshold bars), the track on its southern half: rows beside the
            road, never under it (nothing lies on another surface: at 0.1 m near plane the depth buffer cannot split 3 cm past ~200 m)
  ground    an 8 m heightfield: flat under the road, a dirt berm where the road climbs, undulating desert, the pale dry lake to the north and
            east; a polar ring beyond it to 8.5 km with mesas and a far ridge (the camera's far plane is 9 km)
  barriers  concrete jersey barriers 18 m out (closer on the inside of tight corners, so the offset never folds), collision on their faces
  venue     arched hangars, a control tower, the water tower T4 circles. Day and dusk only (the career's small tracks follow the story):
            no lights.json, no masts, no night lamps
  boneyard  the A320 (Kyaie, CC BY, source/a320_kyaie) in bare metal, white, primer and sun-faded paint: wings over the track edge
            through T2-T3, a parked field in the infield and one at the T1 hairpin; all of them one mesh (three materials, three draws)
  dressing  rocks and creosote scrub, one mesh each
  backdrop  the distant range photographed (goegap HDRI, make_backdrop.py) on five arcs 6.5 km out, day and dusk copies"""
import bpy, bmesh, json, math, random, struct, sys
from pathlib import Path
from mathutils import Vector, Matrix, noise
from mathutils.kdtree import KDTree

H = Path(r'D:/RaceUltimate/tracks/drylake'); ROOT = H.parent.parent; OUT = H / 'out'; OUT.mkdir(exist_ok=True)
PH = ROOT / 'assets' / 'polyhaven'
SRC = json.loads((ROOT / 'track-viewer' / 'docs' / 'career-worlds' / 'drylake.json').read_text(encoding='utf8'))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
EXPORT = '--no-export' not in ARGS
RNG = random.Random(17)
def log(*a): print('[drylake]', *a, flush=True)
def ss(a, b, x): t = min(1.0, max(0.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def fbm(x, y, oct=4):
    s, a, f = 0.0, 1.0, 1.0
    for _ in range(oct): s += a * noise.noise(Vector((x * f, y * f, 0.37 * f))); a *= 0.5; f *= 2.03
    return s

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene
VIS = bpy.data.collections.new('visual'); COL = bpy.data.collections.new('collision')
sc.collection.children.link(VIS); sc.collection.children.link(COL)

# ------------------------------------------------------------------------------------------------ 1. centreline
def catmull(pts, per=64):          # centripetal, the same curve as scripts/sketch-layouts.mjs
    n, out = len(pts), []
    for i in range(n):
        P = [pts[(i + k) % n] for k in (-1, 0, 1, 2)]
        kn = [0.0]
        for k in range(1, 4): kn.append(kn[-1] + max(1e-6, math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1])) ** 0.5)
        for s in range(per):
            t = kn[1] + (kn[2] - kn[1]) * s / per
            L = lambda a, b, p, q: [((kn[b] - t) * p[d] + (t - kn[a]) * q[d]) / (kn[b] - kn[a]) for d in range(3)]
            A1, A2, A3 = L(0, 1, P[0], P[1]), L(1, 2, P[1], P[2]), L(2, 3, P[2], P[3])
            out.append(L(1, 2, L(0, 2, A1, A2), L(1, 3, A2, A3)))
    return out
poly = catmull(SRC['waypoints'])
seg = [math.hypot(poly[(i + 1) % len(poly)][0] - p[0], poly[(i + 1) % len(poly)][1] - p[1]) for i, p in enumerate(poly)]
LAP = sum(seg); N = round(LAP / 2.5); STEP = LAP / N
CL, j, cum = [], 0, 0.0
for k in range(N):
    s = k * STEP
    while j < len(seg) - 1 and cum + seg[j] < s: cum += seg[j]; j += 1
    a, b = poly[j], poly[(j + 1) % len(poly)]; f = (s - cum) / seg[j]
    CL.append(Vector([a[d] + (b[d] - a[d]) * f for d in range(3)]))
zs = [p.z for p in CL]
for _ in range(3): zs = [sum(zs[(i + d) % N] for d in range(-6, 7)) / 13 for i in range(N)]     # no kinks in the grade
for p, z in zip(CL, zs): p.z = z
t0 = (CL[1] - CL[-1]).to_2d(); ang = -math.atan2(t0.y, t0.x); M = Matrix.Rotation(ang, 4, 'Z') @ Matrix.Translation((-CL[0].x, -CL[0].y, -CL[0].z))
CL = [M @ p for p in CL]
T = [(CL[(i + 1) % N] - CL[i - 1]).to_2d().normalized() for i in range(N)]
NL = [Vector((-t.y, t.x, 0)) for t in T]                     # left normal
HEAD = [math.atan2(t.y, t.x) for t in T]
def dturn(i): d = HEAD[(i + 1) % N] - HEAD[i]; return (d + math.pi) % (2 * math.pi) - math.pi
K = [sum(dturn((i + d) % N) for d in range(-4, 4)) / (8 * STEP) for i in range(N)]     # signed curvature, + = left
R = [1 / max(abs(k), 1e-5) for k in K]
RW = [min(R[(i + d) % N] for d in range(-12, 13)) for i in range(N)]                     # the tightest radius within 30 m
KD = KDTree(N)
for i, p in enumerate(CL): KD.insert((p.x, p.y, 0), i)
KD.balance()
def near(x, y): co, i, d = KD.find((x, y, 0)); return i, d
def off(i, lat, dz=0.0): p = CL[i] + NL[i] * lat; return Vector((p.x, p.y, CL[i].z + dz))
xs, ys = [p.x for p in CL], [p.y for p in CL]
log('lap', round(LAP, 1), 'm,', N, 'stations of', round(STEP, 3), 'm; tightest radius', round(min(R), 1))

# ------------------------------------------------------------------------------------------------ 2. materials
def image(path, data=False):
    im = bpy.data.images.load(str(path), check_existing=True)
    if data: im.colorspace_settings.name = 'Non-Color'
    return im
def material(name, base=(0.8, 0.8, 0.8), rough=0.8, metal=0.0, tex=None, vcol=False, emit=None, alpha=None, diff=None):
    """tex: a Poly Haven set (diffuse, ARM, GL normal); diff: another diffuse image for it, or 'none' (vertex colour only)"""
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P = nt.nodes['Principled BSDF']
    P.inputs['Base Color'].default_value = (*base, 1); P.inputs['Roughness'].default_value = rough; P.inputs['Metallic'].default_value = metal
    col = None
    if tex:
        d = PH / tex; res = '2k' if (d / f'{tex}_diff_2k.jpg').exists() else '1k'
        if diff != 'none': it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(diff or d / f'{tex}_diff_{res}.jpg'); col = it.outputs['Color']
        ia = nt.nodes.new('ShaderNodeTexImage'); ia.image = image(d / f'{tex}_arm_{res}.jpg', True)
        sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(ia.outputs['Color'], sp.inputs['Color'])
        nt.links.new(sp.outputs['Green'], P.inputs['Roughness']); nt.links.new(sp.outputs['Blue'], P.inputs['Metallic'])
        inn = nt.nodes.new('ShaderNodeTexImage'); inn.image = image(d / f'{tex}_nor_gl_{res}.jpg', True)
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(inn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], P.inputs['Normal'])
    if vcol:
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        if col:
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
            nt.links.new(col, mx.inputs[6]); nt.links.new(vc.outputs['Color'], mx.inputs[7]); col = mx.outputs[2]
        else: col = vc.outputs['Color']
    if col: nt.links.new(col, P.inputs['Base Color'])
    if emit: P.inputs['Emission Color'].default_value = (*emit[0], 1); P.inputs['Emission Strength'].default_value = emit[1]
    return m
MAT = {
    'asphalt': material('DL | asphalt', tex='asphalt_track', rough=0.75, diff=H / 'tex' / 'asphalt_track_bleached_diff_2k.jpg'),     # sun-bleached: the photo is 13 % grey
    'line': material('DL | line white', (0.62, 0.62, 0.6), 0.6),
    'kerb_r': material('DL | kerb red', (0.55, 0.06, 0.05), 0.6),
    'kerb_w': material('DL | kerb white', (0.66, 0.66, 0.63), 0.6),
    'runway': material('DL | runway concrete', tex='brushed_concrete', rough=0.8, vcol=True),
    'paint': material('DL | runway paint', (0.6, 0.6, 0.57), 0.65),
    # one ground material for sand and lake bed: a pale, neutral copy of the sand photo, toned by the vertices, so the shore is a blend, not a seam
    'sand': material('DL | ground', tex='aerial_sand', vcol=True, diff=H / 'tex' / 'aerial_sand_pale_diff_1k.jpg'),
    'far': material('DL | far terrain', rough=1.0, vcol=True),
    'barrier': material('DL | barrier', tex='concrete_wall_009'),
    'hwall': material('DL | hangar wall', tex='painted_metal_shutter'),
    'hroof': material('DL | hangar roof', tex='grey_roof_01'),
    'concrete': material('DL | concrete', tex='concrete_wall_009'),
    'glass': material('DL | glass', (0.04, 0.05, 0.06), 0.08),
    'steel': material('DL | steel', (0.5, 0.5, 0.48), 0.5, 0.6),
    'tank': material('DL | water tank', (0.78, 0.76, 0.7), 0.55, 0.3),
    'skin': material('DL | aircraft skin', (1, 1, 1), 0.45, 0.55, vcol=True),
    'dark': material('DL | aircraft dark', (0.05, 0.05, 0.055), 0.5),
    'rock': material('DL | rock', rough=0.92, vcol=True),
    'scrub': material('DL | scrub', rough=0.95, vcol=True),
}
UVS = {'asphalt': 3.5, 'runway': 5.0, 'sand': 7.0, 'lake': 9.0, 'barrier': 2.0, 'hwall': 3.0, 'hroof': 4.0, 'concrete': 3.0}

def mesh_obj(name, bm, mats, coll=VIS, smooth=False, planar=True):
    """bm faces carry material_index into `mats` (keys of MAT); planar: world UVs (x, y on flat faces, the dominant axis on walls)"""
    uv = bm.loops.layers.uv.verify(); bm.normal_update()      # new faces have no normal until this
    if planar:
        for f in bm.faces:
            s = UVS.get(mats[f.material_index], 4.0); n = f.normal
            for l in f.loops:
                c = l.vert.co
                l[uv].uv = (c.x / s, c.y / s) if abs(n.z) > 0.6 else ((c.y if abs(n.x) > abs(n.y) else c.x) / s, c.z / s)
    if smooth:
        for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for k in mats: me.materials.append(MAT[k])
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob
def vcol_layer(bm): return bm.loops.layers.float_color.get('Col') or bm.loops.layers.float_color.new('Col')
def strip(bm, rows, mi, closed=True, rev=False):
    """quads between consecutive rows of verts (rows: lists of Vector of equal length)"""
    V = [[bm.verts.new(p) for p in r] for r in rows]; n = len(V); out = []
    for i in range(n if closed else n - 1):
        a, b = V[i], V[(i + 1) % n]
        for k in range(len(a) - 1):
            q = [a[k], b[k], b[k + 1], a[k + 1]]
            f = bm.faces.new(q[::-1] if rev else q); f.material_index = mi; out.append(f)
    return out

# ------------------------------------------------------------------------------------------------ 3. road, lines, kerbs
HW = 8.0
bm = bmesh.new()
strip(bm, [[off(i, l) for l in (-HW, -4, 0, 4, HW)] for i in range(N)], 0)
for sd in (1, -1):    # skirts: the open edges reach down under the ground
    strip(bm, [[off(i, sd * HW), off(i, sd * HW, -0.4)] for i in range(N)], 0, rev=sd < 0)
road = mesh_obj('DL road', bm, ['asphalt'], smooth=True)
bm = bmesh.new()
for sd in (1, -1): strip(bm, [[off(i, sd * 7.35, 0.03), off(i, sd * 7.65, 0.03)] for i in range(N)], 0, rev=sd < 0)
def bar(bm, i, lat0, lat1, ds0, ds1, mi=0, dz=0.03):      # a painted rectangle on the road: lateral lat0..lat1, ds0..ds1 m along station i
    p = [CL[i] + NL[i] * l + T[i].to_3d() * d for d, l in ((ds0, lat0), (ds1, lat0), (ds1, lat1), (ds0, lat1))]
    f = bm.faces.new([bm.verts.new((q.x, q.y, CL[i].z + dz)) for q in p]); f.material_index = mi
bar(bm, 0, -HW + 0.4, HW - 0.4, -0.3, 0.3)
SLOTS = []
for k in range(8):
    s = (LAP - (8 + 8 * k)) % LAP; i = int(s / STEP); lat = 3.0 if k % 2 == 0 else -3.0
    SLOTS.append((i, lat))
    bar(bm, i, lat - 1.2, lat + 1.2, 2.2, 2.45); bar(bm, i, lat - 1.2, lat - 1.05, 0.6, 2.45); bar(bm, i, lat + 1.05, lat + 1.2, 0.6, 2.45)
lines = mesh_obj('DL lines', bm, ['line'])
CORNER = [any(R[(i + d) % N] < 140 for d in range(-8, 9)) for i in range(N)]
bm = bmesh.new(); kerb_faces = 0
for sd in (1, -1):
    for i in range(N):
        if not (CORNER[i] and CORNER[(i + 1) % N]): continue
        a, b = i, (i + 1) % N
        rows = [[off(j, sd * HW, -0.005), off(j, sd * (HW + 0.7), 0.05), off(j, sd * (HW + 1.4), 0.05), off(j, sd * (HW + 1.4), -0.4)] for j in (a, b)]
        vs = [[bm.verts.new(p) for p in r] for r in rows]
        for k in range(3):
            q = [vs[0][k], vs[1][k], vs[1][k + 1], vs[0][k + 1]]
            f = bm.faces.new(q if sd > 0 else q[::-1]); f.material_index = (i // 1) % 2; kerb_faces += 1
kerbs = mesh_obj('DL kerbs', bm, ['kerb_r', 'kerb_w'])
log('kerb faces', kerb_faces)

# ------------------------------------------------------------------------------------------------ 4. runway: 45 m along the main straight, the track on its southern half
S = [0]                       # the main straight: the run of stations around the start line that holds the heading
while abs(HEAD[(S[-1] + 1) % N]) < 0.05: S.append(S[-1] + 1)
while abs(HEAD[(S[0] - 1) % N]) < 0.05: S.insert(0, S[0] - 1)
XA, XB = off(S[0] % N, HW).x, off(S[-1] % N, HW).x
RX0, RX1 = XA - 140, XB + 170
RY0, RY1, RYC = -10.5, 34.5, 12.0
# no surface lies on another (the depth buffer cannot split 3 cm beyond ~200 m): along the straight the runway is rows beside the road;
# past its ends, overrun aprons north of the road line (the hairpin and the last corner leave the runway to the south)
PAVED = []
def pv(x, y): return Vector((x, y, min(0.0, CL[near(x, y)[0]].z) - 0.03))     # 3 cm under the road it meets, wherever the road dips
for i0, i1 in zip(S, S[1:]):
    a_, b_ = i0 % N, i1 % N
    for sd, ye in ((1, RY1), (-1, RY0)):
        ra = [off(a_, sd * HW, -0.03)]; rb = [off(b_, sd * HW, -0.03)]
        # the rows go down with the road where it dips: level at 3 cm under zero they left it in a trench, with a 38 cm slab end across the run-off where the trench stops (a solid wall at station 633)
        if sd > 0: ra.append(pv(ra[0].x, RYC)); rb.append(pv(rb[0].x, RYC))
        ra.append(pv(ra[0].x, ye)); rb.append(pv(rb[0].x, ye))
        for k in range(len(ra) - 1): PAVED.append([ra[k], rb[k], rb[k + 1], ra[k + 1]][::sd])
for x0, x1 in ((RX0, XA), (XB, RX1)):
    n_ = max(1, int((x1 - x0) / 10))
    for c_ in range(n_):
        u0, u1 = x0 + (x1 - x0) * c_ / n_, x0 + (x1 - x0) * (c_ + 1) / n_
        for y0, y1 in ((HW + 0.5, RYC), (RYC, RY1)): PAVED.append([pv(u0, y0), pv(u1, y0), pv(u1, y1), pv(u0, y1)])
bm = bmesh.new(); vc = vcol_layer(bm)
for q in PAVED:
    f = bm.faces.new([bm.verts.new(p) for p in q]); f.material_index = 0
    for l in f.loops: c = l.vert.co; t = 0.86 + 0.12 * fbm(c.x / 90, c.y / 90, 3); l[vc] = (t, t * 0.99, t * 0.97, 1)
runway = mesh_obj('DL runway', bm, ['runway'])
bm = bmesh.new()
def pbox(bm, x0, x1, y0, y1):       # 3 cm over the runway, in 5 m pieces to follow it through the dip
    n_ = max(1, int((x1 - x0) / 5))
    for k_ in range(n_):
        u0, u1 = x0 + (x1 - x0) * k_ / n_, x0 + (x1 - x0) * (k_ + 1) / n_
        f = bm.faces.new([bm.verts.new((x, y, pv(x, y).z + 0.03)) for x, y in ((u0, y0), (u1, y0), (u1, y1), (u0, y1))]); f.material_index = 0
x = RX0 + 60
while x < RX1 - 90:     # centreline dashes: 30 m on, 20 m off
    pbox(bm, x, x + 30, RYC - 0.45, RYC + 0.45); x += 50
for xe in (RX0 + 6, RX1 - 36):      # threshold bars at both ends, north of the track
    for k in range(6):
        y = RYC + 3 + k * 3.6
        if y + 1.8 < RY1: pbox(bm, xe, xe + 30, y, y + 1.8)
paint = mesh_obj('DL runway paint', bm, ['paint'])

# ------------------------------------------------------------------------------------------------ 5. barriers: jersey profile, 18 m out, never folding on the inside of a corner
def barrier_offsets(sd):
    D = []
    for i in range(N):
        inside = (K[i] > 0) == (sd > 0) and RW[i] < 60
        D.append(min(18.0, max(HW + 2.6, 0.62 * RW[i])) if inside else 18.0)
    for _ in range(4): D = [sum(D[(i + d) % N] for d in range(-6, 7)) / 13 for i in range(N)]
    return D
BD = {1: barrier_offsets(1), -1: barrier_offsets(-1)}
PROF = [(0, 0), (0.05, 0.075), (0.2, 0.33), (0.225, 0.81), (0.375, 0.81), (0.4, 0.33), (0.55, 0.075), (0.6, 0)]
bm = bmesh.new()
for sd in (1, -1):
    strip(bm, [[off(i, sd * (BD[sd][i] + u), v - 0.05) for u, v in PROF] for i in range(N)], 0, rev=sd < 0)
barrier = mesh_obj('DL barriers', bm, ['barrier'], smooth=False, planar=False)
bm2 = bmesh.new(); bm2.from_mesh(barrier.data); uv = bm2.loops.layers.uv.verify()       # UVs along the barrier: 2 m repeats
for f in bm2.faces:
    for l in f.loops: c = l.vert.co; i, _ = near(c.x, c.y); l[uv].uv = (i * STEP / 2.0, c.z / 2.0 + (c - CL[i]).length / 2.0)
bm2.to_mesh(barrier.data); bm2.free()

# ------------------------------------------------------------------------------------------------ 6. ground: heightfield, dry lake, berm; far ring
X0, X1, Y0, Y1 = min(xs) - 760, max(xs) + 760, min(ys) - 760, max(ys) + 760
CELL = 8.0; GX, GY = int((X1 - X0) / CELL), int((Y1 - Y0) / CELL)
XMAX = max(xs)
def lake_w(x, y, d):
    w = max(ss(150, 300, y + 90 * fbm(x / 500, 3.1, 3)), ss(XMAX + 70, XMAX + 240, x + 90 * fbm(y / 500, 7.7, 3)))
    return w * ss(70, 110, d)
def ground_z(x, y):
    i, d = near(x, y); zr = CL[i].z - 0.12
    base = 0.9 * fbm(x / 220, y / 220, 3) + 2.2 * fbm(x / 700 + 5, y / 700, 2) + 0.6
    lw = lake_w(x, y, d); base = base * (1 - lw) - 0.5 * lw
    edge = min(x - X0, X1 - x, y - Y0, Y1 - y); base = base * ss(40, 200, edge) - 12 * (1 - ss(0, 80, edge))     # a lip under the far ring: they cross, never coincide
    return zr + (base - zr) * ss(13, 60, d), lw, d
bm = bmesh.new(); vc = vcol_layer(bm)
G = [[None] * (GX + 1) for _ in range(GY + 1)]; LW = {}
for r in range(GY + 1):
    for c in range(GX + 1):
        x, y = X0 + c * CELL, Y0 + r * CELL; z, lw, d = ground_z(x, y); v = bm.verts.new((x, y, z)); G[r][c] = v; LW[v] = (lw, d)
col_ground = []
for r in range(GY):
    for c in range(GX):
        q = [G[r][c], G[r][c + 1], G[r + 1][c + 1], G[r + 1][c]]
        if min(LW[v][1] for v in q) < 46: col_ground.append([v.co.copy() for v in q])
        if max(LW[v][1] for v in q) < HW - 0.6 or all(RX0 + 1 < v.co.x < RX1 - 1 and HW + 1 < v.co.y < RY1 - 1 for v in q): continue     # under the road / runway
        f = bm.faces.new(q); f.material_index = 0
        for l in f.loops:
            co = l.vert.co; w = LW[l.vert][0]
            t = 0.88 + 0.14 * fbm(co.x / 60, co.y / 60, 3) + 0.06 * fbm(co.x / 9, co.y / 9, 2)
            t2 = 0.94 + 0.06 * fbm(co.x / 30, co.y / 30, 2)      # tan desert (x the pale photo: aerial_sand's own mean) to the pale lake bed
            sand, lake = (0.535 * t, 0.42 * t, 0.33 * t), (t2, t2, 0.97 * t2)
            l[vc] = (*(sand[c] + (lake[c] - sand[c]) * w for c in range(3)), 1)
ground = mesh_obj('DL ground', bm, ['sand'], smooth=True)
# the far ring: flat to 2.8 km, then mesas (flat tops, steep sides) and a ridge on the horizon, all inside 8.5 km
CX, CY = (X0 + X1) / 2, (Y0 + Y1) / 2
radii = [700 * (8500 / 700) ** (k / 70) for k in range(71)]; NA = 192
def far_z(x, y, r):
    m = 6 * fbm(x / 1700 + 11, y / 1700, 3) * ss(1500, 3000, r)      # low dunes: the photographed range (backdrop arcs) is the relief
    ridge = 0.0
    inside = min(x - X0, X1 - x, y - Y0, Y1 - y)          # under the near ground the ring dives out of sight
    return -0.9 + max(0.0, m) + ridge - 19 * ss(100, 140, inside)
bm = bmesh.new(); vc = vcol_layer(bm)
ring = [[bm.verts.new((CX + r * math.cos(a), CY + r * math.sin(a), 0)) for a in (2 * math.pi * k / NA for k in range(NA))] for r in radii]
for rr, row in zip(radii, ring):
    for v in row: v.co.z = far_z(v.co.x, v.co.y, rr)
for k in range(len(radii) - 1):
    for a in range(NA):
        q = [ring[k][a], ring[k + 1][a], ring[k + 1][(a + 1) % NA], ring[k][(a + 1) % NA]]
        f = bm.faces.new(q); f.material_index = 0
        for l in f.loops:
            z = l.vert.co.z; band = 0.5 + 0.5 * math.sin(z / 7.0 + fbm(l.vert.co.x / 500, l.vert.co.y / 500, 2) * 2)
            sand = (0.3, 0.22, 0.16); rock = (0.36, 0.2, 0.13) if band > 0.5 else (0.42, 0.25, 0.16)     # the near ground's mean: aerial_sand x its vertex tone
            lw = lake_w(l.vert.co.x, l.vert.co.y, 999) * (1 - ss(2200, 3200, math.hypot(l.vert.co.x - CX, l.vert.co.y - CY)))
            sand = tuple(sand[c] + ((0.56, 0.53, 0.46)[c] - sand[c]) * lw for c in range(3))
            t = ss(4, 30, z); l[vc] = (*(sand[c] + (rock[c] - sand[c]) * t for c in range(3)), 1)
far = mesh_obj('DL far terrain', bm, ['far'], smooth=True, planar=False)
# the distant range (make_backdrop.py: 55 degrees of the goegap photo, sky cut to alpha, ends faded) on five arcs 6.5 km out at 0.45 of its
# angular size (the photo was taken a few km from the range; 25 degrees wide, peaks at ~3.5 degrees), alternate ones mirrored; the day arc 2 m inside the dusk one (tracks.js dayNight fades it out by dusk). Emissive at 1 / the look's
# emissive level (main.js LOOKS day 0.2, dusk 0.5), so the photo shows at its own exposure; fog off (main.js: 'Backdrop |')
def backdrop(name, png, gain, r):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / png)
    P.inputs['Base Color'].default_value = (0, 0, 0, 1); P.inputs['Roughness'].default_value = 1
    nt.links.new(it.outputs['Color'], P.inputs['Emission Color']); P.inputs['Emission Strength'].default_value = gain
    nt.links.new(it.outputs['Alpha'], P.inputs['Alpha'])
    try: m.surface_render_method = 'BLENDED'
    except AttributeError: m.blend_method = 'BLEND'
    b = bmesh.new(); uv = b.loops.layers.uv.verify(); SEG, K = 24, 0.45; SPAN = math.radians(55 * K)
    for k_, deg in enumerate((8, 77, 148, 218, 290)):
        mid, flip = math.radians(deg), k_ % 2 == 1
        z0, z1 = 1.5 + r * math.tan(math.radians(-4 * K)), 1.5 + r * math.tan(math.radians(14 * K))
        rows = []
        for q in range(SEG + 1):
            a_ = mid + SPAN / 2 - SPAN * q / SEG      # left to right as seen from the centre
            rows.append([b.verts.new((CX + r * math.cos(a_), CY + r * math.sin(a_), z)) for z in (z0, z1)])
        for q in range(SEG):
            f = b.faces.new([rows[q][0], rows[q + 1][0], rows[q + 1][1], rows[q][1]])
            for l, (uq, vq) in zip(f.loops, ((q, 0), (q + 1, 0), (q + 1, 1), (q, 1))):
                u = uq / SEG; l[uv].uv = (1 - u if flip else u, vq)
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free(); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); VIS.objects.link(ob); return ob
backdrop('Backdrop | goegap dusk', 'backdrop_dusk.png', 2.0, 6502.0)
backdrop('Backdrop | goegap day', 'backdrop_day.png', 5.0, 6500.0)

# ------------------------------------------------------------------------------------------------ 7. venue: hangars, tower, water tower, masts
def gz(x, y): return ground_z(x, y)[0]
def hangar(bm, cx, cy, yaw, W=44, L=60, Hw=7, rise=10):
    """barrel-roofed hangar, door face toward +local x... local: width along y, depth along x, doors on the x = -L/2 face"""
    Mx = Matrix.Translation((cx, cy, gz(cx, cy) - 0.2)) @ Matrix.Rotation(yaw, 4, 'Z'); n = 16
    prof = [(-W / 2, 0)] + [(W / 2 * -math.cos(math.pi * k / n), Hw + rise * math.sin(math.pi * k / n)) for k in range(n + 1)] + [(W / 2, 0)]
    rows = [[Mx @ Vector((x, w, z)) for w, z in prof] for x in (-L / 2, L / 2)]
    V = [[bm.verts.new(p) for p in r] for r in rows]
    for k in range(len(prof) - 1):
        f = bm.faces.new([V[0][k], V[1][k], V[1][k + 1], V[0][k + 1]]); f.material_index = 1 if 0 < k < len(prof) - 2 else 0
    for e, sgn in ((0, 1), (1, -1)):
        f = bm.faces.new(V[e][::sgn] if sgn > 0 else V[e][::-1]); f.material_index = 0
    dw, dh = W * 0.78, Hw + 2.5      # the door: a panel just proud of the front face
    d = [Mx @ Vector((-L / 2 - 0.15, w, z)) for w, z in ((-dw / 2, 0.2), (dw / 2, 0.2), (dw / 2, dh), (-dw / 2, dh))]
    f = bm.faces.new([bm.verts.new(p) for p in d][::-1]); f.material_index = 0
def box(bm, c, size, yaw=0.0, mi=0):
    Mx = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z'); sx, sy, sz = (s / 2 for s in size)
    v = [bm.verts.new(Mx @ Vector((x * sx, y * sy, z * sz))) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        f = bm.faces.new([v[k] for k in q]); f.material_index = mi
def cyl(bm, c, r0, r1, h, n=12, mi=0, cap=True):
    a = [bm.verts.new(c + Vector((r0 * math.cos(2 * math.pi * k / n), r0 * math.sin(2 * math.pi * k / n), 0))) for k in range(n)]
    b = [bm.verts.new(c + Vector((r1 * math.cos(2 * math.pi * k / n), r1 * math.sin(2 * math.pi * k / n), h))) for k in range(n)]
    for k in range(n): f = bm.faces.new([a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]]); f.material_index = mi
    if cap: f = bm.faces.new(b); f.material_index = mi
    return b
def clear_of_track(pts, margin): return all(near(p.x, p.y)[1] > margin for p in pts)
bm = bmesh.new()
SITES = []      # (x, y, radius): kept clear of the boneyard and the dressing
# two hangars and the tower north of the runway by the start, facing it; four along the back straight, facing it
x_start = 0.0
for k, x in enumerate((x_start - 150, x_start - 85)):
    hangar(bm, x, RY1 + 50, math.pi / 2); SITES.append((x, RY1 + 50, 45))     # doors (local -x) face the runway
TX, TY = x_start + 40, RY1 + 32
box(bm, Vector((TX, TY, 9)), (7, 7, 18), mi=2); box(bm, Vector((TX, TY, 20.2)), (9.5, 9.5, 4.4), mi=3); box(bm, Vector((TX, TY, 22.6)), (10.5, 10.5, 0.5), mi=2)
SITES.append((TX, TY, 20))
back = [i for i in range(N) if abs(abs(HEAD[i]) - math.pi) < 0.12 and CL[i].y < min(ys) + 70]
if back:
    bi = back[len(back) // 2]; side = -1 if NL[bi].y > 0 else 1      # the outside of the back straight is south (away from the infield)
    for k in range(4):
        j = (bi + (k - 1.5) * 26) % N; j = int(j); p = CL[j] + NL[j] * side * (BD[-1 if side < 0 else 1][j] + 52)
        hangar(bm, p.x, p.y, math.atan2(NL[j].y * side, NL[j].x * side)); SITES.append((p.x, p.y, 45))     # doors toward the track
hangars = mesh_obj('DL buildings', bm, ['hwall', 'hroof', 'concrete', 'glass'])
# the water tower at the centre of the long T4 left
t4 = max((i for i in range(N) if K[i] > 0), key=lambda i: (RW[i] < 60) * sum(K[(i + d) % N] for d in range(-20, 21)))
c4 = CL[t4] + NL[t4] * R[t4]; WX, WY = c4.x, c4.y; SITES.append((WX, WY, 25))
bm = bmesh.new(); g = gz(WX, WY)
for a in range(4):
    th = math.pi / 4 + a * math.pi / 2; base = Vector((WX + 5.5 * math.cos(th), WY + 5.5 * math.sin(th), g - 0.3))
    cyl(bm, base, 0.35, 0.3, 25, n=6, mi=0, cap=False)
for z in (8, 16):
    box(bm, Vector((WX, WY, g + z)), (8.2, 0.25, 0.25), mi=0); box(bm, Vector((WX, WY, g + z)), (0.25, 8.2, 0.25), mi=0)
top = cyl(bm, Vector((WX, WY, g + 24.5)), 6.2, 6.2, 7.5, n=24, mi=1, cap=False)
apex = bm.verts.new((WX, WY, g + 35))
for k in range(24): f = bm.faces.new([top[k], top[(k + 1) % 24], apex]); f.material_index = 1
wtower = mesh_obj('DL water tower', bm, ['steel', 'tank'], planar=False)
log('hangars', len([s for s in SITES if s[2] == 45]))

# ------------------------------------------------------------------------------------------------ 8. the boneyard
bpy.ops.import_scene.gltf(filepath=str(H / 'source' / 'a320_kyaie' / 'a320.glb'))
parts = [o for o in bpy.context.selected_objects if o.type == 'MESH']
bpy.context.view_layer.update()
raw = (H / 'source' / 'a320_kyaie' / 'a320.glb').read_bytes(); GJ = json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])
DARK = {m['name'] for m in GJ['materials'] if max(m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1])[:3]) < 0.3}     # windows, tyres, intakes
PLANE = {'skin': bmesh.new(), 'dark': bmesh.new()}; ENG = {'skin': [], 'dark': []}
pts = []
for o in parts:
    for v in o.data.vertices: pts.append(o.matrix_world @ v.co)
lo = Vector([min(p[d] for p in pts) for d in range(3)]); hi = Vector([max(p[d] for p in pts) for d in range(3)])
ax = 0 if hi.x - lo.x > hi.y - lo.y else 1; length = (hi - lo)[ax]; S = 37.57 / length
tallest = max(pts, key=lambda p: p.z); mid = (lo + hi) / 2
nose_sign = -1 if tallest[ax] > mid[ax] else 1            # the fin is aft: the nose points away from it
def to_plane(p):
    q = (p - Vector((mid.x, mid.y, lo.z))) * S
    x, y = (q.x, q.y) if ax == 0 else (q.y, -q.x)
    return Vector((x * nose_sign, y * nose_sign, q.z))
for o in parts:
    dark = any(m and (m.name in DARK or m.name.rsplit('.', 1)[0] in DARK) for m in o.data.materials)
    key = 'dark' if dark else 'skin'; eng = o.name.startswith(('Cylinder.013', 'Cylinder.007'))
    b = bmesh.new(); b.from_mesh(o.data); b.transform(o.matrix_world)
    for v in b.verts: v.co = to_plane(v.co)
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free()
    if eng: ENG[key].append(me)
    else: PLANE[key].from_mesh(me)
for o in parts: bpy.data.objects.remove(o, do_unlink=True)
for o in list(bpy.data.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
pp = [v.co for b in PLANE.values() for v in b.verts]
SPAN = max(abs(p.y) for p in pp); WING_Z = max(p.z for p in pp if abs(p.y) > SPAN * 0.9)
log('A320: span', round(2 * SPAN, 1), 'm, wingtip at', round(WING_Z, 2), 'm, scale', round(S, 3), 'nose', nose_sign)
TINTS = [(0.93, 0.93, 0.91), (0.74, 0.76, 0.78), (0.6, 0.65, 0.44), (0.86, 0.82, 0.71), (0.9, 0.9, 0.88), (0.7, 0.72, 0.74)]
TAILS = [None, (0.42, 0.5, 0.62), (0.66, 0.38, 0.32), None, (0.5, 0.56, 0.42), None]
OUTB = {'skin': bmesh.new(), 'dark': bmesh.new()}
def place_plane(x, y, yaw, k):
    g = gz(x, y) - 0.05; Mx = Matrix.Translation((x, y, g)) @ Matrix.Rotation(yaw, 4, 'Z')
    tint, tail = TINTS[k % len(TINTS)], TAILS[(k * 5) % len(TAILS)]; engines = k % 5 not in (1, 3); Mi = Mx.inverted()
    for key in ('skin', 'dark'):
        b = PLANE[key].copy()
        if engines:
            for me in ENG[key]: b.from_mesh(me)
        b.transform(Mx); vc = vcol_layer(b)
        for f in b.faces:
            for l in f.loops:
                c = l.vert.co; local = Mi @ c
                col = tail if (tail and local.z > 6.5 and local.x < -10) else tint     # the fin, aft (the nose is +x)
                n = 0.94 + 0.08 * fbm(c.x / 6, c.y / 6 + k, 2); l[vc] = (col[0] * n, col[1] * n, col[2] * n, 1)
        me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free(); OUTB[key].from_mesh(me); bpy.data.meshes.remove(me)
def footprint(x, y, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return [Vector((x + c * a - s * b, y + s * a + c * b, 0)) for a, b in ((19, 0), (-19, 0), (0, SPAN), (0, -SPAN), (-15, 7), (-15, -7))]
PLACED = []
def free_spot(x, y, yaw, margin, skip=None):
    fp = footprint(x, y, yaw)
    if skip is None and not clear_of_track(fp, margin): return False
    if skip is not None:
        for p in fp:
            i, d = near(p.x, p.y)
            if abs(((i - skip + N // 2) % N) - N // 2) * STEP > 70 and d < margin: return False
    if any((Vector((x, y)) - Vector((sx, sy))).length < r + 22 for sx, sy, r in SITES): return False
    if any((Vector((x, y)) - Vector((px, py))).length < 40 for px, py in PLACED): return False
    return lake_w(x, y, near(x, y)[1]) < 0.3
k = 0
# T2-T3: parallel to the track, wingtips over its edge
chic = int(SRC['corners'][1]['at'] / STEP)        # T2 of the concept (scripts/sketch-layouts.mjs), the same curve and start
for sd in (1, -1):
    i = (chic - 20) % N
    for n in range(3):
        j = (i + 6 + n * 17) % N; lat = sd * (max(BD[sd][j], 15.5) + 7.6); p = off(j, lat); yaw = HEAD[j] + (math.pi if (n + k) % 2 else 0)
        if free_spot(p.x, p.y, yaw, 17.5, skip=j): place_plane(p.x, p.y, yaw, k); PLACED.append((p.x, p.y)); k += 1
# the field: rows at 25 degrees in the infield and south of the hangar line
rows_yaw = math.radians(25); c, s = math.cos(rows_yaw), math.sin(rows_yaw)
cand = []
for a in range(-14, 15):
    for b in range(-10, 11):
        x = (min(xs) + max(xs)) / 2 + c * a * 48 - s * b * 52; y = (min(ys) + max(ys)) / 2 + s * a * 48 + c * b * 52
        cand.append((near(x, y)[1], x, y))
for d, x, y in sorted(cand):
    if k >= 9: break
    if d < 40 or y > RY0 - 30: continue
    if free_spot(x, y, rows_yaw, 26): place_plane(x, y, rows_yaw, k); PLACED.append((x, y)); k += 1
# the T1 hairpin: one parked beyond its outside, tail to the track
t1 = min(range(N // 3), key=lambda i: R[i])
p = off(t1, -math.copysign(1, K[t1]) * (BD[-1 if K[t1] > 0 else 1][t1] + 26)); out = (p - CL[t1]).to_2d().normalized()
yaw = math.atan2(out.y, out.x)       # the nose points away from the track
if free_spot(p.x, p.y, yaw, 18, skip=t1): place_plane(p.x, p.y, yaw, k); PLACED.append((p.x, p.y)); k += 1
for b in list(PLANE.values()): b.free()
bm = OUTB['skin']; bm2 = OUTB['dark']
for f in bm2.faces: f.material_index = 1
me = bpy.data.meshes.new('tmp'); bm2.to_mesh(me); bm2.free(); bm.from_mesh(me); bpy.data.meshes.remove(me)
for f in bm.faces: f.smooth = True
fleet = bpy.data.meshes.new('DL boneyard'); bm.to_mesh(fleet); bm.free(); fleet.materials.append(MAT['skin']); fleet.materials.append(MAT['dark'])
fob = bpy.data.objects.new('DL boneyard', fleet); VIS.objects.link(fob)
log('airliners', k, 'triangles', sum(len(p.vertices) - 2 for p in fleet.polygons))

# ------------------------------------------------------------------------------------------------ 9. dressing: rocks and creosote scrub
def blob(bm, c, size, squash, seed, colour, vc, sub=1):
    r = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    for v in r['verts']:
        n = noise.noise(v.co * 1.7 + Vector((seed, seed * 0.3, 0)))
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2] * squash)) * (1 + 0.28 * n) + c
    for f in {f for v in r['verts'] for f in v.link_faces}:
        for l in f.loops: t = 0.9 + 0.2 * RNG.random(); l[vc] = (colour[0] * t, colour[1] * t, colour[2] * t, 1)
rk = bmesh.new(); vr = vcol_layer(rk); sb = bmesh.new(); vs = vcol_layer(sb); nr = ns = 0
for _ in range(9000):
    x, y = RNG.uniform(X0 + 100, X1 - 100), RNG.uniform(Y0 + 100, Y1 - 100); i, d = near(x, y)
    if d < 26 or lake_w(x, y, d) > 0.2: continue
    if any((Vector((x, y)) - Vector((sx, sy))).length < r + 8 for sx, sy, r in SITES) or any((Vector((x, y)) - Vector((px, py))).length < 24 for px, py in PLACED): continue
    if RNG.random() < 0.3 and nr < 520:
        sz = RNG.uniform(0.5, 2.4) * (1 + 1.5 * (RNG.random() < 0.08))
        blob(rk, Vector((x, y, gz(x, y) - sz * 0.25)), (sz * RNG.uniform(0.8, 1.4), sz * RNG.uniform(0.8, 1.3), sz), 0.7, RNG.random() * 50,
             (0.52, 0.4, 0.31) if RNG.random() < 0.6 else (0.45, 0.4, 0.36), vr); nr += 1
    elif ns < 1000:
        sz = RNG.uniform(0.45, 1.1)
        blob(sb, Vector((x, y, gz(x, y) + sz * 0.35)), (sz, sz * RNG.uniform(0.8, 1.2), sz), 0.75, RNG.random() * 50,
             (0.3, 0.33, 0.2) if RNG.random() < 0.7 else (0.42, 0.4, 0.26), vs); ns += 1
for b in (rk, sb):
    for f in b.faces: f.smooth = True
rocks = mesh_obj('DL rocks', rk, ['rock'], planar=False); scrub = mesh_obj('DL scrub', sb, ['scrub'], planar=False)
log('rocks', nr, 'scrub', ns)

# ------------------------------------------------------------------------------------------------ 10. collision
def col_obj(name, faces):
    b = bmesh.new()
    for q in faces: b.faces.new([b.verts.new(p) for p in q])
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free(); ob = bpy.data.objects.new(name, me); COL.objects.link(ob); return ob
col_obj('col_asphalt', [[off(i, -HW), off((i + 1) % N, -HW), off((i + 1) % N, HW), off(i, HW)] for i in range(N)])
col_obj('col_curb', [[off(i, sd * HW), off((i + 1) % N, sd * HW), off((i + 1) % N, sd * (HW + 1.4), 0.05), off(i, sd * (HW + 1.4), 0.05)][::sd]
                     for sd in (1, -1) for i in range(N) if CORNER[i] and CORNER[(i + 1) % N]])
col_obj('col_paved', PAVED)
col_obj('col_grass', col_ground)
col_obj('col_wall', [[off(i, sd * BD[sd][i], -0.4), off((i + 1) % N, sd * BD[sd][(i + 1) % N], -0.4), off((i + 1) % N, sd * BD[sd][(i + 1) % N], 1.2),
                      off(i, sd * BD[sd][i], 1.2)][::-sd] for sd in (1, -1) for i in range(N)])
for o in COL.objects: log('collision', o.name, len(o.data.polygons))

# ------------------------------------------------------------------------------------------------ 11. track.json
def to_game(v): return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]
yaw_of = lambda h: round(math.atan2(math.cos(h), -math.sin(h)), 4)
slope = [round((CL[(i + 1) % N].z - CL[i - 1].z) / (2 * STEP), 4) for i in range(N)]
kk = int(60 / STEP); turn = [((HEAD[(i + kk) % N] - HEAD[i - kk] + math.pi) % (2 * math.pi) - math.pi) for i in range(N)]
corners, i = [], 0
while i < N:
    if abs(turn[i]) > math.radians(28):
        j = i
        while j < N and abs(turn[j]) > math.radians(28): j += 1
        apex = max(range(i, j), key=lambda q: abs(turn[q])); a_ = round(math.degrees(abs(turn[apex])), 1)
        corners.append(dict(id=f'T{len(corners) + 1}', name=f'Turn {len(corners) + 1}', radius=round(R[apex]), angle=a_, apexIdx=apex, boards=[]))
        i = j + kk // 2
    else: i += 1
slots = [dict(slot=k + 1, centerlineIdx=i, pos=to_game(off(i, lat)), headingYawRad=yaw_of(HEAD[i])) for k, (i, lat) in enumerate(SLOTS)]
track = {
    'name': 'Mojave Dry Lake', 'units': 'metres; game coords: Y up (absolute), x east, -z north; origin = start/finish line centre; start heading +X',
    'direction': 'waypoint order of track-viewer/docs/career-worlds/drylake.json', 'lapLength': round(LAP, 1),
    'credits': ['Textures: Poly Haven (CC0); Airbus A320 Airliner by Kyaie (CC BY 4.0, Sketchfab); see tracks/drylake/CREDITS.md'],
    'spacing': round(STEP, 3), 'centerline': [to_game(p) for p in CL], 'halfWidth': [HW] * N, 'racingLine': [0.0] * N, 'slope': slope,
    'banking': [0.0] * N, 'headingYawRad': [yaw_of(h) for h in HEAD], 'sectors': [0, N // 3, 2 * N // 3], 'checkpoints': list(range(0, N, 25)),
    'corners': corners, 'start': {'pos': to_game(CL[0]), 'headingYawRad': yaw_of(HEAD[0]), 'gridSlots': slots}, 'pitLane': None, 'zones': [],
    'weather': {'default': 'day', 'looks': ['day', 'dusk']},
    'landmarks': [{'name': 'Water tower', 'pos': to_game(Vector((WX, WY, gz(WX, WY) + 30)))}],
    'surfaces': {'asphalt': ['col_asphalt'], 'curb': ['col_curb'], 'grass': ['col_grass'], 'paved': ['col_paved'], 'wall': ['col_wall']},
    'capabilities': {'pit': False, 'vip': False, 'hoardings': False, 'driverHoardings': False},
    'collision': 'drylake_collision.glb', 'visual': ['drylake_visual.glb'],
}
(OUT / 'track.json').write_text(json.dumps(track, separators=(',', ':')), encoding='utf8')
log('track', round(LAP, 1), 'm,', len(corners), 'corners')

# ------------------------------------------------------------------------------------------------ 12. save, export
n_deg = 0
for o in VIS.objects:
    b = bmesh.new(); b.from_mesh(o.data); bad = [f for f in b.faces if f.calc_area() < 1e-8]
    if bad: n_deg += len(bad); bmesh.ops.delete(b, geom=bad, context='FACES'); b.to_mesh(o.data)
    b.free()
log('degenerate faces removed', n_deg)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'drylake.blend'))
if EXPORT:
    vl = bpy.context.view_layer
    def export(path, objs, **kw):
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        vl.objects.active = objs[0]
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, **kw)
    export(OUT / 'drylake_visual.glb', list(VIS.objects))
    export(OUT / 'drylake_collision.glb', list(COL.objects), export_materials='NONE', export_texcoords=False, export_normals=False)
tri = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in VIS.objects}
log('triangles', sum(tri.values()), json.dumps(tri))
log('done')
