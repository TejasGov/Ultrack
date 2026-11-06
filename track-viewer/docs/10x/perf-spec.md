# Ultrack Part A build spec: frame time and hitches first, then load order

Worktree: `D:/RaceUltimate-wt/perf` (all paths below are relative to `D:/RaceUltimate-wt/perf/track-viewer` unless absolute). Base design: **Design 2 (frame time first)**. Grafted onto it:
- from Design 3: the measurement gate comes first; shader-completeness assertion; the collision-cache promise fix; the leak-cycle check;
- from Design 1: the load-order changes that need no deploy (GarageRoom off the boot path, LOD1 after the venue, early venue/collision bytes, car fetch ahead of decode).

Every change is one commit, verifiable alone, behind a `?perf=<name>` switch in the existing pattern (`main.js:113-126`: `?perf=<name>` or `?perf=off` turns a saving off). Nothing is deployed and nothing is uploaded to R2.

## 0. Facts this spec relies on (read in code this session)

| Fact | Where |
|---|---|
| Stand-in wheels: `wheel-lod` group = 1 open cylinder + 2 rim discs + 2 sidewall rings = 5 meshes per wheel, 20 per car | `src/cars.js:363-374` |
| The far proxy comment says "2 draws instead of ~20"; the code adds 4 clones of those 5-mesh groups = 20 draws | `src/cars.js:376-388` |
| `mergeByMaterial` exists, bakes each child's matrix, and **hard-codes `receiveShadow = true`** and `castShadow` = its argument (default false) on the merged meshes | `src/cars.js:104-135` (line 132) |
| Field LOD bands: `DETAIL_M = 22`, `FAR_M = 60`, `SHADOW_M = 50` | `src/cars.js:139-141` |
| Hero cube capture: one face every `captureEvery` frames (low 0, medium 8, high 4, ultra 2), PMREM `fromCubemap` + `useHeroEnvironment` in the same frame as face 6 | `src/cars.js:808-839`, `src/main.js:1052` |
| Sun shadow: `sun.shadow.autoUpdate = false`; re-flagged in `tick` when the camera crosses an 8 m cell, **before** `updateFx` → `field.update` runs | `src/main.js:367`, `src/main.js:1166-1177`, `1179` |
| Leak: module-level `singles` Set (transparent double-sided materials); `unloadVenue` clears `allMats` but never `singles` | `src/main.js:479-481`, `561-572` (`allMats.clear()` at 567), used at 938 |
| Collision cache stores the awaited value, so concurrent creates both load: `PhysicsWorld.cache[url] ??= await …loadAsync(url)` | `src/physics/world.js:101` |
| `voidWalls` (plain JS + Rapier ray casts against a static world) recomputed on every world build | `src/physics/world.js:31-58`, called at `world.js:134` |
| World rebuilt 1.5 s after every quit | `src/game/game.js:355`, `prepareWorld` at `game.js:120` |
| Race preload starts at `attach` (title), then waits `setTimeout(800)` + `requestIdleCallback(2 s timeout)` before any fetch | `src/game/game.js:65`, `79-95` |
| LOD1 bodies fetched 1.8 s after each car, queued low, regardless of the venue download | `src/cars.js:430` |
| `AssetQueue(2)` wraps fetch **and** assemble | `src/cars.js:403`, `425`; `src/asset-loading.js` |
| `GarageRoom` is constructed during module evaluation, before `load()` starts any fetch; its constructor runs `pmrem.fromScene(RoomEnvironment)` synchronously | `src/main.js:514`, `src/garage-room.js:17-19` |
| `warmRace` compiles the frame programs first, then `prepareReflection` → `useHeroEnvironment` sets `envMap` + `needsUpdate` on 8 hero materials (body, mirrorPaint, glass, rim, mirrorGlass, headlampCover, frontLens, rearLens), so their envMap variants compile lazily at the first race frame | `src/main.js:799-818`, `src/cars.js:505`, `509-514` |
| `compilePost` compiles pass materials on the full-screen-quad geometry only | `src/main.js:778-794` |
| `perf-ab.mjs`'s `shoot` stubs `field.update` and freezes `performance.now`; it toggles `viewer.perf` flags **at runtime** | `scripts/perf-open.mjs:100-135` |
| `openViewer` mode `game` is Free Drive (hero only); reader 2's `qa/10x-scratch/frame/sections.mjs` runs a real Race (`.bento-tile[data-id=race]`) with 8 cars | `scripts/perf-open.mjs:49-60` |
| `viewer.bench` flies the camera, never refreshes the sun shadow, never runs the tick's JS | `src/main.js:1232-1268` |

Corrections to the designs:
- **Design 2's shader fix.** "Call `useHeroEnvironment` before compiling" is already half there: `warmRace` calls `prepareReflection`, which calls it. The real gap is ordering. The env swap happens *after* the compile, so the fix is to recompile the hero after the swap.
- **Load-time vs runtime flags.** Design 2 assumed `perf-ab.mjs` could A/B every new flag. It can't A/B load-time changes (merges), and it can't see capture changes at all, because `shoot` stubs `field.update`. This spec adds a still harness for those.
- **Merge flags.** `mergeByMaterial` would silently turn on `receiveShadow` for the stand-in wheels. That is a visible change, and the merge must preserve the original flags.

## 1. Measured baselines (from the readers; re-measure in WP0 in one sitting)

| Measure | Value | Source |
|---|---|---|
| Qingshan race tick avg / p95 / max (8 cars, chase, 1600x900, high, day) | 9.03 / 12.1 / 17.2 ms | reader 2, measured |
| `composer.render` CPU qingshan | 5.72 avg; main pass GPU 4.28 vs CPU 5.70 ms (CPU-bound) | reader 2, measured |
| `field.update` qingshan | 0.55 avg, 2.70 p95; 3.18 in the slowest 5% of frames | reader 2, measured |
| Llano frames over 20 ms | 14 / 721 | reader 2, measured |
| Draws per AI car | 35-42 in the mid band **and** beyond 60 m; `proxyMeshes: 20` | reader 2, measured |
| Leak | +504 MB ArrayBuffer per llano→marina→qingshan cycle | reader 3, heap snapshot |
| Programs compiled at first Start | 9; 618 ms in `getProgramInfoLog`; two 360-435 ms tasks | reader 3, measured |
| `PhysicsWorld.create` | 298 ms task; `voidWalls` 317 ms in another profile | reader 3, measured |
| Boot module evaluation | 673 ms task; `GarageRoom` 626 ms of it | reader 3, measured |
| First car fetch | ~1153 ms after navigation (50 Mbit/40 ms) | reader 1, measured |
| Qingshan, 50 Mbit cold | Enter→preload done 16.6 s; venue 45 MB arriving 3.4-15.3 s; LOD1s (7.5 MB) overlap it at 8.5-11.4 s | reader 1, measured |

Noise warning, measured by reader 2: the same bench moved up to 2.5 ms avg and 3.5 ms p95 within one sitting. **No single run proves anything.** Every A/B below is interleaved, and a win counts only when the difference of the per-arm medians exceeds the larger arm's round-to-round spread.

## 2. Ground rules for the build phase

- **Edit scope:** edit only inside `D:/RaceUltimate-wt/perf`. Never touch `src/physics/vehicle.js`, `driver.js`, assists, the step rate, `car-lab/`, `meshy*/`, repo-root `scripts/`, `project-plan.md` or `vehicle-pipeline.md`. The only physics-folder edit allowed is WP5's cache in `src/physics/world.js`, and it must pass the bit-exact hash test.
- **Dev server:** `cd D:/RaceUltimate-wt/perf/track-viewer && npx vite --host 127.0.0.1 --port 5301 --strictPort` (run in the background). If 5301 is already served by this worktree (`netstat -ano | findstr :5301`), reuse it. Never use 5180, which belongs to the main checkout.
- **Browsers:** every browser run goes through `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- <command>`, started from `D:/RaceUltimate-wt/perf/track-viewer`. One browser at a time.
- **Unit and regression suite** (run under the lock, because some of these open a browser):
  `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- npm run test:v2`
  `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- npm run test:loading`
  `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- npm run test:race-loading`
  `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- npm run test:sectors`
  `npm run test:hud`
- **Driving-feel guard, after every commit:**
  - `git diff main --stat -- src/physics src/carkit` shows only `src/physics/world.js` (WP5).
  - `node scripts/physics-harness.mjs --tests pad,brake,accel,top --cars av12,porsche1 --weather dry,damp --assist rookie,pro > qa/10x-scratch/phys-<wp>.txt` is byte-identical to the baseline file captured in WP0. These tests need no server; do not run `lap`, which fetches from :5180.
- **No visible change:** a saving passes the pixel gate only if the A-vs-B mean absolute difference (MAD) is at most max(1.5 × the A-vs-A floor, 0.05), and the share of pixels over 32 is no higher than the floor's. Also look at every diff heatmap: any structure on a car, wheel or prop fails, whatever the number says.

## 3. Work packages, in commit order

### WP0: measurement harness (about 2.5 h; must land first)

New tracked scripts and one small dev hook. These scripts are the gate for everything after.

**a) `scripts/perf-frame.mjs`**: promotion of `qa/10x-scratch/frame/sections.mjs`.
- **Flow:** a real Race with 8 cars, the AI driving the hero (`f.setPlayer(false)`, `params.player=false`), chase camera, `setupLook(day, dry)`, `params.dynamicRes=false`, 1600x900, DPR 1, 8 s settle.
- **CLI:** `node scripts/perf-frame.mjs <track> [--look day] [--frames 720] [--rounds 4] [--ab <flag>] [--ab-load <flag>] [--programs] [--check-matrices] [--url http://127.0.0.1:5301] [--out qa/perf/frame-<track>.json]`
- **Per arm it reports:**
  - tick avg / p95 / p99 / max;
  - `composer.render` avg / p95;
  - `field.update` avg / p95;
  - `field.drive` avg;
  - `scene.updateMatrixWorld` avg;
  - the number of frames over 20 ms;
  - the main-pass draw-call average (`renderer.info.render.calls`);
  - draws per car by band;
  - `renderer.info.programs.length`.
- **`--ab <flag>`** (runtime flags): in one page, alternate blocks of `--frames` with `viewer.perf[flag]=false` and then `true`, `--rounds` times (A B A B …).
- **`--ab-load <flag>`** (load-time flags): each round is a fresh browser context. A loads `/?perf=<flag>` (saving off), B loads `/`. Order A B A B. Each context reuses the same Chrome profile, so shader-cache effects are equal for both arms.
- **`--programs`:** records the program `cacheKey`/`name` set when `game.warmP` resolves, and again after 10 s of racing that includes one nitro (`game` input) and one wall hit (teleport into a wall with `teleport`). It prints the new programs and exits 1 if there are any.
- **Output:** the median of the per-round values and the spread (max−min) per arm.

**b) `scripts/perf-stills.mjs`** + a dev hook `viewer.still({dist, t=10, settle=48})` added to `window.viewer` (`src/main.js:1300`), about 15 lines.
- **What the hook does:**
  - sets `params.paused=true`, `params.mode='flythrough'`, `params.grain=0`, `params.speedBlur=0`, then `applyAll()`;
  - re-grids the field with `field.grid(track)`;
  - zeroes each wheel's `spin` and `pivot` rotation;
  - sets `dist`;
  - then runs `settle` iterations of `placeOnPath(); camera.updateMatrixWorld(); <aim the sun at the camera cell as tick does, main.js:1166-1172, needsUpdate only on iteration 0>; life.update(t, 0, …); updateFx(t, true); scene.updateMatrixWorld(); composer.render();` with a fixed `t`, so the reflection cube and PMREM complete deterministically;
  - finally returns the canvas as PNG data.
- **Script CLI:** `node scripts/perf-stills.mjs <track> --save <dir> [--looks day,night] [--query perf=<flag>] [--toggle <flag>] [--url http://127.0.0.1:5301]`.
  - **Page:** `?dev=1`, which loads the full 8-car grid.
  - **Views:** `grid-near`, `grid-mid` and `grid-far` (camera 12 m, 40 m and 90 m behind the start line, so the parked cars fall into bands 0, 1 and 2), plus `T1` and `canopy` from `views()` in `perf-open.mjs`.
  - **`--toggle`:** in-session A (flag off) and B (on) PNGs per view, plus A-vs-A.
  - **Without `--toggle`:** one PNG per view, for a cross-session `pixel-diff.mjs`.
- **Determinism gate for the harness itself:** two default sessions compared with `node scripts/pixel-diff.mjs <dirA1> <dirA2>` must give a mean of at most 0.05. If they don't, find and freeze the remaining time source before the harness is used to judge anything.

**c) `scripts/perf-boot.mjs`**: promotion of `qa/10x-scratch/throttled.mjs` + `boot-trace.mjs`.
- **What it runs:** a cold context per run, CDP `Network.emulateNetworkConditions` at 50 Mbit/s down, 40 ms RTT, cache disabled for the first navigation. Tracks: marina and qingshan.
- **What it reports:**
  - time of the first `/assets/` request;
  - `ultrack:car-ready` mark;
  - `game.loaded`;
  - Enter→`game.preloadP` settled;
  - `ultrack:venue-ready`;
  - the longest task per phase (title, menu, Start, grid, GO), from longtask and long-animation-frame observers.
- **CLI:** `node scripts/perf-boot.mjs <track> [--throttle 50,40] [--rounds 3] [--ab-load <flag>] [--url http://127.0.0.1:5302]`.
- **Server:** it runs against a production build:
  `npx vite build --outDir qa/10x-scratch/dist && npx vite preview --host 127.0.0.1 --port 5302 --strictPort --outDir qa/10x-scratch/dist`
  Rebuild after each load-path commit, and delete `qa/10x-scratch/dist` (~770 MB) when done.

**d) `scripts/perf-leak.mjs`**
- **Flow:** a `?dev=1` page cycles `viewer.setTrack(id); await viewer.ensureVenue()` over llano→marina→qingshan for `--cycles 3`. After each cycle: CDP `HeapProfiler.collectGarbage` ×2, then `Runtime.getHeapUsage` (usedSize + backingStorageSize) and `renderer.info.memory`.
- **Exit 1** if cycle 3 − cycle 1 exceeds 40 MB.

**e) `scripts/test-collision-hash.mjs`**
- **What it does:** a page-side test in a `?dev=1` page. It imports `/src/physics/world.js` and `/src/tracks.js`, and for every `TRACKS` entry builds `PhysicsWorld.create(trackUrl(t,'collision'), {voidWalls: !!t.voidWalls})` twice.
- **Hash:** SHA-256 over every collider's `shape.type`, `vertices()`, `indices()`, friction and restitution, in handle order, plus the `voidWalls.v/idx` bytes.
- **Results:** written to `qa/perf/collision-hash.json`. The first run (before WP5) is the baseline. The test fails if any later hash differs from the baseline, or if build 1 and build 2 differ.

**Baseline sitting** (record everything in `qa/perf/baseline/`):
```
node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-frame.mjs qingshan --rounds 4 --programs --out qa/perf/baseline/frame-qingshan.json
node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-frame.mjs llano --rounds 4 --out qa/perf/baseline/frame-llano.json
node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-stills.mjs qingshan --save qa/perf/baseline/stills-q1 --looks day,night
node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-stills.mjs qingshan --save qa/perf/baseline/stills-q2 --looks day,night
node scripts/pixel-diff.mjs qa/perf/baseline/stills-q1 qa/perf/baseline/stills-q2        (harness floor, must be <= 0.05)
node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-leak.mjs --cycles 3
node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/test-collision-hash.mjs
node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-boot.mjs qingshan --rounds 3
node scripts/physics-harness.mjs --tests pad,brake,accel,top --cars av12,porsche1 --weather dry,damp --assist rookie,pro > qa/10x-scratch/phys-base.txt
```
**Acceptance:** all scripts run under the lock. The harness floor is ≤ 0.05 MAD. The leak script fails on the baseline (it should: about 500 MB). The collision baseline is written.

### WP1: Marina venue leak (15 min)
- **Change:** `src/main.js` `unloadVenue`. Immediately before `allMats.clear()` (line 567), add `for (const m of allMats) singles.delete(m);`. Car glass is never in `allMats`, so it stays registered for the `singlePass` toggle at line 938. No flag is needed: this is a bug fix.
- **Gain:** measured +504 MB of ArrayBuffer per Marina visit, about 774 Object3D and 784 materials retained per cycle. The target is flat memory.
- **Measure:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-leak.mjs --cycles 3`. Must exit 0, with growth from cycle 1 to cycle 3 under 40 MB. Also run `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-track-switch.mjs http://127.0.0.1:5301`.
- **Visuals:** `perf-ab` on marina with the fence in view, which checks that `singlePass` still applies to the fence on a second visit: `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-ab.mjs marina night,day --off singlePass --url http://127.0.0.1:5301`. Run it after one llano→marina switch, and the A/B must still show the saving active, i.e. the same MAD as on a first visit.
- **Risk:** very low.

### WP2: merge the car stand-in wheels and the far proxy (1.5 h)
- **Change:** `src/cars.js`, load-time flag `mergeWheels`, read as `!/(^|,)(off|mergeWheels)(,|$)/.test(new URLSearchParams(location.search).get('perf') ?? '')`.
  1. After the `low` group is filled (after line 372, before `low.visible = false`), call `mergeByMaterial(low)`. That leaves 2 meshes per wheel (rubber, rim).
  2. After the proxy loop (after line 388, after `car.add(proxy)`), call `mergeByMaterial(proxy)`. That leaves 2 meshes per car.
  3. Preserve the originals' flags. `mergeByMaterial` sets `receiveShadow = true` (line 132), but the stand-in meshes were created with the three.js defaults (`castShadow=false`, `receiveShadow=false`). Add an optional `receive` parameter (`mergeByMaterial(group, castShadow = false, receive = true)`) and pass `false, false` for both calls, so every other caller is unchanged.
  4. `c.simple` keeps pointing at the same `low` groups, and spin still comes from `w.spin`, so the band switch at `cars.js:791-796` works unchanged.
- **Gain:** inferred about 20 → 8 draws per mid-band car and 20 → 2 per far car. With 6-7 AI cars that is about 80-110 fewer draws in the main pass (382 in qingshan's race), plus some in shadow and cube passes. At roughly 15 µs CPU per draw (5.7 ms / 382), the inferred saving is 1.2-1.6 ms of tick.
- **Measure:**
  `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-frame.mjs qingshan --ab-load mergeWheels --rounds 4`, then the same for `llano`.
  - **Pass:** main-pass draws fall by at least 60 on both tracks; B's tick avg median is lower than A's by more than the spread; tick p95 is not worse.
  - **Structural assert** (add it to perf-frame): every car's `simple` groups hold at most 2 meshes each, and `proxy` holds at most 2.
- **Visuals:**
  1. **Geometry equivalence**, a deterministic check run from the stills script with `--dump-wheels`. For every car, dump each `simple` group's and `proxy`'s triangles in car-local space (rounded to 1e-5), grouped by material name, plus each mesh's castShadow, receiveShadow, renderOrder, frustumCulled and visible. Do it in a session with `--query perf=mergeWheels` and in a default session. The multisets per material and the flag sets must be equal.
  2. **Pixels:**
     `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-stills.mjs qingshan --save qa/perf/wp2/A --query perf=mergeWheels --looks day,night`
     `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-stills.mjs qingshan --save qa/perf/wp2/B --looks day,night`
     `node scripts/pixel-diff.mjs qa/perf/wp2/A qa/perf/wp2/B --save qa/perf/wp2/diff`
     It must be within the harness floor, with no structure on the `grid-mid` or `grid-far` cars.
- **Risk:** low.
  - Draw order inside one material can change; the parts don't overlap, so this is inferred harmless, and the pixel check covers it.
  - If some later traversal (paint, livery, lamps) looks stand-in meshes up by name or by count, it would miss them. Grep `wheel-lod`, `wheels-far` and `simple` before committing.

### WP3: at most one heavy GPU job per frame (1.5 h)
- **Change:** runtime flag `oneHeavy`, added to `PERF` (`main.js:121`) so `viewer.perf.oneHeavy` toggles it.
  - **`src/main.js` tick:** after the sun-cell block (line 1172), set `if (field) field.deferCapture = PERF.oneHeavy && sun.shadow.needsUpdate;`.
  - **`src/cars.js` `Field.update` (lines 808-839):**
    - **Deferral:** when `this.deferCapture` is true, do not increment `this.tick` and do not capture. The slot moves to the next frame instead of being lost.
    - **PMREM split:** when `this.oneHeavy` is set (passed like `stableCapture`), the face-6 frame no longer runs PMREM. It sets `this.pmremDue = true`, and the next frame with `!deferCapture` runs `fromCubemap` + `useHeroEnvironment` and clears the flag. That frame is never a capture frame, because `captureEvery` is ≥ 2 on every tier that captures.
  - **Flag off:** with the flag off, the code path is exactly today's.
- **Gain:** measured in qingshan's slowest 5% of frames: `field.update` 3.18 ms against 0.55 avg, with the sun shadow over 0.3 ms in 12 of 37 frames and PMREM in 5 of 37. The inferred target is `field.update` p95 2.70 → ≤ 1.5 ms and tick p95 −1 to −2 ms. The average is unchanged.
- **Measure:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-frame.mjs qingshan --ab oneHeavy --rounds 6`, then `llano`. `viewer.bench` cannot see this change (it never refreshes the shadow).
  - **Pass:** the `field.update` p95 median improves by more than the spread; llano frames over 20 ms fall; tick avg is not worse.
- **Visuals:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-stills.mjs qingshan --save qa/perf/wp3 --toggle oneHeavy --looks day,night`. After 48 settle frames both arms hold a complete cube and PMREM from the same position, so the MAD must sit at the floor. The only real difference is that reflections refresh 1-4 frames later; that is temporal, at 128 px per face.
- **Risk:** low. Check that `prepareReflection` (cars.js:477) still runs PMREM synchronously, because it is outside `update`.

### WP4: no shader compiles at Start (1.5 h, measure-then-fix)
- **Step 1, measure:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-frame.mjs qingshan --programs` lists the program names and keys created after `warmP` resolved. Reader 3 expects about 9.
- **Step 2, change:** `src/main.js` `warmRace`. After `await field.prepareReflection(...)` (line 816), add a second `compileVisible(renderer, scene, camera, {extra:[field.hero.root], around:raceState, isCancelled:stop, depth:SHADOW_PASSES, inflight:warmInflight})` with the composer read buffer as target, as at line 808. Its envMap'd materials then compile during the menu; cached programs are skipped.
  - If the listing shows the `SmokePass` particle material, compile it with its real particle mesh, not the full-screen quad (`compilePost`, line 787, uses `_fsQuad` geometry, whose attributes are part of the program key).
  - Then add the same recompile at the end of `prepareRaceRenderer` (line 752), which matters when Start lands before warmRace has finished.
  - No flag: this is cache-filling only.
- **Gain:** reader 3 measured 618 ms of link waits and two 360-435 ms tasks on the first Start. Target: zero programs created after `warmP`, and no Start task over 200 ms that comes from compiling.
- **Measure:** `--programs` must exit 0 on qingshan, llano and marina, day and night. `perf-boot.mjs qingshan --rounds 3` must show the Start-phase longest task falling (ABAB is not possible without a flag; compare with the baseline sitting, and run both in one session if you can).
- **Visuals:** none can change, since the same programs are built earlier. Confirm with `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-stills.mjs qingshan --save qa/perf/wp4 --looks day` against the baseline stills (`pixel-diff.mjs`).
- **Risk:** low. The menu warm-up gets slightly longer, still capped at 3 compiles in flight.

### WP5: collision world: promise cache + memoised void walls (1 h)
- **Change:** `src/physics/world.js` only.
  - Line 101 becomes `const gltf = await (PhysicsWorld.cache[url] ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url));`, with `.catch` deleting the entry on failure.
  - At line 134, memoise the `voidWalls(...)` result per `url` in a static `PhysicsWorld.walls` map. Its inputs are the static collision mesh and the world built from it, so the output is identical.
  - The typed arrays are passed to `ColliderDesc.trimesh` exactly as now; Rapier copies them.
- **Gain:** reader 3 measured a 295-299 ms task 1.5 s after every quit (`game.js:355`) and 250-292 ms in each re-preload; `voidWalls` alone was 317 ms. This removes most of that on every rebuild after a track's first. The first build per track is unchanged. The concurrent-load fix also lets WP8 start the collision download early.
- **Measure:** add a phase "quit+3 s" to perf-boot or perf-frame (Race → `game.endSession` via the pause menu → wait 3 s). The longest task in that window must drop by at least 150 ms against the baseline, over 3 rounds.
- **Proof of no physics change:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/test-collision-hash.mjs` must match the baseline hashes on every track, for build 1 and build 2. The `physics-harness` output must be byte-identical to `phys-base.txt`.
- **Risk:** very low, since the hash proves it.

### WP6: GarageRoom environment off the boot path (45 min)
- **Change:** `src/garage-room.js`, load-time flag `lazyRoomEnv`.
  - Move lines 17-19 (`PMREMGenerator`, `fromScene(room, .04)`, dispose) into `ensureEnvironment()`, called at the top of `compile()` and of the render method. It runs once.
  - The env texture and arguments are the same, so the pixels are too.
  - `src/main.js:514` stays as it is. The environment is now built at `main.js:1332` (`garageRoom.compile`), after `load()` has started the car, track and transcoder fetches.
  - Also expose `garageRoom` on `window.viewer` for the still below.
- **Gain:** reader 3 measured 626 ms inside the 673 ms module-evaluation task, which runs before any asset fetch. Inferred: the first `/assets/` request starts about 0.5-0.6 s earlier, and title-ready improves by up to that much on a real network. Total CPU is unchanged.
- **Measure:** rebuild, then `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-boot.mjs marina --ab-load lazyRoomEnv --rounds 3`, and the same for qingshan.
  - **Pass:** the first-asset-request time and `game.loaded` medians both improve by more than the spread, and the longest boot task falls below 200 ms.
- **Visuals:** a title still in two sessions (A `?perf=lazyRoomEnv`, B default). Set `viewer.garageRoom.controls.autoRotate=false` and a fixed camera position, render, compare with `pixel-diff.mjs`. It must be at the floor.
- **Risk:** low. If the first showroom frame now pays the PMREM, move the call into `compile()` only, which already runs before the title is shown.

### WP7: LOD1 cars wait for the venue (45 min)
- **Change:** `src/cars.js:430`, load-time flag `farAfterVenue`.
  - The LOD1 timer becomes `Promise.all([sleep(1800), this.farGate])`.
  - `Field.farGate` defaults to `Promise.resolve()`. `src/main.js` sets it, at `ensureVenue`, to the venue-ready promise, with `.catch(() => {})` so a failed venue never blocks LOD1. It is reset per track in `setTrack`.
  - Until LOD1 arrives, three's LOD shows LOD0 at every distance (same look, more triangles).
- **Gain:** reader 1 measured that the 7.5 MB of LOD1s competed with the venue at 8.5-11.4 s. Inferred: about 1.2 s less Enter→preload-done for Qingshan at 50 Mbit (7.5 MB / 50 Mbit).
- **Measure:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-boot.mjs qingshan --ab-load farAfterVenue --rounds 3` (production build).
  - **Pass:** `venue-ready` and preload-done improve by more than the spread.
  - Also check the race tick in the first 10 s after GO (perf-frame on qingshan), which must not regress beyond the spread, in case LOD1 arrives late.
- **Visuals:** once loaded, nothing changes. Run `perf-stills qingshan` (default) against the baseline with `pixel-diff.mjs`.
- **Risk:** low.

### WP8: venue and collision bytes start at attach (1.5 h)
- **Change:** load-time flag `earlyBytes`.
  - **`src/game/game.js` `preloadRace`:** before the 800 ms timer, call `this.ctx.prefetchVenue?.()` and `PhysicsWorld.preload(this.ctx.collisionUrl)`. The latter just runs the WP5 promise-cache line. The CPU-heavy steps (`prepareWorld`, car assembly, venue parse, warm-up) keep their idle gate.
  - **`src/main.js`:**
    - `prefetchVenue()` stores `venueBytes = {url: U('visual'), p: fetch(url).then(r => { if (!r.ok) throw Error(r.status); return r.arrayBuffer(); })}`.
    - `loadVenue` (line 587) uses `gltfLoader.parseAsync(await venueBytes.p, THREE.LoaderUtils.extractUrlBase(url))` when the URL matches, and falls back to `loadAsync` on a mismatch or error.
    - `unloadVenue` and the end of parse set `venueBytes = null`, so a 45 MB buffer is never held across a track switch. The perf-leak check must still pass.
  - The `?venue=` dev profile URL keeps `loadAsync`.
- **Gain:** reader 1 measured about 0.9 s of idle before the first preload fetch locally. On a real link the venue download (5.5 s Marina to 12 s Qingshan at 50 Mbit) starts 0.8-2.8 s sooner. The inferred saving on Enter→drive is 0.8-2.0 s when the player lingers less than the download time.
- **Measure:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-boot.mjs qingshan --ab-load earlyBytes --rounds 3`, then the same for marina.
  - **Pass:** venue-ready and preload-done improve by more than the spread, and the title-phase longest task does not grow (the download is network only).
  - Re-run `perf-leak.mjs`.
- **Visuals:** the same bytes produce the same scene. Run `perf-stills qingshan` (default) against the baseline.
- **Risk:** low to medium.
  - A double download if the URLs differ; assert one request per venue GLB in perf-boot's request log.
  - The extra buffer is held for the parse duration.

### WP9 (conditional): car LOD0 fetch ahead of the decode queue (1 h)
- **Change:** `src/cars.js`, load-time flag `carPrefetch`.
  - Module map `bytes(url)` → `fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))`.
  - In `Field.ensure`, start `bytes()` for the car's LOD0 URL, using the same variant/fallback choice as `loadBodyLevel` (`cars.js:262-264`), before `this.queue.run`.
  - In `loadBodyLevel`, LOD0 uses `loader.parseAsync(await bytes(u), '/assets/cars/'+key+'/')` and keeps the `.catch` fallback to the plain file. Delete the map entry after the parse.
  - Decode concurrency stays at 2.
- **Gain:** inferred only. LOD0s arrive in pairs today (measured), but while the venue saturates the link the gain may be small. **Keep it only if** `perf-boot qingshan --ab-load carPrefetch --rounds 3` shows at least 300 ms on preload-done; otherwise drop the commit.
- **Visuals:** run `perf-stills` (default) against the baseline.
- **Risk:** low.

### WP10 (conditional, last): freeze static venue matrices (1.5 h)
- **Change:** runtime flag `freezeVenue`, applied in `applyAll`.
  - After venue-ready, set `matrixAutoUpdate=false` on every node under `venueRoot` that is not registered live, and call `venueRoot.updateMatrixWorld(true)` once. Turning the flag off restores `true`.
  - **Live registration:** grep `src/venue/*`, `life.js`, `people.js`, `scenery-yachts.js`, `scenery-buildings.js`, `driver-hoardings.js`, `sponsors.js`, `trails.js` and `wet-*.js` for writes to `.position`, `.rotation`, `.quaternion`, `.scale` or `.matrix` of venue nodes (for example qingshan's rotor pivots). Each such module marks its nodes with `node.userData.live = true` on the node and its ancestors up to `venueRoot`.
- **Gain:** measured `scene.updateMatrixWorld` 0.46 ms per frame on qingshan; the inferred saving is 0.2-0.35 ms.
- **Measure:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-frame.mjs qingshan --ab freezeVenue --rounds 6`. Keep it only if the `scene.updateMatrixWorld` median improves by at least 0.2 ms.
- **Proof:**
  - **`--check-matrices`:** each frame, after the frozen update, record every venue node's `matrixWorld`; temporarily set all to auto, `updateMatrixWorld(true)`, compare at 1e-6, then restore. Any mismatch fails and names the node.
  - Run it for 600 race frames per track on all nine tracks, day and night (`for t in marina india tokyo qingshan llano venice infinia shajawa drylake`).
  - Pixels: `perf-stills <track> --toggle freezeVenue` on qingshan and marina.
- **Risk:** medium (a frozen prop). This is why it comes last, is optional and is fully tested.

## 4. Targets for the night (pass/fail, on this desktop, same sitting as the baseline)

| Measure | Baseline (measured) | Target |
|---|---|---|
| Qingshan race tick avg / p95 (perf-frame median) | 9.03 / 12.1 ms | ≤ 7.8 / ≤ 10.5 ms (inferred from WP2 + WP3) |
| Qingshan `field.update` p95 | 2.70 ms | ≤ 1.5 ms |
| Main-pass draws, qingshan race | 382 | ≤ 300 |
| Llano frames over 20 ms of 721 | 14 | ≤ 5 |
| Programs created after warmP | 9 | 0 |
| Leak, 3 cycles | +504 MB per cycle | < 40 MB total |
| Longest task 3 s after quit | ~297 ms | ≤ 150 ms |
| Qingshan 50 Mbit Enter→preload done | 16.6 s | ≤ 14 s (WP7 + WP8) |
| First /assets/ request after navigation (50 Mbit) | ~1153 ms | ≤ 700 ms (WP6) |
| `viewer.bench` qingshan p95 | 10.3-14.2 ms (noisy) | report only: the bench sees few cars and no shadow refresh, so it is not a gate |

## 5. Rejected for tonight (changes look or feel, or is unproven)
- **CPU governor** (Design 2 #5: `captureEvery`, DETAIL_M and SHADOW_M stepping under load). It visibly changes car detail and shadows mid-race.
- **Hiding far AI cars from the capture, or a shorter cube far plane** (Design 2 #3). Both change what the paint reflects.
- **Tier changes** (Design 3 §4: medium 1024 shadow map, car-LOD multipliers, auto step-down). Visible quality loss on Medium.
- **Lowering tiers, render scale, pixel-ratio caps, MSAA, shadow resolution or cell size.** All visible.
- **Merging LOD1 bodies by material.** Per-mesh livery/paint traversal risk; a follow-up after a grep of `paintCar`/`livery.js`.
- **`checkShaderErrors=false`.** Reader 1's ABAB measured no gain.
- **Physics temporaries and GC work** (`vehicle.js:118`, Rapier wrappers). Max GC pause is 3.4 ms, and the code is driving feel.
- **Chunking `voidWalls`.** The memo (WP5) removes the repeat cost with zero algorithmic change; the first build stays.
- **Lazy lil-gui and career code.** Estimated 30-60 ms of parse, not measured, against a broad edit of top-level GUI code (`main.js:992` onward).
- **HDR decode in a worker.** Reader 1's profile puts the decode at 82 ms; the 450-665 ms tasks are not split between parse and PMREM. Measure first.
- **WebGL context-loss recovery, audio-cache LRU, fetch retry UI.** Robustness work, not measured as a problem tonight.
- **Freeing CPU copies of venue geometry** (~590 MB inferred). It would break raycasts and context restore.
- **Qingshan tree-LOD and card retuning in Blender.** It needs an asset rebuild, a re-upload and the user's eye.

## 6. Proposals for the user (they need their Cloudflare/Vercel accounts; not done tonight)
1. Serve `/assets/` from an R2 custom domain. This removes the per-asset 307 with `max-age=0` (`scripts/deploy-build.mjs:24-27`), so cached repeat visits work.
2. At upload (`scripts/deploy-upload-assets.mjs`), set `Content-Encoding: gzip` where it saves at least 10%, plus `Cache-Control: public, max-age=31536000, immutable` on revisioned URLs. Estimated savings: track.json about −80%, collision −57-81%, HDR −39%, venue GLBs −11-16%. Verify on one file first, because a wrong content-encoding breaks every asset at once.
3. Add `<link rel=preconnect>` to the asset host, and preload the basis transcoder from `index.html`.
4. Trace the `GL_INVALID_OPERATION: Mismatch between texture format and sampler type` errors seen at every race start (reader 3). It is a correctness bug, not a perf one.

## 7. Run order and checkpoints
- **Order:** WP0 → WP1 → WP2 → WP3 → WP4 → WP5 → WP6 → WP7 → WP8 → (WP9) → (WP10).
- **After each WP:**
  1. Its own A/B command, with the medians and spreads written into the commit body.
  2. Its pixel or hash proof.
  3. The regression suite in §2 and the physics-harness diff.
  4. `git diff main --stat` checked against the WP's file list.
  5. One commit: subject `perf: <what>`, body = measured before/after medians plus the A/B command used.
- **If a WP fails its gate:** revert it and move on; do not stack fixes on a failed change.
- **Recording:** record every number as measured or inferred, and name the sitting it came from.

## Work packages

### WP0 Measurement harness: race frame sections, deterministic stills, throttled boot, leak cycle, collision hash

**Outcome:** Six tracked tools give interleaved A/B numbers, deterministic still images and bit-exact collision hashes. A baseline sitting is recorded in qa/perf/baseline.

**Files:** scripts/perf-frame.mjs (new, from qa/10x-scratch/frame/sections.mjs), scripts/perf-stills.mjs (new), scripts/perf-boot.mjs (new, from qa/10x-scratch/throttled.mjs + boot-trace.mjs), scripts/perf-leak.mjs (new), scripts/test-collision-hash.mjs (new), src/main.js (viewer.still dev hook in window.viewer, about 15 lines)

**Acceptance:** All scripts run under qa-lock against 127.0.0.1:5301 (boot runs against vite preview on :5302). Two default perf-stills sessions differ by at most 0.05 mean absolute difference (pixel-diff.mjs). perf-leak exits 1 on the baseline. collision-hash.json is written. physics-harness baseline is saved to qa/10x-scratch/phys-base.txt.

### WP1 Fix the Marina venue leak (singles Set)

**Outcome:** Leaving Marina no longer keeps about 504 MB of the old venue alive.

**Files:** src/main.js (unloadVenue: `for (const m of allMats) singles.delete(m);` before allMats.clear() at line 567)

**Acceptance:** `node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-leak.mjs --cycles 3` exits 0, with growth from cycle 1 to cycle 3 under 40 MB. qa-track-switch.mjs passes. perf-ab marina with --off singlePass shows the saving still active on a second visit.

### WP2 Merge car stand-in wheels and the far wheel proxy by material

**Outcome:** Mid-band AI cars draw about 8 wheel meshes instead of 20, and far cars 2 instead of 20, with identical geometry, materials and shadow flags.

**Files:** src/cars.js (mergeByMaterial gains a receive param, default true; call it on each wheel-lod group after line 372 and on proxy after line 388 with castShadow=false, receive=false; load-time flag mergeWheels via ?perf=); scripts/perf-frame.mjs (structural assert)

**Acceptance:** perf-frame qingshan and llano --ab-load mergeWheels --rounds 4: main-pass draws at least 60 lower, tick avg median lower by more than the spread, p95 not worse. The --dump-wheels triangle multisets and flag sets are equal across sessions. pixel-diff of perf-stills A (?perf=mergeWheels) against B is within the harness floor, with no structure on grid-mid or grid-far cars.

### WP3 At most one heavy GPU job per frame (shadow refresh vs cube face vs PMREM)

**Outcome:** A cube-face capture never lands in a frame that refreshes the sun shadow, and PMREM runs in its own frame, so the p95 spikes shrink.

**Files:** src/main.js (PERF.oneHeavy; set field.deferCapture after the sun-cell block, line ~1172), src/cars.js (Field.update lines 808-839: no tick increment while deferred; pmremDue moves PMREM + useHeroEnvironment to the next non-deferred frame)

**Acceptance:** perf-frame qingshan and llano --ab oneHeavy --rounds 6: field.update p95 median improves by more than the spread, tick avg not worse, llano frames over 20 ms fall. perf-stills --toggle oneHeavy (day, night) gives mean absolute difference at the floor.

### WP4 No shader programs compiled at Start

**Outcome:** The hero's envMap variants (and SmokePass, if listed) compile during the menu warm-up, which removes the ~600 ms of link waits and two ~400 ms tasks at the first Start.

**Files:** src/main.js (warmRace: a second compileVisible over field.hero.root after prepareReflection at line 816; the same at the end of prepareRaceRenderer; compile SmokePass with its real particle mesh if the listing shows it)

**Acceptance:** perf-frame --programs exits 0 (no programs created after warmP) on qingshan, llano and marina, day and night. perf-boot shows the Start-phase longest compile task under 200 ms. perf-stills against the baseline is within the floor.

### WP5 Collision world: promise cache and memoised void walls

**Outcome:** Rebuilding a track's collision world after quit or on a re-preload no longer costs the ~300 ms voidWalls task, and concurrent loads share one GLB parse.

**Files:** src/physics/world.js (line 101: cache the promise, delete on failure; line 134: memoise the voidWalls result per url in PhysicsWorld.walls)

**Acceptance:** test-collision-hash.mjs matches the baseline hashes for every track, on build 1 and build 2. physics-harness output is byte-identical to phys-base.txt. The longest task in the 3 s after quit drops by at least 150 ms over 3 rounds.

### WP6 GarageRoom environment off the module-evaluation path

**Outcome:** Asset fetches start about 0.5-0.6 s earlier on boot, with the same showroom environment.

**Files:** src/garage-room.js (move PMREM fromScene from the constructor into ensureEnvironment(), called from compile() and render(); load-time flag lazyRoomEnv), src/main.js (expose garageRoom on window.viewer)

**Acceptance:** perf-boot marina and qingshan --ab-load lazyRoomEnv --rounds 3 against the vite preview build: first /assets/ request and game.loaded medians improve by more than the spread; longest boot task under 200 ms. The title still with autoRotate off is within the floor across sessions.

### WP7 LOD1 car bodies wait for the venue download

**Outcome:** The 7.5 MB of distant car bodies stop competing with the race-critical venue download.

**Files:** src/cars.js (line 430: LOD1 waits for Promise.all([1.8 s, this.farGate])), src/main.js (set field.farGate to the venue-ready promise in ensureVenue, catch errors, reset per track)

**Acceptance:** perf-boot qingshan --ab-load farAfterVenue --rounds 3: venue-ready and preload-done medians improve by more than the spread. Race tick in the first 10 s is not worse beyond the spread. perf-stills against the baseline is within the floor.

### WP8 Venue and collision bytes start downloading at attach

**Outcome:** The venue and collision GLB downloads start at the title instead of after 800 ms plus idle; parsing stays idle-gated.

**Files:** src/game/game.js (preloadRace: ctx.prefetchVenue() and PhysicsWorld.preload(collisionUrl) before the timer), src/main.js (prefetchVenue + venueBytes consumed by loadVenue via parseAsync, cleared in unloadVenue and after parse), src/physics/world.js (static preload(url) reusing the WP5 cache line); load-time flag earlyBytes

**Acceptance:** perf-boot qingshan and marina --ab-load earlyBytes --rounds 3: venue-ready and preload-done improve by more than the spread; title longest task not larger; exactly one request per venue GLB in the request log. perf-leak still exits 0. perf-stills against the baseline is within the floor.

### WP9 (Conditional) car LOD0 fetch ahead of the decode queue

**Outcome:** The grid's car GLBs download in parallel while decode stays at 2 at a time. Kept only if the measured gain is at least 300 ms.

**Files:** src/cars.js (bytes(url) map started in Field.ensure before queue.run; loadBodyLevel parses prefetched bytes with the existing fallback; load-time flag carPrefetch)

**Acceptance:** perf-boot qingshan --ab-load carPrefetch --rounds 3 shows at least 300 ms on preload-done, otherwise the commit is dropped. perf-stills against the baseline is within the floor.

### WP10 (Conditional, last) freeze static venue matrices

**Outcome:** scene.updateMatrixWorld stops recomposing about a thousand static venue nodes every frame, with animated nodes explicitly kept live.

**Files:** src/main.js (PERF.freezeVenue applied in applyAll after venue-ready), the venue/animation modules that move venue nodes mark them userData.live (src/venue/*, life.js, people.js, scenery-*.js, as found by grep), scripts/perf-frame.mjs (--check-matrices)

**Acceptance:** perf-frame --check-matrices passes for 600 race frames on all nine tracks, day and night, with zero mismatches. perf-frame qingshan --ab freezeVenue --rounds 6 improves the scene.updateMatrixWorld median by at least 0.2 ms, otherwise drop it. perf-stills --toggle freezeVenue on qingshan and marina is at the floor.

## Biggest risk

Measurement and visual-proof validity. Same-sitting noise is up to 2.5 ms avg and 3.5 ms p95, and two of the core changes (the wheel merge, the venue freeze) are load-time or structural, so the existing in-session perf-ab cannot check them. If the new still harness is not truly deterministic across sessions (wheel spin, car pose, clock-driven lamps), a real visual change could pass, or a real win could be rejected. The concrete code trap is that mergeByMaterial sets receiveShadow=true on everything it merges (src/cars.js:132): merged stand-in wheels would start receiving shadows unless the flags are preserved. That is why WP0's A-vs-A floor of 0.05 or less, plus the car-local triangle and flag dump, must pass before WP2 is judged. I did not run any measurement myself; every gain in the spec is the readers' measurement or my inference from it.

## How the designs scored

The three designs, scored 1-10 on player impact / feasibility tonight / risk to existing behaviour (higher = safer) / fit with the user's constraints:

**Design 1 (load time first): 7 / 4 / 5 / 4, about 5.**
- Its biggest win, compression and cache headers plus removing the 307, needs a full R2 re-upload, a Vercel deploy, the cf CLI and credentials. The user ruled those out tonight.
- If the content-encoding metadata is wrong, every live asset breaks at once.
- It correctly caught that the preload starts at attach, not Enter (game.js:65).
- Grafted from it: GarageRoom off module evaluation (garage-room.js:17-19 runs at main.js:514, before any fetch), LOD1 after the venue (cars.js:430), early venue/collision bytes, car fetch ahead of decode (kept only if measured), and the collision-cache promise fix. Its CDN items became proposals for the user.

**Design 2 (frame time first): 8 / 8 / 6 / 6, about 7. The winner and the base.**
- It targets the measured bottleneck: the game is CPU-bound on draw submission (main pass 5.7 ms CPU vs 4.3 ms GPU).
- The draw bug is real. I verified it at cars.js:363-388: 5 meshes per stand-in wheel, and a far proxy of 20 meshes despite the comment.
- Taken as the base: the wheel/proxy merges, one heavy job per frame, and the hero-env warm-up.
- I corrected two things:
  - mergeByMaterial hard-codes receiveShadow=true (cars.js:132), which would visibly change the stand-ins, so the merge must preserve the original flags;
  - warmRace already swaps the env, but only after compiling (main.js:808-816, cars.js:505), so the fix is a recompile after the swap.
- Rejected from it: the CPU governor, hiding far cars from the capture and the shorter far plane, because all three change what the player sees.
- Kept, but made optional and last: the venue matrix freeze, behind a matrix-compare test.

**Design 3 (robustness first): 7 / 5 / 6 / 7, about 6.**
- Its gate-before-change principle is the best idea of the three, so it became WP0. Also taken: the program-count assertion (WP4), the leak cycle check (WP1) and the world.js:101 promise cache (WP5).
- Rejected from it, as visible changes or as more than one night allows: tier shadow-map and LOD changes with auto step-down, context-loss recovery, the audio LRU, and voidWalls chunking (the memo in WP5 is simpler and bit-exact).

**A gap all three missed.** perf-ab's shoot stubs field.update (perf-open.mjs:103) and runs in Free Drive with the hero only, so it cannot judge capture changes or AI-car merges. The spec adds a deterministic still harness and a car-local triangle-equivalence dump for those.
