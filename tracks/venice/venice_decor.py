"""Venice's decor (IDENTITY.md), exec'd by venice_city.py while the kit's sheets are open. Race dressing from Llano's art (tracks/llano/tex: sponsors, fence, tyres, start lights, skid) and Shajawa's crowd; everything European here:
lamps, banners, flagstaffs, patterned squares, wellheads, cafe terraces, poster columns, kiosks, shop fronts, laundry, chimneys, canal bridges, moored gondolas and paline, bricole and the garden.
Models: gondola, boat, boulevard tree, poplar (CREDITS.md). Far objects get their own mesh (web pack's 16-bit rounding); decals sit 5 cm over the road, panel backs 30 cm behind."""
LX, TEXV = ROOT / 'tracks' / 'llano' / 'tex', H / 'tex'
def tex_mat(name, png, rough=0.6, clip=False, blend=False, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(png)
    nt.links.new(it.outputs['Color'], P.inputs['Base Color']); P.inputs['Roughness'].default_value = rough
    if clip:
        gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5; nt.links.new(it.outputs['Alpha'], gt.inputs[0]); nt.links.new(gt.outputs[0], P.inputs['Alpha'])
    if blend:
        nt.links.new(it.outputs['Alpha'], P.inputs['Alpha']); m.surface_render_method = 'BLENDED'
    if emit: nt.links.new(it.outputs['Color'], P.inputs['Emission Color']); P.inputs['Emission Strength'].default_value = emit
    return m
MAT.update({
    'ads6': tex_mat('VE | ads 6x1', LX / 'ads_6x1.png', 0.5), 'ads3': tex_mat('VE | ads 3x1', LX / 'ads_3x1.png', 0.5), 'fence': tex_mat('VE | fence', LX / 'fence.png', 0.5, clip=True), 'tyres': tex_mat('VE | tyres', LX / 'tyres.png', 0.85),
    'lights': tex_mat('VE | start lights', LX / 'start_lights.png', 0.45), 'skid': tex_mat('VE | skid', LX / 'skid.png', 0.7, blend=True), 'crowd': tex_mat('VE | crowd', ROOT / 'tracks' / 'shajawa' / 'tex' / 'crowd_rows.png', 0.8, clip=True),
    'boards': tex_mat('VE | race boards', TEXV / 'race_boards.png', 0.5), 'shop': tex_mat('VE | shop signs', TEXV / 'shop_signs.png', 0.55), 'posters': tex_mat('VE | posters', TEXV / 'posters.png', 0.6), 'banner': tex_mat('VE | banners', TEXV / 'banners.png', 0.65),
    'awn': tex_mat('VE | awnings', TEXV / 'awnings.png', 0.75), 'cloth': tex_mat('VE | laundry', TEXV / 'laundry.png', 0.8),
})
class Art:
    """flat pictures: every quad carries its own UVs"""
    def __init__(s, name, keys): s.name, s.keys, s.bm = name, keys, bmesh.new()
    def quad(s, pts, k, uv):
        f = s.bm.faces.new([s.bm.verts.new(p) for p in pts]); f.material_index = s.keys.index(k); lay = s.bm.loops.layers.uv.verify()
        for l, q in zip(f.loops, uv): l[lay].uv = q
    def done(s):
        if s.bm.faces: return mesh_obj(s.name, s.bm, s.keys, planar=False)
        s.bm.free()
AR = Art('VE decor art', ['ads6', 'ads3', 'fence', 'tyres', 'lights', 'boards', 'shop', 'posters', 'banner', 'awn', 'cloth', 'crowd'])
DEC_ = Art('VE decals', ['skid'])
ADS3 = ['shell', 'rolex', 'pirelli', 'cocacola', 'redbull', 'emirates', 'sony', 'oppo']; ADS6 = ['shell', 'redbull', 'rolex', 'pirelli', 'cocacola', 'hsbc', 'emirates', 'sony']      # as make_textures.mjs laid out Llano's sheets
def r6(q): return 0, 1, 1 - (q % 8 + 1) / 8, 1 - (q % 8) / 8
def r3(q): return (q % 2) / 2, (q % 2 + 1) / 2, 1 - (q % 8 // 2 + 1) / 4, 1 - (q % 8 // 2) / 4
Dn = random.Random(101)
S_ = lambda s: ST(s % LAP)
def side_p(i, sd, d, dz=0.0): return off(i, sd * d, dz)
def panel(c, w_, h_, f, k, rect, back=True):
    """a flat picture facing f (unit, toward the viewer), its bottom centre at c"""
    f = Vector((f.x, f.y, 0)).normalized(); r_ = Vector((-f.y, f.x, 0)); u0, u1, v0, v1 = rect; a, b = c - r_ * w_ / 2, c + r_ * w_ / 2
    AR.quad([a, b, b + UP * h_, a + UP * h_], k, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    if back: KT.face([b - f * 0.3, a - f * 0.3, a - f * 0.3 + UP * h_, b - f * 0.3 + UP * h_], 'iron')
def beam(a, b, r_, k='iron', col=(1, 1, 1)):
    a, b = Vector(a), Vector(b); d_ = (b - a).normalized(); e = d_.cross(UP); e = (e if e.length > 1e-3 else Vector((1, 0, 0))).normalized() * r_; g = d_.cross(e).normalized() * r_; ring_ = (e + g, e - g, -e - g, -e + g)
    for q in range(4): KT.face([a + ring_[q], a + ring_[(q + 1) % 4], b + ring_[(q + 1) % 4], b + ring_[q]], k, col)
def toward(i, sd, turn=0.45): return (-T[i].to_3d() * math.cos(turn) - NL[i] * sd * math.sin(turn)).normalized()
def on_stand(i, sd): return any(a_ - 8 <= i <= b_ + 8 and sd == s_ for a_, b_, s_, *_ in STANDS)

# ------------------------------------------------------------------------------------------------ race dressing: crowd, fences, hoardings, tyres, painted run-off, gantries, boards, skid marks
for a_, b_, sd, rows, gap in STANDS:      # the crowd: a card of seated people per row, gaps in the card are empty seats
    for k_ in range(rows):
        var = (k_ * 3 + a_) % 4; d0 = gap + k_ * 0.85 + 0.3; z_ = 1.0 + k_ * 0.5 - 0.2
        for j in range(a_, b_ - 4, 4):
            if (j // 4) % 6 == 0: continue
            j2 = j + 4; p, q_ = off(j, sd * (BD[sd][j] + d0), z_), off(j2, sd * (BD[sd][j2] + d0), z_); u0, u1 = j * STEP / 14 + k_ * 0.37, j2 * STEP / 14 + k_ * 0.37
            AR.quad([p, q_, q_ + UP * 1.15, p + UP * 1.15] if sd > 0 else [q_, p, p + UP * 1.15, q_ + UP * 1.15], 'crowd', [(u0, var / 4), (u1, var / 4), (u1, (var + 1) / 4), (u0, (var + 1) / 4)] if sd > 0 else [(u1, var / 4), (u0, var / 4), (u0, (var + 1) / 4), (u1, (var + 1) / 4)])
def fence(i0, i1, sd):
    for j in range(i0, i1, 2):
        j2 = (j + 2) % N; a, b = off(j % N, sd * (BD[sd][j % N] + 0.42), 0.8), off(j2, sd * (BD[sd][j2] + 0.42), 0.8); L_ = (b - a).length
        AR.quad([a, b, b + UP * 4.2, a + UP * 4.2] if sd > 0 else [b, a, a + UP * 4.2, b + UP * 4.2], 'fence', [(0, 0), (L_, 0), (L_, 4.2), (0, 4.2)])
        if (j // 2) % 2 == 0: beam(a - UP * 0.9, a + UP * 4.3, 0.05)
def hoardings(s0, s1, sd, seq=0, L_=9.0):
    s_ = s0
    while s_ < s1:
        i = S_(s_ + L_ / 2); panel(off(i, sd * (BD[sd][i] + 0.75), 0.78), L_, 1.5, -NL[i] * sd, 'ads6', r6(seq)); s_ += L_; seq += 1
for a_, b_, sd, *_ in STANDS: fence(a_ - 4, b_ + 4, sd)
hoardings(10, 520, 1, 0); hoardings(100, 520, -1, 3); hoardings(2640, 2990, -1, 1); hoardings(3300, 3440, -1, 2); hoardings(2640, 2840, 1, 5); hoardings(3240, 3440, 1, 7); hoardings(5420, 5630, 1, 2); hoardings(3460, 3840, -1, 4); hoardings(2240, 2500, -1, 6)
def tyres(s0, s1, sd):
    s_ = s0
    while s_ < s1:
        i, j = S_(s_), S_(s_ + 3); p, q_ = off(i, sd * (BD[sd][i] - 0.5), -0.1), off(j, sd * (BD[sd][j] - 0.5), -0.1); AR.quad([p, q_, q_ + UP * 1.25, p + UP * 1.25] if sd > 0 else [q_, p, p + UP * 1.25, q_ + UP * 1.25], 'tyres', [(0, 0), (1, 0), (1, 1), (0, 1)]); s_ += 3
RED_, GOLD = (0.5, 0.05, 0.05), (0.75, 0.55, 0.14)
def paint(s0, s1, sd):      # St Mark red and gold run-off, over the paving
    j0, j1 = S_(s0), S_(s1)
    for j in range(j0, j1):
        a, b = j, j + 1; w0, w1, w2 = HW + 1.5, min(BD[sd][a] - 0.7, HW + 14), min(BD[sd][b] - 0.7, HW + 14)
        if w1 < w0 + 0.5: continue
        KT.face([off(a, sd * w0, 0.018), off(b, sd * w0, 0.018), off(b, sd * w2, 0.018), off(a, sd * w1, 0.018)][::sd], 'paint', (RED_, GOLD)[(j // 4) % 2])
for s0, s1, sd in ((640, 900, 1), (2300, 2560, -1), (3530, 3860, -1)): tyres(s0, s1, sd); paint(s0, s1, sd)
def truss(s, z0=7.2, z1=9.8, pad=0.9):
    i = S_(s); latl, latr = BD[1][i] + pad, -(BD[-1][i] + pad); tt = T[i].to_3d() * 0.6; pl, pr = off(i, latl), off(i, latr)
    for p_ in (pl, pr):
        for sg in (-1, 1): beam(p_ + tt * sg - UP * 1.0, p_ + tt * sg + UP * (z1 + 0.8), 0.16)
    for sg in (-1, 1):
        for zz in (z0, z1): beam(pl + tt * sg + UP * zz, pr + tt * sg + UP * zz, 0.1)
    n_ = max(6, int((latl - latr) / 3))
    for q in range(n_):
        a, b = pl.lerp(pr, q / n_), pl.lerp(pr, (q + 1) / n_)
        for sg in (-1, 1): beam(a + tt * sg + UP * (z0 if q % 2 else z1), b + tt * sg + UP * (z1 if q % 2 else z0), 0.05)
    return i
BNAME = (0, 1, 0.5, 0.625)      # race_boards.png: the track's name, a full-width row
i = truss(0); panel(off(i, 0, 7.3) - T[i].to_3d() * 0.68, 26, 2.45, -T[i], 'boards', BNAME, back=False)
panel(off(i, 0, 4.0) - T[i].to_3d() * 0.72, 13, 1.6, -T[i], 'lights', (0, 1, 0, 1)); beam(off(i, -7, 5.0) - T[i].to_3d() * 0.7, off(i, 7, 5.0) - T[i].to_3d() * 0.7, 0.08)
for s_, q in ((560, 2), (1780, 4), (2720, 0), (3380, 3), (5330, 1)):
    i = truss(s_); hw_ = (BD[1][i] + BD[-1][i]) / 2; cen = off(i, (BD[1][i] - BD[-1][i]) / 2, 7.3) - T[i].to_3d() * 0.68
    for k_ in range(-1, 2): panel(cen + NL[i] * k_ * 12.2, 12, 2.45, -T[i], 'ads6', r6(q + k_ + 1), back=False)
def board(s, sd, u0, u1, v0, v1, w_=2.2, h_=1.6, z=1.3, d=1.0):
    i = S_(s); p = off(i, sd * (BD[sd][i] + d)); beam(p - UP * 0.6 + NL[i] * 0.5, p + UP * (z + h_) + NL[i] * 0.5, 0.05); beam(p - UP * 0.6 - NL[i] * 0.5, p + UP * (z + h_) - NL[i] * 0.5, 0.05); panel(p + UP * z, w_, h_, -T[i], 'boards', (u0, u1, v0, v1))
for s_a, sd in ((690, 1), (2300, -1), (3620, -1)):      # 300, 200, 100 before the big stops, the cells on race_boards.png's top row
    for q, m_ in enumerate((300, 200, 100)): board(s_a - m_, sd, q / 4, (q + 1) / 4, 0.75, 1.0)
for s_, sd, row in ((640, 1, 0), (2350, -1, 1), (3660, -1, 2), (4410, 1, 3)):      # corner names on hoardings' height, in the bottom half of the sheet
    i = S_(s_); panel(off(i, sd * (BD[sd][i] + 0.9), 2.6), 20, 2.5, toward(i, sd), 'boards', (0, 1, 0.375 - (row + 1) * 0.09375, 0.375 - row * 0.09375))
for s_c, sd, L_ in ((2360, -1, 18), (3660, -1, 26)):
    for k_ in range(4):
        j, j2 = S_(s_c - 40 + k_ * 12), S_(s_c - 40 + k_ * 12 + L_); lat = (-1) ** k_ * 2.0 + sd * 2.5
        DEC_.quad([off(j, lat - 1.2, 0.06), off(j2, lat - 1.2, 0.06), off(j2, lat + 1.2, 0.06), off(j, lat + 1.2, 0.06)], 'skid', [(0, 0), (0, 1), (1, 1), (1, 0)])

# ------------------------------------------------------------------------------------------------ lamps and banners round the lap: cast iron, one lantern, the old city's look; on the deck, on its parapets
def lamp(p, h_=6.6, double=False):
    lathe_k(p, [(0.26, 0), (0.26, 0.5), (0.17, 0.75), (0.14, 1.2), (0.17, 1.5), (0.09, 1.8), (0.07, h_ - 0.25), (0.11, h_ - 0.1), (0.09, h_)], 'iron', WHITE, n=8)
    for off_ in ((-0.75, 0.75) if double else (0,)):
        t_ = Vector((off_, 0, 0)); c_ = p + t_ + UP * h_
        if double: beam(p + UP * (h_ - 0.25), c_, 0.035)
        lathe_k(c_, [(0.09, 0), (0.17, 0.08), (0.27, 0.72), (0.31, 0.75)], 'glass', WHITE, n=6); lathe_k(c_ + UP * 0.75, [(0.31, 0), (0.1, 0.3), (0.03, 0.55)], 'iron', WHITE, n=6)
n_lamps = 0
for j in range(0, N, 16):
    for sd in (1, -1):
        if (j // 16 + (sd > 0)) % 2 and not (ST(2640) <= j <= ST(3440)): continue
        if CUT[j] or on_stand(j, sd): continue
        if DECK[j]:
            if ROOF[j] or in_poly(CL[j].x, CL[j].y, PODIUM): pass
            p = off(j, sd * (DW - 0.25), PAR); lamp(p, 5.0)
        else:
            p = off(j, sd * (BD[sd][j] + 1.5), -0.5); lamp(p)
            if (j // 16) % 2 == 0:      # a banner on the post, facing the traffic
                f = -T[j]; r_ = Vector((-f.y, f.x, 0)); c_ = p + UP * 4.0 + r_ * 0.1
                panel(c_ + r_ * sd * 0.55, 0.95, 2.5, f, 'banner', (0, 0.25, 0, 1) if (j // 32) % 2 else (0.25, 0.5, 0, 1), back=False); beam(p + UP * 6.5, p + UP * 6.5 + r_ * sd * 1.08, 0.022); beam(p + UP * 4.0, p + UP * 4.0 + r_ * sd * 1.08, 0.022)
        n_lamps += 1
log('lamps', n_lamps)
for j in range(D0 + 12, D1, 24):      # stone urns on the deck's parapets
    for sd in (1, -1): lathe_k(off(j, sd * (DW - 0.25), PAR), [(0.42, 0), (0.42, 0.14), (0.16, 0.28), (0.2, 0.4), (0.48, 0.75), (0.52, 1.05), (0.34, 1.2), (0.42, 1.28), (0.12, 1.42)], 'lime', WARM, n=10)

# ------------------------------------------------------------------------------------------------ squares: the HQ's forecourt with its flagstaffs; the church's square; a cafe street along the arcades
def square(s0, s1, sd, d0, d1, z_):
    for j in range(S_(s0), S_(s1), 8):
        j2 = min(j + 8, S_(s1)); a0, a1, b0, b1 = off(j, sd * (BD[sd][j] + d0)), off(j2, sd * (BD[sd][j2] + d0)), off(j, sd * (BD[sd][j] + d1)), off(j2, sd * (BD[sd][j2] + d1))
        for p in (a0, a1, b0, b1): p.z = z_
        KT.face([a0, a1, b1, b0][::sd], 'piazza', (0.95, 0.93, 0.88))
HQZ = CL[S_(5783)].z
square(5640, 5905, 1, 0.5, 14, HQZ + 0.04)
def flag(p, w_, h_, cell, z):
    """a cloth with a static wave, on a mast: cell 0, 1 of banners.png's flag half"""
    rows = 8; u0, u1 = (0.5, 0.75) if cell == 0 else (0.75, 1.0)
    for q in range(rows):
        t0, t1 = q / rows, (q + 1) / rows; off0, off1 = 0.5 * t0 * math.sin(t0 * 9), 0.5 * t1 * math.sin(t1 * 9)
        a, b = p + Vector((t0 * w_, off0, z)), p + Vector((t1 * w_, off1, z - 0.3 * t1 + 0.3 * t0)); AR.quad([a, b, b + UP * h_, a + UP * h_], 'banner', [(u0 + (u1 - u0) * t0, 0.5), (u0 + (u1 - u0) * t1, 0.5), (u0 + (u1 - u0) * t1, 1), (u0 + (u1 - u0) * t0, 1)])
for t_, q in ((0.2, 0), (0.31, 1), (0.42, 0)):      # three tall flagstaffs on bronze bases, as St Mark's square has: off the HQ's front, east of its gate, where the wall stands clear of the road
    ex_ = (Q[1] - Q[0]).normalized(); ey_ = Vector((-ex_.y, ex_.x)); p2 = cq + ex_ * HW_ * t_ - ey_ * (HD_ / 2 + 2.6); gi, gd = near(p2.x, p2.y); p = Vector((p2.x, p2.y, CL[gi].z + 0.04))
    assert gd > max(BD[1][gi], BD[-1][gi]) + 1.0, f'a flagstaff at {t_} stands {gd:.1f} m from the road'
    KT.block(p - UP * 0.5, (4.0, 4.0, 0.54), yaw_h, 'piazza', (0.95, 0.93, 0.88))
    lathe_k(p, [(1.5, 0), (1.5, 0.4), (1.1, 0.5), (1.0, 1.4), (0.7, 2.0), (0.55, 3.4), (0.32, 3.7)], 'lead', (0.55, 0.42, 0.26), n=12); lathe_k(p + UP * 3.7, [(0.24, 0), (0.1, 22.0), (0.2, 22.1), (0.03, 22.6)], 'stake', (0.62, 0.4, 0.28), n=8); flag(p, 9.0, 5.2, q, 16.0)
ZB = Z(0.04)
square(2905, 3000, 1, 0.5, 44, ZB)
def wellhead(c):
    lathe_k(c, [(1.5, 0), (1.5, 0.22), (1.1, 0.3), (0.95, 0.5), (0.92, 1.0), (1.14, 1.3), (1.18, 1.42), (0.84, 1.44), (0.84, 1.2)], 'lime', WARM, n=16)
    for s_ in (-1, 1): beam(c + Vector((s_ * 0.98, 0, 1.3)), c + Vector((s_ * 0.98, 0, 3.0)), 0.05)
    n_ = 8
    for q in range(n_): beam(c + Vector((0.98 * math.cos(math.pi * q / n_), 0, 3.0 + 0.7 * math.sin(math.pi * q / n_))), c + Vector((0.98 * math.cos(math.pi * (q + 1) / n_), 0, 3.0 + 0.7 * math.sin(math.pi * (q + 1) / n_))), 0.04)
def bench(c, yaw):
    for x_ in (-0.9, 0.9): KT.block(at(c, yaw, x_, 0), (0.4, 0.5, 0.42), yaw, 'lime', WARM)
    KT.block(at(c, yaw, 0, 0, 0.42), (2.4, 0.56, 0.1), yaw, 'lime', PALE)
def planter(c):
    lathe_k(c, [(0.36, 0), (0.42, 0.1), (0.5, 0.62), (0.56, 0.68), (0.5, 0.72)], 'red', (0.9, 0.62, 0.45), n=12)
    lathe_k(c + UP * 0.68, [(0.46, 0), (0.56, 0.3), (0.38, 0.75), (0.02, 1.0)], 'hedge', (0.55, 0.7, 0.45), n=10)
c_b = off(S_(2935), BD[1][S_(2935)] + 12); c_b.z = ZB; wellhead(c_b)
for s_, d_ in ((2925, 7), (2985, 7), (2925, 30), (2985, 30)):
    i = S_(s_); c_ = off(i, BD[1][i] + d_); c_.z = ZB; bench(c_, HEAD[i]); planter(c_ + T[i].to_3d() * 2.6); planter(c_ - T[i].to_3d() * 2.6)
square(3004, 3090, 1, 0.5, 7.6, ZB)
def parasol(c, col):
    lathe_k(c, [(0.04, 0), (0.04, 2.5)], 'iron', WHITE, n=6); R0_ = 2.1
    rg = [(0.04, 2.95), (R0_ * 0.55, 2.68), (R0_, 2.28)]
    for q in range(8):
        a0, a1 = q * math.pi / 4, (q + 1) * math.pi / 4; cc = col if q % 2 else (0.9, 0.86, 0.76)
        for (r0, z0), (r1, z1) in zip(rg, rg[1:]): KT.face([c + Vector((r1 * math.cos(a0), r1 * math.sin(a0), z1)), c + Vector((r1 * math.cos(a1), r1 * math.sin(a1), z1)), c + Vector((r0 * math.cos(a1), r0 * math.sin(a1), z0)), c + Vector((r0 * math.cos(a0), r0 * math.sin(a0), z0))], 'canvas', cc)
    lathe_k(c, [(0.4, 0), (0.05, 0.1), (0.05, 0.72), (0.42, 0.75), (0.42, 0.78)], 'iron', WHITE, n=8)
    for q in range(4):
        a0 = q * math.pi / 2 + 0.5; s_ = c + Vector((0.9 * math.cos(a0), 0.9 * math.sin(a0), 0)); KT.block(s_, (0.38, 0.38, 0.44), a0, 'iron'); KT.block(s_ + UP * 0.44 + Vector((0.2 * math.cos(a0), 0.2 * math.sin(a0), 0)), (0.05, 0.38, 0.42), a0, 'iron')
for k_, s_ in enumerate(range(3008, 3088, 8)):
    i = S_(s_)
    for d_ in (2.6, 5.5):
        c_ = off(i, BD[1][i] + d_); c_.z = ZB; parasol(c_, (0.5, 0.08, 0.07) if (k_ + int(d_)) % 3 else (0.1, 0.25, 0.16))
for s_ in range(5900, 5985, 9):      # terraces on the top straight, past the forecourt
    i = S_(s_); c_ = off(i, BD[1][i] + 3.5); c_.z = CL[i].z; parasol(c_, (0.5, 0.08, 0.07))

# ------------------------------------------------------------------------------------------------ street furniture on the boulevard: poster columns, kiosks
def poster_column(c):
    lathe_k(c, [(0.92, 0), (0.92, 0.5), (0.78, 0.6), (0.78, 3.6), (0.95, 3.75), (0.95, 3.95), (0.72, 4.15), (0.42, 4.7), (0.14, 5.0), (0.03, 5.3)], 'iron', (0.45, 0.8, 0.6), n=16)
    n_ = 6
    for q in range(n_):
        a0, a1 = 2 * math.pi * q / n_, 2 * math.pi * (q + 1) / n_; cell = q % 8; u0, v1 = (cell % 4) / 4, 1 - (cell // 4) / 2; u1, v0 = u0 + 0.25, v1 - 0.5; r_ = 0.8; steps = 4
        for t_ in range(steps):
            b0, b1 = a0 + (a1 - a0) * t_ / steps, a0 + (a1 - a0) * (t_ + 1) / steps; p0, p1 = c + Vector((r_ * math.cos(b0), r_ * math.sin(b0), 0.7)), c + Vector((r_ * math.cos(b1), r_ * math.sin(b1), 0.7))
            AR.quad([p0, p1, p1 + UP * 2.8, p0 + UP * 2.8], 'posters', [(u0 + (u1 - u0) * t_ / steps, v0), (u0 + (u1 - u0) * (t_ + 1) / steps, v0), (u0 + (u1 - u0) * (t_ + 1) / steps, v1), (u0 + (u1 - u0) * t_ / steps, v1)])
def kiosk(c, yaw):
    w_ = 2.6; KT.block(c, (w_, w_, 0.9), yaw, 'iron', (0.45, 0.8, 0.6)); KT.block(c + UP * 0.9, (w_ - 0.1, w_ - 0.1, 1.5), yaw, 'glass'); KT.block(c + UP * 2.4, (w_, w_, 0.4), yaw, 'iron', (0.45, 0.8, 0.6))
    lathe_k(c + UP * 2.8, [(w_ * 0.78, 0), (w_ * 0.82, 0.12), (w_ * 0.55, 0.65), (0.22, 1.2), (0.03, 1.7)], 'lead', GREEN_LEAD, n=8)
    for q in range(4):
        a_ = yaw + q * math.pi / 2; f = Vector((math.sin(a_), -math.cos(a_), 0)); cell = (q * 3) % 8; u0, v1 = (cell % 4) / 4, 1 - (cell // 4) / 2
        panel(c + f * (w_ / 2 + 0.02) + UP * 0.1, 1.3, 0.78, f, 'posters', (u0, u0 + 0.25, v1 - 0.5, v1), back=False)
for s_, sd, d_ in ((2815, 1, 3.5), (2998, 1, 3.5), (3090, 1, 3.6), (3224, 1, 3.5), (3000, -1, 3.5), (3200, -1, 3.5), (3290, -1, 3.5)):
    i = S_(s_); c_ = off(i, sd * (BD[sd][i] + d_)); c_.z = Z(-0.3); poster_column(c_)
for s_, sd, d_ in ((3180, 1, 5.5), (3208, -1, 6.5)):
    i = S_(s_); c_ = off(i, sd * (BD[sd][i] + d_)); c_.z = Z(-0.3); kiosk(c_, HEAD[i])
# a stone clock on a post at the drop's outside
i = S_(2440); c_ = off(i, -(BD[-1][i] + 3)); c_.z -= 0.4; lathe_k(c_, [(0.6, 0), (0.6, 0.4), (0.28, 0.6), (0.24, 3.8), (0.34, 4.0)], 'iron', WHITE, n=10); lathe_k(c_ + UP * 4.0, [(0.72, 0.0), (0.72, 1.3), (0.3, 1.6), (0.05, 2.0)], 'iron', WHITE, n=16)

# ------------------------------------------------------------------------------------------------ the town: shop fronts with invented Italian names, window boxes, laundry between facing houses, chimneys on the palazzi
SHOP_ORDER = list(range(16)); Dn.shuffle(SHOP_ORDER); sh_i = 0; n_shop = n_laundry = 0
for o_, u_, w_, d_, h_, kind in HOUSES:
    fw = W(o_, u_); n_ = fw.n
    if Dn.random() < 0.42 and w_ >= 7.5:      # a shop on the ground floor: a name board and an awning
        cell = SHOP_ORDER[sh_i % 16]; sh_i += 1; col_, row_ = cell % 2, cell // 2; c_ = fw.p(w_ / 2, 2.72, 0.14); wd = min(w_ - 1.2, 6.0)
        panel(c_, wd, 0.82, n_, 'shop', (col_ / 2, (col_ + 1) / 2, 1 - (row_ + 1) / 8, 1 - row_ / 8), back=False); a_ = Dn.randrange(4); aw = wd * 0.95
        p0, p1, p2, p3 = fw.p(w_ / 2 - aw / 2, 2.66, 0.12), fw.p(w_ / 2 + aw / 2, 2.66, 0.12), fw.p(w_ / 2 + aw / 2, 2.12, 1.55), fw.p(w_ / 2 - aw / 2, 2.12, 1.55)
        AR.quad([p3, p2, p1, p0], 'awn', [(a_ / 4, 0), ((a_ + 1) / 4, 0), ((a_ + 1) / 4, 1), (a_ / 4, 1)]); n_shop += 1
    if Dn.random() < 0.5 and road_d(fw.p(w_ / 2, 3.0)) < 60:      # window boxes on the first floor
        fl = max(2, int(h_ / 3.3)); fh = h_ / fl; nb = max(2, int(w_ / 2.9)); bw = w_ / nb
        for q in range(nb):
            if Dn.random() < 0.7:
                a = (q + 0.5) * bw; z0 = fh + 0.85; relief(fw, a - 0.55, a + 0.55, z0 - 0.26, z0 - 0.02, 0, 0.26, 'stake', (0.7, 0.55, 0.42))
                relief(fw, a - 0.58, a + 0.58, z0 - 0.02, z0 + 0.24, 0.02, 0.3, 'hedge', Dn.choice(((0.62, 0.8, 0.5), (1.4, 0.45, 0.4), (1.5, 1.1, 0.45))))
HB_ = [(W(o_, u_).p(w_ / 2, 0, 0.0).to_2d(), W(o_, u_).n.to_2d(), o_, u_, w_, d_, h_) for o_, u_, w_, d_, h_, kind in HOUSES]
for k_, (c0, n0, o_, u_, w_, d_, h_) in enumerate(HB_):
    if Dn.random() > 0.3: continue
    for (c1, n1, o2, u2, w2, d2, h2) in HB_:      # a partner across the lane: the back of the next row's house
        back = c1 - n1 * d2; gap_ = (back - c0).dot(n0)
        if not 4.0 < gap_ < 10.5 or abs((back - c0).dot(Vector((-n0.y, n0.x)))) > 4.0 or n1.dot(n0) < 0.5: continue
        z_ = o_.z + Dn.uniform(5.0, min(h_, h2) - 1.0); a = c0.to_3d(); a.z = z_; b = back.to_3d(); b.z = z_; beam(a, b, 0.012, 'frame')
        n_c = Dn.randint(3, 6); t_ = 0.12
        for q in range(n_c):
            t1 = t_ + Dn.uniform(0.09, 0.15); pa, pb = a.lerp(b, t_), a.lerp(b, min(t1, 0.95)); hc = Dn.uniform(0.7, 1.15); cell = Dn.randrange(4)
            AR.quad([pa - UP * hc, pb - UP * hc, pb, pa], 'cloth', [(cell / 4, 0), ((cell + 1) / 4, 0), ((cell + 1) / 4, 1), (cell / 4, 1)]); t_ = t1 + 0.03
        n_laundry += 1; break
log('shops', n_shop, 'laundry lines', n_laundry)
for c_, wd, dp, yaw, h_ in [p_ for p_ in PALAZZI if road_d(p_[0]) < 130]:      # Venetian chimneys, an inverted cone on a brick stack, and a wooden roof terrace on some
    for q in range(Dn.randint(1, 3)):
        p = at(c_, yaw, Dn.uniform(-wd * 0.32, wd * 0.32), Dn.uniform(-dp * 0.3, dp * 0.3), h_ + 2.2 + min(wd, dp) * 0.13); KT.block(p, (0.6, 0.6, 2.8), yaw, 'brick'); lathe_k(p + UP * 2.8, [(0.2, 0), (0.54, 0.95), (0.6, 1.02), (0.28, 1.1)], 'brick', (0.9, 0.7, 0.6), n=8)
    if Dn.random() < 0.28:
        p = at(c_, yaw, wd * 0.15, -dp * 0.2, h_ + 3.0 + min(wd, dp) * 0.15); KT.block(p, (4.6, 3.2, 0.14), yaw, 'stake', (0.62, 0.48, 0.38))
        for sx in (-1, 1):
            for sy in (-1, 1):
                beam(at(p, yaw, sx * 2.1, sy * 1.4, -3.0), at(p, yaw, sx * 2.1, sy * 1.4, 1.0), 0.05, 'stake', (0.62, 0.48, 0.38))
        for sy in (-1, 1): beam(at(p, yaw, -2.1, sy * 1.4, 1.0), at(p, yaw, 2.1, sy * 1.4, 1.0), 0.04, 'stake', (0.62, 0.48, 0.38))

# ------------------------------------------------------------------------------------------------ the canal: two stone bridges, moored boats and paline
def canal_bridge(px):
    a, b = Vector(PX(px, 776)), Vector(PX(px, 838)); v = (b - a); L_ = v.length; v.normalize(); wd = 8.0; side = Vector((-v.y, v.x)); z0, rs = Z(0.25), 5.2; zw = Z(WL - 0.5)
    pt = lambda t_, s_, z: Vector((a.x + v.x * L_ * t_ + side.x * s_, a.y + v.y * L_ * t_ + side.y * s_, z))
    top = lambda t_: z0 + rs * (1 - (2 * t_ - 1) ** 2); und = lambda t_: zw + (rs + 1.2) * max(0.0, 1 - ((2 * t_ - 1) / 0.66) ** 2)
    n_ = 16
    for q in range(n_):
        t0, t1 = q / n_, (q + 1) / n_
        KT.face([pt(t0, -wd / 2, top(t0)), pt(t1, -wd / 2, top(t1)), pt(t1, wd / 2, top(t1)), pt(t0, wd / 2, top(t0))], 'piazza', (0.9, 0.88, 0.82))
        KT.face([pt(t0, wd / 2, und(t0)), pt(t1, wd / 2, und(t1)), pt(t1, -wd / 2, und(t1)), pt(t0, -wd / 2, und(t0))], 'lime', (0.6, 0.58, 0.54))
        for s_ in (-1, 1):
            f_ = [pt(t0, s_ * wd / 2, und(t0)), pt(t1, s_ * wd / 2, und(t1)), pt(t1, s_ * wd / 2, top(t1) + 1.05), pt(t0, s_ * wd / 2, top(t0) + 1.05)]; KT.face(f_ if s_ > 0 else f_[::-1], 'lime', PALE)
            KT.face([pt(t0, s_ * (wd / 2 - 0.4), top(t0) + 1.05), pt(t1, s_ * (wd / 2 - 0.4), top(t1) + 1.05), pt(t1, s_ * wd / 2, top(t1) + 1.05), pt(t0, s_ * wd / 2, top(t0) + 1.05)][:: s_], 'lime', PALE)
            f_ = [pt(t0, s_ * (wd / 2 - 0.4), top(t0)), pt(t1, s_ * (wd / 2 - 0.4), top(t1)), pt(t1, s_ * (wd / 2 - 0.4), top(t1) + 1.05), pt(t0, s_ * (wd / 2 - 0.4), top(t0) + 1.05)]; KT.face(f_[::-1] if s_ > 0 else f_, 'lime', PALE)
    for t_ in (0.0, 1.0):
        for s_ in (-1, 1): lathe_k(pt(t_, s_ * (wd / 2 - 0.2), z0 + 0.0), [(0.5, 0), (0.5, 1.5), (0.34, 1.6), (0.5, 2.0), (0.12, 2.5)], 'lime', WARM, n=10)
canal_bridge(590); canal_bridge(930)
BANKS = []      # along the canal's two long edges, the boats' places: (position, direction, side outward)
pts_c = [Vector(p) for p in CANAL]; ctr = sum(pts_c, Vector((0, 0))) / len(pts_c)
for k_ in range(len(pts_c)):
    a, b = pts_c[k_], pts_c[(k_ + 1) % len(pts_c)]; u_ = (b - a); L_ = u_.length
    if L_ < 1 or abs(u_.normalized().dot(Vector((math.cos(yl), math.sin(yl))))) < 0.93: continue
    n_ = Vector((u_.y, -u_.x)).normalized()
    if in_poly(*(a + n_), CANAL): n_ = -n_
    q_ = 0.0
    while q_ < L_: BANKS.append((a + u_.normalized() * q_, math.atan2(u_.y, u_.x), n_)); q_ += 9.0
Dn.shuffle(BANKS); PALINE = []; GOND, BOATS = [], []
far_from_bridge = lambda p: all(abs(p.x - PX(x_, 806)[0]) > 28 for x_ in (590, 930))
placed = []
for p, yaw, n_ in BANKS:
    if len(placed) >= 26: break
    if not far_from_bridge(p) or any((p - q_).length < 15 for q_ in placed): continue
    placed.append(p); c_ = p - n_ * 2.3; (GOND if Dn.random() < 0.72 else BOATS).append((Vector((c_.x, c_.y, Z(WL))), yaw, c_))
    for s_ in (-1, 1):      # striped mooring poles at bow and stern
        q_ = p - n_ * 1.1 + Vector((math.cos(yaw), math.sin(yaw))) * s_ * 4.2; PALINE.append(Vector((q_.x, q_.y, Z(WL - 0.5))))
def palina(p, col, h_=5.4):
    bands = 8; r_ = 0.13
    for q in range(bands):
        z0, z1 = h_ * q / bands, h_ * (q + 1) / bands; lathe_k(p + UP * z0, [(r_, 0), (r_, z1 - z0)], 'cloth2', col if q % 2 else (0.9, 0.88, 0.82), n=8)
    lathe_k(p + UP * h_, [(r_, 0), (0.2, 0.18), (0.02, 0.45)], 'iron', (1.4, 1.1, 0.5), n=8)
for k_, p in enumerate(PALINE): palina(p, ((0.1, 0.2, 0.42), (0.5, 0.06, 0.06), (0.1, 0.3, 0.2))[(k_ // 2) % 3])

# ------------------------------------------------------------------------------------------------ out in the water: bricole to the dome's island, its landing stage, boats on the lake and off the island
def bricola(p):
    for a_ in (0, 2.1, 4.2): lathe_k(p + Vector((0.32 * math.cos(a_), 0.32 * math.sin(a_), -0.7)), [(0.2, 0), (0.17, 5.4), (0.05, 5.6)], 'stake', (0.72, 0.6, 0.5), n=8)
    lathe_k(p + UP * 3.3, [(0.55, 0), (0.55, 0.14)], 'iron', WHITE, n=10)
for k_ in range(9):      # a channel past the hairpin to the island
    t_ = k_ / 8; p = Vector(PX(1275 + 80 * t_, 1010 - 90 * t_)); p = Vector((p.x, p.y, Z(WL)))
    if ground_z(p.x, p.y)[0] < Z(WL): bricola(p)
for k_ in range(10):
    t_ = k_ / 9; p = Vector(PX(1290 + 18 * t_, 700 + 90 * t_)); p = Vector((p.x, p.y, Z(WL)))
    if ground_z(p.x, p.y)[0] < Z(WL): bricola(p)
ls_c = base(1296, 905, sink=0.0); ls_c.z = Z(0.3); yd = math.atan2(F_.y, F_.x)      # the landing stage on the dome's island, towards the hairpin
KT.block(ls_c, (26, 5.0, 0.32), yd, 'stake', (0.72, 0.58, 0.46))
for x_ in range(-12, 13, 4):
    for y_ in (-2.4, 2.4): lathe_k(at(ls_c, yd, x_, y_, -1.2), [(0.16, 0), (0.15, 3.2), (0.04, 3.4)], 'stake', (0.6, 0.5, 0.42), n=6)
for k_, (x_, y_) in enumerate(((-9, 4.8), (2, 4.8), (9, -4.8), (-3, -4.8))): GOND.append((Vector((at(ls_c, yd, x_, y_).x, at(ls_c, yd, x_, y_).y, Z(WL))), yd + 0.05 * k_, None))
for x_, y_, a_ in ((650, 420, 0.4), (820, 450, 2.0), (920, 500, 1.1), (610, 360, 2.6), (760, 500, 0.2)):
    p = PX(x_, y_); BOATS.append((Vector((p[0], p[1], Z(WATER))), a_, None))
for x_ in range(1305, 1370, 22):
    p = PX(x_, 1035); BOATS.append((Vector((p[0], p[1], Z(WL))), 0.2 + x_ * 0.01, None))

# ------------------------------------------------------------------------------------------------ the garden: a clipped labyrinth, a cypress line, urns on plinths, a small pavilion by the lake
lb = Vector(PX(395, 410)); yg_ = 0.0; HH_ = 1.5; n_h = 0
for ring_ in range(5, 12):
    half = ring_ * 6.5; rng = Dn.randrange(4)
    for side_ in range(4):
        L_ = half * 2; seg = 6.0; a_ = side_ * math.pi / 2
        for q in range(int(L_ / seg)):
            if (q + ring_ * 3 + side_ * 5) % 11 == 0: continue      # a gap to walk through
            x_ = -half + (q + 0.5) * seg; p = lb + Vector((math.cos(a_) * x_ + math.cos(a_ - math.pi / 2) * half, math.sin(a_) * x_ + math.sin(a_ - math.pi / 2) * half))
            if not in_poly(p.x, p.y, GARDEN): continue
            KT.block(Vector((p.x, p.y, ground_z(p.x, p.y)[0] - 0.2)), (seg, 1.3, HH_ + 0.2), a_, 'hedge', (0.5, 0.62, 0.4)); n_h += 1
log('hedges', n_h)
gc_p = Vector(PX(395, 410)); gz_ = ground_z(gc_p.x, gc_p.y)[0]; c_ = Vector((gc_p.x, gc_p.y, gz_)); wellhead(c_)
for a_ in range(8):
    p = gc_p + Vector((math.cos(a_ * math.pi / 4) * 14, math.sin(a_ * math.pi / 4) * 14)); c_ = Vector((p.x, p.y, ground_z(p.x, p.y)[0])); KT.block(c_, (1.2, 1.2, 1.3), 0, 'lime', PALE)
    lathe_k(c_ + UP * 1.3, [(0.42, 0), (0.42, 0.14), (0.16, 0.28), (0.2, 0.4), (0.48, 0.75), (0.52, 1.05), (0.34, 1.2), (0.42, 1.28), (0.12, 1.42)], 'lime', PALE, n=10)
pv = Vector(PX(495, 470)); rotunda(Vector((pv.x, pv.y, ground_z(pv.x, pv.y)[0] - 0.1)), 6.5, k='lime', col=PALE, order='ionic', h_=6.2, dome='lead', dcol=GREEN_LEAD)

# ------------------------------------------------------------------------------------------------ models (CREDITS.md): boats on the water, the boulevard's trees, slim dark poplars for cypress lines
def load_model(path, height=None, length=None, decimate=None, cut=0.0):
    """the glTF's meshes baked to one bmesh in metres, standing on z = 0 and centred, long axis on x; cut: drop everything under this share of its height (the boat's trailer)"""
    bpy.ops.import_scene.gltf(filepath=str(path)); objs = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if decimate:
        for o in objs: dm = o.modifiers.new('dec', 'DECIMATE'); dm.ratio = decimate
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); out = bmesh.new(); mats = []
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); b = bmesh.new(); b.from_mesh(me); b.transform(o.matrix_world)
        for f in b.faces:
            m = o.data.materials[f.material_index] if o.data.materials else None
            if m not in mats: mats.append(m)
            f.material_index = mats.index(m)
        b.to_mesh(me); b.free(); out.from_mesh(me); bpy.data.meshes.remove(me)
    for o in objs: bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
    ps = [v.co for v in out.verts]; lo = Vector([min(q[d] for q in ps) for d in range(3)]); hi = Vector([max(q[d] for q in ps) for d in range(3)])
    if cut: bmesh.ops.delete(out, geom=[v for v in out.verts if v.co.z < lo.z + (hi.z - lo.z) * cut], context='VERTS')
    k_ = height / (hi.z - lo.z) if height else length / max(hi.x - lo.x, hi.y - lo.y)
    if length and hi.y - lo.y > hi.x - lo.x: bmesh.ops.rotate(out, verts=out.verts, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Z'))
    ps = [v.co for v in out.verts]; lo = Vector([min(q[d] for q in ps) for d in range(3)]); hi = Vector([max(q[d] for q in ps) for d in range(3)])
    for v in out.verts: v.co = (v.co - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))) * k_
    return out, mats
def scatter(name, model, spots):
    """copies at (position, yaw, scale), one mesh"""
    b0, mats = model; acc = bmesh.new()
    for pos, yaw, sc_ in spots:
        b = b0.copy(); b.transform(Matrix.Translation(pos) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Diagonal((*sc_, 1)))
        me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free(); acc.from_mesh(me); bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name); acc.to_mesh(me); acc.free()
    for m in mats:
        if m and not m.name.startswith('VE '): m.name = f'VE {name} {m.name}'
        me.materials.append(m)
    VIS.objects.link(bpy.data.objects.new(name, me)); log(name, len(spots)); return me
SRCM = H / 'source'
gmodel = load_model(SRCM / 'gondola' / 'gondola.glb', length=11.0, decimate=0.1)
scatter('VE gondolas', gmodel, [(p - UP * 0.42, yaw + Dn.uniform(-0.04, 0.04), (1, 1, 1)) for p, yaw, _ in GOND])
bmodel = load_model(SRCM / 'venetian_boat' / 'venetian_boat.glb', length=6.0, cut=0.43, decimate=0.1)
scatter('VE boats', bmodel, [(p - UP * 0.42, yaw, (1, 1, 1)) for p, yaw, _ in BOATS])
tree_m = load_model(SRCM / 'tree' / 'tree.glb', height=14.0, decimate=0.155)
TREES = []
SKIP_N, SKIP_S = ((2846, 2890), (2905, 3000)), ((3060, 3130), (3226, 3262))
for s_ in range(2650, 3430, 28):
    for sd, skip in ((1, SKIP_N), (-1, SKIP_S)):
        if any(a_ <= s_ <= b_ for a_, b_ in skip) or (sd < 0 and s_ < 3000): continue
        i = S_(s_); p = off(i, sd * (BD[sd][i] + 2.9)); p.z = Z(-0.4); TREES.append((p, Dn.uniform(0, 6.28), (lambda u: (u, u, u))(Dn.uniform(0.85, 1.1))))
        lathe_k(p, [(0.95, 0), (0.95, 0.42), (0.72, 0.46), (0.72, 0.36)], 'lime', WARM, n=10)
scatter('VE boulevard trees', tree_m, TREES)
poplar = load_model(SRCM / 'poplar' / 'poplar.glb', height=19.0, decimate=0.3)
PL = []
def add_poplar(p, s_=1.0): PL.append((p, Dn.uniform(0, 6.28), (0.62 * s_, 0.62 * s_, s_)))
gp = [Vector(p) for p in GARDEN]
for k_ in range(0, len(gp), 5):
    p = gp[k_]; n0 = (gp[(k_ + 1) % len(gp)] - gp[k_ - 1]).normalized(); n_ = Vector((n0.y, -n0.x))
    if in_poly(*(p + n_), GARDEN): n_ = -n_
    p = p + n_ * 3.5; add_poplar(Vector((p.x, p.y, ground_z(p.x, p.y)[0] - 0.2)), Dn.uniform(0.8, 1.15))
for s_, sd in ((470, 1), (500, 1), (530, 1), (900, 1), (930, 1), (960, 1), (2540, -1), (2570, -1), (3460, 1), (3490, 1), (5180, 1), (5210, 1), (5240, 1)):
    i = S_(s_); d_ = BD[sd][i] + 5; p = off(i, sd * d_); p.z = ground_z(p.x, p.y)[0] - 0.2
    if not in_poly(p.x, p.y, PODIUM): add_poplar(p, Dn.uniform(0.9, 1.1))
pm = scatter('VE poplars', poplar, PL)
for m in pm.materials:      # dark, like cypress
    if m and m.node_tree:
        P = m.node_tree.nodes.get('Principled BSDF')
        if P and P.inputs['Base Color'].is_linked:
            mx = m.node_tree.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1; mx.inputs[7].default_value = (0.34, 0.46, 0.34, 1)
            m.node_tree.links.new(P.inputs['Base Color'].links[0].from_socket, mx.inputs[6]); m.node_tree.links.new(mx.outputs[2], P.inputs['Base Color'])
AR.done(); DEC_.done()
