"""Local Blender master and render proof from the game's exported asset factories."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'car-lab/verification'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def import_collection(file,name):
 previous=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(file))
 objects=list(set(bpy.data.objects)-previous);collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
 for obj in objects:
  for old in list(obj.users_collection):old.objects.unlink(obj)
  collection.objects.link(obj)
 return collection
after=import_collection(OUT/'roadster-coachwork-assembly.glb','ROADSTER / REPAIRED ASSEMBLY')
before=import_collection(OUT/'roadster-before-assembly.glb','REFERENCE / PREVIOUS BODY')
before.hide_render=True;before.hide_viewport=True
after['source_profile']='car-lab/src/vehicle/profiles/tesla1.json'
after['rebuild_receipt']='meshy_output/body-batch-4/tesla1/coachwork-rebuild.json'
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1440;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.085,.105,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX'
def material(name,color,roughness,metallic=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic;return m
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(material('Studio charcoal',(.065,.075,.09),.5,.1))
def area(name,pos,power,size,target=(0,0,.7),scale=(1,1)):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='RECTANGLE';data.size=size*scale[0];data.size_y=size*scale[1]
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Long side reflection',(-1,-4,3.5),500,4,scale=(1,.25))
area('Overhead softbox',(0,0,5),650,4,scale=(1,.5))
area('Rear rim',(3,2,3),550,3,scale=(.5,1))
area('Front fill',(-4,1,2),180,3)
camera_data=bpy.data.cameras.new('Review camera');camera=bpy.data.objects.new('Review camera',camera_data);scene.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=5.9
def render(name,eye,target=(0,0,.68)):
 camera.location=eye;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/name);bpy.ops.render.render(write_still=True)
render('roadster-coachwork-hero-blender.png',(-4.8,-5.8,2.5))
render('roadster-coachwork-side-blender.png',(0,-7,1.25))
after.hide_render=True;before.hide_render=False
render('roadster-before-hero-blender.png',(-4.8,-5.8,2.5))
after.hide_render=False;before.hide_render=True
camera.location=(-4.8,-5.8,2.5);camera.rotation_euler=(Vector((0,0,.68))-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'meshy_output/body-batch-4/tesla1/roadster-coachwork.blend'))
print('ROADSTER_BLENDER_REVIEW_COMPLETE')
