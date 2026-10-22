// Real rigid-body driving checks: ordinary trail braking must not activate the drift assist.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { PhysicsWorld, STEP } = await server.ssrLoadModule('/src/physics/world.js');
  const { Vehicle } = await server.ssrLoadModule('/src/physics/vehicle.js');
  const { handling } = await server.ssrLoadModule('/src/physics/handling.js');
  const { setWeather } = await server.ssrLoadModule('/src/physics/weather.js');
  const assist = { counter: .35, stability: 1, tcs: .6 };
  const world = await PhysicsWorld.flat(1000);
  for (const key of ['av12', 'jaguarxkjss', 'mustang', 'porsche1']) {
    const model = new URL(`../../assets/cars/${key}/model.json`, import.meta.url);
    const profile = JSON.parse(readFileSync(existsSync(model) ? model : new URL(`../../car-lab/src/vehicle/profiles/${key}.json`, import.meta.url), 'utf8'));
    for (const wet of [.15, .7, 1]) {
      setWeather(wet);
      const car = new Vehicle(world, handling(key), profile, { pos: new THREE.Vector3(), yaw: 0 });
      const step = (seconds) => { for (let i = 0; i < seconds / STEP; i++) { car.step(STEP, assist); world.world.step(); } };
      step(1);
      car.rb.setLinvel({ x: 28, y: 0, z: 0 }, true);
      Object.assign(car.controls, { steer: .7, brake: .8 });
      step(.2);
      assert.equal(car.state.drift, 0, `${key}/${wet}: ordinary braking must preserve rear grip`);
      Object.assign(car.controls, { brake: 0, throttle: .3, steer: .2 });
      step(.8);
      assert.equal(car.state.drift, 0, 'No latched drift after brake release');
      assert(Math.abs(car.state.beta) < .35, `${key}/${wet}: cornering remains catchable`);
      car.rb.setLinvel({ x: 28, y: 0, z: 0 }, true);
      Object.assign(car.controls, { steer: .7, handbrake: 1 });
      step(.2);
      assert(car.state.drift > .3, 'Handbrake still deliberately initiates drifting');
      car.resetControls();
      assert.equal(car.state.drift, 0);
      world.world.removeRigidBody(car.rb);
    }
  }
  world.world.free();
  console.log('PASS: 4 cars × dry/damp/rain: trail braking, release, corner recovery, deliberate handbrake drift.');
} finally { await server.close(); }
