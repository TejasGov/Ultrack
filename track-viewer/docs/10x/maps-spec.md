# Part C build spec: two mini qualifying maps (Pilbara Pit, North Sea Terminal) and a qualifying rotation

Worktree: `D:/RaceUltimate-wt/maps` (commit 987a185). Every path below is relative to it unless it is absolute. Never write to `D:/RaceUltimate`. You may read it (texture sets), and you run its two lock scripts.

## 0. What the player gets

- Qualifying and the Last Chance Qualifier (LCQ) rotate between three venues instead of always running at Mojave Dry Lake. The venue is fixed per round when the season calendar is built: it is seeded, deterministic, and never the same in two consecutive rounds.
- The Open Shootout stays at Dry Lake. Saves made before this change keep Dry Lake.
- Both new maps also appear in Free Drive and race menus like every other track, with day and dusk looks only.

| | Mojave Dry Lake (today) | **Pilbara Pit** (`pilbara`) | **North Sea Terminal** (`terminal`) |
|---|---|---|---|
| Setting | desert airfield and boneyard | open-cut iron-ore mine, Western Australia | container terminal on a North Sea quay (unbranded, Rotterdam-style) |
| Drive | flat, open, stop-go | 18 m drop and climb: one downhill switchback, bench esses, a blind crest onto the rim | flat and walled: a crane hairpin, square canyon corners between 4-high stacks, a 320 m quay straight under three cranes |
| Lap (measured on the layout) | 1.70 km, 8 corners, r20-r52 | 1.752 km, 7 corners: R66/r80, R178/r21, L172/r32, R102/r67, L55/r29, R118/r33, R79/r33; z 0-18 m; max grade 6.1 % (smoothed); closest pass 74 m; longest straight 206 m | 1.750 km, 6 corners: R179/r22, L184/r29 (two 90s), R181/r33 (two 90s, decreasing radius), L54/r27 flick, R76/r47, R89/r46; flat; closest pass 62 m; longest straight 320 m |
| Par (estimate, see below) | 45.3 s (measured) | about 44-47 s | about 46-47 s |
| Palette | bleached sand, white jets | red laterite, gravel, rust, red-oxide cladding | grey pavers, painted steel boxes in 7 muted colours, sea |

**How the par was estimated (inferred, not measured).** I built a point-mass lap model: lateral 12 m/s², +6/−10 m/s², 75 m/s cap, on the same spline. Calibrated on Dry Lake (54.9 s model → 45.3 s par, a factor of 0.825), it predicts Shajawa B at 61.9 s against a measured 62.3 s. It gives Pilbara 53.0 × 0.825 = 43.7 s before the climb's cost, and Terminal 56.3 × 0.825 = 46.4 s.

Both keep `lapsFor` at 3, 5 and 8 laps for sprint, standard and full, the same as Dry Lake (`rules.js:49`, tuning `lengths` 2.5/4/6 min). The real par is still measured with `measure-par-laps.mjs` (section 6). If a measured par falls outside 40-55 s, move waypoints; never hand-edit the par.

Scratch evidence: `D:/RaceUltimate-wt/maps/qa/10x-scratch/judge/`
- `sketch.mjs`: a copy of the layout script, plus smoothed grade, crest vertical radius, the straight into the line, and the point-mass lap.
- `layouts-final.json`, `pilbara.json`, `terminal.json`.

## 1. Standing rules for the build

- **No flyover, no banking, no night look, no lamps, no venue module.** Every `has` flag stays false.
- **No new models, no downloads, no paid APIs.** Every surface is a local CC0 photo set or a texture derived from one.
- **No placeholder or cartoon look.** No haul trucks, ships, people or animated objects. No text or logos on containers or signs.
- **Player car physics, assists and AI tuning are untouched.** Only data (layouts, a `parLap`) and the qualifying-venue choice change.
- **Blender runs only through the lock,** one short job at a time, EEVEE stills only. The command form:
  ```
  powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script <abs py> [-Blend <abs blend>] [-Rest a,b] -Log <abs log>
  ```
  It runs `-b -t 6 --factory-startup` at below-normal priority.
- **Headless browser QA only through the machine lock,** from `D:/RaceUltimate-wt/maps/track-viewer`:
  ```
  node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node <script> ...
  ```
  Vite for this worktree runs on port 5303: `npx vite --host 127.0.0.1 --port 5303 --strictPort`, started in the background from `track-viewer`. Reuse it if this worktree already serves it there.
- **gltf-transform must stay offline.** `npx --offline -y @gltf-transform/cli@4 --version` returned 4.5.1 from the npx cache, so the packers run with `npm_config_offline=true`. If the cache misses, stop: never let npx reach the registry.

## 2. Foundation (WP1)

1. **`tracks/career_lib.py:13`.** Change `ROOT = Path(r'D:/RaceUltimate')` to `ROOT = H.resolve().parents[1]`.
   - Every existing `build_*.py` sets `H = Path(r'D:/RaceUltimate/tracks/<id>')` before it execs career_lib (checked: `build_llano.py:14-15`, `build_shajawa.py:14-15`), so their ROOT stays `D:/RaceUltimate` and nothing about them changes.
   - New scripts set `H = Path(__file__).resolve().parent`, so ROOT becomes the worktree. Add `assert H.resolve().parents[1] == ROOT` and `assert H.name == ID` in each new build script.
   - That `__file__` is set under `-P` is expected but not tested. If it is not set, use `Path(sys.argv[sys.argv.index('-P') + 1])`.
2. **Copy the untracked Poly Haven sets** from `D:/RaceUltimate/assets/polyhaven/<set>` into `assets/polyhaven/<set>`. They go through Git LFS by extension. These 8 sets are 2k jpg (diff, nor_gl, arm), about 67 MB in all, sizes measured:
   - `red_laterite_soil_stones` 13M, `gravel_ground_01` 9.6M, `rusty_corrugated_iron` 6.8M, `dirty_concrete` 4.8M, `box_profile_metal_sheet` 6.6M, `interlocking_concrete_pavers` 9.8M, `seaworn_stone_tiles` 8.6M.
   - Copy each folder as is.
   - Add their lines to `assets/polyhaven/CREDITS.md`, taken from main's (modified) copy of that file.
   - The worktree already has `asphalt_track`, `brushed_concrete`, `concrete_wall_009`, `painted_metal_shutter` and the HDRIs `qwantani_noon_puresky` and `belfast_sunset_puresky`.
   - **Do not use `large_sandstone_blocks`.** I looked at its diffuse: it is a dressed masonry wall, and it would read as a stone wall on pit faces and boulders.
3. **`track-viewer/scripts/qa-player-lap.mjs:19`.** Change `await page.goto('http://127.0.0.1:5180')` to `await page.goto(process.env.BASE ?? 'http://127.0.0.1:5180')`, a one-line change.

## 3. Layouts (WP2)

Append both entries to `track-viewer/docs/career-worlds/layouts.json` `tracks[]` exactly as below. Waypoints are pre-scale: x, y are scaled to `lapTarget`, and z stays in metres. Waypoint 0 is the start line, and the lap runs in waypoint order, clockwise (the interior is on the right).

```json
{"id":"pilbara","name":"Pilbara Pit","world":1,"lapTarget":1750,"width":15,"labels":[[60,22,"rim straight, start"],[380,-150,"the descent"],[300,-300,"Switchback"],[200,-90,"bench loop"],[60,-400,"pit floor"],[-60,-410,"crusher chicane"],[-230,-200,"the climb"],[-150,30,"The Lip (crest)"]],"waypoints":[[0,0,18],[180,0,18],[280,-20,18],[340,-70,16],[362,-140,13],[372,-205,10],[370,-246,9],[352,-274,8.5],[324,-284,8],[302,-266,7],[290,-222,6],[285,-170,5],[276,-128,4],[248,-104,4],[212,-106,3],[190,-134,2],[184,-180,2],[182,-240,1],[170,-320,0],[130,-365,0],[40,-378,0],[-20,-366,0],[-60,-388,0],[-110,-380,0],[-150,-360,0],[-174,-318,1],[-185,-260,4],[-190,-190,7],[-190,-125,10],[-180,-70,13],[-165,-36,15],[-140,-6,16.5],[-100,0,17.5],[-50,0,18]]}
{"id":"terminal","name":"North Sea Terminal","world":1,"lapTarget":1750,"width":15,"labels":[[100,22,"quay straight, start (cranes, sea to the north)"],[290,-40,"Crane hairpin"],[60,-120,"container canyon"],[290,-250,"reefer corner"],[0,-320,"back straight + flick"],[-320,-150,"west yard"]],"waypoints":[[0,0,0],[200,0,0],[255,-12,0],[268,-42,0],[245,-66,0],[200,-66,0],[120,-66,0],[92,-84,0],[86,-125,0],[86,-160,0],[105,-182,0],[230,-182,0],[260,-200,0],[268,-235,0],[262,-268,0],[240,-286,0],[200,-290,0],[60,-290,0],[20,-278,0],[-20,-294,0],[-200,-290,0],[-245,-266,0],[-260,-225,0],[-262,-80,0],[-255,-30,0],[-225,-3,0],[-170,0,0]]}
```

Run from `track-viewer`:
```
node scripts/sketch-layouts.mjs --png
```
It writes `docs/career-worlds/{pilbara,terminal}.{json,svg}`. Reader 1 measured that the other tracks' outputs come out byte-identical; check with `git status docs/career-worlds`.

**Accept when:**
- The asserts pass (lap within 20 m of target, clearance more than 30 m).
- The scratch metrics hold: `node D:/RaceUltimate-wt/maps/qa/10x-scratch/judge/sketch.mjs` after copying the two entries into its `layouts.json`.
  - Pilbara: smoothed grade ≤ 8 %, crest vertical radius ≥ 620 m (measured 1193 m), straight into the line ≥ 70 m (measured 70), tightest radius ≥ 20 m.
  - Terminal: straight into the line ≥ 70 m (measured 160).
- The 8 grid slots sit 8-64 m behind the line (`career_lib.py:156`), so 70 m of straight covers them.

## 4. Pilbara Pit (WP3)

### Files

New, under `tracks/pilbara/`:
- `build_pilbara.py`: sets `H`, `ID='pilbara'`, `PFX='PP'`, then `exec(career_lib)` the way `build_llano.py:14-15` does.
- `render_views.py`, `pack-web.mjs` (a copy of `tracks/drylake/pack-web.mjs` with `drylake` replaced by `pilbara`) and `CREDITS.md` (CC0 sets only).

The backdrop reuses `tracks/drylake/tex/backdrop_{day,dusk}.png` in place, read through `H.parent/'drylake'/'tex'`. Kerbs use `tracks/qingshan/tex/kerb_{red,white}_diff.jpg`.

### Materials

There are 15, all photo-textured except the water and the backdrops. Built with `career_lib.material()`, with `UVS` set in metres per repeat.

| key | name | set | notes |
|---|---|---|---|
| asphalt | PP \| asphalt | asphalt_track, `diff=tracks/drylake/tex/asphalt_track_bleached_diff_2k.jpg` | the shared road set |
| line | PP \| line white | brushed_concrete, `diff='none'`, vcol white | |
| kerb_r / kerb_w | PP \| kerb red / white | brushed_concrete + qingshan kerb diffs | as `build_qingshan.py:12` |
| barrier | PP \| barrier | concrete_wall_009 | jersey barriers |
| ground | PP \| ground | red_laterite_soil_stones, vcol tone | berms, floor, rim, **and** bench faces (slope UV, below); UVS 6 |
| gravel | PP \| gravel | gravel_ground_01 | shoulders and windrows; UVS 4 |
| far | PP \| far terrain | red_laterite_soil_stones, vcol | UVS 40 |
| rock | PP \| rock | red_laterite_soil_stones | boulders; UVS 3 |
| concrete | PP \| concrete | dirty_concrete | crusher base, plinths, footings |
| corr | PP \| corrugated | rusty_corrugated_iron | crusher upper box, water tank, shed roofs |
| clad | PP \| cladding | box_profile_metal_sheet | its own red-oxide colour suits a mine; conveyor gallery, shed walls |
| steel | PP \| steel | rusty_corrugated_iron ARM + normal at strength 0.15 | trestles and columns |
| water | PP \| pit lake | flat (0.05, 0.16, 0.15), rough 0.09 | static, as the Venice water (`build_venice.py:103`) minus the bump |
| backdrops | `Backdrop \| goegap day` / `dusk` | Dry Lake PNGs | `backdrop()` copied from `build_drylake.py:322-343` |

### Geometry, in build order

1. **Road.** `road(7.5, 140)`: road, lines, start line, 8 grid marks, kerbs below R140. Then `barriers(14)`: jersey barriers 14 m out, clamped on the inside of tight corners by career_lib.
2. **Shoulders and windrows.**
   - The run-off from the road edge to the barrier is a gravel strip (`strip()` at offsets HW..BD, z −0.12). It is collision `col_grass`.
   - Behind each barrier sits a visual-only laterite/gravel windrow: a trapezoid 1.6 m high, 4 m base, inner toe at BD + 0.8. It is not collision; the barrier remains the wall (from design 1).
3. **Terrain.** One heightfield, uniform 4 m cells over the lap's bounding box plus 120 m. That is about 186 × 147 cells, roughly 55k triangles (an estimate). Height function, using KD `find_range` over stations within 220 m:
   ```
   rise(d) = 0 for d < BD+6;  else s = d-(BD+6) + 3*fbm(x/40,y/40,3);  6*floor(s/14) + 6*ss(0,4.5, s mod 14)   # 6 m benches: 4.5 m face (53 deg), 9.5 m berm
   inside  (point-in-polygon of the centreline): z = max_i( zr_i - rise(d_i) ), floored at LAKE-1.5 (LAKE = -6)
   outside: z = min_i( zr_i + rise(d_i) ), capped at 18 + 2 + 3*fbm (rim spoil)
   within d < BD+6 of the nearest station: Dry Lake's blend to zr - 0.12 (build_drylake.py:270)
   ```
   - The max and min of continuous terms keep the ground crack-free where two road legs' terraces meet.
   - Skip faces under the road, as Dry Lake does.
   - **Slope UV:** for faces with normal.z < 0.75, set u = the horizontal tangent·p and v = z, so the laterite never stretches on bench faces. Flat faces use world x, y.
   - Give vertex colours a darker tone on faces and a lighter one on berm tops.
   - Collision `col_grass` = ground quads with any vertex within 46 m of the road (`build_drylake.py:279`).
4. **Pit lake.** One water plane at z = −6 over the floor's lowest region inside the loop. The ground dips at least 0.5 m below it, so there is no coplanar flicker.
5. **Far ring and backdrop.**
   - Dry Lake's radial far ring (`build_drylake.py:298-315`), with radii from 450 m to 8.5 km. It keeps the dive-under lip, so ring and grid never coincide. Its mesas read as waste-rock dumps.
   - Five backdrop arcs 6.5 km out, day over dusk.
6. **Crusher and conveyor.** Dry Lake-style `box()` and `cyl()` helpers.
   - The crusher stands on the pit floor inside the loop, beside the crusher chicane: a dirty_concrete base 20×14×8 m with a rusty-corrugated upper box 16×12×10 m.
   - An enclosed conveyor gallery (3×3 m box clad in box_profile) runs from the crusher up the outside wall to the rim. It crosses the floor road at the chicane with its underside 8 m or more above the road.
   - Trestle columns (0.5 m steel boxes) stand every 18 m, all outside the barriers. No collision.
7. **Rim buildings.**
   - A workshop shed on the rim beside the start straight: 30×18×9 m, clad walls, corrugated roof, painted_metal_shutter roller doors.
   - A water tank: a 32-segment smooth cylinder in rusty_corrugated_iron (not the faceted cone reader 1 saw at Dry Lake) on a concrete plinth.
8. **Boulders.** 250 boulders: 3 displaced ico meshes of about 80 triangles each, scattered on berms and the floor more than 4 m behind barriers, baked into one mesh.
9. **Finish.**
   - `collision()`: col_asphalt, col_curb, col_grass, col_wall. col_paved is unused; pass none.
   - `write_track('Pilbara Pit', credits, ['day','dusk'], 'day', landmarks=[{'name':'Crusher', ...}])`, then `export()`.
   - Name every mesh `PP <thing>`, one mesh per material.

**Triangle estimate:** about 140k (ground 55k, far 27k, road set about 35k, windrows 10k, plant 10k, boulders 20k).

### Hero stretch first

Before dressing the whole lap:
1. Build with `-Rest --no-export,stretch`, where `stretch` limits terrain and dressing to stations covering the descent and the switchback (lap metres 380-640).
2. Render two stills (switchback day, descent dusk).
3. If the bench faces read as sawtooth or the laterite stretches, fall back to swept bench strips along road offsets in the near 70 m (design 3), clamped to 0.62·R on the inside of corners like `barriers()`.

## 5. North Sea Terminal (WP4)

### Files

`tracks/terminal/` holds `build_terminal.py` (`ID='terminal'`, `PFX='NT'`), `render_views.py`, `pack-web.mjs`, `CREDITS.md` and `tex/`. `tex/container_grey_diff_1k.jpg` is derived in Blender from `box_profile_metal_sheet_diff_2k.jpg`:
- Desaturate it, scale it to a mean of 0.72 and save at 1k.
- The original is red-oxide paint with ribs and small fastener dots (I looked at it). Grey lets vertex colour tint each container.
- Record it in CREDITS.md as derived from CC0.

### Materials

There are 15, all textured except the water.

| key | set | use |
|---|---|---|
| asphalt, line, kerb_r, kerb_w, barrier | as Pilbara | |
| yard | interlocking_concrete_pavers, UVS 4, vcol variation | the whole yard; run-off is collision `col_paved` |
| apron | brushed_concrete | quay apron strip and crane rail beams |
| quay | seaworn_stone_tiles | 2 m capping along the quay edge, quay wall face |
| box | box_profile ARM + normal, `diff=tex/container_grey_diff_1k.jpg`, vcol | containers **and** shed walls (one draw) |
| crane | same as box, but normal strength 0.2 | crane steel, high-mast poles |
| roof | rusty_corrugated_iron | shed roofs |
| door | painted_metal_shutter | shed roller doors |
| concrete | dirty_concrete | bollards, reefer-rack bases, plinths |
| fender | `tracks/llano/tex/rubber.png` (exists) | quay fenders |
| water | flat (0.04, 0.07, 0.07), rough 0.09 | static sea |
| far | dirty_concrete, vcol, UVS 30 | far yard ring |

### Geometry

1. **Road and barriers.** `road(7.5, 140)`, then `barriers(lambda i: 10 if i is on the quay straight else 11)`. The quay straight is the stations from 250 m before the line to 150 m after it.
2. **Ground.** Flat, so one coarse grid is enough: 24 m cells at z −0.12 over the bounding box plus 400 m (about 3k triangles). Skip faces under the road. Collision `col_paved` = quads within 46 m of the road. Use no fine grid: the road skirts (−0.4) hide the edges.
3. **Quay.**
   - The quay edge runs parallel to the quay straight, 21.5 m to its north (sea side), with seaworn capping and a 3 m vertical quay wall.
   - The sea plane sits 2.5 m below quay level and reaches 4 km north. Nothing is coplanar with it.
   - Bollards every 25 m (concrete). Fender panels every 20 m on the wall face.
4. **Three ship-to-shore cranes** (booms up, no ship), one mesh instanced ×3 or baked, at lap metres about 40, 110 and 180 on the quay straight.
   - Rail gauge 30.5 m, centred 4 m seaward of the road, so the legs sit at lateral +19.25 and −11.25. **The road runs between the legs, outside both barriers.**
   - Box-section legs 2.5×2.5 m, the portal beam at 40 m, a machinery house of 12×8×6 m, and a raised boom about 65 m long at 80°.
   - About 3k triangles each, vcol light grey or white. No collision.
5. **Container yard.**
   - Use ISO 40 ft boxes, 12.19 × 2.44 × 2.59 m, set out in rectilinear yard blocks between the lap's legs. Real yards are rectilinear, and the lap's legs run along x and y.
   - Rows are 0.4 m apart side by side, with 1.5 m between bays end to end. Stack heights are 1-5, mostly 3-4.
   - Cull any container within BD + 3 m of the centreline. Rows whose face is within 40 m of the road get the detailed box (about 150 triangles: body, corner castings, top and bottom rails, door end with 4 locking bars). The rest are 12-triangle boxes.
   - Omit coincident top and bottom faces inside a stack, so nothing is coplanar.
   - Vertex-colour tints, multiplied over the grey diffuse: rust red (.55,.18,.12), navy (.12,.2,.35), slate (.45,.47,.48), green (.18,.35,.22), cream (.75,.7,.6), ochre (.65,.45,.15), reefer white (.85,.85,.83), with ±6 % per-box jitter.
   - Ribs vertical and about 2 m per texture repeat. **No text or logos.**
   - About 1,000 boxes, about 60k triangles, merged into one mesh.
   - Reefer stacks along the reefer corner get plug-rack gantries: steel boxes on concrete bases.
6. **Buildings.** Two transit sheds of 60×30×12 m (box walls, roof, roller doors) in the west yard, outside the barriers. Eight unlit 30 m high-mast poles (16-segment cylinders, crane steel).
7. **Far ground.** A flat far ring (dirty_concrete, vcol) out to 3 km on the land side, with about 40 more 12-triangle container blocks as a landside skyline. No backdrop arcs: the sea is the horizon. Fog is set in `tracks.js`.
8. **Finish.** `collision()` with `paved_faces`, then `write_track('North Sea Terminal', ..., ['day','dusk'], 'day', landmarks=[{'name':'Cranes', ...}])`, then `export()`.

**Triangle estimate:** about 125k.

### Hero stretch first

Before the whole yard (design 2, after the user's Venice feedback):
1. Build the quay straight, one crane and the first canyon block with `-Rest --no-export,stretch`.
2. Render two stills: quay at dusk, canyon by day.
3. If the containers read as flat boxes, add rail and casting depth and more tint variation first.
4. If the crane steel reads wrong, switch it to `painted_metal_shutter` diffuse with a flat normal.

## 6. Budgets, pass or fail per map

Measure with:
```
node scripts/glb-stats.mjs ../tracks/<id>/out/web/<id>_visual_ktx2.glb ../tracks/<id>/out/web/<id>_collision.glb
```
run from `track-viewer` (reader 2's tool), plus the Blender log line `triangles`.

| item | target | Dry Lake (measured) |
|---|---|---|
| KTX2 visual | ≤ 12 MB (the shared asphalt set is a fixed 5.43 MB) | 11.41 MB |
| unique triangles | ≤ 250k | 322k |
| venue draws | ≤ 22 (one mesh per material) | 20 |
| materials | ≤ 22, every one textured except water and backdrops | 20, only 6 textured |
| images | 1k ETC1S apart from the road set (the packer's rules) | 21 |
| collision | ≤ 0.5 MB, ≤ 15k triangles, `col_*` names only | 0.36 MB / 12k |
| frame time: perf-mac race, 8 cars, day, same sitting as a Dry Lake control | avg ≤ Dry Lake + 0.5 ms, p95 ≤ 13 ms, 1 % low ≥ 50 fps | 10.06 / 12.2 ms / 57 fps |
| lights | none: no `lights.json`, no lamps | none |

## 7. Pack, sync, register (WP5)

From `D:/RaceUltimate-wt/maps`, in Bash:
```
npm_config_offline=true node tracks/pilbara/pack-web.mjs
npm_config_offline=true node tracks/terminal/pack-web.mjs
cd track-viewer && SYNC_ONLY=pilbara,terminal node scripts/sync-assets.mjs
```
Before syncing, add `'pilbara', 'terminal'` to the id list at `scripts/sync-assets.mjs:31`.

**`src/tracks.js`:** add two entries after `drylake` (`:64-70` is the template):
```js
pilbara: { id: 'pilbara', name: 'Pilbara Pit', stem: 'pilbara', dir: '/assets/pilbara/', look: 'day', times: ['day', 'dusk'], fog: 0.6, sun: [-0.55, -0.77], tag: null,
  dayNight: { day: /^Backdrop \| goegap day$/, dayEnd: 0.35 },
  wet: { wet: ['PP | asphalt', 'PP | line white', 'PP | kerb red', 'PP | kerb white'], puddles: ['PP | asphalt'] }, voidWalls: true,
  has: { pit: false, vip: false, hoardings: false, people: false, yachts: false, buildings: false, teamDress: false } },
terminal: { id: 'terminal', name: 'North Sea Terminal', stem: 'terminal', dir: '/assets/terminal/', look: 'day', times: ['day', 'dusk'], fog: 0.7, sun: [-0.55, -0.77], tag: null,
  wet: { wet: ['NT | asphalt', 'NT | line white', 'NT | kerb red', 'NT | kerb white'], puddles: ['NT | asphalt'] }, voidWalls: true,
  has: { /* all false */ } },
```
- `dayNight` is optional (`main.js:897` returns without it), so the terminal leaves it out.
- Tune `sun` after the view stills.
- The menu lists both through `availableTracks()` once the files are synced.

**`src/game/race-loading.js` `LOADING_SLIDES`:** add
- `{ track: 'pilbara', title: 'Down into\nthe red.', text: 'A haul road off the rim of an open-cut iron mine: down the bench wall, one switchback, across the pit floor under the conveyor, and a blind crest back onto the rim.' }`
- `{ track: 'terminal', title: 'Steel walls\non every side.', text: 'A Sunday at the container terminal: a quay straight under the cranes, then a canyon of boxes stacked four high. You never see the next corner until you are in it.' }`

**`scripts/make-ui-stills.mjs` VIEWS:**
- `pilbara: { look: 'dusk', cam: [205, 5, 4], tgt: [222, 2, 0] }` (into the switchback, the benches beyond)
- `terminal: { look: 'dusk', cam: [690, 3.5, 2], tgt: [40, 12, 2] }` (down the quay under the cranes)

Then run, keeping each still ≤ 160 KB:
```
ONLY=pilbara,terminal node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/make-ui-stills.mjs tracks http://127.0.0.1:5303
```
The current set is 1,134,642 bytes (measured) against the 1.5 MB cap in `test-race-loading.mjs:37`.

**`src/game/career-shell.js:72` `SHORT`:** add `pilbara: 'Pit', terminal: 'Port'`.

## 8. Career rotation (WP7)

**`assets/career/calendar.json`:**
- Keep `"qualifying": "drylake"`. It stays the default and the fallback for old saves.
- Add `"tracks"` entries with the **measured** par:
  ```
  "pilbara": { "event": "sprint", "parLap": <measured>, "measured": "measured", "names": ["Pit Sprint", "Pit Return"], "dryOnly": true }
  "terminal": { "event": "sprint", "parLap": <measured>, "measured": "measured", "names": ["Quay Sprint", "Terminal Return"], "dryOnly": true }
  ```
- In a **separate last commit** (so the user can revert one line after their Blender review), add `"qualifyingPool": ["drylake", "pilbara", "terminal"]`.

**`src/game/career/rules.js` `buildCalendar` (`:73-94`).** Use a **separate** rng stream. The existing `r` stream drives the look and weather draws in sequence at `:86-89`, so any extra `r()` call would change every existing seed's calendar.
```js
const QP = (CAL.qualifyingPool ?? [CAL.qualifying]).filter(has), q0 = Math.floor(rng(seed, 'quali', season)() * QP.length);
// in the map callback:
const qualiTrack = QP.length ? QP[(q0 + i) % QP.length] : CAL.qualifying;
return { round: i + 1, track, kind, event: kind, look, weather, laps: lapsFor(track, length), qualiTrack, ...(kind === 'open' ? { lcqLaps: lapsFor(qualiTrack, length) } : {}), name, finale };
```
- A round-robin from a seeded start gives no repeats in a row whenever 2 or more venues are available, and an even share across the season.
- `has()` (`:79`) drops any venue whose assets are not shipped, so the code is safe to land before the maps.
- Name the field `qualiTrack`, not `quali`: `season.current.quali` is already the qualifying result (`career.js:190-345`).
- Known gap: the last qualifying round of one season and the first of the next can match.

**`src/game/career/career.js`:**
- `:320`: `track: currentRound(save).qualiTrack ?? CAL.qualifying`.
- `:300`: `if (r.lcqLaps) r.lcqLaps = lapsFor(r.qualiTrack ?? CAL.qualifying, length)`.
- Everything else reads `qualiVenue`: `career.js:207,216,231,337,353`, the hub text at `career-hub.js:41,150,164-165`, and `career-sim.mjs:61,65`. The Shootout uses `CAL.shootout` and stays at Dry Lake.

**Tests:**
- `scripts/test-career.mjs`. Its existing avail map (`:33`) lacks the new ids, so the pool filters down to Dry Lake and `:335`/`:337` keep passing unchanged. Add a block with `avail2 = { ...avail, pilbara: ['day','dusk'], terminal: ['day','dusk'] }`:
  - For seeds 1..20 and seasons 1..3, every `qualiTrack` is in the pool, and no two consecutive rounds share one.
  - All three venues appear in each season.
  - The look, weather, track and laps of `buildCalendar(5,1,1,avail)` are deep-equal to the same call before the change (snapshot taken in the test from a pool-less CAL copy).
  - A round with `qualiTrack` deleted gives `qualiVenue(...).track === 'drylake'`.
  - `lcqLaps === lapsFor(R.qualiTrack, len)`, and each venue's `lapsFor` is within `lapsMin` and `lapsMax`.
  - The shootout is still Dry Lake.
- `scripts/career-sim.mjs:11` `AVAILABLE` and `scripts/test-menu.mjs:38` `avail`: add both ids with `['day','dusk']`.

**Docs:**
- `track-viewer/docs/career-worlds.md:24` and `track-viewer/docs/career-mode.md:27` change from "always at Mojave Dry Lake" to "rotates between Mojave Dry Lake, Pilbara Pit and North Sea Terminal, fixed per round, never twice in a row; the Shootout stays at Dry Lake".
- Add a short section to career-worlds.md for each map: layout, materials, budget.

## 9. QA gate per map (WP6), in order, from `D:/RaceUltimate-wt/maps/track-viewer`

1. **Physics contract and an AI lap (no browser).**
   ```
   TRACK=pilbara node scripts/test-track.mjs
   ```
   Expect PASS, 4-5 surfaces, 0 bad ground rays, 0 walls intruding, 8 grid slots on asphalt, and a completed lap. It reads `../tracks/<id>/out`.
2. **Wall to wall drivable.**
   ```
   node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-drivable.mjs pilbara http://127.0.0.1:5303
   ```
   Expect exit 0: 0 void walls inside, 0 invisible stops, 0 holes. On Pilbara, look at the steps over 0.12 m through the switchback and on the bench edges.
3. **Player lap.**
   ```
   BASE=http://127.0.0.1:5303 node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-player-lap.mjs pilbara nissan-z
   ```
   Expect no sudden speed losses and no ride spikes on the crest. The memory note says this test catches stops the others missed.
4. **Par lap,** with Dry Lake as a control that must reproduce about 45.3 s.
   ```
   node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/measure-par-laps.mjs pilbara,terminal,drylake bmw1,huracan,destrier http://127.0.0.1:5303
   ```
   Write the result into `calendar.json` `parLap`.
5. **Views, day and dusk.** Write `tracks/<id>/views.json` with entries `{ "name": { "cam": [station, up, side], "tgt": [station, up, side] } }` (`qa-drylake-views.mjs:36-38`), then run:
   ```
   TRACK=pilbara VIEWS=../tracks/pilbara/views.json node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-drylake-views.mjs http://127.0.0.1:5303 day,dusk
   ```
   Stations are about 2.5 m apart.
   - Pilbara: start `[690,3.5,2]→[20,3,0]`; switchback `[200,4,3]→[217,2,0]`; bench loop `[280,12,-10]→[300,4,0]`; conveyor `[440,3,2]→[470,8,0]`; crest `[620,3,2]→[660,4,0]`.
   - Terminal: quay `[690,3.5,2]→[30,12,2]`; crane hairpin `[95,4,3]→[108,2,0]`; canyon `[185,3,2]→[200,3,0]`; reefer `[285,3,2]→[300,3,0]`; back straight `[395,3,2]→[420,3,0]`.

   Expect no console errors, draws and triangles within budget, and no flicker or banding in the PNGs.
6. **Frame time,** in one sitting: Dry Lake first as the control, then both maps.
   ```
   node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-mac.mjs drylake --url http://127.0.0.1:5303 --label partc
   node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-mac.mjs pilbara --url http://127.0.0.1:5303 --label partc
   node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/perf-mac.mjs terminal --url http://127.0.0.1:5303 --label partc
   ```
   Output goes to `qa/perf-mac/partc-<track>.json`. Check CPU load before the runs.
7. **Race-watch,** one lap per look.
   ```
   node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-race-watch.mjs pilbara day 1 http://127.0.0.1:5303
   ```
   Repeat with `dusk`. Expect 0 dark frames, no stops, and the camera never inside scenery (the conveyor gallery, the crane legs).
8. **Unit and UI tests.**
   ```
   node scripts/test-career.mjs && node scripts/test-menu.mjs && node scripts/test-race-loading.mjs && node scripts/career-sim.mjs
   node D:/RaceUltimate/track-viewer/scripts/qa-lock.mjs -- node scripts/qa-career-tour.mjs http://127.0.0.1:5303
   ```
   The career tour's LCQ now runs at the round's venue.

## 10. Blender review deliverables (for the user, before the maps enter the pool)

**`tracks/<id>/render_views.py`** is copied from `tracks/llano/render_views.py` with its hard-coded `H` (`:7`) replaced by `Path(__file__).resolve().parent` and `PH = H.parents[1]/'assets'/'polyhaven'`. It renders:
- **Stills:** EEVEE, 1280×720, 16 samples, AgX, under the game's noon and Belfast-sunset HDRIs. Five views × day and dusk, plus one dusk overview from 250 m up: **11 stills per map** in `tracks/<id>/out/review/<view>-<look>.png`.
- **`tracks/<id>/out/<id>_review.blend`:** sky and sun at dusk, collision hidden, camera clip at 20 km.

Run:
```
powershell -File D:/RaceUltimate/tracks/india/run_blender_locked.ps1 -Script D:/RaceUltimate-wt/maps/tracks/pilbara/render_views.py -Blend D:/RaceUltimate-wt/maps/tracks/pilbara/out/pilbara.blend -Log D:/RaceUltimate-wt/maps/tracks/pilbara/render_views.log
```
Keep each job short; the PC overheats and its AMD driver has bugchecked under long GPU load.

## 11. Commit order (after validate and tests pass, staging only your own paths)

1. WP1 foundation.
2. WP2 layouts.
3. WP3 Pilbara.
4. WP4 Terminal.
5. WP5 registry and stills.
6. WP7 rotation code and tests. This is inert: there is no pool yet.
7. `qualifyingPool` plus `parLap` in calendar.json, the last commit.

If the night runs short, ship Pilbara alone: the pool takes any subset.

## 12. Not done here

- **Measured this session:** the two layouts' metrics; the npx offline cache; the texture-set sizes; the stills total; the code paths cited.
- **Inferred, not measured:** every triangle, MB, frame-time and par number for the new maps.
- **Unchecked:** whether Blender sets `__file__` under `-P`; how box_profile reads on containers and crane steel; whether a 4 m heightfield gives clean bench lines.
- **Left out:** a flyover. `session.js:38-44` (windowed, 3D) and `cars.js:635` (full 3D scan) would tell the levels of an 8 m crossing apart, so it is a feasible later upgrade for the terminal, not tonight's work.


## Work packages

### WP1 Path-safe build base and local inputs

**Outcome:** New track builds read inputs and write outputs inside the worktree. The 8 needed Poly Haven sets are copied in with credits. qa-player-lap takes a BASE url.

**Files:** tracks/career_lib.py:13 (ROOT = H.resolve().parents[1]); assets/polyhaven/{red_laterite_soil_stones,gravel_ground_01,rusty_corrugated_iron,dirty_concrete,box_profile_metal_sheet,interlocking_concrete_pavers,seaworn_stone_tiles}/ copied from D:/RaceUltimate (read-only); assets/polyhaven/CREDITS.md; track-viewer/scripts/qa-player-lap.mjs:19 (process.env.BASE)

**Acceptance:** Existing build_*.py still resolve ROOT to D:/RaceUltimate (H set first: build_llano.py:14-15, build_shajawa.py:14-15). A new build with H in the worktree writes only under D:/RaceUltimate-wt/maps/tracks/<id>/out. git status in D:/RaceUltimate is unchanged. The sets go through LFS.

### WP2 Author and check both layouts

**Outcome:** pilbara.json/svg and terminal.json/svg exist from the exact waypoints in the spec.

**Files:** track-viewer/docs/career-worlds/layouts.json (+2 entries); generated docs/career-worlds/{pilbara,terminal}.{json,svg}

**Acceptance:** node scripts/sketch-layouts.mjs passes its asserts, and the other tracks' outputs are byte-identical. Pilbara: 1.75 km ±20 m, smoothed grade ≤ 8 %, crest vertical radius ≥ 620 m, ≥ 70 m straight into the line, tightest r ≥ 20 m. Terminal: 1.75 km ±20 m, closest pass > 30 m, ≥ 70 m straight into the line (checked with qa/10x-scratch/judge/sketch.mjs).

### WP3 Pilbara Pit Blender build, pack and review

**Outcome:** An open-cut mine qualifier: 18 m drop, terraced laterite benches with slope-projected UVs, windrows behind the jersey barriers, crusher, conveyor gallery over the floor road, pit lake, rim shed and tank, goegap backdrop. Day and dusk only.

**Files:** tracks/pilbara/{build_pilbara.py,render_views.py,pack-web.mjs,CREDITS.md}; outputs tracks/pilbara/out/{pilbara.blend,pilbara_visual.glb,pilbara_collision.glb,track.json,web/*,pilbara_review.blend,review/*.png}

**Acceptance:** The hero stretch (descent and switchback) is rendered and judged first. KTX2 ≤ 12 MB, ≤ 250k unique triangles, ≤ 22 draws, every material textured except water and backdrops, collision ≤ 0.5 MB and ≤ 15k triangles. 11 EEVEE stills plus pilbara_review.blend. Packed with npm_config_offline=true.

### WP4 North Sea Terminal Blender build, pack and review

**Outcome:** A flat walled container-terminal qualifier: a 320 m quay straight between the legs of three booms-up STS cranes, about 1,000 tinted ISO containers in rectilinear blocks (detailed front row), reefer racks, transit sheds, static sea.

**Files:** tracks/terminal/{build_terminal.py,render_views.py,pack-web.mjs,CREDITS.md,tex/container_grey_diff_1k.jpg}; outputs tracks/terminal/out/*

**Acceptance:** The hero stretch (quay, one crane, first canyon block) is rendered and judged first. Same budgets as WP3. No text or logos. No coplanar faces (stack interiors omitted, water 2.5 m below the quay). 11 stills plus terminal_review.blend.

### WP5 Register in game, menus and loading

**Outcome:** Both maps load in Free Drive and race menus with day and dusk, have loading slides and stills, and sync from out/web.

**Files:** track-viewer/scripts/sync-assets.mjs:31; track-viewer/src/tracks.js (2 entries after drylake); track-viewer/src/game/race-loading.js LOADING_SLIDES; track-viewer/scripts/make-ui-stills.mjs VIEWS; track-viewer/public/assets/ui/stills/tracks/{pilbara,terminal}.webp; track-viewer/src/game/career-shell.js:72 SHORT

**Acceptance:** SYNC_ONLY=pilbara,terminal node scripts/sync-assets.mjs copies 4 files each. availableTracks() lists both. node scripts/test-race-loading.mjs passes: slides match TRACKS, stills total < 1.5 MB, each new still ≤ 160 KB.

### WP6 QA gates and measured par

**Outcome:** Each map passes physics, drivability, player lap, views, frame time and race-watch, and has a measured parLap.

**Files:** qa/10x-scratch/{pilbara,terminal}-views.json; assets/career/calendar.json tracks.{pilbara,terminal}

**Acceptance:** test-track PASS (0 bad rays, 0 intruding walls, 8 grid slots). qa-drivable exit 0. qa-player-lap with no stops. measure-par-laps with Dry Lake reproducing about 45.3 s, and each new par in 40-55 s. Views day and dusk with no console errors. perf-mac avg ≤ Dry Lake + 0.5 ms and p95 ≤ 13 ms in the same sitting. race-watch with 0 dark frames for each look. All browser runs through qa-lock on 127.0.0.1:5303.

### WP7 Deterministic qualifying rotation

**Outcome:** Each round stores qualiTrack, drawn round-robin from a seeded start on a separate rng stream over the available qualifyingPool. qualiVenue and LCQ laps use it. Old saves and the Shootout stay at Dry Lake. The pool is enabled in a last, revertible commit.

**Files:** track-viewer/src/game/career/rules.js:73-94; track-viewer/src/game/career/career.js:300,320; assets/career/calendar.json (qualifyingPool, last commit); track-viewer/scripts/test-career.mjs; track-viewer/scripts/career-sim.mjs:11; track-viewer/scripts/test-menu.mjs:38; track-viewer/docs/career-worlds.md:24; track-viewer/docs/career-mode.md:27

**Acceptance:** test-career.mjs passes. New asserts: no consecutive repeats over seeds 1-20 and seasons 1-3; all three venues each season; existing look, weather, track and laps unchanged for a fixed seed; a round missing qualiTrack gives drylake; lcqLaps matches the round's venue; the shootout is still drylake. test-menu, career-sim and qa-career-tour pass.

## Biggest risk

The biggest risk is Pilbara's terraced ground where it meets a road on a 6 % grade through the r21 switchback. A heightfield built from the max and min of per-station terraces could leave steps, holes or invisible stops in the run-off band, which qa-drivable and qa-player-lap would fail. It could also leave sawtooth bench crests and stretched laterite, the cheap look the user rejects.

Mitigation:
- Build and render the descent-to-switchback stretch first.
- Run test-track and qa-drivable on it before any dressing.
- If either the stills or the gates fail, switch the near 70 m to swept bench strips along road offsets.

The second risk is that box_profile containers and crane steel still read as placeholder boxes. That is why the terminal's hero stretch (quay, one crane, first canyon block) is judged before the yard is filled.

## How the designs scored

Scores 1-10, in the order: player impact, feasibility tonight, risk to existing behaviour (higher = safer), fit with the user's constraints.

DESIGN 1 (variety): 8 / 5 / 8 / 7, mean 7.0.
- Best rotation of the three: a separate rng stream, with the `qualifying` string kept as the default. I checked that rules.js:86-89 draws look and weather from one sequential stream, so the separate stream is needed. It also has the crest vertical-radius rule.
- But its 270-300° descending "Spiral" has to cross its own entry in plan, which means a bridge it never plans for.
- It keeps the flyover.
- Its 12-triangle containers risk the placeholder look.

DESIGN 2 (lean): 6 / 9 / 6 / 9, mean 7.5. **Winner and base.**
- Strengths: the `ROOT = H.parents[1]` fix (I checked that H is set before the exec), copying the sets in, offline npx, no flyover, every material textured, budgets below Dry Lake's, the hero stretch first.
- Its rotation draws `off` from the calendar's own `r()`, which would shift every later look and weather draw. I verified that this changes existing seeds.
- Turning `qualifying` into an array touches every string use.

DESIGN 3 (place): 8 / 5 / 5 / 7, mean 6.25.
- Rich, real detail.
- Its crossing claim checks out: session.js:38-44 uses a windowed 3D lookup and cars.js:635 a full 3D scan.
- But the region-to-venue map with "take the next venue" skews the rotation.
- A round field named `quali` collides with `season.current.quali`, the qualifying result (career.js:190-345).
- The flyover, the swept bench strips, a stencilled-name atlas and 800 instanced containers are too much for one night.

What was grafted:
- **From design 1:** the separate `rng(seed,'quali',season)` stream with `qualifyingPool` and the string fallback; windrows behind the barriers rather than instead of them; a smooth 32-segment tank; start-line placement for the grid; the decreasing-radius reefer corner; the test that a fixed seed's calendar is unchanged.
- **From design 3:** a conveyor gallery you drive under; the pit lake; cranes with booms up and the road between their legs; real ISO container sizes; a detailed front row; a grade cap of 8 % or less; lap counts asserted within lapsMin and lapsMax; the swept bench strips kept as the fallback.
- **From design 2:** the ROOT fix, set copying, offline packing, the non-crossing terminal, the flat coarse ground, budgets and the commit order.

New from my own checks:
- **Measured layouts with a calibrated par.** The point-mass model is calibrated on Dry Lake and predicts Shajawa B at 61.9 s against a measured 62.3 s.
- **`large_sandstone_blocks` is dropped.** It is a masonry wall, not rock.
- **The box_profile diffuse is red oxide,** so a grey derivative is needed before tinting containers.
- **`qualiTrack` as the field name.**
