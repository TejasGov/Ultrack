// Cheongsan Park from the game's own chase camera, car on the road: the look a player gets.
//   cd track-viewer && node scripts/qa-lock.mjs -- node ../tracks/qingshan/qa_drive_shots.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { openViewer, setupLook, teleport, retry } from 'file:///D:/RaceUltimate/track-viewer/scripts/perf-open.mjs';
const OUT = 'D:/RaceUltimate/track-viewer/qa/qingshan-drive'; mkdirSync(OUT, { recursive: true });
const C = JSON.parse(readFileSync('D:/RaceUltimate/track-viewer/public/assets/qingshan/track.json', 'utf8')).centerline, N = C.length, st = (s) => Math.round(s / 2.5);
const SHOTS = { '01-grid': st(5770), '02-halls': st(150), '03-gate': st(380), '04-t1': st(560), '05-stack': st(1250), '06-t4': st(1960), '07-west': st(2250), '08-farm': st(2700), '09-top': st(3350), '10-lake': st(3700), '11-roof': st(3960), '12-sweep': st(4240), '13-t8': st(4560), '14-solar': st(4900), '15-t9': st(5300), '16-stand': st(5560) };
const { browser, page, errors } = await openViewer({ track: 'qingshan', look: 'day', width: 1600, height: 900 });
for (const look of (process.env.LOOKS ?? 'day,dusk').split(',')) {
  await retry(page, setupLook, [look, 'dry', {}]);
  await page.evaluate(() => window.game?.hud?.show?.(false));
  for (const [name, i] of Object.entries(SHOTS).filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').some((o) => n.startsWith(o)))) {
    await page.evaluate(teleport, [C[i % N], C[(i + 3) % N], true]);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/${name}-${look}.png`, timeout: 240000 });
    console.log('shot', name, look);
  }
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
