// Side mirrors that look like real ones (they replace car-lab's generic set, which made every car's mirrors alike).
// Positions come from the car-lab profile's fitted mounts (profile.mirrors: surfaceMounts / mounts, stalkEnd, centre);
// the shape comes from the car's tuning (assets/cars/tuning/<key>.json → mirrors):
//   blade:  hypercar mirror: a slim wing-section housing on one swept arm from the door (Revuelto, P1, Valkyrie, 488)
//   gt:     a fuller rounded housing on a short sail at the A-pillar foot, an amber indicator strip on its outer edge
//           (Continental, 911, i8)
//   bullet: a chrome bullet on a short stem, 1950s style (XKSS)
// The glass is tinted, slightly rough glass with a reflection of the sky, not a live mirror (which would cost a
// render pass per mirror and read as a hole at speed).
import * as THREE from 'three';

const STYLES = {
  blade:  { size: [0.115, 0.075, 0.21], round: 3.2, nose: 1.7, arm: 0.016, rise: 0.0, sail: false, paint: true },
  gt:     { size: [0.125, 0.105, 0.235], round: 2.6, nose: 1.35, arm: 0.03, rise: 0.02, sail: true, paint: true },
  bullet: { size: [0.13, 0.075, 0.08], round: 2.0, nose: 1.9, arm: 0.014, rise: 0.0, sail: false, paint: false },
};

/** A superellipsoid: a sphere pushed toward a rounded box (round 2 = sphere, higher = boxier), nose stretched forward. */
function housingGeometry([sx, sy, sz], round, nose) {
  const g = new THREE.SphereGeometry(1, 40, 24), p = g.attributes.position, v = new THREE.Vector3(), e = 2 / round;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.set(Math.sign(v.x) * Math.abs(v.x) ** e, Math.sign(v.y) * Math.abs(v.y) ** e, Math.sign(v.z) * Math.abs(v.z) ** e);
    if (v.x < 0) v.x *= nose;                          // the front (car-lab noses point -X) tapers into a teardrop
    p.setXYZ(i, v.x * sx * 0.5, v.y * sy * 0.5, v.z * sz * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

/** A rounded-rectangle glass plate facing +X (backward), slightly inset into the housing's rear face. */
function glassGeometry(w, h, r) {
  const s = new THREE.Shape(), x = w / 2, y = h / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  return new THREE.ShapeGeometry(s, 8).rotateY(Math.PI / 2);   // shape's +X becomes the car's -Z: width runs across the car
}

let shared = null;
function materials() {
  shared ??= {
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0d1318, metalness: 0.6, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.55 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 1, roughness: 0.08 }),
    indicator: new THREE.MeshStandardMaterial({ color: 0x5a3a08, emissive: 0xffa21a, emissiveIntensity: 0.05, roughness: 0.3 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x0c0d0f, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }),
  };
  return shared;
}

/**
 * profile: car-lab profile; m: car-lab materials (mirrorPaint = body colour, trim = black plastic);
 * spec: tuning.mirrors { style, scale?, housing: 'paint'|'accent'|'carbon', offset?: [x,y,z] }.
 * Returns a group in the car's shell frame (same frame as car-lab's createMirrors).
 */
export function buildMirrors(profile, m, spec = {}) {
  const st = STYLES[spec.style] ?? STYLES.gt, mats = materials(), k = spec.scale ?? 1, off = spec.offset ?? [0, 0, 0];
  const root = new THREE.Group(); root.name = 'mirrors'; root.position.y = profile.body.lift;
  // housing: 'paint' = the car's body colour under its clearcoat, 'accent' = the team's second colour, 'carbon' = gloss black
  const housingMat = !st.paint ? mats.chrome : spec.housing === 'carbon' ? mats.carbon : spec.housing === 'accent' ? m.mirrorPaint
    : Object.assign(new THREE.MeshPhysicalMaterial({ color: m.body.color, metalness: m.body.metalness, roughness: m.body.roughness, clearcoat: 1, clearcoatRoughness: 0.04 }), { userData: { bodyPaint: true } });
  const M = profile.mirrors;
  for (const sign of [1, -1]) {
    const f = (p) => new THREE.Vector3(p[0] + off[0], p[1] + off[1], p[2] * sign + off[2] * sign);
    // the fitted mounts can differ a little side to side (an asymmetric shell): use their average, mirrored
    const mp = (k) => M.surfaceMounts?.[k] ?? M.mounts?.[k] ?? M.mount;
    const a1 = mp('1'), a2 = mp('-1'), avg = [(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2, (Math.abs(a1[2]) + Math.abs(a2[2])) / 2];
    const mount = new THREE.Vector3(avg[0] + off[0], avg[1] + off[1], sign * (avg[2] + off[2]));
    const centre = f(M.center), size = st.size.map((s) => s * k);
    centre.y += st.rise * k;
    // our housings are bigger than car-lab's: keep the inner edge ≥ 5 cm clear of the door and the side glass
    // the side glass leans in as it rises: its |z| at the housing's height, along the window's front edge
    const sg = profile.glass?.side, e0 = sg?.[0], e1 = sg?.[1];
    const glassZ = !e0 || !e1 ? 0 : Math.abs(e0[2]) + (Math.abs(e1[2]) - Math.abs(e0[2])) * THREE.MathUtils.clamp((centre.y - e0[1]) / (e1[1] - e0[1] || 1), 0, 1);
    centre.z = sign * Math.max(Math.abs(centre.z), Math.max(Math.abs(mount.z), glassZ) + 0.05 + size[2] / 2);
    // housing: its inner edge sits a few cm off the door, the glass faces back
    const housing = new THREE.Mesh(housingGeometry(size, st.round, st.nose), housingMat);
    housing.position.copy(centre); housing.name = `mirror-housing-${sign}`;
    housing.rotation.y = sign * 0.06;                                   // toed in a little, like the real thing
    root.add(housing);
    const glass = new THREE.Mesh(glassGeometry(size[2] * 0.86, size[1] * 0.78, size[1] * 0.25), mats.glass);
    glass.position.set(size[0] * 0.5 - 0.004, 0, 0); glass.name = `mirror-glass-${sign}`;
    housing.add(glass);
    if (spec.style === 'gt') {                                          // indicator strip along the outer leading edge
      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.012, size[1] * 0.18, size[2] * 0.42), mats.indicator);
      ind.position.set(-size[0] * 0.38, -size[1] * 0.12, sign * size[2] * 0.26); housing.add(ind);
    }
    // arm: a swept tube from the door mount up and out to the housing's inner edge
    const inner = centre.clone().add(new THREE.Vector3(0.0, -size[1] * 0.15, -sign * size[2] * 0.36));
    const mid = mount.clone().lerp(inner, 0.5).add(new THREE.Vector3(-0.02, 0.035 * k, 0));
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([mount, mid, inner]), 12, st.arm * k, 8), st.paint ? m.trim : mats.chrome);
    arm.name = `mirror-arm-${sign}`; root.add(arm);
    if (st.sail) {                                                      // a sail foot blending the arm into the door
      const foot = new THREE.Mesh(housingGeometry([0.11 * k, 0.05 * k, 0.05 * k], 2.4, 1.6), m.trim);
      foot.position.copy(mount); foot.name = `mirror-sail-${sign}`; root.add(foot);
    }
  }
  return root;
}

export const MIRROR_STYLES = Object.keys(STYLES);
/** the mirror glass material (one per app): the QA locates each housing by its glass */
export const mirrorGlassMaterial = () => materials().glass;
