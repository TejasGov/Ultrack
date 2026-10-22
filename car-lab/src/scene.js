import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function noiseTexture(kind) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'), data=ctx.createImageData(512,512);
  let seed=7319;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4,n=random(), broad=Math.sin(x*.024+Math.cos(y*.035)*2)*Math.cos(y*.029)*.5+.5;
    if(kind==='normal'){data.data[i]=128+(n-.5)*35;data.data[i+1]=128+(random()-.5)*35;data.data[i+2]=254;}
    else{const v=kind==='color'?65+n*33:broad*100+n*40+55;data.data[i]=data.data[i+1]=data.data[i+2]=v;}
    data.data[i+3]=255;
  }
  ctx.putImageData(data,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(30,6);texture.anisotropy=8;
  if(kind==='color')texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

export function createScene(container) {
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x9b9590,30,145);
  const camera=new THREE.PerspectiveCamera(42,1,.1,400);camera.position.set(-5.6,1.8,6.1);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.68,0);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=3.5;controls.maxDistance=17;controls.maxPolarAngle=Math.PI*.48;
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const baseEnv=pmrem.fromScene(room,.035);room.dispose();scene.environment=baseEnv.texture;
  const skyCanvas=document.createElement('canvas');skyCanvas.width=2048;skyCanvas.height=1024;
  const skyTexture=new THREE.CanvasTexture(skyCanvas);skyTexture.colorSpace=THREE.SRGBColorSpace;
  const sky=new THREE.Mesh(new THREE.SphereGeometry(180,40,24),new THREE.MeshBasicMaterial({map:skyTexture,side:THREE.BackSide,fog:false}));scene.add(sky);
  const hemi=new THREE.HemisphereLight(0xbacbdf,0x4e4539,2);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd5a0,4.4);sun.position.set(-25,13,-22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;sun.shadow.camera.near=.5;sun.shadow.camera.far=75;sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;scene.add(sun);scene.add(sun.target);
  const sunOrb=new THREE.Mesh(new THREE.SphereGeometry(3,24,16),new THREE.MeshBasicMaterial({color:new THREE.Color(3,1.9,.9),fog:false}));sunOrb.position.copy(sun.position).normalize().multiplyScalar(150);scene.add(sunOrb);
  const fill=new THREE.DirectionalLight(0xaec9ee,.9);fill.position.set(10,8,15);scene.add(fill);
  const environment=new THREE.Group();scene.add(environment);
  function box(w,h,d,x,y,z,color,matOptions={}){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.65,...matOptions}));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;environment.add(mesh);return mesh;
  }
  // Pit garages and continuous roof fascia.
  box(140,.35,7,0,5.25,-11,0x5a6571,{metalness:.4});
  box(140,.5,.18,0,4.8,-7.5,0xe2ddcc);
  for(let i=-9;i<=9;i++){
    const x=i*6.2;
    box(6,4.6,5,x,2.3,-11.3,0x8a8e8e);
    box(5.2,3.15,.12,x,1.65,-8.72,0x373f48,{metalness:.48,roughness:.4});
    box(.2,4.7,.35,x-3,2.35,-8.5,0xb0aca2);
    box(5.2,.2,.15,x,3.7,-8.55,0xdbe5da,{emissive:0xe8e9ca,emissiveIntensity:.8});
    for(let j=0;j<7;j++)box(5.15,.045,.045,x,.45+j*.38,-8.63,0x65717a,{metalness:.65});
    box(5.3,.8,.1,x,4.45,-8.52,i%3===0?0x91a15b:0x384b60);
    box(5.8,1.7,.15,x,6.5,-10.4,0x37505f,{metalness:.65,roughness:.16});
    box(.1,2,.2,x-2.8,6.4,-10.25,0x84919d);
  }
  box(140,.2,4.3,0,7.5,-11.3,0x4d5763,{metalness:.4});
  for(const mesh of environment.children)mesh.position.z-=9;
  // Grandstand terraces, colored seat rows, and catch fencing.
  for(let row=0;row<7;row++){
    box(120,.28,.85,0,.65+row*.57,12+row*.84,0x676b70);
    for(let section=-6;section<=6;section++)box(7.7,.35,.4,section*8.3,1+row*.57,12+row*.84,(section+row)%4===0?0xd0c8b8:0x354d63);
  }
  box(120,.25,8.5,0,7.6,15,0x303b49,{metalness:.3});
  for(let x=-60;x<=60;x+=8){box(.18,7.6,.18,x,3.8,11.6,0x444e5b);box(.07,3.4,.07,x,1.7,8.8,0x7d8790);}
  const fenceMaterial=new THREE.LineBasicMaterial({color:0x8e9ca9,transparent:true,opacity:.3});
  const fencePositions=[];
  for(let x=-62;x<62;x+=1.6)fencePositions.push(x,.4,8.8,x,3.1,8.8);
  for(let y=.4;y<=3.2;y+=.35)fencePositions.push(-62,y,8.8,62,y,8.8);
  const fenceGeo=new THREE.BufferGeometry();fenceGeo.setAttribute('position',new THREE.Float32BufferAttribute(fencePositions,3));environment.add(new THREE.LineSegments(fenceGeo,fenceMaterial));
  box(140,.65,.5,0,.325,8.3,0x6c7479,{metalness:.5});box(140,.65,.5,0,.325,-7.8,0x77796e,{metalness:.4});
  const farGround=new THREE.Mesh(new THREE.PlaneGeometry(500,400),new THREE.MeshStandardMaterial({color:0x353c31,roughness:1}));farGround.rotation.x=-Math.PI/2;farGround.position.y=-.05;scene.add(farGround);
  const reflector=new Reflector(new THREE.PlaneGeometry(150,42),{clipBias:.003,textureWidth:1024,textureHeight:768,color:0x64707a});reflector.rotation.x=-Math.PI/2;reflector.position.y=-.015;scene.add(reflector);
  const asphalt=new THREE.MeshPhysicalMaterial({color:0x93979b,map:noiseTexture('color'),normalMap:noiseTexture('normal'),normalScale:new THREE.Vector2(.16,.16),roughnessMap:noiseTexture('rough'),roughness:.35,metalness:.02,clearcoat:.8,clearcoatRoughness:.18,transparent:true,opacity:.7});
  const road=new THREE.Mesh(new THREE.PlaneGeometry(150,42),asphalt);road.rotation.x=-Math.PI/2;road.receiveShadow=true;road.renderOrder=1;scene.add(road);
  const marking=new THREE.MeshBasicMaterial({color:0xe1ddcb,transparent:true,opacity:.65,depthWrite:false});
  const yellow=new THREE.MeshBasicMaterial({color:0xe0bc4e,transparent:true,opacity:.7,depthWrite:false});
  function stripe(w,d,x,z,material=marking){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.009,z);scene.add(mesh);}
  stripe(145,.09,0,-5.6,yellow);stripe(145,.12,0,6.7);
  for(let x=-65;x<70;x+=8){stripe(3,.09,x,1.9);stripe(.1,1.3,x,-3.1);stripe(2.6,.08,x+1.3,-3.75);}
  const batches=new Map();
  for(const child of [...environment.children]){
    if(!child.isMesh)continue;
    child.updateMatrix();
    const m=child.material,key=[m.color.getHex(),m.roughness,m.metalness,m.emissive.getHex(),m.emissiveIntensity].join(':');
    if(!batches.has(key))batches.set(key,{geometries:[],material:m});
    batches.get(key).geometries.push(child.geometry.clone().applyMatrix4(child.matrix));
    child.geometry.dispose();if(batches.get(key).material!==m)m.dispose();environment.remove(child);
  }
  for(const batch of batches.values()){
    const mesh=new THREE.Mesh(mergeGeometries(batch.geometries),batch.material);mesh.castShadow=mesh.receiveShadow=true;environment.add(mesh);batch.geometries.forEach(g=>g.dispose());
  }
  const carRoot=new THREE.Group();scene.add(carRoot);
  const lightRig=new THREE.Group();scene.add(lightRig);
  for(let i=0;i<3;i++){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,3.5,2),new THREE.MeshBasicMaterial({color:new THREE.Color(i===1?1.3:4,i===1?2.3:3,i===1?4:2.2)}));
    const angle=i*Math.PI*2/3;mesh.position.set(Math.cos(angle)*6,3.2,Math.sin(angle)*6);mesh.lookAt(0,1,0);mesh.layers.set(1);lightRig.add(mesh);
  }
  lightRig.visible=false;
  const cubeTarget=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const cubeCamera=new THREE.CubeCamera(.1,220,cubeTarget);cubeCamera.layers.enable(1);cubeCamera.position.set(0,1.1,0);
  let reflectedEnv=null,needReflection=true,lightMode='sunset',wet=true,lastReflection=-10;
  function captureReflection(time=0){
    const carVisible=carRoot.visible,mirrorVisible=reflector.visible;
    carRoot.visible=false;reflector.visible=false;scene.environment=baseEnv.texture;
    cubeCamera.update(renderer,scene);
    const next=pmrem.fromCubemap(cubeTarget.texture);
    scene.environment=next.texture;reflectedEnv?.dispose();reflectedEnv=next;
    carRoot.visible=carVisible;reflector.visible=mirrorVisible;needReflection=false;lastReflection=time;
  }
  function setLighting(mode){
    lightMode=mode;
    const ctx=skyCanvas.getContext('2d'),g=ctx.createLinearGradient(0,0,0,1024);
    const colors=mode==='sunset'?['#20334e','#6e7c9b','#e2b797','#726965']:mode==='overcast'?['#657c92','#9eabb6','#c4c9c8','#797f85']:['#151b27','#2c3848','#586777','#303743'];
    g.addColorStop(0,colors[0]);g.addColorStop(.4,colors[1]);g.addColorStop(.55,colors[2]);g.addColorStop(1,colors[3]);ctx.fillStyle=g;ctx.fillRect(0,0,2048,1024);
    if(mode==='sunset'){const glow=ctx.createRadialGradient(420,480,4,420,480,310);glow.addColorStop(0,'#ffeccacc');glow.addColorStop(.15,'#fbd5a36b');glow.addColorStop(1,'#fbd5a300');ctx.fillStyle=glow;ctx.fillRect(0,0,2048,1024);}
    skyTexture.needsUpdate=true;
    sun.color.set(mode==='sunset'?0xffd5a4:0xd6e4f1);sun.intensity=mode==='sunset'?4:mode==='overcast'?1.25:1.7;
    sun.position.set(mode==='sunset'?-38:-12,mode==='sunset'?16:30,7);sunOrb.position.copy(sun.position).normalize().multiplyScalar(150);sunOrb.visible=mode==='sunset';
    hemi.intensity=mode==='studio'?1.15:2;fill.intensity=mode==='studio'?1.3:.85;
    scene.fog.color.set(mode==='sunset'?0x9c948d:mode==='overcast'?0x9ca8b2:0x37424f);
    lightRig.visible=mode==='studio';needReflection=true;
  }
  function setWet(value){wet=value;reflector.visible=value;asphalt.opacity=value?.72:1;asphalt.roughness=value?.38:1;asphalt.clearcoat=value?.9:0;asphalt.normalScale.setScalar(value?.14:.3);needReflection=true;}
  setLighting('sunset');setWet(true);
  const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(container);
  const presets={hero:[-5.6,1.8,6.1],front:[-7.3,1.3,.05],side:[0,1.4,8],rear:[7.3,1.45,.05]};
  return {
    scene,renderer,camera,controls,carRoot,
    setLighting,setWet,
    requestReflection(){needReflection=true;},
    cameraPreset(name){carRoot.rotation.y=0;camera.position.fromArray(presets[name]??presets.hero);controls.target.set(0,.68,0);controls.update();},
    frame(time,dt,{turntable=false,movingLight=false}={}){
      if(turntable)carRoot.rotation.y+=dt*.22;
      lightRig.visible=movingLight||lightMode==='studio';
      if(movingLight){lightRig.rotation.y+=dt*.35;if(time-lastReflection>.7)needReflection=true;}
      if(needReflection)captureReflection(time);
      controls.update();renderer.render(scene,camera);
    },
    get wet(){return wet;}
  };
}
