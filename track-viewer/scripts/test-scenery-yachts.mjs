import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createYachtLod} from '../src/scenery-yachts.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {fileURLToPath} from 'node:url';

function cameraAt(position,target){const c=new THREE.PerspectiveCamera(62,16/9,.1,9000);c.position.copy(position);c.lookAt(target);c.updateMatrixWorld();return c;}
const root=new THREE.Group(),boat=new THREE.Group();root.add(boat);boat.position.set(22,3,-14);boat.rotation.y=.4;boat.scale.setScalar(2);
const parts=[];
for(const [name,geometry,color] of [
  ['M_y20_white_hull',new THREE.BoxGeometry(20,3,4,4,2,2),0xdddddd],
  ['M_y20_white_super',new THREE.BoxGeometry(12,4,3,4,2,2).translate(0,3,0),0xeeeeee],
  ['M_y20_white_white',new THREE.BoxGeometry(13,.2,3).translate(0,5,0),0xffffff],
  ['M_y20_white_teak',new THREE.BoxGeometry(18,.2,4).translate(0,1.5,0),0x987454],
  ['M_YachtSteel',new THREE.BoxGeometry(1,1,1).translate(0,7,0),0xbbbbbb],
]){
  const material=new THREE.MeshStandardMaterial({color});material.name=name;
  const o=new THREE.InstancedMesh(geometry,material,2);
  o.layers.set(2);
  if(name.endsWith('_white')){o.position.set(2,1,-.5);o.rotation.y=.25;o.scale.set(1.1,.9,1.2);}
  o.setMatrixAt(0,new THREE.Matrix4());o.setMatrixAt(1,new THREE.Matrix4().makeTranslation(0,0,-200));boat.add(o);parts.push(o);
}
root.updateMatrixWorld(true);
const original=parts.map(o=>({matrix:new Float32Array(o.instanceMatrix.array),positions:new Float32Array(o.geometry.attributes.position.array),material:o.material}));
const ctrl=createYachtLod(root);await ctrl.ready;
const centre=new THREE.Vector3().setFromMatrixPosition(boat.matrixWorld);
const far=cameraAt(centre.clone().add(new THREE.Vector3(0,60,700)),centre);
let stats=ctrl.update(far);assert.equal(stats.enabled,false);assert.equal(stats.far,0);assert.equal(stats.near,2);
ctrl.setEnabled(true);stats=ctrl.update(far);assert.equal(stats.far,2);assert.equal(stats.near,0);
assert(stats.submittedDraws<stats.baselineDraws);assert(stats.submittedTriangles<stats.baselineTriangles);
const proxy=boat.children.find(o=>o.name.startsWith('yacht-lod-'));assert(proxy);assert.equal(proxy.count,2);assert(proxy.visible);
assert(parts.every(o=>!o.frustumCulled),'Packed instance sets use controller bounds, not stale cached renderer bounds');
assert.equal(proxy.layers.mask,parts[0].layers.mask,'Proxy keeps the hull render-pass eligibility');
const whiteSource=parts[2],expectedWhite=new THREE.Box3().setFromBufferAttribute(whiteSource.geometry.attributes.position).applyMatrix4(whiteSource.matrix);
const whiteProxy=new THREE.Box3(),pos=proxy.geometry.attributes.position,color=proxy.geometry.attributes.color;
for(let i=0;i<pos.count;i++)if(color.getX(i)===1&&color.getY(i)===1&&color.getZ(i)===1)whiteProxy.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos,i));
assert(expectedWhite.min.distanceTo(whiteProxy.min)<1e-5&&expectedWhite.max.distanceTo(whiteProxy.max)<1e-5,'Differing component transforms survive the atlas merge');
for(let i=0;i<2;i++){const matrix=new THREE.Matrix4();proxy.getMatrixAt(i,matrix);assert.deepEqual(matrix.elements,new THREE.Matrix4().fromArray(original[0].matrix,i*16).elements);}
const stableVersion=proxy.instanceMatrix.version;ctrl.update(far);assert.equal(proxy.instanceMatrix.version,stableVersion,'Identical visible membership causes no instance upload');
const near=cameraAt(centre.clone().add(new THREE.Vector3(0,10,30)),centre);
stats=ctrl.update(near);assert(stats.near>=1);assert.equal(parts[0].visible,true);
// An object outside the camera frustum is omitted from both streams.
const away=cameraAt(far.position,far.position.clone().add(new THREE.Vector3(0,0,100)));
stats=ctrl.update(away);assert.equal(stats.near+stats.far,0);assert.equal(stats.culled,2);
// ...unless it is close enough to cast a shadow into view: then it stays in the full-detail stream.
const behind=cameraAt(centre.clone().add(new THREE.Vector3(0,10,30)),centre.clone().add(new THREE.Vector3(0,10,130)));
stats=ctrl.update(behind);assert.equal(stats.culled,1,'Off-screen boats within shadow range are kept; the one 400 m off is not');assert.equal(stats.near,1);
ctrl.setEnabled(false);stats=ctrl.update(far);assert.equal(stats.far,0);
let disposedGeometry=0,disposedMaterial=0,disposedTexture=0;
proxy.geometry.addEventListener('dispose',()=>disposedGeometry++);proxy.material.addEventListener('dispose',()=>disposedMaterial++);proxy.material.map.addEventListener('dispose',()=>disposedTexture++);
ctrl.dispose();ctrl.dispose();assert.equal(disposedGeometry,1);assert.equal(disposedMaterial,1);assert.equal(disposedTexture,1);assert(!boat.children.includes(proxy));
for(let i=0;i<parts.length;i++){
  assert.equal(parts[i].count,2);assert.deepEqual(parts[i].instanceMatrix.array,original[i].matrix);
  assert.deepEqual(parts[i].geometry.attributes.position.array,original[i].positions);assert.equal(parts[i].material,original[i].material);assert(!parts[i].userData.sceneryLodManaged);
  assert.equal(parts[i].frustumCulled,true,'Disposal restores renderer frustum policy');
}

// Exercise actual shell GLB geometry, primitive names, quantized attributes and
// EXT_mesh_gpu_instancing streams, without needing browser texture decoders.
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(fileURLToPath(new URL('../../tracks/marina/out/web/marina_visual_shell.glb',import.meta.url)));
const actual=new THREE.Group();
for(const node of doc.getRoot().listNodes()){
  const mesh=node.getMesh();if(!/^yacht_/.test(mesh?.getName()??''))continue;
  const group=new THREE.Group();group.name=mesh.getName();actual.add(group);
  group.matrixAutoUpdate=false;group.matrix.fromArray(node.getWorldMatrix());
  const inst=node.getExtension('EXT_mesh_gpu_instancing'),translation=inst.getAttribute('TRANSLATION'),rotation=inst.getAttribute('ROTATION'),scale=inst.getAttribute('SCALE');
  const count=(translation??rotation??scale).getCount();
  for(const primitive of mesh.listPrimitives()){
    const geometry=new THREE.BufferGeometry();
    for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){
      const accessor=primitive.getAttribute(semantic);if(accessor)geometry.setAttribute(name,new THREE.BufferAttribute(accessor.getArray(),accessor.getElementSize(),accessor.getNormalized()));
    }
    geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(),1));
    const source=primitive.getMaterial(),material=new THREE.MeshStandardMaterial();material.name=source.getName();material.color.fromArray(source.getBaseColorFactor());
    const o=new THREE.InstancedMesh(geometry,material,count),t=new THREE.Vector3(),r=new THREE.Quaternion(),s=new THREE.Vector3(1,1,1),m=new THREE.Matrix4();
    for(let i=0;i<count;i++){if(translation)t.fromArray(translation.getElement(i,[]));if(rotation)r.fromArray(rotation.getElement(i,[]));if(scale)s.fromArray(scale.getElement(i,[]));m.compose(t,r,s);o.setMatrixAt(i,m);}
    group.add(o);
  }
}
const actualCtrl=createYachtLod(actual);await actualCtrl.ready;assert.equal(actual.children.length,5);
const rows=actual.children.map(group=>{
  const proxy=group.children.find(o=>o.name.startsWith('yacht-lod-'));assert(proxy,'All five real variants have a proxy');
  const originals=group.children.filter(o=>o!==proxy),baseline=originals.reduce((sum,o)=>sum+o.geometry.index.count/3,0),reduced=proxy.geometry.attributes.position.count/3;
  assert(reduced<baseline);assert(proxy.geometry.attributes.color.count===proxy.geometry.attributes.position.count);
  assert(proxy.material.map.colorSpace===THREE.SRGBColorSpace);
  const sourceBounds=new THREE.Box3();for(const o of originals){o.geometry.computeBoundingBox();sourceBounds.union(o.geometry.boundingBox);}
  assert(sourceBounds.expandByScalar(1e-6).containsBox(proxy.geometry.boundingBox),'Proxy vertices stay inside original extents (float conversion tolerance)');
  return {variant:group.name,boats:originals[0].count,originalTriangles:baseline,proxyTriangles:reduced,originalDraws:originals.length,proxyDraws:1};
});
console.table(rows);actualCtrl.dispose();
const empty=createYachtLod(new THREE.Group());await empty.ready;empty.dispose();
const cancelled=createYachtLod(root);cancelled.dispose();await cancelled.ready;assert(!boat.children.some(o=>o.name.startsWith('yacht-lod-')),'Cancelled generation cannot attach a late proxy');
console.log('PASS: yacht LOD thresholds, frustum rejection, instance/parent transforms, baseline restoration, immutable source resources, async cancellation/disposal and all five actual shell variants.');
