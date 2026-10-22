import {readFileSync,statSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),dist=new URL('track-viewer/dist/',root);
const manifest=JSON.parse(readFileSync(new URL('.vite/manifest.json',dist))),entry=manifest['index.html'];
assert.ok(entry.dynamicImports.some(k=>/rapier/.test(k)),'Physics must remain outside the static entry graph.');
const teams=JSON.parse(readFileSync(new URL('assets/teams/teams.json',root))),variants=JSON.parse(readFileSync(new URL('assets/cars/texture-variants.json',root)));
const keys=teams.teams.flatMap(t=>t.cars.map(c=>c.key)),fileFor=(key,lod)=>variants[key]?.['lod'+lod]??'body_lod'+lod+'.glb';
const bytes=(key,lod)=>statSync(new URL('assets/cars/'+key+'/'+fileFor(key,lod),root)).size;
const staticEntries=new Set();
function visit(key){if(staticEntries.has(key))return;staticEntries.add(key);for(const dep of manifest[key].imports??[])visit(dep);}
visit('index.html');
const report={measuredOn:'2026-10-20',kind:'production-asset-budget-not-browser-timing',
 initialJavaScriptBytes:[...staticEntries].reduce((sum,key)=>sum+statSync(new URL(manifest[key].file,dist)).size,0),previousInitialJavaScriptBytes:7059100,
 deferredPhysicsBytes:entry.dynamicImports.reduce((sum,key)=>sum+statSync(new URL(manifest[key].file,dist)).size,0),
 initialCarsBefore:12,initialCarsAfter:1,
 previousEagerCarGLBBytes:keys.reduce((sum,key)=>sum+bytes(key,0)+bytes(key,1),0),
 currentLOD0Bytes:Object.fromEntries(keys.map(key=>[key,bytes(key,0)])),
 uiLogoBytes:statSync(new URL('assets/brand/ultrack_logo_alpha.webp',root)).size,
 note:'Each selected car is loaded on demand; far LOD, rivals and spectators are deferred. Full browser/network/parse/GPU latency is not measured here.'};
writeFileSync(new URL('assets/startup-budget.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
