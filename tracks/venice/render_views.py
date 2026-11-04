"""Review of out/venice.blend (as tracks/llano/render_views.py): EEVEE stills, small and quick (the PC overheats under long renders) -> out/review/<view>-<look>.png, and
out/venice_review.blend, the file to open and judge the blockout in: sky and sun on, collision hidden, the viewport set up for the whole site.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/venice/render_views.py -Blend D:/RaceUltimate/tracks/venice/out/venice.blend -Log D:/RaceUltimate/tracks/venice/render_views.log"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
H = Path(r'D:/RaceUltimate/tracks/venice'); OUT = H / 'out' / 'review'; OUT.mkdir(parents=True, exist_ok=True); PH = Path(r'D:/RaceUltimate/assets/polyhaven')
T = json.loads((H / 'out' / 'track.json').read_text()); C = [Vector((p[0], -p[2], p[1])) for p in T['centerline']]; n = len(C); STEP = T['spacing']
S = lambda s: int(s / STEP)
def at(s, up=0.0, lat=0.0):
    i = S(s) % n; t = (C[(i + 1) % n] - C[i - 1]).normalized(); nl = Vector((-t.y, t.x, 0)).normalized()
    return C[i] + nl * lat + Vector((0, 0, up))
sc = bpy.context.scene
ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in ids else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
try: sc.eevee.use_raytracing = True      # contact shadows and bounce: walls with depth need them to read
except Exception: pass
try: sc.eevee.taa_render_samples = 16
except Exception: pass
sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = 0.0
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment'); nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
def look(name):
    env.image = bpy.data.images.load(str(PH / ('qwantani_noon_puresky/qwantani_noon_puresky_2k.hdr' if name == 'day' else 'belfast_sunset_puresky/belfast_sunset_puresky_2k.hdr')), check_existing=True)
    nt.nodes['Background'].inputs['Strength'].default_value = 0.8 if name == 'day' else 0.55
    sun.rotation_euler = (math.radians(48 if name == 'day' else 81), 0, math.radians(320 if name == 'day' else 100))      # shortcut: the day sun is set to show the road-facing fronts; check the game's own sun before the web stage; sun.data.energy = 3.4 if name == 'day' else 4.0; sun.data.color = (1, 0.96, 0.9) if name == 'day' else (1, 0.6, 0.32)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 24; cam.data.clip_end = 20000
for o in bpy.data.collections['collision'].objects: o.hide_render = True
mid = sum(C, Vector()) / n
LM = {l['name']: Vector((l['pos'][0], -l['pos'][2], l['pos'][1])) for l in T['landmarks']}
VIEWS = {
    'aerial': (mid + Vector((-350, -950, 800)), mid),
    'overhead': (mid + Vector((0, -1, 1950)), mid),
    'start-straight': (at(-90, 1.3), at(40, 2.0)),
    'top-stand': (at(40, 1.5, -3), at(120, 8.0, 34)),
    'hq-from-road': (at(5560, 1.4, -3), at(5800, 14.0, 60)),
    'palazzi-t1': (at(560, 1.3), at(680, 6.0, 10)),
    'palazzi-east': (at(950, 1.3, 3), at(1020, 12.0, 90)),
    'deck-ramp': (at(1120, 1.3), at(1260, 3.0)),
    'deck-mid-lake': (at(1650, 1.5, -5), at(1780, -3.0, -110)),
    'deck-straight': (at(1560, 1.3), at(1720, 2.0)),
    'over-the-tunnel': (at(2060, 1.3), at(2200, 1.0)),
    'the-drop': (at(2210, 1.3), at(2340, 0.0)),
    't4': (at(2400, 1.3), at(2530, 1.0)),
    'bottom-straight': (at(2700, 1.3), at(2850, 1.5)),
    'viaduct-from-infield': (at(4140, 3.0, 45), at(4400, 6.0, -105)),
    'rialto-span': (at(4334, 6.0, 40), at(4334, 7.0, -120)),
    'crossing-air': (at(2190, 70.0, -130), at(2190, 0.0)),
    'hairpin': (at(3560, 1.3), at(3700, 1.0)),
    'falling-to-tunnel': (at(4380, 1.3), at(4560, 1.5)),
    'bridge-of-sighs': (at(4500, 1.3), at(4620, 4.0)),
    'in-tunnel': (at(4800, 1.3), at(4880, 1.5)),
    'tunnel-exit': (at(4960, 1.3), at(5080, 3.0)),
    'exit-looking-back': (at(5160, 3.0), at(4980, 3.0)),
    'left-stand': (at(5400, 1.3), at(5500, 6.0, 20)),
    'dome-ahead': (at(2950, 1.3), at(3380, 26.0)),
    'dome-close': (at(3640, 2.0), LM['Dome hall'] - Vector((0, 0, 20))),
    'dome-front': (LM['Dome hall'] + Vector((-260, 30, -40)), LM['Dome hall'] - Vector((0, 0, 15))),
    'colonnade': (at(3060, 1.4, -5), at(3240, 12.0, -46)),
    'bell-dome': (at(2800, 1.3, 2), at(2960, 28.0, 60)),
    'city-from-straight': (at(3180, 1.3, 4), at(3280, 9.0, 60)),
    'cathedral': (at(2691, 6.0, 140), LM['Cathedral']),
    'clock-tower': (at(2480, 3.0, 20), LM['Town hall tower'] + Vector((0, 0, -25))),
    'clock-tower-ahead': (at(4300, 1.3), at(4900, 40.0, 60)),
    'canal': (at(2860, 5.0, 150), at(3160, 6.0, 118)),
    'lower-air': (at(3200, 230.0, -330), at(3200, 0.0, 120)),
    'st-along': (at(2780, 1.3), at(3000, 5.0)),
    'st-temple': (at(2780, 1.5, 3), at(2868, 11.0, 42)),
    'st-monument': (at(2900, 1.4, 3), at(2960, 22.0, 34)),
    'st-arcade': (at(2960, 1.5, 4), at(3040, 9.0, 34)),
    'st-exchange': (at(3060, 1.5, 4), at(3135, 9.0, 42)),
    'st-rotunda': (at(3130, 1.5, 4), at(3195, 16.0, 44)),
    'st-colonnade': (at(2940, 1.5, -4), at(3040, 11.0, -30)),
    'st-colonnade-close': (at(3010, 1.8, -13.5), at(3060, 12.0, -33)),
    'st-south-end': (at(3190, 1.5, -4), at(3250, 8.0, -40)),
    'st-back': (at(3330, 1.4), at(3120, 5.0)),
    'st-air': (at(2980, 70.0, -90), at(3100, 4.0, 30)),
    'st-house-close': (at(3210, 5.0, 150), at(3280, 6.0, 118)),
    'hq-road': (at(5640, 1.6, -2), at(5790, 11.0, 26)),
    'hq-close': (at(5700, 1.6, 8), at(5745, 8.0, 24)),
    'hq-arcade': (at(5745, 1.9, 13.5), at(5790, 5.0, 26)),
    'hq-gate': (at(5720, 2.0, 2), at(5783, 11.0, 18)),
    'hq-air': (at(5560, 75.0, -60), at(5800, 8.0, 70)),
    'pa-palazzi': (at(610, 1.4, 4), at(740, 9.0, 26)),
    'pz-close': (at(690, 1.6, 8), at(750, 10.0, 42)),
    'pz-mid': (at(420, 1.4, 2), at(640, 8.0, 34)),
    'pz-t1': (at(800, 1.4, 3), at(1000, 8.0, 30)),
    'pz-east': (at(1030, 1.4, 3), at(1180, 9.0, -10)),
    'pz-campanile': (at(700, 2.0, 10), at(780, 60.0, 90)),
    'pa-town-hall': (at(2480, 3.0, 20), LM['Town hall tower'] + Vector((0, 0, -35))),
    'pa-dome': (LM['Dome hall'] + Vector((-200, 40, -46)), LM['Dome hall'] - Vector((0, 0, 18))),
    'pa-cathedral': (at(2691, 6.0, 140), LM['Cathedral'] - Vector((0, 0, 30))),
    'de-start': (at(5900, 1.3), at(40, 4.0)),
    'de-forecourt': (at(5640, 1.6, -2), at(5790, 11.0, 26)),
    'de-terrace': (at(5880, 1.5, 4), at(5960, 3.0, 22)),
    'de-boulevard': (at(2700, 1.3), at(2900, 5.0)),
    'de-boulevard2': (at(3180, 1.3), at(3400, 6.0)),
    'de-cafe': (at(2990, 1.6, 3), at(3060, 3.0, 26)),
    'de-kiosk': (at(3130, 1.6, 4), at(3190, 3.0, 22)),
    'de-gate': (at(3660, 2.0, 60), at(3480, 12.0, 150)),
    'de-street': (at(3195, 1.5, -4), at(3250, 3.5, -22)),
    'de-square': (at(2895, 2.0, 18), at(2950, 2.0, 42)),
    'de-canal': (at(2960, 3.5, 130), at(3120, 1.0, 118)),
    'de-canal2': (at(3250, 3.5, 118), at(3120, 1.5, 128)),
    'de-lane': (at(3010, 3.0, 165), at(3010, 5.0, 225)),
    'de-tunnel': (at(4740, 1.3), at(4830, 2.0)),
    'de-tunnel-mouth': (at(4570, 1.3), at(4660, 3.0)),
    'de-deck': (at(1560, 1.3), at(1760, 3.0)),
    'de-hairpin': (at(3560, 1.3), at(3700, 1.5)),
    'de-t1': (at(560, 1.3), at(700, 3.0)),
    'de-palazzi-roofs': (at(1000, 30.0, 110), at(780, 12.0, 170)),
    'de-garden': (at(5300, 30.0, -90), at(5560, 0.0, -200)),
    'de-lake': (at(1650, 40.0, -30), at(1650, 0.0, -230)),
    'de-island': (at(3600, 30.0, -260), LM['Dome hall'] - Vector((0, 0, 40))),
    'lake-garden': (mid + Vector((-280, 520, 120)), mid + Vector((120, 300, 0))),
}
ALL_VIEWS = dict(VIEWS); ONLY = [o for a_ in sys.argv[sys.argv.index('--') + 1:] for o in a_.split(',')] if '--' in sys.argv else []
if ONLY: VIEWS = {k: VIEWS[k] for k in VIEWS if any(k.startswith(o) for o in ONLY)}
DUSK = [k for k in VIEWS if k in ('st-along', 'de-canal', 'de-start', 'de-boulevard')] if ONLY else ('aerial', 'start-straight', 'deck-mid-lake', 'bridge-of-sighs', 'palazzi-t1', 'dome-ahead', 'lower-air')
for name_, views in (('day', VIEWS), ('dusk', {k: VIEWS[k] for k in DUSK})):
    look(name_)
    for name, (p, q) in views.items():
        cam.location = p; cam.rotation_euler = (q - p).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = str(OUT / f'{name}-{name_}.png'); bpy.ops.render.render(write_still=True)
        print('[review]', name, name_, flush=True)
# ---- the file to open: at sunset
look('dusk')
cam.location, q = ALL_VIEWS['start-straight']; cam.rotation_euler = (q - cam.location).to_track_quat('-Z', 'Y').to_euler()
for lc in bpy.context.view_layer.layer_collection.children:
    if lc.name == 'collision': lc.exclude = True
for s in bpy.data.screens:
    for a in s.areas:
        if a.type != 'VIEW_3D': continue
        sp = a.spaces[0]; sp.clip_end = 30000; sp.clip_start = 0.5; sp.shading.type = 'MATERIAL'; sp.shading.use_scene_world = True; sp.shading.use_scene_lights = True
        r = sp.region_3d
        if r: r.view_location = mid; r.view_distance = 1900; r.view_perspective = 'PERSP'; r.view_rotation = (Vector((-350, -950, 800)) * -1).to_track_quat('-Z', 'Y')
bpy.ops.wm.save_as_mainfile(filepath=str(H / 'out' / 'venice_review.blend'), copy=True)
print('[review] done', flush=True)
