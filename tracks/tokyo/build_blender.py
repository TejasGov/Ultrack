"""Editable, local-only Tokyo circuit layout / architectural study; no runtime export.
Run Blender -b --factory-startup -P tracks/tokyo/build_blender.py -- --render
"""
import bpy, math, json, sys, random, hashlib
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
OUT = HERE / 'out'
OUT.mkdir(exist_ok=True)
D = json.loads((HERE/'source/map.json').read_text(encoding='utf8'))
random.seed(83)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
def collection(name):
    c=bpy.data.collections.new(name); scene.collection.children.link(c); return c
C={n:collection(n) for n in ['01_TRACK','02_TERRAIN','03_VIADUCT','04_LANDMARK_STUDIES','05_GRANDSTANDS','06_PARKS','07_STREET_KIT','08_SKYLINE','09_CAMERAS','10_COLLISION_STUDY']}
def move(o,c):
    for k in list(o.users_collection): k.objects.unlink(o)
    C[c].objects.link(o); return o
def mat(name,color,rough=.5,metal=0,emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metal
    if emission: p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emission
    return m
M={
 'asphalt':mat('Asphalt | PBR 2K',(.055,.065,.075),.85),
 'concrete':mat('Concrete | mineral',(.32,.34,.33),.85),
 'stone':mat('Viaduct | charcoal stone',(.16,.18,.18),.8),
 'white':mat('Warm road paint',(.82,.83,.78),.6),
 'red':mat('Kerb vermilion',(.56,.025,.035),.65),
 'steel':mat('Anodized graphite',(.06,.085,.10),.35,.75),
 'glass':mat('Blue curtain glazing',(.045,.13,.17),.23,.55),
 'grass':mat('Park meadow',(.065,.14,.085),.95),
 'leaf':mat('Pine foliage',(.025,.085,.055),.95),
 'bark':mat('Tree trunks',(.12,.075,.04),.9),
 'water':mat('Tokyo Bay',(.025,.105,.14),.22,.3),
 'warm':mat('Window warm',(.7,.38,.15),.4,0,.8),
 'cyan':mat('Wayfinding ice',(.08,.65,.75),.35,0,1.5),
 'pink':mat('Sign vermilion',(.8,.035,.13),.35,0,1.5),
}
# Reuse locally credited Poly Haven asphalt, packed into the .blend.
ph=HERE.parent.parent/'assets/polyhaven/asphalt_track'
nt=M['asphalt'].node_tree; bs=nt.nodes.get('Principled BSDF')
tc=nt.nodes.new('ShaderNodeTexCoord'); mapping=nt.nodes.new('ShaderNodeVectorMath'); mapping.operation='SCALE'; mapping.inputs[3].default_value=.25
geo=nt.nodes.new('ShaderNodeNewGeometry'); nt.links.new(geo.outputs['Position'],mapping.inputs[0])
for kind in ['diff','nor_gl','arm']:
    path=ph/f'asphalt_track_{kind}_2k.jpg'
    if not path.exists(): continue
    t=nt.nodes.new('ShaderNodeTexImage'); t.image=bpy.data.images.load(str(path),check_existing=True); nt.links.new(mapping.outputs[0],t.inputs['Vector'])
    if kind=='diff':nt.links.new(t.outputs['Color'],bs.inputs['Base Color'])
    else:
        t.image.colorspace_settings.name='Non-Color'
        if kind=='nor_gl':
            n=nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(t.outputs['Color'],n.inputs['Color']); nt.links.new(n.outputs[0],bs.inputs['Normal'])
        else:
            n=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(t.outputs['Color'],n.inputs[0]);nt.links.new(n.outputs[1],bs.inputs['Roughness'])
def mesh(name,v,f,material,c):
    me=bpy.data.meshes.new(name); me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(name,me);C[c].objects.link(o)
    if material:me.materials.append(material)
    return o
cube_cache={}
def box(name,loc,dims,material,c='07_STREET_KIT',angle=0,bevel=0):
    key=material.name
    if key not in cube_cache:
        me=bpy.data.meshes.new('Shared unit box | '+key)
        me.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);me.materials.append(material);cube_cache[key]=me
    o=bpy.data.objects.new(name,cube_cache[key]);C[c].objects.link(o);o.location=loc;o.scale=dims;o.rotation_euler.z=angle
    return o
def beam(name,a,b,r,material,c='07_STREET_KIT'):
    a,b=Vector(a),Vector(b);o=box(name,(a+b)/2,(r,r,(b-a).length),material,c);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def text(name,body,loc,size,material,rotation=(math.pi/2,0,0),c='04_LANDMARK_STUDIES'):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.025;cu.materials.append(material)
    o=bpy.data.objects.new(name,cu);C[c].objects.link(o);o.location=loc;o.rotation_euler=rotation;return o

# Preserve the source's Catmull-Rom interpolation exactly (80 samples/control span).
raw=[]
for i,p1 in enumerate(D['waypoints']):
    ps=[D['waypoints'][j%18] for j in [i-1,i,i+1,i+2]]
    for j in range(80):
        t=j/80;f=[-.5*t**3+t*t-.5*t,1.5*t**3-2.5*t*t+1,-1.5*t**3+2*t*t+.5*t,.5*t**3-.5*t*t]
        raw.append({**{k:sum(p[k]*q for p,q in zip(ps,f)) for k in ['x','y','elev']},'bridge':sum(p['viaduct']*q for p,q in zip(ps,f))>.42,'span':i,'t':t})
length=sum(math.dist((p['x'],p['y']),(raw[(i+1)%len(raw)]['x'],raw[(i+1)%len(raw)]['y'])) for i,p in enumerate(raw))
S=5180/length
def xy(x,y):return ((x-740)*S,(470-y)*S)
pts=[Vector((*xy(p['x'],p['y']),p['elev'])) for p in raw];N=len(pts)
norm=[];arc=[0.]
for i,p in enumerate(pts):
    t=pts[(i+1)%N]-pts[i-1];t.z=0;t.normalize();norm.append(Vector((-t.y,t.x,0)))
    if i:arc.append(arc[-1]+(p-pts[i-1]).length)
HW=9.0
def ribbon(name,a,b,z,material,c='01_TRACK',indices=None):
    ids=list(range(N)) if indices is None else list(indices);v=[];f=[]
    for i in ids:
        for d in [a,b]:v.append(tuple(pts[i]+norm[i]*d+Vector((0,0,z))))
    count=len(ids) if indices is None else len(ids)-1
    for k in range(count):j=(k+1)%len(ids);f.append((2*k,2*j,2*j+1,2*k+1))
    return mesh(name,v,f,material,c)
road=ribbon('Continuous road | 18m | source spline',-HW,HW,0,M['asphalt']);solid=road.modifiers.new('Road slab 0.65m','SOLIDIFY');solid.thickness=.65
for side in [-1,1]:
    a,b=sorted([side*HW,side*(HW+1.2)])
    o=ribbon('Kerb | outer' if side<0 else 'Kerb | inner',a,b,.10,M['white']);o.data.materials.append(M['red'])
    for poly in o.data.polygons:poly.material_index=int(arc[poly.index]/3)%2
    a,b=sorted([side*(HW-.35),side*(HW-.18)]);ribbon('Continuous edge line',a,b,.025,M['white'])
    a,b=sorted([side*(HW+2.1),side*(HW+2.6)]);o=ribbon('Continuous concrete barrier',a,b,1.05,M['concrete']);o.modifiers.new('Barrier solid profile','SOLIDIFY').thickness=1.05
    for i in range(0,N,7):
        p=pts[i]+norm[i]*side*(HW+2.35);box('Fence upright',p+Vector((0,0,2.25)),(.09,.09,2.4),M['steel'])
    for h in [1.7,2.4,3.35]:
        a,b=sorted([side*(HW+2.32),side*(HW+2.38)]);ribbon('Catch fence tension cable',a,b,h,M['steel'],'07_STREET_KIT')
for i in range(0,N,7):
    ribbon('Dashed centre paint',-.075,.075,.028,M['white'],indices=[i,(i+1)%N,(i+2)%N])
col=road.copy();col.data=road.data.copy();col.name='COLLISION_ROAD_STUDY';col.modifiers.clear();C['10_COLLISION_STUDY'].objects.link(col);col.hide_render=True;col.hide_set(True)

# Spatial ground grid: hillside is cut down by the lower valley and graded to road edges.
grid={}
cell=40
for i,p in enumerate(pts):grid.setdefault((math.floor(p.x/cell),math.floor(p.y/cell)),[]).append(i)
def near(x,y):
    ix,iy=math.floor(x/cell),math.floor(y/cell);ids=[]
    for dx in [-1,0,1]:
        for dy in [-1,0,1]:ids+=grid.get((ix+dx,iy+dy),[])
    if not ids:return 1e6,None
    k=min(ids,key=lambda i:(pts[i].x-x)**2+(pts[i].y-y)**2)
    return math.hypot(pts[k].x-x,pts[k].y-y),k
def ground(x,y):
    mx=x/S+740;my=470-y/S;dx=mx-535;dy=my-255;c=math.cos(-.26);s=math.sin(-.26);r=math.hypot((dx*c+dy*s)/395,(-dx*s+dy*c)/230)
    z=28.5*max(0,1-r)**1.3
    dist,i=near(x,y)
    if i is not None:
        # Lower valley must carve the hill even where the upper viaduct is nearby.
        candidates=[];ix,iy=math.floor(x/cell),math.floor(y/cell)
        for a in [-1,0,1]:
            for b in [-1,0,1]:
                for j in grid.get((ix+a,iy+b),[]):
                    d=math.hypot(pts[j].x-x,pts[j].y-y)
                    if d<42 and not raw[j]['bridge']:candidates.append((d,j))
        if candidates:
            d,j=min(candidates);w=max(0,min(1,(42-d)/24));z=z*(1-w)+(pts[j].z-.7)*w
        if raw[i]['bridge'] and dist<HW+5:z=min(z,pts[i].z-6)
    return max(-.25,z)
v=[];f=[];nx=160;ny=112
xmin,xmax=xy(0,0)[0],xy(1144,0)[0];ymin,ymax=xy(0,940)[1],xy(0,0)[1]
for j in range(ny+1):
    for i in range(nx+1):
        x=xmin+(xmax-xmin)*i/nx;y=ymin+(ymax-ymin)*j/ny;v.append((x,y,ground(x,y)))
for j in range(ny):
    for i in range(nx):a=j*(nx+1)+i;f.append((a,a+1,a+nx+2,a+nx+1))
terrain=mesh('Roppongi topography | valley carved',v,f,M['grass'],'02_TERRAIN')
for p in terrain.data.polygons:p.use_smooth=True
box('Tokyo Bay water',(*xy(1315,470),-.7),(342*S,1040*S,.3),M['water'],'02_TERRAIN')
box('Bay seawall',(*xy(1144,470),.4),(4,940*S,2.2),M['concrete'],'02_TERRAIN')

# Source bridge carried as a real open deck. Piers excluded from any lower road envelope.
bridge_ids=[i for i,p in enumerate(raw) if p['bridge']]
for i in bridge_ids[::12]:
    p=pts[i]
    for side in [-1,1]:
        q=p+norm[i]*side*(HW-1.0)
        low=[j for j,r in enumerate(raw) if not r['bridge'] and math.hypot(pts[j].x-q.x,pts[j].y-q.y)<HW+7 and pts[j].z<p.z-4]
        if low:continue
        z=ground(q.x,q.y);h=p.z-z-1.2
        if h>1:box('Stone viaduct pier', (q.x,q.y,z+h/2),(2,3,h),M['stone'],'03_VIADUCT',math.atan2(norm[i].y,norm[i].x))
for side in [-1,1]:
    a,b=sorted([side*(HW-.6),side*(HW-1.2)]);ribbon('Viaduct edge girder',a,b,-.9,M['stone'],'03_VIADUCT',bridge_ids)

def building(b,idx,sky=False):
    x,y=xy(b['x']+b['w']/2,b['y']+b['h']/2);w,d=b['w']*S,b['h']*S;z=ground(x,y) if not sky else 1
    c='08_SKYLINE' if sky else '04_LANDMARK_STUDIES';name=b['name'];heights=[105,145,64,24,52,32,85,35,30,118,28,38];h=heights[idx%12] if not sky else [130,170,110,150][idx]
    accent=M['cyan'] if idx%2==0 else M['pink']
    box(name+' | terrace foundation',(x,y,z+1),(w,d,2),M['concrete'],c)
    podium=8 if h>40 else 4
    box(name+' | podium',(x,y,z+podium/2+2),(w*.91,d*.91,podium),M['stone'],c)
    tw,td=w*.64,d*.64
    if idx==3 and not sky:tw,td=w*.83,d*.83
    if idx==4 and not sky:tw,td=w*.52,d*.52
    box(name+' | authored mass',(x,y,z+podium+2+h/2),(tw,td,h),M['glass'] if h>40 else M['concrete'],c)
    for floor in range(0,int(h),5):
        box(name+' | floor reveal',(x,y,z+podium+2+floor),(tw+1,td+1,.25),M['steel'],c)
    # Shared mullion meshes, recessed window bands and visible roof services.
    for side in [-1,1]:
        for k in range(1,9):
            xx=x-tw/2+tw*k/9;box(name+' | facade fin',(xx,y+side*(td/2+.2),z+podium+2+h/2),(.28,.65,h),M['concrete'],c)
        box(name+' | crown light',(x,y+side*td/2,z+podium+h+1.5),(tw,.35,.5),accent,c)
        for k in range(5):
            xx=x-tw*.35+k*tw*.175
            box(name+' | lobby glazing',(xx,y+side*(td/2+.35),z+podium+4),(tw*.1,.2,3.6),M['warm'],c)
    box(name+' | roof cap',(x,y,z+podium+h+2.5),(tw+1.5,td+1.5,1),M['steel'],c)
    for k in range(3):box(name+' | HVAC',(x+(k-1)*7,y+td*.15,z+podium+h+4.5),(4,7,3),M['concrete'],c)
    if b.get('helipad'):
        box(name+' | helipad',(x,y-td*.15,z+podium+h+3.2),(min(tw*.5,26),min(td*.4,24),.25),M['stone'],c)
        text(name+' helipad H','H',(x,y-td*.15,z+podium+h+3.4),9,M['white'],(0,0,0),c)
    sign=short_names[idx%12] if not sky else name
    text(name+' | identity',sign,(x,y-td/2-.8,z+podium+h*.66),min(5,tw/len(sign)*1.25),accent,c=c)
    # Market roof pitches distinguish the low hall from the tower family.
    if idx in [3,8,11] and not sky:
        for k in range(4):
            yy=y-td*.38+k*td*.25;box(name+' | sawtooth roof',(x,yy,z+podium+h+5),(tw,td*.24,1.2),M['steel'],c,bevel=0).rotation_euler.x=.2
    return {'name':name,'sourceRect':[b['x'],b['y'],b['w'],b['h']],'center':[x,y,z],'height':h,'status':'architectural study; detailed asset pending'}
short_names=['ROPPONGI HILLS','SHIBUYA','AKIHABARA','TSUKIJI','RIDGE OBSERVATORY','YOYOGI','SHINJUKU','ASAKUSA','SHINAGAWA','GINZA','SHIBA','TOYOSU']
placed=[building(b,i) for i,b in enumerate(D['landmarks'])]
for i,b in enumerate(D['skyline']):building(b,i,True)

# Grandstands: tiers rise away from mapped facing direction, with visible supports and canopy.
for n,g in enumerate(D['grandstands']):
    x,y=xy(g['x'],g['y']);a=-g['angle'];w=g['w']*S;depth=g['d']*S;z=28.5 if n==2 else 1.2
    def gp(lx,ly,lz):return(x+lx*math.cos(a)+ly*math.sin(a),y+lx*math.sin(a)-ly*math.cos(a),z+lz)
    for k in range(10):
        dd=depth*(10-k)/10;yy=depth/2-dd/2
        box('Stand %d | riser %02d'%(n,k),gp(0,yy,k*.65+.3),(w,dd,.6),M['concrete'],'05_GRANDSTANDS',a)
        box('Stand %d | continuous seat row'%n,gp(0,-depth/2+depth*k/10+1,k*.65+.8),(w*.96,.7,.35),M['red'] if k%3==0 else M['glass'],'05_GRANDSTANDS',a)
    for lx in [-w*.46,-w*.23,0,w*.23,w*.46]:
        beam('Grandstand canopy support',gp(lx,depth*.4,0),gp(lx,depth*.4,15),.6,M['steel'],'05_GRANDSTANDS')
    box('Cantilever grandstand canopy',gp(0,0,15),(w+3,depth+7,1.0),M['steel'],'05_GRANDSTANDS',a)

# Reused botanical kit; reserve mapped building footprints and racing envelope.
tree_mesh=None
for pk in D['parks']:
    for k in range(125):
        dx=random.uniform(-pk['rx'],pk['rx']);dy=random.uniform(-pk['ry'],pk['ry'])
        if (dx/pk['rx'])**2+(dy/pk['ry'])**2>1:continue
        mx=pk['x']+dx;my=pk['y']+dy;x,y=xy(mx,my);dist,i=near(x,y)
        if dist<HW+12:continue
        if any(b['x']-5<mx<b['x']+b['w']+5 and b['y']-5<my<b['y']+b['h']+5 for b in D['landmarks']):continue
        z=ground(x,y);h=random.uniform(6,11)
        box('Park pine | trunk',(x,y,z+h*.3),(.45,.45,h*.6),M['bark'],'06_PARKS')
        if tree_mesh is None:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1);o=bpy.context.object;move(o,'06_PARKS');tree_mesh=o.data;tree_mesh.materials.append(M['leaf'])
        else:o=bpy.data.objects.new('Shared pine canopy',tree_mesh);C['06_PARKS'].objects.link(o)
        o.location=(x,y,z+h*.7);o.scale=(h*.28,h*.26,h*.47)

# Local streetscape supports and start gantry.
for i in range(0,N,24):
    p=pts[i]+norm[i]*(HW+4);beam('Street lamp column',p,p+Vector((0,0,9)),.18,M['steel']);q=p+Vector((0,0,9))-norm[i]*2.2
    beam('Lamp outreach',p+Vector((0,0,9)),q,.13,M['steel']);box('Lamp diffuser',q,(1,.5,.14),M['warm'])
sf=round(14/34*80);p=pts[sf];theta=math.atan2(norm[sf].y,norm[sf].x)
for side in [-1,1]:q=p+norm[sf]*side*(HW+3);beam('Start gantry upright',q,q+Vector((0,0,8)),.65,M['steel'])
box('Start finish bridge',p+Vector((0,0,8)),(26,1.5,1.8),M['steel'],angle=theta)
for row in range(2):
    for k in range(18):
        q=p+norm[sf]*(-HW+(k+.5))+(pts[sf+1]-pts[sf]).normalized()*row*.8
        box('Start chequer',q+Vector((0,0,.04)),(1,.8,.03),M['white'] if (row+k)%2 else M['steel'],angle=theta)

# Cameras are part of the source: full plan, city overview, driving scale and crossing.
def camera(name,pos,target,lens=42,ortho=None):
    cu=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,cu);C['09_CAMERAS'].objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();cu.lens=lens;cu.clip_end=12000
    if ortho:cu.type='ORTHO';cu.ortho_scale=ortho
    return o
cx,cy=xy(710,470)
overview=camera('01 | city overview',(cx+1400,cy-2050,2200),(cx-30,cy+20,0),43)
top=camera('02 | source parity plan',(cx,cy,2500),(cx,cy,0),ortho=1480*S*1.04)
q=pts[18];driver=camera('03 | bayfront driving',q+norm[18]*2+Vector((0,0,2.1)),pts[42]+Vector((0,0,2)),27)
q=pts[745];cross=camera('04 | viaduct inspection',q+Vector((110,-100,35)),q-Vector((0,0,9)),32)
scene.camera=overview
world=bpy.data.worlds.new('Tokyo blue hour');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.23,.32,.46,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;scene.world=world
bpy.ops.object.light_add(type='SUN',location=(0,0,800));sun=bpy.context.object;sun.name='Late afternoon key';sun.data.energy=2.3;sun.data.angle=.12;sun.rotation_euler=(.45,-.5,-.45)
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.5
scene.render.image_settings.file_format='PNG'
scene['stage']='INITIAL LAYOUT AND ARCHITECTURAL STUDY — NOT FINAL ART'
scene['source']='User-provided HTML; data only. Browser performance comments are not production requirements.'
scene['meters_per_map_unit']=S
scene['road_width_assumption_m']=18
for area in bpy.context.screen.areas if bpy.context.screen else []:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_distance=2200;area.spaces.active.region_3d.view_location=(cx,cy,0);area.spaces.active.clip_end=15000
for im in bpy.data.images:
    if im.source=='FILE':im.pack()

# Actual segment/segment crossings, independent of waypoint labels.
crossings=[]
for i in range(N):
    a,b=pts[i],pts[(i+1)%N];r=b-a
    for j in range(i+15,N):
        if min(j-i,N-(j-i))<15:continue
        c,d=pts[j],pts[(j+1)%N];s=d-c;den=r.x*s.y-r.y*s.x
        if abs(den)<1e-9:continue
        v=c-a;t=(v.x*s.y-v.y*s.x)/den;u=(v.x*r.y-v.y*r.x)/den
        if 0<=t<1 and 0<=u<1:
            za=a.z+t*r.z;zb=c.z+u*s.z
            crossings.append({'segments':[i,j],'position':list(a+t*r),'road_surface_separation_m':abs(za-zb),'approx_clearance_below_girder_m':abs(za-zb)-1.2})
tris=sum(sum(len(p.vertices)-2 for p in m.polygons) for m in bpy.data.meshes)
inst_tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH' and not o.hide_render)
audit={'stage':'study','map_units_to_meters':S,'horizontal_length_m':length*S,'length_3d_m':sum((pts[(i+1)%N]-p).length for i,p in enumerate(pts)),'road_width_m':HW*2,'source_waypoints':len(D['waypoints']),'samples':N,'landmarks':placed,'crossings':crossings,'objects':len(scene.objects),'unique_mesh_triangles':tris,'instanced_triangles_before_modifiers':inst_tris,'shared_meshes':len(bpy.data.meshes),'packed_textures':True,'runtime_exported':False,'checks':{'closed_centerline':True,'finite_vertices':all(math.isfinite(v) for p in pts for v in p),'source_landmark_count':len(placed)==12,'minimum_crossing_clearance_6m':all(c['approx_clearance_below_girder_m']>6 for c in crossings)},'remaining':['Manual form/layout review','Street-level bespoke landmark detailing','Road camber, drainage, racing lines and pit lane design','UV/atlas and measured runtime budget','Collision and drive testing','Vegetation silhouette refinement','Facade opening schedule for detailed buildings']}
(OUT/'study-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf8')
(OUT/'centerline.json').write_text(json.dumps({'units':'meters','points':[list(p) for p in pts],'roadWidth':18,'source_sha256':hashlib.sha256((HERE/'source/tokyo_street_circuit_2d_map.html').read_bytes()).hexdigest()},indent=2),encoding='utf8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'tokyo_study.blend'))
print('TOKYO_STUDY_SAVED',json.dumps({k:audit[k] for k in ['objects','unique_mesh_triangles','instanced_triangles_before_modifiers','crossings']}),flush=True)
if '--render' in sys.argv:
    for name,cam in [('overview',overview),('plan',top),('bayfront',driver),('viaduct',cross)]:
        scene.camera=cam;scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
    scene.camera=overview
print('TOKYO_COMPLETE',flush=True)
