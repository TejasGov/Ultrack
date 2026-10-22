# pit_crew: source

Generated with Meshy (user's account); outputs owned per Meshy terms.
Date: 2026-10-19

## 1. Concept image (concept.png)
- Tool: meshy_text_to_image, ai_model nano-banana-pro, pose_mode a-pose, 1:1
- Task id: 01a1529d-e5f7-7743-ac5c-6252ff46276e
- Credits: 9
- Prompt: "Full-body character: a motorsport pit-stop mechanic in full fire-resistant racing overalls that are plain WHITE (team colours get applied in the game), padded black gloves, black boots, wearing a black full-face pit crew helmet with a dark visor. Standing in a neutral A-pose, arms slightly away from the body, front view, whole body in frame head to feet, plain light-grey studio background, even soft lighting, realistic proportions and materials, no text, no logos, no brand marks."

## 2. 3D model (pit_crew_unrigged.glb + pit_crew_unrigged_textures/)
- Tool: meshy_image_to_3d from the concept task, ai_model meshy-6, textured 2K, PBR, remesh triangle 8000, glb, pose_mode a-pose
- Task id: 01a152a0-473d-7443-b5eb-c2c25adecc65
- Credits: 30
- Result: 8,305 triangles, no skin (unrigged)

## 3. Rig and animations: NOT DONE
- meshy_rig (input_task_id 01a152a0-473d-7443-b5eb-c2c25adecc65, height 1.78 m) was refused twice with
  402 "API key credit limit reached" (account balance was 1623, so it is the API key's own spending cap).
  meshy_list_tasks (rigging) confirmed no rig task was created, so nothing was charged.
- To finish: raise the key's limit, then rig the task above (5 credits) and animate Idle (action 0) and
  Cheer_with_Both_Hands_Up (action 298) at 3 credits each.

Total credits spent: 39
