# RaceUltimate: track design

*Design doc for the game's first two circuits. It builds on `../endurance-rebuild-report.md`: the same engine, the same track pipeline, and the same `track.json` data shape (§5).*

| | Track A: **Sahyadri Ghat Circuit** | Track B: **Corniche Marina Circuit** |
|---|---|---|
| Setting | Western Ghats, India, monsoon season | A fictional Gulf coast marina at dusk |
| Inspiration | the Ghats themselves: hill roads, dams, tea estates, waterfalls | the *grammar* of Yas Marina (Abu Dhabi GP), not its layout |
| Length / turns | ~5.4 km, 16 turns, clockwise | ~5.2 km, 16 turns, anti-clockwise |
| Elevation | ~70 m of climb and fall | ~8 m (flat) |
| Character | flowing, hilly, blind crests; rain is the boss | stop-start, heavy braking, floodlit; dry by default |
| Default weather | monsoon rain (light → heavy) | dry dusk → night; a rare desert storm |
| Target GT3 lap | ~2:05 | ~1:55 |

The two are deliberately opposites: wet vs dry, hills vs flat, flow vs braking. The car setup and the pit strategy each matter differently on each track.

---

## 1. Shared rules (both tracks)

- **Width:**

  | Section | Width |
  |---|---|
  | main straight | 15 m |
  | regular track | 12–14 m |
  | hairpins | 11 m |
  | pit lane | 12 m (6 m fast lane + 6 m working lane) |

- **Corners:**
  - The tightest corner radius is 12 m. The pipeline already validates this (`minRadiusM`).
  - Every hard braking zone gets 150/100/50 m boards and a reference object, such as a bridge pillar or a lone tree.
- **Run-off:** each surface has a gameplay job.

  | Surface | Grip | Where it goes |
  |---|---|---|
  | tarmac run-off | 0.9 | heavy-braking corners, so mistakes cost time and don't end the race |
  | gravel/laterite | 0.5 | fast corners; it punishes |
  | grass | 0.6 | wet grass works like ice |

- **Sectors:** 3 timing sectors and ~12 checkpoints spaced along the centerline. Lap validity comes from centerline progress plus the in-bounds bitmap, as in the reference game.
- **Sightlines:** every corner apex is visible from its braking point, except the crests we flag as blind on purpose (at most 2 per track).
- **Hero landmarks:** 3–4 per track that you can see from far away. They are how players learn the lap ("brake at the bridge").
- **LOD budget:**

  | Element | Distance |
  |---|---|
  | the road and the first 30 m either side | full detail |
  | scenery | impostors beyond 300 m |
  | backdrop (mountains, skyline) | one far-plane mesh or a painted sky card |

---

## 2. Track A: Sahyadri Ghat Circuit (India)

### 2.1 Concept
A circuit cut into a Western Ghats hillside in the middle of the monsoon. The Ghats fit this game's rain-first look: wet tarmac under a grey-green sky, cloud sitting in the valleys, waterfalls on every cliff face.

**"Indian, but not in the face":** it should feel like a real place a traveller recognises, not a postcard.

| Do (quiet, specific) | Avoid (loud, generic) |
|---|---|
| red laterite soil and laterite-stone walls in the run-offs and cuttings | monuments (Taj, temples as set pieces), elephants, peacocks |
| tea / coffee estate terraces following the contour lines | saffron-white-green kerbs or flags everywhere |
| a stone masonry dam and reservoir, an old arched viaduct | "Incredible India"-style signage, Bollywood billboards |
| monsoon waterfalls, low cloud in the valley, wet black rock | painted truck art and "Horn OK Please" as decoration |
| a small roadside shrine with a few marigolds at one corner (one, not ten) | crowds in costume, sitar music on the menu |
| a tin-roofed chai stall behind the paddock; marshals in yellow raincoats | Devanagari slapped on every surface |
| sign language only where real: bilingual distance boards (English + Devanagari numerals) and a milestone-style km stone at start/finish | |
| banyan and jackfruit trees by the paddock, silver oak shade trees in the tea, mist over pine on the high section | |

Sound is a cue too: monsoon rain on tin roofs in the pit lane, frogs and insects at night, a far-off bus horn echoing up the ghat road. The radio keeps its public-domain classical music, and an optional Hindustani classical station can be added later from public-domain recordings.

### 2.2 Layout (clockwise)

```
                       ◄── S2: GHAT CLIMB ──►
                  T6  ___________  T7
                    /             \__ (Monsoon Crest, blind)
          T5  ___ /                    \
  Ghat      \( )/   switchbacks          \   T8–T11 TEA TERRACE ESSES
  Hairpin    \_/                          ~~~\/~~\/~~\/~~
              |                                         \
          T4  |                                          [WATERFALL TUNNEL]
              |                                              |
          T3 _/                                          T12 |  (downhill)
   T2 ___/                                                   |
     /    PIT ENTRY ┐                              [GORGE VIADUCT]
 T1 |        ═══════╪═════ DAM STRAIGHT (S/F) ════════  T13 _/
     \__ PIT EXIT ──┘     reservoir on the left ~~~~~   T14-T15 paddock complex
                                                   T16 ──┘
```

| # | Name | Type | Speed | Notes |
|---|---|---|---|---|
| S/F | **Dam Straight** | 1.0 km straight along the dam crest | 260 km/h | reservoir on one side, spillway mist on the other; start grid and pits here |
| T1 | **Spillway** | 90° right | 85 km/h | the heaviest braking zone; tarmac run-off |
| T2–T3 | **Sluice Gate** | left-right chicane | 110 km/h | climbing starts at the exit |
| T4 | **Laterite Cut** | uphill kink, left | 170 km/h | the road is cut into a red-earth bank |
| T5 | **Ghat Hairpin** | 180° uphill left, 7% grade | 55 km/h | signature corner: a switchback with a stone parapet over the valley |
| T6–T7 | **Switchback Ladder** | two uphill rights | 120 / 150 km/h | tight, with a short squirt between |
| — | **Monsoon Crest** | blind crest, highest point | 220 km/h | the car goes light; on clear-weather looks the valley view opens up |
| T8–T11 | **Tea Terrace Esses** | 4 fast flowing bends on the contour | 170–210 km/h | banking 3–4°; the drift-score playground in free mode |
| — | **Waterfall Tunnel** | 180 m tunnel under a cascade | 230 km/h | **dry inside** (grip spike), then you exit through a spray curtain (lens drops + a blinding flash) |
| T12 | **Viaduct Entry** | downhill left onto a stone arch bridge | 160 km/h | mist rising from the gorge; no run-off, just walls |
| T13 | **Gorge Drop** | downhill braking, right | 95 km/h | braking while descending; easy to lock up in the wet |
| T14–T15 | **Chai Stall** | slow left-right by the paddock | 70 km/h | spectator area; the one corner with the shrine |
| T16 | **Banyan** | long right onto the straight | 140 km/h | exit speed decides the straight; pit entry is on the inside |

**Elevation:** the low point is the dam (0 m). The climb goes through T4–T7 to the Monsoon Crest (+70 m), stays high across the tea terraces, then falls 60 m through the tunnel, viaduct and Gorge Drop back to the paddock.

### 2.3 Weather and track gameplay
- **The rain changes during a race:** dry-ish, light rain, then a monsoon burst (heavy), then easing. This shift is what makes the pit strategy matter (§4).
- **Puddle zones:**
  - At the T1 and T13 braking zones, and in the dip before the tunnel.
  - They grow with rain intensity, using the baked wet-map plus a rain-level threshold.
  - Puddle grip is 0.7; standing water in heavy rain adds aquaplaning (steering goes light above 180 km/h).
- **Drying line:** after a burst, the racing line dries first, on the same racing-line channel the reference game bakes.
- **Waterfall Tunnel:** a dry-grip zone, then a visibility hit on exit. The thrill moment of the lap.
- **Low cloud:** height fog sits in the valley sections, so the crest pops out above it.
- **Time-of-day looks:** monsoon morning, grey noon, wet golden break (sun through cloud), dusk, night (floodlit straight + headlights only on the hill section).

---

## 3. Track B: Corniche Marina Circuit (general, Yas-inspired)

### 3.1 Concept
A twilight circuit wrapped around a marina on a desert coast. We take Yas Marina's **grammar**: a dusk-to-night race, floodlights, a long back straight into a hairpin, a slow technical section along the water, a structure spanning the track, and a pit exit that tunnels under the circuit.

We do **not** copy its layout corner for corner, its name, or the Yas hotel's distinctive gridshell look. The spanning structure is our own design.

### 3.2 Signature features
- **The Canopy:** an original structure over the track at the marina section, made of a lattice of sail-like fabric panels lit from below. Its colour shifts with the time-of-day look. It is the track's one "wow" landmark.
- **Pit lane on the infield:** entry on the inside of T16, exit merging on the inside after T1, so no crossing is needed. A pit-exit tunnel stays a possible later signature (it would need a bridge in the track and a two-level heightfield).
- **Marina section:** superyachts in berths, a boardwalk, palm rows, and wet-looking polished concrete even when dry.
- **Desert edge:** dunes and a hazy city skyline across the water as the backdrop. Blown sand on the run-off edges.

### 3.3 Layout (anti-clockwise)
The built layout is generated from `tracks/marina/layout.py`: straights and constant-radius arcs, with the loop closed exactly. It is **5.47 km** with 16 named turns. Edit the segment list there and rebuild; this table is a summary of it.

| # | Name | Type | Notes |
|---|---|---|---|
| S/F | **Main Straight** | 1.18 km east | grandstands on the outside, pit lane + garages on the infield, gantry over the line |
| T1 | **Gate** | 90° left, r 45 | heavy braking; tarmac run-off; pit exit merges on the inside after it |
| T2–T4 | **Dune Esses** | left-right-left, r 150–200 | flowing, the fast section |
| T5 | **Dune Exit** | 90° right, r 60 | onto the hairpin approach |
| T6 | **Hairpin** | 180° left, r 20, at the end of a 380 m straight | its two straights share one wall; tarmac run-off |
| — | **Back Straight** | 1.2 km west, 8° kink halfway | slipstream matters |
| T7–T8 | **Chicane** | right-left, r 24 | heavy braking from top speed |
| T9 | **Harbour** | 90° left, r 30 | onto the harbour straight |
| T10–T13 | **Marina** | four 90°s, r 30–32, jogging out onto a peninsula | water on three sides; walls close; promenade with street lamps |
| T14–T15 | **Boardwalk** | left-right, r 22 | street section |
| T16 | **Final Turn** | 98° left, r 90 | pit entry on the inside |

### 3.4 Weather and track gameplay
- **Default: dry.** This is our dry counterpart to the rain-first track. Grip 1.0, little grip decay, tire *wear* is the strategy driver instead.
- **Looks:** golden hour → dusk (the signature look: orange sky, floodlights coming on) → full night (floodlit, reflections on the marina) → a rare **desert storm**: rain + sand haze, which reuses the whole rain system for a surprise wet race.
- **Track temperature:** hotter tarmac = faster wear. It is a dial the race director can set.

---

## 4. Pit stops (Endurance / full race mode only)

### 4.1 Which modes use pits

| Mode | Pit lane | Why |
|---|---|---|
| **Endurance / full race** | **open**, stops serviced | the only mode with fuel, tire wear and damage |
| Free drive | closed | no consumables to manage |
| Time trial / hot lap | closed | laps are single-stint |
| Challenges | closed (unless a challenge is *about* pitting, e.g. "pit stop drill") | |
| Multiplayer | open only in "endurance" lobbies | host setting |

**Closed means** the pit lane is still visible as scenery, but its entry is blocked by a barrier gate and cones that are colliders. Crossing the pit-entry line in a closed mode does nothing. The geometry is identical across modes; only the gate and the service logic change.

### 4.2 Pit lane layout (both tracks)
- **Pit entry** is on the inside of the last corner (T16 on both tracks). **Pit exit** merges after T1 on Track A, and via the tunnel under T1–T2 on Track B.
- **Speed limit:** 60 km/h between two lines painted across the lane.
  - The limiter engages automatically at the entry line (arcade).
  - Speeding gets a +5 s penalty per offence, shown on the HUD.
- **Boxes:**
  - 10 boxes: 8 grid cars plus 2 spare. Each is 12 m long, with painted slots and garage doors behind.
  - Your box is highlighted with a glowing slot (UI overlay, not world geometry) and your team board.
- **Arcade assist:** in the last 20 m before the box, steering and braking blend to auto, so the car stops on its marks. On "sim" assists this is off and stopping off-mark adds time.

### 4.3 The stop
1. The car stops on its marks and the service menu opens: tires, fuel, repair. Its defaults come from the strategy pre-set chosen before the race.
2. Service runs in **parallel**. The stop time is the longest item plus 2 s of jack up/down.

   | Service | Time |
   |---|---|
   | 4 tires | 6 s |
   | fuel | 1 s per 10 % of the tank |
   | repair | 3–15 s, scaled by damage |

3. Release: a green light in the box, and the car pulls out with the limiter on until the exit line.

### 4.4 What race mode needs underneath (new systems, not in the reference game)

| System | MVP rule |
|---|---|
| **Fuel** | a full tank lasts ~8 laps on Track A and ~9 on Track B; weight drops as it burns (−0.7 kg/L into the physics mass) |
| **Tire compounds** | **Dry** (grip 1.0, falls off in rain), **Wet** (grip 0.85 dry / 0.8 in rain, overheats and wears fast on a dry line) |
| **Tire wear** | grip × (1 − 0.25 × wear), wear 0→1 over ~12 laps; faster with sliding, drifting and hot track |
| **Damage** | wall hits above a force threshold (the reference game already uses a 1500 N contact event) reduce aero and top speed; repair restores it |
| **Weather timeline** | per race, a seeded schedule of rain intensity (Track A) or a storm chance (Track B). The pit wall radio warns ~2 laps before a change |
| **Mandatory stop (option)** | endurance races of ≥ 20 min require at least one stop |

**Pit crew visuals (MVP):** no animated crew. A jack-up bump, four wheel swap sounds, tire stacks, and a lollipop board. A crew of 6 low-poly animated figures comes later.

---

## 5. Data each track ships with (`track.json`)
Same idea as the reference game's `ring.json`, plus the race-mode fields:

```jsonc
{
  "name": "Sahyadri Ghat Circuit", "lapLength": 5400, "direction": "cw",
  "credits": [],                                   // every CC-BY asset used, shown in About
  "centerline": [[x,y,z], ...], "spacing": 4.5,
  "halfWidth": [...], "slope": [...], "banking": [...],
  "sectors": [0, 412, 851],                         // centerline indices
  "checkpoints": [0, 100, 200, ...],
  "corners": [{ "id": "T5", "name": "Ghat Hairpin", "apexIdx": 330, "boards": [150,100,50] }],
  "start": { "pos": [...], "yaw": 0, "gridSlots": [...] },
  "pitLane": {
    "polyline": [...], "entryIdx": 1180, "exitIdx": 40,
    "limiterIn": 12, "limiterOut": 210,            // indices along the pit polyline
    "speedLimitKmh": 60,
    "boxes": [{ "id": 1, "pos": [...], "yaw": 0 }, ...],
    "gate": { "pos": [...], "yaw": 0 },            // collider used when closed
    "enabledIn": ["endurance", "mp-endurance"]
  },
  "zones": [                                        // gameplay volumes along the centerline
    { "kind": "puddle",  "from": 120, "to": 140, "rainMin": 0.4 },
    { "kind": "dry",     "from": 760, "to": 800 },  // Waterfall Tunnel
    { "kind": "spray",   "at": 800 },
    { "kind": "fogBand", "y": 25 }
  ],
  "weather": { "default": "monsoon", "looks": ["monsoonMorning", "greyNoon", "wetGolden", "dusk", "night"] },
  "landmarks": [{ "name": "Gorge Viaduct", "pos": [...] }],
  "surfaces": { "asphalt": [...materials], "laterite": [...], "grass": [...], "wall": [...] }
}
```
These sit beside it, exactly as in the reference pipeline:
- `*_visual.glb`, `*_vegetation.glb`, `*_collision.glb`
- `*_height.bin` (heightfield)
- `*_contain.bin` (in-bounds bitmap)
- `*_gaps.json`

## 6. How we build them
1. **Paper first:** sketch each layout as a centerline on a top-down grid. Check the lap length, the corner radii and the speeds with a quick "ghost car" that drives the spline at the target speeds.
2. **Blender block-out:**
   - The centerline is a Bezier curve. The road comes from a curve sweep with width taken from `halfWidth`.
   - Terrain is sculpted to a heightmap, and kerbs, walls and run-offs come from offsets of the same curve.
   - Drive the block-out in-engine before any art. This is where the layout gets fixed.
3. **Art pass:** materials named by role, vegetation as instanced scatter, landmarks modelled once, backdrop as a far mesh.
4. **Pipeline:** export, compress (meshopt + KTX2), then bake height, containment, gaps and `track.json` with our own scripts.
5. **Order of work:** Track A first, because it exercises the rain system that is the game's identity. Track B reuses the pipeline and is mostly an art job.

All track art is original or CC0/CC-BY with credit. No real circuit names, logos or sponsor brands.

## 7. Open decisions
- Final names (the ones here are working titles).
- Endurance race length options (10 / 20 / 45 min?) and whether one pit stop is mandatory.
- Whether multiplayer gets endurance lobbies in v1 or later.
- Track B's storm: a random chance, or a selectable look?
