"""Procedural textures for v13 (no external art): crowd cutout strip and the obviously-placeholder anime mural panels.
    python tracks/tokyo/make_textures_v13.py"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

T = Path(__file__).resolve().parent / 'textures'
rnd = random.Random(13)

# ---- crowd: 1024x256 RGBA tile, ~6 seated spectators across, two depth layers, transparent between them
SK = [(236, 196, 160), (210, 160, 120), (170, 120, 85), (120, 80, 55), (245, 215, 190)]
CL = [(200, 30, 40), (240, 240, 240), (20, 20, 25), (35, 60, 150), (230, 120, 20), (60, 150, 90), (240, 190, 40), (180, 60, 160), (90, 90, 100), (20, 110, 130)]
im = Image.new('RGBA', (1024, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(im)


def person(x, y0, sc, dark):
    skin = rnd.choice(SK)
    col = rnd.choice(CL)
    if dark:
        col = tuple(int(c * 0.55) for c in col)
        skin = tuple(int(c * 0.6) for c in skin)
    r = int(30 * sc)
    cx = x
    top = y0
    d.ellipse((cx - r, top, cx + r, top + 2 * r), fill=skin + (255,))
    if rnd.random() < 0.3:      # cap / dark hair
        d.pieslice((cx - r, top - 2, cx + r, top + 2 * r), 180, 360, fill=(30, 25, 30, 255) if rnd.random() < 0.6 else col + (255,))
    sh_top = top + 2 * r - 4
    w = int(62 * sc)
    d.rounded_rectangle((cx - w, sh_top, cx + w, 256 + 40), radius=int(30 * sc), fill=col + (255,))
    if rnd.random() < 0.28:     # raised arm
        side = rnd.choice((-1, 1))
        d.line((cx + side * w * 0.8, sh_top + 20, cx + side * (w + 16), top - 18), fill=skin + (255,), width=int(15 * sc))
    if rnd.random() < 0.08:     # flag / banner
        d.rectangle((cx + 10, top - 40, cx + 52, top - 8), fill=rnd.choice(CL) + (255,))


for k in range(7):
    person(k * 170 + 40 + rnd.randint(-8, 8), 40 + rnd.randint(0, 14), 0.85, True)       # back row
for k in range(6):
    person(k * 170 + 125 + rnd.randint(-10, 10), 96 + rnd.randint(0, 14), 1.0, False)    # front row
im.save(T / 'v13_crowd_cutout.png')

# ---- anime mural placeholders: soft gradient + label, 16:9 (1536x864)
(T / 'anime_mural').mkdir(exist_ok=True)
try:
    f1 = ImageFont.truetype('arial.ttf', 150)
    f2 = ImageFont.truetype('arial.ttf', 56)
except OSError:
    f1 = f2 = ImageFont.load_default()
PAL = [((255, 168, 205), (140, 190, 255)), ((255, 214, 140), (255, 120, 170)), ((150, 230, 255), (190, 150, 255)), ((190, 255, 200), (120, 170, 255))]
for n, (a, b) in enumerate(PAL, 1):
    w, h = 1536, 864
    g = Image.new('RGB', (w, h))
    px = g.load()
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.5 + y / h * 0.5)
            px[x, y] = tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))
    dd = ImageDraw.Draw(g)
    dd.rounded_rectangle((60, 60, w - 60, h - 60), radius=40, outline=(255, 255, 255), width=8)
    dd.text((w // 2, h // 2 - 30), 'ANIME MURAL', font=f1, fill=(255, 255, 255), anchor='mm')
    dd.text((w // 2, h // 2 + 110), f'PLACEHOLDER {n:02d}  16:9  replace this image', font=f2, fill=(255, 255, 255), anchor='mm')
    g.save(T / 'anime_mural' / f'placeholder_{n:02d}.png')
print('textures written')
