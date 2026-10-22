# Tokyo 360° skyline band from the six generated segments (textures/panorama/gen: day_A/B/C, night_A/B/C; see PROVENANCE.md).
# Each set is colour-matched to its A segment, joined A -> B -> C -> A with cross-faded seams, and the sky above the
# skyline is keyed to alpha so the game's own sky shows through. Output: textures/panorama/tokyo_skyline_{day,night}.png,
# u = 0..1 around 360° (seam at u=0 is the C -> A cross-fade), v = 0 top. python -I build_panorama.py
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GEN, OUT = os.path.join(HERE, 'textures/panorama/gen'), os.path.join(HERE, 'textures/panorama')
W_OUT = 8192            # around 360°: about 23 px per degree
OVER = 0.10             # seam cross-fade, as a fraction of a segment's width
SEG_H = 1344            # each 6256×2688 segment is halved before joining
DETAIL = 0.025          # mean luminance gradient that counts as built detail
WATER = 0.045           # bottom share of each segment that is bay water

def load(name):
    im = Image.open(os.path.join(GEN, name + '.png')).convert('RGB')
    return np.asarray(im.resize((round(im.width * SEG_H / im.height), SEG_H), Image.LANCZOS), np.float32) / 255

def match(img, ref, lo=0.45):
    """match the city half (rows below lo) per channel to ref's mean/std: one grade across the three segments"""
    a, b = img[int(lo * img.shape[0]):], ref[int(lo * ref.shape[0]):]
    m, s, rm, rs = a.mean((0, 1)), a.std((0, 1)) + 1e-4, b.mean((0, 1)), b.std((0, 1))
    return np.clip((img - m) / s * rs + rm, 0, 1)

def sky_alpha(img, ceiling=None):
    """1 on the city, 0 in the sky: a pixel is sky while it stays close to its row's sky colour, scanning down from the top"""
    h, w, _ = img.shape
    sky = np.median(img[:, :, :], axis=1, keepdims=True)              # per-row sky estimate (the sky dominates the upper rows)
    top_rows = int(0.25 * h); sky[top_rows:] = sky[top_rows - 1]      # below the open sky, keep extrapolating its last row
    for r in range(top_rows, int(0.75 * h)):                          # follow the sky's vertical gradient down (rows still mostly sky)
        row = img[r]; d = np.abs(row - sky[r - 1, 0]).sum(1); keep = row[d < 0.08]
        if len(keep) > w * 0.2: sky[r, 0] = keep.mean(0)
    diff = np.abs(img - sky).sum(2)
    lum = img @ np.array([0.3, 0.59, 0.11], np.float32)
    g = np.zeros_like(lum); g[:, 1:] += np.abs(np.diff(lum, axis=1)); g[1:] += np.abs(np.diff(lum, axis=0))
    c = np.cumsum(np.cumsum(np.pad(g, 4), 0), 1); detail = (c[8:, 8:] - c[:-8, 8:] - c[8:, :-8] + c[:-8, :-8]) / 64   # 8×8 box mean
    city = (diff > 0.11) & (detail > DETAIL)   # buildings carry fine detail; sky, city-glow haze and far Fuji are smooth
    top = np.argmax(np.cumsum(city, 0) >= 3, 0).astype(np.float32)    # first rows of solid city per column
    k = 9; pad = np.pad(top, k, mode='wrap'); top = np.array([np.median(pad[i:i + 2 * k + 1]) for i in range(w)])   # despeckle
    if ceiling is not None: top = np.maximum(top, ceiling)            # night: never above the matching day roofline (its glow haze is grainy)
    rows = np.arange(h, dtype=np.float32)[:, None]
    return np.clip((rows - (top[None, :] - 10)) / 10, 0, 1), top      # 10 px feather above the roofline

def ring(segs, blend=48):
    """join each segment's right overlap to the next one's left overlap at the column where their skylines agree
    best, with a narrow blend there (a wide cross-fade left half-transparent ghost towers); the last joins the first,
    so u wraps without a seam"""
    o = int(OVER * segs[0].shape[1]); lo = blend // 2; out = []
    for i, s in enumerate(segs):
        a, b = s[:, -o:], segs[(i + 1) % len(segs)][:, :o]
        cost = np.abs(a[:, :, 3] - b[:, :, 3]).sum(0) + 0.3 * np.abs(a[:, :, :3] - b[:, :, :3]).sum((0, 2)) / 3
        c = lo + int(np.argmin(cost[lo:o - lo]))
        t = np.clip((np.arange(o) - (c - lo)) / blend, 0, 1).astype(np.float32)[None, :, None]
        out += [s[:, o:-o], a * (1 - t) + b * t]                         # body, then the seam strip over the overlap
    return np.concatenate(out, 1)

def build(kind):
    segs = [load(f'{kind}_{x}') for x in 'ABC']
    segs = [segs[0]] + [match(s, segs[0]) for s in segs[1:]]
    ceil = [None] * 3 if kind == 'day' else [sky_alpha(load(f'day_{x}'))[1] - 25 for x in 'ABC']   # night segments were generated from these day ones
    rgba = [np.dstack([s, sky_alpha(s, c)[0]]) for s, c in zip(segs, ceil)]
    band = ring(rgba)
    a = band[:, :, 3]; rows = np.where(a.max(1) > 0.02)[0]
    y0 = max(0, rows[0] - 24)                                          # crop the empty sky above the tallest tower
    band = band[y0:int(band.shape[0] * (1 - WATER))]                  # the water strip goes: its colour differs per segment and the track's own bay sits in front
    out = Image.fromarray((band * 255 + 0.5).astype(np.uint8), 'RGBA')
    out = out.resize((W_OUT, round(out.height * W_OUT / out.width)), Image.LANCZOS)
    path = os.path.join(OUT, f'tokyo_skyline_{kind}.png'); out.save(path, optimize=True)
    return {'file': os.path.relpath(path, HERE), 'size': out.size, 'crop_top_px_of_1344': int(y0)}

if __name__ == '__main__':
    kinds = sys.argv[1:] or ['day', 'night']
    info = {k: build(k) for k in kinds}
    print(json.dumps(info, indent=1))
