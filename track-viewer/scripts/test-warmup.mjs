import assert from 'node:assert/strict';
import * as THREE from 'three';
import { compileVisible } from '../src/warmup.js';
globalThis.requestAnimationFrame=fn=>setImmediate(fn);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);
camera.updateMatrixWorld();
const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
for(let i=0;i<65;i++){const mesh=new THREE.Mesh(geometry,material);mesh.position.z=-5;scene.add(mesh);}
const hidden=new THREE.Group();hidden.visible=false;hidden.add(new THREE.Mesh(geometry,material));scene.add(hidden);
const behind=new THREE.Mesh(geometry,material);behind.position.z=5;scene.add(behind);
scene.updateMatrixWorld(true);
let target={},calls=0,count=0;
const originalTarget=target;
const renderer={getRenderTarget:()=>target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget:value=>{target=value;},async compileAsync(group,cam,environment){
  calls++;count+=group.children.length;assert(group.children.length<=32);assert.equal(environment,scene);
  assert(group.children.every(mesh=>mesh.material===material&&mesh.geometry===geometry));
}};
assert.equal(await compileVisible(renderer,scene,camera,{frustum:true}),65);
assert.equal(calls,3);assert.equal(count,65);assert.equal(target,originalTarget);
assert.equal(scene.children[0].parent,scene,'Warm-up does not reparent live meshes');
calls=0;await compileVisible(renderer,scene,camera,{isCancelled:()=>true});assert.equal(calls,0);
// shadow variants: one depth material per cut-out source (reused across warm-ups, carrying its textures), one shared by plain casters
const shadows=new THREE.Scene(),depthSeen=[],cut=()=>new THREE.MeshBasicMaterial({map:new THREE.Texture(),alphaTest:.5});
const cutA=cut(),cutB=cut();
for(const m of [cutA,cutA,cutB,material,material]){const mesh=new THREE.Mesh(geometry,m);mesh.castShadow=true;mesh.position.z=-5;shadows.add(mesh);}
shadows.updateMatrixWorld(true);
const depthRenderer={...renderer,async compileAsync(group){for(const mesh of group.children)if(mesh.material.isMeshDepthMaterial)depthSeen.push(mesh.material);}};
await compileVisible(depthRenderer,shadows,camera,{depth:true});await compileVisible(depthRenderer,shadows,camera,{depth:true});
assert.equal(depthSeen.length,6);assert.deepEqual(depthSeen.slice(3),depthSeen.slice(0,3),'Variants are reused across warm-ups');
assert.equal(depthSeen[0].map,cutA.map);assert.equal(depthSeen[1].map,cutB.map);assert.notEqual(depthSeen[0],depthSeen[1]);assert.equal(depthSeen[2].alphaTest,0);
console.log('PASS: visible/frustum selection, 32-object batches, shared resources, scene lighting, target restoration, cancellation and shadow variants.');
