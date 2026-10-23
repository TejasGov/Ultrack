"""v13.1: the skyline strip is used ONCE as a partial arc (Tokyo Tower appears once), Fuji opposite, hills and haze everywhere else.

    powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/pano_v13_1.py

Reads out/tokyo_v13.blend (kept), saves out/tokyo_v13_1.blend. No export.
Arc: R 7000 m, about 758 m tall (tallest tip 6.0 degrees from 1.2 m), 9.6:1 strip => about 56 degree arc, the image NOT squashed or repeated.
Bearings use theta = clockwise from north: east 90, south-east 135. The start straight heads east, the bridge views look south-east, so the
arc starts at theta 82; the Tokyo Tower sits at u = 0.148 of the strip (theta about 90, dead ahead on the start straight). Fuji card: north.
"""
import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v12_common as C  # noqa: E402
import v13_kit as K  # noqa: E402

O = C.O
SRC, DST = O / 'tokyo_v13.blend', O / 'tokyo_v13_1.blend'
bpy.ops.wm.open_mainfile(filepath=str(SRC))
sc = bpy.context.scene
cl = C.CL()
K.init(sc, cl)
rnd = random.Random(131)
TEX = C.T / 'textures' / 'panorama'
LOG = {}

R_ARC = 7000.0
TALLEST, TYP = 0.970, 0.758
ang_tip = 6.0
H = R_ARC * math.tan(math.radians(ang_tip)) / TALLEST          # so the tallest tip reaches 6 degrees
ARC_LEN = 9.6 * H
ARC_DEG = math.degrees(ARC_LEN / R_ARC)
TH0 = 82.0
TH1 = TH0 + ARC_DEG
cx, cy = float(cl.P[:, 0].mean()), float(cl.P[:, 1].mean())
LOG['arc'] = dict(radius_m=R_ARC, height_m=round(H), length_m=round(ARC_LEN), arc_deg=round(ARC_DEG, 1), theta_from=TH0, theta_to=round(TH1, 1),
                  bearing_math_deg_from=round(90 - TH1, 1), bearing_math_deg_to=round(90 - TH0, 1),
                  tallest_tip_deg=round(math.degrees(math.atan2(TALLEST * H - 40 - 1.2, R_ARC)), 1),
                  typical_peak_deg=round(math.degrees(math.atan2(TYP * H - 40 - 1.2, R_ARC)), 1),
                  tokyo_tower_theta=round(TH0 + 0.148 * ARC_DEG, 1), repeats=1)

for o in sc.objects:          # retire the closed 6x mirrored ring
    if o.name in ('V13 skyline_band', 'V12 skyline_band'):
        K.hide(o)
SKY = K.newcoll('V13.1 | sky backdrop')


def arc_material(name, png, strength_k=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.surface_render_method = 'DITHERED'
    nt = m.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    tx = N('ShaderNodeTexImage')
    tx.image = bpy.data.images.load(str(png), check_existing=True)
    tx.extension = 'EXTEND'
    uvn = N('ShaderNodeTexCoord')
    sp = N('ShaderNodeSeparateXYZ')
    mr = N('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.0
    mr.inputs['From Max'].default_value = 0.55
    bw = N('ShaderNodeRGBToBW')
    inv = N('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    ds = N('ShaderNodeMath')
    ds.operation = 'MULTIPLY'
    ds.inputs[1].default_value = 0.7
    mixc = N('ShaderNodeMix')
    mixc.data_type = 'RGBA'
    tint = N('ShaderNodeMix')
    tint.data_type = 'RGBA'
    tint.inputs[7].default_value = (0.03, 0.035, 0.08, 1)
    dk = N('ShaderNodeMath')
    dk.operation = 'MULTIPLY'
    dk.inputs[1].default_value = 0.6
    em = N('ShaderNodeEmission')
    trn = N('ShaderNodeBsdfTransparent')
    mxs = N('ShaderNodeMixShader')
    va = N('ShaderNodeVertexColor')
    va.layer_name = 'Col'
    mul = N('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    es = N('ShaderNodeMath')
    es.operation = 'MULTIPLY_ADD'
    es.inputs[1].default_value = strength_k
    es.inputs[2].default_value = strength_k
    out = N('ShaderNodeOutputMaterial')
    L = nt.links.new
    L(uvn.outputs['UV'], sp.inputs[0])
    L(sp.outputs['Y'], mr.inputs['Value'])
    L(tx.outputs['Color'], bw.inputs['Color'])
    L(mr.outputs['Result'], inv.inputs[1])
    L(inv.outputs[0], ds.inputs[0])
    L(ds.outputs[0], mixc.inputs[0])
    L(tx.outputs['Color'], mixc.inputs[6])
    L(bw.outputs[0], mixc.inputs[7])
    L(inv.outputs[0], dk.inputs[0])
    L(dk.outputs[0], tint.inputs[0])
    L(mixc.outputs[2], tint.inputs[6])
    L(tint.outputs[2], em.inputs['Color'])
    L(mr.outputs['Result'], es.inputs[0])
    L(es.outputs[0], em.inputs['Strength'])
    L(tx.outputs['Alpha'], mul.inputs[0])
    L(va.outputs['Alpha'], mul.inputs[1])
    L(mul.outputs[0], mxs.inputs['Fac'])
    L(trn.outputs[0], mxs.inputs[1])
    L(em.outputs[0], mxs.inputs[2])
    L(mxs.outputs[0], out.inputs[0])
    return m


def build_arc(name, mat, radius):
    SEG = 220
    bm = bmesh.new()
    rows = [(-40.0, 0.0, 0.0), (H * 0.03, 0.03, 1.0), (H * 0.80, 0.80, 1.0), (H, 1.0, 0.0)]
    grid = []
    for (yy, vv, al) in rows:
        row = []
        for s in range(SEG + 1):
            th = math.radians(TH0 + (TH1 - TH0) * s / SEG)
            row.append(bm.verts.new((math.sin(th) * radius, math.cos(th) * radius, yy)))
        grid.append(row)
    lay = bm.loops.layers.uv.verify()
    col = bm.loops.layers.float_color.new('Col')

    def hfade(t):          # soft ends: 14 % of the arc each side fades into the hills and haze
        a = max(0.0, min(1.0, min(t, 1 - t) / 0.14))
        return a * a * (3 - 2 * a)
    for r in range(len(grid) - 1):
        for s in range(SEG):
            t0, t1 = s / SEG, (s + 1) / SEG
            f = bm.faces.new([grid[r][s], grid[r + 1][s], grid[r + 1][s + 1], grid[r][s + 1]])
            cs = [(t0, rows[r]), (t0, rows[r + 1]), (t1, rows[r + 1]), (t1, rows[r])]
            for l, (t, rw) in zip(f.loops, cs):
                l[lay].uv = (t, rw[1])                 # u grows clockwise (to the right when facing outward): the strip is not mirrored
                l[col] = (1, 1, 1, rw[2] * hfade(t))
    ob = K.to_obj(name, bm, [mat], SKY, (cx, cy, 0), smooth=True)
    ob.visible_shadow = False
    return ob


night = build_arc('V13.1 skyline arc night', arc_material('V13.1 skyline arc night', TEX / 'tokyo_skyline_night.png'), R_ARC)
day = build_arc('V13.1 skyline arc day', arc_material('V13.1 skyline arc day', TEX / 'tokyo_skyline_day.png', 0.9), R_ARC - 2)
day.hide_render = True          # day look: unhide this one and hide the night arc
day.hide_viewport = True


def ridge(name, radius, base, amp, seed, rgb, em, coll):
    r = random.Random(seed)
    ph = [r.uniform(0, 6.28) for _ in range(6)]
    n = 720
    bm = bmesh.new()
    top, bot = [], []
    for k in range(n):
        th = 2 * math.pi * k / n
        h = (base + amp * (0.5 + 0.5 * math.sin(2 * th + ph[0])) + 0.55 * amp * math.sin(5 * th + ph[1]) + 0.35 * amp * math.sin(11 * th + ph[2])
             + 0.2 * amp * math.sin(29 * th + ph[3]) + 0.1 * amp * math.sin(61 * th + ph[4]))
        h = max(h, 6.0)
        x, y = math.sin(th) * radius, math.cos(th) * radius
        top.append(bm.verts.new((x, y, h)))
        bot.append(bm.verts.new((x, y, -60.0)))
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new([bot[k], bot[j], top[j], top[k]])
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Emission Color'].default_value = (*rgb, 1)
    b.inputs['Emission Strength'].default_value = em
    b.inputs['Roughness'].default_value = 1.0
    ob = K.to_obj(name, bm, [m], coll, (cx, cy, 0), smooth=True, merge=0)
    ob.visible_shadow = False
    return ob


ridge('V13.1 far hills', 7400.0, 40.0, 70.0, 7, (0.028, 0.03, 0.06), 0.55, SKY)
ridge('V13.1 near hills', 6300.0, 12.0, 38.0, 11, (0.010, 0.012, 0.026), 0.35, SKY)

hz = bpy.data.materials.new('V13.1 horizon haze')
hz.use_nodes = True
hz.surface_render_method = 'BLENDED'
nt = hz.node_tree
nt.nodes.clear()
gen = nt.nodes.new('ShaderNodeTexCoord')
sz = nt.nodes.new('ShaderNodeSeparateXYZ')
mr = nt.nodes.new('ShaderNodeMapRange')
mr.inputs['From Min'].default_value = 0.0
mr.inputs['From Max'].default_value = 1.0
mr.inputs['To Min'].default_value = 0.55
mr.inputs['To Max'].default_value = 0.0
em = nt.nodes.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (0.09, 0.07, 0.15, 1)
em.inputs['Strength'].default_value = 1.0
tr = nt.nodes.new('ShaderNodeBsdfTransparent')
mx = nt.nodes.new('ShaderNodeMixShader')
out = nt.nodes.new('ShaderNodeOutputMaterial')
L = nt.links.new
L(gen.outputs['Generated'], sz.inputs[0])
L(sz.outputs['Z'], mr.inputs['Value'])
L(mr.outputs['Result'], mx.inputs['Fac'])
L(tr.outputs[0], mx.inputs[1])
L(em.outputs[0], mx.inputs[2])
L(mx.outputs[0], out.inputs[0])
bm = bmesh.new()
Rh, Hh, n = 6900.0, 480.0, 180
for k in range(n):
    th0, th1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
    a = bm.verts.new((math.sin(th0) * Rh, math.cos(th0) * Rh, 0))
    b_ = bm.verts.new((math.sin(th1) * Rh, math.cos(th1) * Rh, 0))
    c_ = bm.verts.new((math.sin(th1) * Rh, math.cos(th1) * Rh, Hh))
    d_ = bm.verts.new((math.sin(th0) * Rh, math.cos(th0) * Rh, Hh))
    bm.faces.new([a, b_, c_, d_])
haze = K.to_obj('V13.1 horizon haze band', bm, [hz], SKY, (cx, cy, 0), merge=0)
haze.visible_shadow = False

# sparse distant low-rise lights on the hills, none inside the city arc (it has its own)
bm = bmesh.new()
nl = 0
for _ in range(1100):
    th = rnd.uniform(0, 360)
    if TH0 - 4 < th < TH1 + 4:
        continue
    near = rnd.random() < 0.5
    Rr = 6300.0 if near else 7350.0
    h = rnd.uniform(8, 36) if near else rnd.uniform(30, 90)
    thr = math.radians(th)
    p = Vector((math.sin(thr) * Rr + cx, math.cos(thr) * Rr + cy, h))
    tang = Vector((math.cos(thr), -math.sin(thr), 0))
    sz_ = rnd.uniform(9, 17)
    K.quad(bm, [p - tang * sz_ / 2, p + tang * sz_ / 2, p + tang * sz_ / 2 + Vector((0, 0, sz_ * 0.7)), p - tang * sz_ / 2 + Vector((0, 0, sz_ * 0.7))], mi=0)
    nl += 1
K.to_obj('V13.1 distant low-rise lights', bm, [K.glow('V13.1 distant lights', (1.0, 0.72, 0.4), 6.0)], SKY, merge=0).visible_shadow = False
LOG['distant lights'] = nl

# Fuji: bearing and size (card centre vs the circuit centre)
fuji = next(o for o in sc.objects if o.name.startswith('Mount Fuji'))
vs = np.array([list(fuji.matrix_world @ v.co) for v in fuji.data.vertices])
fc = vs.mean(0)
dist = math.hypot(fc[0] - cx, fc[1] - cy)
th_f = math.degrees(math.atan2(fc[0] - cx, fc[1] - cy)) % 360
summit = vs[:, 2].min() + 0.8138 * (vs[:, 2].max() - vs[:, 2].min())
LOG['fuji'] = dict(theta_clockwise_from_north=round(th_f, 1), bearing_math_deg=round(90 - th_f, 1), distance_m=round(dist), summit_z_m=round(float(summit)),
                   summit_elevation_deg=round(math.degrees(math.atan2(summit - 1.2, dist)), 1), width_m=round(float(vs[:, 0].max() - vs[:, 0].min())))
aim = Vector(cl.raw[295][:2]) - Vector(cl.raw[240][:2])
LOG['neon street view theta'] = round(math.degrees(math.atan2(aim.x, aim.y)) % 360, 1)

exec(compile(open(Path(__file__).with_name('pano_v13_1_garden.py'), encoding='utf-8').read(), 'pano_v13_1_garden.py', 'exec'))

# sweep cameras: 8 views at 45 degree steps from the start line at driver height
for k in range(8):
    th = math.radians(k * 45.0)
    loc = Vector(cl.at(cl.s0, 0, 1.6))
    cam = bpy.data.objects.new(f'V13.1 | sweep_{k * 45:03d}', bpy.data.cameras.new(f'sweep{k}'))
    sc.collection.objects.link(cam)
    cam.location = loc
    tgt = loc + Vector((math.sin(th), math.cos(th), 0.07)) * 100
    cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 28
    cam.data.clip_end = 30000
for k in range(8):       # the same sweep from 14 m up, above the stands (they block most of the driver-height horizon)
    th = math.radians(k * 45.0)
    loc = Vector(cl.at(cl.s0, 0, 14.0))
    cam = bpy.data.objects.new(f'V13.1 | sweephi_{k * 45:03d}', bpy.data.cameras.new(f'sweephi{k}'))
    sc.collection.objects.link(cam)
    cam.location = loc
    tgt = loc + Vector((math.sin(th), math.cos(th), 0.03)) * 100
    cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 28
    cam.data.clip_end = 30000
sc['v13_1'] = 'single skyline arc'
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(DST))
(O / 'v13_1-build.json').write_text(json.dumps(LOG, indent=1))
print('[v13.1]', json.dumps(LOG, indent=1))
