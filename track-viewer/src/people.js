// Real people around the venue (Mixamo + Meshy characters, assets/characters/web), replacing the Blender placeholders.
// Each character GLB loads once; every person is a SkeletonUtils clone with its own AnimationMixer, started at a random
// time so nobody moves in sync. Skinned meshes can't be GPU-instanced, so the budget is kept by distance: people beyond
// HIDE metres are hidden, mixers tick only for people within ANIM metres (every other frame past ANIM_HALF).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const HIDE = 90, ANIM = 70, ANIM_HALF = 30, SHADOW = 22;
export const group = new THREE.Group();   // everyone; main.js hides it from the mirror and GTAO passes
group.name = 'people';
const SPECTATORS = ['remy', 'megan', 'kaya', 'brian', 'sophie', 'lewis', 'spectator'];
const people = [];
const lib = {};
let frame = 0;

const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();   // seeded: same crowd every load
const pick = (a) => a[Math.floor(rnd() * a.length)];

async function loadLib(loader, ids) {
  await Promise.all(ids.filter((id) => !lib[id]).map(async (id) => {   // loaded once: a second venue reuses the cast (reloading leaked their textures)
    const g = await loader.loadAsync(`/assets/characters/${id}.glb`);
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = true;   // only the nearest cast (see update)
      o.frustumCulled = false;     // skinned bounds come from the bind pose and lag the animation; distance hides them
      [].concat(o.material).forEach((m) => { m.roughness = Math.max(0.55, m.roughness ?? 1); m.metalness = 0; });
    });
    lib[id] = g;
  }));
}

function spawn(scene, id, pos, yaw, clips, opts = {}) {
  const g = lib[id];
  if (!g) return null;
  const root = SkeletonUtils.clone(g.scene);
  root.position.copy(pos);
  root.rotation.y = yaw;
  const mixer = new THREE.AnimationMixer(root);
  const wanted = [].concat(clips);
  const clip = g.animations.find((a) => wanted.includes(a.name)) || g.animations.find((a) => /^(idle|shift|stand)$/.test(a.name)) || g.animations[0];
  if (clip) {
    const act = mixer.clipAction(clip);
    act.play();
    act.time = rnd() * clip.duration;
    act.timeScale = 0.9 + rnd() * 0.2;
  }
  group.add(root);
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const p = { root, mixer, id, base: clip?.name, cheer: opts.cheer, g, meshes, shadow: false };
  people.push(p);
  return p;
}

// Instances of a placeholder in the track GLB -> unique world positions + yaw (local -Y faced the track in Blender,
// which is +Z in glTF, the way Mixamo/Meshy characters face). A multi-material mesh arrives as several instanced
// children with the same matrices, hence the de-duplication.
function placeholders(scene, re, hide = true) {
  const out = [], seen = new Set(), m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || !re.test(o.name)) return;
    const n = o.isInstancedMesh ? o.instanceMatrix.count : 1;
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) o.getMatrixAt(k, m); else m.identity();
      m.premultiply(o.matrixWorld).decompose(p, q, s);
      const key = `${Math.round(p.x * 10)},${Math.round(p.z * 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ pos: p.clone().setY(0), yaw: new THREE.Euler().setFromQuaternion(q, 'YXZ').y });
    }
    if (hide) { o.visible = false; o.userData.replaced = true; }
  });
  return out;
}

const faceTrack = (pos, track) => {
  const c = track.centerline;
  let best = 0, bd = Infinity;
  for (let i = 0; i < c.length; i += 2) { const d = (c[i][0] - pos.x) ** 2 + (c[i][2] - pos.z) ** 2; if (d < bd) { bd = d; best = i; } }
  return Math.atan2(c[best][0] - pos.x, c[best][2] - pos.z);   // glTF characters face +Z
};

/** Load the cast and place it. `venue` is the loaded track scene, `track` the track.json. */
// spectators: off by default. The game is raced at dusk and night, where 3D fans are barely visible and cost ~20 ms
// a frame; the stands' animated crowd cards carry that job. Officials borrow two of the casual models.
// pit: the pit crews (a track without pit boxes has none); vip: URL of the booth's vip.json, or null; alive(): false once the
// venue this cast was made for has been replaced (a track switch during the load)
export async function populate(loader, scene, venue, track, { max = 400, spectators = false, pit = true, vip: vipUrl = '/assets/vip.json', alive = () => true } = {}) {
  await loadLib(loader, ['pete', 'racer', 'leonard', 'marshal', 'lewis', 'brian', ...(spectators ? SPECTATORS : [])]);
  if (!alive()) return 0;
  scene.add(group);
  venue.updateMatrixWorld(true);
  // pit crews: two Petes per box (one kneeling at the tyres, one standing), drivers at the first boxes
  const crew = pit ? placeholders(venue, /^crew_/) : [];
  crew.forEach((c, k) => {
    if (k % 3 === 2) return;                                  // two per box are enough; keeps the lane readable
    spawn(scene, 'pete', c.pos, c.yaw, k % 3 === 0 ? ['inspect', 'kneelIdle'] : ['stand'], { cheer: 'cheer' });
  });
  crew.slice(0, 9).filter((_, k) => k % 3 === 2).forEach((c) => spawn(scene, 'racer', c.pos, c.yaw, ['idle'], { cheer: 'victory' }));
  // marshals at every post, officials on the pit wall
  placeholders(venue, /^marshal(_\d+)?$/).forEach((m, k) => spawn(scene, 'marshal', m.pos, m.yaw, k % 4 === 0 ? ['wave'] : ['idle'], { cheer: 'wave' }));
  placeholders(venue, /^official(_\d+)?$/).forEach((o) => spawn(scene, pick(['lewis', 'brian']), o.pos, o.yaw, ['shift'], { cheer: 'clap' }));
  // the commentators at the rail of the Corniche Club's booth balcony (tracks/marina/vip.py -> vip.json): Lewis plays
  // Enzo (cheers on the big moments), Brian plays Alastair (applauds, grudgingly)
  const vip = vipUrl && await fetch(vipUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!alive()) return 0;
  vip?.announcers?.forEach((a, k) => spawn(scene, k ? 'brian' : 'lewis', new THREE.Vector3(...a.pos), a.yawRad, ['shift'], { cheer: k ? 'clap' : 'cheer' }));
  // photographers beside the TV towers, kneeling or looking down the track
  placeholders(venue, /^camera_tower(_\d+)?$/, false).forEach((t, k) => {
    const pos = t.pos.clone().add(new THREE.Vector3(3.6, 0, 2.2));   // beside the tower, clear of its legs
    spawn(scene, 'leonard', pos, faceTrack(pos, track), k % 2 ? ['kneel1'] : ['look']);
  });
  if (!spectators) return people.length;
  // standing fans by the promenade planters, watching the track
  for (const pl of placeholders(venue, /^planter(_\d+)?$/, false)) {
    for (let j = 0; j < 2 && people.length < max; j++) {
      const pos = pl.pos.clone().add(new THREE.Vector3((rnd() - 0.5) * 4, 0, (rnd() - 0.5) * 4));
      spawn(scene, pick(SPECTATORS), pos, faceTrack(pos, track) + (rnd() - 0.5) * 0.6, pick([['shift'], ['clap'], ['shift', 'idle']]), { cheer: 'cheer' });
    }
  }
  // seated fans on the main grandstand's front rows, from the crowd strips' lowest edge (a step's tread)
  seated(scene, venue, track, max);
  return people.length;
}

function seated(scene, venue, track, max) {
  const seats = [], v = new THREE.Vector3();
  venue.traverse((o) => {
    if (!o.isMesh || ![].concat(o.material).some((m) => m.name === 'M_Crowd')) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      // rows 0 and 2 (tread heights 1.2 and 2.1 m), within 45 m of the start line on the main stand
      if (Math.abs(v.x) < 45 && v.z > 0 && (Math.abs(v.y - 1.2) < 0.03 || Math.abs(v.y - 2.1) < 0.03)) seats.push(v.clone());
    }
  });
  // the strips only have vertices every 4.5 m (one per track sample): fill each row in between, a seat every ~1.1 m
  seats.sort((a, b) => a.y - b.y || a.x - b.x);
  const filled = [];
  for (let i = 0; i < seats.length; i++) {
    const a = seats[i], b = seats[i + 1];
    filled.push(a);
    if (!b || Math.abs(b.y - a.y) > 0.05 || a.distanceTo(b) > 6) continue;
    const n = Math.floor(a.distanceTo(b) / 1.1);
    for (let k = 1; k < n; k++) filled.push(a.clone().lerp(b, k / n));
  }
  for (const s of filled) {
    if (people.length >= max) break;
    if (rnd() < 0.15) continue;                                // a few empty seats
    const pos = s.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.2, -0.05, -0.15));
    spawn(scene, pick(SPECTATORS.filter((id) => id !== 'spectator')), pos, faceTrack(pos, track) + (rnd() - 0.5) * 0.3,
      pick([['sitClap'], ['sitCheer']]), { cheer: 'sitCheer' });
  }
}

const tmp = new THREE.Vector3(), frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
/** Per frame: draw only people in view and within HIDE, animate only those (half rate in the middle band), and let
 * just the nearest cast shadows. Skinned meshes skip three's frustum test (their bounds lag the animation). */
export function update(dt, cam, camera) {
  frame++;
  if (camera) frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const p of people) {
    const d = tmp.copy(p.root.position).sub(cam).length();
    sphere.center.copy(p.root.position).y += 0.9;
    const vis = d < HIDE && (!camera || frustum.intersectsSphere(sphere));
    p.root.visible = vis;
    p.root.matrixWorldAutoUpdate = vis;      // hidden people skip the bone-matrix walk entirely
    if (!vis) continue;
    if (d < ANIM_HALF) p.mixer.update(dt);
    else if (d < ANIM && (frame & 1)) p.mixer.update(dt * 2);
    const sh = d < SHADOW;
    if (sh !== p.shadow) { p.shadow = sh; p.meshes.forEach((m) => { m.castShadow = sh; }); }
  }
}

/** Big moment: people with a cheer clip play it once, then go back to what they were doing. */
export function cheer() {
  for (const p of people) {
    const clip = p.cheer && p.g.animations.find((a) => a.name === p.cheer);
    if (!clip || rnd() < 0.25) continue;
    const act = p.mixer.clipAction(clip);
    const base = p.mixer.clipAction(p.g.animations.find((a) => a.name === p.base));
    act.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.3).play();
    base.fadeOut(0.3);
    setTimeout(() => { act.fadeOut(0.4); base.reset().fadeIn(0.4).play(); }, (clip.duration - 0.4) * 1000);
  }
}

/** Remove everyone (the venue they stood in is gone). The character library stays loaded; clones share its geometry and materials. */
export function clear() {
  for (const p of people) { p.mixer.stopAllAction(); p.mixer.uncacheRoot(p.root); }
  people.length = 0; group.clear();
}

export const count = () => people.length;
export const list = people;
