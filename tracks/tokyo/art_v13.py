"""Tokyo v13 art pass (Blender review build). Reads out/tokyo_v12.blend (never written), saves out/tokyo_v13.blend.

    powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/art_v13.py [-Rest replan]     (one process, -b -t 6, below-normal priority)

Fixes from the v12 review: landmarks visible from the track (placement search, out/visibility-*.json), a low distant 4x mirrored skyline
ring, the bridge lane check, a dressed tunnel with anime mural lightboxes and hologram anchors, then the v12 weak list (lagoon village,
wide run-off, Himeji-style castle, lantern hall, flowing HQ, crowd cutouts, volumetric searchlights). Not an export.
"""
import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clearance_v12 as CK  # noqa: E402
import v12_common as C  # noqa: E402
import v13_kit as K  # noqa: E402
import visibility_v13 as V  # noqa: E402

O = C.O
SRC, DST = O / 'tokyo_v12.blend', O / 'tokyo_v13.blend'
PLAN_JSON = O / 'v13-landmark-placement.json'
REPLAN = 'replan' in sys.argv
rnd = random.Random(13)
LOG = {}


def log(*a):
    print('[v13]', *a, flush=True)


bpy.ops.wm.open_mainfile(filepath=str(SRC))
sc = bpy.context.scene
cl = C.CL()
M, s0 = cl.M, cl.s0
K.init(sc, cl)
from v13_kit import (box, frot, glow, hide, mat, new_light, newcoll, quad, ribbon, seg_box, sweep, text_obj, to_obj)  # noqa: E402
FB, FM = K.FB, K.FM


def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def vis(o):
    return not o.hide_render and all(not c.hide_render for c in o.users_collection)


AV = cl.nearest(*cl.raw[270][:2])[0]            # neon avenue station
BR_I = cl.nearest(*cl.raw[690][:2])[0]          # bridge entry station
_pg = [o for o in sc.objects if o.name.startswith('V12 pagoda | red walls')][0]
PPOS = Vector(_pg.matrix_world @ Vector((sum(v[0] for v in _pg.bound_box) / 8, sum(v[1] for v in _pg.bound_box) / 8, 0)))

BASE_VIS = json.load(open(O / 'visibility-v12.json'))
LOG['visibility_before'] = BASE_VIS

# =============================================================================================== 1. landmark visibility
TOKENS = {
    'lantern_hall': ('V10 06 |', 'V10 lantern hall'),
    'timber_tower': ('V10 05 |',),
    'neon_gate': ('V10 09 |', 'V10 neon shrine'),
    'hq': ('V10 04 |', 'V10 HQ'),
    'castle': ('V10 02 |',),
}
TERRAIN = {o.name for o in bpy.data.collections['02_TERRAIN'].objects} | {o.name for o in sc.objects if 'extended landscape grass' in o.name or o.name.startswith('ground')}
kd, kd_pts = CK.centerline_kd()
dg = bpy.context.evaluated_depsgraph_get()


def group_all(tokens):
    return [o for o in sc.objects if any(t in o.name for t in tokens)]


def ground_z(x, y):
    d = Vector((0, 0, -1))
    org = Vector((x, y, 400))
    for _ in range(12):
        hit, loc, nrm, idx, ob, _m = sc.ray_cast(dg, org, d, distance=900)
        if not hit:
            return None
        if ob.name in TERRAIN:
            return loc.z
        org = loc + d * 0.05
    return None


def obstacle_boxes(exclude):
    out = []
    names = set()
    for c in bpy.data.collections:
        if c.name in CK.CHECK_COLLS or (c.name.startswith(('V12 |', 'V13 |')) and any(w in c.name.lower() for w in CK.CHECK_WORDS)):
            for o in c.all_objects:
                if o.type == 'MESH' and vis(o) and o.name not in exclude and o.name not in names:
                    names.add(o.name)
                    pts = np.array([list(o.matrix_world @ Vector(v)) for v in o.bound_box])
                    out.append((pts[:, 0].min(), pts[:, 0].max(), pts[:, 1].min(), pts[:, 1].max()))
    return np.array(out)


def rect_points(cx, cy, w, d, yaw, step=9.0):
    pts = []
    cs, sn = math.cos(yaw), math.sin(yaw)
    for u in np.arange(-w / 2, w / 2 + 0.1, step):
        for v in np.arange(-d / 2, d / 2 + 0.1, step):
            pts.append((cx + u * cs - v * sn, cy + u * sn + v * cs))
    return pts


REJ = {}


def plan_spot(name, w, d, h, group_names, stations, lats, yaw_mode, score_mode, min_clear=24.0, current=None, max_move=None):
    """search a footprint position near the track from which the landmark is visible ahead; returns dict(x,y,yaw,z,score)"""
    obst = obstacle_boxes(group_names)
    best = []
    for i in stations:
        for side in (-1, 1):
            for lat in lats:
                cx, cy = cl.at(i, side * lat)[:2]
                yaw = math.atan2(cl.T[i][1], cl.T[i][0]) if yaw_mode == 'road' else 0.0
                pts = rect_points(cx, cy, w, d, yaw)
                if max_move is not None and math.hypot(cx - current[0], cy - current[1]) > max_move:
                    continue
                if min(kd.find((x, y, 0))[2] for x, y in pts) < min_clear:
                    REJ['clear'] = REJ.get('clear', 0) + 1
                    continue
                ex = (abs(math.cos(yaw)) * w + abs(math.sin(yaw)) * d) / 2
                ey = (abs(math.sin(yaw)) * w + abs(math.cos(yaw)) * d) / 2
                if len(obst) and np.any((obst[:, 0] < cx + ex + 6) & (obst[:, 1] > cx - ex - 6) & (obst[:, 2] < cy + ey + 6) & (obst[:, 3] > cy - ey - 6)):
                    REJ['obstacle'] = REJ.get('obstacle', 0) + 1
                    continue
                gz = [ground_z(x, y) for x, y in pts[::3]]
                if any(g is None for g in gz) or max(gz) - min(gz) > 7 or min(gz) < -0.5 or cx > 440:
                    REJ['ground'] = REJ.get('ground', 0) + 1
                    continue
                best.append(dict(x=float(cx), y=float(cy), yaw=yaw, z=float(np.mean(gz)), station=int(i), side=side, lat=lat, ex=ex, ey=ey))
    return best


def score_spot(sp, w, d, h, stations_eval, stride, mode):
    lo = np.array([sp['x'] - sp['ex'], sp['y'] - sp['ey'], sp['z']])
    hi = np.array([sp['x'] + sp['ex'], sp['y'] + sp['ey'], sp['z'] + h])
    tg = V.targets(lo, hi)
    ctr = (lo + hi) / 2
    res = V.eval_positions(sc, dg, cl, tg, ctr, stations_eval, frozenset())
    ahead = [r[1] for r in res]
    run, st = V.longest_run(ahead, stride)
    pct = 100 * sum(ahead) / len(ahead)
    return run, pct


def apply_move(objs, dx, dy, dz):
    for o in objs:
        o.location.x += dx
        o.location.y += dy
        o.location.z += dz


_hid = V.hide_ignored(sc)
dg = bpy.context.evaluated_depsgraph_get()
plan = json.load(open(PLAN_JSON)) if (PLAN_JSON.exists() and not REPLAN) else {}
move_report = {}
for name in ('lantern_hall', 'timber_tower', 'neon_gate'):
    objs = group_all(TOKENS[name])
    body = [o for o in objs if o.type == 'MESH' and not o.hide_render]
    lo, hi = V.bbox(body)
    ctr = (lo + hi) / 2
    w, d, h = float(hi[0] - lo[0]), float(hi[1] - lo[1]), float(hi[2] - lo[2])
    for o in objs:
        o.hide_viewport = True
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    if name not in plan:
        cands = plan_spot(name, w, d, h, {o.name for o in objs}, list(range(0, M, 12)), (w / 2 + 16, w / 2 + 38, w / 2 + 62), 'none', 'ahead', current=ctr, max_move=520)
        coarse = []
        for sp in cands:
            run, pct = score_spot(sp, w, d, h, list(range(0, M, 40)), 40, 'ahead')
            coarse.append((run * 0.6 + pct, sp))
        coarse.sort(key=lambda x: -x[0])
        fin = []
        for _s, sp in coarse[:10]:
            run, pct = score_spot(sp, w, d, h, list(range(0, M, 10)), 10, 'ahead')
            dist = math.hypot(sp['x'] - ctr[0], sp['y'] - ctr[1])
            fin.append((run + 2 * pct - 0.1 * dist, run, pct, dist, sp))
        fin.sort(key=lambda x: -x[0])
        _sc, run, pct, dist, sp = fin[0]
        json.dump(plan, open(PLAN_JSON, 'w'), indent=1)
        plan[name] = dict(x=sp['x'], y=sp['y'], z=sp['z'], station=sp['station'], run=run, pct=pct, moved_m=dist, candidates=len(cands))
    p = plan[name]
    g_old = ground_z(ctr[0], ctr[1])
    dz = (p['z'] - (g_old if g_old is not None else lo[2])) if g_old is not None else 0.0
    for o in objs:
        o.hide_viewport = False
    apply_move([o for o in objs if o.type != 'LIGHT' or True], p['x'] - ctr[0], p['y'] - ctr[1], dz)
    json.dump(plan, open(PLAN_JSON, 'w'), indent=1)
    move_report[name] = dict(from_xy=[round(float(ctr[0])), round(float(ctr[1]))], to_xy=[round(p['x']), round(p['y'])], dz=round(float(dz), 1), **{k: round(float(p[k]), 1) for k in ('run', 'pct', 'moved_m')})
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
# trim what blocks them: frontages inside the landmark footprint (+12 m) or in the corridor between it and the road are hidden
trim_report = {}
fr_all = [o for o in sc.objects if o.name.startswith('V10 frontage') and not o.hide_render]
for name in ('lantern_hall', 'timber_tower', 'neon_gate'):
    body = [o for o in group_all(TOKENS[name]) if o.type == 'MESH' and not o.hide_render]
    lo_, hi_ = V.bbox(body)
    c_ = (lo_ + hi_) / 2
    ri_, _d, _l = cl.nearest(c_[0], c_[1])
    uu = Vector((cl.P[ri_][0] - c_[0], cl.P[ri_][1] - c_[1])).normalized()
    vv = Vector((-uu.y, uu.x))
    hv_ = (abs(uu.y) * (hi_[0] - lo_[0]) + abs(uu.x) * (hi_[1] - lo_[1])) / 2
    n_ = 0
    for o in fr_all:
        if o.hide_render:
            continue
        rel = Vector((o.location.x - c_[0], o.location.y - c_[1]))
        inside_box = lo_[0] - 12 < o.location.x < hi_[0] + 12 and lo_[1] - 12 < o.location.y < hi_[1] + 12
        corridor = 0 < rel.dot(uu) < 75 + (hi_[1] - lo_[1]) / 2 and abs(rel.dot(vv)) < hv_ + 8
        if inside_box or corridor:
            hide(o)
            n_ += 1
    trim_report[name] = n_
LOG['frontage objects hidden to open the landmark views'] = trim_report
LOG['landmarks moved'] = move_report
log('moved', move_report)

# ------------------------------------------------------------------------------------------------ materials for the new landmarks
m_white = mat('V13 white slab', (0.82, 0.84, 0.88), 0.35, emit=(0.55, 0.65, 0.9), strength=0.35)
m_soffit = glow('V13 soffit warm', (1.0, 0.7, 0.4), 1.4)
m_glass = mat('V13 glazing', (0.02, 0.05, 0.06), 0.08, emit=(1.0, 0.72, 0.42), strength=0.9)
m_ledc = glow('V12 LED cyan', (0.1, 0.9, 1.0), 9.0)
m_ledp = glow('V12 LED purple', (0.65, 0.18, 1.0), 9.0)
m_pole = mat('V12 pylon pole', (0.03, 0.03, 0.035), 0.5, metal=0.8)
ARCH_HQ = newcoll('V13 | architecture flowing HQ')
ARCH_CASTLE = newcoll('V13 | architecture Himeji-style castle')


# ------------------------------------------------------------------------------------------------ flowing HQ (ref 08)
def build_hq(c, yaw, gz):
    bw, bs, bg, bc, bl = bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new()      # slabs, soffit, glass, columns, led
    slabs = [(60.0, 36.0, gz + 3.2, 0.2, 0.1), (47.0, 28.5, gz + 8.4, 0.15, 0.2), (33.0, 20.0, gz + 13.6, 0.1, 0.3)]
    cs, sn = math.cos(yaw), math.sin(yaw)

    def W(x, y, z):
        return (c[0] + x * cs - y * sn, c[1] + x * sn + y * cs, z)
    prev_top = gz + 0.3
    for k, (a, b, ztop, l0, ph) in enumerate(slabs):
        pts = K.superellipse(a, b, 72, (0.05 + 0.02 * k, 0.035), ph + k, 2.3)
        off = (-4.0 * k, 3.0 * k) if k else (0, 0)
        pts = [(x + off[0], y + off[1]) for x, y in pts]
        zb = ztop - 1.1
        n = len(pts)
        quad(bw, [W(x, y, ztop) for x, y in pts], mi=0)
        quad(bs, [W(x, y, zb) for x, y in pts[::-1]], mi=0)
        for i in range(n):
            j = (i + 1) % n
            quad(bw, [W(*pts[i], zb), W(*pts[j], zb), W(*pts[j], ztop), W(*pts[i], ztop)], mi=0)
            quad(bl, [W(*pts[i], ztop - 0.35), W(*pts[j], ztop - 0.35), W(*pts[j], ztop - 0.15), W(*pts[i], ztop - 0.15)], mi=0)
        # glazing set back 3.5 m under the slab, from the lower slab top to this slab's soffit
        gp = [(x * 0.9 + off[0] * 0.1, y * 0.9 + off[1] * 0.1) for x, y in pts]
        for i in range(n):
            j = (i + 1) % n
            quad(bg, [W(*gp[i], prev_top), W(*gp[j], prev_top), W(*gp[j], zb), W(*gp[i], zb)], mi=0)
            if i % 4 == 0:                                       # slim columns
                px, py = pts[i][0] * 0.96, pts[i][1] * 0.96
                box(bc, W(px, py, prev_top), 0.4, 0.4, zb - prev_top, yaw, 0)
        prev_top = ztop
    to_obj('V13 HQ | white flowing slabs', bw, [m_white], ARCH_HQ, smooth=False)
    to_obj('V13 HQ | warm soffits', bs, [m_soffit], ARCH_HQ)
    to_obj('V13 HQ | recessed glazing', bg, [m_glass], ARCH_HQ)
    to_obj('V13 HQ | slim columns', bc, [mat('V13 column white', (0.85, 0.86, 0.9), 0.4)], ARCH_HQ)
    to_obj('V13 HQ | edge LED', bl, [m_ledc], ARCH_HQ)
    for k, (dx, dy, z, col, e) in enumerate(((-30, 0, 8, (1.0, 0.75, 0.5), 50000), (25, 5, 14, (0.6, 0.8, 1.0), 40000), (0, -20, 18, (1.0, 0.8, 0.6), 30000))):
        x, y, _z = W(dx, dy, 0)
        new_light(f'V13 HQ wash {k}', 'AREA', Vector((x, y, gz + z)), e, col, size=22, coll=ARCH_HQ)


# HQ placement: visible from the start straight (grid and the stretch behind it), beyond the end of the stands, clear of the road
hq_old = group_all(TOKENS['hq'])
for o in hq_old:
    hide(o)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
HQ_W, HQ_D, HQ_H = 136.0, 84.0, 16.0
# the HQ sits across the straight from the start line, beyond the stands, with a view gap cut in the south stand (a window, not a wall)
GAP = (s0 - 10, s0 + 18)
hq_st = (GAP[0] + GAP[1]) // 2
hq_c = cl.at(hq_st, -92.0)
gz_ = ground_z(hq_c[0], hq_c[1])
plan['hq'] = dict(x=float(hq_c[0]), y=float(hq_c[1]), z=float(gz_ if gz_ is not None else 0.0), yaw=math.atan2(cl.T[hq_st][1], cl.T[hq_st][0]), station=hq_st, gap_stations=list(GAP))
_obst = obstacle_boxes(set())
_r = rect_points(hq_c[0], hq_c[1], HQ_W, HQ_D, plan['hq']['yaw'])
_hits = int(sum(np.any((_obst[:, 0] < x) & (_obst[:, 1] > x) & (_obst[:, 2] < y) & (_obst[:, 3] > y)) for x, y in _r)) if len(_obst) else 0
plan['hq']['obstacle_points_inside'] = _hits
json.dump(plan, open(PLAN_JSON, 'w'), indent=1)
# cut the gap: delete south-stand faces (and LED / floodlight faces) whose centre falls in the gap stations
for nm in ('V12 Seoul-style start stand | south', 'V12 Seoul-style start stand | south | LED', 'V12 Seoul-style start stand | south | floodlights'):
    ob = bpy.data.objects[nm]
    bmg = bmesh.new()
    bmg.from_mesh(ob.data)
    kill = []
    for f in bmg.faces:
        cc = ob.matrix_world @ f.calc_center_median()
        ii, dd, lat = cl.nearest(cc.x, cc.y)
        if GAP[0] <= ii <= GAP[1]:
            kill.append(f)
    bmesh.ops.delete(bmg, geom=kill, context='FACES')
    bmg.to_mesh(ob.data)
    bmg.free()
LOG['stand gap'] = dict(stations=list(GAP), length_m=(GAP[1] - GAP[0]) * 2)
hp = plan['hq']
V.restore_hidden(_hid)
build_hq((hp['x'], hp['y']), hp['yaw'], hp['z'])
LOG['hq placement'] = {k: (round(v, 1) if isinstance(v, float) else v) for k, v in hp.items()}
log('HQ', LOG['hq placement'])


# ------------------------------------------------------------------------------------------------ Himeji-style castle (ref 07) in place of the v10 one
def build_castle(c, gz, yaw=0.0):
    bwall, broof, bstone, bwood, bwin, btrim, bor = (bmesh.new() for _ in range(7))
    cs, sn = math.cos(yaw), math.sin(yaw)

    def W(x, y, z):
        return (c[0] + x * cs - y * sn, c[1] + x * sn + y * cs, z)

    def prism_ring(w, d, z, lift=0.0, mid=0.0):
        """8-point eave ring at height z: corners lifted"""
        return [(-w / 2, -d / 2, z + lift), (0, -d / 2, z + mid), (w / 2, -d / 2, z + lift), (w / 2, 0, z + mid),
                (w / 2, d / 2, z + lift), (0, d / 2, z + mid), (-w / 2, d / 2, z + lift), (-w / 2, 0, z + mid)]
    # stone base: battered wall
    sb_w, sb_d, st_w, st_d, sh = 46.0, 38.0, 38.0, 30.0, 8.5
    bot = [(-sb_w / 2, -sb_d / 2), (sb_w / 2, -sb_d / 2), (sb_w / 2, sb_d / 2), (-sb_w / 2, sb_d / 2)]
    top = [(-st_w / 2, -st_d / 2), (st_w / 2, -st_d / 2), (st_w / 2, st_d / 2), (-st_w / 2, st_d / 2)]
    for i in range(4):
        j = (i + 1) % 4
        quad(bstone, [W(*bot[i], gz), W(*bot[j], gz), W(*top[j], gz + sh), W(*top[i], gz + sh)], mi=0)
    quad(bstone, [W(*p, gz + sh) for p in top], mi=0)
    z = gz + sh
    dims = [(31.0, 24.0, 7.4), (26.0, 20.0, 6.6), (21.0, 16.5, 6.0), (16.5, 13.0, 5.4), (12.0, 9.5, 5.0)]
    for k, (w, d, h) in enumerate(dims):
        box(bwall, W(0, 0, z), w, d, h, yaw, 0)                                       # white plaster body
        box(btrim, W(0, 0, z), w + 0.5, d + 0.5, 0.5, yaw, 0)                         # base band
        # windows: lit slits on all four faces
        for face, (fw, ox, oy, ang) in enumerate(((w, 0, -d / 2 - 0.04, 0), (w, 0, d / 2 + 0.04, 0), (d, -w / 2 - 0.04, 0, math.pi / 2), (d, w / 2 + 0.04, 0, math.pi / 2))):
            nwin = max(2, int(fw / 5.2))
            for q in range(nwin):
                u = -fw / 2 + (q + 0.5) * fw / nwin
                px = ox + (u if ang == 0 else 0)
                py = oy + (u if ang != 0 else 0)
                box(bwin, W(px, py, z + h * 0.45), 1.5 if ang == 0 else 0.1, 0.1 if ang == 0 else 1.5, 1.7, yaw, 0)
        # deep eaves with bracket rows
        ov = 3.6 - 0.25 * k
        zr = z + h
        ew, ed = w + 2 * ov, d + 2 * ov
        ring = prism_ring(ew, ed, zr, 1.5, -0.15)
        topw, topd = (w * 0.34, d * 0.30) if k < 4 else (w * 0.15, d * 0.12)
        rt = prism_ring(topw, topd, zr + (3.2 if k < 4 else 4.6), 0.0, 0.0)
        for q in range(8):
            q2 = (q + 1) % 8
            quad(broof, [W(*ring[q]), W(*ring[q2]), W(*rt[q2]), W(*rt[q])], mi=0)
        quad(broof, [W(*rt[q]) for q in range(8)], mi=0)
        quad(bwood, [W(ring[q][0], ring[q][1], ring[q][2] - 0.55) for q in range(7, -1, -1)], mi=0)       # soffit
        # white lime ridge lines on the four hips
        for q in (0, 2, 4, 6):
            seg_box(btrim, W(*ring[q]), W(*rt[q]), 0.35, 0.3)
        # white eave edge board
        for q in range(8):
            q2 = (q + 1) % 8
            seg_box(btrim, W(*ring[q]), W(*ring[q2]), 0.28, 0.5)
        # brackets under the eaves
        for face, (fw, base, dirn) in enumerate(((w, -d / 2, (0, -1)), (w, d / 2, (0, 1)), (d, -w / 2, (-1, 0)), (d, w / 2, (1, 0)))):
            nb = int(fw / 1.4)
            for q in range(nb):
                u = -fw / 2 + (q + 0.5) * fw / nb
                px, py = (u, base) if dirn[0] == 0 else (base, u)
                seg_box(bwood, W(px, py, zr - 0.2), W(px + dirn[0] * (ov * 0.8), py + dirn[1] * (ov * 0.8), zr - 0.8), 0.28, 0.3)
        # corner (oni-gawara) ornaments
        for q in (0, 2, 4, 6):
            x, y, zz = ring[q]
            seg_box(bor, W(x, y, zz), W(x * 1.03, y * 1.03, zz + 1.3 + 0.3 * (4 - k)), 0.28, 0.28)
        # karahafu curved gable on the long faces of tiers 1..3
        if k in (1, 2, 3):
            gw = w * 0.44
            for sgn in (-1, 1):
                pts = []
                for t in np.linspace(-1, 1, 15):
                    pts.append((t * gw / 2, sgn * (d / 2 + ov * 0.55), zr + 0.4 + 2.5 * (1 - abs(t) ** 1.6) + (0.9 if abs(t) < 0.35 else 0.0)))
                for q in range(len(pts) - 1):
                    quad(bwall, [W(pts[q][0], pts[q][1], zr + 0.3), W(pts[q + 1][0], pts[q + 1][1], zr + 0.3), W(*pts[q + 1]), W(*pts[q])], mi=0)
                    seg_box(broof, W(*pts[q]), W(*pts[q + 1]), 0.55, 0.45)
        z = zr + (2.6 if k < 4 else 0)
    # shachihoko at both ends of the top ridge
    ztop = gz + sh + sum(h for _, _, h in dims) + 4.6 + 1.5
    for sgn in (-1, 1):
        base = (sgn * dims[4][0] * 0.17, 0, ztop - 0.4)
        prev = base
        for q in range(7):
            t = q / 6
            nxt = (base[0] + sgn * (0.2 * t - 0.9 * t * t), 0, base[2] + 1.2 * q * (1 - 0.1 * q) + 0.2)
            seg_box(bor, W(*prev), W(*nxt), 0.55 * (1 - t * 0.7) + 0.15, 0.55 * (1 - t * 0.5) + 0.12)
            prev = nxt
    ms = {
        'wall': mat('V13 castle plaster', (0.86, 0.85, 0.8), 0.7, emit=(0.6, 0.65, 0.9), strength=0.28),
        'roof': mat('V13 castle roof tile', (0.035, 0.04, 0.05), 0.3, metal=0.2),
        'stone': mat('V13 castle stone', (0.2, 0.2, 0.2), 0.8, emit=(0.3, 0.3, 0.35), strength=0.08),
        'wood': mat('V13 castle eave wood', (0.12, 0.07, 0.04), 0.6, emit=(1.0, 0.55, 0.25), strength=0.25),
        'win': glow('V13 castle window warm', (1.0, 0.7, 0.35), 4.0),
        'trim': mat('V13 castle lime trim', (0.92, 0.92, 0.88), 0.6, emit=(0.6, 0.65, 0.9), strength=0.35),
        'orn': mat('V13 castle gold ornament', (0.8, 0.6, 0.15), 0.35, metal=0.8, emit=(1.0, 0.7, 0.2), strength=0.5),
    }
    for nm, bm_, m_ in (('plaster tiers', bwall, ms['wall']), ('upturned tiled eaves', broof, ms['roof']), ('stone base', bstone, ms['stone']),
                        ('bracketed eaves and soffits', bwood, ms['wood']), ('lit windows', bwin, ms['win']), ('lime ridge lines and eave boards', btrim, ms['trim']),
                        ('ridge ornaments', bor, ms['orn'])):
        to_obj('V13 castle | ' + nm, bm_, [m_], ARCH_CASTLE)
    new_light('V13 castle uplight warm', 'AREA', Vector((c[0] + 14, c[1] - 22, gz + 6)), 60000, (1.0, 0.8, 0.55), size=14, coll=ARCH_CASTLE)
    new_light('V13 castle uplight cool', 'AREA', Vector((c[0] - 18, c[1] + 20, gz + 6)), 50000, (0.6, 0.75, 1.0), size=14, coll=ARCH_CASTLE)


castle_old = [o for o in group_all(TOKENS['castle']) if o.name.startswith('V10 02 | white plaster five tier castle') and '| stone court' not in o.name]
lo_c, hi_c = V.bbox([o for o in castle_old if o.type == 'MESH'])
for o in castle_old:
    hide(o)
build_castle(((lo_c[0] + hi_c[0]) / 2, (lo_c[1] + hi_c[1]) / 2), float(lo_c[2]))
log('castle built')

# ------------------------------------------------------------------------------------------------ lantern hall: dense white paper lanterns with red marks (ref 12)
lh = [o for o in group_all(TOKENS['lantern_hall']) if o.type == 'MESH' and not o.hide_render]
lo_h, hi_h = V.bbox(lh)
hc = (lo_h + hi_h) / 2
ri, rd, rlat = cl.nearest(hc[0], hc[1])
u = Vector(cl.P[ri][:2]) - Vector(hc[:2])
u = u.normalized()
hw, hd = float(hi_h[0] - lo_h[0]), float(hi_h[1] - lo_h[1])
hu = (abs(u.x) * hw + abs(u.y) * hd) / 2
hv = (abs(u.y) * hw + abs(u.x) * hd) / 2
vdir = Vector((-u.y, u.x))
lm = bpy.data.meshes.new('V13 paper lantern')
bq = bmesh.new()
bmesh.ops.create_uvsphere(bq, u_segments=12, v_segments=8, radius=0.5)
for v in bq.verts:
    v.co.x *= 0.55
    v.co.y *= 0.55
    v.co.z *= 0.8
for f in bq.faces:
    f.material_index = 0
for sgn in (-1, 1):
    r = bmesh.ops.create_cone(bq, cap_ends=True, segments=10, radius1=0.13, radius2=0.13, depth=0.02)
    bmesh.ops.rotate(bq, verts=r['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bq, verts=r['verts'], vec=(0, sgn * 0.275, 0))
    for v in r['verts']:
        for f in v.link_faces:
            f.material_index = 1
bq.to_mesh(lm)
bq.free()
lm.materials.append(glow('V13 lantern paper white', (1.0, 0.93, 0.8), 3.2))
lm.materials.append(glow('V13 lantern red mark', (1.0, 0.05, 0.03), 5.0))
LHC = newcoll('V13 | lantern hall lanterns')
zb = float(lo_h[2])
nl = 0
span = hv - 7.0
for row, zr in enumerate((1.7, 2.9, 4.1, 5.3)):
    n = int(2 * span / 1.05)
    for q in range(n):
        t = -span + (q + (0.5 if row % 2 else 0)) * 2 * span / n
        pos = Vector(hc[:2]) + u * (hu - 6.2) + vdir * t
        ob = bpy.data.objects.new(f'V13 hall lantern {nl}', lm)
        ob.location = (pos.x, pos.y, zb + zr + 0.0)
        ob.rotation_euler.z = math.atan2(u.y, u.x) - math.pi / 2
        s_ = rnd.uniform(0.95, 1.1)
        ob.scale = (s_, s_, s_)
        LHC.objects.link(ob)
        nl += 1
new_light('V13 hall lantern wash', 'AREA', Vector((hc[0] + u.x * (hu + 2), hc[1] + u.y * (hu + 2), zb + 4)), 30000, (1.0, 0.85, 0.6), size=16, coll=LHC)
LOG['lantern hall lanterns'] = nl
log('lanterns', nl)

exec(compile(open(Path(__file__).with_name('art_v13_part2.py'), encoding='utf-8').read(), 'art_v13_part2.py', 'exec'))
