"""Life and greenery for the Corniche Marina Circuit: shrubs, bougainvillea, hedges and planters; pit crews, tyre stacks,
marshals, a safety car, a medical car and recovery trucks.

Called by build_blender.py (life.run(globals())) after paddock.py. People and vehicles are generic low-poly stand-ins
(invented liveries, no real brands); every repeated piece is one shared mesh, exported as GPU instances.
Lamps that should flash carry "Beacon" in their material name: the viewer/engine blinks those.
"""
import math, random

import bmesh, bpy
from mathutils import Matrix, Vector

import dress
import paddock
import venue
from dress import add_box, facing, facing_oncoming, mesh_from_bm, place, save_image, textured

G = None


# ------------------------------------------------------------------------------------------------ greenery

def leaf_material(name, base, flower=None, share=0.0, seed=0):
    """Dense foliage: dark-to-light green speckle; optional flower colour (bougainvillea magenta) mixed in."""
    rnd = random.Random(seed)
    cells = [[rnd.random() for _ in range(64)] for _ in range(64)]

    def px(x, y):
        v = cells[int(y * 64) % 64][int(x * 64) % 64]
        if flower and v > 1 - share:
            k = 0.7 + 0.3 * (v - (1 - share)) / share
            return [flower[0] * k, flower[1] * k, flower[2] * k, 1]
        k = 0.45 + 0.75 * v * (0.6 + 0.4 * y)                 # lighter toward the top, where the sun reaches
        return [base[0] * k, base[1] * k, base[2] * k, 1]
    return textured(name, save_image(name.lower(), 128, 128, px), tile=1.0, rough=0.8)


def bush_mesh(name, mat, size, seed):
    """3-4 lumpy icospheres merged: ~250 triangles, spherical UVs, flat bottom."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    for k in range(rnd.randint(3, 4)):
        r = size * rnd.uniform(0.45, 0.7)
        c = Vector((rnd.uniform(-0.45, 0.45) * size, rnd.uniform(-0.45, 0.45) * size, r * 0.75))
        res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=Matrix.Translation(c))
        for v in res["verts"]:
            d = v.co - c
            v.co = c + d * rnd.uniform(0.82, 1.12)
            v.co.z = max(v.co.z, 0.0)
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.smooth = True
            for lp in f.loops:
                d = (lp.vert.co - c).normalized()
                lp[uv].uv = (0.5 + math.atan2(d.y, d.x) / (2 * math.pi), 0.5 + d.z * 0.5)
    return mesh_from_bm(name, bm, [mat])


def greenery():
    green = leaf_material("M_Shrub", (0.09, 0.2, 0.06), seed=1)
    olive = leaf_material("M_ShrubOlive", (0.15, 0.19, 0.09), seed=2)
    bougain = leaf_material("M_Bougainvillea", (0.08, 0.18, 0.05), flower=(0.75, 0.05, 0.38), share=0.45, seed=3)
    bushes = [bush_mesh("shrub_a", green, 1.0, 4), bush_mesh("shrub_b", olive, 1.3, 5), bush_mesh("shrub_c", bougain, 1.1, 6)]
    planter = bmesh.new()
    add_box(planter, (0, 0, 0.3), (1.8, 1.8, 0.6))
    planter_me = mesh_from_bm("planter", planter, [G.M["concrete"]])
    rnd = random.Random(12)
    n = 0
    # planters with a shrub between the palms on the inner promenade
    for run in G.street_runs:
        for i in run[5:-2:6]:
            wd = G.SD["wall"]["L"][i]
            if wd is None:
                continue
            x, y = G.L.offset(G.C, i, wd + 3.5)
            place(f"planter_{n:03d}", planter_me, (x, y, 0.0), G.C["heading"][i])
            place(f"shrub_planter_{n:03d}", bushes[n % 3], (x, y, 0.58), rnd.uniform(0, 6.3), 0.8)
            n += 1
    # shrubs at the foot of palms (not on the promenade, where planters stand)
    m = 0
    for ob in [o for o in G.VIS.objects if o.name.startswith("palm_")]:
        if rnd.random() < 0.55:
            a = rnd.uniform(0, 2 * math.pi)
            d = rnd.uniform(1.4, 2.6)
            place(f"shrub_{m:03d}", bushes[rnd.randrange(3)], (ob.location.x + math.cos(a) * d, ob.location.y + math.sin(a) * d, -0.05),
                  rnd.uniform(0, 6.3), rnd.uniform(0.8, 1.4))
            m += 1
    # clipped hedges: the paddock's far edge, and along the back of the main grandstand
    hedge = leaf_material("M_Hedge", (0.07, 0.16, 0.05), seed=7)
    G.M["hedge"] = hedge
    prof = [(0, 0), (0, 1.3), (1.1, 1.3), (1.1, 0)]
    first = G.garage_idx[0]
    idxs = [(first - 14 + j) % G.N for j in range(len(G.garage_idx) + 28)]
    G.wall("hedge_paddock", idxs, lambda i: paddock.PADDOCK_IN + 40.5, 1, profile=prof, mat="hedge", collide_h=0, tile=2.0)
    G.wall("hedge_grandstand", G.stand_idx, lambda i: G.SD["wall"]["R"][i] + 3.0 + G.STAND[-1][0] + 3.0, -1, profile=prof,
           mat="hedge", collide_h=0, tile=2.0)
    print("greenery: planters", n, "shrubs", m, "+ 2 hedges")


# ------------------------------------------------------------------------------------------------ people

def person_mesh(name, suit, skin, helmet=None):
    """A standing figure, 1.78 m, ~150 triangles: tapered limbs and torso (hexagonal cylinders, smooth-shaded so they
    read round, not blocky), a head (or a helmet), hands in skin. Faces local -Y."""
    bm = bmesh.new()

    def limb(a, b, r0, r1, mat):
        a, b = Vector(a), Vector(b)
        d = b - a
        rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r0, radius2=r1, depth=d.length,
                                    matrix=Matrix.Translation((a + b) / 2) @ rot)
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index, f.smooth = mat, True
    for x in (-0.1, 0.1):
        limb((x, 0, 0.02), (x * 0.9, 0, 0.9), 0.065, 0.085, 0)            # legs
        limb((x, -0.05, 0.0), (x, 0.08, 0.0), 0.05, 0.05, 2 if helmet else 0)   # boots (dark when crew)
    limb((0, 0, 0.88), (0, 0, 1.46), 0.16, 0.2, 0)                         # torso, broader at the shoulders
    for x in (-1, 1):
        limb((x * 0.21, 0, 1.42), (x * 0.26, -0.04, 0.98), 0.055, 0.045, 0)   # arms, slightly forward
        res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.05, matrix=Matrix.Translation((x * 0.27, -0.05, 0.93)))
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index, f.smooth = 1, True                               # hands
    limb((0, 0, 1.46), (0, 0, 1.54), 0.05, 0.05, 1)                        # neck
    res = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.115, matrix=Matrix.Translation((0, 0, 1.65)))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index, f.smooth = (1 if helmet is None else 2), True
    mats = [suit, skin] + ([helmet] if helmet else [])
    return mesh_from_bm(name, bm, mats)


def people():
    skin = G.pbr("M_Skin", color=(0.55, 0.38, 0.28), rough=0.6)
    helmet = G.pbr("M_CrewHelmet", color=(0.1, 0.1, 0.11), rough=0.25)
    crews = [person_mesh(f"crew_{t[0].lower()}", bpy.data.materials.get(f"M_Team_{t[0]}_primary") or paddock.team_mats(k)[0], skin, helmet)
             for k, t in enumerate(paddock.TEAMS)]
    marshal = person_mesh("marshal", G.pbr("M_MarshalOrange", color=(0.95, 0.38, 0.03), rough=0.6), skin)
    official = person_mesh("official", G.pbr("M_OfficialNavy", color=(0.03, 0.05, 0.12), rough=0.6), skin)
    rnd = random.Random(17)
    n = 0
    for b in G.PIT["boxes"]:                                   # three crew in front of every garage
        i = b["idx"]
        me = crews[paddock.BOX_TEAM.get(b["id"], 0)]
        for k in range(3):
            along = rnd.uniform(-4.0, 4.0)
            x, y = G.L.offset(G.C, (i + round(along / 4.5)) % G.N, G.pd[i] + G.L.PIT_HALF + rnd.uniform(0.6, 1.5))
            place(f"crew_{n:03d}", me, (x, y, 0.0), facing(i, 1) + rnd.uniform(-0.8, 0.8))
            n += 1
    m = 0
    for ob in [o for o in G.VIS.objects if o.name.startswith("marshal_")]:   # a marshal beside every post
        yaw = ob.rotation_euler.z
        fx, fy = math.cos(yaw), math.sin(yaw)
        place(f"marshal_person_{m:02d}", marshal, (ob.location.x + fx * 1.6, ob.location.y + fy * 1.6, 0.0), yaw + rnd.uniform(-0.4, 0.4))
        m += 1
    for k, i in enumerate(G.pit_wall_idx[10::14]):                   # officials on the pit wall's pit-lane side
        x, y = G.L.offset(G.C, i, G.pd[i] - G.L.PIT_HALF + 0.6)
        place(f"official_{k:02d}", official, (x, y, 0.0), facing(i, 1))
    print("people: crew", n, "marshals", m)


def tyre_stacks():
    rubber = G.pbr("M_TyreRubber", color=(0.025, 0.025, 0.028), rough=0.85)
    blanket = G.pbr("M_TyreBlanket", color=(0.55, 0.03, 0.04), rough=0.7)
    meshes = []
    for name, mat in (("tyre_stack", 0), ("tyre_stack_blanket", 1)):
        bm = bmesh.new()
        for k in range(4):
            res = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.34, radius2=0.34, depth=0.3,
                                        matrix=Matrix.Translation((0, 0, 0.15 + 0.31 * k)))
            for f in {f for v in res["verts"] for f in v.link_faces}:
                f.material_index, f.smooth = mat, True
        meshes.append(mesh_from_bm(name, bm, [rubber, blanket]))
    n = 0
    for b in G.PIT["boxes"]:
        i = b["idx"]
        h = G.C["heading"][i]
        fx, fy = math.cos(h), math.sin(h)
        x, y = G.L.offset(G.C, i, G.pd[i] + G.L.PIT_HALF + 1.2)
        for k, along in enumerate((-4.4, -3.6, 3.6, 4.4)):
            place(f"tyres_{n:03d}", meshes[k % 2], (x + fx * along, y + fy * along, 0.0), 0.0)
            n += 1
    print("tyre stacks:", n)


# ------------------------------------------------------------------------------------------------ service vehicles

def car_body(bm, L, W, H, mat_body, mat_glass, mat_tyre):
    """A generic low coupe from solid blocks (reads as a car at service-vehicle distances): body, raked nose and tail,
    a glasshouse set back, four wheels in arches. Nose toward +X."""
    add_box(bm, (0, 0, 0.55), (L * 0.78, W, 0.5), mat=mat_body)                              # main body
    for sx, ang in ((1, -14), (-1, 10)):                                                      # nose and tail, raked
        add_box(bm, (sx * L * 0.43, 0, 0.5), (L * 0.16, W * 0.97, 0.36), mat=mat_body,
                rot=Matrix.Rotation(math.radians(ang * sx), 4, "Y"))
    add_box(bm, (-L * 0.05, 0, 0.98), (L * 0.42, W * 0.82, 0.42), mat=mat_glass)            # glasshouse
    add_box(bm, (-L * 0.05, 0, 1.2), (L * 0.36, W * 0.78, 0.05), mat=mat_body)               # roof skin
    for x in (-L * 0.32, L * 0.32):
        for y in (-W / 2 + 0.12, W / 2 - 0.12):
            m = Matrix.Translation((x, y, 0.34)) @ Matrix.Rotation(math.pi / 2, 4, "X")
            res = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.34, radius2=0.34, depth=0.26, matrix=m)
            for f in {f for v in res["verts"] for f in v.link_faces}:
                f.material_index = mat_tyre                         # flat-shaded: a tyre, not a pebble
            add_box(bm, (x, y + (0.135 if y > 0 else -0.135), 0.34), (0.38, 0.02, 0.38), mat=mat_body,
                    rot=Matrix.Rotation(math.pi / 4, 4, "Y"))        # wheel face in body colour


def service_vehicles():
    tyre = bpy.data.materials.get("M_Tyre") or G.pbr("M_Tyre", color=(0.02, 0.02, 0.02), rough=0.8)
    glass = G.pbr("M_ServiceGlass", color=(0.02, 0.025, 0.03), rough=0.05, metal=0.5)
    amber = G.pbr("M_ServiceBeacon_Amber", color=(1.0, 0.55, 0.02), emit=((1.0, 0.5, 0.02), 10.0))
    blue = G.pbr("M_ServiceBeacon_Blue", color=(0.1, 0.3, 1.0), emit=((0.1, 0.3, 1.0), 10.0))
    cars = {}
    for name, paint, stripe, lamp in (("safety_car", (0.72, 0.74, 0.76), (0.95, 0.75, 0.05), amber),
                                      ("medical_car", (0.92, 0.92, 0.9), (0.75, 0.04, 0.04), blue)):
        bm = bmesh.new()
        car_body(bm, 4.6, 1.95, 1.25, 0, 1, 2)
        add_box(bm, (0, 0, 0.62), (4.6 * 0.78 + 0.02, 1.97, 0.12), mat=3)  # livery stripe
        add_box(bm, (-0.2, 0, 1.28), (0.3, 1.2, 0.12), mat=4)              # roof light bar
        cars[name] = mesh_from_bm(name, bm, [G.pbr(f"M_{name}_paint", color=paint, rough=0.35, metal=0.1), glass, tyre,
                                             G.pbr(f"M_{name}_stripe", color=stripe, rough=0.3), lamp])
    # parked nose-out at the pit exit, past the last garage
    for k, name in enumerate(("safety_car", "medical_car")):
        i = G.pit_wall_idx[-6 + 2 * k]
        x, y = G.L.offset(G.C, i, G.pd[i] + G.L.PIT_HALF - 1.6)
        place(name, cars[name], (x, y, 0.0), G.C["heading"][i])
    # recovery trucks behind the barriers at the heavy-braking corners
    bm = bmesh.new()
    add_box(bm, (1.2, 0, 1.6), (2.2, 2.4, 2.2), mat=0)                    # cab
    add_box(bm, (2.32, 0, 2.0), (0.02, 2.1, 0.9), mat=1)                  # windscreen
    add_box(bm, (-2.4, 0, 1.0), (5.0, 2.5, 0.25), mat=2)                  # flatbed
    add_box(bm, (-1.0, 0, 1.6), (0.5, 0.5, 1.0), mat=2)                   # crane base
    add_box(bm, (-2.6, 0, 2.6), (3.6, 0.3, 0.3), mat=0, rot=Matrix.Rotation(math.radians(-14), 4, "Y"))   # boom
    add_box(bm, (1.2, 0, 2.78), (0.4, 1.4, 0.14), mat=3)                  # beacons
    for x in (-3.6, -2.2, 1.3):
        for y in (-1.1, 1.1):
            paddock.wheel(bm, x, y, r=0.5, w=0.35, mat=4)
    truck = mesh_from_bm("recovery_truck", bm, [G.pbr("M_RecoveryOrange", color=(0.9, 0.42, 0.03), rough=0.4), glass,
                                                G.M["metal"], amber, tyre])
    n = 0
    stands = set(j % G.N for idxs, _, _ in venue.STANDS.values() for j in idxs)
    for k in G.L.corners(G.C):
        if not any((k["id"] + " ").startswith(p) for p in G.L.HEAVY_BRAKING):
            continue
        sg = -1 if k["angle"] > 0 else 1                       # outside of the corner
        side = "R" if sg < 0 else "L"
        i = (k["start"] + k["count"] // 2) % G.N
        wd = G.SD["wall"][side][i]
        if wd is None or i in stands:                          # T1 and T6 have grandstands on the outside
            continue
        x, y = G.L.offset(G.C, i, sg * (wd + 9.0))
        place(f"recovery_truck_{k['id']}", truck, (x, y, 0.0), facing(i, sg) + math.pi / 2)
        n += 1
    print("service vehicles: safety car, medical car, recovery trucks", n)


def run(g):
    global G
    G = dress.G = paddock.G = __import__("types").SimpleNamespace(**g)
    greenery()
    people()
    tyre_stacks()
    service_vehicles()
