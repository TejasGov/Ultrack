// The wet road: shader chunks that make tarmac (and everything else wet-able) look rained on, applied by wetify().
// Moved out of main.js so it can be tuned on its own; main.js owns the planar mirror and feeds the uniforms.
import * as THREE from 'three';

export const wetUniforms = { tReflection: { value: null }, uWet: { value: 0 }, uMirror: { value: 1 }, uResolution: { value: new THREE.Vector2(1, 1) },
  uGlintDir: { value: new THREE.Vector3(0, 1, 0) }, uGlint: { value: new THREE.Color(0, 0, 0) },
  uWetTime: { value: 0 }, uRain: { value: 0 },
  uCars: { value: Array.from({ length: 4 }, () => new THREE.Vector4(1e5, 1e5, 1, 0)) } };   // up to four cars on this road: x, z, cos(yaw), sin(yaw) (main.js fills it)

// Wet surfaces, done in the shader. Real wet asphalt is mostly damp and still matte (darker, a little smoother), with
// puddles that mirror; its reflections smear vertically into streaks instead of staying crisp. A uniform roughness cut
// plus a sharp mirror everywhere read as glass.
const NOISE = /* glsl */`
  varying vec3 vWPos;
  float gPud = 0.0, gRough = 1.0, gCar = 0.0; vec2 gRip = vec2(0.0);
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // rain ripples: each cell drips on its own rhythm and an expanding ring runs out from the drop. Returns the water's
  // slope (world xz) at q, in cells; the caller fades it out where a ring gets under ~3 px (no shimmer at distance).
  vec2 ripLayer(vec2 q, float seed) {
    vec2 c = floor(q), f = fract(q) - 0.5;
    float h = hash2(c + seed), ph = fract(uWetTime / (0.6 + 0.7 * hash2(c + seed + 3.7)) + h);
    vec2 d = f - (vec2(hash2(c + seed + 1.3), hash2(c + seed + 2.9)) - 0.5) * 0.3;
    float r = length(d) + 1e-4, w = r - ph * 0.42;
    return d / r * (cos(w * 60.0) * exp(-w * w * 420.0) * (1.0 - ph) * (1.0 - ph) * step(0.15, hash2(c + seed + 5.3)));   // not every cell drips at once
  }
  // soft darkening under and around a car: a rounded box in the car's frame (half length 1.9 m, half width 0.82 m)
  float carShade(vec2 p) {
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 c = uCars[i]; vec2 d = p - c.xy, l = vec2(dot(d, c.zw), dot(d, vec2(-c.w, c.z))), q = abs(l) - vec2(1.9, 0.82);
      s = max(s, exp(-(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0)) * 3.0));
    }
    return min(s, 1.0);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
  }
`;   // the trailing newline matters: three's shader source starts with a #define, which must begin its own line
export function wetify(mat, { puddles = false, uniforms = wetUniforms } = {}) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uPuddles: { value: puddles ? 1 : 0 }, uDetail: { value: puddles ? 0.45 : 0 } });
    shader.vertexShader = 'varying vec3 vWPos;\n' + shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = 'uniform sampler2D tReflection; uniform float uWet, uMirror, uPuddles, uDetail; uniform vec2 uResolution; uniform vec3 uGlintDir, uGlint; uniform float uWetTime, uRain; uniform vec4 uCars[4];\n' + NOISE +
      shader.fragmentShader
        .replace('#include <map_fragment>', /* glsl */`#include <map_fragment>
          #ifdef USE_MAP
            // detail: the aggregate texture again at ~4x frequency, so the road near the camera has grain, not a smear
            vec3 det = texture2D(map, vMapUv * 4.37).rgb;
            diffuseColor.rgb *= mix(1.0, clamp(dot(det, vec3(0.333)) * 2.4, 0.4, 1.8), uDetail);
          #endif
          // grain and grime on everything wet-able: flat-coloured turf, kerb paint and lines read as plastic without it
          diffuseColor.rgb *= 0.86 + 0.2 * vnoise(vWPos.xz * 11.0) + 0.08 * vnoise(vWPos.xz * 0.7);`)
        .replace('#include <roughnessmap_fragment>', /* glsl */`#include <roughnessmap_fragment>
          float wetK = smoothstep(0.25, 1.0, uWet);               // damp 0.7 -> 0.65, rain 1.0 -> 1
          if (uPuddles > 0.5) {                       // puddles in the low spots: two octaves of world-space noise, wider in heavy rain
            float n = vnoise(vWPos.xz * 0.16) * 0.65 + vnoise(vWPos.xz * 0.9) * 0.35;
            gPud = smoothstep(mix(0.72, 0.56, wetK), mix(0.8, 0.67, wetK), n) * smoothstep(0.25, 0.8, uWet);
            // soaked tarmac: smooth enough to mirror the sky in streaks, in patches
            float film = 0.2 + 0.22 * vnoise(vWPos.xz * 2.3) + 0.12 * vnoise(vWPos.xz * 0.35);
            roughnessFactor = mix(roughnessFactor, film, wetK * 0.9);
            gCar = carShade(vWPos.xz);
          } else roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.8, uWet);    // damp: only a little smoother
          roughnessFactor = mix(roughnessFactor, 0.04, gPud);                     // puddle: a mirror
          diffuseColor.rgb *= mix(1.0, mix(0.7, 0.5, wetK * uPuddles), uWet) * mix(1.0, 0.5, gPud) * (1.0 - 0.45 * gCar * uWet);   // water darkens what it soaks; most under the car
          gRough = roughnessFactor;`)
        .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
          // puddles: standing water is flat (the asphalt's grain drowns), and rain rings it with ripples
          // (Lagarde, physically based wet surfaces: flatten the normal toward the surface's own where water pools)
          if (gPud > 0.0) normal = normalize(mix(normal, nonPerturbedNormal, gPud * 0.92));
          if (uPuddles > 0.5 && uRain > 0.0) {         // two sizes of ring, on puddles and (fainter) on the wet tarmac
            vec2 rq = vWPos.xz * 2.6, rq2 = vWPos.xz * 1.45 + 11.0;
            float rf = 1.0 - smoothstep(0.012, 0.03, max(fwidth(rq.x), fwidth(rq.y))), rf2 = 1.0 - smoothstep(0.007, 0.018, max(fwidth(rq2.x), fwidth(rq2.y)));
            gRip = (ripLayer(rq, 0.0) * rf + 0.8 * ripLayer(rq2, 9.0) * rf2) * uRain * (0.45 * wetK + 0.7 * gPud);
            normal = normalize(normal + (viewMatrix * vec4(gRip.x, 0.0, gRip.y, 0.0)).xyz * 0.9);
          }`)
        .replace('#include <opaque_fragment>', /* glsl */`#include <opaque_fragment>
          {
            vec2 suv = gl_FragCoord.xy / uResolution + normal.xz * 0.01 + gRip * 0.03;
            float streak = 0.003 + 0.045 * gRough;  // rougher surface, longer vertical smear
            vec3 refl = vec3(0.0); float tw = 0.0;
            for (int i = -3; i <= 3; i++) {
              float w = 1.0 - abs(float(i)) / 4.0;
              refl += texture2D(tReflection, suv + vec2(0.0, float(i) * streak)).rgb * w; tw += w;
            }
            refl /= tw;
            float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
            float k = uMirror * mix(0.04 + 0.1 * wetK, 0.9, fres) * max(uWet * (1.0 - smoothstep(0.12, 0.6, gRough)), gPud);   // the sky is so much brighter than dusk tarmac that even the steep-angle reflection shows
            gl_FragColor.rgb += refl * k;
            // sun glint: the low sun's highlight on wet tarmac, a narrow column from the horizon toward the camera (the
            // reflected ray's bearing must match the sun's closely, its elevation only loosely). Gated by the mirror
            // image: where the mirror shows a stand or a car instead of bright sky, the sun is hidden from that spot.
            vec3 V = normalize(vWPos - cameraPosition);
            vec3 Nw = normalize(vec3((vnoise(vWPos.xz * 3.1) - 0.5) * 0.05 + gRip.x * 0.3, 1.0, (vnoise(vWPos.zx * 2.7) - 0.5) * 0.05 + gRip.y * 0.3));
            vec3 Rg = reflect(V, Nw);
            float da = 1.0 - dot(normalize(Rg.xz), normalize(uGlintDir.xz));               // ~half the bearing angle squared
            float de = asin(clamp(Rg.y, -1.0, 1.0)) - asin(uGlintDir.y);
            float wide = 0.0012 + 0.006 * gRough;
            float glint = exp(-da / wide) * exp(-de * de / 0.03);
            float sky = uMirror > 0.5 ? smoothstep(0.35, 1.2, dot(refl, vec3(0.333))) : 1.0;
            gl_FragColor.rgb += uGlint * glint * sky * (0.35 + gPud) * uWet;
          }`);
  };
  mat.customProgramCacheKey = () => (puddles ? 'wet-puddles' : 'wet') + (uniforms === wetUniforms ? '' : '-own');
  mat.needsUpdate = true;
}

const _h = new THREE.Vector3();
/** Each frame: the (up to four) cars nearest the camera darken the wet road under and around them (uCars, x z cos sin of the heading). */
export function wetCars(cars, camera) {
  const U = wetUniforms.uCars.value, near = cars.filter((c) => c.root.visible).sort((a, b) => a.root.position.distanceToSquared(camera.position) - b.root.position.distanceToSquared(camera.position));
  for (let i = 0; i < 4; i++) {
    const c = near[i];
    if (!c) { U[i].set(1e5, 1e5, 1, 0); continue; }
    _h.set(1, 0, 0).applyQuaternion(c.root.quaternion);          // the nose points along +x in the root's frame (cars.js turns car-lab's -x nose around)
    const l = Math.hypot(_h.x, _h.z) || 1;
    U[i].set(c.root.position.x, c.root.position.z, _h.x / l, _h.z / l);
  }
}
