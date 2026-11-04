"""Grand pillared buildings for Venice's lower loop, with real depth (exec'd by venice_city.py). Everything is relief and holes, nothing painted on: windows sit in the wall behind reveals with surrounds, sills and
hoods; cornices overhang; columns have a base, an entasis and a capital; every wall carries grime in its vertex colours so a texture never reads flat. Types (each takes materials, order, sizes, so no two match):
  temple_hall      a pedimented portico on steps, in front of a windowed hall
  colonnade_block  a giant order along a long front on a rusticated base, with a pedimented centre (the Federal Triangle look the user chose: no insignia, no real building copied)
  arcade_block     Victorian: a deep arcade on the street, engaged columns over it, a balustrade, a slate mansard with dormers, corner pavilions
  loggia_exchange  a two-storey loggia of paired columns between solid pavilions
  rotunda          a drum in a ring of columns under a ribbed dome
  palazzo          Italianate plaster over a rusticated base, stone quoins, pedimented windows, a heavy cornice
  monument_column  a free-standing column on a pedestal, no statue
A frame W is a wall: origin o, direction u, outward normal n = u x up. Faces are wound to face out, for the web's back-face culling later."""
UP = Vector((0, 0, 1)); KIT_YAW = 0.0; LOD_FORCE = None      # set when a caller has worked out what a driver can see itself (the palazzi)
def road_d(p): return near(p.x, p.y)[1]
def facing_road(p, n_):
    i, d = near(p.x, p.y); return (CL[i] - p).to_2d().dot(n_.to_2d()) > -0.3 * max(d, 1.0)      # the side walls count: you see them coming
def lod(p, n_=None):
    """2: real depth. 1: a flat shape on the wall. 0: plain wall. Set by what a driver can see: the web's budget goes on what is close to the road"""
    if LOD_FORCE is not None: return LOD_FORCE
    d = road_d(p)
    if n_ is not None and not facing_road(p, n_): return 0
    return 2 if d < 62 else 1 if d < 175 else 0
def grime(p):
    return (0.8 + 0.2 * ss(GZ0, GZ0 + 5, p.z)) * (0.93 + 0.14 * noise.noise(Vector(((p.x + p.y) / 3.1, p.z / 22.0, 0.3)))) * (0.92 + 0.16 * noise.noise(Vector((p.x / 31.0, p.y / 31.0, p.z / 17.0))))
class GSheet(Sheet):
    """every vertex carries grime: darker at the foot of a wall, with vertical streaks"""
    def face(s, pts, k, col=(1, 1, 1)):
        f = s.bm.faces.new([s.bm.verts.new(p) for p in pts]); f.material_index = s.keys.index(k)
        for l in f.loops:
            g = grime(l.vert.co); l[s.vc] = (col[0] * g, col[1] * g, col[2] * g, 1)
        return f
GZ0 = Z(0.0)
KT = GSheet('VE kit', ['lime', 'soot', 'ochre', 'red', 'rose', 'worn', 'brick', 'dbrick', 'tile', 'slate', 'glass', 'frame', 'lead', 'timber', 'limes', 'iron', 'hedge', 'stake', 'piazza', 'canvas', 'cloth2', 'paint', 'lozenge'])
KR = GSheet('VE kit round', KT.keys)
PALE, WARM, SOOTY, WHITE, GREEN_LEAD = (1.0, 0.98, 0.93), (0.95, 0.88, 0.76), (0.72, 0.7, 0.68), (1, 1, 1), (0.62, 0.8, 0.72)
def lathe_k(c, prof, k, col, n=14, scale=None):
    """a round part: shared verts so it shades smooth, UVs round its girth at the material's real-world scale"""
    bm = KR.bm; uv = bm.loops.layers.uv.verify(); sc_ = scale or UVS.get(k, 3.0); mi = KR.keys.index(k); dr_ = road_d(c)
    n = min(n, 8) if dr_ > 170 else min(n, 12) if dr_ > 60 else n
    rings = [[bm.verts.new(c + Vector((r_ * math.cos(2 * math.pi * q / n), r_ * math.sin(2 * math.pi * q / n), z))) for q in range(n)] for r_, z in prof]
    for ra, rb, (r0, z0), (r1, z1) in zip(rings, rings[1:], prof, prof[1:]):
        rm = max(r0, r1)
        for q in range(n):
            q1 = (q + 1) % n; f = bm.faces.new([ra[q], ra[q1], rb[q1], rb[q]]); f.material_index = mi
            for l, (a_, zb) in zip(f.loops, ((q, z0), (q + 1, z0), (q + 1, z1), (q, z1))):
                g = grime(l.vert.co); l[uv].uv = (a_ * 2 * math.pi / n * rm / sc_, zb / sc_); l[KR.vc] = (col[0] * g, col[1] * g, col[2] * g, 1)
class W:
    def __init__(s, o, u): s.o = o.copy(); s.u = u.normalized(); s.n = Vector((s.u.y, -s.u.x, 0))
    def p(s, a, z, d=0.0): return s.o + s.u * a + UP * z + s.n * d
def rect(w, a0, a1, z0, z1, d, k, col): KT.face([w.p(a0, z0, d), w.p(a1, z0, d), w.p(a1, z1, d), w.p(a0, z1, d)], k, col)
def relief(w, a0, a1, z0, z1, d0, d1, k, col, top=True, bottom=True, front=True):
    if front: rect(w, a0, a1, z0, z1, d1, k, col)
    if top: KT.face([w.p(a0, z1, d1), w.p(a1, z1, d1), w.p(a1, z1, d0), w.p(a0, z1, d0)], k, col)
    if bottom: KT.face([w.p(a0, z0, d0), w.p(a1, z0, d0), w.p(a1, z0, d1), w.p(a0, z0, d1)], k, col)
    KT.face([w.p(a0, z0, d0), w.p(a0, z0, d1), w.p(a0, z1, d1), w.p(a0, z1, d0)], k, col)
    KT.face([w.p(a1, z0, d1), w.p(a1, z0, d0), w.p(a1, z1, d0), w.p(a1, z1, d1)], k, col)
def arch_pts(a0, a1, spring, rise, n=8, pointed=False):
    out = []
    for q in range(n + 1):
        t_ = q / n; x = a0 + (a1 - a0) * t_; c_ = 2 * t_ - 1
        out.append((x, spring + (rise * (1 - abs(c_)) ** 0.75 if pointed else rise * math.sqrt(max(0.0, 1 - c_ * c_)))))
    return out
def window(w, a, z0, wd, ht, k, col, trim='lime', tcol=PALE, depth=0.42, rise=0.0, hood=None, surround=True, panel=None, sill=True, pointed=False, glass=True):
    """one opening with a real recess, in a wall panel panel=(a0, a1, z0, z1); the panel's wall is built round the hole"""
    a0, a1, z1 = a - wd / 2, a + wd / 2, z0 + ht; P0, P1, Pz0, Pz1 = panel; L_ = lod(w.p(a, z0), w.n)
    if L_ == 0: rect(w, P0, P1, Pz0, Pz1, 0, k, col); return
    if L_ == 1:
        rect(w, P0, P1, Pz0, Pz1, 0, k, col)
        KT.face([w.p(a0, z0, 0.08), w.p(a1, z0, 0.08)] + ([w.p(x, z_, 0.08) for x, z_ in arch_pts(a0, a1, z1, rise, n=4, pointed=pointed)[::-1]] if rise > 0 else [w.p(a1, z1, 0.08), w.p(a0, z1, 0.08)]), 'glass')      # 8 cm: the web pack rounds this mesh's positions to about 3 cm
        return
    glass = glass and road_d(w.p(a, z0)) < 45 or (glass and rise > 0)      # glazing bars only where you could count them
    rect(w, P0, a0, Pz0, Pz1, 0, k, col); rect(w, a1, P1, Pz0, Pz1, 0, k, col); rect(w, a0, a1, Pz0, z0, 0, k, col)      # left, right, below
    if rise > 0:
        ap = arch_pts(a0, a1, z1, rise, pointed=pointed)
        for (x0, z_0), (x1, z_1) in zip(ap, ap[1:]): KT.face([w.p(x0, z_0), w.p(x1, z_1), w.p(x1, Pz1), w.p(x0, Pz1)], k, col)
        for (x0, z_0), (x1, z_1) in zip(ap, ap[1:]): KT.face([w.p(x1, z_1, 0), w.p(x0, z_0, 0), w.p(x0, z_0, -depth), w.p(x1, z_1, -depth)], k, col)      # the arch's soffit
        if glass: KT.face([w.p(a0, z0, -depth), w.p(a1, z0, -depth)] + [w.p(x, z_, -depth) for x, z_ in ap[::-1]], 'glass')
    else:
        rect(w, a0, a1, z1, Pz1, 0, k, col)
        KT.face([w.p(a1, z1, 0), w.p(a0, z1, 0), w.p(a0, z1, -depth), w.p(a1, z1, -depth)], k, col)      # the head's soffit
        if glass: rect(w, a0, a1, z0, z1, -depth, 'glass', WHITE)
    KT.face([w.p(a0, z0, -depth), w.p(a1, z0, -depth), w.p(a1, z0, 0), w.p(a0, z0, 0)], k, col)      # the sill's top, inside
    KT.face([w.p(a0, z0, -depth), w.p(a0, z0, 0), w.p(a0, z1, 0), w.p(a0, z1, -depth)], k, col); KT.face([w.p(a1, z0, 0), w.p(a1, z0, -depth), w.p(a1, z1, -depth), w.p(a1, z1, 0)], k, col)      # reveals
    if glass and road_d(w.p(a, z0)) < 40:      # glazing bars, a little proud of the glass
        d_ = -depth + 0.05; top_ = z1 + rise * 0.8
        rect(w, a - 0.04, a + 0.04, z0, top_, d_, 'frame', WHITE)
        for f_ in (0.36, 0.7): rect(w, a0, a1, z0 + ht * f_ - 0.03, z0 + ht * f_ + 0.03, d_, 'frame', WHITE)
    if surround:
        s_ = 0.22; o_ = 0.1
        relief(w, a0 - s_, a0, z0, z1, 0, o_, trim, tcol, top=rise <= 0, bottom=False); relief(w, a1, a1 + s_, z0, z1, 0, o_, trim, tcol, top=rise <= 0, bottom=False)
        if rise <= 0: relief(w, a0 - s_, a1 + s_, z1, z1 + s_, 0, o_, trim, tcol, bottom=False)
        else:
            ap = arch_pts(a0 - s_, a1 + s_, z1, rise + s_, pointed=pointed); ai = arch_pts(a0, a1, z1, rise, pointed=pointed)
            for (x0, z_0), (x1, z_1), (y0, u_0), (y1, u_1) in zip(ap, ap[1:], ai, ai[1:]): KT.face([w.p(y0, u_0, o_), w.p(y1, u_1, o_), w.p(x1, z_1, o_), w.p(x0, z_0, o_)], trim, tcol)
            if not pointed: relief(w, a - 0.28, a + 0.28, z1 + rise - 0.1, z1 + rise + s_ + 0.28, 0, o_ + 0.08, trim, tcol)      # the keystone
    if sill: relief(w, a0 - 0.32, a1 + 0.32, z0 - 0.2, z0, 0, 0.2, trim, tcol)
    zh = z1 + (rise + 0.3 if rise > 0 else 0.3)
    if hood == 'flat': cornice(w, a0 - 0.45, a1 + 0.45, zh, 0.35, trim, tcol)
    elif hood == 'tri':
        cornice(w, a0 - 0.45, a1 + 0.45, zh, 0.3, trim, tcol); x0, x1, xm, zb, zt = a0 - 0.5, a1 + 0.5, a, zh + 0.14, zh + 0.14 + wd * 0.32; d_ = 0.26
        KT.face([w.p(x0, zb, d_), w.p(x1, zb, d_), w.p(xm, zt, d_)], trim, tcol); KT.face([w.p(x0, zb, d_), w.p(xm, zt, d_), w.p(xm, zt, 0), w.p(x0, zb, 0)], trim, tcol); KT.face([w.p(xm, zt, d_), w.p(x1, zb, d_), w.p(x1, zb, 0), w.p(xm, zt, 0)], trim, tcol)
    elif hood == 'seg':
        cornice(w, a0 - 0.45, a1 + 0.45, zh, 0.3, trim, tcol); ap = arch_pts(a0 - 0.5, a1 + 0.5, zh + 0.14, wd * 0.26, n=6); d_ = 0.26
        KT.face([w.p(x, z_, d_) for x, z_ in ap[::-1]], trim, tcol)
        for (x0, z_0), (x1, z_1) in zip(ap, ap[1:]): KT.face([w.p(x0, z_0, d_), w.p(x1, z_1, d_), w.p(x1, z_1, 0), w.p(x0, z_0, 0)], trim, tcol)
def cornice(w, a0, a1, z, sc_, k, col, modillions=False):
    """an overhanging moulded course, closed at its ends"""
    prof = [(0.0, 0.0), (0.12, 0.18), (0.32, 0.26), (0.5, 0.62), (0.62, 0.62), (0.72, 1.0), (0.98, 1.0), (1.0, 0.0)]
    prof = [(zz * sc_, dd * sc_) for zz, dd in prof]
    for (z0_, d0), (z1_, d1) in zip(prof, prof[1:]): KT.face([w.p(a0, z + z0_, d0), w.p(a1, z + z0_, d0), w.p(a1, z + z1_, d1), w.p(a0, z + z1_, d1)], k, col)
    KT.face([w.p(a0, z + zz, dd) for zz, dd in prof[::-1]], k, col); KT.face([w.p(a1, z + zz, dd) for zz, dd in prof], k, col)
    if modillions and lod(w.p((a0 + a1) / 2, z), w.n) == 2 and road_d(w.p((a0 + a1) / 2, z)) < 50:
        step = sc_ * 1.1; q = a0 + step / 2
        while q < a1 - step / 2: relief(w, q - sc_ * 0.14, q + sc_ * 0.14, z + 0.32 * sc_ - sc_ * 0.24, z + 0.5 * sc_, 0.2 * sc_, 0.62 * sc_, k, col, top=False); q += step
def rusticate(w, a0, a1, z0, z1, k, col, band=0.85, gap=0.13, depth=0.14):
    """courses of stone with shadow joints: the base storey's weight"""
    pm = w.p((a0 + a1) / 2, z0)
    if lod(pm, w.n) < 2 or road_d(pm) > 50: rect(w, a0, a1, z0, z1, 0, k, col); return
    z = z0; rect(w, a0, a1, z0, z1, 0, k, (col[0] * 0.55, col[1] * 0.55, col[2] * 0.55)); q = 0
    while z < z1:
        relief(w, a0, a1, z, min(z + band, z1), 0, depth, k, col, top=True, bottom=False); z += band + gap
def balustrade(w, a0, a1, z, k, col, h=1.1, pitch=0.62, solid_past=34):
    pm = w.p((a0 + a1) / 2, z); dm = road_d(pm)
    if not facing_road(pm, w.n) or dm > 170: return
    relief(w, a0, a1, z + h - 0.16, z + h, -0.3, 0.02, k, col, bottom=False)
    if dm > solid_past or a1 - a0 > 60 and dm > 26: rect(w, a0, a1, z, z + h - 0.16, -0.12, k, (col[0] * 0.72, col[1] * 0.72, col[2] * 0.72)); return      # a solid rail: balusters can't be told apart past here
    relief(w, a0, a1, z, z + 0.16, -0.28, 0.0, k, col)
    q = a0 + pitch / 2; c_ = 0
    while q < a1:
        if c_ % 9 == 8: relief(w, q - 0.2, q + 0.2, z + 0.16, z + h - 0.16, -0.26, -0.02, k, col, top=False, bottom=False)      # a pier every so often
        else: relief(w, q - 0.07, q + 0.07, z + 0.16, z + h - 0.16, -0.2, -0.08, k, col, top=False, bottom=False)
        q += pitch; c_ += 1
def kcolumn(c, h_, r_, order, k, col, plinth=True):
    """a column standing at c (a world point at its foot): plinth, base mouldings, a shaft with entasis, then its order's capital"""
    d_ = r_ * 1.45; x_, y_ = c.x, c.y; z = c.z; dr_ = road_d(c)
    if dr_ > 175:      # a far column: a shaft and a cap
        cap = {'doric': 0.9, 'ionic': 1.2, 'corinthian': 2.1}[order] * r_; lathe_k(c, [(r_ * 1.1, 0), (r_, 0.4), (r_ * 0.85, h_ - cap), (r_ * 1.35, h_)], 'limes' if k == 'lime' else k, col, n=6); return
    if plinth: KT.block(Vector((x_, y_, z)), (d_ * 2, d_ * 2, r_ * 0.45), KIT_YAW, k, col); z += r_ * 0.45
    lathe_k(Vector((x_, y_, z)), [(r_ * 1.32, 0), (r_ * 1.32, r_ * 0.18), (r_ * 1.12, r_ * 0.28), (r_ * 1.2, r_ * 0.42), (r_ * 1.02, r_ * 0.55)] if dr_ < 45 else [(r_ * 1.32, 0), (r_ * 1.2, r_ * 0.3), (r_ * 1.02, r_ * 0.55)], k, col, n=12)
    z0 = z + r_ * 0.55; cap = {'doric': 0.9, 'ionic': 1.2, 'corinthian': 2.1}[order] * r_; h_s = h_ - (z0 - c.z) - cap
    lathe_k(Vector((x_, y_, z0)), [(r_ * (1.0 if t_ < 0.33 else 1.0 - 0.17 * ((t_ - 0.33) / 0.67) ** 1.4), t_ * h_s) for t_ in ((0, 0.33, 0.66, 1.0) if dr_ < 45 else (0, 0.5, 1.0))], 'limes' if k == 'lime' else k, col, n=14 if dr_ < 45 else 10)
    zc = z0 + h_s; rt = r_ * 0.83
    if order == 'doric':
        lathe_k(Vector((x_, y_, zc)), [(rt, 0), (rt * 1.04, r_ * 0.1), (rt * 1.38, r_ * 0.5), (rt * 1.38, r_ * 0.56)], k, col); KT.block(Vector((x_, y_, zc + r_ * 0.56)), (rt * 3.0, rt * 3.0, r_ * 0.34), KIT_YAW, k, col)
    elif order == 'ionic':
        lathe_k(Vector((x_, y_, zc)), [(rt, 0), (rt * 1.05, r_ * 0.14), (rt * 1.26, r_ * 0.5), (rt * 1.2, r_ * 0.75)], k, col); KT.block(Vector((x_, y_, zc + r_ * 0.75)), (rt * 3.05, rt * 2.5, r_ * 0.45), KIT_YAW, k, col)
    else:
        lathe_k(Vector((x_, y_, zc)), [(rt, 0), (rt * 1.14, r_ * 0.3), (rt * 1.02, r_ * 0.55), (rt * 1.24, r_ * 0.86), (rt * 1.12, r_ * 1.12), (rt * 1.42, r_ * 1.45), (rt * 1.3, r_ * 1.7)] if dr_ < 45 else [(rt, 0), (rt * 1.2, r_ * 0.8), (rt * 1.3, r_ * 1.7)], k, col, n=12); KT.block(Vector((x_, y_, zc + r_ * 1.7)), (rt * 3.3, rt * 3.3, r_ * 0.4), KIT_YAW, k, col)
def pediment(w, a0, a1, z, rise, d0, d1, k, col):
    """a triangular gable, its tympanum set back behind raking cornices"""
    am, zt = (a0 + a1) / 2, z + rise; t_ = 0.55
    KT.face([w.p(a0, z, d1 - 0.5), w.p(a1, z, d1 - 0.5), w.p(am, zt, d1 - 0.5)], k, col); KT.face([w.p(a1, z, d0), w.p(a0, z, d0), w.p(am, zt, d0)], k, col)
    for x0, z0_, x1, z1_ in ((a0, z, am, zt), (am, zt, a1, z)):      # raking cornices
        KT.face([w.p(x0, z0_, d1), w.p(x1, z1_, d1), w.p(x1, z1_ + t_, d1), w.p(x0, z0_ + t_, d1)], k, col)
        KT.face([w.p(x0, z0_ + t_, d1), w.p(x1, z1_ + t_, d1), w.p(x1, z1_ + t_, d0), w.p(x0, z0_ + t_, d0)], 'lead', WHITE)
        KT.face([w.p(x1, z1_, d1 - 0.5), w.p(x0, z0_, d1 - 0.5), w.p(x0, z0_, d1), w.p(x1, z1_, d1)], k, col)
def walls_of(o, u, L_, D_):
    """the four outward frames of a block: front along u from o, then round it"""
    global KIT_YAW
    KIT_YAW = math.atan2(u.y, u.x); f_ = W(o, u); n_ = f_.n
    return f_, W(o + u * L_, -n_), W(o + u * L_ - n_ * D_, -u), W(o - n_ * D_, n_)
ROOF_COL = {'slate': (0.42, 0.44, 0.5), 'lead': (0.62, 0.66, 0.66), 'tile': (0.92, 0.86, 0.8)}
def roof_hip(c0, u, n_, L_, D_, z, rise, k, col, over=0.5, tint=None):
    col = tint or ROOF_COL.get(k, col)
    """a hipped roof: c0 the front-left corner, the block going along u and back against n_"""
    a = c0 - u * over + n_ * over + UP * z; b = c0 + u * (L_ + over) + n_ * over + UP * z; c_ = c0 + u * (L_ + over) - n_ * (D_ + over) + UP * z; d_ = c0 - u * over - n_ * (D_ + over) + UP * z
    r_ = max(0.0, (L_ - D_) / 2); mid = c0 + u * L_ / 2 - n_ * D_ / 2 + UP * (z + rise); e, f = mid - u * r_ if L_ >= D_ else mid, mid + u * r_ if L_ >= D_ else mid
    KT.face([a, b, f, e], k, col); KT.face([b, c_, f], k, col); KT.face([c_, d_, e, f], k, col); KT.face([d_, a, e], k, col)
def side_windows(w, a0, a1, zs, h_, k, col, trim, tcol, wd=1.8, bay=5.0, panel=None, hood='flat'):
    """plain walled floors with evenly spaced real windows; panel z ranges follow zs"""
    n_ = max(1, int((a1 - a0) / bay)); b_ = (a1 - a0) / n_
    for f_, (z0, z1) in enumerate(zip(zs, zs[1:])):
        for q in range(n_):
            s0, s1 = a0 + q * b_, a0 + (q + 1) * b_
            window(w, (s0 + s1) / 2, z0 + 0.9, wd, min(h_, z1 - z0 - 1.5), k, col, trim=trim, tcol=tcol, hood=hood if f_ == 1 else None, panel=(s0, s1, z0, z1))

# ------------------------------------------------------------------------------------------------ the types; o: front-left foot, u: along the front (the front faces u x up)
def temple_hall(o, u, L_, D_, k='lime', col=PALE, order='corinthian', h_=15.0, ncol=6, roof='lead'):
    f_, r_, b_, l_ = walls_of(o, u, L_, D_); n_ = f_.n; pod = 2.4; r_c = h_ / {'corinthian': 19.0, 'ionic': 17.5, 'doric': 14.0}[order]; PW = min(L_, ncol * r_c * 2 * 3.3); P0 = (L_ - PW) / 2; P1 = P0 + PW; Ptop = pod + h_; dep = 7.5
    top = Ptop + 3.0
    for q, wall in enumerate((f_, r_, b_, l_)):      # the hall's walls and its base
        LL = L_ if q in (0, 2) else D_
        rusticate(wall, 0, LL, -1.0, pod, k, (col[0] * 0.86, col[1] * 0.86, col[2] * 0.86))
        side_windows(wall, 0, LL, [pod, pod + (top - pod) / 2, top], 4.4, k, col, k, col, wd=2.2, bay=6.4)
        cornice(wall, -0.6, LL + 0.6, top, 1.5, k, col, modillions=True)
    # the portico: steps, its deck, columns, entablature and pediment
    for s_ in range(int(pod / 0.32)):
        d_ = dep + 4.2 - s_ * 0.45; relief(f_, P0 - 1.0, P1 + 1.0, s_ * 0.32 - 0.1, s_ * 0.32 + 0.22, 0, d_, k, col, bottom=False)
    relief(f_, P0 - 0.6, P1 + 0.6, 0, pod + 0.05, 0, dep + 1.0, k, col)
    for q in range(ncol):
        a = P0 + (q + 0.5) * PW / ncol
        kcolumn(f_.p(a, pod, dep), h_, r_c, order, k, col)
        if q in (0, ncol - 1): kcolumn(f_.p(a, pod, dep * 0.45), h_, r_c, order, k, col)
    relief(f_, P0 - 0.8, P1 + 0.8, Ptop, Ptop + 2.1, 0, dep + r_c * 1.3, k, col, top=False)      # architrave and frieze
    cornice(f_, P0 - 0.8, P1 + 0.8, Ptop + 2.1, 1.0, k, col); relief(f_, P0 - 0.8, P1 + 0.8, Ptop + 2.1, Ptop + 3.1, 0, dep + r_c * 1.3, k, col, bottom=False, top=False)
    pediment(f_, P0 - 1.2, P1 + 1.2, Ptop + 3.1, PW * 0.2, 0.0, dep + r_c * 1.3 + 0.6, k, col)
    window(W(f_.p(0, 0, 0.06), u), L_ / 2, pod, 3.4, 6.0, k, col, trim=k, tcol=col, depth=0.8, rise=1.7, surround=True, panel=(L_ / 2 - 2.4, L_ / 2 + 2.4, pod, pod + 9.3), sill=False, glass=True)
    roof_hip(o, u, n_, L_, D_, top + 1.5, 5.0, roof, WHITE)
def colonnade_block(o, u, L_, D_, k='lime', col=PALE, order='ionic', h_=17.0, pitch=5.4, roof='tile'):
    f_, r_, b_, l_ = walls_of(o, u, L_, D_); n_ = f_.n; base = 4.6; top = base + h_ + 3.0; n_b = int(L_ / pitch); pitch = L_ / n_b; r_c = h_ / 17.5
    for q, wall in enumerate((f_, r_, b_, l_)):
        LL = L_ if q in (0, 2) else D_; nb = max(1, int(LL / pitch)); b2 = LL / nb
        rusticate(wall, 0, LL, -1.0, base, k, (col[0] * 0.86, col[1] * 0.86, col[2] * 0.86))
        for s_ in range(nb):
            a0, a1 = s_ * b2, (s_ + 1) * b2; a = (a0 + a1) / 2; zm = base + h_ * 0.54
            window(wall, a, base + 1.4, 2.5, h_ * 0.34, k, col, trim=k, tcol=col, hood='seg' if q == 0 and s_ % 2 else 'tri' if q == 0 else 'flat', panel=(a0, a1, base, zm))
            window(wall, a, zm + 1.2, 2.4, h_ * 0.24, k, col, trim=k, tcol=col, panel=(a0, a1, zm, base + h_))
        if q: relief(wall, 0, LL, base + h_, base + h_ + 3.0, 0, 0.3, k, col, bottom=False)
        cornice(wall, -0.8, LL + 0.8, top, 1.6, k, col, modillions=True)
    # the columns, standing clear of the wall so they throw shadow on it
    for s_ in range(n_b + 1):
        if 0 < s_ < n_b: kcolumn(f_.p(s_ * pitch, base, 2.6), h_, r_c, order, k, col)
    relief(f_, 0, L_, base + h_, base + h_ + 3.0, 0, 3.8, k, col, top=False)
    relief(f_, -0.3, L_ + 0.3, base - 0.3, base, 0, 4.0, k, col, bottom=False)
    cf = W(f_.p(0, 0, 3.8), u); cornice(cf, 0, L_, top, 1.6, k, col, modillions=True); KT.face([f_.p(0, top + 1.6, 3.5), f_.p(L_, top + 1.6, 3.5), f_.p(L_, top + 1.6, 0), f_.p(0, top + 1.6, 0)], k, col)
    balustrade(W(f_.p(0, 0, 3.5), u), 0, L_, top + 1.6, k, col)
    # a pedimented centre pavilion, standing forward
    cw = L_ * 0.26; c0 = L_ / 2 - cw / 2; c1 = c0 + cw
    relief(f_, c0, c1, -1, top + 1.6, 3.8, 6.4, k, col, front=False)
    fp = W(f_.p(0, 0, 6.4), u); e0, e1 = c0 + cw * 0.2, c0 + cw * 0.8
    rect(fp, c0, e0, -1, top + 1.6, 0, k, col); rect(fp, e1, c1, -1, top + 1.6, 0, k, col); rect(fp, e0, e1, -1, base, 0, k, col); rect(fp, e0, e1, base + 13.5, top + 1.6, 0, k, col)
    n_cc = max(4, int(cw / (pitch * 0.72)))
    for s_ in range(n_cc): kcolumn(f_.p(c0 + (s_ + 0.5) * cw / n_cc, base, 9.8), h_, r_c * 1.1, order, k, col)
    relief(f_, c0 - 0.5, c1 + 0.5, base + h_, top, 6.4, 11.3, k, col, top=False); cornice(f_, c0 - 0.6, c1 + 0.6, top, 1.5, k, col)
    relief(f_, c0 - 0.4, c1 + 0.4, 0, base, 6.4, 11.0, k, col); relief(f_, c0 - 1, c1 + 1, 0, base * 0.5, 11.0, 15, k, col, bottom=False)
    relief(f_, c0 - 1.5, c1 + 1.5, 0, base * 0.25, 15, 18, k, col, bottom=False)
    pediment(f_, c0 - 0.9, c1 + 0.9, top + 1.5, cw * 0.17, 3.0, 11.8, k, col)
    for s_ in (0.3, 0.5, 0.7): window(fp, L_ / 2 - cw / 2 + cw * s_, base + 1.2, 3.0, 8.5, k, col, trim=k, tcol=col, rise=1.5, depth=0.7, panel=(c0 + cw * (s_ - 0.1), c0 + cw * (s_ + 0.1), base, base + 13.5), sill=False)
    roof_hip(o, u, n_, L_, D_, top + 1.5, 6.5, roof, WHITE)
def arcade_block(o, u, L_, D_, k='soot', col=SOOTY, wall='brick', wcol=WHITE, order='ionic', bay=7.2, floors=2, fh=5.2, trim='lime', tcol=WARM):
    f_, r_, b_, l_ = walls_of(o, u, L_, D_); n_ = f_.n; ga = 7.6; n_b = max(3, int(L_ / bay)); bay = L_ / n_b; wtop = ga + floors * fh; P = 2      # P bays each end form corner pavilions
    for q, w_ in enumerate((f_, r_, b_, l_)):
        LL = L_ if q in (0, 2) else D_; nb = max(1, int(LL / bay)); b2 = LL / nb
        for s_ in range(nb):
            a0, a1 = s_ * b2, (s_ + 1) * b2; a = (a0 + a1) / 2
            # the arcade: a deep arch through a heavy pier wall
            window(w_, a, 0, b2 - 2.0, ga - (b2 - 2.0) / 2 - 0.9, k, col, trim=trim, tcol=tcol, depth=1.5, rise=(b2 - 2.0) / 2, panel=(a0, a1, 0, ga), sill=False, glass=q == 0)
            relief(w_, a0, a0 + 0.5, 0, ga - 2.2, 0, 0.12, k, col, top=False, bottom=False)
            for f2 in range(floors):
                z0 = ga + f2 * fh; z1 = z0 + fh
                window(w_, a, z0 + 1.1, min(2.2, b2 * 0.34), fh - 2.4, wall, wcol, trim=trim, tcol=tcol, hood=('tri' if s_ % 2 else 'seg') if f2 == 0 else 'flat' if q == 0 else None, panel=(a0, a1, z0, z1))
        relief(w_, 0, LL, ga - 0.5, ga + 0.1, 0, 0.45, trim, tcol)      # the string course
        cornice(w_, -0.5, LL + 0.5, wtop, 1.2, trim, tcol, modillions=True)
    for s_ in range(n_b + 1):      # engaged columns up the upper floors
        kcolumn(f_.p(s_ * bay, ga + 0.1, 0.7), floors * fh - 0.2, 0.46, order, trim, tcol)
    balustrade(f_, 0, L_, wtop + 1.2, trim, tcol)
    # a slate mansard with dormers
    z0m, z1m, ins = wtop + 1.2, wtop + 6.2, 3.2; C = lambda a, d, z: o + u * a - n_ * d + UP * z
    SL = ROOF_COL['slate']; KT.face([C(0, 0, z0m), C(L_, 0, z0m), C(L_ - ins, ins, z1m), C(ins, ins, z1m)], 'slate', SL); KT.face([C(L_, 0, z0m), C(L_, D_, z0m), C(L_ - ins, D_ - ins, z1m), C(L_ - ins, ins, z1m)], 'slate', SL)
    KT.face([C(L_, D_, z0m), C(0, D_, z0m), C(ins, D_ - ins, z1m), C(L_ - ins, D_ - ins, z1m)], 'slate', SL); KT.face([C(0, D_, z0m), C(0, 0, z0m), C(ins, ins, z1m), C(ins, D_ - ins, z1m)], 'slate', SL)
    KT.face([C(ins, ins, z1m), C(L_ - ins, ins, z1m), C(L_ - ins, D_ - ins, z1m), C(ins, D_ - ins, z1m)], 'slate', SL)
    for s_ in range(n_b):
        a = (s_ + 0.5) * bay; wd_ = W(C(0, 1.6, 0), u)
        relief(wd_, a - 1.25, a + 1.25, z0m, z0m + 3.1, -2.0, 0, trim, tcol, top=False, bottom=False)
        window(wd_, a, z0m + 0.4, 1.3, 1.9, trim, tcol, trim=trim, tcol=tcol, surround=False, sill=False, panel=(a - 1.1, a + 1.1, z0m, z0m + 3.1))
        pediment(wd_, a - 1.45, a + 1.45, z0m + 3.1, 0.95, -2.2, 0.2, trim, tcol)
    # corner pavilions: forward, taller, under a little slate dome
    for a0 in (0, L_ - P * bay):
        a1 = a0 + P * bay
        relief(f_, a0, a1, -0.5, wtop + 3.4, 0, 1.3, k, col, bottom=False, front=False)
        fp = W(f_.p(0, 0, 1.3), u); e0, e1 = a0 + P * bay * 0.1, a1 - P * bay * 0.1
        rect(fp, a0, e0, -0.5, wtop + 3.4, 0, k, col); rect(fp, e1, a1, -0.5, wtop + 3.4, 0, k, col); rect(fp, e0, e1, 7.4, ga, 0, k, col); rect(fp, e0, e1, ga + 2 * fh, wtop + 3.4, 0, k, col); rect(fp, e0, e1, -0.5, 0, 0, k, col)
        for s_, ff in ((a0 + P * bay * 0.3, 0.44), (a0 + P * bay * 0.7, 0.44)):
            for z_ in (ga + 0.9, ga + fh + 0.9): window(fp, s_, z_, 2.0, fh - 2.3, k, col, trim=trim, tcol=tcol, hood='tri', panel=(s_ - P * bay * 0.2, s_ + P * bay * 0.2, z_ - 0.9, z_ + fh - 0.9))
        window(fp, (a0 + a1) / 2, 0, P * bay * 0.5, 4.2, k, col, trim=trim, tcol=tcol, depth=1.25, rise=P * bay * 0.25, panel=(e0, e1, 0, 7.4), sill=False, glass=False)
        cornice(fp, a0 - 0.4, a1 + 0.4, wtop + 3.4, 1.3, trim, tcol, modillions=True)
        c_ = f_.p((a0 + a1) / 2, wtop + 4.7, -3.6); lathe_k(c_, [(P * bay * 0.34, 0), (P * bay * 0.34, 1.8)], k, col, n=16)
        lathe_k(c_ + UP * 1.8, [(P * bay * 0.34 * math.cos(t_ * math.pi / 16), 1.8 * 0 + P * bay * 0.4 * math.sin(t_ * math.pi / 16)) for t_ in range(8)] + [(0.3, P * bay * 0.4), (0.12, P * bay * 0.4 + 1.8)], 'slate', ROOF_COL['slate'], n=16)
def loggia_exchange(o, u, L_, D_, k='lime', col=WARM, wall='ochre', wcol=WHITE, order='corinthian', h_=13.0, pair=0.9):
    f_, r_, b_, l_ = walls_of(o, u, L_, D_); n_ = f_.n; base = 3.4; top = base + h_ + 2.8; pv = L_ * 0.22
    for q, w_ in enumerate((f_, r_, b_, l_)):
        LL = L_ if q in (0, 2) else D_
        rusticate(w_, 0, LL, -1, base, k, col)
        if q == 0:      # the loggia's back wall, deep behind the columns
            back = W(o - n_ * 6.0, u)
            nb = int((L_ - 2 * pv) / 5.4); bw = (L_ - 2 * pv) / nb
            for s_ in range(nb):
                a0 = pv + s_ * bw; window(back, a0 + bw / 2, base + 1.0, 3.0, h_ - 5.0, wall, wcol, trim=k, tcol=col, rise=1.5, depth=0.7, panel=(a0, a0 + bw, base, top), sill=False)
            for a_, sg in ((pv, 1), (L_ - pv, -1)):
                aw = W(o + u * a_ - n_ * (0 if sg > 0 else 6.0), (-n_ if sg > 0 else n_)); rect(aw, 0, 6.0, base, top, 0, wall, wcol)
            KT.face([f_.p(pv, base, 0), f_.p(L_ - pv, base, 0), f_.p(L_ - pv, base, -6), f_.p(pv, base, -6)], k, col)      # floor
            KT.face([f_.p(pv, base + h_, -6), f_.p(L_ - pv, base + h_, -6), f_.p(L_ - pv, base + h_, 0), f_.p(pv, base + h_, 0)], k, (col[0] * 0.8, col[1] * 0.8, col[2] * 0.8))      # ceiling
            for a0, a1 in ((0, pv), (L_ - pv, L_)):      # pavilions: solid, with tall framed windows
                for z0, z1, h2, hd in ((base, base + h_ * 0.58, h_ * 0.34, 'tri'), (base + h_ * 0.58, top, h_ * 0.22, 'flat')):
                    nb2 = 2; b2 = (a1 - a0) / nb2
                    for s_ in range(nb2): window(f_, a0 + (s_ + 0.5) * b2, z0 + 1.2, 2.5, h2, wall, wcol, trim=k, tcol=col, hood=hd, panel=(a0 + s_ * b2, a0 + (s_ + 1) * b2, z0, z1))
                relief(f_, a0, a0 + 1.0, base, top, 0, 0.18, k, col, top=False, bottom=False); relief(f_, a1 - 1.0, a1, base, top, 0, 0.18, k, col, top=False, bottom=False)      # pilaster strips
        else: side_windows(w_, 0, LL, [base, base + h_ * 0.55, top], h_ * 0.28, wall, wcol, k, col, wd=2.2, bay=6.4)
        cornice(w_, -0.8, LL + 0.8, top, 1.5, k, col, modillions=True)
    nc = int((L_ - 2 * pv) / 6.4); r_c = h_ / 19.0; pair = r_c * 1.7
    for s_ in range(nc + 1):      # paired columns
        a = pv + s_ * (L_ - 2 * pv) / nc
        for off_ in (-pair, pair):
            if pv <= a + off_ <= L_ - pv: kcolumn(f_.p(a + off_, base, -0.2), h_, r_c, order, k, col)
    relief(f_, pv - 0.3, L_ - pv + 0.3, base + h_, top, -6, 0.8, k, col, top=False)
    balustrade(f_, 0, L_, top + 1.5, k, col)
    roof_hip(o, u, n_, L_, D_, top + 1.5, 4.5, 'slate', WHITE)
def rotunda(c, r_, k='lime', col=PALE, order='corinthian', h_=12.0, dome='lead', dcol=GREEN_LEAD):
    """c: centre of the base"""
    base = 3.0; ncol = max(20, int(2 * math.pi * (r_ + 1.2) / 3.0))
    lathe_k(c, [(r_ + 4.0, -1), (r_ + 4.0, 0.6), (r_ + 3.2, 0.6), (r_ + 3.2, 1.2), (r_ + 2.4, 1.2), (r_ + 2.4, 1.8), (r_ + 1.8, 1.8), (r_ + 1.8, base), (r_, base)], k, col, n=48)
    lathe_k(c, [(r_, base), (r_, base + h_ + 1.0)], k, (col[0] * 0.8, col[1] * 0.8, col[2] * 0.8), n=48, scale=UVS['lime'])
    for q in range(ncol):
        a_ = 2 * math.pi * q / ncol; kcolumn(c + Vector(((r_ + 1.2) * math.cos(a_), (r_ + 1.2) * math.sin(a_), base)), h_, h_ / 18.0, order, k, col, plinth=False)
    zt = base + h_
    lathe_k(c, [(r_ + 2.2, zt), (r_ + 2.2, zt + 1.4), (r_ + 2.9, zt + 1.7), (r_ + 2.9, zt + 2.2), (r_ + 0.8, zt + 2.4), (r_ - 0.2, zt + 2.4), (r_ - 0.2, zt + 6.0), (r_ - 0.2 + 0.7, zt + 6.3), (r_ - 0.2 + 0.7, zt + 6.8), (r_ - 1.4, zt + 6.9)], k, col, n=48)
    zd = zt + 6.9; rd = r_ - 1.4; ribs = 16
    prof = [(rd * math.cos(t_ * math.pi / 22), rd * 0.85 * math.sin(t_ * math.pi / 22)) for t_ in range(11)]
    lathe_k(c + UP * zd, prof, dome, dcol, n=32)
    for q in range(ribs):      # ribs: real ridges up the dome
        a_ = 2 * math.pi * q / ribs; ca, sa = math.cos(a_), math.sin(a_); t0 = Vector((-sa, ca, 0))
        for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
            A, B = c + Vector((r0 * ca, r0 * sa, zd + z0)), c + Vector((r1 * ca, r1 * sa, zd + z1)); o0, o1 = Vector((ca, sa, 0)) * 0.22, t0 * 0.2
            KR.face([A - o1, B - o1, B + o0, A + o0], dome, dcol); KR.face([A + o0, B + o0, B + o1, A + o1], dome, dcol)
    zl = zd + prof[-1][1]
    lathe_k(c + UP * zl, [(prof[-1][0], 0), (2.6, 0.3), (2.6, 3.4), (3.0, 3.6), (3.0, 3.9), (1.4, 4.8), (0.5, 5.6), (0.14, 7.4)], k, col, n=16)
def palazzo(o, u, L_, D_, wall='ochre', wcol=WHITE, k='lime', col=WARM, floors=4, bay=5.6, fh=4.6, roof='tile'):
    f_, r_, b_, l_ = walls_of(o, u, L_, D_); n_ = f_.n; gh = fh + 1.0; top = gh + (floors - 1) * fh
    for q, w_ in enumerate((f_, r_, b_, l_)):
        LL = L_ if q in (0, 2) else D_; nb = max(2, int(LL / bay)); b2 = LL / nb
        for s_ in range(nb):
            a0, a1 = s_ * b2, (s_ + 1) * b2; a = (a0 + a1) / 2
            rusticate(w_, a0, a1, -1.0, 0.6, k, col)
            window(w_, a, 0.9, 2.1, gh - 2.2, k, col, trim=k, tcol=col, rise=1.05 if q == 0 else 0, surround=False, panel=(a0, a1, 0.6, gh), sill=True)
            for f2 in range(floors - 1):
                z0 = gh + f2 * fh; hd = ('tri' if s_ % 2 else 'seg') if f2 == 0 else 'flat' if f2 == 1 else None; ht = fh - 1.9 - (0.7 if f2 == floors - 2 else 0)
                window(w_, a, z0 + 0.95, 1.9, ht, wall, wcol, trim=k, tcol=col, hood=hd, panel=(a0, a1, z0, z0 + fh))
        relief(w_, 0, LL, gh - 0.3, gh + 0.15, 0, 0.3, k, col)
        cornice(w_, -0.7, LL + 0.7, top, 1.5, k, col, modillions=True)
        for a_ in (0.75, LL - 0.75):      # quoins
            z_ = 0.6; c_ = 0
            while z_ < top - 0.7:
                wq = 1.5 if c_ % 2 else 1.05; relief(w_, a_ - wq / 2, a_ + wq / 2, z_, z_ + 0.68, 0, 0.1, k, col); z_ += 0.8; c_ += 1
    roof_hip(o, u, n_, L_, D_, top + 1.5, 3.6, roof, WHITE)
def bell_church(o, u, L_=44.0, k='lime', col=WARM):
    """a square hall under a smooth stone bell, Frauenkirche type: 67 m to the dome's top (research), the lantern's height my estimate"""
    f_, r_, b_, l_ = walls_of(o, u, L_, L_); n_ = f_.n; top = 24.0
    for w_ in (f_, r_, b_, l_):
        rusticate(w_, 0, L_, -1.0, 2.0, k, (col[0] * 0.86, col[1] * 0.86, col[2] * 0.86)); nb = 5; b2 = L_ / nb
        for s_ in range(nb):
            a0, a1 = s_ * b2, (s_ + 1) * b2; a = (a0 + a1) / 2
            window(w_, a, 3.4, 3.4, 6.4, k, col, trim=k, tcol=col, rise=1.7, panel=(a0, a1, 2.0, 13.4), hood=None)
            window(w_, a, 14.4, 2.8, 4.0, k, col, trim=k, tcol=col, rise=1.4, panel=(a0, a1, 13.4, top))
            relief(w_, a0 - 0.35, a0 + 0.35, 2.0, top, 0, 0.32, k, col, top=False, bottom=False)      # pilasters
        relief(w_, -0.3, L_ + 0.3, 13.1, 13.5, 0, 0.3, k, col); cornice(w_, -0.8, L_ + 0.8, top, 1.7, k, col, modillions=True)
    cc = o + u * L_ / 2 - n_ * L_ / 2
    KT.face([cc + u * sx * (L_ / 2) + n_ * sy * (L_ / 2) + UP * (top + 1.6) for sx, sy in ((-1, 1), (1, 1), (1, -1), (-1, -1))], k, col)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lathe_k(cc + u * sx * (L_ / 2 - 4.5) + n_ * sy * (L_ / 2 - 4.5), [(4.2, top + 1.6), (4.2, top + 9.0), (4.7, top + 9.3), (4.7, top + 9.8), (3.4, top + 10.2), (2.6, top + 13.0), (1.2, top + 15.0), (0.14, top + 18.0)], k, col, n=20)
    lathe_k(cc, [(17.0, top + 1.6), (16.2, top + 8.0), (16.8, top + 8.4), (16.8, top + 9.0), (14.4, top + 9.4), (13.3, top + 13.0), (13.7, top + 18.0), (13.3, top + 25.0), (11.8, top + 30.0), (9.6, top + 34.0), (6.8, top + 38.0), (4.6, top + 41.0), (3.2, top + 43.0)], k, col, n=48)
    lathe_k(cc + UP * (top + 43.0), [(3.2, 0), (3.6, 0.5), (3.6, 1.0), (2.9, 1.2), (2.9, 7.0), (3.4, 7.4), (3.4, 7.9), (1.7, 9.5), (0.8, 10.8), (0.14, 14.0)], k, col, n=20)
def quatrefoil(w, a, z, r_, d, k, col):
    n_ = 24; KT.face([w.p(a + r_ * (0.68 + 0.32 * abs(math.cos(2 * q * 2 * math.pi / n_))) * math.cos(q * 2 * math.pi / n_), z + r_ * (0.68 + 0.32 * abs(math.cos(2 * q * 2 * math.pi / n_))) * math.sin(q * 2 * math.pi / n_), d) for q in range(n_)], k, col)
def doge_hq(o, u, L_, D_, wing=34.0, k='lime', col=PALE):
    """Doge's Palace type: an open pointed arcade on stout columns you can see into, a loggia of twice as many slim columns over it with quatrefoils, a tall wall of rose and white lozenges with deep pointed windows, a crenellated roofline. Nothing copied, no inscriptions."""
    f_, r_, b_, l_ = walls_of(o, u, L_, D_); n_ = f_.n; ga, lg = 9.0, 8.4; z1 = ga + lg; top = 32.0; PIT = 7.6
    for w_, LL in ((f_, L_), (r_, D_), (b_, L_), (l_, D_)):
        mid_ = w_.p(LL / 2, 8.0)
        if not facing_road(mid_, w_.n) or road_d(mid_) > 175:
            rect(w_, 0, LL, -6.0, ga + lg, 0, k, (0.8, 0.78, 0.72)); rect(w_, 0, LL, ga + lg, top, 0, 'lozenge', WHITE); cornice(w_, -0.4, LL + 0.4, top, 0.9, k, col); continue
        nb = int(LL / PIT); bw = LL / nb; rusticate(w_, -0.3, LL + 0.3, -6.0, -0.45, 'soot', (0.82, 0.8, 0.76), band=1.1, gap=0.14, depth=0.2)      # a stone base, down to the ground behind the road
        rect(w_, 0, LL, -1.0, ga, -6.0, 'soot', (0.62, 0.6, 0.58))      # the arcade's back wall, deep behind the columns
        KT.face([w_.p(0, ga - 0.02, -6.0), w_.p(LL, ga - 0.02, -6.0), w_.p(LL, ga - 0.02, -0.7), w_.p(0, ga - 0.02, -0.7)][::-1], k, (0.55, 0.53, 0.5))      # its ceiling
        for s_ in range(nb):
            a0, a1 = s_ * bw, (s_ + 1) * bw; a = (a0 + a1) / 2; ow = bw - 1.5; ris = ow * 0.62; ht = ga - 0.9 - ris
            window(w_, a, -0.5, ow, ht + 0.5, k, col, trim=k, tcol=col, depth=0.7, rise=ris, pointed=True, panel=(a0, a1, -0.5, ga), sill=False, glass=False, surround=True)
            if s_ % 4 == 1: window(W(w_.p(0, 0, -5.96), w_.u), a, 0, 2.2, 3.4, 'soot', (0.62, 0.6, 0.58), trim='soot', tcol=(0.62, 0.6, 0.58), depth=0.4, rise=1.1, panel=(a - 1.6, a + 1.6, 0, 5.4), sill=False, surround=False)      # doors at the back
        for s_ in range(nb + 1): kcolumn(w_.p(s_ * bw, 0, -0.1) , ga - 0.9 - (bw - 1.5) * 0.62 + 0.15, 0.62, 'ionic', k, col)
        relief(w_, -0.2, LL + 0.2, ga, ga + 0.55, 0, 0.42, k, col)      # the string course
        # the loggia: twice the columns, ogee heads, quatrefoils in the band over them
        rect(w_, 0, LL, ga, z1, -3.2, k, (0.62, 0.6, 0.56))
        KT.face([w_.p(0, z1 - 1.0, -3.2), w_.p(LL, z1 - 1.0, -3.2), w_.p(LL, z1 - 1.0, -0.35), w_.p(0, z1 - 1.0, -0.35)][::-1], k, (0.6, 0.58, 0.54))
        KT.face([w_.p(0, ga + 0.55, -0.35), w_.p(LL, ga + 0.55, -0.35), w_.p(LL, ga + 0.55, -3.2), w_.p(0, ga + 0.55, -3.2)][::-1], k, (0.7, 0.68, 0.64))
        nb2 = nb * 2; b2 = LL / nb2
        for s_ in range(nb2):
            a0, a1 = s_ * b2, (s_ + 1) * b2; a = (a0 + a1) / 2; ow = b2 - 0.62; ris = ow * 0.95; ht = lg - 1.3 - 0.55 - ris - 0.6
            window(w_, a, ga + 0.55, ow, ht, k, col, trim=k, tcol=col, depth=0.35, rise=ris, pointed=True, panel=(a0, a1, ga + 0.55, z1), sill=False, glass=False)
            if s_ % 2: quatrefoil(w_, a1, z1 - 1.35, 0.72, 0.03, 'frame', WHITE)
        for s_ in range(nb2 + 1): kcolumn(w_.p(s_ * b2, ga + 0.55, -0.08), lg - 1.3 - 0.55 - (b2 - 0.62) * 0.95 - 0.6 + 0.1, 0.24, 'corinthian', k, col, plinth=False)
        balustrade(W(w_.p(0, 0, 0.26), w_.u), 0, LL, ga + 0.55, k, col, h=1.0, pitch=0.8)
        relief(w_, -0.2, LL + 0.2, z1 - 0.4, z1 + 0.1, 0, 0.32, k, col)
        # the tall patterned wall with its deep windows and little balconies
        nb3 = max(2, int(LL / 18.0)); b3 = LL / nb3
        for s_ in range(nb3):
            a0, a1 = s_ * b3, (s_ + 1) * b3; a = (a0 + a1) / 2
            window(w_, a, z1 + 3.0, 3.6, 5.8, 'lozenge', WHITE, trim=k, tcol=col, depth=0.95, rise=2.2, pointed=True, panel=(a0, a1, z1 + 0.1, top), sill=True)
            relief(w_, a - 2.5, a + 2.5, z1 + 2.5, z1 + 2.8, 0, 0.9, k, col); balustrade(W(w_.p(0, 0, 0.82), w_.u), a - 2.5, a + 2.5, z1 + 2.8, k, col, h=1.0, pitch=0.5)
        # the roofline: a cornice, then a row of pointed merlons
        cornice(w_, -0.4, LL + 0.4, top, 0.9, k, col)
        q = 1.2
        while q < LL - 1.2:
            KT.face([w_.p(q - 0.7, top + 0.9, 0.3), w_.p(q + 0.7, top + 0.9, 0.3), w_.p(q + 0.7, top + 2.1, 0.3), w_.p(q, top + 3.2, 0.3), w_.p(q - 0.7, top + 2.1, 0.3)], k, col); KT.face([w_.p(q + 0.7, top + 0.9, 0.1), w_.p(q - 0.7, top + 0.9, 0.1), w_.p(q - 0.7, top + 2.1, 0.1), w_.p(q, top + 3.2, 0.1), w_.p(q + 0.7, top + 2.1, 0.1)], k, col); q += 3.4
        lathe_k(w_.p(0, top + 0.9, 0.3), [(0.52, 0), (0.42, 0.5), (0.36, 3.0), (0.14, 5.2), (0.03, 6.2)], k, col, n=10)      # a pinnacle at the corner
    # the court, roofs
    Lc, Dc = L_ - 2 * wing, D_ - 2 * wing; oc = o + u * wing - n_ * wing
    for fr_, LL in ((W(oc + u * Lc, -u), Lc), (W(oc + u * Lc - n_ * Dc, n_), Dc), (W(oc - n_ * Dc, u), Lc), (W(oc, -n_), Dc)):
        rect(fr_, 0, LL, 0.0, top, 0, k, (0.8, 0.78, 0.72))
    roof_hip(o, u, n_, L_, wing, top + 0.4, 5.0, 'lead', WHITE); roof_hip(o - n_ * (D_ - wing), u, n_, L_, wing, top + 0.4, 5.0, 'lead', WHITE)
    roof_hip(o - n_ * wing, u, n_, wing, Dc, top + 0.4, 5.0, 'lead', WHITE); roof_hip(o + u * (L_ - wing) - n_ * wing, u, n_, wing, Dc, top + 0.4, 5.0, 'lead', WHITE)
def arsenale_gate(c, u, n_, k='lime', col=PALE):
    """an arched way, paired columns and a pediment between two crenellated towers, standing out from a wall at c; n_ its outward direction"""
    u = u.normalized(); dep = 5.0; o = c - u * 12.0 + n_ * dep; global KIT_YAW; KIT_YAW = math.atan2(u.y, u.x); f_ = W(o, u)
    rusticate(f_, 0, 24, -0.5, 2.2, k, (col[0] * 0.86, col[1] * 0.86, col[2] * 0.86))
    window(f_, 12, 2.2, 7.0, 6.2, k, col, trim=k, tcol=col, depth=4.6, rise=3.5, panel=(4, 20, 2.2, 15.5), sill=False, glass=False)
    rect(f_, 0, 4, 2.2, 15.5, 0, k, col); rect(f_, 20, 24, 2.2, 15.5, 0, k, col); rect(W(f_.p(0, 0, -4.6), u), 7, 17, -0.5, 13, 0, 'soot', (0.5, 0.48, 0.46))
    for a_ in (3.2, 5.0, 19.0, 20.8): kcolumn(f_.p(a_, 2.2, 1.4), 12.6, 0.68, 'corinthian', k, col)
    relief(f_, 1.8, 22.2, 14.8, 16.4, 0, 2.6, k, col, top=False); cornice(W(f_.p(0, 0, 2.6), u), 1.6, 22.4, 16.4, 0.9, k, col, modillions=True); relief(f_, 1.8, 22.2, 16.4, 17.3, 0, 2.6, k, col, front=False, bottom=False)
    pediment(f_, 1.2, 22.8, 17.3, 3.8, -0.4, 3.0, k, col)
    relief(f_, 0, 24, -0.5, 15.5, -dep, 0, k, col, front=False, top=False)
    for sg, a0 in ((-1, -11.0), (1, 24.0)):
        t0 = W(o + u * a0 + n_ * 1.0, u); hh = 28.0; dd = dep + 1.0 + 1.0
        rusticate(t0, 0, 11, -0.5, 3.0, k, (col[0] * 0.86, col[1] * 0.86, col[2] * 0.86))
        for z0_, z1_ in ((3.0, 12.0), (12.0, 21.0), (21.0, hh)):
            window(t0, 5.5, z0_ + 1.4, 1.6, min(4.4, z1_ - z0_ - 3.0), k, col, trim=k, tcol=col, rise=0.9, pointed=True, panel=(0, 11, z0_, z1_), depth=0.7)
        relief(t0, 0, 11, -0.5, hh, -dd, 0, k, col, front=False, top=True, bottom=False); cornice(t0, -0.3, 11.3, hh, 0.9, k, col)
        for q in range(4):
            a_ = 0.9 + q * 3.05; relief(t0, a_ - 0.65, a_ + 0.65, hh + 0.9, hh + 2.5, -0.3, 0.3, k, col, bottom=False)
def monument_column(c, h_=26.0, k='lime', col=PALE):
    KT.block(c + UP * -0.2, (11, 11, 1.0), 0, k, col); KT.block(c + UP * 0.8, (9, 9, 1.0), 0, k, col); KT.block(c + UP * 1.8, (5.6, 5.6, 5.0), 0, k, col); KT.block(c + UP * 6.8, (6.4, 6.4, 0.6), 0, k, col)
    kcolumn(c + UP * 7.4, h_, 1.2, 'doric', k, col, plinth=False)
    lathe_k(c + UP * (7.4 + h_ + 0.4), [(1.5, 0), (1.5, 0.6), (0.9, 1.0), (1.1, 2.0), (0.14, 3.8)], k, col)
HOUSES = []
def house(o, u, w_, d_, h_, kind):
    HOUSES.append((o.copy(), u.copy(), w_, d_, h_, kind))
    """a town house, gabled to the street: 'timber' framing over plaster, 'brick' with a stepped gable, 'plaster' in one of the worn colours"""
    f_, r_, b_, l_ = walls_of(o, u, w_, d_); n_ = f_.n; fl = max(2, int(h_ / 3.3)); fh = h_ / fl
    wall, wcol = {'timber': ('worn', (1.05, 1.0, 0.92)), 'brick': (HR.choice(('brick', 'brick', 'dbrick')), WHITE), 'plaster': (HR.choice(('ochre', 'red', 'rose', 'worn')), WHITE)}[kind]
    nb = max(2, int(w_ / 2.9)); bw = w_ / nb; trim = 'lime' if kind != 'timber' else wall
    if wall == 'dbrick': wcol = (1.5, 1.42, 1.36)
    for wl in (f_, b_):
        for f2 in range(fl):
            for q in range(nb):
                a0 = q * bw; z0 = f2 * fh; door = f2 == 0 and q == nb // 2
                window(wl, a0 + bw / 2, z0 + (0.0 if door else 0.95), 1.15 if door else 1.0, 2.5 if door else fh - 1.75, wall, wcol, trim=trim, tcol=WARM, surround=kind == 'plaster' or kind == 'brick', rise=0.45 if kind == 'brick' and not door else 0.0, pointed=True, sill=not door, panel=(a0, a0 + bw, z0, z0 + fh), hood='flat' if kind == 'plaster' and f2 == 1 else None, depth=0.26)
    for wl, LL in ((r_, d_), (l_, d_)): rect(wl, 0, LL, 0, h_, 0, wall, wcol)
    rise = w_ * (0.62 if kind == 'brick' else 0.52); roof = 'slate' if kind == 'brick' else HR.choice(('tile', 'tile', 'slate'))
    C = lambda a, dd, z: o + u * a - n_ * dd + UP * z; ov = 0.45
    KT.face([C(-ov, -ov, h_), C(-ov, d_ + ov, h_), C(w_ / 2, d_ + ov, h_ + rise), C(w_ / 2, -ov, h_ + rise)][::-1], roof, ROOF_COL[roof]); KT.face([C(w_ + ov, d_ + ov, h_), C(w_ + ov, -ov, h_), C(w_ / 2, -ov, h_ + rise), C(w_ / 2, d_ + ov, h_ + rise)][::-1], roof, ROOF_COL[roof])
    for wl, sg in ((f_, 0.0), (b_, 0.0)):
        KT.face([wl.p(0, h_), wl.p(w_, h_), wl.p(w_ / 2, h_ + rise)], wall, wcol)
    if kind == 'timber':      # the frame: posts, rails and braces, standing proud of the plaster
        for wl in [w2 for w2 in (f_, b_) if lod(w2.p(w_ / 2, 4.0), w2.n) >= 1]:
            if road_d(wl.p(w_ / 2, 4.0)) > 60:
                for q in range(nb + 1): rect(wl, q * bw - 0.13, q * bw + 0.13, 0.0, h_, 0.09, 'timber', (0.55, 0.42, 0.34))
                for f2 in range(1, fl): rect(wl, 0, w_, f2 * fh - 0.11, f2 * fh + 0.11, 0.1, 'timber', (0.55, 0.42, 0.34))
                continue
            for q in range(nb + 1):
                relief(wl, q * bw - 0.13, q * bw + 0.13, 0.0, h_, 0, 0.1, 'timber', (0.55, 0.42, 0.34), bottom=False)
            for f2 in range(fl + 1):
                relief(wl, 0, w_, f2 * fh - 0.11, f2 * fh + 0.11, 0, 0.12, 'timber', (0.55, 0.42, 0.34))
            for f2 in range(1, fl):
                for q in (0, nb - 1):      # corner braces
                    a0 = q * bw; sg = 1 if q == 0 else -1; x0, x1 = (a0, a0 + bw * 0.42) if q == 0 else (a0 + bw, a0 + bw * 0.58)
                    KT.face([wl.p(x0 - 0.1 * sg, f2 * fh + 0.1, 0.1), wl.p(x0 + 0.1 * sg, f2 * fh + 0.1, 0.1), wl.p(x1 + 0.1 * sg, f2 * fh + fh - 0.1, 0.1), wl.p(x1 - 0.1 * sg, f2 * fh + fh - 0.1, 0.1)][:: sg], 'timber', (0.55, 0.42, 0.34))
    if kind == 'brick':      # the stepped gable, stone-capped, standing clear of the roof
        steps = 5; st_w = w_ / (2 * steps); st_h = rise * 1.12 / steps
        for wl in (f_, b_):
            close_ = road_d(wl.p(w_ / 2, h_)) < 60
            for q in range(steps):
                z_ = h_ + q * st_h
                if close_:
                    relief(wl, q * st_w, w_ - q * st_w, z_, z_ + st_h, -0.35, 0.05, wall, wcol, bottom=False)
                    relief(wl, q * st_w, q * st_w + st_w, z_ + st_h - 0.12, z_ + st_h, -0.38, 0.1, 'lime', WARM, bottom=False); relief(wl, w_ - q * st_w - st_w, w_ - q * st_w, z_ + st_h - 0.12, z_ + st_h, -0.38, 0.1, 'lime', WARM, bottom=False)
                else: rect(wl, q * st_w, w_ - q * st_w, z_, z_ + st_h, 0.05, wall, wcol)
HR = random.Random(83)

# ------------------------------------------------------------------------------------------------ the palazzi on the upper loop: where the triangles go is decided by what a driver can actually see from the road, wall by wall
def pal_sight(FP, lv3=58.0, lv2=170.0, reach=420.0):
    """for each palazzo's four walls (front, right, back, left, as walls_of): 3 full depth, 2 real but cheap recesses, 1 flat, for a wall only seen far off or over a lower roof, 0 never seen. Rays from the road, in plan, stopped by the other palazzi"""
    R_ = [(p.to_2d(), Vector((math.cos(y), math.sin(y))), w_ / 2, d_ / 2, h_) for p, w_, d_, y, h_ in FP]
    ST_ = [(i, CL[i].to_2d()) for i in range(0, N, 4)]
    def blocked(a, b, skip, min_h):
        ab = b - a; L_ = ab.length
        for j, (c, u, hw_, hd_, h_) in enumerate(R_):
            if j == skip or h_ < min_h or (c - a).length > L_ + hw_ + hd_: continue
            v = Vector((-u.y, u.x)); t0, t1 = 0.0, 1.0; da = a - c
            for o_, e_, lim in ((da.dot(u), ab.dot(u), hw_), (da.dot(v), ab.dot(v), hd_)):
                if abs(e_) < 1e-9:
                    if abs(o_) > lim: t0 = 2.0
                    continue
                t_a, t_b = sorted(((-lim - o_) / e_, (lim - o_) / e_)); t0, t1 = max(t0, t_a), min(t1, t_b)
            if t0 <= t1: return True
        return False
    out = []
    for j, (c, u, hw_, hd_, h_) in enumerate(R_):
        v = Vector((-u.y, u.x)); lv = []
        for cen, n_, ax, half in ((c - v * hd_, -v, u, hw_), (c + u * hw_, u, v, hd_), (c + v * hd_, v, u, hw_), (c - u * hw_, -u, v, hd_)):
            best, over = 1e9, 1e9
            for t_ in (0.0, -0.75, 0.75):
                q = cen + ax * (t_ * half) + n_ * 0.5
                cand = sorted(((p - q).length, i) for i, p in ST_ if (p - q).length < reach and (p - q).dot(n_) > 0.08 * (p - q).length)
                for d_, i in cand:
                    if d_ >= best: break
                    if not blocked(q, CL[i].to_2d(), j, 0.0): best = d_; break
                for d_, i in cand[:: 6]:
                    if d_ >= over: break
                    if not blocked(q, CL[i].to_2d(), j, h_ - 2.5): over = d_; break
            lv.append(3 if best < lv3 else 2 if best < lv2 else 1 if min(best, over) < reach else 0)
        out.append(lv)
    return out
def dim(c, f): return (c[0] * f, c[1] * f, c[2] * f)
def recess(w, a, z0, wd, ht, k, col, trim, tcol, panel, depth=0.55, rise=0.0, pointed=False, **_):
    """the second rank's window: a real hole with shaded reveals and a dark back, a stone sill and a stone head. No glazing bars, no mouldings: about 30 triangles"""
    a0, a1, z1 = a - wd / 2, a + wd / 2, z0 + ht; P0, P1, Pz0, Pz1 = panel
    rect(w, P0, a0, Pz0, Pz1, 0, k, col); rect(w, a1, P1, Pz0, Pz1, 0, k, col); rect(w, a0, a1, Pz0, z0, 0, k, col)
    if rise > 0:
        ap = arch_pts(a0, a1, z1, rise, n=4, pointed=pointed); ao = arch_pts(a0 - 0.2, a1 + 0.2, z1, rise + 0.2, n=4, pointed=pointed)
        for (x0, z_0), (x1, z_1), (y0, u_0), (y1, u_1) in zip(ap, ap[1:], ao, ao[1:]):
            KT.face([w.p(x0, z_0), w.p(x1, z_1), w.p(x1, Pz1), w.p(x0, Pz1)], k, col)
            KT.face([w.p(x1, z_1, 0), w.p(x0, z_0, 0), w.p(x0, z_0, -depth), w.p(x1, z_1, -depth)], k, dim(col, 0.42))
            KT.face([w.p(x0, z_0, 0.09), w.p(x1, z_1, 0.09), w.p(y1, u_1, 0.09), w.p(y0, u_0, 0.09)], trim, tcol)      # the stone arch
        KT.face([w.p(a0, z0, -depth), w.p(a1, z0, -depth)] + [w.p(x, z_, -depth) for x, z_ in ap[::-1]], 'glass')
    else:
        rect(w, a0, a1, z1, Pz1, 0, k, col); KT.face([w.p(a1, z1, 0), w.p(a0, z1, 0), w.p(a0, z1, -depth), w.p(a1, z1, -depth)], k, dim(col, 0.42))
        rect(w, a0, a1, z0, z1, -depth, 'glass', WHITE)
        rect(w, a0 - 0.2, a1 + 0.2, z1, z1 + 0.3, 0.13, trim, tcol); KT.face([w.p(a0 - 0.2, z1 + 0.3, 0.13), w.p(a1 + 0.2, z1 + 0.3, 0.13), w.p(a1 + 0.2, z1 + 0.3, 0), w.p(a0 - 0.2, z1 + 0.3, 0)], trim, tcol)      # the lintel, and the light on its top
    KT.face([w.p(a0, z0, -depth), w.p(a1, z0, -depth), w.p(a1, z0, 0), w.p(a0, z0, 0)], k, dim(col, 0.8))
    KT.face([w.p(a0, z0, -depth), w.p(a0, z0, 0), w.p(a0, z1, 0), w.p(a0, z1, -depth)], k, dim(col, 0.6)); KT.face([w.p(a1, z0, 0), w.p(a1, z0, -depth), w.p(a1, z1, -depth), w.p(a1, z1, 0)], k, dim(col, 0.6))
    rect(w, a0 - 0.26, a1 + 0.26, z0 - 0.18, z0, 0.16, trim, tcol); KT.face([w.p(a0 - 0.26, z0, 0.16), w.p(a1 + 0.26, z0, 0.16), w.p(a1 + 0.26, z0, 0), w.p(a0 - 0.26, z0, 0)], trim, tcol)      # the sill
def eave_band(w, a0, a1, z0, z1, k, col, f=0.68):
    """the wall under the eaves, darkening as it goes up: the eaves' shadow when the sun isn't on this wall"""
    fc = KT.face([w.p(a0, z0), w.p(a1, z0), w.p(a1, z1), w.p(a0, z1)], k, col)
    for l in fc.loops:
        if l.vert.co.z > (z0 + z1) / 2 + w.o.z: l[KT.vc] = (l[KT.vc][0] * f, l[KT.vc][1] * f, l[KT.vc][2] * f, 1)
def balcony(w, a0, a1, z, trim, tcol, lv):
    relief(w, a0, a1, z - 0.24, z, 0, 1.15, trim, tcol)
    balustrade(W(w.p(0, 0, 1.08), w.u), a0, a1, z, trim, tcol, h=1.05, pitch=0.5, solid_past=75 if lv == 3 else 0)
    for a_ in (a0, a1 - 0.1): relief(w, a_, a_ + 0.1, z, z + 1.05, 0, 1.08, trim, tcol, bottom=False)
    if lv == 3:
        for a_ in (a0 + 0.5, (a0 + a1) / 2, a1 - 0.5): relief(w, a_ - 0.17, a_ + 0.17, z - 0.8, z - 0.24, 0, 0.75, trim, tcol)      # stone brackets
SHUTTER = (0.3, 0.42, 0.33)
def pal_wall(w, LL, lv, S, front):
    global LOD_FORCE
    gh, fh, n_up, top, k, col, kg, colg, trim, tcol, sty, bay, sc = (S[q] for q in ('gh', 'fh', 'n_up', 'top', 'k', 'col', 'kg', 'colg', 'trim', 'tcol', 'sty', 'bay', 'sc'))
    if lv == 0: rect(w, 0, LL, -1.2, top + sc, 0, k, col); return
    nb = max(2, int(LL / (bay if front else bay * 1.3)))
    if front and nb % 2 == 0: nb = max(3, nb - 1)
    bw = LL / nb; zn = gh + fh + 0.7; ZS = [(gh, zn, 'nobile')] + [(zn + q * fh, zn + (q + 1) * fh, 'attic' if q == n_up - 2 else 'upper') for q in range(n_up - 1)]; ztop = top - 1.1
    relief(w, 0, LL, -1.2, 0.7, 0, 0.16, trim, tcol, bottom=False)      # the stone foot, as Venice's walls have against the damp
    if lv == 1:      # far off, or seen only over a lower roof: flat shapes and the lines that carry at this range
        rect(w, 0, LL, 0.7, top, 0, k, col)
        for s_ in range(nb):
            a = (s_ + 0.5) * bw
            for z0, z1, kd in ZS:
                ww, wh = bw * 0.3, z1 - z0 - (1.9 if kd != 'attic' else 2.4); rect(w, a - ww / 2, a + ww / 2, z0 + 1.0, z0 + 1.0 + wh, 0.09, 'glass', WHITE)
        rect(w, 0, LL, gh - 0.1, gh + 0.2, 0.12, trim, tcol); cornice(w, -0.7, LL + 0.7, top, sc, trim, tcol); return
    LOD_FORCE = 2; win = window if lv == 3 else recess
    mid_ = (nb - 1) / 2; group = front and nb >= 3 and sty != 'plain'
    for s_ in range(nb):
        a0, a1 = s_ * bw, (s_ + 1) * bw; a = (a0 + a1) / 2; centre = group and abs(s_ - mid_) <= 1.0
        door = front and (s_ - nb // 2) % 2 == 0
        if door:
            wd = min(2.8, bw * 0.62); win(w, a, 0.7, wd, gh - 0.7 - wd / 2 - 0.9, kg, colg, trim=trim, tcol=tcol, depth=0.95, rise=wd / 2, panel=(a0, a1, 0.7, gh), sill=False, glass=True)
        else: win(w, a, 1.7, min(1.25, bw * 0.3), min(1.7, gh - 2.7), kg, colg, trim=trim, tcol=tcol, depth=0.55, panel=(a0, a1, 0.7, gh), hood=None)
        for z0, z1, kd in ZS:
            z2 = min(z1, ztop); wl = z2 - z0
            if kd == 'nobile':
                wd = bw * (0.6 if centre else 0.4); rs = {'gothic': wd * 0.62, 'renaissance': wd * 0.5}.get(sty, 0.0); ht = wl - 1.45 - rs
                win(w, a, z0 + 1.0, wd, ht, k, col, trim=trim, tcol=tcol, depth=0.7, rise=rs, pointed=sty == 'gothic', hood=None if rs else 'tri' if s_ % 2 else 'seg', panel=(a0, a1, z0, z2))
            else:
                wd = min(1.6, bw * 0.36); rs = wd * 0.45 if sty == 'gothic' and kd == 'upper' else 0.0; ht = wl - (2.0 if kd == 'upper' else 1.45) - rs
                win(w, a, z0 + 1.0, wd, ht, k, col, trim=trim, tcol=tcol, depth=0.5, rise=rs, pointed=rs > 0, hood='flat' if kd == 'upper' and not rs else None, panel=(a0, a1, z0, z2))
                if sty == 'plain' or sty == 'brick' and (s_ + int(z0)) % 3 == 0:      # shutters folded back: weathered wood, and only on some
                    for sg in (-1, 1):
                        x0, x1 = sorted((a + sg * wd / 2 + sg * 0.26, a + sg * wd / 2 + sg * (0.26 + wd * 0.46)))
                        if lv == 3: relief(w, x0, x1, z0 + 1.0, z0 + 1.0 + ht, 0, 0.1, 'stake', SHUTTER, top=False, bottom=False)
                        else: rect(w, x0, x1, z0 + 1.0, z0 + 1.0 + ht, 0.09, 'stake', SHUTTER)
    eave_band(w, 0, LL, ztop, top, k, col)
    relief(w, 0, LL, gh - 0.12, gh + 0.18, 0, 0.24, trim, tcol); relief(w, 0, LL, zn - 0.08, zn + 0.1, 0, 0.13, trim, tcol)      # string courses
    if front and nb >= 3 and sty != 'plain': balcony(w, (mid_ - 1.4) * bw + bw / 2, (mid_ + 1.4) * bw + bw / 2, gh + 0.9, trim, tcol, lv)
    if lv == 3 and sty == 'renaissance':      # quoins
        z_ = 0.7
        while z_ < ztop - 0.6:
            for a_ in (0.0, LL - 1.0): relief(w, a_, a_ + 1.0, z_, z_ + 0.72, 0, 0.1, trim, tcol, bottom=False)
            z_ += 1.44
    else:
        for a_ in (0.0, LL - 0.8): relief(w, a_, a_ + 0.8, 0.7, ztop, 0, 0.09, trim, tcol, top=False, bottom=False)      # a stone edge up the corner
    cornice(w, -0.7, LL + 0.7, top, sc, trim, tcol, modillions=lv == 3)
    LOD_FORCE = None
PS = random.Random(47)
def build_palazzi(FP):
    SIGHT = pal_sight(FP); cnt = [0, 0, 0, 0]
    for (p3, w_, d_, yaw, h_), lvs in zip(FP, SIGHT):
        for v_ in lvs: cnt[v_] += 1
        u = Vector((math.cos(yaw), math.sin(yaw), 0)); v = Vector((-math.sin(yaw), math.cos(yaw), 0)); o = Vector((p3.x, p3.y, p3.z + 0.8)) - u * w_ / 2 - v * d_ / 2
        sty = PS.choice(('gothic', 'gothic', 'renaissance', 'renaissance', 'brick', 'plain', 'plain')); t_ = PS.uniform(0.86, 1.06)
        k = {'gothic': PS.choice(('rose', 'ochre', 'red', 'rose')), 'renaissance': PS.choice(('ochre', 'red', 'rose')), 'brick': PS.choice(('brick', 'brick', 'dbrick')), 'plain': PS.choice(('ochre', 'red', 'rose', 'worn'))}[sty]
        col = (1.5, 1.42, 1.36) if k == 'dbrick' else (t_, t_ * 0.84, t_ * 0.68) if k == 'ochre' else (t_, t_ * PS.uniform(0.97, 1.0), t_ * PS.uniform(0.93, 1.0))      # the plaster set's yellow goes olive under the game's lights: warm it to Venetian ochre
        fh = PS.uniform(3.7, 4.2); gh = PS.uniform(4.6, 5.4); n_up = max(2, int((h_ - gh - 0.7) / fh)); fh = (h_ - gh - 0.7) / n_up; ston = sty == 'renaissance'
        S = dict(gh=gh, fh=fh, n_up=n_up, top=h_, k=k, col=col, kg='lime' if ston else k, colg=WARM if ston else col, trim='lime', tcol=PS.choice((WARM, PALE, (0.88, 0.82, 0.72))), sty=sty, bay=PS.uniform(4.2, 5.3), sc=PS.uniform(0.95, 1.3))
        f_, r_, b_, l_ = walls_of(o, u, w_, d_)
        for q, (wall, LL) in enumerate(((f_, w_), (r_, d_), (b_, w_), (l_, d_))): pal_wall(wall, LL, lvs[q], S, q == 0)
        rt = PS.uniform(0.86, 1.06); roof_hip(o, u, f_.n, w_, d_, h_ + S['sc'], min(w_, d_) * 0.2 + 0.6, 'tile', WHITE, tint=(0.92 * rt, 0.86 * rt, 0.8 * rt))
    log('palazzi walls by level (hidden, flat, recessed, full)', cnt)
def campanile(c, gz_):
    """the skyline's anchor, the type of the San Marco tower: a stone foot, a brick shaft with tall recessed strips, an open belfry, an attic, a lead spire. Same heights as the massing: 62 m shaft, 74 m belfry, 99 m tip"""
    global LOD_FORCE
    L_ = 12.0; o = Vector((c.x - L_ / 2, c.y - L_ / 2, gz_)); u = Vector((1, 0, 0)); LOD_FORCE = 2; LI = (0.9, 0.87, 0.8)
    for w in walls_of(o, u, L_, L_):
        relief(w, -0.5, L_ + 0.5, -1, 3.5, 0, 0.5, 'lime', LI); rect(w, 0, L_, 3.5, 60, -0.35, 'brick', WHITE)
        for a0, a1 in ((0, 1.4), (3.5, 4.5), (7.5, 8.5), (L_ - 1.4, L_)): relief(w, a0, a1, 3.5, 60, -0.35, 0, 'brick', WHITE, top=False, bottom=False)
        relief(w, 0, L_, 60, 62, -0.35, 0, 'brick', WHITE, top=False); cornice(w, -0.4, L_ + 0.4, 62, 0.9, 'lime', LI)
        for q, a in enumerate((2.2, 6.0, 9.8)): window(w, a, 63.6, 2.3, 4.6, 'lime', LI, trim='lime', tcol=LI, depth=1.6, rise=1.15, panel=(a - 1.9 if q else 0, a + 1.9 if q < 2 else L_, 63, 72), sill=False, surround=False)
        cornice(w, -0.3, L_ + 0.3, 72, 0.8, 'lime', LI); relief(w, 0.2, L_ - 0.2, 72.8, 74, -0.3, 0, 'lime', LI, top=False, bottom=False)
    p_ = Vector((c.x, c.y, gz_ + 99)); cs = [Vector((c.x + a_ * 5.8, c.y + b_ * 5.8, gz_ + 74)) for a_, b_ in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for q in range(4): KT.face([cs[q], cs[(q + 1) % 4], p_], 'lead', (0.62, 0.8, 0.72))
    LOD_FORCE = None
