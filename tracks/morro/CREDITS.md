# Morro Noturno: sources

Layout: our own, planned in plan_layout.py (a hillside neighbourhood over a city by a bay). A fictional circuit: no real neighbourhood, city or race is claimed.

Textures from Poly Haven (CC0), read from the main checkout's local library (assets/polyhaven), nothing downloaded for this track: worn_asphalt, concrete_wall_009,
red_laterite_soil_stones, dirty_concrete, coast_sand_01, brushed_concrete, medieval_red_brick, damaged_plaster, yellow_plaster, blue_plaster_weathered,
red_plaster_weathered, peeling_painted_wall, white_plaster_02, worn_plaster_wall, rusted_shutter, painted_metal_shutter, rusty_corrugated_iron;
the night sky in the review renders is qwantani_night_puresky.

Reused from other tracks: kerb paint (tracks/qingshan/tex/kerb_*), tyre wall and stand crowd sheet (tracks/qingshan/tex), debris fence and start lights (tracks/llano/tex).

## Generated art (ours)
- make_textures.py: lit rooms for the night windows, the shop signs (invented Portuguese shop names, rasterised from Windows fonts), the iron grille cut-out.
- make_decor_tex.py: the sponsor hoardings and the distance and corner boards, from the marks in assets/sponsors (manifest.json has each mark's source;
  this local fan prototype only, as the other tracks' boards), and Brazil's flag.
