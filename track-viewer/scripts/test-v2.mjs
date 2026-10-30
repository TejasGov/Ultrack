import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerInput} from '../src/physics/driver.js';
import {Vehicle} from '../src/physics/vehicle.js';
import {padSteer} from '../src/physics/player-controls.js';
import {isModelRim} from '../src/carkit/model-rims.js';
import {summarizeFrames} from '../src/model-benchmark.js';
import {GameAudio} from '../src/game/audio.js';
import {EV} from '../src/game/ev.js';
EV.add('ev-test');  // no electric car ships; the EV audio path stays covered with a synthetic one
import {createPA,RoadAudio} from '../src/game/audio-effects.js';
const button=value=>({value,pressed:value>.5});
const pad=x=>({connected:true,id:'test-pad',axes:[x,0],buttons:Array.from({length:16},()=>button(0))});
function fixture(pads=[]){
 const target=new EventTarget(),doc=new EventTarget();doc.hidden=false;
 const input=new PlayerInput({target,doc,pads:()=>pads});
 const key=(name,code,options={})=>{const event=new Event(name,{cancelable:true});Object.assign(event,{code,...options});target.dispatchEvent(event);};
 return {input,target,doc,key};
}
test('idle drifting pad cannot claim keyboard driving, including after 12 swaps',()=>{
 const g=pad(.14),f=fixture([g]);
 for(let i=0;i<12;i++){
  f.input.clear();f.key('keydown','KeyA');for(let j=0;j<30;j++)f.input.read(1/60);
  assert.ok(f.input.steer>.8);f.input.clear();f.key('keydown','KeyW');
  assert.equal(f.input.read(1/60).steer,0);
 }
 f.input.dispose();
});
test('intentional pad steering works; keyboard steering and throttle win',()=>{
 const f=fixture([pad(.8)]);assert.ok(f.input.read(.1).steer<-.5);
 f.key('keydown','KeyA');assert.ok(f.input.read(.1).steer>0);
 f.input.clear();f.key('keydown','KeyW');assert.equal(f.input.read(.1).steer,0);
 assert.equal(padSteer(.15),0);assert.equal(padSteer(NaN),0);f.input.dispose();
});
test('lost keyups are cleared on blur, visibility, menus and Meta; disabled input stays neutral',()=>{
 const f=fixture();
 for(const action of [()=>f.target.dispatchEvent(new Event('blur')),()=>{f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));},()=>f.input.setEnabled(false),()=>f.key('keydown','MetaLeft')]){
  f.input.setEnabled(true);f.key('keydown','KeyD');f.input.read(.3);action();assert.equal(f.input.steer,0);assert.equal(f.input.keys.size,0);
 }
 f.input.setEnabled(false);f.key('keydown','KeyW');assert.equal(f.input.read(.1).throttle,0);f.input.dispose();
});
test('pad reset is edge-triggered instead of resetting every physics step',()=>{
 const p=pad(0);p.buttons[3]=button(1);const f=fixture([p]);
 assert.equal(f.input.read(.01).reset,true);assert.equal(f.input.read(.01).reset,false);f.input.dispose();
});
test('respawn clearing does not re-arm a held pad reset; releasing it does',()=>{
 const p=pad(0);p.buttons[3]=button(1);const f=fixture([p]);
 assert.equal(f.input.read(.01).reset,true);f.input.clear({preserveResetLatch:true});
 assert.equal(f.input.read(.01).reset,false);p.buttons[3]=button(0);f.input.read(.01);
 p.buttons[3]=button(1);assert.equal(f.input.read(.01).reset,true);f.input.dispose();
});
test('respawn keeps a held throttle key but resets steering',()=>{
 const f=fixture();f.key('keydown','KeyW');f.key('keydown','KeyA');f.input.read(.3);f.input.clear({preserveResetLatch:true});
 assert.equal(f.input.steer,0);assert.equal(f.input.read(1/60).throttle,1);f.input.dispose();
});
test('respawn resets steering, drift/controller history, velocities and wheel motion',()=>{
 const fake={state:{nitroTank:.4,steer:.5,beta:.8,driftDir:-1},controls:{steer:1},aBody:new THREE.Vector3(1,2,3),vPrevBody:new THREE.Vector3(3,2,1),wheels:[{omegaR:25,comp:.1}],
  rb:{setTranslation(){},setRotation(){},setLinvel(){},setAngvel(){}},prev:{pos:new THREE.Vector3(),quat:new THREE.Quaternion()},cur:{pos:new THREE.Vector3(),quat:new THREE.Quaternion()},capture(){},resetControls:Vehicle.prototype.resetControls};
 Vehicle.prototype.respawn.call(fake,new THREE.Vector3(),0);
 assert.equal(fake.state.steer,0);assert.equal(fake.state.betaPrev,0);assert.equal(fake.state.driftDir,0);assert.equal(fake.state.nitroTank,.4);
 assert.equal(fake.controls.steer,0);assert.equal(fake.aBody.length(),0);assert.equal(fake.wheels[0].omegaR,0);
});
test('wheel material selectors exclude tyres, brake discs, badges and screws',()=>{
 for(const [key,name] of [['av12','Carbon'],['furari-488','M_Rim_Main_SetPT_Max.002'],['mp1x','rims'],['jaguarxkjss','crbnfibre']])assert.ok(isModelRim(key,'keep|'+name));
 for(const name of ['Tires','Brake_disk','Wheel_Screw','Rim_Badge','tyre_blk'])for(const key of ['av12','furari-488','mp1x','jaguarxkjss'])assert.equal(isModelRim(key,'keep|'+name),false);
});
test('frame-time reports use percentile samples, rejecting invalid data',()=>{
 assert.deepEqual(summarizeFrames([1,2,3,4,100]),{frames:5,meanMs:22,p50Ms:3,p95Ms:100});assert.throws(()=>summarizeFrames([]));
});
class Param {constructor(value=0){this.value=value;}setTargetAtTime(value){this.value=value;}}
class AudioNode {
 constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.delayTime=new Param();this.playbackRate=new Param();this.connections=[];}
 connect(node){this.connections.push(node);return node;}disconnect(){this.connections=[];}start(){this.started=true;}stop(){this.stopped=true;}
}
class AudioContext {
 constructor(){this.currentTime=0;this.sampleRate=1000;}
 createGain(){return new AudioNode();}createBiquadFilter(){return new AudioNode();}createWaveShaper(){return new AudioNode();}createDelay(){return new AudioNode();}createBufferSource(){return new AudioNode();}createOscillator(){return new AudioNode();}
 createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
}
test('PA filters speech to 300–3500Hz and has a stable quiet slapback',()=>{
 const ctx=new AudioContext(),output=new AudioNode(),pa=createPA(ctx,output),[high,low,drive,dry,delay,wet,feedback]=pa.nodes;
 assert.equal(high.frequency.value,300);assert.equal(low.frequency.value,3500);assert.equal(delay.delayTime.value,.095);
 assert.ok(feedback.gain.value<.3&&wet.gain.value<dry.gain.value);assert.equal(drive.curve.length,1024);
 assert.ok(dry.connections.includes(output)&&wet.connections.includes(output));
});
test('EV is silent at rest, quiet under power and fully stopped on car change',async()=>{
 const a=new GameAudio();a.ctx=new AudioContext();a.bus={engine:new AudioNode(),effects:new AudioNode()};a.ready=true;
 a.buffer=()=>{throw Error('EV must not load an engine recording');};
 await a.engineFor('ev-test');assert.equal(a.engine.ev,true);const e=a.engine;
 a.engineUpdate(0,0,1,0);assert.equal(e.road.motorGain.gain.value,0);
 a.engineUpdate(9000,1,1,40);assert.ok(e.road.motorGain.gain.value>0&&e.road.motorGain.gain.value<.025);
 a.engineUpdate(0,0,0);assert.equal(e.road.wind.gain.gain.value,0);a.engineOff();assert.ok(e.road.sources.every(s=>s.stopped));
});
test('an old engine load cannot replace the new EV after a rapid car swap',async()=>{
 const a=new GameAudio();a.ctx=new AudioContext();a.bus={engine:new AudioNode(),effects:new AudioNode()};a.ready=true;
 a.engineBank={profiles:{mp1x:{loops:{idle:{file:'engines/recorded/mp1x-idle.ogg',rpm:1000}}}}};let resolve,stopped=false;
 a.loop=()=>new Promise(r=>resolve=()=>r({stop(){stopped=true;}}));
 const first=a.engineFor('mp1x');await a.engineFor('ev-test');resolve();await first;
 assert.equal(a.engine.ev,true);assert.ok(stopped);a.engineOff();
});

test('missing real recordings never restore the generated V1 engine or exhaust',async()=>{
 const a=new GameAudio();a.ctx=new AudioContext();a.bus={engine:new AudioNode(),effects:new AudioNode()};a.ready=true;
 a.manifest={engineProfiles:{'v8-flatplane':{loops:{idle:{file:'engines/legacy.ogg',rpm:1000}}}}};
 a.loop=()=>{throw Error('Legacy recording requested');};a.play=()=>{throw Error('Generated exhaust or boost requested');};
 await a.engineFor('mp1x');assert.deepEqual(a.engine.layers,{});
 a.pop();a.shift();await a.nitro(true);await a.nitro(false);a.engineOff();
});

test('real engine pitch follows RPM across reference gaps, shifts and mute',async()=>{
 const a=new GameAudio();a.ctx=new AudioContext();a.bus={engine:new AudioNode(),effects:new AudioNode()};a.ready=true;
 a.engineBank={profiles:{mp1x:{redline:8500,loops:{idle:{file:'idle.ogg',rpm:1000},low:{file:'low.ogg',rpm:2400},mid:{file:'mid.ogg',rpm:4800},high:{file:'high.ogg',rpm:7000},decel:{file:'decel.ogg',rpm:4000}}}}};
 a.loop=async()=>({src:new AudioNode(),gain:new AudioNode(),stop(){}});
 await a.engineFor('mp1x');a.engineUpdate(3600,1);
 const L=a.engine.layers;
 assert.equal(L.low.h.src.playbackRate.value,1.5);assert.equal(L.mid.h.src.playbackRate.value,.75);
 const before=L.low.h.gain.gain.value;a.shift();a.engineUpdate(3600,1);assert.ok(L.low.h.gain.gain.value<before);
 a.ctx.currentTime=1;a.engineUpdate(3600,0);assert.ok(L.decel.h.gain.gain.value>0);
 a.engineUpdate(3600,1,0);for(const l of Object.values(L))assert.equal(l.h.gain.gain.value,0);
 a.engineOff();
});

test('engine selection waits for the bank and cancellation during initialization wins',async()=>{
 const a=new GameAudio();a.ctx=new AudioContext();a.bus={engine:new AudioNode(),effects:new AudioNode()};
 let finish;a.initializing=new Promise(r=>finish=r);
 const first=a.engineFor('mp1x');a.engineOff();
 a.ready=true;finish();await first;assert.ok(!a.engine);
 await a.engineFor('ev-test');assert.equal(a.engine.ev,true);a.engineOff();
});
