// Coloured signage. The sign atlas is paper-white with dark or pastel glyphs, and its backing boards burned at ~4: after dark the
// street read as clipped white blocks with grey bloom. Here every sign (signs.js: panel + glyphs, one hue and one style each) is
// recoloured in the shader, by a per-vertex attribute, so a sign never mixes colours:
//   lit panel in its hue with dark glyphs (or white ones), or a dark panel with its glyphs lit in the hue like neon tubes;
//   text on the barrier ads stays dark print. The hue is used for the albedo too, so by day a lightbox reads as tinted acrylic.
// Emission is capped so the hue survives AgX (max channel ~2-4 at night, the bloom makes the halo), and it fades with the look.
// Every mesh with one of these materials gets the attribute; one the analysis did not cover keeps its own look (style 4).
// The emission follows the material's emissive level relative to the look's (uSignRef), so the car paint's reflection capture,
// which burns lit materials brighter for a moment (main.js captureBoost), reflects the signs brightly too.
// The materials' onBeforeCompile is chained (another part may patch them too) and the program key extended.
import * as THREE from 'three';
import { analyseSigns, PALETTE, GLYPHS, PANELS } from './signs.js';

const K = { day: 0.3, dusk: 0.6, bluehour: 0.85, night: 1 };      // emission per look
const FRAG = /* glsl */`
  varying vec2 vSign; uniform vec3 uPal[${PALETTE.length}]; uniform float uPalK[${PALETTE.length}]; uniform float uSignK, uSignRef;
`;
// the per-style colour: GLYPH or PANEL is defined per material
const MAP = /* glsl */`
  #include <map_fragment>
  int sHue = int(vSign.x + 0.5); float sSty = vSign.y; vec3 sCol = uPal[sHue];
  #ifdef SIGN_GLYPH
    if (sSty < 0.5 || (sSty > 2.5 && sSty < 3.5)) diffuseColor.rgb = vec3(0.03, 0.035, 0.06);        // dark glyphs, print
    else if (sSty < 1.5) diffuseColor.rgb = vec3(0.85);
    else if (sSty < 2.5) diffuseColor.rgb = sCol * 0.55;
  #else
    if (sSty < 1.5) diffuseColor.rgb = mix(vec3(0.9), sCol, 0.55);                                        // tinted acrylic
    else if (sSty < 2.5) diffuseColor.rgb = vec3(0.05);
  #endif
`;
const EMIT = /* glsl */`
  #include <emissivemap_fragment>
  float sBoost = max(max(emissive.r, emissive.g), emissive.b) / max(uSignRef, 1e-4);
  #ifdef SIGN_GLYPH
    if (sSty < 3.5) totalEmissiveRadiance = sSty < 0.5 || sSty > 2.5 ? vec3(0.0) : sSty < 1.5 ? vec3(1.0, 0.96, 0.9) * 1.5 * uSignK * sBoost : sCol * uPalK[sHue] * 3.0 * uSignK * sBoost;
  #else
    if (sSty < 3.5) totalEmissiveRadiance = sSty < 1.5 ? sCol * uPalK[sHue] * 2.6 * uSignK * sBoost : sCol * 0.04 * uSignK;
  #endif
`;

export async function create({ root }) {
  const { signs, attrs } = analyseSigns(root);
  const uniforms = { uPal: { value: PALETTE.map((p) => p.c.clone()) }, uPalK: { value: PALETTE.map((p) => p.k) }, uSignK: { value: 1 } };
  const patched = new Map(), meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.isInstancedMesh) return;
    const glyph = GLYPHS.test(o.material.name), panel = !glyph && PANELS(o);
    if (!glyph && !panel) return;
    let a = attrs.get(o);
    if (!a) { a = new Float32Array(o.geometry.attributes.position.count * 2); for (let i = 1; i < a.length; i += 2) a[i] = 4; }   // not analysed: keep its look
    meshes.push({ o, had: o.geometry.getAttribute('aSign') });
    o.geometry.setAttribute('aSign', new THREE.BufferAttribute(a, 2));
    const m = o.material;
    if (patched.has(m)) return;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey, tag = glyph ? 'SIGN_GLYPH' : 'SIGN_PANEL';
    const ref = { value: 1 };
    m.onBeforeCompile = function (sh, r) {
      prev?.call(this, sh, r);
      Object.assign(sh.uniforms, uniforms, { uSignRef: ref });
      sh.vertexShader = 'attribute vec2 aSign; varying vec2 vSign;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSign = aSign;');
      sh.fragmentShader = `#define ${tag}\n` + FRAG + sh.fragmentShader.replace('#include <map_fragment>', MAP).replace('#include <emissivemap_fragment>', EMIT);
    };
    m.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : '') + '|' + tag; };
    m.needsUpdate = true;
    patched.set(m, { prev, prevKey, ref });
  });
  const st = [0, 0, 0, 0]; signs.forEach((s) => st[s.style]++);
  console.info(`tokyo neon signs: ${signs.length} signs (lit+dark glyphs ${st[0]}, lit+white ${st[1]}, neon tubes ${st[2]}, print ${st[3]}), ${meshes.length} meshes, ${patched.size} materials`);
  return {
    setLook(look, params) {
      uniforms.uSignK.value = K[params?.look] ?? THREE.MathUtils.lerp(0.3, 1, look.dn ?? 1);
      for (const [m, p] of patched) p.ref.value = Math.max(m.emissive.r, m.emissive.g, m.emissive.b) * m.emissiveIntensity;   // applyAll set it just before
    },
    dispose() {
      for (const [m, p] of patched) { m.onBeforeCompile = p.prev; m.customProgramCacheKey = p.prevKey; m.needsUpdate = true; }
      for (const { o, had } of meshes) { if (had) o.geometry.setAttribute('aSign', had); else o.geometry.deleteAttribute('aSign'); }
    },
  };
}
