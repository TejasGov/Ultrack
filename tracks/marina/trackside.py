"""Trackside pass for the Corniche Marina Circuit: what makes it read as a real circuit at road level.

Called by build_blender.py (trackside.run(globals())) after life.py:
- steel box-truss gantries over the straights and truss footbridges, built from 3 m modules exported as GPU instances
  (each module type has a solid stand-in, material name ending in "Far": the viewer's Culler swaps per instance);
- big brand billboards on scaffold frames along the straights;
- tiered paddock/hotel buildings beside the main straight, the tallest carrying the stadium name;
- legend name boards on the grandstands and the banks, and the anchor for the legend hologram (track.json landmarks).
Names and brand colours come from legends.json (a fan tribute by the user's call; logos are text and simple shapes).
"""
import json, math, os
from types import SimpleNamespace

import bmesh, bpy
from mathutils import Matrix, Vector

import dress
import venue
from dress import add_box, facing, facing_oncoming, mesh_from_bm, place, text_mesh

G = None
DATA = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "legends.json"), encoding="utf8"))
LANDMARKS = []          # read by build_blender.py into track.json "landmarks"
MOD = 3.0               # truss module length (m)
USED = set()            # samples already carrying a gantry, footbridge or billboard


def lin(hexstr):
    """sRGB hex -> linear RGB (Blender colour inputs are linear)."""
    c = [int(hexstr.lstrip("#")[k:k + 2], 16) / 255 for k in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def strut(bm, p0, p1, t, mat=0):
    d = Vector(p1) - Vector(p0)
    rot = d.to_track_quat("X", "Z").to_matrix().to_4x4()
    add_box(bm, (Vector(p0) + Vector(p1)) / 2, (d.length, t, t), mat=mat, rot=rot)


_water = []


def clear_of_track(x, y, i, margin=1.5):
    """True if (x, y) is outside every other part of the circuit's walls (or kerbs where it has none) and on land."""
    pts = G.C["points"]
    for j in range(0, G.N, 2):
        if min((i - j) % G.N, (j - i) % G.N) < 30:
            continue
        reach = max(G.SD["wall"]["L"][j] or 0, G.SD["wall"]["R"][j] or 0, G.HW[j] + G.L.KERB_W)
        if math.dist((x, y), pts[j]) < reach + margin:
            return False
    if not _water:
        _water.append(G.L.water_polygon(G.C))
    return not G.L.point_in_poly((x, y), _water[0])


def name_board(key, text, w, h, bg, fg, emissive=0.0, masts=0.0):
    """Panel w x h (face at y=0 looking -Y, bottom at z=0), text fitted to 90 % of it, optional two masts reaching
    `masts` below the panel. Text is mesh (Blender's built-in font)."""
    panel = G.pbr(f"M_Name_{key}_bg", color=bg, rough=0.45, emit=(bg, emissive * 0.3) if emissive else None)
    ink = G.pbr(f"M_Name_{key}_fg", color=fg, rough=0.4, emit=(fg, 0.5 + 2 * emissive) if emissive else None)
    tm = text_mesh(f"name_{key}_text", text, h * 0.62, ink)
    xs = [v.co.x for v in tm.vertices]
    s = min(1.0, w * 0.9 / max(1e-3, max(xs) - min(xs)))
    tm.transform(Matrix.Translation((0, -0.05, h * 0.2)) @ Matrix.Diagonal((s, 1, s, 1)))
    bm = bmesh.new()
    bm.from_mesh(tm)
    bpy.data.meshes.remove(tm)
    for f in bm.faces:
        f.material_index = 1
    add_box(bm, (0, 0.06, h / 2), (w, 0.12, h), mat=0)
    if masts:
        for x in (-w * 0.33, w * 0.33):
            add_box(bm, (x, 0.45, (h - masts) / 2), (0.4, 0.4, h + masts), mat=2)
    return mesh_from_bm(f"name_{key}", bm, [panel, ink, G.M["metal"]])


# ------------------------------------------------------------------------------------------------ truss modules

def truss_module(name, W, H, deck=None):
    """One 3 m box-truss module, x 0..MOD, y +-W/2, z +-H/2: four chords, an end frame, Warren diagonals on the sides,
    single diagonals top and bottom; optional deck plate (footbridge). Its Far stand-in is a solid box of the same
    bounds, so both have the same bounding sphere (the Culler swaps them at the same distance)."""
    bm = bmesh.new()
    c, hy, hz = 0.12, W / 2 - 0.06, H / 2 - 0.06
    for y in (-hy, hy):
        for z in (-hz, hz):
            add_box(bm, (MOD / 2, y, z), (MOD, c, c))
    for y in (-hy, hy):
        add_box(bm, (0.04, y, 0), (0.08, 0.08, 2 * hz))
        strut(bm, (0, y, -hz), (MOD / 2, y, hz), 0.07)
        strut(bm, (MOD / 2, y, hz), (MOD, y, -hz), 0.07)
    for z in (-hz, hz):
        add_box(bm, (0.04, 0, z), (0.08, 2 * hy, 0.08))
        strut(bm, (0, -hy if z > 0 else hy, z), (MOD, hy if z > 0 else -hy, z), 0.07)
    mats = [G.M["truss"]]
    if deck:
        add_box(bm, (MOD / 2, 0, -hz + 0.12), (MOD, 2 * hy - 0.1, 0.12), mat=1)
        mats.append(deck)
    near = mesh_from_bm(name, bm, mats)
    fb = bmesh.new()
    add_box(fb, (MOD / 2, 0, 0), (MOD, W, H))
    return near, mesh_from_bm(name + "_far", fb, [G.M["truss_far"]])


def put_module(pair, tag, k, loc, rot_euler):
    for me, sfx in zip(pair, ("", "_far")):
        ob = place(f"{tag}_{k:03d}{sfx}", me, loc, 0.0)
        ob.rotation_euler = rot_euler


def legs_clear(i):
    """Lateral positions of the two legs: just outside each wall, pushed out past any other part of the circuit."""
    out = []
    for side, sg in (("L", 1), ("R", -1)):
        lat = (G.SD["wall"][side][i] or (G.HW[i] + G.L.KERB_W)) + 2.5
        while lat < 160 and not clear_of_track(*G.L.offset(G.C, i, sg * lat), i):
            lat += 2.0
        if lat >= 160:
            return None
        out.append(sg * lat)
    return out


def truss_span(tag, i, pair, W, H, z_bottom, banner=True):
    """A truss across the track at sample i on two vertical truss legs; returns the span in metres."""
    legs = legs_clear(i)
    if legs is None:
        print(f"trackside: no room for {tag} at sample {i}")
        return 0, []
    h = G.C["heading"][i]
    left, right = legs
    n = math.ceil((left - right) / MOD)
    mid = (left + right) / 2
    start = mid - n * MOD / 2
    zc = z_bottom + H / 2
    k = 0
    leg_lats = (start + W / 2, start + n * MOD - W / 2)
    for m in range(n):                          # the beam: modules running from the right leg to the left one
        x, y = G.L.offset(G.C, i, start + m * MOD)
        put_module(pair, tag, k, (x, y, zc), (0, 0, h + math.pi / 2)); k += 1
    for lat in leg_lats:                                    # legs: modules stood on end, up to the beam
        x, y = G.L.offset(G.C, i, lat)
        for m in range(math.ceil(z_bottom / MOD)):
            put_module(pair, tag, k, (x, y, m * MOD), (0, -math.pi / 2, h)); k += 1   # z_bottom: a multiple of MOD
    if banner:                                  # a brand banner on each face: cars on this straight see the front
        brands = brand_boards(min(26.0, n * MOD - 8), min(2.4, H - 0.2))
        x, y = G.L.offset(G.C, i, 0)
        fx, fy = math.cos(h), math.sin(h)
        for face in (-1, 1):
            d = W / 2 + 0.08
            pick = (len(USED) + (face > 0)) % len(brands)
            place(f"{tag}_banner_{'front' if face < 0 else 'back'}", brands[pick],
                  (x + face * fx * d, y + face * fy * d, zc - min(2.4, H - 0.2) / 2), facing_oncoming(i) + (math.pi if face > 0 else 0))
    USED.update(range(i - 6, i + 7))
    return n * MOD, leg_lats


def gantries_and_footbridges():
    G.M["truss"] = G.pbr("M_Truss", color=(0.5, 0.52, 0.55), rough=0.4, metal=0.85)
    G.M["truss_far"] = G.pbr("M_TrussFar", color=(0.34, 0.35, 0.37), rough=0.5, metal=0.6)   # a solid box reads lighter
    gantry = truss_module("truss_gantry", 1.6, 2.4)
    deck = G.pbr("M_TrussDeck", color=(0.22, 0.23, 0.24), rough=0.7, metal=0.3)
    bridge = truss_module("truss_bridge", 3.2, 3.0, deck=deck)
    stair = bmesh.new()
    add_box(stair, (0, 0, 3.9), (4.0, 5.0, 7.8))
    stair_me = mesh_from_bm("truss_stair", stair, [G.M["concrete"]])
    out = []
    # Hairpin Approach and Back Straight A run side by side: a truss over one spans both, so their spots don't pair up
    for seg, at in (("T1-T2", 0.3), ("Hairpin Approach", 0.45), ("Second Straight", 0.6), ("Back Straight A", 0.75), ("Dune Link", 0.5)):
        a, m = G.L._seg_range(G.C, seg)
        i = (a + int(m * at)) % G.N
        s, _ = truss_span(f"gantry_{len(out)}", i, gantry, 1.6, 2.4, 6.0)
        if s:
            out.append(f"gantry {seg} {s:.0f} m")
    for seg, at in (("Hairpin Approach", 0.85), ("T1-T2", 0.75)):
        a, m = G.L._seg_range(G.C, seg)
        i = (a + int(m * at)) % G.N
        tag = f"footbridge_{len(out)}"
        s, legs = truss_span(tag, i, bridge, 3.2, 3.0, 6.0)
        if not s:
            continue
        out.append(f"footbridge {seg} {s:.0f} m")
        for lat in legs:                         # stair towers just outside each end
            sg = 1 if lat > 0 else -1
            x, y = G.L.offset(G.C, i, lat + sg * 4.0)
            place(f"{tag}_stair_{'L' if sg > 0 else 'R'}", stair_me, (x, y, 0.0), G.C["heading"][i])
    print("trackside trusses:", "; ".join(out))


# ------------------------------------------------------------------------------------------------ brand billboards

_brand_cache = {}


def brand_boards(w, h):
    key = (round(w, 1), round(h, 1))
    if key not in _brand_cache:
        _brand_cache[key] = [venue.sponsor_board(f"brand{k}_{key[0]:g}x{key[1]:g}", (b["name"], b["tag"], lin(b["bg"]), lin(b["fg"]), b["mark"]), w, h)
                             for k, b in enumerate(DATA["brands"])]
    return _brand_cache[key]


def scaffold_mesh(w, top):
    """Scaffold behind a billboard (board face at y=0, looking -Y): two rows of standards, ledgers and transoms every
    2 m, a walk deck, back-row braces."""
    bm = bmesh.new()
    cols = [-w / 2 + w * k / 7 for k in range(8)]
    rows = (0.25, 1.65)
    for x in cols:
        for y in rows:
            add_box(bm, (x, y, top / 2), (0.05, 0.05, top))
        for z in range(2, int(top), 2):
            add_box(bm, (x, 0.95, z), (0.05, 1.4, 0.05))
    for y in rows:
        for z in range(2, int(top) + 1, 2):
            add_box(bm, (0, y, z), (w, 0.05, 0.05))
    for k in range(7):                              # back-row braces, alternating direction
        a, b = cols[k], cols[k + 1]
        strut(bm, (a, 1.65, 0.1 if k % 2 else 4.0), (b, 1.65, 4.0 if k % 2 else 0.1), 0.05)
    add_box(bm, (0, 0.95, 5.0 - 0.03), (w, 1.5, 0.06), mat=1)
    deck = G.pbr("M_ScaffoldDeck", color=(0.35, 0.27, 0.17), rough=0.85)
    return mesh_from_bm("scaffold_frame", bm, [G.pbr("M_Scaffold", color=(0.62, 0.63, 0.64), rough=0.45, metal=0.9), deck])


def billboards():
    W, H, Z = 14.0, 4.5, 5.0
    boards = brand_boards(W, H)
    frame = scaffold_mesh(W, Z + H)
    stands = {i % G.N for idxs, _, _ in venue.STANDS.values() for i in idxs}
    heavy = set()                                   # venue.py's billboards stand 28 and 44 samples before these corners
    for k in G.L.corners(G.C):
        if any((k["id"] + " ").startswith(p) for p in G.L.HEAVY_BRAKING):
            heavy.update((k["start"] - b + j) % G.N for b in (28, 44) for j in range(-6, 7))
    n = 0
    for seg in G.C["segments"]:
        if seg[0] != "S" or seg[1] == "Main Straight":
            continue
        a, m = G.L._seg_range(G.C, seg[1])
        for j in range(6, m - 6, 26):
            i = (a + j) % G.N
            sg = 1 if (j // 26) % 2 else -1
            side = "L" if sg > 0 else "R"
            wd = G.SD["wall"][side][i]
            if wd is None or G.SD["street"][i] or i in stands or i in heavy or i in USED:
                continue
            yaw = facing_oncoming(i) + sg * math.radians(30)
            x, y = G.L.offset(G.C, i, sg * (wd + 11.0))
            ends = [(x + math.cos(yaw) * e * W / 2, y + math.sin(yaw) * e * W / 2) for e in (-1, 1)]
            if not all(clear_of_track(px, py, i, 2.0) for px, py in ends + [(x, y)]):
                continue
            place(f"brand_board_{n:02d}", boards[n % len(boards)], (x, y, Z), yaw)
            place(f"brand_scaffold_{n:02d}", frame, (x, y, 0.0), yaw)
            USED.update(range(i - 3, i + 4))
            n += 1
    print("trackside brand billboards:", n)


# ------------------------------------------------------------------------------------------------ paddock buildings

def tiered_building(name, length, depth, floors, sign=None):
    """A paddock hotel: glass floors with concrete slabs and fins, terraces stepping back from the track every three
    floors, glass balcony rails, a roof plant box and an optional lit name sign on the roof edge. Local frame: x along
    the track, the track-side face at y=0 looking -Y."""
    bm = bmesh.new()
    rail = G.M.get("balustrade") or G.M["glass"]
    for f in range(floors):
        z = f * 3.6
        back = 2.5 * (f // 3)                       # terraces
        d = depth - back
        add_box(bm, (0, back + d / 2, z + 1.8 + 0.2), (length, d - 0.6, 3.2), mat=1)          # glass floor
        add_box(bm, (0, back + d / 2 - 0.8, z + 0.2), (length + 0.6, d + 1.0, 0.4))          # slab + balcony
        add_box(bm, (0, back - 1.25, z + 0.95), (length + 0.5, 0.05, 1.1), mat=2)           # balcony rail
        for x in [-length / 2 + 4 * k for k in range(int(length / 4) + 1)]:                  # fins
            add_box(bm, (x, back - 0.05, z + 2.0), (0.3, 0.7, 3.2))
    top = floors * 3.6 + 0.2
    back = 2.5 * ((floors - 1) // 3)
    add_box(bm, (0, back + (depth - back) / 2, top + 0.2), (length + 0.6, depth - back + 1.0, 0.4))   # roof slab
    add_box(bm, (0, back + (depth - back) * 0.6, top + 1.8), (length * 0.4, (depth - back) * 0.4, 3.0))   # plant box
    me = mesh_from_bm(name, bm, [G.M["concrete"], G.M["glass"], rail])
    if sign:      # the lit name on the roof edge, as a separate object in the same frame
        sm = name_board(name + "_sign", sign, min(length * 0.92, 70.0), 3.4, lin("#0b0d12"), (1.0, 1.0, 1.0), emissive=1.2)
        sm.transform(Matrix.Translation((0, back - 0.1, top + 0.4)))
        return me, sm
    return me, None


def paddock_buildings():
    R = lambda i: G.SD["wall"]["R"][i % G.N]
    stand_back = lambda i: R(i) + 3.0 + G.STAND[-1][0]
    t1 = next(k for k in G.L.corners(G.C) if k["id"] == "T1")
    after = min(i % G.N for i in venue.STANDS["stand_T1"][0])        # the T1 stand starts here on the straight
    spots = [("paddock_hotel_west", -76, lambda i: R(i) + 16.0, 60.0, 22.0, 9, DATA["stadium"]),
             ("paddock_tower", 0, lambda i: stand_back(i) + 14.0, 44.0, 24.0, 15, DATA["stadium"])]
    gap = after - 45                                                  # the main grandstand ends at sample 45
    if gap > 14:
        spots.append(("paddock_hotel_east", 45 + gap // 2, lambda i: R(i) + 16.0, min(60.0, (gap - 6) * G.L.SPACING), 20.0, 7, None))
    for name, i, lat, length, depth, floors, sign in spots:
        i %= G.N
        x, y = G.L.offset(G.C, i, -lat(i))
        me, sm = tiered_building(name, length, depth, floors, sign)
        place(name, me, (x, y, 0.0), facing(i, -1))
        if sm:
            place(name + "_sign", sm, (x, y, 0.0), facing(i, -1))
    print("trackside paddock buildings:", [s[0] for s in spots], "(T1 at sample", t1["start"], ")")


# ------------------------------------------------------------------------------------------------ legend names

def legend_boards():
    bg, fg = lin(DATA["standColours"]["bg"]), lin(DATA["standColours"]["fg"])
    n = 0
    for key, text in DATA["stands"].items():
        if key not in venue.STANDS:
            print("trackside: no stand", key)
            continue
        idxs, base, sg = venue.STANDS[key]
        i = idxs[len(idxs) // 2] % G.N
        w = min(60.0, len(idxs) * G.L.SPACING * 0.45)
        me = name_board(f"stand_{key}", text, w, 4.0, bg, fg, emissive=0.4, masts=19.5)
        x, y = G.L.offset(G.C, i, sg * (base(i) + G.STAND[-1][0] - 0.6))
        place(f"legend_board_{key}", me, (x, y, 19.5), facing(i, sg))
        n += 1
    for b in DATA["banks"]:
        a, m = G.L._seg_range(G.C, b["segment"])
        i = (a + int(m * b["at"])) % G.N
        sg = 1 if b["side"] == "L" else -1
        wd = G.SD["wall"][b["side"]][i]
        if wd is None:
            print("trackside: no wall for bank board", b["name"]); continue
        x, y = G.L.offset(G.C, i, sg * (wd + 5.0))
        if not clear_of_track(x, y, i, 2.0):
            print("trackside: no room for bank board", b["name"]); continue
        me = name_board(f"bank_{n}", b["name"], 32.0, 3.2, bg, fg, emissive=0.2, masts=1.6)
        place(f"legend_bank_{n}", me, (x, y, 1.6), facing(i, sg))
        USED.update(range(i - 5, i + 6))
        n += 1
    print("trackside legend boards:", n)


def hologram_anchor():
    """Where the legend hologram will stand for cinematics: a projector ring on a mast above the middle of the main
    grandstand's roof, facing the track. Marked in the scene and written to track.json landmarks."""
    h = DATA["hologram"]
    idxs, base, sg = venue.STANDS[h["stand"]]
    i = idxs[len(idxs) // 2] % G.N
    x, y = G.L.offset(G.C, i, sg * (base(i) + G.STAND[-1][0] * 0.55))
    z = 22.0
    bm = bmesh.new()
    add_box(bm, (0, 0, (z + 13.0) / 2), (0.5, 0.5, z - 13.0))                # mast from the tent roof
    r0, r1, seg = 2.6, 3.0, 24
    ring = [(bm.verts.new((r1 * math.cos(2 * math.pi * k / seg), r1 * math.sin(2 * math.pi * k / seg), z)),
             bm.verts.new((r0 * math.cos(2 * math.pi * k / seg), r0 * math.sin(2 * math.pi * k / seg), z))) for k in range(seg)]
    for k in range(seg):
        f = bm.faces.new([ring[k][0], ring[(k + 1) % seg][0], ring[(k + 1) % seg][1], ring[k][1]])
        f.material_index = 1
    add_box(bm, (0, 0, z - 0.15), (2.0 * r0, 0.3, 0.3))                        # cross beams holding the ring
    add_box(bm, (0, 0, z - 0.15), (0.3, 2.0 * r0, 0.3))
    led = G.pbr("M_HoloRingLED", color=(0.3, 0.8, 1.0), emit=((0.35, 0.85, 1.0), 6.0), double=True)
    place("legend_hologram_pad", mesh_from_bm("legend_hologram_pad", bm, [G.M["metal"], led]), (x, y, 0.0), 0.0)
    empty = bpy.data.objects.new("legend_hologram_anchor", None)
    empty.location = (x, y, z)
    empty.rotation_euler = (0, 0, facing(i, sg))
    empty["legend"] = h["legend"]
    G.VIS.objects.link(empty)
    to_track = G.C["heading"][i] + (math.pi / 2 if sg < 0 else -math.pi / 2)  # plan angle from the stand to the track
    LANDMARKS.append({"name": "Legend hologram", "kind": "hologramAnchor", "legend": h["legend"], "stand": h["stand"],
                      "pos": G.L.to_game(x, y, z), "facingYawRad": round(math.pi / 2 - to_track, 4),
                      "note": "projector ring top; the figure stands on it facing the track (cinematics, not built yet)"})
    LANDMARKS.append({"name": DATA["stadium"], "kind": "stadium",
                      "pos": G.L.to_game(*G.L.offset(G.C, i, sg * (base(i) + G.STAND[-1][0] / 2)), 0.0)})
    print("trackside hologram anchor:", LANDMARKS[0]["pos"])


def run(g):
    global G
    G = dress.G = venue.G = SimpleNamespace(**g)
    a, m = G.L._seg_range(G.C, "Back Straight B")          # venue.py's footbridge stands mid-way along it
    USED.update(range(a + m // 2 - 6, a + m // 2 + 7))
    gantries_and_footbridges()
    legend_boards()
    billboards()
    paddock_buildings()
    hologram_anchor()
