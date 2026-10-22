// Headless race (1600x900, own context): logs every commentary line played with its time and speaker. node scripts/qa-commentary-race.mjs [seconds] [url]
import { chromium } from 'playwright-core';
const secs = Number(process.argv[2] ?? 150), url = process.argv[3] ?? 'http://localhost:5180';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await p.goto(url); await p.waitForTimeout(8000);
await p.waitForTimeout(6000); await p.keyboard.press('Space'); await p.waitForTimeout(4000);
// log each announcer one-shot with the audio clock
await p.evaluate(() => {
  const a = window.game.audio, play = a.play.bind(a); window.__cl = [];
  a.play = (path, o = {}) => { if (path.startsWith('announcers/')) { const v = Object.values(a.voices).find((x) => path.endsWith(x.file)); window.__cl.push({ t: +(a.ctx.currentTime + (o.delay ?? 0)).toFixed(2), s: v.seconds, speaker: v.speaker, cat: v.category, id: path.split('/').pop() }); } return play(path, o); };
});
await p.click('.race-tile'); await p.waitForTimeout(2500);
await p.locator('button.cta:visible').first().click();
await p.waitForTimeout(25000); await p.keyboard.down('KeyW');
for (let t = 0; t < secs; t += 5) { await p.waitForTimeout(5000); if (t % 20 === 10) { await p.keyboard.down('KeyD'); await p.waitForTimeout(600); await p.keyboard.up('KeyD'); } }
const log = await p.evaluate(() => window.__cl); await b.close();
const t0 = log[0]?.t ?? 0; let air = 0;
for (const e of log) { air += e.s; console.log(`${(e.t - t0).toFixed(1).padStart(6)}s ${e.speaker.padEnd(8)} ${e.s.toFixed(1).padStart(5)}s ${e.cat}`); }
const n = (s) => log.filter((e) => e.speaker === s).length;
console.log(`lines ${log.length}: enzo ${n('enzo')}, alastair ${n('alastair')}, kavya ${n('kavya')}; airtime ${(air / (log.length ? log.at(-1).t - t0 + log.at(-1).s : 1) * 100).toFixed(0)}% of the logged span`);
let run = 1, maxRun = 1, overlaps = 0, minGap = Infinity;
log.forEach((e, i) => { if (!i) return; const g = e.t - (log[i - 1].t + log[i - 1].s); run = e.speaker === log[i - 1].speaker ? run + 1 : 1; maxRun = Math.max(maxRun, run); if (g < -0.01) overlaps++; minGap = Math.min(minGap, g); });
console.log(`max run ${maxRun}, cut-ins by a priority-3 line (a cut line never overlaps) ${overlaps}, smallest gap ${minGap.toFixed(2)}s`);
