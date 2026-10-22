# Cars on the Corniche Marina track — overnight test (2026-10-19)

The eight assembled car-lab cars now race in the track viewer. Run `npm run dev` in `track-viewer` (or the `raceultimate-viewer` preview). The default camera mode is **chase**.

I didn't edit anything in `car-lab/`. The viewer imports its modules read-only.

## How car-lab builds a car

Car-lab splits each car into a body plus shared hardware and aesthetics. A car is a **body** plus a **profile** plus **reusable parts**:

| Layer | Source | What it is |
|---|---|---|
| Body | `meshy_output/.../model.glb` | One untextured, generated shell: 1.1–2.8 M triangles. At runtime `normalizeShell()` centres it, puts its bottom at Y=0, scales it to 4.6 m and lifts it by the ride height. |
| Profile | `car-lab/src/vehicle/profiles/<car>.json` | Fit data measured on that exact shell, pinned to its SHA-256: wheel positions, radius, width and track; glass corners; mirror mounts; lamp paths and cavity fits; the headlamp design (`signature` or `enclosed`). |
| Tyres and wheels | `parts.js` | Procedural: a lathe tyre with sidewall rings and tread channels, split or turbine rims, rotor and calipers. About 36k triangles per wheel. |
| Glass and mirrors | `parts.js` | Glass is patches fitted to the profile corners plus a dark cabin insert. Mirrors are a stalk, housing, painted cap and glass. |
| Lamps | `lights.js`, `headlamps.js` | Housings, lenses and LED strips, with real spot and point lights. `update({mode, brake, reverse})` drives running, low and high beam, brake and reverse. |
| Paint | `materials.js` | `MeshPhysicalMaterial` with clearcoat, four finishes, and stripes plus a carbon lower trim drawn in the shader from the body's own coordinates. |

## What I did

1. **Game meshes.** `track-viewer/scripts/derive-car-lods.mjs` (`npm run derive:cars`) reads each shell and checks its hash against the profile.
   - It bakes in car-lab's exact normalisation, so every profile anchor still fits.
   - It simplifies with meshoptimizer to **80k and 20k triangles** and recomputes smooth normals.
   - Output is about 500 KB and 130 KB per car, roughly **5 MB for all eight** (the shells were 380 MB).
   - Files go to `assets/cars/<car>/` and are copied by the sync script.
2. **Assembly** (`track-viewer/src/cars.js`). It uses car-lab's profiles, materials, wheels, glass, mirrors and lamps unchanged, then:
   - merges each rigid group per material, from about 100 meshes per car down to 37;
   - switches the body between 80k and 20k at 45 m;
   - replaces wheels with ~200-triangle stand-ins beyond 22 m.
3. **Making them belong in this world.**
   - The player car's paint and glass reflect the venue: a 128 px cube capture, one face per frame, filtered for roughness.
   - Every car gets a contact shadow.
   - Lamps follow the look: running lights at dusk, low beam at blue hour and night. Brake lights follow deceleration.
   - Lamp brightness is retuned for this venue's bloom and exposure.
   - Only the player car keeps real headlight beams.
4. **Driving and testing.** In chase mode the eight cars race the racing line:
   - grip-limited speeds, braking into corners, steering and wheel spin;
   - traffic: a car closing on another slows and pulls out to pass, and cars alongside each other move apart.

## Results (measured)

| Check | Result |
|---|---|
| Load | All 8 cars load; shaders compile; no runtime errors |
| Cost | **≈3.8 ms per frame for the whole field** at 1920×1080 on high (median of an interleaved A/B: 23.9 vs 20.1 ms). Before the optimisations it was +19 ms and +836 draw calls. |
| Braking | 224 km/h into T1: brake lamps and the centre stop lamp light up |
| Steering | Up to 3.9° through T1, turning the correct way |
| Traffic | 0 overlapping car frames in a 90 s race (66 before the separation rule) |
| Paint | All 8 colours and finishes read correctly at dusk, blue hour and night, and in rain |

Stills are in `track-viewer/shots/`:
- `cars_dusk_sheet.jpg`: all eight on the grid
- `chase_pack.png`, `chase_corner.png`, `bluehour_chase.png`, `rain_chase.png`, `marina_chase.png`
- `car_side_dusk.png`, `cars_close_night.png`

## Bugs found and fixed tonight

- **Every car rendered dark grey.** Web compression stores positions in a scaled integer space. Car-lab's paint shader reads raw positions for stripes and the lower carbon trim, so nearly the whole body counted as "trim". The bodies are now converted back to metres on load.
- **Headlights glared into a white wall.** Car-lab tunes its lamps for a studio and resets absolute brightness on every update. The venue scaling is now applied after each update, and the beams start 0.6 m ahead of the nose; from inside the bumper they lit the car's own bonnet.
- **Floodlight parts vanished at different distances, leaving glows floating in the sky.** The distance culler judged the mast, the lamp units and the beacon separately. They're now culled as one object.
- **The player car drove through the pack** and lit the car ahead from inside. Traffic avoidance and lateral separation fix this.
- **Reflection capture spikes.** Rendering six cube faces at once, and allocating a new filter target each time, caused 80 ms spikes. It now renders one face per frame into a reused target.

## What still looks out of place (most important first)

1. **Panel surfaces.** The generated shells are crumpled at 10–40 cm: bonnets on the AV-12 and MP1-X, the AV-12's rear diffuser. The folds are in Meshy's geometry; car-lab's surface study finds them in the 1.2 M-triangle originals too.
   - Mesh smoothing doesn't remove them. I tested Taubin smoothing at full resolution and on the 80k LOD, with crease limits of 40°, 65° and 80°, and saw no visible gain, so it was removed.
   - What works: the derived bodies bake **diffused shading normals** (bilateral, ~30 cm spread, creases over ~50° kept), so a near-mirror clearcoat reflects the venue as smooth panels while the shape stays as generated. The paint is a deeper base under that coat, tone-mapped with Neutral at dusk. See `shots/teams_sheet.jpg`.
   - The silhouette and close-up crumples are still in the geometry; a clean surface needs reconstruction or a modelled base.
   - Each car wears its team's base colour from `assets/teams/teams.json` (six teams, two cars each).
2. **Panel definition at night.** Away from the floodlight pools the cars go quite dark. A faint rim light or a little more environment reflection on the paint at night would keep their shape readable without making them look studio-lit.
3. **Physics.** The cars follow the racing line kinematically. The Rapier raycast vehicle from `npm run test:track` hasn't been wired to these cars yet, and there are no real collisions or player controls.
4. **Real car dimensions.** Every car is normalised to 4.6 m, car-lab's display length. Real lengths range from about 4.5 to 4.85 m, so each profile's `displayLength` should be set before game physics.
5. ~~Four cars aren't assembled in car-lab yet.~~ Done: all twelve now load (see the update below).

## Files

- `track-viewer/src/cars.js`: assembly, roster and parking, driving, traffic, reflections, detail by distance, emitters.
- `track-viewer/src/camera.js`: the chase camera (springs, look-ahead, speed FOV, roll, shake, boost envelope).
- `assets/cars/exhaust.json`: exhaust and nitro tips per car.
- `track-viewer/scripts/derive-car-lods.mjs`: game meshes.
- `assets/cars/lods.json`: source hashes and triangle counts.
- Wiring: `track-viewer/vite.config.js` (allows the parent folder, one copy of three) and `track-viewer/src/main.js` (chase mode, lamp modes per look).
- `track-viewer/src/perf.js`: culler now treats multi-part objects as one.

## Update: all twelve cars (2026-10-19, afternoon)

- **Roster.** XKSS Heritage, Nuvolariq-R, Roadster-X and the 488 got car-lab profiles, so all twelve team cars are derived and assembled. A car whose body can't load is skipped with a warning instead of keeping the field off the track.
- **Race format.** Each team races one car (about six on track; `?lineup=2` races the second cars), the player in Saetta's AV-12. The other six stand in their team's pit boxes, among the pit crews.
- **Finish.**
  - Every car wears its team livery.
  - Paint reflections are capped in brightness, so the clearcoat no longer glows with a bloom halo along the edges.
  - The player car's reflection capture sees the venue's lamps, LEDs and neon three times brighter, so the paint carries bright light shapes after dark.
- **Exhaust and nitro anchors.**
  - `assets/cars/exhaust.json` gives each car's tips; at load a ray puts each anchor on the body's rear surface.
  - Valkyrie and MP1-X tilt their jets up (top-exit); the electric Roadster-X has nitro points and no exhaust.
  - `?debug=exhaust` shows the anchors. Most tips were placed by type rather than read off a modelled pipe, so nudge them by eye.
- **Cost.** Detail drops with distance:
  - full wheels within 22 m, stand-ins to 60 m, then one static wheel proxy and no side mirrors;
  - sun shadows only within 50 m;
  - cars out of the ambient-occlusion pass;
  - no cars beyond 80 m in the road mirror.

  With twelve cars loaded, the frame is back near the 16.6 ms budget (see the viewer README).
