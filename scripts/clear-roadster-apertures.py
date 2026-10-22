"""Clear generated body fragments from the intended glazing apertures."""
import json,struct,hashlib
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1];d=root/'meshy_output/body-batch-4/tesla1'
file=d/'model-refined.glb';raw=file.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);binary=bytearray(raw[28+size:]);prim=doc['meshes'][0]['primitives'][0]
def acc(i):
 a=doc['accessors'][i];view=doc['bufferViews'][a['bufferView']]
 return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*(3 if a['type']=='VEC3' else 1),offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
p=json.loads((root/'car-lab/src/vehicle/profiles/tesla1.json').read_text());lo,hi=np.array(p['body']['normalizationBounds']);origin=np.array([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]);scale=4.6/(hi[0]-lo[0])
v=(acc(prim['attributes']['POSITION']).astype(float)-origin)*scale;indices=acc(prim['indices']);faces=indices.reshape(-1,3);centers=v[faces].mean(1)
def inside(points,polygon,margin=.003):
 polygon=np.array(polygon);edges=np.roll(polygon,-1,axis=0)-polygon
 cross=edges[None,:,0]*(points[:,None,1]-polygon[None,:,1])-edges[None,:,1]*(points[:,None,0]-polygon[None,:,0])
 distance=cross/np.linalg.norm(edges,axis=1)
 return (distance>margin).all(1)|(distance<-margin).all(1)
cut=np.zeros(len(faces),bool)
for name in ['side','quarter']:
 poly=np.array(p['glass'][name]);cut|=inside(centers[:,:2],poly[:,:2])&(abs(centers[:,2])>.30)
poly=np.array(p['glass']['windshield'])
# Use X/Z footprint; retain cowl and roof boundary beyond the glazing.
cut|=inside(centers[:,[0,2]],poly[:,[0,2]],.008)&(centers[:,1]>.76)
keep=faces[~cut].copy();indices.ravel()[:keep.size]=keep.ravel();doc['accessors'][prim['indices']]['count']=keep.size
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
file.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
receipt=dict(method='profile-glazing-aperture-cut-v1',inputSha256=hashlib.sha256(raw).hexdigest().upper(),sha256=hashlib.sha256(file.read_bytes()).hexdigest().upper(),removedTriangles=int(cut.sum()),triangles=len(keep),providerCalls=0)
(d/'aperture-cleanup.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
