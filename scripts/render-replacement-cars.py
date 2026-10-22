import bpy,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
out=root/'sources/sketchfab/replacement-imports/review';out.mkdir(exist_ok=True)
for key,color in [('mp1x',(0.85,.18,.025,1)),('jaguarxkjss',(.5,.55,.62,1)),('nuvolari',(.65,.7,.74,1))]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/'assets/cars'/key/'car_lod0.glb'))
 for m in bpy.data.materials:
  role=m.name.split('|')[0]
  if not m.use_nodes:continue
  bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if not bs:continue
  if role in ['paint','mirrorPaint']:
   for link in list(bs.inputs['Base Color'].links):m.node_tree.links.remove(link)
   bs.inputs['Base Color'].default_value=color;bs.inputs['Metallic'].default_value=.65;bs.inputs['Roughness'].default_value=.22;bs.inputs['Coat Weight'].default_value=.8
  if role in ['head','tail']:
   bs.inputs['Emission Color'].default_value=(1,.02,.01,1) if role=='tail' else (.7,.85,1,1)
   bs.inputs['Emission Strength'].default_value=2
 bpy.ops.mesh.primitive_plane_add(size=200)
 floor=bpy.context.object;floor.name='studio-floor';mat=bpy.data.materials.new('floor');mat.diffuse_color=(.045,.055,.065,1);floor.data.materials.append(mat)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
 scene.world=bpy.data.worlds.new('Studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.2,.25,1)
 for loc,power,size in [((-3,-4,6),1600,5),((2,3,5),2000,4),((0,-1,6),1000,4)]:
  bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,.6))-light.location).to_track_quat('-Z','Y').to_euler()
 scene.render.resolution_x=1100;scene.render.resolution_y=680;scene.render.resolution_percentage=100
 scene.view_settings.view_transform='AgX'
 for view,loc in [('front',(-6.8,-6,3.1)),('rear',(6.8,6,2.8))]:
  bpy.ops.object.camera_add(location=loc);cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=52;scene.camera=cam
  scene.render.filepath=str(out/(key+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
