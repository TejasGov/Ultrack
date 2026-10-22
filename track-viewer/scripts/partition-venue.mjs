// Spatial draw sections: keep every triangle and all vertex attributes, but make
// whole-track meshes independently frustum-cullable. Original/shell assets stay intact.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {compactPrimitive,prune} from '@gltf-transform/functions';
import {Matrix4,Vector3} from 'three';
import {existsSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const root=new URL('../../tracks/marina/out/web/',import.meta.url),qa=new URL('../qa/sectors/',import.meta.url);
mkdirSync(qa,{recursive:true});
const CELL=768;
// Keep terrain and small painted/detail meshes intact: partitioning those adds
// too many tiny draws and file overhead for little saved work.
const selected=/^track_00$/;
const report=[];
for(const base of ['marina_visual','marina_visual_ktx2']){
 const original=fileURLToPath(new URL(base+'.glb',root)),shell=fileURLToPath(new URL(base+'_shell.glb',root));
 const src=existsSync(shell)&&statSync(shell).mtimeMs>=statSync(original).mtimeMs?shell:original;
 const doc=await io.read(src),changes=[];
 for(const node of [...doc.getRoot().listNodes()]){
  const mesh=node.getMesh();if(!mesh||!selected.test(mesh.getName())||node.getSkin()||node.getExtension('EXT_mesh_gpu_instancing'))continue;
  if(mesh.listParents().filter(parent=>parent.propertyType==='Node').length!==1)continue;
  const primitives=mesh.listPrimitives();
  const triangles=primitives.reduce((sum,p)=>sum+(p.getIndices()?.getCount()??0)/3,0);
  if(triangles<1500||primitives.some(p=>p.getMode()!==4||p.listTargets().length))continue;
  const matrix=new Matrix4().fromArray(node.getWorldMatrix()),point=new Vector3(),center=new Vector3();
  const cells=new Map();
  for(const primitive of primitives){
   const position=primitive.getAttribute('POSITION'),indices=primitive.getIndices();if(!position||!indices)continue;
   for(let i=0;i<indices.getCount();i+=3){
    center.set(0,0,0);
    for(let j=0;j<3;j++){point.fromArray(position.getElement(indices.getScalar(i+j),[])).applyMatrix4(matrix);center.add(point);}
    center.multiplyScalar(1/3);
    const key=`${Math.floor(center.x/CELL)}_${Math.floor(center.z/CELL)}`;
    if(!cells.has(key))cells.set(key,new Map());
    const byPrimitive=cells.get(key);if(!byPrimitive.has(primitive))byPrimitive.set(primitive,[]);
    byPrimitive.get(primitive).push(indices.getScalar(i),indices.getScalar(i+1),indices.getScalar(i+2));
   }
  }
  if(cells.size<2)continue;
  const name=node.getName()||mesh.getName();
  node.setMesh(null);
  for(const [cell,parts] of cells){
   const section=doc.createMesh(`${mesh.getName()}_section_${cell}`);
   for(const [source,indices] of parts){
    const primitive=source.clone();
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(source.getIndices().getBuffer()));
    compactPrimitive(primitive);section.addPrimitive(primitive);
   }
   // Parent preserves the original quantization scale / transform; children are identity transforms.
   node.addChild(doc.createNode(`${name}_section_${cell}`).setMesh(section));
  }
  changes.push({name:mesh.getName(),triangles,sections:cells.size});
  mesh.dispose();
 }
 await doc.transform(prune({keepAttributes:true,keepLeaves:true,keepExtras:true}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const out=fileURLToPath(new URL(base+'_sectors.glb',root));await io.write(out,doc);
 const row={base,cellMetres:CELL,sourceBytes:statSync(src).size,outputBytes:statSync(out).size,changes};
 report.push(row);console.log(JSON.stringify(row));
}
writeFileSync(new URL('report.json',qa),JSON.stringify(report,null,2));
