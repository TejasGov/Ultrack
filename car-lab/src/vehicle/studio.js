import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const GRADES={
  neutral:{gain:[1,1,1],saturation:1,contrast:1,exposure:.9},
  warm:{gain:[1.08,1,.91],saturation:.94,contrast:1.06,exposure:.9},
  cool:{gain:[.94,1,1.08],saturation:.94,contrast:1.04,exposure:.9}
};
export function createStudio(container){
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#161c23');scene.fog=new THREE.Fog('#161c23',13,38);
  const camera=new THREE.PerspectiveCamera(38,1,.08,100);camera.position.set(-4.3,1.65,4.8);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.65,0);controls.minDistance=3.3;controls.maxDistance=11;controls.maxPolarAngle=Math.PI*.49;controls.update();
  const root=new THREE.Group();root.name='vehicle';scene.add(root);
  const environment=new THREE.Scene();environment.background=new THREE.Color(.045,.052,.065);
  const cardMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(4,4,4),side:THREE.DoubleSide});
  for(const [size,position] of [[[1.5,3.6,1],[-4,2.8,3]],[[1.2,3.4,1],[4,3,-3]],[[4.5,1.2,1],[0,5,0]],[[3.5,.7,1],[0,2.5,-5]],[[5,1.5,1],[0,2.3,5]]]){
    const card=new THREE.Mesh(new THREE.PlaneGeometry(size[0],size[1]),cardMaterial);card.position.fromArray(position);card.lookAt(0,.7,0);environment.add(card);
  }
  const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(environment,.03);scene.environment=env.texture;scene.environmentIntensity=.7;
  environment.traverse(o=>o.geometry?.dispose());cardMaterial.dispose();pmrem.dispose();
  const key=new THREE.DirectionalLight(0xe9efff,2.3);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=.018;key.shadow.bias=-.00015;scene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,.5);fill.position.set(3,2,-4);scene.add(fill);const hemi=new THREE.HemisphereLight(0xb8c7dc,0x20252a,.45);scene.add(hemi);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x222a32,roughness:.54,metalness:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(3.45,3.45,.045,128),new THREE.MeshStandardMaterial({color:0x242e36,roughness:.52,metalness:.25}));disc.position.y=-.028;disc.receiveShadow=true;scene.add(disc);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.42,.006,8,128),new THREE.MeshBasicMaterial({color:0x66818a}));ring.rotation.x=Math.PI/2;ring.position.y=-.002;scene.add(ring);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.16,.22,3.5);composer.addPass(bloom);
  const grade=new ShaderPass({
    uniforms:{tDiffuse:{value:null},gain:{value:new THREE.Vector3(1,1,1)},saturation:{value:1},contrast:{value:1}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform sampler2D tDiffuse; uniform vec3 gain; uniform float saturation,contrast; varying vec2 vUv; void main(){vec4 p=texture2D(tDiffuse,vUv);vec3 c=p.rgb*gain;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,saturation);c=max(vec3(0.0),(c-vec3(.18))*contrast+vec3(.18));gl_FragColor=vec4(c,p.a);}'
  });composer.addPass(grade);composer.addPass(new OutputPass());
  let renderPending=false;
  function render(){if(renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;composer.render();});}
  controls.addEventListener('change',render);
  new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();if(camera.aspect<1.3&&controls.getDistance()<7.5){camera.position.sub(controls.target).multiplyScalar(7.5/controls.getDistance()).add(controls.target);controls.update();}render();}).observe(container);
  const presets={hero:[-4.3,1.65,4.8],front:[-6,1.25,0],side:[0,1.2,7.0],rear:[6,1.6,.1],rearQuarter:[4.3,1.8,4.8],beams:[-7,4.6,7.3]};
  return {root,scene,renderer,camera,controls,render,
    cameraPreset(name){camera.position.fromArray(presets[name]??presets.hero);if(camera.aspect<1.3)camera.position.multiplyScalar(1.25);controls.target.set(...(name==='beams'?[-2.8,.1,0]:[0,.65,0]));controls.update();render();},
    setLook(name,exposure){const p=GRADES[name]??GRADES.neutral;grade.uniforms.gain.value.fromArray(p.gain);grade.uniforms.saturation.value=p.saturation;grade.uniforms.contrast.value=p.contrast;renderer.toneMappingExposure=exposure??p.exposure;render();},
    setInspection(dim){key.intensity=dim?.40:2.3;fill.intensity=dim?.12:.5;hemi.intensity=dim?.20:.45;scene.environmentIntensity=dim?.24:.7;render();},
    setReflectionAngle(degrees){const angle=THREE.MathUtils.degToRad(degrees);scene.environmentRotation.y=angle;key.position.set(Math.cos(angle)*5,7,Math.sin(angle)*5);render();}
  };
}
