"""Art pass for the Corniche Marina Circuit: catch fences, kerb sausages, signage, palms, yachts and the Canopy.

Called by build_blender.py (dress.run(globals())) after the base track is built and before export.
All generated: shapes and the few textures (chain-link, palm frond, trunk rings) are made here, so nothing is
hand-placed in the .blend. Every repeated prop is one mesh shared by many objects, which the glTF export and
gltf-transform turn into GPU instances.
Signage is original: the circuit's own name and the game's name only. No real brands.
"""
import math, os, random
from types import SimpleNamespace

import bmesh, bpy
from mathutils import Matrix, Vector

G = None   # the build's globals (C, N, SD, PIT, M, VIS, helpers ...), set by run()


# ------------------------------------------------------------------------------------------------ small helpers

def save_image(name, w, h, pixel):
    """Generate an RGBA image from pixel(x, y) -> (r, g, b, a) with x, y in [0, 1), save it next to the outputs."""
    im = bpy.data.images.new(name, w, h, alpha=True)
    px = []
    for j in range(h):
        for i in range(w):
            px += pixel((i + 0.5) / w, (j + 0.5) / h)
    im.pixels = px
    os.makedirs(os.path.join(G.OUT, "textures"), exist_ok=True)
    im.filepath_raw = os.path.join(G.OUT, "textures", f"{name}.png")
    im.file_format = "PNG"
    im.save()
    return im


def textured(name, im, tile=1.0, rough=0.6, metal=0.0, cutout=False, double=False, emit=None):
    """A material on a generated image; cutout = alpha through Round, which glTF exports as alphaMode MASK."""
    m = G.pbr(name, tile=tile, rough=rough, metal=metal, double=double, emit=emit)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    if cutout:
        r = nt.nodes.new("ShaderNodeMath")
        r.operation = "ROUND"
        nt.links.new(t.outputs["Alpha"], r.inputs[0])
        nt.links.new(r.outputs[0], b.inputs["Alpha"])
    return m


def mesh_from_bm(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    return me


def place(name, me, loc, yaw, scale=1.0, collection=None):
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    ob.rotation_euler = (0, 0, yaw)
    ob.scale = (scale, scale, scale)
    (collection or G.VIS).objects.link(ob)
    return ob


def add_box(bm, center, size, mat=0, rot=None):
    m = Matrix.Translation(center) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1))
    r = bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    for f in {f for v in r["verts"] for f in v.link_faces}:
        f.material_index = mat
    return r


def facing(i, toward_track_from_side):
    """Yaw for a prop whose local -Y face should look at the track from side +1 (left) / -1 (right)."""
    h = G.C["heading"][i % G.N]
    view = h - math.pi / 2 if toward_track_from_side > 0 else h + math.pi / 2   # direction from prop to track
    return view + math.pi / 2


def facing_oncoming(i):
    return G.C["heading"][i % G.N] + math.pi + math.pi / 2


def text_mesh(name, body, size, mat, resolution=3):
    """Flat text as triangles in the XZ plane, facing -Y (readable from -Y), centred, baseline at z=0."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.align_x, cu.align_y = "CENTER", "BOTTOM"
    cu.resolution_u = resolution          # web budget: few points per glyph curve
    ob = bpy.data.objects.new(name, cu)
    G.scene.collection.objects.link(ob)
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    me.transform(Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))))   # (x, y, z) -> (x, -z, y)
    me.materials.append(mat)
    return me


def board_mesh(name, w, h, text, size, panel_mat, text_mat, post=0.0, text_dz=None):
    """A panel (w x h, face at y=0 looking -Y, bottom at z=post) with text just in front; optional post below."""
    tm = text_mesh(name + "_text", text, size, text_mat)
    tz = post + (text_dz if text_dz is not None else (h - size * 0.72) / 2)
    tm.transform(Matrix.Translation((0, -0.03, tz)))
    bm = bmesh.new()
    bm.from_mesh(tm)
    for f in bm.faces:
        f.material_index = 1
    add_box(bm, (0, 0.04, post + h / 2), (w, 0.08, h), mat=0)
    if post:
        add_box(bm, (0, 0.08, post / 2), (0.12, 0.12, post), mat=2)
    bpy.data.meshes.remove(tm)
    return mesh_from_bm(name, bm, [panel_mat, text_mat, G.M["metal"]])


def collide_mesh_instance(surface, me, ob_matrix, key):
    for p in me.polygons:
        cos = [ob_matrix @ me.vertices[v].co for v in p.vertices]
        G.col_quad(surface, [(key, p.index, k) for k in range(len(cos))], cos)


# ------------------------------------------------------------------------------------------------ catch fences

def catch_fences():
    W, H = 128, 128
    cells = 6   # diamonds per tile (tile = 0.5 m -> ~8 cm mesh)

    def chainlink(x, y):
        a, b = (x + y) * cells, (x - y) * cells
        wire = min(a - math.floor(a), 1 - (a - math.floor(a)), b - math.floor(b), 1 - (b - math.floor(b)))
        on = wire < 0.075
        return [0.55, 0.57, 0.6, 1.0 if on else 0.0]
    fence = textured("M_Fence", save_image("chainlink", W, H, chainlink), tile=0.5, rough=0.4, metal=0.9,
                     cutout=True, double=True)
    G.M["fence"] = fence
    profile = [(0.30, 0.81), (0.30, 3.6), (-0.30, 4.15)]     # outward offset, height: overhang leans over the track
    posts = bmesh.new()
    count = 0

    def fence_run(name, idxs, base, sg):
        nonlocal count
        G.wall(name, idxs, base, sg, profile=profile, mat="fence", collide_h=0)
        for i in idxs[::2]:
            i %= G.N
            x, y = G.L.offset(G.C, i, sg * (base(i) + 0.30))
            h = G.C["heading"][i]
            rot = Matrix.Rotation(h, 4, "Z")
            add_box(posts, (x, y, 0.81 + 1.4), (0.09, 0.09, 2.8), rot=rot)
            # the leaning top arm, as a thin box tilted toward the track
            lx, ly = G.L.offset(G.C, i, sg * base(i))
            arm = Matrix.Rotation(h, 4, "Z") @ Matrix.Rotation(sg * math.atan2(0.6, 0.55), 4, "X")
            add_box(posts, ((x + lx) / 2, (y + ly) / 2, 3.88), (0.07, 0.07, 0.82), rot=arm)
            count += 1

    for side, sg in (("L", 1), ("R", -1)):
        w = G.SD["wall"][side]
        for r, idxs in enumerate(G.runs([v is not None for v in w])):
            if len(idxs) > 2:
                fence_run(f"fence_{side}_{r}", idxs, lambda i, w=w: w[i % G.N], sg)
    fence_run("fence_pit", G.pit_wall_idx, lambda i: G.pd[i] - G.L.PIT_HALF - 0.7, 1)
    G.VIS.objects.link(bpy.data.objects.new("fence_posts", mesh_from_bm("fence_posts", posts, [G.M["metal"]])))
    print("fence posts:", count)


# ------------------------------------------------------------------------------------------------ kerb sausages

def sausages():
    bm = bmesh.new()
    across = [(-0.16, 0.0), (-0.11, 0.07), (-0.04, 0.11), (0.04, 0.11), (0.11, 0.07), (0.16, 0.0)]
    along = [(-0.8, 0.0), (-0.62, 0.75), (-0.3, 1.0), (0.3, 1.0), (0.62, 0.75), (0.8, 0.0)]
    grid = [[bm.verts.new((x, y, z * k)) for y, z in across] for x, k in along]
    for a in range(len(along) - 1):
        for b in range(len(across) - 1):
            f = bm.faces.new([grid[a][b], grid[a + 1][b], grid[a + 1][b + 1], grid[a][b + 1]])
            f.material_index = 1 if a in (0, len(along) - 2) else 0   # black end ramps, yellow body
            f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    black = G.pbr("M_PaintBlack", color=(0.02, 0.02, 0.02), rough=0.5)
    me = mesh_from_bm("kerb_sausage", bm, [G.M["yellow"], black])
    n = 0
    for k in G.L.corners(G.C):
        if k["id"] not in ("T6", "T7", "T8", "T14", "T15"):
            continue
        sg = 1 if k["angle"] > 0 else -1           # inside of the corner
        a = k["apexIdx"]
        h = G.C["heading"][a]
        lat = sg * (G.HW[a] + G.L.KERB_W + 0.3)
        for d in (-3.3, -1.1, 1.1, 3.3):
            x, y = G.L.offset(G.C, a, lat)
            ob = place(f"sausage_{k['id']}_{n}", me, (x + math.cos(h) * d, y + math.sin(h) * d, 0.0), h)
            collide_mesh_instance("col_sausage", me, ob.matrix_basis.copy(), ob.name)
            n += 1
    print("sausages:", n)


# ------------------------------------------------------------------------------------------------ signage

def signage():
    white = G.pbr("M_SignWhite", color=(0.86, 0.86, 0.84), rough=0.5)
    ink = G.pbr("M_SignInk", color=(0.015, 0.015, 0.02), rough=0.6)
    navy = G.pbr("M_HoardingNavy", color=(0.02, 0.05, 0.12), rough=0.45)
    accent = G.pbr("M_HoardingAccent", color=(0.95, 0.33, 0.06), rough=0.45)
    bright = G.pbr("M_SignBright", color=(0.95, 0.95, 0.95), rough=0.4, emit=((1, 1, 1), 1.5))
    hw, K = G.HW, G.L.KERB_W

    # braking boards: 150 / 100 / 50 m before every heavy-braking corner, on the side the car approaches on
    dist = {d: board_mesh(f"brake_board_{d}", 1.4, 1.0, str(d), 0.62, white, ink, post=0.6) for d in (150, 100, 50)}
    n = 0
    for k in G.L.corners(G.C):
        if not any((k["id"] + " ").startswith(p) for p in G.L.HEAVY_BRAKING):
            continue
        sg = -1 if k["angle"] > 0 else 1          # outside of the coming corner
        for d, me in dist.items():
            i = (k["start"] - round(d / G.L.SPACING)) % G.N
            wd = G.SD["wall"]["R" if sg < 0 else "L"][i] or 99
            lat = sg * min(hw[i] + K + 2.5, wd - 1.0)
            x, y = G.L.offset(G.C, i, lat)
            place(f"brake_{k['id']}_{d}", me, (x, y, 0.0), facing_oncoming(i))
            n += 1

    # turn numbers on the fence at each apex, outside
    for k in G.L.corners(G.C):
        sg = -1 if k["angle"] > 0 else 1
        a = k["apexIdx"]
        wd = G.SD["wall"]["R" if sg < 0 else "L"][a]
        if wd is None:
            continue
        me = board_mesh(f"turn_{k['id']}", 1.3, 0.75, k["id"], 0.5, navy, bright)
        x, y = G.L.offset(G.C, a, sg * (wd + 0.2))
        place(f"turn_board_{k['id']}", me, (x, y, 1.15), facing(a, sg))
        n += 1

    # (fence hoardings and every other sponsor format live in venue.py)

    # the gantry's name board, facing the cars coming down the straight
    me = text_mesh("gantry_name", "CORNICHE MARINA CIRCUIT", 0.8, bright)
    h = G.C["heading"][0]
    x, y = G.L.offset(G.C, 0, 0)
    place("gantry_name", me, (x - math.cos(h) * 0.5, y - math.sin(h) * 0.5, 7.2), facing_oncoming(0))   # above the light strip
    print("signs:", n + 1)


# ------------------------------------------------------------------------------------------------ palms

def palm_meshes():
    def frond(x, y):
        ax = abs(x * 2 - 1)
        env = math.sin(math.pi * min(1.0, y * 1.04)) ** 0.45
        on = False
        if ax < 0.04 and y < 0.985:
            on = True                                            # rachis
        elif ax < env:
            t = (y - 0.42 * ax) / 0.026
            on = (t - math.floor(t)) < 0.68 - 0.28 * ax          # dense leaflets, thinner toward their tips
        g = 0.75 + 0.25 * ax
        tip = max(0.0, y - 0.7) / 0.3
        return [(0.07 + 0.08 * tip) * g, (0.2 + 0.06 * tip) * g, 0.045 * g, 1.0 if on else 0.0]
    fm = textured("M_PalmFrond", save_image("palm_frond", 128, 512, frond), rough=0.55, cutout=True, double=True)

    def rings(x, y):
        v = 0.72 + 0.28 * (0.5 + 0.5 * math.cos(y * 2 * math.pi)) ** 3 + 0.04 * math.sin(x * 40)
        return [0.36 * v, 0.29 * v, 0.21 * v, 1.0]
    tm = textured("M_PalmTrunk", save_image("palm_trunk", 16, 64, rings), rough=0.9)

    out = []
    for var, (height, lean, nfr) in enumerate(((11.0, 0.9, 14), (8.5, 0.4, 12), (13.0, 1.6, 16))):
        rnd = random.Random(7 + var)
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        sides, segs = 6, 12
        rings_ = []
        for s in range(segs + 1):
            t = s / segs
            r = 0.3 - 0.12 * t + (0.02 if s % 2 else 0.0)
            cx, cz = lean * t * t, height * t
            rings_.append([bm.verts.new((cx + r * math.cos(2 * math.pi * k / sides), r * math.sin(2 * math.pi * k / sides), cz))
                           for k in range(sides)])
        for s in range(segs):
            for k in range(sides):
                f = bm.faces.new([rings_[s][k], rings_[s][(k + 1) % sides], rings_[s + 1][(k + 1) % sides], rings_[s + 1][k]])
                f.material_index, f.smooth = 1, True
                for lp, (u, v) in zip(f.loops, ((k, s), (k + 1, s), (k + 1, s + 1), (k, s + 1))):
                    lp[uv].uv = (u / sides, v * height / segs / 0.45)
        top = Vector((lean, 0, height))
        for j in range(nfr):
            upper = j % 2 == 0
            az = 2 * math.pi * j / nfr + rnd.uniform(-0.15, 0.15)
            p0, p1 = (math.radians(45), math.radians(-35)) if upper else (math.radians(15), math.radians(-70))
            length = rnd.uniform(4.0, 5.0) * (1.0 if upper else 0.9)
            d = Vector((math.cos(az), math.sin(az), 0))
            side = Vector((-math.sin(az), math.cos(az), 0))
            pos = top.copy()
            rows = []
            n = 6
            for s in range(n + 1):
                t = s / n
                w = 0.75 * (1 - 0.35 * t)
                fold = Vector((0, 0, 0.12 * w))
                rows.append([bm.verts.new(pos - side * w), bm.verts.new(pos + fold), bm.verts.new(pos + side * w)])
                pitch = p0 + (p1 - p0) * t ** 1.3
                pos = pos + (d * math.cos(pitch) + Vector((0, 0, math.sin(pitch)))) * (length / n)
            for s in range(n):
                for c in range(2):
                    f = bm.faces.new([rows[s][c], rows[s][c + 1], rows[s + 1][c + 1], rows[s + 1][c]])
                    f.material_index, f.smooth = 0, True
                    for lp, (u, v) in zip(f.loops, ((c, s), (c + 1, s), (c + 1, s + 1), (c, s + 1))):
                        lp[uv].uv = (u / 2, v / n)
        out.append(mesh_from_bm(f"palm_{var}", bm, [fm, tm]))
    return out


def palms():
    meshes = palm_meshes()
    rnd = random.Random(42)
    spots = []
    for run in G.street_runs:                                    # promenade, both sides
        for i in run[2:-2:6]:
            spots.append(G.L.offset(G.C, i, -(G.SD["wall"]["R"][i] + 0.62 + G.L.QUAY) / 2))
            spots.append(G.L.offset(G.C, i, G.SD["wall"]["L"][i] + 3.5))
    for i in G.garage_idx[::5]:                                  # far edge of the paddock (trucks and motorhomes nearer)
        spots.append(G.L.offset(G.C, i, G.pd[i] + G.L.PIT_HALF + 2.0 + 16.0 + 44.0))
    for i in G.stand_idx[::6]:                                   # behind the grandstand
        spots.append(G.L.offset(G.C, i, -(G.SD["wall"]["R"][i] + 3.0 + G.STAND[-1][0] + 7.0)))
    # infield groves near the paddock: rejected if too close to any part of the track
    pts, hw = G.C["points"], G.HW
    for _ in range(400):
        x, y = rnd.uniform(-560, 480), rnd.uniform(100, 300)       # north of the paddock
        clear_of_track = all(math.dist((x, y), pts[i]) > hw[i] + 26 for i in range(0, G.N, 3))
        keep = clear_of_track and rnd.random() < 0.35                    # same draws as before: the other groves stay put
        if keep and (x / 175) ** 2 + ((y - 322) / 100) ** 2 > 1:        # off the Corniche Club's plaza (vip.py plants its own)
            spots.append((x, y))
    for k, (x, y) in enumerate(spots):
        place(f"palm_{k:03d}", meshes[k % 3], (x, y, -0.1), rnd.uniform(0, 2 * math.pi), rnd.uniform(0.85, 1.15))
    print("palms:", len(spots))


# ------------------------------------------------------------------------------------------------ yachts

def yachts():
    import yachts as Y                      # lofted hulls and styled superstructures, one shared mesh per variant
    variants = Y.build(G)                   # [(mesh, length, beam)]
    poly = G.L.water_polygon(G.C)
    rnd = random.Random(3)
    straights = ("Harbour Straight", "Marina Run A", "Marina Run B", "Marina Run C")
    n = 0
    for name in straights:
        a, m = G.L._seg_range(G.C, name)
        s = 4.0
        seg_len = m * G.L.SPACING
        while s < seg_len - 4:
            k = rnd.randrange(len(variants))
            me, length, beam = variants[k]
            i = (a + int((s + beam / 2) / G.L.SPACING)) % G.N
            h = G.C["heading"][i]
            out = h - math.pi / 2                                  # away from the quay (water side = right)
            # stern-to: swim platform ends 0.4 m off the quay, and the passerelle reaches across onto it
            cx, cy = G.L.offset(G.C, i, -(G.L.QUAY + 2.6 + length / 2))
            ux, uy = math.cos(out), math.sin(out)
            corners = [(cx + ux * l + -uy * b, cy + uy * l + ux * b) for l in (-length / 2, length / 2) for b in (-beam / 2, beam / 2)]
            if all(G.L.point_in_poly(p, poly) for p in corners + [(cx, cy)]):
                place(f"yacht_{n:02d}", me, (cx, cy, G.WATER_Z), out)
                n += 1
            s += beam + rnd.uniform(2.5, 5.0)
    print("yachts:", n)


# ------------------------------------------------------------------------------------------------ the Canopy

def tube(bm, pts, r, mat, sides=4):
    rings = []
    for k, p in enumerate(pts):
        t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        side = t.cross(Vector((0, 0, 1)))
        if side.length < 1e-3:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(t).normalized()
        rings.append([bm.verts.new(p + (side * math.cos(2 * math.pi * j / sides + math.pi / 4) +
                                        up * math.sin(2 * math.pi * j / sides + math.pi / 4)) * r) for j in range(sides)])
    for a in range(len(rings) - 1):
        for j in range(sides):
            f = bm.faces.new([rings[a][j], rings[a][(j + 1) % sides], rings[a + 1][(j + 1) % sides], rings[a + 1][j]])
            f.material_index = mat


def canopy():
    """An original landmark over Marina Run B: steel arches every ~18 m with twisted sails between them, lit from
    below by LED strips. Columns stand on the promenades, outside the walls."""
    # The sails are an open hexagonal lattice of glowing violet bars, not a sheet: the hexes are cut out of a coarse
    # surface by the texture's alpha (glTF BLEND), so the sky shows through and each sail stays 18 triangles (cutting
    # 1.3 m hexes as geometry would cost ~18k). The bars are 12 cm (~24 px), so mipmaps fade a distant sail to an even
    # glow instead of sparkling; the viewer keeps the glow steady (no animation on it).
    HEX_W, HEX_BAR = 1.3, 0.12                      # flat-to-flat cell width, bar width (m)
    R = HEX_W / math.sqrt(3)                        # pointy-top hexes: one texture tile is HEX_W x 3R (two rows)
    centres = [(0, 0), (HEX_W, 0), (HEX_W / 2, 1.5 * R), (0, 3 * R), (HEX_W, 3 * R)]
    normals = [(1.0, 0.0), (0.5, math.sqrt(3) / 2), (-0.5, math.sqrt(3) / 2)]

    def hexbars(x, y):
        px, py = x * HEX_W, y * 3 * R
        cx, cy = min(centres, key=lambda c: (px - c[0]) ** 2 + (py - c[1]) ** 2)
        d = max(abs((px - cx) * nx + (py - cy) * ny) for nx, ny in normals)       # 0 at the centre, HEX_W/2 at an edge
        edge = HEX_W / 2 - d                                                        # distance to the cell's edge
        a = min(1.0, max(0.0, (HEX_BAR / 2 - edge) / 0.012 + 0.5))                 # ~2 px soft edge
        return [0.62, 0.6, 0.68, a]
    fabric = textured("M_CanopyHex", save_image("canopy_hex", 256, 444, hexbars), rough=0.45, metal=0.3, double=True,
                      emit=((0.62, 0.28, 1.0), 3.0))
    nt = fabric.node_tree
    nt.links.new(next(n for n in nt.nodes if n.type == "TEX_IMAGE").outputs["Alpha"], nt.nodes["Principled BSDF"].inputs["Alpha"])
    led = G.pbr("M_CanopyLED", color=(0.6, 0.3, 1.0), emit=((0.62, 0.28, 1.0), 12.0))
    a, m = G.L._seg_range(G.C, "Marina Run B")
    arches = list(range(a, a + m + 1, 4))
    span = max(max(G.SD["wall"]["L"][i] or 0, G.SD["wall"]["R"][i]) for i in arches) + 2.5
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")

    def P(i, t, dz=0.0):
        x, y = G.L.offset(G.C, i % G.N, span * (1 - 2 * t))
        return Vector((x, y, 14.0 + 4.0 * math.sin(math.pi * t) + dz))

    for i in arches:
        h = G.C["heading"][i % G.N]
        for t in (0.0, 1.0):
            base = P(i, t)
            add_box(bm, (base.x, base.y, 7.0), (0.7, 0.7, 14.0), mat=0, rot=Matrix.Rotation(h, 4, "Z"))
        tube(bm, [P(i, t / 12) for t in range(13)], 0.32, 0)
        tube(bm, [P(i, t / 12, -0.45) for t in range(1, 12)], 0.07, 2)           # LED strip under the arch
    for k in range(len(arches) - 1):
        i0, i1 = arches[k], arches[k + 1]
        h = G.C["heading"][i0 % G.N]
        inset = Vector((math.cos(h), math.sin(h), 0)) * 1.0
        for half, (t0, t1) in enumerate(((0.06, 0.5), (0.5, 0.94))):
            tw = 1.2 if (k + half) % 2 else -1.2                                  # alternate the twist: a saddle per bay
            A, B = P(i0, t0, tw) + inset, P(i0, t1, -tw) + inset
            Cc, D = P(i1, t1, tw) - inset, P(i1, t0, -tw) - inset
            g = 3                                                                  # 3x3 keeps the saddle's curve
            vs = [[bm.verts.new(A.lerp(B, u / g).lerp(D.lerp(Cc, u / g), v / g)) for u in range(g + 1)] for v in range(g + 1)]
            tu, tv = (B - A).length / HEX_W, (D - A).length / (3 * R)              # metric UVs: true-size hexes
            for v in range(g):
                for u in range(g):
                    f = bm.faces.new([vs[v][u], vs[v][u + 1], vs[v + 1][u + 1], vs[v + 1][u]])
                    f.material_index, f.smooth = 1, True
                    for lp, (a_, b_) in zip(f.loops, ((u, v), (u + 1, v), (u + 1, v + 1), (u, v + 1))):
                        lp[uvl].uv = (a_ / g * tu, b_ / g * tv)
    G.VIS.objects.link(bpy.data.objects.new("canopy", mesh_from_bm("canopy", bm, [G.M["metal"], fabric, led])))
    print("canopy arches:", len(arches))


# ------------------------------------------------------------------------------------------------ entry point

def run(g):
    global G
    G = SimpleNamespace(**g)
    catch_fences()
    sausages()
    signage()
    palms()
    yachts()
    canopy()
