"""How sharp each of Venice's textures can actually be seen from the road: for every material, how near a driver gets (from any point of the road, 1.1 m up) and how many metres one repeat of its texture covers, so how many pixels of texture land on one pixel of the screen there.
python measure_texture_need.py [out/venice_visual.glb]    prints a table and writes out/texture_need.json. A cap is only safe where a material's *nearest* use still can't resolve more than the cap: the 2x margin is for walls seen at a grazing angle, where anisotropic filtering keeps more detail along one axis."""
import json, struct, sys
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
H = Path(__file__).parent; src = Path(sys.argv[1]) if len(sys.argv) > 1 else H / 'out' / 'venice_visual.glb'
C = np.array(json.loads((H.parent.parent / 'track-viewer/public/assets/venice/track.json').read_text(encoding='utf8'))['centerline'])
HALF_ROAD, EYE, W_PX, FOV = 8.0, 1.1, 2560, 72.0     # the road's half width; a low eye; a big monitor and the widest view (hood), the case that shows the most
F = open(src, 'rb'); F.read(12); n, _ = struct.unpack('<II', F.read(8)); g = json.loads(F.read(n)); n2, _ = struct.unpack('<II', F.read(8)); BIN = F.read(n2)
def acc(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]; c = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a['componentType']]; k = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    return np.frombuffer(BIN, c, a['count'] * k, bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, k)
road = cKDTree(np.column_stack((C[:, 0], C[:, 1] + EYE, C[:, 2])))
need = {}
for node in g['nodes']:
    if 'mesh' not in node: continue
    assert not any(k in node for k in ('translation', 'rotation', 'scale', 'matrix')), node['name']
    for p in g['meshes'][node['mesh']]['primitives']:
        m = g['materials'][p['material']]['name']; P = acc(p['attributes']['POSITION']).astype(np.float64); I = acc(p['indices']).ravel().astype(np.int64).reshape(-1, 3); UV = acc(p['attributes']['TEXCOORD_0']).astype(np.float64) if 'TEXCOORD_0' in p['attributes'] else None
        a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
        pts = [a, b, c, (a + b + c) / 3, (a + b) / 2, (b + c) / 2, (c + a) / 2]      # long wall triangles: their edges and middle, not just corners
        d = np.min([np.maximum(road.query(q)[0] - HALF_ROAD, 1.0) for q in pts], axis=0)
        r = need.setdefault(m, {'tris': 0, 'd': [], 'mpu': []}); r['tris'] += len(I); r['d'].append(d)
        if UV is not None:
            ua, ub, uc = UV[I[:, 0]], UV[I[:, 1]], UV[I[:, 2]]
            A3 = np.linalg.norm(np.cross(b - a, c - a), axis=1); AU = np.abs((ub[:, 0] - ua[:, 0]) * (uc[:, 1] - ua[:, 1]) - (ub[:, 1] - ua[:, 1]) * (uc[:, 0] - ua[:, 0]))
            ok = (AU > 1e-9) & (A3 > 1e-6); r['mpu'].append(np.column_stack((d[ok], np.sqrt(A3[ok] / AU[ok]))))
px = 2 * np.tan(np.radians(FOV / 2)) / W_PX      # one screen pixel's width per metre of distance
out = {}
for m, r in sorted(need.items()):
    d = np.concatenate(r['d']); row = {'tris': r['tris'], 'near_m': round(float(d.min()), 1), 'p1_m': round(float(np.percentile(d, 1)), 1), 'p50_m': round(float(np.median(d)), 1)}
    if r['mpu']:
        mu = np.concatenate(r['mpu'])
        if len(mu):
            # the texture pixels per repeat that could still be told apart at this material's nearest, among its triangles at that range and for its finest UV scale in use
            mpu = float(np.percentile(mu[:, 1], 5)); nearest = float(np.percentile(mu[:, 0], 0.2)); row['m_per_repeat'] = round(mpu, 2); row['resolvable_px'] = int(mpu / (px * max(nearest, 1.0)) * 2)
    out[m] = row
    print(f"{m:44s} {row['tris']:7d} tris  nearest {row['near_m']:6.1f} m  p1 {row['p1_m']:6.1f}  median {row['p50_m']:6.1f}  repeat {row.get('m_per_repeat', 0):6.2f} m  resolvable {row.get('resolvable_px', 0):6d} px")
(H / 'out' / 'texture_need.json').write_text(json.dumps(out, indent=1), encoding='utf8')
