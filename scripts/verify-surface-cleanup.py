"""Check the actual cleaned assets, including topology, limits and face orientation."""
import json,struct,hashlib,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
def read(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
 q=doc['meshes'][0]['primitives'][0]
 def acc(i):
  a=doc['accessors'][i];b=doc['bufferViews'][a['bufferView']]
  return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*(3 if a['type']=='VEC3' else 1),offset=b.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
 return raw,acc(q['attributes']['POSITION']).astype(float),acc(q['indices']).reshape(-1,3),acc(q['attributes']['NORMAL']).astype(float)
for key in ([sys.argv[1]] if len(sys.argv)>1 else ['jaguarxkjss','nuvolari','tesla1']):
 directory=ROOT/f'meshy_output/body-batch-{int(sys.argv[2]) if len(sys.argv)>2 else 4}'/key;r=json.loads((directory/'surface-cleanup.json').read_text())
 original,a,faces,_=read(directory/'model.glb');clean,b,indices,normals=read(directory/'model-clean.glb')
 assert hashlib.sha256(original).hexdigest().upper()==r['sourceSha256']
 assert hashlib.sha256(clean).hexdigest().upper()==r['sha256']
 assert np.array_equal(faces,indices) and a.shape==b.shape
 assert np.isfinite(b).all() and np.isfinite(normals).all()
 scale=4.6/np.ptp(a[:,0]);movement=np.linalg.norm(a-b,axis=1)*scale
 assert movement.max()<=.012001
 an=np.cross(a[faces[:,1]]-a[faces[:,0]],a[faces[:,2]]-a[faces[:,0]])
 bn=np.cross(b[faces[:,1]]-b[faces[:,0]],b[faces[:,2]]-b[faces[:,0]])
 meaningful=np.linalg.norm(an,axis=1)>1e-10
 assert (np.sum(an[meaningful]*bn[meaningful],axis=1)>0).all(),'New inverted face'
 used=np.unique(faces[meaningful]);length=np.linalg.norm(normals[used],axis=1)
 assert np.max(abs(length-1))<1e-4,'Non-unit shading normal'
 assert r['laplacianRoughnessAfter']<r['laplacianRoughnessBefore']
 result=dict(car=key,passed=True,topologyPreserved=True,faceOrientationPreserved=True,sourceUnchanged=True,maxDisplacementMetres=float(movement.max()),roughnessReduction=1-r['laplacianRoughnessAfter']/r['laplacianRoughnessBefore'])
 (directory/'surface-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
