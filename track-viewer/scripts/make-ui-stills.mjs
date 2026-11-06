// In-game stills for the UI's hero imagery (docs/ui-system.md, "Stills"): nothing painted or generated, every pixel is the game.
//   tracks  the dev viewer (?dev=1&track=<id>) in orbit mode, the lil-gui panel and overlays hidden, dry, at each track's chosen look,
//           from the views in VIEWS (camera + target in game coords; 'i' = a centreline index, so a view follows a rebuilt track)
//           -> public/assets/ui/stills/tracks/<id>.webp, 1600x900
//   cars    the game's own garage room (src/garage-room.js) with the car on its turntable: one frame of that room is caught on its
//           way to the renderer and drawn again from one fixed front three-quarter camera (the same framing for every car), at
//           1.5x, once over black and once over white with the room's walls, floor and turntable hidden; the two frames give exact
//           alpha (the contact shadow and the glass come out semi-transparent) -> public/assets/ui/stills/cars/<key>.webp, 1600x900
//           with alpha, the car centred, for any panel colour
//   thumbs  the car stills cropped to the car's box (the inset every car still shares) at 320 px wide, for list rows: no browser,
//           sharp only -> public/assets/ui/stills/cars/thumbs/<key>.webp
//   side    the same room, each car square from the side through an orthographic camera: one scale for every car (200 px a metre)
//           and the ground on one line, trimmed to the car's length -> public/assets/ui/stills/cars/side/<key>.webp (alpha, 320 px
//           tall), so two drawn at the same height compare at true scale (the garage's Specs tab)
//   tiles   the menu's other tiles (TILES): more views from the same viewer -> public/assets/ui/stills/tiles/<name>.webp, 800 px
//   node scripts/qa-lock.mjs -- node scripts/make-ui-stills.mjs [tracks|tiles|cars|side|thumbs|all=all] [url=http://127.0.0.1:5180]
//   ONLY=marina,av12 limits the ids; PROBE=1 shoots candidate views instead (tracks: 8 around the lap; cars: 4 azimuths of the first
//   car) into qa/ui-stills/probe/, to choose VIEWS / CAR_VIEW from.
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [what = 'all', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'assets', 'ui', 'stills'), PROBE = join(root, 'qa', 'ui-stills', 'probe');
const only = process.env.ONLY?.split(','), probe = process.env.PROBE === '1';
const W = 1600, H = 900, SS = 1.5;   // output size; cars render at 1.5x (2400x1350, under this PC's 2560x1440 ceiling) and downscale
const WEBP = { quality: 82, alphaQuality: 90, effort: 5 };

// ---- track views: look, camera and target; [i, up, side] = centreline point i, raised `up` m, `side` m to the left of travel
const VIEWS = {
  marina: { look: 'dusk', cam: [-8, 10, 8], tgt: [40, 3, -3] },      // the start straight: pit boxes left, the grandstand and the sun ahead
  tokyo: { look: 'dusk', cam: [360, 7, 9], tgt: [400, 2, 0] },       // temple street, cherry blossom and Fuji
  india: { look: 'day', cam: [786, 9, 3], tgt: [831, 0, -3] },       // the ghat road winding down into the valley
  drylake: { look: 'dusk', cam: [178, 3.2, 5], tgt: [214, 2.5, 0] },   // into the boneyard flick (T2), airliners both sides, the low sun
  shajawa: { look: 'dusk', cam: [-24, 3.5, 2], tgt: [30, 4, -1] },     // down the main straight, the stands on both sides, the lamps on
  llano: { look: 'dusk', cam: [-60, 2.4, 2], tgt: [40, 5, -2] },        // down the start straight into the low sun: stand, pits, tower, the checkered gantry
  infinia: { look: 'dusk', cam: [-40, 3.5, 3], tgt: [70, 24, 0] },      // from the start: the sea link rising ahead, its tower and cables, the skyline beside it
  venice: { look: 'dusk', cam: [1190, 3.2, 0], tgt: [1250, 7, 0] },      // the pillared boulevard, colonnades both sides, the dome at its end
  qingshan: { look: 'day', cam: [1470, 3.2, -1], tgt: [1590, 9, -4] },      // down the top straight: forest left, lake and wind farm right, the red roof ahead
  pilbara: { look: 'dusk', cam: [205, 5, 4], tgt: [222, 2, 0] },       // into the switchback, the benches beyond
  terminal: { look: 'dusk', cam: [650, 3.5, 2], tgt: [40, 12, 2] },    // down the quay under the cranes, from far enough back that the grid sits small in the distance
};
// the menu's other tiles: a view of a circuit, its own picture, not the Race tile's; 800 px, they show small and faded
const TILES = {
  trial: { track: 'tokyo', look: 'night', cam: [120, 1.7, 0], tgt: [170, 3, 0] },          // an empty road and the clock
  drift: { track: 'drylake', look: 'day', cam: [60, 2.4, 6], tgt: [100, 1.5, -2] },        // room to slide
  free: { track: 'india', look: 'dusk', cam: [400, 6, 3], tgt: [445, 0, -2] },             // nowhere to be
  career: { track: 'marina', look: 'night', cam: [-10, 1.8, 0], tgt: [30, 4, 0] },         // the grid under the lights
  records: { track: 'shajawa', look: 'dusk', cam: [200, 3, 2], tgt: [250, 5, 0] },         // the stands
  settings: { track: 'tokyo', look: 'dusk', cam: [600, 5, 4], tgt: [640, 3, 0] },
  credits: { track: 'marina', look: 'day', cam: [500, 6, 4], tgt: [540, 3, 0] },
};
// ---- the car camera: around the car at the origin of the garage room (its long axis on x), fov, target height
const CAR_VIEW = { az: 35, el: 9, dist: 6.2, fov: 30, ty: 0.6 };   // nose to the right; the longest car fills ~70 % of the width
// the side view: camera on +z (nose, +x, to the right), 6 m across 1200 px; the frame runs from 5 cm under the ground to 1.55 m
const SIDE = { az: 90, el: 0, dist: 12, ortho: 6, ty: 0.75, w: 1200, h: 320 }, SIDE_SS = 2;
const BOX = { l: 0.19, t: 0.24, r: 0.08, b: 0.12 };   // the car's box in every car still (ui.css object-view-box: inset(24% 8% 12% 19%))

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
let browser = null;   // launched on first use: thumbs needs none
const errors = [];
async function open(url, settings) {
  browser ??= await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript((s) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: s })); } catch { /* none */ } }, settings);
  // Vite's HMR socket stubbed: another agent saving a file would otherwise reload the page mid-run
  await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(url);
  return { page, ctx };
}
const sel = (ids) => ids.filter((id) => !only || only.includes(id));

// ------------------------------------------------------------------------------------------------ tracks
async function tracks(V = VIEWS, dir = 'tracks') {
  for (const id of sel(Object.keys(V))) {
    const trk = V[id].track ?? id;
    const C = JSON.parse(readFileSync(join(root, 'public', 'assets', ...(trk === 'marina' ? [] : [trk]), 'track.json'), 'utf8')).centerline;
    const at = ([i, up = 0, side = 0]) => {   // a centreline point, raised and moved sideways (left of the direction of travel)
      const n = C.length, k = ((Math.round(i) % n) + n) % n, p = C[k], a = C[(k + n - 1) % n], b = C[(k + 1) % n];
      const tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1;
      return [p[0] + (tz / l) * side, p[1] + up, p[2] - (tx / l) * side];
    };
    const v = V[id];
    const views = probe ? [...Array(8)].map((_, j) => { const i = Math.round((j / 8) * C.length); return { name: `${id}-${j}-i${i}`, cam: at([i, 7, 9]), tgt: at([i + 40, 2, 0]) }; })
      : [{ name: id, cam: at(v.cam), tgt: at(v.tgt) }];
    const { page, ctx } = await open(`${base}/?dev=1&track=${trk}`, { track: trk, look: v.look, weather: 'dry' });
    await page.waitForFunction(() => window.viewer && !document.getElementById('loading'), null, { timeout: 300000 });
    await page.addStyleTag({ content: '.lil-gui, #hud, .input-debug, #loading { display: none !important; }' });
    await page.evaluate(async (look) => {
      const w = window.viewer, p = w.params;
      Object.assign(p, { mode: 'orbit', look, wet: 0.15, rain: 0, quality: 'high', dynamicRes: false, speedBlur: 0, aberration: 0, grain: 0 });
      w.applyQuality(); await w.setLook(look); w.applyAll(); w.controls.autoRotate = false;
    }, v.look);
    for (const s of views) {
      await page.evaluate((s) => { const w = window.viewer; w.camera.position.set(...s.cam); w.controls.target.set(...s.tgt); w.controls.update(); w.camera.lookAt(...s.tgt); }, s);
      await page.waitForTimeout(3000);   // textures, the venue's LODs and the sky settle on the new view
      const png = await page.screenshot({ timeout: 240000 });
      const file = probe ? join(PROBE, `${s.name}.jpg`) : join(OUT, dir, `${id}.webp`);
      mkdirSync(dirname(file), { recursive: true });
      await (probe ? sharp(png).resize(800).jpeg({ quality: 80 }) : dir === 'tiles' ? sharp(png).resize(800).webp(WEBP) : sharp(png).webp(WEBP)).toFile(file);
      console.log('track', s.name, JSON.stringify({ cam: s.cam.map((x) => +x.toFixed(1)), tgt: s.tgt.map((x) => +x.toFixed(1)) }));
    }
    await ctx.close();
  }
}

// ------------------------------------------------------------------------------------------------ cars
/** one garage-room frame of the current car, from the fixed camera, over black and over white: two PNG data URLs */
const catchFrame = (o) => new Promise((resolve, reject) => {
  const v = window.viewer, r = v.renderer, render = r.render, hero = window.game.field.hero.root;
  const t0 = performance.now();
  r.render = function (scene, cam) {
    if (scene === v.scene || !scene.background?.isColor || !scene.children.includes(hero)) {   // not the room with the car in it (yet)
      if (performance.now() - t0 > 20000) { r.render = render; reject(new Error('no garage-room frame in 20 s')); }
      return render.call(this, scene, cam);
    }
    r.render = render;
    const bg = scene.background.clone(), hidden = [], size = r.getSize(new v.THREE.Vector2()), pr = r.getPixelRatio();
    try {
      // the room's walls, floor, turntable and light bars go; the car, the lights and the soft contact shadow (a canvas texture) stay
      for (const c of scene.children) if (c !== hero && c.isMesh && !c.material?.map?.isCanvasTexture && c.visible) { c.visible = false; hidden.push(c); }
      const a = (o.az * Math.PI) / 180, e = (o.el * Math.PI) / 180, k = o.ortho / 2, camera = o.ortho
        ? new v.THREE.OrthographicCamera(-k, k, (k * o.h) / o.w, (-k * o.h) / o.w, 0.1, 100) : new v.THREE.PerspectiveCamera(o.fov, o.w / o.h, 0.1, 100);
      camera.position.set(Math.cos(a) * Math.cos(e) * o.dist, o.ty + Math.sin(e) * o.dist, Math.sin(a) * Math.cos(e) * o.dist); camera.lookAt(0, o.ty, 0);
      r.setPixelRatio(1); r.setSize(o.w, o.h, false);
      const out = [];
      for (const col of [0x000000, 0xffffff]) { scene.background.set(col); render.call(this, scene, camera); out.push(r.domElement.toDataURL('image/png')); }
      resolve(out);
    } catch (err) { reject(err); } finally {
      scene.background.copy(bg); hidden.forEach((c) => { c.visible = true; }); r.setPixelRatio(pr); r.setSize(size.x, size.y, false);
    }
    return render.call(this, scene, cam);
  };
});
/** exact alpha from the same frame over black (B) and white (Wh): a = 1 - (Wh - B), colour = B / a; then downscale to W x H */
async function matte([black, white], w = W, h = H) {
  const raw = (u) => sharp(Buffer.from(u.split(',')[1], 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [{ data: B, info }, { data: Wh }] = await Promise.all([raw(black), raw(white)]);
  const px = info.width * info.height, rgba = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    let d = 0; for (let c = 0; c < 3; c++) d += Wh[i * 3 + c] - B[i * 3 + c];
    const a = Math.max(0, Math.min(255, 255 - d / 3));
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = a ? Math.min(255, Math.round((B[i * 3 + c] * 255) / a)) : 0;
    rgba[i * 4 + 3] = Math.round(a);
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(w, h);
}
/** a side frame trimmed to the car: the columns whose alpha reaches half (the soft contact shadow's tails stay out), full height */
async function trimSide(img) {
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, x1 = -1;
  for (let x = 0; x < info.width; x++) for (let y = 0; y < info.height; y++) if (data[(y * info.width + x) * 4 + 3] >= 128) { x0 = Math.min(x0, x); x1 = x; break; }
  if (x1 < 0) throw new Error('empty side frame');
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left: x0, top: 0, width: x1 - x0 + 1, height: info.height });
}
async function cars(side = false) {
  const { page, ctx } = await open(base + '/', { track: 'marina', look: 'dusk', weather: 'dry', reduceMotion: true });
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 300000 });
  await page.keyboard.press('Enter');
  await page.waitForSelector('.bento-tile.current-car', { state: 'visible', timeout: 60000 });   // the Your car tile opens the garage
  await page.click('.bento-tile.current-car');
  await page.waitForSelector('.garage button.car[data-key]', { state: 'visible' });
  const keys = sel(await page.$$eval('.garage button.car[data-key]', (b) => b.map((x) => x.dataset.key)));   // every car the game offers
  const views = side ? [SIDE] : probe ? [35, 145, 215, 325].map((az) => ({ ...CAR_VIEW, az })) : [CAR_VIEW];
  for (const key of probe ? keys.slice(0, 1) : keys) {
    await page.click(`.garage button.car[data-key="${key}"]`);
    await page.waitForFunction((k) => window.game.field?.hero?.key === k && window.game.screenName === 'garage', key, { timeout: 180000 });
    await page.waitForTimeout(1500);   // textures decode, the paint settles
    for (const view of views) {
      const [w, h, ss] = side ? [SIDE.w, SIDE.h, SIDE_SS] : [W, H, SS];
      const frames = await page.evaluate(catchFrame, { ...view, w: w * ss, h: h * ss });
      const file = side ? join(OUT, 'cars', 'side', `${key}.webp`) : probe ? join(PROBE, `car-${key}-az${view.az}.png`) : join(OUT, 'cars', `${key}.webp`);
      mkdirSync(dirname(file), { recursive: true });
      const img = side ? await trimSide(await matte(frames, w, h)) : await matte(frames);
      await (probe && !side ? img.flatten({ background: '#2a3038' }).png() : img.webp(WEBP)).toFile(file);
      console.log('car', key, view.az);
    }
  }
  await ctx.close();
}

/** list-row thumbnails: each car still cropped to the shared car box, so a row decodes 320 px, not a 1600x900 frame */
async function thumbs() {
  const dir = join(OUT, 'cars'), left = Math.round(W * BOX.l), top = Math.round(H * BOX.t);
  const box = { left, top, width: W - left - Math.round(W * BOX.r), height: H - top - Math.round(H * BOX.b) };
  mkdirSync(join(dir, 'thumbs'), { recursive: true });
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.webp') && (!only || only.includes(f.slice(0, -5))))) {
    await sharp(join(dir, f)).extract(box).resize(320).webp(WEBP).toFile(join(dir, 'thumbs', f));
    console.log('thumb', f);
  }
}

try {
  if (what === 'tracks' || what === 'all') await tracks();
  if (what === 'tiles' || what === 'all') await tracks(TILES, 'tiles');
  if (what === 'cars' || what === 'all') await cars();
  if (what === 'side' || what === 'all') await cars(true);
  if (what === 'thumbs' || what === 'all') await thumbs();
} finally { await browser?.close(); }
console.log('errors:', errors.length ? errors : 'none');
