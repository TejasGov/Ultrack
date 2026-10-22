# spectator

Generated with Meshy (user's account); outputs owned per Meshy terms.
Date: 2026-10-19

## Pipeline

| Step | Tool / model | Task id | Credits |
|---|---|---|---|
| Concept image | text-to-image, nano-banana-pro, pose_mode a-pose, 1:1 | 01a1529d-dbd5-72db-9b0b-6ea843c6be77 | 9 |
| 3D model | image-to-3d (input_task_id = concept), meshy-6, textured 2K, PBR, remesh triangle, target 8000, glb, a-pose | 01a1529e-8ac6-73dd-a7f0-6950a2f56163 | 30 |
| Rig | rigging, height 1.78 m (includes walking + running) | 01a152a1-0364-73f2-b0a6-a7c106c93ba0 | 5 |
| Idle | animation, action 0 (Idle) | 01a152a1-925b-7337-acf0-67cb3afa312d | 3 |
| Victory Cheer | animation, action 59: refused with 402 "API key credit limit reached", no task created | none | 0 |

Total: 47 credits.

## Prompt (concept image)

> a casual adult race fan in a plain red t-shirt, blue jeans, white sneakers and a plain cap. Full-body person standing in a neutral A-pose, arms slightly away from the body, front view, whole body in frame head to feet, plain light-grey studio background, even soft lighting, realistic proportions and materials, no text, no logos, no brand marks.

## Files

- `concept.png`: the concept image (896x1200)
- `spectator.glb`: rigged model, 8306 triangles, 24-joint skin, 4 textures (PBR)
- `spectator_Idle.glb`: Idle clip (with skin)
- `spectator_Walking.glb`, `spectator_Running.glb`: free clips from the rig task (with skin)

Each animation GLB carries the full skinned mesh and textures (~10 MB each).
