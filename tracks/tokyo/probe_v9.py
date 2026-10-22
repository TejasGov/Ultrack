"""Read-only inspection of V8 used to plan V9 placement."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
H=Path(__file__).resolve().parent;O=H/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_neon_depth_v8.blend'));s=bpy.context.scene
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']];N=len(P)
print('N',N,'engine',s.render.engine,'world',s.world.name if s.world else None)
for c in bpy.data.collections:print('COL',c.name,len(c.objects))
print('CAMS',[o.name for o in bpy.data.objects if o.type=='CAMERA'])
for o in bpy.data.objects:
    if any(k in o.name for k in ['grandstand','Grandstand','start','Start','pit','Pit','Tower','tower','Ferris','bridge','Bridge']) and len(o.name)<60:
        bb=[o.matrix_world@Vector(c) for c in o.bound_box];print('OBJ',o.name,[round(x) for x in sum(bb,Vector())/8],round(max(v.z for v in bb)-min(v.z for v in bb)))
# curvature
def ang(i,k=6):
    a=(P[i]-P[i-k]);b=(P[(i+k)%N]-P[i]);a.z=b.z=0
    return math.degrees(math.atan2(a.x*b.y-a.y*b.x,a.x*b.x+a.y*b.y))
cur=[ang(i) for i in range(N)]
tight=[i for i in range(N) if abs(cur[i])>6]
groups=[];
for i in tight:
    if groups and i-groups[-1][-1]<=8:groups[-1].append(i)
    else:groups.append([i])
print('CORNERS',[(g[0],g[-1],round(sum(cur[j] for j in g)),[round(v) for v in P[g[len(g)//2]]]) for g in groups])
print('P0',[round(v) for v in P[0]],'P1',[round(v) for v in P[10]],'z range',round(min(p.z for p in P)),round(max(p.z for p in P)))
xs=[p.x for p in P];ys=[p.y for p in P];print('bbox',min(xs),max(xs),min(ys),max(ys))
print('mats',[m.name for m in bpy.data.materials if 'oad' in m.name or 'aint' in m.name or 'Concrete' in m.name or 'asphalt' in m.name.lower()])
t=bpy.data.objects['Roppongi topography | valley carved'];bb=[t.matrix_world@Vector(c) for c in t.bound_box];print('terrain',[round(min(v[i] for v in bb)) for i in range(3)],[round(max(v[i] for v in bb)) for i in range(3)])
print('lights',len([o for o in bpy.data.objects if o.type=='LIGHT']),'world strength',s.world.node_tree.nodes['Background'].inputs['Strength'].default_value if s.world and s.world.use_nodes and 'Background' in s.world.node_tree.nodes else None)
print('exposure',s.view_settings.view_transform,s.view_settings.look,s.cycles.device,s.cycles.use_denoising)
print('PROBE_DONE')
