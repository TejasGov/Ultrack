// Wheel height on contact loss: the target drops at once but the wheel may only extend at a speed that ramps up with time
// in the air, so a 1-2 frame ray miss at a collision seam moves it ~1-3 mm (invisible) and a real airborne moment or
// impact reaches full droop in ~0.1 s. Compression (contact) is immediate.
import { spring } from './camera.js';
export const DROOP_SPEED = 5;     // m/s: peak extension speed after the ramp (full droop is ~65 mm)
export const DROOP_RAMP = 0.1;    // s in the air to reach that speed (cubic ramp)
/** Advances w.vy / w.vv (height, velocity) toward the contact comp (0 when airborne). */
export function wheelStep(w, contact, comp, omega, dt) {
  if (contact) { w.tgt = comp; w.air = 0; } else { w.tgt = 0; w.air += dt; }
  const prev = w.vy, k = Math.min(1, w.air / DROOP_RAMP);
  [w.vy, w.vv] = spring(w.vy, w.vv, w.tgt, contact ? omega : 2 * omega, dt);
  const floor = prev - DROOP_SPEED * k * k * k * dt;
  if (!contact && w.vy < floor) { w.vy = floor; w.vv = (floor - prev) / dt; }   // shortcut: speed-capped, not force-limited
  return w.vy;
}
