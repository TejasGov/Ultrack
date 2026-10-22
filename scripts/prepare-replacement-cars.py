"""Prepare the three licensed source cars for the existing complete-car pipeline."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];base=root/'sources/sketchfab/replacement-imports'
for key in ['mclaren720s','amgone','etron']:
 bpy.ops.wm.open_mainfile(filepath=str(base/(key+'-source.blend')))
 folder=base/key
 canonical=lambda x:Path(x.replace('\\','/')).name.lower().replace(' ','_')
 images={canonical(str(p)):p for p in folder.rglob('*') if p.suffix.lower() in ['.png','.jpg','.jpeg']}
 missing=[]
 for image in bpy.data.images:
  if image.source!='FILE':continue
  name=canonical(image.filepath)
  if name in images:image.filepath=str(images[name].resolve());image.reload()
  elif image.packed_file is None:missing.append(image.filepath)
 assert not missing, f'{key} missing images {missing}'
 # Each object must have one source material so semantic roles are not lost on join.
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH' or len(o.data.materials)<2:continue
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
 # The McLaren has one lamp material covering the front and rear: split it by world X.
 if key=='mclaren720s':
  for o in list(bpy.context.scene.objects):
   if o.type!='MESH' or not o.data.materials or o.data.materials[0].name!='lights':continue
   front=[p for p in o.data.polygons if (o.matrix_world@p.center).x<0]
   if front and len(front)<len(o.data.polygons):
    dup=o.copy();dup.data=o.data.copy();bpy.context.collection.objects.link(dup)
    for obj,want_front in [(o,True),(dup,False)]:
     bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.delete(bm,geom=[f for f in bm.faces if ((obj.matrix_world@f.calc_center_median()).x<0)!=want_front],context='FACES');bm.to_mesh(obj.data);bm.free()
 src_mats={}
 for o in bpy.context.scene.objects:
  if o.type!='MESH' or not o.data.materials:continue
  m=o.data.materials[0];name=m.name;role='keep';old=o.name
  if key=='mclaren720s':
   role={'body':'paint','glass':'glass','mirror':'mirror'}.get(name,'keep')
   if 'side mirrors' in old:role='mirrorPaint' if name=='body' else 'mirror' if name=='mirror' else 'mirrorHousing'
   if name=='lights':role='head' if sum((o.matrix_world@v.co).x for v in o.data.vertices)/max(1,len(o.data.vertices))<0 else 'tail'
   if old.startswith('tyres'):o.name=('Tyre_' if name=='tyres' else 'Spin_')+old
   elif old.startswith('brake dics'):o.name='Spin_'+old
  elif key=='amgone':
   role={'Material.001':'paint','glass':'glass','MIRROR':'mirror','Material.009':'head','brake_lamp':'tail'}.get(name,'keep')
   if old=='Object_48':role='mirrorHousing'
   if name in ['tyre_blk','tyre']:o.name=('Tyre_' if name=='tyre_blk' else 'Spin_')+old
   if old in ['Object_65','Object_67','Object_85','Object_87','Object_94','Object_95','Object_97','Object_98','Object_100','Object_101','Object_103','Object_104']:o.name='Spin_'+old
   if old in ['Object_106','Object_108','Object_110','Object_112']:o.name='Caliper_'+old;role='caliper'
  else:
   role='paint' if name in ['CarPaint','CarPaint_2'] else 'glass' if name in ['D_glass','gt:Vehicle_Exterior_mm_windows1'] else 'keep'
   if 'MIRROR_GLASS' in old:role='mirror'
   elif 'MIRROR_' in old:role='mirrorPaint' if role=='paint' else 'mirrorHousing'
   if name=='TL':role='head' if 'HEADLIGHT' in old else 'tail'
   if 'TYRE' in old:o.name='Tyre_'+old
   elif 'WHEEL_' in old and not old.startswith('INT:'):o.name='Spin_'+old
   elif 'rotor' in name.lower():o.name='Spin_'+old
   elif 'BRAKE_CALIPER' in old:o.name='Caliper_'+old;role='caliper'
  tag=role+'|'+name
  if tag not in src_mats:
   copy=m.copy();copy.name=tag;src_mats[tag]=copy
  o.data.materials[0]=src_mats[tag]
 # Keep source maps for non-painted details; wire missing FBX maps to their repaired local files.
 bpy.ops.object.select_all(action='DESELECT')
 for o in bpy.context.scene.objects:
  if o.type=='MESH':o.select_set(True)
 out=base/(key+'-prepared.glb')
 bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_image_format='AUTO')
 print('PREPARED',key,out)
