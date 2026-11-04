"""What lies between the road and the wall, exec'd by build_qingshan.py after the ground. Real circuits, kept quiet (research: Mugello and Spa's gravel, Adelaide's paved zone before gravel, Silverstone's rounded stones):
    shoulder   a narrow strip of older, paler tarmac past the white line, behind the kerbs in corners; its edge is never ruler-straight
    verge      mown grass, dusty where it meets the tarmac, worn where cars run wide on a corner's exit
    gravel     only on the outside of the stops a car can miss, a sweep narrowing to nothing at both ends, with a wider paved zone in front of it
    marks      a few dark tyre lines leaving the road at those corners' exits
Collision stays flat as everywhere else: the shoulder grips as paved, gravel as grass."""
MAT.update({'shoulder': material('QS | hard shoulder', tex='worn_asphalt', rough=0.85, vcol=True), 'gravel': material('QS | gravel', tex='gravel_ground_01', vcol=True)})
for k_ in ('gravel',): MAT[k_].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = 0.15
UVS.update({'shoulder': 3.5, 'gravel': 4.7})
def wander(i, sd, scale, seed=0.0): return fbm(i * STEP / scale + seed, sd * 37.1 + seed, 2)
DUST = (.74, .62, .42, 1)
def mix(a, b, t): return tuple(a[q] + (b[q] - a[q]) * t for q in range(4))
# the corners that get a trap: fast arrivals at real turns; each gets its range along the lap and its outside
TRAPS = []
for c in SRC['corners']:
    if c['entry_kmh'] > 200 and c['turn'] > 60:
        half = c['radius'] * math.radians(c['turn']) / 2; TRAPS.append(dict(n=c['n'], sd=1 if c['hand'] == 'R' else -1, a=c['at'] - half - 62, b=c['at'] + half + 28, exit=c['at'] + half))
log('traps', [(t['n'], t['sd']) for t in TRAPS])
def lap_d(s, ref): return ((s - ref + LAP / 2) % LAP) - LAP / 2
def trap_at(i, sd):      # 0 outside a trap, 1 in its full width, easing at both ends
    s = i * STEP; g = 0.0
    for t in TRAPS:
        if t['sd'] != sd: continue
        d0, d1 = lap_d(s, t['a']), lap_d(t['b'], s)
        if d0 >= 0 and d1 >= 0: g = max(g, ss(0, 34, d0) * ss(0, 30, d1))
    return g
def wear_at(i, sd):      # the outside of a corner's exit, where cars run wide
    s = i * STEP; w = 0.0
    for c in SRC['corners']:
        if c['turn'] < 60 or (1 if c['hand'] == 'R' else -1) != sd: continue
        d = lap_d(s, c['at'] + c['radius'] * math.radians(c['turn']) / 2)
        if -10 < d < 90: w = max(w, ss(-10, 12, d) * (1 - ss(40, 90, d)))
    return w
kerbed = [1.0 if CORNER[i] else 0.0 for i in range(N)]
for _ in range(3): kerbed = [sum(kerbed[(i + d) % N] for d in range(-5, 6)) / 11 for i in range(N)]
SH = {}
for sd in (1, -1):
    g_ = [trap_at(i, sd) for i in range(N)]; SH[sd] = [HW + 1.25 + 1.4 * kerbed[i] + 2.2 * g_[i] + 0.16 * wander(i, sd, 21) for i in range(N)]
# ---- shoulder and verge, one strip each side, the width the ground's lip rule asks for (as Llano)
SHOULDER = 13.0; bm_s = bmesh.new(); vs_ = vcol_layer(bm_s); bm_v = bmesh.new(); vv = vcol_layer(bm_v); paved_col = []
for sd in (1, -1):
    rows_s, rows_v, cols_s, cols_v = [], [], [], []
    for i in range(N):
        l1 = SH[sd][i]; out = max(HW + SHOULDER, l1 + 7.0); wr = wear_at(i, sd); pat = ss(-.05, .32, wander(i, sd, 26, 5.0)); pat2 = ss(-.1, .3, wander(i, sd, 11, 9.0))
        rows_s.append([off(i, sd * HW, -0.005), off(i, sd * l1, -0.012)]); rows_v.append([off(i, sd * l1, -0.012), off(i, sd * (l1 + 1.0 + 1.2 * pat2), -0.02), off(i, sd * (l1 + 3.2 + 3.0 * pat), -0.025), off(i, sd * out, -0.03)])
        t0 = 1.0 + 0.08 * wander(i, sd, 14, 2.0); cols_s.append([(t0, t0, t0 * .97, 1)] * 2)
        grass = tint(off(i, sd * (l1 + 4)), HW); edge = .45 + .4 * pat2; cols_v.append([mix(grass, DUST, min(1, edge + wr)), mix(grass, DUST, min(.9, .16 * pat + .75 * wr * pat2)), mix(grass, DUST, .55 * wr * pat), tint(off(i, sd * out), HW)])
    for rows, cols, bm_, lay in ((rows_s, cols_s, bm_s, vs_), (rows_v, cols_v, bm_v, vv)):
        V = [[bm_.verts.new(p) for p in r] for r in rows]; m_ = len(rows[0])
        for i in range(N):
            a, b = V[i], V[(i + 1) % N]; ca, cb = cols[i], cols[(i + 1) % N]
            for k in range(m_ - 1):
                f = bm_.faces.new((a[k], b[k], b[k + 1], a[k + 1]) if sd > 0 else (a[k + 1], b[k + 1], b[k], a[k]))
                for l in f.loops: j_ = 0 if l.vert in a else 1; q_ = (a if j_ == 0 else b).index(l.vert); l[lay] = (ca if j_ == 0 else cb)[q_]
    paved_col += [[rows_s[i][0].copy(), rows_s[(i + 1) % N][0].copy(), rows_s[(i + 1) % N][1].copy(), rows_s[i][1].copy()][::sd] for i in range(N)]
    ground_col += [[rows_v[i][0].copy(), rows_v[(i + 1) % N][0].copy(), rows_v[(i + 1) % N][-1].copy(), rows_v[i][-1].copy()][::sd] for i in range(N)]
bmesh.ops.recalc_face_normals(bm_s, faces=bm_s.faces[:]); bmesh.ops.recalc_face_normals(bm_v, faces=bm_v.faces[:])
mesh_obj('QS hard shoulder', bm_s, ['shoulder'], smooth=True); mesh_obj('QS verge', bm_v, ['grass'], smooth=True)
# ---- gravel: follows the ground just above it, its edges wandering and sunk into the grass (no lip, no dark outline), stones dusted paler at the rim
bm_g = bmesh.new(); vg = vcol_layer(bm_g); NL_ = 6
for t in TRAPS:
    sd = t['sd']; i0, i1 = int(t['a'] / STEP), int(t['b'] / STEP); rows = []; cols = []
    for i_ in range(i0, i1 + 1, 2):
        i = i_ % N; g = trap_at(i, sd); wl = BD[sd][i] - 1.4; a = SH[sd][i] + 1.3 + .35 * wander(i, sd, 15, 3.0); a = wl + (a - wl) * g; b = wl - .25 * wander(i, sd, 19, 7.0) * g; row, col = [], []
        for q in range(NL_ + 1):
            u = q / NL_; p = off(i, sd * (a + (b - a) * u)); strip_z = CL[i].z - .025; z = max(gz(p.x, p.y), strip_z) + (.05 if 0 < q < NL_ else -.03); row.append(Vector((p.x, p.y, z))); rim = 1 - min(u, 1 - u) * 2; d_ = .96 + .22 * fbm(p.x / 11, p.y / 11, 3); col.append((d_ * (1 + .05 * rim ** 3), d_ * (.97 + .03 * rim ** 3), d_ * (.88 + .02 * rim ** 3), 1))
        rows.append(row); cols.append(col)
    V = [[bm_g.verts.new(p) for p in r] for r in rows]
    for j in range(len(V) - 1):
        for k in range(NL_):
            f = bm_g.faces.new((V[j][k], V[j + 1][k], V[j + 1][k + 1], V[j][k + 1]))
            for l in f.loops: jj = j if l.vert in V[j] else j + 1; l[vg] = cols[jj][V[jj].index(l.vert)]
bmesh.ops.recalc_face_normals(bm_g, faces=bm_g.faces[:]); mesh_obj('QS gravel', bm_g, ['gravel'], smooth=True)
# ---- tyre lines leaving the road on the way out of those corners: Llano's skid sheet, soft-edged, over kerb, shoulder and grass
sk = bpy.data.materials.new('QS | tyre marks'); sk.use_nodes = True; nt_ = sk.node_tree; Pk = nt_.nodes['Principled BSDF']; it_ = nt_.nodes.new('ShaderNodeTexImage'); it_.image = image(ROOT / 'tracks' / 'llano' / 'tex' / 'skid.png'); nt_.links.new(it_.outputs['Color'], Pk.inputs['Base Color']); nt_.links.new(it_.outputs['Alpha'], Pk.inputs['Alpha']); Pk.inputs['Roughness'].default_value = .75; sk.surface_render_method = 'BLENDED'; sk.use_transparent_shadow = True; MAT['marks'] = sk
bm_k = bmesh.new(); uvk = bm_k.loops.layers.uv.verify(); rnd = random.Random(23)
for t in TRAPS:
    for run, (lat0, lat1, len_) in enumerate(((HW - 1.2, HW + 4.5, 46), (HW - .4, HW + 6.5, 62))):
        i0 = int((t['exit'] + 4 + run * 9) / STEP); m_ = int(len_ / STEP / 2); prev = None
        for q in range(m_ + 1):
            u = q / m_; i = (i0 + q * 2) % N; lat = lat0 + (lat1 - lat0) * u ** 1.5; zo = .09 if lat < HW + 1.6 else .07; pa, pb = off(i, t['sd'] * (lat - 1.0), zo), off(i, t['sd'] * (lat + 1.0), zo); va, vb = bm_k.verts.new(pa), bm_k.verts.new(pb)
            if prev:
                f = bm_k.faces.new((prev[0], prev[1], vb, va)); v0, v1 = (q - 1) / m_, q / m_
                for l, (a_, b_) in zip(f.loops, ((0, v0), (1, v0), (1, v1), (0, v1))): l[uvk].uv = (a_, b_)
            prev = (va, vb)
bmesh.ops.recalc_face_normals(bm_k, faces=bm_k.faces[:]); mesh_obj('QS tyre marks', bm_k, ['marks'], planar=False)
log('off-track: shoulder', len(paved_col), 'traps', len(TRAPS))
