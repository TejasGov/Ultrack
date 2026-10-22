// Trace every see-through gap in a car's last QA report (CAR-QA.md): for each gap, a magenta-background close-up
// (qa/<car>/trace-<view>-<n>.png) and the line's path through the car in body metres (nose -x, left +z, y up).
//   npm run trace -- mp1x
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';

const [key] = process.argv.slice(2);
const url = 'http://127.0.0.1:5180';
if (!key) { console.log('usage: npm run trace -- <car>'); process.exit(2); }
const report = JSON.parse(readFileSync(new URL(`../qa/${key}/report.json`, import.meta.url)));
const gaps = report.checks.find((c) => c.id === 'see-through')?.detail ?? [];
if (!gaps.length) { console.log(`${key}: no see-through gaps in the last report`); process.exit(0); }
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${url}/sandbox.html?car=${encodeURIComponent(key)}&qa=trace`);
await page.waitForFunction(() => window.sandbox?.trace, null, { timeout: 120_000 });
for (const [n, g] of gaps.entries()) {
  const t = await page.evaluate(([v, at, f]) => window.sandbox.trace(v, at, f), [g.view, g.at, `trace-${g.view}-${n}.png`]);
  console.log(`${g.view} ${g.cm2} cm² at ${g.at}: in ${t.entry} -> out ${t.exit}   qa/${key}/trace-${g.view}-${n}.png`);
}
await browser.close();
