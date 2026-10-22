"""Conservative occlusion audit on static prop meshes, using Blender's BVH.
Only delete a triangle if three inset probes are enclosed in all 14 tested directions.
Open decks, silhouettes and transparent/masked primitives are never assumed hidden.
"""
import sys,json,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
args=sys.argv[sys.argv.index('--')+1:]
meshes=json.load(open(args[0],encoding='utf-8'))
directions=[Vector(v).normalized() for v in [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]+[(x,y,z) for x in (-1,1) for y in (-1,1) for z in (-1,1)]]
out=[]
for mesh in meshes:
 vertices=[Vector(p) for p in mesh['positions']]
 faces=mesh['faces']
 if not faces: out.append([]);continue
 tree=BVHTree.FromPolygons(vertices,faces,all_triangles=True)
 low=Vector(tuple(min(v[a] for v in vertices) for a in range(3)))
 high=Vector(tuple(max(v[a] for v in vertices) for a in range(3)))
 diagonal=(high-low).length
 epsilon=max(1e-8,diagonal*1e-6)
 removed=[]
 for index,face in enumerate(faces):
  a,b,c=[vertices[i] for i in face]
  enclosed=True
  for probe in (a*.8+b*.1+c*.1,a*.1+b*.8+c*.1,a*.1+b*.1+c*.8):
   for direction in directions:
    location,normal,hit,distance=tree.ray_cast(probe+direction*epsilon,direction,diagonal*2)
    if location is None:
     enclosed=False;break
   if not enclosed:break
  if enclosed:removed.append(index)
 # Exterior depth guard: restore any candidate exposed by a 24x24 raster from
 # each of the 14 surrounding viewpoints. This also catches narrow openings.
 removed=set(removed)
 if removed:
  shell=BVHTree.FromPolygons(vertices,[face for i,face in enumerate(faces) if i not in removed],all_triangles=True)
  center=(high+low)*.5
  restore=set()
  for direction in directions:
   right=direction.cross(Vector((0,1,0)))
   if right.length<.1:right=direction.cross(Vector((1,0,0)))
   right.normalize();up=right.cross(direction).normalized()
   for y in range(24):
    for x in range(24):
     origin=center+direction*diagonal*2+right*((x+.5)/24-.5)*diagonal+up*((y+.5)/24-.5)*diagonal
     old=tree.ray_cast(origin,-direction,diagonal*4)
     if old[0] is None or old[2] not in removed:continue
     new=shell.ray_cast(origin,-direction,diagonal*4)
     if new[0] is None or (new[0]-old[0]).length>epsilon*4:restore.add(old[2])
  removed-=restore
 out.append(sorted(removed))
 print(mesh['name'],len(removed),'/',len(faces),'enclosed triangles after exterior depth checks',flush=True)
json.dump(out,open(args[1],'w',encoding='utf-8'))
