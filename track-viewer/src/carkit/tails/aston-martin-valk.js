// Valkyrie-X (Valkyrie): per side a 3 x 3 array of short edge-lit LED bars in a dark recess; the top and bottom rows are the
// running light (brighter on the brake), the middle row lights on the brake only. Plain data, no imports.
export default {
  tail: [
    { box: [[1.9, 0.595, 0.6], [2.2, 0.615, 0.9]], part: 'fill', glow: 0.7 },   // the middle row (y 0.604): brake only
    { part: 'guide', glow: 0.7 },                                      // the top (0.626) and bottom (0.583) rows
  ],
  tex: {},
  lens: { shell: 0.004, opacity: 0.25 },
  spill: true,
  levels: { run: [0.14, 0.8], brake: [1.2, 1.8] },
};
