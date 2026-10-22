import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createRearFascia(profile,m){
  const root=new THREE.Group();root.name='rear-fascia';root.position.y=profile.body.lift;
  const fit=profile.rearFascia;if(!fit)return root;
  if(fit.sourceSha256!==profile.body.sha256)throw Error('Rear fascia fit belongs to a different shell.');
  const [a,b,c,d]=fit.surface;
  const surface=(y,z)=>a+b*y+c*z*z+d*y*y+fit.clearance;
  const add=(g,material,name,position)=>{const o=new THREE.Mesh(g,material);o.name=name;o.castShadow=o.receiveShadow=true;if(position)o.position.fromArray(position);root.add(o);return o;};
  const vertices=[],indices=[],N=48,M=12;
  for(let r=0;r<=M;r++)for(let j=0;j<=N;j++){
    const t=r/M,z=(j/N*2-1)*(fit.halfWidth-.045*Math.abs(t*2-1)**6);
    const edge=Math.abs(z)/fit.halfWidth,upper=.60-.09*edge**2,lower=.29+.045*edge**4,y=THREE.MathUtils.lerp(lower,upper,t);
    vertices.push(surface(y,z),y,z);
    if(r<M&&j<N){const i=r*(N+1)+j;indices.push(i,i+1,i+N+1,i+1,i+N+2,i+N+1);}
  }
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  const dark=m.trim.clone();dark.color.set('#202a33');dark.roughness=.42;dark.side=THREE.DoubleSide;
  add(g,dark,'sculpted-rear-insert');
  const plateX=surface(.49,0)+.012;
  add(new RoundedBoxGeometry(.027,.135,.49,4,.014),m.trim,'plate-recess-surround',[plateX,.49,0]);
  const plateMaterial=new THREE.MeshStandardMaterial({color:'#151c23',roughness:.45,metalness:.15});
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#151c23';ctx.fillRect(0,0,768,192);
    const gradient=ctx.createLinearGradient(220,0,540,192);gradient.addColorStop(0,'#d7dce0');gradient.addColorStop(1,'#73828d');ctx.fillStyle=gradient;
    for(const x of [305,385]){ctx.beginPath();ctx.moveTo(x,50);ctx.lineTo(x+43,50);ctx.lineTo(x+105,140);ctx.lineTo(x+62,140);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#8e2630';ctx.fillRect(285,156,250,3);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;plateMaterial.map=texture;plateMaterial.color.set(0xffffff);
  }
  add(new THREE.PlaneGeometry(.43,.105).rotateY(Math.PI/2),plateMaterial,'rear-metallic-graphic-inlay',[plateX+.015,.49,0]);
  for(const sign of [-1,1]){
    const z=sign*.73,y=.37;
    add(new RoundedBoxGeometry(.018,.038,.20,3,.012),m.lampHousing,'rear-reflector-surround-'+sign,[surface(y,z)+.012,y,z]);
    add(new RoundedBoxGeometry(.009,.022,.17,3,.007),m.rearLens,'rear-passive-reflector-'+sign,[surface(y,z)+.024,y,z]);
  }
  add(new RoundedBoxGeometry(.14,.065,1.60,3,.022),m.trim,'diffuser-crossmember',[2.18,.25,0]);
  for(const z of [-.64,-.32,0,.32,.64])add(new RoundedBoxGeometry(.24,.12,.018,2,.005),m.trim,'diffuser-fin-'+z,[2.13,.19,z]);
  return root;
}
