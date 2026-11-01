"""Mojave Dry Lake backdrop: the horizon of the goegap HDRI (Poly Haven, CC0) its distant range cut into arcs, sky to alpha, as Tokyo's skyline arc.
    powershell -File ../india/run_blender_locked.ps1 -Script D:/RaceUltimate/tracks/drylake/make_backdrop.py
Writes tex/backdrop_day.png and tex/backdrop_dusk.png: 628 px (55 degrees) of the distant range, rows from BAND_LO to BAND_HI degrees of elevation
(the photo's horizon, v = 0.5 of the equirect, lands at BAND_LO / (BAND_LO + BAND_HI) of the band height). build_drylake.py maps them onto
a ring 6.5 km out; the ground hides everything under the horizon. The dusk copy is the day photo graded darker and warmer, with haze."""
import bpy, math
import numpy as np
from pathlib import Path

H = Path(r'D:/RaceUltimate/tracks/drylake'); SRC = H.parent.parent / 'assets' / 'polyhaven' / 'goegap' / 'goegap_4k.hdr'
BAND_LO, BAND_HI = 4.0, 14.0
img = bpy.data.images.load(str(SRC)); W, Hh = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(Hh, W, 4)[:, :, :3]     # row 0 is the bottom
per = Hh / 180.0
r0, r1 = int(Hh / 2 - BAND_LO * per), int(Hh / 2 + BAND_HI * per)
band = px[r0:r1]
lum = band @ np.array([0.2126, 0.7152, 0.0722], np.float32)
land = band[: int(BAND_LO * per) + 3]
expo = 0.42 / max(1e-4, float(np.median(land @ np.array([0.2126, 0.7152, 0.0722], np.float32))))   # the land lands at a mid tone
def tone(x): x = 1 - np.exp(-x * expo); return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.clip(x, 0, 1), 1 / 2.4) - 0.055)
# only the distant valley range is far away in this photo (the rest of the 360 is a hill, a tree and a hut beside the camera): cut that
# 55 degree stretch; build_drylake.py places it as separate arcs, alternate ones mirrored
C0, C1 = 1062, 1690
band = band[:, C0:C1]; W = C1 - C0
rgb = np.clip(tone(band), 0, 1)
# sky: walk each column down from the top, comparing with the sky just above (the sky lightens toward the horizon); land from the first
# two rows in a row that differ from it
h = band.shape[0]; alpha = np.ones((h, W), np.float32)
for c in range(W):
    ref = rgb[h - 1, c].copy(); edge = 0
    for rr in range(h - 2, 0, -1):
        d0, d1 = np.abs(rgb[rr, c] - ref).sum(), np.abs(rgb[rr - 1, c] - ref).sum()
        if d0 > 0.16 and d1 > 0.16: edge = rr; break
        ref = ref * 0.7 + rgb[rr, c] * 0.3
    alpha[edge + 1:, c] = 0.0
    alpha[edge, c] = 0.5
# the arc ends: the skyline tapers down to the horizon over the last 18 % (a range that slopes away, not a fading wall), then a short fade
ramp = np.clip(np.minimum(np.arange(W), W - 1 - np.arange(W)) / (0.18 * W), 0, 1); ramp = ramp * ramp * (3 - 2 * ramp)
hz = int(BAND_LO * per)
for c in range(W):
    top = int(hz + 2 + ramp[c] * (h - hz)); alpha[top:, c] = 0.0
alpha *= np.clip(np.minimum(np.arange(W), W - 1 - np.arange(W)) / (0.03 * W), 0, 1)[None, :]
def save(name, rgbx):
    out = np.dstack([rgbx, alpha]).astype(np.float32)
    im = bpy.data.images.new(name, W, h, alpha=True); im.pixels[:] = out.ravel()
    im.filepath_raw = str(H / 'tex' / f'{name}.png'); im.file_format = 'PNG'; im.save()
    print('[backdrop]', name, W, 'x', h, 'skyline mean row', round(float((alpha > 0).sum(0).mean()), 1), 'of', h, flush=True)
rgb = rgb * 0.6 + np.array([0.74, 0.79, 0.86], np.float32) * 0.4     # distance: 6.5 km of air between the range and the track
save('backdrop_day', rgb)
haze = np.array([0.42, 0.33, 0.36], np.float32)          # the dusk sky's tone near the horizon
dusk = rgb * np.array([0.55, 0.36, 0.3], np.float32)
dusk = dusk * 0.6 + haze * 0.4 * np.linspace(1.0, 0.6, h, dtype=np.float32)[:, None, None]
save('backdrop_dusk', np.clip(dusk, 0, 1))
print('[backdrop] done', flush=True)
