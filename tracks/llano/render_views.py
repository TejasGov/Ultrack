"""Review of out/llano.blend: EEVEE stills from the road (small and quick: the PC overheats under long renders) -> out/review/<view>-<look>.png, and out/llano_review.blend,
the file to open and judge the track in: sky and sun on, collision hidden, the viewport set up for a 3 km site (Blender's default view clips at 1 km).
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/llano/render_views.py -Blend D:/RaceUltimate/tracks/llano/out/llano.blend -Log D:/RaceUltimate/tracks/llano/render_views.log"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
H = Path(r'D:/RaceUltimate/tracks/llano'); OUT = H / 'out' / 'review'; OUT.mkdir(parents=True, exist_ok=True); PH = Path(r'D:/RaceUltimate/assets/polyhaven')
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
    """the game's own skies (main.js LOOKS): noon, and Belfast sunset with the sun low ahead down the start straight"""
    env.image = bpy.data.images.load(str(PH / ('qwantani_noon_puresky/qwantani_noon_puresky_2k.hdr' if name == 'day' else 'belfast_sunset_puresky/belfast_sunset_puresky_2k.hdr')), check_existing=True)
    nt.nodes['Background'].inputs['Strength'].default_value = 0.8 if name == 'day' else 0.55
    sun.rotation_euler = (math.radians(48 if name == 'day' else 81), 0, math.radians(140 if name == 'day' else 100)); sun.data.energy = 3.4 if name == 'day' else 4.0; sun.data.color = (1, 0.96, 0.9) if name == 'day' else (1, 0.6, 0.32)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 24; cam.data.clip_end = 20000
for o in bpy.data.collections['collision'].objects: o.hide_render = True
mid = sum(C, Vector()) / n
bpy.data.objects['LL decals'].visible_shadow = False      # 2 cm over the road: EEVEE's shadow pages turn it into dark blocks
SP = next(Vector((l['pos'][0], -l['pos'][2], l['pos'][1])) for l in T['landmarks'] if l['name'] == 'Llano Central')
si_ = min(range(n), key=lambda q: (C[q] - SP).to_2d().length)      # the Long Mile opposite the station
_t = (C[(si_ + 1) % n] - C[si_ - 1]).normalized(); _e = Vector((-_t.y, _t.x, 0)).normalized(); SL = lambda u, v, z: Vector((C[si_].x, C[si_].y, C[si_].z)) + Vector((_t.x, _t.y, 0)) * u + _e * (38 + v) + Vector((0, 0, z))
VIEWS = {
    'station-from-road': (at(si_ - 60, 1.3), SL(0, 90, 18)),
    'station-road-side': (at(si_ - 18, 1.3, 2), SL(0, 95, 20)),
    'station-garden': (SL(-6, 24, 7.5), SL(0, 100, 22)),
    'station-colonnade': (SL(-66, 76, 9), SL(10, 90, 18)),
    'station-hall': (SL(-48, 121, 7.5), SL(50, 121, 26)),
    'station-air': (SL(-260, -40, 150), SL(0, 120, 10)),
    'station-train': (SL(55, 262, 8), SL(-12, 150, 8)),
    'footbridge-mile': (at(si_ - 34, 1.3), at(si_, 7.0)),
    'aerial': (mid + Vector((-1400, -2400, 2500)), mid),
    'infield-air': (Vector((-300, 150, 420)), Vector((260, -700, 0))),
    'start-straight': (at(-60, 1.3), at(40, 2.0)),
    'grandstand': (at(70, 1.6, -4), at(120, 8.0, 28)),
    'pits': (at(40, 1.6, 8), at(120, 4.0, -30)),
    'hq-from-road': (at(60, 1.4, -10), at(120, 40.0, -90)),
    'footbridge': (at(150, 1.3), at(182, 5.0)),
    'corral': (at(195, 1.3), at(242, 3.0, 8)),
    'long-mile': (at(620, 1.3), at(720, 3.0)),
    'long-mile-side': (at(760, 1.3, 4), at(840, 10.0, 28)),
    'kink': (at(850, 1.3), at(930, 2.0)),
    'pipeline': (at(700, 1.3), at(780, 5.0)),
    'caprock-climb': (at(1400, 1.3), at(1500, 4.0)),
    'last-chance': (at(1240, 1.3), at(1310, 3.0, 6)),
    'big-bend': (at(1590, 1.3), at(1680, 1.5)),
    'caprock-crest': (at(1800, 1.3), at(1900, 0.5)),
    't8': (at(2030, 1.3), at(2096, 2.0)),
    'horseshoe': (at(2500, 1.3), at(2585, 4.0, 10)),
    'rv-camp': (Vector((600, -1000, 7)), Vector((400, -1130, 2))),
    'dry-lake': (Vector((660, -1500, 6)), Vector((400, -1720, 0))),
    'kart': (Vector((150, -280, 30)), Vector((-110, -470, 0))),
    'stage-star': (Vector((300, -90, 10)), Vector((470, -420, 18))),
}
for name_, views in (('day', VIEWS), ('dusk', {k: VIEWS[k] for k in ('start-straight', 'grandstand', 'pits', 'long-mile', 'pipeline', 'caprock-climb', 'big-bend', 'last-chance', 'horseshoe', 'station-from-road', 'station-garden', 'station-colonnade', 'station-hall', 'station-air')})):
    look(name_)
    for m in bpy.data.materials:     # the game's look scales emission down (main.js LOOKS); here it shows as is
        if m.name.startswith('Backdrop |') and m.node_tree: m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.8 if name_ == 'day' else 0.35
    for o in bpy.data.objects:
        if o.name == 'Backdrop | range day': o.hide_render = name_ != 'day'
    for name, (p, q) in views.items():
        cam.location = p; cam.rotation_euler = (q - p).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = str(OUT / f'{name}-{name_}.png'); bpy.ops.render.render(write_still=True)
        print('[review]', name, name_, flush=True)
# ---- the file to open: at sunset, the track's best face
look('dusk')
for m in bpy.data.materials:
    if m.name.startswith('Backdrop |') and m.node_tree: m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.35
for o in bpy.data.objects:
    if o.name == 'Backdrop | range day': o.hide_render = True; o.hide_viewport = True
cam.location, q = VIEWS['start-straight']; cam.rotation_euler = (q - cam.location).to_track_quat('-Z', 'Y').to_euler()
for lc in bpy.context.view_layer.layer_collection.children:
    if lc.name == 'collision': lc.exclude = True
for s in bpy.data.screens:
    for a in s.areas:
        if a.type != 'VIEW_3D': continue
        sp = a.spaces[0]; sp.clip_end = 30000; sp.clip_start = 0.5; sp.shading.type = 'MATERIAL'; sp.shading.use_scene_world = True; sp.shading.use_scene_lights = True
        r = sp.region_3d
        if r: r.view_location = mid; r.view_distance = 4600; r.view_perspective = 'PERSP'; r.view_rotation = (Vector((-1400, -2400, 2500)) * -1).to_track_quat('-Z', 'Y')
bpy.ops.wm.save_as_mainfile(filepath=str(H / 'out' / 'llano_review.blend'), copy=True)
print('[review] done', flush=True)
