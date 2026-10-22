import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Vector3,Matrix4,Sphere,Frustum,PerspectiveCamera,Box3} from 'three';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const root=new URL('../../tracks/marina/out/web/',import.meta.url);
const metadata=JSON.parse(readFileSync(new URL('../qa/sectors/report.json',import.meta.url)));
const hash=data=>createHash('sha256').update(data).digest('hex');
const triangleCount=doc=>doc.getRoot().listMeshes().reduce((sum,mesh)=>sum+mesh.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),0);
function signatures(primitives){
 const list=[];
 for(const p of primitives){
  const attributes=p.listSemantics().sort(),vertices=[];
  for(let i=0;i<p.getAttribute('POSITION').getCount();i++)vertices.push(JSON.stringify(attributes.map(key=>[key,p.getAttribute(key).getElement(i,[])])));
  const indices=p.getIndices();
  for(let i=0;i<indices.getCount();i+=3){
   const v=[vertices[indices.getScalar(i)],vertices[indices.getScalar(i+1)],vertices[indices.getScalar(i+2)]];
   // Meshopt may rotate triangle indices during encoding; cyclic rotations preserve winding.
   const canonical=[v.join('|'),[v[1],v[2],v[0]].join('|'),[v[2],v[0],v[1]].join('|')].sort()[0];
   list.push(hash(p.getMaterial().getName()+canonical));
  }
 }
 return list.sort();
}
const stats=[];
for(const row of metadata){
 const original=await io.read(fileURLToPath(new URL(row.base+'_shell.glb',root)));
 const partitioned=await io.read(fileURLToPath(new URL(row.base+'_sectors.glb',root)));
 assert.equal(triangleCount(original),triangleCount(partitioned),'No triangles are deleted or added');
 assert.deepEqual(original.getRoot().listTextures().map(t=>hash(t.getImage())).sort(),partitioned.getRoot().listTextures().map(t=>hash(t.getImage())).sort());
 const names=new Set(row.changes.map(change=>change.name));
 for(const change of row.changes){
  const source=original.getRoot().listMeshes().find(mesh=>mesh.getName()===change.name);
  const chunks=partitioned.getRoot().listMeshes().filter(mesh=>mesh.getName().startsWith(change.name+'_section_'));
  assert.equal(chunks.length,change.sections);
  assert.deepEqual(signatures(source.listPrimitives()),signatures(chunks.flatMap(mesh=>mesh.listPrimitives())),`${change.name}: positions, normals, UVs, colours, materials and winding survive`);
 }
 const entries=doc=>{
  const rows=[];
  for(const node of doc.getRoot().listNodes()){
   const mesh=node.getMesh();if(!mesh||!names.has(mesh.getName().split('_section_')[0]))continue;
   const matrix=new Matrix4().fromArray(node.getWorldMatrix());
   for(const p of mesh.listPrimitives()){
    const position=p.getAttribute('POSITION'),points=[];
    for(let i=0;i<position.getCount();i++)points.push(new Vector3().fromArray(position.getElement(i,[])));
    const box=new Box3().setFromPoints(points),sphere=new Sphere().setFromPoints(points,box.getCenter(new Vector3())).applyMatrix4(matrix);
    rows.push({sphere,triangles:p.getIndices().getCount()/3});
   }
  }
  return rows;
 };
 const before=entries(original),after=entries(partitioned),track=JSON.parse(readFileSync(new URL('../../tracks/marina/out/track.json',import.meta.url)));
 const samples=[];
 for(let i=0;i<24;i++){
  const k=Math.floor(i/24*track.centerline.length),next=(k+8)%track.centerline.length;
  const point=new Vector3().fromArray(track.centerline[k]),ahead=new Vector3().fromArray(track.centerline[next]);
  const forward=ahead.clone().sub(point).normalize();
  const camera=new PerspectiveCamera(62,16/9,.1,9000);camera.position.copy(point).addScaledVector(forward,-5).add(new Vector3(0,1.8,0));camera.lookAt(ahead.add(new Vector3(0,1,0)));camera.updateMatrixWorld();
  const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const visible=list=>{const rows=list.filter(entry=>frustum.intersectsSphere(entry.sphere));return {triangles:rows.reduce((sum,row)=>sum+row.triangles,0),draws:rows.length};};
  samples.push({sample:i,before:visible(before),after:visible(after)});
 }
 const sum=(side,key)=>samples.reduce((n,s)=>n+s[side][key],0)/samples.length;
 const result={base:row.base,affectedTrianglesBefore:sum('before','triangles'),affectedTrianglesAfter:sum('after','triangles'),affectedDrawsBefore:sum('before','draws'),affectedDrawsAfter:sum('after','draws'),samples};
 assert(result.affectedTrianglesAfter<result.affectedTrianglesBefore*.65,'Partitioning saves substantial submitted geometry across the fixed camera route');
 stats.push(result);console.log(JSON.stringify({...result,samples:undefined}));
}
writeFileSync(new URL('../qa/sectors/visibility-report.json',import.meta.url),JSON.stringify(stats,null,2));
console.log('PASS: exact surface preservation, original textures, 24-camera frustum comparison for both texture variants.');
