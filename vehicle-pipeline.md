# Vehicle assembly pipeline

The working examples are the AV–12 and fresh McLaren MP1–X body-only shells. Open [the assembly lab](http://127.0.0.1:5173/assembly-lab.html) and use Car model, or [open MP1–X directly](http://127.0.0.1:5173/assembly-lab.html?car=mp1x). The generated body, paint, reusable parts, fit data and final color grade are independent. No provider call is made by the assembler.

## Phases and handoffs

| Phase | Work | Output / gate |
|---|---|---|
| 1. Body candidate | Prepare consistent body-only references; generate one untextured shell. Preserve source and task receipt. | Raw GLB, source hash and provenance. Inspect openings and panel quality before increasing content. |
| 2. Normalize and fit | Center X/Z, put the shell bottom at Y=0, normalize display length, then apply ride-height offset. Measure axle centers, track, radius, glass borders, mirrors and lamp paths. | A per-car JSON profile. Current coordinates are preview metres, not verified real dimensions. |
| 3. Paint | Apply shared physical paint, clearcoat and a body-space livery. Keep rubber, metal, glass and mirror materials separate. | Six example colors, custom color, four finishes, solid/twin/center liveries. Stripe contrast follows paint brightness. |
| 4. Shared hardware | Instantiate wheel resources at four named pivots. Add glass patches, mirror parts and LED paths from the profile. | Separately switchable components. Wheel geometry is shared per axle; brake calipers do not belong to the spinning node. |
| 5. Grade and review | Start with Neutral studio; inspect all sides and changing reflections. Then compare warm/cool grades, exposure, steering and track adjustment. | Actual browser captures and a fit review. Paint changes must leave hardware colors unchanged. |
| 6. Save the recipe | Save device preferences or export the complete JSON recipe, including source identity, profile, settings and resource versions. | Reproducible assembly instructions; the source GLB remains a separate file. |
| 7. Game preparation | Repair/reconstruct surfaces as needed, optimize a derived mesh, set real dimensions/collisions/physics and verify the look on the target device. | Game admission only after visual, fit and performance approval. The current raw shell is still a prototype. |

## Implementation

- `car-lab/src/vehicle/profiles/av12.json`: this car's source identity, normalization and attachment anchors.
- `car-lab/src/vehicle/parts.js`: procedural resource library. Track tires, split-10/turbine-12 rims, barrels, rotor details, calipers, mirror housings/stalks/faces, fitted glass and LED paths. No external car-part model downloads or new Meshy jobs are needed for these parts.
- `car-lab/src/vehicle/materials.js`: body/mirror paint, rubber, rim, rotor, glass and light materials. Body stripes need no texture atlas. Lower trim is currently a height-based approximation.
- `car-lab/src/vehicle/studio.js`: common lighting, filtered reflection environment, neutral/warm/cool color-grade pass and final tone-mapping/output conversion. Grading applies to the whole render; paint parameters stay unchanged.
- `car-lab/src/assembly.js`: assembly, visibility, steering, per-device saving and JSON export.
- `scripts/vehicle-pipeline.mjs`: source/profile integrity checks and pipeline outline.

For the next shell, create a sibling profile with its own hash and measured anchors, then use the same resource builders. Do not copy the AV–12 anchor positions blindly. Only the generated body and fit profile are car-specific; reusable parts can be improved once for every car. Shapes/UVs/paint do not need another AI texture pass whenever the player changes color.

## Commands

From `D:\RaceUltimate`:

```powershell
node scripts/vehicle-pipeline.mjs plan
node scripts/vehicle-pipeline.mjs check
```

From `D:\RaceUltimate\car-lab`:

```powershell
npm.cmd run dev
npm.cmd run check:vehicle
npm.cmd run build
```

The build verifies both body hashes before packaging the assembly page. The raw shells are about 59 MB and 58 MB in addition to the original paint-lab assets, so the build is not a release-size target. It excludes the old high-detail comparison sources.

## Review limits

The AV–12 source is 2,458,390 triangles and the new MP1–X source is 2,399,888 triangles, with generated surface ripples. Assembly and grading do not repair those surfaces. Wheel contact and separate materials are checked automatically; full steering/suspension clearance and final glass/mirror/lamp fit still need review. Current tires are procedural track-style resources, and lamp geometry is a prototype overlay rather than a finished optical housing. Mirrors reflect the environment map; they do not render a live rear-view camera. Glass is dark reflective glazing over a simple cabin insert, not a finished interior or full refraction simulation.

Scene nodes follow `body`, `wheels`, `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`, `*_spin`, `*_calipers`, `glass`, `mirrors`, and `lights`. The recipe exports configuration; it does not export a fully assembled GLB or implement driving physics. Source meshes and the Meshy batch queue stay unchanged.

## Reactive lamps / v2

`car-lab/src/vehicle/lights.js` builds black housings, separate clear/red lens materials, front LED signatures and projector cores, rear running/brake strips, a center stop lamp and white reverse segments. Front spotlights illuminate scene surfaces; short-range rear lights provide restrained spill. A modest HDR bloom pass makes bright emitters readable. Optics remain independent of body paint and liveries.

In the assembly lab, use **03 / Lighting**: Off / Running lights / Low beam / High beam, Brake input (0–100%), Reverse lights and Dim inspection. FRONT and REAR check visibility; BEAMS frames actual light footprints on the floor. Brake and reverse operate even when headlights are off. Hiding Lamp assemblies also hides their real lights. Settings persist and export as resource `reactive-optics-v2`; existing v1 saved settings receive the new defaults.

Runtime hookup:

```js
const lamps = createVehicleLights(profile, materials);
vehicle.add(lamps.root);
lamps.update({mode: 'low', brake: 0.8, reverse: false});
```

Feed this API from the brake pedal and reverse gear when driving is integrated. Brake input is clamped to 0–1. The static lab renders on control changes; driving should update lamps before rendering each frame.

Review gates: signatures visible in normal studio light, a clear running-to-braking increase, center stop active only during braking, independently white reversing lamps, and real forward illumination in BEAMS view. Tests cover mode switching, beam direction, brake/reverse with headlights off, input bounds and paint independence. This remains a fitted overlay prototype: final recessed lamp apertures, optical beam cutoff, headlight shadows/obstacle occlusion and wet-road reflection integration are pending. Current spotlights use inverse-square falloff but do not simulate automotive lens optics.


## Second-car handoff: MP1-X

The active McLaren profile is `car-lab/src/vehicle/profiles/mp1x.json`, registered in `car-lab/src/vehicle/profiles.js`. It references the fresh `meshy_output/mclaren-body-only/model.glb`, not a cut-down complete-car donor. Generation task `01a151a5-03d3-7389-964c-9c1be101df35` consumed 20 credits. The attempted local extraction remains archived under `meshy_output/mclaren-assembly/`, including its original fit profile and receipt.

The shared factories use car-specific wheel, glazing, mirror and lamp anchors. Source normalization is shared in `body.js`; reference bounds are supported for derived meshes, while fresh body-only generations use their own bounds and ride-height offset. Paint, rims, lights and saved recipes remain independent per car. RAW SHELL opens the matching old-vs-new generation comparison in development.

`node car-lab/inspect-assembly.mjs` must be run from `car-lab/` as `node inspect-assembly.mjs`; it exports a geometry inspection GLB. `scripts/render-assembly-fit.py` produces clearly labeled offline fit renders using pyrender/trimesh (the engine shader/postprocessing are not reproduced). A browser policy block prevented live UI inspection in this run. Final in-engine fit approval is still required.

## Optical placement correction

The first MP1-X lamp paths were visibly outside the generated recesses. Reusing a light controller does not make its geometry fit another body. The correction traces the actual front/rear openings and stores shell-specific `frontRecess` / `rearRecess` data in the MP1-X profile, pinned to the source GLB hash.

`scripts/inspect-lamp-cavities.py` (optionally `--front`) creates orthographic measurement grids. `scripts/fit-mclaren-rear-lamps.py` (optionally `--front`) intersects exact source triangles along each guide, separately for the two sides. These helpers require NumPy/SciPy and rtree; the measurement renderer additionally uses pyrender/trimesh/Pillow/matplotlib. They can find the optional local tools under the user's `AppData/Local/Temp/raceultimate-render-tools` directory.

The optical lens spans the measured cavity rim. A black housing with side walls fills the recess depth; the lens and small volumetric diffuser sit on its cap. Simply following the cavity floor causes sections to disappear behind deep generated folds. The front modules replace the old fender-height strips and use smaller projector housings. The center stop lamp sits on the rear glass. Rear spill is offset and reduced to avoid bright red pinpoints on the bumper.

The runtime reuses this geometry through `lights.js`, with the existing running/low/high/brake/reverse controls. Exported MP1-X recipes identify `cavity-optics-v3`. The AV-12 retains its existing lamp geometry. Source shell bytes and generation costs are unchanged. New tests reject fits from another shell and check rim clearance, front-slot height, the high center stop position and finite geometry. Live front, rear and rear three-quarter views are now accessible and reviewed; the earlier browser-inspection limitation applied to the initial assembly run.

## Body batch 2: ST-6, 911-T and Valkyrie

### Lamp design decision — required for every future car

Read the concept's complete lamp design before preparing geometry. Classify `lights.headlamp.type` explicitly as `enclosed` (a complete housing/lens with internal optics) or `signature` (the integrated McLaren/Lamborghini treatment). Store the visual rationale in `design`; validation rejects an undeclared choice. Reusing the controller does not justify copying another car's lamp geometry.

For an enclosed lamp, preserve and trace the full outer aperture separately from the running-light pattern. Fit the housing depth, black backplate and cavity walls, sealing gasket, clear full cover, metallic reflector cups, convex projector lenses or matrix chambers, and the concept's internal running-light elements. Low-beam and high-beam elements switch independently. Inspect with lights OFF as well as running/low/high: the lamp must remain a complete recognizable assembly without emission. Follow the actual shell's aperture and span cavity folds at the rim rather than placing optics on generated interior surfaces.

Batch 2 now uses `enclosed-headlamps-v4`: Mustang twin projectors with three running-light slashes; Porsche stacked low/high projectors with four-point running lights; Valkyrie four-cell matrix with upper/lower running lights. `headlamp-designs.json` records the design layouts in world Y/Z; the fitter converts these to shell-local coordinates and pins the aperture to its GLB hash. AV-12 and MP1-X explicitly retain their signature designs. These changes use local geometry and consume no Meshy credits.

The next three queue concepts now have fresh untextured Meshy body shells in `meshy_output/body-batch-2/`, with 20 credits consumed each. That directory's README and batch-state.json retain task IDs, owning resources, project directories, hashes, prompt/reference provenance and actual charges. The existing textured batch queue is historical and is not used for body-only generation.

All three are registered in the assembly selector and packaged by Vite. Profiles provide individual wheel/glass/mirror anchors and source-pinned frontFits/rearFits. The light factory supports multiple modules per side, closed-aperture backing bowls and full lens covers; the previous AV-12 and MP1-X geometry remains supported. Tail-spill positions are per profile. The Valkyrie also uses a wrapped windshield, with its edges behind the frame, and separate glass reflection settings.

`scripts/fit-body-batch.py CAR` rebuilds optical fits from reviewed world Y/Z guides in `meshy_output/body-batch-2/fit-guides.json`. Measurement grids come from `scripts/inspect-lamp-cavities.py --car CAR [--front|--side]`. Runtime anchors are local to each shell after normalization; world-space assembly guides are archived separately. No paid processing occurs during fitting.

Thirteen component tests and the production build pass. Actual browser captures cover front, rear and hero views for each car, plus Valkyrie floor illumination and alternate paint. These models are assembly-review prototypes: 1,151,696 / 2,156,168 / 2,784,314 body triangles. Final surface cleanup, glass edge seals, suspension/steering clearance, optical cutoff/occlusion, LODs and driving integration remain.


Mirror fit: use scripts/fit-mirror-mounts.py after fitting a new body. Store independent signed surfaceMounts and mounts, with feet 18 mm into solid source triangles. Connect stalkEnd to housing center with a neck; verify side and front views. Batch-3 lamps use rim-interpolated covers for full Y/Z curvature.


For future cars, retain provider model.glb, create a derived model-clean.glb with clean-body-surface.py, verify it with verify-surface-cleanup.py, preserve donor normalizationBounds, then fit lamps and mirror mounts against the cleaned hash. Inspect strong moving reflections before approving surfaces. Surface fairing reduces local noise; broad generated dents still require panel reconstruction.


## Roadster panel reconstruction

The Roadster has a separate local reconstruction chain; its original Meshy files remain untouched. `scripts/rebuild-roadster-panels.py` fits broad door, hood, roof and fender surfaces and introduces shoulder/sill folds and recessed seam guides. This intermediate retains the donor topology and has its own reconstruction receipt. It is not the final runtime skin.

`scripts/refine-roadster-blender.py` gives thin panels inward thickness, voxel-remeshes at about 4.35 mm in display units, fairs the reconstructed surface and reduces its density. The resulting `model-refined.glb` has new topology. Do not apply the intermediate topology-preservation claim to this output. `scripts/fit-roadster-coachwork.py` projects door, hood and hatch gaps and flush handles onto the final mesh; rerun the existing lamp and mirror fitters afterward. The runtime profile and all fitted details are pinned to the final body hash. Paint choices remain independent of panel recesses, glass and tires.

`node car-lab/inspect-roadster.mjs` exports the current component assembly; `--before` exports the previous skin for comparison. `scripts/render-roadster-blender.py` renders both and saves an editable Blender master. These are offline Blender asset proofs; they do not reproduce the in-engine procedural trim shader or postprocessing. Browser security blocked live-page inspection during this repair. `scripts/verify-roadster-coachwork.py` audits the final serialized geometry, normals, source preservation and fitted-detail hash.

After Blender refinement, run `scripts/clear-roadster-apertures.py` to remove remaining painted fragments inside the intended side and windshield apertures, then rerun all fitters and the body audit. `aperture-cleanup.json` records this separate geometry cut.


## Nuvolari identity and rear design

The Nuvolari retains its original cleaned shell (719,166 triangles); the Tesla's broad refit/remeshing was deliberately not copied. `scripts/fit-nuvolari-coachwork.py` projects narrow door, hood and hatch seam ribbons and two flush handles onto this shell. These are added surface details, not independently opening or cut body panels. `scripts/fit-nuvolari-design.py` fits chrome four-ring Audi emblems front and rear, a smoked lamp surround, satin rear inlay, dark diffuser and oval exhaust tips against actual triangles. Source hashes bind both detail sets to the shell.

`body.trimRegions` assigns the integrated front grille its own dark material in the normalized runtime geometry without changing positions, normals or triangle count. The shell paint material remains shared with paint controls; grille and rear trim remain independent. Future trim regions require a visual aperture review and finite bounds validation. This is specific to the Nuvolari; other bodies retain their material path.

`car-lab/inspect-nuvolari.mjs` exports the component assembly; `scripts/render-nuvolari-blender.py` renders front, rear and side proofs and saves `meshy_output/body-batch-4/nuvolari/nuvolari-coachwork.blend`. Blender proofs do not reproduce in-engine grading/procedural livery. `car-lab/verification/nuvolari-design-review.json` records the scope and checks. 27 component tests and production build pass. No provider calls or changes to the donor GLB. Existing generated surface warping remains; this pass adds panel definition and styling rather than claiming complete body retopology.


## Jaguar XKSS heritage detailing and twin exhaust

`scripts/fit-jaguar-coachwork.py` fits four narrow seam ribbons and chrome pull handles to the actual cleaned shell. Handle anchors follow the existing molded handle area; the classic silhouette is retained. The seams are added surface detail, not physically opening panels. `scripts/fit-jaguar-design.py` fits chrome rear bumper rails, a dark period-style XKSS plate and two central rear pipe entry points. The original GLB and its existing lamp/louver/mirror fits are unchanged. Plain rear glazing is omitted when the opaque louver assembly is present, eliminating protruding glass corners.

`createExhaust(profile)` in `car-lab/src/vehicle/exhaust.js` creates hollow stainless pipe walls and dark recessed bores, plus two named nitro sockets. The pipe bases penetrate 60 mm into the fitted body; mouths extend 140 mm outward. Geometry uses the source normalization frame plus body lift. Socket local +Z is the exit direction (vehicle local +X for this car); use `socket.getWorldPosition` and `getWorldDirection` when adding a game effect after vehicle transforms. Source hashes guard all detail sets. Paint controls do not recolor stainless, chrome or dark bores.

The controller returns `{root,sockets,update}`. Drive `update({boost: normalizedAmount, time: elapsedSeconds})` from the eventual gameplay controller. It clamps boost to [0,1], defaults off, and provides a simple blue plume/spill preview. The lab-only NITRO PREVIEW button animates both outlets and moves to a rear view; STOP NITRO, reset or page exit stops it. Preview activation is not saved as a vehicle setting. This does not implement boost physics, consumable nitro or production particle effects.

`node car-lab/inspect-jaguar.mjs` exports the normal assembly; `--before` omits new details, and `--boost` exports the preview effect. `scripts/render-jaguar-blender.py` creates local inspection images and `meshy_output/body-batch-4/jaguarxkjss/jaguarxkjss-coachwork.blend`. The saved master defaults to the ordinary assembly. Proofs are Blender renders; additive blending/postprocessing differs from the runtime. `car-lab/verification/jaguar-design-review.json` records source preservation and checks. 29 component tests pass, including outward sockets, default-off effects, hollow pipes, ground clearance, paint independence and no redundant glass behind opaque louvers. Existing generated body warping remains a separate surface issue.


## Furari 488-R: twelfth assembly entry

The omitted Furari now has a fresh untextured body-only job in `meshy_output/body-batch-5/`, preserving the original textured batch-1 model and the user-provided `La_furari.glb`. Generation and local repair receipts are retained beside the files; one accepted Meshy generation cost 20 credits. No paid regeneration was used to repair filled canopy geometry.

`clean-body-surface.py CAR BATCH` and `verify-surface-cleanup.py CAR BATCH` now support the new batch while retaining their previous defaults. `bootstrap-furari.py` creates the initial source-bound profile; reviewed world-space lamp traces are in batch-5 `fit-guides.json`. The mirror fitter measures each side independently. `fit-furari-glazing.py` opens the filled front/rear canopy and generates actual-surface glass grids. `createGlass` uses those grids and rubber perimeter seals when supplied. Every fitted component is pinned to the final derivative hash; rerun lamp/mirror fits after changing that body.

`inspect-furari.mjs` exports the actual component factories for Blender review. `render-furari-blender.py` produces front/rear/side, straight rear and default-off versus preview boost proofs; a saved `.blend` master retains the ordinary assembly. The final source has fixed dark wing/diffuser regions, yellow calipers and twin hollow steel exhausts. The original raw and cleaned donor files remain untouched.

`scripts/check-vehicle-roster.mjs` loads the actual Vite vehicle registry and checks that every profile file has a unique selector entry. It specifically verifies that `furari-488` resolves rather than falling back to AV-12. The check is part of `npm run check:vehicle` to prevent future omitted models. Twelve profiles and 31 component tests pass. Generated body quality and final gameplay integration remain separate gates.
