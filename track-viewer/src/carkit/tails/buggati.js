// Divo-X (Bugatti Divo): the Divo's lamp is its 3D-printed fin array, a curve of thin horizontal red fins across the top of
// the rear grille (lit edge-on, so each fin reads as a short red line), and a third stop lamp at the end of the centre spine.
// The model gives 25 fins per side (10-tri slats, 12 mm thick, in staggered rows at y 0.67-0.76; all in the body node, so
// loose-parts.js's wheel-group fix does not touch them) and the centre lamp (148 tris at 2.05, 1.11, 0); no lens, no
// indicator, no reverse lamp. The fins are combined running/brake light guides (the brake brightens every fin), the centre
// lamp a brake-only fill. No reverse lamp is invented: its white pool and spill are off, so reversing shows nothing that has
// no source. No lens shell: the real fins are bare light guides, and a shell 4 mm out over a 12 mm slat only thickens it.
// Levels: the chase camera sees the fins' top faces at a grazing angle (the rim boost), so at AV-12's levels they ran
// orange-red at night; running and brake are a little lower. LOD 1 (168 tris) splits every fin into loose quads: the
// catch-all keeps them guides.
// QA (qa/taillights/buggati-before, -after, buggati-before-after*.jpg): true red fins with a dark lamp by day, a clear red
// at dusk and night, a clear brake step at chase (every fin and the centre lamp), a tight glow per fin, a red pool and wet
// streak after dark; reverse changes nothing (no lamp on the model).
// Plain data, no imports: qa-taillights.mjs reads it.
export default {
  tail: [
    { box: [[1.95, 1.0, 0], [2.15, 1.25, 0.06]], part: 'fill' },   // the centre stop lamp at the end of the spine
    { part: 'guide' },                                             // the fins
  ],
  spill: true,
  levels: { run: [0.08, 0.22], brake: [0.9, 0.85], poolRev: [0, 0], spillRev: 0 },
  qa: { macro: [2.2, 0.73, 0.62] },
};
