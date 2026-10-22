from pathlib import Path
import base64, hashlib, json
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'assets/drivers/jonas-reiter'
SRC = OUT / 'source/illustration-v1.png'
img = Image.open(SRC).convert('RGB')
img.save(OUT / 'illustration-v1.webp', 'WEBP', quality=83, method=6)
teams = json.loads((ROOT/'assets/teams/teams.json').read_text(encoding='utf8'))['teams']
cars = json.loads((ROOT/'assets/cars/specs.json').read_text(encoding='utf8'))
team = next(t for t in teams if t['id']=='kalt')
entry = next(c for c in team['cars'] if c['key']=='nuvolari')
driver = entry['driver']
assert (driver['name'], driver['nation'], driver['age'], entry['number'], team['sponsor']) == ('Jonas Reiter','GER',33,11,'Red Bull')
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
sponsor = data(ROOT/'assets/sponsors/logos/redbull.png','image/png')
silver, charcoal, cyan = team['colors']['primary'], team['colors']['secondary'], team['colors']['accent']
parts=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080"><title>Jonas Reiter — Kalt number 11</title><desc>Original inked cel-shaded driver introduction illustration with Jonas Reiter and a silver Audi e-tron GT concept (2018).</desc><defs><linearGradient id="shade" x1="0" x2="1"><stop stop-color="#111317" stop-opacity=".98"/><stop offset=".68" stop-color="#111317" stop-opacity=".75"/><stop offset="1" stop-color="#111317" stop-opacity=".06"/></linearGradient><linearGradient id="glow" x1="0" x2="1"><stop stop-color="#36d6e7" stop-opacity=".7"/><stop offset="1" stop-color="#36d6e7" stop-opacity="0"/></linearGradient></defs>',
f'<image href="{art}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
'<path d="M0 0h750l25 1080H0Z" fill="url(#shade)"/>',
f'<path d="M0 0h7v1080H0Z" fill="{cyan}"/>',
f'<image href="{logo}" x="78" y="54" width="300" height="84"/>',
text_path('STUTTGART, GERMANY  /  KALT RACING',88,169,14,silver,'copy',560,.045),
f'<path d="M88 216h84v5H88Z" fill="{cyan}"/>',
text_path('JONAS',82,328,67,silver,maxwidth=550),
text_path('REITER',75,435,78,cyan,maxwidth=580),
text_path('ENGINEER FIRST. DRIVER ALWAYS.',90,496,19,silver,'copy',540,.04),
text_path('BUILT THE AERO. READS THE DATA.',90,536,19,silver,'copy',540,.035),
f'<path d="M88 585h488v1h-488Z" fill="{silver}" opacity=".42"/>',
f'<path d="M88 638h82v92H88Z" fill="{cyan}"/>',
text_path('11',99,705,49,charcoal,maxwidth=65),
text_path('GER  /  33 YEARS OLD',198,673,19,silver,'copy',360,.055),
text_path('ENGINEER TURNED DRIVER',198,713,16,silver,'copy',365,.04),
text_path('FORMER KALT AERODYNAMICIST',90,782,15,silver,'copy',470,.045),
f'<path d="M88 824h492v132H88Z" fill="#111317" fill-opacity=".93" stroke="{cyan}" stroke-width="1.5"/>',
text_path('THE MACHINE',111,856,12,cyan,'copy',210,.06),
text_path('AUDI E-TRON GT CONCEPT',109,906,25,silver,maxwidth=440),
text_path('(2018)  /  DUAL-MOTOR ELECTRIC',111,936,13,silver,'copy',430,.035),
'<path d="M1608 46h230v191h-230Z" fill="#111317" stroke="#36d6e7" stroke-width="1.5"/>',
text_path('TITLE PARTNER',1632,74,11,cyan,'copy',180,.075),
f'<image href="{sponsor}" x="1631" y="84" width="183" height="99" preserveAspectRatio="xMidYMid meet"/>',
text_path('RED BULL',1661,222,18,silver,'copy',135,.07),
text_path('ULTRACK  /  DRIVER INTRO',1583,1033,12,silver,'copy',270,.09),
f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{cyan}" stroke-width="2" opacity=".64"/>','</svg>']
svg=''.join(parts)
(OUT/'poster-v1.svg').write_text(svg,encoding='utf8')
source_hash=hashlib.sha256(SRC.read_bytes()).hexdigest()
meta={'schemaVersion':1,'status':'awaiting-user-style-approval','driver':driver,'team':team['id'],'raceNumber':entry['number'],'carKey':entry['key'],'manufacturer':cars['cars'][entry['key']]['model'].split(' ',1)[0],'car':cars['cars'][entry['key']]['model'],'titleSponsor':team['sponsor'],'font':team['font'],'style':'Original fictional driver in GTA V loading-screen-inspired inked, cel-shaded illustration; no real driver likeness.','illustration':'illustration-v1.webp','sourceIllustration':'source/illustration-v1.png','sourceSha256':source_hash,'outputs':{},'composition':'1920x1080 static driver poster; Kalt Michroma lettering is outlined, sponsor and logo are embedded, and the source illustration is embedded for portability.'}
(OUT/'intro.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
print('Composed SVG and intro metadata.')


