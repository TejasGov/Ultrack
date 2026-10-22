# Driving model: brake + steer, brake → reverse (research and proposal)

Status: research only, no game files changed. Date 2026-10-21.
Measured with the real `Vehicle` (Rapier, 120 Hz, flat world) through throwaway scripts outside the repo, driven by the
game's own `keyboardSteer` ramp, so the inputs match what a keyboard player sends. AV-12 (supercar archetype) unless noted,
Sport assists, dry (`wet` 0.15) unless noted. Mustang (muscle) was checked for the prototype sweep.

## 1. What happens today

### Pipeline for S/↓ + A/D
1. `player-controls.js keyboardSteer`: digital steer ramps in (rate 6/s, 10/s on reversal, 11/s to centre). S is a
   digital 0/1 with **no ramp**.
2. `pedals.js resolvePedals`: S is the service brake while moving forward; when forward speed < 0.35 m/s and lateral
   < 1 m/s for **0.12 s**, S becomes reverse drive (−0.25 g, tapering at 40 km/h). W brakes while reversing.
3. `vehicle.js step`: steer lock = `steeringLock()` (35° parking, ~4° at 120 km/h, ~2.4° at 200 km/h); countersteer
   assist past 4° of body slip β; per wheel the brake asks for `brake × 0.95 (front) / 0.75 (rear) × brakeK × cap`, where
   `cap = μ × load` (load includes the forward weight transfer from the suspension). Then a **proportional friction
   circle**: if `hypot(Fx, Fy) > cap`, both are scaled by the same factor.
4. Traction control (drive only) already gives cornering priority: drive gets `sqrt(cap² − Fy²)`, what's left of the
   circle. **Brakes have no equivalent.** That asymmetry is the main cause of the complaint.
5. Stability assist (one-sided yaw damper above `v·tanδ/L`), lateral recovery assist and drift controller are not
   involved in ordinary braking (drift needs the handbrake, which is correct and tested by `test:traction`).

### Measured: full S + full A from speed (keyboard)

| from | heading change by the stop | yaw rate while braking | no-slip yaw rate for the wheel angle | lateral g | front tyres saturated | stop distance |
|---|---:|---:|---:|---:|---:|---:|
| 60 km/h | 26° | 17–26 °/s | 59–105 °/s | 0.10–0.53 | 100% of samples | 12.8 m |
| 120 km/h | 52° | 16–23 °/s | 35–111 °/s | 0.28–1.14 | 100% | 51.4 m |
| 200 km/h | 76° | 9–21 °/s | 30–110 °/s | 0.39–1.65 | 100% | 135.5 m |

Coasting with the same steering from 60 km/h: 45 °/s and 1.05–1.27 g, i.e. **pressing S cuts the turn to a fifth to
a half.** At 21 km/h, wheels at 33°, braking: 17 °/s and 0.18 g, the car ploughs almost straight. The front wheels ask
for 95% (× brakeK 1.07 for AV-12, i.e. > 100%) of their grip for braking, so the proportional circle leaves them ~30%
for steering, while the rear keeps more. That is the "S + A/D doesn't turn like a real car" feel. Real cars with ABS
keep substantial steering under full braking; GT7's ABS (Default) explicitly reserves part of the grip for steering.

### Measured: holding S + A through the stop (brake → reverse)
From 60 km/h: stops at 1.51 s, **reverse engages at 1.93 s** (0.42 s later) while A is still held, so the car now
rotates the other way. Total heading change in 6 s: 166°, the car ends up reversing in a donut. From 30 km/h: stop 0.76 s,
reverse 1.18 s. Reversing at full lock reaches −24 km/h, 1.2 g, yaw −95 °/s against a no-slip −81 °/s (rear end, now
leading, sliding). Above 6 m/s backwards `st.beta` reads 20–24° (it is computed for forward motion), so the forward-only
**countersteer assist fires in reverse** and unwinds the wheel from 34.4° to 29.4°, and the recovery assist also acts.

### Measured: trail braking (160 km/h, 1 s straight braking, then ease the brake 1 → 0 over 1 s while steering, then 30% throttle)

| | Casual | Sport | Pro |
|---|---:|---:|---:|
| dry heading / peak β / peak lat g | 64° / 4.4° / 1.41 | 63° / 4.4° / 1.41 | 63° / 4.4° / 1.41 |
| rain | 47° / 5.6° / 1.32 | 47° / 5.6° / 1.32 | 46° / 5.6° / 1.32 |

Stable, no spin, no unwanted drift. But **the three assist tiers are indistinguishable** in this manoeuvre: the assists
only exist for drive (TCS) and for oversteer, not for brake-steer.

### The "ice" case is fixed (don't regress it)
Lift + full steer at 120 km/h: peak β 6.2° dry / 7.1° rain, lateral 1.70 g / 1.50 g; L-R flick 6.1° / 6.7°; throttle +
full steer 3.8° / 4.2°. The previous ice feel (25° slides) is gone; the remaining problems are braking and reverse.

### Other observations
- Keyboard S is binary: every keyboard brake is a 100% stamp, so every brake-plus-steer saturates the fronts. A pad's
  analog trigger can trail brake at 40–60% and turns fine; keyboard players can't.
- Lateral grip is generous (1.7 g at 120 km/h, 2.3 g at 200 km/h with downforce). This is an arcade choice. It's fine,
  but it makes the braking plough stand out more.

## 2. How shipped games handle it

- **Gran Turismo 7: ABS that reserves grip for steering.** The official manual's ABS *Default* setting controls brake
  force on all four wheels and reserves part of the tyres' grip for steering. *Weak* removes that reservation for skilled
  drivers, and *Off* disables ABS. Separate Countersteering Assistance (Weak/Strong) and ASM (stability, costs speed)
  cover oversteer. Update 1.31 rebalanced them: less countersteer intervention, more ASM, and better stability under full
  braking. This is the closest match to our problem.
  [GT7 manual, driving options](https://www.gran-turismo.com/us/gt7/manual/drivingoption/03),
  [GT7 Update 1.31 physics/assist notice](https://www.gran-turismo.com/us/gt7/news/00_1462138.html)
- **Forza Motorsport / Horizon: assists as tiers.** ABS prevents lock-up. Stability control brakes individual wheels at
  the onset of oversteer. TCS brakes the spinning wheel and cuts power; its Sport mode allows more slip. Steering has
  Assisted (the game can steer and brake for you), Normal (filtered) and Simulation modes. Horizon exposes
  Braking/Steering/TCS/STM as Assisted/On/Off.
  [Forza Motorsport accessibility/assists](https://support.forza.net/hc/en-us/articles/20964254277267-Forza-Motorsport-Accessibility-Support),
  [FH3 FAQ](https://forums.forza.net/t/forza-horizon-3-game-guide-faq/36955/27)
- **Need for Speed (Criterion / Ghost): physics core plus assist layers, with brake-to-drift as an explicit mode.**
  Criterion's GDC masterclass (Matt Harris) argues for "a solid physical simulation with a whole lot of goodness on top"
  (assists and camera). Ghost described brake-to-drift as a side effect of the drift system. It made drifting the
  fastest way round every corner, so Heat added a grip/drift tune: front brake bias shifts weight forward, the rear lets
  go and the car slides. Lesson: in a grip racer, the brake must *not* start drifts. Keep drift on the handbrake, as we
  already do.
  [GDC Vault: Vehicle Feel Masterclass](https://gdcvault.com/play/1025295/Vehicle-Feel-Masterclass-Balancing-Arcade),
  [Ghost on Heat handling (GTPlanet, secondhand)](https://www.gtplanet.net/forum/threads/need-for-speed-heat-general-discussion.381038/post-12858637)
- **Asphalt 8/9/Legends: brake = drift.** The brake/left trigger is "brake/drift": a tap with steer starts a scripted
  drift, and a double-tap triggers a shockwave/360. Pure arcade, with no reverse semantics worth copying. It is the
  opposite of what the user asked for ("real physics behaviour in how the car turns").
  [Asphalt 9 controls](https://racinggames.gg/article/how-to-drift-in-asphalt-9-legends)
- **F1 24/25: tiered braking aids.** ABS (no lock-ups, slower, recommended on pad), and Braking Assist / Steering Assist
  that take over the task for novices. Their tiers *remove* work from the player instead of changing the tyre.
  [F1 25 assists guide](https://simracingsetup.com/ea-sports-f1/f1-25-assists-guide/)
- **GTA V: brake/reverse on one control, reverse when stopped.** Its handling.meta separates peak vs sliding traction,
  the slip angle of the peak (`fTractionCurveLateral`, in degrees), and `fBrakeBiasFront` (0..1). Our `driving.json`
  already follows that separation.
  [GTA V handling glossary](https://gtacars.net/gta5/glossary),
  [ikt32 GTAVHandlingInfo](https://github.com/ikt32/GTAVHandlingInfo/blob/master/notes.json)
- **Assetto Corsa / ACC: input shaping.** Speed sensitivity (less lock at speed), a steering filter/speed (how fast the
  wheel travels lock to lock) and gamma (centre precision) are the tools for pads and keyboards. We have the first two;
  the brake has none.
  [AC controller settings](https://simracingsetup.com/assetto-corsa/assetto-corsa-controller-settings/),
  [ACC controller settings](https://coachdaveacademy.com/tutorials/ultimate-assetto-corsa-competizione-controller-settings)
- **Physics background.** Beckman, *The Physics of Racing*: weight transfer (Part 1/2: 1 g braking moves 20% of the
  weight forward) and the traction circle/"traction budget" (Part 7: braking and cornering share one budget, and the
  driver chooses how to spend it). Marco Monster, *Car Physics for Games*: handles longitudinal and lateral forces
  separately, with slip-angle lateral force. Edy's Vehicle Physics: ABS limits brake power, TC limits motor power, and ESP
  limits the steering angle with speed. Unreal Chaos: `steering_curve`, maximum steering vs speed.
  [Beckman Part 1](https://gamedev.net/tutorials/programming/math-and-physics/the-physics-of-racing-part-1-weight-transfer-r1610),
  [Beckman Part 7](https://miata.net/sport/Physics/07-Circle.html),
  [Car Physics for Games](https://www.asawicki.info/Mirror/Car%20Physics%20for%20Games/Car%20Physics%20for%20Games.html),
  [Edy's Vehicle Physics README](https://vehiclephysics.repositoryhosting.com/trac/vehiclephysics_edys-vehicle-physics/wiki/README?version=3),
  [Chaos FVehicleSteeringConfig](https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/ChaosVehicles/FVehicleSteeringConfig)

### Lessons that apply to Ultrack
1. **Keyboard brake needs the game to modulate it** (GT7 ABS Default): when the player steers, the ABS leaves lateral
   grip for the front wheels, and more for the rear. The tier decides how much (GT7 Default vs Weak).
2. **Rear lateral grip gets the priority under braking** (stability). Every arcade-sim keeps the rear planted on the
   brakes and starts drifts only with an explicit control (handbrake, or NFS's drift tune).
3. **Brake ≠ drift in a grip racer** (Ghost's own diagnosis). We already do this; keep it.
4. **Reverse is deliberate**: one control for brake and reverse (GTA/Forza), but only after a real stop, and the
   forward-driving assists switch off while reversing.
5. **Assist tiers should differ where players feel them**: brake-steer reservation, countersteer and stability, as in
   GT7 and Forza, not only TCS.

## 3. Prototype measurements (scratch copy of vehicle.js, one line changed)

Brake line changed to "cornering-priority ABS": `brake ≤ sqrt(cap² − (keep·Fy)²)`, with `keep` per axle.

| front keep / rear keep | 60 → stop: heading, dist | 120 → stop | 200 → stop | 200: peak β | 100-0 straight |
|---|---|---|---|---:|---:|
| 0 / 0 (today) | 26°, 12.8 m | 52°, 51.4 m | 76°, 135.5 m | 7.2° | 40.3 m |
| 0 / 1 | 26°, 12.8 m | 53°, 51.5 m | 76°, 136.8 m | **3.9°** | 40.3 m |
| 0.5 / 1 | 32°, 13.1 m | 63°, 53.3 m | 90°, 143.6 m | 4.4° | 40.3 m |
| **0.7 / 1** | **39°, 13.4 m** | **75°, 56.0 m** | **107°, 153.5 m** | 5.0° | 40.3 m |
| 1 / 1 | 70°, 16.3 m | 153°, 85.6 m | doesn't stop | 9.6° (rain 37°) | 40.3 m |
| 0.6 / 0.6 (same keep on all four wheels) | 35° | 61° | **spins (β 85°)** | 85° | 40.3 m |

Rain, 0.7/1: 38° / 73° / 104°, peak β ≤ 5.1°, no spin. A braking flick at 160 km/h on Pro: peak β 4.3°, heading back to
−3°. Mustang, 0.7/1: 42°/79°/110° vs 36°/67°/93° today, β ≤ 5.5°. Straight-line braking is unchanged in every case,
because `Fy = 0`.

Takeaways: the same keep on all four wheels **is dangerous** (0.6/0.6 spun at 200 km/h, because the front gained lateral
grip while the rear was still braking). The rear must keep its lateral grip first. Full reservation (1/1) gives up too
much braking. Front 0.5–0.85 with rear 1 is the useful range, and it maps naturally onto the assist tiers.

## 4. Options

### Option A: minimal fix (≈ 10 lines, `vehicle.js` + `pedals.js` + `store.js`)
- **Cornering-priority ABS**: in the brake line, cap each wheel's brake force at `sqrt(cap² − (keep·Fy)²)`. Rear keep 1
  always; front keep from the tier: Casual 0.85, Sport 0.7, Pro 0.4 (`ASSISTS.*.absSteer`, passed in `assist` like `tcs`).
  AI uses Casual's value.
- **Reverse dwell**: `stopped` needs 0.35 s at standstill instead of 0.12 s (`pedals.js`). Optional: if steer was held
  through the stop, require S to be released and pressed again.
- **No forward assists in reverse**: `st.beta = 0` when `vF < 0` (countersteer, TCS fade and recovery read β).
- Feel: low speed, S+A turns at ~1.5× today's rate (60 km/h: 26° → 39° by the stop), and the stop still reads as the
  brake. Mid and high speed: the car tightens its line under braking instead of ploughing, with 0.6 m / 4.6 m / 18 m more
  stopping distance when steering at full lock, and an identical 100-0 in a straight line. Rear stays planted: peak β
  under braking at 200 km/h drops from 7.2° to ~5°. At a standstill the car holds still for a beat before reversing, and
  reversing turns predictably.
- Risks: braking zones with steering get a little longer, so AI braking points may need a small margin (re-run
  `testdrive balance`). It can't spin by construction only while the rear keep stays 1. Rain unaffected in the sweep.
- Tests: extend `test:traction`/`test:pedals` with heading-at-stop ≥ 35° from 60 km/h (Sport, dry and rain), 100-0
  unchanged ±0.5 m, peak β < 8° braking from 200 km/h at full lock (all 14 cars × dry/damp/rain), reverse engages
  ≥ 0.35 s after the stop, and no countersteer (`steer == steerInput`) while reversing.

### Option B (recommended): A + keyboard brake shaping + a proper yaw-target stability layer
Everything in A, plus:
- **Keyboard brake ramp**: digital S rises 0 → 1 in ~0.12 s and falls in ~0.06 s (`PlayerInput.read`, the same
  frame-rate-independent filter as `keyboardSteer`). Smoother weight transfer onto the nose and less pitch spike; pad
  triggers stay analog and untouched.
- **Speed-dependent keyboard steer rate**: today the ramp is 6/s at any speed; above ~120 km/h ramp in at ~4/s and keep
  the fast 11/s return (AC's "steering speed" / Chaos `steering_curve`). The lock is already speed-sensitive.
- **Yaw-rate target stability (two-sided, grip-limited)**: replace the one-sided damper with a target
  `r* = sign(δ)·min(|v·tanδ/L|, μ_eff·g/|v|)`, damping only *above* `r*` as today, plus (Casual/Sport only) a small
  torque assist *toward* r* when the car ploughs under braking. GT7 splits Countersteering vs ASM the same way. Tier
  gains: Casual 1.5, Sport 1, Pro 0.35 (today's `stability`), so the tiers finally differ in trail braking.
- **Brake bias follows steer** (electronic brake-force distribution / cornering brake control): with steer, move bias
  forward (rear 0.75 → ~0.55 of cap) so the rear stays planted without relying only on the circle. Pro keeps the fixed
  bias, so trail-brake rotation is available to experts.
- Feel: keyboard players get gentle trail braking for free; S + A/D at 60–120 km/h turns like a road car with ABS,
  tightening as speed drops; Pro keeps more rotation and more risk. Gamepad behaviour changes only through the physics
  layers (A, the yaw target), not the input layer.
- Risks: the yaw-toward-target torque is "fake" force. Keep it ≤ 0.15 g-equivalent and zero above 4° of β, or it reads
  as the car being steered for you (the "on rails" complaint). It needs the full `test:arcade` matrix (42 scenarios), AI
  laps, and the rain set re-run.
- Metrics (add to the harness): heading at stop from 60/120/200 km/h per tier; yaw-rate ratio `r / r_kinematic` under
  braking (today 0.2–0.4, target 0.6–0.8 Sport); peak β under braking (≤ 6° Casual/Sport); Casual/Sport/Pro must differ
  by ≥ 5° heading in the trail-brake test; a keyboard brake-ramp frame-rate independence check; rain β within today's
  +1°.

### Option C: proper rework (combined-slip tyre + real ABS/ESC)
- Give wheels a spin degree of freedom (ω), compute the slip ratio κ, and use a combined-slip tyre (Pacejka combined, or
  a friction ellipse along the slip *vector* rather than proportional scaling). ABS becomes a controller holding
  κ ≈ 0.1–0.15, where lateral force naturally survives; ESC brakes individual wheels; TCS acts on ω.
- Feel: the most "real". Trail braking, lift-off and lock-ups emerge on their own, with assists like Forza's.
- Risks: large. Every calibration (100-0 brakeK, skidpad, AI `vt` profile, BOP laps, wet curve, recovery assist) has to
  be redone; it needs a stiffer sub-step for ω at 120 Hz, with jitter at low speed (the classic Monster-tutorial
  problem); weeks, not days. Only worth it if Ultrack wants to move toward a sim.

### Recommendation
**Option B, shipped in two steps.** Step 1 is Option A (one line of ABS reservation, reverse dwell, no forward assists
in reverse): small, measured above, and it fixes the user's two concrete complaints. Step 2 adds the keyboard brake ramp
and the yaw-target stability tiers, with the new harness metrics. Skip C unless the game's direction changes. Keep drift
on Space only (Ghost's brake-to-drift lesson) and leave the lateral tyre curve alone: the ice fix holds (β ≤ 7° in
rain).

## Appendix: reproducing
The scripts were written to the session scratchpad (not the repo): `brake-steer.mjs` (baseline scenarios: brake+steer,
trail, reverse, ice) and `brake-steer-proto.mjs` + `vehicle-proto.js` (vehicle.js with the brake line parameterised by
`globalThis.PROTO = { keepF, keepR, revBeta }`). Run from `track-viewer/`: `ONLY=brake|trail|reverse|ice|axle CAR=av12
node <script>`. They load the game modules through Vite SSR, the same way `test-traction.mjs` does.
