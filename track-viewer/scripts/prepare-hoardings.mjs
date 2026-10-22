import sharp from 'sharp';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../../assets/drivers/',import.meta.url);
let bytes=0;
for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isDirectory()){
 try{const output=await sharp(fileURLToPath(new URL(`${entry.name}/poster-game.webp`,root))).resize(1024,576).webp({quality:84}).toFile(fileURLToPath(new URL(`${entry.name}/poster-hoarding.webp`,root)));bytes+=output.size;}catch(error){if(!error.message.includes('missing'))throw error;}
}
console.log('Hoarding texture bytes for all 14 drivers:',bytes);
