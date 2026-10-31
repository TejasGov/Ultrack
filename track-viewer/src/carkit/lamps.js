// Lamp model for the venue (car-lab sets studio levels on every lamps.update; these replace them after it).
// Off the brake a tail lamp is a deep red lens with a low glow (running light): clearly red, never blooming. On the
// brake the LED overdrives: brighter, a hotter core (a little warmer red) and a tight bloom halo. The levels are
// the same for every car except for one physical correction: an emitter's glow scales with its area, so a thin LED
// bar runs brighter per pixel than a wide lens (area^-0.5, clamped), and nothing exceeds BRAKE_MAX, so no halo
// smears. Cars may still override tail/tailNight/brake/stop in tuning.lamps, but none needs to.
// Tone mapping desaturates anything above ~1 toward white, so the lens stays low enough to stay saturated red and the
// halo is a soft additive red sprite per lamp cluster (LDR, so it stays red) instead of bloom from a huge emissive.
// Ramp: about 70 ms to reach 90% on, 150 ms to 90% off (LED / filament), proportional to brake pressure.
// Cars with a tail spec (src/carkit/tails/<key>.js) take taillights.js's realistic lamp instead (docs/tail-lights.md); the rest
// stay as above.
import * as THREE from 'three';
import { fitTail, driveTail } from './taillights.js';
// one file per car, so each car's spec is edited alone; the file name is the car's key
export const TAIL_SPECS = Object.fromEntries(Object.entries(import.meta.glob('./tails/*.js', { eager: true, import: 'default' }))
  .map(([p, v]) => [p.split('/').pop().slice(0, -3), v]));
// ?tails=off puts every car on the generic lamp: the A/B for a spec car's before/after stills and its fps check
const SPECS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('tails') === 'off' ? {} : TAIL_SPECS;

export const LAMP_DEFAULTS = { tail: 0.12, tailNight: 0.3, brake: 3.8, stop: 4.2, head: 0.35, beam: 0.22, reverse: 2 };
const AREA_REF = 0.05, BRAKE_MAX = 4.6;            // m2 of lit lens/LED that takes the default levels; hard ceiling (emissive)
const TAU_ON = 0.03, TAU_OFF = 0.065;            // s; 2.3 tau = 90%
const COOL = new THREE.Color(1, 0.03, 0.09), HOT = new THREE.Color(1, 0.04, 0.05);   // warm toward orange-red, never white

/** Lit area (m2) of a car's tail emitters at full detail: triangle area of every mesh wearing a tail or stop material. */
export function emitterArea(c) {
  const skip = new Set(); c.lod?.levels.slice(1).forEach((l) => l.object.traverse((o) => skip.add(o)));
  c.root.updateWorldMatrix(true, true);
  let a = 0; const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  c.root.traverse((o) => {
    if (!o.isMesh || skip.has(o) || ![c.materials.taillight, c.materials.brakeLight].includes(o.material)) return;
    const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
    for (let i = 0; i + 2 < n; i += 3) {
      for (let k = 0; k < 3; k++) p[k].fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld);
      a += e1.subVectors(p[1], p[0]).cross(e2.subVectors(p[2], p[0])).length() / 2;
    }
  });
  return a / 2;                                   // both faces of a closed or double-sided shape count once
}

let haloTex;
function halo() {
  if (haloTex) return haloTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, a] of [[0, 1], [0.12, 0.55], [0.35, 0.16], [0.7, 0.03], [1, 0]]) r.addColorStop(o, `rgba(255,${Math.round(40 * (1 - o))},30,${a})`);
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (haloTex = new THREE.CanvasTexture(cv));
}

/** One additive halo sprite per cluster (left, right, centre) of the car's tail emitters, sized by the cluster. */
function addHalos(c) {
  const skip = new Set(); c.lod?.levels.slice(1).forEach((l) => l.object.traverse((o) => skip.add(o)));
  c.root.updateWorldMatrix(true, true);
  const boxes = { l: new THREE.Box3(), r: new THREE.Box3(), c: new THREE.Box3() }, v = new THREE.Vector3();
  c.car.updateWorldMatrix(true, false);
  const inv = c.car.matrixWorld.clone().invert();
  c.root.traverse((o) => {   // per vertex: car-lab merges a material's lamps into one mesh spanning both sides
    if (!o.isMesh || skip.has(o) || ![c.materials.taillight, c.materials.brakeLight].includes(o.material)) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      boxes[Math.abs(v.z) < 0.15 ? 'c' : v.z < 0 ? 'l' : 'r'].expandByPoint(v);
    }
  });
  c.halos = [];
  for (const bx of Object.values(boxes)) {
    if (bx.isEmpty()) continue;
    const size = bx.getSize(new THREE.Vector3()), ctr = bx.getCenter(new THREE.Vector3());
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color: 0xff2a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: true }));
    sp.position.copy(ctr); sp.position.x += 0.08 * Math.sign(ctr.x || 1); sp.scale.setScalar(THREE.MathUtils.clamp(Math.max(size.y, size.z) * 1.6, 0.18, 0.7));
    sp.name = 'lamp_halo'; sp.raycast = () => {}; sp.renderOrder = 5; c.car.add(sp); c.halos.push(sp);
  }
}

/** At assembly (cars.js): a spec car's lamps are built now, so the race's shader warm-up sees their programs. */
export function fitLamps(c) {
  if (typeof document !== 'undefined' && SPECS[c.key]) c.tail = fitTail(c, SPECS[c.key]);
  return c;
}

/** c: an assembled car; mode: 'running' (dusk) | 'low' | 'high'; brake 0..1; t: clock in s (omit for no ramp); look: main.js's look (dn, exposure) */
export function setLamps(c, mode, brake, t, look) {
  const L = { ...LAMP_DEFAULTS, ...(c.tuning?.lamps ?? {}) }, m = c.materials, night = mode === 'low' || mode === 'high';
  const spec = typeof document !== 'undefined' && c.lod && c.shadow ? SPECS[c.key] : null;   // realistic lamps (taillights.js), opt-in per car
  c.lamps.update({ mode, brake, reverse: !!c.reverse });
  if (!spec && !c.halos && typeof document !== 'undefined' && c.car?.isObject3D) addHalos(c);
  c.lampArea ??= spec ? 1 : Math.max(emitterArea(c), 1e-3);
  const k = THREE.MathUtils.clamp(Math.sqrt(AREA_REF / c.lampArea), 1, 1.8);
  // pedal -> lamp: lit as soon as the pedal is down, brighter with pressure. A spec car's lamp is a switch, as a real one:
  // full on past a little pedal travel, off once released (hysteresis, so a pedal hovering at the switch point never blinks)
  const want = spec ? +(c.brakeOn = brake > (c.brakeOn ? 0.02 : 0.06)) : THREE.MathUtils.smoothstep(brake, 0, 0.12) * (0.6 + 0.4 * brake);
  const dt = t === undefined || c.lampT === undefined ? 1 : Math.min(0.1, Math.max(0, t - c.lampT));
  c.lampT = t;
  const ramp = (level, to) => (t === undefined || level === undefined ? to : level + (to - level) * (1 - Math.exp(-dt / (to > level ? TAU_ON : TAU_OFF))));
  c.lampLevel = ramp(c.lampLevel, want);
  const b = c.lampLevel;
  if (spec) {
    c.revLevel = ramp(c.revLevel, c.reverse ? 1 : 0);
    c.tail ??= fitTail(c, spec);
    driveTail(c, b, c.revLevel, look);
    m.headlight.emissiveIntensity *= L.head; m.projector.emissiveIntensity *= L.beam; m.highProjector.emissiveIntensity *= L.beam;
    return;
  }
  m.taillight.emissiveIntensity = (night ? L.tailNight : L.tail) + Math.min(BRAKE_MAX, b * L.brake * k);
  m.brakeLight.emissiveIntensity = Math.min(BRAKE_MAX, b * L.stop * k);
  const glow = (night ? 0.07 : 0.03) + 0.85 * b;
  c.halos?.forEach((h) => { h.material.opacity = glow; h.visible = glow > 0.01 && c.root.visible; });
  for (const x of [m.taillight, m.brakeLight]) x.emissive?.copy(COOL).lerp(HOT, b);   // test mocks carry no emissive colour
  m.headlight.emissiveIntensity *= L.head;
  m.projector.emissiveIntensity *= L.beam;
  m.highProjector.emissiveIntensity *= L.beam;
  m.reverseLight.emissiveIntensity *= L.reverse / 6;
}
