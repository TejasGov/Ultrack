import sharp from 'sharp';import {readFileSync} from 'node:fs';
const root=new URL('../../assets/sponsors/',import.meta.url),m=JSON.parse(readFileSync(new URL('manifest.json',root)));
const cards=[];
for(let i=0;i<m.brands.length;i++){
 const b=m.brands[i],png=await sharp(new URL(b.file,root).pathname.replace(/^\/([A-Za-z]:)/,'$1')).resize({width:180,height:90,fit:'inside'}).png().toBuffer(),d=await sharp(png).metadata();
 const tile=await sharp({create:{width:220,height:130,channels:4,background:b.background}}).composite([{input:png,left:Math.round((220-d.width)/2),top:Math.round((130-d.height)/2)}]).png().toBuffer();
 cards.push({input:tile,left:(i%5)*224,top:Math.floor(i/5)*134});
}
await sharp({create:{width:1120,height:402,channels:4,background:'#212936'}}).composite(cards).png().toFile('assets/sponsors/review.png');
