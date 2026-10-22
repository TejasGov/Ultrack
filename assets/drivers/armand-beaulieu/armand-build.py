from pathlib import Path
import base64, hashlib, json
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'assets/drivers/armand-beaulieu'
SRC = OUT / 'source/illustration-v1.png'
img = Image.open(SRC).convert('RGB')
img.save(OUT / 'illustration-v1.webp', 'WEBP', quality=83, method=6)

teams = json.loads((ROOT/'assets/teams/teams.json').read_text(encoding='utf8'))['teams']
team = next(t for t in teams if t['id'] == 'aurum')
entry = next(c for c in team['cars'] if c['key'] == 'destrier')
driver = entry['driver']
assert (driver['name'], driver['age'], entry['number'], team['sponsor']) == ('Armand Beaulieu', 36, 16, 'Rolex')

font_dir = ROOT/'track-viewer/public/assets/fonts'
font = TTFont(font_dir/team['font']['file'])
copyfont = TTFont(font_dir/'barlow-condensed-latin-700-normal.woff2')

def text_path(txt, x, baseline, height, color, which='team', maxwidth=1200, spacing=0):
    f = font if which == 'team' else copyfont
    gs, cmap = f.getGlyphSet(), f.getBestCmap()
    advance, glyphs, bounds = 0, [], BoundsPen(f.getGlyphSet())
    for char in txt:
        name = cmap.get(ord(char), cmap.get(ord('-')))
        glyphs.append((name, advance))
        gs[name].draw(TransformPen(bounds, (1, 0, 0, 1, advance, 0)))
        advance += f['hmtx'][name][0] + spacing*f['head'].unitsPerEm
    x0, y0, x1, y1 = bounds.bounds
    scale = min(height/(y1-y0), maxwidth/(x1-x0))
    pen = SVGPathPen(gs)
    for name, offset in glyphs:
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x+(offset-x0)*scale, baseline+y0*scale)))
    return f'<path fill="{color}" d="{pen.getCommands()}"/>'

def data(path, mime):
    return 'data:'+mime+';base64,'+base64.b64encode(Path(path).read_bytes()).decode()

art = data(SRC, 'image/png')
logo = data(ROOT/'assets/teams/logos/aurum-lockup-onDark.svg', 'image/svg+xml')
rolex = data(ROOT/'assets/sponsors/logos/rolex.png', 'image/png')
navy, gold, ivory = team['colors']['primary'], team['colors']['secondary'], team['colors']['accent']
ink = '#09101f'
parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1920 1080" width="1920" height="1080">',
    '<title>Armand Beaulieu — Aurum number 16</title>',
    '<desc>Original fictional French gentleman racer with the Bugatti Destrier, illustrated in an inked cel-shaded style.</desc>',
    '<defs><linearGradient id="shade" x1="0" x2="1"><stop stop-color="#08101f" stop-opacity=".96"/><stop offset=".47" stop-color="#08101f" stop-opacity=".68"/><stop offset=".75" stop-color="#08101f" stop-opacity=".05"/><stop offset="1" stop-color="#08101f" stop-opacity="0"/></linearGradient></defs>',
    f'<image xlink:href="{art}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
    '<path d="M0 0h790l70 1080H0Z" fill="url(#shade)"/>',
    f'<image xlink:href="{logo}" x="86" y="48" width="326" height="82"/>',
    text_path('MONACO  /  AURUM RACING', 94, 169, 15, ivory, 'copy', 530, .04),
    f'<path d="M94 220h76v5H94Z" fill="{gold}"/>',
    text_path('ARMAND', 88, 334, 63, ivory, maxwidth=540),
    text_path('BEAULIEU', 82, 462, 76, gold, maxwidth=590),
    text_path('THE GENTLEMAN RACER', 96, 530, 19, ivory, 'copy', 520, .04),
    f'<path d="M94 568h76v4H94Z" fill="{gold}"/>',
    text_path('ENDURANCE-BRED.', 96, 620, 20, ivory, 'copy', 480, .035),
    text_path('NEVER HURRIES.', 96, 656, 20, ivory, 'copy', 455, .035),
    f'<path d="M94 690h380v1H94Z" fill="{ivory}" opacity=".45"/>',
    f'<path d="M94 734h78v88H94Z" fill="{gold}"/>',
    text_path('16', 104, 800, 51, navy, maxwidth=60),
    text_path('FRANCE', 196, 765, 18, ivory, 'copy', 245, .07),
    text_path('36 YEARS OLD', 196, 803, 16, ivory, 'copy', 245, .06),
    text_path('THREE LE MANS CLASS PODIUMS', 94, 870, 15, ivory, 'copy', 420, .035),
    f'<path d="M94 896h430v112H94Z" fill="{ink}" fill-opacity=".91" stroke="{gold}" stroke-width="1.5"/>',
    text_path('BUGATTI', 115, 939, 16, ivory, 'copy', 220, .07),
    text_path('DESTRIER', 112, 981, 34, gold, maxwidth=335),
    text_path('8.0 L W16  /  QUAD-TURBO', 116, 1037, 13, ivory, 'copy', 365, .015),
    f'<path d="M1610 46h238v152h-238Z" fill="{ivory}"/>',
    text_path('TITLE PARTNER', 1634, 74, 11, navy, 'copy', 184, .07),
    f'<image xlink:href="{rolex}" x="1633" y="91" width="193" height="64" preserveAspectRatio="xMidYMid meet"/>',
    text_path('ULTRACK  /  DRIVER INTRO', 1587, 1038, 12, ivory, 'copy', 260, .1),
    f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{gold}" stroke-width="3"/>',
    '</svg>'
]
svg = ''.join(parts)
(OUT/'poster-v1.svg').write_text(svg, encoding='utf8')
source_hash = hashlib.sha256(SRC.read_bytes()).hexdigest()
meta = {
    'schemaVersion': 1,
    'driver': driver,
    'team': team['id'],
    'raceNumber': entry['number'],
    'carKey': entry['key'],
    'manufacturer': 'Bugatti',
    'car': 'Destrier',
    'titleSponsor': team['sponsor'],
    'font': team['font'],
    'style': 'Original fictional driver in GTA V loading-screen-inspired inked, cel-shaded illustration; no real driver likeness.',
    'illustration': 'illustration-v1.webp',
    'sourceIllustration': 'source/illustration-v1.png',
    'sourceSha256': source_hash,
    'outputs': {},
    'composition': '1920x1080 static driver poster; Aurum display lettering is outlined and the artwork and marks are embedded for portability.'
}
poster_png = OUT/'poster-v1.png'
if poster_png.exists():
    Image.open(poster_png).convert('RGB').save(OUT/'poster-v1.webp', 'WEBP', quality=88, method=6)
    meta['outputs'] = {
        filename: {'sha256': hashlib.sha256((OUT/filename).read_bytes()).hexdigest()}
        for filename in ('poster-v1.png', 'poster-v1.svg', 'poster-v1.webp')
    }
(OUT/'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False)+'\n', encoding='utf8')
print('Composed self-contained SVG and intro metadata.')
