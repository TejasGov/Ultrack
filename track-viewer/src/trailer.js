// Trailer camera (dev: window.trailer, driven by scripts/trailer-record.mjs). A rig replaces the chase camera while it is set:
//   car:   { kind: 'car', car, at: [right, up, back], look: [right, up, ahead], fov, lag }  fixed in the car's frame; `lag` s smooths the
//          heading only, so the car never drifts in frame at speed (drone: at [0, 30, 0.1], look [0, 0, 1]; nitro: at [0.4, 0.4, -0.3])
//   track: { kind: 'track', u, at: [lat, h], look: 'car' | [ahead, lat, h], fov, lag, car }  a point `u` m along the racing line from the
//          start, `lat` m left of it and `h` m over the road; it aims at the car (aim smoothed by `lag` s) or along the track
// Any number (or vector) may be keys [[t, v], ...] in rig seconds (eased in-out between keys), e.g. a dolly zoom: at [0, 1.2, [[0, 4], [1.5, 10]]]
// with fov [[0, 30], [1.5, 60]]. `speed` (keys too) scales game time: slow motion and ramps. `car` is 'hero', an index or a car key.
// `ctl` { nitro, handbrake, throttle, brake, steer } (keys too) overrides the hero's AI controls while the rig is set.
// record() advances the game a fixed 1/fps per frame (times speed) and posts every frame as a PNG to the dev server
// (qa/trailer_<name>/00001.png ...), holding the game until each one lands: frame-exact plates however slow the machine.
// Motion blur (blur = 8 sub-frames, shutter = 0.5, a film camera's 180 deg): each frame is the mean of `blur` renders spread over the open
// shutter, then the game runs the closed part unseen. Wheels spin at their true rate meanwhile (field.trueSpin): the game's 0.3 rad/frame
// cap, there against wagon-wheel strobing, turned them at a fifth of road speed at 110 km/h; under the blur the spokes smear as on film.
import * as THREE from 'three';
import { spring } from './camera.js';

const isKeys = (x) => Array.isArray(x) && x.length > 0 && x.every((k) => Array.isArray(k) && typeof k[0] === 'number' && k.length === 2);
const lerp = (a, b, s) => (Array.isArray(a) ? a.map((v, i) => lerp(v, b[i], s)) : a + (b - a) * s);
/** a rig value at rig time t: a number, a vector of values, or keys */
export function val(x, t) {
  if (isKeys(x)) {
    if (t <= x[0][0]) return val(x[0][1], t);
    for (let i = 1; i < x.length; i++) if (t <= x[i][0]) {
      const [t0, a] = x[i - 1], [t1, b] = x[i], s = (t - t0) / Math.max(1e-6, t1 - t0);
      return lerp(val(a, t), val(b, t), 0.5 - 0.5 * Math.cos(Math.PI * s));
    }
    return val(x.at(-1)[1], t);
  }
  return Array.isArray(x) ? x.map((v) => val(v, t)) : x;
}
console.assert(Math.abs(val([[0, 0], [1, 10]], 0.5) - 5) < 1e-9 && Math.abs(val([1, [[0, 2], [2, 4]]], 1)[1] - 3) < 1e-9 && val(7, 3) === 7, 'trailer val');

const UP = new THREE.Vector3(0, 1, 0);

export class Trailer {
  constructor() { this.rig = null; this.rec = null; this.t = 0; this.busy = false; }
  set(rig) { this.rig = rig; this.tau = 0; this.yaw = null; this.aim = null; this.lift = null; return true; }
  clear() { this.rig = null; this.rec = null; }
  /** game seconds this frame: a fixed step while recording, else the frame's own; both scaled by the rig's speed */
  step(dt) {
    const r = this.rec;
    const out = !r ? dt : r.sub < r.blur ? r.shutter / r.fps / r.blur : (1 - r.shutter) / r.fps;   // open-shutter sub-frames, then the closed rest
    this.tau = (this.tau ?? 0) + out;
    const g = out * Math.max(0, val(this.rig?.speed ?? 1, this.tau));
    this.t += g; this.out = out;
    return g;
  }
  carOf(field, c = 'hero') {
    if (c === 'hero' || c === undefined) return field.hero;
    return typeof c === 'number' ? field.cars[c] : field.cars.find((x) => x.key === c) ?? field.hero;
  }
  /** metres along the racing line from the start to the car's nearest point */
  along(field, car) {
    const c = this.carOf(field, car), i = field.nearestLine(c.root.position);
    return (i / field.N) * field.length;
  }
  /** a point `u` m along the racing line, `lat` m left of it, interpolated between the line's samples (4-5 m apart: snapping to them stepped a moving camera) */
  linePoint(field, u, lat = 0) {
    const N = field.N, s = ((((u / field.length) * N) % N) + N) % N, i = Math.floor(s), j = (i + 1) % N, k = s - i;
    return field.linePts[i].clone().lerp(field.linePts[j], k).addScaledVector(field.lineLeft[i].clone().lerp(field.lineLeft[j], k).normalize(), lat);
  }
  /** the car's position with its bounce taken out: the road height under it, fed forward, plus a slow spring (5 rad/s) on its height above
   *  the road. The arcade suspension pogos ~5 cm at 3 Hz over kerbs; a camera bolted to the body shook with it */
  steady(field, c, dt) {
    const p = c.root.position, N = field.N, i = field.nearestLine(p), a = field.linePts[(i - 1 + N) % N], b = field.linePts[(i + 1) % N];
    const ab = b.clone().sub(a), s = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1), road = a.y + (b.y - a.y) * s, off = p.y - road;
    if (this.lift?.car !== c) this.lift = { car: c, y: off, v: 0 }; else [this.lift.y, this.lift.v] = spring(this.lift.y, this.lift.v, off, 5, dt);
    return new THREE.Vector3(p.x, road + this.lift.y, p.z);
  }
  place(camera, field) {
    const R = this.rig, t = this.tau, dt = this.out ?? 1 / 60, c = this.carOf(field, R.car);
    if (!c) return;
    field.trueSpin = (this.rec?.blur ?? 1) > 1; field.forceDetail = !!this.rec;
    if (R.ctl) field.ctlOver = Object.fromEntries(Object.entries(R.ctl).map(([k, x]) => [k, val(x, t)]));   // the hero's controls over the AI, keys too (a handbrake pull)
    const p = this.steady(field, c, dt), fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(c.root.quaternion).setY(0).normalize();
    const lag = val(R.lag ?? 0, t);
    if (R.kind === 'car') {
      const yaw = Math.atan2(fwd.z, fwd.x);
      if (this.yaw === null || !lag) this.yaw = [yaw, 0];
      else { const d = Math.atan2(Math.sin(yaw - this.yaw[0]), Math.cos(yaw - this.yaw[0])); this.yaw = spring(this.yaw[0], this.yaw[1], this.yaw[0] + d, 1 / lag, dt); }
      const f = new THREE.Vector3(Math.cos(this.yaw[0]), 0, Math.sin(this.yaw[0])), right = new THREE.Vector3().crossVectors(f, UP);
      const [ar, au, ab] = val(R.at ?? [0, 1.2, 5], t), [lr, lu, la] = val(R.look ?? [0, 0.6, 4], t);
      camera.position.copy(p).addScaledVector(right, ar).addScaledVector(UP, au).addScaledVector(f, -ab);
      camera.up.copy(UP); camera.lookAt(p.clone().addScaledVector(right, lr).addScaledVector(UP, lu).addScaledVector(f, la));
    } else {
      const u = val(R.u ?? 0, t), [lat, h] = val(R.at ?? [8, 1.2], t);
      camera.position.copy(this.linePoint(field, u, lat)).addScaledVector(UP, h);
      let target;
      if (Array.isArray(R.look)) { const [ahead, l2, h2] = val(R.look, t); target = this.linePoint(field, u + ahead, l2).addScaledVector(UP, h2); }
      else target = p.clone().addScaledVector(UP, 0.6);
      if (!this.aim || !lag) this.aim = [target.clone(), new THREE.Vector3()];
      else for (const k of ['x', 'y', 'z']) [this.aim[0][k], this.aim[1][k]] = spring(this.aim[0][k], this.aim[1][k], target[k], 1 / lag, dt);
      camera.up.copy(UP); camera.lookAt(this.aim[0]);
    }
    const roll = val(R.roll ?? 0, t); if (roll) camera.rotateZ(THREE.MathUtils.degToRad(roll));
    const fov = val(R.fov ?? 50, t); if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }
  /** record `frames` frames into qa/trailer_<name>/; resolves { n, err } when the last one is saved, or with err when a frame fails */
  record({ name, frames, fps = 60, blur = 8, shutter = 0.5 }) {
    blur = Math.max(1, Math.round(blur)); if (blur === 1) shutter = 1;
    return new Promise((ok) => { this.rec = { name: String(name).replace(/[^\w-]/g, '_'), frames, fps, blur, shutter, ticks: blur + (shutter < 1 ? 1 : 0), sub: 0, n: 0, done: (n, err) => ok({ n: Math.abs(n), err }) }; });
  }
  /** adds this render to the frame's sum; returns the 2D canvas holding the mean once the last open sub-frame is in, else null */
  accumulate(canvas, r, s) {
    const W = canvas.width, H = canvas.height;
    if (r.ctx?.canvas.width !== W || r.ctx.canvas.height !== H) { const c = document.createElement('canvas'); c.width = W; c.height = H; r.ctx = c.getContext('2d', { willReadFrequently: true }); r.acc = new Float32Array(W * H * 4); }
    r.ctx.drawImage(canvas, 0, 0);   // the WebGL buffer is still valid right after the render, as for toBlob
    const px = r.ctx.getImageData(0, 0, W, H).data, acc = r.acc;
    if (s === 0) acc.fill(0);
    for (let i = 0; i < px.length; i++) acc[i] += px[i];
    if (s < r.blur - 1) return null;
    const img = r.ctx.createImageData(W, H), d = img.data, k = 1 / r.blur;
    for (let i = 0; i < d.length; i++) d[i] = acc[i] * k;   // Uint8Clamped rounds
    r.ctx.putImageData(img, 0, 0);
    return r.ctx.canvas;
  }
  /** after the frame is rendered: send it, and hold the game until the server has it */
  async after(canvas) {
    const r = this.rec; if (!r || this.busy) return;
    const s = r.sub; r.sub = (s + 1) % r.ticks;
    if (s >= r.blur) return;                                   // the closed-shutter tick: the game moved on, nothing seen
    if (r.blur > 1) { canvas = this.accumulate(canvas, r, s); if (!canvas) return; }
    this.busy = true;
    const n = r.n + 1, file = `/__qa?car=trailer_${r.name}&file=${String(n).padStart(5, '0')}.png`;
    try {
      const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));   // the bitmap is taken now, encoded after
      if (!blob) throw new Error('empty canvas (WebGL context lost?)');
      for (let k = 0; ; k++) {
        try { const res = await fetch(file, { method: 'POST', body: blob }); if (res.ok) break; throw new Error(`HTTP ${res.status}`); }
        catch (e) { if (k >= 4) throw e; }
      }
      r.n = n;
      if (n % 20 === 0) globalThis.gc?.();   // PNG blobs live outside the JS heap, so GC never runs for them: Chrome hits its blob quota near 115 frames (ERR_BLOB_OUT_OF_MEMORY); the recorder exposes gc
    } catch (e) { this.rec = null; r.done(-n, String(e)); return; }   // the recorder sees a negative count and the reason
    finally { this.busy = false; }
    if (n >= r.frames) { this.rec = null; r.done(n); }
  }
}
