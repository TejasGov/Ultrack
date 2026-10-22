import bpy,json,math
from pathlib import Path
from mathutils import Vector
H=Path(__file__).resolve().parent;O=H/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_neon_depth_v8.blend'))
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P)
i=700;t=P[i+1]-P[i-1];t.z=0;t.normalize();n=Vector((-t.y,t.x,0))
for name in ['Continuous concrete barrier','Continuous concrete barrier.001','Kerb | inner','Kerb | outer','Continuous edge line','Continuous edge line.001','Continuous road | 18m | source spline','Continuous sidewalk -1','Continuous sidewalk 1']:
    o=bpy.data.objects[name];vs=[o.matrix_world@v.co for v in o.data.vertices]
    near=[v for v in vs if (v-P[i]).xy.length<14 and abs(v.z-P[i].z)<3]
    lat=sorted({round((v-P[i]).dot(n),2) for v in near});zs=sorted({round(v.z-P[i].z,2) for v in near})
    print('X',name,'lat',lat[:12],'z',zs[:10],[m.name for m in o.data.materials])
print('mats',[m.name for m in bpy.data.materials if m.users and ('Warm' in m.name or 'Kerb' in m.name or 'kerb' in m.name or 'Concrete' in m.name)])
w=bpy.data.objects['Tokyo Bay water'];print('water mat',[m.name for m in w.data.materials])
print('DONE')
