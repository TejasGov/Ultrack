"""Review stills of out/infinia.blend (EEVEE, small and quick: the PC overheats under long renders). Cameras sit on the centreline from
out/track.json (game frame: x, y up, -z north -> Blender x, -z, y).  -- --look day|dusk  -> out/review/<view>-<look>.png"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
H = Path(r'D:/RaceUltimate/tracks/infinia'); OUT = H / 'out' / 'review'; OUT.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
LOOK = ARGS[ARGS.index('--look') + 1] if '--look' in ARGS else 'day'
T = json.loads((H / 'out' / 'track.json').read_text()); C = [Vector((p[0], -p[2], p[1])) for p in T['centerline']]; n = len(C)
def at(i, up=0.0, lat=0.0):
    i %= n; t = (C[(i + 1) % n] - C[i - 1]).normalized(); nl = Vector((-t.y, t.x, 0)).normalized()
    return C[i] + nl * lat + Vector((0, 0, up))
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
try: sc.eevee.taa_render_samples = 16
except Exception: pass
sc.view_settings.view_transform = 'AgX' if 'AgX' in [v.identifier for v in type(sc.view_settings).bl_rna.properties['view_transform'].enum_items] else 'Filmic'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; nt = w.node_tree
sky = nt.nodes.new('ShaderNodeTexSky'); bg = nt.nodes['Background']; nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
try:
    sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(38 if LOOK == 'day' else 6); sky.sun_rotation = math.radians(250); sky.air_density = 1.6; sky.dust_density = 3.0
except Exception: pass
bg.inputs['Strength'].default_value = 0.18 if LOOK == 'day' else 0.12
sc.view_settings.exposure = -0.6
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(90 - (38 if LOOK == 'day' else 6)), 0, math.radians(250 + 90))
sun.data.energy = 2.4 if LOOK == 'day' else 1.6; sun.data.color = (1, 0.96, 0.9) if LOOK == 'day' else (1, 0.62, 0.38)
for m in bpy.data.materials:        # the night shell only shows from evening on (tracks.js dayNight)
    if m.name.startswith('IF window glow night'):
        for o in bpy.data.objects:
            if o.type == 'MESH' and o.name == 'IF window glow night': o.hide_render = LOOK in ('day', 'dusk')
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 24; cam.data.clip_end = 9000
corners = [c['apexIdx'] for c in T['corners']]
VIEWS = {
    'bridge-climb': (at(40, 2.0), at(140, 24)),
    'bridge-tower': (at(150, 2.0), at(200, 60)),
    'koliwada': (at(500, 1.6), at(560, 3)),
    'old-city': (at(640, 1.6), at(690, 4)),
    'old-city-2': (at(760, 1.6), at(800, 4)),
    'towers': (at(860, 1.6), at(920, 30)),
    'tunnel-mouth': (at(950, 1.8), at(1000, -4)),
    'necklace': (at(1560, 1.6), at(1620, 3)),
    'necklace-sea': (at(1600, 3.0, -12), at(1600, 6, -300)),
    'toll-plaza': (at(1820, 1.8), at(1860, 5)),
    'aerial-east': (at(700, 260, 300), at(700, 0, 0)),
    'aerial-west': (at(1600, 260, -300), at(1600, 0, 0)),
}
only = ARGS[ARGS.index('--only') + 1].split(',') if '--only' in ARGS else None
for name, (p, q) in VIEWS.items():
    if only and name not in only: continue
    cam.location = p; cam.rotation_euler = (q - p).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / f'{name}-{LOOK}.png'); bpy.ops.render.render(write_still=True)
    print('[review]', name, flush=True)
print('[review] done', flush=True)
