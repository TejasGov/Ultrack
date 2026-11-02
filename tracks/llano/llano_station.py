"""Llano Central, exec'd from llano_dressing.py: the race-day rail terminus on the outside of the Long Mile, in the grammar of New York's original Penn Station (a long Doric colonnade, a vaulted main hall with
great half-round windows, a steel and glass train shed behind), nothing copied. It works for a living: a railway comes in across the plain, a train stands at the platform, fans walk through the hall, down the
terraced garden and over a footbridge across the Long Mile into the infield. Low poly and hollow: every door and window is a real opening, the hall has a floor, columns and a vaulted ceiling.
Stone in the land's own colours: it is cut from the same rock as the mesas behind it."""
ST_S = ML0 + 1500.0; si = st(ST_S); eu, ev = T[si].to_3d(), NL[si]; SY = HEAD[si]; OV = BD[1][si] + 6.0
O_ = off(si, OV); O_.z = gz(O_.x, O_.y) + 0.1
L = lambda u, v, z=0.0: O_ + eu * u + ev * v + Z * z
MAT.update({'stone': material('LL | station stone', tex='white_plaster_02', vcol=True), 'copper': material('LL | copper roof', (0.26, 0.44, 0.36), 0.55), 'floor': material('LL | station floor', tex='seaworn_stone_tiles'),
            'lawn': material('LL | garden lawn', tex='leafy_grass', vcol=True), 'water': material('LL | pool', (0.03, 0.13, 0.17), 0.06, 0.2), 'station_sign': tex_mat('LL | station sign', TX / 'station_sign.png', 0.8), 'clock': tex_mat('LL | clock', TX / 'clock.png', 0.5),
            'train': tex_mat('LL | train side', TX / 'train_side.png', 0.4), 'hedge': material('LL | hedge', rough=0.9, vcol=True)})
UVS.update({'stone': 6.0, 'floor': 4.0, 'lawn': 5.0})
STN = Sheet('LL station', vcol=True)
def sbox(u, v, z, w, d, h, k='stone'): STN.box(L(u, v, z + h / 2), (w, d, h), SY, k)
def face(pts, k='stone'): return STN.quad(pts, k)
def arches(v, u0, bays, bw, z0, z1, zs, r, nrm=-1, door=False):
    """a wall along u at depth v from z0 to z1, split in bays bw wide, each with a round-headed opening (radius r, spring zs): a real hole, its reveal 1 m deep. door: the opening goes down to the floor"""
    NA = 8
    for b_ in range(bays):
        c = u0 + (b_ + 0.5) * bw; a, e = c - bw / 2, c + bw / 2; sill = z0 if door else z0 + (zs - z0) * 0.35
        if not door: face([L(a, v, z0), L(e, v, z0), L(e, v, sill), L(a, v, sill)])
        for x0, x1 in ((a, c - r), (c + r, e)): face([L(x0, v, z0 if door else sill), L(x1, v, z0 if door else sill), L(x1, v, z1), L(x0, v, z1)])
        arc = [(c + r * math.cos(math.pi * (1 - k_ / NA)), zs + r * math.sin(math.pi * k_ / NA)) for k_ in range(NA + 1)]
        for k_ in range(NA):
            (x0, z_0), (x1, z_1) = arc[k_], arc[k_ + 1]; face([L(x0, v, z_0), L(x1, v, z_1), L(x1, v, z1), L(x0, v, z1)])
            face([L(x0, v, z_0), L(x0, v - nrm, z_0), L(x1, v - nrm, z_1), L(x1, v, z_1)])
        if not door or True:
            s0 = sill if not door else z0
            for x_ in (c - r, c + r): face([L(x_, v, s0), L(x_, v - nrm, s0), L(x_, v - nrm, zs), L(x_, v, zs)])
        if not door:
            face([L(c - r, v, sill), L(c + r, v, sill), L(c + r, v - nrm, sill), L(c - r, v - nrm, sill)])
            for q in (-0.5, 0, 0.5): STN.beam(L(c + r * q, v - nrm * 0.5, sill), L(c + r * q, v - nrm * 0.5, zs + r * math.sqrt(1 - q * q)), 0.07, 'steel')      # mullions
            STN.beam(L(c - r, v - nrm * 0.5, zs), L(c + r, v - nrm * 0.5, zs), 0.07, 'steel')
def end_wall(u, v0, v1, z0, z1, zs, r, vault=None):
    """a wall across at u, with one great half-round window; vault: its top follows a half circle of that radius, not a flat line"""
    c = (v0 + v1) / 2; NA = 14
    face([L(u, v0, z0), L(u, v1, z0), L(u, v1, zs), L(u, v0, zs)])
    arc = [(c + r * math.cos(math.pi * (1 - k_ / NA)), zs + r * math.sin(math.pi * k_ / NA)) for k_ in range(NA + 1)]
    if vault:
        top = [(c + vault * math.cos(math.pi * (1 - k_ / NA)), zs + vault * math.sin(math.pi * k_ / NA)) for k_ in range(NA + 1)]
        for k_ in range(NA): face([L(u, arc[k_][0], arc[k_][1]), L(u, arc[k_ + 1][0], arc[k_ + 1][1]), L(u, top[k_ + 1][0], top[k_ + 1][1]), L(u, top[k_][0], top[k_][1])])
    else:
        face([L(u, v0, zs), L(u, c - r, zs), L(u, c - r, z1), L(u, v0, z1)]); face([L(u, c + r, zs), L(u, v1, zs), L(u, v1, z1), L(u, c + r, z1)])
        for k_ in range(NA):
            (x0, a0), (x1, a1) = arc[k_], arc[k_ + 1]; face([L(u, x0, a0), L(u, x1, a1), L(u, x1, z1), L(u, x0, z1)])
    for q in (-0.66, -0.33, 0, 0.33, 0.66): STN.beam(L(u, c + r * q, zs), L(u, c + r * q, zs + r * math.sqrt(1 - q * q)), 0.09, 'steel')
    STN.beam(L(u, c - r, zs), L(u, c + r, zs), 0.09, 'steel')

# ---- the garden: three terraces rising to the plinth, so it reads from a low car. Lawns, clipped hedges, a long pool on the axis, live oaks: green against the red, watered from the station's well
T1, T2, T3, PL = 1.3, 2.6, 3.9, 5.2      # heights of the terraces and the plinth
G_U = 118.0
for v0, v1, zz in ((0, 28, T1), (28, 56, T2), (56, 80, T3)):
    sbox(0, (v0 + v1) / 2, zz - 1.0, 2 * G_U, v1 - v0, 1.0, 'stone')      # the retaining block
    sbox(0, (v0 + v1) / 2, zz, 12, v1 - v0, 0.06, 'floor')                 # the central walk
    for sg in (-1, 1):
        for a, b in ((8, 44), (52, 88), (96, 114)):          # lawn panels either side of the axis, cross-walks between
            u0, u1 = sg * a, sg * b; v_0, v_1 = v0 + 3, v1 - 3
            STN.quad([L(u0, v_0, zz + 0.05), L(u1, v_0, zz + 0.05), L(u1, v_1, zz + 0.05), L(u0, v_1, zz + 0.05)][:: 1 if sg > 0 else -1], 'lawn')
            for vv in (v_0, v_1): sbox((u0 + u1) / 2, vv, zz + 0.05, abs(b - a), 0.8, 0.8, 'hedge')
            for uu in (u0, u1): sbox(uu, (v_0 + v_1) / 2, zz + 0.05, 0.8, v_1 - v_0, 0.8, 'hedge')
for sg in (-1, 1):      # the garden's side walls step up with the terraces, waist high
    for v0, v1, zz in ((0, 28, T1), (28, 56, T2), (56, 80, T3)): sbox(sg * (G_U + 0.5), (v0 + v1) / 2, 0, 1.2, v1 - v0, zz + 0.9)
for k_, (v0, z0) in enumerate(((-1.5, 0.0), (26.5, T1), (54.5, T2), (78.5, T3))):      # broad stairs on the axis
    for q in range(3): sbox(0, v0 + q * 0.5 + 0.25, z0 + q * 0.43, 14, 0.5, 0.43, 'stone')
for v0, v1, zz in ((3, 25, T1), (31, 53, T2)):
    STN.quad([L(-4, v0, zz + 0.13), L(4, v0, zz + 0.13), L(4, v1, zz + 0.13), L(-4, v1, zz + 0.13)], 'water')
    for a_, b_ in (((-4.3, v0), (4.3, v0)), ((4.3, v0), (4.3, v1)), ((4.3, v1), (-4.3, v1)), ((-4.3, v1), (-4.3, v0))): STN.beam(L(a_[0], a_[1], zz + 0.15), L(b_[0], b_[1], zz + 0.15), 0.2, 'stone')
c_ = L(0, 68, T3 + 0.06); STN.cyl(c_, 9.0, 9.0, 0.6, n=20, k='stone'); STN.quad([c_ + eu * 8.4 * math.cos(q * 0.7854) + ev * 8.4 * math.sin(q * 0.7854) + Z * 0.62 for q in range(4)], 'water')
STN.cyl(c_, 1.5, 1.0, 3.0, n=10, k='stone'); STN.cyl(c_ + Z * 3.0, 3.0, 3.0, 0.4, n=14, k='stone'); STN.cyl(c_ + Z * 3.4, 0.7, 0.4, 1.6, n=8, k='stone')     # the fountain
pl = bmesh.new(); vp = vcol_layer(pl)
for v_, zz in ((14, T1), (42, T2), (68, T3)):
    for u_ in (-104, -78, -52, -26, 26, 52, 78, 104):
        tp = L(u_, v_, zz); STN.cyl(tp, 0.42, 0.28, 3.6, n=6, k='corr', cap=False)
        blob(pl, tp + Z * 5.4, (4.8, 4.8, 4.2), 0.82, abs(u_ * 0.31 + v_), (0.13, 0.25, 0.08), vp)
for u_ in (-112, 112):
    for v_ in (10, 30, 50, 70):       # yucca and agave at the edges, where the garden meets the land
        blob(pl, L(u_ + (6 if u_ > 0 else -6) * 1.8, v_, 0.5), (1.5, 1.5, 1.2), 0.8, v_ * 0.3, (0.3, 0.34, 0.2), vp)
for f in pl.faces: f.smooth = True
mesh_obj('LL garden trees', pl, ['scrub'], planar=False)

# ---- the building
V_F = 84.0; sbox(0, 118, 0, 244, 80, PL)      # the plinth, a podium for all of it
for q in range(4): sbox(0, V_F - 0.75 + q * 0.75 - 2.5, T3 + q * 0.33, 134, 1.5, 0.33)       # the steps up
Z0 = PL
# the colonnade: the long Doric front
CU = 66.0; NC = 21; cH = 17.0
for q in range(NC):
    u_ = -CU + q * 2 * CU / (NC - 1); p = L(u_, 87, Z0); STN.box(p + Z * 0.5, (3.2, 3.2, 1.0), SY); STN.cyl(p + Z * 1.0, 1.25, 1.0, cH - 1.4, n=10, k='stone', cap=False); STN.box(p + Z * (cH - 0.2), (3.0, 3.0, 0.8), SY)
ez = Z0 + cH + 0.2
sbox(0, 88, ez, 2 * CU + 5, 5.5, 2.6); sbox(0, 88, ez + 2.6, 2 * CU + 7, 6.5, 0.7); sbox(0, 89, ez + 3.3, 2 * CU + 3, 4.8, 5.0)      # entablature, cornice, attic
panel(L(0, 86.3, ez + 3.6), 72, 4.5, -ev, 'station_sign', (0, 1, 0, 1), back=False)
sbox(0, 88.8, ez + 8.3, 26, 3.0, 8.5)       # the clock's raised attic
panel(L(0, 87.2, ez + 8.7), 7.2, 7.2, -ev, 'clock', (0, 1, 0, 1), back=False)
# the concourse behind the columns: seven doors through into the hall (real openings)
arches(92, -70, 7, 20, Z0, Z0 + 19.5, Z0 + 11, 6.5, door=True)
face([L(-70, 92, Z0 + 19.5), L(70, 92, Z0 + 19.5), L(70, 104, Z0 + 19.5), L(-70, 104, Z0 + 19.5)], 'roofing'); face([L(-70, 92, Z0 + 19.2), L(70, 92, Z0 + 19.2), L(70, 104, Z0 + 19.2), L(-70, 104, Z0 + 19.2)], 'stone')
# the wings: arched windows, hollow behind, flat roofs with a parapet
for sg in (-1, 1):
    a = sg * 70; e = sg * 121; u0 = min(a, e)
    arches(92, u0, 3, 17, Z0, Z0 + 16, Z0 + 8, 5.2); arches(130, u0, 3, 17, Z0, Z0 + 16, Z0 + 8, 5.2, nrm=1)
    end_wall(e, 92, 130, Z0, Z0 + 16, Z0 + 7, 11)
    sbox((a + e) / 2, 111, Z0 + 16, abs(e - a) + 1.5, 40, 1.0, 'stone'); sbox((a + e) / 2, 111, Z0 + 17, abs(e - a), 36, 0.3, 'roofing')
    sbox((a + e) / 2, 91.7, Z0 + 17, abs(e - a) + 1.5, 0.9, 1.6)
    for q in range(4):        # pilasters between the wing's windows
        sbox(u0 + q * 17, 91.5, Z0, 1.6, 1.0, 16.2)
    STN.cyl(L(e - sg * 1, 90, Z0 + 18.6), 0.09, 0.07, 8, n=6, k='steel')
    flagpole(L(e - sg * 3, 93, Z0 + 17.2), h=9, w=3.6)
# the main hall: hollow, its long walls with big arched openings low and half-round clerestories high, a barrel vault, coffered inside, copper outside
HU, HV0, HV1 = 62.0, 104.0, 138.0; HZ = Z0 + 30.0; VC = (HV0 + HV1) / 2; VR = (HV1 - HV0) / 2
arches(HV0, -HU, 7, 2 * HU / 7, Z0, Z0 + 16, Z0 + 8.5, 5.6, door=True); arches(HV1, -HU, 7, 2 * HU / 7, Z0, Z0 + 16, Z0 + 8.5, 5.6, nrm=1, door=True)
arches(HV0, -HU, 5, 2 * HU / 5, Z0 + 16, HZ, Z0 + 22.5, 7.0); arches(HV1, -HU, 5, 2 * HU / 5, Z0 + 16, HZ, Z0 + 22.5, 7.0, nrm=1)
for sg in (-1, 1): end_wall(sg * HU, HV0, HV1, Z0, HZ + VR, HZ, VR - 2.4, vault=VR + 0.4)
NV = 14
for k_ in range(NV):
    a0, a1 = math.pi * k_ / NV, math.pi * (k_ + 1) / NV
    for r_, key, u_h in ((VR - 0.3, 'stone', HU), (VR + 0.5, 'copper', HU + 1.0)):
        v0, z0, v1, z1 = VC - r_ * math.cos(a0), HZ + r_ * math.sin(a0), VC - r_ * math.cos(a1), HZ + r_ * math.sin(a1); face([L(-u_h, v0, z0), L(u_h, v0, z0), L(u_h, v1, z1), L(-u_h, v1, z1)], key)
for q in range(9):        # the vault's ribs inside, coffering in low poly
    u_ = -HU + q * 2 * HU / 8; prev = None
    for k_ in range(NV + 1):
        a0 = math.pi * k_ / NV; p = L(u_, VC - (VR - 0.8) * math.cos(a0), HZ + (VR - 0.8) * math.sin(a0))
        if prev: STN.beam(prev, p, 0.42, 'stone')
        prev = p
for sg in (-1, 1):        # the giant columns down each side of the hall, and its floor
    for q in range(9):
        u_ = -HU + 3 + q * (2 * HU - 6) / 8; p = L(u_, HV0 + 2.6 if sg < 0 else HV1 - 2.6, Z0); STN.box(p + Z * 0.7, (3.4, 3.4, 1.4), SY); STN.cyl(p + Z * 1.4, 1.2, 1.0, 26, n=10, k='stone', cap=False); STN.box(p + Z * 27.6, (3.2, 3.2, 1.0), SY)
face([L(-HU - 8, 92, Z0 + 0.06), L(HU + 8, 92, Z0 + 0.06), L(HU + 8, 150, Z0 + 0.06), L(-HU - 8, 150, Z0 + 0.06)], 'floor')
for q in range(5):        # benches and ticket booths: why you'd be in here
    sbox(-48 + q * 24, 121, Z0 + 0.06, 12, 1.2, 0.8, 'stone'); sbox(-52 + q * 26, HV1 - 7, Z0 + 0.06, 6, 3.2, 2.8, 'stone'); sbox(-52 + q * 26, HV1 - 7, Z0 + 2.86, 7, 4.2, 0.35, 'copper')
# the train shed: steel ribs and glass on the platforms, open to the land at the far end. The Penn concourse's idea
SV0, SV1 = 138.0, 225.0
for q in range(7):
    v_ = SV0 + q * (SV1 - SV0) / 6; prev = None
    for k_ in range(11):
        a0 = math.pi * k_ / 10; p = L(-46 * math.cos(a0), v_, Z0 + 12 + 11 * math.sin(a0))
        if prev: STN.beam(prev, p, 0.28, 'steel')
        prev = p
    for sg in (-1, 1): STN.beam(L(sg * 46, v_, Z0), L(sg * 46, v_, Z0 + 12), 0.34, 'steel')
for k_ in range(10):
    a0, a1 = math.pi * k_ / 10, math.pi * (k_ + 1) / 10
    if k_ % 3 != 1: STN.beam(L(-46 * math.cos(a0), SV0, Z0 + 12 + 11 * math.sin(a0)), L(-46 * math.cos(a0), SV1, Z0 + 12 + 11 * math.sin(a0)), 0.1, 'steel')
    else: STN.quad([L(-46 * math.cos(a0), SV0, Z0 + 12 + 11 * math.sin(a0)), L(-46 * math.cos(a1), SV0, Z0 + 12 + 11 * math.sin(a1)), L(-46 * math.cos(a1), SV1, Z0 + 12 + 11 * math.sin(a1)), L(-46 * math.cos(a0), SV1, Z0 + 12 + 11 * math.sin(a0))], 'copper')
sbox(0, (150 + 240) / 2, 0, 104, 240 - 150, PL)      # the plinth carries on under the shed, the tracks at its level
for u_, w_ in ((-24, 7), (0, 7), (24, 7)):        # platforms, a step up from the rails
    sbox(u_, (SV0 + SV1) / 2 + 6, Z0, w_, SV1 - SV0 + 12, 1.05); sbox(u_, (SV0 + SV1) / 2 + 6, Z0 + 1.05, w_ - 0.2, SV1 - SV0 + 12, 0.06, 'floor')
# ---- the railway: tracks in across the plain, a train standing at the platform
RL = 3400.0
for u_ in (-12, 12):
    rail_pts = []
    for q in range(int((RL - 150) / 40)):
        v0, v1 = 150 + q * 40, 150 + (q + 1) * 40; a, b = L(u_, v0), L(u_, v1)
        rz = lambda p_, v_: (gz(p_.x, p_.y) + 0.12) * ss(240, 440, v_) + (O_.z + PL + 0.06) * (1 - ss(240, 440, v_))      # off the plinth down a long, easy grade to the plain
        za, zb = rz(a, v0), rz(b, v1); ga, gb = gz(a.x, a.y) - 0.3, gz(b.x, b.y) - 0.3
        a, b = Vector((a.x, a.y, za)), Vector((b.x, b.y, zb)); s_u = eu * 2.2; FAR.quad([a - s_u, a + s_u, b + s_u, b - s_u], 'dark')
        if za - ga > 0.5 or zb - gb > 0.5:      # the embankment's sides
            for sg in (-1, 1):
                d_ = s_u * sg; e2 = eu * sg * 3.6; FAR.quad([a + d_, b + d_, Vector((b.x, b.y, gb)) + e2, Vector((a.x, a.y, ga)) + e2], 'slab')
        if q < 18:
            for sg in (-1, 1): FAR.beam(a + eu * 0.72 * sg + Z * 0.18, b + eu * 0.72 * sg + Z * 0.18, 0.05, 'steel')
            for k_ in range(13): sl = a.lerp(b, k_ / 13) + Z * 0.05; FAR.box(sl, (2.6, 0.3, 0.1), SY, 'corr')
def carriage(u_, v_, z_, L_=26.0, nose=False):
    c = L(u_, v_, z_); STN.box(c + Z * 2.3, (3.1, L_, 3.4), SY, 'steel')
    for sg in (-1, 1):
        q0, q1 = L(u_ + sg * 1.58, v_ - sg * L_ / 2, z_ + 0.6), L(u_ + sg * 1.58, v_ + sg * L_ / 2, z_ + 0.6); ART.quad([q0, q1, q1 + Z * 3.4, q0 + Z * 3.4], 'train', uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
    if nose: STN.box(L(u_, v_ + L_ / 2 + 1.5, z_ + 2.0), (3.0, 3.0, 2.6), SY, 'dark')
tz = Z0 + 0.1
for q in range(7): carriage(-12, 166 + q * 27, tz, nose=q == 6)
# ---- why it's here: the walk to the race. Over the Long Mile by a footbridge on the garden's axis, then a path through the infield to the camp road
fb_c = off(si, 0); pl_, pr_ = L(0, -2.5, 0), off(si, -(BD[-1][si] + 5))
for p_ in (pl_, pr_):
    g_ = gz(p_.x, p_.y); c0 = Vector((p_.x, p_.y, g_)); STN.box(c0 + Z * 6.5, (8, 8, 13), SY, 'stone'); STN.box(c0 + Z * 13.3, (9.2, 9.2, 0.7), SY, 'stone'); cc = [c0 + Z * 13.65 + eu * x_ * 4.6 + ev * y_ * 4.6 for x_, y_ in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for q in range(4): STN.quad([cc[q], cc[(q + 1) % 4], c0 + Z * 17.5], 'copper')
    for sg in (-1, 1):      # a round-headed door each way along the road
        for ax in (eu, ev):
            STN.box(c0 + ax * sg * 4.02 + Z * 2.4, (2.6, 0.08, 4.8) if ax is ev else (0.08, 2.6, 4.8), SY, 'dark')
DZ = max(gz(pl_.x, pl_.y), gz(pr_.x, pr_.y)) + 8.0; a, b = Vector((pl_.x, pl_.y, DZ)), Vector((pr_.x, pr_.y, DZ)); e_ = eu * 2.0
BLD.quad([a - e_, a + e_, b + e_, b - e_], 'slab')
for sg in (-1, 1):
    for zz in (0.0, 3.2): BLD.beam(a + e_ * sg + Z * zz, b + e_ * sg + Z * zz, 0.14)
    n = int((a - b).length / 3.4)
    for q in range(n): BLD.beam(a.lerp(b, q / n) + e_ * sg, a.lerp(b, (q + 1) / n) + e_ * sg + Z * 3.2, 0.06); BLD.beam(a.lerp(b, q / n) + e_ * sg + Z * 3.2, a.lerp(b, (q + 1) / n) + e_ * sg, 0.06)
panel(off(si, 0, DZ - 2.6 - CL[si].z + CL[si].z - CL[si].z) - eu * 2.1, 44, 2.6, TRAFFIC(si), 'station_sign', (0, 1, 0, 1), back=False)
mid_ = (Vector((pr_.x, pr_.y, 0)))
ribbon(path((pr_.x, pr_.y), (mid_.x - 90, mid_.y + 170), (372, -1340), (360, -1290)), 5.0, 'slab', 0.1)
STN_POS = L(0, 121, HZ)
# everything in the station's stone: the colour of the mesas, warmed and weathered by height
for f in STN.bm.faces:
    for l in f.loops:
        co = l.vert.co; t = 0.9 + 0.12 * fbm(co.x / 18, co.y / 18 + co.z / 9, 2); hd = 1 + 0.06 * math.sin(co.z * 0.5)
        l[STN.vc] = (min(1, 0.92 * t * hd), min(1, 0.72 * t * hd), min(1, 0.55 * t * hd), 1)
for key, c_ in (('hedge', (0.08, 0.19, 0.05, 1)), ('lawn', (0.34, 0.6, 0.2, 1))):
    k_i = STN.keys.index(key)
    for f in STN.bm.faces:
        if f.material_index == k_i:
            for l in f.loops: l[STN.vc] = c_
STN.done()
