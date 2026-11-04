"""Photo sets regraded for Qingshan, never redrawn: imperial yellow glazed tile from ceramic_roof_01, pale terrace stone from large_sandstone_blocks -> tex/.   python make_textures.py"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
H = Path(__file__).parent; PH = H.parents[1] / 'assets' / 'polyhaven'; T = H / 'tex'; T.mkdir(exist_ok=True)
def lum(p): a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32) / 255; return a, a @ [.3, .59, .11]
a, l = lum(PH / 'ceramic_roof_01' / 'ceramic_roof_01_diff_2k.jpg'); l = np.clip((l - np.percentile(l, 2)) / (np.percentile(l, 98) - np.percentile(l, 2)), 0, 1)
stops = np.array([[.18, .10, .02], [.60, .36, .05], [.86, .66, .10], [.96, .82, .28]])      # shadow between tiles -> glaze: imperial yellow, not orange
x = l * (len(stops) - 1); i = np.clip(x.astype(int), 0, len(stops) - 2); t = (x - i)[..., None]; rgb = stops[i] * (1 - t) + stops[i + 1] * t
Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(T / 'roof_yellow_diff_2k.jpg', quality=92)
a, l = lum(PH / 'large_sandstone_blocks' / 'large_sandstone_blocks_diff_2k.jpg'); g = np.clip(.28 + l * 1.75, 0, 1)[..., None]; rgb = g * np.array([1.0, .985, .95]) * .84 + a * .10      # keep a trace of the stone's own colour
Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(T / 'terrace_stone_diff_2k.jpg', quality=92)
a, l = lum(PH / 'brushed_concrete' / 'brushed_concrete_diff_1k.jpg'); g = np.clip(l / np.percentile(l, 60), .45, 1.25)[..., None]      # painted kerb: the concrete's own wear shows through
for name, c in (('kerb_red', (.44, .055, .04)), ('kerb_white', (.60, .59, .55))): Image.fromarray((np.clip(g * np.array(c), 0, 1) * 255).astype(np.uint8)).save(T / f'{name}_diff.jpg', quality=90)
a, l = lum(PH / 'box_profile_metal_sheet' / 'box_profile_metal_sheet_diff_2k.jpg'); g = np.clip(l / np.percentile(l, 60), .55, 1.3)[..., None]      # the same sheet, painted a deeper, cleaner red
Image.fromarray((np.clip(g * np.array((.40, .028, .022)), 0, 1) * 255).astype(np.uint8)).save(T / 'roof_red_diff_2k.jpg', quality=92)
a, l = lum(PH / 'painted_metal_shutter' / 'painted_metal_shutter_diff_2k.jpg') if (PH / 'painted_metal_shutter' / 'painted_metal_shutter_diff_2k.jpg').exists() else lum(PH / 'painted_metal_shutter' / 'painted_metal_shutter_diff_1k.jpg'); g = np.clip(l / np.percentile(l, 60), .6, 1.2)[..., None]      # garage doors in plain light grey
Image.fromarray((np.clip(g * np.array((.62, .63, .62)), 0, 1) * 255).astype(np.uint8)).save(T / 'shutter_grey_diff.jpg', quality=90)
from PIL import ImageDraw, ImageFont
Fw = lambda n: ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', n); Fc = lambda n: ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', n)
def fit(d, text, make, size, width):
    while d.textlength(text, font=make(size)) > width and size > 12: size -= 2
    return make(size)
def centred(d, cx, cy, text, font, fill): box = d.textbbox((0, 0), text, font=font); d.text((cx - (box[0] + box[2]) / 2, cy - (box[1] + box[3]) / 2), text, font=font, fill=fill)
g = Image.new('RGB', (2048, 512), (22, 58, 40)); d = ImageDraw.Draw(g)
d.rectangle((10, 10, 2037, 245), outline=(226, 224, 210), width=6); d.text((90, 62), 'QINGSHAN PARK', font=Fw(120), fill=(238, 236, 224)); d.text((1330, 48), '\u9752\u5c71\u516c\u56ed', font=Fc(130), fill=(238, 236, 224))      # 'green mountain park'
d.rectangle((10, 266, 2037, 501), outline=(226, 224, 210), width=6); centred(d, 650, 380, 'POWERED BY WIND AND SUN', Fw(84), (238, 236, 224)); centred(d, 1600, 380, '\u98ce\u5149\u4f9b\u7535', Fc(120), (238, 236, 224))      # 'wind and solar power'
g.save(T / 'signs.png')
# corner names, both languages: 2 x 4, 1024 x 256
NAMES = [('\u7af9\u6797\u5f2f', 'BAMBOO BEND'), ('\u9752\u5c71\u5f2f', 'GREEN HILL'), ('\u4e91\u5cad\u5f2f', 'CLOUD RIDGE'), ('\u671b\u6e56\u5f2f', 'LAKE VIEW'), ('\u98ce\u8f66\u5f2f', 'WINDMILL'), ('\u7fe0\u6e56\u5f2f', 'JADE LAKE'), ('\u56de\u9f99\u5f2f', 'DRAGON TURN'), ('\u5149\u4f0f\u5f2f', 'SOLAR CURVE')]
g = Image.new('RGB', (2048, 1024), (22, 58, 40)); d = ImageDraw.Draw(g)
for q, (zh, en) in enumerate(NAMES):
    x, y = (q % 2) * 1024, (q // 2) * 256; d.rectangle((x + 8, y + 8, x + 1015, y + 247), outline=(226, 224, 210), width=5); centred(d, x + 240, y + 124, zh, Fc(108), (238, 236, 224)); centred(d, x + 700, y + 128, en, fit(d, en, Fw, 64, 540), (238, 236, 224))
g.save(T / 'names.png')
# tall banners: 4 x 1, 256 x 1024; each name set vertically, as they are
BN = [((156, 22, 18), '\u9752\u5c71\u516c\u56ed', (236, 196, 92)), ((24, 74, 48), '\u7eff\u6c34\u9752\u5c71', (238, 236, 224)), ((196, 150, 40), '\u98ce\u5149\u80fd\u6e90', (70, 22, 12)), ((26, 54, 92), '\u78a7\u6e56\u5149\u4f0f', (238, 236, 224))]
g = Image.new('RGB', (1024, 1024)); d = ImageDraw.Draw(g)
for q, (bg, t_, ink) in enumerate(BN):
    x = q * 256; d.rectangle((x, 0, x + 255, 1023), fill=bg); d.rectangle((x + 14, 14, x + 241, 1009), outline=ink, width=4)
    for k, ch in enumerate(t_): centred(d, x + 128, 150 + k * 240, ch, Fc(170), ink)
g.save(T / 'banners.png')
# the ad sheet: real marks as on the other tracks' boards, each on its brand's colour with its proportions kept, then the invented local sponsors. 1024 x 171 cells
BR = {b['id']: b for b in json.loads((H.parents[1] / 'assets' / 'sponsors' / 'manifest.json').read_text(encoding='utf8'))['brands']}; REAL = ['oppo', 'vivo', 'sony', 'pirelli', 'hsbc', 'rolex', 'redbull']
LOCAL = [((20, 84, 62), '\u9752\u98ce\u80fd\u6e90', 'QINGFENG WIND', (240, 240, 230)), ((14, 52, 96), '\u78a7\u6e56\u5149\u4f0f', 'BIHU SOLAR', (240, 240, 230)), ((226, 232, 222), '\u7eff\u9014\u7535\u52a8', 'L\u00dcTU EV', (20, 96, 60)), ((124, 158, 60), '\u7af9\u6e90', 'ZHUYUAN', (20, 40, 20)), ((150, 22, 18), '\u7eff\u6c34\u9752\u5c71', 'CLEAR WATER, GREEN HILLS', (240, 226, 190))]
CW, CH_ = 1024, 170; g = Image.new('RGB', (CW, CH_ * 12), (32, 32, 32))
for q, n in enumerate(REAL):
    b = BR[n]; cell = Image.new('RGB', (CW, CH_), b['background']); mk = Image.open(H.parents[1] / 'assets' / 'sponsors' / b['file']).convert('RGBA'); bb = mk.getbbox(); mk = mk.crop(bb); r = min(CW * .72 / mk.width, CH_ * .72 / mk.height); mk = mk.resize((max(1, round(mk.width * r)), max(1, round(mk.height * r))), Image.LANCZOS); cell.paste(mk, ((CW - mk.width) // 2, (CH_ - mk.height) // 2), mk); g.paste(cell, (0, q * CH_))
for q, (bg, zh, en, ink) in enumerate(LOCAL):
    cell = Image.new('RGB', (CW, CH_), bg); d = ImageDraw.Draw(cell); centred(d, 230, 82, zh, Fc(80 if len(zh) > 2 else 96), ink); centred(d, 700, 88, en, fit(d, en, Fw, 58, 580), ink); g.paste(cell, (0, (len(REAL) + q) * CH_))
g.save(T / 'ads_qs.png')
a, l = lum(PH / 'worn_asphalt' / 'worn_asphalt_diff_2k.jpg'); base = np.clip(l[:256, :768] * .55, 0, .5)      # tyres: rubber from a photo base, a third painted white, a shadow in each gap
yy, xx = np.mgrid[0:256, 0:768]; img = np.zeros((256, 768, 3)); R0 = 42
for col in range(9):
    for row in range(3):
        cx, cy = 42 + col * 85.5, 42 + row * 85.3; r = np.hypot(xx - cx, yy - cy); disc = r < R0; hole = r < 19; shade = 1 - np.clip((r - R0 * .6) / (R0 * .4), 0, 1) * .35; paint = .78 if (col // 3) % 2 == 0 and col % 3 == 1 else 1
        v = base * shade
        if (col // 3 + row) % 3 == 0: v = np.clip(.62 + base * .4, 0, 1) * shade
        img[disc] = np.stack([v, v, v], -1)[disc]; img[hole] = .012
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(T / 'tyres.png')
print('done')
