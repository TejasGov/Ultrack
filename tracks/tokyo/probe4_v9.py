import bpy,json,math,numpy as np
from pathlib import Path
from mathutils import Vector
H=Path(__file__).resolve().parent;O=H/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_neon_depth_v8.blend'))
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P)
t=bpy.data.objects['Roppongi topography | valley carved']
def g(x,y):
    h,co,_,_=t.ray_cast(Vector((x,y,600)),Vector((0,0,-1)));return co.z if h else None
print('terrain loc/scale',tuple(t.location),tuple(t.scale),tuple(t.rotation_euler))
for i in (20,60,169,300,620,880,950,1200):
    T=P[(i+1)%N]-P[i-1];T.z=0;T.normalize();n=Vector((-T.y,T.x,0))
    print('I',i,round(P[i].z,2),[(lat,None if g(*(P[i]+n*lat*s).xy) is None else round(g(*(P[i]+n*lat*s).xy)-P[i].z,2)) for s in (-1,1) for lat in (10,12.5,16,22,30)])
print('DONE')
