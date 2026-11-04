"""Review of out/shajawa.blend: EEVEE stills from the road (small and quick: the PC overheats under long renders) -> out/review/<view>-<look>.png, and out/shajawa_review.blend,
the file to open and judge the track in: sky and sun on, collision hidden, the viewport set up for a 2 km site.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/shajawa/render_views.py -Blend D:/RaceUltimate/tracks/shajawa/out/shajawa.blend -Log D:/RaceUltimate/tracks/shajawa/render_views.log"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
H = Path(r'D:/RaceUltimate/tracks/shajawa'); OUT = H / 'out' / 'review'; OUT.mkdir(parents=True, exist_ok=True); PH = Path(r'D:/RaceUltimate/assets/polyhaven')
T = json.loads((H / 'out' / 'track.json').read_text()); C = [Vector((p[0], -p[2], p[1])) for p in T['centerline']]; n = len(C)
def at(i, up=0.0, lat=0.0):
    i %= n; t = (C[(i + 1) % n] - C[i - 1]).normalized(); nl = Vector((-t.y, t.x, 0)).normalized()
    return C[i] + nl * lat + Vector((0, 0, up))
sc = bpy.context.scene
ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in ids else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
try: sc.eevee.taa_render_samples = 16
except Exception: pass
sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = 0.0
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment'); nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
def look(name):
    env.image = bpy.data.images.load(str(PH / ('qwantani_noon_puresky/qwantani_noon_puresky_2k.hdr' if name == 'day' else 'belfast_sunset_puresky/belfast_sunset_puresky_2k.hdr')), check_existing=True)
    nt.nodes['Background'].inputs['Strength'].default_value = 0.8 if name == 'day' else 0.55
    # the game's sun (tracks.js sun: x and z of its direction, game z = -y here), high by day, low at dusk
    sun.rotation_euler = Vector((-0.55, 0.77, 1.1 if name == 'day' else 0.16)).to_track_quat('Z', 'Y').to_euler(); sun.data.energy = 3.4 if name == 'day' else 4.0
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 24; cam.data.clip_end = 20000
for o in bpy.data.collections['collision'].objects: o.hide_render = True
SEAT = 1.15; N = n
VIEWS = {       # the lap, from the driver's seat
    'a-main-right': (at(90, SEAT), at(120, 2.5, -14)),
    'b-east-end': (at(210, SEAT), at(240, 2.0, -6)),
    'c-east-exit': (at(330, SEAT), at(356, 1.5)),
    'd-t2': (at(395, SEAT), at(425, 1.0)),
    'e-infield': (at(515, SEAT), at(545, 1.5)),
    'e2-media': (at(490, SEAT), at(520, 5.0, 26)),
    'f-t5': (at(610, SEAT), at(640, 1.0)),
    'g-north-gate': (at(655, SEAT), at(682, 3.0)),
    'h-out-of-gate': (at(712, SEAT), at(740, 1.5)),
    'i-desert-out': (at(790, SEAT), at(820, 1.0)),
    'j-desert-s': (at(860, SEAT), at(890, 2.0, -8)),
    'k-far-sweep': (at(950, SEAT), at(978, 1.5)),
    'l-far-exit': (at(1075, SEAT), at(1105, 2.0)),
    'm-desert-home': (at(1170, SEAT), at(1200, 2.0)),
    'n-gate-in': (at(1235, SEAT), at(1262, 3.0)),
    'o-plan-air': (Vector((-300, 200, 1300)), Vector((-250, 200, 0))),
}
ONLY = bpy.app.driver_namespace.get('ONLY')
for name_, views in (('day', VIEWS), ('dusk', {k: VIEWS[k] for k in ('a-main-right', 'g-north-gate', 'k-far-sweep', 'n-gate-in')})):
    look(name_)
    for name, (p, q) in views.items():
        cam.location = p; cam.rotation_euler = (q - p).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = str(OUT / f'{name}-{name_}.png'); bpy.ops.render.render(write_still=True)
        print('[review]', name, name_, flush=True)
look('dusk')
for lc in bpy.context.view_layer.layer_collection.children:
    if lc.name == 'collision': lc.hide_viewport = True
for s in bpy.data.screens:
    for a in s.areas:
        if a.type == 'VIEW_3D':
            for sp in a.spaces:
                if sp.type == 'VIEW_3D': sp.clip_end = 20000; sp.shading.type = 'MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(H / 'out' / 'shajawa_review.blend'), copy=True)
print('[review] saved', flush=True)
