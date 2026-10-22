import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {getBounds} from '@gltf-transform/functions';
import {readFileSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const root=new URL('../../assets/cars/',import.meta.url),index=JSON.parse(readFileSync(new URL('texture-variants.json',root)));
let checked=0;const rows=[];
const tris=doc=>doc.getRoot().listMeshes().reduce((sum,m)=>sum+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);
for(const [key,variants] of Object.entries(index))for(const lod of [0,1]){
 const source=new URL(key+'/car_lod'+lod+'.glb',root),packed=new URL(key+'/'+variants['lod'+lod],root);
 const a=await io.read(source.pathname.replace(/^\/([A-Za-z]:)/,'$1')),b=await io.read(packed.pathname.replace(/^\/([A-Za-z]:)/,'$1'));
 assert.equal(tris(b),tris(a),'Texture compression must not alter car geometry.');
 const before=getBounds(a.getRoot().listScenes()[0]),after=getBounds(b.getRoot().listScenes()[0]);
 for(const edge of ['min','max'])for(let axis=0;axis<3;axis++)assert.ok(Math.abs(before[edge][axis]-after[edge][axis])<.001,'Packed geometry must retain its bounds within 1 mm.');
 assert.deepEqual(b.getRoot().listNodes().map(n=>n.getName()).sort(),a.getRoot().listNodes().map(n=>n.getName()).sort());
 if(lod===0)for(const name of ['wheel_FL','wheel_FR','wheel_RL','wheel_RR']){
  const old=a.getRoot().listNodes().find(n=>n.getName()===name).getWorldTranslation(),now=b.getRoot().listNodes().find(n=>n.getName()===name).getWorldTranslation();
  assert.ok(old.every((x,i)=>Math.abs(x-now[i])<.001),'Wheel hubs must retain their placement.');
 }
 assert.equal(b.getRoot().listTextures().length,a.getRoot().listTextures().length);
 for(const texture of b.getRoot().listTextures()){assert.equal(texture.getMimeType(),'image/ktx2');const [w,h]=texture.getSize();assert.ok(w>0&&h>0&&w<=1024&&h<=1024);}
 rows.push({key,lod,originalMB:(statSync(source).size/1e6).toFixed(2),packedMB:(statSync(packed).size/1e6).toFixed(2)});checked++;
}
console.table(rows);console.log('Validated '+checked+' KTX2 variants: preserved triangle counts/nodes, bounds within 1 mm, all textures compressed.');
