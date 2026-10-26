"""qa/tokyo-refactor/materials-sheet.jpg: an overview (before | after, three looks) over close crops of roofs, shoji, timber, stone.
   Reads before/ and after/ written by scripts/qa-tokyo-materials.mjs.   python make-final-sheet.py"""
import subprocess, os
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'materials-sheet.jpg')
font = r"C\:/Windows/Fonts/arialbd.ttf"
P = lambda side, name: os.path.join(here, side, name + '.png')
inputs, chains, tiles = [], [], []
def add(side, name, x, y, W, H, label, w, h, px, py, fs):
    i = len(inputs) // 2; inputs.extend(['-i', P(side, name)])
    crop = f"crop={W}:{H}:{x}:{y}," if W else ''
    chains.append(f"[{i}:v]{crop}scale={w}:{h},drawtext=fontfile='{font}':text='{label}':x=6:y=5:fontsize={fs}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=3[t{i}]")
    tiles.append((f't{i}', px, py))
# overview: rows = views, columns = look x (before, after)
rows = ['2-neon-street-fuji', '1-start-straight', '3-bridge', 'c2-house-front', 'c3-house-side', 'c6-wood-shoji']
looks = ['day', 'dusk', 'night']
for r, v in enumerate(rows):
    for c, look in enumerate(looks):
        for k, side in enumerate(('before', 'after')):
            add(side, f'{v}-{look}', 0, 0, 0, 0, f"{v.split('-')[0]} {look} {side}", 320, 180, (c * 2 + k) * 320, r * 180, 13)
y0 = len(rows) * 180
# close crops at native resolution (480x270 windows of the 1600x900 frames): [name, x, y, label]
crops = [
    [('c2-house-front-day', 0, 440, 'roof 25 m, day'), ('c3-house-side-day', 330, 110, 'roof 45 m, day')],
    [('c2-house-front-dusk', 640, 470, 'shoji, dusk'), ('c2-house-front-night', 640, 470, 'shoji, night')],
    [('c6-wood-shoji-dusk', 500, 80, 'timber, dusk'), ('c5-castle-day', 420, 470, 'stone, day')],
]
for r, pair in enumerate(crops):
    for c, (name, x, y, label) in enumerate(pair):
        for k, side in enumerate(('before', 'after')):
            add(side, name, x, y, 480, 270, f'{label} {side}', 480, 270, (c * 2 + k) * 480, y0 + r * 270, 16)
layout = '|'.join(f'{x}_{y}' for _, x, y in tiles)
fc = ';'.join(chains) + ';' + ''.join(f'[{t}]' for t, _, _ in tiles) + f"xstack=inputs={len(tiles)}:layout={layout}[o]"
subprocess.run(['ffmpeg', '-y', *inputs, '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', '-q:v', '3', out], check=True, stderr=subprocess.DEVNULL)
print(os.path.normpath(out), 1920, 'x', y0 + len(crops) * 270)
