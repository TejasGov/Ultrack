import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createCoachwork(profile,m){
  const root=new THREE.Group();root.name='coachwork';root.position.y=profile.body.lift;
  const fit=profile.coachwork;if(!fit)return root;
  if(fit.sourceSha256!==profile.body.sha256)throw Error('Panel gaps belong to a different body.');
  const shadow=new THREE.MeshStandardMaterial({color:'#06090c',roughness:.65,metalness:0,side:THREE.DoubleSide});
  for(const seam of fit.seams){
    const points=seam.points.map(p=>new THREE.Vector3(...p)),positions=[],indices=[];
    const normal=new THREE.Vector3();normal.setComponent(seam.axis,1);
    for(let i=0;i<points.length;i++){
      const tangent=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(i-1,0)]).normalize();
      const across=new THREE.Vector3().crossVectors(normal,tangent).normalize().multiplyScalar(seam.width/2);
      positions.push(...points[i].clone().sub(across).toArray(),...points[i].clone().add(across).toArray());
      if(i<points.length-1){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
    }
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const gap=new THREE.Mesh(geometry,shadow);gap.name='panel-gap-'+seam.name;root.add(gap);
  }
  for(const [i,center] of fit.handles.entries()){
    const sign=Math.sign(center[2]);
    if(fit.handleStyle==='classic-pull'){
      const chrome=m.reflector;
      for(const offset of [-.055,.055]){const foot=new THREE.Mesh(new THREE.SphereGeometry(.012,16,8),chrome);foot.name='classic-handle-foot-'+i;foot.position.set(center[0]+offset,center[1],center[2]);root.add(foot);}
      const path=new THREE.CatmullRomCurve3([[-.055,0,0],[-.035,.003,sign*.024],[.035,.003,sign*.024],[.055,0,0]].map(p=>new THREE.Vector3(center[0]+p[0],center[1]+p[1],center[2]+p[2])));
      const handle=new THREE.Mesh(new THREE.TubeGeometry(path,24,.0055,8,false),chrome);handle.name='classic-pull-handle-'+i;root.add(handle);continue;
    }
    const recess=new THREE.Mesh(new RoundedBoxGeometry(.185,.028,.009,3,.004),m.trim);recess.name='flush-handle-recess-'+i;recess.position.fromArray(center);root.add(recess);
    const blade=new THREE.Mesh(new RoundedBoxGeometry(.154,.016,.008,3,.003),m.mirrorPaint);blade.name='flush-door-handle-'+i;blade.position.fromArray(center);blade.position.z+=sign*.003;root.add(blade);
  }
  return root;
}
