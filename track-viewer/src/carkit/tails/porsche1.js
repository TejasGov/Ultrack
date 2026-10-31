// 918–S (918 Spyder): per side one slim wedge lamp, a red LED frame round a body-colour blade (the 918's "floating" lamp), the
// running light, brighter on the brake. The model has no lens and paints the lamp in the body's 1024 atlas (a ribbed red lens):
// the texture's ribs are the structure (lo/hi over its dark red). Under it a thin red strip (2.04, 0.62, ±0.73) read as a
// reflector, and two 1-tri bits facing down: unlit. No reverse lamp: the model has none (no clear element, no white texels in
// the lamp; the lamp's painted highlights would light as white if tex.white were on), and none is invented. The element's glow
// is kept small (its centre sits on the blade, not on the frame).
// QA 2026-10-30 (qa/taillights/porsche1-after, sheets porsche1-before-after*.jpg): dark ribbed red by day running, a clear red
// frame on the brake by day, red frames with a tight glow in the night-rain drive, no glow on the lower intakes any more.
// Plain data, no imports.
export default {
  tail: [
    { minTris: 100, part: 'guide', glow: 0.35 },                      // the lamp (153 tris per side, painted in the body atlas)
    { part: 'off' },                                                  // the thin red strip below it (a reflector) and the 1-tri bits
  ],
  tex: { lo: 0.03, hi: 0.3 },
  lens: { shell: 0.004 },
  spill: true,
};
