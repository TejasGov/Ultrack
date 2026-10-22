# Project Endurance: how it's built, and how we'd build our own

*Teardown of https://endurance-racing.vercel.app/ (crawled 2026-10-18). This covers the HTML, the 2.5 MB main bundle, the lazy-loaded chunks, every JSON config and the glTF headers. Code was read and grepped, never run outside the page.*

## TL;DR
- **What it is:** a GT3 racing game in the browser by Anderson Mancini. It runs on **three.js WebGPURenderer with TSL shaders (WebGL2 fallback)**, **Rapier physics at 120 Hz**, plain **vanilla JS + GSAP** for UI, and **Vite** for the build. The track is the Nürburgring GP, it rains in every weather setting, and the radio plays classical music.
- **What makes it look good:** wet-road rendering and the post-processing chain, not geometry. The physics is a **custom raycast-suspension car with a Pacejka tire model**, plus an arcade "assist" layer on top.
- **No public source repo exists.** The site is free to play, but I found no GitHub repo (searched the author's 30 public repos and GitHub at large), and the bundle carries no license. Treat the code as **all rights reserved**. A **clean-room rebuild** is the right call: copy techniques and numbers, never code or assets.
- **A credible MVP** (one car, one track, rain, lap timer, drift score) is about **3–4 focused weeks** for one dev who knows three.js. Feature parity (10 cars, 20 challenges, ghosts, multiplayer, on-foot mode, 8 time-of-day looks) is **3–5 months**.

---

## 1. What we crawled

| Category | Files | Size |
|---|---|---|
| App code | `index-*.js` (three.js + app), `rapier-*.js` (WASM physics, lazy), 4 small look/paint/rig chunks, an engine AudioWorklet chunk | 2.5 MB + 1 MB |
| Track | `ring_visual.glb` 18 MB, `ring_vegetation.glb` 6.7 MB, `ring_collision.glb` 0.8 MB, `ring_height.bin` 1.3 MB, `ring_contain.bin` 12 KB, `ring.json`, `ring_gaps.json` | ~27 MB |
| Car | `mclaren_rig.glb` 2.1 MB: nodes `Body`, `Wheel_FL/FR/RL/RR`. Other cars lazy-load (`quadra_rig.glb`, …) | |
| Textures | 6 × 1.2 MB KTX2 detail normal maps (asphalt, kerb, grass, gravel, dirt, wall), noise maps, smoke, splash, birds | ~8 MB |
| Sky | `sunflowers_puresky_1k.hdr` (Poly Haven, CC0) | 1 MB |
| Audio | `v8.wav` + `v8.json` (engine), `tire-squeal.wav`, `nitro-turbo.mp3`, `releases.wav/json` (blow-off), rain/storm ambience, wet footsteps, UI clicks, radio playlist | ~3 MB + streamed music |
| Network | Google Analytics; multiplayer WebSocket `wss://endurance-party.threejspunk.workers.dev/room/<CODE>` (Cloudflare Workers) | |

The first load is **~40 MB**. Every GLB has been through glTF-Transform (meshopt + quantization + KTX2/Basis).

## 2. Architecture

```
Vite build ─► index.js (eager)                       lazy chunks
               ├─ three.js WebGPURenderer (+WebGL2)   ├─ rapier (WASM)
               ├─ TSL materials / compute / post      ├─ engineSampler.worklet
               ├─ game loop (fixed 1/120 s)           ├─ applyRealLook / applyNeonLook
               ├─ vanilla-DOM UI + GSAP               └─ realPaint, loadVehicleRig
               └─ settings: low/medium/ultra + URL overrides (?lite=1, ?reflect=…)
```

- **Loop:** a fixed-step accumulator. Frame dt is clamped to 0.1 s, with at most 8 substeps per frame. `preStep` / `postStep` hooks run on every step. The render interpolates the car pose between the last two physics snapshots (lerp position, slerp rotation). Copy this pattern exactly.
- **Physics world:** Rapier, `timestep = 1/120`, `numSolverIterations = 4`, gravity −9.81. Collision is a trimesh per surface type, using `FIX_INTERNAL_EDGES` everywhere except walls.
- **Persistence:** localStorage only (progress, paint, best drift, settings). There are no accounts and no leaderboard.
- **Lineage:** the code grew out of the author's earlier city game. Hidden `?alley` / `?metro` flags still load that city mode, and the localStorage keys are prefixed `threejs-punk:`.

## 3. Systems, with the numbers worth stealing

### 3.1 Vehicle physics (the heart of the game)
It does **not** use Rapier's built-in `DynamicRayCastVehicleController`. It runs its own model on one Rapier rigid body:

- **Chassis:** a dynamic body with explicit mass and inertia, CCD on, and two round-cuboid colliders of density 0.
- **Suspension:** one `castRayAndGetNormal` per wheel, a spring plus separate bump/rebound damping, bump stops and anti-roll bars.
- **Tires:** a Pacejka "magic formula" with combined slip, load sensitivity, relaxation lengths and wheel spin inertia. The solver takes 4 tire substeps per physics step.
- **Drivetrain:** torque curve → clutch → 6-speed auto → LSD, with ABS, TCS and ESC.
- **Base car numbers:**

| Param | Value |
|---|---|
| Mass / COM / inertia | 1480 kg / [0, .5, −.15] / [2300, 2200, 600] |
| Spring front / rear | 42 000 / 46 000 N/m; bump 2400, rebound 4300; anti-roll 12 500 / 6500 |
| Tire | μ 1.25, peak slip angle 7° (rear 7.5°), peak slip ratio .1, nominal load 3800 N, load sensitivity .16 |
| Engine | idle 900, redline 7600, limiter 7800; peak 605 Nm at 5000 rpm |
| Gears | 3.25, 2.25, 1.68, 1.32, 1.08, .90; final 3.9; shift .14 s at 7350 rpm |
| Brakes / steering | 7600 Nm, front bias .62, handbrake 2600 Nm; 34° lock, Ackermann .85 |
| Aero | drag area .76, downforce front .24 / rear .38 |
| Weather | global grip × 0.9 (always wet) |

- **Surface grip multipliers:**

| Surface | Grip | Off-road drag |
|---|---|---|
| asphalt | 1.0 | – |
| curb | .88 | – |
| puddle | .70 | – |
| grass | .60 | 2.2 |
| gravel | .52 | 4 |
| sand | .45 | 7 |
| wall | .30 | – |

- **Arcade layer** (why it's fun, not just accurate):
  - Extra forward accel of 4 m/s² up to 56 m/s.
  - Nitro: 5.5 m/s² up to 95 m/s; drains .22/s, recharges .07/s.
  - Yaw-rate turn assist (lateral G 2.3) and 0.8 countersteer assist.
  - Launch-control minigame: hitting the needle zone .70–.84 gives a "rocket start".
- **Drift mode:**
  - Starts with handbrake above 12 m/s while steering, then applies a yaw kick.
  - A PD controller holds a target slip angle (30°, max 48°, yawP 26, yawD 8). Tire lateral grip drops to 0.2 and a scripted lateral force of 1.7–2.8 g holds the arc.
  - Exits when the angle stays under 10° for 0.15 s.
- **Takeaway:** a "sim core + scripted assist" hybrid is the design to copy. Don't try to make pure Pacejka drift nicely on a keyboard.

### 3.2 Track pipeline (the clever, invisible part)
The track comes from **"Nürburgring GP 2022 layout" by Dave Love on Sketchfab, CC-BY-4.0**, credited in `ring.json`. An offline tools pipeline then derives these from that model (the metadata names `tools/assets/lib/ringDriveArea.mjs` and an `AGENTS.md`):

| Derived file | What it is | What it's used for |
|---|---|---|
| `ring.json` centerline | 1139 points at 4.5 m spacing, each with halfWidth, slope and banking; lap 5124.2 m | lap progress, reset-to-track, racing line, AI/ghost paths, minimap |
| `ring.json` start, pitLane, alternateRoutes | grid slots, pit polyline, 14 run-offs and shortcuts | spawning, pit, cut detection |
| `ring.json` freeArea | flood-fill of the drivable ground, stopped by walls | placing challenge beacons off-road |
| `ring_collision.glb` | trimeshes split by material (asphalt, curb, grass, sand, gravel, wall, other) | Rapier colliders that return a surface type → grip |
| `ring_height.bin` | 1024² float16, 2 layers (ground, occluders), 1.76 m per texel | fast height lookups, wet/puddle bake, rain occlusion |
| `ring_contain.bin` | run-length-encoded 1 m in-bounds bitmap | `contains(x,z)` out-of-bounds and recovery checks |
| `ring_gaps.json` | 55 hole spans along the centerline | procedural grass strips that patch road–terrain gaps |

**Takeaway:** spend real time on this pipeline. It turns any track mesh into a game track, and every gameplay system reads from it.

### 3.3 Rendering and weather
- **8 "looks"**: overcast, sunsetRain, goldenDrizzle (the default), dawn, midday, dusk, night and storm. Each one is a data object: sun azimuth, elevation and intensity, procedural clouds, height fog, grade (contrast, saturation, vignette, grain, CA), bloom, rain gain, wet settings (mirror strength, darken, puddles, ripples), lamps and lens flare. "Auto" mode blends to the next look every 80 s.
- **Rain:** TSL compute particles (1600 drops). Every 2 frames, an orthographic top-down depth pass (100×100 m, 512²) renders around the camera, so drops stop on roofs and splash where they land.
- **Wet road:**
  - A baked puddle mask from heightfield concavity, plus a racing-line channel.
  - Animated ripple normals.
  - A **planar mirror reflection** at half resolution within 150 m, with quality options full / near / off. This is the core of the "wet look" in the screenshots.
- **Car:**
  - TSL paint with gloss / metallic / pearl / satin / matte finishes, clearcoat and flake noise, plus a livery mask.
  - Rain beading on the body that fades with speed.
  - A 64 px reflection probe.
  - Materials are assigned by node-name suffix (`_paint`, `_glass`, `_tire`, `_rim`, …). This is a great convention for any car we import.
- **Post chain:** GTAO (half res) → mip bloom → **lens raindrops** (screen-space refraction) → radial speed blur → colour grade → SMAA/FXAA/TRAA → FSR-style upscale from an 85% render scale. It uses adaptive DPR capped at 1.5, and a 4096² follow-cam shadow map over 90 m.
- **Small extras:** bird flocks (shader wing-beats), exhaust flames and smoke, billboard impostors.
- **Sibling project:** the author's **MIT-licensed** [`ektogamat/threejs-conference`](https://github.com/ektogamat/threejs-conference), a rainy cyberpunk alley in WebGPU/TSL, has GPU rain that respects rooftops, wet pavement and a cinematic post chain. **It is the legal reference implementation for most of §3.3.** Read it first.

### 3.4 Audio
- **Engine:** an AudioWorklet scrubs a single recorded **rev sweep** (`v8.wav`). `v8.json` maps time to firing frequency (93→366 Hz; rpm = Hz × 15), so the worklet seeks to the position that matches the current rpm and pitch-corrects. A procedural `engine-synth` worklet is the fallback. This is a cheap, convincing technique: one sample, any rpm.
- **Turbo blow-off:** procedural flutter built from 10 sliced takes of `releases.wav` (CC0 Freesound clips).
- **Rest of the mix:** tire squeal mixed with bandpassed noise, rain/storm ambience, and wet footsteps.
- **Radio:** 9 public-domain classical recordings from Wikimedia Commons (Musopen etc.) plus 4 tracks under the Pixabay license. Every source page is listed in `playlist.json`.

### 3.5 Game modes and meta
- **Free Drive**, **Challenges** (20 in four tiers: reach, speed trap, drift, racing line, braking, explore, sector, clean lap; they unlock cars), **Garage** (car, paint, finish), and **Settings**.
- **Drift score:** points = dt × km/h × angle × 0.05 × multiplier. The multiplier grows +1 every 2 s up to ×5, with a 2 s grace period.
- **Echo:** your previous laps are recorded at 60 Hz and replayed as ghost traffic at 0.75 pace. Touching one costs +3 s.
- **Rescue:** a QTE "race the doctor" mode. **Photo Run** and **UFO** are novelty modes.
- **On foot:** F exits the car into first-person walking with wet footsteps.
- **Multiplayer:** up to 4 per room over WebSocket on Cloudflare Workers. Each update is a JSON array `[t, pos, quat, vel, flags]` with bit flags for brake, nitro, drift, horn and lights, plus a 2 s keepalive.
- **Input:** keyboard; gamepad (deadzone .09, steering curve power 1.6); touch (steer pad + buttons). The cameras are chase (×3), hood and bumper, with a base FOV of 62.

---

## 4. Rebuild plan

### Stack (same as theirs; it's the right one)
- **Vite + TypeScript** (they ship plain JS; TypeScript pays off for physics code).
- **three.js `WebGPURenderer` + TSL.** One shader language for both backends, with WebGL2 fallback for free.
- **`@dimforge/rapier3d-compat`** for collision, raycasts and rigid bodies. We write the vehicle ourselves.
- **Vanilla DOM + CSS** for the HUD and menus (or Preact if we want components). GSAP is optional.
- **Offline tools in Node:** `@gltf-transform/cli` (meshopt, KTX2, quantize), plus our own scripts for the centerline, heightmap and containment bakes.
- **Multiplayer (later):** Cloudflare Workers + Durable Objects, one DO per room.

### Phases

| # | Milestone | Done when | Est. |
|---|---|---|---|
| 0 | **Skeleton:** renderer with fallback, fixed 120 Hz loop with interpolation, chase cam, debug UI (lil-gui), quality presets | a cube on a plane, smooth at 144 Hz with physics at 120 | 2 d |
| 1 | **Car on a flat plane:** raycast suspension, a simple linear tire model first, then Pacejka; engine curve + 6-speed auto; keyboard + gamepad | it brakes, corners and spins believably; tune with the §3.1 numbers | 5–7 d |
| 2 | **Track pipeline:** import a CC-BY track, split collision by material, auto-extract the centerline (or hand-place a spline), bake heightmap + in-bounds bitmap, compress | the car drives a full lap with the right grip per surface, and R resets to track | 5–7 d |
| 3 | **Game layer:** lap timing and sectors from centerline progress, cut detection, drift scoring, nitro, launch control, HUD (speedo, gear, minimap) | a timed lap with a best-lap ghost (60 Hz pose recording) | 4 d |
| 4 | **The look:** HDRI/procedural sky, wet road (puddle mask + roughness + planar reflection), TSL compute rain with a top-down occlusion pass, lens drops, post chain, 2–3 looks as data | screenshots that hold up next to theirs | 7–10 d |
| 5 | **Audio:** rev-sweep engine worklet (or start with 3 crossfaded loops + playbackRate), tire squeal by slip, rain ambience, radio of public-domain recordings | the blindfold test: you can hear gear changes and slides | 3 d |
| 6 | **Meta:** garage (paint material + finishes), challenges as data, unlocks, localStorage save | 5 challenges and 2 cars | 5 d |
| 7 | **Reach:** touch controls, perf pass (LODs, impostors, render-scale upscaling), PWA manifest | 60 fps on a mid laptop, playable on a phone | 4 d |
| 8 | *(optional)* multiplayer rooms, on-foot mode, more looks, more cars | | weeks |

**Phases 0–5 make up the MVP (~5 weeks solo).** Phases 1 and 2 carry the risk; everything else is well-trodden three.js work.

### Asset plan (legal, ready to use)
- **Track:** the same Sketchfab Nürburgring model is **CC-BY-4.0**, so we may use it with credit. Fictional tracks avoid the "Nürburgring" name, which is trademarked. A procedural spline track works for prototyping.
- **Cars:** use **fictional** CC0 or CC-BY cars with separate wheel nodes. Search Sketchfab, then rename nodes to the `_paint`/`_glass`/`_tire` convention. **Do not ship a McLaren** (or any real marque): trademark and licensing risk.
- **HDRI:** Poly Haven (CC0).
- **Sounds:** Freesound CC0, Pixabay, or our own recordings. This repo's `library/sfx` and `synth.js` can cover the UI sounds.
- **Music:** Musopen and Wikimedia Commons public-domain recordings. Check each file's page; the *composition* being public domain doesn't make the *recording* public domain.

### Where we can do better than the original
- **Load size:** ~40 MB up front is heavy. Stream the track by sector, and hold back vegetation and the 1.2 MB detail normal maps until after the first frame.
- **Accessibility:** it has no remappable controls and no colour-blind-safe HUD.
- **Weather:** it rains in every look. Make dry ↔ wet a dial, so grip and the wet-shader parameters move together; that becomes a gameplay mechanic.
- **Leaderboards:** there are none. A Durable Object per track holding best laps (with ghost replays) is a small addition on top of the multiplayer worker.

## 5. Risks
1. **Legal:** clean room only. Nothing from their bundle, models, `v8.wav` (Pixabay license, theirs to use), or project-specific JSON goes into ours. Numbers and techniques are fine. Credit every CC-BY asset in-game.
2. **Handling feel** is where these projects die. Budget tuning time, build a live tweak panel on day one, and test with a gamepad early.
3. **WebGPU coverage:** Safari and Firefox support is still uneven. Test the WebGL2 fallback path on every milestone, not at the end.
4. **Performance:** the planar reflection plus GTAO plus 4K shadows is expensive. Ship low/medium/high presets from phase 4 onward.

---
*Sources: the live site and its assets; GitHub search of `ektogamat` repos; `ring.json` license block; `playlist.json` credits. Constants are from minified code, so the field names are the author's and the variable names are not.*
