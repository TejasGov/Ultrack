import test from 'node:test';
import assert from 'node:assert/strict';
import { runPool, selectCars, parseArgs } from './meshy-cars.mjs';

const cars = Array.from({ length: 12 }, (_, i) => ({ id: `car-${i}` }));

test('three slots remain bounded while completed cars admit the next item', async () => {
  let active = 0, maximum = 0;
  const completed = [];
  await runPool(cars, 3, async car => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, car.id === 'car-0' ? 30 : 3));
    completed.push(car.id);
    active--;
  });
  assert.equal(maximum, 3);
  assert.equal(active, 0);
  assert.equal(new Set(completed).size, 12);
  assert.ok(completed.indexOf('car-3') < completed.indexOf('car-0'));
});

test('failure stops new admission but drains other running cars', async () => {
  const started = [], completed = [];
  await assert.rejects(runPool(cars, 3, async car => {
    started.push(car.id);
    if (car.id === 'car-0') throw Error('insufficient credits');
    await new Promise(resolve => setTimeout(resolve, 10));
    completed.push(car.id);
  }), /insufficient credits/);
  assert.deepEqual(started, ['car-0', 'car-1', 'car-2']);
  assert.deepEqual(completed, ['car-1', 'car-2']);
});

test('default batch is three; completed and failed cars are never regenerated', () => {
  const records = { 'car-0': { status: 'downloaded', taskId: 'done' }, 'car-1': { status: 'failed', taskId: 'failed' } };
  assert.deepEqual(selectCars(cars, records, parseArgs([])).map(c => c.id), ['car-2', 'car-3', 'car-4']);
});

test('recorded remote work is resumed ahead of fresh submissions', () => {
  const records = { 'car-7': { status: 'accepted', taskId: 'existing-task' } };
  assert.deepEqual(selectCars(cars, records, parseArgs([])).map(c => c.id), ['car-7', 'car-0', 'car-1']);
  assert.throws(() => selectCars(cars, records, parseArgs(['--ids', 'car-0,car-1,car-2'])), /Resume unfinished cars/);
});

test('ambiguous submission blocks further paid work', () => {
  for (const status of ['submitting', 'submission_unknown']) {
    assert.throws(() => selectCars(cars, { 'car-0': { status, operationId: 'known-journal' } }, parseArgs([])), /Resolve uncertain submission/);
  }
});

test('invalid queue and budget arguments are rejected', async () => {
  for (const args of [['--limit', '0'], ['--limit', 'NaN'], ['--max-credits', '-1'], ['--unknown', 'yes']]) {
    assert.throws(() => parseArgs(args));
  }
  await assert.rejects(runPool(cars, 4, async () => {}), /Concurrency/);
});
