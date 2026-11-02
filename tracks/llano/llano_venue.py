"""Llano's venue, exec'd by build_llano.py after the ground. Flat 2D wherever nobody gets close: ads, signs, crowd, fence, skid marks, the far range; simple models for what the eye walks round.
The infield takes real US tracks' ideas (research 2026-11-02): a dry lake pan (Laguna Seca), a race-weekend RV camp (Talladega, Watkins Glen), a kart track (Road America, Daytona),
a service tunnel (Talladega, Daytona), a three-storey media centre (Las Vegas), a fan stage (COTA), one big steel sculpture (Barber). No lakes or golf: this is barren land."""
def tex_mat(name, png, rough=0.6, clip=False, blend=False):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(png)
    nt.links.new(it.outputs['Color'], P.inputs['Base Color']); P.inputs['Roughness'].default_value = rough
    if clip:
        gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5; nt.links.new(it.outputs['Alpha'], gt.inputs[0]); nt.links.new(gt.outputs[0], P.inputs['Alpha'])     # glTF MASK
    if blend:
        nt.links.new(it.outputs['Alpha'], P.inputs['Alpha'])
        try: m.surface_render_method = 'BLENDED'
        except AttributeError: m.blend_method = 'BLEND'
    return m
def glass(k):
    d = ROOT / 'tracks' / 'infinia' / 'tex'; m = material(f'LL | {k}', rough=0.2); nt = m.node_tree; P = nt.nodes['Principled BSDF']
    it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(d / f'facade_{k}.png'); nt.links.new(it.outputs['Color'], P.inputs['Base Color'])
    ia = nt.nodes.new('ShaderNodeTexImage'); ia.image = image(d / f'facade_{k}_arm.png', True); sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(ia.outputs['Color'], sp.inputs['Color'])
    nt.links.new(sp.outputs['Green'], P.inputs['Roughness']); nt.links.new(sp.outputs['Blue'], P.inputs['Metallic'])
    inn = nt.nodes.new('ShaderNodeTexImage'); inn.image = image(d / f'facade_{k}_n.png', True); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(inn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], P.inputs['Normal'])
    return m
TX = H / 'tex'
MAT.update({
    'ads3': tex_mat('LL | ads 3x1', TX / 'ads_3x1.png'), 'ads6': tex_mat('LL | ads 6x1', TX / 'ads_6x1.png'), 'signs': tex_mat('LL | signs', TX / 'signs.png'), 'flag': tex_mat('LL | flag', TX / 'flag.png', 0.8),
    'fence': tex_mat('LL | fence', TX / 'fence.png', 0.5, clip=True), 'skid': tex_mat('LL | skid', TX / 'skid.png', 0.7, blend=True), 'rubber': tex_mat('LL | rubber', TX / 'rubber.png', 0.75, blend=True), 'rvside': tex_mat('LL | rv side', TX / 'rv_side.png', 0.45), 'crowd': tex_mat('LL | crowd', ROOT / 'tracks' / 'shajawa' / 'tex' / 'crowd_rows.png', 0.9, clip=True),
    'glass_blue': glass('glass_blue'), 'glass_bronze': glass('glass_bronze'),
    'seats': material('LL | seats', rough=0.55, vcol=True), 'stand': material('LL | stand concrete', tex='concrete_wall_009', vcol=True), 'slab': material('LL | slab', tex='dirty_concrete'),
    'white': material('LL | white wall', tex='white_stucco'), 'roofing': material('LL | roofing', tex='grey_roof_01'), 'shutter': material('LL | garage door', tex='painted_metal_shutter'), 'corr': material('LL | corrugated', tex='rusty_corrugated_iron'),
    'steel': material('LL | steel', (0.42, 0.43, 0.45), 0.45, 0.7), 'dark': material('LL | dark', (0.012, 0.012, 0.014), 0.8), 'tent': material('LL | tent', (0.82, 0.81, 0.78), 0.8), 'rv': material('LL | rv', (0.72, 0.7, 0.66), 0.45), 'rv2': material('LL | rv tan', (0.5, 0.42, 0.32), 0.5),
    'rock': material('LL | rock', rough=0.95, vcol=True), 'scrub': material('LL | scrub', rough=0.95, vcol=True),
})
UVS.update({'slab': 4.0, 'white': 4.0, 'roofing': 4.0, 'shutter': 3.0, 'corr': 3.0, 'stand': 3.0, 'seats': 3.0})
class Sheet:
    """one mesh: faces by material key; planar: world UVs, else the quad's own"""
    def __init__(s, name, planar=True, vcol=False): s.name, s.planar, s.bm, s.keys = name, planar, bmesh.new(), []; s.uv = s.bm.loops.layers.uv.verify(); s.vc = vcol_layer(s.bm) if vcol else None
    def mi(s, k):
        if k not in s.keys: s.keys.append(k)
        return s.keys.index(k)
    def quad(s, pts, k, uv=None, col=None):
        f = s.bm.faces.new([s.bm.verts.new(p) for p in pts]); f.material_index = s.mi(k)
        for j, l in enumerate(f.loops):
            if uv: l[s.uv].uv = uv[j]
            if col and s.vc: l[s.vc] = col
        return f
    def box(s, c, size, yaw=0.0, k='slab'): box(s.bm, Vector(c), size, yaw, s.mi(k))
    def cyl(s, c, r0, r1, h, n=8, k='steel', cap=True): cyl(s.bm, Vector(c), r0, r1, h, n=n, mi=s.mi(k), cap=cap)
    def beam(s, a, b, r, k='steel'):
        a, b = Vector(a), Vector(b); d = (b - a).normalized(); e = d.cross(Vector((0, 0, 1))); e = (e if e.length > 1e-3 else Vector((1, 0, 0))).normalized() * r; g = d.cross(e).normalized() * r
        ring = (e + g, e - g, -e - g, -e + g)
        for q in range(4): s.quad([a + ring[q], a + ring[(q + 1) % 4], b + ring[(q + 1) % 4], b + ring[q]], k)
    def done(s):
        if s.bm.faces: return mesh_obj(s.name, s.bm, s.keys, planar=s.planar, smooth=False)
        s.bm.free()
BLD, ART, STD, CRD, DEC = Sheet('LL buildings'), Sheet('LL art', planar=False), Sheet('LL stands', vcol=True), Sheet('LL crowd', planar=False), Sheet('LL decals', planar=False)
Z = Vector((0, 0, 1))
gz = lambda x, y: height(x, y, *near(x, y))
at = lambda s, lat=0.0, z=0.0: off(st(s), lat, z)
def panel(c, w, h, f, k, rect, back=True):
    """a flat picture facing f (unit, toward the viewer), its bottom centre at c, reading left to right from there; rect: u0, u1, v0, v1"""
    f = Vector((f.x, f.y, 0)).normalized(); r = Vector((-f.y, f.x, 0)); u0, u1, v0, v1 = rect; a, b = c - r * w / 2, c + r * w / 2
    ART.quad([a, b, b + Z * h, a + Z * h], k, uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    if back: BLD.quad([b - f * 0.3, a - f * 0.3, a - f * 0.3 + Z * h, b - f * 0.3 + Z * h], 'steel')      # 30 cm: closer and the web pack's rounding can bring it through the picture
ADS3 = ['shell', 'rolex', 'pirelli', 'cocacola', 'redbull', 'emirates', 'sony', 'oppo']      # make_textures.mjs: 2 x 4
ADS6 = ['shell', 'redbull', 'rolex', 'pirelli', 'cocacola', 'hsbc', 'emirates', 'sony']      # 1 x 8
def r3(n): q = ADS3.index(n); return (q % 2) / 2, (q % 2 + 1) / 2, 1 - (q // 2 + 1) / 4, 1 - (q // 2) / 4
def r6(n): q = ADS6.index(n); return 0, 1, 1 - (q + 1) / 8, 1 - q / 8
def rs(q): return (q % 4) / 4, (q % 4 + 1) / 4, 1 - (q // 4 + 1) / 4, 1 - (q // 4) / 4     # signs.png: 300 200 100 PIT, LONG MILE, LAST CHANCE, CORRAL, BIG BEND
R_NAME, R_LOGO = (0, 1, 0.25, 0.5), (0, 1, 0, 0.25)
ROAD_S = lambda i, sd: (-NL[i] * sd)                     # toward the road, from side sd
TRAFFIC = lambda i: -T[i].to_3d()                        # toward the driver coming down the road
def toward(i, sd, turn=0.45): return (-T[i].to_3d() * math.cos(turn) - NL[i] * sd * math.sin(turn)).normalized()
wall = lambda s, sd: BD[sd][st(s)]

# ------------------------------------------------------------------------------------------------ stands: a rake swept along the road, seat blocks in Lone Star colours, a crowd card per row
TREAD, RISE = 0.85, 0.42
BLOCKS = [(0.62, 0.05, 0.04), (0.82, 0.8, 0.76), (0.05, 0.13, 0.36)]
def stand(s0, s1, lat, rows, sd=1, h0=1.4):
    """from s0 to s1 along the lap, on side sd, front edge lat out; blocks of 36 m with a 2 m aisle; returns (back lat, top z)"""
    ss_ = [s0]; blk = []; b_ = 0
    while ss_[-1] < s1:
        for _ in range(9):
            if ss_[-1] >= s1: break
            ss_.append(ss_[-1] + 4.0); blk.append(b_ % 3)
        ss_.append(ss_[-1] + 2.0); blk.append(-1); b_ += 1
    prof = [(lat, -0.3), (lat, h0)]
    for k in range(rows): d, h = lat + k * TREAD, h0 + k * RISE; prof += [(d + TREAD, h), (d + TREAD, h + RISE)]
    prof.append((prof[-1][0], -0.3))
    V = [[STD.bm.verts.new(at(s, sd * d, h)) for d, h in prof] for s in ss_]
    for q in range(len(ss_) - 1):
        for k in range(len(prof) - 1):
            pts = [V[q][k], V[q][k + 1], V[q + 1][k + 1], V[q + 1][k]]; f = STD.bm.faces.new(pts if sd > 0 else pts[::-1])
            tread = abs(prof[k + 1][1] - prof[k][1]) < 1e-6 and blk[q] >= 0; f.material_index = STD.mi('seats' if tread else 'stand')
            for l in f.loops:
                t = 0.9 + 0.1 * fbm(l.vert.co.x / 7, l.vert.co.y / 7, 2); c_ = BLOCKS[blk[q]] if tread else (1, 1, 1)
                l[STD.vc] = (c_[0] * t, c_[1] * t, c_[2] * t, 1)
    for k in range(rows):        # the crowd; gaps in the card are empty seats
        d, h = lat + k * TREAD + 0.3, h0 + k * RISE; var = (k * 3 + int(s0)) % 4
        for q in range(len(ss_) - 1):
            if blk[q] < 0: continue
            a, b = ss_[q], ss_[q + 1]; u0, u1 = a / 14 + k * 0.37, b / 14 + k * 0.37; p, q_ = at(a, sd * d, h), at(b, sd * d, h)
            CRD.quad([p, q_, q_ + Z * 1.15, p + Z * 1.15], 'crowd', uv=[(u0, var / 4), (u1, var / 4), (u1, (var + 1) / 4), (u0, (var + 1) / 4)])
    return lat + rows * TREAD, h0 + rows * RISE
# ---- the main grandstand, on the outside of the start straight
ST0, ST1 = -70.0, 300.0
back, top = stand(ST0, ST1, 21.0, 32)
for q in range(int((ST1 - ST0) // 6)):       # the hospitality floor behind the seats, a glass front
    a, b = ST0 + q * 6, ST0 + (q + 1) * 6; BLD.box(at((a + b) / 2, back + 7, 0) + Z * ((top + 7) / 2), (6, 14, top + 7), HEAD[st(a)], 'white')
    p, q_ = at(b, back - 0.06, top), at(a, back - 0.06, top); ART.quad([p, q_, q_ + Z * 7.2, p + Z * 7.2], 'glass_blue', uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
RF = top + 13.0
for q in range(int((ST1 - ST0) // 37) + 1):  # the cantilever: masts behind, ribs out over the rake
    s_ = ST0 + q * 37; m0, m1 = at(s_, back + 13, 0), at(s_, back + 13, RF + 1.5); BLD.beam(m0, m1, 0.5); BLD.beam(m1, at(s_, 30.0, RF - 0.8), 0.32); BLD.beam(m1, at(s_, back + 14, RF), 0.25); BLD.beam(at(s_, back + 8, top + 7), at(s_, 38.0, RF - 0.5), 0.2)
BLD.quad([at(ST0, 30.0, RF - 0.8), at(ST1, 30.0, RF - 0.8), at(ST1, back + 14, RF), at(ST0, back + 14, RF)], 'roofing')
s_ = ST0; n_ = 0
while s_ < ST1 - 9:       # the roof's front edge: a run of sponsors, facing the road
    i = st(s_ + 6); panel(at(s_ + 6, 30.0, RF - 2.8), 12, 2.0, ROAD_S(i, 1), 'ads6', r6(ADS6[n_ % 8])); s_ += 12; n_ += 1
def flagpole(p, h=9.0, w=3.6):
    BLD.cyl(p, 0.07, 0.05, h, n=6); q0 = None
    for q in range(9):         # still, with a fold in the cloth: no flapping to pay for
        t = q / 8; c = p + Vector((math.cos(0.7), math.sin(0.7), 0)) * (w * t) + Vector((-math.sin(0.7), math.cos(0.7), 0)) * (0.18 * math.sin(t * 7)) + Z * (h - 2.4)
        if q0: ART.quad([q0, c, c + Z * 2.4, q0 + Z * 2.4], 'flag', uv=[((q - 1) / 8, 0), (q / 8, 0), (q / 8, 1), ((q - 1) / 8, 1)])
        q0 = c
for q in range(10): flagpole(at(ST0 + 20 + q * 36, back + 14, RF))
# ---- the remote stands, on the outside of the big stops and of Horseshoe
CORN = {c['n']: c['at'] for c in SRC['corners']}
for n_, half, rows in ((1, 95, 18), (5, 75, 16), (10, 120, 22)):
    a = CORN[n_] - half; L_ = max(wall(a + half * k / 4, 1) for k in range(9)) + 6
    b_, t_ = stand(a, CORN[n_] + half, L_, rows)
    s_ = a
    while s_ < CORN[n_] + half:      # the backs: a banner run
        i = st(s_ + 6); panel(at(s_ + 6, b_ + 0.6, t_ - 1.0), 12, 2.0, ROAD_S(i, 1), 'ads6', r6(ADS6[int(s_ / 12) % 8])); s_ += 12
    for q in range(4): flagpole(at(a + half * 2 * (q + 0.5) / 4, b_ + 0.5, t_))

# ------------------------------------------------------------------------------------------------ pits, on the infield side of the start straight
PIT0, PIT1 = -60.0, 270.0; PL0, PL1 = 16.0, 28.0; PD = 16.0
BLD.quad([at(PIT0 - 60, -PL0, 0.03), at(PIT0 - 60, -PL1, 0.03), at(PIT1 + 60, -PL1, 0.03), at(PIT1 + 60, -PL0, 0.03)], 'slab')       # the pit lane behind the wall
YW = HEAD[st(100)]; BAYS = int((PIT1 - PIT0) // 11)
for q in range(BAYS):
    a = PIT0 + q * 11; p0, p1 = at(a + 1.5, -PL1, 0), at(a + 11, -PL1, 0); ART.quad([p0, p1, p1 + Z * 5, p0 + Z * 5], 'shutter', uv=[(0, 0), (3, 0), (3, 1.7), (0, 1.7)])
    BLD.box(at(a + 0.75, -PL1 - 0.4, 0) + Z * 2.75, (1.5, 1.0, 5.5), YW, 'white')
    p0, p1 = at(a, -PL1 - 0.2, 5.5), at(a + 11, -PL1 - 0.2, 5.5); ART.quad([p0, p1, p1 + Z * 7.2, p0 + Z * 7.2], 'glass_bronze', uv=[(0, 0), (11 / 6, 0), (11 / 6, 1), (0, 1)])
    if q % 3 == 1: panel(at(a + 5.5, -PL1 + 0.15, 5.0), 9, 1.5, ROAD_S(st(a), -1), 'ads6', r6(ADS6[q % 8]), back=False)
BLD.box(at((PIT0 + PIT1) / 2, -PL1 - PD / 2 - 0.3, 0) + Z * 6.4, (PIT1 - PIT0, PD, 12.8), YW, 'white')
BLD.box(at((PIT0 + PIT1) / 2, -PL1 - PD / 2 + 0.6, 12.8) + Z * 0.5, (PIT1 - PIT0 + 2, PD + 3, 1.0), YW, 'roofing')
for x_ in (-34, 34): BLD.beam(at(100 + x_, -PL1 - 3, 13.8), at(100 + x_, -PL1 - 3, 21.5), 0.2)
panel(at(100, -PL1 - 2.7, 14.4), 72, 9, ROAD_S(st(100), -1), 'signs', R_NAME)
BLD.box(at(100, -PL1 - PD - 70, 0) + Z * 0.1, (420, 140, 0.25), YW, 'slab')      # the paddock: airfield-style concrete (Sebring), behind the pit block

# ---- the HQ tower: glass on a stepped core, a deck, a mast
HQ = at(120, -PL1 - PD - 62); hx, hy = HQ.x, HQ.y; hz = CL[st(120)].z
def walls(cx, cy, w, d, z0, z1, k, tw=6.0, th=7.2):
    c = [Vector((cx - w / 2, cy - d / 2, 0)), Vector((cx + w / 2, cy - d / 2, 0)), Vector((cx + w / 2, cy + d / 2, 0)), Vector((cx - w / 2, cy + d / 2, 0))]
    for q in range(4):
        a, b = c[q], c[(q + 1) % 4]; L_ = (b - a).length; ART.quad([a + Z * z0, b + Z * z0, b + Z * z1, a + Z * z1], k, uv=[(0, z0 / th), (L_ / tw, z0 / th), (L_ / tw, z1 / th), (0, z1 / th)])
BLD.box((hx, hy, hz + 5), (64, 40, 10), YW, 'white'); walls(hx, hy, 64.1, 40.1, hz + 0.5, hz + 9.4, 'glass_bronze')
BLD.box((hx, hy, hz + 34), (21.6, 21.6, 68), YW, 'dark'); walls(hx, hy, 22, 22, hz + 10, hz + 62, 'glass_blue')
for dz, sz, th_ in ((62, 33, 1.0), (63, 30, 5.5), (68.5, 34, 1.2)): BLD.box((hx, hy, hz + dz + th_ / 2), (sz, sz, th_), YW, 'white' if sz != 30 else 'dark')
walls(hx, hy, 30.1, 30.1, hz + 63.2, hz + 68.3, 'glass_blue', 6.0, 5.1)
BLD.cyl((hx, hy, hz + 69.7), 0.5, 0.08, 20)
for f_, c_ in (((0, 1), R_NAME), ((1, 0), R_NAME), ((-1, 0), R_NAME), ((0, -1), R_LOGO)):
    f_ = Vector((f_[0], f_[1], 0)); panel(Vector((hx, hy, hz + 54)) + f_ * 11.15, 21, 21 / 8, f_, 'signs', c_, back=False)
# ---- the media centre (three storeys, Las Vegas' idea), tents, a water tower
MX = at(230, -PL1 - PD - 60); mz = CL[st(230)].z
BLD.box((MX.x, MX.y, mz + 7), (84, 30, 14), YW, 'white'); walls(MX.x, MX.y, 84.1, 30.1, mz + 0.4, mz + 13.6, 'glass_blue', 6.0, 4.5); BLD.box((MX.x, MX.y, mz + 14.4), (88, 34, 0.8), YW, 'roofing')
for q in range(8):
    c = at(-30 + q * 26, -PL1 - PD - 104); w_, d_ = 20.0, 12.0; x0, y0 = c.x, c.y; zz = CL[st(0)].z + 0.2
    a, b, e, g = (Vector((x0 - w_ / 2, y0 - d_ / 2, zz)), Vector((x0 + w_ / 2, y0 - d_ / 2, zz)), Vector((x0 + w_ / 2, y0 + d_ / 2, zz)), Vector((x0 - w_ / 2, y0 + d_ / 2, zz)))
    r0, r1 = Vector((x0 - w_ / 2, y0, zz + 5.2)), Vector((x0 + w_ / 2, y0, zz + 5.2)); up = Z * 2.8
    for p_, q_ in ((a, b), (b, e), (e, g), (g, a)): BLD.quad([p_, q_, q_ + up, p_ + up], 'tent')
    BLD.quad([a + up, b + up, r1, r0], 'tent'); BLD.quad([e + up, g + up, r0, r1], 'tent'); BLD.quad([b + up, e + up, r1], 'tent'); BLD.quad([g + up, a + up, r0], 'tent')
wt = Vector((-80, -210, gz(-80, -210)))
for dx, dy in ((-5, -5), (5, -5), (5, 5), (-5, 5)): BLD.beam(wt + Vector((dx * 1.5, dy * 1.5, 0)), wt + Vector((dx, dy, 26)), 0.25)
BLD.cyl(wt + Z * 26, 8.5, 8.5, 8, n=16, k='white', cap=False); BLD.cyl(wt + Z * 34, 8.5, 0.6, 3, n=16, k='roofing')

# ------------------------------------------------------------------------------------------------ the start: gantry, a footbridge, fences, the wall's hoardings
def truss(s, z0=7.0, z1=9.0, pad=0.9):
    i = st(s); latl, latr = BD[1][i] + pad, -(BD[-1][i] + pad); tt = T[i].to_3d() * 0.6; pl, pr = off(i, latl), off(i, latr)
    for p_ in (pl, pr):
        for sg in (-1, 1): BLD.beam(p_ + tt * sg, p_ + tt * sg + Z * (z1 + 1), 0.16)
    for sg in (-1, 1):
        for zz in (z0, z1): BLD.beam(pl + tt * sg + Z * zz, pr + tt * sg + Z * zz, 0.1)
    n = max(6, int((latl - latr) / 3))
    for q in range(n):
        a, b = pl.lerp(pr, q / n), pl.lerp(pr, (q + 1) / n)
        for sg in (-1, 1): BLD.beam(a + tt * sg + Z * (z0 if q % 2 else z1), b + tt * sg + Z * (z1 if q % 2 else z0), 0.05)
    return i
i = truss(0.0, 7.0, 10.0); panel(off(i, 0, 7.2) - T[i].to_3d() * 0.65, 22, 2.75, TRAFFIC(i), 'signs', R_LOGO)
# a footbridge over the straight (Barber's idea), stair towers behind the walls
FB = 455.0; i = st(FB); pl, pr = off(i, BD[1][i] + 2.5), off(i, -(BD[-1][i] + 2.5)); tt = T[i].to_3d()
for p_ in (pl, pr): BLD.box(p_ + Z * 4.6, (4.5, 4.5, 9.2), HEAD[i], 'white')
c_ = (pl + pr) / 2; L_ = (pl - pr).length; BLD.box(c_ + Z * 7.6, (3.2, L_, 0.5), HEAD[i], 'white'); BLD.box(c_ + Z * 10.2, (3.6, L_, 0.25), HEAD[i], 'roofing')
for q in range(int(L_ // 5) + 1):
    a = pr.lerp(pl, q / (L_ // 5))
    for sg in (-1, 1): BLD.beam(a + tt * sg * 1.5 + Z * 7.8, a + tt * sg * 1.5 + Z * 10.1, 0.05)
for off_, n_ in ((-10.5, 'rolex'), (0, 'pirelli'), (10.5, 'shell')): panel(c_ + NL[i] * -off_ - tt * 1.62 + Z * 7.85, 10, 1.66, TRAFFIC(i), 'ads6', r6(n_), back=False)
def fence(s0, s1, sd):
    s_ = s0; pad = 0.42; h0, h1 = 0.8, 5.2
    while s_ < s1:
        a, b = at(s_, sd * (wall(s_, sd) + pad), h0), at(s_ + 5, sd * (wall(s_ + 5, sd) + pad), h0); L_ = (b - a).length
        ART.quad([a, b, b + Z * (h1 - h0), a + Z * (h1 - h0)], 'fence', uv=[(0, 0), (L_, 0), (L_, h1 - h0), (0, h1 - h0)])
        BLD.beam(a - Z * (h0 + 0.1), a + Z * (h1 - h0 + 0.15), 0.05); BLD.beam(a + Z * (h1 - h0), b + Z * (h1 - h0), 0.03); s_ += 5
def hoardings(s0, s1, sd, seq=0, L_=9.0, h=1.5, pad=0.75):
    s_ = s0
    while s_ < s1:
        i = st(s_ + L_ / 2); panel(off(i, sd * (BD[sd][i] + pad), 0.78), L_, h, ROAD_S(i, sd), 'ads6', r6(ADS6[seq % 8])); s_ += L_; seq += 1
fence(-190, 520, 1); fence(-190, 520, -1); hoardings(-180, 510, 1, 0); hoardings(-180, -70, -1, 3); hoardings(290, 510, -1, 5)
for n_, half in ((1, 150), (5, 130), (10, 170)):
    fence(CORN[n_] - half, CORN[n_] + half, 1); hoardings(CORN[n_] - half, CORN[n_] + half, 1, n_)
hoardings(CORN[8] - 90, CORN[8] + 60, -1, 2); hoardings(CORN[9] - 60, CORN[9] + 90, 1, 6)

# ------------------------------------------------------------------------------------------------ billboards: lone giants on the empty straights, frames round the big stops
def unipole(s, sd, name, w=21.0, h=7.0, z=14.0, pad=9.0):
    i = st(s); p = off(i, sd * (BD[sd][i] + pad)); p = Vector((p.x, p.y, gz(p.x, p.y) - 0.2)); f = toward(i, sd); r = Vector((-f.y, f.x, 0))
    panel(p + Z * z, w, h, f, 'ads3', r3(name)); mast = p - f * 0.9; BLD.cyl(mast, 0.75, 0.5, z + h * 0.55)
    for t in (0.0, 0.5, 1.0): BLD.beam(p + Z * (z + h * t) - f * 0.2 - r * (w / 2 + 0.1), p + Z * (z + h * t) - f * 0.2 + r * (w / 2 + 0.1), 0.1)
    for x_ in (-w / 2, -w / 4, w / 4, w / 2): BLD.beam(mast + Z * (z - 2.5), p + r * x_ + Z * (z + 0.1) - f * 0.2, 0.09)
    BLD.box(p + Z * (z - 0.3) + f * 0.4, (w + 0.4, 0.9, 0.1), math.atan2(r.y, r.x), 'steel')
ML0, ML1 = EXIT[3], ENTRY[5]
for q, (sd, n_) in enumerate(((1, 'shell'), (-1, 'cocacola'), (1, 'rolex'), (-1, 'redbull'), (-1, 'pirelli'), (-1, 'emirates'))): unipole(ML0 + 170 + q * (ML1 - ML0 - 420) / 5, sd, n_)
for s_, sd, n_ in ((EXIT[7] + 180, -1, 'sony'), (EXIT[7] + 460, 1, 'pirelli'), (ENTRY[8] - 180, -1, 'oppo'), (EXIT[8] + 180, 1, 'rolex'), (EXIT[5] + 170, -1, 'emirates'), (EXIT[9] + 180, -1, 'cocacola')): unipole(s_, sd, n_, 15.0, 5.0, 9.0)
def frame_board(s, sd, name, w=12.0, h=4.0, z=1.8, pad=2.2):
    i = st(s); p = off(i, sd * (BD[sd][i] + pad)); f = toward(i, sd, 0.75); r = Vector((-f.y, f.x, 0)); panel(p + Z * z, w, h, f, 'ads3', r3(name))
    for x_ in (-w * 0.35, w * 0.35): BLD.beam(p + r * x_ - f * 0.15 - Z * 0.3, p + r * x_ - f * 0.15 + Z * (z + h), 0.1)
for n_ in (1, 5, 8):       # a wall of boards where the driver looks hardest, beyond the corner
    sd = 1 if n_ != 8 else -1; a = CORN[n_]
    for q in range(5): frame_board(a - 90 + q * 28, sd, ADS3[(n_ + q) % 8])

# ------------------------------------------------------------------------------------------------ the driver's cues: boards, corner names, poles and wires down the Long Mile, a speed-trap gantry, marshals, rubber
for n_ in (1, 5, 8):
    for cell, dist in ((0, 300), (1, 200), (2, 100)):
        i = st(ENTRY[n_] - dist)
        for sd in (1, -1):
            p = off(i, sd * (HW + 9)); BLD.beam(p - Z * 0.2, p + Z * 1.5, 0.06); panel(p + Z * 1.5, 2.8, 1.4, TRAFFIC(i), 'signs', rs(cell))
def road_sign(s, sd, cell):
    i = st(s); p = off(i, sd * (BD[sd][i] + 1.5))
    for x_ in (-2.2, 2.2): BLD.beam(p + T[i].to_3d() * 0.0 + NL[i] * x_ - Z * 0.2, p + NL[i] * x_ + Z * 3.2, 0.07)
    panel(p + Z * 2.6, 7, 3.5, toward(i, sd, 0.2), 'signs', rs(cell))
road_sign(ML0 + 50, 1, 4); road_sign(ENTRY[5] - 460, -1, 5); road_sign(ENTRY[1] - 420, 1, 6); road_sign(ENTRY[7] - 120, 1, 7); road_sign(-140, -1, 3)
s_ = ML0 + 40; prev = None
while s_ < ML1 - 60:
    if ML0 + 1340 < s_ < ML0 + 1680: s_ += 50; prev = None; continue      # the pole line stops at Llano Central's garden (llano_station.py)
    i = st(s_); p = off(i, BD[1][i] + 5); base = Vector((p.x, p.y, gz(p.x, p.y) - 0.2)); BLD.cyl(base, 0.16, 0.12, 9.5, n=6, k='corr', cap=False); ty = NL[i]
    BLD.box(base + Z * 8.9, (0.16, 2.6, 0.14), HEAD[i], 'corr')
    if prev:
        for sg in (-1, 1): BLD.beam(prev[0] + prev[1] * 1.1 * sg + Z * 9.0, base + ty * 1.1 * sg + Z * 9.0, 0.022, 'dark')
    prev = (base, ty); s_ += 50
i = truss(ML1 - 300, 7.0, 10.0); panel(off(i, 0, 7.2) - T[i].to_3d() * 0.65, 18, 2.75, TRAFFIC(i), 'signs', R_LOGO)
s_ = 700.0
while s_ < LAP - 300:
    i = st(s_); p = off(i, -(BD[-1][i] + 3)); p = Vector((p.x, p.y, gz(p.x, p.y)))
    BLD.box(p + Z * 1.3, (3.2, 2.4, 2.6), HEAD[i], 'white'); BLD.box(p + Z * 2.7, (3.8, 3.0, 0.15), HEAD[i], 'corr'); s_ += 820
for n_, lat in ((1, 2.6), (5, 2.6), (8, -2.6)):
    rows = list(range(int((ENTRY[n_] - 190) / STEP), int((ENTRY[n_] + 8) / STEP), 4))
    for q in range(len(rows) - 1):
        a, b = rows[q] % N, rows[q + 1] % N; t0, t1 = q / (len(rows) - 1), (q + 1) / (len(rows) - 1)
        DEC.quad([off(a, lat - 2.4, 0.06), off(b, lat - 2.4, 0.06), off(b, lat + 2.4, 0.06), off(a, lat + 2.4, 0.06)], 'skid', uv=[(0, t0), (0, t1), (1, t1), (1, t0)])

# the rubbered line round the whole lap: a soft dark band, to the inside of each corner (a flat strip over the road)
KS = [sum(K[(q + d) % N] for d in range(-22, 23)) / 45 for q in range(N)]; lat_ = [max(-4.2, min(4.2, KS[q] * 520)) for q in range(N)]
for _ in range(3): lat_ = [sum(lat_[(q + d) % N] for d in range(-14, 15)) / 29 for q in range(N)]
for q in range(0, N, 3):
    a, b = q, (q + 3) % N; DEC.quad([off(a, lat_[a] - 2.0, 0.05), off(b, lat_[b] - 2.0, 0.05), off(b, lat_[b] + 2.0, 0.05), off(a, lat_[a] + 2.0, 0.05)], 'rubber', uv=[(0, 0), (0, 1), (1, 1), (1, 0)])

# ------------------------------------------------------------------------------------------------ the infield
def ribbon(pts, w, k, dz=0.1, closed=False):
    n = len(pts); rows = []
    for q in range(n):
        a, b = pts[(q - 1) % n if closed else max(0, q - 1)], pts[(q + 1) % n if closed else min(n - 1, q + 1)]; d = Vector((b[0] - a[0], b[1] - a[1], 0)).normalized(); e = Vector((-d.y, d.x, 0)) * w / 2; c = Vector((pts[q][0], pts[q][1], 0))
        rows.append([Vector((*(c + e).xy, gz(*(c + e).xy) + dz)), Vector((*(c - e).xy, gz(*(c - e).xy) + dz))])
    for q in range(n if closed else n - 1): BLD.quad([rows[q][1], rows[(q + 1) % n][1], rows[(q + 1) % n][0], rows[q][0]], k)
def path(*pts, step=10.0):
    out = []
    for a, b in zip(pts, pts[1:]):
        L_ = math.hypot(b[0] - a[0], b[1] - a[1]); m = max(1, int(L_ / step)); out += [(a[0] + (b[0] - a[0]) * q / m, a[1] + (b[1] - a[1]) * q / m) for q in range(m)]
    return out + [pts[-1]]
# ---- a service tunnel under the west leg: portals either side, the road out of it to the paddock and on to the camp
TS = (ENTRY[9] + EXIT[8]) / 2; i = st(TS); pi_, po_ = off(i, -(BD[-1][i] + 7)), off(i, BD[1][i] + 7)
for p_, f_ in ((pi_, -NL[i]), (po_, NL[i])):
    yaw = HEAD[i]; g_ = gz(p_.x, p_.y); c_ = Vector((p_.x, p_.y, g_))
    BLD.box(c_ + Z * 3.4, (14, 2.0, 6.8), yaw, 'slab'); panel(c_ + f_ * 1.02, 9.5, 5.0, f_, 'dark', (0, 1, 0, 1), back=False)
    for sg in (-1, 1): BLD.beam(c_ + T[i].to_3d() * 7 * sg + f_ * 1.0, c_ + T[i].to_3d() * 11 * sg + f_ * 9 - Z * 0.5, 0.5, 'slab')
ROAD_IN = path((pi_.x, pi_.y), (pi_.x + 40, pi_.y + 90), (130, -360), (130, -175)); ribbon(ROAD_IN, 9, 'slab', 0.12)
ribbon(path((130, -360), (360, -760), (360, -985)), 9, 'slab', 0.12)
ribbon(path((130, -175), (430, -175), (430, -235)), 9, 'slab', 0.12)
# ---- the RV camp: race-weekend rows on bare dirt, with lanes
rr = random.Random(23); nrv = 0
for row in range(13):
    y0 = -1005 - row * 24
    if row % 2 == 0: ribbon(path((222, y0 + 3), (540, y0 + 3)), 6.5, 'slab', 0.07)
    for col in range(26):
        if rr.random() < 0.16: continue
        x0 = 228 + col * 12.2 + rr.uniform(-0.5, 0.5); y1 = y0 - 10 + rr.uniform(-1, 1); g_ = gz(x0, y1); yaw = math.pi / 2 + rr.uniform(-0.04, 0.04); k_ = 'rv' if rr.random() < 0.72 else 'rv2'; L_ = rr.uniform(8, 11)
        BLD.box((x0, y1, g_ + 1.75), (L_, 2.5, 3.0), yaw, k_); BLD.box((x0, y1 + L_ / 2 + 0.6, g_ + 1.1), (1.2, 2.3, 1.7), yaw, k_); BLD.box((x0, y1 + L_ / 2 + 1.21, g_ + 1.45), (0.02, 2.0, 0.8), yaw, 'dark')
        v_ = rr.randrange(3); vr_ = (v_ / 3, (v_ + 1) / 3)      # the windows, door and stripes are a flat picture on each long side (make_textures.mjs)
        for sg in (-1, 1):
            a_, b_ = Vector((x0 + sg * 1.27, y1 + sg * L_ / 2, g_ + 0.25)), Vector((x0 + sg * 1.27, y1 - sg * L_ / 2, g_ + 0.25)); ART.quad([a_, b_, b_ + Z * 3.0, a_ + Z * 3.0], 'rvside', uv=[(vr_[0], 0), (vr_[1], 0), (vr_[1], 1), (vr_[0], 1)])
        if rr.random() < 0.5: BLD.quad([Vector((x0 + 1.25, y1 - 2.5, g_ + 2.7)), Vector((x0 + 1.25, y1 + 2.5, g_ + 2.7)), Vector((x0 + 3.6, y1 + 2.5, g_ + 2.3)), Vector((x0 + 3.6, y1 - 2.5, g_ + 2.3))], 'tent')
        nrv += 1
log('rvs', nrv)
# ---- the kart track, flat 2D ribbons with a hut
KP = [(-250, -330), (-120, -300), (10, -330), (70, -420), (5, -500), (-90, -470), (-140, -540), (-60, -620), (-200, -640), (-280, -560), (-220, -470), (-290, -410)]
KC = [(p[0], p[1]) for p in catmull([(x, y, 0) for x, y in KP], per=10)]
ribbon(KC, 8, 'asphalt', 0.08, closed=True)
for sd in (1, -1):
    rows = []
    n = len(KC)
    for q in range(n):
        a, b = KC[q - 1], KC[(q + 1) % n]; d = Vector((b[0] - a[0], b[1] - a[1], 0)).normalized(); e = Vector((-d.y, d.x, 0)) * sd; c = Vector((KC[q][0], KC[q][1], 0)); p0, p1 = c + e * 3.5, c + e * 3.85; rows.append((Vector((*p0.xy, gz(*p0.xy) + 0.11)), Vector((*p1.xy, gz(*p1.xy) + 0.11))))
    for q in range(n):
        A, B = rows[q], rows[(q + 1) % n]; BLD.quad([A[0], B[0], B[1], A[1]] if sd > 0 else [A[1], B[1], B[0], A[0]], 'line')
BLD.box((-110, -290 + 22, gz(-110, -268) + 2), (34, 10, 4), 0, 'white'); BLD.box((-110, -268, gz(-110, -268) + 4.2), (37, 12, 0.4), 0, 'roofing')
ribbon(path((-110, -262), (130, -262)), 6, 'slab', 0.1)
# ---- the fan stage, facing the main stand's end of the straight
SX, SY = 430.0, -240.0; g_ = gz(SX, SY); BLD.box((SX, SY, g_ + 0.8), (38, 16, 1.6), 0, 'dark'); BLD.box((SX, SY - 8, g_ + 8), (38, 1.2, 16), 0, 'dark')
panel(Vector((SX, SY - 7.3, g_ + 3)), 28, 3.5, Vector((0, 1, 0)), 'signs', R_LOGO, back=False); panel(Vector((SX, SY - 7.3, g_ + 7)), 28, 7, Vector((0, 1, 0)), 'ads3', r3('redbull'), back=False)
for dx in (-19, 19):
    for dy in (-8, 8): BLD.beam((SX + dx, SY + dy, g_), (SX + dx, SY + dy, g_ + 17), 0.22)
BLD.box((SX, SY, g_ + 17.2), (40, 18, 0.6), 0, 'roofing')
# ---- the Lone Star: painted steel, on a mast, seen from the Long Mile and the straight (Barber's idea, in Texas' terms)
LS = Vector((470, -640, gz(470, -640))); RS = 15.0; BLD.cyl(LS, 1.0, 0.55, 26, n=10); HC = LS + Z * 40
pts = [HC + Vector((math.cos(math.pi / 2 + k * math.pi / 5) * (RS if k % 2 == 0 else RS * 0.382), 0, math.sin(math.pi / 2 + k * math.pi / 5) * (RS if k % 2 == 0 else RS * 0.382))) for k in range(10)]
dep = Vector((0, 0.9, 0))
for k in range(10):
    a, b = pts[k], pts[(k + 1) % 10]; BLD.quad([HC + dep, a + dep, b + dep], 'white'); BLD.quad([HC - dep, b - dep, a - dep], 'white'); BLD.quad([a - dep, b - dep, b + dep, a + dep], 'steel')
# ---- scrub and stones, thin: this land is empty, but not a plane
def blob(bm, c, size, squash, seed, colour, vc):
    r = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    for v in r['verts']:
        n = noise.noise(v.co * 1.7 + Vector((seed, seed * 0.3, 0))); v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2] * squash)) * (1 + 0.28 * n) + c
    for f in {f for v in r['verts'] for f in v.link_faces}:
        for l in f.loops: t = 0.9 + 0.2 * RNG.random(); l[vc] = (colour[0] * t, colour[1] * t, colour[2] * t, 1)
_sc = off(st(ML0 + 1500), BD[1][st(ML0 + 1500)] + 110)
SITES = [(120, -110, 240), (430, -240, 40), (380, -1160, 200), (-110, -470, 215), (470, -640, 25), (-80, -210, 25), (_sc.x, _sc.y, 300)]
rk = bmesh.new(); vr = vcol_layer(rk); sb = bmesh.new(); vs = vcol_layer(sb); nr = ns = 0; mid_x, mid_y = sum(xs) / N, sum(ys) / N
for _ in range(5000):
    x, y = RNG.uniform(mid_x - 1500, mid_x + 1500), RNG.uniform(mid_y - 2200, mid_y + 2200); j_, d = near(x, y)
    if d < 62 or any(math.hypot(x - a, y - b) < r for a, b, r in SITES): continue
    if ((x - 400) / 170) ** 2 + ((y + 1720) / 240) ** 2 < 1.1: continue
    if RNG.random() < 0.25 and nr < 220:
        sz = RNG.uniform(0.4, 1.6); blob(rk, Vector((x, y, gz(x, y) - sz * 0.25)), (sz * RNG.uniform(0.8, 1.4), sz * RNG.uniform(0.8, 1.3), sz), 0.7, RNG.random() * 50, (0.46, 0.3, 0.22), vr); nr += 1
    elif ns < 650:
        sz = RNG.uniform(0.35, 0.8); blob(sb, Vector((x, y, gz(x, y) + sz * 0.3)), (sz, sz * RNG.uniform(0.8, 1.2), sz), 0.75, RNG.random() * 50, (0.3, 0.3, 0.17) if RNG.random() < 0.6 else (0.42, 0.36, 0.22), vs); ns += 1
for b in (rk, sb):
    for f in b.faces: f.smooth = True
mesh_obj('LL rocks', rk, ['rock'], planar=False); mesh_obj('LL scrub', sb, ['scrub'], planar=False); log('rocks', nr, 'scrub', ns)
exec(compile((H / 'llano_dressing.py').read_text(encoding='utf8'), str(H / 'llano_dressing.py'), 'exec'))
for s_ in (BLD, ART, STD, CRD, DEC): s_.done()
# ---- the far range, flat: Mojave's photographed range on arcs (tracks/drylake/make_backdrop.py), day and dusk copies as tracks.js dayNight expects
def backdrop(name, png, gain, r):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(ROOT / 'tracks' / 'drylake' / 'tex' / png); it.extension = 'CLIP'      # no wrap: the top row would pick up the opaque bottom one
    P.inputs['Base Color'].default_value = (0, 0, 0, 1); P.inputs['Roughness'].default_value = 1; nt.links.new(it.outputs['Color'], P.inputs['Emission Color']); P.inputs['Emission Strength'].default_value = gain; nt.links.new(it.outputs['Alpha'], P.inputs['Alpha'])
    try: m.surface_render_method = 'BLENDED'
    except AttributeError: m.blend_method = 'BLEND'
    b = bmesh.new(); uv = b.loops.layers.uv.verify(); SEG, K_ = 24, 0.2; SPAN = math.radians(44)      # stretched wide and pressed low: a far mesa line, not a mountain
    for k_, deg in enumerate((10, 61, 112, 163, 214, 265, 316)):
        mid_, flip = math.radians(deg), k_ % 2 == 1; z0, z1 = 1.5 + r * math.tan(math.radians(-4 * K_)), 1.5 + r * math.tan(math.radians(14 * K_)); rows = []
        for q in range(SEG + 1):
            a_ = mid_ + SPAN / 2 - SPAN * q / SEG; rows.append([b.verts.new((mid_x + r * math.cos(a_), mid_y + r * math.sin(a_), z)) for z in (z0, z1)])
        for q in range(SEG):
            f = b.faces.new([rows[q][0], rows[q + 1][0], rows[q + 1][1], rows[q][1]])
            for l, (uq, vq) in zip(f.loops, ((q, 0), (q + 1, 0), (q + 1, 1), (q, 1))): u = uq / SEG; l[uv].uv = (1 - u if flip else u, vq)
    me = bpy.data.meshes.new(name); b.to_mesh(me); b.free(); me.materials.append(m); VIS.objects.link(bpy.data.objects.new(name, me))
backdrop('Backdrop | range dusk', 'backdrop_dusk.png', 2.0, 7002.0); backdrop('Backdrop | range day', 'backdrop_day.png', 5.0, 7000.0)
