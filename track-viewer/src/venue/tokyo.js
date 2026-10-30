// Tokyo's runtime effects: everything the GLB cannot carry (animated, look-dependent or shader-made), loaded by
// main.js through tracks.js `venue` after the venue GLB. Each part is its own module in ./tokyo/ with the same contract:
//   export async function create(ctx) -> { update?(t, camera, look), setLook?(look, params), dispose() }
// ctx: { scene, root (the venue glTF scene), track (track.json), renderer, camera, bloom (the UnrealBloomPass), lights (lights.json), allMats, wetUniforms, NO_MIRROR,
//        ktx2 (the venue GLB's KTX2Loader: reuse its transcoder workers, never dispose it) }
// A part that fails to load is skipped with a warning: the track still runs without it.
const PARTS = [
  () => import('./tokyo/holograms.js'),
  () => import('./tokyo/torii.js'),
  () => import('./tokyo/petals.js'),
  () => import('./tokyo/pond.js'),
  () => import('./tokyo/materials.js'),
  () => import('./tokyo/mirror-height.js'),
  () => import('./tokyo/light-pools.js'),
  () => import('./tokyo/sky-glow.js'),
  () => import('./tokyo/bridge-lights.js'),
  () => import('./tokyo/look.js'),
  () => import('./tokyo/tunnel-light.js'),
  () => import('./tokyo/neon-signs.js'),
  () => import('./tokyo/neon-wash.js'),
  () => import('./tokyo/neon-streaks.js'),
];

/** main.js calls this as the venue GLB starts loading ({ renderer, ktx2 }): the photo textures load meanwhile */
export function prefetch(ctx) { import('./tokyo/materials.js').then((m) => m.prefetch(ctx)).catch(() => {}); }

export async function create(ctx) {
  const parts = (await Promise.all(PARTS.map(async (load) => {
    try { return await (await load()).create(ctx); } catch (e) { console.warn('tokyo fx part skipped:', e); return null; }
  }))).filter(Boolean);
  return {
    update: (t, camera, look) => { for (const p of parts) p.update?.(t, camera, look); },
    setLook: (look, params) => { for (const p of parts) p.setLook?.(look, params); },
    dispose: () => { for (const p of parts) p.dispose(); },
  };
}
