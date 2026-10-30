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
  col_grass: { mu: 0.5, drag: 0.12, name: 'grass', dust: true, wet: 0.9 },
  col_sand: { mu: 0.38, drag: 0.45, name: 'gravel trap', dust: true },
  col_wall: { mu: 0.6, drag: 0.0, name: 'wall' },
};

// The drivable ground can simply end while the visible terrain goes on (India's collision corridor stops ~40 m out): a car that gets
// there (off a crest, sliding wide) drops through the scenery. Every open edge of the ground with nothing to land on just beyond it
// (a ray 1.5 m out finds no ground within 10 m below) gets an invisible wall (per track: tracks.js `voidWalls`), 1 m under to 6 m over the edge. Edges where another
// surface carries on (a seam between strips, a corridor lying over the next leg of the lap) find ground there and stay open.
function voidWalls(world, ground) {
  const ids = new Map(), P = [], edges = new Map(), handles = new Set(ground.map((g) => g.handle));
  const vid = (v, i) => { const k = `${Math.round(v[i * 3] * 50)},${Math.round(v[i * 3 + 1] * 50)},${Math.round(v[i * 3 + 2] * 50)}`; let id = ids.get(k); if (id === undefined) { id = P.length / 3; ids.set(k, id); P.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]); } return id; };
  for (const { v, idx } of ground) for (let t = 0; t < idx.length; t += 3) {
    const tri = [vid(v, idx[t]), vid(v, idx[t + 1]), vid(v, idx[t + 2])];
    for (let k = 0; k < 3; k++) { const a = tri[k], b = tri[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`, e = edges.get(key); if (e) e.n++; else edges.set(key, { a, b, c: tri[(k + 2) % 3], n: 1 }); }
  }
  const out = [], tris = [], ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }), onGround = (c) => handles.has(c.handle);
  for (const { a, b, c, n } of edges.values()) {
    if (n !== 1) continue;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const ex = bx - ax, ez = bz - az, len = Math.hypot(ex, ez); if (len < 0.05) continue;
    const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
    let ox = -ez / len, oz = ex / len; if (ox * (mx - P[c * 3]) + oz * (mz - P[c * 3 + 2]) < 0) { ox = -ox; oz = -oz; }
    ray.origin = { x: mx + ox * 1.5, y: my + 4, z: mz + oz * 1.5 };
    if (world.castRay(ray, 14, true, undefined, undefined, undefined, undefined, onGround)) continue;
    const i = out.length / 3; out.push(ax, ay - 1, az, bx, by - 1, bz, bx, by + 6, bz, ax, ay + 6, az); tris.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  return { count: tris.length / 6, v: new Float32Array(out), idx: new Uint32Array(tris) };
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
    const ground = [];
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry, P = g.attributes.position, v = new Float32Array(P.count * 3), e = o.matrixWorld.elements;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        v[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; v[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; v[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      }
      const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: P.count }, (_, k) => k);
      // node names are the surface (col_asphalt) or a numbered copy of it (col_asphalt_1, col_asphalt.001)
      const name = Object.keys(SURFACES).sort((a, b) => b.length - a.length).find((k) => o.name.startsWith(k) || o.parent?.name?.startsWith(k)) ?? 'col_asphalt';
      const s = SURFACES[name] ?? SURFACES.col_asphalt;
      const col = w.world.createCollider(RAPIER.ColliderDesc.trimesh(v, idx).setFriction(name === 'col_wall' ? 0.35 : 0.8).setRestitution(name === 'col_wall' ? 0.15 : 0));
      w.surfaceOf.set(col.handle, s);
      if (name !== 'col_wall') ground.push({ v, idx, handle: col.handle });
    });
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
