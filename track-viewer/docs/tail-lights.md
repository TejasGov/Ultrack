# Tail lamps, car by car

The realistic tail-lamp treatment is opt-in per car: a car with a spec file, `src/carkit/tails/<key>.js`, gets it; every other car
keeps the generic lamp in `src/carkit/lamps.js`, unchanged.

Status (2026-10-31): **all 16 cars are on the treatment.** AV-12 (`av12`) was approved by the user on 2026-10-30; the other 15
were converted in three groups (stage 2, end of this doc), then the shared code was made cheap (Performance, below) and given
the keys the per-car agents asked for (`tex: false`, `flip`, `adopt.box`, `reverse.color`, `glowAlong`, `facing`, `bowl`), which
10 specs now use or tried (Rollout results). Overview of all 16: `qa/taillights/rollout/all-16-overview.jpg` (night chase
braking, dusk chase running, day close running, night close braking; shot with the fixed QA tool, see Checklist).

## Files

- `src/carkit/tails/<key>.js`: one car's spec, plain data (`export default { ... }`, regexes and numbers, no imports:
  `qa-taillights.mjs` and `lamp-parts.mjs` import it in Node). The file name is the car's key. `lamps.js` collects the folder
  with `import.meta.glob`, so adding a car touches no shared file. Notes on the car (judgement calls, what its model lacks,
  its QA results) go in the file's header comment.
- `src/carkit/taillights.js`: the treatment (shared). `checkSpec`, `tailRule` and `texLamp` are exported for the tools and tests.
- `src/carkit/lamps.js`: `fitLamps` at assembly, `setLamps` per frame (hands a spec car to `taillights.js`), `TAIL_SPECS`.
- `src/cars.js`: each model mesh keeps its own material before the role swap (`mesh.srcMaterial`), which a spec matches by
  name and reads the map of.
- `scripts/lamp-parts.mjs` (offline, no browser): a model's lamp materials and components, its textures, a dry run of a spec.
- `scripts/qa-taillights.mjs` (browser, through the lock): the stills. `scripts/test-brake-lights.mjs`: checks every spec file.

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

## How it works

- **At assembly** (`fitLamps`, called by `finishCar`): everything is built before the race's shader warm-up, so no program
  compiles on the first race frame. A far level that loads later (LOD 1, 45 m+) is fitted when it appears.
- **Elements.** Each tail mesh (role `tail`, adopted materials, car-lab's LED tubes) at full detail is split into connected
  components (`components()`, vertices welded at 1 mm); the spec's rules give each component a part. `guide` and `fill` go into
  a per-vertex attribute `aLamp` (guide, fill); `reverse`, `indicator` and `lens` components move onto their own materials.
  LOD 1 uses the same rules with guides and fills at one blend (0.7, 0.5): nothing finer shows at 45 m.
- **The lamp shader** (`tailShader`, on the car's own `taillight` material): emission = guide x running/brake level, brighter
  along a guide's edges (a lit light guide), + fill x brake level x an LED-dot pattern (7.5 mm pitch on the lamp's rear plane,
  dots over a lit diffuser). The pattern fades to its mean once a pitch nears a pixel (`fwidth`), so it never shimmers at
  distance. Colour: a 625 nm LED, linear (1, 0.012, 0.002), shifting toward (1, 0.05, 0.006) with the brake: a hotter red,
  never pink. Unlit, the elements are a dark red light guide / reflector (`0x4a0306`, roughness 0.32). A `tex` car's tail
  meshes wear a copy of it with their model's map (see `tex`).
- **The lens.** The rear part of the model's lens material moves onto the car's `rearLens`: smoked (`0x2a0d0e`, opacity 0.4),
  glossy (roughness 0.05, clearcoat). The player car's paint capture also reaches it (`Field.useHeroEnvironment`), so by day it
  reflects the sky and the sun. It is double-sided in one pass (`forceSinglePass`): three.js draws a transparent double-sided
  material twice and flags it `needsUpdate` before each draw, a full program lookup per lens per pass every frame.
- **Dark lenses.** `dark` materials (the indicators) lose their emission and take `darkColor`: an unlit amber lens.
- **Reverse.** A reverse cell (a material in a box, a `reverse` component, a reverse-role mesh) wears a copy of its material lit
  cool white, brightest where a facet faces the viewer (a lit reflector cell); a `tex` car's white texels light with it.
- **Glow.** One `THREE.Points` per car (one draw, frustum-culled with a 0.5 m margin): a point per element, 0.4 x its largest
  size, aimed back (no glow seen from ahead), a tight profile with a faint wing, energy dimming below 3 px instead of popping
  (as `glow.js` does), fogged. With `glowAlong` an element glows along its largest side instead (points sized 0.4 x its
  middle side, 0.6 of that apart so their cores join into a line, one per strand of each slab: a ring's top and bottom arcs;
  each snapped to the element's surface). It replaces the cluster halo; it is drawn in the wet-road mirror too, so a wet road
  reflects the glare.
- **Pool.** The light on the road behind: an additive two-lobe quad riding the contact shadow (flat on the road under a leaning
  body), after dark only (x `dn`), halved on a wet road (the mirror shows the lamps there), on layer `NO_MIRROR` (2). Not drawn
  past `FAR_M` (60 m, the car's band 2): a pixel row on the road there.
- **Spill light (player car only, `spill: true`).** One wide `SpotLight` (78 deg) just behind the body, aimed back and down: it
  lights the road (a red streak on a wet one), the diffuser tips and a car close behind. It is always present (black when off),
  so the light count and compiled shaders never change. A point light was tried first and rejected: it lit bodywork ahead of
  the lenses (the deck above the lamps, the louvres), which a real lamp cannot reach. AI cars get no light. It costs ~0.5 % of
  the race frame (in-race A/B, two laps), and its wet-road streak (a specular reflection broken up by the rain ripples) is
  approved look a road decal could not reproduce, so it stays (Performance).
- **Reaction.** A spec car's brake lamp is a switch: on past 6 % pedal, off under 2 % (hysteresis, so a pedal at the switch
  point never blinks), then the shared ramp (about 70 ms to 90 % on, 150 ms to 90 % off): fast, smooth, no hard blink.
  Reverse ramps the same way. `c.lampLevel` stays the ramped brake level, so `fx-vapor.js`'s lamp-lit spray still follows it.
- **Levels per look** (`LV`): each is a `[day, night]` pair mixed by the look's darkness `dn` (day 0, dusk 0.35, blue hour 0.7,
  night 1) and divided by the look's exposure, so a lamp reads the same on screen whatever exposure a look picked: a
  near-dark lens with a faint red by day (brake clearly red, no glow), a clear red with a tight glow after dark. The spill
  light is in candela times `dn` (it is lit like every other light). A spec's `levels` overrides any entry for its car.
- **A/B.** `?tails=off` on the game URL puts every car on the generic lamp: the before stills and the fps baseline.

## The spec

Car frame (car-lab's): +x is the tail, y up, z to the side, metres. Boxes are `[[x0, y0, z0], [x1, y1, z1]]` on |z|, so one box
covers both sides. A material name is the model's own (`tail|brake_1`, `keep|Orange_Lights`), so anchor regexes where a name
repeats across roles (`nissan-z` has `glass|`, `headkeep|`, `keep|` and `tail|mm_windiws`). Every key is optional; a spec of `{}`
lights every tail component as a combined running/brake guide and leaves the model's lens as it is.

```js
export default {
  tail: [                      // rules over the tail components, first match wins; a rule matches when all its keys do
    { material: /brake_1/, part: 'fill' },                          // by the model material's name
    { box: [[2.10, 0.55, 0], [2.13, 0.62, 0.06]], part: 'off' },     // by the component's centre
    { minTris: 500, part: 'guide', glow: 0.5 },                     // by size; glow: the element glow's size factor (0: none)
    { box: [[1.3, 0.85, 0], [1.4, 0.95, 0.15]], part: 'fill', tex: false, glowAlong: true },   // lit whatever its texels; glow along it
    { box: [[2.05, 0.57, 0.66], [2.12, 0.63, 0.76]], part: 'guide', flip: true },              // modelled facing forward: turned back
    { part: 'guide', facing: [[1, 0, 0], 0.5] },                    // per triangle: only the faces looking back (a blade's edge)
    { part: 'fill' },
  ],
  adopt: { material: /^keep\|Light$/, minX: 1.2, box: [[1.5, 0, 0.3], [2.4, 1.2, 1.2]] },   // triangles behind minX (in the box) join
  tex: { lo: 0.02, hi: 0.4, hue: [0.2, 0.32], white: [0.3, 0.6], base: 0x8c8c8c, map: 'emissiveMap' },
  dark: /Orange_Lights/, darkColor: 0x6a2a04,
  lens: { material: /Glass_Lights/, minX: 1.5, color: 0x2a0d0e, opacity: 0.4, shell: 0.004 },
  reverse: { material: /Aluminum/, box: [[2.13, 0.72, 0.455], [2.18, 0.83, 0.545]], minX: 2, color: 0x1c1e22 },
  bowl: true,                                                       // car-lab: a closed lamp's bowl fills on the brake
  spill: true,
  levels: { run: [0.1, 0.38] },
  qa: { macro: [2.08, 0.74, 0.62] },
};
```

- **Parts.** `guide`: lit by the running light, brighter on the brake (a combined running/brake element: most cars whose brake
  and running lamp share one mesh need only this). `fill`: lit on the brake only, with LED dots (a separate stop element, a
  centre stop lamp). `off`: never lit, keeps the lamp's unlit look (a reflector, a rain light). `reverse`: white, lit when
  reversing. `indicator`: an unlit amber lens (`darkColor`): a combined indicator/brake unit whose amber part is its own
  component. `lens`: onto the smoked `rearLens` (a lens the model gave the `tail` role: `supra` red_glass, `blackbird`
  Material.008, `nissan-z` tail|mm_windiws).
- **Rules** (`tail`): match keys are `material`, `box`, `minTris` and `facing`; add a key to `tailRule` only when no combination
  of these separates a car's elements. At LOD 1 the same rules run on the decimated mesh: `material` rules hold there, `box` and
  `minTris` may misfire on merged components, so end the list with a catch-all rule.
  - `facing: [[x, y, z], min]` matches per triangle (its normal . axis >= min, z mirrored like the boxes); the element's other
    triangles fall through to the next rule (`{ part: 'off' }` after it). A mesh with a facing rule is de-indexed at fit, so no
    vertex straddles the lit edge. For an element lit on every face whose top the chase camera sees (destrier, buggati).
  - `tex: false`: the element lights whatever its texels on a `tex` car (aLamp is written as 1 + w; the shader drops the texel
    weight where it is >= 1.5): a stop lamp the atlas paints unlit (mp1x).
  - `flip: true`: an element modelled facing forward (back-face culled from behind) is turned to face back: reversed winding,
    negated normals, on copies (jaguarxkjss's outer segment).
  - `glowAlong: true`: the element glows along its largest side (see Glow) instead of one point at a centroid that lies off a
    long, curved or ring-shaped element (a mid-blade dot, a red pupil in a ring, a dot on the paint beside a curved bar).
- **`bowl: true`** (car-lab cars): the bowl behind a closed lamp's LED ring is a brake fill, with LED dots, a dark red reflector
  when off (bentley-gt's ovals fill on the brake). cars.js merges car-lab's lamp group per material, so names are gone: a bowl
  is found by its shape (a fan of lamp-housing triangles, both faces, all starting at the lamp's centre, behind x 1). No glow.
- **`adopt`**: a model ('keep') material that is really part of the tail lamp (`furari-488` keep|Light, the round lamps' emitters,
  today glowing at a constant level) becomes a tail mesh: its triangles behind `minX` and inside `box` (all of them without
  either) are split off, classified by the rules and, with `tex`, lit through its own map. Adopted at every LOD. Leaving a piece
  out returns it to the model's own material, which may glow all the time (nissan-z's wing-mount plates: kept adopted, `off`).
- **`tex`** (lamp detail that lives in a texture: the game's `taillight` material has no map, so these lamps were a flat
  red): a tail mesh whose model material has a map (`map`, else its `emissiveMap`; `map: 'emissiveMap'` prefers that one) and
  UVs wears a copy of the lamp material with it (one per model material, shared uniforms, built at assembly; LOD 1 reuses LOD
  0's copy, so it has the full-size map). Per fragment, the shader reads the texel (`texLamp()` is the same test in JS):
  red texels (saturation 0.35-0.6 up, g/r below `hue`) light the element, weighted by their brightness between `lo` and `hi`
  (the texture's own structure: a guide's bright core, a stripe, LED spots); amber texels stay unlit; with `white`, unsaturated
  texels brighter than `white[0]..white[1]` are the reverse lamp. The unlit lamp shows the map times `base`. `hue: [0.6, 0.9]`
  lets orange-yellow hot LED cores (LaFerrari's lit ring) count as lamp. `material` limits which tail materials it applies to.
  Tune it offline: `lamp-parts.mjs <car> "^tail\|" --uv <png>` draws the map and, below, exactly what the shader will light.
  The game loads the KTX2 copy of each model, so colours differ slightly from the webp the tool reads; keep the ranges soft.
  A `tex` reverse lights no glow point; a reverse that is its own component should use part `reverse`.
- **`dark`, `darkColor`**: unchanged from AV-12 (indicator lenses kept by the model).
- **`lens`**: `material` + `minX` as AV-12 (any role; the rear part moves onto `rearLens`). `shell`: for a model with no lens at
  all (laferrari, huracan, aston-martin-valk, porsche1, mp1x, destrier, buggati), a lens that far out (m) along the normals over
  the tail meshes, wearing `rearLens`, at every LOD. `color`, `opacity`: the smoked lens's tint (a clear-lens car may want a
  lighter, more transparent one).
- **`reverse`**: `material` with `box` as AV-12, or without `box` (every triangle behind `minX`, a glow point per component).
  Other ways: part `reverse` in the rules, `tex.white`, and a reverse-role mesh (car-lab's reverse tubes), which is lit
  automatically. One reverse material per car (the first source wins). `color`: its unlit colour (a part `reverse` otherwise
  copies the white headlamp material, which reads as a lit lamp while driving); `{ color }` alone is a valid `reverse`.
- **Car-lab cars** (`bentley-gt`, `mustang`: no model, lamps built by `car-lab/src/vehicle/lights.js` into `c.lamps.root`, outside
  the LOD levels): fitted automatically. Their LED tubes are the tail meshes (rules apply; default guide), the centre stop lamp
  (role `brake`, `m.brakeLight`) is lit as a fill on the brake, the reverse tubes (role `reverse`) as the reverse lamp, and the
  closed lamp covers (clones of car-lab's rear lens) become the smoked `rearLens` like the ribbon lenses. Brake-role meshes on
  a model would be handled the same way (none has one today).
- **`levels`**: per-car overrides of `LV` (larger or smaller emitters than AV-12's). **`qa.macro`**: the lamp `qa-taillights.mjs`
  frames up close (default: the right rear lamp in `model.json`, or the mean of a car-lab profile's rear lamp points).
- `checkSpec` reports unknown keys, parts and malformed boxes or regexes; `fitTail` warns in the console, `test-brake-lights.mjs`
  fails on them. A spec whose rules match no element warns "no lamp element matched".

## Survey of the other 15 cars (2026-10-30)

From `lamp-parts.mjs <car> --mats`, its component lists and `--uv` (car frame, metres; "rear" = triangle centre x > 1.2).
No model has a `brake` or `reverse` role and none has its own reverse lamp identified; the game drops every `tail` material's
map. What each car could not get before stage 1 is now a spec key (last column).

| Car | Built as | Tail lamp (role `tail`) | Other rear lamp materials | Indicator / reverse / lens | LOD 1 tail | Spec keys it needs |
|---|---|---|---|---|---|---|
| `furari-488` (488 Pista) | lens over emitters | `tail\|Red_LG` 2016 tris: a 25 % lens tinted by a colour-ID map (salmon red, white discs, orange spots); twin round lamps per side (622 tris, x 2.01), a centre bar (2.22, 0.93, 0; 0.40 wide), a lower pair (2.24, 0.52, ±0.51), a centre lamp (2.24, 0.27, 0) | `keep\|Light` (1686 rear tris: the round lamps' emitters, emissive 1 x an emissive map, glowing all the time today) | amber spots and white discs in the map; lens: Red_LG itself (the game makes it an opaque lamp) | 556 (decimated) | `adopt` keep\|Light + `tex` (likely `map: 'emissiveMap'`), `material` rule Red_LG → `lens` or `tex` on it, `box` rules for the centre and lower lamps |
| `laferrari` (La Furari) | texture | `tail\|Vehicle_Exterior_mm_lights` 1304 tris, 512 atlas: per side a round lamp (red ring 451 tris + centre disc 192 tris; the atlas holds an unlit and a lit ring, both mapped), a centre stop bar (0.89, 0.99, 0; 18 tris) | `keep\|..._lights`: ring housings, a lower pair (2.28, 0.44, ±0.43) | none / the white centre disc in the map / none | 1304 (same) | `tex` with `white` (and `hue` for the lit ring's yellow LED cores), `box` → `fill` for the stop bar, `lens.shell`. Exercised by a throwaway spec in stage 1: works |
| `huracan` (HU–10) | texture | `tail\|..._lights.etc` 108 tris: one Y light guide per side (54 tris), its core brighter in the 512 atlas | `keep\|..._lights.etc`: the housing behind it (143 tris/side), a 6-tri piece (2.03, 0.83, ±0.57) | none in the tail (check the housing's map) / none / none | 108 (same) | `tex` (`lo`/`hi` on the guide's gradient), `lens.shell`; possibly `adopt` part of the housing |
| `aston-martin-valk` (Valkyrie-X) | texture | `tail\|..._lights.etc.png` 1944 tris: 18 bars (108 tris each, two rows per side), the 512 atlas a strip fading from a bright inner end to dark | `keep\|..._lights` housing (42 tris/side at 2.04, 0.60, ±0.75) | none / none / none | 1340 | `tex` (the fade is the structure), `box` rules per row (guide / fill), `lens.shell` |
| `bentley-gt` (Continental GT) | car-lab procedural | no model: one closed fitted LED ring per side (`m.taillight` tube) under a closed cover and a ribbon lens; centre stop on the roof line (`m.brakeLight`, x 1.41, y 0.94); reverse tubes in the bumper (`m.reverseLight`, y 0.38) | lamp housings (`lampHousing`) | none / reverse tubes / car-lab rear lens | outside the LOD (always full) | nothing beyond `{ spill: true }` and `levels`: the car-lab lamps are fitted automatically (exercised by a throwaway spec in stage 1: ring, stop lamp and reverse light) |
| `jaguarxkjss` (AMG ONE model) | geometry | `tail\|brake_lamp` 288 tris, emissive red: per side three elements: an inner piece facing forward (38 tris, the inside of the housing) and two slim bars (53 tris at z 0.60 and 0.47) | `keep\|Material.005`: a 70 % dark lens with a faint red emissive (72 tris/side) | none / none / keep\|Material.005 | 288 (same) | `lens.material` /Material\.005/, rules by `box` (the inner piece `off` or `fill`), no reverse on the model |
| `bmw1` (Mercedes-AMG GT4) | texture strips, layered | `tail\|emiss_Lights` 38 tris: two thin LED strips per side (10 and 9 tris), 28 % alpha, map + emissive map | `keep\|Lights` atlas: housings (268 tris/side), a centre piece (2.13, 0.85, 0; 22 tris), a lower pair (2.16, 0.43, ±0.54), a centre unit (2.21, 0.78, 0; 198 tris); `keep\|light_glass` lens (44 %, 137 tris/side) | check the Lights atlas / unknown (lower pair?) / keep\|light_glass | 38 (same) | `tex` (map or emissiveMap), `lens.material` /^keep\|light_glass/, `adopt` + `box` for a centre or reverse unit if the atlas shows one |
| `buggati` (Divo-X) | geometry | `tail\|Material.003` 652 tris, emissive red, 51 components: the Divo's fin array (10-tri fins) | `keep\|Material.005` grey pieces (2.15, 0.93, ±0.45) | none / none / none | 168 (fins merged) | `box` / `minTris` rules (fins as guides, a band as fills), `lens.shell` optional; a catch-all last rule for LOD 1 |
| `destrier` (Destrier-X) | geometry, flat | `tail\|Material.001` 1476 tris, emissive (1, 0.26, 0.26) (pinkish); its map is one flat 8x8-texel corner (no detail): a flat panel per side (532 tris, 0.72 x 0.32 m, facing +x), a low centre piece (2.22, 0.15, 0; 244 tris), a high centre bar on the wing (2.47, 0.82, 0; 168 tris) | none | none / none / none | 502 | `box` rules (wing bar → `fill`, a stop lamp; low centre → `fill` or `off`), `lens.shell`; no `tex` (the map is flat): the panel's structure has to come from the LED dots of a fill |
| `mustang` | car-lab procedural | three open fitted LED bars per side under ribbon lenses, centre stop lamp, reverse tubes | lamp housings | none / reverse tubes / car-lab rear lens | outside the LOD | as `bentley-gt` |
| `blackbird` (Blackbird-X) | layered | `tail\|Material.008`: a 66 % red lens (544 tris/side); `tail\|Material.009`: the emitter, base red with an emissive map (448 tris/side) | `keep\|Material.006`: an opaque red lower bar (2.39, 0.43, ±0.53; 376 tris/side); `keep\|Material.014`: amber side markers (x 1.85, z ±1.06) | side markers only / none / Material.008 (tail role) | 335 + 276 | `material` rules: Material.008 → `lens`, Material.009 → `guide` with `tex` `map: 'emissiveMap'`; `adopt` Material.006 (a fill) or `dark` it; `dark` the side markers |
| `mp1x` (720S model) | texture, very low poly | `tail\|lights` 44 tris: per side a C-lamp (9 tris) whose lit line is a thin red stripe painted on a dark lens in the 512 atlas; a centre bar (2.15, 0.72, 0; 4 tris), side markers (1.73, 0.66, ±0.94), a lower pair (2.20, 0.46, ±0.44; 2 tris) | `keep\|mesh` (a grille with alpha over the lamps, 10 tris/side) | none in the tail / lower pair? / none | 44 (same) | `tex` (the stripe), `box` rules for the small pieces, `lens.shell`; `glow` < 1 on the C-lamps (their glow point sits on the lens centre, not on the stripe) |
| `porsche1` (918–S) | texture (body atlas) | `tail\|Bodyunrefunblend1_diff` 324 tris: the lamp (153 tris/side) painted in the body's 1024 atlas, lower strips (2.04, 0.62, ±0.73; 8 tris), 1-tri bits | none at the lamp | read from the atlas / none / none | 324 (same) | `tex`, `lens.shell`, `box` rules for the strips (and the 1-tri bits `off`) |
| `nissan-z` (Nissan Z GT4) | texture, layered | `tail\|mm_lights` 480 tris: the lozenge's two bars per side (120 tris each), red with a baked pink halo in the 1024 map; `tail\|mm_windiws` 44 tris: small lens pieces of the centre rain light (2.15-2.17, 0.41-0.48, ±0.02) | `keep\|mm_lights`: housings (258 tris per bar) and the rain light (2.16, 0.44, 0; 12 tris); `keep\|mm_windiws`: the lamp lens (25 %, 231 tris/side) | none / unknown / keep\|mm_windiws | 142 + 44 | `material` rule `^tail\|mm_windiws` → `lens`, `tex` on mm_lights (the halo is baked: `lo` above it), `lens.material` `^keep\|mm_windiws` (not /mm_windiws/: that also matches the rear window, `glass\|mm_windiws`) |
| `supra` (GR Supra GT) | geometry, four materials | `tail\|red_glass` 364 tris: an opaque red outer lens (182/side); `tail\|brake_1` 589 (the lamp element 159/side + the FIA rain light's 18-tri LEDs at (2.11, 0.57-0.61, \|z\| ≤ 0.05)); `tail\|brake_2` 83 (inner bars 2.02, 0.74, ±0.42); `tail\|brake_3` 144 (1.95, 0.72, ±0.62) | none | none / none / red_glass (tail role) | all four, 845 tris | `material` rules (red_glass → `lens`, brake_N → `guide` / `fill`), `box` for the rain light (`off`) |

Patterns: texture lamps (8: laferrari, huracan, aston-martin-valk, porsche1, mp1x, nissan-z, bmw1, furari-488), a lens or emitter in
a material of its own or with the `tail` role (furari-488, blackbird, nissan-z, supra, jaguarxkjss, bmw1), no lens at all (7),
pure geometry (buggati, destrier, supra, jaguarxkjss), car-lab lamps (bentley-gt, mustang), centre stop / rain lamps (laferrari,
furari-488, destrier, supra, nissan-z, bmw1, mp1x, the car-lab pair). Not found on any model: a reverse lamp of its own (only
texture white or a judgement call on a lower lamp pair). Amber inside a red element exists only as texture (furari-488's orange
spots), which `tex` leaves unlit; a separate amber component would take part `indicator`.

## Per-car checklist

Browser runs only through the lock, one at a time, never in the background (`node scripts/qa-lock.mjs -- ...`). Other agents
wait on the same lock: do everything offline first and narrow every browser run.

1. **Read the model offline.**
   - `node scripts/lamp-parts.mjs <car> --mats`: every material, rear triangles, alpha, colour, maps (`--lod 1` for the far level).
   - `node scripts/lamp-parts.mjs <car>` (or `<car> "regex"`): components of the lamp-like materials (centre, size, normal).
   - `node scripts/lamp-parts.mjs <car> --box x0,y0,z0,x1,y1,z1`: which materials have triangles in a box.
   - `node scripts/lamp-parts.mjs <car> "^tail\|" --uv qa/taillights/<car>-uv.png` (`--emissive` for an emissive map): the
     lamp in its texture and what `tex` lights in it.
2. **Before stills** (once, the full set): `TAILS=off node scripts/qa-lock.mjs -- node scripts/qa-taillights.mjs <car> qa/taillights/<car>-before`
3. **Write `src/carkit/tails/<car>.js`** (header comment: what the lamp is, judgement calls), then at once
   `node scripts/lamp-parts.mjs <car> --rules` (and `--rules --lod 1`) and `node scripts/test-brake-lights.mjs`. The file is live
   in the dev server the moment it is saved, for every agent's race (each car is in every field), so a broken spec breaks other
   agents' runs: check it straight away.
4. **Iterate narrow**: `LOOKS=night WEATHER=dry STATES=brake VIEWS=macro,chase DRIVE=0 node scripts/qa-lock.mjs -- node scripts/qa-taillights.mjs <car>`
   (then `LOOKS=day`, `STATES=running,reverse` as needed). Read the stills with the Read tool.
5. **After stills** (once, the full set): `node scripts/qa-lock.mjs -- node scripts/qa-taillights.mjs <car>` (to
   `qa/taillights/<car>-after`), then `node scripts/qa-taillights.mjs --sheet qa/taillights/<car>-before qa/taillights/<car>-after qa/taillights/<car>-before-after.jpg`
   (the full sheet and `-highlights.jpg`; its crops are AV-12's framing, so check the full stills too).
6. **Check in the stills** (`<look>-<dry|wet>-<running|brake|reverse>-<view>`). Since 2026-10-31 the tool turns off the dev
   viewer's camera headlight (on in orbit mode, off in the game's chase mode): every still shot before that has a large
   white-yellow glare low on the car's rear at night, which the rollout groups took for exhaust glow. Compare like with like.
   - running (every look): only the guides lit, a dark smoked lens by day with sky and sun reflections, a clear red at dusk and
     night; no element brighter than AV-12's at the same look.
   - brake: the step from running is obvious at chase distance; the fills light with visible LED dots at macro; red, not pink,
     orange or white-cored; the stop lamp (if any) lights; no glow wider than the cluster; no red on bodywork ahead of the lenses.
   - reverse: a white cell or element, nothing else changes; by day subtle, after dark clear.
   - indicators: dark amber, never lit; side markers and rain lights unlit.
   - day / dusk / night: the same on-screen read (levels follow exposure); the pool only after dark, behind the bumper, no
     visible quad edge.
   - dry / wet: dry roads never look wet; a wet road shows a streaked red reflection of the lamps.
   - macro (1.4 m, the car's right lamp) / chase (6 m) / rear34 / far and far34 (20 m): elements separate at macro, the unit reads
     as one lamp at chase, red points with a little glare at 20 m, no blob.
   - drive frames (night rain, the AI braking): no flicker or blink between frames, no detached glow at speed.
   - nothing placeholder-looking, no neon, no hard blinking.
7. **Frame rate** (after a change to shared code; every car is in every race): see Performance. One race against another is
   noisy (±5-10 %: the AI drives a different race each time), so alternate several `?tails=off` and on runs and compare the
   means, and A/B a single feature inside one race (toggled every second) rather than across races.
8. **Commit** the car's spec file only (`git add src/carkit/tails/<car>.js`); its QA notes in the file's header. A capability
   the spec keys cannot express goes to the orchestrator (`taillights.js` and this doc are shared), not into a car's commit.

## Stage 2: three groups

Each group edits only its own `src/carkit/tails/<key>.js` files and its `qa/taillights/<key>-*` folders.

- **A, texture lamps** (`tex`, `lens.shell`, `box` rules): `laferrari`, `huracan`, `aston-martin-valk`, `porsche1`, `mp1x`.
- **B, layered models** (a lens or emitter in a separate or tail-role material, emissive maps: `adopt`, `lens` part and
  `lens.material`, `tex` with `map`, `dark`): `furari-488`, `blackbird`, `nissan-z`, `bmw1`, `jaguarxkjss`.
- **C, geometry and car-lab lamps** (component rules by `material` / `box` / `minTris`, multi-material tails, rain lamps, the
  car-lab pair): `buggati`, `destrier`, `supra`, `bentley-gt`, `mustang`.

All 15 were converted (per-car sheets `qa/taillights/<car>-before-after*.jpg`, group sheets `qa/taillights/rollout/group-*`).

## Rollout results (2026-10-31): the new keys per car

Each change re-shot (`qa/taillights/<car>-step2*`), compared with the car's approved `-after` stills, kept only where it reads
better; the reasoning is in each spec's header.

| Car | Change | Kept? |
|---|---|---|
| `mp1x` | centre stop lamp on the engine cover: a fill with `tex: false` and `glowAlong` (the atlas paints it unlit) | yes: a crisp red bar under the rear window on the brake |
| `jaguarxkjss` | outer segment `flip`ped to face back, same glow as the others | yes: three lit segments per side (two before) |
| `bmw1` | `adopt.box` (\|z\| > 0.3): the star badge and third brake light keep the model's material | yes: no visible change, the badge is no lamp element |
| `nissan-z` | `adopt.box` leaving out the two plates under the wing | no: their model material glows red all the time |
| `destrier` | blades lit at their rear edge (`facing`), `glowAlong`, AV-12's levels again; diffuser reverse lamp `reverse.color` + `glowAlong` | yes: a thin light blade with a line of glare; the reverse lamp no longer looks lit while driving |
| `furari-488` | the clear centre disc as the reverse lamp with `reverse.color` | no: the reverse read right, but the brake lost its filled disc |
| `bentley-gt` | `bowl: true`, ring `glowAlong` | yes: the oval fills red with LED dots on the brake, a glow along the ring |
| `mustang` | bars `glowAlong` | yes: a tight glow hugging each bar (none before) |
| `supra` | inboard bar `glowAlong` (was a small centroid glow) | yes: a line of glare along the bar on the brake |
| `buggati` | fins lit at their rear edges (`facing`), AV-12's levels again | yes: the Divo's thin red lines between dark fins (the tops lit as orange-red slabs before) |

## Performance (2026-10-31)

Measured at Marina, night, dry, 1 lap, 8 cars, `buggati` as the player car, with throwaway copies of `qa-race-watch.mjs` (the car
seeded, per-frame JS time, the app's own GPU timer query read back, draw calls, `getProgram` calls) and a held-grid benchmark
(the race held on its grid, a fixed camera behind all eight rears). The race is CPU-bound in headless Chrome here: ~8 of
~11.5 ms per frame is JS, the GPU ~4.5 ms.

- **What cost what** (in-race A/B, the feature toggled every second, frame time): the lens 3.3 % (three.js's two-pass
  double-sided transparent draw flags the material `needsUpdate` twice per lens per pass: ~7 full program lookups a frame), the
  pools 1.2 %, the split-off parts (reverse, indicator, lens, adopted meshes) 1.0 %, the glow Points 0.6 %, the spill SpotLight
  ~0.5 % (±1.6; it is not the 2.6 points group C read from single runs). The tail shader's LED dots and `fwidth` cost GPU only on
  a few hundred lamp pixels, and the GPU is not the bottleneck: not separable from the noise.
- **What changed**: the lens in one pass, the glows frustum-culled, no pool past 60 m, no per-frame closure in `driveTail`
  (`5027aa9`). In-race A/B of the old lens and unculled glows against the new: +1.5 % ±0.6. Held grid: HEAD 104.7 / 99.2 fps,
  after 112.6 / 112.2, `?tails=off` 112.9 / 105.9; program lookups per frame 97-102 / 83-88 / 83-88; draw calls 653 / 644 / 640.
  AV-12's 39 dry stills against a fresh baseline: mean abs difference 3.34, lamp crops 3.83 (run-to-run noise 3.25 / 3.86).
- **On against off, final** (all 16 specs as committed, 4 + 4 whole races alternating `?tails=off` / on, raw summaries in
  `qa/taillights/rollout/perf-final.json`): the three races that ran normally with `?tails=off` averaged 113.7 fps, the two
  with the lamps 109.2 fps: **-4.0 %**. Per frame: JS +0.6 ms (5.47 against 4.89), GPU +0.2 ms, draw calls equal (465; the
  generic lamps' halo sprites cost what the glows and pools do). Three races (one off, two on) ran throttled from outside the
  page (frame time 12-17 ms against 5-6 ms JS and 4.4 ms GPU, the race 150-180 s instead of 122 s, as the simulation slows with
  the frame rate) and are left out; all eight averaged give -7.9 %. The held-grid benchmark, with all eight rears in view, is at
  parity. Earlier the same day (the PC slower: ~8 ms JS a frame) three alternating pairs with the step-1 code gave 83.1
  against 90.9 fps (-9 %; the off races 102.5, 85.1, 85.0: race-to-race spread larger than the difference). Group C's -15 % (95.2 / 81.2) was before this work and single runs.
- **Found, not changed** (cars.js): every 4th frame the hero's cube capture renders with the hero hidden and shadows off, so the
  light set changes and every lit material in the scene re-runs `getProgram` twice that frame (~60-80 calls a frame on
  average, with or without the tail lamps; the hero's beams and spill drop out of the light set with it). A capture that keeps
  the light set unchanged would likely remove most of it; not tried.

## The "exhaust glow" in the rollout stills (2026-10-31)

All three groups noted a large white-yellow glow low on the rear of stationary cars at night. It was the dev viewer's camera
headlight (main.js `headlight`, on in orbit mode, where `qa-taillights.mjs` shoots; off in chase, where the game plays), now
turned off by the tool. With it off, the night stills of all 16 idle cars (`qa/taillights/rollout/final/<car>/night-dry-running-*`)
show nothing at the pipes: no constant glow from the exhaust fire (`fx-flame.js` spawns only on a pop, `fx.js`'s pop light is
at zero between pops). What remains bright there is floodlight reflections on glossy lenses and chrome.

## AV-12 results

- Stills: `qa/taillights/av12-before/`, `qa/taillights/av12-after/`; sheets `qa/taillights/av12-before-after.jpg` and
  `qa/taillights/av12-before-after-highlights.jpg` (not committed, like the other `qa/` captures).
- Frame rate, `qa-race-watch.mjs marina night 1`, AV-12 as the player car: generic lamps mean 74.9 / median 71 fps, this
  treatment mean 76.0 / median 71 fps (reports `qa/taillights/race-night-tails-off.json`, `race-night-tails-on.json`). Finished,
  darkFrames 0, the same two pre-existing warnings.
- Judgement calls: the inner aluminium honeycomb cell is treated as the reverse lamp (a clear reflector cell is a reverse lamp's
  signature; the model names none). If a reference shows otherwise, move `reverse.box`.
- Stage 1 left it unchanged: fitted offline with the previous `taillights.js` and the new one (every mesh's index and `aLamp`,
  materials, glow points, pool, spill and uniforms over three frames, LOD 1 included), all 100 outputs are identical. Re-shot
  (`qa/taillights/av12-after-rollout/`) against the approved set: mean absolute difference 3.255 over the 39 dry stills, where two
  runs of the same code differ by 3.248 (lamp crops 3.86 against 4.12): within run-to-run noise (grain, a sub-pixel pose shift).
- The performance work (2026-10-31) left it unchanged: every spec fits offline to identical meshes, indices, aLamp and glow
  items, and the one-pass lens re-shot against a fresh baseline differs by 3.34 (lamp crops 3.83) over the 39 dry stills, the
  noise level, with no visible change in the lamp crops (`qa/_tails-perf` was throwaway and is deleted).

## What the models would need (not done; no GLB was edited)

Nothing blocks a conversion: every pattern above is a spec key. A model authored for this would carry one material per element
(`tail_guide`, `tail_fill`, `reverse`, `indicator`, `lens`) through `source.json` `roles`, so no component rules, `adopt` or
texture classes are needed, and UVs on the fills for a baked LED map. Per car, from the survey: `furari-488`, `blackbird` and
`bmw1` would want their emitters as `tail` and their lenses as their own material (today the roles are swapped or split);
`nissan-z` and `supra` would want their tail-role lenses out of the `tail` role; the seven lens-less models (laferrari, huracan,
aston-martin-valk, porsche1, mp1x, destrier, buggati) a real lens surface; `destrier` a map with the lamp's structure.
