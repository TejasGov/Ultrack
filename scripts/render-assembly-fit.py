"""Offline asset render, independent of browser automation.

Usage: python scripts/render-assembly-fit.py --tools <directory containing pyrender>
The exported inspection GLB comes from the same body/part factories as the lab.
Custom engine paint shader, HDR environment and postprocessing are not reproduced.
"""
import argparse
from pathlib import Path
import sys
import numpy as np
if not hasattr(np,'infty'):
    np.infty=np.inf  # pyrender 0.1.45 compatibility with NumPy 2.x

parser=argparse.ArgumentParser()
parser.add_argument('--tools')
args=parser.parse_args()
if args.tools:
    sys.path.insert(0,args.tools)
import pyrender
import trimesh
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'car-lab/verification'
model=trimesh.load(OUTPUT/'mclaren-body-only-assembly-fit.glb',force='scene',process=False)
scene=pyrender.Scene(bg_color=[.06,.075,.09,1],ambient_light=[.30,.30,.33])
for node in model.graph.nodes_geometry:
    transform,geometry=model.graph[node]
    mesh=pyrender.Mesh.from_trimesh(model.geometry[geometry],smooth=True)
    scene.add(mesh,pose=transform)
floor=trimesh.creation.box(extents=[80,.02,80]);floor.apply_translation([0,-.025,0])
scene.add(pyrender.Mesh.from_trimesh(floor,material=pyrender.MetallicRoughnessMaterial(baseColorFactor=[.085,.10,.12,1],roughnessFactor=.65,metallicFactor=.05)))

def look_at(eye,target):
    eye=np.array(eye,dtype=float);target=np.array(target,dtype=float)
    back=eye-target;back/=np.linalg.norm(back)
    up_hint=[0,0,1] if abs(back[1])>.99 else [0,1,0]
    right=np.cross(up_hint,back);right/=np.linalg.norm(right)
    up=np.cross(back,right)
    pose=np.eye(4);pose[:3,:3]=np.column_stack([right,up,back]);pose[:3,3]=eye
    return pose

for color,intensity,position in [([1,.94,.88],3.0,[-3,6,4]),([.7,.82,1],1.8,[3,4,-4]),([1,1,1],1.3,[0,5,0])]:
    scene.add(pyrender.DirectionalLight(color=color,intensity=intensity),pose=look_at(position,[0,.5,0]))
camera=pyrender.PerspectiveCamera(yfov=np.deg2rad(38),aspectRatio=1.5)
camera_node=scene.add(camera,pose=look_at([-4.8,1.8,5.6],[0,.61,0]))
renderer=pyrender.OffscreenRenderer(1200,800)
views={'hero':[-4.8,1.8,5.6],'side':[0,1.25,7.2],'front':[-6.6,1.5,0],'rear':[6.6,1.6,.05]}
for name,eye in views.items():
    scene.set_pose(camera_node,look_at(eye,[0,.61,0]))
    color,depth=renderer.render(scene,flags=pyrender.RenderFlags.SHADOWS_DIRECTIONAL)
    image=Image.fromarray(color);draw=ImageDraw.Draw(image)
    draw.rectangle([0,0,1200,48],fill='#11171d');draw.text((20,16),f'MP1-X / Fresh Meshy body-only shell / {name.upper()}',fill='#e1f665')
    draw.rectangle([0,765,1200,800],fill='#11171d');draw.text((20,777),'OFFLINE FIT INSPECTION - engine paint shader, environment and postprocessing are not reproduced',fill='#b4c1cb')
    image.save(OUTPUT/f'mclaren-body-only-{name}-offline.png')
    print(name, 'rendered',int((depth>0).sum()),'visible pixels',flush=True)
renderer.delete()
