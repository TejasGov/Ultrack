// warmup.js firstUse: reads each ready program once, waits for one still linking, never reads a released one, gives up at its time limit.
//   node --test scripts/test-first-use.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 16);
const { firstUse } = await import('../src/warmup.js');

const program = (readyAt = 0) => { const p = { reads: 0, t: 0, isReady: () => p.t >= readyAt, getUniforms() { assert.ok(p.isReady(), 'read before linked'); p.reads++; } }; return p; };
const tick = (ps) => setInterval(() => ps.forEach((p) => p.t++), 16);

test('reads every program once, waiting for the ones still linking', async () => {
  const ps = [program(), program(), program(5), ...Array.from({ length: 20 }, () => program())], timer = tick(ps);
  await firstUse({ info: { programs: ps } });
  clearInterval(timer);
  assert.deepEqual(ps.map((p) => p.reads), ps.map(() => 1));
  await firstUse({ info: { programs: ps } });   // a second pass skips what the first read
  assert.deepEqual(ps.map((p) => p.reads), ps.map(() => 1));
});

test('a released program is never read, and a program that never links is left to its first draw', async () => {
  const gone = program(3), stuck = program(Infinity), ps = [gone, stuck, program()], timer = tick(ps);
  setTimeout(() => ps.splice(ps.indexOf(gone), 1), 5);
  const t0 = performance.now();
  await firstUse({ info: { programs: ps } }, { ms: 200 });
  clearInterval(timer);
  assert.equal(gone.reads, 0); assert.equal(stuck.reads, 0); assert.equal(ps.at(-1).reads, 1);
  assert.ok(performance.now() - t0 < 600, 'gave up at the time limit');
});

test('stops when cancelled', async () => {
  const ps = Array.from({ length: 40 }, () => program());
  let n = 0;
  await firstUse({ info: { programs: ps } }, { isCancelled: () => ++n > 3 });
  assert.ok(ps.filter((p) => p.reads).length < 40);
});
