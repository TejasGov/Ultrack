"""Infinia's city (IDENTITY.md): exec'd by build_infinia.py after the road, walls, land, bridge and tunnel. Every building is a type with
its own facade texture (generated here, monsoon grime included), geometry detail and roof clutter; streets are lined, not scattered.
  necklace   the west loop's seafront arc: tetrapods on the sea side, a promenade and sea wall, art-deco blocks facing the sea
  old city   the east loop's first half: chawls with balconies and laundry, shop rows wearing tex/signs.png (make_signs.ps1), overhead
             wires on poles, rooftop water tanks and dishes, a temple with a shikhara at a corner
  towers     the east loop's fast arc: glass and concrete towers with crowns, one under construction with a crane, a metro viaduct
  koliwada   where the bridge lands on the east shore: painted fishermen's houses with tin roofs, boats on the shore, net frames
  toll plaza beside the start on the west shore, before the bridge: a canopy over booths
  dargah     a white dargah on an islet in the bay, reached by a causeway
  lanes      Dharavi-style stretches (the old city's second half, the west loop after the tunnel): stacked one- to three-storey homes of
             plaster, brick and tin, tarps and tin roofs held down by tyres, blue drums and tyre stacks in the lanes, tin fences
  hotel      a grand seafront hotel on the Necklace's land side, modelled on the user's reference of the Taj Mahal Palace: grey block stone,
             round arches, ribbed red domes on round corner towers, long red roofs, twelve sand bay columns with red eaves
  mosque     a white mosque with a green onion dome and two minarets across the water
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
                if rr.random() < 0.3: n[int(f * FS / 2):int(f * FS / 2 + 200), int(cI * FS / 4 + 4):int((cI + 1) * FS / 4 - 4)] = (0.82, 0.76, 0.62, 1.0)
    return d
def house_draw(wall):
    def d(a, n):             # one tile = one small house front (4 m x 3 m): a door and a window with shutters
        a[..., :3] = wall
        rect(a, 60, 0, 170, 380, (0.15, 0.3, 0.45)); rect(a, 260, 150, 420, 330, (0.08, 0.08, 0.09))
        rect(a, 230, 150, 258, 330, (0.2, 0.45, 0.3)); rect(a, 422, 150, 450, 330, (0.2, 0.45, 0.3))
        if rr.random() < 0.5: n[150:330, 260:420] = WARM()
    return d
def slum_draw(wall, door):
    def d(a, n):             # one tile = 7.2 m x 2.7 m of lane wall: a low door, two small barred windows, the rest bare wall (the photo shows through)
        a[..., :3] = wall
        rect(a, 30, 0, 100, 370, door); rect(a, 36, 4, 94, 364, [c * 0.8 for c in door])
        for x0 in (190, 390):
            rect(a, x0, 170, x0 + 62, 310, (0.06, 0.06, 0.07))
            for b in range(3): rect(a, x0 + 8 + b * 20, 170, x0 + 12 + b * 20, 310, (0.26, 0.26, 0.28))
            if rr.random() < 0.5: n[170:310, x0:x0 + 62] = WARM()
    return d
def taj_draw(wall, trim, w_px=66):
    def d(a, n):             # one tile = 2 bays x 2 floors: round-headed windows in a pale stone surround, a sill across; lit in a checker, softly, so a palace at night is not a grid
        a[..., :3] = wall; yy, xx = np.mgrid[0:FS, 0:FS]; soft = np.array((0.62, 0.47, 0.27, 1.0), np.float32)
        def arch(cx, y0, w, sp, sill): return (((np.abs(xx - cx) < w) & (yy > y0 + sill) & (yy < y0 + sp)) | (((xx - cx) ** 2 + (yy - y0 - sp) ** 2) < w ** 2))
        for row in range(2):
            y0 = row * FS // 2
            for k in range(2):
                cx = (k + 0.5) * FS / 2; m = arch(cx, y0, w_px, 138, 24); a[arch(cx, y0, w_px + 10, 138, 14), :3] = trim; a[m, :3] = (0.09, 0.11, 0.14)
                a[(np.abs(xx - cx) < 3) & m, :3] = trim; a[(np.abs(yy - y0 - 138) < 3) & m, :3] = trim      # the glazing bars
                if (k + row) % 2 == 0: n[m] = soft
            rect(a, 0, y0 + 6, FS, y0 + 14, trim); rect(a, 0, y0 + FS // 2 - 10, FS, y0 + FS // 2, trim)
    return d
def sand_draw(wall, trim):
    def d(a, n):             # one facet of a bay column: one tall window, framed, on sand stone
        a[..., :3] = wall; rect(a, 110, 90, FS - 110, 440, trim); rect(a, 134, 112, FS - 134, 418, (0.08, 0.1, 0.13)); rect(a, 250, 112, 262, 418, trim); rect(a, 134, 260, FS - 134, 270, trim)
        if rr.random() < 0.6: n[112:418, 134:FS - 134] = WARM()
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
    'glass_blue': (glass_draw((0.3, 0.42, 0.52)), 6.0, 7.2, 0.15, None, None),
    'glass_bronze': (glass_draw((0.46, 0.4, 0.32)), 6.0, 7.2, 0.15, None, None),
    'house_pink': (house_draw((0.9, 0.5, 0.6)), 4.0, 3.0, 0.85, 'peeling_painted_wall', (0.9, 0.5, 0.6)),
    'house_yellow': (house_draw((0.95, 0.8, 0.35)), 4.0, 3.0, 0.85, 'yellow_plaster', (0.95, 0.8, 0.35)),
    'house_teal': (house_draw((0.3, 0.65, 0.65)), 4.0, 3.0, 0.85, 'blue_plaster_weathered', (0.3, 0.65, 0.65)),
    'house_lilac': (house_draw((0.7, 0.6, 0.85)), 4.0, 3.0, 0.85, 'worn_plaster_wall', (0.7, 0.6, 0.85)),
    'taj_stone': (taj_draw((0.58, 0.58, 0.6), (0.82, 0.82, 0.8)), 8.0, 7.2, 0.85, 'seaworn_stone_tiles', (0.58, 0.58, 0.6)),
    'taj_tower': (taj_draw((0.58, 0.58, 0.6), (0.82, 0.82, 0.8), 60), 7.6, 8.0, 0.85, 'seaworn_stone_tiles', (0.58, 0.58, 0.6)),
    'taj_sand': (sand_draw((0.86, 0.72, 0.46), (0.95, 0.88, 0.7)), 2.2, 4.2, 0.8, 'worn_plaster_wall', (0.86, 0.72, 0.46)),
    'slum_brick': (slum_draw((0.54, 0.36, 0.3), (0.2, 0.24, 0.26)), 7.2, 2.7, 0.9, 'red_plaster_weathered', (0.54, 0.36, 0.3)),
    'slum_tin': (slum_draw((0.46, 0.44, 0.42), (0.26, 0.16, 0.14)), 7.2, 2.7, 0.8, 'rusty_corrugated_iron', (0.46, 0.44, 0.42)),
    'slum_blue': (slum_draw((0.42, 0.55, 0.64), (0.3, 0.24, 0.16)), 7.2, 2.7, 0.9, 'blue_plaster_weathered', (0.42, 0.55, 0.64)),
    'slum_green': (slum_draw((0.46, 0.58, 0.48), (0.28, 0.16, 0.14)), 7.2, 2.7, 0.9, 'peeling_painted_wall', (0.46, 0.58, 0.48)),
    'slum_wood': (slum_draw((0.5, 0.43, 0.36), (0.16, 0.22, 0.18)), 7.2, 2.7, 0.9, 'weathered_planks', (0.5, 0.43, 0.36)),
    'slum_plaster': (slum_draw((0.78, 0.72, 0.6), (0.18, 0.24, 0.32)), 7.2, 2.7, 0.9, 'worn_plaster_wall', (0.78, 0.72, 0.6)),
    'slum_cream': (slum_draw((0.72, 0.66, 0.56), (0.3, 0.2, 0.16)), 7.2, 2.7, 0.9, 'dirty_concrete', (0.72, 0.66, 0.56)),
    'slum_rose': (slum_draw((0.74, 0.56, 0.5), (0.16, 0.22, 0.28)), 7.2, 2.7, 0.9, 'white_stucco', (0.74, 0.56, 0.5)),
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
    gm.node_tree.links.new(it.outputs['Color'], P_.inputs['Emission Color']); P_.inputs['Emission Strength'].default_value = 0.9     # x night 1.4: lit rooms, not a bloom fog
    gm.node_tree.links.new(it.outputs['Alpha'], P_.inputs['Alpha'])
    try: gm.surface_render_method = 'BLENDED'
    except AttributeError: pass
    MAT[f'f_{k}'] = fm; MAT[f'g_{k}'] = gm
sm = material('IF | shop signs', rough=0.6); it = sm.node_tree.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / 'signs.png')
sm.node_tree.links.new(it.outputs['Color'], sm.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
sm.node_tree.links.new(it.outputs['Color'], sm.node_tree.nodes['Principled BSDF'].inputs['Emission Color']); sm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.6
hm = material('IF | hoardings', rough=0.55); it = hm.node_tree.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / 'hoardings.png')
hm.node_tree.links.new(it.outputs['Color'], hm.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
hm.node_tree.links.new(it.outputs['Color'], hm.node_tree.nodes['Principled BSDF'].inputs['Emission Color']); hm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.8
# people: 8 standing and 8 seated figures drawn here (kurta, shirt, saree, salwar; skin, black hair), alpha cut; 2048 x 1024, row 0 at the bottom
PW_, PH_ = 256, 512; ppl = np.zeros((1024, 2048, 4), np.float32); yy2, xx2 = np.mgrid[0:PH_, 0:PW_]
CLOTH = [(0.92, 0.92, 0.88), (0.85, 0.15, 0.2), (0.15, 0.3, 0.7), (0.95, 0.6, 0.1), (0.2, 0.55, 0.35), (0.6, 0.15, 0.5), (0.95, 0.85, 0.3), (0.3, 0.3, 0.32), (0.9, 0.45, 0.55)]
SKN = [(0.55, 0.36, 0.25), (0.68, 0.48, 0.34), (0.42, 0.27, 0.18), (0.75, 0.56, 0.42)]
for row, seated in ((1, False), (0, True)):
    for k in range(8):
        c = np.zeros((PH_, PW_, 4), np.float32); top, bot, legs = rr.choice(CLOTH), rr.choice(CLOTH), rr.choice([(0.2, 0.2, 0.25), (0.3, 0.25, 0.2), (0.85, 0.82, 0.75)])
        sk = rr.choice(SKN); saree = (k % 3 == 1)
        if seated:       # a seated figure from behind / the front: torso and head over a wall line
            body = (np.abs(xx2 - 128) < 52) & (yy2 > 40) & (yy2 < 250); c[body] = (*top, 1)
            c[((xx2 - 128) ** 2 + (yy2 - 290) ** 2) < 38 ** 2] = (*sk, 1); c[(((xx2 - 128) ** 2 + (yy2 - 302) ** 2) < 36 ** 2) & (yy2 > 300)] = (0.05, 0.04, 0.04, 1)
        else:
            if saree: c[(np.abs(xx2 - 128) < 30 + (300 - yy2) * 0.12) & (yy2 < 300)] = (*bot, 1)       # a saree's fall to the ground
            else:
                for sx in (-1, 1): c[(np.abs(xx2 - 128 - sx * 18) < 14) & (yy2 < 250) & (yy2 > 8)] = (*legs, 1)
            c[(np.abs(xx2 - 128) < 40) & (yy2 >= 230) & (yy2 < 400)] = (*top, 1)                    # kurta / shirt
            for sx in (-1, 1): c[(np.abs(xx2 - 128 - sx * 50) < 10) & (yy2 > 250) & (yy2 < 390)] = (*sk, 1)
            c[((xx2 - 128) ** 2 + (yy2 - 440) ** 2) < 34 ** 2] = (*sk, 1); c[(((xx2 - 128) ** 2 + (yy2 - 452) ** 2) < 33 ** 2) & (yy2 > 448)] = (0.05, 0.04, 0.04, 1)
        ppl[row * PH_:(row + 1) * PH_, k * PW_:(k + 1) * PW_] = c
pimg = bpy.data.images.new('people', 2048, 1024, alpha=True); pimg.pixels[:] = ppl.ravel(); pimg.filepath_raw = str(H / 'tex' / 'people.png'); pimg.file_format = 'PNG'; pimg.save()
pm = bpy.data.materials.new('IF | people')
try: pm.use_nodes = True
except AttributeError: pass
it = pm.node_tree.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / 'people.png'); P1 = pm.node_tree.nodes['Principled BSDF']
pm.node_tree.links.new(it.outputs['Color'], P1.inputs['Base Color']); P1.inputs['Roughness'].default_value = 0.9
gt = pm.node_tree.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5
pm.node_tree.links.new(it.outputs['Alpha'], gt.inputs[0]); pm.node_tree.links.new(gt.outputs[0], P1.inputs['Alpha'])
MAT.update({'hoard': hm, 'people': pm})
for key_, file_, name_ in (('posters', 'tunnel_posters.png', 'IF | film posters'), ('tname', 'tunnel_name.png', 'IF | tunnel name')):      # lit boxes: readable at speed in a dim tube
    m_ = material(name_, rough=0.5); it = m_.node_tree.nodes.new('ShaderNodeTexImage'); it.image = image(H / 'tex' / file_); P_ = m_.node_tree.nodes['Principled BSDF']
    m_.node_tree.links.new(it.outputs['Color'], P_.inputs['Base Color']); m_.node_tree.links.new(it.outputs['Color'], P_.inputs['Emission Color']); P_.inputs['Emission Strength'].default_value = 0.85
    MAT[key_] = m_
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
    'glow': material('IF | plaza lights', (0.9, 0.9, 0.86), 0.4, emit=((1.0, 0.93, 0.8), 1.1)),      # lit lane boxes and tower lanterns, not floodlights
    'drum': material('IF | drum', tex='painted_metal_shutter', vcol=True),
    'tyre': material('IF | tyre', tex='worn_asphalt', vcol=True),
    'dome': material('IF | painted dome', tex='peeling_painted_wall', vcol=True),
})
UVS.update({'shutter': 3.0, 'tin': 2.5, 'tetra': 2.0, 'slab': 3.0, 'stone': 2.5, 'hull': 2.0, 'drum': 1.2, 'tyre': 1.0, 'dome': 4.0})
KEYS = list(TYPES)

# ------------------------------------------------------------------------------------------------ builders (merged per material)
FB = bmesh.new(); FUV = FB.loops.layers.uv.verify(); GB = bmesh.new(); GUV = GB.loops.layers.uv.verify()
PB = bmesh.new(); PVC = vcol_layer(PB); PUV = PB.loops.layers.uv.verify()       # props: one bmesh, material slots by PROPK
PROPK = ['slab', 'rail', 'tank', 'tin', 'cloth', 'wire', 'white', 'saffron', 'stone', 'tetra', 'hull', 'canopy', 'glow', 'shutter', 'signs', 'steel', 'concrete', 'paving', 'hoard', 'people', 'drum', 'tyre', 'dome', 'posters', 'tname']
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
def facade(a, b, h, key, z0=0.0, shell=True, u0=0.0):
    """a wall from a to b (ground points), z0..h, facing out to the right of a->b; textured in metres; a lit-window shell 6 cm out"""
    _, tw, th, _, _, _ = TYPES[key]; mi = KEYS.index(key); L = (b - a).length; nrm = Vector(((b - a).y, -(b - a).x, 0)).normalized()
    for bmx, uvl, push in ((FB, FUV, 0.0),) + (((GB, GUV, 0.06),) if shell else ()):
        f = bmx.faces.new([bmx.verts.new(p + nrm * push) for p in (a + Vector((0, 0, z0)), b + Vector((0, 0, z0)), b + Vector((0, 0, h)), a + Vector((0, 0, h)))])
        f.material_index = mi
        for l, (u, v) in zip(f.loops, ((0, z0), (L, z0), (L, h), (0, h))): l[uvl].uv = ((u + u0) / tw, v / th)
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
def hoarding(base, z, w, h, yaw, idx=None):
    """a billboard on two steel legs: one board of tex/hoardings.png (2 x 4), facing out of `yaw`'s front"""
    i_ = rr.randrange(8) if idx is None else idx; u0, v0 = (i_ % 2) / 2, 1 - (i_ // 2 + 1) / 4
    fwd_ = Vector((math.cos(yaw), math.sin(yaw), 0)); out_ = Vector((math.sin(yaw), -math.cos(yaw), 0)); a_ = base - fwd_ * w / 2 + out_ * 0.15; b_ = base + fwd_ * w / 2 + out_ * 0.15
    pquad([a_ + Vector((0, 0, z)), b_ + Vector((0, 0, z)), b_ + Vector((0, 0, z + h)), a_ + Vector((0, 0, z + h))], 'hoard', uv=[(u0, v0), (u0 + 0.5, v0), (u0 + 0.5, v0 + 0.25), (u0, v0 + 0.25)])
    pquad([b_ - out_ * 0.1 + Vector((0, 0, z)), a_ - out_ * 0.1 + Vector((0, 0, z)), a_ - out_ * 0.1 + Vector((0, 0, z + h)), b_ - out_ * 0.1 + Vector((0, 0, z + h))], 'steel')
    for sx in (-0.35, 0.35): pbox(base + fwd_ * sx * w + Vector((0, 0, z / 2 + 0.01)), (0.3, 0.3, z), k='steel')
def person(p, yaw, seated=False):
    """a figure card (tex/people.png), 1.7 m standing or 1.0 m seated, its face toward `yaw`'s front"""
    k_ = rr.randrange(8); u0 = k_ / 8; v0 = 0.0 if seated else 0.5; hh = 1.0 if seated else rr.uniform(1.55, 1.8); ww = hh / 2
    fwd_ = Vector((math.cos(yaw), math.sin(yaw), 0)); a_ = p - fwd_ * ww / 2; b_ = p + fwd_ * ww / 2
    pquad([a_, b_, b_ + Vector((0, 0, hh)), a_ + Vector((0, 0, hh))], 'people', uv=[(u0, v0), (u0 + 0.125, v0), (u0 + 0.125, v0 + 0.5), (u0, v0 + 0.5)])
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
    if rr.random() < 0.3: hoarding(front + out * 0.3, H_ + 1.0, min(12.0, w * 0.8), 4.2, yaw)
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
    cyl(PB, c4[1], 2.2, 2.2, H_ - 0.1, n=12, mi=pmi('white'), cap=True)       # the rounded corner
    for f in range(1, floors):       # its curved balconies: a slab and a solid parapet at each floor
        cyl(PB, c4[1] + Vector((0, 0, f * 3.4 - 0.15)), 3.0, 3.0, 0.18, n=16, mi=pmi('white'), cap=True)
        cyl(PB, c4[1] + Vector((0, 0, f * 3.4)), 3.0, 3.0, 1.0, n=16, mi=pmi('white'), cap=False)
    for k_, (sw, sh) in enumerate(((w * 0.55, 1.4), (w * 0.3, 2.8))):       # the stepped parapet over the fin
        pbox(front + out * 0.2 + Vector((0, 0, H_ + sh / 2)), (sw, 0.6, sh), yaw=yaw, col=(0.95, 0.93, 0.88))
    ent = front + out * 1.0 + Vector((0, 0, 3.2)); pbox(ent, (4.6, 2.0, 0.2), yaw=yaw, col=(0.95, 0.93, 0.88))       # the entrance canopy
    si = rr.randrange(32); u0, v0 = (si % 4) / 4, 1 - (si // 4 + 1) / 8; a_ = front - fwd * 2.8 + out * 0.06; b_ = front + fwd * 2.8 + out * 0.06
    pquad([a_ + Vector((0, 0, 3.6)), b_ + Vector((0, 0, 3.6)), b_ + Vector((0, 0, 4.4)), a_ + Vector((0, 0, 4.4))], 'signs', uv=[(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 0.125), (u0, v0 + 0.125)])
    roof(c4, H_, col=(0.8, 0.78, 0.72)); roof_clutter(c4, H_, rr.randint(0, 2))
def tower(c, w, d, yaw, h, key):
    c4 = footprint(c, w, d, yaw)
    pod = footprint(c, w + 10, d + 10, yaw)
    for k in range(4): facade(pod[k], pod[(k + 1) % 4], 9.0, rr.choice(('deco_cream', 'res_grey', 'chawl_ochre')), shell=False)
    roof(pod, 9.0, col=(0.6, 0.6, 0.58))
    pf = Vector(((pod[1] - pod[0]).x, (pod[1] - pod[0]).y, 0)); po = Vector((pf.y, -pf.x, 0)).normalized(); n_s = max(1, int(pf.length / 8))
    for q in range(n_s):     # shop boards along the podium's street side
        a_ = pod[0] + pf * (q / n_s) + po * 0.06; b_ = pod[0] + pf * ((q + 0.85) / n_s) + po * 0.06; si = rr.randrange(32); u0, v0 = (si % 4) / 4, 1 - (si // 4 + 1) / 8
        pquad([a_ + Vector((0, 0, 4.0)), b_ + Vector((0, 0, 4.0)), b_ + Vector((0, 0, 5.4)), a_ + Vector((0, 0, 5.4))], 'signs', uv=[(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 0.125), (u0, v0 + 0.125)])
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
# ------------------------------------------------------------------------------------------------ the lanes: stacked homes, tarps, drums, tyres
SLUM = [k for k in KEYS if k.startswith('slum')]
DRUMS = [(0.05, 0.2, 0.58)] * 4 + [(0.8, 0.6, 0.08), (0.55, 0.2, 0.1), (0.7, 0.7, 0.66)]      # blue plastic mostly, then oil yellow, rust, white
TARPS = [(0.06, 0.24, 0.62), (0.08, 0.3, 0.7), (0.12, 0.45, 0.42), (0.55, 0.52, 0.48)]
def paint(n0, col):
    for f in list(PB.faces)[n0:]:
        for l in f.loops: l[PVC] = (*col, 1)
def drum(p, col=None):
    n0 = len(PB.faces); cyl(PB, p, 0.29, 0.29, 0.88, n=8, mi=pmi('drum'), cap=True); paint(n0, col or rr.choice(DRUMS))
def tyre(p, rot=None, r=0.34, w=0.2, h=0.21, col=(0.13, 0.13, 0.14), n=8):
    """a tyre lying flat at p (or turned by rot): a square-section ring, r its outer radius"""
    Mx = Matrix.Translation(p) @ (rot or Matrix.Identity(4)); prof = ((r, 0.0), (r, h), (r - w, h), (r - w, 0.0))
    v = [[PB.verts.new(Mx @ Vector((pr * math.cos(2 * math.pi * a / n), pr * math.sin(2 * math.pi * a / n), z))) for pr, z in prof] for a in range(n)]
    for a in range(n):
        for q in range(4):
            f = PB.faces.new([v[a][q], v[(a + 1) % n][q], v[(a + 1) % n][(q + 1) % 4], v[a][(q + 1) % 4]]); f.material_index = pmi('tyre')
            for l in f.loops: l[PVC] = (*col, 1)
def scrap_pile(p, yaw):
    """what piles up beside a lane: drums, tyre stacks, a heap of planks"""
    fwd = Vector((math.cos(yaw), math.sin(yaw), 0)); out = Vector((-fwd.y, fwd.x, 0)); kind = rr.random()
    if kind < 0.42:
        for q in range(rr.randint(2, 5)): drum(p + fwd * (q * 0.62 + rr.uniform(-0.05, 0.05)) + out * rr.uniform(-0.1, 0.1))
        if rr.random() < 0.4: drum(p + fwd * 0.31 + Vector((0, 0, 0.88)))
    elif kind < 0.85:
        for s in range(rr.randint(1, 3)):
            b = p + fwd * (s * 0.8)
            for q in range(rr.randint(2, 6)): tyre(b + Vector((rr.uniform(-0.03, 0.03), rr.uniform(-0.03, 0.03), q * 0.21)))
        tyre(p - fwd * 0.7 + Vector((0, 0, 0.34)), Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(1.25, 4, 'Y'))      # one leaning
    else:
        for q in range(rr.randint(3, 6)): pbox(p + fwd * rr.uniform(-0.6, 0.6) + out * rr.uniform(-0.3, 0.3) + Vector((0, 0, 0.1 + q * 0.1)), (rr.uniform(2.0, 3.2), 0.28, 0.07), yaw=yaw + rr.uniform(-0.3, 0.3), k='hull', col=(0.8, 0.72, 0.62))
def slum(c, w, d, yaw, floors, key):
    """a stacked lane home: each storey its own size, offset and material, a tin or tarp roof held down by tyres, drums and a ladder"""
    yaw += rr.uniform(-0.07, 0.07)         # nobody built these to a line
    fwd = Vector((math.cos(yaw), math.sin(yaw), 0)); out = Vector((math.sin(yaw), -math.cos(yaw), 0)); z = 0.0
    for f in range(floors):
        cf = c + fwd * rr.uniform(-0.5, 0.5) + out * rr.uniform(-0.4, 0.4) if f else c
        c4 = footprint(Vector((cf.x, cf.y, 0)), w * rr.uniform(0.86, 1.0), d * rr.uniform(0.86, 1.0), yaw); z1 = z + 2.7
        for q in range(4): facade(c4[q], c4[(q + 1) % 4], z1, key if not f else rr.choice(SLUM), z0=z)
        if f < floors - 1: pquad([p + Vector((0, 0, z1)) for p in c4], 'slab', col=(0.4, 0.38, 0.36))     # the lower roof, seen where the storey above steps in
        if not f: ground = c4
        z = z1
    H_ = z; top = rr.random()
    def at(a, b, rise): return c4[0].lerp(c4[1], a).lerp(c4[3].lerp(c4[2], a), b) + Vector((0, 0, H_ + 0.08 + rise * b))
    if top < 0.8:             # one pitch, low at the front: tin in old colours, or a tarp that sits lower
        tin = top < 0.55; rise = 1.7 if tin else 1.2      # steep enough to be seen from the road
        col = rr.choice([(0.72, 0.68, 0.64), (0.6, 0.36, 0.28), (0.4, 0.46, 0.52), (0.82, 0.78, 0.7)]) if tin else rr.choice(TARPS)
        hi = Vector((0, 0, H_ + 0.08 + rise)); lo = Vector((0, 0, H_ + 0.08)); wall = Vector((0, 0, H_))
        pquad([c4[0] + lo, c4[1] + lo, c4[2] + hi, c4[3] + hi], 'tin' if tin else 'cloth', col=col)
        pquad([c4[2] + wall, c4[3] + wall, c4[3] + hi, c4[2] + hi], 'tin', col=(0.5, 0.46, 0.42))      # the back, closed
        pquad([c4[1] + wall, c4[2] + wall, c4[2] + hi], 'tin', col=(0.5, 0.46, 0.42)); pquad([c4[3] + wall, c4[0] + wall, c4[3] + hi], 'tin', col=(0.5, 0.46, 0.42))
        for _ in range(rr.choice((0, 0, 1, 2, 3, 4))): tyre(at(rr.uniform(0.12, 0.88), rr.uniform(0.15, 0.85), rise), n=6)
        if rr.random() < 0.25: drum(at(rr.uniform(0.2, 0.8), 0.15, 0))
    else:                     # a flat slab with its own clutter
        pquad([p + Vector((0, 0, H_)) for p in c4], 'slab', col=(0.5, 0.48, 0.45))
        for _ in range(rr.randint(1, 3)): drum(at(rr.uniform(0.15, 0.85), rr.uniform(0.15, 0.85), 0))
        if rr.random() < 0.5:
            b = at(rr.uniform(0.2, 0.8), rr.uniform(0.2, 0.8), 0)
            for q in range(rr.randint(2, 4)): tyre(b + Vector((0, 0, q * 0.21)), n=6)
    a_, b_ = ground[0], ground[1]
    if rr.random() < 0.6:                         # a lean-to over the door, tarp or tin, on two poles; a tyre or two to hold it down
        t0 = rr.uniform(0.0, 0.3); t1 = rr.uniform(0.6, 1.0); p0, p1 = a_.lerp(b_, t0), a_.lerp(b_, t1); d_ = out * rr.uniform(1.1, 1.8); lo = Vector((0, 0, 2.05)); hi = Vector((0, 0, 2.55)); tarp = rr.random() < 0.6
        pquad([p0 + hi, p1 + hi, p1 + d_ + lo, p0 + d_ + lo], 'cloth' if tarp else 'tin', col=rr.choice(TARPS) if tarp else rr.choice([(0.72, 0.68, 0.64), (0.6, 0.36, 0.28), (0.4, 0.46, 0.52)]))
        for q_ in (p0, p1): pbox(q_ + d_ + Vector((0, 0, 1.0)), (0.07, 0.07, 2.05), k='rail')
        for _ in range(rr.choice((0, 1, 2))): tyre(p0.lerp(p1, rr.uniform(0.2, 0.8)) + d_ * 0.5 + Vector((0, 0, 2.32)))
    if rr.random() < 0.3:                         # a shop board over the door
        si = rr.randrange(32); u0, v0 = (si % 4) / 4, 1 - (si // 4 + 1) / 8; m_ = (a_ + b_) / 2 + out * 0.05; hw_ = min(1.6, w * 0.3)
        pquad([m_ - fwd * hw_ + Vector((0, 0, 2.2)), m_ + fwd * hw_ + Vector((0, 0, 2.2)), m_ + fwd * hw_ + Vector((0, 0, 2.68)), m_ - fwd * hw_ + Vector((0, 0, 2.68))], 'signs', uv=[(u0, v0), (u0 + 0.25, v0), (u0 + 0.25, v0 + 0.125), (u0, v0 + 0.125)])
    if floors > 1 and rr.random() < 0.5:          # an outside ladder to the upper room
        p = (c4[0] + c4[1]) / 2 + fwd * rr.uniform(-1.2, 1.2) + out * 0.25
        for sx in (-0.22, 0.22): pbox(p + fwd * sx + Vector((0, 0, 1.35)), (0.05, 0.05, 2.7), k='rail')
        for q in range(4): pbox(p + Vector((0, 0, 0.5 + q * 0.6)), (0.44, 0.04, 0.04), yaw=yaw, k='rail')
    if floors > 1 and rr.random() < 0.45:         # washing on a line across the front
        p = (c4[0] + c4[1]) / 2 + out * 0.45 + Vector((0, 0, 3.75)); pbox(p + Vector((0, 0, 0.42)), (w * 0.85, 0.04, 0.04), yaw=yaw, k='wire')      # a line you can see, or the clothes float
        for q in range(rr.randint(3, 6)):
            hh_ = rr.uniform(0.55, 0.85); pbox(p + fwd * rr.uniform(-w * 0.38, w * 0.38) + Vector((0, 0, 0.42 - hh_ / 2)), (rr.uniform(0.35, 0.7), 0.02, hh_), yaw=yaw, k='cloth', col=rr.choice([(0.6, 0.2, 0.18), (0.68, 0.56, 0.24), (0.22, 0.32, 0.5), (0.78, 0.78, 0.72), (0.6, 0.38, 0.46), (0.28, 0.44, 0.32)]))
def tin_fence(a, b, h=2.6):
    """a patchwork fence of corrugated sheets from a to b, in old paint"""
    L = (b - a).length; n_ = max(1, int(L / 1.8))
    for q in range(n_):
        p0, p1 = a.lerp(b, q / n_), a.lerp(b, (q + 1) / n_); hh = h * rr.uniform(0.88, 1.06)
        pquad([p0, p1, p1 + Vector((0, 0, hh)), p0 + Vector((0, 0, hh))], 'tin', col=rr.choice([(0.8, 0.76, 0.7), (0.55, 0.32, 0.26), (0.32, 0.45, 0.58), (0.4, 0.55, 0.42), (0.75, 0.62, 0.3)]))
# ------------------------------------------------------------------------------------------------ the mosque: our own, a type not a copy
def lathe(c, prof, k, col=(1, 1, 1), n=16, rib=None, ribs=2):
    """a surface of revolution: prof is [(radius, height)], bottom to top; rib: every `ribs`-th segment in this colour"""
    v = [[PB.verts.new(c + Vector((r * math.cos(2 * math.pi * a / n), r * math.sin(2 * math.pi * a / n), z))) for a in range(n)] for r, z in prof]
    for q in range(len(prof) - 1):
        for a in range(n):
            f = PB.faces.new([v[q][a], v[q][(a + 1) % n], v[q + 1][(a + 1) % n], v[q + 1][a]]); f.material_index = pmi(k); f.smooth = True
            for l in f.loops: l[PVC] = (*(rib if rib and a % ribs == 0 else col), 1)
def onion(r, h):
    return [(r * x, h * y) for x, y in ((0.74, 0.0), (0.98, 0.16), (1.0, 0.3), (0.86, 0.52), (0.56, 0.72), (0.22, 0.88), (0.07, 0.96), (0.015, 1.0))]
GREEN = (0.16, 0.52, 0.34)
def crescent(p, side, s=1.0):
    """a pole and a crescent, in the plane of `side` and up"""
    pbox(p + Vector((0, 0, 0.8 * s)), (0.12 * s, 0.12 * s, 1.6 * s), k='rail'); c_ = p + Vector((0, 0, 2.1 * s)); up = Vector((0, 0, 1))
    def o(a, r, dx=0.0): return c_ + side * (math.cos(a) * r + dx) * s + up * math.sin(a) * r * s
    for q in range(7):
        a0, a1 = math.radians(50 + q * 37), math.radians(50 + (q + 1) * 37); pts = (o(a0, 0.62), o(a1, 0.62), o(a1, 0.48, 0.17), o(a0, 0.48, 0.17))
        pquad(pts, 'saffron'); pquad(pts[::-1], 'saffron')
def minaret(p, h, r=1.0):
    cyl(PB, p, r * 1.15, r * 0.72, h, n=10, mi=pmi('white'), cap=False)
    for z in (h * 0.58, h * 0.86):
        cyl(PB, p + Vector((0, 0, z)), r * 1.3, r * 1.45, 0.5, n=12, mi=pmi('white'), cap=True)
        cyl(PB, p + Vector((0, 0, z + 0.5)), r * 1.0, r * 1.0, 0.25, n=10, mi=pmi('glow'), cap=False)     # a lit ring on each balcony
    lathe(p + Vector((0, 0, h)), onion(r * 1.0, r * 3.0), 'dome', GREEN, n=10)
def mosque(c, yaw, s=1.0):
    """a walled court in front, a prayer hall with a row of pointed arches, one big onion dome, two small ones, two minarets; front on -d"""
    fwd = Vector((math.cos(yaw), math.sin(yaw), 0)); out = Vector((math.sin(yaw), -math.cos(yaw), 0)); up = Vector((0, 0, 1)); W_, D_ = 30 * s, 22 * s
    pbox(c + up * 0.5 * s, (W_ + 8 * s, D_ + 18 * s, 1.0 * s), yaw=yaw, k='stone', col=(0.9, 0.86, 0.78))
    hall = c - out * 4 * s; hh = 11 * s
    pbox(hall + up * (1.0 * s + hh / 2), (W_, D_, hh), yaw=yaw, k='white')
    front = hall + out * (D_ / 2 + 0.06)
    for q in range(5):        # the arches: dark pointed openings with a green surround
        x = (q - 2) * W_ / 5.4; w_ = 2.3 * s * (1.25 if q == 2 else 1.0); z0, z1, z2 = 1.2 * s, 7.2 * s, 9.4 * s
        def p(dx, z, push=0.0): return front + out * push + fwd * (x + dx) + up * z
        pquad([p(-w_ - 0.35 * s, z0), p(w_ + 0.35 * s, z0), p(w_ + 0.35 * s, z1), p(0, z2 + 0.5 * s), p(-w_ - 0.35 * s, z1)], 'dome', col=GREEN)
        pquad([p(-w_, z0, 0.04), p(w_, z0, 0.04), p(w_, z1, 0.04), p(0, z2, 0.04), p(-w_, z1, 0.04)], 'slab', col=(0.07, 0.07, 0.08))
    top = hall + up * (1.0 * s + hh)
    for sx in range(-7, 8):   # battlements along the front
        pbox(top + out * (D_ / 2 - 0.2 * s) + fwd * sx * W_ / 15 + up * 0.5 * s, (0.8 * s, 0.4 * s, 1.0 * s), yaw=yaw, k='white')
    cyl(PB, top, 8.0 * s, 8.0 * s, 3.0 * s, n=16, mi=pmi('white'), cap=False)                        # the drum
    lathe(top + up * 3.0 * s, onion(10.5 * s, 15.0 * s), 'dome', GREEN, n=20)
    crescent(top + up * 18 * s, fwd, s * 1.6)
    for sx in (-1, 1):
        q = top + fwd * sx * 10.5 * s
        cyl(PB, q, 3.4 * s, 3.4 * s, 1.5 * s, n=12, mi=pmi('white'), cap=False); lathe(q + up * 1.5 * s, onion(4.2 * s, 6.0 * s), 'dome', GREEN, n=12)
        minaret(hall + fwd * sx * (W_ / 2 + 2.0 * s) + out * (D_ / 2 + 1.0 * s) + up * 1.0 * s, 32 * s, 1.1 * s)
    for sx in (-1, 1):        # the court's walls and its gate
        pbox(c + out * (9 * s) + fwd * sx * (W_ / 2 + 1 * s) + up * 2.0 * s, (0.8 * s, 16 * s, 2.4 * s), yaw=yaw, k='white')
        pbox(c + out * (17 * s) + fwd * sx * (W_ / 4 + 3.0 * s) + up * 2.0 * s, (W_ / 2 - 3.5 * s, 0.8 * s, 2.4 * s), yaw=yaw, k='white')
        pbox(c + out * (17 * s) + fwd * sx * 3.2 * s + up * 3.5 * s, (1.6 * s, 1.6 * s, 5.5 * s), yaw=yaw, k='white')
# ------------------------------------------------------------------------------------------------ the grand hotel: modelled on the user's reference of the Taj Mahal Palace
# grey block stone and round arches, hemispherical ribbed red domes on round corner towers, a great ribbed dome and lantern, long red roofs, twelve sand bay columns with red eaves
RED = (0.8, 0.13, 0.09); RIB = (0.66, 0.58, 0.56); STONE = (0.58, 0.58, 0.6); PALE = (0.84, 0.84, 0.82); SAND = (0.86, 0.72, 0.46); DARK = (0.06, 0.07, 0.09); WARM_IN = (0.42, 0.34, 0.25)
def dome_prof(r, h): return [(r * math.cos(t), h * math.sin(t)) for t in (0.0, 0.26, 0.52, 0.78, 1.02, 1.24, 1.42, 1.56)]
def red_dome(c, r, h, ribs=8, n=48): lathe(c, dome_prof(r, h), 'dome', RED, n=n, rib=RIB if ribs else None, ribs=max(1, n // max(ribs, 1)))      # n >> ribs: thin ribs
def scyl(p, r0, r1, h, n=16, col=STONE, cap=False, k='stone'):
    n0 = len(PB.faces); cyl(PB, p, r0, r1, h, n=n, mi=pmi(k), cap=cap); paint(n0, col)
def finial(p, s=1.0):
    """the grey spire on every dome: a collar, a bulb and a needle"""
    lathe(p, [(0.5 * s, 0), (0.42 * s, 0.5 * s), (0.2 * s, 0.9 * s), (0.34 * s, 1.5 * s), (0.2 * s, 2.0 * s), (0.08 * s, 3.2 * s), (0.01 * s, 4.4 * s)], 'stone', (0.46, 0.46, 0.48), n=8)
def arch_poly(c, fwd_, w, z0, spring, up=Vector((0, 0, 1)), steps=6):
    """a round-headed opening: its outline, from the sill round the arc, on the plane of fwd_ and up"""
    pts = [c - fwd_ * w + up * z0, c + fwd_ * w + up * z0]
    pts += [c + fwd_ * (w * math.cos(math.pi * q / steps)) + up * (spring + w * math.sin(math.pi * q / steps)) for q in range(steps + 1)]
    return pts
def round_tower(c, r, z0, h, floors=True):
    """a round stone tower as facade strips (windows run continuously round it), courses and a cornice"""
    n = 18; pts = [c + Vector((r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n), 0)) for k in range(n)]; u = 0.0
    for k in range(n):
        a = pts[k]; b = pts[(k + 1) % n]; facade(Vector((a.x, a.y, 0)), Vector((b.x, b.y, 0)), z0 + h, 'taj_tower', z0=z0, u0=u); u += (a - b).length
    return pts
def taj(c, yaw):
    """the palace of the seafront, its front on -d, toward the road and the sea: 126 m wide over all, seven floors, 58 m to the top of the great dome"""
    fwd = Vector((math.cos(yaw), math.sin(yaw), 0)); out = Vector((math.sin(yaw), -math.cos(yaw), 0)); up = Vector((0, 0, 1)); FH = 3.6; Y = 12.0
    def P(x, y, z=0.0): return c + fwd * x + out * y + up * z
    def block(x, y, w, d, h):
        ctr = P(x, y); c4 = footprint(Vector((ctr.x, ctr.y, 0)), w, d, yaw)
        for k in range(4): facade(c4[k], c4[(k + 1) % 4], h, 'taj_stone', z0=1.0)
        pquad([q + up * h for q in c4], 'slab', col=(0.46, 0.46, 0.46))
    H_ = 1.0 + 7 * FH; HC = 1.0 + 8 * FH
    pbox(c + up * 0.5, (128, 44, 1.0), yaw=yaw, k='stone', col=(0.56, 0.56, 0.56))
    block(0, 0, 108, 24, H_); block(0, 1.5, 18, 28, HC)
    for sx in (-1, 1): block(sx * 44, 1, 12, 26, H_)
    # the ground floor's arcade, warm inside; a balustraded terrace over it; another balustrade under the top floors
    for k in range(19):
        x = -50.4 + k * 5.6
        if abs(x) < 9.2 or abs(abs(x) - 44) < 6.2: continue
        q = P(x, Y + 0.06); pquad(arch_poly(q, fwd, 2.1, 1.0, 3.6), 'slab', col=WARM_IN)
    for x in (-44, -41, -47, 44, 41, 47, -5.2, 0, 5.2):
        y_ = 15.06 if abs(x) < 8 else 14.06; pquad(arch_poly(P(x, y_), fwd, 1.25 if abs(x) > 8 else 2.2, 1.0, 3.2 if abs(x) > 8 else 4.6), 'slab', col=WARM_IN)
    for z, y_, w_ in ((6.6, Y, 108.0), (23.2, Y, 108.0)):
        pbox(P(0, y_ + 0.6, z - 0.08), (w_, 1.2, 0.16), yaw=yaw, k='stone', col=PALE); pbox(P(0, y_ + 1.15, z + 0.45), (w_, 0.08, 0.1), yaw=yaw, k='white');
        for q in range(int(w_ / 1.6)): pbox(P(-w_ / 2 + 0.8 + q * 1.6, y_ + 1.15, z + 0.2), (0.1, 0.1, 0.5), k='white')
    pbox(P(0, Y + 0.25, H_ - 0.15), (109, 0.7, 0.4), yaw=yaw, k='stone', col=PALE); pbox(P(0, Y + 0.62, H_ - 0.42), (104, 0.05, 0.08), yaw=yaw, k='glow')
    # the twelve bay columns: three tiers of sand hexagon, each with a red eave, under a stone-and-red pyramid
    for sx in (-1, 1):
        for k in range(6):
            b = P(sx * (12.6 + k * 4.9), Y + 0.7); r = 2.15
            for t in range(3):
                z0 = 7.6 + t * 4.7; pts = [b + fwd * (r * math.cos(math.pi * q / 3 + math.pi / 6)) + out * (r * math.sin(math.pi * q / 3 + math.pi / 6)) for q in range(6)]
                for q in range(6): facade(Vector((pts[(q + 1) % 6].x, pts[(q + 1) % 6].y, 0)), Vector((pts[q].x, pts[q].y, 0)), z0 + 4.2, 'taj_sand', z0=z0)
                n0 = len(PB.faces); cyl(PB, b + up * (z0 + 3.95), r + 1.1, r + 0.05, 0.75, n=6, mi=pmi('dome'), cap=False); paint(n0, RED)
            scyl(b + up * (7.6 + 3 * 4.7 - 0.5), r + 0.45, 0.3, 2.7, n=6, col=(0.55, 0.53, 0.5))
            n0 = len(PB.faces); cyl(PB, b + up * (7.6 + 3 * 4.7 + 1.1), 1.35, 0.1, 1.7, n=6, mi=pmi('dome'), cap=False); paint(n0, RED)
            scyl(b + up * (7.6 - 1.3), 0.5, r, 1.3, n=6, col=SAND)                                  # the corbel it grows from
    # the long red roofs: a hip over each wing, behind the balustrade
    for sx in (-1, 1):
        x0, x1 = sx * 9.2, sx * 49.5; hr = H_ + 4.2
        a, b, d_, e = P(x0, Y, H_), P(x1, Y, H_), P(x1, -Y, H_), P(x0, -Y, H_); m0, m1 = P(x0, 0, hr), P(x1 - sx * 6, 0, hr)
        for q in ([a, b, m1, m0], [d_, e, m0, m1], [b, d_, m1]): pquad(q, 'dome', col=(0.84, 0.2, 0.14))
        # the gable over each wing's end bay, stacked pale balconies under it
        g = P(sx * 44, 14.1); w = 6.4
        for off_, wid, zb, zt in ((0.06, w, H_, H_ + 2.2), (0.08, w * 0.62, H_ + 2.2, H_ + 3.7)):
            q0 = g + out * off_; pquad([q0 - fwd * wid + up * zb, q0 + fwd * wid + up * zb, q0 + fwd * (wid * 0.55) + up * zt, q0 - fwd * (wid * 0.55) + up * zt], 'dome', col=RED)
        q0 = g + out * 0.1; pquad([q0 - fwd * (w * 0.34) + up * (H_ + 3.7), q0 + fwd * (w * 0.34) + up * (H_ + 3.7), q0 + up * (H_ + 5.0)], 'dome', col=RED)
        for f in range(1, 7):
            z = 1.0 + f * FH; pbox(g + out * 0.5 + up * z, (9.6, 1.0, 0.14), yaw=yaw, k='stone', col=PALE); pbox(g + out * 0.98 + up * (z + 0.9), (9.6, 0.05, 0.08), yaw=yaw, k='white')
            for bx in range(-4, 5, 2): pbox(g + out * 0.98 + fwd * (bx * 1.15) + up * (z + 0.45), (0.08, 0.08, 0.9), k='white')
        # behind the roofs: a wide low dome, a small one, a chimney stack
        wd = P(sx * 34, -3.5, H_ + 2.6); scyl(wd - up * 0.2, 9.8, 9.8, 0.5, n=24, col=PALE, cap=True); red_dome(wd + up * 0.3, 9.4, 6.6, ribs=8); finial(wd + up * 6.8, 1.0)
        sd_ = P(sx * 21, -5, H_ + 2.4); scyl(sd_ - up * 2.4, 3.4, 3.4, 2.4, n=12); red_dome(sd_, 3.4, 3.6, ribs=6, n=36); finial(sd_ + up * 3.6, 0.65)
        pbox(P(sx * 27.5, -6, H_ + 5.0), (4.4, 3.0, 10.0), yaw=yaw, k='slab', col=(0.56, 0.56, 0.58))
        # the great round corner tower, its dark arched base, its courses, its ribbed dome
        t_ = P(sx * 56.5, 7.0); rt = 6.6; TH = 31.0; round_tower(t_, rt, 7.0, TH - 7.0)
        scyl(t_ + up * 0.0, rt + 0.9, rt + 0.7, 7.0, n=18)
        for q in range(9):
            a_ = 2 * math.pi * q / 9; o_ = Vector((math.cos(a_), math.sin(a_), 0)); tg = Vector((-o_.y, o_.x, 0)); q0 = t_ + o_ * (rt + 0.78)
            pquad(arch_poly(q0, tg, 1.15, 1.2, 3.6), 'slab', col=DARK)
        for z, dr in ((7.0, 0.5), (15.0, 0.35), (25.0, 0.35), (TH, 0.7)): scyl(t_ + up * (z - 0.2), rt + dr, rt + dr, 0.55, n=18, col=PALE, cap=z == TH)
        red_dome(t_ + up * (TH + 0.35), rt + 0.1, 8.2, ribs=8); finial(t_ + up * (TH + 8.4), 1.15)
        # the two round towers beside the great dome, open colonnades at their tops
        f_ = P(sx * 12.8, 9.0); scyl(f_ + up * (HC - 4.0), 3.4, 3.4, 4.0 + 2.6, n=14)
        scyl(f_ + up * (HC + 2.6), 3.8, 3.8, 0.4, n=14, col=PALE, cap=True)
        for q in range(8):
            a_ = 2 * math.pi * q / 8; pbox(f_ + Vector((math.cos(a_) * 2.9, math.sin(a_) * 2.9, HC + 4.2)), (0.4, 0.4, 2.8), k='stone', col=PALE)
        scyl(f_ + up * (HC + 5.6), 3.5, 3.5, 0.35, n=14, col=PALE, cap=True); red_dome(f_ + up * (HC + 5.95), 3.3, 4.2, ribs=6, n=36); finial(f_ + up * (HC + 10.1), 0.75)
    # the central bay: a little sand pediment on the front
    q0 = P(0, 15.6); pquad([q0 - fwd * 4.2 + up * HC, q0 + fwd * 4.2 + up * HC, q0 + up * (HC + 3.6)], 'stone', col=SAND); pquad([q0 + out * 0.05 - fwd * 2.8 + up * (HC + 0.4), q0 + out * 0.05 + fwd * 2.8 + up * (HC + 0.4), q0 + out * 0.05 + up * (HC + 2.8)], 'dome', col=RED)
    # the great dome: a stone drum with round-headed windows, a pale cornice, the ribbed red dome, a lantern, its own small dome
    d0 = P(0, -1, HC); RD = 10.8
    scyl(d0, RD, RD, 6.6, n=24)
    for q in range(12):
        a_ = 2 * math.pi * q / 12; o_ = Vector((math.cos(a_), math.sin(a_), 0)); tg = Vector((-o_.y, o_.x, 0)); pquad(arch_poly(d0 + o_ * (RD + 0.05), tg, 1.25, 1.2, 3.8), 'slab', col=DARK)
    scyl(d0 + up * 6.6, RD + 0.7, RD + 0.7, 0.6, n=24, col=PALE, cap=True)
    red_dome(d0 + up * 7.2, RD + 0.2, 13.6, ribs=8, n=64); top = d0 + up * (7.2 + 13.6)
    scyl(top - up * 0.2, 2.9, 2.9, 0.4, n=12, col=PALE, cap=True)
    for q in range(8):
        a_ = 2 * math.pi * q / 8; pbox(top + Vector((math.cos(a_) * 2.3, math.sin(a_) * 2.3, 1.7)), (0.34, 0.34, 3.2), k='stone', col=PALE)
    scyl(top + up * 3.3, 2.9, 2.9, 0.35, n=12, col=PALE, cap=True); red_dome(top + up * 3.65, 2.6, 3.0, ribs=6, n=36); finial(top + up * 6.65, 0.95)
