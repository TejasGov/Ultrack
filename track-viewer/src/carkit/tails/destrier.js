// Destrier-X (Bugatti Destrier concept): per side one thin light blade across a recessed eye, a vertical centre stop lamp on
// the wing's pylon and a vertical lamp low in the diffuser. The model's "panel" is really a horizontal shelf (0.72 x 0.32 m,
// 18 mm thick, emissive on every face), so it reads as a thin line at the lamp's height (macro) and as a band from the chase
// camera above; no lens, no indicator, no reverse lamp named, and its map is flat (no structure to read).
// The blades are combined running/brake guides with no glow point (one point on a 0.72 m blade sits mid-blade as a dot); the
// pylon lamp a brake-only fill (its LED dots show at macro). Levels a little under AV-12's: the chase camera sees the
// shelves' top faces at a grazing angle (the rim boost), which ran them orange-red at night.
// Judgement call: the diffuser lamp is read as the reverse lamp (a single centre lamp low in the diffuser is where hypercars
// put it); unlit it is the reverse material's clear white, lit it adds a white glow and pool after dark. If a reference shows
// it is a red rain or fog light, make it part 'off'. No lens shell: a shell over an 18 mm shelf only thickens it.
// Shared code that would do better (orchestrator): a rule key by face normal, so only the shelf's rear-facing edge lights
// (a real light blade); today its whole top face does.
// QA (qa/taillights/destrier-before, -after, destrier-before-after*.jpg): true red lines by day (dark) and after dark, a clear
// brake step at chase (blades brighter, the pylon lamp on), no halo (the before's red fog over the exhausts is gone), a red
// pool and wet streak after dark, the reverse bar white with a pool at night. One drive frame of the first after run came
// back black (no console error; it did not reproduce on a rerun, whose drive frames are in -after).
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { box: [[2.40, 0.65, 0], [2.55, 1.0, 0.06]], part: 'fill' },      // the centre stop lamp on the wing's pylon
    { box: [[2.10, 0.0, 0], [2.32, 0.35, 0.06]], part: 'reverse' },   // the diffuser lamp
    { part: 'guide', glow: 0 },                                       // the blades
  ],
  spill: true,
  levels: { run: [0.08, 0.2], brake: [0.9, 0.8] },
  qa: { macro: [2.09, 0.69, 0.69] },
};
