# RaceUltimate

Team logos, colors and downloadable SVG/PNG/WebP assets: [brand gallery](http://127.0.0.1:5180/team-brand-guide.html).



Real engine listening/comparison page: [localhost audio lab](http://127.0.0.1:5180/audio-lab.html). Recording sources and licences: [audio credits](assets/audio/recordings/CREDITS.md).

Local racing game and vehicle assembly lab. Run the assembly lab with

`npm --prefix car-lab run dev`; run the track viewer with

`npm --prefix track-viewer run dev`.



## Repository map

Everything is local and runs from this folder. `npm --prefix track-viewer run dev` serves the game at http://127.0.0.1:5180 (it runs `sync` first); `npm --prefix car-lab run dev` serves the assembly lab at http://127.0.0.1:5173.

| Folder | What lives there |
|---|---|
| `track-viewer/` | **The game** (three.js + Rapier, Vite). `src/` runtime (`main.js` scene, `cars.js` car builder, `game/` menus, HUD, audio, garage, session; `physics/` vehicle, arcade handling, AI; `carkit/` lamps, mirrors, FX), `scripts/` build, pack and test scripts, `public/` the served copies that `npm run sync` writes (never edit; rebuild from `assets/` and `tracks/`), `qa/` and `shots/` generated QA reports and screenshots, `dist/` production build. App docs: `README.md`, `GAME.md`, `PHYSICS.md`, `CAR-QA.md`. |
| `assets/cars/` | One folder per car key. **Complete models** (12 cars) have `car_lod0/1.glb` and packed `car_lod0/1_ktx2.glb` from `track-viewer/scripts/model-car.py`, plus `model.json` (wheels, lamps, glass, exhaust), `source.json` and `license.json` (credits). **Shell cars** (`bentley-gt`, `bmw1`) still use the Meshy bodies `body_lod0/1.glb` (`npm run derive:cars`). Shared data: `tuning/<key>.json` (per-car QA fixes), `handling.json`, `driving.json`, `exhaust.json`, `finishes.json`, `specs.json`, `texture-variants.json`, `lods.json` (shell provenance). |
| `assets/teams/` | `teams.json` (7 teams, 14 cars, drivers, colours, fonts), `progression.json`, team logos and fonts, `brand-guide.html` ([TEAMS.md](assets/teams/TEAMS.md)). |
| `assets/audio/` | Game sound. `engines/recorded/` + `recorded-engine-bank.json` (real CC BY recordings, 14 combustion cars on 9 recordings), `recordings/` (plan, credits, receipts, `src/` originals), `announcers/` (script, voiced takes per speaker, `voice_manifest.json`), `crash/`, `crowd/`, `race/`, `fireworks/`, `manifest.json`. See [assets/audio/README.md](assets/audio/README.md) and [CREDITS.md](assets/audio/CREDITS.md). |
| `assets/drivers/` | One folder per driver: poster, hoarding and thumbnail WebPs, intro data, `source/` art direction and prompts. `gallery.html` is the review sheet. |
| `assets/characters/` | Trackside people. `mixamo/` FBX masters, Meshy character GLBs, `web/` the compressed set the game loads ([README](assets/characters/README.md)). |
| `assets/sponsors/`, `assets/brand/`, `assets/loading/`, `assets/polyhaven/` | Trackside brand marks, Ultrack logo files, loading-screen art, CC0 textures and HDRIs ([sponsors](assets/sponsors/README.md)). |
| `tracks/marina/` | The Corniche Marina circuit: Blender build scripts (`build_blender.py`, `venue.py`, `layout.py`, ...) and `out/` (blend files, `track.json`, `web/` GLBs). See [tracks/marina/README.md](tracks/marina/README.md). |
| `car-lab/` | The vehicle assembly lab (profiles, parts, `check:vehicle`). |
| `scripts/` | Blender/Python car pipeline: Meshy body shells, replacement-car preparation, coachwork fitting, `vehicle-pipeline.mjs`. See [vehicle-pipeline.md](vehicle-pipeline.md). |
| `meshy/`, `meshy_output/` | The Meshy queue (`cars.json`, [README](meshy/README.md)) and its raw outputs. |
| `sources/sketchfab/` | Provenance of every shipped third-party model: downloaded `model.glb`, `prepared.glb`, receipts and inspection renders in `replacement-imports/` (SHA-256 `manifest.json`). |
| `tools/` | Asset tooling: `audio/` (recording bank, announcer pipeline, verification), logo prep, Poly Haven fetch, Mixamo and Meshy character conversion. |
| `research/` | Reference studies and source-candidate lists (Endurance benchmark, driving model, engine candidates). |
| `docs/` | Feature notes and reports: [STARTUP-AND-TEAMS](docs/STARTUP-AND-TEAMS.md), [RACE-LOADING](docs/RACE-LOADING.md), [RUNTIME-FIXES](docs/RUNTIME-FIXES.md), [HOARDINGS-AND-SHELLS](docs/HOARDINGS-AND-SHELLS.md), [SCENERY-SECTORS](docs/SCENERY-SECTORS.md), [SCENERY-LOD-POC](docs/SCENERY-LOD-POC.md), [PROGRESSION](docs/PROGRESSION.md), [track-design](docs/track-design.md), [car-integration-report](docs/car-integration-report.md). |
| `references/` | `model-candidates/`: the Sketchfab candidate thumbnails compared when picking the Ferrari and Lamborghini models. |
| `_archive/` | Files taken out of the live tree, kept for review: `_archive/2026-10-21/MANIFEST.md` lists every item, why, and how to restore it. Delete a dated folder when you no longer need it. |

At the root: this README, [V2-IMPLEMENTATION.md](V2-IMPLEMENTATION.md) and [V2-BACKLOG.md](V2-BACKLOG.md), [project-plan.md](project-plan.md), [vehicle-pipeline.md](vehicle-pipeline.md), [endurance-rebuild-report.md](endurance-rebuild-report.md), the physics notes ([ARCADE-HANDLING.md](ARCADE-HANDLING.md), [DRIVING-CONTROLS.md](DRIVING-CONTROLS.md), [TIRE-GRIP.md](TIRE-GRIP.md)), the `concept-*.png|jpg` design sheets (the Meshy scripts read them from here), the logo source `Ultrack.png`, `La_furari.glb`, and the Sketchfab downloads (`2017-mclaren-720s.zip`, `2018-audi-e-tron-gt-concept.zip`, `mercedes_amg_one.glb`) whose hashes are in `sources/sketchfab/replacement-imports/manifest.json`.

### npm scripts (`track-viewer`, run with `npm run <name>` or `npm --prefix track-viewer run <name>`)

| Script | What it does |
|---|---|
| `dev` | `sync`, then the Vite dev server on 127.0.0.1:5180 (strict port). |
| `sync` | Copies the built track, HDRIs, characters, car models, audio, sponsor, team and driver art from `assets/` and `tracks/` into `public/assets/`. |
| `build` | `sync`, then the production build into `dist/`. |
| `pack` / `pack:ktx2` / `pack:cars` | Pack the Blender output into web GLBs (WebP, collision, KTX2); KTX2-compress the track; pack the car textures. |
| `pack:shells` / `pack:sectors` | Build the scenery shell and sector variants of the track GLB. |
| `derive:cars` | Derive the game LODs for the four shell cars from the car-lab bodies. |
| `qa`, `trace` | Run the per-car QA pipeline (`qa/<car>/report.md`); trace see-through gaps. |
| `test:v2` | V2 runtime checks (audio, steering, menu, credits). |
| `test:hud`, `test:loading`, `test:race-loading`, `test:driver-intro`, `test:hoardings`, `test:sponsors`, `test:team-logos` | HUD, loading flow, driver intros, trackside hoardings, sponsor and team-logo asset checks. |
| `test:car-textures`, `test:brake-lights` | Packed car textures; brake-light behaviour. |
| `test:track`, `test:sectors`, `test:scenery-lod` | Track collision contract; sector culling; scenery LOD (yachts, buildings, culling). |
| `test:traction`, `test:pedals`, `test:arcade`, `test:turning`, `test:braking` | Physics and handling harnesses. |

Other checks: `node scripts/test-progression.mjs`, `node scripts/test-fx.mjs <car...>` (exhaust, nitro and wet FX frames into `qa/<car>/`), `python tools/audio/verify_recorded_engines.py` (shipped engine audio against its receipts), `npm --prefix car-lab run check:vehicle`.

## Replacement car credits



The following third-party models replace the McLaren concept and Jaguar XKSS

respectively. Existing internal roster keys (`mp1x`,

`jaguarxkjss`) are retained for saved selections and team assignments.

The roster contains 14 cars.



| Model | Creator | Original source | Listed license |

| --- | --- | --- | --- |

| McLaren 650S GT3 | [Tyler_Dave](https://sketchfab.com/Tyler_Dave) | [2015 McLaren 650S GT3](https://sketchfab.com/3d-models/2015-mclaren-650s-gt3-e3e3452c86d74f6aa74a1ba60cfdf19b) | [CC Attribution](http://creativecommons.org/licenses/by/4.0/) |

| Mercedes-AMG One | [3dblender_1](https://sketchfab.com/3dblender_1) | [Mercedes Amg One](https://sketchfab.com/3d-models/mercedes-amg-one-77b02e5a555d4819b490f67eeb348d22) | [CC Attribution](http://creativecommons.org/licenses/by/4.0/) |



Licenses above were verified against the official Sketchfab model API on

2026-10-19; original metadata responses are retained in

[sources/sketchfab/replacement-imports](sources/sketchfab/replacement-imports).

McLaren and Mercedes are listed as **CC BY 4.0**. Attribution and a link to the

license must accompany redistributed models and derivatives.



### Changes made to the models



Converted supplied FBX files to embedded-texture GLB where needed, repaired local

texture references, separated material groups, added semantic paint/glass/lamp

roles, normalized dimensions and orientation, separated the original wheels at

their measured hubs, and derived runtime LODs. Body paint and lamp emission are

controlled at runtime; original trim, cabin, tires and wheel geometry are retained.



Source downloads are preserved at the project root. SHA-256 source/output receipts

are in [manifest.json](sources/sketchfab/replacement-imports/manifest.json).

Prior generated-car profiles are archived under

[sources/sketchfab/replacement-imports/previous](sources/sketchfab/replacement-imports/previous).



## Verification



`npm --prefix car-lab run check:vehicle` checks profile hashes, the 14-car roster,

legacy procedural assemblies and the new complete-model assemblies.

Both `car-lab` and `track-viewer` production builds are supported.



Front/rear Blender inspection renders are in

[sources/sketchfab/replacement-imports/review](sources/sketchfab/replacement-imports/review).

These are offline asset inspections, not screenshots of the running game.


## V2 runtime changes

See [V2 implementation](V2-IMPLEMENTATION.md) for steering fixes, the bento menu, credits, EV/PA audio, rim painting, packed model textures and benchmark tools. Remaining asset recording and live review tasks are tracked in [V2 backlog](V2-BACKLOG.md).

## Startup, electric team and original banner artwork

See [startup and team changes](docs/STARTUP-AND-TEAMS.md) and [logo provenance](assets/sponsors/README.md). Menus and the garage use a small, independently lit showroom. Startup fetches the selected car and track metadata; the circuit model, venue lights and driving assets load when a session starts.

See [race startup, brake-light and renderer fixes](docs/RUNTIME-FIXES.md) for the current loading flow, showroom and measured rendering changes.

Races now go directly from loading to the starting grid. Their actual seven drivers appear on trackside hoardings, using 1024px WebP posters; no full-screen driver introductions run. The review gallery retains all driver artwork. Run `npm --prefix track-viewer run test:hoardings` for lineup/placement/cleanup/startup checks. [Hoardings and scenery shells](docs/HOARDINGS-AND-SHELLS.md) documents the static-geometry cleanup and rebuild commands.
