"""Large central park landmark, additive to the approved bridge study."""
import bpy,math,json,ast,random
from pathlib import Path
from mathutils import Vector,Matrix
H=Path(__file__).resolve().parent;O=H/'out';ROOT=H.parent.parent
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_bridge_v5.blend'));s=bpy.context.scene
for node in ast.parse((H/'overhaul_v3.py').read_text(encoding='utf8')).body:
    if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ['col','material','mesh','Batch','area','camera']:
        exec(compile(ast.Module(body=[node],type_ignores=[]),'<helpers>','exec'))
C=col('V6 | Yoyogi observation wheel');LIGHT=col('V6 | park wheel lighting')
D=json.loads((H/'source/map.json').read_text());pk=D['parks'][0];scale=1.424708197157256
cx,cy=(pk['x']-740)*scale,(470-pk['y'])*scale
terrain=bpy.data.objects['Roppongi topography | valley carved'];hit,co,_,_=terrain.ray_cast(Vector((cx,cy,600)),Vector((0,0,-1)));gz=co.z if hit else 3
angle=math.radians(-12);rot=Matrix.Rotation(angle,4,'Z');origin=Vector((cx,cy,gz))
def wp(p):return origin+rot@Vector(p)
def finish(B,name):
    ob=B.finish(name,C);ob.location=origin;ob.rotation_euler.z=angle;return ob
M={'steel':material('V6 wheel pearl enamel',(.62,.66,.65),.32,.45),'dark':material('V6 graphite wheel frame',(.045,.055,.065),.35,.65),'red':material('V6 vermilion hub',(.5,.025,.035),.38,.35),'stone':material('V6 park plaza stone',(.22,.23,.22),.8),'warm':material('V6 wheel champagne light',(1,.60,.27),.3,0,3),'rose':material('V6 wheel sakura light',(1,.12,.34),.3,0,4),'cyan':material('V6 wheel ice light',(.10,.65,.85),.3,0,3)}
glass=material('V6 gondola smoked glass',(.055,.12,.16),.18,.15);glass.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value=.55;M['glass']=glass
R=60;Z=69;count=32;B=Batch()
# Dual rims and diagonal cross bracing form a real six-metre-deep truss.
segments=192
for k in range(segments):
    a=k*math.tau/segments;b=(k+1)*math.tau/segments
    for y in [-3,3]:
        for rr in [R,R-1.6]:B.tube((rr*math.cos(a),y,Z+rr*math.sin(a)),(rr*math.cos(b),y,Z+rr*math.sin(b)),.17,.17,M['steel'],8)
        rr=R+.24;B.tube((rr*math.cos(a),y,Z+rr*math.sin(a)),(rr*math.cos(b),y,Z+rr*math.sin(b)),.065,.065,M['rose'] if k//12%2==0 else M['warm'],6)
    if k%3==0:
        B.tube((R*math.cos(a),-3,Z+R*math.sin(a)),(R*math.cos(b),3,Z+R*math.sin(b)),.10,.10,M['steel'],6)
for k in range(count):
    a=k*math.tau/count-math.pi/2;b=a+math.pi/count
    for side in [-1,1]:
        for shift in [-.12,.12]:
            B.tube((math.cos(a+shift)*3,side*4,Z+math.sin(a+shift)*3),(math.cos(a)*R,side*3,Z+math.sin(a)*R),.075,.075,M['steel'],6)
        if k%2==0:B.tube((math.cos(a)*5,side*4.05,Z+math.sin(a)*5),(math.cos(a)*(R-2),side*3.05,Z+math.sin(a)*(R-2)),.03,.03,M['cyan'] if k%4==0 else M['rose'],5)
    B.tube((math.cos(a)*R,-3,Z+math.sin(a)*R),(math.cos(a)*R,3,Z+math.sin(a)*R),.20,.20,M['dark'],10)
B.tube((0,-6,Z),(0,6,Z),2.1,2.1,M['red'],32)
for side in [-1,1]:
    B.tube((0,side*6,Z),(0,side*6.4,Z),3.4,3.1,M['steel'],32)
    B.tube((0,side*6.45,Z),(0,side*6.55,Z),2.55,2.55,M['rose'],32)
finish(B,'120m dual-rim wheel | spokes and illuminated truss')
# Four tapered A-frame legs, hub bearings, foundations and cross ties.
B=Batch()
for side in [-1,1]:
    for x in [-25,25]:
        B.tube((x,side*16,1),(0,side*5,Z),1.35,.85,M['steel'],12)
        B.box((x,side*16,.7),(7,7,1.4),M['stone'])
        for dx in [-2,2]:
            for dy in [-2,2]:B.tube((x+dx,side*16+dy,1.3),(x+dx,side*16+dy,1.6),.12,.12,M['dark'],8)
    B.tube((-19,side*13,17),(19,side*13,17),.45,.45,M['steel'],10)
finish(B,'Wheel A-frame supports, bearings and anchor foundations')
# Shared enclosed gondolas hang upright, independently of the wheel angle.
B=Batch();B.tube((0,0,-1.35),(0,0,-1.1),1.65,1.65,M['red'],16);B.tube((0,0,-1.1),(0,0,1.1),1.5,1.5,M['glass'],16)
B.tube((0,0,1.1),(0,0,1.4),1.7,1.3,M['steel'],16)
for j in range(8):
    a=j*math.tau/8;B.tube((1.52*math.cos(a),1.52*math.sin(a),-1.1),(1.52*math.cos(a),1.52*math.sin(a),1.15),.045,.045,M['steel'],6)
B.tube((0,0,-.9),(0,0,-.83),1.53,1.53,M['warm'],16)
B.tube((0,0,1.4),(0,0,2.4),.12,.12,M['dark'],8)
master=B.finish('Gondola 01 | enclosed shared capsule',C)
for k in range(count):
    ob=master if k==0 else bpy.data.objects.new('Gondola %02d | shared capsule'%(k+1),master.data)
    if k: C.objects.link(ob)
    a=k*math.tau/count-math.pi/2;ob.location=wp((R*math.cos(a),0,Z+R*math.sin(a)-2.4));ob.rotation_euler.z=angle
# Circular plaza, raised boarding deck, real stair access and a compact cedar station.
B=Batch();B.tube((0,0,-.25),(0,0,.05),39,39,M['stone'],96)
for k in range(96):
    a=k*math.tau/96;b=(k+1)*math.tau/96
    B.tube((37*math.cos(a),37*math.sin(a),.08),(37*math.cos(b),37*math.sin(b),.08),.055,.055,M['warm'],6)
B.box((0,0,2.6),(17,12,5.2),M['stone']);B.box((0,0,5.2),(19,14,.3),M['steel'])
for k in range(32):B.box((-20+k*.36,-3,(k+1)*5.2/64),(.36,4,(k+1)*5.2/32),M['stone'])
for y in [-12.5,-7.5]:
    for x in [-7,7]:B.tube((x,y,5.3),(x,y,9.4),.12,.12,M['dark'])
    B.tube((-8,y,9.4),(8,y,9.4),.18,.18,M['steel'])
B.box((0,-10,9.6),(20,7.5,.35),M['dark'])
finish(B,'Central park wheel plaza, boarding deck and canopy')
# Shift the existing park pavilion to the grove's edge, clear of the rotating wheel.
for ob in bpy.data.collections['V3 | district architecture'].objects:
    if math.hypot(ob.location.x-cx,ob.location.y-cy)<50:ob.location.x+=90
# Clear only the small station/plaza footprint; retain the park around it.
removed=[]
for ob in list(bpy.data.collections['V3 | sakura and landscape'].objects):
    if not ob.hide_render and math.hypot(ob.location.x-cx,ob.location.y-cy)<32:
        removed.append(ob.name);bpy.data.objects.remove(ob,do_unlink=True)
area('Wheel support warm wash',wp((0,-30,4)),wp((0,0,45)),3500,(1,.38,.18),12)
area('Wheel hub soft light',wp((0,-12,65)),wp((0,0,69)),700,(1,.3,.42),8)
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']]
roadclear=min(math.hypot(p.x-cx,p.y-cy) for p in P)
report={'park':pk['name'],'center_world':list(origin),'diameter_m':120,'top_above_ground_m':129.4,'gondolas':count,'shared_gondola_meshes':1,'nearest_road_center_m':roadclear,'plaza_radius_m':39,'trees_relocated_by_removal':removed,'runtime_exported':False}
assert roadclear>R+30
(O/'ferris-wheel-v6.json').write_text(json.dumps(report,indent=2))
cams={'park_wheel_v6':camera('V6 | wheel across park',wp((0,-235,4)),wp((0,0,62)),31),'park_wheel_reverse_v6':camera('V6 | opposite park view',wp((90,215,5)),wp((0,0,60)),32)}
s.camera=cams['park_wheel_v6'];s.cycles.samples=40;s['latest_addition']='120m observation wheel centered in Yoyogi Central Grove'
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_park_wheel_v6.blend'))
for name,cam in cams.items():
    s.camera=cam;s.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True)
print('FERRIS_WHEEL_COMPLETE '+json.dumps(report),flush=True)
