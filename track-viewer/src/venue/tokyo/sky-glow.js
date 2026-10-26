// City light pollution: a warm dome of haze over the skyline arc (track.json backdrop: radius 7 km around landmarks[0], bearings
// 82-141.6 deg clockwise from north, Tokyo Tower at 90.8 deg), brightest and warmest toward the tower, a dim violet band elsewhere.
// The view ray is intersected with the arc's own circle, so the glow sits behind the skyline from anywhere on the circuit. From the
// evening on, faint at dusk, none by day. An additive band of sky drawn after the clouds; it is in the wet-road mirror too.
// The sky's own night haze (sky.js: a warm sodium ring all round) and cloud light are set to match for Tokyo while it is loaded.
import * as THREE from 'three';
import { SKY_LOOKS } from '../../sky.js';

const ARC = { from: 82, to: 141.6, tower: 90.8 };
// HDR linear colours, before exposure: low = the horizon over the city, high = the dome above it, far = the rest of the horizon
const GLOW = { low: [0.16, 0.065, 0.06], high: [0.016, 0.011, 0.028], far: [0.007, 0.008, 0.017] };
// Tokyo's sky (sky.js uniforms) per look: haze ring, zenith tint, cloud light and shade
const SKY = {
  night: { haze: [0.012, 0.012, 0.026], zenith: [0.003, 0.005, 0.016], lit: [0.05, 0.043, 0.058], shade: [0.007, 0.008, 0.016] },
  bluehour: { haze: [0.16, 0.14, 0.24], zenith: [0.0, 0.01, 0.05], lit: [0.2, 0.22, 0.34], shade: [0.05, 0.06, 0.11] },
};

const FOG_DIR = THREE.ShaderLib.standard.uniforms.uFogSunDir?.value;     // main.js FOG_SUN.dir (uniform clones keep the array)
const CITY_DIR = (() => { const b = THREE.MathUtils.degToRad(102), e = THREE.MathUtils.degToRad(3); return [Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)]; })();

export async function create({ scene, track }) {
  const c = track.landmarks?.[0]?.pos ?? [0, 0, 0];
  const uniforms = {
    uCenter: { value: new THREE.Vector2(c[0], c[2]) }, uRadius: { value: track.backdrop?.radius ?? 7000 }, uK: { value: 0 },
    uLow: { value: new THREE.Vector3(...GLOW.low) }, uHigh: { value: new THREE.Vector3(...GLOW.high) }, uFar: { value: new THREE.Vector3(...GLOW.far) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec2 uCenter; uniform float uRadius, uK; uniform vec3 uLow, uHigh, uFar;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec2 o = cameraPosition.xz - uCenter, r = normalize(d.xz + vec2(1e-6));
        float b = dot(o, r), t = -b + sqrt(max(b * b - dot(o, o) + uRadius * uRadius, 0.0));
        vec2 p = o + r * t;                                                   // where the ray crosses the skyline's circle
        float brg = mod(degrees(atan(p.x, -p.y)) + 360.0, 360.0);             // clockwise from north (-z)
        float city = smoothstep(${(ARC.from - 24).toFixed(1)}, ${(ARC.from + 8).toFixed(1)}, brg) * (1.0 - smoothstep(${(ARC.to - 8).toFixed(1)}, ${(ARC.to + 26).toFixed(1)}, brg));
        float tower = exp(-pow((brg - ${ARC.tower.toFixed(1)}) / 16.0, 2.0));
        float e = max(d.y, 0.0), under = smoothstep(-0.06, 0.0, d.y);
        vec3 col = uFar * exp(-e / 0.1)
                 + city * (uLow * (0.55 + 0.45 * tower) * exp(-e / mix(0.055, 0.075, tower)) + uHigh * (0.6 + 0.4 * tower) * exp(-e / 0.22));
        gl_FragColor = vec4(col * under * uK, 1.0);
      }`,
  });
  // a band from 8 deg under the horizon to 55 deg up: the zenith is the HDRI's
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(8300, 96, 20, 0, Math.PI * 2, THREE.MathUtils.degToRad(35), THREE.MathUtils.degToRad(63)), mat);
  mesh.name = 'tokyo_sky_glow';
  mesh.frustumCulled = false; mesh.renderOrder = -9;     // after the clouds (sky.js, -10), before everything else transparent
  scene.add(mesh);
  const skyMesh = scene.children.find((o) => o.name === 'sky_clouds');
  let lookName = null;
  const setSky = (L) => {
    const u = skyMesh?.material.uniforms; if (!u || !L) return;
    for (const [k, v] of Object.entries({ haze: 'uHaze', zenith: 'uZenith', lit: 'uLit', shade: 'uShade' })) if (L[k]) u[v].value.setRGB(...L[k]);
  };
  return {
    setLook(look, params) {
      lookName = params?.look ?? null;
      const dn = look.dn ?? 1;
      uniforms.uK.value = THREE.MathUtils.smoothstep(dn, 0.2, 1) ** 1.5;      // dusk ~0.1, evening ~0.55, night 1
      mesh.visible = uniforms.uK.value > 0.001;
      setSky(SKY[lookName]);
      // at night the fog's sun-scatter term (main.js FOG_SUN, shared by every material) has no sun: aim it at the city instead, so
      // distant geometry toward the arc sinks into the same warm haze (its colour is the look's fogSun, tracks.js). main.js's
      // aimSun puts the sun back on every look change.
      if (dn > 0.85 && FOG_DIR) FOG_DIR.set(CITY_DIR);
    },
    update(t, camera) { mesh.position.copy(camera.position); },
    dispose() {
      scene.remove(mesh); mesh.geometry.dispose(); mat.dispose();
      setSky(SKY_LOOKS[lookName]);       // the next circuit gets sky.js's own colours back
    },
  };
}
