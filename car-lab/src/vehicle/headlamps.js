import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Enclosed headlamp: the aperture comes from the shell, the optical layout from
// the concept. All positions are normalized shell coordinates before body lift.
export function createEnclosedHeadlamp(profile,m,sign,spec=profile.lights.headlamp,suffix=''){
  const fit=spec.aperture;
  if(fit.sourceSha256.toUpperCase()!==profile.body.sha256.toUpperCase())throw Error('Headlamp aperture belongs to a different shell.');
  const root=new THREE.Group();root.name='headlamp-assembly-'+sign+suffix;
  const boundary=[];
  for(let row=0;row<fit.rows-1;row++){
    const p=fit.sides[String(sign)][row*fit.columns+Math.floor(fit.columns/2)];
    boundary.push(new THREE.Vector3(fit.capX[String(sign)][row],p[1],p[2]));
  }
  const measured=boundary.map(p=>p.clone()),axis=spec.capProjection==='y'?'y':'z';
  // Span the rim across each aperture section. Following opposite cavity-floor
  // folds would bury the optics in the original generated mesh.
  function envelope(p){
    if(spec.surfaceMode==='rim-interpolated'){
      const near=measured.map(v=>({v,d:(v.y-p.y)**2+(v.z-p.z)**2})).sort((a,b)=>a.d-b.d).slice(0,8);
      if(near[0].d<1e-10)return near[0].v.x;
      const total=near.reduce((sum,q)=>sum+1/q.d,0);return near.reduce((sum,q)=>sum+q.v.x/q.d,0)/total;
    }
    const near=measured.filter(v=>Math.abs(v[axis]-p[axis])<spec.capWindow);
    const nearest=near.length?near:[measured.reduce((a,b)=>Math.abs(a[axis]-p[axis])<Math.abs(b[axis]-p[axis])?a:b)];
    return spec.surfaceMode==='rim-average'?nearest.reduce((sum,v)=>sum+v.x,0)/nearest.length:Math.min(...nearest.map(v=>v.x));
  }
  boundary.forEach(p=>p.x=envelope(p));
  const center=boundary.reduce((a,p)=>a.add(p),new THREE.Vector3()).multiplyScalar(1/boundary.length);
  // Fit X=a*(Y-cy)+b*(Z-cz)+cx. This seats optics against a sloping
  // Porsche fender instead of pointing every housing straight down -X.
  let yy=0,yz=0,zz=0,xy=0,xz=0;
  for(const p of boundary){const y=p.y-center.y,z=p.z-center.z,x=p.x-center.x;yy+=y*y;yz+=y*z;zz+=z*z;xy+=x*y;xz+=x*z;}
  const determinant=yy*zz-yz*yz,a=(xy*zz-xz*yz)/determinant,b=(xz*yy-xy*yz)/determinant;
  const normal=new THREE.Vector3(-1,a,b).normalize();
  function point(z,y,depth=0){
    const worldZ=z*sign,x=envelope(new THREE.Vector3(0,y,worldZ));
    return new THREE.Vector3(x,y,worldZ).addScaledVector(normal,depth);
  }
  const add=(g,mat,name,parent=root)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=false;parent.add(o);return o;};
  function cap(name,depth,dome,mat){
    const positions=[],indices=[],rings=12,N=boundary.length;
    positions.push(envelope(center)+depth-dome,center.y,center.z);
    for(let r=1;r<=rings;r++)for(const edge of boundary){
      const t=r/rings,p=center.clone().lerp(edge,t);
      p.x=envelope(p)+depth-dome*(1-t*t);positions.push(...p.toArray());
    }
    for(let i=0;i<N;i++)indices.push(0,1+i,1+(i+1)%N);
    for(let r=1;r<rings;r++)for(let i=0;i<N;i++){
      const j=1+(r-1)*N+i,k=1+(r-1)*N+(i+1)%N;
      indices.push(j,j+N,k,j+N,k+N,k);
    }
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    const material=mat.clone();material.side=THREE.DoubleSide;
    return add(g,material,name);
  }
  cap('headlamp-backplate',spec.depth,0,m.lampHousing);
  const sidePositions=[],sideIndices=[];
  boundary.forEach((p,i)=>{
    sidePositions.push(p.x+.002,p.y,p.z,p.x+spec.depth,p.y,p.z);
    const j=i*2,k=((i+1)%boundary.length)*2;sideIndices.push(j,j+1,k,j+1,k+1,k);
  });
  const wall=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3));wall.setIndex(sideIndices);wall.computeVertexNormals();
  const wallMaterial=m.lampHousing.clone();wallMaterial.side=THREE.DoubleSide;add(wall,wallMaterial,'headlamp-cavity-walls');
  const rimCurve=new THREE.CatmullRomCurve3(boundary.map(p=>p.clone().add(new THREE.Vector3(-.003,0,0))),true,'centripetal');
  add(new THREE.TubeGeometry(rimCurve,192,.0045,8,true),m.lampHousing,'headlamp-seal');
  add(new THREE.TubeGeometry(rimCurve,192,.0013,8,true),m.reflector,'headlamp-bezel');

  const apertures=[];
  for(const [i,optic] of spec.optics.entries()){
    const group=new THREE.Group();group.name='headlamp-optic-'+i;
    group.position.copy(point(optic.zy[0],optic.zy[1],-.012));
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    root.add(group);
    const emitter=optic.beam==='high'?m.highProjector:m.projector;
    if(optic.shape==='matrix'){
      const [w,h]=optic.size;
      add(new RoundedBoxGeometry(w+.012,h+.012,.030,2,.006),m.lampHousing,'matrix-chamber',group).position.z=-.009;
      add(new RoundedBoxGeometry(w,h,.009,2,.004),m.reflector,'matrix-reflector',group).position.z=.003;
      for(let c=0;c<3;c++){
        const cell=add(new RoundedBoxGeometry(w*.24,h*.66,.006,2,.002),emitter,'matrix-emitter-'+c,group);
        cell.position.set((c-1)*w*.29,0,.010);
      }
      add(new RoundedBoxGeometry(w+.002,h+.002,.008,2,.004),m.opticGlass,'matrix-lens',group).position.z=.016;
    }else{
      const R=optic.radius;
      const cup=[new THREE.Vector2(R*.25,-.032),new THREE.Vector2(R*.44,-.026),new THREE.Vector2(R*.72,-.014),new THREE.Vector2(R,0),new THREE.Vector2(R*1.04,.005)];
      add(new THREE.LatheGeometry(cup,48).rotateX(Math.PI/2),m.reflector,'projector-reflector',group);
      add(new THREE.TorusGeometry(R*1.05,.003,8,48),m.lampHousing,'projector-shroud',group).position.z=.005;
      add(new THREE.TorusGeometry(R*.89,.002,8,48),m.reflector,'projector-retaining-ring',group).position.z=.007;
      add(new THREE.CircleGeometry(R*.74,48),emitter,'projector-emitter',group).position.z=.009;
      add(new THREE.SphereGeometry(R*.83,40,20).scale(1,1,.25),m.opticGlass,'projector-convex-lens',group).position.z=.015;
    }
    apertures.push(group.position.clone().addScaledVector(normal,.05));
  }
  for(const [i,guide] of spec.running.entries()){
    const points=guide.map(([z,y])=>point(z,y,.006));
    const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');
    add(new THREE.TubeGeometry(curve,32,spec.runningWidth*.75,8,false),m.lampHousing,'drl-channel-'+i);
    const diffuser=new THREE.CatmullRomCurve3(points.map(p=>p.clone().addScaledVector(normal,spec.runningWidth*.8)),false,'centripetal');
    add(new THREE.TubeGeometry(diffuser,32,spec.runningWidth*.42,10,false),m.headlight,'drl-diffuser-'+i);
  }
  const cover=cap('headlamp-full-cover',-.024,.006,m.headlampCover);cover.renderOrder=4;
  root.userData={type:'enclosed',design:spec.design,sourceSha256:fit.sourceSha256};
  return {root,beamOrigin:apertures[0].addScaledVector(normal,.055)};
}

