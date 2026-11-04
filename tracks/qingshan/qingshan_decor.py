"""What makes it Chinese and an energy park (IDENTITY.md), exec'd by qingshan_dressing.py before its art is finished. Real forms, real materials; nothing drawn as decoration.
    china   bamboo, a pagoda over the trees, a lake pavilion on a zigzag walkway, a stone gate, stone columns and bronze urns before the terraces, lantern posts, banners, bilingual corner names
    eco     a timber boardwalk through the reeds, pylons and wires to the hills, a battery store, a wind mast, a 52 m blade on cradles"""
MAT.update({'lantern': material('QS | lantern', (.62, .045, .03), .55), 'bronze': material('QS | bronze', (.16, .13, .07), .42, .85), 'culm': material('QS | bamboo culm', (.30, .42, .13), .55), 'plank': material('QS | boardwalk', tex='weathered_planks'), 'banners': sheet('QS | banners', TX / 'banners.png', .7), 'names': sheet('QS | corner names', TX / 'names.png', .5), 'cont': material('QS | battery store', tex='white_plaster_02'), 'pile': material('QS | piles', (.05, .045, .04), .8)})
UVS.update({'plank': 2.6, 'cont': 5.0, 'bronze': 2.0, 'lantern': 2.0, 'culm': 2.0, 'pile': 2.0, 'tile': 7.0})
def PXW(px, py): v = MM @ Vector((px * kk, -py * kk, 0)); return v
def facing_road(c): j, _d = near(c.x, c.y); f = CL[j] - Vector((c.x, c.y, CL[j].z)); f.z = 0; return f.normalized()
def frame(c, y):
    x = Vector((y.y, -y.x, 0)); return Matrix(((x.x, y.x, 0, c.x), (x.y, y.y, 0, c.y), (0, 0, 1, c.z), (0, 0, 0, 1)))
def clear_trees(c, r):
    n_ = 0
    for ob in list(FOREST.objects):
        if (ob.location.x - c.x) ** 2 + (ob.location.y - c.y) ** 2 < r * r: bpy.data.objects.remove(ob, do_unlink=True); n_ += 1
    return n_
# ---- a concave tiled roof on n sides, its corners lifted: pavilion and pagoda share it
def poly_roof(K, n, r0, r1, z0, h, lift=.9, key='tile', rep=5.0):
    bm_ = K.bm(key); uv_ = bm_.loops.layers.uv.verify(); M_ = K.W; am = 8 * n; rows = []
    for j in range(7):
        t = j / 6; row = []
        for i in range(am):
            a = 2 * math.pi * i / am; c_ = abs(math.cos(n * a / 2)) ** 10; r = (r0 + (r1 - r0) * t) * (1 + .08 * c_ * (1 - t)); z = z0 + h * t ** 1.7 + lift * c_ * (1 - t) ** 1.6; row.append(bm_.verts.new(M_ @ Vector((r * math.cos(a), r * math.sin(a), z))))
        rows.append(row)
    for j in range(6):
        for i in range(am):
            f = bm_.faces.new((rows[j][i], rows[j][(i + 1) % am], rows[j + 1][(i + 1) % am], rows[j + 1][i])); f.smooth = True; r_ = (r0 + r1) / 2
            for l, (a_, b_) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))): l[uv_].uv = (a_ / am * 2 * math.pi * r_ / rep, b_ / 6 * h * 1.8 / rep)
    und = K.bm('beam2'); a = [und.verts.new(M_ @ Vector((r0 * .985 * math.cos(2 * math.pi * i / am) * (1 + .08 * abs(math.cos(n * (2 * math.pi * i / am) / 2)) ** 10), r0 * .985 * math.sin(2 * math.pi * i / am) * (1 + .08 * abs(math.cos(n * (2 * math.pi * i / am) / 2)) ** 10), z0 - .1 + lift * abs(math.cos(n * (2 * math.pi * i / am) / 2)) ** 10))) for i in range(am)]; b = [und.verts.new(M_ @ Vector((r1 * math.cos(2 * math.pi * i / am), r1 * math.sin(2 * math.pi * i / am), z0 - .25))) for i in range(am)]
    for i in range(am): und.faces.new((a[(i + 1) % am], a[i], b[i], b[(i + 1) % am]))
PLN = {'stone', 'paving', 'red', 'wood', 'beam', 'beam2', 'dark', 'gold', 'ridge', 'bronze', 'lantern', 'plank', 'pile', 'cont', 'steel', 'tconc'}
# ---- the pagoda: seven octagonal storeys over the forest, north of the top straight's far end, so it stands above the treeline ahead and to the left as you come down it
c_ = PXW(1120, 92); c_ = Vector((c_.x, c_.y, gz(c_.x, c_.y) - .2)); gone = clear_trees(c_, 26); Kp = Kit(frame(c_, facing_road(c_))); z_ = 0.0; r_ = 11.0
Kp.cyl('stone', (0, 0, z_), 17, 16, 2.2, n=8, smooth=False); Kp.cyl('stone', (0, 0, 2.2), 14, 13.2, 1.2, n=8, smooth=False); z_ = 3.4
for fl in range(7):
    h_ = 6.8 - fl * .34; Kp.cyl('red', (0, 0, z_), r_, r_ * .98, h_, n=8, smooth=False)
    for q in range(8):
        a_ = 2 * math.pi * q / 8; Kp.cyl('red', (r_ * 1.02 * math.cos(a_), r_ * 1.02 * math.sin(a_), z_), .42, .36, h_, n=8); a2 = a_ + math.pi / 8; w_ = r_ * .78; hh = h_ * .62; cx, cy = r_ * .93 * math.cos(a2), r_ * .93 * math.sin(a2); Kp.box('dark', (cx, cy, z_ + hh / 2 + .3), (w_ * abs(math.sin(a2)) + .5, w_ * abs(math.cos(a2)) + .5, hh))
    Kp.cyl('beam', (0, 0, z_ + h_), r_ + .25, r_ + 1.0, 1.05, n=8, smooth=False); poly_roof(Kp, 8, r_ + 3.4, r_ * .72, z_ + h_ + .95, 2.4 - fl * .1, lift=.85); z_ += h_ + 2.3; r_ *= .885
poly_roof(Kp, 8, r_ + 2.4, .35, z_ - .4, 5.2, lift=.8); Kp.cyl('gold', (0, 0, z_ + 4.7), .34, .05, 8.5, n=8)
for q, h_ in enumerate((1.0, 2.6, 4.2)): Kp.tube('gold', [Vector((.0, 0, z_ + 4.7 + h_ - .15)), Vector((.0, 0, z_ + 4.7 + h_)), Vector((.0, 0, z_ + 4.7 + h_ + .15))], lambda t: .22 + .35 * math.sin(t * 3.14), n=8)
Kp.finish('pagoda', PLN); log('pagoda height', round(z_ + 13), 'trees cleared', gone)
# ---- on the lake: a hexagonal pavilion at the end of a zigzag walkway, as Chinese gardens build them. Seen across the water from the top straight and the sweep
pp = PXW(1010, 345); Lv = LEVEL; Ka = Kit(frame(Vector((pp.x, pp.y, Lv)), facing_road(pp))); Ka.cyl('stone', (0, 0, -.3), 8.2, 7.8, 1.4, n=6, smooth=False)
for q in range(6):
    a_ = 2 * math.pi * q / 6; Ka.cyl('red', (6.6 * math.cos(a_), 6.6 * math.sin(a_), 1.1), .24, .2, 4.4, n=8); a2 = a_ + math.pi / 6; cx, cy = 5.9 * math.cos(a2), 5.9 * math.sin(a2); Ka.box('stone', (cx, cy, 1.55), (6.5 * abs(math.sin(a2)) + .25, 6.5 * abs(math.cos(a2)) + .25, .1))
Ka.cyl('beam', (0, 0, 5.5), 6.9, 7.2, .45, n=6, smooth=False); poly_roof(Ka, 6, 9.0, .5, 5.9, 3.8, lift=.8); Ka.cyl('gold', (0, 0, 9.5), .3, .05, 1.5, n=8); Ka.finish('lake pavilion', PLN)
bk = PXW(1000, 278); j_ = [Vector((pp.x, pp.y, 0))]; sgn = 1; da = (bk.to_2d() - pp.to_2d()); nz = int(da.length // 15); perp = Vector((-da.y, da.x)).normalized()
for q in range(1, nz + 1):
    t = q / nz; o_ = pp.to_2d() + da * t + perp * (7 * sgn if q < nz else 0); j_.append(Vector((o_.x, o_.y, 0))); sgn = -sgn
Kw = Kit(Matrix.Identity(4)); bw = Kw.bm('plank')
def walkway(a, b, w=2.2, z=None):
    d_ = (b - a); d_.z = 0; L_ = d_.length
    if L_ < .1: return
    d_ = d_ / L_; n_ = Vector((-d_.y, d_.x, 0)); zz = Lv + 1.05 if z is None else z; f = bw.faces.new([bw.verts.new(p) for p in (Vector((a.x, a.y, zz)) - n_ * w / 2, Vector((b.x, b.y, zz)) - n_ * w / 2, Vector((b.x, b.y, zz)) + n_ * w / 2, Vector((a.x, a.y, zz)) + n_ * w / 2)])
    for sd_ in (1, -1):
        Kw.tube('wood', [Vector((a.x, a.y, zz + 1.0)) + n_ * sd_ * w / 2, Vector((b.x, b.y, zz + 1.0)) + n_ * sd_ * w / 2], .05, n=5); m_ = int(L_ // 2.5)
        for q in range(m_ + 1):
            p = a + d_ * (L_ * q / max(m_, 1)) + n_ * sd_ * w / 2; Kw.box('pile', (p.x, p.y, Lv - 1.0 + (zz + 1.0 - Lv + 1.0) / 2), (.16, .16, zz + 1.0 - Lv + 1.0))
for a, b in zip(j_, j_[1:]): walkway(a, b)
# ---- a wetland boardwalk among the reeds, along the lake's quiet side: a real path for visitors, not a pattern
walk = []
for i_, (x, y) in enumerate(outl):
    if abs(y - pp.y) < 1e9 and lake_sd(x, y) > -1:
        nrm = Vector((float(x - LKc[0]), float(y - LKc[1]))).normalized(); walk.append((i_, Vector((float(x) - nrm.x * 3.5, float(y) - nrm.y * 3.5, 0))))
sel = [w_ for k_, w_ in walk if 40 <= k_ <= 62] or []
for a, b in zip(sel, sel[1:]): walkway(a, b, w=2.0, z=Lv + .85)
log('boardwalk', len(sel), 'points')
for k_, b_ in Kw.b.items(): mesh_obj(f'QS walkways {k_}', b_, [k_], planar=True, smooth=False)
# ---- bamboo: a grove is a dozen tall culms arching outward, feathered with the leaves of the scanned trees. Its own mesh, placed like the forest
leafm = next(m for m in MASTER['TREE tree_small_02 LOD0'].materials if m and 'leaves' in m.name); rb = random.Random(31); bm = bmesh.new(); uv = bm.loops.layers.uv.verify(); col = bm.loops.layers.float_color.new('Col')
for q in range(13):
    a_ = rb.uniform(0, 6.283); r0 = rb.uniform(.1, 1.9); ox, oy = r0 * math.cos(a_), r0 * math.sin(a_); hh = rb.uniform(11, 17); bend = rb.uniform(1.2, 3.8); pts = [Vector((ox + math.cos(a_) * bend * t ** 2.2, oy + math.sin(a_) * bend * t ** 2.2, hh * t)) for t in (0, .25, .5, .75, 1)]; rings = []
    for i, p in enumerate(pts):
        rr = .075 * (1 - .75 * i / 4); rings.append([bm.verts.new(p + Vector((rr * math.cos(2 * math.pi * k / 4), rr * math.sin(2 * math.pi * k / 4), 0))) for k in range(4)])
    for a, b in zip(rings, rings[1:]):
        for k in range(4):
            f = bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k])); f.material_index = 0; f.smooth = True
            for l in f.loops: l[col] = (1, 1, 1, 1)
    for c in range(13):
        t = rb.uniform(.42, 1.0); p = Vector((ox + math.cos(a_) * bend * t ** 2.2, oy + math.sin(a_) * bend * t ** 2.2, hh * t)); b_ = rb.uniform(0, 6.283); s_ = rb.uniform(.8, 1.35); u = Vector((math.cos(b_), math.sin(b_), rb.uniform(-.5, -.05))).normalized(); v = u.cross(Vector((0, 0, 1))).normalized(); cen = p + u * s_ * .8; cell = rb.randrange(16); cu, cv = (cell % 4) / 4, (3 - cell // 4) / 4
        f = bm.faces.new([bm.verts.new(q_) for q_ in (cen - u * s_ - v * s_ * .55, cen + u * s_ - v * s_ * .55, cen + u * s_ + v * s_ * .55, cen - u * s_ + v * s_ * .55)]); f.material_index = 1; f.smooth = True; sh = rb.uniform(.92, 1.25)
        for l, (a2, b2) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uv].uv = (cu + a2 / 4, cv + b2 / 4); l[col] = (sh * .92, sh * 1.1, sh * .6, 1)
BMB = bpy.data.meshes.new('BAMBOO grove'); bm.to_mesh(BMB); bm.free(); BMB.materials.append(MAT['culm']); BMB.materials.append(leafm); MASTER['BAMBOO'] = BMB; nb = 0
def grove(x, y, n_=3, spread=7):
    global nb
    for _ in range(n_):
        x_, y_ = x + RNG.uniform(-spread, spread), y + RNG.uniform(-spread, spread)
        if near(x_, y_)[1] > 19: place(BMB, x_, y_, RNG.uniform(.85, 1.2), zoff=-.1); nb += 1
for q, h_ in enumerate(STATS['shapes']['HALLS']):      # behind and beside each hall
    p_ = np.array(h_, float); cx, cy = p_.mean(0); wd = np.ptp(p_[:, 0]) / 2
    for dx, dy in ((-wd - 12, -6), (wd + 12, -6), (-wd * .6, 38), (0, 42), (wd * .6, 38), (-wd - 16, 22), (wd + 16, 22)):
        w_ = PXW(cx + dx, cy + dy); grove(w_.x, w_.y)
for i in [st(s_) for s_ in range(650, 2100, 36)]:      # drifts at the forest edge through the stack
    sd_ = 1 if fbm(i * STEP / 90, 3.1, 2) > 0 else -1; p = off(i, sd_ * (BD[sd_][i] + RNG.uniform(3, 8)))
    if to_tree(p.x, p.y) < 15: grove(p.x, p.y, 2, 5)
log('bamboo groves', nb)
# ---- lantern posts and banners along the halls' road side, and the stone gate, columns and urns in the courts
Kl = Kit(Matrix.Identity(4))
def lantern(p, s=1.0):
    Kl.tube('lantern', [p + Vector((0, 0, z_ * s)) for z_ in (-.42, -.34, -.18, 0, .18, .34, .42)], lambda t: s * (.16, .36, .48, .52, .48, .36, .16)[min(6, int(round(t * 6)))], n=10); Kl.cyl('gold', (p.x, p.y, p.z + .4 * s), .17 * s, .17 * s, .1 * s, n=8); Kl.cyl('gold', (p.x, p.y, p.z - .5 * s), .17 * s, .17 * s, .1 * s, n=8); Kl.tube('lantern', [p + Vector((0, 0, -.5 * s)), p + Vector((0, 0, -1.05 * s))], lambda t: s * (.06 - .03 * t), n=4)
def post(i, sd_, lat_, banner=None):
    p = off(i, sd_ * lat_); g = gz(p.x, p.y); bs = Vector((p.x, p.y, g)); Kl.cyl('wood', (bs.x, bs.y, g - .2), .11, .09, 6.2, n=8); a_ = T[i].to_3d() * 1.2; Kl.tube('wood', [bs + Vector((0, 0, 5.75)) - a_, bs + Vector((0, 0, 5.75)) + a_], .05, n=5)
    for sg in (-1, 1): lantern(bs + Vector((0, 0, 5.1)) + a_ * sg * .85)
for s_ in range(120, 560, 22): post(st(s_), 1, BD[1][st(s_)] + 2.2)
def banner_pole(i, sd_, lat_, cell):
    p = off(i, sd_ * lat_); g = gz(p.x, p.y); bs = Vector((p.x, p.y, g)); Kl.cyl('steel', (bs.x, bs.y, g - .2), .07, .05, 9.4, n=6); right = T[i].to_3d() if sd_ > 0 else -T[i].to_3d(); Kl.tube('steel', [bs + Vector((0, 0, 9.0)), bs + Vector((0, 0, 9.0)) + right * 1.5], .03, n=4); ART_.rect('banners', bs + Vector((0, 0, 3.0)) + right * .78, 1.45, 5.9, right, (cell / 4, (cell + 1) / 4, 0, 1))
for q, s_ in enumerate(range(131, 560, 44)): banner_pole(st(s_), 1, BD[1][st(s_)] + 2.2, q % 4)
for q, s_ in enumerate(range(-200, 140, 34)): banner_pole(st(LAP + s_), -1, 13.2, (q + 2) % 4)
for k_, b_ in Kl.b.items(): mesh_obj(f'QS lanterns {k_}', b_, [k_], planar=True, smooth=False)
for q, cp in enumerate(STATS['shapes']['HALLS'][:2]):      # in front of the terraces: a pair of stone columns each, a bronze urn on a stone drum
    p_ = np.array(cp, float).mean(0); c_ = PXW(p_[0], p_[1]); y_ = facing_road(c_); c_.z = gz(c_.x, c_.y) + .25; sc__ = 1.0 if q == 0 else .72; Kc = Kit(frame(c_, y_)); fr = 40 * sc__
    for sx in (-1, 1):
        x_ = sx * 18 * sc__; Kc.box('stone', (x_, fr - 6, .4), (3.4, 3.4, .8)); Kc.cyl('stone', (x_, fr - 6, .8), .78, .6, 9.5, n=8, smooth=False); Kc.box('stone', (x_, fr - 6, 7.8), (4.0, .22, .95)); Kc.cyl('stone', (x_, fr - 6, 10.3), .95, .95, .4, n=12); Kc.tube('stone', [Vector((x_, fr - 6, 10.7)), Vector((x_, fr - 6, 11.1)), Vector((x_, fr - 6, 11.6))], lambda t: .62 - .3 * t, n=8)      # the carved column before a palace, plain
    for sx in (-1, 1):
        x_ = sx * 9 * sc__; Kc.cyl('stone', (x_, fr - 11, 0), .95, .85, .9, n=10, smooth=False); bz = 1.0; Kc.tube('bronze', [Vector((x_, fr - 11, bz + z2)) for z2 in (0, .35, .75, 1.1, 1.35)], lambda t: (.32, .68, .82, .72, .44)[min(4, int(round(t * 4)))], n=14); Kc.cyl('bronze', (x_, fr - 11, bz + 1.32), .56, .62, .1, n=14)
    Kc.finish(f'court {q}', PLN)
# the stone gate: three bays, plain pillars, a tiled top, standing over the walk into the first hall's court
p_ = np.array(STATS['shapes']['HALLS'][0], float).mean(0); c_ = PXW(p_[0], p_[1]); y_ = facing_road(c_); j_c = c_ + y_ * 33; g_c = Vector((j_c.x, j_c.y, gz(j_c.x, j_c.y) + .2)); Kg = Kit(frame(g_c, y_))
for x_, w_ in ((-8.5, 1.1), (-3.0, 1.1), (3.0, 1.1), (8.5, 1.1)): Kg.box('stone', (x_, 0, 4.2), (w_, w_, 8.4)); Kg.box('stone', (x_, 0, .5), (w_ + .8, w_ + 1.6, 1.0))
Kg.box('stone', (0, 0, 7.4), (6.0, .7, 1.0)); Kg.box('stone', (0, 0, 8.7), (19.2, .7, .9)); Kg.box('beam2', (0, 0, 7.4), (4.6, .74, .55))
for x_, w_, z_b in ((0, 7.4, 9.4), (-6.0, 6.0, 8.9), (6.0, 6.0, 8.9)):
    Kg.box('wood', (x_, 0, z_b + .35), (w_, 1.0, .7)); bmx = Kg.bm('tile'); uvx = bmx.loops.layers.uv.verify()
    for sg in (-1, 1):
        q_ = [Vector((x_ - w_ / 2 - .7, sg * 1.6, z_b + .55)), Vector((x_ + w_ / 2 + .7, sg * 1.6, z_b + .55)), Vector((x_ + w_ / 2 + .2, 0, z_b + 1.65)), Vector((x_ - w_ / 2 - .2, 0, z_b + 1.65))]; f = bmx.faces.new([bmx.verts.new(Kg.W @ p) for p in (q_ if sg < 0 else q_[::-1])])
        for l, (u_, v_) in zip(f.loops, ((0, 0), (1.3, 0), (1.3, .3), (0, .3))): l[uvx].uv = (u_, v_)
    Kg.box('ridge', (x_, 0, z_b + 1.72), (w_ + .7, .3, .28))
Kg.finish('stone gate', PLN)
# ---- bilingual corner names, on the outside where you can read them on the way in
NM = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 7: 5, 8: 6, 9: 7}
for c in SRC['corners']:
    if c['n'] not in NM: continue
    sd_ = 1 if c['hand'] == 'R' else -1; i = st(c['at'] - c['radius'] * math.radians(c['turn']) / 2 - 42); p = off(i, sd_ * (BD[sd_][i] + 1.8)); p = Vector((p.x, p.y, gz(p.x, p.y))); cell = NM[c['n']]; cu, cv = (cell % 2) / 2, (3 - cell // 2) / 4
    for off_ in (-2.4, 2.4): v_ = p + NL[i] * off_; Kd.box('steel', (v_.x, v_.y, v_.z + 1.5), (.1, .1, 3.0))
    ART_.rect('names', p + Vector((0, 0, 1.3)) - T[i].to_3d() * .06, 7.2, 1.8, -NL[i], (cu, cu + .5, cv, cv + .25))
# ---- the energy park's working parts, by the substation and the visitor hall
fv = pk_frame(PK['Visitor hall']); Ke = Kit(fv)      # a real blade on cradles, for visitors: 52 m long, flat on the grass
bb = bmesh.new(); blade(bb, math.pi / 2); bmesh.ops.recalc_face_normals(bb, faces=bb.faces[:])
for f in bb.faces: f.smooth = True
BL = bpy.data.meshes.new('QS blade on show'); bb.to_mesh(BL); bb.free(); BL.materials.append(MAT['paint']); ob_ = bpy.data.objects.new('QS blade on show', BL); VIS.objects.link(ob_); ob_.matrix_world = fv @ Matrix.Translation((-26, 30, 3.2))
for x_ in (-20, 2, 18): Ke.box('steel', (x_, 30, 1.3), (1.2, 2.8, 2.6))
Ke.box('tconc', (-1, 30, .1), (58, 9, .3))
for k_, b_ in Ke.b.items(): mesh_obj(f'QS blade stands {k_}', b_, [k_], planar=True)
fs = pk_frame(PK['Substation']); Kb = Kit(fs)      # the battery store: rows of white containers on a slab, beside the yard
Kb.box('tconc', (34, 0, -.05), (22, 60, .3))
for rw, x_ in enumerate((27.5, 40.5)):
    for q in range(6): Kb.box('cont', (x_, -24 + q * 9.6, 1.45), (7.0, 8.4, 2.9)); Kb.box('steel', (x_, -24 + q * 9.6, 3.0), (2.0, 1.4, .3))
Kb.box('steel', (-30, 10, 30), (.5, .5, 60))      # the wind mast: a thin lattice-free steel mast with its booms
for z_ in (20, 40, 60): Kb.box('steel', (-30, 10, z_), (4.2, .08, .08))
for k_, b_ in Kb.b.items(): mesh_obj(f'QS battery store {k_}', b_, [k_], planar=True)
# pylons from the substation, west over the forest to the hills. Wires are heavy enough not to shimmer
Kpy = Kit(Matrix.Identity(4)); P_ = STATS['shapes']['PINK']['Substation']; o0 = np.array(P_, float).mean(0); spans = [(o0[0] - 60, o0[1] + 10), (o0[0] - 260, o0[1] + 25)] + [(o0[0] - 260 - 300 * q, o0[1] + 25 - 12 * q) for q in range(1, 8)]; prev = None
def pylon(c, h=46.0, yaw=0.0):
    W_ = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z'); leg = lambda z_: 4.2 * (1 - z_ / h) ** 1.4 + .5; pts = []
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)): Kpy.tube('steel', [W_ @ Vector((sx * leg(z_), sy * leg(z_), z_)) for z_ in (0, h * .25, h * .5, h * .75, h)], .16, n=4)
    for z_ in np.linspace(5, h - 4, 7):
        l_ = leg(z_); l2 = leg(z_ + 5.5)
        for a_, b_ in (((1, 1), (-1, 1)), ((-1, 1), (-1, -1)), ((-1, -1), (1, -1)), ((1, -1), (1, 1))): Kpy.tube('steel', [W_ @ Vector((a_[0] * l_, a_[1] * l_, z_)), W_ @ Vector((b_[0] * l2, b_[1] * l2, z_ + 5.5))], .06, n=3)
    arms = []
    for z_, w_ in ((h * .72, 9.0), (h * .86, 7.4), (h - 1.0, 5.8)):
        Kpy.tube('steel', [W_ @ Vector((0, -w_, z_)), W_ @ Vector((0, w_, z_))], .13, n=4)
        for s_ in (-1, 1): arms.append(W_ @ Vector((0, s_ * w_, z_ - 1.5)))
    return arms
gone = 0
for px_, py_ in spans:
    w_ = PXW(px_, py_); g_ = gz(w_.x, w_.y) - .3; c_ = Vector((w_.x, w_.y, g_)); gone += clear_trees(c_, 14) if near(c_.x, c_.y)[1] > 40 else 0
    if near(c_.x, c_.y)[1] < 42: continue
    a_ = pylon(c_)
    if prev:
        for u_, v_ in zip(prev, a_):
            mid = (u_ + v_) / 2 - Vector((0, 0, (u_ - v_).length * .035)); Kpy.tube('steel', [u_, (u_ + mid) / 2 - Vector((0, 0, (u_ - v_).length * .004)), mid, (mid + v_) / 2 - Vector((0, 0, (u_ - v_).length * .004)), v_], .045, n=3)
    prev = a_
for k_, b_ in Kpy.b.items(): mesh_obj(f'QS pylons {k_}', b_, [k_], planar=True, smooth=False)
log('pylons placed; trees cleared for them', gone)
