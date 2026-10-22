"""Superyachts for the marina: a lofted hull and a styled superstructure, built for instancing in the browser.

What lives here (static, baked into the GLB, one mesh per variant shared by every berth):
  hull lofted from cross-sections (fine V entry, flared bow, raked stem, flat run aft, transom with a swim platform),
  2-4 superstructure decks whose plan tapers to a rounded nose, with raked fronts, overhanging aft roofs on
  slim pillars, a swept radar arch, satcom domes, a passerelle to the quay; generated textures for hull windows,
  boot stripe and glazing mullions; gelcoat with a clearcoat (KHR_materials_clearcoat).
What the engine does instead: bobbing/roll (per-instance phase in the vertex shader), reflections in the water,
a wet band at the waterline, foam, deck/underwater light glow at night (emissive + bloom), impostors far away.

Budget: ~1.0-1.6k triangles per variant (the hull is ~400).
Local frame: bow toward +X, waterline at z = 0, centred on x = 0.
"""
import math

import bmesh, bpy
from mathutils import Matrix, Vector

import dress
from dress import add_box, mesh_from_bm, save_image

G = None

# name, length (m), decks, hull colour, superstructure colour
VARIANTS = [
    ("y20_white", 20, 2, (0.92, 0.92, 0.92), (0.95, 0.95, 0.95)),
    ("y27_navy", 27, 2, (0.02, 0.045, 0.11), (0.95, 0.95, 0.95)),
    ("y34_white", 34, 3, (0.93, 0.93, 0.92), (0.95, 0.95, 0.95)),
    ("y45_graphite", 45, 3, (0.12, 0.13, 0.14), (0.93, 0.93, 0.92)),
    ("y56_silver", 56, 4, (0.62, 0.64, 0.66), (0.95, 0.95, 0.95)),
]


def textures():
    """Hull side (u = stern->bow, v = keel->deck) and glazing band (u = around the deck, v = up) as small images."""
    def hull(x, y):
        if y < 0.42:                                   # below the boot stripe: antifouling, mostly under water
            return [0.05, 0.06, 0.08, 1]
        if y < 0.5:                                    # boot stripe at the waterline
            return [0.02, 0.02, 0.025, 1]
        # long hull windows (the owner's suite) and a row of portholes forward, both dark glass
        if 0.66 < y < 0.74 and 0.28 < x < 0.62 and (x * 9) % 1 < 0.86:
            return [0.03, 0.04, 0.05, 1]
        if 0.67 < y < 0.73 and 0.66 < x < 0.82 and ((x - 0.66) * 60) % 1 < 0.45:
            return [0.03, 0.04, 0.05, 1]
        return [1, 1, 1, 1]                            # white: tinted per variant by the material colour
    hull_im = save_image("yacht_hull", 512, 128, hull)

    def glazing(x, y):
        if 0.3 < y < 0.88:
            return [0.025, 0.035, 0.045, 1] if (x * 24) % 1 > 0.06 else [0.7, 0.7, 0.7, 1]   # glass with mullions
        return [1, 1, 1, 1]
    glaze_im = save_image("yacht_glazing", 512, 64, glazing)
    return hull_im, glaze_im


def gelcoat(name, color, im, coat=True):
    """Base colour = image x colour (white areas take the variant colour), glossy, clear-coated."""
    m = G.pbr(name, color=color, rough=0.14, metal=0.0)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs["B"].default_value = (*color, 1)
    nt.links.new(t.outputs["Color"], mix.inputs["A"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    if coat:
        b.inputs["Coat Weight"].default_value = 1.0
        b.inputs["Coat Roughness"].default_value = 0.04
    return m


# ------------------------------------------------------------------------------------------------ hull

def hull(bm, uv, L, B, F, mat_hull, mat_deck):
    """Lofted hull. Returns (stern x, deck height at a station s) for placing the superstructure."""
    stations = [k / 14 for k in range(15)]
    deck_z = lambda s: F + 0.9 * max(0.0, s - 0.55) ** 1.6 * 2.2           # sheer rising toward the bow
    keel_z = lambda s: -(0.055 * L + 0.4) * (1 - max(0.0, s - 0.72) / 0.28 * 0.85)
    rings = []
    for s in stations:
        hb = B / 2 * (0.93 + 0.07 * min(1, s / 0.15)) * (1 - max(0.0, (s - 0.42) / 0.58) ** 2.1)
        hb = max(hb, 0.05)
        dz, kz = deck_z(s), keel_z(s)
        fine = max(0.0, (s - 0.6) / 0.4)                                    # 0 aft -> 1 at the bow: V entry
        # half section from the deck edge down to the keel: flare, chine, bilge, keel
        half = [(hb, dz), (hb * (1 - 0.06 * fine), dz - 0.35 * F), (hb * (0.95 - 0.35 * fine), 0.25),
                (hb * (0.8 - 0.45 * fine), kz * 0.45), (hb * (0.42 - 0.3 * fine), kz * 0.85), (0.0, kz)]
        prof = [(-y, z) for y, z in half] + [(y, z) for y, z in reversed(half[:-1])]
        x0 = (s - 0.5) * L
        ring = []
        for y, z in prof:
            rake = 0.18 * L * max(0.0, s - 0.86) / 0.14 * (z - kz) / max(0.1, dz - kz)   # raked stem
            ring.append((bm.verts.new((x0 + rake * 0.25, y, z)), s, hull_v(z, kz, dz)))
        rings.append(ring)
    n = len(rings[0])
    for a in range(len(rings) - 1):
        for k in range(n - 1):
            q = [rings[a][k], rings[a][k + 1], rings[a + 1][k + 1], rings[a + 1][k]]
            f = bm.faces.new([v for v, _, _ in q])
            f.material_index, f.smooth = mat_hull, True
            for lp, (_, s, v) in zip(f.loops, q):
                lp[uv].uv = (s, v)
        # deck between the two deck edges
        f = bm.faces.new([rings[a][-1][0], rings[a][0][0], rings[a + 1][0][0], rings[a + 1][-1][0]])
        f.material_index = mat_deck
    # transom
    f = bm.faces.new([v for v, _, _ in reversed(rings[0])])
    f.material_index = mat_hull
    for lp in f.loops:
        lp[uv].uv = (0.0, 0.95)
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces])
    return -0.5 * L, deck_z


def hull_v(z, kz, dz):
    """Hull texture v for a height: keel..waterline -> 0..0.42 (antifouling), 0..0.35 m -> 0.42..0.5 (boot stripe),
    0.35 m..deck -> 0.5..1 (topsides, where the hull windows sit at 0.66-0.74)."""
    if z < 0:
        return 0.42 * (1 - z / kz)
    if z < 0.35:
        return 0.42 + 0.08 * z / 0.35
    return 0.5 + 0.5 * (z - 0.35) / max(0.1, dz - 0.35)


# ------------------------------------------------------------------------------------------------ superstructure

def deck_plan(xa, xf, w, nose):
    """A deck's outline, counter-clockwise from above: flat aft end at xa, sides converging into a rounded nose at xf."""
    pts = []
    for k in range(7):                                  # starboard side, aft -> nose shoulder
        t = k / 6
        x = xa + (xf - nose - xa) * t
        pts.append((x, -w / 2 * (1 - 0.18 * t ** 2)))
    for k in range(1, 8):                               # rounded nose
        a = -math.pi / 2 + math.pi * k / 8
        pts.append((xf - nose + nose * math.cos(a), w / 2 * 0.82 * math.sin(a)))
    for k in range(6, -1, -1):                          # port side back aft
        t = k / 6
        x = xa + (xf - nose - xa) * t
        pts.append((x, w / 2 * (1 - 0.18 * t ** 2)))
    return pts


def prism(bm, uv, plan, z0, z1, mat_side, mat_top, rake=0.0, xf=None, uv_len=1.0):
    """Extrude a plan; the top ring pulls back by `rake` toward the nose (raked windscreens), UVs wrap the sides."""
    xs = [x for x, _ in plan]
    xa, xn = min(xs), max(xs)
    lo = [bm.verts.new((x, y, z0)) for x, y in plan]
    hi = [bm.verts.new((x - rake * max(0.0, (x - xa) / max(1e-3, xn - xa)) ** 3, y * (1 - 0.04 * (rake > 0)), z1)) for x, y in plan]
    s = 0.0
    n = len(plan)
    for k in range(n):
        a, b = k, (k + 1) % n
        d = math.dist(plan[a], plan[b])
        f = bm.faces.new([lo[a], lo[b], hi[b], hi[a]])
        f.material_index, f.smooth = mat_side, False
        for lp, (u, v) in zip(f.loops, ((s, 0), (s + d, 0), (s + d, 1), (s, 1))):
            lp[uv].uv = (u / uv_len, v)
        s += d
    top = bm.faces.new(hi)
    top.material_index = mat_top
    bot = bm.faces.new(list(reversed(lo)))
    bot.material_index = mat_top
    return hi


def sphere(bm, center, r, mat):
    res = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=r, matrix=Matrix.Translation(center))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index, f.smooth = mat, True


def yacht_mesh(name, L, decks, hull_col, sup_col, tex):
    hull_im, glaze_im = tex
    mats = [gelcoat(f"M_{name}_hull", hull_col, hull_im),            # 0 hull sides
            G.pbr(f"M_{name}_teak", color=(0.38, 0.24, 0.13), rough=0.65),   # 1 teak decks
            gelcoat(f"M_{name}_super", sup_col, glaze_im),          # 2 superstructure sides (glazing band)
            G.pbr(f"M_{name}_white", color=sup_col, rough=0.2),     # 3 roofs, overhangs, arch
            G.pbr("M_YachtGlassRail", color=(0.04, 0.06, 0.07), rough=0.05, metal=0.3),   # 4 glass bulwarks
            G.pbr("M_YachtDeckLight", color=(1.0, 0.9, 0.75), emit=((1.0, 0.88, 0.7), 2.0)),  # 5 deck lights
            G.pbr("M_YachtSteel", color=(0.7, 0.72, 0.74), rough=0.25, metal=1.0),           # 6 stainless
            G.pbr("M_YachtUnderwater", color=(0.2, 0.7, 1.0), emit=((0.15, 0.65, 1.0), 6.0))]   # 7 transom lights
    B = L * 0.2
    F = 1.6 + L * 0.045
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    stern, deck_z = hull(bm, uv, L, B, F, 0, 1)
    # swim platform across the transom, just above the water
    add_box(bm, (stern - 1.1, 0, 0.35), (2.2, B * 0.86, 0.22), mat=1)
    # the transom reads as a stern, not a box end: tender-garage door, steps up both quarters, a stainless grab rail,
    # and the underwater/transom lights superyachts run at night
    dz0 = deck_z(0.0)
    add_box(bm, (stern - 0.03, 0, 0.5 + (dz0 - 0.5) * 0.45), (0.04, B * 0.5, (dz0 - 0.5) * 0.7), mat=4)
    steps = min(6, max(2, int((dz0 - 0.46) / 0.3)))
    for side in (-1, 1):                                  # solid stair blocks on the platform, climbing to the deck
        for k in range(steps):
            z = 0.46 + (dz0 - 0.46) * (k + 1) / steps
            add_box(bm, (stern - 0.2 - 0.3 * (steps - 1 - k), side * B * 0.34, (0.46 + z) / 2), (0.3, B * 0.14, z - 0.46), mat=1)
        run = 0.3 * (steps - 1)                           # handrail along the flight, 0.9 m above the nosings
        add_box(bm, (stern - 0.2 - run / 2, side * B * 0.42, (0.46 + dz0) / 2 + 0.9),
                (math.hypot(run, dz0 - 0.46), 0.04, 0.04), mat=6, rot=Matrix.Rotation(-math.atan2(dz0 - 0.46, max(run, 0.1)), 4, "Y"))
    add_box(bm, (stern - 2.1, 0, 0.25), (0.06, B * 0.7, 0.08), mat=7)
    add_box(bm, (stern - 0.03, 0, dz0 - 0.15), (0.05, B * 0.8, 0.06), mat=5)
    # superstructure decks: each shorter and set further aft, tapering into a rounded nose, front raked back
    z = deck_z(0.45)
    xa = stern + L * 0.16
    xf = stern + L * 0.8
    w = B * 0.86
    for d in range(decks):
        h = 2.5
        plan = deck_plan(xa, xf, w, nose=w * 0.45)
        prism(bm, uv, plan, z, z + h, 2, 3, rake=1.6 + 0.4 * d, uv_len=L * 0.9)
        # the roof overhangs the aft deck below it: a thin slab reaching back, on two slim pillars, lit underneath
        over = deck_plan(xa - L * 0.09, xf - (1.6 + 0.4 * d), w * 0.98, nose=w * 0.42)
        prism(bm, uv, over, z + h, z + h + 0.22, 3, 3)
        for y in (-w * 0.42, w * 0.42):
            add_box(bm, (xa - L * 0.08, y, z + h / 2), (0.12, 0.12, h), mat=3)
        for y in (-w * 0.3, w * 0.3):                                                   # downlight strips
            add_box(bm, (xa - L * 0.045, y, z + h - 0.02), (L * 0.06, 0.12, 0.03), mat=5)
        # glass bulwark around the aft deck of this level
        add_box(bm, (xa - L * 0.045, -w * 0.47, z + 0.5), (L * 0.09, 0.04, 1.0), mat=4)
        add_box(bm, (xa - L * 0.045, w * 0.47, z + 0.5), (L * 0.09, 0.04, 1.0), mat=4)
        z += h + 0.22
        xa += L * 0.05
        xf -= L * 0.1 + 0.5 * d
        w *= 0.9
    # sun deck hardtop on four posts, then the swept radar arch with two satcom domes
    top_plan = deck_plan(xa - L * 0.02, xa + L * 0.2, w * 0.95, nose=w * 0.3)
    prism(bm, uv, top_plan, z + 2.2, z + 2.4, 3, 3)
    for px in (xa, xa + L * 0.16):
        for py in (-w * 0.38, w * 0.38):
            add_box(bm, (px, py, z + 1.1), (0.1, 0.1, 2.2), mat=6)
    ax = xa + L * 0.24
    for y in (-w * 0.32, w * 0.32):                    # arch legs lean forward
        rot = Matrix.Rotation(math.radians(-22), 4, "Y")
        add_box(bm, (ax, y, z + 1.4), (0.35, 0.22, 2.9), mat=3, rot=rot)
    add_box(bm, (ax + 0.55, 0, z + 2.75), (0.9, w * 0.7, 0.3), mat=3)
    sphere(bm, (ax + 0.4, -w * 0.18, z + 3.35), 0.45 + L * 0.006, 3)
    sphere(bm, (ax + 0.4, w * 0.18, z + 3.35), 0.35 + L * 0.005, 3)
    # bow rail (stainless) and a passerelle reaching from the stern to the quay
    bx = stern + L * 0.86
    add_box(bm, (bx, 0, deck_z(0.86) + 0.55), (L * 0.18, 0.05, 0.05), mat=6)
    add_box(bm, (stern - 3.2, 0, 1.03), (2.8, 0.7, 0.06), mat=6)   # level with the quay top (waterline 1 m below it)
    return mesh_from_bm(f"yacht_{name}", bm, mats)


def build(g):
    """Make the variants; returns [(mesh, length, beam)] for dress.yachts() to place."""
    global G
    G = dress.G = g
    tex = textures()
    out = []
    for name, L, decks, hc, sc in VARIANTS:
        out.append((yacht_mesh(name, L, decks, hc, sc, tex), L, L * 0.2))
    tris = {me.name: sum(len(p.vertices) - 2 for p in me.polygons) for me, _, _ in out}
    print("yacht variants:", ", ".join(f"{k} {v}" for k, v in tris.items()))
    return out
