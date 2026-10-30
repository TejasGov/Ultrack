// The chase camera (research/cinematic-racing.md, section 3; research/endurance-benchmark.md for the five views).
// Every channel (offset, yaw, FOV, roll, pitch) follows its target through a closed-form critically damped spring, so it
// is frame-rate independent and never overshoots. The camera aims at a point ahead of the car (look-ahead hides the
// follow lag), backs off and rises a little with speed, widens its FOV with speed and (a lot, with a kick) under nitro,
// rolls with cornering load and dips under braking.
// - five views (C key): chase close (default), chase, chase far, hood, bumper. The first three orbit the car on the lagging
//   yaw; hood and bumper ride the body (yaw rigid, pitch/roll softened)
// - slides: the yaw target leans toward the direction of travel, so a car that rotates shows its flank (Endurance, turn 7)
// - walls and ground: the chase cameras cast rays against the static collision mesh and pull in rather than clip
// - hits: a hard speed scrub gives a short damped shake, a pitch kick and an FOV punch (`impact` 0..1 for the post pass)
// Shake uses the "trauma" model: trauma (0..1) decays linearly, shake = trauma^2 through smooth noise, rotation only, so
// the camera never moves into geometry. `reduceMotion` scales every motion effect down for players who get motion sick.
import * as THREE from 'three';

/** Critically damped spring step (Ryan Juckett's closed form): returns [x, v] after dt toward target. */
export function spring(x, v, target, omega, dt) {
  const e = Math.exp(-omega * dt), d = x - target, t = (v + omega * d) * dt;
  return [target + (d + t) * e, (v - omega * t) * e];
}
// self-check: converges without overshoot from either side
{
  let [x, v] = [0, 0];
  for (let i = 0; i < 240; i++) { [x, v] = spring(x, v, 1, 8, 1 / 60); console.assert(x <= 1.000001, 'spring overshoot'); }
  console.assert(Math.abs(x - 1) < 1e-3, 'spring did not converge');
}

// Views. Chase: camera `dist` m behind and `height` m above the car, aimed `ahead` m in front of it (+`aheadV` at speed) and
// `up` m above it. Hood and bumper (fp): the eye sits at fractions of the body box (`fx` back from the nose, `fy` of the roof
// height; the bumper `dx` m ahead of the nose, `y` m high), looking `pitch` rad down.
export const VIEWS = {
  close:  { label: 'CHASE CLOSE', dist: 4.2, height: 1.3, ahead: 2.2, aheadV: 3.0, up: 0.8, fov: 62 },
  chase:  { label: 'CHASE',       dist: 6.0, height: 1.85, ahead: 3.0, aheadV: 3.6, up: 0.9, fov: 62 },
  far:    { label: 'CHASE FAR',   dist: 9.2, height: 3.2, ahead: 4.2, aheadV: 4.5, up: 0.9, fov: 62 },
  hood:   { label: 'HOOD',   fp: true, fx: 0.30, fy: 1.04, pitch: -0.03, fov: 72 },
  bumper: { label: 'BUMPER', fp: true, dx: 0.12, y: 0.34, pitch: 0.0, fov: 80 },
};
VIEWS.near = VIEWS.close;                                              // the old default name
export const VIEW_ORDER = ['close', 'chase', 'far', 'hood', 'bumper'];
const viewKey = (v) => (v === 'near' || !VIEWS[v] ? 'close' : v);
/** the view after `v` in the C-key cycle */
export const nextView = (v) => VIEW_ORDER[(VIEW_ORDER.indexOf(viewKey(v)) + 1) % VIEW_ORDER.length];

// smooth 1D noise from incommensurate sines: cheap, deterministic, no texture
const wobble = (t, seed) => Math.sin(t * 1.0 + seed) * 0.5 + Math.sin(t * 2.31 + seed * 1.7) * 0.3 + Math.sin(t * 4.63 + seed * 2.9) * 0.2;
const { clamp, smoothstep: sstep, degToRad: rad } = THREE.MathUtils;
const UP = new THREE.Vector3(0, 1, 0), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3();
const FP_ROT = new THREE.Quaternion().setFromAxisAngle(UP, -Math.PI / 2);     // camera -Z -> the car's +X (nose)

/** A car's body box in its root frame (+x nose, +y up, metres): { nose, tail, roof, half }; cached on the car. */
export function bodyBox(car) {
  if (car.camBox) return car.camBox;
  const b = new THREE.Box3(), lod = car.lod?.levels?.[0]?.object;
  lod?.children.forEach((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox); });
  if (b.isEmpty()) b.set(new THREE.Vector3(-2.3, 0, -1), new THREE.Vector3(2.3, 1.15, 1));
  // car-lab's nose points -X; the root frame is that turned by pi about Y
  return car.camBox = { nose: -b.min.x, tail: -b.max.x, roof: b.max.y + (car.profile?.body?.lift ?? 0), half: Math.max(b.max.z, -b.min.z) };
}

export class ChaseRig {
  constructor() {
    this.s = null;              // chase spring state, made on the first update (and again after a cut)
    this.f = null;              // FOV and boost envelopes: they survive a view change
    this.trauma = 0;
    this.t = 0;
    this.view = 'close';
    this.boost = 0;             // 0..1 envelope, set by add/hold calls below; drives FOV and the post effects
    this.boostTarget = 0;
    this.impact = 0;            // 0..1, decays in ~0.3 s after a hard hit: the post pass may punch its blur with it
  }

  /** Add trauma for an event: kerb 0.15-0.25, landing 0.3-0.5, contact 0.4, wall 0.6-0.8. */
  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  /** Nitro on/off: the envelope rises fast (~0.2 s) and releases slowly (~0.6 s); ignition kicks the shake and the FOV. */
  setBoost(on) {
    if (on && this.boostTarget === 0) { this.shake(0.25); this.fovKick = 55; }
    this.boostTarget = on ? 1 : 0;
  }

  /** The car teleported (respawn): drop the follow state so the camera snaps behind it, and forget the speed it lost. */
  cut() { this.s = null; this.cutNext = true; }

  /**
   * hero: { root (position + yaw about Y, nose along travel), speed m/s, brake 0..1, curvature 1/m (signed), vehicle? },
   * opts: { reduceMotion, onKerb, topSpeed, cast?(origin, dir, maxDist) -> distance to static geometry or null }
   */
  update(camera, hero, dt, opts = {}) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const rm = opts.reduceMotion ? 1 : 0, top = opts.topSpeed ?? 78, v = hero.speed ?? 0, veh = hero.vehicle;
    const key = viewKey(this.view), V = VIEWS[key];
    const a = (hero.yaw ?? hero.root.rotation.y) + Math.PI;          // yaw alone: the physics body also pitches and rolls
    const heading = Math.atan2(-Math.cos(a), Math.sin(a));             // the travel direction (see Field.drive) as a camera yaw
    const f = this.f ??= { fov: camera.fov, fv: 0, boost: 0, bv: 0, vPrev: v, loss: 0, cool: 0, imp: 0 };

    // a teleport (respawn, restart): snap the follow state, and don't read the speed that vanished as a crash
    if (this.s && this.s.fp !== !!V.fp) this.s = null;                 // chase <-> hood/bumper is a cut, chase <-> chase glides
    if (this.s && this.s.last && this.s.last.distanceTo(hero.root.position) > Math.max(5, v * dt * 3 + 3)) this.cutNext = true;
    if (this.cutNext) { this.s = null; f.vPrev = v; f.loss = 0; f.cool = 0; this.cutNext = false; }
    const s = this.s ??= { fp: !!V.fp, last: hero.root.position.clone(), ay: hero.root.position.y, ayv: 0, off: null, ov: new THREE.Vector3(), yaw: heading, yv: 0,
      roll: 0, rv: 0, pitch: 0, pv: 0, lag: 0, clear: 1, floor: -1e9, tilt: new THREE.Quaternion(), v };
    s.last.copy(hero.root.position);

    // boost envelope: fast attack, slow release
    [f.boost, f.bv] = spring(f.boost, f.bv, this.boostTarget, this.boostTarget > f.boost ? 14 : 5, dt);
    this.boost = clamp(f.boost, 0, 1);

    // ---- impact: speed lost within ~0.12 s. Braking sheds ~10 m/s2 and never reaches 4 m/s in that window; a wall, a
    // barrier or another car does. One shake per hit (0.35 s apart), sized by the speed lost.
    // A wall that is hit side-on or at a slant scrubs little speed but spikes the body's acceleration (a corner or a brake stays under ~16 m/s2).
    const ab = veh?.aBody, g = ab ? Math.max(Math.abs(ab.z), -ab.x) : 0;
    f.loss = f.loss * Math.exp(-dt / 0.12) + Math.max(0, f.vPrev - v); f.vPrev = v; f.cool -= dt;
    if ((f.loss > 4 || g > 30) && f.cool <= 0 && !opts.noImpact) {
      const m = clamp(Math.max((f.loss - 2) / 18, (g - 26) / 90), 0.25, 1);
      f.imp = Math.max(f.imp, m); f.cool = 0.35; f.loss = 0;
      f.fv += 80 * m; s.pv += 0.5 * m;                                 // an FOV punch and a nose-down pitch kick, both critically damped back
      this.shake(0.15 * m);
    }
    f.imp *= Math.exp(-dt / 0.3); this.impact = f.imp;

    // ---- FOV: the view's base, +6 by 200 km/h (eased in), +12 under boost with a kick at ignition, a punch on a hit
    const re = clamp(v / 55, 0, 1), fast = sstep(v, 20, 70);
    const fovT = V.fov + (this.fovOffset ?? 0) + (6 * re * re + 12 * this.boost) * (1 - 0.7 * rm);
    if (this.fovKick) { f.fv += this.fovKick * (1 - 0.7 * rm); this.fovKick = 0; }
    [f.fov, f.fv] = spring(f.fov, f.fv, fovT, (this.boostTarget ? 6 : 3.5) + 5 * f.imp, dt);

    // ---- trauma: events decay at 0.9/s; a floor of rumble near top speed, a buzz on kerbs; hits add a fast damped shake
    this.trauma = Math.max(0, this.trauma - 0.9 * dt);
    const rumble = 0.12 * sstep(v / top, 0.85, 1.0) + (opts.onKerb ? 0.28 : 0) + 0.1 * this.boost;
    const tr = Math.max(this.trauma, rumble) * (1 - 0.85 * rm);
    const sh = tr * tr + 1.5 * f.imp * f.imp * (1 - 0.6 * rm), fq = opts.onKerb ? 26 : f.imp > 0.05 ? 24 : 12;

    // ---- roll with cornering load (lateral g), pitch down under braking
    const latG = v * v * (hero.curvature ?? 0) / 9.81;
    [s.roll, s.rv] = spring(s.roll, s.rv, clamp(-latG * 0.012, -0.035, 0.035) * (1 - rm), 4, dt);
    [s.pitch, s.pv] = spring(s.pitch, s.pv, (hero.brake ?? 0) * 0.025 * (1 - rm), 6, dt);

    if (V.fp) this.updateFP(camera, hero, dt, V, s, sh, fq, rm);
    else this.updateChase(camera, hero, dt, V, s, f, { rm, re, fast, v, heading, veh, sh, fq, opts });

    camera.rotateX(-s.pitch + rad(1.6) * sh * wobble(this.t * fq, 1.3));
    camera.rotateY(rad(1.6) * sh * wobble(this.t * fq, 7.1));
    camera.rotateZ(s.roll + rad(1.2) * sh * wobble(this.t * fq, 3.7));
    if (Math.abs(camera.fov - f.fov) > 1e-3) { camera.fov = f.fov; camera.updateProjectionMatrix(); }
  }

  /** chase close / chase / chase far: orbit the car on a lagging yaw, pulled in by walls, kept above the ground */
  updateChase(camera, hero, dt, V, s, f, { rm, re, fast, v, heading, veh, opts }) {
    // yaw follows the heading with some lag (the side of the car shows in corners), looser at speed. In a slide the target
    // leans toward the direction of travel: the camera keeps looking down the road while the car's nose swings round, so its
    // flank shows. Backing up or spinning past ~85 degrees leaves the target on the heading (the camera stays behind the car)
    const beta = veh?.state?.beta ?? 0, forward = (veh?.vForward ?? v) > 0;
    const lean = forward ? sstep(v, 9, 26) * (1 - sstep(Math.abs(beta), 1.0, 1.5)) * 0.4 * (1 - 0.6 * rm) : 0;
    let dy = heading - lean * beta - s.yaw; dy -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;
    // (the further it falls behind, past ~50 degrees, the harder it catches up: a spin never leaves the camera facing the nose)
    [s.yaw, s.yv] = spring(s.yaw, s.yv, s.yaw + dy, 2.4 * (4.5 + 2.5 * sstep(v, 5, 30) - 1.5 * fast) * (1 - 0.3 * lean) * (1 + 2.5 * sstep(Math.abs(dy), 0.9, 1.7)), dt);

    // the car's height is smoothed (the collision mesh has seams that would nod the whole view); x and z follow rigidly
    // (the target leads by the smoothed climb rate x 2/omega, the spring's steady lag on a ramp, so a long grade isn't trailed ~1 m)
    const p = hero.root.position;
    s.vy = (s.vy ?? 0) + ((p.y - (s.py ?? p.y)) / Math.max(dt, 1e-4) - (s.vy ?? 0)) * (1 - Math.exp(-dt / 0.12)); s.py = p.y;
    [s.ay, s.ayv] = spring(s.ay, s.ayv, p.y + (2 / 18) * s.vy, 18, dt);

    // distance breathes out a little with speed; hard acceleration pushes the camera back, braking pulls it in
    const longG = (v - s.v) / Math.max(dt, 1e-4) / 9.81; s.v = v;
    s.lag += (clamp(longG * 0.55, -0.6, 0.8) * (1 - rm) - s.lag) * (1 - Math.exp(-3.5 * dt));
    const dist = V.dist * (1 + 0.12 * re) + s.lag + 0.3 * this.boost * (1 - 0.6 * rm), height = V.height * (1 + 0.115 * re);
    const ahead = new THREE.Vector3(Math.sin(s.yaw), 0, Math.cos(s.yaw));       // horizontal travel direction of the lagging yaw
    // the spring smooths the camera's offset from the car, not its world position: a world-space spring trails a car
    // at 60 m/s by 2v/omega (~16 m), which is why the old camera sat so far back at speed
    const want = ahead.clone().multiplyScalar(-dist); want.y = height;
    s.off ??= want.clone();
    for (const c of ['x', 'y', 'z']) [s.off[c], s.ov[c]] = spring(s.off[c], s.ov[c], want[c], c === 'y' ? 14 - 6 * fast : 22, dt);

    // walls: the collision mesh has low walls under taller fences and stands, so the camera must not pass a wall at any height:
    // rays run flat from knee height (three, for the camera's width) to the camera's spot, plus one along the real line to the
    // camera for crests and slopes. The camera slides in along the ground and, the closer it is pulled, climbs (a car backed
    // against a wall is seen from above and behind, never from inside itself); it eases back out when the way clears.
    const px = p.x, pz = p.z, pivot = new THREE.Vector3(px, s.ay + 0.9, pz), cam = new THREE.Vector3(px + s.off.x, s.ay + s.off.y, pz + s.off.z);
    const line = cam.clone().sub(pivot), len = line.length(), flat = new THREE.Vector3(line.x, 0, line.z), lenH = flat.length(), dirH = flat.clone().divideScalar(lenH || 1);
    if (opts.cast && lenH > 0.1) {
      // the rays start at the car's real height: on a long climb the smoothed s.ay trails ~1 m below the car, and knee rays from
      // there start under the road, hit it and pull the camera into a top-down view for the whole climb (India)
      // and they follow the grade (rise per metre behind the car, from the climb rate): flat, they meet the road itself ~3 m back on a steep descent
      const g = clamp(-s.vy / Math.max(v, 8), -0.35, 0.35), k = Math.hypot(1, g), kDir = dirH.clone().setY(g).divideScalar(k);
      const side = new THREE.Vector3().crossVectors(dirH, UP).multiplyScalar(0.35), knee = new THREE.Vector3(px, p.y + 0.55, pz);
      let hit = lenH;
      for (const o of [0, 1, -1]) { const d = opts.cast(knee.clone().addScaledVector(side, o), kDir, lenH * k + 0.35); if (d !== null) hit = Math.min(hit, (d - 0.35) / k); }
      let c = clamp(hit / lenH, 0.25, 1);
      const eye = new THREE.Vector3(px, p.y + 0.9, pz), ray = cam.clone().sub(eye), rl = ray.length();
      const d = opts.cast(eye, ray.divideScalar(rl), rl + 0.35); if (d !== null) c = Math.min(c, clamp((d - 0.35) / rl, 0.25, 1));
      s.clear = c < s.clear ? c : s.clear + (c - s.clear) * (1 - Math.exp(-2.5 * dt));
    } else s.clear += (1 - s.clear) * (1 - Math.exp(-2.5 * dt));
    camera.position.set(pivot.x + dirH.x * lenH * s.clear, pivot.y + line.y + Math.min(4, (1 - s.clear) * lenH * 0.9), pivot.z + dirH.z * lenH * s.clear);

    // the ground: never lower than 0.28 m above the road under the camera (a kerb or a crest between the car and the lens)
    if (opts.cast) {
      const g = opts.cast(camera.position.clone().add(UP), new THREE.Vector3(0, -1, 0), 2.2);
      // (held relative to the car: in world height its slow release trailed a descent by rate/8, ~0.8 m high on India's 17 % drop)
      const minY = g === null ? -1e9 : camera.position.y + 1 - g + 0.28 - p.y;
      s.floor = minY > s.floor ? minY : s.floor + (minY - s.floor) * (1 - Math.exp(-8 * dt));
      if (camera.position.y < p.y + s.floor) camera.position.y = p.y + s.floor;
    }

    // look into the corner: aim a few degrees past the lagging yaw, toward where the heading is turning (the apex), not the outer wall
    let dh = heading - (s.hPrev ?? heading); dh -= Math.round(dh / (2 * Math.PI)) * 2 * Math.PI; s.hPrev = heading;
    const hr = clamp(dh / Math.max(dt, 1e-4), -2, 2) * (1 - rm);
    s.hr = (s.hr ?? 0) + (hr - (s.hr ?? 0)) * (1 - Math.exp(-6 * dt));
    s.bias = (s.bias ?? 0) + (clamp(s.hr * 0.1, -0.1, 0.1) * sstep(v, 8, 25) - (s.bias ?? 0)) * (1 - Math.exp(-5 * dt));   // <= ~5.7 deg
    const lookDir = ahead.clone().applyAxisAngle(UP, s.bias);
    const look = new THREE.Vector3(px, s.ay, pz).addScaledVector(lookDir, V.ahead + V.aheadV * re);   // along the lagging yaw: the car swings in the frame through corners
    // on a slope the aim follows the road a little way ahead (half its rise or fall, smoothed), so a steep descent stays in the
    // frame and a climb isn't a view into the hill; a level road is unchanged
    let rise = 0;
    if (opts.cast) {
      const probe = new THREE.Vector3(px, s.ay + 8, pz).addScaledVector(lookDir, 14), g = opts.cast(probe, new THREE.Vector3(0, -1, 0), 20);
      if (g !== null) rise = clamp(8 - g, -4, 4) * 0.5;                // road height 14 m ahead, relative to the car
    }
    [s.rise, s.risev] = spring(s.rise ?? 0, s.risev ?? 0, rise * s.clear * (1 - 0.5 * rm), 3, dt);
    look.y += V.up + s.rise;
    // pulled in by a wall (a hairpin's inside) the camera climbs above the car: the aim comes back toward the car, so it stays in
    // the frame instead of dropping out of the bottom while the lens looks down the road
    look.lerp(tmpV.set(px, s.ay + 0.5, pz), clamp((1 - s.clear) * 1.3, 0, 0.8));
    camera.lookAt(look);
  }

  /** hood / bumper: on the body. Yaw is rigid (the world turns with the car); pitch and roll are softened (~60 ms) */
  updateFP(camera, hero, dt, V, s, sh, fq, rm) {
    const q = hero.root.quaternion, fwd = tmpV.set(1, 0, 0).applyQuaternion(q), yawQ = tmpQ.setFromAxisAngle(UP, Math.atan2(-fwd.z, fwd.x));
    const tilt = tmpQ2.copy(yawQ).invert().multiply(q);                // the body's pitch and roll in the yaw frame
    s.tilt.slerp(tilt, 1 - Math.exp(-14 * dt));
    const body = yawQ.clone().multiply(s.tilt), B = bodyBox(hero), L = B.nose - B.tail;
    const eye = V.dx !== undefined ? new THREE.Vector3(B.nose + V.dx, V.y, 0) : new THREE.Vector3(B.nose - V.fx * L, B.roof * V.fy, 0);
    camera.position.copy(hero.root.position).add(eye.applyQuaternion(body));
    camera.quaternion.copy(body).multiply(FP_ROT);
    camera.rotateX(V.pitch);
  }
}
