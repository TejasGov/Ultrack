"""Review of out/terminal.blend: EEVEE stills from the road (small and quick: the PC overheats under long renders) -> out/review/<view>-<look>.png, and out/terminal_review.blend,
the file to open and judge the track in: sky and sun on, collision hidden, the viewport set up for the site (Blender's default view clips at 1 km).
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/maps/tracks/terminal/render_views.py -Blend D:/RaceUltimate-wt/maps/tracks/terminal/out/terminal.blend -Log <abs log>
    (-Rest hero: only the hero stretch's two stills, the quay at dusk and the canyon by day, and no review blend)"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
H = Path(globals().get('__file__') or sys.argv[sys.argv.index('-P') + 1]).resolve().parent; OUT = H / 'out' / 'review'; OUT.mkdir(parents=True, exist_ok=True); PH = H.parents[1] / 'assets' / 'polyhaven'
HERO = 'hero' in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
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
try: sc.eevee.shadow_pool_size = '1024'      # at the default pool the large scene runs out of shadow pages, and they render as dark blocks on the road
except Exception: pass
sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = 0.0
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment'); nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
def look(name):
    """the game's own skies (main.js LOOKS): noon, and Belfast sunset with the sun low"""
    env.image = bpy.data.images.load(str(PH / ('qwantani_noon_puresky/qwantani_noon_puresky_2k.hdr' if name == 'day' else 'belfast_sunset_puresky/belfast_sunset_puresky_2k.hdr')), check_existing=True)
    nt.nodes['Background'].inputs['Strength'].default_value = 0.8 if name == 'day' else 0.55
    sun.rotation_euler = (math.radians(48 if name == 'day' else 81), 0, math.radians(140 if name == 'day' else 100)); sun.data.energy = 3.4 if name == 'day' else 4.0; sun.data.color = (1, 0.96, 0.9) if name == 'day' else (1, 0.6, 0.32)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 24; cam.data.clip_end = 20000
for o in bpy.data.collections['collision'].objects: o.hide_render = True
bpy.data.objects['NT lines'].visible_shadow = False      # 3 cm over the road: EEVEE's shadow pages turn it into dark blocks
mid = sum(C, Vector()) / n
S = lambda c, t: (at(c[0], c[1], c[2]), at(t[0], t[1], t[2]))       # [station, up, side] as maps-spec.md section 9.5
VIEWS = {'quay': S((690, 3.5, 2), (30, 12, 2)), 'crane-hairpin': S((95, 4, 3), (108, 2, 0)), 'canyon': S((185, 3, 2), (200, 3, 0)),
         'reefer': S((285, 3, 2), (300, 3, 0)), 'back-straight': S((395, 3, 2), (420, 3, 0))}
OVER = (mid + Vector((-220, -330, 250)), mid + Vector((0, 40, -10)))
if HERO: SHOTS = [('quay', 'dusk'), ('canyon', 'day')]
else: SHOTS = [(v, lk) for lk in ('day', 'dusk') for v in VIEWS] + [('overview', 'dusk')]
for name, lk in SHOTS:
    look(lk); p, q = OVER if name == 'overview' else VIEWS[name]
    cam.location = p; cam.rotation_euler = (q - p).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / f'{name}-{lk}.png'); bpy.ops.render.render(write_still=True)
    print('[review]', name, lk, flush=True)
if not HERO:     # the file to open: at sunset
    look('dusk')
    cam.location, q = VIEWS['quay']; cam.rotation_euler = (q - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for lc in bpy.context.view_layer.layer_collection.children:
        if lc.name == 'collision': lc.exclude = True
    for s in bpy.data.screens:
        for a in s.areas:
            if a.type != 'VIEW_3D': continue
            sp = a.spaces[0]; sp.clip_end = 20000; sp.clip_start = 0.5; sp.shading.type = 'MATERIAL'; sp.shading.use_scene_world = True; sp.shading.use_scene_lights = True
            r = sp.region_3d
            if r: r.view_location = mid; r.view_distance = 900; r.view_perspective = 'PERSP'; r.view_rotation = (OVER[1] - OVER[0]).to_track_quat('-Z', 'Y')
    bpy.ops.wm.save_as_mainfile(filepath=str(H / 'out' / 'terminal_review.blend'), copy=True)
print('[review] done', flush=True)
