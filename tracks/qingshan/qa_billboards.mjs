// Every big billboard and the stands from the game's chase camera, on the road a little before each: is the mark readable, not mirrored, not hidden?
//   cd track-viewer && node scripts/qa-lock.mjs -- node ../tracks/qingshan/qa_billboards.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { openViewer, setupLook, teleport, retry } from 'file:///D:/RaceUltimate/track-viewer/scripts/perf-open.mjs';
const OUT = 'D:/RaceUltimate/track-viewer/qa/qingshan-ads'; mkdirSync(OUT, { recursive: true });
const C = JSON.parse(readFileSync('D:/RaceUltimate/track-viewer/public/assets/qingshan/track.json', 'utf8')).centerline, N = C.length, st = (s) => Math.round(s / 2.5) % N;
const BOARDS = (process.env.BOARDS ?? '390,816,1121,1411,1826,2232,2732,3006,3520,3763,4223,4821,5158').split(',').map(Number);
const SHOTS = [...BOARDS.map((s) => [`ad-${s}`, s - 85]), ['crowd-main-far', 5470], ['crowd-main', 5650], ['crowd-north', 4020], ['crowd-corner', 5100]];
const { browser, page, errors } = await openViewer({ track: 'qingshan', look: 'day', width: 1600, height: 900 });
await retry(page, setupLook, ['day', 'dry', {}]);
await page.evaluate(() => window.game?.hud?.show?.(false));
for (const [name, s] of SHOTS) {
  const i = st(s); await page.evaluate(teleport, [C[i], C[(i + 3) % N], true]);
  await page.waitForTimeout(2600); await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80, timeout: 240000 }); console.log('shot', name);
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
