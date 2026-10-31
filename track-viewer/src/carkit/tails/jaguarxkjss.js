// jaguarxkjss (a Mercedes-AMG ONE model): per side a slim lamp under a dark lens with three slanted LED segments in a row,
// the combined running and brake light (no separate stop, indicator or reverse element on the model). The model is layered:
// tail|brake_lamp the segments (emissive red, no map), keep|Material.005 the lens (70 % dark, a faint constant red emissive).
// Before: one flat emissive with a halo over the tail, pink on the brake. Here the segments are guides under the smoked lens.
// Limits: the outer segment is modelled facing forward, so it is back-face culled and only two segments per side show (as
// before); the segments have no map or sub-elements, so their structure is the guide shading only. No reverse lamp on the
// model. QA 2026-10-30 (qa/taillights/jaguarxkjss-before|after, jaguarxkjss-before-after[-highlights].jpg): day a dark glossy
// lens with dim red segments, brake clearly red; dusk and night red segments, a brake step with a small glow at chase, red points
// and the pool at 20 m, red streaks on a wet road; no pink, no halo. Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    // the outer segment wraps the corner with its faces pointing forward (flipped in the model): culled from behind, so no glow
    // (a glow with no lit element would float); it lights as soon as the mesh faces back
    { box: [[2.05, 0.57, 0.66], [2.12, 0.63, 0.76]], part: 'guide', glow: 0 },
    { part: 'guide', glow: 1.5 },                 // 11 cm segments: the default glow (4.8 cm) could not carry the brake step at 6 m
  ],
  lens: { material: /^keep\|Material\.005$/ },
  spill: true,
  levels: { run: [0.07, 0.26], glowBrake: [0.12, 0.75] },   // flat segments facing back read brighter than AV-12's guides at the same level; small, so a little more brake glare at night
  qa: { macro: [2.13, 0.61, 0.6] },
};
