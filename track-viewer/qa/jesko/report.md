# Car QA: jesko

2026-11-07T07:18:02.287Z

9 pass, 2 warn, 0 fail, 1 review, 1 info

| | Check | Measured | Expected | Fix |
|---|---|---|---|---|
| PASS | No see-through gaps (every part in place) | 0 gaps ≥ 20 cm², 0 of 5-20 cm², 15 waived (daylight through the open rear grille behind the rear wheel, seen exactly side-on: open on the real car (traced: trace-left-0.png); daylight through the open rear grille behind the rear wheel, seen exactly side-on: open on the real car (traced: trace-right-1.png); daylight under the rear wing, between its swan-neck struts (traced: trace-front-2.png); daylight under the rear wing, between its swan-neck struts (traced: trace-front-3.png); daylight under the rear wing, between its swan-neck struts (traced: trace-rear-6.png); daylight under the rear wing, between its swan-neck struts (traced: trace-rear-7.png); daylight under the rear wing (traced: trace-front-left-10.png); daylight under the rear wing (traced: trace-front-left-11.png); daylight under the rear wing (traced: trace-front-right-12.png); daylight under the rear wing (traced: trace-front-right-13.png); daylight under the rear wing (traced: trace-low-left-14.png)) | none | automatic interior fills (carkit/interior.js: floor, keel, bays, bulkheads, arch liners, cabin); trace a gap that survives them (masks.png, then a magenta-background render) and add a fill or a tuning.glass scale |
| WARN | Glass fills the window openings (advisory) | 0% of opening pixels covered | ≥ 90% | car-lab profile glass polygons (read-only) or tuning.glass { push, offset } here |
| WARN | Tyres sit in the arches: a visible gap, no clipping, flush with the body | front: clear 0.007 top 0.022 poke 0.157; front: clear 0.007 top 0.022 poke 0.157; rear: clear 0.004 top 0.046 poke 0.218; rear: clear 0.004 top 0.046 poke 0.217 | clearance ≥ 0 (lip overlap under 2 cm warns), top gap 1.2-12 cm, poke -10..+4 cm | tuning.suspension { ride } raises the body off the wheels (m); arch lips that dip into the tyre need a shell fix |
| PASS | Glass sits in the openings, not on top of the paint or under it | floating 0%, buried 6%, over openings 3% | floating ≤ 5%, buried ≤ 30% | tuning.glass { push } (m, along the pane normal) |
| PASS | Exhaust and nitro points sit on the rear surface with a clear exit | 2 points, 0 off the body or blocked, asymmetry 0.013 m | on the surface (−4..+8 cm), unblocked, mirror-symmetric | assets/cars/exhaust.json tips [y, z] (and up for top exits); ?debug=exhaust shows them |
| PASS | Side mirrors: real-style housings, both sides, symmetric, on short arms | the model's own, asymmetry 0 m, housing gap 0.011 / 0.011 m | tuned style, asymmetry ≤ 2 cm, gap 1.5-32 cm | tuning.mirrors { style: blade|gt|bullet, scale, offset, housing } |
| PASS | Tail lamps: red but unlit off the brake, bright and blooming on it | area 297 cm2; dusk b0: 73, dusk b1: 159.4, night b0: 55.8, night b1: 188.8 | off: lum < 125, red; on: ≥ 90 and ≥ off + 40 (saturated red has low luminance; glossy lenses mirror the sky when off) | carkit/lamps.js (levels are shared; area-normalised); tuning.lamps only for a real exception |
| REVIEW | Premium look against the reference (judged by eye: look.png, reference.png) | - | as good as the Endurance garage frames | finishes.json (paint), tuning.mirrors, lamps; geometry limits need a better source model |
| PASS | Body dips under braking (1 g) | 0.85° | 0.8-3.2° | tuning.suspension { pitch, freq, damping } |
| PASS | Body rolls in a corner | 1.97° | 0.6-3.5° | tuning.suspension { roll } |
| PASS | Tyres stay clear of the arches with the nose down | -0.003 m | ≥ 0 | tuning.suspension { pitch } lower, or { ride } higher |
| INFO | Active aero (none set for this car) | - | only for cars that have it | tuning.aero |
| PASS | Exhaust smoke, pops, nitro flames and drift smoke all show | idle smoke 15, pop fire 12, nitro fire 61, drift smoke 407 | all > 0 (drift > 20) | exhaust.json points; carkit/fx.js rates |

Sheets: look.png, reference.png, masks.png, lamps.png, drive.png (this folder).
