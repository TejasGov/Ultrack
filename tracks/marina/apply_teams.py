"""Add teams to the built venue without rebuilding the track (like scripts/apply-venue-logos.py): Liberty (the seventh team)
and Toro (the eighth).

Why a patch: the Blender build can no longer be rerun end to end (brand_art wants board textures the sponsor pass made
by hand), so team changes are applied to out/marina-logos.blend, which holds the venue as shipped. This script:
  - clones a team's materials (M_Team_<NAME>_primary/secondary, M_GarageHeader_, M_PitBox_, M_Flag_, M_TeamBanner_) and meshes
    (transporter, hospitality motorhome, flag, pit crew) from Mojave's, with the team's own lettering in its own font;
  - hands every pit box to the team that owns it in assets/teams/teams.json (garage header, floor panel, transporter, pole flag, crew),
    so a change of ownership there (Toro took boxes 5-6, Sarab moved to 7-8, Corvid and Kalt one each) is one run;
  - puts the new team's hospitality motorhome and canopy banner in the Corniche Club row and a flag in the plaza.
The viewer paints the per-team materials in the team's font (track-viewer/src/teamdress.js).
Run once from the repo root:  blender -b -t 6 --factory-startup -P tracks/marina/apply_teams.py   then  npm --prefix track-viewer run pack
Idempotent: if Toro's materials already exist it only re-exports marina_visual.glb. Liberty's step is skipped when present
(it already is in the shipped blend), so the script can start from either state.
"""
import json, math, sys, types
from pathlib import Path

import bmesh, bpy
from mathutils import Matrix

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / "tracks" / "marina"))
import dress

blend = root / "tracks" / "marina" / "out" / "marina-logos.blend"
bpy.ops.wm.open_mainfile(filepath=str(blend))
dress.G = types.SimpleNamespace(scene=bpy.context.scene)
teams = json.loads((root / "assets" / "teams" / "teams.json").read_text(encoding="utf-8"))["teams"]
BY_ID = {t["id"]: t for t in teams}
FONTS = root / "assets" / "teams" / "fonts"


def lin(hexc):
    return tuple(((int(hexc[k:k + 2], 16) / 255 + 0.055) / 1.055) ** 2.4 for k in (1, 3, 5))


def swatch(name, rgb):
    im = bpy.data.images.new(name, 8, 8, alpha=True)
    im.pixels = [*rgb, 1.0] * 64
    im.pack()
    return im


def clone_mat(src, new, rgb):
    """Copy a material; a textured one gets a flat team-colour image (the viewer paints over it), a plain one the colour."""
    m = bpy.data.materials[src].copy()
    m.name = new
    tex = [n for n in m.node_tree.nodes if n.type == "TEX_IMAGE"]
    if tex:
        tex[0].image = swatch(new.lower(), rgb)
    else:
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1)
    return m


def swap_mat(me, old_prefix, new_mat):
    """Replace the mesh's first material starting with old_prefix; returns its slot."""
    for i, m in enumerate(me.materials):
        if m and m.name.startswith(old_prefix):
            me.materials[i] = new_mat
            return i
    raise KeyError(old_prefix)


def cut_text(me, keep):
    """Delete the baked name lettering (faces the predicate rejects) so new lettering can replace it."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f)], context="FACES")
    return bm


def team_text(name, body, size, mat, font, fatten):
    """dress.text_mesh with the team's own face (SIL OFL) instead of Blender's default; fatten thickens a light face."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body, cu.size, cu.font = body, size, font
    cu.align_x, cu.align_y = "CENTER", "BOTTOM"
    cu.resolution_u = 3
    cu.offset = fatten
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    me.transform(Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))))
    me.materials.append(mat)
    return me


def add_text(bm, label, size, shift, rot_z, mat_index, mat, font, fatten):
    tm = team_text("team_text", label, size, mat, font, fatten)
    tm.transform(shift @ Matrix.Rotation(rot_z, 4, "Z"))
    before = set(bm.faces)
    bm.from_mesh(tm)
    for f in set(bm.faces) - before:
        f.material_index = mat_index
    bpy.data.meshes.remove(tm)


def link_like(ob, template):
    for c in template.users_collection:
        c.objects.link(ob)


def add_team(tid, font_file, fatten, ink_hex, banner_src, banner_dx, motorhome_x, text_size):
    """Everything one team needs that the shipped venue lacks. ink_hex: lettering colour when it is not the team's secondary
    (white on Liberty's blue); banner_src / banner_dx: copy that banner group (13 faces) shifted by dx; motorhome_x: where its
    unit stands; text_size: lettering height on the transporter and on the motorhome."""
    t = BY_ID[tid]
    NAME = t["name"].upper()
    low = t["name"].lower()
    font = bpy.data.fonts.load(str(FONTS / font_file))
    c = t["colors"]
    P, S = lin(c["primary"]), lin(c["secondary"])
    prim = clone_mat("M_Team_MOJAVE_primary", f"M_Team_{NAME}_primary", P)
    sec = clone_mat("M_Team_MOJAVE_secondary", f"M_Team_{NAME}_secondary", S)
    head = clone_mat("M_GarageHeader_MOJAVE", f"M_GarageHeader_{NAME}", P)
    floor = clone_mat("M_PitBox_MOJAVE", f"M_PitBox_{NAME}", P)
    flagm = clone_mat("M_Flag_MOJAVE", f"M_Flag_{NAME}", P)
    banm = clone_mat("M_TeamBanner_MOJAVE", f"M_TeamBanner_{NAME}", P)
    ink = clone_mat("M_Team_MOJAVE_secondary", f"M_Team_{NAME}_ink", lin(ink_hex)) if ink_hex else None

    pb = bpy.data.meshes["team_pit_boxes"]                 # the garage header and floor panel materials; boxes are handed out below
    pb.materials.append(head)
    pb.materials.append(floor)

    # transporter: the name on both trailer sides
    tr = bpy.data.meshes["transporter_mojave"].copy()
    tr.name = f"transporter_{low}"
    swap_mat(tr, "M_Team_MOJAVE_primary", prim)
    si = swap_mat(tr, "M_Team_MOJAVE_secondary", sec)
    if ink:
        tr.materials.append(ink)
        si = len(tr.materials) - 1
    bm = cut_text(tr, lambda f: not (f.material_index == 1 and abs(f.calc_center_median().y) > 1.2 and f.calc_center_median().z > 2.2))
    for side in (-1, 1):
        add_text(bm, NAME, text_size[0], Matrix.Translation((7.0, side * 1.29, 2.75)), 0 if side < 0 else math.pi, si, prim, font, fatten)
    bm.to_mesh(tr)
    bm.free()

    # hospitality motorhome
    mh = bpy.data.meshes["motorhome_mojave"].copy()
    mh.name = f"motorhome_{low}"
    swap_mat(mh, "M_Team_MOJAVE_primary", prim)
    si = swap_mat(mh, "M_Team_MOJAVE_secondary", sec)
    if ink:
        mh.materials.append(ink)
        si = len(mh.materials) - 1
    bm = cut_text(mh, lambda f: not (f.material_index == 1 and f.calc_center_median().z > 5.2))
    add_text(bm, NAME, text_size[1], Matrix.Translation((0, -3.04, 6.1)), 0, si, prim, font, fatten)
    bm.to_mesh(mh)
    bm.free()
    template = bpy.data.objects["motorhome_05"]
    n = 1 + max(int(o.name.split("_")[1]) for o in bpy.data.objects if o.name.startswith("motorhome_"))
    new = bpy.data.objects.new(f"motorhome_{n:02d}", mh)
    new.location = (motorhome_x, template.location.y, template.location.z)
    new.rotation_euler = template.rotation_euler.copy()
    new.scale = template.scale.copy()
    link_like(new, template)

    # flag and pit crew
    fl = bpy.data.meshes["flag_mojave"].copy()
    fl.name = f"flag_{low}"
    swap_mat(fl, "M_Flag_MOJAVE", flagm)
    cr = bpy.data.meshes["crew_mojave"].copy()
    cr.name = f"crew_{low}"
    swap_mat(cr, "M_Team_MOJAVE_primary", prim)

    # canopy banner: a copy of an existing one (quad + hanging rod + pole = 13 faces)
    vb = bpy.data.meshes["vip_banners"]
    vb.materials.append(banm)
    bm = bmesh.new()
    bm.from_mesh(vb)
    bm.faces.ensure_lookup_table()
    group = [bm.faces[i] for i in range(13 * banner_src, 13 * banner_src + 13)]
    verts = {v for f in group for v in f.verts}
    vmap = {v: bm.verts.new((v.co.x + banner_dx, v.co.y, v.co.z)) for v in verts}
    uv = bm.loops.layers.uv.active
    for f in group:
        nf = bm.faces.new([vmap[v] for v in f.verts])
        nf.material_index = len(vb.materials) - 1 if f.material_index != 6 else 6
        nf.smooth = f.smooth
        for a, b in zip(nf.loops, f.loops):
            if uv:
                a[uv].uv = b[uv].uv
    bm.to_mesh(vb)
    bm.free()


def shift_banner(group, dx):
    """Slide one banner group (13 faces) along the canopy."""
    vb = bpy.data.meshes["vip_banners"]
    seen = set()
    for p in list(vb.polygons)[13 * group:13 * group + 13]:
        seen.update(p.vertices)
    for i in seen:
        vb.vertices[i].co.x += dx


applied = "M_GarageHeader_TORO" in bpy.data.materials
if not applied:
    if "M_GarageHeader_LIBERTY" not in bpy.data.materials:
        # Liberty: the last banner (Sarab's) copied 18 m east, its unit at the east end of the row
        add_team("liberty", "Graduate-Regular.ttf", 0.025, BY_ID["liberty"]["colors"]["accent"], 5, 18.0, 85.49, (1.1, 0.9))
    # Toro: banners west of the booth run Saetta (-22), Toro (-40), Corvid (-58), Kalt (-76): Corvid and Kalt slide out one slot,
    # Toro takes Saetta's neighbour; likewise its unit stands next to Saetta's and the units after it move east
    shift_banner(1, -18.0)         # Corvid  -40 -> -58
    shift_banner(2, -18.0)         # Kalt    -58 -> -76
    for o in bpy.data.objects:
        if o.name.startswith("motorhome_") and o.location.x > -100:
            o.location.x += 31.5
    add_team("toro", "Unbounded-Black.ttf", 0.0, None, 0, -18.0, -71.99, (1.5, 1.15))

    # pit boxes: header, floor, transporter, pole flag and crew follow teams.json
    pb = bpy.data.meshes["team_pit_boxes"]
    slot = {m.name: i for i, m in enumerate(pb.materials)}
    owner = {b: t for t in teams for b in t["pitBoxes"]}
    assert sorted(owner) == list(range(1, 13)), "every one of the 12 boxes needs exactly one team"
    for box, t in owner.items():
        NAME, low = t["name"].upper(), t["name"].lower()
        h = 2 * (box - 1)
        pb.polygons[h].material_index = slot[f"M_GarageHeader_{NAME}"]
        pb.polygons[h + 1].material_index = slot[f"M_PitBox_{NAME}"]
        bpy.data.objects["transporter_%02d" % box].data = bpy.data.meshes[f"transporter_{low}"]
        bpy.data.objects["flag_pit_%02d" % box].data = bpy.data.meshes[f"flag_{low}"]
    for ob in sorted((o for o in bpy.data.objects if o.name.startswith("crew_")), key=lambda o: o.name):
        ob.data = bpy.data.meshes["crew_" + owner[int(ob.name.split("_")[1]) // 3 + 1]["name"].lower()]
    # the plaza's twelve flags: Toro twice, next to Saetta's; Corvid and Kalt once each, like their boxes
    for name, team in (("flag_vip_01", "toro"), ("flag_vip_02", "corvid"), ("flag_vip_07", "toro")):
        bpy.data.objects[name].data = bpy.data.meshes[f"flag_{team}"]
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
else:
    print("Toro already in the blend; re-exporting only")

# export exactly as scripts/apply-venue-logos.py does
bpy.ops.object.select_all(action="DESELECT")
objects = list(bpy.data.collections["Visual"].all_objects)
for o in objects:
    o.hide_set(False)
    o.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.export_scene.gltf(filepath=str(root / "tracks/marina/out/marina_visual.glb"), export_format="GLB", use_selection=True,
                          export_yup=True, export_apply=True, export_extras=True, export_gpu_instances=True)
print("TEAMS PATCH DONE")
