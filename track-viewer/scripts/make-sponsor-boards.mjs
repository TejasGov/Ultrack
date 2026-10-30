// Render a brand's logo PNG and its board textures from its retained source in assets/sponsors/sources (sharp, no network).
//   node scripts/make-sponsor-boards.mjs sony              (all default aspects)
//   node scripts/make-sponsor-boards.mjs sony 3000 6000    (only these; the number is round(width / height * 1000), as in brand_art.py)
// Board = white panel (the brand's `background`) with the mark centred and repeated across wide boards; vertical pole banners
// (aspect < 1) carry it rotated to read upward, like the existing Rolex boards. Output: assets/sponsors/boards/<id>-<aspect>.png.
import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../../assets/sponsors/',import.meta.url),local=u=>u.pathname.replace(/^\/([A-Za-z]:)/,'$1');
const [id,...only]=process.argv.slice(2);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root))),brand=manifest.brands.find(b=>b.id===id);
if(!brand)throw Error('Unknown brand '+id);
// the aspects the Marina's boards use (assets/sponsors/board-plan.json) plus a 3:2 flag
const ASPECTS=[324,389,1600,3000,3111,6000,8571,10833,11818,15000];
const wanted=(only.length?only.map(Number):ASPECTS);
let source=readFileSync(new URL(brand.sourceFile.replace(/^assets\/sponsors\//,''),root));
// a one-colour mark (Simple Icons) takes the brand's ink, as in prepare-sponsor-logos.mjs
if(brand.ink&&brand.sourceFile.endsWith('.svg'))source=Buffer.from(source.toString().replace('<svg ','<svg fill="'+brand.ink+'" '));
const logo=await sharp(source,{density:300}).resize({width:512}).ensureAlpha().png().toBuffer();
writeFileSync(new URL(brand.file,root),logo);
const trim=await sharp(source,{density:600}).trim({threshold:1}).png().toBuffer(),meta=await sharp(trim).metadata();
const LA=meta.width/meta.height;
for(const aspect of wanted){
 const vertical=aspect<1000,W=vertical?256:aspect>=8000?2048:1024,H=Math.round(W/(aspect/1000));
 const canvasW=vertical?H:W,canvasH=vertical?W:H;            // draw a horizontal board, rotate it for the pole banners
 const logoH=Math.max(8,Math.min(Math.round(canvasH*.46),Math.round(canvasW*.84/LA)));
 const logoW=Math.round(logoH*LA),pitch=Math.round(logoW*1.55),n=Math.max(1,Math.floor((canvasW*.94-logoW)/pitch)+1);
 const mark=await sharp(trim).resize({width:logoW,height:logoH}).png().toBuffer(),left0=Math.round((canvasW-(logoW+(n-1)*pitch))/2);
 let board=sharp({create:{width:canvasW,height:canvasH,channels:4,background:brand.background}}).composite(Array.from({length:n},(_,i)=>({input:mark,left:left0+i*pitch,top:Math.round((canvasH-logoH)/2)})));
 const out=await board.png().toBuffer();
 await sharp(out).rotate(vertical?-90:0).png().toFile(local(new URL(`boards/${id}-${aspect}.png`,root)));
 console.log(`${id}-${aspect}.png ${vertical?canvasH:canvasW}x${vertical?canvasW:canvasH} x${n}`);
}
