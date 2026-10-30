# V14 → runtime map: what to retire or adjust when V14 is exported

V14 is a Blender review build (`out/tokyo_v14.blend`). Nothing has been exported. This file lists, part by part in
`track-viewer/src/venue/tokyo/`, what the V14 source now carries itself and what must change in the runtime or in the export
script (`game_v13_1*.py`) when V14 is approved and exported. No `track-viewer` file was edited.

Two facts decide most rows:

- **Lights don't reach the GLB.** Every Blender light added in V14 (lamp, lantern and sign pools, tunnel wall wash and threshold
  lights, tower uplights, red tower-top lights, sodium columns, alley lights) is for the review renders only. The runtime parts
  that fake light stay.
- **Node graphs don't reach the GLB.** The CC0 box-mapped detail, the panel and tile materials (brick-node patterns) and the
  asphalt's ARM remap are Blender node chains. The glTF export keeps base colour, the default roughness, emission and image
  textures wired straight to a socket. The runtime shader work stays the authority in the game.

| runtime part | V14 source now has | action at export |
|---|---|---|
| `bridge-lights.js`: haze boxes hidden | The 4 `Localized red-lit bridge haze` boxes (`V5 local illuminated humidity`) are moved to `V14 \| _archive` (render-excluded) | **Retire** the haze-box hiding: the boxes are no longer exported (check that the export skips render-excluded collections; it skips `coll_hidden`) |
| `bridge-lights.js`: `PALE` emissive overrides | `V5 red uplight lens` is now `#fff1e0`, `V5 warm deck edge` is `#ffe6cc`, in the material | **Retire** `PALE` |
| `bridge-lights.js`: cable dots | `V14 bridge cable LED dots`: 414 icospheres (80 triangles each, about 33 k triangles) along both main cables, every 2.6 m | **Pick one.** Either keep the runtime dots (cheaper: instanced, one draw) and leave `V14 \| bridge lights` out of the export (add it to `NOT_GAME`), or export the dots as one instanced sphere and retire the runtime dots. Recommended: keep the runtime dots. |
| `bridge-lights.js`: tower wash pass | Spot uplights in Blender only | **Keep** |
| `M_NightBridgeRed` glow shell (game script) and `tracks.js dayNight.night` | `V14 \| bridge night red`: two small red lenses per tower top (`V14 tower top red lens`) plus Blender red lights | **Adjust**: add `V14 tower top red lens` to the `dayNight.night` material regex, so the red is night-only in the game too; the glow shell can then shrink to the top or retire |
| `look.js`: dry road | `V4 damp Poly Haven asphalt`: coat 0 and default roughness 0.85 (Blender reads 0.68-0.92 from the ARM green channel) | **Keep** `look.js` as the authority (its `COAT` dry value and `ROAD` 0.85 now match the source). The mirror strength stays a runtime decision. |
| `materials.js`: CC0 detail | The same sets on the same material names, box-mapped in object space (`V14 detail` node frame) | **Keep** `materials.js`: the Blender detail does not export. `ENTRIES` covers every name V14 touched except these new V14 materials, which need entries if they should get detail in the game: `V14 portal concrete`, `V14 stone revetment`, `V14 gravel path`, `V14 alley smoked timber`, `V14 alley tin awning`, `V14 alley stained plaster`, `V14 alley paving`, `V14 sound wall aluminium` |
| `neon-signs.js` and `signs.js` | Every sign panel now has its own palette material (`V14 sign <hue> lit / dark`) and its glyphs `V14 sign glyph ink / white` or `V14 sign <hue> neon glyph` (406 signs analysed, plus 60 new stack signs) | **Adjust**: `signs.js PANELS` matches `pylon_boards` and `V8 (pink\|ice\|amber\|paper)`; after V14 those panels carry `V14 sign …` materials and the recolouring would fight the source. Either retire the panel recolour for `V14 sign` materials (keep it for `M_SignNeonAtlas`) or drop the V14 sign materials at export. The atlas baker (`build_sign_atlas.py`) must bake glyph colour per style (it bakes paper-white now). |
| `light-pools.js` | Blender lights only | **Keep.** Adjust `SOURCES`/`signs.js` so the new stack signs, the tunnel's `V14 tunnel wall line LED` and `V14 tunnel threshold LED`, and the alley's `V14 chochin red` throw pools. |
| `tunnel-light.js` | The roof box (`V10 submerged tunnel`) is unchanged, so the roof finder still works. New interior materials: `V14 tunnel soffit panels`, `V14 tunnel wall line LED`, `V14 jet fan steel`, `V14 walkway concrete`, `V14 portal concrete`, `V14 fire cabinet red` | **Adjust** `MATS` to add the soffit, walkway and portal concrete, so the sky light is cut on them too. Consider shortening the 6 m fade past each portal to the 48 m louvre run (the louvres shade the approach). |
| `mirror-height.js` | No change (road profile untouched) | **Keep** |
| `sky-glow.js` | The Blender night world ramp is set to the palette (`#070a1a` zenith, `#2a1840` horizon); the world does not export | **Keep** |
| `holograms.js`, `torii.js`, `petals.js`, `pond.js`, `neon-streaks.js`, `neon-wash.js` | Not duplicated in V14 | **Keep.** Check `HOLO_anchor_02` (neon street) against the new blade stacks once exported; they were not tested together. |
| export script `NOT_GAME` | New review-only content: `V14 \| review cameras`, `V14 \| light pools` (lights), `V14 \| tunnel lighting` (lights + irradiance volumes), `V14 _disc cutter` (in the excluded archive) | **Add** `V14 \| review cameras` and the light probes to `NOT_GAME` |
| export: text atlas | New 3D text: about 120 blade glyph objects (tategaki, one character per line), 30 tenant labels, 11 stall signs, the alley arch and pylon, portal plaques, cabinet, phone, lane-arrow and speed-sign text, 6 Shuto gantry labels | **Adjust**: the 4096 px atlas is already full-ish (890 labels); add a second atlas page or bake the blade glyphs per word |
| export: far ground disc | `V13 far ground disc` has two holes over the approach cuts (it lidded them) | Export as is; check it no longer caps the cuts in the GLB |
| export: budget | See `V14.md` (new triangles per collection) | The tunnel cover trees are linked copies of a V3 sakura hero (8 k triangles each, 26 of them): use the game's tree tiers |
