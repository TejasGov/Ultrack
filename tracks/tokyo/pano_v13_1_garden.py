# exec'd by pano_v13_1.py: real anime murals, the garden (pond, red bridge, hut) moved opposite the wheel, review cameras.
# ---------------------------------------------------------------------------------------------- anime murals (real art, backlit)
GEN = C.T / 'textures' / 'anime' / 'gen'
for k, fn in enumerate(('mural_01_driver.png', 'mural_02_pitcrew.png', 'mural_03_nightrace.png', 'mural_04_sakura.png'), 1):
    m = bpy.data.materials[f'M_AnimeMural_{k:02d}']
    node = m.node_tree.nodes['IMG']
    node.image = bpy.data.images.load(str(GEN / fn), check_existing=True)
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Emission Strength'].default_value = 0.8          # backlit but not washed out: rich colour, still readable in the dark tunnel
    b.inputs['Roughness'].default_value = 0.35
LOG['murals'] = 'M_AnimeMural_01..04 use textures/anime/gen/mural_01..04 (2736x1536, 16:9), emission 0.8; placeholders kept on disk, unused'

# ---------------------------------------------------------------------------------------------- garden (pond, red bridge, hut) -> opposite side of the road
import clearance_v12 as CK  # noqa: E402
import visibility_v13 as V  # noqa: E402
from mathutils import Matrix  # noqa: E402

kd, kd_pts = CK.centerline_kd()
TERR = {o.name for o in bpy.data.collections['02_TERRAIN'].objects} | {o.name for o in sc.objects if 'extended landscape grass' in o.name or o.name.startswith('ground')}
G_TOK = ('V10 03 |', 'V10 garden pond banks')
g_all = [o for o in sc.objects if any(t in o.name for t in G_TOK)]
g_body = [o for o in g_all if o.type == 'MESH' and not o.hide_render]
glo, ghi = V.bbox(g_body)
gc = (glo + ghi) / 2
g_trees = [o for o in sc.objects if o.name.startswith(('Sakura', 'Green canopy', 'Shrine grove', 'Avenue framing')) and not o.hide_render
           and math.hypot(o.location.x - gc[0], o.location.y - gc[1]) < 40]
g_objs = g_all + [o for o in g_trees if o not in g_all]
wheel = next(o for o in sc.objects if o.name.startswith('Central park wheel'))
wp = wheel.matrix_world.translation
iw, wd, wlat = cl.nearest(wp.x, wp.y)
gi, gdist, glat = cl.nearest(gc[0], gc[1])
opp = -1 if glat > 0 else 1           # the side of the road the garden is NOT on
LOG['garden before'] = dict(center=[round(float(gc[0])), round(float(gc[1]))], size=[round(float(ghi[0] - glo[0])), round(float(ghi[1] - glo[1]))],
                            nearest_station=gi, lat=round(float(glat), 1), objects=len(g_objs), trees_moved=len(g_trees))
for o in g_objs:
    o.hide_viewport = True
_hid = V.hide_ignored(sc)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()


def ground_z(x, y):
    d = Vector((0, 0, -1))
    org = Vector((x, y, 400))
    for _ in range(12):
        hit, loc, nrm, idx, ob, _m = sc.ray_cast(dg, org, d, distance=900)
        if not hit:
            return None
        if ob.name in TERR:
            return loc.z
        org = loc + d * 0.05
    return None


obst = []
names_ = set()
for c in bpy.data.collections:
    if c.name in CK.CHECK_COLLS or (c.name.startswith(('V12 |', 'V13 |')) and any(w in c.name.lower() for w in CK.CHECK_WORDS)):
        for o in c.all_objects:
            if o.type == 'MESH' and not o.hide_render and o.name not in names_ and o not in g_objs:
                names_.add(o.name)
                pts_ = np.array([list(o.matrix_world @ Vector(v)) for v in o.bound_box])
                obst.append((pts_[:, 0].min(), pts_[:, 0].max(), pts_[:, 1].min(), pts_[:, 1].max()))
obst = np.array(obst)
rad = 0.8 * (math.hypot(float(ghi[0] - glo[0]), float(ghi[1] - glo[1])) / 2 + 4)
cands = []
for i in range(gi - 130, gi + 131, 6):
    for lat in (rad + 20, rad + 32, rad + 48, rad + 70, rad + 100):
        cxy = cl.at(i, opp * lat)[:2]
        pts_ = [(cxy[0] + dx, cxy[1] + dy) for dx in np.arange(-rad, rad + 1, 12) for dy in np.arange(-rad, rad + 1, 12)]
        if min(kd.find((x, y, 0))[2] for x, y in pts_) < 24:
            continue
        if len(obst) and np.any((obst[:, 0] < cxy[0] + rad + 6) & (obst[:, 1] > cxy[0] - rad - 6) & (obst[:, 2] < cxy[1] + rad + 6) & (obst[:, 3] > cxy[1] - rad - 6)):
            continue
        gz = [ground_z(x, y) for x, y in pts_[::4]]
        if any(g is None for g in gz) or max(gz) - min(gz) > 4 or min(gz) < -0.5:
            continue
        cands.append((i, lat, cxy, float(np.mean(gz))))
LOG['garden candidates'] = len(cands)
best = None
gh = float(ghi[2] - glo[2])
LOG['garden candidate scores'] = []
for i, lat, cxy, gz in sorted(cands, key=lambda c: abs(c[0] - gi) + 0.2 * c[1])[:30]:
    lo_ = np.array([cxy[0] - rad * 0.7, cxy[1] - rad * 0.7, gz])
    hi_ = np.array([cxy[0] + rad * 0.7, cxy[1] + rad * 0.7, gz + max(gh, 10)])
    res = V.eval_positions(sc, dg, cl, V.targets(lo_, hi_), (lo_ + hi_) / 2, list(range(0, cl.M, 10)), frozenset())
    ah = [r[1] for r in res]
    run, _st = V.longest_run(ah, 10)
    pct = 100 * sum(ah) / len(ah)
    los = 100 * sum(r[0] for r in res) / len(res)
    sco = run + 2 * pct + los
    LOG['garden candidate scores'].append([int(i), round(float(lat)), [round(float(cxy[0])), round(float(cxy[1]))], round(los, 1), round(pct, 1), run])
    if best is None or sco > best[0]:
        best = (sco, i, lat, cxy, gz, run, pct)
_s, bi, blat, bxy, bgz, brun, bpct = best
g_old = ground_z(gc[0], gc[1])          # old ground height (group still hidden)
V.restore_hidden(_hid)
for o in g_objs:
    o.hide_viewport = False
bpy.context.view_layer.update()
# face the track: the v10 front is -Y; rotate the group about its centre so -Y points at the nearest road point
rd_ = Vector((cl.P[bi][0] - bxy[0], cl.P[bi][1] - bxy[1], 0)).normalized()
alpha = math.atan2(rd_.y, rd_.x) + math.pi / 2
dz = (bgz - g_old) if g_old is not None else 0.0
Mx = Matrix.Translation((bxy[0], bxy[1], dz)) @ Matrix.Rotation(alpha, 4, 'Z') @ Matrix.Translation((-gc[0], -gc[1], 0))
for o in g_objs:
    o.matrix_world = Mx @ o.matrix_world
bpy.context.view_layer.update()
LOG['garden after'] = dict(center=[round(float(bxy[0])), round(float(bxy[1])), round(float(bgz), 1)], station=int(bi), lat=round(opp * blat, 1), yaw_deg=round(math.degrees(alpha), 1),
                           dz=round(float(dz), 1), planned_run_m=brun, planned_ahead_pct=round(bpct, 1), opposite_side_of_wheel=True)
# fill: sakura + red lanterns around it so the grass reads as a garden
GARD = K.newcoll('V13.1 | garden fill')
tree_data = next(o.data for o in sc.objects if o.name.startswith('V12 sakura lining'))
lan_mesh = bpy.data.meshes.get('V12 lantern')
n_t = n_l = 0
for _k in range(80):
    if n_t >= 16:
        break
    a = rnd.uniform(0, math.tau)
    rr = rad + rnd.uniform(4, 20)
    x, y = bxy[0] + math.cos(a) * rr, bxy[1] + math.sin(a) * rr
    if kd.find((x, y, 0))[2] < 18:
        continue
    gz = ground_z(x, y)
    if gz is None:
        continue
    ob = bpy.data.objects.new(f'V13.1 garden sakura {n_t}', tree_data)
    ob.location = (x, y, gz)
    ob.rotation_euler.z = rnd.uniform(0, math.tau)
    s_ = rnd.uniform(0.85, 1.2)
    ob.scale = (s_, s_, s_)
    GARD.objects.link(ob)
    n_t += 1
for _k in range(100):
    if n_l >= 26:
        break
    a = rnd.uniform(0, math.tau)
    rr = rad * 0.55 + rnd.uniform(2, 12)
    x, y = bxy[0] + math.cos(a) * rr, bxy[1] + math.sin(a) * rr
    if kd.find((x, y, 0))[2] < 16:
        continue
    gz = ground_z(x, y)
    if gz is None:
        continue
    bp = bmesh.new()
    K.box(bp, (x, y, gz), 0.1, 0.1, 2.0, 0, 0)
    K.to_obj(f'V13.1 garden lantern post {n_l}', bp, [K.mat('V12 pylon pole', (0.03, 0.03, 0.035), 0.5, metal=0.8)], GARD)
    ob = bpy.data.objects.new(f'V13.1 garden red lantern {n_l}', lan_mesh)
    ob.location = (x, y, gz + 2.2)
    GARD.objects.link(ob)
    n_l += 1
K.new_light('V13.1 garden warm wash', 'AREA', Vector((bxy[0], bxy[1], bgz + 14)), 40000, (1.0, 0.7, 0.45), size=24, coll=GARD)
LOG['garden fill'] = dict(sakura=n_t, lanterns=n_l)
# cameras: driver height on the road facing the garden, and from the wheel side looking across the road
gcen = Vector((bxy[0], bxy[1], bgz + 3))
for nm, loc in (('w_garden_driver', Vector(cl.at(bi - 26, 0, 1.6))), ('x_garden_from_wheel', Vector((wp.x + 18, wp.y + 30, wp.z + 7)))):
    cam = bpy.data.objects.new('V13.1 | ' + nm, bpy.data.cameras.new(nm))
    sc.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (gcen - loc).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 28
    cam.data.clip_end = 30000
AFTER = CK.run('v13_1')
LOG['clearance'] = dict(violators=AFTER['violators'], names=[r['name'] for r in AFTER['list']], checked=AFTER['checked'])
LOG['garden_temple visibility before (v13)'] = json.load(open(O / 'visibility-v13.json'))['garden_temple']
LOG['garden_temple visibility after'] = V.measure(sc, cl, names=['garden_temple'])['garden_temple']
