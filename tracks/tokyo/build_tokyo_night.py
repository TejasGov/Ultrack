"""Additive v2 Tokyo art-direction study. Original skyline bake, Japanese signage, local CC0 PBR.
Run Blender -b --factory-startup -P tracks/tokyo/build_tokyo_night.py
Preserves v1 and produces out/tokyo_neon_v2.blend and review images.
"""
import bpy,math,json,random
from pathlib import Path
from mathutils import Vector
H=Path(__file__).resolve().parent;O=H/'out';T=H/'textures';T.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_study.blend'))
main=bpy.context.scene;random.seed(191)
def mat(name,col,emit=0,rough=.6):
    m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*col,1);p.inputs['Emission Strength'].default_value=emit;return m
stone=mat('Tokyo | ceramic charcoal',(.07,.08,.10));ivory=mat('Tokyo | ivory tile',(.57,.56,.49));red=mat('Tokyo | lacquer vermilion',(.5,.012,.025));black=mat('Tokyo | sign backing',(.009,.012,.02))
neons=[mat('Neon | rose',(.9,.035,.15),4),mat('Neon | cyan',(.04,.65,1),3),mat('Neon | amber',(1,.42,.045),3),mat('Neon | warm white',(.9,.82,.62),2.2)]
def coll(name,scene):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
kit=coll('11_TOKYO_ARCHITECTURE_V2',main);signs=coll('12_JAPANESE_SIGNAGE',main);far=coll('13_BAKED_DISTANT_SKYLINE',main)
cache={}
def box(name,loc,dims,m,c,angle=0):
    if m.name not in cache:
        me=bpy.data.meshes.new('Shared cube '+m.name);me.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]);me.materials.append(m);cache[m.name]=me
    o=bpy.data.objects.new(name,cache[m.name]);c.objects.link(o);o.location=loc;o.scale=dims;o.rotation_euler.z=angle;return o
def beam(name,a,b,r,m,c):
    a,b=Vector(a),Vector(b);o=box(name,(a+b)*.5,(r,r,(b-a).length),m,c);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
font=bpy.data.fonts.load('C:/Windows/Fonts/msgothic.ttc')
def label(name,body,loc,size,m,c=signs,rotation=(math.pi/2,0,0)):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.font=font;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.space_line=1.15;cu.extrude=.018;cu.materials.append(m)
    o=bpy.data.objects.new(name,cu);c.objects.link(o);o.location=loc;o.rotation_euler=rotation;return o
def light(name,loc,color,power,size,target):
    ld=bpy.data.lights.new(name,'AREA');ld.energy=power;ld.color=color;ld.shape='DISK';ld.size=size;o=bpy.data.objects.new(name,ld);kit.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def pbr(material,folder,tile):
    base=H.parent.parent/'assets/polyhaven'/folder;nt=material.node_tree;p=nt.nodes['Principled BSDF'];geo=nt.nodes.new('ShaderNodeNewGeometry');scale=nt.nodes.new('ShaderNodeVectorMath');scale.operation='SCALE';scale.inputs[3].default_value=1/tile;nt.links.new(geo.outputs['Position'],scale.inputs[0])
    for kind in ['diff','nor_gl','arm']:
        f=base/f'{folder}_{kind}_1k.jpg'
        if not f.exists():continue
        n=nt.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(str(f),check_existing=True);n.projection='BOX';n.projection_blend=.2;nt.links.new(scale.outputs[0],n.inputs['Vector'])
        if kind=='diff':nt.links.new(n.outputs['Color'],p.inputs['Base Color'])
        else:
            n.image.colorspace_settings.name='Non-Color'
            if kind=='nor_gl':
                nm=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(n.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs[0],p.inputs['Normal'])
            else:
                sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(n.outputs['Color'],sep.inputs[0]);nt.links.new(sep.outputs[1],p.inputs['Roughness'])
pbr(bpy.data.materials['Concrete | mineral'],'brushed_concrete',3)
pbr(bpy.data.materials['Park meadow'],'leafy_grass',12)

# Replace English identities with the source's Japanese district names.
D=json.loads((H/'source/map.json').read_text())
for b in D['landmarks']:
    o=bpy.data.objects.get(b['name']+' | identity')
    if o:o.data.body=b['jp'];o.data.font=font;o.data.size=6

# Detached surface signs are mounted to brackets; exact text is editable and recorded.
phrases=[('電気街','Electric Town'),('ゲーム','Games'),('カラオケ','Karaoke'),('居酒屋','Izakaya'),('ラーメン','Ramen'),('薬局','Pharmacy'),('喫茶店','Cafe'),('寿司','Sushi'),('東京','Tokyo'),('食堂','Restaurant')]
manifest=[]
for idx,b in enumerate(D['landmarks']):
    body=bpy.data.objects[b['name']+' | authored mass'];x,y,z=body.location;w,d,h=body.scale;bottom=z-h/2
    identity=bpy.data.objects.get(b['name']+' | identity')
    if identity:identity.location.z=bottom+h*.95;identity.data.size=min(5,w/(len(identity.data.body)*1.15))
    active=idx in [1,2,6,9]
    # Dense electric and entertainment façades; quieter market / observatory frontage.
    count=5 if active else 2
    for k in range(count):
        xx=x-w*.43+k*w*.86/max(1,count-1);yy=y-d/2-1.5;hh=min(h*.66,34) if active else min(h*.5,15);zz=bottom+hh/2+7
        m=neons[(idx+k)%4];word,meaning=phrases[(idx*2+k)%len(phrases)]
        box(b['name']+' | vertical sign housing',(xx,yy,zz),(4.5,1.1,hh),black,signs)
        for sx in [-1,1]:box('Neon sign border',(xx+sx*2.15,yy-.6,zz),(.12,.12,hh),m,signs)
        for dz in [-hh*.32,hh*.32]:beam('Sign wall standoff',(xx,yy+.5,zz+dz),(xx,y-d/2,zz+dz),.14,stone,signs)
        label('JP | '+word,'\n'.join(word),(xx,yy-.6,zz),min(3.6,hh/(len(word)*1.35)),m)
        manifest.append({'text':word,'meaning':meaning,'district':b['name'],'orientation':'stacked horizontal glyphs; no punctuation requiring vertical typesetting'})
    # Street-scale tenant podium, with deep eaves and separated shop bays.
    fy=y-d/2-5;baycount=6 if active else 4
    for k in range(baycount):
        xx=x-w*.44+(k+.5)*w*.88/baycount;bw=w*.85/baycount
        box('Tenant base | ceramic tiles',(xx,fy,bottom+3),(bw,8,6),ivory if idx%2 else stone,kit)
        box('Deep storefront canopy',(xx,fy-4.6,bottom+6.2),(bw+.5,3.0,.3),red if active else stone,kit)
        box('Tenant entrance glazing study',(xx,fy-4.05,bottom+2.7),(bw*.73,.15,4.3),bpy.data.materials['Blue curtain glazing'],kit)
        word,meaning=phrases[(idx+k+3)%len(phrases)];m=neons[(idx+k)%4]
        box('Shop fascia backing',(xx,fy-4.2,bottom+5.5),(bw*.95,.25,1.15),black,signs)
        label('Tenant fascia | '+word,word,(xx,fy-4.36,bottom+5.5),min(.9,bw/len(word)*.75),m)
        # Visible lantern fixtures under the eave, using shared meshes.
        for side in [-1,1]:
            lx=xx+side*bw*.33;beam('Lantern suspension',(lx,fy-5,bottom+6),(lx,fy-5,bottom+4.8),.06,stone,kit)
            box('Warm lantern',(lx,fy-5,bottom+4.3),(.5,.5,.9),neons[2],kit)
    if active:
        # Broad floor-directory signs mimic multi-tenant Tokyo façades.
        xx=x+w*.20;yy=y-d/2-1;zz=bottom+h*.73
        box('Floor directory backing',(xx,yy,zz),(w*.40,.6,h*.25),black,signs)
        for k in range(4):
            word=phrases[(idx+k)%len(phrases)][0];label('Japanese floor directory',f'{5-k}F  {word}',(xx,yy-.35,zz+h*.085-k*h*.055),min(3,h*.04),neons[(idx+k)%4])
    light('Façade color wash', (x,fy-12,bottom+9),(.25,.55,1) if idx%2==0 else(1,.12,.25),1200 if active else 450,9,(x,fy,bottom+4))

# Bake an original reference-inspired skyline, not downloaded search-result photography.
bake=bpy.data.scenes.new('Tokyo skyline source | offline bake only');bpy.context.window.scene=bake;bc=coll('BAKE_ONLY | skyline source geometry',bake)
bake.world=bpy.data.worlds.new('Skyline bake dark world');bake.world.use_nodes=True;bake.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.10,.19,1);bake.world.node_tree.nodes['Background'].inputs[1].default_value=.35
citym=[mat('Bake city '+str(i),(.025+i*.004,.04+i*.004,.075+i*.006),.3) for i in range(5)]
win=[mat('Bake windows warm',(.8,.49,.22),1.2),mat('Bake windows cool',(.31,.55,.83),.9)]
for i in range(115):
    x=-2500+i*44+random.uniform(-15,15);h=random.uniform(24,180);w=random.uniform(25,63);dep=random.uniform(-25,80)
    box('Bake district tower',(x,dep,h/2),(w,45,h),citym[i%5],bc)
    for f in range(2,int(h/4)):
        for k in range(1,5):
            if random.random()<.53:box('Bake lit window',(x-w/2+k*w/5,dep-22.6,f*4),(w*.09,.2,1.6),win[(i+f)%2],bc)
    if i%7==0:box('Bake rooftop mast',(x,dep,h+8),(.7,.7,16),citym[2],bc)
# Tokyo Tower silhouette: flared four-leg lattice, observation decks, orange/white top.
orange=mat('Tokyo Tower orange',(.95,.22,.025),1.7);white=mat('Landmark white',(.55,.65,.79),1.2)
tx=-970
levels=[(0,48),(70,32),(145,19),(190,12),(250,6),(300,2)]
for (z0,r0),(z1,r1) in zip(levels,levels[1:]):
    for side in [-1,1]:
        beam('Tokyo Tower outer leg',(tx+side*r0,-65,z0),(tx+side*r1,-65,z1),2.0,orange,bc)
    for j in range(5):
        za=z0+(z1-z0)*j/5;zb=z0+(z1-z0)*(j+1)/5;ra=r0+(r1-r0)*j/5;rb=r0+(r1-r0)*(j+1)/5
        beam('Tokyo Tower lattice',(tx-ra,-66,za),(tx+rb,-66,zb),.7,orange,bc);beam('Tokyo Tower lattice',(tx+ra,-66,za),(tx-rb,-66,zb),.7,orange,bc)
box('Tokyo Tower main deck',(tx,-67,150),(45,14,13),white,bc);box('Tokyo Tower upper deck',(tx,-67,250),(16,12,9),white,bc)
beam('Tokyo Tower antenna',(tx,-65,290),(tx,-65,333),1.5,orange,bc)
# Skytree: tapered trunk, two observation silhouettes, long antenna. Approximate study geometry.
sx=1250
for zz,rad in [(0,16),(100,13),(200,10),(300,7),(350,6),(450,4),(500,3)]:
    for side in [-1,1]:beam('Skytree tapered edge',(sx+side*rad,-60,zz),(sx+side*max(2,rad-3),-60,zz+100),1.2,white,bc)
box('Skytree lower observation',(sx,-60,350),(34,15,20),white,bc);box('Skytree upper observation',(sx,-60,450),(22,14,13),white,bc);beam('Skytree antenna',(sx,-60,500),(sx,-60,634),1.3,white,bc)
# Rainbow Bridge-like white paired pylons and suspended main span.
bx=210
for xx in [bx-290,bx+290]:
    for side in [-1,1]:box('Rainbow bridge pylon',(xx+side*13,-90,79),(5,9,158),white,bc)
    for z in [102,148]:box('Rainbow bridge cross member',(xx,-90,z),(31,9,4),white,bc)
box('Rainbow bridge deck',(bx,-90,44),(1100,14,5),white,bc)
last=None
for i in range(101):
    x=bx-550+i*11
    if x<bx-290:z=55+(x-(bx-550))/260*95
    elif x>bx+290:z=150-(x-(bx+290))/260*95
    else:z=60+90*((x-bx)/290)**2
    p=(x,-95,z)
    if last:beam('Suspension main cable',last,p,1.15,white,bc)
    if i%2==0:beam('Suspension hanger',(x,-95,46),p,.45,white,bc)
    last=p
cu=bpy.data.cameras.new('Skyline bake orthographic');cam=bpy.data.objects.new('Skyline bake camera',cu);bc.objects.link(cam);cam.location=(0,-6000,350);cam.rotation_euler=(Vector((0,0,350))-cam.location).to_track_quat('-Z','Y').to_euler();cu.type='ORTHO';cu.ortho_scale=5000;cu.clip_end=10000;bake.camera=cam
bake.render.engine='CYCLES';bake.cycles.samples=8;bake.cycles.use_denoising=True;bake.render.film_transparent=True;bake.render.resolution_x=4096;bake.render.resolution_y=1024;bake.render.resolution_percentage=100;bake.view_settings.view_transform='AgX';bake.render.image_settings.file_format='PNG';bake.render.image_settings.color_mode='RGBA';bake.render.filepath=str(T/'tokyo_skyline_original_bake.png')
print('BAKING_TOKYO_SKYLINE',flush=True);bpy.ops.render.render(write_still=True)
bake_tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bc.objects if o.type=='MESH')
bpy.context.window.scene=main
# Single distant mesh with alpha-cut silhouette. No structural collision / near-camera use.
im=bpy.data.images.load(str(T/'tokyo_skyline_original_bake.png'),check_existing=True)
sm=bpy.data.materials.new('Tokyo far skyline | baked RGBA');sm.use_nodes=True;nt=sm.node_tree;nt.nodes.clear();out=nt.nodes.new('ShaderNodeOutputMaterial');mix=nt.nodes.new('ShaderNodeMixShader');tr=nt.nodes.new('ShaderNodeBsdfTransparent');em=nt.nodes.new('ShaderNodeEmission');tex=nt.nodes.new('ShaderNodeTexImage');tex.image=im;em.inputs['Strength'].default_value=.85;nt.links.new(tex.outputs['Color'],em.inputs['Color']);nt.links.new(tex.outputs['Alpha'],mix.inputs[0]);nt.links.new(tr.outputs[0],mix.inputs[1]);nt.links.new(em.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],out.inputs[0])
me=bpy.data.meshes.new('Far skyline | 2 triangles');me.from_pydata([(2300,-2500,-275),(2300,2500,-275),(2300,2500,975),(2300,-2500,975)],[],[(3,2,1,0)]);me.materials.append(sm);uv=me.uv_layers.new(name='UVMap')
uvs=[(0,0),(1,0),(1,1),(0,1)]
for loop in me.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
o=bpy.data.objects.new('Distant Tokyo | baked landmark skyline',me);far.objects.link(o);o['triangles']=2;o['minimum_track_distance_m']=1000;o['source_scene']='Tokyo skyline source | offline bake only';o['landmarks']='Tokyo Tower; Tokyo Skytree; Rainbow Bridge, arranged for fictional course composition'
bc.hide_render=True

# Night sky from the existing credited Poly Haven library.
world=main.world;nt=world.node_tree;bg=nt.nodes.get('Background');env=nt.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(H.parent.parent/'assets/polyhaven/qwantani_dusk_1_puresky/qwantani_dusk_1_puresky_2k.hdr'),check_existing=True);tint=nt.nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(.28,.40,.8,1);nt.links.new(env.outputs['Color'],tint.inputs[1]);nt.links.new(tint.outputs[0],bg.inputs['Color']);bg.inputs['Strength'].default_value=.1
for o in main.objects:
    if o.type=='LIGHT' and o.data.type=='SUN':o.data.energy=.12
main.view_settings.exposure=.4;main.render.engine='CYCLES';main.cycles.samples=24;main.cycles.use_denoising=True
# Glow is a review compositor effect, deliberately restrained to keep Japanese glyphs legible.
nt=bpy.data.node_groups.new('Tokyo review glow','CompositorNodeTree');nt.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');main.compositing_node_group=nt;rl=nt.nodes.new('CompositorNodeRLayers');rl.scene=main;gl=nt.nodes.new('CompositorNodeGlare');gl.inputs['Type'].default_value='Fog Glow';gl.inputs['Threshold'].default_value=1.5;gl.inputs['Strength'].default_value=.35;co=nt.nodes.new('NodeGroupOutput');nt.links.new(rl.outputs['Image'],gl.inputs['Image']);nt.links.new(gl.outputs['Image'],co.inputs['Image'])
def camera(name,pos,target,lens=35):
    cu=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,cu);main.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();cu.lens=lens;cu.clip_end=15000;return o
b=D['landmarks'][2];body=bpy.data.objects[b['name']+' | authored mass'];x,y,z=body.location;w,d,h=body.scale
akicam=camera('05 | Akihabara Japanese neon',(x-95,y-d/2-170,18),(x,y-d/2,z*.75),32)
baycam=camera('06 | far bay skyline',(500,-1050,22),(2250,100,140),32)
main['stage']='Tokyo v2 | reference-informed architecture and signage study, no runtime export'
main.camera=akicam
for img in bpy.data.images:
    if img.source=='FILE' and not img.packed_file:img.pack()
manifest_data={'stage':'v2-study','signs':manifest,'references':['https://www.gotokyo.org/en/destinations/central-tokyo/akihabara/','https://www.gotokyo.org/en/see-and-do/nightlife/index.html','https://www.gotokyo.org/en/see-and-do/attractions/landmarks/'],'skyline':{'file':'../textures/tokyo_skyline_original_bake.png','method':'Original Blender orthographic render from authored source geometry; not scraped photography','resolution':[4096,1024],'source_scene_triangles':bake_tris,'visible_main_scene_triangles':2,'source_scene_separate':True,'geographic_accuracy':'Fictional arrangement of reference-inspired recognizable landmark silhouettes','parallax_limit':'Distant-only card, needs racing-camera and seam review in runtime'},'polyhaven':['asphalt_track','brushed_concrete','leafy_grass','qwantani_dusk_1_puresky'],'font':{'source':'C:/Windows/Fonts/msgothic.ttc','usage':'Local authoring font; export lettering as approved baked sign atlas before distribution; no font file copied into project'},'runtime_exported':False}
(O/'tokyo-v2-manifest.json').write_text(json.dumps(manifest_data,ensure_ascii=False,indent=2),encoding='utf8')
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_neon_v2.blend'))
print('TOKYO_NEON_V2_SAVED',flush=True)
main.render.resolution_x=1600;main.render.resolution_y=1100
for filename,cam in [('akihabara_neon_v2',akicam),('bay_skyline_v2',baycam),('overview_neon_v2',bpy.data.objects['01 | city overview'])]:
    main.camera=cam;main.render.filepath=str(O/(filename+'.png'));bpy.ops.render.render(write_still=True)
print('TOKYO_NEON_V2_COMPLETE',flush=True)
