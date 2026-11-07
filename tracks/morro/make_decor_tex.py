"""Morro Noturno's race-furniture sheets (run once with system Python: python make_decor_tex.py):
  tex/ads_6x1.png   eight sponsor hoardings, 1 x 8 cells of 1024 x 171: each brand's colour with its mark inside, proportions kept (assets/sponsors: the same marks and
                    manifest as the other tracks' boards: Llano's make_textures.mjs, Qingshan's ads)
  tex/boards.png    4 x 4 cells of 512 x 256: the 300 / 200 / 100 boards, corner numbers 1-12 on the series' dark blue, the marshal post's plate
  tex/flag.png      the flag over the start and on the stands: Brazil's, drawn from its proportions (20 x 14), the stars left out at this size"""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

H = Path(__file__).parent; T = H / 'tex'; ROOT = H.parents[1]; FONTS = Path('C:/Windows/Fonts')
ADS = ['pirelli', 'redbull', 'shell', 'cocacola', 'samsung', 'sony', 'rolex', 'oppo']      # morro_decor.py reads this order
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
F = Image.new('RGB', (1000, 700), (0, 151, 57)); d = ImageDraw.Draw(F)      # Brazil: green field, yellow rhombus 1.7 from the edges, blue disc of radius 3.5 (units of 50 px)
d.polygon([(85, 350), (500, 85), (915, 350), (500, 615)], fill=(254, 221, 0)); d.ellipse((500 - 175, 350 - 175, 500 + 175, 350 + 175), fill=(1, 33, 105))
band = Image.new('L', F.size, 0); ImageDraw.Draw(band).ellipse((420 - 560, 410 - 40, 420 + 560, 410 + 1080), outline=255, width=30)      # the white band: an arc across the disc, rising to the right
disc = Image.new('L', F.size, 0); ImageDraw.Draw(disc).ellipse((325, 175, 675, 525), fill=255)
F.paste((255, 255, 255), mask=Image.fromarray(__import__('numpy').minimum(__import__('numpy').array(band), __import__('numpy').array(disc))))
F.save(T / 'flag.png'); print('ads_6x1.png, boards.png, flag.png written')
