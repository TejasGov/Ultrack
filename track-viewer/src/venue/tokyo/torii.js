// The signature set piece: a Fushimi-Inari-style corridor of vermilion torii gates over the road, one InstancedMesh (a single draw call,
// ~970 triangles a gate) plus one for the paper lanterns. The gates stand on the gentle left-hand sweep between turns 7 and 8
// (centerline index 1176-1232, 24 gates over ~160 m; the road is flat and level there, the barriers are 11.9 m from the centerline and their sponsor boards
// end at ~16.5 m): each pillar stands 19.5 m out, a full 2.3 m beyond everything that borders the road, and the lowest beam is 11.4 m over it.
// The corridor begins after turn 7's apex and ends ~100 m before turn 8's, so it never hides a corner.
// Gates are spaced 7 m (a pillar passes every 90 ms at 80 m/s, a rhythm and not a strobe: they are soft dark verticals at the edge of the frame).
// scripts/check-tokyo-setpieces.mjs re-checks the placement against the collision walls and the track width.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const CORRIDOR = {
  from: 1176, to: 1232,        // centerline index range (track.json), inclusive
  spacing: 7,                  // m between gates (the brief: 5-8)
  half: 19.5,                  // m, pillar centre to the centerline
  pillarR: 0.62,               // m at the foot (0.5 at the top)
  nukiBottom: 11.4,            // m over the road: the lowest beam
  top: 17.0,                   // m over the road: the top of the kasagi (its ends curve up another 0.9)
};

/** Gate poses along the corridor: [{ x, y, z, yaw }] (y = road height, yaw turns the gate's local +Z onto the direction of travel). Pure: no THREE. */
export function gatePoses(centerline, c = CORRIDOR) {
  const C = centerline, n = C.length, cum = [0];
  for (let i = 1; i <= n; i++) { const a = C[i - 1], b = C[i % n]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
  const at = (s) => {           // point at arc length s (linear along the polyline)
    let i = 0; while (i < n - 1 && cum[i + 1] < s) i++;
    const f = (s - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]), a = C[i], b = C[(i + 1) % n];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  const s0 = cum[c.from], s1 = cum[c.to], count = Math.floor((s1 - s0) / c.spacing), pad = (s1 - s0 - (count - 1) * c.spacing) / 2, poses = [];
  for (let k = 0; k < count; k++) {
    const s = s0 + pad + k * c.spacing, p = at(s), a = at(s - 4), b = at(s + 4);
    poses.push({ x: p[0], y: p[1], z: p[2], yaw: Math.atan2(b[0] - a[0], b[2] - a[2]) });
  }
  return poses;
}

const VERMILION = new THREE.Color('#e63f1d'), BLACK = new THREE.Color('#15100e'), WARM = new THREE.Color('#ffd59a');

function paint(g, color) {                       // non-indexed, no uvs, one colour: the merge needs identical attributes
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv');
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const box = (w, h, d, x, y, z, color) => paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);

/** a beam along X whose ends curve up: polygon profile in (z, y), swept over nx segments; flat-shaded strips */
function loft(profile, x0, x1, nx, lift, color, y0 = 0) {
  const pos = [], xs = Array.from({ length: nx + 1 }, (_, i) => x0 + (x1 - x0) * i / nx);
  const dy = (x) => lift * Math.pow(Math.abs(x) / Math.max(Math.abs(x0), Math.abs(x1)), 2.6);
  for (let i = 0; i < nx; i++) {
    const xa = xs[i], xb = xs[i + 1], ya = dy(xa) + y0, yb = dy(xb) + y0;
    for (let k = 0; k < profile.length; k++) {
      const [za, ha] = profile[k], [zb, hb] = profile[(k + 1) % profile.length];
      pos.push(xa, ya + ha, za, xb, yb + ha, za, xb, yb + hb, zb, xa, ya + ha, za, xb, yb + hb, zb, xa, ya + hb, zb);
    }
  }
  for (const x of [x0, x1]) {                    // end caps (convex profiles: a fan)
    const y = dy(x) + y0;
    for (let k = 1; k < profile.length - 1; k++) pos.push(x, y + profile[0][1], profile[0][0], x, y + profile[k][1], profile[k][0], x, y + profile[k + 1][1], profile[k + 1][0]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return paint(g, color);
}

function gateGeometry({ half: S, pillarR: R, nukiBottom, top } = CORRIDOR) {
  const plunge = 2.6, pillarTop = 16.3, parts = [];
  for (const sx of [-1, 1]) {
    const pil = new THREE.CylinderGeometry(R * 0.8, R, pillarTop + plunge, 14, 1).translate(sx * S, (pillarTop - plunge) / 2, 0);
    parts.push(paint(pil, VERMILION));
    parts.push(paint(new THREE.CylinderGeometry(R * 1.1, R * 1.14, 1.6 + plunge, 14, 1).translate(sx * S, (1.6 - plunge) / 2, 0), BLACK));       // the black foot
    parts.push(paint(new THREE.CylinderGeometry(R * 0.86, R * 0.86, 0.18, 14, 1).translate(sx * S, 15.3, 0), BLACK));                           // black band under the shimaki
    parts.push(box(0.8, 0.28, 0.5, sx * (S - 0.95), 0.0, 0, WARM));                                                                              // the uplight fixture
    for (const sz of [-1, 1]) parts.push(box(0.28, 0.95, 0.22, sx * (S - R - 0.14), nukiBottom - 0.55, sz * 0.46, BLACK), box(0.28, 0.95, 0.22, sx * (S + R + 0.14), nukiBottom - 0.55, sz * 0.46, BLACK));   // kusabi wedges at the nuki
  }
  parts.push(box(2 * S + 2.2, 0.5, 0.5, 0, nukiBottom + 0.25, 0, VERMILION));                                                                     // nuki: the tie beam
  parts.push(box(2 * S + 2.9, 0.62, 1.1, 0, 15.74, 0, VERMILION));                                                                               // shimaki
  const L = S + 2.5;
  parts.push(loft([[-0.72, 0], [0.72, 0], [0.8, 0.55], [-0.8, 0.55]], -L, L, 30, 0.9, VERMILION, 16.05));                                        // kasagi, vermilion lower beam
  parts.push(loft([[-0.8, 0], [0.8, 0], [0.74, 0.4], [-0.74, 0.4]], -L, L, 30, 0.9, BLACK, 16.6));                                                // and its black cap
  return mergeGeometries(parts);
}

function lanternGeometry() {
  const pts = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; pts.push(new THREE.Vector2(0.15 + 0.27 * Math.sin(a), -0.4 + 0.8 * (i / 10))); }
  const body = paint(new THREE.LatheGeometry(pts, 14), new THREE.Color('#e5321a'));
  const cap = (y) => paint(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 14).translate(0, y, 0), BLACK);
  return mergeGeometries([body, cap(0.42), cap(-0.42)]);
}

export async function create(ctx) {
  const C = CORRIDOR, poses = gatePoses(ctx.track.centerline, C);
  if (!poses.length) return null;
  const gGeo = gateGeometry(), lGeo = lanternGeometry();
  const warm = { value: 0 };     // night uplight, 0..1

  // satin vermilion; at night the pillars glow warm from their uplights (strongest at the foot, fading over ~8 m) and the beams keep a faint floor
  const gMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.04, side: THREE.DoubleSide });
  gMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWarm = warm;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH; uniform float uWarm;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.62, 0.38) * uWarm * (2.1 * exp(-max(vH, 0.0) * 0.34) + 0.09);');
  };
  gMat.customProgramCacheKey = () => 'tokyo-torii-gate';
  const lMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, emissive: new THREE.Color('#ff8a3d'), emissiveIntensity: 0, side: THREE.DoubleSide });
  lMat.onBeforeCompile = (sh) => {       // only the paper glows; the black caps stay dark
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.1, 0.4, vColor.r);');
  };
  lMat.customProgramCacheKey = () => 'tokyo-torii-lantern';

  const gates = new THREE.InstancedMesh(gGeo, gMat, poses.length); gates.name = 'tokyo-torii-gates';
  const lanterns = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  poses.forEach((p, i) => {
    q.setFromAxisAngle(up, p.yaw);
    gates.setMatrixAt(i, m.compose(v.set(p.x, p.y, p.z), q, one));
    gates.setColorAt(i, col.setScalar(0.93 + 0.1 * ((i * 37) % 11) / 10));                  // a little age between gates
    if (i % 3 === 0) for (const lx of [-17.9, -15.4, 15.4, 17.9]) {                           // lanterns on every third gate, beyond the barrier line, ~9.4 m up
      v.set(lx, 10.0, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));
      lanterns.push(new THREE.Matrix4().compose(v.clone(), q.clone(), new THREE.Vector3(1.6, 1.6, 1.6)));
    }
  });
  const lan = new THREE.InstancedMesh(lGeo, lMat, lanterns.length); lan.name = 'tokyo-torii-lanterns';
  lanterns.forEach((l, i) => lan.setMatrixAt(i, l));
  for (const o of [gates, lan]) { o.castShadow = false; o.receiveShadow = false; o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere(); }
  ctx.scene.add(gates, lan);

  return {
    setLook(look, params) {
      const night = THREE.MathUtils.smoothstep(look.dn, 0.3, 0.75);                          // off by day, dim at dusk, full from the evening
      warm.value = night * Math.min(1.6, look.emissive ?? 1) * (params?.emissive ?? 1) * 0.9;
      lMat.emissiveIntensity = (0.05 + 2.1 * night) * (look.emissive ?? 1) * (params?.emissive ?? 1) * 0.8;
    },
    dispose() { ctx.scene.remove(gates, lan); gGeo.dispose(); lGeo.dispose(); gMat.dispose(); lMat.dispose(); gates.dispose(); lan.dispose(); },
  };
}
