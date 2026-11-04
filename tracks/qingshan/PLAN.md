# Qingshan Park: the plan

**Status (2026-11-04):** in the game with decor and ads, selectable as Qingshan Park. Not on the career calendar. See "In the game" below.

- Numbers come from `plan_layout.py` (`out/plan/stats.json`). Sheets come from `plan_sheets.py`: `out/plan/layout_plan.png` and `out/plan/zone_plan.png`.
- Speeds and lap time are estimates. The model is fitted to the measured AI laps of Mojave Dry Lake, Infinia, Shajawa and Llano, and lands within 3.4 % of each. The AI's own lap replaces them after the build.

## The track in one paragraph

A 5.8 km lap, 15 m wide, about 117 s at about 178 km/h average, 258 km/h top. It is two speeds in turn: four stacked hairpins climbing through forest, then long sweeping runs past the wind farm, the lake, the red roof and the solar field. Nothing here needs money.

## 1. What changes from your sketch

The road stays on your line: median 1 m off, at most 9 m. Scale is 0.97 m per sketch pixel, and the road occupies 1.32 x 0.75 km. Each change below is one you can refuse.

| Change | Why |
|---|---|
| Hairpin tips rounded to true arcs (radius 36-44 m; a direct trace gave 22-32 m) | The tips had nearly flat ends, good for about 77 km/h at the tightest. Rounded, they take about 100 km/h and still fit your stack. |
| Lake arm between the two hairpin tips narrowed from about 91 m to 55 m, its lower end pulled up 15 m. Lake goes from 10.5 to 9.8 ha. | As drawn, water is 20-24 m from the road centre at Turns 2, 4 and 8. Now it is 30 m or more everywhere, enough for run-off and a barrier. |
| Main stand 23 m south, Chinese halls 16 m south | As drawn the stand touches the road edge. Now 30 m and 32 m from the centre. |
| Three solar arrays trimmed on the road side (by 4, 17 and 27 m). 12 arrays stay; 5.9 to 5.7 ha. | Keeps them 30 m from the centre. |
| Turbines A, C, D moved 10-45 m | Two towers in the sketch are 68 m apart, closer than the 104 m rotors. Now at least 114 m apart. |

**Added, because the sketch doesn't show it:** a gentle 14 m rise. The stack climbs a wooded hillside, the wind farm sits on top, and the top straight runs down to the lake at 2.1 % at most. If you want it flat, that is one setting (see question 3).

## 2. Corners, gaps, start and pits

Clockwise, from the start line on the bottom straight (recommended).

| Turn | km along lap | Hand | Turns through | Radius | Est. km/h | Arrives at km/h | Straight-on room | Where |
|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | 0.64 | R | 160° | 44 m | 106 | 258 | 400 m+ (forest cut back) | End of main straight, first stack hairpin |
| 2 | 1.04 | L | 171° | 38 m | 99 | 208 | 400 m+ | Stack |
| 3 | 1.61 | R | 167° | 36 m | 97 | 223 | 400 m+ | Stack, far west tip |
| 4 | 2.02 | L | 174° | 42 m | 104 | 211 | 116 m to lake | Stack, top tip, first sight of water |
| 5 | 2.63 | R | 71° | 57 m | 121 | 231 | 400 m+ | Wind farm corner |
| 6 | 2.83 | R | 85° | 42 m | 104 | 183 | 400 m+ | Top of the rise |
| 7 | 4.14 | R | 145° | 80 m | 144 | 255 | 170 m to north stand | The big sweep round the lake |
| 8 | 4.60 | L | 178° | 37 m | 98 | 225 | 90 m to lake | Hairpin beside the lake arm |
| 9 | 5.41 | R | 154° | 90 m | 153 | 228 | 168 m to corner stand | Round the solar field |

There is also a right kink at about 3.1 km (about 170 km/h), too small to count as a corner.

**Straights:** bottom 745 m, of which 507 m runs from the line to Turn 1. Top 592 m dead straight, then a flat-out arc into Turn 7.

**Do the neighbouring sections fit? Yes.** The closest pair is 67 m centre to centre; Venice's script requires 32 m. Each row allows 8 m of run-off and a 1 m barrier on both sides.

| Sections side by side | Centre to centre | Height difference | Left for trees |
|---|---:|---:|---:|
| Turn 2-3 leg and Turn 3-4 leg | 67 m | 2.9 m | 34 m |
| Lake return and solar run (before and after Turn 8) | 83 m | 0.5 m | 50 m |
| Turn 3-4 leg and Turn 4-5 leg | 89 m | 2.0 m | 56 m |
| Turn 1-2 leg and Turn 2-3 leg | 91 m | 1.9 m | 58 m |
| Main straight and Turn 1-2 leg | 111 m | 2.7 m | 78 m |

The hard stops keep a tree-free stopping area of gravel and grass straight on from turn-in, 50 m wide and up to 110 m long. The plan's forest is already cut back for these.

**Start and direction:**

| Option | Result |
|---|---|
| **A. Clockwise, start on the bottom straight (recommended)** | Grid of 8 (8 m apart, 64 m long) sits fully on the straight beside the main stand. 507 m to a heavy stop at Turn 1, the natural overtaking spot, then straight into the stack. Later the top straight points you dead at the red roof for about 700 m, the track's big reveal. |
| B. Anticlockwise, same start | First corner is the wide Turn 9, so the first lap is calmer. The stack runs downhill, which is more of a challenge. The red roof sits behind you on the top straight, and you lose the reveal. |
| C. Clockwise, start on the top straight | Downhill start aimed at the red roof looks great, but no stands are sketched there, so I'd have to add them. |

**Pit lane.** In the code, only the HUD map reads `pitLane`, and career tracks leave it empty, so as on Llano the pits are scenery. Nobody drives them.

- **A (recommended):** inside the bottom straight, 370 m, between the road and the solar field. It fits with 12 garages, facing the main stand across the road, as at a real circuit.
- **B:** outside, built into the main stand. That moves the stand another 30 m from the road, and you lose the stand-facing-pits view.

## 3. What goes where, and what the driver sees

See `zone_plan.png`. Sizes come from your drawing at scale.

| Zone | Where | Size |
|---|---|---|
| Red roof hall (crescent), wing | Outside Turn 7, running down to Turn 9 | 5.2 ha hall, 1.4 ha wing; about 40 m tall (proposed) |
| Glazed rotunda, small rotunda | Your two grey circles | 146 m and 72 m across |
| North stand, corner stand, main stand | Outside Turn 7, outside Turn 9, along the bottom straight | 1.9, 1.4 and 2.7 ha |
| Three Chinese halls | Outside the bottom straight, on the run to Turn 1 | 95, 121 and 135 m wide, about 50 m deep |
| Solar field | Infield of the lower right | 12 arrays, 5.7 ha, tilted tables on steel racks |
| Lake | Upper infield, arm down between Turns 4 and 8 | 9.8 ha, reed and stone edge |
| Wind farm | Upper left infield, on open grass | 5 turbines, 80 m hub, 104 m rotor, 132 m tip; visitor hall, substation, shed |
| Forest | All round the outside and between the stack legs | 516 ha sown, out to 900 m |

One flag: your halls are big. A Forbidden City great hall is about 64 x 37 m, so at 95-135 m wide each box reads better as a small compound (main hall, side galleries, raised stone terrace) than as one giant hall.

| Section | km | What the driver sees |
|---|---|---|
| S1 Main straight | 0-0.6 | Stand on your left at the start and pits on the right, then the three halls pass on the left. A wall of forest closes ahead. |
| S2 The stack | 0.6-2.1 | Forest close on both sides, climbing. The next leg flickers through the trunks. Turn 4 opens onto the lake below you, the first water of the lap. |
| S3 Run west | 2.1-2.6 | Forest left. Two turbines pass 55-66 m off on the right, the closest you get. |
| S4 Rise | 2.6-3.0 | Forest left, the wind farm spread out to the right, the highest point of the lap. |
| S5 Kink | 3.0-3.2 | Forest closes on the left, then the view opens across the farm. |
| S6 Top straight | 3.2-4.0 | Downhill. Forest wall left, meadow and lake right, the glazed rotunda and red wing dead ahead and growing. |
| S7 Big sweep | 4.0-4.3 | Red roof and north stand fill the left, the lake stays inside you. |
| S8 Lake return | 4.3-4.6 | Lake on the right 30 m off, forest strip left, into the Turn 8 hairpin beside the arm. |
| S9 Solar run | 4.7-5.2 | Solar field on the right, forest left, the small rotunda and corner stand ahead. |
| S10 Final turn | 5.2-5.6 | Corner stand on the left, solar on the right, out past the main stand. |

## 4. Look: real materials and references

Same rules as Venice: a real photo set on every surface, real depth, nothing cartoon, and one finished stretch shown before rolling anything out.

| Element | Real reference | How it's made | Materials and source | Cost |
|---|---|---|---|---|
| Road, kerbs, barriers | Existing tracks | `career_lib.py` | `asphalt_track` (bleached, as Llano), already local | Free |
| Trees | Real broadleaf forest, mixed heights, 11-25 m | Scanned trees cut down to game weight, plus cards rendered from the same trees | Poly Haven CC0: `tree_small_02`, `island_tree_01`, `island_tree_02`, `jacaranda_tree`, optionally `fir_tree_01` | Free |
| Forest edge | Shrubs and ferns in front of trunks | Instanced, front row only | Poly Haven CC0: `shrub_02`, `shrub_03`, `fern_02`; ground `forest_leaves_02`, `forest_ground_04` | Free |
| Red roof hall | Ferrari World Abu Dhabi, grammar only: one low, wide red shell, about 45 m tall, a crisp edge, aluminium standing seam, a glass funnel where the roof dips | Hand-built shell with real seams. Our own plan shape, from your drawing. **No Ferrari name, horse, badge or copy of the building** | `box_profile_metal_sheet` (Poly Haven CC0) in red, plus glass and concrete | Free |
| Stands | Your sketch, plus Shajawa's stands | Real tiers and roofs, crowd cards from Shajawa | `brushed_concrete`, `dirty_concrete`, local | Free |
| Chinese halls | Forbidden City great halls (hip-and-gable roof, double eaves, bracket sets, red columns, stone terrace). Shanghai's circuit is a racing precedent: its team buildings are lake pavilions after Yuyuan Garden | Hand-built kit, as Venice's facade kit, with real brackets and curved eaves. **Mine, no copy of a named building** | Local: `red_plaster_weathered`, `lacquered_cherry_wood`, `large_sandstone_blocks`. New: `ceramic_roof_01` (Poly Haven CC0) | Free |
| Solar field | Ground-mount arrays | About 800 instanced tables: panels, steel racks, posts | ambientCG `SolarPanel002` (CC0), matt enough not to read as glass | Free |
| Turbines | 3 MW class: 80 m hub, 104 m rotor (REpower 3.XM size) | Hand-built tapered tower, nacelle, true blade shape | Painted steel and composite | Free |
| Lake | A real reservoir edge | The game's existing `water` material | Stone and reed edge, shore from local `large_sandstone_blocks` and `japanese_stone_wall`. As I read the code this water reflects only the sky, not the trees around it, so I'll check how that looks in the first lake stretch | Free |

**Things I'm deliberately leaving out, based on your earlier feedback:**

- No red aviation lights on the turbines (no blinking).
- Blades don't cast shadows, so there's no flicker across the road.
- No wind sway on trees. India's sway sparkled in motion and was removed.
- India's procedural trees aren't reused. Real ones replace them here.

**Downloads:** the user approved these and I fetched them on 2026-11-03; the optional conifers were not downloaded.

| Set | Files | Size |
|---|---|---|
| Trees | `tree_small_02` 115 MB, `island_tree_01` 80 MB, `island_tree_02` 59 MB, `jacaranda_tree` 230 MB | 484 MB |
| Plants | `shrub_02` 5 MB, `shrub_03` 5 MB, `fern_02` 3 MB | 13 MB |
| Textures (2k) | `forest_leaves_02` 5 MB, `forest_ground_04` 12 MB, `ceramic_roof_01` 5 MB, `box_profile_metal_sheet` 7 MB, `SolarPanel002` 16 MB | 45 MB |
| Optional conifers | `fir_tree_01` 510 MB; I'd skip `pine_tree_01` at 982 MB | 510 MB |

**Paid:** nothing is needed. No Meshy, ElevenLabs or Higgsfield.

**Sketchfab:** models there are only a fallback. The tool doesn't show licences, so I'd check each page first, and any CC BY model goes on the game's Credits screen.

**Trees as built (`make_trees.py`):** the scans are 1-4 million triangles. Trunks are measured from the scan in slices, and leaf cards are rendered from the scan's real leaves and placed where those leaves are. Three of the four scans are only 3-5 m tall and are scaled up 3-5 times, so their cards carry more, smaller leaves.

## 5. Performance budget

If every tree were a real model at full detail, the forest would be about 74,000 trees and 144 million triangles. It stays dense because the driver only ever sees the first rows. These figures were revised on 2026-11-04 after the first stretch: the first spacing looked like an orchard, so the rows are closer, and the converted trees weigh a little more than planned.

| Layer | Where | Count | Detail by distance from the camera |
|---|---|---:|---|
| Road-edge trees | Within 60 m of the road, 6.5 m apart | 4,293 | About 1,950 tris to 50 m, 420 tris to 110 m, then a 6-tri crossed card to 1.5 km |
| Second belt | 60-170 m, 11 m apart | 3,013 | 420 tris to 110 m, then a card |
| Far forest | 170-900 m, 22 m apart | 9,410 | Cards only |
| Low layer | In front of the trunks, along the road | About 3,000 cards, plus small trees close up | 6 tris, 420 tris within 60 m. Not in the sweep below: adds an estimated 30-40k |
| Beyond | Over 900 m | - | Far hill and treeline card, on Llano's backdrop mechanism (not built yet) |

Every one of these uses a mechanism the game already has: `~lo-hi` distance tags in `perf.js`, GPU instancing, and alpha-to-coverage on cut-outs.

**Measured on this layout by sowing the trees and sweeping a camera round the lap (not a GPU test):**

| Quality | Forest tris, average | Forest tris, worst point |
|---|---:|---:|
| High (50 / 110 / 1,500 m) | 260,000 | 452,000 (stack, about 0.8 km) |
| Medium, the auto choice for integrated GPUs (30 / 80 / 1,000 m) | 125,000 | 203,000 |

**Does it read as closed?** 99.2 % of sideways sight-lines from the road hit a tree crown, typically 4 m past the run-off. The stretch's renders bear this out, with the review shots set to the same distances the game would use.

**Targets, set against Llano** (375 draw calls, 918,000 tris, 10.2 ms average, 12.3 ms p95 in a race on the PC bench at 1512x982 x2):

| Item | High, worst point | Medium, worst point |
|---|---:|---:|
| Forest, with the low layer | 490k | 240k |
| Buildings and stands | 200k | 150k |
| Road, ground, solar, turbines | 120k | 100k |
| Cars, mirror, shadows as on Llano | 450k | 350k |
| Tree shadows, full-detail trees only | 160k | 25k |
| **Total** | **about 1.4M** | **about 0.87M** |

Also: 420 draw calls or fewer, 12.3 ms p95 or better on the same bench, and a web file of 40 MB or less (Llano 24, Infinia 47.6, Venice 52). The forest itself is cheap on disk: about 10,000 unique triangles, 1-2 MB of placement data, and an estimated 8-12 MB of textures. The hall as built is about 65,000 tris, so three would take almost all of the 200,000 for buildings and stands: its brackets and lattice must be instanced or thinned before the web stage.

**Traps I found:**

- **Don't copy Venice's or Llano's web pack script.** Their merge step turns instanced trees into plain meshes. Tokyo's and India's `NO_JOIN=1` keeps instancing.
- **Instanced sets aren't frustum culled** (`perf.js:116`), so trees behind you still draw. The numbers above include them. Splitting sets into 300-400 m cells could roughly halve the worst point, but needs a small `perf.js` change, so I'd do it only if the bench asks for it.
- **The real Mac risk is overdraw from cut-out leaves, not triangles.** Tile-based GPUs like Apple's lose much of their efficiency on alpha-tested surfaces. That's general knowledge, not measured here. `perf-mac.mjs` only imitates a Mac window on this PC, so the test stretch has to run on your actual MacBook. I also haven't confirmed which quality tier a MacBook auto-picks.
- **Stop rule:** run the forest on and off with `viewer.bench`. If it costs more than 3 ms, shrink the full-detail radius first, then the second belt.

## Off-track (the user asked, 2026-11-04, "in a subtle way"; `qingshan_offtrack.py`)

From a quick look at real circuits: gravel at the corners a car can miss (Mugello, Spa), a paved zone before gravel (Adelaide), rounded stones (Silverstone). Exact widths weren't confirmed by any source, so they're judged by eye.

- A narrow strip of older tarmac past the white line, about 1.25 m, behind the kerbs in corners, with a wandering edge.
- Mown grass, dusty where it meets the tarmac, worn on the outside of corner exits.
- Gravel traps on the outside of 8 of the 9 corners, narrowing to nothing at both ends, with a wider paved zone in front. Collision stays flat: gravel grips as grass.
- Two tyre lines leaving the road at those corners' exits.
- Kerbs on a real concrete base instead of flat colour.

## Second stretch: what was built, and what changed (2026-11-04)

- **Red roof (`qingshan_arena.py`):** one continuous shell grown from the drawn outlines, deep matte red with real ribs, 47 m at the crown, with a clean aluminium edge. The glass funnel at the rotunda's centre has steel ribs and rings. A curtain wall sits 7 m under the edge, with a mullion every 6 m. The north stand opens under a raised edge, with 36 rows and Shajawa's crowd. 50,406 tris.
- **Lake (`qingshan_nature.py`):** in place, as planned, with a muddy, weedy shore. Land falls towards it from 80 m out so it can be seen from the road. The water is the game's own material, so it reflects sky, not the trees.
- **Turbines:** all five, not one: the same mesh, and the road's whole right side looks at them. Rotors are separate objects pivoting at the hub, ready to turn in the game. They are still in Blender.
- **A change from the plan:** the lake side of the top straight and Turn 7's inside have steel rail instead of concrete wall. At driver's eye a 1.2 m wall hid everything below road level, including the lake. Same line, same collision. Above the rail's 0.75 m the collision still stands at 1.2 m, so check this on the first drive.
- **Whole-track count so far:** 387,213 tris of static scenery, forest not included. The whole arena so far is only about 50,000 tris, lighter than the one Chinese hall at about 66,000, so the hall's brackets and lattice are the first thing to thin for the web.

## The whole lap (2026-11-04)

`qingshan_dressing.py` and extended `qingshan_arena.py` and `qingshan_hall.py`:
- **Halls:** three different buildings, not one repeated. Hall 1 is the full hall. Hall 2 is a smaller main hall with a side hall each hand, joined by covered walls. Hall 3 is a long red wall with three arched passages and a hall and two pavilions on top: an imperial gate's grammar, no copy of a named one.
- **Arena:** corner stand, wedge, service lobe, Rotunda B and main stand, all one shell with the red roof.
- **Solar field:** 969 tables on steel racks, an inverter cabinet per array, and solar on the pit roof too (my addition).
- **Pits:** inside the bottom straight, 19 bays, scenery only.
- **Wind farm buildings:** a timber visitor hall with a planted roof, a fenced transformer yard, a steel shed.
- **Race furniture:** start gantry and a second gantry at the top straight, 300/200/100 boards, tyre walls at the hard stops, hoardings with the same sponsor marks as the other tracks, catch fence by the stands, rubbered line, brake marks.
- **Rail:** steel rail along all the open infield, from s 2120 to 5500 with a gap at Turn 8.
- **Far hills:** the ground rises to green hills beyond the forest, the name's "green mountain". No separate far card.

**Weight, static scenery without the forest: 719,000 tris.** That is too heavy for the web. The five hall buildings are 355,000 of it against a 200,000 budget for all buildings and stands; the arena is only 89,000, the ground and verge 149,000. Before the web stage, instance the halls' brackets and lattice and thin them, and coarsen the ground away from the road.

**Before the web stage:** export with instancing kept (`NO_JOIN=1`), split the tree sets by distance tiers with `~lo-hi`, spin the rotors, tune dusk, check the game's own sun, run `qa-drivable` and `qa-player-lap`, bench against Llano, and run it on the real MacBook. Rail is lower than its 1.2 m collision, so check that on a drive.

## In the game (2026-11-04)

Measured with the game's own tools, this PC standing in for a Mac window (`perf-mac.mjs`, 1512x982 x2, high tier, 8 AI cars, day). Target was a 12.3 ms p95, Llano's old figure; a 60 fps frame is 16.6 ms.

| Build | Average | p95 | Worst | Draw calls | Tris per frame |
|---|---:|---:|---:|---:|---:|
| First game build | 15.39 ms | 21.2 ms | 38 ms | 491 | 1,409k |
| Far cards stop casting shadows, tighter detail ranges | 13.67 ms | 18.0 ms | 32 ms | 483 | 1,276k |
| **Shipped: also 28 % fewer trees (the user's call), 16,716 to 11,982, least at the road edge** | **12.67 ms (79 fps)** | **16.1 ms** | **31 ms** | **481** | **1,214k** |
| Llano, same sitting | 9.05 ms (110 fps) | 11.2 ms | 24 ms | 368 | 903k |
| **Now: 35 % fewer trees again (the user's call), 11,982 to 7,734 sown; 13 billboards; a fuller crowd; smaller far textures** | **12.70 ms (79 fps)** | **16.0 ms** | **30 ms** | **482** | **1,185k** |
| Llano, same sitting as that | 8.67 ms (115 fps) | 10.3 ms | 24 ms | 368 | 899k |

Cutting 35 % of the trees moved the frame time by nothing measurable: nearly all came from the deep forest's far cards, which cost little, and the road edge, where the overdraw is, stayed as it was so the forest would still look dense.


No frame over 33 ms. It still misses the 12.3 ms target and costs about 40 % more than Llano, nearly all of it GPU time (6.7 ms against 3.7): leaf overdraw. **Never run on a real MacBook.**

Files: 46.1 MB KTX2 web file, textures 36.5 MB of it (was 53.1, and 52.9 with 43.4 MB of textures just before far textures shrank; target 40; Venice 52, Llano 24), 1.4 MB collision. Shrunk, by the measured nearest they come to the road: forest floor, boardwalk, hall red plaster, turbine paint to 1K, shed cladding and cedar to 512 (`pack-web.mjs`); no softening in before/after views from the road (`qa_tex_views.mjs`). 704k unique tris, 300k of them the five hall buildings, still over the 200k plan.

Driving (`qa-player-lap`, Nissan Z, player's assists, 1.05 pace): 0 stuck in lanes 0, -6, +6, -12, +12 and weaves of 8 and 12 m; one graze of a real wall by the north stand on the approach to Turn 7, lane 12 only. About 123 s, 245 km/h top. `qa-drivable`: no invisible walls, no holes; 144 ground steps over 0.12 m in the run-off on the stack (stations 434-870), not felt in any lane driven. `test-track`, `test-career`, `test-menu`: PASS. Rotors checked by eye between two frames, after fixing a wobble.

Next levers if a MacBook struggles, cheapest first: shrink the 40 m and 90 m tree ranges, tile the tree sets so they can be frustum culled (a small `perf.js` change: today every instance in range draws, even behind the car), thin the halls further.

Files: 53.5 MB KTX2 web file (target 40; Venice 52, Llano 24), 1.4 MB collision. 704k unique tris, 300k of them the five hall buildings, still over the 200k plan.

Driving (`qa-player-lap`, Nissan Z, player's assists): 0 stuck and 0 stops in lanes 0, -6, +6 and an 8 m weave; in the earlier wider run including -12, +12 and a 12 m weave, one graze of a real wall by the north stand on the approach to Turn 7, lane 12 only. About 123 s at 1.05 pace, 245 km/h top. `qa-drivable`: no invisible walls; 144 small ground steps over 0.12 m in the run-off on the stack (stations 434-870), not felt in any lane driven. `test-track`: PASS. Rotors checked by eye between two frames, after fixing a wobble.

Not done: career calendar entry (needs a measured `parLap`), a `race-loading` line, dusk beyond a quick tune. Dusk's sky and buildings look right; the road stays dark there.

## 6. Build order

1. **Lock the layout:** name, direction, height, then move the waypoints into `track-viewer/docs/career-worlds/`.
2. **First finished stretch:** the run to Turn 1 and the first stack leg, with real forest, one complete Chinese hall and the road. This tests the three riskiest things at once. Show in Blender.
3. **Second stretch:** the top straight towards the red roof, with one turbine. Show in Blender.
4. **Whole lap:** after you're happy with both, `out/<id>_review.blend` for your review.
5. **Web only after your approval:** pack, `qa-drivable`, `qa-player-lap`, bench, then a run on your MacBook. Day and dusk only, no night lighting.

## Decisions (the user, 2026-11-03)

Name Qingshan Park. Clockwise from the bottom straight, with the changes in section 1. The 14 m wooded rise. Imperial halls (yellow glazed roofs, red columns). Mixed broadleaf forest, conifers not downloaded. The pink buildings stay my reading, as they didn't correct it: visitor hall, substation, service shed.

## Sources for the real references

- Ferrari World: [Benoy project figures via ArchDaily](https://www.archdaily.com/904628/ferrari-world-abu-dhabi-benoy/), [e-architect](https://www.e-architect.com/dubai/ferrari-world-abu-dhabi), [roof case study](https://architecturaltechnology.com/resources/case-studies/ferrari-world-abu-dhabi.html)
- Shanghai International Circuit: [Wikipedia](https://en.wikipedia.org/wiki/Shanghai_International_Circuit), [Tilke](https://tilke.de/portfolio/shanghai-international-circuit/)
- Hall of Supreme Harmony: [Audiala](https://audiala.com/en/china/beijing/hall-of-supreme-harmony), [China Daily](https://www.chinadaily.com.cn/a/202311/28/WS65652f02a31090682a5f04d7_3.html). Sources disagree on details; the 64 x 37 m size is from a travel site, so treat it as approximate.
- Turbine size: [REpower 3.XM](https://www.power-eng.com/renewables/wind-energy/repower-installs-prototype-3xm-wind-turbine/)
- Assets: [Poly Haven](https://polyhaven.com) API, [ambientCG](https://ambientcg.com) API (listings and file sizes only; nothing downloaded)
