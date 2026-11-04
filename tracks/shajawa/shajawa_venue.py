"""Shajawa's venue, exec'd by build_shajawa.py after the ground: the two gates, the stands' outer wall, the Gulf sponsors' boards (make_ads.mjs), the catch fence, the start gantry, the screen,
the marshal posts and distance boards, the media centre and the screen, the desert's rocks, scrub, palms and power line, a city on the horizon."""
Z = Vector((0, 0, 1)); RNG = random.Random(11)
st = lambda s: int(round(s / STEP)) % N
def tex_mat(name, png, rough=0.6, clip=False):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(png)
    nt.links.new(it.outputs['Color'], P.inputs['Base Color']); P.inputs['Roughness'].default_value = rough
    if clip:
        gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5; nt.links.new(it.outputs['Alpha'], gt.inputs[0]); nt.links.new(gt.outputs[0], P.inputs['Alpha'])
    return m
MAT.update({
    'ads3': tex_mat('SJ | ads 3x1', H / 'tex' / 'ads_3x1.png', 0.45), 'ads6': tex_mat('SJ | ads 6x1', H / 'tex' / 'ads_6x1.png', 0.45),
    'fence': tex_mat('SJ | fence', ROOT / 'tracks' / 'llano' / 'tex' / 'fence.png', 0.5, clip=True), 'signs': tex_mat('SJ | signs', ROOT / 'tracks' / 'llano' / 'tex' / 'signs.png', 0.6),
    'glass': material('SJ | glass', (0.2, 0.25, 0.3), 0.2), 'white': material('SJ | white wall', tex='brushed_concrete'), 'roofing': material('SJ | roofing', tex='grey_roof_01'), 'dark': material('SJ | dark', (0.012, 0.012, 0.014), 0.8),
    'precast': material('SJ | precast concrete', tex='concrete_wall_009', vcol=True), 'tunnel': material('SJ | gate concrete', tex='brushed_concrete', emit=((0.3, 0.3, 0.28), 0.16)),
    'apron': material('SJ | apron', tex='brushed_concrete'), 'lamp': material('M_LampGate', (0.9, 0.92, 0.95), 0.3, emit=((0.95, 0.96, 1.0), 3.0)),
    'rock': material('SJ | rock', rough=0.95, vcol=True), 'scrub': material('SJ | scrub', rough=0.95, vcol=True),
})
_d = ROOT / 'tracks' / 'infinia' / 'tex'; _nt = MAT['glass'].node_tree; _P = _nt.nodes['Principled BSDF']
_it = _nt.nodes.new('ShaderNodeTexImage'); _it.image = image(_d / 'facade_glass_blue.png'); _nt.links.new(_it.outputs['Color'], _P.inputs['Base Color'])
_ia = _nt.nodes.new('ShaderNodeTexImage'); _ia.image = image(_d / 'facade_glass_blue_arm.png', True); _sp = _nt.nodes.new('ShaderNodeSeparateColor'); _nt.links.new(_ia.outputs['Color'], _sp.inputs['Color']); _nt.links.new(_sp.outputs['Green'], _P.inputs['Roughness']); _nt.links.new(_sp.outputs['Blue'], _P.inputs['Metallic'])
UVS.update({'glass': 7.2, 'white': 4.0, 'roofing': 4.0})
UVS.update({'precast': 6.0, 'tunnel': 3.0, 'apron': 5.0, 'rock': 3.0})
class Sheet:
    """one mesh: faces by material key; planar: world UVs, else the quad's own"""
    def __init__(s, name, planar=True, vcol=False): s.name, s.planar, s.bm, s.keys = name, planar, bmesh.new(), []; s.uv = s.bm.loops.layers.uv.verify(); s.vc = vcol_layer(s.bm) if vcol else None
    def mi(s, k):
        if k not in s.keys: s.keys.append(k)
        return s.keys.index(k)
    def quad(s, pts, k, uv=None, col=None):
        f = s.bm.faces.new([s.bm.verts.new(p) for p in pts]); f.material_index = s.mi(k)
        for j, l in enumerate(f.loops):
            if uv: l[s.uv].uv = uv[j]
            if s.vc: l[s.vc] = col or (1, 1, 1, 1)
        return f
    def box(s, c, size, yaw=0.0, k='steel'):
        before = set(s.bm.faces); box(s.bm, Vector(c), size, yaw, s.mi(k))
        if s.vc:
            for f in set(s.bm.faces) - before:
                for l in f.loops: l[s.vc] = (1, 1, 1, 1)
    def cyl(s, c, r0, r1, h, n=8, k='steel', cap=True): cyl(s.bm, Vector(c), r0, r1, h, n=n, mi=s.mi(k), cap=cap)
    def beam(s, a, b, r, k='steel'):
        a, b = Vector(a), Vector(b); d = (b - a).normalized(); e = d.cross(Z); e = (e if e.length > 1e-3 else Vector((1, 0, 0))).normalized() * r; g = d.cross(e).normalized() * r
        ring_ = (e + g, e - g, -e - g, -e + g)
        for q in range(4): s.quad([a + ring_[q], a + ring_[(q + 1) % 4], b + ring_[(q + 1) % 4], b + ring_[q]], k)
    def done(s):
        if s.bm.faces: return mesh_obj(s.name, s.bm, s.keys, planar=s.planar, smooth=False)
        s.bm.free()
BLD, ART, WALL = Sheet('SJ structures'), Sheet('SJ boards', planar=False), Sheet('SJ outer wall', vcol=True)
def facing(q, toward):
    """the quad's points, wound so its front looks at `toward`"""
    n = (q[1] - q[0]).cross(q[2] - q[0]); return q if n.dot(toward - q[0]) > 0 else q[::-1]

# ---- ad sheets: order as in make_ads.mjs
ADS = ['aramco', 'emirates', 'adnoc', 'saudia', 'stc', 'sabic', 'dpworld', 'aramco2']
def r3(n): q = ADS.index(n); return (q % 2) / 2, (q % 2 + 1) / 2, 1 - (q // 2 + 1) / 4, 1 - (q // 2) / 4
def r6(n): q = ADS.index(n); return 0, 1, 1 - (q + 1) / 8, 1 - q / 8
def panel(c, w, h, f, k, rect, back=True):
    """a flat picture facing f (toward the viewer), its bottom centre at c, reading left to right from there; rect: u0, u1, v0, v1"""
    f = Vector((f.x, f.y, 0)).normalized(); r = Vector((-f.y, f.x, 0)); u0, u1, v0, v1 = rect; a, b = c - r * w / 2, c + r * w / 2
    ART.quad([a, b, b + Z * h, a + Z * h], k, uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    if back: BLD.quad([b - f * 0.3, a - f * 0.3, a - f * 0.3 + Z * h, b - f * 0.3 + Z * h], 'steel')       # 30 cm: closer and the web pack's rounding can bring it through the picture
ROAD_S = lambda i, sd: -NL[i] * sd                       # toward the road, from side sd
TRAFFIC = lambda i: -T[i].to_3d()                        # toward the driver coming down the road
def toward(i, sd, turn=0.45): return (-T[i].to_3d() * math.cos(turn) - NL[i] * sd * math.sin(turn)).normalized()

# ------------------------------------------------------------------------------------------------ the gates: the road under the stand
gaps = []
for a, b, s0, s1 in GATES:
    # the low rows stop at two end walls, stepped as the rows are; a lintel is the upper rows' own front face (build_shajawa.py), wing walls close the void beside the road
    for s_, inward in ((s0, 1), (s1, -1)):
        p, n = path(s_); t_ = Vector((n.y, -n.x, 0)) * inward; pts = [(0.0, -0.2), (0.0, H0)]
        for k in range(K0): d_, h_ = k * TREAD, H0 + k * RISE; pts += [(d_ + TREAD, h_), (d_ + TREAD, h_ + RISE)]
        pts += [(D0G, -0.2)]; poly_ = [p + n * d_ + Z * h_ for d_, h_ in pts]
        f = BLD.bm.faces.new([BLD.bm.verts.new(q) for q in (poly_ if (poly_[1] - poly_[0]).cross(poly_[2] - poly_[0]).dot(t_) > 0 else poly_[::-1])]); f.material_index = BLD.mi('tunnel')
    q_ = s0
    while q_ < s1:
        q2 = min(q_ + 1.0, s1); pa, na = path(q_); pb, nb = path(q2); a_, b_ = pa + na * D0G, pb + nb * D0G
        if near((a_.x + b_.x) / 2, (a_.y + b_.y) / 2)[1] > HW + 2.6: BLD.quad(facing([a_ - Z * 0.2, b_ - Z * 0.2, b_ + Z * CLEAR, a_ + Z * CLEAR], pa - na * 5), 'tunnel')
        for d0_, d1_ in ((-6.0, D0G),):      # the floor of the gap
            BLD.quad(facing([pa + na * d0_ - Z * 0.08, pb + nb * d0_ - Z * 0.08, pb + nb * d1_ - Z * 0.08, pa + na * d1_ - Z * 0.08], pa + Z * 5), 'apron')
        q_ = q2
    # the passage: side walls behind the barrier, a soffit where the rows run over it, one unbroken light line each side (no spaced lamps: no strobe)
    LAT = HW + 2.6
    for i in range(a - 2, b + 2):
        j = (i + 1) % N; i_ = i % N; ri = max(ring(*off(i_, sd_ * LAT).to_2d()) for sd_ in (1, -1)); rj = min(ring(*off(i_, sd_ * LAT).to_2d()) for sd_ in (1, -1))
        if ri < D0G - 2.5 or rj > D1 + 0.6: wall_on = -1.0 < ri and rj < D1 + 0.6
        else: wall_on = True
        if wall_on:
            for sd in (1, -1):
                pa_, pb_ = off(i_, sd * LAT), off(j, sd * LAT); BLD.quad(facing([pa_ - Z * 0.12, pb_ - Z * 0.12, pb_ + Z * CLEAR, pa_ + Z * CLEAR], CL[i_]), 'tunnel')
        if rj > D0G - 2.0 and ri < D1 + 0.6 or (ri > D0G - 0.5 and rj < D1 + 0.6):
            ra, rb = off(i_, LAT + 0.3, CLEAR), off(j, LAT + 0.3, CLEAR); la, lb = off(i_, -LAT - 0.3, CLEAR), off(j, -LAT - 0.3, CLEAR); BLD.quad(facing([ra, rb, lb, la], CL[i_]), 'tunnel')
            for sd in (1, -1) if D0G - 0.5 < ring(*CL[i_].to_2d()) < D1 - 0.5 else ():
                BLD.quad(facing([off(i_, sd * 7.0, CLEAR - 0.04), off(j, sd * 7.0, CLEAR - 0.04), off(j, sd * 7.3, CLEAR - 0.04), off(i_, sd * 7.3, CLEAR - 0.04)], CL[i_]), 'lamp')

# ------------------------------------------------------------------------------------------------ the stands' outer wall: precast panels, a belt at each deck, ribs; what the desert loop sees
PROFW = [(0.2, -0.2), (0.2, 7.0), (0.75, 7.0), (0.75, 7.8), (0.2, 7.8), (0.2, 14.6), (0.75, 14.6), (0.75, 15.4), (0.2, 15.4), (0.2, H1 + 6.0)]
def wall_near_road(s_):
    p, n = path(s_ % PER); q = p + n * (D1 + 0.2); return near(q.x, q.y)[1] < HW + 3.0
s_ = 2 * Lb; rib = col = 0.0
while s_ < PER - 1e-3:       # the main straight's back is the hospitality block and never seen from the road
    arc = s_ < 2 * Lb + math.pi * Rb or s_ >= 4 * Lb + math.pi * Rb; step = 3.0 if wall_near_road(s_) or wall_near_road(s_ + 6) else 6.0; s2 = min(s_ + step, PER)
    pa, na = path(s_); pb, nb = path(s2 % PER if s2 < PER else 0.0); low = CLEAR if wall_near_road((s_ + s2) / 2) else None
    for k in range(len(PROFW) - 1):
        (d0, z0), (d1, z1) = PROFW[k], PROFW[k + 1]
        if low is not None and z1 <= low: continue
        z0 = max(z0, low) if low is not None and d0 == d1 else z0
        t = 0.82 + 0.18 * fbm(s_ / 18, z0 / 6, 2)
        if d0 == d1 and z0 >= 7.8 and z1 <= 14.6: t *= 0.22       # the concourse, in its own shade behind the columns
        WALL.quad(facing([pa + na * (D1 + d0) + Z * z0, pb + nb * (D1 + d0) + Z * z0, pb + nb * (D1 + d1) + Z * z1, pa + na * (D1 + d1) + Z * z1], pa + na * (D1 + 40) + Z * 8), 'precast', col=(t, t, t * 0.97, 1))
    rib += step; col += step; ps, ns = path(s2 % PER)
    if rib >= 24.0:
        rib = 0.0
        if not wall_near_road(s2): WALL.box(ps + ns * (D1 + 0.8) + Z * ((H1 + 5.8) / 2), (1.2, 1.2, H1 + 6.0), math.atan2(ns.y, ns.x), 'precast')
    elif col >= 6.0 and not wall_near_road(s2): WALL.box(ps + ns * (D1 + 0.48) + Z * 11.2, (0.5, 0.5, 6.8), math.atan2(ns.y, ns.x), 'precast')
    if col >= 6.0: col = 0.0
    s_ = s2

# ------------------------------------------------------------------------------------------------ boards: on the wall, on the stands, on the rim, in the desert
def wall_boards(i0, i1, sd, seq=0):
    """the 6:1 boards behind the wall, 2 m high, in sponsors' runs of unequal length"""
    runs = [(2, 'aramco'), (1, 'stc'), (3, 'emirates'), (1, 'sabic'), (2, 'adnoc'), (1, 'dpworld'), (2, 'saudia'), (1, 'stc'), (1, 'aramco2'), (2, 'sabic'), (1, 'emirates'), (2, 'dpworld')]; L_ = 12.0; s_ = i0 * STEP; end = i1 * STEP; k = seq
    while s_ + L_ < end:
        cnt, name = runs[k % len(runs)]
        for _ in range(cnt):
            if s_ + L_ >= end: break
            i = st(s_ + L_ / 2)
            if not CUT_NEAR[i]:
                c = off(i, sd * (BD[sd][i] + 0.75), 0.75); panel(c, L_, 2.0, ROAD_S(i, sd), 'ads6', r6(name))
                BLD.beam(c + NL[i] * sd * 0.45 - Z * 0.8, c + NL[i] * sd * 0.45 + Z * 2.0, 0.05)
            s_ += L_
        k += 1
def catch_fence(i0, i1, sd):
    """the debris fence over the wall, on the spectators' side: posts every 5 m, mesh (Llano's sheet)"""
    s_ = i0 * STEP; end = i1 * STEP
    while s_ < end:
        ia, ib = st(s_), st(s_ + 5.0)
        if not CUT_NEAR[ia]:
            a_, b_ = off(ia, sd * (BD[sd][ia] + 0.42), 2.9), off(ib, sd * (BD[sd][ib] + 0.42), 2.9); L_ = (b_ - a_).length
            ART.quad(facing([a_, b_, b_ + Z * 3.6, a_ + Z * 3.6], CL[ia]), 'fence', uv=[(0, 0), (L_, 0), (L_, 3.6), (0, 3.6)])
            BLD.beam(a_ - Z * 2.9, a_ + Z * 3.75, 0.05); BLD.beam(a_ + Z * 3.6, b_ + Z * 3.6, 0.025)
        s_ += 5.0
def stand_boards(s0, s1, seq=0):
    """the rim: 6:1 boards hung under the roof's lip, 5 m high and readable across the bowl, and on the parapet at the foot of the stands"""
    q = s0; names = ['aramco', 'adnoc', 'emirates', 'saudia', 'stc', 'sabic', 'dpworld', 'aramco2']; k = seq
    if s1 - s0 < 40: return
    while q + 30 < s1:
        p, n = path(q + 15); c = p + n * (D1 - 14.2) + Z * (H1 + 3.0); panel(c, 30.0, 5.0, -n, 'ads6', r6(names[k % 8]))
        k += 1; q += 33
    q = s0; k = seq + 3
    while q + 8.4 < s1:
        p, n = path(q + 4.2); panel(p - n * 0.06 + Z * 0.1, 8.4, 1.4, -n, 'ads6', r6(names[k % 8]), back=False); k += 1 if int(q / 8.4) % 3 == 2 else 0; q += 8.4
def unipole(i, sd, name, w=21.0, h=7.0, z=13.0, pad=9.0):
    p = off(i, sd * (BD[sd][i] + pad)); gz_ = dune_z(p.x, p.y, near(p.x, p.y)[1]); p = Vector((p.x, p.y, gz_ - 0.3)); f = toward(i, sd); r = Vector((-f.y, f.x, 0))
    panel(p + Z * z, w, h, f, 'ads3', r3(name)); mast = p - f * 0.9; BLD.cyl(mast, 0.75, 0.5, z + h * 0.55)
    for t in (0.0, 0.5, 1.0): BLD.beam(p + Z * (z + h * t) - f * 0.2 - r * (w / 2 + 0.1), p + Z * (z + h * t) - f * 0.2 + r * (w / 2 + 0.1), 0.1)
    for x_ in (-w / 2, -w / 4, w / 4, w / 2): BLD.beam(mast + Z * (z - 2.5), p + r * x_ + Z * (z + 0.1) - f * 0.2, 0.09)
    BLD.box(p + Z * (z - 0.3) + f * 0.4, (w + 0.4, 0.9, 0.1), math.atan2(r.y, r.x), 'steel')
def truss(i, z0=7.0, z1=10.0, pad=0.9):
    latl, latr = BD[1][i] + pad, -(BD[-1][i] + pad); tt = T[i].to_3d() * 0.6; pl, pr = off(i, latl), off(i, latr)
    for p_ in (pl, pr):
        for sg in (-1, 1): BLD.beam(p_ + tt * sg, p_ + tt * sg + Z * (z1 + 1), 0.16)
    for sg in (-1, 1):
        for zz in (z0, z1): BLD.beam(pl + tt * sg + Z * zz, pr + tt * sg + Z * zz, 0.1)
    n = max(6, int((latl - latr) / 3))
    for q in range(n):
        a_, b_ = pl.lerp(pr, q / n), pl.lerp(pr, (q + 1) / n)
        for sg in (-1, 1): BLD.beam(a_ + tt * sg + Z * (z0 if q % 2 else z1), b_ + tt * sg + Z * (z1 if q % 2 else z0), 0.05)
# the start: one gantry with the title sponsor across the road; the screen shows sponsors on all four faces
truss(st(40.0)); panel(off(st(40.0), 0, 7.2) - T[st(40.0)].to_3d() * 0.65, 18.0, 3.0, TRAFFIC(st(40.0)), 'ads6', r6('aramco'), back=True)
for a_, nm in zip(range(4), ('aramco', 'emirates', 'adnoc', 'saudia')):
    th = a_ * math.pi / 2; f_ = Vector((math.cos(th), math.sin(th), 0)); panel(Vector((ex, ey, 18.5)) + f_ * 7.78, 15.0, 5.0, f_, 'ads3', r3(nm), back=False)
# ---- round the lap (stations from the plan): the outside of every corner, where the driver looks hardest; the desert's straights are left open but for the giants
I_MAIN1 = st(452.0)
wall_boards(0, I_MAIN1, -1); catch_fence(0, I_MAIN1, -1); wall_boards(0, I_MAIN1, 1, 4)
wall_boards(I_MAIN1, 351, -1, 2); catch_fence(I_MAIN1, 404, -1)                 # the east end, beside the stands
wall_boards(351, 404, -1, 9); wall_boards(358, 404, 1, 6)                       # the back straight
for a_, b_, sd, q_ in ((406, 454, -1, 1), (457, 506, 1, 3), (506, 554, -1, 5), (554, 603, 1, 7), (606, 655, -1, 10), (746, 802, -1, 4), (814, 838, 1, 8), (847, 867, -1, 0), (890, 950, -1, 6), (1010, 1070, -1, 2)):
    wall_boards(a_, b_, sd, q_)
for a, b, s0, s1 in GATES:      # the gate's own banner, hung over the low rows where they stop
    if a < N / 2: pp, nn = path((s0 + s1) / 2); panel(pp + nn * (D0G - 0.25) + Z * 6.4, 24.0, 4.0, -nn, 'ads6', r6('aramco'))
for s0_, s1_ in open_ranges(): stand_boards(s0_ + 3.0, s1_ - 3.0, int(s0_ / 40))
gin = next(g for g in GATES if g[0] > N / 2)       # the gate in, the south-west stand
for j_, sd, nm in ((gin[0] - 150, 1, 'aramco'), (gin[0] - 110, -1, 'emirates'), (gin[0] - 70, 1, 'adnoc'), (gin[0] - 34, -1, 'saudia')): unipole(j_, sd, nm)
for j_, sd, nm in ((748, 1, 'stc'), (808, 1, 'sabic'), (872, 1, 'dpworld'), (1085, -1, 'emirates'), (1040, 1, 'aramco')): unipole(j_, sd, nm)
wall_boards(gin[0] - 112, gin[0] - 26, 1, 2); wall_boards(gin[0] - 100, gin[0] - 26, -1, 7)      # only close to the gate: the desert stays open beyond a bare wall

# ---- what a working circuit has along its road: a marshal's post at each corner, distance boards into the two heavy stops (Llano's sheet: its first cells are 300 200 100)
def rs(q): return (q % 4) / 4, (q % 4 + 1) / 4, 1 - (q // 4 + 1) / 4, 1 - (q // 4) / 4
for j_, sd in ((260, -1), (430, -1), (480, 1), (580, 1), (630, -1), (775, -1), (980, -1), (1305, 1)):
    p = off(j_, sd * (BD[sd][j_] + 3.2)); y_ = HEAD[j_]; BLD.box(p + Z * 1.1, (3.0, 2.6, 2.4), y_, 'white'); BLD.box(p + Z * 2.4, (3.5, 3.1, 0.18), y_, 'roofing')
    BLD.quad(facing([p - T[j_].to_3d() * 1.2 - NL[j_] * sd * 1.32 + Z * 1.0, p + T[j_].to_3d() * 1.2 - NL[j_] * sd * 1.32 + Z * 1.0, p + T[j_].to_3d() * 1.2 - NL[j_] * sd * 1.32 + Z * 1.9, p - T[j_].to_3d() * 1.2 - NL[j_] * sd * 1.32 + Z * 1.9], CL[j_]), 'dark')
    BLD.beam(p + T[j_].to_3d() * 1.3 - NL[j_] * sd * 1.0, p + T[j_].to_3d() * 1.3 - NL[j_] * sd * 1.0 + Z * 4.2, 0.03)
for entry, cells in ((875, ((0, 120), (1, 80), (2, 40))), (406, ((2, 40),)), (554, ((2, 40),)), (1278, ((1, 80), (2, 40)))):
    for cell, back_ in cells:
        i = (entry - back_) % N
        for sd in (1, -1):
            p = off(i, sd * (BD[sd][i] + 1.3))
            if not CUT_NEAR[i]: BLD.beam(p - Z * 0.2, p + Z * 2.0, 0.05); panel(p + Z * 1.6, 2.8, 1.4, TRAFFIC(i), 'signs', rs(cell))

# ---- the media centre beside the garages: a glass block on a stucco base, its roof carrying the plant real ones do
mx, my = gx + 76.0, gy + 2.0
BLD.box((mx, my, 2.2), (46, 18, 4.4), 0.0, 'white'); BLD.box((mx, my, 14.6), (48, 20, 0.5), 0.0, 'white')
for a_, b_, nrm in (((mx - 22, my - 8.6), (mx + 22, my - 8.6), (0, -1)), ((mx + 22, my - 8.6), (mx + 22, my + 8.6), (1, 0)), ((mx + 22, my + 8.6), (mx - 22, my + 8.6), (0, 1)), ((mx - 22, my + 8.6), (mx - 22, my - 8.6), (-1, 0))):
    pa_, pb_ = Vector((*a_, 4.4)), Vector((*b_, 4.4)); L_ = (pb_ - pa_).length; BLD.quad([pa_, pb_, pb_ + Z * 9.9, pa_ + Z * 9.9], 'glass')
for dx, dy, sz in ((-12, -3, (7, 4, 2.2)), (2, 4, (5, 5, 1.8)), (13, -2, (6, 3, 2.6))): BLD.box((mx + dx, my + dy, 14.85 + sz[2] / 2), sz, 0.0, 'steel')
panel(Vector((mx, my - 10.1, 15.0)), 24.0, 4.0, Vector((0, -1, 0)), 'ads6', r6('stc'))
panel(Vector((gx, gy - 7.2, 7.7)), 30.0, 2.5, Vector((0, -1, 0)), 'ads6', r6('emirates'), back=False)        # the garages' long side, toward the main straight
# the sponsors' banners on the outer wall, facing the road on the way out too
for s_, nm in ((4 * Lb + math.pi * Rb - 40.0, 'saudia'), (4 * Lb + math.pi * Rb + 10.0, 'sabic')):
    p, n = path(s_); panel(p + n * (D1 + 0.9) + Z * 18.5, 27.0, 9.0, n, 'ads3', r3(nm), back=False)
# the sponsors' banners on the outer wall, facing the desert
for s_, nm in ((4 * Lb + math.pi * Rb + 70.0, 'aramco'), (4 * Lb + math.pi * Rb + 150.0, 'emirates'), (4 * Lb + math.pi * Rb + 340.0, 'adnoc'), (4 * Lb + math.pi * Rb + 420.0, 'stc')):
    p, n = path(s_); panel(p + n * (D1 + 0.9) + Z * 18.5, 27.0, 9.0, n, 'ads3', r3(nm), back=False)

# ------------------------------------------------------------------------------------------------ the desert's rocks and scrub, and palms at the gates (Infinia's CC BY models)
def blob(bm, c, size, squash, seed, colour, vc, sub=1):
    r = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    for v in r['verts']:
        n = noise.noise(v.co * 1.7 + Vector((seed, seed * 0.3, 0)))
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2] * squash)) * (1 + 0.28 * n) + c
    for f in {f for v in r['verts'] for f in v.link_faces}:
        for l in f.loops: t = 0.9 + 0.2 * RNG.random(); l[vc] = (colour[0] * t, colour[1] * t, colour[2] * t, 1)
rk = bmesh.new(); vr = vcol_layer(rk); sb = bmesh.new(); vs = vcol_layer(sb); nr = ns = 0
for _ in range(6000):
    x, y = RNG.uniform(cx - 1450, cx + 560), RNG.uniform(cy - 620, cy + 660); i, d = near(x, y)
    if d < BD[1][i] + 3 or ring(x, y) < D1 + 6: continue
    gz_ = dune_z(x, y, d)
    if RNG.random() < 0.35 and nr < 220:
        sz = RNG.uniform(0.4, 1.6) * (1 + 1.2 * (RNG.random() < 0.08))
        blob(rk, Vector((x, y, gz_ - sz * 0.25)), (sz * RNG.uniform(0.8, 1.4), sz * RNG.uniform(0.8, 1.3), sz), 0.7, RNG.random() * 50, (0.5, 0.4, 0.31) if RNG.random() < 0.6 else (0.44, 0.39, 0.34), vr); nr += 1
    elif ns < 480:
        sz = RNG.uniform(0.35, 0.8)
        blob(sb, Vector((x, y, gz_ + sz * 0.3)), (sz, sz * RNG.uniform(0.8, 1.2), sz), 0.75, RNG.random() * 50, (0.3, 0.31, 0.17) if RNG.random() < 0.7 else (0.42, 0.38, 0.24), vs); ns += 1
for f in rk.faces: f.material_index = 0
for f in sb.faces: f.material_index = 0
mesh_obj('SJ rocks', rk, ['rock'], planar=False); mesh_obj('SJ scrub', sb, ['scrub'], planar=False)
log('rocks', nr, 'scrub', ns)
def load_model(path_, height=None):
    bpy.ops.import_scene.gltf(filepath=str(path_)); objs = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); out_ = bmesh.new(); mats = []
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); b = bmesh.new(); b.from_mesh(me); b.transform(o.matrix_world)
        for f in b.faces:
            m = o.data.materials[f.material_index] if o.data.materials else None
            if m not in mats: mats.append(m)
            f.material_index = mats.index(m)
        b.to_mesh(me); b.free(); out_.from_mesh(me); bpy.data.meshes.remove(me)
    for o in list(bpy.data.objects):
        if o in objs or o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
    vs_ = [v.co for v in out_.verts]; lo_ = Vector([min(p[d] for p in vs_) for d in range(3)]); hi_ = Vector([max(p[d] for p in vs_) for d in range(3)]); k_ = height / (hi_.z - lo_.z)
    bmesh.ops.transform(out_, matrix=Matrix.Scale(k_, 4) @ Matrix.Translation((-(lo_.x + hi_.x) / 2, -(lo_.y + hi_.y) / 2, -lo_.z)), verts=out_.verts); return out_, mats
palm = load_model(ROOT / 'tracks' / 'infinia' / 'source' / 'palm_lowpoly' / 'palm_lowpoly.glb', height=11.0)
spots = []
for g in GATES:       # an avenue of date palms up to each gate's outer face, behind the walls
    outer = g[0] - 8 if g[0] > N / 2 else g[1] + 8; run = range(outer - 96, outer, 16) if g[0] > N / 2 else range(outer, outer + 96, 16)
    for j_ in run:
        for sd in (1, -1):
            p = off(j_ % N, sd * (BD[sd][j_ % N] + 5.0 + RNG.uniform(-0.6, 0.6))); spots.append((Vector((p.x, p.y, -0.15)), RNG.uniform(0, 6.28), RNG.uniform(0.85, 1.15)))
for q_ in range(9):      # a loose stand of palms round the media centre and the paddock's far end
    x, y = gx + RNG.uniform(-46, 120), gy + RNG.uniform(22, 36) * RNG.choice((1, 1, -1))
    if near(x, y)[1] > 22: spots.append((Vector((x, y, -0.12)), RNG.uniform(0, 6.28), RNG.uniform(0.8, 1.2)))
acc = bmesh.new()
for pos, yaw, sc_ in spots:
    b = palm[0].copy(); b.transform(Matrix.Translation(pos) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Scale(sc_, 4)); me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free(); acc.from_mesh(me); bpy.data.meshes.remove(me)
me = bpy.data.meshes.new('SJ palms'); acc.to_mesh(me); acc.free()
for m in palm[1]:
    if m and not m.name.startswith('SJ palm '): m.name = 'SJ palm ' + m.name
    me.materials.append(m)
VIS.objects.link(bpy.data.objects.new('SJ palms', me)); palm[0].free(); log('palms', len(spots))
# ---- a 132 kV line across the desert north of the loop: steel towers, three wires a side
PWR = [Vector((cx - 1420.0 + q * 190.0, cy + 505.0 + 14.0 * math.sin(q * 1.3), 0)) for q in range(11)]
for k_, base_ in enumerate(PWR):
    gz_ = dune_z(base_.x, base_.y, near(base_.x, base_.y)[1]) - 0.4; b_ = Vector((base_.x, base_.y, gz_)); top_ = b_ + Z * 30.0
    for dx, dy in ((-3, -3), (3, -3), (3, 3), (-3, 3)): BLD.beam(b_ + Vector((dx, dy, 0)), top_ + Vector((dx * 0.18, dy * 0.18, 0)), 0.14)
    for zz, wd in ((18.0, 6.2), (23.0, 5.0), (28.0, 3.8)): BLD.beam(b_ + Z * zz + Vector((0, -wd, 0)), b_ + Z * zz + Vector((0, wd, 0)), 0.12)
    if k_:
        pv = PWR[k_ - 1]; gp = dune_z(pv.x, pv.y, near(pv.x, pv.y)[1]) - 0.4
        for zz, wd in ((18.0, 6.2), (23.0, 5.0), (28.0, 3.8)):
            for sg in (-1, 1): BLD.beam(Vector((pv.x, pv.y + sg * wd, gp + zz - 0.6)), Vector((base_.x, base_.y + sg * wd, gz_ + zz - 0.6)), 0.05)
# ---- a Gulf city on the north-western horizon, 3-4 km out and in the haze: towers of unequal height in two loose clusters, one far taller
rr_ = random.Random(23)
for (ccx, ccy, cnt, rad) in ((cx - 3650.0, cy + 1650.0, 15, 420.0), (cx - 1700.0, cy + 3000.0, 8, 260.0)):
    for q_ in range(cnt):
        x = ccx + rr_.uniform(-rad, rad); y = ccy + rr_.uniform(-rad * 0.5, rad * 0.5); h_ = rr_.uniform(70, 170) * (1.0 if q_ else 2.6); w_ = rr_.uniform(22, 46); gz_ = dune_z(x, y, 900) - 6.0; yaw_ = rr_.uniform(0, 1.5)
        BLD.box((x, y, gz_ + h_ / 2), (w_, w_ * rr_.uniform(0.8, 1.2), h_), yaw_, 'glass')
        if h_ > 110: BLD.box((x, y, gz_ + h_ + 8.0), (w_ * 0.62, w_ * 0.62, 16.0), yaw_, 'glass')
        if h_ > 200: BLD.box((x, y, gz_ + h_ + 32.0), (w_ * 0.34, w_ * 0.34, 40.0), yaw_, 'glass'); BLD.cyl(Vector((x, y, gz_ + h_ + 52.0)), 2.2, 0.3, 46.0, n=6)
for sh in (BLD, ART, WALL): sh.done()
