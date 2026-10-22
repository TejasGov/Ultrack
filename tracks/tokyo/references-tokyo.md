# Tokyo architecture / night direction — 22 October 2026

The course remains a fictional composition based on the supplied map. Real districts guide architectural rhythm; landmark silhouettes establish Tokyo at a distance. They are not presented as a geographically accurate scan.

## Consulted references

- [GO TOKYO: Akihabara](https://www.gotokyo.org/en/destinations/central-tokyo/akihabara/) — electronics, games and hobby retail; layered tenant identity and busy commercial frontages.
- [GO TOKYO: Akihabara Electric Town](https://www.gotokyo.org/en/spot/55/index.html) — district context.
- [GO TOKYO: nightlife](https://www.gotokyo.org/en/see-and-do/nightlife/index.html) — Roppongi, Shibuya and Shinjuku night identity.
- [GO TOKYO: landmarks](https://www.gotokyo.org/en/see-and-do/attractions/landmarks/) — skyline reference selection.
- [Tokyo Tower: Towerpedia](https://en.tokyotower.co.jp/plan/towerpedia/) — 333 m tower scale and signature silhouette.
- [Tokyo Skytree: floor guide](https://www.tokyo-skytree.jp/floor/) — two observation stages around 350 and 450 m.
- Web image search references: Akihabara nighttime storefronts / Radio Kaikan, Tokyo Bay / Rainbow Bridge dusk panoramas. Images were viewed as architecture and composition references; search-result photographs were not copied into the game or used as texture assets.

## Adopted art direction

Akihabara / Shibuya / Shinjuku / Ginza receive denser surface-mounted signs, vertical stacks of Japanese glyphs, tenant directory boards, deep storefront eaves and lit shop fascia. The market, park and observatory zones remain quieter. The palette combines warm-white interiors, vermilion, rose, cyan and amber; it should retain dark structural separation and readable glyphs.

The current signage uses exact editable Japanese text: 電気街 (Electric Town), ゲーム (games), カラオケ (karaoke), 居酒屋 (izakaya), ラーメン (ramen), 薬局 (pharmacy), 喫茶店 (cafe), 寿司 (sushi), 東京 (Tokyo), 食堂 (restaurant). Source landmark Japanese names are retained. Stacked glyphs use words with no vertical punctuation. The font is the locally installed MS Gothic, with no standalone font copied into the project; use a suitable distributable font or bake approved lettering for shipped assets.

## Distant image / nearby geometry split

`textures/tokyo_skyline_original_bake.png` is an original 4096 × 1024 transparent Blender render. Its source scene is preserved separately inside the v2 Blender file. It contains approximate Tokyo Tower, Tokyo Skytree and Rainbow Bridge silhouettes, surrounded by a city window field. A single distant card uses two triangles in the main scene; source geometry does not render in that scene. Near and middle-distance mapped buildings remain 3D.

The card is suitable for the distant bay horizon. It is not suitable for driving alongside, close orbit cameras, interior views, or precise geographic reconstruction. Runtime still needs checks for projected pixel density, view-angle distortion, transparent overdraw, sunrise/night matching, reflection appearance and sightline coverage. Additional angular cards or a cylindrical bake can be introduced after the racing camera is locked. Do not substitute cards for near-camera architecture.

## Texture provenance

Existing project Poly Haven CC0 textures are reused: `asphalt_track`, `brushed_concrete`, `leafy_grass`, and `qwantani_dusk_1_puresky`. Credits remain in `assets/polyhaven/CREDITS.md`. Image textures and the skyline bake are packed into the v2 Blender source. The v1 study is preserved.

## Status

V2 is an architecture/signage/lighting study, not final art. Storefront glazing is a surface study, not a claim of modeled interiors. Source silhouettes are approximate authored geometry, not surveyed landmark models. All final layout/Form/runtime approvals remain pending; no paid generation, runtime export or game deployment occurred.

The visual review found an overlap between the large district identity and the new tenant directory. District identities were moved to the upper façade. The dusk HDRI is tinted and reduced for the blue-hour review so that sign lettering remains readable without washing out the structure. The verification script checks the actual saved scene, separate bake source, two-triangle card, packed images and Japanese font assignment; it does not certify final visual quality or game performance.
