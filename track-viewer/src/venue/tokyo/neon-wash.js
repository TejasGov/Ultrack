// Neon wash on the walls: the facades, barriers and boards round a sign take its colour. A top-down light map of the signs' spill
// (signs.js, in the hues neon-signs gives them; 2 m texels, RGBA8: colour, and the height the light comes from in alpha) is made
// once; the facade and barrier materials sample it and add it as diffuse light, so it follows their albedo and their AO. Upright
// surfaces only (the ground has its own pools, light-pools.js), and only near the height of the signs that lit them, so the
// tunnel under the street or a roof far above stays dark. Night full, evening part, none by day. One texture fetch per fragment.
import * as THREE from 'three';
import { analyseSigns, PALETTE } from './signs.js';

const MATS = /^(V9 ad |V3 ivory$|V12 board |V10 (wood|cedar|red|tile)$|V9 (konc|grey)$|V13 white slab$|Concrete \| mineral$)/;
const TEXEL = 2, REACH = 14, SPREAD = 4.5, SCALE = 0.6, GAIN = 0.015;   // m per texel; one sign's reach; its falloff; storage range; radiance per unit
const K = { night: 1, bluehour: 0.6, dusk: 0.08, day: 0 };

export async function create({ root }) {
  const signs = analyseSigns(root).signs.filter((s) => s.style < 3);
  if (!signs.length) return { dispose() {} };
  const box = new THREE.Box3(); signs.forEach((s) => box.expandByPoint(s.pos)); box.expandByScalar(REACH);
  const W = Math.ceil((box.max.x - box.min.x) / TEXEL), H = Math.ceil((box.max.z - box.min.z) / TEXEL);
  const rgb = new Float32Array(W * H * 3), wy = new Float32Array(W * H), wsum = new Float32Array(W * H);
  for (const s of signs) {
    const p = PALETTE[s.hue], k = (s.style < 2 ? 1 : 0.55) * Math.min(1.6, Math.max(0.4, Math.sqrt(s.panel ? s.A : 1.5) / 1.5)) * p.k;
    const cx = (s.pos.x - box.min.x) / TEXEL, cz = (s.pos.z - box.min.z) / TEXEL, r = REACH / TEXEL;
    for (let z = Math.max(0, Math.floor(cz - r)); z <= Math.min(H - 1, Math.ceil(cz + r)); z++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) * TEXEL; if (d > REACH) continue;
        const e = k * (1 + (d / SPREAD) ** 2) ** -1.5 * (1 - (d / REACH) ** 4), i = z * W + x;
        rgb[i * 3] += p.c.r * e; rgb[i * 3 + 1] += p.c.g * e; rgb[i * 3 + 2] += p.c.b * e; wy[i] += s.pos.y * e; wsum[i] += e;
      }
    }
  }
  const y0 = box.min.y, yr = Math.max(1, box.max.y - box.min.y), data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.min(255, Math.round(Math.sqrt(Math.min(1, rgb[i * 3 + c] * 0.12 / SCALE)) * 255));   // sqrt: dim spill keeps precision
    data[i * 4 + 3] = wsum[i] > 0 ? Math.round(((wy[i] / wsum[i]) - y0) / yr * 255) : 0;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const uniforms = { uSpill: { value: tex }, uSpillBox: { value: new THREE.Vector4(box.min.x, box.min.z, 1 / (W * TEXEL), 1 / (H * TEXEL)) },
    uSpillY: { value: new THREE.Vector2(y0, yr) }, uSpillK: { value: 0 } };
  const FRAG = /* glsl */`
    uniform sampler2D uSpill; uniform vec4 uSpillBox; uniform vec2 uSpillY; uniform float uSpillK; varying vec3 vSpW;
  `;
  const ADD = /* glsl */`
    #include <lights_fragment_end>
    if (uSpillK > 0.0) {
      vec2 st = (vSpW.xz - uSpillBox.xy) * uSpillBox.zw;
      if (st.x > 0.0 && st.y > 0.0 && st.x < 1.0 && st.y < 1.0) {
        vec4 sp = texture2D(uSpill, st);
        float sy = uSpillY.x + sp.a * uSpillY.y;
        vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        float k = (1.0 - smoothstep(sy - 1.0, sy + 7.0, vSpW.y)) * smoothstep(sy - 16.0, sy - 9.0, vSpW.y) * (1.0 - smoothstep(0.55, 0.85, abs(nW.y)));
        reflectedLight.indirectDiffuse += sp.rgb * sp.rgb * ${(SCALE / 0.12 * GAIN).toFixed(3)} * uSpillK * k * material.diffuseColor;
      }
    }
  `;
  const patched = new Map();
  root.traverse((o) => {
    for (const m of [].concat(o.material ?? [])) {
      if (!o.isMesh || patched.has(m) || !MATS.test(m.name) || !m.isMeshStandardMaterial) continue;
      const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
      m.onBeforeCompile = function (sh, r) {
        prev?.call(this, sh, r);
        Object.assign(sh.uniforms, uniforms);
        sh.vertexShader = 'varying vec3 vSpW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vSpW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = FRAG + sh.fragmentShader.replace('#include <lights_fragment_end>', ADD);
      };
      m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|neon-wash'; };
      m.needsUpdate = true;
      patched.set(m, { prev, prevKey });
    }
  });
  console.info(`tokyo neon wash: ${signs.length} signs into a ${W} x ${H} light map (${TEXEL} m texels), ${patched.size} materials`);
  return {
    setLook(look, params) { uniforms.uSpillK.value = K[params?.look] ?? 0; },
    dispose() { tex.dispose(); for (const [m, p] of patched) { m.onBeforeCompile = p.prev; m.customProgramCacheKey = p.prevKey; m.needsUpdate = true; } },
  };
}
