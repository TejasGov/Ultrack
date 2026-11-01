# Car QA: ford-gt

2026-11-01T19:46:47.621Z

8 pass, 2 warn, 1 fail, 1 review, 1 info

| | Check | Measured | Expected | Fix |
|---|---|---|---|---|
| PASS | No see-through gaps (every part in place) | 0 gaps ≥ 20 cm², 0 of 5-20 cm², 11 waived (daylight through the flying-buttress tunnel, open on the real car (traced: trace-front-0.png); daylight through the flying-buttress tunnel, open on the real car (traced: trace-front-1.png); daylight through the flying-buttress tunnel, open on the real car (traced: trace-rear-2.png); daylight through the flying-buttress tunnel, open on the real car (traced: trace-rear-3.png); daylight under the wing, between its struts (traced: trace-front-left-4.png); daylight through the flying-buttress tunnel, open on the real car (traced: trace-rear-left-6.png); daylight through the flying-buttress tunnel, open on the real car (traced: trace-rear-right-9.png); over the rear deck and out through the side window (traced: trace-rear-right-10.png)) | none | automatic interior fills (carkit/interior.js: floor, keel, bays, bulkheads, arch liners, cabin); trace a gap that survives them (masks.png, then a magenta-background render) and add a fill or a tuning.glass scale |
| WARN | Glass fills the window openings (advisory) | 0% of opening pixels covered | ≥ 90% | car-lab profile glass polygons (read-only) or tuning.glass { push, offset } here |
| WARN | Tyres sit in the arches: a visible gap, no clipping, flush with the body | front: clear 0.039 top 0.059 poke 0.348; front: clear 0.036 top 0.058 poke 0.338; rear: clear 0.01 top 0.057 poke 0.346; rear: clear 0.011 top 0.057 poke 0.354 | clearance ≥ 0 (lip overlap under 2 cm warns), top gap 1.2-12 cm, poke -10..+4 cm | tuning.suspension { ride } raises the body off the wheels (m); arch lips that dip into the tyre need a shell fix |
| PASS | Glass sits in the openings, not on top of the paint or under it | floating 1%, buried 28%, over openings 1% | floating ≤ 5%, buried ≤ 30% | tuning.glass { push } (m, along the pane normal) |
| PASS | Exhaust and nitro points sit on the rear surface with a clear exit | 2 points, 0 off the body or blocked, asymmetry 0 m | on the surface (−4..+8 cm), unblocked, mirror-symmetric | assets/cars/exhaust.json tips [y, z] (and up for top exits); ?debug=exhaust shows them |
| PASS | Side mirrors: real-style housings, both sides, symmetric, on short arms | the model's own, asymmetry 0.001 m, housing gap 0.122 / 0.122 m | tuned style, asymmetry ≤ 2 cm, gap 1.5-32 cm | tuning.mirrors { style: blade|gt|bullet, scale, offset, housing } |
| FAIL | Tail lamps: red but unlit off the brake, bright and blooming on it | area 10000 cm2; dusk b0: undefined, dusk b1: undefined, night b0: undefined, night b1: undefined | off: lum < 125, red; on: ≥ 90 and ≥ off + 40 (saturated red has low luminance; glossy lenses mirror the sky when off) | carkit/lamps.js (levels are shared; area-normalised); tuning.lamps only for a real exception |
| REVIEW | Premium look against the reference (judged by eye: look.png, reference.png) | - | as good as the Endurance garage frames | finishes.json (paint), tuning.mirrors, lamps; geometry limits need a better source model |
| PASS | Body dips under braking (1 g) | 0.85° | 0.8-3.2° | tuning.suspension { pitch, freq, damping } |
| PASS | Body rolls in a corner | 1.97° | 0.6-3.5° | tuning.suspension { roll } |
| PASS | Tyres stay clear of the arches with the nose down | 0.018 m | ≥ 0 | tuning.suspension { pitch } lower, or { ride } higher |
| INFO | Active aero (none set for this car) | - | only for cars that have it | tuning.aero |
| PASS | Exhaust smoke, pops, nitro flames and drift smoke all show | idle smoke 17, pop fire 15, nitro fire 52, drift smoke 410 | all > 0 (drift > 20) | exhaust.json points; carkit/fx.js rates |

Sheets: look.png, reference.png, masks.png, lamps.png, drive.png (this folder).
