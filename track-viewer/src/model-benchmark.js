import * as THREE from 'three';
export function summarizeFrames(samples) {
  if(!samples.length||samples.some(n=>!Number.isFinite(n)||n<0))throw Error('Invalid frame samples.');
  const sorted=[...samples].sort((a,b)=>a-b);
  return {frames:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p50Ms:sorted[Math.floor((sorted.length-1)*.5)],p95Ms:sorted[Math.ceil(sorted.length*.95)-1]};
}
/** Six detailed model instances on the same grid, with GPU completion included in each render sample. */
export async function runModelBenchmark({field,scene,camera,renderer,composer,track},{frames=90}={}) {
  if(!Number.isInteger(frames)||frames<10||frames>600)throw Error('Choose 10–600 frames.');
  const models=field?.all.filter(c=>c.profile.model);if(!models?.length)throw Error('Load complete models first.');
  const selected=Array.from({length:6},(_,i)=>models[i%models.length]);
  const saved=field.all.map(c=>({c,visible:c.root.visible})),clones=[];
  const pose={position:camera.position.clone(),quaternion:camera.quaternion.clone()};
  const gl=renderer.getContext(),pixel=new Uint8Array(4),samples=[],origin=new THREE.Vector3(...track.start.gridSlots[0].pos);
  let calls=0,triangles=0;
  try {
    field.all.forEach(c=>c.root.visible=false);
    selected.forEach((c,i)=>{
      const copy=c.root.clone(true);copy.visible=true;copy.position.copy(origin).add(new THREE.Vector3((i%3)*5,0,Math.floor(i/3)*4));copy.quaternion.identity();
      copy.traverse(o=>{if(o.isLOD)o.autoUpdate=false;if(o.name==='wheels-far'||o.name==='wheel-lod')o.visible=false;});
      // LOD and wheel detail may have been culled in the source instance.
      const lod=copy.getObjectByName('body');if(lod?.isLOD)lod.levels.forEach((l,i)=>l.object.visible=i===0);
      const wheelRoot=copy.getObjectByName(c.wheelRoot.name);wheelRoot?.traverse(o=>{if(o.name!=='wheel-lod')o.visible=true;});
      scene.add(copy);clones.push(copy);
    });
    camera.position.copy(origin).add(new THREE.Vector3(-12,7,15));camera.lookAt(origin.clone().add(new THREE.Vector3(5,.6,2)));camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    for(let i=-12;i<frames;i++){
      renderer.info.reset();const begin=performance.now();composer.render();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      if(i>=0){samples.push(performance.now()-begin);calls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;}
      if(i%10===9)await new Promise(r=>setTimeout(r,0));
    }
    return {...summarizeFrames(samples),kind:'synchronous-six-model-render',cars:selected.map(c=>c.key),uniqueModels:new Set(selected.map(c=>c.key)).size,
      drawCalls:Math.round(calls/frames),triangles:Math.round(triangles/frames),size:[renderer.domElement.width,renderer.domElement.height],
      note:'Includes GPU readback; a rendering stress sample, not a full six-car physics frame-time measurement.',samples};
  } finally {
    clones.forEach(c=>scene.remove(c));saved.forEach(({c,visible})=>c.root.visible=visible);camera.position.copy(pose.position);camera.quaternion.copy(pose.quaternion);camera.updateMatrixWorld();
  }
}
