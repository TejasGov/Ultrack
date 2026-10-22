// Offline geometry handoff for fit inspection; never drives a browser or app.
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createVehicleMaterials } from './src/vehicle/materials.js';
import { createWheelSet,createGlass,createMirrors } from './src/vehicle/parts.js';
import { createVehicleLights } from './src/vehicle/lights.js';
import { normalizeShell } from './src/vehicle/body.js';

globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
};
const profile=JSON.parse(fs.readFileSync(new URL('./src/vehicle/profiles/mp1x.json',import.meta.url),'utf8'));
const materials=createVehicleMaterials();materials.setPaint({color:'#1358b8',finish:'metallic'});
const bytes=fs.readFileSync(path.resolve('..',profile.body.file));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=new THREE.Scene();scene.name='MP1-X offline fit inspection';
scene.add(normalizeShell(gltf.scene,profile,materials.body).root);
scene.add(createWheelSet(profile,materials,'split').root,createGlass(profile,materials),createMirrors(profile,materials));
const lamps=createVehicleLights(profile,materials);lamps.update({mode:'low',brake:1});
// Only export fitted lamp meshes here; interactive beam behavior stays in the lab.
for(const object of [...lamps.root.children])if(object.isLight||(!object.isMesh&&!object.isGroup))lamps.root.remove(object);
scene.add(lamps.root);
const binary=await new GLTFExporter().parseAsync(scene,{binary:true});
fs.writeFileSync('verification/mclaren-body-only-assembly-fit.glb',Buffer.from(binary));
console.log(JSON.stringify({output:'verification/mclaren-body-only-assembly-fit.glb',bytes:binary.byteLength,bodyTriangles:profile.body.triangles,note:'Offline geometry/material inspection, not a browser capture. Custom paint shader/postprocessing are not exported.'}));
