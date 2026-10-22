// Car QA runner (CAR-QA.md): opens sandbox.html?car=<key>&qa=1 in Chrome for each car, one at a time, waits for the
// pipeline, and prints each report's summary. Results land in track-viewer/qa/<key>/ (report.md, report.json, sheets).
//   npm run dev                      (in another terminal: the sandbox saves through the dev server)
//   npm run qa -- av12               one car
//   npm run qa -- av12 mp1x          several
//   npm run qa -- all                every car with a car-lab profile
// Exit code 1 if any check fails. One car at a time on purpose: this PC overheats under sustained full load.
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const url = (args.find((a) => a.startsWith('--url='))?.slice(6)) ?? 'http://127.0.0.1:5180';
let cars = args.filter((a) => !a.startsWith('--'));
if (!cars.length) { console.log('usage: npm run qa -- <car key ...|all>'); process.exit(2); }
if (cars.includes('all')) {
  const teams = JSON.parse(readFileSync(new URL('../../assets/teams/teams.json', import.meta.url)));
  cars = teams.teams.flatMap((t) => t.cars.map((c) => c.key));
}
try { await fetch(url); } catch { console.error(`dev server not reachable at ${url}: run "npm run dev" first`); process.exit(2); }

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
let failed = 0;
for (const key of cars) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log(`  [${key}] ${m.text().slice(0, 200)}`); });
  const t0 = Date.now();
  await page.goto(`${url}/sandbox.html?car=${encodeURIComponent(key)}&qa=1`);
  await page.waitForFunction(() => window.__qa?.done, null, { timeout: 6 * 60_000, polling: 1000 });
  const qa = await page.evaluate(() => window.__qa);
  await page.close();
  if (qa.error) { console.log(`${key}: ERROR ${qa.error.split('\n')[0]}`); failed++; continue; }
  const s = qa.report.summary;
  console.log(`${key}: ${s.pass} pass, ${s.warn} warn, ${s.fail} fail, ${s.review} to review  (${((Date.now() - t0) / 1000).toFixed(0)} s)  -> qa/${key}/report.md`);
  for (const c of qa.report.checks) if (c.status === 'fail' || c.status === 'warn') console.log(`  ${c.status.toUpperCase()} ${c.title}: ${c.value}\n       fix: ${c.fix}`);
  if (s.fail) failed++;
}
await browser.close();
process.exit(failed ? 1 : 0);
