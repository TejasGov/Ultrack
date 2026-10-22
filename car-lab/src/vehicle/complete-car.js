import * as THREE from 'three';

export function completeCarMaterial(src,m){
  const role=src?.name?.split('|')[0];
  const target={paint:m.body,mirrorPaint:m.mirrorPaint,glass:m.glass,mirror:m.mirrorGlass,head:m.headlight,projector:m.projector,tail:m.taillight,brake:m.brakeLight,reverse:m.reverseLight,caliper:m.caliper}[role];
  if(target&&(role==='paint'||role==='mirrorPaint')&&src.normalMap&&!target.normalMap){target.normalMap=src.normalMap;target.needsUpdate=true;}
  return target??src;
}

export function createCompleteCarLights(profile,m){
  const root=new THREE.Group();root.name='source-lamps';const beams=[];
  for(const sign of [-1,1]){
    const points=profile.lights.front.filter(p=>Math.sign(p[2])===sign);if(!points.length)continue;
    const position=points.reduce((v,p)=>v.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(1/points.length);
    const beam=new THREE.SpotLight(0xe5f1ff,0,35,.32,.65,2);beam.position.copy(position);beam.target.position.copy(position).add(new THREE.Vector3(-12,-position.y,0));root.add(beam,beam.target);beams.push(beam);
  }
  let state={mode:'running',brake:0,reverse:false};
  const update=(input={})=>{
    state={mode:input.mode??state.mode,brake:THREE.MathUtils.clamp(input.brake??state.brake,0,1),reverse:input.reverse??state.reverse};
    const running=state.mode!=='off',on=state.mode==='low'||state.mode==='high';
    m.headlight.emissiveIntensity=running?2.8:0;m.projector.emissiveIntensity=on?(state.mode==='high'?22:14):0;
    m.taillight.emissiveIntensity=(running?1.4:0)+state.brake*6.6;m.brakeLight.emissiveIntensity=state.brake*10;m.reverseLight.emissiveIntensity=state.reverse?6:0;
    beams.forEach(b=>{b.intensity=on?(state.mode==='high'?1500:650):0;b.angle=state.mode==='high'?.23:.32;b.visible=on;});
  };
  update();return {root,update,get state(){return {...state};}};
}

/** Full, normalized author model: no procedural wheels, glazing or lamp overlays. */
export function createCompleteCar(source,profile,m,lighting){
  const root=new THREE.Group();root.name='complete-source-car';source.updateMatrixWorld(true);
  const body=new THREE.Group();body.name='body';root.add(body);
  const parts={glass:new THREE.Group(),mirrors:new THREE.Group(),lights:lighting.root};
  parts.glass.name='source-glass';parts.mirrors.name='source-mirrors';
  Object.values(parts).forEach(g=>root.add(g));let triangles=0;
  const copy=(o,target,offset=new THREE.Vector3())=>{
    const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.translate(-offset.x,-offset.y,-offset.z);
    const materials=Array.isArray(o.material)?o.material.map(mat=>completeCarMaterial(mat,m)):completeCarMaterial(o.material,m);
    const mesh=new THREE.Mesh(g,materials);mesh.name=o.name;mesh.castShadow=mesh.receiveShadow=true;target.add(mesh);triangles+=(g.index?.count??g.attributes.position.count)/3;return mesh;
  };
  const sourceBody=source.getObjectByName('body');if(!sourceBody)throw Error('Complete model has no body group.');
  sourceBody.traverse(o=>{
    if(!o.isMesh)return;
    const role=(Array.isArray(o.material)?o.material[0]:o.material)?.name?.split('|')[0];
    const target=role==='glass'?parts.glass:role?.startsWith('mirror')?parts.mirrors:['head','projector','tail','brake','reverse'].includes(role)?parts.lights:body;
    copy(o,target);
  });
  const wheelRoot=new THREE.Group();wheelRoot.name='source-wheels';root.add(wheelRoot);const wheels=[];
  for(const key of ['FL','FR','RL','RR']){
    const node=source.getObjectByName('wheel_'+key);if(!node)throw Error('Complete model missing wheel '+key);
    const pivot=new THREE.Group();pivot.name='wheel_'+key;node.getWorldPosition(pivot.position);wheelRoot.add(pivot);
    const spin=new THREE.Group();spin.name=pivot.name+'_spin';const caliper=new THREE.Group();caliper.name=pivot.name+'_calipers';pivot.add(spin,caliper);
    for(const [suffix,target] of [['spin',spin],['caliper',caliper]])node.getObjectByName(pivot.name+'_'+suffix)?.traverse(o=>{if(o.isMesh)copy(o,target,pivot.position);});
    const axle=key[0]==='F'?'front':'rear';wheels.push({pivot,spin,axle,side:key[1],spec:profile.wheels[axle]});
  }
  return {root,body,parts,wheelSet:{root:wheelRoot,wheels},triangles};
}
