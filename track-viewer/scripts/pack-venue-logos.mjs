import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {meshopt,join,dedup,prune,weld,textureCompress} from '@gltf-transform/functions';import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';import sharp from 'sharp';import {statSync} from 'node:fs';
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const doc=await io.read('tracks/marina/out/marina_visual.glb');
await doc.transform(dedup(),weld(),join(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048]}),meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16}));
await io.write('tracks/marina/out/web/marina_visual.glb',doc);
console.log('WEBP',statSync('tracks/marina/out/web/marina_visual.glb').size,'bytes');
