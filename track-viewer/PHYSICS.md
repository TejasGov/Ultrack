# Car physics (`src/physics/`)

Phase B of `research/cinematic-racing.md`. The race cars drive on the track's collision mesh: Rapier, the same engine `npm run test:track` checks the track with.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Throttle | W / ↑ | right trigger |
| Brake (reverse when stopped) | S / ↓ | left trigger |
| Steer | A D / ← → | left stick (dead zone .09, curve ^1.6) |
| Handbrake (starts a drift) | Space | A |
| Nitro | Shift | X |
| Reset to the track | R | Y |

- **Who drives:** the GUI's **you drive** toggle hands the car to the AI (for benchmarks and flythroughs). `?physics=0` brings back the old line-following.
- **HUD:** the bottom line shows speed, the nitro tank, the drift angle and the surface under the car.

## How it works

| File | What |
|---|---|
| `world.js` | The Rapier world at a fixed 120 Hz, with poses interpolated for rendering. Each collision surface has its own grip and rolling drag (table below). `PhysicsWorld.flat()` is an empty skidpad for tuning. |
| `vehicle.js` | One car (details below). |
| `handling.js` | Per-car parameters from `assets/cars/specs.json` (the real facts) and `assets/cars/handling.json` (character, balance), plus the upgrade levels (details below). |
| `weather.js` | How wet the road is (`setWeather`), and the grip a wet road leaves (`wetGrip`). |
| `driver.js` | `PlayerInput` (keyboard and gamepad) and `AIDriver` (details below). |
| `testdrive.js` | Headless tools: `soloRun` (an AI lap with stats), `balance` (balance of performance), `skidpad` (scripted inputs on the flat world). |
| `../../scripts/physics-harness.mjs` | The same measurements as a node script (no browser): skidpad g, 100-0, 0-100, top speed, laps, driver mistakes, balance, brake calibration, upgrade checks. See *Test harness* below. |

**`vehicle.js`, one car:**
- **Chassis:** a Rapier rigid body with mass, inertia, centre-of-mass height and weight split. Its collision box is the car's real length and width (specs.json), so a 5 m car and a 4.5 m car touch walls at different moments, and the yaw inertia follows the box. It collides with walls, other cars and the cars parked in the pit boxes. `retune(handling(key))` swaps in a new set of numbers (mass, springs, power, grip, brakes) on a live car.
- **Suspension:** one ray per wheel, with a spring and damper. Each wheel's load comes from its spring, so weight shifts under braking and cornering. Anti-roll bars keep the body level.
- **Tyres:** cornering force follows a slip-angle curve (Pacejka-like): peak grip near 7.5°, 90% of it at 15°, 70% when fully sideways. The rear axle is 6% stiffer (peaks earlier: the car understeers into the limit) and falls off more gently after the peak (a slide settles by itself when the hands come off). Drive and brake force combine with it inside a friction circle: grip × load × surface; an overloaded tyre keeps its pull and loses cornering faster, which is what lets the tail go under too much throttle or the handbrake. Braking, a lifted throttle and power move cornering grip between the axles (*Turning* below).
- **Engine and brakes:**
  - drive is limited by power (AWD splits it 40/60) and by grip: a tyre pulls harder in a line than sideways (an ellipse, 1.2x for AWD, 1.4x for RWD, +7% for an EV);
  - the throttle answers after a lag that depends on the powertrain: an EV 0.04 s, a naturally aspirated ICE 0.1 s, a hybrid 0.08-0.12 s, a turbo ICE 0.22 s (a lift is always quick);
  - braking is biased to the front, and scaled per car by `brakeK` (calibrated so 100-0 follows the real distance);
  - air drag sets the top speed;
  - downforce grows with speed squared.
- **Assists** (all of them wait for a real spin: slide angle beyond Casual 8°, Sport 13°, Pro 24°, fading in over 8° more; see *Turning*):
  - steering lock follows the grip: the angle that holds the car at its limit at this speed, so the keyboard gets the grip and no more;
  - countersteer toward the direction of travel, and part of the driver's steering taken back (Casual 80%, Sport 50%, Pro 15% at full strength);
  - a yaw moment against the slide (catch) and the yaw stability aid, which damps only rotation beyond what the tyres can turn (one-sided, see *Wet grip*);
  - traction control: cuts the throttle in a slide, and leaves cornering grip first (Casual all of it, Sport a third, Pro none). The AI gets all of it.
- **Drift mode** (handbrake, or a brake tap while steering at speed):
  - rear grip fades and the front wheels follow the slide;
  - the steering sets the angle: neutral holds about 24°, steering into the drift up to about 43°, countersteering down to about 7°;
  - part of the speed lost to the slide is given back;
  - lifting off ends the drift;
  - past about 45° the power fades out, so the car can't spin.
- **HUD tags:** `vehicle.state.tcsActive`, `absActive` and `escActive` (0..1, per step) are how hard traction control (drive cut), the ABS (brake demand capped) and the stability aids (countersteer, steering taken back, stability and catch moments, slide recovery) are working; the debug terms in `vehicle.dbg` are for `scripts/physics-turning.mjs` only.
- **Nitro:** +45% power while held. The tank drains in about 4.5 s, refills slowly, and refills fast while drifting.

**`handling.js`, per-car parameters.**
- **Facts from `specs.json`:** mass, body size, drive, powertrain (EV / hybrid / ICE), 0-100, top speed and power are real published figures with sources (`estimated` marks concepts and one-offs). `handling.json` keeps the car's character (grip, downforce, centre-of-mass height, weight split), the balance of performance (`bop`, `bopGrip`) and `brakeK`.
- **Compression** so the whole field can race: top speed is 250 + (real - 240) x 0.6 km/h, 0-100 is 2.6 + (real - 2.6) x 0.75 s, 100-0 is 37 m + (real - 33) x 0.5, tyre grip lies within ±0.1 of 1.16. Power follows from mass and the 0-100 time, drag from power and top speed (all the power goes into drag at top speed, after rolling drag).
- **Balance of performance** is bounded (power 0.93-1.07, grip 0.95-1.12) so the real differences in power and speed are not balanced away; the AI solo laps land within 147-153 s (4% apart, two groups: the cars with the most power-to-weight, and the Mustang, i8 and Continental).
- **Sim against real** (dry, flat world, Sport assists; the sim figures are the compressed targets after BoP):

| Car (real model) | 0-100 s sim / real | Top km/h sim / real | 100-0 m sim / real |
|---|---|---|---|
| av12 (Aventador SVJ) | 2.86 / 2.8 | 302 / 350 | 35.9 / 31 |
| furari-488 (488 Pista) | 3.04 / 2.85 | 294 / 340 | 35.6 / 30 |
| aston-martin-valk (Valkyrie) | 2.87 / 2.6 | 292 / 354 | 32.3 / 29 |
| jaguarxkjss (AMG ONE) | 2.87 / 2.9 | 299 / 352 | 36.1 / 31 |
| mp1x (650S GT3; the 720S figures) | 3.10 / 2.9 | 293 / 341 | 35.5 / 30 |
| mustang (Mustang GT) | 3.64 / 4.5 | 260 / 249 | 39.0 / 37 |
| bmw1 (i8) | 3.26 / 4.4 | 260 / 250 | 38.2 / 35 |
| buggati (Divo) | 2.80 / 2.4 | 319 / 380 | 36.4 / 32 |
| destrier (Destrier, estimated) | 2.70 / 2.3 | 324 / 400 | 35.0 / 29 |
| bentley-gt (Continental GT Speed) | 3.13 / 3.6 | 305 / 335 | 38.1 / 35 |
| blackbird (Blackbird, estimated) | 3.13 / 2.7 | 303 / 354 | 36.1 / 31 |
| porsche1 (918 Spyder, hybrid AWD) | 2.68 / 2.6 | 299 / 345 | 33.2 / 31 |
| huracan (Huracan STO, NA V10 RWD) | 2.96 / 3.0 | 278 / 310 | 32.6 / 30 |
| laferrari (LaFerrari, V12 hybrid RWD) | 2.80 / 2.6 | 299 / 350 | 32.6 / 30 |

  (2026-10-21: the Valkyrie, 918 Spyder, Huracan STO and LaFerrari rows were re-measured with `physics-harness.mjs --tests table` after adding and rebalancing them; the other rows are from the older tune and read 3-9% long in 100-0 and about 0.1 s slow in 0-100.) The four were balanced with `--tests balance --cars ... --write`, then calibrated with `--tests calibrate --cars ... --brakeScale .92 --write`: the field brakes about 8% shorter than the compressed target since the arcade grip pass, and the new cars follow it instead of recalibrating the rest. Order matters: balance first (bopGrip changes the brakes), calibrate after. All four sit at the floor of the BoP (power .93, grip .95): AI laps 144.0-144.6 s (Huracan 147.2 s), no spin, dry/damp/rain.

  The ordering holds at the extremes (the i8, Mustang and Continental are slowest off the line and in the brakes; the Destrier and Divo are quickest and top-fastest) but the middle is squeezed: the cars are compressed and balanced on purpose.
- **Upgrades** (`setUpgrades(key, { engine, tyres, brakes })`, each 0..3; see specs.json `upgrades` for the numbers):
  - engine: power x1.05 / 1.10 / 1.16, +10 kg at level 3; top speed follows from the unchanged drag (+1.6 / 3.2 / 5%);
  - tyres: grip x1.03 / 1.06 / 1.09, and 2 / 4 / 6 points more of the dry grip kept in the wet;
  - brakes: brake torque x1.05 / 1.10 / 1.16.
  - Measured on the AV-12, level 3 of each (dry): engine 0-100 2.86 -> 2.65 s, top 302 -> 318 km/h; tyres 100-0 36.0 -> 33.1 m, skidpad 1.42 -> 1.55 g, rain skidpad 1.13 -> 1.33 g; brakes 100-0 36.0 -> 33.9 m; all three 2.62 s, 31.1 m.
  - `handling(key)` applies the stored levels; call `vehicle.retune(handling(key))` on a car that is already racing. AI cars are never upgraded.

**`driver.js`:**
- `PlayerInput`: keyboard steering eases in and springs back.
- `AIDriver`: follows the racing line with pure-pursuit steering, targets the slowest speed of the next 45 m, U-turns after a spin, and resets after 4 s stuck.

**Surfaces** (from the track's collision names):

| Surface | Grip | Rolling drag |
|---|---|---|
| asphalt | 1.0 | - |
| pit | 0.98 | - |
| kerb | 0.9 | 0.02 |
| sausage kerb | 0.75 | 0.08 |
| tarmac run-off | 0.95 | 0.01 |
| paved | 0.9 | 0.01 |
| grass | 0.5 | 0.12 |
| gravel trap | 0.38 | 0.45 (it bogs you down) |

**Wet grip** (`weather.js`). The game calls `setWeather(WEATHER[...].wet)` (dry 0.15 = no water, damp 0.7, rain 1); every car reads it each step, so a change mid-session takes effect at once.
- **Peak grip kept:** 1 - 0.2 x wetness: about 87% in damp and 80% in rain (the tyre upgrade adds up to 6 points).
- **Tyre curve:** same stiffness build-up as dry (the car answers the wheel the same), a slightly later peak and a softer tail, so the limit announces itself.
- **Surfaces** go slicker than asphalt in the rain: kerbs x0.85, paved x0.88, grass x0.9 (the painted lines are not in the collision mesh, so they are not modelled). Standing water is not modelled.
- **Stability assist** works 50% harder in rain.
- **AI** takes corners at sqrt(wet grip) of its dry speed, less 4% in rain for the braking margin, and steers on the curvature it really has, not only the one it asks for.
- **Why it slid like ice:** nothing in the physics read the weather at all (damp and rain drove exactly like dry), so the feel came from the yaw stability assist. It pushed the car toward the *no-slip* yaw rate of the steering whenever the wheel was held over, and a car at its grip limit (always, and more so the less grip it has) cannot reach that rate: the push drove the rear out and the car round. On Sport, holding full lock at 120 km/h, or lifting at 150 km/h with the wheel over, spun every car, dry or wet. The assist now only damps rotation beyond the demand.

**Hooked up for free:**
- the visual suspension (`carkit/chassis.js`, at half strength, since the body already leans);
- each wheel's travel, steering and spin;
- tyre smoke from real slip and wheelspin;
- exhaust and pops from the throttle;
- nitro flames;
- the camera's boost kick, and the speed blur from real speed.

## Turning

Why the car did not turn like it was on a road (measured with `scripts/physics-turning.mjs` on the build before 2026-10-21, same harness before and after):
- **The car did not rotate even with every assist off.** Casual, Sport and Pro were within 0.1 s and 1° of each other in every scenario. The tyre curve was flat after the peak (95% of the peak at 15°, 91% at 20°, a 90% sliding floor), the rear had 2.5-4% more grip than the front, yaw inertia was 5-18% over a box, the body had 0.4/s of yaw damping, the friction circle took pull and cornering away together (a throttle or handbrake could not take rear grip), and nothing moved grip between the axles. A lift gave 1.6° more slide, throttle on a V8 RWD at 40 km/h 3°, the handbrake 60° of heading.
- **The lock was too small at speed for low-downforce cars.** `steeringLock` counted downforce 9.81 times too strong, so the lock came out right for the AV-12 by luck and 2x short for the Mustang and Continental; the keyboard scale then took 30% off. Worst case over 60/100/150/200 km/h, full keyboard steer: AV-12 95% of the tyre limit, Mustang 77% (74% at 200 km/h), Roadster 86%, Continental 75%.
- **The keyboard ramp was slow:** 63% of the yaw rate took 0.28-0.33 s at 100 km/h.
- **The aids acted far below a spin:** countersteer from 4° of slide, throttle cut from 2.3°, slide recovery from 4°, rear ABS reserve 1 and a forward brake bias (no rotation on the brakes at all). They sat on the ordinary cornering slide of 3-5°.

What it does now (`vehicle.js`, `arcade.js`, `player-controls.js`, `assets/cars/driving.json`):
- **Lock** = (kinematic angle at the grip limit, with the right downforce, + 3° understeer allowance) × 1.35, shrinking to × 0.95 above 120 km/h, never more than the rack. About 12.7°/7.4°/5.1°/3.5° at 60/100/150/200 km/h; `steerScale` only trims 12% off at 250 km/h. The grip-limited yaw rate is never reduced by an aid.
- **Keyboard:** the wheel winds in at 9/s (6.3/s above 150 km/h; 63% in 0.11 s), reverses at 14/s, returns to centre at 11/s; the steering rack follows at 18/s (15 for muscle and tourers, 20 for track cars).
- **Aids only for a real spin** (`spinGate`): they do nothing below the tier's slide angle (Casual 8°, Sport 13°, Pro 24°) and fade in over 8°. Countersteer, taking back the driver's steering, a catch moment (`catchGain` x stability), the stability damper, slide recovery and the throttle cut all scale with it. A car caught like that is back in line in about a second.
- **Rotation tools:** a lifted throttle (`liftShift`, engine braking), the brakes (`brakeShift`, Casual half, halved again by 220 km/h) and power (`powerShift`) shift cornering grip between the axles (`pitchGrip`, with a quick `shiftBite` at the moment of change, and `pitchAero` making the lift and power part stronger on high-downforce cars, which would otherwise stay planted): lift-off and trail-braking rotate the tail, power puts it back. Rear brake reserve is tier-scaled (Casual all, Sport .94, Pro .85); brake bias follows the steering only on Casual. Traction control reserves tcs² of the cornering grip, so a RWD Sport car can step the tail out on throttle and Pro can spin it. The handbrake locks the rear (a long pull keeps it locked and swings the car round; a locked rear scrubs speed; letting go with the throttle off ends the drift at once).
- **Settling:** the rear axle is stiffer (`rearStiffness` 1.06) and its curve falls off less after the peak (`rearTyreShape`), which is what makes a slide settle with the hands off. Yaw inertia is 0.85-0.98 of the box (was 1.05-1.18), body yaw damping 0.12/s (was 0.4).

Numbers, same harness before -> after (AV-12 / Mustang / Roadster (since removed) / Continental, Sport, dry unless noted):

| | before | after |
|---|---|---|
| tyre grip used, full keyboard steer, worst of 60-200 km/h | 95 / 77 / 86 / 75% | 97 / 96 / 97 / 97% |
| turn-in, 63% of yaw rate at 100 km/h, keys | 0.28 / 0.32 / 0.28 / 0.33 s | 0.17 / 0.17 / 0.16 / 0.17 s |
| direction change at 100 km/h, keys | 0.42 / 0.46 / 0.42 / 0.47 s | 0.30 / 0.30 / 0.29 / 0.31 s |
| 115 km/h, full A for .55 s then countersteer: peak yaw rate / slide | 26 / 22 / 22 / 19 °/s, 3.3 / 2.3 / 2.8 / 2.2° | 36 / 36 / 34 / 33 °/s, 5.8 / 5.4 / 6.3 / 5.4° |
| lift at 150 km/h in a full-lock corner: slide before -> after | 3.9->5.4 / 3.0->4.0° | 3.7->8.9 / 3.8->7.5° (av12 / mustang) |
| trail braking from 150 km/h, full lock: peak slide | 3.5 / 3.1° | 6.8 / 7.9° |
| RWD Mustang, full lock + full throttle at 40 km/h: peak slide Casual / Sport / Pro | 2.3 / 3.2 / 3.8° | 2 / 10 / 13° (rain 2 / 6 / 35°; at 70 km/h in rain 3 / 12 / 15°) |
| handbrake turn at 60 km/h (.7 s): heading and speed at release | 60-63°, 49-51 km/h | 81-90°, 42-43 km/h |
| coast + full steer held at 120 km/h: peak slide (Sport / Casual) | 4-6° | 10-13° / 10-11° (caught, no spin in 4 s) |
| AI laps, 14 cars x dry/damp/rain | no spin, 7 cars run wide of the line in dry | no spin, none wide; dry 143.5-149.1 s (was 143.9-149.4) |
| 15 m, 30 m, 60 m arc, steady speed, keys vs the AI's own steering law | equal | equal (48 / 68 / 95 km/h) |

`node scripts/physics-turning.mjs --only steady,turnin,ice,lift,trail,rwd,handbrake,slalom,abuse,hairpin,assert [--cars ... --wx dry,damp,rain --tune '{"liftShift":0.1}']` prints every table and turns it into pass/fail (`bench` prints one line per car and tier). `--tune` overrides driving.json values for an experiment. `--only aids` checks the HUD values (quiet in a normal corner, ABS under a full brake with steering, ESC in a long slide on Casual).

## Measured

**Wet handling** (physics-harness, 3 contrasting cars; heavy AWD Continental, RWD V8 Blackbird, the since-removed EV Roadster; same on Pro). Skidpad = best lateral g held on a 50 m circle; AI = the AI driving a full lap with the player's assists (Pro with a human-style lift and countersteer).

| | dry | damp | rain |
|---|---|---|---|
| skidpad g, vs dry | 1.30 / 1.43 / 1.29 | 0.88 / 0.87 / 0.88 x | 0.81 / 0.80 / 0.81 x |
| 100-0 m, vs dry | 38.1 / 36.1 / 36.3 | 1.15 x | 1.25 x |
| full lap (Sport and Pro) | 151.6 / 147.1 / 147.4 s | +4% to +6% | +8% to +11% |
| spins, off-track | none | none | none |

Before the work, damp and rain were identical to dry in the physics. With the wet grip added but not the assist and AI fixes, the same AI laps at Sport assists spun 1-3 times per damp or rain lap. All 14 AI cars now complete a rain lap (+6% to +9%) with no spin and no run-off. The wet fix alone moved dry AI lap times by 0.1-0.9% (Continental 149.7 -> 149.2 s, Roadster 148.0 -> 147.6 s, on the old handling, before the specs rebalance).

**Driver mistakes** (Sport, flat world; hold full lock at 120 km/h on throttle, full lock then lift at 150, half lock plus full brake at 150, half lock plus full throttle at 80, flick then lift at 180): before, Sport spun on 3-4 of 5 in dry; now none spin on Sport in dry, damp or rain. On Pro (no traction control) the Blackbird (825 hp, RWD) still spins with half lock and full throttle at 80 km/h in rain, which is the point of Pro.

**AI laps of the 14 cars, dry**: 146.0-153.0 s, no respawn or rollover.

## Test harness

`scripts/physics-turning.mjs` (turning: grip used, turn-in, rotation tools, abuse, corner speeds) and `scripts/physics-braking.mjs` (brake + steer, reverse) are the permanent driving-feel checks; both take `--only ...,assert`.

`node scripts/physics-harness.mjs --tests pad,brake,lap,abuse,accel,table,balance,calibrate,upgrades,check --cars a,b --weather dry,damp,rain --assist sport,pro`. It loads src/physics through Vite's SSR loader (no browser); lap tests fetch the collision mesh from the dev server on :5180. `balance --write` and `calibrate --write` rewrite `bop`, `bopGrip` and `brakeK` in handling.json (rerun both after changing specs or character; `check` verifies handling.json mirrors specs.json).

## Tuning loop

From the viewer's console:
```js
const t = await import('/src/physics/testdrive.js'), f = viewer.field();
t.soloRun(f, 'av12', { seconds: 200, lapStop: true })        // { stats: { laps, respawns, offAt, maxKmh }, log }
await t.balance(f, { target: 150 })                         // per-car power, then grip; copy the result to handling.json
await t.skidpad(f.all[0].profile, 'av12', [[4, { throttle: 1 }], [0.6, { throttle: 1, steer: 1, handbrake: 1 }], [2, { throttle: 0.8 }]])
```

## Not done yet

- **Feel:** nobody has driven it by hand yet. The numbers come from AI laps and scripted inputs, so the steering and drift feel need a person on the keyboard or a pad.
- **Effects:** no damage, no tyre wear or fade, no standing water or aquaplaning; no painted-line grip (the lines are not in the collision mesh).
- **Powertrain:** no gearbox or shift gaps (the display gearbox lives in audio); an EV differs by throttle lag and traction only.
- **AI racecraft:** the AI drives the line well but doesn't race. It doesn't defend or choose lines.
- **Replays:** not built. The fixed step makes them possible (record the inputs).
