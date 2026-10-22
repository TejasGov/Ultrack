"""Reference-led bridge, wet street and race lighting pass. Editable authoring scene."""
import bpy,math,json,ast,random
from pathlib import Path
from mathutils import Vector,Matrix
H=Path(__file__).resolve().parent;O=H/'out';ROOT=H.parent.parent
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_sakura_v3.blend'))
s=bpy.context.scene
# Reuse geometry helpers without executing the V3 scene generator.
tree=ast.parse((H/'overhaul_v3.py').read_text(encoding='utf8'))
for node in tree.body:
    if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ['col','material','mesh','Batch','text','area','camera']:
        exec(compile(ast.Module(body=[node],type_ignores=[]),'<helpers>','exec'))
C=col('V4 | suspension bridge');SIGNS=col('V4 | illuminated street signs');LIGHT=col('V4 | lighting study');STREET=col('V4 | event infrastructure')
M={k:bpy.data.materials['V3 '+k] for k in ['ivory','charcoal','cedar','red','warm','cyan','rose']}
M['steel']=material('V4 pearl bridge steel',(.62,.67,.7),.32,.55)
M['white']=material('V4 white floodlight',(.82,.91,1),.3,0,8)
M['ruby']=material('V4 red bridge luminaires',(1,.015,.018),.3,0,6)
font=bpy.data.fonts.load('C:/Windows/Fonts/msgothic.ttc')
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P)
T=[];norm=[]
for i in range(N):
    t=P[(i+1)%N]-P[i-1];t.z=0;t.normalize();T.append(t);norm.append(Vector((-t.y,t.x,0)))
def pt(i,x=0,z=0):return P[i]+norm[i]*x+Vector((0,0,z))
# Two open portals: road remains open for its full 18 m width. Tower inside edges at +/-12 m.
B=Batch()
for idx in [704,778]:
    tangent=T[idx];normal=norm[idx];angle=math.atan2(tangent.y,tangent.x)
    for side in [-1,1]:
        base=pt(idx,side*14,-3)
        B.box(base+Vector((0,0,28)),(5,4,56),M['steel'],angle)
        B.box(base+Vector((0,0,1)),(7,6,4),M['charcoal'],angle)
        for shift in [-1.5,1.5]:B.tube(base+tangent*shift+Vector((0,0,4)),base+tangent*shift+Vector((0,0,50)),.12,.12,M['ivory'])
        area('Bridge red uplight',pt(idx,side*11,1),pt(idx,side*14,31),9500,(1,.025,.018),3)
        B.box(pt(idx,side*11.8,1),(1,1,.25),M['ruby'],angle)
    B.box(pt(idx,0,50),(5,32,4),M['steel'],angle)
    # Curved inner corner braces soften the tower opening.
    for side in [-1,1]:
        last=None
        for j in range(17):
            a=j/16*math.pi/2;x=side*(8+4*math.cos(a));z=44+4*math.sin(a)
            q=pt(idx,x,z)
            if last is not None:B.tube(last,q,1.2,1.2,M['steel'],12)
            last=q
    text('Bridge tower identity '+str(idx),'東京  /  TOKYO',pt(idx,0,49)-tangent*2.55,1.25,M['warm'],angle-math.pi/2)
# Cables and suspenders follow the actual curved deck rather than a straight crossing shortcut.
for side in [-1,1]:
    last=None
    for i in range(675,809):
        if i<704:z=3+(i-675)/29*47
        elif i<=778:z=16+34*((i-741)/37)**2
        else:z=50-(i-778)/30*47
        q=pt(i,side*13,z)
        if last is not None:B.tube(last,q,.24,.24,M['charcoal'],8)
        if 704<i<778 and i%3==0:B.tube(pt(i,side*13,1),q,.065,.065,M['steel'],6)
        if i%4==0:
            B.tube(pt(i,side*11.7,.5),pt(i,side*11.7,1.2),.08,.08,M['ruby'],6)
        last=q
B.finish('Open portal towers, main cables and vertical suspenders',C)
# Damp asphalt: original Poly Haven color/normal retained; varied reflective film.
road=bpy.data.objects['Continuous road | 18m | source spline'];m=road.data.materials[0].copy();m.name='V4 damp Poly Haven asphalt';road.data.materials[0]=m
nt=m.node_tree;p=nt.nodes.get('Principled BSDF')
noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=.38;noise.inputs['Detail'].default_value=3
tex=nt.nodes.new('ShaderNodeTexCoord');nt.links.new(tex.outputs['Object'],noise.inputs['Vector'])
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.28;ramp.color_ramp.elements[0].color=(.10,.10,.10,1);ramp.color_ramp.elements[1].position=.72;ramp.color_ramp.elements[1].color=(.42,.42,.42,1)
nt.links.new(noise.outputs['Fac'],ramp.inputs[0]);nt.links.new(ramp.outputs[0],p.inputs['Roughness']);p.inputs['Coat Weight'].default_value=.65;p.inputs['Coat Roughness'].default_value=.12
# Blade signs face the approaching driver. Distinct sizes, colors and mounting brackets.
words=['ラーメン','カラオケ','ゲーム','東京珈琲','居酒屋','ホテル','焼肉','桜通り','書店','寿司']
random.seed(48)
for count,i in enumerate(range(210,383,8)):
    for side in [-1,1]:
        center=pt(i,side*22,random.uniform(8,14));angle=math.atan2(T[i].y,T[i].x)-math.pi/2
        width=random.uniform(1.3,2.2);height=random.uniform(4,7);mat=[M['rose'],M['cyan'],M['warm']][(count+(side==1))%3]
        B=Batch();B.box(center,(width,.45,height),M['charcoal'],angle)
        for dx in [-width/2,width/2]:
            q=center+Vector((math.cos(angle)*dx,math.sin(angle)*dx,0));B.tube(q-Vector((0,0,height/2)),q+Vector((0,0,height/2)),.055,.055,mat,6)
        B.tube(center,center+norm[i]*side*5,.09,.09,M['charcoal'])
        B.finish('Neon blade cabinet '+str(count)+' '+str(side),SIGNS)
        body='\n'.join(words[(count+(side==1)*3)%len(words)])
        text('Japanese blade '+str(i)+' '+str(side),body,center-T[i]*.25,min(.82,width*.65),mat,angle)
        if count%3==0:area('Street sign reflected light',center-T[i],pt(i,0,.1),2400,(1,.08,.28) if side<0 else (.08,.65,1),5)
# White event floodlights with modeled masts and light banks.
B=Batch()
for i in list(range(0,140,12))+list(range(690,798,12)):
    for side in [-1,1]:
        base=pt(i,side*16);q=base+Vector((0,0,12));B.tube(base,q,.13,.09,M['charcoal'])
        B.tube(q,q-norm[i]*side*2,.09,.09,M['charcoal']);head=q-norm[i]*side*2
        angle=math.atan2(T[i].y,T[i].x)
        B.box(head,(2,.7,.3),M['charcoal'],angle);B.box(head-Vector((0,0,.17)),(1.8,.6,.04),M['white'],angle)
        area('Race floodlight '+str(i)+' '+str(side),head,pt(i,0,0),2300,(.78,.87,1),3)
B.finish('Race lighting masts and fixture banks',STREET)
# Grid boxes provide the start straight with credible race infrastructure.
B=Batch()
for i in range(4,65,4):
    side=1 if i%8==0 else -1;q=pt(i,side*3,.035);theta=math.atan2(T[i].y,T[i].x)
    B.box(q,(.12,2.4,.018),M['ivory'],theta)
    for sg in [-1,1]:B.box(q+T[i]*1.5+norm[i]*sg*1.2,(3,.1,.018),M['ivory'],theta)
B.finish('Staggered starting grid paint',STREET)
cams={'bridge_v4':camera('V4 | bridge approach',pt(673,0,2),pt(718,0,23),24),'neon_street_v4':camera('V4 | neon drive',pt(237,0,1.8),pt(268,0,7),29),'stadium_v4':bpy.data.objects['V3 | race approach']}
s.cycles.samples=48;s.camera=cams['bridge_v4'];s['stage']='V4 reference-led suspension bridge, damp neon streets, race infrastructure; runtime pending'
for im in bpy.data.images:
    if im.source=='FILE' and not im.packed_file:im.pack()
checks={'road_samples_unchanged':len(road.data.polygons)==1440,'bridge_clear_width_m':24,'tower_indices':[704,778],'runtime_exported':False,'reference_images':7,'preview_lights_require_baking':True}
(O/'v4-checks.json').write_text(json.dumps(checks,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_sakura_v4.blend'))
for name,cam in cams.items():
    s.camera=cam;s.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True)
print('V4_COMPLETE',flush=True)
