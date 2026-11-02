"""Llano's second pass, exec'd at the end of llano_venue.py: the user found the venue bland beside the reference game (qa/reference/drive_0.png), whose interest is layers close to the road and a big silhouette
behind them. So: colour on the ground and walls, things overhead every so often, a round tower, something in the sky, and West Texas itself (mesas, a rock cut, windmills, a pipeline, wind turbines). Grammar only, nothing copied."""
def lin(h):
    h = h.lstrip('#'); c = [int(h[k:k + 2], 16) / 255 for k in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1,)
MAT.update({'paint': material('LL | paint', rough=0.6, vcol=True), 'tyres': tex_mat('LL | tyres', TX / 'tyres.png', 0.85), 'lights': tex_mat('LL | start lights', TX / 'start_lights.png', 0.45),
            'strata': material('LL | strata', tex='red_laterite_soil_stones', vcol=True), 'patch': material('LL | road patch', tex='asphalt_track', rough=0.8, vcol=True, diff=ROOT / 'tracks' / 'drylake' / 'tex' / 'asphalt_track_bleached_diff_2k.jpg')})
UVS.update({'paint': 4.0, 'strata': 11.0, 'patch': 3.5})
PNT, LAND = Sheet('LL paint', vcol=True), Sheet('LL land', vcol=True)
# the web pack rounds each mesh's positions to 16 bits of its longest side: what reaches far out gets its own mesh, so the lap's stay precise
FAR, SKY = Sheet('LL far'), Sheet('LL sky', vcol=True)
RED, WHT, BLU, BLK = lin('#bf0a30'), lin('#eeeae0'), lin('#14306e'), lin('#0d0d0f')
OUTER = {1: 1, 5: 1, 6: -1, 8: -1, 9: 1, 10: 1}
paved_col = []

# ------------------------------------------------------------------------------------------------ on the ground: painted run-off, a checkered line, road repairs
for n_, sd in OUTER.items():
    a, b = int((ENTRY[n_] - 70) / STEP), int((EXIT[n_] + 90) / STEP)
    for j in range(a, b):
        i, i2 = j % N, (j + 1) % N; w0 = HW + 1.4; w1 = min(BD[sd][i] - 0.7, HW + 13); w2 = min(BD[sd][i2] - 0.7, HW + 13)
        if w1 < w0 + 0.5 or w2 < w0 + 0.5: continue
        c_ = (RED, WHT, BLU, WHT)[(j // 4) % 4]; q = [off(i, sd * w0, 0.018), off(i2, sd * w0, 0.018), off(i2, sd * w2, 0.018), off(i, sd * w1, 0.018)]
        PNT.quad(q if sd > 0 else q[::-1], 'paint', col=c_); paved_col.append([p.copy() for p in q])
for row, ds in enumerate((-1.1, 0.0)):
    for q in range(16):
        lat0, lat1 = -8 + q, -7 + q; base_ = CL[0]; t0 = T[0].to_3d(); pts = [base_ + NL[0] * lat0 + t0 * ds + Z * 0.034, base_ + NL[0] * lat0 + t0 * (ds + 1.1) + Z * 0.034, base_ + NL[0] * lat1 + t0 * (ds + 1.1) + Z * 0.034, base_ + NL[0] * lat1 + t0 * ds + Z * 0.034]
        PNT.quad(pts, 'paint', col=WHT if (q + row) % 2 else BLK)
rp = random.Random(41)
for _ in range(46):
    i = rp.randrange(N); lat = rp.uniform(-HW + 1, HW - 1); w_, L_ = rp.uniform(0.9, 3.2), rp.uniform(3, 10); j = (i + max(1, int(L_ / STEP))) % N
    PNT.quad([off(i, lat - w_, 0.05), off(j, lat - w_, 0.05), off(j, lat + w_, 0.05), off(i, lat + w_, 0.05)], 'patch', col=(0.74, 0.74, 0.76, 1))
for s_, sd, n_ in ((EXIT[3] + 90, 1, 'shell'), (EXIT[3] + 330, -1, 'rolex'), (EXIT[3] + 800, 1, 'redbull'), (EXIT[3] + 1200, -1, 'cocacola'), (EXIT[7] + 300, 1, 'pirelli'), (EXIT[7] + 620, -1, 'emirates')):     # sponsors painted on the dirt, as circuits do
    i = st(s_); u0, u1, v0, v1 = r3(n_); t0 = T[i].to_3d(); c0 = off(i, sd * (HW + 16), 0.0); c0.z = gz(c0.x, c0.y) + 0.14; w_, d_ = 30.0, 10.0; e = NL[i]
    ART.quad([c0 - t0 * w_ / 2 - e * d_ / 2, c0 + t0 * w_ / 2 - e * d_ / 2, c0 + t0 * w_ / 2 + e * d_ / 2, c0 - t0 * w_ / 2 + e * d_ / 2], 'ads3', uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)])

# ------------------------------------------------------------------------------------------------ the walls: tyre stacks in Lone Star paint round the big corners (a flat strip, in front of the barrier)
for n_, sd in ((1, 1), (5, 1), (8, -1), (9, 1), (10, 1)):
    s_ = ENTRY[n_] - 60
    while s_ < EXIT[n_] + 60:
        i, i2 = st(s_), st(s_ + 3); p0, p1 = off(i, sd * (BD[sd][i] - 0.02), 0.04), off(i2, sd * (BD[sd][i2] - 0.02), 0.04); h_ = Z * 1.0
        ART.quad([p0, p1, p1 + h_, p0 + h_], 'tyres', uv=[(0, 0), (1, 0), (1, 1), (0, 1)]); s_ += 3

# ------------------------------------------------------------------------------------------------ overhead at the start: the gantry's checker and lights, bunting strung across the track
i = st(0); t_ = T[i].to_3d()
for row in range(2):
    for q in range(26):
        lat0, lat1 = -15.6 + q * 1.2, -15.6 + (q + 1) * 1.2; z0 = 4.8 + row * 1.2; a, b = off(i, -lat0, z0) - t_ * 0.7, off(i, -lat1, z0) - t_ * 0.7; PNT.quad([a, b, b + Z * 1.2, a + Z * 1.2], 'paint', col=WHT if (q + row) % 2 else BLK)
panel(off(i, 0, 3.2) - t_ * 0.72, 13, 1.6, TRAFFIC(i), 'lights', (0, 1, 0, 1))
PENN = [lin(c) for c in ('#bf0a30', '#eeeae0', '#14306e', '#f2b705', '#e2581b', '#0f8f8a')]
def bunting(s, z=10.5, sag=1.5, pad=1.0):
    i = st(s); latl, latr = BD[1][i] + pad, -(BD[-1][i] + pad); pl, pr = off(i, latl), off(i, latr); t_ = T[i].to_3d()
    for p_ in (pl, pr): BLD.cyl(p_, 0.09, 0.07, z + 0.5, n=6)
    n = int((latl - latr) / 1.15); prev = None
    for q in range(n + 1):
        f = q / n; c = pl.lerp(pr, f) + Z * (z - sag * 4 * f * (1 - f))
        if prev is not None:
            BLD.beam(prev, c, 0.012, 'dark'); m = prev.lerp(c, 0.5) - Z * 0.75; PNT.quad([prev, c, m], 'paint', col=PENN[q % 6])
        prev = c
for s_ in (75, 190, 310, 410): bunting(s_)
for s_ in (ENTRY[1] - 60, EXIT[10] - 10): bunting(s_, z=12.0, sag=2.2)

# ------------------------------------------------------------------------------------------------ the pits in team colours, the wall's sponsors, a round tiered tower past the far end
TC = [('#c8102e', '#f2b705'), ('#ffd60a', '#0d0e10'), ('#0e3b2e', '#efe6cf'), ('#e2581b', '#142338'), ('#121a3a', '#d9c08c'), ('#1f46b8', '#bf0a30'), ('#f1efe8', '#0f8f8a'), ('#3a1f78', '#ff4a2e')]     # assets/teams/teams.json
for q in range(BAYS):
    a = PIT0 + q * 11; pr_, se = TC[(q // 4) % 8]; lp = -PL1 + 0.1
    p0, p1 = at(a, lp, 5.0), at(a + 11, lp, 5.0); PNT.quad([p0, p1, p1 + Z * 0.9, p0 + Z * 0.9], 'paint', col=lin(pr_))
    p0, p1 = at(a, lp, 0), at(a + 1.5, lp, 0); PNT.quad([p0, p1, p1 + Z * 5.0, p0 + Z * 5.0], 'paint', col=lin(se))
hoardings(-70, 290, -1, 1, 9.0, 1.5, 0.7)
RT = at(345, -62); rx, ry = RT.x, RT.y; rz = CL[st(345)].z; zz = rz
BLD.cyl((rx, ry, rz), 12.0, 12.0, 23, n=28, k='dark', cap=False)
for k_, (r_, h_) in enumerate(((27, 5.0), (25, 5.0), (22.5, 4.5), (20, 4.5), (17, 4.5))):
    BLD.cyl((rx, ry, zz), r_ + 1.8, r_ + 1.8, 1.2, n=36, k='white'); BLD.cyl((rx, ry, zz + 1.2), r_, r_ - 0.6, h_ - 1.2, n=36, k='glass_blue', cap=False); zz += h_
BLD.cyl((rx, ry, zz), 19.5, 15, 1.4, n=36, k='roofing')
for k_ in range(10): flagpole(Vector((rx + 18.2 * math.cos(k_ * 0.628), ry + 18.2 * math.sin(k_ * 0.628), zz + 1.2)), h=7.0, w=2.8)

# ------------------------------------------------------------------------------------------------ overhead out on the lap: an oil pipeline arches over the Long Mile, a sponsor truss on the Caprock straight
PS = ML0 + (ML1 - ML0) * 0.38; i = st(PS); e = NL[i]; c0 = CL[i]; lim = BD[1][i] + 3; prev = None; nodes = []
for lat in range(-300, 301, 6):
    fall = ss(lim, lim + 22, abs(lat)); gx = c0 + e * lat; g_ = gz(gx.x, gx.y); zp = (c0.z + 9.5) * (1 - fall) + (g_ + 1.8) * fall; p_ = Vector((gx.x, gx.y, zp)); nodes.append(p_)
    if prev is not None: BLD.beam(prev, p_, 0.62, 'corr')
    if abs(lat) > lim and lat % 18 == 0:
        BLD.beam(Vector((p_.x, p_.y, g_ - 0.2)) + T[i].to_3d() * 0.9, p_, 0.1); BLD.beam(Vector((p_.x, p_.y, g_ - 0.2)) - T[i].to_3d() * 0.9, p_, 0.1)
    prev = p_
for sg in (-1, 1):
    a = off(i, sg * lim); BLD.beam(a + T[i].to_3d() * 1.5, a + Z * 9.0, 0.22); BLD.beam(a - T[i].to_3d() * 1.5, a + Z * 9.0, 0.22)
panel(off(i, 0, 7.9) - T[i].to_3d() * 0.75, 12, 2.0, TRAFFIC(i), 'ads6', r6('shell'))
i = truss(EXIT[7] + 560, 7.0, 10.0); panel(off(i, 0, 7.1) - T[i].to_3d() * 0.65, 22, 3.66, TRAFFIC(i), 'ads6', r6('emirates'))
i = truss(EXIT[9] + 120, 7.0, 10.0); panel(off(i, 0, 7.1) - T[i].to_3d() * 0.65, 22, 3.66, TRAFFIC(i), 'ads6', r6('redbull'))

# ------------------------------------------------------------------------------------------------ the land: real mesas (near enough to move against the far range), a rock cut through the climb
def strat(z, x):      # bands of rust and pale, as caprock weathers
    b_ = math.sin(z * 0.42 + 0.6 * math.sin(x * 0.01)) * 0.5 + 0.5; n = 0.86 + 0.2 * fbm(x * 0.02, z * 0.1, 2)
    return (min(1, (0.55 + 0.35 * b_) * n), min(1, (0.3 + 0.36 * b_) * n), min(1, (0.17 + 0.32 * b_) * n), 1)
def mesa(cx, cy, rx_, ry_, h):
    PF = [(1.3, -3), (1.16, 0.08), (1.05, 0.2), (0.97, 0.42), (0.93, 0.5), (0.86, 0.58), (0.83, 0.9), (0.8, 1.0)]; M_ = 64; g_ = gz(cx, cy); rows = []
    for fr, zf in PF:
        row = []
        for q in range(M_):
            a = 2 * math.pi * q / M_; w = 1 + 0.2 * fbm(math.cos(a) * 2.1 + cx * 0.01, math.sin(a) * 2.1 + cy * 0.01, 3) + 0.05 * fbm(math.cos(a) * 9, math.sin(a) * 9, 2); z_ = g_ + (zf * h if zf > 0 else zf)
            if zf > 0.55: z_ += 2.2 * fbm(math.cos(a) * 4, math.sin(a) * 4, 2) * (1 - zf) * 8
            row.append(LAND.bm.verts.new((cx + rx_ * fr * w * math.cos(a), cy + ry_ * fr * w * math.sin(a), z_)))
        rows.append(row)
    for k in range(len(rows) - 1):
        for q in range(M_):
            f = LAND.bm.faces.new([rows[k][q], rows[k][(q + 1) % M_], rows[k + 1][(q + 1) % M_], rows[k + 1][q]]); f.material_index = LAND.mi('strata'); f.smooth = k < 1
            for l in f.loops: l[LAND.vc] = strat(l.vert.co.z, l.vert.co.x)
    f = LAND.bm.faces.new(rows[-1]); f.material_index = LAND.mi('strata')
    for l in f.loops: l[LAND.vc] = strat(l.vert.co.z, l.vert.co.x)
for cx, cy, rx_, ry_, h in ((1420, -950, 260, 190, 58), (1320, -2780, 200, 300, 72), (1820, -1250, 340, 240, 95), (-760, -1650, 300, 220, 66), (-1100, -700, 240, 300, 82), (-1050, 420, 330, 200, 54), (420, 900, 380, 170, 62), (1450, 430, 210, 210, 74), (380, -3350, 360, 220, 78), (-420, -2950, 240, 200, 50), (1120, -3050, 190, 190, 60)):
    if near(cx, cy)[1] > max(rx_, ry_) * 1.75 + 44: mesa(cx, cy, rx_, ry_, h)
    else: log('mesa too close to the lap', cx, cy)
# ---- the Caprock: the road climbs through a cut, rock either side behind the walls
C0, C1 = EXIT[5] + 170, EXIT[6] + 150
for sd in (1, -1):
    s_, prev = C0, None
    while s_ <= C1:
        i = st(s_); t = (s_ - C0) / (C1 - C0); tp = ss(0, 0.2, t) * (1 - ss(0.82, 1, t)); h = tp * (10 + 5 * fbm(s_ * 0.012, sd * 3.0, 3)); wb = BD[sd][i]
        prof = [(wb + 2.2, -1.0), (wb + 3.0, 0.3 * h), (wb + 4.2, 0.45 * h), (wb + 4.8, 0.8 * h), (wb + 7, h), (wb + 26, 0.75 * h), (wb + 42, -2.0)]
        row = [LAND.bm.verts.new(off(i, sd * d, z)) for d, z in prof]
        if prev:
            for k in range(len(prof) - 1):
                q = [prev[k], row[k], row[k + 1], prev[k + 1]]; f = LAND.bm.faces.new(q if sd > 0 else q[::-1]); f.material_index = LAND.mi('strata')
                for l in f.loops: l[LAND.vc] = strat(l.vert.co.z - CL[i].z, l.vert.co.x)
        prev = row; s_ += 7.5
# ---- ranch windmills with their tanks, wind turbines far off (still: nothing that blinks)
def windmill(x, y, yaw=0.6):
    g_ = gz(x, y) - 0.1; b_ = Vector((x, y, g_)); H_ = 13.0; hub = b_ + Z * H_
    for dx, dy in ((-1.8, -1.8), (1.8, -1.8), (1.8, 1.8), (-1.8, 1.8)):
        BLD.beam(b_ + Vector((dx, dy, 0)), hub + Vector((dx * 0.1, dy * 0.1, -0.5)), 0.05)
    for f_ in (0.3, 0.6):
        for (a, c) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
            r_ = 1.8 * (1 - f_ * 0.92); BLD.beam(b_ + Vector((a[0] * r_, a[1] * r_, H_ * f_)), b_ + Vector((c[0] * r_, c[1] * r_, H_ * f_)), 0.03)
    n = Vector((math.cos(yaw), math.sin(yaw), 0)); r = Vector((-n.y, n.x, 0)); c = hub + n * 0.6; B_ = 18
    for k in range(B_):
        a0, a1 = 2 * math.pi * k / B_ + 0.04, 2 * math.pi * (k + 0.72) / B_; pa = lambda a, q: c + (r * math.cos(a) + Z * math.sin(a)) * q
        BLD.quad([pa(a0, 0.6), pa(a1, 0.6), pa(a1, 2.6), pa(a0, 2.6)], 'steel')
    BLD.beam(hub, hub - n * 2.8, 0.05); BLD.quad([hub - n * 2.0 - Z * 0.5, hub - n * 3.8 - Z * 0.8, hub - n * 3.8 + Z * 0.8, hub - n * 2.0 + Z * 0.5], 'corr')
    BLD.cyl(b_ + r * 5 + n * 2, 2.6, 2.6, 2.0, n=14, k='corr', cap=False)
for s_, sd, off_ in ((ML0 + 330, 1, 34), (ML0 + 1120, -1, 44), (ML0 + 1760, 1, 60), (EXIT[7] + 420, 1, 40), (EXIT[8] + 300, -1, 36)):
    i = st(s_); p = off(i, sd * (BD[sd][i] + off_)); windmill(p.x, p.y, HEAD[i] + 2.6)
def turbine(x, y, yaw):
    g_ = gz(x, y) - 0.5; H_ = 92.0; FAR.cyl((x, y, g_), 2.5, 1.3, H_, n=10, k='white', cap=False); n = Vector((math.cos(yaw), math.sin(yaw), 0)); r = Vector((-n.y, n.x, 0)); hub = Vector((x, y, g_ + H_)) + n * 1.6
    FAR.box(Vector((x, y, g_ + H_)), (7.0, 3.0, 3.0), yaw, 'white')
    for k in range(3):
        a = 2 * math.pi * k / 3 + (x * 0.013) % 2; d = r * math.cos(a) + Z * math.sin(a); w_ = (r * -math.sin(a) + Z * math.cos(a))
        FAR.quad([hub - w_ * 1.2, hub + w_ * 1.2, hub + d * 50 + w_ * 0.25, hub + d * 50 - w_ * 0.25], 'white')
cx0, cy0 = sum(xs) / N, sum(ys) / N
for k_ in range(26):
    a = math.radians(-160 + k_ * 11.5); r_ = 3300 + 500 * math.sin(k_ * 1.7); turbine(cx0 + r_ * math.cos(a), cy0 + r_ * 1.15 * math.sin(a), a + math.pi)
# ---- in the sky: hot-air balloons and a blimp: the one thing that says how much air there is over this plain
def balloon(x, y, z, r_, colours):
    P_ = [(0.28, -1.15), (0.5, -0.92), (0.72, -0.62), (0.9, -0.3), (1.0, 0.02), (0.98, 0.35), (0.86, 0.66), (0.62, 0.9), (0.3, 1.03), (0.02, 1.06)]; B_ = 16; c = Vector((x, y, z)); rows = [[c + Vector((r_ * a_ * math.cos(2 * math.pi * q / B_), r_ * a_ * math.sin(2 * math.pi * q / B_), r_ * b_)) for q in range(B_)] for a_, b_ in P_]
    for k in range(len(P_) - 1):
        for q in range(B_):
            SKY.quad([rows[k][q], rows[k][(q + 1) % B_], rows[k + 1][(q + 1) % B_], rows[k + 1][q]], 'paint', col=colours[q % len(colours)])
    bs = c - Z * r_ * 1.5; FAR.box(bs, (r_ * 0.2, r_ * 0.2, r_ * 0.15), 0, 'corr')
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)): FAR.beam(bs + Vector((dx * r_ * 0.08, dy * r_ * 0.08, 0)), rows[0][int((math.atan2(dy, dx) % (2 * math.pi)) / (2 * math.pi) * B_) % B_], 0.03, 'dark')
for x, y, z, r_, cs in ((720, 170, 96, 13, (RED, WHT, BLU)), (1060, -120, 150, 15, (lin('#f2b705'), lin('#e2581b'), RED)), (960, -1100, 118, 13, (lin('#0f8f8a'), WHT)), (-180, -1510, 170, 15, (BLU, lin('#f2b705'))), (-560, -330, 120, 13, (RED, lin('#eeeae0'))), (720, -2450, 130, 13, (lin('#3a1f78'), lin('#ff4a2e'), WHT))):
    balloon(x, y, z, r_, cs)
def blimp(x, y, z, L_, R_, yaw, ad):
    n = Vector((math.cos(yaw), math.sin(yaw), 0)); r = Vector((-n.y, n.x, 0)); c = Vector((x, y, z)); K_, B_ = 18, 16; rows = []
    for k in range(K_ + 1):
        f = -1 + 2 * k / K_; rad = R_ * math.sqrt(max(0.0009, 1 - f * f)) * (1 - 0.12 * f); rows.append([c + n * (L_ * f) + (r * math.cos(2 * math.pi * q / B_) + Z * math.sin(2 * math.pi * q / B_)) * rad for q in range(B_)])
    for k in range(K_):
        for q in range(B_): SKY.quad([rows[k][q], rows[k + 1][q], rows[k + 1][(q + 1) % B_], rows[k][(q + 1) % B_]], 'paint', col=WHT)
    for sg in (-1, 1):
        panel(c + r * sg * (R_ + 0.3) - Z * R_ * 0.55, L_ * 1.05, R_ * 1.1, r * sg, 'ads3', r3(ad), back=False)
        FAR.quad([c - n * L_ * 0.8, c - n * L_ * 1.04, c - n * L_ * 1.04 + r * sg * R_ * 0.7, c - n * L_ * 0.86 + r * sg * R_ * 0.2], 'white')
    FAR.quad([c - n * L_ * 0.8, c - n * L_ * 1.04, c - n * L_ * 1.04 + Z * R_ * 0.8, c - n * L_ * 0.86 + Z * R_ * 0.2], 'white'); FAR.box(c - Z * (R_ + 1), (L_ * 0.34, 2.6, 2.0), yaw, 'dark')
blimp(330, -2780, 150, 34, 9, 0.5, 'pirelli')
# ---- bigger scrub close behind the walls down the long straights: something to whip past
sb2 = bmesh.new(); vs2 = vcol_layer(sb2); n2 = 0
for _ in range(1600):
    i = RNG.randrange(N); sd = RNG.choice((1, -1)); lat = sd * (BD[sd][i] + RNG.uniform(3, 70)); p = off(i, lat); j_, d = near(p.x, p.y)
    if d < abs(lat) - 1 or d < 48 or st(-210) < i < st(0) or -200 < START_S(i) < 520 or any(math.hypot(p.x - a, p.y - b) < r for a, b, r in SITES): continue
    if near(p.x, p.y)[1] < 44: continue
    sz = RNG.uniform(0.7, 1.9); blob(sb2, Vector((p.x, p.y, gz(p.x, p.y) + sz * 0.3)), (sz, sz * RNG.uniform(0.8, 1.2), sz * 0.85), 0.75, RNG.random() * 50, (0.26, 0.28, 0.13) if RNG.random() < 0.65 else (0.38, 0.32, 0.16), vs2); n2 += 1
for f in sb2.faces: f.smooth = True
mesh_obj('LL scrub near', sb2, ['scrub'], planar=False); log('near scrub', n2)
exec(compile((H / 'llano_station.py').read_text(encoding='utf8'), str(H / 'llano_station.py'), 'exec'))
for s_ in (PNT, LAND, FAR, SKY): s_.done()
