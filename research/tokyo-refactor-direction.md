# Tokyo refactor: art direction and work rules

The goal is to make the Tokyo Hiragana Circuit the best-looking track in Ultrack, within our engine: three.js r186, WebGL2, the
EffectComposer chain in `track-viewer/src/main.js`, which runs render → GTAO → bloom → output → final grade → SMAA, plus the
planar road mirror, the shadow pool and glow sprites. Night is the hero look; evening, dusk and day must still look right.

## What we are fixing (audit, 2026-10-26)

- **The road never went wet in the rain.** main.js's wet-road lists named only Marina's materials. Fixed:
  `tracks.js` tokyo `wet: { wet, puddles }`.
- **Most buildings are flat colours.** Blender procedural materials don't survive glTF. Roof tiles (`V10 tile`, 92 meshes),
  `V10 wood`, `V10 cedar`, `V10 paper`, `V10 red`, `V9 konc`, `V3 ivory`, `V13 white slab`, `V5 pearl concrete`, the castle
  materials and others have no texture. In day light they read as plastic, and at night as black cut-outs.
- **Night light doesn't spill.** Neon and lamps glow, but nothing around them is lit: no colour on the road, facades or
  barriers. Buildings away from the road go black.
- **Sky:** no city light pollution. The horizon behind the skyline arc is as dark as the zenith.
- **Bridge:** big flat white towers, unlit cables. The real Tokyo bridges' signature, cable light dots and tower uplights, is
  missing.
- **Cost:** about 1,600–1,800 draws and 3.5–4.2 M triangles per frame at night. The main pass is about 270 draws; the rest is the
  mirror, GTAO, shadow passes and cars.

## Palette (night)

| role | hex | use |
|---|---|---|
| sky zenith | `#070a1a` | deep indigo, never pure black |
| horizon glow | `#2a1840` → `#6a2f4a` | light pollution band over the city arc, warmer toward Tokyo Tower |
| sodium / lantern warm | `#ffb46b`, `#ff8a3d` | street lamps, chochin, shop light spill |
| LED cool | `#e8f3ff`, `#19e3ff` | track lighting, tunnel, signage |
| magenta neon | `#ff2e88` | signs and accents (sparingly) |
| violet | `#7a3cff` | LED edges, hologram tint |
| vermilion | `#ff4a2e` | torii, bridge, Hayate team colour |

Warm against cool is the whole picture: warm pools near the street and old Japan (lanterns, shoji, temple), cool LED along the
circuit and the modern city. Only one colour dominates any view.

## Hard rules

- **No flicker, no hard blinking, no strobing**, ever (the user's rule). Animated light changes are smooth with a period of 2 s or
  more. Scrolling and drifting are fine.
- **Racing readability first.** Nothing on or over the road surface may read as an obstacle or hide the racing line, braking
  boards or kerbs. Nothing may glare into braking zones. Set pieces never intrude into the driving space: collision is unchanged,
  and anything near the road sits beyond the barriers. Check that against `track.json` centerline and width.
- **Runtime first.** New effects live in `track-viewer/src/venue/tokyo/<part>.js` modules registered in `src/venue/tokyo.js`
  (PARTS), contract in that file. No Blender rebuild unless a job truly needs geometry the runtime cannot make. Only one Blender
  process at a time, `-b -t 6`, below-normal priority.
- **Budget per part.** At most about 20 draw calls (instance everything), about 100 k triangles, 1 k textures, and about 32 MB of
  new texture memory for the whole refactor. Tag parts out of the road mirror (`layers.set(NO_MIRROR)`) unless their reflection is
  the point (neon is the point). Keep small things out of shadows (`castShadow = false`).
- **Shared files.**
  - Edit `main.js`, `tracks.js` and `tokyo.js` only with exact small edits, never by rewriting the whole file: several agents
    work at once.
  - `main.js` render-pass code belongs to the perf job. `tracks.js` Tokyo `looks` / `dayNight` / `wet` belong to the look job.
- **Shared materials.** A material in `TRACK.wet` already has an `onBeforeCompile` (`wetify`). Never replace it: chain it (keep
  the previous function, call it first) and extend `customProgramCacheKey`.
- **One browser at a time.** Wrap every headless-browser run: `node scripts/qa-lock.mjs -- node scripts/qa-tokyo-views.mjs
  http://127.0.0.1:5180 <looks>`, with `OUT=qa/tokyo-refactor/<job>` set to keep your shots apart. The dev server is on :5180;
  don't start or stop it.
- **Spending and downloads.**
  - No paid generation (ElevenLabs, Meshy, Higgsfield) without the user's OK, through the orchestrator.
  - No asset downloads without the user's OK either; the orchestrator gets it. Use only CC0 assets, recorded with source and
    licence.
  - No real brands beyond the sponsor boards already in the track.
- **Don't push**, and stage only your own files. Don't run a race. The lap test (`TRACK=tokyo node scripts/test-track.mjs`) is
  fine.

## Measuring

- **Views:** `scripts/qa-tokyo-views.mjs` shoots 5 views × 4 looks and reports errors and the renderer's calls and triangles.
- **Frame time:** the viewer's `bench()` in `main.js`, which renders frames along the lap and reports avg/p95 ms and draws. It is
  reachable from the page console in dev mode, `?dev=1&track=tokyo`.
