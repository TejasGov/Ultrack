// Stable lamp glows. A floodlight's lamp units, a 24 cm aviation beacon or a skyline roof light are smaller than a pixel
// a few hundred metres out: as the camera moves they fall between pixels and pop in and out, and bloom turns every
// pop into a halo switching on and off, which reads as distant lights flickering. Here every lamp is also a point
// sprite with a minimum on-screen size whose energy fades smoothly with distance, and the lamp meshes are dimmed below
// the bloom threshold (see dimLampMeshes), so the glow is stable at any range. One draw call for every lamp.
import * as THREE from 'three';

const MIN_PX = 3.0;

export class Glows {
  constructor() {
    this.items = [];          // { pos, color, size, dir (or null), pulse }
    this.uniforms = {
      uTime: { value: 0 }, uProj: { value: 800 }, uScale: { value: 1 }, uGain: { value: 1 },
      uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0 },
    };
  }

  add(pos, color, size, dir = null, pulse = false) {
    this.items.push({ pos: new THREE.Vector3(...pos), color: new THREE.Color(color), size, dir, pulse });
  }

  /** Floodlights (aimed, warm or cool), stand lamps (aimed down), street lamps (omni). */
  addLights(lights) {
    for (const l of lights.floodlights) {
      const dir = new THREE.Vector3(...l.target).sub(new THREE.Vector3(...l.pos)).normalize();
      this.add(l.pos, l.warm ? 0xffd6a8 : 0xe6eeff, 3.2, dir);
    }
    for (const l of lights.standLamps) this.add(l.pos, 0xfff0dc, 1.2, new THREE.Vector3(...l.target).sub(new THREE.Vector3(...l.pos)).normalize());
    for (const l of lights.streetLamps) this.add(l.pos, 0xffc890, 0.9);
  }

  /** Beacons: one glow per cluster of vertices of every *Beacon* material (masts, skyline roofs, service vehicles). */
  addBeacons(root) {
    const cells = new Map(), v = new THREE.Vector3(), m = new THREE.Matrix4(), w = new THREE.Matrix4();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mat = [].concat(o.material).find((x) => /Beacon/.test(x.name));
      if (!mat) return;
      const pos = o.geometry.attributes.position, n = o.isInstancedMesh ? o.count : 1;
      for (let k = 0; k < n; k++) {
        if (o.isInstancedMesh) { o.getMatrixAt(k, m); w.multiplyMatrices(o.matrixWorld, m); } else w.copy(o.matrixWorld);
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(w);
          const key = `${Math.round(v.x / 3)},${Math.round(v.y / 3)},${Math.round(v.z / 3)}`;
          const c = cells.get(key) || { sum: new THREE.Vector3(), n: 0, color: mat.emissive.clone() };
          c.sum.add(v); c.n++;
          cells.set(key, c);
        }
      }
    });
    for (const c of cells.values()) {
      const p = c.sum.divideScalar(c.n);
      // aviation lights read as small red points: dim, so the tone mapper keeps them red instead of bleaching them to
      // white blobs floating over the skyline
      const far = p.length() > 1500;
      this.add(p.toArray(), c.color.clone().multiplyScalar(far ? 0.3 : 0.45), far ? 1.2 : 0.7, null, true);
    }
  }

  build() {
    const n = this.items.length, g = new THREE.BufferGeometry();
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n), D = new Float32Array(n * 4);
    this.items.forEach((it, k) => {
      P.set(it.pos.toArray(), k * 3);
      C.set([it.color.r, it.color.g, it.color.b], k * 3);
      S[k] = it.size;
      if (it.dir) D.set([it.dir.x, it.dir.y, it.dir.z, 1], k * 4); else D.set([0, 0, 0, it.pulse ? 2 : 0], k * 4);
    });
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(C, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(S, 1));
    g.setAttribute('aDir', new THREE.BufferAttribute(D, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: /* glsl */`
        uniform float uTime, uProj, uScale, uFogDensity, uGain;
        attribute vec3 aColor; attribute float aSize; attribute vec4 aDir;
        varying vec3 vColor; varying float vCore;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 toCam = cameraPosition - wp.xyz;
          float dist = length(toCam);
          wp.xyz += toCam / max(dist, 1e-3) * min(1.5, dist * 0.5);   // pull in front of the lamp's own housing
          vec4 mv = viewMatrix * wp;
          float px = aSize * uProj * uScale / max(-mv.z, 0.1);
          gl_PointSize = max(${MIN_PX.toFixed(1)}, px * 2.2);
          float energy = clamp(px * px / ${(MIN_PX * MIN_PX).toFixed(1)}, 0.12, 1.0);   // shrinks smoothly instead of popping
          float face = 1.0;
          if (aDir.w > 0.5 && aDir.w < 1.5) face = mix(0.08, 1.0, smoothstep(-0.1, 0.6, dot(aDir.xyz, toCam / dist)));
          float pulse = 1.0;
          if (aDir.w > 1.5) {
            float ph = fract(sin(dot(floor(position.xz / 4.0), vec2(12.9898, 78.233))) * 43758.5453);
            pulse = 0.18 + 0.82 * smoothstep(0.25, 1.0, 0.5 + 0.5 * sin((uTime / 1.6 + ph) * 6.2832));
          }
          float fog = exp(-uFogDensity * uFogDensity * dist * dist * 0.6);
          vColor = aColor * energy * face * pulse * fog * (aDir.w > 1.5 ? 1.0 : uGain);   // beacons stay on in daylight
          vCore = clamp(px / 6.0, 0.0, 1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vColor; varying float vCore;
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(q, q);
          if (r2 > 1.0) discard;
          float halo = exp(-r2 * 5.0), core = exp(-r2 * 28.0);
          gl_FragColor = vec4(vColor * (core * mix(3.0, 1.6, vCore) + halo * 0.6), 1.0);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.name = 'lamp_glows';
    return this.points;
  }

  update(t, camera, height, fog, gain = 1) {
    this.uniforms.uTime.value = t;
    this.uniforms.uGain.value = gain;
    this.uniforms.uProj.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    if (fog) { this.uniforms.uFogDensity.value = fog.density; this.uniforms.uFogColor.value.copy(fog.color); } else this.uniforms.uFogDensity.value = 0;
  }
}

/** The lamp meshes keep a lit look up close but stay under the bloom threshold: the sprites carry the glow. */
export function dimLampMeshes(materials) {
  for (const m of materials) {
    if (/^M_Lamp(Warm|Cool)$|Beacon/.test(m.name) && m.userData.emissive0 !== undefined) m.userData.emissive0 *= 0.3;
  }
}
