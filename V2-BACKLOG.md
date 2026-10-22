# Ultrack V2 backlog

From the first long hand-test of V1, on 2026-10-19: about 20 minutes, 8 cars driven.

## Implementation status (2026-10-20)

Code delivered in this pass is documented in [V2-IMPLEMENTATION.md](V2-IMPLEMENTATION.md).

- [x] Input diagnostics: `?dev=1` in the viewer, or `?inputDebug=1` in the game.
- [x] Clear steering and assist history on respawn, car selection and driver changes.
- [x] Keyboard priority over controller drift; clear input on focus loss and menus; edge-trigger pad reset.
- [x] Bento main menu with spatial keyboard/gamepad navigation, current car and records.
- [x] Shared HUD tile styling and in-game creator/license credits.
- [x] Model-car rim painting without recoloring tyres or brake discs.
- [x] Quiet procedural EV audio for Tesla and Audi, plus speed-driven tyre/wind layers.
- [x] Commentary PA effect using Web Audio.
- [x] Engine Simulator recording importer with fixed-RPM layers, loop joins, encoding and provenance receipts.
- [x] Optional KTX2 car-texture build with WebP fallback.
- [x] Bounded six-model-instance render benchmark (`viewer.benchModels()`).
- [ ] Reproduce/confirm the original intermittent steering issue in a long live drive.
- [x] Replace generated combustion engines with ten CC-licensed real YouTube recordings; remove V1 fallback and generated exhaust/boost playback.
- [ ] Audition and refine the real-recording bank in `/audio-lab.html`; find a cleaner full-load AMG ONE source.
- [ ] Select and import replacement Sonniss/Freesound effects with per-source provenance.
- [ ] Run the six-instance benchmark on the target GPU and then measure a full driving session.
- [ ] Live visual/audio review of the new menu, HUD, PA sound and compressed textures.

## Bugs

- **Steering stuck to one side.** On the 9th car, the front wheels stayed turned left or right, so pressing W (or ↑) pulled the car to that side.
  - Not reproduced yet. The keyboard input looks sound: it uses `e.code` and clears all keys on window blur (`src/physics/driver.js`).
  - **Suspects, in order:**
    1. A gamepad that is connected but idle, with stick drift above the 0.09 dead zone. Any pad axis overrides the keyboard.
    2. Steering, drift-controller or stability state carried over between car swaps or respawns (`vehicle.js`, `Field.setPlayer` / `respawn`).
    3. A keyup lost to an overlay that takes focus without a blur event, such as Game Bar or the Windows key.
  - **First step:** a `?dev=1` overlay that shows the held keys, the pad axes, the input steer and the wheel steer angle. Then swap cars 9 or more times and reproduce.

## Menus and HUD

- Rebuild the menus as a **bento grid**, like modern racing games such as Forza Horizon and GT7: tiles of mixed sizes for the modes, the garage, the current car and records, instead of the vertical list.
- Re-check the race HUD against the same design language.

## Sound

- **Car SFX:** the user hates all of the current ElevenLabs engine sounds. The Tesla's was the only acceptable one, but a Tesla should be near silent. No more ElevenLabs credits on SFX.
  - **Engines (updated direction, 2026-10-20):** real car recordings from CC-licensed YouTube uploads. Ten per-car profiles are integrated; see `assets/audio/recordings/CREDITS.md` and `/audio-lab.html`.
    - Preserve exact source trims, licence metadata and hashes. Audition steady RPM and transitions; improve the limited AMG ONE full-load source.
    - No generated engine/exhaust fallback. Engine Simulator is an archived alternative, not the active plan.
  - **EV (Tesla):** procedural Web Audio: a motor whine pitched by speed, inverter hiss, then tyre and wind noise. No engine loop.
  - **Other SFX** (tyres, impacts, wind, crowd, UI): Sonniss GDC bundles. They are free and royalty-free with no attribution, but can't be redistributed as standalone sounds or used for AI training. Check each year's track list for vehicles.
  - **Freesound:** licences vary per file, so check each one.
  - **Paid, only if the free routes fall short:** real onboard libraries such as Sonniss "Ferrari 812 Superfast" or Sound-Ideas (Lexus LFA V10, $150).
- **Commentary:** keep it; the user loves it. Add a **PA / loudspeaker effect**: a band-pass at about 300 Hz-3.5 kHz, light saturation, and a short stadium slapback or reverb, as at a real circuit. All in Web Audio with no new assets.

## Cars

- **AV-12 (Lamborghini) and Furari 488-R (Ferrari)** are the weakest models.
  - They are Meshy meshes of about 2.5 M triangles, decimated to 80 k for LOD0 (`assets/cars/lods.json`). The decimation softens the panel lines, and the parts aren't separated.
  - **Plan:** replace them with hand-modelled, CC-BY Sketchfab models that have separate wheels, glass and lights. Credit the authors on a credits screen.
  - **Candidates** (checked through the Sketchfab API on 2026-10-19). Look at each one before downloading:

    | Model | Author | Licence | Triangles |
    |---|---|---|---|
    | Lamborghini Aventador with Interior (`36eb1fa54a0d4be695d4cd90c30f4ff1`) | blackcube4 | CC-BY | 804 k |
    | Lamborghini Aventador SVJ SDC (`784e4656aca649cca55d6b18740a19b2`) | Lambo_SC04 | CC-BY | 508 k |
    | Ferrari 488 GTB 2016 HQ Interior (`30861f4700e5459084733f9d2ba13c49`) | niev | CC-BY | 318 k |
    | Ferrari 488 GTB (`c2bca88f04044daaa7c0274a9c0f2cc1`) | Turbostuart | CC-BY | 355 k |

  - **Avoid:** the ddiaz-design uploads. Their own descriptions say they are ripped from CSR2 and Need for Speed, so the game studios own them whatever the Sketchfab label says. One is also NC-SA.
  - **After import:** run each car through the QA pipeline (`npm run qa -- <car>`) and its tuning JSON.
- **Picked on 2026-10-19:** L1 (the Aventador) and F1 (the 488 Pista). Both are downloaded to `sources/sketchfab/`.
  - **L1:** blackcube4 combined Lambo_SC04's "Aventador SVJ Black-Ghost" exterior, which is **CC-BY-NC**, with someone else's interior. Treat the car as NonCommercial and credit Lambo_SC04 and blackcube4.
    - Its wheels, tyres and brake discs are each **one mesh covering all four corners**, about 380 k triangles in total. They have to be split by corner and decimated.
  - **F1: stop. It is very likely a Forza Horizon rip.** It has Forza's asset names: `car_ferrari_488gtb_2016_wheelrl_setpt_mesh_lod0`, `M_CarPaint_Max`, `*_SetPT_Max`, `M_Swatch_Max` and `fer_caliperrr_028`. It also carries 488 GTB wheels and Kumho tyres, which are wrong for a Pista. **Decision on 2026-10-19: the user is keeping F1, because Ultrack is a non-commercial fan project.** If the game is ever published or shared publicly, F1 must be replaced first (F4, the NazhDesign SF90, or F3, the giuliofinardi1 Pista). Its wheels are already split into four corners, each with its rim, tyre, disc and caliper, so no corner split is needed. Use the Pista wheels it has, or keep the procedural ones.
- **Done on 2026-10-19:** L1 and F1 are in the game as the AV-12 and the Furari 488-R. They run through `track-viewer/scripts/model-car.py`, the model path in `cars.js` and the real wheels. QA: 0 fails on both (CAR-QA.md, "Complete models").
  - **Still to do:**
    - a **credits screen** (CC-BY and NC require attribution; the credits are in each `model.json`);
    - rim colour from the paint tuner on model cars;
    - smaller textures: the GLBs are 10-13 MB, mostly WebP textures at 1024 px, which KTX2 would fix;
    - check frame time with six model-quality cars, if more cars move to models.
- **Meshy:** not used for hero cars. AI meshes come out as one fused piece with soft panel gaps, and decimating them to a game budget loses the rest of the detail. Use Meshy only for props.
