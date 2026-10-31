// La Furari (LaFerrari): per side one round lamp, an LED ring (running light, brighter on the brake) round a clear centre with a
// reflector, read as the reverse lamp (the model names none; a clear reflector cell is a reverse lamp's signature, as in Ferrari's
// round lamps), and a centre stop lamp at the back of the roof. The model has no lens and paints the lamp in a 512 atlas, in two
// layers per side: in front (x 2.124-2.129) the LED ring wearing the atlas's lit ring (LED pods with orange-yellow hot cores: `hue`
// lets them count as lamp, lo/hi keep the pods brighter than the gaps), 1 mm behind it the unlit ring, the centre reflector dome
// and the barrel (one component: `off`, its white reflector lights on reverse through tex.white). The lower red pair in the
// diffuser (keep|..._lights, a red strip in the atlas) is a reflector or fog lamp: left unlit.
// Judgement calls: `base` is warmed toward red (the ring's unlit look is the atlas's lit orange ring); the levels are higher than
// AV-12's (a small 17 cm ring under the shell lens read dim at night). The reverse shows the atlas's reflector, so its dark
// facets stay dark (a little ragged at 1.4 m: the KTX2 copy's dark texels fail the white test's saturation).
// QA 2026-10-30 (qa/taillights/laferrari-after, sheets laferrari-before-after*.jpg): red rings with LED pods at macro, dark by
// day running, a clear red step on the brake, the stop lamp lights on the brake, lit rings with a tight glow in the night-rain
// drive. Plain data, no imports.
export default {
  tail: [
    { box: [[0.8, 0.9, 0], [1.0, 1.1, 0.25]], part: 'fill' },        // the centre stop lamp (0.89, 0.99, 0; 0.36 m wide)
    { box: [[2.05, 0.6, 0.65], [2.1, 0.8, 0.85]], part: 'off' },     // the back layer: unlit, its white reflector lights on reverse (tex.white)
    { part: 'guide', glow: 0.6 },                                     // the LED ring (its glow point sits on the clear centre: kept small)
  ],
  tex: { lo: 0.15, hi: 0.9, hue: [0.6, 0.9], white: [0.15, 0.6], base: 0x704840 },
  lens: { shell: 0.004 },
  spill: true,
  levels: { run: [0.16, 1.1], brake: [1.2, 1.9], rev: [0.8, 1.0], glowRun: [0, 0.22] },
};
