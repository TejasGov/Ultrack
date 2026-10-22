"""Extract existing single-car views; preserve original design sheets unchanged."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / 'meshy' / 'cars.json').read_text(encoding='utf-8'))
output = ROOT / 'meshy_output'
prepared = []
for car in config['cars']:
    source = ROOT / car['source']
    with Image.open(source) as raw:
        image = ImageOps.exif_transpose(raw).convert('RGB')
        layout = 'wide' if image.width / image.height > 1.65 else 'standard'
        boxes = car.get('cropBoxes', config['cropBoxes'][layout])
        folder = output / 'references' / car['id']
        folder.mkdir(parents=True, exist_ok=True)
        views = []
        for view in ('front', 'side', 'rear'):
            if 'cropPixels' in car:
                pixels = tuple(car['cropPixels'][view])
            else:
                box = boxes[view]
                pixels = tuple(round(v * (image.width if i % 2 == 0 else image.height)) for i, v in enumerate(box))
            if not (0 <= pixels[0] < pixels[2] <= image.width and 0 <= pixels[1] < pixels[3] <= image.height):
                raise ValueError(f'Invalid crop: {car["id"]} {view}')
            crop = image.crop(pixels)
            target = folder / f'{view}.png'
            crop.save(target)
            views.append({'view': view, 'path': target.relative_to(ROOT).as_posix(),
                          'box': list(pixels), 'width': crop.width, 'height': crop.height,
                          'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
        prepared.append({**car, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'views': views})

for page in range((len(prepared) + 3) // 4):
    group = prepared[page * 4:(page + 1) * 4]
    sheet = Image.new('RGB', (1440, len(group) * 260), '#171a21')
    draw = ImageDraw.Draw(sheet)
    for row, car in enumerate(group):
        draw.text((10, row * 260 + 5), car['id'], fill='white')
        for col, view in enumerate(car['views']):
            with Image.open(ROOT / view['path']) as image:
                tile = ImageOps.contain(image, (466, 204))
                sheet.paste(tile, (col * 480 + (480 - tile.width) // 2, row * 260 + 25 + (204 - tile.height) // 2))
            draw.text((col * 480 + 10, row * 260 + 237), view['view'], fill='white')
    sheet.save(output / f'prepared-views-{page + 1}.jpg', quality=92)

manifest = {'schemaVersion': 1, 'preparation': 'Pixel crops only; no generated edits or upscaling. Front view first.', 'cars': prepared}
(output / 'prepared-references.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Prepared {len(prepared)} cars / {sum(len(c["views"]) for c in prepared)} views in {output / "references"}')
print('Review meshy_output/prepared-views-1.jpg through prepared-views-3.jpg before submitting.')
