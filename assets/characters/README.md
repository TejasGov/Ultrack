# Ultrack characters

Trackside people for the game. Nothing here has been checked in a 3D viewer or in the game yet; the checks were Meshy's preview renders and GLB header parses.

## What is here

| folder | files | tris | skeleton | animations | credits | source |
|---|---|---|---|---|---|---|
| `marshal/` | concept.png, marshal.glb, marshal_idle/wave/walking/running.glb | 8,321 | 24-joint skin | Idle, Wave_One_Hand, walking, running | 50 Meshy | Meshy (nano-banana-pro image, meshy-6 3D, rig, animate); `SOURCE.md` |
| `spectator/` | concept.png, spectator.glb, spectator_Idle/Walking/Running.glb | 8,306 | 24-joint skin | Idle, Walking, Running (no cheer: blocked, see below) | 47 Meshy | Meshy, same pipeline; `SOURCE.md` |
| `official/` | concept.png, official_unrigged.glb | 8,298 | none | none | 39 Meshy | Meshy image + 3D only; rig blocked; `SOURCE.md` |
| `pit_crew/` | concept.png, pit_crew_unrigged.glb, pit_crew_unrigged_textures/ | 8,305 | none | none | 39 Meshy | Meshy image + 3D only; rig blocked; `SOURCE.md` |
| `mixamo/Leonard/src/` | stand.fbx (skin), kneel1.fbx, look.fbx | not measured | Mixamo | stand, kneel1, look | 0 | Mixamo FBX, not converted yet |
| `mixamo/Pete/src/` | inspect.fbx (skin), cheer.fbx, kneelIdle.fbx, stand.fbx | not measured | Mixamo | inspect, cheer, kneelIdle, stand | 0 | Mixamo FBX, not converted yet |
| `mixamo/Racer/src/` | idle.fbx (skin), victory.fbx, wave.fbx | not measured | Mixamo | idle, victory, wave | 0 | Mixamo FBX, not converted yet |
| `mixamo/Remy/src/` | shift.fbx (skin), cheer.fbx, clap.fbx, sitCheer.fbx, sitClap.fbx | not measured | Mixamo | shift, cheer, clap, sitCheer, sitClap | 0 | Mixamo FBX, not converted yet |

Meshy total: 175 credits. `with_skin.txt` in each Mixamo `src/` names the FBX that carries the mesh.

## Not finished

- **official and pit_crew are unrigged.** `meshy_rig` returned 402 "API key credit limit reached" (a per-key spending cap; the account balance was 1,623). Raise the key's limit in the Meshy dashboard, then rig and animate: about 11 credits each (task ids in each `SOURCE.md`).
- **spectator has no cheer clip** (action 59, 3 credits, same 402).
- **Mixamo characters are FBX only.** Convert with `blender -b --factory-startup -P tools/mixamo_to_glb.py -- assets/characters/mixamo` (one GLB per character, clips named after the files, 1.78 m, spectators decimated to ~4,000 tris). Mixamo characters and animations are free for use in games, but the raw files may not be redistributed on their own.

## How to use

- Each GLB is a skinned mesh with its skeleton, 2K PBR textures, about 1.78 m tall, A-pose bind.
- Each Meshy animation GLB repeats the whole mesh and textures (10-12 MB each). Load the base GLB once and take only `animations` from the others with `AnimationMixer` on the base mesh, or strip the meshes from the clip files before shipping.
- **pit_crew overalls are white on purpose**: multiply the base colour by the team colour in the material (`material.color.set(team)`), so one model serves every team. Gloves, boots and helmet are black, so they stay black.
- **Instancing**: skinned meshes cannot be GPU-instanced in three.js (`InstancedMesh` has no skinning). Animate the nearest ~20 people with real `SkinnedMesh` + `AnimationMixer`, and for distant ones bake a static pose into a plain mesh (e.g. apply one frame of idle/cheer) and draw those with `InstancedMesh`. Swap by distance from the camera.


## Update: converted and in the viewer (2026-10-19)

- **Mixamo** (downloaded through your account; free for use in games, raw files must not be redistributed on their own):
  - **Racer:** idle, victory, wave.
  - **Leonard (photographer):** stand, look, kneel.
  - **Pete (pit-stop crew):** inspect (kneeling at a wheel), kneelIdle, stand, cheer.
  - **Spectators** Remy, Megan, Kaya, Brian, Sophie, Lewis: shift, clap, cheer, sitClap, sitCheer.
  - `tools/mixamo_to_glb.py` makes one GLB per character with every clip, 1.78 m tall, heroes ~12k tris, spectators ~4k.
  - `tools/mixamo_move.sh` files the browser downloads into `mixamo/<Name>/src/`.
- **Meshy:** `tools/meshy_chars_to_glb.py` puts every clip on one base mesh (`<id>_web.glb`) instead of a 12 MB copy per clip.
- **Web set:** `web/*.glb`, 13 files, ~10 MB: meshopt with 16-bit positions, WebP textures at 1024 px. `track-viewer/scripts/sync-assets.mjs` copies them.
- **In the viewer** (`track-viewer/src/people.js`), 56 people replace the Blender placeholder figures:
  - two Petes per garage, one kneeling at the tyres
  - drivers at the first boxes
  - the Meshy marshal at every post, idling or waving
  - Leonard beside each TV tower
  - officials on the pit wall
- **3D spectators are off:** `populate(..., { spectators: true })` turns them on. At dusk and night they are barely visible and cost ~20 ms a frame; the stands' animated crowd cards carry the crowd.
- **Budget rules:**
  - people draw only in view and within 90 m
  - animate within 70 m (half rate past 30 m)
  - cast shadows within 22 m
  - are left out of the mirror and GTAO passes
