import * as THREE from 'three';

// A deliberately small texture-baking experiment: the crescent hotel only. The skyline already uses textured
// prisms, and replacing its silhouettes with boxes would cost quality for almost no useful geometry saving.
const TILE = 128, COLS = 3, ROWS = 2;
const DIRECTIONS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

function viewsFor(box) {
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const radius=size.length(),corners=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z));
  return DIRECTIONS.map((direction,index)=>{
    const axis=new THREE.Vector3(...direction),camera=new THREE.OrthographicCamera(-1,1,1,-1,0.01,radius*4+1);
    camera.position.copy(center).addScaledVector(axis,radius*2+1);
    camera.up.set(0,Math.abs(axis.y)>.5?0:1,Math.abs(axis.y)>.5?1:0);
    camera.lookAt(center);camera.updateMatrixWorld(true);
    const local=corners.map(p=>p.clone().applyMatrix4(camera.matrixWorldInverse));
    const halfX=Math.max(...local.map(p=>Math.abs(p.x)))*1.04+.001;
    const halfY=Math.max(...local.map(p=>Math.abs(p.y)))*1.04+.001;
    camera.left=-halfX;camera.right=halfX;camera.bottom=-halfY;camera.top=halfY;camera.updateProjectionMatrix();
    return {camera,axis,index};
  });
}

/** Preserve every original triangle and its normal, replacing multiple materials with one projected atlas. */
export function buildBuildingAtlasGeometry(meshes,root,views) {
  root.updateWorldMatrix(true,false);
  const inverseRoot=root.matrixWorld.clone().invert(),normalMatrix=new THREE.Matrix3(),positions=[],normals=[],uv=[];
  for(const mesh of meshes){
    const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    for(let i=0;i<(index?.count??p.count);i+=3){
      const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
      const world=ids.map(k=>new THREE.Vector3().fromBufferAttribute(p,k).applyMatrix4(mesh.matrixWorld));
      const face=new THREE.Vector3().crossVectors(world[1].clone().sub(world[0]),world[2].clone().sub(world[0])).normalize();
      const view=views.reduce((best,v)=>v.axis.dot(face)>best.axis.dot(face)?v:best,views[0]);
      for(let k=0;k<3;k++){
        const projected=world[k].clone().project(view.camera);
        const local=world[k].clone().applyMatrix4(inverseRoot);positions.push(...local.toArray());
        const worldNormal=n?new THREE.Vector3().fromBufferAttribute(n,ids[k]).applyNormalMatrix(normalMatrix):face.clone();
        // Normal transforms back into the venue's coordinates, including a possible non-uniform root transform.
        worldNormal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(inverseRoot));normals.push(...worldNormal.toArray());
        uv.push(((view.index%COLS)+(projected.x*.5+.5))/COLS,(Math.floor(view.index/COLS)+(projected.y*.5+.5))/ROWS);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

function bakeAtlas(renderer,meshes,views,emission,emissionScale=1) {
  const target=new THREE.WebGLRenderTarget(TILE*COLS,TILE*ROWS,{depthBuffer:true,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  target.texture.colorSpace=THREE.SRGBColorSpace;
  target.texture.name=emission?'building-hotel-emission-atlas':'building-hotel-albedo-atlas';
  const scene=new THREE.Scene(),temporary=[];
  for(const original of meshes){
    const makeMaterial=source=>{
      const material=new THREE.MeshBasicMaterial({
        color:emission?(source.emissive??new THREE.Color(0)):source.color,
        map:emission?source.emissiveMap:source.map,
        side:source.side,toneMapped:false,
      });
      if(emission)material.color.multiplyScalar((source.userData.emissive0??source.emissiveIntensity??1)/emissionScale);
      temporary.push(material);return material;
    };
    const copy=new THREE.Mesh(original.geometry,Array.isArray(original.material)?original.material.map(makeMaterial):makeMaterial(original.material));
    copy.matrixAutoUpdate=false;copy.matrix.copy(original.matrixWorld);scene.add(copy);
  }
  const previous={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,xr:renderer.xr?.enabled};
  try{
    if(renderer.xr)renderer.xr.enabled=false;
    renderer.autoClear=false;renderer.setRenderTarget(target);renderer.setClearColor(0x000000,1);renderer.clear();
    // Render-target viewport/scissor coordinates are physical texels. Renderer.setViewport/Scissor
    // multiply by the display pixel ratio, which misaligns atlas tiles at the game's render scale.
    target.scissorTest=true;
    for(const view of views){
      const x=(view.index%COLS)*TILE,y=Math.floor(view.index/COLS)*TILE;
      target.viewport.set(x,y,TILE,TILE);target.scissor.set(x,y,TILE,TILE);
      renderer.setRenderTarget(target);renderer.render(scene,view.camera);
    }
    // The final target unbind generates mip levels; the border around each orthographic view prevents atlas seams.
    renderer.setRenderTarget(previous.target);
    return target;
  }catch(error){target.dispose();throw error;}
  finally{
    renderer.setRenderTarget(previous.target);renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);renderer.setClearColor(previous.clear,previous.alpha);renderer.autoClear=previous.autoClear;
    if(renderer.xr)renderer.xr.enabled=previous.xr;
    temporary.forEach(material=>material.dispose());
  }
}

/** Optional renderer makes this safe in non-WebGL tools. Defaults disabled; caller opts into the comparison. */
export function createBuildingLod(root,{renderer}={}) {
  let enabled=false,disposed=false,entry=null;
  const stats={kind:'buildings',ready:false,enabled:false,candidates:0,active:0,nearTriangles:0,farTriangles:0,nearDraws:0,farDraws:0,textureBytes:0,reason:renderer?'hotel not found':'renderer unavailable'};
  const controller={
    ready:Promise.resolve(),
    setEnabled(value){enabled=!!value;stats.enabled=enabled;if(!enabled&&entry)show(false);},
    update(camera){
      if(!entry||disposed)return;
      if(!enabled){show(false);return;}
      camera.updateWorldMatrix(true,false);
      const position=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
      const distance=Math.max(1,position.distanceTo(entry.center)-entry.radius);
      // Projected diameter relative to viewport height: enter below 22%, exit above 28% (hysteresis).
      const projected=camera.isPerspectiveCamera?entry.radius*2/(distance*2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/camera.zoom):Infinity;
      show(projected < (entry.far ? .28 : .22));
      const reference=entry.reference;
      if(reference)entry.proxy.material.emissiveIntensity=entry.emissionScale*(reference.emissiveIntensity??1)/(reference.userData.emissive0||1);
    },
    getStats(){return {...stats};},
    dispose(){
      if(disposed)return;disposed=true;if(!entry)return;
      for(const item of entry.originals){item.mesh.visible=item.visible;if(item.managed===undefined)delete item.mesh.userData.sceneryLodManaged;else item.mesh.userData.sceneryLodManaged=item.managed;}
      entry.proxy.removeFromParent();entry.proxy.geometry.dispose();entry.proxy.material.dispose();entry.albedo.dispose();entry.emission.dispose();stats.active=0;
    },
  };
  function show(far){
    entry.far=far;entry.proxy.visible=far;
    for(const item of entry.originals)item.mesh.visible=far?false:item.visible;
    stats.active=Number(far);
  }
  controller.ready=Promise.resolve().then(()=>{
    if(!renderer||disposed)return;
    root.updateWorldMatrix(true,true);
    const group=root.getObjectByName('hotel');if(!group)return;
    // Untextured neon trim (the crown, emissive ×9) is a thin ring: baked into a 128 px tile and mipmapped it averages
    // below the bloom threshold and its glow vanishes, so it stays a real mesh at every distance.
    const neon=m=>!m.map&&!m.emissiveMap&&(m.emissiveIntensity??0)*Math.max(m.emissive?.r??0,m.emissive?.g??0,m.emissive?.b??0)>2;
    const meshes=[],kept=[];group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!o.isSkinnedMesh&&o.visible&&o.geometry?.attributes.normal)([].concat(o.material).every(neon)?kept:meshes).push(o);});
    if(!meshes.length)return;
    const box=new THREE.Box3();for(const mesh of meshes){mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));}
    const views=viewsFor(box),materials=meshes.flatMap(mesh=>[].concat(mesh.material));let albedo,emission,geometry;
    const emissionScale=Math.max(1,...materials.map(m=>Math.max(m.emissive?.r??0,m.emissive?.g??0,m.emissive?.b??0)*(m.userData.emissive0??m.emissiveIntensity??1)));
    try{albedo=bakeAtlas(renderer,meshes,views,false);emission=bakeAtlas(renderer,meshes,views,true,emissionScale);geometry=buildBuildingAtlasGeometry(meshes,root,views);}
    catch(error){albedo?.dispose();emission?.dispose();geometry?.dispose();stats.reason='bake failed: '+error.message;return;}
    const material=new THREE.MeshStandardMaterial({name:'BuildingHotelBakedLod',map:albedo.texture,emissiveMap:emission.texture,emissive:0xffffff,emissiveIntensity:emissionScale,roughness:.45,metalness:.15});
    const proxy=new THREE.Mesh(geometry,material);proxy.name='building-hotel-baked-proxy';proxy.visible=false;proxy.userData.sceneryLodManaged=true;proxy.receiveShadow=true;root.add(proxy);
    const originals=meshes.map(mesh=>({mesh,visible:mesh.visible,managed:mesh.userData.sceneryLodManaged}));
    originals.forEach(item=>{item.mesh.userData.sceneryLodManaged=true;});
    entry={originals,proxy,albedo,emission,emissionScale,center:box.getCenter(new THREE.Vector3()),radius:box.getSize(new THREE.Vector3()).length()/2,far:false,reference:materials.find(m=>m.emissiveMap)};
    const count=mesh=>(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
    const draws=list=>list.reduce((n,m)=>n+(Array.isArray(m.material)?m.geometry.groups.length:1),0),tris=list=>list.reduce((n,m)=>n+count(m),0);
    Object.assign(stats,{ready:true,candidates:1,nearTriangles:tris(meshes)+tris(kept),farTriangles:count(proxy)+tris(kept),nearDraws:draws(meshes)+draws(kept),farDraws:1+draws(kept),kept:kept.length,textureBytes:TILE*COLS*TILE*ROWS*4*2*4/3,reason:'six-view albedo and emission atlas; silhouette preserved'});
    stats.originalTriangles=tris(meshes);stats.proxyTriangles=count(proxy);
  });
  return controller;
}
