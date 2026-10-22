import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const drivers=new URL('../../assets/drivers/',import.meta.url);
const ids=['jonas-reiter','aiko-tanabe','freya-lindqvist','rosa-quintero','remy-valois','armand-beaulieu'];
const tiles=await Promise.all(ids.map(async(id,i)=>({
 input:await sharp(readFileSync(new URL(id+'/poster-v1.png',drivers))).resize(720,405).toBuffer(),
 left:(i%2)*720,top:Math.floor(i/2)*405
})));
await sharp({create:{width:1440,height:1215,channels:3,background:'#101317'}})
 .composite(tiles).webp({quality:91}).toFile(fileURLToPath(new URL('batch-02-review.webp',drivers)));
console.log('Saved assets/drivers/batch-02-review.webp');
