// Venice from the game's own chase camera, car on the road: the look a player gets (shadows follow the car, unlike a teleported orbit camera).
//   cd track-viewer && node scripts/qa-lock.mjs -- node ../tracks/venice/qa_drive_shots.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { openViewer, setupLook, teleport, retry } from 'file:///D:/RaceUltimate/track-viewer/scripts/perf-open.mjs';
const OUT = 'D:/RaceUltimate/track-viewer/qa/venice-drive'; mkdirSync(OUT, { recursive: true });
const C = JSON.parse(readFileSync('D:/RaceUltimate/track-viewer/public/assets/venice/track.json', 'utf8')).centerline, N = C.length;
const SHOTS = { '01-grid': 2380, '02-hq': 2270, '03-palazzi': 200, '03b-palazzi': 262, '03c-palazzi': 300, '03d-palazzi': 345, '03e-palazzi': 410, '03f-palazzi': 470, '04-deck': 600, '05-crossing': 840, '06-drop': 880, '07-boulevard': 1090, '08-pillars': 1190, '09-rotunda': 1250, '10-hairpin': 1425, '11-falling': 1760, '12-mouth': 1815, '13-tunnel': 1880, '14-crossing-under': 1960, '15-exit': 1990, '16-left': 2130 };
const { browser, page, errors } = await openViewer({ track: 'venice', look: 'dusk', width: 1600, height: 900 });
for (const look of (process.env.LOOKS ?? 'dusk,day').split(',')) {
  await retry(page, setupLook, [look, 'dry', {}]);
  await page.evaluate(() => window.game?.hud?.show?.(false));
  for (const [name, st] of Object.entries(SHOTS).filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').some((o) => n.startsWith(o)))) {
    await page.evaluate(teleport, [C[st % N], C[(st + 3) % N], true]);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/${name}-${look}.png`, timeout: 240000 });
    console.log('shot', name, look);
  }
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
