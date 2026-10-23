"""EEVEE review renders of out/tokyo_v13.blend (<=16 samples, 1600x900), one process, not saved back.

  powershell tracks/tokyo/run_blender.ps1 -Blend tracks/tokyo/out/tokyo_v13.blend -Script tracks/tokyo/render_v13.py -Rest a_start_straight,n_hq_from_start
Writes out/v13_<name>.png. Shadows: only the 14 lights nearest the camera cast shadows (the shadow buffer is limited), plus the moon.
"""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v12_common as C  # noqa: E402

O = C.O
OLD = {
    'g_tunnel_bridge': 'V10 review | driving into submerged tunnel', 'i_neon_street_fuji': 'V8 | neon avenue toward Fuji',
    'h_ferris_wheel': 'V6 | wheel across park', 'j_bridge_night': 'V5 | bridge driving view', 'k_castle': 'V10 review | white castle',
    'l_flowing_hq': 'V10 review | garden bridge and flowing HQ', 'm_lantern_hall': 'V10 review | lantern hall',
}
sc = bpy.context.scene
names = sys.argv[sys.argv.index('--') + 1].split(',')
for n in names:
    cam = bpy.data.objects.get('V13 | ' + n) or bpy.data.objects.get('V12 | ' + n) or bpy.data.objects.get(OLD.get(n, ''))
    if cam is None:
        print('no camera', n)
        continue
    sc.camera = cam
    cam.data.clip_end = 20000
    sc.render.resolution_x, sc.render.resolution_y = (1600, 1100) if n == 'i_neon_street_fuji' else (1600, 900)
    lights = sorted([o for o in sc.objects if o.type == 'LIGHT' and o.data.type != 'SUN'], key=lambda o: (o.matrix_world.translation - cam.matrix_world.translation).length)
    for k, o in enumerate(lights):
        o.data.use_shadow = k < 14
    sc.render.filepath = str(O / f'v13_{n}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', n, flush=True)
