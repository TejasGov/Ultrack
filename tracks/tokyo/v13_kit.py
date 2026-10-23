"""Small Blender build kit for the v13 pass (materials, bmesh boxes, text, lights). `init(sc, cl)` must be called first."""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sc = None
cl = None
FB = FM = None


def init(scene, centerline):
    global sc, cl, FB, FM
    sc, cl = scene, centerline
    FB = bpy.data.fonts.get('Yu Gothic Bold') or next((f for f in bpy.data.fonts if 'YuGothB' in f.filepath), None) or bpy.data.fonts.load(r'C:\Windows\Fonts\YuGothB.ttc')
    FM = next((f for f in bpy.data.fonts if 'YuGothM' in f.filepath), None) or bpy.data.fonts.load(r'C:\Windows\Fonts\YuGothM.ttc')


def newcoll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        sc.collection.children.link(c)
    return c


def hide(o):
    o.hide_render = True
    o.hide_viewport = True


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


def img_emit_mat(name, path, strength=1.5, rough=0.4):
    """image texture -> base colour and emission (backlit panel). The image slot is the node named 'IMG'."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.name = t.label = 'IMG'
    t.image = bpy.data.images.load(str(path), check_existing=True)
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = strength
    b.inputs['Roughness'].default_value = rough
    return m


def quad(bm, pts, uvs=None, mi=0):
    vs = [bm.verts.new(tuple(p)) for p in pts]
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
    cs, sn = math.cos(rot), math.sin(rot)

    def p(x, y, z):
        return (c[0] + x * cs - y * sn, c[1] + x * sn + y * cs, c[2] + z)
    hx, hy = sx / 2, sy / 2
    v = [p(-hx, -hy, 0), p(hx, -hy, 0), p(hx, hy, 0), p(-hx, hy, 0), p(-hx, -hy, sz), p(hx, -hy, sz), p(hx, hy, sz), p(-hx, hy, sz)]
    for idx in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        quad(bm, [v[i] for i in idx], mi=mi)


def seg_box(bm, a, b, w, h, mi=0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-4:
        return
    d.normalize()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-4:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(d).normalized()
    pts = []
    for p in (a, b):
        for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            pts.append(p + side * sx * w / 2 + up * sz * h / 2)
    for idx in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        quad(bm, [pts[i] for i in idx], mi=mi)


def to_obj(name, bm, mats, coll, loc=(0, 0, 0), smooth=False, merge=0.001):
    if merge:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
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


def frot(d):
    """stand a text object up so it reads from the side the unit XY vector d points to"""
    return (math.pi / 2, 0, math.atan2(d[0], -d[1]))


def text_obj(name, txt, loc, rot, size, mat_, coll, extrude=0.03, align='CENTER', font=None):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = txt
    cu.font = font or FB
    cu.size = size
    cu.extrude = extrude
    cu.resolution_u = 3
    cu.render_resolution_u = 3
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.materials.append(mat_)
    ob = bpy.data.objects.new(name, cu)
    ob.location = loc
    ob.rotation_euler = rot
    coll.objects.link(ob)
    return ob


def new_light(name, kind, loc, energy, color, size=1.0, coll=None, spot_deg=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    ld.use_shadow = False
    if kind == 'AREA':
        ld.size = size
    else:
        ld.shadow_soft_size = size
    if kind == 'SPOT':
        ld.spot_size = math.radians(spot_deg or 50)
        ld.spot_blend = 0.5
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    (coll or sc.collection).objects.link(ob)
    return ob


def aim(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat('-Z', 'Y').to_euler()


def sweep(bm, i0, i1, side, prof):
    """profile sweep along the resampled centerline (see art_v12.sweep)"""
    for i in range(i0, i1):
        for k in range(1, len(prof)):
            (l0, z0, _), (l1, z1, mi) = prof[k - 1], prof[k]
            a, b = cl.at(i, side * l0, z0), cl.at(i + 1, side * l0, z0)
            c_, d = cl.at(i + 1, side * l1, z1), cl.at(i, side * l1, z1)
            s_a, s_b = i * 2.0, (i + 1) * 2.0
            vlo, vhi = (l0, l1) if abs(z1 - z0) < 1e-6 else (z0, z1)
            pts = [a, b, c_, d] if side > 0 else [b, a, d, c_]
            uvs = [(s_a, vlo), (s_b, vlo), (s_b, vhi), (s_a, vhi)] if side > 0 else [(s_b, vlo), (s_a, vlo), (s_a, vhi), (s_b, vhi)]
            quad(bm, pts, uvs, mi)


def ribbon(bm, i0, i1, side, lat0, lat1, dz, mi=0):
    sweep(bm, i0, i1, side, [(lat0, dz, mi), (lat1, dz, mi)])


def superellipse(a, b, n=64, lobes=(0.0, 0.0), phase=0.0, p=2.4):
    """organic slab outline (x, y) around the origin"""
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        c, s = math.cos(t), math.sin(t)
        r = 1 + lobes[0] * math.sin(2 * t + phase) + lobes[1] * math.sin(3 * t + 2 * phase)
        x = a * r * np.sign(c) * abs(c) ** (2 / p)
        y = b * r * np.sign(s) * abs(s) ** (2 / p)
        pts.append((x, y))
    return pts
