"""The red roof: exec'd by build_qingshan.py. Grammar taken from Ferrari World Abu Dhabi (one low, wide red shell like a car body, about 45 m tall, a crisp edge, aluminium seams, a glass funnel where the roof dips to the ground). No Ferrari name, mark or copy of that building: the plan shape is the user's own drawing.
How: the grey outlines of the sketch become one smooth signed-distance field; the roof is a height function of it, so the silhouette is theirs and the skin falls to a clean edge everywhere. Everything is cut from that field:
    roof, funnel glass, soffit, curtain wall, edge band, forecourt.   Then the three stands (north, corner, main), open at the front under a raised edge, with their treads, seats and crowd."""
MAT.update({'roof': material('QS | red roof', tex='box_profile_metal_sheet', rough=.5, diff=TX / 'roof_red_diff_2k.jpg'), 'soffit': material('QS | roof soffit', tex='concrete_wall_009', vcol=False), 'glass': material('QS | curtain glass', (.05, .085, .10), .12, .1), 'alu': material('QS | aluminium', tex='brushed_concrete', rough=.42), 'mull': material('QS | mullion', (.20, .21, .22), .42, .7),
            'pave': material('QS | forecourt', tex='interlocking_concrete_pavers'), 'conc': material('QS | stand concrete', tex='brushed_concrete'), 'seat': material('QS | seats', (.11, .12, .13), .6)})
Pr = MAT['roof'].node_tree.nodes['Principled BSDF']      # paint, not bare metal: a matte deep red, its highlight no paler than the colour
for lk in list(Pr.inputs['Metallic'].links): MAT['roof'].node_tree.links.remove(lk)
Pr.inputs['Metallic'].default_value = 0.0; Pr.inputs['Specular IOR Level'].default_value = 0.28
cr = bpy.data.materials.new('QS | crowd'); cr.use_nodes = True; nt_ = cr.node_tree; P_ = nt_.nodes['Principled BSDF']; it_ = nt_.nodes.new('ShaderNodeTexImage'); it_.image = image(TX / 'crowd_rows.png'); nt_.links.new(it_.outputs['Color'], P_.inputs['Base Color']); P_.inputs['Roughness'].default_value = .9; gt_ = nt_.nodes.new('ShaderNodeMath'); gt_.operation = 'GREATER_THAN'; gt_.inputs[1].default_value = .5; nt_.links.new(it_.outputs['Alpha'], gt_.inputs[0]); nt_.links.new(gt_.outputs[0], P_.inputs['Alpha']); MAT['crowd'] = cr
UVS.update({'pave': 3.0, 'conc': 4.0, 'alu': 4.0, 'soffit': 5.0, 'glass': 6.0, 'mull': 4.0, 'seat': 3.0})
GR = STATS['shapes']['GREY']
def WP_(p): v = MM @ Vector((p[0] * kk, -p[1] * kk, 0)); return (v.x, v.y)
PG = {k: np.array([WP_(p) for p in v]) for k, v in GR.items() if isinstance(v, list)}; ROTS = {k: (np.array(WP_(v['c'])), v['r'] * kk) for k, v in GR.items() if isinstance(v, dict)}; RC, RR = ROTS['Rotunda A (big, glazed funnel)']; RC2, RR2 = ROTS['Rotunda B']
pts_ = np.vstack(list(PG.values()) + [RC + RR * np.array([[1, 1], [-1, -1]]), RC2 + RR2 * np.array([[1, 1], [-1, -1]])]); CELL_ = 4.0; xs_ = np.arange(pts_[:, 0].min() - 60, pts_[:, 0].max() + 60, CELL_); ys_ = np.arange(pts_[:, 1].min() - 60, pts_[:, 1].max() + 60, CELL_); X_, Y_ = np.meshgrid(xs_, ys_)
def psd(P, X, Y):      # signed distance to a polygon, positive inside
    A, B = P, np.roll(P, -1, 0); best = np.full(X.shape, 1e12); inside = np.zeros(X.shape, bool)
    for (ax, ay), (bx, by) in zip(A, B):
        dx, dy = bx - ax, by - ay; h = np.clip(((X - ax) * dx + (Y - ay) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1); best = np.minimum(best, (X - ax - h * dx) ** 2 + (Y - ay - h * dy) ** 2)
        inside ^= ((ay > Y) != (by > Y)) & (X < dx * (Y - ay) / (dy + 1e-12) + ax)
    return np.sqrt(best) * np.where(inside, 1, -1)
def smax(a, b, k): h = np.clip(.5 + .5 * (a - b) / k, 0, 1); return a * h + b * (1 - h) + k * h * (1 - h)
def blur(a, n):
    for _ in range(n): a = (a + np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 5
    return a
SD = {k: psd(P, X_, Y_) for k, P in PG.items()}; R_ = np.hypot(X_ - RC[0], Y_ - RC[1]); R2_ = np.hypot(X_ - RC2[0], Y_ - RC2[1])
D_ = np.maximum(RR - R_, RR2 - R2_)
for k in SD: D_ = smax(D_, SD[k], 14)
D_ = blur(D_, 5)      # hand wobble out of the outline, while the shell's ridges stay crisp
# the stands' fronts, as sketched: an open edge raised over the seats, for 60 m back from the front line only; behind that the building closes
FRONTS = {'North block / stand': [(1403, 290), (1355, 443)], 'Corner stand': [(1533, 670), (1527, 837)], 'Main stand': [(1050, 984), (1200, 969), (1300, 956), (1425, 947)]}
STs = []
for k, line in FRONTS.items():
    wl = np.array([WP_(p) for p in line]); best = np.full(X_.shape, 1e12)
    for (ax, ay), (bx, by) in zip(wl, wl[1:]):
        dx, dy = bx - ax, by - ay; h = np.clip(((X_ - ax) * dx + (Y_ - ay) * dy) / (dx * dx + dy * dy), 0, 1); best = np.minimum(best, (X_ - ax - h * dx) ** 2 + (Y_ - ay - h * dy) ** 2)
    STs.append(np.clip((SD[k] + 2) / 14, 0, 1) * np.clip((62 - np.sqrt(best)) / 12, 0, 1))
ST_ = blur(np.max(STs, 0), 3); ST_ = ST_ * ST_ * (3 - 2 * ST_)
HM = 12.0 + 11.0 * ST_ + 30.0 * (1 - np.exp(-D_ / 40.0)); HM = np.minimum(HM, 60.0)      # low and long, not domed: nearly straight up from the edge to a ridge. Not clamped outside the edge, so the rim interpolates clean
def funnel(H_, r, inner, outer, low): f = np.clip((r - inner) / (outer - inner), 0, 1); f = f * f * (3 - 2 * f); return np.where(r < outer, low + (H_ - low) * f ** 1.2, H_)
Z_ROOF = funnel(funnel(HM, R_, 11, 60, 8.0), R2_, 6, 30, 12.0); BASE = gz(float(RC[0]), float(RC[1])); Z_ROOF = Z_ROOF + BASE; RG, RG2 = 47.0, 22.0
def sample(A, x, y):
    u, v = (x - xs_[0]) / CELL_, (y - ys_[0]) / CELL_; i, j = int(np.clip(u, 0, len(xs_) - 2)), int(np.clip(v, 0, len(ys_) - 2)); s, t = u - i, v - j
    return A[j, i] * (1 - s) * (1 - t) + A[j, i + 1] * s * (1 - t) + A[j + 1, i] * (1 - s) * t + A[j + 1, i + 1] * s * t
def clipped(bm, F, Z, mi=0, flip=False, uv=None):
    """the surface z = Z over the part of the grid where F > 0, its boundary exactly on F = 0 (marching squares), vertices shared so it shades smooth"""
    V = {}; ny, nx = F.shape; uvl = bm.loops.layers.uv.verify() if uv else None
    def vert(key):
        if key in V: return V[key]
        if key[0] == 'c': j, i = key[1:]; x, y, z = xs_[i], ys_[j], Z[j, i]
        else:
            j0, i0, j1, i1 = key[1:]; a, b = F[j0, i0], F[j1, i1]; t = a / (a - b); x, y, z = xs_[i0] + (xs_[i1] - xs_[i0]) * t, ys_[j0] + (ys_[j1] - ys_[j0]) * t, Z[j0, i0] + (Z[j1, i1] - Z[j0, i0]) * t
        V[key] = bm.verts.new((float(x), float(y), float(z))); return V[key]
    for j in range(ny - 1):
        for i in range(nx - 1):
            c = ((j, i), (j, i + 1), (j + 1, i + 1), (j + 1, i)); sg = [F[q] > 0 for q in c]
            if not any(sg): continue
            poly = []
            for k in range(4):
                a, b = c[k], c[(k + 1) % 4]
                if sg[k]: poly.append(('c',) + a)
                if sg[k] != sg[(k + 1) % 4]: poly.append(('e',) + (a + b if a < b else b + a))
            vv = [vert(k) for k in poly]
            if len(set(vv)) < 3: continue
            try: f = bm.faces.new(vv[::-1] if flip else vv)
            except ValueError: continue
            f.material_index = mi; f.smooth = True
            if uv:
                for l in f.loops: l[uvl].uv = uv(l.vert.co)
def contour(F):
    """the segments of F = 0: each with F > 0 on its left"""
    out = []; ny, nx = F.shape
    def cross(a, b): t = F[a] / (F[a] - F[b]); return (xs_[a[1]] + (xs_[b[1]] - xs_[a[1]]) * t, ys_[a[0]] + (ys_[b[0]] - ys_[a[0]]) * t)
    for j in range(ny - 1):
        for i in range(nx - 1):
            c = ((j, i), (j, i + 1), (j + 1, i + 1), (j + 1, i)); sg = [F[q] > 0 for q in c]; e = [cross(c[k], c[(k + 1) % 4]) for k in range(4) if sg[k] != sg[(k + 1) % 4]]
            if len(e) == 2:
                p, q = e; mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2; nl = (-(q[1] - p[1]), q[0] - p[0])
                out.append((p, q) if sample(F, mx + nl[0] * .2, my + nl[1] * .2) > 0 else (q, p))
    return out
# ---- skin. Ribs run across the crescent's width, the way the rain runs off: UV along a fixed direction
ca_, sa_ = (lambda v: (v[0] / math.hypot(*v), v[1] / math.hypot(*v)))(np.array(WP_((1600, 390))) - np.array(WP_((1490, 400)))); REP = 9.0
uv_roof = lambda c: ((-c.x * sa_ + c.y * ca_) / REP, (c.x * ca_ + c.y * sa_) / REP)
bm = bmesh.new(); clipped(bm, np.minimum(np.minimum(D_, R_ - RG), R2_ - RG2), Z_ROOF, uv=uv_roof); mesh_obj('QS red roof', bm, ['roof'], planar=False)
bm = bmesh.new(); clipped(bm, np.maximum(RG + .5 - R_, RG2 + .5 - R2_), Z_ROOF, uv=lambda c: (c.x / 8, c.y / 8)); mesh_obj('QS funnel glass', bm, ['glass'], planar=False)
bm = bmesh.new(); clipped(bm, np.minimum(D_, 18 + 70 * ST_ - D_), Z_ROOF - 1.1, flip=True, uv=lambda c: (c.x / 5, c.y / 5)); mesh_obj('QS soffit', bm, ['soffit'], planar=False)
# the funnels' ribs and rings; the glass reads as glass because the steel draws it
Kf = Kit(Matrix.Identity(4))
def ringpts(Cc, r, n=72): return [Vector((Cc[0] + r * math.cos(2 * math.pi * k / n), Cc[1] + r * math.sin(2 * math.pi * k / n), sample(Z_ROOF, Cc[0] + r * math.cos(2 * math.pi * k / n), Cc[1] + r * math.sin(2 * math.pi * k / n)) + .15)) for k in range(n + 1)]
for Cc, R0_, R1_, ribs, thin in ((RC, RG, 11.5, 32, .16), (RC2, RG2, 6.5, 18, .12)):
    Kf.tube('mull', ringpts(Cc, R0_), thin * 3.4, n=6); Kf.tube('mull', ringpts(Cc, R1_, 28), thin * 2.5, n=6); Kf.tube('mull', ringpts(Cc, (R0_ + R1_) / 2, 56), thin, n=5)
    for k in range(ribs):
        a_ = 2 * math.pi * k / ribs; Kf.tube('mull', [Vector((Cc[0] + r * math.cos(a_), Cc[1] + r * math.sin(a_), sample(Z_ROOF, Cc[0] + r * math.cos(a_), Cc[1] + r * math.sin(a_)) + .12)) for r in np.linspace(R1_, R0_, 7)], thin, n=4)
# ---- the edge band, the curtain wall set back under it, its frame, a stone-grey plinth
bm_e = bmesh.new(); seg0 = contour(D_)
for p, q in seg0:
    z0, z1 = sample(Z_ROOF, *p), sample(Z_ROOF, *q); a = bm_e.verts.new((p[0], p[1], z0 + .25)); b = bm_e.verts.new((q[0], q[1], z1 + .25)); c = bm_e.verts.new((q[0], q[1], z1 - 1.25)); d = bm_e.verts.new((p[0], p[1], z0 - 1.25)); bm_e.faces.new((d, c, b, a))
mesh_obj('QS roof edge', bm_e, ['alu'], planar=True)
def chains(segs):      # the contour's segments joined up, so the wall's frame can be spaced along it evenly
    key = lambda p: (round(float(p[0]), 2), round(float(p[1]), 2)); nxt = {key(p): (p, q) for p, q in segs}; out = []
    while nxt:
        k = next(iter(nxt)); line = [nxt[k][0]]
        while k in nxt: p, q = nxt.pop(k); line.append(q); k = key(q)
        out.append(line)
    return out
bm_g = bmesh.new(); bm_m = Kf.bm('mull'); bm_c = Kf.bm('conc'); WALLIN = 7.0; nseg = 0; BAY = 6.0; FLOOR = 4.4
def band(bm_, p, q, n, z0p, z1p, z0q, z1q, out):
    bm_.faces.new([bm_.verts.new(c_) for c_ in ((p[0] + n[0] * out, p[1] + n[1] * out, z0p), (q[0] + n[0] * out, q[1] + n[1] * out, z0q), (q[0] + n[0] * out, q[1] + n[1] * out, z1q), (p[0] + n[0] * out, p[1] + n[1] * out, z1p))])
for line in chains(contour(D_ - WALLIN)):
    walked = 0.0
    for p, q in zip(line, line[1:]):
        dx, dy = q[0] - p[0], q[1] - p[1]; L0 = math.hypot(dx, dy)
        if L0 < 1e-4: continue
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2; walked_prev = walked; walked += L0
        if sample(ST_, mx, my) > .4: continue      # the stand's open front
        n = (dy / L0, -dx / L0); g0, g1 = gz(*p), gz(*q); t0, t1 = sample(Z_ROOF, *p) - 1.0, sample(Z_ROOF, *q) - 1.0; nseg += 1
        band(bm_g, p, q, n, g0 + 1.2, t0, g1 + 1.2, t1, 0.0); band(bm_c, p, q, n, g0 - .3, g0 + 1.25, g1 - .3, g1 + 1.25, .3)      # glass and its plinth
        h_ = g0 + 4.6
        while h_ < max(t0, t1) - .7: band(bm_m, p, q, n, h_ - .09, h_ + .09, g1 - g0 + h_ - .09, g1 - g0 + h_ + .09, .12); h_ += FLOOR      # floor lines, following the wall
        m0 = math.ceil(walked_prev / BAY)
        while m0 * BAY <= walked:      # a mullion every 6 m along the wall, wherever the grid's cells happen to fall
            t_ = (m0 * BAY - walked_prev) / L0; x_, y_ = p[0] + dx * t_, p[1] + dy * t_; gm = g0 + (g1 - g0) * t_; tm = t0 + (t1 - t0) * t_; Kf.box('mull', (x_ + n[0] * .12, y_ + n[1] * .12, (gm + tm) / 2), (.3, .3, tm - gm)); m0 += 1
mesh_obj('QS curtain wall', bm_g, ['glass'], planar=True)
# ---- forecourt round the whole building
Zg = np.zeros(D_.shape)
for j in range(D_.shape[0]):
    for i in range(D_.shape[1]):
        if D_[j, i] > -24: Zg[j, i] = gz(float(xs_[i]), float(ys_[j])) + .07
bm = bmesh.new(); clipped(bm, D_ + 17 + 5 * blur(np.sin(X_ / 37) * np.cos(Y_ / 29), 2), Zg); mesh_obj('QS forecourt', bm, ['pave'], planar=True, smooth=True)
# ---- the stands under the raised edges: treads, seats, parapet, back wall, end walls, crowd
NR_, TR_, RS_ = 36, .85, .5; Cb = bmesh.new(); uvc = Cb.loops.layers.uv.verify(); STAND_POS = {}
def stand(name, A_, B_, ends=True):
    A_, B_ = np.array(A_), np.array(B_); L_ = float(np.linalg.norm(B_ - A_)); tx_ = (B_ - A_) / L_; ny_ = np.array([-tx_[1], tx_[0]]); mid_ = (A_ + B_) / 2; j_, _d = near(*mid_); road_ = np.array([CL[j_].x, CL[j_].y]) - mid_
    if ny_ @ road_ < 0: ny_ = -ny_
    zs_ = gz(*mid_); Ws = Matrix(((tx_[0], ny_[0], 0, A_[0]), (tx_[1], ny_[1], 0, A_[1]), (0, 0, 1, zs_), (0, 0, 0, 1))); Ks = Kit(Ws); S0, S1, O0 = (8.0 if ends else 0.0), L_ - (8.0 if ends else 0.0), -14.0; SW = S1 - S0; SC = (S0 + S1) / 2
    Ks.box('conc', (SC, O0 + .3, 1.0), (SW + (1 if ends else 0), .5, 2.0))
    for k in range(NR_):
        y_ = O0 - k * TR_; z_ = 1.7 + k * RS_; Ks.box('conc', (SC, y_ - TR_ / 2, z_ / 2), (SW, TR_ + .02, z_)); Ks.box('seat', (SC, y_ - .28, z_ + .24), (SW - .4, .38, .46))
    zt = 1.7 + NR_ * RS_; yb = O0 - NR_ * TR_; Ks.box('conc', (SC, yb - .5, (zt + 7) / 2), (SW + 1, 1.0, zt + 7))
    if ends:
        for sx in (S0, S1): Ks.box('conc', (sx, (O0 + yb) / 2, (zt + 2) / 2), (.8, O0 - yb + 1, zt + 2))
    for k in range(NR_):
        z_ = 1.7 + k * RS_ + .05
        for y_, var, u0 in ((O0 - k * TR_ - .02, (k * 3) % 4, k * .37 + S0 / 14), (O0 - k * TR_ - .35, (k * 3 + 2) % 4, k * .61 + S0 / 14 + .43)):      # a card ahead of the seat boxes, or they hide the people and a dark seat is all that shows; a second row behind it fills the first's gaps, far enough back not to fight it
            a = [Cb.verts.new(Ws @ Vector(p)) for p in ((S0 + .6, y_, z_), (S1 - .6, y_, z_), (S1 - .6, y_, z_ + 1.15), (S0 + .6, y_, z_ + 1.15))]; f = Cb.faces.new(a); u1 = u0 + (SW - 1.2) / 14.0
            for l, (u, v) in zip(f.loops, ((u0, 0), (u1, 0), (u1, 1), (u0, 1))): l[uvc].uv = (u, (var + v) / 4)
    for k_, b_ in Ks.b.items(): mesh_obj(f'QS {name} {k_}', b_, [k_], planar=True)
    STAND_POS[name] = (float(mid_[0]), float(mid_[1]), float(zs_))
for name, line in FRONTS.items():
    wl = [WP_(p) for p in line]; many = len(wl) > 2
    for q, (a, b) in enumerate(zip(wl, wl[1:])): stand(f"{name.split()[0]} stand {q}", a, b, ends=not many)
mesh_obj('QS stand crowd', Cb, ['crowd'], planar=False)
for k_, b_ in Kf.b.items(): mesh_obj(f'QS arena {k_}', b_, [k_], planar=True)
gone = 0      # the forecourt and glass stay clear: no tree or weed against the building
for ob in list(FOREST.objects):
    x_, y_ = ob.location.x, ob.location.y
    if xs_[0] < x_ < xs_[-1] and ys_[0] < y_ < ys_[-1] and sample(D_, x_, y_) > -48: bpy.data.objects.remove(ob, do_unlink=True); gone += 1
log('forest cleared at the arena', gone)
ARENA = dict(rotunda=(float(RC[0]), float(RC[1]), float(BASE)), rotunda_b=(float(RC2[0]), float(RC2[1]), float(BASE)), stand=STAND_POS['North stand 0'], corner=STAND_POS['Corner stand 0'], main=STAND_POS['Main stand 1'], crown=float(Z_ROOF.max()))
log('arena', ARENA, 'wall segments', nseg, 'edge', len(seg0))
