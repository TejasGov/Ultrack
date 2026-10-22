"""Rebuild broad Roadster panel surfaces and cut deliberate panel gaps locally.

Original Meshy/cleaned files remain untouched. All work is in normalized metres;
the final GLB retains the donor coordinate frame and index topology.
"""
import json,struct,hashlib,sys
from pathlib import Path
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.spatial import cKDTree
from scipy import sparse
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/raceultimate-render-tools'))
import trimesh

ROOT=Path(__file__).resolve().parents[1]
directory=ROOT/'meshy_output/body-batch-4/nuvolari'
source=directory/'model-clean.glb'
raw=source.read_bytes();jlen=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+jlen]);binary=bytearray(raw[28+jlen:]);primitive=doc['meshes'][0]['primitives'][0]
def array(i):
 a=doc['accessors'][i];b=doc['bufferViews'][a['bufferView']]
 return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*(3 if a['type']=='VEC3' else 1),offset=b.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
positions=array(primitive['attributes']['POSITION']);faces=array(primitive['indices']).reshape(-1,3)
profile_file=ROOT/'car-lab/src/vehicle/profiles/nuvolari.json'
profile=json.loads(profile_file.read_text())
lo,hi=np.array(profile['body']['normalizationBounds']);origin=np.array([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]);scale=4.6/(hi[0]-lo[0])
v=(positions.astype(float)-origin)*scale
sha=hashlib.sha256(raw).hexdigest().upper()
def curve(points,count=300):
 p=np.array(points);t=np.r_[0,np.cumsum(np.linalg.norm(np.diff(p,axis=0),axis=1))]
 return PchipInterpolator(t,p,axis=0)(np.linspace(0,t[-1],count))
guides={
 'door':dict(axis=2,axes=[0,1],guide=[[-.61,.775],[-.73,.61],[-.76,.34],[-.67,.225],[-.36,.205],[.38,.205],[.61,.25],[.72,.43],[.70,.67],[.64,.825]],width=.0035,depth=.005),
 'hood':dict(axis=1,axes=[0,2],guide=[[-1.00,-.56],[-1.15,-.55],[-1.63,-.47],[-1.98,-.36],[-2.04,0],[-1.98,.36],[-1.63,.47],[-1.15,.55],[-1.00,.56]],width=.0035,depth=.004),
 'hatch':dict(axis=1,axes=[0,2],guide=[[1.60,-.56],[1.83,-.54],[2.01,-.42],[2.09,0],[2.01,.42],[1.83,.54],[1.60,.56]],width=.0035,depth=.004)
}
# Project visible gap ribbons independently to both repaired sides.
mesh=trimesh.Trimesh(v,faces,process=False)
seams=[]
for name,spec in guides.items():
 path=curve(spec['guide'],200)
 for sign in ([1,-1] if name=='door' else [1]):
  origin_points=np.zeros((len(path),3));origin_points[:,spec['axes']]=path;origin_points[:,spec['axis']]=3*sign
  direction=np.zeros_like(origin_points);direction[:,spec['axis']]=-sign
  hits,ids,_=mesh.ray.intersects_location(origin_points,direction,multiple_hits=False)
  points=np.zeros_like(origin_points);valid=np.zeros(len(path),bool)
  for h,i in zip(hits,ids):
   if (abs(h[2])>.5 if name=='door' else h[1]>.4):points[i]=h;valid[i]=True
  if valid.mean()<.95:raise ValueError(f'{name} does not follow a solid panel: {valid.mean()}, missing {path[~valid][::3].round(3).tolist()}')
  for c in range(3):points[:,c]=np.interp(np.arange(len(path)),np.flatnonzero(valid),points[valid,c])
  points[:,spec['axis']]+=.0009*sign
  seams.append(dict(name=name+('-left' if sign>0 else '-right') if name=='door' else name,points=points.round(6).tolist(),axis=spec['axis'],width=spec['width']))

handles=[]
for sign in [1,-1]:
 hit,_,_=mesh.ray.intersects_location([[.30,.735,3*sign]],[[0,0,-sign]],multiple_hits=False)
 if len(hit):handles.append([round(float(x),6) for x in hit[0]+[0,0,sign*.004]])
coachwork=dict(sourceSha256=sha,seams=seams,handles=handles)
(directory/'coachwork-details.json').write_text(json.dumps(coachwork,indent=2))
profile['coachwork']=coachwork
profile_file.write_text(json.dumps(profile,indent=2)+'\n')
print('Nuvolari panel and handle fits saved:',sha)
