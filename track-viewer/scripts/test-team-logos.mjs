import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {createServer} from 'vite';
const root=new URL('../../',import.meta.url),logos=new URL('assets/teams/logos/',root);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',logos))),teams=JSON.parse(readFileSync(new URL('assets/teams/teams.json',root))).teams;
assert.deepEqual(Object.keys(manifest.teams).sort(),teams.map(t=>t.id).sort());
let n=0,primaryBytes=0;
for(const team of teams){
 const mark=manifest.teams[team.id];assert.equal(mark.font.file,team.font.file);assert.deepEqual(mark.colors,team.colors);
 const font=team.font.file.split('-latin-')[0]+'-OFL.txt';assert.ok(existsSync(new URL('track-viewer/public/assets/fonts/'+font,root)));
 for(const [variant,assets] of Object.entries(mark.variants))for(const [kind,a] of Object.entries(assets)){
  const svg=readFileSync(new URL(a.svg,logos));
  assert.equal(createHash('sha256').update(svg).digest('hex'),a.sourceSha256);
  assert.ok(!/<(?:text|image|script|foreignObject)\b|(?:href|font-family)=|url\((?!#)/i.test(svg.toString()),'Masters must have no external fonts or images.');
  for(const format of ['png','webp']){
   const bytes=readFileSync(new URL(a[format],logos));assert.equal(createHash('sha256').update(bytes).digest('hex'),a[format+'Sha256']);
   assert.deepEqual(bytes,readFileSync(new URL('track-viewer/public/assets/teams/logos/'+a[format],root)));
   const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(info.width,kind==='lockup'?1024:256);assert.equal(info.height,256);assert.equal(info.channels,4);
   for(const p of [0,info.width-1,(info.height-1)*info.width,info.width*info.height-1])assert.equal(data[p*4+3],0,'Transparent corners required.');
   let visible=0;for(let i=3;i<data.length;i+=4)if(data[i]>128)visible++;
   assert.ok(visible>info.width*info.height*.01&&visible<info.width*info.height*.8,'Artwork must exist with surrounding transparency.');
  }
  if(variant==='onTeam'&&kind==='lockup')primaryBytes+=a.webpBytes;n++;
 }
}
const requests=[];globalThis.Image=class {constructor(){this.width=1024;this.height=256;}set src(url){this.url=url;requests.push(url);queueMicrotask(()=>this.onload());}};
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const M=await server.ssrLoadModule('/src/team-logos.js');
 await Promise.all([M.loadTeamLogos(),M.loadTeamLogos(),M.loadTeamLogo('saetta')]);
 assert.equal(requests.length,teams.length,'Concurrent venue and car requests must share image loads.');
 let draw;const g={save(){},restore(){},translate(){},rotate(){},drawImage(...args){draw=args;},fillText(){throw Error('Loaded logo must use the texture.');}};
 assert.ok(M.drawTeamLogo(g,teams[0],0,0,200,20));assert.equal(draw[3],80);assert.equal(draw[4],20);
 assert.ok(M.teamLogoUrl('saetta','onDark').includes('?v='));
 const draws=[],fonts=[];
 globalThis.FontFace=class {constructor(family){this.family=family;}async load(){fonts.push(this.family);return this;}};
 globalThis.document={fonts:{add(){}},createElement(tag){assert.equal(tag,'canvas');return {getContext(){return {save(){},restore(){},translate(){},rotate(){},scale(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},fill(){},stroke(){},fillText(){},strokeText(){},measureText(){return {width:80};},drawImage(im){draws.push(im.url);}};}};}};
 const {dressTeams}=await server.ssrLoadModule('/src/teamdress.js');
 const materials=teams.flatMap(t=>['GarageHeader','PitBox','Flag','TeamBanner'].map(kind=>({name:'M_'+kind+'_'+t.name.toUpperCase(),color:{set(){}},emissive:{set(){}}})));
 assert.equal(await dressTeams(materials),teams.length*4);
 assert.equal(draws.filter(url=>url.includes('/assets/teams/logos/')).length,teams.length*4,'All venue team surfaces must draw the baked logo.');
 assert.ok(materials.every(m=>m.map?.isCanvasTexture));
 assert.equal(fonts.length,4,'Only common copy/number fonts should load; team lettering is baked.');
}finally{await server.close();delete globalThis.Image;delete globalThis.FontFace;delete globalThis.document;}
console.log(`PASS: ${n} outlined SVG masters, ${n*2} transparent PNG/WebP exports, matching shipped hashes, ${teams.length} shared image loads, aspect-preserving drawing. Primary team textures: ${primaryBytes.toLocaleString()} bytes.`);
