"""Bridge-only second art pass; preserve the V4 authoring scene."""
import bpy,math,json,ast,bmesh
from pathlib import Path
from mathutils import Vector,Matrix
H=Path(__file__).resolve().parent;O=H/'out';ROOT=H.parent.parent
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_sakura_v4.blend'));s=bpy.context.scene
for node in ast.parse((H/'overhaul_v3.py').read_text(encoding='utf8')).body:
    if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ['col','material','mesh','Batch','area','camera']:
        exec(compile(ast.Module(body=[node],type_ignores=[]),'<helpers>','exec'))
C=col('V5 | sculpted bridge structure');LIGHT=col('V5 | bridge night lighting');FX=col('V5 | local bridge atmosphere')
old=bpy.data.collections['V4 | suspension bridge'];old.hide_render=True;old.hide_viewport=True
for o in bpy.data.objects:
    if o.name.startswith('Bridge tower identity'):o.hide_render=True;o.hide_set(True)
    if o.type=='LIGHT' and (o.name.startswith('Bridge red uplight') or (o.name.startswith('Race floodlight') and 690<=int(o.name.split()[2])<=798)):o.hide_render=True
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P);T=[];norm=[]
for i in range(N):
    t=P[(i+1)%N]-P[i-1];t.z=0;t.normalize();T.append(t);norm.append(Vector((-t.y,t.x,0)))
def pt(i,x=0,z=0,y=0):return P[i]+norm[i]*x+Vector((0,0,z))+T[i]*y
M={k:bpy.data.materials['V3 '+k] for k in ['ivory','charcoal','red','warm']}
M['tower']=material('V5 pearl concrete | weathered bridge',(.42,.45,.44),.48,.12)
nt=M['tower'].node_tree;p=nt.nodes['Principled BSDF'];noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=7;noise.inputs['Detail'].default_value=4
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.035;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],p.inputs['Normal'])
M['edge']=material('V5 pale inner arch reveal',(.65,.67,.61),.4,.2)
M['cable']=material('V5 braided dark cable',(.045,.05,.055),.32,.7)
M['rail']=material('V5 satin bridge rail',(.18,.20,.21),.34,.65)
M['redlight']=material('V5 red uplight lens',(1,.008,.003),.3,0,7)
M['amber']=material('V5 warm deck edge',(1,.37,.09),.3,0,2)
# Replace thick white floodlight fixtures / tall catch mesh only within bridge approach.
trimmed=[]
for ob in list(s.objects):
    if ob.type!='MESH' or not (ob.name.startswith(('Catch fence mesh','Race lighting masts','Street lamp','Street light','Lamp outreach','Lamp diffuser','Catch fence tension'))):continue
    # Local face centers determine membership; remove only bridge faces in combined meshes.
    bm=bmesh.new();bm.from_mesh(ob.data);remove=[]
    for f in bm.faces:
        q=ob.matrix_world@f.calc_center_median()
        if not(-660<q.x<20 and -190<q.y<470):continue
        i=min(range(650,835,3),key=lambda k:(P[k].x-q.x)**2+(P[k].y-q.y)**2)
        if 675<=i<=810 and (Vector((q.x,q.y,0))-Vector((P[i].x,P[i].y,0))).length<22:remove.append(f)
    if remove:
        bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(ob.data);trimmed.append([ob.name,len(remove)])
    bm.free()
# Extruded rounded opening, with a continuous deep soffit instead of pipe corner braces.
def prism(B,points,depth,mat):
    count=len(points);vs=[(x,y,z) for y in [-depth/2,depth/2] for x,z in points]
    B.add(vs,[tuple(reversed(range(count))),tuple(range(count,2*count))]+[(k,(k+1)%count,(k+1)%count+count,k+count) for k in range(count)],mat)
for idx in [704,778]:
    B=Batch()
    for side in [-1,1]:
        B.box((side*14.5,0,20.5),(5,5,47),M['tower'])
        B.box((side*14.5,0,-1),(7,8,4),M['charcoal'])
        # Solid corner haunch, following an elliptical quarter arch to the top opening.
        curve=[(side*(6+6*math.cos(a)),38+6*math.sin(a)) for a in [j*math.pi/2/24 for j in range(25)]]
        prism(B,[(side*17,38),(side*17,44)]+list(reversed(curve)),5,M['tower'])
        # Recessed vertical panel joints and small anchor plates.
        for xx in [side*13,side*15.7]:B.box((xx,-2.515,21),(.045,.025,42),M['rail'])
        for z in [2,4]:
            B.box((side*14.5,-2.58,z),(2.8,.12,.6),M['rail'])
            for dx in [-1,1]:B.tube((side*14.5+dx,-2.7,z),(side*14.5+dx,-2.8,z),.075,.075,M['edge'],8)
        # Narrow pale reveal follows the opening continuously.
        B.box((side*11.95,-2.6,19),(.18,.25,38),M['edge'])
        last=(side*12,-2.6,38)
        for j in range(1,25):
            a=j*math.pi/2/24;q=(side*(6+6*math.cos(a)),-2.6,38+6*math.sin(a));B.tube(last,q,.16,.16,M['edge'],8);last=q
    B.box((0,0,48),(34,5,8),M['tower']);B.box((0,-2.59,44),(12,.25,.24),M['edge'])
    for side in [-1,1]:B.box((side*14.5,0,52.4),(5.6,5.6,.8),M['edge'])
    ob=B.finish('Rounded portal tower '+str(idx),C)
    # local x is across road, local y follows deck.
    ob.matrix_world=Matrix(((norm[idx].x,T[idx].x,0,P[idx].x),(norm[idx].y,T[idx].y,0,P[idx].y),(0,0,1,P[idx].z),(0,0,0,1)))
    bevel=ob.modifiers.new('Soft cast edges','BEVEL');bevel.width=.10;bevel.segments=3
    for side in [-1,1]:
        area('Crimson tower wash '+str(idx)+' '+str(side),pt(idx,side*15,1,-7),pt(idx,side*14,26),14000,(1,.007,.003),4)
        area('Upper tower wash '+str(idx)+' '+str(side),pt(idx,side*19,8,-5),pt(idx,side*14,44),2200,(1,.018,.006),3)
        area('Arch soft grazing '+str(idx)+' '+str(side),pt(idx,side*11,42,-5),pt(idx,side*8,43),260,(.8,.78,.63),4)
# Cable continuity and subtle rail details provide a believable road-level silhouette.
B=Batch()
for side in [-1,1]:
    last=None
    for i in range(675,811):
        z=3+(i-675)/29*48 if i<704 else (14+37*((i-741)/37)**2 if i<=778 else 51-(i-778)/32*48)
        q=pt(i,side*14.4,z)
        if last is not None:
            B.tube(last,q,.26,.26,M['cable'],10)
            for zz in [.55,1.05]:B.tube(pt(i-1,side*10.3,zz),pt(i,side*10.3,zz),.07,.07,M['rail'],8)
            B.tube(pt(i-1,side*10.45,.18),pt(i,side*10.45,.18),.035,.035,M['amber'],6)
        if i%2==0:
            B.tube(pt(i,side*10.3,0),pt(i,side*10.3,1.12),.055,.055,M['rail'],6)
            if 704<i<778:
                B.tube(pt(i,side*14.4,.5),q,.055,.055,M['cable'],6)
                B.tube(q-Vector((0,0,.15)),q+Vector((0,0,.15)),.4,.4,M['rail'],8)
        last=q
    for idx in [704,778]:B.box(pt(idx,side*14,1,-5),(1,1,.25),M['redlight'])
B.finish('Suspension system, hanger clamps and warm rail edges',C)
# Low warm light keeps the road readable while the red tower remains the hero.
for i in range(680,810,14):
    for side in [-1,1]:area('Low bridge road wash',pt(i,side*10.2,1.0),pt(i,side*2,.2),190,(1,.39,.14),2)
# Restrained, localized humidity catches the actual red uplights; no opaque smoke cards.
fog=material('V5 local illuminated humidity',(.1,.1,.1));nt=fog.node_tree;nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');vol=nt.nodes.new('ShaderNodeVolumePrincipled');vol.inputs['Color'].default_value=(.48,.52,.58,1);vol.inputs['Anisotropy'].default_value=.2
tc=nt.nodes.new('ShaderNodeTexCoord');dist=nt.nodes.new('ShaderNodeVectorMath');dist.operation='DISTANCE';dist.inputs[1].default_value=(.5,.5,.5);nt.links.new(tc.outputs['Generated'],dist.inputs[0]);fade=nt.nodes.new('ShaderNodeMapRange');fade.inputs['From Min'].default_value=.18;fade.inputs['From Max'].default_value=.58;fade.inputs['To Min'].default_value=.022;fade.inputs['To Max'].default_value=0;fade.clamp=True;nt.links.new(dist.outputs['Value'],fade.inputs['Value']);ns=nt.nodes.new('ShaderNodeTexNoise');ns.inputs['Scale'].default_value=4;ns.inputs['Detail'].default_value=3;nt.links.new(tc.outputs['Generated'],ns.inputs['Vector']);mul=nt.nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';nt.links.new(fade.outputs[0],mul.inputs[0]);nt.links.new(ns.outputs['Fac'],mul.inputs[1]);nt.links.new(mul.outputs[0],vol.inputs['Density']);nt.links.new(vol.outputs['Volume'],out.inputs['Volume'])
for idx in [704,778]:
    for side in [-1,1]:
        B=Batch();B.box(pt(idx,side*19,18,-3),(13,13,40),fog);B.finish('Localized red-lit bridge haze',FX)
# Full night, matching the reference's dark sky and red-lit pale structure.
bg=s.world.node_tree.nodes['Background'];bg.inputs['Strength'].default_value=.018
for o in s.objects:
    if o.type=='LIGHT' and o.data.type=='SUN':o.data.energy=.008
s.view_settings.exposure=.15;s.cycles.samples=48;s.cycles.use_denoising=True
cam=camera('V5 | bridge driving view',pt(675,0,1.5),pt(718,0,24),28)
s.camera=cam;s.render.resolution_x=1600;s.render.resolution_y=1000;s.render.resolution_percentage=100
s['stage']='Bridge second art pass | rounded deep opening, crimson night lighting, cable and rail detail'
s['lighting']='Reference-led full night; V4 blue-hour source preserved separately'
checks={'road_vertices_unchanged':len(bpy.data.objects['Continuous road | 18m | source spline'].data.vertices),'road_half_width_m':9,'tower_clear_half_width_m':12,'tower_opening_height_m':44,'suspension_indices':[704,778],'trimmed_bridge_fixture_faces':trimmed,'scope':'Blender bridge art pass; runtime not exported'}
(O/'bridge-v5-report.json').write_text(json.dumps(checks,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_bridge_v5.blend'))
s.render.filepath=str(O/'bridge_night_v5.png');bpy.ops.render.render(write_still=True)
cam.location=pt(670,-5,2.3);cam.rotation_euler=(pt(720,0,24)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=27
s.render.filepath=str(O/'bridge_approach_v5.png');bpy.ops.render.render(write_still=True)
print('BRIDGE_SECOND_PASS_COMPLETE',flush=True)
