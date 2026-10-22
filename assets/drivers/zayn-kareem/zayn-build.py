from pathlib import Path
import base64, hashlib, json, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SRC = OUT / 'source/illustration-v1.png'
if not SRC.exists():
    raise SystemExit(f'Waiting for root-generated source illustration at {SRC}')
teams = json.loads((ROOT / 'assets/teams/teams.json').read_text(encoding='utf8'))['teams']
team = next(t for t in teams if t['id'] == 'sarab')
entry = next(c for c in team['cars'] if c['key'] == 'mp1x')
driver = entry['driver']
cars = json.loads((ROOT / 'assets/cars/specs.json').read_text(encoding='utf8'))['cars']
car_model = cars[entry['key']]['model']
assert (driver['name'], driver['nation'], driver['age'], entry['number'], car_model, team['sponsor']) == ('Zayn Kareem', 'UAE', 27, 3, 'McLaren 720S', 'Emirates')
font_dir = ROOT / 'track-viewer/public/assets/fonts'
team_font = TTFont(font_dir / team['font']['file'])
info_font = TTFont(font_dir / 'barlow-condensed-latin-700-normal.woff2')

def text_path(txt, x, baseline, height, color, which='team', maxwidth=1200, spacing=0):
    f = team_font if which == 'team' else info_font
    glyphset, cmap = f.getGlyphSet(), f.getBestCmap()
    advance, glyphs, bounds = 0, [], BoundsPen(f.getGlyphSet())
    for char in txt:
        name = cmap.get(ord(char), cmap.get(ord('-')))
        glyphs.append((name, advance))
        glyphset[name].draw(TransformPen(bounds, (1, 0, 0, 1, advance, 0)))
        advance += f['hmtx'][name][0] + spacing * f['head'].unitsPerEm
    x0, y0, x1, y1 = bounds.bounds
    scale = min(height / (y1 - y0), maxwidth / (x1 - x0))
    pen = SVGPathPen(glyphset)
    for name, offset in glyphs:
        glyphset[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x + (offset - x0) * scale, baseline + y0 * scale)))
    return f'<path fill="{color}" d="{pen.getCommands()}"/>'

def data(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(Path(path).read_bytes()).decode('ascii')

art = data(SRC, 'image/png')
team_logo = data(ROOT / 'assets/teams/logos/sarab-lockup-onTeam.svg', 'image/svg+xml')
emirates = data(ROOT / 'assets/sponsors/logos/emirates.png', 'image/png')
teal, pearl, gold = team['colors']['secondary'], team['colors']['primary'], team['colors']['accent']
parts = [
'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><title>Zayn Kareem — Sarab number 3</title><desc>Original inked cel-shaded driver introduction illustration featuring Zayn Kareem and a Sarab McLaren 720S.</desc>',
f'<rect width="1920" height="1080" fill="{pearl}"/>',
f'<image href="{art}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
'<defs><linearGradient id="leftFade" x1="0" x2="1"><stop stop-color="#f1efe8" stop-opacity=".99"/><stop offset=".75" stop-color="#f1efe8" stop-opacity=".96"/><stop offset="1" stop-color="#f1efe8" stop-opacity=".82"/></linearGradient></defs>',
'<path d="M0 0H755L850 1080H0Z" fill="url(#leftFade)"/>',
f'<image href="{team_logo}" x="72" y="40" width="300" height="75" preserveAspectRatio="xMinYMid meet"/>',
text_path('CORNICHE MARINA  /  SARAB RACING',78,148,15,'#173431','info',560,.035),
f'<path d="M78 201h78v6H78Z" fill="{gold}"/>',
text_path('ZAYN',68,318,80,'#123b39',maxwidth=560),
text_path('KAREEM',62,432,82,teal,maxwidth=610),
text_path('THE HOME HERO',80,490,22,'#173431','info',450,.05),
f'<path d="M78 532h78v5H78Z" fill="{gold}"/>',
text_path('A CITY IN HIS CORNER.',80,582,22,'#173431','info',570,.03),
text_path('A CROWN IN HIS SIGHTS.',80,617,22,'#173431','info',575,.03),
f'<path d="M78 654h380v1h-380Z" fill="{teal}" opacity=".5"/>',
f'<path d="M78 698h82v88H78Z" fill="{teal}"/>',
text_path('3',102,766,54,pearl,maxwidth=42),
text_path('UAE',184,733,20,'#173431','info',200,.06),
text_path('27 YEARS OLD',184,773,17,'#173431','info',245,.04),
text_path('POWERBOAT RACER TURNED HOME HERO',80,829,15,'#173431','info',545,.02),
f'<path d="M78 858h510v140H78Z" fill="#123b39"/>',
text_path('THE MACHINE',99,886,12,pearl,'info',225,.06),
text_path('McLAREN',98,933,30,pearl,maxwidth=300),
text_path('720S',98,972,28,gold,maxwidth=225),
text_path('4.0 L V8 TWIN-TURBO  /  710 HP',99,989,12,pearl,'info',430,.02),
# A solid Sarab teal tile provides strong contrast for the official white Emirates artwork.
f'<path d="M1626 42h240v160h-240Z" fill="{teal}"/>',
text_path('TITLE PARTNER',1648,71,11,pearl,'info',190,.07),
f'<image href="{emirates}" x="1646" y="85" width="104" height="93" preserveAspectRatio="xMidYMid meet"/>',
text_path('EMIRATES',1761,142,20,pearl,'info',94,.03),
text_path('ULTRACK  /  DRIVER INTRO',1580,1038,13,pearl,'info',280,.08),
f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{gold}" stroke-width="3"/>',
'</svg>'
]
svg = ''.join(parts)
(OUT / 'poster-v1.svg').write_text(svg, encoding='utf8')
source_hash = hashlib.sha256(SRC.read_bytes()).hexdigest()
meta = {
    'schemaVersion': 1,
    'status': 'awaiting-user-style-approval',
    'driver': driver,
    'team': team['id'],
    'raceNumber': entry['number'],
    'carKey': entry['key'],
    'manufacturer': 'McLaren',
    'car': '720S',
    'titleSponsor': team['sponsor'],
    'font': team['font'],
    'style': 'Original fictional 27-year-old Emirati driver in GTA V loading-screen-inspired inked, cel-shaded illustration; no real-person likeness.',
    'illustration': 'illustration-v1.webp',
    'sourceIllustration': 'source/illustration-v1.png',
    'sourceSha256': source_hash,
    'generationCalls': 1,
    'composition': '1920x1080 static driver poster; team lettering is outlined and artwork is embedded in the SVG for portability.',
    'outputs': {}
}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')

art_direction = (OUT / 'source/prompt-used.txt').read_text(encoding='utf-8-sig').strip()
(OUT / 'source/ART-DIRECTION.md').write_text('# Image-generation prompt — concept 01\n\nGeneration Calls: 1 (performed by the root agent via its centrally managed image-generation call).\n\n' + art_direction + '\n', encoding='utf8')

node = ROOT / 'track-viewer/node_modules/.bin/node'
if not node.exists():
    node = 'node'
render = f'''const sharp=require(require.resolve('sharp',{{paths:[{json.dumps(str(ROOT / 'track-viewer'))}]}})); Promise.all([sharp({json.dumps(str(SRC))}).webp({{quality:83,method:6}}).toFile({json.dumps(str(OUT / 'illustration-v1.webp'))}),sharp({json.dumps(str(OUT / 'poster-v1.svg'))},{{density:72}}).resize(1920,1080).png({{compressionLevel:8}}).toFile({json.dumps(str(OUT / 'poster-v1.png'))})]).then(()=>console.log('Rendered Zayn poster and web illustration.')).catch(e=>{{console.error(e);process.exit(1)}});'''
subprocess.run([str(node), '-e', render], cwd=ROOT, check=True)
meta['outputs'] = {name: {'sha256': hashlib.sha256((OUT / name).read_bytes()).hexdigest()} for name in ('poster-v1.png', 'poster-v1.svg')}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print('sourceSha256:', source_hash)
for name in ('poster-v1.png', 'poster-v1.svg', 'illustration-v1.webp'):
    print(name + ':', (OUT / name).stat().st_size, 'bytes')

