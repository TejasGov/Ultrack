# marshal: source

Generated with Meshy (user's account); outputs owned per Meshy terms.
Date: 2026-10-19. Credits spent: 50 (9 + 30 + 5 + 3 + 3).

| Step | Tool / model | Task id | Credits |
|---|---|---|---|
| Concept image | text-to-image, nano-banana-pro, pose_mode a-pose, 1:1 | 01a1529d-c58e-715f-80f9-4db9bd7d44c5 | 9 |
| 3D model | image-to-3d (input = concept task), meshy-6, textured 2K, PBR, remesh triangle, target 8000, glb, a-pose | 01a1529e-51db-730b-be6e-a1d84c4ee27d | 30 |
| Rig | rigging, height 1.78 m (includes walking + running) | 01a152a1-1319-715f-8dfa-26e5f68e0cd8 | 5 |
| Idle | animation, action 0 "Idle" | 01a152a1-6047-72ac-930f-dfaf14ad7a82 | 3 |
| Wave | animation, action 290 "Wave One Hand" | 01a152a1-6192-7759-978e-941317b1c60a | 3 |

Concept prompt:
> A motorsport track marshal in bright orange overalls with reflective silver stripes, white cap, black boots, gloves, empty hands. Full-body person standing in a neutral A-pose, arms slightly away from the body, front view, whole body in frame from head to feet, plain light-grey studio background, even soft lighting, realistic proportions and materials, no text, no logos, no brand marks.

## Files
- concept.png: the text-to-image result (input to image-to-3d)
- marshal.glb: rigged character (8,321 triangles, 24-joint skin, 2K PBR textures)
- marshal_idle.glb, marshal_wave.glb, marshal_walking.glb, marshal_running.glb: the same skinned mesh with one clip each
  (clip names: Armature|Idle|baselayer, Armature|Wave_One_Hand|baselayer, Armature|walking_man|baselayer, Armature|running|baselayer)
