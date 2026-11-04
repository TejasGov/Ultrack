"""The lower loop's buildings and the city district (exec'd by build_venice.py; plan_buildings.py shows the placement; research/european-architecture-refs.md has the references). Massing for review, nothing copied:
  1 dome hall, Capitol type: a drum in a ring of columns, a cast-iron style dome, a lantern, dead ahead down the bottom straight (30 m dome, about 88 m to the top, as the research's figures)
  2 town hall, Manchester type: Victorian Gothic with an 85 m clock tower, beyond the tunnel mouth from the falling straight
  3 colonnade block, Federal Triangle look: 300 m of limestone-coloured columns under a low tile roof, beside the bottom stand
  4 bell-dome church, Frauenkirche type: a sandstone bell, 67 m to the dome's top
  5 twin-spire cathedral, Cologne type, scaled to about 110 m so it does not dwarf the 99 m campanile (the scale is my call, not a measurement)
  6 brick gate, Holstentor type: two round towers with conical roofs, at the canal's end
  city: half-timber streets and brick Gothic gabled houses either side of the canal
No insignia, emblems, inscriptions or real names on anything here."""
exec(compile((H / 'venice_kit.py').read_text(encoding='utf8'), str(H / 'venice_kit.py'), 'exec'))
CT = GSheet('VE city', ['stone', 'plaster', 'roof', 'dark', 'timber'])
doge_hq(HQ_O, HQ_U, HW_, HD_)
arsenale_gate(HQ_C - HQ_N * (HD_ / 2), HQ_U, -HQ_N)
MR = random.Random(57)
SANDSTONE, LIMESTONE, DARKSTONE, BRICK, CREAM, BEAM, SLATE, ROOFRED = (0.72, 0.6, 0.45), (0.8, 0.77, 0.68), (0.42, 0.4, 0.36), (0.36, 0.13, 0.08), (0.86, 0.8, 0.66), (0.17, 0.11, 0.07), (0.3, 0.32, 0.36), (0.5, 0.2, 0.12)
def at(c, yaw, x, y, z=0.0):
    a, b = math.cos(yaw), math.sin(yaw); return Vector((c.x + x * a - y * b, c.y + x * b + y * a, c.z + z))
def base(px, py, sink=0.6): x, y = PX(px, py); return Vector((x, y, ground_z(x, y)[0] - sink))
def lface(c, yaw, pts, k, col=(1, 1, 1)): CT.face([at(c, yaw, *p) for p in pts], k, col)
def gable(c, yaw, w_, d_, z0, rise, k, col, end='plaster', endcol=CREAM):      # the ridge along local y
    hw_, hd = w_ / 2, d_ / 2
    lface(c, yaw, [(-hw_, -hd, z0), (0, -hd, z0 + rise), (0, hd, z0 + rise), (-hw_, hd, z0)], k, col); lface(c, yaw, [(hw_, hd, z0), (0, hd, z0 + rise), (0, -hd, z0 + rise), (hw_, -hd, z0)], k, col)
    lface(c, yaw, [(-hw_, -hd, z0), (hw_, -hd, z0), (0, -hd, z0 + rise)], end, endcol); lface(c, yaw, [(hw_, hd, z0), (-hw_, hd, z0), (0, hd, z0 + rise)], end, endcol)
def hip(c, yaw, a_, b_, z0, rise, k, col):      # the ridge along local x
    r_ = max(0.0, a_ / 2 - b_ / 2); A, B, C_, D_, E, F = (-a_ / 2, -b_ / 2, z0), (a_ / 2, -b_ / 2, z0), (a_ / 2, b_ / 2, z0), (-a_ / 2, b_ / 2, z0), (-r_, 0, z0 + rise), (r_, 0, z0 + rise)
    for q in ([A, B, F, E], [B, C_, F], [C_, D_, E, F], [D_, A, E]): lface(c, yaw, q, k, col)
def lathe(c, prof, k, col, n=24): lathe_k(c, prof, {'stone': 'lime', 'plaster': 'brick', 'roof': 'slate'}.get(k, k), col, n=n)      # smooth, on the real textures
def column(p, r_, h_, col): lathe(p, [(r_ * 1.2, 0), (r_, 0.6), (r_ * 0.85, h_ - 0.6), (r_ * 1.2, h_)], 'stone', col, n=8)
def windows(c, yaw, cx, cy, ux, uy, L_, zs, pitch, w_, h_, rise, gothic=True):      # (ux, uy): the wall's local direction, turned so its right-hand normal points out of the wall
    u3 = (at(Vector((0, 0, 0)), yaw, ux, uy)).normalized(); cnt = max(1, int(L_ / pitch))
    for z in zs:
        for q in range(cnt):
            t_ = (q + 0.5) * L_ / cnt - L_ / 2; opening(CT, at(c, yaw, cx + ux * t_, cy + uy * t_), u3, w_, z, z + h_, rise, out=0.1, gothic=gothic)
def box_at(c, yaw, x, y, z, size, k, col, top=True): CT.block(at(c, yaw, x, y, z), size, yaw, k, col, top=top)

# ------------------------------------------------------------------------------------------------ 1 the dome hall, facing back down the bottom straight
iEND = ST(3350); F_ = -T[iEND]; yc = math.atan2(F_.x, -F_.y); cc = base(1405, 905)      # local -y faces the oncoming road
for x_, w_, d_, h_ in ((0, 72, 46, 24), (-68, 64, 36, 20), (68, 64, 36, 20), (-108, 18, 44, 23), (108, 18, 44, 23)):
    box_at(cc, yc, x_, 0, 0, (w_, d_, h_), 'stone', ISTRIAN)
box_at(cc, yc, 0, -4, 0, (250, 70, 5.5), 'stone', WEATHERED)      # the raised base
for x_, L_ in ((0, 72), (-68, 64), (68, 64)):      # column rows on the front
    yf = -23 if x_ == 0 else -18
    n_c = 10 if x_ == 0 else 11
    for q in range(n_c):
        column(at(cc, yc, x_ + (q + 0.5) * L_ / n_c - L_ / 2, yf - (9 if x_ == 0 else 2.5), 5.5), 1.0 if x_ else 1.2, 12.0 if x_ else 14.0, ISTRIAN)
    windows(cc, yc, x_, yf, 1, 0, L_, (7.5,), L_ / n_c, 2.4, 5.0, 1.2, gothic=False)
box_at(cc, yc, 0, -29, 19.5, (72, 12, 3.0), 'stone', ISTRIAN)      # the portico's top and pediment
lface(cc, yc, [(-36, -35, 22.5), (36, -35, 22.5), (0, -35, 31)], 'stone', ISTRIAN); lface(cc, yc, [(36, -23, 22.5), (-36, -23, 22.5), (0, -23, 31)], 'stone', ISTRIAN)
lface(cc, yc, [(-36, -35, 22.5), (0, -35, 31), (0, -23, 31), (-36, -23, 22.5)], 'roof', (0.5, 0.5, 0.5)); lface(cc, yc, [(36, -23, 22.5), (0, -23, 31), (0, -35, 31), (36, -35, 22.5)], 'roof', (0.5, 0.5, 0.5))
dc_ = at(cc, yc, 0, 4)
lathe(dc_, [(21, 24), (19, 25.5), (18, 25.5), (18, 37), (19.8, 37), (19.8, 38.4), (15.5, 38.4), (15.5, 48)], 'stone', ISTRIAN, n=36)      # the drum
for q in range(36):
    a_ = 2 * math.pi * q / 36; column(dc_ + Vector((19.3 * math.cos(a_), 19.3 * math.sin(a_), 25.5)), 0.7, 11.5, ISTRIAN)
lathe(dc_, [(15.2 * math.cos(t_ * math.pi / 16), 48 + 25 * math.sin(t_ * math.pi / 16)) for t_ in range(8)] + [(2.2, 73)], 'stone', (0.92, 0.91, 0.87), n=36)      # the dome, painted white
lathe(dc_, [(3.4, 73), (3.4, 80), (2.4, 82), (0.8, 84), (0.2, 88)], 'stone', ISTRIAN, n=16)      # lantern and finial, no statue

# ------------------------------------------------------------------------------------------------ 2 the town hall, its tower on the road side
F_t = -T[ST(4800)]; th = base(212, 742); yt = math.atan2(F_t.x, -F_t.y)      # local -y faces back along the falling straight
box_at(th, yt, 0, 0, 0, (80, 58, 22), 'stone', SANDSTONE, top=False); hip(th, yt, 80, 58, 22, 11, 'roof', SLATE)
for cx, cy, ux, uy, L_ in ((0, -29, 1, 0, 80), (0, 29, -1, 0, 80), (40, 0, 0, 1, 58), (-40, 0, 0, -1, 58)): windows(th, yt, cx, cy, ux, uy, L_, (3.0, 12.0), 7.0, 2.6, 4.6, 1.6)
box_at(th, yt, 0, -36, 0, (17, 17, 66), 'stone', SANDSTONE); box_at(th, yt, 0, -36, 66, (18.5, 18.5, 8), 'stone', SANDSTONE)
windows(th, yt, 0, -44.5, 1, 0, 17, (10, 24, 38, 52), 8.4, 2.2, 7.0, 1.6)
tip = at(th, yt, 0, -36, 85)
for a_, b_ in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
    CT.face([at(th, yt, a_[0] * 9.25, -36 + a_[1] * 9.25, 74), at(th, yt, b_[0] * 9.25, -36 + b_[1] * 9.25, 74), tip], 'roof', SLATE)
for ux, uy, cx, cy in ((1, 0, 0, -45.3), (0, 1, 9.3, -36), (-1, 0, 0, -26.7), (0, -1, -9.3, -36)):      # the clock faces: plain discs
    u3 = at(Vector((0, 0, 0)), yt, ux, uy); n3 = Vector((u3.y, -u3.x, 0)); cen = at(th, yt, cx, cy, 70)
    CT.face([cen + u3 * 3.2 * math.cos(q * math.pi / 8) + Vector((0, 0, 3.2 * math.sin(q * math.pi / 8))) + n3 * 0.05 for q in range(16)], 'stone', (0.95, 0.94, 0.88))

yl = HEAD[ST(3210)]      # the bottom straight's direction: the church, cathedral and gate sit square to it

# ------------------------------------------------------------------------------------------------ 4 the bell-dome church, in the kit: real windows, a smooth dome
_u4 = at(Vector((0, 0, 0)), yl, 1, 0); _n4 = Vector((_u4.y, -_u4.x, 0)); _c4 = base(680, 858, sink=0.1)
bell_church(_c4 - _u4 * 22 + _n4 * 22, _u4, 44.0, k='lime', col=WARM)

# ------------------------------------------------------------------------------------------------ 5 the twin-spire cathedral: west towers, a long nave, a transept
ca = base(480, 755); yca = yl      # local x runs east along the nave; the towers at its west end
box_at(ca, yca, 8, 0, 0, (104, 28, 28), 'stone', DARKSTONE, top=False)
gable(at(ca, yca, 8, 0), yca + math.pi / 2, 28, 104, 28, 13, 'roof', SLATE, end='stone', endcol=DARKSTONE)      # the nave: a quarter turn puts the ridge along local x
box_at(ca, yca, 26, 0, 0, (24, 56, 28), 'stone', DARKSTONE, top=False); gable(at(ca, yca, 26, 0), yca, 24, 56, 28, 12, 'roof', SLATE, end='stone', endcol=DARKSTONE)
for x_ in range(-36, 60, 12):
    for sy in (-1, 1): box_at(ca, yca, x_, sy * 16, 0, (3, 4, 24), 'stone', DARKSTONE)      # buttresses
windows(ca, yca, 8, -14, 1, 0, 104, (6.0,), 12, 5.0, 12, 4.0); windows(ca, yca, 8, 14, -1, 0, 104, (6.0,), 12, 5.0, 12, 4.0)
for sy in (-1, 1):
    tx, ty = -53, sy * 11; box_at(ca, yca, tx, ty, 0, (18, 18, 62), 'stone', DARKSTONE)
    windows(ca, yca, tx - 9, ty, 0, -1, 18, (6, 22, 38, 52), 8, 2.8, 8, 2.0)
    tip = at(ca, yca, tx, ty, 110)
    for a_, b_ in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
        CT.face([at(ca, yca, tx + a_[0] * 8, ty + a_[1] * 8, 62), at(ca, yca, tx + b_[0] * 8, ty + b_[1] * 8, 62), tip], 'stone', DARKSTONE)
box_at(ca, yca, -53, 0, 0, (14, 12, 34), 'stone', DARKSTONE)      # the front between the towers
windows(ca, yca, -60, 0, 0, -1, 12, (4.0,), 12, 8.0, 15, 5.0)

# ------------------------------------------------------------------------------------------------ 6 the brick gate at the canal's east end, in the kit: an arched way between two round towers
_u6 = at(Vector((0, 0, 0)), yl, 0, 1); _n6 = Vector((_u6.y, -_u6.x, 0)); _c6 = base(1138, 806, sink=0.1)      # its front faces west, along the canal
f6, r6_, b6, l6 = walls_of(_c6 - _u6 * 6.5 + _n6 * 5.5, _u6, 13.0, 11.0)
for w_, LL in ((f6, 13.0), (b6, 13.0), (r6_, 11.0), (l6, 11.0)):
    if LL == 13.0:
        window(w_, 6.5, 0.0, 5.0, 4.6, 'brick', WHITE, trim='lime', tcol=WARM, depth=1.0, rise=2.5, panel=(0, 13, 0, 11.5), sill=False, glass=False)
        for a_ in (3.0, 6.5, 10.0): window(w_, a_, 11.9, 1.3, 2.2, 'brick', WHITE, trim='lime', tcol=WARM, panel=(a_ - 1.75 if a_ != 6.5 else 4.75, a_ + 1.75 if a_ != 6.5 else 8.25, 11.5, 16.0))
    else: rect(w_, 0, LL, 0, 16.0, 0, 'brick', WHITE)
    cornice(w_, -0.3, LL + 0.3, 16.0, 0.8, 'lime', WARM)
roof_hip(_c6 - _u6 * 6.5 + _n6 * 5.5, _u6, _n6, 13.0, 11.0, 16.8, 6.0, 'slate', WHITE)
for sy in (-1, 1):
    tw = _c6 + _u6 * sy * 11.5
    lathe_k(tw, [(6.6, -0.5), (6.4, 2.0), (6.0, 2.4), (6.0, 21.0), (6.5, 21.6), (6.5, 22.2)], 'brick', WHITE, n=24)
    for tier in (5.0, 10.5, 16.0):
        for k_ in range(10):
            a_ = 2 * math.pi * k_ / 10; u3 = Vector((-math.sin(a_), math.cos(a_), 0)); opening(CT, tw + Vector((6.02 * math.cos(a_), 6.02 * math.sin(a_), 0)), -u3, 1.0, tier, tier + 2.2, 0.6, out=0.02)
    lathe_k(tw + UP * 22.2, [(6.8, 0), (5.0, 3.0), (2.2, 8.0), (0.15, 13.0)], 'slate', ROOF_COL['slate'], n=24)

# ------------------------------------------------------------------------------------------------ the test stretch: pillars on the road, both sides of the bottom straight (the user: show one stretch before the rest)
def plot(s0, L_, sd, setback, D_):
    """a building's frame beside the road: sd +1 north of the bottom straight, -1 south; returns its front-left foot and direction, and keeps its footprint clear of the town houses"""
    i0, i1 = ST(s0), ST(s0 + L_); lat = sd * (max(BD[sd][i0], BD[sd][i1]) + 6 + setback); A, B = off(i0, lat), off(i1, lat)
    if sd < 0: A, B = B, A
    u = (B - A); u.z = 0; u.normalize(); A.z = Z(0.05); n_ = Vector((u.y, -u.x, 0))
    HEROES_P.append([tuple((A + u * a_ - n_ * d_).to_2d()) for a_, d_ in ((-4, -4), (L_ + 4, -4), (L_ + 4, D_ + 4), (-4, D_ + 4))])
    return A, u
HEROES_P = [polygon([(a_, b_), (c_, b_), (c_, d_), (a_, d_)]) for a_, b_, c_, d_ in [(415, 725, 545, 785), (650, 828, 710, 888), (1112, 778, 1160, 834)]]
temple_hall(*plot(2830, 74, 1, 8, 50), 74, 50, k='lime', col=PALE, order='corinthian', h_=15.5, ncol=8, roof='lead')
monument_column(off(ST(2955), BD[1][ST(2955)] + 20) + UP * 0.05)
arcade_block(*plot(3000, 88, 1, 2, 42), 88, 42, k='soot', col=SOOTY, wall='brick', order='ionic', trim='lime', tcol=WARM)
loggia_exchange(*plot(3102, 66, 1, 11, 40), 66, 40, k='lime', col=WARM, wall='ochre', order='corinthian', h_=13.5)
rotunda(off(ST(3195), BD[1][ST(3195)] + 28) + UP * 0.05, 15.0, k='lime', col=PALE, order='ionic', dome='lead', dcol=GREEN_LEAD); HEROES_P.append([tuple((off(ST(3195), BD[1][ST(3195)] + 28) + Vector((a_, b_, 0))).to_2d()) for a_, b_ in ((-24, -24), (24, -24), (24, 24), (-24, 24))])
palazzo(*plot(3228, 48, 1, 3, 30), 48, 30, wall='red', k='lime', col=WARM, floors=4)
colonnade_block(*plot(3000, 196, -1, 14, 46), 196, 46, k='lime', col=PALE, order='ionic', h_=17.0, roof='tile')
temple_hall(*plot(3212, 66, -1, 14, 42), 66, 42, k='lime', col=WARM, order='doric', h_=13.5, ncol=6, roof='slate')
arcade_block(*plot(3296, 60, -1, 3, 36), 60, 36, k='lime', col=WARM, wall='dbrick', order='corinthian', floors=2, trim='lime', tcol=PALE)

# ------------------------------------------------------------------------------------------------ the town: gabled houses behind the grand frontage, in irregular plots with gaps and a little square
def clear(x, y, m=7.0):
    i, d = near(x, y)
    if d < max(BD[1][i], BD[-1][i]) + m or in_poly(x, y, PODIUM): return False
    if any(in_poly(x, y, P) for P in HEROES_P): return False
    return signed(x, y, CANAL, TCANAL) < -9.0      # past the canal's walk
def fill(x0, x1, y0, y1, kinds):
    cb = Vector(PX((x0 + x1) / 2, (y0 + y1) / 2)).to_3d(); cb.z = Z(0.0); Lx, Ly = (x1 - x0) / 2 * KS, (y1 - y0) / 2 * KS; y_ = -Ly; cnt = 0; ux, uy = at(Vector((0, 0, 0)), yl, 1, 0), at(Vector((0, 0, 0)), yl, 0, 1)
    while y_ < Ly:
        dep = MR.uniform(11, 17); x_ = -Lx + MR.uniform(0, 8)
        while x_ < Lx:
            wd = MR.uniform(7.5, 14.5); jog = MR.uniform(-2.2, 2.2); turn = MR.uniform(-0.05, 0.05)
            g = cb + ux * x_ + uy * (y_ + jog); uh = Vector((math.cos(yl + turn), math.sin(yl + turn), 0)); nh = Vector((uh.y, -uh.x, 0))
            cs = [g + uh * a_ + nh * b_ for a_, b_ in ((0, 0), (wd, 0), (wd, -dep), (0, -dep))]
            if MR.random() > 0.1 and all(clear(q.x, q.y) for q in cs):
                gz = ground_z(g.x, g.y)[0]; h_ = MR.uniform(9.5, 17) if MR.random() > 0.15 else MR.uniform(17, 22)
                house(Vector((g.x, g.y, gz - 0.15)), uh, wd, dep, h_, MR.choice(kinds)); cnt += 1
            x_ += wd + MR.choice((0.1, 0.1, 0.1, 0.1, 3.5, 7.0))
        y_ += dep + MR.uniform(5.0, 9.0)
    return cnt
n_city = sum(fill(*r_, ('timber', 'timber', 'plaster', 'plaster', 'brick')) for r_ in ((365, 760, 730, 782), (365, 760, 830, 898))) + sum(fill(*r_, ('brick', 'brick', 'plaster', 'timber')) for r_ in ((790, 1125, 730, 782), (790, 1125, 830, 898)))
log('town houses', n_city)
exec(compile((H / 'venice_decor.py').read_text(encoding='utf8'), str(H / 'venice_decor.py'), 'exec'))
CT.done(); KT.done(); KR.done(planar=False, smooth=True)
