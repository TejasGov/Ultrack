# Corniche Marina Circuit (Track B)

Generated, not hand-modelled: change `layout.py`, run the build, and everything below is rebuilt.

| File | What it is |
|---|---|
| `layout.py` | The circuit as straights and arcs, closed exactly. Also the design data: kerbs, run-off, walls, pit lane, water, grid, sectors. Plain Python, no Blender needed. |
| `build_blender.py` | Turns the layout into meshes and PBR materials in headless Blender, exports GLBs and `track.json`, and renders previews. |
| `venue.py` | Venue pass, after dress.py: invented sponsors (fence boards, LED boards, billboards, bridge banner, painted run-off logos, big screen), TecPro blocks (part of `col_wall`), marshal posts with flag panels, TV towers, the footbridge, start lights, the hospitality floor, grandstands at T1 and T6, and alpha-cut crowds in all stands. **The sponsor names are invented: check them against trademark registers before release.** |
| Ultrack branding | The logo comes from `Ultrack.png` via `python tools/prep_logo.py`, which writes `assets/brand/ultrack_logo_dark.png` and `ultrack_logo_alpha.png`. Kept rare: about 1 in 9 fence and LED boards, 2 billboards (before T1 and the hairpin), 3 neon signs (pit roof, a pylon behind the T1 grandstand, a pylon at the marina entry), and the big screen. |
| `backdrop.py` | Waterfront skyline across the marina (~110 towers on a far shore 1.4 km west) and an inland one east (~45), each merged into one mesh. Generated window textures light up through emission. Also the Marina Crescent hotel: an original 22-floor crescent with an LED crown, on the infield ≥ 78 m from the track (asserted). |
| `paddock.py` | Paved paddock behind the garages. The eight teams, their colours and their pit boxes come from `assets/teams/teams.json` (the file the game reads): 12 team transporters (one per box), 8 hospitality motorhomes, and each box's lit garage header and painted floor panel (per-team materials `M_GarageHeader_<TEAM>`, `M_PitBox_<TEAM>`; the viewer paints them in the team's font). Team flags on the pit roof and grandstand roofs all stream east in one wind. Vertical pole banners on street lamps and floodlights, and sponsor fascia boards under the grandstand roofs. **The team names are invented, like the sponsors.** |
| `apply_teams.py` | Patch, not a build step: adds the seventh and eighth teams (Liberty, Toro) to `out/marina-logos.blend` (per-team materials, a transporter, motorhome, flag, crew and canopy banner each, lettering in the team's font from `assets/teams/fonts/`), then hands each of the 12 pit boxes (garage header, floor panel, transporter, pole flag, crew) to the team that owns it in `teams.json`, and re-exports `marina_visual.glb`, because the full build can no longer run end to end (brand_art needs board textures made by hand). Run once, then `npm run pack` (and `npm run sync`). Re-running only re-exports. |
| `vip.py` | The Corniche Club, the VIP pavilion mid-infield (centre 330 m north of the start line): a 200 x 70 m plinth, two glass storeys and a 240 m lens-shaped floating canopy with a lit underside and LED rim, only ~15 m tall. The commentary booth cantilevers over the south terrace with a balcony (the announcers' spots go to `out/vip.json`); eight team banners hang from the canopy (Saetta and Toro nearest the booth on the west side) and twelve team flags line the plaza; palms and an access road from the paddock. |
| `life.py` | Life pass, after paddock.py: shrubs and bougainvillea (merged lumpy icospheres, ~250 tris), planters between the promenade palms, clipped hedges along the paddock and behind the main grandstand; 30 pit crew in team overalls, a marshal at every post, officials on the pit wall, tyre stacks (bare and in blankets) at every box; a safety car and a medical car at the pit exit, recovery trucks behind the heavy-braking corners. Lamps that should flash carry `Beacon` in their material name. |
| `trackside.py` | Trackside pass, after life.py (the Project Endurance / Nürburgring look): steel box-truss gantries over five straights and two truss footbridges (3 m modules, GPU instances; each module type has a solid stand-in whose material ends in `Far`, which the viewer's Culler swaps in per instance at distance), brand billboards on scaffold frames along the straights, three tiered paddock/hotel buildings beside the main straight (the tallest carries the stadium name), legend name boards on the stands and banks, and the legend-hologram anchor (a projector ring above the main grandstand, `legend_hologram_anchor` empty, and `track.json` → `landmarks` kind `hologramAnchor`). Walls are painted red/white (`M_Barrier`); run-off is 20 m of grass (`M_Grass`, `col_grass`), gravel on the outside of corners under 250 m, tarmac at the heavy-braking ones (`layout.RUNOFF`). |
| `legends.json` | Every tribute name and brand in one place: stadium name, a legend per stand, bank boards (segment, fraction, side), the hologram's legend, and the car-brand hoardings (sRGB colours, a simple mark). **A non-commercial fan tribute by the user's call: real names and brands, drawn as text and simple shapes, no logo images.** Edit and rebuild to swap. |
| `dress.py` | Art pass, called by the build: catch fences with a leaning overhang, kerb sausages (with their own `col_sausage` collision), braking boards, turn numbers, hoardings, gantry name, palms, stern-to yachts, and the Canopy. Its textures (chain-link, frond, trunk rings) are generated into `out/textures/`. |
| `out/marina_visual.glb` | Visual scene, raw export (~25 MB, mostly 1k/2k JPG textures) |
| `out/marina_collision.glb` | Collision trimeshes, one object per surface: `col_asphalt`, `col_curb`, `col_runoff_tarmac`, `col_sand`, `col_paved`, `col_pit`, `col_wall` |
| `out/web/*.glb` | **What the game loads.** Meshopt + WebP + GPU instancing: 4.5 MB visual, 128 KB collision |
| `out/track.json` | Centerline (4.5 m), widths, corners, sectors, checkpoints, grid slots, pit lane (polyline, limiter, 12 boxes, gate, modes), street zones. Game coordinates: Y up, metres, origin at the S/F line. |
| `out/marina.blend` | The built scene, for inspection |
| `out/previews/`, `out/layout.png` | Renders and the top-down plan |

## Rebuild
```bash
python tracks/marina/layout.py                     # self-checks: loop closes, no part of the track within 8 m of another
python tools/plot_layout.py marina                 # out/layout.png
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tracks/marina/build_blender.py -- --render
cd track-viewer && npm run pack                     # out/web/: WebP visual, collision, KTX2 visual (flags explained in scripts/pack-web.mjs)
cd track-viewer && npm run test:track               # engine contract + a physics lap in Rapier (must print PASS)
```
- **Keep `--join false` on the collision GLB.** Without it, optimize merges all nine surfaces into one mesh named `col_asphalt`, and the game can no longer tell asphalt from sand, kerbs or walls. `npm run test:track` catches this.
- `--render` renders 5 preview shots on the CPU (about 1 minute). `--render --only aerial hairpin` renders a subset.
- `npm run pack` runs gltf-transform `optimize` without compression, then `meshopt` with **16-bit positions**. The 14-bit default of `optimize` is a 12 cm grid on meshes that span the venue: 9 cm fence posts vanished and the leaning arms became floating planks.
- `--simplify false`: simplification flattens the ground grid that carries the sand colour variation (`COLOR_0`).
- `--palette false`: palette merging folds solid-colour materials into nameless ones. The viewer finds beacons, neon, turf, flags and the screen by material name.
- **UVs survive only on textured materials:** gltf-transform prunes UVs that no texture samples. So the big screen carries a small idle texture, and the viewer/game swaps in live timing.
- **Supertalls:** six towers 3–5 km out, materials named `M_Supertall*`. The viewer keeps fog off them and blinks every `*Beacon*` material.
- Textures come from `python tools/fetch_polyhaven.py` (CC0, credited in `assets/polyhaven/CREDITS.md`).

## Lighting looks (the game is raced mostly at dusk, blue hour and night)
```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P tracks/marina/build_blender.py -- --render --look night --only canopy stand_t1
```
| Look | Sky (Poly Haven, CC0) | Preview lights | Notes |
|---|---|---|---|
| `dusk` | `belfast_sunset_puresky` at 1.0 | off | golden, low sun |
| `bluehour` | `qwantani_dusk_1_puresky` at 0.35 | 60 % | LEDs and windows start to carry the frame |
| `night` | `qwantani_night_puresky` at 0.06 | 100 % | Poly Haven's night skies are normalised bright, so the strength is cut hard; the floodlights and LEDs light the venue |

- **Renders:** go to `out/previews/<look>/`, with a Bloom glare pass standing in for the engine's bloom.
- **Preview lights:** they live in the `PreviewLights` collection and are **never exported**. They stand in for the engine's light rig:
  - one spot per floodlight tower
  - a point light per street lamp
  - two spots per bay under each stand roof, one onto the track and one onto the crowd

  In the browser, use a few real shadowed lights plus baked or faked light (lightmaps, light-probe volumes, or emissive cards with bloom). A real light per lamp is not an option there.
- **Night palette** (shared by the build and the engine):

  | Colour | Where |
  |---|---|
  | Teal and deep-blue paint | verges and tarmac run-offs |
  | Violet LED | Canopy lattice, arch strips, hotel crown |
  | Warm white | floodlights, under-roof lamp rows |
  | Sponsor colours | LED perimeter band glowing on dark panels |
- **References:** the user's Yas/Lusail photos were used as references only. Nothing reproduces the Yas hotel's gridshell, real logos or real sponsors. The lit lattice idea lives on our own Canopy sails.

## Budget (current build)
| Item | Value |
|---|---|
| Triangles drawn (life pass) | ~612k: 247k unique, 2,401 objects before optimize joins them. The viewer's distance culling (per instance for palms, lamps, shrubs, crowds of props) removes most of the far half at runtime. |
| Triangles drawn (before life pass) | ~455k: 206k unique. Wear decals are two merged meshes: 2.7k-face cracks (alpha `BLEND`) and patches. Kerbs and asphalt both multiply `COLOR_0`. |
| Triangles drawn (venue pass) | ~414k: 187k unique. The rest are GPU instances: palms 115k, street lamps 61k, ads 26k, yachts 15k, TecPro 10k. The track is 58k: 8 asphalt columns per side carry the rubbered line in `COLOR_0`. |
| Track chunks | 16 (~340 m each), so the browser can frustum-cull them |
| Download size | 5.4 MB visual + 212 KB collision |
| Track data | `track.json` → `racingLine` (lateral offset per sample) drives the rubber here, and is meant for AI, ghosts and wet-line drying in the game |
| Alpha | Fence and palm fronds are alpha-tested (`MASK`), two-sided. Use alpha-to-coverage in the engine, or the chain-link shimmers at a distance. |
| Texture VRAM | WebP build: ~120 MB once the browser decodes it to RGBA. KTX2 build (`npm run pack:ktx2`, no system tools needed: `ktx2-encoder` + gltf-transform): stays compressed on the GPU (BC7/ASTC/ETC), about 4× less. The road's normal map is UASTC; every other texture is ETC1S. The viewer loads KTX2 by default (`?tex=webp` for the other). |

## Engine contract (tested: `npm run test:track` in track-viewer)
- The test loads the shipped `web/marina_collision.glb` into Rapier and checks it against `track.json`:
  - asphalt under every centre-line sample and at both edges, within 0.25 m of the centre-line height;
  - no wall inside the track's width;
  - the grid on asphalt;
  - the pit lane on pit surface.
- It then drives a raycast-vehicle lap on the racing line, with pure-pursuit steering and a grip-limited speed (8 m/s² lateral, 7 m/s² braking).
- Last run: **138.2 s, 142 km/h average**, never off the tarmac, at most 2.6 m off the line.
- Run-off areas with no wall within 80 m, at samples 137–165 (T1) and 1047–1076, are listed for reference.
- **Surfaces:** collision object names map to grip in the game (`track.json` → `surfaces`). Wall collision is a 1 m vertical strip on each wall's track face.
- **Water:** the `water` node carries `extras.surface = "water"`, so the engine swaps in its own water shader. The exported material is only a dark placeholder.
- **Emissive floodlight heads and garage doors:** these are glow only. Real light comes from the engine (a few shadowed spots plus baked or faked light).
- **Road crown:** the road is crowned 6 cm at the centre line, so rain shaders have a drainage slope to work with.
