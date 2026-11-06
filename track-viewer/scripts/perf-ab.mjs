// Pixel A/B of the render-pass savings: the same frame, same session, once with the named savings off (A) and once with them on (B),
// plus A against itself (the noise floor). The page freezes performance.now, the grain and the cars' update between the renders, so
// the only difference left is the saving. Mean absolute difference is on the 0..255 scale over RGB.
//   node scripts/qa-lock.mjs -- node scripts/perf-ab.mjs [track=tokyo] [looks=night,day] [--weather dry] [--off a,b|all]
//        [--views 0,1] [--save qa/perf/ab-x] [--url ...] [--query ...] [--revisit llano]   (--revisit: leave for that track and come back first, so a saving is judged on a second visit)
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openViewer, args as parseArgs, views, setupLook, teleport, retry, shoot, closeup, root } from './perf-open.mjs';

const { flag, pos, has } = parseArgs(process.argv.slice(2));
const track = pos[0] ?? 'tokyo', looks = (pos[1] ?? 'night,day').split(',');
const weather = flag('weather', 'dry'), off = flag('off', 'all'), save = flag('save', null), mode = flag('mode', 'game');
const sets = Object.fromEntries((flag('set', '') || '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v]; }));
const { C, N, V: VIEWS, names: viewNames } = views(track, flag('views', null));
if (save) mkdirSync(join(root, save), { recursive: true });
const { browser, page, errors } = await openViewer({ track, look: looks[0], weather, mode, base: flag('url', 'http://127.0.0.1:5180'), query: flag('query', ''), revisit: flag('revisit', null) });
const names = await page.evaluate(() => Object.keys(window.viewer.perf ?? {}));
console.log(`${track}: savings available: ${names.join(', ') || '(none)'}; A = off: ${off}`);
const offList = off === 'all' ? names : off.split(',');

const results = [];
for (const look of looks) {
  await retry(page, setupLook, [look, weather, sets]);
  for (const name of viewNames) {
    const i = VIEWS[name], k = ((i % N) + N) % N;
    await page.evaluate(teleport, [C[k], C[(k + 3) % N], true]);
    await page.waitForTimeout(7000);
    for (const kind of has('closeup') ? ['', 'front', 'rear', 'side'] : ['']) {   // '' is the game's chase view; --closeup adds the hero from the front, rear and side
      if (kind) { await page.evaluate(closeup, kind); await page.waitForTimeout(600); }
      let r;
      for (let rep = 0; rep < +flag('repeat', 1); rep++) { r = await page.evaluate(shoot, [offList, !!save]); if (+flag('repeat', 1) > 1) console.log(`   repeat ${rep + 1}: mean abs diff ${r.ab.mad.toFixed(3)} (>8 ${r.ab.over8.toFixed(3)}%)`); }
      const row = { look, view: name + (kind ? ' ' + kind : ''), weather, noiseMAD: +r.noise.mad.toFixed(3), noiseMax: r.noise.max, mad: +r.ab.mad.toFixed(3), over8pct: +r.ab.over8.toFixed(3), over32pct: +r.ab.over32.toFixed(4), max: r.ab.max };
      results.push(row);
      console.log(`${look.padEnd(8)} ${row.view.padEnd(18)} A-vs-B mean abs diff ${row.mad.toFixed(3)}  (>8: ${row.over8pct}%  >32: ${row.over32pct}%  max ${row.max})   noise floor ${row.noiseMAD.toFixed(3)} (max ${row.noiseMax})`);
      if (save) {
        const tag = `${look}-${name.replace(/\s+/g, '-')}${kind ? '-' + kind : ''}`;
        const raw = (b64, ch) => sharp(Buffer.from(b64, 'base64'), { raw: { width: r.w, height: r.h, channels: ch } }).flip();
        await raw(r.A, 4).removeAlpha().png().toFile(join(root, save, `${tag}-A.png`));
        await raw(r.B, 4).removeAlpha().png().toFile(join(root, save, `${tag}-B.png`));
        await raw(r.heat, 1).png().toFile(join(root, save, `${tag}-diff.png`));
      }
    }
    if (has('closeup')) await page.evaluate(closeup, 'chase');
  }
}
writeFileSync(join(root, save ?? 'qa/perf', `ab-${track}-${weather}.json`), JSON.stringify({ off: offList, results, errors }, null, 1));
console.log('errors:', errors.length ? errors.slice(0, 6) : 'none');
await browser.close();
