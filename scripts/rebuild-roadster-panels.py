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
directory=ROOT/'meshy_output/body-batch-4/tesla1'
refine_pass='--refine-pass' in sys.argv
source=directory/('model-refined-pass1.glb' if refine_pass else 'model-clean.glb');output=directory/'model-coachwork.glb'
raw=source.read_bytes();jlen=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+jlen]);binary=bytearray(raw[28+jlen:])
primitive=doc['meshes'][0]['primitives'][0]
def array(i):
 a=doc['accessors'][i];b=doc['bufferViews'][a['bufferView']]
 return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*(3 if a['type']=='VEC3' else 1),offset=b.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
positions=array(primitive['attributes']['POSITION']);original=positions.astype(float)
faces=array(primitive['indices']).reshape(-1,3)
lo,hi=original.min(0),original.max(0)
profile=json.loads((ROOT/'car-lab/src/vehicle/profiles/tesla1.json').read_text())
lo,hi=np.array(profile['body']['normalizationBounds']);origin=np.array([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]);scale=4.6/(hi[0]-lo[0])
v=(original-origin)*scale;before=v.copy()
mesh=trimesh.Trimesh(v,faces,process=False)
receipts=[]
def fade(t):
 t=np.clip(t,0,1);return t*t*(3-2*t)
def polynomial(u,w,degree):return np.polynomial.polynomial.polyvander2d(u,w,degree).reshape(len(u),-1)
def fair(name,axis,uaxis,waxis,ubounds,wbounds,degree,selection,mirrored=False):
 # Sample actual outer paint surfaces rather than hidden cabin or wheel-well walls.
 points=np.array([[u,w] for u in np.linspace(*ubounds,49) for w in np.linspace(*wbounds,37)])
 origins=np.zeros((len(points),3));origins[:,uaxis]=points[:,0];origins[:,waxis]=points[:,1];origins[:,axis]=3
 directions=np.zeros_like(origins);directions[:,axis]=-1
 hits,ids,_=mesh.ray.intersects_location(origins,directions,multiple_hits=False)
 okay=hits[:,axis]>(.35 if axis==1 else .6);hits=hits[okay]
 u=(hits[:,uaxis]-np.mean(ubounds))/(np.ptp(ubounds)/2);w=(hits[:,waxis]-np.mean(wbounds))/(np.ptp(wbounds)/2)
 A=polynomial(u,w,degree);weights=np.ones(len(hits))
 for _ in range(8):
  coeff=np.linalg.lstsq(A*weights[:,None],hits[:,axis]*weights,rcond=None)[0]
  residual=hits[:,axis]-A@coeff;weights=np.minimum(1,.012/np.maximum(abs(residual),1e-9))
 x=v[:,uaxis];y=v[:,waxis]
 interior=fade((x-ubounds[0])/.10)*fade((ubounds[1]-x)/.10)*fade((y-wbounds[0])/.07)*fade((wbounds[1]-y)/.07)
 selection_weight=selection(v).astype(float);interior*=selection_weight
 mask=(selection_weight>0)&(interior>0)
 at=polynomial((x[mask]-np.mean(ubounds))/(np.ptp(ubounds)/2),(y[mask]-np.mean(wbounds))/(np.ptp(wbounds)/2),degree)@coeff
 current=abs(v[mask,axis]) if mirrored else v[mask,axis]
 change=np.clip(at-current,-.045,.045)*interior[mask]
 v[mask,axis]+=change*(np.sign(v[mask,axis]) if mirrored else 1)
 receipts.append(dict(panel=name,vertices=int(mask.sum()),sampleCount=len(hits),rmsCorrectionMetres=float(np.sqrt(np.mean(change**2))),maxCorrectionMetres=float(abs(change).max())))

fair('left/right door skins',2,0,1,(-.94,.94),(.18,.83),(3,3),lambda p:fade((abs(p[:,2])-.68)/.10),True)
fair('hood',1,0,2,(-2.06,-.78),(-.65,.65),(3,4),lambda p:fade((p[:,1]-.48)/.08)*fade((.88-p[:,1])/.08))
fair('roof crown',1,0,2,(-.22,1.0),(-.48,.48),(3,3),lambda p:fade((p[:,1]-1.02)/.06))
fair('rear fender skins',2,0,1,(.90,1.95),(.29,.87),(3,3),lambda p:fade((abs(p[:,2])-.76)/.10),True)
fair('front fender skins',2,0,1,(-1.98,-.86),(.31,.84),(3,3),lambda p:fade((abs(p[:,2])-.76)/.10),True)

# Deliberate shoulder and sill folds: localized changes in surface slope,
# not a global normal blur. Existing lamp and window frames remain outside these bands.
for center,amount,width in [(.665,.011,.038),(.285,-.009,.032)]:
 band=fade((v[:,0]+.86)/.12)*fade((.88-v[:,0])/.12)
 band*=np.exp(-abs((v[:,1]-center)/width)**1.15)*fade((abs(v[:,2])-.72)/.10)*fade((v[:,1]-.21)/.05)*fade((.78-v[:,1])/.05)
 mask=(abs(v[:,2])>.72)&(v[:,1]>.21)&(v[:,1]<.78)
 v[mask,2]+=np.sign(v[mask,2])*amount*band[mask]
# Raised hood/fender boundaries taper naturally into the cowl and nose.
hood_weight=fade((v[:,0]+2.0)/.18)*fade((-.80-v[:,0])/.15)
ridge=np.exp(-((abs(v[:,2])-.46)/.035)**2)*.009*hood_weight
v[:,1]+=ridge*fade((v[:,1]-.48)/.10)*fade((.89-v[:,1])/.06)

def curve(points,count=300):
 p=np.array(points);t=np.r_[0,np.cumsum(np.linalg.norm(np.diff(p,axis=0),axis=1))]
 return PchipInterpolator(t,p,axis=0)(np.linspace(0,t[-1],count))
guides={
 'door':dict(axis=2,axes=[0,1],guide=[[-.61,.775],[-.73,.61],[-.76,.34],[-.67,.225],[-.36,.205],[.38,.205],[.61,.25],[.72,.43],[.70,.67],[.64,.825]],width=.0035,depth=.005),
 'hood':dict(axis=1,axes=[0,2],guide=[[-1.00,-.56],[-1.15,-.55],[-1.63,-.47],[-1.98,-.36],[-2.04,0],[-1.98,.36],[-1.63,.47],[-1.15,.55],[-1.00,.56]],width=.0035,depth=.004),
 'hatch':dict(axis=1,axes=[0,2],guide=[[1.60,-.56],[1.83,-.54],[2.01,-.42],[2.09,0],[2.01,.42],[1.83,.54],[1.60,.56]],width=.0035,depth=.004)
}
for name,spec in guides.items():
 path=curve(spec['guide'],600);distance=cKDTree(path).query(v[:,spec['axes']],workers=-1)[0]
 weight=np.exp(-.5*(distance/.0035)**2)
 mask=(abs(v[:,2])>.60) if name=='door' else (v[:,1]>.45)
 delta=spec['depth']*weight*mask
 v[:,spec['axis']]-=delta*(np.sign(v[:,2]) if name=='door' else 1)

# Limit local changes near thin triangles without discarding the broad panel repair.
original_fv=np.cross(before[faces[:,1]]-before[faces[:,0]],before[faces[:,2]]-before[faces[:,0]])
meaningful=np.linalg.norm(original_fv,axis=1)>1e-10
for orientation_pass in range(1000):
 if refine_pass:break # This intermediate is immediately rebuilt with Blender voxel topology.
 current_fv=np.cross(v[faces[:,1]]-v[faces[:,0]],v[faces[:,2]]-v[faces[:,0]])
 flipped=(np.sum(current_fv*original_fv,axis=1)<=0)&meaningful
 if not flipped.any():break
 affected=np.unique(faces[flipped]);v[affected]=before[affected]+(v[affected]-before[affected])*.5
else:raise ValueError('Could not preserve face orientation during panel rebuild')

# Recalculate normals from repaired geometry before filtering triangle-fan noise.
def normals(points):
 n=np.zeros_like(points);fv=np.cross(points[faces[:,1]]-points[faces[:,0]],points[faces[:,2]]-points[faces[:,0]])
 for c in range(3):np.add.at(n,faces[:,c],fv)
 return n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20)
positions[:]=v/scale+origin
surface_normals=normals(v)
# Suppress triangle-fan highlight noise while retaining hard aperture boundaries.
# Panel gaps remain real depressions plus separately fitted dark recess surfaces.
edges=np.unique(np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1),axis=0)
alignment=np.sum(surface_normals[edges[:,0]]*surface_normals[edges[:,1]],axis=1)
edges=edges[alignment>np.cos(np.deg2rad(60))]
rows=np.r_[edges[:,0],edges[:,1]];cols=np.r_[edges[:,1],edges[:,0]]
adj=sparse.csr_matrix((np.ones(len(rows)),(rows,cols)),shape=(len(v),len(v)))
adj=sparse.diags(1/np.maximum(np.asarray(adj.sum(1)).ravel(),1))@adj
for _ in range(160):
 surface_normals=.5*surface_normals+.5*(adj@surface_normals)
 surface_normals/=np.maximum(np.linalg.norm(surface_normals,axis=1)[:,None],1e-20)
array(primitive['attributes']['NORMAL'])[:]=surface_normals
a=doc['accessors'][primitive['attributes']['POSITION']];a['min']=positions.min(0).tolist();a['max']=positions.max(0).tolist()
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
result=struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
output.write_bytes(result);sha=hashlib.sha256(result).hexdigest().upper()

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
 hit,_,_=mesh.ray.intersects_location([[.43,.748,3*sign]],[[0,0,-sign]],multiple_hits=False)
 if len(hit):handles.append([round(float(x),6) for x in hit[0]+[0,0,sign*.004]])
coachwork=dict(sourceSha256=sha,seams=seams,handles=handles)
(directory/'coachwork-details.json').write_text(json.dumps(coachwork,indent=2))
receipt=dict(method='semantic-panel-refit-and-recessed-gaps-v1',sourceFile=str(source.relative_to(ROOT)),sourceSha256=hashlib.sha256(raw).hexdigest().upper(),file=str(output.relative_to(ROOT)),sha256=sha,triangles=len(faces),panels=receipts,maxDisplacementMetres=float(np.linalg.norm(v-before,axis=1).max()),topologyPreserved=True,orientationGuardApplied=not refine_pass,seamCount=len(seams),requiresBlenderRemesh=refine_pass)
(directory/'coachwork-rebuild.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
