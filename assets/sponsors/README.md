# Venue logo artwork

Original logo artwork added for the user's local noncommercial Ultrack fan project
on 2026-10-20. These marks identify their respective owners; they are not Ultrack
branding and do not imply sponsorship or endorsement. Noncommercial use is not
recorded here as a blanket license grant.

| Former venue alias | Displayed brand | Artwork source |
| --- | --- | --- |
| VOLTRAVA | Red Bull | Simple Icons |
| KESTROVA | Pirelli | Pirelli official website |
| AZURINE | Emirates | Simple Icons |
| MERIDAX | HSBC | Simple Icons |
| DUNEFIZZ | Coca-Cola | Simple Icons |
| HALCYRA | Rolex | Wikimedia Commons, source Rolex SA |
| ORVANE | Shell | Simple Icons |

Car-brand boards use original Ferrari, McLaren, Lamborghini, Porsche, Aston Martin,
Bugatti, Mercedes-AMG and BMW M artwork from the
[car-logos-dataset](https://github.com/filippofilip95/car-logos-dataset).
The other vector collection is [Simple Icons](https://github.com/simple-icons/simple-icons).
Pirelli's source is [its official logo asset](https://www.pirelli.com/global/en-ww/assets/images/pirelli-logo.png).
Rolex uses the [original wordmark file](https://commons.wikimedia.org/wiki/File:Rolex_wordmark_logo.svg).

`manifest.json` records the exact download URL and SHA-256 of each retained source.
`sources/` holds originals; `logos/` contains normalized local PNGs; `boards/`
contains aspect-correct compositions. Logos retain their shape; light backgrounds
are used where the supplied black wordmarks need contrast. No runtime CDN is used.

Saetta's title sponsor is **Ray-Ban**, using the original artwork from the
[EssilorLuxottica Vision Source brand guide](https://visionsourceshowcase.luxottica.com/ray-ban-2/).
The retained JPG includes a footer; `sourceCrop` in the manifest selects the logo
panel for the normalized texture. This mark is used on team liveries and garage
headers (`usage: team-sponsor`, `venue: false`); the existing venue boards retain
their own brands. Liberty keeps Coca-Cola. Source URL and SHA-256 are recorded
alongside the other artwork.

The existing source venue was updated through `scripts/apply-venue-logos.py`:
67 shared mesh definitions / 349 placed sign instances were replaced, preserving
their object transforms. Coverage includes fence/LED boards, grandstand fascia,
billboards, bridge/gantry banners, pole banners and run-off paint. Ultrack and
Corniche Marina's own branding remains. Collision geometry is untouched.

`tracks/marina/brand_art.py` also supplies these assets to future source builds.
Both WebP and KTX2 exports contain the artwork. `test:sponsors` verifies all 15
brands, source hashes, UVs and removal of the former sponsor lettering.

## Sony (Hayate's title sponsor) and the reusable Sony boards

- **Source:** the Sony wordmark SVG, [Wikimedia Commons "File:Sony_logo.svg"](https://commons.wikimedia.org/wiki/File:Sony_logo.svg),
  downloaded from `https://upload.wikimedia.org/wikipedia/commons/c/ca/Sony_logo.svg` on 2026-10-22 (retained as `sources/sony.svg`; the SHA-256 is in
  `manifest.json` and the SHA-1 matches Commons). Commons tags it **public domain** (a text logo below the threshold of originality, "Restrictions: trademarked");
  the wordmark is by Yasuo Kuroki for Sony (1973). It remains a **Sony Group Corporation trademark**: used on a local noncommercial fan project, no endorsement implied.
  Manifest entry `sony` (`usage: team-sponsor`, `venue: false`, alias `ソニー`): on liveries and garages, outside the 15-brand replaced-boards count.
- **Board set:** `boards/sony-<aspect>.png`, aspect = round(width / height * 1000), the key brand_art.py uses: 324 and 389 (vertical pole banners, 1.1x3.4 and 0.7x1.8 m),
  1600 (3:2 flag), 3000 (12x4 hoarding/billboard), 3111 (14x4.5), 6000 (6x1 fence/LED board), 8571 (12x1.4 fascia / pit-wall board), 10833 and 11818 (26x2.4 and 26x2.2 bridge/gantry
  banners), 15000 (24x1.6 footbridge banner). White panel, black wordmark, repeated across wide boards; 1024 px wide (2048 for aspect >= 8).
  Also `logos/sony.png` (512 px, transparent). Regenerate, or make the same set for another brand with a source SVG: `node track-viewer/scripts/make-sponsor-boards.mjs sony [aspect ...]`.
- **Placing them on a map** (Blender, as `tracks/marina/add_hayate.py` does):
  ```python
  sys.path.insert(0, 'tracks/marina'); import brand_art
  sony = next(b for b in brand_art.BRANDS if b['id'] == 'sony')
  obj.data = brand_art.board_mesh('sony_12x4', sony, 12, 4)       # w, h in metres; the matching boards/sony-<aspect>.png is used
  # LED board: board_mesh(name, sony, 6, 1, False, True); flat paint on the ground: board_mesh(name, sony, w, h, True)
  ```
  A ratio that is not in the list needs its aspect added to `ASPECTS` in make-sponsor-boards.mjs and a rerun. Swapping an existing board's `.data` keeps its transform and sharing;
  on a new map create the object and make the same call.
- **On the Marina** (`tracks/marina/add_hayate.py`): six LED bands, a fascia and two pole banners across the pit lane from boxes 8-11, hoardings 011 and 014 on the main straight,
  the T1 billboard, the footbridge banner and one T1 gantry banner. The sponsor panel is also painted on Hayate's garage header and pit box (`src/teamdress.js`, now for every team's pit box) and on the cars (`src/livery.js`).

## India's brands (location-specific)

Each track can carry its own brands: `brands` in `track-viewer/src/tracks.js` maps a GLB board material to an image of the same
aspect in that track's `ads/` folder (applied in `main.js` after the venue loads). India's long Sony boards and the gantry banner
carry **Jio**; its 3:1 Sony boards stay Sony. `venue/india.js` adds **OPPO** and **vivo** boards on four city façades and one
roadside **BJP** hoarding on the city approach. All four are `usage: venue-india`, `venue: false` (outside Marina's 15).

- Jio, OPPO, vivo: Simple Icons SVGs (`sources/jio.svg`, `oppo.svg`, `vivo.svg`), downloaded 2026-10-30 with the user's OK; brand
  hex from Simple Icons' data (Jio #0A2885, OPPO #2D683D, vivo #415FFF). Boards by `make-sponsor-boards.mjs` (which now applies `ink`).
- BJP: the lotus emblem, Wikimedia Commons "File:Logo of the Bharatiya Janata Party.svg" (public domain, trademarked), and the PM's
  official portrait, Commons "File:Official portrait of the Prime Minister Narendra Modi, November 2020 (cropped).jpg" (1280 px
  rendition, GODL-India). The hoarding is composed by `track-viewer/scripts/make-india-hoarding.mjs`.

These marks and the portrait belong to their owners; used on a local noncommercial fan project, no endorsement implied.
