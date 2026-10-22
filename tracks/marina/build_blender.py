"""Build the Corniche Marina Circuit in Blender from layout.py, export it for the browser, render previews.

"C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P tracks/marina/build_blender.py -- [--render]

Outputs in tracks/marina/out/: marina.blend, marina_visual.glb, marina_collision.glb, track.json, previews/*.png
Everything is generated: change layout.py and re-run. Nothing here is hand-edited in the .blend.
"""
import bmesh, bpy, math, os, sys
from mathutils import Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import layout as L  # noqa: E402

PH = os.path.join(ROOT, "assets", "polyhaven")
OUT = os.path.join(HERE, "out")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
os.makedirs(os.path.join(OUT, "previews"), exist_ok=True)

C = L.sample()
N = len(C["points"])
SD = L.sides(C)
PIT = L.pit_lane(C)
HW = C["halfWidth"]
CROWN = 0.06          # road crown (m) at the centre line: water runs off to the edges
GROUND_Z = -0.08
WATER_Z = -1.0

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


def coll(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(c)
    return c


VIS = coll("Visual")
COL = coll("Collision")
CAMS = coll("Preview")

# ------------------------------------------------------------------------------------------------ materials

TILE = {}   # material name -> world-space UV tile in metres


def pbr(name, tex=None, res="1k", tile=3.0, color=(0.5, 0.5, 0.5), rough=0.5, metal=0.0, emit=None, double=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.use_backface_culling = not double
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if tex:
        def img(kind, noncolor):
            im = bpy.data.images.load(os.path.join(PH, tex, f"{tex}_{kind}_{res}.jpg"), check_existing=True)
            if noncolor:
                im.colorspace_settings.name = "Non-Color"
            n = nt.nodes.new("ShaderNodeTexImage")
            n.image = im
            return n
        nt.links.new(img("diff", False).outputs["Color"], b.inputs["Base Color"])
        sep = nt.nodes.new("ShaderNodeSeparateColor")   # Poly Haven ARM = glTF ORM: G roughness, B metallic
        nt.links.new(img("arm", True).outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
        nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(img("nor_gl", True).outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    if emit:
        b.inputs["Emission Color"].default_value = (*emit[0], 1)
        b.inputs["Emission Strength"].default_value = emit[1]
    TILE[name] = tile
    return m


def kerb_material():
    """Red/white kerb: a tiny generated stripe texture (one red + one white block per V unit), bevel-shaded at the edges."""
    w, h = 32, 256
    im = bpy.data.images.new("kerb_stripes", w, h)
    px = []
    for y in range(h):
        col = (0.55, 0.02, 0.02) if y < h // 2 else (0.82, 0.82, 0.8)
        for x in range(w):
            shade = 0.72 + 0.28 * min(1.0, min(x, w - 1 - x) / 5)
            px += [col[0] * shade, col[1] * shade, col[2] * shade, 1.0]
    im.pixels = px
    im.filepath_raw = os.path.join(OUT, "kerb_stripes.png")
    im.file_format = "PNG"
    im.save()
    m = pbr("M_Kerb", rough=0.42)
    nt = m.node_tree
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(t.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    return m


def barrier_material():
    """Red/white painted barrier: 4 m red, 4 m white along the wall (wall UVs: u = metres along / tile), a little grime
    toward the foot. Generated, like the kerb stripes."""
    w, h = 128, 16
    im = bpy.data.images.new("barrier_stripes", w, h)
    px = []
    for y in range(h):
        grime = 0.8 + 0.2 * min(1.0, y / (h * 0.4))
        for x in range(w):
            col = (0.5, 0.025, 0.02) if x < w // 2 else (0.8, 0.8, 0.78)
            v = grime * (0.94 + 0.06 * noise.noise(Vector((x / 9.0, y / 5.0, 0.7))))
            px += [col[0] * v, col[1] * v, col[2] * v, 1.0]
    im.pixels = px
    im.filepath_raw = os.path.join(OUT, "barrier_stripes.png")
    im.file_format = "PNG"
    im.save()
    m = pbr("M_Barrier", rough=0.55, tile=8.0)
    nt = m.node_tree
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(t.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    return m


M = dict(
    asphalt=pbr("M_Asphalt", "asphalt_track", "2k", tile=3.0),
    line=pbr("M_LinePaint", color=(0.8, 0.8, 0.78), rough=0.45),
    kerb=kerb_material(),
    verge=pbr("M_Verge", "asphalt_pit_lane", tile=3.0),
    tarmac=pbr("M_RunoffTarmac", "asphalt_pit_lane", tile=3.0),
    sand=pbr("M_Sand", "coast_sand_01", tile=15.0),
    barrier=barrier_material(),
    paved=pbr("M_Paved", "brushed_concrete", tile=2.5),
    pit=pbr("M_PitLane", "asphalt_pit_lane", tile=3.0),
    concrete=pbr("M_Concrete", "brushed_concrete", tile=2.5),
    ground=pbr("M_Ground", "aerial_sand", tile=40.0),
    water=pbr("M_Water", color=(0.01, 0.035, 0.045), rough=0.04),
    yellow=pbr("M_PaintYellow", color=(0.85, 0.62, 0.02), rough=0.5),
    metal=pbr("M_Metal", color=(0.35, 0.36, 0.38), rough=0.35, metal=1.0),
    roof=pbr("M_Roof", color=(0.85, 0.86, 0.88), rough=0.3, metal=0.6, double=True),
    lamp=pbr("M_LampHead", color=(1, 0.95, 0.85), emit=((1.0, 0.93, 0.8), 12.0)),
    door=pbr("M_GarageDoor", color=(0.05, 0.05, 0.06), rough=0.6, emit=((1.0, 0.85, 0.6), 0.4)),
)


def multiply_by_vertex_color(m, attr="Col"):
    """Base colour = texture x colour attribute: low-frequency variation that breaks texture tiling.
    The glTF exporter writes it as COLOR_0, which three.js multiplies in the same way."""
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex_link = bsdf.inputs["Base Color"].links[0]
    va = nt.nodes.new("ShaderNodeVertexColor")
    va.layer_name = attr
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(tex_link.from_socket, mix.inputs["A"])
    nt.links.new(va.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])


multiply_by_vertex_color(M["ground"])
multiply_by_vertex_color(M["asphalt"])     # rubbered racing line, braking-zone rubber, dusty edges
multiply_by_vertex_color(M["kerb"])        # tyre rubber on the kerbs at the apexes, faded paint
M["turf"] = pbr("M_Turf", color=(0.07, 0.22, 0.06), rough=0.85)


def painted(name, tint, tex="asphalt_pit_lane", tile=3.0):
    """Painted tarmac: paint tint x the asphalt's own colour, so the aggregate still shows through (exported as
    baseColorTexture x baseColorFactor), on the asphalt's normal and roughness. A flat colour read as plastic."""
    m = pbr(name, tex, tile=tile)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tex = b.inputs["Base Color"].links[0].from_socket
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(tex, mix.inputs["A"])
    mix.inputs["B"].default_value = (*tint, 1.0)
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    return m


# the night palette's teal and deep blue, muted: worn paint on tarmac, not plastic
M["paint_teal"] = painted("M_PaintTeal", (0.3, 0.85, 0.95))
M["paint_blue"] = painted("M_PaintBlue", (0.2, 0.3, 0.75))
M["grass"] = painted("M_Grass", (0.5, 0.95, 0.4), tex="leafy_grass", tile=4.0)   # the texture's brown leaf litter -> kept green
M["asphalt"].node_tree.nodes["Normal Map"].inputs["Strength"].default_value = 1.6   # more aggregate relief up close
M["kerb"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.6
SURF_OF = {"asphalt": "col_asphalt", "line": "col_asphalt", "kerb": "col_curb", "verge": "col_runoff_tarmac",
           "tarmac": "col_runoff_tarmac", "sand": "col_sand", "paved": "col_paved", "pit": "col_pit", "turf": "col_grass", "grass": "col_grass",
           "paint_teal": "col_runoff_tarmac", "paint_blue": "col_runoff_tarmac"}
RL = L.racing_line(C)
BZ = L.braking_zones(C)

# ------------------------------------------------------------------------------------------------ geometry helpers

S = [0.0]   # arc length at each sample
for i in range(1, N):
    S.append(S[-1] + math.dist(C["points"][i - 1], C["points"][i]))
KERB_CYCLE = C["length"] / round(C["length"] / 8.0)   # 4 m red + 4 m white, seamless around the lap

COLLISION = {}   # surface -> (bmesh, {key: vert})


def col_quad(surface, keys, cos):
    if surface not in COLLISION:
        COLLISION[surface] = (bmesh.new(), {})
    bm, cache = COLLISION[surface]
    vs = []
    for k, co in zip(keys, cos):
        if k not in cache:
            cache[k] = bm.verts.new(co)
        vs.append(cache[k])
    try:
        bm.faces.new(vs)
    except ValueError:   # duplicate face
        pass


def at(i, lat, z):
    x, y = L.offset(C, i % N, lat)
    return Vector((x, y, z))


def ribbon(name, idxs, cols, bands, collection, flip=False, smooth=True, collide=True, uvmode="world", tile=None, vcol=None):
    """A strip along the centre line. cols(i) -> [(lateral, z)] left to right; bands(i, b) -> material key or None
    (None = no face). UVs: "world" = planar XY per material tile (ground-like surfaces, no seams on curves);
    "wall" = (distance along track, distance along the profile) for walls and buildings;
    "strip" = (distance along track, 0..1 across each band) for decals and crowd rows; kerbs always get along-track stripes.
    tile overrides the material's tile; vcol(i, lateral) -> (r, g, b) fills colour attribute "Col"."""
    keys = list(M)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    colr = bm.loops.layers.color.new("Col") if vcol else None
    grid, prof, lats = [], [], []
    for i in idxs:
        cs = cols(i % N)
        grid.append([bm.verts.new(at(i, lat, z)) for lat, z in cs])
        lats.append([lat for lat, _ in cs])
        cum = [0.0]
        for (l0, z0), (l1, z1) in zip(cs, cs[1:]):
            cum.append(cum[-1] + math.hypot(l1 - l0, z1 - z0))
        prof.append(cum)
    for a in range(len(idxs) - 1):
        i, j = idxs[a] % N, idxs[a + 1] % N
        sa, sb = S[i], S[j] if j != 0 else C["length"]
        for b in range(len(grid[a]) - 1):
            mk = bands(i, b)
            if mk is None:
                continue
            quad = [grid[a][b], grid[a][b + 1], grid[a + 1][b + 1], grid[a + 1][b]]
            if flip:
                quad.reverse()
            try:
                f = bm.faces.new(quad)
            except ValueError:
                continue
            f.material_index = keys.index(mk)
            f.smooth = smooth
            for lp in f.loops:
                co = lp.vert.co
                row = a if lp.vert in grid[a] else a + 1
                col = grid[row].index(lp.vert)
                s_ = sa if row == a else sb
                t = tile or TILE[M[mk].name]
                if mk == "kerb":
                    lp[uv].uv = (col - b, s_ / KERB_CYCLE)
                elif uvmode == "wall":
                    lp[uv].uv = (s_ / t, prof[row][col] / t)
                elif uvmode == "strip":
                    lp[uv].uv = (s_ / t, col - b)
                else:
                    lp[uv].uv = (co.x / t, co.y / t)
                if colr:
                    lp[colr] = (*vcol(idxs[a + (row - a)] % N, lats[row][col]), 1.0)
            if collide and mk in SURF_OF:
                ks = [(name, idxs[a], b), (name, idxs[a], b + 1), (name, idxs[a + 1], b + 1), (name, idxs[a + 1], b)]
                if flip:
                    ks.reverse()
                col_quad(SURF_OF[mk], ks, [v.co.copy() for v in quad])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for k in keys:
        me.materials.append(M[k])
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    return ob


def runs(flags, closed_ok=True):
    """Consecutive index runs where flags[i] is truthy, as lists of indices (a full loop comes back closed)."""
    if all(flags):
        return [list(range(N)) + [N]] if closed_ok else [list(range(N))]
    start = next(i for i in range(N) if not flags[i])
    out, cur = [], []
    for k in range(1, N + 1):
        i = (start + k) % N
        if flags[i]:
            cur.append(i)
        elif cur:
            out.append(cur); cur = []
    if cur:
        out.append(cur)
    return out


# ------------------------------------------------------------------------------------------------ the track surface

SUB = 8          # asphalt columns per side (~0.85 m): enough lateral detail for the rubbered line
TURF_W = 2.0     # astroturf strip behind every corner kerb


def crown_z(i, lat):
    return 0.004 + (CROWN - 0.004) * max(0.0, 1 - abs(lat) / (HW[i] - L.LINE_W))


def track_cols(i):
    hw, k = HW[i], L.KERB_W
    kerbL, kerbR = SD["kerb"]["L"][i], SD["kerb"]["R"][i]
    w = hw - L.LINE_W
    asph = [(w - 2 * w * t / (2 * SUB), crown_z(i, w - 2 * w * t / (2 * SUB))) for t in range(2 * SUB + 1)]
    turfL = min(hw + k + TURF_W, SD["runoffL"][i] - 0.4)
    turfR = min(hw + k + TURF_W, SD["runoffR"][i] - 0.4)
    stripeL = min(turfL + 3.0, SD["runoffL"][i] - 0.2)          # teal band, then deep blue beyond, on tarmac run-off
    stripeR = min(turfR + 3.0, SD["runoffR"][i] - 0.2)
    return ([(SD["runoffL"][i], -0.02), (stripeL, -0.015), (turfL, -0.01), (hw + k, 0.03 if kerbL else 0.0), (hw, 0.0)] + asph +
            [(-hw, 0.0), (-(hw + k), 0.03 if kerbR else 0.0), (-turfR, -0.01), (-stripeR, -0.015), (-SD["runoffR"][i], -0.02)])


PAINT = {"tarmac": ("paint_blue", "paint_teal")}               # run-off kind -> (outer band, inner band)


def track_bands(i, b):
    kL, kR = SD["kerb"]["L"][i], SD["kerb"]["R"][i]
    oL, iL = PAINT.get(SD["kind"]["L"][i], (SD["kind"]["L"][i],) * 2)
    oR, iR = PAINT.get(SD["kind"]["R"][i], (SD["kind"]["R"][i],) * 2)
    bands = ([oL, iL, "turf" if kL else iL, "kerb" if kL else "paint_teal", "line"] +
             ["asphalt"] * (2 * SUB) + ["line", "kerb" if kR else "paint_teal", "turf" if kR else iR, iR, oR])
    return bands[b]


def rubber(i, lat):
    """Asphalt tint: darker where tyres run (two wheel tracks either side of the racing line, heavier under braking),
    lighter and dustier off-line toward the edges, plus slow resurfacing patches."""
    d = lat - RL[i]
    g = lambda x, s: math.exp(-(x / s) ** 2)
    r = (0.6 * (g(d - 0.8, 0.55) + g(d + 0.8, 0.55)) + 0.35 * g(d, 1.4)) * (0.55 + 0.45 * BZ[i])
    dust = max(0.0, abs(lat) - (HW[i] - 2.2)) / 2.2
    x, y = L.offset(C, i, lat)
    patch = 0.05 * noise.noise(Vector((x / 70.0, y / 70.0, 1.3)))
    v = max(0.0, min(1.0, 0.9 * (1 - 0.5 * min(1.0, r)) + 0.1 * dust + patch))
    if abs(lat) > HW[i] - 0.05:
        # kerb: where the line runs to this edge, tyres ride and blacken the kerb's inner half; the paint is sun-faded
        same_side = (lat > 0) == (RL[i] > 0)
        near = max(0.0, 1 - (HW[i] - abs(RL[i])) / 2.2) if same_side else 0.0
        inner = math.exp(-((abs(lat) - HW[i]) / 0.7) ** 2)
        fade = 0.09 * noise.noise(Vector((x / 9.0, y / 9.0, 4.1)))
        v = max(0.0, min(1.0, 0.94 - 0.5 * near * inner + fade))
    return (v, v, v * 0.985)


CHUNKS = 16    # separate objects so the browser can frustum-cull the lap piece by piece
step = math.ceil(N / CHUNKS)
for ch in range(CHUNKS):
    a, b = ch * step, min(N, (ch + 1) * step)
    ribbon(f"track_{ch:02d}", list(range(a, b + 1)), track_cols, track_bands, VIS, vcol=rubber)


def skid_texture():
    """Two lanes of tyre streaks (u = along the track, v = across a 2.5 m strip), alpha-blended over the asphalt."""
    import random
    rnd = random.Random(11)
    W, H = 1024, 64
    streaks = []
    for lane in (0.18, 0.82):
        for _ in range(9):
            streaks.append((lane + rnd.uniform(-0.07, 0.07), rnd.uniform(0.006, 0.02), rnd.uniform(0, 1), rnd.uniform(0.2, 0.7),
                            rnd.uniform(0.25, 0.75)))
    im = bpy.data.images.new("skid_marks", W, H, alpha=True)
    px = []
    for j in range(H):
        v = (j + 0.5) / H
        for i_ in range(W):
            u = (i_ + 0.5) / W
            a = 0.0
            for c0, wd, start, length, dark in streaks:
                along = (u - start) % 1.0
                if along < length and abs(v - c0) < wd:
                    fade = min(1.0, along / 0.05, (length - along) / 0.15)
                    a = max(a, dark * fade)
            px += [0.015, 0.015, 0.017, a]
    im.pixels = px
    os.makedirs(os.path.join(OUT, "textures"), exist_ok=True)
    im.filepath_raw = os.path.join(OUT, "textures", "skid_marks.png")
    im.file_format = "PNG"
    im.save()
    m = pbr("M_SkidMarks", color=(0.015, 0.015, 0.017), rough=0.65, tile=24.0)   # matte: glossy streaks mirrored the sky
    nt = m.node_tree
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(t.outputs["Alpha"], nt.nodes["Principled BSDF"].inputs["Alpha"])   # direct alpha -> glTF BLEND
    return m


M["skid"] = skid_texture()
for k in L.corners(C):
    if k["radius"] >= 100:
        continue
    zone = [i for i in range(k["start"] - 40, k["start"] + k["count"] // 2) if BZ[i % N] > 0.12 or i >= k["start"]]
    ribbon(f"skid_{k['id']}", zone, lambda i: [(RL[i] + 1.25, crown_z(i, RL[i] + 1.25) + 0.006),
                                               (RL[i] - 1.25, crown_z(i, RL[i] - 1.25) + 0.006)],
           lambda i, b: "skid", VIS, collide=False, uvmode="strip")


def decal(name, i, along0, along1, lat0, lat1, mat, collection, flat=None):
    """A thin painted rectangle that follows the road crown (or a flat z), along0..along1 m from sample i."""
    bm = bmesh.new()
    h = C["heading"][i]
    fx, fy = math.cos(h), math.sin(h)
    lats = [lat0 + (lat1 - lat0) * t / 6 for t in range(7)]
    rows = []
    for al in (along0, along1):
        row = []
        for lat in lats:
            x, y = L.offset(C, i, lat)
            z = (flat if flat is not None else crown_z(i, lat)) + 0.008
            row.append(bm.verts.new((x + fx * al, y + fy * al, z)))
        rows.append(row)
    for k in range(6):
        bm.faces.new([rows[0][k + 1], rows[0][k], rows[1][k], rows[1][k + 1]] if lat0 < lat1 else
                     [rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    me.materials.append(M[mat])
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    return ob


decal("sf_line", 0, -0.5, 0.5, HW[0] - L.LINE_W, -(HW[0] - L.LINE_W), "line", VIS)
for g in L.grid_slots(C):
    lat = 3.0 if g["slot"] % 2 else -3.0
    decal(f"grid_{g['slot']}", g["idx"], 0.0, 0.3, lat + 1.1, lat - 1.1, "line", VIS)

def crack_material():
    """Hairline crack networks plus wider tar-sealed lines (the black 'snakes' resealed tracks are covered in)."""
    import random
    rnd = random.Random(17)
    W = 512
    alpha = [0.0] * (W * W)

    def stamp(x, y, r, a):
        for yy in range(int(y - r), int(y + r) + 1):
            for xx in range(int(x - r), int(x + r) + 1):
                if (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                    k = (yy % W) * W + (xx % W)
                    alpha[k] = max(alpha[k], a)

    def walk(x, y, ang, steps, r, a, wander, branch):
        for s in range(steps):
            ang += rnd.uniform(-wander, wander)
            x, y = x + math.cos(ang) * 1.5, y + math.sin(ang) * 1.5
            stamp(x, y, r, a)
            if branch and rnd.random() < 0.012:
                walk(x, y, ang + rnd.choice((-1, 1)) * rnd.uniform(0.6, 1.2), steps // 3, max(0.6, r * 0.7), a * 0.9, wander, False)
    for _ in range(14):
        walk(rnd.uniform(0, W), rnd.uniform(0, W), rnd.uniform(0, 2 * math.pi), rnd.randint(80, 220), 0.9, 0.75, 0.35, True)
    for _ in range(3):
        walk(rnd.uniform(0, W), rnd.uniform(0, W), rnd.uniform(0, 2 * math.pi), rnd.randint(150, 300), 3.2, 0.95, 0.12, False)
    im = bpy.data.images.new("asphalt_cracks", W, W, alpha=True)
    px = []
    for a in alpha:
        px += [0.012, 0.012, 0.014, a]
    im.pixels = px
    im.filepath_raw = os.path.join(OUT, "textures", "asphalt_cracks.png")
    im.file_format = "PNG"
    im.save()
    m = pbr("M_Cracks", color=(0.012, 0.012, 0.014), rough=0.45)
    nt = m.node_tree
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(t.outputs["Alpha"], nt.nodes["Principled BSDF"].inputs["Alpha"])   # glTF BLEND
    return m


def surface_decals():
    """Cracks and resurfaced patches as thin grids that follow the crown, merged into one mesh each."""
    import random
    rnd = random.Random(23)
    crack_m = crack_material()
    patch_m = pbr("M_AsphaltPatch", "asphalt_pit_lane", tile=3.0)
    multiply_by_vertex_color(patch_m)
    for name, mat, count, zoff in (("asphalt_patches", patch_m, 24, 0.003), ("asphalt_cracks", crack_m, 170, 0.0045)):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        col = bm.loops.layers.color.new("Col")
        for _ in range(count):
            i = rnd.randrange(N)
            if name == "asphalt_patches":
                al, wd, rot, g = rnd.uniform(4, 9), rnd.uniform(2.5, 5.5), 0.0, (4, 3)
                latc = rnd.uniform(-1, 1) * (HW[i] - L.LINE_W - wd / 2 - 0.2)
            else:
                al = wd = rnd.uniform(3.0, 4.5)
                rot, g = rnd.uniform(0, math.pi), (4, 4)
                latc = rnd.uniform(-1, 1) * max(0.0, HW[i] - 3.4)
            h = C["heading"][i]
            fx, fy, lx, ly = math.cos(h), math.sin(h), -math.sin(h), math.cos(h)
            px, py = C["points"][i]
            verts = []
            for b in range(g[1] + 1):
                row = []
                for a in range(g[0] + 1):
                    du, dv = (a / g[0] - 0.5) * al, (b / g[1] - 0.5) * wd
                    along = du * math.cos(rot) - dv * math.sin(rot)
                    lat = latc + du * math.sin(rot) + dv * math.cos(rot)
                    co = (px + fx * along + lx * lat, py + fy * along + ly * lat, crown_z(i, lat) + zoff)
                    row.append((bm.verts.new(co), (a / g[0], b / g[1])))
                verts.append(row)
            for b in range(g[1]):
                for a in range(g[0]):
                    q = [verts[b][a], verts[b][a + 1], verts[b + 1][a + 1], verts[b + 1][a]]
                    f = bm.faces.new([v for v, _ in q])
                    f.normal_update()
                    if f.normal.z < 0:
                        f.normal_flip()
                    for lp in f.loops:
                        uvw = next(t for v, t in q if v is lp.vert)
                        lp[uv].uv = uvw if name == "asphalt_cracks" else (lp.vert.co.x / 3.0, lp.vert.co.y / 3.0)
                        lp[col] = (0.62, 0.62, 0.63, 1.0)       # patches: newer, darker asphalt
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me); bm.free()
        me.materials.append(mat)
        VIS.objects.link(bpy.data.objects.new(name, me))


surface_decals()

# ------------------------------------------------------------------------------------------------ pit lane

pd = PIT["offset"]
lane = PIT["indices"]


def pit_cols(i):
    right = max(HW[i] + L.KERB_W, pd[i] - L.PIT_HALF)
    left = pd[i] + L.PIT_HALF
    mid = max(pd[i], right + 0.5)
    return [(left, 0.0), (left - 0.25, 0.0), (mid, 0.0), (right + 0.25, -0.015), (right, -0.02)]


# one extra sample each end tucks the pit lane over the run-off's diagonal edge, so no gap opens where they meet
ribbon("pit_lane", [lane[0] - 1] + lane + [lane[-1] + 1], pit_cols, lambda i, b: ["line", "pit", "pit", "line"][b], VIS)
for name, i in (("pit_limiter_in", PIT["limiterIn"]), ("pit_limiter_out", PIT["limiterOut"])):
    decal(name, i, -0.3, 0.3, pd[i] + L.PIT_HALF - 0.3, pd[i] - L.PIT_HALF + 0.3, "line", VIS, flat=0.0)
for bx in PIT["boxes"]:   # yellow box outlines on the working lane
    i, lat = bx["idx"], pd[bx["idx"]] + 3.0
    for nm, a0, a1, l0, l1 in (("f", 2.8, 3.0, lat + 1.4, lat - 1.4), ("b", -3.0, -2.8, lat + 1.4, lat - 1.4),
                               ("l", -3.0, 3.0, lat + 1.4, lat + 1.2), ("r", -3.0, 3.0, lat - 1.2, lat - 1.4)):
        decal(f"box_{bx['id']}_{nm}", i, a0, a1, l0, l1, "yellow", VIS, flat=0.0)

# ------------------------------------------------------------------------------------------------ walls

JERSEY = [(0, 0), (0, 0.075), (0.15, 0.33), (0.23, 0.81), (0.38, 0.81), (0.46, 0.33), (0.61, 0.075), (0.61, 0)]


def wall(name, idxs, base, sg, profile=JERSEY, mat="concrete", collide_h=1.0, **kw):
    """Extrude a profile (outward o, z) along a run; base(i) = lateral distance of the wall's track face; sg=+1 left."""
    kw.setdefault("uvmode", "wall")
    ob = ribbon(name, idxs, lambda i: [(sg * (base(i) + o), z) for o, z in profile],
                lambda i, b: mat, VIS, flip=sg > 0, smooth=False, collide=False, **kw)
    for a in range(len(idxs) - 1 if collide_h else 0):   # collision: one vertical quad per step on the track face
        i, j = idxs[a] % N, idxs[a + 1] % N
        cos = [at(i, sg * base(i), -0.1), at(j, sg * base(j), -0.1), at(j, sg * base(j), collide_h), at(i, sg * base(i), collide_h)]
        col_quad("col_wall", [(name, idxs[a], 0), (name, idxs[a + 1], 0), (name, idxs[a + 1], 1), (name, idxs[a], 1)], cos)
    return ob


for side, sg in (("L", 1), ("R", -1)):
    w = SD["wall"][side]
    for r, idxs in enumerate(runs([v is not None for v in w])):
        if len(idxs) > 2:
            wall(f"wall_{side}_{r}", idxs, lambda i, w=w: w[i % N], sg, mat="barrier")
pit_wall_idx = [i for i in lane if pd[i] >= L.PIT_OFFSET - 0.05]
wall("pit_wall", pit_wall_idx, lambda i: pd[i] - L.PIT_HALF - 0.7, 1)

# ------------------------------------------------------------------------------------------------ street aprons, water, ground

street_runs = runs(SD["street"])
for r, idxs in enumerate(street_runs):
    idxs = [idxs[0] - 1] + idxs + [idxs[-1] + 1]
    ribbon(f"apron_R_{r}", idxs, lambda i: [(-(SD["wall"]["R"][i] + 0.62), -0.02), (-L.QUAY, -0.02)],
           lambda i, b: "paved", VIS)
    ribbon(f"apron_L_{r}", idxs, lambda i: [(SD["wall"]["L"][i] + 6.5, -0.02), (SD["wall"]["L"][i] + 0.62, -0.02)],
           lambda i, b: "paved", VIS)

poly = L.water_polygon(C)


def quay_wall():
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    ring = poly + [poly[0]]
    s = 0.0
    for p0, p1 in zip(ring, ring[1:]):
        d = math.dist(p0, p1)
        vs = [bm.verts.new((p0[0], p0[1], -0.02)), bm.verts.new((p1[0], p1[1], -0.02)),
              bm.verts.new((p1[0], p1[1], -2.5)), bm.verts.new((p0[0], p0[1], -2.5))]
        f = bm.faces.new(vs)
        f.material_index = 0
        for lp, (u, v) in zip(f.loops, ((s, 0), (s + d, 0), (s + d, 2.48), (s, 2.48))):
            lp[uv].uv = (u / 2.5, v / 2.5)
        s += d
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("quay")
    bm.to_mesh(me); bm.free()
    me.materials.append(pbr("M_Quay", "brushed_concrete", tile=2.5, double=True))   # seen from land and water
    ob = bpy.data.objects.new("quay", me)
    VIS.objects.link(ob)


quay_wall()

xs = [p[0] for p in C["points"]]
ys = [p[1] for p in C["points"]]
X0, X1, Y0, Y1 = min(xs) - 600, max(xs) + 600, min(ys) - 600, max(ys) + 600
CELL = 25.0


def ground():
    """Desert island: a flat grid that slopes into the sea at its rim, with the marina basin cut out exactly."""
    bm = bmesh.new()
    nx, ny = int((X1 - X0) / CELL), int((Y1 - Y0) / CELL)
    vs = [[None] * (ny + 1) for _ in range(nx + 1)]
    for a in range(nx + 1):
        for b in range(ny + 1):
            rim = a in (0, nx) or b in (0, ny)
            vs[a][b] = bm.verts.new((X0 + a * CELL, Y0 + b * CELL, -2.5 if rim else GROUND_Z))
    for a in range(nx):
        for b in range(ny):
            f = bm.faces.new([vs[a][b], vs[a + 1][b], vs[a + 1][b + 1], vs[a][b + 1]])
            f.smooth = True
    me = bpy.data.meshes.new("ground")
    bm.to_mesh(me); bm.free()
    me.materials.append(M["ground"])
    ob = bpy.data.objects.new("ground", me)
    VIS.objects.link(ob)
    # the basin: boolean difference with the water polygon extruded into a prism
    pb = bmesh.new()
    bot = [pb.verts.new((x, y, -10)) for x, y in poly]
    face = pb.faces.new(bot)
    ext = bmesh.ops.extrude_face_region(pb, geom=[face])
    for v in ext["geom"]:
        if isinstance(v, bmesh.types.BMVert):
            v.co.z = 10
    bmesh.ops.recalc_face_normals(pb, faces=pb.faces)
    pm = bpy.data.meshes.new("basin_cutter")
    pb.to_mesh(pm); pb.free()
    cutter = bpy.data.objects.new("basin_cutter", pm)
    scene.collection.objects.link(cutter)
    mod = ob.modifiers.new("basin", "BOOLEAN")
    mod.operation, mod.object, mod.solver = "DIFFERENCE", cutter, "EXACT"
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    ob.data = baked
    baked.name = "ground"
    bpy.data.objects.remove(cutter)
    # world-space UVs and the coarse collision copy
    bm = bmesh.new()
    bm.from_mesh(baked)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x / TILE["M_Ground"], lp.vert.co.y / TILE["M_Ground"])
        col_quad("col_sand", [("ground", v.index) for v in f.verts], [v.co.copy() for v in f.verts])
    bm.to_mesh(baked); bm.free()
    # macro variation: ~200 m patches of lighter/darker sand so the 15 m texture never reads as a grid from the air
    from mathutils import noise
    ca = baked.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    for v in baked.vertices:
        n = noise.fractal(Vector((v.co.x / 230.0, v.co.y / 230.0, 0.37)), 0.7, 2.0, 3)
        t = max(0.0, min(1.0, 0.55 + 0.45 * n))
        ca.data[v.index].color = (0.62 + 0.38 * t, 0.6 + 0.37 * t, 0.58 + 0.36 * t, 1.0)
    return ob


ground()


def water():
    bm = bmesh.new()
    r = 6000
    bm.faces.new([bm.verts.new((x, y, WATER_Z)) for x, y in ((-r, -r), (r, -r), (r, r), (-r, r))])
    me = bpy.data.meshes.new("water")
    bm.to_mesh(me); bm.free()
    me.materials.append(M["water"])
    ob = bpy.data.objects.new("water", me)
    ob["surface"] = "water"   # glTF extras: the engine swaps in its water shader
    VIS.objects.link(ob)


water()

# ------------------------------------------------------------------------------------------------ buildings: grandstand, garages, gantry

STAND = [(0, 0), (0, 1.2)]
for r in range(18):
    o, z = STAND[-1]
    STAND += [(o + 0.85, z), (o + 0.85, z + 0.45)]
STAND += [(STAND[-1][0], 0)]
main_idx = [i for i in range(N) if C["seg"][i] == 0]
stand_idx = [i % N for i in range(-45, 46)]          # ~400 m centred on the line, grandstand side (right)
wall("grandstand", stand_idx, lambda i: SD["wall"]["R"][i] + 3.0, -1, profile=STAND, collide_h=0)
# (its roof is a row of tensile tents, built with the other stands' in venue.py)

k0 = pit_wall_idx.index(PIT["boxes"][0]["idx"])
k1 = pit_wall_idx.index(PIT["boxes"][-1]["idx"])
garage_idx = pit_wall_idx[max(0, k0 - 6):k1 + 7]   # the building spans the boxes, not the whole straight
GARAGE = [(0, 0), (0, 8.0), (16.0, 8.0), (16.0, 0)]
wall("garages", garage_idx, lambda i: pd[i] + L.PIT_HALF + 2.0, 1, profile=GARAGE, collide_h=0)
for bx in PIT["boxes"]:
    i = bx["idx"]
    h = C["heading"][i]
    bm = bmesh.new()
    lat = pd[i] + L.PIT_HALF + 1.97
    x, y = L.offset(C, i, lat)
    fx, fy = math.cos(h), math.sin(h)
    # wound so the face looks out onto the pit lane (the other order faced into the garage and was culled)
    vs = [bm.verts.new((x + fx * a, y + fy * a, z)) for a, z in ((-5, 0), (5, 0), (5, 5.2), (-5, 5.2))]
    bm.faces.new(vs)
    me = bpy.data.meshes.new(f"garage_door_{bx['id']}")
    bm.to_mesh(me); bm.free()
    me.materials.append(M["door"])
    ob = bpy.data.objects.new(me.name, me)
    VIS.objects.link(ob)


def box(name, center, size, yaw, mat, collection):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    me.materials.append(M[mat])
    ob = bpy.data.objects.new(name, me)
    ob.location = center
    ob.rotation_euler = (0, 0, yaw)
    collection.objects.link(ob)
    return ob


h0 = C["heading"][0]
span = HW[0] + 4.0
for nm, lat in (("gantry_post_L", span), ("gantry_post_R", -span)):
    x, y = L.offset(C, 0, lat)
    box(nm, (x, y, 4.0), (0.8, 0.8, 8.0), h0, "metal", VIS)
x, y = L.offset(C, 0, 0)
box("gantry_beam", (x, y, 7.2), (0.9, 2 * span + 0.8, 1.4), h0, "metal", VIS)
box("gantry_lights", (x - math.cos(h0) * 0.47, y - math.sin(h0) * 0.47, 6.9), (0.05, 6.0, 0.5), h0, "lamp", VIS)

column = None
for k, i in enumerate(stand_idx[::12]):   # cantilever roof: columns along the back of the stand (linked copies)
    x, y = L.offset(C, i, -(SD["wall"]["R"][i] + 3.0 + STAND[-1][0] + 0.3))
    if column is None:
        column = box("stand_column_00", (x, y, 7.0), (0.5, 0.5, 14.0), C["heading"][i], "metal", VIS)
        continue
    ob = bpy.data.objects.new(f"stand_column_{k:02d}", column.data)
    ob.location, ob.rotation_euler = (x, y, 7.0), (0, 0, C["heading"][i])
    VIS.objects.link(ob)

# ------------------------------------------------------------------------------------------------ floodlights (one mesh, linked copies)

def floodlight_mesh(name, lamp_mat):
    """Mast, a dark lamp housing with six small lamp units on its track face (one big glowing panel read as a blob
    in the sky), and a red aviation beacon on top: tall masts by a marina and a city carry them for real."""
    from mathutils import Matrix
    fb = bmesh.new()
    bmesh.ops.create_cone(fb, cap_ends=True, segments=10, radius1=0.32, radius2=0.2, depth=20.0, matrix=Matrix.Translation((0, 0, 10)))
    for f in fb.faces:
        f.material_index = 0
    def cube(center, size, mat):
        r = bmesh.ops.create_cube(fb, size=1.0, matrix=Matrix.Translation(center) @ Matrix.Diagonal((*size, 1)))
        for f in {f for v in r["verts"] for f in v.link_faces}:
            f.material_index = mat
    cube((0, 0.45, 20.4), (4.2, 0.5, 1.5), 0)                     # housing
    for row, z in enumerate((20.05, 20.75)):
        for k in range(3):
            cube((-1.35 + k * 1.35, 0.72, z), (0.75, 0.06, 0.5), 1)   # lamp units, angled light comes from the engine
    cube((0, 0.0, 21.35), (0.24, 0.24, 0.3), 2)                   # beacon
    me = bpy.data.meshes.new(name)
    fb.to_mesh(me); fb.free()
    for m in (M["metal"], lamp_mat, M["beacon"]):
        me.materials.append(m)
    return me


M["beacon"] = pbr("M_Beacon", color=(0.9, 0.03, 0.02), emit=((1.0, 0.04, 0.02), 6.0))   # blinks in the engine
FLOOD = {"warm": floodlight_mesh("floodlight_warm", pbr("M_LampWarm", color=(1, 0.86, 0.66), emit=((1.0, 0.82, 0.6), 4.0))),
         "cool": floodlight_mesh("floodlight_cool", pbr("M_LampCool", color=(0.92, 0.96, 1.0), emit=((0.88, 0.94, 1.0), 4.0)))}
count = 0
for side, sg in (("L", 1), ("R", -1)):
    for i in range(0 if side == "L" else 8, N, 16):
        wd = SD["wall"][side][i]
        if wd is None or SD["street"][i]:
            continue
        x, y = L.offset(C, i, sg * (wd + 3.0))
        kind = "warm" if (count // 2) % 2 == 0 else "cool"            # pairs alternate, like mixed lamp batches
        ob = bpy.data.objects.new(f"floodlight_{count:03d}", FLOOD[kind])
        ob["lamp"] = kind
        h = C["heading"][i]
        ob.location = (x, y, 0)
        ob.rotation_euler = (0, 0, h + (math.pi if sg > 0 else 0))   # local +y faces the track
        VIS.objects.link(ob)
        count += 1
print("floodlights:", count)

# street lamps along the marina promenade (Poly Haven model, linked copies)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(PH, "street_lamp_01", "street_lamp_01_1k.gltf"))
imported = [o for o in bpy.data.objects if o not in before]
lamp_src = [o for o in imported if o.type == "MESH"]
if lamp_src:
    src = lamp_src[0]
    for o in imported:
        if o is not src:
            bpy.data.objects.remove(o)
    src.parent = None
    # web budget: the source lamp is ~30k tris; ~6% keeps the silhouette and costs ~1.8k per copy
    dec = src.modifiers.new("lod", "DECIMATE")
    dec.ratio = 0.06
    lo = bpy.data.meshes.new_from_object(src.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    src.modifiers.clear()
    src.data = lo
    tops = [v.co for v in src.data.vertices if v.co.z > max(w.co.z for w in src.data.vertices) - 0.6]
    arm_x = sum(v.x for v in tops) / len(tops)   # which way the lamp arm points in the model
    for c_ in src.users_collection:
        c_.objects.unlink(src)
    k = 0
    for idxs in street_runs:
        for i in idxs[::7]:
            x, y = L.offset(C, i, -(L.QUAY - 1.5))
            ob = bpy.data.objects.new(f"street_lamp_{k:03d}", src.data)
            # point the arm back toward the track (the track is to the left of this lamp)
            to_track = C["heading"][i] + math.pi / 2
            ob.location = (x, y, -0.02)
            ob.rotation_euler = (0, 0, to_track - (0 if arm_x > 0 else math.pi))
            VIS.objects.link(ob)
            k += 1
    bpy.data.objects.remove(src)
    print("street lamps:", k)

# ------------------------------------------------------------------------------------------------ art pass

import dress  # noqa: E402
import venue  # noqa: E402
import backdrop  # noqa: E402
import paddock  # noqa: E402
import vip  # noqa: E402
import life  # noqa: E402
import trackside  # noqa: E402
dress.run(globals())
venue.run(globals())
backdrop.run(globals())
paddock.run(globals())
vip.run(globals())
life.run(globals())
trackside.run(globals())

# ------------------------------------------------------------------------------------------------ collision objects

for surface, (bm, _) in COLLISION.items():
    me = bpy.data.meshes.new(surface)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(surface, me)
    ob["surface"] = surface[4:]
    COL.objects.link(ob)
    ob.hide_render = True

# ------------------------------------------------------------------------------------------------ export

L.export_json(C, os.path.join(OUT, "track.json"), sd=SD, landmarks=trackside.LANDMARKS)


def export(path, objs, **kw):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_extras=True, **kw)


export(os.path.join(OUT, "marina_visual.glb"), list(VIS.all_objects), export_gpu_instances=True)
export(os.path.join(OUT, "marina_collision.glb"), list(COL.all_objects), export_materials="NONE",
       export_texcoords=False, export_normals=False)

tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in VIS.all_objects if o.type == "MESH")
by_mesh = {}
for o in VIS.all_objects:
    if o.type == "MESH":
        key = o.data.name.split("_")[0] if o.data.users > 1 else o.data.name.rstrip("0123456789_.")
        by_mesh[key] = by_mesh.get(key, 0) + sum(len(p.vertices) - 2 for p in o.data.polygons)
def export_lights(path):
    """Where the venue's lights are, in game coordinates (Y up), for the engine: it cannot afford a real light per lamp,
    so it moves a handful of real lights to the nearest of these and fakes the rest with emissive + bloom."""
    import json
    g = lambda v: L.to_game(v.x, v.y, v.z)
    out = {"floodlights": [], "standLamps": [], "streetLamps": []}
    for ob in [o for o in VIS.objects if o.name.startswith("floodlight_")]:
        t = ob.rotation_euler.z
        d = Vector((-math.sin(t), math.cos(t), 0))
        head = ob.location + d * 0.9 + Vector((0, 0, 20.2))
        aim = ob.location + d * 30
        out["floodlights"].append({"pos": g(head), "target": g(aim), "warm": ob.get("lamp") == "warm"})
    for name, (idxs, base, sg) in venue.STANDS.items():
        for i in idxs[1::3]:
            i %= N
            head = Vector((*L.offset(C, i, sg * (base(i) - 1.6)), 12.4))
            aim = Vector((*L.offset(C, i, sg * (base(i) - 22)), 0.0))
            out["standLamps"].append({"pos": g(head), "target": g(aim)})
    for ob in [o for o in VIS.objects if o.name.startswith("street_lamp_")]:
        out["streetLamps"].append({"pos": g(ob.location + Vector((0, 0, 3.6)))})
    with open(path, "w", encoding="utf8") as f:
        json.dump(out, f, separators=(",", ":"))
    print("lights.json:", {k: len(v) for k, v in out.items()})


export_lights(os.path.join(OUT, "lights.json"))
print("tris drawn by group:", ", ".join(f"{k} {v:,}" for k, v in sorted(by_mesh.items(), key=lambda kv: -kv[1])[:10]))
uniq = {o.data.name: o for o in VIS.all_objects if o.type == "MESH"}
tris_unique = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in uniq.values())
print(f"visual: {len(VIS.all_objects)} objects, {tris:,} tris drawn ({tris_unique:,} unique), "
      f"collision: {sum(len(o.data.polygons) for o in COL.all_objects):,} faces")

# ------------------------------------------------------------------------------------------------ preview renders

# The game's lighting looks (it is mostly raced at dusk, blue hour and night). Preview lights stand in for what the
# engine does with a few real lights plus baked/faked light; they live in their own collection and are never exported.
LOOKS = {
    "dusk":     dict(hdri="belfast_sunset_puresky", strength=1.0, rot=205, lights=0.0, exposure=0.0),
    "bluehour": dict(hdri="qwantani_dusk_1_puresky", strength=0.35, rot=150, lights=0.6, exposure=0.0),
    "night":    dict(hdri="qwantani_night_puresky", strength=0.06, rot=150, lights=1.0, exposure=0.0),
}
LOOK_NAME = ARGS[ARGS.index("--look") + 1] if "--look" in ARGS else "dusk"
LOOK = LOOKS[LOOK_NAME]
world = bpy.data.worlds.new(LOOK_NAME)
scene.world = world
world.use_nodes = True
env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(PH, LOOK["hdri"], f"{LOOK['hdri']}_2k.hdr"))
world.node_tree.links.new(env.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
world.node_tree.nodes["Background"].inputs["Strength"].default_value = LOOK["strength"]
mapping = world.node_tree.nodes.new("ShaderNodeMapping")
coord = world.node_tree.nodes.new("ShaderNodeTexCoord")
world.node_tree.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
world.node_tree.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(LOOK["rot"]))

PRE = coll("PreviewLights")


def preview_light(name, kind, loc, power, color, target=None, size_deg=70.0):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = power
    ld.color = color
    ld.shadow_soft_size = 0.6
    if kind == "SPOT":
        ld.spot_size, ld.spot_blend = math.radians(size_deg), 0.55
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    if target is not None:
        ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    PRE.objects.link(ob)


if LOOK["lights"] > 0:
    k = LOOK["lights"]
    for ob in [o for o in VIS.objects if o.name.startswith("floodlight_")]:
        t = ob.rotation_euler.z
        d = Vector((-math.sin(t), math.cos(t), 0))              # local +Y: the way the lamp head faces
        head = ob.location + d * 0.9 + Vector((0, 0, 20.2))
        preview_light(f"pl_{ob.name}", "SPOT", head, 16000 * k, (1.0, 0.95, 0.88), ob.location + d * 30, 80)
    for ob in [o for o in VIS.objects if o.name.startswith("street_lamp_")]:
        preview_light(f"pl_{ob.name}", "POINT", ob.location + Vector((0, 0, 3.6)), 1800 * k, (1.0, 0.78, 0.5))
    for name, (idxs, base, sg) in venue.STANDS.items():        # lamp rows under the stand roofs: track and crowd
        for i in idxs[1::3]:
            i %= N
            head = Vector((*L.offset(C, i, sg * (base(i) - 1.6)), 12.4))
            preview_light(f"pl_{name}_{i}_t", "SPOT", head, 11000 * k, (1.0, 0.96, 0.9),
                          Vector((*L.offset(C, i, sg * (base(i) - 22)), 0.0)), 75)
            preview_light(f"pl_{name}_{i}_c", "SPOT", head, 2600 * k, (1.0, 0.92, 0.8),
                          Vector((*L.offset(C, i, sg * (base(i) + 8)), 4.0)), 85)
    print("preview lights:", len(PRE.objects))


def camera(name, eye, target, lens=28):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_end = 8000
    ob = bpy.data.objects.new(name, cam)
    ob.location = eye
    ob.rotation_euler = (Vector(target) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
    CAMS.objects.link(ob)
    return ob


def along(i, back, lat, z):
    h = C["heading"][i % N]
    x, y = L.offset(C, i % N, lat)
    return (x - math.cos(h) * back, y - math.sin(h) * back, z)


cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
t11 = next(k for k in L.corners(C) if k["id"] == "T11")
t6 = next(k for k in L.corners(C) if k["id"] == "T6")
runb = L._seg_range(C, "Marina Run B")
t1c = next(k for k in L.corners(C) if k["id"] == "T1")
t7c = next(k for k in L.corners(C) if k["id"] == "T7")
bsb = L._seg_range(C, "Back Straight B")
hs = L._seg_range(C, "Harbour Straight")
SHOTS = {
    "aerial": camera("cam_aerial", (cx - 300, cy - 2300, 1500), (cx, cy + 50, 0), lens=30),
    "main_straight": camera("cam_main_straight", along(-70, 0, -1.5, 1.4), along(-40, 0, 0.5, 1.0), lens=24),
    "grid": camera("cam_grid", along(25, 0, -9.0, 4.0), along(-6, 0, 2.0, 0.0), lens=24),
    "marina": camera("cam_marina", along(t11["start"] - 18, 0, -2.0, 1.5), along(t11["start"] + 6, 0, -6.0, 1.0), lens=22),
    "braking_t1": camera("cam_braking_t1", along(t1c["start"] - 50, 0, -2.0, 1.4), along(t1c["apexIdx"], 0, 6.0, 0.5), lens=26),
    "stand_t1": camera("cam_stand_t1", along(t1c["apexIdx"] - 6, 0, 4.0, 2.2), along(t1c["apexIdx"] + 2, 0, -40.0, 6.0), lens=22),
    "bridge": camera("cam_bridge", along(bsb[0] + bsb[1] // 2 - 40, 0, 1.5, 1.3), along(bsb[0] + bsb[1] // 2, 0, 0.0, 5.0), lens=26),
    "skyline": camera("cam_skyline", along(hs[0] + 30, 0, -10.0, 16.0), (min(xs) - 2600, cy + 150, 60.0), lens=30),
    "surface": camera("cam_surface", along(t7c["apexIdx"] - 3, 0, -3.0, 18.0), along(t7c["apexIdx"] + 2, 0, -3.0, 0.0), lens=30),
    "hotel": camera("cam_hotel", along(runb[0] + runb[1] // 2 + 10, 0, -2.0, 1.6),
                    (C["points"][(runb[0] + runb[1] // 2) % N][0] + 190.0, C["points"][(runb[0] + runb[1] // 2) % N][1] - 40.0, 38.0), lens=22),
    "paddock": camera("cam_paddock", along(60, 0, 110.0, 30.0), along(5, 0, 50.0, 0.0), lens=28),
    "kerb": camera("cam_kerb", along(t7c["apexIdx"] - 9, 0, -(HW[t7c["apexIdx"]] - 0.6), 0.7), along(t7c["apexIdx"], 0, -HW[t7c["apexIdx"]], 0.0), lens=24),
    "chicane": camera("cam_chicane", along(t7c["start"] - 14, 0, -3.0, 2.2), along(t7c["apexIdx"] + 4, 0, 0.0, 0.0), lens=24),
    "canopy": camera("cam_canopy", along(runb[0] - 4, 0, 2.5, 1.5), along(runb[0] + 14, 0, -1.0, 6.0), lens=20),
    "yacht_close": camera("cam_yacht_close", along(runb[0] + 9, 0, -(L.QUAY - 1.0), 2.2), along(runb[0] + 17, 0, -42.0, 3.0), lens=24),
    "yachts": camera("cam_yachts", along(runb[0] + 18, 0, -95.0, 16.0), along(runb[0] + 12, 0, -12.0, 2.0), lens=24),
    "hairpin": camera("cam_hairpin", along(t6["start"] - 60, 0, 0.0, 30.0), along(t6["apexIdx"], 0, 0.0, 0.0), lens=30),
}

if "--render" in ARGS:
    # Heat: a full Cycles CPU run pinned all 16 threads for 20+ minutes and overheated this PC. Previews now render in
    # EEVEE on the GPU (seconds per frame, and a rasteriser like the browser engine); Cycles only on request, capped
    # to 6 threads. GPU Cycles stays off: this machine's AMD driver has bugchecked under sustained GPU render load.
    try:
        import ctypes   # below-normal priority so the desktop and the fans stay calm
        ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x4000)
    except (AttributeError, OSError):
        pass
    scene.render.threads_mode, scene.render.threads = "FIXED", 6
    ENGINE = ARGS[ARGS.index("--engine") + 1] if "--engine" in ARGS else "eevee"
    if ENGINE == "cycles":
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 32
        scene.cycles.use_denoising = True
    else:
        for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):   # the engine id differs between Blender versions
            try:
                scene.render.engine = eng
                break
            except TypeError:
                continue
        scene.eevee.taa_render_samples = 32
        for prop, val in (("use_raytracing", True), ("use_shadows", True)):
            if hasattr(scene.eevee, prop):
                setattr(scene.eevee, prop, val)
        for ob in PRE.objects:          # hundreds of shadowed preview lights would make EEVEE heavy for nothing
            ob.data.use_shadow = False
    print("render engine:", scene.render.engine, "threads", scene.render.threads)
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = LOOK["exposure"]
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:   # look names differ between Blender versions; the default AgX look is fine
        pass
    # bloom, standing in for the engine's: lamps, LED boards and windows glare like they will in the browser
    ng = bpy.data.node_groups.new("Bloom", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    rl, gl, go = ng.nodes.new("CompositorNodeRLayers"), ng.nodes.new("CompositorNodeGlare"), ng.nodes.new("NodeGroupOutput")
    for key, val in (("Type", "Bloom"), ("Threshold", 2.5), ("Strength", 0.35), ("Size", 0.6)):
        try:
            gl.inputs[key].default_value = val
        except (TypeError, KeyError):
            print("bloom: could not set", key)
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    ng.links.new(gl.outputs["Image"], go.inputs[0])
    scene.compositing_node_group = ng
    os.makedirs(os.path.join(OUT, "previews", LOOK_NAME), exist_ok=True)
    for name, cam in SHOTS.items():
        if ARGS and "--only" in ARGS and name not in ARGS:
            continue
        scene.camera = cam
        scene.render.filepath = os.path.join(OUT, "previews", LOOK_NAME, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", name)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "marina.blend"))
print("saved", os.path.join(OUT, "marina.blend"))
