"""Remove overlapping microfolds from the repaired body using a uniform Blender surface."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1];d=root/'meshy_output/body-batch-4/tesla1'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(d/'model-coachwork.glb'))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=obj
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
mod=obj.modifiers.new('Inward panel thickness','SOLIDIFY');mod.thickness=.004;mod.offset=-1
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=obj.modifiers.new('Uniform manufactured skin','REMESH');mod.mode='VOXEL';mod.voxel_size=.0018;mod.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=obj.modifiers.new('Fair remaining reconstructed folds','SMOOTH');mod.factor=.8;mod.iterations=40
bpy.ops.object.modifier_apply(modifier=mod.name)
mod=obj.modifiers.new('Reduce uniform skin density','DECIMATE');mod.ratio=.25
bpy.ops.object.modifier_apply(modifier=mod.name)
obj.data.validate(clean_customdata=False)
for f in obj.data.polygons:f.use_smooth=True
bpy.ops.export_scene.gltf(filepath=str(d/'model-refined.glb'),export_format='GLB',use_selection=True,export_materials='NONE',export_normals=True)
print('REFINED_BODY_READY',len(obj.data.polygons))

# Remove zero-area triangles introduced by triangulating decimated polygons.
import json,struct,hashlib
import numpy as np
file=d/'model-refined.glb';raw=file.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+size]);binary=bytearray(raw[28+size:]);primitive=doc['meshes'][0]['primitives'][0]
def acc(i):
 a=doc['accessors'][i];view=doc['bufferViews'][a['bufferView']]
 return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*(3 if a['type']=='VEC3' else 1),offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
v=acc(primitive['attributes']['POSITION']).astype(float);indices=acc(primitive['indices']);faces=indices.reshape(-1,3)
area=np.linalg.norm(np.cross(v[faces[:,1]]-v[faces[:,0]],v[faces[:,2]]-v[faces[:,0]]),axis=1)
keep=faces[area>1e-15].copy();indices.ravel()[:keep.size]=keep.ravel()
doc['accessors'][primitive['indices']]['count']=keep.size
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
file.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
receipt=dict(method='blender-uniform-skin-and-fitted-panels-v2',source='model-coachwork.glb',sourceSha256=hashlib.sha256((d/'model-coachwork.glb').read_bytes()).hexdigest().upper(),output='model-refined.glb',sha256=hashlib.sha256(file.read_bytes()).hexdigest().upper(),voxelSizeDonorUnits=.0018,inwardThicknessDonorUnits=.004,fairIterations=40,topologyChanged=True,triangles=len(keep),removedDegenerateTriangles=int(len(faces)-len(keep)),providerCalls=0)
(d/'blender-refinement.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
