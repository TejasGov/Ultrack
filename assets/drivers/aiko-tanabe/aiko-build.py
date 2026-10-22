from pathlib import Path
import base64, hashlib, json
import subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'assets/drivers/aiko-tanabe'
SRC = OUT / 'source/illustration-v1.png'
img = Image.open(SRC).convert('RGB')
img.save(OUT / 'illustration-v1.webp', 'WEBP', quality=83, method=6)
teams = json.loads((ROOT/'assets/teams/teams.json').read_text(encoding='utf8'))['teams']
team = next(t for t in teams if t['id']=='kalt')
entry = next(c for c in team['cars'] if c['key']=='tesla1')
driver = entry['driver']
assert (driver['name'], driver['age'], driver['nation'], entry['number'], team['sponsor']) == ('Aiko Tanabe',28,'JPN',22,'Red Bull')
font_dir = ROOT/'track-viewer/public/assets/fonts'
font = TTFont(font_dir/team['font']['file'])
copyfont = TTFont(font_dir/'barlow-condensed-latin-700-normal.woff2')

def text_path(txt, x, baseline, height, color, which='team', maxwidth=1200, spacing=0):
    f = font if which=='team' else copyfont
    gs, cmap = f.getGlyphSet(), f.getBestCmap()
    advance, glyphs, bounds = 0, [], BoundsPen(f.getGlyphSet())
    for char in txt:
        name = cmap.get(ord(char), cmap.get(ord('-')))
        glyphs.append((name, advance))
        gs[name].draw(TransformPen(bounds,(1,0,0,1,advance,0)))
        advance += f['hmtx'][name][0] + spacing*f['head'].unitsPerEm
    x0,y0,x1,y1 = bounds.bounds
    scale = min(height/(y1-y0), maxwidth/(x1-x0))
    pen=SVGPathPen(gs)
    for name,offset in glyphs:
        gs[name].draw(TransformPen(pen,(scale,0,0,-scale,x+(offset-x0)*scale,baseline+y0*scale)))
    return f'<path fill="{color}" d="{pen.getCommands()}"/>'

def data(path, mime):
    return 'data:'+mime+';base64,'+base64.b64encode(Path(path).read_bytes()).decode()

art = data(SRC,'image/png')
logo = data(ROOT/'assets/teams/logos/kalt-lockup-onDark.svg','image/svg+xml')
redbull = data(ROOT/'assets/sponsors/logos/redbull.png','image/png')
silver, ink, cyan = team['colors']['primary'], team['colors']['secondary'], team['colors']['accent']
parts=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><title>Aiko Tanabe — Kalt number 22</title><desc>Original fictional driver introduction illustration with Aiko Tanabe and a silver, black and cyan second-generation Tesla Roadster in a rainy paddock.</desc><defs><linearGradient id="shade" x1="0" x2="1"><stop stop-color="#080b10" stop-opacity=".13"/><stop offset=".55" stop-color="#080b10" stop-opacity=".04"/><stop offset="1" stop-color="#080b10" stop-opacity=".0"/></linearGradient></defs>',
f'<image href="{art}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
'<path d="M0 0h790v1080H0Z" fill="url(#shade)"/>',
f'<image href="{logo}" x="88" y="54" width="310" height="82" preserveAspectRatio="xMinYMid meet"/>',
text_path('JAPANESE RAIN SPECIALIST  /  KALT RACING',94,174,14,silver,'copy',570,.035),
f'<path d="M94 231h78v5H94Z" fill="{cyan}"/>',
text_path('AIKO',88,351,64,silver,maxwidth=480),
text_path('TANABE',84,458,71,cyan,maxwidth=550),
text_path('QUIET PRECISION.',96,525,18,silver,'copy',405,.06),
text_path('EVERY CORNER MAPPED.',96,564,18,silver,'copy',480,.04),
text_path('RAIN IS HER ELEMENT.',96,603,18,silver,'copy',460,.05),
f'<path d="M94 653h450v1H94Z" fill="{silver}" opacity=".48"/>',
f'<path d="M94 704h78v86H94Z" fill="{cyan}"/>',
text_path('22',102,765,46,ink,maxwidth=63),
text_path('JPN  /  JAPAN',196,737,17,silver,'copy',270,.05),
text_path('28 YEARS OLD',196,777,16,silver,'copy',245,.055),
text_path('THE MACHINE',94,850,14,silver,'copy',255,.08),
f'<path d="M94 873h495v126H94Z" fill="{ink}" fill-opacity=".9" stroke="{cyan}" stroke-opacity=".62" stroke-width="1"/>',
text_path('TESLA ROADSTER',117,916,18,silver,'copy',410,.045),
text_path('SECOND GENERATION',117,961,24,cyan,maxwidth=415),
text_path('ALL-WHEEL DRIVE  /  ELECTRIC',117,984,11,silver,'copy',400,.02),
f'<path d="M1562 52h274v158h-274Z" fill="{ink}" fill-opacity=".96" stroke="{cyan}" stroke-opacity=".65" stroke-width="1"/>',
text_path('TITLE PARTNER',1583,82,11,silver,'copy',190,.07),
f'<image href="{redbull}" x="1590" y="101" width="150" height="78" preserveAspectRatio="xMidYMid meet"/>',
text_path('RED BULL',1741,151,15,silver,'copy',82,.035),
text_path('ULTRACK  /  DRIVER INTRO',1578,1036,12,silver,'copy',268,.09),
f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{cyan}" stroke-width="3" stroke-opacity=".7"/>','</svg>']
svg=''.join(parts)
(OUT/'poster-v1.svg').write_text(svg,encoding='utf8')
source_hash=hashlib.sha256(SRC.read_bytes()).hexdigest()
meta={'schemaVersion':1,'status':'ready','driver':driver,'team':team['id'],'raceNumber':entry['number'],'carKey':entry['key'],'titleSponsor':team['sponsor'],'font':team['font'],'sourceSha256':source_hash,'outputs':{}}
(OUT/'intro.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
subprocess.run(['node',str(OUT/'aiko-render.cjs')],cwd=ROOT,check=True)
meta['outputs']={name:{'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest()} for name in ('poster-v1.png','poster-v1.svg')}
(OUT/'intro.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print('Composed SVG and intro metadata.')
