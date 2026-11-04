// Do the turbines turn in the game? Two frames apart, the rotors' nodes must have moved.
//   cd track-viewer && node scripts/qa-lock.mjs -- node ../tracks/qingshan/qa_rotors.mjs
import { readFileSync } from 'node:fs';
import { openViewer, setupLook, teleport, retry } from 'file:///D:/RaceUltimate/track-viewer/scripts/perf-open.mjs';
const C = JSON.parse(readFileSync('D:/RaceUltimate/track-viewer/public/assets/qingshan/track.json', 'utf8')).centerline;
const { browser, page, errors } = await openViewer({ track: 'qingshan', look: 'day', width: 1280, height: 720 });
await retry(page, setupLook, ['day', 'dry', {}]); await page.evaluate(teleport, [C[900], C[903], true]); await page.waitForTimeout(2500);
await page.evaluate(() => window.game?.hud?.show?.(false));
await page.screenshot({ path: 'qa/qingshan-rotor-a.png', timeout: 120000 }); await page.waitForTimeout(700); await page.screenshot({ path: 'qa/qingshan-rotor-b.png', timeout: 120000 });
console.log('errors:', errors.length ? errors : 'none'); await browser.close();
