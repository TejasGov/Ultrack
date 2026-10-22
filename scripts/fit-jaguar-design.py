"""Fit classic Jaguar trim and twin rear exhaust entries; no provider calls."""
import json,hashlib,sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/raceultimate-render-tools'))
import trimesh
root=Path(__file__).resolve().parents[1];file=root/'car-lab/src/vehicle/profiles/jaguarxkjss.json';p=json.loads(file.read_text());body=root/p['body']['file'];m=trimesh.load(body,force='mesh',process=False)
lo,hi=np.array(p['body']['normalizationBounds']);m.vertices=(m.vertices-[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2])*4.6/(hi[0]-lo[0])
sha=hashlib.sha256(body.read_bytes()).hexdigest().upper()
def fit(yz,offset=.008):
 yz=np.array(yz);origin=np.column_stack([np.full(len(yz),3),yz]);dirs=np.tile([-1,0,0],(len(yz),1));hits,ids,_=m.ray.intersects_location(origin,dirs,multiple_hits=False)
 assert len(ids)==len(yz),f'Unattached Jaguar detail {len(ids)}/{len(yz)}'
 out=np.zeros_like(origin);out[ids]=hits;out[:,0]+=offset;return out.round(6).tolist()
entries=fit([[.145,-.105],[.145,.105]],0)
p['exhaust']=dict(sourceSha256=sha,tips=[dict(id=id,entry=entry,position=[round(entry[0]+.14,6),entry[1],entry[2]],direction=[1,0,0],radius=.046,length=.20) for id,entry in zip(['L','R'],entries)],nitro=dict(color='#318aff',coreColor='#cef6ff',length=.47,defaultBoost=0))
rails=[]
for sign in [-1,1]:
 rails.append(fit([[.334,z] for z in np.linspace(sign*.28,sign*.86,70)],.008))
plate=fit([[y,z] for y in np.linspace(.235,.345,13) for z in np.linspace(-.235,.235,41)],.007)
letters={
 'X':[[[-.018,-.026],[.018,.026]],[[-.018,.026],[.018,-.026]]],
 'K':[[[-.018,-.026],[-.018,.026]],[[.018,.026],[-.018,0],[.018,-.026]]],
 'S':[[[.017,.023],[.008,.027],[-.011,.027],[-.018,.017],[-.013,.005],[.012,-.005],[.018,-.016],[.011,-.027],[-.009,-.027],[-.018,-.022]]]
}
strokes=[]
for i,char in enumerate('XKSS'):
 for stroke in letters[char]:strokes.append(fit([[.29+y,(i-1.5)*.06+z] for z,y in stroke],.013))
p['jaguarDesign']=dict(sourceSha256=sha,bumperRails=rails,plate=dict(rows=13,columns=41,points=plate),letterStrokes=strokes)
p['description']='Classic panel seams and pull handles, chrome rear trim, twin hollow exhausts and boost-effect sockets.'
file.write_text(json.dumps(p,indent=2)+'\n');print(json.dumps(p['exhaust'],indent=2))
