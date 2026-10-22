// node encode_booth.js <src dir of <id>.mp3> <out dir>
// Booth lines as the game ships them: lead/tail silence trimmed (-50 dBFS, 60 ms kept), loudness -16 LUFS / -2 dBTP
// (two-pass loudnorm), Ogg Opus 48 kHz mono 64 kb/s, the same as the v1 files. Prints {id: seconds} as JSON on the last line.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const [src, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse,' +
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse';
const seconds = {};
for (const f of fs.readdirSync(src).filter((n) => n.endsWith('.mp3')).sort()) {
  const id = f.slice(0, -4), inp = path.join(src, f), dst = path.join(out, id + '.ogg');
  const m = JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/.exec(ff(['-i', inp, '-af', `${trim},loudnorm=I=-16:TP=-2:LRA=11:print_format=json`, '-f', 'null', '-']).stderr)[0]);
  const ln = `loudnorm=I=-16:TP=-2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const r = ff(['-i', inp, '-af', `${trim},${ln},aresample=48000,alimiter=limit=0.79:level=false`, '-ac', '1', '-c:a', 'libopus', '-b:a', '64k', dst]);
  if (r.status) throw new Error(id + ': ' + r.stderr.slice(-400));
  const d = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst], { encoding: 'utf8' }).stdout;
  seconds[id] = Math.round(+d * 1000) / 1000;
  if (!(seconds[id] > 0.3)) throw new Error(id + ': suspicious duration ' + d);
}
console.log(JSON.stringify(seconds));
