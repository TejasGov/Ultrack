"""Venice's Poly Haven (CC0) sets, approved by the user 2026-11-03: 8 sets at 2K, about 72 MB -> assets/polyhaven/<id>/, listed in its CREDITS.md.
Not tools/fetch_polyhaven.py's main(): that rewrites CREDITS.md from its own short list and would drop other tracks' entries."""
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('fetch_polyhaven', Path(__file__).parents[2] / 'tools' / 'fetch_polyhaven.py'); fp = importlib.util.module_from_spec(spec); spec.loader.exec_module(fp)
SETS = ['large_sandstone_blocks', 'medieval_blocks_03', 'damaged_plaster', 'plastered_stone_wall', 'medieval_red_brick', 'brick_wall_10', 'clay_roof_tiles_02', 'roof_slates_02']
credits = Path(fp.ROOT) / 'CREDITS.md'; text = credits.read_text(encoding='utf8')
for aid in SETS:
    files = fp.get_json(f'{fp.API}/files/{aid}')
    for m in ('Diffuse', 'nor_gl', 'arm'):
        url = files[m]['2k']['jpg']['url']; fp.download(url, str(Path(fp.ROOT) / aid / Path(url).name))
    if f'(`{aid}`)' not in text:
        info = fp.get_json(f'{fp.API}/info/{aid}')
        text = text.rstrip('\n') + f"\n- **{info['name']}** (`{aid}`) by {', '.join(info.get('authors', {}))}: https://polyhaven.com/a/{aid}\n"
credits.write_text(text, encoding='utf8')
print('done', sum(f.stat().st_size for a in SETS for f in (Path(fp.ROOT) / a).iterdir()) / 1e6, 'MB')
