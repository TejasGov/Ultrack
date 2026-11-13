// MP1-X (McLaren 650S GT3, since 2026-11-13; the 720S spec went with its model): per side two slim LED lamps high on the tail,
// an inner one beside the centre (2.20, 0.67, 0.17) and an outer one at the corner (2.12, 0.74, 0.60), each a Rear_Light strip
// with a thin Rear_Light_BIS overlay (the model's `tail` role, 150 tris in all). Every element is a guide (running light,
// brighter on the brake) under a smoked lens shell; the model's own clear lamp covers (Glass_Clear) stay over it. No reverse
// lamp is modelled. QA 2026-11-13 (qa/mp1x/lamps.png).
export default {
  tail: [{ part: 'guide', glow: 0.5 }],
  lens: { shell: 0.004 },
  spill: true,
  levels: { run: [0.14, 0.8], brake: [2.6, 3.6], glowBrake: [0.2, 0.8] },   // slim strips under a smoked lens: above the 720S blade's levels
};
