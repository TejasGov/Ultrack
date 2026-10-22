import bpy,json
from pathlib import Path
O=Path(__file__).resolve().parent/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_neon_depth_v8.blend'));s=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get()
visible=[];unique={};groups={};types={}
for ob in s.objects:
    if ob.hide_render or ob.type not in {'MESH','FONT','CURVE','SURFACE','META'}:continue
    # A render-hidden collection hides its children even when the object flag is clear.
    def in_visible_tree(c,hidden=False):
        hidden=hidden or c.hide_render
        if ob.name in c.objects and not hidden:return True
        return any(in_visible_tree(ch,hidden) for ch in c.children)
    if not in_visible_tree(s.collection):continue
    ev=ob.evaluated_get(dg);me=ev.to_mesh()
    if me is None:continue
    me.calc_loop_triangles();n=len(me.loop_triangles);ev.to_mesh_clear()
    visible.append((ob.name,n));types[ob.type]=types.get(ob.type,0)+n
    key=(ob.type,ob.data.as_pointer())
    if key not in unique:unique[key]=n
    if 'sakura' in ob.name.lower() or 'canopy' in ob.name.lower() or 'tree' in ob.name.lower():group='Foliage (name classification)'
    else:group=next((c.name for c in ob.users_collection),'Scene')
    groups[group]=groups.get(group,0)+n
r={'file':'tokyo_neon_depth_v8.blend','visible_evaluated_triangles':sum(n for _,n in visible),'visible_evaluated_objects':len(visible),'unique_geometry_triangles_approx':sum(unique.values()),'by_object_type':types,'by_group':dict(sorted(groups.items(),key=lambda x:-x[1])),'largest_objects':sorted(visible,key=lambda x:-x[1])[:12],'scope':'Full scene render-visible geometry including modifiers, text and repeated object instances; no camera/frustum culling; hidden LODs and superseded hidden bridge excluded.'}
(O/'triangle-count-v8.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2),flush=True)
