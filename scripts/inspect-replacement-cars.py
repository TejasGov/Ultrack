import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];base=root/'sources/sketchfab/replacement-imports'
items=[('mclaren720s',base/'mclaren720s/source/Mclaren 720s.fbx'),('amgone',base/'amgone/original.glb'),('etron',base/'etron/expanded/FINAL_MODEL_GT_CONCEPT.fbx')]
for key,file in items:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 if file.suffix=='.fbx':bpy.ops.import_scene.fbx(filepath=str(file),use_image_search=True)
 else:bpy.ops.import_scene.gltf(filepath=str(file))
 result=[]
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  pts=[o.matrix_world@Vector(c) for c in o.bound_box];lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)]
  result.append(dict(name=o.name,parent=o.parent.name if o.parent else None,vertices=len(o.data.vertices),triangles=sum(len(p.vertices)-2 for p in o.data.polygons),bounds=[lo,hi],materials=[s.material.name if s.material else None for s in o.material_slots]))
 mats=[]
 for m in bpy.data.materials:
  mats.append(dict(name=m.name,diffuse=list(m.diffuse_color),nodes=[dict(type=n.type,name=n.name,image=n.image.filepath if getattr(n,'image',None) else None) for n in m.node_tree.nodes] if m.node_tree else []))
 out=dict(objects=result,materials=mats)
 (base/(key+'-inspection.json')).write_text(json.dumps(out,indent=2))
 print(key,'meshes',len(result),'tris',sum(o['triangles'] for o in result),'materials',[m['name'] for m in mats])
 print([(o['name'],o['triangles'],o['materials']) for o in result][:65])
 bpy.ops.wm.save_as_mainfile(filepath=str(base/(key+'-source.blend')))
