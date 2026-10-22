"""Cut the filled canopy out of the local Furari derivative and fit real glazing."""
import json,struct,hashlib,sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/raceultimate-render-tools'))
import trimesh
root=Path(__file__).resolve().parents[1];d=root/'meshy_output/body-batch-5/furari-488';pf=root/'car-lab/src/vehicle/profiles/furari-488.json';p=json.loads(pf.read_text())
raw=(d/'model-clean.glb').read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);binary=bytearray(raw[28+size:]);q=doc['meshes'][0]['primitives'][0]
def acc(i):
 a=doc['accessors'][i];view=doc['bufferViews'][a['bufferView']]
 return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*(3 if a['type']=='VEC3' else 1),offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
lo,hi=np.array(p['body']['normalizationBounds']);v=(acc(q['attributes']['POSITION']).astype(float)-[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2])*4.6/(hi[0]-lo[0]);indices=acc(q['indices']);faces=indices.reshape(-1,3);mesh=trimesh.Trimesh(v,faces,process=False);centers=v[faces].mean(1);cut=np.zeros(len(faces),bool)
fits={}
for name,xa,xb,za,zb in [('windshield',-.70,-.12,.65,.48),('rear',.48,1.30,.44,.56)]:
 rows=33;cols=41;origins=[]
 for t in np.linspace(0,1,rows):
  for s in np.linspace(0,1,cols):
   x=xa+(xb-xa)*s;z=(1-2*t)*(za+(zb-za)*s);origins.append([x,3,z])
 hit,ids,_=mesh.ray.intersects_location(origins,np.tile([0,-1,0],(len(origins),1)),multiple_hits=False);assert len(ids)==len(origins),'Glazing sample left actual surface'
 points=np.zeros_like(origins,dtype=float);points[ids]=hit;points[:,1]+=.002
 fits[name]=dict(rows=rows,columns=cols,points=points.round(6).tolist())
 x=centers[:,0];half=za+(zb-za)*(x-xa)/(xb-xa)
 cut|=(x>xa)&(x<xb)&(abs(centers[:,2])<half)&(centers[:,1]>.57)
keep=faces[~cut].copy();indices.ravel()[:keep.size]=keep.ravel();doc['accessors'][q['indices']]['count']=keep.size
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
result=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
file=d/'model-assembly.glb';file.write_bytes(result);sha=hashlib.sha256(result).hexdigest().upper()
p['body'].update(file='meshy_output/body-batch-5/furari-488/model-assembly.glb',sha256=sha,url='/models/furari-488-body-shell.glb?v='+sha[:12].lower(),triangles=len(keep),surfaceCleanup='bounded-fairing-and-fitted-glazing-apertures-v1')
p['glassFits']=dict(sourceSha256=sha,**fits);p['exhaust']['sourceSha256']=sha;pf.write_text(json.dumps(p,indent=2)+'\n')
receipt=dict(sourceSha256=hashlib.sha256(raw).hexdigest().upper(),sha256=sha,triangles=len(keep),removedTriangles=int(cut.sum()),method='fitted-glazing-apertures-v1',sourceMeshPreserved=True,providerCalls=0)
(d/'glazing-apertures.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
