import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { setLamps } from './carkit/lamps.js';

/** Small standalone showroom. Shares the selected car, never the circuit or its render passes. */
export class GarageRoom {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#171d25');
    this.camera = new THREE.PerspectiveCamera(48, 1, .1, 60);
    this.camera.position.set(7.5, 2.8, 6.6);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    Object.assign(this.controls, { enabled: false, autoRotate: true, autoRotateSpeed: .35, enableDamping: true,
      enablePan: false, minDistance: 6, maxDistance: 11.5, maxPolarAngle: Math.PI * .48 });
    this.controls.target.set(0, .7, 0);
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, .04); this.scene.environment = this.environment.texture;
    room.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x5b6170, 2.2));
    for (const [x,z,power] of [[-4,2,70],[3,-3,90]]) {
      const light = new THREE.PointLight(0xf4f5ff, power, 18, 2); light.position.set(x,4,z); this.scene.add(light);
    }
    const concrete = new THREE.MeshStandardMaterial({color:0x323b46,roughness:.72});
    const floor = new THREE.MeshStandardMaterial({color:0x232a33,roughness:.48,metalness:.12});
    const box=(x,y,z,w,h,d,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);this.scene.add(mesh);return mesh;};
    box(0,-.16,0,28,.2,28,floor);
    // Orbit stays inside the room, including at maximum zoom-out; walls cannot occlude the car.
    box(0,4,-13,28,8,.2,concrete); box(-13,4,0,.2,8,28,concrete);
    const platform=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.65,.1,64),floor);platform.position.y=-.02;this.scene.add(platform);
    const panel=new THREE.MeshBasicMaterial({color:0xf4f7ff});
    for(const x of [-5,-2,2,5])box(x,5,-1,.18,.04,9,panel);
    const trim=new THREE.MeshBasicMaterial({color:0x81bdce});
    box(0,.35,-12.85,24,.035,.035,trim);
    for(const x of [-6,-2,2,6])box(x,2.4,-12.85,.06,3.4,.035,panel);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
    const ctx=shadowCanvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,4,32,32,32);
    gradient.addColorStop(0,'rgba(0,0,0,.7)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(6,3),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.04;this.scene.add(shadow);
    this.savedPosition=new THREE.Vector3();this.savedQuaternion=new THREE.Quaternion();
  }

  resize(width,height,garage) {
    const key=`${width}:${height}:${garage}`;if(key===this.size)return;this.size=key;
    this.camera.aspect=width/height;
    this.camera.setViewOffset(width,height,garage?width*.05:0,0,width,height);
    this.camera.updateProjectionMatrix();
  }

  render(car,dt,{garage=false,reduceMotion=false}={}) {
    if(!car)return;
    const renderer=this.renderer,root=car.root,parent=root.parent,visible=root.visible;
    this.savedPosition.copy(root.position);this.savedQuaternion.copy(root.quaternion);
    // Existing race captures must not tint the room; restore material maps after this draw.
    const maps=[];const seen=new Set();root.traverse(o=>{
      for(const m of [].concat(o.material??[]))if(!seen.has(m)){seen.add(m);if(m.envMap){maps.push([m,m.envMap]);m.envMap=null;}}
    });
    const exposure=renderer.toneMappingExposure,shadow=renderer.shadowMap.enabled;
    try {
      renderer.toneMappingExposure=1;renderer.shadowMap.enabled=false;
      this.scene.add(root);root.position.set(0,.05,0);root.quaternion.identity();root.visible=true;
      if(car.band!==0){
        car.band=0;car.detail.forEach(o=>{o.visible=true;});car.simple.forEach(o=>{o.visible=false;});
        car.wheelRoot.visible=true;car.proxy.visible=false;car.sideMirrors.visible=true;
      }
      setLamps(car,'running',0);car.beams.forEach(b=>{b.visible=false;});
      this.controls.enabled=garage;this.controls.autoRotate=!reduceMotion;this.controls.update(dt);
      this.resize(innerWidth,innerHeight,garage);
      renderer.info.reset();renderer.render(this.scene,this.camera);
    } finally {
      if(parent)parent.add(root);else this.scene.remove(root);
      root.position.copy(this.savedPosition);root.quaternion.copy(this.savedQuaternion);root.visible=visible;
      maps.forEach(([m,map])=>{m.envMap=map;});
      renderer.toneMappingExposure=exposure;renderer.shadowMap.enabled=shadow;
    }
  }

  suspend(){this.controls.enabled=false;}
}
