import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VEHICLES, vehicleKey } from './vehicle/profiles.js';
import { validateProfile } from './vehicle/validation.js';
import { createVehicleMaterials, PALETTE, FINISHES } from './vehicle/materials.js';
import { createWheelSet, createGlass, createMirrors, disposeParts } from './vehicle/parts.js';
import { createVehicleLights } from './vehicle/lights.js';
import { createStudio } from './vehicle/studio.js';
import { createCoachwork } from './vehicle/coachwork.js';
import { createNuvolariDetails } from './vehicle/nuvolari-details.js';
import { createJaguarDetails } from './vehicle/jaguar-details.js';
import { createExhaust } from './vehicle/exhaust.js';
import { createRearFascia } from './vehicle/rear-fascia.js';
import { createCompleteCar, createCompleteCarLights } from './vehicle/complete-car.js';
import { normalizeShell } from './vehicle/body.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const selected=vehicleKey(new URLSearchParams(location.search).get('car')),profile=VEHICLES[selected];
const isComplete=profile.body.kind==='complete-car';
validateProfile(profile);$('#raw-link').hidden=isComplete||!import.meta.env.DEV||!['av12','mp1x'].includes(selected);
$('.title h1').textContent=profile.name;$('.title p').textContent=profile.description??'One generated shell. Reusable components.';
document.title=`RaceUltimate — ${profile.name} Assembly`;
$('#raw-link').href=selected==='av12'?'/surface-review.html?experiment=body-only':'/surface-review.html?experiment=body-only&car=mclaren';
for(const [key,p] of Object.entries(VEHICLES)){const option=document.createElement('option');option.value=key;option.textContent=`${p.name} · ${key==='av12'?'Lambo':p.concept}`;$('#assembly-car').appendChild(option);}
$('#assembly-car').value=selected;$('#assembly-car').onchange=e=>{const url=new URL(location.href);url.searchParams.set('car',e.target.value);location.assign(url);};
const studio=createStudio($('#assembly-viewport')),materials=createVehicleMaterials();
if(profile.caliperColor)materials.caliper.color.set(profile.caliperColor);
for(const key of ['envMapIntensity','roughness','opacity'])if(Number.isFinite(profile.glassMaterial?.[key]))materials.glass[key]=profile.glassMaterial[key];
const defaults={color:'#b80e21',finish:'gloss',livery:'solid',carbon:true,wheels:true,glass:true,mirrors:true,lights:true,lightMode:'low',brake:0,reverse:false,dim:false,wheelStyle:'split',rimColor:'silver',grade:'neutral',exposure:.9,reflection:0,steering:0,track:0,guides:false,...profile.defaults};
let settings={...defaults};
try{
  const saved=JSON.parse(localStorage.getItem(`ru-assembly-v1:${profile.id}`)??'null');
  if(saved?.bodyHash===profile.body.sha256){
    const d=saved.settings??{};
    for(const k of ['carbon','wheels','glass','mirrors','lights','guides','reverse','dim'])if(typeof d[k]==='boolean')settings[k]=d[k];
    if(['off','running','low','high'].includes(d.lightMode))settings.lightMode=d.lightMode;
    if(Number.isFinite(d.brake))settings.brake=THREE.MathUtils.clamp(d.brake,0,1);
    if(/^#[a-f\d]{6}$/i.test(d.color))settings.color=d.color;
    for(const [k,options] of Object.entries({finish:Object.keys(FINISHES),livery:['solid','twin','center'],wheelStyle:['split','turbine'],rimColor:['silver','black','bronze'],grade:['neutral','warm','cool']}))if(options.includes(d[k]))settings[k]=d[k];
    for(const [k,min,max] of [['exposure',.5,1.4],['reflection',0,360],['steering',-28,28],['track',-60,60]])if(Number.isFinite(d[k]))settings[k]=THREE.MathUtils.clamp(d[k],min,max);
  }
}catch{}
let wheelSet,bodyTriangles=0;
const lighting=isComplete?createCompleteCarLights(profile,materials):createVehicleLights(profile,materials);
const parts={glass:isComplete?new THREE.Group():createGlass(profile,materials),mirrors:isComplete?new THREE.Group():createMirrors(profile,materials),lights:lighting.root};
studio.root.add(createRearFascia(profile,materials));
studio.root.add(createCoachwork(profile,materials));
studio.root.add(createNuvolariDetails(profile,materials));
studio.root.add(createJaguarDetails(profile,materials));
const exhaust=createExhaust(profile);studio.root.add(exhaust.root);
if(exhaust.sockets.length){
  const button=document.createElement('button');button.id='nitro-preview';button.type='button';button.textContent='NITRO PREVIEW';button.setAttribute('aria-pressed','false');$('.camera').appendChild(button);
  let active=false,frame=0;
  const stop=()=>{active=false;cancelAnimationFrame(frame);exhaust.update();button.textContent='NITRO PREVIEW';button.setAttribute('aria-pressed','false');studio.render();};
  const tick=time=>{if(!active)return;exhaust.update({boost:1,time:time/1000});studio.render();frame=requestAnimationFrame(tick);};
  button.onclick=()=>{if(active){stop();return;}active=true;button.textContent='STOP NITRO';button.setAttribute('aria-pressed','true');studio.cameraPreset('rearQuarter');frame=requestAnimationFrame(tick);};
  $('#reset-assembly').addEventListener('click',stop);window.addEventListener('pagehide',stop);
}
Object.values(parts).forEach(p=>studio.root.add(p));
const guides=new THREE.Group();guides.name='attachment-guides';studio.root.add(guides);
const guideMaterial=new THREE.MeshBasicMaterial({color:0xe1f665,depthTest:false,transparent:true,opacity:.9});
for(const axle of ['front','rear'])for(const sign of [-1,1]){
  const w=profile.wheels[axle],marker=new THREE.Mesh(new THREE.SphereGeometry(.026,12,8),guideMaterial);marker.name=`guide-wheel_${axle==='front'?'F':'R'}${sign===1?'L':'R'}`;marker.position.set(w.x,w.radius,sign*w.track/2);marker.renderOrder=20;guides.add(marker);
}
if(!isComplete)for(const sign of [-1,1]){const marker=new THREE.Mesh(new THREE.SphereGeometry(.024,12,8),guideMaterial);marker.position.set(profile.mirrors.mount[0],profile.mirrors.mount[1]+profile.body.lift,profile.mirrors.mount[2]*sign);marker.renderOrder=20;guides.add(marker);}
function buildWheels(){if(isComplete)return;if(wheelSet){studio.root.remove(wheelSet.root);disposeParts(wheelSet.root);}wheelSet=createWheelSet(profile,materials,settings.wheelStyle);studio.root.add(wheelSet.root);}
buildWheels();
for(const [label,color] of PALETTE){const button=document.createElement('button');button.className='swatch';button.style.background=color;button.dataset.color=color;button.setAttribute('aria-label',label);button.title=label;button.onclick=()=>{settings.color=color;apply(true);};$('#assembly-swatches').appendChild(button);}
function recipe(){return {schemaVersion:1,car:profile.id,bodyHash:profile.body.sha256,sourceTask:profile.body.taskId,profile,settings:{...settings},resources:isComplete?{wheels:'source-modeled',mirrors:'source-modeled',glass:'source-modeled',lights:'source-modeled-reactive'}:{wheels:'procedural-wheel-v1',mirrors:'procedural-mirror-v1',glass:'anchor-patches-v1',lights:profile.lights.headlamp.type==='enclosed'?'enclosed-headlamps-v4':(profile.lights.rearRecess||profile.lights.rearFits)?'cavity-optics-v3':'reactive-optics-v2'},note:isComplete?'Complete source model with independently controlled paint and native lamps. See project README for attribution and license.':'Assembly recipe; generated shell GLB must be distributed separately. No driving physics or final fit approval.'};}
function apply(save=false){
  materials.setPaint(settings);materials.rim.color.set({silver:'#8e949c',black:'#303943',bronze:'#8b6944'}[settings.rimColor]);
  lighting.update({mode:settings.lightMode,brake:settings.brake,reverse:settings.reverse});
  $('#light-mode').value=settings.lightMode;$('#light-brake').value=settings.brake;$('#brake-value').textContent=`${Math.round(settings.brake*100)}%`;
  $('#light-reverse').checked=settings.reverse;$('#light-dim').checked=settings.dim;
  $('#light-state').textContent=!settings.lights?'Lamp assembly hidden':`${{off:'Lamps off',running:'Running lights',low:'Low beam',high:'High beam'}[settings.lightMode]} · brake ${Math.round(settings.brake*100)}%${settings.reverse?' · reverse':''}`;
  for(const key of ['glass','mirrors','lights']){parts[key].visible=settings[key];$(`#assembly-${key}`).checked=settings[key];}
  if(wheelSet)wheelSet.root.visible=settings.wheels;$('#assembly-wheels').checked=settings.wheels;
  for(const w of wheelSet?.wheels??[]){w.pivot.rotation.y=w.axle==='front'?THREE.MathUtils.degToRad(settings.steering):0;w.pivot.position.z=(w.side==='L'?1:-1)*(w.spec.track+settings.track/1000)/2;guides.getObjectByName(`guide-${w.pivot.name}`).position.copy(w.pivot.position);}
  guides.visible=settings.guides;$('#fit-guides').checked=settings.guides;
  for(const [id,key] of Object.entries({'assembly-color':'color','assembly-finish':'finish','assembly-livery':'livery','wheel-style':'wheelStyle','rim-color':'rimColor','assembly-grade':'grade','assembly-exposure':'exposure','assembly-reflections':'reflection','wheel-steering':'steering','fit-track':'track'}))$(`#${id}`).value=settings[key];
  $('#assembly-carbon').checked=settings.carbon;
  $('#exposure-value').textContent=settings.exposure.toFixed(2);$('#reflection-value').textContent=`${settings.reflection}°`;$('#steer-value').textContent=`${settings.steering}°`;$('#track-value').textContent=`${settings.track} mm`;
  $$('.swatch').forEach(b=>{const active=b.dataset.color===settings.color;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  studio.setLook(settings.grade,settings.exposure);studio.setReflectionAngle(settings.reflection);studio.setInspection(settings.dim);studio.render();
  const active=['wheels','glass','mirrors','lights'].filter(k=>settings[k]).length;$('#stage-badge').textContent=active?`${active}/4 COMPONENT SETS · PROTOTYPE`:'BODY SHELL ONLY';
  if(save){try{localStorage.setItem(`ru-assembly-v1:${profile.id}`,JSON.stringify({bodyHash:profile.body.sha256,settings}));$('#assembly-status').textContent='Assembly recipe saved on this device.';}catch{$('#assembly-status').textContent='Export the recipe to keep these settings.';}}
}
for(const [id,key] of Object.entries({'assembly-color':'color','assembly-finish':'finish','assembly-livery':'livery','rim-color':'rimColor','assembly-grade':'grade'}))$(`#${id}`).addEventListener('input',e=>{settings[key]=e.target.value;apply(true);});
for(const key of ['wheels','glass','mirrors','lights','carbon'])$(`#assembly-${key}`).onchange=e=>{settings[key]=e.target.checked;apply(true);};
$('#wheel-style').onchange=e=>{settings.wheelStyle=e.target.value;buildWheels();apply(true);};
$('#light-mode').onchange=e=>{settings.lightMode=e.target.value;apply(true);};
$('#light-brake').oninput=e=>{settings.brake=Number(e.target.value);apply(true);};
for(const [id,key] of [['light-reverse','reverse'],['light-dim','dim']])$(`#${id}`).onchange=e=>{settings[key]=e.target.checked;apply(true);};
for(const [id,key] of Object.entries({'assembly-exposure':'exposure','assembly-reflections':'reflection','wheel-steering':'steering','fit-track':'track'}))$(`#${id}`).oninput=e=>{settings[key]=Number(e.target.value);apply(true);};
$('#fit-guides').onchange=e=>{settings.guides=e.target.checked;apply(true);};
$$('[data-camera]').forEach(b=>b.onclick=()=>{studio.cameraPreset(b.dataset.camera);$$('[data-camera]').forEach(c=>c.classList.toggle('active',c===b));});
$('#reset-assembly').onclick=()=>{settings={...defaults};buildWheels();apply(true);studio.cameraPreset('hero');};
$('#export-assembly').onclick=()=>{const json=JSON.stringify(recipe(),null,2);$('#recipe-json').value=json;$('#recipe-json').hidden=false;$('#recipe-label').hidden=false;const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${profile.id}-assembly.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);$('#assembly-status').textContent='Recipe ready below; download requested. Copy the JSON if your browser does not save downloads.';};
if(isComplete)for(const id of ['wheel-style','rim-color','assembly-carbon']){$('#'+id).disabled=true;$('#'+id).title='Original modeled wheels and trim are preserved.';}
apply();

async function loadBody(){
  try{
    const gltf=await new GLTFLoader().loadAsync(new URLSearchParams(location.search).get('surface')==='raw'&&profile.body.sourceUrl?profile.body.sourceUrl:profile.body.url,e=>{if(e.total)$('#load-detail').textContent=`Body shell · ${Math.round(e.loaded/e.total*100)}%`;});
    const body=isComplete?createCompleteCar(gltf.scene,profile,materials,lighting):normalizeShell(gltf.scene,profile,materials.body);bodyTriangles=body.triangles;studio.root.add(body.root);
    if(isComplete){wheelSet=body.wheelSet;for(const key of ['glass','mirrors']){studio.root.remove(parts[key]);parts[key]=body.parts[key];}}
    if(!isComplete)gltf.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    $('#assembly-loading').hidden=true;$('#stats').textContent=`${(bodyTriangles/1e6).toFixed(2)}M BODY TRIANGLES · SEPARATE PARTS`;$('#assembly-status').textContent=profile.fitStatus;$('#source-limit').textContent=`Source: ${bodyTriangles.toLocaleString()} body triangles. ${profile.fitStatus}`;apply();
  }catch(e){console.error(e);$('#assembly-loading').hidden=true;$('#assembly-error').hidden=false;$('#assembly-error').textContent=`Assembly could not load: ${e.message}`;}
}
loadBody();
