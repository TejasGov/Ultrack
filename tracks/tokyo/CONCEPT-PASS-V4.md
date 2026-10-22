# Tokyo Sakura — reference-led bridge and night circuit

Editable scene: `out/tokyo_sakura_v4.blend`. Rebuild with Blender using `concept_pass_v4.py`, after `overhaul_v3.py` and `review_v3.py`.

The seven supplied concept images are preserved under `references/user-concepts/`. They guide visual composition, not instructions or distributable texture assets. Two images are duplicates. No reference photograph was applied to a model.

The race references inform white floodlight banks, staggered starting-grid paint, a structural start gantry and detailed stadium seating. The Japanese street references inform projecting vertical signs, warm storefronts, pink sakura and a damp asphalt film with varied roughness. The suspension bridge reference informs two pale open portal towers, rounded inner braces, curved main cables, vertical suspenders and red uplighting along the existing elevated road. This is an original fictional bridge, not an engineered or geographically accurate replica.

V3 supplies 206 district buildings, four cedar stadiums, 219 shared-mesh trees, layered windowed skyline geometry and dimensional distant Tokyo Tower / Skytree silhouettes. V4 preserves the source racing line and elevation. Tower inner edges are 12 m from the centerline, outside the 9 m road half-width. Existing grade-separated crossing geometry is retained.

## Review and production limits

Actual Blender render outputs: `bridge_v4.png`, `neon_street_v4.png`, `stadium_v4.png`. V3 geometry checks passed; V4 preserves that road and adds scenery. These renders are the authoring look, not screenshots from the browser game.

The scene has packed textures and editable Japanese text. It remains a detailed authoring build: browser performance has not been measured. Shared meshes, batch-built architecture and six hidden foliage LOD candidates prepare optimization without destroying the source. Runtime work still needs sector visibility, tested foliage transitions, sign atlases, baked lighting/reflections and a distant-landmark bake from approved driving views. Cycles area lights must not be copied wholesale into the game renderer. Crowd population, a full pit-garage complex and bespoke landmark finishing remain later art passes.

Poly Haven assets are credited in `assets/polyhaven/CREDITS.md`. Existing project-authored Marina facade and fence atlases are reused. Japanese font uses the local Windows MS Gothic installation for this authoring study; do not redistribute the font file as a standalone game asset.
