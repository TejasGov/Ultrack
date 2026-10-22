"""Fit batch shells from reviewed world Y/Z cavity traces; no provider calls."""
import sys,json,struct,hashlib
from pathlib import Path
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import maximum_filter1d,minimum_filter1d,gaussian_filter1d
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/raceultimate-render-tools'))
from rtree import index
ROOT=Path(__file__).resolve().parents[1]
key=sys.argv[1];batch=int(sys.argv[2]) if len(sys.argv)>2 else 2
if batch not in (2,3,4,5):raise ValueError('Unknown body batch')
cfg=json.loads((ROOT/f'meshy_output/body-batch-{batch}/fit-guides.json').read_text())[key]
file=ROOT/f'car-lab/src/vehicle/profiles/{key}.json';p=json.loads(file.read_text(encoding='utf-8'))
raw=(ROOT/p['body']['file']).read_bytes();digest=hashlib.sha256(raw).hexdigest().upper()
if digest!=p['body']['sha256'].upper():raise ValueError('Source bytes changed')
size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);binary=raw[28+size:]
def accessor(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];n=3 if a['type']=='VEC3' else 1
 return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
prim=doc['meshes'][0]['primitives'][0];v=accessor(prim['attributes']['POSITION']).astype(float);lo,hi=v.min(0),v.max(0)
if p['body'].get('normalizationBounds'):lo,hi=np.array(p['body']['normalizationBounds'])
v-=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];v*=4.6/(hi[0]-lo[0]);v[:,1]+=p['body']['lift']
alltri=v[accessor(prim['indices']).reshape(-1,3)]
stages=[('front',-1)]+([('headlampAperture',-1)] if cfg.get('headlampAperture') else [])+[('rear',1)]
for part,direction in stages:
 tri=alltri[alltri[:,:,0].min(1)<-.8] if direction<0 else alltri[alltri[:,:,0].max(1)>.8]
 lower=tri[:,:,1:].min(1);upper=tri[:,:,1:].max(1)
 tree=index.Index((i,(a[0],a[1],b[0],b[1]),None) for i,(a,b) in enumerate(zip(lower,upper)))
 def surface(y,z):
  result=[]
  for q in np.column_stack([y.ravel(),z.ravel()]):
   ids=list(tree.intersection((q[0],q[1],q[0],q[1])));a,b,c=tri[ids,0],tri[ids,1],tri[ids,2]
   den=(b[:,2]-c[:,2])*(a[:,1]-c[:,1])+(c[:,1]-b[:,1])*(a[:,2]-c[:,2]);den=np.where(abs(den)>1e-16,den,np.nan)
   w0=((b[:,2]-c[:,2])*(q[0]-c[:,1])+(c[:,1]-b[:,1])*(q[1]-c[:,2]))/den
   w1=((c[:,2]-a[:,2])*(q[0]-c[:,1])+(a[:,1]-c[:,1])*(q[1]-c[:,2]))/den;w2=1-w0-w1
   hit=(w0>=-1e-7)&(w1>=-1e-7)&(w2>=-1e-7);d=(w0*a[:,0]+w1*b[:,0]+w2*c[:,0])*direction
   result.append(np.where(hit,d,-np.inf).max(initial=-np.inf)*direction)
  result=np.array(result)
  if not np.isfinite(result).all():
   missing=np.column_stack([z.ravel(),y.ravel()])[~np.isfinite(result)]
   raise ValueError(f'{key} {part}: trace leaves source surface at Z/Y {missing[::max(1,len(missing)//8)].round(4).tolist()}')
  return result.reshape(y.shape)
 fits=[];centerline=None
 for item in cfg[part]:
  guide=np.array(item['guide']);t=np.r_[0,np.cumsum(np.linalg.norm(np.diff(guide,axis=0),axis=1))]
  curve=PchipInterpolator(t,guide,axis=0);at=np.linspace(0,t[-1],97);center=curve(at);tangent=curve.derivative()(at)
  across=np.column_stack([-tangent[:,1],tangent[:,0]]);across/=np.linalg.norm(across,axis=1)[:,None]
  width=item.get('width',.022);cols=7;rows=len(at)
  fit=dict(method='recess-lens-cap-v2',direction=direction,sourceSha256=digest,rows=rows,columns=cols,width=width,lensWidth=width*.76,ledWidth=width*.28,closed=item.get('closed',False),offsets=dict(housing=.003,lens=.006,led=.009),sides={},capX={})
  for sign in [1,-1]:
   yz=center[:,None,:]+across[:,None,:]*np.linspace(-width/2,width/2,cols)[None,:,None]
   z=yz[:,:,0]*sign;y=yz[:,:,1];x=surface(y,z)
   rim=(x*direction).max(1);cap=np.maximum(rim,gaussian_filter1d(maximum_filter1d(rim,size=5),1))*direction
   coords=np.stack([x,y-p['body']['lift'],z],axis=-1)
   fit['sides'][str(sign)]=np.round(coords,6).reshape(-1,3).tolist();fit['capX'][str(sign)]=np.round(cap,6).tolist()
   if sign==1:centerline=np.round(coords[:,cols//2],6).tolist()
  fits.append(fit)
 if part=='headlampAperture':
  headlamp=json.loads(json.dumps(cfg['headlamp']))
  for i,spec in enumerate([headlamp]+headlamp.get('additional',[])):
   for optic in spec['optics']:optic['zy'][1]-=p['body']['lift']
   for guide in spec['running']:
    for point in guide:point[1]-=p['body']['lift']
   spec['aperture']=fits[i]
  p['lights']['headlamp']=headlamp
  continue
 p['lights'][part+'Fits']=fits;p['lights'][part]=centerline
 p['lights'].pop(part+'Recess',None)
 if part=='front':
  z,y=cfg['projectorZY']
  # Projectors span the cavity at the nearest surrounding fitted lens rim.
  samples=[(abs(abs(f['sides']['1'][r*7+3][2])-z)+abs(f['sides']['1'][r*7+3][1]+p['body']['lift']-y),f['capX']['1'][r]) for f in fits for r in range(f['rows'])]
  nearest=sorted(samples)[:16];aperture=min(x for _,x in nearest)
  if cfg['front'][0].get('closed'):
   f=fits[0];boundary=np.array(f['sides']['1']).reshape(f['rows'],7,3)[:,3]
   plane=np.linalg.lstsq(np.column_stack([boundary[:,1],boundary[:,2],np.ones(len(boundary))]),np.array(f['capX']['1']),rcond=None)[0]
   aperture=float(np.array([y-p['body']['lift'],z,1])@plane)
  p['lights']['projector']=[round(aperture+.008,6),y-p['body']['lift'],z];p['lights']['projectorScale']=cfg.get('projectorScale',.65)
rear_glass=np.array(p['glass']['rear']);top=(rear_glass[0]+rear_glass[1])/2;bottom=(rear_glass[2]+rear_glass[3])/2;stop=top*.15+bottom*.85
p['lights']['centerStop']=[[round(stop[0]+.012,6),round(stop[1]+.008,6),z] for z in [-.12,.12]]
reverse=np.array(cfg['reverse']);reverse[:,0]=surface(reverse[:,1]+p['body']['lift'],reverse[:,2])+.010
p['lights']['reverse']=np.round(reverse,6).tolist()
p['lights']['tailSpill']=[2.42,.50,cfg.get('tailSpillZ',.7)]
p['fitStatus']=('Locally smoothed body with fitted parts. Final surface approval, mesh optimization and driving integration remain.' if p['body'].get('surfaceCleanup') else 'Assembly fit reviewed in the lab. Raw high-density shell; surface cleanup, optimization and driving integration remain.')
file.write_text(json.dumps(p,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
receipt=dict(car=key,sourceSha256=digest,method='triangle-intersection from reviewed cavity traces',sourceMeshModified=False,providerCalls=0,frontModulesPerSide=len(p['lights']['frontFits']),rearModulesPerSide=len(p['lights']['rearFits']))
(ROOT/f'car-lab/verification/{key}-lamp-fit.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))

