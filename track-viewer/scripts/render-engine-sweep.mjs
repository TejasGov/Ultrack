// Renders a race pull through the game's real mixer and gearbox in a headless Chrome (OfflineAudioContext), to qa/engine-sound/<car>-<bank>.wav,
// with the rpm per frame beside it. Needs the dev server. Usage: node scripts/render-engine-sweep.mjs [car ...] [--bank packs|measured|current]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), at = argv.indexOf('--bank');
const banks = at < 0 ? ['measured', 'packs'] : [argv[at + 1]];
const named = argv.filter((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
const files = { packs: 'engine-packs.json', measured: 'engine-bank.json', current: 'recorded-engine-bank.json' };   // current: the old sound, as the listening page calls it
const out = join(root, 'qa', 'engine-sound');
mkdirSync(out, { recursive: true });
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext();
// any agent saving a file would otherwise hot-reload this page mid-render (the shared dev server reloads everyone)
await context.addInitScript(() => { const W = window.WebSocket; const F = function (u, p) { if (p === 'vite-hmr') { const t = new EventTarget(); t.send = () => {}; t.close = () => {}; t.readyState = 0; return t; } return new W(u, p); }; F.prototype = W.prototype; Object.assign(F, W); window.WebSocket = F; });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page:', e.message));
await page.goto('http://127.0.0.1:5180/audio-lab.html');

const profiles = JSON.parse(readFileSync(join(root, 'public/assets/audio', files.measured), 'utf8')).profiles;
const keys = named.length ? named : Object.keys(profiles);
for (const key of keys) for (const bank of banks) {
  const r = await page.evaluate(async ({ key, file }) => {
    const { GameAudio, Gearbox, expandBank } = await import('/src/game/audio.js');
    const SR = 48000, LEN = 19, ctx = new OfflineAudioContext(1, SR * LEN, SR), audio = new GameAudio();
    await audio.start(ctx);
    audio.engineBank = expandBank(await (await fetch('/assets/audio/' + file)).json());
    audio.setVolumes({ master: 1, engine: .85, effects: .8, commentaryOn: false, commentary: 0, crowd: 0 });
    await audio.engineFor(key);
    const DT = 1 / 60, gears = new Gearbox(85, audio.engine.prof.redline), rpm = [];
    let speed = 0;
    for (let i = 1; i < LEN * 60; i++) {
      const t = i * DT, thr = t > 1.5 && t < 13 ? 1 : 0;
      ctx.suspend(Math.round(t * SR / 128) * 128 / SR).then(() => {
        speed = thr ? speed + (85 - speed) * DT / 6 : speed * Math.exp(-DT / 9);
        if (gears.update(DT, speed, thr) === 'up' && thr > .8) audio.shift();
        if (t > 13 && (i % 20) === 0 && t < 14.2) audio.pop();
        audio.engineUpdate(gears.rpm, thr, 1, speed, 0);
        rpm.push([+t.toFixed(3), Math.round(gears.rpm), gears.gear + 1]);
        ctx.resume();
      });
    }
    const buf = await ctx.startRendering();
    const pcm = new Int16Array(buf.length), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
    const bytes = new Uint8Array(pcm.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    return { b64: btoa(s), rpm };
  }, { key, file: files[bank] });
  const pcm = Buffer.from(r.b64, 'base64'), head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(48000, 24); head.writeUInt32LE(96000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(out, `${key}-${bank}.wav`), Buffer.concat([head, pcm]));
  writeFileSync(join(out, `${key}-${bank}.json`), JSON.stringify(r.rpm));
  console.log(key, bank, (pcm.length / 96000).toFixed(1) + 's');
}
await browser.close();
