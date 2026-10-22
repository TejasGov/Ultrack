# V2 implementation

The historical requests and asset decisions remain in [V2-BACKLOG.md](V2-BACKLOG.md).

## Driving

`PlayerInput` now requires meaningful controller intent before taking pad steering,
uses an 0.18 dead zone, gives held keyboard driving controls priority, and clears on
blur, hidden documents, menu transitions and car/driver changes. Pad reset is
edge-triggered. Respawn clears steering, drift direction, slip/assist history,
wheel rotation speed and camera acceleration history, preserving the nitro tank.

The viewer's `?dev=1` overlay reports held keys, controller axes, chosen input,
input steer and physical wheel angle. For the normal game use `?inputDebug=1`.
Focus loss pauses a live session. The intermittent original bug still needs a
long live-drive reproduction; automated tests cover twelve reset/swap cycles.

## Menus, HUD and credits

The home screen is a responsive mixed-size bento grid: four modes, garage,
current car, records, settings and credits. Arrow/d-pad navigation uses tile
positions. Settings retain left/right adjustment. Records show all twelve cars.
HUD panels share the rounded dark tiles while retaining the existing gauge,
timing, standings and minimap information. Reduced-motion CSS is respected.

The credits screen reads the five complete models' `model.json` source records,
including the Lamborghini exterior contributor and Audi/Ferrari distribution
limitations. The original model files and licenses are unchanged.

## Audio

Tesla and Audi use procedural motor/inverter, wind and tyre layers. EV motor
sound is silent at rest and deliberately quiet under power. Commentary passes
through 300 Hz high-pass / 3.5 kHz low-pass filters, gentle saturation, and a
95 ms slapback with low feedback. No paid SFX generation is used.

Combustion audio now uses ten real CC BY YouTube recordings, one per car,
through `recorded-engine-bank.json`. Fifty trimmed, seam-crossfaded mono Opus
loops total about 284 KB. Originals, captured licence metadata, exact trims and
source/output hashes are retained. Generated V1 engines, exhaust and boost
samples have no runtime fallback and are excluded from asset sync. Commentary
is unchanged. BMW uses an i8 recording; Bentley uses a W12 recording.

The old pitch clamp held notes steady across wide RPM gaps; both adjacent layers
now follow the requested RPM. Shifts briefly dip the real engine, without added
generated bangs. Source comparison and RPM/throttle controls are available at
`/audio-lab.html`. Listening review remains required. The AMG ONE recording is
limited to low-speed operation and needs a better high-RPM/full-load take.

```powershell
python tools/audio/build_recorded_engines.py
npm --prefix track-viewer run sync
python tools/audio/verify_recorded_engines.py
```

Source links and modifications: [recording credits](assets/audio/recordings/CREDITS.md).
The older Engine Simulator importer remains an offline alternative; the game no
longer reads its bank automatically.

## Model wheels, textures and render measurement

The garage rim tuner now assigns the rim material to explicitly identified
wheel surfaces on all five complete cars; tyres, discs, screws, badges and body
carbon remain separate. The existing wheel proxies use the same rim colour.

```powershell
npm --prefix track-viewer run pack:cars
npm --prefix track-viewer run pack:cars -- mp1x --size=512
npm --prefix track-viewer run build
```

KTX2 variants retain original GLBs as fallback. The viewer uses packed variants
listed in `assets/cars/texture-variants.json`; `?tex=webp` forces originals.
The shipped variants cap textures at 512 px. Normal maps use UASTC; colour and
data textures use ETC1S with appropriate colour space. Meshopt with 16-bit positions
and 14-bit normals reduces geometry downloads. Triangle counts, named nodes and
wheel placement are retained; geometry bounds pass a 1 mm tolerance.
Compression targets GPU texture memory. KTX2 download size can exceed
WebP, especially for normal maps; consult `texture-pack-report.json` rather than
assuming smaller downloads. With the combined packing, LOD0 sizes are:

| Car | Original MB | Packed MB |
| --- | --- | --- |
| AV-12 | 12.65 | 3.97 |
| Furari | 10.11 | 4.15 |
| McLaren | 0.69 | 0.38 |
| Mercedes | 2.35 | 1.33 |
| Audi | 3.01 | 1.46 |

These files have not yet had a live GPU visual review.

After loading the viewer, `await viewer.benchModels({frames:90})` renders six
model-quality instances near the grid, forces GPU completion per sample, and
returns mean/median/p95 time, draw calls, triangles and viewport dimensions. With
five unique authored cars, the sixth is a repeated instance. Warmup frames are
excluded; scene/camera/visibility are restored even on error. This measures a
render stress scene, not full physics/session frame time. No target-GPU benchmark
result is claimed in this pass.

## Checks

```powershell
npm --prefix track-viewer run test:v2
node track-viewer/scripts/test-car-textures.mjs
python tools/audio/test_engine_import.py
npm --prefix car-lab run check:vehicle
npm --prefix track-viewer run build
```

The menu smoke test constructs the actual Vite-transformed screens in a minimal
DOM and checks routing, spatial navigation, credits and the twelve-car records.
It is not a browser screenshot or a visual approval. Audio tests verify graph
routing, levels, mute/stop and stale-load cancellation; they do not replace listening.

## Roster, wet physics, facts, U-coins and HUD (2026-10-20)

Four parallel workstreams; details live in each owner's guide.

- **Cars** (`track-viewer/CAR-QA.md`): the Bugatti Divo replaces the Chiron-X shell (key `buggati`, "Divo-X"). New model cars: `destrier` (Bugatti Destrier) and `blackbird` (Hennessey Blackbird), both CC-BY. All three pass QA with 0 fails. The Blackbird's wheels, discs and calipers carry Forza Horizon part names, so they are likely ripped; this is flagged in its credit, as with the 488. Engine sound: destrier uses the W16 recording, blackbird the Mustang V8 (`sharedWith` in the bank; do not run `build_recorded_engines.py`, which drops them).
- **Teams** (`assets/teams/TEAMS.md`):
  - Seven teams now. Aurum is the Bugattis (Valois #1, Beaulieu #16). Liberty, the new American team, has the Mustang (#66 Maddox) and the Blackbird (#76 Hollis); it uses the Graduate font, royal blue/red/white, and royal-blue `light` strips. Mojave has the Bentley and the BMW.
  - Liberty's garage, banner, motorhome and flag were added with `tracks/marina/apply_teams.py`.
  - The track has only 12 pit boxes, so bmw1 and blackbird have none and are hidden when not racing.
  - 8 commentary lines saying "six teams" or "twelve" are retired in `script.json`. Regenerating the script would bring them back.
- **Physics** (`track-viewer/PHYSICS.md`):
  - Weather now reaches the tyres (`physics/weather.js`): about 87% of dry grip in damp and 80% in rain.
  - The yaw assist only damps over-rotation; it used to spin cars held at the limit.
  - `assets/cars/specs.json` holds real facts for all 14 cars, with sources and `estimated` fields; handling is calibrated from it.
  - Upgrade API: `setUpgrades`, `handling`, `vehicle.retune`.
  - Harness: `node track-viewer/scripts/physics-harness.mjs`.
- **Game UI** (`track-viewer/GAME.md`):
  - A new HUD (`hud.js`, `hud.css`).
  - U-coins (`economy.js`): 1,500 at start; race payouts 200-1,800.
  - Garage Specs and Upgrades tabs (engine, tyres and brakes, three levels each). The buy buttons work by mouse only, not yet by keyboard or pad.
  - Load order: the hero car first, rivals prefetched from the menu, and car-lab profiles loaded lazily per car. The main chunk went from 2.78 to 1.34 MB.
- **Checks:** `npm run test:v2` passes and `npm run build` succeeds. A headless 7-team rain race ran with no errors and no flipped cars, and a straight wet launch on Sport is stable. Not yet checked: driving by hand, listening, Time Trial and Free Drive screenshots.

## Endurance benchmark pass (2026-10-21)

Reference notes and frames: `research/endurance-benchmark.md`, `research/endurance/`.

- **Handling** (`track-viewer/PHYSICS.md`, "Turning"):
  - **Spin blocking removed.** The cause was the tyre curve (flat past its peak, rear-biased), a downforce term in the steering lock about 10× too strong, slow keyboard steering, and aids that acted from 2-4° of slide.
  - **Now:** full steer uses about 97% of grip, turn-in takes 0.17 s at 100 km/h, and lift, trail-brake, power and handbrake all rotate the car.
  - **Aids** start only past 8° (Casual), 13° (Sport) or 24° (Pro).
  - **Assist flags:** `vehicle.state.tcsActive`, `absActive` and `escActive`.
  - **Tests:** `npm run test:turning` and `npm run test:braking`.
- **Nitro, steam and spray** (`carkit/fx*.js`):
  - The nitro is soft violet plasma streams with a screen package (zoom blur, speed lines, edge chromatic aberration, sun streak); the crisp "saber" is gone.
  - Idle steam comes from the pipes, lit by the sun and the tail lamps.
  - Wet roostertails and mist appear behind the rear tyres.
- **Wet look** (`finish.js`, `wet-road.js`, `wet-rain.js`): rain beads on the paint and glass at chase distance, ripples on the puddles, streaky wet reflections, darker road under the cars, and a water film on the paint.
- **Camera and grounding** (`camera.js`, `carkit/chassis.js`):
  - Five views on C, with a name flash.
  - The camera yaw-lags into slides.
  - Nitro widens the view by 12° with a kick, and crashes get a damped shake.
  - The camera avoids walls.
  - Wheel jitter fixed (a spring on the suspension visual, a cap on visual spin).
  - Contact shadows are sized per car.
- **HUD** (`game/hud*.js`): an instrument cluster (tach with a redline band, an 11-segment shift rail, digit cells, a gear cell, nitro, TCS/ABS/ESC tags, an EV power dial) and a heading-up radar minimap. `M` switches to a track overview. Test: `npm run test:hud`.
- **Roster** (8 teams, 16 cars, 8 per race):
  - Toro (the Lamborghini team: AV-12 + Huracán STO) is new, with its lore in TEAMS.md. Saetta is now the Ferrari team (488 + LaFerrari).
  - New models: 918 Spyder (`porsche1`), Valkyrie, Huracán and LaFerrari. All four are game rips (Real Racing 3 and others), noted in their credits; the LaFerrari and Valkyrie are CC BY-NC-SA.
  - The track has 12 pit boxes for 16 cars.
- **Clean-up:**
  - 521.7 MB was archived, not deleted, to `_archive/2026-10-21/`, with `MANIFEST.md` and `restore.mjs`.
  - Docs moved to `docs/`, and the README has a repository map.
- **Checks:** all of these pass:
  - `test:v2`, hud, turning, braking, traction, arcade, pedals, brake-lights, scenery-lod, team-logos and car-textures;
  - progression, fx and the engine-bank verifier;
  - the build.
  
  A headless 8-car rain race ran with no console errors.
