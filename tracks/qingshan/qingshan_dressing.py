"""Everything else on the plan, exec'd by build_qingshan.py after the arena: the solar field, the pits, the wind farm's buildings, and the race furniture the other tracks have (start gantry, distance boards, tyre walls, hoardings, catch fence, a rubbered line, brake marks). Real sets throughout; generated art only for signs and tyre sheets.
Llano's sheets are reused as they are: start lights, 300/200/100 boards, sponsors (the same marks as the other tracks' boards), rubber, skid, fence."""
LT = ROOT / 'tracks' / 'llano' / 'tex'
def sheet(name, png, rough=.6, mode=None, spec=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(png); nt.links.new(it.outputs['Color'], P.inputs['Base Color']); P.inputs['Roughness'].default_value = rough
    if mode == 'clip': gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = .5; nt.links.new(it.outputs['Alpha'], gt.inputs[0]); nt.links.new(gt.outputs[0], P.inputs['Alpha'])
    if mode == 'blend': nt.links.new(it.outputs['Alpha'], P.inputs['Alpha']); m.surface_render_method = 'BLENDED'
    return m
sc_ = TX / 'signs.png'
MAT.update({'signs': sheet('QS | signs', sc_, .5), 'boards': sheet('QS | boards', LT / 'signs.png', .5), 'lights': sheet('QS | start lights', LT / 'start_lights.png', .45), 'ads6': sheet('QS | hoardings', TX / 'ads_qs.png', .5), 'tyres': sheet('QS | tyre wall', TX / 'tyres.png', .85), 'rubber': sheet('QS | rubber', LT / 'rubber.png', .75, 'blend'), 'skid': sheet('QS | skid', LT / 'skid.png', .7, 'blend'), 'fence': sheet('M_Fence', LT / 'fence.png', .5, 'clip'),
    'lane': material('QS | pit lane', tex='asphalt_pit_lane', rough=.8), 'shutter': material('QS | garage door', tex='painted_metal_shutter', diff=TX / 'shutter_grey_diff.jpg'), 'pwall': material('QS | pit wall', tex='white_plaster_02'), 'steel': material('QS | steel', (.24, .25, .26), .5, .6), 'cedar': material('QS | cedar', tex='japanese_cedar_planks'), 'sedum': material('QS | green roof', tex='leafy_grass', vcol=False), 'shed': material('QS | shed cladding', tex='painted_metal_shutter'), 'yard': material('QS | yard gravel', tex='gravel_ground_01')})
UVS.update({'lane': 4.0, 'shutter': 3.0, 'pwall': 6.0, 'steel': 3.0, 'cedar': 3.0, 'sedum': 6.0, 'shed': 3.0, 'yard': 4.7})
def solar_material():
    m = bpy.data.materials.new('QS | solar panel'); m.use_nodes = True; nt = m.node_tree; P = nt.nodes['Principled BSDF']; A = ROOT / 'assets' / 'ambientcg' / 'SolarPanel002'
    a = nt.nodes.new('ShaderNodeTexImage'); a.image = image(A / 'SolarPanel002_2K-JPG_Color.jpg'); nt.links.new(a.outputs['Color'], P.inputs['Base Color']); n = nt.nodes.new('ShaderNodeTexImage'); n.image = image(A / 'SolarPanel002_2K-JPG_NormalGL.jpg', True); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], P.inputs['Normal']); r = nt.nodes.new('ShaderNodeTexImage'); r.image = image(A / 'SolarPanel002_2K-JPG_Roughness.jpg', True); nt.links.new(r.outputs['Color'], P.inputs['Roughness']); return m
MAT['solar'] = solar_material()
class Art:
    def __init__(self): self.b = {}
    def bm(self, k):
        if k not in self.b: self.b[k] = bmesh.new()
        return self.b[k]
    def quad(self, k, pts, uv=None):
        b = self.bm(k); f = b.faces.new([b.verts.new(p) for p in pts])
        if uv:
            l_ = b.loops.layers.uv.verify()
            for l, u in zip(f.loops, uv): l[l_].uv = u
    def rect(self, k, p, w, h, right, r):      # a board: p its bottom centre, right the viewer's right, r = u0, u1, v0, v1
        R = Vector((right.x, right.y, 0)).normalized() * (w / 2); Z = Vector((0, 0, h)); self.quad(k, [p - R, p + R, p + R + Z, p - R + Z], [(r[0], r[2]), (r[1], r[2]), (r[1], r[3]), (r[0], r[3])])
    def finish(self):
        for k, b in self.b.items(): mesh_obj(f'QS art {k}', b, [k], planar=False)
ART_ = Art(); Kd = Kit(Matrix.Identity(4))
def s_i(s): return int(round(s / STEP)) % N
def along(i): return T[i].to_3d()
# ---- solar field: real tables on steel racks, rows facing the sun, every table the same mesh, placed as the game will instance it
bm = bmesh.new(); uv = bm.loops.layers.uv.verify(); TW, TD = 7.0, 3.4; tilt = math.radians(25); y1, z1 = TD * math.cos(tilt), .8 + TD * math.sin(tilt)
top = [(-TW / 2, 0, .8), (TW / 2, 0, .8), (TW / 2, y1, z1), (-TW / 2, y1, z1)]; f = bm.faces.new([bm.verts.new(p) for p in top])
for l, u in zip(f.loops, ((0, 0), (2, 0), (2, 1), (0, 1))): l[uv].uv = u
bk = [(-TW / 2, y1, z1 - .06), (TW / 2, y1, z1 - .06), (TW / 2, 0, .74), (-TW / 2, 0, .74)]; f = bm.faces.new([bm.verts.new(p) for p in bk])
for l in f.loops: l[uv].uv = (.02, .02)
me_top = bpy.data.meshes.new('QS solar table'); bm.to_mesh(me_top); bm.free(); me_top.materials.append(MAT['solar'])
Kt = Kit(Matrix.Identity(4))
for x_ in (-2.4, 2.4):
    Kt.box('steel', (x_, y1 * .25, .45), (.08, .08, .9)); Kt.box('steel', (x_, y1 * .75, .9), (.08, .08, 1.8)); Kt.box('steel', (x_, y1 * .5, .8 + TD * math.sin(tilt) * .5 - .1), (.07, y1 + .1, .07))
Kt.box('steel', (0, y1 * .25, 1.05), (TW, .07, .07)); Kt.box('steel', (0, y1 * .75, 1.6), (TW, .07, .07)); rack = None
for k_, b_ in Kt.b.items(): rack = mesh_obj('QS solar rack', b_, [k_], planar=True)
SOL = bpy.data.collections.new('solar'); VIS.children.link(SOL); nt_ = 0; south = (MM @ Vector((0, -1, 0))).to_2d() - (MM @ Vector((0, 0, 0))).to_2d()
yaw_s = math.atan2(south.y, south.x) + math.pi / 2
for a_, b_, c_, d_ in STATS['solar_plan']:
    for py in np.arange(b_ + 4, d_ - 2, 7.6 / kk):
        for px_ in np.arange(a_ + 3.6 / kk, c_ - 3.0 / kk, 7.2 / kk):
            w_ = MM @ Vector((float(px_) * kk, -float(py) * kk, 0)); g_ = gz(w_.x, w_.y)
            for m_ in (me_top, rack.data):
                o_ = bpy.data.objects.new('solar', m_); SOL.objects.link(o_); o_.location = (w_.x, w_.y, g_); o_.rotation_euler = (0, 0, yaw_s + math.pi)
            nt_ += 1
    cw = MM @ Vector(((a_ - 6) * kk, -(b_ + d_) / 2 * kk, 0)); g_ = gz(cw.x, cw.y); Kd.box('steel', (cw.x, cw.y, g_ + 1.1), (2.6, 1.4, 2.2))      # the array's inverter cabinet
bpy.data.objects.remove(rack, do_unlink=True); log('solar tables', nt_)
# ---- pits: inside the bottom straight, facing the main stand; scenery, as on Llano
P0, P1 = -224.0, 150.0; PL0, PL1, PD = 17.0, 29.0, 15.0; PSD = -1; i0, i1 = int(P0 / STEP), int(P1 / STEP); rows = list(range(i0, i1 + 1, 4)); bm = bmesh.new()
for a, b in zip(rows, rows[1:]):
    f = bm.faces.new([bm.verts.new(off(a % N, -PL0, .02)), bm.verts.new(off(a % N, -PL1, .02)), bm.verts.new(off(b % N, -PL1, .02)), bm.verts.new(off(b % N, -PL0, .02))]); f.normal_update()
    if f.normal.z < 0: f.normal_flip()
mesh_obj('QS pit lane', bm, ['lane'], planar=True)
BAYS = 19; BAYL = (P1 - P0) / BAYS; rs_ = lambda s: s_i(s)
for q in range(BAYS):
    s0, s1 = P0 + q * BAYL, P0 + (q + 1) * BAYL; a, b = rs_(s0), rs_(s1)
    d0, d1 = off(rs_(s0 + 1.2), -PL1), off(rs_(s1 - 1.2), -PL1); ART_.quad('shutter', [d1 + Vector((0, 0, .1)), d0 + Vector((0, 0, .1)), d0 + Vector((0, 0, 5.2)), d1 + Vector((0, 0, 5.2))], [(0, 0), ((s1 - s0) / 3, 0), ((s1 - s0) / 3, 1.7), (0, 1.7)])
    p0, p1 = off(rs_(s0), -PL1 - .15), off(rs_(s1), -PL1 - .15); ART_.quad('pwall', [p1 + Vector((0, 0, 5.2)), p0 + Vector((0, 0, 5.2)), p0 + Vector((0, 0, 6.0)), p1 + Vector((0, 0, 6.0))], [(0, 0), (4, 0), (4, .3), (0, .3)])
    g0, g1 = off(rs_(s0), -PL1 - .3, 6.0), off(rs_(s1), -PL1 - .3, 6.0); ART_.quad('glass_', [g1, g0, g0 + Vector((0, 0, 5.2)), g1 + Vector((0, 0, 5.2))]); ART_.quad('pwall', [g1 + Vector((0, 0, 5.2)), g0 + Vector((0, 0, 5.2)), g0 + Vector((0, 0, 5.8)), g1 + Vector((0, 0, 5.8))], [(0, 0), (4, 0), (4, .3), (0, .3)])
    c_ = off(a, -PL1 + .35); Kd.box('pwall', (c_.x, c_.y, c_.z + 5.8), (1.1, 1.1, 11.6))      # a pale fin between bays
MAT['glass_'] = MAT['glass']; mid_i = rs_((P0 + P1) / 2)
for rq in range(0, int((P1 - P0) / 4)):
    a, b = rs_(P0 + rq * 4), rs_(P0 + (rq + 1) * 4)
    f0, f1 = off(a, -PL1 + 1.45, 10.7), off(b, -PL1 + 1.45, 10.7); ART_.quad('pwall', [f1, f0, f0 + Vector((0, 0, 1.25)), f1 + Vector((0, 0, 1.25))], [(0, 0), (1, 0), (1, .3), (0, .3)])      # the roof's pale fascia
    back = [off(a, -PL1 - PD), off(b, -PL1 - PD)]; fr = [off(a, -PL1 - .3), off(b, -PL1 - .3)]; zt_ = Vector((0, 0, 11.4)); ART_.quad('pwall', [back[1] + zt_, back[0] + zt_, back[0], back[1]], [(0, 0), (1, 0), (1, 2), (0, 2)])
    ov = [off(a, -PL1 + 1.4, 11.5), off(b, -PL1 + 1.4, 11.5), off(b, -PL1 - PD - .5, 11.9), off(a, -PL1 - PD - .5, 11.9)]; f_uv = [(0, 0), (1, 0), (1, 1), (0, 1)]; ART_.quad('steel', ov); ov2 = [p + Vector((0, 0, .12)) for p in ov]; ART_.quad('solar', ov2[::-1], [(0, 0), (1, 0), (1, 4), (0, 4)])      # solar on the pit roof too
log('pits', BAYS, 'bays')
# ---- the wind farm's buildings
PK = STATS['shapes']['PINK']
def pk_frame(pts):
    p = np.array(pts, float).mean(0); c = MM @ Vector((p[0] * kk, -p[1] * kk, 0)); j, _d = near(c.x, c.y); to_ = (CL[j] - c); to_.z = 0; y_ = to_.normalized(); x_ = Vector((y_.y, -y_.x, 0)); g = gz(c.x, c.y); return Matrix(((x_.x, y_.x, 0, c.x), (x_.y, y_.y, 0, c.y), (0, 0, 1, g), (0, 0, 0, 1)))
Kv = Kit(pk_frame(PK['Visitor hall']))      # a low timber pavilion with a planted roof and a glass front: the farm's visitor hall
Kv.box('pave', (0, 0, -.2), (70, 44, .6)); Kv.box('cedar', (0, -6, 3.0), (54, 18, 6.0)); Kv.box('glass', (0, 3.4, 2.8), (52, .3, 5.2))
for q in range(14): Kv.box('cedar', (-26 + q * 4, 5.0, 3.0), (.34, .34, 6.0))
Kv.box('sedum', (0, -3, 6.25), (60, 28, .5)); Kv.box('steel', (0, 11, 6.05), (60.4, .3, .4))
Ks_ = Kit(pk_frame(PK['Substation']))     # a fenced transformer yard
Ks_.box('yard', (0, 0, -.05), (36, 58, .3))
for q, y_ in enumerate((-16, 2, 18)):
    Ks_.box('tconc', (-6, y_, .25), (7, 6, .5)); Ks_.box('steel', (-6, y_, 2.2), (5, 3.6, 3.4))
    for f_ in range(-2, 3): Ks_.box('steel', (-6 + f_ * .9, y_ + 2.15, 2.1), (.1, .6, 2.8)); Ks_.box('steel', (-6 + f_ * .9, y_ - 2.15, 2.1), (.1, .6, 2.8))
    for x_ in (2, 10):
        Ks_.box('steel', (x_, y_ - 3, 5), (.25, .25, 10)); Ks_.box('steel', (x_, y_ + 3, 5), (.25, .25, 10)); Ks_.box('steel', (x_, y_, 10), (.25, 6.4, .25))
Ks_.box('pwall', (-12, -24, 2.0), (9, 7, 4.0)); Ks_.box('steel', (-12, -24, 4.1), (9.6, 7.6, .2))
for sx, sy, w_, d_ in ((0, 29, 36, .06), (0, -29, 36, .06), (18, 0, .06, 58), (-18, 0, .06, 58)): Ks_.box('steel', (sx, sy, 1.9), (w_, d_, .08)); Ks_.box('steel', (sx, sy, .6), (w_, d_, .08))
for px, py, n, L in perimeter(18, 29, 4.0): Ks_.box('steel', (px, py, 1.1), (.09, .09, 2.2))
Kh = Kit(pk_frame(PK['Service shed']))     # a plain steel shed
Kh.box('tconc', (0, 0, .1), (24, 32, .3)); Kh.box('shed', (0, 0, 3.4), (20, 28, 6.4)); Kh.box('shutter', (0, 14.03, 2.6), (7, .1, 4.8)); bmr = Kh.bm('steel')
for x_, z_ in ((0, 7.9),): Kh.box('steel', (x_, 0, 6.9), (21, 29, .25))
for K_, nm in ((Kv, 'visitor'), (Ks_, 'substation'), (Kh, 'shed')):
    for k_, b_ in K_.b.items(): mesh_obj(f'QS {nm} {k_}', b_, [k_], planar=True)
# ---- start gantry: a real truss across the road, with Llano's start lights and the circuit's name
def gantry(s, lights=False, sign=(0, 1, .5, 1)):
    i = s_i(s); ca, cn, Zv = T[i].to_3d(), NL[i], Vector((0, 0, 1)); hw_ = max(BD[1][i], BD[-1][i]) + 1.0; base = CL[i]; f0 = base + cn * hw_; f1 = base - cn * hw_; W_ = lambda lat, up, fw=0.0: base + cn * lat + Zv * up + ca * fw
    for sd_ in (1, -1):
        c_ = W_(sd_ * hw_, 4.8); Kd.box('steel', (c_.x, c_.y, c_.z), (.7, .7, 9.6))
    pts = lambda lat, up, fw: W_(lat, up, fw)
    for up in (7.2, 9.0):
        for fw in (-.55, .55): Kd.tube('steel', [W_(-hw_, up, fw), W_(hw_, up, fw)], .09, n=5)
    n_ = int(2 * hw_ / 1.8)
    for q in range(n_):
        l0, l1 = -hw_ + q * 1.8, -hw_ + (q + 1) * 1.8
        for fw in (-.55, .55):
            Kd.tube('steel', [W_(l0, 7.2, fw), W_(l1, 9.0, fw)], .045, n=4); Kd.tube('steel', [W_(l1, 7.2, fw), W_(l1, 9.0, fw)], .045, n=4)
        Kd.tube('steel', [W_(l1, 9.0, -.55), W_(l1, 9.0, .55)], .04, n=4)
    right = -NL[i]
    if lights: ART_.rect('lights', W_(0, 7.3, -.62), 9.0, 1.39, right, (0, 1, 0, 1))
    ART_.rect('signs', W_(0, 9.2, -.62), 24.0, 3.0, right, sign); Kd.box('steel', (W_(0, 10.75, -.72).x, W_(0, 10.75, -.72).y, W_(0, 10.75, -.72).z), (.2, .2, .1))
gantry(1.0, True); gantry(3300.0, sign=(0, 1, 0, .5))
# ---- distance boards before the big stops, both sides
for c in SRC['corners']:
    if c['entry_kmh'] < 215: continue
    ent = c['at'] - c['radius'] * math.radians(c['turn']) / 2
    for cell, dist in ((0, 300), (1, 200), (2, 100)):
        i = s_i(ent - dist)
        for sd in (1, -1):
            lat_ = BD[sd][i] + 1.6; p = off(i, sd * lat_); p = Vector((p.x, p.y, gz(p.x, p.y))); Kd.box('steel', (p.x, p.y, p.z + .8), (.1, .1, 1.6)); ART_.rect('boards', p + Vector((0, 0, 1.5)) - T[i].to_3d() * .06, 2.8, 1.4, -NL[i], (cell / 4, (cell + 1) / 4, .75, 1.0))
# ---- tyre walls on the outside of the hard stops, a flat sheet in front of the wall (as Llano)
for t in TRAPS:
    if t['n'] not in (1, 2, 3, 4, 8): continue
    sd = t['sd']; s_ = t['a'] + 10
    while s_ < t['b'] - 10:
        i, i2 = s_i(s_), s_i(s_ + 3); p0, p1 = off(i, sd * (BD[sd][i] - .35), .02), off(i2, sd * (BD[sd][i2] - .35), .02); h_ = Vector((0, 0, 1.05)); ART_.quad('tyres', [p0, p1, p1 + h_, p0 + h_] if sd < 0 else [p1, p0, p0 + h_, p1 + h_], [(0, 0), (1, 0), (1, 1), (0, 1)]); s_ += 3
# ---- hoardings on posts behind the wall, along the two straights and the bottom of the stack: quiet, far apart
ADQ = 12
def r6(q): q %= ADQ; return 0, 1, 1 - (q + 1) / ADQ, 1 - q / ADQ
def hoardings(s0, s1, sd, gap):
    s_ = s0; q = 0
    while s_ < s1:
        i = s_i(s_)
        if not RAIL[sd][i] and not (sd == 1 and 395 < s_ % LAP < 480):      # never in front of the stone gate
            p = off(i, sd * (BD[sd][i] + .7), .15); p = Vector((p.x, p.y, max(p.z, gz(p.x, p.y) + .1))); right = T[i].to_3d() if sd > 0 else -T[i].to_3d(); ART_.rect('ads6', p, 9.0, 1.5, right, r6(q))
            for off_ in (-3.6, 3.6): v_ = p + right * off_ - Vector(NL[i]) * sd * -.12; Kd.box('steel', (v_.x, v_.y, v_.z + .4), (.08, .08, 1.2))
        s_ += gap; q += 3
hoardings(LAP - 300, LAP + 620, 1, 42); hoardings(3260, 3990, 1, 62); hoardings(2200, 2560, 1, 75); hoardings(4780, 5300, 1, 62); hoardings(5330, 5500, 1, 42)
# on the stands' fronts and the pit fascia: the sponsors' run past the crowd
def stand_boards(A_, B_, n_, q0):
    A_, B_ = Vector((A_[0], A_[1], 0)), Vector((B_[0], B_[1], 0)); mid = (A_ + B_) / 2; j_, _d = near(mid.x, mid.y); road_ = (CL[j_] - mid); road_.z = 0; t_ = (B_ - A_).normalized(); ny = Vector((-t_.y, t_.x, 0))
    if ny.dot(road_) < 0: ny = -ny
    right = -ny.cross(Vector((0, 0, 1)))      # a driver on the road looks along -ny: their right, so the marks read the right way round
    L_ = (B_ - A_).length
    for q in range(n_):
        c_ = A_ + (B_ - A_) * ((q + .5) / n_) + ny * -13.2; g_ = gz(c_.x, c_.y) + .1; ART_.rect('ads6', Vector((c_.x, c_.y, g_)), L_ / n_ * .92, 2.0, right, r6(q0 + q))
for name_, line_ in FRONTS.items():
    wl_ = [WP_(p) for p in line_]
    for k_, (a_, b_) in enumerate(zip(wl_, wl_[1:])): stand_boards(a_, b_, max(2, int(np.linalg.norm(np.array(b_) - np.array(a_)) // 26)), k_ * 3)
for q in range(0, BAYS, 2):      # along the pit fascia
    s0_ = P0 + (q + .5) * BAYL; i = s_i(s0_); p = off(i, -PL1 + 1.5, 10.75); ART_.rect('ads6', p, 13.0, 1.1, -T[i].to_3d(), r6(q // 2))
exec(compile((H / 'qingshan_decor.py').read_text(encoding='utf8'), str(H / 'qingshan_decor.py'), 'exec'))
# ---- catch fence in front of the stands
STANDSD = np.maximum.reduce([SD['North block / stand'], SD['Corner stand'], SD['Main stand']]); fn = 0
for sd in (1, -1):
    for i in range(0, N, 2):
        p = off(i, sd * BD[sd][i]); inside = xs_[0] < p.x < xs_[-1] and ys_[0] < p.y < ys_[-1]
        if not inside or sample(STANDSD, p.x, p.y) < -34 or RAIL[sd][i]: continue
        j = (i + 2) % N; a, b = off(i, sd * (BD[sd][i] + .2), 1.15), off(j, sd * (BD[sd][j] + .2), 1.15); h_ = Vector((0, 0, 4.2)); L_ = 2 * STEP; ART_.quad('fence', [a, b, b + h_, a + h_] if sd < 0 else [b, a, a + h_, b + h_], [(0, 0), (L_, 0), (L_, 4.2), (0, 4.2)]); fn += 1
        if i % 4 == 0: Kd.box('steel', (a.x, a.y, a.z + 2.1), (.09, .09, 4.3))
log('fence quads', fn)
# ---- on the road: the rubbered line round the lap, a little to the inside of each corner, and brake marks into the big stops (Llano's method, its sheets)
KS = [sum(K[(q + d) % N] for d in range(-22, 23)) / 45 for q in range(N)]; lat_ = [max(-4.2, min(4.2, KS[q] * 520)) for q in range(N)]
for _ in range(3): lat_ = [sum(lat_[(q + d) % N] for d in range(-14, 15)) / 29 for q in range(N)]
for q in range(0, N, 3):
    a, b = q, (q + 3) % N; ART_.quad('rubber', [off(a, lat_[a] - 2.0, .05), off(b, lat_[b] - 2.0, .05), off(b, lat_[b] + 2.0, .05), off(a, lat_[a] + 2.0, .05)], [(0, 0), (0, 1), (1, 1), (1, 0)])
for c in SRC['corners']:
    if c['entry_kmh'] < 215: continue
    ent = c['at'] - c['radius'] * math.radians(c['turn']) / 2
    for lat in (2.6, -2.6) if c['n'] == 1 else ((2.6 if c['hand'] == 'R' else -2.6),):
        rows = list(range(int((ent - 170) / STEP), int((ent + 6) / STEP), 4))
        for q in range(len(rows) - 1):
            a, b = rows[q] % N, rows[q + 1] % N; t0, t1 = q / (len(rows) - 1), (q + 1) / (len(rows) - 1); ART_.quad('skid', [off(a, lat - 2.4, .06), off(b, lat - 2.4, .06), off(b, lat + 2.4, .06), off(a, lat + 2.4, .06)], [(0, t0), (0, t1), (1, t1), (1, t0)])
ART_.finish()
for k_, b_ in Kd.b.items(): mesh_obj(f'QS race {k_}', b_, [k_], planar=True)
