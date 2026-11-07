"""Morro Noturno's generated sheets, the content no photo has (run once with system Python: python make_textures.py):
  tex/window_night.png   lit rooms for the night windows, 8 kinds x 2 brightnesses (cells 128 x 192): Brazilian homes mix cool tube light and warm bulbs, a TV's blue, curtains
                         in strong colours, an iron grille in front of some. Each window draws a random cell, mirrored or not, so runs never repeat.
  tex/signs.png          shop signs, 2 x 8 cells of 512 x 128: neon tubes on a dark backing (steady: no blinking) and lit box signs, our own invented shop names in Portuguese.
Fonts are rasterised here; no font file ships."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

H = Path(__file__).parent; T = H / 'tex'; T.mkdir(exist_ok=True); FONTS = Path('C:/Windows/Fonts')
rs = np.random.RandomState(7)
# ---------------------------------------------------------------- lit rooms
CW, CH = 128, 192
A = np.zeros((CH * 2, CW * 8, 3), np.float32); yy, xx = np.mgrid[0:CH, 0:CW]; u, v = xx / (CW - 1), 1 - yy / (CH - 1)
TONE = [(0.82, 0.93, 1.0), (1.0, 0.72, 0.42), (0.86, 0.96, 0.92), (1.0, 0.64, 0.34), (0.55, 0.7, 1.0), (1.0, 0.78, 0.5), (0.9, 0.97, 1.0), (1.0, 0.58, 0.3)]
for row, gain in ((0, 1.0), (1, 0.45)):
    for k in range(8):
        L = (0.45 + 0.55 * np.clip(v * 1.15, 0, 1) ** 1.4) * (0.75 + 0.25 * np.sin(u * np.pi))
        blot = np.array(Image.fromarray((rs.rand(5, 4) * 255).astype(np.uint8)).resize((CW, CH), Image.BICUBIC), np.float32) / 255; L = L * (0.78 + 0.44 * blot)
        col = np.array(TONE[k], np.float32)[None, None] * L[..., None]
        if k == 1:      # curtains: a printed cloth drawn half across, lit from behind
            cl = np.array([0.9, 0.35, 0.12], np.float32); m = (u < 0.42)[..., None]; col = np.where(m, cl * L[..., None] * (0.7 + 0.3 * np.sin(u * 60)[..., None]), col)
        elif k == 3:    # a green curtain, the other side
            cl = np.array([0.25, 0.8, 0.35], np.float32); m = (u > 0.55)[..., None]; col = np.where(m, cl * L[..., None] * (0.7 + 0.3 * np.sin(u * 55)[..., None]), col)
        elif k == 4:    # a TV's light on a dim room
            col = col * 0.35 + np.array([0.3, 0.45, 1.0], np.float32) * np.exp(-(((u - 0.3) / 0.35) ** 2 + ((v - 0.35) / 0.3) ** 2))[..., None] * 0.9
        elif k == 5:    # a figure-height shadow: a room with someone in it
            col = col * np.where((np.abs(u - 0.66) < 0.11) & (v < 0.72), 0.25, 1.0)[..., None]
        elif k == 6:    # an iron grille painted in front (the real ones are geometry only near the road)
            g = ((np.abs((u * 6) % 1 - 0.5) > 0.42) | (np.abs((v * 8) % 1 - 0.5) > 0.44)); col = col * np.where(g, 0.08, 1.0)[..., None]
        elif k == 7:    # a bare bulb, bright at the top
            col = col * 0.5 + np.array([1.0, 0.7, 0.4], np.float32) * np.exp(-(((u - 0.5) / 0.2) ** 2 + ((v - 0.85) / 0.12) ** 2))[..., None]
        fr = (u < 0.04) | (u > 0.96) | (v < 0.03) | (v > 0.97) | (np.abs(u - 0.5) < 0.02)      # the frame and the sliding pane's meeting rail
        col = col * np.where(fr, 0.06, 1.0)[..., None]
        A[row * CH:(row + 1) * CH, k * CW:(k + 1) * CW] = col * gain
Image.fromarray((np.clip(A, 0, 1) ** (1 / 1.25) * 255).astype(np.uint8)).save(T / 'window_night.png')
# ---------------------------------------------------------------- shop signs: (text, font, size, tube colour, kind)
SW, SH = 512, 128
SIGNS = [('Bar do Morro', 'segoescb.ttf', 70, (255, 70, 120), 'neon'), ('LANCHONETE', 'impact.ttf', 84, (255, 210, 60), 'box'),
         ('Açaí', 'segoescb.ttf', 92, (190, 90, 255), 'neon'), ('FARMÁCIA', 'ariblk.ttf', 66, (40, 230, 110), 'box'),
         ('Padaria Pão Quente', 'segoescb.ttf', 40, (255, 160, 60), 'neon'), ('BORRACHARIA', 'impact.ttf', 74, (250, 250, 240), 'box'),
         ('Chopp Gelado', 'segoescb.ttf', 64, (70, 200, 255), 'neon'), ('MERCADINHO', 'ariblk.ttf', 60, (255, 90, 50), 'box'),
         ('Salão Bela', 'segoescb.ttf', 72, (255, 110, 200), 'neon'), ('PASTELARIA', 'impact.ttf', 80, (255, 230, 120), 'box'),
         ('Sorvetes', 'segoescb.ttf', 78, (110, 255, 230), 'neon'), ('OFICINA', 'ariblk.ttf', 70, (255, 200, 40), 'box'),
         ('Baile Hoje', 'segoescb.ttf', 74, (255, 60, 60), 'neon'), ('DEPÓSITO', 'impact.ttf', 84, (240, 240, 230), 'box'),
         ('Lava Jato', 'segoescb.ttf', 76, (60, 160, 255), 'neon'), ('ESPETINHO', 'ariblk.ttf', 58, (255, 140, 40), 'box')]
S = Image.new('RGB', (SW * 2, SH * 8), (0, 0, 0))
for q, (txt, font, size, rgb, kind) in enumerate(SIGNS):
    cell = Image.new('RGB', (SW, SH), (6, 6, 8) if kind == 'neon' else rgb); d = ImageDraw.Draw(cell); f = ImageFont.truetype(str(FONTS / font), size)
    bb = d.textbbox((0, 0), txt, font=f); x, y = (SW - (bb[2] - bb[0])) / 2 - bb[0], (SH - (bb[3] - bb[1])) / 2 - bb[1]
    if kind == 'neon':      # a tube: a wide soft halo, the coloured glass, a near-white core
        halo = Image.new('RGB', (SW, SH), (0, 0, 0)); dh = ImageDraw.Draw(halo); dh.text((x, y), txt, font=f, fill=rgb, stroke_width=6, stroke_fill=rgb)
        cell = Image.blend(cell, halo.filter(ImageFilter.GaussianBlur(10)), 0.55); d = ImageDraw.Draw(cell)
        d.text((x, y), txt, font=f, fill=rgb, stroke_width=2, stroke_fill=rgb); d.text((x, y), txt, font=f, fill=tuple(min(255, c // 2 + 140) for c in rgb))
    else:                   # a back-lit box: pale panel, dark letters, brighter in the middle
        g = np.array(cell, np.float32) * (0.75 + 0.25 * np.exp(-(((np.mgrid[0:SH, 0:SW][1] - SW / 2) / (SW * 0.6)) ** 2)))[..., None]
        cell = Image.fromarray(np.clip(g * 0.5 + 255 * 0.5, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(cell)
        d.text((x, y), txt, font=f, fill=tuple(int(c * 0.22) for c in rgb)); d.rectangle((0, 0, SW - 1, SH - 1), outline=(30, 30, 30), width=6)
    S.paste(cell, ((q % 2) * SW, (q // 2) * SH))
S.save(T / 'signs.png'); print('window_night.png, signs.png written')
