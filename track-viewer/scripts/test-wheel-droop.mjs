import assert from 'node:assert/strict';
import { wheelStep } from '../src/wheelDroop.js';
const OMEGA = 24, COMP = 0.065;
// simulates the cars.js block: contact for a while, then a miss of `miss` s, at `hz`
function run(miss, hz) {
  const dt = 1 / hz, w = { tgt: COMP, air: 0, vy: COMP, vv: 0 };
  const step = (contact) => wheelStep(w, contact, COMP, OMEGA, dt);
  for (let i = 0; i < hz / 4; i++) step(true);
  for (let i = 0; i < Math.round(miss * hz); i++) step(false);
  const dropped = COMP - w.vy, before = w.vy;
  step(true);
  return { dropped, rose: w.vy > before };
}
for (const hz of [60, 120, 144]) {
  const two = run(2 / hz, hz); assert(two.dropped < 0.005, `2-frame miss @${hz}: ${two.dropped * 1000} mm`);
  const air = run(0.15, hz); assert(air.dropped > 0.8 * COMP, `0.15 s miss @${hz}: ${(air.dropped / COMP * 100).toFixed(0)}%`);
  console.log(`${hz} Hz: 2-frame ${(two.dropped * 1000).toFixed(2)} mm, 0.15 s ${(air.dropped / COMP * 100).toFixed(0)}%`);
}
// re-contact compresses immediately: target jumps to comp the same frame (spring then moves as before)
const w = { tgt: 0, air: 0.3, vy: 0, vv: 0 }; wheelStep(w, true, 0.09, OMEGA, 1 / 60);
assert.equal(w.tgt, 0.09); assert.equal(w.air, 0); assert(w.vy > 0.005, 'compresses on the first frame');
console.log('droop ok');
