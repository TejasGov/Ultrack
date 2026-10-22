"""Download the Poly Haven (CC0) assets the tracks use into assets/polyhaven/<id>/ and write CREDITS.md.

python tools/fetch_polyhaven.py        (re-running skips files already on disk)
"""
import http.client, json, os, sys, time, urllib.error, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..", "assets", "polyhaven")
API = "https://api.polyhaven.com"
UA = {"User-Agent": "RaceUltimate-asset-fetch"}

# id -> (resolution, maps). Textures keep only what glTF uses: base colour, OpenGL normal, ARM (= glTF ORM order).
TEXTURES = {
    "asphalt_track":     ("2k", ["Diffuse", "nor_gl", "arm"]),   # hero surface, closest to the camera
    "asphalt_pit_lane":  ("1k", ["Diffuse", "nor_gl", "arm"]),
    "coast_sand_01":     ("1k", ["Diffuse", "nor_gl", "arm"]),   # run-off sand
    "aerial_sand":       ("1k", ["Diffuse", "nor_gl", "arm"]),   # desert ground beyond the run-off
    "brushed_concrete":  ("1k", ["Diffuse", "nor_gl", "arm"]),   # walls, paddock, pit building
    "leafy_grass":       ("1k", ["Diffuse", "nor_gl", "arm"]),   # grass run-off and banks
}
MODELS = {"concrete_road_barrier": "1k", "street_lamp_01": "1k"}
HDRIS = {"qwantani_dusk_2_puresky": "2k", "qwantani_dusk_2": "1k",
         # the game's lighting looks: golden dusk, blue hour, night
         "belfast_sunset_puresky": "2k", "qwantani_dusk_1_puresky": "2k", "qwantani_night_puresky": "2k"}


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
        return json.load(r)


def download(url, dest):
    if os.path.exists(dest):
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    for attempt in range(4):   # the CDN throws occasional 5xx (520); retry with backoff
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r, open(tmp, "wb") as f:
                f.write(r.read())
            break
        except (OSError, http.client.HTTPException) as e:   # URLError/HTTPError/timeouts are OSErrors; IncompleteRead is not
            if attempt == 3 or (isinstance(e, urllib.error.HTTPError) and e.code < 500):
                raise
            time.sleep(2 ** attempt)
    os.replace(tmp, dest)
    print("  got", os.path.relpath(dest, ROOT))


def main():
    credits = []
    for aid, (res, maps) in TEXTURES.items():
        files = get_json(f"{API}/files/{aid}")
        for m in maps:
            url = files[m][res]["jpg"]["url"]
            download(url, os.path.join(ROOT, aid, os.path.basename(url)))
        credits.append(aid)
    for aid, res in MODELS.items():
        g = get_json(f"{API}/files/{aid}")["gltf"][res]["gltf"]
        download(g["url"], os.path.join(ROOT, aid, os.path.basename(g["url"])))
        for rel, inc in g.get("include", {}).items():   # .bin and textures, at the paths the .gltf expects
            download(inc["url"], os.path.join(ROOT, aid, *rel.split("/")))
        credits.append(aid)
    for aid, res in HDRIS.items():
        url = get_json(f"{API}/files/{aid}")["hdri"][res]["hdr"]["url"]
        download(url, os.path.join(ROOT, aid, os.path.basename(url)))
        credits.append(aid)

    lines = ["# Poly Haven assets", "", "All CC0 (public domain): https://polyhaven.com/license", ""]
    for aid in credits:
        info = get_json(f"{API}/info/{aid}")
        lines.append(f"- **{info['name']}** (`{aid}`) by {', '.join(info.get('authors', {}))}: https://polyhaven.com/a/{aid}")
    with open(os.path.join(ROOT, "CREDITS.md"), "w", encoding="utf8") as f:
        f.write("\n".join(lines) + "\n")
    print("done:", len(credits), "assets")


if __name__ == "__main__":
    sys.exit(main())
