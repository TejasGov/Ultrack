// nissan-z (Z GT4, RZ34): per side a wide lamp under a dark lens, two stacked outline loops (the Z32-style lozenges: the
// running light, brighter on the brake) whose insides fill on the brake, with short inner bars that join the stop lamp; a dark
// strip under the loops, a side marker on the flank and the GT4's centre rain light (all unlit).
// The model is a texture lamp with a separate lens: tail|mm_lights the loops (red ring, a baked pink halo outside their UVs),
// keep|mm_lights the housings, inner bars, strips and rain light (one atlas), keep|mm_windiws the lamp lens (25 % black).
// keep|mm_lights is adopted behind x 1.9 and everything lit through the atlas (`tex`: red texels light, the strips' dark
// chrome stays dark). Before, the loops were one flat emissive (pink-white on the brake, a halo over the lens) and the rain
// light's lenses (tail|mm_windiws) lit with the brake; here they are smoked lens pieces and the rain light stays dark.
// Judgement calls: the insides of the loops and the inner bars as the brake fill (the RZ34's lozenges fill when braking); the
// strip under the loops unlit (dark chrome in the atlas, no colour of a lamp); no reverse lamp (the GT4 model has none; white
// `tex` texels would also light the rain light's LED rings). LOD 1 (45 m+) lights the loops only (its housings merge below the
// fill rules' minTris). The two pieces under the wing (2.02, 1.06, ±0.36; wing-mount plates in the lights atlas) stay adopted
// as unlit parts: left out with `adopt.box` (tried 2026-10-31, qa/taillights/nissan-z-step2) their model material glows red all
// the time, two dots atop the rear window while running. QA 2026-10-30 (qa/taillights/nissan-z-before|after, nissan-z-before-after[-highlights].jpg): day a dark
// lens with the loops faint red, brake loops filled with LED dots; dusk and night red loops, a clear brake step at chase, red
// points and the pool at 20 m, red streaks on a wet road; no pink, no halo. A large white glow low on the bumper at night is
// in the before too (not the tail lamps). Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { material: /^tail\|mm_windiws$/, part: 'lens' },                                    // the rain light's LED lenses
    // glows: a 3 cm tall bar sized by its 21 cm length stacked four round glows into one blob mid-lamp
    { material: /^tail\|mm_lights$/, part: 'guide', glow: 0.35 },                        // the outline loops
    { material: /^keep\|mm_lights$/, box: [[1.97, 0.7, 0.62], [2.02, 0.77, 0.68]], minTris: 200, part: 'fill', glow: 0.35 },   // inside the loops
    { material: /^keep\|mm_lights$/, box: [[2.06, 0.7, 0.44], [2.09, 0.77, 0.49]], minTris: 90, part: 'fill', glow: 0.5 },     // the inner bars
    { part: 'off' },
  ],
  adopt: { material: /^keep\|mm_lights$/, minX: 1.9 },
  tex: { material: /mm_lights/ },
  lens: { material: /^keep\|mm_windiws$/ },             // not /mm_windiws/: glass| is the rear window, headkeep| the headlamps
  spill: true,
  levels: { run: [0.13, 0.6] },   // the loops are ~1 cm outlines, a fraction of AV-12's guide area: at its level they vanished after dark
  qa: { macro: [2.02, 0.73, 0.6] },
};
