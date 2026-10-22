// Free Drive screenshots of one track in every look, plus the console errors of the run.
//   node scripts/qa-looks.mjs [track=marina] [looks=day,dusk,bluehour,night] [url=http://127.0.0.1:5180] [--stub-tokyo]
// Shots go to qa/looks/<track>-<look>.png (and -driving). --stub-tokyo serves Marina's files at /assets/tokyo/ through the browser
// (nothing on disk) so the track switch and the venue disposal can be exercised before Tokyo is exported.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), flag = (f) => args.includes(f), pos = args.filter((a) => !a.startsWith('--'));
const tune = process.env.TUNE ? JSON.parse(process.env.TUNE) : {};   // TUNE='{"day":{"exposure":1.4}}' overrides look values for a tuning run
const [track = 'marina', looks = 'day,dusk,bluehour,night', base = 'http://127.0.0.1:5180'] = pos;
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = process.env.OUT ?? join(root, 'qa', 'looks');
mkdirSync(out, { recursive: true });
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });   // its own context: nothing shared with the user's browser
const errors = [];
await ctx.addInitScript(([track, look]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look, weather: 'dry' } })); } catch { /* none */ } }, [track, looks.split(',')[0]]);
if (flag('--stub-tokyo')) {
  const pub = join(root, 'public', 'assets');
  await ctx.route('**/assets/tokyo/*', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop().replace(/^tokyo_/, 'marina_');
    const file = join(pub, name);
    return existsSync(file) ? route.fulfill({ body: route.request().method() === 'HEAD' ? '' : readFileSync(file), contentType: name.endsWith('.json') ? 'application/json' : 'model/gltf-binary' }) : route.fulfill({ status: 404 });
  });
}
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
await page.goto(base);
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 120000 });
await page.keyboard.press('Enter');                                            // title -> menu
await page.waitForSelector('.bento-tile[data-id=free]', { state: 'visible' });
await page.click('.bento-tile[data-id=free]');
await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
console.log('setup rows:', await page.$$eval('.panel.setup .row label', (l) => l.map((x) => x.textContent)));
await page.screenshot({ path: join(out, `${track}-setup.png`) });
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 240000 });
console.log('track:', await page.evaluate(() => window.viewer.trackId?.()));
await page.evaluate((tune) => { for (const [k, v] of Object.entries(tune)) Object.assign(window.viewer.LOOKS?.[k] ?? {}, v); }, tune);
for (const look of looks.split(',')) {
  await page.evaluate(async (look) => { window.viewer.params.look = look; await window.viewer.setLook(look); window.viewer.applyAll(); }, look);
  await page.waitForTimeout(2500);                                              // fades, cube capture, PMREM
  await page.screenshot({ path: join(out, `${track}-${look}.png`), timeout: 240000 });
  console.log('shot', look);
}
// the paint up close, front three-quarter, per look (the HUD hidden, an orbit camera on the car)
await page.evaluate(() => { const v = window.viewer, c = v.field().hero.root.position; window.game.hud.show(false); v.params.mode = 'orbit';
  v.controls.target.set(c.x, c.y + 0.6, c.z); v.camera.position.set(c.x + 3.4, c.y + 1.3, c.z + 3.6); v.controls.update(); });
for (const look of looks.split(',')) {
  await page.evaluate(async (look) => { window.viewer.params.look = look; await window.viewer.setLook(look); window.viewer.applyAll(); }, look);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, `${track}-${look}-car.png`), timeout: 240000 });
}
await page.evaluate(() => { window.viewer.params.mode = 'chase'; window.game.hud.show(true); });
const look = looks.split(',')[0];
await page.evaluate(async (look) => { window.viewer.params.look = look; await window.viewer.setLook(look); window.viewer.applyAll(); }, look);
await page.keyboard.down('KeyW'); await page.waitForTimeout(4500);
await page.screenshot({ path: join(out, `${track}-${look}-driving.png`) });
await page.keyboard.up('KeyW');
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
