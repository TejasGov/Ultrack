import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from '../car-lab/node_modules/vite/dist/node/index.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../car-lab');
const server=await createServer({root,configFile:path.join(root,'vite.config.js'),server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try{
 const {VEHICLES,vehicleKey}=await server.ssrLoadModule('/src/vehicle/profiles.js');
 const files=fs.readdirSync(path.join(root,'src/vehicle/profiles')).filter(f=>f.endsWith('.json'));
 const expected=files.map(f=>JSON.parse(fs.readFileSync(path.join(root,'src/vehicle/profiles',f),'utf8')).id).sort();
 const actual=Object.values(VEHICLES).map(p=>p.id).sort();
 assert.deepEqual(actual,expected,'A vehicle profile is missing from the assembly selector.');
 assert.equal(vehicleKey('furari-488'),'furari-488');
 assert.equal(new Set(actual).size,actual.length);
 console.log(JSON.stringify({selectorEntries:actual.length,allProfilesRegistered:true,furariSelectable:true}));
}finally{await server.close();}
