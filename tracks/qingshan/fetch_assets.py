"""Qingshan's approved downloads (the user, 2026-11-03: broadleaf set, about 540 MB, all CC0).
Models -> source/<id>/ (each its own folder), Poly Haven textures -> assets/polyhaven/<id>/ and its CREDITS.md, SolarPanel002 from ambientCG -> assets/ambientcg/SolarPanel002/.
Skips what is on disk. Not tools/fetch_polyhaven.py's main(): that rewrites CREDITS.md from its own short list."""
import importlib.util, io, json, urllib.request, zipfile
from pathlib import Path
H = Path(__file__).parent; ROOT = H.parents[1]
spec = importlib.util.spec_from_file_location('fetch_polyhaven', ROOT / 'tools' / 'fetch_polyhaven.py'); fp = importlib.util.module_from_spec(spec); spec.loader.exec_module(fp)
MODELS = ['tree_small_02', 'island_tree_01', 'island_tree_02', 'jacaranda_tree', 'shrub_02', 'shrub_03', 'fern_02']
SETS = ['forest_leaves_02', 'forest_ground_04', 'ceramic_roof_01', 'box_profile_metal_sheet', 'gravel_ground_01']      # the gravel approved separately, 10 MB
credits = Path(fp.ROOT) / 'CREDITS.md'; text = credits.read_text(encoding='utf8')
def credit(aid):
    global text
    if f'(`{aid}`)' not in text:
        info = fp.get_json(f'{fp.API}/info/{aid}'); text = text.rstrip('\n') + f"\n- **{info['name']}** (`{aid}`) by {', '.join(info.get('authors', {}))}: https://polyhaven.com/a/{aid}\n"
for aid in MODELS:
    g = fp.get_json(f'{fp.API}/files/{aid}')['gltf']['2k']['gltf']; fp.download(g['url'], str(H / 'source' / aid / Path(g['url']).name))
    for rel, f in g.get('include', {}).items(): fp.download(f['url'], str(H / 'source' / aid / rel))
    credit(aid)
for aid in SETS:
    files = fp.get_json(f'{fp.API}/files/{aid}')
    for m in ('Diffuse', 'nor_gl', 'arm'):
        url = files[m]['2k']['jpg']['url']; fp.download(url, str(Path(fp.ROOT) / aid / Path(url).name))
    credit(aid)
credits.write_text(text, encoding='utf8')
sp = ROOT / 'assets' / 'ambientcg' / 'SolarPanel002'
if not sp.exists():
    req = urllib.request.Request('https://ambientcg.com/get?file=SolarPanel002_2K-JPG.zip', headers=fp.UA)
    with urllib.request.urlopen(req, timeout=120) as r: data = r.read()
    sp.mkdir(parents=True); z = zipfile.ZipFile(io.BytesIO(data))
    for n in z.namelist():
        if n.lower().endswith('.jpg') and Path(n).name == n and not set(n) & set(chr(47) + chr(92)): (sp / n).write_bytes(z.read(n))     # flat names only: nothing from the archive can land elsewhere
    (sp / 'SOURCE.txt').write_text('SolarPanel002, ambientCG, CC0: https://ambientcg.com/a/SolarPanel002\n', encoding='utf8')
print('done', {p.name: round(sum(f.stat().st_size for f in p.rglob('*') if f.is_file()) / 1e6, 1) for p in (H / 'source').iterdir() if p.is_dir()})
