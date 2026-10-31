// Continental GT (car-lab procedural, no model): the third-generation Continental GT's elliptical lamps, an oval LED outline per
// side (the running light, brighter on the brake) over a dark bowl, the high centre stop lamp on the rear window's top edge, and
// reverse lamps low in the bumper. Car-lab builds it as one closed fitted LED ring per side (a 4.5 mm tube) under a closed
// cover and a ribbon lens, a centre stop tube (role brake) and reverse tubes (role reverse): all fitted automatically by
// taillights.js (the ring a guide, the stop tube a fill, the covers the smoked rearLens, the reverse tubes white).
// Levels: the tube is a small emitter, so its running light and brake step are stronger than AV-12's cells, or it barely read
// at chase distance after dark. No glow point: a ring's point sits at its centroid, the dark middle of the oval, where it read
// as a red pupil in the lamp. What the real lamp has and this one cannot: the brake lighting the oval's interior (car-lab's
// bowl is housing material; lighting it as a fill is a shared change, see the rollout notes).
// QA (qa/taillights/bentley-gt-before, -after, bentley-gt-before-after*.jpg): a dark smoked oval with a faint red ring by day,
// a clean red ring at dusk and night, a clear brake step at chase (the ring brighter, the centre stop on), no red halo over
// the paint (the before's sprite), the reverse tubes white with a white pool after dark, a red pool and wet streak on the brake.
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [{ part: 'guide', glow: 0 }],
  spill: true,
  levels: { run: [0.14, 0.6], brake: [1.1, 1.25] },
};
