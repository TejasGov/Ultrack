// Loose bodywork inside a wheel group. The Divo's source model (scripts/model-car.py, wheels.mode "loose") handed whole body parts
// (skirts, ducts, underbody, up to 1.7 m from the hub) to its wheel nodes: they sit right while the wheel stands still and swing
// round the hub with every turn of it, so a car that had driven (or crashed to a halt) carried scrap floating around it, and the
// angle outlived the session. Whole parts (triangles joined by shared corners) that reach past the tyre go back to the body.
import * as THREE from 'three';

/** group: a wheel's merged spin group (non-indexed float meshes, hub on the Z axis); R: tyre radius (m); level: the body group the parts join */
export function shedBodywork(group, R, level) {
  group.updateMatrixWorld(true); level.updateMatrixWorld(true);
  const toLevel = new THREE.Matrix4().copy(level.matrixWorld).invert().multiply(group.matrixWorld), lim = R * 1.15;   // tyre, rim and disc stay inside 1.05 R
  for (const mesh of [...group.children]) {
    const g = mesh.geometry, P = g?.attributes.position;
    if (!mesh.isMesh || g.index || !P) continue;
    let far = false; for (let i = 0; i < P.count && !far; i++) far = Math.hypot(P.getX(i), P.getY(i)) > lim;
    if (!far) continue;                                              // every other car, and most meshes here: nothing to walk
    const n = P.count / 3, up = Int32Array.from({ length: n }, (_, i) => i), at = new Map();
    const top = (a) => { while (up[a] !== a) a = up[a] = up[up[a]]; return a; };
    for (let i = 0; i < P.count; i++) {                              // union-find: triangles sharing a corner are one part
      const k = `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`, t = (i / 3) | 0;
      if (at.has(k)) up[top(t)] = top(at.get(k)); else at.set(k, t);
    }
    const reach = new Float32Array(n);                               // per part: its farthest corner from the hub axis
    for (let i = 0; i < P.count; i++) { const r = top((i / 3) | 0); reach[r] = Math.max(reach[r], Math.hypot(P.getX(i), P.getY(i))); }
    const pick = (loose) => {
      const out = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(g.attributes)) {
        const s = a.itemSize, v = [];
        for (let t = 0; t < n; t++) if ((reach[top(t)] > lim) === loose) for (let j = 0; j < 3 * s; j++) v.push(a.array[t * 3 * s + j]);
        out.setAttribute(name, new THREE.BufferAttribute(new Float32Array(v), s));
      }
      return out;
    };
    const part = new THREE.Mesh(pick(true).applyMatrix4(toLevel), mesh.material);
    part.castShadow = part.receiveShadow = true; part.renderOrder = mesh.renderOrder;
    level.add(part);
    mesh.geometry = pick(false); g.dispose();
  }
}
