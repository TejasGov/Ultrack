// furari-488 (488 Pista): per side one round lamp under the deck edge, Ferrari's "afterburner": a thick red LED ring (the
// running light, brighter on the brake) round a centre disc with a ring of LEDs, lit as the brake fill (red LED dots inside the
// ring); a third brake light along the top of the tail (a brake-only fill); red reflector strips low on the bumper (unlit); a
// 12-LED rain lamp low in the centre and the plate lamps (unlit).
// The model is a Forza-style lens over emitters: tail|Red_LG is the lens (a 25 % colour-ID shell, which the game made an opaque
// red lamp: pink-white discs on the brake) and keep|Light the emitters, glowing at a constant level before (its emissive map is
// only a cream ring on the bowl, its base map grey: nothing for `tex`); here keep|Light is adopted and lit by component (the
// ring is the bowl seen round the centre tube), Red_LG becomes the smoked lens.
// Judgement calls: no reverse lamp. The lens is clear over the centre disc (the only clear lamp area), so it may be the reverse
// lamp, but part 'reverse' wears the white headlamp material unlit: a flat white disc by day, which looked placeholder; as the
// brake fill it reads as the real lamp's dark centre and gives the brake its structure. Levels: the ring is a fraction of AV-12's
// guide area and sits on red paint, so it runs brighter (run, glowRun) with a slightly stronger brake glow at night.
// QA 2026-10-30 (qa/taillights/furari-488-before|after, furari-488-before-after[-highlights].jpg): day a dark smoked lens with
// the ring faint, brake a red ring and LED-dotted centre; dusk and night a red ring, brake filled discs and the stop bar; wet
// roads streak red; no pink, no halo. The night stills' warm haze and a warm glow at the left rear vent are in the before too.
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { material: /Red_LG/, box: [[2.2, 0.49, 0.4], [2.28, 0.54, 0.6]], part: 'off' },   // the red reflectors low on the bumper
    { material: /Red_LG/, part: 'lens' },
    { box: [[1.95, 0.76, 0.76], [1.99, 0.8, 0.8]], part: 'guide' },                 // the LED ring (on the bowl behind the centre)
    { box: [[2.005, 0.77, 0.765], [2.014, 0.795, 0.79]], minTris: 100, part: 'fill', glow: 1.5 },   // the centre disc and its LED ring (LOD 1 merges it with the bezels: unlit there)
    { box: [[2.2, 0.9, 0], [2.23, 0.95, 0.05]], part: 'fill', glow: 0.3 },           // the third brake light (a thin bar: a small glow, not a 16 cm disc)
    { part: 'off' },                                                                 // bezels, housing, rain lamp, plate lamps
  ],
  adopt: { material: /^keep\|Light$/, minX: 1.2 },
  spill: true,
  levels: { run: [0.13, 0.55], glowRun: [0, 0.22], glowBrake: [0.12, 0.7] },   // a thin ring, a fraction of AV-12's guide area: brighter, or it vanishes at night on red paint
  qa: { macro: [2.02, 0.78, 0.78] },
};
