# Second half of art_v12.py (exec'd in its namespace): signage restore, LED lines, street dressing, pagoda, bridge/gate/wheel lighting,
# sky, cameras, budget, clearance after, save.
import json as _json

SIGNC = newcoll('V12 | street signage and lanterns')
LEDC = newcoll('V12 | LED lines and searchlights')
PAGC = newcoll('V12 | architecture pagoda landmark')
TREEC = newcoll('V12 | sakura lining')


def seg_box(bm, a, b, w, h, mi=0):
    """thin bar from a to b (width w sideways, height h up)"""
    a, b = Vector(a), Vector(b)
    d = (b - a)
    if d.length < 1e-4:
        return
    d.normalize()
    side = d.cross(Vector((0, 0, 1)))
    if side.length < 1e-4:
        side = Vector((1, 0, 0))
    side.normalize()
    up = side.cross(d).normalized()
    pts = []
    for p in (a, b):
        for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            pts.append(p + side * sx * w / 2 + up * sz * h / 2)
    for idx in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        quad(bm, [tuple(pts[i]) for i in idx], mi=mi)


def vis_z(o):
    return o.matrix_world.translation.z


# ------------------------------------------------------------------------------------------------ 3e restore v8 signage density
SIGN_FAM = ('Lit tenant', 'Tenant vertical', 'Shop fascia', 'Neon blade', 'Japanese blade')
restored = 0
for o in sc.objects:
    if o.hide_render and o.name.startswith(SIGN_FAM):
        i, d, lat = cl.nearest(o.location.x, o.location.y)
        if 15.5 < d < 45 and cl.P[i, 2] > 0.2 and abs(i - s0) > 70:
            o.hide_render = False
            o.hide_viewport = False
            restored += 1
LOG['v8 signs restored'] = restored
log('signs restored', restored)

# the red-framed lit-window mid-rises of the v8 avenue (hidden in v10), only along the hero avenue and where no v10 frontage stands
AV = cl.nearest(*cl.raw[270][:2])[0]                       # station of the neon avenue
fr_pos = np.array([[o.location.x, o.location.y] for o in fr_main])
rest_b = 0
for o in sc.objects:
    if o.hide_render and o.name.startswith(('Street infill', 'Street frontage')) and o.type == 'MESH':
        i, d, lat = cl.nearest(o.location.x, o.location.y)
        if abs(i - AV) < 110 and 19 < d < 60 and np.min(np.linalg.norm(fr_pos - np.array([o.location.x, o.location.y]), axis=1)) > 24:
            o.hide_render = False
            o.hide_viewport = False
            rest_b += 1
LOG['avenue mid-rises restored'] = rest_b
log('avenue blocks restored', rest_b)

# ------------------------------------------------------------------------------------------------ 3f LED lines: lagoon edge, bay shore
lag = bpy.data.objects['V10 lagoon surface | bay datum -0.55m']
cop = bpy.data.objects['V10 lagoon stone coping and retaining bank']
ztop = max((cop.matrix_world @ Vector(v)).z for v in cop.bound_box)
bmq = bmesh.new()
bmq.from_mesh(lag.data)
bl = bmesh.new()
n_l = 0
for e in bmq.edges:
    if e.is_boundary:
        a, b_ = lag.matrix_world @ e.verts[0].co, lag.matrix_world @ e.verts[1].co
        seg_box(bl, (a.x, a.y, ztop + 0.12), (b_.x, b_.y, ztop + 0.12), 0.45, 0.25)
        n_l += 1
bmq.free()
to_obj('V12 lagoon purple LED edge', bl, [m_ledp], LEDC)
bay = bpy.data.objects['Tokyo Bay water']
bb = [bay.matrix_world @ Vector(v) for v in bay.bound_box]
ctr = np.array([cl.P[:, 0].mean(), cl.P[:, 1].mean()])
bx = [(v.x, v.y) for v in bb]
xmin, xmax = min(v[0] for v in bx), max(v[0] for v in bx)
ymin, ymax = min(v[1] for v in bx), max(v[1] for v in bx)
shore_x = xmin if abs(xmin - ctr[0]) < abs(xmax - ctr[0]) else xmax
bl = bmesh.new()
step = 40.0
ys = np.arange(ymin + 100, ymax - 100, step)
for y0 in ys:
    seg_box(bl, (shore_x, y0, 0.5), (shore_x, y0 + step * 0.82, 0.5), 0.8, 0.5)
to_obj('V12 bay shore cyan LED line', bl, [m_ledc], LEDC)
LOG['led'] = dict(lagoon_edges=n_l, bay_shore_x=round(shore_x), bay_bbox=[round(xmin), round(xmax), round(ymin), round(ymax)])
log('led', LOG['led'])

# searchlights: additive cones into the sky
slm = bpy.data.materials.new('V12 searchlight beam')
slm.use_nodes = True
slm.surface_render_method = 'BLENDED'
nt = slm.node_tree
nt.nodes.clear()
em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.7, 0.85, 1.0, 1); em.inputs['Strength'].default_value = 3.0
tr = nt.nodes.new('ShaderNodeBsdfTransparent')
mx = nt.nodes.new('ShaderNodeMixShader')
tcn = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ')
mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0; mr.inputs['From Max'].default_value = 1; mr.inputs['To Min'].default_value = 0.10; mr.inputs['To Max'].default_value = 0.0
out = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(tcn.outputs['Generated'], sp.inputs[0]); nt.links.new(sp.outputs['Z'], mr.inputs['Value'])
nt.links.new(mr.outputs['Result'], mx.inputs['Fac']); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
nt.links.new(mx.outputs[0], out.inputs[0])
HEIGHT = 700.0
sl_sites = [cl.at(s0 - 90, -190, 0), cl.at(s0 + 120, 210, 0), cl.at(s0 + 20, -260, 0), (shore_x - 60 * (1 if shore_x < ctr[0] else -1), -300, 0),
            (shore_x - 60 * (1 if shore_x < ctr[0] else -1), 250, 0), (shore_x - 60 * (1 if shore_x < ctr[0] else -1), -850, 0)]
for k, site in enumerate(sl_sites):
    bmc = bmesh.new()
    bmesh.ops.create_cone(bmc, cap_ends=False, cap_tris=False, segments=20, radius1=0.5, radius2=15, depth=HEIGHT, matrix=Matrix.Translation((0, 0, HEIGHT / 2)))
    me = bpy.data.meshes.new(f'searchlight {k}')
    bmc.to_mesh(me); bmc.free()
    me.materials.append(slm)
    ob = bpy.data.objects.new(f'V12 searchlight beam {k}', me)
    ob.location = Vector(site) + Vector((0, 0, 0.5))
    ob.rotation_euler = (math.radians(rnd.uniform(-25, 25)), math.radians(rnd.uniform(-25, 25)), 0)
    ob.visible_shadow = False
    LEDC.objects.link(ob)
    ob.data.polygons.foreach_set('use_smooth', [True] * len(ob.data.polygons))

# ------------------------------------------------------------------------------------------------ 3g street dressing: neon pylons, lanterns, sakura
street_st = []
for i in range(0, M, 6):
    cnt = int((np.linalg.norm(fr_pos - cl.P[i, :2], axis=1) < 48).sum())
    if (cnt >= 1 or abs(i - AV) < 120) and cl.P[i, 2] > 0.2 and abs(i - s0) > 70:
        street_st.append(i)
LOG['street stations'] = len(street_st)
WORDS = ['ホテル', 'ラーメン', '焼肉', 'カラオケ', '居酒屋', '書店', '寿司', '花屋', '珈琲', '電気街', '薬局', '天ぷら', '麺屋', '酒場', '旅館', '喫茶']
NEON = [((1.0, 0.18, 0.55), 'pink'), ((0.12, 0.85, 1.0), 'cyan'), ((1.0, 0.82, 0.5), 'amber'), ((0.95, 0.95, 0.9), 'white'), ((0.7, 0.3, 1.0), 'violet')]
board_mats = {n: glow(f'V12 pylon board {n}', c, 3.2) for c, n in NEON}
text_mats = {n: mat(f'V12 pylon ink {n}', (0.02, 0.02, 0.03), 0.6) for c, n in NEON}
m_pole = mat('V12 pylon pole', (0.03, 0.03, 0.035), 0.5, metal=0.8)
bm_pole, bm_board = bmesh.new(), {n: bmesh.new() for _, n in NEON}
n_pyl = 0
for k, i in enumerate(street_st):
    side = 1 if k % 2 else -1
    lat = side * (17.0 + rnd.uniform(0, 1.6))
    p = cl.at(i, lat)
    ang = math.atan2(cl.T[i][1], cl.T[i][0])
    d = -cl.N[i] * side                                         # facing the road
    word = rnd.choice(WORDS)
    col, cn = NEON[(k * 3 + len(word)) % len(NEON)]
    hgt = rnd.uniform(4.2, 7.0)
    zb = p[2] + rnd.uniform(2.2, 3.4)
    box(bm_pole, (p[0], p[1], p[2]), 0.22, 0.22, zb - p[2] + hgt + 0.3, ang, 0)
    box(bm_board[cn], (p[0] + d[0] * 0.2, p[1] + d[1] * 0.2, zb), 0.12, 1.35, hgt, ang, 0)
    ob = text_obj(f'V12 pylon text {k}', '\n'.join(word), Vector((p[0] + d[0] * 0.3, p[1] + d[1] * 0.3, zb + hgt / 2)), frot(d),
                  min(1.0, hgt / (len(word) * 1.25)), text_mats[cn], SIGNC, 0.02)
    n_pyl += 1
to_obj('V12 pylon poles', bm_pole, [m_pole], SIGNC)
for cn, bmx in bm_board.items():
    if len(bmx.verts):
        to_obj(f'V12 pylon boards {cn}', bmx, [board_mats[cn]], SIGNC)
    else:
        bmx.free()
LOG['pylons'] = n_pyl

# red paper lanterns: one mesh, linked duplicates
lm = bpy.data.meshes.new('V12 lantern')
bmq = bmesh.new()
bmesh.ops.create_uvsphere(bmq, u_segments=14, v_segments=8, radius=0.5)
for v in bmq.verts:
    v.co.x *= 0.6; v.co.y *= 0.6; v.co.z *= 0.85
for f in bmq.faces:
    f.material_index = 0
bmq.to_mesh(lm); bmq.free()
lm.materials.append(glow('V12 red lantern glow', (1.0, 0.1, 0.04), 7.0))
for p_ in lm.polygons:
    p_.use_smooth = True
n_lan = 0
for k, i in enumerate(street_st):
    for side in (-1, 1):
        for j in range(3):
            p = cl.at(i + j * 2, side * (15.4 + 0.3 * j), 3.4 + 0.15 * (j % 2))
            ob = bpy.data.objects.new(f'V12 red lantern {n_lan}', lm)
            ob.location = Vector(p)
            ob.scale = (0.8, 0.8, 0.9)
            SIGNC.objects.link(ob)
            n_lan += 1
LOG['lanterns'] = n_lan

# sakura lining the street sections (linked duplicates of the full-detail heroes; LOD picked by camera distance in the final pass)
sak_heroes = TREE_HEROES.get('sakura', [])
n_sak = 0
for k, i in enumerate(street_st):
    if k % 2:
        continue
    side = 1 if (k // 2) % 2 else -1
    p = cl.at(i + 3, side * rnd.uniform(19.5, 21.5))
    if np.min(np.linalg.norm(fr_pos - p[:2], axis=1)) < 16:
        continue
    hd, ld = sak_heroes[(k // 2) % len(sak_heroes)]
    ob = bpy.data.objects.new(f'V12 sakura lining {n_sak}', hd)
    ob.location = Vector(p)
    ob.rotation_euler.z = rnd.uniform(0, math.tau)
    s_ = rnd.uniform(0.85, 1.25)
    ob.scale = (s_, s_, s_)
    TREEC.objects.link(ob)
    TREE_MAP[ob.name] = (hd, ld)
    n_sak += 1
LOG['sakura lining'] = n_sak
log('street', {k: LOG[k] for k in ('street stations', 'pylons', 'lanterns', 'sakura lining')})

# ------------------------------------------------------------------------------------------------ 3h pagoda landmark beside the hero avenue
def pagoda(c, yaw, w0=9.0, tiers=5):
    bmw, bmr, bms, bmt, bmg = bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new(), bmesh.new()     # wall, roof, shoji, trim, gold
    z = 0.0
    box(bms, (0, 0, 0), w0 + 6, w0 + 6, 0.8, 0, 0)
    box(bms, (0, 0, 0.8), w0 + 3.5, w0 + 3.5, 0.5, 0, 0)
    z = 1.3

    def rz(x, y):
        return (c[0] + x * math.cos(yaw) - y * math.sin(yaw), c[1] + x * math.sin(yaw) + y * math.cos(yaw))
    for k in range(tiers):
        w = w0 * (0.86 ** k)
        h = 4.0
        e = w + 5.0 - k * 0.6
        # body: red pillars at corners, glowing shoji between
        box(bmw, (*rz(0, 0), c[2] + z), w, w, h, yaw, 0)
        for sx in (-1, 1):
            for sy in (-1, 1):
                box(bmt, (*rz(sx * w / 2, sy * w / 2), c[2] + z), 0.5, 0.5, h + 0.2, yaw, 0)
        for face in range(4):
            a = yaw + face * math.pi / 2
            fx, fy = math.cos(a) * (w / 2 + 0.03), math.sin(a) * (w / 2 + 0.03)
            ccx, ccy = c[0] + fx * 1.0 * 1.0, c[1] + fy
            # shoji panel centred on the face
            px, py = c[0] + math.cos(a) * (w / 2 + 0.03), c[1] + math.sin(a) * (w / 2 + 0.03)
            box(bmg, (px, py, c[2] + z + 0.5), 0.06, w * 0.55, h - 1.0, a, 0)
        # hip roof: 8-point eave ring (corners lifted), 8-point top ring
        zr = c[2] + z + h
        ring_e, ring_t = [], []
        for q in range(8):
            ang = yaw + q * math.pi / 4 + math.pi / 4
            r = e * (0.5 / math.cos(math.pi / 4 - (q % 2) * math.pi / 4)) if True else e
            corner = (q % 2 == 0)
            rr = (e / 2) * (1.414 if corner else 1.0)
            ring_e.append((c[0] + math.cos(ang) * rr, c[1] + math.sin(ang) * rr, zr + (0.9 if corner else -0.15)))
            rt = (w * 0.22) * (1.414 if corner else 1.0)
            ring_t.append((c[0] + math.cos(ang) * rt, c[1] + math.sin(ang) * rt, zr + 2.1))
        for q in range(8):
            q2 = (q + 1) % 8
            quad(bmr, [ring_e[q], ring_e[q2], ring_t[q2], ring_t[q]], mi=0)
        quad(bmr, ring_t, mi=0)
        quad(bmt, [(p_[0], p_[1], p_[2] - 0.35) for p_ in ring_e[::-1]], mi=0)                # soffit
        for q in range(0, 8, 2):                                                                  # warm lanterns at the corners
            bmg_ = ring_e[q]
            box(bmg, (bmg_[0], bmg_[1], bmg_[2] - 0.9), 0.35, 0.35, 0.55, 0, 0)
        z += h + 2.1 - 0.4
    # finial: sorinto
    for q in range(9):
        box(bmt, (c[0], c[1], c[2] + z + q * 0.55), 0.9 - q * 0.07, 0.9 - q * 0.07, 0.35, 0, 0)
    box(bmt, (c[0], c[1], c[2] + z), 0.18, 0.18, 6.0, 0, 0)
    mats = {
        'wall': mat('V12 pagoda red lacquer', (0.35, 0.03, 0.02), 0.45),
        'roof': mat('V12 pagoda dark tile', (0.025, 0.03, 0.04), 0.35, metal=0.2),
        'shoji': glow('V12 pagoda shoji', (1.0, 0.7, 0.32), 5.0),
        'trim': mat('V12 pagoda vermilion trim', (0.6, 0.06, 0.03), 0.4),
        'gold': glow('V12 pagoda lantern glow', (1.0, 0.45, 0.12), 8.0),
    }
    to_obj('V12 pagoda | red walls', bmw, [mats['wall']], PAGC)
    to_obj('V12 pagoda | tiled hip roofs', bmr, [mats['roof']], PAGC)
    to_obj('V12 pagoda | stone base', bms, [mat('V12 stone grey', (0.18, 0.18, 0.2), 0.7)], PAGC)
    to_obj('V12 pagoda | vermilion pillars and soffits', bmt, [mats['trim']], PAGC)
    to_obj('V12 pagoda | glowing shoji and lanterns', bmg, [mats['shoji']], PAGC)
    new_light('V12 pagoda red wash', 'AREA', Vector((c[0], c[1], c[2] + 6)), 30000, (1.0, 0.18, 0.08), size=10, coll=PAGC)
    new_light('V12 pagoda warm wash', 'AREA', Vector((c[0] - 6, c[1] - 6, c[2] + 20)), 20000, (1.0, 0.65, 0.35), size=10, coll=PAGC)


# site: beside the avenue, 40 m ahead of the avenue camera station on the side that has no v10 frontage within 22 m; frontages inside are hidden
PAG_I = AV + 16
best = None
for side in (-1, 1):
    p = cl.at(PAG_I, side * 30)
    dmin = np.min(np.linalg.norm(fr_pos - p[:2], axis=1))
    if best is None or dmin > best[0]:
        best = (dmin, side, p)
_, PSIDE, PPOS = best
n_hid = 0
for o in fr_main:
    if np.hypot(o.location.x - PPOS[0], o.location.y - PPOS[1]) < 24:
        hide(o)
        n_hid += 1
for o in sc.objects:
    if o.name.startswith('V10 frontage') and o.name.endswith(('sign',)) or ('V10 frontage' in o.name and 'projecting sign' in o.name):
        if np.hypot(o.location.x - PPOS[0], o.location.y - PPOS[1]) < 26:
            hide(o)
pagoda(PPOS, math.atan2(cl.T[PAG_I][1], cl.T[PAG_I][0]))
LOG['pagoda'] = dict(pos=[round(float(x)) for x in PPOS], side=PSIDE, frontages_hidden=n_hid)
log('pagoda', LOG['pagoda'])

# ------------------------------------------------------------------------------------------------ 3i bridge: Japanese name, night lighting group, white tower base
towers = [o for o in sc.objects if o.name.startswith('Rounded portal tower')]
m_plaque = mat('V12 bridge plaque', (0.02, 0.02, 0.025), 0.4, emit=(1, 0.9, 0.75), strength=0.0)
gold_txt = glow('V12 bridge text', (1.0, 0.88, 0.6), 7.0)
for t_i, tw in enumerate(towers):
    ti, td, tl = cl.nearest(tw.location.x, tw.location.y)
    for side in (-1, 1):
        for sgn, nm in ((-1, 'approach'),):
            base = Vector(cl.at(ti, side * 12.8, 4.2)) - Vector(cl.T[ti]) * 3.2 * 0
            fw = Vector(cl.T[ti])
            text_obj(f'V12 bridge plaque {t_i} {side}', '東京湾大橋', base - fw * 3.6, frot(-fw), 0.9, gold_txt, SIGNC, 0.03, font=FM)
# overhead entry sign over the deck (two posts + a board) at the bridge entry
BR_I = cl.nearest(*cl.raw[690][:2])[0]
bm = bmesh.new(); bmb = bmesh.new()
ang = math.atan2(cl.T[BR_I][1], cl.T[BR_I][0])
for side in (-1, 1):
    p = cl.at(BR_I, side * 12.0)
    box(bm, (p[0], p[1], p[2]), 0.5, 0.5, 8.4, ang, 0)
a_, b_ = cl.at(BR_I, -12.5, 7.6), cl.at(BR_I, 12.5, 7.6)
seg_box(bmb, a_, b_, 0.5, 2.8)
to_obj('V12 bridge entry sign posts', bm, [m_pole], SIGNC)
board = to_obj('V12 bridge entry sign board', bmb, [mat('V12 sign green', (0.02, 0.18, 0.12), 0.5, emit=(0.02, 0.25, 0.15), strength=0.4)], SIGNC)
fwb = Vector(cl.T[BR_I])
text_obj('V12 bridge entry sign title', '東京湾大橋', Vector(cl.at(BR_I, -3.5, 7.7)) - fwb * 0.4, frot(-fwb), 1.3, gold_txt, SIGNC, 0.03, font=FB)
text_obj('V12 bridge entry sign sub', 'ハイラガナ大橋', Vector(cl.at(BR_I, 5.5, 7.7)) - fwb * 0.4, frot(-fwb), 0.95, gold_txt, SIGNC, 0.03, font=FB)
# night lighting group: the existing bridge lighting collection is renamed so it switches as one (day: hide_render on the group)
for c in bpy.data.collections:
    if c.name == 'V5 | bridge night lighting':
        c.name = 'Bridge | night lighting'
    if c.name == 'V5 | local bridge atmosphere':
        c.name = 'Bridge | night atmosphere'
LOG['bridge'] = dict(towers=len(towers), night_group=[c.name for c in bpy.data.collections if c.name.startswith('Bridge |')])
for c in bpy.data.collections:     # the red night light group, brighter: ref 13 has the towers glowing
    if c.name == 'Bridge | night lighting':
        for lo in c.objects:
            if lo.type == 'LIGHT':
                lo.data.energy *= 1.6
for tw in towers:     # tower base material stays white / pale in daylight; the red is the night light group
    for ms in tw.material_slots:
        if ms.material:
            LOG.setdefault('tower mats', []).append(ms.material.name)

# ------------------------------------------------------------------------------------------------ 3j gate lighting (cyan / magenta like ref 05)
gate = next((o for o in sc.objects if o.name.startswith('V10 01 | Asakusa vermilion romon gate')), None) or next(o for o in sc.objects if 'romon gate' in o.name and o.type == 'MESH')
gp = gate.matrix_world.translation
GL = newcoll('V12 | gate lighting')
for k, (col, off) in enumerate((((0.1, 0.85, 1.0), (-14, -14, 4)), ((1.0, 0.12, 0.55), (14, -14, 4)), ((0.1, 0.85, 1.0), (-8, 16, 3)), ((1.0, 0.12, 0.55), (8, 16, 3)))):
    ob = new_light(f'V12 gate wash {k}', 'SPOT', Vector((gp.x + off[0], gp.y + off[1], gp.z + off[2])), 22000, col, size=0.5, coll=GL, spot_deg=70)
    aim(ob, (gp.x, gp.y, gp.z + 7))
# lantern rows flanking the approach
for k in range(12):
    for sx in (-1, 1):
        ob = bpy.data.objects.new(f'V12 gate lantern {k} {sx}', lm)
        ob.location = (gp.x + sx * 9.5, gp.y - 8 - k * 3.2, gp.z + 3.0)
        pb = bmesh.new(); box(pb, (gp.x + sx * 9.5, gp.y - 8 - k * 3.2, gp.z), 0.12, 0.12, 2.6, 0, 0)
        to_obj(f'V12 gate lantern post {k} {sx}', pb, [m_pole], GL)
        ob.scale = (0.9, 0.9, 1.0)
        GL.objects.link(ob)


# ------------------------------------------------------------------------------------------------ 3k dress the bare retaining walls of the sunken approach (ref 06)
from mathutils.bvhtree import BVHTree  # noqa: E402
walls = next(o for o in sc.objects if o.name.startswith('V10 cut walls, grass shoulders'))
bvh = BVHTree.FromObject(walls, bpy.context.evaluated_depsgraph_get())
inside = [i for i in range(M) if cl.P[i, 2] < -1.0]
TUNC = newcoll('V12 | sunken approach wall dressing')
m_amber = glow('V12 wall LED amber', (1.0, 0.62, 0.25), 7.0)
bm_c, bm_a, bm_v = bmesh.new(), bmesh.new(), bmesh.new()
n_wall = 0
for side in (-1, 1):
    prev = {}
    for i in inside:
        for key, hgt in (('c', 1.3), ('a', 4.2), ('a2', 7.4)):
            o_ = Vector(cl.P[i]) + Vector(cl.N[i]) * side * 6.0 + Vector((0, 0, hgt))
            hit = bvh.ray_cast(o_, Vector(cl.N[i]) * side, 45.0)
            if hit[0] is None:
                prev.pop(key, None)
                continue
            pt_ = hit[0] - Vector(cl.N[i]) * side * 0.10
            if key in prev and (pt_ - prev[key]).length < 6.0:
                seg_box(bm_c if key == 'c' else bm_a, prev[key], pt_, 0.14, 0.14)
                n_wall += 1
            prev[key] = pt_
        if i % 6 == 0:                                        # vertical fins
            o_ = Vector(cl.P[i]) + Vector(cl.N[i]) * side * 6.0 + Vector((0, 0, 4.0))
            hit = bvh.ray_cast(o_, Vector(cl.N[i]) * side, 45.0)
            if hit[0] is not None:
                q_ = hit[0] - Vector(cl.N[i]) * side * 0.12
                seg_box(bm_v, q_ - Vector((0, 0, 3.4)), q_ + Vector((0, 0, 3.4)), 0.18, 0.1)
to_obj('V12 wall LED cyan base', bm_c, [m_ledc], TUNC)
to_obj('V12 wall LED amber rails', bm_a, [m_amber], TUNC)
to_obj('V12 wall LED fins', bm_v, [m_ledp], TUNC)
LOG['wall dressing segments'] = n_wall

# ------------------------------------------------------------------------------------------------ 4 sky: night world, skyline band, Fuji card
C.night_world(sc)
for o in sc.objects:
    if o.data and getattr(o.data, 'name', '').startswith('Tokyo_Skyline'):
        hide(o)
cx, cy = float(cl.P[:, 0].mean()), float(cl.P[:, 1].mean())
PANO = C.T / 'textures' / 'panorama'
bmat = bpy.data.materials.new('V12 skyline band night')
bmat.use_nodes = True
bmat.surface_render_method = 'DITHERED'      # dithered, not blended: the sky pixels must not hide the Fuji card behind the band
nt = bmat.node_tree
nt.nodes.clear()
tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(str(PANO / 'tokyo_skyline_night.png'), check_existing=True)
tx.extension = 'EXTEND'
em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 0.9
tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
va = nt.nodes.new('ShaderNodeVertexColor'); va.layer_name = 'Col'
mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
out = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(tx.outputs['Color'], em.inputs['Color'])
nt.links.new(tx.outputs['Alpha'], mul.inputs[0]); nt.links.new(va.outputs['Alpha'], mul.inputs[1])
nt.links.new(mul.outputs[0], mx.inputs['Fac']); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
nt.links.new(mx.outputs[0], out.inputs[0])
bm = bmesh.new()
rows_v = [(-60.0, 0.0, 0.0), (BAND_H * 0.04, 0.04, 1.0), (BAND_H * 0.72, 0.72, 1.0), (BAND_H, 1.0, 0.0)]
grid = []
for (yy, vv, al) in rows_v:
    grid.append([(bm.verts.new((math.sin(2 * math.pi * s_ / 128) * BAND_R, math.cos(2 * math.pi * s_ / 128) * BAND_R, yy)), s_ / 128, vv, al) for s_ in range(129)])
lay = bm.loops.layers.uv.verify()
col_l = bm.loops.layers.float_color.new('Col')
for r_ in range(len(grid) - 1):
    for s_ in range(128):
        qd = [grid[r_][s_], grid[r_][s_ + 1], grid[r_ + 1][s_ + 1], grid[r_ + 1][s_]]
        f = bm.faces.new([qd[0][0], qd[3][0], qd[2][0], qd[1][0]])
        for l, e in zip(f.loops, [qd[0], qd[3], qd[2], qd[1]]):
            l[lay].uv = (1 - e[1], e[2])
            l[col_l] = (1, 1, 1, e[3])
SKY = newcoll('V12 | sky backdrop')
band = to_obj('V12 skyline_band', bm, [bmat], SKY, (cx, cy, 0), smooth=True)
band.visible_shadow = False
fuji = next((o for o in sc.objects if o.name.startswith('Mount Fuji')), None)
if fuji:      # bigger Fuji so the summit clears the skyline band (ref 10: the mountain stands above the city)
    cxm = -850.0
    for v in fuji.data.vertices:
        v.co.x = cxm + (v.co.x - cxm) * 2.3
        v.co.z = -260.0 + (v.co.z + 260.0) * 2.3
LOG['fuji'] = dict(card=bool(fuji), loc=[round(x) for x in fuji.matrix_world.translation] if fuji else None)

# ------------------------------------------------------------------------------------------------ 5 render setup, cameras, final tree LOD pass
C.setup_eevee(sc)
for nm, (loc, tgt, lens) in C.cameras(cl).items():
    cam = bpy.data.objects.new('V12 | ' + nm, bpy.data.cameras.new(nm))
    sc.collection.objects.link(cam)
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam.data.clip_end = 20000
extra = {
    'b_lagoon_aerial': ((-60, -210, 130), (-312, 100, -5), 32),
    'd_street_pagoda_fuji': (cl.at(AV - 18, -4.5 * PSIDE, 1.7), Vector(PPOS) + Vector((0, 0, 22)), 24),
}
wheel = next(o for o in sc.objects if o.name.startswith('Central park wheel plaza'))
wp = wheel.matrix_world.translation
cs_i, _, _ = cl.nearest(wp.x, wp.y)
rr = min([r for r in RUNOFF_RANGES if cl.P[int((r[0] + r[1]) / 2 / 1440 * M), 2] > 0.5], key=lambda r: np.linalg.norm(cl.at(int((r[0] + r[1]) / 2 / 1440 * M))[:2] - np.array([wp.x, wp.y])))
rm_ = int((rr[0] + rr[1]) / 2 / 1440 * M)
extra['c_corner_runoff_wheel'] = (cl.at(rm_ - 14, 3, 14), Vector((wp.x, wp.y, wp.z + 50)), 26)
LOG['corner cam run-off range'] = rr
gate_cam = (Vector((gp.x + 36, gp.y - 52, gp.z + 12)), Vector((gp.x, gp.y, gp.z + 9)), 28)
extra['e_gate'] = gate_cam
for nm, (loc, tgt, lens) in extra.items():
    cam = bpy.data.objects.new('V12 | ' + nm, bpy.data.cameras.new(nm))
    sc.collection.objects.link(cam)
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam.data.clip_end = 20000
cam_pos = [o.location.copy() for o in sc.objects if o.type == 'CAMERA' and (o.name.startswith('V12 |') or o.name in ('V8 | neon avenue toward Fuji', 'V5 | bridge driving view', 'V6 | wheel across park', 'V10 review | driving into submerged tunnel', 'V10 review | vermilion gate'))]
n_full = n_lod = 0
for o in sc.objects:
    if o.name in TREE_MAP:
        hd, ld = TREE_MAP[o.name]
        near = any((o.location - cp).length < 75 for cp in cam_pos)
        o.data = hd if near else ld
        n_full += near
        n_lod += (not near)
LOG['tree LOD by camera distance (75 m)'] = dict(full=n_full, lod1=n_lod)
fl = [0, 0]
for o in sc.objects:       # frontages: hero mesh near the review cameras, 30% LOD copy of the same hero beyond 140 m
    if o.name in FR_MAP:
        near = any((o.location - cp).length < 140 for cp in cam_pos)
        o.data = FR_MAP[o.name] if near else FR_LOD[FR_MAP[o.name]]
        fl[0 if near else 1] += 1
LOG['frontage LOD by camera distance (140 m)'] = dict(full=fl[0], lod1=fl[1])

# ------------------------------------------------------------------------------------------------ 6 clearance after, budget, save
AFTER = CK.run('v12')
LOG['clearance_after'] = {'violators': AFTER['violators'], 'names': [r['name'] for r in AFTER['list']]}


def budget():
    dg = bpy.context.evaluated_depsgraph_get()
    uniq, drawn, objs, shared = {}, 0, 0, {}
    for o in sc.objects:
        if not vis(o) or o.type not in ('MESH', 'FONT', 'CURVE'):
            continue
        key = o.data.name
        if o.type == 'MESH':
            t = tris(o.data)
        else:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            t = tris(me)
            ev.to_mesh_clear()
        uniq[key] = t
        drawn += t
        objs += 1
        shared[key] = shared.get(key, 0) + 1
    return dict(visible_objects=objs, unique_mesh_datablocks=len(uniq), unique_triangles=int(sum(uniq.values())), drawn_triangles=int(drawn),
                shared_datablocks=sum(1 for v in shared.values() if v > 1),
                top_drawn=sorted(((k, uniq[k] * v, v) for k, v in shared.items()), key=lambda x: -x[1])[:15])


LOG['budget'] = budget()
sc['v12_night_day'] = 'night'
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(DST))
(O / 'v12-build.json').write_text(_json.dumps(LOG, indent=1, default=str))
log('saved', DST)
log(_json.dumps(LOG, indent=1, default=str))
