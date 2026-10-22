import * as THREE from 'three';

export function createJaguarDetails(profile,m){
  const root=new THREE.Group();root.name='jaguar-heritage-details';root.position.y=profile.body.lift;
  const fit=profile.jaguarDesign;if(!fit)return root;
  if(fit.sourceSha256!==profile.body.sha256)throw Error('Jaguar details belong to a different body.');
  const chrome=m.reflector;
  for(const [i,points] of fit.bumperRails.entries()){
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),80,.018,12,false),chrome);mesh.name='classic-rear-bumper-rail-'+i;root.add(mesh);
  }
  const plate=fit.plate,indices=[];
  for(let r=0;r<plate.rows-1;r++)for(let c=0;c<plate.columns-1;c++){const i=r*plate.columns+c;indices.push(i,i+1,i+plate.columns,i+1,i+plate.columns+1,i+plate.columns);}
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(plate.points.flat(),3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#101713',roughness:.55,side:THREE.DoubleSide}));mesh.name='heritage-rear-plate';root.add(mesh);
  for(const [i,points] of fit.letterStrokes.entries()){
    const stroke=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',0),24,.0018,6,false),chrome);stroke.name='xkss-plate-letter-'+i;root.add(stroke);
  }
  return root;
}
