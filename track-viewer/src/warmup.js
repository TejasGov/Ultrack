import * as THREE from 'three';

export const paintFrame = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
const yieldMain = () => new Promise(resolve => setTimeout(resolve, 0));

// WebGLRenderer.compileAsync traverses invisible objects too. Compile only visible drawables,
// in small chunks, with the real scene supplying lights/fog/environment for identical programs.
// Chunks are submitted back to back and awaited together: the driver compiles them in parallel, while each
// submit stays a short task (waiting per chunk cost ~1 s of link latency each, 35 s of a 38 s race start).
// inflight: how many chunks may be compiling at once, a number or a function (menu warm-up keeps it small; the loading screen takes them all).
// depth: also compile the shadow-pass variants for the casters, once per wrapper in the list (the light set can differ between passes).
// extra: roots outside the scene (parked race cars). around(fn): runs each submit in the state the race draws in.
export async function compileVisible(renderer, scene, camera, { frustum = false, isCancelled = ()=>false, extra = [], around = fn=>fn(), depth = false, inflight = Infinity } = {}) {
  const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const clip = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const objects=[],seen=new Set();
  const take=o=>{
    if(!(o.isMesh||o.isPoints||o.isLine||o.isSprite)||seen.has(o))return;
    if(!o.layers.test(camera.layers))return;
    if(frustum&&o.frustumCulled&&!o.isSprite&&!clip.intersectsObject(o))return;
    seen.add(o);objects.push(o);
  };
  around(()=>{
    scene.traverseVisible(take);
    for(const root of extra)for(const child of root.children)child.traverseVisible(take); // the root itself may be hidden (parked)
  });
  const jobs=[],active=new Set();
  const submit=async(list,swap,wrap=fn=>fn())=>{
    for(let i=0;i<list.length;i+=32){
      while(active.size>=(inflight.call?inflight():inflight)&&!isCancelled())await Promise.race(active);   // the driver compiles on the GPU process: a deep queue starves the compositor (a 7 s freeze on a menu click)
      if(isCancelled())break;
      const group=new THREE.Group();
      for(const original of list.slice(i,i+32))group.add(swap?swap(original):original.clone(false));
      around(()=>wrap(()=>{
        const previous=renderer.getRenderTarget(),previousFace=renderer.getActiveCubeFace(),previousMip=renderer.getActiveMipmapLevel();
        // the shadow pass draws with an empty scene: lights but no fog (a fogged key would never match)
        const fog=swap?scene.fog:null;if(swap)scene.fog=null;
        try{
          renderer.setRenderTarget(target,face,mip);
          const job=renderer.compileAsync(group,camera,scene);jobs.push(job);active.add(job);job.finally(()=>active.delete(job));
        }
        finally{renderer.setRenderTarget(previous,previousFace,previousMip);if(swap)scene.fog=fog;}
      }));
      await yieldMain();
    }
  };
  await submit(objects);
  // The shadow map's depth programs are made lazily by the first shadow pass (~250 ms each, synchronously): build the same variants now.
  if(depth)for(const wrap of [].concat(depth===true?[fn=>fn()]:depth))await submit(shadowCasters(objects),depthClone,wrap);
  await Promise.all(jobs);
  return objects.length;
}

// WebGLShadowMap.getDepthMaterial, rebuilt (basic packing: the PCF map is a depth texture): one MeshDepthMaterial per distinct (alpha-cut source material, side) and object kind.
const SHADOW_SIDE=[THREE.BackSide,THREE.FrontSide,THREE.DoubleSide];
let depthBase;const depthVariants=new Map();
const variantOf=m=>cutOut(m)?m.uuid:'plain'+!!m.map+!!m.alphaMap;   // the shared depth material takes each caster's map: with or without a uv set
const cutOut=m=>(m.alphaMap&&m.alphaTest>0)||(m.map&&m.alphaTest>0)||m.alphaToCoverage===true||(m.displacementMap&&m.displacementScale!==0);
function shadowCasters(objects){
  const seen=new Set(),out=[];
  for(const o of objects){
    if(!o.castShadow)continue;
    const m=[].concat(o.material)[0];if(!m)continue;
    const key=variantOf(m)+'|'+(m.shadowSide??SHADOW_SIDE[m.side])+'|'+m.visible+m.wireframe+'|'+!!o.isInstancedMesh+!!o.instanceColor+!!o.isSkinnedMesh+(o.morphTargetInfluences?.length??0)+!!o.isBatchedMesh;
    if(!seen.has(key)){seen.add(key);out.push(o);}
  }
  return out;
}
function depthClone(original){
  const source=[].concat(original.material)[0];
  depthBase??=new THREE.MeshDepthMaterial();
  const id=variantOf(source)+'|'+(source.shadowSide??SHADOW_SIDE[source.side])+'|'+source.visible+source.wireframe;
  let m=depthVariants.get(id);
  if(!m){
    m=depthBase.clone();m.visible=source.visible;m.wireframe=source.wireframe;m.side=source.shadowSide??SHADOW_SIDE[source.side];
    m.alphaMap=source.alphaMap;m.alphaTest=source.alphaToCoverage===true?0.5:source.alphaTest;m.map=source.map;
    m.displacementMap=source.displacementMap;m.displacementScale=source.displacementScale;m.displacementBias=source.displacementBias;
    depthVariants.set(id,m);
  }
  const clone=original.clone(false);clone.material=m;return clone;
}
