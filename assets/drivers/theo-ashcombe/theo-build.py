from pathlib import Path
import base64, hashlib, json
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'assets/drivers/theo-ashcombe'
SRC = OUT / 'source/illustration-v1.png'
img = Image.open(SRC).convert('RGB')
img.save(OUT / 'illustration-v1.webp', 'WEBP', quality=83, method=6)
teams = json.loads((ROOT/'assets/teams/teams.json').read_text(encoding='utf8'))['teams']
team = next(t for t in teams if t['id']=='corvid')
entry = next(c for c in team['cars'] if c['key']=='aston-martin-valk')
driver = entry['driver']
assert (driver['name'], driver['age'], entry['number'], team['sponsor']) == ('Theo Ashcombe',24,4,'HSBC')
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
logo = data(ROOT/'assets/teams/logos/corvid-lockup-onDark.svg','image/svg+xml')
hsbc = data(ROOT/'assets/sponsors/logos/hsbc.png','image/png')
forest, cream, brass, ink = team['colors']['primary'], team['colors']['secondary'], team['colors']['accent'], '#101815'
parts=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><title>Theo Ashcombe — Corvid number 4</title><desc>Original inked cel-shaded driver introduction illustration with Theo Ashcombe and a British racing green Aston Martin Valkyrie.</desc><defs><linearGradient id="shade" x1="0" x2="1"><stop stop-color="#06120e" stop-opacity=".94"/><stop offset=".5" stop-color="#06120e" stop-opacity=".48"/><stop offset="1" stop-color="#06120e" stop-opacity=".04"/></linearGradient></defs>',
f'<image href="{art}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
'<path d="M0 0h760l80 1080H0Z" fill="url(#shade)"/>',
f'<image href="{logo}" x="86" y="47" width="326" height="82"/>',
text_path('SILVERSTONE, ENGLAND  /  CORVID RACING',94,169,14,cream,'copy',520,.035),
f'<path d="M94 220h72v5H94Z" fill="{brass}"/>',
text_path('THEO',88,332,68,cream,maxwidth=510),
text_path('ASHCOMBE',80,463,78,brass,maxwidth=570),
text_path('OLD MONEY. SHARP ELBOWS.',96,532,19,cream,'copy',535,.06),
text_path('IMPECCABLE MANNERS.',96,590,20,cream,'copy',510,.025),
text_path('NONE ON TRACK.',96,625,20,cream,'copy',430,.035),
f'<path d="M94 672h370v1h-370Z" fill="{cream}" opacity=".45"/>',
f'<path d="M94 727h74v86H94Z" fill="{brass}"/>',
text_path('4',116,790,51,forest,maxwidth=38),
text_path('GREAT BRITAIN',194,758,18,cream,'copy',245,.06),
text_path('24 YEARS OLD',194,796,16,cream,'copy',225,.07),
text_path('THIRD-GENERATION RACER',94,861,15,cream,'copy',390,.06),
f'<path d="M94 895h405v104H94Z" fill="{ink}" fill-opacity=".9" stroke="{brass}" stroke-width="1"/>',
text_path('ASTON MARTIN',116,936,15,cream,'copy',330,.08),
text_path('VALKYRIE',112,980,34,brass,maxwidth=330),
text_path('NATURALLY ASPIRATED V12  /  HYBRID',116,1033,13,cream,'copy',350,.015),
f'<path d="M1610 46h238v152h-238Z" fill="{cream}"/>',
text_path('TITLE PARTNER',1634,74,11,forest,'copy',184,.07),
text_path('HSBC',1636,150,26,forest,'copy',105,.045),
f'<image href="{hsbc}" x="1752" y="88" width="80" height="62" preserveAspectRatio="xMidYMid meet"/>',
text_path('ULTRACK  /  DRIVER INTRO',1592,1038,12,cream,'copy',255,.1),
f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{brass}" stroke-width="3"/>','</svg>']
svg=''.join(parts)
(OUT/'poster-v1.svg').write_text(svg,encoding='utf8')
source_hash=hashlib.sha256(SRC.read_bytes()).hexdigest()
meta={'schemaVersion':1,'status':'awaiting-user-style-approval','driver':driver,'team':team['id'],'raceNumber':entry['number'],'carKey':entry['key'],'manufacturer':'Aston Martin','car':'Valkyrie','titleSponsor':team['sponsor'],'font':team['font'],'style':'Original fictional driver in GTA V loading-screen-inspired inked, cel-shaded illustration; no real driver likeness.','illustration':'illustration-v1.webp','sourceIllustration':'source/illustration-v1.png','sourceSha256':source_hash,'outputs':{},'composition':'1920x1080 static driver poster; Cinzel team lettering is outlined and the artwork is embedded for portability.'}
(OUT/'intro.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print('Composed SVG and intro metadata.')
