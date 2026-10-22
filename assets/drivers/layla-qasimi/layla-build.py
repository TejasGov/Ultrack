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
    raise SystemExit(f'Missing centrally generated source illustration: {SRC}')
teams = json.loads((ROOT / 'assets/teams/teams.json').read_text(encoding='utf8'))['teams']
team = next(t for t in teams if t['id'] == 'sarab')
entry = next(c for c in team['cars'] if c['key'] == 'porsche1')
driver = entry['driver']
cars = json.loads((ROOT / 'assets/cars/specs.json').read_text(encoding='utf8'))['cars']
car_model = cars[entry['key']]['model']
assert (driver['name'], driver['nation'], driver['age'], entry['number'], car_model, team['sponsor']) == ('Layla Qasimi', 'OMN', 25, 33, 'Porsche 911 Turbo S (992)', 'Emirates')
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
team_logo = data(ROOT / 'assets/teams/logos/sarab-lockup-onLight.svg', 'image/svg+xml')
emirates = data(ROOT / 'assets/sponsors/logos/emirates.png', 'image/png')
pearl, teal, gold = team['colors']['primary'], team['colors']['secondary'], team['colors']['accent']
ink = '#152321'
parts = [
'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><title>Layla Qasimi — Sarab number 33</title><desc>Original inked cel-shaded driver introduction illustration featuring Layla Qasimi and a Sarab Porsche 911 Turbo S (992).</desc>',
f'<image href="{art}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
'<defs><linearGradient id="leftFade" x1="0" x2="1"><stop stop-color="#f1efe8" stop-opacity=".99"/><stop offset=".78" stop-color="#f1efe8" stop-opacity=".97"/><stop offset="1" stop-color="#f1efe8" stop-opacity=".86"/></linearGradient></defs>',
'<path d="M0 0H760L840 1080H0Z" fill="url(#leftFade)"/>',
f'<image href="{team_logo}" x="72" y="38" width="300" height="75" preserveAspectRatio="xMinYMid meet"/>',
text_path('CORNICHE MARINA  /  SARAB RACING',76,150,15,ink,'info',610,.025),
f'<path d="M76 198h78v6H76Z" fill="{gold}"/>',
text_path('LAYLA',66,306,82,ink,maxwidth=560),
text_path('QASIMI',62,413,86,teal,maxwidth=615),
text_path('THE OVERTAKER',78,468,22,ink,'info',500,.045),
f'<path d="M76 507h78v5H76Z" fill="{gold}"/>',
text_path('FEARLESS. ALWAYS FINDING A WAY THROUGH.',78,554,19,ink,'info',570,.015),
text_path('THE GRID’S BEST OVERTAKER.',78,594,19,ink,'info',540,.035),
f'<path d="M76 635h510v1h-510Z" fill="{teal}" opacity=".52"/>',
f'<path d="M76 674h92v91H76Z" fill="{teal}"/>',
text_path('33',86,744,55,pearl,maxwidth=75),
text_path('OMAN',190,710,20,ink,'info',250,.08),
text_path('25 YEARS OLD',190,753,17,ink,'info',260,.05),
text_path('SELF-TAUGHT ON DESERT ROADS',78,810,15,ink,'info',470,.035),
f'<path d="M76 847h510v148H76Z" fill="{ink}"/>',
text_path('THE MACHINE',97,877,12,pearl,'info',205,.07),
text_path('PORSCHE',96,923,30,pearl,maxwidth=330),
text_path('911 TURBO S (992)',96,956,18,pearl,'info',410,.04),
text_path('3.8 L TWIN-TURBO FLAT-SIX  /  AWD',96,982,12,pearl,'info',430,.02),
# White Emirates mark on opaque Sarab teal for reliable contrast.
f'<path d="M1650 42h230v148h-230Z" fill="{teal}"/>',
text_path('TITLE PARTNER',1670,70,11,pearl,'info',175,.07),
f'<image href="{emirates}" x="1670" y="84" width="90" height="82" preserveAspectRatio="xMidYMid meet"/>',
text_path('EMIRATES',1765,137,17,pearl,'info',100,.02),
text_path('ULTRACK  /  DRIVER INTRO',1575,1038,13,pearl,'info',300,.08),
f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{gold}" stroke-width="3"/>',
'</svg>'
]
svg = ''.join(parts)
(OUT / 'poster-v1.svg').write_text(svg, encoding='utf8')
source_hash = hashlib.sha256(SRC.read_bytes()).hexdigest()
direction = '''# Layla Qasimi — art direction

Generation count: 1 built-in image_gen call (made centrally by the root agent).
generationCalls: 1.

Use case: stylized-concept. Asset type: wide 16:9 background illustration for an original racing-game driver introduction poster; all type and logos are composited separately in deterministic code. Exact generation prompt:

''' + (OUT / 'source/prompt-used.txt' if (OUT / 'source/prompt-used.txt').exists() else OUT / 'source/prompt.txt').read_text(encoding='utf8').strip() + '''

Approved canonical data: Layla Qasimi / QAS / OMN / age 25 / Sarab #33 / Porsche 911 Turbo S (992) / sponsor Emirates. Sarab font: Lalezar (`lalezar-latin-400-normal.woff2`); palette pearl white #f1efe8, teal #0f8f8a, sand gold #c9a45c. No flags anywhere. The title-sponsor mark is the local white Emirates logo on a Sarab teal badge for contrast.
'''
(OUT / 'source/ART-DIRECTION.md').write_text(direction, encoding='utf8')
meta = {
    'schemaVersion': 1,
    'status': 'awaiting-user-style-approval',
    'driver': driver,
    'team': team['id'],
    'raceNumber': entry['number'],
    'carKey': entry['key'],
    'titleSponsor': team['sponsor'],
    'font': team['font'],
    'manufacturer': 'Porsche',
    'car': '911 Turbo S (992)',
    'style': 'Original fictional driver in GTA V loading-screen-inspired inked, cel-shaded illustration; no real driver likeness.',
    'illustration': 'illustration-v1.webp',
    'sourceIllustration': 'source/illustration-v1.png',
    'sourceSha256': source_hash,
    'generationCalls': 1,
    'composition': '1920x1080 static driver poster; team lettering is outlined and source artwork is embedded for portability.',
    'outputs': {}
}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
# Use the repository's pinned sharp install for lossless PNG rendering and WebP delivery.
node = ROOT / 'track-viewer/node_modules/.bin/node'
if not node.exists():
    node = 'node'
render = f'''const sharp=require(require.resolve('sharp',{{paths:[{json.dumps(str(ROOT / 'track-viewer'))}]}})); Promise.all([sharp({json.dumps(str(SRC))}).webp({{quality:83,method:6}}).toFile({json.dumps(str(OUT / 'illustration-v1.webp'))}),sharp({json.dumps(str(OUT / 'poster-v1.svg'))},{{density:72}}).resize(1920,1080).png({{compressionLevel:8}}).toFile({json.dumps(str(OUT / 'poster-v1.png'))})]).then(()=>console.log('Rendered Layla poster and WebP artwork.')).catch(e=>{{console.error(e);process.exit(1)}});'''
subprocess.run([str(node), '-e', render], cwd=ROOT, check=True)
meta['outputs'] = {name: {'sha256': hashlib.sha256((OUT / name).read_bytes()).hexdigest()} for name in ('poster-v1.png', 'poster-v1.svg')}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print('sourceSha256:', source_hash)
print('poster/png:', (OUT / 'poster-v1.png').stat().st_size, 'bytes')
print('illustration/webp:', (OUT / 'illustration-v1.webp').stat().st_size, 'bytes')
