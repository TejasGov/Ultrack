// Radio check (headless Chrome): proves the stations from the audio elements' src / currentTime and the music bus gain.
//   node scripts/qa-lock.mjs -- node scripts/qa-radio.mjs [url]
// Soundtrack plays by default; N -> Classical (a classical file, also in a race, at the race level 0.6); N -> Off silences it;
// N -> Soundtrack again; the station survives a reload; no console errors.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://127.0.0.1:5313';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let fails = 0;
const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
const snap = () => p.evaluate(() => { const m = window.game.audio.music; return { station: window.game.audio.music && m.station, setting: JSON.parse(localStorage.getItem('ultrack.v1') ?? '{}').settings?.radio, screen: window.game.screenName,
  cur: { src: m.cur.el.src.replace(location.origin, ''), t: +m.cur.el.currentTime.toFixed(2), paused: m.cur.el.paused, gain: +m.cur.gain.gain.value.toFixed(2) },
  old: { src: m.old.el.src.replace(location.origin, ''), paused: m.old.el.paused, gain: +m.old.gain.gain.value.toFixed(2) },
  level: +m.level.gain.value.toFixed(2), bus: +window.game.audio.bus.music.gain.value.toFixed(2), toast: document.querySelector('.asset-loading')?.textContent }; });
const progress = async () => { const a = await snap(); await p.waitForTimeout(1500); const c = await snap(); return c.cur.t > a.cur.t; };
const boot = async () => { await p.goto(url); await p.waitForTimeout(8000); await p.keyboard.press('Space'); await p.waitForTimeout(4000); };

await boot();
let s = await snap();
ok('default is the Soundtrack, a menu track plays', s.cur.src.startsWith('/assets/audio/music/') && !s.cur.src.includes('/classical/') && !s.cur.paused && await progress(), s);
ok('menu level is 1', Math.abs((await snap()).level - 1) < 0.05, s.level);

await p.keyboard.press('KeyN'); await p.waitForTimeout(3000); s = await snap();
ok('N -> Classical: a classical file plays, the old player is silent and paused', s.station === 'classical' && s.cur.src.includes('/music/classical/') && !s.cur.paused && s.old.gain === 0 && s.old.paused && await progress(), s);
ok('toast names the station and the piece', /^Radio: Classical · .+/.test(s.toast ?? ''), s.toast);
const classicalFile = s.cur.src;

await p.click('.race-tile'); await p.waitForTimeout(2500); await p.locator('button.cta:visible').first().click();
for (let i = 0; i < 60 && (await snap()).screen !== 'hud' && !(await p.evaluate(() => window.game.session && !window.game.screen)); i++) await p.waitForTimeout(1500);
await p.waitForTimeout(3000); s = await snap();
ok('in the race: classical keeps playing at the race level 0.6', await p.evaluate(() => !!window.game.session) && s.cur.src.includes('/music/classical/') && !s.cur.paused && Math.abs(s.level - 0.6) < 0.05 && await progress(), s);

await p.keyboard.press('KeyN'); await p.waitForTimeout(3000); s = await snap();
ok('N -> Off: level 0, both players paused or silent', s.station === 'off' && s.level === 0 && s.cur.gain === 0 && s.cur.paused && s.old.paused && s.toast === 'Radio: Off', s);
await p.keyboard.press('KeyN'); await p.waitForTimeout(3000); s = await snap();
ok('N -> Soundtrack in the race: a race track plays at 0.6', s.station === 'soundtrack' && s.cur.src.startsWith('/assets/audio/music/') && !s.cur.src.includes('/classical/') && !s.cur.paused && Math.abs(s.level - 0.6) < 0.05 && await progress(), s);
await p.keyboard.press('KeyN'); await p.waitForTimeout(2000); s = await snap();
ok('N -> Classical again', s.station === 'classical' && s.setting === 'classical', s);

await boot(); s = await snap();
ok('the setting persists across a reload and Classical plays', s.setting === 'classical' && s.station === 'classical' && s.cur.src.includes('/music/classical/') && !s.cur.paused && await progress(), s);
ok('no console errors', errors.length === 0, errors);
await b.close(); process.exit(fails ? 1 : 0);
