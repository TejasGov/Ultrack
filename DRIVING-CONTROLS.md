# Brake and reverse controls

Research: the official [GTA V game help](https://dlassets-ssl.xboxlive.com/public/content/4f0a3089-ba2c-4f3d-9e38-102a41cbd885/GameManual/bffef18e-3f19-4190-a9b1-75402359b13b/en-US/index.html) documents a combined brake/reverse control with reverse when stopped. This is the interaction reference, not a claim to reproduce Rockstar's proprietary tire or transmission code. Our timing, force and speed values below are game tuning decisions.

The old implementation let throttle and residual engine torque fight S braking. It also switched into reverse while still rolling forward below 1.5m/s, imposed a 50% input threshold that excluded light trigger input, allowed unlimited reverse acceleration and failed to treat W as the brake while reversing.

`src/physics/pedals.js` resolves inputs before drivetrain and tire forces:

- S / down / left trigger: service brake going forward; hold through a near stop to reverse.
- W / up / right trigger: service brake while reversing; drive forward after the stop.
- Both pedals: braking takes priority. No unintended forward power or reverse launch.
- Direction changes wait for forward speed below 0.35m/s and lateral speed below 1m/s for 0.12 seconds. A sideways slide is not a stationary car.
- Reverse drive tapers near 40km/h, with braking above that speed. This is an Ultrack limit, not a sourced GTA limit.
- Grid hold cannot engage reverse. Respawn resets direction and pedal history.
- Space / gamepad A remains deliberate handbrake/drift. Ordinary S braking never engages assisted drifting.

Resolved service braking immediately cuts engine torque and drives stop lamps. Reverse state drives white reversing lamps and the displayed gearbox. Engine audio follows actual requested drive, including S-powered reverse, rather than raw W alone. Parking/grid placement clears reverse lamps.

Tests: `npm run test:pedals` runs input boundary checks and Rapier driving for AV–12, AMG One, ST–6 and 911–T, each on dry/damp/rain. Covers W+S stopping from 100km/h, continuing S into bounded reverse, W braking reverse then accelerating forward, partial trigger input, grid hold, sideways motion and reset. Traction, brake-lamp and existing input/lifecycle regressions also pass. Three damp-track AI laps completed without spins or resets; no handling balance data was rewritten.
## Braking, steering and reverse (2026-10-21, research/driving-model.md)
- **Steering-reserving ABS** (`vehicle.js`, `absKeep`): each wheel's brake is capped at `sqrt(cap^2 - (keep*Fy)^2)`. The rear keeps Casual 1 / Sport .94 / Pro .85 of its lateral grip (`assist.absSteerRear`, else from `assist.tcs`), so a Sport or Pro rear can let go on the brakes; the front keeps Casual .86 / Sport .79 / Pro .4 (`assist.absSteer`, else from `assist.tcs`). Straight-line braking is unchanged (Fy = 0).
- **Brake bias follows steering** (`biasShift`, `assist.brakeBias` else from `tcs`): up to 5 points of share move front and 20 off the rear with the wheel turned; Casual 1, Sport .2, Pro 0.
- **Stability**: the yaw demand is capped at `1.15 * grip / v` (what the tyres can turn); still one-sided, gain `assist.stability`.
- **Reverse**: only after a 0.35 s standstill (`REVERSE_DWELL`, pedals.js); while backing up below 52 km/h beta, countersteer, TCS fade and slide recovery see nothing, and the lock is limited to about .45 g (`reverseLock`, arcade.js).
- **Keyboard**: brake rises in .12 s, releases in .06 s (`keyboardBrake`); steer ramp-in is 9/s, slowing to 6.3/s above ~150 km/h, and the lock scales to .88 from ~250 km/h (`steerScale`, also applied to the pad stick, which has no ramp; see *Steering* below). `PlayerInput.read(dt, speed)` takes the speed; without it, `Vehicle.step` supplies it through `driving.speed` (controls flag `player`).
- Checks: `node scripts/physics-braking.mjs` (add `--only unit,table,reverse,ice,trail,slalom,assert`).

## Steering (2026-10-21)

Keyboard A/D winds the wheel in at 9/s (6.3/s above 150km/h), reverses at 14/s and returns to centre at 11/s; the lock is the angle that holds the car at its grip limit at that speed (about 7.4° at 100km/h, 3.5° at 200km/h on the AV-12), so full steer uses 96-100% of the tyres at every speed. Pads scale the stick by the same lock (and 12% less at 250km/h). The driving aids do nothing in a normal corner and fade in only once the car is sliding past the tier's angle (Casual 8°, Sport 13°, Pro 24°). Check: `node track-viewer/scripts/physics-turning.mjs --only ...,assert`.
