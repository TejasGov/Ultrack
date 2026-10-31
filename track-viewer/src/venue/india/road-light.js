// The lit road at night: the light the street lamps and the edge fixtures throw on the carriageway, for the whole lap at once. Lamp
// heads are not in the glTF and the six nearest real point lights (main.js pool.street) only reach ~60 m, so the road beyond them was
// black. The light is baked at load into the road map (layout.js roadMap: each lamp a pool E = (1 + (r/h)^2)^-1.5 centred a little
// toward the road, the edge fixtures a band along both barriers) and the road's own materials take it as irradiance (materials.js
// IN_ROADMAP): asphalt, kerb and line paint each reflect it by their albedo, so the lines keep their contrast and a wet road darkens
// under it like everything else. Fixed places, no draw call, no per-frame work but two gains: nothing jumps from lamp to lamp.
// (It replaced an additive ribbon over the road, which lit asphalt and paint alike: a flat grey sheet with the lines washed out.)
// The map's other two channels (rubber on the racing line, dust toward the edges) are surface detail, read by day too.
import * as THREE from 'three';
import { roadMap, lampPools } from './layout.js';

const LAMP_RGB = new THREE.Color('#ffe2b8'), EDGE_RGB = new THREE.Color('#eef0f4');
const LAMP_K = 20, EDGE_K = 18;   // irradiance of a pool's peak (right under a lamp) / of the band at the wall at gain 1: the asphalt (albedo
                                  // ~0.016) reflects ~0.1 there, as the additive light it replaces did (materials.js scales it down on paint)

/** -> { uniforms (tInRoad, uInRoad, uInLamp, uInEdge: shared by the road's materials), gain(lamp, edge), dispose() } */
export async function create({ track, lights }) {
  const t0 = performance.now();
  const pools = lampPools(track, (lights?.streetLamps ?? []).map((l) => ({ pos: l.pos })));     // colour: LAMP_RGB (every lamp is the same)
  const m = roadMap(track, pools);
  const tex = new THREE.DataTexture(m.data, m.w, m.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  const uniforms = {
    tInRoad: { value: tex },
    uInRoad: { value: new THREE.Vector4(m.x0 - m.cell / 2, m.z0 - m.cell / 2, 1 / (m.w * m.cell), 1 / (m.h * m.cell)) },   // texel centres on the grid points
    uInLamp: { value: new THREE.Color(0, 0, 0) }, uInEdge: { value: new THREE.Color(0, 0, 0) },
  };
  console.info(`india road map: ${pools.length} lamps, ${m.w} x ${m.h} texels (${((m.w * m.h * 16) / 3 / 1e6).toFixed(1)} MB with mips), ${Math.round(performance.now() - t0)} ms`);
  return {
    uniforms,
    /** lamp: gain of the lamp pools; edge: gain of the edge band (both 0 by day). x2: the map stores E / 2 */
    gain(lamp, edge) { uniforms.uInLamp.value.copy(LAMP_RGB).multiplyScalar(lamp * LAMP_K * 2); uniforms.uInEdge.value.copy(EDGE_RGB).multiplyScalar(edge * EDGE_K); },
    dispose() { tex.dispose(); },
  };
}
