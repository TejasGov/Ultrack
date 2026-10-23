"""Tokyo Hiragana circuit: game build of v13.1 (replaces v11).

    powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/game_v13_1.py        (one Blender process, -b -t 6, below-normal priority)
    node tracks/tokyo/pack-web.mjs

Reads out/tokyo_v13_1.blend (never written), saves out/tokyo_game_v13_1.blend and exports out/tokyo_visual.glb, tokyo_collision.glb,
track.json, lights.json like game_v11.py (whose collision, track.json and lights code is reused as is).

What is different from v11 (the user rejected v11 for stripping the buildings): NOTHING near the road is decimated.
  * budget comes from tiers selected by distance (names carry a tag `~lo-hi` that track-viewer/src/perf.js Culler reads):
      frontages  full v10 detail 0-170 m, 7 % copy 170-1500 m;  trees  full 0-38 m, 22 % copy 38-320 m, crossed cards 320 m+;
      lanterns   full 0-110 m, octahedron 110-700 m;           landmarks, wheel, bridge: full to 300-900 m, 12 % copy beyond
  * linked duplicates (trees, frontages, lanterns, gondolas, lamps, sponsor boards) are exported with EXT_mesh_gpu_instancing
  * all 3D text (sponsor text, kanji, plaques, pylons) is baked to one atlas on quads (Yu Gothic), crisp, 3 hero signs stay 3D
  * the two curved ridge / Shibuya stands are rebuilt as stepped shells (v11 generator), the start stands (v12) are kept as modelled
  * the rest of the small static geometry is merged per 768 m cell, materials are de-duplicated, node materials become plain glTF materials
  * backdrop: ONE skyline arc (night M_SupertallBackdrop, day M_SupertallBackdropDay), Fuji card, two ridges (night / day), distant lights, searchlight cards
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
SRC, DST = O / 'tokyo_v13_1.blend', O / 'tokyo_game_v13_1.blend'
sys.path.insert(0, str(ROOT / 'tracks' / 'marina'))
import brand_art  # noqa: E402

rnd = random.Random(131)
LOG = {}
HALF_W = 9.0
CELL = 768.0
R_ARC, ARC_H_K = 7000.0, None
TAG = '~'


def log(*a):
    print('[game13.1]', *a, flush=True)


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


def collapse_materials(me, keep):
    """far copies only: faces of the least-used materials take the nearest colour of the `keep` most-used ones (fewer draw calls at a distance)"""
    used = {}
    for p in me.polygons:
        used[p.material_index] = used.get(p.material_index, 0) + 1
    if len(used) <= keep:
        return

    def rgb(i):
        m = me.materials[i] if i < len(me.materials) else None
        if not m or not m.use_nodes:
            return Vector((0.5, 0.5, 0.5))
        b = m.node_tree.nodes.get('Principled BSDF')
        if not b:
            return Vector((0.5, 0.5, 0.5))
        e = Vector(b.inputs['Emission Color'].default_value[:3]) * min(1.0, b.inputs['Emission Strength'].default_value)
        return Vector(b.inputs['Base Color'].default_value[:3]) + e
    top = sorted(used, key=lambda i: -used[i])[:keep]
    remap = {i: min(top, key=lambda t: (rgb(i) - rgb(t)).length) for i in used if i not in top}
    for p in me.polygons:
        if p.material_index in remap:
            p.material_index = remap[p.material_index]


def decimate_copy(me, ratio, min_tris=300, name=None, keep=None):
    """a lower-poly COPY of a mesh (the original is never touched): used only for the far tier of an object"""
    n = tris(me)
    cp = me.copy()
    cp.name = name or (me.name + '_lod')
    if n <= min_tris:
        if keep:
            collapse_materials(cp, keep)
        return cp
    tmp = bpy.data.objects.new('_dec', cp)
    bpy.context.scene.collection.objects.link(tmp)
    md = tmp.modifiers.new('d', 'DECIMATE')
    md.ratio = max(0.02, max(min_tris, n * ratio) / n)
    md.use_collapse_triangulate = True
    new = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bpy.data.meshes.remove(cp)
    new.name = name or (me.name + '_lod')
    if keep:
        collapse_materials(new, keep)
    return new


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
    return tris(me)


def rect_corners(c, yaw, hx, hy):
    cs, sn = math.cos(yaw), math.sin(yaw)
    return [Vector((c[0] + cs * x - sn * y, c[1] + sn * x + cs * y)) for x, y in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]


# ------------------------------------------------------------------------------------------------ 0. copy, clean, align
bpy.ops.wm.open_mainfile(filepath=str(SRC))
bpy.ops.wm.save_as_mainfile(filepath=str(DST))          # from here on only the game build is written
sc = bpy.context.scene
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

pts = json.load(open(O / 'centerline-v10.json'))['points']
start_old = Vector((-188.67, -513.70))
i0 = min(range(len(pts)), key=lambda i: (Vector(pts[i][:2]) - start_old).length)
pts = pts[i0:] + pts[:i0]
N = len(pts)
S0 = Vector(pts[0][:2])
ang = -math.atan2(pts[1][1] - pts[N - 1][1], pts[1][0] - pts[N - 1][0])
M = Matrix.Rotation(ang, 4, 'Z') @ Matrix.Translation((-S0.x, -S0.y, 0))
CL = []
for p in pts:
    v = M @ Vector((p[0], p[1], 0))
    CL.append((v.x, v.y, p[2]))
cx0 = sum(p[0] for p in pts) / N          # circuit centre in the SOURCE frame (the backdrop is built there, then moved with everything)
cy0 = sum(p[1] for p in pts) / N
kd = KDTree(N)
for i, p in enumerate(CL):
    kd.insert((p[0], p[1], 0), i)
kd.balance()


def road_dist(x, y):
    _, i, d = kd.find((x, y, 0))
    return d, i


NOT_GAME = ('HOLO_', 'V13.1 skyline arc', 'V13 skyline_band', 'V12 skyline_band', 'V13.1 far hills', 'V13.1 near hills', 'V13.1 horizon haze', 'V13.1 distant',
            'V13 searchlight', 'V13.1 searchlight', 'V12 searchlight')
spots = [(o.matrix_world.translation.copy(), o.matrix_world.to_quaternion() @ Vector((0, 0, -1)), o.data.type, tuple(o.data.color), o.data.energy, o.name)
         for o in sc.objects if o.type == 'LIGHT' and not coll_hidden(o)]
holo = [dict(name=o.name, pos=o.matrix_world.translation.copy(), fwd=o.matrix_world.to_quaternion() @ Vector((0, 1, 0)), props={k: o[k] for k in o.keys() if not k.startswith('_')})
        for o in sc.objects if o.name.startswith('HOLO_anchor')]
log('lights in source', len(spots), 'hologram anchors', len(holo))

vis_objs = [o for o in sc.objects if o.type in {'MESH', 'FONT'} and not coll_hidden(o) and not o.name.startswith(NOT_GAME)]
for o in list(sc.objects):
    if o not in vis_objs:
        bpy.data.objects.remove(o, do_unlink=True)
fuji_card = next((o for o in vis_objs if o.name.startswith('Mount Fuji')), None)
log('visible source objects', len(vis_objs))

# ------------------------------------------------------------------------------------------------ 1. backdrop (built in the source frame, moved with everything by M)
subprocess.run(['C:/Python314/python.exe', str(T / 'bake_backdrop_v13_1.py')], check=True)
PAN = T / 'textures' / 'panorama'
R_ARC = 7000.0
ARC_H = R_ARC * math.tan(math.radians(6.0)) / 0.97          # tallest tip 6 degrees
ARC_DEG = math.degrees(9.6 * ARC_H / R_ARC)
TH0 = 82.0
BACK = []
arc_night = tex_mat('M_SupertallBackdrop', PAN / 'tokyo_arc_night.png', rough=1.0, emit_strength=1.0, blend=True)
arc_day = tex_mat('M_SupertallBackdropDay', PAN / 'tokyo_arc_day.png', rough=1.0, emit_strength=1.0, blend=True)
# the day arc keeps its own sun-lit colour, so it also gets a little of the day light on its base colour
for tag_, m_, rad in (('', arc_night, R_ARC), ('_day', arc_day, R_ARC - 2)):
    bm = bmesh.new()
    rows = [(-40.0, 0.0), (ARC_H * 0.03, 0.03), (ARC_H * 0.8, 0.8), (ARC_H, 1.0)]
    SEG = 96
    grid = [[bm.verts.new((math.sin(math.radians(TH0 + ARC_DEG * s / SEG)) * rad, math.cos(math.radians(TH0 + ARC_DEG * s / SEG)) * rad, z)) for s in range(SEG + 1)] for z, _v in rows]
    lay = bm.loops.layers.uv.verify()
    for r in range(len(rows) - 1):
        for s in range(SEG):
            f = bm.faces.new([grid[r][s], grid[r + 1][s], grid[r + 1][s + 1], grid[r][s + 1]])
            for l, (uu, vv) in zip(f.loops, [(s / SEG, rows[r][1]), (s / SEG, rows[r + 1][1]), ((s + 1) / SEG, rows[r + 1][1]), ((s + 1) / SEG, rows[r][1])]):
                l[lay].uv = (uu, vv)
    for f in bm.faces:
        f.smooth = True
    ob = bm_to_obj('skyline_arc' + tag_, bm, [m_], sc.collection, (cx0, cy0, 0))
    BACK.append(ob)


def ridge(name, radius, base, amp, seed, m_):
    r = random.Random(seed)
    ph = [r.uniform(0, 6.28) for _ in range(6)]
    n = 360
    bm = bmesh.new()
    top, bot = [], []
    for k in range(n):
        th = 2 * math.pi * k / n
        h = (base + amp * (0.5 + 0.5 * math.sin(2 * th + ph[0])) + 0.55 * amp * math.sin(5 * th + ph[1]) + 0.35 * amp * math.sin(11 * th + ph[2])
             + 0.2 * amp * math.sin(29 * th + ph[3]))
        h = max(h, 6.0)
        top.append(bm.verts.new((math.sin(th) * radius, math.cos(th) * radius, h)))
        bot.append(bm.verts.new((math.sin(th) * radius, math.cos(th) * radius, -60.0)))
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new([bot[k], bot[j], top[j], top[k]])
    for f in bm.faces:
        f.smooth = True
    return bm_to_obj(name, bm, [m_], sc.collection, (cx0, cy0, 0))


hills_n = mat('M_SupertallHills', (0.012, 0.014, 0.03), 1.0, (0.012, 0.014, 0.03), 0.6)
hills_d = mat('M_SupertallHillsDay', (0.30, 0.38, 0.45), 1.0, (0.30, 0.38, 0.45), 0.3)
for tag_, m_, f0 in (('', hills_n, 0), ('_day', hills_d, 0)):
    BACK.append(ridge('skyline_hills_near' + tag_, 6300.0 - (2 if tag_ else 0), 12.0, 38.0, 11, m_))
    BACK.append(ridge('skyline_hills_far' + tag_, 7400.0 - (2 if tag_ else 0), 40.0, 70.0, 7, hills_n if not tag_ else hills_d))
# sparse distant low-rise lights on the ridges outside the arc (night only: M_SupertallLightsNight fades by day)
lights_m = mat('M_SupertallLightsNight', (0.0, 0.0, 0.0), 1.0, (1.0, 0.72, 0.4), 6.0)
bm = bmesh.new()
for _ in range(900):
    th = rnd.uniform(0, 360)
    if TH0 - 4 < th < TH0 + ARC_DEG + 4:
        continue
    Rr = 6290.0 if rnd.random() < 0.5 else 7380.0
    h = rnd.uniform(8, 36) if Rr < 7000 else rnd.uniform(30, 90)
    tr = math.radians(th)
    p = Vector((math.sin(tr) * Rr + cx0, math.cos(tr) * Rr + cy0, h))
    tg = Vector((math.cos(tr), -math.sin(tr), 0))
    s_ = rnd.uniform(9, 17)
    q(bm, [p - tg * s_ / 2, p + tg * s_ / 2, p + tg * s_ / 2 + Vector((0, 0, s_ * 0.7)), p - tg * s_ / 2 + Vector((0, 0, s_ * 0.7))], 0)
BACK.append(bm_to_obj('skyline_lights', bm, [lights_m], sc.collection))
# Fuji: the v7 card (positions kept from v13.1) with a baked base haze
if fuji_card:
    fuji_card.name = 'skyline_fuji'
    fuji_card.data.materials.clear()
    fuji_card.data.materials.append(tex_mat('M_SupertallFuji', T / 'textures' / 'tokyo_fuji_v13.png', rough=1.0, emit_strength=0.7, blend=True))
    BACK.append(fuji_card)
# searchlight beams: nested thin cones, additive-looking emissive with a height fade baked in vertex alpha (night only)
beam_m = mat('M_NightBeam', (0.7, 0.85, 1.0), 1.0, (0.7, 0.85, 1.0), 2.0)
beam_m.surface_render_method = 'BLENDED'
bsdf = beam_m.node_tree.nodes['Principled BSDF']
bsdf.inputs['Alpha'].default_value = 1.0
va = beam_m.node_tree.nodes.new('ShaderNodeVertexColor')
va.layer_name = 'Col'
beam_m.node_tree.links.new(va.outputs['Alpha'], bsdf.inputs['Alpha'])
cl0 = [Vector(p) for p in pts]
bm = bmesh.new()
col = bm.loops.layers.float_color.new('Col')
sites = [(-90, -200), (20, -290), (150, -230), (230, -260)]
for k, (ds, lat) in enumerate(sites):
    base = M.inverted() @ Vector((ds * 2.0, 0, 0))                  # a point ds*2 m down the straight, in the source frame
    nrm = Vector((0, 1, 0))
    c = Vector((base.x, base.y, 0)) + (M.inverted().to_3x3() @ Vector((0, lat, 0)))
    tilt = Vector((math.sin(math.radians(14 + 10 * (k % 2))), math.sin(math.radians(-12 + 9 * k)), 1)).normalized()
    for layer, r2 in enumerate((14.0, 7.0)):
        segs, H = 12, 650.0
        a_ = [bm.verts.new(c + Vector((math.cos(2 * math.pi * s / segs) * 0.6, math.sin(2 * math.pi * s / segs) * 0.6, 0))) for s in range(segs)]
        b_ = [bm.verts.new(c + tilt * H + Vector((math.cos(2 * math.pi * s / segs) * r2, math.sin(2 * math.pi * s / segs) * r2, 0))) for s in range(segs)]
        for s in range(segs):
            f = bm.faces.new([a_[s], a_[(s + 1) % segs], b_[(s + 1) % segs], b_[s]])
            for l in f.loops:
                l[col] = (1, 1, 1, 0.16 if l.vert in a_ else 0.0)
BACK.append(bm_to_obj('skyline_beams', bm, [beam_m], sc.collection))
vis_objs += BACK

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
    if o.name not in VIS.objects:
        VIS.objects.link(o)
    if o.name in sc.collection.objects:
        sc.collection.objects.unlink(o)
cx, cy = sum(p[0] for p in CL) / N, sum(p[1] for p in CL) / N
dg = bpy.context.evaluated_depsgraph_get()


def ev_tris(o):
    e = o.evaluated_get(dg)
    m = e.to_mesh()
    m.calc_loop_triangles()
    n = len(m.loop_triangles)
    e.to_mesh_clear()
    return n


before = {}
for o in vis_objs:
    if o.name.startswith('skyline'):
        continue
    before['text' if o.type == 'FONT' else 'mesh'] = before.get('text' if o.type == 'FONT' else 'mesh', 0) + ev_tris(o)
log('source (visible, evaluated) triangles', before)

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


exec(compile(open(T / 'game_v13_1_part2.py', encoding='utf-8').read(), 'game_v13_1_part2.py', 'exec'))
