import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { createServer } from 'vite';
import { resolvePedals,REVERSE_MAX } from '../src/physics/pedals.js';
const state={};
assert.equal(resolvePedals(state,{throttle:1,brake:1},25,0,1/120).drive,0);
assert.equal(state.serviceBrake,1);
assert.equal(resolvePedals({}, {brake:1},.9,0,1/120).drive,0,'No reverse at walking speed');
assert.equal(resolvePedals({}, {brake:1},0,5,1).drive,0,'A sideways slide is not a stop');
assert.equal(resolvePedals({}, {brake:1,hold:true},0,0,1).drive,0,'Grid never reverses');
assert(resolvePedals({}, {brake:.2},0,0,1).drive<0,'Partial trigger can reverse');
assert.equal(resolvePedals({}, {throttle:1},-4,0,1/120).brake,1,'W brakes backwards motion');
assert.equal(resolvePedals({}, {brake:1},-REVERSE_MAX-1,0,1/120).drive,0);

const server=await createServer({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),configFile:false,logLevel:'error',server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const THREE=await server.ssrLoadModule('three');
  const {PhysicsWorld,STEP}=await server.ssrLoadModule('/src/physics/world.js');
  const {Vehicle}=await server.ssrLoadModule('/src/physics/vehicle.js');
  const {handling}=await server.ssrLoadModule('/src/physics/handling.js');
  const {setWeather}=await server.ssrLoadModule('/src/physics/weather.js');
  const world=await PhysicsWorld.flat(1000),assist={counter:.35,stability:1,tcs:.6};
  for(const key of ['av12','jaguarxkjss','ford-gt','porsche1'])for(const weather of [.15,.7,1]){
    setWeather(weather);
    const model=new URL(`../../assets/cars/${key}/model.json`,import.meta.url);
    const profile=JSON.parse(readFileSync(existsSync(model)?model:new URL(`../../car-lab/src/vehicle/profiles/${key}.json`,import.meta.url),'utf8'));
    const car=new Vehicle(world,handling(key),profile,{pos:new THREE.Vector3(),yaw:0});
    const step=seconds=>{for(let i=0;i<seconds/STEP;i++){car.step(STEP,assist);world.world.step();}};
    step(1);car.rb.setLinvel({x:100/3.6,y:0,z:0},true);
    Object.assign(car.controls,{throttle:1,brake:1});step(5);
    assert(Math.abs(car.vForward)<.5,`${key}/${weather}: S stops even with W held (${car.vForward})`);
    assert.equal(car.state.driveInput,0);assert.equal(car.state.serviceBrake,1);
    Object.assign(car.controls,{throttle:0});step(8);
    assert(car.vForward< -2,`${key}: continuing S reverses`);
    assert(car.vForward>=-REVERSE_MAX-.5,`${key}: reverse speed is bounded`);
    assert.equal(car.state.serviceBrake,0);assert.equal(car.state.reverse,true);
    Object.assign(car.controls,{throttle:1,brake:0});step(.1);
    assert.equal(car.state.serviceBrake,1,'W initially brakes reverse motion');
    step(5);assert(car.vForward>2,`${key}: W stops then accelerates forward`);
    assert.equal(car.state.reverse,false);
    car.resetControls();assert.equal(car.state.serviceBrake,0);assert.equal(car.state.reverse,false);
    world.world.removeRigidBody(car.rb);
  }
  world.world.free();
  console.log('PASS: W+S stops, brake-to-stop-to-reverse, reverse limiter, W brakes reverse, partial triggers, lateral sliding and grid hold; 4 cars × 3 weather presets.');
}finally{await server.close();}
