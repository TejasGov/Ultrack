"""The lake and the wind farm, exec'd by build_qingshan.py after the hall. The ground already dips under the lake (height(), build_qingshan.py).
    water      one flat mesh named 'water', which the game turns into its rippled water material (main.js)
    shore      a muddy band with weeds and low trees, never a clean edge
    turbines   five, hand-built at the size of a real 3 MW machine (80 m hub, 104 m rotor), rotors separate objects pivoting at the hub so the game can turn them. No aviation lights: nothing blinks."""
MAT.update({'water': material('QS | lake', (.012, .035, .045), .08), 'shore': material('QS | shore mud', tex='coast_sand_01', vcol=True), 'paint': material('QS | turbine paint', tex='white_stucco'), 'tconc': material('QS | turbine plinth', tex='concrete_wall_009')})
UVS.update({'shore': 5.0, 'paint': 26.0, 'tconc': 4.0})
# ---- water, reaching a few metres past the polygon so the ground closes over its edge
LKc = LK.mean(0); bm = bmesh.new(); outl = LK[::2]
vs = [bm.verts.new((float(x + (x - LKc[0]) * .0), float(y), LEVEL)) for x, y in outl]; f = bm.faces.new(vs); f.normal_update()
if f.normal.z < 0: f.normal_flip()
bmesh.ops.triangulate(bm, faces=[f], ngon_method='EAR_CLIP'); mesh_obj('water', bm, ['water'], planar=False)
# ---- the shore: mud from just under the water to a few metres up the bank, with its edge wandering
bm = bmesh.new(); vc = vcol_layer(bm); n_ = len(outl); ring = []
for i_, (x, y) in enumerate(outl):
    a, b = outl[(i_ + 1) % n_], outl[i_ - 1]; tx, ty = a[0] - b[0], a[1] - b[1]; l_ = math.hypot(tx, ty) + 1e-6; nx, ny = ty / l_, -tx / l_
    if lake_sd(x + nx * 3, y + ny * 3) > 0: nx, ny = -nx, -ny      # outwards
    wob = 3.0 + 3.5 * ss(-.2, .3, fbm(x / 40, y / 40, 2)); ring.append([(x - nx * 2.5, y - ny * 2.5), (x + nx * .6, y + ny * .6), (x + nx * wob, y + ny * wob)])
V_ = [[bm.verts.new((p[0], p[1], max(gz(p[0], p[1]), LEVEL - .3) + (.03 if k else 0))) for k, p in enumerate(r)] for r in ring]
for i_ in range(n_):
    a, b = V_[i_], V_[(i_ + 1) % n_]
    for k in range(2):
        f = bm.faces.new((a[k], b[k], b[k + 1], a[k + 1])); f.smooth = True
        for l in f.loops: t_ = 0.62 if l.vert in (a[0], b[0]) else .78 if l.vert in (a[1], b[1]) else .95; l[vc] = (t_, t_ * .96, t_ * .82, 1)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
for f in bm.faces:
    if f.normal.z < 0: f.normal_flip()
mesh_obj('QS lake shore', bm, ['shore'], smooth=True)
# weeds and low trees on the bank, in drifts
reeds = 0
for i_, (x, y) in enumerate(outl):
    if fbm(x / 55, y / 55 + 3, 2) < -.05: continue
    for _ in range(2):
        p = ring[i_][2]; qx, qy = p[0] + RNG.uniform(-3, 3), p[1] + RNG.uniform(-3, 3)
        if near(qx, qy)[1] < 28: continue
        place(MASTER[f'SHRUB {RNG.randint(4, 7)}'], qx, qy, RNG.uniform(1.3, 2.2)); reeds += 1
    if RNG.random() < .12 and near(p[0], p[1])[1] > 32: place(MASTER['TREE island_tree_02 LOD1'], p[0] + RNG.uniform(1, 6), p[1], RNG.uniform(4, 8) / 3.41); reeds += 1
log('lake shore', n_, 'weeds', reeds)

# ---- turbines
HUB_Z, ROTOR_R = 80.0, 52.0
def blade(bm, phase):
    """one blade along +z from the hub, swept and twisted as a real one is, flat at the tip"""
    rows = []; ca, sa = math.cos(phase), math.sin(phase)
    for t in (0, .04, .1, .2, .32, .46, .6, .74, .87, 1.0):
        r = 1.0 + (ROTOR_R - 1.0) * t; chord = (1.7 + 2.6 * ss(0, .16, t)) * (1 - ss(.16, 1, t) ** .8 * .92) if t > 0 else 1.7; thick = max(chord * (.75 - .55 * ss(0, .2, t)), .12); tw = math.radians(16 * (1 - t) ** 1.5); ring_ = []
        for a_ in range(6):
            th = 2 * math.pi * a_ / 6; x_, y_ = chord / 2 * math.cos(th), thick / 2 * math.sin(th); xr, yr = x_ * math.cos(tw) - y_ * math.sin(tw), x_ * math.sin(tw) + y_ * math.cos(tw)
            ring_.append(bm.verts.new((xr * ca + r * sa, yr + .3 * t, -xr * sa + r * ca)))
        rows.append(ring_)
    for a, b in zip(rows, rows[1:]):
        for k in range(6): f = bm.faces.new((a[k], a[(k + 1) % 6], b[(k + 1) % 6], b[k])); f.smooth = True
    bm.faces.new(rows[-1])
bm = bmesh.new()
for k in range(3): blade(bm, 2 * math.pi * k / 3)
ct = Vector((0, -1.8, 0)); Ko = Kit(Matrix.Identity(4)); Ko.b['paint'] = bm
Ko.tube('paint', [Vector((0, y_, 0)) for y_ in (-3.6, -3.0, -1.9, -.6, .4, 1.2)], lambda t: (.05, 1.0, 1.6, 1.95, 1.95, 1.4)[min(5, int(round(t * 5)))], n=12)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); ROTOR = mesh_obj('QS rotor', bm, ['paint'], planar=True)
face_px = (-.6, -.8); TR = {}; HUBS = {}
for name, px in STATS['shapes']['TURB'].items():
    wx, wy = (MM @ Vector((px[0] * kk, -px[1] * kk, 0))).to_2d(); ax, ay = (MM @ Vector(((px[0] + face_px[0]) * kk, -(px[1] + face_px[1]) * kk, 0))).to_2d(); yaw = math.atan2(ay - wy, ax - wx) + math.pi / 2; g = gz(wx, wy)
    W_ = Matrix.Translation((wx, wy, g)) @ Matrix.Rotation(yaw, 4, 'Z'); K_ = Kit(W_)
    K_.cyl('tconc', (0, 0, -.6), 5.2, 4.8, 1.6, n=20); K_.cyl('paint', (0, 0, .9), 2.3, 1.25, HUB_Z - 1.0, n=20)
    K_.tube('paint', [Vector((0, y_, HUB_Z + .2)) for y_ in (6.2, 5.2, 2.0, -1.0, -3.2, -3.8)], lambda t: (.2, 1.7, 2.05, 2.05, 1.7, 1.2)[min(5, int(round(t * 5)))], n=10)      # the nacelle, its nose towards the wind
    for k_, b_ in K_.b.items(): mesh_obj(f'QS turbine {name} {k_}', b_, [k_], planar=True, smooth=False)
    hub = W_ @ Vector((0, -3.9, HUB_Z + .2)); r_ = bpy.data.objects.new(f'turbine_{name}_rotor', ROTOR.data); VIS.objects.link(r_); r_.location = hub; r_.rotation_euler = (0, 0, yaw); r_.rotation_mode = 'ZXY'; r_.rotation_euler = (0, RNG.uniform(0, 2.1), yaw); TR[name] = (round(wx), round(wy)); HUBS[name] = hub.copy()
bpy.data.objects.remove(ROTOR, do_unlink=True); log('turbines', TR)      # shortcut: rotors share one mesh here; the game export gives each its own node so venue/qingshan.js can turn them
