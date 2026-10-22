# What makes a racing game look and feel cinematic: research for Ultrack

Research only, 2026-10-19. Five research agents (Sonnet) covered car look, particles, camera and post, physics, and race presentation; this is the merged result. Nothing in the project was changed.

**How much to trust it.** Primary sources are thin. Forza, Gran Turismo, NFS and CarX publish almost nothing about their internals, and the key GDC talks (NFS Unbound VFX, Forza Horizon 5 particles) are members-only. The best primary source by far is Adrian Courrèges' **GTA V Graphics Study** ([part 1](https://www.adriancourreges.com/blog/2015/11/02/gta-v-graphics-study/), [part 2](https://www.adriancourreges.com/blog/2015/11/02/gta-v-graphics-study-part-2/), [part 3](https://www.adriancourreges.com/blog/2015/11/02/gta-v-graphics-study-part-3/)), a frame-by-frame breakdown, plus Criterion's GDC 2018 handling talk ([transcript](https://raw.githubusercontent.com/dklassic/GDC-transcript/master/static/src/transcript/n_A0RqeGado.txt)). Numbers marked *(starting value)* are craft defaults from the agents, not measurements from a game: tune them by eye.

## The eight things that matter most

1. **Reflections need light in them, not resolution.** GTA V reflects the world into a cube of only 128×128 per face, scenery only, and the water mirror is 240×120. Cars look premium because the reflections hold bright shapes (lamps, neon, a hot horizon band) against a dark ground, fade in toward the silhouette (Fresnel), and never leak where a surface can't see the sky.
2. **One "boost" value should drive everything on nitro:** FOV kick, camera pull-back, radial blur, chromatic aberration, vignette, a shake kick, sound and flames. The "dreamy" nitro look is these together, easing in fast (~0.2 s) and out slowly (~0.6 s).
3. **The camera is part of the handling** (Criterion). A critically damped spring follow, a look-ahead target, speed-driven FOV and a drift yaw offset do more for speed and weight than any shader.
4. **Physics should feed every visual.** Wheel slip drives smoke and screech, speed drives FOV, landings and contacts drive shake, load drives body roll. FH5 rebuilt its tyre smoke to respond to tyre temperature.
5. **Arcade feel is a real simulation plus gentle assists.** Criterion layers assists on a Pacejka-style tyre model: a brake tap enters a drift, centred steering holds the angle, lost speed is partly given back, ABS goes off on entry. Assists fade over a parameter instead of switching.
6. **Tyre smoke is the signature particle.** Slip-driven emission, soft depth fade, and cheap lighting (sun tint plus headlight terms, a backlit rim) carry it. Six-way lightmapped smoke is the AAA polish step.
7. **Wet night streets are about specular, not geometry.** Darker diffuse, glossier roads, light pools and streaks from headlights and tail lights; low-resolution reflections are fine when blurred.
8. **Spend luxury effects where the player isn't driving.** GT7 ray-traces only in replays and photo mode; Forza Horizon 5 only in its car viewer. Ultrack's frame budget is already 18–26 ms at 1080p (60 fps needs 16.6 ms), so heavy effects belong in replays, the intro and the finish.

---

## 1. Car look and reflections

**GTA V** ([Courrèges](https://www.adriancourreges.com/blog/2015/11/02/gta-v-graphics-study/)):
- Every frame it renders a cube of 6 × 128×128 HDR faces, about 30 draws per face, **scenery only**: no cars or characters, so cars don't reflect each other.
- It converts the cube to two paraboloid hemispheres: half the lookups, clean mips without seams, and more detail facing up, where bonnets and roofs reflect.
- Per-pixel spec data (intensity, gloss, Fresnel). The player car gets its own stencil value so it can be treated differently.
- Lights aren't in the cube; they're added afterwards as deferred light volumes with specular. That is what makes wet roads light up under headlights.
- Cars carry dirt textures, with vertex colours for AO, deformation and burn ([modding docs](https://docs.sollumz.org/documentation/fragments.yft/vehicle-shaders)).

**Racing games:**
- Forza Horizon renders a dynamic cubemap every frame for the player car ([interview](https://www.mcvuk.com/top-tips-how-to-create-great-fireworks/)). FH5 mixes screen-space reflections and cubemaps on wet roads ([teardown](https://www.pcgameshardware.de/Forza-Horizon-5-Spiel-73350/Specials/PC-Release-Benchmark-Test-Steam-Systemanforderungen-1382783/2/)).
- BeamNG: dynamic cubemap for the player only, a static level cubemap for the rest. SSR overrides the cube where a ray hits; planar mirrors are water only and "relatively expensive" ([docs](https://documentation.beamng.com/modding/lighting/reflections/)).
- Car paint is layered: a base coat with optional metallic flakes, then a clear coat with a faint orange-peel normal. Flakes fade out with distance to stop shimmer ([Stride docs](https://doc.stride3d.net/4.1/en/Manual/graphics/materials/clear-coat-shading.html)).

**Why a car looks plastic, and the fixes** (Filament's [PBR guide](https://google.github.io/filament/Filament.md.html)):
- **Fresnel.** The coat is a dielectric (F0 0.04): dark and neutral head-on, mirror-like at the edges. If reflection is strong at every angle, it reads as plastic.
- **Specular occlusion and horizon occlusion.** Without them, sills, arches and the underside reflect a sky they can't see. Filament's formulas are short:
  - specular AO: `clamp(pow(NoV + ao, exp2(-16·rough − 1)) − 1 + ao, 0, 1)`;
  - horizon: `h = min(1 + dot(r, n), 1); spec *= h²`.
- **Reflection contrast.** You need bright shapes against a dark surround; mid-grey reflections everywhere read as plastic.
- **Normals.** Faceted or noisy normals break reflection lines instantly. Our baked smooth normals are the right fix.

**three.js specifics** (from the shader source):
- Roughness has a floor of 0.045, plus a screen-derivative term, so our `clearcoatRoughness` 0.035 is effectively clamped. That's no problem, but don't expect a perfect mirror.
- Clearcoat F0 is fixed at 0.04.
- There is no horizon handling in the environment lighting; specular occlusion only runs with an AO map. Both can be patched with `onBeforeCompile`.
- The official car example (`webgl_materials_car`) uses metalness 1, roughness 0.5, clearcoat 1 with a sunset HDRI. The clearcoat example adds a procedural flake normal map (`FlakesTexture`).
- `PMREMGenerator.fromCubemap` expects about 256 px faces; reuse one generator.
- Screen-space reflections: `SSRPass` on WebGL, `SSRNode` on WebGPU. The latter skips non-metals unless `reflectNonMetals` is on, so clearcoat paint needs that flag.

**What Ultrack has:** a 128 px cube capture around the player car, one face per frame; the scene HDRI for other cars; clearcoat paint over smoothed normals; Neutral tone mapping at dusk.

**What Ultrack should do here:**
1. **Put HDR light into the capture:** lamps, neon, headlight glows and a hot horizon band at values well above 1, over a dark wet ground. It's content work, nearly free, and the biggest premium cue.
2. **Add specular and horizon occlusion** to the paint shader, with baked vertex AO the way GTA V does it. Negligible cost; stops sills and arches glowing.
3. **Crossfade the capture:** rebuild the PMREM after each full 6-face cycle and blend between old and new, to remove reflection pops.
4. **Paint polish:** distance-faded flakes on metallic teams (Kalt, Aurum), very low orange peel.
5. **Give the other cars a better shared probe**, darker below and brighter above, instead of the raw sky.

## 2. Smoke, exhaust, nitro and spray

**Tyre smoke.**
- FH5 built a new, denser smoke system that responds to tyre temperature ([racinggames.gg](https://racinggames.gg/forza/forza-horizon-5-the-tiny-detail-that-elevates-fh5)). Its whole VFX set is driven by parameters (speed, slip, temperature) ([GDC abstract](https://gdcvault.com/play/1027902/Visual-Effects-Summit-How-Parameters)).
- NFS Unbound keeps realistic smoke and tail-light trails, and layers its stylised "Tag" effects on top ([Frostbite](https://ea.com/frostbite/news/nfs-unbounds-signature-style-gdc-2023)).

Techniques that make smoke look lit and solid:
- **Six-way lightmaps:** the smoke is pre-lit from six directions and blended by light direction at runtime. It costs about the same as a lit sprite ([Unity](https://unity.com/blog/engine-platform/realistic-smoke-with-6-way-lighting-in-vfx-graph)).
- **Flipbooks with motion-vector blending:** an 8×8 sheet plays over ten times longer at the same smoothness ([Lozar](https://www.klemenlozar.com/frame-blending-with-motion-vectors/)). Free CC0 smoke sequences exist from [Unity Labs](https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks).
- **Soft particles:** fade alpha where the sprite meets the road or a car, using scene depth ([Wolfire](https://www.wolfire.com/blog/2010/04/Soft-Particles)).
- **Cheap lighting:** tint each sprite by sun and ambient colour, add a couple of headlight terms per sprite, and add a backlit rim term so smoke glows with a light behind it.
- **Emission from slip:** `rate = k · smoothstep(slipLow, slipHigh, slip) · speedFactor`. Particles inherit the car's velocity, slow quickly, rise slightly, and grow while fading.

**Exhaust, pops and backfire** (craft defaults):
- **Backfire:** 1–3 flame sprites lasting 0.08–0.2 s along the pipe, white-yellow core with an orange or blue edge, HDR so bloom carries it. Add a one-frame light flash, a few sparks and a puff of dark smoke.
- **Sync:** fire them from the same event that already plays the pop and bang sounds.
- **Idle heat haze:** a distortion sprite scaled by throttle (a GTA V mod runs it at about 40% at idle, 100% at full throttle: [mod](https://www.gta5-mods.com/fr/scripts/vehicleexhaustheat)).

**Nitro flames:**
- A stretched cone: hot white core, blue or orange outer layer, 2–3 additive layers, flicker ±15% at 20–30 Hz, and Mach-diamond bright spots.
- A cheap additive glow blob on the road behind the car.
- An optional ribbon trail from the exhaust or tail lights.
- NFS Unbound's boost reads through 2D graffiti-like "Tags" around the car ([Jalopnik](https://jalopnik.com/heres-how-need-for-speed-unbounds-radical-art-style-cam-1849832310)). That's a cheap, distinctive stylised option.

**Rain.**
- **Rooster tails:** a fan of 20–60 velocity-stretched droplets from each rear tyre plus a soft mist sprite, both scaled by speed and wetness.
- **Lens droplets:** a full-screen pass with SDF drops that refract the image, in layers (static drops, slow trails, fast drops), with extra blur where trails are dense. Don't copy the popular "Heartfelt" shader: its licence is CC BY-NC-SA.

**Implementation in three.js:**
- One instanced quad system per effect type. Positions are computed in the vertex shader from spawn data and age (`p = p0 + v·t + ½·a·t²`), so the CPU does no per-frame work.
- Soft fade from the depth texture.
- Fill rate is the real cost: about 15–30 big sprites per smoke cloud, cap emission per car, sort per emitter. Flames and sparks are additive and need no sorting.
- A half-resolution particle pass is the later safety net (about 2× faster on heavy scenes per [GPU Gems 3](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-23-high-speed-screen-particles)).
- [three.quarks](https://github.com/Alchemist0823/three.quarks) (MIT, batched rendering, ribbon trails) and [three-nebula](https://github.com/creativelifeform/three-nebula) are worth studying. For six cars and a handful of effects, a small custom system will likely win, because we control the shader.

## 3. Camera and post-processing

**Chase camera:**
- **Spring follow.** A critically damped spring per channel (position, yaw, roll, FOV) is the standard, and frame-rate independent: `x(t) = ((v0 + x0·ω)t + x0)·e^(−ωt)` ([Juckett](https://www.ryanjuckett.com/damped-springs/)). Plain lerp falls further behind as speed rises.
- **Look-ahead** of 0.2–0.4 s of velocity hides the lag.
- **Separate damping per axis:** turn slowly, but stay tight under acceleration.
- **Speed FOV:** normalise speed between a threshold and top speed, ease between base and max FOV, then smooth it.
- **Starting values:**
  - position spring ω 6–9 and yaw ω 4–6;
  - distance and height grow slightly with speed;
  - a brief forward pitch under braking and a dip on landing;
  - drift: yaw offset of 8–15° toward the slide plus 1–3° of roll.
- **Camera rotation.** A camera that doesn't rotate with the car lowers perceived speed ([Forza forum](https://forums.forza.net/t/forzas-chase-cam-is-vastly-under-rated/541156)).
- **Criterion's landing shake:** about 30 Hz pitch and roll for about 0.5 s, with camera damping loosened after a fast landing ([transcript](https://raw.githubusercontent.com/dklassic/GDC-transcript/master/static/src/transcript/n_A0RqeGado.txt)).

**Shake: the "trauma" model** (Eiserloh, GDC 2016, [talk page](https://www.gamedeveloper.com/programming/video-sprucing-up-cameras-with-math)):
- **How it works:** trauma runs from 0 to 1 and decays linearly. Shake is trauma squared, applied through smooth noise and mostly as rotation.
- **Bevy's version:** max 10°, noise 20/s, decay 0.5/s ([Bevy](https://bevy.org/examples/camera/2d-screen-shake/)).
- **A Godot add-on:** 14 Hz, rotation caps of (3, 3, 2)° and no positional offset ([docs](https://www.strayspark.studio/docs/godot-camera-system/noise-and-shake)).
- **Triggers** *(starting values)*:

  | Event | Trauma |
  |---|---|
  | Kerb hit | 0.15–0.25, as a roll-heavy buzz |
  | Landing | 0.3–0.5 |
  | Car contact | 0.4 |
  | Wall hit | 0.6–0.8 |
  | Top-speed rumble | at most 0.1 above about 85% of top speed |

- **Comfort:** shake, FOV changes and blur make some players sick. Xbox guideline 117 asks for a way to reduce them ([Xbox](https://devdocs.xbox.com/gaming/accessibility/xbox-accessibility-guidelines/117)). Ship a "Reduce motion" setting with these effects.

**The nitro envelope.**
- **The only sourced numbers** come from SuperTuxKart ([forum](https://forum.supertuxkart.net/thread-200.html)):
  - FOV up to +8°, starting at 70% of top speed;
  - 60–100 radial speed-line sections, strongest at the edges;
  - chromatic aberration once boost passes 0.3;
  - players found the lines too opaque and too fast.
- **Envelope** *(starting values)*:

  | Element | Value |
  |---|---|
  | Attack | 0.15–0.25 s |
  | Release | 0.5–0.8 s |
  | FOV | +6–8° on the attack, settling to about +4° while held |
  | Camera pull-back | 0.3–0.6 m |
  | Radial blur, chromatic aberration, vignette | scale with boost |
  | Shake | a 0.1–0.2 s kick on ignition, then a low buzz |
  | Speed lines | at most 20–40% opacity, edge-weighted |

**Post-processing in GTA V** ([part 3](https://www.adriancourreges.com/blog/2015/11/02/gta-v-graphics-study-part-3/)):
- HDR, then the Uncharted 2 filmic tone curve.
- Auto-exposure that adapts faster from dark to bright than back.
- Bloom from a bright pass, down to 1/16 resolution and back up, added before tone mapping.
- A final pass of lens distortion plus chromatic aberration, edge-weighted and strongest in red.
- Sun flare from 12 rotated streak quads and about 70 sprites.
- Anamorphic streaks only on very bright sources such as headlights.
- Motion blur from camera rotation only, with the player masked out.

**Replays:**
- Trackside cameras zoom by distance; a heli cam barely moves.
- A simple auto-director scores events (overtakes, the closest gap, crashes, the finish) and picks a shot.
- Shots last at least 3–4 s, cuts happen as a car passes the lens, and screen direction stays consistent across a cut.
- GT7's Music Replay cuts to the music ([AOL](https://www.aol.com/gran-turismo-7-details-music-223000158.html)).
- Replays get letterbox bars (about 2.35:1, eased in over 0.4 s), depth of field on the followed car and slightly heavier grain.

**three.js:**
- three ships no chromatic-aberration, vignette or radial-blur pass, so ours stay custom.
- Folding them, with the grade and grain, into one fragment shader is the main post saving. [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) merges effects into one pass this way.

## 4. Physics and handling

**The spectrum, from arcade to sim:**
- **Rocket League** has no tyre sim: a lateral friction curve over sideways/total wheel speed (about 0.2 sliding, 1.0 rolling), applied at centre-of-mass height so steering can't roll the car, at a fixed 120 Hz ([transcript](https://raw.githubusercontent.com/dklassic/GDC-transcript/master/static/src/transcript/ueEmiDM94IE.txt)).
- **Skylanders** uses an authored speed-over-time curve and a turn radius.
- **Criterion** runs a full drivetrain plus Pacejka-style tyres, with arcade assists on top.
- **GTA V** is data-driven: a slip-angle grip curve, and steering lock that shrinks with speed ([handling glossary](https://gtacars.net/gta5/glossary)).
- **Forza Motorsport** moved to eight contact points per tyre at 360 Hz ([GTPlanet](https://www.gtplanet.net/forza-motorsport-new-tyre-model-20210528/)).

**Tyres:**
- Pacejka's curve is `y = D·sin(C·atan(Bx − E(Bx − atan Bx)))`, for example B = 10, C = 1.9, with D scaled by μ times the wheel load.
- The simpler game version ([Car Physics for Games](http://www.asawicki.info/Mirror/Car%20Physics%20for%20Games/Car%20Physics%20for%20Games.html)):
  - lateral force = cornering stiffness × slip angle, capped at μ × load;
  - slip ratio = (ωR − v)/|v|;
  - weight transfer = (h/L)·M·a;
  - a friction circle combines the two forces ([Physics of Racing](https://www.pelicanparts.com/techarticles/physics_racing/part7.htm)).

**Drifting:**
- **Criterion's assists:**
  - a brake tap while turning enters a drift;
  - the steering re-centres, so neutral stick holds the angle;
  - lost speed is partly re-applied along the velocity;
  - ABS is off on entry and back on at exit.
- **Mario Kart Wii** needs over 55% of top speed to drift, and charges its mini-turbo faster when steering into the drift ([TAS wiki](https://wiki.mkwtas.com/wiki/Drift)).
- **Don't just cut rear grip:** a flat cut makes the car uncontrollable. Use a fade-in, separate enter and exit angles, and optional auto-countersteer that scales with angle and speed.

**Nitro:**
- Mario Kart's boost adds 20% to max speed on a timer ([TAS wiki](https://wiki.mkwtas.com/wiki/Boost)). Rocket League's drains at 33.3/s.
- Burnout sold boost through audio: an endlessly rising Shepard-tone turbo, louder music, exaggerated pass-bys ([Designing Sound](https://designingsound.org/2017/08/31/burnout-a-sound-design-retrospective-with-ben-minto/)).

**Rapier's raycast vehicle** ([API](https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html), [source](https://raw.githubusercontent.com/dimforge/rapier/master/src/control/ray_cast_vehicle_controller.rs)):
- **How it grips:** suspension force scales with mass, and grip scales with wheel load, so weight transfer comes free. Side impulse cancels lateral velocity, and forward and side impulses are clamped together as a circle.
- **The limit:** no slip angle, no slip ratio and no grip falloff past the peak. A flat clamp is hard to hold in a drift.
- **The fix for a drift game:** keep Rapier's suspension and chassis, set side friction near zero, and apply our own slip-angle tyre force with `applyImpulseAtPoint`.
- **For visuals:** per-wheel getters (`wheelSideImpulse`, `wheelIsInContact`, `wheelSuspensionLength` and others) feed smoke and screech directly.

**Timestep and replays:**
- Fixed-step accumulator at 120 Hz, frame time clamped to 0.25 s, and the render interpolated between the previous and current pose ([Gaffer On Games](https://gafferongames.com/post/fix_your_timestep/)).
- Rapier is deterministic across platforms on the same version and setup order ([docs](https://rapier.rs/docs/user_guides/javascript/determinism/)), so replays can be recorded inputs per tick.

## 5. Race presentation and the night look

- **Lighting:**
  - Forza Horizon 5 shot over 2,000 real sky presets, a 12K sky image every 30 seconds, and picks one per time and weather ([VGC](https://www.videogameschronicle.com/news/forza-horizon-5s-art-team-explains-how-it-got-the-skies-to-look-so-realistic)).
  - Driveclub's clouds are full 3D volumes lit by the sun; cloud colour tints cars and terrain ([PlayStation blog](https://blog.playstation.com/2014/06/05/51-details-about-driveclub-on-ps4/)). Its low sun on wet tarmac made glints bright enough to distract, and brake discs glowed in the wet reflections ([TheSixthAxis](https://www.thesixthaxis.com/2014/06/18/driving-rain-driveclubs-weather-and-how-the-delay-benefits-us-all/)).
- **Wet surfaces** (Lagarde: [wet surfaces](https://seblagarde.wordpress.com/2013/04/14/water-drop-3b-physically-based-wet-surfaces/), [observations](https://seblagarde.wordpress.com/2012/12/10/observe-rainy-world/)):
  - darken porous diffuse with wetness and push gloss toward water;
  - flatten normals in puddles;
  - the specular sheen dries faster than the darkening, and vertical surfaces stay drier;
  - metal and plastic don't darken.
- **Night traffic in GTA V:** distant lights are instanced 32×32 quads, distant cars are just two headlights, and dynamic lights are halo meshes that shade only what they touch.
- **Race sequence.** Developer sources are sparse; *craft defaults*:
  1. an intro crane or drone pass that ends on the grid;
  2. a silent beat, then lights-out with the engines swelling;
  3. replays from TV-style section cameras;
  4. brief slow motion only on overtakes and the finish, with ambient sound ducked;
  5. cuts on the beat of a music bed.
- **Web peers:**
  - Project Endurance is the closest peer (no public write-up). Our own teardown, `endurance-rebuild-report.md`, has its look and physics details.
  - Bruno Simon's 2025 portfolio ([case study](https://www.awwwards.com/brunos-portfolio-case-study.html)) runs one shared day/night/weather system, samples one palette texture for colour consistency, and degrades on mobile (lower shadows, no water blur or depth of field).
- **Budget:**
  - Merge post passes and cap DPR with adaptive resolution.
  - Run bloom at low resolution; keep 3 or fewer shadow-casting lights.
  - Half-resolution post can nearly double frame rate when fill-bound ([Utsubo tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips), opinion, not benchmarks).

---

## Roadmap for Ultrack

Ordered by value and dependency. Cost is GPU per frame; *player handling* means the work needs a drivable car first, which comes after all the cars are in.

### Phase A: free or cheap, can start now
| # | Item | Payoff | Cost | Difficulty |
|---|---|---|---|---|
| A1 | **Profile per pass and get dusk to ≤ 16.6 ms**: half-res road mirror blurred by roughness, fold CA/vignette/grain/radial blur/grade into one shader, HalfFloat buffers | everything else depends on smoothness | saves time | med |
| A2 | **Camera rig**: critically damped springs per channel, look-ahead, speed FOV, braking and landing pitch | the single biggest speed/weight gain | ~0 | low |
| A3 | **Trauma shake** (rotation-only, exponent 2, 6–14 Hz noise) + a **Reduce motion** setting | impact and accessibility | ~0 | low |
| A4 | **HDR-rich player-car capture + specular/horizon occlusion on the paint** | the premium-paint cue | ~0 | low–med |
| A5 | **Lagarde wet shading** on the existing wet road (diffuse darkening, gloss, flattened puddle normals, scrolling ripples) | the night street look | low | low–med |
| A6 | **Tail-light and headlight streaks** (additive ribbons) | speed and night mood | low | low–med |

### Phase B: handling (once the player car drives)
| # | Item | Payoff | Cost | Difficulty |
|---|---|---|---|---|
| B1 | **120 Hz fixed step with pose interpolation**, shared by player, AI and replays | smoothness, a stable base | CPU only | low |
| B2 | **Speed-sensitive steering + input smoothing** | largest feel gain per effort | — | low |
| B3 | **Hybrid tyre force** on Rapier (our slip-angle curve, Rapier's suspension) | real grip falloff, controllable oversteer | CPU | med–high |
| B4 | **Drift model** (brake-tap entry, hysteresis, auto-countersteer assist, speed give-back, scoring) | the signature mechanic | — | med |
| B5 | **Nitro**: earned by drifting, ramped force plus top-speed lift, slightly more stability | high | — | low–med |

### Phase C: effects driven by B
| # | Item | Payoff | Cost | Difficulty |
|---|---|---|---|---|
| C1 | **Tyre smoke** (instanced flipbook quads, slip-driven, soft depth fade, sun/headlight tint) | the signature visual | med–high (overdraw; cap sprites) | med |
| C2 | **One boost envelope** driving FOV, pull-back, radial blur, CA, vignette, shake kick and audio | sells nitro, the "dreamy" look | ~0 (passes exist) | low–med |
| C3 | **Nitro flames + ground glow + flash**, and **backfire/pops** on the existing audio events | high for the effort | low (additive) | low |
| C4 | **Rain spray / rooster tails** and a **lens-droplet pass** (own shader) | the wet mood in motion | low–med | med |
| C5 | **Engine audio from an RPM model** (layered loops, constant-power crossfade) | the blindfold test | — | med |

### Phase D: presentation
| # | Item | Payoff | Cost | Difficulty |
|---|---|---|---|---|
| D1 | **Race sequence**: intro crane to grid, silent beat, lights-out, finish shots | the biggest cinematic gain beyond the car | ~0 | med |
| D2 | **Replay mode**: recorded inputs, an event-scored director, letterbox, depth of field, brief slow motion | GT7-style polish | effects only in replays | med–high |
| D3 | **Luxury quality only in replays/finish**: full-res mirror, DOF, motion blur, more particles | premium moments at no driving cost | replay-only | med |
| D4 | **Six-way lit smoke / motion-vector flipbooks** | AAA smoke polish | low | high (authored maps) |
| D5 | **A time-of-day arc across a session** (golden hour → blue hour → night) | Endurance-style mood | low | low–med |

**Open questions the research couldn't answer:** the internals of the paywalled NFS Unbound and FH5 talks; any GTA V or CarX smoke specifics; game-scale Pacejka coefficients; and our own per-pass GPU costs (we need to profile them).
