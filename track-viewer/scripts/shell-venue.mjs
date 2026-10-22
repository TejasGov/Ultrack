// Derive a runtime shell variant. Originals and the driving collision mesh are never changed.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {compactPrimitive,prune} from '@gltf-transform/functions';
import {mkdirSync,writeFileSync,readFileSync,existsSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const TRACK=process.env.TRACK??'marina';   // TRACK=tokyo: tracks/tokyo/out/web, own QA folder
const root=new URL(`../../tracks/${TRACK}/out/web/`,import.meta.url),qa=new URL(TRACK==='marina'?'../qa/shells/':`../qa/shells-${TRACK}/`,import.meta.url);
mkdirSync(qa,{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const selected=process.env.SHELL_RE?new RegExp(process.env.SHELL_RE,'i'):/yacht|skyline|hotel|pit_building|garage|vip_booth|transporter/i;
const report=[];
for(const file of [`${TRACK}_visual.glb`,`${TRACK}_visual_ktx2.glb`]){
 const src=fileURLToPath(new URL(file,root)),doc=await io.read(src),candidates=[],payload=[];
 let before=0;
 for(const mesh of doc.getRoot().listMeshes()){
  for(const p of mesh.listPrimitives())before+=(p.getIndices()?.getCount()??p.getAttribute('POSITION')?.getCount()??0)/3;
  if(!selected.test(mesh.getName()))continue;
  const positions=[],faces=[],mapping=[];
  for(const primitive of mesh.listPrimitives()){
   const material=primitive.getMaterial();
   if(primitive.getMode()!==4||material?.getAlphaMode()!=='OPAQUE'||material?.getExtension('KHR_materials_transmission'))continue;
   const p=primitive.getAttribute('POSITION'),indices=primitive.getIndices();if(!p||!indices)continue;
   const offset=positions.length;
   for(let i=0;i<p.getCount();i++)positions.push(p.getElement(i,[]));
   for(let i=0;i<indices.getCount();i+=3){faces.push([indices.getScalar(i)+offset,indices.getScalar(i+1)+offset,indices.getScalar(i+2)+offset]);mapping.push([primitive,i]);}
  }
  if(faces.length){candidates.push({mesh,mapping});payload.push({name:mesh.getName(),positions,faces});}
 }
 const input=fileURLToPath(new URL(file+'.input.json',qa)),output=fileURLToPath(new URL(file+'.hidden.json',qa));
 writeFileSync(input,JSON.stringify(payload));
 const blender=process.env.BLENDER_EXE??'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
 if(!existsSync(blender))throw Error('Set BLENDER_EXE to run the shell audit.');
 execFileSync(blender,['--background','--factory-startup','--python',fileURLToPath(new URL('./hidden-faces.py',import.meta.url)),'--',input,output],{stdio:'inherit',windowsHide:true});
 const removals=JSON.parse(readFileSync(output,'utf8')),changes=[];let removed=0;
 removals.forEach((list,index)=>{
  const {mesh,mapping}=candidates[index],primitives=new Map();
  for(const face of list){const [primitive,start]=mapping[face];if(!primitives.has(primitive))primitives.set(primitive,new Set());primitives.get(primitive).add(start);}
  for(const [primitive,skip] of primitives){
   const original=primitive.getIndices(),array=original.getArray(),kept=[];
   for(let i=0;i<array.length;i+=3)if(!skip.has(i))kept.push(array[i],array[i+1],array[i+2]);
   if(!kept.length)mesh.removePrimitive(primitive);
   else {primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new array.constructor(kept)).setBuffer(original.getBuffer()));compactPrimitive(primitive);}
  }
  if(list.length)changes.push({mesh:mesh.getName(),removed:list.length});removed+=list.length;
 });
 await doc.transform(prune({keepAttributes:true,keepLeaves:true,keepExtras:true}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const destination=fileURLToPath(new URL(file.replace('.glb','_shell.glb'),root));await io.write(destination,doc);
 const row={file,before,after:before-removed,removed,sourceBytes:statSync(src).size,outputBytes:statSync(destination).size,changes};report.push(row);console.log(JSON.stringify(row));
}
writeFileSync(new URL('report.json',qa),JSON.stringify(report,null,2));
