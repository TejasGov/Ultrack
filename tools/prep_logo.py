"""Cut the Ultrack logo out of its square canvas for the track's signage.

python tools/prep_logo.py   ->  assets/brand/ultrack_logo_dark.png   (black ground: printed hoardings, posters, LED boards)
                                assets/brand/ultrack_logo_alpha.png  (black keyed to transparency: neon signs)
Source: Ultrack.png (the user's logo) in the project root.
"""
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "Ultrack.png")
OUT = os.path.join(ROOT, "assets", "brand")


def bbox(im, threshold=60):
    """Bounding box of everything brighter than the black ground."""
    mask = im.convert("L").point(lambda v: 255 if v > threshold else 0)
    return mask.getbbox()


def main():
    im = Image.open(SRC).convert("RGB")
    x0, y0, x1, y1 = bbox(im)
    pad = int((x1 - x0) * 0.05)
    box = (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
    logo = im.crop(box)
    w = 1536                                            # wide enough for a 12 m billboard, small enough for the web
    logo = logo.resize((w, round(logo.height * w / logo.width)), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    logo.save(os.path.join(OUT, "ultrack_logo_dark.png"))

    # neon: alpha from brightness (the ground is near-black), colour kept so the red accents stay red
    rgba = logo.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = px[x, y]
            a = max(0, min(255, int((max(r, g, b) - 25) * 255 / 90)))
            px[x, y] = (r, g, b, a)
    rgba.save(os.path.join(OUT, "ultrack_logo_alpha.png"))
    print("logo", logo.size, "aspect", round(logo.width / logo.height, 2), "->", OUT)


if __name__ == "__main__":
    main()
