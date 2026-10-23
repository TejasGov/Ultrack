# Second half of art_v13.py (exec'd in its namespace): sky, bridge, tunnel, anchors, lagoon village, run-off, crowd, cameras, save.
import json as _json

TEX = C.T / 'textures'

# =============================================================================================== 2. panorama: low, distant, 4x mirrored ring
SKY = newcoll('V13 | sky backdrop')
for o in sc.objects:
    if o.name == 'V12 skyline_band':
        hide(o)
R_NEW, REPEATS = 7000.0, 6
H_NEW = 2 * math.pi * R_NEW / (9.6 * REPEATS)
TOP_FRAC, TYP_FRAC = 0.970, 0.758                         # tallest tip / typical peak as a fraction of the image height (measured on the PNG alpha)
EYE = 1.2
ang_new = math.degrees(math.atan2(TOP_FRAC * H_NEW - 40 - EYE, R_NEW))
ang_old = math.degrees(math.atan2(TOP_FRAC * (2 * math.pi * 2800 / 9.6) - EYE, 2800))
ang_old_typ = math.degrees(math.atan2(TYP_FRAC * (2 * math.pi * 2800 / 9.6) - EYE, 2800))
ang_new_typ = math.degrees(math.atan2(TYP_FRAC * H_NEW - 40 - EYE, R_NEW))
ang_old_band = math.degrees(math.atan2(2 * math.pi * 2800 / 9.6, 2800))
LOG['panorama'] = dict(old=dict(radius=2800, height_m=round(2 * math.pi * 2800 / 9.6), tallest_tip_deg=round(ang_old, 1), typical_peak_deg=round(ang_old_typ, 1), band_top_deg=round(ang_old_band, 1), repeats=1),
                       new=dict(radius=R_NEW, height_m=round(H_NEW), tallest_tip_deg=round(ang_new, 1), typical_peak_deg=round(ang_new_typ, 1), repeats=REPEATS, mirrored=True, base_z=-40),
                       tallest_fraction=TOP_FRAC, typical_fraction=TYP_FRAC)
bm_ = bpy.data.materials.new('V13 skyline band night')
bm_.use_nodes = True
bm_.surface_render_method = 'DITHERED'
nt = bm_.node_tree
nt.nodes.clear()
tx = nt.nodes.new('ShaderNodeTexImage')
tx.image = bpy.data.images.load(str(TEX / 'panorama' / 'tokyo_skyline_night.png'), check_existing=True)
tx.extension = 'EXTEND'
uvn = nt.nodes.new('ShaderNodeTexCoord')
sp = nt.nodes.new('ShaderNodeSeparateXYZ')
mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.0; mr.inputs['From Max'].default_value = 0.55
bw = nt.nodes.new('ShaderNodeRGBToBW')
inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
dsat = nt.nodes.new('ShaderNodeMath'); dsat.operation = 'MULTIPLY'; dsat.inputs[1].default_value = 0.7
mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'
tint = nt.nodes.new('ShaderNodeMix'); tint.data_type = 'RGBA'; tint.inputs[7].default_value = (0.03, 0.035, 0.08, 1)
dark = nt.nodes.new('ShaderNodeMath'); dark.operation = 'MULTIPLY'; dark.inputs[1].default_value = 0.6
em = nt.nodes.new('ShaderNodeEmission')
trn = nt.nodes.new('ShaderNodeBsdfTransparent')
mxs = nt.nodes.new('ShaderNodeMixShader')
va = nt.nodes.new('ShaderNodeVertexColor'); va.layer_name = 'Col'
mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
estr = nt.nodes.new('ShaderNodeMath'); estr.operation = 'MULTIPLY_ADD'; estr.inputs[1].default_value = 0.5; estr.inputs[2].default_value = 0.5
out = nt.nodes.new('ShaderNodeOutputMaterial')
L = nt.links.new
L(uvn.outputs['UV'], sp.inputs[0]); L(sp.outputs['Y'], mr.inputs['Value'])
L(tx.outputs['Color'], bw.inputs['Color'])
L(mr.outputs['Result'], inv.inputs[1]); L(inv.outputs[0], dsat.inputs[0])
L(dsat.outputs[0], mixc.inputs[0]); L(tx.outputs['Color'], mixc.inputs[6]); L(bw.outputs[0], mixc.inputs[7])      # desaturate toward the base
L(inv.outputs[0], dark.inputs[0]); L(dark.outputs[0], tint.inputs[0]); L(mixc.outputs[2], tint.inputs[6])            # haze tint toward the base
L(tint.outputs[2], em.inputs['Color'])
L(mr.outputs['Result'], estr.inputs[0]); L(estr.outputs[0], em.inputs['Strength'])
L(tx.outputs['Alpha'], mul.inputs[0]); L(va.outputs['Alpha'], mul.inputs[1])
L(mul.outputs[0], mxs.inputs['Fac']); L(trn.outputs[0], mxs.inputs[1]); L(em.outputs[0], mxs.inputs[2]); L(mxs.outputs[0], out.inputs[0])
SEG = 64 * REPEATS
bm = bmesh.new()
rows_v = [(-40.0, 0.0, 0.0), (H_NEW * 0.03, 0.03, 1.0), (H_NEW * 0.80, 0.80, 1.0), (H_NEW, 1.0, 0.0)]    # foot below the terrain line, top fades into the sky
grid = [[bm.verts.new((math.sin(2 * math.pi * s_ / SEG) * R_NEW, math.cos(2 * math.pi * s_ / SEG) * R_NEW, yy)) for s_ in range(SEG + 1)] for (yy, vv, al) in rows_v]
lay = bm.loops.layers.uv.verify()
col_l = bm.loops.layers.float_color.new('Col')
for r_ in range(len(grid) - 1):
    for s_ in range(SEG):
        rep = s_ // 64
        t0, t1 = (s_ - 64 * rep) / 64, (s_ + 1 - 64 * rep) / 64
        u0, u1 = ((1 - t0), (1 - t1)) if rep % 2 == 0 else (t0, t1)       # mirrored repeats: continuous at every joint, including the ring closure
        f = bm.faces.new([grid[r_][s_], grid[r_ + 1][s_], grid[r_ + 1][s_ + 1], grid[r_][s_ + 1]])
        for l, (uu, vv, al) in zip(f.loops, [(u0, rows_v[r_][1], rows_v[r_][2]), (u0, rows_v[r_ + 1][1], rows_v[r_ + 1][2]),
                                              (u1, rows_v[r_ + 1][1], rows_v[r_ + 1][2]), (u1, rows_v[r_][1], rows_v[r_][2])]):
            l[lay].uv = (uu, vv)
            l[col_l] = (1, 1, 1, al)
cx, cy = float(cl.P[:, 0].mean()), float(cl.P[:, 1].mean())
band = to_obj('V13 skyline_band', bm, [bm_], SKY, (cx, cy, 0), smooth=True)
band.visible_shadow = False
# far ground: the grass plane ends well inside the band, so a dark disc carries the land out to the ring (no bright gap)
bm = bmesh.new()
ctr_v = bm.verts.new((0, 0, 0))
ring_v = [bm.verts.new((math.cos(2 * math.pi * k / 96) * 9500, math.sin(2 * math.pi * k / 96) * 9500, 0)) for k in range(96)]
for k in range(96):
    bm.faces.new([ctr_v, ring_v[k], ring_v[(k + 1) % 96]])
far = to_obj('V13 far ground disc', bm, [mat('V13 far land', (0.012, 0.014, 0.026), 1.0)], SKY, (cx, cy, -0.9))
far.visible_shadow = False
# Fuji: the v7 card scaled so its summit stands ~10 degrees up (behind the 6 degree skyline), 0.65 of the original size
fuji = next((o for o in sc.objects if o.name.startswith('Mount Fuji')), None)
if fuji:
    kf = 0.65 / 2.3 * (7700.0 / 6500.0)         # 0.65 of the v7 size, pushed back behind the ring (y 6500 -> 7700) at the same angular size
    for v in fuji.data.vertices:
        v.co.x = -850.0 + (v.co.x + 850.0) * kf
        v.co.z = -260.0 + (v.co.z + 260.0) * kf
        v.co.y = 7700.0
LOG['fuji'] = 'card at 7.7 km, summit about 10 degrees up, behind the ring'

# =============================================================================================== 3. bridge lane check + softer searchlights
susp = bpy.data.objects['Suspension system, hanger clamps and warm rail edges']
br_lo, br_hi = V.bbox([susp])
BR_ST = [i for i in range(M) if cl.P[i, 2] > 8 and br_lo[0] - 20 < cl.P[i, 0] < br_hi[0] + 20 and br_lo[1] - 20 < cl.P[i, 1] < br_hi[1] + 20]
LOG['bridge stations checked'] = len(BR_ST)
bp_pts = np.array([cl.P[i] for i in BR_ST])
bp_kd = None
from mathutils.kdtree import KDTree  # noqa: E402
bp_kd = KDTree(len(BR_ST))
for k, i in enumerate(BR_ST):
    bp_kd.insert((cl.P[i, 0], cl.P[i, 1], 0), k)
bp_kd.balance()
SKIP_LANE = ('Continuous', 'Kerb', 'V9 barrier', 'V12 painted', 'V12 bridge entry', 'asphalt', 'Dashed', 'V12 fence', 'V12 searchlight', 'skyline', 'V13 skyline',
             'water', 'V12 wall', 'Localized red-lit bridge haze', 'V12 grid')


def bridge_lane_offenders(fix=False):
    found = {}
    for o in sc.objects:
        if o.type != 'MESH' or not vis(o) or any(k in o.name for k in SKIP_LANE):
            continue
        bb = np.array([list(o.matrix_world @ Vector(v)) for v in o.bound_box])
        if bb[:, 0].max() < br_lo[0] - 30 or bb[:, 0].min() > br_hi[0] + 30 or bb[:, 1].max() < br_lo[1] - 30 or bb[:, 1].min() > br_hi[1] + 30:
            continue
        me = o.data
        n = len(me.vertices)
        co = np.empty(n * 3)
        me.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        Mx = np.array(o.matrix_world)
        w = co @ Mx[:3, :3].T + Mx[:3, 3]
        bad = []
        for k in range(n):
            x, y, z = w[k]
            if z < 4:
                continue
            _p, ki, dd = bp_kd.find((x, y, 0))
            if dd < 9.0 and cl.P[BR_ST[ki], 2] + 0.35 < z < cl.P[BR_ST[ki], 2] + 6.0:
                bad.append(k)
        if bad:
            found[o.name] = len(bad)
            if fix:
                bmo = bmesh.new()
                bmo.from_mesh(me)
                bmo.verts.ensure_lookup_table()
                # remove whole loose parts (hanger / cable pieces) that reach into the lane volume
                bset = set(bad)
                seen, kill = set(), set()
                for v in bmo.verts:
                    if v.index in seen:
                        continue
                    st, comp = [v], []
                    seen.add(v.index)
                    while st:
                        a_ = st.pop(); comp.append(a_)
                        for e in a_.link_edges:
                            b_ = e.other_vert(a_)
                            if b_.index not in seen:
                                seen.add(b_.index); st.append(b_)
                    if any(c_.index in bset for c_ in comp):
                        kill.update(c_.index for c_ in comp)
                bmesh.ops.delete(bmo, geom=[bmo.verts[i] for i in kill], context='VERTS')
                bmo.to_mesh(me)
                bmo.free()
    return found


LOG['bridge lane offenders before'] = bridge_lane_offenders(fix=True)
LOG['bridge lane offenders after'] = bridge_lane_offenders(fix=False)
log('bridge lanes', LOG['bridge lane offenders before'], '->', LOG['bridge lane offenders after'])

# searchlights: nested cones that fade at the silhouette (facing) and with height, dust noise; kept away from the bridge views
for o in sc.objects:
    if o.name.startswith('V12 searchlight beam'):
        hide(o)
slm = bpy.data.materials.new('V13 searchlight volume')
slm.use_nodes = True
slm.surface_render_method = 'BLENDED'
nt = slm.node_tree
nt.nodes.clear()
lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 1.8
gen = nt.nodes.new('ShaderNodeTexCoord'); sepz = nt.nodes.new('ShaderNodeSeparateXYZ')
fall = nt.nodes.new('ShaderNodeMapRange'); fall.inputs['From Min'].default_value = 0.0; fall.inputs['From Max'].default_value = 1.0
fall.inputs['To Min'].default_value = 1.0; fall.inputs['To Max'].default_value = 0.0
nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.012; nz.inputs['Detail'].default_value = 2
nzr = nt.nodes.new('ShaderNodeMapRange'); nzr.inputs['To Min'].default_value = 0.55; nzr.inputs['To Max'].default_value = 1.1
m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'
m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'
m3 = nt.nodes.new('ShaderNodeMath'); m3.operation = 'MULTIPLY'; m3.inputs[1].default_value = 0.2
em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.72, 0.86, 1.0, 1); em.inputs['Strength'].default_value = 3.5
tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); out = nt.nodes.new('ShaderNodeOutputMaterial')
L = nt.links.new
L(lw.outputs['Facing'], pw.inputs[0]); L(gen.outputs['Generated'], sepz.inputs[0]); L(sepz.outputs['Z'], fall.inputs['Value'])
L(gen.outputs['Object'], nz.inputs['Vector']); L(nz.outputs['Fac'], nzr.inputs['Value'])
L(pw.outputs[0], m1.inputs[0]); L(fall.outputs['Result'], m1.inputs[1]); L(m1.outputs[0], m2.inputs[0]); L(nzr.outputs['Result'], m2.inputs[1]); L(m2.outputs[0], m3.inputs[0])
L(m3.outputs[0], mx.inputs['Fac']); L(tr.outputs[0], mx.inputs[1]); L(em.outputs[0], mx.inputs[2]); L(mx.outputs[0], out.inputs[0])
SLC = newcoll('V13 | LED lines and searchlights')
HEIGHT = 650.0
sites = [cl.at(s0 - 90, -200, 0), cl.at(s0 + 20, -290, 0), cl.at(s0 + 150, -230, 0), cl.at(s0 + 230, -260, 0)]
for k, site in enumerate(sites):
    for layer, (r2, hm) in enumerate(((16.0, 1.0), (9.0, 1.0), (4.0, 1.0))):       # nested cones: wide soft halo + core
        bmc = bmesh.new()
        bmesh.ops.create_cone(bmc, cap_ends=False, cap_tris=False, segments=24, radius1=0.6, radius2=r2, depth=HEIGHT, matrix=Matrix.Translation((0, 0, HEIGHT / 2)))
        me = bpy.data.meshes.new(f'searchlight {k}.{layer}')
        bmc.to_mesh(me)
        bmc.free()
        me.materials.append(slm)
        for p_ in me.polygons:
            p_.use_smooth = True
        ob = bpy.data.objects.new(f'V13 searchlight beam {k}.{layer}', me)
        ob.location = Vector(site) + Vector((0, 0, 0.5))
        ob.rotation_euler = (math.radians(14 + 10 * (k % 2)), math.radians(-12 + 9 * k), 0)
        ob.visible_shadow = False
        SLC.objects.link(ob)
    new_light(f'V13 searchlight lamp {k}', 'POINT', Vector(site) + Vector((0, 0, 3)), 4000, (0.75, 0.88, 1.0), size=2.0, coll=SLC)

# =============================================================================================== 4. tunnel: tiled liner, cove lights, jet fans, niches, wayfinding, anime murals
TUN = newcoll('V13 | tunnel dressing')
for o in sc.objects:
    if o.name.startswith('V12 wall LED'):
        hide(o)
tun_o = next(o for o in sc.objects if o.name.startswith('V10 submerged tunnel'))
walls_o = next(o for o in sc.objects if o.name.startswith('V10 cut walls, grass shoulders'))
dg = bpy.context.evaluated_depsgraph_get()
bvh_t = BVHTree.FromObject(tun_o, dg)
bvh_w = BVHTree.FromObject(walls_o, dg)
inside = [i for i in range(M) if cl.P[i, 2] < -1.0]
cover = []
for i in inside:
    h_ = bvh_t.ray_cast(Vector(cl.P[i]) + Vector((0, 0, 1.5)), Vector((0, 0, 1)), 30)
    if h_[0] is not None:
        cover.append(i)
C0, C1 = cover[0], cover[-1]
LOG['tunnel'] = dict(depressed_stations=[inside[0], inside[-1]], covered_stations=[C0, C1], covered_length_m=round((C1 - C0) * 2), depressed_length_m=round((inside[-1] - inside[0]) * 2))
HGT = [0.2, 1.3, 2.4, 3.5, 4.6, 5.7]


def wall_hit(i, side, h):
    o_ = Vector(cl.P[i]) + Vector(cl.N[i]) * side * 4.0 + Vector((0, 0, h))
    d_ = Vector(cl.N[i]) * side
    best = None
    for bv in (bvh_t, bvh_w):
        r_ = bv.ray_cast(o_, d_, 40.0)
        if r_[0] is not None and (best is None or r_[3] < best[3]):
            best = r_
    return None if best is None else (best[0] - d_ * 0.07)


pts = {s_: {} for s_ in (-1, 1)}
for s_ in (-1, 1):
    for i in inside:
        pts[s_][i] = [wall_hit(i, s_, h) for h in HGT]
m_tile = bpy.data.materials.new('V13 tunnel tile')
m_tile.use_nodes = True
nt = m_tile.node_tree
b_ = nt.nodes['Principled BSDF']
br = nt.nodes.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = 3.0; br.inputs['Mortar Size'].default_value = 0.03
br.inputs['Brick Width'].default_value = 1.0; br.inputs['Row Height'].default_value = 1.0
br.inputs['Color1'].default_value = (0.72, 0.78, 0.8, 1); br.inputs['Color2'].default_value = (0.62, 0.7, 0.74, 1); br.inputs['Mortar'].default_value = (0.08, 0.09, 0.1, 1)
tcu = nt.nodes.new('ShaderNodeTexCoord')
nt.links.new(tcu.outputs['UV'], br.inputs['Vector'])
nt.links.new(br.outputs['Color'], b_.inputs['Base Color'])
b_.inputs['Roughness'].default_value = 0.22
m_cove = glow('V13 cove warm white', (1.0, 0.9, 0.72), 9.0)
m_edge = glow('V13 lane edge LED', (0.85, 0.95, 1.0), 6.0)
m_greenemit = glow('V13 exit sign green', (0.05, 0.9, 0.3), 5.0)
m_txtw = glow('V12 text white neon', (1.0, 0.95, 0.9), 12.0)
m_dkframe = mat('V13 lightbox frame', (0.03, 0.03, 0.035), 0.4, metal=0.6)
m_fan = mat('V13 jet fan', (0.5, 0.52, 0.55), 0.35, metal=0.8)
m_fanring = glow('V13 jet fan ring', (1.0, 0.7, 0.35), 0.8)
bl, bc, bcy = bmesh.new(), bmesh.new(), bmesh.new()
n_tile = 0
for s_ in (-1, 1):
    for i in inside[:-1]:
        a, b = pts[s_].get(i), pts[s_].get(i + 1)
        if not a or not b:
            continue
        for k in range(len(HGT) - 1):
            p0, p1, p2, p3 = a[k], b[k], b[k + 1], a[k + 1]
            if None in (p0, p1, p2, p3):
                continue
            lat0, lat1 = (p0 - Vector(cl.P[i])).dot(Vector(cl.N[i])) * s_, (p1 - Vector(cl.P[i + 1])).dot(Vector(cl.N[i + 1])) * s_
            if abs(lat0 - lat1) > 2.5:
                continue
            uu0, uu1 = i * 2.0, (i + 1) * 2.0
            pts_ = [p0, p1, p2, p3] if s_ > 0 else [p1, p0, p3, p2]
            uvs = [(uu0, HGT[k]), (uu1, HGT[k]), (uu1, HGT[k + 1]), (uu0, HGT[k + 1])] if s_ > 0 else [(uu1, HGT[k]), (uu0, HGT[k]), (uu0, HGT[k + 1]), (uu1, HGT[k + 1])]
            quad(bl, pts_, uvs, 0)
            n_tile += 1
        # continuous cove light line at 4.6 m and lit lane edge at the wall base
        if a[4] is not None and b[4] is not None:
            seg_box(bc, a[4] - Vector(cl.N[i]) * s_ * 0.05 + Vector((0, 0, 0.0)), b[4] - Vector(cl.N[i + 1]) * s_ * 0.05, 0.26, 0.2)
to_obj('V13 tunnel tiled liner', bl, [m_tile], TUN)
to_obj('V13 tunnel cove light line', bc, [m_cove], TUN)
for s_ in (-1, 1):
    for i in inside[:-1]:
        seg_box(bcy, cl.at(i, s_ * 8.7, 0.04), cl.at(i + 1, s_ * 8.7, 0.04), 0.14, 0.05)
to_obj('V13 tunnel lit lane edges', bcy, [m_edge], TUN)
LOG['tunnel tiles'] = n_tile
# jet fans on the ceiling (covered section), linked duplicates
fm = bpy.data.meshes.new('V13 jet fan')
bq = bmesh.new()
r = bmesh.ops.create_cone(bq, cap_ends=True, segments=14, radius1=0.42, radius2=0.42, depth=3.2)
bmesh.ops.rotate(bq, verts=r['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
for f in bq.faces:
    f.material_index = 0
for sgn in (-1, 1):
    rr = bmesh.ops.create_cone(bq, cap_ends=True, segments=14, radius1=0.46, radius2=0.46, depth=0.1)
    bmesh.ops.rotate(bq, verts=rr['verts'], cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    bmesh.ops.translate(bq, verts=rr['verts'], vec=(sgn * 1.6, 0, 0))
    for v in rr['verts']:
        for f in v.link_faces:
            f.material_index = 1
bq.to_mesh(fm)
bq.free()
fm.materials.append(m_fan)
fm.materials.append(m_fanring)
nfan = 0
for i in range(C0 + 14, C1 - 8, 14):
    for lat in (-4.2, 4.2):
        ob = bpy.data.objects.new(f'V13 jet fan {nfan}', fm)
        ob.location = Vector(cl.at(i, lat, 6.8 - 1.0))
        ob.rotation_euler.z = math.atan2(cl.T[i][1], cl.T[i][0])
        TUN.objects.link(ob)
        nfan += 1
LOG['jet fans'] = nfan
# emergency niches (framed recess + green 非常口 sign) every 30 m, alternating sides; overhead / wall wayfinding
bnf, bgs = bmesh.new(), bmesh.new()
nn = 0
for i in range(C0 + 6, C1 - 4, 15):
    s_ = 1 if (i // 15) % 2 else -1
    p = pts[s_].get(i)
    q = pts[s_].get(i + 1)
    if not p or not p[2] or not q or not q[2]:
        continue
    ctr_ = (p[2] + q[2]) / 2
    ang = math.atan2(cl.T[i][1], cl.T[i][0])
    box(bnf, (ctr_.x, ctr_.y, ctr_.z - 1.2), 0.12, 2.4, 2.2, ang, 0)
    inward = -Vector(cl.N[i]) * s_
    gs = ctr_ + inward * 0.12 + Vector((0, 0, 1.2))
    box(bgs, (gs.x, gs.y, gs.z), 0.1, 2.0, 0.65, ang, 0)
    text_obj(f'V13 niche sign {nn}', '非常口', gs + inward * 0.1 + Vector((0, 0, 0.32)), frot(inward), 0.45, m_txtw, TUN, 0.02, font=FB)
    nn += 1
to_obj('V13 tunnel emergency niche frames', bnf, [m_dkframe], TUN)
to_obj('V13 tunnel exit sign plates', bgs, [m_greenemit], TUN)
LOG['niches'] = nn
bsg = bmesh.new()
for tag, i, txt in (('name', C0 + 4, '東京湾トンネル'), ('exit', C1 - 40, '出口  EXIT'), ('exit2', C0 + (C1 - C0) // 2, '出口  600m')):
    fwd = Vector(cl.T[i])
    ang = math.atan2(fwd.y, fwd.x)
    a_, b_ = cl.at(i, -4.5, 5.6), cl.at(i, 4.5, 5.6)
    seg_box(bsg, a_, b_, 0.3, 1.3)
    text_obj(f'V13 tunnel sign {tag}', txt, Vector(cl.at(i, 0, 5.6)) - fwd * 0.2, frot(-fwd), 0.75, m_txtw, TUN, 0.02, font=FB)
to_obj('V13 tunnel overhead sign plates', bsg, [mat('V13 sign plate green', (0.02, 0.28, 0.12), 0.5, emit=(0.03, 0.4, 0.18), strength=0.8)], TUN)
# anime mural lightboxes (placeholders only): 6.4 x 3.6 m (16:9), backlit, alternating walls every 20 m
MUR = [mat_ for mat_ in ()]
mur_mats = [K.img_emit_mat(f'M_AnimeMural_{k:02d}', TEX / 'anime_mural' / f'placeholder_{k:02d}.png', 1.6) for k in range(1, 5)]
PW, PH = 6.4, 3.6
bmf, bme = bmesh.new(), bmesh.new()
panels = []
pm = {k: bmesh.new() for k in range(4)}
for n_, i in enumerate(range(inside[0] + 40, inside[-1] - 30, 10)):
    s_ = 1 if n_ % 2 else -1
    p = pts[s_].get(i)
    if not p or not p[2] or not pts[s_].get(i + 3) or not pts[s_][i + 3][2] or not pts[s_].get(i - 3) or not pts[s_][i - 3][2]:
        continue
    if abs(i - C0) < 8 or abs(i - C1) < 8:
        continue
    ctr_ = p[2] + (p[3] - p[2]) * 0.5                       # wall point at ~2.95 m
    inward = -Vector(cl.N[i]) * s_
    tang = Vector(cl.T[i])
    # flat plane through hits at the panel ends (keeps it parallel to the wall)
    pa, pb = pts[s_][i - 3][3], pts[s_][i + 3][3]
    tang = (pb - pa)
    tang.z = 0
    tang.normalize()
    lat_c = ctr_ + inward * 0.18 + Vector((0, 0, 0.55))
    k = n_ % 4
    corners = [lat_c - tang * PW / 2 - Vector((0, 0, PH / 2)), lat_c + tang * PW / 2 - Vector((0, 0, PH / 2)), lat_c + tang * PW / 2 + Vector((0, 0, PH / 2)), lat_c - tang * PW / 2 + Vector((0, 0, PH / 2))]
    sgn_flip = 1 if tang.cross(Vector((0, 0, 1))).dot(inward) > 0 else -1
    pts_f = corners if sgn_flip > 0 else [corners[1], corners[0], corners[3], corners[2]]
    uvs_f = [(0, 0), (1, 0), (1, 1), (0, 1)] if sgn_flip > 0 else [(1, 0), (0, 0), (0, 1), (1, 1)]
    quad(pm[k], [c_ + inward * 0.06 for c_ in pts_f], uvs_f, 0)
    # frame: four bars + LED edge
    for a_, b_ in ((0, 1), (1, 2), (2, 3), (3, 0)):
        seg_box(bmf, corners[a_] + inward * 0.1, corners[b_] + inward * 0.1, 0.32, 0.22)
        seg_box(bme, corners[a_] + inward * 0.2, corners[b_] + inward * 0.2, 0.08, 0.08)
    panels.append(dict(station=i, side=int(s_), mat=f'M_AnimeMural_{k + 1:02d}', pos=[round(float(x), 1) for x in lat_c]))
for k in range(4):
    if len(pm[k].verts):
        to_obj(f'V13 anime mural lightboxes {k + 1:02d}', pm[k], [mur_mats[k]], TUN)
    else:
        pm[k].free()
to_obj('V13 mural frames', bmf, [m_dkframe], TUN)
to_obj('V13 mural LED edges', bme, [m_cove], TUN)
LOG['murals'] = dict(count=len(panels), size_m=[PW, PH], aspect='16:9', materials=[m.name for m in mur_mats], spacing_m=20, placeholder='soft gradient + "ANIME MURAL / PLACEHOLDER nn", textures/anime_mural/placeholder_nn.png')
log('tunnel', LOG['tunnel'], 'tiles', n_tile, 'fans', nfan, 'niches', nn, 'murals', len(panels))

# =============================================================================================== 5. hologram anchors
HOLO = newcoll('V13 | hologram anchors')
HMK = newcoll('V13 | hologram markers (review only)')
gate_o = next(o for o in sc.objects if o.name.startswith('V10 01 | Asakusa vermilion romon gate') and o.type == 'MESH')
gp = gate_o.matrix_world.translation
tex_exit = C1 + 14
anchors = [
    ('tunnel exit', Vector(cl.at(tex_exit, 0, 3.5)), Vector(cl.T[tex_exit]), (6.0, 9.0), 'character floats over the lane at the tunnel mouth, facing the oncoming cars'),
    ('neon street', Vector(cl.at(AV + 34, -19.5, 5.0)), Vector(cl.N[AV + 34]), (5.0, 9.0), 'standing character between pylons, left of travel, facing the road'),
    ('gate plaza', Vector((gp.x, gp.y - 16, gp.z + 6.5)), Vector((0, -1, 0)), (9.0, 13.0), 'large figure in front of the vermilion gate, facing the approach'),
    ('start-straight building face', Vector((hp['x'], hp['y'], hp['z'] + 9.5)) + Vector(cl.N[hp['station']]) * (HQ_D / 2 - 5), Vector(cl.N[hp['station']]), (30.0, 12.0), 'wide projection on the HQ glazing, seen from the grid'),
    ('pagoda court', Vector(PPOS) + Vector((0, 0, 9)), Vector((0, -1, 0)), (6.0, 9.0), 'shrine-maiden style figure beside the pagoda'),
    ('bridge entry', Vector(cl.at(BR_I - 6, 0, 9.5)), Vector(cl.T[BR_I - 6]) * -1, (10.0, 6.0), 'banner-style hologram under the entry sign, facing the approach'),
]
m_mark = glow('V13 hologram marker', (0.3, 1.0, 0.9), 12.0)
for n_, (nm, pos, fac, size, note) in enumerate(anchors, 1):
    e = bpy.data.objects.new(f'HOLO_anchor_{n_:02d}', None)
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = 2.5
    e.location = pos
    fac = Vector((fac.x, fac.y, 0)).normalized()
    e.rotation_euler = (math.pi / 2, 0, math.atan2(fac.x, -fac.y))       # local -Y... Z up, +Y facing = outwards after rotation
    e['name'] = nm
    e['size_hint_w_m'] = float(size[0])
    e['size_hint_h_m'] = float(size[1])
    e['facing_xy'] = [round(fac.x, 3), round(fac.y, 3)]
    e['ground_z'] = round(float(pos.z - size[1] / 2), 1)
    e['note'] = note
    HOLO.objects.link(e)
    bmk = bmesh.new()
    bmesh.ops.create_icosphere(bmk, subdivisions=2, radius=0.7)
    mk = to_obj(f'HOLO_marker_{n_:02d}', bmk, [m_mark], HMK, tuple(pos))
    bq2 = bmesh.new()
    seg_box(bq2, pos - Vector((0, 0, size[1] / 2)), pos + Vector((0, 0, size[1] / 2)), 0.12, 0.12)
    to_obj(f'HOLO_extent_{n_:02d}', bq2, [m_mark], HMK)
LOG['hologram anchors'] = [dict(name=f'HOLO_anchor_{n:02d}', spot=a[0], pos=[round(float(x), 1) for x in a[1]], size_m=list(a[3])) for n, a in enumerate(anchors, 1)]

# =============================================================================================== 6. v12 weak list: lagoon village, wide run-off, crowd
lag = bpy.data.objects['V10 lagoon surface | bay datum -0.55m']
for s in bpy.data.materials['Tokyo Bay'].node_tree.nodes:
    if s.type == 'BSDF_PRINCIPLED':
        s.inputs['Roughness'].default_value = 0.025
        s.inputs['Base Color'].default_value = (0.004, 0.012, 0.03, 1)
VIL = newcoll('V13 | architecture lagoon village')
bmq = bmesh.new()
bmq.from_mesh(lag.data)
edges = [e for e in bmq.edges if e.is_boundary]
lc = np.array([sum((lag.matrix_world @ v.co).x for v in bmq.verts) / len(bmq.verts), sum((lag.matrix_world @ v.co).y for v in bmq.verts) / len(bmq.verts)])
mids = []
for e in edges:
    a_, b_ = lag.matrix_world @ e.verts[0].co, lag.matrix_world @ e.verts[1].co
    mids.append((np.array([(a_.x + b_.x) / 2, (a_.y + b_.y) / 2]), np.array([a_.x - b_.x, a_.y - b_.y])))
bmq.free()
bw_, bwin_, bro_, bten_, bpier_, blamp_ = (bmesh.new() for _ in range(6))
fr_boxes = obstacle_boxes(set())
n_pav = n_tent = 0
for k, (mid, ed) in enumerate(mids[::2]):
    out_ = mid - lc
    out_ /= np.linalg.norm(out_)
    pos = mid + out_ * 15.0
    if min(kd.find((pos[0], pos[1], 0))[2], 1e9) < 34:
        continue
    if len(fr_boxes) and np.any((fr_boxes[:, 0] < pos[0] + 8) & (fr_boxes[:, 1] > pos[0] - 8) & (fr_boxes[:, 2] < pos[1] + 8) & (fr_boxes[:, 3] > pos[1] - 8)):
        continue
    gz = ground_z(pos[0], pos[1])
    if gz is None:
        continue
    ang = math.atan2(out_[1], out_[0]) + math.pi / 2
    if k % 3 == 0:        # tent: white translucent pyramid, glowing
        s = 7.5
        top = (pos[0], pos[1], gz + 5.2)
        cs_, sn_ = math.cos(ang), math.sin(ang)
        base = [(pos[0] + (x * cs_ - y * sn_) * s / 2, pos[1] + (x * sn_ + y * cs_) * s / 2, gz + 2.4) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for q in range(4):
            quad(bten_, [base[q], base[(q + 1) % 4], top], mi=0)
            quad(bw_, [(base[q][0], base[q][1], gz), (base[(q + 1) % 4][0], base[(q + 1) % 4][1], gz), (base[(q + 1) % 4][0], base[(q + 1) % 4][1], gz + 2.4), (base[q][0], base[q][1], gz + 2.4)], mi=0)
        n_tent += 1
    else:                 # pavilion with a glowing lagoon-facing glass band and an LED roof edge
        w_, d_, h_ = 11.0, 5.5, 3.4
        box(bw_, (pos[0], pos[1], gz), w_, d_, h_, ang, 0)
        fx, fy = -out_[0] * 0 + out_[0] * (-d_ / 2 - 0.05), out_[1] * (-d_ / 2 - 0.05)
        box(bwin_, (pos[0] + out_[0] * (-d_ / 2 - 0.06) * -1 * -1, pos[1] + out_[1] * (-d_ / 2 - 0.06) * -1 * -1, gz + 0.6), w_ * 0.86, 0.1, 2.2, ang, 0)
        box(bro_, (pos[0], pos[1], gz + h_), w_ + 1.4, d_ + 1.4, 0.35, ang, 0)
        n_pav += 1
    # pier to the water with lamps
    pe = mid + out_ * 3.0
    seg_box(bpier_, (pe[0], pe[1], 0.5), (pe[0] - out_[0] * 14, pe[1] - out_[1] * 14, 0.5), 2.0, 0.18)
    for t in (0.2, 0.55, 0.9):
        q_ = pe - out_ * 14 * t
        box(blamp_, (q_[0], q_[1], 0.5), 0.2, 0.2, 1.6, 0, 0)
    box(blamp_, (mid[0] + out_[0] * 9, mid[1] + out_[1] * 9, gz), 0.25, 0.25, 3.2, 0, 0)
to_obj('V13 village | pavilion and tent bases', bw_, [mat('V13 village dark wall', (0.05, 0.05, 0.07), 0.6)], VIL)
to_obj('V13 village | glowing glass bands', bwin_, [glow('V13 village window', (1.0, 0.62, 0.3), 4.5)], VIL)
to_obj('V13 village | LED roof edges', bro_, [m_ledp], VIL)
to_obj('V13 village | glowing tents', bten_, [glow('V13 tent glow', (1.0, 0.72, 0.85), 1.0)], VIL)
to_obj('V13 village | piers', bpier_, [mat('V13 pier wood', (0.12, 0.08, 0.05), 0.5, emit=(1.0, 0.5, 0.2), strength=0.2)], VIL)
to_obj('V13 village | lamp posts', blamp_, [glow('V13 lamp warm', (1.0, 0.75, 0.4), 10.0)], VIL)
LOG['lagoon village'] = dict(pavilions=n_pav, tents=n_tent)
new_light('V13 village wash', 'AREA', Vector((lc[0], lc[1], 30)), 150000, (0.8, 0.45, 1.0), size=120, coll=VIL)

# wide painted run-off fields on the outside of the corners (blue / pink / yellow like ref 03)
RUNC = newcoll('V13 | wide run-off paint')
RUNOFF_RANGES = [(150, 188), (228, 240), (389, 402), (589, 650), (862, 902), (940, 970), (1198, 1210), (1283, 1288)]
bands = [mat('V12 run-off blue', (0.02, 0.18, 0.7), 0.45, emit=(0.02, 0.25, 0.9), strength=0.35), mat('V12 run-off pink', (0.9, 0.12, 0.45), 0.45, emit=(0.9, 0.1, 0.4), strength=0.35),
         mat('V12 run-off yellow', (0.95, 0.72, 0.05), 0.45, emit=(0.9, 0.6, 0.05), strength=0.3), mat('V12 paint white', (0.85, 0.85, 0.82), 0.55, emit=(1, 1, 0.95), strength=0.12)]
bm = bmesh.new()
n_ro = 0
RO_USED = []
for a, b in RUNOFF_RANGES:
    i0, i1 = int(a / 1440 * M), int(b / 1440 * M)
    mid = (i0 + i1) // 2
    if cl.P[mid, 2] < 0.5 or i1 - i0 < 6:
        continue
    turn = np.cross(cl.T[i0, :2], cl.T[i1, :2])
    side = -1 if turn > 0 else 1                         # outside of the corner
    i0, i1 = i0 - 6, i1 + 6
    lat = 12.8
    for bi, (wd, mi) in enumerate(((2.6, 0), (2.6, 1), (2.6, 2), (2.6, 0), (2.6, 1), (0.5, 3))):
        ribbon(bm, i0, i1, side, lat, lat + wd, 0.07, mi)
        lat += wd + 0.0
    RO_USED.append((a, b, side, i0, i1))
    n_ro += 1
to_obj('V13 wide run-off bands', bm, bands, RUNC)
LOG['wide runoff corners'] = n_ro

# crowd: instanced cutout strips on every row of the new stands; seat risers go dark
cm = bpy.data.materials['V12 crowd lit']
cb = cm.node_tree.nodes['Principled BSDF']
for l in list(cb.inputs['Base Color'].links) + list(cb.inputs['Emission Color'].links):
    cm.node_tree.links.remove(l)
cb.inputs['Base Color'].default_value = (0.04, 0.035, 0.05, 1)
cb.inputs['Emission Color'].default_value = (0.1, 0.05, 0.05, 1)
cb.inputs['Emission Strength'].default_value = 0.1
crowd_m = bpy.data.materials.new('V13 crowd cutout')
crowd_m.use_nodes = True
crowd_m.surface_render_method = 'DITHERED'
nt = crowd_m.node_tree
b_ = nt.nodes['Principled BSDF']
t_ = nt.nodes.new('ShaderNodeTexImage')
t_.image = bpy.data.images.load(str(TEX / 'v13_crowd_cutout.png'), check_existing=True)
t_.extension = 'REPEAT'
nt.links.new(t_.outputs['Color'], b_.inputs['Base Color'])
nt.links.new(t_.outputs['Color'], b_.inputs['Emission Color'])
nt.links.new(t_.outputs['Alpha'], b_.inputs['Alpha'])
b_.inputs['Emission Strength'].default_value = 0.35
b_.inputs['Roughness'].default_value = 0.9
CRC = newcoll('V13 | start stands crowd')
bm = bmesh.new()
n_strip = 0
for side, (i0, i1) in ((-1, (s0 - 56, s0 + 46)), (1, (s0 - 68, s0 + 58))):
    for k in range(18):
        lat = 16.6 + 0.9 * (k + 1) - 0.3
        z = 0.9 + 0.45 * k
        for off in (0.0, 1.65):          # (the south stand has a view gap, see GAP)                                   # two staggered strips per row so the crowd reads as a dense mass
            for i in range(i0, i1):
                if side == -1 and GAP[0] <= i <= GAP[1]:
                    continue
                a_, b_p = cl.at(i, side * (lat - 0.05 * (off > 0)), z + 0.02), cl.at(i + 1, side * (lat - 0.05 * (off > 0)), z + 0.02)
                up = np.array([0, 0, 1.25])
                s_a, s_b = (i * 2.0 + off) / 3.3, ((i + 1) * 2.0 + off) / 3.3
                pts_ = [a_, b_p, b_p + up, a_ + up] if side > 0 else [b_p, a_, a_ + up, b_p + up]
                uvs_ = [(s_a, 0), (s_b, 0), (s_b, 1), (s_a, 1)] if side > 0 else [(s_b, 0), (s_a, 0), (s_a, 1), (s_b, 1)]
                quad(bm, pts_, uvs_, 0)
                n_strip += 1
to_obj('V13 crowd cutout strips', bm, [crowd_m], CRC, merge=0)
LOG['crowd strips'] = n_strip

# =============================================================================================== 7. cameras, clearance, visibility, budget, save
extra = {}
hq_c = Vector((hp['x'], hp['y'], hp['z'] + 8))
extra['n_hq_from_start'] = (cl.at(s0 - 6, 1.0, 1.7), hq_c, 24)
extra['o_pano_driver_start'] = (cl.at(s0 + 30, 0, 1.6), cl.at(s0 + 300, -60, 18), 28)
extra['p_bridge_deck_closeup'] = (cl.at(BR_I - 38, -3, 2.3), cl.at(BR_I + 20, 0, 6), 30)
mid_c = (C0 + C1) // 2
extra['q_tunnel_murals'] = (cl.at(mid_c - 40, 0.5, 1.5), cl.at(mid_c + 30, 0, 3.0), 22)
for n_, (nm, pos, fac, size, note) in enumerate(anchors, 1):
    f_ = Vector((fac.x, fac.y, 0)).normalized()
    extra[f'r{n_}_holo_anchor'] = (pos + f_ * (66 if n_ == 4 else 34) + Vector((0, 0, 1.5 - pos.z * 0.0 + (0 if pos.z < 6 else 0))), pos, 30)
if RO_USED:
    br_c = np.array([(br_lo[0] + br_hi[0]) / 2, (br_lo[1] + br_hi[1]) / 2])
    best_r = None
    for r in RO_USED:
        mid_ = (r[3] + r[4]) // 2
        fc = np.array(cl.at(mid_, r[2] * 20, 0)[:2])
        if np.linalg.norm(fc - br_c) < 260 or np.linalg.norm(fc - lc) < 160:
            continue
        if any(np.linalg.norm(fc - np.array(sv.matrix_world.translation[:2])) < 230 for sv in sc.objects if sv.name.startswith(('V10 08 |', 'V12 Seoul'))):
            continue
        sc_ = (r[4] - r[3]) - 0.04 * np.linalg.norm(fc - np.array([-506.0, -221.0]))
        if best_r is None or sc_ > best_r[0]:
            best_r = (sc_, r, mid_)
    _, rr_, mid_ = best_r
    field = Vector(cl.at(mid_, rr_[2] * 22, 0))
    wp = Vector((-506.0, -221.0, 40.0))
    u_ = (wp - field)
    u_.z = 0
    u_ = u_.normalized() if u_.length < 1200 else Vector(cl.N[mid_]) * rr_[2]
    extra['c_corner_runoff_wheel'] = (field - u_ * 58 + Vector((0, 0, 26)), field + u_ * 80 + Vector((0, 0, 1)), 28)
    LOG['corner camera run-off'] = dict(range=list(rr_[:2]), outside_side=rr_[2], field_xy=[round(float(field.x)), round(float(field.y))])
for nm_, key_, dist_, hgt_ in (('s_hq_aerial', 'hq', 230, 60), ('t_lantern_hall', 'lantern_hall', 95, 62), ('u_timber_tower', 'timber_tower', 95, 12), ('v_neon_gate', 'neon_gate', 120, 40)):
    objs_ = V.group_objs(sc, ('V13 HQ',) if key_ == 'hq' else V.LANDMARKS[key_])
    lo_, hi_ = V.bbox(objs_)
    c_ = (lo_ + hi_) / 2
    ri_, rd_, rl_ = cl.nearest(c_[0], c_[1])
    dvec = Vector((cl.P[ri_][0] - c_[0], cl.P[ri_][1] - c_[1], 0)).normalized()
    pos_ = Vector((c_[0], c_[1], lo_[2])) + dvec * dist_ + Vector((0, 0, hgt_))
    _gz = ground_z(pos_.x, pos_.y)
    if _gz is not None:
        pos_.z = max(pos_.z, _gz + hgt_ + 4)
    extra[nm_] = (pos_, Vector((c_[0], c_[1], lo_[2] + (hi_[2] - lo_[2]) * 0.45)), 28)
for nm, (loc, tgt, lens) in list(C.cameras(cl).items()) + list(extra.items()):
    nmx = 'V13 | ' + nm
    cam = bpy.data.objects.new(nmx, bpy.data.cameras.new(nm))
    sc.collection.objects.link(cam)
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = lens
    cam.data.clip_end = 20000
# the stale v12 cameras that renders still name keep working; b/d/e come from v12 (V12 | ...)
AFTER = CK.run('v13')
LOG['clearance_after'] = {'violators': AFTER['violators'], 'names': [r['name'] for r in AFTER['list']], 'checked': AFTER['checked']}
dg = bpy.context.evaluated_depsgraph_get()
VIS_AFTER = V.measure(sc, cl)
(O / 'visibility-v13.json').write_text(_json.dumps(VIS_AFTER, indent=1))
LOG['visibility_after'] = VIS_AFTER
_h2 = V.hide_ignored(sc)
dg = bpy.context.evaluated_depsgraph_get()
_own = {o.name for o in V.group_objs(sc, ('V13 HQ',))}
_lo, _hi = V.bbox(V.group_objs(sc, ('V13 HQ',)))
_st = list(range(s0 - 30, s0 + 37, 3))
_ev = V.eval_positions(sc, dg, cl, V.targets(_lo, _hi), (_lo + _hi) / 2, _st, frozenset(_own))
LOG['hq visible from start straight'] = dict(stations_tested=len(_st), visible_pct=round(100 * sum(e[0] for e in _ev) / len(_ev), 1), ahead_pct=round(100 * sum(e[1] for e in _ev) / len(_ev), 1))
V.restore_hidden(_h2)


def budget():
    dgb = bpy.context.evaluated_depsgraph_get()
    uniq, drawn, objs, shared = {}, 0, 0, {}
    for o in sc.objects:
        if not vis(o) or o.type not in ('MESH', 'FONT', 'CURVE'):
            continue
        key = o.data.name
        if o.type == 'MESH':
            t = tris(o.data)
        else:
            ev = o.evaluated_get(dgb)
            me = ev.to_mesh()
            t = tris(me)
            ev.to_mesh_clear()
        uniq[key] = t
        drawn += t
        objs += 1
        shared[key] = shared.get(key, 0) + 1
    return dict(visible_objects=objs, unique_mesh_datablocks=len(uniq), unique_triangles=int(sum(uniq.values())), drawn_triangles=int(drawn),
                shared_datablocks=sum(1 for v in shared.values() if v > 1),
                top_drawn=sorted(((k, uniq[k] * v, v) for k, v in shared.items()), key=lambda x: -x[1])[:12])


LOG['budget'] = budget()
sc['v13_night_day'] = 'night'
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(DST))
(O / 'v13-build.json').write_text(_json.dumps(LOG, indent=1, default=str))
log('saved', DST)
log(_json.dumps({k: LOG[k] for k in LOG if k not in ('budget',)}, indent=1, default=str)[:6000])
