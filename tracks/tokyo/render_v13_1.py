"""EEVEE renders of out/tokyo_v13_1.blend (16 samples). Writes out/v13_1_<name>.png.

  powershell tracks/tokyo/run_blender.ps1 -Blend tracks/tokyo/out/tokyo_v13_1.blend -Script tracks/tokyo/render_v13_1.py -Rest a_start_straight,sweep_000,...
sweep_<deg> cameras: 8 views at 45 degree steps (0 = north, clockwise) from the start line at 1.6 m, 800x450.
"""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v12_common as C  # noqa: E402

O = C.O
OLD = {'i_neon_street_fuji': 'V8 | neon avenue toward Fuji', 'j_bridge_night': 'V5 | bridge driving view'}
sc = bpy.context.scene
for n in sys.argv[sys.argv.index('--') + 1].split(','):
    cam = bpy.data.objects.get('V13.1 | ' + n) or bpy.data.objects.get('V13 | ' + n) or bpy.data.objects.get(OLD.get(n, ''))
    if cam is None:
        print('no camera', n)
        continue
    sc.camera = cam
    cam.data.clip_end = 30000
    sc.render.resolution_x, sc.render.resolution_y = (1600, 1100) if n == 'i_neon_street_fuji' else ((800, 450) if n.startswith(('sweep', 'sweephi')) else (1600, 900))
    lights = sorted([o for o in sc.objects if o.type == 'LIGHT' and o.data.type != 'SUN'], key=lambda o: (o.matrix_world.translation - cam.matrix_world.translation).length)
    for k, o in enumerate(lights):
        o.data.use_shadow = k < 14
    sc.render.filepath = str(O / f'v13_1_{n}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', n, flush=True)
