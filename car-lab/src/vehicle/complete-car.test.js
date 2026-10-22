import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {createCompleteCar,createCompleteCarLights} from './complete-car.js';
import {createVehicleMaterials} from './materials.js';
import {validateProfile} from './validation.js';
for(const key of ['mp1x','jaguarxkjss','nuvolari'])test(key+' preserves complete source geometry, four hubs, independent paint and native lamps',async()=>{
 const p=validateProfile(JSON.parse(fs.readFileSync(new URL('./profiles/'+key+'.json',import.meta.url))));
 const bytes=fs.readFileSync(new URL('../../../'+p.body.file,import.meta.url));
 const loader=new GLTFLoader();
 // Decode actual production geometry; GPU image decoding is replaced only in this Node test.
 loader.register(parser=>{parser.loadTextureImage=()=>Promise.resolve(new THREE.Texture());return {name:'node-test-textures'};});
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const m=createVehicleMaterials(),lighting=createCompleteCarLights(p,m),car=createCompleteCar(gltf.scene,p,m,lighting);
 assert.equal(car.wheelSet.wheels.length,4);assert.equal(car.triangles,p.body.triangles);
 assert.ok(car.parts.glass.children.length>0);assert.ok(car.parts.lights.children.filter(o=>o.isMesh).length>=2);
 const retained=[];car.root.traverse(o=>{if(o.isMesh){assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));if(o.material!==m.body&&o.material?.color)retained.push([o.material,o.material.color.getHex()]);}});
 m.setPaint({color:'#ff0000',finish:'metallic',livery:'solid',carbon:false});
 for(const [mat,color] of retained)if(mat!==m.mirrorPaint)assert.equal(mat.color.getHex(),color);
 lighting.update({mode:'off',brake:0});const off=m.taillight.emissiveIntensity;lighting.update({brake:1});assert.ok(m.taillight.emissiveIntensity>off);
 for(const w of car.wheelSet.wheels){assert.ok(w.spin.children.length>0);assert.ok(new THREE.Box3().setFromObject(w.pivot).min.y>-.04);}
});

