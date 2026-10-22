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
if (bad) { console.error('FAIL'); process.exit(1); }
console.log('PASS');
