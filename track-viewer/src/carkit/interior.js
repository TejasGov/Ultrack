// What you see through a car's gaps. Meshy shells are hollow, double-walled skins with no cabin and no floor, and
// with open cowls, decks and intakes; through them (and past the glass edges) you looked straight through the car
// at the road. Cheap dark fills, all shaped to the body so none of them can poke through the paint:
// - undertray: a floor following the car's footprint, just inside its lowest skin
// - keel: a centre bulkhead following the car's side profile, from the floor to seat-cushion height (never within
//   5 cm of the bodywork above it), so intakes and vents that line up across the car end in darkness
// - tub + seats: a rounded cabin volume under the glass, so the windows show an interior
// - arch liners: a dark half-drum over each tyre, so you never look down past a tyre at the road
// - bays: a dark volume lofted through the front and rear compartments (ahead of the windscreen, behind the rear
//   glass), 6 cm under the deck and narrowing toward the top, so vents and intakes show a filled engine bay
// The profiles come from rays fired at the shell every few centimetres along the car. Everything sits in LOD level 0
// (nothing beyond ~45 m). tuning.interior { tub, plates, tubInset } (false turns a part off).
// (A shrunken copy of the shell as an inner lining was tried and dropped: the light LOD it came from sits outside the
// detailed shell in concave areas, so it showed through the paint.)
import * as THREE from 'three';

const cabin = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.75, metalness: 0.05 });
const plate = new THREE.MeshStandardMaterial({ color: 0x060708, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
export const INTERIOR_NAMES = ['cabin-tub', 'seat', 'undertray', 'keel', 'arch-liner', 'bulkhead', 'bay', 'greenhouse'];

/** A strip of quads between two polylines (arrays of Vector3 of equal length) */
function strip(a, b) {
  const pos = [], idx = [];
  a.forEach((p, i) => { pos.push(p.x, p.y, p.z, b[i].x, b[i].y, b[i].z); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Per x in `xs` (the mesh's parent frame via `inv` * matrixWorld): an index of the triangles whose x span reaches it (1 mm slack), or null
 *  when that x has none. null for the whole mesh when three's raycast would not read a plain index (groups, morphs, instancing, a draw range). */
function planeSlices(mesh, inv, xs) {
  const g = mesh.geometry, pos = g.attributes.position;
  if (mesh.isInstancedMesh || mesh.isSkinnedMesh || Array.isArray(mesh.material) || g.groups.length || g.morphAttributes.position || g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return null;
  const e = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld).elements, X = new Float64Array(pos.count), eps = 1e-3;
  for (let i = 0; i < pos.count; i++) X[i] = e[0] * pos.getX(i) + e[4] * pos.getY(i) + e[8] * pos.getZ(i) + e[12];
  const idx = g.index, n = idx ? idx.count : pos.count, lists = xs.map(() => []);
  for (let t = 0; t + 2 < n; t += 3) {
    const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, c = idx ? idx.getX(t + 2) : t + 2;
    const lo = Math.min(X[a], X[b], X[c]) - eps, hi = Math.max(X[a], X[b], X[c]) + eps;
    xs.forEach((x, s) => { if (x >= lo && x <= hi) lists[s].push(a, b, c); });
  }
  return lists.map((l) => (l.length ? new THREE.BufferAttribute(new Uint32Array(l), 1) : null));
}

/** lod: the body LOD; glassBox: window outlines (shell metres, z = |z|); bodyBox: shell bounds; spec: tuning.interior */
export function addInterior(lod, glassBox, bodyBox, spec = {}, wheels = null) {
  const level0 = lod.levels[0].object, shell = level0.children.filter((o) => o.isMesh);
  const group = new THREE.Group(); group.name = 'interior';      // cars.js merges it to one mesh per material
  level0.updateWorldMatrix(true, true);
  const M = level0.matrixWorld, inv = M.clone().invert(), ray = new THREE.Raycaster();
  const b = bodyBox, belt = glassBox.isEmpty() ? b.min.y + 0.55 * (b.max.y - b.min.y) : glassBox.min.y;
  const N = 36, rows = [], xs = Array.from({ length: N + 1 }, (_, i) => b.min.x + 0.06 + (b.max.x - b.min.x - 0.12) * i / N);
  // Every cast lies in the plane x = xs[at]: each mesh is cast against only the triangles that reach that plane (three's own
  // raycast on an index of them, so the hits are the brute-force ones). Brute force cost ~130 ms of main thread per car.
  const uses = new Map(); shell.forEach((m) => uses.set(m.geometry, (uses.get(m.geometry) ?? 0) + 1));   // a shared geometry keeps its full index
  const slices = shell.map((m) => (uses.get(m.geometry) > 1 ? null : planeSlices(m, inv, xs))); let at = 0;
  // first hit from `o` along `d`, both in shell metres; returns the hit in shell metres (or null)
  const cast = (o, d) => {
    ray.set(o.clone().applyMatrix4(M), d.clone().transformDirection(M)); ray.far = 20;
    const full = shell.map((m) => m.geometry.index), hit = shell.filter((m, k) => !slices[k] || slices[k][at]);
    shell.forEach((m, k) => { if (slices[k]) m.geometry.index = slices[k][at]; });
    try { const h = ray.intersectObjects(hit, false)[0]; return h ? h.point.applyMatrix4(inv) : null; }
    finally { shell.forEach((m, k) => { m.geometry.index = full[k]; }); }
  };
  for (let i = 0; i <= N; i++) {
    const x = xs[i]; at = i;
    // the downward ray falls through any opening in the deck (exactly where the floor is needed): it only limits the keel
    const topHit = cast(new THREE.Vector3(x, b.max.y + 1, 0), new THREE.Vector3(0, -1, 0));
    let bot = cast(new THREE.Vector3(x, b.min.y - 1, 0), new THREE.Vector3(0, 1, 0))?.y ?? b.min.y;
    if (!topHit || topHit.y - bot < 0.12) bot = b.min.y;      // open underneath: the upward ray met the top skin
    // the upward ray can strike something high inside the shell (a tunnel, a sill's inner skin): the floor stays low
    const floor = Math.min(Math.max(bot + 0.03, b.min.y + 0.08), b.min.y + 0.22);
    const top = topHit ? topHit.y : floor;
    const side = cast(new THREE.Vector3(x, floor + 0.08, b.max.z + 1), new THREE.Vector3(0, 0, -1));
    // at the wheel stations the low ray enters the arch: measure the fender higher up, keep the floor inside the tyres
    let high = null;
    if (!side) for (const y of [belt - 0.1, belt, belt + 0.08, (floor + belt) / 2, (floor + top) / 2, top - 0.05, floor + 0.2]) { high = cast(new THREE.Vector3(x, y, b.max.z + 1), new THREE.Vector3(0, 0, -1)); if (high) break; }
    // inside an arch the floor runs out to the tyre's inner face (no daylight beside the tyre)
    const axle = wheels && Object.values(wheels).find((w) => Math.abs(x - w.x) < w.radius + 0.12);
    const inner = axle ? axle.track / 2 - axle.width / 2 - 0.005 : 0.62;
    const half = side ? side.z - 0.05 : high ? Math.min(high.z - 0.05, inner) : 0;
    rows.push({ x, top, floor, half: Math.max(0, half), hole: !topHit || topHit.y - floor < 0.12 });
  }
  // where the downward probe fell through an opening, take the deck height from the slices either side
  rows.forEach((r, i) => {
    if (!r.hole) return;
    let a = i, c = i; while (a > 0 && rows[a].hole) a--; while (c < rows.length - 1 && rows[c].hole) c++;
    const A = rows[a], C = rows[c];
    if (!A.hole && !C.hole) r.top = A.top + (C.top - A.top) * (r.x - A.x) / (C.x - A.x);
    else if (!A.hole || !C.hole) r.top = (A.hole ? C : A).top;
  });
  const runs = []; let cur = null;                             // contiguous stretches where the body is present
  for (const r of rows) {
    if (r.half > 0.1) { if (!cur) runs.push(cur = []); cur.push(r); } else cur = null;
  }
  if (spec.plates !== false) {
    for (const run of runs) {
      if (run.length < 2) continue;
      const tray = new THREE.Mesh(strip(run.map((r) => new THREE.Vector3(r.x, r.floor, -r.half)), run.map((r) => new THREE.Vector3(r.x, r.floor, r.half))), plate);
      tray.name = 'undertray'; group.add(tray);
      const keel = new THREE.Mesh(strip(run.map((r) => new THREE.Vector3(r.x, r.floor, 0)),
        run.map((r) => new THREE.Vector3(r.x, Math.max(r.floor, Math.min(belt + 0.12, r.top - 0.05)), 0))), plate);
      keel.name = 'keel'; group.add(keel);
    }
    // front and rear bays: loft a tapered box through the slices outside the cabin
    if (!glassBox.isEmpty()) for (const bay of [rows.filter((r) => r.x < glassBox.min.x - 0.02 && r.half > 0.1), rows.filter((r) => r.x > glassBox.max.x + 0.02 && r.half > 0.1)]) {
      if (bay.length < 2) continue;
      const ring = (r) => { const t = Math.max(r.floor + 0.05, r.top - 0.06); return [[r.x, r.floor, -r.half], [r.x, r.floor, r.half], [r.x, t, r.half * 0.55], [r.x, t, -r.half * 0.55]]; };
      const pos = [], idx = [];
      bay.forEach((r) => ring(r).forEach((p) => pos.push(...p)));
      for (let i = 0; i < bay.length - 1; i++) for (let k = 0; k < 4; k++) {
        const a = i * 4 + k, b2 = i * 4 + (k + 1) % 4, c2 = a + 4, d2 = b2 + 4; idx.push(a, b2, c2, b2, d2, c2);
      }
      const e = (bay.length - 1) * 4; idx.push(0, 1, 2, 0, 2, 3, e, e + 2, e + 1, e, e + 3, e + 2);   // end caps
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, plate); m.name = 'bay'; group.add(m);
    }
    // firewall and rear bulkhead: across the car at the windscreen base and the rear glass, floor to just under the deck
    if (!glassBox.isEmpty()) for (const gx of [glassBox.min.x, glassBox.max.x]) {
      const r = rows.reduce((a, q) => (Math.abs(q.x - gx) < Math.abs(a.x - gx) ? q : a));
      const top = Math.min(belt + 0.05, r.top - 0.05);
      if (r.half < 0.1 || top - r.floor < 0.05) continue;
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(2 * r.half, top - r.floor).rotateY(Math.PI / 2), plate);
      wall.position.set(gx, (r.floor + top) / 2, 0); wall.name = 'bulkhead'; group.add(wall);
    }
  }
  if (spec.liners !== false && wheels) {
    const lift = lod.position.y;                                  // wheel centres are in car metres; the shell sits `lift` up
    for (const w of Object.values(wheels)) for (const s of [1, -1]) {
      const r = w.radius + 0.015, wd = w.width + 0.05;
      const liner = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wd, 28, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), plate);
      liner.position.set(w.x, w.radius - lift, s * (w.track / 2 - 0.015)); liner.name = 'arch-liner';
      group.add(liner);
    }
  }
  level0.add(group);
  // greenhouse: a dark volume from the shoulders to just under the roof, inset from the glass, so a view through
  // one window and out of another (or past a window's edge) ends inside the cabin, as behind real tinted glass
  if (spec.cabin !== false && wheels !== null && !glassBox.isEmpty()) {
    const G = spec.glass ?? {}, ws = G.windshield, rw = G.rear, sd = G.side;
    if (ws && rw && sd) {
      const x0 = Math.max(...ws.map((p) => p[0])) + 0.08, x1 = Math.min(...rw.map((p) => p[0])) - 0.08;
      const span = rows.filter((r) => r.x >= x0 && r.x <= x1 && !r.hole);
      const zTop = Math.min(...sd.map((p) => Math.abs(p[2])));
      if (span.length && x1 - x0 > 0.3) {
        const y0 = belt + 0.02, y1 = Math.min(...span.map((r) => r.top)) - 0.06, hz = zTop - 0.1;
        if (y1 - y0 > 0.1 && hz > 0.2) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 2 * hz), cabin);
          box.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); box.name = 'greenhouse'; group.add(box);
        }
      }
    }
  }
  if (spec.tub !== false && !glassBox.isEmpty()) {
    const x0 = glassBox.min.x + 0.05, x1 = glassBox.max.x - 0.05, inside = rows.filter((r) => r.x >= x0 && r.x <= x1 && r.half > 0.1);
    if (inside.length) {
      // as wide as the narrowest point of the cabin allows, less an inset; as low as the floor, as high as the sills
      const hz = Math.min(...inside.map((r) => r.half)) - (spec.tubInset ?? 0.06), y0 = Math.max(...inside.map((r) => r.floor)), y1 = belt + 0.04;
      const g = new THREE.SphereGeometry(1, 24, 12), p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        v.set(Math.sign(v.x) * Math.abs(v.x) ** 0.35, Math.sign(v.y) * Math.abs(v.y) ** 0.35, Math.sign(v.z) * Math.abs(v.z) ** 0.35);
        p.setXYZ(i, (x0 + x1) / 2 + v.x * (x1 - x0) / 2, (y0 + y1) / 2 + v.y * (y1 - y0) / 2, v.z * hz);
      }
      g.computeVertexNormals();
      const tub = new THREE.Mesh(g, cabin); tub.name = 'cabin-tub'; group.add(tub);
      for (const s of [1, -1]) {                                // two seat backs: what you read through a side window
        const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.24, 4, 10).rotateZ(-0.35), cabin);
        const sx = x0 + (x1 - x0) * 0.62, roof = inside.reduce((a, r) => (Math.abs(r.x - sx) < Math.abs(a.x - sx) ? r : a)).top;
        seat.position.set(sx, Math.min(y1 + 0.22, roof - 0.08) - 0.28, s * hz * 0.45); seat.name = 'seat';   // top ≤ 8 cm under the roof
        group.add(seat);
      }
    }
  }
}

// Pillars: car-lab's windows don't meet, and most Meshy shells have no pillars between them, so daylight through
// both sides of the car showed as slots. Gloss-black panels in the window planes bridge each pair of edges:
//   A: windscreen side edge <-> side window front edge;  B: side window rear edge <-> quarter window front edge;
//   C: quarter window top edge <-> rear window side edge.  (Piano-black pillars, as on most of these cars.)
const pillarMat = new THREE.MeshPhysicalMaterial({ color: 0x08090b, roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.45, side: THREE.DoubleSide });
export function bPillars(profile) {
  const g = new THREE.Group(); g.name = 'pillars'; g.position.y = profile.body.lift;
  const G = profile.glass ?? {}, side = G.side, quarter = G.quarter, ws = G.windshield, rear = G.rear;
  // each side's edge of the windscreen and rear window: the two corners on that side (z sign)
  const edge = (pane, s) => pane?.filter((p) => Math.sign(p[2]) === s).sort((a, b) => a[1] - b[1]);
  for (const s of [1, -1]) {
    const quads = [];
    if (side?.length >= 4 && quarter?.length >= 2) quads.push(['B', [side[2], side[3], quarter[1], quarter[0]].map(([x, y, z]) => [x, y, z * s])]);
    const we = edge(ws, s);
    if (side?.length >= 2 && we?.length === 2) quads.push(['A', [[side[0][0], side[0][1], side[0][2] * s], [side[1][0], side[1][1], side[1][2] * s], we[1], we[0]]]);
    const re = edge(rear, s);
    if (quarter?.length >= 3 && re?.length === 2) quads.push(['C', [[quarter[0][0], quarter[0][1], quarter[0][2] * s], [quarter[2][0], quarter[2][1], quarter[2][2] * s], re[0], re[1]]]);
    for (const [name, pts] of quads) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p))); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, pillarMat); m.name = `${name}-pillar-${s}`; g.add(m);
    }
  }
  return g;
}
