# V9 realism pass

Scene: `out/tokyo_realism_v9.blend`. Rebuild from V8 with:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --factory-startup -P D:\RaceUltimate\tracks\tokyo\realism_v9.py
```

Add `-- --quick` for 60 % / 24-sample previews. The script reads `tokyo_neon_depth_v8.blend` and writes a new file, so V7/V8 are untouched. Road geometry is unchanged. Counts and placements are logged in `out/realism-v9.json`.

The user's reference photos (Formula E / Saudi street circuits, Tokyo night driving, Fuji + pagoda) guided composition only; none are used as textures.

## What was added

**Painted concrete run-off** (`V9 | painted concrete run-off`)
- Five procedural, tileable Japanese-motif textures (`textures/v9_paint_*.png`): seigaiha waves, flowing ribbons, chevrons, ichimatsu checks and a sunburst. They are packed in the blend.
- Painted aprons outside the eight tightest corners and along both sides of the start straight, with white edge lines. The road runs on an embankment, so each apron has a concrete retaining-wall skirt down to the terrain. Width is clipped where the ground falls more than 6.5 m or a building is in the way.
- Kerb-side band between kerb and barrier is painted in six rotating sector colours (sakura, ai-indigo, vermilion, asagi, kin, matcha).
- Glowing LED lines on the barrier face and colour-block sponsor boards (fictional brands) along the whole circuit; lettering on the start straight and avenue entry.

**Architectural diversity** (`V9 | architectural diversity`): glass crown towers, danchi apartment slabs with balconies, timber-louvre museums, machiya townhouse rows (tile roofs, lattice, noren, lanterns), pachinko parlours, konbini and narrow "pencil" towers with stacked tenant signs. Placed on checked, flat, clear plots (no overlap with existing buildings or road).

**Cultural landmarks** (`V9 | cultural landmarks`): floating vermilion torii in the bay, hillside shrine (three-torii approach, stone lanterns, haiden hall, cedar grove), Edo-style five-tier castle keep on the infield hill with gold shachihoko, and an offshore Wangan-style expressway viaduct with green overhead signs. Existing Tokyo Tower, Skytree, pagoda, Ferris wheel, bridge and Fuji remain.

**Street life**: roadside vending-machine clusters and utility poles with transformers and sagging wires along the avenue.

## Assumptions and limits

- Sponsor names, shop names and signs are invented, not real brands.
- Paint is emissive-assisted so it reads at night. Real surfaces would be lit by floodlights; six preview floodlights are included.
- The castle, shrine and torii are stylised modelling studies, not measured replicas.
- Authoring-quality geometry only: no collision, LOD, atlas baking or runtime export has been done, and no performance figures are claimed.
