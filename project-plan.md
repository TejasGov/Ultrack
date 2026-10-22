# RaceUltimate implementation plan

## Starting point

The workspace currently contains `endurance-rebuild-report.md` and no application source. This plan uses that report as a reference for the intended experience, not as a verified specification of the reference game's internals.

Build an original browser racing game: responsive assisted handling, a complete circuit, timed laps, a ghost, wet-weather visuals, and convincing sound. Write our own implementation and use assets with recorded sources and permissions.

## Visual direction — reference screenshots are the target

The user's two screenshots establish the intended quality: a detailed GT race car, recognizable circuit architecture, wet textured asphalt, warm low-angle lighting against a cool sky, reflections, rain/spray, and cinematic camera presentation. Stylized low-poly asset packs do not satisfy this direction.

- Source one detailed GT-quality car with a strong silhouette, modeled aero/body details, usable PBR materials, and wheels that can be animated independently. No final model has been selected yet.
- Inspect the actual mesh, materials, wheel separation/pivots, usage terms, and browser cost before adopting it. Use a prepared existing model as the primary route; generated assets are candidates only after the same inspection.
- Source or assemble a convincing circuit, including pit buildings, grandstands, fences, barriers, kerbs, and road markings. A generic road loop alone does not establish the target look.
- Build a representative start/finish scene early: the selected car, track surroundings, wet road, sunset lighting, shadows, reflections, and the intended camera framing.
- Compare that scene directly with the supplied references. A running game with a visibly different art style does not pass visual acceptance.
- Debug geometry remains useful internally, but does not count as a visual milestone. Defer secondary gameplay features before reducing the core visual ambition.
- The three-day schedule is a build target, not evidence that reference-level visual quality has been achieved. Asset readiness and the first rendered scene determine whether that target remains credible.

**Planning assumption:** an AI-assisted build with rapid implementation and human playtesting, informed by the previous full flying game built in three days. Target **three focused days for the desktop MVP**, approximately **20–30 hours of active build/test time**. This is a working target, not a guarantee; asset availability, handling feedback, and browser problems can extend it. Content expansion and multiplayer follow separately.

## MVP scope

**Current checkpoint:** The user accepts the broad silhouettes but rejects the current rendered quality. Surface comparison now shows that geometry quality as well as materials is blocking approval. `car-lab/` now has a default Clean materials treatment that replaces generated cosmetic maps with engine paint and neutral trim/wheel/glass materials, plus refined draft body selections. Validate and refine exact glass, lamp, tire and trim masks before the next batch. Gloss still exposes uneven surface shading. This is a rendering prototype, not the driving game. See `car-lab/README.md` and `meshy/README.md` for the material workflow and limitations.

- One fictional car and one complete circuit.
- Free drive and time trial, with ordered checkpoints, sectors, invalid-lap detection, and personal bests.
- Keyboard and gamepad controls, chase camera, pause, reset, and control settings.
- A local best-lap ghost and local progress/settings persistence.
- One dry and one wet preset, scalable rendering, engine/tire/weather audio.
- A clear loading flow, HUD, settings, credits, and a hosted browser build.

Defer multiple cars, a full garage, challenge progression, drift scoring, nitro, launch minigames, online leaderboards, multiplayer, walking, and novelty modes. Touch controls follow the desktop MVP unless phone support becomes a launch requirement.

## Proposed technical direction

- Vite and TypeScript for the application and tooling.
- Three.js for rendering; evaluate WebGPU/TSL and the WebGL2 path in Phase 0 before committing effects to either backend.
- Rapier for rigid bodies, collision, and raycasts; a separate vehicle controller for suspension, tires, drivetrain, and assists.
- A fixed physics timestep with render interpolation. Start by evaluating 120 Hz; retain a lower rate if the target device cannot sustain the simulation budget.
- DOM/CSS menus and HUD. Keep UI independent of simulation state changes.
- Node-based asset processing and versioned track/car configuration files.
- Local saves initially. Select hosting during the foundation phase; backend infrastructure is unnecessary for the MVP.

## Phase 0 — Prove the visual direction and technical foundation

**Target: 2–4 hours, Day 1; reassess if suitable assets are unavailable**

1. Agree on handling style: accessible circuit racing with optional assists.
2. Record target browsers and actual reference devices. Establish provisional goals: 60 fps on the selected desktop/laptop and a usable lower-quality fallback.
3. Create the TypeScript project, build scripts, and basic source structure for simulation, rendering, input, tracks, audio, UI, and storage.
4. Build a scene with a ground plane, dynamic body, chase camera, pause, resize, and a debug overlay.
5. Implement the fixed-step accumulator, interpolation, bounded catch-up, and tab-resume behavior.
6. Run a rendering compatibility spike, including a basic material/effect on the intended fallback backend.
7. Inspect a detailed car candidate and build a representative track scene with wet asphalt, low-angle lighting, shadows, reflections, and the intended camera. Establish visual quality before expanding gameplay.

**Deliverable:** a deployed technical prototype, a representative visual scene, and a written browser/device matrix.

**Gate:** the build loads on the target browsers, physics speed stays consistent across render rates, pause/resume causes no simulation jump, and the backend strategy is proven. The representative scene must also demonstrate the intended realistic art direction; a stylized placeholder scene does not pass.

## Phase 1 — Make driving enjoyable on a test surface

**Target: 4–6 hours, Day 1**

1. Build a flat handling area with a skidpad, braking markers, ramps, and barriers.
2. Add chassis mass/inertia, four suspension raycasts, spring/damper forces, and wheel visuals.
3. Start with a simple tire model, then add combined grip, load response, wheel slip, and drivetrain behavior as needed. Adopt Pacejka only if the simpler model cannot achieve the intended feel.
4. Add throttle, braking, reverse, steering, automatic gears, and recover/reset behavior.
5. Add speed-sensitive steering and configurable traction/stability assists.
6. Support keyboard and gamepad with deadzones and smoothing appropriate to each.
7. Expose tuning values and telemetry: wheel contact, suspension travel, slip, speed, RPM, and force vectors.

**Deliverable:** a repeatable handling sandbox with saved car configuration.

**Gate:** players can accelerate, brake, corner, recover from a slide, and complete repeatable maneuvers. Handling remains stable across supported frame rates and after collisions. Obtain a short driving playtest before advancing.

## Phase 2 — Turn a circuit into usable game data

**Target: 3–5 hours, Day 1 into Day 2**

1. Start with a simple original circuit; select a release track only after checking its source and usage terms.
2. Define a track format: units, axes, spawn transforms, centerline, widths, checkpoint gates, sectors, surface types, and reset locations.
3. Separate visual meshes from collision meshes and map collision surfaces to grip/drag behavior.
4. Create a centerline authoring workflow; a manually placed spline is sufficient for one track.
5. Implement track progress, nearest valid recovery position, and out-of-bounds detection.
6. Add asset validation and compression. Defer heightfield and rain-occlusion bakes until the effects actually require them.

**Deliverable:** a complete driveable circuit and a repeatable import/validation process.

**Gate:** the car completes a full lap without collision holes or invisible barriers; surface handling changes correctly; reset places the car safely in the correct direction.

## Phase 3 — Build the time-trial game loop

**Target: 3–4 hours, Day 2**

1. Add session states: loading, ready, driving, paused, and results.
2. Implement start/finish crossing, ordered checkpoints, sectors, wrong-way feedback, and explicit lap-validity rules.
3. Add speed, gear, RPM, current/best lap, sector deltas, and a basic minimap to the HUD.
4. Record a local best-lap ghost with timestamps, interpolated playback, and track/car/configuration version metadata.
5. Save settings and best times with versioning and recovery from missing/corrupt data. Store larger replay data in IndexedDB if needed.

**Deliverable:** a complete time-trial session from loading through results and retry.

**Gate:** reversing over the finish, skipping checkpoints, resetting, or pausing cannot produce a valid shortcut time. A saved ghost replays correctly on the matching configuration and survives a reload.

## Phase 4 — Establish the visual identity and weather

**Target: 3–4 hours, Day 2 into Day 3, building on the Phase 0 visual scene**

1. Integrate the release car and track assets, checking wheel pivots, dimensions, materials, and collision alignment.
2. Establish a readable dry daytime scene before adding wet effects.
3. Add wet surface shading, puddle variation, rain, spray, and reflections in that order.
4. Add modest post-processing and camera effects with controls for motion blur and camera shake.
5. Create dry/wet presets driven by shared weather settings, so visual wetness and tire grip agree.
6. Add low/medium/high presets and measure every expensive effect. Validate backend support individually; provide simpler alternatives where required.

**Deliverable:** a coherent original look in dry and wet conditions.

**Gate:** the road, corners, braking references, and HUD remain readable. Both presets work on the supported browser paths, and the selected desktop device meets the agreed frame budget at its intended quality level.

## Phase 5 — Add audio and complete the user experience

**Target: 2–3 hours, Day 3**

1. Add engine audio driven by RPM/load, starting with loop crossfades; evaluate a worklet only if it improves the result enough to justify the work.
2. Add slip-driven tire audio, impacts, surface sounds, rain, and separate volume controls.
3. Handle browser audio unlock, mute, focus loss, and pause/resume.
4. Complete loading progress, menus, controls guidance, input remapping, settings, and asset credits.
5. Add reduced-motion options, legible HUD scaling, and cues that do not rely only on color.

**Deliverable:** a desktop feature-complete MVP candidate.

**Gate:** a new player can start, understand the controls, finish a lap, view a result, and retry without developer help. Audio behaves correctly after tab changes and session restarts.

## Phase 6 — Optimize, validate, and release the MVP

**Target: 3–4 hours, Day 3**

1. Profile CPU simulation time, GPU frame time, draw calls, memory, and initial download on the reference devices.
2. Prioritize compression, deferred decorative assets, texture limits, culling/LODs, and scalable effects based on measurements.
3. Verify keyboard/gamepad behavior, browser fallback, resize, device pixel ratio changes, reload, saved data, and longer play sessions.
4. Add focused automated checks for timing/checkpoint rules, replay compatibility, and save migrations. Use repeatable driving scenarios to catch handling regressions; do not assume identical physics results across platforms.
5. Run external playtests, fix release-blocking defects, and complete source/asset credits.
6. Publish the production build with cache versioning, a rollback path, and a short release checklist.

**Deliverable:** a public playable desktop MVP with known limitations documented.

**Gate:** no known release-blocking bugs; the agreed performance and browser targets pass; loading is measured on a recorded network profile; a fresh deployment and rollback are both verified.

## Schedule and contingency

Phases 0–6 target **20–30 hours of active work across three focused days**. The phase boundaries are completion checkpoints, not separate multi-day projects. Keep the build running and playable throughout; verify each system as it lands.

| Day | Main work | End-of-day playable result |
|---|---|---|
| 1 | Select/inspect detailed assets, prove the representative wet circuit scene, foundation and handling | A scene that demonstrates the intended visual direction plus a driveable car; complete basic circuit integration as time allows |
| 2 | Complete circuit integration, lap rules, HUD, ghost/save system, extend scene quality around the track | Complete a valid timed lap and chase a ghost in a consistently detailed circuit |
| 3 | Finish weather/audio/UI, profile, playtest, deploy | Hosted desktop MVP with the reference-driven visual direction, saved best laps, and verified controls |

Use debug geometry for isolated handling tests and simple tire/audio models where they achieve the desired result. For visual milestones, use detailed assets and the agreed realistic presentation from the start. Validate the rendering backend early and timebox effects experiments. Avoid making custom asset tooling or a detailed tire simulation a prerequisite for driving.

If a release gate fails, fix it or reduce scope explicitly. Allow an additional **1–2 focused days** if handling tuning, asset integration, or browser compatibility needs it; expand the estimate based on observed problems rather than applying a human-only development schedule.

The main dependency chain is foundation → handling → track → timing/replays → visuals/audio → release. Asset research can overlap handling work, and audio can begin once drivetrain telemetry is stable. Do not expand content while handling or track validation remains unresolved.

If the schedule slips, defer ghost replay, extra weather presets, and secondary UI features first. Preserve the detailed hero car, convincing circuit surroundings, wet-road appearance, lighting, driving quality, and stable performance. Scale effect resolution and distant detail where measurements justify it, and verify that the reference-driven look survives.

## Phase 7 — Expand the single-player game

**Target: 1–2 additional focused days for an initial expansion, after MVP feedback; larger content batches estimated separately**

- Add a second car only after the shared vehicle configuration and import process are stable.
- Add a garage, paint choices, data-driven challenges, and versioned unlock progression.
- Evaluate drift scoring and nitro as optional modes, with separate tuning from time trial.
- Add touch controls and mobile-specific layouts; set a separate device/performance target and validate thermal behavior.

**Gate:** new content uses the existing data model, progress survives upgrades, challenges are achievable, and the second car feels distinct. Mobile support ships only after its device checks pass.

## Phase 8 — Add online features if demand justifies them

**Target: 1–3 additional focused days for a casual-room prototype; production hardening is estimated after network tests, and competitive racing requires a separate plan**

- Specify room lifecycle, reconnect behavior, synchronization, bandwidth budgets, and interpolation.
- Prototype small casual rooms; evaluate an authoritative simulation separately if collisions or competitive fairness are requirements.
- Add backend validation, rate limits, room cleanup, deployment monitoring, and operating-cost limits.
- Treat public leaderboards as a separate feature with replay validation and abuse handling. Client-submitted times alone are insufficient for trusted results.

**Gate:** real multi-device sessions tolerate latency, disconnects, and stale clients; room resources are cleaned up; supported player counts meet measured budgets.

## First implementation milestone

Start with **Phase 0**: inspect detailed car/track candidates, create the application skeleton, and prove a representative wet start/finish scene alongside the fixed-step loop and rendering compatibility. The first visual checkpoint is the actual intended art direction. Then expand the handling sandbox and complete circuit integration.


## One-car body-only checkpoint � October 18, 2026

The authorized AV�12 body-shell test was generated and inspected in-engine (20 Meshy credits; 2,458,390 raw triangles; no textures/remesh). Wheel arches and window apertures are open and side panels are cleaner, but glossy shading still reveals uneven hood, roof and fender surfaces. Component separation alone has not met the reference-quality gate. Keep other generation on hold; evaluate surface reconstruction on this existing candidate or a properly modeled base. See `meshy_output/body-shell-test/README.md` and the local `/surface-review.html?experiment=body-only` comparison.


## Reusable assembly checkpoint

At the user's direction, the AV�12 body-only shell is now the example for the modular vehicle pipeline. `/assembly-lab.html` combines independent paint/clearcoat/liveries, reusable tires and two rim styles, brakes, fitted glass, mirrors, LEDs and global color grading. A per-car profile supplies attachment positions; export captures source identity, resource versions, fit profile and settings. Four ground-contact/resource/material tests and source-hash checks support the handoff. See `vehicle-pipeline.md` for phases and repeatable commands. This work used the existing shell and no new paid generation. Final fit, surface cleanup, mesh optimization and driving remain later gates.
