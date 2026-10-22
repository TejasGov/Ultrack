// node fetch_takes.js <sessions.json> <outdir> <status.json...>
// Saves each completed take of a creative_get_flow_run_status dump as <outdir>/<line id>.mp3, using sessions.json
// ({sessions: {session_id: line id}}). The session id is read from the media URL path (content_generation/<session>/...).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [map, out, ...dumps] = process.argv.slice(2);
const sessions = JSON.parse(fs.readFileSync(map, 'utf8')).sessions;
fs.mkdirSync(out, { recursive: true });
let saved = 0;
for (const d of dumps) {
  const j = JSON.parse(fs.readFileSync(d, 'utf8'));
  for (const m of j.media || []) {
    const sid = /content_generation\/([^/]+)\//.exec(m.url)?.[1];
    const id = sessions[sid];
    if (!id) { console.log('unmapped session', sid); continue; }
    const f = path.join(out, id + '.mp3');
    if (fs.existsSync(f)) continue;
    execFileSync('curl', ['-sSfL', '-o', f, m.url]);
    saved++;
  }
}
const missing = Object.values(sessions).filter((id) => !fs.existsSync(path.join(out, id + '.mp3')));
console.log(`saved ${saved}; missing ${missing.length}${missing.length ? ': ' + missing.join(' ') : ''}`);
