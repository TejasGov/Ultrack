import bpy,json
from pathlib import Path
from mathutils import Vector
O=Path(__file__).resolve().parent/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_sakura_v4.blend'))
s=bpy.context.scene;P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']]
c=bpy.data.objects['V4 | bridge approach'];c.location=P[673]+Vector((0,0,2));c.rotation_euler=(P[718]+Vector((0,0,23))-c.location).to_track_quat('-Z','Y').to_euler();c.data.lens=24;s.camera=c
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_sakura_v4.blend'))
s.render.filepath=str(O/'bridge_v4.png');bpy.ops.render.render(write_still=True)
