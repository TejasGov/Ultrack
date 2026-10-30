import assert from 'node:assert/strict';
import { statSync,readFileSync } from 'node:fs';
import { createServer } from 'vite';
class Element extends EventTarget {
  constructor(){super();this.children=[];this.dataset={};this.props={};this.style={setProperty:(k,v)=>{this.props[k]=v;}};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  append(...nodes){for(const node of nodes)if(typeof node==='object'){this.children.push(node);node.parent=this;}else this.text=(this.text??'')+node;}
  setAttribute(){} focus(){} remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
  get all(){return this.children.flatMap(c=>[c,...(c.all??[])]);}
}
const listeners=new Map();
globalThis.addEventListener=(key,handler)=>listeners.set(key,handler);
globalThis.removeEventListener=(key,handler)=>{if(listeners.get(key)===handler)listeners.delete(key);};
globalThis.requestAnimationFrame=fn=>setImmediate(fn);
globalThis.document={createElement:()=>new Element(),createElementNS:()=>new Element(),activeElement:null};
const requests=[];globalThis.Image=class extends Element{set src(value){requests.push(value);}};
const server=await createServer({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const {RaceLoading,LOADING_SLIDES,LOAD_STAGES,fieldLine}=await server.ssrLoadModule('/src/game/race-loading.js');
  const {TRACKS}=await server.ssrLoadModule('/src/tracks.js');
  const root=new Element(),screen=new RaceLoading(root);
  assert.equal(requests.length,0);
  let cancelled=0;await screen.open({track:'Tokyo Hiragana Circuit',onCancel:()=>{cancelled++;screen.close();}});
  assert(screen.active);assert(listeners.has('keydown'));assert.equal(root.children.length,1);
  assert(requests.includes('/assets/ui/stills/tracks/tokyo.webp'),'the backdrop is the named circuit\'s still');
  const texts=screen.el.all.map(e=>e.text??'').join('|');
  assert(texts.includes('Tokyo Hiragana Circuit'),'the kicker names the circuit');
  assert.equal(screen.pct.text??screen.pct.textContent,'0 %');
  for(const name of LOAD_STAGES)screen.complete(name);
  assert.equal(screen.bar.props['--p'],1);assert.equal(screen.pct.textContent,'100 %');
  assert.equal(screen.detail.textContent,'Ready for the grid');
  listeners.get('keydown')({code:'Escape',preventDefault(){}});
  assert.equal(cancelled,1);assert.equal(root.children.length,0);assert.equal(listeners.size,0);
  await screen.open({reduceMotion:true});assert(screen.el.className.includes('still'));
  screen.close();screen.complete('Grid');screen.close();assert.equal(root.children.length,0);
  // one slide per circuit, each the circuit's own still, the set under 1 MB; the race names the true field (one car per team)
  assert.deepEqual(LOADING_SLIDES.map(s=>s.track).sort(),Object.keys(TRACKS).sort());
  let bytes=0;for(const s of LOADING_SLIDES)bytes+=statSync(new URL(`../public${s.image}`,import.meta.url)).size;
  assert(bytes<1024*1024,'Entire art set stays below 1 MB');
  const teams=JSON.parse(readFileSync(new URL('../../assets/teams/teams.json',import.meta.url),'utf8')).teams.length;
  assert.equal(fieldLine('race'),`${['No','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'][teams]} teams. One grid.`);
  const css=readFileSync(new URL('../src/game/race-loading.css',import.meta.url),'utf8');
  assert(css.includes('prefers-reduced-motion'));assert(!/Arial|#e8be74|pulse/i.test(css),'no Arial, no gold, no pulse');
  console.log(`PASS: ${LOADING_SLIDES.length} circuit stills under 1 MB (${Math.round(bytes/1024)} KB), per-circuit copy, the true field, real stage completion with a percentage, Escape, cleanup, repeated opens and reduced motion.`);
}finally{await server.close();}
