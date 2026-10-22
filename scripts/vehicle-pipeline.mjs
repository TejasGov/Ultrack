import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateProfile } from '../car-lab/src/vehicle/validation.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'car-lab/src/vehicle/profiles');
const profiles=fs.readdirSync(directory).filter(f=>f.endsWith('.json')).map(f=>validateProfile(JSON.parse(fs.readFileSync(path.join(directory,f),'utf8'))));
const command=process.argv[2]??'check';
if(command==='plan'){
  console.log('1. Verify shell bytes and source hash.\n2. Normalize display coordinates and fit the per-car anchors.\n3. Apply shared paint materials independently of the global grade.\n4. Assemble shared wheel, glass, mirror and light resources.\n5. Review front/side/rear, steering, ground contact and changing reflections.\n6. Export the recipe and record visual approval.\n7. Optimize a derived mesh and verify quality/performance before game admission.');
}else if(command==='check'){
  for(const profile of profiles){
  const body=path.resolve(root,profile.body.file);
  if(!body.startsWith(root+path.sep))throw Error('Body source escapes the workspace.');
  const bytes=fs.readFileSync(body),hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(hash.toLowerCase()!==profile.body.sha256.toLowerCase())throw Error('Body source changed. Review it and update the profile explicitly.');
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid source GLB.');
  const length=bytes.readUInt32LE(12);if(bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('Missing glTF JSON.');
  const doc=JSON.parse(bytes.toString('utf8',20,20+length));
  const triangles=(doc.meshes??[]).reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices??p.attributes.POSITION].count/3,0),0);
  if(triangles!==profile.body.triangles)throw Error('Source triangle count changed.');
  if(profile.body.sourceFile){
    const donor=path.resolve(root,profile.body.sourceFile);
    if(!donor.startsWith(root+path.sep))throw Error('Donor source escapes the workspace.');
    const donorHash=crypto.createHash('sha256').update(fs.readFileSync(donor)).digest('hex');
    if(donorHash.toLowerCase()!==profile.body.sourceSha256.toLowerCase())throw Error('Donor source changed.');
  }
  console.log(JSON.stringify({car:profile.id,inputHashVerified:true,profileValid:true,bytes:bytes.length,triangles,stage:'assembly-prototype',gameReady:false,remaining:['surface approval','final attachment fit','derived-mesh optimization','driving integration']},null,2));
  }
}else throw Error('Use check or plan. No provider generation is performed by this pipeline.');
