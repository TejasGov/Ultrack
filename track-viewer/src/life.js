// Things that move: team flags ripple, bunting sways, the crowd bobs and jumps (harder when cheer() is called),
// the big screen shows live timing, LED perimeter boards cycle, the canopy's LED lattice pulses in waves, the hotel
// crown drifts through violet hues, and the open water ripples. All in shaders or a few uniforms: no per-frame CPU work
// beyond one small canvas redraw every half second.
import * as THREE from 'three';

export const uTime = { value: 0 };
const uCheer = { value: 0.25 };          // 0.25 = idle crowd, 1 = big moment (decays back)
let cheerTarget = 0.25;

// chain onto any onBeforeCompile already set (wetify) and keep a distinct program cache key
function patch(mat, key, fn) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (shader, r) => { prev?.call(mat, shader, r); shader.uniforms.uTime = uTime; shader.uniforms.uCheer = uCheer; fn(shader); };
  mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + key;
  mat.needsUpdate = true;
}
const HEAD = 'uniform float uTime, uCheer;\n';
// Displacements are written in metres. The web GLB is quantized: a mesh's local units are scaled by its node (and
// instance) transform, by hundreds for a mesh that spans the venue, so divide by that scale or a 16 cm sway becomes
// a slab in the sky.
const INSTANCE_PHASE = /* glsl */`
  float phase = 0.0;
  float qScale = length(modelMatrix[0].xyz);
  #ifdef USE_INSTANCING
    phase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
    qScale *= length(instanceMatrix[0].xyz);
  #endif`;

// flags: the cloth's u runs from the pole (0) to the free end (1); ripple grows toward the end
function flag(mat) {
  patch(mat, '|flag', (s) => {
    s.vertexShader = HEAD + s.vertexShader.replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
      ${INSTANCE_PHASE}
      float u = clamp(uv.x, 0.0, 1.0);
      float w = sin(u * 9.0 - uTime * 7.5 + phase) * 0.6 + sin(u * 4.0 - uTime * 4.3 + phase * 1.7) * 0.4;
      transformed.y += w * 0.2 * u / qScale;
      transformed.z += sin(u * 6.0 - uTime * 6.0 + phase) * 0.06 * u / qScale;`);
  });
}

// bunting: each pennant's tip (aSway = 1) swings downwind; its top stays on the cable
function bunting(mesh) {
  const g = mesh.geometry, pos = g.attributes.position, n = pos.count;
  const sway = new Float32Array(n);
  const idx = g.index ? g.index.array : null;
  const tri = idx ? idx.length : n;
  for (let t = 0; t < tri; t += 3) {
    const v = [0, 1, 2].map((k) => (idx ? idx[t + k] : t + k));
    const low = v.reduce((a, b) => (pos.getY(b) < pos.getY(a) ? b : a));
    sway[low] = 1;
  }
  g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  patch(mesh.material, '|bunting', (s) => {
    s.vertexShader = HEAD + 'attribute float aSway;\n' + s.vertexShader.replace('#include <begin_vertex>', /* glsl */`#include <begin_vertex>
      ${INSTANCE_PHASE}
      vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
      float ph = wp.x * 0.21 + wp.z * 0.17;
      transformed.x += aSway * (0.16 + 0.1 * sin(uTime * 2.6 + ph)) / qScale;
      transformed.z += aSway * 0.07 * sin(uTime * 3.4 + ph * 1.3) / qScale;`);
  });
}

// crowd: 14 people per texture tile along each strip. Each person gets a phase from its cell and world position;
// a share of them bob, and on cheer() most jump. The texture lookup (colour and phone glow) shifts, so people move.
function crowd(mat) {
  patch(mat, '|crowd', (s) => {
    s.vertexShader = 'varying vec3 vCrowdW;\n' + s.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n  vCrowdW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = HEAD + 'varying vec3 vCrowdW;\nfloat crowdHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.7); }\n' +
      s.fragmentShader
        .replace('#include <map_fragment>', /* glsl */`
          vec2 cuv = vMapUv;
          {
            float cell = floor(cuv.x * 14.0);
            float h = crowdHash(vec2(cell, floor(vCrowdW.y * 2.0)));
            float joins = step(1.0 - (0.25 + 0.65 * uCheer), h);     // more of them join in as the cheer rises
            float rate = 1.6 + 2.4 * uCheer + h;
            float hop = pow(max(0.0, sin(uTime * rate + h * 6.283)), 4.0);
            cuv.y -= hop * joins * (0.015 + 0.06 * uCheer);
          }
          #ifdef USE_MAP
            diffuseColor *= texture2D(map, cuv);
          #endif`)
        .replace('#include <emissivemap_fragment>', /* glsl */`
          #ifdef USE_EMISSIVEMAP
            totalEmissiveRadiance *= texture2D(emissiveMap, cuv).rgb;
          #endif`);
  });
}

// aviation beacons (masts, skyline roofs) and service-vehicle lamps: a soft ~1 Hz pulse, each lamp at its own phase
// from its world position. A hard flash, all in sync, read as distant flicker.
function beacon(mat) {
  patch(mat, '|beacon', (s) => {
    s.vertexShader = 'varying vec3 vBeaconW;\n' + s.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n  vBeaconW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = HEAD + 'varying vec3 vBeaconW;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
      {
        float ph = fract(sin(dot(floor(vBeaconW.xz / 4.0), vec2(12.9898, 78.233))) * 43758.5453);
        float pulse = 0.5 + 0.5 * sin((uTime / 1.6 + ph) * 6.2832);
        totalEmissiveRadiance *= 0.18 + 0.82 * smoothstep(0.25, 1.0, pulse);
      }`);
  });
}

// water: animated normal ripples (view-space nudge from two travelling noise octaves) so its reflections shimmer
export function water(mat) {
  patch(mat, '|water', (s) => {
    s.fragmentShader = HEAD + s.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
      {
        vec2 p = vWPos.xz;
        float a = vnoise(p * 0.35 + vec2(uTime * 0.25, uTime * 0.1)) - 0.5;
        float b = vnoise(p * 1.3 - vec2(uTime * 0.4, -uTime * 0.3)) - 0.5;
        float c = vnoise(p.yx * 0.5 + vec2(-uTime * 0.2, uTime * 0.3)) - 0.5;
        normal = normalize(normal + (viewMatrix * vec4(a * 0.22 + b * 0.08, 0.0, c * 0.22 - b * 0.06, 0.0)).xyz);
      }`);
  });
}

// ------------------------------------------------------------------------------------------------ live timing screen

const DRIVERS = ['NOVARIS', 'KOVALD', 'TERRANO', 'SOLENNE', 'BRAXEN', 'ISKRA', 'OSTARA', 'HELMSTAD'];
const COLORS = ['#1a3a9e', '#b4101a', '#0d6b38', '#e6e6ea', '#2ec4f2', '#f2700d', '#7a2a8a', '#9aa4ad'];
function makeScreen(mat) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 585;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;               // glTF UV convention
  tex.anisotropy = 8;
  mat.map = tex; mat.emissiveMap = tex;
  mat.color.set(0xffffff); mat.emissive.set(0xffffff);
  mat.needsUpdate = true;
  const order = DRIVERS.map((_, k) => k);
  let lap = 1, lastSwap = 0;
  return (t) => {
    if (t - lastSwap > 6) {        // an overtake now and then
      lastSwap = t;
      const k = 1 + Math.floor(Math.random() * (order.length - 1));
      [order[k - 1], order[k]] = [order[k], order[k - 1]];
      if (Math.random() < 0.3) lap = Math.min(24, lap + 1);
    }
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#060a18'); bg.addColorStop(1, '#0b1430');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.font = '700 46px system-ui, sans-serif'; g.textBaseline = 'middle';
    g.fillStyle = (t % 1.2) < 0.7 ? '#ff2a2a' : '#5a0a0a';
    g.beginPath(); g.arc(60, 205, 13, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.fillText('LIVE', 86, 207);
    g.textAlign = 'right'; g.fillText(`LAP ${lap} / 24`, c.width - 46, 207); g.textAlign = 'left';
    order.slice(0, 6).forEach((d, row) => {
      const y = 268 + row * 50;
      g.fillStyle = row % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
      g.fillRect(40, y - 22, c.width - 80, 46);
      g.fillStyle = COLORS[d]; g.fillRect(40, y - 22, 10, 46);
      g.fillStyle = '#fff'; g.font = '700 34px system-ui, sans-serif';
      g.fillText(String(row + 1), 70, y + 2);
      g.fillText(DRIVERS[d], 130, y + 2);
      g.textAlign = 'right'; g.fillStyle = row ? '#cfd6e6' : '#ffd84a';
      g.fillText(row ? `+${(row * 1.37 + (t % 1) * 0.1).toFixed(3)}` : 'LEADER', c.width - 60, y + 2);
      g.textAlign = 'left';
    });
    tex.needsUpdate = true;
  };
}

// ------------------------------------------------------------------------------------------------ wiring

let drawScreen = null, screenT = -1, ledBands = [], crown = null;

/** Call once per mesh while traversing the loaded scene. */
export function attach(o) {
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of mats) {
    if (m.userData.life) continue;
    m.userData.life = true;
    if (m.name.startsWith('M_Flag_')) flag(m);
    else if (m.name === 'M_Bunting') bunting(o);
    else if (m.name === 'M_Crowd') { crowd(m); m.userData.emissive0 *= 0.35; }   // phone screens: a hint, not sparkle
    else if (/Beacon/.test(m.name)) beacon(m);
    // the Canopy's hex lattice and arch LEDs burn steady (a travelling wave crawled along the thin bars like flicker);
    // the lattice casts no shadow: three's shadow pass ignores blended alpha, so it would shade like a solid sheet
    else if (m.name === 'M_CanopyHex') o.castShadow = false;
    else if (m.name === 'M_ScreenGlow') drawScreen = makeScreen(m);
    else if (m.name === 'M_ScreenText') m.visible = false;      // static fallback text; the canvas replaces it
    else if (/_ledband_/.test(m.name)) ledBands.push(m);
    else if (m.name === 'M_HotelCrown') crown = m;
    else if (m.name === 'M_StandGlass') { m.transparent = true; m.opacity = 0.22; m.depthWrite = false; }   // see the front row through it
    else m.userData.life = false;
  }
}

/** A big moment (overtake, win, crash): the crowd jumps, then settles over a few seconds. */
export function cheer(amount = 1) { cheerTarget = Math.max(cheerTarget, amount); }

const hsl = { h: 0, s: 0, l: 0 };
/** Per frame. emissiveScale = the look's emissive level x the user's slider (main.js applyAll uses the same). */
export function update(t, dt, emissiveScale) {
  uTime.value = t;
  uCheer.value += (cheerTarget - uCheer.value) * Math.min(1, dt * 3);
  cheerTarget += (0.25 - cheerTarget) * Math.min(1, dt * 0.35);
  if (drawScreen && t - screenT > 0.5) { screenT = t; drawScreen(t); }
  // LED perimeter boards: a slow, smooth brightness wave runs through the sponsors (a hard 0.6 s flare read as flicker)
  ledBands.forEach((m, k) => {
    const wave = 0.5 + 0.5 * Math.cos(t * 0.5 - (k / ledBands.length) * Math.PI * 2);
    m.emissiveIntensity = (m.userData.emissive0 ?? 1) * emissiveScale * (0.9 + 0.35 * wave * wave);
  });
  if (crown) {
    crown.emissive.getHSL(hsl);
    crown.emissive.setHSL(0.76 + 0.06 * Math.sin(t * 0.15), hsl.s, hsl.l);
  }
}
