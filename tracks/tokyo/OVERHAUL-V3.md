# Tokyo Sakura Circuit — direction overhaul

The v1/v2 environment was rejected for generic blue boxes, undeveloped stands, sparse scenery and a diagrammatic skyline. V3 replaces that scenery rather than extending its facade treatment.

## Design commitments

- **Architecture:** narrow mixed-use buildings, occupied window textures, recessed glazing behind structural bands, stone and ceramic wall tones, timber storefront framing, balconies, rooftop equipment, projecting tenant signs and district-specific massing. The source landmarks become groups of buildings with distinct heights and setbacks.
- **Grandstands:** structural roof bays, deep cedar soffits, cantilever braces, individual muted-red / warm-grey seats, explicit stair aisles and railings, rear screens, planted approaches and warm under-eave lighting. Source stand positions were adjusted to establish a closer relationship to the race corridor.
- **Landscape:** cherry trees with branching trunks and irregular clusters of pale pink petals, plus green foliage trees. Shared tree meshes preserve memory reuse. No solid pink spheres stand in for blossom canopies.
- **Street scale:** continuous pavement, drain grates, chain-link catch fencing, lantern posts, benches and shop signs. Road geometry and elevation remain from the source circuit.
- **Distance:** the previous skyline card was removed from the scene. Layered low-complexity windowed buildings and dimensional Tokyo Tower / Skytree silhouettes supply depth. A future bake can be generated from this richer source after the actual racing-camera sightlines are approved.

## Reference and provenance

The local Corniche Marina map is the quality benchmark for structural readability, texture scale and environmental density. Its project-authored facade and chain-link atlases are reused. Existing credited Poly Haven textures and the Belfast sunset sky are packed into the source file.

Visual reference searches covered Tokyo National Stadium's timber eaves and Nakameguro's cherry-lined night streets. The resulting architecture is an original circuit composition, not a surveyed replica. References already collected in `references-tokyo.md` remain relevant for Tokyo district context and signage.

## Files and rebuild

- `out/tokyo_sakura_v3.blend`: revised editable authoring scene.
- `overhaul_v3.py`: standalone additive/replacement builder, loading the preserved v2 source.
- `out/overhaul-v3-report.json`: actual authoring inventory.
- `out/*_v3.png`: rendered checks from the race approach, grandstand, commercial street, cherry sweep and overview.

Run the script through Blender in background mode. It rebuilds v3 outputs and preserves v1/v2. Save manual edits under a separate filename before rerunning.

## Performance / validation scope

This is the high-detail authoring scene. Tree instances currently account for most of the drawn triangles; sharing their mesh data reduces storage, not visible triangle count. Runtime sector culling and foliage LODs must be measured before game integration. Do not call this a 60 FPS browser result until it has been exported and tested on target hardware. Do not globally decimate the authoring source.

The current pass is reviewed through actual Blender renders. Runtime exports and deployment have not been performed.
