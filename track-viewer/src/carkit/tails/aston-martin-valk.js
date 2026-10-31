// Valkyrie-X (Valkyrie): per side a 3 x 3 array of short edge-lit LED bars in a dark recess (the model's reading of the car's
// slim lamps); the top and bottom rows are the running light (brighter on the brake), the middle row lights on the brake only,
// with LED dots: the brake adds a row, a clear step at chase distance. The model has no lens and maps each bar's lit face to a
// red strip in a 512 atlas that fades from a bright inner end to dark (the edge-lit look, kept by the default lo/hi); its top
// face to a grey strip (unlit). LOD 1 keeps all 18 bars (decimated), so the row boxes hold there.
// Judgement calls: the rows' roles (no reference shows the real lamp's split); the lens is thinner than AV-12's (opacity 0.25):
// the shell follows each bar, so its glossy top faces caught a floodlight at night as a white hot spot; the bars are small, so
// the levels are above AV-12's. The red piece above the array (keep|..._lights, 2.08, 0.70, ±0.73) is read as a reflector and
// stays unlit; no reverse lamp (the model has no clear rear element and none is invented).
// QA 2026-10-30 (qa/taillights/aston-martin-valk-after, sheets aston-martin-valk-before-after*.jpg): no halo over the recess any
// more, dark red bars by day running, the middle row joins with LED dots on the brake, lit bars with a tight glow in the
// night-rain drive. Plain data, no imports.
export default {
  tail: [
    { box: [[1.9, 0.595, 0.6], [2.2, 0.615, 0.9]], part: 'fill', glow: 0.7 },   // the middle row (y 0.604): brake only
    { part: 'guide', glow: 0.7 },                                                 // the top (0.626) and bottom (0.583) rows
  ],
  tex: {},
  lens: { shell: 0.004, opacity: 0.25 },
  spill: true,
  levels: { run: [0.14, 0.8], brake: [1.2, 1.8] },
};
