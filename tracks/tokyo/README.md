# Tokyo Hiragana circuit — Blender production start

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
