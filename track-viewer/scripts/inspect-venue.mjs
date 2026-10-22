import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(new URL('../../tracks/marina/out/web/marina_visual.glb',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const rows=doc.getRoot().listMeshes().map(m=>({name:m.getName(),tris:m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0),materials:m.listPrimitives().map(p=>p.getMaterial()?.getName())}));
console.log(JSON.stringify({total:rows.reduce((n,r)=>n+r.tris,0),nodes:doc.getRoot().listNodes().length,meshes:rows.length,largest:rows.sort((a,b)=>b.tris-a.tris).slice(0,25)},null,2));
