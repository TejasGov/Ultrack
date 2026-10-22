// What each car's paint is made of (assets/cars/finishes.json), on top of car-lab's body shader and the team livery.
// Colour stays the team's; this adds the surface character that makes a real car read as real up close:
// - metallic flake: a grain of tiny mirrors under the clearcoat. Each flake tilts the base layer's normal (never the
//   clearcoat's, which stays glass-smooth), fixed to the body. The flake size steps up with distance, like mip levels,
//   so the grain stays about 1.5 px wide at any range instead of shimmering, and it averages out (weaker) far away.
// - pearl: three's thin-film iridescence on the base layer.
// - exposed carbon: a 2x2 twill below a height line, projected along the body's dominant axis. Warp and weft tows
//   brighten and darken as the view turns across them (the checker "flip" of real carbon), each tow is slightly
//   rounded, and the weave fades to its average where a tow gets smaller than a pixel.
// - rain beads (paint and glass): water beads on the coat, in two sizes. Each bead is a little dome whose normal tilts
//   away from its centre, bending only the clearcoat's normal, so it catches a different piece of the sky, the sun or a
//   lamp than the paint around it (a bright speck with a dark rim). Like the flakes, the cells step up with distance
//   (two levels, cross-faded) so a bead stays ~2-3 px wide at any range instead of vanishing or shimmering; beads fade
//   out beyond ~25 m. They sit on what faces up and are blown off the nose at speed, where they stretch into tails
//   running toward the rear (FINISH_FLOW). Beaded pixels also get their clearcoat highlights boosted, the sparkle field.
import * as THREE from 'three';

export const FINISH_RAIN = { value: 0 };     // 0..1, set by the viewer from its rain setting
export const FINISH_SPARK = { value: new THREE.Color(0.2, 0.2, 0.2) };     // what a bead catches of the sky (the look's light), set by the viewer
export const FINISH_FLOW = { value: 0 };     // 0..1, the player's speed as airflow over the body (beads stretch into tails)

const GLSL = /* glsl */`
  varying vec3 vFinN;
  uniform float uFlake, uFlakeSize, uCarbonY, uRainBeads, uFlow; uniform vec3 uSpark;
  uniform mat4 modelMatrix;
  float finH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  vec3 finH3(vec3 p) { return fract(sin(vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
  // the plane the body is projected on at this point: (u, v) axes in body space, chosen by the dominant normal axis
  void finPlane(vec3 n, out vec3 a, out vec3 b) {
    vec3 m = abs(n);
    if (m.x > m.y && m.x > m.z) { a = vec3(0.0, 0.0, 1.0); b = vec3(0.0, 1.0, 0.0); }
    else if (m.y > m.z) { a = vec3(1.0, 0.0, 0.0); b = vec3(0.0, 0.0, 1.0); }
    else { a = vec3(1.0, 0.0, 0.0); b = vec3(0.0, 1.0, 0.0); }
  }
  vec3 finToView(vec3 d) { return normalize(mat3(viewMatrix) * mat3(modelMatrix) * d); }
  float finN2(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(finH(vec3(i, 1.0)), finH(vec3(i + vec2(1.0, 0.0), 1.0)), f.x), mix(finH(vec3(i + vec2(0.0, 1.0), 1.0)), finH(vec3(i + 1.0, 1.0)), f.x), f.y);
  }
  // one bead layer at one cell size s (m across, 2.2 s along the flow). fq = (along the flow, across) in metres.
  // Returns the dome's tilt (a unit disc, 0 outside the bead) and its coverage; a tail stretches the bead along the flow.
  vec4 finBead(vec2 fq, float s, float seed, float dens, float tail) {
    vec2 g = fq / vec2(s * 2.2, s), c = floor(g), f = fract(g);
    float h0 = finH(vec3(c, seed)), h1 = finH(vec3(c, seed + 1.0)), h2 = finH(vec3(c, seed + 2.0)), h3 = finH(vec3(c, seed + 3.0)), h4 = finH(vec3(c, seed + 4.0));
    vec2 d = vec2((f.x - mix(0.1, 0.3, h1)) * 2.2, f.y - mix(0.33, 0.67, h2));
    d.x = d.x > 0.0 ? d.x / (1.0 + tail * h4 * 2.2) : d.x;
    d /= mix(0.16, 0.32, h3);
    float m = step(h0, dens) * (1.0 - smoothstep(0.65, 1.0, dot(d, d)));
    return vec4(d * m, m, m * smoothstep(0.3, 0.95, dot(d, d)));     // tilt, coverage, rim (a bead's edge is dark: it bends the paint under it)
  }
  // two sizes of bead, each at two cross-faded levels chosen so a cell stays ~4 px (pm: metres per pixel)
  vec4 finBeads(vec2 fq, float pm, float dens, float tail) {
    vec4 acc = vec4(0.0);
    for (int k = 0; k < 2; k++) {
      float s0 = k == 0 ? 0.013 : 0.0055;
      float lv = log2(max(pm * 4.0 / s0, 1.0)), l0 = floor(lv);
      for (int i = 0; i < 2; i++) {
        float w = i == 0 ? 1.0 - (lv - l0) : lv - l0;
        acc += finBead(fq, s0 * exp2(l0 + float(i)), float(k) * 17.0 + float(i) * 5.0 + 7.0, dens * (k == 0 ? 0.19 : 0.3), tail * (k == 0 ? 1.0 : 0.5)) * w;
      }
    }
    return vec4(acc.xy, min(acc.z, 1.0), min(acc.w, 1.0));
  }
`;

/** the GLSL that bends the clearcoat normal with beads at object-space point P (n: object-space normal); sets finBeadVis */
const beadsFrag = (P) => `
        float finBeadVis = 0.0, finBeadRim = 0.0;
        float bpm = length(fwidth(${P})) * 0.7, bfade = 1.0 - smoothstep(0.009, 0.024, bpm);     // metres per pixel: beads fade out beyond ~25 m
        if (uRainBeads > 0.01 && bfade > 0.002) {           // water beads on the coat, on panels facing up
          vec3 bA, bB; finPlane(vFinN, bA, bB);
          vec3 bm = abs(vFinN);
          vec2 bAx = (bm.x > bm.y && bm.x > bm.z) ? vec2(0.0, -1.0) : vec2(1.0, 0.0);   // the way water runs in the plane: back (+x), down on the tail
          vec2 bAc = vec2(-bAx.y, bAx.x);
          vec2 bl = vec2(dot(${P}, bA), dot(${P}, bB));
          vec2 bq = vec2(dot(bl, bAx), dot(bl, bAc));
          float bup = smoothstep(-0.2, 0.7, vFinN.y);
          float bdens = uRainBeads * mix(0.3, 1.0, bup) * (1.0 - 0.4 * uFlow) * (1.0 - 0.85 * uFlow * smoothstep(0.1, 0.7, -vFinN.x));   // the nose is blown clean
          vec4 bd = finBeads(bq, bpm, bdens, uFlow);
          vec2 bt = bAx * bd.x + bAc * bd.y;
          vec3 bOff = mat3(viewMatrix) * mat3(modelMatrix) * (bA * bt.x + bB * bt.y);
          clearcoatNormal = normalize(clearcoatNormal + bOff * 1.3 * bfade);
          finBeadVis = bd.z * bfade;
          finBeadRim = bd.w * bfade;
        }`;
const beadsGain = `
        clearcoatSpecularIndirect = clearcoatSpecularIndirect * (1.0 + 0.3 * uRainBeads + 3.0 * finBeadVis) + uSpark * finBeadVis * (1.0 - 0.55 * dot(diffuseColor.rgb, vec3(0.333)));     // wet coat: a little glossier     // the sparkle field: a bead catches the sky and the lamps
        clearcoatSpecularDirect *= 1.0 + 4.0 * finBeadVis;`;

/** spec: finishes.json entry; box: the body's bounds (shell space, the y the paint shader reads). */
export function applyFinish(mat, spec = {}, box) {
  const u = {
    uFlake: { value: spec.paint === 'metallic' ? spec.flake ?? 0.5 : 0 },
    uFlakeSize: { value: (spec.flakeMm ?? 0.7) / 1000 },
    uCarbonY: { value: spec.carbonBelow ? box.min.y + spec.carbonBelow * (box.max.y - box.min.y) : -1e3 },
    uRainBeads: FINISH_RAIN, uFlow: FINISH_FLOW, uSpark: FINISH_SPARK,
  };
  if (spec.paint === 'solid') Object.assign(mat, { metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 });
  if (spec.paint === 'metallic') Object.assign(mat, { metalness: 0.3, roughness: 0.28 });   // more, and a dark colour turns into a mirror of the sky
  if (spec.paint === 'pearl') Object.assign(mat, { metalness: 0.15, roughness: 0.25, iridescence: spec.pearl ?? 0.5 });
  Object.assign(mat, { iridescenceIOR: 1.4, iridescenceThicknessRange: [300, 700] });
  if (!mat.iridescence) mat.iridescence = 1e-4;           // compiled in on every car, so the garage can switch to pearl live
  mat.userData.finish = u;                     // the garage's paint tuner changes these live (setFinish)
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey?.();
  mat.onBeforeCompile = (shader, renderer) => {
    base?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFinN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinN = normal;');
    const f = shader.fragmentShader;
    const trimLine = f.match(/float lowerTrim=.*;/)?.[0], trimMix = f.match(/diffuseColor\.rgb=mix\(diffuseColor\.rgb,vec3\(\.012,\.015,\.019\),lowerTrim\);/)?.[0];
    if (!trimLine || !trimMix) { console.warn('finish: car-lab trim lines not found; carbon weave off'); }
    shader.fragmentShader = f
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      // carbon: the car's own height line (the flat trim below 0.2 m stays as car-lab drew it, now woven too)
      .replace(trimLine ?? '@@', `float lowerTrim = max((1.0 - smoothstep(.19, .215, vShellPosition.y)) * uTrim, 1.0 - smoothstep(uCarbonY - 0.004, uCarbonY + 0.004, vShellPosition.y));
        vec3 finA, finB; finPlane(vFinN, finA, finB);
        vec3 finNV = finToView(vFinN), finV = normalize(vViewPosition);
        vec2 finQ = vec2(dot(vShellPosition, finA), dot(vShellPosition, finB)) / 0.0045;     // 4.5 mm tows
        vec2 finCell = floor(finQ), finF = fract(finQ);
        float finWarp = step(mod(finCell.x + finCell.y, 4.0), 1.5);                         // 2x2 twill
        vec3 finFib = finToView(mix(finB, finA, finWarp));                                    // fibres along the tow
        vec3 finVt = finV - finNV * dot(finV, finNV);
        float finFlip = abs(dot(finFib, normalize(finVt + 1e-5))) * min(1.0, length(finVt) * 2.5);
        float finAcross = mix(finF.x, finF.y, finWarp);
        float finFade = 1.0 - smoothstep(0.4, 0.9, max(fwidth(finQ.x), fwidth(finQ.y)));
        float finTow = mix(0.5, mix(finFlip, 1.0 - finFlip, finWarp) * (0.7 + 0.3 * sin(3.1416 * finAcross)), finFade);
        vec3 finTilt = finToView(mix(finA, finB, finWarp)) * cos(3.1416 * finAcross) * 0.22 * finFade;`)
      .replace(trimMix ?? '@@', 'diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.012, 0.014, 0.017), vec3(0.075, 0.08, 0.088), finTow), lowerTrim);')
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        float finBare = max(lowerTrim, livA);               // carbon and vinyl decals: not metallic, no flake
        metalnessFactor = mix(metalnessFactor, 0.0, finBare); roughnessFactor = mix(roughnessFactor, 0.32, finBare);
        diffuseColor.rgb *= 1.0 - 0.12 * uRainBeads;       // a water film deepens the paint
        float finGr = (1.0 - smoothstep(0.1, 0.55, vShellPosition.y)) * (0.55 + 0.45 * finN2(vShellPosition.xz * 9.0 + vShellPosition.y * 5.0));
        diffuseColor.rgb *= 1.0 - (0.12 + 0.3 * uRainBeads) * finGr;                       // road film: the lower body is darker, wet-dark in rain (sits the car on the road)
        roughnessFactor = mix(roughnessFactor, 0.6, 0.35 * finGr);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + finTilt * lowerTrim);
        if (uFlake > 0.0) {                                 // flakes, sized to ~1.5 px at any distance (two levels, blended)
          float fp = length(fwidth(vShellPosition));
          float lv = log2(max(fp * 1.6 / uFlakeSize, 1.0)), l0 = floor(lv);
          vec3 fl = vec3(0.0);
          for (int i = 0; i < 2; i++) {
            float s = uFlakeSize * exp2(l0 + float(i));
            vec3 c = floor(vShellPosition / s);
            fl += (finH3(c) * 2.0 - 1.0) * (i == 0 ? 1.0 - (lv - l0) : lv - l0);
          }
          normal = normalize(normal + finToView(fl) * uFlake * 0.06 * (1.0 - finBare) / (1.0 + 0.9 * lv));
        }`)
      .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>${beadsFrag('vShellPosition')}
        diffuseColor.rgb *= 1.0 - 0.3 * finBeadRim;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>${beadsGain}`);
  };
  mat.customProgramCacheKey = () => `${key ?? ''}|finish-v2`;
  mat.needsUpdate = true;
}

/**
 * The garage's paint tuner: change a body's finish live. finish: gloss | metallic | pearl | satin | matte; flake 0..1
 * (metallic grain). Pearl's iridescence is always compiled in (strength 0 when off), so switching never recompiles.
 */
export function setFinish(mat, finish, flake = 0.5) {
  const F = {
    gloss: { metalness: 0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0 },
    metallic: { metalness: 0.3, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.035, iridescence: 0 },
    pearl: { metalness: 0.15, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.035, iridescence: 0.55 },
    satin: { metalness: 0.08, roughness: 0.46, clearcoat: 0.3, clearcoatRoughness: 0.32, iridescence: 0 },
    matte: { metalness: 0, roughness: 0.78, clearcoat: 0, clearcoatRoughness: 0.5, iridescence: 0 },
  }[finish] ?? {};
  Object.assign(mat, F);
  if (mat.userData.finish) mat.userData.finish.uFlake.value = finish === 'metallic' ? flake : finish === 'pearl' ? flake * 0.25 : 0;
}

/**
 * Rain beads on a glass material (car-lab's glass, and the model cars' glass role): the same beads as the paint, attached
 * to the pane's own geometry. Beaded pixels turn a little opaque (water scatters), so they read against the dark cabin.
 */
export function applyRainGlass(mat) {
  if (mat.userData.rainGlass) return;
  mat.userData.rainGlass = true;
  const u = { uRainBeads: FINISH_RAIN, uFlow: FINISH_FLOW, uSpark: FINISH_SPARK, uFlake: { value: 0 }, uFlakeSize: { value: 0.0007 }, uCarbonY: { value: -1e3 } };
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey?.();
  mat.onBeforeCompile = (shader, renderer) => {
    base?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFinN, vFinP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinN = normal; vFinP = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vFinP;\n${GLSL}`)
      .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>${beadsFrag('vFinP')}
        diffuseColor.a = min(1.0, diffuseColor.a + 0.4 * finBeadVis + 0.3 * finBeadRim);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>${beadsGain}`);
  };
  mat.customProgramCacheKey = () => `${key ?? ''}|glass-rain-v1`;
  mat.needsUpdate = true;
}
