import assert from 'node:assert/strict';
import { statSync,readFileSync } from 'node:fs';
import { createServer } from 'vite';
class Element extends EventTarget {
  constructor(){super();this.children=[];this.style={setProperty(){}};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  append(...nodes){this.children.push(...nodes);for(const node of nodes)node.parent=this;}
  setAttribute(){} focus(){} remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
}
const listeners=new Map();
globalThis.addEventListener=(key,handler)=>listeners.set(key,handler);
globalThis.removeEventListener=(key,handler)=>{if(listeners.get(key)===handler)listeners.delete(key);};
globalThis.requestAnimationFrame=fn=>setImmediate(fn);
globalThis.document={createElement:()=>new Element(),activeElement:null};
const requests=[];globalThis.Image=class extends Element{set src(value){requests.push(value);}};
const server=await createServer({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),configFile:false,server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const {RaceLoading,LOADING_SLIDES,LOAD_STAGES}=await server.ssrLoadModule('/src/game/race-loading.js');
  const root=new Element(),screen=new RaceLoading(root);
  assert.equal(requests.length,0);
  let cancelled=0;await screen.open({onCancel:()=>{cancelled++;screen.close();}});
  assert(screen.active);assert(listeners.has('keydown'));assert.equal(root.children.length,1);
  for(const name of LOAD_STAGES)screen.complete(name);
  assert(screen.bar.children.every(part=>part.classes.has('done')));
  assert.equal(screen.detail.textContent,'Ready for the grid');
  listeners.get('keydown')({code:'Escape',preventDefault(){}});
  assert.equal(cancelled,1);assert.equal(root.children.length,0);assert.equal(listeners.size,0);
  await screen.open({reduceMotion:true});assert(screen.el.className.includes('still'));
  screen.close();screen.complete('Grid');screen.close();assert.equal(root.children.length,0);
  const images=new Set(LOADING_SLIDES.map(slide=>slide.image));let bytes=0;
  for(const image of images)bytes+=statSync(new URL(`../public/assets/loading/${image}`,import.meta.url)).size;
  assert(bytes<1024*1024,'Entire art set stays below 1 MB');
  assert.equal(images.size,3);assert.equal(LOADING_SLIDES.length,5);
  const css=readFileSync(new URL('../src/game/race-loading.css',import.meta.url),'utf8');
  assert(css.includes('prefers-reduced-motion'));
  console.log('PASS: five slides, three local assets under 1 MB, real stage completion, Escape, cleanup, repeated opens and reduced motion.');
}finally{await server.close();}
