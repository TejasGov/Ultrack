// The lamp parts of a car's model, for writing its TAIL_SPECS entry (docs/tail-lights.md): every material whose role or name
// looks like a lamp, its connected components (car-lab frame metres: +x is the tail, y up, z to the side) and, with --box,
// every material with triangles inside a box (|z| is used, so one box covers both sides).
//   node scripts/lamp-parts.mjs av12                      lamp-like materials of assets/cars/av12/car_lod0.glb
//   node scripts/lamp-parts.mjs av12 "Aluminum|Chrome"    the components of the materials matching a regex
//   node scripts/lamp-parts.mjs av12 --box 2.1,0.7,0.36,2.2,0.84,0.56
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { components } from '../src/carkit/taillights.js';

const [car = 'av12', ...rest] = process.argv.slice(2), bi = rest.indexOf('--box'), box = bi >= 0 ? rest[bi + 1].split(',').map(Number) : null;
const want = new RegExp(rest.find((a, i) => !a.startsWith('--') && i !== bi + 1) ?? '^(tail|brake|reverse)\\||light|lamp|lens|red|orange|amber', 'i');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(new URL(`../../assets/cars/${car}/car_lod0.glb`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const f = (v) => v.toArray().map((x) => x.toFixed(3)).join(' ');
for (const n of doc.getRoot().listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  const M = new THREE.Matrix4().fromArray(n.getWorldMatrix());
  for (const p of mesh.listPrimitives()) {
    const name = p.getMaterial()?.getName() ?? '', a = p.getAttribute('POSITION'), ix = p.getIndices();
    const pos = new THREE.BufferAttribute(new Float32Array(a.getCount() * 3), 3), e = [];
    for (let i = 0; i < a.getCount(); i++) pos.setXYZ(i, ...new THREE.Vector3(...a.getElement(i, e)).applyMatrix4(M).toArray());
    const index = ix ? new THREE.BufferAttribute(Uint32Array.from(ix.getArray()), 1) : null;
    if (box) {          // which materials have triangles in the box
      const b = new THREE.Box3(), c = new THREE.Vector3(), v = new THREE.Vector3(); let k = 0;
      for (let t = 0; t < (index ? index.count : pos.count); t += 3) {
        c.set(0, 0, 0); for (let j = 0; j < 3; j++) c.add(v.fromBufferAttribute(pos, index ? index.getX(t + j) : t + j)); c.divideScalar(3);
        if (c.x > box[0] && c.x < box[3] && c.y > box[1] && c.y < box[4] && Math.abs(c.z) > box[2] && Math.abs(c.z) < box[5]) { k++; b.expandByPoint(c); }
      }
      if (k) console.log(`${name.padEnd(36)} ${String(k).padStart(6)} tris  ${f(b.min)} .. ${f(b.max)}`);
      continue;
    }
    if (!want.test(name)) continue;
    const { list } = components(pos, index);
    console.log(`\n${name}  (${p.getMaterial()?.getAlphaMode()}, ${list.length} components)`);
    for (const s of list.sort((x, y) => y.area - x.area).slice(0, 40)) console.log(`  tris ${String(s.tris).padStart(5)}  area ${(s.area * 1e4).toFixed(0).padStart(5)} cm2  centre ${f(s.centre)}  size ${f(s.box.getSize(new THREE.Vector3()))}  normal ${f(s.normal.clone().normalize())}`);
  }
}
