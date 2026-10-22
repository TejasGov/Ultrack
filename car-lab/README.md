# RaceUltimate car & paint lab

A local Three.js WebGL2 render test for the first three generated cars. It loads the actual delivered GLBs, places them in the same procedural wet pit-lane scene, and lets us evaluate appearance and repainting before generating more cars. It does not include driving physics or the final circuit/art direction.

## Run

From `D:\RaceUltimate\car-lab`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open [the local lab](http://127.0.0.1:5173/). The development server binds to loopback only and serves a whitelist of the three car models from `D:\RaceUltimate\meshy_output\batch-1`. The original files remain unchanged.

```powershell
npm.cmd run build
npm.cmd run preview
```

The build copies the three original GLBs and the body-only shell into `dist/models`; expect approximately 163 MB of model files before compression/optimization. It includes the new `assembly-lab.html` entry. The preview server uses port 4173.

## Controls

- Select Furari/TR–8, Lambo/AV–12, or McLaren/MP1–X.
- Drag to orbit; scroll to zoom. Use front/side/rear/three-quarter presets or the turntable.
- Choose eight paint colors or a custom hex color. Gloss, metallic, satin and matte finishes are available, plus two stripe patterns.
- Compare **Paint**, **Original**, and **Clay**. Clay removes base-color, normal, emissive and metallic-map contributions so we can inspect the imported geometry and normals.
- Compare golden-hour, overcast and studio illumination. Toggle wet asphalt and moving reflection cards. The cards are visible to the reflection capture, not the main viewing camera.
- **Smooth surface normals** is enabled by default: it recomputes preview vertex normals and averages them at coincident positions with a 55-degree crease limit. This changes only the loaded preview geometry. It does not repair missing/warped geometry or overwrite the source GLB.
- **Clean materials** is enabled by default: generated color, roughness, metallic, emissive and normal maps are bypassed in Paint mode. Body paint, neutral trim, dark glass and silver rims use scene lighting. Disable it to compare the earlier texture-based treatment; the generated-detail slider then becomes available.
- Open **Refine body mask** to visualize the selection. Use **+ Paint** or **− Protect**, then draw on the car. Orbit mode/ESC restores camera control. Undo restores the previous stroke; five steps are retained.
- Export/import the body mask PNG and export a paint-settings JSON for later game integration.

## Paint implementation

The current models each have one material atlas. A global material tint would recolor tires, glass and trim as well as the body. This lab therefore uses a separate 2K grayscale body mask in UV space. White selects paint; black protects the original material.

The Furari's initial mask uses red/warm texture seeds with spatial protections. The dark cars use a positional body-selection heuristic, evaluated per texel using interpolated 3D coordinates instead of selecting whole triangles. **These are draft masks**, not semantic material segmentation. They can miss fenders/pillars or include small trim/light/wheel areas; inspect and refine them before approving a paint job. The editor makes those limitations visible and lets us correct them without another Meshy generation.

Inside the mask, the shader replaces the baked base color with fresh paint, sets roughness/metalness/clearcoat from the chosen finish, and applies optional longitudinal stripes. In the default clean treatment, non-body surfaces also receive neutral replacement materials, with approximate glass/wheel/rim spatial regions. Generated normals and emission are bypassed across the entire car. Disabling Clean materials restores the earlier behavior: imported maps remain active outside the body mask and normal detail is adjustable inside it. Original mode always shows the imported material independently of the clean toggle. Stripe placement follows normalized car coordinates.

Paint preferences save per car in browser localStorage. Edited masks save per source task in IndexedDB. Refined selections use `mask-v2`; older `mask-v1` edits are preserved and can be loaded with **Restore earlier saved mask**, then undone if desired. Local saves are origin-specific; use export/import to carry masks across ports/browsers. PNG export uses glTF UV orientation (v=0 at the image top). The original GLB/material atlas is never edited.

## Reflection implementation

Paint uses `MeshPhysicalMaterial` with clearcoat. A cube capture around the car is filtered through PMREM to supply scene reflections. The car is excluded from its own capture. Lighting changes trigger a new capture; moving reflection cards update it periodically. Wet asphalt combines a planar reflection with textured road shading.

Textures are capped at 2K in the preview to limit GPU memory; the original 4K maps are retained in the asset folders. Car geometry is normalized to a 4.6 m test length and a common origin for fair comparison. This is a display normalization, not a verified real-world dimension or vehicle configuration.

## Validation checkpoint

The first three cars were loaded and visually checked in the in-app browser. Repainting, finish and stripe controls, material comparisons, lighting, and mask visualization were exercised. A mask brush stroke was exported and undone; exported PNG hashes were compared to verify that undo restores the original mask. The production build passed.

The models' uneven/faceted body surfaces remain visible in-engine, including in clay mode. Mask boundaries around dark-car fenders/cabin regions require refinement. These findings mean that generation success alone does not establish the desired screenshot quality or paint readiness.

**Keep the next batch unsubmitted while we evaluate these assets.** Next decisions should follow inspection of the existing higher-detail source geometry, material cleanup and refined masks. No additional Meshy calls are made by this application.


## October 18 material checkpoint

The source base-color atlases contain strong baked reflections/white edges despite the generation's `remove_lighting: true` setting. Increasing paint saturation or using a global tint cannot remove those edges. Clean materials now replace all of those cosmetic map contributions in the preview, rather than retaining them on the unpainted trim. Gloss uses dielectric paint (metalness 0) with clearcoat; metallic paint remains a separate finish.

The per-texel draft masks remove triangle-sized stair steps, but **this is a material proof, not final semantic segmentation**. Some pillars, fenders, lamps and trim still need exact masks. Clean treatment deliberately drops original lamp/decal detail until those regions have their own masks. Glossy lighting also continues to reveal uneven geometry/normals; softer finishes reduce that visibility without repairing the surface. Review the clean and original modes before signing off the asset workflow.

New visual evidence is in `verification/*-clean-materials.png`. Source GLBs and the paid queue configuration remain unchanged. No further generation is required to experiment with these materials.


## Surface diagnosis (development server only)

Open `/surface-review.html?car=lambo2` (also `furari-488` or `mclaren`) to compare the delivered mesh and the already-downloaded pre-remesh original. Both receive the same fresh physical material, lighting, scale and camera with no imported texture or normal maps. The optional normal-recompute toggle affects only the preview. Source assets remain untouched. The additional source URLs are exact development-server whitelist entries; high-detail source files are not copied into the production build.

The Lambo original (1,205,760 triangles) retains pronounced surface unevenness alongside the 58,861-triangle remesh. Recomputing normals does not remove it. McLaren's 847,166-triangle original also retains visible surface irregularities. This rejects the assumption that color replacement or increasing the polygon count alone will produce the intended glossy finish.

Recommended next experiment: one isolated, untextured body shell with consistent neutral reference views, separate reusable wheels/tires and separately constructed glass, mirrors, lamps and trim. Preserve roof/pillars and window boundaries in the shell design. Require a neutral glossy surface check before paint, optimization or batch production. Body-only generation is an experiment, not a guarantee of smooth hard-surface geometry. If its panel quality still fails, use the generated shell as a design reference for surface reconstruction or adapt a properly modeled vehicle base.


## Body-only experiment delivered

The one authorized Lambo shell test is complete: task `01a150a9-e6e0-7555-8d3d-50163498bf9a`, 20 actual Meshy credits. See `../meshy_output/body-shell-test/README.md` for model, request, prompts, provenance and limitations. Open `/surface-review.html?experiment=body-only` on the development server, or follow the link in the paint panel. Both panes use fresh adjustable paint; the previous full-car **pre-remesh** original is compared with the new raw shell, without imported cosmetic maps. Reflection angle and synchronized camera controls support inspection. The new shell's openings/component omission are improved, but it still fails the requested glossy surface-quality target. No further batch was submitted.


## Reusable vehicle assembly

Open `/assembly-lab.html` for the existing AV�12 shell fitted with procedural track tires, two interchangeable rim resources, rotors/calipers, separate glass, mirrors and LED paths. Paint, livery, rim finish and neutral/warm/cool grading are independent. Component toggles expose the body-only stage; named wheel pivots support front steering. Device preferences are keyed to the body hash. Export produces a complete JSON recipe and a copyable JSON field for browsers that do not save downloads.

The implementation and repeatable phases are documented in `../vehicle-pipeline.md`. Run `npm.cmd run check:vehicle` for source/profile validation and the four hardware/material tests. The standard build also verifies the original source hash before bundling. Resource builders and materials are in `src/vehicle/`; this car's anchors are in `src/vehicle/profiles/av12.json`.

This is an assembly prototype: glass/lamp/mirror fit is provisional, raw panel ripples remain and the 2.46M-triangle source still needs a derived optimized mesh. The exported recipe is configuration, not an assembled GLB, and driving physics are not included. No additional Meshy/image-generation requests were made for the assembly.

## Replacement car attribution

McLaren 720S, Mercedes-AMG One and Audi e-tron GT credits, license links and modification details are in the [project README](../README.md#replacement-car-credits). The Audi is CC BY-NC-SA 4.0 and is restricted to noncommercial use.
