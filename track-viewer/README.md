# Track viewer (three.js r186, WebGL2)

Shows the Blender-built Corniche Marina track the way the game will. Every engine-side effect is on a switch in the
panel, so you can judge each one on its own.

```bash
npm install
npm run dev        # copies the built track + HDRIs into public/assets, serves http://127.0.0.1:5180
```
In the Claude desktop app it is the `raceultimate-viewer` preview config.

## What it does
| Area | How |
|---|---|
| Looks | dusk (default) / blue hour / night: Poly Haven sky as background and PMREM environment, rotated so the HDRI's own sun sits on the scene sun's bearing; exposure, fog, emissive scale, colour grade and lens-flare gain per look |
| Tone mapping | per look (`tm`): Neutral at dusk keeps saturated paint red (AgX turned it salmon); AgX after dark rolls the floodlights off instead of clipping them |
| Team artwork (`src/teamdress.js`) | each team's own display font (OFL, one per team in `teams.json`: Racing Sans One, Cinzel, Bungee, Limelight, Lalezar) painted onto the per-team materials the Blender build makes: lit garage headers, the team panel on each pit box floor, the flags (still rippled by life.js), the Corniche Club's hanging banners and its commentary sign |
| Commentators | Enzo (Lewis) and Alastair (Brian) at the Corniche Club booth's balcony rail, from `vip.json` |
| Paint finishes (`src/finish.js`) | each car's real surface from `assets/cars/finishes.json` (read off its concept sheet; colour stays the team's): metallic flake grain sized to ~1.5 px at any distance (base layer only, the clearcoat stays smooth), pearl (thin-film iridescence), deep solid gloss, exposed 2x2 twill carbon below a per-car height line (flips light and dark with the view, fades where a tow is under a pixel), rim and caliper colours. Decals are vinyl: never metallic or flaked. In rain, water beads bend the clearcoat on upward panels |
| Liveries (`src/livery.js`) | each car wears its team's livery from `assets/teams/teams.json`: four decal sheets per car (both flanks, top, rear) drawn on canvases in body metres from the car-lab profile (number on the door, driver name under the window line, title and series sponsors, the team's graphic), projected in the paint shader by surface facing (the shells have no UVs). Text reads correctly on both flanks; graphics flow nose to tail. Fonts: Anton and Barlow Condensed (OFL, `public/assets/fonts`). About 8 MB of decal textures per car (19 MB for the player car's sharper set) |
| Sun glint | the low sun's highlight on wet tarmac: narrow in bearing, long toward the camera, gated by the road mirror so it vanishes where a stand or car hides the sun |
| Golden haze | fog on every built-in material gets a forward-scatter term toward the sun (`fogSun`), computed in world space so the mirror and car reflections match |
| Venue lights | `lights.json` from the Blender build: 6 floodlight spots, 4 stand-lamp spots and 6 street-lamp points move to the nearest venue lights 4× a second. Every other lamp is emissive + bloom. |
| Headlight | a spot ahead of the camera |
| Wet road | all in the shader: damp darkening, only slightly smoother; world-space noise puddles on tarmac that turn to mirrors; planar-mirror reflections that smear vertically with roughness and only show where the surface is actually smooth; puddles flatten the asphalt's normal (standing water drowns the grain) and rain rings them with ripples. The mirror renders at 0.36 of the frame on high, skips cars beyond 80 m and the small unlit props on layer `NO_MIRROR` (shadows and AO still see them) |
| Surface detail | 16× anisotropic filtering on every texture; the asphalt texture again at ~4× frequency as detail; world-space grain on turf, kerbs and lines |
| Shadows | sun / moon (2048, follows the camera, re-rendered per 8 m cell), headlight (512), the 2 nearest floodlights + nearest stand lamp (1024, re-rendered only when they move) |
| AO | GTAO at half resolution (8 samples) before bloom, with rain, people, cars, trails and the mirror plane hidden from its depth/normal pass |
| Rain | 9k GPU streak quads that wrap around the camera |
| Post | Unreal bloom (each pixel's input capped, so the sky beside a low sun glows instead of veiling the frame) → tone mapping (AgX / ACES / Neutral) → speed blur after Project Endurance (from 10 km/h, full by 150: streaks toward the point the car is heading for, a clear zone around the car, colour fringes along each streak, faint speed lines; boost pushes it to full; Reduce motion cuts it to 40%), chromatic aberration, colour grade (split tone, S-curve, black point, saturation), sun lens flare (starburst, streak, ghosts, rainbow halo; visible only when the sun's pixels are), vignette, grain → SMAA |
| Camera (`src/camera.js`) | **chase** (default): framed like Project Endurance's default close chase: 4.2 m back, 1.3 m up, aimed 0.8 m above the car 2-5 m ahead, breathing out 0.5 m with speed and back under hard acceleration. Critically damped springs per channel; the position spring smooths the offset from the car, not its world position (a world-space spring trailed a fast car by ~16 m). Yaw lags more at speed, so the car swings in the frame through corners. FOV 62° rising to 72° by 200 km/h (+9° under boost), roll with cornering load, a dip under braking; trauma shake (rotation only, squared, smooth noise) with a rumble near top speed and a buzz on kerbs; `boost` envelope ready for nitro (fast in, slow out). **Reduce motion** turns shake, roll and most FOV change off. Also flythrough along `racingLine` with jump-to presets, or orbit |
| Textures | KTX2 (Basis Universal) by default: they stay compressed on the GPU, about 4× less VRAM than WebP. Add `?tex=webp` for the WebP build. |
| Sky (`src/sky.js`) | A cloud dome over the Poly Haven sky: procedural clouds ~1.5 km up drift with the wind and thin into haze at the horizon. Dusk lights them warm with silver edges toward the sun, blue hour cool grey, night with the city's sodium glow from below. A horizon light-pollution band keeps the skyline in haze. A sun disc with a wide warm glow sits 7° up on the sun's bearing (dusk, faint at blue hour, none at night). |
| Lamp glows (`src/glow.js`) | ~580 point sprites, one draw call, one for every floodlight, stand lamp, street lamp and beacon. Each keeps a minimum on-screen size and dims smoothly with distance; floodlights are dim from behind, beacons pulse at their own phase. The tiny lamp meshes are dimmed below the bloom threshold. Before this, sub-pixel lamps popped in and out with bloom halos and read as flicker. |
| Anti-shimmer | Measured with a frame-to-frame diagnostic (brightness jumps that motion can't explain), traced to objects by raycast. The **chain-link fence was 67%** of the shimmer: it now blends its mipmapped alpha with 1× anisotropy and a one-mip blur. Other cut-outs use alpha-to-coverage, and the composer renders with **MSAA** (4× high and ultra, 2× medium). Shimmer events in a night drive-by: 299k → 101k. |
| Things that move (`src/life.js`) | All in shaders, plus one canvas redraw every 0.5 s: <ul><li>team flags ripple and bunting tips sway (displacement in metres, scale-aware for quantized meshes)</li><li>the crowd bobs; `viewer.cheer(1)` makes most of them jump, then it settles</li><li>the big screen shows live timing (a canvas texture: LIVE, lap, top 6 with overtakes)</li><li>LED perimeter boards flare two sponsors at a time, the canopy's LED lattice pulses in waves</li><li>the hotel crown drifts through violet hues, the water ripples, aviation beacons on masts, skyline roofs and service vehicles blink</li></ul> |
| Game (`src/game/`, GAME.md) | Ultrack V1: title, main menu, race / time trial / drift attack / free drive, garage with car picker and paint tuner, settings (picture, driving aids, sound, controls), HUD, pause, results; engine sound, race cues, crowd and the three commentators. Runs by default; `?dev=1` is the bare viewer with the tuning panel |
| Physics (`src/physics/`, PHYSICS.md) | the race cars drive on the track's collision mesh (Rapier, 120 Hz fixed step): suspension and slip-angle tyres per wheel, grip by surface (grass, gravel, kerbs), power/drag/downforce per car (`assets/cars/handling.json`, balanced to within 4% on AI laps), assists, drift mode, nitro. You drive the hero (WASD/arrows, Space handbrake, Shift nitro, R reset, or a gamepad); the AI drives the rest. `?physics=0` for the old line-following |
| Tail-light trails (`src/trails.js`) | a short additive ribbon behind each racer's tail lamps, one draw call for all; length follows speed, brighter under braking; faint at dusk, strong after dark |
| Cars (`src/cars.js`) | All fourteen team cars (`assets/teams/teams.json`; a car that cannot load is skipped). Each team races one car (seven on track; `?lineup=2` races the second cars), the player in Saetta's; the others stand in their team's pit boxes. The cars: assembled with **car-lab's own modules** (read-only import of `car-lab/src/vehicle`: profiles, paint, procedural wheels, glass, mirrors, fitted lamps), so they match the assembly lab. Only the body differs: a derived game mesh (`npm run derive:cars`) replaces the 1.1–2.8 M-triangle shell, with car-lab's normalisation baked in so every fit anchor still lines up. 80k / 20k body LOD by distance; full wheels within 22 m, stand-ins to 60 m, one static wheel proxy and no side mirrors beyond; only cars within 50 m cast sun shadows; parts merged per material. Paint reflections are capped in brightness (no bloom halos on the rims). Exhaust and nitro anchors per car from `assets/cars/exhaust.json` (rays find the rear surface; `?debug=exhaust` shows them; the electric Roadster-X has nitro points but no exhaust). The player car reflects the venue: one 128 px cube face every other frame, PMREM-filtered, with the venue's lamps, LEDs and neon burning 3× brighter in the capture so the paint carries bright light shapes after dark. Contact shadows; lamps follow the look (running at dusk, low beam at blue hour and night); brake lights from deceleration. **Chase** camera mode (default) races them on the racing line: grip-limited speeds, braking, steering, wheel spin, and traffic that slows and pulls out to pass, with no overlaps in a 90 s test. Cost: **≈3.8 ms per frame for the eight-car field** at 1080p high (median of an interleaved A/B). |
| People (`src/people.js`) | Mixamo and Meshy characters with their own animation clips, at random offsets: pit crews (Pete), marshals, photographers (Leonard), drivers, officials. They replace the Blender placeholder figures. `viewer.cheer()` plays their cheer clip once. 3D spectators are off (see `assets/characters/README.md`). |
| Quality (`src/perf.js`) | low / medium / high / ultra. **Auto** picks from the GPU: phones and integrated GPUs get low or medium, discrete GPUs get high. Ultra is opt-in. |
| Dynamic resolution | holds the GPU frame time under the fps cap's budget, using `EXT_disjoint_timer_query_webgl2` where available |
| Distance culling | small meshes hide beyond `radius × k` metres. GPU-instanced sets (palms, lamps, shrubs, crew, tyres) are culled **per instance** by compacting their matrices. At the start line it removes ~3,400 instances and cuts draw calls from ~1,300 to ~780. |
| Benchmark | `viewer.bench()` (or the button in Performance) renders 120 frames around the lap, each forced to finish on the GPU, and reports average and p95 ms, draw calls and triangles. It doesn't rely on rAF, so the numbers hold in a throttled pane. |
| Performance | render scale, an FPS cap (keeps the GPU cooler), and an fps / GPU ms / draw-call / triangle / culled readout |

Dev stills: `await viewer.snap('name')` renders one frame to `track-viewer/shots/name.png`, and works even when the page is hidden.

Console: `window.viewer.params`, then `viewer.applyAll()`. Also `viewer.setLook('dusk')`, `viewer.jumpTo('hairpin')`, `viewer.cheer(1)`, `await viewer.bench()`.

## Scripts
```bash
npm run pack         # all web GLBs from the Blender output (WebP, collision, KTX2): see scripts/pack-web.mjs for the flags that matter
npm run derive:cars  # game meshes for the car-lab bodies -> assets/cars/<key>/body_lod0|1.glb for the shell cars (bentley-gt, bmw1; read-only use of car-lab)
npm run test:track   # the engine contract: collision vs track.json, plus a Rapier raycast-vehicle lap (prints PASS)
```

## Measured (RX 9060 XT, in the app's browser pane, ~950×1200)
Holds the 60 fps cap with everything on: about 450–850 draw calls and 1.1–2.2 M triangles per frame (mirror, shadow and GTAO passes included).

The app's pane throttles the page when it's driven from the console, so readings taken that way drop to ~20 fps. Check real fps in a normal Chrome tab.

## Not here yet
- **Rain ripples in the puddles, tyre spray, raindrops on the lens**
- **Volumetric light shafts**
- **Impostors** for the skyline: it is cheap merged geometry today, and distance culling covers the rest
- **The car:** the vehicle work lives in `car-lab`.

## Replacement car attribution

McLaren 720S and Mercedes-AMG One credits, license links and modification details are in the [project README](../README.md#replacement-car-credits).
