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
  const {components,checkSpec,texLamp,tailRule}=await server.ssrLoadModule('/src/carkit/taillights.js');
  // every per-car spec (src/carkit/tails/<key>.js) is well formed and names a car the garage offers
  const {TAIL_SPECS}=await server.ssrLoadModule('/src/carkit/lamps.js'),{KEYS}=await server.ssrLoadModule('/src/cars.js');
  assert(TAIL_SPECS.av12,'AV-12 keeps its tail spec');
  for(const [k,s] of Object.entries(TAIL_SPECS)){assert.deepEqual(checkSpec(s),[],`tails/${k}.js`);assert(KEYS.includes(k),`tails/${k}.js names no garage car`);}
  assert.deepEqual(checkSpec({tail:[{part:'glide'}],lens:{minx:1}}),['tail[0].part: glide','lens.minx: unknown key'],'A spec typo is reported');
  // a rule matches when all its keys do: material (the model's own name), box (component centre, |z|), minTris
  const rule=(spec,s,name)=>tailRule(spec,{tris:10,centre:new THREE.Vector3(...s)},name)?.part;
  const spec={tail:[{material:/brake_1/,part:'fill'},{box:[[2,0.4,0.3],[2.2,0.5,0.4]],part:'reverse'},{minTris:50,part:'guide'},{part:'off'}]};
  assert.equal(rule(spec,[2.1,0.45,-0.35],'tail|brake_1'),'fill');assert.equal(rule(spec,[2.1,0.45,-0.35],'tail|x'),'reverse');assert.equal(rule(spec,[2.1,0.7,0.6],'tail|x'),'off');
  assert.equal(rule({},[0,0,0],''),'guide','No rules: every element is a combined running/brake guide');
  // a `tex` lamp texel: red lights (by brightness), amber stays dark, white lights only as a reverse lamp
  assert(texLamp(.8,.02,.01).lamp>.99&&texLamp(.02,.002,.001).lamp<.01&&texLamp(1,.4,0).lamp===0&&texLamp(.9,.9,.9).white===0&&texLamp(.9,.9,.9,{white:[.3,.6]}).white>.99,'Texture lamp classes');
  const quad=x=>[x,0,0,x+.1,0,0,x+.1,.1,0,x,.1,0],g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([...quad(0),...quad(.5)],3));g.setIndex([0,1,2,0,2,3,4,5,6,4,6,7]);
  const parts=components(g.attributes.position,g.index);
  assert.deepEqual([...parts.tri],[0,0,1,1]);assert.deepEqual(parts.list.map(s=>s.tris),[2,2]);
  assert(Math.abs(parts.list[1].centre.x-.55)<1e-6&&Math.abs(parts.list[0].area-.01)<1e-6,'Element centre and area');
  console.log('PASS: grid release, stationary foot brake, brightening and brake release, lamp elements, tail specs and rules.');
}finally{await server.close();}
