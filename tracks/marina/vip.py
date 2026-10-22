"""The Corniche Club: the VIP pavilion in the middle of the infield, low and wide rather than tall.

A stone plinth with two glass storeys (warm interiors after dark) under one floating, lens-shaped canopy roof with a lit
underside and an LED edge. On the south terrace, facing the start/finish straight across the paddock, the commentary
booth cantilevers out with a balcony where the announcers stand (their spots go to out/vip.json; the viewer puts Enzo and
Alastair there). Eight team banners hang from the canopy edge and the teams' flags line the plaza; their artwork (team
fonts) is drawn by the viewer onto the per-team materials M_TeamBanner_* and M_Flag_* (paddock.py). The booth's sign
(M_VipSign) is drawn there too.

Called by build_blender.py (vip.run(globals())) after paddock.py. All positions are layout metres (x east, y north).
"""
import json, math, os

import bmesh, bpy
from mathutils import Matrix

import dress
import paddock
from dress import add_box, mesh_from_bm, place, save_image, textured

G = None
CX, CY = 0.0, 330.0               # centre of the pavilion: mid-infield, ~330 m north of the start/finish line
W, D = 200.0, 70.0                # plinth
Z1, Z2, Z3 = 1.2, 6.6, 11.2       # ground floor, first floor slab top, first floor ceiling
ROOF_Z, ROOF_A, ROOF_B = 13.6, 120.0, 50.0    # canopy underside height and half-axes (lens: superellipse)


def mats():
    p = G.pbr
    return dict(
        white=p("M_VipWhite", color=(0.78, 0.78, 0.76), rough=0.35),
        stone=p("M_VipStone", color=(0.42, 0.38, 0.33), rough=0.75),
        plaza=p("M_VipPlaza", color=(0.17, 0.155, 0.14), rough=0.85),
        road=p("M_VipRoad", color=(0.06, 0.06, 0.065), rough=0.7),
        glass=p("M_VipGlass", color=(0.03, 0.045, 0.055), rough=0.04, metal=0.6, emit=((1.0, 0.82, 0.58), 0.16)),   # stronger read as flat light boxes at night
        frame=p("M_VipFrame", color=(0.04, 0.04, 0.045), rough=0.4, metal=0.8),
        roof=p("M_VipRoof", color=(0.5, 0.5, 0.49), rough=0.45, metal=0.3, double=True),   # a bright mirror flared in the low sun
        glow=p("M_VipGlow", color=(1.0, 0.9, 0.75), emit=((1.0, 0.86, 0.66), 2.5)),
        edge=p("M_VipEdge", color=(1.0, 0.85, 0.6), emit=((1.0, 0.8, 0.5), 4.0)),
        rail=G.M.get("balustrade") or p("M_StandGlass", color=(0.12, 0.16, 0.18), rough=0.05, metal=0.2),
    )


def at(x, y):
    return (CX + x, CY + y)


def lens(t, a, b, n=3.2):
    """Superellipse outline point at angle t: a soft lens, flatter than an ellipse along the long sides."""
    c, s = math.cos(t), math.sin(t)
    return a * math.copysign(abs(c) ** (2 / n), c), b * math.copysign(abs(s) ** (2 / n), s)


def canopy(M):
    """Floating roof: flat lit underside, a shallow dome on top with a ring of skylights, thin at the rim; warm LED line around the edge."""
    bm = bmesh.new()
    N, R = 96, 6
    top, bot = [], []
    for k in range(R + 1):
        r = k / R
        zt = ROOF_Z + 0.3 + 1.5 * (1 - r * r)
        top.append([bm.verts.new((CX + x * r, CY + y * r, zt)) for x, y in (lens(2 * math.pi * j / N, ROOF_A, ROOF_B) for j in range(N))])
        bot.append([bm.verts.new((CX + x * r, CY + y * r, ROOF_Z)) for x, y in (lens(2 * math.pi * j / N, ROOF_A, ROOF_B) for j in range(N))])
    for k in range(R):
        for j in range(N):
            a, b = j, (j + 1) % N
            bm.faces.new([top[k][a], top[k][b], top[k + 1][b], top[k + 1][a]]).material_index = 3 if k == 3 else 0   # skylight ring
            bm.faces.new([bot[k][a], bot[k + 1][a], bot[k + 1][b], bot[k][b]]).material_index = 0
    for j in range(N):                                     # the rim: an emissive band, 0.3 m tall
        a, b = j, (j + 1) % N
        bm.faces.new([bot[R][a], bot[R][b], top[R][b], top[R][a]]).material_index = 1
    bmesh.ops.remove_doubles(bm, verts=[v for ring in (top[0], bot[0]) for v in ring], dist=0.01)
    # lit underside: long strips following the lens, just below the soffit
    for r in (0.25, 0.5, 0.75, 0.92):
        pts = [lens(2 * math.pi * j / N, ROOF_A * r, ROOF_B * r) for j in range(N)]
        for j in range(N):
            (x0, y0), (x1, y1) = pts[j], pts[(j + 1) % N]
            L = math.hypot(x1 - x0, y1 - y0)
            add_box(bm, (CX + (x0 + x1) / 2, CY + (y0 + y1) / 2, ROOF_Z - 0.06), (L, 0.18, 0.1), mat=2,
                    rot=Matrix.Rotation(math.atan2(y1 - y0, x1 - x0), 4, "Z"))
    me = mesh_from_bm("vip_canopy", bm, [M["roof"], M["edge"], M["glow"], M["glass"]])
    G.VIS.objects.link(bpy.data.objects.new("vip_canopy", me))


def building(M):
    bm = bmesh.new()
    S = lambda x, y, z, sx, sy, sz, m: add_box(bm, (CX + x, CY + y, z), (sx, sy, sz), mat=m)
    S(0, 0, Z1 / 2, W, D, Z1, 1)                                         # stone plinth
    for s in range(3):                                                   # three broad steps up from the plaza, south side
        h = Z1 * (3 - s) / 3
        S(0, -D / 2 - 0.6 - s * 1.2, h / 2, W * 0.5, 1.2, h, 1)
    S(0, 4, (Z1 + Z2 - 0.45) / 2, 180, 52, Z2 - 0.45 - Z1, 2)            # ground floor glass
    S(0, 0, Z2 - 0.22, W, D - 4, 0.45, 0)                                # first floor slab (its south edge is the terrace)
    S(0, 7, (Z2 + Z3) / 2, 186, 46, Z3 - Z2, 2)                          # first floor glass, set back: a 12 m terrace
    S(0, 7, Z3 + 0.2, 188, 48, 0.4, 0)                                   # its roof slab
    for x in range(-90, 91, 6):                                          # mullions on both glass storeys
        S(x, 4 - 26.05, (Z1 + Z2) / 2, 0.14, 0.12, Z2 - Z1, 3)
        S(x, 7 - 23.05, (Z2 + Z3) / 2, 0.14, 0.12, Z3 - Z2, 3)
    for x in range(-108, 109, 24):                                       # slim columns up to the canopy
        for y in (-30, 30):
            r = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.35, radius2=0.25, depth=ROOF_Z - Z1,
                                      matrix=Matrix.Translation((CX + x, CY + y, (ROOF_Z + Z1) / 2)))
            for f in {f for v in r["verts"] for f in v.link_faces}:
                f.material_index = 0
    # terrace balustrade along the slab's south edge, leaving a gap for the booth
    for x0, x1 in ((-W / 2 + 1, -9), (9, W / 2 - 1)):
        S((x0 + x1) / 2, -(D - 4) / 2 + 0.1, Z2 + 0.55, x1 - x0, 0.04, 1.1, 4)
    me = mesh_from_bm("vip_building", bm, [M["white"], M["stone"], M["glass"], M["frame"], M["rail"]])
    G.VIS.objects.link(bpy.data.objects.new("vip_building", me))


def booth(M):
    """The commentary booth: a glazed box cantilevered 8 m beyond the terrace, a balcony in front, a lit sign above."""
    bm = bmesh.new()
    S = lambda x, y, z, sx, sy, sz, m: add_box(bm, (CX + x, CY + y, z), (sx, sy, sz), mat=m)
    yf = -(D - 4) / 2 - 8.0                                              # booth front, 8 m out from the slab edge
    S(0, yf + 4.0, Z2 - 0.3, 18, 8.0, 0.6, 0)                            # floor slab
    S(0, yf + 4.0, Z3 + 0.6, 18.4, 8.4, 0.5, 0)                          # roof
    S(0, yf + 0.25, (Z2 + Z3 + 0.4) / 2, 17.6, 0.12, Z3 + 0.35 - Z2, 1)  # glass front
    for sx in (-1, 1):
        S(sx * 8.9, yf + 4.0, (Z2 + Z3 + 0.4) / 2, 0.25, 8.0, Z3 + 0.35 - Z2, 2)   # dark side frames
    S(0, yf - 1.3, Z2 - 0.25, 16, 2.6, 0.3, 0)                           # balcony
    S(0, yf - 2.55, Z2 + 0.45, 16, 0.04, 1.0, 3)                         # its glass rail
    for sx in (-1, 1):
        S(sx * 8.0, yf - 1.3, Z2 + 0.45, 0.04, 2.6, 1.0, 3)
    me = mesh_from_bm("vip_booth", bm, [M["white"], M["glass"], M["frame"], M["rail"]])
    G.VIS.objects.link(bpy.data.objects.new("vip_booth", me))
    # the sign over the glass: artwork from the viewer (M_VipSign); 14 x 1.4 m, facing south
    im = save_image("vip_sign", 8, 8, lambda x, y: [0.02, 0.02, 0.025, 1.0])
    sign = textured("M_VipSign", im, rough=0.4, emit=((1.0, 1.0, 1.0), 0.8))
    sb = bmesh.new()
    uv = sb.loops.layers.uv.new("UVMap")
    y = CY + yf - 0.3
    f = sb.faces.new([sb.verts.new((CX + x, y, z)) for x, z in ((-7, Z3 + 0.95), (7, Z3 + 0.95), (7, Z3 + 2.35), (-7, Z3 + 2.35))])
    for lp, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        lp[uv].uv = t
    G.VIS.objects.link(bpy.data.objects.new("vip_sign", mesh_from_bm("vip_sign", sb, [sign])))
    # the announcers' spots at the balcony rail, facing south over the paddock (written to vip.json for the viewer:
    # two placeholders are too few for the packer to keep as named instances)
    return [dict(pos=G.L.to_game(CX + x, CY + yf - 1.9, Z2 - 0.1), yawRad=0.0) for x in (-2.2, 2.2)]


BANNER_X = {"saetta": -22, "toro": -40, "corvid": -58, "mojave": 22, "aurum": 40, "sarab": 58, "liberty": 76}   # metres from the pavilion centre


def banners(M):
    """Seven team banners (Kalt's was removed), 5 x 8 m, hanging from the canopy in front of the south facade, three west and four east of the booth."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    mats_ = []
    for k, (name, prim, _) in enumerate(paddock.TEAMS):
        im = save_image(f"banner_{name.lower()}", 8, 8, lambda x, y, p=prim: [*p, 1.0])
        mats_.append(textured(f"M_TeamBanner_{name}", im, rough=0.6, double=True))
        x = BANNER_X[name.lower()]                          # four on the west side (Saetta and Toro, her rival, nearest the booth), four on the east
        y = CY - 40.0
        f = bm.faces.new([bm.verts.new((CX + x + a, y, z)) for a, z in ((-2.5, 4.8), (2.5, 4.8), (2.5, 12.8), (-2.5, 12.8))])
        f.material_index = k
        for lp, t in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            lp[uv].uv = t
        add_box(bm, (CX + x, y, 12.9), (5.4, 0.08, 0.08), mat=len(paddock.TEAMS))          # hanging rod
        add_box(bm, (CX + x, y, ROOF_Z - 0.4), (0.05, 0.05, ROOF_Z - 12.9), mat=len(paddock.TEAMS))
    me = mesh_from_bm("vip_banners", bm, mats_ + [M["frame"]])
    G.VIS.objects.link(bpy.data.objects.new("vip_banners", me))


def grounds(M):
    """Plaza, the access road from the paddock, team flags along the plaza's south edge, and palms."""
    bm = bmesh.new()
    N = 72
    c = bm.verts.new((CX, CY - 8, 0.02))
    ring = [bm.verts.new((CX + x, CY - 8 + y, 0.02)) for x, y in (lens(2 * math.pi * j / N, 150, 78) for j in range(N))]
    for j in range(N):
        bm.faces.new([c, ring[j], ring[(j + 1) % N]]).material_index = 0
    y_plaza = CY - 8 - 78
    road_y0 = paddock.PADDOCK_IN + 45.0
    add_box(bm, (CX, (road_y0 + y_plaza) / 2, 0.015), (14, y_plaza - road_y0 + 4, 0.03), mat=1)
    me = mesh_from_bm("vip_grounds", bm, [M["plaza"], M["road"]])
    G.VIS.objects.link(bpy.data.objects.new("vip_grounds", me))
    # flags: each team twice, in one line along the plaza's south edge
    flags = paddock.FLAG_MESHES
    n = 0
    for j, x in enumerate(range(-110, 111, 20)):
        place(f"flag_vip_{j:02d}", flags[j % len(flags)], (CX + x, CY - 66.0, 0.0), paddock.WIND_YAW, scale=1.6)
        n += 1
    # palms around the plaza: linked copies of the venue's own palm meshes
    palms = sorted({o.data for o in G.VIS.objects if o.name.startswith("palm") and o.type == "MESH"}, key=lambda m: m.name)[:3]
    for j in range(N // 3):
        t = 2 * math.pi * (j + 0.5) / (N // 3)
        x, y = lens(t, 162, 88)
        if palms and (abs(x) > 12 or y > 0):                              # keep the road's mouth clear
            place(f"palm_vip_{j:02d}", palms[j % len(palms)], (CX + x, CY - 8 + y, 0.0), t * 1.7)
    print("vip: pavilion, booth,", len(paddock.TEAMS), "banners,", n, "flags")


def run(g):
    global G
    G = dress.G = paddock.G = __import__("types").SimpleNamespace(**g)
    M = mats()
    building(M)
    canopy(M)
    spots = booth(M)
    banners(M)
    grounds(M)
    with open(os.path.join(G.OUT, "vip.json"), "w", encoding="utf8") as f:
        json.dump(dict(name="Corniche Club", announcers=spots), f, indent=2)
