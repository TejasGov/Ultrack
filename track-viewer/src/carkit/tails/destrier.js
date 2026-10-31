// Destrier-X (Bugatti Destrier concept): per side one thin light blade across a recessed eye, a vertical centre stop lamp on
// the wing's pylon and a vertical lamp low in the diffuser. The model's "panel" is really a horizontal shelf (0.72 x 0.32 m,
// 18 mm thick, emissive on every face), so it reads as a thin line at the lamp's height (macro) and as a band from the chase
// camera above; no lens, no indicator, no reverse lamp named, and its map is flat (no structure to read).
// The blades are combined running/brake guides; only each shelf's rear edge lights (`facing`, 47 of its 532 tris; 2026-10-31):
// before, the whole shelf lit and the chase camera saw its top as an orange-red band, so the levels had been lowered (now
// AV-12's again). The blade glows along its length (`glowAlong`: one point sat mid-blade as a dot). The pylon lamp is a
// brake-only fill (its LED dots show at macro).
// Judgement call: the diffuser lamp is read as the reverse lamp (a single centre lamp low in the diffuser is where hypercars
// put it); unlit it is a dark clear lens (`reverse.color`; the white headlamp material read as a lit lamp while driving), lit a
// white bar with glare along it and a pool after dark. If a reference shows it is a red rain or fog light, make it part 'off'.
// No lens shell: a shell over an 18 mm shelf only thickens it. QA 2026-10-31 (qa/taillights/destrier-step2c, -step2d): a thin
// lit blade with a line of glare on the brake, the unlit diffuser lamp dark, white when reversing.
// QA (qa/taillights/destrier-before, -after, destrier-before-after*.jpg): true red lines by day (dark) and after dark, a clear
// brake step at chase (blades brighter, the pylon lamp on), no halo (the before's red fog over the exhausts is gone), a red
// pool and wet streak after dark, the reverse bar white with a pool at night. One drive frame of the first after run came
// back black (no console error; it did not reproduce on a rerun, whose drive frames are in -after).
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { box: [[2.40, 0.65, 0], [2.55, 1.0, 0.06]], part: 'fill' },      // the centre stop lamp on the wing's pylon
    { box: [[2.10, 0.0, 0], [2.32, 0.35, 0.06]], part: 'reverse', glowAlong: true },   // the diffuser lamp (a 20 cm bar: glare along it, not a disc)
    { part: 'guide', facing: [[1, 0, 0], 0.5], glowAlong: true },    // the blades: their rear edge
    { part: 'off' },                                                  // the shelves' top and bottom faces
  ],
  reverse: { color: 0x1c1e22 },                                       // unlit: a dark clear lens, not the white headlamp material
  spill: true,
  qa: { macro: [2.09, 0.69, 0.69] },
};
