"""Shajawa Stadium: the career's one stadium circuit (docs/career-worlds.md section 5), built from its concept centreline in one Blender pass.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/shajawa/build_shajawa.py   (`-- --no-export`: the blend only)
Shared pieces (centreline, materials, road, walls, collision, track.json, export): tracks/career_lib.py. Here:
  track     flat (no banking, by design), 15 m, white edge lines, kerbs only in the four infield corners, a white speedway wall 16 m out
  bowl      the CC BY Modular Stadium's straight stand section (source/modular_stadium) bent along a stadium-shaped path round the oval, so the
            ends curve instead of leaving wedges, at 2x (about 25 m); a second tier along both straights. Light towers (CC BY Stadium Light, decimated) on the rim
  infield   grass, a paved paddock with a garage block, a four-sided screen on legs
Day and dusk only (the career's small tracks follow the story): no lights.json; the tower lamps are emissive."""
import bpy
from pathlib import Path
H = Path(r'D:/RaceUltimate/tracks/shajawa'); ID = 'shajawa'; PFX = 'SJ'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))

MAT.update({
    'asphalt': material('SJ | asphalt', tex='asphalt_track', rough=0.72, diff=ROOT / 'tracks' / 'drylake' / 'tex' / 'asphalt_track_bleached_diff_2k.jpg'),
    'line': material('SJ | line white', (0.62, 0.62, 0.6), 0.6),
    'kerb_r': material('SJ | kerb red', (0.55, 0.06, 0.05), 0.6),
    'kerb_w': material('SJ | kerb white', (0.66, 0.66, 0.63), 0.6),
    'barrier': material('SJ | wall', (0.78, 0.78, 0.76), 0.7),
    'grass': material('SJ | grass', tex='leafy_grass', vcol=True),
    'paved': material('SJ | paddock', tex='brushed_concrete', vcol=True),
    'concrete': material('SJ | concrete', tex='concrete_wall_009'),
    'shutter': material('SJ | garage door', tex='painted_metal_shutter'),
    'steel': material('SJ | steel', (0.42, 0.43, 0.45), 0.45, 0.7),
    'screen': material('SJ | screen', (0.02, 0.02, 0.025), 0.25, emit=((0.32, 0.42, 0.6), 2.5)),
})
UVS.update({'asphalt': 3.5, 'grass': 4.0, 'paved': 5.0, 'concrete': 3.0, 'shutter': 3.0})
road(7.5, 60)
barriers(16.0, prof=[(0, 0), (0, 1.15), (0.45, 1.15), (0.45, 0)])
w = lambda i: M @ Vector(SRC['waypoints'][i])      # a concept waypoint in the build frame

# ------------------------------------------------------------------------------------------------ the bowl path: a stadium shape round the oval
cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
hx, hy = (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2
GAP = 30.0; Rb = hy + GAP; Lb = hx - hy; PER = 4 * Lb + 2 * math.pi * Rb
def path(s):
    """point on the stands' front edge and its outward normal, s along it from the main straight's west end, anticlockwise"""
    s %= PER
    if s < 2 * Lb: return Vector((cx - Lb + s, cy - Rb, 0)), Vector((0, -1, 0))
    s -= 2 * Lb
    if s < math.pi * Rb: a = -math.pi / 2 + s / Rb; n = Vector((math.cos(a), math.sin(a), 0)); return Vector((cx + Lb, cy, 0)) + n * Rb, n
    s -= math.pi * Rb
    if s < 2 * Lb: return Vector((cx + Lb - s, cy + Rb, 0)), Vector((0, 1, 0))
    s -= 2 * Lb; a = math.pi / 2 + s / Rb; n = Vector((math.cos(a), math.sin(a), 0)); return Vector((cx - Lb, cy, 0)) + n * Rb, n
clear = min(min((path(PER * q / 400)[0] - p).length for p in CL[::4]) for q in range(400))
log('bowl', round(2 * (Lb + Rb)), 'x', round(2 * Rb), 'm, perimeter', round(PER), 'm, nearest the track', round(clear, 1), 'm')
assert clear > 16.0 + 6, 'the stands stand on the wall'

# ------------------------------------------------------------------------------------------------ the stand section, bent along the path
bpy.ops.import_scene.gltf(filepath=str(H / 'source' / 'modular_stadium' / 'modular_stadium.glb'))
kit = [o for o in bpy.context.selected_objects if o.type == 'MESH']
sec = [o for o in kit if o.name.startswith('STADIUM_Both') and 'Props' not in o.name]     # its light poles read as a picket fence when repeated
pts = [o.matrix_world @ v.co for o in sec for v in o.data.vertices]
lo = Vector([min(p[d] for p in pts) for d in range(3)]); hi = Vector([max(p[d] for p in pts) for d in range(3)]); mid = (lo + hi) / 2
def corr(ax):     # how strongly height follows an axis: the seats rise toward the back
    m = sum(p[ax] for p in pts) / len(pts); mz = sum(p.z for p in pts) / len(pts)
    return sum((p[ax] - m) * (p.z - mz) for p in pts)
cx_, cy_ = corr(0), corr(1); DAX = 0 if abs(cx_) > abs(cy_) else 1; AAX = 1 - DAX
# the glazed boxes and back facade outweigh the seat rake in that correlation, so the sign is flipped: the steps face the kit's +x
# (probe_render.py renders the section from both sides: out/probe_from_plus_x.png shows the steps)
DSG = -1 if (cx_ if DAX == 0 else cy_) > 0 else 1
SW, SD, SH = (hi - lo)[AAX], (hi - lo)[DAX], hi.z - lo.z
KIT_MATS = []
base = bmesh.new()
for o in sec:
    b = bmesh.new(); b.from_mesh(o.data); b.transform(o.matrix_world)
    for f in b.faces:
        m = o.data.materials[f.material_index] if o.data.materials else None
        if m not in KIT_MATS: KIT_MATS.append(m)
        f.material_index = KIT_MATS.index(m)
    for v in b.verts:      # local: along (centred), depth from the front edge (outward), height from the foot
        p = v.co; v.co = Vector((p[AAX] - mid[AAX], (p[DAX] - (lo[DAX] if DSG > 0 else hi[DAX])) * DSG, p.z - lo.z))
    me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free(); base.from_mesh(me); bpy.data.meshes.remove(me)
for m in KIT_MATS:
    if m: m.name = 'SJ | stand ' + m.name.replace('STADIUM_', '').replace('_Mat', '').lower()
for o in kit: bpy.data.objects.remove(o, do_unlink=True)
for o in list(bpy.data.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
SCALE = 2.0; NSEC = round(PER / (SW * SCALE)); SA = PER / (NSEC * SW)      # along: stretched a little so the ring closes
log('stand section', round(SW, 1), 'x', round(SD, 1), 'x', round(SH, 1), 'm (depth axis', 'xy'[DAX], DSG, '), sections', NSEC)
stands = bmesh.new()
def place(s0, dd=0.0, dz=0.0):
    b = base.copy()
    for v in b.verts:
        a, d, z = v.co; p, n = path(s0 + a * SA); v.co = p + n * (d * SCALE + dd) + Vector((0, 0, z * SCALE + dz - 0.2))
    me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free(); stands.from_mesh(me); bpy.data.meshes.remove(me)
for k in range(NSEC):
    s0 = (k + 0.5) * PER / NSEC; place(s0)
    if s0 < 2 * Lb or 2 * Lb + math.pi * Rb < s0 < 4 * Lb + math.pi * Rb: place(s0, SD * SCALE * 0.55, SH * SCALE * 0.95)      # upper tiers along both straights
base.free()
for f in stands.faces: f.smooth = False
me = bpy.data.meshes.new('SJ stands'); stands.to_mesh(me); stands.free()
for m in KIT_MATS: me.materials.append(m)
ob = bpy.data.objects.new('SJ stands', me); VIS.objects.link(ob)
OUTER = SD * SCALE * 1.55      # the stands' depth with the upper tier

# ------------------------------------------------------------------------------------------------ light towers on the rim (decimated: the kit's lamps are 66k triangles)
bpy.ops.import_scene.gltf(filepath=str(H / 'source' / 'stadium_light' / 'stadium_light.glb'))
lt = [o for o in bpy.context.selected_objects if o.type == 'MESH']
for o in lt:
    if len(o.data.polygons) > 2000:
        dm = o.modifiers.new('dec', 'DECIMATE'); dm.ratio = 0.06
bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
tower = bmesh.new(); TMATS = []
for o in lt:
    if o.name.startswith('Plane'): continue        # the kit's ground plane
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); b = bmesh.new(); b.from_mesh(me); b.transform(o.matrix_world)
    for f in b.faces:
        m = o.data.materials[f.material_index] if o.data.materials else None
        if m not in TMATS: TMATS.append(m)
        f.material_index = TMATS.index(m)
    b.to_mesh(me); b.free(); tower.from_mesh(me); bpy.data.meshes.remove(me)
for o in lt: bpy.data.objects.remove(o, do_unlink=True)
for o in list(bpy.data.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
tp = [v.co for v in tower.verts]; tlo = Vector([min(p[d] for p in tp) for d in range(3)]); thi = Vector([max(p[d] for p in tp) for d in range(3)])
pole = Vector(((tlo.x + thi.x) / 2, (tlo.y + thi.y) / 2, 0))
heads = [p for p in tp if p.z > thi.z - (thi.z - tlo.z) * 0.3]; hc = sum(heads, Vector()) / len(heads); face = math.atan2(hc.y - pole.y, hc.x - pole.x)
TS = 40.0 / (thi.z - tlo.z)
towers = bmesh.new()
for k in range(8):
    p, n = path((k + 0.5) * PER / 8); at = p + n * (OUTER + 8)
    yaw = math.atan2(-n.y, -n.x) - face            # the lamps face the track
    Mx = Matrix.Translation((at.x, at.y, -0.2)) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Scale(TS, 4) @ Matrix.Translation((-pole.x, -pole.y, -tlo.z))
    b = tower.copy(); b.transform(Mx); me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free(); towers.from_mesh(me); bpy.data.meshes.remove(me)
tower.free()
for i, m in enumerate(TMATS):       # the brightest kit material is the lamp glass: an emissive lamp (glow.js dims M_Lamp* under the bloom)
    if m and m.node_tree:
        P = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        bc = P.inputs['Base Color'].default_value if P else (0, 0, 0, 1)
        m.name = f'SJ | light tower {i}'
lamp_i = max(range(len(TMATS)), key=lambda i: sum(f.material_index == i for f in towers.faces))     # the many-faced lamp spheres
TMATS[lamp_i] = material('M_LampCool', (0.9, 0.92, 0.95), 0.3, emit=((0.92, 0.95, 1.0), 6.0))
me = bpy.data.meshes.new('SJ light towers'); towers.to_mesh(me); towers.free()
for m in TMATS: me.materials.append(m)
VIS.objects.link(bpy.data.objects.new('SJ light towers', me))

# ------------------------------------------------------------------------------------------------ infield: garages, screen
bm = bmesh.new()
gx, gy = (w(13).x + w(15).x) / 2, (w(14).y + w(1).y) / 2          # between the main straight and the infield straight
box(bm, Vector((gx, gy, 3.6)), (54, 14, 7.6), mi=0)
for q in range(8):
    box(bm, Vector((gx - 23.6 + q * 6.75, gy + 7.05, 2.6)), (5.2, 0.12, 4.6), mi=1)       # doors toward the infield straight
ex, ey = (w(10).x + w(4).x) / 2, (w(1).y + w(7).y) / 2             # the east infield
for a in range(4):
    th = math.pi / 4 + a * math.pi / 2; cyl(bm, Vector((ex + 6 * math.cos(th), ey + 6 * math.sin(th), -0.2)), 0.5, 0.5, 15, n=8, mi=2, cap=False)
box(bm, Vector((ex, ey, 21)), (16, 16, 10), mi=2)
for a in range(4):          # a screen on each face
    th = a * math.pi / 2; box(bm, Vector((ex + 8.06 * math.cos(th), ey + 8.06 * math.sin(th), 21)), (0.1, 15, 9), yaw=th, mi=3)
mesh_obj('SJ infield', bm, ['concrete', 'shutter', 'steel', 'screen'])
SITES = [(gx, gy, 40), (ex, ey, 14)]

# ------------------------------------------------------------------------------------------------ ground: grass inside the bowl, a paved paddock and service ring, a plaza outside
X0, X1, Y0, Y1 = cx - Lb - Rb - 160, cx + Lb + Rb + 160, cy - Rb - 160, cy + Rb + 160
CELL = 6.0; GX, GY = int((X1 - X0) / CELL), int((Y1 - Y0) / CELL)
def inside_bowl(x, y):
    dx = max(0.0, abs(x - cx) - Lb); return math.hypot(dx, y - cy) < Rb
def paved(x, y):
    dx = max(0.0, abs(x - cx) - Lb); r = math.hypot(dx, y - cy)
    return r > Rb - 8 or (abs(x - gx) < 40 and abs(y - gy) < 16)
bm = bmesh.new(); vc = vcol_layer(bm); G = [[None] * (GX + 1) for _ in range(GY + 1)]; D = {}
for r_ in range(GY + 1):
    for c in range(GX + 1):
        x, y = X0 + c * CELL, Y0 + r_ * CELL; i, d = near(x, y); v = bm.verts.new((x, y, -0.12)); G[r_][c] = v; D[v] = d
ground_col = []
for r_ in range(GY):
    for c in range(GX):
        q = [G[r_][c], G[r_][c + 1], G[r_ + 1][c + 1], G[r_ + 1][c]]
        mx_, my_ = sum(v.co.x for v in q) / 4, sum(v.co.y for v in q) / 4
        if min(D[v] for v in q) < 42 and inside_bowl(mx_, my_): ground_col.append([v.co.copy() for v in q])
        if max(D[v] for v in q) < HW - 0.6: continue      # under the road
        f = bm.faces.new(q); f.material_index = 1 if (paved(mx_, my_) or not inside_bowl(mx_, my_)) else 0
        for l in f.loops:
            co = l.vert.co; t = 0.86 + 0.14 * fbm(co.x / 40, co.y / 40, 3)
            l[vc] = (t, t, t, 1) if f.material_index else (t * 0.92, t, t * 0.82, 1)
mesh_obj('SJ ground', bm, ['grass', 'paved'], smooth=True)

collision(ground_col)
write_track('Shajawa Stadium', ['Textures: Poly Haven (CC0); Modular Stadium by davi.pereira.souza.0001 and Stadium Light by thundermind (CC BY 4.0, Sketchfab); see tracks/shajawa/CREDITS.md'],
            ['day', 'dusk'], 'day', [{'name': 'The screen', 'pos': to_game(Vector((ex, ey, 21)))}])
export()
