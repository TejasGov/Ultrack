"""v13.1 tunnel lighting fix: archive the hanging jet-fan cylinders, add flush rectangular ceiling luminaires with matching lights.

    powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/tunnel_fix_v13_1.py      (reads and rewrites out/tokyo_v13_1.blend)

The cylinders (objects 'V13 jet fan N', one linked mesh) are moved to the collection 'V13.1 | _archive' (excluded from render and viewport),
not deleted; art_v13_part2.py still rebuilds them. New: slim flush luminaire strips on the ceiling at 12 m spacing (3 rows) and one
neutral area light per 24 m. The violet lagoon-village wash light, which leaked into the tunnel through the ground, is cut to a quarter.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v12_common as C  # noqa: E402
import v13_kit as K  # noqa: E402

O = C.O
F = O / 'tokyo_v13_1.blend'
bpy.ops.wm.open_mainfile(filepath=str(F))
sc = bpy.context.scene
cl = C.CL()
K.init(sc, cl)
log = json.load(open(O / 'v13-build.json', encoding='utf-8'))
C0, C1 = log['tunnel']['covered_stations']

arch = bpy.data.collections.get('V13.1 | _archive') or K.newcoll('V13.1 | _archive')
arch.hide_render = True
arch.hide_viewport = True
n = 0
for o in list(sc.objects):
    if o.name.startswith('V13 jet fan'):
        for c in list(o.users_collection):
            c.objects.unlink(o)
        arch.objects.link(o)
        o.hide_render = True
        o.hide_viewport = True
        n += 1

TUN = bpy.data.collections['V13 | tunnel dressing']
LUM = K.newcoll('V13.1 | tunnel luminaires')
Z = 6.8
m_lum = K.glow('V13.1 tunnel luminaire', (0.96, 0.98, 1.0), 9.0)
m_housing = K.mat('V13.1 luminaire housing', (0.08, 0.08, 0.09), 0.4, metal=0.6)
bm, bh = bmesh.new(), bmesh.new()
nl = 0
for i in range(C0 + 8, C1 - 6, 6):
    ang = math.atan2(cl.T[i][1], cl.T[i][0])
    for lat in (-5.2, 0.0, 5.2):
        p = cl.at(i, lat, Z - 0.07)
        K.box(bh, (p[0], p[1], p[2]), 2.9, 0.5, 0.06, ang, 0)
        K.box(bm, (p[0], p[1], p[2] - 0.01), 2.6, 0.3, 0.03, ang, 0)
        nl += 1
K.to_obj('V13.1 tunnel luminaire housings', bh, [m_housing], LUM)
K.to_obj('V13.1 tunnel luminaire strips', bm, [m_lum], LUM)
nlight = 0
for i in range(C0 + 10, C1 - 6, 12):
    ob = K.new_light(f'V13.1 tunnel light {i}', 'AREA', Vector(cl.at(i, 0, Z - 0.6)), 3200, (0.92, 0.96, 1.0), size=5.0, coll=LUM)
    ob.rotation_euler = (0, 0, 0)          # area lights face down by default
    nlight += 1
for o in sc.objects:       # violet village wash leaked into the tunnel interior
    if o.name == 'V13 village wash':
        o.data.energy *= 0.25
        o.data.color = (0.85, 0.75, 1.0)
bpy.ops.wm.save_as_mainfile(filepath=str(F))
res = dict(jet_fans_archived=n, luminaire_strips=nl, tunnel_lights=nlight, covered_stations=[C0, C1])
(O / 'v13_1-tunnel-fix.json').write_text(json.dumps(res, indent=1))
print('[tunnel fix]', res)
