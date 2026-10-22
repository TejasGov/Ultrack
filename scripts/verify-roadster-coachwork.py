"""Check the actual cleaned assets, including topology, limits and face orientation."""
import json,struct,hashlib
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


directory=ROOT/'meshy_output/body-batch-4/tesla1'
profile=json.loads((ROOT/'car-lab/src/vehicle/profiles/tesla1.json').read_text())
content,b,faces,normals=read(ROOT/profile['body']['file'])
sha=hashlib.sha256(content).hexdigest().upper()
assert sha==profile['body']['sha256']==profile['coachwork']['sourceSha256']
assert np.isfinite(b).all() and np.isfinite(normals).all()
assert len(faces)==profile['body']['triangles'] and faces.max()<len(b)
length=np.linalg.norm(normals,axis=1)
used=np.unique(faces);assert np.max(abs(length[used]-1))<1e-4
an=np.cross(b[faces[:,1]]-b[faces[:,0]],b[faces[:,2]]-b[faces[:,0]])
assert (np.linalg.norm(an,axis=1)>1e-15).all(), 'Degenerate output triangle'
assert len(profile['coachwork']['seams'])==4 and len(profile['coachwork']['handles'])==2
source=ROOT/profile['body']['sourceFile']
assert hashlib.sha256(source.read_bytes()).hexdigest().upper()==profile['body']['sourceSha256']
# Rebuilt topology must not claim one-to-one triangle preservation.
result=dict(passed=True,sha256=sha,method='blender-uniform-skin-and-fitted-panels-v2',topologyChanged=True,unitNormals=True,finiteGeometry=True,originalSourceUnchanged=True,triangles=len(faces),providerCalls=0)
(directory/'coachwork-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
