// Car sandbox and QA pipeline (CAR-QA.md). One car on an empty pad, assembled exactly as in the race (cars.js), run
// through every check and a scripted test drive, with the results saved to track-viewer/qa/<car>/:
//   report.json / report.md   each check: pass / warn / fail, the measured value, what is expected, how to fix it
//   look.png                  studio turntable, dusk and night, and the low 3/4 close-up the reference uses
//   reference.png             our close-up beside the Endurance garage frames (qa/reference/*.png)
//   masks.png                 silhouettes from 11 directions: red = see-through, blue = opening the glass misses
//   lamps.png                 tail lamps off the brake and on it, dusk and night
//   drive.png                 the test drive: idle smoke, launch wheelspin, pops, braking dive + airbrake,
//                             cornering roll, drift smoke, nitro, tail lamps after the stop
// sandbox.html?car=av12        interactive (orbit; the test drive loops)
// sandbox.html?car=av12&qa=1   runs the pipeline once and sets window.__qa = { done, report }
// sandbox.html?car=av12&qa=trace  parks the car for scripts/car-trace.mjs (window.sandbox.trace)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { assemble, Field } from './cars.js';
import { CarFx } from './carkit/fx.js';
import { setLamps } from './carkit/lamps.js';
import { partsOf, fullDetail, silhouettes, wheelFit, glassFit, emitterFit, mirrorFit, maskedStats, LAYER } from './carkit/qa.js';

const Q = new URLSearchParams(location.search), KEY = Q.get('car') ?? 'av12', AUTO = Q.get('qa') === '1', HOLD = Q.get('qa') === 'trace';
const W = 1280, H = 720, A = '/assets/';
const hud = document.getElementById('hud'), say = (s) => { hud.textContent = s; console.info('[qa]', s); };

// ------------------------------------------------------------------------------------------------ stage
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.domElement.style.cssText = 'width:100%;height:100%;object-fit:contain';
renderer.toneMapping = THREE.NeutralToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 2000);
camera.position.set(5, 1.6, 5);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0.55, 0);
const composer = new EffectComposer(renderer);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.35, 0.45, 2.2);   // threshold per look (setLook)
composer.addPass(bloom); composer.addPass(new OutputPass());

// the pad: a dark asphalt-grey floor with a faint 1 m grid (scale reference), large enough for the drive
const floor = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'); g.fillStyle = '#2b2d31'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(600, 600); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, metalness: 0 }));
  m.receiveShadow = true; m.name = 'pad'; scene.add(m); return m;
})();
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 60 });
scene.add(sun, sun.target);
const fill = new THREE.HemisphereLight(0xdfe6ff, 0x30302c, 0.35); scene.add(fill);
const pmrem = new THREE.PMREMGenerator(renderer);
const studioEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const hdr = {};
async function hdri(file) { if (!hdr[file]) { const t = await new HDRLoader().loadAsync(A + 'hdri/' + file); if (/noon/.test(file)) { const d = t.image.data, cap = THREE.DataUtils.toHalfFloat(64); for (let i = 0; i < d.length; i++) if (d[i] > cap && d[i] < 0x8000) d[i] = cap; }   // the sun disc is clipped at 65504 in the file
    t.mapping = THREE.EquirectangularReflectionMapping; hdr[file] = t; } return hdr[file]; }
const LOOKS = {
  studio: { env: () => studioEnv, envI: 1, bg: new THREE.Color(0x16181c), sun: [0xffffff, 2.2, [-4, 7, 3]], exp: 1.0, lamps: 'running', fx: [1, 1, 1], bloom: 3.0 },
  dusk: { env: () => hdri('belfast_sunset_puresky_2k.hdr'), envI: 0.8, bg: 'env', bgI: 0.22, sun: [0xffb27a, 2.4, [-10, 4, -6]], exp: 0.55, lamps: 'running', fx: [0.95, 0.82, 0.72], bloom: 2.1 },
  day: { env: () => hdri('qwantani_noon_puresky_2k.hdr'), envI: 0.9, bg: 'env', bgI: 1.0, sun: [0xfff1de, 4.5, [-5, 10, -4]], exp: 1.5, lamps: 'running', fx: [1, 0.98, 0.94], bloom: 1.8 },
  night: { env: () => hdri('qwantani_night_puresky_2k.hdr'), envI: 0.25, bg: new THREE.Color(0x05070b), sun: [0x9fb4e8, 0.35, [5, 8, 4]], exp: 1.2, lamps: 'low', fx: [0.3, 0.3, 0.36], bloom: 1.4 },
};
let look = 'studio';
async function setLook(name) {
  const L = LOOKS[name]; look = name;
  const env = await L.env();
  scene.environment = env; scene.environmentIntensity = L.envI;
  scene.background = L.bg === 'env' ? env : L.bg; scene.backgroundIntensity = L.bgI ?? 1; bloom.threshold = L.bloom;
  sun.color.set(L.sun[0]); sun.intensity = L.sun[1]; sun.userData.off = new THREE.Vector3(...L.sun[2]);
  renderer.toneMappingExposure = L.exp; fill.intensity = name === 'night' ? 0.05 : 0.35;
  if (field) field.lightMode = L.lamps;
}

// ------------------------------------------------------------------------------------------------ the car
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer));
let field, car;
const drive = { x: 0, z: 0, psi: 0, beta: 0, v: 0, t: 0, phase: 0, pt: 0, brake: 0, events: [] };

function place() {
  const c = car;
  c.root.position.set(drive.x, 0, drive.z);
  c.root.rotation.y = drive.psi + drive.beta;          // the nose points along (cos θ, 0, -sin θ); car-lab's -X turned by car.rotation.y = π
  c.car.rotation.y = Math.PI;
  sun.position.copy(c.root.position).add(sun.userData.off ?? new THREE.Vector3(-4, 7, 3)); sun.target.position.copy(c.root.position);
}

// the test drive: each phase sets acceleration (m/s²), turn radius (m, + = left), slip angle, brake, nitro
const PHASES = [
  { name: 'idle', T: 1.6, a: 0, throttle: 0.05 },
  { name: 'launch', T: 3.6, a: 8.5, throttle: 1, spin: 0.5 },
  { name: 'lift', T: 0.5, a: -1.5, throttle: 0, pop: [0.02, 0.22] },
  { name: 'brake', T: 2.2, a: -10, brake: 1, throttle: 0 },
  { name: 'corner', T: 3.2, a: 0, R: 32, throttle: 0.45 },
  { name: 'drift', T: 3.4, a: 0, R: 22, beta: 0.45, throttle: 0.9, slip: 1 },
  { name: 'nitro', T: 2.0, a: 7, throttle: 1, nitro: true },
  { name: 'stop', T: 2.6, a: -7, brake: 0.7, throttle: 0 },
  { name: 'parked', T: 1.0, a: 0, throttle: 0.05 },
];

function step(dt) {
  const P = PHASES[drive.phase], c = car;
  drive.pt += dt; drive.t += dt;
  const vMin = P.name === 'corner' ? 16 : P.name === 'drift' ? 13 : 0;
  drive.v = Math.max(vMin && drive.v < vMin ? vMin : 0, drive.v + P.a * dt);
  if (P.name === 'brake') drive.v = Math.max(drive.v, 11);
  const r = P.R ? drive.v / P.R : 0;
  drive.psi += r * dt;
  drive.beta += ((P.beta ?? 0) - drive.beta) * (1 - Math.exp(-3 * dt));
  drive.x += Math.cos(drive.psi) * drive.v * dt; drive.z -= Math.sin(drive.psi) * drive.v * dt;
  c.speed = drive.v; c.brake = P.brake ?? 0; c.curvature = P.R ? 1 / P.R : 0;
  place();
  const steer = P.beta ? -drive.beta * 0.8 : P.R ? Math.atan(2.6 / P.R) : 0;
  for (const w of c.wheels) {
    if (w.axle === 'front') w.pivot.rotation.y += (steer - w.pivot.rotation.y) * (1 - Math.exp(-6 * dt));
    w.spin.rotation.z += ((drive.v + (P.spin && drive.pt < 1.2 ? 9 : 0)) / w.spec.radius) * dt;
  }
  const pop = P.pop?.some((t) => t > drive.pt - dt && t <= drive.pt);
  const slip = P.slip ? THREE.MathUtils.smoothstep(drive.beta, 0.1, 0.4) : P.spin && drive.pt < 1.2 ? P.spin * (1 - drive.pt / 1.2) : 0;
  field.dynamics(c, dt, P.a, drive.v * r, { throttle: P.throttle, pop, nitro: !!P.nitro, slip });
  if (drive.pt >= P.T) { drive.phase = (drive.phase + 1) % PHASES.length; drive.pt = 0; if (drive.phase === 0) Object.assign(drive, { x: 0, z: 0, psi: 0, beta: 0, v: 0 }); }
}

// ------------------------------------------------------------------------------------------------ cameras & frames
const UP = new THREE.Vector3(0, 1, 0);
function shoot(view, frame = true) {
  const c = car, p = c.root.position, th = c.root.rotation.y;
  const f = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th)), l = new THREE.Vector3(-Math.sin(th), 0, -Math.cos(th));
  const V = { rear34: [-6, 2.6, 1.5], rear: [-5.6, 0, 1.15], rearClose: [-3.4, 0.4, 0.95], side: [0, 6.8, 0.9], sideR: [0, -6.8, 0.9], front34: [5.2, 3.2, 1.25],
    close34: [2.9, 2.1, 0.62], top: [0.01, 0, 9], rear34low: [-4.6, -2.2, 0.55], frontLow: [4.6, -1.8, 0.55] }[view];
  camera.position.copy(p).addScaledVector(f, V[0]).addScaledVector(l, V[1]).addScaledVector(UP, V[2]);
  camera.fov = view === 'close34' ? 34 : 42; camera.updateProjectionMatrix();
  camera.lookAt(p.clone().add(new THREE.Vector3(0, view === 'top' ? 0 : 0.5, 0)));
  return frame ? frameNow() : null;
}
function frameNow() {
  field.update(0, camera, renderer, {}, [field.fx.smoke, field.fx.fire, field.fx.jet]);
  setLamps(car, field.lightMode, car.brake ?? 0);
  composer.render();
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  cv.getContext('2d').drawImage(renderer.domElement, 0, 0);
  return cv;
}

class Sheet {
  constructor() { this.tiles = []; }
  add(label, img) { this.tiles.push([label, img]); }
  async save(file, cols = 4, tw = 480) {
    if (!this.tiles.length) return;
    const th0 = this.tiles[0][1].height * tw / this.tiles[0][1].width, rows = Math.ceil(this.tiles.length / cols);
    const cv = document.createElement('canvas'); cv.width = cols * tw; cv.height = rows * th0;
    const g = cv.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
    this.tiles.forEach(([label, img], i) => {
      const x = (i % cols) * tw, y = Math.floor(i / cols) * th0, s = Math.min(tw / img.width, th0 / img.height);
      g.drawImage(img, x + (tw - img.width * s) / 2, y + (th0 - img.height * s) / 2, img.width * s, img.height * s);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, tw, 20); g.fillStyle = '#ffe36a'; g.font = '13px ui-monospace, monospace'; g.fillText(label, x + 6, y + 14);
    });
    await post(file, await new Promise((r) => cv.toBlob(r, 'image/png')));
  }
}
const post = (file, body) => fetch(`/__qa?car=${KEY}&file=${file}`, { method: 'POST', body });

/** a mask (1 per pixel, bottom-up rows) of `meshes` as seen from `camera`, at the frame size */
function maskNow(meshes) {
  const rt = new THREE.WebGLRenderTarget(W, H), saved = meshes.map((o) => [o, o.layers.mask]), keep = { bg: scene.background, ov: scene.overrideMaterial, cl: camera.layers.mask };
  meshes.forEach((o) => o.layers.set(LAYER)); scene.background = new THREE.Color(0); scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); camera.layers.set(LAYER);
  renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
  const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  saved.forEach(([o, l]) => { o.layers.mask = l; }); scene.background = keep.bg; scene.overrideMaterial.dispose(); scene.overrideMaterial = keep.ov; camera.layers.mask = keep.cl; rt.dispose();
  const m = new Uint8Array(W * H); for (let i = 0; i < m.length; i++) { const x = i % W, y = (i / W) | 0; m[(H - 1 - y) * W + x] = px[i * 4] > 127 ? 1 : 0; }
  return m;
}
const pixels = (cv) => cv.getContext('2d').getImageData(0, 0, W, H).data;

// ------------------------------------------------------------------------------------------------ the pipeline
const checks = [];
function check(id, title, status, value, expect, fix, detail) { checks.push({ id, title, status, value, expect, fix, detail }); }
const range = (v, lo, hi) => v >= lo && v <= hi;

async function pipeline() {
  const sheets = { look: new Sheet(), masks: new Sheet(), lamps: new Sheet(), drive: new Sheet(), ref: new Sheet() };
  const restore = fullDetail(car);

  say('silhouettes…');
  await setLook('studio'); place();
  const sil = silhouettes(renderer, scene, car, sheets.masks);
  // waivers: real-world openings proven by `npm run trace` (daylight under a wing, a splitter's slots, a channel seen
  // exactly end-on), listed in tuning.qa.waive with the reason; they are reported, never silently dropped
  const waive = car.tuning?.qa?.waive ?? [], waived = [];
  const open = sil.seeThrough.filter((h) => { const w = waive.find((w) => w.view === h.view && Math.hypot(w.at[0] - h.at[0], w.at[1] - h.at[1]) < 0.05); if (w) waived.push({ ...h, why: w.why }); return !w; });
  const big = open.filter((h) => h.cm2 >= 20), small = open.filter((h) => h.cm2 >= 5 && h.cm2 < 20);
  check('see-through', 'No see-through gaps (every part in place)', big.length ? 'fail' : small.length ? 'warn' : 'pass',
    `${big.length} gaps ≥ 20 cm², ${small.length} of 5-20 cm²${waived.length ? `, ${waived.length} waived (${[...new Set(waived.map((w) => w.why))].join('; ')})` : ''}`, 'none', 'automatic interior fills (carkit/interior.js: floor, keel, bays, bulkheads, arch liners, cabin); trace a gap that survives them (masks.png, then a magenta-background render) and add a fill or a tuning.glass scale', open.slice(0, 16));
  const cover = sil.openings ? sil.covered / sil.openings : 1;
  // advisory: the shell's openings also count vents and decks the interior fills; see-through is the verdict
  check('glass-cover', 'Glass fills the window openings (advisory)', cover >= 0.9 ? 'pass' : 'warn', `${(cover * 100).toFixed(0)}% of opening pixels covered`, '≥ 90%',
    'car-lab profile glass polygons (read-only) or tuning.glass { push, offset } here', sil.views);

  say('geometry…');
  const wf = wheelFit(car);
  const clip = wf.filter((w) => w.minClearance < -0.02), lip = wf.filter((w) => w.minClearance < -0.005), gap = wf.filter((w) => w.topGap > 0.12 || w.topGap < 0.012), poke = wf.filter((w) => w.poke !== null && (w.poke > 0.04 || w.poke < -0.1));
  check('wheels', 'Tyres sit in the arches: a visible gap, no clipping, flush with the body', clip.length ? 'fail' : lip.length || gap.length || poke.length ? 'warn' : 'pass',
    wf.map((w) => `${w.axle}: clear ${w.minClearance} top ${w.topGap} poke ${w.poke}`).join('; '), 'clearance ≥ 0 (lip overlap under 2 cm warns), top gap 1.2-12 cm, poke -10..+4 cm', 'tuning.suspension { ride } raises the body off the wheels (m); arch lips that dip into the tyre need a shell fix', wf);
  const gf = glassFit(car);
  check('glass-fit', 'Glass sits in the openings, not on top of the paint or under it', gf.floating > 0.15 ? 'fail' : gf.floating > 0.05 || gf.buried > 0.3 ? 'warn' : 'pass',
    `floating ${(gf.floating * 100).toFixed(0)}%, buried ${(gf.buried * 100).toFixed(0)}%, over openings ${(gf.overOpening * 100).toFixed(0)}%`, 'floating ≤ 5%, buried ≤ 30%', 'tuning.glass { push } (m, along the pane normal)', gf);
  const ef = emitterFit(car);
  const badE = ef.rows.filter((r) => r.onBody === null || !range(r.onBody, -0.04, 0.08) || r.blocked);
  check('exhaust', 'Exhaust and nitro points sit on the rear surface with a clear exit', !ef.rows.length && !car.electric ? 'fail' : badE.length ? 'warn' : ef.asymmetry > 0.03 ? 'warn' : 'pass',
    `${ef.rows.length} points, ${badE.length} off the body or blocked, asymmetry ${ef.asymmetry} m`, 'on the surface (−4..+8 cm), unblocked, mirror-symmetric', 'assets/cars/exhaust.json tips [y, z] (and up for top exits); ?debug=exhaust shows them', ef.rows);
  const mf = mirrorFit(car);
  check('mirrors', 'Side mirrors: real-style housings, both sides, symmetric, on short arms', car.profile.model ? (mf.present && mf.asymmetry <= 0.02 ? 'pass' : 'fail') : !car.tuning?.mirrors ? 'warn' : !mf.present || mf.asymmetry > 0.02 || mf.housingGap.some((g) => g === null || !range(g, 0.015, 0.32)) ? 'fail' : 'pass',
    `${car.profile.model ? "the model's own" : car.tuning?.mirrors ? car.tuning.mirrors.style : "car-lab's generic set"}, asymmetry ${mf.asymmetry} m, housing gap ${mf.housingGap.join(' / ')} m`, 'tuned style, asymmetry ≤ 2 cm, gap 1.5-32 cm', 'tuning.mirrors { style: blade|gt|bullet, scale, offset, housing }', mf);

  say('lamps…');
  const lampRows = [];
  for (const lk of ['dusk', 'night']) {
    await setLook(lk); place(); shoot('rear');
    const mask = maskNow(partsOf(car).tail);
    for (const b of [0, 1]) {
      car.brake = b; const cv = frameNow(); const s = maskedStats(pixels(cv), mask, W, H);
      lampRows.push({ look: lk, brake: b, area: +(car.lampArea ?? 0).toFixed(4), ...s }); sheets.lamps.add(`${lk} brake ${b}: lum ${s.lum} r/g ${s.redOverGreen}`, cv);
    }
    car.brake = 0;
  }
  const off = lampRows.filter((r) => r.brake === 0), on = lampRows.filter((r) => r.brake === 1);
  const lampOk = off.every((r) => r.lum < 125 && r.redOverGreen > 1.8) && on.every((r, i) => r.lum >= Math.max(90, off[i].lum + 40));
  check('lamps', 'Tail lamps: red but unlit off the brake, bright and blooming on it', lampOk ? 'pass' : 'fail',
    `area ${(lampRows[0].area * 1e4).toFixed(0)} cm2; ` + lampRows.map((r) => `${r.look} b${r.brake}: ${r.lum}`).join(', '), 'off: lum < 125, red; on: ≥ 90 and ≥ off + 40 (saturated red has low luminance; glossy lenses mirror the sky when off)', 'carkit/lamps.js (levels are shared; area-normalised); tuning.lamps only for a real exception', lampRows);

  say('look…');
  await setLook('studio'); place();
  for (const v of ['front34', 'side', 'rear34', 'rear', 'frontLow', 'rear34low', 'top', 'close34']) sheets.look.add(`studio ${v}`, shoot(v));
  for (const lk of ['dusk', 'night']) { await setLook(lk); place(); sheets.look.add(`${lk} close34`, shoot('close34')); sheets.look.add(`${lk} rear34`, shoot('rear34')); }
  await setLook('dusk'); place();
  const closeUp = shoot('close34');
  sheets.ref.add(`${KEY} (ours, dusk)`, closeUp);
  for (const f of ['garage_zoom.png', 'garage_strix.png', 'drive_0.png']) {
    // fetch + createImageBitmap: Image.decode() never settles in a hidden page
    try { const r = await fetch(`/qa/reference/${f}`); if (r.ok) sheets.ref.add(`Endurance ${f}`, await createImageBitmap(await r.blob())); } catch { /* reference not present */ }
  }
  check('premium', 'Premium look against the reference (judged by eye: look.png, reference.png)', 'review', '-', 'as good as the Endurance garage frames',
    'finishes.json (paint), tuning.mirrors, lamps; geometry limits need a better source model', null);

  say('test drive…');
  await setLook('studio');                // even light: the dive, roll and wings read in every frame (look.png has dusk and night)
  Object.assign(drive, { x: 0, z: 0, psi: 0, beta: 0, v: 0, t: 0, phase: 0, pt: 0 });
  const SHOTS = [['idle', 1.2, 'rear34low'], ['launch', 0.7, 'rear34low'], ['lift', 0.06, 'rearClose'], ['brake', 0.5, 'side'], ['brake', 0.55, 'rear'],
    ['corner', 2.4, 'front34'], ['drift', 2.6, 'rear34'], ['drift', 3.2, 'side'], ['nitro', 0.8, 'rearClose'], ['stop', 2.5, 'rear']];
  const metric = { pitch: 0, roll: 0, aero: 0, smokeIdle: 0, fireLift: 0, fireNitro: 0, smokeDrift: 0, clearBrake: Infinity };
  const dt = 1 / 60;
  for (let guard = 0; guard < 60 * 40; guard++) {
    const before = drive.phase;
    step(dt); field.fx.update(dt, new THREE.Color(...LOOKS.studio.fx));
    const P = PHASES[drive.phase].name, ch = car.chassis;
    if (P === 'brake') { metric.pitch = Math.max(metric.pitch, ch.pitchDeg); metric.aero = Math.max(metric.aero, ...(car.aero?.state.map((s) => s.deployed) ?? [0])); }
    if (P === 'corner') metric.roll = Math.max(metric.roll, Math.abs(ch.rollDeg));
    const n = field.fx.counts;
    if (P === 'idle') metric.smokeIdle = Math.max(metric.smokeIdle, n.smoke);
    if (P === 'lift') metric.fireLift = Math.max(metric.fireLift, n.fire);
    if (P === 'nitro') metric.fireNitro = Math.max(metric.fireNitro, n.fire);
    if (P === 'drift') metric.smokeDrift = Math.max(metric.smokeDrift, n.smoke);
    for (const [ph, t, view] of SHOTS) if (ph === P && t > drive.pt - dt && t <= drive.pt) {
      if (ph === 'brake' && view === 'side') metric.clearBrake = Math.min(...wheelFit(car).map((w) => w.minClearance));
      sheets.drive.add(`${ph} ${view} ${(drive.v * 3.6).toFixed(0)} km/h`, shoot(view));
    }
    if (before === PHASES.length - 1 && drive.phase === 0) break;
  }
  check('pitch', 'Body dips under braking (1 g)', range(metric.pitch, 0.8, 3.2) ? 'pass' : 'warn', `${metric.pitch.toFixed(2)}°`, '0.8-3.2°', 'tuning.suspension { pitch, freq, damping }');
  check('roll', 'Body rolls in a corner', range(metric.roll, 0.6, 3.5) ? 'pass' : 'warn', `${metric.roll.toFixed(2)}°`, '0.6-3.5°', 'tuning.suspension { roll }');
  check('travel', 'Tyres stay clear of the arches with the nose down', metric.clearBrake >= -0.005 ? 'pass' : metric.clearBrake >= -0.02 ? 'warn' : 'fail', `${metric.clearBrake.toFixed(3)} m`, '≥ 0', 'tuning.suspension { pitch } lower, or { ride } higher');
  if (car.tuning?.aero?.length) check('aero', 'Active aero deploys under braking', metric.aero >= 0.8 ? 'pass' : 'fail', `${metric.aero.toFixed(2)}`, '≥ 0.8', 'tuning.aero { min, max, hinge, deg, vOn }', car.aero?.state);
  else check('aero', 'Active aero (none set for this car)', 'info', '-', 'only for cars that have it', 'tuning.aero');
  check('fx', 'Exhaust smoke, pops, nitro flames and drift smoke all show', (car.electric || (metric.smokeIdle > 0 && metric.fireLift > 0)) && metric.fireNitro > 0 && metric.smokeDrift > 20 ? 'pass' : 'fail',
    `idle smoke ${metric.smokeIdle}, pop fire ${metric.fireLift}, nitro fire ${metric.fireNitro}, drift smoke ${metric.smokeDrift}`, 'all > 0 (drift > 20)', 'exhaust.json points; carkit/fx.js rates');
  restore();

  say('saving…');
  await sheets.look.save('look.png', 4); await sheets.masks.save('masks.png', 4, 384); await sheets.lamps.save('lamps.png', 2, 640);
  await sheets.drive.save('drive.png', 4); await sheets.ref.save('reference.png', 2, 800);
  const report = { car: KEY, date: new Date().toISOString(), tuning: car.tuning ?? null, summary: Object.fromEntries(['pass', 'warn', 'fail', 'review', 'info'].map((s) => [s, checks.filter((c) => c.status === s).length])), checks, metric };
  await post('report.json', JSON.stringify(report, null, 2));
  await post('report.md', markdown(report));
  return report;
}

function markdown(r) {
  const icon = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', review: 'REVIEW', info: 'INFO' };
  return `# Car QA: ${r.car}\n\n${r.date}\n\n${Object.entries(r.summary).map(([k, v]) => `${v} ${k}`).join(', ')}\n\n| | Check | Measured | Expected | Fix |\n|---|---|---|---|---|\n` +
    r.checks.map((c) => `| ${icon[c.status]} | ${c.title} | ${c.value} | ${c.expect} | ${c.fix} |`).join('\n') +
    `\n\nSheets: look.png, reference.png, masks.png, lamps.png, drive.png (this folder).\n`;
}

/**
 * Trace a see-through gap from report.json (view name and `at`): saves qa/<car>/trace-<view>.png, the real car on
 * magenta looking down the same line, and returns the line's path through the car in body metres (nose -x, left +z).
 */
async function trace(view, at, file = `trace-${view}.png`) {
  const VIEWS = { left: [0, 0, 1], right: [0, 0, -1], front: [-1, 0, 0], rear: [1, 0, 0], top: [0, 1, 0], 'front-left': [-0.75, 0.45, 0.75], 'rear-left': [0.75, 0.45, 0.75],
    'front-right': [-0.75, 0.45, -0.75], 'rear-right': [0.75, 0.45, -0.75], 'low-left': [-0.2, 0.12, 1], 'low-right': [0.2, 0.12, -1] };
  const restore = fullDetail(car);
  const box = new THREE.Box3().setFromObject(car.car), ctr = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() * 0.55;
  const q = car.car.getWorldQuaternion(new THREE.Quaternion()), dir = new THREE.Vector3(...VIEWS[view]).normalize().applyQuaternion(q);
  const ortho = new THREE.OrthographicCamera(-r, r, r, -r, 0.01, 50);
  ortho.position.copy(ctr).addScaledVector(dir, 20); ortho.up.set(0, 1, 0); if (Math.abs(dir.y) > 0.9) ortho.up.set(1, 0, 0).applyQuaternion(q);
  ortho.lookAt(ctr); ortho.updateMatrixWorld(); ortho.updateProjectionMatrix();
  const o = new THREE.Vector3(at[0] * 2 - 1, at[1] * 2 - 1, -1).unproject(ortho), d = dir.clone().negate();
  const inv = new THREE.Matrix4().copy(car.car.matrixWorld).invert(), path = [];
  for (let t = 15; t < 26; t += 0.15) { const p = o.clone().addScaledVector(d, t).applyMatrix4(inv); if (Math.abs(p.x) < 2.6 && Math.abs(p.z) < 1.2 && p.y > -0.2 && p.y < 1.5) path.push(p.toArray().map((v) => +v.toFixed(2))); }
  // a narrow perspective camera down the same line, on magenta, floor hidden
  const keep = { bg: scene.background, fov: camera.fov }, pad = scene.getObjectByName('pad'); pad.visible = false; scene.background = new THREE.Color(0xff00ff);
  const target = o.clone().addScaledVector(d, 20);
  camera.position.copy(target).addScaledVector(dir, 12); camera.fov = 9; camera.updateProjectionMatrix(); camera.lookAt(target);
  renderer.render(scene, camera);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(renderer.domElement, 0, 0);
  scene.background = keep.bg; camera.fov = keep.fov; camera.updateProjectionMatrix(); pad.visible = true; restore();
  await post(file, await new Promise((res) => cv.toBlob(res, 'image/png')));
  return { entry: path[0], exit: path.at(-1), path: path.filter((_, i) => i % 4 === 0) };
}

// ------------------------------------------------------------------------------------------------ boot
(async () => {
  try {
    await setLook('studio');
    say(`assembling ${KEY}…`);
    field = new Field(scene); field.fx = new CarFx(scene);
    car = await assemble(loader, KEY, 0, true);
    scene.add(car.root); field.all = [car]; field.hero = car; field.lightMode = 'running'; field.initCapture();
    place();
    window.sandbox = { car, field, scene, camera, renderer, setLook, shoot, step, drive, THREE, trace };
    if (AUTO) {
      window.__qa = { done: false };
      const report = await pipeline();
      window.__qa = { done: true, report };
      say(`done: ${JSON.stringify(report.summary)}`);
      return;
    }
    if (HOLD) { say(`${KEY}: parked for tracing (npm run trace)`); return; }
    say(`${KEY}: orbit with the mouse; the test drive loops`);
    let last = performance.now();
    renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      step(dt); field.fx.update(dt, new THREE.Color(...LOOKS[look].fx));
      controls.target.copy(car.root.position).add(new THREE.Vector3(0, 0.55, 0)); controls.update();
      field.update(0, camera, renderer, {}, [field.fx.smoke, field.fx.fire, field.fx.jet]);
      composer.render();
      hud.textContent = `${KEY}  ${PHASES[drive.phase].name}  ${(drive.v * 3.6).toFixed(0)} km/h\npitch ${car.chassis.pitchDeg.toFixed(2)}°  roll ${car.chassis.rollDeg.toFixed(2)}°  ${JSON.stringify(field.fx.counts)}`;
    });
  } catch (e) {
    say(`error: ${e.message}`); console.error(e);
    window.__qa = { done: true, error: String(e.stack ?? e) };
  }
})();
