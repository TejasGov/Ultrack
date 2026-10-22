# Tire grip correction

Normal brake input while steering previously entered the assisted drift state. That reduced rear grip, engaged a yaw controller targeting a sideways attitude, and could sustain the slide after releasing the brake. Ordinary trail braking now keeps the normal tire model; intentional drifting requires Space / gamepad A (handbrake). The controls help text matches this behavior.

The lateral tire curve now builds force sooner, peaking at about 8 degrees rather than 12. Cars need less sideways motion to generate cornering force. Peak friction, braking calibration, surface differences, upgrades and rain grip loss remain in effect. This does not glue airborne cars to the ground or make every corner possible at full speed.

Validation: `npm run test:traction` runs real Rapier simulation for AV–12, AMG One, ST–6 and Roadster-X in dry/damp/rain. It checks trail braking, release, recovery and intentional handbrake drift. The regression reproduced unintended drift before the fix and passes afterward.

Existing physics harness, Sport assist, damp road, held full steering at 120 km/h / 60% throttle for 3.5 seconds:

| Car | Before peak slide angle | After |
|---|---:|---:|
| AV–12 | 12° | 7° |
| Mercedes-AMG One | 13° | 8° |
| ST–6 | 11° | 6° |

Skidpad and 100–0 braking results stayed approximately unchanged (AMG One dry: 1.48g → 1.47g; braking 36.1m → 36.1m). These are fixed simulation scenarios, not a guarantee against sliding with extreme inputs.

Three AI laps on the actual damp circuit completed with no spins or resets: AV–12 154.7s, AMG One 154.9s, ST–6 159.5s. ST–6 recorded 18 physics steps beyond the harness's 8m line-distance threshold; no claim of a perfectly clean line. Production build passed.
