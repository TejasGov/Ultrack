"""Original logo artwork for the explicitly requested local fan-project venue."""
import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'assets/sponsors'
BRANDS=json.loads((BASE/'manifest.json').read_text(encoding='utf-8'))['brands']
LOOKUP={name.upper():b for b in BRANDS for name in [b['name'],*b['aliases']]}

def material(brand,w,h,flat=False,emissive=False):
 key=brand['id']+'-'+str(round(w/h*1000))+('-paint' if flat else '')
 name='M_AdLogo_'+key+('_led' if emissive else '')
 if name in bpy.data.materials:return bpy.data.materials[name]
 path=BASE/'boards'/(key+'.png')
 if not path.exists():raise FileNotFoundError('Prepare board texture: '+str(path))
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
 tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path),check_existing=True)
 m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.68 if flat else .45
 if flat:
  clip=m.node_tree.nodes.new('ShaderNodeMath');clip.operation='ROUND';m.node_tree.links.new(tex.outputs['Alpha'],clip.inputs[0]);m.node_tree.links.new(clip.outputs[0],bs.inputs['Alpha'])
 if emissive:m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=1.1
 m.diffuse_color=(1,1,1,1);return m

def board_mesh(name,brand,w,h,flat=False,emissive=False):
 """Shared local board: X horizontal, Z up, face toward -Y; paint lies in XY."""
 vertices=[(-w/2,0,0),(w/2,0,0),(w/2,0,h),(-w/2,0,h)]
 if flat:vertices=[(x,z,0) for x,y,z in vertices]
 m=bpy.data.meshes.new(name);m.from_pydata(vertices,[],[(0,1,2,3)]);m.materials.append(material(brand,w,h,flat,emissive))
 uv=m.uv_layers.new(name='UVMap')
 for poly in m.polygons:
  for loop,co in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[loop].uv=co
 return m
