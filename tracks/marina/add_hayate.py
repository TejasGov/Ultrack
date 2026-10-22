"""Patch, run after remove_kalt.py: adds Hayate (the Japanese team, sponsor Sony) to out/marina-logos.blend and puts Sony on the venue.
    blender -b -t 6 --factory-startup -P tracks/marina/add_hayate.py      then  npm --prefix track-viewer run pack  (+ pack:ktx2, pack:shells, pack:sectors, sync)
  - per-team materials, transporter, hospitality unit, flag, pit crew and canopy banner, cloned from Mojave's like apply_teams.py (its helpers are reused),
    lettering in Dela Gothic One (assets/teams/fonts); the viewer paints the textures (src/teamdress.js) with the baked logos;
  - every pit box follows teams.json again: box 10 goes back from Corvid to Hayate;
  - three flags (Mojave, Aurum, Sarab) fly Hayate's;
  - Sony boards (assets/sponsors/boards/sony-<aspect>.png, via brand_art.board_mesh) replace a few existing trackside boards: LED bands, a fascia and
    two pole banners across the pit lane from boxes 8-11, a hoarding pair on the main straight, the T1 billboard, the footbridge and one gantry banner.
Idempotent: with Hayate already in the blend it only re-exports marina_visual.glb."""
import re
from pathlib import Path

# reuse apply_teams.py's helpers (everything above its `applied = ...` driver line; it also opens the blend)
_src = (Path(__file__).resolve().parent / "apply_teams.py").read_text(encoding="utf-8").split("applied = ")[0]
exec(compile(_src, "apply_teams.py", "exec"))
import brand_art  # noqa: E402  (tracks/marina is on sys.path by now)

if "M_GarageHeader_HAYATE" not in bpy.data.materials:
    add_team("hayate", "DelaGothicOne-Regular.ttf", 0.0, None, 1, -18.0, -9.0, (0.95, 0.8))
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
    for name in ("flag_grandstand_05", "flag_grandstand_12", "flag_vip_08"):
        bpy.data.objects[name].data = bpy.data.meshes["flag_hayate"]

    # Sony boards: same size and kind as the board they replace
    sony = next(b for b in brand_art.BRANDS if b["id"] == "sony")
    swaps = ([f"ledband_grandstand_{i:03d}" for i in (37, 39, 41, 43, 45, 47)] + ["fascia_grandstand_06", "pole_banner_041", "pole_banner_042",
             "hoarding_011", "hoarding_014", "billboard_T1_44", "footbridge_banner", "gantry_0_banner_front"])
    made, n = {}, 0
    for name in swaps:
        ob = bpy.data.objects[name]
        w, h = map(float, re.search(r"(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)_logos$", ob.data.name).groups())
        led = "led" in ob.data.name
        key = f"sony_{w:g}x{h:g}{'_led' if led else ''}"
        if key not in made:
            made[key] = brand_art.board_mesh(key, sony, w, h, False, led)
        ob.data = made[key]; n += 1
    print("SONY boards:", n, sorted(made))
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
else:
    print("Hayate already in the blend; re-exporting only")

bpy.ops.object.select_all(action="DESELECT")
objects = list(bpy.data.collections["Visual"].all_objects)
for o in objects:
    o.hide_set(False)
    o.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.export_scene.gltf(filepath=str(root / "tracks/marina/out/marina_visual.glb"), export_format="GLB", use_selection=True,
                          export_yup=True, export_apply=True, export_extras=True, export_gpu_instances=True)
print("HAYATE PATCH DONE")
