import sharp from 'sharp';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root=new URL('../../assets/sponsors/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
mkdirSync(new URL('logos/',root),{recursive:true});
for(const b of manifest.brands){
 let raw=readFileSync(new URL('../../'+b.sourceFile,import.meta.url));
 if(b.ink&&b.sourceFile.endsWith('.svg'))raw=Buffer.from(raw.toString().replace('<svg ','<svg fill="'+b.ink+'" '));
 let artwork=sharp(raw,{density:300});
 if(b.sourceCrop)artwork=artwork.extract(b.sourceCrop);
 await artwork.trim().resize({width:512,height:256,fit:'inside'}).png().toFile(new URL(b.file,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
}
console.log('Prepared '+manifest.brands.length+' original-logo textures.');
