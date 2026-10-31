// The lit road at night: the light the street lamps and the edge fixtures throw on the carriageway, for the whole lap at once. Lamp
// heads are not in the glTF and the six nearest real point lights (main.js pool.street) only reach ~60 m, so the road beyond them was
// black. Here one additive ribbon lies over the road (every vertex dropped onto the road meshes), its vertices carrying the light baked
// at load: each lamp a pool E = (1 + (r/h)^2)^-1.5 centred a little toward the road (a luminaire throws inward), the edge fixtures a
// band along both barriers (grazing, so the same law with a small h). Fixed places, one draw call, no per-frame work but two gains:
// nothing jumps from lamp to lamp, and the road is exactly the ribbon (no card spilling over the barrier into the gorge).
// Tokyo's light-pools.js is the same idea for a city of scattered sources (its cards; the ground lookup is shared).
import * as THREE from 'three';
import { groundField } from '../tokyo/light-pools.js';
import { roadGrid, lampPools, lampLight, edgeLight, FACE } from './layout.js';

const ROAD = /^(India_racing_surface|Alternating_painted_kerbs|Edge_paint)/;      // the meshes the ribbon may lie on
const LAMP_RGB = new THREE.Color('#ffe2b8'), EDGE_RGB = new THREE.Color('#eef0f4');
const LAMP_K = 0.12, EDGE_K = 0.11;     // linear radiance of the lamp pool's peak (right under a lamp) / of the band at the wall; gains scale them
const LIFT = 0.05;                      // over the road (and the polygon offset): the road is crowned and the ribbon's cells are planar

const VS = /* glsl */`
  attribute vec3 aLamp, aEdge; varying vec3 vL, vE; varying float vDepth;
  void main() {
    vL = aLamp; vE = aEdge;
    vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0); vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const FS = /* glsl */`
  uniform float uLamp, uEdge, uFogD; varying vec3 vL, vE; varying float vDepth;
  void main() { gl_FragColor = vec4((vL * uLamp + vE * uEdge) * exp(-uFogD * uFogD * vDepth * vDepth), 1.0); }`;

export async function create({ scene, root, track, lights, NO_MIRROR }) {
  const t0 = performance.now();
  const height = groundField(root, (o) => ROAD.test(o.name));
  const pools = lampPools(track, (lights?.streetLamps ?? []).map((l) => ({ pos: l.pos, rgb: new THREE.Color(l.color ?? LAMP_RGB).toArray() })));
  const g = roadGrid(track), { cols, m } = g, nv = g.rows.length;
  const P = new Float32Array(nv * 3), LA = new Float32Array(nv * 3), ED = new Float32Array(nv * 3), rgb = [0, 0, 0];
  const Y = new Float32Array(nv).fill(NaN);
  g.rows.forEach((r, i) => {
    const y = height(r.x, r.z, r.yRoad + 1.2);
    if (y !== null) Y[i] = y;
  });
  let lost = 0;
  g.rows.forEach((r, i) => {     // the outermost columns lie beyond the kerb meshes: they take the height of the column inside
    if (Number.isNaN(Y[i])) {
      lost++; const c = i % cols, y = c === 0 ? Y[i + 1] : c === cols - 1 ? Y[i - 1] : NaN;
      Y[i] = Number.isNaN(y) ? r.yRoad : y;
    }
    P.set([r.x, Y[i] + LIFT, r.z], i * 3);
    lampLight(pools, r.x, r.z, rgb); LA.set([rgb[0] * LAMP_K, rgb[1] * LAMP_K, rgb[2] * LAMP_K], i * 3);
    const e = edgeLight(FACE - Math.abs(r.lat)) * r.w * EDGE_K;
    ED.set([EDGE_RGB.r * e, EDGE_RGB.g * e, EDGE_RGB.b * e], i * 3);
  });
  const IX = new Uint32Array(m * (cols - 1) * 6); let f = 0;
  for (let j = 0; j < m; j++) for (let c = 0; c < cols - 1; c++) {
    const a = j * cols + c, b = ((j + 1) % m) * cols + c;
    IX.set([a, a + 1, b, a + 1, b + 1, b], f); f += 6;      // forward x left = up: counter-clockwise seen from above
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('aLamp', new THREE.BufferAttribute(LA, 3));
  geo.setAttribute('aEdge', new THREE.BufferAttribute(ED, 3));
  geo.setIndex(new THREE.BufferAttribute(IX, 1));
  geo.computeBoundingSphere();
  const uniforms = { uLamp: { value: 0 }, uEdge: { value: 0 }, uFogD: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'india_road_light';
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.castShadow = mesh.receiveShadow = false;
  mesh.layers.set(NO_MIRROR);            // it lies on the mirror plane: nothing to reflect
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  console.info(`india road light: ${pools.length} lamps, ${m} x ${cols} ribbon, ${IX.length / 3} tris${lost ? `, ${lost} outer vertices beyond the road meshes` : ''}, ${Math.round(performance.now() - t0)} ms`);
  return {
    /** lamp: gain of the lamp pools; edge: gain of the edge band (both 0 by day) */
    gain(lamp, edge) { uniforms.uLamp.value = lamp; uniforms.uEdge.value = edge; mesh.visible = lamp + edge > 0.001; },
    update() { uniforms.uFogD.value = scene.fog?.density ?? 0; },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
