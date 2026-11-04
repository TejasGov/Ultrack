"""Shajawa Stadium: the career's one stadium circuit (docs/career-worlds.md section 5), built from its concept centreline in one Blender pass.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/shajawa/build_shajawa.py   (`-- --no-export`: the blend only)
Shared pieces (centreline, materials, road, walls, collision, track.json, export): tracks/career_lib.py. Here:
  track     3.5 km (docs/career-worlds/shajawa_b.json), flat (no banking, by design), 15 m, white edge lines, kerbs in the four infield corners, paved run-off out to a concrete wall 16 m out;
            the road leaves the bowl through a gate in its north-west stand, runs a desert loop and comes back through a gate in the south-west stand. The bowl stays where it was
  bowl      a raked bowl of 40 seat rows (seats in colour blocks) swept along a stadium-shaped path round the oval, 14 more rows behind
            the main straight, a back wall and roof; a crowd card per row (people generated here, gaps for empty seats); the CC BY
            Modular Stadium's section (source/modular_stadium: boxes over a concourse) along the top of the main straight Light towers (CC BY Stadium Light, decimated) on the rim
  infield   grass, a paved paddock with a garage block, a four-sided screen on legs
  outside   shajawa_venue.py: the gates, the stands' outer wall, the desert, the Gulf sponsors' boards (make_ads.mjs)
Day and dusk only (the career's small tracks follow the story): no lights.json; the tower lamps are emissive."""
import bpy
from pathlib import Path
H = Path(r'D:/RaceUltimate/tracks/shajawa'); ID = 'shajawa'; SRC_ID = 'shajawa_b'; PFX = 'SJ'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))

MAT.update({
    'asphalt': material('SJ | asphalt', tex='asphalt_track', rough=0.72, diff=ROOT / 'tracks' / 'drylake' / 'tex' / 'asphalt_track_bleached_diff_2k.jpg'),
    'line': material('SJ | line white', (0.62, 0.62, 0.6), 0.6),
    'kerb_r': material('SJ | kerb red', (0.55, 0.06, 0.05), 0.6),
    'kerb_w': material('SJ | kerb white', (0.66, 0.66, 0.63), 0.6),
    'barrier': material('SJ | wall', tex='concrete_wall_009'),
    'runoff': material('SJ | run-off', tex='asphalt_pit_lane', vcol=True),
    'sand': material('SJ | sand', tex='aerial_sand', vcol=True, diff=ROOT / 'tracks' / 'drylake' / 'tex' / 'aerial_sand_pale_diff_1k.jpg'),
    'grass': material('SJ | grass', tex='leafy_grass', vcol=True),
    'paved': material('SJ | paddock', tex='brushed_concrete', vcol=True),
    'concrete': material('SJ | concrete', tex='concrete_wall_009'),
    'shutter': material('SJ | garage door', tex='painted_metal_shutter'),
    'steel': material('SJ | steel', (0.42, 0.43, 0.45), 0.45, 0.7),
    'screen': material('SJ | screen', (0.02, 0.02, 0.025), 0.25, emit=((0.32, 0.42, 0.6), 2.5)),
})
UVS.update({'asphalt': 3.5, 'grass': 4.0, 'paved': 5.0, 'concrete': 3.0, 'shutter': 3.0, 'runoff': 5.0, 'sand': 9.0})

# ------------------------------------------------------------------------------------------------ the bowl stays where it was: its numbers are fixed, no longer read off the lap
cx, cy, Lb, Rb = 150.95, 129.8, 297.24, 164.96; PER = 4 * Lb + 2 * math.pi * Rb
NR, TREAD, RISE, H0 = 40, 0.85, 0.42, 1.6        # rows, tread depth, riser height, the front parapet over the service road
NR2 = 14                                         # an upper rake behind the main straight
D1, H1 = NR * TREAD, H0 + NR * RISE              # the top of the ring rake
K0, CLEAR = 11, 5.7                              # in a gate the rows below this one are cut away; the upper rows run on over a soffit this high
D0G, H0G = K0 * TREAD, H0 + K0 * RISE
def ring(x, y): return math.hypot(max(0.0, abs(x - cx) - Lb), y - cy) - Rb       # + outward of the stands' front edge
CUT = [-3.0 < ring(p.x, p.y) < D1 + 1.0 for p in CL]
CUT_NEAR = [any(CUT[(i + k) % N] for k in range(-24, 25)) for i in range(N)]     # 24 stations: how far barriers() smooths, so the walls have closed before the gate
road(7.5, 90)
barriers(lambda i: HW + 2.1 if CUT_NEAR[i] else 16.0, prof=[(0, 0), (0.2, 0.33), (0.225, 0.81), (0.375, 0.81), (0.6, 0)])     # the jersey's section, in fewer faces

# ------------------------------------------------------------------------------------------------ the bowl path: a stadium shape round the oval
def path(s):
    """point on the stands' front edge and its outward normal, s along it from the main straight's west end, anticlockwise"""
    s %= PER
    if s < 2 * Lb: return Vector((cx - Lb + s, cy - Rb, 0)), Vector((0, -1, 0))
    s -= 2 * Lb
    if s < math.pi * Rb: a = -math.pi / 2 + s / Rb; n = Vector((math.cos(a), math.sin(a), 0)); return Vector((cx + Lb, cy, 0)) + n * Rb, n
    s -= math.pi * Rb
    if s < 2 * Lb: return Vector((cx + Lb - s, cy + Rb, 0)), Vector((0, 1, 0))
    s -= 2 * Lb; a = math.pi / 2 + s / Rb; n = Vector((math.cos(a), math.sin(a), 0)); return Vector((cx - Lb, cy, 0)) + n * Rb, n
def s_of(x, y):
    """path()'s inverse: s of the nearest point on the stands' front edge"""
    if abs(x - cx) <= Lb: return x - (cx - Lb) if y < cy else 2 * Lb + math.pi * Rb + (cx + Lb - x)
    if x > cx: return 2 * Lb + (math.atan2(y - cy, x - cx - Lb) + math.pi / 2) * Rb
    return 4 * Lb + math.pi * Rb + ((math.atan2(y - cy, x - cx + Lb) - math.pi / 2) % (2 * math.pi)) * Rb
RUNS = []
for i in range(N):
    if CUT[i] and not CUT[i - 1]: RUNS.append([i, i])
    elif CUT[i]: RUNS[-1][1] = i
GATES = []        # (first, last station under the stand; s0, s1 of the gap in its low rows)
for a, b in RUNS:
    ss_ = [s_of(*off(i, sd * (HW + 3.5)).to_2d()) for i in range(a, b + 1) for sd in (1, -1) if -1.5 < ring(*off(i, sd * (HW + 3.5)).to_2d()) < D0G + 1.5]
    GATES.append((a, b, min(ss_) - 1.5, max(ss_) + 1.5))
assert len(GATES) == 2, GATES
clear = min(abs(ring(p.x, p.y)) for p, c in zip(CL, CUT_NEAR) if not c)
log('bowl', round(2 * (Lb + Rb)), 'x', round(2 * Rb), 'm, perimeter', round(PER), 'm; gates', [(a, b, round(s1 - s0)) for a, b, s0, s1 in GATES], '; road away from the gates, nearest the stands', round(clear, 1), 'm')
assert clear > 16.0 + 6, 'the stands stand on the wall'
def stations(s0, s1, arc=4.0, straight=10.0):
    """s along the path, every 4 m on the curved ends, every 10 m on the straights, where more rows would not change a thing"""
    out = []; brk = [0.0, 2 * Lb, 2 * Lb + math.pi * Rb, 4 * Lb + math.pi * Rb, PER]
    for k in range(4):
        a, b = max(s0, brk[k]), min(s1, brk[k + 1])
        if b <= a: continue
        st_ = straight if k % 2 == 0 else arc; m = max(1, int((b - a) / st_))
        out += [a + (b - a) * q / m for q in range(m)]
    return out + [s1]
def open_ranges(): return [(a, b) for a, b in zip([0.0] + [g[3] for g in GATES_S], [g[2] for g in GATES_S] + [PER])]
GATES_S = sorted(GATES, key=lambda g: g[2])

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
# ---- the rake: concrete seat rows swept round the whole bowl (the kit section has no seating, only stairs, a concourse and boxes)
def rake_profile(rows, d0, h0, z0=-0.2):
    pr = [(d0, z0), (d0, h0)]
    for k in range(rows): d, h = d0 + k * TREAD, h0 + k * RISE; pr += [(d + TREAD, h), (d + TREAD, h + RISE)]
    return pr
SEAT_BLOCKS = [(0.17, 0.2, 0.22), (0.52, 0.47, 0.38), (0.08, 0.24, 0.2), (0.17, 0.2, 0.22), (0.52, 0.47, 0.38), (0.13, 0.15, 0.17)]      # dull plastic seats: a sand, a dark green, two slates
def along(s0, s1, prof):
    """rows of points: the profile (depth outward, height) at stations along the bowl path from s0 to s1"""
    out = []
    for q_ in stations(s0, s1):
        p, nn = path(min(q_, PER - 1e-4)); out.append([p + nn * d + Vector((0, 0, h)) for d, h in prof])
    return out
def sweep(b, vc, prof, s0, s1):
    """treads take seat colours in 40 m blocks, risers and the parapet are concrete"""
    R_ = along(s0, s1, prof); V = [[b.verts.new(p) for p in r] for r in R_]; ss_ = stations(s0, s1)
    for q in range(len(R_) - 1):
        blk = SEAT_BLOCKS[int((ss_[q] + ss_[q + 1]) / 2 / 40) % len(SEAT_BLOCKS)]
        for k in range(len(prof) - 1):
            f = b.faces.new([V[q][k], V[q][k + 1], V[q + 1][k + 1], V[q + 1][k]])
            tread = abs(prof[k + 1][1] - prof[k][1]) < 1e-6 and k > 1
            f.material_index = 0 if tread else 1
            for l in f.loops:
                t = 0.9 + 0.1 * fbm(l.vert.co.x / 7, l.vert.co.y / 7, 2)
                l[vc] = (blk[0] * t, blk[1] * t, blk[2] * t, 1) if tread else (t, t, t, 1)
MAT['seats'] = material('SJ | seats', rough=0.55, vcol=True)
MAT['stand'] = material('SJ | stand concrete', tex='concrete_wall_009', vcol=True); UVS.update({'stand': 3.0, 'seats': 3.0})
rk_ = bmesh.new(); vr_ = vcol_layer(rk_)
for a, b in open_ranges(): sweep(rk_, vr_, rake_profile(NR, 0.0, H0), a, b)
for g in GATES_S: sweep(rk_, vr_, rake_profile(NR - K0, D0G, H0G, CLEAR), g[2], g[3])      # over a gate only the upper rows, their front face its lintel
mesh_obj('SJ rake', rk_, ['seats', 'stand'], planar=True)
up_ = bmesh.new(); vu_ = vcol_layer(up_); sweep(up_, vu_, rake_profile(NR2, D1 + 2.0, H1 + 2.5), 0.0, 2 * Lb); mesh_obj('SJ upper rake', up_, ['seats', 'stand'], planar=True)
D2, H2 = D1 + 2.0 + NR2 * TREAD, H1 + 2.5 + NR2 * RISE
# a back wall and a cantilevered roof round the top of the ring (the main straight's over its upper rake)
bm = bmesh.new()
strip(bm, along(2 * Lb, PER, [(D1, H1), (D1, H1 + 6), (D1 - 14, H1 + 9)]), 0, closed=False)
strip(bm, along(0.0, 2 * Lb, [(D2, H2), (D2, H2 + 6), (D2 - 16, H2 + 9)]), 0, closed=False)
mesh_obj('SJ roof', bm, ['concrete'])
# ---- the crowd: one card of seated people per row (generated here), on every tread facing the track; gaps in the texture are empty seats
import numpy as np
CW, CH, VAR = 2048, 168, 4                         # one variant: 2048 x 168 px = 14 m x 1.15 m; four variants stacked
img = np.zeros((CH * VAR, CW, 4), np.float32); rr = random.Random(5)
SHIRTS = [(0.86, 0.85, 0.82)] * 7 + [(0.08, 0.08, 0.09)] * 3 + [(0.3, 0.32, 0.36), (0.46, 0.2, 0.17), (0.2, 0.28, 0.4), (0.52, 0.46, 0.3), (0.22, 0.34, 0.27), (0.58, 0.56, 0.52)]      # the Gulf: mostly white kanduras and dark abayas
SKINS = [(0.55, 0.36, 0.25), (0.75, 0.55, 0.42), (0.36, 0.22, 0.14), (0.85, 0.67, 0.55), (0.46, 0.3, 0.2)]
yy, xx = np.mgrid[0:CH, 0:CW]; PXM = CW / 14.0
for v in range(VAR):
    band = img[v * CH:(v + 1) * CH]; x = rr.uniform(0, 10)
    while x < CW - 30:
        if rr.random() < 0.82:                     # else an empty seat
            sh, sk = rr.choice(SHIRTS), rr.choice(SKINS); up = rr.random() < 0.05
            px = x + rr.uniform(-4, 4); bw = 0.21 * PXM * rr.uniform(0.9, 1.15); top = (0.62 + (0.18 if up else 0)) * PXM
            body = (np.abs(xx - px) < bw) & (yy < top) & (yy > 0.02 * PXM)
            hr = 0.105 * PXM; hy = top + hr * 0.9; head = (xx - px) ** 2 + (yy - hy) ** 2 < hr * hr
            shade = 0.55 + 0.45 * np.clip(yy[body] / top, 0, 1)
            band[body] = np.stack([sh[0] * shade, sh[1] * shade, sh[2] * shade, np.ones_like(shade)], 1)
            band[head] = (*sk, 1.0)
            if up:                                  # arms up
                for sx in (-1, 1):
                    arm = (np.abs(xx - (px + sx * bw * 1.1)) < 0.04 * PXM) & (yy > top * 0.7) & (yy < top + 0.35 * PXM); band[arm] = (*sk, 1.0)
        x += 0.58 * PXM * rr.uniform(0.95, 1.05)
cimg = bpy.data.images.new('crowd_rows', CW, CH * VAR, alpha=True); cimg.pixels[:] = img.ravel()     # row 0 is the bottom: people stand on it
(H / 'tex').mkdir(exist_ok=True); cimg.filepath_raw = str(H / 'tex' / 'crowd_rows.png'); cimg.file_format = 'PNG'; cimg.save()
cm = bpy.data.materials.new('SJ | crowd')
try: cm.use_nodes = True
except AttributeError: pass
nt = cm.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / 'crowd_rows.png')
nt.links.new(it.outputs['Color'], P.inputs['Base Color']); P.inputs['Roughness'].default_value = 0.9
gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5      # alpha clip: glTF MASK (alpha to coverage, main.js)
nt.links.new(it.outputs['Alpha'], gt.inputs[0]); nt.links.new(gt.outputs[0], P.inputs['Alpha'])
MAT['crowd'] = cm
cb = bmesh.new(); uv = cb.loops.layers.uv.verify()
def crowd_rows(s0, s1, rows, d0, h0):
    for k in range(rows):
        d, h = d0 + k * TREAD + 0.3, h0 + k * RISE; var = (k * 3 + int(s0)) % VAR
        rows_ = along(s0, s1, [(d, h), (d, h + 1.15)]); m = len(rows_) - 1; ss_ = stations(s0, s1)
        vs = [(cb.verts.new(r[0]), cb.verts.new(r[1])) for r in rows_]
        for q in range(m):
            f = cb.faces.new([vs[q][0], vs[q + 1][0], vs[q + 1][1], vs[q][1]]); f.material_index = 0
            u0, u1 = ss_[q] / 14.0 + k * 0.37, ss_[q + 1] / 14.0 + k * 0.37
            for l, (u, vv) in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))): l[uv].uv = (u, (var + vv) / VAR)
for a, b in open_ranges(): crowd_rows(a, b, NR, 0.0, H0)
for g in GATES_S: crowd_rows(g[2], g[3], NR - K0, D0G, H0G)
crowd_rows(0.0, 2 * Lb, NR2, D1 + 2.0, H1 + 2.5)
mesh_obj('SJ crowd', cb, ['crowd'], planar=False)
# the kit's hospitality boxes along the top of the main straight's upper rake (its section is boxes over a concourse)
SCALE = 1.0; NSEC = max(1, round(2 * Lb / SW)); SA = 2 * Lb / (NSEC * SW)
stands = bmesh.new()
def place(s0, dd=0.0, dz=0.0):
    b = base.copy()
    for v in b.verts:
        a, d, z = v.co; p, n = path(s0 + a * SA); v.co = p + n * (d * SCALE + dd) + Vector((0, 0, z * SCALE + dz - 0.2))
    me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free(); stands.from_mesh(me); bpy.data.meshes.remove(me)
for k in range(NSEC): place((k + 0.5) * 2 * Lb / NSEC, D2 - 6.0, H2 - 2.0)
base.free()
me = bpy.data.meshes.new('SJ boxes'); stands.to_mesh(me); stands.free()
for m in KIT_MATS: me.materials.append(m)
VIS.objects.link(bpy.data.objects.new('SJ boxes', me))
OUTER = D1 + 4.0      # the ring rake's back wall

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
    s_ = (k + 0.5) * PER / 8; p, n = path(s_); at = p + n * (OUTER + 8)
    while near(at.x, at.y)[1] < 30: s_ += 12; p, n = path(s_ % PER); at = p + n * (OUTER + 8)      # never on the road outside the gates
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
gx, gy = 60.5, 64.5          # between the main straight and the infield straight
box(bm, Vector((gx, gy, 3.6)), (54, 14, 7.6), mi=0)
for q in range(8):
    box(bm, Vector((gx - 23.6 + q * 6.75, gy + 7.05, 2.6)), (5.2, 0.12, 4.6), mi=1)       # doors toward the infield straight
ex, ey = 374.5, 130.6        # the east infield
for a in range(4):
    th = math.pi / 4 + a * math.pi / 2; cyl(bm, Vector((ex + 6 * math.cos(th), ey + 6 * math.sin(th), -0.2)), 0.5, 0.5, 15, n=8, mi=2, cap=False)
box(bm, Vector((ex, ey, 21)), (15.4, 15.4, 9.6), mi=2)       # shajawa_venue.py hangs a screen on each face
mesh_obj('SJ infield', bm, ['concrete', 'shutter', 'steel'])
SITES = [(gx, gy, 40), (ex, ey, 14)]

# ------------------------------------------------------------------------------------------------ ground: grass and a service road inside the bowl (6 m cells), the desert outside it
X0, X1, Y0, Y1 = cx - Lb - Rb - 6, cx + Lb + Rb + 6, cy - Rb - 6, cy + Rb + 6
CELL = 6.0; GX, GY = int((X1 - X0) / CELL), int((Y1 - Y0) / CELL)
def paved(x, y): return ring(x, y) > -8 or (abs(x - gx - 34) < 80 and abs(y - gy) < 22)
bm = bmesh.new(); vc = vcol_layer(bm); G = [[None] * (GX + 1) for _ in range(GY + 1)]; D = {}
for r_ in range(GY + 1):
    for c in range(GX + 1):
        x, y = X0 + c * CELL, Y0 + r_ * CELL; i, d = near(x, y); v = bm.verts.new((x, y, -0.12)); G[r_][c] = v; D[v] = d
ground_col = []
for r_ in range(GY):
    for c in range(GX):
        q = [G[r_][c], G[r_][c + 1], G[r_ + 1][c + 1], G[r_ + 1][c]]
        mx_, my_ = sum(v.co.x for v in q) / 4, sum(v.co.y for v in q) / 4
        if ring(mx_, my_) > 3: continue
        if min(D[v] for v in q) < 42: ground_col.append([v.co.copy() for v in q])
        if max(D[v] for v in q) < HW - 0.6: continue      # under the road
        f = bm.faces.new(q); f.material_index = 1 if paved(mx_, my_) else 0
        mown = 0.95 if int(mx_ // 18) % 2 else 1.03       # the stripes a mower leaves
        for l in f.loops:
            co = l.vert.co; t = 0.86 + 0.14 * fbm(co.x / 40, co.y / 40, 3)
            l[vc] = (t, t, t, 1) if f.material_index else (t * mown * 0.8, t * mown * 0.86, t * mown * 0.62, 1)
mesh_obj('SJ ground', bm, ['grass', 'paved'], smooth=True)
# the desert: 20 m cells over the site, wider and wider out to the far plane; dead flat beside the road and the stands, then low dunes, then long ridges
def ss(a, b, x): t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def dune_z(x, y, d):
    r = ring(x, y) - D1; away = ss(30, 130, d) * ss(14, 90, r)
    far = ss(900, 4200, max(abs(x - cx), abs(y - cy)))
    return -0.12 + away * (2.6 * max(0.0, fbm(x / 240 + 3, y / 170, 3) + 0.25) + 0.7 * fbm(x / 60, y / 60, 2) + 0.7) + far * 34 * max(0.0, fbm(x / 1600 + 9, y / 1100, 3) + 0.2)
xs_ = cx - 1500.0; XS = [xs_ + q * 20.0 for q in range(int(2100 / 20))]; YS = [cy - 640.0 + q * 20.0 for q in range(int(1320 / 20))]
XS = [XS[0] - w_ for w_ in (6500, 3600, 2000, 1100, 600, 300, 120)] + XS + [XS[-1] + w_ for w_ in (120, 300, 600, 1100, 2000, 3600, 6500)]
YS = [YS[0] - w_ for w_ in (6500, 3600, 2000, 1100, 600, 300, 120)] + YS + [YS[-1] + w_ for w_ in (120, 300, 600, 1100, 2000, 3600, 6500)]
bm = bmesh.new(); vc = vcol_layer(bm); Gd = []; Dd = {}
for y in YS:
    row = []
    for x in XS:
        i, d = near(x, y); v = bm.verts.new((x, y, dune_z(x, y, d))); row.append(v); Dd[v] = d
    Gd.append(row)
for r_ in range(len(YS) - 1):
    for c in range(len(XS) - 1):
        q = [Gd[r_][c], Gd[r_][c + 1], Gd[r_ + 1][c + 1], Gd[r_ + 1][c]]
        if all(ring(v.co.x, v.co.y) < -5 for v in q): continue       # the bowl has its own ground
        if max(Dd[v] for v in q) < 50: ground_col.append([v.co.copy() for v in q])
        f = bm.faces.new(q); f.material_index = 0
        for l in f.loops:
            co = l.vert.co; t = 0.9 + 0.22 * fbm(co.x / 150, co.y / 110, 3) + 0.08 * fbm(co.x / 24, co.y / 24, 2)
            l[vc] = (0.64 * t, 0.5 * t, 0.36 * t, 1)       # warm Gulf sand from the pale photo (its mean is about 1)
mesh_obj('SJ desert', bm, ['sand'], smooth=True)
# a paved run-off, flush with the road, out to the wall all round the lap (the walkway of the road's own stations)
SHOULDER = [[off(i, sd * HW, -0.01), off((i + 1) % N, sd * HW, -0.01), off((i + 1) % N, sd * BD[sd][(i + 1) % N], -0.01), off(i, sd * BD[sd][i], -0.01)][::sd] for sd in (1, -1) for i in range(N)]
bm = bmesh.new(); vc = vcol_layer(bm)
for q in SHOULDER:
    f = bm.faces.new([bm.verts.new(p) for p in q]); f.material_index = 0
    for l in f.loops: t = 0.72 + 0.1 * fbm(l.vert.co.x / 30, l.vert.co.y / 30, 3); l[vc] = (t, t * 0.97, t * 0.92, 1)
mesh_obj('SJ run-off', bm, ['runoff'])
for part in ('shajawa_venue.py',): exec(compile((H / part).read_text(encoding='utf8'), str(H / part), 'exec'))

collision(ground_col, SHOULDER)
write_track('Shajawa Stadium', ['Textures: Poly Haven (CC0); Modular Stadium by davi.pereira.souza.0001, Stadium Light by thundermind and Coconut Tree Low poly by ar.jethin (CC BY 4.0, Sketchfab); see tracks/shajawa/CREDITS.md'],
            ['day', 'dusk'], 'day', [{'name': 'The screen', 'pos': to_game(Vector((ex, ey, 21)))}])
export()
