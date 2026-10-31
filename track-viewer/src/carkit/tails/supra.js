// GR Supra GT (Toyota GR Supra Super GT): the road A90's lamp under one wedge lens per side (a loop-shaped light guide with a
// slim bar running inboard from it, the stop lamp filling the loop), plus the FIA rain light, a 5x3 LED block in the centre
// of the rear panel. The model splits the lamp into four tail-role materials: red_glass the outer lens (opaque red in the
// model, hiding the elements: now the smoked glossy rearLens), brake_1 the loop (159 tris per side) and the rain light's 15
// LEDs, brake_3 the element inside the loop (the brake fill, its LED dots show at macro), brake_2 the inboard bar.
// The loop and the bar are the running light (brighter on the brake). The rain light stays unlit (a race car lights it in
// rain and fog, which the game does not tell the lamps). No indicator or reverse lamp on the model (a GT500 car needs none):
// the reverse pool and spill are off, so reversing shows nothing that has no source.
// QA (qa/taillights/supra-before, -after, supra-before-after*.jpg): the loop, bar and dotted fill read through a dark smoked
// lens by day (sky reflections), a clear red at dusk, a clear brake step at chase (the fill lights inside the loop), a red pool
// and wet streak after dark. At night (AgX) the brake reads orange-red at macro, as AV-12's does; brake is a little lower than
// AV-12's for that. The bar glows along its length (`glowAlong`, 2026-10-31; a full-size centroid glow sat mid-bar as a blob,
// so it had been cut to a small one): QA qa/taillights/supra-step2b, a soft line of glare along the bar on the brake at night.
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { box: [[2.05, 0.5, 0], [2.2, 0.7, 0.08]], part: 'off' },          // the FIA rain light: unlit
    { box: [[1.99, 0.72, 0.49], [2.01, 0.75, 0.51]], part: 'off' },    // a stray 1-tri bit
    { material: /red_glass/, part: 'lens' },
    { material: /brake_3/, part: 'fill' },
    { material: /brake_2/, part: 'guide', glowAlong: true },           // the inboard bar: glows along it
    { part: 'guide' },                                                 // brake_1's loop
  ],
  spill: true,
  levels: { brake: [0.9, 0.85], poolRev: [0, 0], spillRev: 0 },
  qa: { macro: [1.97, 0.73, 0.6] },
};
