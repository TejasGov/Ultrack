// Flame tongues for exhaust pops: one additive billboard per tongue, stretched along the jet and the airflow (fx-pool.js `projected`
// + `base`: the tongue's root stays on the pipe as the picture sees it, so it streaks backwards from any camera).
// The shader paints it: a blue-white root, a yellow-orange body and a red, ragged tip; noise scrolls down the tongue so it licks
// within its few frames instead of blinking. Turbo cars tint it duller (fewer blue, more red).
import * as THREE from 'three';
import { Pool, rnd } from './fx-pool.js';

const TONGUE = /* glsl */`
  float x = vUv.x, y = (vUv.y - 0.5) * 2.0, t = vRot;                    // x: root 0 -> tip 1; y: across; t: age 0..1 (the pool age option)
  float n = vn(vec2(x * 3.0 - t * 5.0, vSeed * 31.0)) * 0.6 + vn(vec2(x * 7.5 - t * 9.0 + 4.0, vSeed * 13.0 + 2.0)) * 0.4;   // licks down the tongue
  float reach = 0.42 + 0.58 * smoothstep(0.0, 0.3, t);                  // the flame front runs out of the pipe
  float w = (1.0 - pow(x, 0.85)) * smoothstep(0.0, 0.05, x) * (0.6 + 0.8 * n);          // swells off the pipe, ends in a point
  float ridge = abs(y + (n - 0.5) * 1.5 * x), body = 1.0 - smoothstep(0.0, max(w * 1.3, 0.02), ridge);
  float br = vn(vec2(x * 13.0 - t * 14.0, y * 5.0 + vSeed * 7.0));
  body *= 1.0 - smoothstep(reach - 0.45, reach, x + (n - 0.5) * 0.45);
  body *= mix(1.0, smoothstep(0.25, 0.75, br), smoothstep(0.35, 0.9, x));    // the tip breaks up into wisps, no crisp end
  float heat = body * body * (1.0 - 0.75 * x) * (1.0 - 0.5 * t);
  if (body < 0.01) discard;
  vec3 col = mix(vec3(0.9, 0.16, 0.03), vec3(1.0, 0.82, 0.3), smoothstep(0.05, 0.6, heat));
  col = mix(col, vec3(0.6, 0.78, 1.25) * vCol, smoothstep(0.45, 0.9, heat) * (1.0 - smoothstep(0.0, 0.4, x)));   // blue-white root
  col *= mix(vec3(1.0), vCol, 0.5);
  gl_FragColor = vec4(col * body * (0.35 + 1.6 * heat) * (1.0 + 2.5 * (1.0 - smoothstep(0.0, 0.4, x))) * vAlpha * uGain * 4.0, 1.0);`;

// the hot core at the pipe tip: a camera-facing glow, HDR white-yellow in the middle (crosses the composer's bloom threshold) and an orange halo
const GLOW = /* glsl */`
  float r = length(vUv - 0.5) * 2.0, n = vn(vUv * 3.0 + vSeed * 17.0);
  float core = exp(-r * r * 16.0), halo = exp(-r * r * 4.0) * (0.8 + 0.4 * n) * (1.0 - smoothstep(0.75, 1.0, r));
  vec3 col = vec3(1.0, 0.92, 0.6) * core * 9.0 + vec3(1.0, 0.45, 0.1) * halo * 1.4;
  gl_FragColor = vec4(col * vAlpha * uGain * vCol.r, 1.0);`;

export class Flame {
  constructor() {
    this.pool = new Pool({ blending: THREE.AdditiveBlending, fragment: TONGUE, name: 'fx-tongue', stretch: 0.09, projected: true, base: true, attack: 0.2, age: true, gain: true, max: 400, order: 6 });
    this.glow = new Pool({ blending: THREE.AdditiveBlending, fragment: GLOW, name: 'fx-popglow', attack: 0.25, gain: true, max: 120, order: 6 });
  }

  /** the root glow of one pop (~0.3 m on screen, 0.22 m out of the pipe so the tip does not hide it), dimmer for turbo cars */
  core(p, d, v, sz, turbo) {
    this.glow.spawn(p.x + d.x * 0.22, p.y + d.y * 0.22, p.z + d.z * 0.22, v.x, v.y, v.z, 0, 0, 0, 0.07 + Math.random() * 0.03, 0.2 * sz, 0.3 * sz, 1, 1 - 0.35 * turbo, 1, 1, 1.5, 0, 0);
  }

  /** one pop's tongue at a pipe (p, d = exit direction, v = car velocity); 'tail' tongues fan out smaller; turbo 0..1 duller */
  lick(p, d, v, speed, sz, rpm, turbo, tail) {
    const k = Math.min(1, speed / 35) * 1.4, vl = Math.max(speed, 1e-3), s = tail ? 0.6 : 1;
    let x = d.x - v.x / vl * k + rnd(0.18), y = d.y + 0.12 + rnd(0.15), z = d.z - v.z / vl * k + rnd(0.18);          // the airflow bends it back
    const l = Math.hypot(x, y, z) || 1, m = (20 + 20 * rpm) * (1 - 0.3 * turbo) * s * (0.8 + 0.4 * Math.random()) / l;
    this.pool.spawn(p.x + d.x * 0.08, p.y + d.y * 0.08, p.z + d.z * 0.08, v.x + d.x * 2, v.y, v.z + d.z * 2, x * m, y * m, z * m,
      0.06 + Math.random() * 0.04, 0.2 * sz * s, 0.25 * sz * s, 1, 1, 1 - 0.3 * turbo, 1 - 0.5 * turbo, 0.5, 0, 0);
  }
}
