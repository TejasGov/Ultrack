// The tunnel under the bay sees no sky, but nothing in the renderer knew that: by day its floor mirrored a blue-white sky, and at
// dusk a blinding sunset ran down it (the low sun shines along the tunnel and the sun's shadow map only covers 70 m round the
// camera, the fog's sun-scatter term lit the tunnel air, and the sky's image-based light reached every surface). Under the tunnel
// roof the sun, its glint on the wet road and the fog's sun-scatter are cut, and the sky light is cut to what bounces in, fading back over a few metres past
// each portal. The roof is found from the geometry (the submerged tunnel's box) and the centerline through it; the road, kerbs and
// tunnel liner get the term (their onBeforeCompile is chained, never replaced; the program key is extended).
import * as THREE from 'three';
import { TRACKS } from '../../tracks.js';

const MATS = new Set([...TRACKS.tokyo.wet.wet, 'M_TunnelTile']);
const ROOF = /submerged_tunnel/i;                // V10 submerged tunnel | 24 m clear width
const N = 16, HALF_W = 13, KEEP = { spec: 0.03, diff: 0.1 };     // segments; half width (m); what the sky light keeps inside
const DIR_LIGHT = 'getDirectionalLightInfo( directionalLight, directLight );';

export async function create({ root, track }) {
  const box = new THREE.Box3();
  root.traverse((o) => { if (o.isMesh && ROOF.test(o.name)) box.expandByObject(o); });
  if (box.isEmpty() || !THREE.ShaderChunk.lights_fragment_begin.includes(DIR_LIGHT)) return { dispose() {} };
  const C = track.centerline;
  // the covered run: the centerline inside the roof's footprint and well under its top
  const pts = C.map((p, i) => ({ p, i })).filter(({ p }) => p[0] > box.min.x && p[0] < box.max.x && p[2] > box.min.z && p[2] < box.max.z && p[1] < box.max.y - 2);
  if (pts.length < 2) return { dispose() {} };
  const line = Array.from({ length: N + 1 }, (_, i) => pts[Math.round(i / N * (pts.length - 1))].p);
  const uniforms = { uTun: { value: line.map((p) => new THREE.Vector2(p[0], p[2])) }, uTunTop: { value: box.max.y } };
  const VERT = 'varying vec3 vTunW;\n', FRAG = /* glsl */`
    varying vec3 vTunW; uniform vec2 uTun[${N + 1}]; uniform float uTunTop;
    float tunnelCover(vec3 p) {
      if (p.y > uTunTop + 0.5) return 0.0;
      float d = 1e9;
      for (int i = 0; i < ${N}; i++) {
        vec2 a = uTun[i], ab = uTun[i + 1] - a;
        float t = clamp(dot(p.xz - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
        d = min(d, length(p.xz - a - ab * t));
      }
      return 1.0 - smoothstep(${HALF_W.toFixed(1)}, ${(HALF_W + 6).toFixed(1)}, d);      // past the portals the cover fades over ~6 m
    }
  `;
  const lightsBegin = THREE.ShaderChunk.lights_fragment_begin.replace(DIR_LIGHT, `${DIR_LIGHT}\n\t\tdirectLight.color *= 1.0 - gTunCov;`);
  const patched = [];
  root.traverse((o) => {
    for (const m of [].concat(o.material ?? [])) {
      if (!o.isMesh || !MATS.has(m.name) || m.userData.tunnelLight) continue;
      m.userData.tunnelLight = true;
      const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
      m.onBeforeCompile = function (sh, r) {
        prev?.call(this, sh, r);
        Object.assign(sh.uniforms, uniforms);
        sh.vertexShader = VERT + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vTunW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = FRAG + sh.fragmentShader
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  float gTunCov = tunnelCover(vTunW);')
          .replace('#include <lights_fragment_begin>', lightsBegin)                 // the sun (main.js's directional light)
          .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
            radiance *= 1.0 - ${(1 - KEEP.spec).toFixed(2)} * gTunCov; iblIrradiance *= 1.0 - ${(1 - KEEP.diff).toFixed(2)} * gTunCov;
            #ifdef USE_CLEARCOAT
              clearcoatRadiance *= 1.0 - ${(1 - KEEP.spec).toFixed(2)} * gTunCov;     // the asphalt's wet coat mirrored the open sky
            #endif`)
          .replace('gl_FragColor.rgb += uGlint * glint', 'gl_FragColor.rgb += (1.0 - gTunCov) * uGlint * glint')   // wetify's sun glint
          .replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replaceAll('uFogSunColor', '(uFogSunColor * (1.0 - gTunCov))'));
      };
      m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|tunnel-light'; };
      m.needsUpdate = true;
      patched.push({ m, prev, prevKey });
    }
  });
  console.info(`tokyo tunnel light: ${patched.length} materials, roof top ${box.max.y.toFixed(1)} m, centerline ${pts[0].i}-${pts.at(-1).i} under it`);
  return {
    dispose() {
      for (const p of patched) { p.m.onBeforeCompile = p.prev; p.m.customProgramCacheKey = p.prevKey; p.m.userData.tunnelLight = false; p.m.needsUpdate = true; }
    },
  };
}
