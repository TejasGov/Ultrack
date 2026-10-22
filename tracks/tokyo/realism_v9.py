"""V9 realism pass: painted run-off concrete, architectural diversity, cultural landmarks, street life.
Builds additively on out/tokyo_neon_depth_v8.blend and saves out/tokyo_realism_v9.blend.
Usage: blender -b --factory-startup -P realism_v9.py -- [--no-render]
"""
import bpy,math,json,random,ast,sys
import numpy as np
from pathlib import Path
from mathutils import Vector,Matrix
H=Path(__file__).resolve().parent;O=H/'out';ROOT=H.parent.parent;TEX=H/'textures'
RENDER='--no-render' not in sys.argv
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_neon_depth_v8.blend'));s=bpy.context.scene
for node in ast.parse((H/'overhaul_v3.py').read_text(encoding='utf8')).body:
    if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ['col','material','mesh','Batch','area','camera']:
        exec(compile(ast.Module(body=[node],type_ignores=[]),'<helpers>','exec'))
rng=random.Random(909);random.seed(909)
C_PAD=col('V9 | painted concrete run-off');C_EDGE=col('V9 | kerb paint and LED barrier lines');C_ADS=col('V9 | barrier sponsor boards')
C_ARCH=col('V9 | architectural diversity');C_LAND=col('V9 | cultural landmarks');C_STREET=col('V9 | street life and utilities')
SIGNS=col('V9 | Japanese lettering');LIGHT=col('V9 | preview lights')
font=bpy.data.fonts.load('C:/Windows/Fonts/msgothic.ttc')
STATS={'text_objects':0}
# ------------------------------------------------------------------ road data
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P);T=[];normal=[]
for i in range(N):
    t=P[(i+1)%N]-P[i-1];t.z=0;t.normalize();T.append(t);normal.append(Vector((-t.y,t.x,0)))
S=[0.0]
for i in range(1,N):S.append(S[-1]+(P[i]-P[i-1]).xy.length)
LEN=S[-1]+(P[0]-P[-1]).xy.length
def Sx(i):return S[i%N]+LEN*(i//N)
def pos(i,lat=0.0,z=0.0,y=0.0):
    j=i%N;return P[j]+normal[j]*lat+Vector((0,0,z))+T[j]*y
PA=np.array([[p.x,p.y] for p in P])
def road_dist(x,y):return float(np.sqrt(((PA-np.array([x,y]))**2).sum(1)).min())
terrain=bpy.data.objects['Roppongi topography | valley carved']
def ground(x,y):
    hit,co,_,_=terrain.ray_cast(Vector((x,y,600)),Vector((0,0,-1)));return co.z if hit else 0.0
# ------------------------------------------------------------------ occupancy of existing scene
SKIP=('topography','water','Bay','Continuous','Kerb','barrier','sidewalk','Storm','Catch','Fence','distant','Distant','Receding','haze','Mount Fuji','Tokyo Tower','Skytree','Dashed','Start','Staggered','Tokyo start','wash','light','Light','shore')
OB=[];OA=[]
for o in s.objects:
    if o.type!='MESH' or o.hide_render or any(w in o.name for w in SKIP):continue
    bb=[o.matrix_world@Vector(c) for c in o.bound_box];x0=min(v.x for v in bb);x1=max(v.x for v in bb);y0=min(v.y for v in bb);y1=max(v.y for v in bb);hz=max(v.z for v in bb)-min(v.z for v in bb)
    if x1-x0>420 or y1-y0>420 or hz<2.5 or min(x1-x0,y1-y0)<1.2:continue
    r=(x0,y0,x1,y1);OA.append(r)
    if not o.name.startswith(('Sakura','Green canopy','Avenue framing','Lit tenant','Shop fascia')):OB.append(r)
# V8 pagoda and Fuji-avenue pavilion sit in a long merged mesh: reserve them explicitly.
pv=pos(316,-83,0);OA.append((pv.x-24,pv.y-24,pv.x+24,pv.y+24));OB.append(OA[-1])
OAn=np.array(OA);OBn=np.array(OB)
def blocked(arr,x,y,r):
    return bool(np.any((arr[:,0]<x+r)&(arr[:,2]>x-r)&(arr[:,1]<y+r)&(arr[:,3]>y-r)))
def free(x,y,r,margin=3.0):
    return not blocked(OAn,x,y,r+margin)
def reserve(x,y,r):
    global OAn,OBn
    OAn=np.vstack([OAn,[x-r,y-r,x+r,y+r]]);OBn=np.vstack([OBn,[x-r,y-r,x+r,y+r]])
# ------------------------------------------------------------------ materials
def mat(name,color,rough=.6,metal=0,emit=0):return material('V9 '+name,color,rough,metal,emit)
M={k:bpy.data.materials['V3 '+k] for k in ['charcoal','ivory','red','cedar','warm','cyan','rose']}
for k in ['pink','ice','amber','paper','ink']:M[k]=bpy.data.materials['V8 '+k]
M['brass']=bpy.data.materials['V8 aged sign brass'];M['white']=bpy.data.materials['Warm road paint'];M['concrete']=bpy.data.materials['Concrete | mineral']
X={}
for k,(c,r,m,e) in {'plaster':((.80,.77,.68),.85,0,0),'kawara':((.04,.045,.06),.38,.25,0),'timber':((.20,.095,.04),.72,0,0),'timber_lt':((.52,.31,.15),.65,0,0),
 'vermilion':((.62,.03,.01),.35,0,0),'stone':((.26,.255,.24),.93,0,0),'gold':((1,.60,.12),.28,.9,0),'shoji':((1,.78,.42),.6,0,2.6),'indigo':((.012,.03,.15),.8,0,0),
 'glass':((.012,.025,.045),.08,.7,0),'konc':((.30,.30,.29),.92,0,0),'white_led':((.92,.96,1),.4,0,3.4),'gantry':((0,.20,.09),.6,0,.2),'beacon':((1,.02,.02),.4,0,10),
 'lantern_red':((1,.035,.015),.55,0,3.4),'violet':((.50,.10,1),.4,0,4.5),'lime':((.40,1,.18),.4,0,3.2),'yellow':((1,.80,.04),.4,0,5),'kon_green':((.0,.62,.25),.4,0,2.6),
 'kon_orange':((1,.38,.02),.4,0,3),'pastel_a':((.80,.50,.58),.7,0,0),'pastel_b':((.50,.68,.78),.7,0,0),'pastel_c':((.80,.74,.45),.7,0,0),'pastel_d':((.55,.75,.58),.7,0,0),
 'wire':((.01,.01,.012),.5,0,0),'grey':((.28,.30,.31),.5,.4,0),'rope':((.75,.62,.38),.9,0,0),'paper_white':((.95,.95,.92),.9,0,0),'vm_red':((1,.05,.04),.4,0,2.2),
 'vm_blue':((.05,.30,1),.4,0,2.4),'vm_white':((.95,.95,1),.4,0,2.6),'vm_green':((.1,1,.35),.4,0,2.2),'amber_lamp':((1,.52,.12),.4,0,6)}.items():X[k]=mat(k,c,r,m,e)
NEON=[M['pink'],M['ice'],M['amber'],X['violet'],X['lime'],X['yellow']]
facades=[bpy.data.materials[n] for n in ['V3 occupied warm offices','V3 stone tenant windows','V3 apartment windows','V3 reflective office windows']]
# ------------------------------------------------------------------ painted concrete textures (procedural, tileable)
RES=1024
def lin(c):
    c=np.clip(c,0,1);return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
def save_img(name,arr):
    h,w,_=arr.shape;img=bpy.data.images.new(name,w,h,alpha=False);rgba=np.dstack([lin(arr),np.ones((h,w))]).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel());img.filepath_raw=str(TEX/(name+'.png'));img.file_format='PNG';img.save();img.pack();return img
CI=np.array((.06,.10,.44));CP=np.array((1.0,.42,.60));CW=np.array((.96,.94,.90));CT=np.array((.0,.78,.82));CV=np.array((.95,.14,.06));CY=np.array((1.0,.76,.08));CM=np.array((.92,.10,.48));CG=np.array((.20,.72,.30));CVI=np.array((.45,.15,.85))
YY,XX=np.mgrid[0:RES,0:RES];YY=YY.astype(np.float32);XX=XX.astype(np.float32)
def tex_seigaiha(n=4):
    u=XX/RES*n;v=(1-YY/RES)*n;best=np.full((RES,RES),1e9,np.float32);ring=np.zeros((RES,RES),np.float32);k0=np.floor(v/.25).astype(int)
    for dk in range(-3,4):
        k=k0+dk;cy=k*.25;off=(k%2)*.5
        for di in (-1,0,1):
            cx=np.floor(u-off+.5).astype(int)+di+off;d=np.hypot(u-cx,v-cy);hit=(d<.5)&(cy<best);best=np.where(hit,cy,best);ring=np.where(hit,d/.5,ring)
    r5=ring*5;idx=np.minimum(r5.astype(int),4);cols=np.array([CP,CW,CP,CW,CI]);out=cols[idx];edge=(r5-np.floor(r5))<.09;out=np.where(edge[...,None],CI*.7,out);return out
def tex_flow():
    u=XX/RES;v=YY/RES;s_=v*8+.35*np.sin(u*math.tau*2)+.18*np.sin(math.tau*(5*u+v));band=np.floor(s_).astype(int)%8;f=s_-np.floor(s_)
    cols=np.array([CT,CM,CY,CI,CP,CT*.8+.1,CVI,CV]);out=cols[band];sep=(f<.07);return np.where(sep[...,None],CW,out)
def tex_chevron():
    u=XX/RES;v=YY/RES;w=np.abs((v*2)%1-.5)*2;s_=u*6+w*1.5;band=np.floor(s_).astype(int)%2;f=s_-np.floor(s_)
    out=np.where((band==0)[...,None],CV,CW);return np.where((f<.10)[...,None],CI,out)
def tex_ichimatsu():
    i=(XX//(RES/16)).astype(int);j=(YY//(RES/16)).astype(int);par=(i+j)%2;grp=((i//4)+(j//4))%3
    a=np.array([CI,CT,CVI])[grp];b=np.array([CP,CY,CW])[grp];out=np.where((par==0)[...,None],a,b)
    h=((i*73856093)^(j*19349663))%100/100.;out=out*(.9+.1*h[...,None]);gx=(XX%(RES/16))<2;gy=(YY%(RES/16))<2;return np.where((gx|gy)[...,None],out*.55,out)
def tex_sun():
    x=(XX/RES-.5)*2;y=(YY/RES-.5)*2;r=np.hypot(x,y);a=np.arctan2(y,x);wedge=(np.floor((a+math.pi)/math.tau*24).astype(int))%2
    out=np.where((wedge==0)[...,None],CY,CV);out=np.where((r<.34)[...,None],CV,out);out=np.where(((r>=.34)&(r<.39))[...,None],CW,out)
    out=np.where((r>.86)[...,None],CI,out);out=np.where(((r>.82)&(r<=.86))[...,None],CW,out);return out
IMG={'seigaiha':save_img('v9_paint_seigaiha',tex_seigaiha()),'flow':save_img('v9_paint_flow',tex_flow()),'chevron':save_img('v9_paint_chevron',tex_chevron()),
     'ichimatsu':save_img('v9_paint_ichimatsu',tex_ichimatsu()),'sun':save_img('v9_paint_sunburst',tex_sun())}
def paint_material(name,img,emit=.28,rough=.42,bump=.10):
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;p=nt.nodes['Principled BSDF'];im=nt.nodes.new('ShaderNodeTexImage');im.image=img
    if name.endswith('sunburst'):im.extension='CLIP'
    nt.links.new(im.outputs['Color'],p.inputs['Base Color']);nt.links.new(im.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=emit;p.inputs['Roughness'].default_value=rough
    tc=nt.nodes.new('ShaderNodeTexCoord');no=nt.nodes.new('ShaderNodeTexNoise');no.inputs['Scale'].default_value=30;no.inputs['Detail'].default_value=7;nt.links.new(tc.outputs['Object'],no.inputs['Vector'])
    bm=nt.nodes.new('ShaderNodeBump');bm.inputs['Strength'].default_value=bump;bm.inputs['Distance'].default_value=.012;nt.links.new(no.outputs['Fac'],bm.inputs['Height']);nt.links.new(bm.outputs['Normal'],p.inputs['Normal']);return m
PM={k:paint_material('V9 painted concrete | '+k,v) for k,v in IMG.items()}
# ------------------------------------------------------------------ geometry helpers
def mk(name,vs,fs,uvs,m,coll):
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();me.materials.append(m);uv=me.uv_layers.new(name='UVMap')
    for pgn in me.polygons:
        for li in pgn.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
    o=bpy.data.objects.new(name,me);coll.objects.link(o);return o
def ribbon(name,idx,lats,side,m,coll,zf,L=12.0):
    vs=[];uvs=[];fs=[]
    for k,i in enumerate(idx):
        for lat in lats[k]:
            q=pos(i,side*lat);q.z=zf(i,lat,q);vs.append(tuple(q));uvs.append((Sx(i)/L,lat/L))
        if k:
            f=(2*k-2,2*k,2*k+1,2*k-1);fs.append(f if side>0 else tuple(reversed(f)))
    return mk(name,vs,fs,uvs,m,coll)
def smooth(t):
    t=max(0.0,min(1.0,t));return t*t*(3-2*t)
def label(parent,body,loc,size,m,rot=(math.pi/2,0,0),name='JP lettering',coll=None):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.font=font;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.008;cu.materials.append(m)
    o=bpy.data.objects.new(name,cu);(coll or SIGNS).objects.link(o);o.parent=parent;o.location=loc;o.rotation_euler=rot;STATS['text_objects']+=1;return o
def frustum(B,cx,cy,z0,z1,w0,d0,w1,d1,m):
    a,b,c,d=w0/2,d0/2,w1/2,d1/2
    v=[(cx-a,cy-b,z0),(cx+a,cy-b,z0),(cx+a,cy+b,z0),(cx-a,cy+b,z0),(cx-c,cy-d,z1),(cx+c,cy-d,z1),(cx+c,cy+d,z1),(cx-c,cy+d,z1)]
    B.add(v,[(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],m)
def prism_roof(B,cx,cy,zb,w,d,rise,m,gm,over=.6):
    x0,x1=cx-w/2,cx+w/2;fy=cy-d/2-over;by=cy+d/2+over
    v=[(x0,fy,zb),(x1,fy,zb),(x1,cy,zb+rise),(x0,cy,zb+rise),(x0,by,zb),(x1,by,zb)]
    B.add(v,[(0,1,2,3),(3,2,5,4)],m);B.add(v,[(0,3,4),(1,5,2)],gm)
def hip_roof(B,cx,cy,z0,z1,w0,d0,w1,d1,m):
    frustum(B,cx,cy,z0,z1,w0,d0,w1,d1,m)
# ------------------------------------------------------------------ 1. PAINTED CONCRETE RUN-OFF
STATS['corner_pads']=[]
OBn_backup=OBn
def near_building(x,y,r):return blocked(OBn,x,y,r)
def build_pad(name,a,b,side,wmax,mat_,fade=9,L=12.0,border=True,w0=11.7,maxdrop=6.5):
    idx=list(range(a,b+1));ws=[]
    for i in idx:
        w=w0
        for lat in np.arange(14.0,wmax+.01,2.0):
            q=pos(i,side*lat)
            if ground(q.x,q.y)-P[i%N].z<-maxdrop or near_building(q.x,q.y,1.0):break
            w=float(lat)
        ws.append(w)
    ws=[min(ws[max(0,k-3):k+4]) for k in range(len(ws))]
    runs=[];cur=[]
    for k,i in enumerate(idx):
        if ws[k]>=16:cur.append((i,ws[k]))
        else:
            if len(cur)>=6:runs.append(cur)
            cur=[]
    if len(cur)>=6:runs.append(cur)
    made=0;length=0
    zr=lambda i,lat,q:P[i%N].z+.07
    for ri,run in enumerate(runs):
        n=len(run);ids=[r[0] for r in run];lats=[(w0,w0+(run[k][1]-w0)*smooth(min(k,n-1-k)/fade)) for k in range(n)]
        ribbon('%s %d'%(name,ri),ids,lats,side,mat_,C_PAD,zr,L)
        if border:
            ribbon('%s border %d'%(name,ri),ids,[(max(w0,l1-.45),l1) for (_,l1) in lats],side,M['white'],C_PAD,lambda i,lat,q:P[i%N].z+.085,L)
            ribbon('%s kerb line %d'%(name,ri),ids,[(w0,w0+.35) for _ in lats],side,M['white'],C_PAD,lambda i,lat,q:P[i%N].z+.085,L)
        # concrete retaining-wall skirt: the road runs on an embankment, so the painted apron needs real support to the ground
        SB=Batch()
        for k in range(n-1):
            i0,i1=ids[k],ids[k+1];q0=pos(i0,side*lats[k][1]);q1=pos(i1,side*lats[k+1][1])
            t0=Vector((q0.x,q0.y,P[i0%N].z+.07));t1=Vector((q1.x,q1.y,P[i1%N].z+.07));b0=Vector((q0.x,q0.y,min(ground(q0.x,q0.y),P[i0%N].z)-.4));b1=Vector((q1.x,q1.y,min(ground(q1.x,q1.y),P[i1%N].z)-.4))
            v=[t0,t1,b1,b0];SB.quad(v if side>0 else v[::-1],X['konc'])
        SB.finish('%s skirt %d'%(name,ri),C_PAD)
        for k in range(0,n,3):
            wk=lats[k][1];c=pos(ids[k],side*(w0+wk)/2);reserve(c.x,c.y,(wk-w0)/2+2.5)
        made+=n;length+=n*LEN/N
    STATS['corner_pads'].append({'name':name,'indices':[a,b],'side':side,'max_width_m':wmax,'segments_painted':made,'metres_painted':round(length),'runs':len(runs)})
    return made
corners=[(150,188,1,'flow',30),(228,240,-1,'ichimatsu',22),(389,402,1,'chevron',24),(589,650,1,'seigaiha',34),(862,902,1,'chevron',26),(940,970,1,'flow',28),(1198,1210,1,'ichimatsu',24),(1283,1288,1,'seigaiha',20)]
for (g0,g1,sg,pat,wmax) in corners:
    build_pad('V9 run-off %d-%d %s'%(g0,g1,pat),g0-12,g1+12,-sg,wmax,PM[pat],fade=9)
# paddock aprons either side of the start straight (stand begins about 23 m from centreline on the south).
build_pad('V9 paddock apron south',-6,100,-1,20.5,PM['ichimatsu'],fade=12)
build_pad('V9 paddock apron north',-6,100,1,24,PM['seigaiha'],fade=12)
# Sunburst discs painted on open concrete (hinomaru-style), placed only on verified flat clear ground.
def disc(name,cx,cy,r,zbase,mat_):
    n=64;vs=[(cx,cy,zbase)];uvs=[(.5,.5)];fs=[]
    for k in range(n):
        a=k*math.tau/n;vs.append((cx+math.cos(a)*r,cy+math.sin(a)*r,zbase));uvs.append((.5+.5*math.cos(a),.5+.5*math.sin(a)));fs.append((0,k+1,(k+1)%n+1))
    return mk(name,vs,fs,uvs,mat_,C_PAD)
sun_count=0
for (anchor,sd,lat,r) in [(62,1,44,20),(169,-1,58,22),(780,1,40,18),(1000,-1,40,18),(1100,1,42,18)]:
    c=pos(anchor,sd*lat)
    zs=[ground(c.x+dx,c.y+dy) for dx,dy in [(0,0),(r,0),(-r,0),(0,r),(0,-r)]]
    if max(zs)-min(zs)<.7 and free(c.x,c.y,r,2) and road_dist(c.x,c.y)>r+14 and abs(c.x)<520 and abs(c.y)<620:
        disc('V9 sunburst plaza %d'%sun_count,c.x,c.y,r,max(zs)+.09,PM['sun']);reserve(c.x,c.y,r+2);sun_count+=1
STATS['sunburst_discs']=sun_count
# Kerb-side paint band (between kerb and barrier) in sector colours + LED lines + sponsor boards
sector_cols=[('sakura',(1.0,.28,.5)),('ai',(.04,.10,.62)),('shu',(.95,.10,.04)),('asagi',(0,.70,.78)),('kin',(1,.70,.05)),('matcha',(.20,.70,.26))]
BAND=[mat('band '+n,c,.45,0,.35) for n,c in sector_cols]
led_cols=[('pink',(1,.06,.30),3.2),('cyan',(.05,.75,1),3.2),('amber',(1,.45,.06),2.8),('violet',(.55,.15,1),3.2),('lime',(.4,1,.15),2.4),('white',(.9,.95,1),2.4)];LEDM=[mat('LED '+n,c,.4,0,e) for n,c,e in led_cols]
SEC=96
for sd in (-1,1):
    for si in range(0,N,SEC):
        run=list(range(si,min(N,si+SEC+1)));lats=[(10.2,11.1)]*len(run)
        ribbon('V9 painted kerb band %d %d'%(sd,si//SEC),run,lats,sd,BAND[(si//SEC+(sd>0)*2)%6],C_EDGE,lambda i,lat,q:P[i%N].z+.06)
    B=Batch()
    for i in range(N):
        a=pos(i,sd*11.085,0);b=pos(i+1,sd*11.085,0);m_=LEDM[(i//SEC+(sd>0)*3)%6]
        v=[a+Vector((0,0,P[i%N].z+.80)),b+Vector((0,0,P[(i+1)%N].z+.80)),b+Vector((0,0,P[(i+1)%N].z+.95)),a+Vector((0,0,P[i%N].z+.95))]
        B.quad(v if sd>0 else v[::-1],m_)
    B.finish('V9 barrier LED line %d'%sd,C_EDGE)
ads=[('red',(.9,.03,.05),.55,'white_led'),('white',(.9,.92,.95),.75,'ink'),('teal',(0,.52,.55),.55,'white_led'),('indigo',(.04,.07,.55),.5,'white_led'),('yellow',(1,.72,.04),.7,'ink'),('rose',(1,.15,.42),.55,'white_led')]
ADM=[mat('ad '+n,c,.5,0,e) for n,c,e,_ in ads]
brands=['さくら石油','TOKYO ULTIMATE','富士タイヤ','HIRAGANA CIRCUIT','東京モーターズ','NEON BREW','雷神電機','AKARI','桜花保険','日本 JAPAN','ROPPONGI','渋谷']
TEXT_RANGES=[(14,110),(236,320)]
for sd in (-1,1):
    B=Batch()
    for i in range(N):
        a=pos(i,sd*11.082,0);b=pos(i+1,sd*11.082,0);ci=(i//2+(sd>0))%6
        v=[a+Vector((0,0,P[i%N].z+.12)),b+Vector((0,0,P[(i+1)%N].z+.12)),b+Vector((0,0,P[(i+1)%N].z+.72)),a+Vector((0,0,P[i%N].z+.72))]
        B.quad(v if sd>0 else v[::-1],ADM[ci])
    B.finish('V9 barrier sponsor boards %d'%sd,C_ADS)
    for (r0,r1) in TEXT_RANGES:
        for i in range(r0,r1,2):
            f=-normal[i%N]*sd;th=math.atan2(f.x,-f.y);ci=(i//2+(sd>0))%6;p=pos(i+1,sd*11.07,P[(i+1)%N].z+.42-P[(i+1)%N].z)
            body=brands[(i//2*3+(sd>0)*5)%len(brands)];sz=.42 if len(body)<8 else .30
            label(None,body,(p.x,p.y,P[(i+1)%N].z+.42),sz,M['ink'] if ads[ci][3]=='ink' else X['white_led'],(math.pi/2,0,th),'Sponsor board',C_ADS)
# ------------------------------------------------------------------ 2. ARCHITECTURAL DIVERSITY
def b_machiya(B,w,d):
    labs=[];n=max(3,round(w/5.2));bw=w/n;B.box((0,0,-.6),(w+.4,d+.4,1.2),X['stone'])
    for k in range(n):
        x0=-w/2+bw*(k+.5);h1=3.3;h2=2.7+rng.uniform(-.3,.4)
        B.box((x0,0,h1/2),(bw-.08,d,h1),X['timber']);B.box((x0,.5,h1+h2/2),(bw-.35,d-1.0,h2),X['plaster'])
        B.box((x0,-d/2+.12,1.35),(bw*.62,.05,1.9),X['shoji'])
        for q in range(int(bw*.62/.22)+1):B.box((x0-bw*.31+q*.22,-d/2-.02,1.35),(.06,.07,2.0),X['timber_lt'])
        B.box((x0,-d/2+.55,h1+1.35),(bw*.42,.06,.85),X['shoji'])
        for q in range(int(bw*.42/.2)+1):B.box((x0-bw*.21+q*.2,-d/2+.5,h1+1.35),(.045,.05,.95),X['timber'])
        B.add([(x0-bw/2+.02,-d/2-1.0,h1-.1),(x0+bw/2-.02,-d/2-1.0,h1-.1),(x0+bw/2-.02,-d/2+.4,h1+.45),(x0-bw/2+.02,-d/2+.4,h1+.45)],[(0,1,2,3)],X['kawara'])
        prism_roof(B,x0,0,h1+h2,bw+.2,d-.4,1.9,X['kawara'],X['plaster'],.7)
        B.box((x0+bw*.18,-d/2-.08,2.55),(bw*.3,.03,.85),rng.choice([X['indigo'],X['vermilion']]))
        B.tube((x0-bw*.36,-d/2-.45,2.6),(x0-bw*.36,-d/2-.45,3.1),.19,.19,X['lantern_red'],10)
    return labs
def b_pencil(B,w,d):
    labs=[];h=rng.uniform(26,52);fm=rng.choice(facades);B.box((0,0,-.6),(w+.3,d+.3,1.2),X['stone']);B.box((0,0,h/2),(w,d,h),fm)
    B.box((0,0,h+.45),(w+.5,d+.5,.9),M['charcoal'])
    for sx in (-1,1):B.box((sx*w/2,0,h/2),(.28,d+.12,h),X['konc'])
    B.box((0,-d/2-.05,1.9),(w*.88,.1,3.0),X['white_led'])
    for lv in range(1,int(h/4.6)):
        z=lv*4.3+1.1;ox=rng.uniform(-.25,.25)*w;m_=NEON[(lv+int(h))%6];sw=w*rng.uniform(.38,.5)
        B.box((ox,-d/2-.32,z+1.2),(sw,.42,2.3),M['charcoal']);B.box((ox,-d/2-.56,z+1.2),(sw*.9,.04,2.1),m_)
        if lv%3==1 and len(labs)<2:labs.append((rng.choice(['喫茶','ラーメン','カラオケ','居酒屋','スナック','焼肉']),(ox,-d/2-.60,z+1.2),min(sw*.62,.75),M['ink']))
    B.tube((w*.2,d*.2,h+.9),(w*.2,d*.2,h+6),.06,.04,M['charcoal'],6);B.tube((w*.2,d*.2,h+6),(w*.2,d*.2,h+6.4),.12,.12,X['beacon'],8)
    B.tube((-w*.25,d*.2,h+.9),(-w*.25,d*.2,h+3.4),1.0,1.0,X['grey'],12);B.tube((-w*.25,d*.2,h+3.4),(-w*.25,d*.2,h+4.1),.0,1.05,M['charcoal'],12)
    return labs
def b_pachinko(B,w,d):
    labs=[];h=15;B.box((0,0,-.6),(w+.4,d+.4,1.2),X['stone']);B.box((0,0,h/2),(w,d,h),M['charcoal'])
    cols=[mat('stripe '+n,c,.5,0,1.3) for n,c in [('pink',(1,.06,.30)),('yellow',(1,.75,.04)),('ice',(.05,.65,1)),('violet',(.5,.1,1)),('amber',(1,.40,.06))]]
    for k in range(int(w/.9)):B.box((-w/2+.45+k*.9,-d/2-.1,10.2),(.7,.14,8.4),cols[k%5])
    B.box((0,-d/2-.2,h-1.3),(w*.92,.5,2.6),M['charcoal']);B.box((0,-d/2-.48,h-1.3),(w*.86,.05,2.3),M['paper'])
    labs.append(('パチンコ',(-w*.18,-d/2-.55,h-1.3),1.7,M['ink']));labs.append(('SLOT 777',(w*.27,-d/2-.55,h-1.3),1.05,M['ink']))
    B.box((0,-d/2-1.6,3.9),(w*.5,3.4,.35),M['charcoal']);B.box((0,-d/2-1.6,3.7),(w*.46,3.0,.08),X['white_led'])
    B.box((0,-d/2+.05,1.8),(w*.4,.1,3.2),X['white_led'])
    for sx in (-1,1):B.tube((sx*w*.22,-d/2-3.0,0),(sx*w*.22,-d/2-3.0,3.9),.12,.12,M['brass'],8)
    B.box((0,0,h+.4),(w+.6,d+.6,.8),M['charcoal'])
    return labs
def b_danchi(B,w,d):
    labs=[];fl=8;h=fl*3.0;bays=int(w/3.2);bw=w/bays;B.box((0,0,-.6),(w+.4,d+.4,1.2),X['stone']);B.box((0,0,h/2),(w,d,h),X['konc'])
    B.box((0,0,h+.35),(w+.4,d+.4,.7),X['grey'])
    for fi in range(fl):
        z=fi*3.0+1.2
        for bi in range(bays):
            x=-w/2+bw*(bi+.5)
            B.box((x,-d/2-.65,z-.1),(bw*.82,1.3,.12),X['konc'])
            B.box((x,-d/2-1.28,z+.45),(bw*.82,.05,.9),rng.choice([X['pastel_a'],X['pastel_b'],X['pastel_c'],X['pastel_d'],X['paper_white']]))
            B.box((x,-d/2-.02,z+1.0),(bw*.5,.06,1.35),X['shoji'] if rng.random()<.32 else X['glass'])
    for sx in (-1,1):
        B.box((sx*(w/2+1.3),0,h/2+1),(2.6,d*.55,h+2),X['konc'])
        for fi in range(fl):B.box((sx*(w/2+1.3),-d*.275-.05,fi*3.0+2),(.5,.06,1.4),X['white_led'])
    B.tube((-w*.3,0,h+.7),(-w*.3,0,h+3.2),1.4,1.4,X['grey'],12)
    return labs
def b_tower(B,w,d):
    labs=[];h=rng.uniform(58,86);fm=facades[3];B.box((0,0,-.6),(w+8,d+8,1.2),X['stone']);B.box((0,0,4.5),(w+8,d+8,9),M['charcoal']);B.box((0,-d/2-4.1,4.5),(w*.8,.1,6),X['white_led'])
    B.box((0,0,9+(h-9)/2),(w,d,h-9),fm)
    for k in range(int(w/2.4)+1):
        x=-w/2+k*2.4
        for sy in (-1,1):B.box((x,sy*(d/2+.05),9+(h-9)/2),(.22,.14,h-9),M['charcoal'])
    B.box((0,0,h+2.5),(w*.82,d*.82,5),fm);B.box((0,0,h+5.3),(w*.62,d*.62,1.2),M['charcoal'])
    B.box((0,0,h+.2),(w+.5,d+.5,.4),M['ice']);B.box((0,0,h+5.1),(w*.84+.3,d*.84+.3,.35),X['violet'])
    B.tube((0,0,h+5.8),(0,0,h+16),.25,.08,M['charcoal'],8);B.tube((0,0,h+16),(0,0,h+16.6),.35,.35,X['beacon'],8)
    return labs
def b_museum(B,w,d):
    labs=[];h=10;B.box((0,0,-.6),(w+.4,d+.4,1.2),X['stone']);B.box((0,0,.45),(w+2,d+2,.9),X['stone']);B.box((0,0,h/2+.9),(w*.96,d*.9,h),X['glass'])
    B.box((0,-d*.45+.1,5.8),(w*.9,.06,6.2),X['shoji'])
    for k in range(int(w/.22)):B.box((-w/2+.11+k*.22,-d/2-.1,h/2+.9),(.07,.16,h-.2),X['timber_lt'])
    B.box((0,0,h+1.3),(w+3,d+3,.6),X['timber']);B.box((0,0,h+1.65),(w+3.2,d+3.2,.12),M['charcoal'])
    labs.append(('東京芸術館',(0,-d/2-.28,h*.62+.9),1.5,M['pink']))
    return labs
def b_konbini(B,w,d):
    labs=[];h=4.6;B.box((0,0,-.4),(w+.4,d+.4,.8),X['konc']);B.box((0,0,h/2),(w,d,h),X['plaster']);B.box((0,-d/2-.03,1.85),(w*.88,.07,2.7),X['white_led'])
    for z,m_ in [(3.9,X['kon_green']),(3.62,X['paper_white']),(3.34,X['kon_orange'])]:B.box((0,-d/2-.12,z),(w+.15,.14,.26),m_)
    B.box((0,0,h+.25),(w+.4,d+.4,.5),X['grey']);B.tube((w/2+2.2,-d/2-3,0),(w/2+2.2,-d/2-3,6.5),.1,.1,M['charcoal'],6);B.box((w/2+2.2,-d/2-3,6.5),(1.6,.2,1.1),X['kon_green']);B.box((w/2+2.2,-d/2-3.12,6.5),(1.5,.04,1.0),X['white_led'])
    labs.append(('ミニマート',(0,-d/2-.2,4.65),.55,M['ink']))
    return labs
BUILD_LOG={}
def place(kind,count,wr,d,lat,builder,min_sep=110,step=3,rows=1,coll=None):
    n=0;cands=[(i,sd) for i in range(0,N,step) for sd in (-1,1)];rng.shuffle(cands);placed=[]
    for i,sd in cands:
        if n>=count:break
        w=rng.uniform(*wr) if isinstance(wr,tuple) else wr;c=pos(i,sd*(lat+d/2));th=math.atan2(-sd*normal[i].x,sd*normal[i].y)
        if not(-980<c.x<540 and abs(c.y)<630):continue
        if any((c-q).length<min_sep for q in placed):continue
        if road_dist(c.x,c.y)<lat+d/2-3:continue
        R=Matrix.Rotation(th,3,'Z');ok=True;gs=[ground(c.x,c.y)]
        for dx,dy in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]:
            q=c+R@Vector((dx,dy,0));gs.append(ground(q.x,q.y))
            if road_dist(q.x,q.y)<lat-3:ok=False;break
        if not ok or max(gs)-min(gs)>1.6 or abs(gs[0]-P[i].z)>2.0:continue
        if not free(c.x,c.y,.5*math.hypot(w,d)*.9,3):continue
        B=Batch();labs=builder(B,w,d);ob=B.finish('V9 %s %02d'%(kind,n),coll or C_ARCH,24);ob.location=(c.x,c.y,max(gs)-.2);ob.rotation_euler.z=th
        for body,loc,size,m_ in labs:
            label(ob,'\n'.join(body) if kind=='pencil tower' and len(body)>1 else body,loc,size,m_)
        reserve(c.x,c.y,.5*math.hypot(w,d)*.9);placed.append(c);BUILD_LOG.setdefault(kind,[]).append({'index':i,'side':sd,'centre':[round(c.x),round(c.y)],'w':round(w,1),'d':d,'theta':th});n+=1
    STATS.setdefault('buildings',{})[kind]=n
place('glass crown tower',6,(18,22),20,48,b_tower,min_sep=170)
place('danchi apartment block',5,(52,62),12,58,b_danchi,min_sep=150)
place('timber louvre museum',3,(32,38),20,40,b_museum,min_sep=250)
place('machiya townhouse row',8,(20,30),9,24,b_machiya,min_sep=90)
place('pachinko parlour',5,(22,26),16,25,b_pachinko,min_sep=170)
place('konbini',9,(13,15),10,23,b_konbini,min_sep=100)
# pencil buildings placed in adjacent triples so they read as a typical narrow-lot streetscape
pencil_n=0;cands=[(i,sd) for i in range(0,N,3) for sd in (-1,1)];rng.shuffle(cands);pplaced=[]
for i,sd in cands:
    if pencil_n>=14:break
    ws=[rng.uniform(5.2,7.4) for _ in range(3)];tw=sum(ws)+.8;d=9;c=pos(i,sd*(24+d/2));th=math.atan2(-sd*normal[i].x,sd*normal[i].y)
    if not(-980<c.x<540 and abs(c.y)<630) or any((c-q).length<80 for q in pplaced) or road_dist(c.x,c.y)<24+d/2-3:continue
    R=Matrix.Rotation(th,3,'Z');ok=True;gs=[ground(c.x,c.y)]
    for dx,dy in [(-tw/2,-d/2),(tw/2,-d/2),(tw/2,d/2),(-tw/2,d/2)]:
        q=c+R@Vector((dx,dy,0));gs.append(ground(q.x,q.y))
        if road_dist(q.x,q.y)<21:ok=False;break
    if not ok or max(gs)-min(gs)>1.6 or abs(gs[0]-P[i].z)>2.0 or not free(c.x,c.y,tw*.5*.9,3):continue
    x=-tw/2
    for k,w in enumerate(ws):
        x+=w/2;B=Batch();labs=b_pencil(B,w,d);ob=B.finish('V9 pencil tower %02d'%pencil_n,C_ARCH,24);cc=c+R@Vector((x,0,0));ob.location=(cc.x,cc.y,max(gs)-.2);ob.rotation_euler.z=th
        for body,loc,size,m_ in labs:label(ob,'\n'.join(body),loc,size,m_)
        x+=w/2+.4;pencil_n+=1
    reserve(c.x,c.y,tw*.5*.9);pplaced.append(c)
STATS.setdefault('buildings',{})['pencil tower']=pencil_n
# ------------------------------------------------------------------ 3. CULTURAL LANDMARKS
def torii(B,cx,cy,z,w,h,th=0,r=.5,deep=0):
    def at(x,y,zz):return (cx+math.cos(th)*x-math.sin(th)*y,cy+math.sin(th)*x+math.cos(th)*y,zz)
    for sx in (-1,1):
        B.tube(at(sx*w/2,0,z-deep),at(sx*w/2,0,z+h),r*1.12,r*.92,X['vermilion'],14);B.tube(at(sx*w/2,0,z-deep),at(sx*w/2,0,z+h*.07),r*1.22,r*1.22,M['charcoal'],14)
    ln=w+r*3.2;cs,sn=math.cos(th),math.sin(th)
    B.box(at(0,0,z+h*.74),(ln,r*.55,r*.7),X['vermilion'],th);B.box(at(0,0,z+h+r*.15),(w+r*7.2,r*1.15,r*.8),M['charcoal'],th)
    B.box(at(0,0,z+h+r*.62),(w+r*7.8,r*1.25,r*.28),M['charcoal'],th)
    for sx in (-1,1):B.box(at(sx*(w/2+r*3.7),0,z+h+r*.78),(r*1.0,r*1.3,r*.55),M['charcoal'],th)
    B.box(at(0,0,z+h*.87),(r*1.6,r*.5,h*.14),M['brass'],th)
def lantern_toro(B,x,y,z,th=0):
    B.box((x,y,z+.15),(.6,.6,.3),X['stone'],th);B.tube((x,y,z+.3),(x,y,z+1.25),.12,.1,X['stone'],8);B.box((x,y,z+1.5),(.62,.62,.5),X['shoji'],th);B.box((x,y,z+1.86),(1.0,1.0,.22),X['stone'],th);B.box((x,y,z+2.04),(.4,.4,.22),X['stone'],th)
# 3a. Floating bay torii (Itsukushima-style), oriented to face the shoreline
B=Batch();tc=Vector((660,-255,0));view=Vector((555-tc.x,-330-tc.y,0));th=math.atan2(view.y,view.x)+math.pi/2
torii(B,tc.x,tc.y,-.7,17,19,th,.95,deep=3.5)
for sx in (-1,1):
    for sy in (-1,1):
        base=Vector((tc.x,tc.y,0))+Vector((math.cos(th),math.sin(th),0))*(sx*(17/2+1.9))+Vector((-math.sin(th),math.cos(th),0))*(sy*2.4)
        B.tube((base.x,base.y,-4),(base.x,base.y,10),.5,.42,X['vermilion'],12)
B.finish('V9 floating torii in Tokyo Bay',C_LAND);reserve(tc.x,tc.y,24)
for k,sg in enumerate((-1,1)):
    q=Vector((560,-255+sg*60,6));area('Torii wash %d'%k,q+Vector((70,0,10)),tc+Vector((0,0,9)),22000,(1,.30,.08),8)
# 3b. Shinto shrine in the infield: three-torii approach, stone lanterns, haiden hall, cedar grove
shrine=None
for cx,cy in [(-300,-100),(-260,-190),(-330,-40),(0,-300),(200,-300),(-120,-250),(-400,-60)]:
    zs=[ground(cx+dx,cy+dy) for dx,dy in [(0,0),(40,0),(-40,0),(0,60),(0,-30)]]
    if max(zs)-min(zs)<1.0 and free(cx,cy,48,2) and road_dist(cx,cy)>60:shrine=(cx,cy,max(zs));break
if shrine:
    cx,cy,zg=shrine;_,ci=min(((road_dist(cx,cy),0),),key=lambda t:t[0]);nearest=min(range(0,N,4),key=lambda i:(P[i].x-cx)**2+(P[i].y-cy)**2)
    dirv=Vector((P[nearest].x-cx,P[nearest].y-cy,0)).normalized();th=math.atan2(dirv.y,dirv.x)+math.pi/2   # hall behind, approach toward the road
    U=Vector((math.cos(th),math.sin(th),0));F=Vector((-math.sin(th),math.cos(th),0))      # F = approach axis toward the road (local +y)
    def sp(x,y,z=0,_o=(cx,cy,zg),_U=U,_F=F):return Vector(_o)+_U*x+_F*y+Vector((0,0,z))
    B=Batch()
    for k,(y,sc) in enumerate([(14,1.0),(32,.85),(50,.72)]):
        p=sp(0,y);torii(B,p.x,p.y,zg,7*sc,8.5*sc,th,.34*sc)
    for k in range(10):
        y=8+k*5.2
        for sx in (-1,1):p=sp(sx*3.9,y);lantern_toro(B,p.x,p.y,zg,th)
    path=[sp(-1.8,0,.05),sp(1.8,0,.05),sp(1.8,58,.05),sp(-1.8,58,.05)];B.add([tuple(v) for v in path],[(0,1,2,3)],X['stone'])
    # haiden: stone platform, red pillars, plaster rear wall, lit interior, deep tiled roof with gold ridge ornaments
    for dz,(w0,d0,w1,d1) in enumerate([(24,17,22,15)]):
        c0=sp(0,-4);frustum(B,c0.x,c0.y,zg,zg+1.4,w0,d0,w1,d1,X['stone'])
    for sx in range(-3,4):
        for sy in (-1,1):
            p=sp(sx*3.2,-4+sy*5.5);B.tube((p.x,p.y,zg+1.4),(p.x,p.y,zg+6.4),.34,.30,X['vermilion'],12)
    p=sp(0,-9.4,zg+4.0-zg);B.box((p.x,p.y,zg+3.9),(21,.5,5),X['plaster'],th)
    p=sp(0,-8.4);B.box((p.x,p.y,zg+3.9),(19,.1,4),X['shoji'],th)
    p=sp(0,-4);hz=zg+6.4
    B.box((p.x,p.y,hz+.3),(23,17,.6),X['timber'],th)
    # roof built as two layered hips for the characteristic profile
    for (lw,ld,z0,z1,tw_,td_) in [(26,19.5,hz+.6,hz+3.2,20,10.5),(20,10.5,hz+3.2,hz+5.4,3.2,2.2)]:
        frustum(B,p.x,p.y,z0,z1,lw,ld,tw_,td_,X['kawara'])
    for sx in (-1,1):
        q=sp(sx*1.8,-4);B.tube((q.x,q.y,hz+5.3),(q.x,q.y,hz+6.5),.22,.0,X['gold'],6)
    # shimenawa rope, paper streamers (shide) and lamps at the hall front
    q0=sp(-8.5,1.2,0);q1=sp(8.5,1.2,0);prev=None
    for t in range(11):
        tt=t/10;pt_=q0.lerp(q1,tt);pt_.z=zg+5.4-math.sin(tt*math.pi)*.6
        if prev:B.tube(prev,pt_,.14,.14,X['rope'],6)
        if t in (2,4,6,8):B.box((pt_.x,pt_.y,pt_.z-.5),(.18,.03,.7),X['paper_white'],th)
        prev=pt_
    for sx in (-1,1):
        q=sp(sx*8.6,1.4);B.tube((q.x,q.y,zg+3.4),(q.x,q.y,zg+4.1),.32,.32,X['lantern_red'],10)
    B.finish('V9 hillside shrine: torii approach and haiden hall',C_LAND)
    reserve(cx,cy,50)
    # warm lantern light along the approach
    for k,y in enumerate((16,36)):area('Shrine path wash %d'%k,sp(0,y,6),sp(0,y,0),2600,(1,.55,.18),5)
    area('Shrine hall glow',sp(0,12,6),sp(0,-6,3),5200,(1,.60,.22),8)
    green=bpy.data.objects['Sakura master 2'];rr=random.Random(5)
    for k in range(22):
        a=rr.uniform(0,math.tau);rad=rr.uniform(26,46);q=sp(math.cos(a)*rad,math.sin(a)*rad*.9-6)
        if abs(math.cos(a)*rad)<8 and q.y>cy-10:continue
        ob=bpy.data.objects.new('Shrine grove cedar canopy %d'%k,green.data);C_LAND.objects.link(ob);ob.location=(q.x,q.y,ground(q.x,q.y));sc=rr.uniform(1.5,2.4);ob.scale=(sc,sc,sc*1.4);ob.rotation_euler.z=rr.random()*6.28
    STATS['shrine']={'centre':[round(cx),round(cy)],'approach_bearing_deg':round(math.degrees(math.atan2(dirv.y,dirv.x)))}
# 3c. Edo-style castle keep on the infield hill: stone base, five lit tiers, hip roofs, gold shachihoko
castle=None
for cx,cy in [(-100,300),(-60,250),(-140,330),(-30,330),(-180,280)]:
    zs=[ground(cx+dx,cy+dy) for dx,dy in [(0,0),(30,0),(-30,0),(0,26),(0,-26)]]
    if max(zs)-min(zs)<8 and free(cx,cy,48,0) and road_dist(cx,cy)>70:castle=(cx,cy,min(zs));break
if castle:
    cx,cy,zg=castle;B=Batch()
    frustum(B,cx,cy,zg-7,zg+11,64,52,50,40,X['stone'])
    zb=zg+11;B.box((cx,cy-20,zb+1.7),(50,.9,3.4),X['plaster']);B.box((cx,cy+20,zb+1.7),(50,.9,3.4),X['plaster']);B.box((cx-25,cy,zb+1.7),(.9,40,3.4),X['plaster']);B.box((cx+25,cy,zb+1.7),(.9,40,3.4),X['plaster'])
    for sx in (-1,1):B.box((cx+sx*25,cy-20,zb+3.4),(7,7,6.8),X['plaster']);frustum(B,cx+sx*25,cy-20,zb+6.8,zb+9.6,9.5,9.5,2,2,X['kawara'])
    z=zb;lv_w=[(26,20),(22.4,17.4),(18.8,14.6),(15.2,11.8),(11.6,9)];shot=0
    for lv,(w,d) in enumerate(lv_w):
        h=5.4;B.box((cx,cy,z+h/2),(w,d,h),X['plaster']);B.box((cx,cy,z+.35),(w+.3,d+.3,.7),M['charcoal'])
        for k in range(3 if lv<4 else 2):
            xx=cx+(k-1)*w*.28 if lv<4 else cx+(k-.5)*w*.34
            B.box((xx,cy-d/2-.06,z+3.0),(1.6,.1,1.7),X['shoji'])
            B.box((xx,cy+d/2+.06,z+3.0),(1.6,.1,1.7),X['shoji'])
        for sx in (-1,1):B.box((cx+sx*(w/2+.06),cy,z+3.0),(.1,2.6,1.7),X['shoji'])
        z+=h
        if lv<4:
            nw,nd=lv_w[lv+1];frustum(B,cx,cy,z,z+1.9,w+4.4,d+3.4,nw+.2,nd+.2,X['kawara']);B.box((cx,cy,z+.1),(w+4.5,d+3.5,.3),X['plaster']);z+=1.9
            if lv in (1,3):
                gw=w*.28;gh=2.0;gz=z-1.9
                B.add([(cx-gw,cy-d/2-1.9,gz),(cx+gw,cy-d/2-1.9,gz),(cx,cy-d/2-1.9,gz+gh)],[(0,1,2)],X['plaster']);B.add([(cx-gw,cy-d/2-1.9,gz+.0),(cx+gw,cy-d/2-1.9,gz),(cx,cy-d/2-2.1,gz+gh+.2)],[(0,1,2)],X['kawara'])
        else:
            frustum(B,cx,cy,z,z+4.4,w+5.4,d+4.4,w*.5,.9,X['kawara'])
            for sx in (-1,1):
                B.tube((cx+sx*w*.26,cy,z+4.2),(cx+sx*w*.26,cy,z+6.4),.45,.12,X['gold'],8);B.box((cx+sx*w*.26,cy,z+6.5),(.5,.3,.5),X['gold'])
    B.finish('V9 castle keep on infield hill',C_LAND);reserve(cx,cy,52)
    area('Castle keep uplight A',Vector((cx-45,cy-44,zg+16)),Vector((cx,cy,zg+26)),20000,(1,.78,.50),10);area('Castle keep uplight B',Vector((cx+45,cy-44,zg+16)),Vector((cx,cy,zg+26)),20000,(1,.78,.50),10)
    STATS['castle']={'centre':[round(cx),round(cy)],'base_z':round(zg,1),'keep_height_m':round(11+5.4*5+1.9*4+4.4+7,1)}
# ------------------------------------------------------------------ 4. STREET LIFE: vending machines, utility poles with wires
B=Batch();vm=[X['vm_red'],X['vm_blue'],X['vm_white'],X['vm_green'],X['vm_white']];vm_count=0
for i in range(10,N,23):
    for sd in (-1,1):
        c=pos(i,sd*17.4)
        if not free(c.x,c.y,1.6,0) or abs(c.x)>560 or abs(c.y)>650:continue
        if any(a<=i<=b for a,b in [(745,790),(1075,1095)]):continue
        rot=math.atan2(T[i].y,T[i].x);f=-normal[i]*sd
        gz=P[i].z
        for k in range(3):
            q=pos(i,sd*17.4,0,y=(k-1)*.95);B.box((q.x,q.y,gz+.9),(.82,.75,1.8),X['grey'],rot);fp=q+f*.39;B.box((fp.x,fp.y,gz+1.05),(.62,.04,1.15),vm[(i//23+k+(sd>0))%5],rot)
            B.box((q.x,q.y,gz+1.86),(.82,.75,.08),M['charcoal'],rot)
        vm_count+=1
B.finish('V9 vending machine clusters',C_STREET)
B=Batch();pole_n=0;wire_n=0;prev={}
for i in range(244,400,6):
    for sd in (-1,1):
        base=pos(i,sd*28.5);rot=math.atan2(T[i].y,T[i].x);gz=P[i].z
        B.tube((base.x,base.y,min(gz,ground(base.x,base.y))-.3),(base.x,base.y,gz+10.5),.17,.13,X['konc'],8)
        pts=[]
        for zz,wd in [(9.8,2.3),(8.3,1.8)]:
            B.box((base.x,base.y,gz+zz),(.14,wd,.13),M['charcoal'],rot)
            for dy in (-1,0,1):
                q=base+normal[i]*dy*(wd/2-.1);pts.append((q.x,q.y,gz+zz+.12));B.tube((q.x,q.y,gz+zz),(q.x,q.y,gz+zz+.18),.04,.04,X['paper_white'],5)
        if (i//6)%4==0:B.tube((base.x,base.y,gz+7.4),(base.x,base.y,gz+8.3),.3,.3,X['grey'],10)
        if sd in prev:
            for a,b in zip(prev[sd],pts):
                for t in range(6):
                    t0,t1=t/6,(t+1)/6;a0=Vector(a).lerp(Vector(b),t0);a1=Vector(a).lerp(Vector(b),t1);a0.z-=math.sin(t0*math.pi)*.7;a1.z-=math.sin(t1*math.pi)*.7;B.tube(a0,a1,.014,.014,X['wire'],3)
                wire_n+=1
        prev[sd]=pts;pole_n+=1
B.finish('V9 utility poles, transformers and sagging wires',C_STREET)
# ------------------------------------------------------------------ 5. Offshore expressway viaduct (Wangan-style) with green overhead gantries
B=Batch();x=860;y0,y1=-720,720
for y in range(y0,y1,24):
    B.box((x,y+12,6.4),(2.4,4.6,12.8),X['konc']);B.box((x,y+12,13.6),(14,24.4,1.4),X['grey'])
    for sx in (-1,1):B.box((x+sx*6.9,y+12,14.8),(.3,24.4,1.0),X['konc'])
    if (y//24)%2==0:
        B.tube((x-6.5,y+12,14.3),(x-6.5,y+12,19.3),.07,.07,M['charcoal'],6);B.tube((x-6.5,y+12,19.3),(x-4.4,y+12,19.3),.06,.06,M['charcoal'],6);B.box((x-4.4,y+12,19.2),(.5,1.0,.2),X['amber_lamp'])
        B.tube((x+6.5,y+12,14.3),(x+6.5,y+12,19.3),.07,.07,M['charcoal'],6);B.tube((x+6.5,y+12,19.3),(x+4.4,y+12,19.3),.06,.06,M['charcoal'],6);B.box((x+4.4,y+12,19.2),(.5,1.0,.2),X['amber_lamp'])
    if (y//24)%3==0:
        for sx in (-1,1):B.box((x+sx*6.7,y+12,14.9),(.4,.4,.5),X['paper_white'] if (y//24)%6 else X['beacon'])
for gy in (-420,-60,280):
    for sx in (-1,1):B.tube((x+sx*7.4,gy,14.3),(x+sx*7.4,gy,20.5),.18,.18,M['charcoal'],8)
    B.box((x,gy,20.6),(15.4,.4,.3),M['charcoal']);B.box((x,gy,22.2),(10,.35,3),X['gantry']);B.box((x,gy-.2,22.2),(9.7,.03,2.7),X['gantry'])
ex=B.finish('V9 offshore Wangan-style expressway viaduct',C_LAND)
for gy,tx in [(-420,'首都高速 C1'),(-60,'湾岸線  ↑ 横浜'),(280,'羽田 空港')]:label(None,tx,(x,gy-.4,22.2),1.1,X['white_led'],(math.pi/2,0,0),'Expressway sign',C_LAND)
# ------------------------------------------------------------------ 6. lighting accents for painted run-off, cameras, render
pad_lights=0
for (g0,g1,sg,pat,wmax) in corners[:6]:
    m_=(g0+g1)//2;c=pos(m_,-sg*(11.7+wmax)/2,0);zr=P[m_%N].z
    area('Run-off floodlight %d'%m_,Vector((c.x,c.y,zr+14)),Vector((c.x,c.y,zr)),9000,(1,.9,.8),10);pad_lights+=1
def hero_cam(name,kind,idx=0,lat=3,h=2.6,tz=6,lens=28,along=-18):
    e=BUILD_LOG[kind][idx];i=e['index'];sd=e['side'];c=Vector((e['centre'][0],e['centre'][1],0));c.z=ground(c.x,c.y)
    return camera(name,pos(i,sd*lat,h,along),c+Vector((0,0,tz)),lens)
cams=[]
cams.append(camera('V9 | painted paddock and sponsor boards',pos(6,2.5,3.2),pos(66,-3,1.4),22))
m_=169;sg=1;out=-normal[m_]*sg;cams.append(camera('V9 | painted corner run-off overlook',P[m_]+out*92+Vector((0,0,52)),P[m_]-out*12,30))
if 'machiya townhouse row' in BUILD_LOG:cams.append(hero_cam('V9 | machiya timber street','machiya townhouse row',0,4,2.4,4,26,-22))
if 'pachinko parlour' in BUILD_LOG:cams.append(hero_cam('V9 | pachinko neon frontage','pachinko parlour',0,5,2.4,8,26,-28))
if castle:cams.append(camera('V9 | castle keep on hill',Vector((castle[0]+120,castle[1]-170,castle[2]+60)),Vector((castle[0],castle[1],castle[2]+26)),30))
if shrine:
    p0=sp(0,70,2.0);cams.append(camera('V9 | shrine torii approach',p0,sp(0,-8,5.5),24))
cams.append(camera('V9 | floating torii in the bay',Vector((556,-330,4.2)),Vector((660,-255,9)),40))
cams.append(camera('V9 | night aerial of the circuit',(-1250,-1450,1050),(-60,60,0),32))
s.render.resolution_x=1600;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.cycles.samples=48;s.cycles.use_denoising=True
if '--quick' in sys.argv:s.render.resolution_percentage=60;s.cycles.samples=24
s['latest_addition']='V9 realism pass: painted concrete run-off, LED barrier lines, sponsor boards, architectural typologies, shrine/castle/torii landmarks, street life'
for im in bpy.data.images:
    if im.source=='FILE' and not im.packed_file:im.pack()
STATS.update({'vending_machines':vm_count*3,'utility_poles':pole_n,'wire_spans':wire_n,'run_off_floodlights':pad_lights,'cameras':[c.name for c in cams],'road_geometry_changed':False,'runtime_exported':False})
STATS['buildings_total']=sum(STATS['buildings'].values())
(O/'realism-v9.json').write_text(json.dumps(STATS,indent=2,ensure_ascii=False),encoding='utf8')
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_realism_v9.blend'));print('V9_SAVED',json.dumps(STATS,ensure_ascii=False),flush=True)
if RENDER:
    for c in cams:
        s.camera=c;s.render.filepath=str(O/('v9_'+c.name.split('| ')[1].replace(' ','_')+'.png'));bpy.ops.render.render(write_still=True);print('RENDERED',c.name,flush=True)
print('V9_COMPLETE',flush=True)
