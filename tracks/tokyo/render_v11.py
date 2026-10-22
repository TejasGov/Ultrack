"""EEVEE previews of out/tokyo_game_v11.blend (low samples, no Cycles). Not saved back.
powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/render_v11.py -Rest start,aerial,pano,stands
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
O = Path(__file__).resolve().parent / 'out'
bpy.ops.wm.open_mainfile(filepath=str(O / 'tokyo_game_v11.blend'))
sc = bpy.context.scene
names = (sys.argv[sys.argv.index('--') + 1].split(',') if '--' in sys.argv else ['start'])
sc.render.engine = 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = 12
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.view_settings.view_transform = 'AgX'
w = bpy.data.worlds.new('preview'); w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (0.05, 0.08, 0.16, 1); bg.inputs[1].default_value = 1.2
sc.world = w
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 2.2; sun.data.color = (0.6, 0.7, 1.0)
sun.rotation_euler = (math.radians(55), 0, math.radians(120)); sc.collection.objects.link(sun)
fuji = next(o for o in bpy.data.objects if o.name == 'skyline_fuji')
fc = sum((fuji.matrix_world @ Vector(c) for c in fuji.bound_box), Vector()) / 8
V = {
 'start': ((-45, 0, 2.4), (150, 0, 8), 40),
 'aerial': ((-90, -40, 38), (60, 20, 4), 30),
 'pano': ((60, 0, 6), (fc.x, fc.y, 120), 34),
 'pano2': ((60, 0, 6), (-900, 2500, 250), 34),
 'stands': ((-180, -90, 45), (-120, 120, 6), 28),
 'trees': ((260, -230, 40), (330, -120, 10), 30),
}
import json
_t = json.load(open(O / 'track.json'))
def road(i, back=10, up=3.5, ahead=70):
    c = _t['centerline']; n = len(c); g = lambda k: Vector((c[k % n][0], -c[k % n][2], c[k % n][1]))
    d = (g(i + 1) - g(i - 1)).normalized()
    return (tuple(g(i) - d * back + Vector((0, 0, up))), tuple(g(i) + d * ahead), 40)
for _i in range(0, 1440, 60):
    V[f'road{_i}'] = road(_i)
V['overview'] = ((0, -300, 2600), (0, 40, 0), 28)
_so = bpy.data.objects['sign_atlas_quads']
_f = _so.data.polygons[150]
_p = _so.matrix_world @ _f.center
_n = (_so.matrix_world.to_3x3() @ _f.normal).normalized()
V['signs'] = (tuple(_p + _n * 14 + Vector((0, 0, 2))), tuple(_p), 35)
_bo = [o for o in bpy.data.objects if o.name.startswith('board_')][40]
_bn = _bo.matrix_world.to_3x3() @ Vector((0, -1, 0))
V['board'] = (tuple(_bo.location + _bn * 9 + Vector((0, 0, 1.5))), tuple(_bo.location + Vector((0, 0, 0.6))), 35)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.clip_end = 20000
for n in names:
    loc, tgt, lens = V[n]
    cam.location = loc; cam.data.lens = lens
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(O / f'v11-{n}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', n, flush=True)
