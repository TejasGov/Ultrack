import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createScene } from './scene.js';
import { createPaintSystem, resizeTexture, FINISHES } from './paint.js';
import './style.css';

const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
$('#body-test-link').hidden=!import.meta.env.DEV;
const CARS={
  'furari-488':{id:'furari-488',title:'TR–8',name:'Furari',triangles:60245,taskId:'01a15060-784c-762a-8fd1-64427bdc5147',color:'#d71928'},
  lambo2:{id:'lambo2',title:'AV–12',name:'Lambo',triangles:58861,taskId:'01a15060-782a-71f7-8888-a6bdbdfbc2cc',color:'#3c4147'},
  mclaren:{id:'mclaren',title:'MP1–X',name:'McLaren',triangles:60739,taskId:'01a15060-7834-738a-bec2-25e2871c72e1',color:'#353b43'}
};
const COLORS=[['Rosso corsa','#d71928'],['Glacier white','#e9ece7'],['Obsidian','#121820'],['Racing silver','#9da8b1'],['Electric blue','#125dda'],['Acid green','#b9e526'],['Solar yellow','#f3be22'],['Midnight violet','#643ca6']];
let lab;
try { lab=createScene($('#viewport')); }
catch(error){$('#loading').hidden=true;$('#error').hidden=false;$('#error-message').textContent=`The browser could not start WebGL2: ${error.message}`;throw error;}
let currentCar=CARS['furari-488'],paint=null,carMeshes=[],ownedMaterials=[],ownedTextures=new Set();
let mode='paint',tool='orbit',turntable=false,movingLight=false,showMask=false,brushDown=false,loading=false;
let settings={color:currentCar.color,finish:'gloss',livery:'solid',normal:15,clean:true};
let smoothNormals=true;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function activate(selector,attribute,value){$$(selector).forEach(button=>{const active=button.dataset[attribute]===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}
function loadSettings(car){
  let data={};try{data=JSON.parse(localStorage.getItem(`ru-paint-v1:${car.id}`)??'{}');}catch{}
  return {color:/^#[\da-f]{6}$/i.test(data?.color)?data.color:car.color,finish:FINISHES[data?.finish]?data.finish:'gloss',livery:['solid','twin','center'].includes(data?.livery)?data.livery:'solid',normal:Number.isFinite(data?.normal)?THREE.MathUtils.clamp(data.normal,0,100):15,clean:data?.clean!==false};
}
function saveSettings(){try{localStorage.setItem(`ru-paint-v1:${currentCar.id}`,JSON.stringify(settings));$('#save-status').textContent='Paint settings saved on this device.';}catch{$('#save-status').textContent='Storage unavailable. Export settings to keep this paint.';}}
function updatePaint(save=false){
  paint?.set(settings,mode,showMask);
  $('#custom-color').value=settings.color;$('#hex-value').textContent=settings.color.toUpperCase();
  $('#color-name').textContent=COLORS.find(c=>c[1].toLowerCase()===settings.color.toLowerCase())?.[0]??'Custom';
  $$('.swatch').forEach(button=>{const selected=button.dataset.color.toLowerCase()===settings.color.toLowerCase();button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
  $('#finish').value=settings.finish;$('#livery').value=settings.livery;$('#normal-strength').value=settings.normal;$('#normal-value').textContent=settings.clean?'Off':`${settings.normal}%`;
  $('#clean-materials').checked=settings.clean;$('#normal-strength').disabled=settings.clean;
  $('#mode-badge').textContent=showMask?'BODY SELECTION':{paint:'BODY PAINT',original:'MESHY ORIGINAL',clay:'GEOMETRY CHECK'}[mode];
  activate('[data-mode]','mode',mode);
  if(save)saveSettings();
}
for(const [name,color] of COLORS){
  const button=document.createElement('button');button.className='swatch';button.style.setProperty('--swatch',color);button.dataset.color=color;button.title=name;button.setAttribute('aria-label',name);button.setAttribute('aria-pressed','false');
  button.onclick=()=>{settings.color=color;mode='paint';updatePaint(true);};$('#swatches').appendChild(button);
}

function releaseCar(){
  paint?.dispose();paint=null;
  for(const mesh of carMeshes){lab.carRoot.remove(mesh);mesh.geometry.dispose();}
  ownedMaterials.forEach(m=>m.dispose());ownedMaterials=[];
  for(const texture of ownedTextures){texture.dispose();if(texture.image?.close)texture.image.close();}
  ownedTextures.clear();carMeshes=[];
}
function normalizeMeshes(gltf){
  const meshes=[];gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(object=>{
    if(!object.isMesh)return;
    if(Array.isArray(object.material))throw Error('This lab currently expects a single material per mesh.');
    const geometry=object.geometry.clone().applyMatrix4(object.matrixWorld);
    const material=object.material.clone();ownedMaterials.push(material);
    for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap']){
      if(!material[key])continue;
      ownedTextures.add(material[key]);material[key]=resizeTexture(material[key]);ownedTextures.add(material[key]);
    }
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;meshes.push(mesh);
  });
  const box=new THREE.Box3();for(const mesh of meshes){mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox);}
  const size=box.getSize(new THREE.Vector3());
  if(size.z>size.x)for(const mesh of meshes)mesh.geometry.rotateY(Math.PI/2);
  box.makeEmpty();for(const mesh of meshes){mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox);}
  const center=box.getCenter(new THREE.Vector3()),scale=4.6/box.getSize(new THREE.Vector3()).x;
  for(const mesh of meshes){mesh.geometry.translate(-center.x,-box.min.y,-center.z);mesh.geometry.scale(scale,scale,scale);mesh.geometry.translate(0,.025,0);mesh.geometry.computeBoundingBox();prepareNormals(mesh.geometry);}
  const bounds=new THREE.Box3();for(const mesh of meshes)bounds.union(mesh.geometry.boundingBox);
  return {meshes,bounds};
}
function prepareNormals(geometry){
  if(!geometry.attributes.normal)geometry.computeVertexNormals();
  const positions=geometry.attributes.position,source=geometry.attributes.normal,groups=new Map();
  const keys=[];
  for(let i=0;i<positions.count;i++){
    const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(n=>Math.round(n*10000)).join(',');keys.push(key);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
  }
  const geometric=geometry.clone();geometric.computeVertexNormals();
  const calculated=geometric.attributes.normal;
  const result=source.clone(),n=new THREE.Vector3(),other=new THREE.Vector3(),sum=new THREE.Vector3();
  const threshold=Math.cos(THREE.MathUtils.degToRad(55));
  for(let i=0;i<positions.count;i++){
    n.fromBufferAttribute(calculated,i);sum.set(0,0,0);
    for(const j of groups.get(keys[i])){other.fromBufferAttribute(calculated,j);if(n.dot(other)>=threshold)sum.add(other);}
    if(sum.lengthSq()>0)sum.normalize();else sum.copy(n);result.setXYZ(i,sum.x,sum.y,sum.z);
  }
  geometric.dispose();
  geometry.userData.originalNormals=source.clone();geometry.userData.smoothNormals=result;
  geometry.setAttribute('normal',(smoothNormals?result:source).clone());
}
async function loadCar(id){
  if(loading)return;
  loading=true;$$('[data-car]').forEach(button=>{button.disabled=true;});
  $('#loading').hidden=false;$('#error').hidden=true;$('#loading-progress').style.width='2%';
  currentCar=CARS[id];$('#loading-title').textContent=`Loading ${currentCar.title}`;$('#loading-detail').textContent='Reading the actual generated GLB';
  $('#car-title').textContent=currentCar.title;$('#car-subtitle').textContent=`${currentCar.name} concept / ${currentCar.triangles.toLocaleString()} triangles`;
  activate('[data-car]','car',id);
  try{
    await paint?.flush();
    const gltf=await new GLTFLoader().loadAsync(`/models/${id}.glb`,event=>{
      if(event.total){const pct=Math.round(event.loaded/event.total*75);$('#loading-progress').style.width=`${Math.max(2,pct)}%`;$('#loading-detail').textContent=`Reading GLB · ${Math.round(event.loaded/1048576)} / ${Math.round(event.total/1048576)} MB`;}
    });
    $('#loading-progress').style.width='80%';$('#loading-detail').textContent='Preparing materials and a draft body selection';
    await new Promise(resolve=>requestAnimationFrame(resolve));
    releaseCar();
    const normalized=normalizeMeshes(gltf);carMeshes=normalized.meshes;carMeshes.forEach(mesh=>lab.carRoot.add(mesh));
    paint=await createPaintSystem(carMeshes,normalized.bounds,currentCar,message=>{$('#mask-status').textContent=message;});
    // Geometry and materials have been cloned; release the loader's unused objects.
    gltf.scene.traverse(object=>{if(object.isMesh){object.geometry.dispose();object.material.dispose();}});
    settings=loadSettings(currentCar);showMask=false;$('#mask-view').checked=false;mode='paint';setTool('orbit');updatePaint();
    lab.cameraPreset('hero');lab.requestReflection();turntable=false;$('#turntable').classList.remove('active');$('#turntable').setAttribute('aria-pressed','false');
    activate('[data-camera]','camera','hero');
    $('#asset-notes').textContent=`${currentCar.triangles.toLocaleString()} triangles · ${carMeshes.length} mesh · one material atlas. Preview textures capped at 2K; original GLBs are unchanged. Body masks are draft selections. Separate wheel nodes are still needed for driving.`;
    $('#loading-progress').style.width='100%';$('#loading').hidden=true;
    try{localStorage.setItem('ru-car-lab:last-car',id);}catch{}
  }catch(error){console.error(error);$('#loading').hidden=true;$('#error').hidden=false;$('#error-message').textContent=error.message;}
  finally{loading=false;$$('[data-car]').forEach(button=>{button.disabled=false;});}
}

function setTool(value){tool=value;activate('[data-tool]','tool',tool);lab.controls.enabled=tool==='orbit';document.body.classList.toggle('mask-edit',tool!=='orbit');$('#brush-cursor').hidden=true;$('#interaction-hint').innerHTML=tool==='orbit'?'DRAG TO ORBIT <b>·</b> SCROLL TO ZOOM':`${tool==='add'?'PAINT BODY':'PROTECT SURFACE'} <b>·</b> ESC TO ORBIT`;}
function brush(event){
  if(!paint||loading)return;
  const rect=lab.renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,lab.camera);
  const hit=raycaster.intersectObjects(carMeshes,false)[0];if(hit?.uv)paint.brush(hit.uv,Number($('#brush-size').value),tool==='add');
}
lab.renderer.domElement.addEventListener('pointerdown',event=>{if(tool==='orbit'||event.button!==0||loading)return;event.preventDefault();brushDown=true;paint?.beginStroke();lab.renderer.domElement.setPointerCapture(event.pointerId);brush(event);});
lab.renderer.domElement.addEventListener('pointermove',event=>{
  if(tool==='orbit')return;const rect=$('.stage').getBoundingClientRect();$('#brush-cursor').hidden=false;$('#brush-cursor').style.left=`${event.clientX-rect.left}px`;$('#brush-cursor').style.top=`${event.clientY-rect.top}px`;
  if(brushDown)brush(event);
});
lab.renderer.domElement.addEventListener('pointerup',()=>{brushDown=false;});
lab.renderer.domElement.addEventListener('pointercancel',()=>{brushDown=false;});
lab.renderer.domElement.addEventListener('pointerleave',()=>{$('#brush-cursor').hidden=true;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')setTool('orbit');if((event.ctrlKey||event.metaKey)&&event.key==='z'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();paint?.undo();}});
$$('[data-car]').forEach(button=>button.onclick=()=>loadCar(button.dataset.car));
$$('[data-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.mode;updatePaint();});
$$('[data-camera]').forEach(button=>button.onclick=()=>{turntable=false;$('#turntable').classList.remove('active');$('#turntable').setAttribute('aria-pressed','false');lab.cameraPreset(button.dataset.camera);activate('[data-camera]','camera',button.dataset.camera);});
$$('[data-tool]').forEach(button=>button.onclick=()=>setTool(button.dataset.tool));
$('#turntable').onclick=()=>{turntable=!turntable;$('#turntable').classList.toggle('active',turntable);$('#turntable').setAttribute('aria-pressed',String(turntable));};
$('#custom-color').oninput=event=>{settings.color=event.target.value;mode='paint';updatePaint(true);};
$('#finish').onchange=event=>{settings.finish=event.target.value;mode='paint';updatePaint(true);};
$('#livery').onchange=event=>{settings.livery=event.target.value;mode='paint';updatePaint(true);};
$('#normal-strength').oninput=event=>{settings.normal=Number(event.target.value);updatePaint(true);};
$('#clean-materials').onchange=event=>{settings.clean=event.target.checked;mode='paint';updatePaint(true);};
$('#lighting').onchange=event=>lab.setLighting(event.target.value);
$('#wet').onchange=event=>{lab.setWet(event.target.checked);$('#weather-badge').textContent=event.target.checked?'WET CIRCUIT':'DRY CIRCUIT';};
$('#moving-light').onchange=event=>{movingLight=event.target.checked;lab.requestReflection();};
$('#smooth-normals').onchange=event=>{
  smoothNormals=event.target.checked;
  for(const mesh of carMeshes){mesh.geometry.setAttribute('normal',(smoothNormals?mesh.geometry.userData.smoothNormals:mesh.geometry.userData.originalNormals).clone());if(mesh.geometry.attributes.tangent)mesh.geometry.computeTangents();}
};
$('#mask-view').onchange=event=>{showMask=event.target.checked;updatePaint();};
$('#brush-size').oninput=event=>{$('#brush-value').textContent=event.target.value;};
$('#undo-mask').onclick=()=>paint?.undo();$('#reset-mask').onclick=()=>paint?.reset();
$('#restore-previous-mask').onclick=()=>paint?.restorePreviousMask();
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
$('#export-mask').onclick=async()=>{if(paint)download(await paint.exportMask(),`${currentCar.id}-body-mask.png`);};
$('#import-mask').onchange=async event=>{const file=event.target.files[0];if(!file||!paint)return;try{await paint.importMask(file);}catch{$('#mask-status').textContent='Could not read this mask image.';}event.target.value='';};
$('#export-settings').onclick=()=>download(new Blob([JSON.stringify({schemaVersion:1,car:currentCar.id,sourceTask:currentCar.taskId,...settings,mask:`${currentCar.id}-body-mask.png`},null,2)],{type:'application/json'}),`${currentCar.id}-paint.json`);
$('#retry').onclick=()=>loadCar(currentCar.id);
let previous=performance.now(),fpsStart=previous,frames=0;
rendererLoop();
function rendererLoop(){
  requestAnimationFrame(rendererLoop);const now=performance.now(),dt=Math.min((now-previous)/1000,.05);previous=now;
  lab.frame(now/1000,dt,{turntable,movingLight});frames++;
  if(now-fpsStart>1000){$('#fps').textContent=Math.round(frames*1000/(now-fpsStart));$('#drawcalls').textContent=lab.renderer.info.render.calls;fpsStart=now;frames=0;}
}
let initial='furari-488';try{const stored=localStorage.getItem('ru-car-lab:last-car');if(CARS[stored])initial=stored;}catch{}
loadCar(initial);
