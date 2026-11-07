"""Hartwell Wold's race-furniture sheets (run once with system Python: python make_decor_tex.py):
  tex/ads_6x1.png   eight sponsor hoardings, 1 x 8 cells of 1024 x 171: each brand's colour with its mark inside, proportions kept (assets/sponsors: the same marks and
                    manifest as the other tracks' boards: Llano's make_textures.mjs, Qingshan's ads)
  tex/boards.png    4 x 4 cells of 512 x 256: the 300 / 200 / 100 boards, corner numbers 1-12 on the series' dark blue, the marshal post's plate
  tex/flag.png      the flag on the stands and the village's poles: the Union Flag, 2:1, drawn from its proportions (the red saltire counterchanged)"""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

H = Path(__file__).parent; T = H / 'tex'; ROOT = H.parents[1]; FONTS = Path('C:/Windows/Fonts')
ADS = ['shell', 'hsbc', 'rolex', 'pirelli', 'redbull', 'sony', 'cocacola', 'emirates']      # wold_decor.py reads this order
BR = {b['id']: b for b in json.loads((ROOT / 'assets' / 'sponsors' / 'manifest.json').read_text(encoding='utf8'))['brands']}
W, Hh = 1024, 171; S = Image.new('RGB', (W, Hh * len(ADS)))
for q, n in enumerate(ADS):
    b = BR[n]; cell = Image.new('RGB', (W, Hh), b['background']); m = Image.open(ROOT / 'assets' / 'sponsors' / b['file']).convert('RGBA'); m = m.crop(m.getbbox())
    k = min(W * 0.72 / m.width, Hh * 0.72 / m.height); m = m.resize((max(1, int(m.width * k)), max(1, int(m.height * k))), Image.LANCZOS)
    cell.paste(m, ((W - m.width) // 2, (Hh - m.height) // 2), m); S.paste(cell, (0, q * Hh))
S.save(T / 'ads_6x1.png')
CW, CH = 512, 256; B = Image.new('RGB', (CW * 4, CH * 4), (20, 20, 20)); d = ImageDraw.Draw(B)
def cell(q, bg, ink, text, size, font='impact.ttf', edge=None):
    x0, y0 = (q % 4) * CW, (q // 4) * CH; d.rectangle((x0, y0, x0 + CW - 1, y0 + CH - 1), fill=bg)
    if edge: d.rectangle((x0 + 12, y0 + 12, x0 + CW - 13, y0 + CH - 13), outline=edge, width=10)
    f = ImageFont.truetype(str(FONTS / font), size); bb = d.textbbox((0, 0), text, font=f)
    d.text((x0 + (CW - (bb[2] - bb[0])) / 2 - bb[0], y0 + (CH - (bb[3] - bb[1])) / 2 - bb[1]), text, font=f, fill=ink)
for q, t in enumerate(('300', '200', '100')): cell(q, (242, 240, 234), (17, 17, 17), t, 200)
for c in range(1, 13): cell(2 + c, (14, 32, 78), (245, 245, 240), str(c), 190, edge=(245, 245, 240))
cell(15, (232, 118, 24), (20, 20, 20), 'MARSHAL', 74, 'ariblk.ttf')
B.save(T / 'boards.png')
U = 20; F = Image.new('RGB', (60 * U, 30 * U), (1, 33, 105)); d = ImageDraw.Draw(F)      # units of a 60 x 30 flag
def band(p, q, w, col, off=0.0):
    (x0, y0), (x1, y1) = p, q; L = math.hypot(x1 - x0, y1 - y0); nx, ny = -(y1 - y0) / L, (x1 - x0) / L; a, b = off - w / 2, off + w / 2
    d.polygon([((x0 + nx * a) * U, (y0 + ny * a) * U), ((x1 + nx * a) * U, (y1 + ny * a) * U), ((x1 + nx * b) * U, (y1 + ny * b) * U), ((x0 + nx * b) * U, (y0 + ny * b) * U)], fill=col)
band((0, 0), (60, 30), 6, (255, 255, 255)); band((0, 30), (60, 0), 6, (255, 255, 255))
band((0, 0), (30, 15), 2, (200, 16, 46), -1); band((30, 15), (60, 30), 2, (200, 16, 46), 1); band((0, 30), (30, 15), 2, (200, 16, 46), 1); band((30, 15), (60, 0), 2, (200, 16, 46), -1)
d.rectangle((25 * U, 0, 35 * U, 30 * U), fill=(255, 255, 255)); d.rectangle((0, 10 * U, 60 * U, 20 * U), fill=(255, 255, 255))
d.rectangle((27 * U, 0, 33 * U, 30 * U), fill=(200, 16, 46)); d.rectangle((0, 12 * U, 60 * U, 18 * U), fill=(200, 16, 46))
F.save(T / 'flag.png'); print('ads_6x1.png, boards.png, flag.png written')
