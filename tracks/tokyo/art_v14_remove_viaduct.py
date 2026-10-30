"""V14: archive the offshore Wangan-style viaduct (x ~860, 420 m off the circuit, not part of the track) and everything on it: the V14 Shuto
dressing (sound walls, sodium columns and their lights, gantries and labels) and the three V9 'Expressway sign' texts. Nothing is deleted:
it moves to 'V14 | _archive' (render-excluded; game_v13_1.py skips it). The track's own viaduct (03_VIADUCT) stays.
powershell -File ../india/run_blender_locked.ps1 -Script art_v14_remove_viaduct.py -Blend out/tokyo_v14.blend"""
import bpy
from pathlib import Path
assert Path(bpy.data.filepath).name == 'tokyo_v14.blend'
arc = bpy.data.collections['V14 | _archive']
sh = bpy.data.collections.get('V14 | Shuto expressway dressing')
moved = []
if sh:
    for p in [p for p in bpy.data.collections if sh.name in p.children] + ([bpy.context.scene.collection] if sh.name in bpy.context.scene.collection.children else []):
        p.children.unlink(sh)
    arc.children.link(sh); sh.hide_render = True; moved += [o.name for o in sh.all_objects]
for o in list(bpy.data.objects):
    if o.name.startswith(('V9 offshore Wangan-style expressway viaduct', 'Expressway sign')):
        for c in list(o.users_collection): c.objects.unlink(o)
        arc.objects.link(o); moved.append(o.name)
assert arc.hide_render
print('VIADUCT archived', len(moved), flush=True)
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
