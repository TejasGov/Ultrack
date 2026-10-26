// How well the converted glass (viewer.perf.noTransmission) matches real transmission, for several veil factors (viewer.glassVeil): the same
// frame with the saving off (A, real transmission) and on (B) per factor, whole-frame mean absolute difference on 0..255, the share of
// pixels that differ by more than 8 / 32 levels (the lamp covers) and the largest difference. Chase view, plus the hero from the rear with --closeup.
//   node scripts/qa-lock.mjs -- node scripts/perf-veil.mjs [track=tokyo] [looks=night,dusk,day] [--weather dry] [--veil 0.96,1.4,1.9] [--views 0,2] [--closeup] [--url ...]
import { openViewer, args as parseArgs, views, setupLook, teleport, retry, closeup } from './perf-open.mjs';

const { flag, pos, has } = parseArgs(process.argv.slice(2));
const track = pos[0] ?? 'tokyo', looks = (pos[1] ?? 'night,dusk,day').split(','), weather = flag('weather', 'dry');
const veils = flag('veil', '0.96,1.4,1.9').split(',').map(Number);
const { C, N, V: VIEWS, names } = views(track, flag('views', null));
const { browser, page, errors } = await openViewer({ track, look: looks[0], weather, mode: 'game', base: flag('url', 'http://127.0.0.1:5180') });

const measure = (veils) => {
  const v = window.viewer, gl = v.renderer.getContext(), f = v.field(), perf = v.perf, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const realNow = performance.now.bind(performance), T0 = realNow(); performance.now = () => T0;
  const upd = f.update; f.update = () => {};
  const grain = v.params.grain; v.params.grain = 0; v.params.speedBlur = 0; v.applyAll();
  const snap = () => { v.renderNow(); const b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const diff = (X, Y) => {
    let sum = 0, big = 0, huge = 0, max = 0; const n = w * h;
    for (let i = 0; i < n; i++) {
      const o = i * 4, d0 = Math.abs(X[o] - Y[o]), d1 = Math.abs(X[o + 1] - Y[o + 1]), d2 = Math.abs(X[o + 2] - Y[o + 2]), m = Math.max(d0, d1, d2);
      sum += d0 + d1 + d2; if (m > 8) big++; if (m > 32) huge++; if (m > max) max = m;
    }
    return `${(sum / (n * 3)).toFixed(3)} (>8 ${(big / n * 100).toFixed(2)}%, >32 ${(huge / n * 100).toFixed(3)}%, max ${max})`;
  };
  const on0 = perf.noTransmission, veil0 = v.glassVeil.value, out = {};
  try {
    perf.noTransmission = false; v.applyAll(); snap(); const A = snap(), A2 = snap();
    out.noise = diff(A, A2);
    const mean = (b) => { let t = 0; for (let i = 0; i < b.length; i += 4) t += b[i] + b[i + 1] + b[i + 2]; return (t / (b.length / 4 * 3)).toFixed(1); };
    out.meanA = mean(A);
    perf.noTransmission = true; v.applyAll(); snap(); snap();
    for (const k of veils) { v.glassVeil.value = k; snap(); const B = snap(); out[k] = diff(A, B); out.meanB = mean(B); }
    perf.noTransmission = false; v.applyAll(); snap(); snap(); out.again = diff(A, snap());   // A once more: did anything drift while B was on?
  } finally { perf.noTransmission = on0; v.glassVeil.value = veil0; f.update = upd; performance.now = realNow; v.params.grain = grain; v.params.speedBlur = 1; v.applyAll(); }
  return out;
};

for (const look of looks) {
  await retry(page, setupLook, [look, weather, {}]);
  for (const name of names) {
    const k = ((VIEWS[name] % N) + N) % N;
    await page.evaluate(teleport, [C[k], C[(k + 3) % N], true]);
    await page.waitForTimeout(7000);
    for (const kind of has('closeup') ? ['', 'rear'] : ['']) {
      if (kind) { await page.evaluate(closeup, kind); await page.waitForTimeout(600); }
      const r = await page.evaluate(measure, veils);
      console.log(`${look.padEnd(6)} ${(name + (kind ? ' ' + kind : '')).padEnd(18)} noise ${r.noise} | mean A ${r.meanA} B ${r.meanB} | A again ${r.again} | ` + veils.map((x) => `veil ${x}: ${r[x]}`).join(' | '));
    }
    if (has('closeup')) await page.evaluate(closeup, 'chase');
  }
}
console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
