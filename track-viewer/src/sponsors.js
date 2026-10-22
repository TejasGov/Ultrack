import MANIFEST from '../../assets/sponsors/manifest.json';
export const SPONSOR_BRANDS=MANIFEST.brands.filter((b,i)=>i<7||b.usage==='team-sponsor');
const lookup=new Map(SPONSOR_BRANDS.flatMap(b=>[b.name,...b.aliases].map(n=>[n.toUpperCase(),b]))),images=new Map();
let ready;
export const sponsorOf=name=>lookup.get(name?.toUpperCase());
export function loadSponsorLogos(){
  return ready??=Promise.all(SPONSOR_BRANDS.map(b=>new Promise(resolve=>{
    const im=new Image();im.onload=()=>{images.set(b.id,im);resolve();};im.onerror=()=>{console.warn('Sponsor logo unavailable:',b.name);resolve();};im.src='/assets/sponsors/'+b.file;
  })));
}
export function drawSponsor(g,name,x,y,w,h){
  const brand=sponsorOf(name);if(!brand)return;
  const im=images.get(brand.id);g.save();g.fillStyle=brand.background;g.fillRect(x-w/2,y-h/2,w,h);
  if(im){const scale=Math.min(w*.88/im.width,h*.78/im.height);g.drawImage(im,x-im.width*scale/2,y-im.height*scale/2,im.width*scale,im.height*scale);}
  else{g.fillStyle=brand.ink??'#111';g.font='bold '+h*.35+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(brand.name,x,y,w*.9);}
  g.restore();
}
