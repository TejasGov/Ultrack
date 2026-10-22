// Rain in the air: GPU streaks that wrap around the camera. Moved out of main.js (main feeds uTime, uCam, uOpacity).
import * as THREE from 'three';

export function makeRain(count = 9000) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(count * 4);
  for (let i = 0; i < off.length; i++) off[i] = Math.random();
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(70, 26, 70) },
      uOpacity: { value: 0.5 }, uColor: { value: new THREE.Color(1.5, 1.55, 1.75) } },
    vertexShader: /* glsl */`
      attribute vec4 aOff; uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; varying float vA; varying vec2 vUv;
      void main() {
        vec3 p = aOff.xyz * uBox;
        p.y -= uTime * 24.0 * (0.8 + 0.4 * aOff.w);
        p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
        vec3 toCam = normalize(vec3(uCam.x - p.x, 0.0, uCam.z - p.z) + 1e-4);
        vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
        float d = distance(p, uCam);
        vec3 wp = p + side * position.x * max(0.014, d * 0.0016) + vec3(0.0, position.y * 0.6, 0.0);   // never under ~1.2 px wide: far rain stays a faint thread, not a shimmer
        vUv = vec2(position.x + 0.5, position.y);
        vA = smoothstep(uBox.x * 0.5, uBox.x * 0.2, d) * smoothstep(1.5, 6.0, d);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; uniform vec3 uColor; varying float vA; varying vec2 vUv;
      void main() {
        float a = uOpacity * vA * (1.0 - abs(vUv.x * 2.0 - 1.0)) * smoothstep(0.0, 0.4, vUv.y);
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}
