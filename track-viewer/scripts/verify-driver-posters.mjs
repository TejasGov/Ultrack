import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const root=new URL('../../',import.meta.url);
const teams=JSON.parse(readFileSync(new URL('assets/teams/teams.json',root))).teams;
const requested=process.argv.slice(2);
assert(requested.length,'Pass the driver directory names to verify.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceHashes=new Set();
for(const id of requested){
 const team=teams.find(t=>t.cars.some(c=>c.driver.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')===id));
 assert(team,'Unknown driver '+id);
 const car=team.cars.find(c=>c.driver.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')===id);
 const dir=new URL('assets/drivers/'+id+'/',root);
 const read=name=>readFileSync(new URL(name,dir));
 const meta=JSON.parse(read('intro.json'));
 assert.deepEqual(meta.driver,car.driver,id+': driver metadata');
 assert.equal(meta.team,team.id,id+': team');
 assert.equal(meta.raceNumber,car.number,id+': number');
 assert.equal(meta.carKey,car.key,id+': car assignment');
 assert.equal(meta.titleSponsor,team.sponsor,id+': sponsor');
 assert.deepEqual(meta.font,team.font,id+': font');
 assert.equal(meta.sourceSha256,sha(read('source/illustration-v1.png')),id+': source hash');
 assert(!sourceHashes.has(meta.sourceSha256),id+': another assignment uses this source image');
 sourceHashes.add(meta.sourceSha256);
 for(const file of ['poster-v1.png','poster-v1.svg'])
  assert.equal(meta.outputs?.[file]?.sha256,sha(read(file)),id+': '+file+' hash');
 const png=read('poster-v1.png'),dimensions=await sharp(png).metadata(),stats=await sharp(png).stats();
 assert.equal(dimensions.width,1920);assert.equal(dimensions.height,1080);
 assert(stats.isOpaque,id+': final frame must be opaque');
 const svg=read('poster-v1.svg').toString();
 assert(svg.includes('data:image/png;base64,'),id+': portable PNG artwork embedding');
 assert(!/(?:href|src)\s*=\s*["'](?:https?:|file:|\/assets)/i.test(svg),id+': external dependency');
 const webp=await sharp(read('illustration-v1.webp')).metadata();assert.equal(webp.format,'webp');
 assert(existsSync(new URL('source/ART-DIRECTION.md',dir)),id+': missing prompt record');
 const brief=read('source/ART-DIRECTION.md').toString();
 const count=brief.match(/generation\s*Calls\s*:\s*(\d+)\b/i);
 assert(count,id+': missing generation record');
 assert.equal(Number(count[1]),id==='rosa-quintero'?2:1,id+': unexpected generation count');
 console.log('PASS '+id+': roster, sponsor, font, hashes, 1920x1080 opaque PNG, portable SVG, WebP, prompt record ('+count[1]+' calls)');
}
