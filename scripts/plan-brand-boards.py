import bpy,json,re
from pathlib import Path
root=Path(r'D:/RaceUltimate');bpy.ops.wm.open_mainfile(filepath=str(root/'tracks/marina/out/marina.blend'))
brands=json.loads((root/'assets/sponsors/manifest.json').read_text())['brands']
sponsor=[b['id'] for b in brands[:7]];cars=[b['id'] for b in brands[7:]]
rows=[]
for m in bpy.data.meshes:
 name=m.name;brand=None;flat=False
 if name.startswith('ad_brand'):brand=cars[int(re.match(r'ad_brand(\d+)',name)[1])]
 elif name.startswith('ad_bridge'):brand=sponsor[0]
 elif name.startswith(('ad_','pole_banner_')):
  hit=re.match(r'(?:ad_(?:fascia_)?|pole_banner_)(\d+)',name)
  if hit and int(hit[1])<7:brand=sponsor[int(hit[1])]
 elif name.startswith('runoff_logo_'):
  brand={'T1':'pirelli','T6':'redbull','T9':'shell'}[name.rsplit('_',1)[1]];flat=True
 if not brand:continue
 dims=re.search(r'_(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$',name)
 if dims:w,h=map(float,dims.groups())
 else:
  xs=[v.co.x for v in m.vertices];ys=[v.co.y for v in m.vertices];w=max(xs)-min(xs);h=max(ys)-min(ys)
 rows.append({'mesh':name,'brand':brand,'w':w,'h':h,'flat':flat,'vertical':name.startswith('pole_banner_'),'emissive':('led' in name)})
(root/'assets/sponsors/board-plan.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print('BOARDS',len(rows))
