import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {MeshoptDecoder} from 'meshoptimizer';
import {readFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {createServer} from 'vite';
const base=new URL('../../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('assets/sponsors/manifest.json',base)));
const venueBrands=manifest.brands.filter(b=>b.venue!==false);
assert.equal(venueBrands.length,15);
assert.equal(new Set(manifest.brands.map(b=>b.id)).size,manifest.brands.length);
for(const b of manifest.brands){
 assert.equal(createHash('sha256').update(readFileSync(new URL(b.sourceFile,base))).digest('hex'),b.sourceSha256);
 assert.ok(existsSync(new URL('assets/sponsors/'+b.file,base)));
}
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {SPONSOR_BRANDS,sponsorOf}=await server.ssrLoadModule('/src/sponsors.js');
 const teams=JSON.parse(readFileSync(new URL('assets/teams/teams.json',base))).teams;
 assert.equal(teams.find(t=>t.id==='saetta').sponsor,'Ray-Ban');
 for(const t of teams)assert.ok(sponsorOf(t.sponsor),'Team sponsor must resolve: '+t.name);
 assert.equal(sponsorOf('RayBan').id,'rayban');
 assert.ok(SPONSOR_BRANDS.some(b=>b.id==='rayban'));
 console.log('All team sponsors resolve; Saetta uses the local Ray-Ban artwork.');
}finally{await server.close();}
await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
for(const file of ['marina_visual.glb','marina_visual_ktx2.glb']){
 const path=new URL('tracks/marina/out/web/'+file,base).pathname.replace(/^\/([A-Za-z]:)/,'$1'),doc=await io.read(path);
 const materials=doc.getRoot().listMaterials().filter(m=>m.getName().startsWith('M_AdLogo_'));
 for(const b of venueBrands)assert.ok(materials.some(m=>m.getName().startsWith('M_AdLogo_'+b.id+'-')),'Missing '+b.id+' in '+file);
 assert.ok(!doc.getRoot().listMaterials().some(m=>/^M_Ad_(?:fascia_)?[0-6]_.*_fg$/.test(m.getName())),'Legacy sponsor lettering must be removed.');
 for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives())if(p.getMaterial()?.getName().startsWith('M_AdLogo_'))assert.ok(p.getAttribute('TEXCOORD_0'),'Original logo panels need UVs.');
 console.log(file+': all 15 brands present, logo UVs valid, fictional sponsor lettering removed.');
}
