"""Infinia's city, part 2 (exec'd after infinia_city.py): streets lined district by district, then the landmarks and props.
See IDENTITY.md for what each district is."""
# ------------------------------------------------------------------------------------------------ placement: streets are lined, then the blocks behind fill in
PLACED = []        # (x, y, radius)
def free(c4, pad=2.0):
    for p in c4:
        i, d = near(p.x, p.y)
        if d < max(BD[1][i], BD[-1][i]) + pad or not is_land(p.x, p.y) or tun_kd.find((p.x, p.y, 0))[2] < HW + 24: return False
    cx_, cy_ = sum(p.x for p in c4) / 4, sum(p.y for p in c4) / 4; r = max((p - Vector((cx_, cy_, 0))).length for p in c4)
    if any(math.hypot(cx_ - x, cy_ - y) < r + q + 1.0 for x, y, q in PLACED): return False
    PLACED.append((cx_, cy_, r)); return True
def facing(j, sd): nl = NL[j]; return math.atan2(-sd * nl.x, sd * nl.y)      # the building's front (its -d side) toward the road
def line_street(stations, sd, pick, setback=4.0, rows=1):
    """buildings shoulder to shoulder along one side of the road over a run of stations; `pick` gives (builder, w, d, floors, key)"""
    for row in range(rows):
        k = 0
        while k < len(stations):
            b, w, d, fl, key = pick()
            j = stations[min(len(stations) - 1, k + int(w / 2 / STEP))]
            off_ = BD[sd][j] + setback + d / 2 + row * (d + 6)
            c = off(j, sd * off_); c = Vector((c.x, c.y, 0)); yaw = facing(j, sd)
            if free(footprint(c, w, d, yaw)): b(c, w, d, yaw, fl, key)
            k += int((w + rr.uniform(0.3, 1.5)) / STEP) + 1
def fill(poly, pick, tries):
    xmin, ymin = poly.min(0); xmax, ymax = poly.max(0)
    for _ in range(tries):
        x, y = rr.uniform(xmin, xmax), rr.uniform(ymin, ymax)
        if not inside(np.array([x]), np.array([y]), poly)[0]: continue
        b, w, d, fl, key = pick(); yaw = HEAD[near(x, y)[0]]
        c = Vector((x, y, 0))
        if free(footprint(c, w, d, yaw), pad=4.0): b(c, w, d, yaw, fl, key)
CHAWLS = [k for k in KEYS if k.startswith('chawl')]; DECOS = [k for k in KEYS if k.startswith('deco')]
GLASS = [k for k in KEYS if k.startswith('glass')]; HOUSES = [k for k in KEYS if k.startswith('house')]; RES = [k for k in KEYS if k.startswith('res')]
def old_pick():
    if rr.random() < 0.5: return (chawl, rr.uniform(16, 32), rr.uniform(10, 13), rr.randint(3, 5), rr.choice(CHAWLS))
    return (shops, rr.uniform(12, 22), rr.uniform(10, 14), rr.randint(2, 4), rr.choice(CHAWLS))
def deco_pick(): return (deco, rr.uniform(18, 30), rr.uniform(14, 20), rr.randint(4, 7), rr.choice(DECOS))
def tower_pick(): return (lambda c, w, d, yaw, fl, key: tower(c, w, d, yaw, fl, key), rr.uniform(24, 36), rr.uniform(24, 34), rr.uniform(70, 190), rr.choice(GLASS + RES + RES))     # mostly residential concrete, some glass
def house_pick(): return (house, rr.uniform(6, 9), rr.uniform(6, 8), rr.randint(1, 3), rr.choice(HOUSES))
n_e = len(EAST); OLD, TOW = EAST[int(n_e * 0.06):int(n_e * 0.55)], EAST[int(n_e * 0.55):int(n_e * 0.95)]
KOLI = EAST[:int(n_e * 0.12)]
NECKS = sorted(NECK)
placed_temple = False
for tj in sorted(OLD, key=lambda i: R[i])[::7]:          # the tightest corner that has room, on its inside or its outside
    for tsd in ((1, -1) if K[tj] > 0 else (-1, 1)):
        tc = off(tj, tsd * (BD[tsd][tj] + 20)); tc = Vector((tc.x, tc.y, 0)); tyaw = facing(tj, tsd)
        if free(footprint(tc, 26, 34, tyaw), pad=1.0): placed_temple = True; break
    if placed_temple: break
if placed_temple:
    out = Vector((math.sin(tyaw), -math.cos(tyaw), 0)); side = Vector((math.cos(tyaw), math.sin(tyaw), 0))
    pbox(tc + Vector((0, 0, 0.8)), (26, 34, 1.6), yaw=tyaw, k='stone', col=(0.85, 0.78, 0.68))       # the plinth
    hall = tc + out * 7
    pbox(hall + Vector((0, 0, 5.2)), (14, 12, 7.2), yaw=tyaw, k='stone', col=(0.9, 0.82, 0.7))       # the mandapa, a stepped roof
    for q in range(6): pbox(hall + Vector((0, 0, 9.4 + q * 1.1)), (14 - q * 2.2, 12 - q * 2.0, 1.1), yaw=tyaw, k='stone', col=(0.88, 0.8, 0.68))
    sk = tc - out * 6; tiers = 14
    for q in range(tiers):              # the shikhara: a curving stack of tiers with ribs, an amalaka disc and a kalash
        t = q / tiers; wq = 12 * (1 - t ** 1.6) + 1.5; z = 1.6 + q * 2.4
        pbox(sk + Vector((0, 0, z + 1.2)), (wq, wq, 2.4), yaw=tyaw, k='stone', col=(0.86 - 0.01 * q, 0.76 - 0.01 * q, 0.6))
        for sx in (-1, 1):
            pbox(sk + Vector((0, 0, z + 1.2)) + side * sx * (wq / 2 + 0.3), (0.6, wq * 0.5, 2.0), yaw=tyaw, k='stone', col=(0.8, 0.7, 0.55))
            pbox(sk + Vector((0, 0, z + 1.2)) + out * sx * (wq / 2 + 0.3), (wq * 0.5, 0.6, 2.0), yaw=tyaw, k='stone', col=(0.8, 0.7, 0.55))
    zt = 1.6 + tiers * 2.4; cyl(PB, sk + Vector((0, 0, zt)), 2.6, 2.6, 0.9, n=16, mi=pmi('stone'), cap=True)
    cyl(PB, sk + Vector((0, 0, zt + 0.9)), 0.9, 0.2, 2.2, n=10, mi=pmi('saffron'), cap=True)
    pbox(sk + Vector((0, 0, zt + 4.5)) + side * 0.9, (0.08, 0.08, 6.0), k='rail')
    f0 = sk + side * 0.95 + Vector((0, 0, zt))
    pquad([f0 + Vector((0, 0, 7.2)), f0 + side * 2.0 + Vector((0, 0, 6.6)), f0 + side * 2.0 + Vector((0, 0, 5.6)), f0 + Vector((0, 0, 6.0))], 'saffron')   # the flag
    log('temple at station', tj)

line_street(OLD, 1, old_pick, 3.0, rows=3); line_street(OLD, -1, old_pick, 3.0, rows=3)
line_street(KOLI, 1, house_pick, 6.0, rows=3)
line_street(TOW, -1, tower_pick, 14.0)
line_street(NECKS, 1, deco_pick, 4.0, rows=3)
fill(PE, lambda: old_pick() if rr.random() < 0.75 else tower_pick(), 9000)
fill(PW, lambda: deco_pick() if rr.random() < 0.5 else old_pick(), 9000)
log('buildings', len(PLACED))

# ------------------------------------------------------------------------------------------------ the necklace: promenade, sea wall, tetrapods (the sea side of the arc)
for j in NECKS:
    a, b = j, (j + 1) % N
    if (b - a) != 1: continue
    p0, p1 = BD[-1][a] + 0.6, 30.0
    pquad([Vector((q.x, q.y, 0.3)) for q in (off(a, -p0), off(a, -p1), off(b, -p1), off(b, -p0))], 'paving', col=(0.9, 0.88, 0.84))       # promenade
    q0, q1 = off(a, -p1), off(b, -p1)
    pquad([Vector((q0.x, q0.y, 0.3)), Vector((q1.x, q1.y, 0.3)), Vector((q1.x, q1.y, 1.1)), Vector((q0.x, q0.y, 1.1))], 'stone', col=(0.9, 0.88, 0.84))   # sea wall
def tetrapod(c, s, rot):
    for ax in (Vector((0, 0, 1)), Vector((0.943, 0, -0.333)), Vector((-0.471, 0.816, -0.333)), Vector((-0.471, -0.816, -0.333))):
        a2 = rot @ ax; q_ = a2.to_track_quat('Z', 'Y')
        n0 = len(PB.faces); cyl(PB, Vector((0, 0, 0)), 0.55 * s, 0.25 * s, 1.6 * s, n=6, mi=pmi('tetra'), cap=True)
        new = list(PB.faces)[n0:]
        for v in {v for f in new for v in f.verts}: v.co = c + q_ @ v.co      # the leg along a2
        for f in new:
            for l in f.loops: t = rr.uniform(0.75, 0.95); l[PVC] = (t, t, t * 0.97, 1)
for j in NECKS[::2]:
    for _ in range(2):
        d = rr.uniform(31.5, 40.0); p = off(j, -d) + T[j].to_3d() * rr.uniform(-1.5, 1.5)
        tetrapod(Vector((p.x, p.y, rr.uniform(-1.6, 0.2))), rr.uniform(0.9, 1.15), Matrix.Rotation(rr.uniform(0, 6.28), 3, Vector((rr.random(), rr.random(), rr.random() + 0.1)).normalized()))

# ------------------------------------------------------------------------------------------------ overhead wires in the old city: poles both sides, wires along the street and across it, 8 m up
prev = {}
for k, j in enumerate(OLD[::12]):
    for sd in (1, -1):
        base_ = off(j, sd * (BD[sd][j] + 1.5)); base_ = Vector((base_.x, base_.y, 0))
        cyl(PB, base_, 0.13, 0.1, 9.0, n=6, mi=pmi('concrete'), cap=False)
        pbox(base_ + Vector((0, 0, 8.6)), (0.1, 1.6, 0.1), yaw=HEAD[j], k='rail')
        top = base_ + Vector((0, 0, 8.6))
        if sd in prev and (prev[sd] - top).length < 60:
            for dz in (0.0, -0.4):          # along the street, with sag
                a, b = prev[sd] + Vector((0, 0, dz)), top + Vector((0, 0, dz)); m = (a + b) / 2 - Vector((0, 0, 0.9))
                leg(PB, a, m, 0.05, pmi('wire')); leg(PB, m, b, 0.05, pmi('wire'))
        prev[sd] = top
    a, b = off(j, BD[1][j] + 1.5), off(j, -(BD[-1][j] + 1.5))
    a, b = Vector((a.x, a.y, 8.3)), Vector((b.x, b.y, 8.3)); m = (a + b) / 2 - Vector((0, 0, 1.2))
    if k % 2 == 0: leg(PB, a, m, 0.05, pmi('wire')); leg(PB, m, b, 0.05, pmi('wire'))

# ------------------------------------------------------------------------------------------------ the temple: a shikhara at the old city's tightest corner
# ------------------------------------------------------------------------------------------------ the dargah on its islet, a causeway to the necklace
dj = NECKS[len(NECKS) // 2]; base_ = off(dj, -(BD[-1][dj] + 30)); dc_ = off(dj, -260); dc_ = Vector((dc_.x, dc_.y, 0))
isl = bmesh.new(); r_isl = 34
ring_ = [isl.verts.new(dc_ + Vector((r_isl * (1 + 0.12 * noise.noise(Vector((k, 0.3, 0.1)))) * math.cos(2 * math.pi * k / 24),
                                     r_isl * (1 + 0.12 * noise.noise(Vector((k, 0.7, 0.2)))) * math.sin(2 * math.pi * k / 24), 0.6))) for k in range(24)]
low = [isl.verts.new(dc_ + (v.co - dc_) * 1.25 - Vector((0, 0, 6.6))) for v in ring_]
isl.faces.new(ring_)
for k in range(24): isl.faces.new([ring_[k], low[k], low[(k + 1) % 24], ring_[(k + 1) % 24]])
mesh_obj('IF islet', isl, ['paving'])
cw = Vector((dc_.x - base_.x, dc_.y - base_.y, 0)); cwl = cw.length; cwn = Vector((-cw.y, cw.x, 0)).normalized() * 2.0
b0 = Vector((base_.x, base_.y, 0.5)); b1 = dc_ - cw.normalized() * r_isl + Vector((0, 0, 0.5))
pquad([b0 - cwn, b1 - cwn, b1 + cwn, b0 + cwn], 'slab', col=(0.7, 0.66, 0.6))
for t in range(0, int(cwl), 12): p = b0.lerp(b1, min(1.0, t / cwl)); pbox(p - Vector((0, 0, 2.5)), (3.6, 1.0, 5.0), yaw=math.atan2(cw.y, cw.x) + math.pi / 2, col=(0.6, 0.58, 0.55))
dy = math.atan2(cw.y, cw.x)
pbox(dc_ + Vector((0, 0, 4.6)), (16, 16, 8), yaw=dy, k='white')
for sx in (-1, 1):
    for sy in (-1, 1):
        p = dc_ + Vector((math.cos(dy) * sx * 9 - math.sin(dy) * sy * 9, math.sin(dy) * sx * 9 + math.cos(dy) * sy * 9, 0))
        cyl(PB, p + Vector((0, 0, 0.6)), 0.9, 0.7, 22, n=10, mi=pmi('white'), cap=True)
        bs = bmesh.ops.create_uvsphere(PB, u_segments=10, v_segments=6, radius=1.1)
        for v in bs['verts']: v.co = Vector((v.co.x, v.co.y, v.co.z * 1.4)) + p + Vector((0, 0, 23.4))
        for f in {f for v in bs['verts'] for f in v.link_faces}: f.material_index = pmi('white')
dm_ = bmesh.ops.create_uvsphere(PB, u_segments=20, v_segments=12, radius=6.0)
for v in dm_['verts']:
    z = v.co.z; k_ = 1 + 0.15 * max(0.0, -z) / 6; v.co = Vector((v.co.x * k_, v.co.y * k_, max(z, -2.0) * 1.35)) + dc_ + Vector((0, 0, 11.2))
for f in {f for v in dm_['verts'] for f in v.link_faces}: f.material_index = pmi('white')
pbox(dc_ + Vector((0, 0, 20.5)), (0.25, 0.25, 3.0), k='rail')

# ------------------------------------------------------------------------------------------------ the toll plaza: a canopy over the road before the start, booths beside it
pj = (N - 150) % N; pc = off(pj, 0); yaw_r = HEAD[pj]
fwd = Vector((math.cos(yaw_r), math.sin(yaw_r), 0)); lat = NL[pj]
pbox(Vector((pc.x, pc.y, pc.z + 8.2)) + lat * 4, (14, 64, 1.0), yaw=yaw_r, k='canopy')
pbox(Vector((pc.x, pc.y, pc.z + 7.6)) + lat * 4, (13.5, 63, 0.15), yaw=yaw_r, k='glow')
for sx in (-1, 1):
    for q in (-3, -2, -1, 1, 2, 3):
        sdq = 1 if q > 0 else -1; col_l = BD[sdq][pj] + 1.5 + (abs(q) - 1) * 9.0
        p = Vector((pc.x, pc.y, pc.z)) + lat * (sdq * col_l) + fwd * sx * 5
        if sdq * col_l + 4 > 36 or sdq * col_l + 4 < -28: continue
        cyl(PB, p, 0.4, 0.4, 8.0, n=8, mi=pmi('canopy'), cap=False)
        if sx == 1: pbox(p - fwd * 5 + Vector((0, 0, 1.5)), (2.2, 1.8, 3.0), yaw=yaw_r, k='white')
log('toll plaza at station', pj)

# ------------------------------------------------------------------------------------------------ boats: on the koliwada shore and out in the bay near the bridge
def boat(c, yaw, col):
    L, W, Hh = rr.uniform(9, 13), 2.6, 1.3; Mx = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, 'Z')
    prof = [(-L / 2, 0), (-L / 2 + 1.5, W / 2), (L / 2 - 2.5, W / 2), (L / 2, 0)]
    top = [Mx @ Vector((x, y, Hh)) for x, y in prof] + [Mx @ Vector((x, -y, Hh)) for x, y in reversed(prof[1:-1])]
    bot = [Mx @ Vector((x * 0.85, y * 0.5, 0.1)) for x, y in prof] + [Mx @ Vector((x * 0.85, -y * 0.5, 0.1)) for x, y in reversed(prof[1:-1])]
    for k in range(len(top)): pquad([bot[k], bot[(k + 1) % len(top)], top[(k + 1) % len(top)], top[k]], 'hull', col=col)
    pquad(bot, 'hull', col=(0.25, 0.15, 0.1))
    pbox(Mx @ Vector((0.5, 0, Hh + 2.5)), (0.12, 0.12, 5.0), k='rail')
    pquad([Mx @ Vector((0.5, 0, Hh + 5.0)), Mx @ Vector((2.0, 0, Hh + 4.7)), Mx @ Vector((2.0, 0, Hh + 4.0)), Mx @ Vector((0.5, 0, Hh + 4.2))], 'saffron')
for j in KOLI[::6]:
    p = off(j, rr.uniform(36, 44)); boat(Vector((p.x, p.y, rr.uniform(-0.3, 0.2))), HEAD[j] + math.pi / 2 + rr.uniform(-0.4, 0.4),
                                         rr.choice([(0.1, 0.4, 0.8), (0.85, 0.2, 0.15), (0.95, 0.75, 0.1), (0.15, 0.6, 0.35)]))
for _ in range(14):
    j = rr.randrange(BR0 + 60, BR1 - 60); p = off(j, rr.choice((-1, 1)) * rr.uniform(40, 160))
    if not is_land(p.x, p.y) and tun_kd.find((p.x, p.y, 0))[2] > 30: boat(Vector((p.x, p.y, -4.3)), rr.uniform(0, 6.28), rr.choice([(0.1, 0.4, 0.8), (0.85, 0.2, 0.15), (0.95, 0.75, 0.1)]))

# ------------------------------------------------------------------------------------------------ the metro viaduct along the towers' arc, a tower going up with a crane
for j in TOW[::12]:
    p = off(j, -(BD[-1][j] + 9)); p = Vector((p.x, p.y, 0))
    if not is_land(p.x, p.y): continue
    cyl(PB, p, 1.1, 1.1, 11.5, n=8, mi=pmi('concrete'), cap=False)
    pbox(p + Vector((0, 0, 12.4)), (STEP * 12 + 0.5, 9.0, 1.8), yaw=HEAD[j], k='concrete')
    for sx in (-1, 1): pbox(p + Vector((0, 0, 13.8)) + NL[j] * sx * 4.2, (STEP * 12 + 0.5, 0.3, 1.0), yaw=HEAD[j], k='slab')
cj = TOW[len(TOW) // 2]; cp = off(cj, -(BD[-1][cj] + 60)); cp = Vector((cp.x, cp.y, 0))
if is_land(cp.x, cp.y) and free(footprint(cp, 30, 30, 0.0)):
    for f in range(18): pbox(cp + Vector((0, 0, f * 3.6 + 1.8)), (26, 26, 0.4), k='concrete')        # bare floors
    for sx in (-1, 1):
        for sy in (-1, 1): pbox(cp + Vector((sx * 12, sy * 12, 33)), (0.8, 0.8, 66), k='concrete')
    pbox(cp + Vector((18, 0, 45)), (1.8, 1.8, 90), k='saffron')                                        # the crane: mast, jib, cab, counterweight
    pbox(cp + Vector((32, 0, 89)), (60, 1.4, 1.4), k='saffron'); pbox(cp + Vector((18, 0, 92)), (2, 2, 4), k='saffron')
    pbox(cp + Vector((4, 0, 88.5)), (6, 3, 2.5), k='concrete')

# ------------------------------------------------------------------------------------------------ street life: people on the pavements and the promenade,
# a row seated on the sea wall, pole hoardings in the towers district
for j in OLD[::7]:
    for sd in (1, -1):
        if rr.random() < 0.6:
            for _ in range(rr.randint(1, 4)):
                p = off(j, sd * (BD[sd][j] + rr.uniform(0.6, 2.4))) + T[j].to_3d() * rr.uniform(-3, 3); person(Vector((p.x, p.y, max(0.0, CL[j].z) + 0.02)), facing(j, sd) + rr.uniform(-0.5, 0.5))
for j in NECKS[::6]:
    if rr.random() < 0.7:
        p = off(j, -(BD[-1][j] + rr.uniform(3, 26))); person(Vector((p.x, p.y, 0.32)), facing(j, -1) + rr.uniform(-0.8, 0.8))
for j in NECKS[::3]:          # seated along the sea wall, looking out to sea (their backs to the road)
    if rr.random() < 0.55:
        p = off(j, -30.2); person(Vector((p.x, p.y, 1.1)), facing(j, -1) + math.pi, seated=True)
for k, j in enumerate(TOW[::40]):
    p = off(j, BD[1][j] + 7); yaw_h = facing(j, 1) + 0.6
    if is_land(p.x, p.y) and tun_kd.find((p.x, p.y, 0))[2] > 30: hoarding(Vector((p.x, p.y, 0)), 7.0, 12.0, 4.5, yaw_h)
for j in sorted(range(N - 300, N - 160, 70)):           # the start's approach: two big hoardings
    p = off(j % N, -(BD[-1][j % N] + 9)); hoarding(Vector((p.x, p.y, 0)), 6.0, 14.0, 5.2, facing(j % N, -1) + 0.5)

# ------------------------------------------------------------------------------------------------ downloaded models (CREDITS.md): coconut palms, kaali-peeli taxis
def load_model(path, height=None, length=None, decimate=None):
    """the glTF's meshes baked to one bmesh in metres, standing on z = 0 and centred; its materials in slot order"""
    bpy.ops.import_scene.gltf(filepath=str(path)); objs = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if decimate:
        for o in objs: dm = o.modifiers.new('dec', 'DECIMATE'); dm.ratio = decimate
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); out = bmesh.new(); mats = []
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); b = bmesh.new(); b.from_mesh(me); b.transform(o.matrix_world)
        for f in b.faces:
            m = o.data.materials[f.material_index] if o.data.materials else None
            if m not in mats: mats.append(m)
            f.material_index = mats.index(m)
        b.to_mesh(me); b.free(); out.from_mesh(me); bpy.data.meshes.remove(me)
    for o in objs: bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY': bpy.data.objects.remove(o, do_unlink=True)
    ps = [v.co for v in out.verts]; lo = Vector([min(q[d] for q in ps) for d in range(3)]); hi = Vector([max(q[d] for q in ps) for d in range(3)])
    k = height / (hi.z - lo.z) if height else length / max(hi.x - lo.x, hi.y - lo.y)
    if length and hi.y - lo.y > hi.x - lo.x: bmesh.ops.rotate(out, verts=out.verts, cent=Vector(), matrix=Matrix.Rotation(math.pi / 2, 3, 'Z'))     # long axis on x
    ps = [v.co for v in out.verts]; lo = Vector([min(q[d] for q in ps) for d in range(3)]); hi = Vector([max(q[d] for q in ps) for d in range(3)])
    for v in out.verts: v.co = (v.co - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))) * k
    return out, mats
def scatter(name, model, spots, prefix):
    """copies of `model` at (position, yaw, scale) merged into one mesh, its materials kept and renamed"""
    b0, mats = model; acc = bmesh.new()
    for pos, yaw, sc_ in spots:
        b = b0.copy(); b.transform(Matrix.Translation(pos) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Scale(sc_, 4))
        me = bpy.data.meshes.new('tmp'); b.to_mesh(me); b.free(); acc.from_mesh(me); bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name); acc.to_mesh(me); acc.free()
    for m in mats:
        if m and not m.name.startswith(prefix): m.name = f'{prefix}{m.name}'
        me.materials.append(m)
    VIS.objects.link(bpy.data.objects.new(name, me)); return len(spots)
SRCM = H / 'source'
palm = load_model(SRCM / 'palm_lowpoly' / 'palm_lowpoly.glb', height=12.0)
spots = []
for j in NECKS[::8]:                                       # the Necklace: a palm every 20 m on the promenade
    p = off(j, -(BD[-1][j] + 13)); spots.append((Vector((p.x, p.y, 0.3)), rr.uniform(0, 6.28), rr.uniform(0.85, 1.2)))
for j in TOW[::14]:                                        # the towers' kerb
    p = off(j, BD[1][j] + 4.5)
    if is_land(p.x, p.y) and tun_kd.find((p.x, p.y, 0))[2] > 30: spots.append((Vector((p.x, p.y, 0)), rr.uniform(0, 6.28), rr.uniform(0.85, 1.15)))
for j in KOLI[::5]:                                        # the koliwada shore
    p = off(j, rr.uniform(26, 40))
    if is_land(p.x, p.y): spots.append((Vector((p.x, p.y, 0)), rr.uniform(0, 6.28), rr.uniform(0.8, 1.3)))
for k in range(6):                                         # the dargah's islet
    a = k * 1.05; spots.append((dc_ + Vector((math.cos(a) * 24, math.sin(a) * 24, 0.6)), rr.uniform(0, 6.28), rr.uniform(0.8, 1.1)))
log('palms', scatter('IF palms', palm, spots, 'IF palm '))
hero = load_model(SRCM / 'palm_hero' / 'palm_hero.glb', height=15.0)
hs = []
for j in list(range(N - 120, N, 20)) + NECKS[len(NECKS) // 3::40][:6]:      # the start and the Necklace's middle: the big palms
    for sd in (1, -1):
        p = off(j % N, sd * (BD[sd][j % N] + 9)); z = 0.3 if j in NECK else 0.0
        if is_land(p.x, p.y): hs.append((Vector((p.x, p.y, z)), rr.uniform(0, 6.28), rr.uniform(0.9, 1.15)))
log('hero palms', scatter('IF hero palms', hero, hs, 'IF palm hero '))
taxi = load_model(SRCM / 'taxi' / 'taxi.glb', length=3.75, decimate=0.012)
ts = []
for j in OLD[::16]:                                        # parked at the kerb behind the walls, nose either way
    for sd in (1, -1):
        if rr.random() < 0.55:
            p = off(j, sd * (BD[sd][j] + 1.3)); ts.append((Vector((p.x, p.y, max(0.0, CL[j].z))), HEAD[j] + (math.pi if rr.random() < 0.5 else 0), 1.0))
log('taxis', scatter('IF taxis', taxi, ts, 'IF taxi '))

# ------------------------------------------------------------------------------------------------ the far shores: city across the open water, north and south
# (no collision; land 2 m up so the sea under it stays 6 m away for the depth buffer at 2 km)
fs = bmesh.new(); nfar = 0
for sgn, yb in ((1, Y1 + 260), (-1, Y0 - 260)):
    xs_ = [X0 - 900 + k * 40 for k in range(int((X1 - X0 + 1800) / 40) + 1)]
    edge = [yb + sgn * 60 * fbm(x / 700, 2.0 + sgn, 3) for x in xs_]; back = yb + sgn * 900
    for k in range(len(xs_) - 1):
        q = [Vector((xs_[k], edge[k], 2.0)), Vector((xs_[k + 1], edge[k + 1], 2.0)), Vector((xs_[k + 1], back, 2.0)), Vector((xs_[k], back, 2.0))]
        fs.faces.new([fs.verts.new(v) for v in (q if sgn < 0 else q[::-1])])
        fs.faces.new([fs.verts.new(v) for v in ((q[0], q[1], q[1] - Vector((0, 0, 9)), q[0] - Vector((0, 0, 9))) if sgn > 0 else (q[1], q[0], q[0] - Vector((0, 0, 9)), q[1] - Vector((0, 0, 9))))])
    for _ in range(700):
        x = rr.uniform(X0 - 850, X1 + 850); y = yb + sgn * rr.uniform(70, 880)
        tall = rr.random() < 0.3; w, d = (rr.uniform(26, 40), rr.uniform(24, 36)) if tall else (rr.uniform(14, 30), rr.uniform(12, 22))
        h = rr.uniform(60, 210) if tall else rr.uniform(10, 28)
        c4 = footprint(Vector((x, y, 0.0)), w, d, rr.choice((0.0, 0.0, math.pi / 2, rr.uniform(0, 3.14))))
        if any(math.hypot(x - px, y - py) < max(w, d) * 0.7 + q for px, py, q in PLACED): continue
        PLACED.append((x, y, max(w, d) * 0.7)); key = rr.choice(RES + RES + GLASS) if tall else rr.choice(CHAWLS + DECOS + RES)
        for k in range(4): facade(c4[k] + Vector((0, 0, 0)), c4[(k + 1) % 4], h + 2.0, key, z0=2.0)
        pquad([p + Vector((0, 0, h + 2.0)) for p in c4], 'slab', col=(0.5, 0.49, 0.47)); nfar += 1
mesh_obj('IF far shores', fs, ['paving'], planar=True)
log('far shores: buildings', nfar)

# ------------------------------------------------------------------------------------------------ out
mesh_obj('IF buildings', FB, [f'f_{k}' for k in KEYS], planar=False)
mesh_obj('IF window glow night', GB, [f'g_{k}' for k in KEYS], planar=False)
PB.normal_update()
for f in PB.faces:
    if PROPK[f.material_index] in ('signs', 'shutter', 'hoard', 'people'): continue
    sz = UVS.get(PROPK[f.material_index], 3.0); n_ = f.normal
    for l in f.loops:
        c = l.vert.co; l[PUV].uv = (c.x / sz, c.y / sz) if abs(n_.z) > 0.6 else ((c.y if abs(n_.x) > abs(n_.y) else c.x) / sz, c.z / sz)
mesh_obj('IF city props', PB, PROPK, planar=False)
log('city: buildings', len(PLACED))
