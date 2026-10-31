// AV-12 (Aventador SVJ): per side three hexagonal cells, each an amber indicator over a red Y light guide and a lower red fill,
// then an inner red arrow and an aluminium honeycomb cell, read as the reverse lamp (a clear reflector cell). Approved by the
// user on 2026-10-30 (stills qa/taillights/av12-after, docs/tail-lights.md). Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [{ minTris: 500, part: 'guide' }, { part: 'fill' }],
  dark: /Orange_Lights/, darkColor: 0x6a2a04,
  lens: { material: /Glass_Lights/, minX: 1.5 },
  reverse: { material: /Aluminum/, box: [[2.13, 0.72, 0.455], [2.18, 0.83, 0.545]] },
  spill: true,
  qa: { macro: [2.08, 0.74, 0.62] },
};
