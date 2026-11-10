// Radio screen check (headless Chrome), the sibling of qa-radio.mjs: proves the panel from the audio elements' src and the screens.
//   node scripts/qa-lock.mjs -- node scripts/qa-radio-menu.mjs [url]
// Opens from the menu footer and T, lists every credits.json track (7 soundtrack + 10 classical), a click and Enter play exactly that
// file, prev / next step the list, the station seg switches, a pick from another station switches to it, a picked track survives
// starting a race and the station resumes after it, the panel opens from pause (still paused) and from Settings, Esc returns, no
// console errors. Screenshots in qa/radio-menu/: the panel over the menu (both stations) and over pause, the menu and the pause screen.
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const url = process.argv[2] ?? 'http://127.0.0.1:5313';
const TRACKS = JSON.parse(readFileSync(new URL('../../assets/audio/music/credits.json', import.meta.url)));
const OUT = fileURLToPath(new URL('../qa/radio-menu/', import.meta.url)); mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const snap = () => p.evaluate(() => { const g = window.game, m = g.audio.music; return { screen: g.screenName, station: m.station, setting: JSON.parse(localStorage.getItem('ultrack.v1') ?? '{}').settings?.radio,
  src: m.cur.el.src.replace(location.origin + '/assets/audio/', ''), t: +m.cur.el.currentTime.toFixed(2), playing: !m.cur.el.paused, loop: m.cur.el.loop, picked: m.picked?.id ?? null, now: m.now?.id ?? null,
  session: !!g.session, paused: !!g.ctx.params.paused,
  rows: [...document.querySelectorAll('.radio .rd-row')].map((r) => r.getAttribute('aria-label')), me: document.querySelector('.radio .rd-row.me')?.getAttribute('aria-label') ?? null,
  time: document.querySelector('.radio .rd-time')?.textContent }; });
const settle = (ms = 800) => p.waitForTimeout(ms);
const fileOf = (title) => TRACKS.find((t) => t.title === title)?.file;

await p.goto(url); await p.waitForTimeout(8000); await p.keyboard.press('Space'); await p.waitForTimeout(4000);

// ---- from the menu: the footer button
await p.screenshot({ path: OUT + 'menu-with-radio.png' });
await p.click('.home .home-radio'); await settle(1500);
let s = await snap();
const SOUND = TRACKS.filter((t) => t.context !== 'classical').map((t) => t.title), CLASS = TRACKS.filter((t) => t.context === 'classical').map((t) => t.title);
ok('menu footer opens the Radio screen on the Soundtrack', s.screen === 'radio' && s.station === 'soundtrack', s);
ok('the Soundtrack lists its 7 tracks in credits.json order', SOUND.length === 7 && JSON.stringify(s.rows) === JSON.stringify(SOUND), s.rows);
ok('every Soundtrack row says where it plays (Menu / Race / Results)', await p.$$eval('.radio .rd-row', (R) => R.every((r) => /^(Menu|Race|Results)$/.test(r.querySelector('.tag')?.textContent ?? ''))), null);
ok('now playing is highlighted, with elapsed / length', s.me === s.rows.find((r) => fileOf(r) === s.src) && /^\d+:\d\d \/ \d+:\d\d$/.test(s.time ?? ''), { me: s.me, src: s.src, time: s.time });
await p.screenshot({ path: OUT + 'radio-over-menu.png' });

await p.click('.radio .rd-row:nth-child(3)'); await settle();
s = await snap();
ok('a click plays exactly that file', s.src === fileOf(SOUND[2]) && s.playing && s.me === SOUND[2] && s.picked, s);
await p.click('.radio .rd-skip[aria-label="Next track"]'); await settle(); s = await snap();
ok('Next plays the following track', s.src === fileOf(SOUND[3]) && s.me === SOUND[3], s);
await p.click('.radio .rd-skip[aria-label="Previous track"]'); await p.click('.radio .rd-skip[aria-label="Previous track"]'); await settle(); s = await snap();
ok('Previous twice goes back two', s.src === fileOf(SOUND[1]) && s.me === SOUND[1], s);

// ---- the station seg
await p.click('.radio .rd-station .seg button:nth-child(2)'); await settle(2000); s = await snap();
ok('the station switches to Classical: its 10 tracks, a classical file plays', s.station === 'classical' && s.setting === 'classical' && CLASS.length === 10 && JSON.stringify(s.rows) === JSON.stringify(CLASS) && s.src.startsWith('music/classical/') && s.playing, s);
ok('7 + 10 = every credits.json track was listed', SOUND.length + CLASS.length === TRACKS.length && TRACKS.length === 17, TRACKS.length);
await p.screenshot({ path: OUT + 'radio-classical-over-menu.png' });
await p.click('.radio .rd-row:nth-child(5)'); await settle(); s = await snap();
ok('a classical click plays exactly that file', s.src === fileOf(CLASS[4]) && s.me === CLASS[4], s);
await p.click('.radio .rd-skip[aria-label="Previous track"]'); await settle(); s = await snap();
ok('Previous on Classical', s.src === fileOf(CLASS[3]), s);
await p.evaluate((t) => window.game.pickTrack(t), TRACKS.find((t) => t.id === 'hotrock'));   // the list shows one station, so a cross-station pick goes through game.pickTrack
await settle(1500); s = await snap();
ok('a Soundtrack track picked on Classical switches the station to Soundtrack', s.station === 'soundtrack' && s.setting === 'soundtrack' && s.src === 'music/hotrock.ogg' && s.rows.length === 7 && s.me === 'Hotrock', s);
await p.click('.radio .rd-station .seg button:nth-child(3)'); await settle(2000); s = await snap();
ok('Off: no rows, the now-playing block hidden', s.station === 'off' && s.rows.length === 0 && await p.$eval('.radio .rd-now', (e) => e.hidden) && await p.$('.radio .rd-off') !== null, s);
await p.click('.radio .rd-station .seg button:nth-child(1)'); await settle(1500);

// ---- Escape returns; T opens; the keyboard plays a row
await p.keyboard.press('Escape'); await settle(); s = await snap();
ok('Escape returns to the menu', s.screen === 'menu', s.screen);
await p.keyboard.press('KeyT'); await settle(); s = await snap();
ok('T opens the Radio screen from the menu', s.screen === 'radio', s.screen);
for (let i = 0; i < 12; i++) { if (await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) === SOUND[4]) break; await p.keyboard.press('ArrowDown'); await p.waitForTimeout(80); }
await p.keyboard.press('Enter'); await settle(); s = await snap();
ok('arrows + Enter play the focused row', s.src === fileOf(SOUND[4]) && s.me === SOUND[4], s);
await p.keyboard.press('KeyT'); await settle(); s = await snap();
ok('T again closes it back to the menu', s.screen === 'menu', s.screen);

// ---- a pick survives starting a race; the station resumes after it
await p.keyboard.press('KeyT'); await settle();
await p.click(`.radio .rd-row[aria-label="${SOUND[2]}"]`); await settle(3000);
const before = await snap();
await p.keyboard.press('Escape'); await settle();
await p.click('.race-tile'); await p.waitForTimeout(2500); await p.locator('button.cta:visible').first().click();
for (let i = 0; i < 60 && !(await p.evaluate(() => window.game.session && !window.game.screen)); i++) await p.waitForTimeout(1500);
await p.waitForTimeout(2000); s = await snap();
ok('the picked track plays on into the race, not restarted', s.session && s.src === before.src && s.picked === before.picked && s.t > before.t && s.playing && !s.loop, { before, s });
await p.evaluate(() => { const e = window.game.audio.music.cur.el; e.currentTime = Math.max(0, e.duration - 1.5); }); await p.waitForTimeout(4500); s = await snap();
ok('after the pick ends the race playlist resumes', s.session && s.picked === null && s.now && s.src !== before.src && s.playing, s);

// ---- from pause: still paused; and T mid-race
await p.keyboard.press('Escape'); await settle(); await p.screenshot({ path: OUT + 'pause-with-radio.png' });
await p.locator('.pause .p-opts button', { hasText: 'Radio' }).click(); await settle(1200); s = await snap();
ok('pause -> Radio: the race stays paused', s.screen === 'radio' && s.session && s.paused, s);
await p.screenshot({ path: OUT + 'radio-over-pause.png' });
await p.click('.radio .rd-row:nth-child(6)'); await settle(); s = await snap();
ok('a pick from pause plays and does not unpause', s.src === fileOf(SOUND[5]) && s.paused && s.screen === 'radio', s);
await p.keyboard.press('Escape'); await settle(); s = await snap();
ok('Escape returns to pause, still paused', s.screen === 'pause' && s.paused, s);
await p.keyboard.press('Escape'); await settle(); s = await snap();
ok('Escape on pause resumes', s.screen === null && !s.paused, s);
await p.keyboard.press('KeyT'); await settle(); s = await snap();
ok('T mid-race pauses and opens the radio', s.screen === 'radio' && s.paused, s);
await p.keyboard.press('Escape'); await settle(); s = await snap();
ok('... and Escape goes to pause', s.screen === 'pause' && s.paused, s);

// ---- Settings -> Sound -> Open radio, back to Settings, back to pause
await p.locator('.pause .p-opts button', { hasText: 'Settings' }).click(); await settle();
await p.locator('.settings-screen .stabs button', { hasText: 'Sound' }).click(); await settle(); await p.screenshot({ path: OUT + 'settings-sound.png' });
await p.locator('.settings-screen .row', { hasText: 'Open radio' }).click(); await settle(); s = await snap();
ok('Settings -> Sound -> Open radio', s.screen === 'radio' && s.paused, s.screen);
await p.keyboard.press('Escape'); await settle(); s = await snap();
ok('Escape returns to Settings', s.screen === 'settings', s.screen);
await p.keyboard.press('Escape'); await settle(); s = await snap();
ok('... and Settings still returns to pause', s.screen === 'pause' && s.paused, s.screen);

ok('no console errors', errors.length === 0, errors);
await b.close(); process.exit(fails ? 1 : 0);
