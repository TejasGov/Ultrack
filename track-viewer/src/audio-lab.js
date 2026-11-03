import {GameAudio,Gearbox} from './game/audio.js';
const $=id=>document.getElementById(id),audio=new GameAudio();
let banks={},playing=false,sweep=null,request=0,loading=null,last=0;
const status=text=>{$('status').textContent=text;};
const prof=()=>banks[$('version').value].profiles[$('car').value];
const idleOf=p=>p.idle?.rpm??p.loops.idle.rpm;
function stop(){request++;playing=false;sweep=null;audio.engineOff();$('source').pause();status('Stopped.');}
function labels(){
 $('rpm-value').textContent=Number($('rpm').value).toLocaleString()+' RPM';
 $('load-value').textContent=Math.round($('load').value*100)+'%';
 $('slip-value').textContent=Math.round($('slip').value*100)+'%';
 $('volume-value').textContent=Math.round($('volume').value*100)+'%';
 if(audio.ctx)audio.setVolumes({master:Number($('volume').value),engine:.85,effects:.8,commentaryOn:false,commentary:0,crowd:0});
}
function coverage(p){
 if(!p.on)return p.quality==='limited-rpm-source'?'Limited source: high-RPM layers are transposed from low-speed running. Current RPM labels are estimates.':'Old sound: very short loops with estimated RPM labels.';
 const top=p.on.at(-1).rpm,stretch=p.redline/top;
 const borrowed=p.sharedWith?`Borrows the ${banks.measured.profiles[p.sharedWith].name} recording. `:'';
 return `${borrowed}Real measured audio from ${idleOf(p).toLocaleString()} to ${top.toLocaleString()} rpm, ${p.on.length} on-throttle and ${p.off.length} off-throttle loops, ${p.shifts.length} shift and ${p.pops.length} pop samples.`+(stretch>1.2?` Above that it is pitched up, ×${stretch.toFixed(1)} at the ${p.redline.toLocaleString()} rpm redline.`:'');
}
function select(){
 stop();const p=prof();
 $('match').textContent=p.match;
 $('quality').textContent=coverage(p);
 $('rpm').max=p.redline;$('rpm').min=idleOf(p);$('rpm').value=idleOf(p);
 $('source').src='/assets/audio/'+p.preview;
 const credits=(p.sources??[p.source]).flatMap((s,i)=>{
  const link=document.createElement('a');link.href=s.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=s.title;
  const license=document.createElement('a');license.href=s.licenseUrl;license.textContent=s.license;
  return [...(i?[document.createElement('br')]:[]),link,document.createTextNode(' · '+s.author+' · '),license];
 });
 $('credit').replaceChildren(...credits);
 labels();history.replaceState(null,'',`?car=${encodeURIComponent($('car').value)}&version=${$('version').value}`);
}
async function start(){
 const token=++request;$('start').disabled=true;status('Preparing selected engine…');
 try{
  $('source').pause();
  // The first AudioContext is constructed synchronously in this click gesture.
  loading??=audio.start().catch(e=>{loading=null;throw e;});await loading;
  if(token!==request)return;
  audio.engineBank=banks[$('version').value];
  await audio.engineFor($('car').value);
  if(token!==request)return;
  const layers=Object.values(audio.engine?.layers??{});
  if(!layers.length||layers.some(l=>!l.h))throw Error('A selected recording did not decode.');
  playing=true;labels();status('Engine running. Adjust RPM and throttle, or run the race pull.');
 }catch(e){if(token===request){audio.engineOff();status('Could not start: '+e.message);}}
 finally{$('start').disabled=false;}
}
$('start').addEventListener('click',start);$('stop').addEventListener('click',stop);
$('car').addEventListener('change',select);
$('version').addEventListener('change',()=>{const was=playing;select();if(was)start();});
for(const id of ['rpm','load','slip','volume'])$(id).addEventListener('input',()=>{sweep=null;labels();});
$('source').addEventListener('play',()=>{request++;playing=false;sweep=null;audio.engineOff();status('Playing source excerpt.');});
$('shift').addEventListener('click',()=>{if(!playing)return;audio.shift();$('rpm').value=Math.max(Number($('rpm').min),$('rpm').value*.72);labels();});
$('pop').addEventListener('click',()=>{if(playing)audio.pop();});
// the same gearbox the race uses: idle, full throttle through the gears, then lift and coast down
$('sweep').addEventListener('click',async()=>{if(!playing)await start();if(playing)sweep={t:0,speed:0,gears:new Gearbox(85,prof().redline)};});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
function frame(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 if(playing){
  let speed=Number($('slip').value)>0?30:0;
  if(sweep){
   sweep.t+=dt;const thr=sweep.t>1.5&&sweep.t<13?1:0;
   sweep.speed=thr?sweep.speed+(85-sweep.speed)*dt/6:sweep.speed*Math.exp(-dt/9);
   if(sweep.gears.update(dt,sweep.speed,thr)==='up'&&thr>.8)audio.shift();
   if(sweep.t>13&&sweep.t<14.2&&Math.random()<dt*5)audio.pop();
   $('rpm').value=sweep.gears.rpm;$('load').value=thr;speed=sweep.speed;labels();
   if(sweep.t>19)sweep=null;
  }
  audio.engineUpdate(Number($('rpm').value),Number($('load').value),1,speed,Number($('slip').value));
 }
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
try{
 const load=async file=>{const r=await fetch('/assets/audio/'+file);if(!r.ok)throw Error('Recording bank unavailable: '+file);return r.json();};
 [banks.measured,banks.current]=await Promise.all([load('engine-bank.json'),load('recorded-engine-bank.json')]);
 const q=new URLSearchParams(location.search);
 $('car').replaceChildren(...Object.entries(banks.measured.profiles).map(([key,p])=>{const o=document.createElement('option');o.value=key;o.textContent=banks.current.profiles[key]?.name?.split(' (')[0]??p.name;return o;}));
 if(banks.measured.profiles[q.get('car')])$('car').value=q.get('car');
 if(q.get('version')==='current')$('version').value='current';
 $('car').disabled=false;$('version').disabled=false;$('start').disabled=false;select();status('Ready. Select a car and start the engine.');
}catch(e){status(e.message);}
