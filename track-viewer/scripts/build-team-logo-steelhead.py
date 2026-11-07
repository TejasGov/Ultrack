"""Steelhead's identity (a steelhead trout in a hex nut + the STEELHEAD wordmark), same file layout as scripts/build-team-logos.py
(which is left alone) and build-team-logo-norrsken.py: outlined SVG masters in assets/teams/logos, entry added to manifest.json.
Then:  node track-viewer/scripts/prepare-team-logos.mjs   (PNG/WebP, runtime.json, review sheet, gallery)
Run from the project root.  Needs fonttools + brotli.  The lettering is outlined from Anton (SIL OFL, the fontsource file already in track-viewer/public/assets/fonts)."""
from pathlib import Path
import hashlib, json, html
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/teams/logos'
T = next(t for t in json.loads((ROOT / 'assets/teams/teams.json').read_text(encoding='utf-8'))['teams'] if t['id'] == 'steelhead')
F = TTFont(ROOT / 'track-viewer/public/assets/fonts' / T['font']['file'])
GS, CMAP = F.getGlyphSet(), F.getBestCmap()
WORD = T['name'].upper()

# emblem, 100 x 100: a hex nut (Detroit steel) round a steelhead trout; the trout's lateral band takes the second colour
NUT = '<path fill-rule="evenodd" d="M50 2 L91.6 26 L91.6 74 L50 98 L8.4 74 L8.4 26 Z M50 9 L85.5 29.5 L85.5 70.5 L50 91 L14.5 70.5 L14.5 29.5 Z"/>'
FISH = ('<path fill-rule="evenodd" d="M18 50 C30 34 54 32 70 46 L84 34 L80 50 L84 66 L70 54 C54 68 30 66 18 50 Z M26.5 46.5 a2.6 2.6 0 1 0 0.01 0 Z"/>')
BAND = '<path d="M30 51 C42 45.5 56 45 69 49.5 C56 55 42 56 30 51 Z"/>'
LABEL = 'Steelhead trout in a hex nut'


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
# (lettering, nut and trout; the band) per variant: near-black and rose on the team's steel; bone on dark; a deeper rose where the ground is light
palettes = {'onTeam': (c['accent'], c['secondary']), 'onDark': ('#f5f1e8', c['secondary']), 'onLight': (c['accent'], '#c22a55')}
_, bb = run(WORD)
word = block(WORD, min(132 / (bb[3] - bb[1]), 700 / (bb[2] - bb[0])), 252, 128, 744)   # Anton is tall and narrow: the cap height sets the scale, the tracking fills the width
emblem = lambda ink, rose: f'<g fill="{ink}">{NUT}{FISH}</g><g fill="{rose}">{BAND}</g>'
info = {'name': T['name'], 'emblem': LABEL, 'font': T['font'], 'colors': c, 'variants': {}}
for variant, (ink, rose) in palettes.items():
    files = {}
    kinds = [('lockup', '0 0 1024 256', f'<g transform="translate(28 30) scale(1.92)">{emblem(ink, rose)}</g><path fill="{ink}" d="{word}"/>'),
             ('icon', '0 0 256 256', f'<g transform="translate(28 24) scale(2)">{emblem(ink, rose)}</g>')]
    for kind, view, body in kinds:
        file = f'steelhead-{kind}-{variant}.svg'
        if variant == 'onTeam':     # a hairline of the team colour round the artwork, so it reads on any paint (as Hayate's)
            edge = 1024 if kind == 'lockup' else 256
            body = (f'<defs><filter id="edge" filterUnits="userSpaceOnUse" x="0" y="0" width="{edge}" height="256"><feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="spread"/>'
                    f'<feFlood flood-color="{c["primary"]}"/><feComposite in2="spread" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#edge)">{body}</g>')
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{html.escape(T["name"])}"><title>{html.escape(T["name"])} — {LABEL}</title>{body}</svg>\n'
        (OUT / file).write_bytes(svg.encode('utf8'))
        files[kind] = {'svg': file, 'png': file.replace('.svg', '.png'), 'webp': file.replace('.svg', '.webp'), 'sourceSha256': hashlib.sha256(svg.encode()).hexdigest()}
    info['variants'][variant] = files
m = json.loads((OUT / 'manifest.json').read_text(encoding='utf8'))
m['teams']['steelhead'] = info
(OUT / 'manifest.json').write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
print('Built Steelhead masters:', sum(len(v) for v in info['variants'].values()))
