// Self-check for perf.js Culler's Far stand-ins: per instance, the detailed set and its "Far" box set swap at the
// same update (never both, never neither) as the camera walks away and back.   node scripts/test-culler.mjs
import * as THREE from 'three';
import { Culler } from '../src/perf.js';

const root = new THREE.Group();
const geo = new THREE.BoxGeometry(3, 1.6, 2.4);
const sets = ['M_Truss', 'M_TrussFar'].map((name) => {
  const o = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ name }), 10);
  for (let k = 0; k < 10; k++) o.setMatrixAt(k, new THREE.Matrix4().makeTranslation(k * 3, 0, 0));
  root.add(new THREE.Group().add(o));
  return o;
});
const culler = new Culler(root);
const lim = geo.boundingSphere.radius * culler.k;
let bad = 0;
for (const d of [10, lim * 0.9, lim * 1.1, lim * 1.3, lim * 3, lim * 1.1, lim * 0.95, 10, lim * 9]) {
  culler.update(new THREE.Vector3(0, 0, d));
  const [near, far] = sets.map((s) => s.count);
  const expectBoth = d < lim * 8 * 0.99;             // past FAR x the distance both are gone
  if (expectBoth ? near + far !== 10 : near + far !== 0) { bad++; console.error(`d=${d.toFixed(0)}: near ${near} far ${far}`); }
}
// distance tiers: names tagged `~lo-hi` show only inside the range (instanced and plain), full -> copy swap with no gap
{
  const r2 = new THREE.Group(), g2 = new THREE.BoxGeometry(2, 2, 2);
  const mk = (name) => { const o = new THREE.InstancedMesh(g2, new THREE.MeshBasicMaterial(), 3); o.name = name; for (let k = 0; k < 3; k++) o.setMatrixAt(k, new THREE.Matrix4().makeTranslation(k, 0, 0)); r2.add(o); return o; };
  const a = mk('hero~0-100'), b = mk('hero_far~100-1500');
  const plain = new THREE.Mesh(g2, new THREE.MeshBasicMaterial()); plain.name = 'castle~0-300'; r2.add(plain);
  const c2 = new Culler(r2);
  for (const [d, wa, wb, wp] of [[10, 3, 0, true], [80, 3, 0, true], [150, 0, 3, true], [400, 0, 3, false], [1400, 0, 3, false], [1700, 0, 0, false], [10, 3, 0, true]]) {
    c2.update(new THREE.Vector3(0, 0, d));
    if (a.count !== wa || b.count !== wb || plain.visible !== wp) { bad++; console.error(`tier d=${d}: ${a.count}/${b.count}/${plain.visible}`); }
  }
}
if (bad) { console.error('FAIL'); process.exit(1); }
console.log('PASS');
