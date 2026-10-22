import * as THREE from 'three';

export const FINISHES={
  gloss:{roughness:.30,metalness:0,clearcoat:1,clearcoatRoughness:.16},
  metallic:{roughness:.34,metalness:.45,clearcoat:1,clearcoatRoughness:.16},
  satin:{roughness:.54,metalness:.08,clearcoat:.22,clearcoatRoughness:.35},
  matte:{roughness:.82,metalness:0,clearcoat:0,clearcoatRoughness:.5}
};
export const PALETTE=[['Corsa red','#b80e21'],['Cobalt blue','#1358b8'],['Pearl white','#e6e6df'],['Graphite','#252d36'],['Champagne silver','#a8a69f'],['Acid green','#a9d520']];

export function createVehicleMaterials(){
  const body=new THREE.MeshPhysicalMaterial({color:'#b80e21',...FINISHES.gloss,side:THREE.DoubleSide});
  const uniforms={stripe:{value:0},trim:{value:1},stripeColor:{value:new THREE.Color(.78,.78,.78)}};
  body.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uStripe:uniforms.stripe,uTrim:uniforms.trim,uStripeColor:uniforms.stripeColor});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vShellPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvShellPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vShellPosition;\nuniform float uStripe,uTrim;\nuniform vec3 uStripeColor;').replace('#include <color_fragment>',`#include <color_fragment>
      float stripe=0.0;
      if(uStripe>.5 && uStripe<1.5)stripe=smoothstep(.07,.08,abs(vShellPosition.z))*(1.0-smoothstep(.145,.155,abs(vShellPosition.z)));
      if(uStripe>1.5)stripe=1.0-smoothstep(.12,.13,abs(vShellPosition.z));
      diffuseColor.rgb=mix(diffuseColor.rgb,uStripeColor,stripe);
      float lowerTrim=(1.0-smoothstep(.19,.215,vShellPosition.y))*uTrim;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.012,.015,.019),lowerTrim);
    `);
  };
  body.customProgramCacheKey=()=> 'ru-assembled-shell-v1';
  const mirrorPaint=new THREE.MeshPhysicalMaterial({color:'#b80e21',...FINISHES.gloss});
  const trim=new THREE.MeshStandardMaterial({color:0x10151b,roughness:.45,metalness:.15});
  const rubber=new THREE.MeshStandardMaterial({color:0x171a1e,roughness:.94,metalness:0});
  const rim=new THREE.MeshStandardMaterial({color:0x8e949c,roughness:.25,metalness:.88,envMapIntensity:1.3});
  const barrel=new THREE.MeshStandardMaterial({color:0x262c34,roughness:.34,metalness:.8});
  const rotor=new THREE.MeshStandardMaterial({color:0x737880,roughness:.46,metalness:.9});
  const caliper=new THREE.MeshStandardMaterial({color:0xc62922,roughness:.3,metalness:.2});
  const glass=new THREE.MeshPhysicalMaterial({color:0x10242f,roughness:.075,metalness:0,ior:1.5,clearcoat:1,clearcoatRoughness:.05,transparent:true,opacity:.88,depthWrite:false,side:THREE.DoubleSide});
  const mirrorGlass=new THREE.MeshStandardMaterial({color:0xb6c6d3,roughness:.035,metalness:1});
  const headlight=new THREE.MeshStandardMaterial({color:0xe2f0ff,emissive:0xc7e1ff,emissiveIntensity:2.8,roughness:.2});
  const taillight=new THREE.MeshStandardMaterial({color:0x9b0816,emissive:0xff0816,emissiveIntensity:1.4,roughness:.2});
  const projector=headlight.clone(),highProjector=headlight.clone(),brakeLight=taillight.clone(),reverseLight=headlight.clone();
  const reflector=new THREE.MeshStandardMaterial({color:0xb9c5d1,metalness:.96,roughness:.19});
  const opticGlass=new THREE.MeshPhysicalMaterial({color:0xa7c2d6,metalness:.12,roughness:.07,clearcoat:1,transparent:true,opacity:.28,depthWrite:false});
  const headlampCover=new THREE.MeshPhysicalMaterial({color:0xf3f7ff,roughness:.055,clearcoat:1,clearcoatRoughness:.06,ior:1.49,transparent:true,opacity:.09,depthWrite:false,side:THREE.DoubleSide});
  const lampHousing=new THREE.MeshStandardMaterial({color:0x080c12,roughness:.28,metalness:.55});
  const frontLens=new THREE.MeshPhysicalMaterial({color:0xb5cad6,roughness:.08,metalness:0,clearcoat:1,transparent:true,opacity:.18,depthWrite:false});
  const rearLens=new THREE.MeshPhysicalMaterial({color:0xbf0815,roughness:.12,metalness:0,clearcoat:1,transparent:true,opacity:.28,depthWrite:false});
  function setPaint({color,finish='gloss',livery='solid',carbon=true}){
    body.color.set(color);mirrorPaint.color.set(color);
    uniforms.stripeColor.value.setRGB(...(.2126*body.color.r+.7152*body.color.g+.0722*body.color.b>.45?[.012,.018,.025]:[.78,.78,.78]));
    Object.assign(body,FINISHES[finish]);Object.assign(mirrorPaint,FINISHES[finish]);
    uniforms.stripe.value={solid:0,twin:1,center:2}[livery]??0;uniforms.trim.value=carbon?1:0;
  }
  return {body,mirrorPaint,trim,rubber,rim,barrel,rotor,caliper,glass,mirrorGlass,headlight,taillight,projector,highProjector,reflector,opticGlass,headlampCover,brakeLight,reverseLight,lampHousing,frontLens,rearLens,setPaint};
}
