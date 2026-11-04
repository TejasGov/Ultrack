"""Venice's lit rooms, for the night-only window shell (build_venice.py lit_window): eight kinds of room in two brightnesses, 8 x 2 cells of 128 x 256. Writes tex/window_night.png. Run once with system Python: python make_night_windows.py
Which kind a window gets is random, and each can be mirrored, so runs of windows never repeat. The glazing bars are painted in: the shell sits in front of the real ones."""
from pathlib import Path
import numpy as np
from PIL import Image
CW, CH = 128, 256
A = np.zeros((CH * 2, CW * 8, 3), np.float32); yy, xx = np.mgrid[0:CH, 0:CW]; u, v = xx / (CW - 1), 1 - yy / (CH - 1)     # v 1 at the window's head
TONE = [(1.0, 0.68, 0.36), (1.0, 0.62, 0.3), (1.0, 0.55, 0.24), (1.0, 0.72, 0.44), (1.0, 0.66, 0.34), (1.0, 0.7, 0.42), (0.94, 0.86, 0.7), (1.0, 0.48, 0.2)]
rs = np.random.RandomState(11)
for row, gain in ((0, 1.0), (1, 0.5)):
    for k in range(8):
        L = (0.42 + 0.58 * np.clip(v * 1.2, 0, 1) ** 1.5) * (0.72 + 0.28 * np.sin(u * np.pi))     # light from the ceiling, dimmer at the sides
        blot = np.array(Image.fromarray((rs.rand(6, 4) * 255).astype(np.uint8)).resize((CW, CH), Image.BICUBIC), np.float32) / 255; L = L * (0.8 + 0.4 * blot)      # a room is never an even sheet
        if k == 1:      # curtains drawn to both sides
            d = np.minimum(u, 1 - u); c = np.clip((d - 0.2) / 0.06, 0, 1); L = L * (c + (1 - c) * (0.62 + 0.2 * np.sin(u * 70)))
        elif k == 2:    # one lamp low in a corner of a dim room
            L = 0.14 * L + 1.2 * np.exp(-(((u - 0.72) / 0.34) ** 2 + ((v - 0.3) / 0.3) ** 2))
        elif k == 3:    # a blind part way down
            L = L * np.where(v > 0.62, 0.3, 1.0)
        elif k == 4:    # shutters closed: slits of light between dark slats
            L = L * (0.05 + 0.75 * (np.sin(v * 150) > 0.72))
        elif k == 5:    # a sheer curtain
            L = L * (0.8 + 0.12 * np.sin(u * 52 + 1.5 * np.sin(v * 9)))
        elif k == 7:    # a deep, dim room
            L = L * 0.62
        if k != 4:
            bars = (np.abs(u - 0.5) < 0.018) | (np.abs(v - 0.36) < 0.009) | (np.abs(v - 0.7) < 0.009) | (u < 0.03) | (u > 0.97) | (v < 0.015) | (v > 0.985)
            L = np.where(bars, L * 0.07, L)
        for ch in range(3): A[row * CH:(row + 1) * CH, k * CW:(k + 1) * CW, ch] = np.clip(L * gain * TONE[k][ch], 0, 1)
Image.fromarray((A ** (1 / 2.2) * 255).astype(np.uint8)).save(Path(__file__).parent / 'tex' / 'window_night.png')
