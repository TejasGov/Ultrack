# official (race official / steward)

Generated with Meshy (user's account); outputs owned per Meshy terms.
Date: 2026-10-19

## 1. Concept image -> concept.png
- Tool: text-to-image, ai_model nano-banana-pro, pose_mode a-pose, 1:1
- Task: 01a1529d-f35a-712d-aaa1-1fe5a03fb448 (9 credits)
- Prompt: "Full-body photo of a race official / steward in a plain navy polo shirt, light grey trousers, black shoes, a navy cap, a lanyard with a blank card and a radio earpiece. Standing in a neutral A-pose, arms slightly away from the body, front view, whole body in frame from head to feet, plain light-grey studio background, even soft lighting, realistic proportions and materials. No text, no logos, no brand marks."

## 2. 3D model -> official_unrigged.glb
- Tool: image-to-3d from the task above, ai_model meshy-6, textured 2K, PBR, remesh triangle, target 8000, glb, pose a-pose
- Task: 01a1529f-0845-75db-be10-27e129f1029b (30 credits)
- Result: 8,298 triangles, base color + metallic/roughness + normal maps, no skin

## 3. Rig / animations: NOT DONE
- meshy_rig was rejected with HTTP 402 "API key credit limit reached" (a per-key spending cap; account balance was 1623).
  No rig task was created (checked with list_tasks), and nothing was charged.
- To finish: raise the API key's limit, then rig input_task_id 01a1529f-0845-75db-be10-27e129f1029b (height 1.78 m, 5 credits),
  animate Idle_02 (id 11) and Talk_with_Hands_Open (id 313), 3 credits each.

Credits spent: 39
