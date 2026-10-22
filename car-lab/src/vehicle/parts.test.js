import { createExhaust } from './exhaust.js';
import { createJaguarDetails } from './jaguar-details.js';
import { normalizeShell } from './body.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createNuvolariDetails } from './nuvolari-details.js';
import { createCoachwork } from './coachwork.js';
import { createRearFascia } from './rear-fascia.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createVehicleMaterials } from './materials.js';
import { createWheelSet, createMirrors, createGlass, disposeParts } from './parts.js';
import { validateProfile } from './validation.js';
import { createVehicleLights } from './lights.js';
const profile=JSON.parse(fs.readFileSync(new URL('./profiles/av12.json',import.meta.url),'utf8'));
const mclaren=JSON.parse(fs.readFileSync(new URL('./fixtures/mp1x-legacy.json',import.meta.url),'utf8'));

test('four named wheel pivots sit on the ground and share per-axle resources',()=>{
  const m=createVehicleMaterials(),set=createWheelSet(validateProfile(profile),m,'split');set.root.updateMatrixWorld(true);
  assert.deepEqual(set.wheels.map(w=>w.pivot.name),['wheel_FL','wheel_FR','wheel_RL','wheel_RR']);
  for(const w of set.wheels){const box=new THREE.Box3().setFromObject(w.pivot);assert.ok(Math.abs(box.min.y)<.003,`${w.pivot.name} ground contact ${box.min.y}`);assert.ok(box.max.y>2*w.spec.radius-.003);}
  assert.equal(set.wheels[0].spin.children[0].geometry,set.wheels[1].spin.children[0].geometry);
  assert.ok(set.wheels.every(w=>w.pivot.getObjectByName(`${w.pivot.name}_calipers`).parent===w.pivot));
  assert.equal(set.wheels[0].pivot.position.z,-set.wheels[1].pivot.position.z);
  disposeParts(set.root);
});
test('body paint changes cannot recolor rubber, rims or glass',()=>{
  const m=createVehicleMaterials(),before=[m.rubber,m.rim,m.glass].map(x=>x.color.getHex());
  m.setPaint({color:'#1358b8',finish:'metallic',livery:'twin'});
  assert.equal(m.body.color.getHexString(),'1358b8');assert.equal(m.mirrorPaint.color.getHexString(),'1358b8');
  assert.deepEqual([m.rubber,m.rim,m.glass].map(x=>x.color.getHex()),before);
});
test('glass and mirror assemblies are separate and symmetric',()=>{
  const m=createVehicleMaterials(),glass=createGlass(profile,m),mirrors=createMirrors(profile,m);
  assert.equal(glass.children.filter(x=>x.name!=='cabin-dark-insert').length,6);
  const left=mirrors.getObjectByName('mirror-housing-1'),right=mirrors.getObjectByName('mirror-housing--1');
  assert.equal(left.position.x,right.position.x);assert.equal(left.position.y,right.position.y);assert.equal(left.position.z,-right.position.z);
  assert.equal(left.material,m.trim);assert.notEqual(glass.children[0].material,m.body);
  disposeParts(glass);disposeParts(mirrors);
});
test('a profile with inverted axles is rejected before assembly',()=>{
  const bad=structuredClone(profile);bad.wheels.front.x=1.6;
  assert.throws(()=>validateProfile(bad),/Axles|envelope/);
});

test('headlight modes switch surface illumination independently of running lights',()=>{
  const m=createVehicleMaterials(),lights=createVehicleLights(profile,m);
  const beams=[];lights.root.traverse(o=>{if(o.isSpotLight)beams.push(o);});
  assert.equal(beams.length,2);
  lights.update({mode:'running'});
  assert.ok(m.headlight.emissiveIntensity>0);assert.equal(m.projector.emissiveIntensity,0);
  assert.ok(beams.every(b=>!b.visible&&b.intensity===0));
  lights.update({mode:'low'});const low=beams[0].intensity;
  lights.root.updateMatrixWorld(true);
  for(const b of beams){assert.ok(b.visible&&b.intensity>0);const target=b.target.getWorldPosition(new THREE.Vector3());assert.ok(target.x<b.position.x-10);assert.ok(Math.abs(target.y)<.001);}
  lights.update({mode:'high'});assert.ok(beams.every(b=>b.intensity>low));
  lights.update({mode:'off'});assert.equal(m.headlight.emissiveIntensity,0);assert.ok(beams.every(b=>!b.visible));
  disposeParts(lights.root);
});

test('braking and reverse remain visible with headlights off; paint cannot recolor optics',()=>{
  const m=createVehicleMaterials(),lights=createVehicleLights(profile,m);
  lights.update({mode:'low',brake:0,reverse:false});const tail=m.taillight.emissiveIntensity;
  lights.update({mode:'off',brake:1,reverse:true});
  assert.ok(m.taillight.emissiveIntensity>tail*4);assert.ok(m.brakeLight.emissiveIntensity>0);assert.ok(m.reverseLight.emissiveIntensity>0);
  const colors=[m.headlight,m.taillight,m.projector,m.brakeLight,m.reverseLight].map(o=>o.emissive.getHex());
  m.setPaint({color:'#1358b8',finish:'matte'});
  assert.deepEqual([m.headlight,m.taillight,m.projector,m.brakeLight,m.reverseLight].map(o=>o.emissive.getHex()),colors);
  assert.equal(lights.update({brake:9}).brake,1);assert.equal(lights.update({brake:-1}).brake,0);
  lights.update({brake:0,reverse:false});assert.equal(m.taillight.emissiveIntensity,0);assert.equal(m.brakeLight.emissiveIntensity,0);assert.equal(m.reverseLight.emissiveIntensity,0);
  disposeParts(lights.root);
});

test('McLaren reuses the factories with its own ground contact and attachment anchors',()=>{
  validateProfile(mclaren);
  const m=createVehicleMaterials(),wheels=createWheelSet(mclaren,m,'turbine'),glass=createGlass(mclaren,m),mirrors=createMirrors(mclaren,m),lamps=createVehicleLights(mclaren,m);
  wheels.root.updateMatrixWorld(true);
  assert.equal(wheels.wheels.length,4);
  for(const wheel of wheels.wheels){assert.ok(Math.abs(new THREE.Box3().setFromObject(wheel.pivot).min.y)<.003);assert.equal(wheel.pivot.position.x,mclaren.wheels[wheel.axle].x);}
  assert.notEqual(wheels.wheels[0].pivot.position.x,profile.wheels.front.x);
  assert.equal(mirrors.getObjectByName('mirror-housing-1').position.x,mclaren.mirrors.center[0]);
  assert.equal(glass.getObjectByName('windshield').geometry.attributes.position.count,169);
  lamps.update({mode:'off',brake:1,reverse:true});assert.ok(m.brakeLight.emissiveIntensity>0);assert.ok(m.reverseLight.emissiveIntensity>0);
  const projector=lamps.root.getObjectByName('projector-core-1');assert.ok(projector.position.distanceTo(new THREE.Vector3(...mclaren.lights.projector))<.04);
  for(const root of [wheels.root,glass,mirrors,lamps.root])disposeParts(root);
});

test('derived shell keeps its donor coordinate frame after tire removal',async()=>{
  const { normalizeShell }=await import('./body.js');
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(4.6,.8,1.8));mesh.geometry.translate(0,.6,0);
  const fixture={...mclaren,body:{...mclaren.body,lift:0,normalizationBounds:[[-2.3,0,-1],[2.3,1.2,1]]}};
  const shell=normalizeShell(mesh,fixture,createVehicleMaterials().body);
  const box=new THREE.Box3().setFromObject(shell.root);
  assert.ok(Math.abs(box.min.y-.2)<1e-6,'The shell must not be dropped to the floor after extraction.');
  assert.ok(Math.abs(box.getSize(new THREE.Vector3()).x-4.6)<1e-6);
  disposeParts(shell.root);mesh.geometry.dispose();
});

test('McLaren optical modules span the measured cavity rims on both sides',()=>{
  validateProfile(mclaren);
  const m=createVehicleMaterials(),lamps=createVehicleLights(mclaren,m);
  for(const name of ['front','rear']){
    const fit=mclaren.lights[name+'Recess'],direction=fit.direction??1;
    for(const side of ['1','-1']){
      for(let row=0;row<fit.rows;row++){
        const sample=fit.sides[side].slice(row*fit.columns,(row+1)*fit.columns).map(p=>p[0]*direction);
        assert.ok(fit.capX[side][row]*direction>=Math.max(...sample)-1e-6,'Lens must span the rim instead of following a deep cavity fold.');
      }
      const core=lamps.root.getObjectByName(`${name}-led-${side}`),lens=lamps.root.getObjectByName(`${name}-lens-${side}`),walls=lamps.root.getObjectByName(`${name}-housing-walls-${side}`);
      assert.ok(core?.geometry.attributes.position.count>0&&lens&&walls);
      assert.ok([...core.geometry.attributes.position.array].every(Number.isFinite));
      assert.equal(core.material,name==='rear'?m.taillight:m.headlight);
      lamps.root.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(core);
      if(name==='front')assert.ok(box.max.y<.65&&box.min.y>.49,'Headlight signatures must stay in the low front slots, below the fender peaks.');
      else assert.ok(box.max.y>.80,'Rear signature must follow the raised outer recess lip.');
    }
  }
  assert.equal(lamps.root.getObjectByName('frontBranch-led-1'),undefined,'A fitted front module replaces the old floating branch.');
  const frontFit=mclaren.lights.frontRecess;
  for(const side of ['1','-1']){
    const cap=frontFit.capX[side].filter((_,row)=>Math.abs(Math.abs(frontFit.sides[side][row*frontFit.columns+3][2])-mclaren.lights.projector[2])<.035);
    assert.ok(lamps.root.getObjectByName(`headlight-beam-${side}`).position.x<Math.min(...cap)-.03,'Beam origin must clear the lens aperture instead of illuminating the housing from inside.');
  }
  lamps.root.updateMatrixWorld(true);
  const stop=new THREE.Box3().setFromObject(lamps.root.getObjectByName('center-stop-led')).getCenter(new THREE.Vector3());
  assert.ok(stop.y>.98&&stop.x<1.1,'Center stop lamp must sit on the rear glass, above the bumper badge recess.');
  disposeParts(lamps.root);
});

test('cavity optics cannot be silently reused on a different shell',()=>{
  const bad=structuredClone(mclaren);bad.lights.rearRecess.sourceSha256='0'.repeat(64);
  assert.throws(()=>validateProfile(bad),/different shell/);
  assert.throws(()=>createVehicleLights(bad,createVehicleMaterials()),/different shell/);
});
for(const key of ['mustang','porsche1','aston-martin-valk','buggati','bentley-gt','bmw1','jaguarxkjss','nuvolari','tesla1','furari-488'])test(key+' assembles with source-pinned optics and independent running/brake/reverse states',()=>{
  const p=validateProfile(JSON.parse(fs.readFileSync(new URL((['mp1x','jaguarxkjss','nuvolari'].includes(key)?'./fixtures/'+key+'-legacy.json':'./profiles/'+key+'.json'),import.meta.url),'utf8')));
  const m=createVehicleMaterials(),set=createWheelSet(p,m,'split'),glass=createGlass(p,m),lights=createVehicleLights(p,m);
  set.root.updateMatrixWorld(true);
  for(const w of set.wheels)assert.ok(Math.abs(new THREE.Box3().setFromObject(w.pivot).min.y)<.003);
  for(const part of ['front','rear'])for(const [i,fit] of p.lights[part+'Fits'].entries()){
    if(part==='front'&&p.lights.headlamp.type==='enclosed')continue;
    for(const side of ['1','-1']){
      const core=lights.root.getObjectByName(part+'-'+i+'-led-'+side);
      assert.ok(core&&[...core.geometry.attributes.position.array].every(Number.isFinite));
      assert.equal(core.material,part==='front'?m.headlight:m.taillight);
      for(let row=0;row<fit.rows;row++){
        const rim=fit.sides[side].slice(row*fit.columns,(row+1)*fit.columns).map(v=>v[0]*fit.direction);
        assert.ok(fit.capX[side][row]*fit.direction>=Math.max(...rim)-1e-6);
      }
      if(fit.closed)assert.ok(lights.root.getObjectByName(part+'-'+i+'-bowl-'+side));
    }
  }
  for(const side of ['1','-1']){
    const lamp=lights.root.getObjectByName('headlamp-assembly-'+side);
    assert.equal(lamp.userData.type,'enclosed');
    assert.ok(lamp.getObjectByName('headlamp-backplate')&&lamp.getObjectByName('headlamp-cavity-walls'));
    const cover=lamp.getObjectByName('headlamp-full-cover');
    const size=new THREE.Box3().setFromObject(cover).getSize(new THREE.Vector3());
    assert.ok(size.z>.15&&size.y>.075,'The clear cover must span the whole aperture.');
    assert.equal(lamp.children.filter(c=>c.name.startsWith('headlamp-optic-')).length,p.lights.headlamp.optics.length);
    assert.ok([...cover.geometry.attributes.position.array].every(Number.isFinite));
    assert.equal(lights.root.getObjectByName('front-0-led-'+side),undefined,'Full lamps replace the perimeter-only signature.');
  }
  lights.update({mode:'low'});assert.equal(m.highProjector.emissiveIntensity,0);assert.ok(m.projector.emissiveIntensity>0);
  lights.update({mode:'high'});assert.ok(m.highProjector.emissiveIntensity>0);
  lights.update({mode:'running',brake:0,reverse:false});assert.equal(m.projector.emissiveIntensity,0);const running=m.taillight.emissiveIntensity;
  lights.update({mode:'off',brake:1,reverse:true});assert.ok(m.taillight.emissiveIntensity>running*4&&m.reverseLight.emissiveIntensity>0);
  const tailColor=m.taillight.emissive.getHex();m.setPaint({color:'#ffffff',finish:'matte',livery:'twin'});assert.equal(m.taillight.emissive.getHex(),tailColor);
  const bad=structuredClone(p);bad.lights.frontFits[0].sourceSha256='0'.repeat(64);assert.throws(()=>validateProfile(bad),/different shell/);
  const wrongAperture=structuredClone(p);wrongAperture.lights.headlamp.aperture.sourceSha256='0'.repeat(64);assert.throws(()=>validateProfile(wrongAperture),/different shell/);
  assert.ok([...glass.getObjectByName('windshield').geometry.attributes.position.array].every(Number.isFinite));
  for(const root of [set.root,glass,lights.root])disposeParts(root);
});

test('a future car must declare its headlamp design before assembly',()=>{
  const missing=structuredClone(profile);delete missing.lights.headlamp;
  assert.throws(()=>validateProfile(missing),/concept-specific headlamp design/);
});
test('measured mirror feet penetrate the shell and both stalk segments connect to the housing',()=>{
  for(const key of ['av12','mp1x','mustang','porsche1','aston-martin-valk','buggati','bentley-gt','bmw1','jaguarxkjss','nuvolari','tesla1']){
    const p=validateProfile(JSON.parse(fs.readFileSync(new URL((['mp1x','jaguarxkjss','nuvolari'].includes(key)?'./fixtures/'+key+'-legacy.json':'./profiles/'+key+'.json'),import.meta.url),'utf8')));
    const mirrors=createMirrors(p,createVehicleMaterials());mirrors.updateMatrixWorld(true);
    for(const sign of [-1,1]){
      const mount=p.mirrors.mounts[String(sign)],surface=p.mirrors.surfaceMounts[String(sign)];
      assert.ok(Math.abs((surface[2]-mount[2])*sign-.018)<1e-5);
      const stalk=new THREE.Box3().setFromObject(mirrors.getObjectByName('mirror-stalk-'+sign));
      const neck=new THREE.Box3().setFromObject(mirrors.getObjectByName('mirror-housing-neck-'+sign));
      const housing=new THREE.Box3().setFromObject(mirrors.getObjectByName('mirror-housing-'+sign));
      assert.ok(stalk.intersectsBox(neck)&&neck.intersectsBox(housing),'No gap is allowed between mirror segments.');
    }
    disposeParts(mirrors);
  }
});


test('Bentley auxiliary lamps are separate enclosed assemblies with independent high beam optics',()=>{
  const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./profiles/bentley-gt.json',import.meta.url),'utf8')));
  const m=createVehicleMaterials(),lights=createVehicleLights(p,m);
  for(const sign of [-1,1]){
    const auxiliary=lights.root.getObjectByName('headlamp-assembly-'+sign+'-aux-0');
    assert.equal(auxiliary.userData.type,'enclosed');
    assert.ok(auxiliary.getObjectByName('headlamp-full-cover'));
    assert.ok(auxiliary.getObjectByName('projector-emitter').material===m.highProjector);
  }
  lights.update({mode:'low'});assert.equal(m.highProjector.emissiveIntensity,0);
  lights.update({mode:'high'});assert.ok(m.highProjector.emissiveIntensity>0);disposeParts(lights.root);
});


test('XKSS rear louver covers the window in rubber independently of paint',()=>{
  const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./fixtures/jaguarxkjss-legacy.json',import.meta.url),'utf8'))),m=createVehicleMaterials(),glass=createGlass(p,m);
  const grille=glass.getObjectByName('rear-window-rubber-louver');assert.ok(grille);
  assert.equal(grille.children.filter(x=>x.name.startsWith('rubber-louver-slat-')).length,6);
  const backing=grille.getObjectByName('louver-dark-backing');const color=backing.material.color.getHex();
  m.setPaint({color:'#ff0000',finish:'gloss',livery:'solid'});assert.equal(backing.material.color.getHex(),color);assert.ok(backing.material.roughness>.9);
  assert.ok([...backing.geometry.attributes.position.array].every(Number.isFinite));disposeParts(glass);
});


test('Roadster rear insert preserves its trim color and rejects a different body fit',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./profiles/tesla1.json',import.meta.url),'utf8')),m=createVehicleMaterials(),rear=createRearFascia(p,m);
 assert.ok(rear.getObjectByName('rear-metallic-graphic-inlay'));
 const insert=rear.getObjectByName('sculpted-rear-insert'),color=insert.material.color.getHex();m.setPaint({color:'#ff0000',finish:'gloss',livery:'solid'});assert.equal(insert.material.color.getHex(),color);
 assert.ok([...insert.geometry.attributes.position.array].every(Number.isFinite));
 const wrong=structuredClone(p);wrong.rearFascia.sourceSha256='0'.repeat(64);assert.throws(()=>createRearFascia(wrong,m),/different shell/);disposeParts(rear);
});


test('Roadster has body-pinned door, hood and hatch gaps and two flush handles',()=>{
 const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./profiles/tesla1.json',import.meta.url),'utf8'))),m=createVehicleMaterials(),details=createCoachwork(p,m);
 for(const name of ['door-left','door-right','hood','hatch']){const gap=details.getObjectByName('panel-gap-'+name);assert.ok(gap);assert.ok([...gap.geometry.attributes.position.array].every(Number.isFinite));}
 assert.equal(details.children.filter(x=>x.name.startsWith('flush-door-handle-')).length,2);
 const gap=details.getObjectByName('panel-gap-door-left'),color=gap.material.color.getHex();m.setPaint({color:'#ff0000',finish:'metallic',livery:'solid'});assert.equal(gap.material.color.getHex(),color);
 const wrong=structuredClone(p);wrong.coachwork.sourceSha256='0'.repeat(64);assert.throws(()=>validateProfile(wrong),/different body/);disposeParts(details);
});


test('Nuvolari has fitted Audi badges and rear trim independent of paint',()=>{
 const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./fixtures/nuvolari-legacy.json',import.meta.url),'utf8'))),m=createVehicleMaterials(),details=createNuvolariDetails(p,m);
 assert.equal(details.children.filter(o=>o.name.includes('audi-rings')).length,8);
 assert.equal(details.children.filter(o=>o.name.startsWith('exhaust-dark-bore')).length,2);
 const insert=details.getObjectByName('rear-diffuser'),color=insert.material.color.getHex();
 m.setPaint({color:'#ff0000',finish:'gloss',livery:'twin'});assert.equal(insert.material.color.getHex(),color);
 details.traverse(o=>{if(o.isMesh)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});
 const wrong=structuredClone(p);wrong.nuvolariDesign.sourceSha256='0'.repeat(64);assert.throws(()=>createNuvolariDetails(wrong,m),/different body/);
 assert.equal(createCoachwork(p,m).children.filter(o=>o.name.startsWith('panel-gap-')).length,4);disposeParts(details);
});


test('Nuvolari grille uses separate trim without changing its triangle count',async()=>{
 const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./fixtures/nuvolari-legacy.json',import.meta.url),'utf8'))),m=createVehicleMaterials();
 const raw=fs.readFileSync(new URL('../../../'+p.body.file,import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
 const shell=normalizeShell(gltf.scene,p,m.body),mesh=shell.root.children[0];
 assert.equal(shell.triangles,p.body.triangles);assert.equal(mesh.material.length,2);
 assert.equal(mesh.geometry.groups.length,2);assert.ok(mesh.geometry.groups[1].count>300);
 assert.equal(mesh.geometry.groups.reduce((sum,g)=>sum+g.count,0),mesh.geometry.index.count);
 const color=mesh.material[1].color.getHex();m.setPaint({color:'#ff0000',finish:'metallic',livery:'twin'});
 assert.equal(mesh.material[0].color.getHexString(),'ff0000');assert.equal(mesh.material[1].color.getHex(),color);disposeParts(shell.root);
});


test('Jaguar has twin hollow exhausts and correctly directed nitro sockets, off by default',()=>{
 const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./fixtures/jaguarxkjss-legacy.json',import.meta.url),'utf8'))),exhaust=createExhaust(p);
 assert.equal(exhaust.sockets.length,2);exhaust.root.updateMatrixWorld(true);
 for(const tip of p.exhaust.tips){
   const pipe=exhaust.root.getObjectByName('hollow-stainless-pipe-'+tip.id),bore=exhaust.root.getObjectByName('soot-dark-bore-'+tip.id);assert.ok(pipe&&bore);
   const socket=exhaust.root.getObjectByName('nitro-exhaust-'+tip.id),pos=socket.getWorldPosition(new THREE.Vector3()),direction=socket.getWorldDirection(new THREE.Vector3());
   assert.ok(direction.distanceTo(new THREE.Vector3(1,0,0))<1e-6);
   assert.ok(pos.x-tip.entry[0]>.14);assert.ok(new THREE.Box3().setFromObject(pipe).min.y>0);
   assert.equal(exhaust.root.getObjectByName('nitro-plume-'+tip.id).visible,false);
   assert.ok([...pipe.geometry.attributes.position.array].every(Number.isFinite));
 }
 exhaust.update({boost:1,time:1});assert.ok(exhaust.sockets.every(s=>s.children[0].visible&&s.children[0].scale.z>0));
 exhaust.update({boost:0});assert.ok(exhaust.sockets.every(s=>!s.children[0].visible));
 exhaust.update({boost:NaN,time:Infinity});assert.ok(exhaust.sockets.every(s=>!s.children[0].visible&&s.children[0].scale.toArray().every(Number.isFinite)));
 const wrong=structuredClone(p);wrong.exhaust.sourceSha256='0'.repeat(64);assert.throws(()=>createExhaust(wrong),/different body/);assert.throws(()=>validateProfile(wrong),/different body/);disposeParts(exhaust.root);
});

test('Jaguar classic handles, trim and louvers remain independent of body paint',()=>{
 const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./fixtures/jaguarxkjss-legacy.json',import.meta.url),'utf8'))),m=createVehicleMaterials(),details=createJaguarDetails(p,m),panels=createCoachwork(p,m);
 assert.equal(panels.children.filter(o=>o.name.startsWith('classic-pull-handle-')).length,2);
 assert.equal(panels.children.filter(o=>o.name.startsWith('panel-gap-')).length,4);
 assert.equal(details.children.filter(o=>o.name.startsWith('classic-rear-bumper-rail-')).length,2);
 const color=details.getObjectByName('classic-rear-bumper-rail-0').material.color.getHex();m.setPaint({color:'#ff0000',finish:'metallic',livery:'twin'});
 assert.equal(details.getObjectByName('classic-rear-bumper-rail-0').material.color.getHex(),color);
 for(const root of [details,panels])root.traverse(o=>{if(o.isMesh)assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));});
 const glass=createGlass(p,m);assert.ok(glass.getObjectByName('rear-window-rubber-louver'));assert.equal(glass.getObjectByName('rear-glass'),undefined);disposeParts(glass);disposeParts(details);disposeParts(panels);
});


test('Furari has source-pinned curved glazing and seals independent of paint',()=>{
 const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./profiles/furari-488.json',import.meta.url),'utf8'))),m=createVehicleMaterials(),glass=createGlass(p,m);
 for(const name of ['windshield','rear-glass']){
  const pane=glass.getObjectByName(name);assert.ok(pane);assert.ok(glass.getObjectByName(name+'-seal'));
  assert.equal(pane.geometry.attributes.position.count,33*41);assert.ok([...pane.geometry.attributes.position.array].every(Number.isFinite));
 }
 const color=glass.getObjectByName('windshield').material.color.getHex();m.setPaint({color:'#00ff00',finish:'gloss',livery:'twin'});assert.equal(glass.getObjectByName('windshield').material.color.getHex(),color);
 const wrong=structuredClone(p);wrong.glassFits.sourceSha256='0'.repeat(64);assert.throws(()=>createGlass(wrong,m),/different shell/);assert.throws(()=>validateProfile(wrong),/different shell/);disposeParts(glass);
});
