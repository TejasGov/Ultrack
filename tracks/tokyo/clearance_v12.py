"""Road-envelope clearance check (plan view) for venue, stand and architecture objects.

    powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/clearance_v12.py -Blend tracks/tokyo/out/tokyo_japanese_v10.blend -Rest v10

Rule: no geometry of a checked object within ENVELOPE = road half width 9 + kerb 1.0 + run-off 3 + margin 1.5 = 14.5 m of the
centerline (out/centerline-v10.json, polyline, plan distance, any height, so roofs may not overhang the road). Every vertex of the
evaluated mesh counts. Hidden (render-hidden) objects are skipped. Road-spanning gantries/bridges/tunnels are not in these collections.
Writes out/clearance-<label>.json: violators with the minimum distance and the nearest centerline index.
"""
import bpy, json, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

O = Path(__file__).resolve().parent / 'out'
HALF_W, KERB, RUNOFF, MARGIN = 9.0, 1.0, 3.0, 1.5
ENVELOPE = HALF_W + KERB + RUNOFF + MARGIN
CHECK_COLLS = ('V3 | district architecture', 'V3 | cedar stadiums', 'V8 | neon depth architecture', 'V9 | architectural diversity',
               'V9 | cultural landmarks', 'V10 | Japanese district architecture', 'V10 | nine reference landmarks',
               'V10 | curved race venues', 'V4 | event infrastructure')
CHECK_PREFIX = ('V12 |',)          # every V12 collection whose name has venue / stand / architecture in it
CHECK_WORDS = ('venue', 'stand', 'architecture', 'landmark')


def centerline_kd(step=1.0):
    pts = json.load(open(O / 'centerline-v10.json'))['points']
    P = [Vector((p[0], p[1], 0)) for p in pts]
    kd_pts = []
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        n = max(1, int((b - a).length / step))
        for k in range(n):
            kd_pts.append((a.lerp(b, k / n), i))
    kd = KDTree(len(kd_pts)); [kd.insert(p, j) for j, (p, _) in enumerate(kd_pts)]; kd.balance()
    return kd, kd_pts


def checked_objects():
    seen = set()
    for c in bpy.data.collections:
        n = c.name
        if n in CHECK_COLLS or (n.startswith(CHECK_PREFIX) and any(w in n.lower() for w in CHECK_WORDS)):
            for o in c.all_objects:
                if o.name not in seen:
                    seen.add(o.name)
                    yield o


def visible(o):
    return not o.hide_render and all(not c.hide_render for c in o.users_collection)


def min_dist(o, kd, kd_pts, dg):
    """min plan distance of the evaluated vertices (instances are walked through their collection)"""
    best = (1e9, -1)
    mats = []
    if o.instance_type == 'COLLECTION' and o.instance_collection:
        for s in o.instance_collection.all_objects:
            if s.type == 'MESH':
                mats.append((s, o.matrix_world @ (o.instance_collection.instance_offset * -1 and s.matrix_world)))
        srcs = mats
    elif o.type in ('MESH', 'CURVE'):
        srcs = [(o, o.matrix_world)]
    else:
        srcs = []
    for s, mw in srcs:
        me = s.to_mesh(depsgraph=dg) if s.type == 'MESH' else None
        if me is None:
            continue
        n = len(me.vertices)
        if n == 0:
            s.to_mesh_clear(); continue
        co = np.empty(n * 3, dtype=np.float64); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        M = np.array(mw); w = co @ M[:3, :3].T + M[:3, 3]
        s.to_mesh_clear()
        # prefilter on the kd with a coarse grid: check each vertex (cap at 60k by striding; the envelope is wide vs vertex spacing)
        stride = max(1, n // 60000)
        for x, y in w[::stride, :2]:
            _, j, d = kd.find((x, y, 0))
            if d < best[0]:
                best = (d, kd_pts[j][1])
    return best


def run(label):
    kd, kd_pts = centerline_kd()
    dg = bpy.context.evaluated_depsgraph_get()
    res, ok = [], 0
    for o in checked_objects():
        if not visible(o) or o.type not in ('MESH', 'EMPTY'):
            continue
        d, idx = min_dist(o, kd, kd_pts, dg)
        if d < ENVELOPE:
            res.append(dict(name=o.name, min_dist=round(d, 2), nearest_cl_index=idx, collections=[c.name for c in o.users_collection]))
        else:
            ok += 1
    res.sort(key=lambda r: r['min_dist'])
    out = dict(label=label, envelope_m=ENVELOPE, rule='plan distance to centerline of any vertex >= %.1f m' % ENVELOPE,
               checked=ok + len(res), violators=len(res), clear=ok, list=res)
    (O / f'clearance-{label}.json').write_text(json.dumps(out, indent=1))
    print('[clearance]', label, 'checked', out['checked'], 'violators', len(res))
    for r in res[:80]:
        print('   ', r['min_dist'], r['name'])
    return out


if __name__ == '__main__':
    run(sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'scene')
