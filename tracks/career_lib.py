"""Shared build code for the career's new tracks (docs/career-worlds.md), exec'd by tracks/<id>/build_<id>.py after it sets
    H (its folder), ID (the track id, the concept centreline's name in track-viewer/docs/career-worlds/<ID>.json), PFX (material prefix)
It builds in the game frame (start line at the origin, start heading +X, Z up; the glTF export turns it to Y up) and gives:
    CL, N, STEP, LAP, T, NL, HEAD, K, R, RW, near(), off()     the centreline (centripetal Catmull-Rom, ~2.5 m stations) and its frame
    material(), image(), mesh_obj(), strip(), vcol_layer(), bar(), box(), cyl()     materials and mesh helpers
    road(), barriers(), collision(), write_track(), export()                           the pieces every track has
shortcut: tracks/drylake/build_drylake.py still carries its own copy of these (written first); move it onto this file on its next rebuild."""
import bpy, bmesh, json, math, random, struct, sys
from pathlib import Path
from mathutils import Vector, Matrix, noise
from mathutils.kdtree import KDTree

ROOT = H.resolve().parents[1]; OUT = H / 'out'; OUT.mkdir(exist_ok=True); PH = ROOT / 'assets' / 'polyhaven'
SRC = json.loads((ROOT / 'track-viewer' / 'docs' / 'career-worlds' / f"{globals().get('SRC_ID', ID)}.json").read_text(encoding='utf8'))     # SRC_ID: a concept variant
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
EXPORT = '--no-export' not in ARGS
RNG = random.Random(17)
def log(*a): print(f'[{ID}]', *a, flush=True)
def ss(a, b, x): t = min(1.0, max(0.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def fbm(x, y, oct=4):
    s, a, f = 0.0, 1.0, 1.0
    for _ in range(oct): s += a * noise.noise(Vector((x * f, y * f, 0.37 * f))); a *= 0.5; f *= 2.03
    return s
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene
VIS = bpy.data.collections.new('visual'); COL = bpy.data.collections.new('collision')
sc.collection.children.link(VIS); sc.collection.children.link(COL)

# ------------------------------------------------------------------------------------------------ centreline
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

# ------------------------------------------------------------------------------------------------ materials and mesh helpers
def image(path, data=False):
    im = bpy.data.images.load(str(path), check_existing=True)
    if data: im.colorspace_settings.name = 'Non-Color'
    return im
def material(name, base=(0.8, 0.8, 0.8), rough=0.8, metal=0.0, tex=None, vcol=False, emit=None, diff=None):
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
MAT, UVS = {}, {}         # the build fills these: key -> material, key -> metres per texture repeat
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
def bar(bm, i, lat0, lat1, ds0, ds1, mi=0, dz=0.03):      # a painted rectangle on the road: lateral lat0..lat1, ds0..ds1 m along station i
    p = [CL[i] + NL[i] * l + T[i].to_3d() * d for d, l in ((ds0, lat0), (ds1, lat0), (ds1, lat1), (ds0, lat1))]
    f = bm.faces.new([bm.verts.new((q.x, q.y, CL[i].z + dz)) for q in p]); f.material_index = mi
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

# ------------------------------------------------------------------------------------------------ road, barriers, collision
HW = 8.0
def road(hw, kerb_radius):
    """asphalt with skirts, white edge lines, the start line and 8 grid marks, red / white kerbs through corners tighter than kerb_radius"""
    global HW, SLOTS, CORNER
    HW = hw
    bm = bmesh.new()
    strip(bm, [[off(i, l) for l in (-HW, -HW / 2, 0, HW / 2, HW)] for i in range(N)], 0)
    for sd in (1, -1): strip(bm, [[off(i, sd * HW), off(i, sd * HW, -0.4)] for i in range(N)], 0, rev=sd < 0)
    mesh_obj(f'{PFX} road', bm, ['asphalt'], smooth=True)
    bm = bmesh.new()
    for sd in (1, -1): strip(bm, [[off(i, sd * (HW - 0.65), 0.03), off(i, sd * (HW - 0.35), 0.03)] for i in range(N)], 0, rev=sd < 0)
    bar(bm, 0, -HW + 0.4, HW - 0.4, -0.3, 0.3)
    SLOTS = []
    for k in range(8):
        s = (LAP - (8 + 8 * k)) % LAP; i = int(s / STEP); lat = 3.0 if k % 2 == 0 else -3.0
        SLOTS.append((i, lat))
        bar(bm, i, lat - 1.2, lat + 1.2, 2.2, 2.45); bar(bm, i, lat - 1.2, lat - 1.05, 0.6, 2.45); bar(bm, i, lat + 1.05, lat + 1.2, 0.6, 2.45)
    mesh_obj(f'{PFX} lines', bm, ['line'])
    CORNER = [any(R[(i + d) % N] < kerb_radius for d in range(-8, 9)) for i in range(N)]
    bm = bmesh.new()
    for sd in (1, -1):
        for i in range(N):
            if not (CORNER[i] and CORNER[(i + 1) % N]): continue
            rows = [[off(j, sd * HW, -0.005), off(j, sd * (HW + 0.7), 0.05), off(j, sd * (HW + 1.4), 0.05), off(j, sd * (HW + 1.4), -0.4)] for j in (i, (i + 1) % N)]
            vs = [[bm.verts.new(p) for p in r] for r in rows]
            for k in range(3):
                q = [vs[0][k], vs[1][k], vs[1][k + 1], vs[0][k + 1]]
                f = bm.faces.new(q if sd > 0 else q[::-1]); f.material_index = i % 2
    if bm.faces: mesh_obj(f'{PFX} kerbs', bm, ['kerb_r', 'kerb_w'])
    else: bm.free()
PROF = [(0, 0), (0.05, 0.075), (0.2, 0.33), (0.225, 0.81), (0.375, 0.81), (0.4, 0.33), (0.55, 0.075), (0.6, 0)]     # jersey barrier
def barriers(base, prof=PROF, height=1.2):
    """walls `base` m out on both sides (a number, or a function of the station), closer on the inside of tight corners so the offset
    never folds; BD[side][station]"""
    global BD
    def offsets(sd):
        D = []
        for i in range(N):
            inside = (K[i] > 0) == (sd > 0) and RW[i] < 60
            b0 = base(i) if callable(base) else base
            D.append(min(b0, max(min(b0, HW + 2.6), 0.62 * RW[i])) if inside else b0)
        for _ in range(4): D = [sum(D[(i + d) % N] for d in range(-6, 7)) / 13 for i in range(N)]
        return D
    BD = {1: offsets(1), -1: offsets(-1)}
    bm = bmesh.new()
    for sd in (1, -1): strip(bm, [[off(i, sd * (BD[sd][i] + u), v - 0.05) for u, v in prof] for i in range(N)], 0, rev=sd < 0)
    ob = mesh_obj(f'{PFX} barriers', bm, ['barrier'], planar=False)
    b2 = bmesh.new(); b2.from_mesh(ob.data); uv = b2.loops.layers.uv.verify()       # UVs along the wall: 2 m repeats
    for f in b2.faces:
        for l in f.loops: c = l.vert.co; i, _ = near(c.x, c.y); l[uv].uv = (i * STEP / 2.0, c.z / 2.0 + (c - CL[i]).length / 2.0)
    b2.to_mesh(ob.data); b2.free()
    BD['height'] = height
def col_obj(name, faces):
    b = bmesh.new()
    for q in faces: b.faces.new([b.verts.new(p) for p in q])
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free(); ob = bpy.data.objects.new(name, me); COL.objects.link(ob); return ob
def collision(ground_faces, paved_faces=()):
    col_obj('col_asphalt', [[off(i, -HW), off((i + 1) % N, -HW), off((i + 1) % N, HW), off(i, HW)] for i in range(N)])
    kerbs = [[off(i, sd * HW), off((i + 1) % N, sd * HW), off((i + 1) % N, sd * (HW + 1.4), 0.05), off(i, sd * (HW + 1.4), 0.05)][::sd]
             for sd in (1, -1) for i in range(N) if CORNER[i] and CORNER[(i + 1) % N]]
    if kerbs: col_obj('col_curb', kerbs)
    if paved_faces: col_obj('col_paved', paved_faces)
    col_obj('col_grass', ground_faces)
    h = BD['height']
    col_obj('col_wall', [[off(i, sd * BD[sd][i], -0.4), off((i + 1) % N, sd * BD[sd][(i + 1) % N], -0.4), off((i + 1) % N, sd * BD[sd][(i + 1) % N], h),
                          off(i, sd * BD[sd][i], h)][::-sd] for sd in (1, -1) for i in range(N)])
    for o in COL.objects: log('collision', o.name, len(o.data.polygons))

# ------------------------------------------------------------------------------------------------ track.json, export
def to_game(v): return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]
def write_track(name, credits, looks, default_look, landmarks, extra=None):
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
        'name': name, 'units': 'metres; game coords: Y up (absolute), x east, -z north; origin = start/finish line centre; start heading +X',
        'direction': f"waypoint order of track-viewer/docs/career-worlds/{globals().get('SRC_ID', ID)}.json", 'lapLength': round(LAP, 1), 'credits': credits,
        'spacing': round(STEP, 3), 'centerline': [to_game(p) for p in CL], 'halfWidth': [HW] * N, 'racingLine': [0.0] * N, 'slope': slope,
        'banking': [0.0] * N, 'headingYawRad': [yaw_of(h) for h in HEAD], 'sectors': [0, N // 3, 2 * N // 3], 'checkpoints': list(range(0, N, 25)),
        'corners': corners, 'start': {'pos': to_game(CL[0]), 'headingYawRad': yaw_of(HEAD[0]), 'gridSlots': slots}, 'pitLane': None, 'zones': [],
        'weather': {'default': default_look, 'looks': looks}, 'landmarks': landmarks,
        'surfaces': {'asphalt': ['col_asphalt'], 'curb': ['col_curb'], 'grass': ['col_grass'], 'paved': ['col_paved'], 'wall': ['col_wall']},
        'capabilities': {'pit': False, 'vip': False, 'hoardings': False, 'driverHoardings': False},
        'collision': f'{ID}_collision.glb', 'visual': [f'{ID}_visual.glb'], **(extra or {}),
    }
    (OUT / 'track.json').write_text(json.dumps(track, separators=(',', ':')), encoding='utf8')
    log('track', round(LAP, 1), 'm,', len(corners), 'corners')
def export():
    n_deg = 0
    for o in VIS.objects:
        if o.type != 'MESH': continue
        b = bmesh.new(); b.from_mesh(o.data); bad = [f for f in b.faces if f.calc_area() < 1e-8]
        if bad: n_deg += len(bad); bmesh.ops.delete(b, geom=bad, context='FACES'); b.to_mesh(o.data)
        b.free()
    log('degenerate faces removed', n_deg)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f'{ID}.blend'))
    if EXPORT:
        vl = bpy.context.view_layer
        def gl(path, objs, **kw):
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs: o.select_set(True)
            vl.objects.active = objs[0]
            bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, **kw)
        gl(OUT / f'{ID}_visual.glb', [o for o in VIS.objects if o.type == 'MESH'])
        gl(OUT / f'{ID}_collision.glb', list(COL.objects), export_materials='NONE', export_texcoords=False, export_normals=False)
    tri = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in VIS.objects if o.type == 'MESH'}
    log('triangles', sum(tri.values()), json.dumps(tri))
    log('done')
