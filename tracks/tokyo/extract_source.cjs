// Parse the authored data as JavaScript, without executing the HTML application.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const file = path.join(__dirname, 'source/tokyo_street_circuit_2d_map.html');
const html = fs.readFileSync(file, 'utf8');
const literal = html.match(/const HIRAGANA_TO_CIRCUIT = ([\s\S]*?);\s*let trackSpline/)[1];
const data = vm.runInNewContext('(' + literal + ')', Object.create(null), {timeout: 1000});
data.skyline = vm.runInNewContext('(' + html.match(/const skylineTowers = (\[[\s\S]*?\]);/)[1] + ')', Object.create(null), {timeout:1000});
data.source = {file:'source/tokyo_street_circuit_2d_map.html', width:1480,height:940, trackGraphicWidth:56};
fs.writeFileSync(path.join(__dirname,'source/map.json'), JSON.stringify(data,null,2));
console.log('Extracted', data.waypoints.length, 'waypoints,', data.landmarks.length, 'landmarks.');
