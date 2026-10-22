import * as THREE from 'three';

// An opt-in distance proxy. Near boats keep their original geometry and materials.
// One shared 512 x 256 atlas reproduces the source generator's hull/glazing patterns;
// palette comes from the actual GLB materials, not a hardcoded white replacement.
function makeAtlas() {
  const w=512,h=256,data=new Uint8Array(w*h*4),color=new THREE.Color();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    let c=[1,1,1];
    if(y<128){
      const u=x/w,v=y/128;
      if(v<.42)c=[.05,.06,.08];
      else if(v<.5)c=[.02,.02,.025];
      else if((v>.66&&v<.74&&u>.28&&u<.62&&(u*9)%1<.86)||
        (v>.67&&v<.73&&u>.66&&u<.82&&((u-.66)*60)%1<.45))c=[.03,.04,.05];
    }else if(y<192){
      const u=x/w,v=(y-128)/64;
      if(v>.3&&v<.88)c=(u*24)%1>.06?[.025,.035,.045]:[.7,.7,.7];
    }
    color.setRGB(...c).convertLinearToSRGB();
    const i=(y*w+x)*4;data[i]=Math.round(color.r*255);data[i+1]=Math.round(color.g*255);data[i+2]=Math.round(color.b*255);data[i+3]=255;
  }
  const tex=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);
  tex.colorSpace=THREE.SRGBColorSpace;tex.generateMipmaps=true;
  tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;
  tex.name='yacht-lod-pattern-atlas';return tex;
}

function makeMaterial(atlas) {
  const material=new THREE.MeshStandardMaterial({map:atlas,vertexColors:true,roughness:.32,metalness:.05});
  material.name='Yacht distance atlas';
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float yachtSurface; varying float vYachtSurface;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvYachtSurface=yachtSurface;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vYachtSurface;')
      .replace('#include <map_fragment>',`#ifdef USE_MAP
        vec2 yachtUv=vec2(fract(vMapUv.x),0.875);
        if(vYachtSurface<0.5) yachtUv.y=clamp(vMapUv.y,0.004,0.996)*0.5;
        else if(vYachtSurface<1.5) yachtUv.y=0.5+clamp(vMapUv.y,0.008,0.992)*0.25;
        diffuseColor *= texture2D(map,yachtUv);
      #endif`);
  };
  material.customProgramCacheKey=()=> 'yacht-distance-atlas-v1';return material;
}

const SHADOW_KEEP_M=105;                                          // ~70 m shadow half-width, corner to corner
const triangles=g=>(g.index?.count??g.attributes.position.count)/3;
const kind=m=>/_(hull|super|white|teak)$/.exec(m?.name??'')?.[1];

async function proxyGeometry(parts,reference) {
  const {MeshoptSimplifier}=await import('meshoptimizer/simplifier');
  await MeshoptSimplifier.ready;
  const positions=[],normals=[],uvs=[],colors=[],surfaces=[];
  const inverse=reference.matrix.clone().invert(),relative=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3(),point=new THREE.Vector3(),normal=new THREE.Vector3();
  let inputTriangles=0;
  for(const o of parts){
    const material=Array.isArray(o.material)?o.material[0]:o.material,k=kind(material);
    if(!k)continue; // tiny steel rails, glass strips and lights are subpixel at the switch distance
    const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
    relative.multiplyMatrices(inverse,o.matrix);normalMatrix.getNormalMatrix(relative);
    const pos=new Float32Array(p.count*3),attr=new Float32Array(p.count*5);
    for(let i=0;i<p.count;i++){
      point.set(p.getX(i),p.getY(i),p.getZ(i)).applyMatrix4(relative);pos.set(point.toArray(),i*3);
      normal.set(n?.getX(i)??0,n?.getY(i)??1,n?.getZ(i)??0).applyMatrix3(normalMatrix).normalize();
      attr.set([normal.x,normal.y,normal.z,uv?.getX(i)??0,uv?.getY(i)??0],i*5);
    }
    let idx=g.index?Uint32Array.from(g.index.array):Uint32Array.from({length:p.count},(_,i)=>i);
    inputTriangles+=idx.length/3;
    // Index-only collapse: original positions/UVs/normals remain immutable. Bound error
    // to 0.6% of the primitive extent, rather than forcing an arbitrary triangle target.
    if(idx.length>72)idx=MeshoptSimplifier.simplifyWithAttributes(idx,pos,3,attr,5,[.15,.15,.15,.02,.02],null,
      Math.max(36,Math.floor(idx.length*.45/3)*3),.006,['Permissive','Prune'])[0];
    for(const i of idx){
      positions.push(...pos.subarray(i*3,i*3+3));normals.push(...attr.subarray(i*5,i*5+3));
      uvs.push(attr[i*5+3],attr[i*5+4]);colors.push(material.color.r,material.color.g,material.color.b);
      surfaces.push(k==='hull'?0:k==='super'?1:2);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setAttribute('yachtSurface',new THREE.Float32BufferAttribute(surfaces,1));
  g.computeBoundingBox();g.computeBoundingSphere();g.userData.sourceTriangles=inputTriangles;return g;
}

/** Returns immediately, with .ready resolving once small proxy geometries are built.
 * Call before constructing Culler; Culler must skip sceneryLodManaged objects.
 * update accepts the actual camera so distance is screen-size based and respects FOV.
 */
export function createYachtLod(root) {
  root.updateMatrixWorld(true);
  const parents=new Set();
  root.traverse(o=>{if(o.isMesh&&[].concat(o.material).some(m=>/^M_y\d+_.*_hull$/.test(m?.name??'')))parents.add(o.parent);});
  const atlas=parents.size?makeAtlas():null,material=atlas?makeMaterial(atlas):null;
  let enabled=false,disposed=false,ready=false,lastCamera=null;
  const sets=[],world=new THREE.Matrix4(),instance=new THREE.Matrix4(),cameraPosition=new THREE.Vector3();
  const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),sphere=new THREE.Sphere();
  for(const parent of parents){
    const parts=parent.children.filter(o=>o.isMesh&&o.geometry);
    if(!parts.length)continue;
    const reference=parts.find(o=>[].concat(o.material).some(m=>kind(m)==='hull'));
    if(!reference)continue;
    const count=reference.isInstancedMesh?reference.count:1;
    // Multi-primitive glTF instances share an identical transform stream.
    if(parts.some(o=>!!o.isInstancedMesh!==!!reference.isInstancedMesh||(o.isInstancedMesh&&o.count!==count)))continue;
    const originals=parts.map(o=>({o,visible:o.visible,count:o.count,managed:o.userData.sceneryLodManaged,frustumCulled:o.frustumCulled,
      matrices:o.isInstancedMesh?new Float32Array(o.instanceMatrix.array):null}));
    for(const {o} of originals){o.userData.sceneryLodManaged=true;o.frustumCulled=false;}
    const matrices=[];for(let i=0;i<count;i++){
      if(reference.isInstancedMesh)reference.getMatrixAt(i,instance);else instance.identity();matrices.push(instance.clone());
    }
    const bounds=new THREE.Box3(),inverse=reference.matrix.clone().invert();for(const o of parts){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrix)));}
    const localSphere=bounds.getBoundingSphere(new THREE.Sphere());
    sets.push({parent,parts,reference,count,originals,matrices,localSphere,states:new Uint8Array(count),proxy:null});
  }
  const state={enabled:false,ready:false,boats:sets.reduce((n,s)=>n+s.count,0),near:0,far:0,culled:0,
    baselineTriangles:0,submittedTriangles:0,baselineDraws:0,submittedDraws:0,proxyTriangles:0,atlasBytes:atlas?512*256*4:0};
  function restore(){for(const s of sets){for(const entry of s.originals){entry.o.visible=entry.visible;
    if(entry.matrices){entry.o.instanceMatrix.array.set(entry.matrices);entry.o.count=entry.count;entry.o.instanceMatrix.needsUpdate=true;}}
    s.proxy&&(s.proxy.visible=false);s.states.fill(0);s.nearKey=null;s.farKey=null;}}
  function update(camera){
    if(disposed)return;lastCamera=camera;
    if(!ready)return;
    Object.assign(state,{enabled,ready,near:0,far:0,culled:0,baselineTriangles:0,submittedTriangles:0,baselineDraws:0,submittedDraws:0,proxyTriangles:0});
    camera.updateMatrixWorld();camera.getWorldPosition(cameraPosition);
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
    for(const s of sets){
      s.reference.updateWorldMatrix(true,false);
      const nearIndices=[],farIndices=[];
      const sourceTriangles=s.parts.reduce((n,o)=>n+triangles(o.geometry),0),proxyTriangles=triangles(s.proxy.geometry);
      for(let i=0;i<s.count;i++){
        world.multiplyMatrices(s.reference.matrixWorld,s.matrices[i]);sphere.copy(s.localSphere).applyMatrix4(world);
        const distance=Math.max(.001,cameraPosition.distanceTo(sphere.center));
        // off-screen boats inside the sun's shadow box (±70 m round the camera) still cast onto what is on screen
        if(!frustum.intersectsSphere(sphere)&&distance-sphere.radius>SHADOW_KEEP_M){state.culled++;continue;}
        const screenHeight=2*sphere.radius*camera.projectionMatrix.elements[5]/Math.max(.001,2*distance);
        // ~130 px of a 720 px viewport: no tiny rails or lamps should read here.
        const threshold=s.states[i]? .205 : .17;
        const far=enabled&&screenHeight<threshold;
        s.states[i]=far?1:0;(far?farIndices:nearIndices).push(i);
      }
      const nearKey=nearIndices.join(','),farKey=farIndices.join(','),nearChanged=nearKey!==s.nearKey,farChanged=farKey!==s.farKey;
      if(s.reference.isInstancedMesh){
        for(const entry of s.originals){
          const o=entry.o;o.visible=entry.visible&&nearIndices.length>0;
          if(nearChanged){for(let j=0;j<nearIndices.length;j++)o.setMatrixAt(j,s.matrices[nearIndices[j]]);
            o.count=nearIndices.length;o.instanceMatrix.needsUpdate=true;}
        }
      }else for(const entry of s.originals)entry.o.visible=entry.visible&&nearIndices.length>0;
      s.proxy.visible=farIndices.length>0;s.proxy.count=farIndices.length;
      if(farChanged){for(let j=0;j<farIndices.length;j++)s.proxy.setMatrixAt(j,s.matrices[farIndices[j]]);
        if(farIndices.length)s.proxy.instanceMatrix.needsUpdate=true;}
      s.nearKey=nearKey;s.farKey=farKey;
      state.near+=nearIndices.length;state.far+=farIndices.length;
      const visible=nearIndices.length+farIndices.length;
      state.baselineTriangles+=visible*sourceTriangles;state.submittedTriangles+=nearIndices.length*sourceTriangles+farIndices.length*proxyTriangles;
      state.proxyTriangles+=farIndices.length*proxyTriangles;
      if(visible)state.baselineDraws+=s.parts.length;
      if(nearIndices.length)state.submittedDraws+=s.parts.length;
      if(farIndices.length)state.submittedDraws++;
    }
    return {...state};
  }
  const controller={ready:null,update,setEnabled(value){enabled=!!value;state.enabled=enabled;if(!enabled)restore();if(lastCamera&&ready)update(lastCamera);},
    getStats:()=>({...state,activeProxies:state.far}),stats:state,
    dispose(){if(disposed)return;disposed=true;restore();for(const s of sets){
      if(s.proxy){s.proxy.removeFromParent();s.proxy.geometry.dispose();s.proxy.dispose();}
      for(const entry of s.originals){entry.o.frustumCulled=entry.frustumCulled;if(entry.managed===undefined)delete entry.o.userData.sceneryLodManaged;else entry.o.userData.sceneryLodManaged=entry.managed;}
    }material?.dispose();atlas?.dispose();}};
  controller.ready=Promise.all(sets.map(async s=>{
    const geometry=await proxyGeometry(s.parts,s.reference);
    if(disposed){geometry.dispose();return;}
    const proxy=new THREE.InstancedMesh(geometry,material,s.count);
    proxy.name='yacht-lod-'+s.parent.name;proxy.visible=false;proxy.frustumCulled=false;
    proxy.layers.mask=s.reference.layers.mask;
    proxy.userData.sceneryLodManaged=true;
    // Match any local transform on the source component (normally identity).
    proxy.matrixAutoUpdate=false;proxy.matrix.copy(s.reference.matrix);s.parent.add(proxy);s.proxy=proxy;
  })).then(()=>{ready=true;state.ready=true;if(lastCamera&&!disposed)update(lastCamera);return controller;});
  return controller;
}
