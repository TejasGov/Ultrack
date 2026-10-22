import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=Path(__file__).resolve().parent/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_bridge_v5.blend'))
s=bpy.context.scene;name='Continuous road | 18m | source spline';road=bpy.data.objects[name]
def fingerprint(ob):
    h=hashlib.sha256()
    for v in ob.data.vertices:h.update(str(tuple(v.co)).encode())
    for p in ob.data.polygons:h.update(str(tuple(p.vertices)).encode())
    return h.hexdigest()
actual=fingerprint(road)
with bpy.data.libraries.load(str(O/'tokyo_sakura_v4.blend'),link=False) as (src,dst):dst.objects=[name]
reference=dst.objects[0];same=fingerprint(reference)==actual;bpy.data.objects.remove(reference,do_unlink=True)
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']]
deps=bpy.context.evaluated_depsgraph_get();clear=[]
for i in [704,778]:
    tower=bpy.data.objects['Rounded portal tower '+str(i)];ev=tower.evaluated_get(deps);me=ev.to_mesh()
    bv=BVHTree.FromPolygons([tower.matrix_world@v.co for v in me.vertices],[tuple(p.vertices) for p in me.polygons],all_triangles=False)
    t=P[i+1]-P[i-1];t.z=0;t.normalize();n=Vector((-t.y,t.x,0))
    for x in [-9,-6,-3,0,3,6,9]:
        for z in [1.5,4,10,20,35]:
            origin=P[i]+n*x+Vector((0,0,z))-t*10
            clear.append(bv.ray_cast(origin,t,20)[0] is None)
    ev.to_mesh_clear()
checks={'road_geometry_matches_v4':same,'tower_openings_clear_across_18m_road':all(clear),'clearance_rays':len(clear),'packed_textures':all(im.packed_file is not None for im in bpy.data.images if im.source=='FILE' and im.size[0]>0),'runtime_performance_tested':False}
(O/'bridge-v5-verification.json').write_text(json.dumps(checks,indent=2))
assert same and all(clear),checks
print('BRIDGE_GEOMETRY_CHECKS_PASS '+json.dumps(checks),flush=True)
