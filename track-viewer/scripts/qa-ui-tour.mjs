// The UI's screenshot tour: drives the real game through every screen and state a player can reach (title, menu, each setup
// panel, garage tabs, settings tabs, records, credits, race loading, the grid lights and GO, the race HUD with nitro, a message,
// wrong way, the camera label and the map overview, pause, settings from pause, results; time trial, drift attack and free drive
// HUDs and their results; the busy toast) and saves a PNG of each, plus report.json with a DOM audit per shot (text off the
// viewport, clipped text, the font families on screen, arrow / box / emoji glyphs standing in for icons) and console errors.
//   node scripts/qa-lock.mjs -- node scripts/qa-ui-tour.mjs [label=latest] [url=http://127.0.0.1:5180]
// Out: $OUT, or qa/ui-tour/<label>/. 1600x900; the menu, setup, garage, settings, a race HUD frame and results also at 1280x720
// and 1920x1080. States the tour cannot reach in minutes (a lap time, a drift score, a finished race) are set on the live
// session and say so in their file name ("sample"); results are the real session's results screen, opened mid-race.
// A UI-pass step as the label (s1) tours only that step's screens, every shot at all three sizes, plus its keyboard and motion
// checks in report.json "checks" (no race: light on the GPU). s1: title, records, credits, the toast. s2: the bento home (and
// one circuit switch in setup, which loads the other venue).
// s3: setup (four modes), settings (four tabs; from the menu and from pause), pause (race, trial, free) and the confirm modal;
// PART=setup|settings|pause runs one part.
//   OUT=qa/ui-tour/S1-primitives-small-screens node scripts/qa-lock.mjs -- node scripts/qa-ui-tour.mjs s1
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [label = 'latest', base = 'http://127.0.0.1:5180'] = process.argv.slice(2);
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), out = resolve(root, process.env.OUT ?? join('qa', 'ui-tour', label));
const track = process.env.TRACK ?? 'marina';
mkdirSync(out, { recursive: true });
const SIZES = [[1600, 900], [1280, 720], [1920, 1080]];   // never above 2560x1440 on this PC
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await ctx.addInitScript(([track]) => { try { localStorage.setItem('ultrack.v1', JSON.stringify({ settings: { track, look: 'dusk', weather: 'dry', laps: 1 } })); } catch { /* none */ } }, [track]);
// Vite's HMR socket stubbed: another agent saving a file would otherwise reload the page mid-tour
await ctx.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); window.WebSocket = F; });
const page = await ctx.newPage(), errors = [], shots = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
/** the active screen (or the HUD, in a session with no screen up) fully faded in, and no other screen still fading out */
const settle = () => page.waitForFunction(() => {
  const g = window.game, el = g.screen?.el ?? (g.hud?.el.classList.contains('on') ? g.hud.el : null);
  const open = [...document.querySelectorAll('#ui > .screen:not(.hidden)')].filter((e) => e !== el);
  return (!el || getComputedStyle(el).opacity === '1') && !open.length;
}, null, { timeout: 15000 });
/** what a shot shows, from the DOM: text outside the viewport, text clipped by its box, the font families, glyphs used as icons */
const audit = () => page.evaluate(() => {
  const W = innerWidth, H = innerHeight, offscreen = [], clipped = [], fonts = new Set(), glyphs = new Set();
  const vis = (e) => e.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
  const say = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''} "${(e.textContent ?? '').trim().slice(0, 40)}"`;
  // off the viewport inside a scrolling panel is below the fold, not lost; mid-animation (a pop's scale) is transient: both say so
  const scrolled = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return true; } return false; };
  const why = (e) => (scrolled(e) ? ' (in a scroller)' : '') + (e.getAnimations().length ? ' (animating)' : '');
  for (const e of document.querySelectorAll('#ui *, .race-loading *')) {
    if (!vis(e) || !e.textContent?.trim()) continue;
    const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!own) continue;                                                   // judge text where it is written, not every ancestor
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    fonts.add(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim());
    if (r.width && (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1)) offscreen.length < 12 && offscreen.push(say(e) + why(e));
    if (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'visible') clipped.length < 12 && clipped.push(say(e));
    for (const ch of own.match(/[\u2190-\u21ff\u2500-\u25ff\u2600-\u27bf\u{1f300}-\u{1faff}]/gu) ?? []) glyphs.add(ch);
  }
  return { offscreen, clipped, fonts: [...fonts], iconGlyphs: [...glyphs] };
});
let n = 0;
/** a PNG of the page now; multi: also at 1280x720 and 1920x1080, then back to 1600x900; probe: a measure kept per size */
async function shot(name, multi = false, probe = null) {
  const id = String(++n).padStart(2, '0');
  for (const [w, h] of multi ? SIZES : SIZES.slice(0, 1)) {
    if (w !== 1600) { await page.setViewportSize({ width: w, height: h }); await frames(); await frames(); }
    const file = `${id}-${name}-${w}x${h}.png`;
    await page.screenshot({ path: join(out, file) });
    shots.push({ file, audit: await audit(), ...(probe ? { probe: await probe() } : {}) });
  }
  if (multi) { await page.setViewportSize({ width: 1600, height: 900 }); await frames(); await frames(); }
  console.log('shot', id, name);
}
const key = async (code) => { await page.keyboard.press(code); await frames(); };
const tile = async (id) => { await page.click(`.bento-tile[data-id=${id}]`); await settle(); };
/** from the menu: a mode's setup panel, Start, the race loading screen, and the session ready (its HUD up) */
async function start(mode, loadingShot) {
  await tile(mode);
  await page.click('.panel.setup button.cta');
  if (loadingShot) { await page.waitForSelector('.race-loading', { state: 'visible', timeout: 60000 }); await frames(); await shot('race-loading'); }
  await page.waitForFunction(() => window.game?.session && !window.game.raceLoading.active, null, { timeout: 300000 });
  await page.waitForFunction(() => window.game.session.field.rig, null, { timeout: 120000 });   // Marina opens on an intro camera
}
const running = (t = 0) => page.waitForFunction((t) => window.game.session?.state === 'running' && window.game.session.raceT > t, t, { timeout: 60000 });
const pauseOpt = async (text) => { await page.click(`.pause .opt:has-text("${text}")`); await frames(); await settle(); };
const S1 = label === 's1', checks = {};
const nav = (f, a) => page.evaluate(f, a);
/** keyboard-only reach of the open screen: the arrows from every Nav stop (a search over the four keys), and Tab through the page */
async function reach(name, keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {   // a list screen: Up/Down only (Left/Right would change its settings)
  const n = await nav(() => window.game.nav.items().length), seen = new Set([await nav(() => window.game.nav.i)]), todo = [...seen];
  while (todo.length) {
    const i = todo.shift();
    for (const k of keys) {
      await nav((i) => window.game.nav.reset(i), i); await key(k);
      const j = await nav(() => window.game.nav.i); if (!seen.has(j)) { seen.add(j); todo.push(j); }
    }
  }
  await nav(() => { window.game.nav.reset(0); document.activeElement?.blur(); });
  const tabbed = new Set(); let synced = true;
  for (let t = 0; t < n + 6; t++) {
    await key('Tab');
    const [j, i] = await nav(() => [window.game.nav.items().indexOf(document.activeElement), window.game.nav.i]);
    if (j >= 0) { tabbed.add(j); synced &&= i === j; }
  }
  checks[name] = { stops: n, arrows: seen.size, tab: tabbed.size, tabMovesNav: synced };
}
/** what s1 owns: title, records, credits, the toast; keyboard reach, hover, Esc, and reduce motion (no animation on a screen change) */
async function s1() {
  const imgs = () => page.waitForFunction(() => [...document.querySelectorAll('#ui .screen.on img')].every((i) => i.complete), null, { timeout: 15000 });
  await page.click('.bento-tile.records-tile'); await settle(); await imgs(); await shot('records', true);
  await reach('records');
  await nav(() => window.game.nav.reset(0)); await page.hover('.rec-rows .lrow:nth-child(5)'); await frames();
  checks.hoverKeepsFocus = await nav(() => window.game.nav.i === 0);
  const cards = await page.$$('.ccard');
  if (cards.length > 1) {                                                                       // Enter on another circuit shows its records
    await nav(() => window.game.nav.reset([...document.querySelectorAll('.ccard')].findIndex((c) => !c.classList.contains('on'))));
    await key('Enter'); await frames(); await imgs(); await shot('records-other-circuit', true);
    checks.enterShowsCircuit = await nav(() => document.querySelector('.ccard.sel')?.classList.contains('on'));
  }
  await key('Escape'); await settle(); checks.escRecords = await nav(() => window.game.screenName === 'menu');
  await tile('credits'); await shot('credits', true);
  await nav(() => { const s = document.querySelector('.cr-scroll'); s.scrollTop = s.scrollHeight; }); await frames(); await shot('credits-end', true);
  await reach('credits');
  await key('Escape'); await settle(); checks.escCredits = await nav(() => window.game.screenName === 'menu');
  await nav(() => window.game.setBusy('Preparing 1 car…')); await page.waitForTimeout(400); await shot('toast-busy', true);
  await nav(() => { window.game.setBusy('Session could not load. Try Start again.'); window.game.busyEl.dataset.kind = 'error'; }); await page.waitForTimeout(400); await shot('toast-error-sample', true);
  await nav(() => { window.game.setBusy(''); delete window.game.busyEl.dataset.kind; }); await page.waitForTimeout(400);
  // reduce motion from the game's own setting: no CSS transition or animation runs on a screen change
  const flip = () => nav(() => [...document.querySelectorAll('.screen.on .row')].find((r) => /Reduce motion/.test(r.textContent)).querySelector('.toggle').click());
  await tile('settings'); await flip(); checks.motionAttr = await nav(() => document.documentElement.dataset.motion);
  await key('Escape'); await settle();
  const anims = [];
  for (const sel of ['.bento-tile.records-tile', null, '.bento-tile[data-id=credits]', null]) {
    if (sel) await page.click(sel); else await key('Escape');
    await frames(); anims.push(await nav(() => document.getAnimations().map((a) => a.transitionProperty ?? a.animationName ?? 'animation')));
    await settle();
  }
  checks.reduceMotionAnimations = anims;
  await tile('settings'); await flip(); await key('Escape'); await settle();
  checks.motionAttrAfter = await nav(() => document.documentElement.dataset.motion);
}

const S2 = label === 's2';
/** what s2 owns: the bento home. Three sizes, the focused Race tile keeping its still, keyboard reach, Esc staying on the menu,
 *  and the Race tile following a circuit switched in setup */
async function s2() {
  const imgs = () => page.waitForFunction(() => [...document.querySelectorAll('#ui .screen.on img')].every((i) => i.complete), null, { timeout: 15000 });
  const raceStill = () => nav(() => { const t = document.querySelector('.bento-tile[data-id=race]'), i = t.querySelector('.tile-still');
    return { sel: t.classList.contains('sel'), src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0, visible: i.checkVisibility({ checkOpacity: true }), facts: t.querySelector('.tile-facts').textContent }; });
  const facts = () => page.waitForFunction(() => !/—/.test(document.querySelector('.tile-facts').textContent), null, { timeout: 10000 }).catch(() => {});
  await nav(() => window.game.nav.reset(0)); await imgs(); await facts();
  await shot('menu', true);
  checks.raceFocused = await raceStill();
  await key('ArrowRight'); await shot('menu-focus-moved', true);
  await reach('menu');
  await nav(() => window.game.nav.reset(2)); await page.hover('.bento-tile[data-id=race]'); await frames(); await shot('menu-hover-race');
  checks.hoverKeepsFocus = await nav(() => window.game.nav.i === 2);
  await key('Escape'); await page.waitForTimeout(400); checks.escStaysOnMenu = await nav(() => window.game.screenName === 'menu');
  // switch the circuit in setup: the Race tile then shows the new circuit's still
  await tile('race'); await page.waitForTimeout(600);
  const other = await nav(() => { const r = [...document.querySelectorAll('.panel.setup .row')].find((e) => /Circuit/i.test(e.querySelector('label')?.textContent ?? ''));
    const b = r && [...r.querySelectorAll('.seg button')].find((x) => !x.classList.contains('on')); b?.click(); return b?.textContent ?? null; });
  if (other) {
    await page.waitForFunction(() => window.game.trackP, null, { timeout: 5000 }); await nav(() => window.game.trackP);
    await key('Escape'); await settle(); await nav(() => window.game.nav.reset(0)); await imgs(); await facts();
    checks.afterSwitch = { picked: other, ...(await raceStill()), saved: await nav(() => JSON.parse(localStorage.getItem('ultrack.v1')).settings.track) };
    await shot('menu-after-circuit-switch', true);
  } else checks.afterSwitch = 'one circuit only: no switch';
}

const S3 = label === 's3';
/** the hero car on the showroom turntable against the setup panel. The room's camera (garage-room.js: fov 48, at (7.5, 2.8, 6.6)
 *  round the target (0, .7, 0), the car at (0, .05, 0) unrotated) auto-rotates, so the car's left edge is taken over every bearing:
 *  the panel must end left of the widest one */
const carClear = () => nav(() => {
  const T = window.viewer.THREE, root = window.game.field?.hero?.root, panel = document.querySelector('.panel.setup')?.getBoundingClientRect();
  if (!root || !panel) return null;
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), at = new T.Matrix4().makeTranslation(0, 0.05, 0), pts = [], v = new T.Vector3();
  root.traverse((o) => { if (!o.isMesh || !o.visible || o.material?.transparent) return; o.geometry.boundingBox ?? o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox;
    const m = at.clone().multiply(inv).multiply(o.matrixWorld);
    for (let i = 0; i < 8; i++) pts.push(new T.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m)); });
  const cam = new T.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 60), r = Math.hypot(7.5, 6.6), a0 = Math.atan2(7.5, 6.6);
  let worst = Infinity, now = Infinity;
  for (let a = 0; a < 360; a += 3) {
    const t = a0 + a * Math.PI / 180; cam.position.set(r * Math.sin(t), 2.8, r * Math.cos(t)); cam.lookAt(0, 0.7, 0); cam.updateMatrixWorld();
    const x = Math.min(...pts.map((p) => (v.copy(p).project(cam).x + 1) / 2 * innerWidth)); worst = Math.min(worst, x); if (a === 0) now = x;
  }
  // clearShifted: with the engine handoff that moves the showroom view 12 % right while setup is up (docs/ui-system.md, H5)
  return { carLeftWorst: Math.round(worst), carLeftAtStart: Math.round(now), panelRight: Math.round(panel.right), clear: panel.right <= worst, clearShifted: panel.right <= worst + 0.12 * innerWidth };
});
/** a stand-in gamepad (navigator.getGamepads) so Nav.pad's LB / RB can be pressed for a few frames */
const padPress = async (i) => {
  await nav((i) => { const p = window.__pad ??= { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [p] }); p.buttons[i].pressed = true; }, i);
  await frames(); await frames(); await nav((i) => { window.__pad.buttons[i].pressed = false; }, i); await frames(); await frames();
};
const UD = ['ArrowUp', 'ArrowDown'];
const tabOn = () => nav(() => document.querySelector('.stabs button.on')?.textContent);
/** what s3 owns: the form controls, setup (four modes), settings (four tabs, from the menu and from pause), pause (race, trial,
 *  free) and the confirm modal. Checks: the setup panel clear of the car, the settings panel top fixed across tabs, keyboard and
 *  pad reach, Esc from settings-from-pause, the modal's trapped focus, the camera label hidden over pause */
async function s3() {
  const part = process.env.PART ?? 'setup,settings,pause';   // PART=setup|settings|pause: one part per run (a run stays short)
  const imgs = () => page.waitForFunction(() => [...document.querySelectorAll('#ui .screen.on img')].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  if (part.includes('setup')) for (const m of ['race', 'trial', 'drift', 'free']) {
    await tile(m);
    await page.waitForFunction(() => document.querySelectorAll('.panel.setup .seg.cards > button').length > 1, null, { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => ![...document.querySelectorAll('.cc-facts')].some((f) => /—/.test(f.textContent)), null, { timeout: 8000 }).catch(() => {});
    await imgs();
    checks['setupFocus-' + m] = await nav(() => { const g = window.game.nav; return g.items()[g.i]?.getAttribute('aria-label'); });
    await shot('setup-' + m, true, carClear);
    if (m === 'race') {
      await reach('setup-race', UD);
      await nav(() => window.game.nav.reset(1)); await key('ArrowRight'); await shot('setup-race-row-focus');
      await key('ArrowLeft');
    }
    await key('Escape'); await settle();
  }
  if (part.includes('settings')) {
  // the garage paint tab shares the controls: it must still lay out
  await tile('garage'); await page.waitForFunction(() => window.viewer.params.mode === 'orbit', null, { timeout: 60000 });
  for (let i = 0; i < 3; i++) await key('KeyE');
  await shot('garage-paint'); await key('Escape'); await settle();

  await tile('settings');
  const top = () => nav(() => document.querySelector('.panel.settings').getBoundingClientRect().top);
  const tops = {};
  for (const t of ['display', 'driving', 'audio', 'controls']) {
    tops[t] = await top(); await shot('settings-' + t, true);
    await reach('settings-' + t, UD);
    await key('KeyE'); await settle();
  }
  checks.settingsTop = { ...tops, same: new Set(Object.values(tops)).size === 1, after: await tabOn() };
  await nav(() => window.game.nav.reset(0)); await key('ArrowRight'); const right = await tabOn(); await key('ArrowLeft'); const left = await tabOn();
  await key('KeyQ'); const q = await tabOn(); await key('KeyE'); const e = await tabOn();
  await key('ArrowDown'); const down = await nav(() => window.game.nav.items()[window.game.nav.i]?.getAttribute('aria-label'));
  await padPress(5); const rb = await tabOn(); await shot('settings-pad-prompts'); await padPress(4); const lb = await tabOn();
  await nav(() => { delete navigator.getGamepads; });
  checks.settingsKeys = { right, left, q, e, down, rb, lb, input: await nav(() => document.documentElement.dataset.input) };
  await key('Escape'); await settle();
  }
  if (!part.includes('pause')) return;

  // race: pause (with the camera label just flashed), the restart modal, settings from pause and back, then quit through the modal
  await start('race');
  await running(1);
  await key('KeyC'); await key('Escape'); await settle();
  checks.camLabelOverPause = await nav(() => { const c = document.getElementById('cam-label'); return c && getComputedStyle(c).visibility; });
  await shot('pause-race', true); await reach('pause-race', UD);
  await pauseOpt('Restart'); await frames(); await page.waitForTimeout(300); await shot('pause-confirm-restart', true);
  checks.modal = await nav(() => ({ focus: document.activeElement?.textContent, stops: window.game.nav.items().map((b) => b.textContent), inert: document.querySelector('.p-panel').inert }));
  await key('ArrowRight'); checks.modalRight = await nav(() => document.activeElement?.textContent);
  await key('Escape'); await frames();
  checks.modalEsc = await nav(() => ({ open: !!document.querySelector('.modal'), screen: window.game.screenName, focus: window.game.nav.items()[window.game.nav.i]?.textContent }));
  await pauseOpt('Settings'); await shot('settings-from-pause', true); await key('Escape'); await settle();
  checks.escSettingsFromPause = await nav(() => window.game.screenName);
  await pauseOpt('Quit to menu'); await page.waitForTimeout(300); await shot('pause-confirm-quit');
  await page.click('.modal .btn-primary'); await settle(); checks.quitConfirmed = await nav(() => window.game.screenName);

  await start('trial'); await running(2);
  await page.evaluate(() => { const g = window.game, T = g.session.trk.get(g.field.hero); T.laps.push({ t: 92.341, valid: true }, { t: 90.112, valid: true }); T.lastLap = 90.112; T.best = 90.112; });
  await key('Escape'); await settle(); await shot('pause-trial-sample', true);
  await pauseOpt('Quit to menu'); await page.click('.modal .btn-primary'); await settle();

  await start('free'); await running(1);
  await key('Escape'); await settle(); await shot('pause-free', true);
  await pauseOpt('Quit to menu'); await page.click('.modal .btn-primary'); await settle();
}

try {
  await page.goto(base);
  await page.waitForSelector('.title-screen.on', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await shot('title-loading');
  await page.waitForFunction(() => window.game?.loaded, null, { timeout: 180000 });
  await settle(); await shot('title-ready', S1);
  await key('Enter'); await page.waitForSelector('.bento-tile[data-id=race]', { state: 'visible' }); await settle();
  if (S1) await s1(); else if (S2) await s2(); else if (S3) await s3(); else {                                                             // the whole tour (not re-indented)
  await shot('menu', true);
  await key('ArrowRight'); await shot('menu-focus-moved');                                    // keyboard focus on the second tile
  await key('ArrowLeft');
  for (const m of ['race', 'trial', 'drift', 'free']) {
    await tile(m); await page.waitForTimeout(400);                                           // the circuit row lands after availableTracks()
    await shot('setup-' + m, m === 'race'); await key('ArrowDown'); await shot('setup-' + m + '-row-focus');
    await key('Escape'); await settle();
  }
  await tile('garage');
  await page.waitForFunction(() => window.viewer.params.mode === 'orbit', null, { timeout: 60000 });
  for (const t of ['car', 'specs', 'upgrades', 'paint']) { await shot('garage-' + t, t === 'car'); await key('KeyE'); }
  await key('Escape'); await settle();
  await tile('settings');
  for (const t of ['display', 'driving', 'audio', 'controls']) { await shot('settings-' + t, t === 'display'); await key('KeyE'); await settle(); }
  await key('Escape'); await settle();
  await page.click('.bento-tile.records-tile'); await settle(); await shot('records'); await key('Escape'); await settle();
  await tile('credits'); await shot('credits'); await key('Escape'); await settle();
  await page.evaluate(() => window.game.setBusy('Session could not load. Try Start again.')); await frames(); await shot('toast-busy');
  await page.evaluate(() => window.game.setBusy(''));

  // ---- race: loading, lights, GO, nitro, the HUD, a lap message, wrong way, camera label, map overview, pause, results
  await start('race', true);
  await page.waitForFunction(() => document.querySelectorAll('.hud .lights i.on').length >= 3, null, { timeout: 60000 }); await shot('race-grid-lights');
  await page.waitForSelector('.hud .count.go', { timeout: 60000 }); await shot('race-go');
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  const nitro = await page.waitForFunction(() => window.game.session.field.hero.vehicle.state.nitroOn, null, { timeout: 6000 }).then(() => true, () => false);
  await shot(nitro ? 'race-nitro' : 'race-throttle-no-nitro');
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  await page.evaluate(() => window.game.session.field.setPlayer(false));                      // the AI drives on: no wall stops the tour
  await running(9); await settle(); await shot('race-hud', true);
  await page.evaluate(() => { window.game.hud.lapDelta(-0.418, true); window.game.hud.message('Lap 1', '1:31.204  −0.418', 'good', 3.2); }); await frames(); await shot('race-message-sample');
  await page.evaluate(() => { const S = window.game.session; Object.defineProperty(S, 'wrong', { configurable: true, get: () => 5, set() {} }); });
  await page.waitForFunction(() => +getComputedStyle(document.querySelector('.hud .warn')).opacity > 0.7, null, { timeout: 5000 }); await shot('race-wrong-way-sample');
  await page.evaluate(() => { const S = window.game.session; delete S.wrong; S.wrong = 0; });
  await key('KeyC'); await page.waitForFunction(() => getComputedStyle(document.getElementById('cam-label')).opacity === '1', null, { timeout: 3000 }); await shot('race-camera-label');
  for (let i = 0; i < 4; i++) await key('KeyC');                                             // five views: back to the chase view
  await key('KeyM'); await shot('race-map-overview'); await key('KeyM');
  await key('Escape'); await settle(); await shot('pause-race');
  await pauseOpt('Settings'); await shot('settings-from-pause'); await key('Escape'); await settle();
  await pauseOpt('Resume'); await frames();
  await page.evaluate(() => window.game.results()); await settle(); await shot('results-race-midrace', true);
  await page.click('.results .cta.ghost'); await settle();

  // ---- time trial: the countdown, the HUD with sample laps, pause with "End", the trial results
  await start('trial');
  await page.waitForFunction(() => /^[123]$/.test(document.querySelector('.hud .count')?.textContent ?? ''), null, { timeout: 30000 }); await shot('trial-count');
  await running(2);
  await page.evaluate(() => { const g = window.game, T = g.session.trk.get(g.field.hero); T.laps.push({ t: 92.341, valid: true }, { t: 90.112, valid: true }, { t: 95.871, valid: false }); T.lastLap = 95.871; T.best = 90.112; T.valid = false; });
  await frames(); await settle(); await shot('hud-trial-sample');
  await key('Escape'); await settle(); await shot('pause-trial');
  await pauseOpt('End'); await shot('results-trial-sample');
  await page.click('.results .cta.ghost'); await settle();

  // ---- drift attack: the HUD, then its results with a sample score
  await start('drift'); await running(2); await settle(); await shot('hud-drift');
  await page.evaluate(() => { window.game.session.drift.score = 18420; window.game.results(); }); await settle(); await shot('results-drift-sample');
  await page.click('.results .cta.ghost'); await settle();

  // ---- free drive: the HUD, pause, quit
  await start('free'); await running(2); await settle(); await shot('hud-free');
  await key('Escape'); await settle(); await shot('pause-free');
  await pauseOpt('Quit to menu'); await page.click('.modal .btn-primary'); await settle(); await shot('menu-after-quit');   // Quit asks first
  }
} catch (e) {
  errors.push('tour: ' + e.message.split('\n')[0]);
  await page.screenshot({ path: join(out, 'zz-failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ base, track, checks, shots, errors: [...new Set(errors)].slice(0, 60) }, null, 1));
  await browser.close();
}
const flagged = shots.filter((s) => s.audit.offscreen.length || s.audit.clipped.length || s.audit.iconGlyphs.length);
console.log(JSON.stringify({ out, shots: shots.length, checks, flagged: flagged.map((s) => s.file), errors: [...new Set(errors)].slice(0, 20) }, null, 1));
