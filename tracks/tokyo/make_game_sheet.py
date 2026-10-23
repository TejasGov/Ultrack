"""In-game contact sheet: tracks/tokyo/out/v13_1-game-looks.jpg from track-viewer/qa/tokyo-views (rows = views, columns = day, dusk, bluehour, night)."""
from pathlib import Path

from PIL import Image, ImageDraw

Q = Path(__file__).resolve().parents[2] / 'track-viewer' / 'qa' / 'tokyo-views'
OUT = Path(__file__).resolve().parent / 'out' / 'v13_1-game-looks.jpg'
VIEWS = ['1-start-straight', '2-neon-street-fuji', '3-bridge', '4-tunnel', '5-garden-from-road']
LOOKS = ['day', 'dusk', 'bluehour', 'night']
W, H = 640, 360
sheet = Image.new('RGB', (W * 4, (H + 20) * len(VIEWS)), (10, 10, 14))
d = ImageDraw.Draw(sheet)
for r, v in enumerate(VIEWS):
    for c, lk in enumerate(LOOKS):
        f = Q / f'{v}-{lk}.png'
        if f.exists():
            sheet.paste(Image.open(f).convert('RGB').resize((W, H)), (c * W, r * (H + 20) + 20))
        d.text((c * W + 6, r * (H + 20) + 5), f'{v} | {lk}', fill=(255, 255, 255))
sheet.save(OUT, quality=88)
print('saved', OUT, sheet.size)
