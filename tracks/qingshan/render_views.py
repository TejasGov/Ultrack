"""Review of the first finished stretch (as tracks/venice/render_views.py): EEVEE stills, few and quick (the PC overheats under long renders) -> out/review/<view>-<look>.png, and out/qingshan_review.blend, the file to open and judge it in.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/qingshan/render_views.py -Blend D:/RaceUltimate/tracks/qingshan/out/qingshan.blend -Log D:/RaceUltimate/tracks/qingshan/render_views.log [-Rest view1,view2]"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
H = Path(r'D:/RaceUltimate/tracks/qingshan'); OUT = H / 'out' / 'review'; OUT.mkdir(parents=True, exist_ok=True); PH = Path(r'D:/RaceUltimate/assets/polyhaven')
T = json.loads((H / 'out' / 'track.json').read_text()); C = [Vector((p[0], -p[2], p[1])) for p in T['centerline']]; n = len(C); STEP = T['spacing']
def at(s, up=0.0, lat=0.0):
    i = int(s / STEP) % n; t = (C[(i + 1) % n] - C[i - 1]).normalized(); nl = Vector((-t.y, t.x, 0)).normalized(); return C[i] + nl * lat + Vector((0, 0, up))
sc = bpy.context.scene
ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]; sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in ids else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
try: sc.eevee.use_raytracing = False; sc.eevee.taa_render_samples = 16      # raytraced reflections left a false dark patch on the road
except Exception: pass
sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = 0.0
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree; env = nt.nodes.new('ShaderNodeTexEnvironment'); nt.links.new(env.outputs['Color'], nt.nodes['Background'].inputs['Color'])
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.angle = math.radians(2)
def look(name):
    env.image = bpy.data.images.load(str(PH / ('qwantani_noon_puresky/qwantani_noon_puresky_2k.hdr' if name == 'day' else 'belfast_sunset_puresky/belfast_sunset_puresky_2k.hdr')), check_existing=True)
    nt.nodes['Background'].inputs['Strength'].default_value = 1.25 if name == 'day' else 0.7
    sun.rotation_euler = (math.radians(38 if name == 'day' else 78), 0, math.radians(15 if name == 'day' else 110)); sun.data.energy = 3.4 if name == 'day' else 2.6
    sun.data.color = (1, .97, .92) if name == 'day' else (1, .72, .48)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 24; cam.data.clip_end = 12000; cam.data.clip_start = .3
for o in bpy.data.collections['collision'].objects: o.hide_render = True
HALL = next(Vector((l['pos'][0], -l['pos'][2], l['pos'][1])) for l in T['landmarks'] if l['name'] == 'Hall 1')
RT = next(Vector((l['pos'][0], -l['pos'][2], l['pos'][1])) for l in T['landmarks'] if l['name'] == 'Rotunda'); ST = next(Vector((l['pos'][0], -l['pos'][2], l['pos'][1])) for l in T['landmarks'] if l['name'] == 'North stand')
def LM_(n_): return next(Vector((l['pos'][0], -l['pos'][2], l['pos'][1])) for l in T['landmarks'] if l['name'] == n_)
MS, CS, H2, H3 = LM_('Main stand'), LM_('Corner stand'), LM_('Hall 2'), LM_('Hall 3')
H1 = LM_('Hall 1')
VIEWS = {
    'd-halls': (at(330, 1.3, 2), at(470, 6, 16)), 'd-gate': (at(445, 1.6, 4), H1 + Vector((0, 0, -12))), 'd-court': (at(430, 7, 22), H1 + Vector((0, 0, -14))), 'd-pagoda': (at(3480, 1.3), at(3500, 34, 200)), 'd-pav': (at(3700, 2.6, -8), at(3760, -2, -130)), 'd-bamboo': (at(830, 1.3, 2), at(900, 5, 16)), 'd-farm': (at(2640, 2.0, -6), at(2640, 8, -140)), 'd-pylons': (at(2720, 1.3, 2), at(2720, 26, 200)), 'd-ads': (at(5480, 1.3), at(5620, 3)), 'd-stand-ads': (at(5660, 1.3, 2), at(5720, 3, 25)), 'd-gantry2': (at(3200, 1.3), at(3300, 8)),
    's-start': (at(5650, 1.3), at(5795, 3)), 's-grid': (at(5760, 2.0, 3), at(40, 4)), 's-stand': (at(5730, 1.3, 5), MS + Vector((0, 0, 10))), 's-pits': (at(5700, 1.3, -5), at(40, 4, -30)), 's-halls': (at(160, 1.3, 2), at(330, 6, 18)), 's-hall2': (at(240, 1.3, 3), H2 + Vector((0, 0, 8))), 's-hall3': (at(70, 1.3, 3), H3 + Vector((0, 0, 8))),
    's-stack': (at(1250, 1.3), at(1420, 4)), 's-stack-tip': (at(1540, 1.3), at(1640, 4)), 's-t4-lake': (at(1975, 1.3), at(2060, 2)), 's-west': (at(2200, 1.3), at(2420, 3)), 's-t6': (at(2780, 1.3), at(2870, 3)), 's-sweep': (at(4250, 1.3), at(4420, 2)), 's-t8': (at(4530, 1.3), at(4620, 2)), 's-solar': (at(4850, 1.3), at(5050, 2)), 's-solar-b': (at(4856, 1.3), at(5056, 2)), 's-solar-close': (at(4960, 2.6, -14), at(5000, 1, -60)), 's-solar-side': (at(4950, 1.6, -4), at(5000, 1, -60)), 's-t9': (at(5270, 1.3), at(5400, 3)), 's-corner-stand': (at(5310, 1.3, 3), CS + Vector((0, 0, 10))), 's-air': (RT + Vector((-850, 420, 620)), RT + Vector((-700, 330, 0))), 's-visitor': (at(2600, 2, -4), at(2600, 4, -80)),
    'top-start': (at(3250, 1.3), at(3420, 3)), 'top-mid': (at(3560, 1.3), at(3760, 3)), 'top-late': (at(3880, 1.3), at(4050, 6)), 'farm-from-road': (at(3280, 1.3, -3), at(3280, 40, -240)), 'lake-from-road': (at(3660, 1.3, -3), at(3700, -6, -180)), 'lake-chase': (at(3620, 2.6), at(3780, -2, -55)), 'lake-sweep': (at(4235, 1.3), at(4380, 0, -20)),
    'roof-near': (at(4040, 1.3), RT + Vector((0, 0, 14))), 't7-stand': (at(4085, 1.3, -2), ST + Vector((0, 0, 12))), 't7-apex': (at(4139, 1.3), at(4230, 3)), 'arena-air': (RT + Vector((-330, 130, 170)), RT + Vector((60, -120, 10))), 'funnel-air': (RT + Vector((-60, 40, 95)), RT + Vector((0, 0, 8))),
    'run-to-t1': (at(360, 1.3), at(500, 2)), 'hall-passing': (at(430, 1.3), at(500, 6, -40)), 'hall-from-road': (at(495, 1.3, -3), HALL), 'hall-wide': (at(560, 4, 6), HALL + Vector((0, 0, -6))),
    'brake-t1': (at(545, 1.3), at(650, 2)), 't1-apex': (at(630, 1.3), at(680, 2)), 't1-exit': (at(720, 1.3), at(830, 3)), 'first-leg': (at(860, 1.3), at(990, 4)),
    'forest-edge': (at(880, 1.3, 6), at(880, 7, 45)), 'trap-t1': (at(560, 1.3, 2), at(640, 0, 24)), 'shoulder-close': (at(420, 1.1, 5), at(450, 0, 9.5)), 't1-overhead': (at(600, 75, 22), at(650, 0, 18)), 't1-exit-air': (at(700, 22, 2), at(712, 0, 11)), 't1-exit-close': (at(690, 1.3, 3), at(740, 0, 10)), 'over-the-stretch': (at(640, 95, -60), at(800, 0, 40)), 'hall-air': (HALL + Vector((-90, -95, 45)) if False else at(470, 60, -5), HALL + Vector((0, 0, -12))),
}
print('sides', {k: tuple(round(a, 1) for a in v[0]) for k, v in VIEWS.items()}, flush=True)
want = sys.argv[sys.argv.index('--') + 1].split(',') if '--' in sys.argv else list(VIEWS)
def shot(view, name):
    a, b = VIEWS[view]; cam.location = a; cam.rotation_euler = (b - a).to_track_quat('-Z', 'Y').to_euler(); n_ = {'LOD0': 0, 'LOD1': 0, 'CARD': 0}
    for ob in FOREST:      # the detail the game would show from this camera, not the road-wide best of the review file
        d = (ob.matrix_world.translation - a).length; lod_ = 'LOD0' if ob['tier'] == 0 and d < 50 else 'LOD1' if ob['tier'] < 2 and d < 110 else 'CARD'; ob.data = bpy.data.meshes[f"TREE {ob['sp']} {lod_}"]; n_[lod_] += 1
    print('lods', view, n_, flush=True); sc.render.filepath = str(OUT / f'{view}-{name}.png'); bpy.ops.render.render(write_still=True); print('[review]', view, name, flush=True)
FOREST = [o for o in bpy.data.collections['forest'].objects if 'sp' in o]; KEEP = {o: o.data for o in FOREST}
look('day')
for v in want:
    if v in VIEWS: shot(v, 'day')
if '--' not in sys.argv or 'dusk' in want:
    look('dusk')
    for v in ('run-to-t1', 'hall-from-road', 'first-leg'): shot(v, 'dusk')
    look('day')
for o, d_ in KEEP.items(): o.data = d_
# the file to open: sky and sun on, collision hidden, camera on the driver's line
for o in bpy.data.collections['collision'].objects: o.hide_viewport = True; o.hide_set(True)
a, b = VIEWS['run-to-t1']; cam.location = a; cam.rotation_euler = (b - a).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(H / 'out' / 'qingshan_review.blend')); print('saved review', flush=True)
