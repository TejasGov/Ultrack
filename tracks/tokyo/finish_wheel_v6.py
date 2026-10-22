import bpy,math,json,ast
from pathlib import Path
from mathutils import Vector,Matrix
O=Path(__file__).resolve().parent/'out';bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_park_wheel_v6.blend'));s=bpy.context.scene
report=json.loads((O/'ferris-wheel-v6.json').read_text());cx,cy,_=report['center_world'];moved=[]
for ob in bpy.data.collections['V3 | district architecture'].objects:
    if math.hypot(ob.location.x-cx,ob.location.y-cy)<50:
        moved.append(ob.name);ob.location.x+=90
ob=bpy.data.objects['Central park wheel plaza, boarding deck and canopy'];matrix=ob.matrix_world.copy();bpy.data.objects.remove(ob,do_unlink=True)
for node in ast.parse((O.parent/'overhaul_v3.py').read_text(encoding='utf8')).body:
    if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ['mesh','Batch']:exec(compile(ast.Module(body=[node],type_ignores=[]),'<helpers>','exec'))
M={key:bpy.data.materials[name] for key,name in [('stone','V6 park plaza stone'),('steel','V6 wheel pearl enamel'),('dark','V6 graphite wheel frame'),('warm','V6 wheel champagne light')]}
B=Batch();B.tube((0,0,-.25),(0,0,.05),39,39,M['stone'],96)
for k in range(96):
    a=k*math.tau/96;b=(k+1)*math.tau/96;B.tube((37*math.cos(a),37*math.sin(a),.08),(37*math.cos(b),37*math.sin(b),.08),.055,.055,M['warm'],6)
B.box((0,0,2.6),(17,12,5.2),M['stone']);B.box((0,0,5.2),(19,14,.3),M['steel'])
for k in range(32):B.box((-20+k*.36,-3,(k+1)*5.2/64),(.36,4,(k+1)*5.2/32),M['stone'])
for y in [-12.5,-7.5]:
    for x in [-7,7]:B.tube((x,y,0),(x,y,9.4),.12,.12,M['dark'])
    B.tube((-8,y,9.4),(8,y,9.4),.18,.18,M['steel'])
B.box((0,-10,9.6),(20,7.5,.35),M['dark'])
ob=B.finish('Central park wheel plaza, boarding deck and canopy',bpy.data.collections['V6 | Yoyogi observation wheel']);ob.matrix_world=matrix
report['park_pavilion_shifted_to_edge']=moved
(O/'ferris-wheel-v6.json').write_text(json.dumps(report,indent=2))
s.camera=bpy.data.objects['V6 | wheel across park'];bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_park_wheel_v6.blend'))
for name,cam in [('park_wheel_v6','V6 | wheel across park'),('park_wheel_reverse_v6','V6 | opposite park view')]:
    s.camera=bpy.data.objects[cam];s.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True)
print('WHEEL_FINAL_COMPLETE',flush=True)
