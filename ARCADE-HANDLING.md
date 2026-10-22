# Forgiving driving tune

The handling study uses the public researcher's [GTAVHandlingInfo notes](https://github.com/ikt32/GTAVHandlingInfo/blob/master/notes.json). Their descriptions distinguish peak/sliding traction, optimal slip angle, steering lock, axle distribution, rotational inertia, compression/rebound damping and anti-roll response. Those separations informed this implementation. GTA V's numeric handling values do not share our Rapier model's units and cannot be pasted in as equivalent physics.

The editable counterpart is [assets/cars/driving.json](assets/cars/driving.json): defaults plus five archetypes, assigned explicitly to all 14 cars. The profiles keep the existing mass, wheelbase, drivetrain, power and aero differences. Supercars, muscle, heavier tourers, electric cars and track cars have different steering response, inertia and axle balance. These are authored Ultrack values, not copied Rockstar data.

Changes in `src/physics/vehicle.js` and the pure `arcade.js` helpers:

- Grip is increased 6%; sliding tires retain a configurable fraction of peak grip (90–91% floor when far sideways in ordinary driving). Handbrake drift reduces that floor and rear grip deliberately.
- Steering lock follows the grip: the kinematic angle at the car's lateral limit (downforce counted correctly), plus an understeer allowance, times a margin that shrinks above 120km/h (2026-10-21; before, downforce was counted 9.81 times too strong and the keyboard took 30% more off). Actual yaw still comes from tire forces.
- Keyboard engagement (9/s, 6.3/s above 150km/h), direction changes (14/s) and centering (11/s) respond sooner, using frame-rate-independent smoothing. Analog steering retains its existing dead zone and response curve.
- Slightly lower centres of mass and larger rotational inertia reduce abrupt roll and snap rotation. Existing differences between cars remain.
- Compression and rebound have separate damping. Suspension force spikes and anti-roll forces are bounded to avoid catapulting a car when one wheel meets a kerb.
- A small lateral recovery assist opposes excessive sideways velocity on grippy roads with at least three grounded wheels. It scales with the selected assist preset and fades in only past the tier's spin angle (Casual 8°, Sport 13°, Pro 24°); the same gate fades in countersteer, the throttle cut, the stability damper and the catch moment, so none of them touches an ordinary cornering slide. It is disabled in handbrake/drift mode, in the air, on loose surfaces and at parking speeds. There is no added ground-suction force or scripted rotation toward the racing line.
- AWD front/rear power balance and throttle lag are configurable per archetype. The previous S/W brake-to-reverse behavior remains.

**2026-10-21 turning pass.** The tune above left the car unable to rotate (lift-off, trail braking, throttle and handbrake all gave a few degrees), with a lock that was too small at speed for low-downforce cars and a slow keyboard ramp. Changes: a flatter-falling, stiffer rear axle; pedal-driven grip shift between the axles; a friction circle that takes cornering before pull on an overloaded tyre; yaw inertia 0.85-0.98 (was 1.05-1.18), body yaw damping 0.12; the new lock; aids gated by slide angle. The table below was measured on the previous tune (damp, Sport, lift + full steer at 180km/h peaks 4-7°); now it is 12-14° and caught. Numbers, tiers and the test: track-viewer/PHYSICS.md, *Turning*; `node track-viewer/scripts/physics-turning.mjs`.

Validation used the same fixed-step Rapier physics and actual wheel profiles as the game. The existing harness's five steering-abuse scenarios retained its original input ramp for the before/after comparison, isolating chassis changes from the faster new keyboard smoothing.

| Damp / Sport scenario | Before | After |
|---|---:|---:|
| AV–12, 180km/h turn + lift, peak slide | 25° | 6° |
| AMG One, same maneuver | 17° | 7° |
| ST–6, same maneuver | 14° | 4° |
| AV–12, 100–0 braking | 40.9m | 38.3m |
| AMG One, 100–0 braking | 41.1m | 38.5m |

These are controlled scenarios, not exact GTA V reproduction or guarantees against spins. Wet roads remain less grippy than dry roads. A 6% grip increase deliberately changes previous real-spec braking calibration; the tune now prioritizes approachable racing.

Actual damp-circuit AI laps: AV–12 152.0s, AMG One 152.2s, ST–6 156.6s. All completed with zero spins, zero resets and zero steps beyond the harness's 8m racing-line distance threshold. These results do not establish multiplayer balance; the existing balance table was not rewritten.

`npm run test:arcade` checks all 14 cars in dry/damp/rain (42 scenarios), 180km/h steering/lift recovery, handbrake initiation and release, a one-sided 12cm kerb crossing and a landing. It also checks that recovery assists are off in air/loose terrain, bounded recovery force, and keyboard response independence from frame rate. The report is `track-viewer/qa/arcade/driving-report.json`. Existing pedal, traction, brake-lamp, input/lifecycle regressions and production build are also checked.
