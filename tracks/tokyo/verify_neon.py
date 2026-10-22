import bpy,json,math
from pathlib import Path
H=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(H/'out/tokyo_neon_v2.blend'))
s=bpy.context.scene
card=bpy.data.objects['Distant Tokyo | baked landmark skyline']
image=bpy.data.images['tokyo_skyline_original_bake.png']
signs=bpy.data.collections['12_JAPANESE_SIGNAGE']
jp=[o for o in signs.objects if o.type=='FONT' and any(ord(ch)>255 for ch in o.data.body)]
checks={
 'v1_preserved':(H/'out/tokyo_study.blend').exists(),
 'skyline_card_two_triangles':sum(len(p.vertices)-2 for p in card.data.polygons)==2,
 'bake_source_separate_scene':len(bpy.data.scenes)==2 and card.name in s.objects and 'Tokyo Tower main deck' not in s.objects,
 'skyline_rgba_4k':tuple(image.size)==(4096,1024) and image.channels==4,
 'skyline_texture_packed':bool(image.packed_file),
 'japanese_signs_present':len(jp)>=60,
 'japanese_font_assigned':all('msgothic' in o.data.font.filepath.lower() for o in jp),
 'original_landmarks_preserved':len([o for o in s.objects if '| authored mass' in o.name])==16,
 'world_hdri_packed':all(n.image and n.image.packed_file for n in s.world.node_tree.nodes if n.type=='TEX_ENVIRONMENT'),
 'finite_mesh_vertices':all(math.isfinite(c) for m in bpy.data.meshes for v in m.vertices for c in v.co),
}
report={'checks':checks,'passed':all(checks.values()),'japanese_text_objects':len(jp),'scope':'Blender art-direction study. Runtime parallax, performance, geographic and final-form approval remain untested.'}
(H/'out/neon-verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2),flush=True)
if not report['passed']:raise RuntimeError('V2 verification failed')
