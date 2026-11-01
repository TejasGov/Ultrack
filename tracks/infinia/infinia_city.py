"""Infinia's city (IDENTITY.md): exec'd by build_infinia.py after the road, walls, land, bridge and tunnel. Every building is a type with
its own facade texture (generated here, monsoon grime included), geometry detail and roof clutter; streets are lined, not scattered.
  necklace   the west loop's seafront arc: tetrapods on the sea side, a promenade and sea wall, art-deco blocks facing the sea
  old city   the east loop's first half: chawls with balconies and laundry, shop rows wearing tex/signs.png (make_signs.ps1), overhead
             wires on poles, rooftop water tanks and dishes, a temple with a shikhara at a corner
  towers     the east loop's fast arc: glass and concrete towers with crowns, one under construction with a crane, a metro viaduct
  koliwada   where the bridge lands on the east shore: painted fishermen's houses with tin roofs, boats on the shore, net frames
  toll plaza beside the start on the west shore, before the bridge: a canopy over booths
  dargah     a white dargah on an islet in the bay, reached by a causeway
Night: each facade type has a lit-window copy on a shell 6 cm out ('IF window glow night ...', tracks.js dayNight)."""
import numpy as np

rr = random.Random(21)
# ------------------------------------------------------------------------------------------------ facade textures
FS = 512
def grime(arr, k=0.35):
    """monsoon streaks: darker toward the top of each tile and in vertical runs"""
    h, w = arr.shape[:2]; col = np.array([0.55 + 0.45 * abs(noise.noise(Vector((c / 23.0, 0.3, 0.7)))) for c in range(w)], np.float32)
    ramp = np.linspace(1.0, 1 - k, h, dtype=np.float32)[:, None]                 # row 0 is the bottom: the top rows darker
    arr[..., :3] *= (ramp * (1 - k * 0.6 * (1 - col[None, :])))[..., None]
def rect(a, x0, y0, x1, y1, c): a[int(y0):int(y1), int(x0):int(x1), :3] = c
PHOTO = {}
def photo(name):
    """a Poly Haven set's diffuse / GL normal / ARM as arrays (raw values, as stored), loaded once"""
    if name not in PHOTO:
        out = []
        for tag in ('diff', 'nor_gl', 'arm'):
            f = next((PH / name).glob(f'{name}_{tag}_2k.*')); im = bpy.data.images.load(str(f), check_existing=True)
            if tag != 'diff': im.colorspace_settings.name = 'Non-Color'
            w_, h_ = im.size; out.append(np.array(im.pixels[:], np.float32).reshape(h_, w_, 4))
        d = out[0]; out[0] = d / max(1e-3, float(d[..., :3].mean()))        # the diffuse around 1: a texture under the tint, not a colour
        PHOTO[name] = out
    return PHOTO[name]
def sample(arr, tw, th, metres=2.5):
    """the photo laid at its real size over one facade tile (tw x th metres in FS x FS pixels)"""
    h_, w_ = arr.shape[:2]; yy_, xx_ = np.mgrid[0:FS, 0:FS]
    u = ((xx_ / FS) * (tw / metres) % 1.0 * (w_ - 1)).astype(np.int32); v = ((yy_ / FS) * (th / metres) % 1.0 * (h_ - 1)).astype(np.int32)
    return arr[v, u]
def tex_pair(name, draw, wall=None, base=None, tw=6.0, th=3.0):
    """a facade tile: the photo `base` tinted to `wall` with its own relief, the generated window / door layout painted over it, monsoon
    grime; writes <name>.png (colour), _n.png (normal), _arm.png and _night.png (lit windows)"""
    day = np.zeros((FS, FS, 4), np.float32); day[..., 3] = 1; night = np.zeros((FS, FS, 4), np.float32)
    draw(day, night)
    nrm = np.zeros((FS, FS, 4), np.float32); nrm[...] = (0.5, 0.5, 1.0, 1.0); arm = np.zeros((FS, FS, 4), np.float32); arm[...] = (1.0, 0.35, 0.0, 1.0)
    if base:
        pd, pn, pa = (sample(x, tw, th) for x in photo(base))
        is_wall = np.all(np.abs(day[..., :3] - np.array(wall, np.float32)) < 1e-4, axis=-1)
        day[..., :3] = np.where(is_wall[..., None], np.clip(pd[..., :3] * np.array(wall, np.float32), 0, 1), day[..., :3] * (0.85 + 0.15 * pd[..., :3]))
        nrm = np.where(is_wall[..., None], pn, nrm); arm = np.where(is_wall[..., None], pa, arm)
        lum = (day[..., :3] @ np.array([0.3, 0.59, 0.11], np.float32))[..., None]
        day[..., :3] = np.where(is_wall[..., None], (day[..., :3] * 0.72 + lum * 0.28) * 0.9, day[..., :3])     # sun-faded paint
    grime(day, 0.5)
    for arr, tag in ((day, ''), (night, '_night'), (nrm, '_n'), (arm, '_arm')):
        im = bpy.data.images.new(f'{name}{tag}', FS, FS, alpha=True); im.pixels[:] = arr.ravel()
        im.filepath_raw = str(H / 'tex' / f'{name}{tag}.png'); im.file_format = 'PNG'; im.save()
WARM = lambda: (1.0, 0.78 * rr.uniform(0.9, 1.05), 0.46 * rr.uniform(0.8, 1.15), 1.0)
def chawl_draw(wall, door):
    def d(a, n):             # one tile = 2 rooms x 1 floor (6.4 m x 3.2 m): a door and a barred window per room, on the balcony
        a[..., :3] = wall
        for k in range(2):
            x = k * FS / 2; rect(a, x + 40, 0, x + 120, 390, door); rect(a, x + 46, 6, x + 114, 384, [c * 0.8 for c in door])
            rect(a, x + 160, 150, x + 230, 330, (0.08, 0.08, 0.09))
            for b in range(5): rect(a, x + 165 + b * 14, 150, x + 168 + b * 14, 330, (0.3, 0.3, 0.32))
            if rr.random() < 0.45: n[150:330, int(x + 160):int(x + 230)] = WARM()
            if rr.random() < 0.2: n[0:390, int(x + 46):int(x + 114)] = WARM()
        rect(a, 0, FS - 40, FS, FS, [c * 0.85 for c in wall])        # the floor band above
    return d
def deco_draw(wall, trim):
    def d(a, n):             # one tile = 3 bays x 1 floor (9 m x 3.4 m): tall windows with frames, a speed-line band
        a[..., :3] = wall
        for k in range(3):
            x = k * FS / 3; rect(a, x + 30, 90, x + 140, 420, trim); rect(a, x + 38, 98, x + 132, 412, (0.1, 0.12, 0.13))
            rect(a, x + 38, 255, x + 132, 262, trim)
            if rr.random() < 0.4: n[98:412, int(x + 38):int(x + 132)] = WARM()
        for b in range(3): rect(a, 0, 455 + b * 14, FS, 461 + b * 14, [c * 0.88 for c in wall])
    return d
def glass_draw(tint):
    def d(a, n):             # one tile = 4 x 4 panels (6 m x 7.2 m: 2 floors), mullions and spandrels
        a[..., :3] = tint
        for k in range(5): rect(a, k * FS / 4 - 3, 0, k * FS / 4 + 3, FS, (0.55, 0.57, 0.6))
        for k in range(2): rect(a, 0, k * FS / 2 + 200, FS, k * FS / 2 + 250, [c * 1.6 for c in tint])
        for cI in range(4):
            for f in range(2):
                if rr.random() < 0.5: n[int(f * FS / 2):int(f * FS / 2 + 200), int(cI * FS / 4 + 4):int((cI + 1) * FS / 4 - 4)] = (0.95, 0.92, 0.85, 1.0)
    return d
def house_draw(wall):
    def d(a, n):             # one tile = one small house front (4 m x 3 m): a door and a window with shutters
        a[..., :3] = wall
        rect(a, 60, 0, 170, 380, (0.15, 0.3, 0.45)); rect(a, 260, 150, 420, 330, (0.08, 0.08, 0.09))
        rect(a, 230, 150, 258, 330, (0.2, 0.45, 0.3)); rect(a, 422, 150, 450, 330, (0.2, 0.45, 0.3))
        if rr.random() < 0.5: n[150:330, 260:420] = WARM()
    return d
TYPES = {   # key: draw, tile (m wide, m high), roughness
    'chawl_ochre': (chawl_draw((0.78, 0.6, 0.38), (0.12, 0.3, 0.22)), 6.4, 3.2, 0.85, 'yellow_plaster', (0.78, 0.6, 0.38)),
    'chawl_blue': (chawl_draw((0.55, 0.68, 0.74), (0.45, 0.22, 0.12)), 6.4, 3.2, 0.85, 'blue_plaster_weathered', (0.55, 0.68, 0.74)),
    'chawl_salmon': (chawl_draw((0.85, 0.58, 0.5), (0.1, 0.2, 0.4)), 6.4, 3.2, 0.85, 'red_plaster_weathered', (0.85, 0.58, 0.5)),
    'chawl_green': (chawl_draw((0.5, 0.7, 0.58), (0.4, 0.15, 0.12)), 6.4, 3.2, 0.85, 'peeling_painted_wall', (0.5, 0.7, 0.58)),
    'deco_cream': (deco_draw((0.88, 0.83, 0.7), (0.6, 0.55, 0.45)), 9.0, 3.4, 0.75, 'white_stucco', (0.88, 0.83, 0.7)),
    'deco_rose': (deco_draw((0.88, 0.72, 0.66), (0.62, 0.48, 0.42)), 9.0, 3.4, 0.75, 'white_stucco', (0.88, 0.72, 0.66)),
    'deco_mint': (deco_draw((0.74, 0.84, 0.76), (0.48, 0.58, 0.5)), 9.0, 3.4, 0.75, 'worn_plaster_wall', (0.74, 0.84, 0.76)),
    'res_grey': (deco_draw((0.72, 0.71, 0.68), (0.42, 0.42, 0.4)), 9.0, 3.2, 0.8, 'dirty_concrete', (0.72, 0.71, 0.68)),
    'res_white': (deco_draw((0.86, 0.85, 0.82), (0.5, 0.5, 0.48)), 9.0, 3.2, 0.8, 'white_stucco', (0.86, 0.85, 0.82)),
    'res_sand': (deco_draw((0.82, 0.74, 0.6), (0.5, 0.45, 0.38)), 9.0, 3.2, 0.8, 'worn_plaster_wall', (0.82, 0.74, 0.6)),
    'glass_blue': (glass_draw((0.12, 0.2, 0.28)), 6.0, 7.2, 0.25, None, None),
    'glass_bronze': (glass_draw((0.24, 0.2, 0.15)), 6.0, 7.2, 0.25, None, None),
    'house_pink': (house_draw((0.9, 0.5, 0.6)), 4.0, 3.0, 0.85, 'peeling_painted_wall', (0.9, 0.5, 0.6)),
    'house_yellow': (house_draw((0.95, 0.8, 0.35)), 4.0, 3.0, 0.85, 'yellow_plaster', (0.95, 0.8, 0.35)),
    'house_teal': (house_draw((0.3, 0.65, 0.65)), 4.0, 3.0, 0.85, 'blue_plaster_weathered', (0.3, 0.65, 0.65)),
    'house_lilac': (house_draw((0.7, 0.6, 0.85)), 4.0, 3.0, 0.85, 'worn_plaster_wall', (0.7, 0.6, 0.85)),
}
for k, (draw, tw, th, rough, base, wall) in TYPES.items():
    tex_pair(f'facade_{k}', draw, wall, base, tw, th)
    fm = material(f'IF | facade {k}', rough=rough, metal=0.4 if k.startswith('glass') else 0.0); nt_ = fm.node_tree; P0 = nt_.nodes['Principled BSDF']
    it = nt_.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / f'facade_{k}.png'); nt_.links.new(it.outputs['Color'], P0.inputs['Base Color'])
    if base:        # the photo's relief and roughness under the painted layout
        ia = nt_.nodes.new('ShaderNodeTexImage'); ia.image = image(H / 'tex' / f'facade_{k}_arm.png', True)
        sp = nt_.nodes.new('ShaderNodeSeparateColor'); nt_.links.new(ia.outputs['Color'], sp.inputs['Color']); nt_.links.new(sp.outputs['Green'], P0.inputs['Roughness'])
        inn = nt_.nodes.new('ShaderNodeTexImage'); inn.image = image(H / 'tex' / f'facade_{k}_n.png', True)
        nm = nt_.nodes.new('ShaderNodeNormalMap'); nt_.links.new(inn.outputs['Color'], nm.inputs['Color']); nt_.links.new(nm.outputs['Normal'], P0.inputs['Normal'])
    gm = bpy.data.materials.new(f'IF window glow night {k}')
    try: gm.use_nodes = True
    except AttributeError: pass
    P_ = gm.node_tree.nodes['Principled BSDF']; P_.inputs['Base Color'].default_value = (0, 0, 0, 1)
    it = gm.node_tree.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / f'facade_{k}_night.png')
    gm.node_tree.links.new(it.outputs['Color'], P_.inputs['Emission Color']); P_.inputs['Emission Strength'].default_value = 3.0
    gm.node_tree.links.new(it.outputs['Alpha'], P_.inputs['Alpha'])
    try: gm.surface_render_method = 'BLENDED'
    except AttributeError: pass
    MAT[f'f_{k}'] = fm; MAT[f'g_{k}'] = gm
sm = material('IF | shop signs', rough=0.6); it = sm.node_tree.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / 'signs.png')
sm.node_tree.links.new(it.outputs['Color'], sm.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
sm.node_tree.links.new(it.outputs['Color'], sm.node_tree.nodes['Principled BSDF'].inputs['Emission Color']); sm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.6
MAT.update({'signs': sm,
    'shutter': material('IF | shutter', tex='rusted_shutter'),
    'slab': material('IF | slab', tex='dirty_concrete', vcol=True),
    'rail': material('IF | rail', (0.18, 0.2, 0.2), 0.5, 0.6),
    'tank': material('IF | water tank', (0.08, 0.09, 0.1), 0.6),
    'tin': material('IF | tin roof', tex='rusty_corrugated_iron', vcol=True),
    'cloth': material('IF | laundry', rough=0.9, vcol=True),
    'wire': material('IF | wire', (0.03, 0.03, 0.03), 0.6),
    'white': material('IF | white marble', (0.9, 0.89, 0.86), 0.35),
    'saffron': material('IF | saffron', (0.95, 0.45, 0.05), 0.8),
    'stone': material('IF | temple stone', tex='seaworn_stone_tiles', vcol=True),
    'tetra': material('IF | tetrapod', tex='dirty_concrete', vcol=True),
    'hull': material('IF | boat', tex='weathered_planks', vcol=True),
    'canopy': material('IF | canopy', (0.85, 0.86, 0.88), 0.4, 0.5),
    'glow': material('IF | plaza lights', (0.9, 0.95, 1.0), 0.4, emit=((0.9, 0.96, 1.0), 6.0)),
})
UVS.update({'shutter': 3.0, 'tin': 2.5, 'tetra': 2.0, 'slab': 3.0, 'stone': 2.5, 'hull': 2.0})
KEYS = list(TYPES)

# ------------------------------------------------------------------------------------------------ builders (merged per material)
FB = bmesh.new(); FUV = FB.loops.layers.uv.verify(); GB = bmesh.new(); GUV = GB.loops.layers.uv.verify()
PB = bmesh.new(); PVC = vcol_layer(PB); PUV = PB.loops.layers.uv.verify()       # props: one bmesh, material slots by PROPK
PROPK = ['slab', 'rail', 'tank', 'tin', 'cloth', 'wire', 'white', 'saffron', 'stone', 'tetra', 'hull', 'canopy', 'glow', 'shutter', 'signs', 'steel', 'concrete', 'paving']
def pmi(k): return PROPK.index(k)
def pbox(c, size, yaw=0.0, k='slab', col=(1, 1, 1)):
    n0 = len(PB.faces); box(PB, c, size, yaw=yaw, mi=pmi(k))
    for f in list(PB.faces)[n0:]:
        for l in f.loops: l[PVC] = (*col, 1)
def pquad(pts, k, uv=None, col=(1, 1, 1)):
    f = PB.faces.new([PB.verts.new(p) for p in pts]); f.material_index = pmi(k)
    for j, l in enumerate(f.loops):
        l[PVC] = (*col, 1)
        if uv: l[PUV].uv = uv[j]
    return f
def facade(a, b, h, key, z0=0.0, shell=True):
    """a wall from a to b (ground points), z0..h, facing out to the right of a->b; textured in metres; a lit-window shell 6 cm out"""
    _, tw, th, _, _, _ = TYPES[key]; mi = KEYS.index(key); L = (b - a).length; nrm = Vector(((b - a).y, -(b - a).x, 0)).normalized()
    for bmx, uvl, push in ((FB, FUV, 0.0),) + (((GB, GUV, 0.06),) if shell else ()):
        f = bmx.faces.new([bmx.verts.new(p + nrm * push) for p in (a + Vector((0, 0, z0)), b + Vector((0, 0, z0)), b + Vector((0, 0, h)), a + Vector((0, 0, h)))])
        f.material_index = mi
        for l, (u, v) in zip(f.loops, ((0, z0), (L, z0), (L, h), (0, h))): l[uvl].uv = (u / tw, v / th)
def footprint(c, w, d, yaw):
    Mx = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z')
    return [Mx @ Vector((x, y, 0)) for x, y in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
def roof_clutter(c4, h, n_tanks):
    cx_, cy_ = sum(p.x for p in c4) / 4, sum(p.y for p in c4) / 4
    for _ in range(n_tanks):
        p = c4[0].lerp(c4[2], rr.uniform(0.2, 0.8)); p = Vector((p.x, p.y, h))
        cyl(PB, p, 0.7, 0.7, 1.3, n=8, mi=pmi('tank'), cap=True)
    if rr.random() < 0.5: pbox(Vector((cx_, cy_, h + 0.6)), (0.1, 0.1, 1.2), k='rail'); pbox(Vector((cx_, cy_, h + 1.3)), (0.9, 0.08, 0.9), k='white')
def roof(c4, h, col=(0.55, 0.53, 0.5)):
    pquad([p + Vector((0, 0, h)) for p in c4], 'slab', col=col)
    for k in range(4):        # a parapet
        a, b = c4[k], c4[(k + 1) % 4]; m = (a + b) / 2; pbox(Vector((m.x, m.y, h + 0.45)), ((b - a).length, 0.25, 0.9), yaw=math.atan2((b - a).y, (b - a).x), col=col)
def chawl(c, w, d, yaw, floors, key):
    c4 = footprint(c, w, d, yaw); H_ = floors * 3.2 + 0.4
    for k in range(4): facade(c4[k], c4[(k + 1) % 4], H_, key)
    ang = yaw; fwd = Vector((math.cos(ang), math.sin(ang), 0)); out = Vector((math.sin(ang), -math.cos(ang), 0))      # the front is the -d side
    front = (c4[0] + c4[1]) / 2
    for f in range(1, floors):        # a balcony slab, a railing and laundry per floor along the front
        z = f * 3.2; pbox(front + out * 0.8 + Vector((0, 0, z - 0.1)), (w, 1.6, 0.2), yaw=yaw)
        pbox(front + out * 1.55 + Vector((0, 0, z + 0.5)), (w, 0.06, 1.0), yaw=yaw, k='rail')
        for q in range(int(w / 3)):
            if rr.random() < 0.55:
                p = front + out * 1.2 + fwd * (-w / 2 + 1.5 + q * 3) + Vector((0, 0, z + 1.6))
                pbox(p, (rr.uniform(0.5, 1.4), 0.02, rr.uniform(0.5, 0.9)), yaw=yaw, k='cloth', col=rr.choice([(0.85, 0.1, 0.1), (0.95, 0.75, 0.1), (0.1, 0.35, 0.8), (0.95, 0.95, 0.9), (0.9, 0.4, 0.7), (0.2, 0.6, 0.3)]))
    roof(c4, H_); roof_clutter(c4, H_, rr.randint(1, 3))
def shops(c, w, d, yaw, floors, key):
    """a building with a shop row on the ground floor: shutters half up, a sign board from the atlas over each shop, an awning"""
    c4 = footprint(c, w, d, yaw); H_ = floors * 3.2 + 0.4
    for k in range(1, 4): facade(c4[k], c4[(k + 1) % 4], H_, key)
    facade(c4[0], c4[1], H_, key, z0=4.2)
    fwd = Vector((math.cos(yaw), math.sin(yaw), 0)); out = Vector((math.sin(yaw), -math.cos(yaw), 0)); a0 = c4[0]
    n = max(1, int(w / 4.5)); sw = w / n
    for q in range(n):
        x0 = a0 + fwd * (q * sw); x1 = x0 + fwd * sw
        lift = rr.uniform(1.4, 2.6)
        pquad([x0 + out * 0.02 + Vector((0, 0, lift)), x1 + out * 0.02 + Vector((0, 0, lift)), x1 + out * 0.02 + Vector((0, 0, 3.1)), x0 + out * 0.02 + Vector((0, 0, 3.1))], 'shutter',
              uv=[(0, 0), (sw / 3, 0), (sw / 3, (3.1 - lift) / 3), (0, (3.1 - lift) / 3)])
        pquad([x0 + out * 0.01, x1 + out * 0.01, x1 + out * 0.01 + Vector((0, 0, lift)), x0 + out * 0.01 + Vector((0, 0, lift))], 'slab', col=(0.12, 0.11, 0.1))   # the dark shop inside
        si = rr.randrange(32); u0, v0 = (si % 4) / 4, 1 - (si // 4 + 1) / 8
        pquad([x0 + out * 0.3 + Vector((0, 0, 3.2)), x1 + out * 0.3 + Vector((0, 0, 3.2)), x1 + out * 0.3 + Vector((0, 0, 4.1)), x0 + out * 0.3 + Vector((0, 0, 4.1))], 'signs',
              uv=[(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 0.125), (u0, v0 + 0.125)])
        ac = rr.choice([(0.2, 0.4, 0.7), (0.8, 0.2, 0.15), (0.2, 0.55, 0.3), (0.85, 0.7, 0.2)])
        pquad([x0 + out * 0.2 + Vector((0, 0, 3.15)), x1 + out * 0.2 + Vector((0, 0, 3.15)), x1 + out * 1.6 + Vector((0, 0, 2.7)), x0 + out * 1.6 + Vector((0, 0, 2.7))], 'cloth', col=ac)
    roof(c4, H_); roof_clutter(c4, H_, rr.randint(1, 3))
def deco(c, w, d, yaw, floors, key):
    """art deco: a curved corner on the street side, horizontal eyebrow ledges, a central fin with a name band"""
    c4 = footprint(c, w, d, yaw); H_ = floors * 3.4 + 0.6
    for k in range(4): facade(c4[k], c4[(k + 1) % 4], H_, key)
    fwd = Vector((math.cos(yaw), math.sin(yaw), 0)); out = Vector((math.sin(yaw), -math.cos(yaw), 0)); front = (c4[0] + c4[1]) / 2
    for f in range(1, floors + 1): pbox(front + out * 0.35 + Vector((0, 0, f * 3.4 - 0.2)), (w + 0.6, 0.7, 0.18), yaw=yaw, col=(0.92, 0.9, 0.84))
    pbox(front + out * 0.5 + Vector((0, 0, H_ / 2 + 2)), (1.6, 1.0, H_ + 4), yaw=yaw, col=(0.93, 0.9, 0.84))
    cyl(PB, c4[1] + out * 0.0 - fwd * 0.0 + Vector((0, 0, 0)), 2.2, 2.2, H_ - 0.1, n=12, mi=pmi('slab'), cap=True)       # the rounded corner
    roof(c4, H_, col=(0.8, 0.78, 0.72)); roof_clutter(c4, H_, rr.randint(0, 2))
def tower(c, w, d, yaw, h, key):
    c4 = footprint(c, w, d, yaw)
    pod = footprint(c, w + 10, d + 10, yaw)
    for k in range(4): facade(pod[k], pod[(k + 1) % 4], 9.0, rr.choice(('deco_cream', 'res_grey', 'chawl_ochre')), shell=False)
    roof(pod, 9.0, col=(0.6, 0.6, 0.58))
    for k in range(4): facade(c4[k], c4[(k + 1) % 4], h, key, z0=9.0)
    yaw_v = Vector((math.cos(yaw), math.sin(yaw), 0)); out_v = Vector((math.sin(yaw), -math.cos(yaw), 0))
    for z in range(int(9 + 36), int(h) - 8, 36):        # mechanical floors: a band of louvres every ten floors
        pbox(Vector((c.x, c.y, z)), (w + 0.5, d + 0.5, 1.6), yaw=yaw, k='concrete')
    crown = rr.choice(('flat', 'step', 'spire', 'lantern', 'slant', 'helipad'))
    if crown == 'step':
        c2 = footprint(c, w * 0.7, d * 0.7, yaw)
        for k in range(4): facade(c2[k], c2[(k + 1) % 4], h + 10, key, z0=h)
        roof(c2, h + 10, col=(0.45, 0.46, 0.48))
    elif crown == 'lantern':       # a glass lantern that glows from dusk (the plaza-light emissive)
        roof(c4, h, col=(0.45, 0.46, 0.48)); pbox(Vector((c.x, c.y, h + 4)), (w * 0.6, d * 0.6, 8), yaw=yaw, k='glow')
    elif crown == 'slant':
        roof(c4, h, col=(0.45, 0.46, 0.48))
        a, b, cc, dd = (p + Vector((0, 0, h)) for p in c4)
        pquad([a, b, cc + Vector((0, 0, 14)), dd + Vector((0, 0, 14))], 'steel'); pquad([b, cc, cc + Vector((0, 0, 14))], 'steel'); pquad([dd, a, dd + Vector((0, 0, 14))], 'steel')
    else:
        roof(c4, h, col=(0.45, 0.46, 0.48))
        if crown == 'spire': pbox(Vector((c.x, c.y, h + 12)), (1.2, 1.2, 24), k='steel')
        if crown == 'helipad': cyl(PB, Vector((c.x, c.y, h + 0.9)), min(w, d) * 0.42, min(w, d) * 0.42, 0.3, n=16, mi=pmi('slab'), cap=True)
def house(c, w, d, yaw, floors, key):
    c4 = footprint(c, w, d, yaw); H_ = floors * 3.0
    for k in range(4): facade(c4[k], c4[(k + 1) % 4], H_, key)
    tin = rr.choice([(0.6, 0.6, 0.62), (0.55, 0.3, 0.25), (0.35, 0.45, 0.55)])
    pquad([c4[0] + Vector((0, 0, H_ + 0.2)), c4[1] + Vector((0, 0, H_ + 0.2)), c4[2] + Vector((0, 0, H_ + 1.3)), c4[3] + Vector((0, 0, H_ + 1.3))], 'tin', col=tin)   # one pitch, tin
