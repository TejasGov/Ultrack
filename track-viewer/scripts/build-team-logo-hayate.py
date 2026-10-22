"""Hayate's identity (kazaguruma mon crest + kanji/Latin/katakana wordmark + kanji number roundels), same file layout as
scripts/build-team-logos.py (which is left alone): outlined SVG masters in assets/teams/logos, entry added to manifest.json.
Then:  node track-viewer/scripts/prepare-team-logos.mjs   (PNG/WebP, runtime.json, review sheet, gallery)
Run from the project root.  Needs fonttools + brotli.  The lettering is outlined from the Dela Gothic One subset (SIL OFL)."""
from pathlib import Path
import hashlib, json, html
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/teams/logos'
T = next(t for t in json.loads((ROOT / 'assets/teams/teams.json').read_text(encoding='utf-8'))['teams'] if t['id'] == 'hayate')
F = TTFont(ROOT / 'track-viewer/public/assets/fonts' / T['font']['file'])
GS, CMAP = F.getGlyphSet(), F.getBestCmap()
KANJI, LATIN, KANA = '疾風', 'HAYATE', 'ハヤテ'
CAR_KANJI = {c['number']: n for c, n in zip(T['cars'], ['二十三', '三十七'])}

# mon crest: a kazaguruma (wind pinwheel) in a ring
SHAPE = ('<circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="5"/>'
         + ''.join(f'<path transform="rotate({a} 50 50)" d="M53 46 L50 14 C72 12 84 30 80 49 Z"/>' for a in (0, 90, 180, 270))
         + '<circle cx="50" cy="50" r="4"/>')
LABEL = 'Kazaguruma (wind pinwheel) mon'


def run(text, size, tracking=0.0):
    """Glyph outlines for text at em size (px): (list of (name, x_units), advance_units, bounds)."""
    x, letters, b = 0, [], BoundsPen(GS)
    for ch in text:
        n = CMAP[ord(ch)]; letters.append((n, x)); GS[n].draw(TransformPen(b, (1, 0, 0, 1, x, 0))); x += F['hmtx'][n][0] + tracking * 1000
    return letters, b.bounds


def place(letters, s, tx, ty):
    pen = SVGPathPen(GS)
    for n, x in letters:
        GS[n].draw(TransformPen(pen, (s, 0, 0, -s, tx + x * s, ty)))
    return pen.getCommands()


def block(text, s, left, cy, tracking=0.0, width=None):
    """Outline text with scale s, left edge at `left`, ink centred on y=cy; with width, tracking is solved to fill it."""
    letters, bb = run(text, s, tracking)
    if width:
        ink0 = bb[2] - bb[0]; extra = (width / s - ink0) / max(1, len(text) - 1) / 1000
        letters, bb = run(text, s, tracking + extra)
    x0, y0, x1, y1 = bb
    return place(letters, s, left - x0 * s, cy + (y0 + y1) * s / 2), (x1 - x0) * s, (y1 - y0) * s


def wordmark():
    k, kw, _ = block(KANJI, 0.118, 260, 128, 0.04)
    lat, lw, lh = block(LATIN, 0.062, 260 + kw + 30, 128 - 27)
    kana, _, _ = block(KANA, 0.040, 260 + kw + 30, 128 + 27 + 6, 0.55)
    return k + lat + kana


def roundel(digits, r):
    """Kanji number roundel, 256 x 256: a white disc, a vermilion ring, the numeral stacked top to bottom in violet."""
    c = T['colors']; paths = ''
    for i, ch in enumerate(digits):
        s = 0.074; letters, bb = run(ch, s)
        cx = 128; cy = 128 + (i - (len(digits) - 1) / 2) * 62
        paths += place(letters, s, cx - (bb[0] + bb[2]) * s / 2, cy + (bb[1] + bb[3]) * s / 2)
    return (f'<circle cx="128" cy="128" r="120" fill="{c["secondary"]}"/><circle cx="128" cy="128" r="108" fill="none" stroke="{c["accent"]}" stroke-width="9"/>'
            f'<path fill="{c["primary"]}" d="{paths}"/>')


def katakana_plate():
    """ソニー plate, 256 x 256 canvas: a white rounded plate with the sponsor's katakana in violet."""
    c = T['colors']; p, w, h = block('ソニー', 0.062, 128, 128, 0.1)
    p, w, h = block('ソニー', 0.062, 128 - w / 2, 128, 0.1)
    return f'<rect x="12" y="76" width="232" height="104" rx="14" fill="{c["secondary"]}"/><path fill="{c["primary"]}" d="{p}"/>'


def lum(color):
    return sum(int(color[i:i + 2], 16) / 255 * w for i, w in zip((1, 3, 5), (.2126, .7152, .0722)))


c = T['colors']
# (ink, accent) per variant: white lettering and vermilion crest on the team's violet; reversed on light grounds
palettes = {'onTeam': (c['secondary'], c['accent']), 'onDark': ('#f5f1e8', c['accent']), 'onLight': (c['primary'], c['accent'])}
word = wordmark()
info = {'name': T['name'], 'emblem': LABEL, 'font': T['font'], 'colors': c, 'variants': {}}
for variant, (ink, accent) in palettes.items():
    files = {}
    kinds = [('lockup', '0 0 1024 256', f'<g transform="translate(28 32) scale(1.92)" color="{accent}" fill="currentColor">{SHAPE}</g><path fill="{ink}" d="{word}"/>'),
             ('icon', '0 0 256 256', f'<g transform="translate(28 28) scale(2)" color="{accent}" fill="currentColor">{SHAPE}</g>')]
    for kind, view, body in kinds:
        file = f'hayate-{kind}-{variant}.svg'
        if variant == 'onTeam':
            edge = 1024 if kind == 'lockup' else 256
            body = (f'<defs><filter id="edge" filterUnits="userSpaceOnUse" x="0" y="0" width="{edge}" height="256"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="spread"/>'
                    f'<feFlood flood-color="{c["primary"]}"/><feComposite in2="spread" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#edge)">{body}</g>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{html.escape(T["name"])}"><title>{html.escape(T["name"])} — {LABEL}</title>{body}</svg>\n'
        (OUT / file).write_bytes(svg.encode('utf8'))
        files[kind] = {'svg': file, 'png': file.replace('.svg', '.png'), 'webp': file.replace('.svg', '.webp'), 'sourceSha256': hashlib.sha256(svg.encode()).hexdigest()}
    info['variants'][variant] = files
# kanji variant: roundels with the cars' numbers as kanji numerals (livery decals) and the katakana sponsor plate
kfiles = {}
for number, digits in CAR_KANJI.items():
    kfiles[f'num{number}'] = roundel(digits, 120)
kfiles['katakana'] = katakana_plate()
files = {}
for kind, body in kfiles.items():
    file = f'hayate-{kind}-kanji.svg'
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="{html.escape(T["name"])}"><title>{html.escape(T["name"])} — {kind}</title>{body}</svg>\n'
    (OUT / file).write_bytes(svg.encode('utf8'))
    files[kind] = {'svg': file, 'png': file.replace('.svg', '.png'), 'webp': file.replace('.svg', '.webp'), 'sourceSha256': hashlib.sha256(svg.encode()).hexdigest()}
info['variants']['kanji'] = files
m = json.loads((OUT / 'manifest.json').read_text(encoding='utf8'))
m['teams']['hayate'] = info
(OUT / 'manifest.json').write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print('Built Hayate masters:', sum(len(v) for v in info['variants'].values()))
