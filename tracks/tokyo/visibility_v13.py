"""Landmark visibility along the track (v13).

    powershell tracks/tokyo/run_blender.ps1 -Blend tracks/tokyo/out/tokyo_v12.blend -Script tracks/tokyo/visibility_v13.py -Rest v12

Every ~20 m of centerline, at driver height (1.2 m above the road), rays go to 9 points of each hero landmark's bounding box
(4 top corners at 85 % height, 4 mid-height corners inset 15 %, top centre). A landmark is VISIBLE from a position when >= 3 points are
unobstructed within 1.5 km. AHEAD means it is also within 60 degrees of the direction of travel and nearer than 900 m (what a
driver actually sees through the windscreen). Foliage, fences, signs, road furniture, water and the sky band do not block.
Writes out/visibility-<label>.json: los_pct, ahead_pct, longest ahead run in metres and where it starts (station).
"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v12_common as C  # noqa: E402

LANDMARKS = {
    'castle': ('V10 02 |', 'V13 castle'), 'hq': ('V10 04 |', 'V10 HQ', 'V13 HQ'), 'gate': ('V10 01 |',), 'pagoda': ('V12 pagoda',),
    'lantern_hall': ('V10 06 |', 'V10 lantern hall'), 'timber_tower': ('V10 05 |',), 'woven_hall': ('V10 07 |',),
    'neon_gate': ('V10 09 |', 'V10 neon shrine'), 'ferris_wheel': ('120m', 'Wheel A', 'Central park wheel', 'Gondola'),
    'bridge': ('Rounded portal tower', 'Suspension system'), 'garden_temple': ('V10 03 |', 'V10 garden'),
}
IGNORE = ('catch fence', 'searchlight', 'skyline', 'water', 'V12 painted', 'bay shore', 'lagoon', 'pylon', 'lantern', 'sponsor', 'V9 barrier',
          'Kerb', 'Continuous', 'Sakura', 'Green canopy', 'Shrine grove', 'Avenue framing', 'V12 sakura', 'V12 crowd', 'LED', 'text', 'Tenant',
          'Lit tenant', 'Neon blade', 'Japanese blade', 'Shop fascia', 'Start chequer', 'V12 red', 'Dashed', 'Catch fence', 'asphalt', 'wall LED',
          'V12 gate lantern', 'cloud', 'crowd', 'V13 hall lantern', 'V13 hologram', 'HOLO_')


def hide_ignored(sc):
    """hide (viewport) every object a driver sees through: foliage, fences, signs, crowd cutouts ... returns the list to restore"""
    hid = []
    for o in sc.objects:
        if o.type in ('MESH', 'FONT', 'CURVE') and not o.hide_viewport and any(k in o.name for k in IGNORE):
            o.hide_viewport = True
            hid.append(o)
    bpy.context.view_layer.update()
    return hid


def restore_hidden(hid):
    for o in hid:
        o.hide_viewport = False
    bpy.context.view_layer.update()


def group_objs(sc, prefixes):
    return [o for o in sc.objects if o.type == 'MESH' and not o.hide_render and o.name.startswith(prefixes)]


def bbox(objs):
    pts = np.array([list(o.matrix_world @ Vector(v)) for o in objs for v in o.bound_box])
    return pts.min(0), pts.max(0)


def targets(lo, hi):
    c = (lo + hi) / 2
    h = hi[2] - lo[2]
    ins = 0.15
    out = []
    for sx in (lo[0], hi[0]):
        for sy in (lo[1], hi[1]):
            out.append(np.array([sx, sy, lo[2] + 0.85 * h]))
            out.append(np.array([c[0] + (sx - c[0]) * (1 - ins), c[1] + (sy - c[1]) * (1 - ins), lo[2] + 0.5 * h]))
    out.append(np.array([c[0], c[1], lo[2] + 0.9 * h]))
    return out


def ray_clear(sc, dg, o, t, own):
    d = Vector(t) - o
    dist = d.length
    if dist > 1500:
        return False
    d.normalize()
    org = o.copy()
    for _ in range(40):
        hit, loc, nrm, idx, ob, mat = sc.ray_cast(dg, org, d, distance=dist)
        if not hit:
            return True
        if ob.name in own:
            return True
        if any(k in ob.name for k in IGNORE):
            travelled = (loc - o).length + 0.05
            org = loc + d * 0.05
            dist = (Vector(t) - org).length
            if dist <= 0.5:
                return True
            continue
        return (loc - o).length > (Vector(t) - o).length - 2.5
    return True


def eval_positions(sc, dg, cl, tg, ctr, stations, own=frozenset()):
    """(visible, ahead) per station for a set of target points (used by the placement search and by measure)"""
    out = []
    for i in stations:
        o = Vector(cl.P[i]) + Vector((0, 0, 1.2))
        n = 0
        for t in tg:
            if ray_clear(sc, dg, o, t, own):
                n += 1
                if n >= 3:
                    break
        v = n >= 3
        dx, dy = ctr[0] - cl.P[i, 0], ctr[1] - cl.P[i, 1]
        dist = math.hypot(dx, dy)
        ang = math.degrees(math.acos(max(-1, min(1, (dx * cl.T[i, 0] + dy * cl.T[i, 1]) / max(dist, 1e-6)))))
        out.append((v, v and ang < 60 and dist < 900))
    return out


def longest_run(flags, stride):
    best, run, start = 0, 0, 0
    for k, f in enumerate(flags):
        run = run + 1 if f else 0
        if run > best:
            best, start = run, k - run + 1
    return best * stride * C.STEP, start


def measure(sc, cl, names=None, stride=10, stations=None, lm=None):
    hid = hide_ignored(sc)
    dg = bpy.context.evaluated_depsgraph_get()
    res = {}
    for name, pref in (lm or LANDMARKS).items():
        if names and name not in names:
            continue
        objs = group_objs(sc, pref)
        if not objs:
            continue
        own = {o.name for o in objs}
        lo, hi = bbox(objs)
        tg = targets(lo, hi)
        ctr = (lo + hi) / 2
        st = stations if stations is not None else list(range(0, cl.M, stride))
        vis, ahead = [], []
        for i in st:
            o = Vector(cl.P[i]) + Vector((0, 0, 1.2))
            n = sum(ray_clear(sc, dg, o, t, own) for t in tg)
            v = n >= 3
            dx, dy = ctr[0] - cl.P[i, 0], ctr[1] - cl.P[i, 1]
            dist = math.hypot(dx, dy)
            ang = math.degrees(math.acos(max(-1, min(1, (dx * cl.T[i, 0] + dy * cl.T[i, 1]) / max(dist, 1e-6)))))
            vis.append(v)
            ahead.append(v and ang < 60 and dist < 900)
        a = np.array(ahead)
        best = (0, 0)
        run = 0
        for k, f in enumerate(a):
            run = run + 1 if f else 0
            if run > best[0]:
                best = (run, k - run + 1)
        res[name] = dict(los_pct=round(100 * float(np.mean(vis)), 1), ahead_pct=round(100 * float(a.mean()), 1),
                         longest_ahead_run_m=int(best[0] * stride * C.STEP), run_starts_station=int(st[best[1]]) if best[0] else None,
                         centre=[round(float(x)) for x in ctr], samples=len(st))
    restore_hidden(hid)
    return res


if __name__ == '__main__':
    label = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'scene'
    sc = bpy.context.scene
    cl = C.CL()
    r = measure(sc, cl)
    (C.O / f'visibility-{label}.json').write_text(json.dumps(r, indent=1))
    for k, v in r.items():
        print('[vis]', k, v)
