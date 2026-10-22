# A complete car model (paint, glass, lamps, interior, real wheels) -> game meshes for track-viewer (src/cars.js, model path).
#   blender -b -t 6 --python scripts/model-car.py -- ../assets/cars/<key>/source.json
# Reads the source GLB named in source.json and writes next to source.json:
#   car_lod0.glb  body (budget.body0 triangles) + four wheels (budget.wheel each): wheel_FL/FR/RL/RR empties at the hub,
#                 each with a `spin` group (rim, tyre, disc) and a `caliper` group (steers, does not spin)
#   car_lod1.glb  body only (budget.body1); beyond 22 m the game swaps the wheels for stand-ins anyway
#   model.json    the profile the game and physics read: wheels (x, radius, width, track), lamp and exhaust points, side glass
# Frame: three.js car frame after export (nose -X, Y up, ground at Y = 0, centred), i.e. Blender nose -X, Z up.
# Every material is renamed "<role>|<name>": the game swaps paint, glass, mirror, head, tail and caliper for its own
# materials (team paint, brake lamps, venue reflections) and keeps the model's own textured material for "keep".
import bpy, bmesh, sys, json, math, os
from mathutils import Vector, Matrix

cfg_path = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
cfg = json.load(open(cfg_path))
here = os.path.dirname(cfg_path)
B = cfg.get('budget', {})

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(here, cfg['src']))
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
has = lambda o, keys: any(k.lower() in o.name.lower() for k in keys)
# source.json "materials": {"<name>": {"color": [r, g, b], "metallic": 0..1, "roughness": 0..1, "emission": strength}}: fix a surface the game lights badly
for name, ov in cfg.get('materials', {}).items():
    m = bpy.data.materials[name]; bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    if 'color' in ov: bsdf.inputs['Base Color'].default_value = (*ov['color'], 1)
    if 'metallic' in ov: bsdf.inputs['Metallic'].default_value = ov['metallic']
    if 'roughness' in ov: bsdf.inputs['Roughness'].default_value = ov['roughness']
    if 'emission' in ov: bsdf.inputs['Emission Strength'].default_value = ov['emission']
for o in [o for o in meshes if has(o, cfg.get('drop', []))]: meshes.remove(o); bpy.data.objects.remove(o)     # ground planes, props: before the frame is measured

# wheel corner groups ("groups" mode): remember each part's group and the group's world matrix before un-parenting
W = cfg['wheels']
group_of = {}
if W['mode'] == 'groups':
    for o in meshes:
        p = o.parent
        while p and not has(p, W['groups']): p = p.parent
        if p: group_of[o.name] = (p.name, p.matrix_world.copy())

# global frame: rotate, scale to the real length, centre
for o in meshes: o.data = o.data.copy()                           # single-user data before baking transforms
G = Matrix.Rotation(math.radians(cfg.get('rotateZ', 0)), 4, 'Z')
def bounds(objs, M=Matrix()):                                     # from the vertices: bound_box is stale after bmesh edits
    pts = [M @ o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])
body_objs = [o for o in meshes if o.name not in group_of and not has(o, W.get('spin', []) + W.get('caliper', []))]
mn, mx = bounds(body_objs, G)
s = cfg['length'] / (mx.x - mn.x)
c = (mn + mx) / 2
G = Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation((-c.x, -c.y, 0)) @ G
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = G @ mw if o.name not in group_of else mw
for o in list(bpy.data.objects):
    if o.type != 'MESH': bpy.data.objects.remove(o)

def apply(o):
    o.data.transform(o.matrix_world); o.matrix_world = Matrix()

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)

def corner(p): return ('F' if p.x < 0 else 'R') + ('L' if p.y < 0 else 'R')      # three +Z (left) = Blender -Y

def split_corners(o):
    """One object per corner, by face centre (wheels sit well over a metre apart, so a face never straddles)."""
    out = {}
    for k in ('FL', 'FR', 'RL', 'RR'):
        a = o.copy(); a.data = o.data.copy(); bpy.context.collection.objects.link(a)
        bm = bmesh.new(); bm.from_mesh(a.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if corner(f.calc_center_median()) != k], context='FACES')
        bm.to_mesh(a.data); bm.free()
        if a.data.polygons: out[k] = a
        else: bpy.data.objects.remove(a)
    bpy.data.objects.remove(o)
    return out

def split_faces(o, keep_face):                                    # faces passing keep_face -> new object
    bm = bmesh.new(); bm.from_mesh(o.data)
    sel = [f for f in bm.faces if keep_face(f)]
    if not sel: bm.free(); return None
    a = o.copy(); a.data = o.data.copy(); bpy.context.collection.objects.link(a)
    bmesh.ops.delete(bm, geom=sel, context='FACES'); bm.to_mesh(o.data); bm.free()
    bm = bmesh.new(); bm.from_mesh(a.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep_face(f)], context='FACES'); bm.to_mesh(a.data); bm.free()
    return a
# ---- wheels: parts per corner, re-posed upright at the hub, real diameter
parts = {k: {'spin': [], 'caliper': []} for k in ('FL', 'FR', 'RL', 'RR')}
hubs = {}
if W['mode'] == 'groups':
    by_group = {}
    for o in meshes:
        if o.name in group_of: by_group.setdefault(group_of[o.name][0], []).append(o)
    for gname, objs in by_group.items():
        M = group_of[objs[0].name][1]
        hub = G @ M.to_translation()
        k = corner(hub)
        tyre = [o for o in objs if has(o, W['tyre'])][0]
        loc = [M.inverted() @ o.matrix_world @ Vector(c) for c in tyre.bound_box for o in [tyre]]
        d_local = max(max(p.z for p in loc) - min(p.z for p in loc), max(p.y for p in loc) - min(p.y for p in loc))
        D = W['diameter']['front' if k[0] == 'F' else 'rear']
        R = Matrix.Rotation(math.radians(90 if hub.y > 0 else -90), 4, 'Z')     # local +X (rim face) -> outward
        P = Matrix.Translation(hub) @ R @ Matrix.Diagonal((D / d_local,) * 3 + (1,)) @ M.inverted()
        for o in objs:
            o.matrix_world = P @ o.matrix_world; apply(o)
            parts[k]['caliper' if has(o, W['caliper']) else 'spin'].append(o)
        hubs[k] = hub
else:   # "loose": one mesh per material covers all four wheels; split into pieces and sort them by corner
    # W['region']: name patterns of objects that mix wheel faces with body faces (their material is also used elsewhere):
    # only the faces inside a wheel (within maxR of the tyre radius around the axle, within the tyre's width) become wheel parts
    reg, reg_hub = W.get('region'), None
    wl = [o for o in meshes if has(o, W['spin'] + W['caliper'])]
    wl.sort(key=lambda o: not has(o, W['tyre']))                      # tyres first: the region test needs their hubs
    def in_wheel(f):
        c = f.calc_center_median()
        return any(math.hypot(c.x - h.x, c.z - h.z) <= r * W.get('maxR', 0.97) and abs(c.y - h.y) <= w for h, r, w in reg_hub)
    for o in wl:
        apply(o)
        if reg and has(o, reg):
            if reg_hub is None:
                reg_hub = []
                for p in parts.values():
                    ty = [t for t in p['spin'] if has(t, W['tyre'])]
                    if ty:
                        a, b = bounds(ty); reg_hub.append(((a + b) / 2, (b.z - a.z) / 2, (b.y - a.y) / 2 * 1.15))
            g = split_faces(o, in_wheel)
            if not g: continue                                         # nothing of it inside a wheel: stays body
            g.name = 'WHL_' + o.name; meshes.append(g)
            if not o.data.polygons: meshes.remove(o); bpy.data.objects.remove(o)
            o = g
        role = 'caliper' if has(o, W['caliper']) else 'spin'
        if o in meshes: meshes.remove(o)
        for k, piece in split_corners(o).items(): parts[k][role].append(piece)
    for k, p in parts.items():
        ty = [o for o in p['spin'] if has(o, W['tyre'])]
        mn, mx = bounds(ty)
        hubs[k] = (mn + mx) / 2
for o in meshes:
    if o.matrix_world != Matrix(): apply(o)

# per-axle radius and width from the tyres, ground at the mean contact, hubs at exactly their radius
spec = {}
for axle, ks in (('front', ('FL', 'FR')), ('rear', ('RL', 'RR'))):
    rr, ww = [], []
    for k in ks:
        mn, mx = bounds([o for o in parts[k]['spin'] if has(o, W['tyre'])])
        rr.append((mx.z - mn.z) / 2); ww.append(mx.y - mn.y)
    spec[axle] = {'radius': sum(rr) / 2, 'width': sum(ww) / 2,
                  'x': sum(hubs[k].x for k in ks) / 2, 'track': abs(hubs[ks[0]].y - hubs[ks[1]].y)}
ground = sum(hubs[k].z - spec['front' if k[0] == 'F' else 'rear']['radius'] for k in hubs) / 4
for o in bpy.data.objects: o.data.transform(Matrix.Translation((0, 0, -ground)))
for k in hubs: hubs[k] = Vector((hubs[k].x, hubs[k].y, spec['front' if k[0] == 'F' else 'rear']['radius']))

# ---- roles: split front/rear lamp meshes, then rename materials "<role>|<name>"
wheel_objs = {o for k in parts for g in parts[k].values() for o in g}
body = [o for o in bpy.data.objects if o not in wheel_objs]
def split_x(o):                                                     # faces ahead of the middle -> new object
    bm = bmesh.new(); bm.from_mesh(o.data)
    front = [f for f in bm.faces if f.calc_center_median().x < 0]
    if not front or len(front) == len(bm.faces): bm.free(); return (o, None) if not front else (None, o)
    a = o.copy(); a.data = o.data.copy(); bpy.context.collection.objects.link(a)
    bmesh.ops.delete(bm, geom=front, context='FACES'); bm.to_mesh(o.data); bm.free()
    bm = bmesh.new(); bm.from_mesh(a.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().x >= 0], context='FACES'); bm.to_mesh(a.data); bm.free()
    return a, o
# mirror glass inside an atlas material: rear-facing faces in the housing box (three.js frame, |z|)
mir = cfg.get('mirrorGlass')
if mir:
    (x0, y0, z0), (x1, y1, z1) = mir['box']
    def in_mirror(f):
        c = f.calc_center_median()
        return x0 <= c.x <= x1 and y0 <= c.z <= y1 and z0 <= abs(c.y) <= z1 and f.normal.x > 0.5
    for o in [o for o in body if o.material_slots and o.material_slots[0].material and o.material_slots[0].material.name in mir['materials']]:
        g = split_faces(o, in_mirror)
        if g:
            m = g.material_slots[0].material.copy(); m.name = 'mirror|' + m.name; g.material_slots[0].material = m; body.append(g)
roles = cfg.get('roles', {})
def role_of(o, mat):
    for sub, r in cfg.get('roleByObject', []):
        if sub.lower() in o.name.lower(): return r
    return roles.get(mat.name, 'keep')
def set_role(o, r):
    for slot in o.material_slots:
        m = slot.material
        if not m: continue
        if '|' in m.name: continue
        rr = r or role_of(o, m)
        name = f"{rr}|{m.name.split('|')[-1]}"
        if m.name != name:
            m2 = bpy.data.materials.get(name) or m.copy(); m2.name = name; slot.material = m2
for o in list(body):
    mat = o.material_slots[0].material.name if o.material_slots and o.material_slots[0].material else ''
    if mat in cfg.get('splitFrontRear', {}):
        fr, rr = cfg['splitFrontRear'][mat]
        a, b = split_x(o)
        if a: set_role(a, fr)
        if b: set_role(b, rr)
        if a and a not in body: body.append(a)
    else: set_role(o, None)
for k in parts:
    for o in parts[k]['caliper']: set_role(o, 'caliper' if any(m.material and roles.get(m.material.name.split('|')[-1]) == 'paint' for m in o.material_slots) else None)
    for o in parts[k]['spin']: set_role(o, None)

# lamp and exhaust points, side glass (three.js frame: x, y = Blender z, z = -Blender y)
T = lambda v: [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]
def pts(role):
    out = []
    for o in body:
        if any(s.material and s.material.name.startswith(role + '|') for s in o.material_slots) and o.data.vertices:
            for side in (1, -1):
                vs = [v.co for v in o.data.vertices if v.co.y * side < 0]
                if vs: out.append(T(sum(vs, Vector()) / len(vs)))
    return out
glass = [v.co for o in body if any(s.material and s.material.name.startswith('glass|') for s in o.material_slots) for v in o.data.vertices if v.co.y < -0.3]
side = []
if glass:
    gx = [v.x for v in glass]; gz = [v.z for v in glass]; gy = sum(v.y for v in glass) / len(glass)
    side = [T(Vector((min(gx), gy, min(gz)))), T(Vector((min(gx), gy, max(gz)))), T(Vector((max(gx), gy, max(gz)))), T(Vector((max(gx), gy, min(gz))))]
ex = [o for o in body if has(o, cfg.get('exhaust', []))]
tips = []
for o in ex:
    for sgn in (1, -1):
        vs = [v.co for v in o.data.vertices if v.co.y * sgn > 0]
        if vs: p = sum(vs, Vector()) / len(vs); tips.append([round(p.z, 3), round(-p.y, 3)])

# ---- decimate: body to budget (cabin and engine twice as hard), each wheel to budget
def decimate(objs, budget, weight=lambda o: 1):
    total = sum(tris(o) for o in objs)
    if total <= budget: return
    r = budget / total
    for o in objs:
        if tris(o) < 400: continue
        mod = o.modifiers.new('dec', 'DECIMATE'); mod.ratio = max(0.02, min(1, r * weight(o)))
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='dec')
heavy = cfg.get('interior', [])
decimate(body, B.get('body0', 130000), lambda o: 0.5 if has(o, heavy) else 1.15)
for k in parts: decimate(parts[k]['spin'] + parts[k]['caliper'], B.get('wheel', 10000))

# join per material inside each group (fewer draws), parent wheels to hub empties
def join(objs, name):
    by = {}
    for o in objs:
        by.setdefault(o.material_slots[0].material.name if o.material_slots else '', []).append(o)
    out = []
    for mat, os_ in by.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in os_: o.select_set(True)
        bpy.context.view_layer.objects.active = os_[0]
        if len(os_) > 1: bpy.ops.object.join()
        os_[0].name = f'{name}:{mat}'; out.append(os_[0])
    return out
body = join(body, 'body')
root = bpy.data.objects.new('body', None); bpy.context.collection.objects.link(root)
for o in body: o.parent = root
wheel_roots = []
for k, p in parts.items():
    e = bpy.data.objects.new(f'wheel_{k}', None); e.location = hubs[k]; bpy.context.collection.objects.link(e)
    for g in ('spin', 'caliper'):
        ge = bpy.data.objects.new(f'wheel_{k}_{g}', None); ge.parent = e; bpy.context.collection.objects.link(ge)
        for o in join(p[g], f'{k}_{g}'):
            o.data.transform(Matrix.Translation(-hubs[k])); o.parent = ge
    wheel_roots.append(e)

# textures: at most 1024 px (a car is under a quarter of the screen); exported as WebP
for img in list(bpy.data.images):
    if img.size[0] and (img.channels != 4 or img.depth < 24):      # grey maps: WebP has no 1-channel mode, copy to RGBA
        w, h = img.size; buf = [0.0] * (w * h * 4); img.pixels.foreach_get(buf)
        rgb = bpy.data.images.new(img.name + '_rgb', w, h, alpha=True)
        rgb.pixels.foreach_set(buf)
        img.user_remap(rgb); img = rgb
    if img.size[0] > 1024 or img.size[1] > 1024:
        f = 1024 / max(img.size); img.scale(max(1, int(img.size[0] * f)), max(1, int(img.size[1] * f)))

def export(path, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        for ch in o.children_recursive: ch.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format='GLB', export_image_format='WEBP',
                              export_yup=True, export_apply=True, export_animations=False)
export(os.path.join(here, 'car_lod0.glb'), [root] + wheel_roots)
body1 = []
for o in body:
    d = o.copy(); d.data = o.data.copy(); bpy.context.collection.objects.link(d); d.parent = None; body1.append(d)
decimate(body1, B.get('body1', 25000))
root1 = bpy.data.objects.new('body', None); bpy.context.collection.objects.link(root1)
for o in body1: o.parent = root1
export(os.path.join(here, 'car_lod1.glb'), [root1])

mn, mx = bounds(body)
model = {
    'note': 'Written by track-viewer/scripts/model-car.py from source.json; do not edit by hand.',
    **({'name': cfg['name']} if cfg.get('name') else {}),
    'source': cfg.get('credit', {}),
    'wheels': {a: {kk: round(v, 4) for kk, v in sp.items()} for a, sp in spec.items()},
    'size': {'length': round(mx.x - mn.x, 3), 'width': round(mx.y - mn.y, 3), 'height': round(mx.z - mn.z, 3)},
    'lights': {'front': pts('head') or pts('headkeep'), 'rear': pts('tail')},   # headkeep: beam points, the model's own lamp look
    'glass': {'side': side},
    'exhaust': tips,
    'triangles': {'body0': sum(tris(o) for o in body), 'body1': sum(tris(o) for o in body1),
                  'wheel': round(sum(tris(o) for e in wheel_roots for o in e.children_recursive if o.type == 'MESH') / 4)},
}
json.dump(model, open(os.path.join(here, 'model.json'), 'w'), indent=1)
print('MODEL', json.dumps(model))
