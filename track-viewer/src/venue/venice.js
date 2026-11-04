// Venice's runtime effects, loaded through tracks.js `venue`: only the tunnel's light (venue/tokyo/tunnel-light.js has why). The sky's light reaches every surface whatever stands over it, so without this the walls that
// face the low sun glow through solid stone; under the vault the tunnel's own warm materials do the lighting.
import { TRACKS } from '../tracks.js';
const MATS = new Set([...TRACKS.venice.wet.wet, 'VE | tunnel base', 'VE | tunnel stone', 'VE | tunnel vault', 'VE | tunnel floor', 'VE | barrier']);
export async function create(ctx) {
  return (await import('./tokyo/tunnel-light.js')).create(ctx, { mats: MATS, roof: /^VE[ _]tunnel/, halfW: 11, label: 'venice', fill: [1.95, 1.65, 1.3] });
}
