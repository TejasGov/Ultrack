// India after dark: everything that lights the circuit and is not in the glTF (the lamp heads and their glows are; the light is not).
//   road-light.js     the street lamps' pools and the edge band, baked into the road map the road's materials light themselves by
//   edge-fixtures.js  the low fixtures on both barriers that throw the band (housing, lens, a glow sprite that holds at distance)
//   bridge-lights.js  uplights at the foot of the portal legs and the wash they throw up the legs and beams
// The six real point lights near the camera (main.js pool.street, tracks.js lampPower) add the close detail: car bodies, walls, poles.
// Same contract as Tokyo's parts: { setLook(look, params), update(t, camera, look), dispose() }; a part that fails to build is skipped.
// `road` is the road map's uniforms for venue/india/materials.js (null with ?indialights=off: the road then has no lamp light, rubber or dust).
import * as THREE from 'three';
import * as roadLight from './road-light.js';
import * as edgeFixtures from './edge-fixtures.js';
import * as bridgeLights from './bridge-lights.js';

const sstep = THREE.MathUtils.smoothstep;

export async function create(ctx) {
  if (new URLSearchParams(location.search).get('indialights') === 'off') return { road: null, setLook() {}, update() {}, dispose() {} };   // A/B for perf runs: ?indialights=off
  const part = async (name, mod) => { try { return await mod.create(ctx); } catch (e) { console.warn(`india ${name} skipped:`, e); return null; } };
  const [road, edge, bridge] = await Promise.all([part('road light', roadLight), part('edge fixtures', edgeFixtures), part('bridge lights', bridgeLights)]);
  const parts = [road, edge, bridge].filter(Boolean);
  return {
    road: road?.uniforms ?? null,
    setLook(look, params) {
      const dn = look.dn ?? 0, venue = params?.venueLights ?? 1;                           // (no wet factor: the road's wet shader darkens its albedo, and the light with it)
      const glow = (look.glow ?? 0.35 + 0.65 * (look.lights ?? 0)) * venue;                // the lamp sprites' gain (main.js): on from dusk
      const lamps = Math.max((look.lights ?? 0) * venue, 0.5 * glow);                       // their light on the road: the real lights' share, and a faint pool from the sprites at dusk
      road?.gain(lamps, lamps);
      edge?.gain(sstep(dn, 0.3, 0.9), glow);                                               // lens: lit from dusk on
      bridge?.gain(sstep(dn, 0.5, 0.9));
    },
    update(t, camera, look) { for (const p of parts) p.update?.(t, camera, look); },
    dispose() { for (const p of parts) p.dispose(); },
  };
}
