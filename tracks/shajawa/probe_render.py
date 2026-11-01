# render the kit's stand section from +x and from -x (EEVEE, small) to see which side the seats face
import bpy, math
from mathutils import Vector
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=r'D:/RaceUltimate/tracks/shajawa/source/modular_stadium/modular_stadium.glb')
for o in list(bpy.context.selected_objects):
    if o.type == 'MESH' and not (o.name.startswith('STADIUM_Both') and 'Props' not in o.name): bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 640, 360
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.rotation_euler = (0.8, 0.2, 0.5)
w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.5, 0.6, 0.8)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
for name, x in (('from_plus_x', 45), ('from_minus_x', -45)):
    cam.location = Vector((x, -20, 14)); d = Vector((0, 0, 5)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = rf'D:/RaceUltimate/tracks/shajawa/out/probe_{name}.png'; bpy.ops.render.render(write_still=True)
print('[probe] rendered', flush=True)
