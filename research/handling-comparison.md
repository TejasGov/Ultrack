# Handling, frame by frame: Endurance vs Ultrack (2026-10-22)

Both games were played with the same scripted keys, recorded every frame, with Ultrack's live telemetry alongside.
- Endurance: a McLaren GT3 in Free Drive, in rain.
- Ultrack: the Aventador (av12) in Free Drive, dry, on the Sport assist.
- Sheets are in `research/endurance/cmp/`: `e1/u1` straight-line taps, `e2/u2` brake then turn, `e3/u3` handbrake turn, `e0/u0` a straight run. Each tile is labelled with time, keys held and, for Ultrack, speed, yaw rate (°/s), slip angle (°) and road-wheel steer (°).
- Tools: `track-viewer/qa/cmp/rec.mjs` records a scenario (`<e|u> <scenario> [headed]`) and `sheet.mjs` builds the labelled sheet.

## 1. A 250 ms tap of A or D on the straight (130-160 km/h)

| | Endurance | Ultrack |
|---|---|---|
| What happens | a small clean heading change; the body stays lined up with its path | the car keeps yawing about 0.3 s after the key is released (yaw peaks after key-up) |
| Slip angle | none visible | -3.6° after the D tap; 11° and still growing 1 s after the A tap |
| Feel | a lane change | "slides in that direction while going straight" |

**Why:**
- The keyboard release ramp keeps the wheel turned for about 250 ms after key-up.
- The rear axle (grip 1.00, same as the front) yields as soon as the car yaws, and nothing pulls the body back in line with its path.

## 2. Brake from about 205 km/h, then hold D through the corner

| | Endurance | Ultrack |
|---|---|---|
| Braking | 206 → 118 km/h in 1.2 s, in rain (about 2 g) | 207 → 144 km/h in 1.5 s, dry (about 1.2 g) |
| Holding D at 120-140 km/h | steady, strong rotation of about 60 °/s, speed held, no slip: about 3 g of cornering | yaw swings 24 → 19 → 11 → 11 → 20 → 11 °/s at a fixed 8.3° of steer; the car runs wide into the wall |

**Why:**
- **Grip:** Endurance's cornering grip is arcade, 2-3× a real tyre. Ultrack's is a real tyre's (about 1.2-1.4 g).
- **Lock:** full keyboard lock is now 2× the slip angle where the front tyre peaks. Holding D drives the front tyres past their peak, so they make *less* force, and the force swings as load moves. That is the "won't even turn" and the irregular yaw.

## 3. Handbrake into the corner at about 160 km/h

| | Endurance | Ultrack |
|---|---|---|
| Drift angle | builds smoothly to 45-60° and is held there | 12° → 42° → 72° in 0.5 s |
| Path | **keeps curving round the corner** while drifting; speed 152 → 143 | **goes straight, sideways**: yaw rate near 0 at 40° slip, speed held at 145 |
| Steering | follows the player | the countersteer assist puts the wheel at **+34° (full opposite lock) while D is held** |
| After the wall | recovers and drives on | the page **froze for about 1 s** (telemetry and the lap timer stopped) |

**Why:**
- In a slide the tyres are at sliding friction, so the side force is small and the velocity vector hardly rotates.
- Endurance keeps rotating the velocity toward where the car points; Ultrack doesn't.
- The "past 40° go to full opposite lock" assist overrides the player.
