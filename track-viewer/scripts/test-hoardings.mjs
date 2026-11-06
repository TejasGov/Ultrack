import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {Game}=await server.ssrLoadModule('/src/game/game.js');
 const {DriverHoardings,racingPosters,hoardingPose}=await server.ssrLoadModule('/src/driver-hoardings.js');
 const {PhysicsWorld}=await server.ssrLoadModule('/src/physics/world.js');
 const track=JSON.parse(readFileSync(new URL('../../tracks/marina/out/track.json',import.meta.url)));
 const teams=JSON.parse(readFileSync(new URL('../../assets/teams/teams.json',import.meta.url))).teams;
 const noPoster=new Set();for(const car of teams.flatMap(t=>t.cars)){
  const keys=Game.prototype.racersFor(car.key,true),posters=racingPosters(keys);
  assert.equal(posters.length,teams.length);assert.equal(new Set(posters.map(p=>p.team)).size,teams.length);assert.equal(posters[0].driver,car.driver.name);
  for(const [i,p] of posters.entries()){
   const poster=new URL('../public'+p.url,import.meta.url);if(existsSync(poster))assert(statSync(poster).size>0);else noPoster.add(p.url);   // no poster yet: the game puts up no board (asserted below)
   const pose=hoardingPose(track,i,teams.length),center=track.centerline[pose.index];
   assert(Math.hypot(pose.position.x-center[0],pose.position.z-center[2])>track.halfWidth[pose.index]+4);
  }
 }
 if(noPoster.size)console.warn('Drivers with no poster yet (no board goes up):',[...noPoster].join(', '));
 const scene=new THREE.Scene(),boards=new DriverHoardings(scene),requests=[];
 boards.loader.loadAsync=async url=>{requests.push(url);return new THREE.Texture();};
 const keys=Game.prototype.racersFor('porsche1',true);
 await boards.set(keys,track);assert.equal(boards.entries.length,teams.length);assert.equal(boards.root.children.length,teams.length);assert.equal(requests.length,teams.length);
 await boards.set(keys,track);assert.equal(requests.length,teams.length,'Repeat race reuses textures');
 boards.clear();assert.equal(boards.root.children.length,0);
 let finishTexture;boards.textures.clear();boards.loader.loadAsync=()=>new Promise(resolve=>{finishTexture=resolve;});
 const pending=boards.set([keys[0]],track);boards.clear();finishTexture(new THREE.Texture());await pending;assert.equal(boards.root.children.length,0,'Cancelled race cannot restore stale boards');
 const warn=console.warn,missing=racingPosters([keys[1]])[0].url;console.warn=()=>{};boards.textures.clear();requests.length=0;
 boards.loader.loadAsync=async url=>{requests.push(url);if(url===missing)throw Error('missing');return new THREE.Texture();};
 await boards.set(keys,track);await boards.set(keys,track);console.warn=warn;assert.equal(requests.length,teams.length,'A missing poster is not refetched every race');
 assert.equal(boards.root.children.length,teams.length-1,'A missing poster puts up no blank board');assert(!boards.entries.some(e=>e.url===missing));
 boards.root.children.forEach((board,i)=>assert(board.position.distanceTo(hoardingPose(track,i,teams.length-1).position)<1e-6,'The remaining boards stay evenly spaced'));
 const originalCreate=PhysicsWorld.create;PhysicsWorld.create=async()=>({dispose(){}});
 const points=[new THREE.Vector3(),new THREE.Vector3(100,0,0),new THREE.Vector3(100,0,100),new THREE.Vector3(0,0,100)];
 const field={all:[],N:4,length:400,linePts:points,configure({hero,racers}){this.cars=racers.map(key=>({key,hero:key===hero}));this.all=this.cars;this.hero=this.cars[0];},enablePhysics(){this.input={clear(){},setEnabled(){}};this.cars.forEach(car=>{car.vehicle={cur:{pos:points[0].clone()}};});}};
 let finishGraphics,selected;
 const game=Object.assign(Object.create(Game.prototype),{field,ctx:{params:{},newTrails(){},setDriverHoardings:async keys=>{selected=keys;},prepareRaceRenderer:()=>new Promise(resolve=>{finishGraphics=resolve;})},screen:{},ensureVehicles:async()=>{},hideScreens(){this.screen=null;},cameraFor(){},say(){},setBusy(){},hud:{show(){},reset(){},goals(){}},audio:{engineOff(){},nitro(){},engineFor:async()=>{},commentary:{stop(){},setTags(){}}}});
 const start=game.startSession('race');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(game.session,null);assert.equal(selected.length,teams.length);assert.equal(game.driverIntro,undefined);
 finishGraphics();await start;assert.equal(game.session.t,0);assert.equal(game.session.state,'grid');game.endSession();
 let cancel,finishCars,disposed=0;
 PhysicsWorld.create=async()=>({dispose(){disposed++;}});
 game.raceLoading={async open(options){cancel=options.onCancel;},close(){},complete(){}};
 game.ctx.prepareRaceRenderer=async()=>{};
 game.ensureVehicles=()=>new Promise(resolve=>{finishCars=resolve;});
 game.lineup=()=>{};game.show=()=>{game.screen={};};game.screen={};
 const abandoned=game.startSession('race');await new Promise(resolve=>setImmediate(resolve));cancel();finishCars();await abandoned;
 assert.equal(game.session,null);assert.equal(disposed,1,'Cancellation releases its prepared world');
 game.ensureVehicles=async()=>{};game.screen={};await game.startSession('free');assert.deepEqual(selected,[],'Non-race sessions show no driver boards');game.endSession();
 PhysicsWorld.create=originalCreate;
 console.log('PASS: all 14 lineups, only seven current drivers, roadside placement, texture reuse, cancellation and direct loading-to-grid start without intros.');
}finally{await server.close();}
