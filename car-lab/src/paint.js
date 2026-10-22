import * as THREE from 'three';

const SIZE = 2048;
// Draft wheel envelopes measured against the normalized 4.6 m source silhouettes.
// Each entry is [longitudinal center, height above ground, outer radius].
const WHEEL_REGIONS = {
  'furari-488': { front: [-1.19,.38,.39], rear: [1.43,.40,.40] },
  lambo2: { front: [-1.22,.37,.39], rear: [1.43,.40,.41] },
  mclaren: { front: [-1.16,.37,.39], rear: [1.47,.39,.41] }
};
export const FINISHES = {
  gloss: { roughness: .26, metalness: 0, coat: 1, coatRoughness: .10 },
  metallic: { roughness: .30, metalness: .45, coat: 1, coatRoughness: .12 },
  satin: { roughness: .48, metalness: .12, coat: .25, coatRoughness: .3 },
  matte: { roughness: .82, metalness: .04, coat: 0, coatRoughness: .6 }
};
let database;
function openDB() {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('raceultimate-paint-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('masks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readMask(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction('masks').objectStore('masks').get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storeMask(key, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('masks', 'readwrite');
    tx.objectStore('masks').put(blob, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
const canvasBlob = canvas => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

export function resizeTexture(texture, limit = 2048) {
  if (!texture?.image || Math.max(texture.image.width, texture.image.height) <= limit) return texture;
  const canvas = document.createElement('canvas');
  const scale = limit / Math.max(texture.image.width, texture.image.height);
  canvas.width = Math.round(texture.image.width * scale);
  canvas.height = Math.round(texture.image.height * scale);
  canvas.getContext('2d').drawImage(texture.image, 0, 0, canvas.width, canvas.height);
  const resized = new THREE.CanvasTexture(canvas);
  resized.flipY = texture.flipY;
  resized.colorSpace = texture.colorSpace;
  resized.wrapS = texture.wrapS; resized.wrapT = texture.wrapT;
  resized.offset.copy(texture.offset); resized.repeat.copy(texture.repeat);
  resized.rotation = texture.rotation; resized.center.copy(texture.center);
  resized.channel = texture.channel;
  resized.anisotropy = 4;
  return resized;
}

function automaticMask(mesh, bounds, car) {
  const isRed=car.id==='furari-488',wheels=WHEEL_REGIONS[car.id];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.createImageData(SIZE,SIZE), out=image.data;
  for(let i=3;i<out.length;i+=4)out[i]=255;
  const geometry=mesh.geometry,p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv,index=geometry.index;
  if(!uv)return canvas;
  const size=bounds.getSize(new THREE.Vector3()),H=size.y,W=size.z,L=size.x;
  const f=wheels.front,r=wheels.rear;
  let source;
  if(isRed && mesh.material.map?.image){
    ctx.drawImage(mesh.material.map.image,0,0,SIZE,SIZE);source=ctx.getImageData(0,0,SIZE,SIZE).data;
  }
  const count=index?index.count:p.count;
  // Evaluate the selection at each texel's actual 3D point instead of selecting
  // whole triangles. This avoids stair steps along windows and wheel arches.
  for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    const U=ids.map(id=>uv.getX(id)*SIZE),V=ids.map(id=>uv.getY(id)*SIZE);
    const den=(V[1]-V[2])*(U[0]-U[2])+(U[2]-U[1])*(V[0]-V[2]);
    if(Math.abs(den)<1e-8)continue;
    const minX=Math.max(0,Math.floor(Math.min(...U))),maxX=Math.min(SIZE-1,Math.ceil(Math.max(...U)));
    const minY=Math.max(0,Math.floor(Math.min(...V))),maxY=Math.min(SIZE-1,Math.ceil(Math.max(...V)));
    const X=ids.map(id=>p.getX(id)),Y=ids.map(id=>p.getY(id)),Z=ids.map(id=>p.getZ(id)),NY=ids.map(id=>n?.getY(id)??0);
    for(let py=minY;py<=maxY;py++)for(let px=minX;px<=maxX;px++){
      const a=((V[1]-V[2])*(px+.5-U[2])+(U[2]-U[1])*(py+.5-V[2]))/den;
      const b=((V[2]-V[0])*(px+.5-U[2])+(U[0]-U[2])*(py+.5-V[2]))/den,c=1-a-b;
      if(a<-.001||b<-.001||c<-.001)continue;
      const x=a*X[0]+b*X[1]+c*X[2],y=a*Y[0]+b*Y[1]+c*Y[2]-bounds.min.y,z=a*Z[0]+b*Z[1]+c*Z[2],ny=a*NY[0]+b*NY[1]+c*NY[2];
      const wheelDistance=Math.min(Math.hypot(x-f[0],y-f[1])/f[2],Math.hypot(x-r[0],y-r[1])/r[2]);
      const wheel=wheelDistance<1.025&&Math.abs(z)>W*.30;
      const underside=y<H*.13||ny<-.65;
      const cabinT=THREE.MathUtils.clamp((y/H-.60)/.33,0,1);
      const cabin=y>H*.60 && x>L*(-.28+cabinT*.14)&&x<L*(.22-cabinT*.07)&&!(y>H*.93&&ny>.5);
      const trim=y>H*.72&&Math.abs(x)>L*.34;
      const offset=(py*SIZE+px)*4;
      const red=source&&source[offset]>source[offset+1]*1.22&&source[offset]>source[offset+2]*1.22&&source[offset]>9;
      const warmBody=source && source[offset]>30 && source[offset]>source[offset+1]*1.04 && source[offset]>source[offset+2]*1.04;
      const selected=isRed ? !wheel&&!underside&&(red||(!cabin&&!trim&&warmBody)) : !wheel&&!underside&&!trim&&!cabin;
      if(selected)out[offset]=out[offset+1]=out[offset+2]=255;
    }
  }
  ctx.putImageData(image,0,0);
  // One-pixel gutter dilation covers UV seam sampling, without growing triangle edges.
  const gutter=document.createElement('canvas');gutter.width=gutter.height=SIZE;
  const g=gutter.getContext('2d');g.filter='blur(1px)';g.drawImage(canvas,0,0);
  const blurred=g.getImageData(0,0,SIZE,SIZE).data;
  for(let i=0;i<out.length;i+=4)if(blurred[i]>32)out[i]=out[i+1]=out[i+2]=255;
  ctx.putImageData(image,0,0);return canvas;
}

export async function createPaintSystem(meshes, bounds, car, onMaskStatus) {
  const originalMaterials = meshes.map(mesh => mesh.material);
  const masks = meshes.map(mesh => automaticMask(mesh, bounds, car));
  const key = `${car.id}:${car.taskId}:mask-v2`;
  const legacyKey = `${car.id}:${car.taskId}:mask-v1`;
  // Current assets each have one material atlas. Masks use native glTF v=0 at the top.
  try {
    const saved = await readMask(key);
    if (saved) { const bitmap = await createImageBitmap(saved); masks[0].getContext('2d').drawImage(bitmap,0,0,SIZE,SIZE); bitmap.close(); onMaskStatus('Saved body mask restored.'); }
    else onMaskStatus('Refined draft selection. Earlier saved masks can be restored below.');
  } catch { onMaskStatus('Mask storage unavailable; export edits before leaving.'); }
  const textures = masks.map(canvas => { const t=new THREE.CanvasTexture(canvas); t.flipY=false; t.colorSpace=THREE.NoColorSpace;t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.LinearFilter;return t; });
  const shared = {
    uPaintColor: { value: new THREE.Color('#d71928') }, uPaintMode: { value: 1 }, uMaskView: { value: 0 },
    uPaintRough: { value: .23 }, uPaintMetal: { value: .12 }, uPaintCoat: { value: 1 },
    uCoatRough: { value: .07 }, uNormalGain: { value: .15 }, uLivery: { value: 0 }
  };
  shared.uCleanMaterials = { value: 1 };
  shared.uCarSize = { value: bounds.getSize(new THREE.Vector3()) };
  shared.uCarBase = { value: bounds.min.y };
  shared.uFrontWheel = { value: new THREE.Vector3(...WHEEL_REGIONS[car.id].front) };
  shared.uRearWheel = { value: new THREE.Vector3(...WHEEL_REGIONS[car.id].rear) };
  meshes.forEach((mesh, i) => {
    const source = mesh.material;
    const material = new THREE.MeshPhysicalMaterial({
      color: source.color, map: source.map, normalMap: source.normalMap,
      normalScale: source.normalScale?.clone() ?? new THREE.Vector2(1,1),
      roughness: source.roughness, roughnessMap: source.roughnessMap,
      metalness: source.metalness, metalnessMap: source.metalnessMap,
      aoMap: source.aoMap, aoMapIntensity: source.aoMapIntensity,
      emissive: source.emissive, emissiveMap: source.emissiveMap,
      emissiveIntensity: source.emissiveIntensity,
      side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: .07,
      envMapIntensity: 1
    });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, shared, { uBodyMask: { value: textures[i] } });
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCarPosition;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarPosition = position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vCarPosition;
        uniform sampler2D uBodyMask;
        uniform vec3 uPaintColor;
        uniform vec3 uCarSize, uFrontWheel, uRearWheel;
        uniform float uCarBase, uCleanMaterials;
        uniform float uPaintMode, uMaskView, uPaintRough, uPaintMetal, uPaintCoat, uCoatRough, uNormalGain, uLivery;
      `).replace('#include <map_fragment>', `#include <map_fragment>
        float bodyMask = texture2D(uBodyMask, vMapUv).r;
        float cleanAmount = uCleanMaterials * float(uPaintMode > .5 && uPaintMode < 1.5);
        // Neutral replacements contain no generated albedo, lighting or normal-map detail.
        // These wheel/glass regions are draft spatial selections, editable via the body mask.
        float heightAboveGround = vCarPosition.y-uCarBase;
        float frontDistance = length(vec2(vCarPosition.x-uFrontWheel.x,heightAboveGround-uFrontWheel.y))/uFrontWheel.z;
        float rearDistance = length(vec2(vCarPosition.x-uRearWheel.x,heightAboveGround-uRearWheel.y))/uRearWheel.z;
        float wheelDistance = min(frontDistance,rearDistance);
        float wheelRegion = (1.0-smoothstep(1.0,1.06,wheelDistance))*step(uCarSize.z*.30,abs(vCarPosition.z));
        float rimRegion = (1.0-smoothstep(.66,.75,wheelDistance))*wheelRegion;
        float glassRegion = step(abs(vCarPosition.x),uCarSize.x*.23)*step(uCarSize.y*.59,heightAboveGround)*(1.0-step(uCarSize.y*.90,heightAboveGround));
        vec3 cleanTrim = mix(vec3(.018,.022,.028),vec3(.007,.014,.021),glassRegion);
        cleanTrim = mix(cleanTrim,vec3(.008),wheelRegion);
        cleanTrim = mix(cleanTrim,vec3(.29,.32,.36),rimRegion);
        diffuseColor.rgb = mix(diffuseColor.rgb,cleanTrim,cleanAmount);
        float paintAmount = (uPaintMode > .5 && uPaintMode < 1.5) ? bodyMask : 0.0;
        vec3 paintColor = uPaintColor;
        float stripe = 0.0;
        if (uLivery > .5 && uLivery < 1.5) stripe = smoothstep(.09,.105,abs(vCarPosition.z)) * (1.0-smoothstep(.205,.22,abs(vCarPosition.z)));
        if (uLivery > 1.5) stripe = 1.0-smoothstep(.18,.195,abs(vCarPosition.z));
        paintColor = mix(paintColor, vec3(.92), stripe);
        diffuseColor.rgb = mix(diffuseColor.rgb, paintColor, paintAmount);
        if (uPaintMode > 1.5) diffuseColor.rgb = vec3(.27);
        if (uMaskView > .5) diffuseColor.rgb = mix(vec3(.025), vec3(.9,.055,.18),bodyMask);
      `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float cleanRoughness = mix(.43,.13,glassRegion);
        cleanRoughness = mix(cleanRoughness,.90,wheelRegion);
        cleanRoughness = mix(cleanRoughness,.27,rimRegion);
        roughnessFactor = mix(roughnessFactor,cleanRoughness,cleanAmount);
        roughnessFactor = mix(roughnessFactor, uPaintRough, paintAmount);
        if(uPaintMode > 1.5) roughnessFactor = .42;
        if(uMaskView > .5) roughnessFactor = 1.0;
      `).replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor,.88*rimRegion,cleanAmount);
        metalnessFactor = mix(metalnessFactor, uPaintMetal, paintAmount);
        if(uPaintMode > 1.5 || uMaskView > .5) metalnessFactor = 0.0;
      `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, paintAmount * (1.0-uNormalGain)));
        normal = normalize(mix(normal,nonPerturbedNormal,cleanAmount));
        if(uPaintMode > 1.5 || uMaskView > .5) normal = nonPerturbedNormal;
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= (1.0-paintAmount)*(1.0-cleanAmount);
        if(uPaintMode > 1.5 || uMaskView > .5) totalEmissiveRadiance = vec3(0.0);
      `).replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat *= uPaintCoat * paintAmount * (1.0-uMaskView);
          material.clearcoatRoughness = uCoatRough;
        #endif
      `);
    };
    material.customProgramCacheKey = () => 'raceultimate-body-paint-v2-clean';
    mesh.material = material;
  });
  let timer, dirty=false;
  const history=[];
  async function persist() {
    dirty=false;
    try { await storeMask(key, await canvasBlob(masks[0])); onMaskStatus('Body mask saved on this device.'); }
    catch { onMaskStatus('Could not save mask; export a PNG to keep edits.'); }
  }
  function changed() {
    textures.forEach(t => { t.needsUpdate=true; });
    dirty=true; clearTimeout(timer); timer=setTimeout(persist,650);
    onMaskStatus('Body mask changed. Saving…');
  }
  return {
    set(settings, mode='paint', showMask=false) {
      const finish=FINISHES[settings.finish] ?? FINISHES.gloss;
      shared.uPaintColor.value.set(settings.color);
      shared.uPaintMode.value={original:0,paint:1,clay:2}[mode];
      shared.uMaskView.value=showMask?1:0;
      shared.uPaintRough.value=finish.roughness; shared.uPaintMetal.value=finish.metalness;
      shared.uPaintCoat.value=finish.coat; shared.uCoatRough.value=finish.coatRoughness;
      shared.uNormalGain.value=settings.normal/100;
      shared.uCleanMaterials.value=settings.clean === false ? 0 : 1;
      shared.uLivery.value={solid:0,twin:1,center:2}[settings.livery] ?? 0;
    },
    beginStroke() { history.push(masks[0].getContext('2d').getImageData(0,0,SIZE,SIZE)); if(history.length>5)history.shift(); },
    brush(uv, radius, add) {
      const ctx=masks[0].getContext('2d'); ctx.fillStyle=add?'#fff':'#000';
      ctx.beginPath();ctx.arc(uv.x*SIZE,uv.y*SIZE,radius,0,Math.PI*2);ctx.fill(); changed();
    },
    undo() { const data=history.pop();if(data){masks[0].getContext('2d').putImageData(data,0,0);changed();} },
    reset() { this.beginStroke(); meshes.forEach((mesh,i)=>{const source=mesh.material;mesh.material=originalMaterials[i];const fresh=automaticMask(mesh,bounds,car);mesh.material=source;masks[i].getContext('2d').drawImage(fresh,0,0);});changed(); },
    async restorePreviousMask() {
      try {
        const blob=await readMask(legacyKey);
        if(blob)await this.importMask(blob);
        else onMaskStatus('No earlier saved mask for this car.');
      } catch { onMaskStatus('Could not read earlier mask; import an exported PNG instead.'); }
    },
    async importMask(file) { const image=await createImageBitmap(file);this.beginStroke();const ctx=masks[0].getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,SIZE,SIZE);ctx.drawImage(image,0,0,SIZE,SIZE);image.close();changed(); },
    async exportMask() { return canvasBlob(masks[0]); },
    async flush() { if(dirty){clearTimeout(timer);await persist();} },
    dispose() { clearTimeout(timer); textures.forEach(t=>t.dispose());meshes.forEach(m=>m.material.dispose());history.length=0; }
  };
}
