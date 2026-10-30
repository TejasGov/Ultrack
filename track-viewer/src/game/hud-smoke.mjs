// Smoke test for the HUD's logic: node src/game/hud-smoke.mjs (from track-viewer). It loads hud-gauge.js through vite, as scripts/test-menu.mjs
// does, and checks that each assist tag lights for the physics it stands for and stays dark otherwise; then hud.js's drift ring
// turns and the parts of a message's sub line (a lap delta by its sign, coins with the coin icon).
import { createServer } from 'vite';
import assert from 'node:assert/strict';
class Element extends EventTarget { constructor() { super(); this.children = []; this.style = {}; this.classList = { toggle() {}, add() {}, remove() {} }; } append() {} setAttribute() {} }
globalThis.Node = Element; globalThis.document = { createElement: () => new Element(), createElementNS: () => new Element(), createTextNode: () => new Element() }; globalThis.addEventListener = () => {};
const server = await createServer({ root: new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { assists } = await server.ssrLoadModule('/src/game/hud-gauge.js');
  const car = (o = {}) => ({ speed: 30, onGround: 4, spinSlip: 0, aBody: { z: 0 }, spec: { grip: 1.1, brakeK: 1.07 }, dbg: { tc: 1, stab: 0, catch: 0 }, ...o, state: { drive: 0, serviceBrake: 0, drift: 0, ...(o.state ?? {}) } });
  const rookie = { tcs: 0.8, stability: 1.25 }, pro = { tcs: 0, stability: 0.35 };
  const on = (v, a, i) => assists(v, a)[i] > 0.5;
  assert.ok(on(car({ speed: 4, spinSlip: 0.58, state: { drive: 1 } }), rookie, 0), 'TCS lights while the drive wheels spin on a launch');
  assert.ok(!on(car({ speed: 4, spinSlip: 0.58, state: { drive: 1 } }), pro, 0), 'no TCS at the Pro level');
  assert.ok(on(car({ dbg: { tc: 0.4, stab: 0, catch: 0 }, state: { drive: 1 } }), rookie, 0), 'TCS lights when it cuts the power in a slide');
  assert.ok(!on(car({ state: { drive: 1 } }), rookie, 0), 'TCS dark when the car has grip');
  assert.ok(on(car({ state: { serviceBrake: 1 } }), rookie, 1), 'ABS lights at full pedal');
  assert.ok(!on(car({ state: { serviceBrake: 0.5 } }), rookie, 1), 'ABS dark at half pedal');
  assert.ok(on(car({ state: { serviceBrake: 0.9 }, aBody: { z: 14 } }), rookie, 1), 'ABS lights sooner with cornering load');
  assert.ok(on(car({ dbg: { tc: 1, stab: 0, catch: -3 } }), rookie, 2), 'ESC lights while the stability assist catches a slide');
  assert.ok(!on(car({ dbg: { tc: 1, stab: 0, catch: -3 }, state: { drift: 0.8 } }), rookie, 2), 'ESC stays out of a deliberate drift');
  assert.ok(!on(car({ dbg: { tc: 1, stab: 2, catch: 0 } }), { tcs: 0.6, stability: 0 }, 2), 'ESC dark when the stability assist is off');
  assert.ok(!on(car({ spinSlip: 0.58, state: { drive: 1, tcsActive: 0 } }), rookie, 0), "the physics' own flag wins over the estimate");
  assert.ok(on(car({ state: { escActive: 1 } }), rookie, 2), "the physics' own flag lights its tag");
  const { ringTurns, msgParts } = await server.ssrLoadModule('/src/game/hud.js');
  assert.deepEqual(ringTurns(1), [0, 0], 'the drift ring is whole at the start');
  assert.deepEqual(ringTurns(0.5), [0, -180], 'half the time left: the right half only');
  assert.deepEqual(ringTurns(0.25), [-90, -180], 'a quarter left: the first quarter of the right half');
  assert.deepEqual(ringTurns(-1), [-180, -180], 'no time left: no ring');
  assert.deepEqual(msgParts('1:31.204  −0.418  +40 U'), [{ kind: '', text: '1:31.204' }, { kind: 'up', text: '−0.418' }, { kind: 'coin', text: '+40' }], 'a lap message: time, a faster delta, coins without the U');
  assert.equal(msgParts('1:31.204  +0.120')[1].kind, 'dn', 'a slower delta');
  assert.equal(msgParts('−1,234')[0].kind, '', 'a lost drift chain is points, not a delta');
  assert.deepEqual(msgParts(''), [], 'no sub line, no parts');
  console.log('HUD smoke: TCS, ABS and ESC light for the physics they stand for, and only then; the drift ring and the message parts add up.');
} finally { await server.close(); }
