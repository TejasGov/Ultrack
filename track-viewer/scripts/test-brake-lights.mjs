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
  // the opt-in rule and spec keys, on a mock car through fitTail: quads in the car frame (+x the tail), a quad facing back (+x) or forward
  const {fitTail}=await server.ssrLoadModule('/src/carkit/taillights.js');
  const quads=(qs)=>{const p=[],ix=[];for(const [x,y,z,s=.02,dir=1] of qs){const b=p.length/3;p.push(x,y-s,z-s,x,y+s,z-s,x,y+s,z+s,x,y-s,z+s);ix.push(...(dir>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).map(i=>b+i));}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;};
  const mock=(spec,build)=>{const m={taillight:new THREE.MeshStandardMaterial(),brakeLight:new THREE.MeshStandardMaterial(),reverseLight:new THREE.MeshStandardMaterial({color:0xffffff}),rearLens:new THREE.MeshPhysicalMaterial({transparent:true,opacity:.28})};
    const l0=new THREE.Group(),kit=new THREE.Group(),body=new THREE.Group();body.add(l0);
    const add=(parent,g,mat,name,src)=>{const o=new THREE.Mesh(g,mat);o.name=name;if(src)o.srcMaterial=src;parent.add(o);return o;};build({m,l0,kit,add});
    const c={key:'mock',materials:m,body,shadow:new THREE.Group(),hero:false,lod:{levels:[{object:l0}],position:new THREE.Vector3()},lamps:{root:kit}};c.tail=fitTail(c,spec);return {c,m,l0,kit};};
  const tailMesh=(qs)=>({m,l0,add})=>add(l0,quads(qs),m.taillight,'t',new THREE.MeshStandardMaterial({name:'tail|x'}));
  const lampAt=(o,i)=>[o.geometry.attributes.aLamp.getX(i),o.geometry.attributes.aLamp.getY(i)];
  const A1=[[2,.5,.5]],A2=[[2,.7,.5]],box1=[[1.9,.45,.4],[2.1,.55,.6]];
  {const {l0}=mock({tail:[{box:box1,part:'fill',tex:false},{part:'guide'}]},tailMesh([...A1,...A2]));const o=l0.children[0];
    assert.deepEqual([lampAt(o,0),lampAt(o,4)],[[0,2],[1,0]],'tex: false writes aLamp + 1 (lit whatever its texels), the rest as before');}
  {const {l0}=mock({tail:[{box:box1,part:'guide',flip:true},{part:'guide'}]},tailMesh([[2,.5,.5,.02,-1],[2,.7,.5,.02,-1]])),g=l0.children[0].geometry,n=new THREE.Triangle().setFromAttributeAndIndices(g.attributes.position,...g.index.array.slice(0,3)).getNormal(new THREE.Vector3());
    assert(n.x>.99&&g.attributes.normal.getX(0)>.99,'flip: a forward-facing element turns to face back');
    const n2=new THREE.Triangle().setFromAttributeAndIndices(g.attributes.position,...g.index.array.slice(6,9)).getNormal(new THREE.Vector3());assert(n2.x<-.99&&g.attributes.normal.getX(4)<-.99,'flip touches only its own element');}
  {const {l0}=mock({tail:[{part:'guide'}],adopt:{material:/^keep\|L$/,box:[[1.9,.45,.4],[2.1,.55,.6]]}},({l0,add})=>add(l0,quads([...A1,[2,.5,.1]]),new THREE.MeshStandardMaterial({name:'keep|L'}),'k'));
    const ad=l0.children.find(o=>o.name==='tail-adopted');assert(ad&&ad.geometry.index.count===6&&l0.children[0].geometry.index.count===6,'adopt.box: only the triangles inside the box join the lamp');}
  for(const [color,hex] of [[0x333333,0x333333],[undefined,0xffffff]]){const {l0}=mock({tail:[{box:box1,part:'reverse'},{part:'guide'}],...(color?{reverse:{color}}:{})},tailMesh([...A1,...A2]));
    assert.equal(l0.children.find(o=>o.name==='tail-reverse').material.color.getHex(),hex,'reverse.color: the unlit reverse part takes it (else the white reverse material)');}
  assert.deepEqual(checkSpec({reverse:{color:0x333333}}),[],'reverse: { color } alone is a spec');
  const strip=Array.from({length:12},(_,i)=>[2,.5,.225+.05*i,.025]);
  assert.equal(mock({tail:[{part:'guide'}]},tailMesh(strip)).c.tail.items.length,1,'Without glowAlong a long element keeps one glow point');
  {const it=mock({tail:[{part:'guide',glowAlong:true}]},tailMesh(strip)).c.tail.items;assert(it.length>=10&&it.every(i=>Math.abs(i.s-.4*.05)<1e-6),'glowAlong: points along a long element, sized 0.4 x its middle side');}
  {const L=({m,l0,add})=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([2,.48,.4,2,.52,.4,2,.52,.6,2,.48,.6,1.9,.52,.4,1.9,.52,.6],3));g.setIndex([0,1,2,0,2,3,1,4,5,1,5,2]);g.computeVertexNormals();add(l0,g,m.taillight,'t',new THREE.MeshStandardMaterial({name:'tail|x'}));};
    const o=mock({tail:[{part:'guide',facing:[[1,0,0],.5]},{part:'off'}]},L).l0.children[0];
    assert.deepEqual([0,3,6,9].map(t=>lampAt(o,t)[0]),[1,1,0,0],'facing: only the triangles facing back light, the element\'s top stays dark');
    assert.equal(mock({tail:[{part:'guide'}]},L).l0.children[0].geometry.attributes.aLamp.getX(4),1,'Without facing the whole element lights');}
  // a car-lab bowl as cars.js's merge leaves it: no name, de-indexed, a fan of housing triangles round the lamp's centre, both faces
  const fan=()=>{const p=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+1)/8*Math.PI*2;p.push(2,.6,.6,2,.6+.05*Math.cos(a),.6+.1*Math.sin(a),2,.6+.05*Math.cos(b),.6+.1*Math.sin(b));}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;};
  for(const [bowl,shape,want] of [[true,fan,true],[false,fan,false],[true,()=>quads(A1).toNonIndexed(),false]]){const {c,kit}=mock({...(bowl?{bowl}:{}),tail:[{part:'guide'}]},({m,kit,add})=>{m.lampHousing=new THREE.MeshStandardMaterial({color:0x111111});const h=m.lampHousing.clone();h.side=THREE.DoubleSide;add(kit,shape(),h,'');});const o=kit.children[0];
    assert.equal(o.material.customProgramCacheKey?.()==='tail-lamp'&&lampAt(o,0)[1]===1,want,'bowl: a closed lamp\'s bowl (a housing fan) fills on the brake only when asked, nothing else of the housing');
    if(want)assert.equal(c.tail.items.length,0,'A bowl adds no glow point (a blob over the whole lamp)');}
  assert.deepEqual(checkSpec({tail:[{part:'guide',facing:[1,0,0],tex:true}]}),['tail[0].facing: not [[x, y, z], min]','tail[0].tex: only false'],'Malformed facing / tex reported');
  console.log('PASS: grid release, stationary foot brake, brightening and brake release, lamp elements, tail specs and rules, the opt-in keys.');
}finally{await server.close();}
