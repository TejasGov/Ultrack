# Car QA pipeline

Every car goes through the same sandbox, checks and test drive before it counts as done. Fixes are data, not new models:
no Meshy credits are spent. The sandbox builds each car with the race's own code (`src/cars.js` → `assemble`), so a
car that passes here looks and behaves the same on the track.

## Run it

```bash
npm run dev
```

```bash
npm run qa -- av12
```

- `npm run qa -- all` runs the 14 cars one after another (about 10-15 s each).
- `sandbox.html?car=av12` is the interactive version: orbit the car while the test drive loops.
- `npm run trace -- <car>` traces every see-through gap in the car's last report. Each gap gets a magenta-background close-up (`qa/<car>/trace-<view>-<n>.png`) and the line's path through the car in body metres.
- **New tuning files:** after adding a file in `assets/cars/tuning/`, restart the dev server. It only watches its own folder, so a new file is not seen until then; edits to existing files are picked up.

Results go to `qa/<car>/`:

| File | What it shows |
|---|---|
| `report.md`, `report.json` | Every check: pass / warn / fail, what was measured, what is expected, and where the fix goes. |
| `look.png` | Studio turntable, dusk and night, and the low three-quarter close-up. |
| `reference.png` | Our close-up beside the Endurance garage frames in `qa/reference/`, the realism target. |
| `masks.png` | Silhouettes from 11 directions. Red means you can see through the car; blue means the glass misses an opening. |
| `lamps.png` | Tail lamps off the brake and on it, at dusk and at night, with measured brightness. |
| `drive.png` | The scripted test drive: idle smoke, launch wheelspin, lift-off pops, a hard stop (nose dive, airbrake, brake lamps), cornering roll, a drift with tyre smoke, nitro, and the tail lamps after the stop. |

## The checks

| Check | Pass when | Fix in |
|---|---|---|
| see-through | No gap of 20 cm² or more from any of 11 views, with every part in place. Spoke gaps and the daylight under mirror arms don't count. | Automatic interior fills (`src/carkit/interior.js`). For a gap that survives them, trace it (below) |
| glass-cover (advisory) | The glass covers at least 90% of the shell's openings. This count includes vents, so it only warns. | `tuning.glass.scale` |
| glass-fit | 5% or less of the glass lies on top of paint, and 30% or less under it. | `tuning.glass` |
| wheels | Clearance ≥ 0 all round the arch (a lip under 2 cm warns), a top gap of 1.2-12 cm, and the tyre face within -10 to +4 cm of the bodywork. | `tuning.suspension.ride` (raises the body). An arch lip inside the tyre needs a shell fix. |
| exhaust | Every point sits on the rear surface with a clear exit, and left and right mirror each other. | `assets/cars/exhaust.json`; `?debug=exhaust` in the viewer |
| mirrors | Real-style tuned housings on both sides, symmetric within 2 cm, 1.5-32 cm off the body. | `tuning.mirrors` |
| lamps | Off the brake: red, luminance under 125 (lit lens, no glow). On the brake: at least 110 and at least 2× off. | `tuning.lamps` |
| pitch / roll | 0.8-3.2° nose dive at 1 g braking; 0.6-3.5° of roll in a corner. | `tuning.suspension` |
| travel | The tyres stay clear of the arches with the nose down under braking. | `tuning.suspension` (`pitch` lower or `ride` higher) |
| aero | If the car has active aero, it deploys at least 80% under braking. | `tuning.aero` |
| fx | Idle smoke, pops, nitro and drift smoke all appear. Electric cars: nitro only. | `exhaust.json`, `src/carkit/fx.js` |
| premium | Judged by eye from `look.png` and `reference.png`. | `finishes.json`, mirrors, lamps. A limit of the body's shape needs a better source model. |

## Per-car fixes: `assets/cars/tuning/<car>.json`

```jsonc
{
  "mirrors":    { "style": "blade|gt|bullet", "housing": "paint|accent|carbon", "scale": 1, "offset": [x, y, z] },
  "lamps":      { "tail": 0.1, "tailNight": 0.28, "brake": 6, "stop": 5, "head": 0.35, "beam": 0.22 },
  "suspension": { "pitch": 1, "roll": 1, "freq": 1.4, "damping": 0.45, "ride": 0 },        // ride in metres
  "interior":   { "tub": true, "plates": true, "liners": true, "tubInset": 0.06 },
  "glass":      { "scale": [1, 1, 1] },
  "wheels":     { "front": { "dx": 0 }, "rear": { "dx": 0 } },                         // m, -x = forward: centre a tyre in its arch
  "qa":         { "waive": [{ "view": "front-left", "at": [0.74, 0.66], "why": "daylight under the rear wing (traced: trace-front-left-0.png)" }] },
  "aero":       [{ "name": "wing", "min": [x, y, z], "max": [x, y, z], "hinge": [x, y], "mode": "airbrake|speed", "deg": 18, "rise": 0, "vOn": 20 }],
  "log":        ["what each run found and what changed"]
}
```

- **Coordinates:** body metres in car-lab's frame. The nose is at -x, the tail at +x, left is +z, and y=0 is the bottom of the body.
- **Tuning file:** a car without one gets car-lab's generic mirrors and the default levels.
- **Paint:** comes from `assets/cars/finishes.json`.
- **Exhaust and nitro points:** come from `assets/cars/exhaust.json`.

## The loop, one car at a time

1. `npm run qa -- <car>`. Read `report.md`, then look at `masks.png`, `lamps.png`, `drive.png` and `look.png`.
2. **Before fixing, prove each failure is real.** `npm run trace` shows exactly where a see-through gap is. Several times the check was wrong, not the car:
   - The arch rays hit the new interior parts.
   - The see-through mask counted the gap under the mirror arms.

   - The mirror gap was measured from the arm's foot instead of the housing.
   - A single sideways ray slipped over the bonnet.

   An opening that is real on the real car can be waived in `qa.waive`, with the trace that proves it. Examples: daylight under a wing, splitter slots, a waist channel seen exactly end-on. The report lists every waiver with its reason.
3. Fix it in the tuning file, or in shared code when every car has the same problem. Add a line to `log`.
4. Run again until nothing fails. Then judge `look.png` and `reference.png` by eye.
5. The race picks up the change on reload. No other step.

## Shared fixes this pipeline added

- **Hollow shells** (`carkit/interior.js`). Meshy bodies are double-walled skins with no cabin or floor, and with open cowls, decks and intakes, so you could see the road through the car. The fills are dark parts shaped by rays fired at the shell, so they can't poke through the paint:
  - a floor across the footprint;
  - a centre keel up to seat height;
  - tapered bays through the front and rear compartments;
  - a firewall and a rear bulkhead;
  - arch liners;
  - a cabin tub with seats.

  They are merged into two draws per car and drawn only within ~45 m.
- **Mirrors** (`carkit/mirrors.js`): blade, gt and bullet housings on swept arms, replacing car-lab's look-alike set. The glass is tinted and slightly rough, not a live mirror.
- **Lamps** (`carkit/lamps.js`): tail lamps are dim red until the brake, then several times brighter, enough to bloom.
- **Suspension** (`carkit/chassis.js`): the body pitches, rolls and rides on damped springs; the wheels stay on the road.
- **Active aero** (`carkit/aero.js`): Meshy fuses the wing to the body, so the moving part is cut out by a region box and hinged.
- **Effects** (`carkit/fx.js`): exhaust smoke, backfire pops, nitro flames stretched along the jet, and drift tyre smoke. Two draw calls in all.

## All 16 cars (after the first full pass; the Divo, Destrier and Blackbird added 2026-10-20; the Valkyrie, 918, Huracan and LaFerrari swapped or added 2026-10-21)

| Car | Pass / warn / fail | Mirrors | Ride (m) | Active aero | Waived openings |
|---|---|---|---|---|---|
| av12 (model) | 9 / 2 / 0 | its own | 0.015 | - | daylight under the rear wing; diffuser fins |
| aston-martin-valk (model: Valkyrie) | 8 / 2 / 1 | its own (camera pods) | 0.03 | - | see-through gaps accepted |
| porsche1 (model: 918 Spyder) | 8 / 2 / 1 | its own | 0.01 | - | see-through gaps accepted |
| ford-gt (model: GT Mk II, replaced the Mustang 2026-11-01) | 8 / 2 / 1 (the lamp check, see below) | its own | 0.06 | - | flying-buttress tunnels, daylight under the wing |
| buggati (model: Divo) | 10 / 1 / 0 | its own | 0.01 | - | daylight through the open rear wing and behind the tail |
| mp1x | 8 / 4 / 0 | blade carbon | 0.034 | wing, airbrake | waist channel end-on; daylight under the wing |
| jaguarxkjss | 9 / 2 / 0 | bullet paint | 0.05 | - | - |
| bmw1 | 9 / 2 / 0 | gt paint | 0.019 | - | - |
| bentley-gt | 8 / 3 / 0 | gt paint | 0.034 | - | - |
| furari-488 (model) | 8 / 3 / 0 | its own | 0.02 | - | - |
| destrier (model) | 10 / 1 / 0 | its own | 0.03 | - | rear fender ducts; daylight under the open rear wing |
| blackbird (model) | 10 / 1 / 0 | its own | 0.065 | - | - |
| huracan (model: Huracan STO) | 9 / 1 / 1 | its own | 0.045 | - | see-through gaps accepted |
| laferrari (model: LaFerrari) | 9 / 1 / 1 | its own | 0.035 | - | see-through gaps accepted |

- **Warnings left:** arch-lip overlaps under 2 cm, brake-dive margins under 1 cm, the advisory glass count, and the Valkyrie's top-exit exhaust points (they sit in its rear deck).
- **Shared fixes from this pass:**
  - A-, B- and C-pillar panels;
  - a dark greenhouse volume, so you can't look through two windows and out of the car;
  - mirror housings placed clear of the side glass at their own height, with left and right mounts averaged;
  - floor height capped against stray hits inside the shell;
  - floor width at the wheels set from each axle's real track.
- **Per car:** the history of each car's changes is in the `log` of `assets/cars/tuning/<car>.json`.

## Complete models (`scripts/model-car.py`)

On 2026-10-19 the AV-12 and the Furari 488-R swapped their Meshy shells for complete Sketchfab models: their own glass, cabin, lamps, mirrors and real wheels.
- **Inputs:** `assets/cars/<key>/source.json` sets the source GLB, real length, rotation, wheel parts, material roles and budgets.
- **Build:**

  ```bash
  blender -b -t 6 --python scripts/model-car.py -- ../assets/cars/<key>/source.json
  ```

  It writes `car_lod0.glb`, `car_lod1.glb` and `model.json` (wheels, lamp and exhaust points, side glass, credits). `npm run sync` (part of `npm run dev`) copies the GLBs.
- **Game:** `cars.js` takes the model path whenever `model.json` exists. Paint, glass, mirror glass, head/projector/tail lamps and calipers wear the game's materials (team paint and livery, brake lamps). Everything else keeps the model's own textured material. The wheels hang off the same physics pivots.
- **QA differences:** the mirror check only needs the model's mirrors present and symmetric. The arch check skips hits inside the rim (uprights and suspension).
- **Paint tuner:** wheel colour changes nothing on these two cars, because their rims keep their own material. Caliper colour still works.

### Divo, Destrier and Blackbird (2026-10-20)

Three more complete Sketchfab models, all CC-BY 4.0 (credits are in each `model.json`, so the credits screen shows them):

| Key | Model | Author | Triangles (body / wheel) | Length used | Notes |
|---|---|---|---|---|---|
| `buggati` | Bugatti Divo | Sloftm_Carz | 96.8k / 4.2k | 4.97 m (the real car's) | Replaces the Meshy Chiron-X. The Meshy shell (`body_lod*.glb`) and its old tuning (`tuning/buggati.meshy-shell.json`) were moved to `_archive/2026-10-21/` (see its `MANIFEST.md`); so were the shells of every other complete model. |
| `destrier` | Bugatti Destrier | let's not care abt it | 73.5k / 10.0k | 5.07 m (the model's own scale: Bugatti has published no length; it stands about 1.0 m tall as the press release says) | New car, no car-lab profile. |
| `blackbird` | Hennessey Blackbird | let's not care abt it | 80.9k / 10.0k | 4.9 m (Hennessey has published no length; chosen so the tyres are a real 0.68-0.71 m) | New car, no car-lab profile. **Wheels, discs and calipers carry Forza-style names** (`Hennessey_VenomF5_2020_Wheel1A...`, `...Reward_2023_CallipersCalliperA_Zone_Ma`): probably ripped from a game, so replace before any public release. |

- **No car-lab profile needed.** `cars.js` builds a model's profile from `model.json` alone (`modelProfile`); `KEYS` takes any team car that has a profile or a model; `carName(key)` gives the model's `name` (source.json `name`), else car-lab's, else the key.
- **New `source.json` options** (`scripts/model-car.py`; the AV-12 and Furari outputs are byte-identical):
  - `wheels.region` + `wheels.maxR`: name patterns of objects that mix wheel faces with body faces in one material. Only the faces inside a wheel (within `maxR` of the tyre radius around the axle, inside the tyre's width) become wheel parts. The Divo needed it for its rim, grille, tyre-liner and caliper materials.
  - `drop`: now applied before the model is measured (the Blackbird file carries a 28 m ground plane).
  - `materials`: `{ "<name>": { color, metallic, roughness, emission } }`, for a surface the game lights badly (the Divo's metal-1 grille read as chrome; the Destrier's blue DRL emission 10 bloomed white).
  - `name`: display name, written to `model.json`.
  - `mirrorGlass`: as before, for a mirror whose glass is part of the paint or another atlas material (Divo: faces of Material.005; Destrier: faces of the paint). The Blackbird has a real mirror material (`Material.020: "mirror"`).
- **Tail lamp check** needs red off the brake (red/green over 1.8) and the on level twice the off level. Cars whose lamps are thin LED bars between carbon (Divo) read a high off level, so they need a high `brake` (Divo 45) instead of a low `tail`.
- **Warnings left:** the Blackbird's tyre check (front tyre face 6 cm proud, rear tyre face 50 cm outside the tub, the rear fenders are open by design) and the advisory glass count.
- **Texture packing:** `npm --prefix track-viewer run pack:cars -- buggati destrier blackbird`. It now keeps the other cars' rows in `texture-pack-report.json`. `sync-assets.mjs` copies a car folder that has `car_lod0.glb` even without `body_lod0.glb`.
- **Engine sound:** `destrier` plays the Chiron W16 recording, `blackbird` the Mustang GT V8 (the Blackbird is a naturally aspirated V8; no twin-turbo V8 fits). They are `sharedWith` profiles in `assets/audio/recorded-engine-bank.json`; `tools/audio/verify_recorded_engines.py` accepts them. `build_recorded_engines.py` rewrites the bank from `plan.json` and would drop them: re-add after a rebuild.

### Valkyrie, 918 Spyder, Huracan STO and LaFerrari (2026-10-21)

Four more complete Sketchfab models. **All four are game rips** (credits carry this in `additionalCredits`, so the credits screen shows it; fine for this local non-commercial fan project, replace before any public release):

| Key | Model | Author, licence | Triangles (body / wheel) | Length used | Rip verdict |
|---|---|---|---|---|---|
| `aston-martin-valk` | 2020 Aston Martin Valkyrie, `name` "Valkyrie-X". Replaces the Meshy shell (`source.replacement`) | OUTPISTON, CC BY-NC-SA 4.0 | 36.3k / 2.8k | 4.5 m (real; the wheelbase and the 0.715 m rear tyre both match) | Certain: the page says "source: Real Racing 3"; parts are `LOD_A_<PART>_mm_<material>`, textures `*.etc.png` |
| `porsche1` | 2015 Porsche 918 Spyder (Weissach wing), "918-S". Replaces the 911 shell (`source.replacement`) | Galaxy Car Showroom (adrianaflak09), CC BY 4.0 | 26.2k / 1.1k | 4.643 m (real) | Likely: Unity-style prefab parts (`Bodyrefunblend...`, `Puncheff...` additive glow quads), baked atlas; same uploader as the Huracan |
| `huracan` | 2023 Lamborghini Huracan STO, "HU-10" (new key, team `toro`) | Galaxy Car Showroom (adrianaflak09), CC BY 4.0 | 36.4k / 3.0k | 4.547 m (real; the maker's sheet says 4,549) | Likely: Real Racing 3 names (`2021_lamborghini_huracan_sto_ext_blu_laufey.etc`) |
| `laferrari` | 2013 Ferrari LaFerrari, "La Furari" (new key, 2nd car of `saetta`) | OUTPISTON, CC BY-NC-SA 4.0 | 19.6k / 1.6k | 4.702 m (real) | Certain: same Real Racing 3 structure as the Valkyrie from the same uploader |

- **`model-car.py` is unchanged.** The rips have no usable object names (`Object_57` under a parent called `LOD_A_TYRE_mm_tyre`) and one "ext" atlas that mixes paint and carbon, so a new step prepares them first: `blender -b -t 6 --python sources/sketchfab/prepare-cars.py -- <valkyrie|laferrari|huracan|p918>` writes `sources/sketchfab/<folder>/prepared.glb`, and `source.json` points at that. It flattens the file to world space and gives parts the names the wheel patterns find (`Tyre_`, `Spin_` for rim and disc, `Caliper_`, `INT:` for the cabin) and every material the role tag (`paint|`, `glass|`, `tail|`, `headkeep|`, `mirror|`, `mirrorHousing|`, `caliper|`, `keep|`).
- **Paint.** Valkyrie: every "ext" part except struts, wheel discs and the exhaust surround. LaFerrari and Huracan: the same, but a face whose atlas texel is dark (luminance under 0.13) stays the model's own, so the black roof, the Huracan's bonnet centre and the carbon aero stay black. The 918's paint is its own "918_Spyder_Paint" part.
- **Lamps.** Rear lamps are the model's `TAILLIGHT_LENS` and `BRAKES_*` lamp parts (Valkyrie, LaFerrari, Huracan) or, on the 918, the faces of the atlas part with a red texel at the tail. Headlamps: the model's `HEADLIGHT_LENS` cover is `headkeep` (its own look, beam points from it; one object per side so the player car gets two beams); on the 918 the front lens faces of its single glass object. All four tail lamps pass the lamp check without a `tuning.lamps` entry.
- **Mirrors.** LaFerrari and Huracan have real mirror glass. The Valkyrie has none (camera pods): its door "misc" parts are the pods and their rear-facing faces are the `mirror` glass (`cars.js` only collects the game's mirror-glass material into `sideMirrors`, so a car needs that role on each side to pass). The 918's mirror glass is the 19-face plate at each housing.
- **Brake calipers and rims.** Valkyrie, LaFerrari, 918: calipers wear the game's caliper material (`finishes.json` colour); the Huracan has none (the disc is baked into its wheel). Rims keep the model's own material (`model-rims.js` has no entry for these keys), so the finish `rim` colour changes nothing.
- **Tuning** (`tuning/<key>.json`; `porsche1` and `aston-martin-valk` use the `replacement` block): the rips' arches are tight, so `ride` 0.01-0.045 m, `pitch` 0.45-0.8. A ride that opens the arch top gap past about 0.15 R trips the poke ray (it starts 1.15 R over the hub) and reads 0.2-0.5 m: that is the measurement, not the car. The 918's rear arch is open by design (top gap 9 cm), so its warning stays.
- **Warnings left:** the advisory glass count on all four (the models' glass has no opening polygons to compare), the 918's rear poke artefact, and the Valkyrie's exhaust (below).
- **Exhaust points.** `exhaust.json` belongs to the FX work. `huracan` and `laferrari` have no entry and use the points `model-car.py` found (`model.json` `exhaust`: Huracan [0.566, +-0.355], LaFerrari [0.318, +-0.694], both `[height, lateral]`) and pass. `aston-martin-valk` and `porsche1` still carry the old shells' entries: the Valkyrie's tail pipes are at [0.651, -0.09 / +0.081], and the 918 has two top exits at about [0.93, +-0.32] on the engine cover, 1.0 m behind the centre, 0.6 up.
- **Engine sound.** `aston-martin-valk` keeps its own Valkyrie V12 recording. `porsche1` plays the Ferrari 488 V8 recording (a high-revving flat-plane V8; the 911 flat-six recording is no longer mapped, its files stay), `huracan` the Aventador SV V12 (a Lamborghini naturally aspirated screamer, no V10 recording exists), `laferrari` the Valkyrie V12 (a naturally aspirated V12 hybrid hypercar). All three are `sharedWith` profiles in `recorded-engine-bank.json`; `verify_recorded_engines.py` now counts own recordings and mapped cars itself (9 own, 5 mapped). `build_recorded_engines.py` would drop the shared profiles: re-add them after a rebuild.
- **New keys need a dev-server restart.** The cars are found with `import.meta.glob`, which the running server does not re-scan for a new folder (`laferrari`, `huracan`: "Cannot read properties of undefined (reading 'glassMaterial')"). The QA for them ran against a second Vite instance (`npm run qa -- --url=http://127.0.0.1:5181 laferrari`).
- **Texture packing:** `npm --prefix track-viewer run pack:cars -- porsche1 huracan laferrari aston-martin-valk`, then `node scripts/sync-assets.mjs`.

### Ford GT Mk II (2026-11-01)

The Mustang's slot on Liberty (#66, Maddox), as a new key `ford-gt`. The Meshy shell, tuning and tail spec are in `_archive/2026-11-01/` (see its `MANIFEST.md`); saves are moved over on load (`store.js`, `career/save.js`).

| Key | Model | Author, licence | Triangles (body / wheel) | Length used | Rip verdict |
|---|---|---|---|---|---|
| `ford-gt` | 2019 Ford GT MKII Track, "Ford GT Mk II" | Ddiaz Design (ddiaz-design), CC BY-NC-SA 4.0 | 73.1k / 5.1k | 5.07 m (with the splitter and wing; scale 1.03, so the wheelbase is 2.72 m against the real 2.71 and the painted width 2.01 m against 2.004) | Certain: the page says "Based on an Asphalt 9 Legends 3d model"; parts are `car_ford_gt_mkii:<part>_LOD2_UV2_...` |

- **Prepare:** `blender -b -t 6 --python sources/sketchfab/prepare-cars.py -- fordgt` (the model has its own `carpaint`; the rest is one atlas). The model's right mirror sat 10 cm behind the left: moved to match. Door decals and the haunch emblems overprinted the team's number roundel: removed. The white spokes are `keep|rimpaint` (`model-rims.js`): they take the finish's rim colour.
- **Warnings left:** the advisory glass count, and the poke reading (0.34 m, the ride-height artefact described above).
- **Lamp check:** fails on every car with a tail spec, not just this one (`maskNow(partsOf(car).tail)` finds no pixels since the spec treatment, so `lum` is undefined; `nissan-z` reads the same). Judge lamps with `qa-taillights.mjs` until it is fixed. QA: `qa/taillights/ford-gt-step2/`.
- **Handling:** `grip` 1.25 and `downforce` 1.2 are the 488's, not the real car's 400% downforce claim: at 1.3 / 1.6 a 250 ms tap at 135 km/h turned 4.8 degrees against the 4.6 limit. `bop` 1 and `bopGrip` 1 (`--cars ford-gt`, target 118: 117.3 s).
- **Engine sound:** `ford-gt` plays the AMG ONE turbo V6 recording (`sharedWith`) with a 7,000 rpm redline. The Mustang recording's profile, receipts and plan entry moved to `blackbird`, the only car that still plays it; its files keep the name `mustang-*.ogg`.

### Koenigsegg Jesko and CC850 (2026-11-07)

Two Sketchfab models by Ddiaz Design (the author of the GT4, the Nissan Z and the Ford GT), both CC BY 4.0, for a new Legend team (the team itself is a separate step: until it is in `teams.json` the game cannot assemble them, see below).

| Key | Model | Triangles (source / body lod0 / lod1 / wheel) | Length used | Rip verdict |
|---|---|---|---|---|
| `jesko` | 2020 Koenigsegg Jesko (Attack, big wing), "Koenigsegg Jesko" | 78k / 59k / 21k / 2.5k | 4.61 m (wheelbase 2.70 m as the real car; 265/35 R20 and 345/30 R21 tyres match) | Certain: "Model from: Real Racing 3"; `jesko:LOD_A_<PART>_mm_<kind>` like the GT4 |
| `cc850` | 2023 Koenigsegg CC850, "Koenigsegg CC850" | 280k / 94k / 26k / 11.4k | 4.38 m (scaled to the 2.70 m wheelbase; the published 4.364 m excludes the diffuser) | Certain: "Based on a CSR2 3d model"; one mesh per material, wheels as ~340 loose pieces a corner |

- **Prepare** (`prepare-cars.py -- jesko|cc850`). Jesko: the `BONNETCAM_*` parts repeat the nose and hood (z-fight) and `LOD_B_CHASSIS` is a low copy of the tail, so both go; the cabin's black inner glass (`INT_GLASS_*`) would blind every window and the inner mirror glass doubles the outer one, so they go too. The white atlas takes the team paint on every unsaturated light texel (a median-distance test left the baked shading as white patches on the haunches); the lime accents, badges and carbon stay. CC850: the emissive lamp overlay repeats the lamp mesh (dropped); tail lamps are the lamp faces whose emissive texel is red, headlamps the front ones that are white; mirror glass is the rear-facing faces of the two carbon heads; tyres are the wheel faces beyond 0.74 R of each axle; a flat pane inside the sills (0.3 m up) leaves the glass role, because it dragged the side-glass outline and the door number down to the sills.
- **Tuning:** Jesko ride 0.08 m, pitch 0.4 (the RR3 arches are tight: 2.7 cm into the front arch tops at ride 0.03); its 11 see-through gaps are the open space under the swan-neck wing and the rear grille seen side-on, traced and waived. CC850 passes everything at ride 0.03, pitch 0.5.
- **Wheels:** the Jesko's carbon spokes take the finish's rim colour (`model-rims.js`); the CC850's rims share one atlas material with tyre and disc, so they keep their own look (as on the LaFerrari).
- **Handling:** balanced like the Ford GT (`--tests balance --target 118 --powerMin 0.88 --cars jesko,cc850`): Jesko bop 0.88, bopGrip 0.979 (115.8 s), CC850 0.88 / 1 (116.3 s); the AI solo laps of the Legend cars at their own balance are 115.8-116.7 s. Both pass `physics-turning.mjs` (tap, hold, slalom, abuse, hairpin).
- **Engine sound:** both play the McLaren 720S recording (a twin-turbo flat-plane V8, `sharedWith: mp1x`; the `flat-v8` pack in `engine-packs.json`), redline 8,500 rpm. `verify_recorded_engines.py` asserts the bank's keys equal the team cars, so it fails until the team step adds them to `teams.json`.
- **Before the team exists:** `assemble` reads the team's colours (`TEAM_OF`) and the career rules need a tier entry, so the QA, garage and race checks ran against an uncommitted test team. The menu stills (`make-ui-stills.mjs cars|side|thumbs`, `ONLY=jesko,cc850`) are painted in the team colour, so they are made in the team step.

### Corvette ZR1 and Corvette Stingray (2026-11-07)

Two Sketchfab models by Ddiaz Design (the Koenigseggs' author), both CC BY 4.0, picked by the user for the 10th team, a Maestro team (the team is a separate step, as with the Koenigseggs).

| Key | Model | Triangles (source / body lod0 / lod1 / wheel) | Length used | Rip verdict |
|---|---|---|---|---|
| `zr1` | 2019 Chevrolet Corvette ZR1 (C7, ZTK high wing), "Corvette ZR1" | 160k / 92k / 26k / 6.9k | 4.643 m (scaled to the real 2.710 m wheelbase; 285/30 ZR19 and 335/25 ZR20 tyres then match within 2 %) | Certain: "Based on a CSR2 3d model"; one mesh per material like the CC850, wheels as ~630 loose `polySurface` pieces |
| `stingray` | 2020 Chevrolet Corvette C8 Stingray, "Corvette Stingray" | 252k / 96k / 26k / 8.1k | 4.611 m (scaled to the real 2.723 m wheelbase; the published length is 4.630 m) | Certain: "Model from CSR2"; its wheels come from another Sketchfab model the page links (https://skfb.ly/ooPvp, credited in `additionalCredits`), one tyre size front and rear |

- **Prepare** (`prepare-cars.py -- zr1|stingray`, the CC850's CSR2 rules). Both: the inner window faces (`WindowInside`) go; the windows split into headlamp covers (`headkeep`), tail covers and glass. ZR1: every `polySurface` child is a wheel piece (the `Wheel1A` tyre, the carbon spokes, nuts, the calipers and their badge decals); the carbon spokes get their own `rimpaint` material, so the finish's rim colour reaches them and not the body carbon (`model-rims.js`); the tail lamps are the `red_glass` lenses above 0.6 m (the bumper reflectors below stay); the mirror glass is the rear-facing faces of the `Coloured` part inside the two heads. Stingray: the emissive lamp overlay repeats the lamp mesh (dropped) and its emissive map picks the tail lamps: whole lit elements (lamp-mesh islands at least a quarter red), not single faces, which lit as specks; the strip across the tail's centre stays the model's own, or the generic lamp put a third halo over the plate. The headlamps keep the lamp mesh's own map (`keep`, as on the ZR1; the game's head material has none and showed black slits), and the covers give the beam points; the wheel groups are the linked wheel model's (`Tire_*` are tyres); the mirror glass is the rear-facing faces of the glossy `Coloured` trim in the heads.
- **Tuning:** ZR1 ride 0.03 m, Stingray 0.035 (rear arch top gap 1.1 cm at 0.03), pitch 0.5. The see-through gaps are the daylight under the ZR1's ZTK wing and under the Stingray's spoiler, which stands off the deck lid on short posts: traced and waived. Both end 9 pass, 2 warn: the advisory glass count, and the front poke reading (ZR1 9 cm, Stingray 22 cm), the ray at 1.15 R meeting the fender where it rolls in over the arch; the tyres sit inside the body in every view.
- **Plate:** the Stingray's `ManufacturerPlate` renders as a dark blank in the game, as on the CC850.
- **Handling:** no balance needed. AI solo laps on Marina (`physics-harness.mjs --tests lap --assist ai --weather dry`) at bop 1: ZR1 116.3 s against the Maestro A cars' 116.1-116.4 s (av12, porsche1, aston-martin-valk at their own balance), Stingray 117.7 s against the Maestro B cars' 116.4-119.5 s (huracan, mp1x, bentley-gt). Both pass `physics-turning.mjs`.
- **Engine sound:** both play the Mustang GT V8 recording (the Blackbird's, the existing American cross-plane V8; `sharedWith: blackbird`, the `cross-v8` pack), redlines 6,500 rpm (LT5) and 6,600 rpm (LT2).
- **Display names** are "Corvette ZR1" and "Corvette Stingray" (`source.json` `name`): "Chevrolet Corvette ..." was cut off in the garage title.
- **Before the team exists:** as with the Koenigseggs, the QA, garage and quick races (the player in each car, then the AI in each) ran against an uncommitted stand-in team; the stills and `startup-budget.json` (which counts team cars) came with the team step.
- **In Steelhead's paint** (the team step): the car, side and thumb stills, then `qa/team-steelhead/shots.mjs` (garage, a quick race in each car with the AI driving it, both cars on a career grid). Two livery places moved, `livery.js` `FIT`: the ZR1's carbon hood vent hid the bonnet lockup (now on the nose) and the Stingray's side intake cut the flank sponsor (now 0.6 m forward, as on the CC850). The Stingray's door, rear quarter and front fender first showed dark creases: lod0 had decimated its 23.6k-triangle paint shell to about half. `source.json` `budget.whole: ["paint"]` keeps that shell as modelled at lod0 (`model-car.py`; body0 86k to 96k, under the 100k budget; lod1 still decimates it), and the stills were remade. Car QA unchanged (9 pass, 2 warn); `qa-taillights.mjs stingray`: two lamps, no centre halo.

## The AV-12 Meshy shell, the first worked example (`tuning/av12.json` → `log`)

| Run | Found | Fix |
|---|---|---|
| 1 | The tyres touched the arches, and dug 4.5 cm in under braking. | Ride +3 cm, pitch 0.6. |
| 1 | The brake lamps were only 1.6× the tail level. | Brake 6. |
| 1 | The mirrors were gold capsules. | Carbon blade housings. |
| 1 | The road showed through the hollow shell. | The interior fills. |
| 2-7 | The fills were refined one leak at a time (cowl, wheel stations, the bonnet vent to the front intake). A shrunken copy of the shell, tried as an inner lining, came through the paint in concave areas and was dropped. | |
| Final | 8 pass, 3 warnings: the rear arch lips overlap the tyre by 1 cm, the fronts come within 1 cm under braking, and the advisory glass count. | |

## Limits

- **Premium look** is judged by eye. The automatic checks can't see a lumpy panel or a crude vent; those are limits of the body's shape.
- **Physics:** the test drive is scripted, not driven, so drift, pops and nitro are triggered by the script. Handling physics (tyre forces, real slip) is the next phase; the effects already take slip and throttle as inputs.
- **Active aero:** done on the three cars with a separate wing (Chiron-X and MP1-X airbrakes, the 911's speed spoiler). Their regions came from a tail scan that finds surfaces with an air gap below them. The AV-12, Continental and Valkyrie tails are fused into the deck, so cutting them would tear the body; they stay fixed.
