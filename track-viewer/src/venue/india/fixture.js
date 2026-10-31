// Small light fixtures built from boxes: one merged geometry per material (housing, lens), instanced by the callers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** parts: [{ size: [w, h, d], at: [x, y, z], m?: Matrix4 (applied after placing, e.g. a tilt about the fixture's own pivot) }] -> one geometry */
export const boxes = (parts) => mergeGeometries(parts.map(({ size, at, m }) => {
  const g = new THREE.BoxGeometry(...size); g.deleteAttribute('uv'); g.translate(...at); if (m) g.applyMatrix4(m); return g;
}));

/** tilt about the x axis through `pivot` (y, z): + lifts what faces +z */
export const tilt = (a, [y, z]) => new THREE.Matrix4().makeTranslation(0, y, z).multiply(new THREE.Matrix4().makeRotationX(-a)).multiply(new THREE.Matrix4().makeTranslation(0, -y, -z));

/** the low edge fixture, origin at the middle of its back on the wall, lens facing +z (and a little down at the road): a graphite housing
 *  with a hood and a flush lens */
export function edgeFixtureParts() {
  const down = tilt(-0.14, [0, 0.03]);
  return {
    housing: boxes([{ size: [0.34, 0.12, 0.1], at: [0, 0, 0.02], m: down }, { size: [0.37, 0.012, 0.14], at: [0, 0.066, 0.04], m: down }]),
    lens: boxes([{ size: [0.27, 0.055, 0.006], at: [0, -0.004, 0.073], m: down }]),
  };
}

/** the bridge's uplight projector, origin on the ground at the middle of its base, aimed up and toward +z (the pillar): a base plate, a
 *  housing tipped back 55 degrees and a lens in its face */
export function projectorParts() {
  const up = tilt(0.96, [0.36, 0]);
  return {
    housing: boxes([{ size: [0.9, 0.1, 0.65], at: [0, 0.05, 0] }, { size: [0.76, 0.36, 0.54], at: [0, 0.36, 0], m: up }, { size: [0.14, 0.28, 0.1], at: [0, 0.18, -0.18] }]),
    lens: boxes([{ size: [0.66, 0.28, 0.02], at: [0, 0.36, 0.272], m: up }]),
  };
}
