import {createServer} from 'vite';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PlayerInput} from '../src/physics/driver.js';
class Element extends EventTarget {
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.style={setProperty:(k,v)=>this.style[k]=v};this.className='';this.dataset={};this.offsetParent={};
 this.classList={add:(k)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),k])].join(' ');},remove:(k)=>{this.className=this.className.split(' ').filter(x=>x!==k).join(' ');},toggle:(k,on)=>{let s=new Set(this.className.split(' '));on??=!s.has(k);on?s.add(k):s.delete(k);this.className=[...s].join(' ');return on;},contains:(k)=>this.className.split(' ').includes(k)};}
 append(...items){for(let x of items){if(typeof x!=='object')x=globalThis.document.createTextNode(String(x));this.children.push(x);x.parentNode=this;}}   // strings become text nodes, as in the DOMappendChild(x){this.append(x);}
 replaceChildren(...items){this.children=[];this.append(...items);}
 insertBefore(x,ref){const i=this.children.indexOf(ref);this.children.splice(i,0,x);x.parentNode=this;}
 get lastChild(){return this.children.at(-1);}
 remove(){const c=this.parentNode?.children;if(c)c.splice(c.indexOf(this),1);}
 removeAttribute(k){delete this.attrs[k];}hasAttribute(k){return Object.hasOwn(this.attrs,k);}
 closest(sel){const c=sel.startsWith('.')?sel.slice(1):null;return c&&this.className.split(' ').includes(c)?this:this.parentNode?.closest?.(sel)??null;}
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
 // ---- career screens: every step and tab renders real elements (a nested list once printed "[object HTMLDivElement]"), each with its one job
 {const CU=await server.ssrLoadModule('/src/game/career-ui.js'),C=await server.ssrLoadModule('/src/game/career/career.js'),S=await server.ssrLoadModule('/src/game/career/save.js'),mem={};
  globalThis.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=v;}};
  const avail={india:null,drylake:['day','dusk'],infinia:['day','dusk'],marina:null,shajawa:['day','dusk'],tokyo:null,pilbara:['day','dusk'],terminal:['day','dusk']},shows=[],busy=[];
  const g={...game,career:null,screens:{},setBusy:(m)=>busy.push(m),leaveCareer(){},careerSession(...a){g.sessions.push(a);},sessions:[],show:(...a)=>shows.push(a)},start=CU.CareerStartScreen(g),hub=CU.CareerHubScreen(g),rep=CU.CareerReportScreen(g),deal=CU.CareerDealScreen(g);
  const ok=(scr,what)=>{const t=scr.el.textContent;assert.ok(!t.includes('[object')&&!t.includes('undefined')&&!t.includes('NaN')&&!t.includes('null'),what+': '+t.slice(0,1500));return t;};
  const click=(scr,re)=>{const walk=(e)=>[e,...e.children.flatMap(walk)],b=walk(scr.el).filter(e=>Object.hasOwn(e.attrs,'data-nav')&&re.test(e.textContent)).pop();assert.ok(b,'no button '+re);b.click();};
  const prior=game.screen,show=(scr,arg)=>{g.screen=scr;game.screen=scr;scr.onShow(arg);};const getNavItem=()=>{const n=UI.getNav();return n.items()[n.i];};
  // the landing: always first; with no saves New career creates, Delete career and Manager career are greyed; an empty slot creates into that slot, and Esc goes back to it
  show(start);{const L=ok(start,'landing');assert.ok(L.includes('New career')&&L.includes('Delete career')&&L.includes('Manager career')&&L.includes('Coming soon')&&L.includes('No careers saved yet'));const hasNav=(re)=>{const walk=(e)=>[e,...e.children.flatMap(walk)];return walk(start.el).some(e=>Object.hasOwn(e.attrs,'data-nav')&&re.test(e.textContent));};assert.ok(!hasNav(/Manager career/)&&!hasNav(/Delete career/),'greyed tiles are no nav stops');click(start,/New career/);assert.ok(start.el.textContent.includes('You are 21'),'New career opens the form');start.back();assert.ok(start.el.textContent.includes('Manager career'),'Esc from the form goes back to the landing');}
  const a=C.newCareer({name:'Slot One',seed:21,now:'x'});S.saveCareer(a,0);start.onShow();let t=ok(start,'slots');assert.ok(t.includes('Slot One')&&t.includes('Empty')&&t.includes('Slot 3'));
  click(start,/Slot 2/);assert.ok(start.el.textContent.includes('You are 21'),'an empty slot opens the create form');start.back();assert.ok(start.el.textContent.includes('Slot One'),'Esc from the form goes back to the slots');
  // delete: pick a save, a modal asks with Cancel first, Cancel and Esc keep it, Delete erases only that slot
  {const b=C.newCareer({name:'Slot Three',seed:23,now:'x'});S.saveCareer(b,2);start.onShow();click(start,/Delete career/);assert.ok(ok(start,'delete').includes('Delete a career'));click(start,/Slot Three/);assert.ok(start.modal,'it asks first');start.back();assert.ok(!start.modal&&S.listCareers()[2],'Esc keeps the save');click(start,/Slot Three/);click({el:start.modal},/Cancel/);assert.ok(!start.modal&&S.listCareers()[2],'Cancel keeps the save');click(start,/Slot Three/);click({el:start.modal},/Delete career/);assert.ok(S.listCareers()[0]&&!S.listCareers()[2],'only that slot is erased');assert.ok(!start.modal&&start.el.textContent.includes('Manager career'),'back on the landing');
   S.saveCareer(a,0);S.saveCareer(C.newCareer({name:'Two',seed:24,now:'x'}),1);S.saveCareer(C.newCareer({name:'Three',seed:25,now:'x'}),2);start.onShow();assert.ok(start.el.textContent.includes('slots are full'),'three saves: New career says why not');S.saveCareer(null,1);S.saveCareer(null,2);S.loadCareer(0);start.onShow();}
  // a damaged save and all three locked: the landing still renders, and either can be deleted, so it is never a dead end
  {const K='ultrack.career.v1',keep=mem[K],d=JSON.parse(keep);d.slots[2]={schema:C.SCHEMA};mem[K]=JSON.stringify(d);start.onShow();const L=ok(start,'damaged');assert.ok(L.includes('Damaged')&&L.includes('Slot One'));click(start,/Delete career/);click(start,/Damaged/);assert.ok(start.modal);click({el:start.modal},/Delete career/);assert.equal(S.listCareers()[2],null);
   mem[K]=JSON.stringify({active:0,slots:[{schema:99},{schema:99},{schema:99}]});start.onShow();assert.ok(!start.el.textContent.includes('No careers saved yet'));click(start,/Delete career/);click(start,/Slot 1/);click({el:start.modal},/Delete career/);assert.equal(S.listCareers()[0],null,'a locked save can be deleted when the player says so');
   mem[K]=keep;S.loadCareer(0);start.onShow();}
  click(start,/Slot 2/);click(start,/Create driver/);
  assert.equal(S.activeSlot(),1,'the new career went into the slot picked');assert.deepEqual(S.listCareers().map(c=>c?.seed!==undefined),[true,true,false]);assert.equal(g.career.clock.phase,'shootout');assert.ok(ok(start,'shootout').includes('Open Shootout'));
  // the first offers are cards; a card opens the talks on its own screen
  C.finishShootout(g.career,null);start.onShow();t=ok(start,'first offers');assert.ok(t.includes('Your first contract'));
  const o0=g.career.pending.offers[0];click(start,/Nissan/);assert.deepEqual(shows.at(-1),['careerDeal',{id:o0.id,home:'careerStart'}],'a card opens the deal');
  show(deal,{id:o0.id,home:'careerStart'});t=ok(deal,'deal');for(const w of ['The terms','How hard you are pushing','Their patience','The conversation','Propose','Walk away','Sign'])assert.ok(t.includes(w),w);
  assert.ok(t.includes('As offered'),'an untouched ask is as offered');
  // a hard ask is countered; the counter can be accepted; then only Sign is left
  o0.interest=0;g.career.pending.offers.splice(1);deal.onShow({id:o0.id,home:'careerStart'});o0.seasons=2;
  C.negotiate(g.career,o0.id,{salary:0.3,signing:0.5,seasons:1,status:'second'});deal.onShow({id:o0.id,home:'careerStart'});t=ok(deal,'countered');assert.ok(t.includes('Accept their counter')&&t.includes('Their counter'));
  click(deal,/Accept their counter/);t=ok(deal,'agreed');assert.ok(o0.agreed&&t.includes('Sign with')&&!t.includes('Propose'),'agreed: only signing left');assert.match(getNavItem(g).textContent,/Sign with/,'focus goes to Sign, never to Walk away');
  click(deal,/Sign with/);assert.deepEqual(shows.at(-1),['careerHub','home'],'signing goes to the hub');const save=g.career;assert.equal(save.clock.phase,'paddock');
  // every tab of the hub, in a pre-season week
  for(const tab of ['home','calendar','events','inbox','media','deals','standings','garage','driver']){show(hub,tab);ok(hub,'tab '+tab);}
  show(hub,'home');t=ok(hub,'home');for(const w of ['Week 1 of','Practice','Test day','Qualifying','Race','Sprint race','Inbox','Skip and advance'])assert.ok(t.includes(w),w);
  // the race length is a Home tile and a Driver setting; Left/Right steps it
  click(hub,/Sprint race/);assert.equal(save.rules.raceLength,'standard');click(hub,/Standard race/);click(hub,/Full race/);assert.equal(save.rules.raceLength,'sprint');
  show(hub,'driver');t=ok(hub,'driver');for(const w of ['Race length','Other careers','Erase this career','Recent ratings'])assert.ok(t.includes(w),w);
  {const len=g.career.rules.raceLength;click(hub,/Erase this career/);assert.ok(hub.el.textContent.includes('Press again'));click(hub,/Race length/);assert.ok(hub.el.textContent.includes('Erase this career'),'a redraw shows the plain label');click(hub,/Erase this career/);assert.ok(g.career&&hub.el.textContent.includes('Press again'),'and it needs two presses again');C.setRaceLength(g.career,len);show(hub,'driver');}
  // garage: the team package
  show(hub,'garage');t=ok(hub,'garage');assert.ok(t.includes('free from the team')&&t.includes('Free'));
  // a test day runs from its tile; its result stays on the calendar, and a skipped one says so
  show(hub,'home');click(hub,/Test day/);assert.equal(g.sessions.at(-1)[0],'test','the tile starts the session');g.sessions.at(-1)[2]({best:null,score:0});assert.equal(save.season.weeks[0].event.result.medal,0);
  show(hub,'home');t=ok(hub,'event done');assert.ok(t.includes('Done: No medal')&&t.includes('Advance'));
  click(hub,/Practice/);assert.equal(g.sessions.at(-1)[0],'practice');
  // Advance: into race week, whose primary is qualifying; the race is locked until then
  click(hub,/^Advance/);assert.equal(C.currentWeek(save).kind,'race');show(hub,'home');t=ok(hub,'race week');assert.ok(t.includes('Start qualifying')&&t.includes('Locked: qualify first')&&t.includes('Required'));
  click(hub,/Locked: qualify first/);assert.match(busy.at(-1),/Qualify first/);
  C.finishQuali(save,1);show(hub,'home');t=ok(hub,'grid');assert.ok(t.includes('Improve your lap')&&t.includes('Start the race')&&t.includes('The grid'),'the grid and the retry are on Home');
  click(hub,/Start the race/);assert.equal(g.sessions.at(-1)[0],'race');
  const q=()=>save.season.current.quali.grid,round=(p=4)=>{if(save.clock.phase==='paddock')C.finishQuali(save,1);const me=save.contract.car,o=q().filter(k=>k!==me);o.splice(p-1,0,me);return C.finishRace(save,{order:o,best:{},crashes:0,spins:0});};
  const r1=round();show(rep,r1);t=ok(rep,'report');for(const w of ['Round rating','Why that rating','What it paid','Objectives','Salary','Continue'])assert.ok(t.includes(w),w);
  // media bytes: the round's lead on the report and on Home, and a click opens that story on the media page (the season review has no hub to go to, so none there)
  {const lead=C.latestBytes(save)[0],re=(x)=>new RegExp(x.title.replace(/[^\w ]/g,'.'));assert.ok(lead&&t.includes(lead.title),'the report carries the press');click(rep,re(lead));assert.deepEqual(shows.at(-1),['careerHub',{story:lead.id}],'a byte on the report opens its story');
   show(hub,'home');t=ok(hub,'home bytes');assert.ok(t.includes(lead.title),'Home carries the press');const third=C.latestBytes(save)[2];assert.ok(third);click(hub,re(third));assert.ok(third.read,'a byte on Home opens its story, not the newest');assert.ok(ok(hub,'media from a byte').includes(third.body.slice(0,30)));
   show(hub,{story:lead.id});assert.ok(ok(hub,'media from the report').includes(lead.body.slice(0,30)));show(hub,'home');const ph=save.clock.phase;save.clock.phase='review';show(rep,r1);assert.ok(!rep.el.textContent.includes(lead.title),'no bytes on the season review');save.clock.phase=ph;}
  // an open week with a sponsor day; Advance warns once a sponsor is signed, then goes
  const so=save.sponsors.offers[0];show(hub,'deals');t=ok(hub,'deals');for(const w of ['On the table','Your contract','Teams','Your sponsors','Market opens week'])assert.ok(t.includes(w),w);assert.ok(t.includes(so.name),'sponsor offers are on the table');
  click(hub,new RegExp(so.name+': personal sponsor'));assert.deepEqual(shows.at(-1),['careerDeal',{id:so.id,home:'careerHub'}]);show(deal,{id:so.id,home:'careerHub'});t=ok(deal,'sponsor deal');assert.ok(t.includes('Retainer')&&t.includes('Bonus')&&t.includes('Their target'));click(deal,/Sign with/);assert.equal(save.sponsors.deals.length,1);
  while(C.currentWeek(save).kind==='race')round();while(!(C.currentWeek(save).event?.kind==='sponsor'&&!C.currentWeek(save).event.skipped)){if(C.currentWeek(save).kind==='race')round();else C.advanceWeek(save);}
  show(hub,'home');t=ok(hub,'sponsor week');assert.ok(t.includes('drift day')&&t.includes(so.name));const wkBefore=save.clock.week;click(hub,/Skip and advance/);assert.equal(save.clock.week,wkBefore,'a first press only warns');assert.ok(hub.el.textContent.includes('goodwill'));click(hub,/Skip and advance/);assert.equal(save.clock.week,wkBefore+1,'the second goes');
  // the calendar and events views say what happened
  show(hub,'calendar');t=ok(hub,'calendar');assert.ok(t.includes('Skipped')&&t.includes('Race')&&t.includes('Review'));show(hub,'events');t=ok(hub,'events');for(const w of ['Race weekends','Test days','Sponsor events','Required','Optional'])assert.ok(t.includes(w),w);
  // the inbox: a row opens with its action, reading it clears the count
  show(hub,'inbox');t=ok(hub,'inbox');assert.ok(t.includes('Inbox')&&t.includes('Round 1'));
  // the media tab: a story per real event, a picture that can always fall back, reading clears the count
  show(hub,'media');t=ok(hub,'media');assert.ok(t.includes('The press')&&/Ultrack Wire|Paddock Whispers|The Feed|The Transfer Desk/.test(t));assert.ok(g.career.media.length>0,'the first race made the papers');assert.ok(C.unreadStories(g.career)<g.career.media.length,'the open story is read');
  {const old=g.career.media.at(-1);click(hub,new RegExp(old.title.replace(/[^\w ]/g,'.')));assert.ok(old.read,'a row opens and reads its story');assert.ok(hub.el.textContent.includes(old.body.slice(0,30)));}
  {const saved=g.career.media;g.career.media=undefined;show(hub,'media');assert.ok(ok(hub,'empty press').includes('No press yet'),'an old save has no press and says so');g.career.media=saved;}
  // rivals, a seat review warning and a market offer; a moved driver shows his own name
  while(C.currentWeek(save).kind!=='market'){if(C.currentWeek(save).kind==='race')round();else C.advanceWeek(save);}
  save.career.heat={LIN:50,MAD:90};save.contract.warning={left:1,met:1};const mo={id:'w',team:'toro',seat:'B',car:'huracan',tier:'maestro',status:'junior',salary:600,signing:1200,seasons:2,w1:true,interest:0.4,why:'They want you.'};save.season.mid=[mo];
  show(hub,'home');t=ok(hub,'market week');assert.ok(t.includes('The market is open')&&t.includes('Seat review'));show(hub,'deals');t=ok(hub,'deals in the market');assert.ok(t.includes('Toro: HU')&&t.includes('Open this week')&&t.includes('Probation'),'the market week lists the offer and says why doors are shut');
  show(deal,{id:'w',home:'careerHub'});click(deal,/Sign with/);assert.equal(save.contract.next.team,'toro');assert.deepEqual(save.season.mid,[]);show(hub,'home');assert.ok(ok(hub,'signed').includes('Signed for next season'));
  show(hub,'driver');t=ok(hub,'driver rivals');assert.ok(t.includes('Rivals')&&t.includes('Feud'));
  C.advanceWeek(save);C.finishQuali(save,1);save.world.seats[save.season.current.quali.grid.find(x=>x!==save.contract.car&&x!==C.teammateCar(save))]='OKA';save.world.academy.OKA={name:'Tobi Okafor',nation:'NGA'};save.world.ratings.OKA=99;
  C.finishQuali(save,1);show(hub,'home');assert.ok(ok(hub,'academy on the grid').includes('OKA'));
  const r=round(1);show(rep,r);assert.ok(ok(rep,'report').includes('Tobi Okafor'));
  // a dropped season: the review says so, and the reserve seat cannot be haggled
  delete save.contract.next;save.contract.warning={left:0,met:0};while(save.clock.phase!=='review'){save.contract.trust=5;save.contract.warning={left:0,met:0};if(C.currentWeek(save).kind==='race')round(8);else C.advanceWeek(save);}
  show(start);t=ok(start,'dropped review');assert.ok(save.pending.review.dropped&&t.includes('let you go')&&t.includes('Next season')&&/1[0-9] drivers/.test(t));const ro=save.pending.offers.find(o=>o.reserve);assert.ok(ro);
  click(start,/reserve seat at reduced/);assert.equal(shows.at(-1)[1].id,ro.id);show(deal,{id:ro.id,home:'careerStart'});t=ok(deal,'reserve deal');assert.ok(!t.includes('Propose')&&t.includes('Sign with'),'a reserve seat has no levers');
  click(deal,/Sign with/);assert.equal(save.clock.season,2,'and signing starts the next season');show(hub,'home');ok(hub,'season 2');
  // a career from before weeks opens on the new hub, every tab, mid-season and with a market offer waiting
  const old3=C.newCareer({name:'Old Save',seed:31,now:'x'});C.finishShootout(old3,null);C.acceptOffer(old3,old3.pending.offers[0].id,avail);g.career=old3;for(let i=0;i<3;i++){C.finishQuali(old3,1);const gq=old3.season.current.quali.grid;C.finishRace(old3,{order:gq,best:{},crashes:0,spins:0});}
  old3.schema=3;delete old3.inbox;delete old3.inboxN;delete old3.sponsors;delete old3.clock.week;delete old3.season.weeks;delete old3.season.mid;delete old3.season.asked;old3.season.w1={offer:{id:'w3',team:'toro',seat:'B',car:'huracan',tier:'maestro',status:'junior',salary:600,signing:1200,seasons:2,interest:0.4,why:'They want you.'},state:'open'};C.migrate(old3);
  for(const tab of ['home','calendar','events','inbox','media','deals','standings','garage','driver']){show(hub,tab);ok(hub,'migrated '+tab);}assert.ok(hub.el.textContent.includes('Week')&&C.findOffer(old3,'w3'),'the old offer is still on the table');game.screen=prior;
  delete globalThis.localStorage;
 }
 const credits=UI.CreditsScreen(game);for(const who of ['ar.jethin','evolveduk','sunnykhude'])assert.ok(credits.el.textContent.includes(who),'Infinia CC BY model credited: '+who);assert.ok(credits.el.textContent.includes('_shobh19'));assert.ok(credits.el.textContent.includes('blackcube4'));assert.ok(credits.el.textContent.includes('CC BY-NC-SA 4.0'));assert.ok(credits.el.textContent.includes('Airbus A320 Airliner')&&credits.el.textContent.includes('Kyaie'),'the Dry Lake airliner (CC BY) is credited');assert.ok(['Modular Stadium','Stadium Light','davi.pereira.souza.0001','thundermind'].every(t=>credits.el.textContent.includes(t)),'the Shajawa stands and towers (CC BY) are credited');
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
 assert.equal(bad.coins,E.START_COINS);assert.deepEqual(bad.upgrades.av12,{engine:3,tyres:0,brakes:1,aero:0,nitro:0},'an older save reads Aero and Nitro as 0');assert.deepEqual(bad.upgrades.junk,{engine:0,tyres:0,brakes:0,aero:0,nitro:0});assert.deepEqual(E.levelsOf({upgrades:{av12:{engine:1}}},'av12'),{engine:1,tyres:0,brakes:0,aero:0,nitro:0});assert.deepEqual(E.CATS.map(c=>c[0]),['engine','tyres','brakes','aero','nitro']);
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
 assert.ok(E.buyUpgrade(p,'av12','aero',770).ok&&E.buyUpgrade(p,'av12','nitro',770).ok,'free play buys Aero and Nitro too');assert.equal(p.upgrades.av12.aero,1);assert.equal(p.upgrades.av12.nitro,1);
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
  assert.deepEqual(ai.upgrades,{engine:0,tyres:0,brakes:0,aero:0,nitro:0},'AI cars are never upgraded');
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
 let farLoads=0,openGate;const gated=new Field(new THREE.Scene(),{loadCar:async(loader,key)=>({key,root:new THREE.Group(),beams:[],wheels:[],lod:{userData:{loadFar:async()=>{farLoads++;}}}})});
 gated.farGate=new Promise(r=>openGate=r);await gated.load({},[KEYS[0]]);
 await new Promise(r=>setTimeout(r,1900));assert.equal(farLoads,0,'Distant car bodies wait for the venue (farGate) past their 1.8 s timer');
 openGate();await new Promise(r=>setTimeout(r,50));assert.equal(farLoads,1,'Distant car bodies load once the venue is in');gated.cubeRT.dispose();
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
