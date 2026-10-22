"""Local, reversible panel fairing. Preserve topology and original provider GLB."""
import sys, json, struct, hashlib
from pathlib import Path
import numpy as np
from scipy import sparse

ROOT=Path(__file__).resolve().parents[1]
key=sys.argv[1]
batch=int(sys.argv[2]) if len(sys.argv)>2 else 4
directory=ROOT/f'meshy_output/body-batch-{batch}'/key
source=directory/'model.glb';output=directory/'model-clean.glb'
raw=source.read_bytes();jlen=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+jlen]);binary=bytearray(raw[28+jlen:])
if len(doc['meshes'])!=1 or len(doc['meshes'][0]['primitives'])!=1:
 raise ValueError('Inspect multi-mesh layout before cleaning.')
primitive=doc['meshes'][0]['primitives'][0]
def array(i):
 a=doc['accessors'][i];view=doc['bufferViews'][a['bufferView']]
 if view.get('byteStride') or a.get('sparse'):raise ValueError('Packed mesh required')
 return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*(3 if a['type']=='VEC3' else 1),offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
positions=array(primitive['attributes']['POSITION']);original=positions.astype(float)
faces=array(primitive['indices']).reshape(-1,3).astype(np.int32)
scale=4.6/np.ptp(original[:,0]);max_shift=.012/scale
edges=np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1)
unique,inverse,counts=np.unique(edges,axis=0,return_inverse=True,return_counts=True)
face_vectors=np.cross(original[faces[:,1]]-original[faces[:,0]],original[faces[:,2]]-original[faces[:,0]])
face_normals=face_vectors/np.maximum(np.linalg.norm(face_vectors,axis=1)[:,None],1e-20)
edge_normals=np.zeros((len(unique),3));np.add.at(edge_normals,inverse,np.tile(face_normals,(3,1)))
# Freeze boundary and truly sharp manufactured edges, preserving vents and panel gaps.
sharp=(counts!=2)|(np.linalg.norm(edge_normals,axis=1)<2*np.cos(np.deg2rad(55/2)))
locked=np.zeros(len(original),bool);locked[unique[sharp].ravel()]=True
rows=np.r_[unique[:,0],unique[:,1]];cols=np.r_[unique[:,1],unique[:,0]]
adj=sparse.csr_matrix((np.ones(len(rows)),(rows,cols)),shape=(len(original),len(original)))
adj=sparse.diags(1/np.maximum(np.asarray(adj.sum(1)).ravel(),1))@adj
v=original.copy()
for iteration in range(240):
 for weight in (.5,-.53):
  delta=(adj@v-v)*weight;delta[locked]=0;v+=delta
  offset=v-original;length=np.linalg.norm(offset,axis=1)
  v=original+offset*np.minimum(1,max_shift/np.maximum(length,1e-20))[:,None]
original_area=np.linalg.norm(face_vectors,axis=1)
# Retain orientation around thin slots: local fairing must not turn triangles over.
for attempt in range(300):
 candidate=np.cross(v[faces[:,1]]-v[faces[:,0]],v[faces[:,2]]-v[faces[:,0]])
 flipped=(np.sum(candidate*face_vectors,axis=1)<=0)&(original_area>1e-15)
 if not flipped.any():break
 v[np.unique(faces[flipped])]=original[np.unique(faces[flipped])]
else:raise ValueError('Surface cleanup could not preserve face orientation')
positions[:]=v
normals=np.zeros_like(v);fv=np.cross(v[faces[:,1]]-v[faces[:,0]],v[faces[:,2]]-v[faces[:,0]])
for corner in range(3):np.add.at(normals,faces[:,corner],fv)
normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-20)
geometric_normals=normals.copy()
# Fair the shading field as well: small reconstructed triangle fans otherwise
# leave bright zigzags in the clearcoat even after the positions are cleaned.
for iteration in range(200):
 filtered=normals*.5+(adj@normals)*.5
 filtered/=np.maximum(np.linalg.norm(filtered,axis=1)[:,None],1e-20)
 filtered[locked]=geometric_normals[locked]
 too_far=np.sum(filtered*geometric_normals,axis=1)<np.cos(np.deg2rad(25))
 filtered[too_far]=normals[too_far]
 normals=filtered
array(primitive['attributes']['NORMAL'])[:]=normals
accessor=doc['accessors'][primitive['attributes']['POSITION']];accessor['min']=v.min(0).tolist();accessor['max']=v.max(0).tolist()
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
content=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
output.write_bytes(content)
def roughness(x):return float(np.sqrt(np.mean(np.sum((adj@x-x)[~locked]**2,axis=1)))*scale)
receipt={'method':'bounded-taubin-panel-fairing-v1','iterations':240,'normalIterations':200,'maxDisplacementMetres':float(np.linalg.norm(v-original,axis=1).max()*scale),'rmsDisplacementMetres':float(np.sqrt(np.mean(np.sum((v-original)**2,axis=1)))*scale),'laplacianRoughnessBefore':roughness(original),'laplacianRoughnessAfter':roughness(v),'lockedVertices':int(locked.sum()),'triangles':len(faces),'topologyChanged':False,'sourceSha256':hashlib.sha256(raw).hexdigest().upper(),'sha256':hashlib.sha256(content).hexdigest().upper(),'normalizationBounds':[original.min(0).tolist(),original.max(0).tolist()],'sourceFile':str(source.relative_to(ROOT)).replace('\\','/'),'file':str(output.relative_to(ROOT)).replace('\\','/')}
(directory/'surface-cleanup.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt))
