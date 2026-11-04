"""Scanned Poly Haven trees cut down to game weight, keeping their real leaves and bark. For one species:
    atlas     16 foliage clusters rendered unlit from the scan itself (leaves and twigs, the real thing) -> tex/trees/<id>_leaf.png
    card      the whole tree from 4 sides, same way -> tex/trees/<id>_card.png
    LOD0      decimated wood + leaf-cluster cards at the real clusters' places, about 1,500 tris
    LOD1      same, about 420 tris
    CARD      3 crossed planes, 6 tris
Normals point out of the crown so cards shade as one soft volume; vertex colours darken its inside and underside. Saved to out/trees/<id>.blend, compared with the scan in out/trees/cmp_<id>.png.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/qingshan/make_trees.py -Rest tree_small_02 -Log D:/RaceUltimate/tracks/qingshan/out/trees/make.log"""
import bpy, bmesh, math, sys
from pathlib import Path
import numpy as np
from mathutils import Vector
H = Path(r'D:/RaceUltimate/tracks/qingshan'); OUT = H / 'out' / 'trees'; TEX = H / 'tex' / 'trees'; OUT.mkdir(parents=True, exist_ok=True); TEX.mkdir(parents=True, exist_ok=True); PH = Path(r'D:/RaceUltimate/assets/polyhaven')
AID = sys.argv[sys.argv.index('--') + 1]; rng = np.random.default_rng(17)
TRUNK_R = 0.013; CELL = 512; WOOD0, WOOD1 = 380, 60; QUADS0, QUADS1 = 900, 180      # triangles of wood, leaf quads
sc = bpy.context.scene
ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in ids else 'BLENDER_EEVEE'
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(next((H / 'source' / AID).glob('*.gltf'))))
scan = [o for o in bpy.data.objects if o.type == 'MESH'][0]; bpy.context.view_layer.objects.active = scan; scan.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
n = len(scan.data.vertices); V = np.empty(n * 3); scan.data.vertices.foreach_get('co', V); V = V.reshape(-1, 3); lo, hi = V.min(0), V.max(0); base = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]]); size = hi - lo
print('scan', AID, 'tris', len(scan.data.polygons), 'size', size.round(2), flush=True)
mats = [m.name for m in scan.data.materials]; leaf_i = next(i for i, m in enumerate(mats) if 'leaves' in m); trunk_i = next((i for i, m in enumerate(mats) if 'trunk' in m or m == AID), 0)
f = len(scan.data.polygons); C = np.empty(f * 3); M = np.empty(f, dtype=np.int32); scan.data.polygons.foreach_get('center', C); scan.data.polygons.foreach_get('material_index', M); C = C.reshape(-1, 3)
leaves = C[M == leaf_i]; pick = rng.choice(len(leaves), min(40000, len(leaves)), replace=False); pts = leaves[pick]
def kmeans(p, k, it=12):
    c = p[rng.choice(len(p), k, replace=False)]
    for _ in range(it):
        d = ((p[:, None, :] - c[None, :, :]) ** 2).sum(2); l = d.argmin(1)
        c = np.array([p[l == j].mean(0) if (l == j).any() else c[j] for j in range(k)])
    d = ((p[:, None, :] - c[None, :, :]) ** 2).sum(2); l = d.argmin(1); r = np.array([np.sqrt(d[l == j, j].mean()) if (l == j).any() else 0.1 for j in range(k)]); w = np.bincount(l, minlength=k)
    return c, r, w
crown_c = pts.mean(0); crown_r = float(np.percentile(np.linalg.norm(pts - crown_c, axis=1), 96)); print('crown', crown_c.round(2), round(crown_r, 2), flush=True)

# ---------------------------------------------------------------------------------- unlit renders of the scan: albedo and alpha only, the game lights them
DEPTH = {}      # the slab being rendered, read by the shader through two value nodes
for m in scan.data.materials:
    nt = m.node_tree; P = next(q for q in nt.nodes if q.type == 'BSDF_PRINCIPLED'); sk = P.inputs['Base Color']; src = sk.links[0].from_socket if sk.is_linked else None
    geo = nt.nodes.new('ShaderNodeNewGeometry'); dot = nt.nodes.new('ShaderNodeVectorMath'); dot.operation = 'ABSOLUTE'; d2 = nt.nodes.new('ShaderNodeVectorMath'); d2.operation = 'DOT_PRODUCT'; nt.links.new(geo.outputs['Normal'], d2.inputs[0]); nt.links.new(geo.outputs['Incoming'], d2.inputs[1])
    ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'; nt.links.new(d2.outputs['Value'], ab.inputs[0]); fc = nt.nodes.new('ShaderNodeMapRange'); fc.inputs['From Min'].default_value = 0; fc.inputs['From Max'].default_value = 1; fc.inputs['To Min'].default_value = 0.62; fc.inputs['To Max'].default_value = 1.0; nt.links.new(ab.outputs[0], fc.inputs['Value'])
    camd = nt.nodes.new('ShaderNodeCameraData'); dp = nt.nodes.new('ShaderNodeMapRange'); dp.name = 'slab'; dp.inputs['To Min'].default_value = 1.0; dp.inputs['To Max'].default_value = 0.68; dp.clamp = True; nt.links.new(camd.outputs['View Z Depth'], dp.inputs['Value'])
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; nt.links.new(fc.outputs[0], m1.inputs[0]); nt.links.new(dp.outputs[0], m1.inputs[1]); mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
    if src: nt.links.new(src, mx.inputs[6])
    else: mx.inputs[6].default_value = sk.default_value
    nt.links.new(m1.outputs[0], mx.inputs[7]); nt.links.new(mx.outputs[2], P.inputs['Emission Color']); P.inputs['Emission Strength'].default_value = 1.0
    if src: nt.links.remove(sk.links[0])
    sk.default_value = (0, 0, 0, 1); P.inputs['Specular IOR Level'].default_value = 0.0; DEPTH[m.name] = src
w = bpy.data.worlds.new('none'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0
sc.render.film_transparent = True; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.render.resolution_x = sc.render.resolution_y = CELL
try: sc.eevee.taa_render_samples = 16; sc.eevee.use_raytracing = False
except Exception: pass
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
def shot(centre, direction, half, depth, name):
    d = Vector(direction).normalized(); cam.location = Vector(centre) - d * (depth + 1); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = half * 2; cam.data.clip_start = 1; cam.data.clip_end = 1 + 2 * depth
    for m in scan.data.materials: dp = m.node_tree.nodes['slab']; dp.inputs['From Min'].default_value = 1; dp.inputs['From Max'].default_value = 1 + 2 * depth
    p = OUT / f'_{name}.png'; sc.render.filepath = str(p); bpy.ops.render.render(write_still=True); im = bpy.data.images.load(str(p)); a = np.array(im.pixels[:], dtype=np.float32).reshape(CELL, CELL, 4)[::-1].copy(); bpy.data.images.remove(im); p.unlink(); return a
def soften(a, seed):
    """irregular round outline, so a cluster never shows the card's square edge"""
    r = np.random.default_rng(seed); g = r.random((9, 9)); x = np.linspace(0, 8, CELL); i = np.clip(x.astype(int), 0, 7); t = x - i
    nz = np.array([np.interp(x, np.arange(9), g[q]) for q in range(9)]); nz = np.array([np.interp(x, np.arange(9), nz[:, c]) for c in range(CELL)]).T
    yy, xx = np.mgrid[0:CELL, 0:CELL]; d = np.hypot(xx - CELL / 2, yy - CELL / 2) / (CELL / 2); a[..., 3] *= (d < 0.72 + 0.26 * nz); return a
def bleed(a, n=10):
    """leaf colour into the transparent pixels, or mips and coverage show a dark fringe"""
    rgb, cov = a[..., :3].copy(), (a[..., 3] > 0.02).astype(np.float32); rgb *= cov[..., None]
    for _ in range(n):
        s = sum(np.roll(rgb, q, ax) for q in (-1, 1) for ax in (0, 1)); c = sum(np.roll(cov, q, ax) for q in (-1, 1) for ax in (0, 1)); new = (cov == 0) & (c > 0); rgb[new] = s[new] / c[new, None]; cov[new] = 1
    rgb[cov == 0] = rgb[cov > 0].mean(0); a[..., :3] = rgb; return a
LEAF_GAIN = 1.55      # scan albedo reads near black on a wall in shade: real leaves pass light through, cards can't
def save(a, name):
    a = a.copy(); a[..., :3] = np.clip(a[..., :3] ** 0.92 * LEAF_GAIN, 0, 1)
    h, w_ = a.shape[:2]; im = bpy.data.images.new(name, w_, h, alpha=True, float_buffer=False); im.pixels.foreach_set(a[::-1].ravel()); im.filepath_raw = str(TEX / f'{name}.png'); im.file_format = 'PNG'; im.save(); return im
ZOOM = float(np.clip(10.0 / size[2], 1.0, 2.3))      # the scans get scaled up to forest height: more, smaller leaves on each card, so a leaf stays leaf-sized
ck, rk, wk = kmeans(pts[::5], 40); order = np.argsort(-wk); cell_r = crown_r * 0.135; atlas = np.zeros((CELL * 4, CELL * 4, 4), dtype=np.float32); used = []; cov = []
for q in range(16):
    j = order[q]; out = ck[j] - crown_c; out = out / (np.linalg.norm(out) + 1e-6); view = -(out + rng.normal(0, .35, 3)); cell = shot(ck[j], view, cell_r * ZOOM, cell_r * 0.28 / ZOOM, f'c{q}'); cov.append(float((cell[..., 3] > .5).mean())); cell = bleed(soften(cell, q)); atlas[(q // 4) * CELL:(q // 4 + 1) * CELL, (q % 4) * CELL:(q % 4 + 1) * CELL] = cell
print('cluster radius', round(cell_r, 3), 'coverage', np.round(cov, 2).tolist(), flush=True)
leaf_img = save(atlas, f'{AID}_leaf')
mid = np.array([base[0], base[1], lo[2] + size[2] / 2]); half = float(max(size) * 0.52); card = np.zeros((CELL * 2, CELL * 2, 4), dtype=np.float32); deg = (0, 60, 120, 30)
for q, a_ in enumerate(deg):
    cell = bleed(shot(mid, (math.sin(math.radians(a_)), math.cos(math.radians(a_)), 0), half, float(max(size)), f'v{q}'), 8); card[(q // 2) * CELL:(q // 2 + 1) * CELL, (q % 2) * CELL:(q % 2 + 1) * CELL] = cell
card_img = save(card, f'{AID}_card')

# ---------------------------------------------------------------------------------- materials the game can use
def cutout(name, img):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; P = nt.nodes['Principled BSDF']; it = nt.nodes.new('ShaderNodeTexImage'); it.image = img; rd = nt.nodes.new('ShaderNodeMath'); rd.operation = 'ROUND'
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'; mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1; nt.links.new(it.outputs['Color'], mx.inputs[6]); nt.links.new(vc.outputs['Color'], mx.inputs[7]); nt.links.new(mx.outputs[2], P.inputs['Base Color'])
    nt.links.new(it.outputs['Alpha'], rd.inputs[0]); nt.links.new(rd.outputs[0], P.inputs['Alpha']); P.inputs['Roughness'].default_value = 0.72; P.inputs['Specular IOR Level'].default_value = 0.25; m.surface_render_method = 'DITHERED'; return m
leaf_m, card_m = cutout(f'TREE {AID} leaves', leaf_img), cutout(f'TREE {AID} card Far', card_img)
wood_m = bpy.data.materials.new(f'TREE {AID} wood'); wood_m.use_nodes = True; nt = wood_m.node_tree; P = nt.nodes['Principled BSDF']; tx = H / 'source' / AID / 'textures'
stem = next(iter(sorted(p.stem for p in tx.glob('*branch*_diff_2k.jpg'))), None) or next(q for q in sorted(p.stem for p in tx.glob('*_diff_2k.jpg')) if 'leaves' not in q); stem = stem.replace('_diff_2k', '')      # the branch bark tiles; the trunk map is an unwrapped scan
id_ = nt.nodes.new('ShaderNodeTexImage'); id_.image = bpy.data.images.load(str(tx / f'{stem}_diff_2k.jpg')); nt.links.new(id_.outputs['Color'], P.inputs['Base Color']); ia = nt.nodes.new('ShaderNodeTexImage'); ia.image = bpy.data.images.load(str(tx / f'{stem}_arm_2k.jpg')); ia.image.colorspace_settings.name = 'Non-Color'; sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(ia.outputs['Color'], sp.inputs['Color']); nt.links.new(sp.outputs['Green'], P.inputs['Roughness'])
inn = nt.nodes.new('ShaderNodeTexImage'); inn.image = bpy.data.images.load(str(tx / f'{stem}_nor_gl_2k.jpg')); inn.image.colorspace_settings.name = 'Non-Color'; nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(inn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], P.inputs['Normal'])

# ---------------------------------------------------------------------------------- wood: tubes measured from the scan's own trunk, slice by slice, so forks and lean are real; fine limbs live in the leaf cards
tp = C[M == trunk_i]; NS = 16; dz = float(size[2]) / NS; cellz = float(max(size)) * 0.018; nodes = []
for k_ in range(NS):
    q = tp[(tp[:, 2] >= lo[2] + k_ * dz) & (tp[:, 2] < lo[2] + (k_ + 1) * dz)]; found = []
    if len(q):
        keys = np.floor(q[:, :2] / cellz).astype(int); cells = {}
        for i_, kk in enumerate(map(tuple, keys)): cells.setdefault(kk, []).append(i_)
        left = set(cells)
        while left:
            st = [left.pop()]; mem = []
            while st:
                c_ = st.pop(); mem += cells[c_]
                for dx_ in (-1, 0, 1):
                    for dy_ in (-1, 0, 1):
                        nb = (c_[0] + dx_, c_[1] + dy_)
                        if nb in left: left.remove(nb); st.append(nb)
            g_ = q[mem]; ctr_ = g_.mean(0); rad = float(np.median(np.hypot(*(g_[:, :2] - ctr_[:2]).T)))
            taper = 1 - 0.65 * (ctr_[2] - lo[2]) / size[2]      # clusters can merge two limbs: never wider than a trunk of this height tapers to
            if len(mem) >= 12: found.append((ctr_, min(rad, float(size[2]) * TRUNK_R * taper)))
    nodes.append(found)
segs = []; grown = {id(a_) for a_, _ in nodes[0]}      # only what grows from the ground: a limb cut off from it would float in the crown
for k_ in range(NS - 1):
    for a_, ra in nodes[k_]:
        if not nodes[k_ + 1] or id(a_) not in grown: continue
        b_, rb = min(nodes[k_ + 1], key=lambda e_: np.linalg.norm(e_[0] - a_))
        if np.linalg.norm(b_ - a_) < dz * 3.0: segs.append((a_, ra, b_, rb)); grown.add(id(b_))
if segs and nodes[0]:      # down to the ground
    for a_, ra in nodes[0]: segs.append((np.array([a_[0], a_[1], lo[2] - 0.02]), ra * 1.15, a_, ra))
segs.sort(key=lambda e_: e_[0][2] - 2 * e_[1] * size[2]); print('trunk segments', len(segs), 'radius', round(segs[0][1], 3) if segs else None, flush=True)
BARK_M = float(max(size)) * 0.14
def tubes(name, sides, budget):
    bm = bmesh.new(); uv = bm.loops.layers.uv.verify(); use = segs[:max(1, budget // (2 * sides))]
    for a_, ra, b_, rb in use:
        ax = Vector(b_ - a_).normalized(); u_ = ax.cross(Vector((1, 0, 0))); u_ = (u_ if u_.length > .1 else ax.cross(Vector((0, 1, 0)))).normalized(); v_ = ax.cross(u_); ring = lambda c_, r_: [bm.verts.new(Vector(c_) + (u_ * math.cos(2 * math.pi * i_ / sides) + v_ * math.sin(2 * math.pi * i_ / sides)) * r_) for i_ in range(sides)]; A, B = ring(a_, ra), ring(b_, rb)
        for i_ in range(sides):
            j_ = (i_ + 1) % sides; f_ = bm.faces.new((A[i_], A[j_], B[j_], B[i_])); f_.smooth = True; v0, v1 = a_[2] / BARK_M, b_[2] / BARK_M
            for l, (x_, y_) in zip(f_.loops, ((i_, v0), (i_ + 1, v0), (i_ + 1, v1), (i_, v1))): l[uv].uv = (x_ / sides * 0.7, y_)
    bmesh.ops.triangulate(bm, faces=bm.faces[:]); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(wood_m); o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); return o
w0, w1 = tubes('w0', 7, WOOD0), tubes('w1', 3, WOOD1)
def add_cards(o, quads, seed):
    r = np.random.default_rng(seed); c_, r_, w_ = kmeans(pts[r.choice(len(pts), min(8000, len(pts)), replace=False)], quads, it=8); grow = math.sqrt(QUADS0 / quads)      # fewer cards: each covers more
    bm = bmesh.new(); bm.from_mesh(o.data); uv = bm.loops.layers.uv.verify(); col = bm.loops.layers.float_color.get('Col') or bm.loops.layers.float_color.new('Col'); zlo, zhi = pts[:, 2].min(), pts[:, 2].max(); bm.faces.ensure_lookup_table()
    for f_ in bm.faces:
        for l in f_.loops: l[col] = (1, 1, 1, 1)
    for j in range(quads):
        out = c_[j] - crown_c; dist = float(np.linalg.norm(out)); out = out / (dist + 1e-6)
        nrm = out + r.normal(0, .6, 3) + np.array([0, 0, .2]); nrm /= np.linalg.norm(nrm); u = np.cross(nrm, r.normal(0, 1, 3)); u /= np.linalg.norm(u); v = np.cross(nrm, u)
        s_ = cell_r * grow * r.uniform(.85, 1.2); p_ = c_[j]; cell = int(r.integers(16)); cu, cv = (cell % 4) / 4, (3 - cell // 4) / 4
        quad = [p_ + (-u - v) * s_, p_ + (u - v) * s_, p_ + (u + v) * s_, p_ + (-u + v) * s_]; vs = [bm.verts.new(q) for q in quad]; f_ = bm.faces.new(vs); f_.material_index = 1
        t = min(1.0, dist / crown_r); up = (p_[2] - zlo) / max(zhi - zlo, 1e-3); shade = (0.74 + 0.16 * t + 0.10 * up) * r.uniform(.88, 1.0)
        for l, (a_, b_) in zip(f_.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uv].uv = (cu + a_ / 4, cv + b_ / 4); l[col] = (shade, shade, shade * 0.95, 1)
    bm.to_mesh(o.data); bm.free(); me = o.data; me.materials.append(leaf_m); cc = Vector(crown_c)
    for p in me.polygons:
        if p.material_index == 1: p.use_smooth = True
    vn = [None] * len(me.vertices)
    for p in me.polygons:
        if p.material_index == 1:
            for vi in p.vertices: vn[vi] = (me.vertices[vi].co - cc).normalized()
    me.normals_split_custom_set_from_vertices([(tuple(a) if a is not None else tuple(me.vertices[i].normal)) for i, a in enumerate(vn)])
    return o
for o, q, name in ((w0, QUADS0, f'TREE {AID} LOD0'), (w1, QUADS1, f'TREE {AID} LOD1')):
    add_cards(o, q, 3 if q == QUADS0 else 5); o.name = name; o.data.name = name
    v = np.empty(len(o.data.vertices) * 3); o.data.vertices.foreach_get('co', v); o.data.vertices.foreach_set('co', (v.reshape(-1, 3) - base).ravel()); o.data.update()
bm = bmesh.new(); uv = bm.loops.layers.uv.verify(); col = bm.loops.layers.float_color.new('Col')
for q, a_ in enumerate(deg[:3]):
    th = math.radians(a_); dx, dy = math.cos(th) * half, -math.sin(th) * half; z0, z1 = mid[2] - half - lo[2], mid[2] + half - lo[2]; cu, cv = (q % 2) / 2, (1 - q // 2) / 2
    f_ = bm.faces.new([bm.verts.new(p) for p in ((-dx, -dy, z0), (dx, dy, z0), (dx, dy, z1), (-dx, -dy, z1))])
    for l, (a2, b2) in zip(f_.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uv].uv = (cu + a2 / 2, cv + b2 / 2); l[col] = (.60, .64, .50, 1)
me = bpy.data.meshes.new(f'TREE {AID} CARD'); bm.to_mesh(me); bm.free(); me.materials.append(card_m); cd = bpy.data.objects.new(f'TREE {AID} CARD', me); sc.collection.objects.link(cd)
tri = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
print('LOD0', tri(w0), 'LOD1', tri(w1), 'CARD', tri(cd), flush=True)

# ---------------------------------------------------------------------------------- the comparison: scan and each LOD under the game's day sky, two distances
scan.location = (-base[0], -base[1], -base[2]); step = float(max(size)) * 1.15
for m in scan.data.materials:      # back to lit
    nt = m.node_tree; P = next(q for q in nt.nodes if q.type == 'BSDF_PRINCIPLED')
    if DEPTH[m.name]: nt.links.new(DEPTH[m.name], P.inputs['Base Color'])
    P.inputs['Emission Strength'].default_value = 0; P.inputs['Specular IOR Level'].default_value = 0.5
bpy.data.objects[f'TREE {AID} LOD0'].location = (step, 0, 0); bpy.data.objects[f'TREE {AID} LOD1'].location = (step * 2, 0, 0); cd.location = (step * 3, 0, 0)
for o in (w0, w1): o.data.update()
sc.render.film_transparent = False; sc.view_settings.view_transform = 'AgX'; sc.render.resolution_x, sc.render.resolution_y = 1600, 520; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
env = w.node_tree.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(str(PH / 'qwantani_noon_puresky/qwantani_noon_puresky_2k.hdr')); w.node_tree.links.new(env.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color'])
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.rotation_euler = (math.radians(50), 0, math.radians(320)); sun.data.energy = 3.0
cam.data.type = 'PERSP'; cam.data.lens = 50; cam.data.clip_start = .1; cam.data.clip_end = 2000; ctr = Vector((step * 1.5, 0, size[2] * .5)); cam.location = ctr + Vector((0, -step * 6.2, size[2] * .1)); cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=step * 12, location=(step * 1.5, 0, 0)); gp = bpy.context.object; gm = bpy.data.materials.new('g'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.12, .16, .07, 1); gp.data.materials.append(gm)
sc.render.filepath = str(OUT / f'cmp_{AID}.png'); bpy.ops.render.render(write_still=True)
ctr = Vector((step * 0.5, 0, size[2] * .55)); cam.data.lens = 28; sc.render.resolution_x, sc.render.resolution_y = 1400, 800; cam.location = ctr + Vector((0, -11.4 * size[2] / 4.56 * 1.0, -size[2] * .35)); cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = str(OUT / f'close_{AID}.png'); bpy.ops.render.render(write_still=True)
bpy.data.objects.remove(gp, do_unlink=True); bpy.data.objects.remove(scan, do_unlink=True); bpy.data.objects.remove(cam, do_unlink=True); bpy.data.objects.remove(sun, do_unlink=True)
for o in (w0, w1, cd): o.location = (0, 0, 0)
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.ops.file.pack_all() if False else None
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f'{AID}.blend'))
print('done', flush=True)
