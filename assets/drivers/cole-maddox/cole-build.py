"""Rebuild Cole Maddox's poster from the untouched centrally generated art."""
from pathlib import Path
import base64
import hashlib
import json
import shutil
import subprocess

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SRC = OUT / "source/illustration-v1.png"
assert SRC.exists(), "Wait for the centrally generated source at source/illustration-v1.png"

teams = json.loads((ROOT / "assets/teams/teams.json").read_text(encoding="utf8"))["teams"]
team = next(t for t in teams if t["id"] == "liberty")
entry = next(c for c in team["cars"] if c["key"] == "mustang")
driver = entry["driver"]
cars = json.loads((ROOT / "assets/cars/specs.json").read_text(encoding="utf8"))["cars"]
car_model = cars[entry["key"]]["model"]
assert (driver["name"], driver["nation"], driver["age"], entry["number"], car_model, team["sponsor"]) == (
    "Cole Maddox", "USA", 30, 66, "Ford Mustang GT (2018)", "Coca-Cola"
)

font_dir = ROOT / "track-viewer/public/assets/fonts"
team_font = TTFont(font_dir / team["font"]["file"])
info_font = TTFont(font_dir / "barlow-condensed-latin-700-normal.woff2")


def text_path(txt, x, baseline, height, color, which="team", maxwidth=1200, spacing=0):
    font = team_font if which == "team" else info_font
    glyphset, cmap = font.getGlyphSet(), font.getBestCmap()
    advance, glyphs, bounds = 0, [], BoundsPen(font.getGlyphSet())
    for char in txt:
        name = cmap.get(ord(char), cmap.get(ord("-")))
        glyphs.append((name, advance))
        glyphset[name].draw(TransformPen(bounds, (1, 0, 0, 1, advance, 0)))
        advance += font["hmtx"][name][0] + spacing * font["head"].unitsPerEm
    x0, y0, x1, y1 = bounds.bounds
    scale = min(height / (y1 - y0), maxwidth / (x1 - x0))
    pen = SVGPathPen(glyphset)
    for name, offset in glyphs:
        glyphset[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x + (offset - x0) * scale, baseline + y0 * scale)))
    faux_bold = team["font"].get("bold", 0) if which == "team" else 0
    stroke = f' stroke="{color}" stroke-width="{font["head"].unitsPerEm * scale * faux_bold:.3f}" stroke-linejoin="round"' if faux_bold else ""
    return f'<path fill="{color}"{stroke} d="{pen.getCommands()}"/>'


def data(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(Path(path).read_bytes()).decode("ascii")


art = data(SRC, "image/png")
team_logo = data(ROOT / "assets/teams/logos/liberty-lockup-onLight.svg", "image/svg+xml")
coke = data(ROOT / "assets/sponsors/logos/cocacola.png", "image/png")
blue, red, white = team["colors"]["primary"], team["colors"]["secondary"], team["colors"]["accent"]
ink, paper = "#111827", "#f4f4f2"
parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><title>Cole Maddox — Liberty number 66</title><desc>Original inked cel-shaded driver introduction illustration featuring Cole Maddox and a Liberty Ford Mustang GT (2018).</desc>',
    f'<image href="{art}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/>',
    f'<defs><linearGradient id="leftFade" x1="0" x2="1"><stop stop-color="{paper}" stop-opacity=".99"/><stop offset=".83" stop-color="{paper}" stop-opacity=".96"/><stop offset="1" stop-color="{paper}" stop-opacity=".88"/></linearGradient></defs>',
    f'<path d="M0 0H760L855 1080H0Z" fill="url(#leftFade)"/>',
    f'<path d="M0 1016L793 0h65L64 1080H0Z" fill="{blue}" opacity=".08"/>',
    f'<image href="{team_logo}" x="76" y="44" width="304" height="72" preserveAspectRatio="xMinYMid meet"/>',
    text_path("PHILADELPHIA, PENNSYLVANIA  /  LIBERTY RACING", 78, 151, 14, ink, "info", 585, .035),
    f'<path d="M78 205h76v6H78Z" fill="{red}"/>',
    text_path("COLE", 68, 325, 78, ink, maxwidth=510),
    text_path("MADDOX", 62, 442, 86, red, maxwidth=640),
    text_path("THE BRAWLER", 80, 500, 21, ink, "info", 550, .055),
    text_path("DRIVES EVERY LAP LIKE THE LAST ONE.", 80, 555, 20, ink, "info", 615, .025),
    f'<path d="M78 601h400v1h-400Z" fill="{ink}" opacity=".30"/>',
    f'<path d="M78 656h84v88H78Z" fill="{blue}"/>',
    text_path("66", 91, 725, 52, white, maxwidth=62),
    text_path("USA", 183, 686, 20, ink, "info", 210, .06),
    text_path("30 YEARS OLD", 183, 724, 17, ink, "info", 260, .045),
    text_path("COWBOY BOOTS. NO FILTER. BIG HEART.", 80, 785, 16, ink, "info", 515, .03),
    f'<path d="M78 820h518v178H78Z" fill="{ink}"/>',
    text_path("THE MACHINE", 98, 849, 12, white, "info", 200, .07),
    text_path("FORD", 98, 896, 26, white, "info", 145, .04),
    text_path("MUSTANG GT", 98, 938, 31, white, maxwidth=360),
    text_path("2018  /  FRONT-ENGINE V8", 98, 974, 13, white, "info", 350, .04),
    f'<path d="M1620 44h224v153h-224Z" fill="{red}"/>',
    text_path("TITLE PARTNER", 1640, 72, 11, white, "info", 180, .07),
    f'<image href="{coke}" x="1643" y="87" width="179" height="85" preserveAspectRatio="xMidYMid meet"/>',
    text_path("ULTRACK  /  DRIVER INTRO", 1585, 1038, 13, white, "info", 280, .08),
    f'<path d="M0 0h1920v1080H0Z" fill="none" stroke="{red}" stroke-width="3"/>',
    "</svg>",
]
svg = "".join(parts)
(OUT / "poster-v1.svg").write_text(svg, encoding="utf8")

source_hash = hashlib.sha256(SRC.read_bytes()).hexdigest()
meta = {
    "schemaVersion": 1,
    "status": "awaiting-user-style-approval",
    "driver": driver,
    "team": team["id"],
    "raceNumber": entry["number"],
    "carKey": entry["key"],
    "titleSponsor": team["sponsor"],
    "font": team["font"],
    "manufacturer": "Ford",
    "car": "Mustang GT (2018)",
    "style": "Original fictional adult driver in inked, cel-shaded GTA V loading-screen-inspired illustration; no real driver likeness.",
    "illustration": "illustration-v1.webp",
    "sourceIllustration": "source/illustration-v1.png",
    "sourceSha256": source_hash,
    "generationCalls": 1,
    "composition": "1920x1080 static driver poster; team lettering uses the canonical outlined Graduate font and source artwork and logo assets are embedded for portability.",
    "outputs": {},
}
(OUT / "intro.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf8")

Image.open(SRC).convert("RGB").save(OUT / "illustration-v1.webp", "WEBP", quality=83, method=6)
node = shutil.which("node")
if not node:
    raise RuntimeError("Node.js is required to render the poster (Sharp is resolved from track-viewer).")
svg_path = str(OUT / "poster-v1.svg")
png_path = str(OUT / "poster-v1.png")
js = (
    "const sharp=require(require.resolve('sharp',{paths:["
    + json.dumps(str(ROOT / "track-viewer"))
    + "]})); sharp(" + json.dumps(svg_path)
    + ",{density:72}).resize(1920,1080).png({compressionLevel:8}).toFile("
    + json.dumps(png_path)
    + ").then(()=>console.log('Rendered Cole Maddox poster.')).catch(e=>{console.error(e);process.exit(1)});"
)
subprocess.run([node, "-e", js], cwd=ROOT, check=True)
meta["outputs"] = {
    name: {"sha256": hashlib.sha256((OUT / name).read_bytes()).hexdigest()}
    for name in ("poster-v1.png", "poster-v1.svg")
}
(OUT / "intro.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
print("sourceSha256:", source_hash)
print("poster/png:", (OUT / "poster-v1.png").stat().st_size, "bytes")
print("source/webp:", (OUT / "illustration-v1.webp").stat().st_size, "bytes")
