"""Venice's graded copies of Poly Haven sets (as Llano's and Dry Lake's bleached asphalt): pale limestone from Medieval Blocks 03 (its colour is a rough tan, no limestone set was found), and calmer clay tiles (Clay Roof Tiles 02 is very orange)."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
PH = Path(__file__).parents[2] / 'assets' / 'polyhaven'; OUT = Path(__file__).parent / 'tex'; OUT.mkdir(exist_ok=True)
a = np.asarray(Image.open(PH / 'medieval_blocks_03' / 'medieval_blocks_03_diff_2k.jpg').convert('RGB')).astype(float) / 255
L = a.mean(2); pale = 0.74 + (L - L.mean()) * 0.95
Image.fromarray((np.clip(np.stack([pale * 1.0, pale * 0.975, pale * 0.915], 2), 0, 1) * 255).astype('uint8')).save(OUT / 'limestone_diff_2k.jpg', quality=92)
# dressed stone for column shafts: the limestone's colour and mottling with its block joints blurred away
Image.open(OUT / 'limestone_diff_2k.jpg').filter(ImageFilter.GaussianBlur(14)).save(OUT / 'limestone_smooth_diff_2k.jpg', quality=92)
b = np.asarray(Image.open(PH / 'clay_roof_tiles_02' / 'clay_roof_tiles_02_diff_2k.jpg').convert('RGB')).astype(float) / 255
g = b.mean(2, keepdims=True); t = g + (b - g) * 0.55; t = t * np.array([0.92, 0.8, 0.72])
Image.fromarray((np.clip(t, 0, 1) * 255).astype('uint8')).save(OUT / 'tile_muted_diff_2k.jpg', quality=92)

# ------------------------------------------------------------------------------------------------ decor art (IDENTITY.md): generated only where no photo exists, every name invented
from PIL import ImageDraw, ImageFont
FONT = lambda name, size: ImageFont.truetype(f'C:/Windows/Fonts/{name}.ttf', size)
def grain(im, amt=10, seed=3):
    a = np.asarray(im.convert('RGB')).astype(float); rng = np.random.default_rng(seed); n = rng.normal(0, amt, a.shape[:2])[..., None]; lo = np.asarray(Image.fromarray(np.uint8(np.clip(rng.normal(128, 40, (a.shape[0] // 16 + 1, a.shape[1] // 16 + 1)), 0, 255))).resize((a.shape[1], a.shape[0]), Image.BICUBIC)).astype(float)[..., None] / 128
    return Image.fromarray(np.uint8(np.clip(a * (0.86 + 0.14 * lo) + n, 0, 255)))
def centre(d, box, text, font, fill):
    l, t, r, b = d.textbbox((0, 0), text, font=font); d.text(((box[0] + box[2] - (r - l)) / 2 - l, (box[1] + box[3] - (b - t)) / 2 - t), text, font=font, fill=fill)
# shop signs: 2 x 8, painted boards with gilt lettering
SHOPS = ['Caffè Alvise', 'Trattoria al Ponte', 'Gelateria Serena', 'Farmacia San Polo', 'Libreria del Molo', 'Pasticceria Rosa', 'Osteria Due Remi', 'Tabacchi e Sali', 'Panificio Zen', 'Sartoria Moro', 'Vetri d\'Arte', 'Maschere Nane', 'Ristorante Laguna', 'Bar Regata', 'Merceria Lina', 'Orologi Dandolo']
BOARD = [(24, 52, 40), (70, 18, 20), (20, 32, 58), (40, 28, 20)]
im = Image.new('RGB', (1024, 1024)); d = ImageDraw.Draw(im); f = FONT('georgiab', 50)
for k, n in enumerate(SHOPS):
    x, y = (k % 2) * 512, (k // 2) * 128; d.rectangle((x, y, x + 512, y + 128), fill=BOARD[k % 4]); d.rectangle((x + 8, y + 8, x + 503, y + 119), outline=(196, 158, 80), width=3); centre(d, (x, y, x + 512, y + 128), n, f, (222, 186, 104))
grain(im, 5).save(OUT / 'shop_signs.png')
# race boards: the top row 300 200 100, then the track's name, then corner names (invented)
im = Image.new('RGB', (1024, 1024), (22, 22, 24)); d = ImageDraw.Draw(im)
for k, n in enumerate(('300', '200', '100')):
    x = k * 256; d.rectangle((x + 6, 6, x + 249, 249), fill=(236, 234, 226)); d.rectangle((x + 16, 16, x + 239, 239), outline=(150, 26, 24), width=10); centre(d, (x, 0, x + 256, 256), n, FONT('arialbd', 104), (20, 20, 22))
d.rectangle((0, 384, 1024, 512), fill=(120, 16, 20)); d.rectangle((6, 390, 1017, 505), outline=(206, 164, 72), width=4); centre(d, (0, 384, 1024, 512), 'CIRCUITO DI VENEZIA', FONT('georgiab', 78), (232, 196, 110))
for k, n in enumerate(('CURVA DELL\'ARSENALE', 'DISCESA DEL PONTE', 'TORNANTE DEL MOLO', 'GALLERIA DEL PONTE')):
    y = 640 + k * 96; d.rectangle((0, y, 1024, y + 96), fill=(20, 32, 58)); d.rectangle((5, y + 5, 1018, y + 90), outline=(206, 164, 72), width=3); centre(d, (0, y, 1024, y + 96), n, FONT('georgiab', 58), (236, 232, 218))
grain(im, 4).save(OUT / 'race_boards.png')
# banners: red and blue on the lamp posts (left half: two cells); flags (right half, top): a red and gold one, the Italian tricolour
im = Image.new('RGB', (1024, 1024)); d = ImageDraw.Draw(im)
for k, (bg, fg) in enumerate((((122, 16, 20), (214, 172, 84)), ((18, 34, 70), (214, 172, 84)))):
    x = k * 256; d.rectangle((x, 0, x + 256, 1024), fill=bg); d.rectangle((x + 12, 12, x + 243, 1011), outline=fg, width=7)
    t = 'VENEZIA'; f = FONT('georgiab', 92); step = 112; y0 = 150
    for q, c in enumerate(t): centre(d, (x, y0 + q * step, x + 256, y0 + q * step + 100), c, f, fg)
    for yy in (70, 950):
        d.polygon([(x + 128, yy - 34), (x + 138, yy - 10), (x + 164, yy - 10), (x + 143, yy + 6), (x + 151, yy + 32), (x + 128, yy + 16), (x + 105, yy + 32), (x + 113, yy + 6), (x + 92, yy - 10), (x + 118, yy - 10)], fill=fg)
x = 512; d.rectangle((x, 0, x + 256, 512), fill=(136, 18, 22)); d.rectangle((x + 10, 10, x + 245, 501), outline=(218, 176, 86), width=8)
d.polygon([(x + 128, 170), (x + 150, 232), (x + 216, 232), (x + 163, 270), (x + 183, 334), (x + 128, 296), (x + 73, 334), (x + 93, 270), (x + 40, 232), (x + 106, 232)], fill=(218, 176, 86))
x = 768
for q, c in enumerate(((0, 122, 78), (244, 244, 240), (206, 33, 52))): d.rectangle((x + q * 85, 0, x + (q + 1) * 85 + 1, 512), fill=c)
d.rectangle((512, 512, 1024, 1024), fill=(40, 40, 42))
grain(im, 5).save(OUT / 'banners.png')
# posters: 4 x 2, invented events, a printed look on aged paper
PST = [((196, 62, 38), (240, 222, 180), 'REGATA', 'sul Canale'), ((22, 52, 86), (232, 206, 148), 'OPERA', 'Teatro Nuovo'), ((230, 214, 170), (130, 28, 30), 'CARNEVALE', 'in Laguna'), ((34, 74, 70), (236, 214, 160), 'VETRI', 'Mostra d\'Arte'),
       ((222, 170, 62), (40, 30, 30), 'GRAN GALA', 'al Lido'), ((112, 22, 40), (236, 208, 150), 'CONCERTO', 'in Piazza'), ((206, 214, 200), (22, 60, 92), 'IL MOLO', 'Crociere'), ((26, 26, 34), (226, 178, 84), 'CORSA', 'Circuito di Venezia')]
im = Image.new('RGB', (1024, 1024)); d = ImageDraw.Draw(im)
for k, (bg, fg, a, b) in enumerate(PST):
    x, y = (k % 4) * 256, (k // 4) * 512; d.rectangle((x, y, x + 256, y + 512), fill=bg); d.rectangle((x + 10, y + 10, x + 245, y + 501), outline=fg, width=4)
    cx, cy = x + 128, y + 215
    if k % 4 == 0:      # a gondola on the water
        d.polygon([(x + 28, cy + 40), (x + 228, cy + 40), (x + 240, cy - 8), (x + 216, cy + 60), (x + 40, cy + 60), (x + 18, cy + 10)], fill=fg); d.rectangle((x + 20, cy + 76, x + 236, cy + 82), fill=fg); d.rectangle((x + 40, cy + 94, x + 216, cy + 98), fill=fg)
    elif k % 4 == 1:      # an arch and a sun
        d.ellipse((cx - 62, cy - 86, cx + 62, cy + 38), fill=fg); d.rectangle((cx - 62, cy - 24, cx + 62, cy + 80), fill=fg); d.ellipse((cx - 36, cy - 62, cx + 36, cy + 10), fill=bg); d.rectangle((cx - 36, cy - 26, cx + 36, cy + 80), fill=bg)
    elif k % 4 == 2:      # a diamond mask pattern
        for q in range(-1, 2):
            d.polygon([(cx + q * 66, cy - 76), (cx + q * 66 + 32, cy), (cx + q * 66, cy + 76), (cx + q * 66 - 32, cy)], fill=fg if q else bg, outline=fg)
    else:      # a dome
        d.pieslice((cx - 72, cy - 74, cx + 72, cy + 70), 180, 360, fill=fg); d.rectangle((cx - 80, cy, cx + 80, cy + 14), fill=fg)
        for q in range(-3, 4): d.rectangle((cx + q * 23 - 5, cy + 14, cx + q * 23 + 5, cy + 74), fill=fg)
        d.rectangle((cx - 86, cy + 74, cx + 86, cy + 86), fill=fg); d.rectangle((cx - 4, cy - 104, cx + 4, cy - 66), fill=fg)
    fn = 42 if len(a) <= 7 else 33
    centre(d, (x, y + 22, x + 256, y + 100), a, FONT('georgiab', fn), fg); centre(d, (x, y + 382, x + 256, y + 450), b, FONT('georgia', 25), fg)
grain(im, 7).save(OUT / 'posters.png')
# awnings: 4 stripes; laundry: 4 pieces
im = Image.new('RGB', (512, 128)); d = ImageDraw.Draw(im)
for k, c in enumerate(((122, 22, 24), (24, 66, 48), (28, 46, 88), (178, 120, 48))):
    x = k * 128; d.rectangle((x, 0, x + 128, 128), fill=(232, 224, 200))
    for q in range(0, 128, 32): d.rectangle((x + q, 0, x + q + 16, 128), fill=c)
    d.rectangle((x, 0, x + 128, 8), fill=c)
grain(im, 7).save(OUT / 'awnings.png')
im = Image.new('RGB', (512, 128), (232, 230, 222)); d = ImageDraw.Draw(im)
d.rectangle((128, 0, 256, 128), fill=(160, 186, 206)); d.rectangle((256, 0, 384, 128), fill=(222, 196, 170)); d.rectangle((384, 0, 512, 128), fill=(190, 60, 54))
for q in range(0, 128, 18): d.rectangle((128 + q, 0, 128 + q + 6, 128), fill=(236, 236, 232))
grain(im, 6).save(OUT / 'laundry.png')
# the squares' floor: the photo pavement crossed by a pale stone grid, the way Venetian campi are laid
p = np.asarray(Image.open(PH / 'pavement_01' / 'pavement_01_diff_1k.jpg').convert('RGB')).astype(float) / 255; p = p * 0.72 + 0.02; n = p.shape[0]; yy, xx = np.mgrid[0:n, 0:n]
step = n / 3; dx = np.minimum((xx % step), step - (xx % step)); dy = np.minimum((yy % step), step - (yy % step)); line = (dx < n * 0.009) | (dy < n * 0.009)
diag = (np.abs(((xx + yy) % step) - step / 2) < n * 0.005) | (np.abs(((xx - yy) % step) - step / 2) < n * 0.005)
c = np.array([0.86, 0.83, 0.75]); p[line | diag] = p[line | diag] * 0.25 + c * 0.75
Image.fromarray(np.uint8(np.clip(p, 0, 1) * 255)).save(OUT / 'piazza_diff.jpg', quality=92)
# the HQ's upper wall: lozenges of rose and pale stone, each stone with the limestone's mottling
base_ = np.asarray(Image.open(OUT / 'limestone_smooth_diff_2k.jpg').convert('RGB').resize((1024, 1024))).astype(float) / 255
yy, xx = np.mgrid[0:1024, 0:1024]; cell = 256; u_ = ((xx + yy) % (2 * cell)) / (2 * cell); v_ = ((xx - yy) % (2 * cell)) / (2 * cell); iu = ((xx + yy) // (2 * cell)); iv = ((xx - yy) // (2 * cell))
rose = (iu + iv) % 2 == 0; t = base_.copy(); t[rose] = t[rose] * np.array([0.96, 0.66, 0.58])
joint = (np.minimum(u_, 1 - u_) < 0.012) | (np.minimum(v_, 1 - v_) < 0.012); t[joint] = t[joint] * 0.62
Image.fromarray(np.uint8(np.clip(t, 0, 1) * 255)).save(OUT / 'lozenge_diff.jpg', quality=92)
