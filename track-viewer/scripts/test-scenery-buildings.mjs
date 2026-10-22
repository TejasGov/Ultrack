import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuildingLod} from '../src/scenery-buildings.js';

class FakeRenderer {
  constructor(){this.target={name:'previous-target'};this.viewport=new THREE.Vector4(1,2,3,4);this.scissor=new THREE.Vector4(5,6,7,8);this.scissorTest=false;this.clearColor=new THREE.Color(.1,.2,.3);this.alpha=.4;this.autoClear=true;this.xr={enabled:true};this.renders=0;}
  getRenderTarget(){return this.target;}setRenderTarget(value){this.target=value;}
  getViewport(out){return out.copy(this.viewport);}setViewport(...value){this.viewport.copy(value[0]?.isVector4?value[0]:new THREE.Vector4(...value));}
  getScissor(out){return out.copy(this.scissor);}setScissor(...value){this.scissor.copy(value[0]?.isVector4?value[0]:new THREE.Vector4(...value));}
  getScissorTest(){return this.scissorTest;}setScissorTest(value){this.scissorTest=value;}
  getClearColor(out){return out.copy(this.clearColor);}getClearAlpha(){return this.alpha;}setClearColor(color,alpha){this.clearColor.set(color);this.alpha=alpha;}
  clear(){}render(scene,camera){
    assert(camera.isOrthographicCamera);assert.equal(scene.children.length,3);
    const tile=this.target.width/3,index=this.renders%6;
    assert.deepEqual(this.target.viewport.toArray(),[(index%3)*tile,Math.floor(index/3)*tile,tile,tile],'Atlas viewport is in texture texels, independent of display pixel ratio');
    assert(this.target.scissor.equals(this.target.viewport));assert(this.target.scissorTest);
    this.renders++;if(this.fail)throw Error('WebGL unavailable');
  }
}
function sceneFixture(){
  const root=new THREE.Group();root.position.set(20,2,-30);root.rotation.y=.4;root.scale.set(2,1,1);
  const hotel=new THREE.Group();hotel.name='hotel';hotel.position.set(5,5,8);hotel.rotation.y=.2;root.add(hotel);
  for(let i=0;i<3;i++){const material=new THREE.MeshStandardMaterial({color:0x998877,emissive:0x220000,emissiveMap:new THREE.Texture()});material.userData.emissive0=1;const mesh=new THREE.Mesh(new THREE.BoxGeometry(20-i*2,5,10),material);mesh.position.y=i*5;hotel.add(mesh);}
  const unrelated=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());unrelated.name='pit_building';root.add(unrelated);root.updateMatrixWorld(true);return {root,hotel,unrelated};
}
const {root,hotel,unrelated}=sceneFixture(),renderer=new FakeRenderer(),state={target:renderer.target,viewport:renderer.viewport.clone(),scissor:renderer.scissor.clone(),clear:renderer.clearColor.clone()};
const controller=createBuildingLod(root,{renderer});await controller.ready;
assert.equal(renderer.renders,12,'six albedo and six emission captures');
assert.equal(renderer.target,state.target);assert.deepEqual(renderer.viewport,state.viewport);assert.deepEqual(renderer.scissor,state.scissor);assert(renderer.clearColor.equals(state.clear));assert.equal(renderer.alpha,.4);assert.equal(renderer.autoClear,true);assert.equal(renderer.xr.enabled,true);
const stats=controller.getStats();assert.equal(stats.candidates,1);assert.equal(stats.nearDraws,3);assert.equal(stats.farDraws,1);assert.equal(stats.originalTriangles,36);assert.equal(stats.proxyTriangles,36,'exact silhouette retained');
assert.equal(unrelated.userData.sceneryLodManaged,undefined);
const proxy=root.getObjectByName('building-hotel-baked-proxy');assert(proxy);assert.equal(proxy.geometry.groups.length,0);assert.notEqual(proxy.material.map,proxy.material.emissiveMap);
// Root and nested transforms survive merging exactly; check every expanded world vertex.
const expected=[];hotel.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<index.count;i++)expected.push(new THREE.Vector3().fromBufferAttribute(p,index.getX(i)).applyMatrix4(mesh.matrixWorld));});
root.updateMatrixWorld(true);const p=proxy.geometry.attributes.position;assert.equal(p.count,expected.length);
for(let i=0;i<p.count;i++)assert(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(proxy.matrixWorld).distanceTo(expected[i])<1e-4);
for(let i=0;i<proxy.geometry.attributes.uv.count;i++){const uv=proxy.geometry.attributes.uv;assert(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1);}
const camera=new THREE.PerspectiveCamera(62,16/9,.1,100000);camera.position.set(10000,10000,10000);camera.updateMatrixWorld();controller.update(camera);assert(!proxy.visible,'initially disabled');
controller.setEnabled(true);controller.update(camera);assert(proxy.visible);assert.equal(controller.getStats().active,1);assert(hotel.children.every(mesh=>!mesh.visible));
const box=new THREE.Box3();for(const mesh of hotel.children)box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
const radius=box.getSize(new THREE.Vector3()).length()/2,center=box.getCenter(new THREE.Vector3());
camera.position.copy(center).add(new THREE.Vector3(0,0,radius+radius/(.25*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))));camera.updateMatrixWorld();controller.update(camera);assert(proxy.visible,'far proxy stays visible inside hysteresis band');
controller.setEnabled(false);controller.setEnabled(true);controller.update(camera);assert(!proxy.visible,'near original stays visible inside hysteresis band');
camera.position.set(10000,10000,10000);camera.updateMatrixWorld();controller.update(camera);
hotel.children[0].material.emissiveIntensity=.4;controller.update(camera);assert.equal(proxy.material.emissiveIntensity,.4,'night/day emission follows original material');
camera.position.copy(expected[0]);camera.updateMatrixWorld();controller.update(camera);assert(!proxy.visible);assert(hotel.children.every(mesh=>mesh.visible));
controller.setEnabled(false);assert(hotel.children.every(mesh=>mesh.visible));
let sourceDisposed=0,geometryDisposed=0,materialDisposed=0;hotel.children[0].material.addEventListener('dispose',()=>sourceDisposed++);proxy.geometry.addEventListener('dispose',()=>geometryDisposed++);proxy.material.addEventListener('dispose',()=>materialDisposed++);
controller.dispose();controller.dispose();assert.equal(sourceDisposed,0);assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert(!root.getObjectByName('building-hotel-baked-proxy'));assert(hotel.children.every(mesh=>mesh.userData.sceneryLodManaged===undefined));
const failed=sceneFixture(),brokenRenderer=new FakeRenderer();brokenRenderer.fail=true;const noBake=createBuildingLod(failed.root,{renderer:brokenRenderer});await noBake.ready;assert(!noBake.getStats().ready);assert.match(noBake.getStats().reason,/bake failed/);assert.equal(brokenRenderer.autoClear,true);assert(failed.hotel.children.every(mesh=>mesh.visible&&mesh.userData.sceneryLodManaged===undefined));
const headless=createBuildingLod(failed.root);await headless.ready;assert.equal(headless.getStats().candidates,0);headless.dispose();
console.log('Building atlas LOD: renderer restoration, exact silhouettes/transforms, 3→1 draw proxy, emission, switching and resource ownership pass.');

// Neon trim (untextured, strongly emissive) is not baked: it stays visible far away so its bloom survives.
{const n=sceneFixture(),crown=new THREE.Mesh(new THREE.BoxGeometry(20,.2,6),new THREE.MeshStandardMaterial({emissive:0xf890ff,emissiveIntensity:9}));crown.name='crown';n.hotel.add(crown);n.root.updateMatrixWorld(true);
const c=createBuildingLod(n.root,{renderer:new FakeRenderer()});await c.ready;const st=c.getStats();assert.equal(st.kept,1);assert.equal(st.nearDraws,4);assert.equal(st.farDraws,2);
const farCam=new THREE.PerspectiveCamera(62,16/9,.1,100000);farCam.position.set(10000,10000,10000);farCam.updateMatrixWorld();c.setEnabled(true);c.update(farCam);assert(n.root.getObjectByName('building-hotel-baked-proxy').visible);assert(crown.visible,'neon crown stays at distance');assert(n.hotel.children.filter(m=>m!==crown).every(m=>!m.visible));c.dispose();}
console.log('Neon trim: kept as a real mesh beside the baked proxy.');
