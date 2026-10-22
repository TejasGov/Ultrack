"""Tokyo Hiragana circuit: game-ready build (v11), from a copy of the v10 art source.

    powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/game_v11.py       (one Blender process, -b -t 6, low priority)

Reads out/tokyo_japanese_v10.blend (never written) and saves out/tokyo_game_v11.blend, then exports like Marina's build:
out/tokyo_visual.glb, out/tokyo_collision.glb, out/track.json, out/lights.json. Then `node tracks/tokyo/pack-web.mjs`.

What changes against v10 (see README "Game build v11"): foliage -> 4 low-poly instanced trees (+ far cards), 3D text -> one sign
atlas on quads, sponsor boards -> brand_art board quads, far/duplicate frontages -> hills + tree clusters (a few moved closer),
stands -> shells + alpha-cut crowd strips, heavy landmarks decimated, 360 degree skyline band with the Fuji matte in front.
Coordinates: the S/F line is the origin and the start heading is +X (the grid in cars.js assumes it); Z (up) is kept absolute.
"""
import bmesh
import bpy
import json
import math
import random
import re
import shutil
import subprocess
import sys
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

T = Path(__file__).resolve().parent
ROOT = T.parents[1]
O = T / 'out'
SRC, DST = O / 'tokyo_japanese_v10.blend', O / 'tokyo_game_v11.blend'
sys.path.insert(0, str(ROOT / 'tracks' / 'marina'))
import brand_art  # noqa: E402

rnd = random.Random(11)
LOG = {}

# ------------------------------------------------------------------------------------------------ constants
HALF_W = 9.0                      # road half width (18 m)
KEEP_FUJI = False                 # the real panorama already has a faint Fuji; True puts the old matte in front of the band again
PANO_ASPECT = 9.6                 # width : height of the panorama image (see README "Panorama band")
BAND_R = 2800.0                   # band radius, inside the 6000 m grass plane so its foot stands on ground
BAND_H = 2 * math.pi * BAND_R / PANO_ASPECT
HERO_SIGNS = ('romon gate | 浅草門', 'race headquarters | 東京 レース本部', 'neon shrine gateway | 電 光 神 社')
TARGETS = [   # (name fragment, triangle target): landmarks and heavy one-offs
    ('white plaster five tier castle', 20000), ('Asakusa vermilion romon gate', 10000), ('Yasaka lantern hall', 10000),
    ('Akihabara neon shrine gateway', 10000), ('district timber tower', 3000), ('Asakusa stacked timber lantern tower', 6000),
    ('garden temple and arched red bridge', 6000), ('swept entrance gable', 3000), ('lantern hall vermilion seals', 1500),
    ('Rounded portal tower', 7000), ('Suspension system', 20000), ('dual-rim wheel', 14000),
    ('utility poles', 6000), ('Catch fence tension cable', 3500), ('Lantern promenade kit', 6000), ('Avenue ribbed lantern', 6000),
    ('Roppongi topography', 36000), ('Continuous concrete barrier', 24000),
]
DEFAULT_CAP = 6000

# ------------------------------------------------------------------------------------------------ helpers


def log(*a):
    print('[v11]', *a, flush=True)


def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def coll_hidden(ob):
    return ob.hide_render or ob.hide_viewport or all(c.hide_render for c in ob.users_collection)


def mat(name, rgb=None, rough=0.6, emit=None, strength=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    if rgb:
        b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def tex_mat(name, path, rough=0.7, emit_strength=0.0, cutout=False, blend=False, vcol=False):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(str(path), check_existing=True)
    b.inputs['Roughness'].default_value = rough
    if vcol:
        a = nt.nodes.new('ShaderNodeVertexColor')
        a.layer_name = 'Col'
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type, mx.blend_type = 'RGBA', 'MULTIPLY'
        mx.inputs[0].default_value = 1.0
        nt.links.new(t.outputs['Color'], mx.inputs[6])
        nt.links.new(a.outputs['Color'], mx.inputs[7])
        nt.links.new(mx.outputs[2], b.inputs['Base Color'])
        al = nt.nodes.new('ShaderNodeMath')
        al.operation = 'MULTIPLY'
        nt.links.new(t.outputs['Alpha'], al.inputs[0])
        nt.links.new(a.outputs['Alpha'], al.inputs[1])
        nt.links.new(al.outputs[0], b.inputs['Alpha'])
    else:
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
        if cutout:
            r = nt.nodes.new('ShaderNodeMath')
            r.operation = 'ROUND'
            nt.links.new(t.outputs['Alpha'], r.inputs[0])
            nt.links.new(r.outputs[0], b.inputs['Alpha'])
        elif blend:
            nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    if emit_strength:
        nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = emit_strength
    if blend:
        m.surface_render_method = 'BLENDED'
    return m


def bm_to_obj(name, bm, mats, coll, loc=(0, 0, 0)):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    coll.objects.link(ob)
    return ob


def q(bm, pts, mi=0, uvs=None):
    f = bm.faces.new([bm.verts.new(p) for p in pts])
    f.material_index = mi
    if uvs:
        lay = bm.loops.layers.uv.verify()
        for l, uv in zip(f.loops, uvs):
            l[lay].uv = uv
    return f


def tube(bm, a, b, r1, r2, mi, sides=6):
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    u = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    v = d.cross(u)
    ring = lambda c, r: [c + (u * math.cos(2 * math.pi * k / sides) + v * math.sin(2 * math.pi * k / sides)) * r for k in range(sides)]
    ra, rb = ring(a, r1), ring(b, r2)
    for k in range(sides):
        q(bm, [ra[k], ra[(k + 1) % sides], rb[(k + 1) % sides], rb[k]], mi)


def blob(bm, c, r, mi, seed, sq=0.8, sub=1):
    """Lumpy low-poly canopy blob: an icosphere (80 faces) with its vertices pushed around."""
    res = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r, matrix=Matrix.Translation(c))
    rr = random.Random(seed)
    for v in res['verts']:
        v.co = c + (v.co - c) * rr.uniform(0.82, 1.15)
        v.co.z = c.z + (v.co.z - c.z) * sq
    for f in {f for v in res['verts'] for f in v.link_faces}:
        f.material_index = mi
        f.smooth = True


def reduce_mesh(me, target):
    n = tris(me)
    if n <= target:
        return n
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(3), verts=bm.verts[:], edges=bm.edges[:], delimit={'MATERIAL', 'UV'})
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    n = tris(me)
    if n > target:
        tmp = bpy.data.objects.new('_dec', me)
        bpy.context.scene.collection.objects.link(tmp)
        md = tmp.modifiers.new('d', 'DECIMATE')
        md.ratio = max(0.02, target / n)
        md.use_collapse_triangulate = True
        new = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(tmp)
        bm = bmesh.new()
        bm.from_mesh(new)
        me.clear_geometry()
        bm.to_mesh(me)
        bm.free()
        bpy.data.meshes.remove(new)
    return tris(me)


def rect_corners(c, yaw, hx, hy):
    cs, sn = math.cos(yaw), math.sin(yaw)
    return [Vector((c[0] + cs * x - sn * y, c[1] + sn * x + cs * y)) for x, y in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]


def rects_overlap(a, b, margin=0.0):
    for poly in (a, b):
        for i in range(4):
            e = poly[(i + 1) % 4] - poly[i]
            n = Vector((-e.y, e.x)).normalized()
            pa = [n.dot(p) for p in a]
            pb = [n.dot(p) for p in b]
            if max(pa) + margin < min(pb) or max(pb) + margin < min(pa):
                return False
    return True


# ------------------------------------------------------------------------------------------------ 0. copy, clean, align
bpy.ops.wm.open_mainfile(filepath=str(SRC))
bpy.ops.wm.save_as_mainfile(filepath=str(DST))          # from here on only v11 is written
sc = bpy.context.scene
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

pts = json.load(open(O / 'centerline-v10.json'))['points']
start_old = Vector((-188.67, -513.70))
i0 = min(range(len(pts)), key=lambda i: (Vector(pts[i][:2]) - start_old).length)
pts = pts[i0:] + pts[:i0]
N = len(pts)
S0 = Vector(pts[0][:2])
ang = -math.atan2(pts[1][1] - pts[N - 1][1], pts[1][0] - pts[N - 1][0])      # rotate the start heading onto +X
M = Matrix.Rotation(ang, 4, 'Z') @ Matrix.Translation((-S0.x, -S0.y, 0))
CL = []
for p in pts:
    v = M @ Vector((p[0], p[1], 0))
    CL.append((v.x, v.y, p[2]))
log('start index', i0, 'rotation deg', round(math.degrees(ang), 3))
kd = KDTree(N)
for i, p in enumerate(CL):
    kd.insert((p[0], p[1], 0), i)
kd.balance()


def road_dist(x, y):
    _, i, d = kd.find((x, y, 0))
    return d, i


# light positions (v10 preview lights) before the lights are removed
spots = [(o.matrix_world.translation.copy(), o.matrix_world.to_quaternion() @ Vector((0, 0, -1)), o.data.type, tuple(o.data.color), o.data.energy)
         for o in sc.objects if o.type == 'LIGHT' and not coll_hidden(o)]
log('lights in source', len(spots), {t: sum(1 for x in spots if x[2] == t) for t in ('SPOT', 'POINT', 'AREA', 'SUN')})

vis_objs = [o for o in sc.objects if o.type in {'MESH', 'FONT'} and not coll_hidden(o)]
for o in list(sc.objects):
    if o not in vis_objs:
        bpy.data.objects.remove(o, do_unlink=True)
for o in sc.objects:
    if o.parent is None:
        o.matrix_world = M @ o.matrix_world
bpy.context.view_layer.update()
sc.world = None
for w in list(bpy.data.worlds):
    bpy.data.worlds.remove(w)

for c in list(bpy.data.collections):
    bpy.data.collections.remove(c)
bpy.context.view_layer.update()
VIS = bpy.data.collections.new('TokyoVisual')
COL = bpy.data.collections.new('TokyoCollision')
sc.collection.children.link(VIS)
sc.collection.children.link(COL)
for o in vis_objs:
    VIS.objects.link(o)
log('visible source objects', len(vis_objs))
before = {}


def group_of(o):
    n = o.name
    if o.data and o.data.name.startswith('Sakura master'):
        return 'foliage'
    if o.type == 'FONT':
        return 'text'
    if n.startswith('V10 frontage'):
        return 'frontage'
    if n.startswith('V10 08 | curved'):
        return 'stands'
    return 'other'


dg = bpy.context.evaluated_depsgraph_get()


def ev_tris(o):
    e = o.evaluated_get(dg)
    m = e.to_mesh()
    m.calc_loop_triangles()
    n = len(m.loop_triangles)
    e.to_mesh_clear()
    return n


for o in vis_objs:
    g = group_of(o)
    before[g] = before.get(g, 0) + ev_tris(o)
log('before (visible, evaluated)', before, 'total', sum(before.values()))

for o in list(sc.objects):      # the old partial-horizon skyline matte (hard edge, black beyond): replaced by skyline_band
    if o.data and o.data.name.startswith('Tokyo_Skyline'):
        bpy.data.objects.remove(o, do_unlink=True)

# ground sampling (terrain + extended grass plane)
terr = next(o for o in sc.objects if o.name.startswith('Roppongi topography'))
plane = next(o for o in sc.objects if 'extended landscape grass' in o.name)


def bvh_of(objs):
    vs, fs, off = [], [], 0
    for o in objs:
        me = o.data
        vs += [o.matrix_world @ v.co for v in me.vertices]
        for p in me.polygons:
            vv = list(p.vertices)
            for k in range(1, len(vv) - 1):
                fs.append((vv[0] + off, vv[k] + off, vv[k + 1] + off))
        off += len(me.vertices)
    return BVHTree.FromPolygons(vs, fs)


GROUND = bvh_of([terr, plane])


def ground_z(x, y):
    hit = GROUND.ray_cast(Vector((x, y, 400)), Vector((0, 0, -1)), 800)
    return hit[0].z if hit[0] else None


# ------------------------------------------------------------------------------------------------ 1. 3D text: collect
texts, hero, boards = [], [], []
for o in list(sc.objects):
    if o.type != 'FONT':
        continue
    if o.name.startswith('Sponsor board'):
        boards.append(o)
    else:
        texts.append(o)

# ------------------------------------------------------------------------------------------------ 2. frontages
fr = {}
for o in sc.objects:
    m = re.match(r'V10 frontage (\d+) \| (.*)$', o.name)
    if m:
        d = fr.setdefault(m.group(1), {'texts': [], 'sign': None, 'b': None})
        if o.type == 'FONT':
            d['texts'].append(o)
        elif o.name.endswith('projecting sign'):
            d['sign'] = o
        else:
            d['b'] = o
frs = [d for d in fr.values() if d['b']]
for d in frs:
    b = d['b']
    d['dist'], d['st'] = road_dist(b.location.x, b.location.y)
    d['score'] = len(b.data.polygons)
near = sorted([d for d in frs if d['dist'] <= 100], key=lambda d: d['st'])
far = sorted([d for d in frs if d['dist'] > 100], key=lambda d: -d['score'])
drop_near = [d for k, d in enumerate(near) if k % 3 == 2]
keep_near = [d for k, d in enumerate(near) if k % 3 != 2]
log('frontages', len(frs), 'near kept', len(keep_near), 'near dropped', len(drop_near), 'far', len(far))

# orientation of a frontage relative to the road: which local axis runs along it, per side
rel = {1: [], -1: []}
for d in keep_near:
    b = d['b']
    i = d['st']
    t = Vector((CL[(i + 1) % N][0] - CL[i - 1][0], CL[(i + 1) % N][1] - CL[i - 1][1])).normalized()
    nrm = Vector((-t.y, t.x))
    side = 1 if (Vector(b.location.xy) - Vector(CL[i][:2])).dot(nrm) > 0 else -1
    ty = math.atan2(t.y, t.x)
    rel[side].append((b.rotation_euler.z - ty + math.pi) % (2 * math.pi) - math.pi)
REL = {s: (sorted(v)[len(v) // 2] if v else 0.0) for s, v in rel.items()}
log('frontage yaw relative to the road per side (median, count)', {s: (round(REL[s], 3), len(rel[s])) for s in rel})
dimx, dimy = keep_near[0]['b'].dimensions.x, keep_near[0]['b'].dimensions.y
log('frontage footprint', round(dimx, 1), round(dimy, 1))

REG = []      # occupied footprints (corner lists), kept things


def world_rect(o):
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs, ys = [c.x for c in cs], [c.y for c in cs]
    return [Vector((min(xs), min(ys))), Vector((max(xs), min(ys))), Vector((max(xs), max(ys))), Vector((min(xs), max(ys)))]


for d in keep_near:
    b = d['b']
    REG.append(rect_corners(b.location.xy, b.rotation_euler.z, dimx / 2 + 1, dimy / 2 + 1))
for o in sc.objects:
    if o.name.startswith(('V10 0', 'V10 district', 'V10 08', 'V10 HQ', 'V10 garden', 'V10 lantern', 'V10 neon', 'V6 ', 'Gondola', 'Central park wheel', 'Wheel A-frame', '120m')) \
            or 'wheel' in o.name.lower():
        if max(o.dimensions.x, o.dimensions.y) < 400 and o.dimensions.x > 0:
            REG.append(world_rect(o))


def site_ok(c, yaw, hx, hy, min_road=16.0):
    rc = rect_corners(c, yaw, hx, hy)
    for p in rc:
        if road_dist(p.x, p.y)[0] < min_road:
            return False
    if road_dist(c[0], c[1])[0] < min_road + 2:
        return False
    zs = [ground_z(p.x, p.y) for p in rc + [Vector(c)]]
    if any(z is None or z < 0.4 for z in zs) or max(zs) - min(zs) > 2.5:
        return False
    return not any(rects_overlap(rc, r, 3.0) for r in REG)


# gap sites along the road: both sides, every ~45 m, nearest face just outside the barrier/sidewalk
moved = []
sites = []
for i in range(0, N, 12):
    t = Vector((CL[(i + 1) % N][0] - CL[i - 1][0], CL[(i + 1) % N][1] - CL[i - 1][1])).normalized()
    nrm = Vector((-t.y, t.x))
    ty = math.atan2(t.y, t.x)
    for side in (1, -1):
        for off in (31.0, 36.0, 42.0):
            c = Vector(CL[i][:2]) + nrm * side * off
            yaw = ty + REL[side]
            sites.append((i, side, c, yaw))
rnd.shuffle(sites)
for d in far[:12]:
    for k, (i, side, c, yaw) in enumerate(sites):
        if site_ok(c, yaw, dimx / 2 + 1, dimy / 2 + 1) and road_dist(c.x, c.y)[0] < 50:
            REG.append(rect_corners(c, yaw, dimx / 2 + 1, dimy / 2 + 1))
            b = d['b']
            old = b.matrix_world.copy()
            z = ground_z(c.x, c.y)
            new = Matrix.Translation((c.x, c.y, z)) @ Matrix.Rotation(yaw, 4, 'Z')
            delta = new @ Matrix.Rotation(b.rotation_euler.z, 4, 'Z').inverted() @ Matrix.Translation(-b.location).__class__.Identity(4)
            delta = Matrix.Translation(new.translation) @ Matrix.Rotation(yaw - b.rotation_euler.z, 4, 'Z') @ Matrix.Translation(-b.location)
            for o in [d['b'], d['sign']] + d['texts']:
                if o:
                    o.matrix_world = delta @ o.matrix_world
            moved.append(d)
            del sites[k]
            break
far_left = [d for d in far if d not in moved]
log('frontages moved closer', len(moved), 'removed far', len(far_left))
removed = drop_near + far_left
removed_sites = [(d['b'].location.x, d['b'].location.y, d['dist']) for d in removed]
for d in removed:
    for o in [d['b'], d['sign']] + d['texts']:
        if o:
            if o in texts:
                texts.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
kept_fr = keep_near + moved
for d in kept_fr:
    reduce_mesh(d['b'].data, 1300)
    if d['sign']:
        reduce_mesh(d['sign'].data, 60)

# ------------------------------------------------------------------------------------------------ 3. stands
concrete, glass_m = bpy.data.materials['Concrete | mineral'], bpy.data.materials['V10 glass']
white_m, cedar_m = bpy.data.materials['V10 white'], bpy.data.materials.get('V10 cedar') or mat('V10 cedar', (0.45, 0.25, 0.12))
warm_m, ink_m = bpy.data.materials['V10 warm'], bpy.data.materials['V10 ink']
for f in ('crowd_row.png', 'crowd_phones.png'):
    (O / 'textures').mkdir(exist_ok=True)
    if not (O / 'textures' / f).exists():
        shutil.copy(ROOT / 'tracks' / 'marina' / 'out' / 'textures' / f, O / 'textures' / f)
crowd_m = tex_mat('M_Crowd', O / 'textures' / 'crowd_row.png', rough=0.8, cutout=True)
if not any(n.type == 'TEX_IMAGE' and 'phones' in n.image.name for n in crowd_m.node_tree.nodes):
    ph = crowd_m.node_tree.nodes.new('ShaderNodeTexImage')
    ph.image = bpy.data.images.load(str(O / 'textures' / 'crowd_phones.png'), check_existing=True)
    bs = crowd_m.node_tree.nodes['Principled BSDF']
    crowd_m.node_tree.links.new(ph.outputs['Color'], bs.inputs['Emission Color'])
    bs.inputs['Emission Strength'].default_value = 3.0

STANDS = {'Bayfront cedar grandstand': (300, 32), 'Paddock club terraces': (190, 27), 'Roppongi ridge gallery': (220, 30), 'Shibuya garden stand': (160, 28)}
stand_info = []
for name, (width, depth) in STANDS.items():
    shell = next(o for o in sc.objects if o.name == f'V10 08 | curved {name}')
    aud = next(o for o in sc.objects if o.name == f'V10 08 | curved {name} | spectators and fascia')
    R = width * 1.4
    st = lambda x, y, z: Vector(((R + y) * math.sin(x / R), (R + y) * math.cos(x / R) - R, z))
    segs = max(14, int(width / 9))
    rows = 22
    step = depth / rows
    bm = bmesh.new()
    cb = bmesh.new()
    for tier in range(2):
        base = tier * 12
        for row in range(rows):
            y = -depth / 2 + row * step
            z = base + row * 0.42 + 0.5
            for k in range(segs):
                x, xx = -width / 2 + k * width / segs, -width / 2 + (k + 1) * width / segs
                uv = lambda a, b: [(a / 5, b / 5), ((a + width / segs) / 5, b / 5), ((a + width / segs) / 5, (b + step) / 5), (a / 5, (b + step) / 5)]
                q(bm, [st(x, y, z), st(xx, y, z), st(xx, y + step, z), st(x, y + step, z)], 0, uv(x, y))
                q(bm, [st(x, y, z - 0.42), st(xx, y, z - 0.42), st(xx, y, z), st(x, y, z)], 0, [(x / 5, 0), (xx / 5, 0), (xx / 5, 0.1), (x / 5, 0.1)])
        tile_u = lambda x, ln: (x + width / 2) / ln
        for row in range(rows):
            ln = 7.7 + rnd.uniform(-0.6, 0.6)
            y = -depth / 2 + row * step + 0.62
            z0 = base + row * 0.42 + 0.5
            for k in range(segs):
                x, xx = -width / 2 + k * width / segs, -width / 2 + (k + 1) * width / segs
                q(cb, [st(x, y, z0), st(xx, y, z0), st(xx, y, z0 + 1.05), st(x, y, z0 + 1.05)], 0,
                  [(tile_u(x, ln), 0), (tile_u(xx, ln), 0), (tile_u(xx, ln), 1), (tile_u(x, ln), 1)])
        for k in range(segs):
            x, xx = -width / 2 + k * width / segs, -width / 2 + (k + 1) * width / segs
            y = depth / 2 + 2
            q(bm, [st(x, y, base + 9.8), st(xx, y, base + 9.8), st(xx, y, base + 12), st(x, y, base + 12)], 1)
    for k in range(segs):
        x, xx = -width / 2 + k * width / segs, -width / 2 + (k + 1) * width / segs
        q(bm, [st(x, -depth / 2 - 5, 27), st(xx, -depth / 2 - 5, 27), st(xx, depth / 2 + 7, 30), st(x, depth / 2 + 7, 30)], 2)
        q(bm, [st(x, -depth / 2 - 5, 26.7), st(xx, -depth / 2 - 5, 26.7), st(xx, depth / 2 + 7, 29.7), st(x, depth / 2 + 7, 29.7)], 3)
        tube(bm, st(x, -depth / 2 - 5, 26.7), st(xx, -depth / 2 - 5, 26.7), 0.11, 0.11, 4, 4)
    for x in range(int(-width / 2), int(width / 2) + 1, 12):
        tube(bm, st(x, depth / 2 + 5, 0), st(x, depth / 2 + 5, 30), 0.32, 0.32, 5, 6)
        tube(bm, st(x, depth / 2 + 5, 27), st(x, -depth / 2 - 1, 26.5), 0.2, 0.2, 5, 4)
    for ob_, bm_, mats_ in ((shell, bm, [concrete, glass_m, white_m, cedar_m, warm_m, ink_m]), (aud, cb, [crowd_m])):
        mw = ob_.matrix_world.copy()
        name_ = ob_.name
        bpy.data.objects.remove(ob_, do_unlink=True)
        new = bm_to_obj(name_, bm_, mats_, VIS)
        new.matrix_world = mw
        if mats_ is not None and bm_ is cb:
            pass
    stand_info.append(dict(name=name, mw=mw, width=width, depth=depth, R=R))
    log('stand', name, 'tris', tris(bpy.data.objects[f'V10 08 | curved {name}'].data), 'crowd', tris(bpy.data.objects[f'V10 08 | curved {name} | spectators and fascia'].data))

# ------------------------------------------------------------------------------------------------ 4. other geometry: lamps, drains, decimation
lamp_cols = [o for o in sc.objects if o.name.startswith('Street lamp column')]
lamp_heads = [o for o in sc.objects if o.name.startswith('Lamp diffuser')]
lamp_pts = [o.matrix_world.translation.copy() for o in lamp_cols]
head_xf = [(o.matrix_world.translation.copy(), o.matrix_world.to_euler().z, o.scale.copy()) for o in lamp_heads]
for o in list(sc.objects):
    if o.name.startswith(('Street lamp column', 'Lamp outreach', 'Lamp diffuser', 'Fence upright', 'Start chequer', 'Start gantry upright',
                          'Storm drains', 'V9 barrier sponsor boards', 'Trackside event board')) and o.type == 'MESH':
        if o.name.startswith('Start gantry upright') or o.name.startswith('Trackside event board'):
            continue
        bpy.data.objects.remove(o, do_unlink=True)
# pole + arm head, as GPU instances (shared meshes)
bm = bmesh.new()
tube(bm, (0, 0, 0), (0, 0, 9.0), 0.13, 0.08, 0, 8)
pole_me = bpy.data.meshes.new('lamp_pole')
bm.to_mesh(pole_me)
bm.free()
pole_me.materials.append(mat('M_LampPole', (0.05, 0.055, 0.06), 0.5))
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
head_me = bpy.data.meshes.new('lamp_head')
bm.to_mesh(head_me)
bm.free()
head_me.materials.append(mat('M_LampHead', (1, 0.8, 0.5), 0.4, (1, 0.62, 0.28), 3.0))
for k, p in enumerate(lamp_pts):
    ob = bpy.data.objects.new(f'lamp_pole_{k:03d}', pole_me)
    ob.location = (p.x, p.y, p.z - 4.5)
    VIS.objects.link(ob)
for k, (p, yaw, s) in enumerate(head_xf):
    ob = bpy.data.objects.new(f'lamp_head_{k:03d}', head_me)
    ob.location, ob.rotation_euler, ob.scale = p, (0, 0, yaw), s
    VIS.objects.link(ob)
log('lamps', len(lamp_pts), 'poles', len(head_xf), 'heads')

meshes_done = set()
tris_after_reduce = {}
for o in list(sc.objects):
    if o.type != 'MESH' or o.name.startswith(('lamp_', 'V10 08 | curved')) or o.data in meshes_done or group_of(o) in ('foliage', 'frontage'):
        continue
    if o.data.users > 8:
        continue
    tgt = next((t for frag, t in TARGETS if frag in o.name), DEFAULT_CAP)
    reduce_mesh(o.data, tgt)
    meshes_done.add(o.data)

# ------------------------------------------------------------------------------------------------ 5. signs: atlas quads, hero signs, sponsor boards
cells, cellof = {}, {}
tcol = {}
for o in texts:
    m = o.data.materials[0] if o.data.materials else None
    em = tuple(m.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value[:3]) if m and m.use_nodes else (1, 1, 1)
    base = tuple(m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:3]) if m and m.use_nodes else (1, 1, 1)
    col = em if (em != (1.0, 1.0, 1.0)) else base
    srgb = [int(255 * (c ** (1 / 2.2))) for c in col]
    bb = [Vector(c) for c in o.bound_box]
    x0, x1 = min(v.x for v in bb), max(v.x for v in bb)
    y0, y1 = min(v.y for v in bb), max(v.y for v in bb)
    w, h = max(x1 - x0, 0.05), max(y1 - y0, 0.05)
    key = f"{o.data.body}|{round(w, 1)}|{round(h, 1)}|{srgb}"
    cellof[o.name] = (key, x0, x1, y0, y1)
    cells[key] = dict(key=key, body=o.data.body, color=srgb, w=w, h=h)
(O / 'v11-signs.json').write_text(json.dumps(list(cells.values()), ensure_ascii=False), encoding='utf8')
subprocess.run(['C:/Python314/python.exe', str(T / 'build_sign_atlas.py'), str(O / 'v11-signs.json'),
                str(T / 'textures' / 'tokyo_sign_atlas.png'), str(O / 'v11-sign-atlas.json')], check=True)
atlas = json.load(open(O / 'v11-sign-atlas.json'))
sign_m = tex_mat('M_SignNeonAtlas', T / 'textures' / 'tokyo_sign_atlas.png', rough=0.5, emit_strength=2.5, cutout=True)
bm = bmesh.new()
nsign = 0
for o in list(texts):
    key, x0, x1, y0, y1 = cellof[o.name]
    if any(h_ in o.name for h_ in HERO_SIGNS):
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        reduce_mesh(me, 700)
        ho = bpy.data.objects.new('hero_' + o.name.split('|')[-1].strip(), me)
        ho.matrix_world = o.matrix_world.copy()
        VIS.objects.link(ho)
        hero.append(ho)
        bpy.data.objects.remove(o, do_unlink=True)
        continue
    u0, v0, u1, v1 = atlas[key]
    mw = o.matrix_world
    px, py = (x1 - x0) * 0.02, (y1 - y0) * 0.02
    P = [mw @ Vector(c) for c in ((x0 - px, y0 - py, 0.004), (x1 + px, y0 - py, 0.004), (x1 + px, y1 + py, 0.004), (x0 - px, y1 + py, 0.004))]
    q(bm, P, 0, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    nsign += 1
    bpy.data.objects.remove(o, do_unlink=True)
sign_ob = bm_to_obj('sign_atlas_quads', bm, [sign_m], VIS)
log('signs as atlas quads', nsign, 'hero signs kept', len(hero))

# sponsor boards: brand_art quads, GPU-instanced per brand
brands = [b for b in brand_art.BRANDS if (ROOT / 'assets' / 'sponsors' / 'boards' / f"{b['id']}-6000.png").exists()]
board_me = {b['id']: brand_art.board_mesh('board6x1_' + b['id'], b, 6, 1, False, True) for b in brands}
nb = 0
for k, o in enumerate(boards):
    bb = [Vector(c) for c in o.bound_box]
    cen = o.matrix_world @ Vector(((min(v.x for v in bb) + max(v.x for v in bb)) / 2, (min(v.y for v in bb) + max(v.y for v in bb)) / 2, 0))
    yaw = o.matrix_world.to_euler().z
    br = brands[(k * 5 + k // 3) % len(brands)]
    ob = bpy.data.objects.new(f'board_{k:03d}', board_me[br['id']])
    ob.location = (cen.x, cen.y, cen.z - 0.45)
    ob.rotation_euler = (0, 0, yaw)
    VIS.objects.link(ob)
    bpy.data.objects.remove(o, do_unlink=True)
    nb += 1
log('sponsor boards', nb, 'brands', [b['id'] for b in brands])

# ------------------------------------------------------------------------------------------------ 6. trees
import importlib  # noqa: E402,F401


def tree_mesh(kind, seed):
    bm = bmesh.new()
    bark, c1, c2 = bpy.data.materials['V3 bark'], bpy.data.materials['V3 petal2'], bpy.data.materials['V3 petal']
    leaf, leaf2 = bpy.data.materials['V3 leaf'], bpy.data.materials['V3 leaf2']
    r = random.Random(seed)
    if kind == 'sakura':
        mats = [bark, c1 if seed % 2 else c2]
        tube(bm, (0, 0, 0), (0.1, 0, 3.2), 0.38, 0.22, 0, 6)
        for a in range(3):
            ang_ = a * 2.1 + r.uniform(0, 1)
            tube(bm, (0.1, 0, 3.0), (math.cos(ang_) * 2.4, math.sin(ang_) * 2.4, 5.2), 0.17, 0.09, 0, 4)
        for k in range(5):
            ang_ = k * 1.3 + r.uniform(-0.3, 0.3)
            rr = 0 if k == 0 else r.uniform(2.2, 3.4)
            blob(bm, Vector((math.cos(ang_) * rr, math.sin(ang_) * rr, 4.8 + r.uniform(-0.2, 1.4) + (1.4 if k == 0 else 0))), r.uniform(2.4, 3.3), 1, seed * 10 + k, 0.78, 3 if k < 2 else 2)
    elif kind == 'broadleaf':
        mats = [bark, leaf if seed % 2 else leaf2]
        tube(bm, (0, 0, 0), (0, 0, 3.4), 0.34, 0.2, 0, 6)
        for k in range(6):
            ang_ = k * 1.05 + r.uniform(-0.3, 0.3)
            rr = 0 if k == 0 else r.uniform(2.2, 3.4)
            blob(bm, Vector((math.cos(ang_) * rr, math.sin(ang_) * rr, 5.0 + r.uniform(0, 1.6) + (1.6 if k == 0 else 0))), r.uniform(2.2, 3.0), 1, seed * 10 + k, 0.85, 3 if k < 2 else 2)
    else:   # pine / cedar: stacked skirts
        mats = [bark, leaf]
        tube(bm, (0, 0, 0), (0, 0, 3.0), 0.3, 0.2, 0, 6)
        z = 2.2
        for t in range(8):
            rr = 3.0 * (1 - t / 10)
            hh = 3.4
            a = Vector((0, 0, z + hh))
            ring = [Vector((math.cos(2 * math.pi * s / 12) * rr, math.sin(2 * math.pi * s / 12) * rr, z)) for s in range(12)]
            ring2 = [Vector((math.cos(2 * math.pi * s / 12) * rr * 0.55, math.sin(2 * math.pi * s / 12) * rr * 0.55, z + 0.7)) for s in range(12)]
            for s in range(12):
                q(bm, [ring[s], ring[(s + 1) % 12], ring2[(s + 1) % 12], ring2[s]], 1)
                bm.faces.new([bm.verts.new(ring2[s]), bm.verts.new(ring2[(s + 1) % 12]), bm.verts.new(a)]).material_index = 1
            z += 1.7
    if kind == 'pine':
        for f in bm.faces:
            f.smooth = False
    me = bpy.data.meshes.new(f'tree_{kind}_{seed}')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
    bm.to_mesh(me)
    bm.free()
    for m_ in mats:
        me.materials.append(m_)
    return me


def far_card(h, w, mat_, name):
    bm = bmesh.new()
    q(bm, [(-w / 2, 0, 0), (w / 2, 0, 0), (w / 2, 0, h), (-w / 2, 0, h)], 0, [(0, 0), (1, 0), (1, 1), (0, 1)])
    q(bm, [(0, -w / 2, 0), (0, w / 2, 0), (0, w / 2, h), (0, -w / 2, h)], 0, [(0, 0), (1, 0), (1, 1), (0, 1)])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat_)
    return me


TREES = {'sakura_a': tree_mesh('sakura', 1), 'sakura_b': tree_mesh('sakura', 2), 'pine': tree_mesh('pine', 3), 'broadleaf': tree_mesh('broadleaf', 4)}
TH = {k: max(v.co.z for v in me.vertices) for k, me in TREES.items()}
leaf_tex = {'sakura_a': (0.97, 0.75, 0.79), 'sakura_b': (0.9, 0.5, 0.61), 'pine': (0.05, 0.14, 0.07), 'broadleaf': (0.1, 0.2, 0.07)}
FARS = {k: far_card(TH[k] * 0.8, 9 if k != 'pine' else 6, mat('M_Tree' + k.title().replace('_', '') + 'Far', leaf_tex[k], 0.9), 'far_' + k) for k in TREES}
tree_inst = {k: [] for k in TREES}   # (loc, yaw, scale)
for o in list(sc.objects):
    if o.type == 'MESH' and o.data and o.data.name.startswith('Sakura master'):
        kind = 'pine' if o.name.startswith('Shrine grove') else ('broadleaf' if o.data.name.endswith('2') else ('sakura_a' if o.data.name.endswith('0') else 'sakura_b'))
        h = o.dimensions.z
        s = h / TH[kind] if kind != 'pine' else max(h, 14) / TH[kind]
        tree_inst[kind].append((o.matrix_world.translation.copy(), rnd.uniform(0, 6.28), s))
        bpy.data.objects.remove(o, do_unlink=True)
log('trees from v10', {k: len(v) for k, v in tree_inst.items()})


def add_tree(x, y, kind=None, scale=None):
    z = ground_z(x, y)
    if z is None or z < 0.5:
        return False
    d, _ = road_dist(x, y)
    if d < 17:
        return False
    if any(rects_overlap(rect_corners((x, y), 0, 2, 2), r, 0.5) for r in REG):
        return False
    kind = kind or rnd.choice(['sakura_a', 'sakura_b', 'pine', 'pine', 'broadleaf', 'broadleaf'])
    tree_inst[kind].append((Vector((x, y, z - 0.1)), rnd.uniform(0, 6.28), scale or rnd.uniform(0.8, 1.5) * (0.75 if kind == 'pine' else 1.0)))
    return True


# ------------------------------------------------------------------------------------------------ 7. hills and tree clusters
HILL_MAT = bpy.data.materials['Park meadow.001']


def hill(cx, cy, rx, ry, yaw, height, name):
    rings, spokes = 9, 24
    bm = bmesh.new()
    cs, sn = math.cos(yaw), math.sin(yaw)
    grid = []
    for r_ in range(rings + 1):
        u = r_ / rings
        row = []
        for s in range(spokes):
            a = 2 * math.pi * s / spokes
            lx, ly = math.cos(a) * rx * u, math.sin(a) * ry * u
            x, y = cx + cs * lx - sn * ly, cy + sn * lx + cs * ly
            gz = ground_z(x, y)
            gz = 0.7 if gz is None else gz
            prof = (1 - u) ** 1.6 * (3 - 2 * (1 - u)) if u < 1 else 0
            noise = 0.12 * height * math.sin(3.1 * x / 40) * math.cos(2.7 * y / 37) * (1 - u)
            row.append(bm.verts.new((x, y, gz + height * prof + noise - (0.25 if u >= 1 else 0))))
        grid.append(row)
    lay = bm.loops.layers.uv.verify()
    for r_ in range(rings):
        for s in range(spokes):
            f = bm.faces.new([grid[r_][s], grid[r_][(s + 1) % spokes], grid[r_ + 1][(s + 1) % spokes], grid[r_ + 1][s]])
            for l in f.loops:
                l[lay].uv = (l.vert.co.x / 24, l.vert.co.y / 24)
    for f in bm.faces:
        f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if sum(f.normal.z for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(HILL_MAT)
    ob = bpy.data.objects.new(name, me)
    VIS.objects.link(ob)
    return ob


def circle_free(x, y, r):
    if road_dist(x, y)[0] < r + 32:
        return False
    return not any(rects_overlap(rect_corners((x, y), 0, r, r), reg, 2.0) for reg in REG)


hills = []
cand = [(x, y) for x, y, d in removed_sites if d > 100]
cand += [(Vector(CL[i][:2]) + Vector((-(CL[(i + 1) % N][1] - CL[i - 1][1]), CL[(i + 1) % N][0] - CL[i - 1][0])).normalized() * side * rnd.uniform(90, 230))
         for i in range(0, N, 55) for side in (1, -1) for _ in range(1)]
cand = [(c[0], c[1]) if not isinstance(c, Vector) else (c.x, c.y) for c in cand]
for (x, y) in cand:
    zg = ground_z(x, y)
    if zg is None or zg < 1.0:
        continue
    for r in (60, 48, 36, 26):
        if circle_free(x, y, r):
            hh = rnd.uniform(0.18, 0.3) * r
            hills.append(hill(x, y, r, r * rnd.uniform(0.7, 1.0), rnd.uniform(0, 3.14), hh, f'hill_{len(hills):02d}'))
            REG.append(rect_corners((x, y), 0, r, r))
            n_t = int(r * r / 150)
            for _ in range(n_t):
                a, rr = rnd.uniform(0, 6.28), math.sqrt(rnd.random()) * r * 0.85
                tx, ty = x + math.cos(a) * rr, y + math.sin(a) * rr
                if road_dist(tx, ty)[0] > 25:
                    z0 = ground_z(tx, ty)
                    if z0 is not None and z0 > 0.5:
                        kind = rnd.choice(['pine', 'pine', 'broadleaf', 'sakura_a', 'sakura_b'])
                        tree_inst[kind].append((Vector((tx, ty, ground_z(tx, ty))), rnd.uniform(0, 6.28), rnd.uniform(0.8, 1.5) * (0.75 if kind == 'pine' else 1.0)))
            break
# the hills sit on the terrain but terrain height under them is not what ground_z returns afterwards: trees were placed on the hill top
log('hills', len(hills))
for x, y, d in removed_sites:   # tree clusters where a near frontage used to be
    if d <= 100:
        for _ in range(4):
            add_tree(x + rnd.uniform(-9, 9), y + rnd.uniform(-11, 11))
# a few more along the road behind the footpath, where nothing stands
for i in range(0, N, 9):
    t = Vector((CL[(i + 1) % N][0] - CL[i - 1][0], CL[(i + 1) % N][1] - CL[i - 1][1])).normalized()
    nrm = Vector((-t.y, t.x))
    side = 1 if rnd.random() < 0.5 else -1
    c = Vector(CL[i][:2]) + nrm * side * rnd.uniform(22, 30)
    add_tree(c.x, c.y)
# groves in open ground (fills the gaps the removed blocks left)
groves = 0
for _ in range(400):
    i = rnd.randrange(N)
    t = Vector((CL[(i + 1) % N][0] - CL[i - 1][0], CL[(i + 1) % N][1] - CL[i - 1][1])).normalized()
    c = Vector(CL[i][:2]) + Vector((-t.y, t.x)) * rnd.choice((-1, 1)) * rnd.uniform(45, 330)
    if road_dist(c.x, c.y)[0] < 34 or any(rects_overlap(rect_corners(c, 0, 14, 14), r, 0) for r in REG):
        continue
    ok = 0
    for _k in range(rnd.randint(8, 16)):
        a_, r_ = rnd.uniform(0, 6.28), math.sqrt(rnd.random()) * 14
        ok += add_tree(c.x + math.cos(a_) * r_, c.y + math.sin(a_) * r_)
    groves += bool(ok)
    if groves >= 60:
        break
log('groves', groves)
log('trees total', {k: len(v) for k, v in tree_inst.items()})

# trees whose position now sits in a kept building or stand: drop (from v10 positions)
for k, lst in tree_inst.items():
    tree_inst[k] = [t for t in lst if not any(rects_overlap(rect_corners((t[0].x, t[0].y), 0, 1.5, 1.5), r, 0) for r in REG[:len(keep_near) + len(moved)])]

for k, lst in tree_inst.items():
    for n_, (p, yaw, s) in enumerate(lst):
        for me, tag in ((TREES[k], 'tree'), (FARS[k], 'far')):
            ob = bpy.data.objects.new(f'{tag}_{k}_{n_:04d}', me)
            ob.location, ob.rotation_euler, ob.scale = p, (0, 0, yaw), (s, s, s)
            VIS.objects.link(ob)

# ------------------------------------------------------------------------------------------------ 8. panorama band and Fuji
cx = sum(p[0] for p in CL) / N
cy = sum(p[1] for p in CL) / N
PANO = T / 'textures' / 'panorama'
band_obs = []
for tag, fname, rad in (('', 'tokyo_skyline_night.png', BAND_R), ('_day', 'tokyo_skyline_day.png', BAND_R - 2)):
    bmat = tex_mat('M_SupertallBackdrop' + ('Day' if tag else ''), PANO / fname, rough=1.0, emit_strength=1.0, vcol=True)
    bmat.surface_render_method = 'BLENDED'
    bm = bmesh.new()
    rows_v = [(-60.0, 0.0, 0.0), (BAND_H * 0.04, 0.04, 1.0), (BAND_H * 0.72, 0.72, 1.0), (BAND_H, 1.0, 0.0)]    # foot fades into haze, top into the game sky
    grid = []
    for (yy, vv, al) in rows_v:
        grid.append([(bm.verts.new((math.sin(2 * math.pi * s_ / 128) * rad, math.cos(2 * math.pi * s_ / 128) * rad, yy)), s_ / 128, vv, al) for s_ in range(129)])
    lay = bm.loops.layers.uv.verify()
    col_l = bm.loops.layers.float_color.new('Col')
    for r_ in range(len(grid) - 1):
        for s_ in range(128):
            quad = [grid[r_][s_], grid[r_][s_ + 1], grid[r_ + 1][s_ + 1], grid[r_ + 1][s_]]
            f = bm.faces.new([quad[0][0], quad[3][0], quad[2][0], quad[1][0]])      # inward facing
            for l, e in zip(f.loops, [quad[0], quad[3], quad[2], quad[1]]):
                l[lay].uv = (1 - e[1], e[2])
                l[col_l] = (1, 1, 1, e[3])
    ob_ = bm_to_obj('skyline_band' + tag, bm, [bmat], VIS, (cx, cy, 0))
    for p_ in ob_.data.polygons:
        p_.use_smooth = True
    band_obs.append(ob_)
fuji = next(o for o in sc.objects if o.name.startswith('Mount Fuji'))
fuji.name = 'skyline_fuji'
cs_ = [fuji.matrix_world @ Vector(c) for c in fuji.bound_box]
fc = sum(cs_, Vector()) / 8
D = math.hypot(fc.x - cx, fc.y - cy)
s_ = (BAND_R * 0.9) / D
fuji.matrix_world = Matrix.Translation((cx, cy, 0)) @ Matrix.Diagonal((s_, s_, s_, 1)) @ Matrix.Translation((-cx, -cy, 0)) @ fuji.matrix_world
fm = tex_mat('M_SupertallFuji', T / 'textures' / 'mount_fuji_night_cutout_v1.png', rough=1.0, emit_strength=0.55, cutout=True)
fuji.data.materials.clear()
fuji.data.materials.append(fm)
if not KEEP_FUJI:
    bpy.data.objects.remove(fuji, do_unlink=True)
log('Fuji distance', round(D), 'scaled', round(s_, 3), 'band radius', BAND_R, 'height', round(BAND_H))

# ------------------------------------------------------------------------------------------------ 9. collision
cl = [Vector(p) for p in CL]
for g_ in (terr, plane):    # the exporter needs UVs for the grass texture: planar, 24 m per tile, in world metres (hills use the same)
    me_ = g_.data
    for nm in list(me_.uv_layers.keys()):
        me_.uv_layers.remove(me_.uv_layers[nm])
    uv_ = me_.uv_layers.new(name='UVMap')
    for lp in me_.loops:
        w_ = g_.matrix_world @ me_.vertices[lp.vertex_index].co
        uv_.data[lp.index].uv = (w_.x / 24, w_.y / 24)
terr.name = 'ground_terrain'
plane.name = 'ground_plane'
for o in sc.objects:
    if o.name.startswith(('Tokyo Bay water', 'V10 lagoon surface')):
        o.name = 'water'
        o['surface'] = 'water'
road = next(o for o in sc.objects if o.name.startswith('Continuous road'))
barrier = next(o for o in sc.objects if o.name.startswith('Continuous concrete barrier'))
road.name = 'asphalt_road'


def col_obj(name, src_objs, faces_filter=None):
    bm = bmesh.new()
    for o in src_objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        bmesh.ops.triangulate(tmp, faces=tmp.faces[:])
        if faces_filter:
            bmesh.ops.delete(tmp, geom=[f for f in tmp.faces if not faces_filter(f)], context='FACES')
        me = bpy.data.meshes.new('t')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    COL.objects.link(ob)
    ob.hide_render = True
    ob['surface'] = name[4:]
    return ob


kerbs = [o for o in sc.objects if o.name.startswith('Kerb |')]
sidewalks = [o for o in sc.objects if o.name.startswith('Continuous sidewalk')]
col_obj('col_asphalt', [road])
col_obj('col_curb', kerbs)
# wall: a vertical strip on the track face of the barrier (11.9 m from the centre line, 1.4 m tall), built from the centre line like Marina's
wbm = bmesh.new()
for sd in (1, -1):
    prev = None
    for i in range(N + 1):
        a_, b_ = cl[(i - 1) % N], cl[(i + 1) % N]
        d_ = (b_ - a_).normalized()
        nrm = Vector((-d_.y, d_.x, 0)) * sd
        base = cl[i % N] + nrm * 11.9
        cur = (wbm.verts.new(base + Vector((0, 0, -0.4))), wbm.verts.new(base + Vector((0, 0, 1.0))))
        if prev:
            wbm.faces.new([prev[0], cur[0], cur[1], prev[1]])
        prev = cur
wme = bpy.data.meshes.new('col_wall')
wbm.to_mesh(wme)
wbm.free()
wob = bpy.data.objects.new('col_wall', wme)
wob['surface'] = 'wall'
wob.hide_render = True
COL.objects.link(wob)
col_paved = col_obj('col_paved', sidewalks)
sbm = bmesh.new()
for sd in (1, -1):      # shoulder from the road edge to the wall (bridges and tunnel have no kerb): drivable, flush with the road
    prev = None
    for i in range(N + 1):
        a_, b_ = cl[(i - 1) % N], cl[(i + 1) % N]
        d_ = (b_ - a_).normalized()
        nrm = Vector((-d_.y, d_.x, 0)) * sd
        c0 = cl[i % N]
        cur = (sbm.verts.new(c0 + nrm * (HALF_W + 0.02) + Vector((0, 0, -0.05))), sbm.verts.new(c0 + nrm * 11.9 + Vector((0, 0, -0.05))))
        if prev:
            sbm.faces.new([prev[0], prev[1], cur[1], cur[0]])
        prev = cur
sbm.to_mesh(col_paved.data) if False else None
tmp_me = bpy.data.meshes.new('shoulder')
sbm.to_mesh(tmp_me)
sbm.free()
jb = bmesh.new()
jb.from_mesh(col_paved.data)
jb.from_mesh(tmp_me)
jb.to_mesh(col_paved.data)
jb.free()
col_obj('col_grass', [terr], lambda f: road_dist(*(sum((v.co for v in f.verts), Vector()) / 3).xy)[0] < 70 and (sum((v.co for v in f.verts), Vector()) / 3).z > -3)
for o in COL.objects:
    log('collision', o.name, tris(o.data))

# ------------------------------------------------------------------------------------------------ 10. track.json, lights.json
to_game = lambda x, y, z: [round(x, 3), round(z, 3), round(-y, 3)]
cl = [Vector(p) for p in CL]
slope, heading = [], []
for i in range(N):
    a, b = cl[i - 1], cl[(i + 1) % N]
    d = b - a
    slope.append(round(d.z / max(d.xy.length, 1e-6), 4))
    heading.append(math.atan2(d.y, d.x))
cum = [0.0]
for i in range(1, N + 1):
    cum.append(cum[-1] + (cl[i % N] - cl[i - 1]).xy.length)
LAP = cum[-1]
yaw_of = lambda h: round(math.atan2(math.cos(h), -math.sin(h)), 4)     # rotation.y that turns local +Z onto the travel direction (game x east, z = -north)
# corners from the heading change over 60 m windows
corners_ = []
kk = int(60 / (LAP / N))
turn = [((heading[(i + kk) % N] - heading[i - kk] + math.pi) % (2 * math.pi) - math.pi) for i in range(N)]
i = 0
while i < N:
    if abs(turn[i]) > math.radians(28):
        j = i
        while j < N and abs(turn[j]) > math.radians(28):
            j += 1
        apex = max(range(i, j), key=lambda k: abs(turn[k]))
        corners_.append(dict(start=i, end=j, apex=apex, angle=round(math.degrees(abs(turn[apex])), 1), sign=1 if turn[apex] > 0 else -1))
        i = j + kk // 2
    else:
        i += 1
corner_json = []
for n_, c in enumerate(corners_):
    seg = range(c['start'], c['end'])
    rad = (LAP / N * kk * 2) / max(math.radians(c['angle']), 0.1)
    corner_json.append(dict(id=f'T{n_ + 1}', name=f'Turn {n_ + 1}', radius=round(rad), angle=c['angle'], apexIdx=c['apex'], boards=[]))
slots = []
for k in range(8):
    dist_back = 8 + 8 * k
    s = (LAP - dist_back) % LAP
    j = max(i_ for i_ in range(N) if cum[i_] <= s)
    f = (s - cum[j]) / max(cum[j + 1] - cum[j], 1e-6)
    p = cl[j].lerp(cl[(j + 1) % N], f)
    h = heading[j]
    nrm = Vector((-math.sin(h), math.cos(h), 0))
    lat = 3.0 if k % 2 == 0 else -3.0
    slots.append(dict(slot=k + 1, centerlineIdx=j, pos=to_game(*(p + nrm * lat)), headingYawRad=yaw_of(h)))
track = {
    'name': 'Tokyo Hiragana Circuit', 'units': 'metres; game coords: Y up (absolute, the road dips to -12 m), x east, -z north; origin = start/finish line centre; start heading +X',
    'direction': 'as sampled in out/centerline-v10.json (start/finish index 33 of the source order)', 'lapLength': round(LAP, 1),
    'credits': ['Textures: Poly Haven (CC0), see assets/polyhaven/CREDITS.md; sponsor boards: assets/sponsors/README.md'],
    'spacing': round(LAP / N, 3), 'centerline': [to_game(*p) for p in CL], 'halfWidth': [HALF_W] * N,
    'racingLine': [0.0] * N, 'slope': slope, 'banking': [0.0] * N, 'headingYawRad': [yaw_of(h) for h in heading],
    'sectors': [0, N // 3, 2 * N // 3], 'checkpoints': list(range(0, N, 25)), 'corners': corner_json,
    'start': {'pos': [0, round(CL[0][2], 3), 0], 'headingYawRad': yaw_of(heading[0]), 'gridSlots': slots},
    'pitLane': None, 'zones': [], 'weather': {'default': 'night', 'looks': ['dusk', 'bluehour', 'night']},
    'landmarks': [{'name': 'Tokyo', 'pos': to_game(cx, cy, 0)}],
    'surfaces': {'asphalt': ['col_asphalt'], 'curb': ['col_curb'], 'grass': ['col_grass'], 'paved': ['col_paved'], 'wall': ['col_wall']},
    'capabilities': {'pit': False, 'vip': False, 'hoardings': False, 'driverHoardings': False},
    'backdrop': {'mesh': 'skyline_band', 'texture': 'textures/panorama/tokyo_skyline_night.png', 'textureDay': 'textures/panorama/tokyo_skyline_day.png', 'meshDay': 'skyline_band_day', 'radius': BAND_R, 'height': round(BAND_H), 'centre': to_game(cx, cy, 0), 'aspect': PANO_ASPECT},
    'collision': 'tokyo_collision.glb', 'visual': ['tokyo_visual.glb'],
}
(O / 'track.json').write_text(json.dumps(track, separators=(',', ':')), encoding='utf8')
flood, stand_l, street = [], [], []
# floodlights: v10 spot lights if any, else the brightest point/area lights thinned to >= 90 m apart, aimed at the nearest road point
cands = [x for x in spots if x[2] == 'SPOT'] or sorted([x for x in spots if x[2] in ('POINT', 'AREA')], key=lambda x: -x[4])
taken = []
for (p, d_, typ, color, energy) in cands:
    if any((p - t).length < 90 for t in taken) or p.z < 3:
        continue
    taken.append(p)
    _, ci = road_dist((M @ p).x, (M @ p).y)
    tg = Vector(CL[ci]) if typ != 'SPOT' else (M @ p) + (M.to_3x3() @ d_) * 30
    flood.append({'pos': to_game(*(M @ p)), 'target': to_game(*tg), 'warm': color[0] > color[2]})
for o in sc.objects:
    if o.name.startswith('lamp_pole_'):
        street.append({'pos': to_game(*(o.matrix_world.translation + Vector((0, 0, 9.0))))})
for si in stand_info:
    mw = si['mw']
    R = si['R']
    for x in range(int(-si['width'] / 2) + 15, int(si['width'] / 2), 30):
        a = x / R
        for yy, zz in ((-si['depth'] / 2 - 5, 26.2),):
            pl = mw @ Vector(((R + yy) * math.sin(a), (R + yy) * math.cos(a) - R, zz))
            tg = mw @ Vector(((R - si['depth'] / 2 - 40) * math.sin(a), (R - si['depth'] / 2 - 40) * math.cos(a) - R, 0))
            stand_l.append({'pos': to_game(*pl), 'target': to_game(*tg)})
(O / 'lights.json').write_text(json.dumps({'floodlights': flood[:60], 'standLamps': stand_l, 'streetLamps': street}, separators=(',', ':')), encoding='utf8')
log('lights', len(flood), len(stand_l), len(street))
(O / 'vip.json').write_text('{}', encoding='utf8') if False else None

# ------------------------------------------------------------------------------------------------ 11. save, export, count
for o in COL.objects:
    pass
bpy.ops.wm.save_as_mainfile(filepath=str(DST))


def export(path, objs, **kw):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_extras=True, **kw)


export(O / 'tokyo_visual.glb', list(VIS.all_objects), export_gpu_instances=True)
export(O / 'tokyo_collision.glb', list(COL.all_objects), export_materials='NONE', export_texcoords=False, export_normals=False)
def grp(o):
    n = o.name
    if n.startswith(('tree_', 'far_')):
        return 'foliage'
    if n.startswith(('sign_atlas', 'hero_')):
        return 'text (signs, wayfinding)'
    if n.startswith('board_'):
        return 'sponsor boards'
    if n.startswith('V10 frontage'):
        return 'frontages (district architecture)'
    if n.startswith('V10 08'):
        return 'stands (shell + crowd)'
    if n.startswith(('V10 0', 'V10 district', 'V10 HQ', 'V10 garden', 'V10 lantern', 'V10 neon', 'Avenue', 'V9 floating', 'V9 offshore')):
        return 'landmarks'
    if n.startswith(('hill', 'lamp_')):
        return 'hills and lamps (new)'
    if n.startswith(('asphalt_road', 'Kerb', 'Continuous', 'V9 barrier', 'V9 kerb', 'ground_', 'Catch', 'Start', 'Staggered', 'Tokyo start', 'V9 run-off', 'V9 paddock', 'V9 painted')):
        return 'track and terrain'
    return 'bridge, wheel, tunnel, street kit, other'


count, uniq_g, unique = {}, {}, {}
for o in VIS.all_objects:
    if o.type == 'MESH':
        n = tris(o.data)
        g = grp(o)
        count[g] = count.get(g, 0) + n
        if o.data.name not in unique:
            unique[o.data.name] = n
            uniq_g[g] = uniq_g.get(g, 0) + n
log('after (blender, objects x tris)', sum(count.values()), 'unique', sum(unique.values()))
(O / 'v11-blender-count.json').write_text(json.dumps({'objects_x_tris_by_group': count, 'unique_by_group': uniq_g, 'objects_x_tris': sum(count.values()), 'unique': sum(unique.values()),
                                                      'v10_by_group_evaluated': before, 'trees': {k: len(v) for k, v in tree_inst.items()}}, indent=1))
log('done')
