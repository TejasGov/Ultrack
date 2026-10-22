import * as THREE from 'three';

export function createNuvolariDetails(profile,m){
  const root=new THREE.Group();root.name='nuvolari-design';root.position.y=profile.body.lift;
  const fit=profile.nuvolariDesign;if(!fit)return root;
  if(fit.sourceSha256!==profile.body.sha256)throw Error('Nuvolari details belong to a different body.');
  const chrome=new THREE.MeshStandardMaterial({color:'#c8ced4',metalness:.95,roughness:.2});
  const dark=new THREE.MeshStandardMaterial({color:'#10161c',metalness:.25,roughness:.38,side:THREE.DoubleSide});
  const smoked=new THREE.MeshPhysicalMaterial({color:'#090e14',roughness:.24,metalness:.3,clearcoat:1,side:THREE.DoubleSide});
  const add=(geometry,material,name,position)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;if(position)mesh.position.fromArray(position);root.add(mesh);return mesh;};
  for(const patch of fit.patches){
    const indices=[];
    for(let r=0;r<patch.rows-1;r++)for(let c=0;c<patch.columns-1;c++){const i=r*patch.columns+c;indices.push(i,i+1,i+patch.columns,i+1,i+patch.columns+1,i+patch.columns);}
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(patch.points.flat(),3));g.setIndex(indices);g.computeVertexNormals();
    add(g,patch.name.includes('lamp')?smoked:dark,patch.name);
    if(patch.name==='rear-diffuser')for(const column of [12,22,32,42,52]){
      const points=[];for(let r=0;r<patch.rows;r++){const p=patch.points[r*patch.columns+column];points.push(new THREE.Vector3(p[0]+.017,p[1],p[2]));}
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.008,5,false),dark,'diffuser-vane-'+column);
    }
  }
  for(const badge of fit.badges)for(const [i,ring] of badge.rings.entries()){
    const path=new THREE.CatmullRomCurve3(ring.slice(0,-1).map(p=>new THREE.Vector3(...p)),true);
    add(new THREE.TubeGeometry(path,96,.0047,8,true),chrome,badge.name+'-'+i);
  }
  for(const [i,center] of (fit.hexCenters??[]).entries()){
    const points=[];for(let k=0;k<6;k++){const angle=k*Math.PI/3;points.push(new THREE.Vector3(center[0],center[1]+.015*Math.sin(angle),center[2]+.017*Math.cos(angle)));}
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true,'catmullrom',0),6,.0018,4,true),grilleMetal,'grille-cell-'+i);
  }
  for(const [i,center] of fit.exhaust.entries()){
    const rim=add(new THREE.TorusGeometry(.059,.007,10,48).rotateY(Math.PI/2),chrome,'oval-exhaust-rim-'+i,center);rim.scale.y=.65;rim.scale.z=1.3;
    const hole=add(new THREE.CircleGeometry(.057,48).rotateY(Math.PI/2),dark,'exhaust-dark-bore-'+i,[center[0]-.003,center[1],center[2]]);hole.scale.y=.65;hole.scale.z=1.3;
  }
  return root;
}
