"""Norrsken's identity (a north star over two aurora ribbons + the NORRSKEN wordmark), same file layout as scripts/build-team-logos.py
(which is left alone) and build-team-logo-hayate.py: outlined SVG masters in assets/teams/logos, entry added to manifest.json.
Then:  node track-viewer/scripts/prepare-team-logos.mjs   (PNG/WebP, runtime.json, review sheet, gallery)
Run from the project root.  Needs fonttools + brotli.  The lettering is outlined from Michroma (SIL OFL, @fontsource/michroma)."""
from pathlib import Path
import hashlib, json, html
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/teams/logos'
T = next(t for t in json.loads((ROOT / 'assets/teams/teams.json').read_text(encoding='utf-8'))['teams'] if t['id'] == 'norrsken')
F = TTFont(ROOT / 'track-viewer/public/assets/fonts' / T['font']['file'])
GS, CMAP = F.getGlyphSet(), F.getBestCmap()
WORD = T['name'].upper()

# emblem, 100 x 100: a four-point north star above two aurora ribbons; the ribbons take the second colour
STAR = '<path d="M50 4 L55.6 30.4 L82 36 L55.6 41.6 L50 68 L44.4 41.6 L18 36 L44.4 30.4 Z"/>'
RIBBONS = ('<path d="M4 78 C20 64 36 88 54 74 C68 63 80 64 96 54 L96 64 C80 73 68 72 54 84 C36 99 20 75 4 88 Z"/>'
           '<path d="M10 94 C26 84 40 100 58 90 C70 83 82 84 92 78 L92 83 C82 89 70 88 58 95 C40 104 26 89 10 99 Z" opacity="0.7"/>')
LABEL = 'North star over aurora ribbons'


def run(text, tracking=0.0):
    """Glyph outlines for text: (list of (name, x_units), bounds in font units)."""
    x, letters, b = 0, [], BoundsPen(GS)
    for ch in text:
        n = CMAP[ord(ch)]; letters.append((n, x)); GS[n].draw(TransformPen(b, (1, 0, 0, 1, x, 0))); x += F['hmtx'][n][0] + tracking * F['head'].unitsPerEm
    return letters, b.bounds


def block(text, s, left, cy, width):
    """Outline text at scale s, left edge at `left`, ink centred on y=cy; tracking is solved so the ink spans `width`."""
    letters, bb = run(text)
    extra = (width / s - (bb[2] - bb[0])) / max(1, len(text) - 1) / F['head'].unitsPerEm
    letters, bb = run(text, extra)
    pen = SVGPathPen(GS)
    for n, x in letters:
        GS[n].draw(TransformPen(pen, (s, 0, 0, -s, left - bb[0] * s + x * s, cy + (bb[1] + bb[3]) * s / 2)))
    return pen.getCommands()


c = T['colors']
# (lettering and star, ribbons) per variant: ice and aurora green on the team's graphite; a deeper green where the ground is light
palettes = {'onTeam': (c['accent'], c['secondary']), 'onDark': ('#f5f1e8', c['secondary']), 'onLight': (c['primary'], '#12875c')}
word = block(WORD, 0.042, 252, 128, 744)
emblem = lambda ink, green: f'<g fill="{ink}">{STAR}</g><g fill="{green}">{RIBBONS}</g>'
info = {'name': T['name'], 'emblem': LABEL, 'font': T['font'], 'colors': c, 'variants': {}}
for variant, (ink, green) in palettes.items():
    files = {}
    kinds = [('lockup', '0 0 1024 256', f'<g transform="translate(28 30) scale(1.92)">{emblem(ink, green)}</g><path fill="{ink}" d="{word}"/>'),
             ('icon', '0 0 256 256', f'<g transform="translate(28 24) scale(2)">{emblem(ink, green)}</g>')]
    for kind, view, body in kinds:
        file = f'norrsken-{kind}-{variant}.svg'
        if variant == 'onTeam':     # a hairline of the team colour round the artwork, so it reads on any paint (as Hayate's)
            edge = 1024 if kind == 'lockup' else 256
            body = (f'<defs><filter id="edge" filterUnits="userSpaceOnUse" x="0" y="0" width="{edge}" height="256"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="spread"/>'
                    f'<feFlood flood-color="{c["primary"]}"/><feComposite in2="spread" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#edge)">{body}</g>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{html.escape(T["name"])}"><title>{html.escape(T["name"])} — {LABEL}</title>{body}</svg>\n'
        (OUT / file).write_bytes(svg.encode('utf8'))
        files[kind] = {'svg': file, 'png': file.replace('.svg', '.png'), 'webp': file.replace('.svg', '.webp'), 'sourceSha256': hashlib.sha256(svg.encode()).hexdigest()}
    info['variants'][variant] = files
m = json.loads((OUT / 'manifest.json').read_text(encoding='utf8'))
m['teams']['norrsken'] = info
(OUT / 'manifest.json').write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print('Built Norrsken masters:', sum(len(v) for v in info['variants'].values()))
