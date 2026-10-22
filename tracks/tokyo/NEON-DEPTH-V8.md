# Neon depth avenue

Scene: `out/tokyo_neon_depth_v8.blend`. Rebuild from V7 with `neon_depth_v8.py`.

The supplied Japanese racing image informs the depth structure: warm lanterns and pink sakura near the viewer, several heights and colors of tenant signage in the middle distance, smaller cooler city lights farther away, then a low-contrast Mount Fuji above the city. The reference image is not used as a texture or copied into the render.

The existing single Fuji image card is reoriented beyond the north commercial avenue so the mountain aligns with a driving view, rather than sitting solely behind the eastern waterfront skyline. The previous V7 arrangement remains in its own file. The new city layers are scenery beyond the circuit. A five-tier cedar pavilion with swept roof edges and warm eaves contributes a distinct Japanese silhouette beside the avenue.

Added geometry uses batch-built sign cabinets, support brackets, ribbed lanterns, a small modular pavilion and shared existing sakura meshes. Tenant signs combine luminous colored paper faces with dark Japanese glyphs. Colored preview lights illuminate the road physically, creating reflections from the actual sign placement. The mountain remains a packed two-triangle RGBA matte, and the bridge / Ferris wheel remain in the scene.

`out/neon_depth_v8.png` is an actual Blender render. This is authoring lighting; a runtime implementation still needs sign/text atlases, baked light pools, visibility sectors and measured foliage LOD transitions. No browser runtime export or performance result is implied.
