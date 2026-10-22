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

export class PhysicsWorld {
  static cache = {};
  static async create(url) {
    await initPhysics();
    const w = new PhysicsWorld();
    w.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    w.world.timestep = STEP;
    w.surfaceOf = new Map();                         // collider handle -> SURFACES entry
    // the collision mesh loads once; every session (src/game) builds a fresh world from it
    const gltf = PhysicsWorld.cache[url] ??= await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
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
    });
    w.world.step();                                  // builds the query pipeline
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
