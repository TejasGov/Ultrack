// MP1-X (720S): per side a C-shaped lamp whose light is one slim LED blade along its top edge (running light, brighter on the
// brake) in a dark smoked lens over the rear mesh. The model is very low poly (44 tail tris) and paints the blade as a thin red
// stripe on the dark lens in a 512 atlas: `tex` lights the stripe only (lo/hi low, so its soft edge counts too), the rest of
// the lens stays dark. The blade is thin, so its levels are above AV-12's and its glow is small (the C-lamp's glow point sits on
// the lens centre, below the blade). Judgement calls: the tiny clear slit low in the centre (2.13, 0.30, 0; 6 x 1 cm, grey in
// the atlas) is the reverse lamp; the down-facing bar over the plate (2.15, 0.72, 0) is the plate lamp, the grey side markers
// and the dark red lower pair (reflectors) stay unlit.
// The centre stop lamp on the engine cover (1.34, 0.90, 0; 6 tris, a 27 x 2.4 cm plate facing back) is painted as an unlit
// dark bar of LED dots, so it is a brake fill with `tex: false` (lit whatever its texels, its LED dots from the fill shader),
// glowing along its length (one point at its centre was a 11 cm blob). QA 2026-10-31 (qa/taillights/mp1x-step2): a crisp red
// bar under the rear window on the brake at chase by day and night, dark when running.
// QA 2026-10-30 (qa/taillights/mp1x-after, sheets mp1x-before-after*.jpg): the flat red slab of the generic lamp is now a thin
// red blade, dark lens by day, a clear brighter blade on the brake at dusk and in the night-rain drive; at 20 m by night the
// running blades are faint (thin), the brake reads with its pool. Plain data, no imports.
export default {
  tail: [
    { box: [[1.85, 0.65, 0.5], [2.05, 0.85, 0.8]], part: 'guide', glow: 0.2 },   // the C-lamps: only the painted red stripe lights (tex)
    { box: [[2.1, 0.25, 0], [2.16, 0.35, 0.05]], part: 'reverse' },               // the small clear slit low in the centre
    { box: [[1.3, 0.85, 0], [1.4, 0.95, 0.15]], part: 'fill', tex: false, glowAlong: true },   // the centre stop lamp (painted unlit in the atlas)
    { part: 'off' },                                                               // plate lamp, side markers, reflectors
  ],
  tex: { lo: 0.01, hi: 0.25 },
  lens: { shell: 0.004 },
  spill: true,
  levels: { run: [0.14, 0.8], brake: [1.5, 2.4], glowBrake: [0.15, 0.7] },
};
