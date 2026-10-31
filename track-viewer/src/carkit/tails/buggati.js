// Divo-X (Bugatti Divo): the Divo's lamp is its 3D-printed fin array, a curve of thin horizontal red fins across the top of
// the rear grille (lit edge-on, so each fin reads as a short red line), and a third stop lamp at the end of the centre spine.
// The model gives 25 fins per side (10-tri slats, 12 mm thick, in staggered rows at y 0.67-0.76; all in the body node, so
// loose-parts.js's wheel-group fix does not touch them) and the centre lamp (148 tris at 2.05, 1.11, 0); no lens, no
// indicator, no reverse lamp. The fins are combined running/brake light guides (the brake brightens every fin), the centre
// lamp a brake-only fill. No reverse lamp is invented: its white pool and spill are off, so reversing shows nothing that has
// no source. No lens shell: the real fins are bare light guides, and a shell 4 mm out over a 12 mm slat only thickens it.
// Only each fin's rear edge lights (`facing`, 2 of its 10 tris; 2026-10-31): before, the whole slat lit, and the chase camera
// saw the top faces at a grazing angle as orange-red slabs (the rim boost; its levels were lowered for that, now AV-12's
// again). Now the array reads as the Divo's thin red lines between dark fins, the brake brightening every edge; the glow
// points sit on the edges. LOD 1 (168 tris) splits every fin into loose quads: the facing rule picks their rear quads there.
// QA 2026-10-31 (qa/taillights/buggati-step2b): thin red fin edges at macro and chase, day and night, a clear brake step.
// QA (qa/taillights/buggati-before, -after, buggati-before-after*.jpg): true red fins with a dark lamp by day, a clear red
// at dusk and night, a clear brake step at chase (every fin and the centre lamp), a tight glow per fin, a red pool and wet
// streak after dark; reverse changes nothing (no lamp on the model).
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { box: [[1.95, 1.0, 0], [2.15, 1.25, 0.06]], part: 'fill' },   // the centre stop lamp at the end of the spine
    { part: 'guide', facing: [[1, 0, 0], 0.5] },                   // the fins: their rear edges
    { part: 'off' },                                               // the fins' top and bottom faces
  ],
  spill: true,
  levels: { poolRev: [0, 0], spillRev: 0 },
  qa: { macro: [2.2, 0.73, 0.62] },
};
