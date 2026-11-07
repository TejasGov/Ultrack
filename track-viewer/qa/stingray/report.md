# Car QA: stingray

2026-11-07T19:40:54.551Z

9 pass, 2 warn, 0 fail, 1 review, 1 info

| | Check | Measured | Expected | Fix |
|---|---|---|---|---|
| PASS | No see-through gaps (every part in place) | 0 gaps ≥ 20 cm², 0 of 5-20 cm², 5 waived (daylight under the rear spoiler, which stands off the deck lid on short posts: open on the real car (traced: trace-left-0.png); daylight under the rear spoiler, which stands off the deck lid on short posts: open on the real car (traced: trace-right-1.png); daylight under the rear spoiler, which stands off the deck lid on short posts: open on the real car (traced: trace-front-left-2.png); daylight under the rear spoiler, which stands off the deck lid on short posts: open on the real car (traced: trace-front-right-3.png); daylight under the rear spoiler, which stands off the deck lid on short posts: open on the real car (traced: trace-low-left-4.png)) | none | automatic interior fills (carkit/interior.js: floor, keel, bays, bulkheads, arch liners, cabin); trace a gap that survives them (masks.png, then a magenta-background render) and add a fill or a tuning.glass scale |
| WARN | Glass fills the window openings (advisory) | 0% of opening pixels covered | ≥ 90% | car-lab profile glass polygons (read-only) or tuning.glass { push, offset } here |
| WARN | Tyres sit in the arches: a visible gap, no clipping, flush with the body | front: clear 0.039 top 0.042 poke 0.22; front: clear 0.039 top 0.042 poke 0.22; rear: clear 0.016 top 0.016 poke -0.013; rear: clear 0.015 top 0.015 poke -0.013 | clearance ≥ 0 (lip overlap under 2 cm warns), top gap 1.2-12 cm, poke -10..+4 cm | tuning.suspension { ride } raises the body off the wheels (m); arch lips that dip into the tyre need a shell fix |
| PASS | Glass sits in the openings, not on top of the paint or under it | floating 2%, buried 13%, over openings 1% | floating ≤ 5%, buried ≤ 30% | tuning.glass { push } (m, along the pane normal) |
| PASS | Exhaust and nitro points sit on the rear surface with a clear exit | 4 points, 0 off the body or blocked, asymmetry 0 m | on the surface (−4..+8 cm), unblocked, mirror-symmetric | assets/cars/exhaust.json tips [y, z] (and up for top exits); ?debug=exhaust shows them |
| PASS | Side mirrors: real-style housings, both sides, symmetric, on short arms | the model's own, asymmetry 0 m, housing gap -0.059 / -0.059 m | tuned style, asymmetry ≤ 2 cm, gap 1.5-32 cm | tuning.mirrors { style: blade|gt|bullet, scale, offset, housing } |
| PASS | Tail lamps: red but unlit off the brake, bright and blooming on it | area 101 cm2; dusk b0: 42.5, dusk b1: 133, night b0: 34.4, night b1: 164.8 | off: lum < 125, red; on: ≥ 90 and ≥ off + 40 (saturated red has low luminance; glossy lenses mirror the sky when off) | carkit/lamps.js (levels are shared; area-normalised); tuning.lamps only for a real exception |
| REVIEW | Premium look against the reference (judged by eye: look.png, reference.png) | - | as good as the Endurance garage frames | finishes.json (paint), tuning.mirrors, lamps; geometry limits need a better source model |
| PASS | Body dips under braking (1 g) | 1.07° | 0.8-3.2° | tuning.suspension { pitch, freq, damping } |
| PASS | Body rolls in a corner | 1.97° | 0.6-3.5° | tuning.suspension { roll } |
| PASS | Tyres stay clear of the arches with the nose down | 0.021 m | ≥ 0 | tuning.suspension { pitch } lower, or { ride } higher |
| INFO | Active aero (none set for this car) | - | only for cars that have it | tuning.aero |
| PASS | Exhaust smoke, pops, nitro flames and drift smoke all show | idle smoke 31, pop fire 16, nitro fire 52, drift smoke 414 | all > 0 (drift > 20) | exhaust.json points; carkit/fx.js rates |

Sheets: look.png, reference.png, masks.png, lamps.png, drive.png (this folder).
