"""Run inside Blender against the saved study; checks the generated file itself."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
H=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(H/'out/tokyo_study.blend'))
A=json.loads((H/'out/study-audit.json').read_text())
D=json.loads((H/'source/map.json').read_text())
road=bpy.data.objects['Continuous road | 18m | source spline']
edge_uses={}
for face in road.data.polygons:
    for edge in face.edge_keys:edge_uses[edge]=edge_uses.get(edge,0)+1
deps=bpy.context.evaluated_depsgraph_get();evaluated=road.evaluated_get(deps);me=evaluated.to_mesh()
solid_uses={}
for face in me.polygons:
    for edge in face.edge_keys:solid_uses[edge]=solid_uses.get(edge,0)+1
checks={
 'road_surface_normals_up':all(p.normal.z>.95 for p in road.data.polygons),
 'road_surface_no_nonmanifold_junctions':all(n in [1,2] for n in edge_uses.values()),
 'evaluated_road_slab_closed':all(n==2 for n in solid_uses.values()),
 'length_within_1m_of_5180':abs(A['length_3d_m']-5180)<1,
 'all_12_landmarks_present':all(b['name']+' | authored mass' in bpy.data.objects for b in D['landmarks']),
 'four_grandstand_canopies':len([o for o in bpy.data.objects if o.name.startswith('Cantilever grandstand canopy')])==4,
 'crossing_present':len(A['crossings'])==1,
 'crossing_clearance_above_6m':all(c['approx_clearance_below_girder_m']>6 for c in A['crossings']),
 'four_review_cameras':len([o for o in bpy.data.objects if o.type=='CAMERA'])==4,
 'file_textures_packed':all(im.packed_file for im in bpy.data.images if im.source=='FILE'),
 'collision_separated_and_hidden':bpy.data.objects['COLLISION_ROAD_STUDY'].hide_render,
 'all_review_renders_exist':all((H/'out'/f'{name}.png').exists() for name in ['overview','plan','bayfront','viaduct']),
 'finite_mesh_coordinates':all(math.isfinite(v) for m in bpy.data.meshes for p in m.vertices for v in p.co),
}
evaluated.to_mesh_clear()
report={'checks':checks,'passed':all(checks.values()),'scope':'Initial source geometry study only. Not final-art, structural, collision-driving or runtime approval.'}
(H/'out/verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2),flush=True)
if not report['passed']:raise RuntimeError('Study verification failed')
