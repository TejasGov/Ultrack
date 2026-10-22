import {GameAudio} from './game/audio.js';
const $=id=>document.getElementById(id),audio=new GameAudio();
let bank,playing=false,sweepAt=null,request=0,loading=null;
const status=text=>{$('status').textContent=text;};
function stop(){request++;playing=false;sweepAt=null;audio.engineOff();$('source').pause();status('Stopped.');}
function labels(){
 $('rpm-value').textContent=Number($('rpm').value).toLocaleString()+' RPM';
 $('load-value').textContent=Math.round($('load').value*100)+'%';
 $('volume-value').textContent=Math.round($('volume').value*100)+'%';
 if(audio.ctx)audio.setVolumes({master:Number($('volume').value),engine:.85,effects:0,commentaryOn:false,commentary:0,crowd:0});
}
function select(){
 stop();const p=bank.profiles[$('car').value];
 $('match').textContent=p.match;
 $('quality').textContent=p.quality==='limited-rpm-source'?'Limited source: AMG ONE high-RPM layers are transposed from low-speed running. This needs a better full-load recording.':'Real recording; RPM anchors estimated. Check steady notes and transitions before approving the sound.';
 $('rpm').max=p.redline;$('rpm').min=p.loops.idle.rpm;$('rpm').value=p.loops.idle.rpm;
 $('source').src='/assets/audio/'+p.preview;
 const link=document.createElement('a');link.href=p.source.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=p.source.title;
 const license=document.createElement('a');license.href=p.source.licenseUrl;license.textContent=p.source.license;
 $('credit').replaceChildren(link,document.createTextNode(' · '+p.source.author+' · '),license);
 labels();history.replaceState(null,'','?car='+encodeURIComponent($('car').value));
}
async function start(){
 const token=++request;$('start').disabled=true;status('Preparing selected engine…');
 try{
  $('source').pause();
  // The first AudioContext is constructed synchronously in this click gesture.
  loading??=audio.start().catch(e=>{loading=null;throw e;});await loading;
  if(token!==request)return;
  await audio.engineFor($('car').value);
  if(token!==request)return;
  const layers=Object.values(audio.engine?.layers??{});
  if(!layers.length||layers.some(l=>!l.h))throw Error('A selected recording did not decode.');
  playing=true;labels();status('Engine running. Adjust RPM and throttle, or run the acceleration preview.');
 }catch(e){if(token===request){audio.engineOff();status('Could not start: '+e.message);}}
 finally{$('start').disabled=false;}
}
$('start').addEventListener('click',start);$('stop').addEventListener('click',stop);
$('car').addEventListener('change',select);
for(const id of ['rpm','load','volume'])$(id).addEventListener('input',()=>{sweepAt=null;labels();});
$('source').addEventListener('play',()=>{request++;playing=false;sweepAt=null;audio.engineOff();status('Playing source excerpt.');});
$('shift').addEventListener('click',()=>{if(!playing)return;audio.shift();$('rpm').value=Math.max(Number($('rpm').min),$('rpm').value*.72);labels();});
$('sweep').addEventListener('click',async()=>{if(!playing)await start();if(playing)sweepAt=performance.now();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
function frame(now){
 if(playing){
  if(sweepAt!==null){
   const t=(now-sweepAt)/1000,p=audio.engine.prof,idle=p.loops.idle.rpm;
   const f=t<2?0:t<10?(t-2)/8:t<12?1:Math.max(0,1-(t-12)/5);
   $('rpm').value=idle+(p.redline-idle)*f;$('load').value=t<2?.1:t<12?.9:0;
   if(t>17)sweepAt=null;labels();
  }
  audio.engineUpdate(Number($('rpm').value),Number($('load').value),1,0,0);
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
try{
 const response=await fetch('/assets/audio/recorded-engine-bank.json');if(!response.ok)throw Error('Recording bank unavailable.');bank=await response.json();
 $('car').replaceChildren(...Object.entries(bank.profiles).map(([key,p])=>{const o=document.createElement('option');o.value=key;o.textContent=p.name;return o;}));
 const key=new URLSearchParams(location.search).get('car');if(bank.profiles[key])$('car').value=key;
 $('car').disabled=false;$('start').disabled=false;select();status('Ready. Select a car and start the engine.');
}catch(e){status(e.message);}
