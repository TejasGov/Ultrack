"""Looks at the downloaded scans before any is chosen: logs each model's structure and renders it beside a 1.8 m figure -> out/trees/look_<id>.png. One quick EEVEE still each.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/qingshan/tree_look.py -Log D:/RaceUltimate/tracks/qingshan/out/trees/look.log"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
H = Path(r'D:/RaceUltimate/tracks/qingshan'); OUT = H / 'out' / 'trees'; OUT.mkdir(parents=True, exist_ok=True); PH = Path(r'D:/RaceUltimate/assets/polyhaven')
IDS = ['tree_small_02', 'island_tree_01', 'island_tree_02', 'jacaranda_tree', 'shrub_02', 'shrub_03', 'fern_02']
sc = bpy.context.scene
ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in ids else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 720, 720
sc.view_settings.view_transform = 'AgX'
try: sc.eevee.taa_render_samples = 8
except Exception: pass
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(str(PH / 'qwantani_noon_puresky/qwantani_noon_puresky_2k.hdr')); nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.rotation_euler = (math.radians(50), 0, math.radians(320)); sun.data.energy = 3.0
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50; cam.data.clip_end = 3000
report = {}
for aid in IDS:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(next((H / 'source' / aid).glob('*.gltf'))))
    new = [o for o in bpy.data.objects if o not in before]; dg = bpy.context.evaluated_depsgraph_get()
    meshes = [o for o in new if o.type == 'MESH']; lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    for o in meshes:
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    size = hi - lo; report[aid] = dict(size=[round(a, 2) for a in size], objects=len(meshes), parts=[dict(name=o.name, tris=sum(len(p.vertices) - 2 for p in o.data.polygons), mats=[m.name for m in o.data.materials if m], users=o.data.users) for o in sorted(meshes, key=lambda o: -len(o.data.polygons))[:6]])
    print(aid, report[aid], flush=True)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=1.8, location=(lo.x - 1.5, (lo.y + hi.y) / 2, lo.z + 0.9)); fig = bpy.context.object
    bpy.ops.mesh.primitive_plane_add(size=max(size.x, size.y, size.z) * 3, location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)); gr = bpy.context.object
    mid = (lo + hi) / 2; d = max(size) * 2.6; cam.location = mid + Vector((0, -d, size.z * .12)); cam.rotation_euler = (mid - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / f'look_{aid}.png'); bpy.ops.render.render(write_still=True)
    for o in new + [fig, gr]: bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
(OUT / 'look.json').write_text(json.dumps(report, indent=1), encoding='utf8')
print('done', flush=True)
