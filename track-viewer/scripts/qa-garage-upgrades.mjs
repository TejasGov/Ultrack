// The free-play garage's Upgrades tab with five categories: it fits at 1280x720 and 1600x900 (or scrolls), the new effect lines read, and a purchase of Aero and Nitro works and persists.
//   node scripts/qa-lock.mjs -- node scripts/qa-garage-upgrades.mjs [url=http://127.0.0.1:5180]    Out: qa/garage-upgrades/*.png
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [base = 'http://127.0.0.1:5180'] = process.argv.slice(2), out = join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'garage-upgrades'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('qa')) { sessionStorage.setItem('qa', '1'); localStorage.setItem('ultrack.v1', JSON.stringify({ car: 'huracan', coins: 20000, upgrades: { huracan: { engine: 1, tyres: 2, brakes: 0 } }, settings: {} })); } } catch { /* none */ } });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
try {
  await page.goto(base); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await page.keyboard.press('Enter'); await page.click('.current-car'); await page.waitForSelector('.screen.garage.on, .screen.on .ga-tabs', { timeout: 30000 });
  await page.click('.ga-tabs button:has-text("Upgrades")'); await page.waitForTimeout(600);
  for (const [w, h] of [[1280, 720], [1600, 900]]) { await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(400); await page.screenshot({ path: join(out, `upgrades-${w}.png`) }); }
  console.log('sections', await page.$$eval('.ga-up', (l) => l.map((s) => s.innerText.replace(/\n+/g, ' | ').slice(0, 110))));
  await page.click('[data-id=buy-aero]'); await page.waitForTimeout(300); await page.click('[data-id=buy-nitro]'); await page.waitForTimeout(500);
  console.log('levels', JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('ultrack.v1')).upgrades.huracan)), 'coins', await page.evaluate(() => JSON.parse(localStorage.getItem('ultrack.v1')).coins));
  console.log('physics', JSON.stringify(await page.evaluate(async () => { const e = performance.getEntriesByType('resource').map((x) => x.name).findLast((n) => n.includes('/src/physics/handling.js')); const H = await import(e); const s = H.handling('huracan'); return { aero: H.getUpgrades('huracan').aero, nitro: H.getUpgrades('huracan').nitro, downforce: s.downforce, stock: s.downforceStock, tank: s.nitroTank }; })));
  await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(300); await page.screenshot({ path: join(out, 'upgrades-bought-1280.png') });
} catch (e) { errors.push('qa: ' + e.message); await page.screenshot({ path: join(out, 'failed.png') }).catch(() => {}); }
console.log('errors', JSON.stringify(errors)); await browser.close();
