// The edge fixtures: a small graphite housing with a hood and a lit lens on the face of each barrier every 11.5 m, aimed in at the road
// (layout.js edgeFixtures; the light they throw is the band in road-light.js). A fixture is under a pixel a hundred metres out and would
// flicker as the camera moves, so each lens also gets a glow sprite (glow.js: a minimum size, energy that shrinks smoothly with
// distance, dark from behind the wall); the mesh stays under the bloom threshold and carries the close-up.
import * as THREE from 'three';
import { Glows } from '../../glow.js';
import { edgeFixtures } from './layout.js';
import { edgeFixtureParts } from './fixture.js';

const LENS = new THREE.Color('#dce8ff'), SPRITE = new THREE.Color(0.62, 0.74, 1.0);

export async function create({ scene, track, renderer, NO_MIRROR }) {
  const fx = edgeFixtures(track), { housing, lens } = edgeFixtureParts();
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x2b2e34, roughness: 0.5, metalness: 0.6 }), lensMat = new THREE.MeshBasicMaterial({ color: LENS.clone().multiplyScalar(0.05) });
  const body = new THREE.InstancedMesh(housing, housingMat, fx.length), glass = new THREE.InstancedMesh(lens, lensMat, fx.length);
  let glowGain = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), glows = new Glows();
  fx.forEach((f, i) => {
    q.setFromAxisAngle(up, Math.atan2(f.nx, f.nz)); m.compose(p.set(f.x, f.y, f.z), q, one);
    body.setMatrixAt(i, m); glass.setMatrixAt(i, m);
    glows.add([f.x + f.nx * 0.09, f.y - 0.01, f.z + f.nz * 0.09], SPRITE, 0.1, new THREE.Vector3(f.nx * 4, 0, f.nz * 4));   // |dir| 4: lit over a wide cone (down the road), dark from behind the wall
  });
  const group = new THREE.Group(); group.name = 'india edge fixtures';
  for (const o of [body, glass]) { o.frustumCulled = false; o.castShadow = o.receiveShadow = false; o.layers.set(NO_MIRROR); group.add(o); }   // tiny: nothing to reflect
  const points = glows.build(); points.name = 'india edge fixture glows'; points.layers.set(NO_MIRROR);   // not in the car reflection captures (a 3 px sprite fills a cube face) nor the wet-road mirror
  scene.add(group, points);
  console.info(`india edge fixtures: ${fx.length}`);
  return {
    /** lit: 0 (day) .. 1 (night), the lens; glow: the sprites' gain */
    gain(lit, glow) { lensMat.color.copy(LENS).multiplyScalar(0.05 + 0.95 * lit); glowGain = glow; points.visible = glow > 0.001; },
    update(t, camera) { glows.update(t, camera, renderer.getContext().drawingBufferHeight, scene.fog, glowGain); },
    dispose() {
      scene.remove(group, points);
      for (const g of [housing, lens, housingMat, lensMat, points.geometry, points.material]) g.dispose();
      body.dispose(); glass.dispose();
    },
  };
}
