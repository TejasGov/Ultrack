"""Mixamo FBX -> one web GLB per character, every downloaded animation as a named clip.

blender -b --factory-startup -P tools/mixamo_to_glb.py -- assets/characters/mixamo
Each <root>/<Name>/src/ holds <anim>.fbx files; the one exported with skin (with_skin.txt names it) brings the mesh.
Writes <root>/<Name>/<name>.glb: the skinned mesh at 1.78 m (spectators decimated to ~SPECTATOR_TRIS for crowds),
heroes to ~HERO_TRIS, textures capped at 1024 px, clips named after the files (idle, cheer, clap ...).
"""
import math, os, sys

import bpy

SPECTATOR_TRIS = 4000
HERO_TRIS = 12000      # Racer, Leonard, Pete come in at ~50k; a pit lane holds ten Petes
HEIGHT = 1.78
root = os.path.abspath(sys.argv[sys.argv.index("--") + 1])


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=True)
    return [o for o in bpy.data.objects if o not in before]


def convert(folder, budget):
    name = os.path.basename(folder)
    src = os.path.join(folder, "src")
    skin_file = open(os.path.join(src, "with_skin.txt")).read().strip()
    clear()
    objs = import_fbx(os.path.join(src, skin_file))
    arm = next(o for o in objs if o.type == "ARMATURE")
    meshes = [o for o in objs if o.type == "MESH"]
    first = os.path.splitext(skin_file)[0]
    arm.animation_data.action.name = first
    actions = {first: arm.animation_data.action}
    for f in sorted(os.listdir(src)):
        if not f.endswith(".fbx") or f == skin_file:
            continue
        extra = import_fbx(os.path.join(src, f))
        a = next(o for o in extra if o.type == "ARMATURE")
        act = a.animation_data.action
        act.name = os.path.splitext(f)[0]
        actions[act.name] = act
        for o in extra:
            bpy.data.objects.remove(o)
    # every clip as its own NLA track, so the glTF export writes one animation per action
    arm.animation_data.action = None
    for nm, act in actions.items():
        act.use_fake_user = True
        tr = arm.animation_data.nla_tracks.new()
        tr.name = nm
        tr.strips.new(nm, int(act.frame_range[0]), act)
    # height: scale the rig so the bind-pose mesh stands 1.78 m
    bpy.context.view_layer.update()
    zs = [(m.matrix_world @ v.co).z for m in meshes for v in m.data.vertices]
    k = HEIGHT / max(1e-3, max(zs) - min(zs))
    arm.scale = [s * k for s in arm.scale]
    bpy.context.view_layer.update()
    tris = 0
    for m in meshes:
        if budget:
            n = sum(len(p.vertices) - 2 for p in m.data.polygons)
            target = budget / max(1, len(meshes))
            if n > target:
                d = m.modifiers.new("lod", "DECIMATE")
                d.ratio = target / n
                bpy.context.view_layer.objects.active = m
                bpy.ops.object.modifier_apply(modifier="lod")
        tris += sum(len(p.vertices) - 2 for p in m.data.polygons)
        for slot in m.material_slots:          # Mixamo materials come in very glossy; game characters read matte
            mat = slot.material
            if mat and mat.use_nodes:
                b = mat.node_tree.nodes.get("Principled BSDF")
                if b:
                    b.inputs["Roughness"].default_value = max(0.6, b.inputs["Roughness"].default_value)
    for im in bpy.data.images:                  # web budget
        if im.size[0] > 1024:
            im.scale(1024, max(1, int(im.size[1] * 1024 / im.size[0])))
    out = os.path.join(folder, f"{name.lower()}.glb")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
                              export_animations=True, export_animation_mode="NLA_TRACKS", export_image_format="JPEG",
                              export_jpeg_quality=85)
    print(f"{name}: {tris} tris, clips {', '.join(actions)} -> {out}")


SPECTATORS = {"Remy", "Megan", "Kaya", "Brian", "Sophie", "Lewis"}
for d in sorted(os.listdir(root)):
    f = os.path.join(root, d)
    if os.path.isdir(os.path.join(f, "src")):
        convert(f, SPECTATOR_TRIS if d in SPECTATORS else HERO_TRIS)
