"""Tokyo Sakura Circuit: replacement environment with detailed modular architecture.
Uses v1 road/elevations; replaces scenery and venue. Local Blender source only.
"""
import bpy,math,random,json,bmesh
from mathutils import Vector,Matrix
from pathlib import Path
H=Path(__file__).resolve().parent;O=H/'out';ROOT=H.parent.parent
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_neon_v2.blend'))
s=bpy.context.scene;random.seed(221)
for name in ['04_LANDMARK_STUDIES','05_GRANDSTANDS','06_PARKS','08_SKYLINE','11_TOKYO_ARCHITECTURE_V2','12_JAPANESE_SIGNAGE','13_BAKED_DISTANT_SKYLINE']:
    c=bpy.data.collections.get(name)
    if c:
        for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(c)
for other in list(bpy.data.scenes):
    if other!=s:bpy.data.scenes.remove(other)
def col(name):
    c=bpy.data.collections.new(name);s.collection.children.link(c);return c
ARCH=col('V3 | district architecture');STAND=col('V3 | cedar stadiums');TREE=col('V3 | sakura and landscape');STREET=col('V3 | streets and furniture');SIGNS=col('V3 | Japanese identity');FAR=col('V3 | layered distant Tokyo');LIGHT=col('V3 | preview lights')
def material(name,color,rough=.65,metal=0,emit=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit;return m
M={}
for key,c,r,me,e in [('charcoal',(.045,.055,.062),.6,.3,0),('ivory',(.63,.60,.51),.85,0,0),('cedar',(.29,.13,.055),.7,0,0),('red',(.42,.018,.028),.6,.1,0),('brass',(.48,.28,.09),.35,.65,0),('seat',(.26,.11,.12),.6,0,0),('seat2',(.54,.38,.28),.65,0,0),('warm',(.95,.64,.32),.45,0,2),('cyan',(.07,.58,.75),.4,0,2),('rose',(.75,.11,.29),.4,0,2.5),('paper',(.85,.50,.36),.8,0,.6),('bark',(.10,.06,.045),.9,0,0),('leaf',(.07,.16,.065),.85,0,0),('leaf2',(.15,.22,.07),.85,0,0),('petal',(.90,.50,.61),.78,0,0),('petal2',(.97,.75,.79),.78,0,0),('petal3',(.64,.25,.39),.8,0,0),('soil',(.10,.075,.055),1,0,0)]:M[key]=material('V3 '+key,c,r,me,e)
M['concrete']=bpy.data.materials['Concrete | mineral'];M['water']=bpy.data.materials['Tokyo Bay'];M['white']=bpy.data.materials['Warm road paint']
# Grain and broad-scale material breakup preserve a coherent natural palette.
for key,scale in [('cedar',5),('bark',8),('ivory',24),('charcoal',45)]:
    nt=M[key].node_tree;p=nt.nodes['Principled BSDF'];tex=nt.nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=scale;tex.inputs['Detail'].default_value=3;bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.2;bump.inputs['Distance'].default_value=.035;nt.links.new(tex.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],p.inputs['Normal'])
def atlas(name,stem,glow=True):
    m=material(name,(.3,.3,.3),.35,.25);nt=m.node_tree;p=nt.nodes['Principled BSDF']
    for suffix,input in [('', 'Base Color'),('_glow','Emission Color')]:
        path=ROOT/'tracks/marina/out/textures'/f'{stem}{suffix}.png'
        if not path.exists():continue
        n=nt.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(path),check_existing=True);nt.links.new(n.outputs['Color'],p.inputs[input])
    p.inputs['Emission Strength'].default_value=.65 if glow else 0
    return m
facades=[atlas('V3 occupied warm offices','facade_warm'),atlas('V3 stone tenant windows','facade_stone'),atlas('V3 apartment windows','facade_hotel'),atlas('V3 reflective office windows','facade_cool')]
def mesh(name,v,f,mi,mats,c,uvscale=1):
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update()
    for m in mats:me.materials.append(m)
    for p,k in zip(me.polygons,mi):p.material_index=k
    uv=me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        axis=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3) if i!=axis]
        for li in p.loop_indices:
            co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]]/uvscale,co[axes[1]]/uvscale)
    o=bpy.data.objects.new(name,me);c.objects.link(o);return o
class Batch:
    def __init__(self):self.v=[];self.f=[];self.mi=[];self.m=[]
    def add(self,v,f,m):
        if m not in self.m:self.m.append(m)
        off=len(self.v);self.v.extend(v);self.f.extend([tuple(i+off for i in face) for face in f]);self.mi.extend([self.m.index(m)]*len(f))
    def box(self,p,d,m,rot=0):
        x,y,z=p;a,b,c=[i/2 for i in d];ca,sa=math.cos(rot),math.sin(rot)
        v=[(x+u*ca-v*sa,y+u*sa+v*ca,z+w) for u,v,w in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]]
        self.add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],m)
    def tube(self,a,b,r0,r1,m,n=8):
        a,b=Vector(a),Vector(b);q=(b-a).to_track_quat('Z','Y');vs=[]
        for p,r in [(a,r0),(b,r1)]:
            vs.extend([tuple(p+q@Vector((r*math.cos(i*math.tau/n),r*math.sin(i*math.tau/n),0))) for i in range(n)])
        self.add(vs,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],m)
    def quad(self,v,m):self.add(v,[(0,1,2,3)],m)
    def finish(self,name,c,uv=1):return mesh(name,self.v,self.f,self.mi,self.m,c,uv)
font=bpy.data.fonts.load('C:/Windows/Fonts/msgothic.ttc')
def text(name,body,p,size,m,angle=0):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.font=font;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.006;cu.materials.append(m);o=bpy.data.objects.new(name,cu);SIGNS.objects.link(o);o.location=p;o.rotation_euler=(math.pi/2,0,angle);return o
def area(name,p,target,power,color,size):
    ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.color=color;ld.shape='DISK';ld.size=size;o=bpy.data.objects.new(name,ld);LIGHT.objects.link(o);o.location=p;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P)
normal=[]
for i,p in enumerate(P):
    t=P[(i+1)%N]-P[i-1];t.z=0;t.normalize();normal.append(Vector((-t.y,t.x,0)))
def nearest(x,y):
    i=min(range(0,N,3),key=lambda i:(P[i].x-x)**2+(P[i].y-y)**2);return i,math.hypot(P[i].x-x,P[i].y-y)
terrain=bpy.data.objects['Roppongi topography | valley carved']
def ground(x,y):
    hit,co,_,_=terrain.ray_cast(Vector((x,y,600)),Vector((0,0,-1)))
    return co.z if hit else 0
# Broad terraced sidewalks, drainage and road wear; retain source road mesh exactly.
for side in [-1,1]:
    b=Batch()
    for i,p in enumerate(P):
        j=(i+1)%N;a=p+normal[i]*side*12.5;c=P[j]+normal[j]*side*12.5;d=P[j]+normal[j]*side*19;e=p+normal[i]*side*19
        b.quad([tuple(a),tuple(c),tuple(d),tuple(e)],M['concrete'])
    b.finish('Continuous sidewalk '+str(side),STREET)
    b=Batch()
    for i in range(0,N,10):
        p=P[i]+normal[i]*side*10.7;theta=math.atan2(normal[i].y,normal[i].x)
        b.box(p+Vector((0,0,.04)),(1.0,.5,.05),M['charcoal'],theta)
        for k in range(6):b.box(p+normal[i]*(k*.12-.3)+Vector((0,0,.07)),(.04,.42,.025),M['concrete'],theta)
    b.finish('Storm drains '+str(side),STREET)
# Chain-link is a 2-sided material reused from the benchmark, with real scale UV.
fence=material('V3 steel chainlink',(.3,.3,.3),.6,.65);nt=fence.node_tree;p=nt.nodes['Principled BSDF'];im=nt.nodes.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(ROOT/'tracks/marina/out/textures/chainlink.png'),check_existing=True);nt.links.new(im.outputs['Color'],p.inputs['Base Color']);nt.links.new(im.outputs['Alpha'],p.inputs['Alpha'])
for side in [-1,1]:
    b=Batch()
    for i in range(0,N,3):
        j=(i+3)%N;a=P[i]+normal[i]*side*11.35;c=P[j]+normal[j]*side*11.35
        b.quad([a+Vector((0,0,1.2)),c+Vector((0,0,1.2)),c+Vector((0,0,3.3)),a+Vector((0,0,3.3))],fence)
    b.finish('Catch fence mesh '+str(side),STREET,.6)
# Architectural road palette: off-white/charcoal safety wall, occasional vermilion accents.
for o in bpy.data.objects:
    if o.name.startswith('Continuous concrete barrier'):o.data.materials[0]=M['ivory']

# Three shared detailed tree variants. Branches and clustered petal/leaf surfaces have real silhouette.
tree_masters=[]
for variant in range(3):
    rng=random.Random(700+variant);b=Batch();b.tube((0,0,0),(.12,.05,3.4),.30,.17,M['bark'],10)
    tips=[]
    for k in range(9):
        a=k*math.tau/9+rng.uniform(-.2,.2);start=Vector((.1,0,2.0+k*.12));end=Vector((math.cos(a)*rng.uniform(2.6,3.6),math.sin(a)*rng.uniform(2.6,3.6),rng.uniform(4.8,6.3)));mid=start.lerp(end,.55)+Vector((0,0,.65))
        b.tube(start,mid,.13,.07,M['bark']);b.tube(mid,end,.07,.025,M['bark'],6)
        for q in range(4):
            tip=end+Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-.5,.9)));b.tube(mid,tip,.04,.009,M['bark'],5);tips.append(tip)
    for tip in tips:
        for j in range(100):
            a=rng.random()*math.tau;rr=rng.random()**.5*rng.uniform(.5,1.05);p=tip+Vector((math.cos(a)*rr,math.sin(a)*rr,rng.uniform(-.5,.6)));q=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-.4,1))).normalized().to_track_quat('Z','Y');size=rng.uniform(.07,.15)
            if variant<2:
                vs=[tuple(p)]+[tuple(p+q@Vector((math.cos(k*math.tau/10)*size*(.83 if k%2 else 1),math.sin(k*math.tau/10)*size*(.83 if k%2 else 1),.015))) for k in range(10)]
                b.add(vs,[(0,k+1,(k+1)%10+1) for k in range(10)],M[['petal','petal2','petal3'][rng.choices([0,1,2],[4,5,1])[0]]])
            else:
                vs=[tuple(p+q@Vector(v)) for v in [(-size,0,0),(0,size*.45,.03),(size,0,0),(0,-size*.45,.03)]];b.add(vs,[(0,1,2),(0,2,3)],M['leaf'] if j%3 else M['leaf2'])
    master=b.finish('Sakura master '+str(variant),TREE);master.location=(0,0,-1500);master.hide_render=True;master.hide_set(True);tree_masters.append(master)
tree_count=0
def tree(x,y,z=None,scale=1,kind=0):
    global tree_count
    o=bpy.data.objects.new('Sakura '+str(tree_count) if kind<2 else 'Green canopy '+str(tree_count),tree_masters[kind].data);TREE.objects.link(o);o.location=(x,y,ground(x,y) if z is None else z);o.scale=(scale,scale,scale);o.rotation_euler.z=random.random()*math.tau;tree_count+=1;return o
# Cherry promenade follows the C sweep and stretches of the bay; planted clear of the race surface.
for i in list(range(1120,1410,15))+list(range(20,150,18))+list(range(410,620,24)):
    for side in [-1,1]:
        q=P[i]+normal[i]*side*23
        if ground(q.x,q.y)<P[i].z-6:continue
        tree(q.x,q.y,scale=random.uniform(1.1,1.6),kind=random.choice([0,0,1,2]))
for center,rx,ry in [((-480,-220),160,80),((-710,240),75,60),((150,-350),85,40)]:
    for k in range(26):
        x=center[0]+random.uniform(-rx,rx);y=center[1]+random.uniform(-ry,ry);_,d=nearest(x,y)
        if d>32:tree(x,y,scale=random.uniform(1.0,1.6),kind=random.choice([0,1,2]))

# Human-scale commercial buildings. Actual wall reveals, inset glazing, balconies, awnings, plant beds.
words=['喫茶さくら','東京食堂','電気街','ゲームセンター','居酒屋','カラオケ','ラーメン','寿司','珈琲','花屋','書店','ホテル']
footprints=[]
def building(name,x,y,w,d,h,style=0,angle=0,base=None,sign=True):
    z=ground(x,y) if base is None else base;B=Batch();wmat=[M['ivory'],M['red'],M['charcoal'],M['cedar']][style%4];glass=facades[style%4]
    if base is not None:
        drop=max(0,z-min(ground(x+dx,y+dy) for dx in [-w/2,w/2] for dy in [-d/2,d/2]))
        if drop>.15:B.box((0,0,-drop/2),(w+2,d+2,drop),M['concrete'])
    # Windowed inner volume; outer bands and piers create measurable facade depth.
    B.box((0,0,h/2),(w-.7,d-.7,h),glass)
    B.box((0,0,.2),(w+2,d+2,.4),M['concrete'])
    floors=max(2,int(h/3.8))
    for j in range(floors+1):B.box((0,0,j*h/floors),(w+.35,d+.35,.25 if j else .5),wmat)
    for side in [-1,1]:
        for k in range(max(2,int(w/3.3))+1):
            xx=-w/2+w*k/max(2,int(w/3.3));B.box((xx,side*d/2,h/2),(.26,.5,h),wmat)
        # Rain eaves and separate tenant entrance frames.
        B.box((0,side*(d/2+.6),3.3),(w+1.2,2.2,.18),M['charcoal'])
    if style%4==2:
        for j in range(2,floors):
            zz=j*h/floors;B.box((0,-d/2-.9,zz),(w,2,.16),M['concrete'])
            for k in range(int(w)):
                B.box((-w/2+k,-d/2-1.8,zz+.55),(.05,.06,1),M['charcoal'])
            B.box((0,-d/2-1.8,zz+1.1),(w,.08,.08),M['charcoal'])
    # Rooftop parapets, air conditioning, plant screens and pipework.
    for sy in [-1,1]:B.box((0,sy*d/2,h+.5),(w,.25,1),wmat)
    for sx in [-1,1]:B.box((sx*w/2,0,h+.5),(.25,d,1),wmat)
    for k in range(3):
        xx=-w*.25+k*w*.25;B.box((xx,0,h+.65),(1.6,2.3,1.3),M['ivory'])
        for q in range(5):B.box((xx-.6+q*.3,-1.17,h+.7),(.08,.03,.8),M['charcoal'])
    # Timber-framed ground level, with canopy and lit transom band.
    B.box((0,-d/2-.38,2.75),(w*.94,.22,.58),M['charcoal'])
    for k in range(max(2,int(w/2.5))):
        xx=-w*.43+k*w*.86/max(1,max(2,int(w/2.5))-1);B.box((xx,-d/2-.38,1.4),(.13,.28,2.8),M['cedar'])
    B.box((0,-d/2-.3,2.35),(w*.9,.08,.12),M['warm'])
    ob=B.finish(name,ARCH,48);ob.location=(x,y,z);ob.rotation_euler.z=angle
    def wp(p):return Vector((x,y,z))+Matrix.Rotation(angle,4,'Z')@Vector(p)
    if sign:
        word=words[style%len(words)];text(name+' shop sign',word,wp((0,-d/2-.52,2.76)),min(.48,w/(len(word)*1.3)),M['warm'],angle)
        S=Batch();sx=w*.38;sh=min(9,h*.65);S.box((sx,-d/2-1,sh/2+4),(1.35,.7,sh),M['red'] if style%2 else M['charcoal'])
        for xx in [sx-.66,sx+.66]:S.box((xx,-d/2-1.38,sh/2+4),(.06,.04,sh),M['rose'] if style%2 else M['cyan'])
        ob=S.finish(name+' projecting sign',SIGNS);ob.location=(x,y,z);ob.rotation_euler.z=angle
        text(name+' vertical JP','\n'.join(words[(style+3)%len(words)]),wp((sx,-d/2-1.39,sh/2+4)),.8,M['warm'],angle)
    footprints.append((x,y,max(w,d)/2+3));return ob

# Mapped landmarks become distinct building groups, not a single universal tower.
D=json.loads((H/'source/map.json').read_text());SCALE=1.424708197157256
def xy(x,y):return((x-740)*SCALE,(470-y)*SCALE)
for idx,b in enumerate(D['landmarks']):
    cx,cy=xy(b['x']+b['w']/2,b['y']+b['h']/2)
    if idx in [0,1,6,9]:
        # Terraced mixed-use towers: stone lower floors, narrower upper volumes.
        building(b['name']+' podium',cx,cy,45,36,18,idx)
        building(b['name']+' mid tower',cx+3,cy+3,32,26,42+idx*2,idx+1,base=ground(cx,cy)+18)
        building(b['name']+' upper setback',cx+5,cy+5,25,21,18,idx+2,base=ground(cx,cy)+60+idx*2,sign=False)
        for k in [-1,1]:building(b['name']+' street annex',cx+k*43,cy-10,18,23,22+(idx%3)*8,idx+k)
    elif idx in [2,3,8,11]:
        # Dense narrow-lot commercial ensembles, especially Akihabara.
        for k in range(5):building(b['name']+' tenant '+str(k),cx+(k-2)*20,cy-10,17,25,random.choice([19,24,31,38,46]),idx+k)
        for k in range(3):building(b['name']+' rear block '+str(k),cx+(k-1)*29,cy+25,24,21,random.choice([20,28,42]),idx+k+3,sign=False)
    else:
        # Park / ridge pavilions, with low cedar architecture and broad eaves.
        building(b['name'],cx,cy,42,25,12,3)
        B=Batch()
        for level in [6,12]:
            for side in [-1,1]:
                B.quad([(-26,-17,level+.4),(26,-17,level+.4),(22,0,level+3.4),(-22,0,level+3.4)] if side<0 else [(-22,0,level+3.4),(22,0,level+3.4),(26,17,level+.4),(-26,17,level+.4)],M['charcoal'])
            for k in range(-24,25,2):B.box((k,0,level+.15),(.2,34,.35),M['cedar'])
        o=B.finish(b['name']+' deep eaves',ARCH);o.location=(cx,cy,ground(cx,cy))
    for k in [-1,1]:tree(cx+k*60,cy-35,scale=1.3,kind=0 if idx%2 else 2)

# Bring the city to road edges, with consistent setback and measured exclusion from other road spans.
for i in range(150,1110,28):
    if 650<i<860:continue
    for side in [-1,1]:
        p=P[i]+normal[i]*side*38;x,y=p.x,p.y
        if x>540:continue
        if any(math.hypot(x-cx,y-cy)<r+17 for cx,cy,r in footprints):continue
        _,distance=nearest(x,y)
        if distance<31:continue
        # Front (-Y) faces the circuit, varies with route tangent.
        toward=(P[i]-p).normalized();angle=math.atan2(toward.y,toward.x)+math.pi/2
        bw=random.uniform(11,17)
        building('Street frontage %04d %d'%(i,side),x,y,bw,random.uniform(13,19),random.choice([12,16,20,26,32]),i//28+side,angle,base=p.z-.1)
        for flank in [-1,1]:
            q=Vector((x,y,0))+Vector((math.cos(angle),math.sin(angle),0))*flank*(bw/2+7.5)
            _,dd=nearest(q.x,q.y)
            if dd>29:building('Street infill %04d %d %d'%(i,side,flank),q.x,q.y,11,15,random.choice([12,16,23,29]),i//28+flank+3,angle,base=p.z-.1)

# Bespoke grandstands: separate structural bays, exposed cedar soffit, seats, stair aisles, rear access.
def stadium(name,cx,cy,width,depth,z,angle=0):
    B=Batch();rows=14;rise=.48;tread=depth/rows
    drop=max(.6,z-ground(cx,cy)+.3);B.box((0,0,-drop/2),(width+2,depth+3,drop),M['concrete'])
    # Local -Y faces the track. Roof is broken into shallow lifted bays.
    for j in range(rows):
        yy=-depth/2+(j+.5)*tread;B.box((0,yy,(j+1)*rise/2),(width,tread,(j+1)*rise),M['concrete'])
        for k in range(int(width/.72)):
            xx=-width/2+(k+.5)*.72
            if (xx+width/2)%20<2.1:continue
            seat=M['seat'] if (k//12+j//3)%3 else M['seat2'];B.box((xx,yy,(j+1)*rise+.35),(.48,.43,.11),seat);B.box((xx,yy+.20,(j+1)*rise+.63),(.48,.10,.52),seat)
    for xx in range(int(-width/2),int(width/2),20):
        for j in range(rows*2):B.box((xx+1,-depth/2+(j+.5)*tread/2,(j+1)*rise/2), (1.8,tread/2,.12),M['ivory'])
        B.tube((xx+.15,-depth/2,1.0),(xx+.15,depth/2,rows*rise+1),.045,.045,M['charcoal'])
    for bay in range(math.ceil(width/16)):
        x0=-width/2+bay*16;x1=min(width/2,x0+16);xm=(x0+x1)/2
        for xx in [x0,x1]:
            B.tube((xx,depth*.35,0),(xx,depth*.35,12),.17,.14,M['charcoal'])
            B.tube((xx,depth*.35,8),(xx,-depth/2-3,10.1),.13,.10,M['charcoal'])
            B.tube((xx,depth*.35,12),(xx,-depth/2-3,10.1),.12,.08,M['cedar'])
        roof=[(x0,-depth/2-4,10.5),(x1,-depth/2-4,10.5),(x1,depth/2+2,12.8),(x0,depth/2+2,12.8)]
        B.quad(roof,M['charcoal']);B.quad([(x,y,z-.18) for x,y,z in reversed(roof)],M['cedar'])
        for xx in range(int(x0),int(x1),1):B.tube((xx,-depth/2-4,10.2),(xx,depth/2+2,12.5),.08,.08,M['cedar'],4)
        B.box((xm,-depth/2-4,10.2),(x1-x0,.3,.55),M['cedar']);B.box((xm,-depth/2-4.18,10.1),(x1-x0-.5,.05,.08),M['warm'])
    # Low terraced rear screen and planted apron.
    for zz in [2,5]:
        B.box((0,depth/2+1,zz),(width,2,.28),M['charcoal'])
        for xx in range(int(-width/2),int(width/2),1):B.box((xx,depth/2+2,zz-1.2),(.12,.15,2.4),M['cedar'])
    B.box((0,-depth/2-.6,.6),(width,1,1.2),M['charcoal'])
    ob=B.finish(name,STAND);ob.location=(cx,cy,z);ob.rotation_euler.z=angle
    def wp(p):return Vector((cx,cy,z))+Matrix.Rotation(angle,4,'Z')@Vector(p)
    text(name+' identity','東京  /  SAKURA CIRCUIT',wp((0,-depth/2-4.2,10.2)),.65,M['warm'],angle)
    for k,xx in enumerate(range(int(-width/2)+10,int(width/2),24)):
        text(name+' terrace banner '+str(k),['桜  SAKURA','ULTRACK','東京  TOKYO'][k%3],wp((xx,-depth/2-1.12,.72)),.42,M['warm'] if k%2 else M['rose'],angle)
    for xx in range(int(-width/2)+8,int(width/2),24):
        p=wp((xx,-depth/2-2,8.8));target=wp((xx,0,3));area('Under-eave venue light',p,target,750,(1,.67,.40),5)
    for xx in range(int(-width/2),int(width/2),20):
        p=wp((xx,depth/2+9,0));tree(p.x,p.y,z,1.35,0)
stadium('Bayfront cedar grandstand',-128,-553,320,24,1,math.pi)
stadium('Paddock club terraces',-128,-463,210,19,1,0)
stadium('Roppongi ridge gallery',-305,580,240,21,28.5,math.pi)
stadium('Shibuya garden stand',-820,-250,170,20,2,-math.pi/2)

# Keep tree trunks and crowns out of the occupied seating footprint.
stand_bounds=[(-128,-553,320,24,math.pi),(-128,-463,210,19,0),(-305,580,240,21,math.pi),(-820,-250,170,20,-math.pi/2)]
removed_trees=0
for o in list(TREE.objects):
    if o.hide_render:continue
    for cx,cy,w,d,a in stand_bounds:
        p=Matrix.Rotation(-a,4,'Z')@(o.location-Vector((cx,cy,0)))
        if abs(p.x)<w/2+5 and abs(p.y)<d/2+6:
            bpy.data.objects.remove(o,do_unlink=True);removed_trees+=1;break
tree_count-=removed_trees

# A race gantry has structure, visible start lamps, and a readable local identity.
old=bpy.data.objects.get('Start finish bridge')
if old:
    gp=old.location.copy();ga=old.rotation_euler.z;bpy.data.objects.remove(old,do_unlink=True);B=Batch()
    for yy in [-.65,.65]:
        for zz in [-.65,.65]:B.tube((-13,yy,zz),(13,yy,zz),.10,.10,M['charcoal'])
        for k in range(13):B.tube((-13+k*2,yy,-.65),(-11+k*2,yy,.65),.055,.055,M['charcoal'])
    B.box((0,-.75,0),(19,.2,1.55),M['red']);o=B.finish('Tokyo start truss and fascia',STREET);o.location=gp;o.rotation_euler.z=ga
    # The approach face is local +Y for this track direction.
    B=Batch();B.box((0,.75,0),(19,.2,1.55),M['charcoal'])
    for xx in [-2,-1,0,1,2]:B.tube((xx,.9,-1.2),(xx,1.03,-1.2),.17,.17,M['rose'],12)
    o=B.finish('Tokyo gantry approach fascia',STREET);o.location=gp;o.rotation_euler.z=ga
    for face in [-1,1]:
        loc=gp+Matrix.Rotation(ga,4,'Z')@Vector((0,face*.88,0));text('Start identity','東京 桜  /  TOKYO SAKURA',loc,.86,M['warm'],ga+(math.pi if face==1 else 0))

# Lanterns, banners, benches and planting give the circuit an authored human scale.
B=Batch()
for i in range(0,N,18):
    p=P[i]+normal[i]*16;theta=math.atan2(normal[i].y,normal[i].x)
    if 650<i<850:continue
    B.tube(p,p+Vector((0,0,4.3)),.06,.05,M['charcoal']);B.tube(p+Vector((0,0,4.2)),p+normal[i]*.7+Vector((0,0,4.2)),.045,.045,M['charcoal'])
    q=p+normal[i]*.7+Vector((0,0,3.7));B.tube(q-Vector((0,0,.35)),q+Vector((0,0,.35)),.24,.24,M['paper'],12)
    for zz in [-.35,.35]:B.tube(q+Vector((0,0,zz-.03)),q+Vector((0,0,zz+.03)),.25,.25,M['charcoal'],12)
    # Benches and natural planters sit on the new sidewalks.
    if i%36==0:
        b=p+normal[i]*1.5
        for k in range(4):B.box(b+Vector((0,k*.13-.2,.5)),(1.8,.10,.08),M['cedar'],theta)
        for dx in [-.65,.65]:B.box(b+Vector((dx,0,.25)),(.12,.45,.5),M['charcoal'],theta)
B.finish('Lantern promenade kit',STREET)
# Roadside signboards at turn approaches, with original Japanese event identity.
for i in [120,310,600,900,1150,1370]:
    p=P[i]+normal[i]*18;B=Batch();B.box(p+Vector((0,0,2.2)),(7,.35,2.4),M['charcoal']);B.finish('Trackside event board '+str(i),STREET);text('Sakura event '+str(i),'桜  東京ストリート',p+Vector((0,-.2,2.2)),.6,M['warm'])

# Layered, textured skyline geometry. Low-cost far meshes replace the diagrammatic card.
for i in range(65):
    x=random.uniform(1200,2350);y=random.uniform(-1200,1800);w=random.uniform(22,60);d=random.uniform(25,55);h=random.uniform(55,200);B=Batch();B.box((0,0,h/2),(w,d,h),facades[i%4]);B.box((0,0,h+2),(w*.85,d*.85,4),M['charcoal']);o=B.finish('Far Tokyo block '+str(i),FAR,48);o.location=(x,y,0)
# Tall recognizable landmarks are 3D at the far shore, with textured cities in front and behind.
B=Batch();tx,ty=1600,650
levels=[(0,44),(70,30),(145,18),(195,11),(250,5),(300,2)]
for (z0,r0),(z1,r1) in zip(levels,levels[1:]):
    for side in range(4):
        a=side*math.pi/2+math.pi/4;b=(side+1)*math.pi/2+math.pi/4
        p0=(tx+math.cos(a)*r0,ty+math.sin(a)*r0,z0);p1=(tx+math.cos(a)*r1,ty+math.sin(a)*r1,z1);B.tube(p0,p1,1.2,.8,M['red'])
        for k in range(5):
            za=z0+(z1-z0)*k/5;zb=z0+(z1-z0)*(k+1)/5;ra=r0+(r1-r0)*k/5;rb=r0+(r1-r0)*(k+1)/5
            B.tube((tx+math.cos(a)*ra,ty+math.sin(a)*ra,za),(tx+math.cos(b)*rb,ty+math.sin(b)*rb,zb),.28,.28,M['warm'],5)
for z,w in [(150,35),(250,14)]:B.box((tx,ty,z),(w,w,9),M['ivory'])
B.tube((tx,ty,290),(tx,ty,333),1.4,.5,M['warm']);B.finish('Tokyo Tower | distant dimensional lattice',FAR)
B=Batch();x,y=2000,1600;B.tube((x,y,0),(x,y,350),15,6,M['ivory'],18);B.tube((x,y,350),(x,y,500),6,2.8,M['ivory'],16)
for z,r in [(350,17),(450,11)]:B.tube((x,y,z-7),(x,y,z+7),r,r*.7,M['charcoal'],20);B.tube((x,y,z-8),(x,y,z-6),r,r,M['cyan'],20)
B.tube((x,y,500),(x,y,634),2.8,.4,M['ivory'],12);B.finish('Tokyo Skytree | distant tapered silhouette',FAR)
# Extended bay and distant shore prevent floating skyline / cut-off water edges.
water=bpy.data.objects['Tokyo Bay water'];water.location=(1900,100,-.7);water.scale=(2900,4400,.3)
B=Batch();B.box((1900,250,-1.3),(1800,3400,1),M['charcoal']);B.finish('Distant reclaimed shore',FAR)

# Camera and lighting: retain texture visibility while warm lighting carries the new identity.
for o in list(s.objects):
    if o.type=='LIGHT' and o.name not in LIGHT.objects:
        if o.data.type=='SUN':o.data.energy=.8;o.rotation_euler=(.8,-.7,-.5)
world=s.world;nt=world.node_tree;bg=nt.nodes.get('Background')
for link in list(bg.inputs['Color'].links):nt.links.remove(link)
env=nt.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(ROOT/'assets/polyhaven/belfast_sunset_puresky/belfast_sunset_puresky_2k.hdr'),check_existing=True);nt.links.new(env.outputs['Color'],bg.inputs['Color']);bg.inputs['Strength'].default_value=.45
s.view_settings.view_transform='AgX';s.view_settings.exposure=.2;s.cycles.samples=32;s.cycles.use_denoising=True
def camera(name,pos,target,lens=35):
    cu=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cu);s.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();cu.lens=lens;cu.clip_end=12000;return ob
cams={
 'sakura_straight_v3':camera('V3 | race approach',(-370,-515,4.5),(-60,-515,10),26),
 'cedar_grandstand_v3':camera('V3 | cedar stadium',(-235,-495,6),(-105,-554,7),30),
 'tokyo_street_v3':camera('V3 | commercial street',P[240]+Vector((0,0,3)),P[270]+Vector((0,0,8)),26),
 'sakura_garden_v3':camera('V3 | cherry sweep',P[1230]+Vector((0,0,3)),P[1260]+Vector((0,0,6)),30),
 'overview_v3':camera('V3 | whole circuit',(-1200,-1550,1250),(100,100,0),33),
}
s.render.resolution_x=1600;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.camera=cams['sakura_straight_v3']
s['stage']='V3 Tokyo Sakura comprehensive scenery overhaul; runtime validation pending'
for im in bpy.data.images:
    if im.source=='FILE' and not im.packed_file:im.pack()
visible=[o for o in s.objects if o.type=='MESH' and not o.hide_render]
stats={'stage':'v3 architecture overhaul','trees':tree_count,'buildings':len(footprints),'triangles_instanced':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in visible),'unique_meshes':len(set(o.data for o in visible)),'road_source':'v1 unchanged geometry','stand_design':'14-row cedar soffit / structural bay / individual seat / stair aisle system','runtime_exported':False,'reference':'Marina authored mesh/material density benchmark; National Stadium timber eaves and Nakameguro sakura as design references','remaining':['Runtime culling/LOD and memory measurements','Traffic / crowd pass','Final bespoke landmark detailing and lighting bake']}
(O/'overhaul-v3-report.json').write_text(json.dumps(stats,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_sakura_v3.blend'));print('V3_SAVED '+json.dumps(stats),flush=True)
for name,cam in cams.items():
    s.camera=cam;s.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True)
print('V3_COMPLETE',flush=True)
