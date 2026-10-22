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
team = next(t for t in teams if t['id'] == 'mojave')
entry = next(c for c in team['cars'] if c['key'] == 'bentley-gt')
driver = entry['driver']
cars = json.loads((ROOT / 'assets/cars/specs.json').read_text(encoding='utf8'))['cars']
car_model = cars[entry['key']]['model']
assert (driver['name'], driver['nation'], driver['age'], entry['number'], car_model, team['sponsor']) == ('Freya Lindqvist', 'SWE', 29, 8, 'Bentley Continental GT Speed (2021)', 'Shell')
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
    return f'data:{mime};base64,' + base64.b64encode(Path(path).read_bytes()).decode('ascii')

art = data(SRC, 'image/png')
team_logo = data(ROOT / 'assets/teams/logos/mojave-lockup-onTeam.svg', 'image/svg+xml')
shell = data(ROOT / 'assets/sponsors/logos/shell.png', 'image/png')
orange, navy, cream = team['colors']['primary'], team['colors']['secondary'], team['colors']['accent']
parts = [
'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><title>Freya Lindqvist — Mojave number 8</title><desc>Original inked cel-shaded driver introduction illustration featuring Freya Lindqvist and a Mojave Bentley Continental GT Speed.</desc>',
f'<image href="{art}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
'<defs><linearGradient id="leftFade" x1="0" x2="1"><stop stop-color="#f4f4f2" stop-opacity=".98"/><stop offset=".78" stop-color="#f4f4f2" stop-opacity=".94"/><stop offset="1" stop-color="#f4f4f2" stop-opacity=".84"/></linearGradient></defs>',
'<path d="M0 0H755L850 1080H0Z" fill="url(#leftFade)"/>',
f'<image href="{team_logo}" x="72" y="42" width="290" height="73" preserveAspectRatio="xMinYMid meet"/>',
text_path('BARSTOW, CALIFORNIA  /  MOJAVE RACING',76,151,15,navy,'info',585,.035),
f'<path d="M76 205h76v6H76Z" fill="{orange}"/>',
text_path('FREYA',66,319,78,navy,maxwidth=565),
text_path('LINDQVIST',60,435,75,orange,maxwidth=690),
text_path('RALLY CONVERT',78,493,21,navy,'info',550,.04),
f'<path d="M76 535h78v5H76Z" fill="{orange}"/>',
text_path('GRIP IS OVERRATED.',78,585,23,navy,'info',580,.035),
f'<path d="M76 635h370v1h-370Z" fill="{navy}" opacity=".35"/>',
f'<path d="M76 687h82v88H76Z" fill="{orange}"/>',
text_path('8',99,754,54,cream,maxwidth=40),
text_path('SWEDEN',183,716,19,navy,'info',260,.055),
text_path('29 YEARS OLD',183,754,17,navy,'info',265,.04),
text_path('RALLY-BRED CAR CONTROL',78,820,16,navy,'info',500,.025),
f'<path d="M76 850h510v144H76Z" fill="{navy}"/>',
text_path('THE MACHINE',96,880,12,cream,'info',210,.06),
text_path('BENTLEY',96,930,31,cream,maxwidth=285),
text_path('CONTINENTAL GT SPEED',96,962,16,cream,'info',440,.035),
text_path('2021  /  #8',96,983,12,cream,'info',220,.04),
 '<path d="M1680 42h210v148h-210Z" fill="#f4f4f2" fill-opacity=".97"/>',
text_path('TITLE PARTNER',1700,70,11,navy,'info',170,.07),
f'<image href="{shell}" x="1688" y="82" width="64" height="76" preserveAspectRatio="xMidYMid meet"/>',
text_path('SHELL',1760,139,24,navy,maxwidth=110),
text_path('ULTRACK  /  DRIVER INTRO',1586,1038,13,cream,'info',270,.08),
f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{orange}" stroke-width="3"/>',
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
    'manufacturer': 'Bentley',
    'car': 'Continental GT Speed',
    'style': 'Original fictional driver in GTA V loading-screen-inspired inked, cel-shaded illustration; no real driver likeness.',
    'illustration': 'illustration-v1.webp',
    'sourceIllustration': 'source/illustration-v1.png',
    'sourceSha256': source_hash,
    'generationCalls': 1,
    'composition': '1920x1080 static driver poster; team lettering is outlined and source artwork is embedded for portability.',
    'outputs': {}
}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
# Render and optimize web artwork from the untouched generated source.
node = ROOT / 'track-viewer/node_modules/.bin/node'
if not node.exists():
    node = 'node'
render = f'''const sharp=require(require.resolve('sharp',{{paths:[{json.dumps(str(ROOT / 'track-viewer'))} ]}})); Promise.all([sharp({json.dumps(str(SRC))}).webp({{quality:83,method:6}}).toFile({json.dumps(str(OUT / 'illustration-v1.webp'))}),sharp({json.dumps(str(OUT / 'poster-v1.svg'))},{{density:72}}).resize(1920,1080).png({{compressionLevel:8}}).toFile({json.dumps(str(OUT / 'poster-v1.png'))})]).then(()=>console.log('Rendered Freya poster and web illustration.')).catch(e=>{{console.error(e);process.exit(1)}});'''
subprocess.run([str(node), '-e', render], cwd=ROOT, check=True)
# Record exact output hashes required by the poster metadata contract.
meta['outputs'] = {name: {'sha256': hashlib.sha256((OUT / name).read_bytes()).hexdigest()} for name in ('poster-v1.png', 'poster-v1.svg')}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print('sourceSha256:', source_hash)
print('poster/png:', (OUT / 'poster-v1.png').stat().st_size, 'bytes')
print('illustration/webp:', (OUT / 'illustration-v1.webp').stat().st_size, 'bytes')
