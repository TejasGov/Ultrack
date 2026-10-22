// Optional GPU-compressed variants. Originals remain the fallback and source of truth.
// npm run pack:cars -- [av12 furari-488 ...] [--size=512]
import {readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder,MeshoptEncoder} from 'meshoptimizer';
import {ktx2} from 'ktx2-encoder/gltf-transform';
import {meshopt} from '@gltf-transform/functions';
import sharp from 'sharp';
const root=fileURLToPath(new URL('../../',import.meta.url)),base=resolve(root,'assets/cars');
const args=process.argv.slice(2),keys=args.filter(a=>!a.startsWith('--'));
if(!keys.length)keys.push('av12','furari-488','mp1x','jaguarxkjss','nuvolari');
const size=Number(args.find(a=>a.startsWith('--size='))?.split('=')[1]??512);
if(![256,512,1024].includes(size))throw Error('Texture size must be 256, 512 or 1024.');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
const imageDecoder=async buffer=>{const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:new Uint8Array(data),width:info.width,height:info.height};};
const indexPath=resolve(base,'texture-variants.json'),index=JSON.parse(readFileSync(indexPath,'utf8')),report=[];
for(const key of keys){
  if(!/^[a-z0-9-]+$/.test(key))throw Error('Invalid car key: '+key);
  const variants={};
  for(const lod of [0,1]){
    const src=resolve(base,key,'car_lod'+lod+'.glb'),name='car_lod'+lod+'_ktx2.glb',dst=resolve(base,key,name);
    if(!existsSync(src))throw Error('Missing complete model: '+src);
    const doc=await io.read(args.includes('--geometry-only')?dst:src);
    for(const tex of doc.getRoot().listTextures()){
      if(!tex.getImage()||tex.getMimeType()==='image/ktx2')continue;
      const [w,h]=tex.getSize(),scale=Math.min(1,size/Math.max(w,h)),pot=n=>2**Math.ceil(Math.log2(Math.max(4,n)));
      tex.setImage(new Uint8Array(await sharp(tex.getImage()).resize(pot(w*scale),pot(h*scale),{fit:'fill'}).png().toBuffer()));tex.setMimeType('image/png');
    }
    const common={generateMipmap:true,imageDecoder};
    if(doc.getRoot().listTextures().some(t=>t.getMimeType()!=='image/ktx2'))await doc.transform(
      ktx2({...common,slots:/normalTexture/,isUASTC:true,isNormalMap:true,needSupercompression:true,uastcLDRQualityLevel:2,enableRDO:true,rdoQualityLevel:2}),
      ktx2({...common,slots:/baseColorTexture|emissiveTexture/,isUASTC:false,qualityLevel:160,compressionLevel:2,isPerceptual:true,isSetKTX2SRGBTransferFunc:true}),
      ktx2({...common,isUASTC:false,qualityLevel:160,compressionLevel:2,isPerceptual:false,isSetKTX2SRGBTransferFunc:false}),
    );
    if(doc.getRoot().listTextures().some(t=>t.getMimeType()!=='image/ktx2'))throw Error('Unconverted texture in '+key);
    // Near-lossless car-scale quantization: under 0.1 mm over a 5 m body.
    await doc.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:14,quantizeTexcoord:16}));
    await io.write(dst,doc);await io.read(dst); // Validate before advertising the variant.
    variants['lod'+lod]=name;
    report.push({key,lod,originalBytes:statSync(src).size,compressedBytes:statSync(dst).size,textures:doc.getRoot().listTextures().length});
  }
  index[key]=variants;writeFileSync(indexPath,JSON.stringify(index,null,2)+'\n');
}
// keep the rows of cars not packed this run
const reportPath=resolve(base,'texture-pack-report.json'),kept=existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')).filter(r=>!keys.includes(r.key)):[];
writeFileSync(reportPath,JSON.stringify([...kept,...report],null,2)+'\n');console.table(report);
