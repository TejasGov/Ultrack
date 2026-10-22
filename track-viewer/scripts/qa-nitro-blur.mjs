import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const tag = process.argv[2];
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const b = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:5181');
await p.waitForTimeout(8000);
for (let i = 0; i < 6; i++) {
  const btns = await p.$$eval('button', e => e.filter(x => x.offsetParent).map(x => x.textContent.trim()));
  console.log(i, JSON.stringify(btns.slice(0, 12)));
  await p.keyboard.press('Enter');
  const s = p.locator('button.cta:visible').first();
  if (await s.count()) await s.click().catch(()=>{});
  await p.waitForTimeout(4000);
}
await p.waitForTimeout(8000);
await p.keyboard.down('KeyW');
await p.waitForTimeout(24000);
await p.keyboard.down('ShiftLeft');
await p.waitForTimeout(2500);
const u = await p.evaluate(() => window.__fu?.uNitro?.value);
await p.screenshot({ path: `D:/RaceUltimate/track-viewer/qa/nitro-blur/nitro-${tag}.png` });
console.log('uNitro', u);
await b.close();
