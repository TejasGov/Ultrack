"""Venue realism for the Corniche Marina Circuit: sponsors and advertising, trackside props, grandstands and crowds.

Called by build_blender.py (venue.run(globals())) after dress.py. Reuses dress.py's helpers (generated images,
text meshes, placement). Every repeated piece is one shared mesh, exported as GPU instances.

Legacy sponsor aliases are retained for layout stability. Original real-world logo assets are used
for the user-requested local fan prototype; see assets/sponsors/README.md for provenance.
"""
import math, os, random

import bmesh, bpy
from mathutils import Matrix, Vector

import dress
import brand_art
from dress import add_box, facing, facing_oncoming, mesh_from_bm, place, save_image, text_mesh, textured, tube

G = None

# name, tagline, panel colour, text colour, mark ("ring" | "chevron" | "bar" | None)
SPONSORS = [
    ("VOLTRAVA", "ENERGY", (0.02, 0.05, 0.12), (0.2, 0.85, 1.0), "ring"),
    ("KESTROVA", "TYRES", (0.01, 0.01, 0.012), (1.0, 0.78, 0.05), "chevron"),
    ("AZURINE", "AIRWAYS", (0.72, 0.84, 0.95), (0.02, 0.06, 0.2), "bar"),
    ("MERIDAX", "PRIVATE BANK", (0.01, 0.1, 0.06), (0.85, 0.7, 0.35), None),
    ("DUNEFIZZ", "", (0.62, 0.02, 0.03), (0.98, 0.98, 0.98), "ring"),
    ("HALCYRA", "WATCHES", (0.92, 0.92, 0.9), (0.02, 0.02, 0.02), None),
    ("ORVANE", "MOTOR OIL", (0.95, 0.36, 0.05), (0.02, 0.02, 0.02), "chevron"),
    ("ULTRACK", "", (0.006, 0.006, 0.007), (1, 1, 1), None),    # the game itself: drawn from the logo PNG, not text
    ("CORNICHE MARINA", "", (0.02, 0.05, 0.12), (0.95, 0.95, 0.95), None),
]


LOGO_ASPECT = 3.91           # assets/brand/ultrack_logo_*.png (tools/prep_logo.py)
ULTRACK = next(k for k, s in enumerate(SPONSORS) if s[0] == "ULTRACK")
_logo_mats = {}


def logo_material(kind):
    """The Ultrack logo as 'print' (vinyl on a hoarding), 'led' (a screen: the image is its own glow) or 'neon'
    (black keyed out, only the letters exist and glow; two-sided, alpha-cut)."""
    if kind in _logo_mats:
        return _logo_mats[kind]
    path = os.path.join(G.ROOT, "assets", "brand", "ultrack_logo_alpha.png" if kind == "neon" else "ultrack_logo_dark.png")
    im = bpy.data.images.load(path, check_existing=True)
    m = G.pbr(f"M_Ultrack_{kind}", rough=0.5 if kind == "print" else 0.3, double=kind == "neon")
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    if kind in ("led", "neon"):
        nt.links.new(t.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 2.5 if kind == "led" else 7.0
    if kind == "neon":
        r = nt.nodes.new("ShaderNodeMath")
        r.operation = "ROUND"
        nt.links.new(t.outputs["Alpha"], r.inputs[0])
        nt.links.new(r.outputs[0], b.inputs["Alpha"])
    _logo_mats[kind] = m
    return m


def logo_quad(bm, uv, cx, cz, w, h, y=-0.03, mat=0):
    """The logo fitted inside a w x h area (aspect kept), as one quad facing -Y."""
    lw = min(w, h * LOGO_ASPECT)
    lh = lw / LOGO_ASPECT
    vs = [bm.verts.new((cx + dx, y, cz + dz)) for dx, dz in ((-lw / 2, -lh / 2), (lw / 2, -lh / 2), (lw / 2, lh / 2), (-lw / 2, lh / 2))]
    f = bm.faces.new(vs)
    f.material_index = mat
    for lp, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = t
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    return f


def logo_board(key, w, h, kind="print"):
    """A black panel w x h (face at y=0 looking -Y, bottom at z=0) carrying the logo: matches the logo's own black ground."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    logo_quad(bm, uv, 0, h / 2, w * 0.92, h * 0.92, mat=0)
    add_box(bm, (0, 0.04, h / 2), (w, 0.08, h), mat=1)
    panel = G.pbr("M_UltrackPanel", color=(0.006, 0.006, 0.007), rough=0.5)
    return mesh_from_bm(f"ultrack_{key}", bm, [logo_material(kind), panel])


def neon_sign(name, w, post_len=12.0):
    """A neon Ultrack sign: dark backplate, the keyed logo glowing 8 cm in front, on two steel posts reaching
    post_len below the sign (its local z=0 is the sign's bottom edge)."""
    h = w / LOGO_ASPECT
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    logo_quad(bm, uv, 0, h / 2, w, h, y=-0.08, mat=0)
    add_box(bm, (0, 0.05, h / 2), (w * 1.04, 0.1, h * 1.12), mat=1)
    for x in (-w * 0.3, w * 0.3):
        add_box(bm, (x, 0.3, -post_len / 2), (0.5, 0.5, post_len), mat=2)
    back = G.pbr("M_NeonBackplate", color=(0.02, 0.02, 0.025), rough=0.4, metal=0.6)
    return mesh_from_bm(name, bm, [logo_material("neon"), back, G.M["metal"]])


def sponsor_board(key, s, w, h, emissive=0.0, two_sided=False):
    """A sponsor panel w x h: face at y=0 looking -Y, bottom at z=0. Mark at the left, name, tagline under it."""
    name, tag, bg, fg, mark = s
    brand=brand_art.LOOKUP.get(name.upper())
    if brand:return brand_art.board_mesh('ad_'+str(key)+'_'+str(w)+'x'+str(h),brand,w,h,emissive=bool(emissive))
    if name == "ULTRACK":
        return logo_board(key, w, h, "led" if emissive else "print")
    panel = G.pbr(f"M_Ad_{key}_bg", color=bg, rough=0.45, emit=(bg, emissive) if emissive else None)
    ink = G.pbr(f"M_Ad_{key}_fg", color=fg, rough=0.4, emit=(fg, 0.6 + 2 * emissive) if emissive else None)
    size = h * (0.5 if tag else 0.62)
    tm = text_mesh(f"{key}_name", name, size, ink)
    xs = [v.co.x for v in tm.vertices]
    tw = (max(xs) - min(xs)) if xs else 0
    scale = min(1.0, (w * (0.78 if mark else 0.9)) / max(tw, 1e-3))
    shift = h * 0.35 if mark else 0.0
    zt = h * (0.42 if tag else 0.22)
    tm.transform(Matrix.Translation((shift, -0.03, zt)) @ Matrix.Diagonal((scale, 1, scale, 1)))
    bm = bmesh.new()
    bm.from_mesh(tm)
    bpy.data.meshes.remove(tm)
    if tag:
        tg = text_mesh(f"{key}_tag", tag, h * 0.17, ink)
        tg.transform(Matrix.Translation((shift, -0.03, h * 0.14)))
        bm.from_mesh(tg)
        bpy.data.meshes.remove(tg)
    for f in bm.faces:
        f.material_index = 1
    mx = shift - tw * scale / 2 - h * 0.45
    if mark == "ring":
        r0, r1 = h * 0.18, h * 0.27
        ring = []
        for k in range(17):
            a = 2 * math.pi * k / 16
            ring.append((bm.verts.new((mx + r1 * math.cos(a), -0.03, h / 2 + r1 * math.sin(a))),
                         bm.verts.new((mx + r0 * math.cos(a), -0.03, h / 2 + r0 * math.sin(a)))))
        for k in range(16):
            f = bm.faces.new([ring[k][0], ring[k + 1][0], ring[k + 1][1], ring[k][1]])
            f.material_index = 1
    elif mark == "chevron":
        for dx in (0.0, h * 0.22):
            pts = [(-0.12, 0.75), (0.08, 0.5), (-0.12, 0.25), (0.0, 0.25), (0.2, 0.5), (0.0, 0.75)]
            vs = [bm.verts.new((mx - h * 0.1 + dx + px * h, -0.03, pz * h)) for px, pz in pts]
            f = bm.faces.new(vs)
            f.material_index = 1
    elif mark == "bar":
        add_box(bm, (mx, -0.03, h / 2), (h * 0.12, 0.01, h * 0.6), mat=1)
    add_box(bm, (0, 0.04, h / 2), (w, 0.08, h), mat=0)
    me = mesh_from_bm(f"ad_{key}_{w:g}x{h:g}", bm, [panel, ink])
    if two_sided:
        panel.use_backface_culling = False
    return me


def boards(w, h, emissive=0.0):
    return [sponsor_board(f"{k}_{w:g}x{h:g}{'_led' if emissive else ''}", s, w, h, emissive) for k, s in enumerate(SPONSORS)]


# ------------------------------------------------------------------------------------------------ advertising

def advertising(stands):
    """Fence hoardings, LED boards on the main straight, billboards before braking zones, painted run-off logos."""
    hoard = boards(6.0, 1.0)
    led = boards(6.0, 1.0, emissive=0.35)                # LED perimeter boards: they glow as the light goes
    rnd = random.Random(5)
    n = 0
    spots = [(i % G.N, "R", True) for i in range(-110, 111, 7) if abs(i) > 4]    # grandstand side of the main straight
    for run in G.street_runs:
        spots += [(i, s, False) for i in run[3:-3:9] for s in ("L", "R")]
    for k in G.L.corners(G.C):                                                   # outside of every corner
        sg = "R" if k["angle"] > 0 else "L"
        spots += [((k["start"] + j) % G.N, sg, False) for j in range(0, k["count"], 6)]
    used = set()
    for i, side, is_led in spots:
        if (i // 3, side) in used or i in stands:               # stand fronts get the continuous LED band below
            continue
        used.add((i // 3, side))
        sg = 1 if side == "L" else -1
        wd = G.SD["wall"][side][i]
        if wd is None:
            continue
        x, y = G.L.offset(G.C, i, sg * (wd + 0.2))
        me = (led if is_led else hoard)[rnd.randrange(len(SPONSORS))]
        place(f"hoarding_{n:03d}", me, (x, y, 0.95), facing(i, sg))
        n += 1

    # continuous LED perimeter band along every grandstand front: dark panels, glowing sponsor names, end to end
    def strip_colour(s):
        name, tag, bg, fg, mark = s
        lum = 0.3 * fg[0] + 0.6 * fg[1] + 0.1 * fg[2]
        return (name, tag, (0.008, 0.008, 0.01), fg if lum > 0.2 else bg, mark)
    band = [sponsor_board(f"{k}_ledband", strip_colour(s), 6.0, 1.0, emissive=1.0) for k, s in enumerate(SPONSORS)]
    for name, (idxs, base, sg) in STANDS.items():
        side = "L" if sg > 0 else "R"
        carry, k = 0.0, 0
        for a, b in zip(idxs, idxs[1:]):
            a, b = a % G.N, b % G.N
            wa, wb = G.SD["wall"][side][a], G.SD["wall"][side][b]
            if wa is None or wb is None:
                continue
            pa = Vector((*G.L.offset(G.C, a, sg * (wa + 0.2)), 0.95))
            pb = Vector((*G.L.offset(G.C, b, sg * (wb + 0.2)), 0.95))
            seg = (pb - pa).length
            while carry < seg:
                p = pa.lerp(pb, carry / seg)
                place(f"ledband_{name}_{k:03d}", band[(k // 2) % len(band)], p, facing(a, sg))
                k += 1
                carry += 6.0
            carry -= seg
            n += 1

    # billboards on legs, 12 x 4 m, before each heavy-braking corner, beyond the wall on the outside
    big = boards(12.0, 4.0)
    legs = bmesh.new()
    for dx in (-4.0, 4.0):
        add_box(legs, (dx, 0.3, 2.5), (0.35, 0.35, 5.0))
    leg_me = mesh_from_bm("billboard_legs", legs, [G.M["metal"]])
    for k in G.L.corners(G.C):
        if not any((k["id"] + " ").startswith(p) for p in G.L.HEAVY_BRAKING):
            continue
        sg = -1 if k["angle"] > 0 else 1
        for back in (28, 44):
            i = (k["start"] - back) % G.N
            wd = G.SD["wall"]["R" if sg < 0 else "L"][i]
            if wd is None or i in stands:
                continue
            x, y = G.L.offset(G.C, i, sg * (wd + 7.0))
            yaw = facing_oncoming(i) + sg * math.radians(25)        # angled toward the approaching cars
            # the nearer billboard before T1 and the hairpin carries the game's logo; the rest rotate sponsors
            pick = ULTRACK if (k["id"] in ("T1", "T6") and back == 28) else rnd.randrange(len(SPONSORS))
            place(f"billboard_{k['id']}_{back}", big[pick], (x, y, 5.0), yaw)
            place(f"billboard_legs_{k['id']}_{back}", leg_me, (x, y, 0.0), yaw)
            n += 1

    # painted logos on the tarmac run-off, the way TV shots see them from above
    for cid, s in (("T1", 1), ("T6", 0), ("T9", 6)):
        k = next(c for c in G.L.corners(G.C) if c["id"] == cid)
        sg = -1 if k["angle"] > 0 else 1
        a = k["apexIdx"]
        side = "R" if sg < 0 else "L"
        lat = sg * (G.HW[a] + G.L.KERB_W + (G.SD["runoffR" if sg < 0 else "runoffL"][a] - G.HW[a] - G.L.KERB_W) * 0.5)
        paint = G.pbr(f"M_RunoffPaint_{cid}", color=SPONSORS[s][3], rough=0.55)
        me = text_mesh(f"runoff_logo_{cid}", SPONSORS[s][0], 3.2, paint)
        me.transform(Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1))))   # back to flat (XY, facing up)
        brand=brand_art.LOOKUP.get(SPONSORS[s][0].upper())
        if brand:
            xs=[v.co.x for v in me.vertices];ys=[v.co.y for v in me.vertices]
            logo=brand_art.board_mesh('runoff_logo_'+cid,brand,max(xs)-min(xs),max(ys)-min(ys),flat=True)
            for v in logo.vertices:v.co.x+=(min(xs)+max(xs))/2;v.co.y+=min(ys)
            bpy.data.meshes.remove(me);me=logo
        x, y = G.L.offset(G.C, a, lat)
        place(f"runoff_logo_{cid}", me, (x, y, 0.012), G.C["heading"][a] + (math.pi if sg > 0 else 0))
        n += 1
    print("ads:", n)


# ------------------------------------------------------------------------------------------------ trackside props

def tecpro():
    """Energy-absorbing barrier blocks in front of the wall on the outside of the heavy-braking corners."""
    colors = [G.pbr("M_TecProRed", color=(0.6, 0.03, 0.03), rough=0.55), G.pbr("M_TecProWhite", color=(0.85, 0.85, 0.85), rough=0.55),
              G.pbr("M_TecProBlue", color=(0.03, 0.12, 0.45), rough=0.55)]
    meshes = []
    for c, m in enumerate(colors):
        bm = bmesh.new()
        add_box(bm, (0, 0, 0.55), (1.45, 1.0, 1.1))
        add_box(bm, (0, -0.505, 0.55), (1.2, 0.01, 0.25), mat=1)     # reflective band
        meshes.append(mesh_from_bm(f"tecpro_{c}", bm, [m, G.pbr(f"M_TecProBand{c}", color=(0.9, 0.9, 0.9), rough=0.2)]))
    n = 0
    for k in G.L.corners(G.C):
        if not any((k["id"] + " ").startswith(p) for p in G.L.HEAVY_BRAKING):
            continue
        sg = -1 if k["angle"] > 0 else 1
        side = "R" if sg < 0 else "L"
        idxs = [(k["start"] + j) % G.N for j in range(-8, k["count"] + 5)]
        for a, b in zip(idxs, idxs[1:]):
            wa, wb = G.SD["wall"][side][a], G.SD["wall"][side][b]
            if wa is None or wb is None:
                continue
            pa, pb = Vector((*G.L.offset(G.C, a, sg * (wa - 0.55)), 0)), Vector((*G.L.offset(G.C, b, sg * (wb - 0.55)), 0))
            d = pb - pa
            steps = max(1, round(d.length / 1.5))
            yaw = math.atan2(d.y, d.x)
            for s in range(steps):
                p = pa.lerp(pb, (s + 0.5) / steps)
                ob = place(f"tecpro_{n:04d}", meshes[n % 3], p, yaw + (math.pi if sg < 0 else 0))   # band faces the track
                n += 1
            # the blocks become the impact surface
            ca, cb = G.at(a, sg * (wa - 1.05), -0.1), G.at(b, sg * (wb - 1.05), -0.1)
            G.col_quad("col_wall", [("tecpro", a, 0), ("tecpro", b, 0), ("tecpro", b, 1), ("tecpro", a, 1)],
                       [ca, cb, cb + Vector((0, 0, 1.2)), ca + Vector((0, 0, 1.2))])
    print("tecpro blocks:", n)


def marshal_posts(skip):
    white = G.pbr("M_PostWhite", color=(0.85, 0.85, 0.83), rough=0.5)
    orange = G.pbr("M_PostOrange", color=(0.9, 0.35, 0.03), rough=0.5)
    glass = G.pbr("M_PostGlass", color=(0.02, 0.03, 0.04), rough=0.05, metal=0.3)
    bm = bmesh.new()
    add_box(bm, (0, 0, 1.25), (2.2, 2.2, 2.5), mat=0)
    add_box(bm, (0, -1.11, 1.6), (1.8, 0.02, 0.8), mat=2)            # track-side window
    for sx in (-1, 1):
        add_box(bm, (sx * 1.11, -0.2, 1.6), (0.02, 1.2, 0.8), mat=2)  # side windows
    add_box(bm, (0.5, 1.11, 1.0), (0.8, 0.02, 2.0), mat=1)            # door at the back
    add_box(bm, (0, -1.13, 1.1), (2.24, 0.04, 0.12), mat=1)           # orange band under the windows
    add_box(bm, (0, 0, 2.58), (2.7, 2.7, 0.16), mat=1)
    add_box(bm, (-0.6, 0.7, 2.86), (0.8, 0.6, 0.4), mat=0)            # roof AC unit
    for dx, dy, sx, sy in ((0, -1.3, 2.6, 0.05), (0, 1.3, 2.6, 0.05), (-1.3, 0, 0.05, 2.6), (1.3, 0, 0.05, 2.6)):
        add_box(bm, (dx, dy, 3.25), (sx, sy, 0.05), mat=3)            # roof guard rail
    for dx in (-1.3, 1.3):
        for dy in (-1.3, 1.3):
            add_box(bm, (dx, dy, 2.95), (0.05, 0.05, 0.6), mat=3)
    cabin = mesh_from_bm("marshal_cabin", bm, [white, orange, glass, G.M["metal"]])
    green = G.pbr("M_FlagPanelGreen", color=(0.1, 0.9, 0.2), emit=((0.1, 1.0, 0.25), 6.0))
    bm = bmesh.new()
    add_box(bm, (0, 0.05, 1.1), (0.1, 0.1, 2.2), mat=1)
    add_box(bm, (0, 0, 2.45), (0.9, 0.12, 0.6), mat=1)
    add_box(bm, (0, -0.065, 2.45), (0.8, 0.01, 0.5), mat=0)
    panel = mesh_from_bm("flag_panel", bm, [green, G.M["metal"]])
    n = 0
    for k, i in enumerate(range(20, G.N, 55)):
        side = "R" if k % 2 else "L"
        sg = 1 if side == "L" else -1
        wd = G.SD["wall"][side][i]
        if wd is None or i in skip:
            continue
        x, y = G.L.offset(G.C, i, sg * (wd + 2.6))
        place(f"marshal_{n:02d}", cabin, (x, y, 0.0), facing(i, sg))
        x, y = G.L.offset(G.C, i, sg * (wd + 0.75))
        place(f"flag_panel_{n:02d}", panel, (x, y, 0.0), facing_oncoming(i))
        n += 1
    print("marshal posts:", n)


def camera_towers():
    bm = bmesh.new()
    for dx in (-1.2, 1.2):
        for dy in (-1.2, 1.2):
            add_box(bm, (dx, dy, 4.0), (0.14, 0.14, 8.0))
    for z in (2.7, 5.4):                                              # bracing rings
        for dx, dy, sx, sy in ((0, -1.2, 2.4, 0.08), (0, 1.2, 2.4, 0.08), (-1.2, 0, 0.08, 2.4), (1.2, 0, 0.08, 2.4)):
            add_box(bm, (dx, dy, z), (sx, sy, 0.08))
    add_box(bm, (0, 0, 8.1), (3.2, 3.2, 0.2))
    add_box(bm, (0, -0.4, 9.0), (0.8, 0.45, 0.5), mat=1)               # broadcast camera
    add_box(bm, (0, 0, 8.6), (0.12, 0.12, 0.9))
    me = mesh_from_bm("camera_tower", bm, [G.M["metal"], G.pbr("M_CameraBody", color=(0.05, 0.05, 0.06), rough=0.3)])
    n = 0
    for cid, back in (("T5", 0), ("T9", 0), ("T13", 0), ("T16", 0), ("T3", 0)):
        k = next(c for c in G.L.corners(G.C) if c["id"] == cid)
        sg = -1 if k["angle"] > 0 else 1
        i = k["apexIdx"]
        wd = G.SD["wall"]["R" if sg < 0 else "L"][i]
        if wd is None:
            continue
        x, y = G.L.offset(G.C, i, sg * (wd + 7.0))
        place(f"camera_tower_{cid}", me, (x, y, 0.0), facing(i, sg))
        n += 1
    print("camera towers:", n)


def footbridge():
    """A pedestrian bridge over Back Straight B with a sponsor banner facing the oncoming cars."""
    a, m = G.L._seg_range(G.C, "Back Straight B")
    i = (a + m // 2) % G.N
    h = G.C["heading"][i]
    wl, wr = G.SD["wall"]["L"][i], G.SD["wall"]["R"][i]
    span = wl + wr + 10
    mid = (wl - wr) / 2
    cx, cy = G.L.offset(G.C, i, mid)
    rot = Matrix.Rotation(h, 4, "Z")
    glass = G.pbr("M_BridgeGlass", color=(0.3, 0.38, 0.42), rough=0.05, metal=0.5)
    bm = bmesh.new()
    add_box(bm, (0, 0, 7.4), (4.0, span, 1.2), rot=rot)                 # deck: 6.8 m clearance
    for side in (-1, 1):
        add_box(bm, (side * 1.95, 0, 8.6), (0.08, span, 1.2), mat=1, rot=rot)        # glass balustrades
    bm_me = mesh_from_bm("footbridge", bm, [G.M["concrete"], glass])
    place("footbridge", bm_me, (cx, cy, 0.0), 0.0)
    for side, lat in (("L", wl + 4.0), ("R", -(wr + 4.0))):
        x, y = G.L.offset(G.C, i, lat)
        tower = bmesh.new()
        add_box(tower, (0, 0, 4.6), (5.0, 6.0, 9.2))
        place(f"footbridge_stair_{side}", mesh_from_bm(f"footbridge_stair_{side}", tower, [G.M["concrete"]]), (x, y, 0.0), h)
    banner = sponsor_board("bridge", SPONSORS[0], min(24.0, span - 12), 1.6, emissive=0.25)
    x, y = cx - math.cos(h) * 2.05, cy - math.sin(h) * 2.05
    place("footbridge_banner", banner, (x, y, 6.6), facing_oncoming(i))
    print("footbridge over", "Back Straight B", f"span {span:.0f} m")


def start_lights():
    red = G.pbr("M_StartLightRed", color=(0.9, 0.02, 0.02), emit=((1.0, 0.02, 0.01), 18.0))
    bm = bmesh.new()
    add_box(bm, (0, 0, 0), (0.42, 0.3, 1.1), mat=1)
    for z in (-0.25, 0.25):
        add_box(bm, (0, -0.16, z), (0.26, 0.02, 0.26), mat=0)
    me = mesh_from_bm("start_light_pod", bm, [red, G.pbr("M_PodBlack", color=(0.01, 0.01, 0.01), rough=0.4)])
    h = G.C["heading"][0]
    for k in range(5):
        x, y = G.L.offset(G.C, 0, (k - 2) * 0.75)
        place(f"start_light_{k}", me, (x - math.cos(h) * 0.7, y - math.sin(h) * 0.7, 5.85), facing_oncoming(0))


def big_screen():
    # a textured material, so the screen quad keeps its UVs through gltf-transform (it prunes UVs nobody samples);
    # the idle image is a dark gradient, and the viewer/game swaps in live timing
    screen = textured("M_ScreenGlow", save_image("screen_idle", 64, 36, lambda x, y: [0.02, 0.04 + 0.03 * y, 0.1 + 0.08 * y, 1]),
                      rough=0.3, emit=((0.4, 0.5, 0.8), 2.5))
    txt = G.pbr("M_ScreenText", color=(1, 1, 1), emit=((1.0, 0.95, 0.9), 6.0))
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    add_box(bm, (0, 0.2, 8.5), (14.6, 0.4, 8.6), mat=1)
    for dx in (-5, 5):
        add_box(bm, (dx, 0.5, 2.25), (0.5, 0.5, 4.5), mat=1)
    # the screen face is one UV'd quad (material M_ScreenGlow): the viewer/game draws live timing onto it each frame
    vs = [bm.verts.new((dx, -0.02, 8.5 + dz)) for dx, dz in ((-7, -4), (7, -4), (7, 4), (-7, 4))]
    f = bm.faces.new(vs)
    for lp, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = t
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()
    logo_quad(bm, uv, 0, 11.2, 9.0, 2.3, y=-0.04, mat=3)           # the game's logo heads the screen
    for body, size, z in (("LAP 1 / 24", 1.0, 7.2), ("LIVE", 0.8, 5.4)):   # static fallback text (the viewer hides it)
        t = text_mesh(f"screen_{body}", body, size, txt)
        t.transform(Matrix.Translation((0, -0.04, z)))
        before = set(bm.faces)
        bm.from_mesh(t)
        for f in set(bm.faces) - before:
            f.material_index = 2
        bpy.data.meshes.remove(t)
    me = mesh_from_bm("big_screen", bm, [screen, G.M["metal"], txt, logo_material("led")])
    i = 52
    x, y = G.L.offset(G.C, i, -(G.SD["wall"]["R"][i] + 14.0))
    place("big_screen", me, (x, y, 0.0), facing(i, -1) + math.radians(-20))


# ------------------------------------------------------------------------------------------------ grandstands and crowds

def crowd_material():
    rnd = random.Random(21)
    W, H, slots = 1024, 128, 14
    shirts = [(0.85, 0.85, 0.85), (0.05, 0.05, 0.06), (0.6, 0.05, 0.05), (0.05, 0.15, 0.5), (0.9, 0.7, 0.1), (0.2, 0.4, 0.2),
              (0.95, 0.4, 0.05), (0.3, 0.3, 0.33), (0.5, 0.75, 0.9), (0.85, 0.85, 0.85)]
    skins = [(0.86, 0.66, 0.52), (0.68, 0.47, 0.34), (0.45, 0.3, 0.2), (0.28, 0.18, 0.12)]
    people = []
    for k in range(slots):
        if rnd.random() < 0.12:
            people.append(None)   # empty seat
            continue
        r = rnd.random()
        people.append(dict(cx=(k + 0.5) / slots + rnd.uniform(-0.012, 0.012), w=rnd.uniform(0.022, 0.03),
                           top=rnd.uniform(0.5, 0.62), hr=rnd.uniform(0.09, 0.115), shirt=rnd.choice(shirts),
                           skin=rnd.choice(skins), cap=rnd.random() < 0.2, capc=rnd.choice(shirts),
                           arms=r < 0.18, flag=0.18 <= r < 0.25, flagc=rnd.choice(shirts), phone=0.25 <= r < 0.33))

    def person(x, y):
        """(colour, phone glow) of the texel, or None if empty."""
        k = min(slots - 1, int(x * slots))
        p = people[k]
        if p is None:
            return None
        u = x - p["cx"]
        dx = abs(u)
        hx, hy = u / (p["hr"] * H / W), (y - (p["top"] + p["hr"] * 0.9)) / p["hr"]
        if hx * hx + hy * hy < 1:                                    # head
            c = p["capc"] if p["cap"] and hy > 0.3 else p["skin"]
            return c, 0.0
        if p["phone"] and abs(u - p["w"] * 0.3) < 0.004 and abs(y - (p["top"] + 0.12)) < 0.035:
            return (0.9, 0.95, 1.0), 1.0                             # a phone held up, screen toward the track
        if (p["arms"] or p["phone"]) and abs(dx - p["w"] * 0.85) < 0.0045 and p["top"] - 0.05 < y < p["top"] + (0.3 if p["arms"] else 0.12):
            return p["skin"], 0.0                                    # raised arms (or the phone arm)
        if p["flag"]:
            if abs(u - p["w"]) < 0.0025 and p["top"] < y < p["top"] + 0.38:
                return (0.6, 0.6, 0.6), 0.0                          # flag stick
            if 0 < u - p["w"] < 0.05 and p["top"] + 0.22 < y < p["top"] + 0.38:
                return p["flagc"], 0.0
        shoulder = p["top"] - max(0.0, (dx - p["w"] * 0.6) / (p["w"] * 0.4)) * 0.08
        if dx < p["w"] and y < shoulder:                             # torso
            sh = 0.75 + 0.25 * y / p["top"]
            return (p["shirt"][0] * sh, p["shirt"][1] * sh, p["shirt"][2] * sh), 0.0
        return None

    colour = lambda x, y: [0, 0, 0, 0] if (q := person(x, y)) is None else [*q[0], 1]
    glow = lambda x, y: [0, 0, 0, 1] if (q := person(x, y)) is None or not q[1] else [0.85, 0.92, 1.0, 1]
    m = textured("M_Crowd", save_image("crowd_row", W, H, colour), rough=0.8, cutout=True)
    nt = m.node_tree
    em = nt.nodes.new("ShaderNodeTexImage")
    em.image = save_image("crowd_phones", W // 4, H // 4, glow)          # phone screens: tiny lights in the stands at night
    b = nt.nodes["Principled BSDF"]
    nt.links.new(em.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 3.0
    return m


def grandstand(name, idxs, base, sg):
    """The main stand's stepped profile, its cantilever roof and columns, along any run of samples."""
    G.wall(name, idxs, base, sg, profile=G.STAND, collide_h=0)
    col = bmesh.new()
    add_box(col, (0, 0, 7.0), (0.5, 0.5, 14.0))
    cm = mesh_from_bm(name + "_column", col, [G.M["metal"]])
    for k, i in enumerate(idxs[::4]):
        x, y = G.L.offset(G.C, i % G.N, sg * (base(i % G.N) + G.STAND[-1][0] + 0.3))
        place(f"{name}_column_{k:02d}", cm, (x, y, 0.0), G.C["heading"][i % G.N])


def tent_material():
    """PTFE membrane: off-white with welded seams radiating from the peak, a faint weave, grime toward the edges where
    rain runs off. One bay maps to UV 0..1. Faint warm emission: lamps light the fabric from below."""
    rnd = random.Random(5)
    grain = [[rnd.random() for _ in range(64)] for _ in range(64)]

    def px(x, y):
        u, v = x - 0.5, y - 0.5
        d = max(abs(u), abs(v)) * 2
        seam = min(abs(u - v), abs(u + v), abs(u), abs(v)) < 0.006 or abs(((d * 6) % 1) - 0.5) > 0.485
        w = 0.96 + 0.04 * grain[int(y * 64) % 64][int(x * 64) % 64]
        dirt = 1 - 0.22 * max(0.0, d - 0.55) / 0.45 - 0.06 * (y < 0.08)
        k = w * dirt * (0.86 if seam else 1.0)
        return [0.9 * k, 0.89 * k, 0.86 * k, 1.0]
    return textured("M_TentFabric", save_image("tent_fabric", 256, 256, px), rough=0.75, double=True,
                    emit=((1.0, 0.9, 0.75), 0.1))   # brighter read as flat white shapes


def tents(name, idxs, base, sg):
    """The stand roof as a row of peaked tensile membranes (one per ~18 m bay), lit from below, with a lamp row
    along the front edge. Edges at 13 m (front) / 14.2 m (back), peaks 5.5 m above them."""
    if "tent" not in G.M:
        G.M["tent"] = tent_material()
    fabric = G.M["tent"]
    W = G.STAND[-1][0]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    last = len(idxs) - 1

    def at(fi, v):
        k = min(int(fi), last - 1)
        t = fi - k
        i0, i1 = idxs[k] % G.N, idxs[k + 1] % G.N
        lat = lambda i: sg * (base(i) - 2.0 + v * (W + 2.3))
        (x0, y0), (x1, y1) = G.L.offset(G.C, i0, lat(i0)), G.L.offset(G.C, i1, lat(i1))
        return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t

    g = 8
    for k in range(0, last, 4):
        k1 = min(k + 4, last)
        grid = []
        for vv in range(g + 1):
            row = []
            for uu in range(g + 1):
                u, v = uu / g, vv / g
                x, y = at(k + u * (k1 - k), v)
                d = max(abs(u - 0.5), abs(v - 0.5)) * 2
                row.append(bm.verts.new((x, y, 13.0 + 1.2 * v + 5.5 * (1 - d) ** 1.7)))
            grid.append(row)
        for vv in range(g):
            for uu in range(g):
                f = bm.faces.new([grid[vv][uu], grid[vv][uu + 1], grid[vv + 1][uu + 1], grid[vv + 1][uu]])
                f.material_index, f.smooth = 0, True
                for lp, (a_, b_) in zip(f.loops, ((uu, vv), (uu + 1, vv), (uu + 1, vv + 1), (uu, vv + 1))):
                    lp[uvl].uv = (a_ / g, b_ / g)
        peak = grid[g // 2][g // 2].co
        add_box(bm, (peak.x, peak.y, peak.z + 1.0), (0.16, 0.16, 2.0), mat=1)
        mast = Vector((peak.x, peak.y, peak.z + 2.0))
        for corner in (grid[0][0], grid[0][g], grid[g][0], grid[g][g]):      # stay cables from the mast head
            tube(bm, [mast, corner.co.copy()], 0.03, 1)
        # underside steel: a valley beam across the bay boundary and edge beams front and back
        tube(bm, [grid[v][0].co - Vector((0, 0, 0.25)) for v in range(g + 1)], 0.11, 1)
        for row in (grid[0], grid[g]):
            tube(bm, [row[0].co - Vector((0, 0, 0.2)), row[g].co - Vector((0, 0, 0.2))], 0.13, 1)
        for u in (0.25, 0.75):                                   # lamp heads along the front edge
            x, y = at(k + u * (k1 - k), 0.02)
            add_box(bm, (x, y, 12.75), (0.7, 0.7, 0.25), mat=2)
        if name == "grandstand" and k % 12:                      # the main stand only had columns every 12 samples
            x, y = at(k, 1.0)
            add_box(bm, (x, y, 7.1), (0.5, 0.5, 14.2), mat=1)
    G.VIS.objects.link(bpy.data.objects.new(f"{name}_tents", mesh_from_bm(f"{name}_tents", bm, [fabric, G.M["metal"], G.M["lamp"]])))


def crowd(name, idxs, base, sg, rnd):
    """One alpha-cut strip of seated people per row of the stand, each row tiled at its own pitch so rows never align.
    The strips break at the aisles (every AISLE_EVERY samples), where stand_details() builds the stairs."""
    blocks = [idxs[a:a + AISLE_EVERY] for a in range(0, len(idxs), AISLE_EVERY + 1)]
    for r in range(18):
        o, z = 0.85 * r + 0.5, 1.2 + 0.45 * r
        tile = 7.7 + rnd.uniform(-0.6, 0.6)
        for b, blk in enumerate(blocks):
            if len(blk) > 1:
                G.wall(f"{name}_crowd_{r:02d}_{b}", blk, base, sg, profile=[(o, z), (o, z + 1.05)], mat="crowd",
                       collide_h=0, uvmode="strip", tile=tile)


AISLE_EVERY = 9   # crowd samples between aisles (~40 m)


def stand_details(name, idxs, base, sg):
    """Aisle stairs (half-height steps with yellow nosings and two handrails) in each gap the crowd leaves, a glass
    balustrade with a top rail along the front of the stand, and a guard rail along the back."""
    if "rail" not in G.M:
        G.M["rail"] = G.pbr("M_StandRail", color=(0.62, 0.64, 0.66), rough=0.3, metal=1.0)
        G.M["nosing"] = G.pbr("M_StairNosing", color=(0.85, 0.65, 0.05), rough=0.6)
        G.M["balustrade"] = G.pbr("M_StandGlass", color=(0.12, 0.16, 0.18), rough=0.05, metal=0.2)
    bm = bmesh.new()
    top = G.STAND[-1][0]
    for a in range(AISLE_EVERY, len(idxs), AISLE_EVERY + 1):
        i = idxs[a] % G.N
        h = G.C["heading"][i]
        rot = Matrix.Rotation(h, 4, "Z")
        fx, fy = math.cos(h), math.sin(h)
        for r in range(18):
            o, z = 0.85 * r, 1.2 + 0.45 * r
            x, y = G.L.offset(G.C, i, sg * (base(i) + o + 0.64))
            add_box(bm, (x, y, z + 0.11), (1.8, 0.42, 0.225), mat=1, rot=rot)          # the half step
            x, y = G.L.offset(G.C, i, sg * (base(i) + o + 0.43))
            add_box(bm, (x, y, z + 0.225), (1.8, 0.05, 0.02), mat=1, rot=rot)          # nosing on the half step
        for side in (-1, 1):                                                           # handrails up both sides
            pts = []
            for r in range(0, 19, 3):
                x, y = G.L.offset(G.C, i, sg * (base(i) + 0.85 * r + 0.2))
                pts.append(Vector((x + fx * side * 1.05, y + fy * side * 1.05, 1.2 + 0.45 * r + 0.95)))
            tube(bm, pts, 0.03, 0)
    for lat_o, z in ((-0.05, 2.25), (top + 0.1, G.STAND[-2][1] + 1.05)):              # front top rail, back rail
        pts = []
        for i in idxs[::2]:
            x, y = G.L.offset(G.C, i % G.N, sg * (base(i % G.N) + lat_o))
            pts.append(Vector((x, y, z)))
        tube(bm, pts, 0.035, 0)
    G.VIS.objects.link(bpy.data.objects.new(f"{name}_rails", mesh_from_bm(f"{name}_rails", bm, [G.M["rail"], G.M["nosing"]])))
    G.wall(f"{name}_balustrade", idxs, lambda i: base(i) - 0.05, sg, profile=[(0, 1.2), (0, 2.2)], mat="balustrade", collide_h=0)


STANDS = {}   # name -> (idxs, base(i), sg): read by paddock.py for roof flags and fascia boards


def stands_and_crowds():
    G.M["crowd"] = crowd_material()
    rnd = random.Random(8)
    taken = set(i % G.N for i in G.stand_idx)
    STANDS["grandstand"] = (G.stand_idx, lambda i: G.SD["wall"]["R"][i % G.N] + 3.0, -1)
    crowd("grandstand", G.stand_idx, lambda i: G.SD["wall"]["R"][i] + 3.0, -1, rnd)
    for cid, before, after in (("T1", 16, 8), ("T6", 6, 6)):
        k = next(c for c in G.L.corners(G.C) if c["id"] == cid)
        sg = -1 if k["angle"] > 0 else 1
        side = "R" if sg < 0 else "L"
        idxs = [(k["start"] + j) % G.N for j in range(-before, k["count"] + after)]
        base = (lambda side: lambda i: G.SD["wall"][side][i % G.N] + 3.0)(side)
        grandstand(f"stand_{cid}", idxs, base, sg)
        crowd(f"stand_{cid}", idxs, base, sg, rnd)
        STANDS[f"stand_{cid}"] = (idxs, base, sg)
        taken.update(idxs)
        # floodlight towers stand at wall + 3 m, which is the new stand's front step: take those out
        span = set(idxs)
        for ob in [o for o in G.VIS.objects if o.name.startswith("floodlight_")]:
            p = (ob.location.x, ob.location.y)
            j = min(span, key=lambda q: math.dist(p, G.C["points"][q]))
            lat = (p[0] - G.C["points"][j][0]) * -math.sin(G.C["heading"][j]) + (p[1] - G.C["points"][j][1]) * math.cos(G.C["heading"][j])
            if math.dist(p, G.C["points"][j]) < 60 and lat * sg > 0:
                bpy.data.objects.remove(ob)
    for name, (idxs, base, sg) in STANDS.items():
        tents(name, idxs, base, sg)
        stand_details(name, idxs, base, sg)
    print("grandstands: main +", 2, "with tent roofs")
    return taken


def pit_building():
    """Hospitality floor over the garages: a glass band on the pit-lane face and a roof that overhangs the lane."""
    G.M["glass"] = G.pbr("M_HospitalityGlass", color=(0.04, 0.06, 0.07), rough=0.04, metal=0.6, emit=((1.0, 0.85, 0.65), 0.15))
    base = lambda i: G.pd[i] + G.L.PIT_HALF + 2.0
    G.wall("pit_building_glass", G.garage_idx, lambda i: base(i) - 0.04, 1, profile=[(0, 5.6), (0, 7.7)], mat="glass", collide_h=0)
    G.wall("pit_building_roof", G.garage_idx, base, 1, profile=[(-3.0, 8.3), (17.0, 8.3)], mat="roof", collide_h=0)


def bunting():
    """Strings of coloured pennants across the track on tall poles: a sagging cable, pennants every 0.7 m, each turned
    a little in the breeze. One merged mesh, colours in COLOR_0, so the whole lot is a single draw call."""
    palette = [(0.75, 0.04, 0.04), (0.95, 0.75, 0.05), (0.05, 0.2, 0.7), (0.92, 0.92, 0.9), (0.03, 0.03, 0.03)]
    cloth = G.pbr("M_Bunting", rough=0.8, double=True)
    nt = cloth.node_tree
    va = nt.nodes.new("ShaderNodeVertexColor")
    va.layer_name = "Col"
    nt.links.new(va.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    rnd = random.Random(31)
    bm = bmesh.new()
    col = bm.loops.layers.color.new("Col")
    spots = [10, 24, -22, -120]
    for cid, back in (("T1", 22), ("T6", 30), ("T9", 26), ("T12", 10), ("T15", 8)):
        k = next(c for c in G.L.corners(G.C) if c["id"] == cid)
        spots.append(k["start"] - back)
    n = 0
    for i in spots:
        i %= G.N
        lat = []
        for side, sg in (("L", 1), ("R", -1)):
            wd = G.SD["wall"][side][i]
            if wd is None:      # pit side of the main straight: the pole stands between the pit lane and the garages
                wd = G.pd[i] + G.L.PIT_HALF + 0.4
            lat.append(sg * (wd + 1.0))
        a = Vector((*G.L.offset(G.C, i, lat[0]), 10.0))
        b = Vector((*G.L.offset(G.C, i, lat[1]), 10.0))
        for p in (a, b):
            add_box(bm, (p.x, p.y, 5.0), (0.22, 0.22, 10.0), mat=1)
        span = (b - a).length
        pts = [a.lerp(b, t / 16) - Vector((0, 0, 2.2 * 4 * (t / 16) * (1 - t / 16))) for t in range(17)]
        tube(bm, pts, 0.025, 1)
        count = int(span / 0.7)
        side = (b - a).normalized()
        for k in range(1, count):
            t = k / count
            top = a.lerp(b, t) - Vector((0, 0, 2.2 * 4 * t * (1 - t)))
            sway = Matrix.Rotation(rnd.uniform(-0.45, 0.45), 4, side)
            down = sway @ Vector((0, 0, -0.62))
            v0, v1 = bm.verts.new(top - side * 0.24), bm.verts.new(top + side * 0.24)
            v2 = bm.verts.new(top + down)
            f = bm.faces.new([v0, v1, v2])
            f.material_index = 0
            c = palette[k % len(palette)]
            for lp in f.loops:
                lp[col] = (*c, 1.0)
            n += 1
    G.VIS.objects.link(bpy.data.objects.new("bunting", mesh_from_bm("bunting", bm, [cloth, G.M["metal"]])))
    print("bunting strings:", len(spots), "pennants:", n)


def checkered_banner():
    """A chequered banner standing on the start gantry's beam, readable from both directions."""
    def px(x, y):
        on = (int(x * 32) + int(y * 4)) % 2 == 0
        return [0.92, 0.92, 0.9, 1] if on else [0.02, 0.02, 0.02, 1]
    m = textured("M_Chequered", save_image("chequered", 256, 32, px), rough=0.6, double=True)
    span = 2 * (G.HW[0] + 4.0) + 0.8
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    vs = [bm.verts.new(v) for v in ((-span / 2, 0, 0), (span / 2, 0, 0), (span / 2, 0, 2.2), (-span / 2, 0, 2.2))]
    f = bm.faces.new(vs)
    for lp, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = t
    me = mesh_from_bm("chequered_banner", bm, [m])
    x, y = G.L.offset(G.C, 0, 0)
    place("chequered_banner", me, (x, y, 7.95), facing_oncoming(0))


def chevron_mesh(name, color, left):
    """A dark 2.4 x 1.2 m board with two neon chevrons pointing the way the corner turns (as the driver sees it)."""
    neon = G.pbr(f"M_Neon_{name}", color=color, emit=(color, 5.0))
    panel = G.pbr("M_ChevronPanel", color=(0.012, 0.012, 0.015), rough=0.5)
    bm = bmesh.new()
    add_box(bm, (0, 0.04, 0.8), (3.2, 0.08, 1.6), mat=0)
    w, h, t = 0.75, 1.25, 0.28
    s = -1 if left else 1                                    # viewed from -Y, +X is the driver's right
    for cx in (-0.62, 0.62):
        pts = [(-w / 2, h / 2), (-w / 2 + t, h / 2), (w / 2, 0), (-w / 2 + t, -h / 2), (-w / 2, -h / 2), (w / 2 - t, 0)]
        vs = [bm.verts.new((cx + s * px, -0.02, 0.8 + pz)) for px, pz in pts]
        f = bm.faces.new(vs if s > 0 else list(reversed(vs)))
        f.normal_update()
        if f.normal.y > 0:                                  # must face -Y, toward the driver
            f.normal_flip()
        f.material_index = 1
    return mesh_from_bm(name, bm, [panel, neon])


def chevron_boards():
    """Neon direction arrows on the outside barrier of the slow corners, from the turn-in to the apex."""
    magenta, cyan = (1.0, 0.1, 0.55), (0.05, 0.85, 1.0)
    meshes = {}
    n = 0
    for k in G.L.corners(G.C):
        if k["radius"] > 100 or abs(k["angle"]) < 50:
            continue                                        # the fast esses need no arrows
        heavy = any((k["id"] + " ").startswith(p) for p in G.L.HEAVY_BRAKING)
        left = k["angle"] > 0
        key = ("m" if heavy else "c") + ("L" if left else "R")
        if key not in meshes:
            meshes[key] = chevron_mesh(f"chevron_{key}", magenta if heavy else cyan, left)
        sg = -1 if left else 1                              # outside of the corner
        side = "R" if sg < 0 else "L"
        for j in range(-3, k["count"] + 1):                 # a near-continuous row through the whole corner
            i = (k["start"] + j) % G.N
            wd = G.SD["wall"][side][i]
            if wd is None:
                continue
            x, y = G.L.offset(G.C, i, sg * (wd + 0.15))
            # aim each board at where the approaching car is ~45 m earlier, so the driver reads it face-on
            tx, ty = G.C["points"][(i - 10) % G.N]
            yaw = math.atan2(ty - y, tx - x) + math.pi / 2  # local -Y onto that direction
            place(f"chevron_{k['id']}_{n:03d}", meshes[key], (x, y, 1.95), yaw)
            n += 1
    print("chevron boards:", n)


def ultrack_signage():
    """The game's own logo, kept rare: three neon signs (pit roof, a pylon behind the T1 grandstand, a pylon by the
    marina). Fence/LED boards, two billboards and the big screen carry it too. (The pit building's facade belongs to the
    teams' garage headers, paddock.py; the posters that hung there are gone.)"""
    base = lambda i: G.pd[i] + G.L.PIT_HALF + 2.0
    # neon 1: on the pit roof, facing the grid
    i = G.garage_idx[len(G.garage_idx) // 2]
    x, y = G.L.offset(G.C, i, base(i) + 7.0)
    place("ultrack_neon_pit", neon_sign("ultrack_neon_pit", 26.0, post_len=0.9), (x, y, 9.2), facing(i, 1))
    # neon 2: a tall pylon behind the middle of the T1 grandstand, above its tent roofs
    idxs, sbase, sg = STANDS["stand_T1"]
    i = idxs[len(idxs) // 2] % G.N
    x, y = G.L.offset(G.C, i, sg * (sbase(i) + G.STAND[-1][0] + 8.0))
    place("ultrack_neon_t1", neon_sign("ultrack_neon_t1", 18.0, post_len=24.0), (x, y, 24.0), facing(i, sg))
    # neon 3: a pylon on the infield promenade where the marina section begins, facing the cars arriving
    a, _ = G.L._seg_range(G.C, "Marina Run A")
    i = (a + 4) % G.N
    x, y = G.L.offset(G.C, i, G.SD["wall"]["L"][i] + 4.5)
    place("ultrack_neon_marina", neon_sign("ultrack_neon_marina", 12.0, post_len=8.0), (x, y, 8.0), facing_oncoming(i) - math.radians(30))
    print("ultrack signage: 3 neon signs (+ boards, 2 billboards, big screen)")


def run(g):
    global G
    G = dress.G = __import__("types").SimpleNamespace(**g)
    taken = stands_and_crowds()
    advertising(taken)
    tecpro()
    marshal_posts(taken)
    camera_towers()
    footbridge()
    start_lights()
    big_screen()
    pit_building()
    ultrack_signage()
    bunting()
    checkered_banner()
    chevron_boards()
