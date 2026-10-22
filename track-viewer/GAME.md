# Ultrack V1: the game layer (`src/game/`)

Run the track viewer with `npm run dev` and open it in a browser. The game starts on the title screen.

To get the bare viewer with its tuning panel, open `?dev=1`.

## Screens

| Screen | What it does |
|---|---|
| Title | Shows the logo over a slow flythrough of the circuit. Any key or click starts the audio; browsers only allow sound after a key or click. |
| Main menu | Race, Time Trial, Drift Attack, Free Drive, Garage and Settings. Your car's card sits bottom right. |
| Setup | Sets laps (race only), time of day, weather and driving aids. Time of day and weather change the circuit behind the menu as you pick. |
| Garage | Lists all 14 cars by team. Your selected car sits on the start straight, and the camera circles it (drag to turn it). Q and E switch tabs. **Car**: the game's own speed, acceleration, grip and downforce bars (with your upgrades applied), power, drive, weight, powertrain, class, your best lap, the driver and team. **Specs**: the real car's facts from `assets/cars/specs.json` — a side-view silhouette at true scale against your own car (dashed), then weight, power, top speed, 0-100 and 100-0 braking as bars across the roster (a white tick marks your car, a green tail what your upgrades add; "est." marks estimated figures), plus powertrain (combustion, hybrid, electric) and engine. **Upgrades**: spend U-coins on engine, tyres and brakes, three levels each, with the before → after of the next level. **Paint**: 16 body colours plus a custom picker, five finishes, a flake slider, a team livery switch, eight wheel and eight caliper colours, and reset. **Drive this car** makes it yours. |
| Settings | Picture, Driving, Sound and Controls tabs, with Q and E to switch tabs. Details below. |
| HUD | Laid out on a 1600×900 canvas and scaled to the window (`--s`, so 1280×720 reads the same). Top left: position and lap, then the standings (one row per car, however many there are; rows glide when the order changes; gaps to the leader). Top centre: last, current and best lap, with the last lap's delta and the lap's progress in three sector bars (Drift Attack: the drift score, clock, chain and multiplier instead). Bottom left: the minimap (`hud-map.js`): the circuit baked once as a road at its real width with a dark edge, the pit lane, the start line and sector ticks; **radar** is heading-up in a disc with the car low so the road ahead has the room, the zoom easing out with speed, north on the rim, rivals as team-coloured dots numbered by race position (a pip on the rim, pointing the right way, when out of range); **overview** (`M` switches, remembered) is the whole circuit north-up with corner numbers. Bottom right: the instruments (`hud-gauge.js`): a tachometer with a real scale (thousands of rpm up to the engine's redline, a red band over its last 8%, from the display gearbox), a shift-light rail that fills from 70% of the redline and is full at the shift point, the speed as three fixed digit cells (km/h or mph; leading zeros dimmed), the gear in its own cell (N on the grid, R, D for an EV), a nitro bar, and TCS / ABS / ESC tags that light in gold while that assist is working (held 0.22 s so a flicker reads as one light; TCS struck through when the assist level is Pro). An EV has no revs: the dial is a 0-100% power gauge. Centre: start lights or countdown, lap messages with deltas, final lap, wrong way and track limits. Bottom: a controls hint that fades out. Nothing blinks: the needle is a followed transform, the lights fade, messages fade, the wrong-way banner breathes slowly (not with reduce motion), and only changed text is rewritten. Numerals are Anton for the few big ones (position, speed, gear) and tabular Barlow Condensed for every other number. Styles are in `hud.css`. |
| Pause | Esc or Start. Resume, Restart, Settings or Quit. Time Trial adds **End · see laps**. |
| Results | Race: positions, best laps (the fastest in blue) and gaps (cars still running get an estimate). Drift: score and record. Trial: best lap and every lap, with invalid laps marked. Every result screen ends with the U-coins earned (itemised) and your new balance. |

**Settings, in detail:**
- **Picture:**
  - quality (auto, low, medium, high, ultra);
  - time of day;
  - weather (dry, damp, rain);
  - motion blur;
  - reduce motion;
  - field of view;
  - FPS counter.
- **Driving:** assists (casual, sport, pro), speed units, default race laps.
- **Sound:** master, engine, effects, commentary, crowd, and commentators on/off.
- **Controls:** the key and gamepad map.

Everything is saved in the browser's `localStorage` under `ultrack.v1`: settings, your car, paint per car, best laps and drift records.

## Modes (`session.js`)

| Mode | Rules |
|---|---|
| **Race** | You and each other team's lead car, seven in all. You start last. Five red lights, then lights out after a random 0.6-1.6 s. Laps are counted at the start/finish line, and only after passing half distance, so cutting back over the line doesn't count. The position changes once it holds for 0.6 s. After the flag the AI brings your car round. |
| **Time Trial** | Alone on track. A 3-2-1 countdown, then a flying lap after the first line crossing. All four wheels off the track for 1 s voids the lap. Personal bests are saved per car. |
| **Drift Attack** | 90 seconds. Points come from drift angle × speed. The multiplier rises 0.5 every 2 s of continuous drifting, up to ×5. A chain is banked 1.2 s after the drift ends; going off track or crashing loses it. Records are saved per car. |
| **Free Drive** | No clock pressure, though laps are still timed. |

## U-coins and upgrades (`economy.js`, `carinfo.js`, `garage.js`)

- **Balance.** `store.data.coins` and `store.data.upgrades[car] = { engine, tyres, brakes }` (each 0..3) live in the saved profile. A new profile, or an old save with no coins, starts with 1,500 U; anything out of range is repaired on load.
- **Earning.** Race: place (1,800 down to 200 for seven cars) scaled by the square root of laps / 3, plus 95 per lap driven, 300 for the fastest lap and 150 for a personal best (both scaled the same way). Time Trial: 80 per valid lap (first five) and 350 for a personal best, paid as each lap closes. Drift Attack: score / 25 up to 2,000, and 400 for a record. Free Drive pays nothing. A podium (P3) in a 3-lap race pays about 1,300 U.
- **Prices.** Level 1 / 2 / 3 cost 700 / 1,700 / 3,600 U on a Sports car (500-800 hp), ×0.8 for Tourers (under 500 hp), ×1.35 for Super (800-1,100 hp) and ×1.8 for Hyper cars. That is one or two races for a first level and about fifteen races to max a Sports car (three categories × three levels).
- **Effects.** `setUpgrades(key, levels)` in `src/physics/handling.js` makes `handling(key)` return upgraded numbers (engine → power and so top speed, tyres → grip, brakes → brake torque; the per-level multipliers are in `specs.json` `upgrades`). The game calls it for every car at boot and after a purchase; at the start of a session only the player's car keeps its levels, so the AI always drives stock. A live vehicle is retuned with `vehicle.retune(handling(key))`.
- **Facts.** `carinfo.js` merges `specs.json` (real figures, sourced; `estimatedFields` are flagged "est."), `handling.json` and the model's measured size, so a car missing from specs still shows what is known. Names come from `cars.js carName()`.
- **Credits.** The credits screen lists every `assets/cars/*/model.json` automatically.

## Loading

- The player's car now starts downloading at the same time as the 12 MB venue, the venue, track, lights and sky are `<link rel=preload>`ed from `index.html` in parallel with the script graph, and the team artwork (fonts and canvases) waits until the car is in.
- From the title screen on, `Game.preloadRace()` (idle time) loads what Start needs: the circuit, the 8 race cars, the collision world and the player's engine loops. `warmRace()` in `main.js` then compiles the race's shader programs (frame, shadow depth, the hero's cube capture, the post passes) in the race's own state and takes the first reflection capture, so Start finds everything cached. The menus draw only the showroom, so none of it shows. Start joins the same promises: about 2 s with the preload finished, about 12 s if clicked within seconds of boot (was 38 s). `?preload=0` turns it off, `?inflight=N` sets how many shader chunks compile at once in the menu (3). Far car LODs load behind the cars a race waits for.

## Audio (`audio.js`; the sound library is in `assets/audio`)

| Sound | How it plays |
|---|---|
| Engine | Your car's profile (seven: V12, flat-plane and cross-plane V8, flat-six, W16, inline-six, EV). Idle, low, mid and high loops are crossfaded by rpm and pitched within ±15%. A decel layer plays on lift-off. A display gearbox (seven gears; one for the EV) sets the rpm, and the HUD shows the same gear. |
| Exhaust | Pops and crackles on a sharp lift; shift pops on upshifts. |
| Nitro | Start, then a loop, then end. |
| Crashes | Soft or hard, by speed. |
| Race cues | Lights, countdown, lap, best lap, final-lap bell, position up and down, horns. |
| Crowd | An ambience loop that dips under the commentators; cheers, groans and gasps; fireworks for a win. |
| Commentary | Enzo, Alastair and Kavya lines are picked by category and situation: race or free, time of day, rain, lights on or out. Only one line plays at a time. Each category has a cooldown, and no line repeats until its category is used up. Alastair answers Enzo about 40% of the time. Filler lines play after 24 s of quiet. |

The audio files are copied into `public/assets/audio` by `npm run sync` (part of `npm run dev`).

## Measured

These checks ran in a headless Chrome at 1600×900.
- **Race:** a full 1-lap race (sped-up simulation) went from lights to results. The pack runs together, with gaps of 0.1-0.7 s early on.
- **Time trial:** a lap was timed, saved as a personal best and shown in the results.
- **Drift Attack:** banked and lost chains both registered.
- **Menus:** pause, resume and quit work.
- **Garage:** switching cars moves the headlight beams, the reflection capture and the engine sound to the new car.
- **Errors:** the console shows none.

## Not done

- **Audio:** none of it has been listened to by ear; it was only checked to play.
- **AI:** the AI drives the racing line but doesn't defend or choose lines.
- **Missing features:** no ghosts, replays, online play or other tracks. Only you hear your engine; the AI cars are silent.
