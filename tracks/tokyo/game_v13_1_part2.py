# exec'd by game_v13_1.py: text atlas, sponsor logos, curved stands, lamps, distance tiers, merging, materials, collision, json, export.

# ------------------------------------------------------------------------------------------------ 2. 3D text -> sign atlas quads (Yu Gothic), hero signs stay 3D
HERO_SIGNS = ('romon gate | 浅草門', '電 光 神 社')
texts, boards = [], []
for o in list(VIS.objects):
    if o.type != 'FONT':
        continue
    (boards if o.name.startswith('Sponsor board') else texts).append(o)


def mat_rgb(m):
    if m is None or not m.use_nodes:
        return (1, 1, 1)
    nt = m.node_tree
    p = nt.nodes.get('Principled BSDF')
    if p:
        em = tuple(p.inputs['Emission Color'].default_value[:3])
        base = tuple(p.inputs['Base Color'].default_value[:3])
        return em if (p.inputs['Emission Strength'].default_value > 0 and em != (1.0, 1.0, 1.0)) else base
    e = next((n for n in nt.nodes if n.type == 'EMISSION'), None)
    return tuple(e.inputs['Color'].default_value[:3]) if e else (1, 1, 1)


cells, cellof = {}, {}
for o in texts:
    col = mat_rgb(o.data.materials[0] if o.data.materials else None)
    srgb = [int(255 * (min(1.0, c) ** (1 / 2.2))) for c in col]
    font = 'medium' if 'YuGothM' in (o.data.font.filepath if o.data.font else '') else 'bold'
    bb = [Vector(c) for c in o.bound_box]
    x0, x1 = min(v.x for v in bb), max(v.x for v in bb)
    y0, y1 = min(v.y for v in bb), max(v.y for v in bb)
    w, h = max(x1 - x0, 0.05), max(y1 - y0, 0.05)
    key = f"{o.data.body}|{round(w, 1)}|{round(h, 1)}|{srgb}|{font}"
    cellof[o.name] = (key, x0, x1, y0, y1)
    cells[key] = dict(key=key, body=o.data.body, color=srgb, w=w, h=h, font=font)
(O / 'v13_1-signs.json').write_text(json.dumps(list(cells.values()), ensure_ascii=False), encoding='utf8')
subprocess.run(['C:/Python314/python.exe', str(T / 'build_sign_atlas.py'), str(O / 'v13_1-signs.json'), str(T / 'textures' / 'tokyo_sign_atlas_v13.png'),
                str(O / 'v13_1-sign-atlas.json'), '4096'], check=True)
atlas = json.load(open(O / 'v13_1-sign-atlas.json'))
sign_m = tex_mat('M_SignNeonAtlas', T / 'textures' / 'tokyo_sign_atlas_v13.png', rough=0.5, emit_strength=2.5, cutout=True)
sign_cells = {}
nsign = 0
hero = []
for o in list(texts):
    key, x0, x1, y0, y1 = cellof[o.name]
    if any(h_ in o.name for h_ in HERO_SIGNS):
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        ho = bpy.data.objects.new('hero_' + o.name.split('|')[-1].strip().replace(' ', ''), me)
        ho.matrix_world = o.matrix_world.copy()
        VIS.objects.link(ho)
        hero.append(ho)
        bpy.data.objects.remove(o, do_unlink=True)
        continue
    u0, v0, u1, v1 = atlas[key]
    mw = o.matrix_world
    px, py = (x1 - x0) * 0.02, (y1 - y0) * 0.02
    P = [mw @ Vector(c) for c in ((x0 - px, y0 - py, 0.004), (x1 + px, y0 - py, 0.004), (x1 + px, y1 + py, 0.004), (x0 - px, y1 + py, 0.004))]
    cell_key = (math.floor(P[0].x / CELL), math.floor(P[0].y / CELL))
    bm = sign_cells.setdefault(cell_key, bmesh.new())
    q(bm, P, 0, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    nsign += 1
    bpy.data.objects.remove(o, do_unlink=True)
for ck, bm in sign_cells.items():
    bm_to_obj(f'signs_{ck[0]}_{ck[1]}', bm, [sign_m], VIS)
LOG['signs'] = dict(quads=nsign, atlas_cells=len(cells), hero_signs=len(hero))
log('signs as atlas quads', nsign, 'cells', len(cells), 'hero kept', len(hero))

# sponsor logos (brand_art quads, GPU-instanced per brand) where the 3D board text was; the V9 coloured panels behind stay
brands = [b for b in brand_art.BRANDS if (ROOT / 'assets' / 'sponsors' / 'boards' / f"{b['id']}-6000.png").exists()]
board_me = {b['id']: brand_art.board_mesh('board6x1_' + b['id'], b, 6, 1, False, True) for b in brands}
nb = 0
for k, o in enumerate(boards):
    bb = [Vector(c) for c in o.bound_box]
    cen = o.matrix_world @ Vector(((min(v.x for v in bb) + max(v.x for v in bb)) / 2, (min(v.y for v in bb) + max(v.y for v in bb)) / 2, 0))
    yaw = o.matrix_world.to_euler().z
    face = Matrix.Rotation(yaw, 3, 'Z') @ Vector((0, -1, 0))
    br = brands[(k * 5 + k // 3) % len(brands)]
    ob = bpy.data.objects.new(f'board_{k:03d}', board_me[br['id']])
    ob.location = (cen.x + face.x * 0.03, cen.y + face.y * 0.03, cen.z - 0.5)
    ob.rotation_euler = (0, 0, yaw)
    VIS.objects.link(ob)
    bpy.data.objects.remove(o, do_unlink=True)
    nb += 1
LOG['sponsor logo boards'] = nb

# ------------------------------------------------------------------------------------------------ 3. the two curved stands (stepped shells, v11 generator); the start stands stay as modelled in v12
concrete, glass_m = bpy.data.materials['Concrete | mineral'], bpy.data.materials['V10 glass']
white_m, cedar_m = bpy.data.materials['V10 white'], bpy.data.materials.get('V10 cedar') or mat('V10 cedar', (0.45, 0.25, 0.12))
warm_m, ink_m = bpy.data.materials['V10 warm'], bpy.data.materials['V10 ink']
for f in ('crowd_row.png', 'crowd_phones.png'):
    (O / 'textures').mkdir(exist_ok=True)
    if not (O / 'textures' / f).exists():
        shutil.copy(ROOT / 'tracks' / 'marina' / 'out' / 'textures' / f, O / 'textures' / f)
crowd_m = tex_mat('M_Crowd', O / 'textures' / 'crowd_row.png', rough=0.8, cutout=True)
if not any(n.type == 'TEX_IMAGE' and 'phones' in n.image.name for n in crowd_m.node_tree.nodes):
    ph = crowd_m.node_tree.nodes.new('ShaderNodeTexImage')
    ph.image = bpy.data.images.load(str(O / 'textures' / 'crowd_phones.png'), check_existing=True)
    bs = crowd_m.node_tree.nodes['Principled BSDF']
    crowd_m.node_tree.links.new(ph.outputs['Color'], bs.inputs['Emission Color'])
    bs.inputs['Emission Strength'].default_value = 3.0

STANDS = {'Roppongi ridge gallery': (220, 30), 'Shibuya garden stand': (160, 28)}
stand_info = []
for name, (width, depth) in STANDS.items():
    shell = next(o for o in sc.objects if o.name == f'V10 08 | curved {name}')
    aud = next(o for o in sc.objects if o.name == f'V10 08 | curved {name} | spectators and fascia')
    R = width * 1.4
    st = lambda x, y, z: Vector(((R + y) * math.sin(x / R), (R + y) * math.cos(x / R) - R, z))
    segs = max(14, int(width / 9))
    rows = 22
    step = depth / rows
    bm = bmesh.new()
    cb = bmesh.new()
    for tier in range(2):
        base = tier * 12
        for row in range(rows):
            y = -depth / 2 + row * step
            z = base + row * 0.42 + 0.5
            for k in range(segs):
                x, xx = -width / 2 + k * width / segs, -width / 2 + (k + 1) * width / segs
                uv = lambda a, b: [(a / 5, b / 5), ((a + width / segs) / 5, b / 5), ((a + width / segs) / 5, (b + step) / 5), (a / 5, (b + step) / 5)]
                q(bm, [st(x, y, z), st(xx, y, z), st(xx, y + step, z), st(x, y + step, z)], 0, uv(x, y))
                q(bm, [st(x, y, z - 0.42), st(xx, y, z - 0.42), st(xx, y, z), st(x, y, z)], 0, [(x / 5, 0), (xx / 5, 0), (xx / 5, 0.1), (x / 5, 0.1)])
        tile_u = lambda x, ln: (x + width / 2) / ln
        for row in range(rows):
            ln = 7.7 + rnd.uniform(-0.6, 0.6)
            y = -depth / 2 + row * step + 0.62
            z0 = base + row * 0.42 + 0.5
            for k in range(segs):
                x, xx = -width / 2 + k * width / segs, -width / 2 + (k + 1) * width / segs
                q(cb, [st(x, y, z0), st(xx, y, z0), st(xx, y, z0 + 1.05), st(x, y, z0 + 1.05)], 0,
                  [(tile_u(x, ln), 0), (tile_u(xx, ln), 0), (tile_u(xx, ln), 1), (tile_u(x, ln), 1)])
        for k in range(segs):
            x, xx = -width / 2 + k * width / segs, -width / 2 + (k + 1) * width / segs
            y = depth / 2 + 2
            q(bm, [st(x, y, base + 9.8), st(xx, y, base + 9.8), st(xx, y, base + 12), st(x, y, base + 12)], 1)
    for k in range(segs):
        x, xx = -width / 2 + k * width / segs, -width / 2 + (k + 1) * width / segs
        q(bm, [st(x, -depth / 2 - 5, 27), st(xx, -depth / 2 - 5, 27), st(xx, depth / 2 + 7, 30), st(x, depth / 2 + 7, 30)], 2)
        q(bm, [st(x, -depth / 2 - 5, 26.7), st(xx, -depth / 2 - 5, 26.7), st(xx, depth / 2 + 7, 29.7), st(x, depth / 2 + 7, 29.7)], 3)
        tube(bm, st(x, -depth / 2 - 5, 26.7), st(xx, -depth / 2 - 5, 26.7), 0.11, 0.11, 4, 4)
    for x in range(int(-width / 2), int(width / 2) + 1, 12):
        tube(bm, st(x, depth / 2 + 5, 0), st(x, depth / 2 + 5, 30), 0.32, 0.32, 5, 6)
        tube(bm, st(x, depth / 2 + 5, 27), st(x, -depth / 2 - 1, 26.5), 0.2, 0.2, 5, 4)
    for ob_, bm_, mats_ in ((shell, bm, [concrete, glass_m, white_m, cedar_m, warm_m, ink_m]), (aud, cb, [crowd_m])):
        mw = ob_.matrix_world.copy()
        name_ = ob_.name
        bpy.data.objects.remove(ob_, do_unlink=True)
        new = bm_to_obj(name_, bm_, mats_, VIS)
        new.matrix_world = mw
    stand_info.append(dict(name=name, mw=mw, width=width, depth=depth, R=R))

# ------------------------------------------------------------------------------------------------ 3b. bridge night lighting: red glow shells on the two portal towers (night only, M_NightBridgeRed fades with the look)
glow_m = mat('M_NightBridgeRed', (0.0, 0.0, 0.0), 1.0, (1.0, 0.12, 0.06), 2.4)
glow_m.surface_render_method = 'BLENDED'
glow_m.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.55
for n_, o in enumerate([o for o in list(VIS.objects) if o.name.startswith('Rounded portal tower')]):
    bmg = bmesh.new()
    bmg.from_mesh(o.data)
    for v in bmg.verts:
        v.co += v.normal * 0.22
    for f in bmg.faces:
        f.material_index = 0
    me = bpy.data.meshes.new(f'bridge_glow_{n_}')
    bmg.to_mesh(me)
    bmg.free()
    me.materials.append(glow_m)
    ob = bpy.data.objects.new(f'bridge_glow_{n_}', me)
    ob.matrix_world = o.matrix_world.copy()
    VIS.objects.link(ob)

# ------------------------------------------------------------------------------------------------ 4. lamps as GPU instances (v11), fence-post placeholders removed
lamp_cols = [o for o in sc.objects if o.name.startswith('Street lamp column')]
lamp_heads = [o for o in sc.objects if o.name.startswith('Lamp diffuser')]
lamp_pts = [o.matrix_world.translation.copy() for o in lamp_cols]
head_xf = [(o.matrix_world.translation.copy(), o.matrix_world.to_euler().z, o.scale.copy()) for o in lamp_heads]
for o in list(sc.objects):
    if o.name.startswith(('Street lamp column', 'Lamp outreach', 'Lamp diffuser', 'Fence upright')) and o.type == 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)
bm = bmesh.new()
tube(bm, (0, 0, 0), (0, 0, 9.0), 0.13, 0.08, 0, 8)
pole_me = bpy.data.meshes.new('lamp_pole')
bm.to_mesh(pole_me)
bm.free()
pole_me.materials.append(mat('M_LampPole', (0.05, 0.055, 0.06), 0.5))
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
head_me = bpy.data.meshes.new('lamp_head')
bm.to_mesh(head_me)
bm.free()
head_me.materials.append(mat('M_LampHead', (1, 0.8, 0.5), 0.4, (1, 0.62, 0.28), 3.0))
for k, p in enumerate(lamp_pts):
    ob = bpy.data.objects.new(f'lamp_pole_{k:03d}', pole_me)
    ob.location = (p.x, p.y, p.z - 4.5)
    VIS.objects.link(ob)
for k, (p, yaw, s) in enumerate(head_xf):
    ob = bpy.data.objects.new(f'lamp_head_{k:03d}', head_me)
    ob.location, ob.rotation_euler, ob.scale = p, (0, 0, yaw), s
    VIS.objects.link(ob)
log('lamps', len(lamp_pts), 'poles', len(head_xf), 'heads')

exec(compile(open(T / 'game_v13_1_part3.py', encoding='utf-8').read(), 'game_v13_1_part3.py', 'exec'))
