// Exhaust pops: per pop a fireball at the pipe tip and a flame tongue licking back. Both additive, both in HDR (the bloom catches the
// hot middle for a few frames), both ramp in over ~15 ms and burn out over ~60-120 ms: an event, never a blink.
//   fireball  camera-facing, so a pop seen end-on from behind the car still reads: a ragged ball that blooms out of the pipe, blue-white
//             at its heart for the first frames (the unburnt mixture lighting), then yellow, orange, and dull red at its licking edge
//   tongue    stretched along the jet and the airflow (fx-pool.js `projected` + `base`: its root stays on the pipe as the picture sees
//             it, so it streaks backwards from any camera); noise scrolls down it so it licks within its few frames
// Turbo cars pop smaller, duller and cooler (less blue, more red).
import * as THREE from 'three';
import { Pool, FIRE, rnd } from './fx-pool.js';

const TONGUE = /* glsl */`
  float x = vUv.x, y = (vUv.y - 0.5) * 2.0, t = vRot;                    // x: root 0 -> tip 1; y: across; t: age 0..1 (the pool age option)
  float n = vn(vec2(x * 3.0 - t * 5.0, vSeed * 31.0)) * 0.6 + vn(vec2(x * 7.5 - t * 9.0 + 4.0, vSeed * 13.0 + 2.0)) * 0.4;   // licks down the tongue
  float reach = 0.42 + 0.58 * smoothstep(0.0, 0.3, t);                  // the flame front runs out of the pipe
  float w = (1.0 - pow(x, 0.85)) * smoothstep(0.0, 0.05, x) * (0.6 + 0.8 * n);          // swells off the pipe, ends in a point
  float ridge = abs(y + (n - 0.5) * 1.5 * x), body = 1.0 - smoothstep(0.0, max(w * 1.3, 0.02), ridge);
  float br = vn(vec2(x * 13.0 - t * 14.0, y * 5.0 + vSeed * 7.0));
  body *= 1.0 - smoothstep(reach - 0.45, reach, x + (n - 0.5) * 0.45);
  body *= mix(1.0, smoothstep(0.25, 0.75, br), smoothstep(0.35, 0.9, x));    // the tip breaks up into wisps, no crisp end
  float heat = body * body * (1.0 - 0.75 * x) * (1.0 - 0.6 * t);
  if (body < 0.01) discard;
  vec3 col = mix(vec3(0.9, 0.16, 0.03), vec3(1.0, 0.78, 0.32), smoothstep(0.05, 0.6, heat));
  col = mix(col, vec3(0.55, 0.72, 1.3) * vCol, smoothstep(0.45, 0.9, heat) * (1.0 - smoothstep(0.0, 0.35, x)) * (1.0 - smoothstep(0.1, 0.45, t)));   // blue root, early
  col *= mix(vec3(1.0), vCol, 0.5);
  gl_FragColor = vec4(col * body * (0.35 + 1.6 * heat) * (1.0 + 2.0 * (1.0 - smoothstep(0.0, 0.4, x))) * vAlpha * uGain * 4.5, 1.0);`;

const BALL = /* glsl */`
  float t = vRot; vec2 d = vUv - 0.5; float r = length(d) * 2.0;
  float n = vn(d * 5.0 + vSeed * 17.0 + t * 2.5) * 0.6 + vn(d * 11.0 - vSeed * 5.0 - t * 4.0) * 0.4;
  float edge = 0.5 + 0.42 * n, body = 1.0 - smoothstep(edge * 0.45, edge, r);          // a ragged, licking edge
  float core = exp(-r * r * 12.0) * (1.0 - smoothstep(0.0, 0.5, t));
  if (body + core < 0.01) discard;
  vec3 col = mix(vec3(1.25, 0.95, 0.55), vec3(1.0, 0.42, 0.08), smoothstep(0.1, 0.55, t + r * 0.45));
  col = mix(col, vec3(0.55, 0.12, 0.02), smoothstep(0.5, 1.0, t + r * 0.35));
  col = mix(col, vec3(0.35, 0.55, 1.6) * vCol, (1.0 - smoothstep(0.0, 0.45, t)) * (1.0 - smoothstep(0.0, 0.4, r)));   // a blue heart, first frames
  float I = body * (0.8 + 2.0 * (1.0 - t)) + core * 4.0;      // hot, but its colour survives the tone mapping
  gl_FragColor = vec4(col * I * vAlpha * uGain * 1.5, 1.0);`;      // (no comment on the last line: fx-pool.js closes main() after it)

export class Flame {
  constructor() {
    this.pool = new Pool({ blending: THREE.AdditiveBlending, fragment: TONGUE, name: 'fx-tongue', stretch: 0.09, projected: true, base: true, attack: 0.18, age: true, gain: true, max: 400, order: 6 });
    this.glow = new Pool({ blending: THREE.AdditiveBlending, fragment: BALL, name: 'fx-popball', attack: 0.15, age: true, gain: true, max: 160, order: 6 });
  }

  step(dt) { this.pool.step(dt, FIRE); this.glow.step(dt, FIRE); }

  /** the fireball of one pop at the pipe tip (blooms from ~0.12 to ~0.45 m in 60-90 ms, riding with the car); turbo: cooler, smaller */
  core(p, d, v, sz, turbo) {
    const k = 1 - 0.3 * turbo;
    this.glow.spawn(p.x + d.x * 0.22, p.y + d.y * 0.22 + 0.01, p.z + d.z * 0.22, v.x + d.x * 1.5, v.y + 0.2, v.z + d.z * 1.5, 0, 0, 0,     // clear of the pipe and bumper
      0.06 + Math.random() * 0.035, 0.16 * sz * k, 0.7 * sz * k, 1, 1 - 0.4 * turbo, 1, 1, 6, 0, 0);
  }

  /** one pop's tongue at a pipe (p, d = exit direction, v = car velocity); 'tail' tongues fan out smaller; turbo 0..1 duller */
  lick(p, d, v, speed, sz, rpm, turbo, tail) {
    const k = Math.min(1, speed / 35) * 1.4, vl = Math.max(speed, 1e-3), s = tail ? 0.6 : 1;
    let x = d.x - v.x / vl * k + rnd(0.18), y = d.y + 0.12 + rnd(0.15), z = d.z - v.z / vl * k + rnd(0.18);          // the airflow bends it back
    const l = Math.hypot(x, y, z) || 1, m = (20 + 20 * rpm) * (1 - 0.3 * turbo) * s * (0.8 + 0.4 * Math.random()) / l;
    this.pool.spawn(p.x + d.x * 0.08, p.y + d.y * 0.08, p.z + d.z * 0.08, v.x + d.x * 2, v.y, v.z + d.z * 2, x * m, y * m, z * m,
      0.08 + Math.random() * 0.05, 0.22 * sz * s, 0.28 * sz * s, 1, 1, 1 - 0.3 * turbo, 1 - 0.5 * turbo, 0.5, 0, 0);
  }
}
