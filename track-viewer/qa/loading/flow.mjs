// garage -> menu -> race -> quit -> race again, with the preload running: no console errors, renderer state intact
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://localhost:5180';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu','--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const bad = [];page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /Race preload|Car |audio:/.test(m.text()))) bad.push(m.text().slice(0, 200)); });
page.on('pageerror', e => bad.push('pageerror ' + e.message));
const state = () => page.evaluate(() => { const g = window.game, V = window.viewer; return { mode: V.params.mode, shadows: V.renderer.shadowMap.enabled, fog: !!V.scene.fog, beams: g.field.hero.beams.map(b => b.visible), heroVisible: g.field.hero.root.visible, session: !!g.session, programs: V.renderer.info.programs.length, cars: g.field.cars.length }; });
await page.goto(base + '/'); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 120000 });
await page.evaluate(() => window.game.boot()); await page.waitForTimeout(2500);
await page.evaluate(() => window.game.show('garage')); await page.waitForTimeout(500);
await page.evaluate(() => window.game.previewCar('porsche1')); await page.waitForTimeout(3000);
await page.evaluate(() => window.game.show('menu')); await page.waitForTimeout(25000);
console.log('menu after garage', JSON.stringify(await state()));
for (const round of [1, 2]) {
  const t = Date.now();
  await page.evaluate(() => window.game.startSession('race')); await page.waitForFunction(() => window.game.session, null, { timeout: 120000 });
  console.log('race', round, 'start ms', Date.now() - t, JSON.stringify(await state()));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.game.quit()); await page.waitForTimeout(6000);
}
console.log('errors/warnings:', JSON.stringify(bad));
await browser.close();
