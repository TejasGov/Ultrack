# Mojave Dry Lake: credits

| Asset | Author | Licence | Source | Used as |
|---|---|---|---|---|
| Airbus A320 Airliner | Kyaie | CC BY 4.0 | https://sketchfab.com/3d-models/airbus-a320-airliner-757aa190f27a407291187328d7125903 (downloaded 2026-11-01, `source/a320_kyaie/a320.glb`) | the boneyard airliners: rescaled to 37.6 m, re-materialled in bare metal, white, primer and faded paint, some engines removed |
| asphalt_track, brushed_concrete, concrete_wall_009, aerial_sand, painted_metal_shutter, grey_roof_01 | Poly Haven | CC0 | https://polyhaven.com (already in `assets/polyhaven/`) | road, runway, barriers, ground, hangars |
| goegap HDRI (4k) | Greg Zaal, Poly Haven | CC0 | https://polyhaven.com/a/goegap (downloaded 2026-11-01 to `assets/polyhaven/goegap/`) | `tex/backdrop_day.png`, `backdrop_dusk.png` (make_backdrop.py): 55 degrees of its distant range, sky cut to alpha, a graded dusk copy; the far backdrop arcs |
| `tex/asphalt_track_bleached_diff_2k.jpg` | derived here from Poly Haven asphalt_track | CC0 | lightened and desaturated (sharp `linear(1.7, 15)`), the sun-bleached road | road colour |
| `tex/aerial_sand_pale_diff_1k.jpg` | derived here from Poly Haven aerial_sand | CC0 | desaturated to 30 % and lightened (sharp `linear(1.05, 43)`): one neutral ground photo the vertex colours tone into sand and lake bed | ground colour |

The A320 is CC BY: the Credits screen names it (src/game/ui.js, Artwork; scripts/test-menu.mjs checks it) and `track.json` `credits` carries the line.
