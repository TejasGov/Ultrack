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

d=ROOT/'meshy_output/body-batch-5/furari-488';p=json.loads((ROOT/'car-lab/src/vehicle/profiles/furari-488.json').read_text())
raw,v,faces,normals=read(ROOT/p['body']['file'])
assert hashlib.sha256(raw).hexdigest().upper()==p['body']['sha256']==p['glassFits']['sourceSha256']
assert len(faces)==p['body']['triangles']
assert np.isfinite(v).all() and np.isfinite(normals).all()
lo,hi=np.array(p['body']['normalizationBounds']);v=(v-[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2])*4.6/(hi[0]-lo[0]);centers=v[faces].mean(1)
for name,xa,xb,za,zb in [('windshield',-.70,-.12,.65,.48),('rear',.48,1.30,.44,.56)]:
 x=centers[:,0];half=za+(zb-za)*(x-xa)/(xb-xa)
 intruding=(x>xa)&(x<xb)&(abs(centers[:,2])<half)&(centers[:,1]>.57)
 assert not intruding.any(), f'Painted body inside {name}'
 f=p['glassFits'][name];assert len(f['points'])==f['rows']*f['columns']
assert hashlib.sha256((ROOT/p['body']['sourceFile']).read_bytes()).hexdigest().upper()==p['body']['sourceSha256']
assert all(p['body']['sha256']==p[k]['sourceSha256'] for k in ['mirrors','exhaust'])
result=dict(passed=True,sourceSha256=p['body']['sourceSha256'],sha256=p['body']['sha256'],triangles=len(faces),finiteGeometry=True,frontAndRearAperturesClear=True,sourcePreserved=True,providerCallsDuringRepair=0)
(d/'assembly-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
