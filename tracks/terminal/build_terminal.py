"""North Sea Terminal: a flat, walled qualifying circuit through a container terminal on a quay (track-viewer/docs/10x/maps-spec.md section 5), in one Blender pass.
    powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/maps/tracks/terminal/build_terminal.py -Log <abs log>
    (-Rest --no-export,stretch: the hero stretch, the quay straight, one crane and the first canyon block, for review stills first)
Layout: track-viewer/docs/career-worlds/terminal.json (1.75 km, flat). Shared pieces: tracks/career_lib.py. Day and dusk only: no lights.json, nothing lit.
  road      15 m, kerbs below R140, jersey barriers 10 m out on the quay straight and 11 m elsewhere, a paved run-off strip between them (flush with the road)
  yard      interlocking pavers: one constrained triangulation from the run-off edge out to 400 m (no overlap with the strip, nothing coplanar), a flat
            dirty-concrete ring to 3 km on the land side; the quay apron, seaworn capping and a 3 m quay wall 21.5 m north of the start straight, the sea 2.5 m down
  cranes    three ship-to-shore cranes, booms up, the road between their legs and outside both barriers
  boxes     ISO 40 ft containers in rectilinear blocks (1-5 high), tinted by vertex colour over one grey ribbed diffuse; the faces that see the road are detailed
            (corner posts, rails, door bars), the rest are plain; reefer blocks at the reefer corner with plug-rack gantries; a landside skyline of far blocks
  other     two transit sheds in the west yard, eight unlit high-mast poles, bollards and fenders on the quay"""
import bpy, sys
from pathlib import Path
H = Path(globals().get('__file__') or sys.argv[sys.argv.index('-P') + 1]).resolve().parent; ID = 'terminal'; PFX = 'NT'
exec(compile((H.parent / 'career_lib.py').read_text(encoding='utf8'), str(H.parent / 'career_lib.py'), 'exec'))
assert H.resolve().parents[1] == ROOT and (ROOT / 'track-viewer').is_dir(), ROOT
assert H.name == ID, H
import numpy as np
from mathutils.geometry import delaunay_2d_cdt
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
    'barrier': material('NT | barrier', tex='concrete_wall_009'),
    'yard': material('NT | yard', tex='interlocking_concrete_pavers', diff=PV, vcol=True),
    'apron': material('NT | apron', tex='brushed_concrete'),
    'quay': material('NT | quay', tex='seaworn_stone_tiles'),
    'box': material('NT | box', tex='box_profile_metal_sheet', diff=CT, vcol=True),
    'crane': material('NT | crane', tex='box_profile_metal_sheet', diff=CT, vcol=True),
    'roof': material('NT | roof', tex='rusty_corrugated_iron'),
    'door': material('NT | roller door', tex='painted_metal_shutter'),
    'concrete': material('NT | concrete', tex='dirty_concrete'),
    'fender': material('NT | fender', (0.03, 0.03, 0.03), 0.85, diff=None),
    'water': material('NT | sea', (0.04, 0.07, 0.07), 0.09),
    'far': material('NT | far yard', tex='dirty_concrete', vcol=True),
})
_n = MAT['fender'].node_tree; _t = _n.nodes.new('ShaderNodeTexImage'); _t.image = image(LL / 'rubber.png'); _n.links.new(_t.outputs['Color'], _n.nodes['Principled BSDF'].inputs['Base Color'])
MAT['crane'].node_tree.nodes['Normal Map'].inputs['Strength'].default_value = 0.2      # sheet ribs would read on a box girder
UVS.update({'asphalt': 3.5, 'kerb_r': 2.5, 'kerb_w': 2.5, 'yard': 4.0, 'apron': 4.0, 'quay': 3.0, 'box': 2.0, 'crane': 2.0, 'roof': 3.0, 'door': 5.0,
            'concrete': 3.0, 'fender': 2.0, 'far': 30.0})
QUAY = lambda i: i * STEP >= LAP - 250 or i * STEP <= 150
road(7.5, 140)
barriers(lambda i: 10.0 if QUAY(i) else 11.0)
b = bmesh.new(); b.from_mesh(bpy.data.objects[f'{PFX} lines'].data); vc = vcol_layer(b)     # the line material takes its white from the vertices
for f in b.faces:
    for l in f.loops: l[vc] = (0.62, 0.62, 0.6, 1)
b.to_mesh(bpy.data.objects[f'{PFX} lines'].data); b.free()
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
    for c in range(8):
        x0, x1, y0, y1 = CX - 4000 + 1000 * a, CX - 3000 + 1000 * a, QY + 500 * c, QY + 500 * (c + 1)
        bs.faces.new([bs.verts.new((x, y, SEA)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))])
bmesh.ops.remove_doubles(bs, verts=bs.verts, dist=0.01); mesh_obj(f'{PFX} sea', bs, ['water'])

# ------------------------------------------------------------------------------------------------ bollards and fenders on the quay
BC, BF = bmesh.new(), bmesh.new()
for k in range(int((X1 - X0) / 25)):
    x = X0 + 12.5 + 25 * k; c = Vector((x, QY - 0.7, 0.15)); cyl(BC, c, 0.28, 0.24, 0.55, n=10); cyl(BC, c + Vector((0, 0, 0.55)), 0.36, 0.36, 0.14, n=10)
for k in range(int((X1 - X0) / 20)):
    x = X0 + 10 + 20 * k; cbox(BF, (x - 1.0, QY, -2.9), (x + 1.0, QY + 0.35, -0.35), skip=('-y',))
mesh_obj(f'{PFX} fenders', BF, ['fender'])

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
CG = (0.8, 0.8, 0.78, 1); CD = (0.62, 0.63, 0.62, 1)
for n_, xc in enumerate(XC):
    cg = tuple(c * (1 + 0.03 * (n_ - 1)) for c in CG[:3]) + (1,)
    B = lambda lo, hi, sk=(), col=cg: cbox(BCR, lo, hi, sk, col, vcr)
    for xo in (-8, 8):
        for yr in (YLR, YSR):
            B((xc + xo - 4, yr - 1, 0.06), (xc + xo + 4, yr + 1, 2.6), ('-z',), CD)          # bogies on the rail
            B((xc + xo - 1.25, yr - 1.25, 2.6), (xc + xo + 1.25, yr + 1.25, 40), ('-z', '+z'))   # legs
        B((xc + xo - 1.25, YLR - 1.25, 40), (xc + xo + 1.25, YSR + 1.25, 42.5))              # portal beams over the road
    for yr in (YLR, YSR):
        B((xc - 9.25, yr - 1.0, 2.6), (xc + 9.25, yr + 1.0, 4.4))                            # sill beams
        B((xc - 9.25, yr - 1.15, 40.2), (xc + 9.25, yr + 1.15, 42.3))                        # portal beams along the rail (inset: no face shared with the cross beams)
        sg = 1 if yr < 0 else -1; beam3(BCR, Vector((xc - 6.8 * sg, yr, 6)), Vector((xc + 6.8 * sg, yr, 38.5)), 0.9, 0.9, cg, vcr)      # leg bracing
    for xo in (-4, 4):
        B((xc + xo - 0.9, YLR - 26, 42.5), (xc + xo + 0.9, YSR + 2, 46))                    # trolley girders with the backreach
        hinge = Vector((xc + xo, YSR + 2, 44.2)); tip = hinge + Vector((0, math.cos(math.radians(80)), math.sin(math.radians(80)))) * 65
        beam3(BCR, hinge, tip, 1.8, 2.6, cg, vcr)                                # the boom, raised to 80 degrees
        ap = Vector((xc + xo * 1.1, YSR - 4, 79))
        beam3(BCR, Vector((xc + xo * 1.5, YSR - 1, 46)), ap, 1.2, 1.2, cg, vcr)               # the apex frame
        beam3(BCR, ap, Vector((xc + xo, YLR - 12, 46)), 1.0, 1.0, cg, vcr)
        beam3(BCR, ap, hinge + (tip - hinge) * 0.62, 0.35, 0.35, cg, vcr)                    # luffing stays
    B((xc - 5.5, YSR - 5, 78), (xc + 5.5, YSR - 3, 80.5))                                    # apex head
    for k in range(1, 7):
        p = Vector((0, YSR + 2, 44.2)) + Vector((0, math.cos(math.radians(80)), math.sin(math.radians(80)))) * (9.2 * k)
        beam3(BCR, Vector((xc - 3.1, p.y, p.z)), Vector((xc + 3.1, p.y, p.z)), 0.5, 0.5, cg, vcr)        # boom ties
    for yy in (YLR - 20, YLR + 2, YSR - 8): B((xc - 4.0, yy - 0.5, 43), (xc + 4.0, yy + 0.5, 45.5))   # girder cross ties
    B((xc - 6, YLR - 26, 46), (xc + 6, YLR - 18, 52), ('-z',))                              # machinery house
    B((xc - 3.4, YSR - 9, 46), (xc + 3.4, YSR - 3, 48.6), ('-z',), CD)                      # the trolley, parked
    B((xc - 1.6, YSR - 7.5, 39.0), (xc + 1.6, YSR - 4.5, 46), ('+z',), CD)                  # operator cab, hung from it between the girders
LM = [{'name': 'Cranes', 'pos': to_game(Vector((XC[len(XC) // 2], YSR - 4, 80)))}]

# ------------------------------------------------------------------------------------------------ transit sheds and high-mast poles (west yard and yard aisles)
BX = bmesh.new(); vbx = vcol_layer(BX); BR, BD_ = bmesh.new(), bmesh.new(); BCO = BC
KEEP_OUT = []       # (x0, y0, x1, y1): no containers here
if not STRETCH:
    west = [CL[i] for i in range(N) if -230 < CL[i].y < -60 and CL[i].x < 0]; xw = min(p.x for p in west)
    for yc in (-95.0, -175.0):
        x0, x1, y0, y1 = xw - 11 - 1.6 - 8 - 30, xw - 11 - 1.6 - 8, yc - 30, yc + 30
        for x_, y_ in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)): assert side_clear(x_, y_)[0] > 6, ('a shed too close to the road', x_, y_)
        cbox(BX, (x0, y0, -0.14), (x1, y1, 12), ('-z', '+z'), (0.6, 0.64, 0.63, 1), vbx)
        ev = 12 - 2 / 15 * 0.5     # the roof plane runs through the wall tops: at 11.8 the walls and gables poked 13 cm through it
        rf = [BR.verts.new(p) for p in ((x0 - 0.5, y0 - 0.5, ev), (x0 - 0.5, y1 + 0.5, ev), ((x0 + x1) / 2, y1 + 0.5, 14), ((x0 + x1) / 2, y0 - 0.5, 14),
                                        (x1 + 0.5, y0 - 0.5, ev), (x1 + 0.5, y1 + 0.5, ev))]
        BR.faces.new([rf[0], rf[3], rf[2], rf[1]]); BR.faces.new([rf[3], rf[4], rf[5], rf[2]])
        for yg, o in ((y0, -1), (y1, 1)):
            f = BX.faces.new([BX.verts.new(p) for p in ((x0, yg, 12), ((x0 + x1) / 2, yg, 14), (x1, yg, 12))][::o])
            for l in f.loops: l[vbx] = (0.6, 0.64, 0.63, 1)
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
    for x, y in poles:
        cyl(BC, Vector((x, y, -0.2)), 1.1, 1.0, 0.7, n=12)
        cyl(BCR, Vector((x, y, 0.5)), 0.42, 0.22, 29.5, n=16)
        cbox(BCR, (x - 2.2, y - 0.25, 29.6), (x + 2.2, y + 0.25, 30.1), (), CD, vcr)
        for dx in (-1.6, 0, 1.6): cbox(BCR, (x + dx - 0.4, y - 0.55, 28.9), (x + dx + 0.4, y - 0.2, 29.6), (), CD, vcr)
        KEEP_OUT.append((x - 4, y - 4, x + 4, y + 4))
    for f in list(BCR.faces)[n0:]:
        for l in f.loops: l[vcr] = CD       # cyl() leaves the poles uncoloured
    log('poles', len(poles))

# ------------------------------------------------------------------------------------------------ the container yard
TINT = [((.55, .18, .12), 20), ((.12, .2, .35), 18), ((.45, .47, .48), 16), ((.18, .35, .22), 12), ((.75, .7, .6), 10), ((.65, .45, .15), 10), ((.85, .85, .83), 14)]
def tint(reefer):
    if reefer and RNG.random() < 0.7: c = (.85, .85, .83)
    else: c = RNG.choices([t for t, _ in TINT], [w for _, w in TINT])[0]
    j = RNG.uniform(0.94, 1.06); g = sum(c) / 3; c = [0.92 * (g + 0.72 * (a - g)) for a in c]       # muted: painted steel that has seen weather
    return tuple(min(1, a * j * RNG.uniform(0.98, 1.02)) for a in c) + (1,)
LB, WB_, HB = 12.19, 2.44, 2.59
def container(x, y, z, door, covered, detailed, col):
    xa, xb, ya, yb, za, zb = x - LB / 2, x + LB / 2, y - WB_ / 2, y + WB_ / 2, z, z + HB
    C = lambda lo, hi, sk: cbox(BX, lo, hi, sk, col, vbx)
    def foot(fs):       # the foot of each side darker: a line at every tier that still reads where rails are under a pixel, so no stack reads as one slab
        for l in (l for f in fs for l in f.loops if l.vert.co.z < za + 0.01): l[vbx] = tuple(0.45 * a for a in col[:3]) + (1,)
    if not detailed: return foot(C((xa, ya, za), (xb, yb, zb), ('-z',) + (('+z',) if covered else ())))
    i, p, d = 0.03, 0.17, 0.12
    foot(C((xa + i, ya + i, za), (xb - i, yb - i, zb - 0.02), ('-z',) + (('+z',) if covered else ())))      # body, the roof panel 2 cm under the rails
    for px_, sx in ((xa, '+x'), (xb - p, '-x')):
        for py_, sy in ((ya, '+y'), (yb - p, '-y')): C((px_, py_, za), (px_ + p, py_ + p, zb), ('-z', '+z', sx, sy))       # corner posts
    for y0_, y1_, sy in ((ya, ya + d, '+y'), (yb - d, yb, '-y')):         # side rails, top and bottom
        C((xa + p, y0_, zb - 0.14), (xb - p, y1_, zb), ('-x', '+x', '-z', sy) + (('+z',) if covered else ()))
        if za < 0: C((xa + p, y0_, za), (xb - p, y1_, za + 0.16), ('-x', '+x', '-z', sy))      # above the ground tier the top rail below draws this band
    for x0_, x1_, sx in ((xa, xa + d, '+x'), (xb - d, xb, '-x')):         # end rails
        C((x0_, ya + p, zb - 0.14), (x1_, yb - p, zb), ('-y', '+y', '-z', sx) + (('+z',) if covered else ()))
        if za < 0: C((x0_, ya + p, za), (x1_, yb - p, za + 0.16), ('-y', '+y', '-z', sx))
    xe = xb if door > 0 else xa
    for yo in () if not door else (-0.85, -0.3, 0.3, 0.85):         # door locking bars
        C((xe - 0.03 if door > 0 else xe - 0.02, y + yo - 0.025, za + 0.22), (xe + 0.02 if door > 0 else xe + 0.03, y + yo + 0.025, zb - 0.22), ('-z', '+z', '-x' if door > 0 else '+x'))
RB, BB, PXR, PYR, GXA, GYA = 7, 5, LB + 1.5, WB_ + 0.4, 12.0, 7.0      # rows across y, bays along x; the aisles between blocks
BWX, BWY = BB * PXR - 1.5, RB * PYR - 0.4
ir3 = st(next(c['at'] for c in SRC['corners'] if c['n'] == 3)); RC = CL[ir3]
slots = {}
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
                slots[(bx, by, r, c)] = (x, y, cl, reefer, ic)
nbox = ndet = 0; GANT = set(); HT = {k: RNG.choices((1, 2, 3, 4, 5), (5, 12, 33, 38, 12))[0] for k in sorted(slots)}
for (bx, by, r, c), (x, y, cl, reefer, ic) in sorted(slots.items()):
    h = HT[(bx, by, r, c)]; nb = [HT.get((bx, by, r + dr, c + dc)) for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))]
    exposed = None in nb
    v = CL[ic] - Vector((x, y, 0)); toward = (bx, by, r, c + (1 if v.x > 0 else -1)) if abs(v.x) > abs(v.y) else (bx, by, r - (1 if v.y > 0 else -1), c)
    det = toward not in slots and cl < 13       # the face toward the road is open: the line a driver sees gets posts, rails and door bars
    door = RNG.choice((1, -1)); bars = det and toward[3] - c == door       # door bars only where the door end looks at the road
    k0 = 0 if exposed else min(h, *nb)      # tiers below every neighbour's top show only down the 0.4 m slits: one box for them
    assert not (k0 and det), 'a hidden stack is never detailed'
    if k0: cbox(BX, (x - LB / 2, y - WB_ / 2, -0.14), (x + LB / 2, y + WB_ / 2, -0.14 + k0 * HB), ('-z',) + (('+z',) if k0 < h else ()), tint(reefer), vbx)
    for k in range(k0, h):      # every tier that can be seen is its own box with its own tint, out to the last row
        container(x, y, -0.14 + k * HB, door if bars else 0, k < h - 1, det, tint(reefer)); ndet += det
    nbox += h
    if reefer and c in (1, 3): GANT.add((bx, by, c))
log('containers', nbox, 'in', len(slots), 'slots;', ndet, 'detailed')
for bx, by, c in sorted(GANT):        # plug-rack gantries in the bay gap after bay c: walkways at each tier, posts on concrete bases
    rows = [r for r in range(RB) if (bx, by, r, c) in slots or (bx, by, r, c + 1) in slots]
    if not rows: continue
    bx0, by1 = X0 + bx * (BWX + GXA), -18 - by * (BWY + GYA); xg = bx0 + (c + 1) * PXR - 0.75
    ya_, yb_ = by1 - max(rows) * PYR - WB_ - 0.6, by1 - min(rows) * PYR + 0.6
    if min(side_clear(xg, yy)[0] for yy in (ya_, yb_)) < 3: continue
    for yy in (ya_, (ya_ + yb_) / 2, yb_):
        cbox(BC, (xg - 0.5, yy - 0.5, -0.2), (xg + 0.5, yy + 0.5, 0.3), ('-z',))
        cbox(BCR, (xg - 0.15, yy - 0.15, 0.3), (xg + 0.15, yy + 0.15, 10.6), ('-z',), CD, vcr)
    for zt in (2.59, 5.18, 7.77, 10.4): cbox(BCR, (xg - 0.4, ya_, zt - 0.08), (xg + 0.4, yb_, zt), (), CD, vcr)
log('reefer gantries', len(GANT))
if not STRETCH:         # the landside skyline: far blocks of stacks past the near yard
    nf = 0
    while nf < 40:
        x, y = RNG.uniform(CX - 1700, CX + 1700), RNG.uniform(CY - 1700, Y1 - 60)
        if X0 - 30 < x < X1 + 30 and Y0 - 30 < y: continue
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

collision([], paved_col)
bpy.data.objects.remove(bpy.data.objects['col_grass'])      # all of the yard is paved: no grass surface
write_track('North Sea Terminal', ['Textures: Poly Haven (CC0); see tracks/terminal/CREDITS.md'], ['day', 'dusk'], 'day', LM)
export()
