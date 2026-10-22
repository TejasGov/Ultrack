"""Meshy character outputs -> one web GLB each: the rigged mesh once, every animation file's clip on it.

blender -b --factory-startup -P tools/meshy_chars_to_glb.py -- assets/characters
Meshy writes each animation as a full copy of the mesh and textures (10-12 MB apiece). For every folder with
<id>.glb (rigged) this keeps that mesh, pulls the action out of each <id>_<clip>.glb, and writes <id>_web.glb with all
clips as NLA tracks; unrigged folders (<id>_unrigged.glb) are re-exported as a static mesh. Textures capped at 1024 px.
"""
import os, sys

import bpy

root = os.path.abspath(sys.argv[sys.argv.index("--") + 1])


def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def export(path):
    for im in bpy.data.images:
        if im.size[0] > 1024:
            im.scale(1024, max(1, int(im.size[1] * 1024 / im.size[0])))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS", export_image_format="JPEG",
                              export_jpeg_quality=85)


for cid in sorted(os.listdir(root)):
    folder = os.path.join(root, cid)
    if not os.path.isdir(folder) or cid in ("mixamo", "web"):
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    base = os.path.join(folder, f"{cid}.glb")
    if not os.path.exists(base):
        static = os.path.join(folder, f"{cid}_unrigged.glb")
        if os.path.exists(static):
            imp(static)
            export(os.path.join(folder, f"{cid}_web.glb"))
            print(f"{cid}: static mesh")
        continue
    objs = imp(base)
    arm = next(o for o in objs if o.type == "ARMATURE")
    arm.animation_data_create()
    for a in list(bpy.data.actions):          # whatever the base file carried
        a.use_fake_user = False
    clips = []
    for f in sorted(os.listdir(folder)):
        if not (f.startswith(cid + "_") and f.endswith(".glb")) or f.endswith("_web.glb"):
            continue
        clip = f[len(cid) + 1:-4].lower()
        before = set(bpy.data.actions)
        extra = imp(os.path.join(folder, f))
        new = [a for a in bpy.data.actions if a not in before]
        for o in extra:
            bpy.data.objects.remove(o)
        if not new:
            continue
        act = max(new, key=lambda a: a.frame_range[1] - a.frame_range[0])
        act.name = clip
        act.use_fake_user = True
        tr = arm.animation_data.nla_tracks.new()
        tr.name = clip
        tr.strips.new(clip, int(act.frame_range[0]), act)
        clips.append(clip)
    arm.animation_data.action = None
    for m in [o for o in bpy.data.objects if o.type == "MESH" and o.parent is None and o not in objs]:
        bpy.data.objects.remove(m)            # stray meshes from the clip files
    export(os.path.join(folder, f"{cid}_web.glb"))
    print(f"{cid}: clips {', '.join(clips)}")
