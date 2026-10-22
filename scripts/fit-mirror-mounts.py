"""Seat mirror feet against actual shell triangles, independently on each side."""
import json,struct,hashlib,sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/raceultimate-render-tools'))
from rtree import index
ROOT=Path(__file__).resolve().parents[1]
for key in sys.argv[1:]:
 file=ROOT/f'car-lab/src/vehicle/profiles/{key}.json';p=json.loads(file.read_text(encoding='utf-8'))
 raw=(ROOT/p['body']['file']).read_bytes();sha=hashlib.sha256(raw).hexdigest().upper()
 if sha!=p['body']['sha256'].upper():raise ValueError('Source hash changed')
 size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);binary=raw[28+size:]
 def acc(i):
  a=doc['accessors'][i];b=doc['bufferViews'][a['bufferView']];n=3 if a['type']=='VEC3' else 1
  return np.frombuffer(binary,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[a['componentType']],count=a['count']*n,offset=b.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
 q=doc['meshes'][0]['primitives'][0];v=acc(q['attributes']['POSITION']).astype(float);lo,hi=v.min(0),v.max(0)
 if (hi-lo)[2]>(hi-lo)[0]:v=np.column_stack([v[:,2],v[:,1],-v[:,0]]);lo,hi=v.min(0),v.max(0)
 if p['body'].get('normalizationBounds'):lo,hi=np.array(p['body']['normalizationBounds'])
 v-=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];v*=p['body']['displayLength']/(hi[0]-lo[0])
 tri=v[acc(q['indices']).reshape(-1,3)];x,y,_=p['mirrors']['mount']
 mn=tri[:,:,:2].min(1);mx=tri[:,:,:2].max(1);mask=(mn[:,0]<x+.12)&(mx[:,0]>x-.12)&(mn[:,1]<y+.03)&(mx[:,1]>y-.22)
 tri=tri[mask];mn=mn[mask];mx=mx[mask];tree=index.Index((i,(*a,*b),None) for i,(a,b) in enumerate(zip(mn,mx)))
 def hits(x,y,sign):
  ids=list(tree.intersection((x,y,x,y)));t=tri[ids];a,b,c=t[:,0],t[:,1],t[:,2]
  den=(b[:,1]-c[:,1])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,1]-c[:,1]);den=np.where(abs(den)>1e-16,den,np.nan)
  w0=((b[:,1]-c[:,1])*(x-c[:,0])+(c[:,0]-b[:,0])*(y-c[:,1]))/den
  w1=((c[:,1]-a[:,1])*(x-c[:,0])+(a[:,0]-c[:,0])*(y-c[:,1]))/den;w2=1-w0-w1
  z=(w0*a[:,2]+w1*b[:,2]+w2*c[:,2])*sign
  okay=(w0>=-1e-7)&(w1>=-1e-7)&(w2>=-1e-7)&(z>.32)&(z<1.2)
  return np.where(okay,z,-np.inf).max(initial=-np.inf)*sign
 mounts={};surface={}
 for sign in [1,-1]:
  found=None
  for dy in np.arange(0,.211,.012):
   for dx in [0,-.015,.015,-.035,.035]:
    z=hits(x+dx,y-dy,sign)
    if np.isfinite(z):found=[x+dx,y-dy,z];break
   if found is not None:break
  if found is None:raise ValueError(key+' mirror has no solid mounting surface')
  surface[str(sign)]=[round(float(a),6) for a in found];found[2]-=sign*.018;mounts[str(sign)]=[round(float(a),6) for a in found]
 p['mirrors'].update(mounts=mounts,surfaceMounts=surface,sourceSha256=sha,penetration=.018)
 file.write_text(json.dumps(p,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
 print(json.dumps({'car':key,'surfaceMounts':surface,'penetrationMetres':.018}))

