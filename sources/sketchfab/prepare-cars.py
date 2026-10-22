# Prepares the four 2026-10-21 Sketchfab cars for scripts/model-car.py (track-viewer): game-rip structure -> role-tagged parts.
#   blender -b -t 6 --python sources/sketchfab/prepare-cars.py -- <laferrari|huracan|valkyrie|p918|gt4|nissanz|supra>
# Reads <folder>/model.glb, writes <folder>/prepared.glb with
#   - every mesh un-parented, in world space (the pipeline measures and scales it itself),
#   - object names the pipeline's wheel patterns find ("Tyre_", "Spin_" = rim + disc, "Caliper_", "INT:" = cabin),
#   - materials renamed "<role>|<name>" (paint, glass, mirror, mirrorPaint, mirrorHousing, tail, headkeep, caliper, keep).
# The three Real-Racing-3-style rips (LOD_A_<PART>_mm_<material> parents) share rules; the 918 has its own.
# Paint: the "ext" atlas of a rip holds body paint and black carbon/trim together, so faces whose atlas texel is dark stay the model's own
# (black roof, hood centre, splitter), the rest takes the game's team paint. The 918's baked white panels are picked the other way round.
import bpy, bmesh, sys, os, re, math
import numpy as np
from mathutils import Vector, Matrix

key = sys.argv[sys.argv.index('--') + 1]
HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER = {'laferrari': 'Flaferrari', 'huracan': 'Lhuracan-sto', 'valkyrie': 'Avalkyrie', 'p918': 'P918-spyder', 'gt4': 'Mamg-gt4', 'nissanz': 'Nnissan-z-gt4', 'supra': 'Tsupra-gt'}[key]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, FOLDER, 'model.glb'))

# ---- remember each mesh's parent (the part name), then flatten: world-space single-user meshes, no empties
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
PART = {}
for o in meshes:
    PART[o.name] = o.parent.name if o.parent else ''
    o.data = o.data.copy()
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    o.data.transform(mw); o.matrix_world = Matrix()
for o in [o for o in bpy.data.objects if o.type != 'MESH']: bpy.data.objects.remove(o)

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
def center(o):
    pts = [Vector(c) for c in o.bound_box]
    return sum(pts, Vector()) / 8

# ---- texture sampling (atlas colour at a face)
_img = {}
def image_of(m):
    n = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not n or not n.inputs['Base Color'].links: return None
    nd = n.inputs['Base Color'].links[0].from_node
    while nd.type == 'MIX' and nd.inputs['A'].links: nd = nd.inputs['A'].links[0].from_node     # glTF colour factor / vertex colour multiply: the texture is input A
    return nd.image if nd.type == 'TEX_IMAGE' else None
def pixels(img):
    if img.name not in _img:
        w, h = img.size; a = np.empty(w * h * img.channels, np.float32); img.pixels.foreach_get(a)
        _img[img.name] = a.reshape(h, w, img.channels)[:, :, :3]
    return _img[img.name]
def face_rgb(arr, f, uvl):
    h, w = arr.shape[:2]
    uvs = [Vector(l[uvl].uv) for l in f.loops]; c = sum(uvs, Vector((0, 0))) / len(uvs)
    out = [arr[int((p.y % 1) * h) % h, int((p.x % 1) * w) % w] for p in [c] + [c.lerp(u, 0.5) for u in uvs]]
    return np.median(np.array(out), axis=0)
def lum(rgb): return float(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2])

def split(o, pred):
    """Faces passing pred(face, uvlayer) -> a new object with the same material; o keeps the rest (None when nothing passes; o itself when all pass)."""
    bm = bmesh.new(); bm.from_mesh(o.data); uvl = bm.loops.layers.uv.active
    sel = [f for f in bm.faces if pred(f, uvl)]
    if not sel: bm.free(); return None
    if len(sel) == len(bm.faces): bm.free(); return o
    a = o.copy(); a.data = o.data.copy(); bpy.context.collection.objects.link(a)
    bmesh.ops.delete(bm, geom=sel, context='FACES'); bm.to_mesh(o.data); bm.free()
    bm = bmesh.new(); bm.from_mesh(a.data); uvl = bm.loops.layers.uv.active
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not pred(f, uvl)], context='FACES'); bm.to_mesh(a.data); bm.free()
    return a

_mat = {}
def tag(o, role, newname=None):
    for s in o.material_slots:
        m = s.material
        if not m: continue
        nm = f"{role}|{m.name.split('|')[-1]}"
        if nm not in _mat:
            c = m.copy(); c.name = nm; _mat[nm] = c
        s.material = _mat[nm]
    if newname: o.name = newname

out = {}      # final name -> object (names must stay unique)
def put(o, name, role):
    n, i = name, 1
    while n in out: i += 1; n = f'{name}.{i}'
    tag(o, role, n); out[n] = o

# ================= the Real-Racing-3-style rips =================
KINDS = ['ext', 'misc', 'lights', 'windows', 'cab', 'chassis', 'badges', 'wheel', 'tyre', 'rotor', 'chrome', 'gloss']
def kind_of(matname):
    toks = [t.lower() for t in re.split(r'[_.]', matname)]
    return next((k for k in KINDS if k in toks), 'misc')

# per car: dark_keep = atlas luminance under which an "ext" face stays the model's own (None: every ext face is paint);
# no_paint = parts whose ext faces never take paint; drop = parts removed
RR3 = {
    'laferrari': dict(dark_keep=0.13, no_paint=['EXHAUST', 'CHASSIS', 'WING_REAR'], drop=[]),
    'huracan':   dict(dark_keep=0.13, no_paint=['EXHAUST', 'CHASSIS'], drop=[]),
    # the Valkyrie has camera pods, not mirrors: the pods are the DOOR_* "misc" parts
    'valkyrie':  dict(dark_keep=None, no_paint=['STRUT', 'CHASSIS', 'EXHAUST'], drop=['MIRROR_LEFT_mm_ext', 'MIRROR_RIGHT_mm_ext'], door_misc_is_mirror=True, rear=1),
}

def rr3_rules(cfg):
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH': continue
        raw = PART[o.name]
        m = re.match(r'^LOD_A_(.+?)_mm_([A-Za-z0-9]+)', raw)
        part = m.group(1) if m else raw
        mat = o.material_slots[0].material.name if o.material_slots and o.material_slots[0].material else ''
        k = kind_of(mat)
        if any(raw.startswith('LOD_A_' + d) or part == d for d in cfg['drop']): bpy.data.objects.remove(o); continue
        base = f'{part}_{k}'
        side = ('L' if 'LEFT' in part else 'R' if 'RIGHT' in part else '')
        # wheels: the tyre part holds tyre, rotor, rim and caliper for LaFerrari; Valkyrie keeps calipers and rotors in BRAKE_CALIPER_*
        if re.match(r'^(TYRE|WHEEL)(_REAR)?$', part) or part.startswith('BRAKE_CALIPER'):
            if k == 'tyre': put(o, 'Tyre_' + base, 'keep')
            elif k in ('wheel', 'rotor'): put(o, 'Spin_' + base, 'keep')
            elif k == 'misc': put(o, 'Caliper_' + base, 'caliper')
            else: put(o, 'Spin_' + base, 'keep')
            continue
        if part.startswith('GLASS'): put(o, base, 'glass'); continue
        if part.startswith('MIRROR_GLASS') or part.startswith('INT_MIRROR_GLASS'): put(o, base, 'mirror'); continue
        if cfg.get('door_misc_is_mirror') and part.startswith('DOOR') and k == 'misc':
            # camera pod: its rear-facing faces are the mirror glass the game collects (role "mirror"), the rest is housing
            g = split(o, lambda f, uvl: f.normal.y * cfg['rear'] > 0.35)
            if g is o: put(o, base + '_glass', 'mirror')
            else:
                put(o, base, 'mirrorHousing')
                if g: put(g, base + '_glass', 'mirror')
            continue
        if part.startswith('MIRROR'):
            put(o, base, 'mirrorPaint' if k == 'ext' else 'mirrorHousing'); continue
        if part.startswith('HEADLIGHT_LENS'):
            put(o, base, 'headkeep' if k == 'windows' else 'keep'); continue
        if part.startswith('TAILLIGHT_LENS') or part.startswith('BRAKES_'):
            put(o, base, 'tail' if k == 'lights' else 'keep'); continue
        if part in ('INTERIOR', 'STEERING_WHEEL') or k == 'cab': put(o, 'INT:' + base, 'keep'); continue
        if k == 'ext' and not any(n in part for n in cfg['no_paint']):
            thr = cfg['dark_keep']
            if thr is None: put(o, base, 'paint'); continue
            img = image_of(o.material_slots[0].material); arr = pixels(img) if img else None
            dark = (lambda f, uvl: lum(face_rgb(arr, f, uvl)) < thr) if arr is not None else (lambda f, uvl: False)
            d = split(o, dark)
            if d is o: put(o, base + '_carbon', 'keep')            # every face dark
            else:
                put(o, base, 'paint')                                # what is left of o is paint
                if d: put(d, base + '_carbon', 'keep')
            continue
        put(o, base, 'keep')

if key in RR3: rr3_rules(RR3[key])

# ================= the 918 (Unity-style prefab parts; nose +Y, rear -Y, ~3.8 model units per metre) =================
def p918():
    TYRES = {'Object_57', 'Object_63', 'Object_67', 'Object_69'}
    RIMS = {'Object_11', 'Object_17', 'Object_21', 'Object_25'}
    ROTORS = {'Object_61', 'Object_71', 'Object_73', 'Object_75'}
    CALIPERS = {'Object_65', 'Object_77', 'Object_79', 'Object_81'}
    DROP = {'Object_93', 'Object_95', 'Object_97'}        # number-plate and additive glow quads (alpha planes across the whole car)
    is_red = lambda c: c[0] > 0.30 and c[0] > 1.8 * c[1] and c[0] > 1.8 * c[2]
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH': continue
        n = o.name; mat = o.material_slots[0].material.name if o.material_slots and o.material_slots[0].material else ''
        if n in DROP: bpy.data.objects.remove(o); continue
        if n in TYRES: put(o, 'Tyre_' + n, 'keep'); continue
        if n in RIMS or n in ROTORS: put(o, 'Spin_' + n, 'keep'); continue
        if n in CALIPERS: put(o, 'Caliper_' + n, 'caliper'); continue
        if mat == '918_Spyder_Paint': put(o, 'paint_' + n, 'paint'); continue
        if mat == 'Glass_Parts':
            g = split(o, lambda f, uvl: f.calc_center_median().y > 6.5)       # headlamp covers at the nose
            if g is o: put(o, 'headlamps', 'headkeep')
            else:
                put(o, 'glass', 'glass')
                if g: put(g, 'headlamps', 'headkeep')
            continue
        if mat == 'Bodyunrefunblend1_diff':
            # mirror glass: the small plate at each mirror housing; tail lamps: red atlas texels at the rear
            img = image_of(o.material_slots[0].material); arr = pixels(img)
            gl = split(o, lambda f, uvl: abs(f.calc_center_median().x) > 3.3 and 1.6 < f.calc_center_median().y < 2.2 and f.calc_center_median().z > 1.6 and n == 'Object_9')
            if gl is o: put(o, 'mirrors_' + n, 'mirror'); continue
            if gl: put(gl, 'mirrorglass', 'mirror')
            tl = split(o, lambda f, uvl: f.calc_center_median().y < -6.0 and is_red(face_rgb(arr, f, uvl)))
            if tl is o: put(o, 'tail_' + n, 'tail'); continue
            if tl: put(tl, 'tail_' + n, 'tail')
            put(o, 'trim_' + n, 'keep'); continue
        put(o, 'misc_' + n, 'keep')
if key == 'p918': p918()

# ================= the AMG GT4 (Real Racing 3 rip: parents "<scene>:LOD_A_<PART>_mm_<kind>", livery atlas with the grey base, green stripes, black roof band; nose -Y) =================
def gt4(win=('wubdiws',), ext=None, drop=()):   # win: the glass material names; ext: the one paint atlas material (None: every ext part); drop: parts removed
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH': continue
        m = re.search(r'LOD_A_(.+?)_mm_([A-Za-z0-9]+)', PART[o.name])
        part, k = (m.group(1), m.group(2)) if m else (PART[o.name], 'misc')
        if any(d in PART[o.name] for d in drop): bpy.data.objects.remove(o); continue
        raw = PART[o.name].split('LOD_A_')[-1]
        mat = o.material_slots[0].material if o.material_slots else None
        mn = mat.name if mat else ''
        base = raw
        if 'MIRROR_GLASS' in part: put(o, base, 'mirror'); continue     # the Z keeps its mirror glass under INT_
        if part.startswith('INT_') or part == 'INTERIOR': put(o, 'INT:' + base, 'keep'); continue
        if part == 'TYRE': put(o, 'Tyre_' + base, 'keep'); continue
        if part in ('WHEEL', 'ROTOR'): put(o, 'Spin_' + base, 'keep'); continue
        if part.startswith('BRAKE_CALIPER'): put(o, 'Caliper_' + base, 'caliper'); continue
        if part.startswith('GLASS'): put(o, base, 'glass' if mn in win else 'keep'); continue
        if part.startswith('MIRROR_GLASS'): put(o, base, 'mirror'); continue
        if part.startswith('MIRROR'): put(o, base, 'mirrorPaint' if k == 'ext' else 'mirrorHousing'); continue
        if part.startswith('HEADLIGHT_LENS'): put(o, base, 'headkeep'); continue
        if part.startswith('TAILLIGHT_LENS'): put(o, base, 'keep'); continue
        if part.startswith('BRAKES_'): put(o, base, 'tail'); continue
        if k == 'ext' and part not in ('EXHAUST', 'CHASSIS') and (not ext or mn == ext):
            img = image_of(mat); arr = pixels(img)
            ref = np.median(arr.reshape(-1, 3), axis=0)           # the livery's grey base is most of the atlas
            isgrey = lambda f, uvl: float(np.abs(face_rgb(arr, f, uvl) - ref).max()) < 0.10
            g = split(o, lambda f, uvl: not isgrey(f, uvl))      # stripes, numbers, logos, carbon stay the model's own
            if g is o: put(o, base + '_livery', 'keep')
            else:
                put(o, base, 'paint')
                if g: put(g, base + '_livery', 'keep')
            continue
        put(o, base + '_' + mn, 'keep')
if key == 'gt4': gt4()
# the Z GT4 (same rip family: white atlas, red stripes and decals stay; "mm_windiws" glass; a shattered-window mesh is dropped)
if key == 'nissanz': gt4(win=('mm_windiws',), ext='mm_ext', drop=('windows_shattered',))

# ================= the GR Supra Super GT (one body atlas: white base takes the team paint, red/black livery, decals and the number stay; nose -Y) =================
def supra():
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH': continue
        mat = o.material_slots[0].material if o.material_slots else None
        mn = mat.name if mat else ''
        base = PART[o.name] or o.name
        if mn == 'inter': put(o, 'INT:' + base, 'keep'); continue
        if mn == 'tyre': put(o, 'Tyre_' + base, 'keep'); continue
        if mn in ('material_13', 'word'): put(o, 'Spin_' + base + '_' + mn, 'keep'); continue
        if mn == 'glass': put(o, base, 'glass'); continue
        if mn == 'red_glass': put(o, base, 'tail'); continue       # the rear light bar is lens and lamp in one
        if mn == 'head_glass': put(o, base, 'headkeep'); continue
        if mn.startswith('brake_'): put(o, base, 'tail'); continue
        if mn == 'body':
            mg = split(o, lambda f, uvl: abs(f.calc_center_median().x) > 0.99 and 0.64 < f.calc_center_median().z < 0.75 and 0 < f.calc_center_median().y < 0.03 and f.normal.y > 0.9)
            if mg is o: put(o, base + '_mirrors', 'mirror'); continue      # the mirror glass faces the driver: rear-facing faces of the two stalks' heads (raw model metres)
            if mg: put(mg, 'mirrorglass', 'mirror')
            arr = pixels(image_of(mat)); ref = np.median(arr.reshape(-1, 3), axis=0)
            g = split(o, lambda f, uvl: float(np.abs(face_rgb(arr, f, uvl) - ref).max()) >= 0.10)
            if g is o: put(o, base + '_livery', 'keep')
            else:
                put(o, base, 'paint')
                if g: put(g, base + '_livery', 'keep')
            continue
        put(o, base + '_' + mn, 'keep')
if key == 'supra': supra()

# ================= export =================
def export():
    bpy.ops.object.select_all(action='DESELECT')
    for o in out.values(): o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, FOLDER, 'prepared.glb'), export_format='GLB', use_selection=True,
                              export_animations=False, export_image_format='AUTO', export_yup=True)
export()
roles = {}
for n, o in out.items():
    r = o.material_slots[0].material.name.split('|')[0] if o.material_slots and o.material_slots[0].material else '?'
    roles.setdefault(r, []).append((n, tris(o)))
for r, l in roles.items(): print('ROLE', r, sum(t for _, t in l), 'tris', [n for n, _ in l][:40])
