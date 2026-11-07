"""Hartwell Wold's generated sheets, the content no photo has (run once with system Python: python make_textures.py):
  tex/signs.png   painted boards, 1 x 4 cells of 1024 x 256: the inn's name over its door, the village shop, the tea room, the garage. Hand-signwriter colours on dark grounds; invented names.
Fonts are rasterised here; no font file ships."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

H = Path(__file__).parent; T = H / 'tex'; T.mkdir(exist_ok=True); FONTS = Path('C:/Windows/Fonts')
SW, SH = 1024, 256
SIGNS = [('THE WHEATSHEAF INN', 'georgiab.ttf', 92, (22, 52, 34), (214, 182, 104)), ('HARTWELL STORES', 'georgiab.ttf', 104, (28, 34, 52), (230, 222, 200)),
         ('The Old Bakery  Tea Room', 'georgiab.ttf', 78, (96, 28, 30), (236, 214, 170)), ('WOLD GARAGE', 'georgiab.ttf', 112, (30, 30, 30), (220, 200, 120))]
S = Image.new('RGB', (SW, SH * 4))
rs = np.random.RandomState(3)
for q, (txt, font, size, bg, fg) in enumerate(SIGNS):
    g = np.array(bg, np.float32)[None, None] * (0.85 + 0.25 * rs.rand(SH, SW, 1)) * (0.92 + 0.08 * np.sin(np.arange(SW) / 7.0)[None, :, None])     # brushed paint, a little grain
    cell = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(cell); f = ImageFont.truetype(str(FONTS / font), size)
    bb = d.textbbox((0, 0), txt, font=f); x, y = (SW - (bb[2] - bb[0])) / 2 - bb[0], (SH - (bb[3] - bb[1])) / 2 - bb[1]
    d.text((x + 3, y + 3), txt, font=f, fill=tuple(int(c * 0.4) for c in bg)); d.text((x, y), txt, font=f, fill=fg)
    d.rectangle((10, 10, SW - 11, SH - 11), outline=fg, width=5); d.rectangle((0, 0, SW - 1, SH - 1), outline=(20, 16, 12), width=10)
    S.paste(cell, (0, q * SH))
S.save(T / 'signs.png'); print('signs.png written')
# the drystone and the village's coped walls: Poly Haven's japanese_stone_wall regraded from blue-grey to the pale honey of Cotswold oolite
PH = Path('D:/RaceUltimate/assets/polyhaven'); a = np.asarray(Image.open(PH / 'japanese_stone_wall' / 'japanese_stone_wall_diff_1k.jpg').convert('RGB'), np.float32) / 255
l = a.mean(2, keepdims=True); g = np.clip(l * 1.35, 0, 1) ** 0.9 * np.array([1.0, 0.86, 0.64], np.float32) + (a - l) * 0.25
Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).save(T / 'drystone_diff.jpg', quality=92); print('drystone_diff.jpg written')
