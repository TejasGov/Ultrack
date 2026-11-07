"""Review of out/wold.blend: EEVEE stills from the road at day and dusk (small and quick: the PC overheats under long renders) -> out/review/<view>-<look>.png, and out/wold_review.blend
to open and judge the track in (at dusk, sky and sun on, collision hidden, the viewport set up for a 2 km site).
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/wold/tracks/wold/render_views.py -Blend D:/RaceUltimate-wt/wold/tracks/wold/out/wold.blend
    -Rest a,b    only these views (day only)"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
H = Path(r'D:/RaceUltimate-wt/wold/tracks/wold'); OUT = H / 'out' / 'review'; OUT.mkdir(parents=True, exist_ok=True); PH = Path(r'D:/RaceUltimate/assets/polyhaven')
ONLY = [v for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) for v in a.split(',') if v]
T = json.loads((H / 'out' / 'track.json').read_text()); C = [Vector((p[0], -p[2], p[1])) for p in T['centerline']]; n = len(C); STEP = T['spacing']
def at(s, up=0.0, lat=0.0):
    i = int(round(s / STEP)) % n; t = (C[(i + 1) % n] - C[i - 1]).normalized(); nl = Vector((-t.y, t.x, 0)).normalized()
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
    """the game's own skies (main.js LOOKS): noon, and Belfast sunset with the sun low in the west"""
    env.image = bpy.data.images.load(str(PH / ('qwantani_noon_puresky/qwantani_noon_puresky_2k.hdr' if name == 'day' else 'belfast_sunset_puresky/belfast_sunset_puresky_2k.hdr')), check_existing=True)
    nt.nodes['Background'].inputs['Strength'].default_value = 0.8 if name == 'day' else 0.55
    sun.rotation_euler = (math.radians(42 if name == 'day' else 80), 0, math.radians(150 if name == 'day' else 250)); sun.data.energy = 3.4 if name == 'day' else 4.0; sun.data.color = (1, 0.96, 0.9) if name == 'day' else (1, 0.6, 0.32)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 24; cam.data.clip_end = 12000
for o in bpy.data.collections['collision'].objects: o.hide_render = True
tw = next(Vector((l['pos'][0], -l['pos'][2], l['pos'][1])) for l in T['landmarks'] if l['name'] == 'Church tower')
VIEWS = {
    'village-entry': (at(2600, 1.3), at(2700, 3.0)),
    'high-street': (at(2760, 1.3), at(2860, 4.0)),
    'market-square': (at(2830, 1.6, -4), at(2852, 4.0, 30)),
    'high-street-west': (at(2950, 1.3), at(3060, 5.0)),
    'braking-for-the-bridge': (at(3050, 1.3), tw - Vector((0, 0, 8))),
    'onto-the-bridge': (at(3160, 1.3), at(3260, 2.0)),
    'bridge-from-the-bank': (at(3255, -3.4, 55), at(3255, -2.6)),
    'bridge-downstream': (at(3255, -3.0, -60), at(3255, -2.6)),
    'climb-out': (at(3330, 1.3), at(3430, 3.0)),
    'grandstand': (at(3300, 1.3, -3), at(3360, 4.0, 14)),
    'village-air': (at(2900, 120, -150), at(2950, 0.0)),
}
for name_, views in (('day', VIEWS), ('dusk', {k: VIEWS[k] for k in ('high-street', 'braking-for-the-bridge', 'bridge-from-the-bank', 'village-air')})):
    if ONLY and name_ == 'dusk': continue
    look(name_)
    for name, (p, q) in views.items():
        if ONLY and name not in ONLY: continue
        cam.location = p; cam.rotation_euler = (q - p).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = str(OUT / f'{name}-{name_}.png'); bpy.ops.render.render(write_still=True)
        print('[review]', name, name_, flush=True)
if not ONLY:
    look('dusk')
    cam.location, q = VIEWS['high-street']; cam.rotation_euler = (q - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for lc in bpy.context.view_layer.layer_collection.children:
        if lc.name == 'collision': lc.exclude = True
    for s in bpy.data.screens:
        for a in s.areas:
            if a.type != 'VIEW_3D': continue
            sp = a.spaces[0]; sp.clip_end = 20000; sp.clip_start = 0.3; sp.shading.type = 'MATERIAL'; sp.shading.use_scene_world = True; sp.shading.use_scene_lights = True
            r = sp.region_3d
            if r: r.view_location = at(2950); r.view_distance = 380; r.view_perspective = 'PERSP'; r.view_rotation = (Vector((1, 1.3, -1))).to_track_quat('-Z', 'Y')
    bpy.ops.wm.save_as_mainfile(filepath=str(H / 'out' / 'wold_review.blend'), copy=True)
print('[review] done', flush=True)
