// Mustang (car-lab procedural, no model): the Mustang's signature three vertical LED bars per side (running light, brighter on the
// brake), the centre stop lamp and reverse lamps low in the bumper. Car-lab builds it as three open fitted LED bars per side (7.5
// mm curved tubes) under ribbon lenses, a centre stop tube (role brake) and reverse tubes (role reverse): all fitted
// automatically by taillights.js (the bars guides, the stop tube a fill, the ribbon lenses the smoked rearLens, the reverse
// tubes white).
// Levels: the tubes are small emitters, so their running light and brake step are stronger than AV-12's cells. Each bar glows
// along its length (`glowAlong`, 2026-10-31; a single point sat at the curved bar's centroid, off the bar on the paint, as a
// purple dot, so it had none). QA qa/taillights/mustang-step2e: a tight glow hugging each bar on the brake, day and night.
// QA (qa/taillights/mustang-before, -after, mustang-before-after*.jpg): three dark red bars per side under a smoked lens by day,
// three clean red bars at dusk and night (the before's white-pink brake and magenta halo are gone), a clear brake step at
// chase (bars brighter, the centre stop on), the reverse tubes white with a white pool after dark, a red pool and wet streak
// on the brake.
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [{ part: 'guide', glowAlong: true }],   // each curved bar glows along its length
  spill: true,
  levels: { run: [0.12, 0.45], brake: [1.1, 1.25] },
};
