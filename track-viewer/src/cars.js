// The car-lab cars on the track. Assembly reuses car-lab's own modules (read-only import of car-lab/src/vehicle):
// the same profiles, paint/rubber/glass materials, procedural wheels, glass, mirrors and fitted lamps, so a car looks
// the way it does in the assembly lab. Only the body is swapped: car-lab loads the 1.1-2.8 M-triangle generated shell;
// here a derived game mesh (scripts/derive-car-lods.mjs: same normalisation baked in, 80k / 20k triangles) is used.
//
// What makes them sit in this world rather than in a studio:
// - the player car's paint and glass reflect the venue (a 128 px cube capture around the car, PMREM-filtered, refreshed
//   ~3x a second, the car itself hidden from it); the others use the scene environment
// - a soft contact shadow under every car (the night sky gives no shadow to ground them otherwise)
// - lamps follow the look: running lights at dusk, low beams at blue hour and night; brake lights from deceleration
// - real lights only on the player car (two headlight beams); the others keep emissive lamp geometry
import * as THREE from 'three';
import { AssetQueue } from './asset-loading.js';
import { isModelRim } from './carkit/model-rims.js';
import CAR_TEXTURES from '../../assets/cars/texture-variants.json';
import { completeCarMaterial } from '../../car-lab/src/vehicle/complete-car.js';
// car-lab profiles are 0.5-1 MB each (lamp and mirror fits): each loads when its car is assembled, not in the entry chunk
const PROFILES = import.meta.glob('../../car-lab/src/vehicle/profiles/*.json', { import: 'default' });
const profileFile = (key) => PROFILES[`../../car-lab/src/vehicle/profiles/${key}.json`];
// names of the profile cars without loading the profiles (car-lab profile "name"; model cars name themselves in model.json)
const PROFILE_NAMES = { 'aston-martin-valk': 'Valkyrie', av12: 'AV–12', 'bentley-gt': 'Continental GT', bmw1: 'Mercedes-AMG GT4', buggati: 'Chiron-X',
  'furari-488': 'Furari 488-R', jaguarxkjss: 'Mercedes-AMG One', mp1x: 'McLaren 650S GT3',
  porsche1: '911–T', 'nissan-z': 'Nissan Z GT4', supra: 'GR Supra GT' };
import { createVehicleMaterials, FINISHES } from '../../car-lab/src/vehicle/materials.js';
import { createWheelSet, createGlass, createMirrors } from '../../car-lab/src/vehicle/parts.js';
import { createVehicleLights } from '../../car-lab/src/vehicle/lights.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import TEAMS from '../../assets/teams/teams.json';
import { makeLivery, applyLivery } from './livery.js';
import EXHAUST from '../../assets/cars/exhaust.json';
import FINISHES_CARS from '../../assets/cars/finishes.json';
import { applyFinish, setFinish } from './finish.js';
import { ChaseRig, spring, bodyBox } from './camera.js';
import { wheelStep } from './wheelDroop.js';
import { RAPIER } from './physics/world.js';
import { buildMirrors } from './carkit/mirrors.js';
import { Chassis } from './carkit/chassis.js';
import { shedBodywork } from './carkit/loose-parts.js';
import { ActiveAero } from './carkit/aero.js';
import { setLamps, fitLamps } from './carkit/lamps.js';
import { Vehicle } from './physics/vehicle.js';
import { handling } from './physics/handling.js';
import { yawFade } from './physics/arcade.js';
import { speedProfile } from './physics/racing-line.js';
// the AI's speed plan: lateral and braking (m/s2) and the top (m/s); the driver scales it by pace, grip and wetness (driver.js)
export const AI_PLAN = { aLat: 32, aBrk: 16, vmax: 78 };   // aLat 32 (was 27.5): measured clean on all 13 circuits with the racing line and the slope terms (racing-line.js), 4 cars, dry/damp/rain, pace to 1.035; 36 spins at India
import { PlayerInput, AIDriver } from './physics/driver.js';
import { addInterior, bPillars } from './carkit/interior.js';
// per-car fixes from the car QA pipeline (assets/cars/tuning/<key>.json; see CAR-QA.md)
const TUNING = Object.fromEntries(Object.entries(import.meta.glob('../../assets/cars/tuning/*.json', { eager: true, import: 'default' }))
  .map(([p, v]) => [p.split('/').pop().replace('.json', ''), v]));
// complete car models (scripts/model-car.py -> assets/cars/<key>/car_lod*.glb + model.json): they bring their own glass,
// lamps, cabin, mirrors and wheels, so only the paint, lamp and glass materials are swapped for the game's
const MODELS = Object.fromEntries(Object.entries(import.meta.glob('../../assets/cars/*/model.json', { eager: true, import: 'default' }))
  .map(([p, v]) => [p.split('/').at(-2), v]));
// a model needs no car-lab profile (destrier, blackbird have none): everything the game reads from it comes from model.json
const modelProfile = (base, M) => ({ ...base, name: M.name ?? base?.name, model: true, body: { ...base?.body, lift: 0 }, wheels: M.wheels,
  lights: { ...base?.lights, front: M.lights.front, rear: M.lights.rear }, glass: { side: M.glass.side } });
/** Display name of a car: a model's own (model.json `name`), else its car-lab profile name, else the key. */
export const carName = (key) => MODELS[key]?.name ?? PROFILE_NAMES[key] ?? key;
/** whether the car is a complete model (its own wheels) rather than built by car-lab */
export const hasModel = (key) => key in MODELS;
/** "<role>|<name>" materials from model-car.py: the game's own material for a role, the model's for "keep" */
const roleMaterial = completeCarMaterial;

/** A model's own tyre material made rubber: dielectric and matte. Seven imports carried 0.14-0.71 metalness on their tyres (the Valkyrie's
 *  0.5 rendered near white), so the tyre mirrored the sky and read as part of the rim. Its texture stays. */
const TYRE_MAT = /tyre|tire|tread/i;
const rubber = (mat) => { if (mat?.name?.startsWith('keep|') && TYRE_MAT.test(mat.name)) { mat.metalness = 0; mat.roughness = Math.max(mat.roughness, 0.85); } return mat; };

/** Wheels of a model: wheel_XX hub nodes with `_spin` and `_caliper` groups, shaped like car-lab's createWheelSet */
function modelWheels(scene, profile, m, key) {
  const root = new THREE.Group(), wheels = []; root.name = 'wheels';
  for (const k of ['FL', 'FR', 'RL', 'RR']) {
    const node = scene.getObjectByName(`wheel_${k}`), axle = k[0] === 'F' ? 'front' : 'rear';
    const pivot = new THREE.Group(); pivot.name = `wheel_${k}`; pivot.position.copy(node.position);
    const spin = node.getObjectByName(`wheel_${k}_spin`), cal = node.getObjectByName(`wheel_${k}_caliper`);
    spin.name = `${pivot.name}_spin`; cal.name = `${pivot.name}_calipers`;
    for (const g of [spin, cal]) { g.position.set(0, 0, 0); g.traverse((o) => { if (o.isMesh) {const map=src=>isModelRim(key,src.name)?m.rim:rubber(roleMaterial(src,m));o.material=Array.isArray(o.material)?o.material.map(map):map(o.material);} }); pivot.add(g); }
    root.add(pivot); wheels.push({ pivot, spin, axle, side: k[1], spec: profile.wheels[axle] });
  }
  return { root, wheels };
}

/** Lamp control for a model (its lamp meshes wear the game's lamp materials), with car-lab's levels and beams */
function modelLamps(profile, m) {
  const root = new THREE.Group(), beams = []; root.name = 'lights';
  for (const p of profile.lights.front) {
    const b = new THREE.SpotLight(0xe5f1ff, 0, 35, 0.32, 0.65, 2); b.position.set(...p); b.target.position.set(p[0] - 10, p[1] - 0.6, p[2]);
    root.add(b, b.target); beams.push(b);
  }
  let state = { mode: 'running', brake: 0, reverse: false };
  function update(input = {}) {
    state = { mode: input.mode ?? state.mode, brake: THREE.MathUtils.clamp(input.brake ?? state.brake, 0, 1), reverse: input.reverse ?? state.reverse };
    const running = state.mode !== 'off', on = state.mode === 'low' || state.mode === 'high';
    m.headlight.emissiveIntensity = running ? 2.8 : 0;
    m.projector.emissiveIntensity = on ? (state.mode === 'high' ? 22 : 14) : 0;
    m.highProjector.emissiveIntensity = state.mode === 'high' ? 18 : 0;
    m.taillight.emissiveIntensity = (running ? 1.4 : 0) + state.brake * 6.6;
    m.brakeLight.emissiveIntensity = state.brake * 10;
    m.reverseLight.emissiveIntensity = state.reverse ? 6 : 0;
    for (const b of beams) { b.intensity = on ? (state.mode === 'high' ? 1500 : 650) : 0; b.angle = state.mode === 'high' ? 0.23 : 0.32; b.visible = on; }
  }
  update();
  return { root, update, get state() { return { ...state }; } };
}

/**
 * car-lab builds each car from ~100 small meshes (tyre rings, tread channels, spokes, rotor, calipers, glass panes,
 * lamp segments). Drawn again in the shadow, mirror and AO passes, eight cars doubled the frame cost. Within a group
 * that moves as one (a wheel's spinning part, the calipers, glass, mirrors, lamps) merge the meshes per material;
 * lamp states still switch, because car-lab drives them through the shared materials. Lights stay as they are.
 */
function mergeByMaterial(group, castShadow = false) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), buckets = new Map(), drop = [];
  group.traverse((o) => {
    if (!o.isMesh || o === group) return;
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') { g.deleteAttribute(k); continue; }
      // packed models store quantized (normalized int, interleaved) attributes: bake to plain floats so the matrix
      // and the merge see metres and real UVs, and mixed sources merge
      const a = g.attributes[k];
      if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) {
        const f = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
        g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
      }
    }
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    const flat = g.index ? g.toNonIndexed() : g;
    if (!buckets.has(o.material)) buckets.set(o.material, { geos: [], order: o.renderOrder });
    buckets.get(o.material).geos.push(flat);
    drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  for (const [mat, b] of buckets) {
    if (!b.geos.every((g) => g.attributes.uv)) b.geos.forEach((g) => g.deleteAttribute('uv'));   // textured models keep their UVs
    // vertex colours too (the CC850's wheel material multiplies by them): without the attribute a vertexColors material reads
    // black, which drew its whole wheel as a black disc. Where a bucket cannot keep them all, the material stops asking for them
    const cs = b.geos[0].attributes.color?.itemSize;
    if (!cs || !b.geos.every((g) => g.attributes.color?.itemSize === cs)) {
      b.geos.forEach((g) => g.deleteAttribute('color'));
      if (mat.vertexColors) { mat.vertexColors = false; mat.needsUpdate = true; }
    }
    const merged = mergeGeometries(b.geos);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = castShadow; mesh.receiveShadow = true; mesh.renderOrder = b.order;
    group.add(mesh);
  }
}

const DETAIL_M = 22;      // full car-lab wheels within this distance, stand-ins beyond
const FAR_M = 60;         // beyond this, one static wheel proxy and no side mirrors
const SHADOW_M = 50;      // cars cast into the sun's shadow map only within this distance
// each car wears its team's base colour and finish (assets/teams/teams.json); decals come with the liveries
const TEAM_OF = Object.fromEntries(TEAMS.teams.flatMap((t) => t.cars.map((c) => [c.key, t])));
// every team car that can be assembled (a car-lab profile and a derived body, or a complete model); a car without one is skipped
export const KEYS = TEAMS.teams.flatMap((t) => t.cars.map((c) => c.key)).filter((k) => profileFile(k) || MODELS[k]);
// a race runs one car per team, at most GRID of them; ?lineup=2 races each team's second car instead. The player drives
// Saetta's. Other cars remain cached outside the scene until selected.
/** every circuit's track.json has 8 grid slots: with more teams than that, a race leaves some out (game.js racersFor) */
export const GRID = 8;
const LINEUP = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('lineup')) === '2' ? 1 : 0;
const DEFAULT_LINEUP = TEAMS.teams.map(t=>t.cars[LINEUP].key).filter(k=>KEYS.includes(k));

const WHEEL_OMEGA = 24;    // rad/s: the wheel's visual suspension spring (critically damped, ~40 ms)
const WHEEL_SHOW = 0.35;   // share of the suspension travel drawn between wheel and body (the car group takes the rest; see drivePhysics)
const SPIN_STEP = 0.3;    // rad: the most a wheel's visual spin may turn in one frame (see drivePhysics)
/**
 * The footprint under a car: one transparent quad with a soft body shadow, a darker core under the floor and a tight dark
 * patch at each tyre (the contact line is what makes a car look set down rather than hovering). Sized from the car's own
 * body box and wheel positions, so a 4.4 m coupe and a 5 m GT each get theirs. groundShadow() keeps it flat on the road.
 */
function contactShadow(B, wheels) {
  const L = B.nose - B.tail, Lp = L * 1.22, Wp = 2 * B.half * 1.34, c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * Wp / Lp);
  const g = c.getContext('2d'), k = c.width / Lp, off = 4000, mid = (B.nose + B.tail) / 2;
  const blob = (cx, cz, l, w, blur, a) => {                   // centre in metres from the quad's centre (+x nose), size, blur radius, alpha
    g.save(); g.shadowColor = `rgba(0,0,0,${a})`; g.shadowBlur = blur * k; g.shadowOffsetX = off; g.fillStyle = '#000';
    g.beginPath(); g.roundRect(c.width / 2 + (cx - l / 2) * k - off, c.height / 2 + (cz - w / 2) * k, l * k, w * k, Math.min(l, w) * k * 0.4); g.fill(); g.restore();
  };
  blob(0, 0, L * 0.9, 2 * B.half * 0.8, 0.45, 0.5);            // broad, soft
  blob(0, 0, L * 0.62, 2 * B.half * 0.56, 0.2, 0.55);          // under the floor
  for (const ax of ['front', 'rear']) {
    const w = wheels[ax]; if (!w) continue;
    for (const side of [-1, 1]) blob(-w.x - mid, side * w.track / 2, 0.38, w.width * 0.95, 0.07, 0.9);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Lp, Wp).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(mid, 0.025, 0); m.renderOrder = 1; m.name = 'contact-shadow';
  return m;
}

/**
 * Per frame (physics cars): lay the shadow flat on the road under the body. The body leans on its springs but the road does
 * not, so the quad takes the inverse of the lean the (smoothed) wheel compressions imply, rides the mean compression, and
 * fades as the wheels unload (a crest, a jump).
 */
function groundShadow(c) {
  const [fl, fr, rl, rr] = c.vc, s = c.shadow, mean = (fl + fr + rl + rr) / 4;
  s.rotation.set(-Math.atan2((fr + rr - fl - rl) / 2, c.track), 0, Math.atan2((fl + fr - rl - rr) / 2, c.wheelbase));
  s.position.y = 0.02 + mean - 0.065;
  s.material.opacity = 0.85 * THREE.MathUtils.smoothstep(mean, 0.0, 0.03);
}

/**
 * Reflections on the paint are capped in brightness: at grazing angles the clearcoat mirrors the bright dusk sky at
 * ~1.0 Fresnel, the bloom picked those rims up and every car wore a glowing halo. Capping the reflected environment
 * (not the sun's own highlight, which stays a crisp glint) keeps the rims bright but below the bloom threshold.
 */
function polishPaint(mat, cap = 2.4) {
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey?.();
  mat.onBeforeCompile = (shader, renderer) => {
    base?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
      #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
        radiance = min( radiance, vec3( ${cap.toFixed(2)} ) );
        #ifdef USE_CLEARCOAT
          clearcoatRadiance = min( clearcoatRadiance, vec3( ${cap.toFixed(2)} ) );
        #endif
      #endif
      #include <lights_fragment_end>`);
  };
  mat.customProgramCacheKey = () => `${key ?? ''}|paint-cap`;
  mat.needsUpdate = true;
}

const DEBUG_EXHAUST = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === 'exhaust';

/**
 * Exhaust and nitro emitters (assets/cars/exhaust.json): for each tip, a ray from behind the car at that height and
 * offset finds the rear surface of the body, and an anchor goes 2 cm proud of it, pointing back (and up for top-exit
 * pipes). Particle systems read world positions from these anchors; ?debug=exhaust shows them.
 */
function emitters(car, lod, lift, key, tips) {
  const spec = { tips: [], ...EXHAUST.cars[key], ...(tips?.length ? { tips } : {}) };
  const probe = new THREE.Group();
  lod.levels[0].object.children.forEach((o) => probe.add(new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))));
  probe.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), box = new THREE.Box3().setFromObject(probe);
  const place = (list, name) => list.map(([y, z, x], k) => {   // x (optional): a fixed position for top exits ahead of the tail
    ray.set(new THREE.Vector3(box.max.x + 1, y, z), new THREE.Vector3(-1, 0, 0));
    const hit = ray.intersectObject(probe, true)[0];
    const a = new THREE.Object3D();
    a.name = `${name}_${k}`;
    a.position.set(x ?? (hit ? hit.point.x : box.max.x) + 0.02, y + lift, z);
    const up = spec.up ?? 0;
    a.userData.dir = new THREE.Vector3(1 - up, up, 0).normalize();     // car frame: the tail is +x
    car.add(a);
    if (DEBUG_EXHAUST) a.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: name === 'nitro' ? 0x36d6ff : 0xff7a1a })));
    return a;
  });
  const exhausts = place(spec.tips || [], 'exhaust');
  return { exhausts, nitro: spec.nitro ? place(spec.nitro, 'nitro') : exhausts, electric: !!spec.electric, fxSpec: spec.fx };
}

/** Assemble one car. Returns { key, root, wheels, lamps, materials, update(...) }. */
export async function assemble(loader, key, k, hero) {
  const model = MODELS[key]?{...MODELS[key]}:null, base = await profileFile(key)?.(), profile = model ? modelProfile(base, model) : base, tuning = model?.source?.replacement ? TUNING[key]?.replacement ?? {} : TUNING[key] ?? {};   // a replacement model ignores the old shell's fixes; its own go under tuning.replacement
  const m = createVehicleMaterials();
  for (const p of ['envMapIntensity', 'roughness', 'opacity']) if (Number.isFinite(profile.glassMaterial?.[p])) m.glass[p] = profile.glassMaterial[p];
  const team = TEAM_OF[key];
  m.setPaint({ color: team.colors.primary, finish: team.finish, livery: 'solid', carbon: !model && team.colors.carbon });   // a model has its own carbon parts
  // race paint: a deeper base under a near-mirror clearcoat. The body's baked shading normals are diffused (see
  // derive-car-lods.mjs), so the coat reflects the venue as smooth panels; saturated colours darken most, whites least.
  const hsl = m.body.color.getHSL({});
  for (const p of [m.body, m.mirrorPaint]) {
    p.color.multiplyScalar(0.55 + 0.3 * (1 - hsl.s));
    if (p.clearcoat > 0.5) p.clearcoatRoughness = 0.035;
  }
  m.mirrorGlass.envMapIntensity = 0.35;     // a perfect mirror turned the brightest venue light into a white disc
  const root = new THREE.Group(); root.name = `car_${key}`;
  const car = new THREE.Group(); car.name = 'vehicle'; root.add(car);       // the car in car-lab's frame (nose -X)
  const body = new THREE.Group(); body.name = 'sprung'; car.add(body);     // everything on the springs; the wheels stay in `car`
  // body: derived LODs, already normalised; lift as car-lab's normalizeShell applies it
  const lod = new THREE.LOD(); lod.name = 'body'; lod.position.y = profile.body.lift;
  const loadBodyLevel = async (i,dist) => {
    const fallback='/assets/cars/'+key+'/'+(model?'car':'body')+'_lod'+i+'.glb';
    const variant=model&&new URLSearchParams(location.search).get('tex')!=='webp'&&CAR_TEXTURES[key]?.['lod'+i];
    const g=variant?await loader.loadAsync('/assets/cars/'+key+'/'+variant).catch(()=>loader.loadAsync(fallback)):await loader.loadAsync(fallback);
    if (model && i === 0) model.scene = g.scene;                      // its wheels are built below
    // car-lab's paint shader reads raw positions (stripes across Z, carbon lower trim below Y=0.2 m). The web GLB is
    // quantized (int16 positions + a node scale), which squashed everything into "lower trim": bake back to metres.
    g.scene.updateMatrixWorld(true);
    const meshes = [];
    (model && i === 0 ? g.scene.getObjectByName('body') : g.scene).traverse((o) => { if (o.isMesh) meshes.push(o); });   // LOD 1 is the body alone
    const level = new THREE.Group();
    for (const o of meshes) {
      const src = o.geometry, n = src.attributes.position.count, P = new Float32Array(n * 3), N = new Float32Array(n * 3), v = new THREE.Vector3();
      const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(src.attributes.position, i).applyMatrix4(o.matrixWorld);
        P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;   // not toArray: half a second of a race's load, over eight cars
        if (src.attributes.normal) { v.fromBufferAttribute(src.attributes.normal, i).applyMatrix3(nm).normalize(); N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z; }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      if (src.attributes.normal) geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); else geo.computeVertexNormals();
      if (src.attributes.uv) geo.setAttribute('uv', src.attributes.uv);
      geo.setIndex(src.index);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, model ? roleMaterial(o.material, m) : m.body);
      mesh.castShadow = mesh.receiveShadow = true;
      if (model) mesh.srcMaterial = o.material;   // the model's own material before the role swap: tail specs read its name and map (taillights.js)
      level.add(mesh);
    }
    lod.addLevel(level, dist, 0.05);   // ~2 m hysteresis at 45 m: no body-LOD blinking for a car holding a gap there
  };
  await loadBodyLevel(0,0);
  let farPromise;lod.userData.loadFar=()=>farPromise??=loadBodyLevel(1,45).catch(error=>{farPromise=null;throw error;});
  body.add(lod);
  // team livery: decal sheets projected in the paint shader from the body's own bounds (see livery.js)
  const box = new THREE.Box3();
  lod.levels[0].object.children.forEach((o) => { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); });
  const entry = team.cars.find((c) => c.key === key);
  applyLivery(m.body, await makeLivery({ team, car: entry, profile, box, k: hero ? 400 : 256 }), box);
  const finish = FINISHES_CARS.cars[key] ?? {};          // the car's real surface: flake, pearl, carbon, wheels (finish.js)
  applyFinish(m.body, model ? { ...finish, carbonBelow: 0 } : finish, box);
  if (finish.rim) m.rim.color.set(finish.rim);
  if (finish.caliper) m.caliper.color.set(finish.caliper);
  polishPaint(m.body); polishPaint(m.mirrorPaint); polishPaint(m.glass);
  const fx = emitters(body, lod, profile.body.lift, key, model?.exhaust);
  const aero = tuning.aero?.length ? new ActiveAero(lod, tuning.aero) : null;   // after the probes above read the whole shell
  m.mirrorPaint.color.set(team.colors.secondary).multiplyScalar(0.8);
  const wheelSet = model ? modelWheels(model.scene, profile, m, key) : createWheelSet(profile, m, k % 2 ? 'turbine' : 'split');
  // per-axle nudges from the QA (tuning.wheels.front|rear.dx, m; -x is forward): centre a tyre in an arch the
  // car-lab fit left off-centre
  for (const w of wheelSet.wheels) { const dx = tuning.wheels?.[w.axle]?.dx; if (dx) w.pivot.position.x += dx; }
  const lamps = model ? modelLamps(profile, m) : createVehicleLights(profile, m);
  car.add(wheelSet.root);
  if (model) {                     // its own glass, cabin and mirrors; the mirror glass moves to the group hidden far off
    const sideMirrors = new THREE.Group(); sideMirrors.name = 'mirrors';
    lod.levels[0].object.children.filter((o) => o.material === m.mirrorGlass).forEach((o) => sideMirrors.add(o));
    body.add(sideMirrors, lamps.root);
    return finishCar({ key, profile, tuning, finish, team, root, car, body, aero, lod, wheelSet, sideMirrors, lamps, m, hero, fx });
  }
  const sideMirrors = tuning.mirrors ? buildMirrors(profile, m, tuning.mirrors) : createMirrors(profile, m);
  const glass = createGlass(profile, m);
  if (tuning.glass?.scale) {                                 // grow the panes a little about their centre to close frame gaps
    const gb = new THREE.Box3().setFromObject(glass), gc = gb.getCenter(new THREE.Vector3()), k = new THREE.Vector3(...tuning.glass.scale);
    glass.scale.copy(k); glass.position.add(gc.clone().sub(gc.clone().multiply(k)));
  }
  body.add(glass, sideMirrors, lamps.root, bPillars(profile));
  // a dark inside behind every gap (cabin tub, inner shell): the shells are hollow skins (carkit/interior.js)
  // window outlines from the profile (shell metres); the glass group's own bounds reach far below the windows
  const glassBox = new THREE.Box3();
  for (const pane of Object.values(profile.glass ?? {})) if (Array.isArray(pane) && Array.isArray(pane[0])) pane.forEach((q) => glassBox.expandByPoint(new THREE.Vector3(q[0], q[1], Math.abs(q[2]))));
  addInterior(lod, glassBox, box, { ...tuning.interior, glass: profile.glass }, profile.wheels);
  const inner = lod.levels[0].object.getObjectByName('interior'); if (inner) mergeByMaterial(inner);   // ~14 parts -> 2 draws
  return finishCar({ key, profile, tuning, finish, team, root, car, body, aero, lod, wheelSet, sideMirrors, lamps, m, hero, fx });
}

/** Shared end of assembly: headlight beams, merged wheel and part groups, wheel stand-ins, the far proxy, springs. */
function finishCar({ key, profile, tuning, finish, team, root, car, body, aero, lod, wheelSet, sideMirrors, lamps, m, hero, fx }) {
  // real lights: player car keeps its two headlight beams (always "visible", so toggling never recompiles shaders);
  // everyone else keeps only the emissive lamp geometry
  const beams = [];
  lamps.root.traverse((o) => { if (o.isLight) (hero && o.isSpotLight ? beams : []).push(o); });
  // every car remembers where its own beams sit (shifted like the hero's below), so a car switch can hand them over
  lamps.spots = [];
  lamps.root.traverse((o) => { if (o.isSpotLight) lamps.spots.push({ pos: o.position.clone().setX(o.position.x - 0.6), target: o.target.position.clone().setX(o.target.position.x - 0.6) }); });
  [...lamps.root.children].forEach(function strip(o) { [...o.children].forEach(strip); if (o.isLight && !beams.includes(o)) { o.parent.remove(o); if (o.target) o.target.parent?.remove(o.target); } });
  beams.forEach((b) => {                                     // start the beams ahead of the nose: from inside the bumper
    b.castShadow = false;                                    // they lit the car's own bodywork at point-blank range
    b.position.x -= 0.6;
    if (b.target) b.target.position.x -= 0.6;
  });

  // merge per material inside each rigid group
  // wheels: car-lab's are 36k triangles each (more than the body). Beyond DETAIL_M a ~200-triangle stand-in (tyre and
  // rim faces) takes over; neither casts shadows (the body and the contact shadow ground the car)
  const detail = [], simple = [];
  for (const w of wheelSet.wheels) {
    mergeByMaterial(w.spin, false);
    shedBodywork(w.spin, w.spec.radius, lod.levels[0].object);     // body parts a model's wheel node holds would spin round the hub
    w.spin.children.forEach((o) => detail.push(o));
    const cal = w.pivot.getObjectByName(`${w.pivot.name}_calipers`);
    if (cal) { mergeByMaterial(cal); detail.push(cal); }
    const R = w.spec.radius, W = w.spec.width;
    const low = new THREE.Group(); low.name = 'wheel-lod';
    low.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 20, 1, true).rotateX(Math.PI / 2), m.rubber));
    for (const sgn of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.72, 16), m.rim);
      face.position.z = sgn * W * 0.42; if (sgn < 0) face.rotation.y = Math.PI;
      const wall = new THREE.Mesh(new THREE.RingGeometry(R * 0.72, R, 20, 1), m.rubber);
      wall.position.z = sgn * W * 0.5; if (sgn < 0) wall.rotation.y = Math.PI;
      low.add(face, wall);
    }
    low.visible = false;
    w.spin.add(low);
    simple.push(low);
  }
  // far proxy: static clones of the four stand-in wheels (5 meshes each, so 20 draws; docs/10x/wp2-merge-wheels.patch
  // merges them to 2); beyond FAR_M nobody sees a wheel spin or steer
  car.updateMatrixWorld(true);
  const inv = car.matrixWorld.clone().invert(), proxy = new THREE.Group();
  proxy.name = 'wheels-far';
  for (const low of simple) {
    const cl = low.clone(); cl.visible = true;
    low.updateMatrixWorld(true);
    cl.matrix.multiplyMatrices(inv, low.matrixWorld).decompose(cl.position, cl.quaternion, cl.scale);
    proxy.add(cl);
  }
  car.add(proxy);
  for (const g of body.children) if (g !== lod) mergeByMaterial(g);
  proxy.visible = false;
  const shadow = contactShadow(bodyBox({ lod, profile }), profile.wheels), pf = profile.wheels.front, pr = profile.wheels.rear;
  root.add(shadow);
  // exhausts / nitro: Object3D anchors on the body for exhaust smoke, pops and nitro flames (electric: no exhaust)
  const chassis = new Chassis(body, tuning.suspension);
  chassis.reach = { x: Math.max(0.8, Math.abs(pf.x - pr.x) / 2), z: Math.max(0.5, (pf.track + pr.track) / 4) };
  return fitLamps({ key, profile, tuning, finish, team, root, car, body, chassis, shadow, wheelbase: Math.abs(pf.x - pr.x), track: (pf.track + pr.track) / 2, aero, lod, wheels: wheelSet.wheels, wheelRoot: wheelSet.root, proxy, sideMirrors, lamps, beams, materials: m, hero, detail, simple, dist: 0, speed: 0, lat: 0, steer: 0, ...fx });   // realistic tail lamps (opt-in) built before the shader warm-up
}

// ------------------------------------------------------------------------------------------------ the field

export class Field {
  constructor(scene,{loadCar=assemble}={}) { this.loadCar=loadCar;this.queue=new AssetQueue(2);this.farGate=Promise.resolve();this.pending=new Map();this.scene = scene; this.cars = []; this.parked = []; this.all = []; this.envT = 0; this.lightMode = 'low'; }

  async load(loader, keys = DEFAULT_LINEUP) {
    this.loader=loader;
    const settled=await Promise.allSettled(keys.map(key=>this.ensure([key])));
    settled.forEach((r,i)=>{if(r.status==='rejected')console.warn('Car '+keys[i]+' skipped:',r.reason);});
    if(!this.all.length)throw Error('No cars could be loaded.');
    this.hero=this.all.find(c=>c.key===keys[0])??this.all[0];
    // one car per team: the hero for its own team, else the team's first (or ?lineup=2 second) loaded car
    const racers=TEAMS.teams.map(t=>t.cars.some(c=>c.key===this.hero.key)?this.hero:[t.cars[LINEUP],t.cars[1-LINEUP]].map(c=>this.all.find(a=>a.key===c.key)).find(Boolean)).filter(Boolean);
    this.cars=keys.length===1?[this.hero]:[this.hero,...racers.filter(c=>c!==this.hero)].slice(0,GRID);this.syncActiveCars();
    this.hero.hero=true;this.hero.root.visible=true;this.initCapture();
    return this.all.length;
  }

  /** Load only cars needed by the current garage selection or race. Requests are shared. */
  async ensure(keys) {
    return Promise.all([...new Set(keys)].map(key=>{
      const ready=this.all.find(c=>c.key===key);if(ready)return ready;
      if(!KEYS.includes(key))return Promise.reject(Error('Unknown car: '+key));
      if(!this.pending.has(key)){
        this.firstKey??=key;
        const promise=this.queue.run(async()=>{
          const c=await this.loadCar(this.loader,key,KEYS.indexOf(key),key===this.firstKey);
          c.root.visible=false;this.all.push(c);
          // The distant body is not needed for the first menu/showroom frame. Its meshes arrive casting: a car already out of
          // the shadow band turns them off here (forgetting c.cast instead would also drop its 3 m hysteresis state). farGate (main.js
          // ensureVenue) holds them until the venue is in, so their bytes do not compete with the race-critical download.
          const timer=setTimeout(()=>this.farGate.then(()=>this.queue.run(()=>c.lod.userData.loadFar().then(()=>{if(c.cast===false)c.lod.traverse((o)=>{if(o.isMesh)o.castShadow=false;});}),{low:true})).catch(e=>console.warn('Distant car LOD:',e)),1800);timer.unref?.();
          return c;
        }).catch(error=>{this.pending.delete(key);throw error;});
        this.pending.set(key,promise);
      }
      return this.pending.get(key);
    }));
  }

  /** Player-car reflections of the venue: a small cube capture around the car, PMREM-filtered (see update). */
  initCapture() {
    this.cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    this.cubeCam = new THREE.CubeCamera(0.5, 400, this.cubeRT);   // 400 m: the venue around the car, not the far city
    this.scene.add(this.cubeCam);
    this.face = 0;
  }

  /** The hero is hidden from its own capture, and its lamps with it. Three keys every lit material on the scene's light count, so a capture with
   *  fewer lights re-keys ~100 materials on the way in and again on the way out (every 4 frames: ~1.5 ms a frame, 40 MB/s of garbage, and a second
   *  program set to compile). Dark stand-ins, shown only during a capture, hold the count. */
  captureLights(h, on) {
    let n = 0;
    if (on) h.root.traverse((o) => { if (o.isSpotLight) n++; });   // visible or not: the menu's warm-up runs with the beams off, the race with them on. shortcut: spots only, the hero carries no other kind; another kind just costs the re-key again
    const pool = this.standIns ??= [];
    while (pool.length < n) { const s = new THREE.SpotLight(0x000000, 0); this.scene.add(s); pool.push(s); }
    pool.forEach((s, i) => { s.visible = on && i < n; });
  }

  /** Compile the cube-capture variants (cube target). The race draws them every few frames; menu idle warms them early.
   *  extra/around: see warmup.js compileVisible. */
  async compileCube(renderer,{isCancelled=()=>false,extra,around,inflight}={}) {
    const {compileVisible}=await import('./warmup.js');
    const shadows=renderer.shadowMap.enabled,target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
    const wrap=around??(fn=>fn());
    let ready;
    const stable=this.stableCapture!==false;
    // the cube is the target compileVisible captures (program keys include the output colour space); the capture's light set is held only while a chunk is submitted
    try{
      renderer.setRenderTarget(this.cubeRT,0);
      ready=compileVisible(renderer,this.scene,this.cubeCam.children[0],{isCancelled,extra,inflight,around:fn=>wrap(()=>{
        if(stable)this.captureLights(this.hero,true);else renderer.shadowMap.enabled=false;
        try{fn();}finally{if(stable)this.captureLights(this.hero,false);else renderer.shadowMap.enabled=shadows;}})});
    }finally{renderer.setRenderTarget(target,face,mip);}
    return ready;
  }

  /** Capture the first paint reflection before the race so its shader variant is warmed too. */
  async prepareReflection(renderer, hide = [], isCancelled = ()=>false) {
    const h=this.hero;if(!h)return;
    const hidden=hide.filter(o=>o?.visible),visible=h.root.visible,shadows=renderer.shadowMap.enabled,shadowAuto=renderer.shadowMap.autoUpdate,stable=this.stableCapture!==false;
    hidden.forEach(o=>{o.visible=false;});h.root.visible=false;
    try{
      if(stable)renderer.shadowMap.autoUpdate=renderer.shadowMap.needsUpdate=false;else renderer.shadowMap.enabled=false;
      this.cubeCam.position.copy(h.root.position).add(new THREE.Vector3(0,1.2,0));
      this.cubeCam.updateMatrixWorld(true);
      if(this.cubeCam.coordinateSystem!==renderer.coordinateSystem){
        this.cubeCam.coordinateSystem=renderer.coordinateSystem;this.cubeCam.updateCoordinateSystem();
      }
      // Async compilation before the first cube draw prevents six synchronous shader stalls.
      const {paintFrame}=await import('./warmup.js');
      const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
      try{
        await this.compileCube(renderer,{isCancelled});
        // Yield between faces; the loading slideshow stays on its own compositor layers.
        for(let i=0;i<6;i++){
          if(isCancelled())return;
          if(stable)this.captureLights(h,true);   // only around the draw: compileCube's chunks turn them off behind them
          renderer.setRenderTarget(this.cubeRT,i);renderer.render(this.scene,this.cubeCam.children[i]);
          if(stable)this.captureLights(h,false);
          renderer.setRenderTarget(target,face,mip);
          await paintFrame();
        }
      }finally{renderer.setRenderTarget(target,face,mip);}
      this.pmrem??=new THREE.PMREMGenerator(renderer);
      this.envRT=this.pmrem.fromCubemap(this.cubeRT.texture,this.envRT);
      this.useHeroEnvironment(h);this.face=0;
    }finally{renderer.shadowMap.enabled=shadows;renderer.shadowMap.autoUpdate=shadowAuto;h.root.visible=visible;hidden.forEach(o=>{o.visible=true;});}
  }

  useHeroEnvironment(h) {
    if(this.envHero===h)return;
    const mats=c=>{const m=c.materials;return [m.body,m.mirrorPaint,m.glass,m.rim,m.mirrorGlass,m.headlampCover,m.frontLens,m.rearLens];};
    if(this.envHero)for(const m of mats(this.envHero))if(m){m.envMap=null;m.needsUpdate=true;}
    for(const m of mats(h))if(m){m.envMap=this.envRT.texture;m.needsUpdate=true;}
    this.envHero=h;
  }

  /** Track path from main.js (racing line curve) + per-sample target speeds for braking. */
  setTrack(curve, length) {
    this.curve = curve; this.length = length;
    const N = 1200, p = [];
    for (let i = 0; i < N; i++) p.push(curve.getPointAt(i / N));
    const v = speedProfile(p, length, yawFade, AI_PLAN);
    this.vt = v; this.N = N;
  }

  /** Inactive garage/race choices stay cached, but do not enter any world render or physics pass. */
  syncActiveCars() {
    const active=new Set(this.cars);
    this.parked=[];
    for(const c of this.all){
      const selected=active.has(c);c.root.visible=selected;
      if(selected){if(c.root.parent!==this.scene)this.scene.add(c.root);}
      else{c.root.removeFromParent();c.beams.forEach(b=>{b.visible=false;});}
    }
  }

  /** Line the cars up on the grid slots (game coords from track.json), nose along the track. */
  grid(track) {
    this.track = track;
    this.fallY = Math.min(-30, Math.min(...track.centerline.map((p) => p[1])) - 30);      // fallen off the world: 30 m under the lap's lowest road, never higher than the old -30 (Hartwell Wold's valley is 34 m under its start line)
    const slots = track.start.gridSlots;
    this.cars.forEach((c, k) => {
      const q = this.gridOrder?.indexOf(c.key) ?? -1;                      // a career race: the qualifying order (game.js startSession)
      const row = q >= 0 ? q : c.hero ? this.cars.length - 1 : k - 1;      // otherwise the player starts last and hunts the pack
      const s = slots[row % slots.length];
      c.dist = ((-9 - row * 8) % this.length + this.length) % this.length;
      c.speed = 0;
      c.lat = (k % 2 ? -1.6 : 1.6);
      c.root.position.set(s.pos[0], s.pos[1], s.pos[2]);
      c.root.rotation.y = (s.headingYawRad ?? Math.PI / 2) - Math.PI / 2;   // +X along the slot heading (atan2(dx,dz)): India's grid sits on a bend
      if (this.runUp) {                                                    // one-lap qualifying: back up the road, so the timed lap starts at speed; a teammate rolls out just ahead, on his own clock
        const u = 1 - (this.runUp - (c.hero ? 0 : 20)) / this.length, p = this.curve.getPointAt(u), d = this.curve.getTangentAt(u);
        c.root.position.copy(p); c.root.rotation.y = Math.atan2(d.x, d.z) - Math.PI / 2;
      }
      c.car.rotation.y = Math.PI;                                          // car-lab noses point -X
      c.onGrid = true; c.reverse = false;
    });
  }

  /**
   * Physics (src/physics): every racing car becomes a Rapier vehicle on the track's collision mesh, driven by the
   * player (the hero, when `player`) or the AI on the racing line. Call after grid().
   */
  enablePhysics(pw, { player = true } = {}) {
    this.pw = pw; this.physics = true; this.input ??= new PlayerInput();
    const up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3();
    this.linePts = []; this.lineLeft = [];
    for (let i = 0; i < this.N; i++) {
      this.linePts.push(this.curve.getPointAt(i / this.N));
      this.curve.getTangentAt(i / this.N, t); t.y = 0; t.normalize();
      this.lineLeft.push(new THREE.Vector3().crossVectors(up, t));
    }
    this.cars.forEach((c, k) => {
      c.vehicle = new Vehicle(pw, handling(c.key), c.profile, { pos: c.root.position.clone(), yaw: c.root.rotation.y });
      c.ai = new AIDriver(this, c, c.hero ? 1 : this.paceFor?.(c.key) ?? (0.93 + 0.012 * k) * (this.hardPace ?? 1), c.hero ? null : this.aiFor?.(c.key) ?? null);   // paceFor: the career's driver ratings, Hard mode already in them; aiFor: its rival profiles (driver.js), never on the hero
      c.ai.lane = c.hero ? 0 : (k % 2 ? -1 : 1) * 0.6;
      if (this.runUp) c.ai.i = this.nearestLine(c.root.position);   // read() walks forward from i: from 0 it would chase a line 250 m up the road
      c.chassis.scale = 0.5;                           // the rigid body pitches and rolls on its own springs too
    });
    this.setPlayer(player);
  }

  /**
   * Set up a session (src/game): `hero` is the player's car, `racers` the cars on the grid (the hero included, in any
   * order; the hero starts last). Other cached cars remain outside the scene. Any physics from the last session is
   * dropped; call enablePhysics(new world) after. The hero's headlight beams move to the new hero.
   */
  configure({ hero, racers }) {
    this.input?.clear();
    const byKey = (k) => this.all.find((c) => c.key === k);
    const prev = this.hero, next = byKey(hero) ?? this.all[0];
    if (prev && prev !== next && prev.beams.length) {               // the two real spotlights follow the player's car
      // each beam takes the new car's own spot on its side (lamp width, height and projector differ per car); a side
      // with fewer spots than beams doubles them up
      const used = {};
      for (const b of prev.beams) {
        const side = Math.sign(b.position.z), own = next.lamps.spots.filter((s) => Math.sign(s.pos.z) === side);
        const s = own[(used[side] = (used[side] ?? -1) + 1) % own.length];
        next.lamps.root.add(b); if (s) b.position.copy(s.pos);
        if (b.target) { next.lamps.root.add(b.target); if (s) b.target.position.copy(s.target); }
      }
      next.beams = prev.beams; prev.beams = [];
    }
    for (const c of this.all) {
      c.hero=c===next;delete c.vehicle;delete c.ai;c.root.visible=true;c.root.quaternion.identity();
      c.speed=c.brake=c.steer=c.throttle=0;c.chassis?.reset();
      for(const w of c.wheels){w.pivot.rotation.y=0;w.spin.rotation.z=0;if(w.baseY!==undefined)w.pivot.position.y=w.baseY;}   // the last session's wheel angle does not carry over
      c.car.position.y=0;c.car.rotation.x=c.car.rotation.z=0;   // nor the suspension plane (drivePhysics)
      if(c.shadow){c.shadow.rotation.set(0,0,0);c.shadow.position.y=0.025;c.shadow.material.opacity=0.85;}   // flat again (groundShadow tilts it while driving)
    }
    this.hero = next;
    this.cars = [...new Set([next, ...racers.map(byKey).filter(Boolean)])];
    this.syncActiveCars();
    this.physics = false; this.pw = null; this.hold = false; this.rig = null;
    if (this.track) this.grid(this.track);
    return this.cars;
  }

  /** the hero is driven by the keyboard / gamepad (true) or by the AI (false: autopilot, benchmarks) */
  setPlayer(on) {
    this.input?.clear();this.hero?.vehicle?.resetControls(); this.playerDrives = on;
    // a player-driven hero never runs ai.read, so ai.i is stale (0 or the last respawn): AIDriver's windowed walk from there locked
    // onto another leg of the track on the cool-down lap
    const h = this.hero; if (!on && h?.vehicle && h.ai) { h.ai.i = this.nearestLine(h.vehicle.cur.pos); h.ai.stuck = 0; h.ai.laneNow = undefined; h.ai.passSide = 0; }
  }

  /** index of the racing-line point nearest p (a full scan) */
  nearestLine(p) { let best = Infinity, bi = 0; this.linePts.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < best) { best = d; bi = i; } }); return bi; }

  /** the player's driving aids: countersteer help, yaw stability, traction control (0 = off) */
  assists = { counter: 0.45, stability: 1.25, tcs: 0.8 };

  /** put a car back on the racing line at its nearest point, facing along it */
  respawn(c) {
    if(c.hero)this.input?.clear({preserveResetLatch:true});
    const bi = this.nearestLine(c.vehicle.cur.pos);
    const a = this.linePts[bi], b = this.linePts[(bi + 2) % this.N];
    c.vehicle.respawn(a, Math.atan2(-(b.z - a.z), b.x - a.x));
    if (c.hero) this.rig?.cut();                                      // the camera snaps behind the car; the speed that vanished is not a crash
    if (c.ai) { c.ai.i = bi; c.ai.stuck = 0; }
  }

  drivePhysics(dt) {
    const alpha = this.pw.advance(dt, (h) => {
      for (const c of this.cars) {
        const v = c.vehicle, player = c.hero && this.playerDrives;
        let ctl = player ? this.input.read(h, v.speed) : c.ai.read(v);
        if (player) this.playerThrottle = ctl.throttle;              // engine sound revs on the grid too
        if (this.hold) { ctl = { throttle: 0, brake: 1, steer: 0, handbrake: 0, nitro: 0, reset: false, hold: true }; if (c.ai) c.ai.stuck = 0; }   // on the grid until the lights go out (not 'stuck')
        if (ctl.reset) {this.respawn(c);ctl={throttle:0,brake:0,steer:0,handbrake:0,nitro:0,reset:false};}
        if (c.hero && this.ctlOver && !this.hold) ctl = { ...ctl, ...this.ctlOver };   // trailer shots: nitro or handbrake on cue over the AI
        Object.assign(v.controls, { hold: false }, ctl);
        v.step(h, player ? this.assists : { counter: 0.6, stability: 1.4, tcs: 1 });
        if (v.state.upsideDown > 1.5 || v.cur.pos.y < (this.fallY ?? -30)) this.respawn(c);
      }
    });
    for (const c of this.cars) {
      const v = c.vehicle;
      v.pose(alpha, c.root.position, c.root.quaternion);
      c.car.rotation.y = Math.PI;
      c.onGrid = this.hold;
      c.yaw = v.yaw; c.speed = v.speed; c.brake = THREE.MathUtils.clamp(v.state.serviceBrake ?? v.controls.brake, 0, 1);
      c.reverse = !!v.state.reverse;
      c.curvature = -v.aBody.z / Math.max(v.speed * v.speed, 1);
      const vc = c.vc ??= [0.065, 0.065, 0.065, 0.065], fit = [];
      for (const w of c.wheels) {
        const i = v.wheels.findIndex((q) => (q.front === (w.axle === 'front')) && (q.side < 0) === (w.pivot.position.z > 0)), pw = v.wheels[i];
        if (!pw) continue;
        w.baseY ??= w.pivot.position.y;
        // `comp` is one ray against the collision mesh per 120 Hz step: its seams and kerb edges are 30-60 mm one-frame pops,
        // which read as the tyre buzzing. The wheel follows it through a critically damped spring (~40 ms), so it moves like a damper
        // A miss (a seam between collision triangles) reads as comp 0: the wheel droops at once but its extension speed ramps up
        // with time airborne, so a 1-2 frame miss moves it ~3 mm while a real jump or impact reaches full droop in ~0.1 s
        if (w.vehicle !== v) { w.vehicle = v; w.vy = w.tgt = pw.comp; w.vv = w.air = 0; }
        wheelStep(w, pw.contact, pw.comp, WHEEL_OMEGA, dt);
        vc[i] = w.vy;
        const d = w.vy - 0.065;
        w.pivot.position.y = w.baseY + WHEEL_SHOW * d;                     // the wheel shows a share of its suspension travel...
        fit.push([w.pivot.position.x, w.pivot.position.z, (1 - WHEEL_SHOW) * d]);
        if (w.axle === 'front') w.pivot.rotation.y = v.state.steer;
        // beyond ~0.3 rad a frame a spoked rim aliases (wagon wheel, strobing): the visual spin saturates there, sign kept
        const step = pw.omegaR / w.spec.radius * dt;
        w.spin.rotation.z += this.trueSpin ? step : SPIN_STEP * Math.tanh(step / SPIN_STEP);   // trueSpin: the trailer recorder, whose motion blur smears the spokes
      }
      // ...and the car (body and wheels) takes the rest as a plane (heave, pitch, roll) through the four wheels, so the tyres stay on the
      // road while body and wheels move a third as much against it: the arcade suspension travels 10-15 cm and pogos ~5 cm at 3 Hz
      // over kerbs (measured, Tokyo T1 at 110 km/h), which read as wheels bobbing in their arches. Visual only: physics is untouched.
      if (fit.length === 4) {
        const n = 4, mx = fit.reduce((s, p) => s + p[0], 0) / n, mz = fit.reduce((s, p) => s + p[1], 0) / n, mr = fit.reduce((s, p) => s + p[2], 0) / n;
        let sxx = 0, sxr = 0, szz = 0, szr = 0;
        for (const [x, z, r] of fit) { sxx += (x - mx) ** 2; sxr += (x - mx) * (r - mr); szz += (z - mz) ** 2; szr += (z - mz) * (r - mr); }
        const a = sxx > 1e-6 ? sxr / sxx : 0, b = szz > 1e-6 ? szr / szz : 0;
        c.car.position.y = mr - a * mx - b * mz; c.car.rotation.x = b; c.car.rotation.z = a;   // car-local plane y = heave + a x + b z (rotation.y is PI)
      }
      if (c.shadow) groundShadow(c);
      const slip = Math.max(THREE.MathUtils.smoothstep(v.latSlip, 0.1, 0.32), v.spinSlip);
      this.dynamics(c, dt, v.aBody.x, -v.aBody.z, { throttle: v.controls.throttle, nitro: v.state.nitroOn, slip: v.onGround ? slip : 0 });
      if (c.hero) this.rig?.setBoost(v.state.nitroOn);
    }
  }

  /** Drive: everyone follows the racing line at a grip-limited speed; `pace` scales it (player car 1.0). */
  drive(dt, pace = 1, headless = false) {
    if (!this.curve) return;
    if (this.physics) return this.drivePhysics(dt);
    const up = new THREE.Vector3(0, 1, 0), t = new THREE.Vector3(), side = new THREE.Vector3();
    // traffic: a car closing on another in its lane slows to that car's pace and moves to the clearer side to pass
    // (without it the player drove through the pack and lit the car ahead from inside)
    const L = this.length;
    for (const c of this.cars) {
      c.block = null;
      for (const o of this.cars) {
        if (o === c) continue;
        const gap = ((o.dist - c.dist) % L + L) % L;
        if (gap > 0.5 && gap < 16 && Math.abs((o.curLat ?? 0) - (c.curLat ?? 0)) < 2.3 && (!c.block || gap < c.block.gap)) c.block = { car: o, gap };
      }
      if (c.block) c.passSide = c.passSide || ((c.block.car.curLat ?? 0) > (c.curLat ?? 0) ? -1 : 1);
      else if (!c.block && c.passT === undefined) c.passSide = 0;
    }
    this.cars.forEach((c, k) => {
      c.onGrid = false;
      const i = Math.floor((c.dist / this.length) * this.N) % this.N;
      let target = this.vt[(i + 6) % this.N] * pace * (c.hero ? 1 : 0.94 + 0.012 * k);
      if (c.block) target = Math.min(target, c.block.car.speed * (c.block.gap < 7 ? 0.9 : 1.0));
      const acc = target > c.speed ? Math.min(6, (target - c.speed) * 2) : Math.max(-11, (target - c.speed) * 3);
      c.brake = THREE.MathUtils.clamp(-acc / 9, 0, 1);
      c.speed = Math.max(0, c.speed + acc * dt);
      c.acc = acc;
      c.dist = (c.dist + c.speed * dt) % this.length;
      const u = c.dist / this.length;
      const p = this.curve.getPointAt(u);
      this.curve.getTangentAt(u, t); t.y = 0; t.normalize();
      side.crossVectors(up, t);                                              // left of travel
      c.latT = (c.latT ?? 0) + dt * 0.21;
      const base = c.hero ? 0 : c.lat * Math.sin(c.latT + k);
      const pass = c.block ? c.passSide * 2.6 : 0;                         // pull out to pass, drift back once clear
      c.curLat = THREE.MathUtils.lerp(c.curLat ?? base, THREE.MathUtils.clamp(base + pass, -4.5, 4.5), Math.min(1, dt * 1.6));
      if (!c.block) c.passSide = 0;
      const lat = c.curLat;
      c.root.position.copy(p).addScaledVector(side, lat);
      c.root.rotation.y = Math.atan2(t.z, -t.x) - Math.PI;                  // car-lab -X nose along the tangent
      c.yaw = c.root.rotation.y;
      c.car.rotation.y = Math.PI;
      // steering from curvature (bicycle model, 2.6 m wheelbase), wheel spin from speed
      const kk = this.curvatureSigned(u);
      c.curvature = kk;
      c.steer = THREE.MathUtils.lerp(c.steer, Math.atan(2.6 * kk), Math.min(1, dt * 6));
      for (const w of c.wheels) {
        if (w.axle === 'front') w.pivot.rotation.y = c.steer;
        w.spin.rotation.z += (c.speed / w.spec.radius) * dt;
      }
      this.dynamics(c, dt, acc, c.speed * c.speed * kk);
    });
    this.separate();
  }

  /** Body on its springs, active aero, exhaust and pops for one car. aLat: m/s² toward the car's left. */
  dynamics(c, dt, aLong, aLat, opts = {}) {
    c.chassis.update(dt, aLong, aLat, opts.bump ?? 0);
    c.aero?.update(dt, c.speed, c.brake ?? 0);
    if (!this.fx) return;
    const throttle = opts.throttle ?? THREE.MathUtils.clamp(aLong / 6, 0, 1);
    // exhaust gas, overrun crackle (sharp lift at rpm, upshifts), nitro jet and tyre smoke: carkit/fx.js decides per engine
    if (this.fx.drive(c, dt, throttle, opts)) this.onPop?.(c);
    c.throttle = throttle;
  }

  /** Cars alongside each other (within a car length) are pushed apart sideways, so weaving never overlaps them. */
  separate() {
    const L = this.length, cs = this.cars;
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
      const A = cs[a], B = cs[b];
      let gap = ((B.dist - A.dist) % L + L) % L; if (gap > L / 2) gap -= L;
      const dl = (B.curLat ?? 0) - (A.curLat ?? 0);
      if (Math.abs(gap) < 5.2 && Math.abs(dl) < 2.1) {
        const push = (2.1 - Math.abs(dl)) * 0.5, dir = dl >= 0 ? 1 : -1;
        A.curLat = THREE.MathUtils.clamp((A.curLat ?? 0) - dir * push, -4.5, 4.5);
        B.curLat = THREE.MathUtils.clamp((B.curLat ?? 0) + dir * push, -4.5, 4.5);
      }
    }
  }

  curvatureSigned(u) {
    const e = 6 / this.length, a = this.curve.getPointAt((u - e + 1) % 1), b = this.curve.getPointAt(u), c = this.curve.getPointAt((u + e) % 1);
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    return -2 * cross / Math.max(1e-6, a.distanceTo(b) * b.distanceTo(c) * a.distanceTo(c));
  }

  /** Per frame: lamps by look and braking, reflections for the player car. */
  update(t, camera, renderer, look, hideForCapture = [], boostForCapture = []) {
    for (const c of this.cars) {
      // detail by distance: full wheels within DETAIL_M, spinning stand-ins to FAR_M, one static proxy beyond (and no
      // side mirrors); only cars within SHADOW_M cast into the sun's shadow map. Every car is drawn again in the
      // mirror, shadow and capture passes, so its draw calls count several times over.
      // A 2-3 m margin keeps the current state, so a car holding a gap at a threshold does not blink between looks.
      const d = this.forceDetail ? 0 : c.root.position.distanceTo(camera.position), near =   // forceDetail: the trailer recorder (no stand-in wheels, chosen a frame late, in a plate)
        (on, thr, m) => on ? thr + m : thr - m, b = c.band ?? 0;
      const band = d < near(b === 0, DETAIL_M, 2) ? 0 : d < near(b < 2, FAR_M, 3) ? 1 : 2;
      if (band !== c.band) {
        c.band = band;
        c.detail.forEach((o) => { o.visible = band === 0; });
        c.simple.forEach((o) => { o.visible = band === 1; });
        c.wheelRoot.visible = band < 2; c.proxy.visible = band === 2; c.sideMirrors.visible = band < 2;
      }
      const cast = d < near(c.cast, SHADOW_M, 3);
      if (cast !== c.cast) { c.cast = cast; c.lod.traverse((o) => { if (o.isMesh) o.castShadow = cast; }); }
      // car-lab tunes its lamps for a studio; setLamps puts them at venue levels (tail lamps dim until the brake)
      setLamps(c, this.lightMode, c.onGrid ? 0 : (c.brake ?? 0), t, look);
    }
    // after every car's lamps, absolute (not *=): after a car switch the beams ride the new hero, but the old car's
    // lamps.update still writes them (650 cd, visible = on), and it may run after the hero or not at all
    const hi = this.lightMode === 'high', on = hi || this.lightMode === 'low';
    for (const c of this.cars) c.beams.forEach((b) => { b.visible = true; b.intensity = on ? (hi ? 1500 : 650) * 0.28 : 0; b.angle = hi ? 0.23 : 0.32; });  // stable light count; 650 cd blinded
    // player-car reflections: one cube face per frame, round-robin (all six at once cost six extra scene renders in a
    // single frame), then one PMREM filter when the set is fresh
    this.tick = (this.tick ?? 0) + 1;
    const captureEvery = this.captureEvery ?? 4;
    if (this.hero && captureEvery > 0 && this.tick % captureEvery === 0) {
      const h = this.hero, cams = this.cubeCam.children, stable = this.stableCapture !== false;
      if (this.face === 0) this.cubeCam.position.copy(h.root.position).add(new THREE.Vector3(0, 1.2, 0));
      this.cubeCam.updateMatrixWorld(true);
      if (stable) this.captureLights(h, true);
      h.root.visible = false;
      const hidden = hideForCapture.filter((o) => o && o.visible);
      hidden.forEach((o) => { o.visible = false; });
      const boosted = boostForCapture.map((m) => [m, m.emissiveIntensity]);
      boosted.forEach(([m, e]) => { m.emissiveIntensity = e * 3; });
      const prevTarget = renderer.getRenderTarget(), prevXr = renderer.xr.enabled, prevShadows = renderer.shadowMap.enabled, prevAuto = renderer.shadowMap.autoUpdate;
      renderer.xr.enabled = false;
      // Avoid re-rendering every shadow map for a 128px cube face (the maps stay bound: turning shadows off here would re-key every material too).
      if (stable) renderer.shadowMap.autoUpdate = renderer.shadowMap.needsUpdate = false; else renderer.shadowMap.enabled = false;
      renderer.setRenderTarget(this.cubeRT, this.face);
      renderer.render(this.scene, cams[this.face]);
      renderer.setRenderTarget(prevTarget);
      renderer.xr.enabled = prevXr;
      renderer.shadowMap.enabled = prevShadows; renderer.shadowMap.autoUpdate = prevAuto;
      if (stable) this.captureLights(h, false);
      hidden.forEach((o) => { o.visible = true; });
      boosted.forEach(([m, e]) => { m.emissiveIntensity = e; });
      h.root.visible = true;
      this.face = (this.face + 1) % 6;
      if (this.face === 0) {
        if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(renderer);
        this.envRT = this.pmrem.fromCubemap(this.cubeRT.texture, this.envRT);   // reuse the target: allocating one each time spiked frames
        this.useHeroEnvironment(h);
      }
    }
  }

  /** Chase camera behind the player car (camera.js): springs, look-ahead, speed FOV, roll, brake dip, shake. */
  chase(camera, dt, opts = {}) {
    const h = this.hero; if (!h) return;
    this.rig ??= new ChaseRig();
    // the camera asks the physics world how far it can go: a ray against the static collision mesh (walls, ground), never against cars
    const w = this.physics && h.vehicle && this.pw?.world;
    const cast = w ? (o, d, max) => { const r = w.castRay(new RAPIER.Ray(o, d), max, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, h.vehicle.collider, h.vehicle.rb); return r ? (r.timeOfImpact ?? r.toi) : null; } : null;
    this.rig.update(camera, h, dt, { ...opts, onKerb: opts.onKerb ?? this.onKerb(h), cast });
  }

  /** On a kerb: the car's line runs within ~0.6 m of the track edge (track.json halfWidth + the racing-line offset). */
  onKerb(c) {
    const t = this.track; if (!t || !c.speed) return false;
    if (c.vehicle) return c.speed > 12 && c.vehicle.wheels.some((w) => w.contact && w.surface?.rumble);   // physics never writes c.dist / c.curLat: read the tyres
    const n = t.centerline.length, i = Math.round((c.dist / this.length) * n) % n;
    return Math.abs((t.racingLine[i] ?? 0) + (c.curLat ?? 0)) > t.halfWidth[i] - 0.6 && c.speed > 12;
  }
}

/**
 * Repaint a car (the garage's paint tuner). paint: { color, finish, flake, livery, rim, caliper, accent }; anything
 * left out falls back to the car's defaults (team colour, its finishes.json finish, tuning wheels).
 */
export function defaultPaint(c) {
  const F = c.finish ?? {}, T = c.team;
  return { color: T.colors.primary, finish: F.paint === 'solid' ? 'gloss' : F.paint ?? T.finish ?? 'gloss', flake: F.flake ?? 0.5,
    livery: true, rim: F.rim ?? '#23262b', caliper: F.caliper ?? '#c62922', accent: T.colors.secondary };
}
export function paintCar(c, paint = {}) {
  const P = { ...defaultPaint(c), ...paint }, m = c.materials;
  const col = new THREE.Color(P.color), hsl = col.getHSL({});
  col.multiplyScalar(0.55 + 0.3 * (1 - hsl.s));                     // the deep race paint base (as in assemble)
  m.body.color.copy(col);
  setFinish(m.body, P.finish, P.flake);
  c.sideMirrors.traverse((o) => { if (o.material?.userData?.bodyPaint) { o.material.color.copy(col); setFinish(o.material, P.finish, 0); } });
  m.mirrorPaint.color.set(P.accent).multiplyScalar(0.8);
  if (m.body.userData.liveryOn) m.body.userData.liveryOn.value = P.livery ? 1 : 0;
  m.rim.color.set(P.rim); m.caliper.color.set(P.caliper);
  c.paint = P;
  return P;
}

export { FINISHES };
