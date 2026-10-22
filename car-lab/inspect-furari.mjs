// Local asset export only. This does not access a browser or page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const carLab=fileURLToPath(new URL('.',import.meta.url));
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createVehicleMaterials } from './src/vehicle/materials.js';
import { createWheelSet,createGlass,createMirrors } from './src/vehicle/parts.js';
import { createVehicleLights } from './src/vehicle/lights.js';

import { createExhaust } from './src/vehicle/exhaust.js';
import { createCoachwork } from './src/vehicle/coachwork.js';
import { createRearFascia } from './src/vehicle/rear-fascia.js';
import { normalizeShell } from './src/vehicle/body.js';
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}};
const before=process.argv.includes('--before');
const profile=JSON.parse(fs.readFileSync(new URL('./src/vehicle/profiles/furari-488.json',import.meta.url),'utf8'));
const materials=createVehicleMaterials();materials.setPaint({color:'#b80e21',finish:'metallic',livery:'solid'});materials.rim.color.set('#303943');if(profile.caliperColor)materials.caliper.color.set(profile.caliperColor);
const bytes=fs.readFileSync(path.resolve(carLab,'..',before?'meshy_output/body-batch-5/furari-488/model.glb':profile.body.file));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=new THREE.Scene();scene.name=before?'Furari previous body':'Furari repaired coachwork';
scene.add(normalizeShell(gltf.scene,profile,materials.body).root);
scene.add(createWheelSet(profile,materials,'split').root,createGlass(profile,materials),createMirrors(profile,materials),createRearFascia(profile,materials));
if(!before){scene.add(createCoachwork(profile,materials));const exhaust=createExhaust(profile);exhaust.update({boost:process.argv.includes('--boost')?1:0,time:.4});scene.add(exhaust.root);}
const lamps=createVehicleLights(profile,materials);lamps.update({mode:'running',brake:0});
for(const o of [...lamps.root.children])if(o.isLight||(!o.isMesh&&!o.isGroup))lamps.root.remove(o);
scene.add(lamps.root);
const binary=await new GLTFExporter().parseAsync(scene,{binary:true});
const output=`verification/furari-488-${process.argv.includes('--boost')?'boost':before?'before':'coachwork'}-assembly.glb`;fs.writeFileSync(path.resolve(carLab,output),Buffer.from(binary));
console.log(JSON.stringify({output,bytes:binary.byteLength,note:'Local assembly export. In-engine procedural livery and postprocessing are not exported.'}));
