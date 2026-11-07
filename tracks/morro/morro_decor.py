"""Morro Noturno's race furniture, exec'd by build_morro.py after morro_kit.py (needs its Sheet, emit_mat, clip_mat, LAMPS, ROOFS, outside, in_stretch): what a street race
on a hillside neighbourhood puts up for the weekend, as the city circuits do (Monaco, Baku, Macau, Singapore at night).
  hoardings      sponsor boards on steel frames on the pavement behind the blocks, in runs along the straights (tex/ads_6x1.png, make_decor_tex.py: assets/sponsors marks)
  boards         300 / 200 / 100 before each braking zone and the corner's number at its turn-in, on posts on the outside
  tyre walls     bolted stacks faced with a belt across the blocks on the outside of every tight corner, where a car arrives first (the collision wall's own face: they replace it, never stand in front of it)
  marshal posts  a steel cabin with its plate and a lit window every few hundred metres
  light towers   lattice masts with banks of floods over the hairpins and the turn-ins (lights.json, `h` 22: the game's mast pools, as Venice's)
  people         the neighbourhood on its roofs over the hairpins and along the fences (the stands' crowd sheet, as Llano and Cheongsan)
  dressing       strings of little flags across the street (bandeirinhas), Brazil's flag hung from windows
Only inside STRETCH for now; the start gantry, grid boxes and paddock come with the drag strip."""
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
})
for k_ in ('ads', 'boards', 'flag'):      # their pictures are their colour too: the emission only lifts them a little under the lamps
    nt_ = MAT[k_].node_tree; nt_.links.new(next(n for n in nt_.nodes if n.type == 'TEX_IMAGE').outputs['Color'], nt_.nodes['Principled BSDF'].inputs['Base Color'])
_tn = MAT['tyres'].node_tree; _ti = _tn.nodes.new('ShaderNodeTexImage'); _ti.image = image(ROOT / 'tracks' / 'qingshan' / 'tex' / 'tyres.png'); _tn.links.new(_ti.outputs['Color'], _tn.nodes['Principled BSDF'].inputs['Base Color'])
UVS.update({'hut': 1.5, 'cloth': 1.0})
DC = Sheet('MN race dressing', ['ads', 'boards', 'flag', 'tyres', 'crowd', 'steel', 'hut', 'cloth', 'iron', 'conc', 'shopglow'])
FG = Sheet('MN mast glow night', ['flood'])
Z_ = Vector((0, 0, 1))
def at_(s, lat=0.0, z=0.0): return off(st(s), lat, z)
def panel(c, w, h, f, k, rect, back=True):
    """a flat picture facing f (toward the viewer), bottom centre c; rect u0, u1, v0, v1 (Llano's panel)"""
    f = Vector((f.x, f.y, 0)).normalized(); r = Vector((-f.y, f.x, 0)); u0, u1, v0, v1 = rect; a, b = c - r * w / 2, c + r * w / 2
    DC.face([a, b, b + Z_ * h, a + Z_ * h], k, uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    if back:
        DC.face([b - f * 0.3, a - f * 0.3, a - f * 0.3 + Z_ * h, b - f * 0.3 + Z_ * h], 'steel')      # 30 cm: closer and the web pack's rounding brings it through the picture
        for e in (a, b): DC.box(lambda x, y, z, e=e: e - f * 0.15 + Vector((x, y, z)), -0.05, 0.05, -0.05, 0.05, -c.z + e.z - 1.2, h + 0.1, 'steel', top=False)
ADS = ['pirelli', 'redbull', 'shell', 'cocacola', 'samsung', 'sony', 'rolex', 'oppo']
def r6(q): return 0.002, 0.998, 1 - (q + 1) / 8 + 0.002, 1 - q / 8 - 0.002
def rb(q): return (q % 4) / 4 + 0.002, (q % 4 + 1) / 4 - 0.002, 1 - (q // 4 + 1) / 4 + 0.002, 1 - (q // 4) / 4 - 0.002
TO_ROAD = lambda i, sd: -(NL[i] * sd).to_3d()
# the corners in the stretch, from the concept: turn-in metres and which side is the outside
CORN = [(c['n'], c['at'] - c['radius'] * math.radians(c['turn']) / 2, c['at'], 1 if c['hand'] == 'R' else -1) for c in SRC['corners']]
CORN = [c for c in CORN if in_stretch(st(c[2]))]
# ---- hoardings: runs along the straights, 9 m boards, both sides in turn
n_h = 0
for s0, s1, sd in ((2250, 2340, 1), (2470, 2570, -1), (2610, 2700, 1), (2700, 2790, -1), (2905, 2995, 1), (3110, 3220, -1)):
    s_ = s0; q = DR.randrange(8)
    while s_ + 9 <= s1:
        i = st(s_ + 4.5)
        if in_stretch(i): panel(off(i, sd * (BD[sd][i] + 0.75), 0.95), 9.0, 1.25, TO_ROAD(i, sd), 'ads', r6(q % 8)); n_h += 1
        s_ += 9.2; q += 1
# ---- distance boards and corner numbers, the outside of each braking zone
for n_, tin, apex, sd in CORN:
    for d_, q in ((300, 0), (200, 1), (100, 2)):
        if tin - d_ < (STRETCH[0] if STRETCH else 0) or n_ == 6: continue      # T6 follows T5's exit too closely for boards
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
# ---- marshal posts
n_m = 0
for s_, sd in ((2330, -1), (2600, 1), (2835, 1), (3110, 1)):
    i = st(s_)
    if not in_stretch(i): continue
    c = off(i, sd * (BD[sd][i] + 1.6), 0.15); ex = T[i].to_3d() * sd; ey = Vector((-ex.y, ex.x, 0)); P = lambda x, y, z, c=c, ex=ex, ey=ey: c + ex * x + ey * y + Z_ * z
    DC.box(P, -1.1, 1.1, 0.0, 1.3, 0.0, 2.3, 'hut', (0.9, 0.45, 0.12)); DC.box(P, -1.25, 1.25, -0.15, 1.45, 2.3, 2.42, 'steel', bottom=True)
    DC.face([P(-0.9, -0.02, 1.2), P(0.9, -0.02, 1.2), P(0.9, -0.02, 2.0), P(-0.9, -0.02, 2.0)], 'shopglow')
    panel(P(0, -0.04, 2.46), 1.2, 0.6, -ey, 'boards', rb(15), back=False); n_m += 1
# ---- light towers: a lattice mast and a bank of floods over each corner
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
for n_, tin, apex, sd in CORN:
    i = st(apex); c = off(i, sd * (BD[sd][i] + 2.2), 0.15); mast(c, TO_ROAD(i, sd))
    i = st(tin - 60); c = off(i, sd * (BD[sd][i] + 2.2), 0.15); mast(c, TO_ROAD(i, sd))
# ---- people: on the roofs over the hairpins, behind the fences on the outsides
n_p = 0
for O, ex, w, h_ in ROOFS:
    j_, _ = near(O.x, O.y)
    if not any(abs(j_ - st(apex)) * STEP < 70 for n_, tin, apex, sd in CORN) or DR.random() < 0.45: continue
    ey = Vector((-ex.y, ex.x, 0)); var = DR.randrange(4)
    for row, (dy, dz) in enumerate(((0.5, 0.0), (1.4, 0.35))):
        a, b = O + ex * (-w / 2 + 0.3) + ey * dy + Z_ * (h_ + dz), O + ex * (w / 2 - 0.3) + ey * dy + Z_ * (h_ + dz); u0 = DR.uniform(0, 3)
        DC.face([a, b, b + Z_ * 1.15, a + Z_ * 1.15], 'crowd', uv=[(u0, var / 4), (u0 + (w - 0.6) / 14, var / 4), (u0 + (w - 0.6) / 14, (var + 1) / 4), (u0, (var + 1) / 4)]); n_p += 1
for n_, tin, apex, sd in CORN:
    for s_ in np.arange(tin - 30, apex + 40, 4.0):
        i = st(s_); a, b = off(i, sd * (BD[sd][i] + 1.3), 0.15), off(st(s_ + 4), sd * (BD[sd][st(s_ + 4)] + 1.3), 0.15); var = DR.randrange(4); u0 = DR.uniform(0, 3)
        DC.face([a, b, b + Z_ * 1.15, a + Z_ * 1.15], 'crowd', uv=[(u0, var / 4), (u0 + 4 / 14, var / 4), (u0 + 4 / 14, (var + 1) / 4), (u0, (var + 1) / 4)]); n_p += 1
# ---- strings of little flags across the street, and the flag from a window
COLS = [(0.85, 0.1, 0.08), (0.95, 0.78, 0.1), (0.1, 0.55, 0.2), (0.12, 0.3, 0.8), (0.95, 0.45, 0.08), (0.9, 0.3, 0.55), (0.92, 0.92, 0.9)]
n_b = 0
s_ = (STRETCH[0] if STRETCH else 0) + 20
while s_ < (STRETCH[1] if STRETCH else LAP):
    i, j = st(s_), st(s_ + DR.uniform(-8, 8)); a, b = off(i, SHELF - 0.4, DR.uniform(6.0, 7.5)), off(j, -(SHELF - 0.4), DR.uniform(6.0, 7.5))
    L_ = (b - a).length; m_ = int(L_ / 0.55)
    for q in range(m_):
        t0 = q / m_; p = a.lerp(b, t0) - Z_ * (1.1 * 4 * t0 * (1 - t0)); u = (b - a).normalized() * 0.16
        DC.face([p - u, p + u, p - Z_ * 0.32], 'cloth', COLS[DR.randrange(len(COLS))], uv=[(0, 0), (0.3, 0), (0.15, 0.3)])
    n_b += 1; s_ += DR.uniform(28, 45)
n_f = 0
for O, ex, w, h_ in ROOFS:
    if DR.random() > 0.05: continue
    ey = Vector((-ex.y, ex.x, 0)); c = O - ey * 0.05 + Z_ * min(h_ - 1.6, 4.0) + ex * DR.uniform(-w / 4, w / 4)
    DC.face([c - ex * 0.8, c + ex * 0.8, c + ex * 0.8 + Z_ * 1.12, c - ex * 0.8 + Z_ * 1.12], 'flag', uv=[(0, 0), (1, 0), (1, 1), (0, 1)]); n_f += 1
DC.done(); FG.done()
log('race dressing: hoardings', n_h, 'marshal posts', n_m, 'light towers', n_t, 'crowd cards', n_p, 'flag strings', n_b, 'flags', n_f)
