import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const {Field}=await server.ssrLoadModule('/src/cars.js');
  const {setLamps}=await server.ssrLoadModule('/src/carkit/lamps.js');
  const materials=Object.fromEntries(['taillight','brakeLight','headlight','projector','highProjector','reverseLight'].map(k=>[k,{emissiveIntensity:1,emissive:new THREE.Color()}]));
  const car={root:new THREE.Group(),car:new THREE.Group(),onGrid:true,wheels:[],materials,lamps:{update(){}}};
  car.vehicle={pose(){},yaw:0,speed:0,vForward:0,controls:{brake:1},curvature:0,wheels:[],latSlip:0,spinSlip:0,aBody:{x:0,z:0},state:{nitroOn:false},onGround:true};
  const field={cars:[car],pw:{advance(){return .5;}},hold:false,dynamics(){}};
  Field.prototype.drivePhysics.call(field,1/60);
  assert.equal(car.onGrid,false,'Leaving the starting hold must release the grid lamp override');
  assert.equal(car.brake,1,'Foot brake remains visible at a standstill, not only above 1 m/s');
  setLamps(car,'running',car.onGrid?0:car.brake);const braking=materials.taillight.emissiveIntensity;
  assert(materials.brakeLight.emissiveIntensity>0);
  car.vehicle.controls.brake=0;Field.prototype.drivePhysics.call(field,1/60);setLamps(car,'running',car.brake);
  assert(braking>materials.taillight.emissiveIntensity*10,'Brake application visibly brightens the tail lamps');
  assert.equal(materials.brakeLight.emissiveIntensity,0,'Brake release turns off dedicated stop lamps');
  field.hold=true;Field.prototype.drivePhysics.call(field,1/60);assert.equal(car.onGrid,true);
  field.hold=false;
  car.vehicle.state.serviceBrake=1;car.vehicle.state.reverse=true;car.vehicle.controls.brake=0;
  Field.prototype.drivePhysics.call(field,1/60);
  assert.equal(car.brake,1,'W lights the stop lamps when braking backwards');
  let lampInput;car.lamps.update=input=>{lampInput=input;};
  setLamps(car,'running',car.brake);assert.equal(lampInput.reverse,true);
  car.vehicle.state.serviceBrake=0;car.vehicle.controls.brake=1;
  Field.prototype.drivePhysics.call(field,1/60);setLamps(car,'running',car.brake);
  assert.equal(materials.brakeLight.emissiveIntensity,0,'S driving backwards is not service braking');
  // taillights.js splits a lamp mesh into its elements by connected component: two separate quads are two elements
  const {components}=await server.ssrLoadModule('/src/carkit/taillights.js');
  const quad=x=>[x,0,0,x+.1,0,0,x+.1,.1,0,x,.1,0],g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([...quad(0),...quad(.5)],3));g.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);
  const parts=components(g.attributes.position,g.index);
  assert.deepEqual([...parts.tri],[0,0,1,1]);assert.deepEqual(parts.list.map(s=>s.tris),[2,2]);
  assert(Math.abs(parts.list[1].centre.x-.55)<1e-6&&Math.abs(parts.list[0].area-.01)<1e-6,'Element centre and area');
  console.log('PASS: grid release, stationary foot brake, brightening and brake release, lamp elements.');
}finally{await server.close();}
