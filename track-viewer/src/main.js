import { InputDebug } from './game/input-debug.js';
import { runModelBenchmark } from './model-benchmark.js';
// Corniche Marina track viewer: loads the Blender-built track and shows it the way the game will, with every
// engine-side effect on a switch. WebGL2 + EffectComposer (three r186) so it runs everywhere; the game can move the
// same ideas to WebGPU/TSL later.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import * as life from './life.js';
import * as people from './people.js';
import { Glows, dimLampMeshes } from './glow.js';
import { Sky } from './sky.js';
import { Field, assemble } from './cars.js';
import { dressTeams } from './teamdress.js';
import { Trails } from './trails.js';
import { CarFx } from './carkit/fx.js';
import { PhysicsWorld } from './physics/world.js';
import { Game } from './game/game.js';
import { store } from './game/store.js';
import { trackOf, trackUrl, optionalJson } from './tracks.js';
import { GarageRoom } from './garage-room.js';
import { DriverHoardings } from './driver-hoardings.js';
import { FINISH_RAIN, FINISH_FLOW, FINISH_SPARK, applyRainGlass } from './finish.js';
import { wetUniforms, wetify, wetCars } from './wet-road.js';
import { makeRain } from './wet-rain.js';
import { TIERS, detectTier, GpuTimer, Culler, DynamicResolution } from './perf.js';

const DEV_QUERY = new URLSearchParams(location.search);
const A = '/assets/';
// the circuit (src/tracks.js): the menu's choice, or ?track= on the developer viewer. An unknown id is Marina.
let TRACK = trackOf(DEV_QUERY.get('dev') === '1' ? DEV_QUERY.get('track') : store.settings.track);
const U = (what) => trackUrl(TRACK, what, TEX);
const LOOKS = {
  // midday, clear sky: the sun is high and hard, the sky is the light (env), no lamp is on; LEDs and screens stay, dimmed.
  // sunEl/skyEl: elevation (deg) of the sun light and of the visible sun (default: the low dusk sun); lamps: the cars' lamp
  // mode; hl: floor of the dev headlight (0 = off); glow: lamp-sprite gain (default follows `lights`); hdriClamp: cap on the
  // HDRI's sun disc (it is clipped at 65504 and would turn the paint's reflection into a white blot)
  // Sun tone (2026-10-30, after Project Endurance's restraint): flare, sun haze (fogSun), glint and sun bloom at ~40 % of
  // their old values; less hard sun and a little more sky light by day, so shade reads the sky and highlights stay soft.
  day: { hdri: 'qwantani_noon_puresky_2k.hdr', env: 1.0, bg: 0.85, exposure: 1.3, tm: 'Neutral', bloomGain: 0.22, bloomThr: 1.8, fog: 0xb4c8dc, fogDensity: 0.00045, emissive: 0.2, lights: 0.0, sun: 3.6, sunColor: 0xfff1de, trails: 0.1,
    dn: 0, hdriRot: 2.82, fogSun: [0.04, 0.036, 0.028], flare: 0.1, glint: [0.75, 0.73, 0.66], sunEl: 50, skyEl: 49.8, lamps: 'running', hl: 0, glow: 0, hdriClamp: 24, steam: 0.2, steamCap: 0.55,
    grade: { s: 0.3, black: 0.012, shadows: [0.93, 0.97, 1.05], highs: [1.03, 1.0, 0.95], sat: 1.06 } },
  dusk: { dn: 0.35, lamps: 'running', hdri: 'belfast_sunset_puresky_2k.hdr', env: 0.85, bg: 0.42, exposure: 0.42, tm: 'Neutral', bloomGain: 0.35, bloomThr: 2.1, fog: 0x4a4658, fogDensity: 0.001, emissive: 0.5, lights: 0.0, sun: 2.0, sunColor: 0xffb27a, trails: 0.35,
    hdriRot: 2.88, fogSun: [0.17, 0.092, 0.044], flare: 0.38, glint: [2.4, 1.36, 0.6], hdriClamp: 24,
    grade: { s: 0.55, black: 0.03, shadows: [0.84, 0.93, 1.12], highs: [1.08, 1.0, 0.86], sat: 1.12 } },
  bluehour: { dn: 0.7, hdri: 'qwantani_dusk_1_puresky_2k.hdr', env: 0.22, bg: 0.3, exposure: 1.1, tm: 'AgX', fog: 0x26324a, fogDensity: 0.0009, emissive: 1.0, lights: 0.6, sun: 0.35, sunColor: 0x9fb6ff, trails: 0.9,
    hdriRot: 3.17, fogSun: [0.09, 0.065, 0.065], flare: 0.1, glint: [0.2, 0.18, 0.22],
    grade: { s: 0.4, black: 0.02, shadows: [0.86, 0.95, 1.14], highs: [1.06, 1.0, 0.9], sat: 1.06 } },
  night: { dn: 1, hdri: 'qwantani_night_puresky_2k.hdr', env: 0.035, bg: 0.035, exposure: 1.25, tm: 'AgX', fog: 0x0a0f1a, fogDensity: 0.0012, emissive: 1.4, lights: 1.0, sun: 0.12, sunColor: 0x8ea4d6, trails: 1.3,
    hdriRot: 0, fogSun: [0, 0, 0], flare: 0, glint: [0, 0, 0],
    grade: { s: 0.4, black: 0.015, shadows: [0.86, 0.96, 1.14], highs: [1.1, 1.0, 0.86], sat: 1.08 } },
};
// steam / steamCap: exhaust steam density (1) and the ceiling of its sunlit brightness (none): steam hardly shows on a warm sunny day.
// A track's `looks` (tracks.js) override these per look; setTrack re-merges them over the base table.
const BASE_LOOKS = structuredClone(LOOKS);
function mergeLooks() {
  for (const k in LOOKS) { const o = TRACK.looks?.[k] ?? {}; for (const p in LOOKS[k]) delete LOOKS[k][p]; Object.assign(LOOKS[k], structuredClone(BASE_LOOKS[k]), o, { grade: { ...BASE_LOOKS[k].grade, ...o.grade } }); }
}
mergeLooks();
// tm: tone mapping. Neutral keeps saturated paint red at dusk (AgX turned it salmon); AgX's highlight roll-off keeps
// the floodlights from clipping to white blocks after dark.
// hdriRot turns each HDRI so its own sun (or afterglow) sits on SUN_DIR's bearing: one sun, not two.
// fogSun: haze lit by the sun, added toward it (golden backlight through the air). grade: S-curve, black point,
// split tone (shadow / highlight multipliers) and saturation, in display space after tone mapping.

// Sun-lit haze: every built-in material's fog gets a forward-scatter term toward the sun, in world space, so it is
// also right in the wet-road mirror and the car reflection captures. Shared arrays: uniform clones keep the reference.
const FOG_SUN = { dir: new Float32Array(3), color: new Float32Array(3) };
for (const k in THREE.ShaderLib) {
  const u = THREE.ShaderLib[k].uniforms;
  if (u?.fogColor) Object.assign(u, { uFogSunDir: { value: FOG_SUN.dir }, uFogSunColor: { value: FOG_SUN.color } });
}
THREE.ShaderChunk.fog_pars_vertex += '\n#ifdef USE_FOG\nvarying vec3 vFogRay;\n#endif\n';   // three's chunks end without a newline
THREE.ShaderChunk.fog_vertex += '\n#ifdef USE_FOG\nvFogRay = mvPosition.xyz * mat3(viewMatrix);\n#endif\n';   // the view ray in world space
THREE.ShaderChunk.fog_pars_fragment += '\n#ifdef USE_FOG\nvarying vec3 vFogRay;\nuniform vec3 uFogSunDir, uFogSunColor;\n#endif\n';
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace('mix( gl_FragColor.rgb, fogColor, fogFactor )',
  'mix( gl_FragColor.rgb, fogColor + uFogSunColor * ( pow( max( dot( normalize( vFogRay ), uFogSunDir ), 0.0 ), 8.0 ) + 0.05 * pow( max( dot( normalize( vFogRay ), uFogSunDir ), 0.0 ), 2.0 ) ), fogFactor )');
// surfaces that go glossy in the rain and pick up the planar reflection
const PUDDLES = ['M_Asphalt', 'M_PitLane', 'M_RunoffTarmac', 'M_AsphaltPatch', 'M_PaintTeal', 'M_PaintBlue'];   // tarmac only
const NO_CAST = /^(track_|ground|water|far_shore|skyline|asphalt_|skid_|apron_|pit_lane|paddock_floor|quay|sf_line|grid_|box_|pit_limiter)/;
const WET = ['M_Asphalt', 'M_PaintTeal', 'M_PaintBlue', 'M_Kerb', 'M_LinePaint', 'M_PitLane', 'M_Verge', 'M_RunoffTarmac', 'M_Turf',
  'M_AsphaltPatch', 'M_Paved', 'M_SkidMarks', 'M_Cracks'];

const params = {
  look: 'dusk',
  emissive: 1.0, venueLights: 1.0, headlight: true,
  wet: 0.7, mirror: true, mirrorRes: 0.5, rain: 0.45, fog: 0.5,
  bloom: true, bloomStrength: 0.45, bloomRadius: 0.45, bloomThreshold: 1.4,
  speedBlur: 1.0, aberration: 0.35, vignette: 0.45, grain: 0.05, grade: 1.0, flare: 1.0, smaa: true,
  toneMapping: 'auto', exposure: 1.0,
  mode: 'chase', speedKmh: 180, camHeight: 1.25, lateral: 0.0, jump: 'start/finish', paused: false,
  shadows: true, ao: true, aoIntensity: 1.0,
  renderScale: 1.0, fpsCap: 60,
  quality: 'auto', dynamicRes: true, cull: true, cullDistance: 280,
  cars: true, pace: 1.0,
  reduceMotion: false,     // camera shake, roll and most of the FOV changes off (motion-sickness setting)
  player: true,            // you drive the hero car (off: the AI drives it, for benchmarks and flythroughs)
};
// Render-pass savings (the perf job). All on in the game; viewer.perf.<name> = false (console, scripts/perf-passes.mjs --compare, perf-ab.mjs)
// draws the frame the old way, so each can be timed and compared pixel by pixel.
//   noTransmission  transmissive glass (the cars' light covers, Tokyo's gondolas) is drawn as alpha glass in the world: see worldGlass. Any
//                   transmissive material in view makes three draw the whole opaque scene again into a full-size 4x target, the road mirror with it
//   mirrorOnce      the road mirror is drawn for the frame, not again for the transmission pass's copy of the scene
//   mirrorSkip      no road-mirror render while the road is too dry for it to show: see mirrorWanted
//   idleLights      a look with no venue lamp lit (day, dusk) hides the lamp pool: its 16 lights sit at intensity 0, which three still runs in every lit fragment
// ?perf=off (or ?perf=mirrorOnce,mirrorSkip) starts the page with those savings off, to compare whole sessions with the old pipeline.
const PERF_OFF = (DEV_QUERY.get('perf') ?? '').split(','), saving = (name) => !PERF_OFF.includes('off') && !PERF_OFF.includes(name);
const PERF = { noTransmission: saving('noTransmission'), mirrorOnce: saving('mirrorOnce'), mirrorSkip: saving('mirrorSkip'), idleLights: saving('idleLights') };
const MIRROR_DRY = 0.2;
// ?tex=webp loads the WebP build; the default is KTX2 (GPU-compressed textures, a fraction of the VRAM)
const TEX = DEV_QUERY.get('tex') === 'webp' ? 'webp' : 'ktx2';
// the game (src/game: menus, garage, HUD, sessions) runs by default; ?dev=1 is the bare viewer with its tuning panel
const DEV = DEV_QUERY.get('dev') === '1';
let game = null, benchmarking=false;
const inputDebug=DEV?new InputDebug(document.body):null;

// ------------------------------------------------------------------------------------------------ renderer & scene

const app = document.getElementById('app');
const hud = document.getElementById('hud');
const loading = document.getElementById('loading');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const driverHoardings=new DriverHoardings(scene);
// the scene graph (thousands of venue objects plus every character's bones) is updated once per frame in tick, not
// again inside each of the 5-6 render passes (main, mirror, GTAO, shadows), which is what three does by default
scene.matrixWorldAutoUpdate = false;
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 9000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;
const pmrem = new THREE.PMREMGenerator(renderer);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// GTAO: contact shading under walls, barriers, stands and props. Rain and the mirror plane are hidden during its
// depth/normal pass (they are not surfaces to occlude), and the radius stays small so alpha-cut fences only darken their feet.
const gtao = new GTAOPass(scene, camera, 512, 512);
gtao.output = GTAOPass.OUTPUT.Default;
gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.0, scale: 1.0, samples: 8 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
const gtaoSize = gtao.setSize.bind(gtao);
gtao.setSize = (w, h) => gtaoSize(Math.ceil(w / 2), Math.ceil(h / 2));   // half resolution: AO is soft, its depth/normal pass costs fill
const gtaoRender = gtao.render.bind(gtao);
gtao.render = (...args) => {
  const rainOn = rain.visible, mirrorOn = reflector?.visible, peopleOn = people.group.visible;
  rain.visible = false;
  people.group.visible = false;      // AO under 200 skinned people costs more than it shows
  // cars too: ~35 draws each in another full pass, and their contact shadow already grounds them
  const carsShown = (field?.all ?? []).filter((c) => c.root.visible);
  carsShown.forEach((c) => { c.root.visible = false; });
  const trailsOn = trails?.mesh.visible; if (trails) trails.mesh.visible = false;   // additive ribbons are not surfaces
  if (reflector) reflector.visible = false;
  gtaoRender(...args);
  carsShown.forEach((c) => { c.root.visible = true; });
  if (trails) trails.mesh.visible = trailsOn;
  rain.visible = rainOn;
  people.group.visible = peopleOn;
  if (reflector) reflector.visible = mirrorOn;
};
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), params.bloomStrength, params.bloomRadius, params.bloomThreshold);
// cap what one pixel feeds the bloom: the sky beside a low sun is ~40x the threshold and veiled the whole frame
bloom.materialHighPassFilter.fragmentShader = bloom.materialHighPassFilter.fragmentShader.replace(
  'gl_FragColor = mix( outputColor, texel, alpha );', 'gl_FragColor = mix( outputColor, vec4( texel.rgb * min( 1.0, 3.0 / max( v, 1e-4 ) ), texel.a ), alpha );');
bloom.materialHighPassFilter.needsUpdate = true;
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uBlur: { value: 0 }, uCA: { value: 0 }, uVig: { value: 0 }, uGrain: { value: 0 },
    uGrade: { value: 0 }, uTime: { value: 0 }, uS: { value: 0 }, uBlack: { value: 0 }, uSat: { value: 1 },
    uShadows: { value: new THREE.Vector3(1, 1, 1) }, uHighs: { value: new THREE.Vector3(1, 1, 1) },
    uSun: { value: new THREE.Vector3() }, uFlare: { value: 0 }, uAspect: { value: 1 },
    uBlurC: { value: new THREE.Vector2(0.5, 0.5) }, uPhase: { value: 0 }, uNitro: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uBlur, uCA, uVig, uGrain, uGrade, uTime, uS, uBlack, uSat, uFlare, uAspect, uPhase, uNitro;
    uniform vec3 uShadows, uHighs, uSun; uniform vec2 uBlurC; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    vec3 spectrum(float x) { return clamp(0.5 + 0.5 * cos(6.2832 * (x + vec3(0.0, 0.33, 0.67))), 0.0, 1.0); }
    // lens flare from the sun: starburst, a thin anamorphic streak, ghosts mirrored through the centre and a faint
    // rainbow halo. Visibility is read from the frame itself: the sun's pixels are near white unless something covers it.
    vec3 flare(vec2 uv) {
      if (uSun.z <= 0.0 || uFlare <= 0.0) return vec3(0.0);
      float vis = 0.0;
      for (int i = 0; i < 5; i++) {
        vec2 o = vec2(float(i == 1) - float(i == 2), float(i == 3) - float(i == 4)) * 0.006;
        vis += smoothstep(0.85, 0.98, luma(texture2D(tDiffuse, uSun.xy + o).rgb));   // the clipped disc only: a sunlit wall over the sun fired it at .72
      }
      vis *= 0.2 * uSun.z * uFlare;
      if (vis <= 0.001) return vec3(0.0);
      vec2 a = vec2(uAspect, 1.0), p = (uv - uSun.xy) * a;
      float d = length(p), ang = atan(p.y, p.x);
      vec3 warm = vec3(1.0, 0.78, 0.5);
      float rays = pow(abs(cos(ang * 6.0 + 0.4)), 40.0) + 0.6 * pow(abs(cos(ang * 9.0 + 1.3)), 70.0);
      // on nitro the starburst and the anamorphic streak lengthen and brighten (to the same reach as before the sun-tone pass;
      // cruising, the rays, core and streak are ~2/3 as long: a small sun star, not a burst across the frame)
      vec3 f = warm * (rays * exp(-d * (15.0 - 9.5 * uNitro)) * (0.32 + 0.3 * uNitro) + exp(-d * 24.0) * 0.22 + exp(-abs(p.y) * (220.0 - 80.0 * uNitro)) * exp(-abs(p.x) * (5.0 - 3.1 * uNitro)) * (0.14 + 0.16 * uNitro));
      vec2 axis = 0.5 - uSun.xy;
      float off = smoothstep(0.05, 0.3, length(axis * a));    // ghosts and halo only when the sun is off-centre
      for (int i = 0; i < 4; i++) {
        float k = float(i);
        vec2 gc = uSun.xy + axis * (1.35 + k * 0.42);
        float r = 0.035 + 0.03 * mod(k * 1.7, 2.0), gd = length((uv - gc) * a);
        f += spectrum(0.15 + k * 0.23) * smoothstep(r, r * 0.6, gd) * 0.035 * off;
      }
      float hd = length((uv - (uSun.xy + axis * 1.1)) * a);
      f += spectrum((hd - 0.42) / 0.06 + 0.5) * smoothstep(0.03, 0.0, abs(hd - 0.42)) * 0.045 * off;
      return f * vis;
    }
    void main() {
      vec2 c = vUv - 0.5; float r = length(c);
      vec2 d = c * (uCA * 0.012 + uNitro * 0.05 * r * r);   // chromatic aberration (nitro: strong fringes toward the edges)
      vec3 col = vec3(texture2D(tDiffuse, vUv + d).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d).b);
      // speed blur (after Project Endurance): streaks toward the point the car is heading for (uBlurC), clear around
      // the car (the clear zone stretches downward, where the car sits), colour-fringed along each streak (red
      // trailing, blue leading), jittered taps; plus a few faint speed lines racing outward at the edges
      vec2 bg = vUv - uBlurC;
      // nitro (uNitro 0..1): the zoom blur reaches further and starts closer to the car, with more taps; soft white speed
      // lines stream outward in two layers (smooth scrolls, no flicker); violet tint toward the edges
      float dd = length(bg * vec2(uAspect, bg.y < 0.0 ? 0.45 : 1.0)), edge = smoothstep(0.2 - 0.1 * uNitro, 0.7 - 0.08 * uNitro, dd), T = uBlur * edge * (1.0 + 0.15 * uNitro);   // nitro blur peak 0.6x of 0.23 * 1.25 (taps/edge/lines unchanged)
      if (T > 0.002) {
        float jit = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 64.0);
        vec3 m = vec3(0.0); float N = 8.0 + 4.0 * uNitro;
        for (int i = 0; i < 12; i++) {
          if (float(i) >= N) break;
          float j = (float(i) + jit) / N;
          m += texture2D(tDiffuse, vUv - bg * 0.15 * T * j).rgb * vec3(1.0 - j, 1.0 - abs(2.0 * j - 1.0), j);
        }
        col = mix(col, m / (N * 0.5), smoothstep(0.0, 0.2, T));
        float a = atan(bg.y, bg.x * uAspect) / 6.2832 * 96.0, k = hash(vec2(floor(a), 3.1)), fa = fract(a);
        float z = fract(length(bg * vec2(uAspect, 1.0)) * 1.4 - uPhase * (k + 0.6) + k * 7.0);
        col += vec3(0.75, 0.9, 1.0) * smoothstep(0.42, 0.5, fa) * smoothstep(0.58, 0.5, fa) * smoothstep(0.0, 0.08, z) * smoothstep(0.45, 0.1, z)
             * smoothstep(0.8, 0.95, k) * edge * edge * smoothstep(0.2, 0.9, uBlur) * 0.3;
        if (uNitro > 0.01) for (int L = 0; L < 2; L++) {
          float fl = float(L), a2 = atan(bg.y, bg.x * uAspect) / 6.2832 * (72.0 + 58.0 * fl) + fl * 17.0, k2 = hash(vec2(floor(a2), 7.7 + fl)), f2 = fract(a2);
          float z2 = fract(length(bg * vec2(uAspect, 1.0)) * (1.1 + 0.6 * fl) - uPhase * (k2 + 0.7) * (1.0 + 0.3 * fl) + k2 * 9.0);
          float ln = exp(-pow((f2 - 0.5) * (5.4 + 2.6 * fl), 2.0)) * smoothstep(0.0, 0.1, z2) * smoothstep(0.55, 0.12, z2);
          float gate = 1.0 - (0.55 - 0.2 * fl) * uNitro;
          col += vec3(1.0, 0.95, 1.0) * ln * smoothstep(gate - 0.06, gate, k2) * edge * edge * uNitro * (0.4 - 0.12 * fl);
        }
      }
      vec3 g = clamp(col * mix(uShadows, uHighs, smoothstep(0.05, 0.75, luma(col))), 0.0, 1.0);   // split tone
      g = mix(g, g * g * (3.0 - 2.0 * g), uS);                                    // S-curve: deeper shadows, brighter mids
      g = max(g - uBlack, 0.0) / (1.0 - uBlack);                                  // black point: no milky lift
      g = mix(vec3(luma(g)), g, uSat);
      col = mix(col, g, uGrade);
      col += flare(vUv);
      col *= mix(1.0, smoothstep(0.85, 0.22, r), uVig);
      col = mix(col, col * vec3(0.9, 0.84, 1.12) + vec3(0.03, 0.0, 0.07), uNitro * smoothstep(0.3, 0.85, r) * 0.55);
      col += (hash(vUv * vec2(1931.0, 1087.0) + fract(uTime)) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(finalPass);
const smaa = new SMAAPass();
composer.addPass(smaa);

// ------------------------------------------------------------------------------------------------ wet road: planar mirror

// wetUniforms (the planar mirror and weather the road shaders read): wet-road.js
let reflector = null;
// The mirror is the second-costliest render of the frame and it only shows on a wet road: the road shader adds reflection x fresnel x wet x
// (1 - smoothstep(.12, .6, roughness)), so at the game's Dry (wet .15) only a near-polished surface shows it (a little neon on glossy paint):
// below MIRROR_DRY it is not drawn. (It also gates the sun glint on the road; with the mirror off the glint is not occluded, a few levels at most.)
function mirrorWanted() { return params.mirror && params.wet > (PERF.mirrorSkip ? MIRROR_DRY : 0); }
function makeReflector() {
  if (reflector) { scene.remove(reflector); reflector.getRenderTarget().dispose(); }
  const size = renderer.getDrawingBufferSize(new THREE.Vector2()).multiplyScalar(params.mirrorRes);
  // a mirror at road height: it renders the scene from below once per frame; the road shaders sample it
  reflector = new Reflector(new THREE.PlaneGeometry(12000, 12000), {
    textureWidth: Math.max(64, Math.floor(size.x)), textureHeight: Math.max(64, Math.floor(size.y)), clipBias: 0.003, multisample: 0,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.getReflectionCamera(camera).layers.set(0);       // the mirror skips layer NO_MIRROR (see load)
  reflector.position.y = 0.0;
  reflector.material.colorWrite = false;   // draws nothing itself; only its render target matters
  reflector.material.depthWrite = false;
  reflector.renderOrder = -1;
  reflector.visible = mirrorWanted();
  const tex = reflector.getRenderTarget().texture;
  wetUniforms.tReflection.value = tex;
  // while the mirror renders, the road must not sample the very texture being drawn (a WebGL feedback loop)
  const renderMirror = reflector.onBeforeRender;
  reflector.onBeforeRender = function (...args) {
    // the transmission pass draws the opaque list into its own target first: the road mirror is part of that list but nothing there needs it
    const rt = args[0].getRenderTarget();
    if (PERF.mirrorOnce && rt && rt !== composer.renderTarget1 && rt !== composer.renderTarget2) return;
    wetUniforms.tReflection.value = null;
    const peopleOn = people.group.visible;
    people.group.visible = false;    // the wet road doesn't need to mirror every spectator
    // nor cars beyond 80 m: a few blurred pixels each, ~35 draw calls each
    const cam = args[2], far = (field?.all ?? []).filter((c) => c.root.visible && c.root.position.distanceTo(cam.position) > 80);
    far.forEach((c) => { c.root.visible = false; });
    renderMirror.apply(this, args);
    far.forEach((c) => { c.root.visible = true; });
    people.group.visible = peopleOn;
    wetUniforms.tReflection.value = tex;
  };
  scene.add(reflector);
}

// wet surfaces (puddles, ripples, sheen): wet-road.js

// ------------------------------------------------------------------------------------------------ rain (GPU, wraps around the camera)

// rain in the air: wet-rain.js
const rain = makeRain();
scene.add(rain);

// ------------------------------------------------------------------------------------------------ lights: a small pool that follows the camera

const pool = { flood: [], stand: [], street: [] };
for (let i = 0; i < 6; i++) { const s = new THREE.SpotLight(0xfff1dc, 0, 140, Math.PI * 0.3, 0.6, 2); scene.add(s, s.target); pool.flood.push(s); }
for (let i = 0; i < 4; i++) { const s = new THREE.SpotLight(0xfff4e6, 0, 90, Math.PI * 0.33, 0.7, 2); scene.add(s, s.target); pool.stand.push(s); }
for (let i = 0; i < 6; i++) { const p = new THREE.PointLight(0xffc68a, 0, 30, 2); scene.add(p); pool.street.push(p); }
const headlight = new THREE.SpotLight(0xeef4ff, 0, 180, 0.32, 0.6, 2);
headlight.castShadow = true;
headlight.shadow.mapSize.set(512, 512);   // it only covers 60 m
Object.assign(headlight.shadow.camera, { near: 0.5, far: 90 });
headlight.shadow.bias = -0.0004;
const sun = new THREE.DirectionalLight(0xffffff, 0);
// the sun: the track gives its bearing, the look its height (default: low over the back straight, long golden shadows);
// the visible sun sits lower than the light, just above the HDRI's own sun (~2 deg), so their glows merge into one
const sunAt = (v, el) => { const [bx, bz] = TRACK.sun, n = Math.hypot(bx, bz); return v.set(bx / n * Math.cos(el), Math.sin(el), bz / n * Math.cos(el)); };
const SUN_EL = Math.atan2(0.21, Math.hypot(0.55, 0.77)), SKY_EL = THREE.MathUtils.degToRad(7);
const SUN_DIR = sunAt(new THREE.Vector3(), SUN_EL), SKY_SUN = sunAt(new THREE.Vector3(), SKY_EL);
FOG_SUN.dir.set(SKY_SUN.toArray());
wetUniforms.uGlintDir.value.copy(SKY_SUN);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.autoUpdate = false;   // re-rendered only when the camera crosses an 8 m cell (see tick)
scene.add(sun, sun.target);
const sky = new Sky(SKY_SUN);       // clouds + horizon glow over the HDRI
scene.add(sky.mesh);
let glows = null, trails = null, trailT = null, captureBoost = [];
// the nearest two floodlights and the nearest stand lamp cast shadows; their maps re-render only when they move
for (const light of [pool.flood[0], pool.flood[1], pool.stand[0]]) {
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.autoUpdate = false;
  light.shadow.bias = -0.0005;
  Object.assign(light.shadow.camera, { near: 2, far: 120 });
}
scene.add(headlight, headlight.target);
let venueLights = null;

// The pool re-picks the nearest lamps 4x a second. Swapping a light from one lamp to another made its pool of light jump
// (distant lamps seemed to flicker), so: a slot keeps its lamp while that lamp is still among the nearest (with 25 %
// slack), a freed slot fades out before it moves, and fades in at the new lamp (see fadeLights).
function placeNearest(lights, list, cam, power) {
  const d2 = (l) => (l.pos[0] - cam.x) ** 2 + (l.pos[2] - cam.z) ** 2;
  const ranked = list.map((l) => ({ l, d: d2(l) })).sort((a, b) => a.d - b.d);
  const keepLimit = (ranked[Math.min(lights.length, ranked.length) - 1]?.d ?? 0) * 1.25 ** 2;
  const held = new Set();
  lights.forEach((light) => {
    const cur = light.userData.lamp;
    if (cur && d2(cur) <= keepLimit) { held.add(cur); light.userData.want = power; } else light.userData.want = 0;
  });
  const free = ranked.map((r) => r.l).filter((l) => !held.has(l));
  lights.forEach((light) => {
    if (light.userData.want > 0 || !free.length) return;
    if (light.intensity > power * 0.05 && light.userData.lamp) return;     // still fading out: move it next time
    const l = free.shift();
    light.userData.lamp = l;
    if (light.castShadow) light.shadow.needsUpdate = true;
    light.position.fromArray(l.pos);
    if (light.target && l.target) light.target.position.fromArray(l.target);
    if (l.warm !== undefined) light.color.set(l.warm ? 0xffd2a0 : 0xe8f0ff);   // matches the tower's lamps
    light.userData.want = power;
  });
}
function fadeLights(dt) {
  for (const light of [...pool.flood, ...pool.stand, ...pool.street]) {
    const want = light.userData.want ?? 0;
    light.intensity += (want - light.intensity) * Math.min(1, dt * 4);   // ~0.5 s fades
  }
}

// ------------------------------------------------------------------------------------------------ track, path, materials

const allMats = new Set();
const wetMats = [];
// Transmissive glass: the car GLBs keep their lamp covers and some windows transmissive, and Tokyo's gondolas are. While one is in view three
// draws the whole opaque scene a second time into a full-size 4x multisampled target (the transmission pass), the road mirror included, and
// the mirror's own render has a transmission pass for the glass it sees: about 2x the frame and 4x the mirror, for a few small panes.
// In the world they are drawn without it: transmission off, and the one line of three's shader that mixes in the transmitted scene
// (diffuse = mix(diffuse, scene behind * colour * (1 - F), transmission)) reads the scene's average colour instead. That is what a pane
// of this glass transmits anyway: the car covers are frosted (roughness .92 selects the last mip of the transmission target, about one
// texel), the windows' tint is near-black. The average is taken from the last frame's scene (avgRT, two tiny passes after the RenderPass).
// The garage keeps the real transmission: its close-ups are the one place it shows.
const avgRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
// Every pixel counts (a sparse sample misses the sun and the lamps, which carry most of an HDR frame's mean): the frame is reduced into a
// 64x36 grid (15x15 bilinear taps per cell, two pixels each), and the grid into one texel. The glass feeds the next frame's mean, so a NaN or
// Inf pixel anywhere (a shader in progress, a wet-road spike) would stick as a black screen for good: such taps are dropped, highlights capped.
const avgMid = new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType, depthBuffer: false });
const avgVertex = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
const avgCells = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tScene: { value: null } }, vertexShader: avgVertex,
  fragmentShader: 'uniform sampler2D tScene; varying vec2 vUv; void main() { vec3 s = vec3( 0.0 ); for ( int j = 0; j < 15; j ++ ) for ( int i = 0; i < 15; i ++ ) { vec3 t = texture2D( tScene, vUv + ( ( vec2( float( i ), float( j ) ) + 0.5 ) / 15.0 - 0.5 ) / vec2( 64.0, 36.0 ) ).rgb; s += ( all( lessThan( t, vec3( 1e4 ) ) ) && all( greaterThanEqual( t, vec3( 0.0 ) ) ) ) ? min( t, vec3( 64.0 ) ) : vec3( 0.0 ); } gl_FragColor = vec4( s / 225.0, 1.0 ); }',
}));
const avgOne = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tScene: { value: avgMid.texture } }, vertexShader: avgVertex,
  fragmentShader: 'uniform sampler2D tScene; varying vec2 vUv; void main() { vec3 s = vec3( 0.0 ); for ( int j = 0; j < 18; j ++ ) for ( int i = 0; i < 32; i ++ ) s += texture2D( tScene, ( vec2( float( i ), float( j ) ) * 2.0 + 1.0 ) / vec2( 64.0, 36.0 ) ).rgb; gl_FragColor = vec4( s / 576.0, 1.0 ); }',
}));
const glassVeil = { value: 0.96 };     // 1 - F, the Fresnel share three takes off the transmitted light; viewer.glassVeil tunes it
const glass = [];            // { mesh, slot (index in a material array, or -1), real, car, on }
const twins = new Map();     // transmissive material -> its twin without transmission
const glassSeen = new WeakMap();     // car -> LOD levels scanned (a car's far body loads a moment after the car, with glass of its own)
let inWorld = true, glassOn = 0;
{
  const renderPass = composer.passes[0], renderScene = renderPass.render.bind(renderPass);
  renderPass.render = (r, writeBuffer, readBuffer, ...rest) => {
    renderScene(r, writeBuffer, readBuffer, ...rest);
    if (!glassOn) return;
    const target = r.getRenderTarget();
    avgCells.material.uniforms.tScene.value = readBuffer.texture;
    r.setRenderTarget(avgMid); avgCells.render(r); r.setRenderTarget(avgRT); avgOne.render(r); r.setRenderTarget(target);
  };
}
function twinOf(m) {
  let w = twins.get(m);
  if (!w) {
    const t = m.transmission;
    w = m.clone(); w.transmission = 0;
    w.onBeforeCompile = (shader, r) => {
      m.onBeforeCompile.call(w, shader, r);
      shader.uniforms.tAvg = { value: avgRT.texture }; shader.uniforms.uT = { value: t }; shader.uniforms.uVeil = glassVeil;
      shader.fragmentShader = 'uniform sampler2D tAvg; uniform float uT, uVeil;\n' + shader.fragmentShader.replace('#include <transmission_fragment>', 'totalDiffuse = mix( totalDiffuse, texture2D( tAvg, vec2( 0.5 ) ).rgb * diffuseColor.rgb * uVeil, uT );');
    };
    w.customProgramCacheKey = () => 'world-glass';
    twins.set(m, w);
  }
  return w;
}
function noteGlass(o, car) {
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  mats.forEach((m, slot) => {
    if (m.transmission > 0 && !glass.some((g) => g.mesh === o && g.slot === (Array.isArray(o.material) ? slot : -1))) glass.push({ mesh: o, slot: Array.isArray(o.material) ? slot : -1, real: m, car, on: false });
  });
}
function worldGlass(world = inWorld) {
  inWorld = world;
  for (const c of field?.all ?? []) {
    const levels = c.lod?.levels.length ?? 0;
    if (glassSeen.get(c) !== levels) { glassSeen.set(c, levels); c.root.traverse((o) => { if (o.isMesh) noteGlass(o, true); }); }
  }
  for (const g of glass) {
    const want = PERF.noTransmission && (world || !g.car);
    if (g.on === want) continue;
    g.on = want; glassOn += want ? 1 : -1;
    const m = want ? twinOf(g.real) : g.real;
    if (g.slot < 0) g.mesh.material = m; else g.mesh.material[g.slot] = m;
  }
}
let track = null, curve = null, curveLength = 1, dist = 0, cumLen = [];
let field = null;
let culler = null, cullT = 0, cullStats = { hidden: 0, culledInstances: 0 };
let venueFx = null;     // the track's own runtime effects (tracks.js `venue`): { update(t, camera, look), setLook(look, params), dispose() }
let sceneryExperiment = null;
const SCENERY_TEST = new URLSearchParams(location.search).get('scenery') === '1';
const gpuTimer = new GpuTimer(renderer);
const dynres = new DynamicResolution();
const hdriCache = new Map();
let gltfLoader, venuePromise, venueRoot = null;
const garageRoom = DEV ? null : new GarageRoom(renderer);

const mark = (n) => performance.mark('ultrack:' + n);   // read with performance.getEntriesByType('mark')
async function load() {
  gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2).detectSupport(renderer));
  // The garage needs only the selected car and small track metadata. Venue geometry is deferred until Start.
  field = new Field(scene, { loadCar: async (...a) => { const c = await assemble(...a); applyRainGlass(c.materials.glass); return c; } });   // rain beads on the glass (finish.js)
  field.fx = new CarFx(scene);                 // exhaust, pops, nitro, tyre smoke (carkit/fx.js)
  const carsReady = field.load(gltfLoader, game ? [game.startupCar] : undefined);
  carsReady.catch(() => {});                   // handled where it is consumed
  // a saved circuit whose files are gone (Tokyo before its export, or removed later) falls back to Marina
  track = await fetchTrack().catch((error) => {
    if (TRACK.id === trackOf().id) throw error;
    console.warn(`Track ${TRACK.id} unavailable, using ${trackOf().id}:`, error);
    TRACK = trackOf(); mergeLooks(); store.set('track', TRACK.id); return fetchTrack();
  });
  buildPath();
  await carsReady;
  field.setTrack(curve, curveLength); field.grid(track); newTrails(field.cars);
  mark('car-ready');
  if(game)game.attach(field);
  else await ensureVenue();
}

const fetchTrack = () => fetch(U('track')).then((r) => { if (!r.ok) throw Error('Track metadata failed'); return r.json(); });
const NO_LIGHTS = { floodlights: [], standLamps: [], streetLamps: [] };   // a track without lights.json is lit by the sky alone

function ensureVenue() {
  const p = venuePromise ??= loadVenue().catch((error) => { if (venuePromise === p) venuePromise = null; throw error; });
  return p;
}

/** free a loaded subtree's GPU memory: geometry, instance buffers, materials and the textures they hold */
function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose(); o.dispose?.();
    for (const m of [].concat(o.material ?? [])) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}
/** drop the venue (geometry, textures, glows, crowd, culler, hoardings) so another circuit can load without leaking */
function unloadVenue() {
  venuePromise = null; venueLights = null; culler = null; captureBoost = [];
  venueFx?.dispose(); venueFx = null;
  if (venueRoot) { scene.remove(venueRoot); disposeTree(venueRoot); venueRoot = null; }
  if (glows) { scene.remove(glows.points); disposeTree(glows.points); glows = null; }
  sceneryExperiment?.dispose(); sceneryExperiment = null;
  people.clear(); driverHoardings.clear(); life.reset();
  allMats.clear(); wetMats.length = 0;
  for (let i = glass.length - 1; i >= 0; i--) if (!glass[i].car) { if (glass[i].on) glassOn--; glass.splice(i, 1); }
  for (const light of [...pool.flood, ...pool.stand, ...pool.street]) { light.userData.lamp = null; light.userData.want = 0; light.intensity = 0; }   // not parked at the old lamps
}
/** Switch circuit: the old venue goes, the new track's data replaces the path and the grid; the venue itself loads on demand
 *  (ensureVenue). The caller owns the collision world (game.js) and the menu. Reverts and rethrows if the new track will not load. */
async function setTrack(id) {
  const next = trackOf(id), prev = TRACK;
  if (next === prev) return;
  unloadVenue(); warming = null;
  TRACK = next; mergeLooks();
  try { track = await fetchTrack(); } catch (error) { TRACK = prev; mergeLooks(); track = await fetchTrack(); aimSun(LOOKS[params.look]); throw error; }
  buildPath(); field.setTrack(curve, curveLength); field.grid(track); newTrails(field.cars);
  aimSun(LOOKS[params.look]);
}

async function loadVenue() {
  const T = TRACK, has = T.has;
  T.venue?.().then((m) => m.prefetch?.({ renderer, ktx2: gltfLoader.ktx2Loader }), () => {});   // a venue module's own textures load alongside its GLB
  const [gltf, lightsJson] = await Promise.all([
    gltfLoader.loadAsync(import.meta.env.DEV&&T.id==='marina'&&['whole','sectors'].includes(new URLSearchParams(location.search).get('venue'))?'/__venue-profile?variant='+new URLSearchParams(location.search).get('venue')+'&texture='+TEX:U('visual')),
    optionalJson(U('lights'), NO_LIGHTS),
    setLook(params.look),
  ]);
  if (T !== TRACK) { disposeTree(gltf.scene); return; }   // another circuit was picked while this one loaded
  venueLights = lightsJson;
  venueRoot = gltf.scene;
  scene.add(gltf.scene);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const wetNames = T.wet?.wet ?? WET, puddleNames = T.wet?.puddles ?? PUDDLES;    // a track's own material names (WET / PUDDLES are Marina's)
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    // shadows: everything receives; flat ground-like surfaces and the far backdrop do not cast (they never shade anything)
    o.receiveShadow = true;
    o.castShadow = !NO_CAST.test(o.name);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      allMats.add(m);
      noteGlass(o, false);
      m.userData.emissive0 = m.emissiveIntensity ?? 1;
      // the supertalls stand 3-5 km out: exponential fog would erase them, so they keep their own (baked-in) depth
      if (m.name.startsWith('M_Supertall')) m.fog = false;
      // Cut-out materials shimmered as the camera moved (the chain-link fence was 67% of all unstable pixels; lit at
      // night it read as flickering lights). The fence blends its mipmapped alpha so a distant fence fades to a soft
      // mesh; fronds, crowd cards and neon use alpha-to-coverage with the MSAA target.
      if (m.name === 'M_Fence') {
        m.transparent = true; m.alphaTest = 0; m.depthWrite = false; m.opacity = 1;
        if (m.map) m.map.anisotropy = 1;                // 16x kept the 8 cm wires razor-sharp at grazing angles, i.e. aliasing
        m.onBeforeCompile = (sh) => {                   // and sample one mip blurrier: the mesh averages instead of sparkling
          sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
            '#ifdef USE_MAP\n  diffuseColor *= texture2D(map, vMapUv, 1.0);\n#endif');
        };
        m.customProgramCacheKey = () => 'fence-soft';
      }
      else if (m.alphaTest > 0) m.alphaToCoverage = true;
      // anisotropic filtering: without it the asphalt smears into flat colour at driver-eye height
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
        if (m[key]) { m[key].anisotropy = m.name === 'M_Fence' ? 1 : aniso; m[key].needsUpdate = true; }
      }
      if (wetNames.includes(m.name) && !m.userData.wet) {
        m.userData.wet = true;
        wetMats.push(m);
        wetify(m, { puddles: puddleNames.includes(m.name) });
      }
    });
    if (o.name === 'water' || o.userData.surface === 'water') {
      // open water is always "wet": its own uniforms, so the wet-road slider never dims the sea
      o.material = new THREE.MeshStandardMaterial({ color: 0x050d14, roughness: 0.05, metalness: 0.0 });
      wetify(o.material, { uniforms: { ...wetUniforms, uWet: { value: 1 } } });
      life.water(o.material);
      o.castShadow = false;
    }
    life.attach(o);
  });
  applyDayNight(LOOKS[params.look]);
  worldGlass();
  // every lamp also gets a stable glow sprite; the tiny lamp meshes drop under the bloom threshold (they shimmered)
  // The road mirror draws the venue a second time (~7 ms). Small unlit props (cones, posts, tyre stacks, bunting,
  // crew kit: a few blurred pixels in a wet-road reflection) move to layer NO_MIRROR, which the main camera, the
  // shadow cameras and AO still see but the mirror's camera does not. Lit things of any size stay: the lights are
  // what make a wet road read as wet.
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const r = o.geometry.boundingSphere.radius * (o.isInstancedMesh ? 1 : o.matrixWorld.getMaxScaleOnAxis());
    const lit = [].concat(o.material).some((m) => m.emissive && m.emissiveIntensity > 0 && m.emissive.r + m.emissive.g + m.emissive.b > 0.05);
    if (r < 1.6 && !lit) o.layers.set(NO_MIRROR);
  });
  glows = new Glows();
  glows.addLights(lightsJson);
  glows.addBeacons(gltf.scene);
  scene.add(glows.build());
  dimLampMeshes(allMats);
  // lamp, LED and neon surfaces burn 3x brighter in the player car's reflection capture (their glow sprites can't be
  // in it): the paint then reflects bright light shapes after dark, the biggest cue of a premium finish
  captureBoost = [...allMats].filter((m) => /^M_Lamp|Neon|LED|M_VipGlow|M_VipEdge|M_GarageHeader|pylon board|^V8 (pink|ice|amber|paper)$|pagoda shoji|lantern (glow|paper)/.test(m.name) && m.emissiveIntensity > 0);
  if(SCENERY_TEST&&has.yachts&&has.buildings){
    const {SceneryExperiment}=await import('./scenery-experiment.js');
    try{
      sceneryExperiment=new SceneryExperiment(gltf.scene,{panel:true,params,resize,renderer});
      await sceneryExperiment.ready;
      sceneryExperiment.update(camera);
      console.info('Scenery LOD prepared:',Math.round(sceneryExperiment.preparationMs),'ms',sceneryExperiment.getStats());
    }catch(error){
      sceneryExperiment?.dispose();sceneryExperiment=null;
      console.warn('Scenery experiment unavailable; using original models:',error);
    }
  }
  culler = new Culler(gltf.scene);
  if (T.venue) {
    const fx = await (await T.venue()).create({ scene, root: gltf.scene, track, renderer, camera, lights: lightsJson, allMats, wetUniforms, NO_MIRROR, ktx2: gltfLoader.ktx2Loader });
    if (T !== TRACK) fx.dispose(); else { venueFx = fx; venueFx.setLook?.(LOOKS[params.look], params); }
    // the venue effects add materials of their own: transmissive glass among them would bring the second scene render back
    const cars = new Set((field?.all ?? []).map((c) => c.root));
    scene.children.forEach((ch) => { if (!cars.has(ch)) ch.traverse((o) => { if (o.isMesh) noteGlass(o, false); }); });
    worldGlass();
  }
  // real characters replace the placeholder people (loaded after the venue so the track shows first)
  const populate=()=>people.populate(gltfLoader,scene,gltf.scene,track,{pit:has.pit,vip:has.vip?U('vip'):null,alive:()=>venueRoot===gltf.scene}).then(n=>console.info('people:',n)).catch(e=>console.warn('people:',e));
  const later=()=>setTimeout(()=>{if(globalThis.requestIdleCallback)requestIdleCallback(populate,{timeout:5000});else populate();},2500);
  // the car-lab cars: the player's is on the title screen, the rest load on demand (Field.ensure)
  makeReflector();
  mark('venue-ready');
    console.info(`cars: ${field.cars.length} active, no parked pit cars`);
    if(has.people&&(DEV || params.quality==='ultra'))later();
    // team artwork in each team's font on the garages, pit boxes, flags and the Corniche Club (see teamdress.js): after
    // the car, so its fonts and canvases never compete with the car's download
    if(has.teamDress)dressTeams([...allMats]).then((n) => console.info(`team artwork: ${n} materials`)).catch((e) => console.warn('teams:', e));
    if (game) return;    // the game sets up physics per session
    // physics (src/physics): the cars drive on the track's collision mesh; ?physics=0 keeps the old line-following
    if (new URLSearchParams(location.search).get('physics') !== '0') {
      const pw = await PhysicsWorld.create(U('collision'));
      field.enablePhysics(pw, { player: params.player });
      console.info('physics: on (you drive: WASD / arrows, Space handbrake, Shift nitro, R reset; or a gamepad)');
    }
}

async function prepareRaceRenderer({isCancelled=()=>false}={}) {
  // Let the intro/loading UI paint before submitting any heavy GPU work.
  await new Promise(resolve=>requestAnimationFrame(resolve));
  worldGlass(true);
  field.chase(camera,1/60,{reduceMotion:true});
  const look=LOOKS[params.look],power=look.lights*params.venueLights;
  placeNearest(pool.flood,venueLights.floodlights,camera.position,1400*power);
  placeNearest(pool.stand,venueLights.standLamps,camera.position,700*power);
  placeNearest(pool.street,venueLights.streetLamps,camera.position,45*power);
  fadeLights(1);
  for(const car of field.cars){car.root.visible=true;car.beams.forEach(b=>{b.visible=true;});}
  scene.updateMatrixWorld(true);camera.updateMatrixWorld();
  sceneryExperiment?.update(camera);
  if(culler&&params.cull){culler.k=params.cullDistance;culler.update(camera.position);}
  const timings={},started=performance.now();
  const target=renderer.getRenderTarget();
  // Match RenderPass's linear offscreen target so we warm the actual race shader variants.
  // Both program sets (the frame and the hero's cube capture) are submitted together so the driver builds them in
  // parallel; after a menu warm-up (warmRace) every one is already cached.
  let ready;
  const {compileVisible}=await import('./warmup.js');
  const compileStarted=performance.now();
  try{renderer.setRenderTarget(composer.readBuffer);ready=compileVisible(renderer,scene,camera,{frustum:true,isCancelled,depth:SHADOW_PASSES});}
  finally{renderer.setRenderTarget(target);}
  await Promise.all([ready,field.compileCube(renderer,{isCancelled,around:cubeHide}),compilePost()]);
  if(isCancelled())return;
  timings.shadersMs=Math.round(performance.now()-compileStarted);
  const reflectStarted=performance.now();
  await field.prepareReflection(renderer,hiddenForCapture(),isCancelled);
  if(isCancelled())return;
  timings.reflectionsMs=Math.round(performance.now()-reflectStarted);
  // First texture uploads, post shaders and shadow maps are paid before the starting lights.
  const renderStarted=performance.now();composer.render();
  timings.firstFrameMs=Math.round(performance.now()-renderStarted);
  timings.programs=renderer.info.programs.length;
  console.info('Graphics preparation:',timings);
}
// what the hero's cube capture leaves out (Field.update and prepareReflection do the same)
const hiddenForCapture=()=>[rain,people.group,glows?.points,reflector,trails?.mesh,field.fx?.smoke,field.fx?.fire];
function cubeHide(fn){
  const off=hiddenForCapture().filter(o=>o?.visible),hero=field.hero.root,heroShown=hero.visible;
  off.forEach(o=>{o.visible=false;});hero.visible=false;
  try{fn();}finally{off.forEach(o=>{o.visible=true;});hero.visible=heroShown;}
}
// A submit made in the race's own state (chase mode: the headlight stops casting; the hero's beams on), so program keys match.
function raceState(fn){
  const mode=params.mode,beams=field.hero.beams.map(b=>b.visible),world=inWorld;
  params.mode='chase';worldGlass(true);applyAll();field.hero.beams.forEach(b=>{b.visible=true;});
  try{fn();}finally{params.mode=mode;worldGlass(world);applyAll();field.hero.beams.forEach((b,i)=>{b.visible=beams[i];});}
}
// the sun's shadow map first renders inside the GTAO pass, which hides the cars (and so the hero's beams): that light set, then the full one
function carsHidden(fn){const cars=field.all.filter(c=>c.root.visible);cars.forEach(c=>{c.root.visible=false;});try{fn();}finally{cars.forEach(c=>{c.root.visible=true;});}}
const SHADOW_PASSES=[carsHidden,fn=>fn()];
/** Compile the composer's full-screen shaders (GTAO, bloom, output, grade, SMAA): the first frame would otherwise build them one by one. */
function compilePost(){
  const empty=new THREE.Scene(),quad=composer.passes.find(p=>p._fsQuad)?._fsQuad._mesh.geometry,was=renderer.getRenderTarget();   // the passes' own triangle: its attributes are part of the program key
  if(!quad)return Promise.resolve();
  // OutputPass builds its tone-map defines inside render(): run that with a renderer that draws nothing
  const none={outputColorSpace:renderer.outputColorSpace,toneMapping:renderer.toneMapping,toneMappingExposure:renderer.toneMappingExposure,setRenderTarget(){},render(){},clear(){}};
  composer.passes.find(p=>'_toneMapping' in p)?.render(none,composer.writeBuffer,composer.readBuffer);
  const last=composer.passes.map(p=>p.enabled).lastIndexOf(true),seen=new Set(),jobs=[];
  composer.passes.forEach((pass,i)=>{
    const group=new THREE.Group();
    for(const v of Object.values(pass).flat())
      if(v?.isShaderMaterial&&!seen.has(v)){seen.add(v);group.add(new THREE.Mesh(quad,v));}
    if(!group.children.length)return;
    try{renderer.setRenderTarget(i===last?null:composer.readBuffer);jobs.push(renderer.compileAsync(group,camera,empty));}   // the last pass draws to the screen (sRGB), the rest to linear targets
    finally{renderer.setRenderTarget(was);}
  });
  return Promise.all(jobs);
}
const WARM_INFLIGHT=+(new URLSearchParams(location.search).get('inflight')||3),warmInflight=()=>game?.starting?Infinity:WARM_INFLIGHT;   // Start is waiting on it: no reason to hold back
let warming=null;
/** Menu idle: compile the race's programs (frame + hero cube capture, venue + the race cars) so Start finds them cached.
 *  The menus draw only the showroom, so nothing here shows. stop() cancels it when Start (or the garage) needs the GPU. */
function warmRace(keys,stop=()=>false){
  const id=keys.join();
  if(warming?.id===id)return warming.done;
  if(!field?.hero||!venueLights)return;
  const roots=keys.map(k=>field.all.find(c=>c.key===k)?.root).filter(Boolean);
  const started=performance.now();
  const done=(async()=>{
    const {compileVisible}=await import('./warmup.js');
    const was=renderer.getRenderTarget();let frame;
    try{renderer.setRenderTarget(composer.readBuffer);frame=compileVisible(renderer,scene,camera,{extra:roots,around:raceState,isCancelled:stop,depth:SHADOW_PASSES,inflight:warmInflight});}   // the race renders into the composer's target: no tone mapping in its programs
    finally{renderer.setRenderTarget(was);}
    await Promise.all([
      frame,
      field.compileCube(renderer,{extra:roots.filter(r=>r!==field.hero.root),around:fn=>raceState(()=>cubeHide(fn)),isCancelled:stop,inflight:warmInflight}),
      compilePost(),
    ]);
    // the first capture also builds the hero's envMap variants (the capture's PMREM has its own size) and the PMREM filters
    if(!stop())await field.prepareReflection(renderer,hiddenForCapture(),stop);
    console.info('Race shaders warmed:',Math.round(performance.now()-started),'ms,',renderer.info.programs.length,'programs');
  })().finally(()=>{if(stop()&&warming?.done===done)warming=null;});   // a cancelled warm-up may be retried
  warming={id,done};return done;
}
const NO_MIRROR = 2;
camera.layers.enable(NO_MIRROR);

function buildPath() {
  // racing line in game coordinates: centre line + lateral offset (+ = left of travel)
  const c = track.centerline, n = c.length, rl = track.racingLine;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = c[(i - 1 + n) % n], b = c[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
    const left = new THREE.Vector3(dz / len, 0, -dx / len);   // game: x east, -z north; left of travel
    pts.push(new THREE.Vector3(c[i][0], c[i][1], c[i][2]).addScaledVector(left, rl[i] + params.lateral));
  }
  curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  curve.arcLengthDivisions = 4000;
  curveLength = curve.getLength();
  cumLen = [0];
  for (let i = 1; i < n; i++) cumLen.push(cumLen[i - 1] + Math.hypot(c[i][0] - c[i - 1][0], c[i][2] - c[i - 1][2]));
  jumpTo(params.jump);
}

const JUMPS = { 'start/finish': () => -320, 'pit straight': () => -140, 'T1 braking': () => idxOf('T1', -40),
  'marina entry': () => idxOf('T10', -90), 'hairpin': () => idxOf('T6', -60),
  'bridge': () => idxOf('T7', -380), 'marina canopy': () => idxOf('T11', 0), 'boardwalk': () => idxOf('T14', -30) };
function idxOf(id, back) {
  const k = track.corners.find((c) => c.id === id);
  return (cumLen[k ? k.apexIdx : 0] || 0) + back;
}
function jumpTo(name) { dist = ((JUMPS[name]?.() ?? 0) + curveLength) % curveLength; }

// ------------------------------------------------------------------------------------------------ looks & settings

/** cap a half-float HDR's pixels at `max`: positive halves order as their bit patterns (the sign bit set = negative, left alone) */
function clampHalf(data, max) {
  const cap = THREE.DataUtils.toHalfFloat(max);
  for (let i = 0; i < data.length; i++) if (data[i] > cap && data[i] < 0x8000) data[i] = cap;
}
/** point the sun light and the visible sun for this look (heights) and track (bearing); the shadow camera re-aims next tick */
function aimSun(look) {
  sunAt(SUN_DIR, look.sunEl !== undefined ? THREE.MathUtils.degToRad(look.sunEl) : SUN_EL);
  sunAt(SKY_SUN, look.skyEl !== undefined ? THREE.MathUtils.degToRad(look.skyEl) : SKY_EL);
  FOG_SUN.dir.set(SKY_SUN.toArray());
  wetUniforms.uGlintDir.value.copy(SKY_SUN);
  sky.uniforms.uSun.value.copy(SKY_SUN);
  sun.target.position.set(NaN, 0, NaN);
}
async function setLook(name) {
  const look = LOOKS[name];
  let pending=hdriCache.get(look.hdri);
  if(!pending){
    pending=(async()=>{const hdr=await new HDRLoader().loadAsync(A+'hdri/'+look.hdri);hdr.mapping=THREE.EquirectangularReflectionMapping;if(look.hdriClamp)clampHalf(hdr.image.data,look.hdriClamp);return {bg:hdr,env:pmrem.fromEquirectangular(hdr).texture};})();
    hdriCache.set(look.hdri,pending);pending.catch(()=>hdriCache.delete(look.hdri));
  }
  const tex=await pending;
  if(name!==params.look)return; // A later menu choice wins over an older in-flight sky request.
  scene.background = tex.bg;
  scene.environment = tex.env;
  scene.backgroundIntensity = look.bg;
  const turn = Math.atan2(TRACK.sun[0], TRACK.sun[1]) - Math.atan2(...trackOf('marina').sun);     // hdriRot is tuned on Marina's sun bearing
  scene.backgroundRotation.y = scene.environmentRotation.y = look.hdriRot + turn;
  sky.setLook(name);
  aimSun(look);
  scene.environmentIntensity = look.env;
  applyAll();
}

/** the track's optional day/night backdrop blend (tracks.js dayNight) for this look */
function applyDayNight(look) {
  const d = TRACK.dayNight; if (!d) return;
  const nk = THREE.MathUtils.smoothstep(look.dn, 0.5, 0.7);     // night-only: off through dusk (dn .35), full from evening (dn .7)
  for (const m of allMats) {
    if (d.day.test(m.name)) { m.transparent = true; m.depthWrite = false; m.opacity = 1 - look.dn; }
    else if (d.night?.test(m.name)) { m.transparent = true; m.depthWrite = false; m.opacity = nk * (d.nightK?.[m.name] ?? 1); m.visible = nk > 0; }
  }
}
function applyAll() {
  const look = LOOKS[params.look];
  worldGlass();
  const poolOn = !PERF.idleLights || look.lights * params.venueLights > 0;
  for (const light of [...pool.flood, ...pool.stand, ...pool.street]) light.visible = poolOn;
  renderer.toneMapping = { AgX: THREE.AgXToneMapping, ACES: THREE.ACESFilmicToneMapping, Neutral: THREE.NeutralToneMapping }[params.toneMapping === 'auto' ? look.tm : params.toneMapping];
  renderer.toneMappingExposure = look.exposure * params.exposure;
  scene.fog = params.fog > 0 ? new THREE.FogExp2(look.fog, look.fogDensity * params.fog * TRACK.fog) : null;
  allMats.forEach((m) => { if (m.emissiveIntensity !== undefined) m.emissiveIntensity = m.userData.emissive0 * look.emissive * params.emissive; });
  wetMats.forEach((m) => {
    const w = params.wet;
    m.envMapIntensity = 1 + 0.4 * w;     // roughness and darkening live in the shader (see wetify)
  });
  wetUniforms.uWet.value = params.wet;
  wetUniforms.uRain.value = Math.min(1, params.rain * 2);
  FINISH_RAIN.value = Math.min(1, params.rain * 2);
  { const g = look.glint, k = Math.max(g[0], g[1], g[2], 1e-3); FINISH_SPARK.value.setRGB(...[0, 1, 2].map((i) => (0.04 + 0.1 * k) * (0.6 + 0.4 * g[i] / k))); }   // beads catch the light of the look (warm at dusk, none but lamps at night)
  wetUniforms.uGlint.value.setRGB(...look.glint);
  wetUniforms.uMirror.value = mirrorWanted() ? 1 : 0;
  if (reflector) reflector.visible = mirrorWanted();
  rain.visible = params.rain > 0;
  rain.material.uniforms.uOpacity.value = params.rain * 0.55;
  gtao.enabled = params.ao;
  gtao.blendIntensity = params.aoIntensity;
  sun.intensity = look.sun;
  sun.color.set(look.sunColor);
  const ultra = params.quality === 'ultra';
  for (const light of [sun, headlight, pool.flood[0], pool.flood[1], pool.stand[0]]) {
    light.shadow?.camera.layers.enable(NO_MIRROR);            // small props still cast shadows
    // The viewer headlight is off in chase mode. Rendering its shadow anyway redrew the venue every frame.
    const useful = light === sun || (look.lights > 0 && (light === headlight ? params.mode !== 'chase' : light === pool.flood[0] || ultra));
    light.castShadow = params.shadows && useful;
    if (light.shadow) light.shadow.needsUpdate = true;
  }
  bloom.enabled = params.bloom;
  // driving into the low sun, a wide sky above the threshold bloomed into a cream veil: dusk blooms less, from brighter pixels
  bloom.strength = params.bloomStrength * (look.bloomGain ?? 1); bloom.radius = params.bloomRadius; bloom.threshold = params.bloomThreshold * (look.bloomThr ?? 1);
  smaa.enabled = params.smaa;
  finalPass.uniforms.uCA.value = params.aberration;
  finalPass.uniforms.uVig.value = params.vignette;
  finalPass.uniforms.uGrain.value = params.grain;
  finalPass.uniforms.uGrade.value = params.grade;
  const G = look.grade, fu = finalPass.uniforms;
  fu.uS.value = G.s; fu.uBlack.value = G.black; fu.uSat.value = G.sat;
  fu.uShadows.value.set(...G.shadows); fu.uHighs.value.set(...G.highs);
  fu.uFlare.value = look.flare * params.flare;
  FOG_SUN.color.set(look.fogSun);
  applyDayNight(look);
  venueFx?.setLook?.(look, params);
  controls.enabled = params.mode === 'orbit';
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const pr = Math.min(window.devicePixelRatio, tier().pr) * params.renderScale;
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
  renderer.setSize(w, h); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(wetUniforms.uResolution.value);
  if (reflector) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2()).multiplyScalar(params.mirrorRes);
    reflector.getRenderTarget().setSize(Math.max(64, Math.floor(size.x)), Math.max(64, Math.floor(size.y)));
  }
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------------------------------------ quality tiers

const device = detectTier(renderer);
const tier = () => TIERS[params.quality === 'auto' ? device.tier : params.quality];
function applyQuality() {
  const q = tier();
  Object.assign(params, { shadows: q.shadows, ao: q.ao, mirror: q.mirror, mirrorRes: q.mirrorRes, bloom: q.bloom, smaa: q.smaa,
    rain: Math.min(params.rain, q.rain), renderScale: q.scale, cullDistance: q.cull });
  dynres.max = q.scale;
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) {   // MSAA: thin posts, cables and rails stop crawling
    if (rt.samples !== q.msaa) { rt.samples = q.msaa; rt.dispose(); }
  }
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  resize(); applyAll();
}

// ------------------------------------------------------------------------------------------------ UI

const gui = new GUI({ title: 'Track viewer' });
gui.add(params, 'look', Object.keys(LOOKS)).name('look').onChange(setLook);
const fl = gui.addFolder('Lighting');
fl.add(params, 'emissive', 0, 3, 0.05).name('emissive (LEDs, windows)').onChange(applyAll);
fl.add(params, 'venueLights', 0, 3, 0.05).name('venue lights');
fl.add(params, 'headlight');
const fw = gui.addFolder('Weather');
fw.add(params, 'wet', 0, 1, 0.01).name('wet road').onChange(applyAll);
fw.add(params, 'mirror').name('planar reflections').onChange(applyAll);
fw.add(params, 'mirrorRes', 0.25, 1, 0.05).name('reflection res').onFinishChange(makeReflector);
fw.add(params, 'rain', 0, 1, 0.01).onChange(applyAll);
fw.add(params, 'fog', 0, 3, 0.05).onChange(applyAll);
const fp = gui.addFolder('Post');
fp.add(params, 'bloom').onChange(applyAll);
fp.add(params, 'bloomStrength', 0, 3, 0.05).onChange(applyAll);
fp.add(params, 'bloomRadius', 0, 1, 0.01).onChange(applyAll);
fp.add(params, 'bloomThreshold', 0, 2, 0.01).onChange(applyAll);
fp.add(params, 'speedBlur', 0, 2, 0.01).name('speed blur');
fp.add(params, 'aberration', 0, 2, 0.01).onChange(applyAll);
fp.add(params, 'vignette', 0, 1, 0.01).onChange(applyAll);
fp.add(params, 'grain', 0, 0.2, 0.005).onChange(applyAll);
fp.add(params, 'grade', 0, 1, 0.01).name('colour grade').onChange(applyAll);
fp.add(params, 'flare', 0, 2, 0.01).name('lens flare').onChange(applyAll);
fp.add(params, 'smaa').name('SMAA').onChange(applyAll);
fp.add(params, 'toneMapping', ['auto', 'AgX', 'ACES', 'Neutral']).onChange(applyAll);
fp.add(params, 'exposure', 0.2, 3, 0.01).onChange(applyAll);
const fc = gui.addFolder('Camera');
fc.add(params, 'cars').name('cars (car-lab field)');
fc.add(params, 'pace', 0.3, 1.2, 0.05).name('car pace');
fc.add(params, 'reduceMotion').name('reduce motion');
fc.add(params, 'player').name('you drive').onChange((v) => field?.setPlayer?.(v));
fc.add(params, 'mode', ['flythrough', 'orbit', 'chase']).onChange(() => { applyAll(); controls.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(20)); });
fc.add(params, 'jump', Object.keys(JUMPS)).name('jump to').onChange(jumpTo);
fc.add(params, 'speedKmh', 0, 320, 1).name('speed (km/h)');
fc.add(params, 'camHeight', 0.4, 30, 0.05).name('height (m)');
fc.add(params, 'lateral', -6, 6, 0.1).name('lateral offset').onFinishChange(buildPath);
fc.add(params, 'paused');
const fs = gui.addFolder('Shadows & AO');
fs.add(params, 'shadows').name('shadows (sun, headlight, nearest lamps)').onChange(applyAll);
fs.add(params, 'ao').name('GTAO').onChange(applyAll);
fs.add(params, 'aoIntensity', 0, 2, 0.05).name('AO strength').onChange(applyAll);
const fperf = gui.addFolder('Performance');
fperf.add(params, 'quality', ['auto', ...Object.keys(TIERS)]).name(`quality (auto = ${device.tier})`).onChange(applyQuality);
fperf.add(params, 'dynamicRes').name('dynamic resolution');
fperf.add(params, 'cull').name('distance culling').onChange((v) => { if (!v && culler) { culler.k = 1e9; culler.update(camera.position); } });
fperf.add(params, 'cullDistance', 40, 1000, 10).name('cull: metres per m radius');
fperf.add(params, 'renderScale', 0.4, 1.5, 0.05).name('render scale').onFinishChange(resize);
fperf.add({ bench: () => bench().then((r) => console.table(r)) }, 'bench').name('benchmark (console)');
fperf.add(params, 'fpsCap', [30, 45, 60, 120]).name('fps cap (heat)');
fperf.close();

// ------------------------------------------------------------------------------------------------ loop

const _sunP = new THREE.Vector3(), _sunF = new THREE.Vector3();
// sky and lamp glows depend on the camera and the look; tick, renderNow, snap and bench all call this
function updateFx(t, cull = false) {
  const look = LOOKS[params.look];
  sceneryExperiment?.update(camera);
  if (cull && culler && params.cull) { culler.k = params.cullDistance; cullStats = culler.update(camera.position); }
  if (field) {
    field.captureEvery = ({low:0,medium:8,high:4,ultra:2})[params.quality==='auto'?device.tier:params.quality] ?? 4;
    field.lightMode = look.lamps ?? 'low';
    field.cars.forEach((c) => { c.root.visible = params.cars; });
    if (params.cars) field.update(t, camera, renderer, look, [rain, people.group, glows?.points, reflector, trails?.mesh, field.fx?.smoke, field.fx?.fire, field.fx?.jet], captureBoost);
    // hidden from the car's reflection capture: a 3 px glow sprite fills a 128 px cube face, and the road mirror
    // (rendered for the main camera) showed bright sky under the car, which lit every rim like a halo
  }
  trails?.update(Math.max(0, Math.min(0.1, t - (trailT ?? t))), camera, params.cars ? look.trails : 0); trailT = t;
  sky.update(t, camera);
  // the sun's place on screen for the lens flare (z: in front and near the frame, faded toward the edges)
  camera.updateMatrixWorld();
  const sp = _sunP.copy(camera.position).addScaledVector(SKY_SUN, 1000).project(camera);
  const inFront = camera.getWorldDirection(_sunF).dot(SKY_SUN) > 0;
  const edge = Math.max(Math.abs(sp.x), Math.abs(sp.y));
  finalPass.uniforms.uSun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5, inFront ? 1 - THREE.MathUtils.smoothstep(edge, 0.85, 1.15) : 0);
  finalPass.uniforms.uAspect.value = camera.aspect;
  glows?.update(t, camera, renderer.getContext().drawingBufferHeight, scene.fog, (look.glow ?? 0.35 + 0.65 * look.lights) * params.venueLights);
  venueFx?.update(t, camera, look);
}

function placeOnPath() {
  const u = dist / curveLength;
  const p = curve.getPointAt(u).addScaledVector(up, params.camHeight);
  const q = curve.getPointAt((u + 24 / curveLength) % 1).addScaledVector(up, params.camHeight * 0.8);
  camera.position.copy(p);
  camera.lookAt(q);
}

// Speed blur amount (Endurance's curve): in from 10 km/h, ^0.7 so it shows early, full by 150, a little more to
// 280; boost pushes it toward full. Rises over ~0.25 s, falls over ~0.17 s. The streaks aim at the point 500 m ahead
// along the direction of travel, kept near the middle of the frame.
const blur = { amount: 0, c: new THREE.Vector2(0.5, 0.5), p: new THREE.Vector3() };
function updateSpeedBlur(dt, pathSpeed) {
  const fu = finalPass.uniforms, h = params.mode === 'chase' ? field?.hero : null;
  const kmh = (h ? h.speed : params.mode === 'flythrough' ? pathSpeed : 0) * 3.6;
  // nitro package level: the player's nitro ramp (carkit/fx.js heroNitro, already smooth), scaled like the blur (off with motion blur off)
  const nitro = h ? Math.min(1, field?.fx?.heroNitro ?? 0) : 0, nScale = Math.min(1, params.speedBlur) * (params.reduceMotion ? 0.4 : 1) * (game?.blurScale ?? 1);
  // a hard hit (camera.js rig.impact, ~0.3 s) punches the blur briefly
  const want = Math.max(THREE.MathUtils.clamp((kmh - 10) / 140, 0, 1) ** 0.7 + 0.25 * THREE.MathUtils.clamp((kmh - 150) / 130, 0, 1),
    0.95 * Math.max(field?.rig?.boost ?? 0, nitro), 0.7 * (field?.rig?.impact ?? 0));
  blur.amount += (want - blur.amount) * (1 - Math.exp(-(want > blur.amount ? 4 : 6) * dt));
  fu.uBlur.value = blur.amount * params.speedBlur * (params.reduceMotion ? 0.4 : 1) * (game?.blurScale ?? 1);
  fu.uNitro.value = nitro * nScale;
  fu.uPhase.value += dt * (0.8 + 2.2 * blur.amount + 1.4 * nitro);
  let cx = 0.5, cy = 0.5;
  if (h) {
    const a = (h.yaw ?? h.root.rotation.y) + Math.PI;    // travel direction, as in camera.js
    blur.p.set(-Math.cos(a), 0, Math.sin(a)).multiplyScalar(500).add(camera.position).project(camera);
    if (blur.p.z < 1) { cx = THREE.MathUtils.clamp(blur.p.x * 0.5 + 0.5, 0.3, 0.7); cy = THREE.MathUtils.clamp(blur.p.y * 0.5 + 0.5, 0.35, 0.7); }
  }
  blur.c.lerp(new THREE.Vector2(cx, cy), 1 - Math.exp(-4 * dt));
  fu.uBlurC.value.copy(blur.c);
}

// smoke is lit by the scene around it: warm and bright at dusk, dim after dark (fire is emissive)
const FX_LIGHT = { day: new THREE.Color(0.88, 0.9, 0.94), dusk: new THREE.Color(0.95, 0.82, 0.72), bluehour: new THREE.Color(0.45, 0.5, 0.62), night: new THREE.Color(0.3, 0.3, 0.36) };

// Monotonic animation time without the deprecated THREE.Clock wrapper.
const animationEpoch=performance.now();
const clock = { getElapsedTime:()=> (performance.now()-animationEpoch)/1000 };
let last = 0, acc = 0, frames = 0, fps = 0, fpsT = 0, lightT = 0;
const up = new THREE.Vector3(0, 1, 0);
function tick(now) {
  requestAnimationFrame(tick);
  if(benchmarking)return;
  if (now - last < 1000 / params.fpsCap - 0.5) return;   // the cap keeps the GPU (and the room) cooler
  const wallDt = Math.max(0, (now - last) / 1000);
  const dt = Math.min(0.05, wallDt);
  last = now;
  const t = clock.getElapsedTime();
  const speed = params.paused ? 0 : params.speedKmh / 3.6;
  game?.update(dt, fps);inputDebug?.update(dt,field);
  // Poster playback needs no hidden world renders; menus use only the small showroom.
  if(game?.raceLoading.active){garageRoom?.suspend();return;}
  if(game?.session && params.paused){garageRoom?.suspend();return;}
  if(garageRoom && !game.session){
    worldGlass(false);
    if(sceneryExperiment?.panel)sceneryExperiment.panel.hidden=true;
    controls.enabled=false;
    FINISH_RAIN.value=0;   // the showroom is indoors: no rain beads on the paint
    garageRoom.render(field?.hero,dt,{garage:game.screenName==='garage',reduceMotion:params.reduceMotion});
    return;
  }
  garageRoom?.suspend();
  worldGlass(true);
  FINISH_RAIN.value = Math.min(1, params.rain * 2);   // back out in the weather
  if(sceneryExperiment?.panel)sceneryExperiment.panel.hidden=false;

  if (params.mode === 'chase' && field?.hero) {
    if (!params.paused) field.drive(dt, params.pace);
    field.chase(camera, dt, { reduceMotion: params.reduceMotion });
  } else if (params.mode === 'orbit') {
    controls.update();
  } else if ((params.mode === 'flythrough' || params.mode === 'chase') && curve) {   // chase falls back until the cars load
    dist = (dist + speed * dt) % curveLength;
    placeOnPath();
  } else {
    controls.update();
  }

  const look = LOOKS[params.look];
  if (venueLights && t - lightT > 0.25) {     // re-pick the nearest venue lights four times a second
    lightT = t;
    const k = look.lights * params.venueLights;
    placeNearest(pool.flood, venueLights.floodlights, camera.position, 1400 * k);
    placeNearest(pool.stand, venueLights.standLamps, camera.position, 700 * k);
    placeNearest(pool.street, venueLights.streetLamps, camera.position, 45 * k);
  }
  fadeLights(dt);
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  headlight.position.copy(camera.position).addScaledVector(fwd, 0.5).addScaledVector(up, -0.4);
  headlight.target.position.copy(camera.position).addScaledVector(fwd, 60).addScaledVector(up, -1.25);   // aim far: no hotspot at the bumper
  headlight.intensity = params.headlight && params.mode !== 'chase' ? 90 * Math.max(look.hl ?? 0.2, look.lights) : 0;   // in chase the car's own beams light the road
  const cell = 8;
  const cx = Math.round(camera.position.x / cell) * cell, cz = Math.round(camera.position.z / cell) * cell;
  if (cx !== sun.target.position.x || cz !== sun.target.position.z) {
    sun.target.position.set(cx, 0, cz);
    sun.position.set(cx, 0, cz).addScaledVector(SUN_DIR, 200);
    sun.shadow.needsUpdate = true;
  }

  life.update(t, dt, look.emissive * params.emissive);
  updateFx(t);
  field?.fx?.update(params.paused ? 0 : dt, FX_LIGHT[params.look] ?? FX_LIGHT.dusk, LOOKS[params.look]);
  people.update(dt, camera.position, camera);
  if (culler && params.cull && t - cullT > 0.2) { cullT = t; culler.k = params.cullDistance; cullStats = culler.update(camera.position); }

  // (aviation beacons pulse in their shader, each at its own phase: see life.js)

  renderer.info.reset();                       // count every pass of this frame, not just the last one
  rain.material.uniforms.uTime.value = t;
  wetUniforms.uWetTime.value = t;
  FINISH_FLOW.value = field?.hero && game?.session ? THREE.MathUtils.clamp(Math.abs(field.hero.speed) / 45, 0, 1) : 0;   // airflow over the paint: beads blow back
  if (field) wetCars(field.cars, camera);                                                                                // the road darkens under the cars
  rain.material.uniforms.uCam.value.copy(camera.position);
  finalPass.uniforms.uTime.value = t;
  updateSpeedBlur(dt, speed);
  scene.updateMatrixWorld();
  gpuTimer.begin();
  composer.render();
  gpuTimer.end();
  if (params.dynamicRes) {
    dynres.budgetMs = 1000 / params.fpsCap;
    dynres.sample(gpuTimer.supported ? gpuTimer.ms : wallDt * 1000, wallDt);
    const s = dynres.decide(params.renderScale);
    if (s !== null) { params.renderScale = s; resize(); }
  }

  frames++; fpsT += wallDt;
  if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  const info = renderer.info.render;
  sceneryExperiment?.sample({fps,gpuMs:gpuTimer.supported?gpuTimer.ms:NaN,calls:info.calls,triangles:info.triangles,scale:params.renderScale});
  const gpu = gpuTimer.supported && Number.isFinite(gpuTimer.ms) ? `   GPU ${gpuTimer.ms.toFixed(1)} ms` : '';
  if (DEV) hud.textContent = `${fps.toFixed(0)} fps${gpu}   ${info.calls} draw calls   ${(info.triangles / 1000).toFixed(0)}k tris\n` +
    `${params.look}   ${params.mode}   ${params.speedKmh} km/h   ${TEX}   ${params.quality === 'auto' ? device.tier + ' (auto)' : params.quality}` +
    `   scale ${params.renderScale}   culled ${cullStats.hidden} meshes + ${cullStats.culledInstances} instances` +
    driveLine();
}

// the hero car's readout when physics is on: speed, nitro tank, drift angle, surface
function driveLine() {
  const v = field?.physics && field.hero?.vehicle;
  if (!v) return '';
  const st = v.state, drift = st.drift > 0.5 ? `   DRIFT ${Math.abs(THREE.MathUtils.radToDeg(st.beta)).toFixed(0)}°` : '';
  const surf = v.wheels.find((w) => w.contact)?.surface?.name ?? 'air';
  return `\n${field.playerDrives ? 'you' : 'AI'} drive   ${(v.speed * 3.6).toFixed(0)} km/h   nitro ${(st.nitroTank * 100).toFixed(0)}%${st.nitroOn ? ' ON' : ''}${drift}   ${surf}` +
    `   [WASD/arrows, Space handbrake, Shift nitro, R reset]`;
}

// ------------------------------------------------------------------------------------------------ start

// A benchmark that does not trust rAF (the app pane throttles it): renders `frames` frames around the lap, each one
// forced to finish on the GPU (a 1-pixel readback), and reports CPU+GPU frame time with the scene's draw stats.
// bench(120, { width: 1920, height: 1080 }) measures at a fixed size instead of the window's.
async function bench(frames = 120, { width, height } = {}) {
  const gl = renderer.getContext(), px = new Uint8Array(4), times = [];
  const keep = { dist, mode: params.mode };
  params.mode = 'flythrough';
  if (width) {
    renderer.setPixelRatio(params.renderScale); composer.setPixelRatio(params.renderScale);
    renderer.setSize(width, height, false); composer.setSize(width, height);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(wetUniforms.uResolution.value);
    makeReflector();
  }
  if (culler && !params.cull) { culler.k = 1e9; culler.update(camera.position); }
  let calls = 0, tris = 0;
  for (let k = 0; k < frames; k++) {
    dist = (k / frames) * curveLength;
    placeOnPath();
    if (culler && params.cull) { culler.k = params.cullDistance; culler.update(camera.position); }
    life.update(k / 30, 1 / 30, LOOKS[params.look].emissive * params.emissive);
    camera.updateMatrixWorld(); people.update(1 / 30, camera.position, camera);
    updateFx(k / 30);
    scene.updateMatrixWorld();
    renderer.info.reset();
    const t0 = performance.now();
    composer.render();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    times.push(performance.now() - t0);
    calls += renderer.info.render.calls; tris += renderer.info.render.triangles;
    if (k % 10 === 9) await new Promise((r) => setTimeout(r, 0));   // let the page breathe
  }
  params.mode = keep.mode; dist = keep.dist;
  const size = `${renderer.domElement.width}x${renderer.domElement.height}`;
  if (width) resize();
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { gpu: device.gpu, tier: params.quality === 'auto' ? device.tier : params.quality, textures: TEX,
    frames, avgMs: +avg.toFixed(2), p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2), estFps: +(1000 / avg).toFixed(0),
    drawCalls: Math.round(calls / frames), trisK: Math.round(tris / frames / 1000), renderScale: params.renderScale,
    size };
}

async function benchModels(options) {
  if(benchmarking)throw Error('A benchmark is already running.');
  benchmarking=true;
  try{return await runModelBenchmark({field,scene,camera,renderer,composer,track},options);}
  finally{benchmarking=false;last=performance.now();}
}
// Small paired route check for this opt-in experiment. It freezes simulation while rendering,
// warms both material variants, alternates order, and restores every comparison setting.
async function benchScenery(frames=16,{width=960,height=540}={}) {
  if(!sceneryExperiment)throw Error('Open ?scenery=1 and start a drive first.');
  if(benchmarking)throw Error('A benchmark is already running.');
  const enabled={...sceneryExperiment.enabled},dynamic=params.dynamicRes;
  benchmarking=true;params.dynamicRes=false;
  try{
    for(const on of [false,true]){sceneryExperiment.setEnabled(on);await bench(6,{width,height});}
    const samples=[];
    for(const on of [false,true,true,false]){
      sceneryExperiment.setEnabled(on);
      samples.push({variant:on?'adaptive':'original',...await bench(frames,{width,height})});
    }
    return {note:'Render-only route samples; timings depend on this browser/GPU. Compare repeated pairs, not estimated FPS alone.',samples};
  }finally{
    for(const [key,on] of Object.entries(enabled))sceneryExperiment.setPart(key,on);
    params.dynamicRes=dynamic;benchmarking=false;last=performance.now();
  }
}
renderer.info.autoReset = false;
// console access for tuning; renderNow draws a frame immediately (the app's pane can stall rAF while it is scripted)
window.viewer = { THREE, composer, params, perf: PERF, glassVeil, LOOKS, setTrack, unloadVenue, ensureVenue, trackId: () => TRACK.id, applyAll, applyQuality, setLook, resize, makeReflector, renderer, jumpTo, scene, camera, controls, bench, benchModels,
  scenery:()=>sceneryExperiment, benchScenery,
  field: () => field,
  cheer: (k = 1) => { life.cheer(k); people.cheer(); }, people: people.count, peopleList: people.list, device,
  // dev: render one frame and save it as track-viewer/shots/<name>.png (works while the page is hidden)
  snap: async (name) => {
    if (params.mode === 'orbit') controls.update(); else if (params.mode === 'chase' && field?.hero) field.chase(camera, 1); else placeOnPath();
    camera.updateMatrixWorld();
    camera.updateMatrixWorld();
    for (let i = 0; i < 10; i++) people.update(0.05, camera.position, camera);   // a hidden page never ran the mixers
    updateFx(clock.getElapsedTime(), true);
    scene.updateMatrixWorld();
    composer.render();
    const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/png'));
    return fetch(`/__snap?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob }).then((r) => r.text());
  },
  renderNow: () => { if (params.mode === 'orbit') controls.update(); else if (params.mode === 'chase' && field?.hero) field.chase(camera, 1); else placeOnPath(); updateFx(clock.getElapsedTime(), true); scene.updateMatrixWorld(); renderer.info.reset(); composer.render(); } };
/** a fresh set of tail-light trails for the cars on track (each session has its own field) */
function newTrails(cars) {
  if (trails) { scene.remove(trails.mesh); trails.mesh?.geometry.dispose(); }
  trails = new Trails(scene); trails.attach(cars);
}

if (!DEV) {
  gui.hide(); hud.style.display = 'none'; loading.style.display = 'none';
  game = new Game({ params, camera, controls, device, applyAll, applyQuality, setLook, resize, newTrails, ensureVenue, prepareRaceRenderer, warmRace, setDriverHoardings:keys=>TRACK.has.hoardings?driverHoardings.set(keys,track):driverHoardings.clear(), clearDriverHoardings:()=>driverHoardings.clear(), get collisionUrl() { return U('collision'); }, track: () => track, setTrack, trackId: () => TRACK.id });
  game.screens.title.progress(0.15);
  window.game = game;
}
applyQuality();
Promise.all([load(),DEV?setLook(params.look):Promise.resolve()])
  .then(() => { game?.screens.title.progress(0.7); return garageRoom?.compile(field.hero); })
  .then(() => { loading.remove(); requestAnimationFrame(tick); })
  .catch((e) => { loading.textContent = 'failed to load: ' + e.message; console.error(e);game?.rejectVenue(e);game?.setBusy('Circuit could not load. Reload to retry.'); });
