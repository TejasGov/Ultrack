import assert from 'node:assert/strict';
import { readFileSync,existsSync,writeFileSync,mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { steeringLock,slidingForce,recoveryAcceleration,arcadeTier,arcadeAccel,arcadeYaw } from '../src/physics/arcade.js';
import { keyboardSteer } from '../src/physics/player-controls.js';
const tune=JSON.parse(readFileSync(new URL('../../assets/cars/driving.json',import.meta.url))).defaults;
assert(steeringLock(50,2.7,1.2,1,1500,tune)<steeringLock(15,2.7,1.2,1,1500,tune));
assert(slidingForce(.75,1,tune.slidingGrip,0)>.85);
assert(slidingForce(.75,1,tune.slidingGrip,1)<slidingForce(.75,1,tune.slidingGrip,0),'Drifting keeps breakaway');
for(const [contacts,surface,drift] of [[0,1,0],[2,1,0],[4,.5,0],[4,1,.5]])assert.equal(recoveryAcceleration(5,30,contacts,surface,drift,1,tune),0);
assert(recoveryAcceleration(5,30,4,1,0,1,tune)<0);
assert(Math.abs(recoveryAcceleration(50,30,4,1,0,1,tune))<=.12*9.81);
// arcade layer: Rookie ~2.2 g, Pro ~1.9 g dry; the wet takes 20%; yaw never asks for more than the grip turns; Rookie aligns harder and enters drifts sooner
const rk=arcadeTier(1.25),pr=arcadeTier(.35);
assert(rk.grip>pr.grip&&rk.align>pr.align&&rk.enter<pr.enter,'Rookie: more grip, stronger alignment, easier drift entry than Pro');
assert(Math.abs(arcadeAccel(rk,1.2,1,1,0,1500,0)/9.81-rk.grip)<.01&&arcadeAccel(rk,1.2,.8,1,0,1500,0)<.81*arcadeAccel(rk,1.2,1,1,0,1500,0),'wet scales the arcade grip');
assert(arcadeAccel(rk,1.2,1,.5,0,1500,0)<arcadeAccel(rk,1.2,1,1,0,1500,0),'grass gives less');
assert(Math.abs(arcadeYaw(40,1,2.7,22)*40-22)<1e-6&&Math.sign(arcadeYaw(40,-.01,2.7,22))===-1&&arcadeYaw(40,0,2.7,22)===0,'yaw rate is the wheel angle, capped at the grip');
let a=0,b=0;for(let i=0;i<60;i++)a=keyboardSteer(a,1,1/60);for(let i=0;i<120;i++)b=keyboardSteer(b,1,1/120);
assert(Math.abs(a-b)<.001,'Keyboard response remains frame-rate independent');
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,configFile:false,logLevel:'error',server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const THREE=await server.ssrLoadModule('three');
 const {Vehicle}=await server.ssrLoadModule('/src/physics/vehicle.js');
 const {PhysicsWorld,STEP}=await server.ssrLoadModule('/src/physics/world.js');
 const {handling}=await server.ssrLoadModule('/src/physics/handling.js');
 const {setWeather}=await server.ssrLoadModule('/src/physics/weather.js');
 const teams=JSON.parse(readFileSync(new URL('../../assets/teams/teams.json',import.meta.url))).teams;
 const world=await PhysicsWorld.flat(3000),assist={counter:.35,stability:1,tcs:.6},results=[];
 for(const key of teams.flatMap(t=>t.cars.map(c=>c.key))){
  const path=new URL(`../../assets/cars/${key}/model.json`,import.meta.url);
  const profile=JSON.parse(readFileSync(existsSync(path)?path:new URL(`../../car-lab/src/vehicle/profiles/${key}.json`,import.meta.url),'utf8'));
  for(const weather of [.15,.7,1]){
   setWeather(weather);
   const car=new Vehicle(world,handling(key),profile,{pos:new THREE.Vector3(),yaw:0});
   const step=(seconds,fn)=>{for(let i=0;i<Math.round(seconds/STEP);i++){fn?.(i*STEP);car.step(STEP,assist);world.world.step();}};
   step(1);car.rb.setLinvel({x:50,y:0,z:0},true);
   let peak=0,input=0,minUp=1;
   step(3,t=>{input=keyboardSteer(input,.7,STEP);car.controls.steer=input;peak=Math.max(peak,Math.abs(car.state.beta));minUp=Math.min(minUp,new THREE.Vector3(0,1,0).applyQuaternion(car.cur.quat).y);});
   assert(peak<.35,`${key}/${weather}: lift/turn must remain catchable: ${peak*180/Math.PI} degrees`);
   assert(minUp>.8,`${key}: steering cannot tip the car over`);
   assert.equal(car.state.drift,0);
   // Intentionally use the handbrake: drift assist must still have a distinct physical effect.
   car.respawn(new THREE.Vector3(),0);step(1);car.rb.setLinvel({x:28,y:0,z:0},true);
   Object.assign(car.controls,{throttle:.5,steer:.7,handbrake:1});step(.35);
   assert(car.state.drift>.5,`${key}: handbrake starts a drift`);
   const drift=car.state.drift;
   Object.assign(car.controls,{throttle:0,handbrake:0,steer:0});step(2);
   assert(car.state.drift<.1,`${key}: lifting and releasing returns to grip`);
   results.push({key,weather,peakSlideDeg:+(peak*180/Math.PI).toFixed(2),minUp:+minUp.toFixed(3),handbrakeDrift:+drift.toFixed(3)});
   world.world.removeRigidBody(car.rb);
  }
 }
 // An asymmetric 12 cm kerb should not launch the chassis into a flip.
 const {RAPIER}=await server.ssrLoadModule('/src/physics/world.js');
 const kerb=world.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.06,.3).setTranslation(25,.06,-.75));
 setWeather(.7);
 const profile=JSON.parse(readFileSync(new URL('../../car-lab/src/vehicle/profiles/av12.json',import.meta.url),'utf8'));
 const car=new Vehicle(world,handling('av12'),profile,{pos:new THREE.Vector3(),yaw:0});
 const step=seconds=>{for(let i=0;i<seconds/STEP;i++){car.step(STEP,assist);world.world.step();}};
 step(1);car.rb.setLinvel({x:20,y:0,z:0},true);
 let maxHeight=0,minUp=1;
 for(let i=0;i<4/STEP;i++){step(STEP);maxHeight=Math.max(maxHeight,car.cur.pos.y);minUp=Math.min(minUp,new THREE.Vector3(0,1,0).applyQuaternion(car.cur.quat).y);}
 assert(maxHeight<.6,`Kerb must not launch the car (${maxHeight})`);assert(minUp>.75);
 world.world.removeCollider(kerb,true);
 car.respawn(new THREE.Vector3(0,1.2,0),0);car.rb.setLinvel({x:15,y:0,z:0},true);step(3);
 assert(car.onGround>=3,'Car regains contact after a landing');assert(new THREE.Vector3(0,1,0).applyQuaternion(car.cur.quat).y>.9);
 assert(Math.abs(car.rb.linvel().y)<.5,'Landing settles without persistent bouncing');
 // An impact under power with the wheel held (a wall or kerb strike: the velocity is thrown 30 degrees off the heading and the yaw kicked in one step) must not
 // latch a throttle drift. Without the guard it latches a 40 degree hold at once (verified when the guard was written); the detector also sees a real wall glance.
 for(const stab of [1.25,.35]){
  const as={counter:.45,stability:stab,tcs:stab>1?.8:0};setWeather(.15);
  const go=n=>{for(let i=0;i<n/STEP;i++){car.step(STEP,as);world.world.step();}};
  car.respawn(new THREE.Vector3(0,0,0),0);go(1);car.rb.setLinvel({x:28,y:0,z:0},true);Object.assign(car.controls,{throttle:1,steer:-.6,handbrake:0});go(.05);
  car.rb.setLinvel({x:28*Math.cos(.52),y:0,z:28*Math.sin(.52)},true);car.rb.setAngvel({x:0,y:-1.5,z:0},true);
  let maxDrift=0,hit=false;for(let i=0;i<3/STEP;i++){car.step(STEP,as);world.world.step();maxDrift=Math.max(maxDrift,car.state.drift);hit||=car.state.hit>0;}
  assert(hit,'the impact is detected');
  assert(maxDrift<.3,`stab ${stab}: an impact under power latched a drift (${maxDrift.toFixed(2)})`);
  const wall=world.world.createCollider(RAPIER.ColliderDesc.cuboid(25,1,.25).setTranslation(40,1,3.3));
  car.respawn(new THREE.Vector3(0,0,0),0);go(1);car.rb.setLinvel({x:28,y:0,z:0},true);Object.assign(car.controls,{throttle:1,steer:-.25,handbrake:0});go(.05);
  hit=false;maxDrift=0;for(let i=0;i<3/STEP;i++){car.step(STEP,as);world.world.step();maxDrift=Math.max(maxDrift,car.state.drift);hit||=car.state.hit>0;}
  assert(hit&&maxDrift<.3,`stab ${stab}: a wall glance is detected (${hit}) and starts no drift (${maxDrift.toFixed(2)})`);
  world.world.removeCollider(wall,true);
 }
 car.resetControls();
 world.world.free();
 const out=new URL('../qa/arcade/',import.meta.url);mkdirSync(out,{recursive:true});
 writeFileSync(new URL('driving-report.json',out),JSON.stringify({scenarios:results,kerb:{maxHeight,minUp},checks:['air/off-road recovery disabled','speed-dependent steering','14-car turn/lift','handbrake initiation and release','kerb crossing','landing settle']},null,2));
 console.log(`PASS: ${results.length} roster/weather scenarios, deliberate drift, kerb contact, landing, road-only recovery and keyboard frame-rate independence.`);
}finally{await server.close();}
