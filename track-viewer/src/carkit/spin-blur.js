// Blurred rims (the racing-game fix for the wagon-wheel effect, as Assetto Corsa's rim_blur): a wheel turning more than ~0.25 rad between frames
// strobes. Its spokes jump close to half their spacing a frame (a 10-spoke rim at the game's 0.3 rad/frame cap flickered back and forth, the
// tyre lettering crawled), while a camera's shutter would smear them. Each wheel gets a disc over its outer face carrying the wheel itself
// spun through a full turn and averaged (baked once per car, face-on, under neutral light), lit like the car; it fades in with the wheel's
// turn per frame and covers the strobing spokes and lettering. The trailer recorder has real motion blur (trailer.js) and turns it off.
import * as THREE from 'three';

const SIZE = 256, TURNS = 36;
export const BLUR_FROM = 0.22, BLUR_FULL = 0.45;   // rad/frame: a 10-spoke rim (0.63 rad apart) starts to strobe near a third of its spacing

let stage = null;
function studio(env) {
  if (stage) { stage.scene.environment = env ?? null; return stage; }
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6a6a, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(0.4, 1, 1); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 1.0); fill.position.set(-0.6, -0.3, 1); scene.add(fill);   // neutral and even: the disc is relit by the venue
  scene.environment = env ?? null;
  const rt = new THREE.WebGLRenderTarget(SIZE, SIZE);   // no MSAA: readRenderTargetPixels reads a plain framebuffer (36 averaged turns smooth the edges anyway)
  return (stage = { scene, cam, rt, px: new Uint8Array(SIZE * SIZE * 4) });
}

/** a disc over each wheel's outer face carrying the wheel spun through a turn; returns the discs (hidden until the wheel turns fast) */
export function bakeSpinBlur(renderer, car, env) {
  const S = studio(env), discs = [], prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  for (const w of car.wheels) {
    const meshes = w.spin.children.filter((o) => o.isMesh);   // hidden or not: a car far off at the bake has its detail wheels hidden (the stand-in is a group, not a mesh)
    if (!meshes.length) continue;
    const box = new THREE.Box3(); for (const o of meshes) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); }
    // the spin group may be turned on the hub (some imports mirror a side's wheels by a half turn about y): the outward side is found in its own
    // frame, and the disc sits in a mount with the spin group's fixed turn (its x and y; z is the roll it spins by)
    const mount = new THREE.Group(); mount.name = 'spin-blur-mount'; mount.position.copy(w.spin.position); mount.rotation.set(w.spin.rotation.x, w.spin.rotation.y, 0, w.spin.rotation.order);
    const outward = new THREE.Vector3(0, 0, Math.sign(w.pivot.position.z) || 1).applyQuaternion(mount.quaternion.clone().invert());
    const R = Math.max(box.max.x, -box.min.x, box.max.y, -box.min.y) * 1.01, out = Math.sign(outward.z) || 1, face = out > 0 ? box.max.z : -box.min.z;
    const holder = new THREE.Group(); for (const o of meshes) holder.add(new THREE.Mesh(o.geometry, o.material));
    S.scene.add(holder);
    Object.assign(S.cam, { left: -R, right: R, top: R, bottom: -R }); S.cam.updateProjectionMatrix();
    S.cam.position.set(0, 0, out * 5); S.cam.up.set(0, 1, 0); S.cam.lookAt(0, 0, 0);
    const acc = new Float32Array(SIZE * SIZE * 4);
    renderer.setClearColor(0x000000, 0);
    for (let k = 0; k < TURNS; k++) {
      holder.rotation.z = (k / TURNS) * Math.PI * 2;
      renderer.setRenderTarget(S.rt); renderer.clear(); renderer.render(S.scene, S.cam);
      renderer.readRenderTargetPixels(S.rt, 0, 0, SIZE, SIZE, S.px);
      for (let i = 0; i < acc.length; i++) acc[i] += S.px[i];
    }
    S.scene.remove(holder);
    const data = new Uint8Array(SIZE * SIZE * 4);
    for (let i = 0; i < data.length; i += 4) {
      const a = acc[i + 3] / TURNS;                           // premultiplied by coverage: colour over the covered turns only
      for (let c = 0; c < 3; c++) data[i + c] = a > 0 ? Math.min(255, acc[i + c] / TURNS * (255 / a)) : 0;
      data[i + 3] = a;
    }
    const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat); tex.needsUpdate = true; tex.colorSpace = THREE.LinearSRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, roughness: 0.42, metalness: 0.35,   // a spinning rim keeps a soft radial sheen
      side: THREE.DoubleSide });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 48), mat);
    disc.name = 'spin-blur'; disc.position.z = out * (face + 0.002); if (out < 0) disc.rotation.y = Math.PI;   // faces outward; the picture was taken from outside
    disc.visible = false; disc.renderOrder = 2;
    mount.add(disc); w.pivot.add(mount); w.blur = disc; discs.push(disc);
    // the rim (every spinning mesh but the tyre, the widest): swapped out under a full disc, so an open rim's gaps show the static rotor and
    // caliper behind and not the strobing spokes (the Valkyrie's honeycomb showed through its half-covered disc); the tyre stays for its tread
    const widest = meshes.reduce((b, o) => (o.geometry.boundingBox.max.x > b.geometry.boundingBox.max.x ? o : b));
    w.rims = meshes.filter((o) => o !== widest);
  }
  renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevClear, prevAlpha);
  return discs;
}

/** per frame: the disc's opacity from the wheel's turn this frame (rad). near: the car shows its full wheels (else its LOD owns their visibility);
 *  real: the frames have real motion blur (the trailer recorder), so the real wheel spins and no disc */
export function spinBlur(w, turn, near, real) {
  const d = w.blur; if (!d) return;
  if (!near) { d.visible = false; return; }
  const a = real ? 0 : THREE.MathUtils.smoothstep(Math.abs(turn), BLUR_FROM, BLUR_FULL), rims = a < 0.97;
  d.visible = a > 0.01; d.material.opacity = a;
  if (w.rimsShown !== rims) { w.rimsShown = rims; for (const o of w.rims) o.visible = rims; }
}
