# Scenery culling follow-up and profiling experiment

Follow-up to `HOARDINGS-AND-SHELLS.md`. The runtime fix in this pass corrects instance matrix uploads when the visible set changes without changing its count. The previous shell meshes remain the default. Spatial-section assets are retained only as developer experiments because render-time checks did not establish a reliable speedup.

The final experimental variant splits the main road into nine 768m grid sections. No additional geometry is deleted: every triangle, vertex attribute, material and winding is retained. Children use the original parent's transform and quantization scale, so section boundaries share the same world positions. The camera can skip off-screen chunks. Original, shell and collision assets remain intact; `_sectors.glb` siblings are derived for WebP and KTX2 but are not copied into the production runtime.

96m and 192m subdivisions produced excessive draw and file overhead. A six-mesh 384m candidate reduced affected submitted geometry by 55.4% on 24 deterministic chase-camera samples, but increased its draw submissions from 10.6 to 61.5. The final road-only 768m candidate reduces the road's submitted triangles from **56,604 to 33,459 (40.9%)**, with draws increasing from **5 to 20.4**. These are frustum metrics for selected geometry, not whole-game FPS.

Experimental file sizes versus the shell build: WebP **7,877,772 → 7,940,280 bytes**; KTX2 **12,785,752 → 12,848,392 bytes**. The default shell files are unchanged.

Also fixed an existing instance-culling upload bug: equal visible instance counts could hide changes in which palms/lamps/etc. were visible. Membership changes now trigger matrix uploads; identical sets avoid redundant uploads. A regression test checks same-count swaps, unchanged sets, disappearance and re-entry.

Build order: `npm run pack:shells`, `npm run pack:sectors`, `npm run sync` from `track-viewer`. The complete `npm run pack` pipeline runs these stages automatically, but sync deliberately serves the validated shell build, never the experimental sections. Run `npm run test:sectors`, `node scripts/test-shells.mjs`, and `npm run test:hoardings`.

The geometry test checks exact triangle signatures including all attributes and winding, allowing Meshopt's cyclic rotation of triangle indices. Textures are unchanged. Reports: `track-viewer/qa/sectors/report.json` and `visibility-report.json`.

For local render-time A/B checks only, `?venue=whole` loads the shell build and `?venue=sectors` loads the experiment through a dev-server-only endpoint. Production always uses the synced shell asset and exposes neither route. `viewer.bench` provides a fixed route.

Observed render-only checks used High, KTX2, 24 route frames and a 640×360 internal buffer. This session reported Microsoft Basic Render Driver (software rendering). The six-mesh candidate averaged 140.83ms; road-only averaged 141.96ms. Baseline samples varied from 113.36ms to 177.81ms, so these runs do not support a stable improvement or a target-hardware FPS claim. No experimental geometry change is enabled by default. Raw samples and decision: `track-viewer/qa/sectors/render-comparison.json`.
