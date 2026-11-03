// India's surfaces. The export bakes every Blender material to a vertex colour and shares a handful of materials named by roughness and
// metalness (`IN vcol r0.8 m0.0` is the road, the town's walls, the cut walls and the snow massif alike): one flat colour and one gloss
// each, so everything read as plastic. Here each surface gets its own clone of its material, picked by mesh and material name (RULES),
// with real surface added in the shader (onBeforeCompile). The baked colour stays the base (a photo set is divided by its mean, so it adds
// variation, never a new colour):
//   road        Poly Haven asphalt_track laid flat in world space (normal, roughness, cavities), a second, larger and turned tap of the same
//               photo for tone so its repeat never lines up, and the road map (road-light.js): the rubbered racing line, dust toward the
//               edges, the lamps' and edge fixtures' light at night. Its flat-shaded strips get smooth normals (they read as stripes).
//               Wet: wet-road.js (puddles, mirror, ripples), as Marina's and Tokyo's asphalt
//   line, kerb  paint over asphalt / painted concrete: the paint keeps its colour, the surface shows through and breaks up the sheen
//   barrier, concrete, stone, plaster   photo sets mapped on the dominant axis in world space (a blend of two on oblique faces)
//   ground      the terrain: grass where the bake is green, soil and cut rock where it is not and on the steep faces, faint strata on cuts
//   metal       streaks of roughness, no photo: weathered steel instead of chrome
//   leaf        tea rows and bushes: matte (they were as glossy as paint), a world-noise tone
// Every surface gets world-space macro variation, darkens and smooths in the damp and the rain (wetify for the road, kerbs and lines;
// the rest here, by how much it soaks and how much it faces the sky), and fades its detail with the mip level, so nothing shimmers far off.
// Cost (qa/perf-ab): the patched meshes draw first (renderOrder), the detail is skipped in the road mirror's pass and its taps far off,
// and the road, kerbs and lines carry wet-road.js's shader only in the damp and the rain (a dry clone otherwise).
// Chaining as in Tokyo's materials.js: a previous onBeforeCompile (wetify) runs first and the program key is extended, never replaced.
// ?inmat=0 skips this part (A/B), ?inskip=ground,road skips those kinds (cost per kind); in dev window.__indiaMat.gain.value scales it live.
import * as THREE from 'three';
import { wetify, wetUniforms } from '../../wet-road.js';
import { nearestOnLap } from './layout.js';

const TEX = '/assets/india/tex/';
const WET_ON = 0.2;     // the road wears its wet shader above this params.wet (store.js WEATHER: Dry 0.15, Damp 0.7; main.js MIRROR_DRY)
// def: the shader path; set / set2: photo sets (scripts/pack-india-tex.mjs); scale / scale2: metres per repeat; nrm: normal strength;
// alb: how much of the photo's tone; rough: how much of its roughness; ao: cavity darkening; macro: world-noise tone; r: the base roughness
// (replaces the export's single value); soak: how much water darkens it; wet: through wet-road.js ('puddles' on the asphalt);
// map: reads the road map, lk: how much of its night light the surface takes; flat: pulls the bake's colour this far toward its mean;
// tone2: a second, larger tap of the photo for tone (the asphalt's repeat);
// tint: scales the bake (white road paint reflects ~65 %, not the bake's 85 %)
export const KINDS = {
  // a little lighter than the bake (sRGB 0.14 read as fresh tar by day) and a little smoother: worn asphalt has a sheen toward the low sun
  road: { def: 'IN_PLANAR', set: 'asphalt_track', scale: 2.4, nrm: 1, alb: 0.85, rough: 1, ao: 0.7, macro: 0.07, r: 0.72, wet: 'puddles', map: true, lk: 1, flat: 0.9, tint: 1.45, tone2: true },
  // the paint takes a quarter of the lamps' light: the asphalt's albedo is 0.017, so at full light a line burned 40x brighter and bloomed;
  // at a quarter it still reads clearly brighter than the road (the additive light it replaces had washed the lines out)
  line: { def: 'IN_PLANAR', set: 'asphalt_track', scale: 2.4, nrm: 0.45, alb: 0.1, rough: 0.6, ao: 0.3, macro: 0.05, r: 0.6, metal: 0, wet: 'wet', map: true, lk: 0.25, tint: 0.8 },
  kerb: { def: 'IN_TRI', set: 'brushed_concrete', scale: 1.4, nrm: 0.7, alb: 0.22, rough: 0.7, ao: 0.4, macro: 0.05, r: 0.6, wet: 'wet', map: true, lk: 0.25, tint: 0.8 },
  barrier: { def: 'IN_TRI', set: 'brushed_concrete', scale: 2.2, nrm: 0.8, alb: 0.3, rough: 0.8, ao: 0.4, macro: 0.06, r: 0.74, soak: 0.45 },
  concrete: { def: 'IN_TRI', set: 'concrete_wall_009', scale: 3.2, nrm: 0.9, alb: 0.85, rough: 0.8, ao: 0.5, macro: 0.12, r: 0.86, soak: 0.6 },
  stone: { def: 'IN_TRI', set: 'japanese_stone_wall', scale: 3.6, nrm: 1, alb: 1, rough: 0.7, ao: 0.8, macro: 0.1, r: 0.86, soak: 0.55 },
  plaster: { def: 'IN_TRI', set: 'white_plaster_02', set2: 'concrete_wall_009', scale: 2.6, scale2: 3.2, nrm: 0.8, alb: 0.75, rough: 0.6, ao: 0.4, macro: 0.13, r: 0.88, soak: 0.45 },
  ground: { def: 'IN_GROUND', set: 'leafy_grass', set2: 'aerial_sand', scale: 1.8, scale2: 3.4, nrm: 0.9, alb: 0.75, rough: 0.6, ao: 0.5, macro: 0.22, r: 0.94, soak: 0.7 },
  metal: { def: 'IN_METAL', macro: 0.05, rmin: 0.45, soak: 0.1 },
  leaf: { def: 'IN_NONE', macro: 0.16, r: 0.9, env: 0.6, soak: 0.25 },
};
// (mesh or ancestor name, material name) -> kind, first match wins. Names as three.js sanitises them (spaces to _, no dots or colons)
const RULES = [
  [/^India_racing_surface/, /./, 'road'],
  [/^(Edge_paint|Source_start_finish_chequer|india_road_paint)/, /./, 'line'],     // (the chequer's dark squares were half metal)
  [/^Alternating_painted_kerbs/, /./, 'kerb'],
  [/^Concrete_safety_walls/, /^IN vcol r0\.6 m0\.0$/, 'barrier'],     // the painted faces (the caps are concrete, the uprights steel)
  [/^V5_terrain/, /./, 'ground'],
  [/^V5_walls_\|_stone/, /./, 'stone'],
  [/^(V5_walls|Retaining_walls|Stands_\|_terraced|Gorge_straight|Concrete_safety_walls|River_suspension_bridge|Body_\|_T\d|KAVI_CHOWK_STAND|WEST_CHICANE_STAND|Venue_\|_stand_roof)/,
    /^IN vcol r0\.[89] m0\.0$/, 'concrete'],
  [/^(static_|scatter_kit_)/, /^IN vcol r0\.[89] m0\.0$/, 'plaster'],   // the town: plastered walls, flat concrete roofs (not the 2s: awnings, cloth)
  [/^(V5_tea|scatter_veg)/, /^IN vcol r0\.[4-7] m0\.0 2s$/, 'leaf'],
  [/./, /^IN vcol r0\.[2-6] m(0\.[3-9]|1\.0)$/, 'metal'],
];
const SMOOTH = /^(India_racing_surface|Edge_paint)/;   // flat-shaded strips: smoothShading
/** names: the mesh's own name and its ancestors'; mat: the material's name -> a KINDS key or null */
export function kindOf(names, mat) {
  for (const [n, m, k] of RULES) if (m.test(mat) && names.some((x) => n.test(x))) return k;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------- GLSL
const VERT = /* glsl */`
  { vec4 inP = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      inP = instanceMatrix * inP;
    #endif
    vInW = (modelMatrix * inP).xyz; }`;

const FRAG = /* glsl */`
varying vec3 vInW; vec3 vInN;      // world position; world normal (from three's view-space vNormal, set first thing in main)
uniform vec4 uInA, uInB, uInAvg, uInAvg2, uInBase;   // A: scale, nrm, alb, rough  B: macro, ao, soak, scale2  Avg(2): a set's mean albedo + roughness  Base: mean bake colour, pull
uniform vec2 uInAo;                                 // the sets' mean AO
uniform float uInG, uInWet, uInLk, uInMirrorY;
vec3 inAlb = vec3(1.0); float inRough = 1.0; vec3 inDelta = vec3(0.0); vec4 inRM = vec4(0.0);
float inH2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float inN2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(inH2(i), inH2(i + vec2(1, 0)), f.x), mix(inH2(i + vec2(0, 1)), inH2(i + vec2(1, 1)), f.x), f.y); }
vec3 inNw() { vec3 n = normalize(vInN);
  #ifdef DOUBLE_SIDED
    n *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  return n; }
#if defined(IN_PLANAR) || defined(IN_TRI) || defined(IN_GROUND)
uniform sampler2D inTexD, inTexN;
#if defined(IN_SET2)
uniform sampler2D inTexD2, inTexN2;
#endif
// one tap of a set: albedo, the normal's tilt, roughness and AO. The tilt fades out as the texel footprint grows (an averaged normal is a
// smooth surface, and a sharp one at 100 m glitters) and the roughness takes a little of it; once it has faded the normal map is not read
// at all (roughness and AO are then the set's means), and once a texel is under a 64th of a pixel across, nor is the albedo: most of a
// wide view, so the taps are paid near the camera
struct InT { vec3 d; vec2 t; float r; float ao; };
InT inTap(sampler2D D, sampler2D N, vec2 uv, vec2 gx, vec2 gy, vec4 avg, float aoMean) {
  vec2 ts = vec2(textureSize(N, 0)), a = gx * ts, b = gy * ts;
  float la = dot(a, a), lb = dot(b, b);
  float nf = 1.0 - smoothstep(1.5, 4.5, 0.5 * log2(max(max(la, lb), 1.0))), af = 1.0 - smoothstep(5.0, 6.5, 0.5 * log2(max(min(la, lb), 1.0)));
  InT r = InT(avg.rgb, vec2(0.0), avg.w + 0.08, aoMean);
  if (af > 0.0) r.d = mix(avg.rgb, textureGrad(D, uv, gx, gy).rgb, af);
  if (nf > 0.0) {
    vec4 n = textureGrad(N, uv, gx, gy); vec2 t = n.xy * 2.0 - 1.0;
    r.t = t / sqrt(max(1.0 - dot(t, t), 0.06)) * nf; r.r = mix(r.r, n.z, nf); r.ao = mix(aoMean, n.w, nf);
  }
  return r;
}
// world-space projection on axis ax (0 x, 1 y, 2 z) of a face whose normal points along s * axis: u, v = p.T, p.B with T x B = the normal
InT inAxis(sampler2D D, sampler2D N, vec4 avg, float aoMean, int ax, float s, float k, vec3 dpx, vec3 dpy, out vec3 T, out vec3 B) {
  if (ax == 0) { T = vec3(0.0, 0.0, -s); B = vec3(0.0, 1.0, 0.0); }
  else if (ax == 1) { T = vec3(1.0, 0.0, 0.0); B = vec3(0.0, 0.0, -s); }
  else { T = vec3(s, 0.0, 0.0); B = vec3(0.0, 1.0, 0.0); }
  return inTap(D, N, vec2(dot(vInW, T), dot(vInW, B)) * k, vec2(dot(dpx, T), dot(dpx, B)) * k, vec2(dot(dpy, T), dot(dpy, B)) * k, avg, aoMean);
}
// a tap as factors on the bake: mostly tone (a little of the photo's colour), cavities from its AO, roughness relative to its mean
vec4 inFac(InT t, vec4 avg, float aoMean) {
  const vec3 W = vec3(0.2126, 0.7152, 0.0722);
  vec3 a = mix(vec3(1.0), clamp(mix(vec3(dot(t.d, W) / dot(avg.rgb, W)), t.d / avg.rgb, 0.25), 0.3, 2.6), uInA.z);
  return vec4(a * mix(1.0, clamp(t.ao / aoMean, 0.4, 1.15), uInB.y), mix(1.0, clamp(t.r / avg.w, 0.5, 1.7), uInA.w));
}
#endif
void inSurface() {
  vec3 dpx = dFdx(vInW), dpy = dFdy(vInW), T, B;
#if defined(IN_PLANAR)
  // flat on the road, u along +x, v along -z (T x B = up); on the asphalt the same photo again 3.4x larger and turned 34 degrees, tone only
  InT t = inAxis(inTexD, inTexN, uInAvg, uInAo.x, 1, 1.0, 1.0 / uInA.x, dpx, dpy, T, B);
  vec4 f = inFac(t, uInAvg, uInAo.x);
  inAlb = f.rgb; inRough = f.a; inDelta = (t.t.x * T + t.t.y * B) * uInA.y;
  #ifdef IN_TONE2
    const mat2 R = mat2(0.8290, 0.5592, -0.5592, 0.8290); float k2 = 0.29 / uInA.x;
    vec3 d2 = textureGrad(inTexD, R * vec2(vInW.x, -vInW.z) * k2 + 0.37, R * vec2(dpx.x, -dpx.z) * k2, R * vec2(dpy.x, -dpy.z) * k2).rgb;
    inAlb *= mix(1.0, clamp(dot(d2, vec3(0.2126, 0.7152, 0.0722)) / dot(uInAvg.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.6, 1.5), 0.45 * uInA.z);
  #endif
#elif defined(IN_TRI)
  // the dominant axis, and a second one on oblique faces where two are close (columns, bevels, a wall curving through 45 degrees)
  vec3 n = inNw(), a = abs(n); float m = max(a.x, max(a.y, a.z));
  int i0 = a.x >= m ? 0 : (a.y >= m ? 1 : 2);
  vec3 b = a; b[i0] = 0.0; float mb = max(b.x, max(b.y, b.z)), kb = smoothstep(0.8, 1.0, mb / m) * 0.5;   // (a band about 10 degrees wide)
  int i1 = b.x >= mb ? 0 : (b.y >= mb ? 1 : 2);
  #if defined(IN_SET2)
    InT t; vec4 f;
    if (n.y > 0.7) { t = inAxis(inTexD2, inTexN2, uInAvg2, uInAo.y, i0, sign(n[i0]), 1.0 / uInB.w, dpx, dpy, T, B); f = inFac(t, uInAvg2, uInAo.y); }   // the town's flat roofs: concrete, not plaster
    else { t = inAxis(inTexD, inTexN, uInAvg, uInAo.x, i0, sign(n[i0]), 1.0 / uInA.x, dpx, dpy, T, B); f = inFac(t, uInAvg, uInAo.x); }
  #else
    InT t = inAxis(inTexD, inTexN, uInAvg, uInAo.x, i0, sign(n[i0]), 1.0 / uInA.x, dpx, dpy, T, B);
    vec4 f = inFac(t, uInAvg, uInAo.x);
  #endif
  vec3 tilt = t.t.x * T + t.t.y * B;
  if (kb > 0.001) {
    InT t1 = inAxis(inTexD, inTexN, uInAvg, uInAo.x, i1, sign(n[i1]), 1.0 / uInA.x, dpx, dpy, T, B);
    f = mix(f, inFac(t1, uInAvg, uInAo.x), kb); tilt = mix(tilt, t1.t.x * T + t1.t.y * B, kb);
  }
  inAlb = f.rgb; inRough = f.a; inDelta = tilt * uInA.y;
#elif defined(IN_GROUND)
  // grass where the bake is green (green over blue: dry grass is yellow, soil and rock are grey-brown), frayed by noise, never on a
  // steep face; soil and rock elsewhere, rougher in relief on the cuts. Far off (a texel under a 64th of a pixel) the taps stop:
  // a tile is its mean by then, and the valley is most of the screen
  vec3 n = inNw(), a = abs(n);
  int ax = a.y >= max(a.x, a.z) ? 1 : (a.x >= a.z ? 0 : 2); float s = sign(n[ax]);
  #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
    vec3 vc = vColor.rgb;
  #else
    vec3 vc = vec3(0.3, 0.4, 0.1);
  #endif
  float veg = smoothstep(0.3, 0.5, (vc.g - vc.b) / max(vc.g, 1e-3) + 0.16 * (inN2(vInW.xz * 0.7) - 0.5)) * smoothstep(0.55, 0.8, n.y);
  float near = 1.0 - smoothstep(4.5, 6.0, log2(max(length(dpx), length(dpy)) * 512.0 / uInA.x));
  if (near > 0.0) {
    vec4 f = vec4(1.0); vec3 tilt = vec3(0.0);
    if (veg > 0.01) { InT t = inAxis(inTexD, inTexN, uInAvg, uInAo.x, ax, s, 1.0 / uInA.x, dpx, dpy, T, B); f = inFac(t, uInAvg, uInAo.x); tilt = t.t.x * T + t.t.y * B; }
    if (veg < 0.99) {
      InT t = inAxis(inTexD2, inTexN2, uInAvg2, uInAo.y, ax, s, 1.0 / uInB.w, dpx, dpy, T, B);
      f = mix(inFac(t, uInAvg2, uInAo.y), f, veg); tilt = mix((t.t.x * T + t.t.y * B) * (1.0 + 0.5 * (1.0 - smoothstep(0.4, 0.8, n.y))), tilt, veg);
    }
    inAlb = mix(vec3(1.0), f.rgb, near); inRough = mix(1.0, f.a, near); inDelta = tilt * uInA.y * near;
  }
  float cut = 1.0 - smoothstep(0.35, 0.7, n.y);          // faint strata across a cut face, wavering along it
  if (cut > 0.0) inAlb *= 1.0 + 0.2 * cut * (inN2(vec2(vInW.y * 1.6 + 3.0 * inN2(vInW.xz * 0.04), 0.5)) - 0.5);
#elif defined(IN_METAL)
  // roughness streaks along the member (rain runs down an upright, wear along a rail), and a trace of tone
  vec3 n = inNw(); vec2 p = abs(n.y) > 0.7 ? vInW.xz : vec2(abs(n.x) > abs(n.z) ? vInW.z : vInW.x, vInW.y);
  float fine = 1.0 - smoothstep(0.2, 0.5, fwidth(p.x * 60.0));
  float s = (inN2(vec2(p.x * 60.0, p.y * 1.2)) - 0.5) * fine + (inN2(vec2(p.x * 7.0, p.y * 0.5) + 9.0) - 0.5) * 0.7;
  inRough = 1.0 + 0.8 * s; inAlb = vec3(1.0 + 0.1 * s);
#endif
}
// the variation of a big surface: sun-bleached and weathered patches (~25 m and ~3 m), warmer where lighter, rougher where darker
void inMacro() {
  if (uInB.x <= 0.0) return;
  vec2 q = vInW.xz + vInW.y * vec2(0.37, -0.29);          // (height shears it: on a wall the patches run down it as weathering, not in rows)
  float m = (inN2(q * 0.04) - 0.5) * 1.4 + (inN2(q * 0.29 + 7.0) - 0.5) * 0.6;
  inAlb *= (1.0 + uInB.x * m) * vec3(1.0 + 0.2 * uInB.x * m, 1.0, 1.0 - 0.2 * uInB.x * m);
  inRough *= 1.0 - 0.5 * uInB.x * m;
}
`;

function patch(m, kind, defs, uniforms) {
  const prevCompile = m.onBeforeCompile, baseKey = m.customProgramCacheKey();
  const key = baseKey + '|in:' + defs.join(',');          // by shader path, not by kind: barrier, concrete and stone share a program
  m.onBeforeCompile = (shader, renderer) => {
    prevCompile.call(m, shader, renderer);              // wetify first
    // its seven mirror taps run only while the mirror is drawn (dry, every road pixel paid them for a reflection weighted by uMirror = 0;
    // the sun glint reads the mirror only then too). shortcut: matches wet-road.js's text; if that changes, this does nothing (slower, same image)
    shader.fragmentShader = shader.fragmentShader.replace('for (int i = -3; i <= 3; i++) {', 'if (uMirror > 0.5) for (int i = -3; i <= 3; i++) {').replace('refl /= tw;', 'refl /= max(tw, 1e-3);');
    shader.vertexShader = 'varying vec3 vInW;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>' + VERT);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = defs.map((d) => `#define ${d}\n`).join('') + shader.fragmentShader
      .replace('void main() {', FRAG + 'void main() {')                  // after the chunks' own declarations (vColor)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vInN = (vec4(vNormal, 0.0) * viewMatrix).xyz;
        #ifdef IN_FLAT
          diffuseColor.rgb = mix(diffuseColor.rgb, uInBase.rgb, uInBase.a);
        #endif
        if (cameraPosition.y > uInMirrorY) { inSurface(); inMacro(); }   // not in the road mirror's pass (its camera is under the plane): blurred and streaked there, so it was paid for nothing
        #ifdef IN_ROADMAP
          inRM = texture2D(tInRoad, (vInW.xz - uInRoad.xy) * uInRoad.zw);
          inAlb *= (1.0 - 0.16 * inRM.b) * (1.0 + 0.12 * inRM.a); inRough *= (1.0 - 0.1 * inRM.b) * (1.0 + 0.06 * inRM.a);   // rubber: darker, a little smoother; dust: paler, matte
        #endif
        diffuseColor.rgb *= mix(vec3(1.0), inAlb, uInG);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(1.0, inRough, uInG), 0.04, 1.0);
        #ifdef IN_SOAK
          if (uInWet > 0.25) { float wk = smoothstep(0.25, 1.0, uInWet) * uInB.z * mix(0.55, 1.0, max(inNw().y, 0.0));   // the damp and the rain: darker, smoother, most where it faces the sky
            diffuseColor.rgb *= 1.0 - 0.45 * wk; roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, wk); }
        #endif`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n        normal = normalize(normal + (viewMatrix * vec4(inDelta * uInG, 0.0)).xyz);')
      .replace('#include <lights_fragment_end>', `#ifdef IN_ROADMAP
          irradiance += (inRM.r * inRM.r * uInLamp + inRM.g * inRM.g * uInEdge) * uInLk;   // the lamps' and edge fixtures' light, as irradiance: each surface reflects it by its albedo
        #endif
        #include <lights_fragment_end>`);
    if (defs.includes('IN_ROADMAP')) shader.fragmentShader = 'uniform sampler2D tInRoad; uniform vec4 uInRoad; uniform vec3 uInLamp, uInEdge;\n' + shader.fragmentShader;
  };
  m.customProgramCacheKey = () => key;
  m.needsUpdate = true;
}

/** a flat-shaded mesh (the road's strips) gets the normal and the bake colour averaged over every vertex at the same position: each
 *  strip had its own normal and colour, and their edges read as stripes across the road */
export function smoothShading(geo) {
  const P = geo.attributes.position, at = new Map(), idx = new Int32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    const k = `${P.getX(i)},${P.getY(i)},${P.getZ(i)}`;
    let a = at.get(k); if (a === undefined) { a = at.size; at.set(k, a); }
    idx[i] = a;
  }
  for (const [name, unit] of [['normal', true], ['color', false]]) {
    const A = geo.attributes[name]; if (!A) continue;
    const w = A.itemSize, acc = new Float64Array(at.size * w), cnt = new Uint16Array(at.size), out = new Float32Array(P.count * w);
    for (let i = 0; i < P.count; i++) { cnt[idx[i]]++; for (let c = 0; c < w; c++) acc[idx[i] * w + c] += A.getComponent(i, c); }
    for (let i = 0; i < P.count; i++) {
      const a = idx[i] * w, l = unit ? Math.hypot(acc[a], acc[a + 1], acc[a + 2]) || 1 : cnt[idx[i]];
      for (let c = 0; c < w; c++) out[i * w + c] = acc[a + c] / l;
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, w));
  }
  return at.size;
}

/** The centre dashes and the grid boxes are merged into the town's chunks (`static_*`, white paint `IN vcol r0.6 m0.0`, with walls and
 *  trim): their flat triangles on the carriageway (up-facing, within the kerbs, at road height) move to a mesh of their own, a child
 *  named india_road_paint that RULES gives the line paint (wet with the road, lit by the road map). One draw call per chunk that has any. */
function splitPaint(root, track) {
  const near = nearestOnLap(track), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const found = [];
  root.traverse((o) => { if (o.isMesh && /^static_/.test(o.parent?.name ?? '') && o.material?.name === 'IN vcol r0.6 m0.0' && o.geometry.index) found.push(o); });
  let tris = 0;
  for (const o of found) {
    o.updateWorldMatrix(true, false);
    const g = o.geometry, I = g.index.array, P = g.attributes.position, keep = [], paint = [];
    for (let t = 0; t < I.length; t += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(P, I[t + k]).applyMatrix4(o.matrixWorld);
      const n = e1.subVectors(v[1], v[0]).cross(e2.subVectors(v[2], v[0])).normalize(), cx = (v[0].x + v[1].x + v[2].x) / 3, cz = (v[0].z + v[1].z + v[2].z) / 3;
      const r = Math.abs(n.y) > 0.97 ? near(cx, cz) : null;
      (r && Math.abs(r.lat) < 11.7 && Math.abs((v[0].y + v[1].y + v[2].y) / 3 - r.y) < 0.6 ? paint : keep).push(I[t], I[t + 1], I[t + 2]);
    }
    if (!paint.length) continue;
    const pg = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(g.attributes)) pg.setAttribute(name, a);
    pg.setIndex(paint); pg.computeBoundingSphere(); g.setIndex(keep); g.computeBoundingSphere();
    const m = new THREE.Mesh(pg, o.material); m.name = 'india_road_paint'; m.receiveShadow = true; m.castShadow = false; m.layers.mask = o.layers.mask;
    o.add(m); tris += paint.length / 3;
  }
  return tris;
}

async function loadSets(ktx2, renderer) {
  const manifest = await fetch(TEX + 'manifest.json').then((r) => (r.ok && /json/.test(r.headers.get('content-type') ?? '') ? r.json() : null)).catch(() => null);
  if (!manifest || !ktx2) return {};
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()), out = {};
  const slugs = [...new Set(Object.values(KINDS).flatMap((k) => [k.set, k.set2]).filter(Boolean))];
  const load = Promise.all(slugs.map(async (slug) => {
    try {
      const [d, n] = await Promise.all([ktx2.loadAsync(`${TEX}${slug}_d.ktx2`), ktx2.loadAsync(`${TEX}${slug}_n.ktx2`)]);
      for (const t of [d, n]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
      out[slug] = { d, n, ...manifest[slug] };
    } catch (e) { console.warn('india materials: texture set', slug, 'unavailable, plain surface:', e?.message ?? e); }
  }));
  await Promise.race([load, new Promise((r) => setTimeout(r, 20000))]);   // never hold the venue for textures: what has loaded by then is used
  return out;
}

let early = null;   // prefetch(): the photo sets load while main.js is still fetching and parsing the venue GLB
export function prefetch({ renderer, ktx2 }) {
  if (new URLSearchParams(location.search).get('inmat') !== '0') early ??= loadSets(ktx2, renderer);
}

/** ctx: main.js venue context; road: the road map's uniforms (night.js) or null */
export async function create(ctx, road) {
  if (new URLSearchParams(location.search).get('inmat') === '0') return { setLook() {}, dispose() {} };
  const t0 = performance.now(), skip = new Set((new URLSearchParams(location.search).get('inskip') ?? '').split(','));
  const sets = await (early ?? loadSets(ctx.ktx2, ctx.renderer)); early = null;
  const gain = { value: 1 }, mirrorY = { value: -1e9 }, clones = new Map(), stats = {};
  let refl = null;
  // a surface that wet-road.js wets comes in two clones: dry, without its shader (in the game's Dry its puddle noise, film and glint ran on
  // every road pixel for a 4 % darkening), and wet; setLook puts on the one the weather wants
  const make = (src, kind) => {
    const K = KINDS[kind], s1 = sets[K.set], s2 = sets[K.set2], photo = !K.set || (s1 && (!K.set2 || s2));
    const u = {
      uInG: gain, uInWet: wetUniforms.uWet, uInLk: { value: K.lk ?? 0 }, uInMirrorY: mirrorY,
      uInA: { value: new THREE.Vector4(K.scale ?? 1, K.nrm ?? 0, K.alb ?? 0, K.rough ?? 0) },
      uInB: { value: new THREE.Vector4(K.macro ?? 0, K.ao ?? 0, K.soak ?? 0, K.scale2 ?? 1) },
      uInAvg: { value: new THREE.Vector4(...(s1?.avg ?? [1, 1, 1]), s1?.rough ?? 1) }, uInAvg2: { value: new THREE.Vector4(...(s2?.avg ?? [1, 1, 1]), s2?.rough ?? 1) },
      uInAo: { value: new THREE.Vector2(s1?.ao ?? 1, s2?.ao ?? 1) }, uInBase: { value: new THREE.Vector4(0, 0, 0, 0) },
      ...(photo && s1 ? { inTexD: { value: s1.d }, inTexN: { value: s1.n } } : {}), ...(photo && s2 ? { inTexD2: { value: s2.d }, inTexN2: { value: s2.n } } : {}),
      ...(K.map && road ? road : {}),
    };
    const one = (wet) => {
      const m = src.clone();
      m.name = `India | ${kind}${wet ? ' wet' : ''} (${src.name})`;
      if (K.r !== undefined) m.roughness = K.r;
      if (K.rmin !== undefined) m.roughness = Math.max(m.roughness, K.rmin);
      if (K.metal !== undefined) m.metalness = K.metal;
      if (K.env !== undefined) m.envMapIntensity = K.env;
      if (K.tint !== undefined) m.color.multiplyScalar(K.tint);
      if (wet) wetify(m, { puddles: K.wet === 'puddles' });
      patch(m, kind, [photo ? K.def : 'IN_NONE', ...(K.set2 && photo ? ['IN_SET2'] : []), ...(K.map && road ? ['IN_ROADMAP'] : []), ...(K.flat ? ['IN_FLAT'] : []), ...(K.tone2 ? ['IN_TONE2'] : []), ...(K.wet ? [] : ['IN_SOAK'])], u);
      ctx.allMats?.add(m);
      return m;
    };
    return { dry: one(false), wet: K.wet ? one(true) : null, u };
  };
  const meshes = [], slots = [];     // slots: [mesh, the export's material(s), [clone record or null per material], kind]
  let wetOn = false;
  const assign = (o, orig, recs) => { const out = recs.map((c, i) => (c ? (wetOn && c.wet) || c.dry : [].concat(orig)[i])); o.material = Array.isArray(orig) ? out : out[0]; };
  const paintTris = splitPaint(ctx.root, ctx.track);
  ctx.root.traverse((o) => {
    if (!o.isMesh) return;
    const names = []; for (let p = o; p && p !== ctx.root; p = p.parent) names.push(p.name);
    let first = null;
    const recs = [].concat(o.material).map((src) => {
      const kind = kindOf(names, src.name ?? ''); if (!kind || skip.has(kind)) return null;
      const key = src.uuid + kind;
      if (!clones.has(key)) clones.set(key, make(src, kind));
      stats[kind] = (stats[kind] ?? 0) + 1; first ??= kind;
      if (SMOOTH.test(o.name) && !o.userData.inSmooth) { smoothShading(o.geometry); o.userData.inSmooth = true; }
      if (KINDS[kind].flat) meshes.push([o, clones.get(key)]);
      return clones.get(key);
    });
    if (!first) return;
    // three draws opaques by renderOrder, then material id: the clones are the newest materials, so the terrain, road and town (the big
    // occluders) went last and everything behind them was shaded first (+14 % at night, with no shader change). Ahead of the rest, after
    // the road mirror (-1, its render has to come first)
    o.renderOrder = -0.5;
    slots.push([o, o.material, recs, first]);
    assign(o, o.material, recs);
  });
  // the road's mean bake colour, which IN_FLAT pulls the per-strip colour toward
  for (const [o, { u }] of meshes) {
    const C = o.geometry.attributes.color; if (!C) continue;
    let r = 0, g = 0, b = 0; for (let i = 0; i < C.count; i++) { r += C.getX(i); g += C.getY(i); b += C.getZ(i); }
    u.uInBase.value.set(r / C.count, g / C.count, b / C.count, KINDS.road.flat);
  }
  console.info(`india materials: ${clones.size} materials, ${Object.keys(sets).length} photo sets, ${paintTris} road paint tris split off, ${(performance.now() - t0).toFixed(0)} ms ${JSON.stringify(stats)}`);
  // dev: swap(false) puts the export's materials back on every mesh, swap(true) these, swap(true, ['road']) only those kinds (both sets of
  // programs stay compiled): an in-page A/B (qa/perf-ab/bench-swap.mjs)
  if (import.meta.env?.DEV) globalThis.__indiaMat = { gain, clones, sets, stats, swap: (on, kinds) => { for (const [o, orig, recs, k] of slots) on && (!kinds || kinds.includes(k)) ? assign(o, orig, recs) : (o.material = orig); } };
  return {
    setLook(look, params) {
      const w = (params?.wet ?? 0) > WET_ON;
      if (w !== wetOn) { wetOn = w; for (const [o, orig, recs] of slots) assign(o, orig, recs); }
      for (const c of clones.values()) if (c.wet) c.wet.envMapIntensity = 1 + 0.4 * (params?.wet ?? 0);   // as main.js does for its own wet materials
    },
    /** after the mirror's height is set (india.js mirrorHeight): the plane the shaders tell the mirror's pass by */
    update() {
      if (!refl?.parent) refl = ctx.scene.children.find((o) => o.isReflector) ?? null;   // main.js rebuilds it on a resolution change
      mirrorY.value = refl?.visible ? refl.position.y : -1e9;
    },
    dispose() {   // (the venue's own unload disposes what is on its meshes; the clone of the other weather is not on any)
      for (const c of clones.values()) { c.dry.dispose(); c.wet?.dispose(); }
      for (const s of Object.values(sets)) { s.d.dispose(); s.n.dispose(); }
    },
  };
}
