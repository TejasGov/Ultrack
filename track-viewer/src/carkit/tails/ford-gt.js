// ford-gt (Ford GT Mk II): the car's signature round "afterburner" lamps, a red ring around a hollow dark centre, high and wide on
// the tail. The model is a texture lamp with a separate lens: tail|car_ford_gt_mkiiDefault1 the rings (cut out of the rear of the
// chassis_emissive part, per side one component of 585 triangles), keep|glas the lens pieces in front of them.
// Lit through the atlas (`tex`: red texels light, the dark centres stay dark). Each ring glows along its length (`glowAlong`); a
// single point sat in the hollow centre as an orange ball. No reverse lamp and the rain light stays unlit: the model has no reverse
// lamp, and its centre rain light is part of the diffuser's atlas. QA 2026-11-01 (qa/taillights/ford-gt-step2): by day a smoked lens
// with the rings dark red, on the brake a hot red ring, at chase a clear brake step and a red pool on the road, no pink, no halo.
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [{ part: 'guide', glowAlong: true }],
  tex: { material: /^tail\|/ },
  lens: { material: /^keep\|glas$/ },
  spill: true,
};
