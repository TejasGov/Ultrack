// Track switching, end to end, with Tokyo's files stubbed from Marina's (served by the browser, nothing on disk):
//   A. the menu: the Circuit row appears once /assets/tokyo/ answers, picking Tokyo switches the track and persists it
//   B. the dev viewer: Marina -> Tokyo -> Marina -> Tokyo, and the GPU's geometry/texture counts do not grow (the venue is disposed)
//   node scripts/qa-track-switch.mjs [url=http://127.0.0.1:5180]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://127.0.0.1:5180', pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const errors = [];
await ctx.route('**/assets/tokyo/*', (route) => {
  const name = new URL(route.request().url()).pathname.split('/').pop().replace(/^tokyo_/, 'marina_'), file = join(pub, name);
  return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: name.endsWith('.json') ? 'application/json' : 'model/gltf-binary' }) : route.fulfill({ status: 404 });
});
const open = async (url) => {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  return page;
};

// A. menu
let page = await open(base);
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 120000 });
await page.keyboard.press('Enter');
await page.click('.bento-tile[data-id=free]');
await page.waitForSelector('.panel.setup .row label');
await page.waitForFunction(() => [...document.querySelectorAll('.panel.setup .row label')].some((l) => l.textContent === 'Circuit'));
console.log('A. circuit row:', await page.evaluate(() => [...document.querySelectorAll('.panel.setup .row')].find((r) => r.querySelector('label').textContent === 'Circuit').innerText.replace(/\n/g, ' | ')));
await page.evaluate(() => [...document.querySelectorAll('.panel.setup .row')].find((r) => r.querySelector('label').textContent === 'Circuit').querySelectorAll('button')[1].click());
await page.waitForFunction(() => window.viewer.trackId() === 'tokyo', null, { timeout: 60000 });
await page.waitForFunction(() => !document.querySelector('.asset-loading') || document.querySelector('.asset-loading').hidden, null, { timeout: 60000 });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ultrack.v1')).settings);
console.log('A. saved settings:', saved.track, saved.look, '| heading:', await page.evaluate(() => document.querySelector('.home-heading').childNodes[0].textContent));
assert.equal(saved.track, 'tokyo'); assert.equal(saved.look, 'night', "Tokyo opens at its own look");
await page.screenshot({ path: join(dirname(fileURLToPath(import.meta.url)), '..', 'qa', 'looks', 'menu-circuit-row.png') });
await page.close();

// B. dev viewer: no leak across switches
page = await open(base + '/?dev=1&physics=0');
await page.waitForFunction(() => window.viewer?.field?.() && window.viewer.scene.children.length > 10, null, { timeout: 120000 });
// frozen world (no cars, fixed camera) so only the venue changes the counts; "loaded" counts vary with what the first frames upload,
// so the leak test is the memory with the venue dropped: it must be the same after every switch (the first drop also frees the dev viewer's own venue)
await page.evaluate(() => { const v = window.viewer; v.params.cars = false; v.params.mode = 'orbit'; v.params.paused = true; v.params.cull = false; v.controls.target.set(0, 1, 0); v.camera.position.set(30, 8, 30); v.controls.update(); });
const mem = () => page.evaluate(async () => { const v = window.viewer; for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r, 400)); v.renderNow(); } const m = v.renderer.info.memory; return { geometries: m.geometries, textures: m.textures, track: v.trackId() }; });
const dropped = [];
for (const id of ['tokyo', 'marina', 'tokyo', 'marina', 'tokyo', 'marina', 'tokyo']) {
  await page.evaluate(async (id) => { const v = window.viewer; await v.setTrack(id); await v.ensureVenue(); }, id);
  await mem();
  await page.evaluate(() => window.viewer.unloadVenue());
  dropped.push(await mem());
}
console.log('B. memory with the venue dropped', JSON.stringify(dropped));
// the characters' textures upload on their first visit (a cache, not a leak), so compare the later repeat visits; +8 geometries of slack
for (const [a, b] of [[3, 5], [4, 6]]) assert.ok(dropped[b].textures <= dropped[a].textures * 1.03 && dropped[b].geometries <= dropped[a].geometries + 8, `memory grew between visits ${a} and ${b} (${dropped[a].track})`);
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
assert.equal(errors.length, 0);
