// Venice after dark from places the chase and hood views don't reach: a canal bridge and its reflection in the water, the lake from the deck's edge, the campanile, the HQ. Free camera, car parked.
//   cd track-viewer && node scripts/qa-lock.mjs -- node ../tracks/venice/qa_night_views.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { openViewer, setupLook, retry } from 'file:///D:/RaceUltimate/track-viewer/scripts/perf-open.mjs';
const A = 'D:/RaceUltimate/track-viewer/public/assets/venice/';
const OUT = 'D:/RaceUltimate/track-viewer/qa/venice-drive'; mkdirSync(OUT, { recursive: true });
const T = JSON.parse(readFileSync(A + 'track.json', 'utf8')), C = T.centerline, L = JSON.parse(readFileSync(A + 'lights.json', 'utf8')).streetLamps;
const lm = (n) => T.landmarks.find((m) => m.name === n).pos, side = (st, d, up) => { const a = C[st], b = C[(st + 3) % C.length], tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz); return [a[0] - tz / l * d, a[1] + up, a[2] + tx / l * d]; };
const bridge = L[171].pos, bridge2 = L[172].pos, along = [bridge[0] - bridge2[0], 0, bridge[2] - bridge2[2]].map((v) => v / Math.hypot(bridge[0] - bridge2[0], bridge[2] - bridge2[2]));     // venice_decor.py: the lanterns on the first canal bridge come straight after the 171 posts
const V = {
  'n1-canal-bridge': [[bridge[0] + along[0] * 42, bridge[1] - 0.5, bridge[2] + along[2] * 42], [bridge[0], bridge[1] - 2.5, bridge[2]]],
  'n2-lake': [side(600, 17, 2), side(600, 120, -2)],
  'n3-campanile': [side(240, 0, 2), lm('Campanile').map((v, i) => (i === 1 ? v * 0.6 : v))],
  'n4-hq': [side(2270, 0, 1.6), lm('HQ')],
  'n5-pier': [side(760, 40, -6), side(760, 0, 0)],
};
const { browser, page, errors } = await openViewer({ track: 'venice', look: 'night', width: 1600, height: 900 });
for (const look of (process.env.LOOKS ?? 'night,bluehour').split(',')) {
  await retry(page, setupLook, [look, 'dry', {}]);
  await page.evaluate(() => { window.game?.hud?.show?.(false); window.viewer.params.mode = 'orbit'; });
  for (const [name, [p, q]] of Object.entries(V).filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').some((o) => n.startsWith(o)))) {
    await page.evaluate(([p, q]) => { const v = window.viewer; v.camera.position.set(...p); v.controls.target.set(...q); v.controls.update(); }, [p, q]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}-${look}.png`, timeout: 240000 });
    console.log('shot', name, look);
  }
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
