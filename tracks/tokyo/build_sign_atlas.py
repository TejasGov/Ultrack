"""Sign atlas for the v11 game build (system Python + Pillow, not Blender).

python build_sign_atlas.py out/v11-signs.json textures/tokyo_sign_atlas.png out/v11-sign-atlas.json
Input: [{key, body, color:[r,g,b] sRGB 0-255, w, h}] (world metres of the old 3D text's box). Output: an RGBA atlas
(colour text, alpha = coverage) and {key: [u0, v0, u1, v1]} with v up, like Blender UVs.
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = 'C:/Windows/Fonts/msgothic.ttc'          # v11; cells may name a 'font': 'bold' (Yu Gothic Bold) or 'medium' (Yu Gothic Medium), v13.1
FONTS = {'bold': 'C:/Windows/Fonts/YuGothB.ttc', 'medium': 'C:/Windows/Fonts/YuGothM.ttc'}
SIZE, PAD, MAXW, MAXH, PPM = 2048, 4, 1024, 512, 110   # atlas px, gutter, max cell px, pixels per metre


def fit(body, w, h, font=None):
    path = FONTS.get(font, FONT)
    lines = body.split('\n')
    lo, hi = 6, 400
    while lo < hi:                                   # largest font size whose text fits the cell
        mid = (lo + hi + 1) // 2
        f = ImageFont.truetype(path, mid)
        bw = max(f.getbbox(l)[2] for l in lines)
        bh = len(lines) * int(mid * 1.15)
        if bw <= w * 0.96 and bh <= h * 0.96:
            lo = mid
        else:
            hi = mid - 1
    return ImageFont.truetype(path, lo), lo


def main(src, png, js, size=None):
    global SIZE
    if size:
        SIZE = int(size)
    cells = json.load(open(src, encoding='utf8'))
    for c in cells:
        s = min(PPM, MAXW / c['w'], MAXH / c['h'])
        c['pw'], c['ph'] = max(16, int(c['w'] * s)), max(16, int(c['h'] * s))
    cells.sort(key=lambda c: -c['ph'])
    im = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    x = y = row = 0
    out = {}
    for c in cells:
        if x + c['pw'] + PAD > SIZE:
            x, y, row = 0, y + row + PAD, 0
        if y + c['ph'] > SIZE:
            raise SystemExit('atlas full: raise SIZE or lower PPM')
        cell = Image.new('RGBA', (c['pw'], c['ph']), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell)
        f, size = fit(c['body'], c['pw'], c['ph'], c.get('font'))
        lines = c['body'].split('\n')
        lh = int(size * 1.15)
        top = (c['ph'] - lh * len(lines)) // 2
        for k, l in enumerate(lines):
            bb = f.getbbox(l)
            d.text(((c['pw'] - (bb[2] - bb[0])) // 2 - bb[0], top + k * lh), l, font=f, fill=tuple(c['color']) + (255,))
        im.paste(cell, (x, y))
        out[c['key']] = [x / SIZE, 1 - (y + c['ph']) / SIZE, (x + c['pw']) / SIZE, 1 - y / SIZE]
        x += c['pw'] + PAD
        row = max(row, c['ph'])
    im.save(png)
    json.dump(out, open(js, 'w'))
    print('atlas', len(out), 'cells, used height', y + row)


if __name__ == '__main__':
    main(*sys.argv[1:5])
