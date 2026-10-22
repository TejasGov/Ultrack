import sharp from 'sharp';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../../',import.meta.url),drivers=new URL('assets/drivers/',root);
const teams=JSON.parse(readFileSync(new URL('assets/teams/teams.json',root))).teams;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusFile=new URL('review-status.json',drivers),statuses=existsSync(statusFile)?JSON.parse(readFileSync(statusFile)):{};
const entries=[];
for(const t of teams)for(const car of t.cars){
 const id=car.driver.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),dir=new URL(id+'/',drivers),poster=new URL('poster-v1.png',dir);
 if(!existsSync(poster))continue;
 const meta=await sharp(readFileSync(poster)).metadata();
 if(meta.width!==1920||meta.height!==1080)throw Error('Poster needs a 1920×1080 final frame: '+id);
 await sharp(readFileSync(poster)).webp({quality:88,effort:5}).toFile(fileURLToPath(new URL('poster-game.webp',dir)));
 await sharp(readFileSync(poster)).resize(960,540).webp({quality:87,effort:4}).toFile(fileURLToPath(new URL('poster-thumb.webp',dir)));
 entries.push({id,driver:car.driver.name,number:car.number,team:t.name,sponsor:t.sponsor,status:statuses[id]??'awaiting-review'});
}
const cards=entries.map(e=>`<article><a class="art" href="/assets/drivers/${e.id}/poster-v1.png" target="_blank" rel="noopener"><img src="/assets/drivers/${e.id}/poster-thumb.webp" width="960" height="540" alt="${esc(e.driver)} illustrated driver intro poster" loading="lazy"></a><div class="info"><div><h2>${esc(e.driver)}</h2><p>${esc(e.team)} #${e.number} · ${esc(e.sponsor)}</p></div><span class="status ${e.status==='approved-style'?'approved':''}">${e.status==='approved-style'?'APPROVED STYLE':'NEW / REVIEW'}</span></div><nav><a href="/assets/drivers/${e.id}/poster-v1.png" download>Download PNG ↓</a><a href="/assets/drivers/${e.id}/poster-v1.svg" download>Download SVG ↓</a>${e.id==='matteo-varrone'?'<a href="/driver-intro.html">Play approved intro ↗</a>':''}</nav></article>`).join('');
writeFileSync(new URL('gallery.html',drivers),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ultrack · Driver poster review</title><style>:root{color-scheme:dark;background:#0d0e12;color:#f5f1e8;font:15px system-ui,sans-serif}*{box-sizing:border-box}body{max-width:1600px;margin:auto;padding:36px 24px}header{display:flex;align-items:center;justify-content:space-between;font-size:11px;letter-spacing:.14em}a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}h1{font-size:clamp(30px,4vw,52px);letter-spacing:-.04em;margin-bottom:8px}.sub{color:#a3abb7;line-height:1.6;margin-top:0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:30px}article{background:#171a21;border:1px solid #303541;border-radius:10px;overflow:hidden}.art{display:block}.art img{display:block;width:100%;height:auto;aspect-ratio:16/9}.info{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 0}h2{font-size:20px;margin:0}.info p{color:#a6afbc;font-size:13px;margin:7px 0}.status{font-size:9px;letter-spacing:.08em;border:1px solid #876d31;color:#f2ce75;padding:6px;border-radius:3px;white-space:nowrap}.approved{border-color:#416e54;color:#a1d2ae}nav{padding:12px 18px 18px;display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:#b6d9ff}@media(max-width:800px){.grid{grid-template-columns:1fr}body{padding:24px 12px}.info{align-items:start}.status{font-size:8px}}</style><header><strong>ULTRACK / DRIVER IDENTITIES</strong><a href="/">BACK TO GAME ↗</a></header><h1>The next faces on the grid.</h1><p class="sub">Illustrated driver identities with team colors and fonts. Open a poster to inspect the full-resolution artwork; new additions are marked for review.</p><main class="grid">${cards}</main></html>`);
writeFileSync(new URL('gallery.json',drivers),JSON.stringify({schemaVersion:1,posters:entries},null,2)+'\n');
console.log('Prepared lightweight review gallery for '+entries.length+' driver posters.');
