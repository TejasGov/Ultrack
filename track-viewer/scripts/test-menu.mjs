import {createServer} from 'vite';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerInput} from '../src/physics/driver.js';
class Element extends EventTarget {
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.style={setProperty:(k,v)=>this.style[k]=v};this.className='';this.dataset={};this.offsetParent={};
 this.classList={toggle:(k,on)=>{let s=new Set(this.className.split(' '));on??=!s.has(k);on?s.add(k):s.delete(k);this.className=[...s].join(' ');return on;},contains:(k)=>this.className.split(' ').includes(k)};}
 append(...items){for(let x of items){if(typeof x!=='object')x=globalThis.document.createTextNode(String(x));this.children.push(x);x.parentNode=this;}}   // strings become text nodes, as in the DOMappendChild(x){this.append(x);}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
 get textContent(){return this.text??this.children.map(c=>c.textContent).join('');}
 set textContent(value){this.text=String(value);this.children=[];}
 querySelectorAll(selector){const found=[];for(const c of this.children){if(selector==='[data-nav]'&&Object.hasOwn(c.attrs,'data-nav'))found.push(c);found.push(...c.querySelectorAll(selector));}return found;}
 scrollIntoView(){}click(){this.dispatchEvent(new Event('click'));}getBoundingClientRect(){return this.rect??{x:0,y:0,width:100,height:100};}
}
globalThis.Node=Element;globalThis.document={createElement:t=>new Element(t),createElementNS:(ns,t)=>new Element(t),createTextNode:t=>{const n=new Element('text');n.textContent=t;return n;}};   // NS: icons.js's <svg><use>
globalThis.addEventListener=()=>{};
const server=await createServer({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const UI=await server.ssrLoadModule('/src/game/ui.js'),routes=[],busy=[],game={audio:{play(){}},show:(...args)=>routes.push(args),setBusy:(msg)=>busy.push(msg),screens:{careerStart:{open:()=>routes.push(['career'])}}};
 const nav=new UI.Nav(game);UI.setNav(nav);const menu=UI.MenuScreen(game);game.screen=menu;menu.onShow();
 const buttons=menu.el.querySelectorAll('[data-nav]');
 assert.equal(buttons.length,9);assert.ok(menu.el.textContent.includes('YOUR CAR'));
 for(const b of buttons){if(b.dataset.id)assert.match(b.children[0].src??b.children[0].attrs?.src??'',/\/assets\/ui\/stills\/(tracks|tiles)\//,`tile ${b.dataset.id} has its still`);}
 for(const b of buttons)b.click();
 assert.ok(routes.some(([name,id])=>name==='setup'&&id==='race'));assert.ok(routes.some(([name])=>name==='garage'));assert.ok(routes.some(([name])=>name==='credits'));assert.ok(routes.some(([name])=>name==='records'));
 assert.ok(routes.some(([name])=>name==='career')&&!busy.some(m=>/Career Mode/.test(m)),'the Career Mode tile opens the career');
 buttons.forEach((b,i)=>b.rect={x:(i%3)*110,y:Math.floor(i/3)*110,width:100,height:100});
 nav.reset(0);nav.moveSpatial(1,0);assert.equal(nav.i,1);nav.moveSpatial(0,1);assert.equal(nav.i,4);
 // ---- career screens: every step and tab renders real elements (a nested list once printed "[object HTMLDivElement]")
 {const CU=await server.ssrLoadModule('/src/game/career-ui.js'),C=await server.ssrLoadModule('/src/game/career/career.js');
  const g={...game,career:null,screens:{},setBusy(){},leaveCareer(){},careerSession(){}},start=CU.CareerStartScreen(g),hub=CU.CareerHubScreen(g);g.screen=start;
  const ok=(scr,what)=>{const t=scr.el.textContent;assert.ok(!t.includes('[object')&&!t.includes('undefined')&&!t.includes('NaN'),what+': '+t.slice(0,200));};
  start.onShow();ok(start,'create');g.career=C.newCareer({name:'Ada Test',seed:3,now:'x'});start.onShow();ok(start,'shootout');
  C.finishShootout(g.career,null);start.onShow();ok(start,'offers');assert.ok(start.el.querySelectorAll('[data-nav]').length>=4,'three offer cards and Sign');
  C.acceptOffer(g.career,g.career.pending.offers[0].id,{india:null,drylake:['day','dusk'],marina:null,shajawa:['day','dusk'],tokyo:null});g.screen=hub;
  for(let i=0;i<5;i++){hub.onShow();ok(hub,'hub tab '+i);hub.onKeyTab(1);}
  assert.ok(hub.el.textContent.includes('Race length')&&hub.el.textContent.includes('Sprint'),'the Paddock can change the race length');C.finishQuali(g.career,60);hub.onShow('paddock');ok(hub,'paddock with a grid');assert.ok(hub.el.textContent.includes('Improve your lap'),'qualifying can be retried before the race');assert.ok(hub.el.textContent.includes('Start the race'));
  const rep=CU.CareerReportScreen(g);g.screen=rep;
  while(g.career.clock.phase!=='review'){if(g.career.clock.phase==='paddock')C.finishQuali(g.career,60);const q=g.career.season.current.quali.grid;rep.onShow(C.finishRace(g.career,{order:q,best:Object.fromEntries(q.map((k,i)=>[k,60+i])),crashes:0,spins:0}));ok(rep,'round report');}
  g.screen=hub;hub.onShow('paddock');assert.ok(hub.el.textContent.includes('Season review'));g.screen=start;start.onShow();ok(start,'season review');assert.ok(start.el.textContent.includes('Season 1 review'));}
 // ---- the ladder's views: save slots, negotiation, W1, side events, rivals, the team package, a dropped season, a moved driver
 {const CU=await server.ssrLoadModule('/src/game/career-ui.js'),C=await server.ssrLoadModule('/src/game/career/career.js'),S=await server.ssrLoadModule('/src/game/career/save.js'),mem={};
  globalThis.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=v;}};
  const avail={india:null,drylake:['day','dusk'],marina:null,shajawa:['day','dusk'],tokyo:null},shows=[],busy=[];
  const g={...game,career:null,screens:{},setBusy:(m)=>busy.push(m),leaveCareer(){},careerSession(...a){g.sessions.push(a);},sessions:[],show:(...a)=>shows.push(a)},start=CU.CareerStartScreen(g),hub=CU.CareerHubScreen(g),rep=CU.CareerReportScreen(g);
  const ok=(scr,what)=>{const t=scr.el.textContent;assert.ok(!t.includes('[object')&&!t.includes('undefined')&&!t.includes('NaN')&&!t.includes('null'),what+': '+t.slice(0,300));return t;};
  const click=(scr,re)=>{const walk=(e)=>[e,...e.children.flatMap(walk)],b=walk(scr.el).filter(e=>Object.hasOwn(e.attrs,'data-nav')&&re.test(e.textContent)).pop();assert.ok(b,'no button '+re);b.click();};
  // slots: all empty goes straight to create; a saved career shows the picker, an empty slot creates into that slot
  g.screen=start;start.onShow();assert.ok(ok(start,'create').includes('You are 21'));
  const a=C.newCareer({name:'Slot One',seed:21,now:'x'});S.saveCareer(a,0);start.onShow();let t=ok(start,'slots');assert.ok(t.includes('Slot One')&&t.includes('Empty')&&t.includes('Slot 3'));
  click(start,/Slot 2/);assert.ok(start.el.textContent.includes('You are 21'),'an empty slot opens the create form');click(start,/Create driver/);
  assert.equal(S.activeSlot(),1,'the new career went into the slot picked');assert.deepEqual(S.listCareers().map(c=>c?.seed!==undefined),[true,true,false]);assert.equal(g.career.clock.phase,'shootout');
  // offers: the picked card has its levers; a refused demand counters, and the card signs
  C.finishShootout(g.career,null);start.onShow();t=ok(start,'offers with negotiation');assert.ok(t.includes('Negotiate with')&&t.includes('Their limit'));
  g.career.pending.offers.forEach(o=>{o.interest=0;});click(start,/Propose terms/);t=ok(start,'accepted');assert.ok(t.includes('Terms agreed'),'nothing asked is accepted');assert.ok(!t.includes('Propose terms')||t.includes('Negotiate with')===false,'an agreed card has no levers');
  C.acceptOffer(g.career,g.career.pending.offers[0].id,avail);const save=g.career;g.screen=hub;
  // garage: the team package; paddock: no side event in round 1
  hub.onShow('garage');t=ok(hub,'garage package');assert.ok(t.includes('Team package')&&t.includes('Free'));
  hub.onShow('paddock');assert.ok(!/optional/.test(ok(hub,'round 1')));
  const round=(p=4)=>{if(save.clock.phase==='paddock')C.finishQuali(save,60);const me=save.contract.car,o=save.season.current.quali.grid.filter(k=>k!==me);o.splice(p-1,0,me);return C.finishRace(save,{order:o,best:{},crashes:0,spins:0});};
  round();hub.onShow('paddock');t=ok(hub,'side event');assert.ok(/optional/.test(t)&&t.includes('Gold'));click(hub,/optional/);assert.equal(g.sessions.at(-1)[0],C.sideSpec(save).kind,'the row starts the session');
  g.sessions.at(-1)[2]({best:null,score:0});t=(hub.onShow('paddock'),ok(hub,'side result'));assert.ok(t.includes('No medal'));
  // rivals, a seat review warning and W1 in the Paddock and Profile; a moved driver shows his own name
  save.career.heat={LIN:50,MAD:90};save.contract.warning={left:1,met:1};save.season.w1={offer:{id:'w',team:'toro',seat:'B',car:'huracan',tier:'maestro',status:'junior',salary:600,signing:1200,seasons:2,w1:true,why:'They want you.'},state:'open'};
  hub.onShow('paddock');t=ok(hub,'w1 and rivals');assert.ok(t.includes('Mid-season offer')&&t.includes('Seat review')&&t.includes('Rivals')&&t.includes('Feud'));
  click(hub,/Sign for next season/);t=ok(hub,'signed w1');assert.ok(t.includes('Signed for next season')&&!t.includes('Mid-season offer'));
  hub.onShow('profile');t=ok(hub,'profile');assert.ok(t.includes('Rivals')&&t.includes('Other careers')&&t.includes('Erase this career'));
  save.world.seats[save.season.current.entries[0]]='OKA';save.world.academy.OKA={name:'Tobi Okafor',nation:'NGA'};save.world.ratings.OKA=72;
  C.finishQuali(save,60);hub.onShow('paddock');assert.ok(ok(hub,'academy on the grid').includes('OKA'));
  const r=round(1);g.screen=rep;rep.onShow(r);assert.ok(ok(rep,'report').includes('Tobi Okafor'));
  // a dropped season: the review says so, and the reserve seat cannot be haggled
  delete save.contract.next;save.contract.warning={left:0,met:0};while(save.clock.phase!=='review'){save.contract.trust=5;if(save.clock.phase==='paddock')C.finishQuali(save,999);round(8);}
  g.screen=start;start.onShow();t=ok(start,'dropped review');assert.ok(save.pending.review.dropped&&t.includes('let you go'));const ro=save.pending.offers.find(o=>o.reserve);assert.ok(ro);
  click(start,/Reserve|reserve seat at reduced/);t=ok(start,'reserve card');assert.ok(!t.includes('Negotiate with'),'a reserve seat has no levers');
  delete globalThis.localStorage;
 }
 const credits=UI.CreditsScreen(game);assert.ok(credits.el.textContent.includes('_shobh19'));assert.ok(credits.el.textContent.includes('blackcube4'));assert.ok(credits.el.textContent.includes('CC BY-NC-SA 4.0'));assert.ok(credits.el.textContent.includes('Airbus A320 Airliner')&&credits.el.textContent.includes('Kyaie'),'the Dry Lake airliner (CC BY) is credited');assert.ok(['Modular Stadium','Stadium Light','davi.pereira.souza.0001','thundermind'].every(t=>credits.el.textContent.includes(t)),'the Shajawa stands and towers (CC BY) are credited');
 const records=UI.RecordsScreen(game);records.onShow();const rosterSize=JSON.parse((await import('node:fs')).readFileSync(new URL('../../assets/teams/teams.json',import.meta.url))).teams.flatMap(t=>t.cars).length;
 const recordRows=records.el.children[2].children[1].children[1].children;   // screen > body > table panel > rows
 assert.equal(recordRows.length,rosterSize,'the records board lists the whole roster, not only cars car-lab can assemble');
 assert.ok(recordRows.every(r=>Object.hasOwn(r.attrs,'data-nav')),'every record row is a nav stop');
 assert.ok(records.el.textContent.includes('—')&&!records.el.textContent.includes('-:--.---'),'an empty record is the em dash, never -:--.---');
 // credits come from every assets/cars/*/model.json: one card per model, none named in code
 const {readdirSync,existsSync,readFileSync}=await import('node:fs'),carsDir=new URL('../../assets/cars/',import.meta.url);
 const titles=readdirSync(carsDir,{withFileTypes:true}).filter(d=>d.isDirectory()&&existsSync(new URL(d.name+'/model.json',carsDir))).map(d=>JSON.parse(readFileSync(new URL(d.name+'/model.json',carsDir))).source?.title).filter(Boolean);
 for(const t of titles)assert.ok(credits.el.textContent.includes(t),'credit for '+t);
 // ---- economy: earnings, purchase, save migration
 const E=await server.ssrLoadModule('/src/game/economy.js');
 const old={settings:{},car:'av12',paint:{},best:{},drift:{}};                          // a V2 save: no coins, no upgrades
 E.migrate(old);assert.equal(old.coins,E.START_COINS);assert.deepEqual(old.upgrades,{});
 const bad=E.migrate({coins:'x',upgrades:{av12:{engine:9,tyres:-2,brakes:'1'},junk:null}});
 assert.equal(bad.coins,E.START_COINS);assert.deepEqual(bad.upgrades.av12,{engine:3,tyres:0,brakes:1});assert.deepEqual(bad.upgrades.junk,{engine:0,tyres:0,brakes:0});
 assert.equal(E.migrate({coins:420.9}).coins,420,'an existing balance survives migration');
 assert.ok(E.costOf(1479,1)>E.costOf(770,1)&&E.costOf(770,1)>E.costOf(369,1),'prices scale with car class');
 assert.ok(E.costOf(770,2)>E.costOf(770,1)&&E.costOf(770,3)>E.costOf(770,2),'each level costs more');
 assert.ok(E.START_COINS>=E.costOf(1479,1),'a new player can buy a first level on any car');
 const p=E.migrate({});
 let r=E.buyUpgrade(p,'av12','engine',770);assert.ok(r.ok);assert.equal(p.coins,E.START_COINS-r.cost);assert.equal(p.upgrades.av12.engine,1);
 assert.equal(E.buyUpgrade(p,'av12','engine',770).reason,'coins','not enough coins is refused and changes nothing');assert.equal(p.upgrades.av12.engine,1);
 E.earn(p,100000);for(let i=0;i<5;i++)E.buyUpgrade(p,'av12','engine',770);
 assert.equal(p.upgrades.av12.engine,3);assert.equal(E.buyUpgrade(p,'av12','engine',770).reason,'maxed');
 assert.equal(E.buyUpgrade(p,'av12','turbo',770).reason,'unknown');
 const win=E.rewardFor({mode:'race',pos:1,cars:7,laps:3,fastest:true,pb:true}),last=E.rewardFor({mode:'race',pos:7,cars:7,laps:3});
 assert.ok(win.total>last.total*3,'winning pays far more than finishing last');assert.ok(last.total>0);
 assert.equal(win.total,win.lines.reduce((s,l)=>s+l[1],0));
 assert.ok(E.rewardFor({mode:'race',pos:3,cars:7,laps:1}).total<E.rewardFor({mode:'race',pos:3,cars:7,laps:3}).total,'a 1-lap sprint pays less');
 assert.ok(E.rewardFor({mode:'trial',validLaps:1,pb:true}).total>E.rewardFor({mode:'trial',validLaps:1}).total);
 assert.ok(E.rewardFor({mode:'drift',score:20000,record:true}).total>E.rewardFor({mode:'drift',score:2000}).total);
 assert.equal(E.rewardFor({mode:'free'}).total,0);
 // pacing: a podium race buys a first level within ~2 races, and maxing a mid-class car takes many
 const lvl1=E.costOf(770,1),podium=E.rewardFor({mode:'race',pos:3,cars:7,laps:3}).total;
 assert.ok(lvl1/podium<=2,'a level-1 upgrade takes one or two races');
 const maxCost=3*[1,2,3].reduce((s,l)=>s+E.costOf(770,l),0);assert.ok(maxCost/podium>=10,'maxing a car takes many races ('+Math.round(maxCost/podium)+')');
 const S=await server.ssrLoadModule('/src/game/store.js');
 assert.equal(S.store.coins,E.START_COINS,'a fresh profile starts with the starting balance');
 const b4=S.store.coins;assert.ok(S.store.buy('furari-488','tyres',720).ok);assert.ok(S.store.coins<b4);assert.equal(S.store.levels('furari-488').tyres,1);assert.equal(S.store.levels('furari-488').engine,0);
 // car info: names cover every roster key and facts exist for all of them (from specs.json or the handling fallback)
 const CI=await server.ssrLoadModule('/src/game/carinfo.js');
 for(const k of CI.ROSTER){assert.ok(CI.carName(k)&&CI.carName(k)!==k+'!','name for '+k);const f=CI.factsOf(k);assert.ok(Number.isFinite(f.powerHp)||f.estimated,'facts for '+k);}
 (await server.ssrLoadModule('/src/game/ev.js')).EV.add('ev-test');assert.equal(CI.factsOf('ev-test').powertrain,'EV');assert.equal(CI.factsOf('av12').powertrain,'ICE');
 const gain=CI.gainOf('av12',{engine:3,tyres:3,brakes:3},{engine:0,tyres:0,brakes:0});
 assert.ok(gain.top>1&&gain.acc>1&&gain.grip>1,'upgrades make the car measurably faster, grippier and quicker off the line');
 // the physics side of the contract: applying levels measurably changes handling(key), and AI cars stay at level 0
 const PH=await server.ssrLoadModule('/src/physics/handling.js');
 if(PH.setUpgrades){
  PH.setUpgrades('av12',{engine:0,tyres:0,brakes:0});const h0=PH.handling('av12');
  CI.applyUpgrades(k=>({engine:3,tyres:3,brakes:3}),'av12');const h3=PH.handling('av12'),ai=PH.handling('mp1x');
  assert.ok(h3.power>h0.power*1.1&&h3.grip>h0.grip*1.05&&h3.brakeK>h0.brakeK*1.1,'level 3 raises power, grip and brake torque');
  assert.deepEqual(ai.upgrades,{engine:0,tyres:0,brakes:0},'AI cars are never upgraded');
  CI.applyUpgrades(()=>({engine:0,tyres:0,brakes:0}));
 }
 console.log('Economy: migration, prices by class, purchase rules, earnings by mode, pacing and upgrade gains hold.');
 const {Field,KEYS}=await server.ssrLoadModule('/src/cars.js'),field=new Field(new THREE.Scene());
 field.input=new PlayerInput({target:new EventTarget(),doc:new EventTarget(),pads:()=>[]});
 field.all=KEYS.map(key=>({key,root:new THREE.Group(),beams:[],wheels:[{pivot:new THREE.Group(),spin:new THREE.Group()}]}));field.hero=field.all[0];
 for(let i=0;i<12;i++){
  field.input.keys.add('KeyA');field.input.read(.3);field.all.forEach(c=>{c.wheels[0].pivot.rotation.y=.4;c.wheels[0].spin.rotation.z=2.5;});
  field.configure({hero:KEYS[i],racers:KEYS});assert.equal(field.input.read(.1).steer,0);
  assert.ok(field.all.every(c=>c.wheels[0].pivot.rotation.y===0&&c.wheels[0].spin.rotation.z===0),'a new session starts every car with its wheels square and unturned');
 }
 const raceKeys=KEYS.slice(0,7);
 field.configure({hero:raceKeys[0],racers:raceKeys});
 assert.equal(field.cars.length,7);assert.equal(field.parked.length,0);
 for(const c of field.all){
  assert.equal(c.root.parent===field.scene,raceKeys.includes(c.key),'Only race entrants belong to the world scene');
  assert.equal(c.root.visible,raceKeys.includes(c.key));
 }
 const cacheSize=field.all.length,garageKey=KEYS.at(-1);
 field.configure({hero:garageKey,racers:[garageKey]});
 assert.equal(field.all.length,cacheSize,'Inactive cars remain reusable by the garage');
 assert.equal(field.cars.length,1);assert.equal(field.hero.root.parent,field.scene);
 const updated=[];
 for(const c of field.all){
  c.band=2;c.cast=false;
  c.materials=Object.fromEntries(['taillight','brakeLight','headlight','projector','highProjector','reverseLight'].map(k=>[k,{emissiveIntensity:1}]));
  c.lamps={update:()=>updated.push(c.key)};
 }
 field.captureEvery=0;field.update(0,{position:new THREE.Vector3(100,100,100)},null,{});
 assert.deepEqual(updated,[garageKey],'Frame updates do not visit cached non-participants');
 field.configure({hero:raceKeys[0],racers:raceKeys});assert.equal(field.cars.length,7);
 assert(field.cars.every(c=>c.root.parent===field.scene&&c.root.visible),'Returning to a race reattaches all entrants');
 field.input.dispose();
 const loads=[],failures=new Set();
 const lazy=new Field(new THREE.Scene(),{loadCar:async(loader,key)=>{
  loads.push(key);if(key===KEYS[2]&&!failures.has(key)){failures.add(key);throw Error('Transient fixture failure');}
  return {key,root:new THREE.Group(),beams:[],wheels:[],lod:{userData:{loadFar:async()=>{}}}};
 }});
 await lazy.load({},[KEYS[0]]);assert.deepEqual(loads,[KEYS[0]],'Startup must not assemble the other eleven cars.');
 await Promise.all([lazy.ensure([KEYS[1],KEYS[1]]),lazy.ensure([KEYS[1]])]);
 assert.equal(loads.filter(k=>k===KEYS[1]).length,1,'Concurrent garage/race requests must share one load.');
 await assert.rejects(lazy.ensure([KEYS[2]]));await lazy.ensure([KEYS[2]]);
 assert.equal(lazy.all.length,3,'Failed car loads must be retryable without duplicate entries.');lazy.cubeRT.dispose();
 assert(lazy.all.slice(1).every(c=>c.root.parent===null&&!c.root.visible),'New cache-only cars never enter the world');
 const defaultLoads=[],defaultField=new Field(new THREE.Scene(),{loadCar:async(loader,key)=>{
  defaultLoads.push(key);return {key,root:new THREE.Group(),beams:[],lod:{userData:{loadFar:async()=>{}}}};
 }});
 await defaultField.load({});const teamCount=JSON.parse((await import('node:fs')).readFileSync(new URL('../../assets/teams/teams.json',import.meta.url))).teams.length;assert.equal(defaultLoads.length,teamCount,'The developer viewer loads one participant per team');
 assert.equal(defaultField.parked.length,0);defaultField.cubeRT.dispose();
 let booted=0;UI.TitleScreen({loaded:false,boot(){booted++;}}).el.dispatchEvent(new Event('pointerdown'));
 assert.equal(booted,1,'The menu must open while the circuit is still loading.');
 const {Game}=await server.ssrLoadModule('/src/game/game.js');let paused=0;
 Game.prototype.key.call({screenName:null,session:{},pause(){paused++;}},{defaultPrevented:true,code:'Escape'});
 assert.equal(paused,0,'Escape consumed by the pause menu must not immediately pause again.');
 console.log('Menu smoke: all nine tiles route, spatial navigation works, the credits list every model.json and the records list the whole roster.');
 console.log('Lifecycle regression: twelve real Field.configure swaps clear steering; handled Escape does not re-pause.');
 console.log('Loading regression: one initial car, shared requests, failed-load retry, and menu before venue readiness.');
 console.log('Pit cars: no inactive roots or updates in the world, cached garage choices reattach, default viewer loads one entrant per team.');
}finally{await server.close();}
