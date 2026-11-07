"""The village of Hartwell, exec'd by build_wold.py after the ground (needs its ground_at, in_stretch, BD, SHELF, TOWN, BRIDGE, VILLAGE, river_d, WATER_Z).
What a Cotswold market village looks like from the road: terraces of two-storey cottages in coursed honey limestone, steep stone-slate roofs with coped gables and tall stacks,
stone-mullioned windows under drip moulds, gabled dormers, timber doors under stone hoods; a Georgian ashlar front or two with white sashes; the inn with its painted board;
an open-arcaded market hall; the church with its battlemented tower at the end of the high street; the river under a five-arched bridge; trees in the gardens and along the water.
Openings are real holes in the walls (recessed glass, reveals that throw shadow), not shapes painted on. Its own seeded stream (VR), so the layout holds."""
VR = random.Random(41)
TREES = []      # (where, why): placed last, as instances
TX = H / 'tex'; QT = Path(r'D:/RaceUltimate/tracks/qingshan/out/trees')      # Qingshan's scanned Poly Haven trees (make_trees.py), loaded as they are
MAT.update({
    'stone': material('HW | coursed limestone', tex='medieval_blocks_03', vcol=True),
    'ashlar': material('HW | ashlar', tex='seaworn_stone_tiles', vcol=True),
    'slate': material('HW | stone slates', tex='roof_slates_02', vcol=True),
    'lead': material('HW | lead', tex='grey_roof_01', vcol=True),
    'glass': material('HW | window glass', (0.02, 0.025, 0.03), 0.06),
    'frame': material('HW | painted timber', tex='white_plaster_02', vcol=True),
    'door': material('HW | door timber', tex='weathered_planks', vcol=True),
    'pot': material('HW | chimney pot', tex='clay_roof_tiles_02', vcol=True),
    'iron': material('HW | iron', (0.025, 0.025, 0.025), 0.5, 0.4),
    'dark': material('HW | openings', (0.012, 0.012, 0.014), 0.6),
    'hedge': material('HW | hedge', tex='forest_leaves_02', vcol=True),
    'gravel': material('HW | gravel', tex='gravel_ground_01', vcol=True),
})
def sheet_mat(name, png, rough=0.6):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P_ = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(png); nt.links.new(it.outputs['Color'], P_.inputs['Base Color']); P_.inputs['Roughness'].default_value = rough
    return m
MAT['signs'] = sheet_mat('HW | signs', TX / 'signs.png')
UVS.update({'stone': 2.4, 'ashlar': 2.6, 'slate': 2.2, 'lead': 3.0, 'frame': 1.0, 'door': 1.2, 'pot': 0.8, 'hedge': 2.0, 'gravel': 3.0})
UPV = Vector((0, 0, 1))
class Sheet:
    """one mesh of several materials, vertex colour per face, world UVs at each material's real scale (walls along their own direction)"""
    def __init__(s, name, keys): s.name, s.keys, s.bm = name, keys, bmesh.new(); s.vc = vcol_layer(s.bm); s.uv = s.bm.loops.layers.uv.verify()
    def face(s, pts, k, col=(1, 1, 1), uv=None, out=None):
        if out is not None:
            n_ = (pts[1] - pts[0]).cross(pts[2] - pts[0]) if len(pts) == 3 else (pts[2] - pts[0]).cross(pts[3] - pts[1])
            if n_.dot(out) < 0: pts = pts[::-1]; uv = uv[::-1] if uv else None
        f = s.bm.faces.new([s.bm.verts.new(p) for p in pts]); f.material_index = s.keys.index(k); f.normal_update()
        if uv is None:
            sc = UVS.get(k, 3.0); n = f.normal
            if abs(n.z) > 0.6: uv = [(p[0] / sc, p[1] / sc) for p in pts]
            else: hx, hy = -n.y, n.x; L_ = math.hypot(hx, hy) or 1.0; uv = [((p[0] * hx + p[1] * hy) / L_ / sc, p[2] / sc) for p in pts]
        for l, u in zip(f.loops, uv): l[s.vc] = (*col, 1); l[s.uv].uv = u
        return f
    def box(s, P, x0, x1, y0, y1, z0, z1, k, col=(1, 1, 1), top=True, bottom=False):
        c = [P(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]; mid = sum(c, Vector()) / 8
        for q in ((0, 1, 5, 4), (1, 3, 7, 5), (3, 2, 6, 7), (2, 0, 4, 6)) + (((4, 5, 7, 6),) if top else ()) + (((0, 2, 3, 1),) if bottom else ()):
            pts = [c[v] for v in q]; s.face(pts, k, col, out=sum(pts, Vector()) / 4 - mid)
    def cyl(s, c, r, z0, z1, k, col=(1, 1, 1), n=10, cap=True):
        for q in range(n):
            a0, a1 = 2 * math.pi * q / n, 2 * math.pi * (q + 1) / n; o0, o1 = Vector((math.cos(a0), math.sin(a0), 0)), Vector((math.cos(a1), math.sin(a1), 0))
            s.face([c + o0 * r + UPV * z0, c + o1 * r + UPV * z0, c + o1 * r + UPV * z1, c + o0 * r + UPV * z1], k, col, out=o0 + o1)
        if cap: s.face([c + Vector((r * math.cos(2 * math.pi * q / n), r * math.sin(2 * math.pi * q / n), z1)) for q in range(n)], k, col, out=UPV)
    def done(s): return mesh_obj(s.name, s.bm, s.keys, planar=False)
VS = Sheet('HW village', ['stone', 'ashlar', 'slate', 'lead', 'glass', 'frame', 'door', 'pot', 'iron', 'dark', 'hedge', 'gravel', 'signs'])
def tone(lo=0.86): t = VR.uniform(lo, 1.0); return (t, t * VR.uniform(0.97, 1.0), t * VR.uniform(0.93, 1.0))
def honey(): t = VR.uniform(0.9, 1.0); return (t, t * VR.uniform(0.86, 0.92), t * VR.uniform(0.66, 0.76))
def mul(a, b): return tuple(x * y for x, y in zip(a, b))

# ------------------------------------------------------------------------------------------------ walls with real openings
def wall(F, x0, x1, z0, z1, ops, k, col, rd=0.16):
    """F(u, v, z): a wall face, u along it, v into the wall (outward is -v), z up. ops: (ua, ub, za, zb, kind): holes cut through, with reveals rd deep and what fills them:
    'win' mullioned glass, 'sash' white sashes, 'door' a timber door, 'arch' an open arch (dark)"""
    out = F(0, -1, 0) - F(0, 0, 0)
    xs_ = sorted({x0, x1} | {o[0] for o in ops} | {o[1] for o in ops})
    for a, b in zip(xs_, xs_[1:]):
        o = next((o for o in ops if o[0] <= a and b <= o[1]), None)
        spans = [(z0, z1)] if o is None else [(z0, o[2]), (o[3], z1)]
        for za, zb in spans:
            if zb - za > 0.005: VS.face([F(a, 0, za), F(b, 0, za), F(b, 0, zb), F(a, 0, zb)], k, col, out=out)
    for ua, ub, za, zb, kind in ops:
        d_ = rd if kind != 'arch' else 0.6
        for p, q, o_ in (((ua, za), (ua, zb), Vector()), ((ub, zb), (ub, za), Vector()), ((ua, zb), (ub, zb), Vector()), ((ub, za), (ua, za), Vector())):
            VS.face([F(p[0], 0, p[1]), F(q[0], 0, q[1]), F(q[0], d_, q[1]), F(p[0], d_, p[1])], k, mul(col, (0.82, 0.82, 0.82)), out=F((ua + ub) / 2, d_ / 2, (za + zb) / 2) - F(p[0] / 2 + q[0] / 2, d_ / 2, p[1] / 2 + q[1] / 2))
        if kind == 'arch': VS.face([F(ua, d_, za), F(ub, d_, za), F(ub, d_, zb), F(ua, d_, zb)], 'dark', out=out); continue
        if kind == 'door':
            VS.face([F(ua, d_, za), F(ub, d_, za), F(ub, d_, zb), F(ua, d_, zb)], 'door', DOOR_COL[VR.randrange(len(DOOR_COL))], out=out); continue
        VS.face([F(ua, d_, za), F(ub, d_, za), F(ub, d_, zb), F(ua, d_, zb)], 'glass', out=out)
        if kind == 'win':      # stone mullions and a transom, the drip mould above, the sill below
            n_l = max(1, round((ub - ua) / 0.55))
            for q in range(1, n_l): uq = ua + (ub - ua) * q / n_l; VS.box(F, uq - 0.05, uq + 0.05, 0.02, d_, za, zb, k, col, top=False)
            if zb - za > 1.3: zt = za + (zb - za) * 0.7; VS.box(F, ua, ub, 0.02, d_, zt - 0.04, zt + 0.04, k, col, top=False, bottom=True)
            VS.box(F, ua - 0.12, ub + 0.12, -0.07, 0.0, zb + 0.05, zb + 0.16, k, col, bottom=True)
            for e in (-1, 1): VS.box(F, (ua - 0.12 if e < 0 else ub + 0.02), (ua - 0.02 if e < 0 else ub + 0.12), -0.07, 0.0, zb - 0.22, zb + 0.05, k, col, top=False, bottom=True)
            VS.box(F, ua - 0.06, ub + 0.06, -0.05, 0.02, za - 0.07, za, k, col)
        else:                  # a sash: white frame, the meeting rail, glazing bars six over six
            fw = 0.06; zm = (za + zb) / 2
            for a_, b_, c_, d__ in ((ua, ua + fw, za, zb), (ub - fw, ub, za, zb), (ua, ub, zb - fw, zb), (ua, ub, za, za + fw), (ua, ub, zm - 0.03, zm + 0.03)):
                VS.box(F, a_, b_, d_ - 0.06, d_ - 0.01, c_, d__, 'frame', (0.95, 0.94, 0.9), top=False)
            for q in (1, 2): uq = ua + (ub - ua) * q / 3; VS.box(F, uq - 0.012, uq + 0.012, d_ - 0.05, d_ - 0.02, za, zb, 'frame', (0.95, 0.94, 0.9), top=False)
            for zq in (za + (zm - za) / 2, zm + (zb - zm) / 2): VS.box(F, ua, ub, d_ - 0.05, d_ - 0.02, zq - 0.012, zq + 0.012, 'frame', (0.95, 0.94, 0.9), top=False)
            VS.box(F, ua - 0.1, ub + 0.1, -0.06, 0.02, za - 0.08, za, 'ashlar', col)
DOOR_COL = [(0.25, 0.38, 0.3), (0.2, 0.25, 0.4), (0.45, 0.16, 0.14), (0.62, 0.5, 0.36), (0.35, 0.35, 0.33), (0.75, 0.72, 0.62)]
# ------------------------------------------------------------------------------------------------ a building: walls, openings per storey, a coped gable roof, stacks, dormers
N_B = [0]
def building(O, ex, w, d, storeys, kind='cottage', col=None, sign=None, dormers=None, roof_col=None, ridge_x=True, eave=None):
    """O: the front's centre at ground level; ex along the street; the front faces -ey (the road). kind: cottage | georgian | inn"""
    ey = Vector((-ex.y, ex.x, 0)); P = lambda x, y, z: O + ex * x + ey * y + UPV * z
    k = 'ashlar' if kind == 'georgian' else 'stone'; col = col or (honey() if k == 'stone' else mul(honey(), (1.05, 1.05, 1.08)))
    sh = 3.1 if kind == 'georgian' else 2.6; h = eave or storeys * sh + 0.35; pitch = math.radians(VR.uniform(48, 54) if kind != 'georgian' else 32)
    plinth = min(0.0, min(ground_at(*P(x_, y_, 0).to_2d()) for x_ in (-w / 2, w / 2) for y_ in (0, d)) - O.z)
    faces = {'front': (lambda u, v, z: P(u - w / 2, v, z), w), 'back': (lambda u, v, z: P(w / 2 - u, d - v, z), w),
             'left': (lambda u, v, z: P(-w / 2 + v, d - u, z), d), 'right': (lambda u, v, z: P(w / 2 - v, u, z), d)}
    for name, (F, L) in faces.items():
        ops = []
        if name in ('front', 'back') or (L > 7 and VR.random() < 0.5):
            n_ = max(1, int(L / (2.3 if kind == 'georgian' else 2.8))); dq = n_ // 2 if kind == 'georgian' else VR.randrange(n_)
            for s_ in range(storeys):
                z0 = s_ * sh
                for q in range(n_):
                    uc = (q + 0.5) * L / n_
                    if name == 'front' and s_ == 0 and q == dq:
                        ops.append((uc - 0.5, uc + 0.5, 0.0, 2.05 if kind != 'georgian' else 2.35, 'door')); continue
                    if kind == 'georgian': ops.append((uc - 0.52, uc + 0.52, z0 + 0.75, z0 + 2.45, 'sash'))
                    else:
                        ww = VR.choice([1.1, 1.6, 1.6, 2.1]) if name == 'front' else 1.0; ops.append((uc - ww / 2, uc + ww / 2, z0 + 0.85, z0 + 1.95, 'win'))
        wall(F, 0, L, plinth - 0.3, h, ops, k, col)
        if name == 'front' and kind != 'georgian':      # a stone hood over the door, on two brackets
            for o in ops:
                if o[4] == 'door': VS.box(F, o[0] - 0.25, o[1] + 0.25, -0.55, 0.0, 2.3, 2.45, k, col, bottom=True); [VS.box(F, u_ - 0.06, u_ + 0.06, -0.5, 0.0, 2.05, 2.3, k, col, top=False) for u_ in (o[0] - 0.12, o[1] + 0.12)]
        if name == 'front' and kind == 'georgian':      # a doorcase: pilasters and a pediment
            for o in ops:
                if o[4] == 'door':
                    for u_ in (o[0] - 0.22, o[1] + 0.02): VS.box(F, u_, u_ + 0.2, -0.12, 0.0, 0.0, 2.6, 'ashlar', col)
                    pa = [F(o[0] - 0.4, -0.18, 2.6), F(o[1] + 0.4, -0.18, 2.6), F((o[0] + o[1]) / 2, -0.18, 3.15)]; VS.face(pa, 'ashlar', col, out=F(0, -1, 0) - F(0, 0, 0))
                    VS.box(F, o[0] - 0.4, o[1] + 0.4, -0.2, 0.0, 2.52, 2.62, 'ashlar', col, bottom=True)
    if kind == 'georgian':      # a cornice and a blocking course, the roof behind it
        VS.box(P, -w / 2 - 0.12, w / 2 + 0.12, -0.18, d + 0.12, h - 0.25, h - 0.05, 'ashlar', col, bottom=True); VS.box(P, -w / 2, w / 2, -0.05, d, h - 0.05, h + 0.6, 'ashlar', col)
    if sign is not None:      # the painted board along the front over the ground floor
        sw = min(w - 1.0, 6.5); y_ = -0.06; z_ = 2.55 if kind != 'georgian' else 2.85
        VS.face([P(-sw / 2, y_, z_), P(sw / 2, y_, z_), P(sw / 2, y_, z_ + sw / 4), P(-sw / 2, y_, z_ + sw / 4)], 'signs', uv=[(0.003, 1 - (sign + 1) / 4 + 0.003), (0.997, 1 - (sign + 1) / 4 + 0.003), (0.997, 1 - sign / 4 - 0.003), (0.003, 1 - sign / 4 - 0.003)], out=-ey)
    # the roof: ridge along the street, gables at the ends with copings and kneelers, stone slates
    r = (d / 2) * math.tan(pitch); zr = h + r; rc = roof_col or mul((0.78, 0.74, 0.66), tone(0.8)); ov = 0.25
    for sy, y0 in ((-1, -ov), (1, d + ov)):
        e0, e1 = P(-w / 2, y0, h - ov * math.tan(pitch)), P(w / 2, y0, h - ov * math.tan(pitch)); r0, r1 = P(-w / 2, d / 2, zr), P(w / 2, d / 2, zr)
        VS.face([e0, e1, r1, r0], 'slate', rc, out=ey * sy + UPV); VS.face([e0, e1, r1, r0], 'slate', mul(rc, (0.5, 0.5, 0.5)), out=-(ey * sy + UPV))      # its underside under the eaves
    for sx in (-1, 1):
        gp = [P(sx * w / 2, 0, h), P(sx * w / 2, d, h), P(sx * w / 2, d / 2, zr)]; VS.face(gp, k, col, out=ex * sx)      # the gable's triangle
        for a_, b_ in (((0, h), (d / 2, zr)), ((d, h), (d / 2, zr))):      # the coping along each rake
            A, B = P(sx * w / 2, a_[0], a_[1]), P(sx * w / 2, b_[0], b_[1]); t_ = (B - A).normalized()
            q = [A + ex * sx * 0.06 + UPV * 0.05, B + ex * sx * 0.06 + UPV * 0.05, B - ex * sx * 0.32 + UPV * 0.05, A - ex * sx * 0.32 + UPV * 0.05]
            VS.face([p_ + UPV * 0.14 for p_ in q], k, col, out=UPV); VS.face([q[0], q[1], q[1] + UPV * 0.14, q[0] + UPV * 0.14], k, col, out=ex * sx)
        if VR.random() < 0.8 or kind == 'georgian':      # the stack on the gable, two pots
            c_ = lambda x, y, z, sx=sx: P(sx * (w / 2 - 0.4) + x, d / 2 + y, z)
            VS.box(c_, -0.45, 0.45, -0.32, 0.32, zr - 1.2, zr + 1.1, k, col); VS.box(c_, -0.5, 0.5, -0.37, 0.37, zr + 1.0, zr + 1.15, k, col, bottom=True)
            for e in (-0.2, 0.2): VS.cyl(P(sx * (w / 2 - 0.4) + e, d / 2, 0), 0.12, zr + 1.15, zr + 1.6, 'pot', (0.85, 0.55, 0.42), n=8)
    VS.box(P, -w / 2, w / 2, d / 2 - 0.12, d / 2 + 0.12, zr - 0.04, zr + 0.1, 'slate', mul(rc, (0.8, 0.8, 0.8)))      # the ridge
    for q in range(dormers if dormers is not None else (VR.choice([0, 0, 1, 2]) if kind == 'cottage' and storeys < 3 else 0)):      # gabled dormers through the eaves
        xc = -w / 2 + (q + 0.5) * w / (dormers or 2) + VR.uniform(-0.3, 0.3); dw, dh = 1.5, 1.6; y0 = -0.02; zb_ = h - 0.4
        F = lambda u, v, z, xc=xc: P(xc - dw / 2 + u, y0 + v, z)
        wall(F, 0, dw, zb_, zb_ + dh, [(0.3, dw - 0.3, zb_ + 0.6, zb_ + 1.35, 'win')], k, col, rd=0.1)
        yb = (zb_ + dh - h) / math.tan(pitch) + 0.3      # where the dormer's roof meets the main roof
        for sx in (-1, 1): VS.face([P(xc + sx * dw / 2, y0, zb_), P(xc + sx * dw / 2, yb, zb_ + dh), P(xc + sx * dw / 2, y0, zb_ + dh)], k, col, out=ex * sx)
        VS.face([P(xc - dw / 2 - 0.1, y0 - 0.1, zb_ + dh), P(xc, y0 - 0.1, zb_ + dh + 0.7), P(xc, yb, zb_ + dh + 0.7), P(xc - dw / 2 - 0.1, yb, zb_ + dh)], 'slate', rc, out=-ex + UPV)
        VS.face([P(xc + dw / 2 + 0.1, y0 - 0.1, zb_ + dh), P(xc, y0 - 0.1, zb_ + dh + 0.7), P(xc, yb, zb_ + dh + 0.7), P(xc + dw / 2 + 0.1, yb, zb_ + dh)], 'slate', rc, out=ex + UPV)
        VS.face([P(xc - dw / 2, y0, zb_ + dh), P(xc + dw / 2, y0, zb_ + dh), P(xc, y0, zb_ + dh + 0.7)], k, col, out=-ey)
    N_B[0] += 1
    return zr

# ------------------------------------------------------------------------------------------------ the high street: terraces both sides, the inn, the shop, the tea room, the market hall in its square
OCC = set()
def foot(O, ex, w, d):
    ey = Vector((-ex.y, ex.x, 0)); out = set()
    for a in np.arange(-w / 2 + 0.2, w / 2 - 0.19, 0.5):
        for b in np.arange(0.2, d - 0.19, 0.5): p = O + ex * a + ey * b; out.add((int(math.floor(p.x * 2)), int(math.floor(p.y * 2))))
    return out
def clear(O, ex, w, d, need):
    ey = Vector((-ex.y, ex.x, 0))
    return all(near(*(O + ex * a + ey * b).to_2d())[1] >= need for a in (-w / 2, 0, w / 2) for b in (0, d / 2, d))
SKIP = {'road': 0, 'occ': 0}
SQUARE = (st(2830), st(2872), 1)      # the market square: a gap in the left frontage
SIGNS_AT = {st(2700): (-1, 1), st(2905): (1, 0), st(3010): (-1, 2)}
for sd in (1, -1):
    s_ = 2600.0
    while s_ < 3150:
        i = st(s_); kind = 'georgian' if VR.random() < 0.18 else 'cottage'; w = VR.uniform(8.5, 11.5) if kind == 'georgian' else VR.uniform(5.0, 8.5)
        i = st(s_ + w / 2); s_ += w + (VR.uniform(2.5, 5.0) if VR.random() < 0.15 else 0.0)
        if not in_stretch(i) or not VILLAGE[i]: continue
        if sd == SQUARE[2] and SQUARE[0] <= i <= SQUARE[1]: continue
        ex = T[i].to_3d() * sd; ex.normalize(); setback = SHELF - 0.6 + (VR.uniform(2, 5) if VR.random() < 0.2 else 0.0)
        O = off(i, sd * setback); O.z = CL[i].z + 0.12; d = VR.uniform(6.5, 8.5) if kind == 'georgian' else VR.uniform(5.5, 7.0)
        if not clear(O, ex, w, d, BD[sd][i] + 1.5): SKIP['road'] += 1; continue
        if foot(O, ex, w, 3.0) & OCC: SKIP['occ'] += 1; continue      # only the front's strip: on the inside of the bends neighbours' backs may meet, as real terraces' do
        OCC.update(foot(O, ex, w, d))
        sg = next((v[1] for j, v in SIGNS_AT.items() if v[0] == sd and abs(j - i) * STEP < w / 2 + 1), None)
        if sg == 0: kind, w_ = 'inn', w      # the inn: longer, with dormers
        building(O, ex, w, d, 3 if kind == 'georgian' else 2, kind='cottage' if kind == 'inn' else kind, sign=sg, dormers=2 if kind == 'inn' else None)
        if VR.random() < 0.5:      # the garden behind: a wall and a tree or two
            for q in range(VR.randrange(1, 3)): TREES.append((O + Vector(((ex * VR.uniform(-w / 2, w / 2)) + Vector((-ex.y, ex.x, 0)) * (d + VR.uniform(4, 14)))), 'garden'))
log('village buildings', N_B[0], 'skipped', SKIP)
# the back lanes: a second row behind the gardens, a barn or two at the ends
for sd in (1, -1):
    s_ = 2600.0
    while s_ < 3150:
        barn = VR.random() < 0.18; w = VR.uniform(10, 16) if barn else VR.uniform(5.5, 9.0); i = st(s_ + w / 2); s_ += w + VR.uniform(0.0, 5.0)
        if not in_stretch(i) or not VILLAGE[i] or VR.random() < 0.2: continue
        ex = T[i].to_3d() * sd; ex.normalize(); ex.rotate(Matrix.Rotation(VR.uniform(-0.08, 0.08), 3, 'Z')); O = off(i, sd * (SHELF + VR.uniform(14, 24))); O.z = ground_at(O.x, O.y) + 0.05; d = VR.uniform(6.5, 8.5) if barn else VR.uniform(5.5, 7.0)
        if not clear(O, ex, w, d, SHELF + 6) or foot(O, ex, w, d) & OCC: continue
        OCC.update(foot(O, ex, w, d)); building(O, ex, w, d, 2, dormers=0 if barn else None)
        if VR.random() < 0.6: TREES.append((O + Vector((-ex.y, ex.x, 0)) * (d + VR.uniform(3, 10)) + ex * VR.uniform(-w / 2, w / 2), 'garden'))
log('village buildings with the back lanes', N_B[0])
# ------------------------------------------------------------------------------------------------ the country round the lap: the old airfield on the top, barns, the manor across the park's lake,
# the beech hanger down the escarpment, the park's trees. Placed before the fields so the walls and hedges stop at them (OCC).
MAT.update({'runway': material('HW | runway concrete', tex='dirty_concrete', vcol=True), 'corr': material('HW | corrugated iron', tex='rusty_corrugated_iron', vcol=True)})
UVS.update({'runway': 4.0, 'corr': 1.6})
AF = Sheet('HW airfield', ['runway', 'corr', 'door', 'dark'])
HANG0, HANG1, PARK0, PARK1, AIR0, AIR1 = 1282.0, 1850.0, 3420.0, 4180.0, 5250.0, 760.0
def zone(p):
    """where no field wall or hedge runs: the beech hanger (the escarpment's outside), the park, the airfield north of the top straight"""
    i, _ = near(p.x, p.y); s = i * STEP; side = 1 if (Vector((p.x, p.y, 0)) - CL[i]).to_2d().dot(NL[i].to_2d()) > 0 else -1
    return (HANG0 - 40 <= s <= HANG1 and side > 0) or PARK0 <= s <= PARK1 or ((s >= AIR0 or s <= AIR1) and side > 0)
def drape(p, dz=0.06): return Vector((p.x, p.y, ground_at(p.x, p.y) + dz))
# the runway: a wartime strip of weathered concrete, parallel to the top straight
RW0, RW1 = C2B(-560, 185), C2B(560, 225); ru = (RW1 - RW0).normalized(); rn = Vector((-ru.y, ru.x, 0)); RL = (RW1 - RW0).length
for k in range(int(RL / 10)):
    a, b = RW0 + ru * k * 10, RW0 + ru * min(RL, (k + 1) * 10)
    for e0, e1 in ((-23, -11.5), (-11.5, 0), (0, 11.5), (11.5, 23)):
        t = 0.78 + 0.16 * fbm(a.x / 40 + e0 / 30, a.y / 40, 2); AF.face([drape(a + rn * e0), drape(b + rn * e0), drape(b + rn * e1), drape(a + rn * e1)], 'runway', (t, t, t * 0.97), out=UPV)
OCC.update(foot((RW0 + RW1) / 2 - rn * 26, ru, RL + 6, 52))
def hangar(O, ex, L=36.0, span=24.0, rise=9.5, seg=12):
    """a T2-style hangar: a corrugated barrel on a low plinth, its doors across one end"""
    ey = Vector((-ex.y, ex.x, 0)); z0 = min(ground_at(*(O + ex * a + ey * b).to_2d()) for a in (-L / 2, L / 2) for b in (-span / 2, span / 2)) - 0.3
    P = lambda x, y, z: Vector((O.x, O.y, z0)) + ex * x + ey * y + UPV * z
    arc = [(-span / 2 * math.cos(math.pi * q / seg), rise * math.sin(math.pi * q / seg) + 0.6) for q in range(seg + 1)]
    for (y0, z0_), (y1, z1_) in zip(arc, arc[1:]):
        o_ = ey * (y0 + y1) / span + UPV * (z0_ + z1_ - 1.2) / rise; AF.face([P(-L / 2, y0, z0_), P(L / 2, y0, z0_), P(L / 2, y1, z1_), P(-L / 2, y1, z1_)], 'corr', tone(0.8), out=o_)
    for sx in (-1, 1):
        AF.face([P(sx * L / 2, y, z) for y, z in [(-span / 2, 0.0)] + arc + [(span / 2, 0.0)]], 'corr', mul(tone(0.8), (0.9, 0.9, 0.9)), out=ex * sx)
        AF.box(lambda x, y, z, sx=sx: P(sx * L / 2, 0, 0) + ex * x + ey * y + UPV * z, -0.2 if sx < 0 else 0.0, 0.0 if sx < 0 else 0.2, -span * 0.32, span * 0.32, 0.0, rise * 0.62, 'door' if sx > 0 else 'dark', (0.55, 0.58, 0.52))
    OCC.update(foot(P(0, -span / 2 - 2, 0), ex, L + 4, span + 4))
for x_ in (-470, -400): hangar(C2B(x_, 300), ru)
# barns: stone, two storeys, no dormers, at the field's edge
for s_, sd, lat_ in ((2200, 1, 62), (4460, -1, 58), (1080, -1, 75), (4800, 1, 70)):
    i = st(s_); ex = T[i].to_3d() * sd; ex.normalize(); O = off(i, sd * lat_); O.z = ground_at(O.x, O.y) + 0.05
    if clear(O, ex, 15, 8.5, 40) and not foot(O, ex, 15, 8.5) & OCC: OCC.update(foot(O, ex, 15, 8.5)); building(O, ex, 15, 8.5, 2, dormers=0)
# the manor: a Georgian house across the lake from the park's road
MO = C2B(-905, -820); ey_ = MO - LAKE_C; ey_.z = 0; ey_.normalize(); ex_ = Vector((ey_.y, -ey_.x, 0)); MO.z = ground_at(MO.x, MO.y) + 0.1
building(MO, ex_, 30.0, 13.0, 3, kind='georgian', dormers=0); OCC.update(foot(MO - ey_ * 4, ex_, 34, 21))
log('airfield, hangars, barns, manor: buildings now', N_B[0])
# the beech hanger: close woodland down the escarpment's outside; the park: single trees scattered over the grass
for s_ in np.arange(HANG0 - 40, HANG1, 8.0):
    i = st(s_)
    for lat_ in np.arange(4.0, 132.0, 8.0):
        p = off(i, BD[1][i] + lat_ + VR.uniform(-3, 3)) + T[i].to_3d() * VR.uniform(-3, 3)
        if VR.random() < 0.9: TREES.append((p, 'hanger'))
for q in range(220):
    s_ = VR.uniform(PARK0, PARK1); i = st(s_); sd = VR.choice((-1, 1)); p = off(i, sd * (BD[sd][i] + VR.uniform(20, 230)))
    if river_d(p.x, p.y) > RIVER_W + 8: TREES.append((p, 'park'))
# the fields round the village: drystone walls and hedgerows, parallel to the road and across it, a hedgerow tree now and then
FW = Sheet('HW field walls', ['barrier'])
HEDGE_PTS = []
def field_line(pts):
    """a wall or a hedge along pts, broken where it would meet the road, a house or the river"""
    run = []; hedge = VR.random() < 0.45
    for p in pts + [None]:
        ok = p is not None and near(p.x, p.y)[1] > SHELF + 12 and river_d(p.x, p.y) > RIVER_W + 4 and (int(math.floor(p.x * 2)), int(math.floor(p.y * 2))) not in OCC and not zone(p)
        if ok: p = Vector((p.x, p.y, ground_at(p.x, p.y))); run.append(p); continue
        if len(run) > 3:
            if hedge: HEDGE_PTS.extend(run[::1])
            else:
                for a, b in zip(run, run[1:]):
                    t_ = (b - a); t_.z = 0; t_.normalize(); n_ = Vector((-t_.y, t_.x, 0)); hh = 1.25 + 0.1 * math.sin(a.x * 0.7)
                    for e in (-1, 1): FW.face([a + n_ * e * 0.35 - UPV * 0.3, b + n_ * e * 0.35 - UPV * 0.3, b + n_ * e * 0.2 + UPV * hh, a + n_ * e * 0.2 + UPV * hh], 'barrier', out=n_ * e)
                    FW.face([a + n_ * -0.2 + UPV * hh, b + n_ * -0.2 + UPV * hh, b + n_ * 0.2 + UPV * (hh + 0.12), a + n_ * 0.2 + UPV * (hh + 0.12)], 'barrier', out=UPV)
            for q in range(0, len(run), 12):
                if VR.random() < 0.6: TREES.append((run[q] + Vector((VR.uniform(-1, 1), VR.uniform(-1, 1), 0)), 'hedgerow'))
        run = []
i0, i1 = st(STRETCH[0] - 200) if STRETCH else 0, st(STRETCH[1] + 200) if STRETCH else N
for sd in (1, -1):
    for lat in (SHELF + 45, SHELF + 120, SHELF + 210):
        field_line([off(i, sd * (lat + 6 * math.sin(i * 0.05))) for i in range(i0, i1)])
    for i in range(i0, i1, 36):
        field_line([off(i, sd * lat) for lat in np.arange(SHELF + 12, 300, 2.5)])
FW.done(); log('hedge points', len(HEDGE_PTS))
# copses: tight clumps of trees on the rises between the fields, as the wold's shelter belts are
n_c = 0
for q in range(16):
    s_ = VR.uniform(0, LAP); i = st(s_); sd = VR.choice((-1, 1)); c_ = off(i, sd * (BD[sd][i] + VR.uniform(140, 420)))
    if zone(c_) or river_d(c_.x, c_.y) < RIVER_W + 30 or near(c_.x, c_.y)[1] < 120: continue
    R_ = VR.uniform(22, 45); n_c += 1
    for k in range(int(R_ * 0.9)):
        a_, r_ = VR.uniform(0, 2 * math.pi), R_ * math.sqrt(VR.random()); p = c_ + Vector((math.cos(a_) * r_, math.sin(a_) * r_, 0))
        if (int(math.floor(p.x * 2)), int(math.floor(p.y * 2))) not in OCC: TREES.append((p, 'copse'))
log('copses', n_c)

# the market hall: an open arcade of round arches below, a room above, a coped gable roof
mi = (SQUARE[0] + SQUARE[1]) // 2; ex = T[mi].to_3d() * SQUARE[2]; ex.normalize(); ey = Vector((-ex.y, ex.x, 0)); O = off(mi, SQUARE[2] * (SHELF + 4)); O.z = CL[mi].z + 0.25
VS.box(lambda x, y, z: O + ex * x + ey * y + UPV * z, -10, 10, -3, 13, -0.6, 0.0, 'ashlar', honey())      # the square's raised floor
P_ = lambda x, y, z: O + ex * x + ey * y + UPV * z; col = honey(); hw_, hd_ = 8.0, 3.5
for name, F, L, n_ in (('f', lambda u, v, z: P_(u - hw_, v, z), 2 * hw_, 5), ('b', lambda u, v, z: P_(hw_ - u, 2 * hd_ - v, z), 2 * hw_, 5), ('l', lambda u, v, z: P_(-hw_ + v, 2 * hd_ - u, z), 2 * hd_, 2), ('r', lambda u, v, z: P_(hw_ - v, u, z), 2 * hd_, 2)):
    ops = [((q + 0.5) * L / n_ - 1.05, (q + 0.5) * L / n_ + 1.05, 0.0, 3.0, 'arch') for q in range(n_)]
    ops += [((q + 0.5) * L / n_ - 0.6, (q + 0.5) * L / n_ + 0.6, 4.2, 5.4, 'win') for q in range(n_)] if name in 'fb' else []
    wall(F, 0, L, -0.1, 6.6, ops, 'ashlar', col, rd=0.45)
    for q in range(n_):      # the round heads of the arches: voussoirs as a ring of blocks
        uc = (q + 0.5) * L / n_
        for a in range(7):
            a0, a1 = math.pi * a / 7, math.pi * (a + 1) / 7
            VS.face([F(uc + 1.05 * math.cos(a0), -0.04, 3.0 + 1.05 * math.sin(a0)), F(uc + 1.05 * math.cos(a1), -0.04, 3.0 + 1.05 * math.sin(a1)), F(uc + 1.35 * math.cos(a1), -0.04, 3.0 + 1.35 * math.sin(a1)), F(uc + 1.35 * math.cos(a0), -0.04, 3.0 + 1.35 * math.sin(a0))], 'ashlar', mul(col, (1.04, 1.04, 1.04)), out=F(0, -1, 0) - F(0, 0, 0))
VS.box(P_, -hw_, hw_, 0.05, 2 * hd_ - 0.05, 3.05, 3.3, 'ashlar', col, bottom=True)      # the floor over the arcade, seen through the arches
rr = hd_ * math.tan(math.radians(50)); zr = 6.6 + rr
for sy, y0 in ((-1, -0.3), (1, 2 * hd_ + 0.3)):
    VS.face([P_(-hw_ - 0.2, y0, 6.6 - 0.3), P_(hw_ + 0.2, y0, 6.6 - 0.3), P_(hw_ + 0.2, hd_, zr), P_(-hw_ - 0.2, hd_, zr)], 'slate', mul((0.78, 0.74, 0.66), tone(0.85)), out=ey * sy + UPV)
for sx in (-1, 1): VS.face([P_(sx * hw_, 0, 6.6), P_(sx * hw_, 2 * hd_, 6.6), P_(sx * hw_, hd_, zr)], 'ashlar', col, out=ex * sx)

# ------------------------------------------------------------------------------------------------ the church: nave, chancel, the west tower at the end of the high street's line
i5 = st(3120); fwd = T[i5].to_3d(); fwd.normalize(); CH = off(i5, 0) + fwd * 95 - NL[i5].to_3d() * 25; CH.z = ground_at(CH.x, CH.y) + 0.1
ce = -fwd; cn = Vector((-ce.y, ce.x, 0)); PC = lambda x, y, z: CH + ce * x + cn * y + UPV * z; col = honey()
def gothic_ops(L, n_, z0, z1):
    return [((q + 0.5) * L / n_ - 0.7, (q + 0.5) * L / n_ + 0.7, z0, z1, 'win') for q in range(n_)]
for (x0, x1, y0, y1, h_) in ((0, 22, -5, 5, 8.5), (22, 32, -3.8, 3.8, 7.0)):      # nave, chancel
    for F, L, ops in ((lambda u, v, z, x0=x0, y0=y0: PC(x0 + u, y0 + v, z), x1 - x0, gothic_ops(x1 - x0, 4, 2.4, 6.4)), (lambda u, v, z, x1=x1, y1=y1: PC(x1 - u, y1 - v, z), x1 - x0, gothic_ops(x1 - x0, 4, 2.4, 6.4)),
                      (lambda u, v, z, x1=x1, y0=y0: PC(x1 - v, y0 + u, z), y1 - y0, [] if x1 < 30 else [(-1.2 + (y1 - y0) / 2, 1.2 + (y1 - y0) / 2, 2.0, 6.0, 'win')])):
        wall(F, 0, L, -0.5, h_, ops, 'stone', col, rd=0.4)
    rp = (y1 - y0) / 2 * math.tan(math.radians(40))
    for sy in (-1, 1): VS.face([PC(x0, sy * (y1 - y0) / 2 + sy * 0.3, h_ - 0.25), PC(x1, sy * (y1 - y0) / 2 + sy * 0.3, h_ - 0.25), PC(x1, 0, h_ + rp), PC(x0, 0, h_ + rp)], 'lead', (0.75, 0.75, 0.74), out=cn * sy + UPV)
    for x_ in (x0, x1): VS.face([PC(x_, y0, h_), PC(x_, y1, h_), PC(x_, 0, h_ + rp)], 'stone', col, out=ce * (1 if x_ == x1 else -1))
    for q in range(5):      # buttresses between the windows
        xq = x0 + (x1 - x0) * q / 4
        for sy in (-1, 1): VS.box(PC, xq - 0.35, xq + 0.35, sy * (y1 - y0) / 2 + (0 if sy > 0 else -1.0), sy * (y1 - y0) / 2 + (1.0 if sy > 0 else 0), -0.5, h_ * 0.75, 'stone', col)
# the tower: three stages, string courses, belfry openings, battlements and pinnacles
TW = 6.4; F_t = [(lambda u, v, z, a=a: PC(-TW + (u if a == 0 else TW - v if a == 1 else TW - u if a == 2 else v), (-TW / 2 + v if a == 0 else -TW / 2 + u if a == 1 else TW / 2 - v if a == 2 else TW / 2 - u), z)) for a in range(4)]
for a, F in enumerate(F_t):
    ops = [(TW / 2 - 0.9, TW / 2 + 0.9, 18.0, 21.0, 'arch')] + ([(TW / 2 - 0.9, TW / 2 + 0.9, 0.0, 3.4, 'arch')] if a == 0 else [(TW / 2 - 0.5, TW / 2 + 0.5, 9.0, 11.0, 'win')])
    wall(F, 0, TW, -0.5, 24.0, ops, 'stone', col, rd=0.5)
    for zc in (7.5, 16.5, 23.6): VS.box(F, -0.15, TW + 0.15, -0.15, 0.0, zc, zc + 0.3, 'ashlar', col, bottom=True)
    for q in range(5): VS.box(F, q * TW / 4 - 0.35 if q else 0.0, q * TW / 4 + 0.35 if q < 4 else TW, 0.0, 0.5, 24.0, 25.0, 'stone', col)      # merlons
VS.box(PC, -TW, 0, -TW / 2, TW / 2, 23.5, 23.6, 'lead', (0.6, 0.6, 0.6))
for cx, cy in ((-TW, -TW / 2), (0, -TW / 2), (0, TW / 2), (-TW, TW / 2)):
    for k_ in range(4):
        a0, a1 = k_ * math.pi / 2, (k_ + 1) * math.pi / 2; b_ = PC(cx, cy, 25.0); o0, o1 = (ce * math.cos(a0) + cn * math.sin(a0)) * 0.32, (ce * math.cos(a1) + cn * math.sin(a1)) * 0.32
        VS.face([b_ + o0, b_ + o1, PC(cx, cy, 27.4)], 'stone', col, out=o0 + o1)
TOWER_TOP = PC(-TW / 2, 0, 27.0)
for q in range(40):      # the churchyard: headstones in loose rows
    x_, y_ = VR.uniform(2, 30), VR.choice((-1, 1)) * VR.uniform(7, 18); p_ = PC(x_, y_, 0); p_.z = ground_at(p_.x, p_.y)
    VS.box(lambda x, y, z, p_=p_, a_=VR.uniform(-0.1, 0.1): p_ + (ce * math.cos(a_) + cn * math.sin(a_)) * x + (cn * math.cos(a_) - ce * math.sin(a_)) * y + UPV * z, -0.06, 0.06, -0.4, 0.4, -0.2, VR.uniform(0.7, 1.1), 'ashlar', mul((0.75, 0.74, 0.7), tone(0.7)))
for q in range(8): TREES.append((PC(VR.uniform(-4, 34), VR.choice((-1, 1)) * VR.uniform(12, 20), 0), 'yard'))
log('church at', round((CH - off(i5, 0)).length), 'm beyond T5')

# ------------------------------------------------------------------------------------------------ the bridge: three segmental arches over the cut, cutwaters on the piers, spandrels in honey ashlar; the parapets are the walls career_lib built
B_ = [i for i in range(N) if BRIDGE[i]]; b0, b1 = B_[0] - 2, B_[-1] + 2; L_b = (b1 - b0) * STEP; spans = 3; pier, abut = 1.8, 1.5; span = (L_b - 2 * abut - (spans - 1) * pier) / spans
SPRING = WATER_Z + 0.4
def arch_bottom(u, top):
    """the intrados height at u metres along the bridge (a segmental arch whose crown sits 1 m under the deck), or None on a pier or an abutment"""
    a = abut
    for q in range(spans):
        if a <= u <= a + span: t_ = (u - a - span / 2) / (span / 2); rise = max(1.0, top - 1.0 - SPRING); return SPRING + rise * math.sqrt(max(0.0, 1 - t_ * t_))
        a += span + pier
    return None
def bp(i, sd, z): p = off(i, sd * (BD[sd][i] + 0.5)); return Vector((p.x, p.y, z))
us = list(np.arange(0, L_b + 0.01, 0.5)); SI = lambda u: min(b1, b0 + int(round(u / STEP)))
for u0, u1 in zip(us, us[1:]):
    i0, i1 = SI(u0), SI(u1); t0, t1 = CL[i0].z - 0.05, CL[i1].z - 0.05; z0, z1 = arch_bottom(u0, t0), arch_bottom(u1, t1); g = WATER_Z - 1.6
    for sd in (1, -1):
        VS.face([bp(i0, sd, z0 if z0 is not None else g), bp(i1, sd, z1 if z1 is not None else g), bp(i1, sd, t1), bp(i0, sd, t0)], 'ashlar', (1.0, 0.87, 0.66), out=NL[i0].to_3d() * sd)
    if z0 is not None and z1 is not None:      # the barrel, side to side
        VS.face([bp(i0, 1, z0), bp(i1, 1, z1), bp(i1, -1, z1), bp(i0, -1, z0)], 'ashlar', (0.82, 0.72, 0.56), out=-UPV)
    elif (z0 is None) != (z1 is None):      # a pier's or an abutment's face inside the arch
        zz = z1 if z1 is not None else z0; ii = i1 if z1 is not None else i0
        VS.face([bp(ii, 1, WATER_Z - 1.6), bp(ii, -1, WATER_Z - 1.6), bp(ii, -1, zz), bp(ii, 1, zz)], 'ashlar', (0.86, 0.76, 0.58), out=T[ii].to_3d() * (1 if z1 is not None else -1))
for sd in (1, -1):
    a = abut + span
    for q in range(spans - 1):      # cutwaters on each pier, both faces, up to the springing
        i_ = SI(a + pier / 2); c_ = bp(i_, sd, 0); t_ = T[i_].to_3d(); n_ = NL[i_].to_3d() * sd; tip = c_ + n_ * 1.4
        for e in (-1, 1): VS.face([Vector((c_.x, c_.y, WATER_Z - 1.6)) + t_ * e * pier / 2, Vector((tip.x, tip.y, WATER_Z - 1.6)), Vector((tip.x, tip.y, SPRING + 0.4)), Vector((c_.x, c_.y, SPRING + 0.9)) + t_ * e * pier / 2], 'ashlar', (0.95, 0.83, 0.62), out=n_ + t_ * e)
        a += span + pier
    for u in np.arange(0, L_b, 0.5):      # a string course under the parapet
        i0, i1 = SI(u), SI(u + 0.5); A, B = bp(i0, sd, CL[i0].z - 0.05), bp(i1, sd, CL[i1].z - 0.05); o = NL[i0].to_3d() * sd * 0.08
        VS.face([A + o - UPV * 0.25, B + o - UPV * 0.25, B + o, A + o], 'ashlar', (1.0, 0.9, 0.7), out=NL[i0].to_3d() * sd)
log('bridge', round(L_b, 1), 'm,', spans, 'arches of', round(span, 1), 'm')
for q in range(90): TREES.append((Vector(_rp[VR.randrange(len(_rp))]) + Vector((VR.uniform(-1, 1), VR.uniform(-1, 1), 0)).normalized() * (RIVER_W + VR.uniform(3, 9)), 'river'))

# ------------------------------------------------------------------------------------------------ trees: Qingshan's scanned Poly Haven broadleaves, placed as instances (the pack keeps them instanced, NO_JOIN)
MASTER = {}
for sp in ('tree_small_02', 'island_tree_01', 'island_tree_02'):
    with bpy.data.libraries.load(str(QT / f'{sp}.blend'), link=False) as (a, b): b.objects = [n_ for n_ in a.objects if n_.startswith('TREE')]
    for o in b.objects: MASTER[o.name] = o.data
with bpy.data.libraries.load(str(QT / 'understorey.blend'), link=False) as (a, b): b.objects = [n_ for n_ in a.objects if n_.startswith('SHRUB')]
for o in b.objects: MASTER[o.name] = o.data
TREEC = bpy.data.collections.new('trees'); VIS.children.link(TREEC); HT = {'tree_small_02': 4.56, 'island_tree_01': 5.03, 'island_tree_02': 3.41}; nt_ = 0
PLACED = []      # (master, matrix, tier): the game's instanced sets; TREEC keeps one copy each for the review in Blender
for p, why in TREES:
    j_, dr = near(p.x, p.y)
    if dr < BD[1][j_] + 3 or river_d(p.x, p.y) < RIVER_W + 1.5 or not in_stretch(j_) and why not in ('river', 'hedgerow'): continue
    if why in ('hanger', 'park', 'copse') and (int(math.floor(p.x * 2)), int(math.floor(p.y * 2))) in OCC: continue
    sp = ('tree_small_02' if VR.random() < 0.7 else 'island_tree_01') if why == 'hanger' else 'tree_small_02' if VR.random() < 0.55 else VR.choice(['island_tree_01', 'island_tree_02'])
    h = VR.uniform(16, 24) / HT[sp] if why in ('hanger', 'copse') else VR.uniform(11, 19) / HT[sp] if why == 'park' else VR.uniform(9, 17) / HT[sp]
    lod = 'LOD0' if dr < 40 else 'LOD1' if dr < 140 else 'CARD'
    ob = bpy.data.objects.new(f'tree {sp}', MASTER[f'TREE {sp} {lod}']); TREEC.objects.link(ob); ob.location = (p.x, p.y, ground_at(p.x, p.y) - 0.15); ob.rotation_euler = (0, 0, VR.uniform(0, 6.283)); ob.scale = (h, h, h); nt_ += 1
    PLACED.append((f'TREE {sp}', ob.matrix_basis.copy(), 0 if dr < 45 else 1 if dr < 140 else 2))
nh = 0
for q, p in enumerate(HEDGE_PTS):      # the hedgerows: Qingshan's scanned shrubs packed in a line, a little taller in places
    k_ = VR.randint(4, 7); ob = bpy.data.objects.new('hedge', MASTER[f'SHRUB {k_}']); TREEC.objects.link(ob); ob.location = (p.x, p.y, p.z - 0.1); ob.rotation_euler = (0, 0, VR.uniform(0, 6.283)); sc_ = VR.uniform(1.4, 2.1); ob.scale = (sc_, sc_, sc_ * VR.uniform(0.9, 1.25)); nh += 1
    PLACED.append((f'SHRUB {k_}', ob.matrix_basis.copy(), 'shrub'))
log('trees', nt_, 'hedge shrubs', nh)
def GAME_INSTANCES():
    """career_lib.export() calls this after saving the .blend: every tree as GPU instances in distance tiers (perf.js `~lo-hi`, as Qingshan), hedges out to 400 m"""
    G_ = {}
    def add(mn, tag, m): G_.setdefault((mn, tag), []).append(m)
    for base, m, tier in PLACED:
        if tier == 'shrub': add(base, '~0-400', m)
        elif tier == 0: add(f'{base} LOD0', '~0-40', m); add(f'{base} LOD1', '~40-90', m); add(f'{base} CARD', '~90-1500', m)
        elif tier == 1: add(f'{base} LOD1', '~0-90', m); add(f'{base} CARD', '~90-1500', m)
        else: add(f'{base} CARD', '~0-1500', m)
    GC = bpy.data.collections.new('game instances'); bpy.context.scene.collection.children.link(GC); out = []
    for (mn, tag), ms in G_.items():
        quiet = 'CARD' in mn or mn.startswith('SHRUB'); e = bpy.data.objects.new(f"{'far_shore ' if quiet else ''}{mn} {tag}", None); GC.objects.link(e); out.append(e)      # main.js NO_CAST reads the prefix
        for k, m in enumerate(ms): c_ = bpy.data.objects.new(f'{mn}.{k:05d}', MASTER[mn]); GC.objects.link(c_); c_.parent = e; c_.matrix_world = m; out.append(c_)
    bpy.context.view_layer.update(); log('game instance sets', {f'{k[0]} {k[1]}': len(v) for k, v in G_.items()}); return out
VS.done(); AF.done()
