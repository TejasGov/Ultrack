"""Morro Noturno's race furniture, exec'd by build_morro.py after morro_kit.py (needs its Sheet, emit_mat, clip_mat, LAMPS, ROOFS, POLES, CORN, MASTS, GARAGE, outside,
beach_side, in_stretch): what a street race on a hillside neighbourhood puts up for the weekend, as the city circuits do (Monaco, Baku, Macau, Singapore at night).
  start          a steel gantry over the line with the start lights, a checkered band on it; the grid's boxes are road()'s; the teams' pit garages along the start straight's
                 right side before the line, shutters up and lit, each in its team's colours (assets/teams/teams.json); strings of bulbs across the drag strip
  hoardings      sponsor boards on steel frames on the pavement behind the blocks, in runs along every straight, clear of the poles (tex/ads_6x1.png, make_decor_tex.py)
  boards         300 / 200 / 100 before each braking zone and the corner's number at its turn-in, on posts on the outside
  tyre walls     bolted stacks faced with a belt across the blocks on the outside of every corner, where a car arrives first (the collision wall's own face)
  marshal posts  a steel cabin with its plate and a lit window, one every 400 m or so
  light towers   lattice masts with banks of floods at each corner's turn-in and apex, on squares morro_kit.py leaves in the frontage (lights.json, `h` 22)
  people         the neighbourhood on its roofs over the corners and along the fences (the stands' crowd sheet, as Llano and Cheongsan)
  dressing       strings of little flags across the street (bandeirinhas), Brazil's flag hung from windows"""
DR = random.Random(77)
MAT.update({
    'ads': emit_mat('MN | hoardings', TX / 'ads_6x1.png', strength=0.35, rough=0.45),
    'boards': emit_mat('MN | boards', TX / 'boards.png', strength=0.3, rough=0.45),
    'flag': emit_mat('MN | flag', TX / 'flag.png', strength=0.08, rough=0.8),
    'tyres': material('MN | tyre wall', rough=0.85),
    'crowd': clip_mat('MN | crowd', ROOT / 'tracks' / 'qingshan' / 'tex' / 'crowd_rows.png', 0.9),
    'steel': material('MN | steel', (0.36, 0.37, 0.38), 0.45, 0.7),
    'hut': material('MN | cabin', tex='painted_metal_shutter', vcol=True),
    'cloth': material('MN | cloth', tex='white_plaster_02', vcol=True),
    'flood': emit_mat('MN mast glow night', col=(1.0, 0.95, 0.86), strength=20.0),
    'lights': emit_mat('MN | start lights', LT / 'start_lights.png', strength=1.2, rough=0.4),
    'paint': material('MN | team paint', (1, 1, 1), 0.5, vcol=True),
})
for k_ in ('ads', 'boards', 'flag', 'lights'):      # their pictures are their colour too: the emission only lifts them a little under the lamps
    nt_ = MAT[k_].node_tree; nt_.links.new(next(n for n in nt_.nodes if n.type == 'TEX_IMAGE').outputs['Color'], nt_.nodes['Principled BSDF'].inputs['Base Color'])
_tn = MAT['tyres'].node_tree; _ti = _tn.nodes.new('ShaderNodeTexImage'); _ti.image = image(ROOT / 'tracks' / 'qingshan' / 'tex' / 'tyres.png'); _tn.links.new(_ti.outputs['Color'], _tn.nodes['Principled BSDF'].inputs['Base Color'])
UVS.update({'hut': 1.5, 'cloth': 1.0})
DC = Sheet('MN race dressing', ['ads', 'boards', 'flag', 'tyres', 'crowd', 'steel', 'hut', 'cloth', 'iron', 'conc', 'shopglow', 'lights', 'paint', 'shutter', 'door'])
FG = Sheet('MN mast glow night', ['flood'])
Z_ = Vector((0, 0, 1))
def lin(h):
    h = h.lstrip('#'); c = [int(h[k:k + 2], 16) / 255 for k in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)
def dist_s(i, j): return abs(((i - j + N // 2) % N) - N // 2) * STEP
def panel(c, w, h, f, k, rect, back=True):
    """a flat picture facing f (toward the viewer), bottom centre c; rect u0, u1, v0, v1 (Llano's panel)"""
    f = Vector((f.x, f.y, 0)).normalized(); r = Vector((-f.y, f.x, 0)); u0, u1, v0, v1 = rect; a, b = c - r * w / 2, c + r * w / 2
    DC.face([a, b, b + Z_ * h, a + Z_ * h], k, uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    if back:
        DC.face([b - f * 0.3, a - f * 0.3, a - f * 0.3 + Z_ * h, b - f * 0.3 + Z_ * h], 'steel')      # 30 cm: closer and the web pack's rounding brings it through the picture
        for e in (a, b): DC.box(lambda x, y, z, e=e: e - f * 0.15 + Vector((x, y, z)), -0.05, 0.05, -0.05, 0.05, -c.z + e.z - 1.2, h + 0.1, 'steel', top=False)
def r6(q): return 0.002, 0.998, 1 - (q + 1) / 8 + 0.002, 1 - q / 8 - 0.002
def rb(q): return (q % 4) / 4 + 0.002, (q % 4 + 1) / 4 - 0.002, 1 - (q // 4 + 1) / 4 + 0.002, 1 - (q // 4) / 4 - 0.002
TO_ROAD = lambda i, sd: -(NL[i] * sd).to_3d()
def clear_of_poles(i, sd, half): return all(not (psd == sd and dist_s(pi, i) < half + 0.8) for pi, psd, _ in POLES)
def in_garage(i, sd): return sd == -1 and GARAGE[0] - 6 <= (i * STEP) <= GARAGE[1] + 30      # the pit garages and the gantry's foot
# ---- hoardings: runs of boards along every straight, the side changing run by run
n_h = 0
STRAIGHTS = [(CORN[k][2] + 45, CORN[(k + 1) % len(CORN)][1] - 35 + (LAP if k == len(CORN) - 1 else 0)) for k in range(len(CORN))] if len(CORN) > 1 else []
for s0, s1 in STRAIGHTS:
    s_ = s0 + DR.uniform(0, 20); sd = 1 if DR.random() < 0.5 else -1
    while s_ + 9 <= s1:
        q = DR.randrange(8)
        for _ in range(DR.randrange(5, 10)):
            if s_ + 9 > s1: break
            i = st(s_ + 4.5)
            if in_stretch(i) and clear_of_poles(i, sd, 4.6) and not in_garage(i, sd): panel(off(i, sd * (BD[sd][i] + 0.75), 0.95), 9.0, 1.25, TO_ROAD(i, sd), 'ads', r6(q % 8)); n_h += 1
            s_ += 9.2; q += 1
        s_ += DR.uniform(40, 80); sd = -sd
# ---- distance boards and corner numbers, the outside of each braking zone
for k, (n_, tin, apex, sd) in enumerate(CORN):
    prev_apex = CORN[k - 1][2] - (LAP if k == 0 else 0)
    for d_, q in ((300, 0), (200, 1), (100, 2)):
        if tin - d_ < prev_apex + 40 or not in_stretch(st(tin - d_)): continue      # a braking zone shorter than the boards: T6 after T5, and the like
        i = st(tin - d_); c = off(i, sd * (BD[sd][i] + 0.9), 1.6); f = (-T[i].to_3d() * 0.85 - NL[i].to_3d() * sd * 0.5)
        panel(c, 1.5, 0.75, f, 'boards', rb(q))
    i = st(tin); c = off(i, sd * (BD[sd][i] + 0.9), 1.4); panel(c, 0.9, 0.9, -T[i].to_3d() * 0.8 - NL[i].to_3d() * sd * 0.6, 'boards', rb(2 + n_))
# ---- tyre walls across the outside's blocks, from the turn-in to past the apex
for n_, tin, apex, sd in CORN:
    s_ = tin - 10
    while s_ < apex + 35:
        i, j = st(s_), st(s_ + 2.5); a, b = off(i, sd * (BD[sd][i] - 0.03), -0.05), off(j, sd * (BD[sd][j] - 0.03), -0.05)
        DC.face([a, b, b + Z_ * 1.12, a + Z_ * 1.12], 'tyres', uv=[(s_ / 5.4, 0), ((s_ + 2.5) / 5.4, 0), ((s_ + 2.5) / 5.4, 1.12 / 1.8), (s_ / 5.4, 1.12 / 1.8)])
        o_ = NL[i].to_3d() * sd * 0.62; DC.face([a + Z_ * 1.12, b + Z_ * 1.12, b + o_ + Z_ * 1.12, a + o_ + Z_ * 1.12], 'iron')
        s_ += 2.5
# ---- marshal posts, about every 400 m, on whichever side is clear
n_m = 0
def marshal(i, sd):
    global n_m
    c = off(i, sd * (BD[sd][i] + 1.6), 0.15); ex = T[i].to_3d() * sd; ey = Vector((-ex.y, ex.x, 0)); P = lambda x, y, z, c=c, ex=ex, ey=ey: c + ex * x + ey * y + Z_ * z
    DC.box(P, -1.1, 1.1, 0.0, 1.3, 0.0, 2.3, 'hut', (0.9, 0.45, 0.12)); DC.box(P, -1.25, 1.25, -0.15, 1.45, 2.3, 2.42, 'steel', bottom=True)
    DC.face([P(-0.9, -0.02, 1.2), P(0.9, -0.02, 1.2), P(0.9, -0.02, 2.0), P(-0.9, -0.02, 2.0)], 'shopglow')
    panel(P(0, -0.04, 2.46), 1.2, 0.6, -ey, 'boards', rb(15), back=False); n_m += 1
s_ = 150.0
while s_ < LAP - 150:
    for ds in (0, 12, -12, 24, -24):
        i = st(s_ + ds); sd = 1 if (int(s_ / 400) % 2) else -1
        if not in_stretch(i): break
        if all(dist_s(i, st(t_)) > 20 for _, t_, a_, _ in CORN) and clear_of_poles(i, sd, 1.6) and not in_garage(i, sd) and not beach_side(i, sd) and all(not (msd == sd and dist_s(mi, i) < 8) for mi, msd in MASTS):
            marshal(i, sd); break
    s_ += 400
# ---- light towers: a lattice mast and a bank of floods on each square morro_kit.py kept
n_t = 0
def mast(c, aim):
    global n_t
    hgt, r0, r1 = 22.0, 0.8, 0.4; legs = [(1, 1), (1, -1), (-1, -1), (-1, 1)]
    for sx, sy in legs: DC.box(lambda x, y, z: c + Vector((sx * (r0 + (r1 - r0) * z / hgt) + x, sy * (r0 + (r1 - r0) * z / hgt) + y, z)), -0.07, 0.07, -0.07, 0.07, 0, hgt, 'steel', top=False)
    for z in np.arange(2.5, hgt, 3.0):
        r_ = r0 + (r1 - r0) * z / hgt
        for (ax, ay), (bx, by) in zip(legs, legs[1:] + legs[:1]):
            a, b = c + Vector((ax * r_, ay * r_, z)), c + Vector((bx * r_, by * r_, z)); t_ = (b - a).normalized(); n2 = t_.cross(Z_) * 0.04
            DC.face([a - Z_ * 0.04, b - Z_ * 0.04, b + Z_ * 0.04, a + Z_ * 0.04], 'steel'); DC.face([a - n2, b - n2, b + n2, a + n2], 'steel')
    f = Vector((aim.x, aim.y, 0)).normalized(); r = Vector((-f.y, f.x, 0)); hc = c + Z_ * hgt
    DC.box(lambda x, y, z: hc + r * x + f * y + Z_ * z, -1.8, 1.8, -0.15, 0.15, -0.1, 0.1, 'steel')
    for row in (0, 1):
        for q in range(4):
            fc = hc + r * (-1.35 + q * 0.9) + f * 0.25 + Z_ * (0.35 + row * 0.6)
            DC.box(lambda x, y, z, fc=fc: fc + r * x + f * y + Z_ * z, -0.3, 0.3, -0.25, 0.1, -0.22, 0.22, 'steel')
            FG.face([fc + r * -0.26 + f * 0.105 + Z_ * -0.18, fc + r * 0.26 + f * 0.105 + Z_ * -0.18, fc + r * 0.26 + f * 0.105 + Z_ * 0.18, fc + r * -0.26 + f * 0.105 + Z_ * 0.18], 'flood')
    LAMPS.append((hc + f * 6 - Z_ * 1.0, '#fff1dc', 22)); n_t += 1
for i, sd in MASTS: mast(off(i, sd * (BD[sd][i] + 2.2), 0.15), TO_ROAD(i, sd))
# ---- people: on the roofs over the corners, behind the fences on the outsides
n_p = 0
for O, ex, w, h_ in ROOFS:
    j_, _ = near(O.x, O.y)
    if not any(dist_s(j_, st(apex)) < 70 for n_, tin, apex, sd in CORN) or DR.random() < 0.45: continue
    ey = Vector((-ex.y, ex.x, 0)); var = DR.randrange(4)
    for row, (dy, dz) in enumerate(((0.5, 0.0), (1.4, 0.35))):
        a, b = O + ex * (-w / 2 + 0.3) + ey * dy + Z_ * (h_ + dz), O + ex * (w / 2 - 0.3) + ey * dy + Z_ * (h_ + dz); u0 = DR.uniform(0, 3)
        DC.face([a, b, b + Z_ * 1.15, a + Z_ * 1.15], 'crowd', uv=[(u0, var / 4), (u0 + (w - 0.6) / 14, var / 4), (u0 + (w - 0.6) / 14, (var + 1) / 4), (u0, (var + 1) / 4)]); n_p += 1
for n_, tin, apex, sd in CORN:
    for s_ in np.arange(tin - 30, apex + 40, 4.0):
        i = st(s_); a, b = off(i, sd * (BD[sd][i] + 1.3), 0.15), off(st(s_ + 4), sd * (BD[sd][st(s_ + 4)] + 1.3), 0.15); var = DR.randrange(4); u0 = DR.uniform(0, 3)
        if any(msd == sd and dist_s(mi, i) < 3.5 for mi, msd in MASTS): continue      # the mast's foot
        DC.face([a, b, b + Z_ * 1.15, a + Z_ * 1.15], 'crowd', uv=[(u0, var / 4), (u0 + 4 / 14, var / 4), (u0 + 4 / 14, (var + 1) / 4), (u0, (var + 1) / 4)]); n_p += 1
# ---- strings of little flags across the morro's streets, bulbs across the drag strip, and the flag from a window
COLS = [(0.85, 0.1, 0.08), (0.95, 0.78, 0.1), (0.1, 0.55, 0.2), (0.12, 0.3, 0.8), (0.95, 0.45, 0.08), (0.9, 0.3, 0.55), (0.92, 0.92, 0.9)]
def drag_strip(s): return s > LAP - 520 or s < 560
n_b = n_l = 0
s_ = (STRETCH[0] if STRETCH else 0) + 20
while s_ < (STRETCH[1] if STRETCH else LAP):
    i, j = st(s_), st(s_ + DR.uniform(-8, 8))
    if beach_side(i, 1) or beach_side(i, -1) or in_garage(i, -1): s_ += DR.uniform(28, 45); continue
    a, b = off(i, SHELF - 0.4, DR.uniform(6.0, 7.5)), off(j, -(SHELF - 0.4), DR.uniform(6.0, 7.5)); L_ = (b - a).length
    if drag_strip(s_):      # a festoon: a wire, warm bulbs every 1.2 m, their light as three lamps along it
        wire(a, b, 0.9); m_ = int(L_ / 1.2)
        for q in range(1, m_):
            t0 = q / m_; p = a.lerp(b, t0) - Z_ * (0.9 * 4 * t0 * (1 - t0)) - Z_ * 0.1; u = (b - a).normalized() * 0.05
            LG.face([p - u - Z_ * 0.05, p + u - Z_ * 0.05, p + u + Z_ * 0.05, p - u + Z_ * 0.05], 'lamp')
        for t0 in (0.2, 0.5, 0.8): LAMPS.append((a.lerp(b, t0) - Z_ * (0.9 * 4 * t0 * (1 - t0) + 0.3), '#ffcf8a', 4.0))
        n_l += 1; s_ += DR.uniform(22, 30); continue
    m_ = int(L_ / 0.55)
    for q in range(m_):
        t0 = q / m_; p = a.lerp(b, t0) - Z_ * (1.1 * 4 * t0 * (1 - t0)); u = (b - a).normalized() * 0.16
        DC.face([p - u, p + u, p - Z_ * 0.32], 'cloth', COLS[DR.randrange(len(COLS))], uv=[(0, 0), (0.3, 0), (0.15, 0.3)])
    n_b += 1; s_ += DR.uniform(28, 45)
n_f = 0
for O, ex, w, h_ in ROOFS:
    if DR.random() > 0.05: continue
    ey = Vector((-ex.y, ex.x, 0)); c = O - ey * 0.05 + Z_ * min(h_ - 1.6, 4.0) + ex * DR.uniform(-w / 4, w / 4)
    DC.face([c - ex * 0.8, c + ex * 0.8, c + ex * 0.8 + Z_ * 1.12, c - ex * 0.8 + Z_ * 1.12], 'flag', uv=[(0, 0), (1, 0), (1, 1), (0, 1)]); n_f += 1
# ---- the orla's kiosks: little bars on the sand side of the promenade, counter lit, a sign over it, an awning
n_k = 0; s_ = 900.0
while s_ < 2000:
    i = st(s_)
    sd = 1 if beach_side(i, 1) else -1
    if in_stretch(i) and beach_side(i, sd) and clear_of_poles(i, sd, 3.0):
        ex = T[i].to_3d() * sd; ey = Vector((-ex.y, ex.x, 0)); O = off(i, sd * (SHELF + 1.2), 0.15); P = lambda x, y, z, O=O, ex=ex, ey=ey: O + ex * x + ey * y + Z_ * z
        DC.box(P, -2.2, 2.2, 0.0, 3.2, 0.0, 2.9, 'hut', (0.95, 0.95, 0.92))
        DC.face([P(-1.9, -0.02, 1.0), P(1.9, -0.02, 1.0), P(1.9, -0.02, 2.2), P(-1.9, -0.02, 2.2)], 'shopglow')
        DC.box(P, -2.4, 2.4, -1.4, 0.0, 2.55, 2.65, 'cloth', (0.9, 0.5, 0.15) if n_k % 2 else (0.15, 0.45, 0.8), bottom=True)
        cell = DR.randrange(SIGN_CELLS); cu, cv = cell % 2, cell // 2
        SG.face([P(-1.6, -0.05, 2.95), P(1.6, -0.05, 2.95), P(1.6, -0.05, 3.75), P(-1.6, -0.05, 3.75)], 'signs', uv=[(cu / 2 + 0.004, 1 - (cv + 1) / 8 + 0.004), ((cu + 1) / 2 - 0.004, 1 - (cv + 1) / 8 + 0.004), ((cu + 1) / 2 - 0.004, 1 - cv / 8 - 0.004), (cu / 2 + 0.004, 1 - cv / 8 - 0.004)])
        LAMPS.append((P(0, -0.8, 2.4), '#ffd9a0', 3.0)); n_k += 1
    s_ += DR.uniform(95, 140)
log('orla kiosks', n_k)
# ---- the start: the gantry over the line, the teams' pit garages before it
if in_stretch(0):
    i = 0; t_ = T[i].to_3d(); lat = {sd: BD[sd][i] + 0.7 for sd in (1, -1)}
    for sd in (1, -1):      # two lattice-free steel posts, the beam between them, the lights hung under it facing the grid
        c = off(i, sd * lat[sd], 0.0); DC.box(lambda x, y, z, c=c: c + t_ * x + NL[i].to_3d() * y + Z_ * z, -0.3, 0.3, -0.3, 0.3, -0.3, 7.6, 'steel', top=False)
    a, b = off(i, lat[1] + 0.3, 6.6), off(i, -lat[-1] - 0.3, 6.6); e_ = NL[i].to_3d()
    DC.box(lambda x, y, z: b + t_ * x + e_ * y + Z_ * z, -0.45, 0.45, 0.0, (a - b).length, 0.0, 1.0, 'steel', bottom=True)
    for row in range(2):      # a checkered band along the beam's face, toward the grid
        for q in range(int((a - b).length / 1.0)):
            p0 = b - t_ * 0.47 + e_ * q + Z_ * (row * 0.5); DC.face([p0 + e_, p0, p0 + Z_ * 0.5, p0 + e_ + Z_ * 0.5], 'paint', (0.9, 0.9, 0.88) if (q + row) % 2 else (0.02, 0.02, 0.02))
    panel(off(i, 0, 5.2) - t_ * 0.5, 9.0, 1.1, -t_, 'lights', (0, 1, 0, 1), back=False)
    TEAMS_ = json.loads((ROOT / 'assets' / 'teams' / 'teams.json').read_text(encoding='utf8'))['teams']
    nb = len(TEAMS_); bay = (GARAGE[1] - GARAGE[0]) / nb; sd = -1
    for q, tm in enumerate(TEAMS_):      # a temporary garage: panel walls, a fascia in the team's colours, shutter rolled up, the bay lit
        s0 = GARAGE[0] + q * bay; i0 = st(s0 + bay / 2); ex = T[i0].to_3d() * sd; ey = Vector((-ex.y, ex.x, 0)); O = off(i0, sd * (SHELF - 0.6), 0.15)
        P = lambda x, y, z, O=O, ex=ex, ey=ey: O + ex * x + ey * y + Z_ * z; w = bay - 0.2; d = 9.0; pc, sc = lin(tm['colors']['primary']), lin(tm['colors']['secondary'])
        DC.box(P, -w / 2, w / 2, 0.0, d, 0.0, 4.2, 'door', (0.92, 0.92, 0.9), sides=(0, 1, 1, 1))      # side and back walls, the roof
        DC.box(P, -w / 2, w / 2, -0.15, 0.0, 3.1, 4.2, 'paint', pc, sides=(1, 1, 0, 1), bottom=True)      # the fascia
        DC.face([P(-w / 2, -0.17, 3.15), P(w / 2, -0.17, 3.15), P(w / 2, -0.17, 3.4), P(-w / 2, -0.17, 3.4)], 'paint', sc)      # its stripe
        DC.box(P, -w / 2 + 0.2, w / 2 - 0.2, 0.0, 0.3, 2.75, 3.1, 'shutter', (0.7, 0.7, 0.7), sides=(1, 0, 0, 0), bottom=True)      # the shutter rolled into its box
        DC.face([P(-w / 2 + 0.3, d - 0.05, 0.0), P(w / 2 - 0.3, d - 0.05, 0.0), P(w / 2 - 0.3, d - 0.05, 2.7), P(-w / 2 + 0.3, d - 0.05, 2.7)], 'shopglow')      # the lit bay
        DC.face([P(-w / 2 + 0.1, 0.1, 0.02), P(w / 2 - 0.1, 0.1, 0.02), P(w / 2 - 0.1, d - 0.1, 0.02), P(-w / 2 + 0.1, d - 0.1, 0.02)], 'paint', mul(pc, (0.35, 0.35, 0.35)))      # the floor mat
        LAMPS.append((P(0, d / 2, 2.9), '#f4f1ea', 3.0))
DC.done(); FG.done(); WI.done(); SG.done()
log('race dressing: hoardings', n_h, 'marshal posts', n_m, 'light towers', n_t, 'crowd cards', n_p, 'flag strings', n_b, 'festoons', n_l, 'flags', n_f)
