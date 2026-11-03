// Self-check for perf.js DynamicResolution against modelled machines: a GPU whose cost goes with the pixels, with and without a timer, a vsync that quantises the
// frame's interval, a CPU limit and a 30 Hz low-power rAF. node scripts/test-dynres.mjs
import assert from 'node:assert/strict';
import { DynamicResolution } from '../src/perf.js';

/** Runs a machine for `seconds` at 60 Hz; returns the scale, its history and when it last changed. fixed: GPU ms that no resolution changes */
function run({ gpuAt1, fixed = 2, cpu = 4, timer = true, timerGain = 1, vsync = 1000 / 60, seconds = 120, start = 1, floorMs = 0 }) {
  const d = new DynamicResolution({ budgetMs: 1000 / 60 });
  let scale = start, t = 0, last = 0;
  const steps = [];
  while (t < seconds) {
    const gpu = fixed + gpuAt1 * scale * scale, cost = Math.max(gpu, cpu, floorMs), wall = Math.ceil(cost / vsync - 1e-9) * vsync;
    d.sample(timer ? gpu * timerGain : NaN, wall / 1000, cpu);
    t += wall / 1000;
    const s = d.decide(scale);
    if (s !== null) { scale = s; steps.push([+t.toFixed(1), s]); last = t; }
  }
  return { scale, steps, last, gpu: fixed + gpuAt1 * scale * scale };
}

// a fast PC never moves
assert.deepEqual(run({ gpuAt1: 6 }).steps, []);

// an M1-like GPU, 40 ms at full size: one jump in the first seconds, then in budget for good, timer or not
for (const timer of [true, false]) {
  const r = run({ gpuAt1: 40, timer });
  assert.ok(r.steps[0][0] < 5, `reacts in seconds: ${JSON.stringify(r.steps)}`);
  assert.ok(r.gpu < 1000 / 60 * 1.2, `ends in budget: ${JSON.stringify(r)}`);
  assert.ok(r.steps.length <= 8, `no pumping: ${JSON.stringify(r.steps)}`);
}

// a timer that reads low (a tile-based GPU) must not blind it
assert.ok(run({ gpuAt1: 40, timerGain: 0.2 }).gpu < 1000 / 60 * 1.2);

// without a timer it comes back up once the load is gone (it used to only go down)
const back = run({ gpuAt1: 6, timer: false, start: 0.6 });
assert.equal(back.scale, 1, JSON.stringify(back.steps));

// a machine hovering near the budget without a timer: overshoots double the wait, so few changes
const near = run({ gpuAt1: 18, timer: false, seconds: 600 });
assert.ok(near.steps.length <= 30, `settles: ${near.steps.length} changes in 10 min`);
assert.ok(near.gpu < 1000 / 60 * 1.25);

// a CPU limit is left alone: lower resolution would only blur
assert.deepEqual(run({ gpuAt1: 6, cpu: 25, timer: false }).steps, []);

// a 30 Hz low-power rAF looks GPU-bound; one trial step finds out, is undone and is not repeated within the minute
const locked = run({ gpuAt1: 6, timer: false, floorMs: 33.3, seconds: 50 });
assert.equal(locked.scale, 1);
assert.ok(locked.steps.length === 2, JSON.stringify(locked.steps));

console.log('Dynamic resolution: reacts in seconds with or without a GPU timer, recovers, settles, and leaves CPU and rAF limits alone.');
