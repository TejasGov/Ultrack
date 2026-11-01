// Uploads public/assets to the R2 bucket behind the public build (scripts/deploy-build.mjs), with the Cloudflare CLI's login. Resumable: a file already sent, same size and
// time, is skipped (the ledger is local). Keys have no leading assets/: /assets/x redirects to <bucket>/x.   node scripts/deploy-upload-assets.mjs [bucket=ultrack-assets] [jobs=6]
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const [bucket = 'ultrack-assets', jobs = '6'] = process.argv.slice(2);
const root = join('public', 'assets'), ledger = join('node_modules', '.deploy-r2-ledger.json'), sent = existsSync(ledger) ? JSON.parse(readFileSync(ledger, 'utf8')) : {};
const TYPES = { glb: 'model/gltf-binary', gltf: 'model/gltf+json', bin: 'application/octet-stream', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml',
  hdr: 'application/octet-stream', exr: 'application/octet-stream', ktx2: 'image/ktx2', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', md: 'text/plain', txt: 'text/plain', mp4: 'video/mp4', webm: 'video/webm' };
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = walk(root), todo = files.filter((f) => { const s = statSync(f); return sent[f] !== `${s.size}:${s.mtimeMs}`; });
console.log(`${files.length} files, ${todo.length} to send`);
const put = (f) => new Promise((done) => {
  const key = relative(root, f).split(sep).join('/'), type = TYPES[f.split('.').pop().toLowerCase()] ?? 'application/octet-stream';
  const attempt = (n) => execFile('cf', ['r2', 'objects', 'put', key, '--bucket-name', bucket, '--file', f, '--content-type', type, '-q'], { shell: true, maxBuffer: 1 << 20 }, (err, _o, stderr) => {
    if (!err) { const s = statSync(f); sent[f] = `${s.size}:${s.mtimeMs}`; return done(true); }
    if (n < 3) return setTimeout(() => attempt(n + 1), 2000 * n);
    console.log('FAILED', key, String(stderr).trim().slice(0, 200)); done(false);
  });
  attempt(1);
});
let i = 0, ok = 0, bad = 0;
await Promise.all(Array.from({ length: +jobs }, async () => {
  while (i < todo.length) {
    (await put(todo[i++])) ? ok++ : bad++;
    if ((ok + bad) % 50 === 0) { writeFileSync(ledger, JSON.stringify(sent)); console.log(`${ok + bad} / ${todo.length}${bad ? `, ${bad} failed` : ''}`); }
  }
}));
writeFileSync(ledger, JSON.stringify(sent));
console.log(`sent ${ok}, failed ${bad}`);
process.exit(bad ? 1 : 0);
