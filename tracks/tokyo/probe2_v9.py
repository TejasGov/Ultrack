import bpy,json,math
from pathlib import Path
from mathutils import Vector
H=Path(__file__).resolve().parent;O=H/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_neon_depth_v8.blend'))
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P)
def bb(o):
    b=[o.matrix_world@Vector(c) for c in o.bound_box];return [round(min(v[i] for v in b)) for i in range(3)],[round(max(v[i] for v in b)) for i in range(3)]
for o in bpy.data.objects:
    if o.type=='MESH' and any(k in o.name for k in ['Bay','bay','Seawall','seawall','topography','Roppongi']) and 'sign' not in o.name.lower():print('B',o.name,bb(o))
st=min(range(N),key=lambda i:(P[i].x+189)**2+(P[i].y+514)**2);print('START idx',st,[round(v) for v in P[st]])
t=P[(st+1)%N]-P[st-1];print('start dir',[round(v,2) for v in t.normalized()])
for o in bpy.data.objects:
    if o.type=='MESH' and len(o.data.polygons)>200 and o.name.startswith(('Bayfront','Barrier','Safety','Kerb','Continuous','Road','Track','Wall')):print('BIG',o.name,len(o.data.polygons),bb(o))
for c in ['01_TRACK','07_STREET_KIT']:
    print(c,sorted({o.name.split(' ')[0]+' '+(o.name.split(' ')[1] if len(o.name.split(' '))>1 else '') for o in bpy.data.collections[c].objects})[:60])
import collections
print(collections.Counter(o.type for o in bpy.data.objects))
print('infield samples')
terr=bpy.data.objects['Roppongi topography | valley carved']
def g(x,y):
    h,co,_,_=terr.ray_cast(Vector((x,y,600)),Vector((0,0,-1)));return round(co.z,1) if h else None
for x,y in [(-100,300),(-100,100),(-300,-100),(0,-300),(100,0),(-500,100),(-650,-300),(300,100),(200,-300),(-200,-150)]:print('G',x,y,g(x,y),round(min(math.hypot(p.x-x,p.y-y) for p in P)))
print('DONE')
