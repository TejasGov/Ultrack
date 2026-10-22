import * as THREE from 'three';

export function normalizeShell(source,profile,material){
  source.updateMatrixWorld(true);
  const meshes=[],bounds=new THREE.Box3();let triangles=0;
  source.traverse(o=>{
    if(!o.isMesh)return;
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.computeBoundingBox();bounds.union(g.boundingBox);
    meshes.push(new THREE.Mesh(g,material));triangles+=(g.index?.count??g.attributes.position.count)/3;
  });
  if(!meshes.length)throw Error('The body has no mesh.');
  if(bounds.getSize(new THREE.Vector3()).z>bounds.getSize(new THREE.Vector3()).x){
    bounds.makeEmpty();for(const mesh of meshes){mesh.geometry.rotateY(Math.PI/2);mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox);}
  }
  if(profile.body.normalizationBounds){bounds.min.fromArray(profile.body.normalizationBounds[0]);bounds.max.fromArray(profile.body.normalizationBounds[1]);}
  const center=bounds.getCenter(new THREE.Vector3()),scale=profile.body.displayLength/bounds.getSize(new THREE.Vector3()).x;
  const root=new THREE.Group();root.name='body';root.position.y=profile.body.lift;
  for(const mesh of meshes){
    mesh.name='painted-shell';mesh.geometry.translate(-center.x,-bounds.min.y,-center.z);mesh.geometry.scale(scale,scale,scale);
    if(profile.body.trimRegions?.length){
      const g=mesh.geometry,index=g.index,position=g.attributes.position,paint=[],trim=[];
      for(let i=0;i<(index?.count??position.count);i+=3){
        const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),c=new THREE.Vector3();
        for(const id of ids)c.add(new THREE.Vector3().fromBufferAttribute(position,id));c.multiplyScalar(1/3);
        const selected=profile.body.trimRegions.some(r=>c.x>=r.min[0]&&c.x<=r.max[0]&&c.y>=r.min[1]&&c.y<=r.max[1]&&c.z>=r.min[2]&&c.z<=r.max[2]);
        (selected?trim:paint).push(...ids);
      }
      g.setIndex(paint.concat(trim));g.clearGroups();g.addGroup(0,paint.length,0);g.addGroup(paint.length,trim.length,1);
      mesh.material=[material,new THREE.MeshStandardMaterial({color:'#131a20',roughness:.45,metalness:.45,side:THREE.DoubleSide})];
    }
    mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  }
  return {root,triangles};
}
