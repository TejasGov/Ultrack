from pathlib import Path
import base64, hashlib, json, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SRC = OUT / 'source/illustration-v1.png'
teams = json.loads((ROOT / 'assets/teams/teams.json').read_text(encoding='utf8'))['teams']
team = next(t for t in teams if t['id'] == 'liberty')
entry = next(c for c in team['cars'] if c['key'] == 'blackbird')
driver = entry['driver']
cars = json.loads((ROOT / 'assets/cars/specs.json').read_text(encoding='utf8'))['cars']
car_model = cars[entry['key']]['model']
assert (driver['name'], driver['nation'], driver['age'], entry['number'], car_model, team['sponsor']) == ('Wade Hollis', 'USA', 37, 76, 'Hennessey Blackbird (announced 2026)', 'Coca-Cola')
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
    stroke = height * team['font'].get('bold', 0) if which == 'team' else 0
    return f'<path fill="{color}" stroke="{color}" stroke-width="{stroke}" stroke-linejoin="round" d="{pen.getCommands()}"/>'

def data(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(Path(path).read_bytes()).decode('ascii')

art = data(SRC, 'image/png')
team_logo = data(ROOT / 'assets/teams/logos/liberty-lockup-onTeam.svg', 'image/svg+xml')
coke = data(ROOT / 'assets/sponsors/logos/cocacola.png', 'image/png')
blue, red, white = team['colors']['primary'], team['colors']['secondary'], team['colors']['accent']
parts = [
'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><title>Wade Hollis — Liberty number 76</title><desc>Original inked cel-shaded driver introduction illustration featuring Wade Hollis and the Liberty Hennessey Blackbird.</desc>',
f'<image href="{art}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
'<defs><linearGradient id="leftFade" x1="0" x2="1"><stop stop-color="#08152d" stop-opacity=".99"/><stop offset=".78" stop-color="#08152d" stop-opacity=".96"/><stop offset="1" stop-color="#08152d" stop-opacity=".62"/></linearGradient></defs>',
'<path d="M0 0H740L830 1080H0Z" fill="url(#leftFade)"/>',
f'<image href="{team_logo}" x="68" y="38" width="292" height="72" preserveAspectRatio="xMinYMid meet"/>',
text_path('PHILADELPHIA, PENNSYLVANIA  /  LIBERTY RACING',76,145,14,white,'info',570,.025),
f'<path d="M76 194h80v6H76Z" fill="{red}"/>',
text_path('WADE',66,319,83,white,maxwidth=560),
text_path('HOLLIS',62,429,81,white,maxwidth=590),
text_path('THE COLONEL',78,493,21,white,'info',520,.06),
text_path('EVERY LAP. A FLIGHT PLAN.',78,549,19,white,'info',580,.03),
text_path('FORMER AIR FORCE TEST PILOT',78,584,16,white,'info',550,.025),
f'<path d="M76 628h388v1H76Z" fill="{white}" opacity=".38"/>',
f'<path d="M76 680h82v88H76Z" fill="{red}"/>',
text_path('76',85,744,51,white,maxwidth=65),
text_path('UNITED STATES',184,711,18,white,'info',260,.055),
text_path('37 YEARS OLD',184,750,16,white,'info',245,.05),
text_path('CHECKLISTS. WAYPOINTS. NO DRAMA.',78,813,14,white,'info',560,.025),
f'<path d="M76 850h500v144H76Z" fill="#071126" fill-opacity=".92" stroke="{red}" stroke-width="2"/>',
text_path('THE MACHINE',96,880,12,white,'info',210,.06),
text_path('HENNESSEY',96,923,18,white,'info',360,.04),
text_path('BLACKBIRD',94,965,33,white,maxwidth=380),
text_path('6.2 L V8  /  825 HP  /  #76',96,985,12,white,'info',420,.035),
'<path d="M1600 42h246v148h-246Z" fill="#fff" fill-opacity=".97"/>',
text_path('TITLE PARTNER',1618,69,11,blue,'info',190,.07),
f'<path d="M1608 81h230v86h-230Z" fill="{red}"/>',
f'<image href="{coke}" x="1624" y="87" width="198" height="75" preserveAspectRatio="xMidYMid meet"/>',
text_path('ULTRACK  /  DRIVER INTRO',1586,1038,13,white,'info',270,.08),
f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{red}" stroke-width="3"/>',
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
    'titleSponsor': team['sponsor'],
    'font': team['font'],
    'manufacturer': 'Hennessey',
    'car': 'Blackbird',
    'style': 'Original fictional 37-year-old American man in GTA V loading-screen-inspired bold inked, cel-shaded illustration; no real likeness.',
    'illustration': 'illustration-v1.webp',
    'sourceIllustration': 'source/illustration-v1.png',
    'sourceSha256': source_hash,
    'generationCalls': 1,
    'composition': '1920x1080 static driver poster; team lettering is outlined and source artwork, team logo, and local sponsor mark are embedded for portability.',
    'outputs': {}
}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
node = ROOT / 'track-viewer/node_modules/.bin/node'
if not node.exists():
    node = 'node'
render = f'''const sharp=require(require.resolve('sharp',{{paths:[{json.dumps(str(ROOT / 'track-viewer'))} ]}})); Promise.all([sharp({json.dumps(str(SRC))}).webp({{quality:83,method:6}}).toFile({json.dumps(str(OUT / 'illustration-v1.webp'))}),sharp({json.dumps(str(OUT / 'poster-v1.svg'))},{{density:72}}).resize(1920,1080).png({{compressionLevel:8}}).toFile({json.dumps(str(OUT / 'poster-v1.png'))})]).then(()=>console.log('Rendered Wade poster and web illustration.')).catch(e=>{{console.error(e);process.exit(1)}});'''
subprocess.run([str(node), '-e', render], cwd=ROOT, check=True)
meta['outputs'] = {name: {'sha256': hashlib.sha256((OUT / name).read_bytes()).hexdigest()} for name in ('poster-v1.png', 'poster-v1.svg')}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print('sourceSha256:', source_hash)
for name in ('poster-v1.png', 'poster-v1.svg', 'illustration-v1.webp'):
    print(name, (OUT / name).stat().st_size, 'bytes')
