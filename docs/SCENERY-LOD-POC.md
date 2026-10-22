# Playable scenery LOD experiment

Open **http://127.0.0.1:5180/?scenery=1**, start a race or Free Drive, and use the top-right comparison panel. **Original** restores original geometry/materials; **Adaptive LOD** enables both experiments. The individual checkboxes isolate yachts from the hotel. Ordinary game URLs retain the existing scenery implementation.

Resolution adaptation is locked in this view by default. Compare at the same location, camera, quality and weather; a different render resolution can otherwise hide the cost of scenery. The panel reports total draws/triangles across all passes, FPS, GPU time if supported, and the main camera's yacht geometry/material submissions. FPS is affected by cars, shadows, reflections, browser scheduling and the frame cap; fewer triangles are not a promise of more FPS.

The FPS counter and non-GPU dynamic-resolution fallback now use uncapped wall-clock frame duration. Physics still receives its bounded timestep. Previously very slow frames could display roughly 20 FPS because the counter accumulated the 50ms physics cap instead of elapsed time.

## Yacht experiment

All 51 yachts across five variants retain their full originals close up. At a small projected screen size, an instanced proxy replaces the hull/cabin/deck materials with one shared 512×256 atlas material. Hull and window patterns reproduce the existing source texture generator, with original material palette stored as vertex colors. This is a surface atlas, not a photograph with fixed sunlight. Dynamic PBR lighting still applies.

The proxy keeps the hull/cabin outline, simplifies with a bounded 0.6%-extent error, and drops small rail/light/steel details. Entry/exit thresholds differ to prevent repeated switching at the boundary. Per-instance frustum selection applies equally to both A/B modes. Unchanged instance membership does not upload matrices again. Collision meshes, source GLBs and near materials are unchanged.

| Variant | Original triangles per boat | Proxy triangles | Material draws per instanced variant |
|---|---:|---:|---:|
| 20m white | 1,169 | 638 | 8 → 1 |
| 45m graphite | 1,314 | 612 | 8 → 1 |
| 27m navy | 1,167 | 547 | 8 → 1 |
| 56m silver | 1,483 | 690 | 8 → 1 |
| 34m white | 1,296 | 625 | 8 → 1 |

These are geometry counts, not whole-game savings. When a variant has both near and far boats visible, its original material batches plus one proxy batch are needed; this can add a draw. The panel includes this cost. The additional atlas is about 0.67 MiB of RGBA8 GPU storage including mipmaps, plus proxy geometry; no extra image downloads. Small deck lights disappear with the far detail, so inspect night as well as dusk before broad adoption.

## Hotel texture-bake experiment

The crescent hotel uses six orthographic views baked into albedo and emission atlases once while the venue loads. Its three material draws become one at distance. All 583 original triangles and normals are retained to preserve its silhouette; this experiment tests material consolidation rather than polygon reduction. Nearby rendering returns to the original materials. Emission intensity follows the original day/night controls.

This deliberately small proof of concept uses 384×256 RGBA8 render-target atlases: approximately 1 MiB of color textures including mipmaps, plus depth attachments. Twelve offscreen renders are performed once. This is a memory/loading tradeoff for only two saved draws, not a recommended final asset format. If approved visually, bake during asset export and compress with KTX2 rather than keeping runtime render targets. The skyline itself is already built from textured low-poly facades; replacing it wholesale with boxes would sacrifice shape for little benefit.

## Pit-car removal (enabled in the normal game)

Only selected participants are attached to the world scene. Other previously loaded cars remain in the asset cache for garage selection, but have no world root, frame updates, pit-box physics collider, shadows or reflections. Returning to a race reattaches its entrants; the garage can still preview any cached car. New cache entries remain detached until selected. The bare developer viewer now requests only one entrant per team (seven), instead of loading fourteen and displaying seven extras in pit boxes. Free Drive attaches only its selected car.

This change is enabled without the experiment URL. `npm run test:v2` checks seven-car lineups, single-car previews, cached car reuse, inactive update exclusion, detached new loads, and the seven-car default viewer.

## Verification and comparison

From `track-viewer`:

```
npm run test:scenery-lod
npm run build
```

Tests cover actual shell yacht variants, component/parent/instance transforms, original resource immutability, equal-membership uploads, hysteresis, visibility ownership, renderer state restoration, atlas UVs, emission, disposal and failed-bake fallback. Normal race-loading and hoarding regressions also pass.

Developer tools: `viewer.scenery().getStats()`, `viewer.scenery().setEnabled(false/true)`, and `await viewer.benchScenery(16,{width:960,height:540})`. The route check freezes simulation, warms both variants, measures Original/LOD/LOD/Original, and restores the previous toggles. It measures rendering, not physics or input responsiveness. Browser hardware and render settings are included in every sample. Local software-renderer timing is not evidence of target-hardware FPS.

An initial 16-point route check at Medium/KTX2, internal 816×459, reduced average total submissions from 290 to 279 draws. Software-renderer frame times increased (original 132.69/139.64 ms; adaptive 149.46/148.49 ms), so this run does **not** demonstrate smoother gameplay. Total triangles rounded to 559k/560k; secondary passes and their culling make main-view geometry estimates different from whole-frame counts. The initial run used 256px hotel tiles; the playable version reduces those to 128px to limit atlas memory. Raw initial observations are in `track-viewer/qa/scenery-lod/route-comparison.json`. This is an opt-in quality/performance experiment, not a default performance upgrade.

After preserving the yacht hull's reflection-layer eligibility and preventing stale renderer instance bounds, a 24-point repeated route check reduced total draws **307 → 293** and triangles **569k → 557k** (same internal size, Medium/KTX2, cars hidden to isolate scenery). Original render times were 117.43/108.77 ms; adaptive 113.10/112.40 ms. The pairs do not establish a reliable speed improvement on this software renderer. Raw results: `track-viewer/qa/scenery-lod/route-comparison-final.json`. Subsequent visual QA also corrected atlas viewport/scissor placement to use render-target texels rather than display pixel ratio; this changes texture alignment, not submission counts. Building tests enforce that coordinate boundary.

For visual inspection, compare parked views beside the marina, drive toward/away from the yachts, then repeat at night. Watch for silhouette changes, window brightness, missing lights and transitions. The experiment keeps originals resident to make A/B switching immediate, so it does not reduce initial venue download size or total resident geometry memory.

## Fixes (2026-10-21)

- **Yacht shadows:** an off-screen yacht was dropped from every render pass, so boats just out of view lost their shadows on the visible track, which runs beside the marina. They popped as the camera turned, in both Original and Adaptive mode. Boats within 105 m of the camera now stay in the full-detail stream even when off screen; this matches the sun's ±70 m shadow box. Boats beyond that are still culled. Covered by `test:scenery-lod`.
- **Hotel crown:** the neon crown (untextured, emissive ×9) is a thin ring. Baked into a 128 px atlas tile and mipmapped, it fell below the bloom threshold, so its glow disappeared at distance. Untextured neon trim now stays a real mesh at every distance: 3 → 2 draws instead of 3 → 1. The bake's emission scale now comes from the facade alone, which also gives the windows more precision. Covered by `test:scenery-lod`.
- **Panel:** the A/B panel starts below the HUD minimap (top 250 px), so it no longer covers it.
