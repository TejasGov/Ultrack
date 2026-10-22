import bpy,json
from pathlib import Path
O=Path(__file__).resolve().parent/'out';bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_fuji_v7.blend'));s=bpy.context.scene
bpy.data.materials['V7 Fuji | faint atmospheric matte'].node_tree.nodes['Map Range'].inputs['To Max'].default_value=.30
r=json.loads((O/'mount-fuji-v7.json').read_text());r['maximum_opacity']=.30;(O/'mount-fuji-v7.json').write_text(json.dumps(r,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_fuji_v7.blend'));s.render.filepath=str(O/'fuji_skyline_v7.png');bpy.ops.render.render(write_still=True)
