"""Reference-led neon depth: near lanterns, receding signs, soft far city and Fuji."""
import bpy,math,json,random,ast
from pathlib import Path
from mathutils import Vector,Matrix
H=Path(__file__).resolve().parent;O=H/'out';ROOT=H.parent.parent
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_fuji_v7.blend'));s=bpy.context.scene
for node in ast.parse((H/'overhaul_v3.py').read_text(encoding='utf8')).body:
    if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ['col','material','mesh','Batch','text','area','camera']:
        exec(compile(ast.Module(body=[node],type_ignores=[]),'<helpers>','exec'))
C=col('V8 | neon depth architecture');SIGNS=col('V8 | layered tenant signs');LIGHT=col('V8 | street light pools');LAND=col('V8 | sakura framing');FAR=col('V8 | avenue distant city')
font=bpy.data.fonts.load('C:/Windows/Fonts/msgothic.ttc');random.seed(807)
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P);T=[];normal=[]
for i in range(N):
    t=P[(i+1)%N]-P[i-1];t.z=0;t.normalize();T.append(t);normal.append(Vector((-t.y,t.x,0)))
def pt(i,x=0,z=0,y=0):return P[i]+normal[i]*x+Vector((0,0,z))+T[i]*y
M={k:bpy.data.materials['V3 '+k] for k in ['charcoal','ivory','red','cedar','warm','cyan','rose']}
M['brass']=material('V8 aged sign brass',(.40,.23,.075),.38,.65)
for key,color,strength in [('pink',(1,.045,.25),4),('ice',(.035,.68,1),4),('amber',(1,.42,.07),3),('paper',(.95,.72,.40),2),('ink',(.018,.025,.035),0)]:M[key]=material('V8 '+key,color,.42,.15,strength)
facades=[bpy.data.materials[n] for n in ['V3 occupied warm offices','V3 stone tenant windows','V3 apartment windows','V3 reflective office windows']]
# Put the one Fuji card beyond the avenue, framing the actual driving direction.
fuji=bpy.data.objects['Mount Fuji | faint skyline backdrop'];h=max(v.co.z for v in fuji.data.vertices)-min(v.co.z for v in fuji.data.vertices)
for v,co in zip(fuji.data.vertices,[(-4250,6500,-260),(2550,6500,-260),(2550,6500,-260+h),(-4250,6500,-260+h)]):v.co=co
fuji['composition']='One mountain beyond the north commercial avenue, with receding city in front'
# Tenant signs at several heights: framed illuminated faces, support brackets, lettering.
words=['喫茶さくら','ラーメン','カラオケ','東京食堂','居酒屋','ホテル','焼肉','寿司','電気街','書店','珈琲','花屋']
sign_count=0
for k,i in enumerate(range(242,403,9)):
    for side in [-1,1]:
        angle=math.atan2(T[i].y,T[i].x)-math.pi/2
        for level in range(2 if k%3 else 3):
            z=5.5+level*5.4+random.uniform(-.6,.8);w=random.uniform(1.1,2.1);ht=random.uniform(3.3,5.1)
            center=pt(i,side*(21.5+level*.85),z,y=level*1.1)
            mat=[M['pink'],M['amber'],M['ice'],M['paper']][(k+level+(side>0))%4]
            rot=Matrix.Rotation(angle,4,'Z');B=Batch();B.box((0,0,0),(w,.5,ht),M['charcoal']);B.box((0,-.28,0),(w*.86,.05,ht*.93),mat)
            for dx in [-w*.5,w*.5]:B.box((dx,-.34,0),(.07,.12,ht+.12),M['brass'])
            B.tube((0,.3,ht*.34),(0,3,ht*.34),.065,.065,M['charcoal']);B.tube((0,.3,-ht*.34),(0,3,-ht*.34),.065,.065,M['charcoal'])
            ob=B.finish('Lit tenant cabinet %03d'%sign_count,SIGNS);ob.location=center;ob.rotation_euler.z=angle
            word=words[(k+level*4+(side>0)*3)%len(words)]
            # Dark glyphs on luminous paper; some black signs carry colored lettering.
            text('Tenant vertical %03d'%sign_count,'\n'.join(word),center+rot@Vector((0,-.33,0)),min(w*.65,ht/(len(word)*1.25)),M['ink'],angle)
            sign_count+=1
        if k%2==0:
            hue=(1,.04,.20) if (k+(side>0))%3 else (.035,.45,1)
            area('Tenant light pool '+str(i)+' '+str(side),pt(i,side*20,8),pt(i,side*3,.15),1150,hue,4)
        # A low horizontal shop fascia adds a second scale below vertical signs.
        p=pt(i,side*24,3.1);B=Batch();B.box((0,0,0),(5.6,.4,1),M['charcoal']);B.box((0,-.23,0),(5.3,.04,.78),M['amber'] if side<0 else M['paper']);ob=B.finish('Shop fascia '+str(i)+' '+str(side),SIGNS);ob.location=p;ob.rotation_euler.z=angle;text('Shop fascia lettering',words[k%len(words)],p+Matrix.Rotation(angle,4,'Z')@Vector((0,-.27,0)),.42,M['ink'],angle)
# Closer lanterns repeat at human scale, casting warmer pools than the mid-distance signs.
B=Batch()
for i in range(237,389,12):
    for side in [-1,1]:
        base=pt(i,side*15.5);q=base+Vector((0,0,3.5));B.tube(base,q+Vector((0,0,.8)),.055,.055,M['charcoal'])
        tip=q-normal[i]*side*.6;B.tube(q+Vector((0,0,.7)),tip+Vector((0,0,.7)),.045,.045,M['charcoal'])
        B.tube(tip-Vector((0,0,.45)),tip+Vector((0,0,.45)),.29,.29,M['paper'],16)
        for z in [-.47,.47]:B.tube(tip+Vector((0,0,z-.035)),tip+Vector((0,0,z+.035)),.31,.31,M['charcoal'],16)
        for z in [-.3,-.15,0,.15,.3]:B.tube(tip+Vector((0,0,z-.008)),tip+Vector((0,0,z+.008)),.295,.295,M['cedar'],16)
        if i%24==21:area('Lantern warm pavement',tip,base-normal[i]*side*3,160,(1,.27,.07),1.4)
B.finish('Avenue ribbed lantern promenade',C)
# Sakura foreground and mid-distance framing, using existing shared botanical meshes.
master=bpy.data.objects['Sakura master 0'];trees=0
for i,side,scale in [(236,-1,2.0),(240,1,1.9),(262,-1,1.5),(274,1,1.45),(299,-1,1.4),(320,1,1.4),(344,-1,1.2),(365,1,1.2)]:
    ob=bpy.data.objects.new('Avenue framing sakura %02d'%trees,master.data);LAND.objects.link(ob);ob.location=pt(i,side*20.5,-.05);ob.scale=(scale,scale,scale);ob.rotation_euler.z=i*.37;trees+=1
# Distinct five-tier Japanese roof silhouette beside the middle of the avenue.
i=316;q=pt(i,-83,-.1);B=Batch()
for tier in range(5):
    z=tier*5.7;w=19-tier*2.2;body=w*.64
    B.box((0,0,z+2.1),(body,body,4.2),M['cedar'])
    for side in [-1,1]:
        for k in range(-3,4):B.box((k*body/7,side*(body/2+.03),z+2),(.24,.15,3.6),M['red'])
        B.box((0,side*(body/2+.3),z+2.25),(body,.1,.23),M['amber'])
    # Square roof rings rise toward the hip; curled corners lift the eaves.
    radii=[w*.61,w*.50,w*.29,.20];heights=[z+4.15,z+4.05,z+5.5,z+6.7];sides=32
    for a in range(3):
        for k in range(sides):
            def roofpoint(r,zz,k):
                t=k*math.tau/sides;c,ss=math.cos(t),math.sin(t);v=Vector((c,ss,0))/max(abs(c),abs(ss));corner=(min(abs(v.x),abs(v.y)))**5
                return(v.x*r,v.y*r,zz+corner*(.85 if a==0 else .22))
            B.quad([roofpoint(radii[a],heights[a],k),roofpoint(radii[a],heights[a],k+1),roofpoint(radii[a+1],heights[a+1],k+1),roofpoint(radii[a+1],heights[a+1],k)],M['charcoal'])
    for k in range(32):
        t=k*math.tau/32;t2=(k+1)*math.tau/32
        def edge(t):
            c,ss=math.cos(t),math.sin(t);v=Vector((c,ss,0))/max(abs(c),abs(ss));return(v.x*w*.61,v.y*w*.61,z+4.18+min(abs(v.x),abs(v.y))**5*.85)
        B.tube(edge(t),edge(t2),.045,.045,M['amber'],6)
B.tube((0,0,30),(0,0,39),.15,.07,M['brass'],12)
for z in range(31,38):B.tube((0,0,z),(0,0,z+.08),.65,.65,M['brass'],12)
ob=B.finish('Avenue five-tier cedar pavilion and swept roofs',C);ob.location=q
area('Pavilion red eave wash',q+Vector((-7,-12,4)),q+Vector((0,0,20)),1900,(1,.055,.018),6)
# The avenue terminates visually in smaller, less saturated city blocks, leaving Fuji above.
for j in range(52):
    y=random.uniform(1050,2300);x=random.uniform(-1350,500);w=random.uniform(18,42);d=random.uniform(18,38);hh=random.uniform(23,100)
    B=Batch();B.box((x,y,hh/2),(w,d,hh),facades[j%4]);B.box((x,y,hh+.6),(w+.8,d+.8,1.2),M['charcoal']);B.finish('Receding city block %02d'%j,FAR,48)
    if j%2==0:
        B=Batch();B.box((x-w/2-1,y-d/2-.1,hh*.55),(1,.2,hh*.35),M['ice'] if j%3 else M['pink']);B.finish('Distant tenant glow %02d'%j,FAR)
# A small amount of distance haze separates city layers without washing out nearby lettering.
fog=material('V8 avenue distance haze',(.1,.1,.1));nt=fog.node_tree;nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');v=nt.nodes.new('ShaderNodeVolumePrincipled');v.inputs['Density'].default_value=.00011;v.inputs['Color'].default_value=(.20,.27,.40,1);v.inputs['Anisotropy'].default_value=.15;nt.links.new(v.outputs['Volume'],out.inputs['Volume'])
B=Batch();B.box((-400,1150,150),(2400,1500,550),fog);B.finish('Distant city atmospheric separation',FAR)
cam=camera('V8 | neon avenue toward Fuji',pt(240,0,1.65),pt(295,0,8),30)
s.camera=cam;s.cycles.samples=56;s.render.resolution_x=1600;s.render.resolution_y=1100;s.render.resolution_percentage=100;s['latest_addition']='Reference-led neon depth avenue: warm foreground, colorful receding signs, cool far city, faint Fuji'
report={'added_tenant_cabinets':sign_count,'shared_sakura_instances':trees,'far_city_blocks':52,'fuji_card_count':1,'fuji_direction':'Beyond north commercial avenue','road_geometry_changed':False,'reference':'User supplied Japanese street racing image; composition and lighting inspiration only','runtime_exported':False}
(O/'neon-depth-v8.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_neon_depth_v8.blend'))
s.render.filepath=str(O/'neon_depth_v8.png');bpy.ops.render.render(write_still=True)
print('NEON_DEPTH_COMPLETE',flush=True)
