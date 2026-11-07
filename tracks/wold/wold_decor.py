"""Hartwell Wold's race furniture, exec'd by build_wold.py after wold_village.py (needs its Sheet, VS's materials, UPV): what a road race through an English village puts up for
the weekend, as the Isle of Man's and Ulster's road courses and Goodwood's old circuit do.
  hoardings      sponsor boards on steel frames behind the walls, in runs at the village's ends and the climb out (tex/ads_6x1.png, make_decor_tex.py: assets/sponsors marks)
  boards         300 / 200 / 100 before each braking zone and the corner's number at its turn-in, on posts on the outside
  tyre walls     bolted stacks faced with a belt across the walls on the outside of the bridge turn and the climb's right (the collision wall's own face)
  catch fence    on posts behind the wall where a car would leave the road at the bridge turn
  marshal posts  a steel cabin with its plate every few hundred metres
  people         along the pavements behind the walls, and a scaffold grandstand on the outside of the climb's right-hander under Union Flags (the stands' crowd sheet, as Llano and Cheongsan)
  bunting        strings of little flags across the high street
Only inside STRETCH for now; the start gantry, grid boxes and paddock come with the top straight."""
DR = random.Random(77)
LT = ROOT / 'tracks' / 'llano' / 'tex'
def img_mat(name, png, rough=0.5, clip=False, emit=0.0):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P_ = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(png); nt.links.new(it.outputs['Color'], P_.inputs['Base Color']); P_.inputs['Roughness'].default_value = rough
    if clip: gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5; nt.links.new(it.outputs['Alpha'], gt.inputs[0]); nt.links.new(gt.outputs[0], P_.inputs['Alpha'])
    return m
MAT.update({
    'ads': img_mat('HW | hoardings', TX / 'ads_6x1.png', 0.45), 'boards': img_mat('HW | boards', TX / 'boards.png', 0.45), 'flag': img_mat('HW | flag', TX / 'flag.png', 0.8),
    'tyres': img_mat('HW | tyre wall', ROOT / 'tracks' / 'qingshan' / 'tex' / 'tyres.png', 0.85), 'crowd': img_mat('HW | crowd', ROOT / 'tracks' / 'qingshan' / 'tex' / 'crowd_rows.png', 0.9, clip=True),
    'fence': img_mat('HW | fence', LT / 'fence.png', 0.5, clip=True), 'steel': material('HW | steel', (0.36, 0.37, 0.38), 0.45, 0.7),
    'hut': material('HW | cabin', tex='painted_metal_shutter', vcol=True), 'cloth': material('HW | cloth', tex='white_plaster_02', vcol=True), 'plank': material('HW | scaffold boards', tex='weathered_planks', vcol=True),
})
UVS.update({'hut': 1.5, 'cloth': 1.0, 'plank': 1.6})
DC = Sheet('HW race dressing', ['ads', 'boards', 'flag', 'tyres', 'crowd', 'fence', 'steel', 'hut', 'cloth', 'plank', 'iron', 'glass'])
Z_ = UPV
def panel(c, w, h, f, k, rect, back=True):
    f = Vector((f.x, f.y, 0)).normalized(); r = Vector((-f.y, f.x, 0)); u0, u1, v0, v1 = rect; a, b = c - r * w / 2, c + r * w / 2
    DC.face([a, b, b + Z_ * h, a + Z_ * h], k, uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)], out=f)
    if back:
        DC.face([b - f * 0.3, a - f * 0.3, a - f * 0.3 + Z_ * h, b - f * 0.3 + Z_ * h], 'steel', out=-f)
        for e in (a, b): DC.box(lambda x, y, z, e=e: e - f * 0.15 + Vector((x, y, z)), -0.05, 0.05, -0.05, 0.05, -1.3, h + 0.1, 'steel', top=False)
def r6(q): return 0.002, 0.998, 1 - (q + 1) / 8 + 0.002, 1 - q / 8 - 0.002
def rb(q): return (q % 4) / 4 + 0.002, (q % 4 + 1) / 4 - 0.002, 1 - (q // 4 + 1) / 4 + 0.002, 1 - (q // 4) / 4 - 0.002
TO_ROAD = lambda i, sd: -(NL[i] * sd).to_3d()
CORN = [(c['n'], c['at'] - c['radius'] * math.radians(c['turn']) / 2, c['at'], 1 if c['hand'] == 'R' else -1) for c in SRC['corners']]
CORN = [c for c in CORN if in_stretch(st(c[2]))]
log('corners in the stretch', [(c[0], round(c[1]), c[3]) for c in CORN])
# ---- hoardings
n_h = 0
for s0, s1, sd in ((2585, 2660, 1), (2585, 2660, -1), (3040, 3130, -1), (3395, 3475, 1)):
    s_ = s0; q = DR.randrange(8)
    while s_ + 9 <= s1:
        i = st(s_ + 4.5)
        if in_stretch(i): panel(off(i, sd * (BD[sd][i] + 0.85), 0.9), 9.0, 1.25, TO_ROAD(i, sd), 'ads', r6(q % 8)); n_h += 1
        s_ += 9.2; q += 1
# ---- distance boards, corner numbers
for n_, tin, apex, sd in CORN:
    for d_, q in ((300, 0), (200, 1), (100, 2)):
        if tin - d_ < STRETCH[0] - 200 or n_ != 5: continue      # the bridge turn only: the climb's right follows it too closely
        i = st(tin - d_); panel(off(i, sd * (BD[sd][i] + 0.9), 1.6), 1.5, 0.75, -T[i].to_3d() * 0.85 - NL[i].to_3d() * sd * 0.5, 'boards', rb(q))
    i = st(tin); panel(off(i, sd * (BD[sd][i] + 0.9), 1.4), 0.9, 0.9, -T[i].to_3d() * 0.8 - NL[i].to_3d() * sd * 0.6, 'boards', rb(2 + n_))
# ---- tyre walls and catch fence on the outsides
for n_, tin, apex, sd in CORN:
    s_ = tin - 10
    while s_ < apex + 30:
        i, j = st(s_), st(s_ + 2.5)
        if BRIDGE[i] or BRIDGE[j]: s_ += 2.5; continue      # the parapet stays stone
        a, b = off(i, sd * (BD[sd][i] - 0.03), -0.05), off(j, sd * (BD[sd][j] - 0.03), -0.05); o_ = NL[i].to_3d() * sd
        DC.face([a, b, b + Z_ * 1.12, a + Z_ * 1.12], 'tyres', uv=[(s_ / 5.4, 0), ((s_ + 2.5) / 5.4, 0), ((s_ + 2.5) / 5.4, 1.12 / 1.8), (s_ / 5.4, 1.12 / 1.8)], out=-o_)
        DC.face([a + Z_ * 1.12, b + Z_ * 1.12, b + o_ * 0.6 + Z_ * 1.12, a + o_ * 0.6 + Z_ * 1.12], 'iron', out=Z_)
        if n_ == 5:
            fa, fb = off(i, sd * (BD[sd][i] + 0.75), 0.6), off(j, sd * (BD[sd][j] + 0.75), 0.6); L_ = (fb - fa).length
            DC.face([fa, fb, fb + Z_ * 3.4, fa + Z_ * 3.4], 'fence', uv=[(s_, 0), (s_ + L_, 0), (s_ + L_, 3.4), (s_, 3.4)], out=-o_)
            if int(s_ / 2.5) % 2 == 0: DC.box(lambda x, y, z, fa=fa: fa + Vector((x, y, z)), -0.04, 0.04, -0.04, 0.04, -0.7, 3.5, 'steel', top=False)
        s_ += 2.5
# ---- marshal posts
n_m = 0
for s_, sd in ((2650, 1), (2960, -1), (3330, -1), (3460, -1)):
    i = st(s_)
    if not in_stretch(i) or BRIDGE[i]: continue
    c = off(i, sd * (BD[sd][i] + 1.8), 0.12); c.z = max(c.z, ground_at(c.x, c.y)); ex = T[i].to_3d() * sd; ey = Vector((-ex.y, ex.x, 0)); P = lambda x, y, z, c=c, ex=ex, ey=ey: c + ex * x + ey * y + Z_ * z
    DC.box(P, -1.1, 1.1, 0.0, 1.3, 0.0, 2.3, 'hut', (0.9, 0.45, 0.12)); DC.box(P, -1.25, 1.25, -0.15, 1.45, 2.3, 2.42, 'steel', bottom=True)
    DC.face([P(-0.9, -0.02, 1.2), P(0.9, -0.02, 1.2), P(0.9, -0.02, 2.0), P(-0.9, -0.02, 2.0)], 'glass', out=-ey)
    panel(P(0, -0.04, 2.46), 1.2, 0.6, -ey, 'boards', rb(15), back=False); n_m += 1
# ---- people along the high street's pavements, behind the walls
n_p = 0
for sd in (1, -1):
    s_ = 2610.0
    while s_ < 3140:
        i, j = st(s_), st(s_ + 4)
        if VILLAGE[i] and DR.random() < 0.55:
            a, b = off(i, sd * (BD[sd][i] + 1.1), 0.12), off(j, sd * (BD[sd][j] + 1.1), 0.12); var = DR.randrange(4); u0 = DR.uniform(0, 3)
            DC.face([a, b, b + Z_ * 1.15, a + Z_ * 1.15], 'crowd', uv=[(u0, var / 4), (u0 + 4 / 14, var / 4), (u0 + 4 / 14, (var + 1) / 4), (u0, (var + 1) / 4)], out=TO_ROAD(i, sd)); n_p += 1
        s_ += 4.0
# ---- a scaffold grandstand on the outside of the climb's right-hander: tube frame, board seats, the crowd, flags on its corners
G6 = next((c for c in CORN if c[0] == 6), None)
if G6:
    n_, tin, apex, sd = G6; G0, G1 = tin - 40, apex + 10; lat0 = None; rows = 9; TREAD, RISE = 0.8, 0.45
    for s_ in np.arange(G0, G1, 2.0):
        i, j = st(s_), st(s_ + 2.0); l_ = BD[sd][i] + 4.0
        gi = ground_at(*off(i, sd * l_).to_2d()); gj = ground_at(*off(j, sd * l_).to_2d())
        for k in range(rows):
            zi, zj = gi + 0.6 + k * RISE, gj + 0.6 + k * RISE; d0, d1 = l_ + k * TREAD, l_ + (k + 1) * TREAD
            A, B = off(i, sd * d0), off(j, sd * d0); Cq, Dq = off(j, sd * d1), off(i, sd * d1)
            for p_ in (A, B, Cq, Dq): p_.z = 0
            DC.face([A + Z_ * zi, B + Z_ * zj, Cq + Z_ * zj, Dq + Z_ * zi], 'plank', (0.8, 0.75, 0.68), out=Z_)
            DC.face([A + Z_ * (zi - RISE), B + Z_ * (zj - RISE), B + Z_ * zj, A + Z_ * zi], 'plank', (0.55, 0.52, 0.48), out=TO_ROAD(i, sd))
            var = (k + int(s_)) % 4; u0 = s_ / 14 + k * 0.37; cp, cq = off(i, sd * (d0 + 0.3)), off(j, sd * (d0 + 0.3)); cp.z, cq.z = zi, zj
            DC.face([cp, cq, cq + Z_ * 1.15, cp + Z_ * 1.15], 'crowd', uv=[(u0, var / 4), (u0 + 2 / 14, var / 4), (u0 + 2 / 14, (var + 1) / 4), (u0, (var + 1) / 4)], out=TO_ROAD(i, sd)); n_p += 1
        if int(s_) % 4 == 0:      # the tube frame behind, uprights and a ledger
            for k in (0, rows // 2, rows): p_ = off(i, sd * (l_ + k * TREAD)); DC.box(lambda x, y, z, p_=p_, g=gi: Vector((p_.x, p_.y, g)) + Vector((x, y, z)), -0.03, 0.03, -0.03, 0.03, -0.3, 0.6 + k * RISE, 'steel', top=False)
    for s_ in (G0, G1):      # flags on the corners
        i = st(s_); p_ = off(i, sd * (BD[sd][i] + 4.0 + rows * TREAD)); g = ground_at(p_.x, p_.y); p_.z = g
        DC.box(lambda x, y, z: p_ + Vector((x, y, z)), -0.04, 0.04, -0.04, 0.04, 0, 9.0, 'steel', top=False); r_ = T[i].to_3d()
        DC.face([p_ + Z_ * 7.4, p_ + r_ * 2.4 + Z_ * 7.4, p_ + r_ * 2.4 + Z_ * 8.6, p_ + Z_ * 8.6], 'flag', uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
# ---- bunting across the high street
COLS = [(0.8, 0.08, 0.1), (0.95, 0.95, 0.92), (0.08, 0.18, 0.55)]
n_b = 0; s_ = 2620.0
while s_ < 3120:
    i, j = st(s_), st(s_ + DR.uniform(-6, 6)); a, b = off(i, SHELF - 0.3, DR.uniform(5.4, 6.2)), off(j, -(SHELF - 0.3), DR.uniform(5.4, 6.2))
    L_ = (b - a).length; m_ = int(L_ / 0.5)
    for q in range(m_):
        t0 = q / m_; p = a.lerp(b, t0) - Z_ * (0.9 * 4 * t0 * (1 - t0)); u = (b - a).normalized() * 0.15
        DC.face([p - u, p + u, p - Z_ * 0.3], 'cloth', COLS[q % 3], uv=[(0, 0), (0.3, 0), (0.15, 0.3)])
    n_b += 1; s_ += DR.uniform(35, 55)
DC.done()
log('race dressing: hoardings', n_h, 'marshal posts', n_m, 'crowd cards', n_p, 'bunting strings', n_b)
