"""Faint generated Mount Fuji matte behind the existing distant city."""
import bpy,json,ast
from pathlib import Path
from mathutils import Vector
H=Path(__file__).resolve().parent;O=H/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_park_wheel_v6.blend'));s=bpy.context.scene
for node in ast.parse((H/'overhaul_v3.py').read_text(encoding='utf8')).body:
    if isinstance(node,ast.FunctionDef) and node.name=='camera':exec(compile(ast.Module(body=[node],type_ignores=[]),'<helpers>','exec'))
C=bpy.data.collections.new('V7 | distant Mount Fuji matte');s.collection.children.link(C)
im=bpy.data.images.load(str(H/'textures/mount_fuji_night_cutout_v1.png'));im.pack()
m=bpy.data.materials.new('V7 Fuji | faint atmospheric matte');m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
out=nt.nodes.new('ShaderNodeOutputMaterial');mix=nt.nodes.new('ShaderNodeMixShader');tr=nt.nodes.new('ShaderNodeBsdfTransparent');em=nt.nodes.new('ShaderNodeEmission');tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im
hs=nt.nodes.new('ShaderNodeHueSaturation');hs.inputs['Saturation'].default_value=.42;hs.inputs['Value'].default_value=.65;nt.links.new(tex.outputs['Color'],hs.inputs['Color']);nt.links.new(hs.outputs[0],em.inputs['Color']);em.inputs['Strength'].default_value=.75
uv=nt.nodes.new('ShaderNodeTexCoord');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(uv.outputs['UV'],sep.inputs[0]);fade=nt.nodes.new('ShaderNodeMapRange');fade.inputs['From Min'].default_value=.10;fade.inputs['From Max'].default_value=.42;fade.inputs['To Min'].default_value=0;fade.inputs['To Max'].default_value=.46;fade.clamp=True;nt.links.new(sep.outputs['Y'],fade.inputs[0]);alpha=nt.nodes.new('ShaderNodeMath');alpha.operation='MULTIPLY';nt.links.new(tex.outputs['Alpha'],alpha.inputs[0]);nt.links.new(fade.outputs[0],alpha.inputs[1]);nt.links.new(alpha.outputs[0],mix.inputs[0]);nt.links.new(tr.outputs[0],mix.inputs[1]);nt.links.new(em.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],out.inputs['Surface'])
width=6800;height=width*im.size[1]/im.size[0];x=6500;cy=800;bottom=-260
me=bpy.data.meshes.new('Fuji distant matte | two triangles');me.from_pydata([(x,cy-width/2,bottom),(x,cy+width/2,bottom),(x,cy+width/2,bottom+height),(x,cy-width/2,bottom+height)],[],[(0,1,2,3)]);me.materials.append(m);uv=me.uv_layers.new(name='UVMap')
coords=[(0,0),(1,0),(1,1),(0,1)]
for loop in me.loops:uv.data[loop.index].uv=coords[loop.vertex_index]
ob=bpy.data.objects.new('Mount Fuji | faint skyline backdrop',me);C.objects.link(ob)
ob.visible_shadow=False;ob.visible_diffuse=False;ob.visible_glossy=False;ob['purpose']='Distant camera-only matte behind the city; no collision or near-camera use';ob['source']='Original AI-generated transparent Mount Fuji night cutout';ob['triangles']=2
cam=camera('V7 | Fuji behind Tokyo skyline',(350,-1100,18),(6500,800,750),35)
s.camera=cam;s.cycles.samples=40;s['latest_addition']='Faint distant Mount Fuji matte behind skyline; 2 triangles, packed RGBA texture'
report={'texture':'../textures/mount_fuji_night_cutout_v1.png','generator':'Built-in image_gen','placement':[x,cy,bottom],'width_m':width,'height_m':height,'triangles':2,'maximum_opacity':.46,'foot_fade_uv':[.10,.42],'behind_existing_skyline':True,'geography':'Fictional art-directed arrangement','runtime_exported':False}
(O/'mount-fuji-v7.json').write_text(json.dumps(report,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_fuji_v7.blend'))
s.render.filepath=str(O/'fuji_skyline_v7.png');bpy.ops.render.render(write_still=True)
print('FUJI_BACKDROP_COMPLETE',flush=True)
