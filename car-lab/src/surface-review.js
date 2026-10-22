import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import mclarenShell from './vehicle/profiles/mp1x.json';

const params=new URLSearchParams(location.search),bodyTest=params.get('experiment')==='body-only';
const id=params.get('car');
const car=['furari-488','lambo2','mclaren'].includes(id)?id:'lambo2';
const shellName=car==='mclaren'?'MP1–X':'AV–12';
document.querySelector('#car').textContent=bodyTest?`${shellName} / BODY SHELL EXPERIMENT`:car;
if(bodyTest){
  document.title='RaceUltimate — body shell experiment';
  document.querySelector('h1').textContent=`${shellName} — full-car generation vs body-only generation`;
  document.querySelector('header p').textContent='Same glossy material and lighting. New shell shown as generated: no textures, normal maps, glass or added wheels. Drag either view to orbit both.';
  document.querySelector('#remesh strong').textContent='Previous full-car source';
  document.querySelector('#source strong').textContent='New body-only generation';
  document.querySelector('#review-color').value='#125dda';
}
const views=[];
let syncing=false;
async function view(element,url){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;element.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#252b33');
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);room.dispose();scene.environment=env.texture;
  const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.set(-4.6,1.8,5.6);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.6,0);controls.minDistance=3.5;controls.maxDistance=12;controls.update();controls.addEventListener('change',()=>{
    renderer.render(scene,camera);
    if(syncing)return;syncing=true;
    for(const other of views){if(other.camera===camera)continue;other.camera.position.copy(camera.position);other.controls.target.copy(controls.target);other.controls.update();other.renderer.render(other.scene,other.camera);}
    syncing=false;
  });
  scene.add(new THREE.HemisphereLight(0xdbeaff,0x3b3030,1));const sun=new THREE.DirectionalLight(0xffeedb,2);sun.position.set(-3,6,4);scene.add(sun);
  const material=new THREE.MeshPhysicalMaterial({color:0x818b95,roughness:.25,metalness:0,clearcoat:1,clearcoatRoughness:.1,side:THREE.DoubleSide});
  const meshes=[];let triangles=0;
  const entry={renderer,scene,camera,controls,meshes,material,sun};views.push(entry);
  new ResizeObserver(()=>{const {width,height}=element.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.render(scene,camera);}).observe(element);
  try{
    const gltf=await new GLTFLoader().loadAsync(url);gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);triangles+=(g.index?.count??g.attributes.position.count)/3;meshes.push(new THREE.Mesh(g,material));});
    const box=new THREE.Box3();for(const mesh of meshes){mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox);}
    if(box.getSize(new THREE.Vector3()).z>box.getSize(new THREE.Vector3()).x){for(const mesh of meshes)mesh.geometry.rotateY(Math.PI/2);box.makeEmpty();for(const mesh of meshes){mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox);}}
    const center=box.getCenter(new THREE.Vector3()),scale=4.6/box.getSize(new THREE.Vector3()).x;
    for(const mesh of meshes){const g=mesh.geometry;g.translate(-center.x,-box.min.y,-center.z);g.scale(scale,scale,scale);if(!g.attributes.normal)g.computeVertexNormals();g.userData.originalNormals=g.attributes.normal.clone();scene.add(mesh);}
    const textures=new Set();gltf.scene.traverse(o=>{if(!o.isMesh)return;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}});textures.forEach(t=>{t.dispose();t.image?.close?.();});
    element.querySelector('.status').textContent=`${Math.round(triangles).toLocaleString()} triangles · texture-free`;
    update();
  }catch(error){element.querySelector('.status').textContent=error.message;console.error(error);}
}
function update(){for(const entry of views){const satin=document.querySelector('#satin').checked;entry.material.roughness=satin?.6:.25;entry.material.clearcoat=satin?.15:1;for(const mesh of entry.meshes){if(document.querySelector('#normals').checked)mesh.geometry.computeVertexNormals();else mesh.geometry.setAttribute('normal',mesh.geometry.userData.originalNormals.clone());}}renderMaterials();}
function renderMaterials(){
  const angle=THREE.MathUtils.degToRad(Number(document.querySelector('#reflection-angle').value));
  for(const entry of views){entry.material.color.set(document.querySelector('#review-color').value);entry.scene.environmentRotation.y=angle;entry.sun.position.set(Math.cos(angle)*5,6,Math.sin(angle)*5);entry.renderer.render(entry.scene,entry.camera);}
}
document.querySelector('#normals').onchange=update;document.querySelector('#satin').onchange=update;
document.querySelector('#review-color').oninput=renderMaterials;document.querySelector('#reflection-angle').oninput=renderMaterials;
for(const kind of ['remesh','source']){
  const url=bodyTest?(car==='mclaren'?(kind==='source'?mclarenShell.body.url:'/models/mclaren-source.glb'):(kind==='source'?'/models/lambo-body-shell.glb':'/models/lambo2-source.glb')):`/models/${car}${kind==='source'?'-source':''}.glb`;
  view(document.querySelector(`#${kind}`),url);
}
