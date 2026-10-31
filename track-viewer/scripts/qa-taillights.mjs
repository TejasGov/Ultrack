// Tail-light stills of one car (docs/tail-lights.md): from behind and 3/4 rear, at the lamp, at chase distance and at ~20 m,
// in day, dusk and night, dry and wet, with the lamps running, braking and reversing; then a few chase-camera frames of the
// AI braking into Marina's first corner at night in the rain. The car stands still on Free Drive's grid; the lamp state is
// forced each frame, so a shot shows the settled level.
//   node scripts/qa-lock.mjs -- node scripts/qa-taillights.mjs [car=av12] [out=qa/taillights/<car>-after] [url=http://127.0.0.1:5180]
//   TAILS=off ... qa/taillights/<car>-before   the same shots on the generic lamp (?tails=off), for the before set
//   node scripts/qa-taillights.mjs --sheet <beforeDir> <afterDir> <out.jpg>   before/after contact sheet (no browser)
// Shots: <look>-<dry|wet>-<running|brake|reverse>-<view>.jpg and drive-<n>.jpg. The macro shot frames the car's right rear lamp
// (its spec's qa.macro, else model.json / the car-lab profile); the other views are the same for every car.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
/** The lamp the macro shot frames (car frame): the spec's qa.macro, else the right rear lamp of the model or car-lab profile. */
async function lampAt(car) {
  const spec = join(root, 'src', 'carkit', 'tails', `${car}.js`), model = join(root, '..', 'assets', 'cars', car, 'model.json');
  const macro = existsSync(spec) && (await import(pathToFileURL(spec))).default.qa?.macro;
  if (macro) return macro;
  if (existsSync(model)) return JSON.parse(readFileSync(model, 'utf8')).lights.rear.reduce((a, p) => (p[2] > a[2] ? p : a));
  const p = JSON.parse(readFileSync(join(root, '..', 'car-lab', 'src', 'vehicle', 'profiles', `${car}.json`), 'utf8')), pts = p.lights.rear.filter((q) => q[2] > 0);
  return [0, 1, 2].map((k) => pts.reduce((s, q) => s + q[k], 0) / pts.length + (k === 1 ? p.body?.lift ?? 0 : 0));   // a car-lab lamp sits on the lifted shell
}
// a quick iteration narrows the set: LOOKS=night WEATHER=dry STATES=brake VIEWS=macro,chase DRIVE=0
const only = (k, all) => (process.env[k] ? all.filter((x) => process.env[k].split(',').includes(x)) : all);
const LOOKS = only('LOOKS', ['day', 'dusk', 'night']), STATES = only('STATES', ['running', 'brake', 'reverse']);
const WEATHER = Object.fromEntries(only('WEATHER', ['dry', 'wet']).map((w) => [w, { dry: { wet: 0.15, rain: 0 }, wet: { wet: 1, rain: 0.75 } }[w]]));
// car frame (car-lab's): +x is the tail, y up, z to the side; [camera, target] in metres from the car's origin
const VIEWS = {
  macro: [[3.45, 0.86, 1.05], [2.08, 0.74, 0.62]],     // 1.4 m from the right lamp: the internal structure (moved onto the car's lamp below)
  chase: [[8.1, 1.85, 0], [1.6, 0.7, 0]],              // the player's own view (camera.js 'chase': 6 m behind the tail, 1.85 m up)
  rear34: [[5.2, 1.15, 2.9], [1.7, 0.6, 0.15]],        // 3/4 rear, close
  far: [[22.1, 1.6, 0], [2.0, 0.7, 0]],                // a car ~20 m ahead
  far34: [[19.5, 2.0, 5.5], [1.6, 0.7, 0]],            // (9.5 m out put Marina's catch fence in the way)
};

if (args[0] === '--sheet') {
  // one row per look/weather/state, the views across; before above after per row pair
  const [, a, b, outFile] = args, W = 400, H = 225, views = Object.keys(VIEWS), rows = [];
  for (const look of LOOKS) for (const w of Object.keys(WEATHER)) for (const s of STATES) rows.push(`${look}-${w}-${s}`);
  const label = (t) => Buffer.from(`<svg width="${W}" height="22"><rect width="100%" height="100%" fill="#000"/><text x="6" y="16" font-family="Arial" font-size="14" fill="#fff">${t}</text></svg>`);
  const tiles = [];
  let y = 0;
  for (const r of rows) for (const [dir, tag] of [[a, 'before'], [b, 'after']]) {
    const have = views.filter((v) => existsSync(join(dir, `${r}-${v}.jpg`)));
    if (!have.length) continue;
    tiles.push({ input: label(`${r} ${tag}`), left: 0, top: y }); y += 22;
    for (const [i, v] of views.entries()) {
      const f = join(dir, `${r}-${v}.jpg`);
      if (existsSync(f)) tiles.push({ input: await sharp(f).resize(W, H).toBuffer(), left: i * W, top: y });
    }
    y += H;
  }
  const drive = (d) => readdirSync(d).filter((f) => f.startsWith('drive-')).sort();
  for (const [dir, tag] of [[a, 'before'], [b, 'after']]) {
    const fs = existsSync(dir) ? drive(dir).slice(0, views.length) : [];
    if (!fs.length) continue;
    tiles.push({ input: label(`night-wet driving, chase camera, ${tag}`), left: 0, top: y }); y += 22;
    for (const [i, f] of fs.entries()) tiles.push({ input: await sharp(join(dir, f)).resize(W, H).toBuffer(), left: i * W, top: y });
    y += H;
  }
  await sharp({ create: { width: W * views.length, height: y, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 82 }).toFile(outFile);
  console.log('sheet', outFile, `${W * views.length}x${y}`);
  // the approval sheet (<out>-highlights.jpg): the lamp cropped from the shots that decide it, before above after
  const HL = [['macro (1.4 m)', [600, 330, 460, 170], ['day-dry-running', 'day-dry-brake', 'night-dry-running', 'night-dry-brake', 'night-dry-reverse'], 'macro'],
    ['chase (6 m)', [540, 320, 520, 330], ['day-dry-brake', 'dusk-dry-running', 'dusk-dry-brake', 'night-dry-brake', 'night-wet-brake'], 'chase'],
    ['far (20 m)', [640, 360, 320, 200], ['day-dry-brake', 'dusk-wet-brake', 'night-dry-running', 'night-dry-brake', 'night-wet-brake'], 'far']];
  const HW = 460, wide = (t) => Buffer.from(`<svg width="${5 * HW}" height="24"><rect width="100%" height="100%" fill="#111"/><text x="8" y="17" font-family="Arial" font-size="15" fill="#fff">${t}</text></svg>`), hl = [];
  y = 0;
  for (const [name, [left, top, width, height], shots, v] of HL) for (const [dir, tag] of [[a, 'before'], [b, 'after']]) {
    const h = Math.round(HW * height / width);
    hl.push({ input: wide(`${name} ${tag}: ${shots.join(' | ')}`), left: 0, top: y }); y += 24;
    for (const [i, s] of shots.entries()) if (existsSync(join(dir, `${s}-${v}.jpg`))) hl.push({ input: await sharp(join(dir, `${s}-${v}.jpg`)).extract({ left, top, width, height }).resize(HW, h).toBuffer(), left: i * HW, top: y });
    y += h;
  }
  for (const [dir, tag] of [[a, 'before'], [b, 'after']]) {
    const fs = existsSync(dir) ? drive(dir).slice(0, 5) : [];
    if (!fs.length) continue;
    hl.push({ input: wide(`night rain, the AI driving, chase camera, ${tag}: ${fs.join(' | ')}`), left: 0, top: y }); y += 24;
    for (const [i, f] of fs.entries()) hl.push({ input: await sharp(join(dir, f)).extract({ left: 400, top: 250, width: 800, height: 450 }).resize(HW, 259).toBuffer(), left: i * HW, top: y });
    y += 259;
  }
  const hlFile = outFile.replace(/(\.jpg)?$/, '-highlights.jpg');
  await sharp({ create: { width: 5 * HW, height: y, channels: 3, background: '#000' } }).composite(hl).jpeg({ quality: 88 }).toFile(hlFile);
  console.log('highlights', hlFile);
  process.exit(0);
}

const { chromium } = await import('playwright-core');
const [car = 'av12', outArg, base = 'http://127.0.0.1:5180'] = args;
const lamp = await lampAt(car);
VIEWS.macro = [[lamp[0] + 1.37, lamp[1] + 0.12, lamp[2] + 0.43], lamp];   // AV-12's offset (qa.macro keeps its approved framing)
console.log('macro lamp', lamp.join(', '));
const out = outArg ? join(process.cwd(), outArg) : join(root, 'qa', 'taillights', `${car}-after`);
mkdirSync(out, { recursive: true });
if (process.env.DRIVE !== '0') for (const f of readdirSync(out)) if (f.startsWith('drive-')) rmSync(join(out, f));   // their names carry the speed: drop the last run's
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript((car) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track: 'marina', look: 'night', weather: 'dry' }, car })); } catch { /* none */ } }, car);
// Vite's HMR socket stubbed: another agent saving a file would otherwise reload the page mid-run
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(process.env.TAILS === 'off' ? `${base}/?tails=off` : base);
await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
await page.keyboard.press('Enter');
await page.waitForSelector('.bento-tile[data-id=free]', { state: 'visible' });
await page.click('.bento-tile[data-id=free]');
await page.waitForSelector('.panel.setup button.cta', { state: 'visible' });
await page.click('.panel.setup button.cta');
await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000 });
const heroKey = await page.evaluate(() => {
  const f = window.game.session.field, up = f.update.bind(f);
  // the lamp state for the shot, forced after physics and before the lamps are set
  f.update = (...a) => { const h = f.hero, L = window.__lamp; if (L) { h.onGrid = false; h.brake = L.brake; h.reverse = L.reverse; } return up(...a); };
  window.game.hud.show(false);
  return f.hero.key;
});
console.log('hero', heroKey);
const setView = (v) => page.evaluate(([cam, tgt]) => {
  const vw = window.viewer, h = window.game.session.field.hero, T = vw.THREE;
  vw.params.mode = 'orbit'; vw.params.headlight = false; vw.applyAll();   // orbit lights the scene from the camera (main.js headlight): a white glare on every close rear; the game plays in chase, where it is off
  h.car.updateWorldMatrix(true, false);
  vw.camera.position.copy(h.car.localToWorld(new T.Vector3(...cam))); vw.controls.target.copy(h.car.localToWorld(new T.Vector3(...tgt)));
  vw.camera.fov = 50; vw.camera.updateProjectionMatrix(); vw.controls.update();
}, VIEWS[v]);
for (const look of LOOKS) {
  await page.evaluate(async (look) => { window.viewer.params.look = look; await window.viewer.setLook(look); window.viewer.applyAll(); }, look);
  for (const [w, wp] of Object.entries(WEATHER)) {
    await page.evaluate((wp) => { Object.assign(window.viewer.params, wp); window.viewer.applyAll(); }, wp);
    await setView('chase');
    await page.waitForTimeout(2500);                                  // fades, cube capture, PMREM, the mirror
    for (const s of STATES) {
      await page.evaluate((s) => { window.__lamp = { brake: s === 'brake' ? 1 : 0, reverse: s === 'reverse' }; }, s);
      await page.waitForTimeout(400);                                 // the lamp ramp (~70 ms on, ~150 ms off)
      for (const v of only('VIEWS', Object.keys(VIEWS))) {
        if (s === 'reverse' && v.startsWith('far')) continue;         // reversing is a close-range read
        await setView(v);
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(out, `${look}-${w}-${s}-${v}.jpg`), type: 'jpeg', quality: 88 });
      }
    }
    console.log('shot', look, w);
  }
}
// the AI drives the car at night in the rain: chase camera frames through the braking zones
if (process.env.DRIVE !== '0') {
  await page.evaluate(() => { const vw = window.viewer, f = window.game.session.field; window.__lamp = null; vw.params.mode = 'chase'; vw.params.look = 'night'; f.setPlayer(false); });
  await page.evaluate(async () => { await window.viewer.setLook('night'); Object.assign(window.viewer.params, { wet: 1, rain: 0.75 }); window.viewer.applyAll(); });
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(700);
    const b = await page.evaluate(() => { const h = window.game.session.field.hero; return { brake: +(h.brake ?? 0).toFixed(2), kmh: Math.round(h.speed * 3.6) }; });
    if (b.brake > 0.3 || i % 6 === 5) await page.screenshot({ path: join(out, `drive-${String(i).padStart(2, '0')}-${b.brake > 0.3 ? 'brake' : 'run'}-${b.kmh}kmh.jpg`), type: 'jpeg', quality: 88 });
  }
}
console.log('errors:', errors.length ? [...new Set(errors)] : 'none');
await browser.close();
