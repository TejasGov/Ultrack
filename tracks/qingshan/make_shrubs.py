"""The forest edge's understorey: Poly Haven shrub_02, fern_02 parts rendered unlit (real leaves, with baked leaf-level depth) to one atlas, each a 3-plane crossed card of 6 tris -> tex/trees/understorey.png, out/trees/understorey.blend.
Nobody gets closer than the run-off, and a car passes at speed, so cards are enough.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/qingshan/make_shrubs.py -Log D:/RaceUltimate/tracks/qingshan/out/trees/shrubs.log"""
import bpy, bmesh, math
from pathlib import Path
import numpy as np
from mathutils import Vector
H = Path(r'D:/RaceUltimate/tracks/qingshan'); OUT = H / 'out' / 'trees'; TEX = H / 'tex' / 'trees'; CELL = 512
sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]; sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in ids else 'BLENDER_EEVEE'
for aid in ('shrub_02', 'fern_02'): bpy.ops.import_scene.gltf(filepath=str(next((H / 'source' / aid).glob('*.gltf'))))
parts = sorted([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: o.name); print([o.name for o in parts], flush=True)
done = set()
for o in parts:
    for m in o.data.materials:
        if m.name in done: continue
        done.add(m.name); nt = m.node_tree; P = next(q for q in nt.nodes if q.type == 'BSDF_PRINCIPLED'); sk = P.inputs['Base Color']; src = sk.links[0].from_socket if sk.is_linked else None
        geo = nt.nodes.new('ShaderNodeNewGeometry'); d2 = nt.nodes.new('ShaderNodeVectorMath'); d2.operation = 'DOT_PRODUCT'; nt.links.new(geo.outputs['Normal'], d2.inputs[0]); nt.links.new(geo.outputs['Incoming'], d2.inputs[1]); ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; nt.links.new(d2.outputs['Value'], ab.inputs[0])
        fc = nt.nodes.new('ShaderNodeMapRange'); fc.inputs['To Min'].default_value = 0.42; nt.links.new(ab.outputs[0], fc.inputs['Value']); mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
        if src: nt.links.new(src, mx.inputs[6]); nt.links.remove(sk.links[0])
        else: mx.inputs[6].default_value = sk.default_value
        nt.links.new(fc.outputs[0], mx.inputs[7]); nt.links.new(mx.outputs[2], P.inputs['Emission Color']); P.inputs['Emission Strength'].default_value = 1; sk.default_value = (0, 0, 0, 1); P.inputs['Specular IOR Level'].default_value = 0
w = bpy.data.worlds.new('none'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0
sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.render.resolution_x = sc.render.resolution_y = CELL; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
try: sc.eevee.taa_render_samples = 16
except Exception: pass
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.clip_start = .01; cam.data.clip_end = 100
def bbox(o): q = [o.matrix_world @ Vector(c) for c in o.bound_box]; return Vector((min(p.x for p in q), min(p.y for p in q), min(p.z for p in q))), Vector((max(p.x for p in q), max(p.y for p in q), max(p.z for p in q)))
use = parts[:8]; atlas = np.zeros((CELL * 2, CELL * 4, 4), dtype=np.float32); info = []
for q, o in enumerate(use):
    for x in parts: x.hide_render = x is not o
    lo, hi = bbox(o); mid = (lo + hi) / 2; half = max((hi - lo).x, (hi - lo).y, (hi - lo).z) * .54; cam.location = mid + Vector((0, -20, 0)); cam.rotation_euler = (math.pi / 2, 0, 0); cam.data.ortho_scale = half * 2; p = OUT / f'_s{q}.png'; sc.render.filepath = str(p); bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(str(p)); a = np.array(im.pixels[:], dtype=np.float32).reshape(CELL, CELL, 4)[::-1].copy(); bpy.data.images.remove(im); p.unlink(); rgb, cov = a[..., :3].copy(), (a[..., 3] > .02).astype(np.float32); rgb *= cov[..., None]
    for _ in range(8):
        s_ = sum(np.roll(rgb, k, ax) for k in (-1, 1) for ax in (0, 1)); c_ = sum(np.roll(cov, k, ax) for k in (-1, 1) for ax in (0, 1)); new = (cov == 0) & (c_ > 0); rgb[new] = s_[new] / c_[new, None]; cov[new] = 1
    if (cov > 0).any(): rgb[cov == 0] = rgb[cov > 0].mean(0)
    a[..., :3] = rgb; atlas[(q // 4) * CELL:(q // 4 + 1) * CELL, (q % 4) * CELL:(q % 4 + 1) * CELL] = a; info.append((o.name, half, (mid.z - lo.z)))
im = bpy.data.images.new('understorey', CELL * 4, CELL * 2, alpha=True); im.pixels.foreach_set(atlas[::-1].ravel()); im.filepath_raw = str(TEX / 'understorey.png'); im.file_format = 'PNG'; im.save()
for x in parts: bpy.data.objects.remove(x, do_unlink=True)
m = bpy.data.materials.new('TREE understorey'); m.use_nodes = True; nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = im; rd = nt.nodes.new('ShaderNodeMath'); rd.operation = 'ROUND'; nt.links.new(it.outputs['Color'], P.inputs['Base Color']); nt.links.new(it.outputs['Alpha'], rd.inputs[0]); nt.links.new(rd.outputs[0], P.inputs['Alpha']); P.inputs['Roughness'].default_value = .75; P.inputs['Specular IOR Level'].default_value = .2; m.surface_render_method = 'DITHERED'
for q, (name, half, zmid) in enumerate(info):
    bm = bmesh.new(); uv = bm.loops.layers.uv.verify(); cu, cv = (q % 4) / 4, (1 - q // 4) / 2
    for a_ in (0, 60, 120):
        th = math.radians(a_); dx, dy = math.cos(th) * half, math.sin(th) * half; z0 = zmid - half
        f_ = bm.faces.new([bm.verts.new(p) for p in ((-dx, -dy, z0), (dx, dy, z0), (dx, dy, z0 + 2 * half), (-dx, -dy, z0 + 2 * half))])
        for l, (a2, b2) in zip(f_.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uv].uv = (cu + a2 / 4, cv + b2 / 2)
    me = bpy.data.meshes.new(f'SHRUB {q}'); bm.to_mesh(me); bm.free(); me.materials.append(m); ob = bpy.data.objects.new(f'SHRUB {q}', me); sc.collection.objects.link(ob); print(name, round(half, 2), flush=True)
bpy.data.objects.remove(cam, do_unlink=True); bpy.ops.outliner.orphans_purge(do_recursive=True); bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'understorey.blend')); print('done', flush=True)
