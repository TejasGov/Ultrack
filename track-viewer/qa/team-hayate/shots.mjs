// Hayate QA shots: team logo set, livery decal sheets, venue (Sony hoardings, pit box 10 / garage). Headless Chrome, own context; no race.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const base = 'http://localhost:5180', out = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 200)); });
// 1. the logo set (brand guide, Hayate's card)
const g = await b.newPage({ viewport: { width: 1300, height: 900 } });
await g.goto(base + '/team-brand-guide.html'); await g.waitForTimeout(1500);
await (await g.$$('article')).at(-1).screenshot({ path: out + 'logos-hayate.png' });
await g.screenshot({ path: out + 'brand-guide.png', fullPage: true }); await g.close();
// 2. livery decal sheets on the violet paint, both cars (porsche1's proportions: the Z and Supra bodies are still being converted)
await page.goto(base + '/'); await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
const profile = JSON.parse(readFileSync('D:/RaceUltimate/car-lab/src/vehicle/profiles/porsche1.json', 'utf8'));
const png = await page.evaluate(async (profile) => {
  const L = await import('/src/livery.js'), T = await (await fetch('/@fs/D:/RaceUltimate/assets/teams/teams.json')).json();
  const team = T.teams.find(t => t.id === 'hayate'), box = { min: { x: -2.3, y: 0, z: -0.95 }, max: { x: 2.3, y: 1.25, z: 0.95 } };
  const rows = [];
  for (const car of team.cars) { const l = await L.makeLivery({ team, car, profile, box, k: 200 }); rows.push(l.sideP.image, l.top.image, l.rear.image); }
  const W = Math.max(...rows.map(c => c.width)), H = rows.reduce((s, c) => s + c.height + 10, 0), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = team.colors.primary; g.fillRect(0, 0, W, H); let y = 0;
  for (const r of rows) { g.drawImage(r, 0, y); y += r.height + 10; }
  return c.toDataURL('image/png');
}, profile);
writeFileSync(out + 'livery-sheets.png', Buffer.from(png.split(',')[1], 'base64'));
// 3. venue
await page.evaluate(() => window.game.boot()); await page.waitForTimeout(2500);
await page.evaluate(() => window.game.startSession('free')); await page.waitForFunction(() => window.game.session, null, { timeout: 180000 }); await page.waitForTimeout(8000);
await page.addStyleTag({ content: '#ui,#hud,.lil-gui{display:none!important}' });
const shot = async (name, pos, tgt) => {
  await page.evaluate(([p, t]) => { const V = window.viewer; V.params.mode = 'orbit'; V.applyAll?.(); V.controls.enabled = true; V.camera.position.set(...p); V.controls.target.set(...t); V.controls.update(); }, [pos, tgt]);
  await page.waitForTimeout(6000); await page.screenshot({ path: out + name + '.png' });
};
await shot('venue-sony-hoardings', [30, 2.2, 2], [55, 2, 17]);
await shot('venue-sony-fascia-poles', [40, 4, -4], [60, 8, 17]);
await shot('venue-pitbox-10', [45, 3.2, -8], [49.5, 2.5, -26]);
await shot('venue-pitbox-10-wide', [70, 6, -10], [49.5, 1.5, -30]);
await b.close();
