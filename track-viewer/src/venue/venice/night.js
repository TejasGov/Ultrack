// Venice after dark: the light the lanterns and floods throw, lap-long, with no draw call and no per-frame work. Only six lamps near the camera are real lights (main.js pool.street), so
// everything else would be black beyond 30 m. As India's road map (venue/india/road-light.js), the lamps are baked at load into a map of the city seen from above, and the materials take it as irradiance, so
// each surface reflects it by its own albedo: lines keep their contrast and plaster keeps its grain. One map, 2 m a texel: r the lamps' pools, g the floods on landmarks, piers and bridges (lights.json `wash`), b each lantern as a tight point for the water.
//   road and ground  take the pools in full
//   walls            take the pools up to about lamp height, and the floods much higher; soffits get little
//   water            traces its ripple-bent reflection up to the lamps' height, so a lantern's light on the canal stretches toward the viewer as a real one does
// Fixed places and smooth falloffs: nothing jumps from lamp to lamp, and at gain 0 (day and dusk) every material renders as it did.
import * as THREE from 'three';

const CELL = 2, MARGIN = 80;                       // m a texel; m of map past the outermost light
const POOL_H = 11;                   // a pool's "height" (wider than the 6.6 m lantern: the glass scatters, and pools must join up at 40 m or the road strobes) and where it ends
const REACH = 3.8;                                 // a pool ends this many heights out; a tall mast (lights.json `h`) reaches further
const WARM = new THREE.Color('#ffc98f');
const K_WALL = 8.5, K_FLOOD = 7, K_WATER = 0.8;
// the ground, each by how much it needs: asphalt reflects so little that it would stay black beside paving lit the same, and white paint would burn out at asphalt's level
const GROUND = { 'VE | asphalt': 44, 'VE | line white': 6, 'VE | kerb red': 12, 'VE | kerb white': 6, 'VE | paving': 8.5, 'VE | road paint': 11, 'VE | piazza paving': 7, 'VE | lozenge stone': 7, 'VE | grass': 12 };
const WALL = /^VE \| (stone|barrier|red brick|dressed limestone|worn plaster|dark brick|red plaster|rose plaster|ochre plaster|sooted sandstone|tyres|fence|painted pole|cast iron|timber.*|canvas|awnings|laundry|shop signs|posters|banners|slate|roof|clay tile|steel)$|^VE VE (boulevard trees|poplars|gondolas|boats)/;
const sstep = THREE.MathUtils.smoothstep;
/** the pools add up where lamps crowd (a bracket lantern each side of the cutting, a mast over a post): light eases off there, so no stretch reads as daylight and the road keeps an even level along the lap */
export const easeE = (e) => e / (1 + 3 * e);
/** one lamp's pool on the ground r2 m^2 from it: a point light at height h, ending smoothly at REACH heights (scripts/test-venice-lights.mjs checks the road with it) */
export const poolE = (r2, h = POOL_H) => { const q = 1 + r2 / (h * h), R = h * REACH; return r2 >= R * R ? 0 : (1 - sstep(Math.sqrt(r2), 0.55 * R, R)) / (q * Math.sqrt(q)); };

function buildMap(lamps, wash) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const { pos: p } of [...lamps, ...wash]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
  x0 -= MARGIN; z0 -= MARGIN;
  const w = Math.ceil((x1 + MARGIN - x0) / CELL) + 1, h = Math.ceil((z1 + MARGIN - z0) / CELL) + 1;
  const R = new Float32Array(w * h), G = new Float32Array(w * h), B = new Float32Array(w * h);
  const splat = (p, rad, f) => {
    const ci = (p[0] - x0) / CELL, cj = (p[2] - z0) / CELL, rc = Math.ceil(rad / CELL);
    for (let j = Math.max(0, Math.floor(cj - rc)); j <= Math.min(h - 1, Math.ceil(cj + rc)); j++) for (let i = Math.max(0, Math.floor(ci - rc)); i <= Math.min(w - 1, Math.ceil(ci + rc)); i++) {
      const dx = (i - ci) * CELL, dz = (j - cj) * CELL, r2 = dx * dx + dz * dz; if (r2 < rad * rad) f(j * w + i, r2);
    }
  };
  for (const { pos, h = POOL_H } of lamps) {
    splat(pos, h * REACH, (k, r2) => { R[k] += poolE(r2, h); });
    splat(pos, 8, (k, r2) => { B[k] = Math.max(B[k], Math.exp(-r2 / 7)); });
  }
  for (const { pos, r, gain = 1 } of wash) splat(pos, r, (k, r2) => { G[k] = Math.max(G[k], gain * (1 - sstep(Math.sqrt(r2), 0.3 * r, r))); });
  const data = new Uint8Array(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    data[k * 4] = Math.round(255 * Math.sqrt(Math.min(1, easeE(R[k]) / 2))); data[k * 4 + 1] = Math.round(255 * Math.sqrt(Math.min(1, G[k]))); data[k * 4 + 2] = Math.round(255 * Math.min(1, B[k])); data[k * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  return { tex, rect: new THREE.Vector4(x0 - CELL / 2, z0 - CELL / 2, 1 / (w * CELL), 1 / (h * CELL)), w, h };   // texel centres on the grid points
}

const HEAD = 'uniform sampler2D tVeMap; uniform vec4 uVeMap; uniform vec3 uVeLamp; varying vec3 vVeW;\n';
const PART = {
  ground: (k) => `{ float r = texture2D(tVeMap, (vVeW.xz - uVeMap.xy) * uVeMap.zw).r; irradiance += r * r * 2.0 * ${k.toFixed(1)} * uVeLamp * vec3(0.9, 1.2, 2.0); }`,     // whiter than the lantern's glass: warm light on warm asphalt read as clay
  wall: `{ vec4 m = texture2D(tVeMap, (vVeW.xz - uVeMap.xy) * uVeMap.zw); float up = dot(normal, viewMatrix[1].xyz);
      irradiance += (m.r * m.r * 2.0 * ${K_WALL.toFixed(1)} * (1.0 - smoothstep(6.0, 18.0, vVeW.y)) + m.g * m.g * ${K_FLOOD.toFixed(1)} * (0.28 + 0.72 * (1.0 - smoothstep(0.0, 78.0, vVeW.y))) * (1.0 - 0.6 * smoothstep(0.35, 0.9, up)))
        * (1.0 - 0.72 * smoothstep(0.1, 0.7, -up)) * (1.0 - 0.5 * smoothstep(0.4, 0.9, up)) * uVeLamp; }`,
};
function patch(m, kind, uniforms, patched, k = 0) {
  if (m.userData.veniceNight) return;
  m.userData.veniceNight = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = function (sh, r) {
    prev?.call(this, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 vVeW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vVeW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = HEAD + (kind === 'water'
      ? sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz), rf = reflect(normalize(vVeW - cameraPosition), nW);
          vec2 q = vVeW.xz + rf.xz * min(70.0, 7.0 / max(rf.y, 0.05)); vec4 m = texture2D(tVeMap, (q - uVeMap.xy) * uVeMap.zw);
          totalEmissiveRadiance += (m.b + m.r * m.r * 0.1) * ${K_WATER.toFixed(1)} * uVeLamp; }`)
      : sh.fragmentShader.replace('#include <lights_fragment_end>', (kind === 'ground' ? PART.ground(k) : PART.wall) + '\n#include <lights_fragment_end>'));
  };
  m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|venice-night-' + kind + k; };
  m.needsUpdate = true;
  patched.push({ m, prev, prevKey });
}

/** opts, for another track's lamps (venue/morro.js): ground, its { material name: gain } for road and paving; wall, a RegExp on the materials that take the pools as walls */
export async function create({ root, lights }, opts = {}) {
  const GR = opts.ground ?? GROUND, WL = opts.wall ?? WALL;
  const lamps = lights?.streetLamps ?? [], wash = lights?.wash ?? [];
  if (!lamps.length) return { setLook() {}, dispose() {} };
  const map = buildMap(lamps, wash), patched = [];
  const uniforms = { tVeMap: { value: map.tex }, uVeMap: { value: map.rect }, uVeLamp: { value: new THREE.Color(0, 0, 0) } };
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material ?? [])) {
      const kind = o.name === 'water' || o.userData.surface === 'water' ? 'water' : GR[m.name] ? 'ground' : WL.test(m.name) ? 'wall' : null;
      if (kind) patch(m, kind, uniforms, patched, GR[m.name] ?? 0);
    }
  });
  console.info(`${opts.label ?? 'venice'} night: ${lamps.length} lamps, ${wash.length} floods, map ${map.w} x ${map.h}, ${patched.length} materials`);
  return {
    setLook(look, params) { uniforms.uVeLamp.value.copy(WARM).multiplyScalar((look.lights ?? 0) * (params?.venueLights ?? 1)); },
    dispose() {
      map.tex.dispose();
      for (const p of patched) { p.m.onBeforeCompile = p.prev; p.m.customProgramCacheKey = p.prevKey; p.m.userData.veniceNight = false; p.m.needsUpdate = true; }
    },
  };
}
