// HU–10 (Huracán STO): per side a Y light guide (the running light, brighter on the brake) in a dark housing. The model has no
// lens and paints the guide in a 512 atlas (a red Y with a bright core); its tail role is the guide alone (54 tris per side),
// lit through the map (lo/hi low: the Y's dark red edges count too). Tried and dropped: adopting the housing (keep|..._lights,
// whose atlas holds a red LED grid) as a brake fill: its grid faces are not seen from behind, so it added only a glow blob
// mid-housing. The centre bar on the deck (2.15, 0.86, 0) is painted as an unlit grey strip and stays the model's; no reverse
// lamp (the model has no clear rear element and none is invented). The Y's glow point sits mid-housing, so it is kept small;
// the thin guide gets higher levels than AV-12's.
// QA 2026-10-30 (qa/taillights/huracan-after, sheets huracan-before-after*.jpg): a dark red Y by day running, a crisp red Y on
// the brake (no halo over the housing any more), a clear step at dusk, lit Y guides in the night-rain drive. Plain data.
export default {
  tail: [{ part: 'guide', glow: 0.35 }],                              // the Y light guides (the glow point sits mid-housing: kept small)
  tex: { lo: 0.01, hi: 0.1 },
  lens: { shell: 0.004 },
  spill: true,
  levels: { run: [0.14, 0.8], brake: [1.3, 2.0] },
};
