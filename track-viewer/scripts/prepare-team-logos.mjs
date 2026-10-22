import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../assets/teams/logos/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));
const local=url=>url.pathname.replace(/^\/([A-Za-z]:)/,'$1'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let total=0;
for(const team of Object.values(manifest.teams))for(const variant of Object.values(team.variants))for(const asset of Object.values(variant)){
 const svg=readFileSync(new URL(asset.svg,root));
 for(const format of ['png','webp']){
  const pipeline=sharp(svg).ensureAlpha();
  const bytes=await(format==='png'?pipeline.png():pipeline.webp({lossless:true,effort:6})).toBuffer();
  writeFileSync(new URL(asset[format],root),bytes);asset[format+'Sha256']=sha(bytes);asset[format+'Bytes']=bytes.length;if(format==='webp')total+=bytes.length;
 }
}
writeFileSync(new URL('manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
const runtime=Object.fromEntries(Object.entries(manifest.teams).map(([id,t])=>[id,Object.fromEntries(Object.entries(t.variants).map(([v,assets])=>[v,Object.fromEntries(Object.entries(assets).map(([kind,a])=>[kind,a.webp+'?v='+a.webpSha256.slice(0,12)]))]))]));
writeFileSync(new URL('runtime.json',root),JSON.stringify(runtime)+'\n');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tiles=[];let i=0;
for(const team of Object.values(manifest.teams)){
 const rgb=[1,3,5].map(i=>parseInt(team.colors.primary.slice(i,i+2),16)),light=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>140;
 const svg=`<svg width="660" height="254" xmlns="http://www.w3.org/2000/svg"><rect width="660" height="254" rx="16" fill="${team.colors.primary}"/><text x="26" y="34" font-family="Arial" font-size="14" fill="${light?'#202630':'#ffffff'}">${escape(team.name.toUpperCase())} / ${escape(team.font.family)}</text><rect x="26" y="220" width="38" height="6" fill="${team.colors.secondary}"/><rect x="70" y="220" width="38" height="6" fill="${team.colors.accent}"/></svg>`;
 const tile=await sharp(Buffer.from(svg)).composite([{input:await sharp(readFileSync(new URL(team.variants.onTeam.lockup.svg,root))).resize(600,150).toBuffer(),left:30,top:62}]).png().toBuffer();
 tiles.push({input:tile,left:30+(i%2)*680,top:96+Math.floor(i/2)*274});i++;
}
const title=Buffer.from('<svg width="1400" height="1200" xmlns="http://www.w3.org/2000/svg"><rect width="1400" height="1200" fill="#0b0e13"/><text x="30" y="54" fill="#f2f1eb" font-family="Arial" font-size="28" font-weight="bold">ULTRACK / TEAM IDENTITIES</text><text x="720" y="1045" fill="#a9b4c4" font-family="Arial" font-size="19">7 original emblems · outlined lettering</text><text x="720" y="1080" fill="#a9b4c4" font-family="Arial" font-size="19">SVG masters + transparent PNG / WebP</text><text x="720" y="1115" fill="#a9b4c4" font-family="Arial" font-size="19">Team, dark and light background variants</text></svg>');
await sharp(title).composite(tiles).png().toFile(local(new URL('review.png',root)));
const cards=Object.entries(manifest.teams).map(([id,t])=>`<article><div class="preview" style="background:${t.colors.primary}"><img src="/assets/teams/logos/${t.variants.onTeam.lockup.webp}" alt="${escape(t.name)}"></div><div class="details"><h2>${escape(t.name)}</h2><p>${escape(t.emblem)} · ${escape(t.font.family)}</p><div class="colors">${['primary','secondary','accent'].map(k=>`<span><i style="background:${t.colors[k]}"></i>${t.colors[k]}</span>`).join('')}</div><div class="alternates"><div class="dark"><img src="/assets/teams/logos/${t.variants.onDark.lockup.webp}" alt="On dark"></div><div class="light"><img src="/assets/teams/logos/${t.variants.onLight.lockup.webp}" alt="On light"></div></div><p class="downloads">${['svg','png','webp'].map(f=>`<a href="/assets/teams/logos/${t.variants.onTeam.lockup[f]}" download>${f.toUpperCase()}</a>`).join(' · ')} · <a href="/assets/teams/logos/${t.variants.onDark.icon.svg}" download>Emblem SVG</a></p></div></article>`).join('');
writeFileSync(new URL('../brand-guide.html',root),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ultrack team identities</title><style>:root{color-scheme:dark;font:16px system-ui;background:#0b0e13;color:#f4f1ea}*{box-sizing:border-box}body{max-width:1200px;margin:auto;padding:40px 24px}header{display:flex;justify-content:space-between;align-items:center}a{color:#acd6ff}h1{font-size:42px;letter-spacing:-.04em;margin-bottom:10px}p{color:#aab6c6;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:32px}article{background:#161c25;border:1px solid #2b3543;border-radius:14px;overflow:hidden}.preview{padding:30px 18px}.preview img{width:100%;display:block}.details{padding:4px 22px 14px}h2{margin-bottom:4px}.colors{display:flex;gap:14px;font:12px monospace}.colors span{display:flex;align-items:center;gap:6px}i{display:inline-block;width:15px;height:15px;border:1px solid #ffffff44;border-radius:3px}.alternates{display:flex;margin-top:20px;gap:10px}.alternates div{width:50%;padding:8px;border-radius:6px}.dark{background:#090c11}.light{background:#f5f3ed}.alternates img{width:100%;display:block}.downloads{font-size:13px}@media(max-width:740px){.grid{grid-template-columns:1fr}h1{font-size:32px}}</style><header><strong>ULTRACK / BRAND ASSETS</strong><a href="/">Back to game</a></header><h1>Seven teams. Seven identities.</h1><p>Original emblems and outlined wordmarks in each team's chosen typeface. Masters have no external fonts or image dependencies. Every variant has a transparent background.</p><div class="grid">${cards}</div></html>`);
console.log('Prepared 42 transparent logo textures;',total.toLocaleString(),'WebP bytes; wrote review sheet and gallery.');
