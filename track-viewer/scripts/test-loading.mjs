import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AssetQueue} from '../src/asset-loading.js';
import {PhysicsWorld,RAPIER} from '../src/physics/world.js';
test('physics is imported and initialized only when a world is requested',async()=>{
 assert.equal(RAPIER,undefined);const world=await PhysicsWorld.flat();assert.ok(RAPIER&&world.world);world.dispose();
});
test('asset jobs stay within the decoder limit, including after failure',async()=>{
 const queue=new AssetQueue(2);let active=0,peak=0;
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>queue.run(async()=>{
  active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;if(i===3)throw Error('Expected decode failure');return i;
 })));
 assert.equal(peak,2);assert.equal(results.filter(r=>r.status==='fulfilled').length,7);assert.equal(active,0);
});
test('Ferrari uses red Saetta; every car/number occurs once',()=>{
 const {teams}=JSON.parse(readFileSync(new URL('../../assets/teams/teams.json',import.meta.url)));
 const teamFor=key=>teams.find(t=>t.cars.some(c=>c.key===key));
 assert.ok(!teamFor('tesla1')&&!teamFor('nuvolari')&&!teams.some(t=>t.id==='kalt'),'the electric team is gone');
 assert.equal(teamFor('furari-488').id,'saetta');assert.equal(teamFor('furari-488').colors.primary,'#c8102e');
 assert.ok(teams.every(t=>t.cars.length===2));assert.equal(new Set(teams.flatMap(t=>t.cars.map(c=>c.key))).size,teams.length*2);
 assert.equal(new Set(teams.flatMap(t=>t.cars.map(c=>c.number))).size,teams.length*2);
});
