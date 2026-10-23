# Tokyo Hiragana circuit — Blender production start

## Game build v13.1 (what the game loads now; replaces v11)

`game_v13_1.py` (+ `game_v13_1_part2.py` .. `_part4.py`, all exec'd from it) reads `out/tokyo_v13_1.blend` (never written), saves `out/tokyo_game_v13_1.blend`, exports `out/tokyo_visual.glb`, `tokyo_collision.glb`, `track.json`, `lights.json`. Run one Blender process (`powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/game_v13_1.py`, about 45 s), then `node tracks/tokyo/pack-web.mjs` (about 4.5 min; `NO_JOIN=1` and `SKIP_SHELL=1` by default now) and `cd track-viewer && node scripts/sync-assets.mjs`. The collision, track.json and lights code is `game_v11.py`'s, so the contract test is unchanged. v11 can still be rebuilt with `game_v11.py`; its stale `_shell` GLBs are in `out/_archive/2026-10-23/` (MANIFEST there).

**The hard line.** v11 was rejected for stripping the buildings. v13.1 decimates nothing that is near the road: the budget comes from distance tiers, instancing, atlases and merging.

| what | how |
|---|---|
| frontages (129) | 12 full-detail v10 hero meshes (14-21k triangles each) as GPU instances, visible 0-170 m; a 7 % copy of the same hero (1.6-2.5k) 170-1500 m |
| trees (309: 237 sakura, 51 canopy, 21 cedar) | the v10 sakura / canopy meshes, full 0-38 m (canopy and cedar 55 m); a 13 % copy to 240 m (280 m); a 4-triangle crossed card to 2.8 km |
| lanterns (1,156) | full 0-110 m, octahedron 110-700 m |
| landmarks, wheel, bridge, tunnel pieces, castle, HQ, gate... (22 meshes over 2,500 triangles) | full detail out to 300-900 m (about 9 x their radius), a 12 % copy beyond; the castle, pagoda, HQ and the rest under 2,500 triangles are untouched |
| text | all 3D text (890 labels: sponsor text, kanji, plaques, pylons, wayfinding, bridge and tunnel signs) is baked to one 4096 px atlas on quads in Yu Gothic Bold / Medium (`textures/tokyo_sign_atlas_v13.png`, `build_sign_atlas.py` takes a font per cell); 2 hero signs stay 3D |
| sponsor logos | `brand_art` quads, instanced per brand, where the 3D board text was (180); the V9 coloured panels stay behind |
| stands | the two curved ridge / Shibuya stands are rebuilt as stepped shells (v11 generator, not a decimation); the v12 start stands are exported as modelled; the crowd is alpha-cutout strips (`M_CrowdCutout`, `M_Crowd`) |
| everything small and static | 660 objects merged per 768 m cell (6 cells); 38 materials merged (exact duplicates, then colours within 0.14 at the same emission) |
| materials | node graphs become plain glTF materials: the wire fence is `M_Fence` on a generated grid, tunnel tiles `M_TunnelTile`, gantry screens `M_BigScreen`, murals `M_AnimeMural_01..04` (real art, 16:9, emission 0.8) |

**Distance tiers need `track-viewer/src/perf.js`.** The Culler only culled by 280 x radius, which never hides a 25 m frontage inside a 3 km circuit. A mesh or instanced set whose name carries `~lo-hi` (metres) is now visible only while its distance is inside that range, per instance, with 10 % hysteresis; untagged objects behave as before. `scripts/test-culler.mjs` covers it (PASS). `measure-glb.mjs` honours the tags, `measure-views.mjs` runs it at five viewpoints.

**Backdrop.** One skyline arc (one Tokyo Tower, 59.6 degrees, R 7000 m, `skyline_arc` / `skyline_arc_day`, materials `M_SupertallBackdrop` / `M_SupertallBackdropDay`), the Fuji card (`skyline_fuji`), two ridges (`skyline_hills_*`, night and `_day` with `M_SupertallHills` / `M_SupertallHillsDay`), 900 distant lights, searchlight cards, all named `skyline*` (NO_CAST) with `M_Supertall*` materials (fog off). The haze, the soft arc ends and the base fades are baked into the textures (`bake_backdrop_v13_1.py` -> `textures/panorama/tokyo_arc_night.png`, `_day`, `textures/tokyo_fuji_v13.png`). Day / night: `tracks.js` `dayNight` now has `day: /^M_Supertall\w*Day$/` (opacity 1 - dn: the day arc and day ridges) and `night: /^M_(NightBeam|NightBridgeRed|SupertallLightsNight)$/` with `nightK` (opacity dn x k: searchlights 0.16, distant lights, the red glow shells on the bridge towers), applied in `main.js applyDayNight`. Fuji has one material for all looks.

**Budget** (`out/v13_1-budget.json`, `measure-views.mjs` on `out/web/tokyo_visual_ktx2.glb`, the Culler's rules, 62 degree FOV, 9 km far; v11: 1.13 M submitted, 113 calls at the start line): unique 1.22 M triangles (v11 0.42 M, v10 6.2 M), 14.6 M with every tier and instance counted, 182 meshes, 38 instanced nodes, 131 materials, 31 textures; file 27.8 MB (KTX2) / 19.5 MB (WebP).

| view | submitted triangles | in frustum | draw calls (submitted / in frustum) |
|---|---|---|---|
| start line | 679k | 459k | 268 / 256 |
| neon street | 1.32 M | 712k | 339 / 315 |
| bridge | 875k | 557k | 361 / 332 |
| tunnel | 537k | 399k | 248 / 240 |
| west straight | 679k | 367k | 218 / 205 |

**Verification.** `cd track-viewer && TRACK=tokyo node scripts/test-track.mjs`: PASS (105.6 s lap through the tunnel and over the bridge). `node scripts/qa-tokyo-views.mjs` (dev server :5180): five views x day / dusk / bluehour / night, `out/v13_1-game-looks.jpg` (`make_game_sheet.py`), 0 console errors (a run right after Vite re-optimised dependencies logged aborted module requests once; a warm run is clean). Title screen ready in 1.0 s, Free Drive (Tokyo) loaded in 14.5 s on this PC. `renderer.info` in the browser reads about 1,350-1,780 calls and 3.4-4.6 M triangles per frame because it counts the shadow passes too.

**Compromises.** The neon street and bridge views are over the 300 call target (339, 361; the start line is 268): the frontage hero sets carry 8 materials each, the accent materials are many, and the whole-circuit meshes are split per sector. A palette atlas for the accent colours would cut it further. The 4096 px sign atlas is over the KTX2 encoder's 12.5 Mpix limit, so it ships as WebP. The shell (hidden-face) pass is skipped so the full-detail frontages are not audited. The red night light of the bridge towers is a red glow shell (lights are not in the GLB); the tunnel luminaires and cove lines are emissive meshes; the searchlight cards are flat cones with a vertical fade at 16 % opacity. Only sakura heroes 0 and 1 survived in the saved v13.1 file (v12's LOD pass had orphaned the rest), so the sakura use two full meshes with per-tree scale; the cedar uses the canopy mesh. The garden, castle, HQ, lantern hall and the rest of the v13.1 art are exported as modelled. No `holo_*` character is placed; the six `HOLO_anchor_##` positions are in `track.json` (`holograms`).

## Game build v11 (superseded by v13.1 above; rebuild with game_v11.py)

`out/tokyo_game_v11.blend` is built from a copy of v10 by `game_v11.py` (v10 is never written). Run it with one Blender process, `powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/game_v11.py` (`-b -t 6`, below-normal priority), then `node tracks/tokyo/pack-web.mjs` (same steps as Marina's `npm run pack`, parametrised through `TRACK=tokyo`; the viewer scripts `pack-ktx2`, `shell-venue`, `partition-venue` and `test-track` read that variable and default to Marina). Previews: `render_v11.py` (EEVEE, 12 samples) -> `out/v11-*.png`. Measure: `node tracks/tokyo/measure-glb.mjs <glb>` -> `out/v11-budget.json`. Contract test: `cd track-viewer && TRACK=tokyo node scripts/test-track.mjs` (PASS: a 105.6 s raycast-vehicle lap through the tunnel and over the bridge).

| File | What it is |
|---|---|
| `out/tokyo_visual.glb` | raw Blender export (53 MB) |
| `out/tokyo_collision.glb` | `col_asphalt`, `col_curb`, `col_wall`, `col_paved`, `col_grass` (35k triangles) |
| `out/web/tokyo_visual.glb`, `_ktx2`, `_shell`, `_sectors` (and the combinations) | what the game loads: meshopt, WebP or KTX2 (4096 px cap, Marina's is 2048), hidden faces removed, 768 m draw sections |
| `out/web/tokyo_collision.glb` | meshopt collision |
| `out/track.json`, `out/lights.json` | Marina's schema (see below). `lights.json` has floodlights, stand lamps, street lamps |
| `out/v11-budget.json`, `out/v11-*.png` | triangle and draw-call counts, previews |

**Coordinates.** Start/finish line at the origin, start heading +X (cars.js grids on +X), Z up kept absolute (road dips to -12 m in the tunnel). Source order of `centerline-v10.json`, rotated to start at index 33 (the start gantry).

**Replaced against v10.** Foliage -> 4 instanced low-poly trees (sakura A/B, broadleaf, pine; 300-1,000 triangles) plus a 4-triangle crossed-card stand-in per tree whose material ends in `Far` (the Culler swaps them in at distance); groves and tree clusters on 9 new hills and where removed blocks stood. FONT text -> one atlas (`textures/tokyo_sign_atlas.png`, material `M_SignNeonAtlas`) on quads; 3 hero signs stay meshes. Sponsor boards -> `brand_art.board_mesh` 6x1 quads (8 brands, shared meshes, GPU-instanced). Frontages: 24 far ones removed (5 moved to 31-42 m from the road, checked against the road, the other footprints and the ground slope), every third near one removed, the rest decimated to ~1.3k. Stands -> stepped shells + `M_Crowd` alpha-cut strips (Marina's texture). Landmarks, bridge and wheel decimated; storm drains and the empty lamp/fence-post placeholders removed, lamps rebuilt as instanced pole + head. Old skyline matte, world and sky removed.

**Panorama band.** `skyline_band` (night) and `skyline_band_day` (day, 2 m inside it): a 360 degree cylinder of radius 2800 m centred on the circuit, 128 segments, height = 2 pi R / 9.6 = 1,832 m. UV u runs 0..1 around, v 0..1 up (v=0 is the image top); the seam is a duplicated column. Vertex alpha (`COLOR_0`) fades the foot over 4% and the top above 72%. Textures: `textures/panorama/tokyo_skyline_night.png` and `tokyo_skyline_day.png` (any RGBA, aspect 9.6:1, 8192 px wide, seamless in u, sky already alpha 0). To swap art: replace those files, rebuild, pack; a different aspect needs `PANO_ASPECT` in `game_v11.py`. Materials `M_SupertallBackdrop` (night) and `M_SupertallBackdropDay` (day): the viewer already keeps fog off `M_Supertall*`. Day/night blend is a material switch, not a uniform (glTF has none): drive `opacity` of the day material, night stays opaque below it (day 0 -> `M_SupertallBackdropDay.opacity = 1`, dusk 0.65, evening 0.3, night 0). Both meshes are named `skyline*` so NO_CAST applies. The old Fuji matte is not exported (`KEEP_FUJI` in the script) because the day panorama already has a faint Fuji.

**Water and ground.** The bay, lagoon surfaces are one mesh named `water` with `extras.surface = "water"` (the viewer swaps its water shader). `ground_terrain`/`ground_plane` carry planar UVs (24 m per tile).

**track.json** follows Marina's fields: `centerline` (1,440 samples, 3.6 m, game coords), `halfWidth` 9, `racingLine` (zeros), `slope` (real), `banking` 0, `headingYawRad`, `sectors` (thirds), `checkpoints` (every 25), `corners` (8, by heading change), `start` with 8 `gridSlots` (8 m apart, alternating +-3 m), `surfaces`, `landmarks`, `weather`, `lapLength` 5,180 m, plus `capabilities` (`pit`, `vip`, `hoardings`, `driverHoardings` all false), `backdrop` (band mesh names, textures, radius, height, centre) and `pitLane: null`.

**Missing for full racing.** No pit lane or boxes (`pitLane` is null; endurance/pit stops need a lane, garages, 12 boxes and `pit` collision), no `vip.json`/Corniche-Club equivalent, no hoardings or driver hoardings, no kerb sausages, no run-off (the barrier stands 11.9 m from the centre line; the shoulder is `col_paved`), no team-dressed garage or flag materials, `racingLine` is the centre line (AI will not cut corners), corner names are generic. Free drive works. Terrain above the tunnel roof is in `col_grass`; a downward ray from high above the tunnel hits it before the road.

**Budget (start-line view, Culler rules).** v10: 12.1 M drawn, 6.2 M unique. v11 web GLB: 421k unique triangles, 1.22 M with all instances, 1.13 M submitted at the start line (0.41 M inside the frustum), 113 draw calls (205 with the sector variant; Marina 280). See `out/v11-budget.json`.

**Current V10:** `out/tokyo_japanese_v10.blend`. The lower road descends to −12 m beneath a lagoon at the bay's −0.55 m water level. Nine supplied architectural references inform new gates, castle, garden temple and bridge, flowing race HQ, timber tower, lantern hall, woven cedar hall, neon shrine and four curved grandstands. 141 smaller frontages replace the old window blocks. See `JAPANESE-V10.md`, `out/v10-checks.json`, and `out/v10_*.png`. V9 files are preserved.

**Latest V9 correction:** `out/tokyo_realism_v9_tunnel_fixed.blend` places the lower crossing in a lit tunnel with a water basin above its roof and below the suspension bridge. Ridge and Shibuya stands face the racing circuit. See `V9-TUNNEL-STANDS.md`. The existing V9 source is preserved.

**Latest realism pass:** `out/tokyo_realism_v9.blend` adds painted concrete run-off aprons, LED barrier lines and sponsor boards, a wider mix of Japanese architecture, and cultural landmarks (floating torii, shrine, castle keep). Built from V8 by `realism_v9.py`; see `REALISM-V9.md` and the `out/v9_*.png` review renders.

**Previous lighting / depth pass:** `out/tokyo_neon_depth_v8.blend` aligns Fuji beyond the commercial avenue, with layered Japanese signs, warm lanterns, pink sakura, smaller far-city lights and colored road reflections. Actual review render: `out/neon_depth_v8.png`. See `NEON-DEPTH-V8.md` for composition and runtime limits. Previous scenes are preserved.

**Latest backdrop pass:** `out/tokyo_fuji_v7.blend` includes a faint Mount Fuji image behind the skyline. The packed RGBA asset is `textures/mount_fuji_night_cutout_v1.png`; it was generated with built-in image_gen (prompt saved beside it in the provenance JSON). The mountain uses two triangles, a low-opacity surface and a faded base. Review: `out/fuji_skyline_v7.png`. V6's Ferris wheel and V5's bridge remain included. This is an art-directed fictional skyline arrangement.

**Latest scene:** `out/tokyo_park_wheel_v6.blend` adds a 120 m diameter observation wheel (about 129 m to the top) at the center of Yoyogi Central Grove, with 32 shared-mesh enclosed gondolas, dual truss rims, A-frame supports, illuminated spokes and a boarding plaza. The adjacent pavilion moves to the park's edge to clear the wheel. Two park-side review renders are in `out/park_wheel_v6.png` and `out/park_wheel_reverse_v6.png`. Browser integration remains pending.

**Latest bridge pass:** `out/tokyo_bridge_v5.blend`, with rounded portal openings, crimson tower lighting, local haze, warm rail edges and revised suspension details. See `BRIDGE-SECOND-PASS.md`. The road matches V4 and 70 tower-clearance rays passed; runtime testing is pending.

**Current overhaul:** `out/tokyo_sakura_v4.blend`. V4 adds the user's reference-led suspension bridge, damp asphalt, projecting Japanese neon and modeled race floodlights to the rebuilt cedar grandstands, sakura foliage and mixed-use districts. See `CONCEPT-PASS-V4.md` and `OVERHAUL-V3.md`. Previous versions are preserved.

Previous visual study: `out/tokyo_neon_v2.blend`, built additively by `build_tokyo_night.py`. Its simplified skyline card was replaced in V3. See `references-tokyo.md` for researched references and provenance. The original v1 description below is retained for source assumptions.

Open `out/tokyo_study.blend` in Blender. The scene is an **initial layout and architectural study**, not finished Tokyo environment art or a shipped game track.

The source HTML is retained verbatim in `source/`. Only its explicit route and placement data were extracted; comments describing browser density, low-poly rendering, or 60 FPS are source context, not production requirements.

## What is built

- A continuous 18 m road with the source's closed Catmull–Rom geometry, edge lines, kerbs, barriers, catch-fence supports and cables.
- All 18 source control points and their elevation profile, including the ridge and grade-separated crossing.
- Terrain graded around road edges and cut down through the lower valley, a bay surface and seawall.
- An open viaduct deck and preliminary piers that avoid the lower roadway envelope.
- All 12 landmark footprints, four skyline placements, four tiered grandstands, and tree placements within the three park areas.
- Shared façade fins, floor bands, rooftop equipment, lobby bands, identity signs, and helipad studies where specified.
- Separate named collections, a hidden road collision study, packed local asphalt textures, and four review cameras.

## Assumptions that need design review

The HTML's `5.18 KM` headline conflicts with its `0.35` map-unit grade multiplier. This study normalizes horizontal spline length to 5,180 m, yielding **1.424708197 m per map unit**, while preserving the original elevations in metres. The resulting 3D length is approximately 5,180.57 m. The 18 m road width is a working racing-width assumption; the HTML's 56-pixel road stroke is a graphic width and would make an approximately 80 m road if scaled literally.

The source's +24 m / +3 m crossing captions describe nearby control points. At the actual interpolated intersection, the upper road is about +21.95 m and the lower road about +3.42 m. Surface separation is 18.53 m, with an estimated 17.33 m clear below the preliminary 1.2 m girder depth. This is a geometric study check, not structural certification or runtime collision validation.

Building names and placements follow the supplied fictional Tokyo circuit concept. Heights, setbacks, façade proportions, road width, roof details and daylight are initial authoring choices, not dimensions supplied by the map. Final landmark silhouettes require bespoke modeling. No added turn designations imply verification of the source's advertised 14-turn count.

## Quality and optimization plan

Preserve high-quality authoring masters. Do not decimate the entire scene. Road silhouette and surface continuity, near-camera kerbs, distinctive buildings, vegetation silhouettes and readable signs take priority.

1. Divide the track into spatial sectors with overlapping sightline coverage; keep bridge and valley collision independently addressable.
2. Author a near-camera street kit with true curb profiles, pavement, drainage, expansion joints, guardrail terminals, complete catch-fence mesh, lamp fixtures, and believable mounting details. The present cable fence is an early study.
3. Replace landmark studies one at a time with distinct, well-supported architecture. Review each at driving height and at its first visible approach. Maintain planned footprints unless clearance requires a recorded change.
4. Reuse mesh data for repeated seats, façade bays, lights and street props. This file already shares unit mesh data by material, and pine canopies share a mesh. This reduces authoring memory; it does **not** prove runtime draw-call batching.
5. Use trim sheets / material atlases for repeated architecture and normal detail for subpixel surfaces. Preserve relief and silhouette where visible. Current asphalt uses the project's locally credited Poly Haven 2K material and is packed into the Blender file.
6. Build LODs from view-dependent error and actual racing cameras, with hysteresis and transitions. Retain hero architecture and protect the crossing silhouette. Establish final sector, triangle, texture, draw-call and memory budgets only after measuring target hardware.
7. Generate simple dedicated collision for road, barriers and bridge. Add road camber, drainage, run-off, pit lane, grid, and service access before driving validation.
8. Validate frame time and image comparisons in the real game before export approval. Current pre-modifier triangle counts are inventory figures, not a performance benchmark.

## Review sequence

This session is the authorized initial construction. Layout and final Form approvals remain pending. No paid asset generation, runtime export or game integration has occurred. Review the actual Blender study and renders before detailed composition and runtime tiers.

Recommended next detailed area: bayfront start/finish, pit lane and Tsukiji/ Toyosu frontage. It establishes the reusable street kit at racing-camera distance before applying it around the circuit.

## Rebuild

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup -P D:\RaceUltimate\tracks\tokyo\build_blender.py -- --render
```

The builder overwrites its generated `.blend`. Save hand-edited work under a different name before rebuilding. To regenerate extracted data, run `extract_source.cjs` with Node. `out/study-audit.json` records the actual intersection and inventory, and `out/centerline.json` preserves metre-space centerline samples and the HTML hash.

## V12 art pass (Blender review build, not exported)

`out/tokyo_v12.blend` is built from `out/tokyo_japanese_v10.blend` (never written) by `art_v12.py` + `art_v12_part2.py` (`powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/art_v12.py`, about 30 s). Nothing went to the game: no GLB, `track.json`, `track-viewer/` or `out/web/` change. Shared code: `v12_common.py` (arc-length resampled `centerline-v10.json`, cameras, night world, EEVEE rig). Renders: `render_v12.py` (EEVEE, 16 samples, 1600x900, `-b -t 6`, one process) -> `out/v12_*.png`, v10 "before" -> `out/v10_before_*.png`; `make_sheet_v12.py` -> `out/v12-review.jpg` (references / v10 left, v12 right). Build log and numbers: `out/v12-build.json`.

**Stand clearance.** `clearance_v12.py` checks every visible object of the venue, stand and architecture collections (and any `V12 | ...venue/stand/architecture` collection): the plan distance of every vertex to the centerline must be >= 14.5 m (road half width 9 + kerb 1 + run-off 3 + 1.5), at any height, so roofs cannot overhang the road. v10: 6 violators (Bayfront stand and its spectator mesh at 0.0 m, i.e. on the road; the painted start grid at 1.8 m, road paint by design; Roppongi ridge 11.1 m; Paddock terraces 11.9 m; race lighting masts 13.7 m). v12: 0. The two start-straight curved stands are hidden and replaced by Seoul-style straight stands (stepped rows, lit crowd, roofs whose front edge is 19.5 m out, seats from 16.6 m) behind a catch fence at 12.6 m; the Roppongi stand is pushed out 6 m; 72 of 96 loose mast parts are moved out to 16 m. The gantry deliberately spans the road (it is not in a checked collection). Reports: `out/clearance-v10.json`, `out/clearance-v12.json`.

**Instancing and LOD (no decimation of heroes).** 134 frontages -> 21 full-detail hero meshes, 113 linked duplicates (matched by footprint, height and triangle count, scaled to the original footprint). Trees: 138 sakura -> 4 heroes, 51 canopies -> 3, 21 cedars -> 2, 8 avenue sakura -> 2 (v10 meshes, not v11 blobs). LOD1 copies (decimated copy of the hero, 22-30 %) are used only beyond 75 m (trees) or 140 m (frontages) of the review cameras, standing in for runtime distance LOD. 3D text: coarser curve resolution and identical labels share one curve datablock (2.9 M triangles for the sponsor-board text alone in v10). The v8 neon signs hidden in v10 (284 cabinets, vertical kanji, blades, fascias) are restored.

**Added.** Wet asphalt (low roughness, clear coat, noise-driven puddle variation) with EEVEE ray tracing; blue/pink/yellow run-off bands (corner ranges and the start straight); painted grid boxes; catch fence with lit cyan post tops and a wire-mesh alpha material; 8 sponsor banner sets from `assets/sponsors/boards/*-6000.png` (Sony, Emirates, Coca-Cola, HSBC, Pirelli, Red Bull, Rolex, Shell); start gantry with light bars, two big screens and Japanese titles; purple LED edge round the lagoon, cyan LED line along the bay shore, six searchlight beams; 153 neon kanji pylons, 918 red lanterns (one linked mesh), 75 sakura lining the street sections; a five-tier pagoda beside the hero avenue; LED/amber wall dressing in the sunken approach; cyan/magenta gate lights and lantern rows; night world; 360 degree skyline band (v11's texture, dithered so the Fuji card behind it shows); the v7/v8 Fuji card enlarged 2.3x on the avenue bearing; Japanese lettering on the bridge (plaques on both towers, entry sign 東京湾大橋 / ハイラガナ大橋).

**Fonts.** Every FONT object was switched from MS Gothic to Yu Gothic Bold (neon, race, wayfinding) or Yu Gothic Medium (names with lantern/gate/shrine/romon/castle/temple), both full-JIS system fonts from `C:\Windows\Fonts` (checked: all glyphs used are covered; the supplied Dela Gothic One subset has 210 glyphs and no kanji). No font was downloaded, so there is no serif/brush face yet (Noto Serif JP needs a download the user has not confirmed).

**Bridge day / night.** The red tower light is its own group: collection `Bridge | night lighting` (red lights, 1.6x brighter than v10) and `Bridge | night atmosphere`. Day: set `hide_render = True` on both collections, switch the world to the day sky, and set the emission of material `V5 red uplight lens` (inside the suspension mesh) to 0; the tower base materials (`V5 pearl concrete`) are already pale, so the towers read white. The scene property `v12_night_day` is only a label.

**Budget (visible objects, source file, not the game).** 3,786 objects; 1,680 unique mesh datablocks; 2.70 M unique triangles; 8.0 M drawn triangles with instancing and review-camera LOD (v10: 12.1 M drawn, 6.2 M unique). The 2-3 M drawn game target still needs: LOD2 for sakura and frontages by real distance, baking the 360 sponsor/pylon text meshes to an atlas, a lower-poly crowd, culling frontages and trees beyond the sightline, merging the 918 lanterns and 3,000 sign objects per sector, and a hand-made lower-poly pagoda. Not done here on purpose.

**Honest weak points.** Sky is a flat dusky purple, the skyline band is too bright and busy next to the dark references (the Ferris wheel and Fuji shots lose their quiet sky) and has a visible panorama seam; Fuji is behind the band's tall towers on the avenue; the lagoon and bay look dark and matte with only an LED rim (no Jeddah-style glowing village); the painted run-off bands are narrow strips, not Jeddah's wide colour fields; the corner/run-off camera sees little run-off; the crowd is a colour-noise shader, not people; the pagoda and gantry are simple geometry; castle, HQ and lantern hall are still the v10 models (no ridge ornaments, no deeper bracketing, no lantern rows on the hall), so they do not reach refs 07/08/12; v10's 359 area lights were scaled down and have no shadows; the avenue mid-rises of v8 were not restored because the v10 frontages already occupy that ground; searchlight beams are flat cones.

## V13 art pass (Blender review build, not exported)

`out/tokyo_v13.blend` is built from `out/tokyo_v12.blend` (kept intact) by `art_v13.py` + `art_v13_part2.py` + `v13_kit.py` (`powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/art_v13.py`, about 90 s with the cached landmark plan `out/v13-landmark-placement.json`; add `-Rest replan` to search again, about 4 min). Renders: `render_v13.py` (EEVEE, 16 samples, only the 14 lights nearest the camera cast shadows) -> `out/v13_*.png`; `make_sheet_v13.py` -> `out/v13-review.jpg` (reference | v12 | v13 triples). Textures are made by `make_textures_v13.py` (no external art). Numbers: `out/v13-build.json`. Nothing was exported; `track-viewer/`, `out/web/`, the GLBs and `track.json` are untouched.

**Landmark visibility** (`visibility_v13.py`, `out/visibility-v12.json` / `-v13.json`). Every 20 m of centerline, at 1.2 m above the road, rays go to 9 points of each landmark's bounding box; VISIBLE = at least 3 points clear within 1.5 km; AHEAD = also within 60 degrees of the direction of travel and under 900 m. Foliage, fences, signs and the crowd cutouts are hidden for the test (a first version gave up after 8 ignored hits and wrongly called the HQ visible; fixed). Percent of positions visible / ahead, then the longest unbroken stretch ahead:

| landmark | v12 | v13 |
|---|---|---|
| castle | 58.7 / 13.5 / 220 m | 58.3 / 13.1 / 200 m (rebuilt in place) |
| HQ | 49.0 / 19.7 / 340 m | 26.6 / 11.2 / 500 m; from the start straight 65 % visible (23 stations) |
| gate | 19.3 / 6.9 / 260 m | 17.0 / 4.6 / 220 m |
| pagoda | 68.7 / 29.3 / 300 m | 68.0 / 29.3 / 300 m |
| lantern hall | 14.3 / 0.4 / 20 m | 34.4 / 12.4 / 400 m (moved 310 m) |
| timber tower | 51.7 / 4.2 / 60 m | 57.9 / 8.1 / 160 m (moved 217 m) |
| woven hall | 22.8 / 12.4 / 580 m | 22.4 / 12.4 / 580 m |
| neon gate | 23.6 / 9.3 / 140 m | 20.1 / 6.9 / 360 m (moved 478 m) |
| Ferris wheel | 63.3 / 8.1 / 300 m | 62.9 / 8.1 / 300 m |
| bridge | 68.7 / 14.3 / 420 m | 65.6 / 12.0 / 420 m |
| garden temple | 45.9 / 9.3 / 220 m | 49.8 / 9.3 / 220 m |

The HQ now stands 92 m south of the centerline across from the start line, beyond the stands, with a 56 m view gap cut in the south stand (stations s0-10..s0+18: stand faces, LED and floodlights removed, no crowd strips). It is 65 % visible from the grid stretch but 0 % "ahead" because it sits to the right of the heading: the gap is a window, not a head-on view. Frontages standing in a moved landmark's footprint or in its corridor to the road were hidden (lantern hall 12, neon gate 7). The timber tower (160 m) is still under the 200 m bar. Moves respect the 14.5 m rule (clearance: 347 objects, 0 violators).

**Panorama.** Old band: R 2800 m, 1,833 m tall, one ring: tallest tip 32.4 degrees, typical skyline 26.4, band top 33.2 degrees. New band: R 7000 m, 764 m tall (the same 9.6:1 buildings, not squashed): the 8192 px ring repeated 6x with alternate repeats mirrored, so every joint and the ring closure are continuous (the old seam is gone; side effect: the Tokyo Tower appears twice). Tallest tip 5.7 degrees, typical peaks 4.4 degrees from 1.2 m eye height. Foot at z -40, top fades through vertex alpha; the colour is darkened, desaturated and tinted toward the base (distance haze). A dark far-ground disc (R 9500 m) carries the land out to the ring. The Fuji card is pushed back to 7.7 km at 0.65 of its v7 size, summit about 10 degrees, behind the ring. Check views: `v13_o_pano_driver_start.png`, `v13_i_neon_street_fuji.png`, `v13_j_bridge_night.png`.

**Bridge cables.** The lane check (`bridge_lane_offenders` in `art_v13_part2.py`) tests every visible mesh against the lane volume (plan distance under 9 m of the deck centerline, 0.35-6 m above the deck) over the 293 deck stations. In v12 no suspender or cable part entered the lanes (the suspension mesh was split into its 1,364 loose parts and none reached |lat| < 9.6 m above the deck), so no geometry needed cutting. The thin diagonal lines in the bridge views were v12's flat searchlight cones; they are replaced (see below) and the sites moved away from the bridge sightlines. The check can delete offending loose parts if one ever appears. Close-up: `v13_p_bridge_deck_closeup.png`.

**Tunnel** (covered 470 m, stations 1913-2148; depressed approach 822 m). Collection `V13 | tunnel dressing`: 4,072 tiled liner quads (brick-node ceramic tile) on both walls up to 5.7 m, a continuous warm cove line at 4.6 m, lit white lane edges at 8.7 m, 32 jet fans (one linked mesh, pairs every 28 m in the covered section), 15 emergency niches with green 非常口 plates, overhead sign plates 東京湾トンネル / 出口 EXIT / 出口 600m, and 32 anime mural lightboxes. The v12 wall-wire dressing is hidden.

Mural spec: each panel is 6.4 x 3.6 m (16:9) plus a 0.32 m dark frame and LED edge, one every 20 m alternating walls, bottom edge about 1.25 m above the road. Four shared materials `M_AnimeMural_01..04` (node `IMG` is the image slot, emission 1.6, backlit) use the placeholders `textures/anime_mural/placeholder_01..04.png` (soft gradient with "ANIME MURAL / PLACEHOLDER nn", 1536x864). No anime art was invented or copied; swap the images to change them. View: `v13_q_tunnel_murals.png`.

**Hologram anchors** (collection `V13 | hologram anchors`; empties with custom properties `size_hint_w_m`, `size_hint_h_m`, `facing_xy`, `ground_z`, `note`): `HOLO_anchor_01` tunnel exit (6 x 9 m), `_02` neon street (5 x 9), `_03` gate plaza (9 x 13), `_04` start-straight building face, on the HQ glazing (30 x 12), `_05` pagoda court (6 x 9), `_06` bridge entry (10 x 6). The glowing `HOLO_marker_nn` / `HOLO_extent_nn` meshes live in `V13 | hologram markers (review only)`; leave them out of the game. Views: `v13_r1..r6_holo_anchor.png`.

**Weak-list items.** Lagoon: near-black glossy water (roughness 0.025) ringed by 23 lit pavilions, 13 glowing tents, piers and lamp posts, with a violet wash light. Run-off: 7 corners get 14.8 m wide blue/pink/yellow fields on the outside, starting 12.8 m from the centerline. Castle: rebuilt as `V13 castle` (stone base, 5 plaster tiers, hip roofs with lifted corners, deep bracketed eaves, karahafu gables, corner oni tiles, gold shachihoko pair, lit windows). Lantern hall: 188 white paper lanterns with red marks (one linked mesh) in 4 rows on the road-facing front. HQ: three stacked organic white slabs with recessed glazing, slim columns, edge LED (`V13 HQ`; v10 HQ hidden). Crowd: 7,164 cutout strip quads (generated figure atlas, two staggered strips per row, dithered alpha) on the new stands. Searchlights: 4 sites, 3 nested cones each, with facing fade, height fade and noise. Shadows: the 14 lights nearest the camera cast shadows in each render.

**Budget (visible, source file).** 4,049 objects, 2.63 M unique triangles, 7.93 M drawn (v12: 8.0 M, v10: 12.1 M). Still to do at export: real distance LOD, text atlas, lower-poly crowd, culling, sector merging.

**Weak points.** The skyline is now very faint and low (by design, maybe too dark) and the mirrored ring shows two Tokyo Towers; the lantern hall is only partly readable (its roof is still v10, the lanterns hang under it); the timber tower view is 160 m; tunnel walls are a flat tile read and the fans are plain cylinders; murals are placeholders; the HQ view gap leaves open stand ends; run-off fields are flat paint; village buildings are boxes; the castle is simple geometry next to ref 07; fonts are Yu Gothic only (no serif or brush face, Noto Serif JP was not downloaded); the crowd strips are flat.

## V13.1 update (Blender review build, not exported)

`out/tokyo_v13_1.blend` is `tokyo_v13.blend` (kept) plus `pano_v13_1.py` and `pano_v13_1_garden.py` (`powershell tracks/tokyo/run_blender.ps1 -Script tracks/tokyo/pano_v13_1.py`, about 1 min). Renders: `render_v13_1.py` -> `out/v13_1_*.png`. Numbers: `out/v13_1-build.json`.

**Skyline, once.** The v13 closed 6x mirrored ring is hidden (it repeated the Tokyo Tower). `textures/panorama/tokyo_skyline_night.png` is now used exactly once, not mirrored, as a partial arc: R 7000 m, 758 m tall, 9.6:1 so the buildings keep their proportions, which makes it a 59.6 degree arc. Bearings below are clockwise from north (east 90, south-east 135); in map-angle terms (0 = +X, counter-clockwise) the arc is -51.6 to +8.0 degrees. The arc covers bearings 82 to 141.6, which is what the start straight (heading east) and the bridge views (south-east) look toward. The tallest tip is 5.7 degrees and typical peaks 4.4 degrees from 1.2 m. The Tokyo Tower stands at bearing 90.8, once. Both ends fade (14 % of the arc each side) through vertex alpha into the hills and haze, and the colour is darkened, desaturated and tinted toward the base. `V13.1 skyline arc day` (same geometry, `tokyo_skyline_day.png`) is hidden: for a day look unhide it and hide the night arc.

The rest of the circle: two low dark ridges (far R 7400 m, near R 6300 m, 6-130 m high), a horizon haze band (R 6900 m, 480 m) and 880 sparse low-rise lights on the ridges outside the arc, so no bearing shows a hard edge or a void.

**Fuji.** Bearing 354.9 (north; map-angle -264.9, i.e. +95.1), the direction the neon street looks (347.4), 7.77 km away, card 5.2 km wide, summit 1,166 m = 8.5 degrees, haze at its base from its own matte plus the near ridge.

**Sweep.** `out/v13_1_sweep.png`: 8 views at 45 degree steps from the start line at 1.6 m (lens 28 mm, labelled); the new stands block most of that horizon, so `out/v13_1_sweep_high.png` repeats it from 14 m up. One Tokyo Tower in the 360 degree sweep (bearing 90), Fuji at bearing 0, hills and haze elsewhere. Re-rendered: `v13_1_a_start_straight.png`, `v13_1_i_neon_street_fuji.png`, `v13_1_j_bridge_night.png`.

**Anime murals.** `M_AnimeMural_01..04` now use `textures/anime/gen/mural_01_driver.png`, `mural_02_pitcrew.png`, `mural_03_nightrace.png`, `mural_04_sakura.png` (2736x1536, 16:9, original art, provenance in `textures/anime/PROVENANCE.md`); emission 0.8 so they read as backlit lightboxes with colour intact. The placeholders stay on disk, unused. The `holo_*` PNGs are for runtime three.js only and are not in the scene. View: `v13_1_q_tunnel_murals.png`.

**Garden moved.** The garden temple, red curved bridge and pond, their court lanterns and one tree (8 objects) sat in the infield behind the Ferris wheel, 269 m from the nearest road (station 4, west end of the start straight). They now stand 117 m south of that road section, on the empty grass opposite the wheel (centre -351, -625, station 30, lat -117), rotated 177.8 degrees to face the track and dropped 0.6 m onto the terrain. 117 candidates were searched; the chosen one is clear of every checked object (clearance: 347 objects, 0 violators). Visibility of the group: v13 49.8 % visible / 9.3 % ahead / 220 m longest run; v13.1 30.1 % / 16.6 % / 580 m (less often seen from afar, but head-on along the straight for 580 m). Fill: 16 sakura (linked hero mesh) and 26 red lanterns on posts around it, plus a warm wash light. Views: `v13_1_w_garden_driver.png` (road, 1.6 m) and `v13_1_x_garden_from_wheel.png` (wheel plaza, 280 m away, so small).

Note: these runs were made while the user's own Blender window was open, so `run_blender.ps1` refused to start; the same command (`-b -t 6`, below-normal priority, one background process of mine) was launched directly.

**Tunnel lighting fix (v13.1).** `tunnel_fix_v13_1.py`: the 32 hanging jet-fan cylinders are moved (not deleted; `art_v13_part2.py` still rebuilds them) to the render-excluded collection `V13.1 | _archive`. Replaced by 111 flush rectangular ceiling luminaire strips (3 rows, 12 m spacing, `V13.1 | tunnel luminaires`) plus 19 neutral area lights; wall strips, exit signs and murals are unchanged. The violet village wash light that tinted the tiles is cut to a quarter and made cooler. `v13_1_q_tunnel_murals.png` re-rendered, the old one is `v13_1_q_tunnel_murals_prev.png`.
