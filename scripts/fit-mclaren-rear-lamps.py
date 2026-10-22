"""Trace the rear recess and sample a conforming ribbon from measured mesh depth.

Guides are in world Y/Z metres. --front selects the compact headlight slots.
Each side intersects the actual triangles independently; body bytes stay unchanged.
"""
import json
import hashlib
import struct
import sys
from pathlib import Path
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import maximum_filter1d,minimum_filter1d,gaussian_filter1d
tool_directory=Path.home()/'AppData/Local/Temp/raceultimate-render-tools'
if tool_directory.is_dir():sys.path.insert(0,str(tool_directory))
from rtree import index as spatial_index

ROOT=Path(__file__).resolve().parents[1]
part='front' if '--front' in sys.argv else 'rear';direction=-1 if part=='front' else 1
profile_path=ROOT/'car-lab/src/vehicle/profiles/mp1x.json'
p=json.loads(profile_path.read_text(encoding='utf-8'))
digest=hashlib.sha256((ROOT/p['body']['file']).read_bytes()).hexdigest().upper()
if digest!=p['body']['sha256'].upper():raise ValueError('Source shell changed; refit against its new cavities.')
# Deliberately traced inside the actual upper recess and its return bend.
guide=np.array([[.35,.745],[.47,.748],[.59,.758],[.70,.785],[.80,.810],[.88,.811],[.945,.797],[.977,.769],[.960,.730],[.916,.688],[.864,.644],[.817,.603],[.793,.567],[.788,.531],[.804,.482],[.825,.435]])
if part=='front':guide=np.array([[.595,.579],[.66,.585],[.74,.589],[.805,.590],[.85,.585],[.873,.572],[.875,.55],[.867,.531],[.845,.522],[.795,.524],[.73,.532],[.66,.541]])
t=np.r_[0,np.cumsum(np.linalg.norm(np.diff(guide,axis=0),axis=1))]
rows,cols=(129,7) if part=='front' else (169,7)
curve=PchipInterpolator(t,guide,axis=0);at=np.linspace(0,t[-1],rows);center=curve(at);tangent=curve.derivative()(at)
across=np.column_stack([-tangent[:,1],tangent[:,0]]);across/=np.linalg.norm(across,axis=1)[:,None]
width=.019 if part=='front' else .028
# Intersect measured Y/Z rays with the real GLB triangles. Raster depth is only
# a visual guide; it is not accurate enough to seat millimetre-thick lenses.
raw=(ROOT/p['body']['file']).read_bytes();jlen=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jlen]);binary=raw[28+jlen:]
def accessor(index):
 a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']];n=3 if a['type']=='VEC3' else 1
 return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*n,offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
primitive=doc['meshes'][0]['primitives'][0];vertices=accessor(primitive['attributes']['POSITION']).astype(float)
lo,hi=vertices.min(0),vertices.max(0);vertices-=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];vertices*=p['body']['displayLength']/(hi[0]-lo[0]);vertices[:,1]+=p['body']['lift']
triangles=vertices[accessor(primitive['indices']).reshape(-1,3)]
triangles=triangles[triangles[:,:,0].min(1)<-1.4] if part=='front' else triangles[triangles[:,:,0].max(1)>1.5]
lower=triangles[:,:,1:3].min(1);upper=triangles[:,:,1:3].max(1)
tree=spatial_index.Index((i,(a[0],a[1],b[0],b[1]),None) for i,(a,b) in enumerate(zip(lower,upper)))
def surface_at(y,z):
 query=np.column_stack([y.ravel(),z.ravel()]);x=[]
 for q in query:
  ids=list(tree.intersection((q[0],q[1],q[0],q[1])));tri=triangles[ids];a,b,c=tri[:,0,:],tri[:,1,:],tri[:,2,:]
  den=(b[:,2]-c[:,2])*(a[:,1]-c[:,1])+(c[:,1]-b[:,1])*(a[:,2]-c[:,2]);den=np.where(np.abs(den)>1e-16,den,np.nan)
  w0=((b[:,2]-c[:,2])*(q[0]-c[:,1])+(c[:,1]-b[:,1])*(q[1]-c[:,2]))/den
  w1=((c[:,2]-a[:,2])*(q[0]-c[:,1])+(a[:,1]-c[:,1])*(q[1]-c[:,2]))/den
  w2=1-w0-w1;hit=(w0>=-1e-7)&(w1>=-1e-7)&(w2>=-1e-7)
  distances=w0*a[:,0]+w1*b[:,0]+w2*c[:,0]
  x.append(np.where(hit,distances,np.inf).min(initial=np.inf) if part=='front' else np.where(hit,distances,-np.inf).max(initial=-np.inf))
 x=np.array(x)
 if not np.isfinite(x).all():raise ValueError('No rear surface hit for some lamp samples.')
 return x.reshape(y.shape)
fit={'method':'recess-lens-cap-v2','direction':direction,'sourceSha256':digest,'rows':rows,'columns':cols,'width':width,'lensWidth':.015 if part=='front' else .021,'ledWidth':.005 if part=='front' else .007,'offsets':{'housing':.003,'lens':.006,'led':.009},'sides':{},'capX':{}}
centerlines={}
for sign in [1,-1]:
    rows_yz=center[:,None,:]+across[:,None,:]*np.linspace(-width/2,width/2,cols)[None,:,None]
    z=rows_yz[:,:,0]*sign;y=rows_yz[:,:,1]
    x=surface_at(y,z)
    if not np.isfinite(x).all() or np.any(x*direction<1.4):raise ValueError('Lamp trace leaves the shell facing this direction.')
    coordinates=np.stack([x,y-p['body']['lift'],z],axis=-1)
    fit['sides'][str(sign)]=np.round(coordinates,6).reshape(-1,3).tolist()
    # A manufactured lens spans the opening at its rim, rather than lying on
    # the deeply recessed and sometimes folded generated cavity floor.
    rim=x.min(axis=1) if part=='front' else x.max(axis=1)
    cap=np.minimum(rim,gaussian_filter1d(minimum_filter1d(rim,size=7),sigma=1.0)) if part=='front' else np.maximum(rim,gaussian_filter1d(maximum_filter1d(rim,size=7),sigma=1.0))
    fit['capX'][str(sign)]=np.round(cap,6).tolist()
    centerlines[str(sign)]=np.round(coordinates[:,cols//2],6).tolist()
p['lights'][part+'Recess']=fit
p['lights'][part]=centerlines['1']
if part=='rear':p['lights']['centerStop']=[[.94,.913,-.16],[.94,.913,.16]]
else:
 projector_y,projector_z=.553,.795
 # Projectors mount at the lens aperture, not at the deep cavity's back wall.
 near=np.abs(center[:,0]-projector_z)<.035
 aperture=min(np.array(fit['capX']['1'])[near].min(),np.array(fit['capX']['-1'])[near].min())
 p['lights']['projector']=[round(float(aperture)+.014,6),projector_y-p['body']['lift'],projector_z]
 p['lights']['projectorScale']=.55
profile_path.write_text(json.dumps(p,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
receipt={'sourceSha256':digest,'method':fit['method'],'part':part,'guideWorldZY':guide.tolist(),'rows':rows,'columns':cols,'housingWidthMetres':width,'ledWidthMetres':fit['ledWidth'],'maxOffsetBeyondLensCapMetres':fit['offsets']['led'],'sidesIndependentlySampled':True,'sourceMeshModified':False,'providerCalls':0}
(ROOT/f'car-lab/verification/mclaren-{part}-lamp-fit.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k!='guideWorldZY'}))
