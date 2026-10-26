"""before | after contact sheet from scripts/qa-tokyo-materials.mjs output.
   python make-sheet.py OUT.jpg W VIEW1,VIEW2 LOOK1,LOOK2   (rows = views, columns = looks, each a before|after pair)"""
import subprocess, sys, os
here = os.path.dirname(os.path.abspath(__file__))
out, w = sys.argv[1], int(sys.argv[2]); views = sys.argv[3].split(','); looks = sys.argv[4].split(',')
h = round(w * 9 / 16 / 2) * 2
font = r"C\:/Windows/Fonts/arialbd.ttf"
inputs, chains, tiles = [], [], []
cols = len(looks) * 2
for r, v in enumerate(views):
    for c, look in enumerate(looks):
        for k, side in enumerate(('before', 'after')):
            i = len(inputs) // 2; inputs += ['-i', os.path.join(here, side, f'{v}-{look}.png')]
            tag = f"{v.split('-')[0]} {look} {side}"
            chains.append(f"[{i}:v]scale={w}:{h},drawtext=fontfile='{font}':text='{tag}':x=8:y=6:fontsize={max(14, w // 28)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=4[t{i}]")
            tiles.append((f"t{i}", (c * 2 + k) * w, r * h))
layout = '|'.join(f'{x}_{y}' for _, x, y in tiles)
fc = ';'.join(chains) + ';' + ''.join(f'[{t}]' for t, _, _ in tiles) + f"xstack=inputs={len(tiles)}:layout={layout}[o]"
subprocess.run(['ffmpeg', '-y', *inputs, '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', '-q:v', '3', out], check=True, stderr=subprocess.DEVNULL)
print(out, cols * w, 'x', len(views) * h)
