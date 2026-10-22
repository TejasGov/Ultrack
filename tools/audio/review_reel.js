// node review_reel.js <ogg dir> <out.mp3> [id ...]   one listenable reel of booth lines (0.8 s apart) + <out>.txt index
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [dir, out, ...pick] = process.argv.slice(2);
const ids = pick.length ? pick : fs.readdirSync(dir).filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4)).sort();
const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' });
const ins = [], idx = [];
let t = 0;
for (const id of ids) {
  const f = path.join(dir, id + '.ogg');
  idx.push(`${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}  ${id}`);
  ins.push('-i', f);
  t += dur(f) + 0.8;
}
const chain = ids.map((_, i) => `[${i}:a]aresample=48000,apad=pad_dur=0.8[a${i}]`).join(';') + ';' + ids.map((_, i) => `[a${i}]`).join('') + `concat=n=${ids.length}:v=0:a=1[o]`;
execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', chain, '-map', '[o]', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', out]);
fs.writeFileSync(out.replace(/\.mp3$/, '.txt'), idx.join('\n') + '\n');
console.log(idx.join('\n'));
