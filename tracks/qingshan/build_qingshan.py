"""Qingshan Park, for the user's review in Blender: the whole lap: forest, three imperial halls, lake, turbines, the red roof and its stands, solar field, pits, race dressing, far hills.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/qingshan/build_qingshan.py -Log D:/RaceUltimate/tracks/qingshan/build_qingshan.log      (add -Rest --no-export for the review blend alone)
Layout: plan_layout.py -> track-viewer/docs/career-worlds/qingshan.json. Trees: make_trees.py, make_shrubs.py. Hall: qingshan_hall.py. Shared pieces: tracks/career_lib.py. Day and dusk only."""
import bpy
from pathlib import Path
H = Path(r'D:/RaceUltimate/tracks/qingshan'); ID = 'qingshan'; PFX = 'QS'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
import numpy as np
TX = H / 'tex'; STRETCHES = ((0.0, 5797.0),)
MAT.update({
    'asphalt': material('QS | asphalt', tex='asphalt_track', rough=0.72, diff=ROOT / 'tracks' / 'drylake' / 'tex' / 'asphalt_track_bleached_diff_2k.jpg'),
    'line': material('QS | line white', (0.62, 0.62, 0.6), 0.6), 'kerb_r': material('QS | kerb red', tex='brushed_concrete', diff=TX / 'kerb_red_diff.jpg'), 'kerb_w': material('QS | kerb white', tex='brushed_concrete', diff=TX / 'kerb_white_diff.jpg'),
    'barrier': material('QS | barrier', tex='concrete_wall_009'), 'grass': material('QS | grass', tex='leafy_grass', vcol=True), 'floor': material('QS | forest floor', tex='forest_leaves_02', vcol=True),
    'stone': material('QS | terrace stone', tex='large_sandstone_blocks', diff=TX / 'terrace_stone_diff_2k.jpg'), 'paving': material('QS | court paving', tex='large_sandstone_blocks', diff=TX / 'terrace_stone_diff_2k.jpg'),
    'red': material('QS | red lacquer plaster', tex='red_plaster_weathered'), 'wood': material('QS | lacquer wood', (.30, .05, .03), .42, tex=None), 'dark': material('QS | shade ground', (.035, .02, .016), .8),
    'beam': material('QS | painted beam green', tex='blue_plaster_weathered', vcol=False), 'beam2': material('QS | painted beam blue', tex='blue_plaster_weathered'), 'gold': material('QS | gilt', (.72, .50, .16), .38, .75),
    'tile': material('QS | yellow glazed tile', tex='ceramic_roof_01', diff=TX / 'roof_yellow_diff_2k.jpg'), 'ridge': material('QS | ridge glaze', (.78, .52, .08), .42),
})
UVS.update({'kerb_r': 2.5, 'kerb_w': 2.5, 'asphalt': 3.5, 'grass': 8.0, 'floor': 5.0, 'stone': 3.2, 'paving': 3.2, 'red': 4.0, 'beam': 2.4, 'beam2': 3.0, 'gold': 2.0, 'dark': 4.0, 'wood': 2.0, 'ridge': 2.0, 'tile': 7.0})
for k_ in ('grass', 'floor'): MAT[k_].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0.12      # a grass field has no sheen at low sun
road(7.5, 70)
st = lambda s: int(round(s / STEP)) % N
def wall(i):      # 16 m from the centre (8.5 m of run-off), 30 m through the corners a car can miss
    s = i * STEP; w = 16.0
    for c in SRC['corners']:
        half = c['radius'] * math.radians(c['turn']) / 2 + 30; g = 1 - ss(half, half + 40, abs(((s - c['at'] + LAP / 2) % LAP) - LAP / 2)); w = max(w, 16.0 + 14.0 * g)
    return w
barriers(wall)
# the lake side of the top straight and Turn 7's inside are open steel rail, as parkland circuits use, not a concrete wall that would hide the lake: the same line and the same collision, only the visual changes
RAIL = {-1: [False] * N, 1: [False] * N}
for i in range(N):
    if 2120 < i * STEP < 4560 or 4660 < i * STEP < 5500: RAIL[-1][i] = True      # all the open infield: wind farm, lake, solar
bpy.data.objects.remove(bpy.data.objects[f'{PFX} barriers'], do_unlink=True)
bm = bmesh.new()
for sd in (1, -1):
    runs_, cur_ = [], None
    for i in range(N):
        if RAIL[sd][i]: cur_ = None; continue
        if cur_ is None: cur_ = []; runs_.append(cur_)
        cur_.append(i)
    if len(runs_) > 1 and runs_[0][0] == 0 and runs_[-1][-1] == N - 1: runs_[0] = runs_.pop() + runs_[0]
    for r_ in runs_:
        closed = len(r_) == N
        strip(bm, [[off(i, sd * (BD[sd][i] + u), v - 0.05) for u, v in PROF] for i in (r_ if closed else r_ + [(r_[-1] + 1) % N])], 0, closed=closed, rev=sd < 0)
ob_b = mesh_obj(f'{PFX} barriers', bm, ['barrier'], planar=False); b2 = bmesh.new(); b2.from_mesh(ob_b.data); uv_ = b2.loops.layers.uv.verify()
for f in b2.faces:
    for l in f.loops: c_ = l.vert.co; i_, _x = near(c_.x, c_.y); l[uv_].uv = (i_ * STEP / 2.0, c_.z / 2.0 + (c_ - CL[i_]).length / 2.0)
b2.to_mesh(ob_b.data); b2.free()
MAT['rail'] = material('QS | galvanised rail', tex='brushed_concrete', rough=.45, metal=.6); UVS['rail'] = 3.0; bm = bmesh.new()
for sd in (1, -1):
    for i in range(N):
        if not RAIL[sd][i]: continue
        j = (i + 1) % N
        for z0, z1 in ((.45, .75),): q = [off(i, sd * BD[sd][i], z0), off(j, sd * BD[sd][j], z0), off(j, sd * BD[sd][j], z1), off(i, sd * BD[sd][i], z1)]; bm.faces.new([bm.verts.new(p) for p in (q if sd < 0 else q[::-1])])
        if i % 2 == 0:
            box(bm, off(i, sd * (BD[sd][i] + .12), .375), (.1, .1, .85), HEAD[i])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); mesh_obj(f'{PFX} rail', bm, ['rail'], planar=True)
for sd in (1, -1):
    for i in range(0, N, 2):
        p = off(i, sd * BD[sd][i]); j, d = near(p.x, p.y)
        assert d > HW + 3, f'the wall at station {i} stands on the road at station {j}'
log('corners', {c['n']: (st(c['at']), c['radius']) for c in SRC['corners']})

# ------------------------------------------------------------------------------------------------ forest positions, in this build's frame
Z_ = np.load(H / 'out' / 'plan' / 'plan_arrays.npz'); MM = M
def world(a): return np.array([(MM @ Vector((float(x), float(y), 0))).to_2d()[:] for x, y in a])
ROWS, CLUMP, FARC = world(Z_['ROWS']), world(Z_['CLUMP']), world(Z_['FARCARD'])
PX_ = np.array([[p.x, p.y] for p in CL]); path = np.vstack([PX_[st(a_):st(b_)][::4] for a_, b_ in STRETCHES]); from mathutils.kdtree import KDTree as KT
kp = KT(len(path)); [kp.insert((a, b, 0), i) for i, (a, b) in enumerate(path)]; kp.balance(); dpath = lambda x, y: kp.find((x, y, 0))[2]
STATS = json.loads((OUT / 'plan' / 'stats.json').read_text(encoding='utf8')); kk = STATS['m_per_sketch_px']; LK = world(Z_['lake'] * np.array([kk, -kk])); LEVEL = -1.2      # the lake: its water level, and the signed distance to its shore, positive on the water
LA, LB = LK[::2], np.roll(LK[::2], -1, 0); LD = LB - LA; LL = (LD ** 2).sum(1) + 1e-9
def lake_sd(x, y):
    h = np.clip(((x - LA[:, 0]) * LD[:, 0] + (y - LA[:, 1]) * LD[:, 1]) / LL, 0, 1); d = np.sqrt(((x - LA[:, 0] - h * LD[:, 0]) ** 2 + (y - LA[:, 1] - h * LD[:, 1]) ** 2).min()); inside = (((LA[:, 1] > y) != (LB[:, 1] > y)) & (x < LD[:, 0] * (y - LA[:, 1]) / (LD[:, 1] + 1e-12) + LA[:, 0])).sum() % 2
    return float(d if inside else -d)
ALL = np.r_[ROWS, CLUMP]; kt = KT(len(ALL)); [kt.insert((a, b, 0), i) for i, (a, b) in enumerate(ALL)]; kt.balance(); to_tree = lambda x, y: kt.find((x, y, 0))[2]
kf_ = KT(len(FARC)); [kf_.insert((a, b, 0), i) for i, (a, b) in enumerate(FARC)]; kf_.balance(); to_far = lambda x, y: kf_.find((x, y, 0))[2]      # the far forest's floor stays dark too, or it reads sparse from above

# ------------------------------------------------------------------------------------------------ ground
def axis(lo, hi, cell=8.0, edge=6000.0, grow=1.2):
    a = list(np.arange(lo, hi + cell, cell)); step = cell; x = a[0]
    while x > lo - edge: step *= grow; x -= step; a.insert(0, x)
    step = cell; x = a[-1]
    while x < hi + edge: step *= grow; x += step; a.append(x)
    return a
GX_, GY_ = axis(min(xs) - 240, max(xs) + 360), axis(min(ys) - 240, max(ys) + 240)
C_ = np.array([[p.x, p.y, p.z] for p in CL[::6]])
def height(x, y, i, d):
    d2 = (C_[:, 0] - x) ** 2 + (C_[:, 1] - y) ** 2; w = 1 / (d2 + 900) ** 2; far = float((w * C_[:, 2]).sum() / w.sum()); t = ss(HW + 14, HW + 70, d); sunk = 0.05 + 0.35 * (1 - ss(HW - 1, HW + 0.5, d))
    z = (CL[i].z - sunk) * (1 - t) + (far + 5.0 * fbm(x / 700, y / 700, 3) * ss(60, 500, d)) * t; sd = lake_sd(x, y)
    if sd > -80:      # the land falls towards the water a long way out, so a driver can see it over the grass
        side = 1 if (x - CL[i].x) * NL[i].x + (y - CL[i].y) * NL[i].y >= 0 else -1; wl = BD[side][i]; w = (1 - ss(0, 80, -sd)) * ss(wl + 2, wl + 16, d)      # flat out to the wall, a car in the run-off never meets the bank;
        z = z * (1 - w) + (LEVEL - 2.2 * ss(0, 14, sd) if sd > 0 else LEVEL) * w
    z += (45 + 150 * ss(-.5, .6, fbm(x / 1500 + 9, y / 1500, 3))) * ss(1000, 3800, d)      # the green mountains the name means, beyond the forest
    return z
def gz(x, y): i, d = near(x, y); return height(x, y, i, d)
def tint(co, d):      # grass varies in patches; far out it evens, the long outer cells would streak
    t = 0.9 + 0.26 * fbm(co.x / 38, co.y / 38, 3); e = ss(350, 900, d); t = t * (1 - e) + .95 * e; m_ = ss(900, 1900, d); return (t * (.5 - .36 * m_), t * (.86 - .62 * m_ + .08 * fbm(co.x / 90 + 3, co.y / 90, 2)), t * (.3 - .22 * m_), 1)
bm = bmesh.new(); vc = vcol_layer(bm); G = []; D = {}; TD = {}
for y in GY_:
    row = []
    for x in GX_:
        i, d = near(x, y); v = bm.verts.new((x, y, height(x, y, i, d))); D[v] = d; TD[v] = min(to_tree(x, y), max(0.0, to_far(x, y) - 11.0)); row.append(v)
    G.append(row)
ground_col = []; REACH = 30 + 12
for r_ in range(len(GY_) - 1):
    for c in range(len(GX_) - 1):
        q = [G[r_][c], G[r_][c + 1], G[r_ + 1][c + 1], G[r_ + 1][c]]
        if max(D[v] for v in q) < HW - 0.6: continue
        if min(D[v] for v in q) < REACH: ground_col.append([v.co.copy() for v in q])
        f = bm.faces.new(q); f.material_index = 1 if all(TD[v] < 8 for v in q) and 40 < min(D[v] for v in q) and max(D[v] for v in q) < 130 else 0      # leaf litter deep in the trees; everywhere else the grass darkens towards them, vertex by vertex, so no stepped edge shows
        for l in f.loops: dk = 1 - ss(5, 17, TD[l.vert]); g0 = tint(l.vert.co, D[l.vert]); l[vc] = tuple(g0[k] + ((.1, .17, .07, 1)[k] - g0[k]) * dk for k in range(4)) if f.material_index == 0 else (.30, .36, .2, 1)
mesh_obj('QS ground', bm, ['grass', 'floor'], smooth=True)
exec(compile((H / 'qingshan_offtrack.py').read_text(encoding='utf8'), str(H / 'qingshan_offtrack.py'), 'exec'))
log('ground', len(GX_), 'x', len(GY_), 'collision quads', len(ground_col))

# ------------------------------------------------------------------------------------------------ the forest, around the stretch only: shared meshes, placed as the game's instances will be
SPECIES = ['tree_small_02', 'island_tree_01', 'island_tree_02', 'jacaranda_tree']; MASTER = {}
for s_ in SPECIES:
    with bpy.data.libraries.load(str(OUT / 'trees' / f'{s_}.blend'), link=False) as (a, b): b.objects = [n for n in a.objects if n.startswith('TREE')]
    for o in b.objects: MASTER[o.name] = o.data
with bpy.data.libraries.load(str(OUT / 'trees' / 'understorey.blend'), link=False) as (a, b): b.objects = [n for n in a.objects if n.startswith('SHRUB')]
for o in b.objects: MASTER[o.name] = o.data
for k_, me_ in MASTER.items():      # the far cards sit in the same light as the near trees' shaded sides
    if k_.endswith('CARD'):
        for d_ in me_.color_attributes['Col'].data: d_.color = (.60, .64, .50, 1)
        cz_ = sum(v.co.z for v in me_.vertices) / len(me_.vertices); me_.normals_split_custom_set_from_vertices([tuple(Vector((v.co.x, v.co.y, (v.co.z - cz_) + cz_ * 1.3)).normalized()) for v in me_.vertices])      # every plane lit alike: one edge-on would read as a dark slab
log('masters', list(MASTER))
FOREST = bpy.data.collections.new('forest'); VIS.children.link(FOREST)
HEIGHT = {'tree_small_02': (4.56, 17.0, 25.0), 'island_tree_01': (5.03, 13.0, 19.0), 'island_tree_02': (3.41, 11.0, 15.0), 'jacaranda_tree': (19.47, 17.0, 24.0)}      # scan height, wanted range: mixed heights, so the skyline isn't one line
def species(x, y):      # stands, as real forest has, not an even shuffle
    n = fbm(x / 95 + 11, y / 95 - 4, 2) + RNG.uniform(-.22, .22); return 'island_tree_01' if n < -.14 else 'tree_small_02' if n < .16 else 'jacaranda_tree' if n < .27 else 'island_tree_02'
def place(mesh, x, y, h, yaw=None, zoff=-.15):
    ob = bpy.data.objects.new(mesh.name, mesh); FOREST.objects.link(ob); ob.location = (x, y, gz(x, y) + zoff); ob.rotation_euler = (0, 0, RNG.uniform(0, 6.283) if yaw is None else yaw); ob.scale = (h, h * RNG.uniform(.92, 1.08), h); return ob
count = {'LOD0': 0, 'LOD1': 0, 'CARD': 0}; R0, R1, RFAR = 34.0, 110.0, 900.0      # the review file's fixed detail, lighter than a live camera's 50 m: it has to open in Blender
for (pts, full) in ((ROWS, True), (CLUMP, False), (FARC, False)):
    for x, y in pts:
        d = dpath(x, y)
        if d > RFAR: continue
        j_, dr = near(x, y)
        if dr < max(BD[1][j_], BD[-1][j_]) + 2.5 and dr < 34: continue      # never inside the run-off a corner keeps
        sp = species(x, y); sh, a, b = HEIGHT[sp]; h = RNG.uniform(a, b) / sh
        lod_ = 'LOD0' if full and d < R0 else 'LOD1' if d < R1 and pts is not FARC else 'CARD'; ob_ = place(MASTER[f'TREE {sp} {lod_}'], x, y, h); ob_['sp'] = sp; ob_['tier'] = 0 if full else 1 if pts is not FARC else 2; count[lod_] += 1
log('forest', count)
# the edge a driver actually looks at: low round trees and weeds in front of the trunks, so the wall reaches the ground
und = 0
for i in [q for a_, b_ in STRETCHES for q in range(st(a_), st(b_), 3)]:      # every 7.5 m a side, was 5
    for sd in (1, -1):
        wl = BD[sd][i]; lat = wl + RNG.uniform(2.5, 9.0); p = off(i, sd * lat)
        if to_tree(p.x, p.y) > 16 or near(p.x, p.y)[1] < wl: continue
        place(MASTER['TREE island_tree_01 LOD1' if RNG.random() < .7 else 'TREE island_tree_02 LOD1'], p.x, p.y, RNG.uniform(3.5, 8.0) / 5.03); und += 1
        q = off(i, sd * (wl + RNG.uniform(.8, 3.0))); place(MASTER[f'SHRUB {RNG.randint(4, 7)}'], q.x, q.y, RNG.uniform(.9, 1.6)); und += 1
        if RNG.random() < .3: q = off(i, sd * (wl + RNG.uniform(1.0, 3.5))); place(MASTER[f'SHRUB {RNG.randint(0, 3)}'], q.x, q.y, RNG.uniform(1.0, 1.6)); und += 1
# and the low layer that closes the gap under the crowns: small round trees, packed, cheap cards in the game
low = 0
for i in [q for a_, b_ in STRETCHES for q in range(st(a_), st(b_), 1)]:
    for sd in (1, -1):
        if RNG.random() < .3: continue
        wl = BD[sd][i]; p = off(i, sd * (wl + RNG.uniform(2.5, 16.0)))
        if to_tree(p.x, p.y) > 16 or near(p.x, p.y)[1] < wl: continue
        place(MASTER['TREE island_tree_01 CARD' if RNG.random() < .75 else 'TREE island_tree_02 CARD'], p.x, p.y, RNG.uniform(4.5, 9.0) / 5.03, zoff=-.4); low += 1
log('understorey', und, 'low layer', low)

# ------------------------------------------------------------------------------------------------ one complete hall
exec(compile((H / 'qingshan_hall.py').read_text(encoding='utf8'), str(H / 'qingshan_hall.py'), 'exec'))
hp = np.array(STATS['shapes']['HALLS'][0], float); ctr = hp.mean(0)
hc = (MM @ Vector((ctr[0] * kk, -ctr[1] * kk, 0))); j, dd = near(hc.x, hc.y); hc.z = gz(hc.x, hc.y) + .25; face = (CL[j] - hc); face.z = 0; face.normalize(); log('hall centre', tuple(round(a, 1) for a in hc), 'to the road', round(dd, 1))
assert dd > 22 + 16, 'the terrace would reach the barrier'
imperial_hall(hc, face)
def hall_at(q):
    p_ = np.array(STATS['shapes']['HALLS'][q], float).mean(0); c_ = MM @ Vector((p_[0] * kk, -p_[1] * kk, 0)); j_, _d = near(c_.x, c_.y); c_.z = gz(c_.x, c_.y) + .25; f_ = CL[j_] - c_; f_.z = 0; return c_, f_.normalized()
hall_compound(*hall_at(1)); gate_hall(*hall_at(2))

exec(compile((H / 'qingshan_nature.py').read_text(encoding='utf8'), str(H / 'qingshan_nature.py'), 'exec'))
exec(compile((H / 'qingshan_arena.py').read_text(encoding='utf8'), str(H / 'qingshan_arena.py'), 'exec'))
exec(compile((H / 'qingshan_dressing.py').read_text(encoding='utf8'), str(H / 'qingshan_dressing.py'), 'exec'))
collision(ground_col, paved_col)
write_track('Qingshan Park', ['Textures and trees: Poly Haven (CC0); solar: ambientCG (CC0); see tracks/qingshan/CREDITS.md'], ['day', 'dusk'], 'day', [{'name': 'Hall 1', 'pos': to_game(hc + Vector((0, 0, 20)))}, {'name': 'Hall 2', 'pos': to_game(hall_at(1)[0])}, {'name': 'Hall 3', 'pos': to_game(hall_at(2)[0])}, {'name': 'Rotunda', 'pos': to_game(Vector(ARENA['rotunda']))}, {'name': 'North stand', 'pos': to_game(Vector(ARENA['stand']))}, {'name': 'Corner stand', 'pos': to_game(Vector(ARENA['corner']))}, {'name': 'Main stand', 'pos': to_game(Vector(ARENA['main']))}, {'name': 'Lake', 'pos': to_game(Vector((float(LKc[0]), float(LKc[1]), LEVEL)))}], extra={'rotorHubs': {k_: to_game(v_) for k_, v_ in HUBS.items()}})      # the pack re-centres mesh origins, so venue/qingshan.js pivots on these
WANT_GAME = EXPORT; EXPORT = False; export()      # saves the review blend, with the forest as plain placed objects; the game's own forest is made below and not saved
if '--collision-only' in ARGS:
    bpy.ops.object.select_all(action='DESELECT')
    for o in COL.objects: o.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(COL.objects)); bpy.ops.export_scene.gltf(filepath=str(OUT / 'qingshan_collision.glb'), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_materials='NONE', export_texcoords=False, export_normals=False); WANT_GAME = False
if WANT_GAME:
    # every placed tree becomes instances in distance tiers: `~lo-hi` on the parent empty is read by perf.js Culler, one EXT_mesh_gpu_instancing set per mesh and tier (as tracks/india/game_india.py)
    bpy.context.view_layer.update(); GROUPS = {}
    def add(mesh, tag, m): GROUPS.setdefault((mesh.name, tag), []).append(m)
    for ob in FOREST.objects:
        m = ob.matrix_world.copy(); nm = ob.data.name
        if 'sp' in ob:
            sp = ob['sp']; mesh = lambda l_: bpy.data.meshes[f'TREE {sp} {l_}']
            if ob['tier'] == 0: add(mesh('LOD0'), '~0-40', m); add(mesh('LOD1'), '~40-90', m); add(mesh('CARD'), '~90-1500', m)
            elif ob['tier'] == 1: add(mesh('LOD1'), '~0-90', m); add(mesh('CARD'), '~90-1500', m)
            else: add(mesh('CARD'), '~0-1500', m)
        elif nm.startswith('SHRUB'): add(ob.data, '~0-110', m)
        elif nm.startswith('BAMBOO'): add(ob.data, '~0-220', m)
        elif nm.endswith('CARD'): add(ob.data, '~0-800', m)
        elif nm.endswith('LOD1'): add(ob.data, '~0-70', m); add(bpy.data.meshes[nm.replace('LOD1', 'CARD')], '~70-700', m)
        else: add(ob.data, '~0-400', m)
    for ob in SOL.objects: add(ob.data, '~0-1300' if ob.data.name == 'QS solar table' else '~0-220', ob.matrix_world.copy())
    GAME = bpy.data.collections.new('game instances'); sc.collection.children.link(GAME); gobs = []
    for (mn, tag), ms in GROUPS.items():
        quiet = 'CARD' in mn or mn.startswith('SHRUB') or mn == 'QS solar table'; e = bpy.data.objects.new(f"{'far_shore ' if quiet else ''}{mn} {tag}", None); GAME.objects.link(e)      # main.js NO_CAST reads the prefix: instanced sets aren't frustum culled, so every far card would otherwise be drawn into the shadow pass
        gobs.append(e); me = bpy.data.meshes[mn]
        for k, m in enumerate(ms):
            c_ = bpy.data.objects.new(f'{mn}.{k:05d}', me); GAME.objects.link(c_); c_.parent = e; c_.matrix_world = m; gobs.append(c_)
    log('game instances', len(gobs), {f'{k[0]} {k[1]}': len(v) for k, v in GROUPS.items()})
    for q, o in enumerate(o_ for o_ in VIS.objects if o_.name.startswith('turbine_')):      # each rotor its own mesh, just unlike the others, so the pack keeps five nodes the venue can turn
        me = o.data.copy(); me.name = o.name; me.vertices.foreach_set('co', [c + (q + 1) * 1e-3 if k % 3 == 0 else c for k, c in enumerate(v_ for vt in me.vertices for v_ in vt.co)]); me.update(); o.data = me
    bpy.context.view_layer.update()
    def glb(path, objs, **kw):
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = next(o for o in objs if o.type == 'MESH')
        bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, **kw)
    glb(OUT / 'qingshan_visual.glb', [o for o in VIS.objects if o.type == 'MESH'] + gobs, export_gpu_instances=True)
    glb(OUT / 'qingshan_collision.glb', list(COL.objects), export_materials='NONE', export_texcoords=False, export_normals=False)
    log('exported')
log('finished')
