"""Bake the v13.1 backdrop textures for the game (system Python + Pillow + numpy, not Blender).

    python bake_backdrop_v13_1.py

Writes textures/panorama/tokyo_arc_night.png, tokyo_arc_day.png (the single skyline strip with the distance haze, the soft ends and the foot / top fades
baked into colour and alpha, so the glTF material needs no vertex colours) and textures/tokyo_fuji_v13.png (the Fuji cut-out with a haze fade at its base).
"""
from pathlib import Path

import numpy as np
from PIL import Image

T = Path(__file__).resolve().parent / 'textures'


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def arc(src, dst, day):
    im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255.0
    h, w, _ = im.shape
    v = (1.0 - (np.arange(h, dtype=np.float32) + 0.5) / h)[:, None]          # 0 at the bottom row
    u = ((np.arange(w, dtype=np.float32) + 0.5) / w)[None, :]
    f = smooth(0.0, 0.55, v)                                                   # 0 at the foot -> 1 above 55 % of the height
    rgb = im[:, :, :3]
    if not day:
        gray = rgb.mean(axis=2, keepdims=True)
        rgb = rgb * (1 - 0.7 * (1 - f)[..., None]) + gray * (0.7 * (1 - f)[..., None])        # desaturate toward the base
        tint = np.array([0.03, 0.035, 0.08], np.float32)
        k = (0.6 * (1 - f))[..., None]
        rgb = rgb * (1 - k) + tint * k                                                          # night haze
        rgb = rgb * (0.5 + 0.5 * f)[..., None] * 0.95
    else:
        k = (0.5 * (1 - f))[..., None]
        rgb = rgb * (1 - k) + np.array([0.62, 0.70, 0.80], np.float32) * k                     # day haze
    hf = np.minimum(u, 1 - u) / 0.14
    hf = np.clip(hf, 0, 1)
    hf = hf * hf * (3 - 2 * hf)                                                               # soft ends of the arc
    a = im[:, :, 3] * hf * smooth(0.0, 0.03, v) * (1 - smooth(0.8, 1.0, v))
    out = np.dstack([np.clip(rgb, 0, 1), a])
    Image.fromarray((out * 255).astype(np.uint8), 'RGBA').save(dst)
    print('wrote', dst, out.shape)


def fuji(src, dst):
    im = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255.0
    h, w, _ = im.shape
    v = (1.0 - (np.arange(h, dtype=np.float32) + 0.5) / h)[:, None]
    im[:, :, 3] *= smooth(0.0, 0.3, v) * 0.92                                                  # haze at the base
    Image.fromarray((np.clip(im, 0, 1) * 255).astype(np.uint8), 'RGBA').save(dst)
    print('wrote', dst, im.shape)


def tile(dst):
    """1 m x 1 m tile with 3 x 3 ceramic tiles (the glTF has no procedural brick node)"""
    n = 768
    rng = np.random.default_rng(13)
    out = np.zeros((n, n, 3), np.float32)
    c = n // 3
    for i in range(3):
        for j in range(3):
            shade = rng.uniform(0.92, 1.05)
            out[i * c:(i + 1) * c, j * c:(j + 1) * c] = np.array([0.72, 0.78, 0.80], np.float32) * shade
    g = 6
    for k in range(3):
        out[k * c:k * c + g, :] = (0.08, 0.09, 0.10)
        out[:, k * c:k * c + g] = (0.08, 0.09, 0.10)
    Image.fromarray((out * 255).astype(np.uint8), 'RGB').save(dst)


def fence(dst):
    """wire grid, one UV unit = 1 m = 2 x 2 cells of 0.5 m, line width 9 % of a cell (the v12 procedural fence)"""
    n = 256
    a = np.zeros((n, n), np.float32)
    cell = n // 2
    w = max(2, int(cell * 0.09))
    for k in range(2):
        a[k * cell:k * cell + w, :] = 1
        a[:, k * cell:k * cell + w] = 1
    out = np.zeros((n, n, 4), np.float32)
    out[..., :3] = (0.55, 0.60, 0.66)
    out[..., 3] = a
    Image.fromarray((out * 255).astype(np.uint8), 'RGBA').save(dst)


def screen(dst):
    """gantry big-screen: magenta to cyan with scanlines (the v12 procedural screen)"""
    w, h = 512, 256
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    t = np.clip(x * 0.6 + y * 0.4, 0, 1)
    c0, c1 = np.array([0.9, 0.05, 0.5]), np.array([0.05, 0.75, 1.0])
    rgb = c0[None, None, :] * (1 - t[..., None]) + c1[None, None, :] * t[..., None]
    scan = 0.65 + 0.35 * (np.sin(y * 2 * np.pi * 40) * 0.5 + 0.5)
    Image.fromarray((np.clip(rgb * scan[..., None], 0, 1) * 255).astype(np.uint8), 'RGB').save(dst)


if __name__ == '__main__':
    tile(T / 'v13_tunnel_tile.png')
    fence(T / 'v13_fence_grid.png')
    screen(T / 'v13_big_screen.png')
    P = T / 'panorama'
    arc(P / 'tokyo_skyline_night.png', P / 'tokyo_arc_night.png', False)
    arc(P / 'tokyo_skyline_day.png', P / 'tokyo_arc_day.png', True)
    fuji(T / 'mount_fuji_night_cutout_v1.png', T / 'tokyo_fuji_v13.png')
