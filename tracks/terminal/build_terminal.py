"""North Sea Terminal: a flat, walled qualifying circuit through a container terminal on a quay (track-viewer/docs/10x/maps-spec.md section 5), in one Blender pass.
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/maps/tracks/terminal/build_terminal.py -Log <abs log>
    (-Rest --no-export,stretch: the hero stretch, the quay straight, one crane and the first canyon block, for review stills first)
Layout: track-viewer/docs/career-worlds/terminal.json (1.75 km, flat). Shared pieces: tracks/career_lib.py. Day and dusk only: no lights.json, nothing lit.
  road      15 m, kerbs below R140, jersey barriers 10 m out on the quay straight and 11 m elsewhere, a paved run-off strip between them (flush with the road),
            collision col_yard: paved underfoot, off the track for track limits
  yard      interlocking pavers: one constrained triangulation from the run-off edge out to 400 m (no overlap with the strip, nothing coplanar), a flat
            dirty-concrete ring to 3 km on the land side; the quay apron, seaworn capping and a 3 m quay wall 21.5 m north of the start straight, the sea 2.5 m down
  cranes    three ship-to-shore cranes, booms up, the road between their legs and outside both barriers: painted plate in two colours, welded ribs,
            8-wheel bogies, a stair tower, a cable reel, handrails, a glazed cab, aviation bands
  boxes     ISO 40 ft, 20 ft and high-cube containers in rectilinear blocks (1-5 high), tinted by vertex colour over one grey ribbed diffuse, weathered in
            bands (foot line, rust, sun fade, dirty roof); the faces that see the road are detailed (corner posts, rails, doors), the rest are plain; reefer
            blocks at the reefer corner with walkway gantries; painted yard markings; a landside skyline of far blocks
  other     two transit sheds in the west yard, eight unlit high masts with ring headframes, bollards, fenders, hatch covers and lashing cages on the quay
  horizon   a breakwater 800 m out, the next terminal's cranes up the coast, a still wind farm 5-8 km out, a tank farm and industrial halls inland"""
import bpy, sys
from pathlib import Path
H = Path(globals().get('__file__') or sys.argv[sys.argv.index('-P') + 1]).resolve().parent; ID = 'terminal'; PFX = 'NT'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
assert H.resolve().parents[1] == ROOT and (ROOT / 'track-viewer').is_dir(), ROOT
assert H.name == ID, H
import numpy as np
from mathutils.geometry import delaunay_2d_cdt
from mathutils.bvhtree import BVHTree
ARGS = ','.join(ARGS).split(',')      # powershell -File hands `-Rest a,b` over as one argument
STRETCH = 'stretch' in ARGS; EXPORT = '--no-export' not in ARGS and not STRETCH
DL, QS, LL, TX = ROOT / 'tracks' / 'drylake' / 'tex', ROOT / 'tracks' / 'qingshan' / 'tex', ROOT / 'tracks' / 'llano' / 'tex', H / 'tex'
st = lambda s: int(round(s / STEP)) % N
IN_STRETCH = lambda i: not STRETCH or i * STEP >= LAP - 260 or i * STEP <= 560
BOW = max(CL[st(s)].y for s in range(-150, 180, 2))      # the spline bows the start straight up to 2 m seaward between its waypoints
assert abs(ang) < 2e-3 and min(CL[st(s)].y for s in range(-150, 180, 2)) > -0.6 and BOW < 2.5, ('the quay straight must run along +x', ang, BOW)

# ------------------------------------------------------------------------------------------------ derived diffuses: grey copies vertex colour tints
def derive(dst, src, mean):       # desaturate, scale to `mean`, save at 1k
    if dst.exists(): return
    TX.mkdir(exist_ok=True); im0 = image(src); w_, h_ = im0.size
    px = np.empty(w_ * h_ * 4, np.float32); im0.pixels.foreach_get(px); g = px.reshape(-1, 4)[:, :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    k_ = mean / g.mean()
    for _ in range(4): k_ *= mean / np.clip(g * k_, 0, 1).mean()       # the clip at white pulls the mean down: settle the gain
    o_ = np.ones((w_ * h_, 4), np.float32); o_[:, :3] = np.clip(g * k_, 0, 1)[:, None]
    im = bpy.data.images.new(dst.stem, w_, h_); im.pixels.foreach_set(o_.ravel()); im.scale(1024, 1024)
    im.filepath_raw = str(dst); im.file_format = 'JPEG'
    try: im.save(quality=92)
    except TypeError: im.save()
    log('derived', dst.name, 'mean', round(float(np.clip(g * k_, 0, 1).mean()), 3))
CT, PV = TX / 'container_grey_diff_1k.jpg', TX / 'pavers_grey_diff_1k.jpg'
derive(CT, PH / 'box_profile_metal_sheet' / 'box_profile_metal_sheet_diff_2k.jpg', 0.72)          # red-oxide sheet -> any container colour
derive(PV, PH / 'interlocking_concrete_pavers' / 'interlocking_concrete_pavers_diff_2k.jpg', 0.5)  # brown pavers -> the grey concrete of a port yard

MAT.update({
    'asphalt': material('NT | asphalt', tex='asphalt_track', rough=0.75, diff=DL / 'asphalt_track_bleached_diff_2k.jpg'),
    'line': material('NT | line white', tex='brushed_concrete', diff='none', vcol=True),
    'kerb_r': material('NT | kerb red', tex='brushed_concrete', diff=QS / 'kerb_red_diff.jpg'),
    'kerb_w': material('NT | kerb white', tex='brushed_concrete', diff=QS / 'kerb_white_diff.jpg'),
    'barrier': material('NT | barrier', tex='concrete_wall_009', vcol=True),
    'yard': material('NT | yard', tex='interlocking_concrete_pavers', diff=PV, vcol=True),
    'apron': material('NT | apron', tex='brushed_concrete'),
    'quay': material('NT | quay', tex='seaworn_stone_tiles'),
    'box': material('NT | box', tex='box_profile_metal_sheet', diff=CT, vcol=True),
    'crane': material('NT | crane', tex='brushed_concrete', diff=CT, vcol=True),
    'roof': material('NT | roof', tex='rusty_corrugated_iron'),
    'door': material('NT | roller door', tex='painted_metal_shutter'),
    'concrete': material('NT | concrete', tex='dirty_concrete'),
    'fender': material('NT | fender', (0.03, 0.03, 0.03), 0.3, diff=None),       # wet rubber at the waterline, and the crane cabs' dark glass
    'water': material('NT | sea', (0.04, 0.07, 0.07), 0.09),
    'far': material('NT | far yard', tex='dirty_concrete', vcol=True),
})
_n = MAT['fender'].node_tree; _t = _n.nodes.new('ShaderNodeTexImage'); _t.image = image(LL / 'rubber.png'); _n.links.new(_t.outputs['Color'], _n.nodes['Principled BSDF'].inputs['Base Color'])
_c = MAT['crane'].node_tree; _P = _c.nodes['Principled BSDF']      # painted plate, not sheet cladding: smooth, a little sheen, the concrete's grain only as faint unevenness
for _l in [l for l in _c.links if l.to_socket in (_P.inputs['Roughness'], _P.inputs['Metallic'])]: _c.links.remove(_l)
_P.inputs['Roughness'].default_value = 0.45; _P.inputs['Metallic'].default_value = 0.0; _c.nodes['Normal Map'].inputs['Strength'].default_value = 0.05
UVS.update({'asphalt': 3.5, 'kerb_r': 2.5, 'kerb_w': 2.5, 'yard': 4.0, 'apron': 4.0, 'quay': 3.0, 'box': 2.0, 'crane': 6.0, 'roof': 3.0, 'door': 5.0,
            'concrete': 3.0, 'fender': 2.0, 'far': 30.0})
QUAY = lambda i: i * STEP >= LAP - 250 or i * STEP <= 150
road(7.5, 140)
barriers(lambda i: 10.0 if QUAY(i) else 11.0)
paint(f'{PFX} lines', lambda co: (0.62, 0.62, 0.6, 1))      # the line material takes its white from the vertices
def bcol(co):       # pale precast concrete, grime at the foot, each 6 m unit a shade apart (the sky turned bare grey concrete navy in shade)
    i, _ = near(co.x, co.y); j = 1 + 0.05 * fbm(int(i * STEP / 6) * 0.37 + 0.11, 2.3, 2); g = 1 - ss(-0.05, 0.25, co.z - CL[i].z)
    return tuple(j * (a + (b_ - a) * g) for a, b_ in ((0.97, 0.6), (0.95, 0.58), (0.9, 0.55))) + (1,)
paint(f'{PFX} barriers', bcol)
def side_clear(x, y):      # metres beyond the barrier on this point's side (negative: inside the walls)
    i, d = near(x, y); sd = 1 if (Vector((x, y, 0)) - CL[i]).to_2d().dot(NL[i].to_2d()) > 0 else -1
    return d - BD[sd][i], i

# ------------------------------------------------------------------------------------------------ helpers: axis boxes with chosen faces, oriented beams
CF = {'-x': (0, 4, 6, 2), '+x': (1, 3, 7, 5), '-y': (0, 1, 5, 4), '+y': (2, 6, 7, 3), '-z': (0, 2, 3, 1), '+z': (4, 5, 7, 6)}      # vertex k = x + 2y + 4z, outward
def cbox(bm, lo, hi, skip=(), col=None, vc=None, mi=0):
    v = [bm.verts.new((hi[0] if k & 1 else lo[0], hi[1] if k & 2 else lo[1], hi[2] if k & 4 else lo[2])) for k in range(8)]; out = []
    for nm, q in CF.items():
        if nm in skip: continue
        f = bm.faces.new([v[k] for k in q]); f.material_index = mi; out.append(f)
        if col:
            for l in f.loops: l[vc] = col
    return out
def beam3(bm, a, b_, w, h, col=None, vc=None):      # a box from a to b, w across (horizontal) and h across (the other way)
    t = (b_ - a).normalized(); s = Vector((0, 0, 1)).cross(t)
    s = Vector((1, 0, 0)) if s.length < 1e-6 else s.normalized(); u = t.cross(s); L = (b_ - a).length
    v = [bm.verts.new(a + s * (w / 2 if k & 1 else -w / 2) + u * (h / 2 if k & 2 else -h / 2) + t * (L if k & 4 else 0)) for k in range(8)]
    for q in CF.values():
        f = bm.faces.new([v[k] for k in q])
        if col:
            for l in f.loops: l[vc] = col

# ------------------------------------------------------------------------------------------------ the paved run-off strip and the yard: one constrained triangulation
bm = bmesh.new(); vc = vcol_layer(bm); paved_col = []
def ytone(co): t = 0.9 + 0.06 * fbm(co.x / 40, co.y / 40, 3) + 0.03 * fbm(co.x / 6, co.y / 6, 2); return (t, 0.99 * t, 0.96 * t, 1)
LOOP = {}
for sd in (1, -1):
    rows = [[off(i, sd * HW, -0.03), off(i, sd * (BD[sd][i] + 1.0), -0.07)] for i in range(N)]       # 3 cm under the road edge: no step to catch a wheel
    for f in strip(bm, rows, 0, rev=sd < 0):
        for l in f.loops: l[vc] = ytone(l.vert.co)
    paved_col += [[rows[i][0].copy(), rows[(i + 1) % N][0].copy(), rows[(i + 1) % N][1].copy(), rows[i][1].copy()][::sd] for i in range(N)]
    LOOP[sd] = [r[1] for r in rows]
QY = BOW + 21.5; AP = QY - 9        # the straight quay edge 21.5 m north of the road's most seaward point, and the landward edge of the apron
assert max(p.y for p in LOOP[1]) < AP - 0.1 and max(p.y for p in LOOP[-1]) < AP - 0.1, 'the run-off reaches the quay apron'
G24 = 24.0; X0 = math.floor((min(xs) - 400) / G24) * G24 - 0.37; X1 = X0 + G24 * math.ceil((max(xs) + 400 - X0) / G24)      # off round x: a lattice line on x 0 put the start line's run-off ray on a triangle edge
NYB = int(math.ceil((AP - (min(ys) - 400)) / G24)); Y0 = AP - NYB * G24; Y1 = AP; CX, CY = (X0 + X1) / 2, (Y0 + Y1) / 2
XL = [X0 + G24 * k for k in range(int(round((X1 - X0) / G24)) + 1)]; YL_ = [Y0 + G24 * k for k in range(NYB + 1)]
pts, edges, nloop = [], [], 0
for sd in (1, -1):
    base = len(pts); pts += [(p.x, p.y) for p in LOOP[sd]]; edges += [(base + k, base + (k + 1) % N) for k in range(N)]
nloop = len(pts)
rect = [(x, Y0) for x in XL[:-1]] + [(X1, y) for y in YL_[:-1]] + [(x, Y1) for x in XL[:0:-1]] + [(X0, y) for y in YL_[:0:-1]]
base = len(pts); pts += rect; edges += [(base + k, base + (k + 1) % len(rect)) for k in range(len(rect))]
for x in XL[1:-1]:
    for y in YL_[1:-1]:
        if side_clear(x, y)[0] > 4: pts.append((x, y))      # lattice points clear of the run-off: no slivers against its edge
cv, ce, cf, cov, coe, cof = delaunay_2d_cdt([Vector(p) for p in pts], edges, [], 0, 1e-5, True)
LA = {sd: np.array([[p.x, p.y] for p in LOOP[sd]]) for sd in (1, -1)}
def pip(P, A):
    xi, yi = A[:, 0], A[:, 1]; xj, yj = np.roll(xi, -1), np.roll(yi, -1); dy_ = np.where(yj == yi, 1e-9, yj - yi)
    c = (yi[None] > P[:, 1, None]) != (yj[None] > P[:, 1, None]); xint = xi[None] + (P[:, 1, None] - yi[None]) * ((xj - xi) / dy_)[None]
    return np.count_nonzero(c & (P[:, 0, None] < xint), axis=1) % 2 == 1
cen = np.array([[sum(cv[k].x for k in f) / 3, sum(cv[k].y for k in f) / 3] for f in cf])
keep = ~(pip(cen, LA[1]) & ~pip(cen, LA[-1]))       # the outer run-off edge is the left loop (the lap runs clockwise), the inner one the right
VZ = [-0.07 if any(o < nloop for o in cov[k]) else -0.12 for k in range(len(cv))]
GV = [bm.verts.new((cv[k].x, cv[k].y, VZ[k])) for k in range(len(cv))]
ng = 0
for f, kp in zip(cf, keep):
    if not kp: continue
    q = [GV[k] for k in f]
    if (q[1].co - q[0].co).cross(q[2].co - q[0].co).z < 0: q = q[::-1]
    fc = bm.faces.new(q); fc.material_index = 0; ng += 1
    for l in fc.loops: l[vc] = ytone(l.vert.co)
    if min(side_clear(v.co.x, v.co.y)[0] for v in q) < 46: paved_col.append([v.co.copy() for v in q])
for v in [v for v in GV if not v.link_faces]: bm.verts.remove(v)
YBVH = BVHTree.FromBMesh(bm)        # the paving's height, for the yard markings
mesh_obj(f'{PFX} yard', bm, ['yard'])
log('yard', ng, 'triangles, rect', X0, X1, Y0, Y1)

# ------------------------------------------------------------------------------------------------ far ring (land side) and the quay along its whole length
def steps(a, sign, to):      # grid lines out from a, 24 m growing by 1.3 each, to `to`
    out, d = [], G24
    while True:
        a += sign * d; d *= 1.3
        if sign * (a - to) >= 0: out.append(to); return out
        out.append(a)
FXL = steps(X0, -1, CX - 3000)[::-1] + XL + steps(X1, 1, CX + 3000); FYL = steps(Y0, -1, CY - 3000)[::-1] + YL_
bm = bmesh.new(); vc = vcol_layer(bm)
FV = [[bm.verts.new((x, y, -0.12)) for x in FXL] for y in FYL]
for r in range(len(FYL) - 1):
    for c in range(len(FXL) - 1):
        if X0 <= FXL[c] < X1 and Y0 <= FYL[r] < Y1: continue       # the near yard
        f = bm.faces.new([FV[r][c], FV[r][c + 1], FV[r + 1][c + 1], FV[r + 1][c]])
        for l in f.loops: co = l.vert.co; t = 0.82 + 0.1 * fbm(co.x / 500, co.y / 500, 3); l[vc] = (t, t, 0.97 * t, 1)
for v in [v for row in FV for v in row if not v.link_faces]: bm.verts.remove(v)
mesh_obj(f'{PFX} far yard', bm, ['far'])
bm = bmesh.new(); bq = bmesh.new()
for x0, x1 in zip(FXL, FXL[1:]):
    bm.faces.new([bm.verts.new(p) for p in ((x0, AP, -0.12), (x1, AP, -0.12), (x1, QY - 2, -0.12), (x0, QY - 2, -0.12))])       # apron
    bq.faces.new([bq.verts.new(p) for p in ((x0, QY - 2, 0.15), (x1, QY - 2, 0.15), (x1, QY, 0.15), (x0, QY, 0.15))])          # capping
    bq.faces.new([bq.verts.new(p) for p in ((x1, QY - 2, -0.12), (x1, QY - 2, 0.15), (x0, QY - 2, 0.15), (x0, QY - 2, -0.12))])
    bq.faces.new([bq.verts.new(p) for p in ((x0, QY, -3.12), (x0, QY, 0.15), (x1, QY, 0.15), (x1, QY, -3.12))])                # the wall, into the sea
bmesh.ops.remove_doubles(bq, verts=bq.verts, dist=0.001); mesh_obj(f'{PFX} quay', bq, ['quay'])
BA = bm       # the apron mesh also takes the crane rails
SEA = -0.12 - 2.5
bs = bmesh.new()
for a in range(8):
    for c in range(18):     # out to 9 km: the wind farm stands on it, not on the sky past its edge
        x0, x1, y0, y1 = CX - 4000 + 1000 * a, CX - 3000 + 1000 * a, QY + 500 * c, QY + 500 * (c + 1)
        bs.faces.new([bs.verts.new((x, y, SEA)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))])
bmesh.ops.remove_doubles(bs, verts=bs.verts, dist=0.01); mesh_obj(f'{PFX} sea', bs, ['water'])

# ------------------------------------------------------------------------------------------------ bollards and fenders on the quay
BC, BF = bmesh.new(), bmesh.new()
for k in range(int((X1 - X0) / 25)):
    x = X0 + 12.5 + 25 * k; c = Vector((x, QY - 0.7, 0.15)); cyl(BC, c, 0.28, 0.24, 0.55, n=10); cyl(BC, c + Vector((0, 0, 0.55)), 0.36, 0.36, 0.14, n=10)
for k in range(int((X1 - X0) / 20)):
    x = X0 + 10 + 20 * k; cbox(BF, (x - 1.0, QY, -2.9), (x + 1.0, QY + 0.35, -0.35), skip=('-y',))

# ------------------------------------------------------------------------------------------------ ship-to-shore cranes: booms up, the road between the legs
CRANE_AT = [35, 100, 165] if not STRETCH else [35]      # the spec's 40 / 110 / 180 put the last bogie into the hairpin entry
XC = [CL[st(s)].x for s in CRANE_AT]
bd_r = max(BD[-1][st(s)] for s in range(int(min(CRANE_AT)) - 40, int(max(CRANE_AT)) + 14, 2))
YLR = -(bd_r + 0.6 + 0.4 + 1.25); YSR = YLR + 30.5      # the landward rail 0.4 m behind the barrier's back, the 30.5 m gauge from it
assert YSR + 1.25 <= QY - 2, ('the seaward legs reach the capping', YSR)
log('crane rails at', round(YLR, 2), round(YSR, 2), '(the spec: -11.25 / +19.25 with the barrier at 10; the landward legs there would touch the barrier)')
BCR = bmesh.new(); vcr = vcol_layer(BCR)
for xc in XC:
    for xo in (-8, 8):
        for yr in (YLR, YSR):
            for x_, y_ in ((xc + xo + dx, yr + dy) for dx in (-4, 4) for dy in (-1, 1)):
                assert side_clear(x_, y_)[0] > 0.9, ('a crane bogie inside the walls', x_, y_)
xr0, xr1 = min(XC) - 40, max(XC) + 14
for yr in (YLR, YSR):
    assert all(side_clear(x_, yr - 0.6 * s_)[0] > 0.6 for x_ in np.arange(xr0, xr1, 2.0) for s_ in (-1, 1)), ('a crane rail inside the walls', yr)
    cbox(BA, (xr0, yr - 0.6, -0.14), (xr1, yr + 0.6, 0.06), skip=('-z',))
PA, PB, PR, PY, PK, CD = (0.86, 0.86, 0.83, 1), (0.22, 0.36, 0.52, 1), (0.66, 0.1, 0.07, 1), (0.8, 0.6, 0.1, 1), (0.2, 0.2, 0.2, 1), (0.62, 0.63, 0.62, 1)
# off-white structure, blue machinery and boom, aviation red, safety yellow, dark running gear, grey fittings
def wheel(bm, c, r, w, axis, col, n=12):        # a capped cylinder about a horizontal axis ('x' or 'y')
    R_ = [[bm.verts.new(c + (Vector((s, r * math.cos(a), r * math.sin(a))) if axis == 'x' else Vector((r * math.cos(a), s, r * math.sin(a)))))
           for a in (2 * math.pi * k / n for k in range(n))] for s in (-w / 2, w / 2)]
    fs = [bm.faces.new([R_[0][k], R_[0][(k + 1) % n], R_[1][(k + 1) % n], R_[1][k]]) for k in range(n)] + [bm.faces.new(R_[0][::-1]), bm.faces.new(R_[1])]
    for f in fs:
        for l in f.loops: l[vcr] = col
def bands(a, b_, w, h, n, c0, c1):      # a beam in n equal bands of two colours
    for k in range(n): beam3(BCR, a + (b_ - a) * (k / n), a + (b_ - a) * ((k + 1) / n), w, h, c0 if k % 2 == 0 else c1, vcr)
def rail(a, b_, step, col=PY):          # a handrail 1 m over the line a-b: posts every `step` m, a top rail and a knee rail
    L = (b_ - a).length; n = max(1, round(L / step))
    for k in range(n + 1): p = a + (b_ - a) * (k / n); beam3(BCR, p, p + Vector((0, 0, 1.0)), 0.06, 0.06, col, vcr)
    for dz in (0.5, 1.0): beam3(BCR, a + Vector((0, 0, dz)), b_ + Vector((0, 0, dz)), 0.05, 0.05, col, vcr)
YA, YB = YLR - 3.5, YLR - 0.5       # the stair tower's flights run between these, all of it landward of the rail
for xc in XC:
    for x_, y_ in ((xc - 11.3, YA - 1.0), (xc - 11.3, YB + 1.0), (xc - 9.3, YB + 1.0)): assert side_clear(x_, y_)[0] > 0.9, ('a stair tower inside the walls', x_, y_)
for n_, xc in enumerate(XC):
    pa = tuple(c * (1 + 0.02 * (n_ - 1)) for c in PA[:3]) + (1,)      # three cranes, three paint ages
    B = lambda lo, hi, sk=(), col=pa: cbox(BCR, lo, hi, sk, col, vcr)
    for xo in (-8, 8):
        xl = xc + xo
        for yr in (YLR, YSR):
            B((xl - 3.6, yr - 0.55, 1.45), (xl + 3.6, yr + 0.55, 2.6), ('-z',), PK)            # equaliser beam on two 4-wheel trucks
            for xt in (xl - 2.0, xl + 2.0):
                B((xt - 1.75, yr - 0.7, 0.8), (xt + 1.75, yr + 0.7, 1.45), (), PK)
                for xw in (-1.2, -0.4, 0.4, 1.2): wheel(BCR, Vector((xt + xw, yr, 0.51)), 0.45, 0.3, 'y', PK, n=10)
            B((xl - 1.25, yr - 1.25, 2.6), (xl + 1.25, yr + 1.25, 40), ('-z', '+z'))          # legs
            for z in np.arange(5.6, 39, 3.0): B((xl - 1.31, yr - 1.31, z), (xl + 1.31, yr + 1.31, z + 0.12))     # stiffener ribs: welded plate, not a smooth box
        B((xl - 1.25, YLR - 1.25, 40), (xl + 1.25, YSR + 1.25, 42.5))                        # portal beams over the road
        for y in np.arange(YLR + 1.5, YSR - 1.2, 3.0): B((xl - 1.31, y, 39.94), (xl + 1.31, y + 0.12, 42.56))
        xh = xl + 1.15 * (1 if xo > 0 else -1); rail(Vector((xh, YLR - 1.2, 42.5)), Vector((xh, YSR + 1.2, 42.5)), 3.0)
    for yr in (YLR, YSR):
        B((xc - 9.25, yr - 1.0, 2.6), (xc + 9.25, yr + 1.0, 4.4))                            # sill beams
        for x in np.arange(xc - 4.5, xc + 4.6, 3.0): B((x, yr - 1.06, 2.54), (x + 0.12, yr + 1.06, 4.46))
        B((xc - 9.25, yr - 1.15, 40.2), (xc + 9.25, yr + 1.15, 42.3))                        # portal beams along the rail (inset: no face shared with the cross beams)
        yh = yr + 1.1 * (-1 if yr < 0 else 1); rail(Vector((xc - 9.2, yh, 42.3)), Vector((xc + 9.2, yh, 42.3)), 3.0)
        sg = 1 if yr < 0 else -1; beam3(BCR, Vector((xc - 6.8 * sg, yr, 6)), Vector((xc + 6.8 * sg, yr, 38.5)), 0.9, 0.9, pa, vcr)      # leg bracing
    wheel(BCR, Vector((xc + 3, YLR - 1.45, 3.5)), 2.0, 0.6, 'y', PB, n=16)                  # the power cable reel on the landward sill
    lv = [4.4 + 4 * k for k in range(10)]      # the stair tower on the landward leg: flights in two lanes, a landing every 4 m
    for k in range(9):
        xa_ = xc - 9.8 if k % 2 == 0 else xc - 10.75; y0_, y1_ = (YA, YB) if k % 2 == 0 else (YB, YA)
        beam3(BCR, Vector((xa_, y0_, lv[k])), Vector((xa_, y1_, lv[k + 1])), 0.9, 0.15, PK, vcr)
        xr_ = xa_ + (0.45 if k % 2 == 0 else -0.45); beam3(BCR, Vector((xr_, y0_, lv[k] + 1)), Vector((xr_, y1_, lv[k + 1] + 1)), 0.05, 0.05, PY, vcr)
    for k, z in enumerate(lv):
        ya_, yb_ = (YA - 1.0, YA) if k % 2 == 0 else (YB, YB + 1.0)
        B((xc - 11.2, ya_, z - 0.12), (xc - 9.35, yb_, z), (), PK)
        yo = ya_ if k % 2 == 0 else yb_; rail(Vector((xc - 11.2, yo, z)), Vector((xc - 9.4, yo, z)), 1.8)
    for x_ in (xc - 11.25, xc - 9.4):
        for y_, z0_ in ((YA - 1.0, 0.0), (YB + 1.0, 2.6)): beam3(BCR, Vector((x_, y_, z0_)), Vector((x_, y_, lv[-1])), 0.18, 0.18, PK, vcr)     # the rail side stands on the equaliser beam
    for xo in (-4, 4):
        B((xc + xo - 0.9, YLR - 26, 42.5), (xc + xo + 0.9, YSR + 2, 46), (), PB)            # trolley girders with the backreach
        hinge = Vector((xc + xo, YSR + 2, 44.2)); tip = hinge + Vector((0, math.cos(math.radians(80)), math.sin(math.radians(80)))) * 65
        beam3(BCR, hinge, hinge + (tip - hinge) * (50 / 65), 1.8, 2.6, PB, vcr)                # the boom, raised to 80 degrees
        bands(hinge + (tip - hinge) * (50 / 65), tip, 1.8, 2.6, 5, PR, pa)                    # aviation bands, 3 m each
        ap = Vector((xc + xo * 1.1, YSR - 4, 79))
        beam3(BCR, Vector((xc + xo * 1.5, YSR - 1, 46)), ap, 1.2, 1.2, PB, vcr)               # the apex frame
        beam3(BCR, ap, Vector((xc + xo, YLR - 12, 46)), 1.0, 1.0, PB, vcr)
        beam3(BCR, ap, hinge + (tip - hinge) * 0.62, 0.35, 0.35, PB, vcr)                    # luffing stays
    for k in range(4): B((xc - 5.5 + 2.75 * k, YSR - 5, 78), (xc - 2.75 + 2.75 * k, YSR - 3, 80.5), (), PR if k % 2 == 0 else pa)     # apex head
    for k in range(1, 7):
        p = Vector((0, YSR + 2, 44.2)) + Vector((0, math.cos(math.radians(80)), math.sin(math.radians(80)))) * (9.2 * k)
        beam3(BCR, Vector((xc - 3.1, p.y, p.z)), Vector((xc + 3.1, p.y, p.z)), 0.5, 0.5, PB, vcr)        # boom ties
    for yy in (YLR - 20, YLR + 2, YSR - 8): B((xc - 4.0, yy - 0.5, 43), (xc + 4.0, yy + 0.5, 45.5), (), PB)   # girder cross ties
    B((xc - 6, YLR - 26, 46), (xc + 6, YLR - 18, 52), ('-z',), PB)                          # machinery house
    B((xc - 3.4, YSR - 9, 46), (xc + 3.4, YSR - 3, 48.6), ('-z',), CD)                      # the trolley, parked
    B((xc - 0.4, YSR - 6.4, 42.2), (xc + 0.4, YSR - 5.6, 46), ('-z', '+z'), CD)             # the operator cab hung under it: a frame round dark glass set 5 cm back
    B((xc - 1.6, YSR - 7.5, 41.4), (xc + 1.6, YSR - 4.5, 42.2)); B((xc - 1.6, YSR - 7.5, 39.0), (xc + 1.6, YSR - 4.5, 39.9))
    for x_ in (xc - 1.6, xc + 1.44):
        for y_ in (YSR - 7.5, YSR - 4.66): B((x_, y_, 39.9), (x_ + 0.16, y_ + 0.16, 41.4), ('-z', '+z'))
    cbox(BF, (xc - 1.55, YSR - 7.45, 39.9), (xc + 1.55, YSR - 4.55, 41.4), ('-z', '+z'))
for yr in (YLR, YSR):       # rail end stops
    for xe, sg in ((xr0, 1), (xr1, -1)): cbox(BCR, (min(xe, xe + 0.8 * sg), yr - 0.5, 0.06), (max(xe, xe + 0.8 * sg), yr + 0.5, 1.0), ('-z',), PY, vcr)
mesh_obj(f'{PFX} fenders', BF, ['fender'])
LM = [{'name': 'Cranes', 'pos': to_game(Vector((XC[len(XC) // 2], YSR - 4, 80)))}]

# ------------------------------------------------------------------------------------------------ transit sheds and high-mast poles (west yard and yard aisles)
BX = bmesh.new(); vbx = vcol_layer(BX); BR, BD_ = bmesh.new(), bmesh.new(); BCO = BC
KEEP_OUT = []       # (x0, y0, x1, y1): no containers here
if not STRETCH:
    west = [CL[i] for i in range(N) if -230 < CL[i].y < -60 and CL[i].x < 0]; xw = min(p.x for p in west)
    for yc, wc in ((-95.0, (0.8, 0.78, 0.72)), (-175.0, (0.44, 0.56, 0.49))):        # cream-grey and faded green
        x0, x1, y0, y1 = xw - 11 - 1.6 - 8 - 30, xw - 11 - 1.6 - 8, yc - 30, yc + 30
        for x_, y_ in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)): assert side_clear(x_, y_)[0] > 6, ('a shed too close to the road', x_, y_)
        for f in cbox(BX, (x0, y0, -0.14), (x1, y1, 12), ('-z', '+z'), (1, 1, 1, 1), vbx):
            for l in f.loops: l[vbx] = tuple(a * (0.62 + 0.38 * ss(0.4, 3.5, l.vert.co.z)) for a in wc) + (1,)       # grime and splash toward the foot
        DY = (y0 + 9, y0 + 23, y0 + 37, y0 + 51)
        for k in range(1, 10):      # wall stiffeners every 6 m, the long walls
            yy = y0 + 6 * k
            if all(abs(yy - yd) > 3.3 for yd in DY): cbox(BX, (x1, yy - 0.05, 0.6), (x1 + 0.06, yy + 0.05, 11.9), ('-x', '-z'), tuple(0.8 * a for a in wc) + (1,), vbx)
            cbox(BX, (x0 - 0.06, yy - 0.05, 0.6), (x0, yy + 0.05, 11.9), ('+x', '-z'), tuple(0.8 * a for a in wc) + (1,), vbx)
        for xg_, sg in ((x0, -1), (x1, 1)):      # eaves gutters and downpipes every 12 m
            cbox(BX, (min(xg_ + 0.3 * sg, xg_ + 0.6 * sg), y0 - 0.5, 11.45), (max(xg_ + 0.3 * sg, xg_ + 0.6 * sg), y1 + 0.5, 11.75), (), CD, vbx)
            for yy in (y0 + 2, y0 + 16, y0 + 30, y0 + 44, y0 + 58): cbox(BX, (min(xg_ + 0.05 * sg, xg_ + 0.2 * sg), yy - 0.07, -0.1), (max(xg_ + 0.05 * sg, xg_ + 0.2 * sg), yy + 0.07, 11.5), ('-z',), CD, vbx)
        for yd in DY:       # door frames and canopies on steel brackets
            for ya_, yb_ in ((yd - 3.0, yd - 2.8), (yd + 2.8, yd + 3.0)): cbox(BX, (x1, ya_, -0.12), (x1 + 0.12, yb_, 6.25), ('-x', '-z'), CD, vbx)
            cbox(BX, (x1, yd - 3.0, 6.0), (x1 + 0.12, yd + 3.0, 6.25), ('-x',), CD, vbx)
            cbox(BX, (x1, yd - 3.3, 6.9), (x1 + 1.5, yd + 3.3, 7.05), ('-x',), CD, vbx)
            for yy in (yd - 3.0, yd + 3.0): beam3(BX, Vector((x1, yy, 6.3)), Vector((x1 + 1.4, yy, 6.95)), 0.08, 0.08, CD, vbx)
        cbox(BC, (x0 - 0.08, y0 - 0.08, -0.14), (x1 + 0.08, y0, 0.6), ('-z', '+y')); cbox(BC, (x0 - 0.08, y1, -0.14), (x1 + 0.08, y1 + 0.08, 0.6), ('-z', '-y'))     # a concrete plinth
        cbox(BC, (x0 - 0.08, y0, -0.14), (x0, y1, 0.6), ('-z', '+x'))
        for ya_, yb_ in zip((y0,) + tuple(yd + 3.0 for yd in DY), tuple(yd - 3.0 for yd in DY) + (y1,)): cbox(BC, (x1, ya_, -0.14), (x1 + 0.08, yb_, 0.6), ('-z', '-x'))
        ev = 12 - 2 / 15 * 0.5     # the roof plane runs through the wall tops: at 11.8 the walls and gables poked 13 cm through it
        rf = [BR.verts.new(p) for p in ((x0 - 0.5, y0 - 0.5, ev), (x0 - 0.5, y1 + 0.5, ev), ((x0 + x1) / 2, y1 + 0.5, 14), ((x0 + x1) / 2, y0 - 0.5, 14),
                                        (x1 + 0.5, y0 - 0.5, ev), (x1 + 0.5, y1 + 0.5, ev))]
        BR.faces.new([rf[0], rf[3], rf[2], rf[1]]); BR.faces.new([rf[3], rf[4], rf[5], rf[2]])
        for yg, o in ((y0, -1), (y1, 1)):
            f = BX.faces.new([BX.verts.new(p) for p in ((x0, yg, 12), ((x0 + x1) / 2, yg, 14), (x1, yg, 12))][::o])
            for l in f.loops: l[vbx] = (*wc, 1)
        for yd in (y0 + 9, y0 + 23, y0 + 37, y0 + 51):
            BD_.faces.new([BD_.verts.new(p) for p in ((x1 + 0.05, yd - 2.8, -0.12), (x1 + 0.05, yd + 2.8, -0.12), (x1 + 0.05, yd + 2.8, 6), (x1 + 0.05, yd - 2.8, 6))])
        KEEP_OUT.append((x0 - 8, y0 - 8, x1 + 8, y1 + 8))
    poles, tries = [], 0
    while len(poles) < 8 and tries < 20000:
        tries += 1; x, y = RNG.uniform(min(xs) - 60, max(xs) + 60), RNG.uniform(min(ys) - 60, -24)
        c_, _ = side_clear(x, y)
        if not 8 < c_ < 40 or any(math.hypot(x - a, y - b_) < 140 for a, b_ in poles) or any(a <= x <= c and b_ <= y <= d for a, b_, c, d in KEEP_OUT): continue
        poles.append((x, y))
    n0 = len(BCR.faces)
    for x, y in poles:      # 33 m high masts: a tapered shaft, a ring headframe of ten floods (unlit), the lowering winch's cabinet
        cyl(BC, Vector((x, y, -0.2)), 1.1, 1.0, 0.7, n=12)
        cyl(BCR, Vector((x, y, 0.5)), 0.55, 0.2, 33.0, n=12)
        cbox(BCR, (x + 0.5, y - 0.3, 1.2), (x + 0.9, y + 0.3, 2.1), (), CD, vcr)
        rg = [Vector((x + 1.6 * math.cos(a), y + 1.6 * math.sin(a), 33.6)) for a in (2 * math.pi * k / 12 for k in range(12))]
        for k in range(12): beam3(BCR, rg[k], rg[(k + 1) % 12], 0.12, 0.12, CD, vcr)
        for k in range(4): beam3(BCR, Vector((x, y, 33.4)), rg[3 * k], 0.1, 0.1, CD, vcr)
        for k in range(10):
            a = 2 * math.pi * k / 10 + 0.3; c = Vector((x + 1.7 * math.cos(a), y + 1.7 * math.sin(a), 33.3)); d = Vector((math.cos(a), math.sin(a), -0.7)).normalized()
            beam3(BCR, c, c + d * 0.25, 0.6, 0.4, CD, vcr)
        KEEP_OUT.append((x - 4, y - 4, x + 4, y + 4))
    for f in list(BCR.faces)[n0:]:
        for l in f.loops: l[vcr] = CD       # cyl() leaves the poles uncoloured
    log('poles', len(poles))

# ------------------------------------------------------------------------------------------------ the container yard
TINT = [((.25, .5, .62), 12), ((.72, .6, .38), 10), ((.5, .12, .32), 7), ((.78, .36, .12), 8), ((.12, .3, .2), 10), ((.42, .12, .1), 14),
        ((.12, .18, .32), 12), ((.5, .5, .5), 15), ((.85, .85, .83), 8)]       # muted line and lessor colours (teal, mustard, magenta, orange, green, maroon, navy, grey, white), no logos
RUST, ROOF, FADE = (.4, .22, .14), (.46, .4, .36), (.78, .78, .76)
def mix(a, b_, t): return tuple(x + (y - x) * t for x, y in zip(a[:3], b_[:3]))
def tint(reefer):
    if reefer and RNG.random() < 0.7: c = RNG.choice(((.86, .86, .84), (.84, .82, .74)))       # reefer white or cream
    else: c = RNG.choices([t for t, _ in TINT], [w for _, w in TINT])[0]
    j = RNG.uniform(0.94, 1.06); g = sum(c) / 3; c = [0.92 * (g + 0.78 * (a - g)) for a in c]       # muted: paint that has seen salt and sun
    if RNG.random() < 0.125: c = mix(c, RUST, 0.3)          # one box in eight has rusted through its paint
    if reefer: c = mix(c, (.45, .42, .38), 0.1)
    return tuple(min(1, a * j * RNG.uniform(0.98, 1.02)) for a in c) + (1,)
LB, WB_, HB, HC = 12.19, 2.44, 2.59, 2.896        # 40 ft, standard and high-cube
SIDE = {'-y': lambda lo, hi: ((lo[0], lo[1]), (hi[0], lo[1])), '+y': lambda lo, hi: ((hi[0], hi[1]), (lo[0], hi[1])),
        '+x': lambda lo, hi: ((hi[0], lo[1]), (hi[0], hi[1])), '-x': lambda lo, hi: ((lo[0], hi[1]), (lo[0], lo[1]))}      # each side's foot edge, outward
def quad(a, b_, z0, z1, c0, c1):        # an upright quad on the edge a-b from z0 to z1, coloured c0 at its foot and c1 at its head
    f = BX.faces.new([BX.verts.new((a[0], a[1], z0)), BX.verts.new((b_[0], b_[1], z0)), BX.verts.new((b_[0], b_[1], z1)), BX.verts.new((a[0], a[1], z1))])
    for l in f.loops: l[vbx] = (*(c0 if l.vert.co.z < (z0 + z1) / 2 else c1)[:3], 1)
def body(lo, hi, col, open_, top, near):
    """a container's shell. A side open to view is banded up from the foot: a dark foot line (so every tier still reads in shade), rust, then the paint
    fading in the sun toward the roof; a side 0.4 m from its neighbour is one quad darkening to the foot. The roof is dirty whatever the paint"""
    z0, z1 = lo[2], hi[2]
    for s, ends in SIDE.items():
        a, b_ = ends(lo, hi)
        if s in open_ and near < 12:       # past the third row from the road every side is one quad
            quad(a, b_, z0, z0 + 0.12, mix(col, (0, 0, 0), 0.7), mix(col, (0, 0, 0), 0.7))
            quad(a, b_, z0 + 0.12, z0 + 0.35, mix(col, RUST, 0.55), col)
            quad(a, b_, z0 + 0.35, z1, col, mix(col, FADE, 0.15))
        else: quad(a, b_, z0, z1, mix(col, (0, 0, 0), 0.55), col)
    if top:
        f = BX.faces.new([BX.verts.new((x, y, z1)) for x, y in ((lo[0], lo[1]), (hi[0], lo[1]), (hi[0], hi[1]), (lo[0], hi[1]))])
        for l in f.loops: l[vbx] = (*mix(col, ROOF, 0.75), 1)
NDOOR = [0]
def container(x, y, za, zb, L, door, covered, detailed, col, open_, near):
    xa, xb, ya, yb = x - L / 2, x + L / 2, y - WB_ / 2, y + WB_ / 2
    C = lambda lo, hi, sk, c_=col: cbox(BX, lo, hi, sk, c_, vbx)
    i = 0.03 if detailed else 0.0
    body((xa + i, ya + i, za), (xb - i, yb - i, zb - 2 * i / 3), col, open_, not covered, near)       # detailed: the roof panel 2 cm under the rails
    if detailed:
        p, d = 0.17, 0.12
        for px_, sx in ((xa, '+x'), (xb - p, '-x')):
            for py_, sy in ((ya, '+y'), (yb - p, '-y')): C((px_, py_, za), (px_ + p, py_ + p, zb), ('-z', '+z', sx, sy))       # corner posts
        for y0_, y1_, sy in ((ya, ya + d, '+y'), (yb - d, yb, '-y')):         # side rails, top and bottom
            C((xa + p, y0_, zb - 0.14), (xb - p, y1_, zb), ('-x', '+x', '-z', sy) + (('+z',) if covered else ()))
            if za < 0: C((xa + p, y0_, za), (xb - p, y1_, za + 0.16), ('-x', '+x', '-z', sy))      # above the ground tier the top rail below draws this band
        for x0_, x1_, sx in ((xa, xa + d, '+x'), (xb - d, xb, '-x')):         # end rails
            C((x0_, ya + p, zb - 0.14), (x1_, yb - p, zb), ('-y', '+y', '-z', sx) + (('+z',) if covered else ()))
            if za < 0: C((x0_, ya + p, za), (x1_, yb - p, za + 0.16), ('-y', '+y', '-z', sx))
    dk, mid = mix(col, (0, 0, 0), 0.65) + (1,), mix(col, (0, 0, 0), 0.35) + (1,)
    for sg, s in ((1, '+x'), (-1, '-x')):       # a door end open to view near the road: two leaves, four locking bars, the corner castings
        if s not in open_ or door != sg or near > 9: continue
        xe, xf = (xb, xb - i) if sg > 0 else (xa, xa + i); sk = '-x' if sg > 0 else '+x'; NDOOR[0] += 1
        X = lambda d0, d1, e=xe: (min(e + d0 * sg, e + d1 * sg), max(e + d0 * sg, e + d1 * sg))
        xa_, xb_ = X(-0.16, 0.02)
        for yy in (ya - 0.02, yb - 0.16): C((xa_, yy, zb - 0.16), (xb_, yy + 0.18, zb + 0.02), (), mid)       # castings proud of every face by 2 cm
        xa_, xb_ = X(0, 0.015, xf); C((xa_, y - 0.025, za + 0.1), (xb_, y + 0.025, zb - 0.1), (sk,), dk)            # the seam between the leaves
        xa_, xb_ = X(0, 0.04, xf)
        for yo in (-0.85, -0.3, 0.3, 0.85): C((xa_, y + yo - 0.025, za + 0.22), (xb_, y + yo + 0.025, zb - 0.22), (sk, '-z', '+z'), mid)
RB, BB, PXR, PYR, GXA, GYA = 7, 5, LB + 1.5, WB_ + 0.4, 12.0, 7.0      # rows across y, bays along x; the aisles between blocks
BWX, BWY = BB * PXR - 1.5, RB * PYR - 0.4
ir3 = st(next(c['at'] for c in SRC['corners'] if c['n'] == 3)); RC = CL[ir3]
slots, BLOCKS = {}, set()
for bx in range(int((X1 - X0) / (BWX + GXA))):
    for by in range(int((-18 - Y0) / (BWY + GYA))):
        bx0, by1 = X0 + bx * (BWX + GXA), -18 - by * (BWY + GYA); bcx, bcy = bx0 + BWX / 2, by1 - BWY / 2
        reefer = math.hypot(bcx - RC.x, bcy - RC.y) < 110
        for r in range(RB):
            for c in range(BB):
                x, y = bx0 + c * PXR + LB / 2, by1 - r * PYR - WB_ / 2
                cl = min(side_clear(x + dx * LB / 2, y + dy * WB_ / 2)[0] for dx in (-1, 0, 1) for dy in (-1, 0, 1))
                ic = side_clear(x, y)[1]
                if cl < 3 or cl > 42 or not IN_STRETCH(ic) or any(a - LB / 2 <= x <= c_ + LB / 2 and b_ - WB_ / 2 <= y <= d + WB_ / 2 for a, b_, c_, d in KEEP_OUT): continue
                slots[(bx, by, r, c)] = (x, y, cl, reefer, ic); BLOCKS.add((bx, by))
nbox = ndet = 0; GANT = set(); HT = {k: RNG.choices((1, 2, 3, 4, 5), (5, 12, 33, 38, 12))[0] for k in sorted(slots)}
TZ = {}         # each stack's tier tops: a quarter of the tiers high-cube, so tier lines stagger between neighbouring stacks
for k in sorted(slots):
    TZ[k] = [-0.14]
    for _ in range(HT[k]): TZ[k].append(TZ[k][-1] + (HC if RNG.random() < 0.25 else HB))
T20 = {k: not slots[k][3] and slots[k][2] < 16 and RNG.random() < 0.3 for k in sorted(slots)}       # 30 % of the dry slots near the road hold two 20 ft boxes
NBR = {'-y': (1, 0), '+y': (-1, 0), '+x': (0, 1), '-x': (0, -1)}      # side -> (dr, dc)
for key, (x, y, cl, reefer, ic) in sorted(slots.items()):
    bx, by, r, c = key; zs = TZ[key]; h = len(zs) - 1
    ntop = {s: TZ[(bx, by, r + dr, c + dc)][-1] if (bx, by, r + dr, c + dc) in TZ else None for s, (dr, dc) in NBR.items()}
    exposed = None in ntop.values()
    v = CL[ic] - Vector((x, y, 0)); toward = (bx, by, r, c + (1 if v.x > 0 else -1)) if abs(v.x) > abs(v.y) else (bx, by, r - (1 if v.y > 0 else -1), c)
    det = toward not in slots and cl < 13       # the face toward the road is open: the line a driver sees gets posts and rails
    ends = [sg for sg, s in ((1, '+x'), (-1, '-x')) if ntop[s] is None]
    door = ends[0] if len(ends) == 1 and RNG.random() < 0.6 else RNG.choice((1, -1))
    zc = -1e9 if exposed else min(ntop.values()); k0 = sum(1 for z in zs[1:] if z <= zc + 1e-6)      # tiers below every neighbour's top show only down the 0.4 m slits: one box for them
    assert not (k0 and det), 'a hidden stack is never detailed'
    if k0: cbox(BX, (x - LB / 2, y - WB_ / 2, zs[0]), (x + LB / 2, y + WB_ / 2, zs[k0]), ('-z',) + (('+z',) if k0 < h else ()), tint(reefer), vbx)
    for k in range(k0, h):      # every tier that can be seen is its own box with its own tint, out to the last row
        za, zb = zs[k], zs[k + 1]; op = {s for s, t in ntop.items() if t is None or t < zb - 0.05}
        parts = [(x - 3.065, 6.06, op - {'+x'}), (x + 3.065, 6.06, op - {'-x'})] if T20[key] else [(x, LB, op)]
        for xp, L, o in parts: container(xp, y, za, zb, L, door, k < h - 1, det, tint(reefer), o, cl)
        if reefer and cl < 25:      # the machinery end faces the plug rack: a dark grille panel and a cable box
            for sg in ((1,) if c in (1, 3) else (-1,) if c in (2, 4) else ()):
                xe = x + sg * LB / 2; xa_, xb_ = min(xe, xe + 0.05 * sg), max(xe, xe + 0.05 * sg)
                cbox(BX, (xa_, y - 0.95, za + 0.3), (xb_, y + 0.95, zb - 0.35), (), (0.24, 0.24, 0.23, 1), vbx)
                cbox(BX, (min(xe, xe + 0.2 * sg), y + 0.6, za + 0.4), (max(xe, xe + 0.2 * sg), y + 0.9, za + 0.7), (), (0.3, 0.3, 0.29, 1), vbx)
        ndet += det
    nbox += h
    if reefer and c in (1, 3): GANT.add((bx, by, c))
log('containers', nbox, 'in', len(slots), 'slots;', ndet, 'detailed;', NDOOR[0], 'door ends')
for bx, by, c in sorted(GANT):        # plug-rack gantries in the bay gap after bay c: a 1 m walkway at each tier between posts every 6 m, rails, a stair at one end
    rows = [r for r in range(RB) if (bx, by, r, c) in slots or (bx, by, r, c + 1) in slots]
    if not rows: continue
    bx0, by1 = X0 + bx * (BWX + GXA), -18 - by * (BWY + GYA); xg = bx0 + (c + 1) * PXR - 0.75
    ya_, yb_ = by1 - max(rows) * PYR - WB_ - 0.6, by1 - min(rows) * PYR + 0.6
    if min(side_clear(xg, yy)[0] for yy in (ya_, yb_)) < 3: continue
    npost = max(2, round((yb_ - ya_) / 6) + 1)
    for q in range(npost):
        yy = ya_ + (yb_ - ya_) * q / (npost - 1)
        cbox(BC, (xg - 0.7, yy - 0.3, -0.2), (xg + 0.7, yy + 0.3, 0.3), ('-z',))
        for xs_ in (xg - 0.5, xg + 0.5): cbox(BCR, (xs_ - 0.1, yy - 0.1, 0.3), (xs_ + 0.1, yy + 0.1, 11.4), ('-z',), CD, vcr)
    for zt in (2.59, 5.18, 7.77, 10.4):
        cbox(BCR, (xg - 0.5, ya_, zt - 0.08), (xg + 0.5, yb_, zt), (), CD, vcr)
        for xs_ in (xg - 0.45, xg + 0.45): beam3(BCR, Vector((xs_, ya_, zt + 1)), Vector((xs_, yb_, zt + 1)), 0.05, 0.05, PY, vcr)
    for y0_, sg in ((ya_, -1), (yb_, 1)):
        if side_clear(xg, y0_ + 3.4 * sg)[0] > 3: beam3(BCR, Vector((xg, y0_ + 3.2 * sg, 0)), Vector((xg, y0_, 2.51)), 0.8, 0.12, CD, vcr); break
log('reefer gantries', len(GANT))
# ------------------------------------------------------------------------------------------------ yard markings: block frames, slot ends, aisle edges, dashed centre lines
LN = bmesh.new(); vln = vcol_layer(LN); WL, YL = (0.62, 0.62, 0.6, 1), (0.62, 0.5, 0.12, 1)
def mark(a, b_, col, w=0.15, dash=0.0):      # a painted line from a to b (2d) 4 cm over the paving, in 6 m pieces (dash: its on and off length), never on the run-off
    a, b_ = Vector(a), Vector(b_); L = (b_ - a).length; t = (b_ - a) / L; nrm = Vector((-t.y, t.x)) * (w / 2); s = 0.0
    while s < L - 1e-6:
        e = min(L, s + (dash or (12.0 if side_clear(*(a + t * s))[0] > 36 else 6.0))); p0, p1 = a + t * s, a + t * e; s = e + dash      # long pieces where the paving is flat
        cs = [p0 - nrm, p1 - nrm, p1 + nrm, p0 + nrm]
        if min(side_clear(c_.x, c_.y)[0] for c_ in cs) < 1.3: continue
        zs_ = []
        for c_ in cs:
            hit = YBVH.ray_cast(Vector((c_.x, c_.y, 5)), Vector((0, 0, -1)))[0]
            zs_.append(hit.z + 0.04 if hit else -0.08 if AP <= c_.y <= QY - 2 else None)      # off the paving mesh: the apron, flat at -0.12
        if None in zs_: continue
        f = LN.faces.new([LN.verts.new((c_.x, c_.y, z_)) for c_, z_ in zip(cs, zs_)])
        for l in f.loops: l[vln] = col
for bx, by in sorted(BLOCKS):
    bx0, by1 = X0 + bx * (BWX + GXA), -18 - by * (BWY + GYA); xa_, xb_, ya_, yb_ = bx0 - 0.3, bx0 + BWX + 0.3, by1 - BWY - 0.3, by1 + 0.3
    for o, col in ((0, WL), (1.0, YL)):
        P = [(xa_ - o, ya_ - o), (xb_ + o, ya_ - o), (xb_ + o, yb_ + o), (xa_ - o, yb_ + o)]
        for k in range(4): mark(P[k], P[(k + 1) % 4], col)
    for c in range(1, BB): xg = bx0 + c * PXR - 0.75; mark((xg, ya_), (xg, yb_), WL)
    if (bx + 1, by) in BLOCKS: mark((xb_ + 5.7, ya_), (xb_ + 5.7, yb_), WL, dash=3.0)
for yr in (YLR, YSR):       # safety lanes either side of the crane rails
    for dy in (-1.0, 1.0): mark((xr0, yr + dy), (xr1, yr + dy), YL)
if LN.faces: mesh_obj(f'{PFX} yard lines', LN, ['line'])
else: LN.free()

# ------------------------------------------------------------------------------------------------ hatch covers and lashing cages on the quay, west of the cranes
for xh in (xr0 - 28, xr0 - 58, xr0 - 92):
    yh = (QY - 2 + max(BD[1][near(xh, 12)[0]], 10) + 2.5) / 2
    if min(side_clear(xh + dx, yh + dy)[0] for dx in (-7.6, 7.6) for dy in (-4.2, 4.2)) < 1.5: continue
    z = -0.1
    for k in range(RNG.choice((2, 3))):     # steel pontoons 14 x 8 x 1 m, stacked a little askew
        ox, oy = RNG.uniform(-0.3, 0.3), RNG.uniform(-0.2, 0.2); col = mix(PB, (.3, .28, .25), RNG.uniform(0.1, 0.35)) + (1,)
        cbox(BX, (xh - 7 + ox, yh - 4 + oy, z), (xh + 7 + ox, yh + 4 + oy, z + 1.0), ('-z',), col, vbx)
        for q in range(5): xq = xh - 5.6 + 2.8 * q + ox; cbox(BX, (xq - 0.1, yh - 3.9 + oy, z + 1.0), (xq + 0.1, yh + 3.9 + oy, z + 1.12), ('-z',), col, vbx)
        z += 1.12
    for dx in (-10.5, 10.5):       # a lashing-gear cage at each end: an open steel frame
        lo, hi = Vector((xh + dx - 1.2, yh - 0.8, -0.1)), Vector((xh + dx + 1.2, yh + 0.8, 1.5))
        C8 = [Vector((hi.x if k & 1 else lo.x, hi.y if k & 2 else lo.y, hi.z if k & 4 else lo.z)) for k in range(8)]
        for a_, b2 in ((0, 1), (2, 3), (4, 5), (6, 7), (0, 2), (1, 3), (4, 6), (5, 7), (0, 4), (1, 5), (2, 6), (3, 7)): beam3(BCR, C8[a_], C8[b2], 0.07, 0.07, PY, vcr)

# ------------------------------------------------------------------------------------------------ past the yard: a breakwater, the next terminal up the coast, a wind farm offshore, tanks and halls inland
FAR_KEEP = []       # (x0, y0, x1, y1): no far container blocks here
if not STRETCH:
    BW = QY + 800; rows = []        # a rubble-mound breakwater 800 m out, its crest lumpy, the harbour mouth to the east
    for x in np.arange(CX - 2600, CX + 925, 25.0):
        w0 = 5 + 1.5 * fbm(x / 90, 7.7, 2)
        rows.append([Vector((x, BW - w0 - 14, SEA - 3)), Vector((x, BW - w0, SEA + 5.5 + 0.8 * fbm(x / 60, 3.1, 3))), Vector((x, BW + 0.3 * w0, SEA + 6.2 + 0.8 * fbm(x / 35, 1.3, 2))),
                     Vector((x, BW + w0, SEA + 5.5 + 0.8 * fbm(x / 50, 5.9, 3))), Vector((x, BW + w0 + 14, SEA - 3))])
    strip(BC, rows, 0, closed=False)
    for r_, sg in ((rows[0], 1), (rows[-1], -1)): BC.faces.new([BC.verts.new(p) for p in (r_ if sg < 0 else r_[::-1])])
    n0 = len(BCR.faces); hx = CX + 935      # the light tower at its head: white, a red band, unlit
    cyl(BCR, Vector((hx, BW, SEA + 5.5)), 3.2, 2.6, 9, n=12); cyl(BCR, Vector((hx, BW, SEA + 14.5)), 2.6, 2.4, 2.5, n=12)
    for k_, f in enumerate(list(BCR.faces)[n0:]):
        for l in f.loops: l[vcr] = PR if k_ >= 13 else PA
    for k in range(6):      # the next terminal's cranes, 1.5-2.2 km east on the same quay: legs, portal, girder, raised boom
        xc = CX + 1500 + 135 * k; y0, y1 = QY - 34, QY - 4; c2 = PB if k % 3 else PR
        for x_ in (xc - 8, xc + 8):
            for y_ in (y0, y1): beam3(BCR, Vector((x_, y_, 0)), Vector((x_, y_, 40)), 2.2, 2.2, PA, vcr)
            beam3(BCR, Vector((x_, y0 - 1, 41)), Vector((x_, y1 + 1, 41)), 2.2, 2.4, PA, vcr)
        beam3(BCR, Vector((xc, y0 - 24, 44)), Vector((xc, y1 + 2, 44)), 7.0, 3.0, c2, vcr)
        hinge = Vector((xc, y1 + 2, 44)); beam3(BCR, hinge, hinge + Vector((0, math.cos(1.31), math.sin(1.31))) * 60, 5.5, 2.4, c2, vcr)
        beam3(BCR, Vector((xc, y1 - 2, 46)), Vector((xc, y1 - 4, 76)), 6.0, 1.2, c2, vcr)
        cbox(BCR, (xc - 6, y0 - 24, 45.5), (xc + 6, y0 - 16, 51), ('-z',), c2, vcr)
        for q in range(2): cbox(BX, (xc - 30 + 60 * q - 25, QY - 90, -0.2), (xc - 30 + 60 * q + 25, QY - 66, HB * RNG.choice((3, 4))), ('-z',), tint(False), vbx)
    for q in range(20):     # an offshore wind farm 5-8 km out, every rotor still and facing the same way
        x = CX - 3000 + 1500 * (q % 5) + RNG.uniform(-200, 200); y = QY + 5000 + 1000 * (q // 5) + RNG.uniform(-150, 150)
        n0 = len(BCR.faces); cyl(BCR, Vector((x, y, SEA - 1)), 3.0, 2.0, 101, n=8)
        for f in list(BCR.faces)[n0:]:
            for l in f.loops: l[vcr] = (0.84, 0.85, 0.85, 1)
        hub = Vector((x, y - 4, SEA + 100)); cbox(BCR, (x - 1.8, y - 3, SEA + 98), (x + 1.8, y + 9, SEA + 102), (), (0.84, 0.85, 0.85, 1), vcr)
        ph = RNG.uniform(0, 2 * math.pi / 3)
        for b in range(3):
            a = ph + 2 * math.pi * b / 3; beam3(BCR, hub, hub + Vector((math.cos(a), 0, math.sin(a))) * 60, 0.7, 2.6, (0.84, 0.85, 0.85, 1), vcr)
    for q in range(10):     # a tank farm 1.2-2 km inland
        x = CX - 2100 + 260 * (q % 5) + RNG.uniform(-30, 30); y = Y0 - 1250 - 300 * (q // 5) + RNG.uniform(-30, 30); r_ = RNG.uniform(18, 28)
        n0 = len(BCR.faces); cyl(BCR, Vector((x, y, -0.2)), r_, r_, RNG.uniform(15, 22), n=24); col = mix(PA, (.6, .6, .58), RNG.uniform(0, 0.4)) + (1,)
        for f in list(BCR.faces)[n0:]:
            for l in f.loops: l[vcr] = col
        FAR_KEEP.append((x - r_ - 20, y - r_ - 20, x + r_ + 20, y + r_ + 20))
    FAR_KEEP.append((CX + 1400, QY - 120, CX + 2300, QY))
    for x, y, L_, W_, H_, col in ((CX + 700, Y0 - 900, 180, 70, 24, (.74, .75, .73)), (CX + 950, Y0 - 1050, 140, 60, 20, (.42, .5, .58)), (CX + 1250, Y0 - 880, 160, 80, 28, (.7, .7, .66))):
        cbox(BX, (x - L_ / 2, y - W_ / 2, -0.2), (x + L_ / 2, y + W_ / 2, H_), ('-z',), (*col, 1), vbx)     # industrial halls inland
        FAR_KEEP.append((x - L_ / 2 - 30, y - W_ / 2 - 30, x + L_ / 2 + 30, y + W_ / 2 + 30))
if not STRETCH:         # the landside skyline: far blocks of stacks past the near yard
    nf = 0
    while nf < 40:
        x, y = RNG.uniform(CX - 1700, CX + 1700), RNG.uniform(CY - 1700, Y1 - 60)
        if X0 - 30 < x < X1 + 30 and Y0 - 30 < y or any(a <= x <= c and b_ <= y <= d for a, b_, c, d in FAR_KEEP): continue
        L_ = RNG.uniform(40, 100); y0 = y
        for k in range(3):
            w_ = RNG.uniform(5, 12); h_ = HB * RNG.choice((2, 3, 3, 4, 4))
            cbox(BX, (x - L_ / 2, y0, -0.2), (x + L_ / 2, y0 + w_, h_), ('-z',), tint(False), vbx); y0 += w_ + RNG.uniform(1, 6)
        nf += 1
mesh_obj(f'{PFX} box', BX, ['box'])
mesh_obj(f'{PFX} crane', BCR, ['crane'])
mesh_obj(f'{PFX} apron', BA, ['apron'])
mesh_obj(f'{PFX} concrete', BC, ['concrete'])
for nm, b_, k in ((f'{PFX} roof', BR, 'roof'), (f'{PFX} door', BD_, 'door')):
    if b_.faces: mesh_obj(nm, b_, [k])
    else: b_.free()

collision(paved_col)
_y = bpy.data.objects['col_grass']; _y.name = _y.data.name = 'col_yard'      # the run-off and the yard are paved, and off the track for track limits (world.js col_yard)
write_track('North Sea Terminal', ['Textures: Poly Haven (CC0); see tracks/terminal/CREDITS.md'], ['day', 'dusk'], 'day', LM,
            extra={'surfaces': {'asphalt': ['col_asphalt'], 'curb': ['col_curb'], 'yard': ['col_yard'], 'wall': ['col_wall']}})
export()
