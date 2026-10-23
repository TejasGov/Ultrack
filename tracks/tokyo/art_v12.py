"""Tokyo v12 art pass (Blender review build). Reads out/tokyo_japanese_v10.blend (never written), saves out/tokyo_v12.blend.

    powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/art_v12.py          (one process, -b -t 6, below-normal priority)

Not an export: no GLB, no game files. See README "V12 art pass".
  1  stands: the start-straight curved stands are replaced by Seoul-style straight stands behind catch fences (every part >= 16 m from
     the centerline in plan, roofs included); the ridge and Shibuya curved stands and the lighting masts are pushed clear
  2  instancing + LOD instead of decimation: the 134 frontages and the sakura / canopy / cedar trees become linked duplicates of a few
     full-detail hero meshes (trees beyond TREE_LOD_DIST of the road use a decimated LOD copy of the same hero)
  3  night street-circuit dressing: wet asphalt, painted run-off, grid boxes, catch fences with lit posts, sponsor banners, start gantry
     with screens, LED light lines (barriers, lagoon, bay), searchlights, neon kanji pylons, red lanterns, sakura lining, pagoda,
     lit Ferris wheel and bridge, gate lighting
  4  sky: night world, 360 degree skyline band (v11's), a Mount Fuji silhouette on the avenue bearing
"""
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v12_common as C  # noqa: E402
import clearance_v12 as CK  # noqa: E402

O = C.O
SRC, DST = O / 'tokyo_japanese_v10.blend', O / 'tokyo_v12.blend'
rnd = random.Random(12)
LOG = {}
HALF_W, FENCE_LAT, STAND_LAT = 9.0, 12.6, 16.6          # road half width, catch fence line, front of the stands (envelope is 14.5)
TREE_LOD_DIST = 55.0
BAND_R, PANO_ASPECT = 2800.0, 9.6
BAND_H = 2 * math.pi * BAND_R / PANO_ASPECT


def log(*a):
    print('[v12]', *a, flush=True)


bpy.ops.wm.open_mainfile(filepath=str(SRC))
sc = bpy.context.scene
cl = C.CL()
M, s0 = cl.M, cl.s0
log('centerline', M, 'stations, length', round(cl.length), 's0', s0)


def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def vis(o):
    return not o.hide_render and all(not c.hide_render for c in o.users_collection)


def hide(o):
    o.hide_render = True
    o.hide_viewport = True


def newcoll(name):
    c = bpy.data.collections.new(name)
    sc.collection.children.link(c)
    return c


# ----------------------------------------------------------------------------------------------- materials
def mat(name, rgb=(0.5, 0.5, 0.5), rough=0.6, metal=0.0, emit=None, strength=0.0, alpha=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha is not None:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m


def glow(name, rgb, strength=6.0):
    """pure emitter (neon / LED / lit glass)"""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*rgb, 1)
    e.inputs['Strength'].default_value = strength
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def img_mat(name, path, strength=0.5, rough=0.5):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(str(path), check_existing=True)
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = strength
    b.inputs['Roughness'].default_value = rough
    return m


def crowd_mat():
    m = bpy.data.materials.get('V12 crowd lit')
    if m:
        return m
    m = bpy.data.materials.new('V12 crowd lit')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    uv = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.9, 2.4, 1)
    vr = nt.nodes.new('ShaderNodeTexVoronoi')
    vr.inputs['Scale'].default_value = 1.0
    mixc = nt.nodes.new('ShaderNodeMix')
    mixc.data_type = 'RGBA'
    mixc.inputs[0].default_value = 0.35
    mixc.inputs[7].default_value = (0.55, 0.12, 0.05, 1)      # warm Seoul-like crowd
    nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
    nt.links.new(mp.outputs[0], vr.inputs['Vector'])
    nt.links.new(vr.outputs['Color'], mixc.inputs[6])
    nt.links.new(mixc.outputs[2], b.inputs['Base Color'])
    nt.links.new(mixc.outputs[2], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 0.45
    b.inputs['Roughness'].default_value = 0.8
    return m


def fence_mat():
    m = bpy.data.materials.get('V12 catch fence mesh')
    if m:
        return m
    m = bpy.data.materials.new('V12 catch fence mesh')
    m.use_nodes = True
    m.surface_render_method = 'DITHERED'
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.55, 0.6, 0.66, 1)
    b.inputs['Metallic'].default_value = 0.8
    b.inputs['Roughness'].default_value = 0.35
    uv = nt.nodes.new('ShaderNodeTexCoord')
    sp = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(uv.outputs['UV'], sp.inputs[0])
    lines = []
    for ax in ('X', 'Y'):
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 2.0
        fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'
        lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.09
        nt.links.new(sp.outputs[ax], mul.inputs[0]); nt.links.new(mul.outputs[0], fr.inputs[0]); nt.links.new(fr.outputs[0], lt.inputs[0])
        lines.append(lt)
    mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'
    nt.links.new(lines[0].outputs[0], mx.inputs[0]); nt.links.new(lines[1].outputs[0], mx.inputs[1])
    nt.links.new(mx.outputs[0], b.inputs['Alpha'])
    return m


# ----------------------------------------------------------------------------------------------- geometry helpers
def quad(bm, pts, uvs=None, mi=0):
    vs = [bm.verts.new(p) for p in pts]
    try:
        f = bm.faces.new(vs)
    except ValueError:
        return None
    f.material_index = mi
    if uvs:
        lay = bm.loops.layers.uv.verify()
        for l, uv in zip(f.loops, uvs):
            l[lay].uv = uv
    return f


def box(bm, c, sx, sy, sz, rot=0.0, mi=0):
    """axis box centred at c (x,y,z of the bottom centre), rotated about Z"""
    cs, sn = math.cos(rot), math.sin(rot)
    def p(x, y, z):
        return (c[0] + x * cs - y * sn, c[1] + x * sn + y * cs, c[2] + z)
    hx, hy = sx / 2, sy / 2
    v = [p(-hx, -hy, 0), p(hx, -hy, 0), p(hx, hy, 0), p(-hx, hy, 0), p(-hx, -hy, sz), p(hx, -hy, sz), p(hx, hy, sz), p(-hx, hy, sz)]
    for idx in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        quad(bm, [v[i] for i in idx], mi=mi)


def to_obj(name, bm, mats, coll, loc=(0, 0, 0), smooth=False):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    coll.objects.link(ob)
    return ob


def sweep(bm, i0, i1, side, prof, uvmode='sv'):
    """profile sweep along the centerline stations i0..i1. prof = [(lat, dz, mat_index)] open polyline, lat measured outward from
    the centre line on `side`; mat_index is the material of the segment ENTERING that point."""
    for i in range(i0, i1):
        for k in range(1, len(prof)):
            (l0, z0, _), (l1, z1, mi) = prof[k - 1], prof[k]
            a, b = cl.at(i, side * l0, z0), cl.at(i + 1, side * l0, z0)
            c_, d = cl.at(i + 1, side * l1, z1), cl.at(i, side * l1, z1)
            s_a, s_b = i * C.STEP, (i + 1) * C.STEP
            vlo, vhi = z0, z1
            if abs(z1 - z0) < 1e-6:
                vlo, vhi = l0, l1
            pts = [a, b, c_, d] if side > 0 else [b, a, d, c_]
            uvs = [(s_a, vlo), (s_b, vlo), (s_b, vhi), (s_a, vhi)] if side > 0 else [(s_b, vlo), (s_a, vlo), (s_a, vhi), (s_b, vhi)]
            quad(bm, [tuple(p) for p in pts], uvs, mi)


def ribbon(bm, i0, i1, side, lat0, lat1, dz, mi=0, ustep=1.0):
    sweep(bm, i0, i1, side, [(lat0, dz, mi), (lat1, dz, mi)])


def new_light(name, kind, loc, energy, color, size=1.0, coll=None, rot=None, spot_deg=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    ld.use_shadow = False
    if kind == 'AREA':
        ld.size = size
    if kind == 'POINT':
        ld.shadow_soft_size = size
    if kind == 'SPOT':
        ld.shadow_soft_size = size
        ld.spot_size = math.radians(spot_deg or 50)
        ld.spot_blend = 0.5
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    (coll or sc.collection).objects.link(ob)
    return ob


def aim(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat('-Z', 'Y').to_euler()


# =============================================================================================== 0. clearance before
BEFORE = CK.run('v10')
LOG['clearance_before'] = {'violators': BEFORE['violators'], 'names': [r['name'] for r in BEFORE['list']]}

# =============================================================================================== 1. stands
STANDS = newcoll('V12 | start venue stands (behind the catch fence)')
FENCEC = newcoll('V12 | catch fence, sponsor banners, LED and grid')
GANTRYC = newcoll('V12 | start gantry and screens')

for o in sc.objects:     # v10 start-straight curved stands (their roofs and structure ran over the road) and the v10 gantry / grid paint
    if o.name.startswith(('V10 08 | curved Bayfront', 'V10 08 | curved Paddock', 'Tokyo start truss', 'Tokyo gantry approach',
                          'Start gantry upright', 'Staggered starting grid paint', 'Start identity')):
        hide(o)

m_conc = mat('V12 stand concrete', (0.09, 0.1, 0.12), 0.8)
m_fascia = mat('V12 stand fascia', (0.8, 0.82, 0.86), 0.4, emit=(0.5, 0.7, 1.0), strength=0.25)
m_cedar = mat('V12 cedar slat wall', (0.22, 0.12, 0.06), 0.7)
m_roof = mat('V12 stand roof', (0.04, 0.045, 0.055), 0.5, metal=0.5)
m_roofunder = glow('V12 roof underside warm', (1.0, 0.62, 0.32), 0.9)
m_ledc = glow('V12 LED cyan', (0.1, 0.9, 1.0), 9.0)
m_ledp = glow('V12 LED purple', (0.65, 0.18, 1.0), 9.0)
m_ledm = glow('V12 LED magenta', (1.0, 0.1, 0.6), 9.0)
m_flood = glow('V12 floodlight white', (1.0, 0.96, 0.88), 30.0)
m_steel = mat('V12 steel dark', (0.07, 0.08, 0.09), 0.4, metal=0.8)
m_crowd = crowd_mat()


def build_stand(side, i0, i1, name):
    bm = bmesh.new()
    L0, ROWS, RUN, RISE = STAND_LAT, 18, 0.9, 0.45
    prof = [(L0, 0.0, 0), (L0, 0.9, 1)]                       # fascia up to the first tread
    lat, z = L0, 0.9
    for k in range(ROWS):
        lat += RUN
        prof.append((lat, z, 0))                                 # tread
        z += RISE
        prof.append((lat, z, 2))                                 # riser: lit crowd
    L_end, Z_end = lat, z
    prof += [(L_end + 0.3, Z_end, 0), (L_end + 0.3, Z_end + 7.5, 3)]       # back wall: cedar
    sweep(bm, i0, i1, side, prof)
    # roof: slab front edge at lat 19.5 (>= 16.6), rising to the back; thickness 0.55
    zf, zb = 13.2, 16.2
    top = [(19.5, zf + 0.55, 4), (L_end + 2.0, zb + 0.55, 4)]
    sweep(bm, i0, i1, side, top)
    sweep(bm, i0, i1, side, [(19.5, zf, 5), (L_end + 2.0, zb, 5)])          # underside (warm lit)
    sweep(bm, i0, i1, side, [(19.5, zf, 4), (19.5, zf + 0.55, 4)])           # front edge face
    sweep(bm, i0, i1, side, [(L_end + 2.0, zb, 4), (L_end + 2.0, zb + 0.55, 4)])
    # roof rear columns every 12 m
    for i in range(i0, i1, 6):
        p = cl.at(i, side * (L_end + 1.6)); ang = math.atan2(cl.T[i][1], cl.T[i][0])
        box(bm, (p[0], p[1], p[2]), 0.7, 0.7, zb, ang, 6)
    mats = [m_conc, m_fascia, m_crowd, m_cedar, m_roof, m_roofunder, m_steel]
    ob = to_obj(name, bm, mats, STANDS)
    # LED lines: top of the fascia and the roof front edge
    bl = bmesh.new()
    ribbon(bl, i0, i1, side, L0 - 0.02, L0 + 0.25, 0.95, 0)
    sweep(bl, i0, i1, side, [(19.45, zf - 0.28, 0), (19.45, zf + 0.02, 0)])
    to_obj(name + ' | LED', bl, [m_ledc], STANDS)
    # flood bar under the roof front edge
    bf = bmesh.new()
    for i in range(i0, i1, 3):
        p = cl.at(i, side * 20.3, zf - 0.18); ang = math.atan2(cl.T[i][1], cl.T[i][0])
        box(bf, (p[0], p[1], p[2]), 0.9, 0.5, 0.18, ang, 0)
    to_obj(name + ' | floodlights', bf, [m_flood], STANDS)
    # a few real lights so the crowd and the road are lit (no shadows)
    for i in range(i0 + 8, i1 - 8, 22):
        p = cl.at(i, side * 24, 11.5)
        new_light(f'{name} lamp {i}', 'AREA', Vector(p), 9000, (1.0, 0.8, 0.6), size=10, coll=STANDS, rot=(math.radians(25 * -side * 0 + 0), 0, 0))
    return ob


ST_I0, ST_I1 = s0 - 56, s0 + 46
st_r = build_stand(-1, ST_I0, ST_I1, 'V12 Seoul-style start stand | south')
st_l = build_stand(+1, ST_I0 - 12, ST_I1 + 12, 'V12 Seoul-style start stand | north')
for o in STANDS.objects:        # lamp aim: point down towards the stand and the road
    if o.type == 'LIGHT':
        o.rotation_euler = (0, 0, 0)
log('stands built')


def push_clear(o, target=16.5):
    """slide a whole object straight away from the road until every vertex is >= target (plan) from the centerline"""
    kd, kd_pts = CK.centerline_kd()
    dg = bpy.context.evaluated_depsgraph_get()
    d, idx = CK.min_dist(o, kd, kd_pts, dg)
    if d >= target:
        return 0.0
    bb = Vector((sum(v[0] for v in o.bound_box), sum(v[1] for v in o.bound_box), 0)) / 8
    ctr = o.matrix_world @ bb
    i, dist, lat = cl.nearest(ctr.x, ctr.y)
    direction = Vector(cl.N[i]) * (1 if lat > 0 else -1)
    moved = 0.0
    while d < target and moved < 80:
        o.location += direction * 1.0
        moved += 1.0
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        d, _ = CK.min_dist(o, kd, kd_pts, dg)
    return moved


for nm in ('V10 08 | curved Roppongi ridge gallery', 'V10 08 | curved Roppongi ridge gallery | spectators and fascia'):
    LOG['pushed ' + nm] = push_clear(bpy.data.objects[nm])
log('pushed', {k: v for k, v in LOG.items() if k.startswith('pushed')})


def fix_masts():
    """the fixture banks are one mesh of loose masts: move the loose parts closer than 15.5 m out to 16 m"""
    o = bpy.data.objects['Race lighting masts and fixture banks']
    bm = bmesh.new(); bm.from_mesh(o.data)
    seen, parts = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, comp = [v], []
        seen.add(v.index)
        while stack:
            a = stack.pop(); comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen:
                    seen.add(b.index); stack.append(b)
        parts.append(comp)
    mw = o.matrix_world
    moved = 0
    for comp in parts:
        dmin, ref = 1e9, None
        for v in comp:
            w = mw @ v.co
            i, d, lat = cl.nearest(w.x, w.y)
            if d < dmin:
                dmin, ref = d, (i, lat)
        if dmin < 15.5:
            i, lat = ref
            sh = (16.0 - dmin) * (1 if lat > 0 else -1)
            off = mw.inverted().to_3x3() @ Vector(cl.N[i] * sh)
            for v in comp:
                v.co += off
            moved += 1
    bm.to_mesh(o.data); bm.free()
    return moved, len(parts)


LOG['masts moved/total'] = fix_masts()
log('masts', LOG['masts moved/total'])

# =============================================================================================== 2. instancing + LOD
FR_MAP = {}


def cluster_link(objs, tol_xy=3.2, tol_z=0.35, tol_tri=0.40, scale_ok=0.07, name=''):
    """objs -> hero meshes; every object whose footprint/height/triangle count is close to a hero becomes a linked duplicate of it
    (data shared, dims matched by a small scale). Nothing is decimated: each hero keeps its full mesh."""
    heroes, linked = [], 0
    for o in sorted(objs, key=lambda o: -tris(o.data)):
        d = o.dimensions
        best = None
        for h in heroes:
            hd = h.dimensions
            if abs(hd.x - d.x) <= tol_xy and abs(hd.y - d.y) <= tol_xy and abs(hd.z - d.z) <= tol_z and abs(tris(h.data) - tris(o.data)) <= tol_tri * tris(h.data):
                best = h
                break
        if best is None:
            heroes.append(o)
        else:
            sx = d.x / best.dimensions.x if best.dimensions.x else 1
            sy = d.y / best.dimensions.y if best.dimensions.y else 1
            old = o.data
            o.data = best.data
            FR_MAP[o.name] = best.data
            o.scale = (o.scale.x * sx, o.scale.y * sy, o.scale.z * (d.z / best.dimensions.z if best.dimensions.z else 1))
            linked += 1
    return len(heroes), linked


import re  # noqa: E402
fr_main = [o for o in sc.objects if re.match(r'V10 frontage \d+ \| timber shoji tiled eaves$', o.name) and vis(o)]
n_before = len({o.data.name for o in fr_main})
dims_ok = all(abs(o.scale.x - 1) < 1e-4 for o in fr_main)
for o in fr_main:
    o.rotation_mode = 'XYZ'
# the body's own scale is 1; dims are measured so object scales must be applied relative to hero dims -> tolerances above are small
h, l = cluster_link(fr_main)
for o in fr_main:
    FR_MAP.setdefault(o.name, o.data)
FR_LOD = {}
for d_ in set(FR_MAP.values()):
    tmp = bpy.data.objects.new('lodtmp', d_.copy()); sc.collection.objects.link(tmp)
    md = tmp.modifiers.new('d', 'DECIMATE'); md.ratio = 0.3
    ev = tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())
    lm_ = bpy.data.meshes.new_from_object(ev); lm_.name = d_.name + ' LOD1'
    bpy.data.objects.remove(tmp, do_unlink=True)
    FR_LOD[d_] = lm_
LOG['frontage instancing'] = dict(frontages=len(fr_main), unique_meshes_before=n_before, heroes=h, linked_duplicates=l)
log('frontages', LOG['frontage instancing'])

# trees
def tree_group(prefix_pred, key):
    return [o for o in sc.objects if prefix_pred(o.name) and vis(o) and o.type == 'MESH']


sak = tree_group(lambda n: n.startswith('Sakura ') and not n.startswith('Sakura master') and not n.startswith('Sakura event'), 'sakura')
can = tree_group(lambda n: n.startswith('Green canopy'), 'canopy')
ced = tree_group(lambda n: n.startswith('Shrine grove cedar'), 'cedar')
frm = tree_group(lambda n: n.startswith('Avenue framing sakura'), 'framing')


def make_lod(hero, ratio=0.22):
    me = hero.data.copy()
    me.name = hero.data.name + ' LOD1'
    tmp = bpy.data.objects.new('lodtmp', me)
    sc.collection.objects.link(tmp)
    md = tmp.modifiers.new('d', 'DECIMATE'); md.ratio = ratio
    dg = bpy.context.evaluated_depsgraph_get()
    ev = tmp.evaluated_get(dg)
    lod = bpy.data.meshes.new_from_object(ev)
    lod.name = hero.data.name + ' LOD1'
    bpy.data.objects.remove(tmp, do_unlink=True)
    return lod


TREE_MAP, TREE_HEROES = {}, {}


def instance_trees(objs, label, n_heroes):
    objs = sorted(objs, key=lambda o: o.dimensions.z)
    # n heroes spread over the size range, kept at full detail
    heroes = [objs[int((k + 0.5) * len(objs) / n_heroes)] for k in range(n_heroes)]
    lods = {h.data: make_lod(h) for h in heroes}
    tot = dict(full=0, lod=0)
    hz = [h.dimensions.z for h in heroes]
    for o in objs:
        k = int(np.argmin([abs(z - o.dimensions.z) for z in hz]))
        h = heroes[k]
        i, dist, lat = cl.nearest(o.location.x, o.location.y)
        use_lod = dist > TREE_LOD_DIST and o not in heroes
        sx = o.dimensions.x / h.dimensions.x
        sz = o.dimensions.z / h.dimensions.z
        sxy = (o.dimensions.x / h.dimensions.x + o.dimensions.y / h.dimensions.y) / 2
        if o is not h:
            o.data = lods[h.data] if use_lod else h.data
            o.scale = (o.scale.x * sxy, o.scale.y * sxy, o.scale.z * sz)
            o.rotation_euler.z = rnd.uniform(0, math.tau)
        tot['lod' if use_lod else 'full'] += 1
        TREE_MAP[o.name] = (h.data, lods[h.data])
    TREE_HEROES[label] = [(h.data, lods[h.data]) for h in heroes]
    return dict(trees=len(objs), heroes=n_heroes, **tot)


LOG['trees'] = {}
for lab, g, nh in (('sakura', sak, 4), ('canopy', can, 3), ('cedar', ced, 2), ('framing', frm, 2)):
    if g:
        LOG['trees'][lab] = instance_trees(g, lab, nh)
log('trees', LOG['trees'])

# =============================================================================================== 3. dressing: road, run-off, grid, fence, banners
road = bpy.data.objects['Continuous road | 18m | source spline']
rm = road.data.materials[0]
b = rm.node_tree.nodes['Principled BSDF']
b.inputs['Roughness'].default_value = 0.16
try:
    b.inputs['Coat Weight'].default_value = 0.55
    b.inputs['Coat Roughness'].default_value = 0.05
except KeyError:
    pass
# puddle-like variation: drive roughness with noise so the reflections break up like wet tarmac
nt = rm.node_tree
if not nt.nodes.get('v12 wet'):
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.name = 'v12 wet'; nz.inputs['Scale'].default_value = 0.09; nz.inputs['Detail'].default_value = 3
    cr = nt.nodes.new('ShaderNodeMapRange'); cr.inputs['From Min'].default_value = 0.4; cr.inputs['From Max'].default_value = 0.6
    cr.inputs['To Min'].default_value = 0.06; cr.inputs['To Max'].default_value = 0.34
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], cr.inputs['Value'])
    for l in list(b.inputs['Roughness'].links):
        nt.links.remove(l)
    nt.links.new(cr.outputs['Result'], b.inputs['Roughness'])

m_pb = mat('V12 run-off blue', (0.02, 0.18, 0.7), 0.45, emit=(0.02, 0.25, 0.9), strength=0.35)
m_pp = mat('V12 run-off pink', (0.9, 0.12, 0.45), 0.45, emit=(0.9, 0.1, 0.4), strength=0.35)
m_py = mat('V12 run-off yellow', (0.95, 0.72, 0.05), 0.45, emit=(0.9, 0.6, 0.05), strength=0.3)
m_pw = mat('V12 paint white', (0.85, 0.85, 0.82), 0.55, emit=(1, 1, 0.95), strength=0.12)

# 3a painted run-off bands (blue / pink / yellow like ref 03) along the corner stretches of the v9 run-off aprons + the start straight
RUNOFF_RANGES = [(150, 188), (228, 240), (389, 402), (589, 650), (862, 902), (940, 970), (1198, 1210), (1283, 1288)]
# v9 ranges are in source-index space (1440); convert to our stations through the shared arc length ratio
RUNC = newcoll('V12 | painted run-off bands')
bm = bmesh.new()
for a, bb in RUNOFF_RANGES:
    i0, i1 = int(a / 1440 * M), int(bb / 1440 * M)
    for side in (-1, 1):
        for (l0, l1, mi) in ((9.3, 10.4, 0), (10.4, 11.3, 1), (11.3, 12.2, 2)):
            ribbon(bm, i0, i1, side, l0, l1, 0.05, mi)
i0, i1 = s0 - 60, s0 + 50            # start straight: a blue-pink-yellow bar between road edge and the fence
for side in (-1, 1):
    for (l0, l1, mi) in ((9.3, 10.4, 0), (10.4, 11.3, 1), (11.3, 12.2, 2)):
        ribbon(bm, i0, i1, side, l0, l1, 0.05, mi)
to_obj('V12 painted run-off bands', bm, [m_pb, m_pp, m_py], RUNC)

# 3b grid boxes: two columns, 8 rows, 8 m apart, plus the line itself
bm = bmesh.new()
for r in range(10):
    for col, lat in ((0, 3.0), (1, -3.0)):
        i = s0 - 2 - int(r * 8 / C.STEP) - col * 2
        ang = math.atan2(cl.T[i][1], cl.T[i][0])
        c_ = cl.at(i, lat, 0.0)
        z = c_[2] + 0.04
        for (dx, dy, sx, sy) in ((0, -1.05, 4.6, 0.12), (0, 1.05, 4.6, 0.12), (-2.3, 0, 0.12, 2.22), (2.3, 0, 0.12, 2.22)):
            box(bm, (c_[0] + dx * math.cos(ang) - dy * math.sin(ang), c_[1] + dx * math.sin(ang) + dy * math.cos(ang), z), sx, sy, 0.02, ang, 0)
box(bm, (*cl.at(s0, 0, 0.045)[:2], cl.at(s0, 0, 0)[2] + 0.04), 0.5, 17.4, 0.02, math.atan2(cl.T[s0][1], cl.T[s0][0]), 0)
to_obj('V12 painted grid boxes', bm, [m_pw], FENCEC)

# 3c catch fence: posts every 6 m + mesh + lit tops; banners with real sponsor boards; LED line on the wall
FI0, FI1 = s0 - 62, s0 + 52
bp = bmesh.new(); bt = bmesh.new(); bfm = bmesh.new()
for side in (-1, 1):
    for i in range(FI0, FI1, 3):
        p = cl.at(i, side * FENCE_LAT); ang = math.atan2(cl.T[i][1], cl.T[i][0])
        box(bp, (p[0], p[1], p[2]), 0.18, 0.18, 5.2, ang, 0)
        q = cl.at(i, side * FENCE_LAT, 5.2)
        box(bt, (q[0], q[1], q[2]), 0.26, 0.26, 0.22, ang, 0)
    sweep(bfm, FI0, FI1, side, [(FENCE_LAT, 1.4, 0), (FENCE_LAT, 5.1, 0)])
to_obj('V12 catch fence posts', bp, [m_steel], FENCEC)
to_obj('V12 catch fence lit post tops', bt, [m_ledc], FENCEC)
fo = to_obj('V12 catch fence mesh', bfm, [fence_mat()], FENCEC)
BRANDS = ['sony', 'emirates', 'cocacola', 'hsbc', 'pirelli', 'redbull', 'rolex', 'shell']
BDIR = C.T.parents[1] / 'assets' / 'sponsors' / 'boards'
for bi, brand in enumerate(BRANDS):
    bm = bmesh.new()
    for side in (-1, 1):
        n_pan = 0
        for i in range(FI0, FI1 - 3, 3):
            if (i // 3 + (0 if side > 0 else 2)) % len(BRANDS) != bi:
                continue
            a, b_ = cl.at(i, side * (FENCE_LAT - 0.12), 1.15), cl.at(i + 3, side * (FENCE_LAT - 0.12), 1.15)
            a2, b2 = a + np.array([0, 0, 1.0]), b_ + np.array([0, 0, 1.0])
            pts = [a, b_, b2, a2] if side > 0 else [b_, a, a2, b2]
            uvs = [(0, 0), (1, 0), (1, 1), (0, 1)] if side > 0 else [(1, 0), (0, 0), (0, 1), (1, 1)]
            quad(bm, [tuple(p) for p in pts], uvs, 0)
    if len(bm.verts):
        to_obj(f'V12 sponsor banner | {brand}', bm, [img_mat(f'V12 board {brand}', BDIR / f'{brand}-6000.png', 0.6)], FENCEC)
    else:
        bm.free()
bm = bmesh.new()
for side in (-1, 1):
    ribbon(bm, FI0, FI1, side, FENCE_LAT - 0.3, FENCE_LAT - 0.12, 1.12, 0)
    ribbon(bm, FI0, FI1, side, FENCE_LAT - 0.3, FENCE_LAT - 0.12, 2.18, 0)
to_obj('V12 fence LED lines', bm, [m_ledp], FENCEC)

# 3d start gantry + big screens (road-spanning on purpose: a gantry, not a stand)
bm = bmesh.new()
gc = cl.at(s0, 0, 0)
gang = math.atan2(cl.T[s0][1], cl.T[s0][0])
for side in (-1, 1):
    for dx in (-0.8, 0.8):
        p = cl.at(s0, side * 15.0, 0)
        box(bm, (p[0] + dx * math.cos(gang), p[1] + dx * math.sin(gang), p[2]), 0.45, 0.45, 12.4, gang, 0)
    p = cl.at(s0, side * 15.0, 12.0)
    box(bm, (p[0], p[1], p[2]), 1.0, 2.2, 0.8, gang, 0)
# horizontal truss: 3 chords
for dz in (10.6, 11.6, 12.4):
    for lat_a in np.arange(-15, 15, 1.5):
        a, b_ = cl.at(s0, lat_a, dz), cl.at(s0, lat_a + 1.5, dz)
        box(bm, tuple((a + b_) / 2 - np.array([0, 0, 0.0])), 0.18, 1.5 + 0.0, 0.18, math.atan2(b_[1] - a[1], b_[0] - a[0]) + 0, 0)
to_obj('V12 start gantry truss', bm, [m_steel], GANTRYC)
bm = bmesh.new()
for lat_a in np.arange(-13, 13.1, 1.0):                         # light bars under the truss
    p = cl.at(s0, lat_a, 10.25)
    box(bm, tuple(p), 0.5, 0.4, 0.22, gang, 0)
to_obj('V12 gantry light bar', bm, [m_flood], GANTRYC)
# two big screens facing the approach (-x = backwards along the track), content: scanlines + Japanese title on emission text
scr = mat('V12 big screen', (0.02, 0.03, 0.05), 0.2)
nt = scr.node_tree; b = nt.nodes['Principled BSDF']
gr = nt.nodes.new('ShaderNodeTexGradient'); uvn = nt.nodes.new('ShaderNodeTexCoord')
cr = nt.nodes.new('ShaderNodeValToRGB')
cr.color_ramp.elements[0].color = (0.9, 0.05, 0.5, 1); cr.color_ramp.elements[1].color = (0.05, 0.75, 1.0, 1)
nt.links.new(uvn.outputs['UV'], gr.inputs['Vector']); nt.links.new(gr.outputs['Fac'], cr.inputs['Fac'])
wv = nt.nodes.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.inputs['Scale'].default_value = 40; wv.bands_direction = 'Y'
mxn = nt.nodes.new('ShaderNodeMix'); mxn.data_type = 'RGBA'; mxn.blend_type = 'MULTIPLY'; mxn.inputs[0].default_value = 0.35
nt.links.new(uvn.outputs['UV'], wv.inputs['Vector']); nt.links.new(cr.outputs[0], mxn.inputs[6]); nt.links.new(wv.outputs['Color'], mxn.inputs[7])
nt.links.new(mxn.outputs[2], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 1.6
bm = bmesh.new()
for lat_c in (-6.6, 6.6):
    p0, p1 = cl.at(s0, lat_c - 3.2, 5.3), cl.at(s0, lat_c + 3.2, 5.3)
    off = -cl.T[s0] * 0.6
    quad(bm, [tuple(p0 + off), tuple(p1 + off), tuple(p1 + off + np.array([0, 0, 4.0])), tuple(p0 + off + np.array([0, 0, 4.0]))], [(1, 0), (0, 0), (0, 1), (1, 1)], 0)
to_obj('V12 gantry big screens', bm, [scr], GANTRYC)
# Japanese banner text on the gantry
FB = bpy.data.fonts.load(r'C:\Windows\Fonts\YuGothB.ttc')      # Yu Gothic Bold: neon, race and wayfinding type (full JIS kanji + kana)
FM = bpy.data.fonts.load(r'C:\Windows\Fonts\YuGothM.ttc')      # Yu Gothic Medium: shrine, gate and lantern text
fnt = FB


def frot(d):
    """rotation that stands a text object up and makes it read from the side its direction d (unit, XY) points to"""
    return (math.pi / 2, 0, math.atan2(d[0], -d[1]))


for o in sc.objects:       # every existing sign / board / wayfinding text gets a real Japanese face (v10 used MS Gothic)
    if o.type == 'FONT':
        o.data.font = FM if any(k in o.name.lower() for k in ('lantern', 'gate', 'shrine', 'romon', 'castle', 'temple')) else FB

# text cost: v10's 3D text was 8k triangles per label. Coarser curve resolution + identical labels sharing one curve datablock (instancing).
canon = {}
for o in sc.objects:
    if o.type == 'FONT':
        cu = o.data
        cu.resolution_u = 3
        cu.render_resolution_u = 3
        cu.bevel_resolution = 0
        key = (cu.body, round(cu.size, 3), round(cu.extrude, 3), round(cu.bevel_depth, 3), cu.align_x, cu.align_y, cu.font.name,
               tuple(m.name if m else None for m in cu.materials), round(cu.space_line, 2), round(cu.space_character, 2), round(cu.offset_y, 2))
        if key in canon:
            o.data = canon[key]
        else:
            canon[key] = cu
LOG['text datablocks after sharing'] = len(canon)
def text_obj(name, txt, loc, rot, size, mat_, coll, extrude=0.03, align='CENTER', font=None):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = txt; cu.font = font or fnt; cu.size = size; cu.extrude = extrude; cu.resolution_u = 3; cu.render_resolution_u = 3; cu.align_x = align; cu.align_y = 'CENTER'
    cu.materials.append(mat_)
    ob = bpy.data.objects.new(name, cu)
    ob.location = loc; ob.rotation_euler = rot
    coll.objects.link(ob)
    return ob
m_txtw = glow('V12 text white neon', (1.0, 0.95, 0.9), 12.0)
m_txtp = glow('V12 text pink neon', (1.0, 0.15, 0.55), 14.0)
m_txtc = glow('V12 text cyan neon', (0.1, 0.9, 1.0), 14.0)
fwd = Vector(cl.T[s0])
text_obj('V12 gantry title', '東京 ウルトラック GP', Vector(cl.at(s0, 0, 11.6)) - fwd * 0.4, frot(-fwd), 1.2, m_txtw, GANTRYC)
text_obj('V12 gantry screen left', 'スタート', Vector(cl.at(s0, -6.6, 7.3)) - fwd * 0.7, frot(-fwd), 1.4, m_txtc, GANTRYC)
text_obj('V12 gantry screen right', '東京', Vector(cl.at(s0, 6.6, 7.3)) - fwd * 0.7, frot(-fwd), 1.8, m_txtp, GANTRYC)
for lat_c in (-6.6, 6.6):
    new_light(f'gantry screen glow {lat_c}', 'AREA', Vector(cl.at(s0, lat_c, 6.0)) - fwd * 4, 40000, (0.7, 0.4, 1.0), size=6, coll=GANTRYC, rot=(0, math.radians(90), gang + math.pi)) if False else None
log('gantry, fence, grid done')

# save progress marker, remaining parts in the second half of the file
exec(compile(open(Path(__file__).with_name('art_v12_part2.py')).read(), 'art_v12_part2.py', 'exec'))
