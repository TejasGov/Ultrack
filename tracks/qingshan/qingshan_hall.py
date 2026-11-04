"""An imperial Chinese hall, hand-built on real photo sets; exec'd by build_qingshan.py. Our own design from the grammar of the great halls (three-tier stone terrace, central stair with a carved ramp, a recessed door wall behind a row of
red columns, painted beams, bracket sets under double eaves, a concave hip roof with lifted corners), not a copy of any named building. Local frame: +x along the road, +y to the road, z up from the terrace foot.
    imperial_hall(c, facing)   c: Vector at ground level, facing: unit Vector towards the road. Sizes as in the plan: terrace 92 x 44 m, hall 63 x 25 m, ridge 36 m."""
class Kit:
    def __init__(self, W): self.W = W; self.b = {}
    def bm(self, k):
        if k not in self.b: self.b[k] = bmesh.new()
        return self.b[k]
    def box(self, k, c, s):      # c: centre, s: full size
        m = self.W; bm_ = self.bm(k); hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2; v = [bm_.verts.new(m @ Vector((c[0] + x * hx, c[1] + y * hy, c[2] + z * hz))) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)): bm_.faces.new([v[i] for i in q])
    def cyl(self, k, c, r0, r1, h, n=12, smooth=True):
        m = self.W; bm_ = self.bm(k); a = [bm_.verts.new(m @ Vector((c[0] + r0 * math.cos(2 * math.pi * i / n), c[1] + r0 * math.sin(2 * math.pi * i / n), c[2]))) for i in range(n)]; b = [bm_.verts.new(m @ Vector((c[0] + r1 * math.cos(2 * math.pi * i / n), c[1] + r1 * math.sin(2 * math.pi * i / n), c[2] + h))) for i in range(n)]
        for i in range(n): f = bm_.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])); f.smooth = smooth
        bm_.faces.new(b)
    def tube(self, k, pts, r, n=6):
        m = self.W; bm_ = self.bm(k); rings = []
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized(); u = d.cross(Vector((0, 0, 1))); u = (u if u.length > .05 else d.cross(Vector((1, 0, 0)))).normalized(); v = d.cross(u); rr = r(i / (len(pts) - 1)) if callable(r) else r
            rings.append([bm_.verts.new(m @ (p + (u * math.cos(2 * math.pi * j / n) + v * math.sin(2 * math.pi * j / n)) * rr)) for j in range(n)])
        for a, b in zip(rings, rings[1:]):
            for j in range(n): f = bm_.faces.new((a[j], a[(j + 1) % n], b[(j + 1) % n], b[j])); f.smooth = True
    def finish(self, name, keys_planar):
        for k, bm_ in self.b.items(): mesh_obj(f'{PFX} {name} {k}', bm_, [k], planar=k in keys_planar, smooth=False)

def perimeter(hw, hd, step, skip=None):
    """points round a rectangle, evenly, with the outward normal; skip(x, y) leaves a gap"""
    out = []
    for (ax, ay), (bx, by), n in (((-hw, hd), (hw, hd), (0, 1)), ((hw, hd), (hw, -hd), (1, 0)), ((hw, -hd), (-hw, -hd), (0, -1)), ((-hw, -hd), (-hw, hd), (-1, 0))):
        L = math.hypot(bx - ax, by - ay); k = max(1, round(L / step))
        for i in range(k):
            t = (i + .5) / k; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            if not (skip and skip(x, y)): out.append((x, y, n, L / k))
    return out

def hip_roof(K, tile, soffit, hw, hd, z0, H_, ridge, lift=2.1, swoop=1.1, ring=None, nu=30, nt=10, repeat=6.0):
    """concave hip roof with lifted corners, or with `ring` (inner half-width, half-depth) a skirt roof that stops at a wall. Tile columns run down the slope; UV by real length. Returns the corner lines for the hip ridges."""
    W = K.W; bm_ = K.bm(tile); uv = bm_.loops.layers.uv.verify(); out = []; s_bm = K.bm(soffit)
    def P(side, u, t):
        # side 0, 2: long slopes (run along x, u -1..1 along the eave); 1, 3: ends
        f = t ** 1.7; lf = lift * abs(u) ** 5 * (1 - t) ** 1.6; sw = swoop * abs(u) ** 5 * (1 - t)
        if ring: ex, ey = hw + (ring[0] - hw) * t, hd + (ring[1] - hd) * t
        else: ex, ey = hw + (ridge - hw) * t, hd * (1 - t)
        if side % 2 == 0: x, y = u * (hw + (ex - hw) if False else ex), ey + sw * .6; x += sw * .6 * (1 if u > 0 else -1); y = y if side == 0 else -y; x = x if side == 0 else -x
        else:
            hx = ex; hy = ey; x, y = hx + sw * .6, u * hy; y += sw * .6 * (1 if u > 0 else -1); x = -x if side == 3 else x; y = -y if side == 1 else y
        return Vector((x, y, z0 + H_ * f + lf))
    for side in range(4):
        rows = [[P(side, -1 + 2 * i / nu, j / nt) for i in range(nu + 1)] for j in range(nt + 1)]
        vs = [[bm_.verts.new(W @ p) for p in r] for r in rows]; along = [0.0]
        for a, b in zip(rows[0], rows[0][1:]): along.append(along[-1] + (a - b).length)
        down = [[0.0] * (nu + 1)]
        for j in range(1, nt + 1): down.append([down[-1][i] + (rows[j][i] - rows[j - 1][i]).length for i in range(nu + 1)])
        for j in range(nt):
            for i in range(nu):
                f = bm_.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i])); f.smooth = True
                for l, (a_, b_) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))): l[uv].uv = (along[a_] / repeat, down[b_][a_] / repeat)
        # the eave's edge and the underside: dark painted rafters, seen looking up from the road
        lip = [W @ p for p in rows[0]]; lo_ = [W @ (p - Vector((0, 0, .5))) for p in rows[0]]; inn = [W @ (rows[3][i] - Vector((0, 0, 1.2))) for i in range(nu + 1)]
        a = [s_bm.verts.new(p) for p in lip]; b = [s_bm.verts.new(p) for p in lo_]; c = [s_bm.verts.new(p) for p in inn]
        for i in range(nu):
            s_bm.faces.new((a[i + 1], a[i], b[i], b[i + 1])); s_bm.faces.new((b[i + 1], b[i], c[i], c[i + 1]))
        if not ring and side % 2 == 0: pass
        out.append(([P(side, 1, j / nt) for j in range(nt + 1)]))
    # rafter ends along each eave
    for side in range(4):
        n_ = 90 if side % 2 == 0 else 40
        for i in range(n_):
            u = -0.98 + 1.96 * i / (n_ - 1); p = P(side, u, 0.0) - Vector((0, 0, .42)); K.box(soffit, p, (.22, .22, .22))
    return out

def imperial_hall(c, facing, s=1.0, terrace=True, detail=1, tag='hall'):
    """s: overall scale. terrace False: the hall alone, on whatever c stands on. detail 0: no lattice, brackets half as often, for the smaller buildings"""
    y = Vector((facing.x, facing.y, 0)).normalized(); x = Vector((y.y, -y.x, 0)); W = Matrix(((x.x, y.x, 0, c.x), (x.y, y.y, 0, c.y), (0, 0, 1, c.z), (0, 0, 0, 1))) @ Matrix.Scale(s, 4); K = Kit(W)
    # ---- the stone: forecourt, three tiers with lip and foot, balustrades
    if terrace:
        K.box('paving', (0, 4, -.55), (116, 62, 1.2))
        STAIR = 9.0; tiers = [(46, 22, 0, 1.7), (43.5, 19.5, 1.7, 1.7), (41, 17, 3.4, 1.6)]
        for hw, hd, z, h in tiers:
            K.box('stone', (0, 0, z + h / 2 - .1), (2 * hw - .5, 2 * hd - .5, h)); K.box('stone', (0, 0, z + .12), (2 * hw, 2 * hd, .24)); K.box('stone', (0, 0, z + h - .12), (2 * hw + .25, 2 * hd + .25, .24))
            gap = lambda px, py: abs(px) < STAIR + .8 and py > 0
            for px, py, n, L in perimeter(hw - .25, hd - .25, 2.3 if detail else 3.6, gap):
                top = z + h; K.box('stone', (px - n[1] * L / 2, py + n[0] * L / 2, top + .62), (.3, .3, 1.24)); K.cyl('stone', (px - n[1] * L / 2, py + n[0] * L / 2, top + 1.24), .19, .08, .26, n=4, smooth=False)
                s = (L - .3, .13, .62) if n[1] else (.13, L - .3, .62); K.box('stone', (px, py, top + .55), s); s2 = (L - .3, .2, .13) if n[1] else (.2, L - .3, .13); K.box('stone', (px, py, top + 1.03), s2)
        # the stair: 29 steps to the top tier, with the carved ramp up its middle
        rise, run = 5.0 / 29, .46; y0 = 17.0
        for i in range(29):
            z_ = 5.0 - rise * (i + 1); yy = y0 + run * (i + .5); K.box('stone', (0, yy, z_ / 2), (2 * STAIR, run + .02, z_ + rise))
        for sx in (-1, 1):
            K.box('stone', (sx * (STAIR + .35), y0 + 29 * run / 2, 1.5), (.7, 29 * run, 3.0))
            for i in range(0, 29, 5):
                yy = y0 + run * (i + .5); zz = 5.0 - rise * (i + 1); K.box('stone', (sx * (STAIR + .35), yy, zz + .7), (.28, .28, 1.4))
        bm_ = K.bm('stone'); a = [bm_.verts.new(W @ Vector(p)) for p in ((-2.6, y0, 5.05), (2.6, y0, 5.05), (2.6, y0 + 29 * run + .3, .05), (-2.6, y0 + 29 * run + .3, .05))]; bm_.faces.new(a)
    # ---- the hall on the top tier, set back so the terrace has its forecourt
    yc = -2.5; z0 = 5.0; CT = z0 + 11.5; bays = [-31.7 + (5.6 * i if i <= 5 else 5.6 * 5 + 7.4 + 5.6 * (i - 6)) for i in range(12)]; HD = 12.5; IN = 7.5      # 11 bays, the middle one widest
    K.box('stone', (0, yc, z0 + .2), (2 * 33.2, 2 * HD + 3, .4))
    for bx in bays:
        for by in (HD, -HD):
            K.cyl('stone', (bx, yc + by, z0 + .4), .85, .72, .3, n=12, smooth=False); K.cyl('red', (bx, yc + by, z0 + .7), .56, .5, 10.8, n=14)
    for i in range(1, 5):
        by = -HD + 5 * i
        for bx in (bays[0], bays[-1]): K.cyl('stone', (bx, yc + by, z0 + .4), .85, .72, .3, n=12, smooth=False); K.cyl('red', (bx, yc + by, z0 + .7), .56, .5, 10.8, n=14)
    # back and end walls, with a stone dado
    for sgn in (-1,):
        K.box('red', (0, yc - HD, z0 + 6), (2 * 31.7, .9, 11)); K.box('stone', (0, yc - HD, z0 + 1), (2 * 31.7, 1.15, 1.6))
    for sx in (-1, 1): K.box('red', (sx * 31.7, yc - HD + (HD + IN) / 2, z0 + 6), (.9, HD + IN, 11)); K.box('stone', (sx * 31.7, yc - HD + (HD + IN) / 2, z0 + 1), (1.15, HD + IN, 1.6))
    # the recessed door wall: lacquer leaves with real lattice over a dark ground, in the shade of the columns
    K.box('dark', (0, yc + IN - .25, z0 + 6), (2 * 31.7, .3, 11.6)); K.box('stone', (0, yc + IN, z0 + .55), (2 * 31.7, .7, .9)); K.box('wood', (0, yc + (HD + IN) / 2, CT - .25), (2 * 31.7, HD - IN, .25))
    for a_, b_ in zip(bays, bays[1:]):
        K.cyl('red', (a_, yc + IN, z0 + 1), .42, .4, 10.5, n=10)
        leaves = 4; w_ = (b_ - a_ - .9) / leaves
        for j in range(leaves):
            lx = a_ + .45 + w_ * (j + .5); h0 = z0 + 1.0; h1 = CT - 2.6; yy = yc + IN + .02
            for s, o in (((w_, .22, .3), (lx, yy, h0 + .15)), ((w_, .22, .3), (lx, yy, h1 - .15)), ((.26, .22, h1 - h0), (lx - w_ / 2 + .13, yy, (h0 + h1) / 2)), ((.26, .22, h1 - h0), (lx + w_ / 2 - .13, yy, (h0 + h1) / 2)), ((w_, .2, .2), (lx, yy, h0 + 2.3))): K.box('wood', o, s)
            K.box('wood', (lx, yy - .02, h0 + 1.25), (w_ - .4, .1, 2.0))
            cols, rows = (3, 9) if detail else (0, 0); hh = h1 - h0 - 2.5
            for q in range(1, cols + 1): K.box('wood', (lx - w_ / 2 + .26 + (w_ - .52) * q / (cols + 1), yy, h0 + 2.4 + hh / 2), (.075, .1, hh))
            for q in range(1, rows + 1): K.box('wood', (lx, yy, h0 + 2.4 + hh * q / (rows + 1)), (w_ - .5, .1, .075))
        K.box('wood', ((a_ + b_) / 2, yc + IN, CT - 2.1), (b_ - a_, .32, 1.0)); K.box('gold', ((a_ + b_) / 2, yc + IN + .17, CT - 2.1), (b_ - a_ - 1.4, .03, .55)); K.box('dark', ((a_ + b_) / 2, yc + IN + .19, CT - 2.1), (b_ - a_ - 1.7, .03, .4))
    # painted beams: green and blue, a gold-edged panel in each bay
    for hw, hd, cz, H1 in ((31.7, HD, CT + .1, 1.2),):
        for by in (hd, -hd):
            K.box('beam', (0, yc + by, cz), (2 * hw + 1.4, .95, H1)); K.box('beam2', (0, yc + by, cz + .95), (2 * hw + 1.6, 1.05, .6))
        for bx in (hw, -hw):
            K.box('beam', (bx, yc, cz), (.95, 2 * hd + 1.4, H1)); K.box('beam2', (bx, yc, cz + .95), (1.05, 2 * hd + 1.6, .6))
    for a_, b_ in zip(bays, bays[1:]):
        for by, sg in ((HD, 1), (-HD, -1)):
            K.box('gold', ((a_ + b_) / 2, yc + by + sg * .48, CT + .1), ((b_ - a_) * .55, .03, .78)); K.box('beam2', ((a_ + b_) / 2, yc + by + sg * .5, CT + .1), ((b_ - a_) * .55 - .25, .03, .55))
    # bracket sets: the stepped arms that carry the eave out, one every 1.4 m
    def brackets(hw, hd, z, cy, out=1.0):
        for px, py, n, L in perimeter(hw, hd, 1.42 if detail else 2.6):
            py += cy; ox, oy = n[0], n[1]; along = (1.5, .24, .22) if n[1] else (.24, 1.5, .22); along2 = (2.1, .26, .24) if n[1] else (.26, 2.1, .24); block = (.5, .5, .24)
            K.box('beam2', (px, py, z + .12), block); K.box('beam', (px, py, z + .34), along)
            K.box('beam', (px + ox * .45 * out, py + oy * .45 * out, z + .34), (.9 * out + (0 if n[1] else 0), .24, .22) if not n[1] else (.24, .9 * out, .22))
            K.box('gold', (px + ox * .55, py + oy * .55, z + .58), (.34, .34, .13)); K.box('beam2', (px + ox * .55, py + oy * .55, z + .76), along2)
            K.box('beam', (px + ox * 1.0 * out, py + oy * 1.0 * out, z + .78), (1.2 * out, .26, .24) if not n[1] else (.26, 1.2 * out, .24))
            K.box('gold', (px + ox * 1.25, py + oy * 1.25, z + 1.02), (.3, .3, .12)); K.box('beam', (px + ox * 1.25, py + oy * 1.25, z + 1.22), along2)
    brackets(31.7, HD, CT + 1.25, yc)
    from_ = CT + 1.25 + 1.45
    # ---- lower eave: a skirt roof all round, from the eave up to the upper storey
    Kc = K; Wy = Matrix.Translation(y * yc); K.W = W @ Matrix.Translation((0, yc, 0))
    hip_roof(K, 'tile', 'beam2', 36.2, 17.0, from_, 3.4, 0, lift=1.5, swoop=1.0, ring=(27.5, 8.6), repeat=7.0)
    K.W = W
    # ---- upper storey: its columns, panel wall, beams, brackets
    UZ = from_ + 3.0; UT = UZ + 3.0; UW, UD = 26.5, 8.2
    K.box('dark', (0, yc, (UZ + UT) / 2), (2 * UW - .4, 2 * UD - .4, UT - UZ + 2))
    for px, py, n, L in perimeter(UW, UD, 5.5): K.cyl('red', (px - n[1] * L / 2, py + yc + n[0] * L / 2, UZ - .6), .42, .4, UT - UZ + .6, n=10)
    for by in (UD, -UD):
        K.box('wood', (0, yc + by, UZ + .5), (2 * UW, .3, 1.0)); K.box('beam', (0, yc + by, UT + .05), (2 * UW + .9, .75, .9)); K.box('beam2', (0, yc + by, UT + .75), (2 * UW + 1.1, .85, .5))
    for bx in (UW, -UW):
        K.box('wood', (bx, yc, UZ + .5), (.3, 2 * UD, 1.0)); K.box('beam', (bx, yc, UT + .05), (.75, 2 * UD + .9, .9)); K.box('beam2', (bx, yc, UT + .75), (.85, 2 * UD + 1.1, .5))
    for px, py, n, L in perimeter(UW + .02, UD + .02, 1.3):
        s = (.09, .05, 1.8) if n[1] else (.05, .09, 1.8); K.box('wood', (px, py + yc, UZ + 2.0 - .1), s)
    brackets(UW, UD, UT + 1.0, yc)
    # ---- upper roof: the hip, the ridges, the ridge ends
    RZ = UT + 1.0 + 1.4; RH = 36.0 - RZ + 5.0 - 5.0 + 5.0; K.W = W @ Matrix.Translation((0, yc, 0))
    lines = hip_roof(K, 'tile', 'beam2', 30.2, 12.0, RZ, RH, 15.5, lift=2.2, swoop=1.2, repeat=7.0)
    for ln in lines: K.tube('ridge', [p + Vector((0, 0, .18)) for p in ln], .36, n=6)
    top = RZ + RH; K.box('ridge', (0, 0, top + .55), (31.0, .9, 1.2)); K.box('ridge', (0, 0, top + 1.25), (31.4, .55, .3))
    for sx in (-1, 1):
        pts = [Vector((sx * (15.3 + d), 0, top + h)) for d, h in ((0, .4), (.25, 1.2), (.6, 2.1), (.65, 2.9), (.25, 3.6), (-.35, 3.9))]; K.tube('ridge', pts, lambda t: .62 * (1 - .55 * t), n=8)      # the upright ridge-end
        K.box('ridge', (sx * 15.2, 0, top + 2.0), (.9, .22, 1.5))
    for ln in lines:
        for j in (0, 1):
            for q, t_ in enumerate((.06, .11, .16, .21, .26)):      # the little guardians walking down each hip
                idx = t_ * (len(ln) - 1); i_ = int(idx); p = ln[i_].lerp(ln[i_ + 1], idx - i_); K.cyl('ridge', (p.x, p.y, p.z + .42), .17, .09, .42, n=5, smooth=False)
            break
    K.W = W
    K.finish(tag, {'stone', 'paving', 'red', 'wood', 'beam', 'beam2', 'dark', 'gold', 'ridge'})
    return W

def hall_compound(c, facing):
    """The middle yellow box: a smaller main hall with a side hall each hand, joined by covered walls, on one paved court"""
    y = Vector((facing.x, facing.y, 0)).normalized(); x = Vector((y.y, -y.x, 0)); imperial_hall(c, facing, s=.72, detail=0, tag='hall2')
    W = Matrix(((x.x, y.x, 0, c.x), (x.y, y.y, 0, c.y), (0, 0, 1, c.z), (0, 0, 0, 1))); K = Kit(W); K.box('paving', (0, 2, -.55), (122, 52, 1.2))
    for sx in (-1, 1):
        p = c + x * (sx * 49) + y * 6; imperial_hall(Vector((p.x, p.y, c.z)), facing, s=.3, detail=0, tag=f'hall2 side {sx}')
        K.box('red', (sx * 38, 6, 2.6), (14, .9, 5.2)); K.box('stone', (sx * 38, 6, .5), (14, 1.1, 1.0)); K.box('beam', (sx * 38, 6, 5.45), (14.4, 1.3, .35))
        K.box('ridge', (sx * 38, 6, 5.85), (14.6, 2.3, .28)); K.box('ridge', (sx * 38, 6, 6.15), (14.6, .4, .35))
    K.finish('hall2 court', {'stone', 'paving', 'red', 'wood', 'beam', 'ridge'})
def gate_hall(c, facing):
    """The far yellow box: a long red wall on a stone foot, three arched passages through it, a hall and two pavilions on top: the imperial gate's grammar, no copy of a named one"""
    y = Vector((facing.x, facing.y, 0)).normalized(); x = Vector((y.y, -y.x, 0)); W = Matrix(((x.x, y.x, 0, c.x), (x.y, y.y, 0, c.y), (0, 0, 1, c.z), (0, 0, 0, 1))); K = Kit(W); HW_, HD_, HZ = 62.0, 15.0, 12.0
    K.box('paving', (0, 6, -.55), (136, 56, 1.2)); K.box('stone', (0, 0, .7), (2 * HW_ + 1.2, 2 * HD_ + 1.2, 1.4)); K.box('red', (0, 0, HZ / 2 + .6), (2 * HW_, 2 * HD_, HZ - 1.2)); K.box('stone', (0, 0, HZ - .25), (2 * HW_ + 1.0, 2 * HD_ + 1.0, .6))
    for ax, w_, h_ in ((0, 8.5, 7.5), (-24, 6.0, 6.0), (24, 6.0, 6.0)):      # arches: a dark passage, a stone rim
        K.box('dark', (ax, HD_ + .03, 1.6 + (h_ - w_ / 2) / 2), (w_, .1, h_ - w_ / 2)); pts = [Vector((ax + w_ / 2 * math.cos(math.pi * q / 12), HD_ + .05, 1.6 + h_ - w_ / 2 + w_ / 2 * math.sin(math.pi * q / 12))) for q in range(13)]
        bm_ = K.bm('dark'); vv = [bm_.verts.new(W @ p) for p in pts]; bm_.faces.new(vv); K.tube('stone', pts, .32, n=6)
        for sx in (-1, 1): K.tube('stone', [Vector((ax + sx * w_ / 2, HD_ + .05, 1.4)), Vector((ax + sx * w_ / 2, HD_ + .05, 1.6 + h_ - w_ / 2))], .32, n=4)
    for px, py, n, L in perimeter(HW_ - .3, HD_ - .3, 2.3):
        K.box('stone', (px - n[1] * L / 2, py + n[0] * L / 2, HZ + .62), (.3, .3, 1.24)); s_ = (L - .3, .13, .62) if n[1] else (.13, L - .3, .62); K.box('stone', (px, py, HZ + .55), s_); s2 = (L - .3, .2, .13) if n[1] else (.2, L - .3, .13); K.box('stone', (px, py, HZ + 1.03), s2)
    K.finish('hall3 gate', {'stone', 'paving', 'red', 'dark'}); s0 = .62; zb = c.z + HZ - 5.0 * s0
    imperial_hall(Vector((c.x, c.y, zb)), facing, s=s0, terrace=False, detail=0, tag='hall3 main')
    for sx in (-1, 1):
        p = c + x * (sx * 47); imperial_hall(Vector((p.x, p.y, c.z + HZ - 5.0 * .26)), facing, s=.26, terrace=False, detail=0, tag=f'hall3 side {sx}')
