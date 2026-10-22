import bpy,json
from pathlib import Path
from mathutils import Vector
O=Path(__file__).resolve().parent/'out'
bpy.ops.wm.open_mainfile(filepath=str(O/'tokyo_bridge_v5.blend'));s=bpy.context.scene
P=[Vector(p) for p in json.loads((O/'centerline.json').read_text())['points']]
for o in s.objects:
    if o.type=='LIGHT':
        if o.name.startswith('Crimson tower wash'):o.data.energy=14000
        elif o.name.startswith('Upper tower wash'):o.data.energy=2200
        elif o.name.startswith('Arch soft grazing'):o.data.energy=260
    if o.name.startswith(('Lamp outreach','Lamp diffuser')):
        q=o.matrix_world.translation
        i=min(range(len(P)),key=lambda j:(P[j].x-q.x)**2+(P[j].y-q.y)**2)
        if 675<=i<=810:o.hide_render=True;o.hide_set(True)
fog=bpy.data.materials['V5 local illuminated humidity']
fog.node_tree.nodes.get('Map Range').inputs['To Min'].default_value=.012
c=bpy.data.objects['V5 | bridge driving view'];c.location=P[675]+Vector((0,0,1.5));c.rotation_euler=(P[718]+Vector((0,0,24))-c.location).to_track_quat('-Z','Y').to_euler();c.data.lens=28;s.camera=c
bpy.ops.wm.save_as_mainfile(filepath=str(O/'tokyo_bridge_v5.blend'))
s.render.filepath=str(O/'bridge_night_v5.png');bpy.ops.render.render(write_still=True)
print('V5_REFINED_COMPLETE',flush=True)
