# exec'd by game_v13_1_part2.py: distance tiers (tags read by track-viewer/src/perf.js), merging, materials, collision, json, export.
import numpy as np  # noqa: E402


def tagname(base, lo, hi):
    return f"{base}{TAG}{int(lo)}-{'' if hi is None else int(hi)}"


def mesh_dims(me):
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    return co.max(0) - co.min(0)


def clone_obj(src, name, data):
    ob = bpy.data.objects.new(name, data)
    ob.matrix_world = src.matrix_world.copy()
    for c in src.users_collection:
        c.objects.link(ob)
    return ob


TIERS = {}


# ------------------------------------------------------------------------------------------------ 5. trees: full -> 22 % copy -> crossed card
def far_card(h, w, mat_, name):
    bm = bmesh.new()
    q(bm, [(-w / 2, 0, 0), (w / 2, 0, 0), (w / 2, 0, h), (-w / 2, 0, h)], 0, [(0, 0), (1, 0), (1, 1), (0, 1)])
    q(bm, [(0, -w / 2, 0), (0, w / 2, 0), (0, w / 2, h), (0, -w / 2, h)], 0, [(0, 0), (1, 0), (1, 1), (0, 1)])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat_)
    return me


TREE_PREF = ('Sakura ', 'V12 sakura lining', 'V13.1 garden sakura', 'Avenue framing sakura', 'Green canopy', 'Shrine grove cedar canopy')
fam_of = lambda o: 'cedar' if o.name.startswith('Shrine grove') else ('canopy' if o.name.startswith('Green canopy') else 'sakura')
trees = [o for o in VIS.objects if o.type == 'MESH' and o.name.startswith(TREE_PREF) and not o.name.startswith('Sakura master')]
TREE_TIER = {'sakura': (38, 240, 2800, 20000, (0.97, 0.75, 0.79)), 'canopy': (55, 280, 2800, 5000, (0.10, 0.20, 0.07)), 'cedar': (55, 280, 2800, 5000, (0.05, 0.14, 0.07))}
heroes = {}
for fam, (da, db, dc, thr, rgb) in TREE_TIER.items():
    ds = {o.data for o in trees if fam_of(o) == fam and tris(o.data) > thr}
    heroes[fam] = sorted(ds, key=lambda d: mesh_dims(d)[2])
if not heroes['cedar']:
    heroes['cedar'] = heroes['canopy']          # the cedar canopy is the same 8k mesh as the canopy; its full-detail copy was not in the saved file
log('tree heroes', {k: len(v) for k, v in heroes.items()})
tier_mesh = {}
for fam, hs in heroes.items():
    da, db, dc, thr, rgb = TREE_TIER[fam]
    for k, h in enumerate(hs):
        if h in tier_mesh:
            continue
        d = mesh_dims(h)
        h.name = tagname(f'tree_{fam}{k}', 0, da)
        lod = decimate_copy(h, 0.13, 500, tagname(f'tree_{fam}{k}_lod', da, db), keep=2)
        card = far_card(d[2] * 0.8, max(d[0], d[1]) * 0.95, mat('M_Tree' + fam.title() + 'Far', rgb, 0.9), tagname(f'tree_{fam}{k}_card', db, dc))
        tier_mesh[h] = (lod, card)
n_tr = 0
tree_count = {}
for o in trees:
    fam = fam_of(o)
    hs = heroes[fam]
    if not hs:
        continue
    cur = mesh_dims(o.data)[2]
    hero_ = o.data if o.data in tier_mesh else min(hs, key=lambda h: abs(mesh_dims(h)[2] - cur))
    o.data = hero_
    lod, card = tier_mesh[hero_]
    da, db, dc = TREE_TIER[fam][:3]
    o.name = tagname(f'treeA_{fam}', 0, da)
    clone_obj(o, tagname(f'treeB_{fam}', da, db), lod)
    clone_obj(o, tagname(f'treeC_{fam}', db, dc), card)
    n_tr += 1
    tree_count[fam] = tree_count.get(fam, 0) + 1
LOG['trees'] = dict(tree_count, tiers='full 0-38 m (canopy/cedar 55), 13 % copy to 240 m (280), cards to 2.8 km')

# ------------------------------------------------------------------------------------------------ 6. frontages: full v10 detail 0-170 m, 7 % copy 170-1500 m
fr_re = re.compile(r'V10 frontage \d+ \| timber shoji tiled eaves$')
frs = [o for o in VIS.objects if o.type == 'MESH' and fr_re.match(o.name)]
fh = sorted({o.data for o in frs if tris(o.data) > 12000}, key=lambda d: tuple(mesh_dims(d)))
log('frontages', len(frs), 'heroes', len(fh))
fr_tier = {}
for k, h in enumerate(fh):
    h.name = tagname(f'fr_h{k:02d}', 0, 170)
    fr_tier[h] = decimate_copy(h, 0.07, 900, tagname(f'fr_h{k:02d}_far', 170, 1500), keep=2)
for n_, o in enumerate(frs):
    if o.data not in fr_tier:
        cur = mesh_dims(o.data)
        o.data = min(fh, key=lambda h: float(np.abs(np.log(np.maximum(mesh_dims(h), 0.01) / np.maximum(cur, 0.01))).sum()))
    far = fr_tier[o.data]
    o.name = tagname(f'frA_{n_:03d}', 0, 170)
    clone_obj(o, tagname(f'frB_{n_:03d}', 170, 1500), far)
LOG['frontages'] = dict(count=len(frs), heroes=len(fh), full_tris_each=[tris(h) for h in fh][:5], far_tris_each=[tris(v) for v in fr_tier.values()][:5])

# ------------------------------------------------------------------------------------------------ 7. lanterns: full 0-110 m, octahedron 110-700 m
lan_meshes = {}
for o in VIS.objects:
    if o.type == 'MESH' and o.data.name in ('V12 lantern', 'V13 paper lantern'):
        lan_meshes.setdefault(o.data, []).append(o)
for me, objs in lan_meshes.items():
    base = me.name
    me.name = tagname(base.replace(' ', '_'), 0, 110)
    bm = bmesh.new()
    s = (0.3, 0.3, 0.42)
    top, bot = Vector((0, 0, s[2])), Vector((0, 0, -s[2]))
    ring = [Vector((s[0], 0, 0)), Vector((0, s[1], 0)), Vector((-s[0], 0, 0)), Vector((0, -s[1], 0))]
    for k in range(4):
        bm.faces.new([bm.verts.new(top), bm.verts.new(ring[k]), bm.verts.new(ring[(k + 1) % 4])])
        bm.faces.new([bm.verts.new(bot), bm.verts.new(ring[(k + 1) % 4]), bm.verts.new(ring[k])])
    for f in bm.faces:
        f.smooth = False
    far = bpy.data.meshes.new(tagname(base.replace(' ', '_') + '_far', 110, 700))
    bm.to_mesh(far)
    bm.free()
    far.materials.append(me.materials[0])
    for n_, o in enumerate(objs):
        o.name = tagname(f'lanA_{n_:04d}', 0, 110)
        clone_obj(o, tagname(f'lanB_{n_:04d}', 110, 700), far)
LOG['lanterns'] = sum(len(v) for v in lan_meshes.values())

# ------------------------------------------------------------------------------------------------ 8. landmarks and other single detailed meshes: full to 300-900 m, 12 % copy beyond
SKIP = ('skyline', 'asphalt', 'ground', 'water', 'Kerb', 'Continuous', 'lamp_', 'board_', 'hero_', 'signs_', 'treeA', 'treeB', 'treeC', 'frA', 'frB', 'lanA', 'lanB')
n_lod = 0
for o in list(VIS.objects):
    if o.type != 'MESH' or TAG in o.name or o.name.startswith(SKIP) or o.data.users > 1:
        continue
    n = tris(o.data)
    if n < 2500:
        continue
    dm = o.dimensions
    r = 0.5 * max(dm.x, dm.y, dm.z)
    if r > 150:
        continue
    D = min(900.0, max(300.0, r * 9))
    far = decimate_copy(o.data, 0.12, 400, tagname(o.name.replace(' ', '_')[:40] + '_far', D, 3500), keep=4)
    o.data.name = tagname(o.name.replace(' ', '_')[:40], 0, D)
    o.name = tagname(o.name[:40], 0, D)
    clone_obj(o, tagname(o.name.split(TAG)[0] + '_far', D, 3500), far)
    n_lod += 1
LOG['landmark tiers'] = n_lod
log('tiers: trees', n_tr, 'frontages', len(frs), 'landmark/other', n_lod)

# ------------------------------------------------------------------------------------------------ 9. materials: node graphs -> plain glTF materials, de-duplicate
TEXD = T / 'textures'
REPL = {}


def special_materials():
    fence = bpy.data.materials.get('V12 catch fence mesh')
    if fence:
        new = tex_mat('M_Fence', TEXD / 'v13_fence_grid.png', rough=0.4, blend=True)
        new.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 0.8
        REPL[fence] = new
    tile = bpy.data.materials.get('V13 tunnel tile')
    if tile:
        REPL[tile] = tex_mat('M_TunnelTile', TEXD / 'v13_tunnel_tile.png', rough=0.25)
    scr = bpy.data.materials.get('V12 big screen')
    if scr:
        REPL[scr] = tex_mat('M_BigScreen', TEXD / 'v13_big_screen.png', rough=0.3, emit_strength=1.4)
    cr = bpy.data.materials.get('V13 crowd cutout')
    if cr:
        REPL[cr] = tex_mat('M_CrowdCutout', TEXD / 'v13_crowd_cutout.png', rough=0.9, emit_strength=0.35, cutout=True)


special_materials()


def to_principled(m):
    """a material the glTF exporter understands: Principled with image textures only; emission-only materials become Principled emission"""
    nt = m.node_tree
    p = nt.nodes.get('Principled BSDF')
    if p is None:
        e = next((n for n in nt.nodes if n.type == 'EMISSION'), None)
        col = tuple(e.inputs['Color'].default_value[:3]) if e else (1, 1, 1)
        st = e.inputs['Strength'].default_value if e else 1.0
        nt.nodes.clear()
        p = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(p.outputs[0], out.inputs[0])
        p.inputs['Base Color'].default_value = (0, 0, 0, 1)
        p.inputs['Emission Color'].default_value = (*col, 1)
        p.inputs['Emission Strength'].default_value = st
        p.inputs['Roughness'].default_value = 0.6
        return
    for inp in p.inputs:
        for l in list(inp.links):
            if l.from_node.type not in ('TEX_IMAGE', 'NORMAL_MAP', 'VERTEX_COLOR', 'MATH') or (l.from_node.type == 'MATH' and inp.name != 'Alpha'):
                nt.links.remove(l)


used_mats = set()
for o in VIS.objects:
    if o.type == 'MESH':
        for s in o.material_slots:
            if s.material:
                used_mats.add(s.material)
for o in VIS.objects:
    if o.type != 'MESH':
        continue
    for s in o.material_slots:
        if s.material in REPL:
            s.material = REPL[s.material]
used_mats = {m for m in used_mats if m not in REPL} | set(REPL.values())
for m in used_mats:
    if m.use_nodes:
        to_principled(m)
    # the stand crowd shader was procedural noise: after unlinking it is a dark seat colour
for m in used_mats:
    if m.name == 'V12 crowd lit':
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (0.04, 0.035, 0.05, 1)
        b.inputs['Emission Strength'].default_value = 0.1
# de-duplicate plain materials
sig = {}
dedup = {}
for m in sorted(used_mats, key=lambda m: m.name):
    if not m.use_nodes or m.name.startswith('M_'):
        continue
    p = m.node_tree.nodes.get('Principled BSDF')
    if p is None or any(i.links for i in p.inputs) or any(n.type == 'TEX_IMAGE' for n in m.node_tree.nodes):
        continue
    key = (tuple(round(c, 2) for c in p.inputs['Base Color'].default_value), tuple(round(c, 2) for c in p.inputs['Emission Color'].default_value[:3]),
           round(p.inputs['Emission Strength'].default_value, 1), round(p.inputs['Roughness'].default_value, 1), round(p.inputs['Metallic'].default_value, 1),
           round(p.inputs['Alpha'].default_value, 2), m.surface_render_method)
    if key in sig:
        dedup[m] = sig[key]
    else:
        sig[key] = m
for o in VIS.objects:
    if o.type != 'MESH':
        continue
    for s in o.material_slots:
        if s.material in dedup:
            s.material = dedup[s.material]
# draw calls: plain accent materials whose colours are within 0.14 of a more-used one share it (emissive and plain kept apart; LED / neon names untouched)
use_count = {}
for o in VIS.objects:
    if o.type == 'MESH':
        for pl in o.data.polygons:
            if pl.material_index < len(o.material_slots) and o.material_slots[pl.material_index].material:
                m_ = o.material_slots[pl.material_index].material
                use_count[m_] = use_count.get(m_, 0) + 1


def mkey(m):
    p = m.node_tree.nodes.get('Principled BSDF')
    if p is None or any(i.links for i in p.inputs) or any(n.type == 'TEX_IMAGE' for n in m.node_tree.nodes) or m.name.startswith('M_') or re.search(r'LED|Neon|neon|glass|Glass|water|Bay|meadow', m.name):
        return None
    em = p.inputs['Emission Strength'].default_value > 0.2
    return (em, Vector(p.inputs['Base Color'].default_value[:3]) + (Vector(p.inputs['Emission Color'].default_value[:3]) if em else Vector()), round(p.inputs['Alpha'].default_value, 1),
            m.surface_render_method, p.inputs['Metallic'].default_value > 0.4, p.inputs['Emission Strength'].default_value)


reps = []
close = {}
for m in sorted([m for m in used_mats if m not in dedup and m.use_nodes and mkey(m) is not None], key=lambda m: -use_count.get(m, 0)):
    k = mkey(m)
    hit = next((r for r in reps if mkey(r)[0] == k[0] and mkey(r)[2:5] == k[2:5] and abs(mkey(r)[5] - k[5]) < 0.2 and (mkey(r)[1] - k[1]).length < 0.14), None)
    if hit:
        close[m] = hit
    else:
        reps.append(m)
for o in VIS.objects:
    if o.type == 'MESH':
        for s in o.material_slots:
            if s.material in close:
                s.material = close[s.material]
dedup.update(close)
LOG['materials'] = dict(before=len(used_mats), merged_duplicates=len(dedup))
log('materials', len(used_mats), '-> merged', len(dedup))

# ------------------------------------------------------------------------------------------------ 10. merge the remaining small static meshes per 768 m cell
KEEP_SEP = ('skyline', 'asphalt', 'ground', 'water', 'Kerb', 'Continuous', 'lamp_', 'board_', 'hero_', 'treeA', 'treeB', 'treeC', 'frA', 'frB', 'lanA', 'lanB')
groups = {}
for o in list(VIS.objects):
    if o.type != 'MESH' or TAG in o.name or o.name.startswith(KEEP_SEP) or o.data.users > 1 or o.name.startswith('signs_'):
        continue
    dm = o.dimensions
    if 0.5 * max(dm.x, dm.y, dm.z) > 150:
        continue
    c = o.matrix_world.translation if (abs(o.location.x) + abs(o.location.y)) > 1 else o.matrix_world @ Vector(sum((Vector(v) for v in o.bound_box), Vector()) / 8)
    groups.setdefault((math.floor(c.x / CELL), math.floor(c.y / CELL)), []).append(o)
n_merged = 0
for (gx, gy), objs in groups.items():
    bm = bmesh.new()
    mats_, idx = [], {}
    for o in objs:
        me = o.data
        if me.uv_layers:
            me.uv_layers[0].name = 'UVMap'
        tmp = bmesh.new()
        tmp.from_mesh(me)
        tmp.transform(o.matrix_world)
        slots = [s.material for s in o.material_slots]
        for f in tmp.faces:
            m_ = slots[f.material_index] if f.material_index < len(slots) else None
            if m_ not in idx:
                idx[m_] = len(mats_)
                mats_.append(m_)
            f.material_index = idx[m_]
        tm = bpy.data.meshes.new('_t')
        tmp.to_mesh(tm)
        tmp.free()
        bm.from_mesh(tm)
        bpy.data.meshes.remove(tm)
    me = bpy.data.meshes.new(f'static_{gx}_{gy}')
    bm.to_mesh(me)
    bm.free()
    for m_ in mats_:
        me.materials.append(m_)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    ob = bpy.data.objects.new(f'static_{gx}_{gy}', me)
    VIS.objects.link(ob)
    n_merged += len(objs)
LOG['merged static objects'] = n_merged
LOG['static cells'] = len(groups)
log('merged', n_merged, 'objects into', len(groups), 'cells')

exec(compile(open(T / 'game_v13_1_part4.py', encoding='utf-8').read(), 'game_v13_1_part4.py', 'exec'))
