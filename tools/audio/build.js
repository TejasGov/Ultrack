// node build.js spec.json [name...] : render each spec entry to 48 kHz Ogg Opus, normalised, and verify it.
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const FF = 'ffmpeg', TMP = path.join(__dirname, 'tmp'); fs.mkdirSync(TMP, { recursive: true });
const run = (args) => execFileSync(FF, ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
const runErr = (args) => { try { return require('child_process').spawnSync(FF, ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).stderr; } catch (e) { return String(e.stderr); } };
function measure(f) {
  const s = runErr(['-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const sum = s.slice(s.lastIndexOf('Summary:'));
  const I = +sum.match(/I:\s+(-?[\d.]+|-inf)/)[1], TP = +sum.match(/Peak:\s+(-?[\d.]+|-inf)/)[1];
  const d = +runErr(['-i', f, '-f', 'null', '-']).match(/time=(\d+):(\d+):([\d.]+)/).slice(1).reduce((a, x) => a * 60 + +x, 0);
  return { I, TP, d };
}
function edgeStats(f, from, dur) { // RMS dB and DC per channel of a window
  const s = runErr(['-ss', String(from), '-t', String(dur), '-i', f, '-af', 'astats=measure_overall=none:measure_perchannel=RMS_level+DC_offset', '-f', 'null', '-']);
  return [...s.matchAll(/(RMS level dB|DC offset):\s*(-?[\d.inf]+)/g)].map(m => m[1][0] + '=' + (+m[2]).toFixed(m[1][0] === 'D' ? 4 : 1)).join(' ');
}
function leadSilenceMs(f) { // time until first sample above -50 dBFS
  const s = runErr(['-i', f, '-af', 'silencedetect=n=-50dB:d=0.001', '-f', 'null', '-']);
  const m = s.match(/silence_start: (-?[\d.]+)[\s\S]*?silence_end: ([\d.]+)/);
  return m && +m[1] <= 0.001 ? Math.round(+m[2] * 1000) : 0;
}
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const only = process.argv.slice(3);
for (const e of spec) {
  if (only.length && !only.includes(e.out)) continue;
  const wav = path.join(TMP, e.out.replace(/[\/]/g, '_') + '.wav');
  const ch = e.mono ? 1 : 2;
  if (e.loop) { // crossfade loop: head = fadeIn(S[0,X]) + fadeOut(S[L,L+X]), body = S[X,L]; end of body flows into S[L] = start of head
    const { src, ss, L, X } = e;
    run(['-y', '-ss', String(ss), '-t', String(L + X), '-i', src, '-filter_complex',
      `[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=${ch === 1 ? 'mono' : 'stereo'},highpass=f=20,asplit=3[a][b][c];` +
      `[a]atrim=0:${X},asetpts=PTS-STARTPTS,afade=t=in:d=${X}:curve=qsin[h1];[b]atrim=${L}:${L + X},asetpts=PTS-STARTPTS,afade=t=out:d=${X}:curve=qsin[h2];` +
      `[h1][h2]amix=inputs=2:normalize=0[h];[c]atrim=${X}:${L},asetpts=PTS-STARTPTS[body];[h][body]concat=n=2:v=0:a=1[o]`,
      '-map', '[o]', '-c:a', 'pcm_f32le', wav]);
  } else {
    const ins = [], fl = [];
    e.inputs.forEach((x, i) => {
      ins.push('-ss', String(x.ss), '-t', String(x.t), '-i', x.src);
      fl.push(`[${i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=${ch === 1 ? 'mono' : 'stereo'},volume=${x.gain || 0}dB,adelay=${Math.round((x.delay || 0) * 1000)}:all=1[i${i}]`);
    });
    const mix = e.inputs.length > 1 ? `${e.inputs.map((_, i) => `[i${i}]`).join('')}amix=inputs=${e.inputs.length}:normalize=0:duration=longest,` : `[i0]`;
    let chain = (e.inputs.length > 1 ? mix : '[i0]') + (e.inputs.length > 1 ? '' : '');
    let post = [ 'highpass=f=20' ];
    if (e.trim !== false) post.push('silenceremove=start_periods=1:start_threshold=' + (e.trimDb || -45) + 'dB:start_silence=0.004:detection=peak');
    post.push(`afade=t=in:d=${e.fadeIn ?? 0.004}`);
    const total = e.length; // final length after trim, s (optional)
    if (total) post.push(`atrim=0:${total}`);
    post.push('areverse', `afade=t=in:d=${e.fadeOut ?? 0.3}:curve=${e.fadeCurve || 'tri'}`, 'areverse'); // fade the tail wherever it ends
    const fc = fl.join(';') + ';' + (e.inputs.length > 1 ? `${e.inputs.map((_, i) => `[i${i}]`).join('')}amix=inputs=${e.inputs.length}:normalize=0:duration=longest,` : '[i0]') + post.join(',') + '[o]';
    run(['-y', ...ins, '-filter_complex', fc.replace('[i0]highpass', '[i0]anull,highpass'), '-map', '[o]', '-c:a', 'pcm_f32le', wav]);
  }
  // loudness
  const target = e.lufs ?? -16, ceil = -1.5;
  const m0 = measure(wav);
  let g = target - m0.I, af = `volume=${g.toFixed(2)}dB`;
  if (m0.TP + g > ceil) {
    const over = m0.TP + g - ceil;
    if (over > (e.maxLimit ?? 4)) { g = ceil + (e.maxLimit ?? 4) - m0.TP; af = `volume=${g.toFixed(2)}dB`; }
    af += `,alimiter=limit=${Math.pow(10, (ceil - 0.5) / 20).toFixed(4)}:attack=1:release=60:level=disabled:asc=1`;
  }
  const out = path.join(e.root, e.out + '.ogg');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run(['-y', '-i', wav, '-af', af + ',aresample=48000', '-c:a', 'libopus', '-b:a', (e.kbps || 128) + 'k', '-vbr', 'on', '-application', 'audio', '-ar', '48000', '-map_metadata', '-1', out]);
  const m = measure(out);
  let extra = `lead=${leadSilenceMs(out)}ms`;
  if (e.loop) extra += ` | tail20 ${edgeStats(out, m.d - 0.02, 0.02)} | head20 ${edgeStats(out, 0, 0.02)}`;
  console.log(`${e.out}: ${m.d.toFixed(2)}s I=${m.I} TP=${m.TP} gain=${g.toFixed(1)}${af.includes('alimiter') ? ' +limiter' : ''} ${extra}`);
}
