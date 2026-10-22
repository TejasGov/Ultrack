from pathlib import Path
import base64, hashlib, json, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'assets/drivers/remy-valois'
SRC = OUT / 'source/illustration-v1.png'
TEAMS = json.loads((ROOT / 'assets/teams/teams.json').read_text(encoding='utf8'))['teams']
team = next(t for t in TEAMS if t['id'] == 'aurum')
entry = next(c for c in team['cars'] if c['key'] == 'buggati')
driver = entry['driver']
assert (driver['name'], driver['age'], driver['nation'], driver['role'], entry['number'], team['sponsor']) == ('Remy Valois', 31, 'MON', 'reigning champion', 1, 'Rolex')
font = TTFont(ROOT / 'track-viewer/public/assets/fonts' / team['font']['file'])
copyfont = TTFont(ROOT / 'track-viewer/public/assets/fonts/barlow-condensed-latin-700-normal.woff2')

def text_path(txt, x, baseline, height, color, which='team', maxwidth=1000, spacing=0):
    f = font if which == 'team' else copyfont
    gs, cmap = f.getGlyphSet(), f.getBestCmap()
    advance, glyphs, bounds = 0, [], BoundsPen(f.getGlyphSet())
    for char in txt:
        name = cmap.get(ord(char), cmap.get(ord('-')))
        glyphs.append((name, advance))
        gs[name].draw(TransformPen(bounds, (1, 0, 0, 1, advance, 0)))
        advance += f['hmtx'][name][0] + spacing * f['head'].unitsPerEm
    x0, y0, x1, y1 = bounds.bounds
    scale = min(height / (y1 - y0), maxwidth / (x1 - x0))
    pen = SVGPathPen(gs)
    for name, offset in glyphs:
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x + (offset - x0) * scale, baseline + y0 * scale)))
    return f'<path fill="{color}" d="{pen.getCommands()}"/>'

def data(path, mime):
    return 'data:' + mime + ';base64,' + base64.b64encode(Path(path).read_bytes()).decode()

art = data(SRC, 'image/png')
logo = data(ROOT / 'assets/teams/logos/aurum-lockup-onDark.svg', 'image/svg+xml')
rolex = data(ROOT / 'assets/sponsors/logos/rolex.png', 'image/png')
navy, gold, ivory = team['colors']['primary'], team['colors']['secondary'], team['colors']['accent']
parts = [
 f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><title>Remy Valois — Aurum number 1</title><desc>Original inked cel-shaded fictional Monaco champion with a midnight blue Bugatti Divo at the marina.</desc><defs><linearGradient id="shade" x1="0" x2="1"><stop stop-color="{navy}" stop-opacity=".97"/><stop offset=".46" stop-color="{navy}" stop-opacity=".79"/><stop offset=".82" stop-color="{navy}" stop-opacity=".16"/><stop offset="1" stop-color="{navy}" stop-opacity="0"/></linearGradient></defs>',
 f'<image href="{art}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
 '<path d="M0 0h880v1080H0Z" fill="url(#shade)"/>',
 f'<image href="{logo}" x="84" y="48" width="330" height="82"/>',
 text_path('MONACO  /  AURUM RACING', 92, 168, 17, ivory, 'copy', 440, .045),
 f'<path d="M94 214h80v5H94Z" fill="{gold}"/>',
 text_path('REMY', 82, 323, 83, ivory, maxwidth=570),
 text_path('VALOIS', 77, 444, 96, gold, maxwidth=620),
 text_path('THE REIGNING CHAMPION', 95, 508, 21, ivory, 'copy', 495, .06),
 f'<path d="M94 555h440v1H94Z" fill="{ivory}" opacity=".48"/>',
 text_path('SMOOTH. SMILING.', 96, 614, 23, ivory, 'copy', 470, .04),
 text_path('VERY HARD TO PASS.', 96, 654, 23, ivory, 'copy', 470, .04),
 f'<path d="M94 704h78v88H94Z" fill="{gold}"/>',
 text_path('1', 121, 771, 58, navy, maxwidth=30),
 text_path('MONACO', 199, 742, 19, ivory, 'copy', 250, .08),
 text_path('31 YEARS OLD', 199, 783, 17, ivory, 'copy', 260, .07),
 f'<path d="M94 831h445v150H94Z" fill="{navy}" fill-opacity=".96" stroke="{gold}" stroke-width="2"/>',
 text_path('THE MACHINE', 115, 867, 14, gold, 'copy', 220, .1),
 text_path('BUGATTI DIVO', 113, 926, 39, ivory, maxwidth=390),
 text_path('W16 QUAD-TURBO  /  AURUM', 115, 959, 13, ivory, 'copy', 390, .035),
 f'<path d="M562 42h268v151h-268Z" fill="{ivory}" stroke="{gold}" stroke-width="3"/>',
 text_path('TITLE PARTNER', 584, 72, 13, navy, 'copy', 220, .09),
 f'<image href="{rolex}" x="586" y="93" width="220" height="63" preserveAspectRatio="xMidYMid meet"/>',
 text_path('ULTRACK  /  DRIVER INTRO', 1581, 1034, 13, ivory, 'copy', 260, .09),
 f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{gold}" stroke-width="3"/>',
 '</svg>'
]
(OUT / 'poster-v1.svg').write_text(''.join(parts), encoding='utf8')
source_hash = hashlib.sha256(SRC.read_bytes()).hexdigest()
meta = {
 'schemaVersion': 1,
 'status': 'awaiting-user-style-approval',
 'driver': driver,
 'team': team['id'],
 'raceNumber': entry['number'],
 'carKey': entry['key'],
 'manufacturer': 'Bugatti',
 'car': 'Divo',
 'titleSponsor': team['sponsor'],
 'font': team['font'],
 'style': 'Original fictional driver in GTA V loading-screen-inspired inked, cel-shaded illustration. No real driver likeness.',
 'illustration': 'illustration-v1.webp',
 'sourceIllustration': 'source/illustration-v1.png',
 'sourceSha256': source_hash,
 'generationCalls': 1,
 'outputs': {}
}
(OUT / 'intro.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
# Preserve the untouched generator output; make the convenience illustration explicitly WebP.
Image.open(SRC).convert('RGB').save(OUT / 'illustration-v1.webp', 'WEBP', quality=83, method=6)
subprocess.run(['node', str(OUT / 'remy-render.cjs')], cwd=ROOT, check=True)

