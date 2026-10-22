"""Read saved geometry, check road/placement invariants, and produce blue-hour reviews."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector,Matrix
H=Path(__file__).resolve().parent;O=H/'out';ROOT=H.parent.parent
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_sakura_v3.blend'));s=bpy.context.scene
road=bpy.data.objects['Continuous road | 18m | source spline']
center=json.loads((O/'centerline.json').read_text())['points']
checks={
 'closed_road_sample_count':len(road.data.polygons)==len(center),
 'road_normals_up':all(p.normal.z>.95 for p in road.data.polygons),
 'old_blue_box_collection_removed':bpy.data.collections.get('04_LANDMARK_STUDIES') is None,
 'old_stand_collection_removed':bpy.data.collections.get('05_GRANDSTANDS') is None,
 'illustrated_skyline_card_removed':bpy.data.objects.get('Distant Tokyo | baked landmark skyline') is None,
 'four_detailed_grandstands':len(bpy.data.collections['V3 | cedar stadiums'].objects)==4,
 'tree_meshes_shared':len({o.data for o in bpy.data.collections['V3 | sakura and landscape'].objects})==3,
 'japanese_labels_present':sum(o.type=='FONT' and any(ord(c)>255 for c in o.data.body) for o in s.objects)>80,
 'textures_packed':all(im.packed_file for im in bpy.data.images if im.source=='FILE'),
 'finite_geometry':all(math.isfinite(x) for m in bpy.data.meshes for v in m.vertices for x in v.co),
}
bad=[]
bounds=[(-128,-553,320,24,math.pi),(-128,-463,210,19,0),(-305,580,240,21,math.pi),(-820,-250,170,20,-math.pi/2)]
for o in bpy.data.collections['V3 | sakura and landscape'].objects:
    if o.hide_render:continue
    for x,y,w,d,a in bounds:
        p=Matrix.Rotation(-a,4,'Z')@(o.location-Vector((x,y,0)))
        if abs(p.x)<w/2+5 and abs(p.y)<d/2+6:bad.append(o.name)
checks['trees_clear_of_stand_seating']=not bad
(O/'v3-verification.json').write_text(json.dumps({'checks':checks,'passed':all(checks.values()),'scope':'Authoring geometry and placement checks. Does not certify runtime performance or final visual approval.'},indent=2))
if not all(checks.values()):raise RuntimeError(str(checks))
print('V3_GEOMETRY_CHECKS_PASS',flush=True)
# Candidate foliage LODs keep whole bloom/leaf components and all branches.
# These remain hidden authoring assets until racing-camera transition review.
lodcol=bpy.data.collections.new('V3 | foliage LOD candidates - hidden');s.collection.children.link(lodcol)
lodreport=[]
for master in [o for o in bpy.data.collections['V3 | sakura and landscape'].objects if o.hide_render]:
    me=master.data;parent=list(range(len(me.vertices)))
    def root(a):
        while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
        return a
    for edge in me.edges:
        a,b=map(root,edge.vertices)
        if a!=b:parent[b]=a
    groups={}
    for i in range(len(me.vertices)):groups.setdefault(root(i),[]).append(i)
    flower_roots={root(p.vertices[0]) for p in me.polygons if 'petal' in me.materials[p.material_index].name or 'leaf' in me.materials[p.material_index].name}
    flower_order={r:i for i,r in enumerate(sorted(flower_roots))}
    for level,stride,inflate in [(1,3,1.45),(2,9,2.15)]:
        kept={r for r in groups if r not in flower_roots or flower_order[r]%stride==0};verts=[];lookup={}
        for r in kept:
            ids=groups[r];center=sum((me.vertices[i].co for i in ids),Vector())/len(ids)
            for i in ids:
                lookup[i]=len(verts);co=me.vertices[i].co;verts.append(tuple(center+(co-center)*(inflate if r in flower_roots else 1)))
        faces=[];mats=[]
        for p in me.polygons:
            if root(p.vertices[0]) in kept:faces.append(tuple(lookup[i] for i in p.vertices));mats.append(p.material_index)
        nm=bpy.data.meshes.new(master.name+' LOD'+str(level));nm.from_pydata(verts,[],faces);nm.update()
        for mat in me.materials:nm.materials.append(mat)
        for p,k in zip(nm.polygons,mats):p.material_index=k
        ob=bpy.data.objects.new(nm.name,nm);lodcol.objects.link(ob);ob.hide_render=True;ob.hide_set(True)
        lodreport.append({'source':master.name,'candidate':ob.name,'level':level,'triangles':sum(len(p.vertices)-2 for p in nm.polygons),'method':'Whole-cluster thinning; branches preserved; small foliage expansion','status':'Candidate only, screen-space transition checks pending'})
(O/'foliage-lod-candidates.json').write_text(json.dumps(lodreport,indent=2))
# Capture a second lighting condition from the same geometry.
nt=s.world.node_tree;bg=nt.nodes['Background'];env=nt.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(ROOT/'assets/polyhaven/qwantani_dusk_1_puresky/qwantani_dusk_1_puresky_2k.hdr'),check_existing=True)
for l in list(bg.inputs['Color'].links):nt.links.remove(l)
t=nt.nodes.new('ShaderNodeMixRGB');t.blend_type='MULTIPLY';t.inputs[0].default_value=1;t.inputs[2].default_value=(.55,.67,1,1);nt.links.new(env.outputs['Color'],t.inputs[1]);nt.links.new(t.outputs[0],bg.inputs['Color']);bg.inputs['Strength'].default_value=.14
for o in s.objects:
    if o.type=='LIGHT' and o.data.type=='SUN':o.data.energy=.12
s.view_settings.exposure=.3;s.cycles.samples=32
for im in bpy.data.images:
    if im.source=='FILE' and not im.packed_file:im.pack()
s.camera=bpy.data.objects['V3 | race approach'];s['lighting']='Blue hour; sunset comparison renders supplied'
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_sakura_v3.blend'))
for name,cam in [('sakura_bluehour_v3','V3 | race approach'),('commercial_bluehour_v3','V3 | commercial street')]:
    s.camera=bpy.data.objects[cam];s.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True)
print('V3_REVIEW_COMPLETE',flush=True)
