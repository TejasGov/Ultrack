"""Hartwell Wold's race furniture, exec'd by build_wold.py after wold_village.py (needs its Sheet, VS's materials, UPV, AF, HANG0..AIR1): what a road race through English country
puts up for the weekend, as the Isle of Man's and Ulster's road courses and Goodwood's old circuit do.
  start          a steel gantry over the line with the start lights and a checkered band; the grid's boxes are road()'s; the teams' pit garages on the airfield's apron,
                 north of the top straight before the line (assets/teams/teams.json colours); a scaffold grandstand across from them
  hoardings      sponsor boards on steel frames behind the walls, in runs along every straight (tex/ads_6x1.png, make_decor_tex.py: assets/sponsors marks)
  boards         300 / 200 / 100 before each braking zone and the corner's number at its turn-in, on posts on the outside
  tyre walls     bolted stacks faced with a belt across the walls on the outside of every corner (the collision wall's own face); never on the bridge's parapet
  catch fence    on posts behind the wall where a car arrives fastest: T1 over the brow, the hairpin, the bridge turn
  marshal posts  a steel cabin with its plate, about every 400 m
  people         along the high street's pavements, on the banks behind the walls at the corners, in scaffold grandstands at T1, T6 and the start, under Union Flags
  bunting        strings of little flags across the high street"""
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
    'lights': img_mat('HW | start lights', LT / 'start_lights.png', 0.4), 'paint': material('HW | team paint', (1, 1, 1), 0.5, vcol=True),
    'shutter': material('HW | roller shutter', tex='rusted_shutter', vcol=True), 'bay': material('HW | garage bay', (0.9, 0.88, 0.84), 0.5, emit=((1.0, 0.95, 0.85), 0.6)),
})
UVS.update({'hut': 1.5, 'cloth': 1.0, 'plank': 1.6, 'shutter': 2.5})
DC = Sheet('HW race dressing', ['ads', 'boards', 'flag', 'tyres', 'crowd', 'fence', 'steel', 'hut', 'cloth', 'plank', 'iron', 'glass', 'lights', 'paint', 'shutter', 'bay', 'runway'])
Z_ = UPV
def lin(h):
    h = h.lstrip('#'); c = [int(h[k:k + 2], 16) / 255 for k in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)
def dist_s(i, j): return abs(((i - j + N // 2) % N) - N // 2) * STEP
def panel(c, w, h, f, k, rect, back=True):
    f = Vector((f.x, f.y, 0)).normalized(); r = Vector((-f.y, f.x, 0)); u0, u1, v0, v1 = rect; a, b = c - r * w / 2, c + r * w / 2
    DC.face([a, b, b + Z_ * h, a + Z_ * h], k, uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)], out=f)
    if back:
        DC.face([b - f * 0.3, a - f * 0.3, a - f * 0.3 + Z_ * h, b - f * 0.3 + Z_ * h], 'steel', out=-f)
        for e in (a, b): DC.box(lambda x, y, z, e=e: e - f * 0.15 + Vector((x, y, z)), -0.05, 0.05, -0.05, 0.05, -1.3, h + 0.1, 'steel', top=False)
def r6(q): return 0.002, 0.998, 1 - (q + 1) / 8 + 0.002, 1 - q / 8 - 0.002
def rb(q): return (q % 4) / 4 + 0.002, (q % 4 + 1) / 4 - 0.002, 1 - (q // 4 + 1) / 4 + 0.002, 1 - (q // 4) / 4 - 0.002
TO_ROAD = lambda i, sd: -(NL[i] * sd).to_3d()
def behind(i, sd, lat, dz=0.0):
    """a point lat metres behind the wall's back face, standing on the ground there (the wall's own foot when that is higher)"""
    p = off(i, sd * (BD[sd][i] + 0.56 + lat)); p.z = max(ground_at(p.x, p.y), CL[i].z - 0.3) + dz; return p
CORN = [(c['n'], c['at'] - c['radius'] * math.radians(c['turn']) / 2, c['at'], 1 if c['hand'] == 'R' else -1) for c in SRC['corners']]
CORN = [c for c in CORN if in_stretch(st(c[2]))]
log('corners dressed', [(c[0], round(c[1]), c[3]) for c in CORN])
GARAGE = (LAP - 112.0, LAP - 16.0); GSD = 1      # the paddock: the airfield's side of the top straight, before the line
def in_garage(i, sd): return sd == GSD and GARAGE[0] - 8 <= i * STEP <= GARAGE[1] + 30
STAND_AT = {1: None, 6: None}      # corner -> its grandstand's (s0, s1, sd)
for n_, tin, apex, sd in CORN:
    if n_ in STAND_AT: STAND_AT[n_] = (tin - 40, apex + 10, sd)
STAND_AT['start'] = (GARAGE[0] + 6, GARAGE[1] - 6, -GSD)
def in_stand(i, sd): return any(v and v[2] == sd and v[0] - 6 <= i * STEP <= v[1] + 6 for v in STAND_AT.values())
# ---- hoardings: runs along every straight, the side changing run by run; never on the bridge, the garages or a stand's front
n_h = 0
STRAIGHTS = [(CORN[k][2] + 45, CORN[(k + 1) % len(CORN)][1] - 35 + (LAP if k == len(CORN) - 1 else 0)) for k in range(len(CORN))] if len(CORN) > 1 else []
for s0, s1 in STRAIGHTS:
    s_ = s0 + DR.uniform(0, 20); sd = 1 if DR.random() < 0.5 else -1
    while s_ + 9 <= s1:
        q = DR.randrange(8)
        for _ in range(DR.randrange(5, 10)):
            if s_ + 9 > s1: break
            i = st(s_ + 4.5)
            if in_stretch(i) and not BRIDGE[i] and not in_garage(i, sd) and not in_stand(i, sd): panel(off(i, sd * (BD[sd][i] + 0.85), 0.9), 9.0, 1.25, TO_ROAD(i, sd), 'ads', r6(q % 8)); n_h += 1
            s_ += 9.2; q += 1
        s_ += DR.uniform(40, 80); sd = -sd
# ---- distance boards, corner numbers
for k, (n_, tin, apex, sd) in enumerate(CORN):
    prev_apex = CORN[k - 1][2] - (LAP if k == 0 else 0)
    for d_, q in ((300, 0), (200, 1), (100, 2)):
        if tin - d_ < prev_apex + 40 or not in_stretch(st(tin - d_)) or BRIDGE[st(tin - d_)]: continue
        i = st(tin - d_); panel(off(i, sd * (BD[sd][i] + 0.9), 1.6), 1.5, 0.75, -T[i].to_3d() * 0.85 - NL[i].to_3d() * sd * 0.5, 'boards', rb(q))
    i = st(tin); panel(off(i, sd * (BD[sd][i] + 0.9), 1.4), 0.9, 0.9, -T[i].to_3d() * 0.8 - NL[i].to_3d() * sd * 0.6, 'boards', rb(2 + n_))
# ---- tyre walls on every corner's outside, catch fence where they arrive fastest
FENCED = {1, 4, 5}
for n_, tin, apex, sd in CORN:
    s_ = tin - 10
    while s_ < apex + 30:
        i, j = st(s_), st(s_ + 2.5)
        if BRIDGE[i] or BRIDGE[j]: s_ += 2.5; continue      # the parapet stays stone
        a, b = off(i, sd * (BD[sd][i] - 0.03), -0.05), off(j, sd * (BD[sd][j] - 0.03), -0.05); o_ = NL[i].to_3d() * sd
        DC.face([a, b, b + Z_ * 1.12, a + Z_ * 1.12], 'tyres', uv=[(s_ / 5.4, 0), ((s_ + 2.5) / 5.4, 0), ((s_ + 2.5) / 5.4, 1.12 / 1.8), (s_ / 5.4, 1.12 / 1.8)], out=-o_)
        DC.face([a + Z_ * 1.12, b + Z_ * 1.12, b + o_ * 0.6 + Z_ * 1.12, a + o_ * 0.6 + Z_ * 1.12], 'iron', out=Z_)
        if n_ in FENCED and not in_stand(i, sd):
            fa, fb = off(i, sd * (BD[sd][i] + 0.75), 0.6), off(j, sd * (BD[sd][j] + 0.75), 0.6); L_ = (fb - fa).length
            DC.face([fa, fb, fb + Z_ * 3.4, fa + Z_ * 3.4], 'fence', uv=[(s_, 0), (s_ + L_, 0), (s_ + L_, 3.4), (s_, 3.4)], out=-o_)
            if int(s_ / 2.5) % 2 == 0: DC.box(lambda x, y, z, fa=fa: fa + Vector((x, y, z)), -0.04, 0.04, -0.04, 0.04, -0.7, 3.5, 'steel', top=False)
        s_ += 2.5
# ---- marshal posts, about every 400 m
n_m = 0; M_AT = []
s_ = 180.0
while s_ < LAP - 150:
    for ds in (0, 12, -12, 24, -24):
        i = st(s_ + ds); sd = 1 if (int(s_ / 400) % 2) else -1
        if not in_stretch(i): break
        if not BRIDGE[i] and not TOWN[i] and all(dist_s(i, st(t_)) > 20 for _, t_, a_, _ in CORN) and not in_garage(i, sd) and not in_stand(i, sd):
            c = behind(i, sd, 1.2, 0.0); ex = T[i].to_3d() * sd; ey = Vector((-ex.y, ex.x, 0)); P = lambda x, y, z, c=c, ex=ex, ey=ey: c + ex * x + ey * y + Z_ * z
            DC.box(P, -1.1, 1.1, 0.0, 1.3, -0.4, 2.3, 'hut', (0.9, 0.45, 0.12)); DC.box(P, -1.25, 1.25, -0.15, 1.45, 2.3, 2.42, 'steel', bottom=True)
            DC.face([P(-0.9, -0.02, 1.2), P(0.9, -0.02, 1.2), P(0.9, -0.02, 2.0), P(-0.9, -0.02, 2.0)], 'glass', out=-ey)
            panel(P(0, -0.04, 2.46), 1.2, 0.6, -ey, 'boards', rb(15), back=False); n_m += 1; M_AT.append((i, sd)); break
    s_ += 400
# ---- people: the high street's pavements, the banks behind the walls at the corners
n_p = 0
def crowd(a, b, f, s_, var=None):
    global n_p
    var = DR.randrange(4) if var is None else var; u0 = DR.uniform(0, 3); L_ = (b - a).length
    DC.face([a, b, b + Z_ * 1.15, a + Z_ * 1.15], 'crowd', uv=[(u0, var / 4), (u0 + L_ / 14, var / 4), (u0 + L_ / 14, (var + 1) / 4), (u0, (var + 1) / 4)], out=f); n_p += 1
for sd in (1, -1):
    s_ = 2610.0
    while s_ < 3140:
        i, j = st(s_), st(s_ + 4)
        if VILLAGE[i] and in_stretch(i) and DR.random() < 0.55: crowd(off(i, sd * (BD[sd][i] + 1.1), 0.12), off(j, sd * (BD[sd][j] + 1.1), 0.12), TO_ROAD(i, sd), s_)
        s_ += 4.0
for n_, tin, apex, sd in CORN:
    if TOWN[st(apex)] or n_ in STAND_AT: continue
    for s_ in np.arange(tin - 30, apex + 40, 4.0):
        i, j = st(s_), st(s_ + 4)
        if BRIDGE[i] or DR.random() < 0.3: continue
        for row in range(3):      # a bank of people, three deep, stepping back up the grass
            crowd(behind(i, sd, 1.5 + row * 1.3, row * 0.15), behind(j, sd, 1.5 + row * 1.3, row * 0.15), TO_ROAD(i, sd), s_)
# ---- scaffold grandstands: tube frame, board seats, the crowd, Union Flags on the corners
def grandstand(G0, G1, sd, rows=9, TREAD=0.8, RISE=0.45, gap=3.5):
    for s_ in np.arange(G0, G1, 2.0):
        i, j = st(s_), st(s_ + 2.0); l_ = BD[sd][i] + 0.56 + gap
        gi = max(ground_at(*off(i, sd * l_).to_2d()), CL[i].z - 0.3); gj = max(ground_at(*off(j, sd * l_).to_2d()), CL[j].z - 0.3)
        for k in range(rows):
            zi, zj = gi + 0.6 + k * RISE, gj + 0.6 + k * RISE; d0, d1 = l_ + k * TREAD, l_ + (k + 1) * TREAD
            A, B = off(i, sd * d0), off(j, sd * d0); Cq, Dq = off(j, sd * d1), off(i, sd * d1)
            for p_ in (A, B, Cq, Dq): p_.z = 0
            DC.face([A + Z_ * zi, B + Z_ * zj, Cq + Z_ * zj, Dq + Z_ * zi], 'plank', (0.8, 0.75, 0.68), out=Z_)
            DC.face([A + Z_ * (zi - RISE), B + Z_ * (zj - RISE), B + Z_ * zj, A + Z_ * zi], 'plank', (0.55, 0.52, 0.48), out=TO_ROAD(i, sd))
            cp, cq = off(i, sd * (d0 + 0.3)), off(j, sd * (d0 + 0.3)); cp.z, cq.z = zi, zj; crowd(cp, cq, TO_ROAD(i, sd), s_, var=(k + int(s_)) % 4)
        if int(s_) % 4 == 0:      # the tube frame behind, uprights and a ledger
            for k in (0, rows // 2, rows): p_ = off(i, sd * (l_ + k * TREAD)); DC.box(lambda x, y, z, p_=p_, g=gi: Vector((p_.x, p_.y, g)) + Vector((x, y, z)), -0.03, 0.03, -0.03, 0.03, -0.3, 0.6 + k * RISE, 'steel', top=False)
    for s_ in (G0, G1):      # flags on the corners
        i = st(s_); p_ = off(i, sd * (BD[sd][i] + 0.56 + gap + rows * TREAD)); p_.z = ground_at(p_.x, p_.y)
        DC.box(lambda x, y, z: p_ + Vector((x, y, z)), -0.04, 0.04, -0.04, 0.04, 0, 9.0, 'steel', top=False); r_ = T[i].to_3d()
        DC.face([p_ + Z_ * 7.4, p_ + r_ * 2.4 + Z_ * 7.4, p_ + r_ * 2.4 + Z_ * 8.6, p_ + Z_ * 8.6], 'flag', uv=[(0, 0), (1, 0), (1, 1), (0, 1)], out=TO_ROAD(i, sd))
for k_, v in STAND_AT.items():
    if v and in_stretch(st(v[0])): grandstand(*v)
# ---- bunting across the high street
COLS = [(0.8, 0.08, 0.1), (0.95, 0.95, 0.92), (0.08, 0.18, 0.55)]
n_b = 0; s_ = 2620.0
while s_ < 3120:
    i, j = st(s_), st(s_ + DR.uniform(-6, 6))
    if in_stretch(i):
        a, b = off(i, SHELF - 0.3, DR.uniform(5.4, 6.2)), off(j, -(SHELF - 0.3), DR.uniform(5.4, 6.2)); L_ = (b - a).length; m_ = int(L_ / 0.5)
        for q in range(m_):
            t0 = q / m_; p = a.lerp(b, t0) - Z_ * (0.9 * 4 * t0 * (1 - t0)); u = (b - a).normalized() * 0.15
            DC.face([p - u, p + u, p - Z_ * 0.3], 'cloth', COLS[q % 3], uv=[(0, 0), (0.3, 0), (0.15, 0.3)])
        n_b += 1
    s_ += DR.uniform(35, 55)
# ---- the start: the gantry over the line, the teams' pit garages on the apron before it
if in_stretch(0):
    i = 0; t_ = T[i].to_3d(); e_ = NL[i].to_3d(); lat = {sd: BD[sd][i] + 0.85 for sd in (1, -1)}
    for sd in (1, -1):
        c = off(i, sd * lat[sd], 0.0); c.z = max(c.z, ground_at(c.x, c.y)) - 0.3; DC.box(lambda x, y, z, c=c: c + t_ * x + e_ * y + Z_ * z, -0.35, 0.35, -0.35, 0.35, 0.0, 7.9 + CL[0].z - c.z, 'steel', top=False)
    a, b = off(i, lat[1] + 0.35, 6.6), off(i, -lat[-1] - 0.35, 6.6)
    DC.box(lambda x, y, z: b + t_ * x + e_ * y + Z_ * z, -0.5, 0.5, 0.0, (a - b).length, 0.0, 1.1, 'steel', bottom=True)
    for row in range(2):
        for q in range(int((a - b).length)):
            p0 = b - t_ * 0.52 + e_ * q + Z_ * (row * 0.55); DC.face([p0 + e_, p0, p0 + Z_ * 0.55, p0 + e_ + Z_ * 0.55], 'paint', (0.9, 0.9, 0.88) if (q + row) % 2 else (0.02, 0.02, 0.02), out=-t_)
    panel(off(i, 0, 5.2) - t_ * 0.55, 9.0, 1.1, -t_, 'lights', (0, 1, 0, 1), back=False)
    TEAMS_ = json.loads((ROOT / 'assets' / 'teams' / 'teams.json').read_text(encoding='utf8'))['teams']
    nb = len(TEAMS_); bay = (GARAGE[1] - GARAGE[0]) / nb; sd = GSD; d = 9.0; lat0 = BD[sd][st(GARAGE[0])] + 6.0
    a0, a1 = off(st(GARAGE[0] - 6), sd * (lat0 - 4.5)), off(st(GARAGE[1] + 6), sd * (lat0 - 4.5)); b0, b1 = off(st(GARAGE[0] - 6), sd * (lat0 + d + 14)), off(st(GARAGE[1] + 6), sd * (lat0 + d + 14))
    zap = max(ground_at(p.x, p.y) for p in (a0, a1, b0, b1)) + 0.05
    DC.face([Vector((p.x, p.y, zap)) for p in (a0, a1, b1, b0)], 'runway', (0.85, 0.85, 0.83), out=Z_)      # the apron
    for q, tm in enumerate(TEAMS_):      # a temporary garage: panel walls, a fascia in the team's colours, shutter rolled up, the bay lit
        s0 = GARAGE[0] + q * bay; i0 = st(s0 + bay / 2); ex = T[i0].to_3d() * sd; ey = Vector((-ex.y, ex.x, 0)); O = off(i0, sd * lat0); O.z = zap
        P = lambda x, y, z, O=O, ex=ex, ey=ey: O + ex * x + ey * y + Z_ * z; w = bay - 0.2; pc, sc = lin(tm['colors']['primary']), lin(tm['colors']['secondary'])
        DC.box(P, -w / 2, w / 2, 0.0, d, -1.5, 4.2, 'hut', (0.92, 0.92, 0.9))
        DC.box(P, -w / 2, w / 2, -0.15, 0.0, 3.1, 4.2, 'paint', pc, bottom=True)
        DC.face([P(-w / 2, -0.17, 3.15), P(w / 2, -0.17, 3.15), P(w / 2, -0.17, 3.4), P(-w / 2, -0.17, 3.4)], 'paint', sc, out=-ey)
        DC.box(P, -w / 2 + 0.2, w / 2 - 0.2, -0.3, 0.0, 2.75, 3.1, 'shutter', (0.7, 0.7, 0.7), bottom=True)
        DC.face([P(-w / 2 + 0.25, -0.02, 0.0), P(w / 2 - 0.25, -0.02, 0.0), P(w / 2 - 0.25, -0.02, 2.75), P(-w / 2 + 0.25, -0.02, 2.75)], 'bay', out=-ey)      # the lit bay, seen through the open door
        DC.face([P(-w / 2 + 0.25, -0.03, 0.02), P(w / 2 - 0.25, -0.03, 0.02), P(w / 2 - 0.25, -0.03, 0.3), P(-w / 2 + 0.25, -0.03, 0.3)], 'paint', mul(pc, (0.35, 0.35, 0.35)), out=-ey)
# ---- the lane's own hedgerows: runs of hedge right behind the wall, broken by gateways and views, an oak standing out of them now and then
# (they keep clear of the corners' banks of people, the stands, the garages and the marshals; wold_village.py's GAME_INSTANCES makes them instances)
def shrub(p, sc_):
    k_ = DR.randint(4, 7); ob = bpy.data.objects.new('hedge', MASTER[f'SHRUB {k_}']); TREEC.objects.link(ob); ob.location = (p.x, p.y, p.z - 0.1)
    ob.rotation_euler = (0, 0, DR.uniform(0, 6.283)); ob.scale = (sc_, sc_, sc_ * DR.uniform(0.9, 1.2)); PLACED.append((f'SHRUB {k_}', ob.matrix_basis.copy(), 'shrub'))
def oak(p, dr):
    sp = 'tree_small_02' if DR.random() < 0.6 else 'island_tree_01'; h = DR.uniform(10, 16) / HT[sp]; lod = 'LOD0' if dr < 40 else 'LOD1'
    ob = bpy.data.objects.new(f'tree {sp}', MASTER[f'TREE {sp} {lod}']); TREEC.objects.link(ob); ob.location = (p.x, p.y, p.z - 0.15); ob.rotation_euler = (0, 0, DR.uniform(0, 6.283)); ob.scale = (h, h, h)
    PLACED.append((f'TREE {sp}', ob.matrix_basis.copy(), 0 if dr < 45 else 1))
def busy(i, sd): return TOWN[i] or BRIDGE[i] or in_garage(i, sd) or in_stand(i, sd) or any(c[3] == sd and c[1] - 35 <= i * STEP <= c[2] + 45 for c in CORN) or any(msd == sd and dist_s(mi, i) < 4 for mi, msd in M_AT)
n_rh = n_ro = 0
for sd in (1, -1):
    s_ = DR.uniform(0, 120)
    while s_ < LAP:
        run = DR.uniform(120, 380)
        for s2 in np.arange(s_, min(LAP, s_ + run), 2.2):
            i = st(s2)
            if not in_stretch(i) or busy(i, sd): continue
            p = behind(i, sd, 1.4)
            if zone(p): continue
            shrub(p, DR.uniform(1.0, 1.35)); n_rh += 1
            if DR.random() < 0.025: oak(behind(i, sd, 2.4), BD[sd][i] + 3); n_ro += 1
        s_ += run + DR.uniform(40, 160)
log('roadside hedges', n_rh, 'oaks in them', n_ro)
DC.done()
log('race dressing: hoardings', n_h, 'marshal posts', n_m, 'crowd cards', n_p, 'bunting strings', n_b)
