"""The morro's houses and streets, exec'd by build_morro.py after the ground (needs its ground_at, in_stretch, BD, SHELF, BEACH_Y and the 'MN ground' object).
What a hillside favela street looks like at night, from the road: houses three to five floors high, built a floor at a time, so a painted ground floor carries raw brick
upstairs; concrete frames (slab bands and corner columns) round the brick; small aluminium sliding windows with concrete sills, iron grilles low down; flat slab roofs with blue
fibreglass and grey cement water tanks, rebar left for the next floor, a corrugated lean-to; upper floors reaching out over the pavement. Narrow stairways climb between them.
Down on the flat the same street grammar turns to the avenue's (painted fronts, more shops, a floor or two more) and, along the orla, to the beach front's tall blocks.
Concrete poles carry a tangle of wires and an orange sodium lamp on an arm over the road. Ground floors on the corners are bars and shops with their roller shutters up.
The web budget goes where a driver looks: every house is planned first, then each wall and roof is tested with rays from the road (both lanes and the middle, at a driver's
and the chase camera's height, stopped by the ground and the other houses). A wall seen within 30 m gets frames, grilles and balconies; within 70 m sills; farther only
glass and lit rooms; a wall never seen is one plain quad. Everything takes its own seeded stream (KR), so the layout holds."""
from mathutils.bvhtree import BVHTree
KR = random.Random(31)
TX = H / 'tex'; LT = ROOT / 'tracks' / 'llano' / 'tex'
def emit_mat(name, png=None, col=(1, 1, 1), strength=1.0, rough=0.5):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P = nt.nodes['Principled BSDF']; P.inputs['Base Color'].default_value = (0.02, 0.02, 0.02, 1); P.inputs['Roughness'].default_value = rough
    if png: it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(png); nt.links.new(it.outputs['Color'], P.inputs['Emission Color'])
    else: P.inputs['Emission Color'].default_value = (*col, 1)
    P.inputs['Emission Strength'].default_value = strength
    return m
def clip_mat(name, png, rough=0.5):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except AttributeError: pass
    nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = image(png)
    nt.links.new(it.outputs['Color'], P.inputs['Base Color']); P.inputs['Roughness'].default_value = rough
    gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5; nt.links.new(it.outputs['Alpha'], gt.inputs[0]); nt.links.new(gt.outputs[0], P.inputs['Alpha'])
    return m
MAT.update({
    'brick': material('MN | clay brick', tex='medieval_red_brick', vcol=True),
    'dplaster': material('MN | broken render', tex='damaged_plaster', vcol=True),
    'yplaster': material('MN | ochre paint', tex='yellow_plaster', vcol=True),
    'bplaster': material('MN | blue paint', tex='blue_plaster_weathered', vcol=True),
    'rplaster': material('MN | red paint', tex='red_plaster_weathered', vcol=True),
    'pplaster': material('MN | pink paint', tex='peeling_painted_wall', vcol=True),
    'wplaster': material('MN | white render', tex='white_plaster_02', vcol=True),
    'gplaster': material('MN | grey render', tex='worn_plaster_wall', vcol=True),
    'conc': material('MN | concrete frame', tex='dirty_concrete', vcol=True),
    'shutter': material('MN | roller shutter', tex='rusted_shutter', vcol=True),
    'door': material('MN | steel door', tex='painted_metal_shutter', vcol=True),
    'corr': material('MN | corrugated', tex='rusty_corrugated_iron', vcol=True),
    'fibre': material('MN | cement tank', tex='brushed_concrete', vcol=True),
    'tank': material('MN | fibreglass tank', tex='white_plaster_02', vcol=True),
    'iron': material('MN | iron', (0.03, 0.03, 0.03), 0.55, 0.5),
    'alu': material('MN | aluminium', (0.42, 0.43, 0.44), 0.4, 0.8),
    'glass': material('MN | window glass', (0.01, 0.012, 0.016), 0.08),
    'cable': material('MN | cable', (0.01, 0.01, 0.01), 0.6),
    'fence': clip_mat('MN | fence', LT / 'fence.png'),
    'grille': clip_mat('MN | grille', TX / 'grille.png', 0.55),      # iron bars as a cut-out: one quad where each bar was a box
    'wglow': emit_mat('MN window glow night', TX / 'window_night.png', strength=1.6),
    'signs': emit_mat('MN | signs', TX / 'signs.png', strength=2.2),
    'shopglow': emit_mat('MN | shop light', col=(1.0, 0.9, 0.75), strength=1.4),
    'lamp': emit_mat('MN lamp glow night', col=(1.0, 0.62, 0.28), strength=14.0),
})
UVS.update({'brick': 2.2, 'dplaster': 3.0, 'yplaster': 3.0, 'bplaster': 3.0, 'rplaster': 3.0, 'pplaster': 3.0, 'wplaster': 2.5, 'gplaster': 3.0, 'conc': 2.5, 'shutter': 2.5,
            'door': 1.6, 'corr': 2.0, 'fibre': 1.5, 'tank': 1.5, 'iron': 2.0, 'alu': 2.0})
class Sheet:
    """one mesh of several materials, vertex colour per face"""
    def __init__(s, name, keys): s.name, s.keys, s.bm = name, keys, bmesh.new(); s.vc = vcol_layer(s.bm); s.uv = s.bm.loops.layers.uv.verify(); s.fixed = []
    def face(s, pts, k, col=(1, 1, 1), uv=None):
        f = s.bm.faces.new([s.bm.verts.new(p) for p in pts]); f.material_index = s.keys.index(k); f.normal_update()
        if uv is None:      # world UVs at the material's real scale: flat faces by x, y; walls along their own direction, so a house at any angle keeps square bricks
            sc = UVS.get(k, 3.0); n = f.normal
            if abs(n.z) > 0.6: uv = [(p[0] / sc, p[1] / sc) for p in pts]
            else: hx, hy = -n.y, n.x; L_ = math.hypot(hx, hy) or 1.0; uv = [((p[0] * hx + p[1] * hy) / L_ / sc, p[2] / sc) for p in pts]
        for l, u in zip(f.loops, uv): l[s.vc] = (*col, 1); l[s.uv].uv = u
        return f
    def box(s, P, x0, x1, y0, y1, z0, z1, k, col=(1, 1, 1), top=True, bottom=False, sides=(1, 1, 1, 1)):
        """an axis box in the house frame P(x, y, z): front y0 faces the road; sides = (front y0, right x1, back y1, left x0)"""
        c = [P(x, y, z) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]      # 0..3 bottom: (x0,y0) (x1,y0) (x0,y1) (x1,y1); 4..7 top
        F = [((0, 1, 5, 4), sides[0]), ((1, 3, 7, 5), sides[1]), ((3, 2, 6, 7), sides[2]), ((2, 0, 4, 6), sides[3])]
        for q, on in F:
            if on: s.face([c[v] for v in q], k, col)
        if top: s.face([c[4], c[5], c[7], c[6]], k, col)
        if bottom: s.face([c[0], c[2], c[3], c[1]], k, col)
    def cyl(s, c, r, z0, z1, k, col=(1, 1, 1), n=10, cap=True):
        for q in range(n):
            a0, a1 = 2 * math.pi * q / n, 2 * math.pi * (q + 1) / n
            s.face([c + Vector((r * math.cos(a0), r * math.sin(a0), z0)), c + Vector((r * math.cos(a1), r * math.sin(a1), z0)), c + Vector((r * math.cos(a1), r * math.sin(a1), z1)), c + Vector((r * math.cos(a0), r * math.sin(a0), z1))], k, col)
        if cap: s.face([c + Vector((r * math.cos(2 * math.pi * q / n), r * math.sin(2 * math.pi * q / n), z1)) for q in range(n)], k, col)
    def done(s): return mesh_obj(s.name, s.bm, s.keys, planar=False)
HOUSE_KEYS = ['brick', 'dplaster', 'yplaster', 'bplaster', 'rplaster', 'pplaster', 'wplaster', 'gplaster', 'conc', 'shutter', 'door', 'corr', 'fibre', 'tank', 'iron', 'alu', 'glass', 'grille']
HS = Sheet('MN houses', HOUSE_KEYS)
DBG = None
if os.environ.get('MORRO_DEBUG'):      # review only: the blocks the sight test calls never seen, in magenta, to check none is
    MAT['dbg'] = emit_mat('MN debug unseen', col=(1, 0, 1), strength=3.0); DBG = Sheet('MN debug unseen', ['dbg'])
GW = Sheet('MN window glow night', ['wglow']); SG = Sheet('MN signs', ['signs', 'shopglow']); LG = Sheet('MN lamp glow night', ['lamp']); WI = Sheet('MN wires', ['cable'])
ST_ = Sheet('MN street', ['conc', 'iron', 'alu', 'fence', 'fibre'])
LAMPS = []; UPV_ = Vector((0, 0, 1))
PAINT = ['yplaster', 'bplaster', 'rplaster', 'pplaster', 'wplaster', 'gplaster', 'dplaster']
TINTS = {'yplaster': [(1, 0.95, 0.85), (1, 0.8, 0.62), (0.95, 1, 0.8)], 'bplaster': [(1, 1, 1), (0.8, 0.95, 1.05), (0.7, 1.0, 0.85)], 'rplaster': [(1, 1, 1), (1, 0.85, 0.75)],
         'pplaster': [(1, 1, 1), (0.95, 0.8, 0.95)], 'wplaster': [(1, 1, 1), (0.95, 0.92, 0.85), (0.85, 0.9, 1.0)], 'gplaster': [(1, 1, 1), (0.95, 0.9, 0.8)], 'dplaster': [(1, 1, 1), (0.9, 0.88, 0.85)]}
def tone(): t = KR.uniform(0.78, 1.0); return (t, t * KR.uniform(0.96, 1.0), t * KR.uniform(0.92, 1.0))
def mul(a, b): return tuple(x * y for x, y in zip(a, b))
N_WIN = [0, 0]
def wall_quad(P, x0, x1, y, z0, z1, k, col=(1, 1, 1), uv=None): HS.face([P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)], k, col, uv)
def grille(P, x0, x1, y, z0, z1):
    """bars a hand's width out from the wall (the cut-out, 14 cm apart) and three flat rails across them"""
    w, h = x1 - x0, z1 - z0; wall_quad(P, x0, x1, y, z0, z1, 'grille', uv=[(0, 0), (w / 0.56, 0), (w / 0.56, h / 0.14), (0, h / 0.14)])
    for zq in (z0 + 0.02, (z0 + z1) / 2, z1 - 0.02): wall_quad(P, x0, x1, y - 0.01, zq - 0.015, zq + 0.015, 'iron')
def window(P, x, z, w, h, col, det, grilled, y=0.0):
    """a window on the face y (the house's front y0, or a side or back mapped to it by P): dark glass a little proud, a lit shell over it at night;
    det 2: a concrete sill; det 3: the aluminium frame and, low down, the grille"""
    g = 0.025
    wall_quad(P, x - w / 2, x + w / 2, y - g, z, z + h, 'glass')
    N_WIN[1] += 1
    if KR.random() < 0.46:
        N_WIN[0] += 1; cu, row, flip = KR.randrange(8), (0 if KR.random() < 0.65 else 1), KR.random() < 0.5
        u0, u1 = ((cu + 0.02) / 8, (cu + 0.98) / 8); u0, u1 = (u1, u0) if flip else (u0, u1); v0, v1 = (0.51, 0.99) if row == 0 else (0.01, 0.49)
        GW.face([P(x - w / 2, y - g - 0.012, z), P(x + w / 2, y - g - 0.012, z), P(x + w / 2, y - g - 0.012, z + h), P(x - w / 2, y - g - 0.012, z + h)], 'wglow', uv=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    if det >= 2:      # the sill: its face and its top
        HS.box(P, x - w / 2 - 0.12, x + w / 2 + 0.12, y - 0.14, y + 0.02, z - 0.1, z - 0.02, 'conc', mul(col, (0.85, 0.85, 0.85)), sides=(1, 0, 0, 0))
    if det >= 3:
        f = 0.05
        for x0, x1, z0, z1 in ((x - w / 2, x - w / 2 + f, z, z + h), (x + w / 2 - f, x + w / 2, z, z + h), (x - w / 2, x + w / 2, z + h - f, z + h), (x - f / 2, x + f / 2, z, z + h)):
            wall_quad(P, x0, x1, y - 0.06, z0, z1, 'alu')
        if grilled: grille(P, x - w / 2, x + w / 2, y - 0.15, z - 0.02, z + h + 0.02)
SIGN_CELLS = 16
def shop(P, x0, x1, z, col, cell, det):
    """a ground floor open for business: the shutter rolled up to its box, a lit room behind, the sign over it"""
    w = x1 - x0; hh = 2.6
    HS.box(P, x0, x1, -0.05, 0.0, z + hh, z + hh + 0.4, 'shutter', (0.6, 0.6, 0.6), sides=(1, 0, 0, 0))      # the shutter's box
    SG.face([P(x0 + 0.1, 0.4, z), P(x1 - 0.1, 0.4, z), P(x1 - 0.1, 0.4, z + hh), P(x0 + 0.1, 0.4, z + hh)], 'shopglow')
    if det >= 2:
        for xs_ in (x0, x1 - 0.1): HS.box(P, xs_, xs_ + 0.1, -0.02, 0.4, z, z + hh, 'conc', col, top=False)      # the jambs
        HS.box(P, x0, x1, -0.02, 0.4, z + hh - 0.02, z + hh, 'conc', col, top=False, bottom=True, sides=(1, 0, 0, 0))
    cu, cv = cell % 2, cell // 2; sw = min(w - 0.4, 3.6); sh = sw / 4; xc = (x0 + x1) / 2
    SG.face([P(xc - sw / 2, -0.12, z + hh + 0.5), P(xc + sw / 2, -0.12, z + hh + 0.5), P(xc + sw / 2, -0.12, z + hh + 0.5 + sh), P(xc - sw / 2, -0.12, z + hh + 0.5 + sh)], 'signs',
            uv=[(cu / 2 + 0.004, 1 - (cv + 1) / 8 + 0.004), ((cu + 1) / 2 - 0.004, 1 - (cv + 1) / 8 + 0.004), ((cu + 1) / 2 - 0.004, 1 - cv / 8 - 0.004), (cu / 2 + 0.004, 1 - cv / 8 - 0.004)])
    HS.box(P, xc - sw / 2 - 0.05, xc + sw / 2 + 0.05, -0.1, 0.0, z + hh + 0.45, z + hh + 0.55 + sh, 'iron', top=True, bottom=True, sides=(1, 1, 0, 1))
N_HOUSE = [0, 0]
STYLE = {      # frontage width, depth, floors, chance of a shop, and the walls' paints: a favela house, the avenue's mixed fronts, the beach front's blocks
    'hill': ((3.6, 7.5), (6.0, 10.0), [2, 3, 3, 4, 4, 5], 0.3),
    'avenue': ((5.0, 10.0), (8.0, 12.0), [3, 3, 4, 4, 5, 6], 0.6),
    'tower': ((14.0, 22.0), (12.0, 16.0), [8, 9, 10, 11, 12, 14], 0.4),
}
def house(h):
    """h: a planned house (put). O: the front's centre at the ground floor's level; ex along the frontage (front faces -ey); V: what the road sees of its front, right, back
    and left walls (0 never, 1 far, 2 within 70 m, 3 within 30 m); RF the same for its roof"""
    O, ex, w, d, dr, V, RF, floors, FH, style = h['O'], h['ex'], h['w'], h['d'], h['dr'], h['V'], h['RF'], h['floors'], h['FH'], h['style']
    ey = Vector((-ex.y, ex.x, 0)); UP = Vector((0, 0, 1)); P = lambda x, y, z: O + ex * x + ey * y + UP * z
    base = KR.choice(PAINT + PAINT + ['brick', 'brick', 'brick']) if style == 'hill' else KR.choice(PAINT + PAINT + ['brick']) if style == 'avenue' else KR.choice(['wplaster', 'wplaster', 'gplaster', 'yplaster', 'bplaster', 'conc'])
    side = 'brick' if style == 'hill' and KR.random() < 0.7 else base
    col = mul(KR.choice(TINTS.get(base, [(1, 1, 1)])), tone()); zt = floors * FH
    gz = h['gz']; lo = min(gz) if gz else 0.0      # the lowest ground under the footprint, relative to O
    foot_z = lo - 0.4 if lo < -0.15 else 0.0
    if max(V) == 0 and RF == 0:      # never seen from the road: a plain block keeps the skyline whole
        if DBG: DBG.box(P, -w / 2, w / 2, 0, d, foot_z, zt, 'dbg')
        else: HS.box(P, -w / 2, w / 2, 0, d, foot_z, zt, side, tone())
        N_HOUSE[1] += 1; return zt
    seen = tuple(int(v > 0) for v in V); unseen = tuple(int(v == 0) for v in V)
    if any(unseen): HS.box(P, -w / 2, w / 2, 0, d, foot_z, zt, side, tone(), top=False, sides=unseen)      # each unseen wall is one quad, foot to roof
    if lo < -0.15:      # a stepped plinth down the slope: concrete columns with brick between
        HS.box(P, -w / 2, w / 2, 0, d, lo - 0.4, 0.0, 'brick', tone(), top=False, sides=seen)
        if V[0] >= 2:
            for xq in (-w / 2, w / 2 - 0.25): HS.box(P, xq, xq + 0.25, -0.03, 0.22, lo - 0.4, 0.0, 'conc', tone(), top=False, sides=(1, 1, 0, 1))
    ov = 0.0
    for fl in range(floors):
        z0 = fl * FH; k = base if fl == 0 or style != 'hill' or KR.random() < 0.7 else 'brick'; c = col if k == base else tone()
        if fl >= 1 and style == 'hill' and V[0] >= 2 and KR.random() < 0.35: ov = KR.uniform(0.5, 1.0)      # reaching out over the pavement
        y0 = -ov if fl >= 1 else 0.0
        if V[0] or V[2]: HS.box(P, -w / 2, w / 2, y0, d, z0, z0 + FH, k, c, top=False, sides=(seen[0], 0, seen[2], 0))
        if V[1] or V[3]: HS.box(P, -w / 2, w / 2, y0, d, z0, z0 + FH, side, tone(), top=False, sides=(0, seen[1], 0, seen[3]))
        HS.box(P, -w / 2 - 0.05, w / 2 + 0.05, y0 - 0.05, d + 0.05, z0 + FH - 0.18, z0 + FH + 0.02, 'conc', tone(), top=False, bottom=fl >= 1 and y0 < 0 and V[0] > 0, sides=seen)      # the slab's edge
        if k == 'brick' and V[0] >= 2:      # the concrete frame round the brick
            for xq in (-w / 2 - 0.03, w / 2 - 0.22): HS.box(P, xq, xq + 0.25, y0 - 0.03, y0 + 0.25, z0, z0 + FH - 0.18, 'conc', tone(), top=False, sides=(1, 1, 0, 1))
        if V[0]:      # the front: a door or a shop below, windows above
            nwin = max(1, int(w / 3.0))
            if fl == 0 and h['shop'] is not None and w > 3.2: shop(P, -w / 2 + 0.2, w / 2 - 0.2, 0.0, c, h['shop'], V[0])
            else:
                for q in range(nwin):
                    xc = -w / 2 + (q + 0.5) * w / nwin
                    if fl == 0 and q == nwin - 1 and V[0] >= 2:
                        if dr < SHELF and KR.random() < 0.4:      # a bare bulb over the door, the street's own light between the lamps
                            bp = P(xc, y0 - 0.25, 2.45); LG.face([bp + ex * -0.06 + UPV_ * -0.06, bp + ex * 0.06 + UPV_ * -0.06, bp + ex * 0.06 + UPV_ * 0.06, bp + ex * -0.06 + UPV_ * 0.06], 'lamp')
                            HS.box(P, xc - 0.02, xc + 0.02, y0 - 0.25, y0, 2.5, 2.54, 'iron', sides=(1, 1, 0, 1)); LAMPS.append((bp, '#ffd29a', 3.5))
                        wall_quad(P, xc - 0.45, xc + 0.45, y0 - 0.04, 0.0, 2.1, 'door', mul(KR.choice([(0.35, 0.5, 0.75), (0.75, 0.3, 0.25), (0.4, 0.6, 0.4), (0.9, 0.9, 0.85), (0.3, 0.3, 0.32)]), tone()))
                        continue
                    ww, wh = (KR.choice([1.2, 1.5, 1.0]), 1.0) if KR.random() < 0.8 else (0.6, 0.6)
                    window(P, xc + KR.uniform(-0.2, 0.2), z0 + (1.1 if wh > 0.7 else 1.6), ww, wh, c, V[0], grilled=(fl == 0 and dr < 30) or (fl == 1 and KR.random() < 0.3), y=y0)
        if V[2]:      # the back, as the roads above look down on it: fewer, smaller windows
            Pb = lambda x, y, z: P(-x, d - y, z)
            for q in range(max(1, int(w / 3.6))):
                if KR.random() < 0.75: window(Pb, -w / 2 + (q + 0.5) * w / max(1, int(w / 3.6)) + KR.uniform(-0.2, 0.2), z0 + 1.1, KR.choice([1.0, 1.2]), 1.0, tone(), min(V[2], 2), False)
        if style != 'hill':      # a block stands free: windows down every side the road sees
            for sx in (-1, 1):
                vs = V[1] if sx > 0 else V[3]
                if not vs: continue
                Ps2 = (lambda x, y, z: P(w / 2 - y, d / 2 + x, z)) if sx > 0 else (lambda x, y, z: P(-w / 2 + y, d / 2 - x, z)); ns = max(1, int(d / 3.2))
                for q in range(ns): window(Ps2, -d / 2 + (q + 0.5) * d / ns, z0 + 1.1, 1.2, 1.0, tone(), min(vs, 2), False)
        elif d > 6 and KR.random() < 0.6:      # one window on a side, where the neighbour leaves a gap
            sx = KR.choice((-1, 1)); vs = V[1] if sx > 0 else V[3]
            Ps2 = (lambda x, y, z: P(w / 2 - y, d / 2 + x, z)) if sx > 0 else (lambda x, y, z: P(-w / 2 + y, d / 2 - x, z))
            if vs: window(Ps2, KR.uniform(-1, 1), z0 + 1.1, 1.0, 1.0, tone(), min(vs, 2), False)
        if fl >= 1 and V[0] >= 3 and KR.random() < 0.25 and ov == 0:      # a balcony with an iron rail
            bw = w - 1.0
            HS.box(P, -bw / 2, bw / 2, -0.9, 0.0, z0 - 0.15, z0 + 0.02, 'conc', tone(), bottom=True, sides=(1, 1, 0, 1))
            HS.box(P, -bw / 2, bw / 2, -0.92, -0.88, z0 + 0.95, z0 + 1.0, 'iron', sides=(1, 1, 0, 1)); grille(P, -bw / 2, bw / 2, -0.9, z0, z0 + 0.96)
    # the roof: a slab, a low parapet or the next floor's start, water tanks, sometimes a lean-to
    yb = -ov; near_ = max(max(V), RF)
    HS.box(P, -w / 2, w / 2, yb, d, zt - 0.02, zt, 'conc', tone(), sides=seen)
    r = KR.random()
    if r < 0.4:
        HS.box(P, -w / 2, w / 2, yb, yb + 0.14, zt, zt + 0.9, base if base != 'brick' else 'brick', col, sides=(seen[0], 0, 1, 0))
        for sx in (-1, 1): HS.box(P, sx * w / 2 - (0.14 if sx > 0 else 0), sx * w / 2 + (0.14 if sx < 0 else 0), yb, d, zt, zt + 0.9, side, tone(), sides=(0, 1, seen[2], 1))
    elif r < 0.7 and style == 'hill':      # the next floor begun: a few courses of brick, rebar out of the columns
        hb = KR.uniform(0.3, 1.4)
        HS.box(P, -w / 2, w / 2, yb, yb + 0.12, zt, zt + hb, 'brick', tone()); HS.box(P, -w / 2, -w / 2 + 0.12, yb, d * KR.uniform(0.4, 1), zt, zt + hb, 'brick', tone())
        if near_ >= 3:
            for xq in (-w / 2 + 0.1, w / 2 - 0.1):
                for yq in (yb + 0.1, d - 0.1): HS.box(P, xq - 0.008, xq + 0.008, yq - 0.008, yq + 0.008, zt, zt + KR.uniform(0.6, 1.1), 'iron', top=False, sides=(1, 1, 0, 0))
    if r > 0.82 and RF and style == 'hill':      # a corrugated lean-to over the back of the roof, on posts, falling to the back
        y1 = d * KR.uniform(0.4, 0.6); h0, h1 = 2.1, 1.7
        if RF >= 2:
            for xq in (-w / 2 + 0.1, w / 2 - 0.2):
                for yq, hq in ((y1, h0), (d - 0.1, h1)): HS.box(P, xq, xq + 0.1, yq - 0.1, yq, zt, zt + hq, 'iron', top=False)
        HS.face([P(-w / 2, y1 - 0.2, zt + h0), P(w / 2, y1 - 0.2, zt + h0), P(w / 2, d + 0.2, zt + h1), P(-w / 2, d + 0.2, zt + h1)], 'corr', tone())
        HS.face([P(-w / 2, d + 0.2, zt + h1 - 0.02), P(w / 2, d + 0.2, zt + h1 - 0.02), P(w / 2, y1 - 0.2, zt + h0 - 0.02), P(-w / 2, y1 - 0.2, zt + h0 - 0.02)], 'corr', tone())
    for q in range(KR.choice([1, 1, 1, 2]) if style != 'tower' else 2):      # the water tank on its stand
        c_ = P(KR.uniform(-w / 2 + 0.9, w / 2 - 0.9), KR.uniform(d * 0.5, d - 0.9), zt)
        if near_ >= 2: HS.box(lambda x, y, z: c_ + Vector((x, y, z)), -0.6, 0.6, -0.6, 0.6, 0.0, 0.7, 'conc', tone())
        blue = KR.random() < 0.65; rr = KR.uniform(0.55, 0.72) * (1.6 if style == 'tower' else 1.0); n_ = 10 if near_ >= 3 else 6
        HS.cyl(c_, rr, 0.7 if near_ >= 2 else 0.0, 1.55, 'tank' if blue else 'fibre', (0.12, 0.32, 0.78) if blue else (0.7, 0.7, 0.68), n=n_)
        HS.cyl(c_, rr * 1.03, 1.55, 1.68, 'tank' if blue else 'fibre', (0.1, 0.28, 0.7) if blue else (0.6, 0.6, 0.58), n=n_)
    N_HOUSE[0] += 1
    return zt

# ------------------------------------------------------------------------------------------------ planning them: rows along each side of every street, then deeper rows up the hill
OCC = set(); PLAN = []
def foot(O, ex, w, d, pad=-0.15):      # negative: neighbours may touch
    ey = Vector((-ex.y, ex.x, 0)); cells = set()
    for a in np.arange(-w / 2 - pad, w / 2 + pad + 0.01, 0.4):
        for b in np.arange(-pad, d + pad + 0.01, 0.4):
            p = O + ex * a + ey * b; cells.add((int(math.floor(p.x * 2)), int(math.floor(p.y * 2))))      # half-metre cells
    return cells
def clear_of_road(O, ex, w, d, need):
    ey = Vector((-ex.y, ex.x, 0))
    for a in (-w / 2, 0, w / 2):
        for b in (0, d / 2, d):
            p = O + ex * a + ey * b
            if near(p.x, p.y)[1] < need: return False
    return True
def ground_under(O, ex, w, d):
    ey = Vector((-ex.y, ex.x, 0)); return [ground_at(*(O + ex * a + ey * b).to_2d()) for a in (-w / 2, 0, w / 2) for b in (0, d)]
def put(O, ex, w, d, dr, shop_cell=None, need=None, style='hill'):
    """plan a house if its footprint is free: neighbours may share a wall, never overlap"""
    cells = foot(O, ex, w, d)
    if cells & OCC or not clear_of_road(O, ex, w, d, need): return False
    OCC.update(cells); gz = ground_under(O, ex, w, d)
    if dr > SHELF: O.z = max(gz) + 0.05
    fl = STYLE[style][2]; floors = KR.choice(fl) if dr < 60 else KR.choice([1, 2, 2, 3, 3, 4])
    PLAN.append(dict(O=O.copy(), ex=ex.copy(), w=w, d=d, dr=dr, shop=shop_cell, gz=[g - O.z for g in gz], floors=floors, FH=KR.uniform(2.65, 3.0), style=style))
    return True
ROOFS = []
DROP = set()      # (station, side) where the street's edge looks down over roofs
def beach_side(i, sd): return CL[i].y < -200 and (NL[i] * sd).y < -0.5      # the orla's sea side: sand, no houses
# the corners (turn-in, apex, outside), and the plots the race takes from the frontage: the light towers' squares and the teams' pit garages before the line
CORN = [(c['n'], c['at'] - c['radius'] * math.radians(c['turn']) / 2, c['at'], 1 if c['hand'] == 'R' else -1) for c in SRC['corners']]
CORN = [c for c in CORN if in_stretch(st(c[2]))]
MASTS = [(st(apex), sd) for n_, tin, apex, sd in CORN] + [(st(tin - 60), sd) for n_, tin, apex, sd in CORN]
GARAGE = (LAP - 112.0, LAP - 16.0)
RESERVE = [(i, sd, 5.0) for i, sd in MASTS] + ([(st((GARAGE[0] + GARAGE[1]) / 2), -1, (GARAGE[1] - GARAGE[0]) / 2 + 2)] if in_stretch(st(GARAGE[0])) else [])
def reserved(i, sd, half): return any(sd_ == sd and abs(((i - j + N // 2) % N) - N // 2) * STEP < half + h_ for j, sd_, h_ in RESERVE)
def front_row(sd):
    """the street's own frontage, wall to wall on the pavement's edge, an alley or a stairway now and then"""
    s_ = 0.0
    while s_ < LAP:
        i0 = st(s_); style = 'tower' if CL[i0].y < -215 else 'avenue' if CL[i0].z < 4.5 else 'hill'
        (wa, wb), (da, db), _, p_shop = STYLE[style]
        w = KR.uniform(wa, wb); i = st(s_ + w / 2); s_ += w + (KR.uniform(1.3, 2.0) if KR.random() < 0.1 else KR.uniform(0.0, 0.12))
        if not in_stretch(i) or beach_side(i, sd) or reserved(i, sd, w / 2): continue
        ex = T[i].to_3d() * sd; ex.normalize()      # along the frontage, so the front (-ey = -left of ex) faces the road
        O = off(i, sd * (SHELF - 0.6)); O.z = CL[i].z + 0.15
        bk = off(i, sd * (SHELF + 14))
        if ground_at(bk.x, bk.y) < CL[i].z - 3.5: DROP.add((i, sd)); continue
        put(O, ex, w, KR.uniform(da, db), SHELF - 0.6, shop_cell=(KR.randrange(SIGN_CELLS) if KR.random() < p_shop else None), need=BD[sd][i] + 1.2, style=style)
for sd in (1, -1): front_row(sd)
N_FRONT = len(PLAN); log('front rows', N_FRONT)
def fill(size_w, size_d, spacing, reach=150.0):
    """the hill behind: houses packed into every free plot of the morro, each squared to its nearest street and facing it"""
    i0, i1 = st(STRETCH[0]) if STRETCH else 0, st(STRETCH[1]) if STRETCH else N
    pts = [CL[i] for i in range(i0, i1)]; x0, x1 = min(p.x for p in pts) - reach, max(p.x for p in pts) + reach; y0, y1 = min(p.y for p in pts) - reach, max(p.y for p in pts) + reach
    cand = [(x, y) for x in np.arange(x0, x1, spacing) for y in np.arange(y0, y1, spacing)]; KR.shuffle(cand)
    for x, y in cand:
        x += KR.uniform(-spacing / 3, spacing / 3); y += KR.uniform(-spacing / 3, spacing / 3); i, dr = near(x, y)
        if not (SHELF + 2 < dr < reach) or not in_stretch(i) or ground_at(x, y) < 4.0: continue      # the flat is the city's (morro_city.py)
        sd = 1 if (Vector((x, y, 0)) - CL[i]).to_2d().dot(NL[i].to_2d()) > 0 else -1
        ex = T[i].to_3d() * sd; ex.rotate(Matrix.Rotation(KR.uniform(-0.12, 0.12), 3, 'Z')); ex.normalize(); ey = Vector((-ex.y, ex.x, 0))
        w, d = KR.uniform(*size_w), KR.uniform(*size_d); O = Vector((x, y, 0)) - ey * (d / 2)
        put(O, ex, w, d, dr, need=SHELF - 0.5)
fill((4.5, 8.0), (5.5, 9.0), 4.0); n1 = len(PLAN)
fill((3.2, 5.0), (3.5, 6.0), 2.5); log('hill houses', n1 - N_FRONT, '+ small', len(PLAN) - n1)

# ------------------------------------------------------------------------------------------------ what the road sees: rays from the lanes to every wall and roof, stopped by the ground and the houses
def hframe(h):
    ex = h['ex']; ey = Vector((-ex.y, ex.x, 0)); O = h['O']; return lambda x, y, z: O + ex * x + ey * y + Vector((0, 0, z))
BV_V, BV_F = [], []
gme = bpy.data.objects['MN ground'].data; BV_V += [v.co.copy() for v in gme.vertices]; BV_F += [tuple(p.vertices) for p in gme.polygons]
for h in PLAN:
    P = hframe(h); w, d = h['w'], h['d']; z0, z1 = min(h['gz'] + [0.0]) - 0.4, h['floors'] * h['FH'] + 0.9; b = len(BV_V)
    BV_V += [P(x, y, z) for z in (z0, z1) for y in (0, d) for x in (-w / 2, w / 2)]
    BV_F += [tuple(b + v for v in q) for q in ((0, 1, 5, 4), (1, 3, 7, 5), (3, 2, 6, 7), (2, 0, 4, 6), (4, 5, 7, 6), (0, 2, 3, 1))]
BV = BVHTree.FromPolygons(BV_V, BV_F, all_triangles=False)
EYE = np.array([list(off(i, lat, hz)) for i in range(0, N, 4) for lat in (-3.5, 0.0, 3.5) for hz in (1.2, 3.4)])      # a driver's eye and the chase camera, every 10 m
N_RAYS = [0]
def sight(samples, n_=None):
    """3 if the road sees one of the samples within 30 m, 2 within 70 m, 1 farther (to 280 m), 0 never. n_: the wall's outward normal; None: a roof (eyes above it)"""
    c = np.array(samples[0]); v = EYE - c; dist = np.sqrt((v * v).sum(1))
    ok = (dist < 280) & ((EYE[:, 2] > c[2] + 0.5) if n_ is None else ((v @ np.array(n_)) > 0.12 * dist))
    idx = np.nonzero(ok)[0]
    if not len(idx): return 0
    idx = idx[np.argsort(dist[idx])]; pick = list(idx[:8]) + (list(idx[8::max(1, (len(idx) - 8) // 8)][:8]) if len(idx) > 8 else [])
    best = 1e9; nv = n_ if n_ is not None else Vector((0, 0, 1))
    for s in samples:
        o = s + nv * 0.3
        for e in pick:
            if dist[e] >= best: break
            dv = Vector(EYE[e]) - o; L_ = dv.length; N_RAYS[0] += 1
            if BV.ray_cast(o, dv / L_, L_ - 0.3)[0] is None: best = dist[e]; break
    return 0 if best > 1e8 else 3 if best < 30 else 2 if best < 70 else 1
for h in PLAN:
    P = hframe(h); w, d = h['w'], h['d']; H_ = h['floors'] * h['FH']; ex = h['ex']; ey = Vector((-ex.y, ex.x, 0))
    h['V'] = [sight([P(0, 0, 0.85 * H_), P(-0.33 * w, 0, 0.5 * H_), P(0.33 * w, 0, 0.5 * H_), P(0, 0, 0.2 * H_)], -ey),
              sight([P(w / 2, d / 2, 0.85 * H_), P(w / 2, 0.17 * d, 0.5 * H_), P(w / 2, 0.83 * d, 0.5 * H_), P(w / 2, d / 2, 0.2 * H_)], ex),
              sight([P(0, d, 0.85 * H_), P(-0.33 * w, d, 0.5 * H_), P(0.33 * w, d, 0.5 * H_), P(0, d, 0.2 * H_)], ey),
              sight([P(-w / 2, d / 2, 0.85 * H_), P(-w / 2, 0.17 * d, 0.5 * H_), P(-w / 2, 0.83 * d, 0.5 * H_), P(-w / 2, d / 2, 0.2 * H_)], -ex)]
    h['RF'] = sight([P(0, d / 2, H_ + 0.95), P(-0.3 * w, 0.25 * d, H_ + 0.95), P(0.3 * w, 0.75 * d, H_ + 0.95)])
VC = [0] * 4
for h in PLAN:
    for v in h['V']: VC[v] += 1
log('sight: rays', N_RAYS[0], 'walls by level 0-3', VC, 'roofs seen', sum(1 for h in PLAN if h['RF']), 'of', len(PLAN))
for q, h in enumerate(PLAN):
    h_ = house(h)
    if q < N_FRONT: ROOFS.append((h['O'].copy(), h['ex'].copy(), h['w'], h_))      # the street's own roofs: morro_decor.py puts its watchers there
log('houses', N_HOUSE[0], 'plain blocks (never seen)', N_HOUSE[1], 'windows lit', N_WIN[0], 'of', N_WIN[1])

# ------------------------------------------------------------------------------------------------ poles, wires, lamps
UPV = Vector((0, 0, 1))
def wire(a, b, sag):
    n_ = 5; pts = [a.lerp(b, q / n_) - UPV * (sag * 4 * (q / n_) * (1 - q / n_)) for q in range(n_ + 1)]
    for p0, p1 in zip(pts, pts[1:]):
        t_ = (p1 - p0).normalized(); sdv = t_.cross(UPV).normalized() * 0.012 if abs(t_.z) < 0.99 else Vector((0.012, 0, 0))
        WI.face([p0 - UPV * 0.012, p1 - UPV * 0.012, p1 + UPV * 0.012, p0 + UPV * 0.012], 'cable'); WI.face([p0 - sdv, p1 - sdv, p1 + sdv, p0 + sdv], 'cable')
POLES = []
def pole(i, sd, lamp=True):
    b = off(i, sd * (BD[sd][i] + 1.0), 0.15); ex = T[i].to_3d() * sd; nr = (NL[i] * sd).to_3d()      # nr = left of ex: boxes keep their faces outward on both sides
    P = lambda x, y, z: b + ex * x + nr * y + UPV * z
    for k in range(4):      # a tapered concrete pole, 10.5 m
        z0, z1 = k * 2.625, (k + 1) * 2.625; r0, r1 = 0.17 - 0.02 * k, 0.17 - 0.02 * (k + 1)
        ST_.face([P(-r0, -r0, z0), P(r0, -r0, z0), P(r1, -r1, z1), P(-r1, -r1, z1)], 'conc'); ST_.face([P(r0, -r0, z0), P(r0, r0, z0), P(r1, r1, z1), P(r1, -r1, z1)], 'conc')
        ST_.face([P(r0, r0, z0), P(-r0, r0, z0), P(-r1, r1, z1), P(r1, r1, z1)], 'conc'); ST_.face([P(-r0, r0, z0), P(-r0, -r0, z0), P(-r1, -r1, z1), P(-r1, r1, z1)], 'conc')
    ST_.box(P, -0.06, 0.06, -1.1, 1.1, 9.6, 9.75, 'iron')      # the crossarm, across the road's line
    if len(POLES) % 4 == 1: ST_.cyl(P(0, 0.45, 7.2), 0.38, 0.0, 1.1, 'fibre', n=10)      # a transformer
    POLES.append((i, sd, P))
    if not lamp: return
    # the lamp: an arm out over the road and a cobra head, its lens lit
    arm = [P(0, 0, 8.4), P(0, -1.2, 8.9), P(0, -2.4, 9.0)]
    for p0, p1 in zip(arm, arm[1:]): ST_.box(lambda x, y, z: p0 + (p1 - p0) * y + ex * x + UPV * z, -0.04, 0.04, 0, 1, -0.04, 0.04, 'alu')
    h = P(0, -2.75, 8.95); ST_.box(lambda x, y, z: h + ex * x + nr * y + UPV * z, -0.2, 0.2, -0.4, 0.4, -0.08, 0.1, 'alu', bottom=False)
    LG.face([h + ex * -0.16 + nr * -0.32 - UPV * 0.085, h + ex * 0.16 + nr * -0.32 - UPV * 0.085, h + ex * 0.16 + nr * 0.32 - UPV * 0.085, h + ex * -0.16 + nr * 0.32 - UPV * 0.085][::-1], 'lamp')
    LAMPS.append((h - UPV * 0.3, '#ffad5c', 0))
for sd_, s0_ in ((1, 0.0), (-1, 17.0)):      # poles both sides, staggered, each with its lamp: one every ~17 m, alternating sides
    s_ = s0_
    while s_ < LAP:
        i = st(s_)
        if in_stretch(i) and RW[i] > 22: pole(i, sd_)
        s_ += KR.uniform(30, 38)
POLES.sort(key=lambda p: (p[1], p[0]))
for (i, sd, P), (j, sd2, Q) in zip(POLES, POLES[1:]):
    if (j - i) * STEP > 60: continue
    for e in (-0.8, 0.8): wire(P(0, e, 9.75), Q(0, e, 9.75), 0.35)
    for z, e in ((7.8, -0.15), (7.4, 0.15), (6.6, 0.05)):
        if sd == sd2: wire(P(0, e, z), Q(0, e, z), KR.uniform(0.4, 0.9))
    if beach_side(i, -sd): continue      # nothing across to the sand
    for q in range(KR.randrange(0, 3)):      # drops across the road to the houses opposite
        tgt = off((i + KR.randrange(-3, 4)) % N, -sd * (SHELF + 0.5), KR.uniform(4.5, 7.5)); wire(P(0, 0, KR.choice((6.4, 6.9, 7.4))), tgt, 0.5)
log('poles', len(POLES), 'lamps', len(LAMPS))

# ------------------------------------------------------------------------------------------------ the street: debris fence round the outside of the bends; a parapet and rail where the ground falls away
def outside(i, sd): return any(K[(i + q) % N] * sd < 0 and R[(i + q) % N] < 130 for q in range(-24, 25, 4))
for sd in (1, -1):
    for i in range(0, N, 2):
        if not in_stretch(i): continue
        j = (i + 2) % N
        if outside(i, sd):
            a, b = off(i, sd * (BD[sd][i] + 0.3), 0.95), off(j, sd * (BD[sd][j] + 0.3), 0.95); L_ = (b - a).length
            ST_.face([a, b, b + UPV * 2.6, a + UPV * 2.6], 'fence', uv=[(0, 0), (L_, 0), (L_, 2.6), (0, 2.6)])
            if i % 4 == 0: ST_.box(lambda x, y, z: a + Vector((x, y, z)), -0.03, 0.03, -0.03, 0.03, -0.9, 2.65, 'iron', top=False)
        if (i, sd) in DROP or ((i + 1) % N, sd) in DROP or ((i - 1) % N, sd) in DROP:
            a, b = off(i, sd * SHELF, 0.15), off(j, sd * SHELF, 0.15); g_ = min(ground_at(*a.to_2d()), ground_at(*b.to_2d())) - CL[i].z
            ST_.face([a + UPV * (g_ - 1.0), b + UPV * (g_ - 1.0), b + UPV * 0.6, a + UPV * 0.6], 'conc'); ST_.face([a + UPV * 0.6, b + UPV * 0.6, b + UPV * 0.6 + (b - a).cross(UPV).normalized() * 0.2 * sd, a + UPV * 0.6 + (b - a).cross(UPV).normalized() * 0.2 * sd], 'conc')
            ST_.box(lambda x, y, z: a + Vector((x, y, z)), -0.025, 0.025, -0.025, 0.025, 0.6, 1.1, 'iron', top=False); ST_.face([a + UPV * 1.08, b + UPV * 1.08, b + UPV * 1.12, a + UPV * 1.12], 'iron')
for s in (HS, ST_) + ((DBG,) if DBG else ()): s.done()      # WI and SG stay open for morro_decor.py (festoons, kiosks), GW and LG for morro_city.py
