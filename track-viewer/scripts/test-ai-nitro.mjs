// A rival's nitro rule, no browser: bursts on straights only.   node scripts/test-ai-nitro.mjs
import assert from 'node:assert/strict';
import { aiNitro, traitPace } from '../src/physics/driver.js';

assert.equal(aiNitro(false, 20, 0.02, 40, 1), true, 'fires on a straight, well under target');
assert.equal(aiNitro(false, 20, 0.5, 40, 1), false, 'not in a corner');
assert.equal(aiNitro(false, 5, 0.02, 40, 1), false, 'not near its target speed: a braking zone or a car to follow');
assert.equal(aiNitro(false, 20, 0.02, 10, 1), false, 'not off the line, where the wheels would only spin');
assert.equal(aiNitro(false, 20, 0.02, 40, 0.4), false, 'not until the tank is half full');
assert.equal(aiNitro(true, 5, 0.2, 40, 0.4), true, 'a burst carries on through small changes');
assert.equal(aiNitro(true, 2, 0.02, 40, 0.5), false, 'a burst ends at the target speed');
assert.equal(aiNitro(true, 20, 0.3, 40, 0.5), false, 'a burst ends at a corner');
assert.equal(aiNitro(true, 20, 0.02, 40, 0.05), false, 'a burst ends with the tank');
assert.equal(aiNitro(false, 20, 0.02, 40, 0.25, 0.2), true, 'a nitro-happy driver lights it at a fifth of a tank');
assert.equal(aiNitro(false, 20, 0.02, 40, 0.15, 0.2), false, 'but not under it');
assert.equal(traitPace('rain', { wet: 1.02, dry: 0.995 }, 0.7), 1.02); assert.equal(traitPace('rain', { wet: 1.02, dry: 0.995 }, 0.15), 0.995); assert.equal(traitPace('calm', { composure: 0.15 }, 0), 1, 'a style without a trim keeps the pace');
console.log('ai nitro: all checks passed');
