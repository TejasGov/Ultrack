// Tokyo surface detail: the GLB's flat colours (roof tiles, timber, plaster, concrete, lacquer, shoji, metals) get real
// surface at runtime, by material name, through onBeforeCompile. No new draws and no geometry: shader work only.
//
//  * Photo sets (CC0 Poly Haven, packed by scripts/pack-tokyo-tex.mjs into public/assets/tokyo/tex/*.ktx2): one albedo + one
//    normal/roughness/AO texture per set, sampled in the object's own metric space (triplanar by dominant axis, so a rotated
//    house keeps its planks and plaster aligned; roofs use a slope-aware planar mapping so the courses follow the eave). The
//    albedo is divided by the set's mean, so a texture only adds variation and each material keeps its base colour.
//  * Procedural, made in the shader: the shoji lattice (also shapes the night emission), brushed / streaked metals and glass,
//    pearl enamel, and a procedural fallback for every photo kind (used when a set fails to load, or with ?tmtex=0).
//  * Every material also gets world-space macro variation (so repeated instances and big walls are not uniform) and grime
//    toward the base of the mesh.
// To switch a material from procedural to a photo set (or back), change its `set` in ENTRIES: the shader structure is shared.
//
// Chaining: a material that already has an onBeforeCompile (wetify's, M_Fence's) keeps it: it runs first, and the program
// cache key is extended, never replaced. ?tmat=0 skips this part entirely (A/B), window.__tokyoMat.gain scales the effect live.
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const TEX = '/assets/tokyo/tex/';
const LIT = { day: 0, dusk: 0.6, bluehour: 1, night: 1 };      // how much of a shoji's `glow` each look gets (main.js applyAll resets emissiveIntensity, then setLook runs)
const SETS = ['grey_roof_01', 'japanese_cedar_planks', 'white_plaster_02', 'concrete_wall_009', 'painted_metal_shutter', 'lacquered_cherry_wood', 'japanese_stone_wall'];

// kind: tex (photo set, with a procedural fallback of `proc`), shoji, metal
//   scale  metres per texture repeat        nrm  normal strength           alb  how much of the texture's tone variation
//   rough  how much of its roughness        ao   cavity darkening          macro world-noise tone variation   grime  darkening at the base
const ENTRIES = [
  { re: /^V10 tile$/, kind: 'tex', proc: 'roof', set: 'grey_roof_01', roof: true, scale: 7.2, nrm: 1.3, alb: 1, rough: 0.8, ao: 0.8, macro: 0.16, grime: 0, flat: true },
  { re: /^(V10 wood|V13 castle eave wood)$/, kind: 'tex', proc: 'wood', set: 'japanese_cedar_planks', scale: 1.9, nrm: 0.9, alb: 1, rough: 0.8, ao: 0.6, macro: 0.14, grime: 0.22 },
  { re: /^V10 cedar$/, kind: 'tex', proc: 'wood', set: 'japanese_cedar_planks', scale: 1.4, nrm: 0.8, alb: 0.9, rough: 0.8, ao: 0.6, macro: 0.12, grime: 0.12 },
  { re: /^(V10 red|V12 pagoda red lacquer)$/, kind: 'tex', proc: 'wood', set: 'lacquered_cherry_wood', scale: 1.3, nrm: 0.5, alb: 0.9, rough: 0.7, ao: 0.4, macro: 0.05, grime: 0, noTop: true },
  { re: /^(V3 ivory|V13 white slab|V13 castle lime trim)$/, kind: 'tex', proc: 'plaster', set: 'white_plaster_02', scale: 2.4, nrm: 0.9, alb: 0.9, rough: 0.5, ao: 0.4, macro: 0.14, grime: 0.28 },
  // the district walls (frA/frB houses, plazas): already textured by the GLB through unreliable UVs, so this adds a world-space layer on top
  { re: /^Concrete \| mineral$/, kind: 'tex', proc: 'plaster', set: 'white_plaster_02', scale: 2.6, nrm: 0.8, alb: 0.7, rough: 0.4, ao: 0.3, macro: 0.13, grime: 0.22 },
  { re: /^V9 konc$/, kind: 'tex', proc: 'plaster', set: 'concrete_wall_009', scale: 3.2, nrm: 0.9, alb: 0.95, rough: 0.5, ao: 0.5, macro: 0.14, grime: 0.3 },
  // the bridge's towers: big pours, so the shuttering panels are large (about 2 m) and the tie holes a metre apart
  { re: /^V5 pearl concrete \| weathered bridge$/, kind: 'tex', proc: 'plaster', set: 'concrete_wall_009', scale: 7.0, nrm: 0.9, alb: 0.95, rough: 0.5, ao: 0.5, macro: 0.18, grime: 0.3 },
  { re: /^V9 grey$/, kind: 'tex', proc: 'plaster', set: 'painted_metal_shutter', scale: 0.9, nrm: 0.8, alb: 0.8, rough: 0.6, ao: 0.5, macro: 0.1, grime: 0.15 },
  { re: /^V13 castle stone$/, kind: 'tex', proc: 'stone', set: 'japanese_stone_wall', scale: 4.5, nrm: 1.0, alb: 1, rough: 0.7, ao: 0.8, macro: 0.12, grime: 0.3 },
  // shoji: paper panes between a dark lattice; the emission follows it. glow: how much brighter the paper burns once the lights are on
  // (x2.2 at night, scaled by LIT per look; by day nothing changes), so a lit pane reads as warm paper, not a dim tint
  { re: /^V10 paper$/, kind: 'shoji', macro: 0.06, glow: 2.2 },
  { re: /^(V12 pagoda shoji|V13 castle window warm)$/, kind: 'shoji', macro: 0 },    // emission-only panes: the lattice shapes their glow
  // blossom and leaves: no pattern, only world-noise tone so one tree is not its neighbour's copy
  { re: /^V3 (petal|petal2|petal3|leaf2)$/, kind: 'none', macro: 0.2, grime: 0 },
  // metals and glass: streaked roughness (brushed along the wall, or rain runs on glass), a little tone, no photo
  { re: /^(Anodized graphite|V5 satin bridge rail)$/, kind: 'metal', streak: [1.4, 70], rough: 0.5, alb: 0.05, macro: 0.07, grime: 0 },
  { re: /^(V10 gold|V8 aged sign brass|V13 castle gold ornament)$/, kind: 'metal', streak: [1.8, 90], rough: 0.6, alb: 0.09, macro: 0.18, grime: 0 },
  { re: /^V6 wheel pearl enamel$/, kind: 'metal', streak: [1.0, 30], rough: 0.2, alb: 0.02, macro: 0.05, grime: 0, pearl: 0.2 },
  { re: /^(V10 glass|V13 glazing)$/, kind: 'metal', streak: [0.45, 14], rough: 0.8, alb: 0, macro: 0.05, grime: 0, vertical: 1 },
];

// ---------------------------------------------------------------------------------------------------------------- GLSL
const VERT_DECL = 'varying vec3 vTmP; varying vec3 vTmN; varying vec3 vTmO; varying vec3 vTmX; varying vec3 vTmY; varying vec3 vTmZ; varying float vTmH;\n';
// object-aligned metric frame: transformed * per-axis scale is in metres along the object's own axes (the GLB quantises
// positions to [-1,1] under a node scale); X/Y/Z are the object's axes in the world; H is the height over the mesh's base
// when the mesh is quantised (its bbox bottom is -1): a ground proxy for grime
const VERT_BODY = /* glsl */`
  {
    mat4 tmM = modelMatrix;
    #ifdef USE_INSTANCING
      tmM = tmM * instanceMatrix;
    #endif
    vec3 tmS = vec3(length(tmM[0].xyz), length(tmM[1].xyz), length(tmM[2].xyz));
    vTmP = (tmM * vec4(transformed, 1.0)).xyz;
    vTmN = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);
    vTmO = transformed * tmS;
    vTmX = tmM[0].xyz / tmS.x; vTmY = tmM[1].xyz / tmS.y; vTmZ = tmM[2].xyz / tmS.z;
    vTmH = (transformed.y + 1.0) * tmS.y;
  }`;

const FRAG_COMMON = /* glsl */`
varying vec3 vTmP; varying vec3 vTmN; varying vec3 vTmO; varying vec3 vTmX; varying vec3 vTmY; varying vec3 vTmZ; varying float vTmH;
uniform vec4 uTmA, uTmB, uTmAvg, uTmF;   // per entry (see ENTRIES); meaning per kind below
uniform float uTmG;                // global gain, 1 = as designed, 0 = off
vec3 tmAlb = vec3(1.0); float tmRoughK = 1.0; float tmEm = 1.0; vec3 tmDelta = vec3(0.0);   // results, applied by the chunks below
float tmH3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float tmH2(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float tmN3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tmH3(i), tmH3(i + vec3(1, 0, 0)), f.x), mix(tmH3(i + vec3(0, 1, 0)), tmH3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(tmH3(i + vec3(0, 0, 1)), tmH3(i + vec3(1, 0, 1)), f.x), mix(tmH3(i + vec3(0, 1, 1)), tmH3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float tmN2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tmH2(i), tmH2(i + vec2(1, 0)), f.x), mix(tmH2(i + vec2(0, 1)), tmH2(i + vec2(1, 1)), f.x), f.y);
}
vec3 tmObjN() {
  vec3 n = normalize(vec3(dot(vTmN, vTmX), dot(vTmN, vTmY), dot(vTmN, vTmZ)));
  #ifdef DOUBLE_SIDED
    n *= gl_FrontFacing ? 1.0 : -1.0;       // a roof sheet seen from below is its underside
  #endif
  return n;
}
// the sky-facing, rain-streaked, sun-bleached variation that makes the same instance look different from the next one
void tmMacro() {
  if (uTmB.x > 0.0) {
    float m = (tmN3(vTmP * 0.045) - 0.5) * 1.5 + (tmN3(vTmP * 0.31 + 7.0) - 0.5) * 0.7;      // about -1..1, 22 m and 3 m patches
    tmAlb *= (1.0 + uTmB.x * uTmG * m) * vec3(1.0 + 0.25 * uTmB.x * m, 1.0, 1.0 - 0.25 * uTmB.x * m);
    tmRoughK *= 1.0 - 0.6 * m * uTmB.x * uTmG;
  }
  if (uTmB.y > 0.0) {                                                                         // grime: soil and splash up the base of a wall (not on floors or roofs)
    float gh = exp(-clamp(vTmH, 0.0, 12.0) / 1.3) * (1.0 - smoothstep(0.5, 0.85, abs(vTmN.y)));
    tmAlb *= 1.0 - uTmB.y * uTmG * gh * (0.55 + 0.45 * tmN3(vTmP * vec3(2.6, 0.8, 2.6)));
  }
}
`;

// photo path: one dominant-axis tap (a second where two axes are close), object space, mip-mapped with explicit gradients
const FRAG_TEX = /* glsl */`
uniform sampler2D tmD, tmN;
struct TmT { vec3 d; vec3 g; float r; float ao; };
TmT tmTap(int ia, int ib, float sb, vec3 pO, vec3 dPx, vec3 dPy) {
  float k = 1.0 / uTmA.x;
  vec2 uv = vec2(pO[ia], sb * pO[ib]) * k, gx = vec2(dPx[ia], sb * dPx[ib]) * k, gy = vec2(dPy[ia], sb * dPy[ib]) * k;
  vec3 d = textureGrad(tmD, uv, gx, gy).rgb;
  vec4 n = textureGrad(tmN, uv, gx, gy);
  vec2 t = n.xy * 2.0 - 1.0;
  float tz = sqrt(max(1.0 - dot(t, t), 0.06));
  // texel footprint of a pixel (mip level): as a tile or plank drops under a few pixels its normal tilt fades and its sheen softens,
  // so a roof at 100+ m is a calm tone with no glitter and no moire
  vec2 ts = vec2(textureSize(tmN, 0)), gxt = gx * ts, gyt = gy * ts;
  float mip = 0.5 * log2(max(max(dot(gxt, gxt), dot(gyt, gyt)), 1.0));
  float nf = 1.0 - smoothstep(1.5, 4.0, mip);
  vec3 g = vec3(0.0); g[ia] = nf * t.x / tz; g[ib] = nf * sb * t.y / tz;     // the tilt of the normal, along the two world-aligned axes of this projection
  return TmT(d, g, n.z + 0.3 * smoothstep(1.5, 4.5, mip), n.w);
}
TmT tmTapAxis(int ax, vec3 pO, vec3 dPx, vec3 dPy) {
  int ia = ax == 0 ? 2 : 0, ib = ax == 1 ? 2 : 1;       // x faces: (z, y); y faces: (x, z); z faces: (x, y)
  return tmTap(ia, ib, 1.0, pO, dPx, dPy);
}
TmT tmMix(TmT a, TmT b, float k) { return TmT(mix(a.d, b.d, k), mix(a.g, b.g, k), mix(a.r, b.r, k), mix(a.ao, b.ao, k)); }
void tmSurface() {
  vec3 nO = tmObjN(), a = abs(nO), dPx = dFdx(vTmO), dPy = dFdy(vTmO);
  TmT t;
  // uTmF: x roof, y keep up-facing paint plain (kerbs share the lacquer), z flat faces only. Uniforms, not defines: one program serves every photo material
  if (uTmF.x > 0.5) {
    // a pitched (or flat) roof face: the courses run along the eave and v climbs toward the ridge. Anything steeper than a roof (the
    // sakura trunks and eave undersides share this material) keeps its plain colour: the mask below
    if (a.z >= a.x) t = tmTap(0, 2, nO.z >= 0.0 ? -1.0 : 1.0, vTmO, dPx, dPy);
    else t = tmTap(2, 0, nO.x >= 0.0 ? -1.0 : 1.0, vTmO, dPx, dPy);
  } else {
    float m = max(a.x, max(a.y, a.z));
    int i0 = a.x >= m ? 0 : (a.y >= m ? 1 : 2);
    t = tmTapAxis(i0, vTmO, dPx, dPy);
    // second axis, only on the oblique faces where two projections are close (columns, bevels)
    vec3 b = a; b[i0] = 0.0;
    float mb = max(b.x, max(b.y, b.z));
    float k = smoothstep(0.6, 1.0, mb / m) * 0.5;
    if (k > 0.0) {
      int i1 = b.x >= mb ? 0 : (b.y >= mb ? 1 : 2);
      t = tmMix(t, tmTapAxis(i1, vTmO, dPx, dPy), k);
    }
  }
  float g = uTmG;
  if (uTmF.x > 0.5) g *= smoothstep(0.15, 0.4, nO.y);
  g *= 1.0 - uTmF.y * smoothstep(0.5, 0.8, nO.y);        // kerbs share the lacquer: up-facing paint keeps its plain colour (racing readability)
  if (uTmF.z > 0.5) {
    float kap = length(dFdx(vTmN)) / max(length(dFdx(vTmP)), 1e-5);   // curvature: a tube (the sakura trunks share the roof material, ribs, ridge caps) is not a roof face
    g *= 1.0 - smoothstep(1.0, 3.0, kap);
  }
  vec3 W = vec3(0.2126, 0.7152, 0.0722);
  float lr = dot(t.d, W) / dot(uTmAvg.rgb, W);
  vec3 r = clamp(mix(vec3(lr), t.d / uTmAvg.rgb, 0.25), 0.3, 2.6);   // mostly tone, a little of the photo's colour (a timber's amber-to-brown, not a hue shift)
  tmAlb = mix(vec3(1.0), r, uTmA.z * g);
  tmRoughK = mix(1.0, clamp(t.r / uTmAvg.w, 0.5, 1.7), uTmA.w * g);
  tmAlb *= mix(1.0, clamp(t.ao / uTmB.w, 0.4, 1.15), uTmB.z * g);
  tmDelta = (vTmX * t.g.x + vTmY * t.g.y + vTmZ * t.g.z) * uTmA.y * g;
}
`;

// shoji: dark lattice (0.30 x 0.42 m panes, a wider rail every third row) over paper with fibre; at night the same mask shapes the
// emission, so a lit wall reads as warm glowing panes in a dark frame
const FRAG_SHOJI = /* glsl */`
void tmSurface() {
  vec3 nO = tmObjN();
  float u = abs(nO.x) > abs(nO.z) ? vTmO.z : vTmO.x, v = vTmO.y;       // along the wall, up
  vec2 cs = vec2(0.30, 0.42), q = vec2(u, v) / cs, cell = floor(q), f = fract(q);
  vec2 dm = min(f, 1.0 - f) * cs;                                         // metres to the nearest bar line
  float hwU = 0.011, hwV = mix(0.009, 0.020, 1.0 - step(0.5, mod(cell.y + (f.y > 0.5 ? 1.0 : 0.0), 3.0)));   // a wider rail on every third horizontal bar
  vec2 aa = max(fwidth(vec2(u, v)) * 0.8, 1e-4);
  float bu = 1.0 - smoothstep(hwU - aa.x, hwU + aa.x, dm.x), bv = 1.0 - smoothstep(hwV - aa.y, hwV + aa.y, dm.y);
  float fade = 1.0 - smoothstep(0.15, 0.4, max(fwidth(q.x), fwidth(q.y)));          // below ~3 px a pane: the average, not a moire
  float bar = max(bu, bv) * fade, g = uTmG;
  float pane = 0.88 + 0.24 * tmH2(cell + floor(vTmP.xz * 0.02));                   // each pane burns a little differently
  float fibre = (tmN2(vec2(u * 38.0, v * 7.0)) - 0.5) * (1.0 - smoothstep(0.15, 0.45, fwidth(u * 38.0)));
  float edge = mix(0.72, 1.0, smoothstep(0.012, 0.075, min(dm.x, dm.y)));            // light pools in the middle of a pane
  vec3 wood = vec3(0.22, 0.115, 0.063);
  vec3 paper = vec3(1.07) * (1.0 + 0.07 * fibre);
  tmAlb = mix(vec3(1.0), mix(paper * mix(1.0, pane, 0.5), wood, bar), g);
  tmEm = mix(1.0, mix(1.28 * pane * edge * (1.0 + 0.18 * fibre), 0.05, bar), g);       // 1.28: the bars and the pooled edges cost ~22% of a pane's mean, given back
  tmRoughK = 1.0;
}
`;

// metals and glass: streaks of roughness along the wall (brushed) or down it (rain runs), a trace of tone, pearl tint at grazing view
const FRAG_METAL = /* glsl */`
void tmSurface() {
  vec3 nO = tmObjN();
  float u = abs(nO.x) > abs(nO.z) ? vTmO.z : vTmO.x, v = vTmO.y;
  vec2 p = uTmB.w > 0.5 ? vec2(u, v) : vec2(v, u);                         // p.y runs along the streak
  vec2 fr = vec2(uTmA.x, uTmA.y);
  float fine = 1.0 - smoothstep(0.2, 0.5, fwidth(p.x * fr.y));
  float s = (tmN2(vec2(p.x * fr.y, p.y * fr.x)) - 0.5) * fine + (tmN2(vec2(p.x * fr.y * 0.23, p.y * fr.x * 0.5) + 9.0) - 0.5) * 0.6;
  float g = uTmG;
  tmRoughK = 1.0 + uTmA.w * g * 2.0 * s;
  tmAlb = vec3(1.0 + uTmA.z * g * 2.0 * s);
  if (uTmAvg.x > 0.0) {                                                     // pearl: a cool-to-warm shift with the view angle
    float fr2 = pow(1.0 - clamp(dot(normalize(cameraPosition - vTmP), normalize(vTmN)), 0.0, 1.0), 2.0);
    tmAlb *= 1.0 + uTmAvg.x * g * 0.5 * cos(6.2831 * (fr2 * 1.2 + vec3(0.0, 0.33, 0.67)));
  }
}
`;

// procedural stand-ins for the photo kinds (a set that failed to load, ?tmtex=0): rounded kawara courses, vertical planks with grain,
// plaster mottling, irregular stone blocks. Same outputs as the photo path, so a material can move between the two by its `set` alone.
const FRAG_PROC = /* glsl */`
void tmFrame(vec3 nO, out int ia, out int ib, out float sb) {
  vec3 a = abs(nO); sb = 1.0;
  #ifdef TM_P_ROOF
    if (nO.y > 0.35) {
      if (a.z >= a.x) { ia = 0; ib = 2; sb = nO.z >= 0.0 ? -1.0 : 1.0; } else { ia = 2; ib = 0; sb = nO.x >= 0.0 ? -1.0 : 1.0; }
      return;
    }
  #endif
  if (a.x > max(a.y, a.z)) { ia = 2; ib = 1; } else if (a.y > a.z) { ia = 0; ib = 2; } else { ia = 0; ib = 1; }
}
vec3 tmAxisW(int i) { return i == 0 ? vTmX : (i == 1 ? vTmY : vTmZ); }
// world-space tilt of the normal for a height h (metres), from screen derivatives (Mikkelsen's surface gradient)
vec3 tmBump(float h) {
  vec3 dpx = dFdx(vTmP), dpy = dFdy(vTmP), N = normalize(vTmN);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  return -sign(det) * (dFdx(h) * r1 + dFdy(h) * r2) / max(abs(det), 1e-9);
}
void tmSurface() {
  vec3 nO = tmObjN(); int ia, ib; float sb;
  tmFrame(nO, ia, ib, sb);
  vec2 p = vec2(vTmO[ia], sb * vTmO[ib]), fw = max(fwidth(p), vec2(1e-5));
  float g = uTmG, fade = 1.0, tone = 1.0, rk = 1.0;
  #ifdef TM_P_ROOF
    g *= smoothstep(0.15, 0.4, nO.y);
  #endif
  #ifdef TM_NOTOP
    g *= 1.0 - smoothstep(0.5, 0.8, nO.y);
  #endif
  #ifdef TM_FLAT
    { float kap = length(dFdx(vTmN)) / max(length(dFdx(vTmP)), 1e-5);   // curvature: a tube (the sakura trunks share the roof material, ribs, ridge caps) is not a roof face
      g *= 1.0 - smoothstep(1.0, 3.0, kap); }
  #endif
  vec3 tint = vec3(1.0);
  vec2 gr = vec2(0.0);                       // surface slope in (u, v), metres per metre (rows below), or a world tilt (bump)
  vec3 bump = vec3(0.0);
  #if defined(TM_P_ROOF)
    vec2 sz = vec2(0.30, 0.22), q = p / sz, c = floor(q), f = fract(q);
    fade = 1.0 - smoothstep(0.1, 0.38, max(fw.x / sz.x, fw.y / sz.y));
    float hu = sin(3.14159 * f.x), hv = 1.0 - f.y;       // a round tile; its lower lip stands proud and the next course tucks under
    gr = 0.028 * vec2(3.14159 * cos(3.14159 * f.x) * (0.65 + 0.35 * hv) / sz.x, -0.35 * hu / sz.y) * fade;
    float gap = smoothstep(0.80, 0.97, f.y) + 0.6 * (1.0 - smoothstep(0.0, 0.06, min(f.x, 1.0 - f.x)));
    tone = mix(1.0, (0.8 + 0.4 * tmH2(c)) * (1.0 - 0.55 * gap) * 1.1, fade);
    tint = mix(vec3(1.0), vec3(1.0 + 0.06 * (tmH2(c + 5.0) - 0.5), 1.0, 1.0 - 0.06 * (tmH2(c + 5.0) - 0.5)), fade);
    rk = mix(1.0, mix(1.3, 0.8, hu), fade);                // glazed: a sheen along each tile's crest
  #elif defined(TM_P_WOOD)
    float pw = 0.115, id = floor(p.x / pw), fx = fract(p.x / pw);
    fade = 1.0 - smoothstep(0.1, 0.38, fw.x / pw);
    float rings = 0.5 + 0.5 * sin(p.x * 70.0 + 5.0 * tmN2(vec2(p.x * 9.0 + id, p.y * 1.4 + id * 3.1)) + id * 2.3);
    float fib = tmN2(vec2(p.x * 160.0, p.y * 2.2 + id * 7.0));
    float seam = 1.0 - smoothstep(0.0, 0.06, min(fx, 1.0 - fx));
    tone = mix(1.0, (0.82 + 0.36 * tmH2(vec2(id, 3.7))) * (0.86 + 0.2 * rings) * (0.94 + 0.12 * fib) * (1.0 - 0.5 * seam) * 1.03, fade);
    rk = mix(1.0, 0.9 + 0.2 * fib, fade);
    bump = tmBump(-0.0015 * seam * fade + 0.0004 * rings * fade);
  #elif defined(TM_P_STONE)
    float row = floor(p.y / 0.34), fy = fract(p.y / 0.34);
    float bw = 0.5 + 0.55 * tmH2(vec2(row, 1.3)), u = p.x / bw + 3.7 * tmH2(vec2(row, 5.1));
    vec2 c = vec2(floor(u), row), f = vec2(fract(u), fy);
    fade = 1.0 - smoothstep(0.1, 0.38, max(fw.x / bw, fw.y / 0.34));
    float mortar = 1.0 - smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x) * bw / 0.34, min(f.y, 1.0 - f.y)));
    float surf = tmN3(vTmP * 14.0);
    tone = mix(1.0, (0.75 + 0.5 * tmH2(c + 2.0)) * (1.0 - 0.6 * mortar) * (0.92 + 0.16 * surf) * 1.07, fade);
    rk = mix(1.0, 1.0 + 0.25 * mortar, fade);
    bump = tmBump((-0.012 * mortar + 0.004 * surf) * fade);
  #else   // plaster and concrete: mottling over a fine grain
    float mot = tmN3(vTmP * 3.1) * 0.6 + tmN3(vTmP * 11.0 + 3.0) * 0.4, grain = tmN3(vTmP * 47.0);
    fade = 1.0 - smoothstep(0.1, 0.4, length(fw) * 47.0);
    tone = mix(1.0, 0.88 + 0.24 * mot, 1.0) * mix(1.0, 0.94 + 0.12 * grain, fade);
    rk = 0.9 + 0.2 * grain * fade;
    bump = tmBump(0.0015 * (grain - 0.5) * fade + 0.003 * (mot - 0.5));
  #endif
  vec3 dW = vec3(0.0);
  #if defined(TM_P_ROOF)
    dW = -(gr.x * tmAxisW(ia) + gr.y * sb * tmAxisW(ib));
  #endif
  tmAlb = mix(vec3(1.0), tone * tint, uTmA.z * g);
  tmRoughK = mix(1.0, rk, uTmA.w * g);
  tmDelta = (dW + bump) * uTmA.y * g;
}
`;

const FRAG_NONE = 'void tmSurface() {}\n';

function patch(m, kind, defs, frag, uniforms, tex) {
  const prevCompile = m.onBeforeCompile;
  const baseKey = m.customProgramCacheKey();            // the previous program key (wetify's 'wet', M_Fence's 'fence-soft', or the default)
  const key = baseKey + '|tm:' + kind + defs.join('');
  m.userData.tmPrev = { onBeforeCompile: prevCompile, customProgramCacheKey: m.customProgramCacheKey, baseKey };
  m.onBeforeCompile = (shader, renderer) => {
    prevCompile.call(m, shader, renderer);              // wetify etc. first
    Object.assign(shader.uniforms, uniforms);
    if (tex) { shader.uniforms.tmD = { value: tex.d }; shader.uniforms.tmN = { value: tex.n }; }
    const head = defs.map((d) => '#define ' + d + '\n').join('');
    shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + VERT_BODY);
    let fs = shader.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n  tmSurface(); tmMacro();\n  diffuseColor.rgb *= tmAlb;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor * tmRoughK, 0.04, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = normalize(normal + (viewMatrix * vec4(tmDelta, 0.0)).xyz);');
    if (defs.includes('TM_SHOJI')) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= tmEm;');
    shader.fragmentShader = head + FRAG_COMMON + frag + fs;
  };
  m.customProgramCacheKey = () => key;
  m.userData.tmOn = { onBeforeCompile: m.onBeforeCompile, customProgramCacheKey: m.customProgramCacheKey };
  m.needsUpdate = true;
}

async function loadSets(renderer, shared) {
  const manifest = await fetch(TEX + 'manifest.json').then((r) => (r.ok && /json/.test(r.headers.get('content-type') ?? '') ? r.json() : null)).catch(() => null);
  if (!manifest) return {};
  const loader = shared ?? new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);   // the venue's: its transcoder workers are up
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const out = {};
  const load = Promise.all(SETS.map(async (slug) => {
    try {
      const [d, n] = await Promise.all([loader.loadAsync(`${TEX}${slug}_d.ktx2`), loader.loadAsync(`${TEX}${slug}_n.ktx2`)]);
      for (const t of [d, n]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; }
      out[slug] = { d, n, ...manifest[slug] };
    } catch (e) { console.warn('tokyo materials: texture set', slug, 'unavailable, procedural fallback:', e?.message ?? e); }
  }));
  await Promise.race([load, new Promise((r) => setTimeout(r, 20000))]);   // never hold the venue for textures: what has loaded by then is used
  if (!shared) loader.dispose();
  return out;
}

let early = null;   // prefetch(): the photo sets start loading while main.js is still fetching and parsing the venue GLB
export function prefetch(ctx) {
  const q = new URLSearchParams(location.search);
  if (q.get('tmat') !== '0' && q.get('tmtex') !== '0') early ??= loadSets(ctx.renderer, ctx.ktx2);
}

export async function create(ctx) {
  const q = new URLSearchParams(location.search);
  if (q.get('tmat') === '0') return { dispose() {} };
  const t0 = performance.now();
  const sets = q.get('tmtex') === '0' ? {} : await (early ?? loadSets(ctx.renderer, ctx.ktx2));
  early = null;
  // the sakura trunks and branches share `V10 tile` with the roofs: in a mesh that also carries petals or leaves, that slot gets a plain clone
  const plain = new Map();
  ctx.root?.traverse((o) => {
    if (!o.isMesh || !Array.isArray(o.material) || !o.material.some((m) => /^V3 (petal|leaf)/.test(m.name))) return;
    o.material = o.material.map((m) => {
      if (m.name !== 'V10 tile') return m;
      if (!plain.has(m)) { const c = m.clone(); c.userData.tmSkip = true; plain.set(m, c); }
      return plain.get(m);
    });
  });
  const gain = { value: 1 }, glow = [];
  let on = true;
  const patched = [];
  const stats = {};
  for (const m of ctx.allMats) {
    const e = ENTRIES.find((x) => x.re.test(m.name));
    if (!e || m.userData.tmPrev) continue;
    if (m.userData.tmSkip) continue;
    const set = e.kind === 'tex' ? sets[e.set] : null;
    const u = { uTmG: gain, uTmA: { value: new THREE.Vector4(1, 1, 1, 1) }, uTmB: { value: new THREE.Vector4(e.macro ?? 0.1, e.grime ?? 0, e.ao ?? 0, 1) }, uTmAvg: { value: new THREE.Vector4(1, 1, 1, 1) }, uTmF: { value: new THREE.Vector4(e.roof ? 1 : 0, e.noTop ? 1 : 0, e.flat ? 1 : 0, 0) } };
    let frag, defs = [], kind = e.kind;
    if (e.kind === 'tex' && set) {
      u.uTmA.value.set(e.scale, e.nrm, e.alb, e.rough);
      u.uTmAvg.value.set(...set.avg, set.rough); u.uTmB.value.w = set.ao;
      frag = FRAG_TEX; defs = ['TM_TEX']; kind = 'tex';
    } else if (e.kind === 'shoji') {
      frag = FRAG_SHOJI; defs = ['TM_SHOJI']; kind = 'shoji';
      if (e.glow) glow.push({ m, k: e.glow - 1, on: 0, off: 0 });
    } else if (e.kind === 'metal') {
      u.uTmA.value.set(e.streak[0], e.streak[1], e.alb, e.rough); u.uTmAvg.value.x = e.pearl ?? 0; u.uTmB.value.w = e.vertical ?? 0;
      frag = FRAG_METAL; defs = ['TM_METAL']; kind = 'metal';
    } else if (e.kind === 'tex') {
      u.uTmA.value.set(1, e.nrm, e.alb, e.rough); frag = FRAG_PROC; defs = ['TM_P_' + e.proc.toUpperCase()].concat(e.noTop ? ['TM_NOTOP'] : [], e.flat ? ['TM_FLAT'] : []); kind = 'proc-' + e.proc;
    } else { frag = FRAG_NONE; defs = ['TM_NONE']; kind = 'none'; }
    patch(m, kind, defs, frag, u, set);
    patched.push(m); stats[m.name] = set ? e.set : e.kind;
  }
  console.info(`tokyo materials: ${patched.length} materials, ${Object.keys(sets).length}/${SETS.length} photo sets, ${(performance.now() - t0).toFixed(0)} ms`, stats);
  // dev: window.__tokyoMat.set(false) turns the whole effect off (the shoji glow too), set(true) on: an A/B in one session (QA)
  const set = (v) => { on = v; gain.value = v ? 1 : 0; for (const g of glow) g.m.emissiveIntensity = v ? g.on : g.off; };
  // shaders(false) puts the original programs back (the frame-time A/B in QA), shaders(true) the patched ones
  const shaders = (v) => { for (const m of patched) { const p = v ? m.userData.tmOn : m.userData.tmPrev; m.onBeforeCompile = p.onBeforeCompile; m.customProgramCacheKey = p.customProgramCacheKey; m.needsUpdate = true; } };
  if (import.meta.env?.DEV) globalThis.__tokyoMat = { gain, patched, sets, set, shaders };
  return {
    setLook(look, params) {
      for (const g of glow) { g.off = g.m.emissiveIntensity; g.on = g.off * (1 + g.k * (LIT[params?.look] ?? 1)); g.m.emissiveIntensity = on ? g.on : g.off; }
    },
    dispose() {
      for (const m of patched) {
        const p = m.userData.tmPrev; if (!p) continue;
        m.onBeforeCompile = p.onBeforeCompile; m.customProgramCacheKey = p.customProgramCacheKey; delete m.userData.tmPrev; m.needsUpdate = true;
      }
      for (const s of Object.values(sets)) { s.d.dispose(); s.n.dispose(); }
    },
  };
}
