// 918–S (918 Spyder): per side one slim wedge lamp under a red lens, its LED contour the running light, brighter on the brake.
// Plain data, no imports.
export default {
  tail: [
    { minTris: 100, part: 'guide', glow: 0.35 },                                // the lamp (153 tris per side, painted in the body atlas)
    { part: 'off' },                                                  // the thin red strip below it (a reflector) and the 1-tri bits
  ],
  tex: { lo: 0.03, hi: 0.3 },
  lens: { shell: 0.004 },
  spill: true,
};
