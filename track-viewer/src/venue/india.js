// India Ghat Circuit's runtime details, loaded by main.js through tracks.js `venue` after the venue GLB.
//   barrier reflectors   amber retro-reflectors on the barrier face (track.json `reflectors`): a dull amber plate by day; at dusk and
//                        night they shine back when the car's lights reach them (bright near the camera, facing it), never blinking
//   bridge uplights      warm off-white fixtures at the foot of each portal leg (track.json `bridgeUplights`) with a soft wash up the leg
//   tree canopies        the forest's canopy meshes (V5 forest / ... `_1`): matte, with leaf-clump shading in a clone of their shared
//                        vertex-colour material. The ragged outline is in the mesh now (tracks/india/art_v56_trees.py): nothing moves
//                        the vertices or cuts the edges here, so the two never double up and nothing shimmers
//   hoardings            OPPO / vivo boards on four city façades and one BJP roadside hoarding on the city approach, where the export
//                        found them (track.json `venueBoards`, tracks/india/game_india_boards.py; images in assets/india/ads, sources in
//                        assets/sponsors/manifest.json); Sony -> Jio is tracks.js `brands`
//   crowd                a seated spectator on most stand seats: three instanced meshes (shirt, head, legs), no per-frame work
//   wet-road mirror      Tokyo's mirror-height part: the plane follows the road under the camera (82% of the lap is over 3 m up,
//                        where a mirror at y = 0 reflected the sky instead of the lamps and cars)
// The lit windows and the warm lamp heads are in the GLB ('IN window glow night' via tracks.js dayNight, 'M_LampWarm' via glow.js).
import * as THREE from 'three';
import { create as mirrorHeight } from './tokyo/mirror-height.js';

const AMBER = new THREE.Color(0xffb347), WARM = new THREE.Color(0xffe2b8);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ground, far ranges, cards and low scatter cast no shadow (main.js NO_CAST is Marina's names); trees, buildings, stands and walls do
const NO_CAST = /^(V5_terrain|V5_far|V5_river|water|India_racing_surface|Alternating_painted_kerbs|Edge_paint|scatter_cards|scatter_veg|IN_night_windows|Kavi_Chowk_clipped)/;

// ---- canopies: value noise on the canopy's own position (offset per tree by its instance origin) tints each clump and darkens the
// hollows; a coarse noise tilts the shading normal so light breaks into clumps near the camera. No vertex moves and no fragment is
// discarded (the clumps are modelled: moving them again doubled the lumps, and the frayed edges sparkled in motion); the clump-sized
// detail (~0.6 m and up) fades out by 60 m, so far trees stay solid. Foliage is matte (the glossy sheen read as smooth plastic).
const NOISE = `float smH3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float smN3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(smH3(i), smH3(i + vec3(1, 0, 0)), f.x), mix(smH3(i + vec3(0, 1, 0)), smH3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(smH3(i + vec3(0, 0, 1)), smH3(i + vec3(1, 0, 1)), f.x), mix(smH3(i + vec3(0, 1, 1)), smH3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }`;
function canopy(src) {
  const m = src.clone(); m.name = src.name + ' | canopy'; m.roughness = 1; m.metalness = 0; m.envMapIntensity = 0.6;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${NOISE}\nvarying float vLeaf; varying vec3 vTreeW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 seed = position;
        #ifdef USE_INSTANCING
          seed += instanceMatrix[3].xyz * 0.37;
        #endif
        vLeaf = smN3(seed * 0.9) * 0.6 + smN3(seed * 2.3 + 7.1) * 0.4;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 tw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          tw = instanceMatrix * tw;
        #endif
        vTreeW = (modelMatrix * tw).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${NOISE}\nvarying float vLeaf; varying vec3 vTreeW;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float leafFade = 1.0 - smoothstep(20.0, 60.0, length(vViewPosition));
        diffuseColor.rgb *= (0.78 + 0.4 * vLeaf) * mix(1.0, 0.86 + 0.26 * smN3(vTreeW * 1.6), leafFade);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        vec3 leafN = normal + 0.6 * leafFade * (vec3(smN3(vTreeW * 1.8), smN3(vTreeW * 1.8 + 3.1), smN3(vTreeW * 1.8 + 5.7)) - 0.5);
        if (dot(leafN, leafN) > 1e-6) normal = normalize(leafN);`);
  };
  m.customProgramCacheKey = () => 'india-canopy';
  return m;
}


// ---- crowd: shirts, skin tones and trousers of an Indian race crowd (cricket blue and saffron among them)
const SHIRTS = [0xf2f2f0, 0xf2f2f0, 0x1f4fa8, 0x2a6fd6, 0xff8a1e, 0xd62828, 0xf5c518, 0x1e8c4e, 0x7a1f3d, 0x222222, 0x8c8c8c, 0xe86fa0, 0x5bb3e0];
const SKINS = [0x8d5524, 0xa0673a, 0xb27148, 0xc68642, 0x7a4a2a, 0x96603a];
const LEGS = [0x1f2a44, 0x2b2b2b, 0x3c4a5c, 0x5a4632, 0xd8d2c4];

export async function create({ scene, root, track, NO_MIRROR }) {
  root.traverse((o) => { if (o.isMesh && (NO_CAST.test(o.name) || NO_CAST.test(o.parent?.name ?? ''))) o.castShadow = false; });
  const group = new THREE.Group(); group.name = 'india venue fx'; scene.add(group);
  const dispose = [];
  let night = 0;
  const mirror = await mirrorHeight({ scene, track }); dispose.push(mirror);

  // ---- the export's boards glow after dark with a flat white emissive (the glTF lost Blender's image-linked emission, so every board
  // turned into a white bar at night): they glow with their own print, at a third (a white print at full gain bloomed like a lamp).
  // main.js `brands` swaps follow the emissive map too.
  root.traverse((o) => { if (o.isMesh) for (const mm of [].concat(o.material)) if (/^DRESS \| board /.test(mm.name) && mm.map && !mm.emissiveMap) { mm.emissiveMap = mm.map; mm.emissive.multiplyScalar(0.3); mm.needsUpdate = true; } });

  // ---- tree canopies: the second primitive of each forest tree (the first is the trunk)
  const canopies = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !/_1$/.test(o.name)) return;
    let p = o.parent; while (p && !/^V5_forest/.test(p.name)) p = p.parent;
    if (!p) return;
    if (!canopies.has(o.material)) { const m = canopy(o.material); canopies.set(o.material, m); dispose.push(m); }
    o.material = canopies.get(o.material);
  });

  // ---- barrier reflectors: one instanced plate, colour per instance from distance and facing to the camera
  const R = track.reflectors?.items ?? [];
  const plateGeo = new THREE.BoxGeometry(0.05, 0.08, 0.015);
  const plateMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const plates = new THREE.InstancedMesh(plateGeo, plateMat, R.length);
  plates.name = 'india reflectors';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s1 = new THREE.Vector3(1, 1, 1);
  const pos = R.map((r) => new THREE.Vector3(r[0], r[1], r[2])), face = R.map((r) => new THREE.Vector3(r[3], 0, r[4]).normalize());
  R.forEach((r, i) => { q.setFromAxisAngle(up, Math.atan2(r[3], r[4])); m.compose(pos[i], q, s1); plates.setMatrixAt(i, m); plates.setColorAt(i, AMBER); });
  plates.frustumCulled = false; group.add(plates); dispose.push(plateGeo, plateMat);
  const c = new THREE.Color(), toCam = new THREE.Vector3();

  // ---- bridge uplights: a fixture and an additive wash fading up each portal leg (night only)
  const U = track.bridgeUplights?.items ?? [];
  const fixGeo = new THREE.BoxGeometry(0.9, 0.35, 0.9), fixMat = new THREE.MeshBasicMaterial({ color: WARM.clone().multiplyScalar(0.4) });
  const washMat = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uColor: { value: WARM.clone() } },
    vertexShader: 'varying float vH; void main(){ vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; uniform vec3 uColor; varying float vH; void main(){ float a = uK * pow(1.0 - vH, 2.2) * 0.55; gl_FragColor = vec4(uColor * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  for (const u of U) {
    const fix = new THREE.Mesh(fixGeo, fixMat); fix.position.set(u.pos[0], u.pos[1] + 0.18, u.pos[2]); group.add(fix);
    const h = Math.max(6, u.top);
    const washGeo = new THREE.CylinderGeometry(1.7, 2.3, h, 16, 1, true); washGeo.translate(0, h / 2, 0);
    const wash = new THREE.Mesh(washGeo, washMat); wash.position.set(u.pos[0], u.pos[1], u.pos[2]); wash.renderOrder = 2; group.add(wash); dispose.push(washGeo);
  }
  dispose.push(fixGeo, fixMat, washMat);

  // ---- hoardings: a printed face on a dark steel frame; floodlit (a faint emissive) after dark
  const tl = new THREE.TextureLoader(), texs = new Map(), lit = [];
  const tex = (f) => {
    if (!texs.has(f)) { const t = tl.load(`/assets/india/ads/${f}.png`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texs.set(f, t); dispose.push(t); }
    return texs.get(f);
  };
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.5 }); dispose.push(frameMat);
  const board = (img, w, h) => {
    const mat = new THREE.MeshStandardMaterial({ map: img, emissiveMap: img, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.55 });
    const g = new THREE.Group(), faceGeo = new THREE.PlaneGeometry(w, h), backGeo = new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.12);
    const front = new THREE.Mesh(faceGeo, mat), back = new THREE.Mesh(backGeo, frameMat); front.position.z = 0.065;
    back.castShadow = true; g.add(back, front); lit.push(mat); dispose.push(mat, faceGeo, backGeo); return g;
  };
  // façades: the board centre on the wall and the wall's normal; the hoarding: its foot on level ground and the printed face's normal
  const VB = track.venueBoards ?? {};
  for (const { brand, pos: [x, y, z], normal: [nx, nz], size: [w, h] } of VB.facades ?? []) {
    const g = board(tex(`${brand}-1600`), w, h); g.position.set(x + nx * 0.07, y, z + nz * 0.07); g.rotation.y = Math.atan2(nx, nz); group.add(g);
  }
  if (VB.hoarding) {
    const { brand, pos: [x, y, z], normal: [nx, nz], size: [w, h], lift } = VB.hoarding;
    const g = board(tex(`${brand}-3000`), w, h); g.position.set(x, y + lift + h / 2, z); g.rotation.y = Math.atan2(nx, nz);
    const tall = lift + h * 0.75, poleGeo = new THREE.CylinderGeometry(0.13, 0.16, tall, 10); poleGeo.translate(0, tall / 2 - lift - h / 2, -0.2);
    for (const sx of [-0.32, 0.32]) { const pole = new THREE.Mesh(poleGeo, frameMat); pole.position.x = sx * w; pole.castShadow = true; g.add(pole); }
    dispose.push(poleGeo); group.add(g);
  }

  // ---- crowd: one spectator on most seat tops of the stands' seat meshes (*_STAND_2), facing the track
  const seats = [], a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), nn = new THREE.Vector3(), e = new THREE.Vector3();
  const C = track.centerline;
  root.traverse((o) => {
    if (!o.isMesh || !/STAND_2$/.test(o.name)) return;
    o.updateMatrixWorld(); const P = o.geometry.attributes.position, I = o.geometry.index, cnt = I ? I.count : P.count, cells = new Map(), mine = [];
    for (let k = 0; k < cnt; k += 3) {
      a.fromBufferAttribute(P, I ? I.getX(k) : k).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(P, I ? I.getX(k + 1) : k + 1).applyMatrix4(o.matrixWorld);
      cc.fromBufferAttribute(P, I ? I.getX(k + 2) : k + 2).applyMatrix4(o.matrixWorld);
      nn.subVectors(cc, b).cross(e.subVectors(a, b)); const area = nn.length() / 2;
      if (area < 0.05 || nn.y / (2 * area) < 0.9) continue;
      const s = new THREE.Vector3().addVectors(a, b).add(cc).divideScalar(3), kx = Math.round(s.x / 0.5), kz = Math.round(s.z / 0.5), ky = Math.round(s.y / 0.3);
      let near = false;
      for (let dx = -1; dx <= 1 && !near; dx++) for (let dz = -1; dz <= 1 && !near; dz++) near = (cells.get(`${kx + dx},${kz + dz},${ky}`) ?? []).some((t) => t.distanceTo(s) < 0.35);
      if (near) continue;
      const key = `${kx},${kz},${ky}`; (cells.get(key) ?? cells.set(key, []).get(key)).push(s); mine.push(s);
    }
    if (!mine.length) return;
    const mid = mine.reduce((v, s) => v.add(s), new THREE.Vector3()).divideScalar(mine.length);
    const tc = C.reduce((best, p) => (Math.hypot(p[0] - mid.x, p[2] - mid.z) < Math.hypot(best[0] - mid.x, best[2] - mid.z) ? p : best), C[0]);
    const yaw = Math.atan2(tc[0] - mid.x, tc[2] - mid.z);
    for (const s of mine) seats.push([s, yaw]);
  });
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const people = seats.filter(() => rnd() < 0.86);
  const parts = [
    [new THREE.BoxGeometry(0.42, 0.56, 0.24).translate(0, 0.31, -0.04), SHIRTS],
    [new THREE.IcosahedronGeometry(0.115, 1).translate(0, 0.72, -0.02), SKINS],
    [new THREE.BoxGeometry(0.38, 0.13, 0.44).translate(0, 0.07, 0.2), LEGS],
  ];
  const crowdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }); dispose.push(crowdMat);
  const meshes = parts.map(([geo]) => { const im = new THREE.InstancedMesh(geo, crowdMat, people.length); im.name = 'india crowd'; im.receiveShadow = true; if (NO_MIRROR !== undefined) im.layers.set(NO_MIRROR); dispose.push(geo); return im; });
  const sc = new THREE.Vector3();
  people.forEach(([s, yaw], i) => {
    q.setFromAxisAngle(up, yaw + (rnd() - 0.5) * 0.5); const k = 0.92 + rnd() * 0.16; sc.set(k, k, k); m.compose(s, q, sc);
    meshes.forEach((im, j) => { im.setMatrixAt(i, m); im.setColorAt(i, c.setHex(parts[j][1][Math.floor(rnd() * parts[j][1].length)])); });
  });
  meshes.forEach((im) => { im.computeBoundingSphere(); group.add(im); });

  return {
    setLook(look) {
      night = sstep(0.3, 0.9, look.dn ?? 0);
      washMat.uniforms.uK.value = sstep(0.5, 0.9, look.dn ?? 0);
      fixMat.color.copy(WARM).multiplyScalar(0.4 + 2.6 * washMat.uniforms.uK.value);
      for (const mat of lit) mat.emissiveIntensity = 0.3 * night;
    },
    update(t, camera) {
      mirror.update(t, camera);
      // retro-reflection: brightest straight back at the light source (the car / camera), a few metres to ~150 m, smooth in distance
      for (let i = 0; i < pos.length; i++) {
        toCam.subVectors(camera.position, pos[i]); const d = toCam.length();
        let k = 0.3;                                                      // a small dull amber plate by day, as on the real barriers
        if (night > 0 && d < 130) { toCam.y = 0; const f = Math.max(0, face[i].dot(toCam.normalize())); k += night * (1.6 * sstep(130, 10, d) * f * f - 0.15); }
        plates.setColorAt(i, c.copy(AMBER).multiplyScalar(Math.max(0.08, k)));
      }
      plates.instanceColor.needsUpdate = true;
    },
    dispose() { scene.remove(group); dispose.forEach((d) => d.dispose()); plates.dispose(); meshes.forEach((im) => im.dispose()); },
  };
}
