"""Build a local review sheet from downloaded Meshy renders; no API calls."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--ids', default='furari-488,lambo2,mclaren')
parser.add_argument('--name', default='batch-1')
args = parser.parse_args()
if not args.name.replace('-', '').replace('_', '').isalnum():
    raise ValueError('Use a plain review name.')
state = json.loads((ROOT / 'meshy_output/cars/queue-state.json').read_text(encoding='utf-8'))
ids = args.ids.split(',')
rows = [(car_id, state['cars'][car_id]) for car_id in ids if state['cars'].get(car_id, {}).get('status') == 'downloaded']
if not rows:
    raise ValueError('No downloaded cars available for review.')
sheet = Image.new('RGB', (1500, len(rows) * 320), '#11151d')
draw = ImageDraw.Draw(sheet)
for row, (car_id, record) in enumerate(rows):
    report = json.loads((Path(record['projectDir']) / 'review.json').read_text(encoding='utf-8'))
    inspection = report['inspection']
    draw.text((14, row * 320 + 12), f'{car_id} | {inspection["trianglesAcrossMeshNodes"]:,} triangles | {record.get("consumedCredits", "unknown")} credits', fill='white')
    for col, filename in enumerate(['thumbnail.png', 'thumbnail_left.png', 'thumbnail_right.png']):
        source = Path(record['projectDir']) / 'assets' / filename
        if not source.exists():
            continue
        with Image.open(source) as image:
            image = image.convert('RGB')
            mask = ImageChops.difference(image, Image.new('RGB', image.size, 'black')).convert('L').point(lambda v: 255 if v > 8 else 0)
            box = mask.getbbox()
            if box:
                box = (max(0, box[0]-16), max(0, box[1]-16), min(image.width, box[2]+16), min(image.height, box[3]+16))
                image = image.crop(box)
            tile = ImageOps.contain(image, (480, 248))
            sheet.paste(tile, (col * 500 + (500-tile.width)//2, row * 320 + 40 + (248-tile.height)//2))
        draw.text((col * 500 + 14, row * 320 + 296), ['Primary render', 'Additional view 1', 'Additional view 2'][col], fill='#bac5d8')
output = ROOT / 'meshy_output' / f'{args.name}-renders.jpg'
sheet.save(output, quality=94)
print(output)
