// Active aero on a one-piece body. Meshy shells fuse the wing to the car, so the moving part is cut out by region:
// every triangle whose three corners sit inside the tuning box (shell metres) moves to its own mesh under a hinge.
// The struts below the box stay put, as on a real swan-neck wing. The cut mesh keeps the body material and its shell
// positions, so the paint, livery and finish shaders still line up on it.
//   tuning.aero: [{ name, min: [x,y,z], max: [x,y,z], hinge: [x,y] (axis across the car), mode, deg, rise, vOn }]
//   mode 'airbrake': tilts up to `deg` under hard braking above vOn m/s (Revuelto, Chiron, P1)
//   mode 'speed':    rises `rise` m and tilts `deg` above vOn m/s, stows below (911 Turbo, Continental, Chiron)
import * as THREE from 'three';

function cut(mesh, min, max) {
  const g = mesh.geometry, P = g.attributes.position, I = g.index.array, keep = [], take = [];
  const inside = (i) => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); return x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1] && z >= min[2] && z <= max[2]; };
  for (let t = 0; t < I.length; t += 3) (inside(I[t]) && inside(I[t + 1]) && inside(I[t + 2]) ? take : keep).push(I[t], I[t + 1], I[t + 2]);
  if (!take.length) return null;
  g.setIndex(keep);
  const part = new THREE.BufferGeometry();
  for (const [n, a] of Object.entries(g.attributes)) part.setAttribute(n, a);   // shares the vertex buffers
  part.setIndex(take);
  part.computeBoundingSphere();
  const out = new THREE.Mesh(part, mesh.material);
  out.castShadow = mesh.castShadow; out.receiveShadow = mesh.receiveShadow;
  return { mesh: out, tris: take.length / 3 };
}

export class ActiveAero {
  /** lod: the car's body THREE.LOD (levels hold groups of meshes in shell coordinates); specs: tuning.aero */
  constructor(lod, specs = []) {
    this.parts = [];
    for (const s of specs) {
      const pivots = []; let tris = 0;
      for (const level of lod.levels) {
        for (const m of [...level.object.children]) {
          const c = cut(m, s.min, s.max); if (!c) continue;
          const pivot = new THREE.Group(); pivot.name = `aero-${s.name ?? 'wing'}`;
          pivot.position.set(s.hinge[0], s.hinge[1], 0);
          c.mesh.position.set(-s.hinge[0], -s.hinge[1], 0);
          pivot.add(c.mesh); level.object.add(pivot); pivots.push(pivot); tris += c.tris;
        }
      }
      this.parts.push({ spec: s, pivots, tris, a: 0, y: 0 });
    }
  }

  /** speed m/s, brake 0..1 */
  update(dt, speed, brake) {
    for (const p of this.parts) {
      const s = p.spec, on = speed > (s.vOn ?? 20);
      const want = s.mode === 'airbrake' ? (on && brake > 0.45 ? 1 : 0) : (on ? 1 : 0);
      const rate = want > p.a ? 5 : 2.2;                              // deploys fast, stows slowly
      p.a += (want - p.a) * (1 - Math.exp(-rate * dt));
      for (const pv of p.pivots) {
        // hinge on the leading edge; the trailing edge (+X, the tail) lifts: a positive rotation about Z
        pv.rotation.z = THREE.MathUtils.degToRad(s.deg ?? 0) * p.a;
        pv.position.y = s.hinge[1] + (s.rise ?? 0) * p.a;
      }
    }
  }

  get state() { return this.parts.map((p) => ({ name: p.spec.name, deployed: +p.a.toFixed(2), tris: p.tris })); }
}
