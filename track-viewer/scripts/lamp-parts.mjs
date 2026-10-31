// The lamp parts of a car's model, for writing its tail spec (src/carkit/tails/<car>.js, docs/tail-lights.md): every material
// whose role or name looks like a lamp, its connected components (car-lab frame metres: +x is the tail, y up, z to the side) and,
// with --box, every material with triangles inside a box (|z| is used, so one box covers both sides).
//   node scripts/lamp-parts.mjs av12                      lamp-like materials of assets/cars/av12/car_lod0.glb
//   node scripts/lamp-parts.mjs av12 "Aluminum|Chrome"    the components of the materials matching a regex
//   node scripts/lamp-parts.mjs av12 --box 2.1,0.7,0.36,2.2,0.84,0.56
//   node scripts/lamp-parts.mjs av12 --mats               every material: triangles, rear triangles (x > 1.2), alpha, colour, maps
//   ... --lod 1                                           the same on car_lod1.glb (the far level, 45 m+)
//   node scripts/lamp-parts.mjs laferrari "^tail\|" --uv qa/taillights/laferrari-uv.png
//                                                         a lamp drawn in its texture: the matching materials' map (--emissive: the
//                                                         emissive map) cropped to the UVs of their rear triangles (x > 1.2), outlines
//                                                         on top; below it what the tail shader makes of it with the car's `tex` spec
//                                                         (src/carkit/tails/<car>.js, else the defaults): red = lamp weight, white =
//                                                         reverse; tune tex.lo/hi/white here before any browser run
//   node scripts/lamp-parts.mjs laferrari --rules [--lod 1]   a dry run of the car's spec on its model: spec mistakes, the part
//                                                         each tail component gets, what dark/lens/reverse/adopt/tex catch
import { existsSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { components, texLamp, tailRule, checkSpec } from '../src/carkit/taillights.js';

const [car = 'av12', ...rest] = process.argv.slice(2), arg = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
const box = arg('--box')?.split(',').map(Number), lod = arg('--lod') ?? '0', mats = rest.includes('--mats'), uvOut = arg('--uv');
const specFile = new URL(`../src/carkit/tails/${car}.js`, import.meta.url), spec = existsSync(specFile) ? (await import(specFile)).default : {};
const emissive = rest.includes('--emissive') || spec.tex?.map === 'emissiveMap', rules = rest.includes('--rules');
if (rules) console.log(existsSync(specFile) ? `tails/${car}.js: ${checkSpec(spec).join('; ') || 'well formed'}` : `no tails/${car}.js: the defaults (every tail component a guide)`);
const want = new RegExp(rest.find((a, i) => !a.startsWith('--') && !['--box', '--lod', '--uv'].includes(rest[i - 1])) ?? '^(tail|brake|reverse)\\||light|lamp|lens|red|orange|amber', 'i');
const uvs = [];             // --uv: { tex, tris: [[u,v] x3] } of the matching materials' rear triangles
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(new URL(`../../assets/cars/${car}/car_lod${lod}.glb`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const f = (v) => v.toArray().map((x) => x.toFixed(3)).join(' ');
const tex = (t) => (t ? `${t.getMimeType().split('/')[1]} ${t.getSize()?.join('x') ?? '?'}` : '-');
const describe = (m) => `${m?.getAlphaMode()}${m?.getAlphaMode() === 'BLEND' ? ' ' + m.getBaseColorFactor()[3].toFixed(2) : ''}, base ${m?.getBaseColorFactor().slice(0, 3).map((x) => x.toFixed(2)).join(',')}, emissive ${m?.getEmissiveFactor().map((x) => x.toFixed(2)).join(',')}, map ${tex(m?.getBaseColorTexture())}, emissiveMap ${tex(m?.getEmissiveTexture())}`;
const all = new Map();      // --mats: material -> { tris, rear }
for (const n of doc.getRoot().listNodes()) {
  const mesh = n.getMesh(); if (!mesh) continue;
  const M = new THREE.Matrix4().fromArray(n.getWorldMatrix());
  for (const p of mesh.listPrimitives()) {
    const name = p.getMaterial()?.getName() ?? '', a = p.getAttribute('POSITION'), ix = p.getIndices();
    const pos = new THREE.BufferAttribute(new Float32Array(a.getCount() * 3), 3), e = [];
    for (let i = 0; i < a.getCount(); i++) pos.setXYZ(i, ...new THREE.Vector3(...a.getElement(i, e)).applyMatrix4(M).toArray());
    const index = ix ? new THREE.BufferAttribute(Uint32Array.from(ix.getArray()), 1) : null, T = (index ? index.count : pos.count) / 3;
    const centroid = (t, c, v) => { c.set(0, 0, 0); for (let j = 0; j < 3; j++) c.add(v.fromBufferAttribute(pos, index ? index.getX(3 * t + j) : 3 * t + j)); return c.divideScalar(3); };
    if (rules) {        // fitLevel's order: tail role / adopted, dark, lens, reverse (LOD 0 only); guide/fill blend at LOD 1
      const adopt = spec.adopt?.material.test(name) && !name.startsWith('tail|'), behind = (x) => (min) => x > (min ?? -Infinity), c = new THREE.Vector3(), v = new THREE.Vector3();
      const rearTris = (min) => { let k = 0; for (let t = 0; t < T; t++) if (behind(centroid(t, c, v).x)(min)) k++; return k; };
      if (name.startsWith('tail|') || adopt) {
        const M2 = p.getMaterial(), map = spec.tex?.map === 'emissiveMap' ? M2?.getEmissiveTexture() : M2?.getBaseColorTexture() ?? M2?.getEmissiveTexture();
        const tex = spec.tex && map && p.getAttribute('TEXCOORD_0') && (!spec.tex.material || spec.tex.material.test(name));
        console.log(`\n${name}${adopt ? ` (adopted, x > ${spec.adopt.minX ?? '-'}${spec.adopt.box ? ', in ' + JSON.stringify(spec.adopt.box) : ''}; by element centre here, by triangle in the game)` : ''}: ${tex ? 'tex (its map drives the elements)' : 'no tex'}`);
        const inAdopt = (p) => !adopt || (behind(p.x)(spec.adopt.minX) && (!spec.adopt.box || (p.x >= spec.adopt.box[0][0] && p.x <= spec.adopt.box[1][0] && p.y >= spec.adopt.box[0][1] && p.y <= spec.adopt.box[1][1] && Math.abs(p.z) >= spec.adopt.box[0][2] && Math.abs(p.z) <= spec.adopt.box[1][2])));
        const { tri, list } = components(pos, index), facing = spec.tail?.some((r) => r.facing), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
        const byFace = list.map(() => new Map());      // a facing rule splits an element per triangle: the part of each triangle
        if (facing) tri.forEach((k, t) => {
          [A, B, C].forEach((p, j) => p.fromBufferAttribute(pos, index ? index.getX(3 * t + j) : 3 * t + j)); const zs = Math.sign(A.z + B.z + C.z) || 1;
          B.sub(A).cross(C.sub(A)).normalize(); B.z *= zs; const p = tailRule(spec, list[k], name, B)?.part ?? 'unlit'; byFace[k].set(p, (byFace[k].get(p) ?? 0) + 1);
        });
        for (const k of list.map((s, k) => k).filter((k) => inAdopt(list[k].centre)).sort((x, y) => list[x].centre.z - list[y].centre.z || list[x].centre.x - list[y].centre.x)) {
          const s = list[k], r = tailRule(spec, s, name), flags = ['glowAlong', 'flip'].filter((x) => r?.[x]).concat(r?.tex === false ? ['tex: false'] : []).join(' ');
          console.log(`  ${(r?.part ?? '(none: unlit)').padEnd(10)} ${r?.glow !== undefined ? `glow ${r.glow} ` : ''}${flags ? flags + ' ' : ''}tris ${String(s.tris).padStart(5)}  centre ${f(s.centre)}  size ${f(s.box.getSize(new THREE.Vector3()))}${facing ? '  by facing: ' + [...byFace[k]].map(([p, n]) => `${p} ${n}`).join(', ') : ''}`);
        }
      } else if (spec.dark?.test(name)) console.log(`\n${name}: dark (an unlit lens, ${T} tris)`);
      else if (spec.lens?.material?.test(name)) console.log(`\n${name}: lens (${rearTris(spec.lens.minX)} of ${T} tris move onto the smoked rearLens)`);
      else if (lod === '0' && spec.reverse?.material?.test(name)) console.log(`\n${name}: reverse candidate (${rearTris(spec.reverse.minX)} tris behind minX; a box narrows it further)`);
      continue;
    }
    if (mats) {
      const s = all.get(name) ?? all.set(name, { tris: 0, rear: 0, m: p.getMaterial() }).get(name), c = new THREE.Vector3(), v = new THREE.Vector3();
      for (let t = 0; t < T; t++) { s.tris++; if (centroid(t, c, v).x > 1.2) s.rear++; }
      continue;
    }
    if (box) {          // which materials have triangles in the box
      const b = new THREE.Box3(), c = new THREE.Vector3(), v = new THREE.Vector3(); let k = 0;
      for (let t = 0; t < T; t++) {
        centroid(t, c, v);
        if (c.x > box[0] && c.x < box[3] && c.y > box[1] && c.y < box[4] && Math.abs(c.z) > box[2] && Math.abs(c.z) < box[5]) { k++; b.expandByPoint(c); }
      }
      if (k) console.log(`${name.padEnd(36)} ${String(k).padStart(6)} tris  ${f(b.min)} .. ${f(b.max)}`);
      continue;
    }
    if (!want.test(name)) continue;
    if (uvOut) {
      const M2 = p.getMaterial(), tx = emissive ? M2?.getEmissiveTexture() : M2?.getBaseColorTexture() ?? M2?.getEmissiveTexture();   // as texMaterial() picks it
      const uv = p.getAttribute('TEXCOORD_0'), c = new THREE.Vector3(), v = new THREE.Vector3();
      if (uv && tx) for (let t = 0; t < T; t++) if (centroid(t, c, v).x > 1.2) uvs.push({ tex: tx, tri: [0, 1, 2].map((j) => uv.getElement(index ? index.getX(3 * t + j) : 3 * t + j, [])) });
      continue;
    }
    const { list } = components(pos, index);
    console.log(`\n${name}  (${describe(p.getMaterial())}; ${list.length} components)`);
    for (const s of list.sort((x, y) => y.area - x.area).slice(0, 40)) console.log(`  tris ${String(s.tris).padStart(5)}  area ${(s.area * 1e4).toFixed(0).padStart(5)} cm2  centre ${f(s.centre)}  size ${f(s.box.getSize(new THREE.Vector3()))}  normal ${f(s.normal.clone().normalize())}`);
  }
}
if (mats) for (const [name, s] of [...all].sort((x, y) => y[1].rear - x[1].rear)) console.log(`${name.padEnd(48)} ${String(s.tris).padStart(6)} tris ${String(s.rear).padStart(6)} rear  ${describe(s.m)}`);
if (uvOut) {
  if (!uvs.length) { console.log('no rear triangles with a map and UVs match'); process.exit(1); }
  const { default: sharp } = await import('sharp'), tex = uvs[0].tex, [W, H] = tex.getSize(), all2 = uvs.filter((u) => u.tex === tex).flatMap((u) => u.tri);
  const fr = (x) => x - Math.floor(x);         // a repeat-wrapped UV: the texel it reads
  const us = all2.map((p) => fr(p[0]) * W), vs = all2.map((p) => fr(p[1]) * H), pad = 8;
  const x0 = Math.max(0, Math.floor(Math.min(...us)) - pad), y0 = Math.max(0, Math.floor(Math.min(...vs)) - pad);
  const w = Math.min(W, Math.ceil(Math.max(...us)) + pad) - x0, h = Math.min(H, Math.ceil(Math.max(...vs)) + pad) - y0, k = Math.max(1, Math.floor(1024 / Math.max(w, h)));
  const lines = uvs.filter((u) => u.tex === tex).map((u) => `<polygon points="${u.tri.map((p) => `${(fr(p[0]) * W - x0) * k},${(fr(p[1]) * H - y0) * k}`).join(' ')}" fill="none" stroke="#0f0" stroke-opacity="0.35" stroke-width="1"/>`).join('');
  const crop = sharp(Buffer.from(tex.getImage())).extract({ left: x0, top: y0, width: w, height: h }).removeAlpha(), up = (s) => s.resize(w * k, h * k, { kernel: 'nearest' }).png().toBuffer();
  const img = await sharp(await up(crop.clone())).composite([{ input: Buffer.from(`<svg width="${w * k}" height="${h * k}">${lines}</svg>`) }]).png().toBuffer();
  // what the shader sees (texLamp on linear colour): lamp weight in red, the reverse in white, the rest at 15 % for orientation
  const raw = await crop.clone().raw().toBuffer(), cls = Buffer.alloc(raw.length), lin = (x) => ((x / 255 + 0.055) / 1.055) ** 2.4;
  for (let i = 0; i < raw.length; i += 3) {
    const [r, g, b] = [raw[i], raw[i + 1], raw[i + 2]], t = texLamp(lin(r), lin(g), lin(b), spec.tex), grey = 0.15 * (r + g + b) / 3;
    cls[i] = Math.min(255, grey + 255 * Math.max(t.lamp, t.white)); cls[i + 1] = cls[i + 2] = Math.min(255, grey + 255 * t.white);
  }
  const panel = await up(sharp(cls, { raw: { width: w, height: h, channels: 3 } }));
  await sharp({ create: { width: w * k, height: 2 * h * k + 4, channels: 3, background: '#333' } }).composite([{ input: img, top: 0, left: 0 }, { input: panel, top: h * k + 4, left: 0 }]).toFile(uvOut);
  console.log(`${uvOut}: ${tex.getName() || 'map'} ${W}x${H}, texels ${x0},${y0} ${w}x${h} (x${k}), ${uvs.length} rear triangles; below: tex ${JSON.stringify(spec.tex ?? 'defaults')}`);
}
