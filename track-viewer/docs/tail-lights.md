# Tail lamps, car by car

The realistic tail-lamp treatment is opt-in per car: a car listed in `TAIL_SPECS` (`src/carkit/taillights.js`) gets it, every
other car keeps the generic lamp in `src/carkit/lamps.js`, which this work left as it was.

Status (2026-10-30): **AV-12 (`av12`) done, waiting for approval.** No other car is converted.

## Why AV-12 first

It is the default car, so it is the rear the player looks at most (the chase camera sits 6 m behind it for the whole race),
and its Aventador SVJ lamp is a distinctive structured unit (three hexagonal cells per side, a Y light guide in each), so a
flat lamp looked worst there. Its tail mesh is real geometry (17k triangles at full detail), so the structure can be lit
element by element without re-authoring the model.

## What was wrong (AV-12 before)

Seen in `qa/taillights/av12-before/` (and `av12-before-orig/`, shot with the code before this change):

- **One flat emissive for the whole cluster.** `tail|Red_Lights` (light guides, fills, inner arrow) all wore one material at one
  level: a red sticker, no internal structure, no lens.
- **Pink, not red.** The emissive colour (1, 0.03, 0.09) is linear, so on screen it is a pinkish red, and the brake drove it
  to 3.8-4.6: the tone mapper (Neutral by day and dusk, AgX at night) desaturated it to salmon and pink-white.
- **A fuzzy halo.** One additive sprite per cluster, 0.18-0.7 m across at up to 0.88 opacity on the brake: a red fog over the
  paint, the wing and the engine cover, by day too.
- **Indicators always lit.** The model's amber indicator lenses (`keep|Orange_Lights`, emissive 1, 0.24, 0) glowed orange
  all the time, day and night: the top half of every cell read as an orange lamp.
- **No reverse lamp.** The model has no reverse role, so reversing showed nothing.
- **A dimmer, not a switch.** Lamp brightness followed pedal pressure; a real brake lamp is on or off.
- **Wrong across looks.** The same emissive at day, dusk and night (only the running level differed), so at dusk (exposure
  0.42) the lamps were a third as bright as by day.
- **A milky lens.** The model's lens (white, alpha 0.25, matte) neither tinted nor reflected.

## How it works now

Code: `src/carkit/taillights.js` (the treatment), `src/carkit/lamps.js` (`fitLamps`, and `setLamps` hands a spec car to it),
two lines in `src/cars.js` (`fitLamps` at the end of assembly, and the look passed to `setLamps`).

- **At assembly** (`fitLamps`, called by `finishCar`): everything is built before the race's shader warm-up, so no program
  compiles on the first race frame. A far level that loads later (LOD 1, 45 m+) is fitted when it appears.
- **Elements.** The tail-material mesh at full detail is split into connected components (`components()`, vertices welded at
  1 mm); the spec's rules give each component a part: `guide` (lit by the running light and brighter on the brake) or `fill`
  (lit only on the brake). The part goes into a per-vertex attribute `aLamp` (guide, fill). LOD 1 gets one blend (0.7, 0.5):
  nothing finer shows at 45 m.
- **The lamp shader** (`tailShader`, on the car's own `taillight` material): emission = guide x running/brake level, brighter
  along a guide's edges (a lit light guide), + fill x brake level x an LED-dot pattern (7.5 mm pitch on the lamp's rear plane,
  dots over a lit diffuser). The pattern fades to its mean once a pitch nears a pixel (`fwidth`), so it never shimmers at
  distance. Colour: a 625 nm LED, linear (1, 0.012, 0.002), shifting toward (1, 0.05, 0.006) with the brake: a hotter red,
  never pink. Unlit, the elements are a dark red light guide / reflector (`0x4a0306`, roughness 0.32).
- **The lens.** The rear part of the model's lens material (x > `lens.minX`) moves onto the car's `rearLens`: smoked
  (`0x2a0d0e`, opacity 0.4), glossy (roughness 0.05, clearcoat). The player car's paint capture also reaches it
  (`Field.useHeroEnvironment`), so by day it reflects the sky and the sun.
- **Dark lenses.** `dark` materials (the indicators) lose their emission and take `darkColor`: an unlit amber lens.
- **Reverse.** Triangles of the `reverse.material` inside `reverse.box` (car frame, |z| so one box covers both sides) move onto
  a copy of that material lit cool white, brightest where a facet faces the viewer (a lit reflector cell).
- **Glow.** One `THREE.Points` per car (one draw): a point per element, 0.4 x its largest size, aimed back (no glow seen from
  ahead), a tight profile with a faint wing, energy dimming below 3 px instead of popping (as `glow.js` does), fogged.
  It replaces the cluster halo; it is drawn in the wet-road mirror too, so a wet road reflects the glare.
- **Pool.** The light on the road behind: an additive two-lobe quad riding the contact shadow (flat on the road under a leaning
  body), after dark only (x `dn`), halved on a wet road (the mirror shows the lamps there), on layer `NO_MIRROR` (2).
- **Spill light (player car only).** One wide `SpotLight` (78 deg) just behind the body, aimed back and down: it lights the road
  (a red streak on a wet one), the diffuser tips and a car close behind. It is always present (black when off), so the light
  count and compiled shaders never change. A point light was tried first and rejected: it lit bodywork ahead of the lenses
  (the deck above the lamps, the louvres), which a real lamp cannot reach. AI cars get no light.
- **Reaction.** A spec car's brake lamp is a switch: on past 6 % pedal, off under 2 % (hysteresis, so a pedal at the switch
  point never blinks), then the shared ramp (about 70 ms to 90 % on, 150 ms to 90 % off): fast, smooth, no hard blink.
  Reverse ramps the same way. `c.lampLevel` stays the ramped brake level, so `fx-vapor.js`'s lamp-lit spray still follows it.
- **Levels per look** (`LV`): each is a `[day, night]` pair mixed by the look's darkness `dn` (day 0, dusk 0.35, blue hour 0.7,
  night 1) and divided by the look's exposure, so a lamp reads the same on screen whatever exposure a look picked: a
  near-dark lens with a faint red by day (brake clearly red, no glow), a clear red with a tight glow after dark. The spill
  light is in candela times `dn` (it is lit like every other light). A spec's `levels` overrides any entry for its car.
- **A/B.** `?tails=off` on the game URL puts every car on the generic lamp: the before stills and the fps baseline.

## Per-car steps

1. **Before stills** (one headless Chrome at a time, through the lock):
   `TAILS=off node scripts/qa-lock.mjs -- node scripts/qa-taillights.mjs <car> qa/taillights/<car>-before`
   The car must be selectable as the player car (Free Drive uses the saved car; the script writes it into the save).
2. **Find the lamp parts.**
   - `assets/cars/<car>/source.json`: `roles` and `splitFrontRear` say which source materials became `tail`, `brake`,
     `reverse` (the game's materials) and which stayed `keep` (the model's own: lenses, indicators, reflectors).
   - `node scripts/lamp-parts.mjs <car>`: every lamp-like material and its connected components (triangles, area, centre,
     size, mean normal; car frame: +x is the tail). `node scripts/lamp-parts.mjs <car> "Chrome|Aluminum"` for any others.
   - `node scripts/lamp-parts.mjs <car> --box x0,y0,z0,x1,y1,z1`: which materials have triangles in a box (|z|): how to find
     what a cell seen in the macro still is made of (AV-12's honeycomb cell turned out to be `keep|Aluminum`).
   - Map components to what the macro still shows: big multi-hundred-triangle components are usually light guides or LED
     bars, 2-4 triangle quads are flat fills or backing panels, amber `keep` parts are indicators.
3. **Write the spec** in `TAIL_SPECS`:
   - `tail`: rules over the components, first match wins (`{ minTris, part }`; add a key to the matcher in `fitLevel` when a car
     needs one, such as a position box or an area, rather than a second mechanism).
   - `dark` / `darkColor`, `lens: { material, minX }`, `reverse: { material, box }`, `spill: true`, `levels` if its emitters are
     much larger or smaller than AV-12's.
   - Not built yet, needed by the next cars:
     - a car with its own `brake` role (`m.brakeLight` meshes): give `m.brakeLight` the same shader with every vertex a `fill`.
     - a car whose tail is a textured atlas part (furari-488, laferrari, huracan, porsche1: the structure is in the texture,
       and `roleMaterial` drops it when it swaps in the game's material): keep the source map (`cars.js` `loadBodyLevel`, one
       line: the mesh remembers its source material) and add a spec option that uses its luminance as the element pattern.
     - a car with its own `reverse` role (`m.reverseLight`): drive it from the reverse level instead of a box split.
4. **After stills**: `node scripts/qa-lock.mjs -- node scripts/qa-taillights.mjs <car>` (to `qa/taillights/<car>-after`), then
   `node scripts/qa-taillights.mjs --sheet qa/taillights/<car>-before qa/taillights/<car>-after qa/taillights/<car>-before-after.jpg`
   (the full sheet, and `-highlights.jpg`: the lamp cropped from the shots that decide it). For a quick iteration narrow the
   set: `LOOKS=night WEATHER=dry STATES=brake VIEWS=macro,chase DRIVE=0`.
5. **Read the stills** and check:
   - macro (1.4 m): the elements read separately; running lights only the guides; the brake lights the fills with visible LED
     dots; red, not pink or orange; indicators dark amber; reverse cell white; by day a dark smoked lens with reflections.
   - chase (6 m): the brake step is obvious but the lamps stay red with a glow no wider than the cluster; no red on bodywork
     ahead of the lenses; the pool sits behind the bumper and fades out (no visible quad edge).
   - far (20 m): lamps visible as red points with a little glare, no blob; dry roads never look wet; wet roads show a
     streaked red reflection.
   - drive frames (night rain, AI braking): no flicker or blink between frames, no detached glow at speed.
6. **Tests and frame rate**: `node scripts/test-brake-lights.mjs`, `npm run -s test:v2`, and through the lock
   `qa-race-watch.mjs marina night 1` once with `http://127.0.0.1:5180/?tails=off` and once without (the car as the player's):
   finished, no new errors, darkFrames 0, mean fps within 5 %. Run-to-run noise is about +-5 %, so compare the means.
7. Commit the spec, any matcher key and the doc's status line.

## AV-12 results

- Stills: `qa/taillights/av12-before/`, `qa/taillights/av12-after/`; sheets `qa/taillights/av12-before-after.jpg` and
  `qa/taillights/av12-before-after-highlights.jpg` (not committed, like the other `qa/` captures).
- Frame rate, `qa-race-watch.mjs marina night 1`, AV-12 as the player car: generic lamps mean 74.9 / median 71 fps, this
  treatment mean 76.0 / median 71 fps (reports `qa/taillights/race-night-tails-off.json`, `race-night-tails-on.json`). Finished,
  darkFrames 0, the same two pre-existing warnings.
- Judgement calls: the inner aluminium honeycomb cell is treated as the reverse lamp (a clear reflector cell is a reverse lamp's
  signature; the model names none). If a reference shows otherwise, move `reverse.box`.

## What the model would need (not done; no GLB was edited)

Nothing blocks AV-12. A model authored for this would carry one material per element (`tail_guide`, `tail_fill`, `reverse`,
`indicator`) through `source.json` `roles`, so the component rules are not needed, and UVs on the fills for a baked LED map.
