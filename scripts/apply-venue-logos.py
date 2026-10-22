"""Apply shared source-board replacements without rebuilding the track layout or collision."""
import bpy,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tracks/marina'))
import brand_art
bpy.ops.wm.open_mainfile(filepath=str(root/'tracks/marina/out/marina.blend'))
plan=json.loads((root/'assets/sponsors/board-plan.json').read_text(encoding='utf-8'))
brands={b['id']:b for b in brand_art.BRANDS};changed=0;instances=0
for p in plan:
 old=bpy.data.meshes.get(p['mesh'])
 if not old:continue
 replacement=brand_art.board_mesh(p['mesh']+'_logos',brands[p['brand']],p['w'],p['h'],p['flat'],p['emissive'])
 # Keep the original transform and sharing of every fence/banner/billboard instance.
 for obj in bpy.data.objects:
  if obj.type=='MESH' and obj.data==old:obj.data=replacement;instances+=1
 changed+=1
report={'meshDefinitions':changed,'placedInstances':instances,'brands':sorted({p['brand'] for p in plan}),'collisionChanged':False}
(root/'assets/sponsors/integration-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'tracks/marina/out/marina-logos.blend'))
bpy.ops.object.select_all(action='DESELECT');objects=list(bpy.data.collections['Visual'].all_objects)
for o in objects:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(root/'tracks/marina/out/marina_visual.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_extras=True,export_gpu_instances=True)
print('LOGO REPORT',report)
