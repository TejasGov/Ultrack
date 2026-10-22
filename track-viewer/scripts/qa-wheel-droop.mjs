// Drives the player car for a while and logs per-wheel visual height each frame: reports the largest one-frame step
// and the count of up/down reversals (jitter). Shots -> qa/wheel-droop/.   node scripts/qa-wheel-droop.mjs [url]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:5180', out = new URL('../qa/wheel-droop/', import.meta.url).pathname.slice(1);
mkdirSync(out, { recursive: true });
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const b = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
await p.goto(url); await p.waitForTimeout(8000);
for (let i = 0; i < 6; i++) {
  await p.keyboard.press('Enter');
  const s = p.locator('button.cta:visible').first();
  if (await s.count()) await s.click().catch(() => {});
  await p.waitForTimeout(4000);
}
await p.waitForTimeout(8000);
await p.evaluate(() => {
  const hero = () => window.game?.field?.cars?.find((c) => c.hero);
  const log = window.__wl = { n: 0, y: [[], [], [], []], air: 0 };
  const tick = () => { const c = hero(); if (c) { c.wheels.forEach((w, i) => log.y[i]?.push(w.pivot.position.y)); log.n++; if (c.vehicle && !c.vehicle.onGround) log.air++; } requestAnimationFrame(tick); };
  tick();
});
await p.keyboard.down('KeyW');
for (let i = 0; i < 6; i++) { await p.waitForTimeout(5000); await p.screenshot({ path: `${out}drive-${i}.png` }); }
const r = await p.evaluate(() => { const l = window.__wl; return { frames: l.n, airFrames: l.air, wheels: l.y.map((y) => { let max = 0, rev = 0, pd = 0; for (let i = 1; i < y.length; i++) { const d = y[i] - y[i - 1]; max = Math.max(max, Math.abs(d)); if (d * pd < 0 && Math.abs(d) > 0.0005 && Math.abs(pd) > 0.0005) rev++; if (d) pd = d; } return { max_mm: +(max * 1000).toFixed(2), reversals: rev, range_mm: +((Math.max(...y) - Math.min(...y)) * 1000).toFixed(1) }; }) }; });
console.log(JSON.stringify(r)); await b.close();
