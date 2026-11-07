"""Review of out/morro.blend at night: EEVEE stills from the road (small and quick: the PC overheats under long renders) -> out/review/<view>.png, and out/morro_review.blend to open
and judge the track in. The lamps in lights.json become real point lights here (the game bakes them into a map, venue/morro.js), and the road is made wet the way the game's rain shader
does it: dark, glossy, with puddles.
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/morro/tracks/morro/render_views.py -Blend D:/RaceUltimate-wt/morro/tracks/morro/out/morro.blend
    -Rest a,b    only these views"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
H = Path(r'D:/RaceUltimate-wt/morro/tracks/morro'); OUT = H / 'out' / 'review'; OUT.mkdir(parents=True, exist_ok=True); PH = Path(r'D:/RaceUltimate/assets/polyhaven')
ONLY = [v for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) for v in a.split(',') if v]
T = json.loads((H / 'out' / 'track.json').read_text()); C = [Vector((p[0], -p[2], p[1])) for p in T['centerline']]; n = len(C); STEP = T['spacing']
L = json.loads((H / 'out' / 'lights.json').read_text())
def at(s, up=0.0, lat=0.0):
    i = int(round(s / STEP)) % n; t = (C[(i + 1) % n] - C[i - 1]).normalized(); nl = Vector((-t.y, t.x, 0)).normalized()
    return C[i] + nl * lat + Vector((0, 0, up))
sc = bpy.context.scene
ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in ids else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
try: sc.eevee.taa_render_samples = 24
except Exception: pass
for a_, v_ in (('use_raytracing', True), ('use_bloom', True)):
    try: setattr(sc.eevee, a_, v_)
    except Exception: pass
sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = 0.6
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree
env = nt.nodes.new('ShaderNodeTexEnvironment'); nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
env.image = bpy.data.images.load(str(PH / 'qwantani_night_puresky/qwantani_night_puresky_2k.hdr')); nt.nodes['Background'].inputs['Strength'].default_value = 0.035
moon = bpy.data.objects.new('moon', bpy.data.lights.new('moon', 'SUN')); sc.collection.objects.link(moon); moon.data.energy = 0.05; moon.data.color = (0.6, 0.7, 1.0); moon.rotation_euler = (math.radians(35), 0, math.radians(200))
for k, l in enumerate(L['streetLamps']):
    p = Vector((l['pos'][0], -l['pos'][2], l['pos'][1]))
    if l.get('h', 0) >= 15: ld = bpy.data.lights.new(f'mast{k}', 'SPOT'); ld.energy = 16000; ld.spot_size = math.radians(120); ld.spot_blend = 0.5; ld.color = (1.0, 0.95, 0.88); ld.shadow_soft_size = 0.8
    elif l.get('h'): ld = bpy.data.lights.new(f'bulb{k}', 'POINT'); ld.energy = 90; ld.color = (1.0, 0.75, 0.45); ld.shadow_soft_size = 0.05
    else: ld = bpy.data.lights.new(f'lamp{k}', 'SPOT'); ld.energy = 2600; ld.spot_size = math.radians(150); ld.spot_blend = 0.6; ld.color = (1.0, 0.58, 0.26); ld.shadow_soft_size = 0.25
    ob = bpy.data.objects.new(f'lamp{k}', ld); ob.location = p; sc.collection.objects.link(ob)      # a spot points down -Z: no rotation needed
# the road wet as the game's rain shader makes it: darker, glossy, puddles in the low spots of a noise
m = bpy.data.materials.get('MN | asphalt'); mt = m.node_tree; Pb = mt.nodes['Principled BSDF']
nz = mt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.09; nz.inputs['Detail'].default_value = 6; tc = mt.nodes.new('ShaderNodeNewGeometry'); mt.links.new(tc.outputs['Position'], nz.inputs['Vector'])
ramp = mt.nodes.new('ShaderNodeMapRange'); ramp.inputs['From Min'].default_value = 0.5; ramp.inputs['From Max'].default_value = 0.56; mt.links.new(nz.outputs['Fac'], ramp.inputs['Value'])
mr = mt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.22; mr.inputs['To Max'].default_value = 0.02; mt.links.new(ramp.outputs['Result'], mr.inputs['Value']); mt.links.new(mr.outputs['Result'], Pb.inputs['Roughness'])
for k_ in ('MN | pavement', 'MN | line white', 'MN | kerb red', 'MN | kerb white'):
    mm = bpy.data.materials.get(k_)
    if mm: mm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.25
    if mm and mm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].links: mm.node_tree.links.remove(mm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].links[0])
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 24; cam.data.clip_end = 12000
for o in bpy.data.collections['collision'].objects: o.hide_render = True
VIEWS = {
    't4-approach': (at(2280, 1.3), at(2380, 3.0, -6)),
    't4-exit': (at(2440, 1.3), at(2540, 4.0)),
    'climb': (at(2560, 1.3), at(2660, 6.0)),
    'climb-side': (at(2600, 1.6, 5), at(2650, 9.0, -22)),
    't5-approach': (at(2760, 1.3), at(2850, 3.0, 8)),
    't5-hairpin': (at(2860, 1.4, -4), at(2900, 1.5, 0)),
    'over-the-hairpins': (at(2870, 30, 0), at(2870, -30) + Vector((0, -420, 0))),
    't6-climb': (at(2960, 1.3), at(3040, 4.0)),
    't6-exit': (at(3090, 1.3), at(3180, 4.0)),
    'drone-down-the-hill': (at(3120, 35, 0), at(2300, 0.0)),
    'aerial': (at(2700, 140, -160), at(2750, 0.0)),
}
for name, (p, q) in VIEWS.items():
    if ONLY and name not in ONLY: continue
    cam.location = p; cam.rotation_euler = (q - p).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / f'{name}-night.png'); bpy.ops.render.render(write_still=True)
    print('[review]', name, flush=True)
if not ONLY:
    cam.location, q = VIEWS['t4-exit']; cam.rotation_euler = (q - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for lc in bpy.context.view_layer.layer_collection.children:
        if lc.name == 'collision': lc.exclude = True
    for s in bpy.data.screens:
        for a in s.areas:
            if a.type != 'VIEW_3D': continue
            sp = a.spaces[0]; sp.clip_end = 20000; sp.clip_start = 0.3; sp.shading.type = 'MATERIAL'; sp.shading.use_scene_world = True; sp.shading.use_scene_lights = True
            r = sp.region_3d
            if r: r.view_location = at(2700); r.view_distance = 420; r.view_perspective = 'PERSP'; r.view_rotation = (Vector((-1, -1.2, 1))).to_track_quat('-Z', 'Y')
    bpy.ops.wm.save_as_mainfile(filepath=str(H / 'out' / 'morro_review.blend'), copy=True)
print('[review] done', flush=True)
