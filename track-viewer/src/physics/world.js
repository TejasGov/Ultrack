// The physics world: Rapier (the engine scripts/test-track.mjs already checks the track against) with the track's
// collision mesh, one trimesh per surface, and each surface's grip. Steps at a fixed 120 Hz; the renderer
// interpolates poses between steps, so motion is smooth and identical at any frame rate.
let RAPIER, physicsReady;
export function initPhysics() {
  return physicsReady ??= import('@dimforge/rapier3d-compat').then(async module=>{RAPIER=module.default;await RAPIER.init();return RAPIER;}).catch(error=>{physicsReady=null;throw error;});
}
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const STEP = 1 / 120;

// tyre grip (multiplies the car's own) and rolling drag per surface (track.json → surfaces); `wet` is the extra factor
// at full rain on top of the road-wide wet loss (weather.js): kerb paint, cobbles and turf go slick before asphalt does
export const SURFACES = {
  col_asphalt: { mu: 1.0, drag: 0.0, name: 'asphalt' },
  col_pit: { mu: 0.98, drag: 0.0, name: 'pit' },
  col_curb: { mu: 0.9, drag: 0.02, name: 'kerb', rumble: true, wet: 0.85 },
  col_sausage: { mu: 0.75, drag: 0.08, name: 'sausage kerb', rumble: true, wet: 0.85 },
  col_runoff_tarmac: { mu: 0.95, drag: 0.01, name: 'run-off' },
  col_paved: { mu: 0.9, drag: 0.01, name: 'paved', wet: 0.88 },
  col_yard: { mu: 0.9, drag: 0.01, name: 'yard', wet: 0.88 },      // paved like col_paved, but off the track for track limits (session.js ON_TRACK)
  col_grass: { mu: 0.5, drag: 0.12, name: 'grass', dust: true, wet: 0.9 },
  col_sand: { mu: 0.38, drag: 0.45, name: 'gravel trap', dust: true },
  col_wall: { mu: 0.6, drag: 0.0, name: 'wall' },
};

// The drivable ground can simply end while the visible terrain goes on (India's collision corridor stops ~40 m out): a car that gets
// there (off a crest, sliding wide) drops through the scenery. Every open edge of the ground with nothing to land on just beyond it
// (rays out to 1.5 m find no ground within 10 m below, and no barrier stands there) gets an invisible wall (per track: tracks.js `voidWalls`), 1 m under to 6 m over the edge. Edges where another
// surface carries on (a seam between strips, a corridor lying over the next leg of the lap) find ground there and stay open.
function voidWalls(world, ground) {
  const ids = new Map(), P = [], edges = new Map(), handles = new Set(ground.map((g) => g.handle));
  const vid = (v, i) => { const k = `${Math.round(v[i * 3] * 50)},${Math.round(v[i * 3 + 1] * 50)},${Math.round(v[i * 3 + 2] * 50)}`; let id = ids.get(k); if (id === undefined) { id = P.length / 3; ids.set(k, id); P.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]); } return id; };
  for (const { v, idx } of ground) for (let t = 0; t < idx.length; t += 3) {
    const tri = [vid(v, idx[t]), vid(v, idx[t + 1]), vid(v, idx[t + 2])];
    for (let k = 0; k < 3; k++) { const a = tri[k], b = tri[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`, e = edges.get(key); if (e) e.n++; else edges.set(key, { a, b, c: tri[(k + 2) % 3], n: 1 }); }
  }
  const out = [], tris = [], ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), across = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), onGround = (c) => handles.has(c.handle);
  for (const { a, b, c, n } of edges.values()) {
    if (n !== 1) continue;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const ex = bx - ax, ez = bz - az, len = Math.hypot(ex, ez); if (len < 0.05) continue;
    let ox = -ez / len, oz = ex / len; if (ox * ((ax + bx) / 2 - P[c * 3]) + oz * ((az + bz) / 2 - P[c * 3 + 2]) < 0) { ox = -ox; oz = -oz; }
    // tested in pieces of at most 2 m, at both ends and the middle: a long edge can run out over water at one end and under the road at the
    // other, and one test at its middle would wall all of it, across the road (Infinia's bridge landing). A gap this leaves is under 2 m, narrower than a car
    const pieces = Math.ceil(len / 2), at = (t) => [ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t];
    // looked for at three distances: from 1.5 m alone a strip narrower than that is jumped over, and the kerb's edge inside it gets a wall in front of the barrier (every corner on India Ghat)
    const landing = (x, y, z) => [0.25, 0.75, 1.5].some((d) => { ray.origin = { x: x + ox * d, y: y + 4, z: z + oz * d }; return world.castRay(ray, 14, true, undefined, undefined, undefined, undefined, onGround); });
    // a barrier within 1.5 m already closes the edge: panels at car height against it only stop the car dead, so there they start over the car's roof, to catch one that vaults the barrier
    const barrier = (x, y, z) => [1, -1].some((sd) => { across.origin = { x, y: y + 0.4, z }; across.dir = { x: ox * sd, y: 0, z: oz * sd }; return world.castRay(across, 1.5, true, undefined, undefined, undefined, undefined, (o) => !handles.has(o.handle)); });
    for (let k = 0; k < pieces; k++) {
      const [x0, y0, z0] = at(k / pieces), [x1, y1, z1] = at((k + 1) / pieces), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
      if (landing(x0, y0, z0) || landing(x1, y1, z1) || landing(mx, my, mz)) continue;
      const low = barrier(mx, my, mz) ? 1.4 : -1, i = out.length / 3; out.push(x0, y0 + low, z0, x1, y1 + low, z1, x1, y1 + 6, z1, x0, y0 + 6, z0); tris.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
  }
  return { count: tris.length / 6, v: new Float32Array(out), idx: new Uint32Array(tris) };
}

// A wall's faces for the two one-sided meshes that make it solid from both sides (see create). India's wall is the visible concrete's own mesh: every segment ends in small faces standing across
// the wall, and a car's corner catches them. Dropped: tiny faces turned away from the wall they stand in (the main direction of a 6 m patch of it, by area, at double angle so its two sides agree).
// Sloped faces look up only: turned over they are an overhang that presses a car's roof corner down and stops it. And the posts standing on it (small faces over 1.25 m above the ground) are not solid:
// the top corner of the car's box hits them head on in what looks like a graze
function wallFaces(v, idx, world) {
  const cells = new Map(), key = (t) => `${Math.floor((v[idx[t] * 3] + v[idx[t + 1] * 3] + v[idx[t + 2] * 3]) / 18)},${Math.floor((v[idx[t] * 3 + 2] + v[idx[t + 1] * 3 + 2] + v[idx[t + 2] * 3 + 2]) / 18)}`;
  const normal = (t) => { const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2], nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, h2 = nx * nx + nz * nz, l = Math.sqrt(h2 + ny * ny); return { area: l / 2, up: l ? ny / l : 0, c2: h2 ? (nx * nx - nz * nz) / h2 : 0, s2: h2 ? 2 * nx * nz / h2 : 0 }; };
  for (let t = 0; t + 3 <= idx.length; t += 3) { const n = normal(t), k = key(t), e = cells.get(k) ?? [0, 0]; e[0] += n.area * n.c2; e[1] += n.area * n.s2; cells.set(k, e); }
  const front = [], back = [];
  for (let t = 0; t + 3 <= idx.length; t += 3) {
    const n = normal(t), [c, s] = cells.get(key(t)), l = Math.hypot(c, s) || 1, A = idx[t], B = idx[t + 1], C = idx[t + 2];
    if (n.area < 0.05 && (n.c2 * c + n.s2 * s) / l < -0.5) continue;      // over 60 degrees off
    if (n.area < 0.1) { const o = { x: (v[A * 3] + v[B * 3] + v[C * 3]) / 3, y: (v[A * 3 + 1] + v[B * 3 + 1] + v[C * 3 + 1]) / 3, z: (v[A * 3 + 2] + v[B * 3 + 2] + v[C * 3 + 2]) / 3 }, g = world.castRay(new RAPIER.Ray(o, { x: 0, y: -1, z: 0 }), 6, true); if (g && g.timeOfImpact > 1.25) continue; }
    if (Math.abs(n.up) > 0.25) { if (n.up > 0) front.push(A, B, C); else front.push(A, C, B); continue; }
    front.push(A, B, C); back.push(A, C, B);
  }
  return [front, back].map((f) => Uint32Array.from(f));
}

// Where a road ribbon turns tighter than it is wide, its strips cross (India's hairpins, stations 924 and 955-958), and the crossing makes small faces standing nearly upright on the road. A body
// low on its springs hits them head on and is thrown backwards, with nothing drawn there. Over 45 degrees is not ground for the wheels (GROUND_COS), so it is not road for the body either
const ROAD_SURFACES = new Set(['col_asphalt', 'col_curb', 'col_paved']);
function withoutSteepFaces(v, idx) {
  const kept = [];
  for (let t = 0; t + 3 <= idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz);
    if (!l || Math.abs(ny) / l >= Math.SQRT1_2) kept.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  return kept.length === idx.length ? idx : Uint32Array.from(kept);
}

export class PhysicsWorld {
  static cache = {};
  static async create(url, { voidWalls: walls = false } = {}) {
    await initPhysics();
    const w = new PhysicsWorld();
    w.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    w.world.timestep = STEP;
    w.surfaceOf = new Map();                         // collider handle -> SURFACES entry
    // the collision mesh loads once; every session (src/game) builds a fresh world from it
    const gltf = PhysicsWorld.cache[url] ??= await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const ground = [], wallMeshes = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry, P = g.attributes.position, v = new Float32Array(P.count * 3), e = o.matrixWorld.elements;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        v[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; v[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; v[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      let idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: P.count }, (_, k) => k);
      // node names are the surface (col_asphalt) or a numbered copy of it (col_asphalt_1, col_asphalt.001)
      const name = Object.keys(SURFACES).sort((a, b) => b.length - a.length).find((k) => o.name.startsWith(k) || o.parent?.name?.startsWith(k)) ?? 'col_asphalt';
      const s = SURFACES[name] ?? SURFACES.col_asphalt;
      if (name === 'col_wall') { wallMeshes.push({ v, idx, s }); return; }
      if (ROAD_SURFACES.has(name)) idx = withoutSteepFaces(v, idx);
      // a road or kerb edge catches a car's body sliding over it the way a wall's faces do (see below): 107 km/h to 22 at India's hairpins, the springs bottomed on the way down. The fix makes the mesh
      // one-sided, so its faces look up first
      if (ROAD_SURFACES.has(name)) for (let t = 0; t + 3 <= idx.length; t += 3) { const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3]; if ((v[b + 2] - v[a + 2]) * (v[c] - v[a]) - (v[b] - v[a]) * (v[c + 2] - v[a + 2]) < 0) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; } }
      const col = w.world.createCollider(RAPIER.ColliderDesc.trimesh(v, idx, ROAD_SURFACES.has(name) ? RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES : undefined).setFriction(0.8).setRestitution(0));
      w.surfaceOf.set(col.handle, s);
      ground.push({ v, idx, handle: col.handle });
    });
    // walls are built face by face, so a box sliding along one catches the end of the next face and loses most of its speed to a light graze. The fix makes a mesh one-sided, and a pit wall has
    // a road on both sides: so each wall in two meshes, facing each way
    w.world.step();                                  // the ground is in: the walls' height is measured from it
    for (const { v, idx, s } of wallMeshes) for (const faces of wallFaces(v, idx, w.world)) {
      const col = w.world.createCollider(RAPIER.ColliderDesc.trimesh(v, faces, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0.35).setRestitution(0.15));
      w.surfaceOf.set(col.handle, s);
    }
    w.world.step();                                  // builds the query pipeline
    w.voidWalls = walls ? voidWalls(w.world, ground) : { count: 0 };
    if (w.voidWalls.count) { const col = w.world.createCollider(RAPIER.ColliderDesc.trimesh(w.voidWalls.v, w.voidWalls.idx).setFriction(0.35).setRestitution(0.15)); w.surfaceOf.set(col.handle, SURFACES.col_wall); w.world.step(); }
    w.acc = 0;
    return w;
  }

  /** release the Rapier world (WASM memory) when a session ends */
  dispose() { this.world?.free(); this.world = null; }

  /** A flat asphalt square (2 km by default; 2 * half): the skidpad for tuning handling without the track getting in the way. */
  static async flat(half = 1000) {
    await initPhysics();
    const w = new PhysicsWorld();
    w.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); w.world.timestep = STEP; w.surfaceOf = new Map(); w.acc = 0;
    const col = w.world.createCollider(RAPIER.ColliderDesc.cuboid(half, 0.5, half).setTranslation(0, -0.5, 0).setFriction(0.8));
    w.surfaceOf.set(col.handle, SURFACES.col_asphalt);
    w.world.step();
    return w;
  }

  /** advance by frame time dt in fixed steps; `tick(h)` runs before each world step. Returns the leftover fraction. */
  advance(dt, tick) {
    this.acc += Math.min(dt, 0.25);
    let n = 0;
    while (this.acc >= STEP && n < 8) { tick(STEP); this.world.step(); this.acc -= STEP; n++; }
    if (n === 8) this.acc = 0;                       // a long hitch: drop the backlog rather than spiral
    return this.acc / STEP;
  }

  surface(handle) { return this.surfaceOf.get(handle) ?? SURFACES.col_asphalt; }
}

export { RAPIER };
