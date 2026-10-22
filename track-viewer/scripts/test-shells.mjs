import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=new URL('../../tracks/marina/out/web/',import.meta.url);
const report=JSON.parse(readFileSync(new URL('../qa/shells/report.json',import.meta.url)));
for(const row of report){
 const original=await io.read(fileURLToPath(new URL(row.file,root))),shell=await io.read(fileURLToPath(new URL(row.file.replace('.glb','_shell.glb'),root)));
 const a=original.getRoot(),b=shell.getRoot();
 assert.equal(a.listNodes().length,b.listNodes().length);assert.equal(a.listMeshes().length,b.listMeshes().length);
 assert.deepEqual(a.listNodes().map(node=>node.getMatrix()),b.listNodes().map(node=>node.getMatrix()),'Node transforms stay intact');
 assert.deepEqual(a.listTextures().map(t=>hash(t.getImage())).sort(),b.listTextures().map(t=>hash(t.getImage())).sort(),'Texture payloads stay intact');
 const changed=new Set(row.changes.map(change=>change.mesh));
 for(const mesh of a.listMeshes())if(!changed.has(mesh.getName())){
  const other=b.listMeshes().find(m=>m.getName()===mesh.getName());assert(other);
  assert.deepEqual(mesh.listPrimitives().map(p=>Array.from(p.getAttribute('POSITION').getArray())),other.listPrimitives().map(p=>Array.from(p.getAttribute('POSITION').getArray())));
 }
 assert(row.removed>2000);assert.equal(row.after,row.before-row.removed);assert(row.outputBytes<row.sourceBytes);
 assert.equal(hash(readFileSync(new URL(row.file.replace('.glb','_shell.glb'),root))),hash(readFileSync(new URL('../public/assets/'+row.file,import.meta.url))),'Runtime serves the validated shell variant');
}
assert.equal(hash(readFileSync(new URL('marina_collision.glb',root))),hash(readFileSync(new URL('../public/assets/marina_collision.glb',import.meta.url))));
console.log('PASS: shell triangle reductions, unchanged scenery transforms/other positions/textures, smaller files, runtime sync and unchanged collision mesh.');
