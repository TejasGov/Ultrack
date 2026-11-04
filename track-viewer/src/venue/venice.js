// Venice's runtime effects, loaded through tracks.js `venue`: the tunnel's light (venue/tokyo/tunnel-light.js has why: the sky's light reaches every surface whatever stands over it, so without this the walls that
// face the low sun glow through solid stone; under the vault the tunnel's own warm materials do the lighting) and the city's lamps after dark (venue/venice/night.js).
import { TRACKS } from '../tracks.js';
const MATS = new Set([...TRACKS.venice.wet.wet, 'VE | tunnel base', 'VE | tunnel stone', 'VE | tunnel vault', 'VE | tunnel floor', 'VE | barrier']);
const DARK = { bluehour: 0.34, night: 0.26 };     // the tunnel's fill and warm walls were set for dusk's low exposure: the same light at a night's exposure is a flat beige glare
const TUNNEL = /^VE \| tunnel (base|stone|vault|floor)$/;
export async function create(ctx) {
  const [tunnel, night] = await Promise.all([
    import('./tokyo/tunnel-light.js').then((m) => m.create(ctx, { mats: MATS, roof: /^VE[ _]tunnel/, halfW: 11, label: 'venice', fill: [1.95, 1.65, 1.3], fillLook: DARK })),
    import('./venice/night.js').then((m) => m.create(ctx)),
  ]);
  return {
    setLook(look, params) {
      tunnel.setLook?.(look, params); night.setLook(look, params);
      const k = DARK[params?.look]; if (!k) return;      // after main.js set every emissive for the look; day and dusk stay as they were
      for (const m of ctx.allMats) {
        if (TUNNEL.test(m.name)) m.emissiveIntensity = m.userData.emissive0 * k;
        else if (m.name === 'VE | crowd') m.emissiveIntensity = m.userData.emissive0 * look.emissive * 0.5;      // the stands are lit from the road's lamps, not floodlit
      }
    },
    update(t, camera, look) { tunnel.update?.(t, camera, look); },
    dispose() { tunnel.dispose(); night.dispose(); },
  };
}
