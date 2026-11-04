// Before/after views for the far-texture shrink: from the road at each shrunk surface's closest point, aimed at it, plus the ordinary road views.   TAG=before|after
//   cd track-viewer && TAG=before node scripts/qa-lock.mjs -- node ../tracks/qingshan/qa_tex_views.mjs
import { mkdirSync, readFileSync } from 'node:fs';
import { openViewer, setupLook, teleport, retry } from 'file:///D:/RaceUltimate/track-viewer/scripts/perf-open.mjs';
const OUT = `D:/RaceUltimate/track-viewer/qa/qingshan-tex/${process.env.TAG}`; mkdirSync(OUT, { recursive: true });
const C = JSON.parse(readFileSync('D:/RaceUltimate/track-viewer/public/assets/qingshan/track.json', 'utf8')).centerline, N = C.length;
const V = JSON.parse(readFileSync('D:/RaceUltimate/tracks/qingshan/out/tex_views.json', 'utf8'));
const { browser, page, errors } = await openViewer({ track: 'qingshan', look: 'day', width: 1600, height: 900 });
await retry(page, setupLook, ['day', 'dry', {}]); await page.evaluate(() => window.game?.hud?.show?.(false));
const shot = async (name, a, b) => { await page.evaluate(teleport, [a, b, true]); await page.waitForTimeout(2800); await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 240000 }); console.log('shot', name); };
for (const [n, v] of Object.entries(V)) {
  const a = C[v.st], L = Math.hypot(v.p[0] - a[0], v.p[2] - a[2]), b = [a[0] + (v.p[0] - a[0]) / L * 3, a[1], a[2] + (v.p[2] - a[2]) / L * 3];
  await shot('aim-' + n.replace(/\W+/g, '_'), a, b);
}
for (const s of [150, 380, 2250, 2700, 3700, 1250]) { const i = Math.round(s / 2.5) % N; await shot(`road-${s}`, C[i], C[(i + 3) % N]); }
console.log('errors:', errors.length ? errors : 'none'); await browser.close();
