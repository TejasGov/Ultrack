"""Paddock and team presence for the Corniche Marina Circuit: the paved paddock behind the garages, team transporters
and hospitality motorhomes, team flags (one wind direction for all), pole banners and grandstand roof fascia boards.

Called by build_blender.py (paddock.run(globals())) after venue.py.
TEAMS ARE INVENTED, like the sponsors in venue.py: check the names before release and never use a real team's.
The seven teams, their colours and their pit boxes come from assets/teams/teams.json, the file the game reads. Team-font
artwork (garage headers, box floors, flags) is drawn by the viewer onto the per-team materials made here.
"""
import json, math, os, random

import bmesh, bpy
from mathutils import Matrix, Vector

import dress
import venue
from dress import add_box, facing, mesh_from_bm, place, save_image, text_mesh, textured

G = None

def _lin(hexc):
    return tuple(((int(hexc[k:k + 2], 16) / 255 + 0.055) / 1.055) ** 2.4 for k in (1, 3, 5))


_TEAMS_JSON = json.load(open(os.path.join(os.path.dirname(__file__), "..", "..", "assets", "teams", "teams.json"), encoding="utf8"))["teams"]
# name, primary, secondary (linear), as the meshes below use them
TEAMS = [(t["name"].upper(), _lin(t["colors"]["primary"]), _lin(t["colors"]["secondary"])) for t in _TEAMS_JSON]
BOX_TEAM = {b: k for k, t in enumerate(_TEAMS_JSON) for b in t["pitBoxes"]}     # pit box id -> team index
WIND_YAW = 0.0     # every flag streams east, away from the sea: one wind for the whole venue
PADDOCK_IN = None  # lateral distance of the garages' back wall (set in run)


def team_mats(k):
    name, p, s = TEAMS[k]
    return (G.pbr(f"M_Team_{name}_primary", color=p, rough=0.25, metal=0.2),
            G.pbr(f"M_Team_{name}_secondary", color=s, rough=0.3))


# ------------------------------------------------------------------------------------------------ flags and banners

def flag_texture(k):
    _, p, s = TEAMS[k]
    pattern = k % 4

    def px(x, y):
        if pattern == 0:
            c = s if 1 / 3 < y < 2 / 3 else p                      # horizontal band
        elif pattern == 1:
            c = s if abs((x - y) * 0.7) < 0.12 else p              # diagonal sash
        elif pattern == 2:
            c = s if abs(y - 0.5) < 0.42 - 0.6 * x and x < 0.7 else p    # chevron at the hoist
        else:
            c = s if (x < 0.5) != (y < 0.5) else p                 # quartered
        return [*c, 1.0]
    return textured(f"M_Flag_{TEAMS[k][0]}", save_image(f"flag_{TEAMS[k][0].lower()}", 128, 80, px), rough=0.7, double=True)


def flag_mesh(k, pole_h=6.0):
    """Pole plus a 2.4 x 1.5 m cloth streaming along +X, rippling more toward the free end."""
    mat = flag_texture(k)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    add_box(bm, (0, 0, pole_h / 2), (0.07, 0.07, pole_h), mat=1)
    add_box(bm, (0, 0, pole_h + 0.06), (0.14, 0.14, 0.12), mat=1)
    nu, nv, L_, H = 8, 3, 2.4, 1.5
    grid = []
    for j in range(nv + 1):
        row = []
        for i in range(nu + 1):
            u = i / nu
            x = 0.05 + u * L_
            y = 0.22 * math.sin(2 * math.pi * u * 1.4 + 0.6) * u
            z = pole_h - 0.1 - H * (1 - j / nv) - 0.18 * u * u
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new([grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]])
            f.material_index, f.smooth = 0, True
            for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uv].uv = (a / nu, b / nv)
    return mesh_from_bm(f"flag_{TEAMS[k][0].lower()}", bm, [mat, G.M["metal"]])


FLAG_MESHES = []    # one per team, reused by vip.py for the plaza's flags


def flags():
    meshes = FLAG_MESHES[:] = [flag_mesh(k) for k in range(len(TEAMS))]
    n = 0
    for b in G.PIT["boxes"]:                                       # one per garage, on the roof's front edge
        i = b["idx"]
        x, y = G.L.offset(G.C, i, G.pd[i] + G.L.PIT_HALF + 2.0 - 2.4)
        place(f"flag_pit_{b['id']:02d}", meshes[BOX_TEAM.get(b["id"], 0)], (x, y, 8.4), WIND_YAW)
        n += 1
    for name, (idxs, base, sg) in venue.STANDS.items():            # along the back edge of every grandstand roof
        for k, i in enumerate(idxs[::6]):
            i %= G.N
            x, y = G.L.offset(G.C, i, sg * (base(i) + G.STAND[-1][0] + 0.3))
            place(f"flag_{name}_{k:02d}", meshes[(k + len(name)) % len(TEAMS)], (x, y, 14.2), WIND_YAW)
            n += 1
    print("flags:", n)


def vertical_banner(k, w, h):
    """A sponsor's vertical pole banner: panel w x h (face looks -Y), name reading bottom to top."""
    name, tag, bg, fg, _ = venue.SPONSORS[k]
    brand=venue.brand_art.LOOKUP.get(name.upper())
    if brand:return venue.brand_art.board_mesh('pole_banner_'+str(k)+'_'+str(w)+'x'+str(h),brand,w,h)
    panel = G.pbr(f"M_Banner_{k}_bg", color=bg, rough=0.6, double=True)
    ink = G.pbr(f"M_Banner_{k}_fg", color=fg, rough=0.5)
    tm = text_mesh(f"banner_{k}_text", name, w * 0.62, ink)
    xs = [v.co.x for v in tm.vertices]
    tw = max(xs) - min(xs)
    sc = min(1.0, h * 0.86 / tw)
    # rotate the text to run up the banner, then centre it on the panel just in front of the face
    tm.transform(Matrix.Translation((w * 0.22 * sc, -0.012, h / 2)) @ Matrix.Rotation(-math.pi / 2, 4, "Y") @ Matrix.Diagonal((sc, 1, sc, 1)))
    bm = bmesh.new()
    bm.from_mesh(tm)
    bpy.data.meshes.remove(tm)
    for f in bm.faces:
        f.material_index = 1
    add_box(bm, (0, 0, h / 2), (w, 0.015, h), mat=0)
    add_box(bm, (0, 0, h + 0.04), (w + 0.1, 0.04, 0.04), mat=2)       # top rod
    add_box(bm, (0, 0, -0.04), (w + 0.1, 0.04, 0.04), mat=2)          # bottom rod
    return mesh_from_bm(f"pole_banner_{k}_{w:g}x{h:g}", bm, [panel, ink, G.M["metal"]])


def nearest_side(p):
    j = min(range(0, G.N, 2), key=lambda q: math.dist(p, G.C["points"][q]))
    h = G.C["heading"][j]
    lat = (p[0] - G.C["points"][j][0]) * -math.sin(h) + (p[1] - G.C["points"][j][1]) * math.cos(h)
    return j, (1 if lat > 0 else -1)


def pole_banners():
    small = [vertical_banner(k, 0.7, 1.8) for k in range(len(venue.SPONSORS))]
    big = [vertical_banner(k, 1.1, 3.4) for k in range(len(venue.SPONSORS))]
    n = 0
    for ob in [o for o in G.VIS.objects if o.name.startswith(("street_lamp_", "floodlight_"))]:
        p = (ob.location.x, ob.location.y)
        j, sg = nearest_side(p)
        yaw = facing(j, sg)
        fx, fy = math.sin(yaw), -math.cos(yaw)                        # local -Y: toward the track
        if ob.name.startswith("street_lamp_"):
            place(f"pole_banner_{n:03d}", small[n % len(small)], (p[0] + fx * 0.18, p[1] + fy * 0.18, 1.5), yaw)
        else:
            place(f"pole_banner_{n:03d}", big[n % len(big)], (p[0] + fx * 0.4, p[1] + fy * 0.4, 3.5), yaw)
        n += 1
    print("pole banners:", n)


def fascia_boards():
    boards = [venue.sponsor_board(f"fascia_{k}", s, 12.0, 1.4) for k, s in enumerate(venue.SPONSORS)]
    n = 0
    for name, (idxs, base, sg) in venue.STANDS.items():
        for k, i in enumerate(idxs[4::9]):
            i %= G.N
            x, y = G.L.offset(G.C, i, sg * (base(i) - 2.05))
            place(f"fascia_{name}_{k:02d}", boards[(k * 3 + len(name)) % len(boards)], (x, y, 11.65), facing(i, sg))
            n += 1
    print("fascia boards:", n)


# ------------------------------------------------------------------------------------------------ team pit boxes

def placeholder_tex(k, kind):
    """A per-team material for artwork the viewer draws (team font): a solid team-colour stand-in keeps the UVs."""
    p = TEAMS[k][1]
    im = save_image(f"{kind.lower()}_{TEAMS[k][0].lower()}", 8, 8, lambda x, y: [*p, 1.0])
    return textured(f"M_{kind}_{TEAMS[k][0]}", im, rough=0.45, emit=((1.0, 1.0, 1.0), 0.6) if kind == "GarageHeader" else None)


def quad(bm, corners, uvs, uv, mat):
    f = bm.faces.new([bm.verts.new(c) for c in corners])
    f.material_index = mat
    for lp, t in zip(f.loops, uvs):
        lp[uv].uv = t


def pit_boxes():
    """Each team's two boxes: a lit header over each garage door and the team's panel painted on the box floor."""
    heads = [placeholder_tex(k, "GarageHeader") for k in range(len(TEAMS))]
    floors = [placeholder_tex(k, "PitBox") for k in range(len(TEAMS))]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    mats = heads + floors
    for b in G.PIT["boxes"]:
        k, i = BOX_TEAM.get(b["id"], 0), b["idx"]
        h = G.C["heading"][i]
        fx, fy = math.cos(h), math.sin(h)
        # header: 10 x 1.6 m over the 10 m door, just proud of the facade, wound to face the pit lane like the door
        x, y = G.L.offset(G.C, i, G.pd[i] + G.L.PIT_HALF + 1.9)
        quad(bm, [(x + fx * a, y + fy * a, z) for a, z in ((-5, 5.6), (5, 5.6), (5, 7.2), (-5, 7.2))],
             [(0, 0), (1, 0), (1, 1), (0, 1)], uv, k)
        # floor panel on the box: 9 m along the lane x 5 m across, reading from the pit lane's inner side
        bx, by = b["pos"]
        nx, ny = -fy, fx                                                # left of travel: toward the garages
        c = [(bx + fx * a + nx * l, by + fy * a + ny * l, 0.035) for a, l in ((-4.5, -2.5), (4.5, -2.5), (4.5, 2.5), (-4.5, 2.5))]
        quad(bm, c, [(0, 0), (1, 0), (1, 1), (0, 1)], uv, len(TEAMS) + k)
    me = mesh_from_bm("team_pit_boxes", bm, mats)
    G.VIS.objects.link(bpy.data.objects.new("team_pit_boxes", me))
    print("pit boxes:", len(G.PIT["boxes"]), "teams", len(TEAMS))


# ------------------------------------------------------------------------------------------------ paddock

def wheel(bm, x, y, r=0.5, w=0.32, mat=2):
    m = Matrix.Translation((x, y, r)) @ Matrix.Rotation(math.pi / 2, 4, "X")
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r, radius2=r, depth=w, matrix=m)
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mat


def transporter_mesh(k):
    """Articulated team truck, rear at x=0, nose toward +X: trailer in team colours with a stripe and the name."""
    prim, sec = team_mats(k)
    tyre = G.pbr("M_Tyre", color=(0.02, 0.02, 0.02), rough=0.8)
    glass = G.pbr("M_TruckGlass", color=(0.02, 0.03, 0.04), rough=0.05, metal=0.5)
    bm = bmesh.new()
    add_box(bm, (6.8, 0, 2.55), (13.6, 2.55, 2.9), mat=0)                  # trailer box
    add_box(bm, (6.8, 0, 1.75), (13.62, 2.57, 0.45), mat=1)                # livery stripe
    add_box(bm, (6.8, 0, 0.95), (13.0, 2.4, 0.3), mat=2)                   # chassis
    add_box(bm, (15.1, 0, 2.3), (2.5, 2.5, 2.6), mat=0)                    # tractor cab
    add_box(bm, (16.36, 0, 2.75), (0.02, 2.2, 1.1), mat=3)                 # windscreen
    add_box(bm, (14.2, 0, 0.95), (4.0, 2.3, 0.4), mat=2)
    for x in (1.6, 2.9, 4.2, 13.2, 15.6):
        for y in (-1.05, 1.05):
            wheel(bm, x, y)
    name = TEAMS[k][0]
    for side in (-1, 1):                                                   # the name on both trailer sides
        tm = text_mesh(f"truck_{name}_{side}", name, 1.1, prim)
        tm.transform(Matrix.Translation((7.0, side * 1.29, 2.75)) @ Matrix.Rotation(0 if side < 0 else math.pi, 4, "Z"))
        before = set(bm.faces)
        bm.from_mesh(tm)
        for f in set(bm.faces) - before:
            f.material_index = 1
        bpy.data.meshes.remove(tm)
    return mesh_from_bm(f"transporter_{name.lower()}", bm, [prim, sec, tyre, glass])


def motorhome_mesh(k):
    """Two-storey hospitality unit, front (glass and awning) facing local -Y."""
    prim, sec = team_mats(k)
    glass = G.pbr("M_HospGlass", color=(0.03, 0.05, 0.06), rough=0.04, metal=0.5, emit=((1.0, 0.85, 0.6), 0.25))
    bm = bmesh.new()
    add_box(bm, (0, 0, 3.6), (16.0, 6.0, 7.2), mat=0)
    add_box(bm, (0, -3.01, 4.9), (15.0, 0.02, 2.0), mat=2)                 # upper glass band
    add_box(bm, (0, -3.01, 1.6), (15.0, 0.02, 2.2), mat=2)                 # ground floor glazing
    add_box(bm, (0, -5.0, 3.1), (16.0, 4.0, 0.12), mat=1)                  # awning
    for x in (-7.8, 7.8):
        add_box(bm, (x, -6.9, 1.55), (0.1, 0.1, 3.1), mat=1)
    tm = text_mesh(f"motorhome_{TEAMS[k][0]}", TEAMS[k][0], 0.9, sec)
    tm.transform(Matrix.Translation((0, -3.04, 6.1)))
    before = set(bm.faces)
    bm.from_mesh(tm)
    for f in set(bm.faces) - before:
        f.material_index = 1
    bpy.data.meshes.remove(tm)
    return mesh_from_bm(f"motorhome_{TEAMS[k][0].lower()}", bm, [prim, sec, glass])


def paddock():
    global PADDOCK_IN
    PADDOCK_IN = G.L.PIT_OFFSET + G.L.PIT_HALF + 2.0 + 16.0          # back wall of the garages
    first = G.garage_idx[0]
    idxs = [(first - 14 + j) % G.N for j in range(len(G.garage_idx) + 28)]
    G.wall("paddock_floor", idxs, lambda i: PADDOCK_IN, 1, profile=[(0, 0.01), (40.0, 0.01)], mat="paved", collide_h=0)
    trucks = [transporter_mesh(k) for k in range(len(TEAMS))]
    homes = [motorhome_mesh(k) for k in range(len(TEAMS))]
    for b in G.PIT["boxes"]:
        i = b["idx"]
        x, y = G.L.offset(G.C, i, PADDOCK_IN + 2.5)
        place(f"transporter_{b['id']:02d}", trucks[BOX_TEAM.get(b["id"], 0)], (x, y, 0.0), G.C["heading"][i] + math.pi / 2)
    # hospitality row further back, one unit per team, facing the garages
    span = [G.garage_idx[j] for j in range(0, len(G.garage_idx), max(1, len(G.garage_idx) // len(TEAMS)))][:len(TEAMS)]
    for k, i in enumerate(span):
        x, y = G.L.offset(G.C, i, PADDOCK_IN + 29.0)
        place(f"motorhome_{k:02d}", homes[k], (x, y, 0.0), facing(i, 1))
    print("paddock: transporters", len(G.PIT["boxes"]), "motorhomes", len(span))


def run(g):
    global G
    G = dress.G = venue.G = __import__("types").SimpleNamespace(**g)
    paddock()
    pit_boxes()
    flags()
    pole_banners()
    fascia_boards()
