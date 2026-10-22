"""Take Kalt (the removed electric team) out of the built venue, like apply_teams.py patches teams in. Run once from the repo root:
    blender -b -t 6 --factory-startup -P tracks/marina/remove_kalt.py      then  npm --prefix track-viewer run pack
  - pit box 10 (header, floor, transporter, pole flag, crew) goes to Corvid, the team teams.json now gives it;
  - Kalt's hospitality unit and canopy banner (rod and pole included) are deleted;
  - every Kalt flag (grandstands, plaza, pit pole) flies another team's flag.
Idempotent: with no Kalt mesh left it only re-exports marina_visual.glb."""
import json, sys
from pathlib import Path

import bmesh, bpy

root = Path(__file__).resolve().parents[2]
blend = root / "tracks" / "marina" / "out" / "marina-logos.blend"
bpy.ops.wm.open_mainfile(filepath=str(blend))
teams = json.loads((root / "assets" / "teams" / "teams.json").read_text(encoding="utf-8"))["teams"]
assert "kalt" not in [t["id"] for t in teams]
owner = {b: t for t in teams for b in t["pitBoxes"]}
assert sorted(owner) == list(range(1, 13)), "every one of the 12 boxes needs exactly one team"

if "flag_kalt" in bpy.data.meshes:
    # pit boxes: whatever teams.json says now (only box 10 changes hands)
    pb = bpy.data.meshes["team_pit_boxes"]
    slot = {m.name: i for i, m in enumerate(pb.materials)}
    for box, t in owner.items():
        NAME, low = t["name"].upper(), t["name"].lower()
        h = 2 * (box - 1)
        pb.polygons[h].material_index = slot[f"M_GarageHeader_{NAME}"]
        pb.polygons[h + 1].material_index = slot[f"M_PitBox_{NAME}"]
        bpy.data.objects["transporter_%02d" % box].data = bpy.data.meshes[f"transporter_{low}"]
        bpy.data.objects["flag_pit_%02d" % box].data = bpy.data.meshes[f"flag_{low}"]
    for ob in sorted((o for o in bpy.data.objects if o.name.startswith("crew_")), key=lambda o: o.name):
        ob.data = bpy.data.meshes["crew_" + owner[int(ob.name.split("_")[1]) // 3 + 1]["name"].lower()]
    # the other Kalt flags, spread over the remaining teams
    swap = {"flag_grandstand_04": "mojave", "flag_grandstand_10": "liberty", "flag_stand_T1_00": "corvid", "flag_stand_T1_06": "sarab",
            "flag_stand_T6_00": "aurum", "flag_vip_08": "sarab"}
    for name, team in swap.items():
        assert bpy.data.objects[name].data.name == "flag_kalt", name
        bpy.data.objects[name].data = bpy.data.meshes[f"flag_{team}"]
    assert not [o.name for o in bpy.data.objects if o.data and o.data.name.endswith("_kalt") and o.name != "motorhome_02"]
    bpy.data.objects.remove(bpy.data.objects["motorhome_02"], do_unlink=True)
    # canopy banner: its quad and the rod and pole above it (x -79..-73 at the pavilion)
    me = bpy.data.objects["vip_banners"].data
    bm = bmesh.new(); bm.from_mesh(me)
    gone = [v for v in bm.verts if -79.0 < v.co.x < -73.0]
    assert len(gone) == 4 + 16, len(gone)
    bmesh.ops.delete(bm, geom=gone, context="VERTS")
    bm.to_mesh(me); bm.free()
    for m in [m for m in bpy.data.meshes if m.name.endswith("_kalt")]:
        bpy.data.meshes.remove(m)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
else:
    print("Kalt already out of the blend; re-exporting only")

bpy.ops.object.select_all(action="DESELECT")
objects = list(bpy.data.collections["Visual"].all_objects)
for o in objects:
    o.hide_set(False)
    o.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.export_scene.gltf(filepath=str(root / "tracks/marina/out/marina_visual.glb"), export_format="GLB", use_selection=True,
                          export_yup=True, export_apply=True, export_extras=True, export_gpu_instances=True)
print("KALT REMOVED")
