// Contact sheet of a recording: node qa/cmp/sheet.mjs <dir> <fromMs> <toMs> <stepMs> [cols]; labels each tile with t, keys held and (Ultrack) telemetry
import fs from 'fs'; import { execFileSync } from 'child_process';
const [dir, from, to, step, cols = 4] = process.argv.slice(2); const D = `D:/RaceUltimate/research/endurance/cmp/${dir}/`;
const { frames, marks, tel } = JSON.parse(fs.readFileSync(D + 'times.json', 'utf8'));
const ev = marks.map((m) => m.split(' ')).map(([t, k, a]) => ({ t: +t, k: k.replace('Key', ''), a }));
const held = (t) => { const h = new Set(); for (const e of ev) if (e.t <= t) e.a === 'down' ? h.add(e.k) : h.delete(e.k); return [...h].join('+') || '-'; };
const tmp = D + 'sheet/'; fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp); fs.copyFileSync('C:/Windows/Fonts/consola.ttf', tmp + 'consola.ttf');
let n = 0;
for (let t = +from; t <= +to; t += +step) {
  const i = frames.reduce((b, ft, j) => (Math.abs(ft - t) < Math.abs(frames[b] - t) ? j : b), 0);
  const s = tel?.length ? tel.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b)) : null;
  const lab = `t=${((t - +from) / 1000).toFixed(2)}s  ${held(t)}` + (s ? `  ${s.kmh.toFixed(0)}kmh yaw${s.yaw?.toFixed(0)} slip${s.beta?.toFixed(1)} steer${s.steer?.toFixed(1)}` : '');
  fs.writeFileSync(tmp + 'l.txt', lab);   // textfile + a local font: no filtergraph escaping of ':' and '='
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', D + String(i).padStart(3, '0') + '.jpg', '-vf',
    'scale=400:225,drawbox=y=0:w=iw:h=20:color=black@0.6:t=fill,drawtext=fontfile=consola.ttf:textfile=l.txt:x=4:y=4:fontsize=12:fontcolor=white', String(n++).padStart(3, '0') + '.jpg'], { cwd: tmp });
}
const rows = Math.ceil(n / cols);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '1', '-i', tmp + '%03d.jpg', '-vf', `tile=${cols}x${rows}`, '-frames:v', '1', D + '../' + dir + '-sheet.jpg']);
console.log(D + '../' + dir + '-sheet.jpg', n, 'tiles');
