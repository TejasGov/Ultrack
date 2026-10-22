"""Orthographic cavity measurements from the actual source mesh, not a concept image."""
import sys
from pathlib import Path
import json
import argparse
import numpy as np
if not hasattr(np,'infty'):np.infty=np.inf
tool_directory=Path.home()/'AppData/Local/Temp/raceultimate-render-tools'
if tool_directory.is_dir():sys.path.insert(0,str(tool_directory))
import pyrender
import trimesh
from PIL import Image,ImageDraw

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--front',action='store_true');parser.add_argument('--car',default='mp1x');parser.add_argument('--side',action='store_true');args=parser.parse_args();part='side' if args.side else ('front' if args.front else 'rear');camera_x=-8 if args.front else 8
p=json.loads((root/f'car-lab/src/vehicle/profiles/{args.car}.json').read_text(encoding='utf-8'))
source=trimesh.load(root/p['body']['file'],force='scene',process=False)
model=source.to_mesh();v=model.vertices.copy();lo,hi=v.min(0),v.max(0)
if p['body'].get('normalizationBounds'):lo,hi=np.array(p['body']['normalizationBounds'])
v-=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2];v*=p['body']['displayLength']/(hi[0]-lo[0]);v[:,1]+=p['body']['lift'];model.vertices=v
scene=pyrender.Scene(bg_color=[.09,.10,.12,1],ambient_light=[.22,.22,.22])
scene.add(pyrender.Mesh.from_trimesh(model,material=pyrender.MetallicRoughnessMaterial(baseColorFactor=[.42,.44,.48,1],roughnessFactor=.65,metallicFactor=0),smooth=True))
def pose(eye,target):
 eye=np.array(eye,float);back=eye-np.array(target);back/=np.linalg.norm(back);right=np.cross([0,1,0],back);right/=np.linalg.norm(right);up=np.cross(back,right);m=np.eye(4);m[:3,:3]=np.column_stack([right,up,back]);m[:3,3]=eye;return m
for pos,intensity in [([5,5,3],3),([5,2,-4],1.5),([5,.5,0],.7)]:scene.add(pyrender.DirectionalLight(color=[1,1,1],intensity=intensity),pose=pose(pos,[0,.5,0]))
W,H=1560,864;xmag,ymag,cy=(2.5,1.385,.65) if args.side else (1.3,.72,.65)
scene.add(pyrender.OrthographicCamera(xmag=xmag,ymag=ymag,znear=.1,zfar=20),pose=pose([0,cy,8] if args.side else [camera_x,cy,0],[0,cy,0]))
renderer=pyrender.OffscreenRenderer(W,H);color,depth=renderer.render(scene);renderer.delete()
out=root/'car-lab/verification';prefix='mclaren' if args.car=='mp1x' else args.car
if args.side:
 image=Image.fromarray(color);draw=ImageDraw.Draw(image)
 for x in np.arange(-2.2,2.21,.2):
  u=(1+x/xmag)*W/2;draw.line([(u,0),(u,H)],fill='#72757a',width=1);draw.text((u+2,20),f'{x:.1f}',fill='white')
 for y in np.arange(0,1.61,.1):
  w=(1-(y-cy)/ymag)*H/2;draw.line([(0,w),(W,w)],fill='#72757a',width=1);draw.text((4,w+2),f'{y:.1f}',fill='white')
 image.save(out/f'{prefix}-side-grid.png');print('Saved side coordinate grid.');sys.exit()
# pyrender 0.1.45 reads depth with a perspective formula even for orthographic
# cameras. Undo that readback and use the linear orthographic distance.
valid=depth>0;distance=np.zeros_like(depth);distance[valid]=20.1-2/depth[valid]
surface_x=np.where(valid,camera_x+distance*(1 if args.front else -1),np.nan)
np.savez_compressed(out/f'{prefix}-{part}-cavity-depth.npz',surfaceX=surface_x,xmag=xmag,ymag=ymag,cy=cy,cameraX=camera_x)
from matplotlib import colormaps
minimum=1.1 if args.front and args.car=='porsche1' else 1.7
rgb=(colormaps['turbo'](np.clip((np.nan_to_num(surface_x*(-1 if args.front else 1),nan=minimum)-minimum)/(2.3-minimum),0,1))[:,:,:3]*255).astype('uint8');rgb[~valid]=[24,27,31]
image=Image.fromarray(rgb);draw=ImageDraw.Draw(image)
def uv(z,y):return ((1+z/xmag*(1 if args.front else -1))*W/2,(1-(y-cy)/ymag)*H/2)
for z in np.arange(-1.1,1.11,.1):
 u,_=uv(z,0);draw.line([(u,0),(u,H)],fill='#72757a',width=1);draw.text((u+2,20),f'{z:.1f}',fill='white')
for y in np.arange(0,1.31,.1):
 _,w=uv(0,y);draw.line([(0,w),(W,w)],fill='#72757a',width=1);draw.text((4,w+2),f'{y:.1f}',fill='white')
image.save(out/f'{prefix}-{part}-cavity-grid.png')
print(f'Saved orthographic {part} depth and coordinate grid. Labels are world metres including body lift.')
