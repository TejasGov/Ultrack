# exec'd by game_v13_1_part3.py: collision, track.json, lights.json (game_v11.py code, adapted), save, export, count.

# ------------------------------------------------------------------------------------------------ 11. collision (as v11)
cl = [Vector(p) for p in CL]
for g_ in (terr, plane):    # the exporter needs UVs for the grass texture: planar, 24 m per tile, in world metres
    me_ = g_.data
    for nm in list(me_.uv_layers.keys()):
        me_.uv_layers.remove(me_.uv_layers[nm])
    uv_ = me_.uv_layers.new(name='UVMap')
    for lp in me_.loops:
        w_ = g_.matrix_world @ me_.vertices[lp.vertex_index].co
        uv_.data[lp.index].uv = (w_.x / 24, w_.y / 24)
terr.name = 'ground_terrain'
plane.name = 'ground_plane'
for o in sc.objects:
    if o.name.startswith(('Tokyo Bay water', 'V10 lagoon surface')):
        o.name = 'water'
        o['surface'] = 'water'
road = next(o for o in sc.objects if o.name.startswith('Continuous road'))
road.name = 'asphalt_road'


def col_obj(name, src_objs, faces_filter=None):
    bm = bmesh.new()
    for o in src_objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        tmp.transform(o.matrix_world)
        bmesh.ops.triangulate(tmp, faces=tmp.faces[:])
        if faces_filter:
            bmesh.ops.delete(tmp, geom=[f for f in tmp.faces if not faces_filter(f)], context='FACES')
        me = bpy.data.meshes.new('t')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    COL.objects.link(ob)
    ob.hide_render = True
    ob['surface'] = name[4:]
    return ob


kerbs = [o for o in sc.objects if o.name.startswith('Kerb |')]
sidewalks = [o for o in sc.objects if o.name.startswith('Continuous sidewalk')]
col_obj('col_asphalt', [road])
col_obj('col_curb', kerbs)
wbm = bmesh.new()
for sd in (1, -1):
    prev = None
    for i in range(N + 1):
        a_, b_ = cl[(i - 1) % N], cl[(i + 1) % N]
        d_ = (b_ - a_).normalized()
        nrm = Vector((-d_.y, d_.x, 0)) * sd
        base = cl[i % N] + nrm * 11.9
        cur = (wbm.verts.new(base + Vector((0, 0, -0.4))), wbm.verts.new(base + Vector((0, 0, 1.0))))
        if prev:
            wbm.faces.new([prev[0], cur[0], cur[1], prev[1]])
        prev = cur
wme = bpy.data.meshes.new('col_wall')
wbm.to_mesh(wme)
wbm.free()
wob = bpy.data.objects.new('col_wall', wme)
wob['surface'] = 'wall'
wob.hide_render = True
COL.objects.link(wob)
col_paved = col_obj('col_paved', sidewalks)
sbm = bmesh.new()
for sd in (1, -1):
    prev = None
    for i in range(N + 1):
        a_, b_ = cl[(i - 1) % N], cl[(i + 1) % N]
        d_ = (b_ - a_).normalized()
        nrm = Vector((-d_.y, d_.x, 0)) * sd
        c0 = cl[i % N]
        cur = (sbm.verts.new(c0 + nrm * (HALF_W + 0.02) + Vector((0, 0, -0.05))), sbm.verts.new(c0 + nrm * 11.9 + Vector((0, 0, -0.05))))
        if prev:
            sbm.faces.new([prev[0], prev[1], cur[1], cur[0]])
        prev = cur
tmp_me = bpy.data.meshes.new('shoulder')
sbm.to_mesh(tmp_me)
sbm.free()
jb = bmesh.new()
jb.from_mesh(col_paved.data)
jb.from_mesh(tmp_me)
jb.to_mesh(col_paved.data)
jb.free()
col_obj('col_grass', [terr], lambda f: road_dist(*(sum((v.co for v in f.verts), Vector()) / 3).xy)[0] < 70 and (sum((v.co for v in f.verts), Vector()) / 3).z > -3)
for o in COL.objects:
    log('collision', o.name, tris(o.data))

# ------------------------------------------------------------------------------------------------ 12. track.json, lights.json
to_game = lambda x, y, z: [round(x, 3), round(z, 3), round(-y, 3)]
slope, heading = [], []
for i in range(N):
    a, b = cl[i - 1], cl[(i + 1) % N]
    d = b - a
    slope.append(round(d.z / max(d.xy.length, 1e-6), 4))
    heading.append(math.atan2(d.y, d.x))
cum = [0.0]
for i in range(1, N + 1):
    cum.append(cum[-1] + (cl[i % N] - cl[i - 1]).xy.length)
LAP = cum[-1]
yaw_of = lambda h: round(math.atan2(math.cos(h), -math.sin(h)), 4)
corners_ = []
kk = int(60 / (LAP / N))
turn = [((heading[(i + kk) % N] - heading[i - kk] + math.pi) % (2 * math.pi) - math.pi) for i in range(N)]
i = 0
while i < N:
    if abs(turn[i]) > math.radians(28):
        j = i
        while j < N and abs(turn[j]) > math.radians(28):
            j += 1
        apex = max(range(i, j), key=lambda k: abs(turn[k]))
        corners_.append(dict(start=i, end=j, apex=apex, angle=round(math.degrees(abs(turn[apex])), 1), sign=1 if turn[apex] > 0 else -1))
        i = j + kk // 2
    else:
        i += 1
corner_json = []
for n_, c in enumerate(corners_):
    rad = (LAP / N * kk * 2) / max(math.radians(c['angle']), 0.1)
    corner_json.append(dict(id=f'T{n_ + 1}', name=f'Turn {n_ + 1}', radius=round(rad), angle=c['angle'], apexIdx=c['apex'], boards=[]))
slots = []
for k in range(8):
    dist_back = 8 + 8 * k
    s = (LAP - dist_back) % LAP
    j = max(i_ for i_ in range(N) if cum[i_] <= s)
    f = (s - cum[j]) / max(cum[j + 1] - cum[j], 1e-6)
    p = cl[j].lerp(cl[(j + 1) % N], f)
    h = heading[j]
    nrm = Vector((-math.sin(h), math.cos(h), 0))
    lat = 3.0 if k % 2 == 0 else -3.0
    slots.append(dict(slot=k + 1, centerlineIdx=j, pos=to_game(*(p + nrm * lat)), headingYawRad=yaw_of(h)))
holograms = []
for hname in holo:
    p = M @ hname['pos']
    fwd = M.to_3x3() @ hname['fwd']
    holograms.append(dict(name=hname['name'], pos=to_game(p.x, p.y, p.z), facing=[round(fwd.x, 3), round(-fwd.y, 3)],
                          sizeM=[hname['props'].get('size_hint_w_m'), hname['props'].get('size_hint_h_m')], note=hname['props'].get('note')))
track = {
    'name': 'Tokyo Hiragana Circuit', 'units': 'metres; game coords: Y up (absolute, the road dips to -12 m), x east, -z north; origin = start/finish line centre; start heading +X',
    'direction': 'as sampled in out/centerline-v10.json (start/finish index 33 of the source order)', 'lapLength': round(LAP, 1),
    'credits': ['Textures: Poly Haven (CC0), see assets/polyhaven/CREDITS.md; sponsor boards: assets/sponsors/README.md; anime murals: textures/anime/PROVENANCE.md'],
    'spacing': round(LAP / N, 3), 'centerline': [to_game(*p) for p in CL], 'halfWidth': [HALF_W] * N,
    'racingLine': [0.0] * N, 'slope': slope, 'banking': [0.0] * N, 'headingYawRad': [yaw_of(h) for h in heading],
    'sectors': [0, N // 3, 2 * N // 3], 'checkpoints': list(range(0, N, 25)), 'corners': corner_json,
    'start': {'pos': [0, round(CL[0][2], 3), 0], 'headingYawRad': yaw_of(heading[0]), 'gridSlots': slots},
    'pitLane': None, 'zones': [], 'weather': {'default': 'night', 'looks': ['dusk', 'bluehour', 'night']},
    'landmarks': [{'name': 'Tokyo', 'pos': to_game(cx, cy, 0)}],
    'surfaces': {'asphalt': ['col_asphalt'], 'curb': ['col_curb'], 'grass': ['col_grass'], 'paved': ['col_paved'], 'wall': ['col_wall']},
    'capabilities': {'pit': False, 'vip': False, 'hoardings': False, 'driverHoardings': False},
    'backdrop': {'mesh': 'skyline_arc', 'meshDay': 'skyline_arc_day', 'radius': R_ARC, 'height': round(ARC_H), 'arcDegrees': round(ARC_DEG, 1),
                 'note': 'one skyline strip as a partial arc (one Tokyo Tower), Fuji card, two ridges (night / day), distant lights, searchlight cards; centre = landmarks[0]'},
    'holograms': holograms,
    'collision': 'tokyo_collision.glb', 'visual': ['tokyo_visual.glb'],
}
(O / 'track.json').write_text(json.dumps(track, separators=(',', ':')), encoding='utf8')
flood, stand_l, street = [], [], []
cands = [x for x in spots if x[2] == 'SPOT' and not x[5].startswith(('V13', 'V12'))] or sorted(
    [x for x in spots if x[2] in ('POINT', 'AREA') and not x[5].startswith(('V13', 'V12', 'gantry'))], key=lambda x: -x[4])
taken = []
for (p, d_, typ, color, energy, nm_) in cands:
    gp = M @ p
    if any((p - t).length < 90 for t in taken) or p.z < 3 or road_dist(gp.x, gp.y)[0] > 90:
        continue
    taken.append(p)
    _, ci = road_dist(gp.x, gp.y)
    tg = Vector(CL[ci]) if typ != 'SPOT' else gp + (M.to_3x3() @ d_) * 30
    flood.append({'pos': to_game(*gp), 'target': to_game(*tg), 'warm': color[0] > color[2]})
for o in sc.objects:
    if o.name.startswith('lamp_pole_'):
        street.append({'pos': to_game(*(o.matrix_world.translation + Vector((0, 0, 9.0))))})
for si in stand_info:
    mw = si['mw']
    R = si['R']
    for x in range(int(-si['width'] / 2) + 15, int(si['width'] / 2), 30):
        a = x / R
        for yy, zz in ((-si['depth'] / 2 - 5, 26.2),):
            pl = mw @ Vector(((R + yy) * math.sin(a), (R + yy) * math.cos(a) - R, zz))
            tg = mw @ Vector(((R - si['depth'] / 2 - 40) * math.sin(a), (R - si['depth'] / 2 - 40) * math.cos(a) - R, 0))
            stand_l.append({'pos': to_game(*pl), 'target': to_game(*tg)})
for (p, d_, typ, color, energy, nm_) in spots:      # the v12 start stands: their lamps under the roofs
    if 'Seoul-style start stand' in nm_:
        gp = M @ p
        _, ci = road_dist(gp.x, gp.y)
        stand_l.append({'pos': to_game(*gp), 'target': to_game(*Vector(CL[ci]))})
(O / 'lights.json').write_text(json.dumps({'floodlights': flood[:60], 'standLamps': stand_l, 'streetLamps': street}, separators=(',', ':')), encoding='utf8')
log('lights', len(flood), len(stand_l), len(street))

# ------------------------------------------------------------------------------------------------ 13. save, export, count
bpy.ops.wm.save_as_mainfile(filepath=str(DST))


def export(path, objs, **kw):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_extras=True, **kw)


export(O / 'tokyo_visual.glb', list(VIS.all_objects), export_gpu_instances=True)
export(O / 'tokyo_collision.glb', list(COL.all_objects), export_materials='NONE', export_texcoords=False, export_normals=False)


def grp(o):
    n = o.name
    if n.startswith('tree'):
        return 'trees (3 tiers)'
    if n.startswith(('frA', 'frB')):
        return 'frontages (2 tiers)'
    if n.startswith('signs_') or n.startswith('hero_') or n.startswith('board_'):
        return 'signs and boards'
    if n.startswith(('lanA', 'lanB')):
        return 'lanterns (2 tiers)'
    if n.startswith('static_'):
        return 'merged static cells'
    if n.startswith('skyline'):
        return 'backdrop'
    if n.startswith(('asphalt', 'Kerb', 'Continuous', 'ground_', 'water')):
        return 'track and terrain'
    return 'landmarks / other (tiered)' if TAG in n else 'other whole objects'


count, uniq_g, unique = {}, {}, {}
for o in VIS.all_objects:
    if o.type == 'MESH':
        n = tris(o.data)
        g = grp(o)
        count[g] = count.get(g, 0) + n
        if o.data.name not in unique:
            unique[o.data.name] = n
            uniq_g[g] = uniq_g.get(g, 0) + n
LOG['blender count'] = dict(objects_x_tris=sum(count.values()), unique=sum(unique.values()), by_group=count, unique_by_group=uniq_g, source=before)
(O / 'v13_1-game-build.json').write_text(json.dumps(LOG, indent=1, default=str))
log('after (blender, objects x tris, all tiers counted)', sum(count.values()), 'unique', sum(unique.values()))
log('done')
