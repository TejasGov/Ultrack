// The Korean text from the road: both gantries, the tall banners, the hoardings and the eight corner signs, seen on the way in.
//   cd track-viewer && node scripts/qa-lock.mjs -- node ../tracks/qingshan/qa_kr_signs.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { openViewer, setupLook, teleport, retry } from 'file:///D:/RaceUltimate/track-viewer/scripts/perf-open.mjs';
const OUT = 'D:/RaceUltimate/track-viewer/qa/qingshan-kr'; mkdirSync(OUT, { recursive: true });
const T = JSON.parse(readFileSync('D:/RaceUltimate/track-viewer/public/assets/qingshan/track.json', 'utf8')), C = T.centerline, N = C.length, LAP = N * 2.5, st = (s) => ((Math.round(s / 2.5) % N) + N) % N;
const S = JSON.parse(readFileSync('D:/RaceUltimate/tracks/qingshan/out/plan/stats.json', 'utf8'));
const SHOTS = [['gantry-start', LAP - 60], ['gantry-top', 3240], ['banners-pits', LAP - 150], ['banners-halls', 110], ['boards-stands', 5560], ['boards-top', 3280], ['boards-west', 2190], ['boards-solar', 4770]];
for (const c of S.corners) if (c.n !== 6) SHOTS.push([`corner-${c.n}`, c.at - c.radius * Math.PI / 180 * c.turn / 2 - 42 - 40]);
const { browser, page, errors } = await openViewer({ track: 'qingshan', look: 'day', width: 1600, height: 900 });
await retry(page, setupLook, ['day', 'dry', {}]); await page.evaluate(() => window.game?.hud?.show?.(false));
for (const [name, s] of SHOTS) { const i = st(s); await page.evaluate(teleport, [C[i], C[(i + 3) % N], true]); await page.waitForTimeout(2600); await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 240000 }); console.log('shot', name); }
console.log('errors:', errors.length ? errors : 'none'); await browser.close();
