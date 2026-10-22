# Car concepts → Meshy → review

This workspace has 12 concept design sheets and an existing `La_furari.glb`. The existing GLB is not submitted, overwritten, or remeshed by this queue. `concept-furari-488.png` is a separate concept entry, not an automatic replacement of the existing GLB.

## Prepared workflow

1. Read each original sheet and extract front, side, and rear views as separate PNGs. Originals stay unchanged. These are pixel crops, without invented details or enlargement. Some reference panels are front/rear three-quarter views; view labels identify the facing direction, not guaranteed orthographic projections. A few crops retain tiny caption/border fragments at the edges.
2. Submit one multi-image-to-3D request per car, with the front-facing view first. Never upload the whole collage or mix different cars/color variants in one task.
3. Use Meshy 7.1, standard geometry, 4K PBR textures, and a triangle remesh target of 60,000 within that generation request. Request the higher-detail original too. This target is approximate.
4. Maintain at most three active car slots. A slot covers submission, waiting, and downloading. The CLI performs remote polling; the queue does not implement HTTP polling.
5. Download the GLB, the original GLB when returned, separate texture maps, and available rendered previews. Save the resource/task ID, CLI project trail, actual reported credit charge, and a structural GLB report.
6. Stop after three cars by default. Review the results before launching the next batch. A larger explicit limit continuously fills the same three slots.

**Prepared references:** `meshy_output/references/<car>/front.png`, `side.png`, `rear.png`.

**Review sheets:** `meshy_output/prepared-views-1.jpg` through `prepared-views-3.jpg`.

**Configuration:** `meshy/cars.json` contains crop rectangles, queue order, generation parameters, and the pricing estimate. Adjust individual crops there and rerun preparation if a new concept uses a different layout.

**Generated files:** `meshy_output/cars/<car>/<CLI-project>/assets/`.

## Commands

Run from `D:\RaceUltimate` using Node.js 22.12+ and the existing Meshy login. The runner resolves the pinned `meshy-cli@0.4.0` from npm and invokes it directly with argument arrays. It does not read or store your credentials itself.

```powershell
# Free local preview of the next three cars and estimated new charges.
node .\scripts\meshy-cars.mjs plan

# Launch/resume up to three cars. This command authorizes paid submissions.
node .\scripts\meshy-cars.mjs run --limit 3 --max-credits 90

# Show recorded task IDs, statuses, and actual charges when available.
node .\scripts\meshy-cars.mjs status

# Select specific cars (existing unfinished work must be included).
node .\scripts\meshy-cars.mjs plan --ids furari-488,lambo2,mclaren

# Optional: explicitly authorize the entire queue with three concurrent slots.
node .\scripts\meshy-cars.mjs run --limit 12 --max-credits 360

# Local queue safety checks; no Meshy API calls.
node --test .\scripts\meshy-cars.test.mjs
```

Rebuild the reference crops after changing a source/crop rectangle:

```powershell
& 'C:\Users\Tejas\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\scripts\prepare_car_references.py
```

That script uses Pillow from the bundled runtime. After preparation, inspect the review sheets before running generation. The queue checks source and crop hashes and refuses silently changed inputs for existing tasks.

## Order and cost

| Batch | Cars | Estimated credits |
|---|---|---:|
| 1 | Furari 488 concept, Lambo, McLaren | 90 |
| 2 | Mustang, Porsche, Aston Martin | 90 |
| 3 | Bugatti concept, Bentley, BMW concept | 90 |
| 4 | Jaguar, Nuvolari, Tesla concept | 90 |

Estimate: **30 credits per car / 360 for all 12**, using Meshy 7.1 multi-image generation with 4K textures and no Ultra surcharge. Source: [published API pricing](https://docs.meshy.ai/en/api/pricing), checked October 18, 2026. The [multi-image API](https://docs.meshy.ai/en/api/multi-image-to-3d) exposes inline remeshing and retention of the original mesh; no separate paid remesh request is scheduled. Actual `consumed_credits` is recorded when Meshy reports it; otherwise it stays unknown.

`--max-credits` limits the queue's estimated new charges for that invocation. It is not a provider-enforced billing cap. Resumed known task IDs do not trigger a new generation charge. Recheck pricing before later reuse or changing model/texture/geometry settings. The runner rejects changes to its current pricing assumptions.

## Resume and failures

- Each accepted task ID is saved immediately, before local project creation or waiting. Once accepted, the same ID is resumed after a download, network, or wait problem.
- A stable CLI operation ID is stored before submission. The CLI also journals submissions. An unknown submission is blocked for reconciliation; it is never automatically retried with a new operation ID.
- Any failure stops admission of new cars. Other already running workers are drained; their successful outputs are preserved. Insufficient credits never trigger a paid retry.
- Failed tasks are skipped, not regenerated. Any new variant/rerun needs a separate decision and budget. Preserve the failed task trail.
- Successful downloads are preserved on resume. If an asset is corrupt, move that specific file aside for inspection and resume the existing task; do not reset the task to pending.
- `queue.lock` prevents overlapping queue runners. If the process crashes, inspect its PID and make sure no worker processes remain before removing a stale lock. Never delete `queue-state.json` to fix a problem: it holds the IDs that prevent duplicate spending.
- If a process stops between submission and recording its task ID, inspect that car's local submission logs and the CLI operation journal. Recover the accepted task ID first; do not erase the record or submit a replacement.
- For any accepted task, recovery uses resource `multi-image-to-3d`, not `image-to-3d`. CLI logs and snapshots may contain temporary asset URLs; keep them local.

## Acceptance before game integration

Generation produces review candidates. It does not establish that wheels are separate or the asset is ready for driving.

- Compare the silhouette, wheelbase, width, and aero against the original concept.
- Inspect the underside, hidden side, wheel shapes, and panel continuity.
- Separate all four wheels and set pivots if necessary; define body/wheel node names in the integration step.
- Check paint/glass/tire/light material regions or masks. A single texture atlas can require additional preparation.
- Inspect glossy materials under moving lighting for lumps, incorrect normals, and painted-on reflections. Add the game's paint clearcoat and reflection environment during integration.
- Set real-world scale, forward axis, and ground contact. Measure the actual triangle count and browser performance.
- Inspect available rendered previews after downloading; the runner leaves visual review pending for a human/assistant to perform. A thumbnail cannot establish topology or handling readiness.

The existing Furari GLB was structurally inspected: 30,827 triangles across its mesh nodes, one mesh primitive, one material, and normal/metallic-roughness texture references. No separate wheel nodes were found. This was not a visual or runtime quality assessment. See `meshy_output/_inspection/furari-inspection.json`.


## Material workflow being validated on batch 1

Keep the next batch on hold. The accepted silhouettes can be retained while materials are rebuilt in the engine. Current lab proof: [`car-lab`](../car-lab/README.md).

1. Keep each original GLB and all source maps for recovery/comparison.
2. Build and refine a paintable-body mask plus glass, rubber, rims, carbon/trim and lamp masks. Current body/spatial masks are drafts; they are not provider-supplied material IDs.
3. Use neutral reusable engine materials for those regions. Treat body color as a parameter, separate from lighting. Use clearcoat/environment reflections for highlights; do not depend on the generated base-color atlas for reflections.
4. Retain only independently reviewed surface details, lamp detail and decals. The current generated normal maps are disabled in the clean preview because they exaggerate surface noise.
5. Test red, white, black and one saturated color under overcast, golden-hour and moving studio lighting. Check glass/tires/lamps stay independent of paint and that highlights move with the scene.
6. Only after the existing cars pass this check, decide whether the next controlled Meshy experiment should omit generated textures (`should_texture: false`) or keep them solely as a segmentation/detail reference. The API exposes that option, but a texture-free car workflow has not been tested here. Do not change the paid queue configuration silently.

Meshy `remove_lighting: true` and `enable_pbr: true` were already used for batch 1; neither establishes that the returned base color is free of painted highlights. Final material masks and runtime lighting are a separate acceptance step. API reference: [multi-image-to-3D](https://docs.meshy.ai/en/api/multi-image-to-3d).
