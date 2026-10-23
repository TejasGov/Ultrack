"""EEVEE review renders (<=16 samples, 1600x900), one Blender process, not saved back.

  powershell tracks/tokyo/run_blender.ps1 -Blend tracks/tokyo/out/tokyo_v12.blend -Script tracks/tokyo/render_v12.py -Rest a_start_straight,f_stand_clearance
  powershell tracks/tokyo/run_blender.ps1 -Blend tracks/tokyo/out/tokyo_japanese_v10.blend -Script tracks/tokyo/render_v12.py -Rest v10:a_start_straight,v10:f_stand_clearance

Names: V12 cameras ('V12 | <name>') and the older review cameras by key below. A 'v10:' prefix writes out/v10_before_<name>.png
(the v10 file gets the same night world / EEVEE rig for a fair before/after), otherwise out/v12_<name>.png.
"""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v12_common as C  # noqa: E402

O = C.O
OLD = {   # reference-matching cameras that already exist in the v10 / v12 file
    'g_tunnel_bridge': 'V10 review | driving into submerged tunnel',
    'i_neon_street_fuji': 'V8 | neon avenue toward Fuji',
    'h_ferris_wheel': 'V6 | wheel across park',
    'j_bridge_night': 'V5 | bridge driving view',
    'k_castle': 'V10 review | white castle',
    'l_flowing_hq': 'V10 review | garden bridge and flowing HQ',
    'm_lantern_hall': 'V10 review | lantern hall',
}
sc = bpy.context.scene
names = sys.argv[sys.argv.index('--') + 1].split(',')
cl = C.CL()
is_v10 = 'japanese_v10' in bpy.data.filepath
if is_v10:
    C.night_world(sc)
    C.setup_eevee(sc)
    for nm, (loc, tgt, lens) in C.cameras(cl).items():
        cam = bpy.data.objects.new('V12 | ' + nm, bpy.data.cameras.new(nm))
        sc.collection.objects.link(cam)
        cam.location = loc
        from mathutils import Vector
        cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        cam.data.lens = lens
        cam.data.clip_end = 20000
for n in names:
    pre, _, key = n.rpartition(':')
    cam = bpy.data.objects.get(OLD.get(key) or ('V12 | ' + key))
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = (1600, 1100) if key == 'i_neon_street_fuji' else (1600, 900)    # ref 10 is 1600x1100
    cam.data.clip_end = 20000
    sc.render.filepath = str(O / (f'v10_before_{key}.png' if pre == 'v10' else f'v12_{key}.png'))
    bpy.ops.render.render(write_still=True)
    print('rendered', n, flush=True)
