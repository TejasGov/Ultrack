// India Ghat Circuit's runtime night details, loaded by main.js through tracks.js `venue` after the venue GLB.
//   barrier reflectors   amber retro-reflectors on the barrier face (track.json `reflectors`): a dull amber plate by day; at dusk and
//                        night they shine back when the car's lights reach them (bright near the camera, facing it), never blinking
//   bridge uplights      warm off-white fixtures at the foot of each portal leg (track.json `bridgeUplights`) with a soft wash up the leg
// The lit windows and the warm lamp heads are in the GLB ('IN window glow night' via tracks.js dayNight, 'M_LampWarm' via glow.js).
import * as THREE from 'three';

const AMBER = new THREE.Color(0xffb347), WARM = new THREE.Color(0xffe2b8);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ground, far ranges, cards and low scatter cast no shadow (main.js NO_CAST is Marina's names); trees, buildings, stands and walls do
const NO_CAST = /^(V5_terrain|V5_far|V5_river|water|India_racing_surface|Alternating_painted_kerbs|Edge_paint|scatter_cards|scatter_veg|IN_night_windows|Kavi_Chowk_clipped)/;

export async function create({ scene, root, track }) {
  root.traverse((o) => { if (o.isMesh && (NO_CAST.test(o.name) || NO_CAST.test(o.parent?.name ?? ''))) o.castShadow = false; });
  const group = new THREE.Group(); group.name = 'india venue fx'; scene.add(group);
  const dispose = [];
  let night = 0;

  // ---- barrier reflectors: one instanced plate, colour per instance from distance and facing to the camera
  const R = track.reflectors?.items ?? [];
  const plateGeo = new THREE.BoxGeometry(0.05, 0.08, 0.015);
  const plateMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const plates = new THREE.InstancedMesh(plateGeo, plateMat, R.length);
  plates.name = 'india reflectors';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s1 = new THREE.Vector3(1, 1, 1);
  const pos = R.map((r) => new THREE.Vector3(r[0], r[1], r[2])), face = R.map((r) => new THREE.Vector3(r[3], 0, r[4]).normalize());
  R.forEach((r, i) => { q.setFromAxisAngle(up, Math.atan2(r[3], r[4])); m.compose(pos[i], q, s1); plates.setMatrixAt(i, m); plates.setColorAt(i, AMBER); });
  plates.frustumCulled = false; group.add(plates); dispose.push(plateGeo, plateMat);
  const c = new THREE.Color(), toCam = new THREE.Vector3();

  // ---- bridge uplights: a fixture and an additive wash fading up each portal leg (night only)
  const U = track.bridgeUplights?.items ?? [];
  const fixGeo = new THREE.BoxGeometry(0.9, 0.35, 0.9), fixMat = new THREE.MeshBasicMaterial({ color: WARM.clone().multiplyScalar(0.4) });
  const washMat = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uColor: { value: WARM.clone() } },
    vertexShader: 'varying float vH; void main(){ vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK; uniform vec3 uColor; varying float vH; void main(){ float a = uK * pow(1.0 - vH, 2.2) * 0.55; gl_FragColor = vec4(uColor * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  for (const u of U) {
    const fix = new THREE.Mesh(fixGeo, fixMat); fix.position.set(u.pos[0], u.pos[1] + 0.18, u.pos[2]); group.add(fix);
    const h = Math.max(6, u.top);
    const washGeo = new THREE.CylinderGeometry(1.7, 2.3, h, 16, 1, true); washGeo.translate(0, h / 2, 0);
    const wash = new THREE.Mesh(washGeo, washMat); wash.position.set(u.pos[0], u.pos[1], u.pos[2]); wash.renderOrder = 2; group.add(wash); dispose.push(washGeo);
  }
  dispose.push(fixGeo, fixMat, washMat);

  return {
    setLook(look) {
      night = sstep(0.3, 0.9, look.dn ?? 0);
      washMat.uniforms.uK.value = sstep(0.5, 0.9, look.dn ?? 0);
      fixMat.color.copy(WARM).multiplyScalar(0.4 + 2.6 * washMat.uniforms.uK.value);
    },
    update(t, camera) {
      // retro-reflection: brightest straight back at the light source (the car / camera), a few metres to ~150 m, smooth in distance
      for (let i = 0; i < pos.length; i++) {
        toCam.subVectors(camera.position, pos[i]); const d = toCam.length();
        let k = 0.3;                                                      // a small dull amber plate by day, as on the real barriers
        if (night > 0 && d < 130) { toCam.y = 0; const f = Math.max(0, face[i].dot(toCam.normalize())); k += night * (1.6 * sstep(130, 10, d) * f * f - 0.15); }
        plates.setColorAt(i, c.copy(AMBER).multiplyScalar(Math.max(0.08, k)));
      }
      plates.instanceColor.needsUpdate = true;
    },
    dispose() { scene.remove(group); dispose.forEach((d) => d.dispose()); plates.dispose(); },
  };
}
