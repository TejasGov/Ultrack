"""Fit Nuvolari trim and Audi emblems to the existing source triangles."""
import json,sys,hashlib
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path.home()/'AppData/Local/Temp/raceultimate-render-tools'))
import trimesh
root=Path(__file__).resolve().parents[1];pf=root/'car-lab/src/vehicle/profiles/nuvolari.json';p=json.loads(pf.read_text());file=root/p['body']['file']
m=trimesh.load(file,force='mesh',process=False);lo,hi=np.array(p['body']['normalizationBounds']);m.vertices=(m.vertices-np.array([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]))*4.6/(hi[0]-lo[0])
def fitted(yz,sign=1,offset=.008):
 yz=np.array(yz);orig=np.column_stack([np.full(len(yz),3*sign),yz]);direction=np.tile([-sign,0,0],(len(yz),1))
 hits,ids,_=m.ray.intersects_location(orig,direction,multiple_hits=False)
 assert len(ids)==len(yz),f'Trim leaves solid shell: {len(ids)}/{len(yz)}'
 out=np.zeros_like(orig);out[ids]=hits;out[:,0]+=offset*sign;return out.round(6).tolist()
patches=[]
for name,rows,columns,yl,yh,half in [('rear-lamp-smoked-surround',9,81,.579,.675,.86),('rear-satin-inlay',13,41,.365,.54,.42),('rear-diffuser',13,65,.175,.32,.81)]:
 yz=[]
 for t in np.linspace(0,1,rows):
  for u in np.linspace(-1,1,columns):
   z=u*(half-.018*abs(t*2-1)**6);y=yl+(yh-yl)*t
   if name=='rear-diffuser':y+=.025*abs(u)**4
   yz.append([y,z])
 patches.append(dict(name=name,rows=rows,columns=columns,points=fitted(yz)))
badges=[]
for sign,y,r,spacing in [(1,.555,.034,.053),(-1,.355,.035,.053)]:
 rings=[]
 for i in range(4):
  yz=[[y+r*np.sin(t),(i-1.5)*spacing+r*np.cos(t)] for t in np.linspace(0,2*np.pi,97)]
  rings.append(fitted(yz,sign,.014))
 if sign==-1:
  plane=min(q[0] for ring in rings for q in ring)-.006
  for ring in rings:
   for q in ring:q[0]=round(plane,6)
 if sign==1:
  plane=max([q[0] for ring in rings for q in ring]+[q[0] for patch in patches if patch['name']=='rear-satin-inlay' for q in patch['points']])+.008
  for ring in rings:
   for q in ring:q[0]=round(plane,6)
 badges.append(dict(name='rear-audi-rings' if sign==1 else 'front-audi-rings',rings=rings))
exhaust=fitted([[.26,-.66],[.26,.66]],offset=.045)
p['body']['trimRegions']=[dict(min=[-2.35,.215,-.38],max=[-2.10,.405,.38])]
p['nuvolariDesign']=dict(sourceSha256=hashlib.sha256(file.read_bytes()).hexdigest().upper(),patches=patches,badges=badges,exhaust=exhaust)
pf.write_text(json.dumps(p,indent=2)+'\n');print('Nuvolari design fitted:',len(patches),'inserts, 2 four-ring emblems, 2 exhaust tips')
