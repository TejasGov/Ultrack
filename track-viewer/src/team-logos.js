import FILES from '../../assets/teams/logos/runtime.json';
const images=new Map(),pending=new Map();
const keyOf=(team,variant,kind)=>(typeof team==='string'?team:team.id)+':'+variant+':'+kind;
export function teamLogoUrl(team,variant='onDark',kind='lockup'){
 const file=FILES[typeof team==='string'?team:team.id]?.[variant]?.[kind];
 return file?'/assets/teams/logos/'+file:null;
}
export function loadTeamLogo(team,variant='onTeam',kind='lockup'){
 const key=keyOf(team,variant,kind);
 if(!pending.has(key))pending.set(key,new Promise(resolve=>{
  const url=teamLogoUrl(team,variant,kind);if(!url){resolve(null);return;}
  const im=new Image();im.crossOrigin='anonymous';im.onload=()=>{images.set(key,im);resolve(im);};
  im.onerror=()=>{console.warn('Team logo unavailable:',key);resolve(null);};im.src=url;
 }));
 return pending.get(key);
}
export const loadTeamLogos=()=>Promise.all(Object.keys(FILES).map(id=>loadTeamLogo(id)));
/** Pixel coordinates; centred, aspect-preserving. Used after loadTeamLogos(). */
export function drawTeamLogo(g,team,x,y,w,h,{variant='onTeam',kind='lockup',rot=0}={}){
 const im=images.get(keyOf(team,variant,kind));
 g.save();g.translate(x,y);if(rot)g.rotate(rot);
 if(im){const scale=Math.min(w/im.width,h/im.height);g.drawImage(im,-im.width*scale/2,-im.height*scale/2,im.width*scale,im.height*scale);}
 else{g.fillStyle=team.colors.accent;g.font='bold '+h*.55+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(team.name.toUpperCase(),0,0,w);}
 g.restore();return !!im;
}
/** Extra baked decals (a team's 'kanji' variant: number roundels, katakana sponsor plate); the car liveries draw them. */
export const loadTeamExtras=()=>Promise.all(Object.entries(FILES).flatMap(([id,v])=>Object.keys(v.kanji??{}).map(kind=>loadTeamLogo(id,'kanji',kind))));
