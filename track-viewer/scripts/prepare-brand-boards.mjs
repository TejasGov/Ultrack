import sharp from 'sharp';import {readFileSync,mkdirSync} from 'node:fs';
const root=new URL('../../assets/sponsors/',import.meta.url),brands=JSON.parse(readFileSync(new URL('manifest.json',root))).brands,plan=JSON.parse(readFileSync(new URL('board-plan.json',root)));
mkdirSync(new URL('boards/',root),{recursive:true});
const seen=new Set();
for(const p of plan){
 const key=p.brand+'-'+Math.round(p.w/p.h*1000)+(p.flat?'-paint':'');
 if(seen.has(key))continue;seen.add(key);const b=brands.find(b=>b.id===p.brand);
 const W=p.vertical?256:1024,H=Math.max(64,Math.round(W*p.h/p.w)),base={create:{width:W,height:H,channels:4,background:p.flat?'#00000000':b.background}};
 let logo=sharp(new URL(b.file,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
 if(p.vertical)logo=logo.rotate(-90);
 const png=await logo.resize({width:Math.round(W*.84),height:Math.round(H*.76),fit:'inside'}).png().toBuffer();
 const info=await sharp(png).metadata(),images=[{input:png,left:Math.round((W-info.width)/2),top:Math.round((H-info.height)/2)}];
 await sharp(base).composite(images).png().toFile(new URL('boards/'+key+'.png',root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
}
console.log('Prepared '+seen.size+' aspect-correct banner textures.');
