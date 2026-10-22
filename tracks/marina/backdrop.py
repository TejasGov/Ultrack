"""Backdrop for the Corniche Marina Circuit: a city skyline across the water and inland, and the crescent hotel.

Called by build_blender.py (backdrop.run(globals())). Towers are merged into one mesh per cluster (one draw call
each); facades use a generated window texture whose lit windows also drive emission, so the city comes alive at dusk.
The hotel is an original design (a crescent slab with an LED crown on the infield inside the marina peninsula);
it deliberately avoids the look of any real circuit hotel.
"""
import math, random

import bmesh, bpy
from mathutils import Matrix, Vector

import dress
from dress import mesh_from_bm, place, save_image, text_mesh

G = None
FLOOR, BAY = 3.6, 3.0           # one window cell; the texture tile is CELLS x CELLS cells
CELLS = 16
TILE_W, TILE_H = CELLS * BAY, CELLS * FLOOR


def facade_material(name, seed, frame, glass, lit, lit_share, balcony=False):
    """Window texture that reads like occupied floors, not a checkerboard: lighting is decided per floor (offices and
    hotel corridors go on a floor at a time), then per window, with blinds, curtains and a few cool-white floors.
    Dark glass picks up a sky gradient. Building UVs start at random offsets, so neighbours never line up."""
    rnd = random.Random(seed)
    floors = []
    for cy in range(CELLS):
        on = rnd.random() < lit_share * 1.5
        tone = (0.8, 0.9, 1.0) if rnd.random() < 0.2 else (1.0, 1.0, 1.0)          # a few cool office floors
        floors.append([(rnd.random() < (0.8 if on else 0.08), rnd.uniform(0.55, 1.0), rnd.random() < 0.3,
                        rnd.uniform(0.15, 0.6), tone) for _ in range(CELLS)])

    def px(x, y):
        cx, cy = int(x * CELLS), int(y * CELLS)
        fx, fy = x * CELLS - cx, y * CELLS - cy
        if balcony and 0.2 < fy < 0.34:                                           # balcony glass and its rail
            return [*(c * 1.6 for c in frame), 1] if fy > 0.31 else [glass[0] * 1.6, glass[1] * 1.7, glass[2] * 1.9, 1]
        if fx < 0.1 or fx > 0.94 or fy < 0.2 or fy > 0.92:                        # mullions and slab edges
            return [*frame, 1]
        on, w, blind, cut, tone = floors[cy][cx]
        if on:
            k = w * (0.7 + 0.3 * fy)                                              # ceiling-lit: brighter at the top
            if blind and fy > 1 - cut:
                k *= 0.35                                                          # blind pulled half down
            k *= 0.75 if fx < 0.22 or fx > 0.82 else 1.0                           # curtains at the sides
            return [lit[0] * k * tone[0], lit[1] * k * tone[1], lit[2] * k * tone[2], 1]
        sky = 0.7 + 0.6 * fy
        return [glass[0] * sky, glass[1] * sky, glass[2] * sky * 1.1, 1]
    im = save_image(name, 512, 512, px)

    def glow(x, y):                       # emission: lit windows only (light stone frames must not glow)
        cx, cy = int(x * CELLS), int(y * CELLS)
        fx, fy = x * CELLS - cx, y * CELLS - cy
        if (balcony and 0.2 < fy < 0.34) or fx < 0.1 or fx > 0.94 or fy < 0.2 or fy > 0.92 or not floors[cy][cx][0]:
            return [0, 0, 0, 1]
        return px(x, y)
    m = G.pbr(f"M_{name}", rough=0.25, metal=0.3)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = im
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    e = nt.nodes.new("ShaderNodeTexImage")
    e.image = save_image(name + "_glow", 256, 256, glow)
    nt.links.new(e.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 1.2
    return m


def uv_prism(bm, uv, ring, z0, z1, mat, roof_mat=None, u0=0.0, v0=0.0):
    """Extrude a closed footprint (counter-clockwise points) from z0 to z1, facade UVs in window cells, offset by
    (u0, v0) metres in the texture so neighbouring buildings show different windows."""
    s = u0
    lo = [bm.verts.new((x, y, z0)) for x, y in ring]
    hi = [bm.verts.new((x, y, z1)) for x, y in ring]
    n = len(ring)
    for k in range(n):
        a, b = k, (k + 1) % n
        d = math.dist(ring[a], ring[b])
        f = bm.faces.new([lo[a], lo[b], hi[b], hi[a]])
        f.material_index = mat
        for lp, (u, v) in zip(f.loops, ((s, z0 + v0), (s + d, z0 + v0), (s + d, z1 + v0), (s, z1 + v0))):
            lp[uv].uv = (u / TILE_W, v / TILE_H)
        s += d
    top = bm.faces.new(hi)
    top.material_index = mat if roof_mat is None else roof_mat
    for lp in top.loops:
        lp[uv].uv = (0.02, 0.02)          # a frame-coloured corner of the texture: an unlit roof


def rect(cx, cy, w, d, yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return [(cx + c * x - s * y, cy + s * x + c * y) for x, y in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]


def city(name, x0, x1, y0, y1, count, hmin, hmax, mats, seed):
    rnd = random.Random(seed)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    placed = []
    tries = 0
    while len(placed) < count and tries < count * 40:
        tries += 1
        w, d = rnd.uniform(24, 55), rnd.uniform(24, 55)
        x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        if any(abs(x - px) < (w + pw) / 2 + 8 and abs(y - py) < (d + pd) / 2 + 8 for px, py, pw, pd in placed):
            continue
        placed.append((x, y, w, d))
        # taller toward the middle of the cluster: a skyline with a peak, not a flat wall
        mid = 1 - min(1.0, math.hypot((x - (x0 + x1) / 2) / ((x1 - x0) / 2), (y - (y0 + y1) / 2) / ((y1 - y0) / 2)))
        h = hmin + (hmax - hmin) * (rnd.random() ** 2.2) * (0.35 + 0.65 * mid)
        h = round(h / FLOOR) * FLOOR
        m = rnd.randrange(len(mats))
        yaw = rnd.choice((0.0, 0.0, math.radians(rnd.uniform(-20, 20))))
        z, tiers = 0.0, 1 + (h > 90) + (h > 160)
        u0, v0 = rnd.uniform(0, TILE_W), rnd.randrange(CELLS) * FLOOR
        for t in range(tiers):
            k = 1 - 0.18 * t
            top = h if t == tiers - 1 else z + h * rnd.uniform(0.45, 0.6) / (tiers - t)
            uv_prism(bm, uv, rect(x, y, w * k, d * k, yaw), z, top, m, u0=u0, v0=v0)
            z = top
        k = 1 - 0.18 * (tiers - 1)
        roof = z
        if rnd.random() < 0.6:                                   # rooftop plant room, centred, smaller than the roof
            uv_prism(bm, uv, rect(x, y, w * k * 0.45, d * k * 0.4, yaw), z, z + 4.5, m)
            roof = z + 4.5
        if h > 140 and rnd.random() < 0.5:                       # a spire on some of the tallest
            uv_prism(bm, uv, rect(x, y, 2.0, 2.0, yaw), z, z + h * 0.18, m)
            roof = z + h * 0.18
        if h > 60:                                               # aviation obstruction light (the viewer blinks *Beacon*)
            uv_prism(bm, uv, rect(x, y, 1.2, 1.2, yaw), roof, roof + 1.5, len(mats), roof_mat=len(mats))
    me = mesh_from_bm(name, bm, mats + [G.M["beacon"]])
    G.VIS.objects.link(bpy.data.objects.new(name, me))
    return len(placed)


def skyline():
    mats = [facade_material("facade_warm", 1, (0.16, 0.16, 0.17), (0.05, 0.07, 0.09), (1.0, 0.78, 0.45), 0.35),
            facade_material("facade_cool", 2, (0.55, 0.57, 0.6), (0.08, 0.12, 0.16), (0.85, 0.92, 1.0), 0.25),
            facade_material("facade_stone", 3, (0.62, 0.55, 0.45), (0.06, 0.06, 0.07), (1.0, 0.85, 0.6), 0.3)]
    xs = [p[0] for p in G.C["points"]]
    ys = [p[1] for p in G.C["points"]]
    west = min(xs) - 1900
    # the far shore the waterfront city stands on
    shore = bmesh.new()
    sy0, sy1 = min(ys) - 1400, max(ys) + 1400
    shore.faces.new([shore.verts.new(v) for v in ((west - 1500, sy0, 0.5), (west + 450, sy0, 0.5), (west + 450, sy1, 0.5), (west - 1500, sy1, 0.5))])
    G.VIS.objects.link(bpy.data.objects.new("far_shore", mesh_from_bm("far_shore", shore, [G.M["paved"]])))
    n = city("skyline_west", west - 1100, west + 350, sy0 + 500, sy1 - 500, 110, 25, 320, mats, 4)
    east = max(xs) + 1800
    shore = bmesh.new()
    shore.faces.new([shore.verts.new(v) for v in ((east - 450, sy0, 0.5), (east + 1800, sy0, 0.5), (east + 1800, sy1, 0.5), (east - 450, sy1, 0.5))])
    G.VIS.objects.link(bpy.data.objects.new("far_shore_east", mesh_from_bm("far_shore_east", shore, [G.M["paved"]])))
    n += city("skyline_east", east, east + 1300, min(ys) - 400, max(ys) + 500, 45, 15, 120, mats, 5)
    print("skyline towers:", n)


def hotel():
    """Crescent tower on the infield inside the marina peninsula; its convex face looks west over the canopy to the water."""
    a, m = G.L._seg_range(G.C, "Marina Run B")
    rb = G.C["points"][(a + m // 2) % G.N]                      # middle of the run under the canopy
    cx, cy = rb[0] + 250.0, rb[1] - 40.0                        # circle centre in the infield (searched: >= 78 m clear of the track)
    R, depth, floors = 60.0, 16.0, 22
    h = floors * FLOOR
    arc = [math.radians(a_) for a_ in range(125, 236, 5)]       # the west-facing arc
    outer = [(cx + R * math.cos(t), cy + R * math.sin(t)) for t in arc]
    inner = [(cx + (R - depth) * math.cos(t), cy + (R - depth) * math.sin(t)) for t in arc]
    # keep it clear of the track: every footprint point at least 40 m from the centre line
    pts = G.C["points"]
    assert all(min(math.dist(p, q) for q in pts[::2]) > 40 for p in outer + inner), "hotel footprint too close to the track"
    mats = [facade_material("facade_hotel", 9, (0.82, 0.8, 0.76), (0.05, 0.08, 0.1), (1.0, 0.82, 0.55), 0.4, balcony=True),
            G.pbr("M_HotelPodium", color=(0.75, 0.73, 0.69), rough=0.5),
            G.pbr("M_HotelCrown", color=(0.6, 0.3, 1.0), emit=((0.62, 0.28, 1.0), 9.0))]   # violet, like the canopy
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    ring = outer + inner[::-1]                                  # closed footprint
    if sum(ring[k][0] * ring[(k + 1) % len(ring)][1] - ring[(k + 1) % len(ring)][0] * ring[k][1] for k in range(len(ring))) < 0:
        ring = ring[::-1]                                       # counter-clockwise for outward facades
    uv_prism(bm, uv, ring, 0.0, h, 0, roof_mat=1)
    podium_o = [(cx + (R + 8) * math.cos(t), cy + (R + 8) * math.sin(t)) for t in arc]
    podium_i = [(cx + (R - depth - 6) * math.cos(t), cy + (R - depth - 6) * math.sin(t)) for t in arc]
    pr = podium_o + podium_i[::-1]
    if sum(pr[k][0] * pr[(k + 1) % len(pr)][1] - pr[(k + 1) % len(pr)][0] * pr[k][1] for k in range(len(pr))) < 0:
        pr = pr[::-1]
    uv_prism(bm, uv, pr, 0.0, 8.0, 1)
    crown_o = [(cx + (R + 0.6) * math.cos(t), cy + (R + 0.6) * math.sin(t)) for t in arc]
    crown_i = [(cx + (R - depth - 0.6) * math.cos(t), cy + (R - depth - 0.6) * math.sin(t)) for t in arc]
    cr = crown_o + crown_i[::-1]
    if sum(cr[k][0] * cr[(k + 1) % len(cr)][1] - cr[(k + 1) % len(cr)][0] * cr[k][1] for k in range(len(cr))) < 0:
        cr = cr[::-1]
    uv_prism(bm, uv, cr, h, h + 2.2, 2)                         # LED crown band
    me = mesh_from_bm("hotel", bm, mats)
    G.VIS.objects.link(bpy.data.objects.new("hotel", me))
    # its name on the crown, facing the water
    sign = text_mesh("hotel_name", "MARINA CRESCENT", 3.0, mats[2])
    t = math.pi
    place("hotel_name", sign, (cx + (R + 1.0) * math.cos(t), cy + (R + 1.0) * math.sin(t), h + 2.6), t + math.pi / 2)
    print(f"hotel: {floors} floors, {h:.0f} m")


def supertall_loft(bm, uv, cx, cy, H, R, sides, twist, taper, setbacks, led_every, levels=16):
    """A lofted tower: rings of `sides` vertices, tapering, twisting, stepping back; facade UVs in window cells.
    Material slots: 0 facade, 1 LED strip, 2 beacon, 3 roof/spire."""
    rings, radii = [], []
    for k in range(levels + 1):
        t = k / levels
        r = R * (1 - (1 - taper) * t ** 1.2)
        for at, scale in setbacks:
            if t >= at:
                r *= scale
        a0 = math.radians(twist) * t
        rings.append([bm.verts.new((cx + r * math.cos(a0 + 2 * math.pi * j / sides), cy + r * math.sin(a0 + 2 * math.pi * j / sides), H * t))
                      for j in range(sides)])
        radii.append(r)
    for k in range(levels):
        edge = 2 * math.pi * radii[k] / sides
        for j in range(sides):
            a, b = rings[k][j], rings[k][(j + 1) % sides]
            c, d = rings[k + 1][(j + 1) % sides], rings[k + 1][j]
            f = bm.faces.new([a, b, c, d])
            f.material_index = 0
            u0 = j * edge / TILE_W
            for lp, (u, z) in zip(f.loops, ((u0, a.co.z), (u0 + edge / TILE_W, b.co.z), (u0 + edge / TILE_W, c.co.z), (u0, d.co.z))):
                lp[uv].uv = (u, z / TILE_H)
            if led_every and j % led_every == 0:              # a glowing strip up this edge, just proud of the facade
                out = lambda v: Vector((v.co.x - cx, v.co.y - cy, 0)).normalized() * 0.25
                p0, p1 = a.co + out(a), d.co + out(d)
                q0, q1 = p0.lerp(b.co + out(b), 1.2 / max(edge, 1.3)), p1.lerp(c.co + out(c), 1.2 / max(edge, 1.3))
                s = bm.faces.new([bm.verts.new(p0), bm.verts.new(q0), bm.verts.new(q1), bm.verts.new(p1)])
                s.material_index = 1
    top = bm.faces.new(rings[-1])
    top.material_index = 3
    # spire and aviation beacons
    rt = radii[-1]
    sp = bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=max(0.6, rt * 0.12), radius2=0.15, depth=H * 0.14,
                               matrix=Matrix.Translation((cx, cy, H + H * 0.07)))
    for f in {f for v in sp["verts"] for f in v.link_faces}:
        f.material_index = 3
    for (bx, by, bz) in [(cx, cy, H * 1.14 + 0.8)] + [(cx + rt * 0.8 * math.cos(a), cy + rt * 0.8 * math.sin(a), H + 1.0)
                                                     for a in (0.3, 1.87, 3.44, 5.01)]:
        r = bmesh.ops.create_cube(bm, size=1.6, matrix=Matrix.Translation((bx, by, bz)))
        for f in {f for v in r["verts"] for f in v.link_faces}:
            f.material_index = 2


def supertalls():
    """Six original supertalls 3-5 km out, beyond the skylines: silhouettes that read against the dusk and night sky.
    Low-poly lofts (~350 tris each) in one mesh; the viewer keeps fog off their materials (M_Supertall*) so distance
    doesn't erase them, and blinks their beacons."""
    xs = [p[0] for p in G.C["points"]]
    ys = [p[1] for p in G.C["points"]]
    w, e = min(xs), max(xs)
    leds = {"violet": (0.62, 0.28, 1.0), "cyan": (0.1, 0.85, 1.0), "magenta": (1.0, 0.15, 0.6), "warm": (1.0, 0.8, 0.55)}
    # name, x, y, height, radius, sides, twist, taper, setbacks, led colour, led every n edges
    TOWERS = [
        ("twist", w - 3000, 450, 560, 36, 6, 100, 0.45, [], "violet", 1),
        ("needle", w - 3400, 1150, 470, 26, 8, 0, 0.55, [(0.55, 0.85), (0.8, 0.8)], "cyan", 2),
        ("stepped", w - 2450, -500, 620, 42, 4, 12, 0.6, [(0.3, 0.88), (0.55, 0.85), (0.78, 0.8)], "warm", 1),
        ("east_twist", e + 3650, 350, 500, 34, 5, -70, 0.5, [], "magenta", 1),
        ("east_slab", e + 3250, 1250, 420, 30, 4, 0, 0.75, [(0.7, 0.8)], "cyan", 2),
        ("south", 900, min(ys) - 4200, 520, 32, 8, 45, 0.5, [(0.6, 0.85)], "violet", 2),
    ]
    facades = [facade_material("supertall_glass", 21, (0.2, 0.22, 0.25), (0.04, 0.06, 0.09), (0.8, 0.9, 1.0), 0.3),
               facade_material("supertall_warm", 22, (0.12, 0.12, 0.13), (0.05, 0.05, 0.06), (1.0, 0.8, 0.5), 0.4)]
    for m, n in zip(facades, ("M_Supertall_glass", "M_Supertall_warm")):
        m.name = n
    roof = G.pbr("M_Supertall_roof", color=(0.15, 0.16, 0.18), rough=0.4, metal=0.6)
    beacon = G.pbr("M_SupertallBeacon", color=(0.9, 0.03, 0.02), emit=((1.0, 0.04, 0.02), 8.0))
    for k, (name, x, y, H, R, sides, twist, taper, setbacks, led, every) in enumerate(TOWERS):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new("UVMap")
        supertall_loft(bm, uv, x, y, H, R, sides, twist, taper, setbacks, every)
        led_m = G.pbr(f"M_SupertallLED_{led}", color=leds[led], emit=(leds[led], 6.0))
        me = mesh_from_bm(f"supertall_{name}", bm, [facades[k % 2], led_m, beacon, roof])
        G.VIS.objects.link(bpy.data.objects.new(f"supertall_{name}", me))
    print("supertalls:", len(TOWERS))


def run(g):
    global G
    G = dress.G = __import__("types").SimpleNamespace(**g)
    skyline()
    hotel()
    supertalls()
